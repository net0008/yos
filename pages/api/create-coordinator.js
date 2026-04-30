// pages/api/create-coordinator.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { email, password, adSoyad } = req.body;

    if (!email || !password || !adSoyad) {
        return res.status(400).json({ message: 'E-posta, şifre ve ad soyad zorunludur.' });
    }

    if (password.length < 6) {
        return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır.' });
    }

    try {
        // 1. Supabase Auth'da kullanıcı oluştur
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // E-posta doğrulaması olmadan aktif et
        });

        if (authError) {
            if (authError.message.includes('already registered')) {
                return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı.' });
            }
            throw authError;
        }

        // 2. profiles tablosuna koordinatör kaydı ekle
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({
                id: authData.user.id,
                ad_soyad: adSoyad,
                rol: 'koordinator',
            });

        if (profileError) {
            // Auth kaydını geri al
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw profileError;
        }

        return res.status(200).json({
            success: true,
            message: `"${adSoyad}" koordinatörü başarıyla oluşturuldu.`,
            koordinator: { id: authData.user.id, ad_soyad: adSoyad, email },
        });

    } catch (error) {
        console.error('Koordinatör oluşturma hatası:', error);
        return res.status(500).json({
            message: `Koordinatör oluşturulurken hata: ${error.message}`,
        });
    }
}

export default withAuth(handler, ['admin']);