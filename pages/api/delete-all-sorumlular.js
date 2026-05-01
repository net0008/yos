// pages/api/delete-all-sorumlular.js
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') { // Use POST for destructive actions
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    try {
        // This is a very destructive operation. It deletes all records from the table.
        const { error } = await supabase
            .from('okul_sorumlulari')
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // A trick to delete all rows without a specific filter

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Tüm okul sorumluları listesi başarıyla silindi.' });
    } catch (error) {
        console.error('Tüm okul sorumlularını silme hatası:', error);
        return res.status(500).json({ message: 'Liste silinirken bir sunucu hatası oluştu.', error: error.message });
    }
}

export default withAuth(handler, ['admin']);