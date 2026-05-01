// pages/api/get-sorumlular.js
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Sadece GET istekleri kabul edilir.' });
    }

    try {
        const { data, error } = await supabase
            .from('okul_sorumlulari')
            .select('*')
            .order('ilce_adi', { ascending: true })
            .order('okul_adi', { ascending: true });

        if (error) throw error;

        return res.status(200).json({ success: true, sorumlular: data });
    } catch (error) {
        console.error('Okul sorumluları çekme hatası:', error);
        return res.status(500).json({ message: 'Sorumlular listesi çekilirken bir hata oluştu.', error: error.message });
    }
}

export default withAuth(handler, ['admin']);