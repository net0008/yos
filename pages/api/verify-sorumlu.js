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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
  }

  const { ilce, adSoyad, kurumKodu } = req.body;

  if (!ilce || !adSoyad || !kurumKodu) {
    return res.status(400).json({ message: 'Tüm alanlar doldurulmalıdır.' });
  }

  try {
    const { data, error } = await supabase
      .from('okul_sorumlulari')
      .select('id, ad_soyad')
      .ilike('ilce_adi', ilce)
      .eq('ad_soyad', adSoyad)
      .eq('kurum_kodu', kurumKodu)
      .single(); // Tek bir sonuç bekliyoruz

    if (error && error.code === 'PGRST116') { // No rows found
      return res.status(404).json({ success: false, message: 'Girilen bilgilerle eşleşen bir kayıt bulunamadı. Lütfen bilgilerinizi kontrol ediniz.' });
    } else if (error) {
      console.error('Supabase sorgu hatası:', error);
      return res.status(500).json({ success: false, message: 'Sunucu hatası oluştu. Lütfen daha sonra tekrar deneyin.' });
    }

    if (data) {
      return res.status(200).json({ success: true, sorumluId: data.id, adSoyad: data.ad_soyad });
    } else {
      // Bu duruma normalde PGRST116 hatası düşerdi, ancak ekstra kontrol
      return res.status(404).json({ success: false, message: 'Girilen bilgilerle eşleşen bir kayıt bulunamadı. Lütfen bilgilerinizi kontrol ediniz.' });
    }

  } catch (error) {
    console.error('API hatası:', error);
    return res.status(500).json({ success: false, message: 'Beklenmedik bir hata oluştu.' });
  }
}
