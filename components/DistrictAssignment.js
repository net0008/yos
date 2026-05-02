// components/DistrictAssignment.js
import React, { useState, useEffect } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';

// HTML veya bozuk JSON gelirse crash etme
async function safeJson(response) {
    const text = await response.text();
    try {
        return { ok: response.ok, status: response.status, data: JSON.parse(text) };
    } catch {
        console.error('JSON parse hatası. Sunucu yanıtı:', text.slice(0, 300));
        return {
            ok: false,
            status: response.status,
            data: {
                success: false,
                message: `Sunucu geçersiz yanıt döndürdü (HTTP ${response.status}).`,
            },
        };
    }
}

const DistrictAssignment = ({ districts, coordinators, initialAssignments }) => {
    // initialAssignments prop'u değiştiğinde state'i güncelle
    const [assignments, setAssignments] = useState(initialAssignments || {});
    const [uiState, setUiState] = useState({});

    // Sayfa yenilendiğinde veya prop değiştiğinde dropdown'ları güncelle
    useEffect(() => {
        setAssignments(initialAssignments || {});
        setUiState({});
    }, [initialAssignments]);

    const handleAssignmentChange = (ilce, koordinatorId) => {
        setAssignments(prev => ({ ...prev, [ilce]: koordinatorId }));
        setUiState(prev => ({ ...prev, [ilce]: undefined }));
    };

    const handleSave = async (ilce) => {
        const koordinatorId = assignments[ilce];
        if (!koordinatorId) {
            setUiState(prev => ({
                ...prev,
                [ilce]: { status: 'error', message: 'Lütfen bir koordinatör seçin.' },
            }));
            return;
        }

        setUiState(prev => ({ ...prev, [ilce]: { status: 'loading' } }));

        try {
            const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !sessionData?.session) {
                throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
            }
            const token = sessionData.session.access_token;

            const response = await fetch('/api/assign-district', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ ilceAdi: ilce, koordinatorId }),
            });

            const { ok, data } = await safeJson(response);

            if (!ok || !data.success) {
                throw new Error(data.message || `HTTP ${response.status} hatası.`);
            }

            // Başarılı atamayı local state'e de yaz
            setAssignments(prev => ({ ...prev, [ilce]: koordinatorId }));
            setUiState(prev => ({
                ...prev,
                [ilce]: { status: 'success', message: data.message },
            }));

        } catch (error) {
            console.error('handleSave hatası:', error);
            setUiState(prev => ({
                ...prev,
                [ilce]: { status: 'error', message: error.message },
            }));
        }
    };

    if (!districts || districts.length === 0) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
                <h2 className="text-xl font-bold mb-2">Görev Dağılımı Yönetimi</h2>
                <p className="text-gray-500 text-sm">İlçe verisi yüklenemedi.</p>
            </div>
        );
    }

    const atananSayisi = Object.keys(assignments).filter(k => assignments[k]).length;

    return (
        <div className="bg-gray-50 px-4">
            <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg">
                <div className="p-6 border-b">
                    <h2 className="text-xl font-bold text-gray-900">Görev Dağılımı Yönetimi</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Her ilçe için koordinatör seçin ve "Kaydet" butonuna basın.
                    </p>
                    {coordinators.length === 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                            ⚠️ Henüz koordinatör eklenmemiş. Önce "2. Aşama" sekmesinden koordinatör ekleyin.
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50 border-b">
                            <tr>
                                <th className="py-3 px-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[36%]">
                                    İlçe
                                </th>
                                <th className="py-3 px-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[38%]">
                                    Atanacak Koordinatör
                                </th>
                                <th className="py-3 px-5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-[26%]">
                                    İşlem
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {districts.map(({ ilce_adi, sorumlu_count }) => {
                                const state      = uiState[ilce_adi];
                                const isAssigned = !!assignments[ilce_adi];

                                return (
                                    <tr key={ilce_adi} className="hover:bg-gray-50">

                                        {/* İlçe + sorumlu sayısı */}
                                        <td className="py-2.5 px-5 whitespace-nowrap">
                                            <span className="text-sm font-medium text-gray-800">
                                                {ilce_adi}
                                            </span>
                                            <span className="ml-1.5 text-xs text-gray-400">
                                                ({sorumlu_count} okul sorumlusu)
                                            </span>
                                            {isAssigned && state?.status !== 'loading' && (
                                                <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700 font-medium">
                                                    Atandı ✓
                                                </span>
                                            )}
                                        </td>

                                        {/* Koordinatör dropdown */}
                                        <td className="py-2.5 px-5">
                                            <select
                                                value={assignments[ilce_adi] || ''}
                                                onChange={(e) =>
                                                    handleAssignmentChange(ilce_adi, e.target.value)
                                                }
                                                disabled={coordinators.length === 0}
                                                className="w-full p-1.5 border rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="" disabled>
                                                    {coordinators.length === 0
                                                        ? '— Koordinatör yok —'
                                                        : 'Koordinatör seçin...'}
                                                </option>
                                                {coordinators.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.ad_soyad}{c.email ? ` (${c.email})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Kaydet + durum */}
                                        <td className="py-2.5 px-5">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <button
                                                    onClick={() => handleSave(ilce_adi)}
                                                    disabled={
                                                        state?.status === 'loading' ||
                                                        coordinators.length === 0
                                                    }
                                                    className="px-3 py-1.5 text-xs font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                                                >
                                                    {state?.status === 'loading' ? (
                                                        <>
                                                            <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                                            Kaydediliyor
                                                        </>
                                                    ) : 'Kaydet'}
                                                </button>

                                                {state?.status === 'success' && (
                                                    <CheckCircleIcon
                                                        className="h-4 w-4 text-green-500 flex-shrink-0"
                                                        title={state.message}
                                                    />
                                                )}
                                                {state?.status === 'error' && (
                                                    <span className="flex items-center gap-1 text-xs text-red-600 max-w-[160px]">
                                                        <ExclamationCircleIcon className="h-3.5 w-3.5 flex-shrink-0" />
                                                        <span className="break-words">{state.message}</span>
                                                    </span>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="p-3 border-t bg-gray-50 text-xs text-gray-400 flex justify-between">
                    <span>
                        {atananSayisi} / {districts.length} ilçe atandı
                    </span>
                    <span>İzmir · {districts.length} ilçe</span>
                </div>
            </div>
        </div>
    );
};

export default DistrictAssignment;