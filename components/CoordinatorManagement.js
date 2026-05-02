// components/CoordinatorManagement.js
import React, { useState } from 'react';
import {
    PlusIcon, TrashIcon, UserCircleIcon,
    CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon,
} from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';

const CoordinatorManagement = ({
    initialCoordinators = [],
    onCoordinatorAdded,
    onCoordinatorDeleted,
}) => {
    const [coordinators, setCoordinators] = useState(initialCoordinators);
    const [form, setForm] = useState({ adSoyad: '', email: '', password: '' });
    const [loading, setLoading] = useState(false);
    const [deleteLoadingId, setDeleteLoadingId] = useState(null);
    const [message, setMessage] = useState({ text: '', type: '' });

    const showMsg = (text, type = 'success') => {
        setMessage({ text, type });
        setTimeout(() => setMessage({ text: '', type: '' }), 5000);
    };

    const getToken = async () => {
        const { data: { session } } = await supabase.auth.getSession();
        return session?.access_token;
    };

    const handleAdd = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage({ text: '', type: '' });
        try {
            const token = await getToken();
            if (!token) { showMsg('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error'); return; }

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
            if (!res.ok) { showMsg(data.message || 'Koordinatör eklenemedi.', 'error'); return; }

            const newK = data.koordinator;
            setCoordinators(prev => [...prev, newK]);
            onCoordinatorAdded?.(newK);
            setForm({ adSoyad: '', email: '', password: '' });
            showMsg(`"${newK.ad_soyad}" başarıyla eklendi.`, 'success');
        } catch (err) {
            showMsg(`Hata: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (koordinatorId, adSoyad) => {
        if (!confirm(`"${adSoyad}" koordinatörünü silmek istediğinizden emin misiniz?`)) return;
        setDeleteLoadingId(koordinatorId);
        try {
            const token = await getToken();
            if (!token) { showMsg('Oturum bulunamadı.', 'error'); return; }

            const res = await fetch('/api/delete-coordinator', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ koordinatorId }),
            });
            const data = await res.json();
            if (!res.ok) { showMsg(data.message || 'Silinemedi.', 'error'); return; }

            setCoordinators(prev => prev.filter(k => k.id !== koordinatorId));
            onCoordinatorDeleted?.(koordinatorId);
            showMsg(`"${adSoyad}" başarıyla silindi.`, 'success');
        } catch (err) {
            showMsg(`Hata: ${err.message}`, 'error');
        } finally {
            setDeleteLoadingId(null);
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            <h2 className="text-xl font-bold mb-1 text-gray-800">Koordinatör Yönetimi</h2>
            <p className="text-sm text-gray-500 mb-5">
                Sisteme yeni koordinatör ekleyin veya mevcutları yönetin.
            </p>

            {/* Mesaj */}
            {message.text && (
                <div className={`mb-4 p-3 rounded-md text-sm flex items-center gap-2 ${
                    message.type === 'error'
                        ? 'bg-red-50 border border-red-200 text-red-700'
                        : 'bg-green-50 border border-green-200 text-green-700'
                }`}>
                    {message.type === 'error'
                        ? <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
                        : <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />}
                    {message.text}
                </div>
            )}

            {/* Ekleme Formu */}
            <form onSubmit={handleAdd} className="bg-gray-50 border rounded-lg p-4 mb-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1">
                    {/* İkon küçültüldü: h-5 → h-4 */}
                    <PlusIcon className="h-4 w-4 text-indigo-600" />
                    Yeni Koordinatör Ekle
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Ad Soyad</label>
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
                        <label className="block text-xs font-medium text-gray-600 mb-1">E-posta</label>
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
                        <label className="block text-xs font-medium text-gray-600 mb-1">Şifre</label>
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
                    className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-1.5"
                >
                    {loading
                        ? <><ArrowPathIcon className="h-3.5 w-3.5 animate-spin" /> Ekleniyor...</>
                        : <><PlusIcon className="h-3.5 w-3.5" /> Koordinatör Ekle</>}
                </button>
            </form>

            {/* Liste */}
            <div className="border rounded-lg overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Soyad</th>
                            <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-posta</th>
                            <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
                        </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                        {coordinators.length === 0 ? (
                            <tr>
                                <td colSpan={3} className="px-4 py-8 text-center text-gray-400 text-sm">
                                    Henüz koordinatör eklenmemiş. Yukarıdaki formu kullanarak ekleyin.
                                </td>
                            </tr>
                        ) : (
                            coordinators.map(k => (
                                <tr key={k.id} className="hover:bg-gray-50">
                                    <td className="px-4 py-3 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            {/* İkon küçültüldü: h-8 → h-5 */}
                                            <UserCircleIcon className="h-5 w-5 text-indigo-400 flex-shrink-0" />
                                            <span className="text-sm font-medium text-gray-900">{k.ad_soyad}</span>
                                        </div>
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                                        {k.email || '—'}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap text-right">
                                        <button
                                            onClick={() => handleDelete(k.id, k.ad_soyad)}
                                            disabled={deleteLoadingId === k.id}
                                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-40"
                                        >
                                            {deleteLoadingId === k.id
                                                ? <ArrowPathIcon className="h-3 w-3 animate-spin" />
                                                : <TrashIcon className="h-3 w-3" />}
                                            {deleteLoadingId === k.id ? 'Siliniyor...' : 'Sil'}
                                        </button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
                {coordinators.length > 0 && (
                    <div className="px-4 py-2 bg-gray-50 border-t text-xs text-gray-400 text-right">
                        Toplam {coordinators.length} koordinatör
                    </div>
                )}
            </div>
        </div>
    );
};

export default CoordinatorManagement;