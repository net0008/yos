// pages/api/create-coordinator.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { email, password, adSoyad } = req.body;
    console.log(`[CREATE-COORDINATOR] API çağrıldı. E-posta: ${email}, Ad Soyad: ${adSoyad}`); // DIAGNOSTIC

    if (!email || !password || !adSoyad) {
        console.error('[CREATE-COORDINATOR] Hata: Eksik parametreler.'); // DIAGNOSTIC
        return res.status(400).json({ message: 'E-posta, şifre ve ad soyad zorunludur.' });
    }

    if (password.length < 6) {
        console.error('[CREATE-COORDINATOR] Hata: Şifre çok kısa.'); // DIAGNOSTIC
        return res.status(400).json({ message: 'Şifre en az 6 karakter olmalıdır.' });
    }

    try {
        console.log(`[CREATE-COORDINATOR] Adım 1: Auth kullanıcısı oluşturuluyor: ${email}`); // DIAGNOSTIC
        // 1. Supabase Auth'da kullanıcı oluşturmayı dene
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // E-posta doğrulaması olmadan aktif et
        });

        if (authError) {
            console.warn(`[CREATE-COORDINATOR] Auth kullanıcısı oluşturulurken hata alındı: ${authError.message}`); // DIAGNOSTIC
            // Eğer hata, kullanıcının zaten kayıtlı olduğunu belirtiyorsa, bu "yetim" bir auth kaydı olabilir.
            // Durumu düzeltmeye çalışalım.
            if (authError.message.includes('already registered')) {

                // --- YETİM KULLANCI KURTARMA BLOKU ---
                console.log(`[CREATE-COORDINATOR] Adım 2: "Zaten kayıtlı" hatası. Yetim kullanıcı kurtarma bloğu başlatıldı.`); // DIAGNOSTIC

                // Supabase Admin SDK'sında getUserByEmail olmadığı için, listUsers'ı paginasyon ile kullanmalıyız.
                // Bu yavaş olabilir, ancak sadece hata durumunda çalışacağı için kabul edilebilir.
                let existingUser = null;
                let page = 1;
                const perPage = 100; // Tek seferde 100 kullanıcı çek

                while (true) {
                    console.log(`[CREATE-COORDINATOR] Adım 2a: Auth kullanıcı listesi çekiliyor, Sayfa: ${page}`); // DIAGNOSTIC
                    const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });

                    if (listError) {
                        console.error(`[CREATE-COORDINATOR] KRİTİK HATA: Kurtarma işlemi sırasında kullanıcı listesi alınamadı.`, listError); // DIAGNOSTIC
                        // Kullanıcı listesini alamazsak, daha fazla ilerleyemeyiz.
                        return res.status(500).json({ message: `Kurtarma işlemi başarısız: Kullanıcı listesi alınamadı. Hata: ${listError.message}` });
                    }

                    // E-posta karşılaştırmasını küçük harfe çevirerek yap (case-insensitive)
                    const found = users.find(u => u.email.toLowerCase() === email.toLowerCase());
                    if (found) {
                        existingUser = found;
                        console.log(`[CREATE-COORDINATOR] Adım 2b: Eşleşen kullanıcı bulundu. ID: ${existingUser.id}, Email: ${existingUser.email}`); // DIAGNOSTIC
                        break; // Kullanıcıyı bulduk, döngüden çık.
                    }

                    if (users.length < perPage) {
                        console.log(`[CREATE-COORDINATOR] Adım 2b: Kullanıcı listesinin sonuna gelindi, eşleşme bulunamadı.`); // DIAGNOSTIC
                        // Bu son sayfaydı ve kullanıcı bulunamadı.
                        break;
                    }

                    page++; // Sonraki sayfaya geç.
                }

                if (!existingUser) {
                    console.error(`[CREATE-COORDINATOR] KRİTİK TUTARSIZLIK: Auth "zaten kayıtlı" hatası verdi ama kullanıcı '${email}' listede bulunamadı.`); // DIAGNOSTIC
                    // Bu durum teorik olarak imkansız. Eğer "already registered" hatası varsa, kullanıcı listede olmalı.
                    return res.status(500).json({ message: 'Veritabanında tutarsızlık tespit edildi. Auth kullanıcısı var diyor ama listede bulunamadı.' });
                }

                // Yetim kullanıcıyı bulduk (existingUser). Şimdi profilinin olup olmadığını kontrol edelim.
                console.log(`[CREATE-COORDINATOR] Adım 3: Bulunan kullanıcının (ID: ${existingUser.id}) profili kontrol ediliyor.`); // DIAGNOSTIC
                const { data: profile, error: profileCheckError } = await supabaseAdmin
                    .from('profiles')
                    .select('id')
                    .eq('id', existingUser.id)
                    .single();

                // Eğer profili zaten varsa, bu durumda gerçekten "kullanıcı mevcut" hatasıdır ve bir sorun yoktur.
                if (profile) {
                    console.warn(`[CREATE-COORDINATOR] Adım 3a: Kullanıcının profili zaten mevcut. İşlem durduruldu.`); // DIAGNOSTIC
                    return res.status(409).json({ message: 'Bu e-posta adresi zaten tam olarak kayıtlı bir koordinatöre ait.' });
                }

                // Profil yoksa (beklenen PostgREST hatası 'PGRST116: No rows found'), oluşturalım.
                if (!profile && profileCheckError?.code === 'PGRST116') {
                    console.log(`[CREATE-COORDINATOR] Adım 3b: Profil bulunamadı (Beklenen durum). '${email}' (ID: ${existingUser.id}) için eksik profil oluşturuluyor...`); // DIAGNOSTIC

                    const { error: profileInsertError } = await supabaseAdmin
                        .from('profiles')
                        .insert({ id: existingUser.id, ad_soyad: adSoyad, rol: 'koordinator', email: existingUser.email });

                    if (profileInsertError) {
                        console.error(`[CREATE-COORDINATOR] KRİTİK HATA: Yetim kullanıcı için profil oluşturulamadı.`, profileInsertError); // DIAGNOSTIC
                        throw new Error(`Yetim kullanıcı için profil oluşturulamadı: ${profileInsertError.message}`);
                    }
                    console.log(`[CREATE-COORDINATOR] Adım 3c: Eksik profil başarıyla oluşturuldu.`); // DIAGNOSTIC

                    // Kullanıcının şifresini de güncelleyelim, çünkü kullanıcı yeni bir şifre girmiş olabilir.
                    console.log(`[CREATE-COORDINATOR] Adım 3d: Kullanıcının şifresi güncelleniyor.`); // DIAGNOSTIC
                    await supabaseAdmin.auth.admin.updateUserById(existingUser.id, { password });

                    console.log(`[CREATE-COORDINATOR] BAŞARILI: Kurtarma işlemi tamamlandı.`); // DIAGNOSTIC
                    return res.status(200).json({
                        success: true,
                        message: `Daha önce takılı kalmış olan "${adSoyad}" kullanıcısı için eksik profil tamamlandı ve kayıt işlemi başarıyla sonuçlandı.`,
                        koordinator: { id: existingUser.id, ad_soyad: adSoyad, email },
                    });
                }

                if (profileCheckError) {
                    console.error(`[CREATE-COORDINATOR] KRİTİK HATA: Profil kontrolü sırasında beklenmedik bir hata oluştu.`, profileCheckError); // DIAGNOSTIC
                    throw new Error(`Profil kontrolü sırasında hata: ${profileCheckError.message}`);
                }
                // --- YETİM KULLANCI KURTARMA BLOKU SONU ---
            }

            // "already registered" dışındaki diğer tüm auth hatalarını doğrudan fırlat.
            console.error(`[CREATE-COORDINATOR] KRİTİK HATA: Auth'da beklenmedik hata.`, authError); // DIAGNOSTIC
            throw authError;
        }

        // 2. Auth kullanıcısı başarıyla oluşturulduysa, `profiles` tablosuna kaydı ekle
        console.log(`[CREATE-COORDINATOR] Adım 1a: Auth kullanıcısı başarıyla oluşturuldu (ID: ${authData.user.id}). Profil kaydı oluşturuluyor.`); // DIAGNOSTIC
        const { data: profileData, error: profileError } = await supabaseAdmin
            .from('profiles')
            .insert({ id: authData.user.id, ad_soyad: adSoyad, rol: 'koordinator', email: authData.user.email })
            .select()
            .single();

        if (profileError) {
            // Profil oluşturma başarısız olursa, oluşturulan auth kullanıcısını geri al (rollback). Bu, yetim kayıtları önler.
            console.error(`[CREATE-COORDINATOR] KRİTİK HATA: Profil oluşturma başarısız olduğu için Auth kullanıcısı (ID: ${authData.user.id}) siliniyor.`, profileError); // DIAGNOSTIC
            await supabaseAdmin.auth.admin.deleteUser(authData.user.id);
            throw new Error(`Profil oluşturulamadı: ${profileError.message}`);
        }

        console.log(`[CREATE-COORDINATOR] BAŞARILI: Yeni koordinatör ve profili başarıyla oluşturuldu.`); // DIAGNOSTIC
        return res.status(200).json({
            success: true,
            message: `"${adSoyad}" koordinatörü başarıyla oluşturuldu.`,
            koordinator: { id: profileData.id, ad_soyad: profileData.ad_soyad, email: authData.user.email }
        });

    } catch (error) {
        console.error('[CREATE-COORDINATOR] API genel hata yakalama bloğuna düştü:', error); // DIAGNOSTIC
        return res.status(500).json({
            message: `Koordinatör oluşturulurken bir hata oluştu: ${error.message}`,
        });
    }
}

export default withAuth(handler, ['admin']);