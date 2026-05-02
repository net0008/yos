// pages/admin/ayarlar.js
import React from 'react';
import AdminLayout from '../../components/AdminLayout';
import SystemSettings from '../../components/SystemSettings';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function AyarlarPage({ donemler }) {
    const handleSaveSettings = async (settings, token) => {
        const response = await fetch('/api/update-settings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify(settings),
        });
        return await response.json();
    };

    return (
        <AdminLayout activeTab="ayarlar">
            <SystemSettings donemler={donemler} onSave={handleSaveSettings} />
        </AdminLayout>
    );
}

export async function getServerSideProps(context) {
    const { req, res } = context;

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get: (name) => req.cookies[name],
                set: (name, value, options) =>
                    res.setHeader('Set-Cookie', serialize(name, value, options)),
                remove: (name, options) =>
                    res.setHeader('Set-Cookie', serialize(name, '', options)),
            },
        }
    );

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profile?.rol !== 'admin') {
        return { redirect: { destination: '/', permanent: false } };
    }

    try {
        // Fetch data for this page specifically
        const { data: settingsData, error } = await supabaseAdmin
            .from('sistem_ayarlari')
            .select('donem');

        if (error) throw error;

        let donemler = (settingsData || []).map(s => s.donem);
        // Ensure default donemler exist if none are in the DB
        const defaultDonemler = ['2025-2026 1. Dönem', '2025-2026 2. Dönem'];
        defaultDonemler.forEach(dd => {
            if (!donemler.includes(dd)) {
                donemler.push(dd);
            }
        });

        return {
            props: {
                donemler: donemler.sort(),
            },
        };
    } catch (error) {
        console.error('Ayarlar sayfası veri çekme hatası:', error.message);
        return {
            props: {
                donemler: ['2025-2026 1. Dönem', '2025-2026 2. Dönem'],
            },
        };
    }
}