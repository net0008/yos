// pages/admin/dashboard.js
import Layout from '../../components/Layout';
import DistrictAssignment from '../../components/DistrictAssignment';
import SystemSettings from '../../components/SystemSettings';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function AdminDashboard({ districts, coordinators, initialAssignments, donemler }) {
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
        <Layout title="Admin Paneli">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Yönetim Paneli</h1>
            <div className="space-y-8">
                <DistrictAssignment
                    districts={districts}
                    coordinators={coordinators}
                    initialAssignments={initialAssignments}
                />
                <SystemSettings
                    donemler={donemler}
                    onSave={handleSaveSettings}
                />
            </div>
        </Layout>
    );
}

export async function getServerSideProps(context) {
    const { req, res } = context;

    // Oturum kontrolü için anon client
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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user) {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.rol !== 'admin') {
        console.error('Admin yetkilendirme hatası:', profileError);
        return { redirect: { destination: '/', permanent: false } };
    }

    // İlçeler ve sorumlu sayıları
    const { data: districtsData, error: districtsError } = await supabaseAdmin
        .from('okul_sorumlulari')
        .select('ilce_adi, count(id)')
        .group('ilce_adi');

    // Koordinatörler
    const { data: coordinatorsData, error: coordinatorsError } = await supabaseAdmin
        .from('profiles')
        .select('id, ad_soyad')
        .eq('rol', 'koordinator');

    // Mevcut atamalar
    const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
        .from('koordinator_sorumluluklari')
        .select('koordinator_id, okul_sorumlulari(ilce_adi)');

    const donemler = ['2025-2026 1. Dönem', '2025-2026 2. Dönem'];

    if (districtsError || coordinatorsError || assignmentsError) {
        console.error('Veri çekme hatası:', districtsError || coordinatorsError || assignmentsError);
        return {
            props: { districts: [], coordinators: [], initialAssignments: {}, donemler: [] },
        };
    }

    const initialAssignments = {};
    if (assignmentsData) {
        for (const assignment of assignmentsData) {
            if (assignment.okul_sorumlulari?.ilce_adi && assignment.koordinator_id) {
                initialAssignments[assignment.okul_sorumlulari.ilce_adi] = assignment.koordinator_id;
            }
        }
    }

    return {
        props: {
            districts: districtsData.map((d) => ({ ilce_adi: d.ilce_adi, sorumlu_count: d.count })),
            coordinators: coordinatorsData,
            initialAssignments,
            donemler,
        },
    };
}