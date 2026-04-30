// pages/admin/dashboard.js
import Layout from '../../components/Layout';
import DistrictAssignment from '../../components/DistrictAssignment';
import SystemSettings from '../../components/SystemSettings';
import CoordinatorManagement from '../../components/CoordinatorManagement';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function AdminDashboard({
    districts,
    coordinators,
    initialAssignments,
    donemler,
}) {
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
                {/* 1. Koordinatör Yönetimi — önce koordinatörler eklensin */}
                <CoordinatorManagement initialCoordinators={coordinators} />

                {/* 2. İlçe Atama — koordinatörler eklendikten sonra ata */}
                <DistrictAssignment
                    districts={districts}
                    coordinators={coordinators}
                    initialAssignments={initialAssignments}
                />

                {/* 3. Sistem Ayarları */}
                <SystemSettings donemler={donemler} onSave={handleSaveSettings} />
            </div>
        </Layout>
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
        // İlçeler
        const { data: allSorumlular } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('ilce_adi');

        const districtMap = {};
        for (const s of allSorumlular || []) {
            districtMap[s.ilce_adi] = (districtMap[s.ilce_adi] || 0) + 1;
        }
        const districts = Object.entries(districtMap).map(([ilce_adi, count]) => ({
            ilce_adi,
            sorumlu_count: count,
        }));

        // Koordinatörler — email için auth.users ile join
        const { data: profilesData } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad')
            .eq('rol', 'koordinator');

        // Her koordinatörün email'ini auth'dan al
        const coordinators = [];
        for (const p of profilesData || []) {
            const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
            coordinators.push({
                id: p.id,
                ad_soyad: p.ad_soyad,
                email: authUser?.user?.email || '',
            });
        }

        // Mevcut atamalar
        const { data: assignmentsData } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, okul_sorumlulari(ilce_adi)');

        const initialAssignments = {};
        for (const row of assignmentsData || []) {
            const ilce = row.okul_sorumlulari?.ilce_adi;
            if (ilce && row.koordinator_id) {
                initialAssignments[ilce] = row.koordinator_id;
            }
        }

        return {
            props: {
                districts,
                coordinators,
                initialAssignments,
                donemler: ['2025-2026 1. Dönem', '2025-2026 2. Dönem'],
            },
        };
    } catch (error) {
        console.error('Admin dashboard hatası:', error.message);
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