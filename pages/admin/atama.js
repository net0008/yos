// pages/admin/atama.js
import React from 'react';
import Link from 'next/link';
import AdminLayout from '../../components/AdminLayout';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
import { ChevronRightIcon } from '@heroicons/react/24/solid';

const IZMIR_ILCELERI = [
    'Aliağa', 'Balçova', 'Bayındır', 'Bayraklı', 'Bergama',
    'Beydağ', 'Bornova', 'Buca', 'Çeşme', 'Çiğli',
    'Dikili', 'Foça', 'Gaziemir', 'Güzelbahçe', 'Karabağlar',
    'Karaburun', 'Karşıyaka', 'Kemalpaşa', 'Kınık', 'Kiraz',
    'Konak', 'Menderes', 'Menemen', 'Narlıdere', 'Ödemiş',
    'Seferihisar', 'Selçuk', 'Tire', 'Torbalı', 'Urla',
];

export default function AtamaOverviewPage({ districts }) {
    return (
        <AdminLayout activeTab="atama">
            <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
                <h2 className="text-xl font-bold mb-2">Görev Dağılımı - İlçe Seçimi</h2>
                <p className="text-gray-500 text-sm mb-4">Atama yapmak veya mevcut atamayı görüntülemek için bir ilçe seçin.</p>
                <div className="border rounded-lg overflow-hidden">
                    <ul className="divide-y divide-gray-200">
                        {districts.map(({ ilce_adi, sorumlu_count }) => (
                            <li key={ilce_adi}>
                                <Link href={`/admin/atama/${encodeURIComponent(ilce_adi)}`} className="flex items-center justify-between p-4 hover:bg-gray-50 transition-colors">
                                    <div>
                                        <span className="text-md font-medium text-indigo-700">{ilce_adi}</span>
                                        <span className="ml-3 text-sm text-gray-500">({sorumlu_count} okul sorumlusu)</span>
                                    </div>
                                    <ChevronRightIcon className="h-5 w-5 text-gray-400" />
                                </Link>
                            </li>
                        ))}
                    </ul>
                </div>
            </div>
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

        // Sadece ilçe sayılarını verimli bir şekilde çek
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

        return {
            props: {
                districts,
            }
        };
    } catch (error) {
        console.error('Atama anasayfası `getServerSideProps` içinde kritik hata:', error);
        // Hata durumunda sayfayı boş ama kullanılabilir verilerle yükle
        return {
            props: {
                districts: IZMIR_ILCELERI.map((ilce_adi) => ({ ilce_adi, sorumlu_count: 0 })),
            }
        };
    }
}