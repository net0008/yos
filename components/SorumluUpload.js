// components/SorumluUpload.js
import React, { useState, useEffect } from 'react';
import {
    ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon,
    ArrowPathIcon, TrashIcon, UserGroupIcon,
} from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';
const SorumluUpload = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle');
    const [message, setMessage] = useState('');
    const [errorDetails, setErrorDetails] = useState([]);
    const [sorumlular, setSorumlular] = useState([]);
    const [view, setView] = useState('loading');

    useEffect(() => {
        fetchSorumlular();
    }, []);

    const fetchSorumlular = async () => {
        setStatus('loading');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');
            const response = await fetch('/api/get-sorumlular', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            const fetchedSorumlular = data.sorumlular || [];
            setSorumlular(fetchedSorumlular);

            if (fetchedSorumlular.length > 0) {
                setView('list');
            } else {
                setView('upload');
            }
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
            setView('upload');
            setSorumlular([]);
        } finally {
            setStatus('idle');
        }
    };

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStatus('idle');
        setMessage('');
        setErrorDetails([]);
    };

    const handleDeleteAll = async () => {
        if (!window.confirm('Emin misiniz? Tüm okul sorumluları kalıcı olarak silinecek.')) return;
        setStatus('uploading');
        setMessage('Liste siliniyor...');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı.');
            const response = await fetch('/api/delete-all-sorumlular', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message);
            setMessage(data.message);
            setStatus('success');
            setSorumlular([]);
            setView('upload');
            setTimeout(() => setMessage(''), 3000);
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage('Lütfen bir Excel dosyası seçin.');
            setStatus('error');
            return;
        }
        setStatus('uploading');
        setMessage('');
        const formData = new FormData();
        formData.append('excel', file);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
            const response = await fetch('/api/upload-sorumlu-excel', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
                body: formData,
            });
            const data = await response.json();
            if (!response.ok) {
                const err = new Error(data.message || 'Yükleme hatası.');
                err.details = data.errors;
                throw err;
            }
            setStatus('success');
            setMessage(data.message);
            setErrorDetails([]);
            setFile(null);
            fetchSorumlular();
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
            setErrorDetails(error.details || []);
        }
    };

    // İlçe bazında sorumlu sayılarını hesapla
    const ilceSayilari = sorumlular.reduce((acc, s) => {
        acc[s.ilce_adi] = (acc[s.ilce_adi] || 0) + 1;
        return acc;
    }, {});

    const renderContent = () => {
        if (view === 'loading') {
            return (
                <div className="flex justify-center items-center p-10">
                    <ArrowPathIcon className="h-4 w-4 animate-spin text-gray-500" />
                    <p className="ml-2 text-gray-600 text-sm">Yükleniyor...</p>
                </div>
            );
        }

        if (view === 'list') {
            return (
                <div>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-3">
                        <div>
                            <h3 className="text-lg font-bold text-gray-800">
                                Yüklü Okul Sorumluları
                                <span className="ml-2 text-sm font-normal text-gray-500">
                                    ({sorumlular.length} kişi · {Object.keys(ilceSayilari).length} ilçe)
                                </span>
                            </h3>
                            {/* İlçe bazında özet badge'ler */}
                            <div className="flex flex-wrap gap-1.5 mt-2">
                                {Object.entries(ilceSayilari)
                                    .sort((a, b) => a[0].localeCompare(b[0], 'tr'))
                                    .map(([ilce, sayi]) => (
                                        <span
                                            key={ilce}
                                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-indigo-50 text-indigo-700 border border-indigo-100"
                                        >
                                            {ilce}
                                            <span className="ml-1 font-bold bg-indigo-100 text-indigo-800 rounded px-1">{sayi}</span>
                                        </span>
                                    ))}
                            </div>
                        </div>
                        <button
                            onClick={handleDeleteAll}
                            disabled={status === 'uploading'}
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700 disabled:bg-gray-400 whitespace-nowrap"
                        >
                            {status === 'uploading'
                                ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                : <TrashIcon className="h-3.5 w-3.5" />}
                            Listeyi Sil
                        </button>
                    </div>

                    <div className="overflow-x-auto max-h-[60vh] border border-gray-200 rounded-lg">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase border border-gray-200 w-12">No</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200">Adı Soyadı</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200">İlçe</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200">Okul</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200">Kurum Kodu</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200">Branş</th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase border border-gray-200">Dönem</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {sorumlular.map((sorumlu, index) => (
                                    <tr key={sorumlu.id} className="hover:bg-gray-50">
                                        <td className="px-3 py-2.5 text-center text-xs text-gray-400 border border-gray-200">{index + 1}</td>
                                        <td className="px-4 py-2.5 text-sm font-medium text-gray-900 border border-gray-200">{sorumlu.ad_soyad}</td>
                                        <td className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200">{sorumlu.ilce_adi}</td>
                                        <td className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200">{sorumlu.okul_adi || '—'}</td>
                                        <td className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200">{sorumlu.kurum_kodu}</td>
                                        <td className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200">{sorumlu.atama_bransi || '—'}</td>
                                        <td className="px-4 py-2.5 text-sm text-gray-600 border border-gray-200">{sorumlu.gorevlendirme_donemi || '—'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            );
        }

        // view === 'upload'
        return (
            <>
                <div className="text-center mb-6">
                    {/* İkon küçültüldü: h-10 → h-6 */}
                    <UserGroupIcon className="mx-auto h-6 w-6 text-gray-400 mb-2" />
                    <h2 className="text-lg font-bold text-gray-800">Okul Sorumluları Yönetimi</h2>
                    <p className="text-sm text-gray-500 mt-1 max-w-xl mx-auto">
                        Kayıtlı sorumlu bulunmamaktadır. Excel sütun sırası:
                        <span className="font-medium"> Sıra no · ADI SOYADI · ATAMA BRANŞI · İLÇESİ · KURUM KODU · OKUL ADI · Görevlendirme Dönemi</span>
                    </p>
                </div>

                <form onSubmit={handleUpload} className="space-y-4 max-w-md mx-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-600 mb-1">Excel Dosyası</label>
                        <div className="flex justify-center px-6 pt-4 pb-5 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                {/* İkon küçültüldü: h-10 → h-6 */}
                                <ArrowUpTrayIcon className="mx-auto h-6 w-6 text-gray-400" />
                                <div className="text-sm text-gray-600">
                                    <label
                                        htmlFor="file-upload"
                                        className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-500"
                                    >
                                        <span>Dosya seçin</span>
                                        <input
                                            id="file-upload"
                                            type="file"
                                            className="sr-only"
                                            accept=".xlsx,.xls,.csv"
                                            onChange={handleFileChange}
                                        />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">
                                    {file ? file.name : 'XLSX, XLS, CSV — maks. 5MB'}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button
                        type="submit"
                        disabled={status === 'uploading' || !file}
                        className="w-full py-2 px-4 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center gap-2"
                    >
                        {status === 'uploading' ? (
                            <><ArrowPathIcon className="h-4 w-4 animate-spin" /> Yükleniyor...</>
                        ) : (
                            <><ArrowUpTrayIcon className="h-4 w-4" /> Listeyi Yükle ve Kaydet</>
                        )}
                    </button>
                </form>
            </>
        );
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-6xl mx-auto">
            {renderContent()}
            {message && (
                <div className={`mt-4 p-3 rounded-md text-sm flex items-start gap-2 ${status === 'error'
                    ? 'bg-red-50 border border-red-200 text-red-700'
                    : 'bg-green-50 border border-green-200 text-green-700'
                    }`}>
                    {status === 'error'
                        ? <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />
                        : <CheckCircleIcon className="h-4 w-4 flex-shrink-0 mt-0.5" />}
                    <div>
                        <p className="font-medium">{message}</p>
                        {errorDetails.length > 0 && (
                            <ul className="list-disc list-inside mt-1 text-xs space-y-0.5">
                                {errorDetails.map((d, i) => <li key={i}>{d}</li>)}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SorumluUpload;