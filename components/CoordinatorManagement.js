// components/CoordinatorManagement.js
import React, { useState } from 'react';
import { PlusIcon, TrashIcon, UserCircleIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';

const CoordinatorManagement = ({ initialCoordinators = [] }) => {
    const router = useRouter();
    // The list of coordinators is now directly driven by the `initialCoordinators` prop.
    const [form, setForm] = useState({ adSoyad: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMsg = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 4000);
    };

    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);

        const token = await getToken();
        const res = await fetch('/api/create-coordinator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({
                adSoyad: form.adSoyad,
                email: form.email,
                password: form.password,
            }),
        });

        const data = await res.json();
        setLoading(false);

        if (!res.ok) {
            showMsg(data.message, 'error');
            return;
        }

        showMsg(data.message, 'success');
        setForm({ adSoyad: '', email: '', password: '' });
        router.replace(router.asPath); // Refetch server-side props to update the list everywhere
    };

    const handleDelete = async (koordinatorId, adSoyad) => {
        if (!confirm(`"${adSoyad}" koordinatörünü silmek istediğinizden emin misiniz?`)) return;

        const token = await getToken();
        const res = await fetch('/api/delete-coordinator', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ koordinatorId }),
        });

        const data = await res.json();
        if (res.ok) {
            showMsg(data.message, 'success');
            router.replace(router.asPath); // Refetch server-side props to update the list everywhere
        } else {
            showMsg(data.message, 'error');
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-1">Koordinatör Yönetimi</h2>
            <p className="text-sm text-gray-500 mb-6">
                Sisteme yeni koordinatör ekleyin veya mevcutları yönetin.
            </p>

            {/* Ekleme Formu */}
            <form onSubmit={handleAdd} className="bg-gray-50 border rounded-lg p-4 mb-6">
                <h3 className="font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <PlusIcon className="h-5 w-5 text-indigo-600" />
                    Yeni Koordinatör Ekle
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Ad Soyad
                        </label>
                        <input
                            type="text"
                            value={form.adSoyad}
                            onChange={e => setForm(p => ({ ...p, adSoyad: e.target.value }))}
                            required
                            placeholder="Ahmet Yılmaz"
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            E-posta
                        </label>
                        <input
                            type="email"
                            value={form.email}
                            onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                            required
                            placeholder="ahmet@okul.gov.tr"
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                            Şifre
                        </label>
                        <input
                            type="password"
                            value={form.password}
                            onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                            required
                            placeholder="En az 6 karakter"
                            minLength={6}
                            className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                </div>
                <button
                    type="submit"
                    disabled={loading}
                    className="mt-3 px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-2"
                >
                    <PlusIcon className="h-4 w-4" />
                    {loading ? 'Ekleniyor...' : 'Koordinatör Ekle'}
                </button>
            </form>

            {/* Mesaj */}
            {message.text && (
                <div className={`mb-4 p-3 rounded-md text-sm ${message.type === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-green-50 border border-green-200 text-green-700'
                    }`}>
                    {message.text}
                </div>
            )}

            {/* Koordinatör Listesi */}
            <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                Koordinatör
                            </th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                                E-posta
                            </th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                                İşlem
                            </th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {initialCoordinators.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">
                                    Henüz koordinatör eklenmemiş.
                                </td>
                            </tr>
                        ) : (
                            initialCoordinators.map(k => (
                                <tr key={k.id}>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <UserCircleIcon className="h-6 w-6 text-gray-500 flex-shrink-0" />
                                            <span className="text-sm font-medium text-gray-900">
                                                {k.ad_soyad}
                                            </span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {k.email || '—'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => handleDelete(k.id, k.ad_soyad)}
                                            className="text-red-500 hover:text-red-700 p-1 rounded"
                                            title="Sil"
                                        >
                                            <TrashIcon className="h-4 w-4" />
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

export default CoordinatorManagement;