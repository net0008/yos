// pages/api/verify-sorumlu.js
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın
// Ortam değişkenlerini .env.local dosyanızda tanımlamanız gerekmektedir.
// NEXT_PUBLIC_SUPABASE_URL=YOUR_SUPABASE_URL
// SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY (Bu anahtar sunucu tarafında kullanılmalı, client tarafında değil)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY // Sadece sunucu tarafında kullanılmalı
);

// Türkçe karakterleri doğru küçültmek için yardımcı fonksiyon
const normalize = (str) => (str || '').trim().toLocaleLowerCase('tr-TR');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
  }

  const { adSoyad, kurumKodu } = req.body;

  if (!adSoyad || !kurumKodu) {
    return res.status(400).json({ message: 'Tüm alanlar doldurulmalıdır.' });
  }

  try {
    // 1. Önce sadece Kurum Koduna göre kayıtları çek (Kurum kodu numerik olduğu için harf hatası olmaz)
    const { data, error } = await supabase
      .from('okul_sorumlulari')
      .select('id, ad_soyad')
      .eq('kurum_kodu', kurumKodu.trim());

    if (error) {
      console.error('Supabase sorgu hatası:', error);
      return res.status(500).json({ success: false, message: 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.' });
    }

    // 2. Gelen kayıtlar arasında Ad Soyad eşleşmesini JS üzerinde tam güvenli olarak yap
    const targetAdSoyadNormal = normalize(adSoyad);
    const matchedRecord = (data || []).find(r => normalize(r.ad_soyad) === targetAdSoyadNormal);

    if (matchedRecord) {
      return res.status(200).json({ success: true, sorumluId: matchedRecord.id, adSoyad: matchedRecord.ad_soyad });
    } else {
      return res.status(404).json({ success: false, message: 'Girilen bilgilerle eşleşen bir kayıt bulunamadı. Lütfen bilgilerinizi kontrol ediniz.' });
    }

  } catch (error) {
    console.error('API hatası:', error);
    return res.status(500).json({ success: false, message: 'Beklenmedik bir hata oluştu.' });
  }
}
