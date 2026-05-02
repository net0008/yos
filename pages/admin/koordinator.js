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
        // --- Fetch ONLY coordinator data ---
        const { data: profilesData, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad')
            .eq('rol', 'koordinator');
        if (profilesError) throw profilesError;

        const allAuthUsers = [];
        let page = 1;
        const perPage = 100;
        while (true) {
            const { data: { users: authUsersPage }, error: usersError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
            if (usersError) throw usersError;
            allAuthUsers.push(...authUsersPage);
            if (authUsersPage.length < perPage) break;
            page++;
        }

        const emailMap = allAuthUsers.reduce((acc, user) => {
            acc[user.id] = user.email;
            return acc;
        }, {});

        const coordinators = (profilesData || []).map(p => ({
            id: p.id, ad_soyad: p.ad_soyad, email: emailMap[p.id] || 'E-posta bulunamadı',
        }));

        return { props: { coordinators } };

    } catch (error) {
        console.error('Koordinator sayfası veri çekme hatası:', error.message);
        return { props: { coordinators: [] } };
    }
}