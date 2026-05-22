// pages/api/get-sorumlu-reports.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { sorumluId } = req.body;

    if (!sorumluId) {
        return res.status(400).json({ message: 'sorumluId zorunludur.' });
    }

    try {
        // İlgili okul sorumlusunun yüklediği raporları getir
        const { data: reports, error } = await supabaseAdmin
            .from('raporlar')
            .select('id, donem, ay, status, ai_analiz_sonucu, koordinator_notu, created_at')
            .eq('sorumlu_id', sorumluId)
            .order('created_at', { ascending: false });

        if (error) {
            console.error('[GET-SORUMLU-REPORTS] Supabase Hatası:', error);
            return res.status(500).json({ success: false, message: 'Raporlar getirilirken bir hata oluştu.' });
        }

        return res.status(200).json({ success: true, reports });

    } catch (error) {
        console.error('[GET-SORUMLU-REPORTS] API Hatası:', error);
        return res.status(500).json({ success: false, message: 'Beklenmedik bir hata oluştu.' });
    }
}
