// pages/api/get-settings.js
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Sadece GET istekleri kabul edilir.' });
    }

    // --- Admin Yetkilendirme Kontrolü ---
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

    if (userError || !user) {
        return res.status(401).json({ message: 'Yetkisiz erişim.' });
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.rol !== 'admin') {
        return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
    }
    // --- Yetkilendirme Kontrolü Sonu ---

    const { donem } = req.query;

    if (!donem) {
        return res.status(400).json({ message: 'Dönem bilgisi gereklidir.' });
    }

    try {
        const { data, error } = await supabaseAdmin
            .from('sistem_ayarlari')
            .select('gorev_tanimlari, analiz_kriterleri')
            .eq('donem', donem)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116: No rows found, bu bir hata değil.
            throw error;
        }

        return res.status(200).json({ success: true, settings: data });

    } catch (error) {
        console.error('Sistem ayarları çekme API hatası:', error);
        return res.status(500).json({ message: 'Ayarlar çekilirken bir sunucu hatası oluştu.', error: error.message });
    }
}