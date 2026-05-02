// pages/admin/dashboard.js
import React from 'react';
import AdminLayout from '../../components/AdminLayout'; // New Layout
import SorumluUpload from '../../components/SorumluUpload';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
export default function SorumluManagementPage() {
    // The onSorumluListChange prop is no longer needed as pages are separate.
    return (
        <AdminLayout activeTab="sorumlu">
            <SorumluUpload />
        </AdminLayout>
    );
}

export async function getServerSideProps(context) {
    // This function now only needs to perform authentication and authorization.
    // The component itself fetches the data it needs.
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

    // No data needs to be passed to the page component as props.
    return { props: {} };
}