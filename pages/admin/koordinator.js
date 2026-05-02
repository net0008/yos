// pages/admin/koordinator.js
import React from 'react';
import AdminLayout from '../../components/AdminLayout';
import CoordinatorManagement from '../../components/CoordinatorManagement';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function CoordinatorPage({ coordinators: initialCoordinators }) {
    // The component now manages its own state after getting initial props.
    return (
        <AdminLayout activeTab="koordinator">
            <CoordinatorManagement initialCoordinators={initialCoordinators} />
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
        // --- Koordinatör verilerini verimli bir şekilde çek ---
        // E-posta bilgisini de içeren profilleri tek bir sorguyla al.
        // Bu, tüm auth kullanıcılarını çekme ihtiyacını ortadan kaldırır ve performansı büyük ölçüde artırır.
        const { data: coordinators, error: coordinatorsError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad, email')
            .eq('rol', 'koordinator');
        if (coordinatorsError) throw coordinatorsError;

        return { props: { coordinators } };

    } catch (error) {
        console.error('Koordinator sayfası veri çekme hatası:', error.message);
        return { props: { coordinators: [] } };
    }
}