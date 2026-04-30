// pages/admin/dashboard.js
import Layout from '../../components/Layout';
import DistrictAssignment from '../../components/DistrictAssignment';
import SystemSettings from '../../components/SystemSettings';
import CoordinatorManagement from '../../components/CoordinatorManagement';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

// İzmir'in 30 ilçesi — DB boş olsa bile her zaman gösterilir
const IZMIR_ILCELERI = [
    'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama',
    'Beydağ', 'Bornova', 'Buca', 'Çeşme', 'Çiğli',
    'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe', 'Karabağlar',
    'Karaburun', 'Karşıyaka', 'Kemalpaşa', 'Kınık', 'Kiraz',
    'Konak', 'Menderes', 'Menemen', 'Narlıdere', 'Ödemiş',
    'Seferihisar', 'Selçuk', 'Tire', 'Torbalı', 'Urla',
];

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
                <CoordinatorManagement initialCoordinators={coordinators} />
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
        // DB'deki sorumlu sayılarını ilçe bazında al
        const { data: allSorumlular } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('ilce_adi');

        // İlçe → sorumlu sayısı map'i
        const sorumluCountMap = {};
        for (const s of allSorumlular || []) {
            if (s.ilce_adi) {
                sorumluCountMap[s.ilce_adi] = (sorumluCountMap[s.ilce_adi] || 0) + 1;
            }
        }

        // İzmir ilçelerini DB'deki sayılarla birleştir
        // DB'de olmayan ilçeler de listede görünür, sorumlu_count 0 olur
        const districts = IZMIR_ILCELERI.map((ilce_adi) => ({
            ilce_adi,
            sorumlu_count: sorumluCountMap[ilce_adi] || 0,
        }));

        // Koordinatörler
        const { data: profilesData } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad')
            .eq('rol', 'koordinator');

        const coordinators = [];
        for (const p of profilesData || []) {
            try {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
                coordinators.push({
                    id: p.id,
                    ad_soyad: p.ad_soyad,
                    email: authUser?.user?.email || '',
                });
            } catch {
                coordinators.push({ id: p.id, ad_soyad: p.ad_soyad, email: '' });
            }
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
        // Hata olsa bile İzmir ilçelerini göster
        return {
            props: {
                districts: IZMIR_ILCELERI.map((ilce_adi) => ({
                    ilce_adi,
                    sorumlu_count: 0,
                })),
                coordinators: [],
                initialAssignments: {},
                donemler: ['2025-2026 1. Dönem', '2025-2026 2. Dönem'],
            },
        };
    }
}