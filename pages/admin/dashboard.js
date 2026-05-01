// pages/admin/dashboard.js
import React, { useState } from 'react';
import Layout from '../../components/Layout';
import DistrictAssignment from '../../components/DistrictAssignment';
import SystemSettings from '../../components/SystemSettings';
import CoordinatorManagement from '../../components/CoordinatorManagement';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
import SorumluUpload from '../../components/SorumluUpload';

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
    const [activeTab, setActiveTab] = useState('sorumlu');
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

    const tabs = [
        { id: 'sorumlu', name: '1. Aşama: Sorumlu Yönetimi' },
        { id: 'koordinator', name: '2. Aşama: Koordinatör Yönetimi' },
        { id: 'atama', name: '3. Aşama: Görev Dağılımı' },
        { id: 'ayarlar', name: '4. Aşama: Sistem Ayarları' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'sorumlu':
                return <SorumluUpload />;
            case 'koordinator':
                return <CoordinatorManagement initialCoordinators={coordinators} />;
            case 'atama':
                return (
                    <DistrictAssignment
                        districts={districts}
                        coordinators={coordinators}
                        initialAssignments={initialAssignments}
                    />
                );
            case 'ayarlar':
                return <SystemSettings donemler={donemler} onSave={handleSaveSettings} />;
            default:
                return null;
        }
    };

    return (
        <Layout title="Admin Paneli">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Yönetim Paneli</h1>

            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {tab.name}
                        </button>
                    ))}
                </nav>
            </div>

            <div className="mt-8">
                {renderContent()}
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
        const { data: districtCounts, error: countError } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('ilce_adi, count')
            .group('ilce_adi');

        if (countError) {
            console.error('Error fetching district counts:', countError);
            throw countError;
        }

        // İlçe → sorumlu sayısı map'i
        const sorumluCountMap = {};
        for (const item of districtCounts || []) {
            sorumluCountMap[item.ilce_adi] = item.count;
        }

        // İzmir ilçelerini DB'deki sayılarla birleştir
        const districts = IZMIR_ILCELERI.map((ilce_adi) => ({
            ilce_adi,
            sorumlu_count: sorumluCountMap[ilce_adi] || 0,
        }));

        // Koordinatörler
        const { data: profilesData, error: profilesError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad')
            .eq('rol', 'koordinator');

        if (profilesError) {
            console.error('Error fetching coordinator profiles:', profilesError);
            throw profilesError;
        }

        const coordinators = [];
        for (const p of profilesData || []) {
            try {
                const { data: authUser } = await supabaseAdmin.auth.admin.getUserById(p.id);
                coordinators.push({
                    id: p.id,
                    ad_soyad: p.ad_soyad,
                    email: authUser?.user?.email || 'E-posta bulunamadı', // Daha açıklayıcı bir yedek değer
                });
            } catch {
                coordinators.push({ id: p.id, ad_soyad: p.ad_soyad, email: '' });
            }
        }

        // Mevcut atamalar
        const { data: assignmentsData } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, okul_sorumlulari(ilce_adi)');
        const { error: assignmentsError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, okul_sorumlulari(ilce_adi)'); // Bu satır zaten yukarıda var, düzeltme yaparken dikkatli olalım.
        if (assignmentsError) {
            console.error('Error fetching assignments:', assignmentsError);
            throw assignmentsError;
        }

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