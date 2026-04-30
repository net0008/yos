-- Projenin tüm veritabanı şeması
-- Bu betik, proje kurulumunun en başında bir kez çalıştırılmak üzere tasarlanmıştır.

-- Adım 0: Görevlendirme Tipi için ENUM
-- Okul sorumlusunun görevlendirme tipini tanımlar.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gorevlendirme_tipi') THEN
        CREATE TYPE public.gorevlendirme_tipi AS ENUM ('Tam Gün', 'Sabah', 'Öğle');
    END IF;
END$$;

-- Adım 1: Okul Sorumluları Tablosu
-- Sisteme giriş yapmadan rapor yükleyecek kişilerin kimlik doğrulama bilgileri.
CREATE TABLE IF NOT EXISTS public.okul_sorumlulari (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ad_soyad TEXT NOT NULL,
  atama_bransi TEXT,
  ilce_adi TEXT NOT NULL,
  kurum_kodu TEXT NOT NULL UNIQUE,
  okul_adi TEXT,
  gorevlendirme_donemi public.gorevlendirme_tipi,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
COMMENT ON TABLE public.okul_sorumlulari IS 'Admin tarafından Excel ile yüklenen okul sorumlularının listesi.';


-- Adım 2: Admin ve Koordinatör Profilleri Tablosu
-- Supabase Auth ile giriş yapacak kullanıcıların rollerini tutar.
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_soyad TEXT,
  rol TEXT NOT NULL CHECK (rol IN ('admin', 'koordinator'))
);
COMMENT ON TABLE public.profiles IS 'Sisteme giriş yapan admin ve koordinatörlerin rollerini ve ek bilgilerini tutar.';


-- Adım 3: Koordinatör Sorumlulukları Tablosu
-- Hangi koordinatörün hangi okul sorumlusundan sorumlu olduğunu eşleştirir.
CREATE TABLE IF NOT EXISTS public.koordinator_sorumluluklari (
  id BIGSERIAL PRIMARY KEY,
  koordinator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sorumlu_id UUID NOT NULL REFERENCES public.okul_sorumlulari(id) ON DELETE CASCADE,
  UNIQUE (sorumlu_id) -- Bir okul sorumlusu sadece bir koordinatöre atanabilir.
);
COMMENT ON TABLE public.koordinator_sorumluluklari IS 'Koordinatör ve okul sorumlusu arasındaki görev atamalarını tutar.';


-- Adım 4: Rapor Durumları için ENUM Tipi
-- Raporların alabileceği tüm durumları tanımlar.
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'rapor_status') THEN
        CREATE TYPE public.rapor_status AS ENUM (
            'beklemede',
            'ai_incelendi',
            'koordinator_onayinda',
            'onaylandi',
            'reddedildi',
            'duzeltme_bekleniyor',
            'ai_analiz_hatasi',
            'RAPOR_GONDERILMEMIS',
            'RAPOR_OKUNMUYOR',
            'IMZA_MUHUR_EKSİK',
            'FORMAT_HATALI',
            'GENEL_IFADE',
            'BOS_BOLUM_ACIKLAMA_YOK',
            'UST_BILGI_EKSİK_HATALI',
            'ONAY_TARIHI_EKSİK',
            'ESKI_FORMAT'
        );
    END IF;
END$$;


-- Adım 5: Raporlar Tablosu
-- Yüklenen tüm raporların meta verilerini ve durumlarını tutar.
CREATE TABLE IF NOT EXISTS public.raporlar (
  id BIGSERIAL PRIMARY KEY,
  sorumlu_id UUID NOT NULL REFERENCES public.okul_sorumlulari(id) ON DELETE CASCADE,
  donem TEXT NOT NULL,
  ay INTEGER NOT NULL CHECK (ay >= 1 AND ay <= 12),
  pdf_storage_path TEXT,
  yuklenme_tarihi TIMESTAMP WITH TIME ZONE,
  ai_analiz_sonucu JSONB,
  koordinator_onayi BOOLEAN DEFAULT FALSE,
  status public.rapor_status,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (sorumlu_id, donem, ay) -- Bir sorumlu, bir dönemde bir ay için sadece tek bir rapor yükleyebilir.
);
COMMENT ON TABLE public.raporlar IS 'Okul sorumluları tarafından yüklenen aylık raporların kayıtları.';


-- Adım 6: Sistem Ayarları Tablosu
-- Admin tarafından yönetilecek dinamik görev ve kriter tanımlarını tutar.
CREATE TABLE IF NOT EXISTS public.sistem_ayarlari (
    id INT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    donem TEXT NOT NULL UNIQUE, -- Örn: "2025-2026 1. Dönem"
    gorev_tanimlari TEXT, -- Okul sorumlusunun görevleri
    analiz_kriterleri TEXT[] -- Değerlendirme kriterleri listesi
);
COMMENT ON TABLE public.sistem_ayarlari IS 'Adminin dönem bazında belirlediği görev ve analiz kriterleri.';


-- Adım 7: Mesajlar Tablosu
-- Kullanıcılar (Admin ve Koordinatörler) arasındaki mesajlaşmayı tutar.
CREATE TABLE IF NOT EXISTS public.mesajlar (
  id BIGSERIAL PRIMARY KEY,
  gonderen_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  alici_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL, -- Birebir mesajlaşma için, NULL ise genel mesaj
  icerik TEXT NOT NULL,
  gonderilme_tarihi TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  okundu BOOLEAN DEFAULT FALSE -- Mesajın okunup okunmadığını takip etmek için
);
COMMENT ON TABLE public.mesajlar IS 'Admin ve koordinatörler arasındaki mesajlaşma kayıtları.';