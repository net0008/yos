// pages/admin/dashboard.js
import Layout from '../../components/Layout';
import DistrictAssignment from '../../components/DistrictAssignment';
import SystemSettings from '../../components/SystemSettings';
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın (Sadece sunucu tarafında kullanılacak)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default function AdminDashboard({ districts, coordinators, initialAssignments, donemler }) {
    // SystemSettings bileşeni için onSave fonksiyonu
    const handleSaveSettings = async (settings) => {
        const response = await fetch('/api/update-settings', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
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
    // --- Admin Yetkilendirme Kontrolü ---
    const { req } = context;
    const { user } = await supabaseAdmin.auth.api.getUserByCookie(req);

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
        return { redirect: { destination: '/', permanent: false } }; // Admin değilse ana sayfaya yönlendir
    }
    // --- Yetkilendirme Kontrolü Sonu ---

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
        .select('sorumlu_id, koordinator_id');

    // Dönemler (şimdilik sabit, gerçekte veritabanından çekilmeli)
    const donemler = ["2025-2026 1. Dönem", "2025-2026 2. Dönem"];

    if (districtsError || coordinatorsError || assignmentsError) {
        console.error('Veri çekme hatası:', districtsError || coordinatorsError || assignmentsError);
        return { props: { error: 'Veriler yüklenirken bir hata oluştu.' } };
    }

    const initialAssignments = {};
    // Her sorumlu için tek bir atama olduğu varsayımıyla, ilçe bazında koordinatör atamasını bulmak karmaşık olabilir.
    // DistrictAssignment bileşeni ilçe bazında atama beklediği için, bu kısım daha sonra optimize edilebilir.
    // Şimdilik, her ilçe için ilk bulunan atamayı varsayalım veya boş bırakalım.

    return {
        props: {
            districts: districtsData.map(d => ({ ilce_adi: d.ilce_adi, sorumlu_count: d.count })),
            coordinators: coordinatorsData,
            initialAssignments: {}, // Bu kısım daha karmaşık bir mantık gerektirebilir.
            donemler: donemler,
        },
    };
}