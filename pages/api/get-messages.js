// pages/api/get-messages.js
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Sadece GET istekleri kabul edilir.' });
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

    const { alici_id } = req.query; // Opsiyonel: belirli bir alıcıya gönderilen mesajları filtrelemek için

    try {
        let query = supabase
            .from('mesajlar')
            .select(`
                id,
                icerik,
                gonderilme_tarihi,
                okundu,
                gonderen:gonderen_id(id, ad_soyad, rol),
                alici:alici_id(id, ad_soyad, rol)
            `)
            .order('gonderilme_tarihi', { ascending: true });

        if (alici_id) {
            // Belirli bir kişiyle olan özel mesajları çek
            const myId = senderProfile.id;
            query = query.or(
                `and(gonderen_id.eq.${myId},alici_id.eq.${alici_id}),and(gonderen_id.eq.${alici_id},alici_id.eq.${myId})`
            );
        } else {
            // Genel sohbeti çek (alıcısı olmayan mesajlar)
            query = query.is('alici_id', null);
        }

        const { data: messages, error } = await query;

        if (error) throw error;

        return res.status(200).json({ success: true, messages });

    } catch (error) {
        console.error('Mesaj çekme API hatası:', error);
        return res.status(500).json({ message: 'Mesajlar çekilirken bir sunucu hatası oluştu.', error: error.message });
    }
}