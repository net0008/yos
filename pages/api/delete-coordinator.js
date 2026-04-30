// pages/api/delete-coordinator.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { koordinatorId } = req.body;
    if (!koordinatorId) {
        return res.status(400).json({ message: 'Koordinatör ID zorunludur.' });
    }

    try {
        // Auth'dan sil (profiles cascade ile silinir)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(koordinatorId);
        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Koordinatör başarıyla silindi.' });
    } catch (error) {
        console.error('Koordinatör silme hatası:', error);
        return res.status(500).json({ message: `Silme hatası: ${error.message}` });
    }
}

export default withAuth(handler, ['admin']);