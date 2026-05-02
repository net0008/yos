// pages/api/assign-district.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    res.setHeader('Content-Type', 'application/json');

    try {
        if (req.method !== 'POST') {
            return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !serviceKey) {
            return res.status(500).json({ message: 'Sunucu env vars eksik.' });
        }

        const supabase = createClient(supabaseUrl, serviceKey, {
            auth: { persistSession: false },
        });

        // Token al ve doğrula
        const authHeader = req.headers.authorization || '';
        const token = authHeader.replace('Bearer ', '').trim();

        if (!token) {
            return res.status(401).json({ message: 'Token bulunamadı.' });
        }

        const { data: userData, error: userError } = await supabase.auth.getUser(token);
        if (userError || !userData?.user) {
            return res.status(401).json({ message: 'Geçersiz token.' });
        }

        // Rol kontrolü
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', userData.user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ message: 'Profil bulunamadı.' });
        }

        if (profile.rol !== 'admin') {
            return res.status(403).json({ message: 'Admin yetkisi gerekli.' });
        }

        // Body
        const ilceAdi      = String(req.body?.ilceAdi      || '').trim();
        const koordinatorId = String(req.body?.koordinatorId || '').trim();

        if (!ilceAdi || !koordinatorId) {
            return res.status(400).json({ message: 'ilceAdi ve koordinatorId zorunludur.' });
        }

        // İlçedeki sorumlular — ilike ile büyük/küçük harf farkını yok say
        const { data: sorumlular, error: sorumluError } = await supabase
            .from('okul_sorumlulari')
            .select('id')
            .ilike('ilce_adi', ilceAdi);

        if (sorumluError) {
            return res.status(500).json({
                message: `Sorumlular sorgulanırken hata: ${sorumluError.message}`,
            });
        }

        if (!sorumlular || sorumlular.length === 0) {
            return res.status(200).json({
                success: true,
                message: `"${ilceAdi}" ilçesinde henüz kayıtlı sorumlu yok. Sorumlu listesi yüklendiğinde atama otomatik eşleşecek.`,
                atanan: 0,
            });
        }

        // Upsert
        const assignments = sorumlular.map((s) => ({
            koordinator_id: koordinatorId,
            sorumlu_id:     s.id,
        }));

        const { error: upsertError } = await supabase
            .from('koordinator_sorumluluklari')
            .upsert(assignments, { onConflict: 'sorumlu_id' });

        if (upsertError) {
            return res.status(500).json({
                message: `Atama kaydedilirken hata: ${upsertError.message}`,
            });
        }

        return res.status(200).json({
            success: true,
            message: `"${ilceAdi}" ilçesindeki ${sorumlular.length} sorumlu başarıyla atandı.`,
            atanan: sorumlular.length,
        });

    } catch (err) {
        console.error('assign-district beklenmedik hata:', err);
        return res.status(500).json({
            message: `Beklenmedik hata: ${err?.message || String(err)}`,
        });
    }
}