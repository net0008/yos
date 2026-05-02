// pages/admin/atama.js
import React from 'react';
import AdminLayout from '../../components/AdminLayout';
import DistrictAssignment from '../../components/DistrictAssignment';
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

export default function AtamaPage({ districts, coordinators, initialAssignments }) {
    return (
        <AdminLayout activeTab="atama">
            <DistrictAssignment
                districts={districts}
                coordinators={coordinators}
                initialAssignments={initialAssignments}
            />
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
        // Fetch data for this page specifically
        const { data: districtsData, error: districtsError } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('ilce_adi, count(id)')
            .group('ilce_adi');
        if (districtsError) throw districtsError;

        const sorumluCountMap = (districtsData || []).reduce((acc, d) => {
            acc[d.ilce_adi] = d.count;
            return acc;
        }, {});
        const districts = IZMIR_ILCELERI.map((ilce_adi) => ({
            ilce_adi,
            sorumlu_count: sorumluCountMap[ilce_adi] || 0,
        }));

        const { data: coordinatorsData, error: coordinatorsError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad')
            .eq('rol', 'koordinator');
        if (coordinatorsError) throw coordinatorsError;

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
        const coordinators = (coordinatorsData || []).map(p => ({
            id: p.id, ad_soyad: p.ad_soyad, email: emailMap[p.id] || '',
        }));

        // Verimli atama sorgusu: İki ayrı tabloyu çekmek yerine JOIN'li bir sorgu kullan.
        // Bu, sayfa yükleme süresini önemli ölçüde iyileştirir ve zaman aşımlarını önler.
        const { data: assignmentsData, error: assignmentsErr } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, okul_sorumlulari(ilce_adi)');
        if (assignmentsErr) throw assignmentsErr;

        // Gelen veriyi { 'İlçe Adı': 'koordinator_id' } formatına dönüştür.
        const initialAssignments = {};
        if (assignmentsData) {
            for (const assignment of assignmentsData) {
                if (assignment.okul_sorumlulari?.ilce_adi && assignment.koordinator_id) {
                    initialAssignments[assignment.okul_sorumlulari.ilce_adi] = assignment.koordinator_id;
                }
            }
        }

        return { props: { districts, coordinators, initialAssignments } };
    } catch (error) {
        console.error('Atama sayfası veri çekme hatası:', error.message);
        return { props: { districts: IZMIR_ILCELERI.map((ilce_adi) => ({ ilce_adi, sorumlu_count: 0 })), coordinators: [], initialAssignments: {} } };
    }
}