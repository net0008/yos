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
    try {
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

        // Daha güvenli yetkilendirme kontrolü
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData?.user) {
            return { redirect: { destination: '/auth/login', permanent: false } };
        }
        const user = authData.user;

        const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('rol')
            .eq('id', user.id)
            .single();

        if (profile?.rol !== 'admin') {
            return { redirect: { destination: '/', permanent: false } };
        }

        // Veri çekme işlemlerini paralel ve dayanıklı bir şekilde yapmak için Promise.allSettled kullan.
        // Bu sayede bir sorgu başarısız olsa bile diğerleri çalışmaya devam eder.
        const districtsPromise = supabaseAdmin
            .from('okul_sorumlulari')
            .select('ilce_adi, count(id)')
            .group('ilce_adi');

        const coordinatorsPromise = (async () => {
            // E-posta bilgisini de içeren profilleri tek bir sorguyla verimli bir şekilde al.
            const { data: coordinators, error: coordinatorsError } = await supabaseAdmin
                .from('profiles')
                .select('id, ad_soyad, email')
                .eq('rol', 'koordinator');
            if (coordinatorsError) throw coordinatorsError;
            return coordinators || [];
        })();

        // Mevcut atamaları veritabanından verimli bir şekilde çekmek için JOIN'li tek bir sorgu kullan.
        // Bu, tüm okul sorumluları tablosunu çekme ihtiyacını ortadan kaldırır ve sayfa yükleme hatalarını önler.
        const assignmentsPromise = (async () => {
            const { data, error } = await supabaseAdmin
                .from('koordinator_sorumluluklari')
                .select('koordinator_id, okul_sorumlulari!inner(ilce_adi)');

            if (error) throw error;

            const initialAssignments = {};
            if (data) {
                for (const assignment of data) {
                    // JOIN'den gelen sonuçları işle
                    if (assignment.okul_sorumlulari?.ilce_adi && assignment.koordinator_id) {
                        // Bir ilçedeki tüm sorumlular aynı koordinatöre atanacağından, her ilçe için bulduğumuz atamayı kullanabiliriz.
                        initialAssignments[assignment.okul_sorumlulari.ilce_adi] = assignment.koordinator_id;
                    }
                }
            }
            return initialAssignments;
        })();

        const [
            districtsResult,
            coordinatorsResult,
            assignmentsResult
        ] = await Promise.allSettled([districtsPromise, coordinatorsPromise, assignmentsPromise]);

        // İlçe verilerini işle
        let districts = IZMIR_ILCELERI.map((ilce_adi) => ({ ilce_adi, sorumlu_count: 0 }));
        if (districtsResult.status === 'fulfilled' && !districtsResult.value.error) {
            const districtsData = districtsResult.value.data;
            const sorumluCountMap = (districtsData || []).reduce((acc, d) => {
                acc[d.ilce_adi] = d.count;
                return acc;
            }, {});
            districts = IZMIR_ILCELERI.map((ilce_adi) => ({
                ilce_adi,
                sorumlu_count: sorumluCountMap[ilce_adi] || 0,
            }));
        } else if (districtsResult.status === 'rejected' || districtsResult.value.error) {
            console.error('Atama sayfası ilçe veri çekme hatası:', districtsResult.reason || districtsResult.value.error);
        }

        // Koordinatör verilerini işle
        const coordinators = coordinatorsResult.status === 'fulfilled' ? coordinatorsResult.value : [];
        if (coordinatorsResult.status === 'rejected') {
            console.error('Atama sayfası koordinatör veri çekme hatası:', coordinatorsResult.reason);
        }

        // Atama verilerini işle
        const initialAssignments = assignmentsResult.status === 'fulfilled' ? assignmentsResult.value : {};
        if (assignmentsResult.status === 'rejected') {
            console.error('Atama sayfası atama veri çekme hatası:', assignmentsResult.reason);
        }

        return { props: { districts, coordinators, initialAssignments } };
    } catch (error) {
        console.error('Atama sayfası `getServerSideProps` içinde kritik hata:', error);
        // Hata durumunda sayfayı boş ama kullanılabilir verilerle yükle
        return {
            props: {
                districts: IZMIR_ILCELERI.map((ilce_adi) => ({ ilce_adi, sorumlu_count: 0 })),
                coordinators: [],
                initialAssignments: {}
            }
        };
    }
}