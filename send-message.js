// pages/api/send-message.js
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    // --- Yetkilendirme Kontrolü ---
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return res.status(401).json({ message: 'Yetkisiz erişim. Lütfen giriş yapın.' });
    }

    // Gönderen kullanıcının profilini al (rolünü kontrol etmek için)
    const { data: senderProfile, error: profileError } = await supabase
        .from('profiles')
        .select('id, rol')
        .eq('id', user.id)
        .single();

    if (profileError || !senderProfile || (senderProfile.rol !== 'admin' && senderProfile.rol !== 'koordinator')) {
        return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
    }
    // --- Yetkilendirme Kontrolü Sonu ---

    const { alici_id, icerik } = req.body; // alici_id opsiyonel olabilir (genel mesajlar için)

    if (!icerik) {
        return res.status(400).json({ message: 'Mesaj içeriği boş olamaz.' });
    }

    try {
        const { data, error } = await supabase
            .from('mesajlar')
            .insert({
                gonderen_id: senderProfile.id,
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