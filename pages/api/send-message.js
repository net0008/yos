// pages/api/send-message.js
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { alici_id, icerik } = req.body; // alici_id opsiyonel olabilir (genel mesajlar için)

    if (!icerik) {
        return res.status(400).json({ message: 'Mesaj içeriği boş olamaz.' });
    }

    try {
        const { data, error } = await supabase
            .from('mesajlar')
            .insert({
                gonderen_id: req.user.id, // withAuth middleware'inden gelen kullanıcı ID'si
                alici_id: alici_id || null, // Eğer alici_id yoksa NULL olarak kaydet (genel mesaj)
                icerik: icerik,
            })
            .select();

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Mesaj başarıyla gönderildi.', data: data[0] });

    } catch (error) {
        console.error('Mesaj gönderme API hatası:', error);
        return res.status(500).json({ message: 'Mesaj gönderilirken bir sunucu hatası oluştu.', error: error.message });
    }
}

// Handler'ı withAuth middleware'i ile sarmala ve izin verilen rolleri belirt
export default withAuth(handler, ['admin', 'koordinator']);