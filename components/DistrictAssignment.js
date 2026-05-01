// components/DistrictAssignment.js
import React, { useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';

const DistrictAssignment = ({ districts, coordinators, initialAssignments }) => {
    const [assignments, setAssignments] = useState(initialAssignments || {});
    const [uiState, setUiState] = useState({});

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
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');

            const response = await fetch('/api/assign-district', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({ ilceAdi: ilce, koordinatorId }),
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message || 'Atama başarısız.');

            setUiState(prev => ({
                ...prev,
                [ilce]: { status: 'success', message: data.message },
            }));
        } catch (error) {
            setUiState(prev => ({
                ...prev,
                [ilce]: { status: 'error', message: error.message },
            }));
        }
    };

    if (!districts || districts.length === 0) {
        return (
            <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
                <h2 className="text-2xl font-bold mb-2">Görev Dağılımı Yönetimi</h2>
                <p className="text-gray-500 text-sm">İlçe verisi yüklenemedi.</p>
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50">
            <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg">
                <div className="p-6 border-b">
                    <h2 className="text-2xl font-bold text-gray-900">Görev Dağılımı Yönetimi</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        İzmir ilçelerini koordinatörlere atayın. Koordinatörü seçip
                        "Kaydet" butonuna basın.
                    </p>
                    {coordinators.length === 0 && (
                        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-sm text-yellow-800">
                            ⚠️ Henüz koordinatör eklenmemiş. Önce yukarıdaki
                            "Koordinatör Yönetimi" bölümünden koordinatör ekleyin.
                        </div>
                    )}
                </div>

                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                    İlçe (Sorumlu Sayısı)
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                    Atanacak Koordinatör
                                </th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-1/3">
                                    İşlem
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {districts.map(({ ilce_adi, sorumlu_count }) => {
                                const state = uiState[ilce_adi];
                                const isAssigned = !!initialAssignments?.[ilce_adi];

                                return (
                                    <tr key={ilce_adi} className="hover:bg-gray-50">
                                        {/* İlçe adı */}
                                        <td className="py-3 px-6 whitespace-nowrap">
                                            <span className="font-medium text-gray-800">
                                                {ilce_adi}
                                            </span>
                                            <span className="ml-2 text-xs text-gray-400">
                                                ({sorumlu_count} okul sorumlusu)
                                            </span>
                                            {isAssigned && (
                                                <span className="ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-xs bg-green-100 text-green-700">
                                                    Atandı
                                                </span>
                                            )}
                                        </td>

                                        {/* Koordinatör seçimi */}
                                        <td className="py-3 px-6">
                                            <select
                                                value={assignments[ilce_adi] || ''}
                                                onChange={(e) =>
                                                    handleAssignmentChange(ilce_adi, e.target.value)
                                                }
                                                disabled={coordinators.length === 0}
                                                className="w-full p-2 border rounded-md text-sm disabled:bg-gray-100 disabled:text-gray-400 focus:ring-2 focus:ring-indigo-500"
                                            >
                                                <option value="" disabled>
                                                    {coordinators.length === 0
                                                        ? 'Önce koordinatör ekleyin'
                                                        : 'Koordinatör seçin...'}
                                                </option>
                                                {coordinators.map((c) => (
                                                    <option key={c.id} value={c.id}>
                                                        {c.ad_soyad}
                                                        {c.email ? ` (${c.email})` : ''}
                                                    </option>
                                                ))}
                                            </select>
                                        </td>

                                        {/* Kaydet butonu + durum */}
                                        <td className="py-3 px-6">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleSave(ilce_adi)}
                                                    disabled={
                                                        state?.status === 'loading' ||
                                                        coordinators.length === 0
                                                    }
                                                    className="px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-1 whitespace-nowrap"
                                                >
                                                    {state?.status === 'loading' ? (
                                                        <>
                                                            <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                            Kaydediliyor...
                                                        </>
                                                    ) : (
                                                        'Kaydet'
                                                    )}
                                                </button>

                                                {state?.status === 'success' && (
                                                    <CheckCircleIcon
                                                        className="h-5 w-5 text-green-500 flex-shrink-0"
                                                        title={state.message}
                                                    />
                                                )}
                                                {state?.status === 'error' && (
                                                    <span className="flex items-center gap-1 text-xs text-red-600">
                                                        <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
                                                        {state.message}
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

                {/* Alt bilgi */}
                <div className="p-4 border-t bg-gray-50 text-xs text-gray-400 text-right">
                    Toplam {districts.length} ilçe · İzmir
                </div>
            </div>
        </div>
    );
};

export default DistrictAssignment;