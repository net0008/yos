// pages/api/get-my-role.js
// Giriş yapmış kullanıcının kendi rolünü döndürür.
// supabaseAdmin (service_role) kullandığı için RLS'yi atlar — hiçbir politika sorunu olmaz.
import { supabaseAdmin } from '../../lib/supabaseAdmin';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ message: 'Sadece GET istekleri kabul edilir.' });
    }

    const token = req.headers.authorization?.replace('Bearer ', '').trim();
    if (!token) {
        return res.status(401).json({ message: 'Token bulunamadı.' });
    }

    // Token ile kullanıcıyı doğrula
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) {
        return res.status(401).json({ message: 'Geçersiz veya süresi dolmuş token.' });
    }

    // Profili service_role ile çek (RLS bypass)
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('ad_soyad, rol')
        .eq('id', user.id)
        .single();

    if (profileError || !profile) {
        return res.status(404).json({
            message: 'Kullanıcı profili bulunamadı. Lütfen sistem yöneticisiyle iletişime geçin.',
        });
    }

    return res.status(200).json({
        ad_soyad: profile.ad_soyad,
        rol: profile.rol,
    });
}
