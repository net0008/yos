// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Bu istemci SERVICE_ROLE_KEY kullandığı için sadece sunucu tarafında (API rotaları, getServerSideProps) kullanılmalıdır.
// RLS'i (Row Level Security) atlar.
export const supabaseAdmin = createClient(supabaseUrl, serviceKey);