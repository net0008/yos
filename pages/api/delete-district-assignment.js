import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

// Türkçe karakterleri doğru küçültmek için yardımcı fonksiyon
const normalize = (str) => (str || '').trim().toLocaleLowerCase('tr-TR');

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    try {
        const { ilceAdi } = req.body;
        if (!ilceAdi) {
            return res.status(400).json({ message: 'İlçe adı zorunludur.' });
        }

        const { data: allSorumlular, error: sErr } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('id, ilce_adi');

        if (sErr) throw sErr;

        const targetIlceNormal = normalize(ilceAdi);
        const ids = (allSorumlular || [])
            .filter(s => normalize(s.ilce_adi) === targetIlceNormal)
            .map((s) => s.id);

        if (ids.length > 0) {
            const { error: dErr } = await supabaseAdmin
                .from('koordinator_sorumluluklari')
                .delete()
                .in('sorumlu_id', ids);
            if (dErr) throw dErr;
        }

        return res.status(200).json({ message: `${ilceAdi} ilçesi için tüm koordinatör atamaları başarıyla silindi.` });
    } catch (error) {
        console.error('İlçe ataması silme hatası:', error);
        return res.status(500).json({ message: error.message || 'Sunucu hatası.' });
    }
}

export default withAuth(handler, ['admin']);