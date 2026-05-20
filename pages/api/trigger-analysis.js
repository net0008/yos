// pages/api/trigger-analysis.js
// Koordinatör veya Admin tarafından 'beklemede' rapor için manuel analiz başlatır.
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { reportId } = req.body;
    if (!reportId) {
        return res.status(400).json({ message: 'reportId zorunludur.' });
    }

    // Raporu veritabanından çek
    const { data: rapor, error: fetchError } = await supabaseAdmin
        .from('raporlar')
        .select('id, status, pdf_storage_path, donem, sorumlu_id')
        .eq('id', reportId)
        .single();

    if (fetchError || !rapor) {
        return res.status(404).json({ message: 'Rapor bulunamadı.' });
    }

    if (!rapor.pdf_storage_path) {
        return res.status(400).json({ message: 'Bu raporun PDF dosyası bulunmuyor. Analiz yapılamaz.' });
    }

    // Analiz edilmesi uygun olmayan durumları engelle
    const analizedStatuses = ['ai_incelendi', 'onaylandi'];
    if (analizedStatuses.includes(rapor.status)) {
        return res.status(400).json({ message: `Rapor zaten '${rapor.status}' durumunda. Tekrar analiz edilmeyecek.` });
    }

    // Durumu 'beklemede' olarak sıfırla ki analyze-report.js işleyebilsin
    await supabaseAdmin
        .from('raporlar')
        .update({ status: 'beklemede', ai_analiz_sonucu: null })
        .eq('id', reportId);

    // analyze-report endpoint'ini bu sunucu üzerinden çağır
    const analyzeUrl = process.env.VERCEL_URL
        ? `https://${process.env.VERCEL_URL}/api/analyze-report`
        : 'http://localhost:3000/api/analyze-report';

    // Fire-and-forget: analizi arka planda başlat, kullanıcıyı bekleme
    fetch(analyzeUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            record: {
                id: rapor.id,
                pdf_storage_path: rapor.pdf_storage_path,
                status: 'beklemede',
                donem: rapor.donem,
            },
        }),
    }).catch(err => console.error('[TRIGGER-ANALYSIS] Analiz tetiklenirken hata:', err));

    return res.status(200).json({
        success: true,
        message: 'Analiz başlatıldı. Sonuç 30-60 saniye içinde güncellenir, sayfayı yenileyin.',
    });
}

// Hem admin hem koordinatör tetikleyebilir
export default withAuth(handler, ['admin', 'koordinator']);
