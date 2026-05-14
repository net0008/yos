// pages/api/analyze-report.js
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin'; // Merkezi admin istemcisini kullan
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdf from 'pdf-parse';

// Gemini AI istemcisini başlatın (Ortam değişkenlerinde GEMINI_API_KEY tanımlı olmalıdır)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Geçerli hata kodları (Veritabanındaki rapor_status ENUM değerleri)
const validErrorCodes = [
    'IMZA_MUHUR_EKSİK', 'FORMAT_HATALI', 'ESKI_FORMAT',
    'GENEL_IFADE', 'BOS_BOLUM_ACIKLAMA_YOK',
    'UST_BILGI_EKSİK_HATALI', 'ONAY_TARIHI_EKSİK', 'RAPOR_OKUNMUYOR'
];

/**
 * Veritabanından Admin tarafından tanımlanmış dinamik ayarları çeker.
 */
async function getSystemSettings(donem) {
    if (!donem) {
        throw new Error("Analiz için dönem bilgisi alınamadı.");
    }
    const { data, error } = await supabase
        .from('sistem_ayarlari')
        .select('gorev_tanimlari, analiz_kriterleri')
        .eq('donem', donem)
        .single();

    if (error) {
        console.error(`'${donem}' için sistem ayarları çekilirken hata:`, error);
        throw new Error(`'${donem}' dönemi için sistem ayarları bulunamadı veya veritabanından çekilemedi.`);
    }

    return {
        gorevler: data.gorev_tanimlari,
        kriterler: data.analiz_kriterleri,
    };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    // Bu endpoint genellikle bir Supabase webhook tarafından tetiklenir.
    const { record: rapor } = req.body;

    if (!rapor || !rapor.id) {
        return res.status(400).json({ message: 'Geçerli rapor kaydı bilgisi zorunludur.' });
    }

    // PDF yolu olmayan kayıtları (örn: RAPOR_GONDERILMEMIS) analiz etmeye çalışma.
    if (!rapor.pdf_storage_path) {
        return res.status(200).json({ success: true, message: 'Analiz için PDF dosyası bulunmadığından işlem atlandı.' });
    }

    const rapor_id = rapor.id;

    try {
        // Analiz başlamadan durumu güncelle
        await supabase.from('raporlar').update({ status: 'ai_incelendi' }).eq('id', rapor_id);

        // PDF dosyasını Storage'dan indir
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('raporlar')
            .download(rapor.pdf_storage_path);

        if (downloadError) throw new Error(`PDF indirme hatası: ${downloadError.message}`);

        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        const pdfText = (await pdf(fileBuffer)).text;

        const { gorevler, kriterler } = await getSystemSettings(rapor.donem);

        const prompt = `
      SENARYO: Sen, YEĞİTEK Okul Sorumluları tarafından yüklenen aylık faaliyet raporlarını denetleyen uzman bir denetçisin.
      GÖREV: Sana metin olarak verilen PDF raporunu analiz et ve bulgularını sadece ve sadece istenen JSON formatında döndür. Başka hiçbir açıklama ekleme.
      REFERANS BİLGİLERİ:
      1. Okul Sorumlusunun Resmi Görev Tanımları:
      ---
      ${gorevler}
      ---
      2. Değerlendirme Kriterleri (Bunları kontrol etmelisin):
      ---
      ${kriterler.join('\n')}
      ---
      İSTENEN JSON ÇIKTI YAPISI:
      {
        "analiz_ozeti": "1-2 cümlelik genel bir özet.",
        "genel_durum": "Tüm kriterler başarılı ise 'UYGUN', herhangi biri başarısız ise 'UYGUN DEĞİL' yaz.",
        "kontrol_listesi": [{"kriter": "Değerlendirme kriterinin tam metni", "durum": "'BAŞARILI' veya 'BAŞARISIZ'", "aciklama": "Bu kararı neden verdiğini kısaca açıkla.", "hata_kodu": "Eğer durum 'BAŞARISIZ' ise, ilgili hata kodunu (örn: IMZA_MUHUR_EKSİK, FORMAT_HATALI, ESKI_FORMAT, GENEL_IFADE, BOS_BOLUM_ACIKLAMA_YOK, UST_BILGI_EKSİK_HATALI, ONAY_TARIHI_EKSİK, RAPOR_OKUNMUYOR) buraya ekle, yoksa null."}],
        "gorev_kapsami_analizi": {"kapsam_disi_faaliyetler": ["Görev tanımı dışında tespit ettiğin faaliyetleri buraya dizi olarak ekle."], "aciklama": "Kapsam dışı faaliyetler hakkında kısa bir yorum."},
        "siradisi_durumlar": ["Raporda belirtilen 'etkileşimli tahta hurdaya çıktı' gibi dikkat çekici, aksaklık veya özel durumları bu diziye ekle."]
      }
      ANALİZ EDİLECEK RAPOR METNİ:
      ---
      ${pdfText}
      ---
    `;

        // Gemini 1.5 Flash modeli daha performanslıdır ve doğrudan JSON çıktısını destekler.
        const model = genAI.getGenerativeModel({
            model: "gemini-1.5-flash",
            generationConfig: {
                responseMimeType: "application/json",
            }
        });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();
        let analysisResult;

        try {
            analysisResult = JSON.parse(responseText);
        } catch (jsonError) {
            console.error(`Rapor ID ${rapor_id} için AI'dan gelen JSON parse edilemedi. Yanıt:`, responseText);
            throw new Error('Yapay zeka yanıtı geçerli bir formatta değil.');
        }

        // --- Akıllı Durum Belirleme ---
        let finalStatus = 'koordinator_onayinda'; // Varsayılan durum

        if (analysisResult.genel_durum === 'UYGUN') {
            finalStatus = 'onaylandi';
        } else if (analysisResult.genel_durum === 'UYGUN DEĞİL') {
            // Eğer genel durum uygun değilse, kontrol listesindeki başarısız maddeleri kontrol et
            const failedItems = analysisResult.kontrol_listesi?.filter(item => item.durum === 'BAŞARISIZ' && item.hata_kodu);

            if (failedItems && failedItems.length > 0) {
                const firstFailedErrorCode = failedItems[0].hata_kodu; // İlk bulunan hata kodunu kullan
                finalStatus = validErrorCodes.includes(firstFailedErrorCode) ? firstFailedErrorCode : 'reddedildi'; // Eşleşmezse genel reddedildi
            } else {
                finalStatus = 'reddedildi'; // Genel uygun değil ama belirli bir hata kodu yok
            }
        }

        const { error: updateError } = await supabase
            .from('raporlar')
            .update({
                ai_analiz_sonucu: analysisResult,
                status: finalStatus
            })
            .eq('id', rapor_id);

        if (updateError) throw new Error(`Analiz sonucu güncellenirken hata: ${updateError.message}`);

        res.status(200).json({ success: true, message: 'Rapor başarıyla analiz edildi.' });

    } catch (error) {
        console.error(`Rapor analizi API hatası (Rapor ID: ${rapor_id}):`, error);
        await supabase.from('raporlar').update({ status: 'ai_analiz_hatasi' }).eq('id', rapor_id);
        return res.status(500).json({ message: 'Rapor analizi sırasında bir sunucu hatası oluştu.', error: error.message });
    }
}