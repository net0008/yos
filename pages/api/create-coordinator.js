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
        // 1. Supabase Auth'da kullanıcı oluşturmayı dene
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // E-posta doğrulaması olmadan aktif et
        });

        if (authError) {
            // Eğer hata, kullanıcının zaten kayıtlı olduğunu belirtiyorsa...
            if (authError.message.includes('already registered')) {
                // ...bu, "yetim" bir auth kaydı olabilir. Durumu düzeltmeye çalışalım.
                // Not: `listUsers` tüm kullanıcıları getirdiği için yavaş olabilir,
                // ama bu sadece bir hata kurtarma senaryosunda çalışır.
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) {
                    return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı, ancak kurtarma işlemi sırasında kullanıcı listesi alınamadı.' });
                }

                const existingUser = users.find(u => u.email === email);

                if (!existingUser) {
                    return res.status(500).json({ message: 'Veritabanında tutarsızlık tespit edildi. Auth kullanıcısı var diyor ama listede bulunamadı.' });
                }

                // Yetim kullanıcıyı bulduk. Profilinin olup olmadığını kontrol edelim.
                const { data: profile, error: profileCheckError } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('id', existingUser.id)
                    .single();

                // Eğer profili zaten varsa, bu durumda gerçekten "kullanıcı mevcut" hatasıdır.
                if (profile) {
                    return res.status(409).json({ message: 'Bu e-posta adresi zaten kayıtlı bir koordinatöre ait.' });
                }

                // Profil yoksa (beklenen hata kodu PGRST116), oluşturalım.
                if (!profile && profileCheckError?.code === 'PGRST116') {
                    const { error: profileInsertError } = await supabaseAdmin
                        .from('profiles')
                        .insert({ id: existingUser.id, ad_soyad: adSoyad, rol: 'koordinator' });

                    if (profileInsertError) throw profileInsertError;

                    // Kullanıcının şifresini de güncelleyelim.
                    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });

                    return res.status(200).json({
                        success: true,
                        message: `Mevcut kullanıcı "${adSoyad}" için eksik olan profil oluşturuldu.`,
                        koordinator: { id: existingUser.id, ad_soyad: adSoyad, email },
                    });
                }

                if (profileCheckError) throw profileCheckError;
            }
            // "already registered" dışındaki diğer tüm auth hatalarını fırlat.
            throw authError;
        }

        // 2. Auth kullanıcısı başarıyla oluşturulduysa, profiles tablosuna kaydı ekle
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({ id: authData.user.id, ad_soyad: adSoyad, rol: 'koordinator' });

        if (profileError) {
            // Profil oluşturma başarısız olursa, oluşturulan auth kullanıcısını geri al (rollback).
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw profileError;
        }

        return res.status(200).json({
            success: true,
            message: `"${adSoyad}" koordinatörü başarıyla oluşturuldu.`,
            koordinator: { id: authData.user.id, ad_soyad: adSoyad, email }
        });

    } catch (error) {
        console.error('Koordinatör oluşturma hatası:', error);
        return res.status(500).json({
            message: `Koordinatör oluşturulurken hata: ${error.message}`,
        });
    }
}

export default withAuth(handler, ['admin']);