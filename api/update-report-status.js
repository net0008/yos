// pages/api/update-report-status.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { reportId, status, correctionNote } = req.body;

    if (!reportId || !status) {
        return res.status(400).json({ message: 'Rapor ID ve durum bilgisi zorunludur.' });
    }

    // --- Koordinatör Yetkilendirme ve Rapor Aitlik Kontrolü ---
    const token = req.headers.authorization?.split(' ')[1];
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
        return res.status(401).json({ message: 'Yetkisiz erişim.' });
    }

    const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || profile?.rol !== 'koordinator') {
        return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
    }
    const coordinatorId = user.id;

    // Raporun ait olduğu sorumluyu bul
    const { data: reportData, error: reportFetchError } = await supabase
        .from('raporlar')
        .select('sorumlu_id')
        .eq('id', reportId)
        .single();

    if (reportFetchError || !reportData) {
        console.error('Rapor bulunamadı veya çekilirken hata:', reportFetchError);
        return res.status(404).json({ message: 'Rapor bulunamadı.' });
    }

    // Raporun sorumlusunun bu koordinatöre atanmış olup olmadığını kontrol et
    const { data: assignmentCheck, error: assignmentCheckError } = await supabase
        .from('koordinator_sorumluluklari')
        .select('id')
        .eq('koordinator_id', coordinatorId)
        .eq('sorumlu_id', reportData.sorumlu_id)
        .single();

    if (assignmentCheckError || !assignmentCheck) {
        console.error('Koordinatörün bu rapora erişim yetkisi yok:', assignmentCheckError);
        return res.status(403).json({ message: 'Bu rapora erişim yetkiniz yok.' });
    }
    // --- Yetkilendirme ve Rapor Aitlik Kontrolü Sonu ---

    try {
        const updateData = { status: status };
        if (correctionNote) {
            updateData.koordinator_notu = correctionNote; // 'koordinator_notu' sütununun veritabanında mevcut olması gerekir.
        }

        const { error } = await supabase.from('raporlar').update(updateData).eq('id', reportId);

        if (error) throw error;

        return res.status(200).json({ success: true, message: 'Rapor durumu başarıyla güncellendi.' });

    } catch (error) {
        console.error('Rapor durumu güncelleme API hatası:', error);
        return res.status(500).json({ message: 'Rapor durumu güncellenirken bir sunucu hatası oluştu.', error: error.message });
    }
}