// pages/api/assign-district.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
    // Her zaman JSON dön — HTML hiçbir zaman dönmesin
    res.setHeader('Content-Type', 'application/json');

    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    // ── Supabase Admin client ────────────────────────────────────────────────
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        console.error('assign-district: Supabase env vars eksik');
        return res.status(500).json({ message: 'Sunucu yapılandırma hatası.' });
    }

    const supabase = createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false },
    });

    // ── Token doğrulama ──────────────────────────────────────────────────────
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

    if (!token) {
        return res.status(401).json({ message: 'Yetkilendirme token\'ı bulunamadı.' });
    }

    let user;
    try {
        const { data, error } = await supabase.auth.getUser(token);
        if (error || !data?.user) {
            return res.status(401).json({ message: 'Geçersiz token.' });
        }
        user = data.user;
    } catch (e) {
        console.error('assign-district auth hatası:', e);
        return res.status(401).json({ message: 'Token doğrulanamadı.' });
    }

    // ── Rol kontrolü ────────────────────────────────────────────────────────
    try {
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', user.id)
            .single();

        if (profileError || !profile) {
            return res.status(403).json({ message: 'Profil bulunamadı.' });
        }
        if (profile.rol !== 'admin') {
            return res.status(403).json({ message: 'Bu işlem için admin yetkisi gerekli.' });
        }
    } catch (e) {
        console.error('assign-district profil hatası:', e);
        return res.status(500).json({ message: 'Profil sorgulanırken hata oluştu.' });
    }

    // ── İstek gövdesi ────────────────────────────────────────────────────────
    const { ilceAdi, koordinatorId } = req.body;

    if (!ilceAdi || !koordinatorId) {
        return res.status(400).json({ message: 'ilceAdi ve koordinatorId zorunludur.' });
    }

    const ilceTrimmed = String(ilceAdi).trim();

    // ── Sorumlular ───────────────────────────────────────────────────────────
    let sorumlular;
    try {
        const { data, error } = await supabase
            .from('okul_sorumlulari')
            .select('id')
            .ilike('ilce_adi', ilceTrimmed);   // büyük/küçük harf farkını yok say

        if (error) throw error;
        sorumlular = data || [];
    } catch (e) {
        console.error('assign-district sorumlular sorgusu hatası:', e);
        return res.status(500).json({ message: `Sorumlular sorgulanırken hata: ${e.message}` });
    }

    // Sorumlu yoksa — koordinatör atama kaydı oluşturulamaz ama hata vermek yerine
    // bilgilendirici mesaj dön (1. aşamada henüz sorumlu yüklenmemiş olabilir)
    if (sorumlular.length === 0) {
        return res.status(200).json({
            success: true,
            message: `"${ilceTrimmed}" ilçesinde henüz kayıtlı sorumlu yok. Sorumlu listesi yüklendiğinde atama otomatik eşleşecek.`,
            atanan: 0,
        });
    }

    // ── Upsert ──────────────────────────────────────────────────────────────
    try {
        const assignments = sorumlular.map((s) => ({
            koordinator_id: koordinatorId,
            sorumlu_id:     s.id,
        }));

        const { error: upsertError } = await supabase
            .from('koordinator_sorumluluklari')
            .upsert(assignments, { onConflict: 'sorumlu_id' });

        if (upsertError) throw upsertError;
    } catch (e) {
        console.error('assign-district upsert hatası:', e);
        return res.status(500).json({ message: `Atama kaydedilirken hata: ${e.message}` });
    }

    return res.status(200).json({
        success: true,
        message: `"${ilceTrimmed}" ilçesindeki ${sorumlular.length} sorumlu başarıyla atandı.`,
        atanan: sorumlular.length,
    });
}