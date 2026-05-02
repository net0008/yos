// pages/admin/atama/[ilce].js
import React, { useState } from 'react';
import Link from 'next/link';
import AdminLayout from '../../../components/AdminLayout';
import { supabaseAdmin } from '../../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon, TrashIcon } from '@heroicons/react/24/solid';
import { supabase } from '../../../lib/supabaseClient';

const SingleDistrictAssignment = ({ district, coordinators, initialAssignment }) => {
    const [assignment, setAssignment] = useState(initialAssignment || '');
    const [uiState, setUiState] = useState({});

    const handleSave = async () => {
        const koordinatorId = assignment;
        if (!koordinatorId) {
            setUiState({ status: 'error', message: 'Lütfen bir koordinatör seçin.' });
            return;
        }
        setUiState({ status: 'loading' });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');

            const response = await fetch('/api/assign-district', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ ilceAdi: district.ilce_adi, koordinatorId }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Atama başarısız.');

            setUiState({ status: 'success', message: data.message });
        } catch (error) {
            setUiState({ status: 'error', message: error.message });
        }
    };

    const handleDelete = async () => {
        if (!window.confirm(`"${district.ilce_adi}" ilçesinin atamasını kaldırmak istediğinizden emin misiniz?`)) return;

        setUiState({ status: 'loading' });
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');

            const response = await fetch('/api/delete-district-assignment', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ ilceAdi: district.ilce_adi }),
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Atama silinemedi.');

            setAssignment('');
            setUiState({ status: 'success', message: 'Atama kaldırıldı.' });
        } catch (error) {
            setUiState({ status: 'error', message: error.message });
        }
    };

    const state = uiState;
    const isAssigned = !!assignment;

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            <Link href="/admin/atama" className="text-sm text-indigo-600 hover:underline mb-4 block">&larr; İlçe Listesine Geri Dön</Link>
            <h2 className="text-2xl font-bold text-gray-900">Görev Dağılımı: <span className="text-indigo-700">{district.ilce_adi}</span></h2>
            <p className="mt-1 text-sm text-gray-500">
                Bu ilçe için bir koordinatör atayın. Bu ilçedeki <span className="font-bold">{district.sorumlu_count}</span> okul sorumlusunun tamamı seçtiğiniz koordinatöre atanacaktır.
            </p>
            {coordinators.length === 0 && (
                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                    ⚠️ Henüz koordinatör eklenmemiş. Önce "2. Aşama"dan koordinatör ekleyin.
                </div>
            )}

            <div className="mt-6">
                <div className="grid grid-cols-1 md:grid-cols-3 items-center gap-4 p-4 border rounded-lg">
                    <div className="md:col-span-1">
                        <label className="block text-sm font-medium text-gray-700">Atanacak Koordinatör</label>
                    </div>
                    <div className="md:col-span-1">
                        <select
                            value={assignment}
                            onChange={(e) => {
                                setAssignment(e.target.value);
                                setUiState({});
                            }}
                            disabled={coordinators.length === 0}
                            className="w-full p-2 border rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="" disabled>
                                {coordinators.length === 0 ? '— Koordinatör yok —' : 'Koordinatör seçin...'}
                            </option>
                            {coordinators.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.ad_soyad}{c.email ? ` (${c.email})` : ''}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div className="md:col-span-1 flex items-center gap-2">
                        <button
                            onClick={handleSave}
                            disabled={state?.status === 'loading' || coordinators.length === 0}
                            className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 flex items-center gap-1.5"
                        >
                            {state?.status === 'loading' ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : null}
                            Kaydet
                        </button>
                        {isAssigned && (
                            <button onClick={handleDelete} disabled={state?.status === 'loading'} className="p-2 text-red-600 rounded-md hover:bg-red-100 disabled:text-gray-400" title="Atamayı Kaldır">
                                <TrashIcon className="h-5 w-5" />
                            </button>
                        )}
                        {state?.status === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-500" title={state.message} />}
                        {state?.status === 'error' && <ExclamationCircleIcon className="h-5 w-5 text-red-500" title={state.message} />}
                    </div>
                </div>
                {state?.status === 'error' && <p className="text-xs text-red-600 mt-2">{state.message}</p>}
            </div>
        </div>
    );
};

export default function AtamaDetayPage({ district, coordinators, initialAssignment }) {
    return (
        <AdminLayout activeTab="atama">
            <SingleDistrictAssignment
                district={district}
                coordinators={coordinators}
                initialAssignment={initialAssignment}
            />
        </AdminLayout>
    );
}

export async function getServerSideProps(context) {
    const { req, res } = context;
    const { ilce } = context.params;

    try {
        const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
            cookies: {
                get: (name) => req.cookies[name],
                set: (name, value, options) => res.setHeader('Set-Cookie', serialize(name, value, options)),
                remove: (name, options) => res.setHeader('Set-Cookie', serialize(name, '', options)),
            },
        });

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return { redirect: { destination: '/auth/login', permanent: false } };

        const { data: profile } = await supabaseAdmin.from('profiles').select('rol').eq('id', user.id).single();
        if (profile?.rol !== 'admin') return { redirect: { destination: '/', permanent: false } };

        // 1. Fetch all coordinators
        const { data: coordinators, error: coordinatorsError } = await supabaseAdmin.from('profiles').select('id, ad_soyad, email').eq('rol', 'koordinator');
        if (coordinatorsError) throw coordinatorsError;

        // 2. Fetch sorumlu count for the specific district
        const { count, error: countError } = await supabaseAdmin.from('okul_sorumlulari').select('*', { count: 'exact', head: true }).eq('ilce_adi', ilce);
        if (countError) throw countError;

        const district = { ilce_adi: ilce, sorumlu_count: count || 0 };

        // 3. Fetch current assignment for the district
        let initialAssignment = '';
        if (district.sorumlu_count > 0) {
            const { data: sorumlularInIlce, error: sorumlularError } = await supabaseAdmin.from('okul_sorumlulari').select('id').eq('ilce_adi', ilce).limit(1);
            if (sorumlularError) throw sorumlularError;

            if (sorumlularInIlce.length > 0) {
                const sorumluId = sorumlularInIlce[0].id;
                const { data: assignment, error: assignmentError } = await supabaseAdmin.from('koordinator_sorumluluklari').select('koordinator_id').eq('sorumlu_id', sorumluId).single();
                if (assignment && !assignmentError) {
                    initialAssignment = assignment.koordinator_id;
                }
            }
        }

        return {
            props: {
                district,
                coordinators: coordinators || [],
                initialAssignment,
            },
        };
    } catch (error) {
        console.error(`Atama detay sayfası [${ilce}] veri çekme hatası:`, error);
        return {
            props: {
                district: { ilce_adi: ilce, sorumlu_count: 0 },
                coordinators: [],
                initialAssignment: '',
            },
        };
    }
}