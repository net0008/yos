// pages/admin/atama.js
import React, { useState } from 'react';
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

// Büyük/küçük harf sorunlarını çözmek için normalleştirme fonksiyonu
const normalize = (str) => (str || '').trim().toLocaleLowerCase('tr-TR');

export default function AtamaPage({ districts, coordinators, initialAssignments }) {
    const [view, setView] = useState('summary'); // 'summary' veya 'assign'

    if (view === 'summary') {
        return (
            <AdminLayout activeTab="atama">
                <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
                    <h2 className="text-xl font-bold mb-2">3. Aşama: Görev Dağılımı Özeti</h2>
                    <p className="text-gray-500 text-sm mb-4">Sisteme kayıtlı okul sorumlularının ilçelere göre dağılımı aşağıdadır. Devam ederek koordinatör ataması yapabilirsiniz.</p>
                    <div className="border rounded-lg overflow-hidden">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">İlçe</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Okul Sorumlusu Sayısı</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {districts.map(({ ilce_adi, sorumlu_count }) => (
                                    <tr key={ilce_adi}>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{ilce_adi}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{sorumlu_count}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 text-right">
                        <button
                            onClick={() => setView('assign')}
                            className="px-6 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 font-medium"
                        >
                            Devam Et ve Atama Yap &rarr;
                        </button>
                    </div>
                </div>
            </AdminLayout>
        );
    }

    // if (view === 'assign')
    return (
        <AdminLayout activeTab="atama">
            <button onClick={() => setView('summary')} className="text-sm text-indigo-600 hover:underline mb-4 block">&larr; İlçe Özetine Geri Dön</button>
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

        // 1. İlçe sayılarını verimli bir şekilde çek
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

        // 2. Koordinatörleri çek
        const { data: coordinators, error: coordinatorsError } = await supabaseAdmin
            .from('profiles')
            .select('id, ad_soyad, email')
            .eq('rol', 'koordinator');
        if (coordinatorsError) throw coordinatorsError;

        // 3. Mevcut atamaları verimli bir JOIN sorgusu ile çek
        const { data: assignmentsData, error: assignmentsError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('koordinator_id, okul_sorumlulari!inner(ilce_adi)');
        if (assignmentsError) throw assignmentsError;

        // --- Veri İşleme ---
        const initialAssignments = {};
        for (const assignment of (assignmentsData || [])) {
            const ilceFromDb = assignment.okul_sorumlulari?.ilce_adi;

            if (ilceFromDb && assignment.koordinator_id) {
                // Veritabanından gelen ilçe adını (örn: "aliağa") standart listedeki
                // karşılığıyla ("Aliağa") eşleştir.
                const canonicalIlce = IZMIR_ILCELERI.find(
                    (i) => normalize(i) === normalize(ilceFromDb)
                );
                // Atama listesinin anahtarı olarak her zaman standart adı kullan.
                const key = canonicalIlce || ilceFromDb;
                if (!initialAssignments[key]) {
                    initialAssignments[key] = assignment.koordinator_id;
                }
            }
        }

        return {
            props: {
                districts,
                coordinators: coordinators || [],
                initialAssignments,
            }
        };
    } catch (error) {
        console.error('Atama anasayfası `getServerSideProps` içinde kritik hata:', error);
        // Hata durumunda sayfayı boş ama kullanılabilir verilerle yükle
        return {
            props: {
                districts: IZMIR_ILCELERI.map((ilce_adi) => ({ ilce_adi, sorumlu_count: 0 })),
                coordinators: [],
                initialAssignments: {},
            }
        };
    }
}