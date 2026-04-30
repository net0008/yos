// lib/supabaseClient.js
import { createBrowserClient } from '@supabase/ssr';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
        'Supabase URL veya Anon Key eksik. ' +
        'NEXT_PUBLIC_SUPABASE_URL ve NEXT_PUBLIC_SUPABASE_ANON_KEY tanımlı olmalı.'
    );
}

// createClient yerine createBrowserClient kullanıyoruz.
// Bu, session'ı localStorage'a DEĞİL cookie'ye yazar,
// böylece getServerSideProps de aynı session'ı görebilir.
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey);