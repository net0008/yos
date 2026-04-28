// pages/api/assign-district.js
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

    // --- Admin Rol Kontrolü (Örnek) ---
    // Gerçek bir uygulamada bu kontrol, bir middleware katmanında daha merkezi bir şekilde yapılmalıdır.
    // İstek başlığından (header) gelen Authorization token'ı alınır.
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user } } = await supabase.auth.getUser(token);

    if (!user) {
        return res.status(401).json({ message: 'Yetkisiz erişim. Lütfen giriş yapın.' });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.rol !== 'admin') {
        return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
    }
    // --- Rol Kontrolü Sonu ---

    const { ilceAdi, koordinatorId } = req.body;

    if (!ilceAdi || !koordinatorId) {
        return res.status(400).json({ message: 'İlçe adı ve koordinatör ID bilgileri zorunludur.' });
    }

    try {
        // 1. Adım: Belirtilen ilçedeki tüm okul sorumlularının ID'lerini al.
        const { data: sorumlular, error: sorumlularError } = await supabase
            .from('okul_sorumlulari')
            .select('id')
            .eq('ilce_adi', ilceAdi);

        if (sorumlularError) throw sorumlularError;

        if (!sorumlular || sorumlular.length === 0) {
            return res.status(404).json({ message: `"${ilceAdi}" ilçesinde atanacak okul sorumlusu bulunamadı.` });
        }

        // 2. Adım: 'upsert' işlemi için verileri hazırla.
        const assignments = sorumlular.map(sorumlu => ({
            koordinator_id: koordinatorId,
            sorumlu_id: sorumlu.id,
        }));

        // 3. Adım: 'koordinator_sorumluluklari' tablosuna toplu atama yap.
        // 'onConflict: sorumlu_id' sayesinde, eğer sorumlu zaten atanmışsa günceller, değilse yeni kayıt ekler.
        const { error: upsertError } = await supabase.from('koordinator_sorumluluklari').upsert(assignments, { onConflict: 'sorumlu_id' });

        if (upsertError) throw upsertError;

        return res.status(200).json({ success: true, message: `"${ilceAdi}" ilçesindeki ${sorumlular.length} sorumlu başarıyla atandı.` });

    } catch (error) {
        console.error('İlçe atama API hatası:', error);
        return res.status(500).json({ message: 'Görev ataması sırasında bir sunucu hatası oluştu.', error: error.message });
    }
}