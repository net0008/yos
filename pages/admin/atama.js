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

        // --- Veri Çekme ---
        // Karmaşık paralel sorgular yerine, basit ve sıralı sorgular kullanarak sayfa yükleme hatalarını önle.

        // 1. Koordinatörleri çek
        const { data: coordinators, error: coordinatorsError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad, email')
            .eq('rol', 'koordinator');
        if (coordinatorsError) throw coordinatorsError;

        // 2. Okul sorumlularını çek (sadece ilçe ve id) ve ilçe sayılarını hesapla
        const { data: sorumlular, error: sorumlularError } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('id, ilce_adi');
        if (sorumlularError) throw sorumlularError;

        const sorumluCountMap = (sorumlular || []).reduce((acc, s) => {
            acc[s.ilce_adi] = (acc[s.ilce_adi] || 0) + 1;
            return acc;
        }, {});
        const districts = IZMIR_ILCELERI.map((ilce_adi) => ({
            ilce_adi,
            sorumlu_count: sorumluCountMap[ilce_adi] || 0,
        }));

        // 3. Mevcut atamaları çek
        const { data: assignmentsRaw, error: assignmentsError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, sorumlu_id');
        if (assignmentsError) throw assignmentsError;

        // --- Veri İşleme ---
        // Hangi sorumlunun hangi ilçede olduğunu hızlıca bulmak için bir harita oluştur.
        const sorumluToDistrictMap = (sorumlular || []).reduce((acc, s) => {
            acc[s.id] = s.ilce_adi;
            return acc;
        }, {});

        // Atama verisini { ilce: koordinator_id } formatına dönüştür.
        const initialAssignments = {};
        for (const assignment of (assignmentsRaw || [])) {
            const ilce = sorumluToDistrictMap[assignment.sorumlu_id];
            // Eğer bir ilçeye ait bir atama bulursak, bunu listeye ekle.
            // Bir ilçedeki tüm sorumlular aynı koordinatöre atanacağından, her ilçe için bulduğumuz ilk atama yeterlidir.
            if (ilce && !initialAssignments[ilce]) {
                initialAssignments[ilce] = assignment.koordinator_id;
            }
        }

        return {
            props: {
                districts,
                coordinators: coordinators || [],
                initialAssignments
            }
        };
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