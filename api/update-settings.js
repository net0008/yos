// pages/api/update-settings.js
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

    // --- Admin Rol Kontrolü ---
    // Güvenlik için bu isteği yapanın admin olduğu doğrulanmalıdır.
    // Bu bölüm, assign-district.js dosyasındaki gibi token kontrolü ile güçlendirilmelidir.
    // --- Rol Kontrolü Sonu ---

    const { donem, gorev_tanimlari, analiz_kriterleri } = req.body;

    if (!donem) {
        return res.status(400).json({ message: 'Dönem bilgisi zorunludur.' });
    }

    try {
        // 'sistem_ayarlari' tablosuna toplu ekleme/güncelleme yap.
        // 'onConflict: donem' sayesinde, eğer dönem zaten varsa günceller, değilse yeni kayıt ekler.
        const { data, error } = await supabase
            .from('sistem_ayarlari')
            .upsert(
                {
                    donem: donem,
                    gorev_tanimlari: gorev_tanimlari,
                    analiz_kriterleri: analiz_kriterleri,
                },
                {
                    onConflict: 'donem',
                }
            )
            .select();

        if (error) throw error;

        return res.status(200).json({ success: true, message: `"${donem}" dönemi ayarları başarıyla kaydedildi.`, data });

    } catch (error) {
        console.error('Sistem ayarları API hatası:', error);
        return res.status(500).json({ message: 'Ayarlar kaydedilirken bir sunucu hatası oluştu.', error: error.message });
    }
}