// pages/api/delete-report.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'DELETE') {
        return res.status(405).json({ message: 'Sadece DELETE istekleri kabul edilir.' });
    }

    const { reportId } = req.body;
    if (!reportId) {
        return res.status(400).json({ message: 'reportId zorunludur.' });
    }

    try {
        // İlgili raporu bul ve PDF yolunu al
        const { data: report, error: fetchError } = await supabaseAdmin
            .from('raporlar')
            .select('pdf_storage_path')
            .eq('id', reportId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            throw new Error(`Rapor getirilirken hata: ${fetchError.message}`);
        }

        // Eğer rapor bulunduysa ve PDF'i varsa, storage'dan sil
        if (report && report.pdf_storage_path) {
            const { error: storageError } = await supabaseAdmin.storage
                .from('raporlar')
                .remove([report.pdf_storage_path]);
            
            if (storageError) {
                console.error('PDF silinirken hata:', storageError.message);
                // PDF silinemese bile devam et, veritabanı kaydını silelim.
            }
        }

        // Veritabanından raporu sil
        const { error: deleteError } = await supabaseAdmin
            .from('raporlar')
            .delete()
            .eq('id', reportId);

        if (deleteError) {
            throw new Error(`Rapor veritabanından silinirken hata: ${deleteError.message}`);
        }

        return res.status(200).json({ success: true, message: 'Rapor başarıyla silindi.' });

    } catch (error) {
        console.error('[DELETE-REPORT] Hata:', error);
        return res.status(500).json({ message: error.message });
    }
}

export default withAuth(handler, ['admin', 'koordinator']);
