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
            // Eğer hata, kullanıcının zaten kayıtlı olduğunu belirtiyorsa, bu "yetim" bir auth kaydı olabilir.
            // Durumu düzeltmeye çalışalım.
            if (authError.message.includes('already registered')) {

                // --- YETİM KULLANCI KURTARMA BLOKU ---
                console.log(`'${email}' için "zaten kayıtlı" hatası alındı. Kurtarma işlemi deneniyor...`);

                // Supabase Admin SDK'sında getUserByEmail olmadığı için, listUsers'ı paginasyon ile kullanmalıyız.
                // Bu yavaş olabilir, ancak sadece hata durumunda çalışacağı için kabul edilebilir.
                let existingUser = null;
                let page = 1;
                const perPage = 100; // Tek seferde 100 kullanıcı çek

                while (true) {
                    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

                    if (listError) {
                        // Kullanıcı listesini alamazsak, daha fazla ilerleyemeyiz.
                        return res.status(500).json({ message: `Kurtarma işlemi başarısız: Kullanıcı listesi alınamadı. Hata: ${listError.message}` });
                    }

                    const found = users.find(u => u.email === email);
                    if (found) {
                        existingUser = found;
                        break; // Kullanıcıyı bulduk, döngüden çık.
                    }

                    if (users.length < perPage) {
                        // Bu son sayfaydı ve kullanıcı bulunamadı.
                        break;
                    }

                    page++; // Sonraki sayfaya geç.
                }

                if (!existingUser) {
                    // Bu durum teorik olarak imkansız. Eğer "already registered" hatası varsa, kullanıcı listede olmalı.
                    return res.status(500).json({ message: 'Veritabanında tutarsızlık tespit edildi. Auth kullanıcısı var diyor ama listede bulunamadı.' });
                }

                // Yetim kullanıcıyı bulduk (existingUser). Şimdi profilinin olup olmadığını kontrol edelim.
                const { data: profile, error: profileCheckError } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('id', existingUser.id)
                    .single();

                // Eğer profili zaten varsa, bu durumda gerçekten "kullanıcı mevcut" hatasıdır ve bir sorun yoktur.
                if (profile) {
                    return res.status(409).json({ message: 'Bu e-posta adresi zaten tam olarak kayıtlı bir koordinatöre ait.' });
                }

                // Profil yoksa (beklenen PostgREST hatası 'PGRST116: No rows found'), oluşturalım.
                if (!profile && profileCheckError?.code === 'PGRST116') {
                    console.log(`'${email}' (ID: ${existingUser.id}) için eksik profil tespit edildi. Profil oluşturuluyor...`);

                    const { error: profileInsertError } = await supabaseAdmin
                        .from('profiles')
                        .insert({ id: existingUser.id, ad_soyad: adSoyad, rol: 'koordinator' });

                    if (profileInsertError) {
                        throw new Error(`Yetim kullanıcı için profil oluşturulamadı: ${profileInsertError.message}`);
                    }

                    // Kullanıcının şifresini de güncelleyelim, çünkü kullanıcı yeni bir şifre girmiş olabilir.
                    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });

                    return res.status(200).json({
                        success: true,
                        message: `Daha önce takılı kalmış olan "${adSoyad}" kullanıcısı için eksik profil tamamlandı ve kayıt işlemi başarıyla sonuçlandı.`,
                        koordinator: { id: existingUser.id, ad_soyad: adSoyad, email },
                    });
                }

                if (profileCheckError) {
                    throw new Error(`Profil kontrolü sırasında hata: ${profileCheckError.message}`);
                }
                // --- YETİM KULLANCI KURTARMA BLOKU SONU ---
            }

            // "already registered" dışındaki diğer tüm auth hatalarını doğrudan fırlat.
            throw authError;
        }

        // 2. Auth kullanıcısı başarıyla oluşturulduysa, `profiles` tablosuna kaydı ekle
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({ id: authData.user.id, ad_soyad: adSoyad, rol: 'koordinator' })
            .select()
            .single();

        if (profileError) {
            // Profil oluşturma başarısız olursa, oluşturulan auth kullanıcısını geri al (rollback). Bu, yetim kayıtları önler.
            console.error(`Profil oluşturma başarısız olduğu için Auth kullanıcısı (ID: ${authData.user.id}) siliniyor.`);
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Profil oluşturulamadı: ${profileError.message}`);
        }

        return res.status(200).json({
            success: true,
            message: `"${adSoyad}" koordinatörü başarıyla oluşturuldu.`,
            koordinator: { id: profileData.id, ad_soyad: profileData.ad_soyad, email: authData.user.email }
        });

    } catch (error) {
        console.error('Koordinatör oluşturma API genel hatası:', error);
        return res.status(500).json({
            message: `Koordinatör oluşturulurken bir hata oluştu: ${error.message}`,
        });
    }
}

export default withAuth(handler, ['admin']);