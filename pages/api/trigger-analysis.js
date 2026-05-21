// pages/api/trigger-analysis.js
// Koordinatör veya Admin tarafından 'beklemede' rapor için manuel analiz başlatır.
// Strateji: Rapor statüsünü 'beklemede' yapar ve webhook'un devralmasını bekler.
// Webhook yoksa doğrudan analiz mantığını da çalıştırır.
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { withAuth } from '../../lib/withAuth';

// Gemini için yeterli süre
export const config = { maxDuration: 65 };

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

const validErrorCodes = [
    'IMZA_MUHUR_EKSİK', 'FORMAT_HATALI', 'ESKI_FORMAT',
    'GENEL_IFADE', 'BOS_BOLUM_ACIKLAMA_YOK',
    'UST_BILGI_EKSİK_HATALI', 'ONAY_TARIHI_EKSİK', 'RAPOR_OKUNMUYOR'
];

async function getSystemSettings(donem) {
    if (!donem) throw new Error('Analiz için dönem bilgisi alınamadı.');
    const normalize = (str) => (str || '').trim().toLocaleLowerCase('tr-TR');
    const { data: allSettings, error } = await supabaseAdmin
        .from('sistem_ayarlari')
        .select('donem, gorev_tanimlari, analiz_kriterleri');
    if (error) throw new Error('Sistem ayarları veritabanından çekilemedi.');
    const matched = (allSettings || []).find(s => normalize(s.donem) === normalize(donem));
    if (!matched) throw new Error(`'${donem}' dönemi için sistem ayarları bulunamadı. Lütfen Admin panelinden bu dönem için ayar ekleyin.`);
    return {
        gorevler: matched.gorev_tanimlari,
        kriterler: Array.isArray(matched.analiz_kriterleri) ? matched.analiz_kriterleri : [],
    };
}

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { reportId } = req.body;
    if (!reportId) return res.status(400).json({ message: 'reportId zorunludur.' });

    // Raporu veritabanından çek
    const { data: rapor, error: fetchError } = await supabaseAdmin
        .from('raporlar')
        .select('id, status, pdf_storage_path, donem, sorumlu_id')
        .eq('id', reportId)
        .single();

    if (fetchError || !rapor) return res.status(404).json({ message: 'Rapor bulunamadı.' });
    if (!rapor.pdf_storage_path) return res.status(400).json({ message: 'Bu raporun PDF dosyası bulunmuyor.' });

    const rapor_id = rapor.id;

    try {
        // 1. Durumu 'ai_incelendi' yap (webhook'u tekrar tetiklememek için beklemede'den geçmiyoruz)
        await supabaseAdmin
            .from('raporlar')
            .update({ status: 'ai_incelendi', ai_analiz_sonucu: null })
            .eq('id', rapor_id);

        // 2. PDF'i indir
        const { data: fileData, error: downloadError } = await supabaseAdmin.storage
            .from('raporlar')
            .download(rapor.pdf_storage_path);

        if (downloadError) throw new Error(`PDF indirilemedi: ${downloadError.message}`);

        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        const pdfBase64 = fileBuffer.toString('base64');
        const pdfPart = { inlineData: { data: pdfBase64, mimeType: 'application/pdf' } };

        // 3. Sistem ayarlarını çek
        const { gorevler, kriterler } = await getSystemSettings(rapor.donem);

        // 4. Gemini'a gönder
        const prompt = `
      SENARYO: Sen, YEĞİTEK Okul Sorumluları tarafından yüklenen aylık faaliyet raporlarını denetleyen uzman bir denetçisin.
      GÖREV: Sana yüklenen PDF dosyasını (hem metin hem de GÖRSEL olarak) analiz et ve bulgularını sadece ve sadece istenen JSON formatında döndür. Başka hiçbir açıklama ekleme.
      ÖNEMLİ: Bu bir MULTIMODAL analizdir. PDF'in içindeki metinlerin yanı sıra belgenin sonundaki/üzerindeki ISLAK İMZA ve KURUM MÜHRÜNÜ görsel olarak incelemelisin. Eğer belgede imza veya mühür yoksa, kontrol listesinde bunu belirt ve 'IMZA_MUHUR_EKSİK' hata kodunu döndür.
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
        "genel_durum": "Tüm kriterler uygun ise 'UYGUN', herhangi biri uygun değil ise 'UYGUN DEĞİL' yaz.",
        "kontrol_listesi": [{"kriter": "Değerlendirme kriterinin tam metni", "durum": "'UYGUN' veya 'UYGUN DEĞİL'", "aciklama": "Bu kararı neden verdiğini kısaca açıkla.", "hata_kodu": "Eğer durum 'UYGUN DEĞİL' ise, ilgili hata kodunu (örn: IMZA_MUHUR_EKSİK, FORMAT_HATALI, ESKI_FORMAT, GENEL_IFADE, BOS_BOLUM_ACIKLAMA_YOK, UST_BILGI_EKSİK_HATALI, ONAY_TARIHI_EKSİK, RAPOR_OKUNMUYOR) buraya ekle, yoksa null."}],
        "gorev_kapsami_analizi": {"kapsam_disi_faaliyetler": ["Görev tanımı dışında tespit ettiğin faaliyetleri buraya dizi olarak ekle."], "aciklama": "Kapsam dışı faaliyetler hakkında kısa bir yorum."},
        "siradisi_durumlar": ["Raporda belirtilen dikkat çekici, aksaklık veya özel durumları bu diziye ekle."]
      }
    `;

        const model = genAI.getGenerativeModel(
            { model: 'gemini-1.5-flash' },
            { apiVersion: 'v1' }
        );

        const result = await model.generateContent([prompt, pdfPart]);
        const responseText = result.response.text();

        let analysisResult;
        try {
            const jsonMatch = responseText.match(/\{[\s\S]*\}/);
            if (!jsonMatch) throw new Error('Yanıtta JSON bloğu bulunamadı.');
            analysisResult = JSON.parse(jsonMatch[0]);
        } catch {
            throw new Error('Yapay zeka yanıtı geçerli JSON formatında değil.');
        }

        // 5. Nihai durumu belirle
        let finalStatus = 'koordinator_onayinda';
        if (analysisResult.genel_durum === 'UYGUN') {
            finalStatus = 'onaylandi';
        } else if (analysisResult.genel_durum === 'UYGUN DEĞİL') {
            const failedItems = analysisResult.kontrol_listesi?.filter(
                item => item.durum === 'UYGUN DEĞİL' && item.hata_kodu
            );
            if (failedItems?.length > 0) {
                const code = failedItems[0].hata_kodu;
                finalStatus = validErrorCodes.includes(code) ? code : 'reddedildi';
            } else {
                finalStatus = 'reddedildi';
            }
        }

        // 6. Sonucu kaydet
        await supabaseAdmin
            .from('raporlar')
            .update({ ai_analiz_sonucu: analysisResult, status: finalStatus })
            .eq('id', rapor_id);

        return res.status(200).json({
            success: true,
            message: 'Analiz tamamlandı.',
            genel_durum: analysisResult.genel_durum,
            finalStatus,
        });

    } catch (error) {
        console.error(`[TRIGGER-ANALYSIS] Hata (Rapor ID: ${rapor_id}):`, error);
        await supabaseAdmin.from('raporlar').update({
            status: 'ai_analiz_hatasi',
            koordinator_notu: `[SİSTEM] Manuel analiz hatası: ${error.message}`,
        }).eq('id', rapor_id);

        return res.status(500).json({ message: `Analiz sırasında hata: ${error.message}` });
    }
}

export default withAuth(handler, ['admin', 'koordinator']);
