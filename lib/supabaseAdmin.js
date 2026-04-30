// lib/supabaseAdmin.js
import { createClient } from '@supabase/supabase-js';

let _instance = null;

function getClient() {
    if (_instance) return _instance;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !serviceKey) {
        throw new Error(
            'NEXT_PUBLIC_SUPABASE_URL veya SUPABASE_SERVICE_ROLE_KEY eksik.'
        );
    }

    _instance = createClient(supabaseUrl, serviceKey);
    return _instance;
}

// Proxy ile lazy init — ama metodları .bind(client) ile sarıyoruz.
// Sarmazsak supabaseAdmin.from(...) çağrısında `this` Proxy oluyor → crash.
export const supabaseAdmin = new Proxy(
    {},
    {
        get(_, prop) {
            const client = getClient();
            const value = client[prop];
            if (typeof value === 'function') {
                return value.bind(client); // ← kritik
            }
            return value;
        },
    }
);