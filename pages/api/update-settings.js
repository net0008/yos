// pages/api/update-settings.js
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const normalize = (str) => (str || '').trim().toLocaleLowerCase('tr-TR');

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    // --- Admin Rol Kontrolü ---
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

    if (profileError || profile?.rol !== 'admin') {
        return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
    }
    // --- Rol Kontrolü Sonu ---

    const { donem, gorev_tanimlari, analiz_kriterleri } = req.body;

    if (!donem) {
        return res.status(400).json({ message: 'Dönem bilgisi zorunludur.' });
    }

    try {
        // Önce veritabanında bu dönemin (büyük/küçük harf fark etmeksizin) olup olmadığını kontrol et
        const { data: allSettings, error: fetchError } = await supabase
            .from('sistem_ayarlari')
            .select('id, donem');

        if (fetchError) throw fetchError;

        const targetDonemNormal = normalize(donem);
        const existingSetting = (allSettings || []).find(s => normalize(s.donem) === targetDonemNormal);

        let resultData, resultError;

        if (existingSetting) {
            // Kayıt zaten varsa UPDATE yap (ID'si üzerinden güvenli güncelleme)
            const { data, error } = await supabase
                .from('sistem_ayarlari')
                .update({
                    gorev_tanimlari: gorev_tanimlari,
                    analiz_kriterleri: analiz_kriterleri,
                    donem: donem.trim() // Formatı da düzeltmiş olalım
                })
                .eq('id', existingSetting.id)
                .select();
            resultData = data;
            resultError = error;
        } else {
            // Kayıt yoksa INSERT yap
            const { data, error } = await supabase
                .from('sistem_ayarlari')
                .insert({
                    donem: donem.trim(),
                    gorev_tanimlari: gorev_tanimlari,
                    analiz_kriterleri: analiz_kriterleri,
                })
                .select();
            resultData = data;
            resultError = error;
        }

        if (resultError) throw resultError;

        return res.status(200).json({ success: true, message: `"${donem}" dönemi ayarları başarıyla kaydedildi.`, data: resultData });

    } catch (error) {
        console.error('Sistem ayarları API hatası:', error);
        return res.status(500).json({ message: 'Ayarlar kaydedilirken bir sunucu hatası oluştu.', error: error.message });
    }
}