// pages/api/analyze-report.js
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdf from 'pdf-parse';

// Supabase istemcisini başlatın
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Gemini AI istemcisini başlatın (Ortam değişkenlerinde GEMINI_API_KEY tanımlı olmalıdır)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

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
        "kontrol_listesi": [{"kriter": "Değerlendirme kriterinin tam metni", "durum": "'BAŞARILI' veya 'BAŞARISIZ'", "aciklama": "Bu kararı neden verdiğini kısaca açıkla."}],
        "gorev_kapsami_analizi": {"kapsam_disi_faaliyetler": ["Görev tanımı dışında tespit ettiğin faaliyetleri buraya dizi olarak ekle."], "aciklama": "Kapsam dışı faaliyetler hakkında kısa bir yorum."},
        "siradisi_durumlar": ["Raporda belirtilen 'etkileşimli tahta hurdaya çıktı' gibi dikkat çekici, aksaklık veya özel durumları bu diziye ekle."]
      }
      ANALİZ EDİLECEK RAPOR METNİ:
      ---
      ${pdfText}
      ---
    `;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();

        responseText = responseText.replace('```json', '').replace('```', '').trim();
        const analysisResult = JSON.parse(responseText);

        let finalStatus = 'koordinator_onayinda';
        if (analysisResult.genel_durum === 'UYGUN DEĞİL') {
            const imzaEksik = analysisResult.kontrol_listesi.find(item => item.kriter.includes('İmza') && item.durum === 'BAŞARISIZ');
            const formatHatali = analysisResult.kontrol_listesi.find(item => item.kriter.includes('format') && item.durum === 'BAŞARISIZ');
            if (imzaEksik) finalStatus = 'IMZA_MUHUR_EKSİK';
            else if (formatHatali) finalStatus = 'FORMAT_HATALI';
            else finalStatus = 'reddedildi'; // Genel bir 'uygun değil' durumu
        } else if (analysisResult.genel_durum === 'UYGUN') {
            finalStatus = 'onaylandi'; // Otomatik onay veya koordinatör onayı için 'koordinator_onayinda'
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