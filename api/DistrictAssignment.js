// components/DistrictAssignment.js
import React, { useState } from 'react';
import { CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

/**
 * Admin'in koordinatörlere ilçe bazında okul sorumlusu ataması yapacağı arayüz.
 * @param {object} props - Bileşen propları.
 * @param {object[]} props.districts - Her bir ilçe ve sorumlu sayısını içeren dizi. Örn: [{ ilce_adi: 'Kadıköy', sorumlu_count: 15 }]
 * @param {object[]} props.coordinators - Sistemdeki tüm koordinatörlerin listesi. Örn: [{ id: 'uuid', ad_soyad: 'Elif Kaya' }]
 * @param {object} props.initialAssignments - Mevcut atamaları içeren nesne. Örn: { 'Kadıköy': 'uuid-of-elif' }
 */
const DistrictAssignment = ({ districts, coordinators, initialAssignments }) => {
    // Her ilçe için seçili koordinatörü state'de tutar
    const [assignments, setAssignments] = useState(initialAssignments || {});
    // Her ilçe için yüklenme ve mesaj durumunu ayrı ayrı tutar
    const [uiState, setUiState] = useState({});

    const handleAssignmentChange = (ilce, koordinatorId) => {
        setAssignments(prev => ({ ...prev, [ilce]: koordinatorId }));
        // Kullanıcı yeni bir seçim yaptığında o satırın mesajını temizle
        setUiState(prev => ({ ...prev, [ilce]: undefined }));
    };

    const handleSave = async (ilce) => {
        const koordinatorId = assignments[ilce];
        if (!koordinatorId) {
            setUiState(prev => ({
                ...prev,
                [ilce]: { status: 'error', message: 'Lütfen bir koordinatör seçin.' }
            }));
            return;
        }

        setUiState(prev => ({ ...prev, [ilce]: { status: 'loading' } }));

        try {
            // Gerçek uygulamada, bu istek admin yetkilendirme token'ı ile yapılmalıdır.
            const response = await fetch('/api/assign-district', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${admin_token}`
                },
                body: JSON.stringify({ ilceAdi: ilce, koordinatorId }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Atama sırasında bir hata oluştu.');
            }

            setUiState(prev => ({ ...prev, [ilce]: { status: 'success', message: data.message } }));

        } catch (error) {
            setUiState(prev => ({ ...prev, [ilce]: { status: 'error', message: error.message } }));
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50">
            <div className="max-w-4xl mx-auto bg-white shadow-md rounded-lg">
                <div className="p-6 border-b">
                    <h1 className="text-2xl font-bold text-gray-900">Görev Dağılımı Yönetimi</h1>
                    <p className="mt-1 text-sm text-gray-600">İlçeleri ilgili koordinatörlere atayın. Her satırdaki "Kaydet" butonu ile işlemi tamamlayın.</p>
                </div>
                <div className="overflow-x-auto">
                    <table className="min-w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İlçe (Sorumlu Sayısı)</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atanacak Koordinatör</th>
                                <th className="py-3 px-6 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İşlem</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {districts.map(({ ilce_adi, sorumlu_count }) => {
                                const state = uiState[ilce_adi];
                                return (
                                    <tr key={ilce_adi}>
                                        <td className="py-4 px-6 whitespace-nowrap font-medium text-gray-800">
                                            {ilce_adi} <span className="text-gray-500 font-normal">({sorumlu_count} Sorumlu)</span>
                                        </td>
                                        <td className="py-4 px-6 whitespace-nowrap">
                                            <select
                                                value={assignments[ilce_adi] || ''}
                                                onChange={(e) => handleAssignmentChange(ilce_adi, e.target.value)}
                                                className="w-full p-2 border rounded-md"
                                            >
                                                <option value="" disabled>Koordinatör Seçin...</option>
                                                {coordinators.map(c => <option key={c.id} value={c.id}>{c.ad_soyad}</option>)}
                                            </select>
                                        </td>
                                        <td className="py-4 px-6 whitespace-nowrap">
                                            <div className="flex items-center gap-3">
                                                <button onClick={() => handleSave(ilce_adi)} disabled={state?.status === 'loading'} className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                                                    {state?.status === 'loading' ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : 'Kaydet'}
                                                </button>
                                                {state?.status === 'success' && <CheckCircleIcon className="h-6 w-6 text-green-500" title={state.message} />}
                                                {state?.status === 'error' && <ExclamationCircleIcon className="h-6 w-6 text-red-500" title={state.message} />}
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default DistrictAssignment;