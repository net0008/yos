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
                <SystemSettings donemler={donemler} onSave={handleSaveSettings} />
            </div>
        </Layout>
    );
}

export async function getServerSideProps(context) {
    const { req, res } = context;

    // Oturum doğrulama
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

    // Admin rol kontrolü
    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.rol !== 'admin') {
        return { redirect: { destination: '/', permanent: false } };
    }

    try {
        // Tüm okul sorumlularını çek, ilçe bazında JS'de grupla
        // (.group() Supabase JS'de mevcut değil)
        const { data: allSorumlular, error: sorumlularError } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('ilce_adi');

        if (sorumlularError) throw sorumlularError;

        // JS tarafında ilçe bazında say
        const districtMap = {};
        for (const s of allSorumlular || []) {
            districtMap[s.ilce_adi] = (districtMap[s.ilce_adi] || 0) + 1;
        }
        const districtsData = Object.entries(districtMap).map(
            ([ilce_adi, count]) => ({ ilce_adi, sorumlu_count: count })
        );

        // Koordinatörler
        const { data: coordinatorsData, error: coordinatorsError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad')
            .eq('rol', 'koordinator');

        if (coordinatorsError) throw coordinatorsError;

        // Mevcut atamalar — hangi ilçe hangi koordinatöre atanmış
        const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select(`
                koordinator_id,
                okul_sorumlulari ( ilce_adi )
            `);

        if (assignmentsError) throw assignmentsError;

        // { 'İlçeAdı': 'koordinator_uuid' } formatına dönüştür
        const initialAssignments = {};
        for (const row of assignmentsData || []) {
            const ilce = row.okul_sorumlulari?.ilce_adi;
            if (ilce && row.koordinator_id) {
                initialAssignments[ilce] = row.koordinator_id;
            }
        }

        const donemler = ['2025-2026 1. Dönem', '2025-2026 2. Dönem'];

        return {
            props: {
                districts: districtsData,
                coordinators: coordinatorsData || [],
                initialAssignments,
                donemler,
            },
        };
    } catch (error) {
        console.error('Admin dashboard veri hatası:', error.message);
        return {
            props: {
                districts: [],
                coordinators: [],
                initialAssignments: {},
                donemler: ['2025-2026 1. Dönem', '2025-2026 2. Dönem'],
            },
        };
    }
}