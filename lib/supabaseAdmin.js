// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

// createClient'i modül yüklenirken ÇAĞIRMA — build zamanında env vars tanımsız olur.
// Bunun yerine ilk kullanımda başlat (lazy initialization).
let _instance = null;

function getClient() {
    if (_instance) return _instance;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error(
            'Supabase URL veya Service Role Key eksik. ' +
            'NEXT_PUBLIC_SUPABASE_URL ve SUPABASE_SERVICE_ROLE_KEY ortam değişkenlerini kontrol edin.'
        );
    }

    _instance = createClient(supabaseUrl, serviceKey);
    return _instance;
}

// Proxy ile mevcut tüm import kullanımlarını kırmadan lazy init sağla.
// Tüm dosyalardaki `supabaseAdmin.from(...)`, `supabaseAdmin.auth...` gibi
// çağrılar hâlâ çalışmaya devam eder.
export const supabaseAdmin = new Proxy(
    {},
    {
        get(_, prop) {
            return getClient()[prop];
        },
    }
);