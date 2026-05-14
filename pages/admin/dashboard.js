// pages/admin/dashboard.js
import React, { useState } from 'react';
import Layout from '../../components/Layout';
import DistrictAssignment from '../../components/DistrictAssignment';
import SystemSettings from '../../components/SystemSettings';
import CoordinatorManagement from '../../components/CoordinatorManagement';
import SorumluUpload from '../../components/SorumluUpload';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

const IZMIR_ILCELERI = [
    'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama',
    'Beydağ', 'Bornova', 'Buca', 'Çeşme', 'Çiğli',
    'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe', 'Karabağlar',
    'Karaburun', 'Karşıyaka', 'Kemalpaşa', 'Kınık', 'Kiraz',
    'Konak', 'Menderes', 'Menemen', 'Narlıdere', 'Ödemiş',
    'Seferihisar', 'Selçuk', 'Tire', 'Torbalı', 'Urla',
];

const normalize = (str) =>
    (str || '').trim().toLocaleLowerCase('tr-TR');

export default function AdminDashboard({
    districts,
    coordinators: initialCoordinators,
    initialAssignments,
    donemler,
}) {
    const [activeTab, setActiveTab] = useState('sorumlu');
    const [coordinators, setCoordinators] = useState(initialCoordinators);

    const handleCoordinatorAdded = (newK) => {
        setCoordinators(prev => [...prev, newK]);
    };

    const handleCoordinatorDeleted = (deletedId) => {
        setCoordinators(prev => prev.filter(k => k.id !== deletedId));
    };

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
                return (
                    <CoordinatorManagement
                        initialCoordinators={coordinators}
                        onCoordinatorAdded={handleCoordinatorAdded}
                        onCoordinatorDeleted={handleCoordinatorDeleted}
                    />
                );
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
            <div className="mt-4">{renderContent()}</div>
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

    const fallback = {
        districts: IZMIR_ILCELERI.map((ilce_adi) => ({ ilce_adi, sorumlu_count: 0 })),
        coordinators: [],
        initialAssignments: {},
        donemler: ['2025-2026 1. Dönem', '2025-2026 2. Dönem'],
    };

    try {
        // ── 1. Sorumlu sayıları ──────────────────────────────────────────
        const { data: allSorumlular } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('id, ilce_adi');

        const sorumluCountMap = {};
        const sorumluMap = {}; // ID üzerinden ilçe adını bulmak için
        for (const s of allSorumlular || []) {
            sorumluMap[s.id] = s.ilce_adi;
            const key = normalize(s.ilce_adi);
            if (key) sorumluCountMap[key] = (sorumluCountMap[key] || 0) + 1;
        }

        const districts = IZMIR_ILCELERI.map((ilce_adi) => ({
            ilce_adi,
            sorumlu_count: sorumluCountMap[normalize(ilce_adi)] || 0,
        }));

        // ── 2. Koordinatörler ────────────────────────────────────────────
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

        // ── 3. Mevcut atamalar ───────────────────────────────────────────
        const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, sorumlu_id');

        if (assignmentsError) {
            console.error('Atamalar çekilirken hata:', assignmentsError.message);
        }

        const initialAssignments = {};

        for (const row of assignmentsData || []) {
            // Alt sorgu yerine hafızadaki sorumluMap üzerinden ilçeyi buluyoruz
            const ilceAdi = sorumluMap[row.sorumlu_id];

            if (!ilceAdi || !row.koordinator_id) continue;

            // IZMIR_ILCELERI'ndeki canonical adı bul (büyük/küçük harf normalize)
            const canonical = IZMIR_ILCELERI.find(
                (i) => normalize(i) === normalize(ilceAdi)
            );
            const key = canonical || ilceAdi;

            // Daha önce bu ilçe için bir atama yoksa ekle
            if (!initialAssignments[key]) {
                initialAssignments[key] = row.koordinator_id;
            }
        }

        console.log('initialAssignments:', JSON.stringify(initialAssignments, null, 2));

        return {
            props: {
                districts,
                coordinators,
                initialAssignments,
                donemler: ['2025-2026 1. Dönem', '2025-2026 2. Dönem'],
            },
        };
    } catch (error) {
        console.error('Admin dashboard kritik hata:', error.message);
        return { props: fallback };
    }
}