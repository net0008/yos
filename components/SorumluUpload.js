// components/SorumluUpload.js
import React, { useState, useEffect } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon, TrashIcon, UserGroupIcon } from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';

const SorumluUpload = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, loading, uploading, success, error
    const [message, setMessage] = useState('');
    const [errorDetails, setErrorDetails] = useState([]);
    const [sorumlular, setSorumlular] = useState([]);
    const [view, setView] = useState('loading'); // loading, upload, list

    // Fetch existing sorumlular on mount
    useEffect(() => {
        fetchSorumlular();
    }, []);

    const fetchSorumlular = async () => {
        setStatus('loading');
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error('Oturum bulunamadı.');

            const response = await fetch('/api/get-sorumlular', {
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.message || `Sunucudan hata kodu ${response.status} alındı.`);

            if (data.sorumlular && data.sorumlular.length > 0) {
                setSorumlular(data.sorumlular);
                setView('list');
            } else {
                setSorumlular([]);
                setView('upload');
            }
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
            setView('upload'); // If fetch fails, show upload form
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
        if (!window.confirm('Emin misiniz? Bu işlem mevcut tüm okul sorumluları listesini kalıcı olarak silecek ve geri alınamaz.')) {
            return;
        }

        setStatus('uploading'); // Re-use uploading status for loading indicator
        setMessage('Liste siliniyor...');
        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) throw new Error('Oturum bulunamadı.');

            const response = await fetch('/api/delete-all-sorumlular', {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${session.access_token}` },
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.message);

            const successMessage = data.message;
            setMessage(successMessage);
            setStatus('success');
            setSorumlular([]);
            setView('upload'); // Switch back to upload view
            // Clear success message after a few seconds
            setTimeout(() => {
                setMessage(currentMessage =>
                    currentMessage === successMessage ? '' : currentMessage
                );
            }, 3000);

        } catch (error) {
            setStatus('error');
            setMessage(error.message);
        }
    };


    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setMessage('Lütfen bir Excel (.xlsx, .xls, .csv) dosyası seçin.');
            setStatus('error');
            setErrorDetails([]);
            return;
        }
        setStatus('uploading');
        setMessage('');

        const formData = new FormData();
        formData.append('excel', file);

        try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            if (sessionError || !session) {
                throw new Error('Oturum bulunamadı. Lütfen tekrar giriş yapın.');
            }

            const response = await fetch('/api/upload-sorumlu-excel', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                const err = new Error(data.message || 'Yükleme sırasında bir hata oluştu.');
                err.details = data.errors; // API'den gelen 'errors' dizisini hataya ekle
                throw err;
            }

            setStatus('success');
            setMessage(data.message);
            setErrorDetails([]);
            setFile(null);
            fetchSorumlular(); // Refresh the list after upload
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
            setErrorDetails(error.details || []); // Hatadan 'details' dizisini al
        }
    };

    const renderContent = () => {
        if (view === 'loading') {
            return (
                <div className="flex justify-center items-center p-10">
                    <ArrowPathIcon className="h-6 w-6 animate-spin text-gray-500" />
                    <p className="ml-3 text-gray-600">Sorumlu listesi yükleniyor...</p>
                </div>
            );
        }

        if (view === 'list') {
            return (
                <div>
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h3 className="text-xl font-bold">Yüklü Okul Sorumluları ({sorumlular.length})</h3>
                            <p className="text-sm text-gray-500">Mevcut liste aşağıdadır. Yeni bir liste yüklemek için önce mevcut listeyi silmelisiniz.</p>
                        </div>
                        <button
                            onClick={handleDeleteAll}
                            disabled={status === 'uploading'}
                            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400"
                        >
                            {status === 'uploading' ? <ArrowPathIcon className="h-5 w-5 animate-spin" /> : <TrashIcon className="h-5 w-5" />}
                            Listeyi Sil
                        </button>
                    </div>
                    <div className="overflow-x-auto max-h-[60vh] border border-gray-200 rounded-lg overflow-hidden">
                        <table className="min-w-full border-collapse">
                            <thead className="bg-gray-50 sticky top-0">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Sıra No</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Adı Soyadı</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">İlçesi</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Okul Adı</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Kurum Kodu</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Branşı</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider border border-gray-200">Dönem</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white">
                                {sorumlular.map((sorumlu, index) => (
                                    <tr key={sorumlu.id} className="hover:bg-gray-50">
                                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 text-center border border-gray-200">{index + 1}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 border border-gray-200">{sorumlu.ad_soyad}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200">{sorumlu.ilce_adi}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200">{sorumlu.okul_adi}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200">{sorumlu.kurum_kodu}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200">{sorumlu.atama_bransi}</td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 border border-gray-200">{sorumlu.gorevlendirme_donemi}</td>
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
                <div className="text-center">
                    <UserGroupIcon className="mx-auto h-10 w-10 text-gray-400" />
                    <h2 className="text-2xl font-bold mt-2">Okul Sorumluları Yönetimi</h2>
                    <p className="text-sm text-gray-500 mt-1 mb-6">
                        Sistemde kayıtlı okul sorumlusu bulunmamaktadır.
                        Lütfen okul sorumlularını Excel dosyası kullanarak sisteme toplu olarak ekleyin.
                        Dosyanızın sütunları şu sırada olmalıdır: <code className="text-xs bg-gray-100 p-1 rounded">Sıra no</code>, <code className="text-xs bg-gray-100 p-1 rounded">ADI SOYADI</code>, <code className="text-xs bg-gray-100 p-1 rounded">ATAMA BRANŞI</code>, <code className="text-xs bg-gray-100 p-1 rounded">İLÇESİ</code>, <code className="text-xs bg-gray-100 p-1 rounded">KURUM KODU</code>, <code className="text-xs bg-gray-100 p-1 rounded">OKUL ADI</code>, <code className="text-xs bg-gray-100 p-1 rounded">Görevlendirme Dönemi</code>.
                    </p>
                </div>

                <form onSubmit={handleUpload} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-600">Excel Dosyası</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
                                <div className="flex text-sm text-gray-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                        <span>Dosya seçin</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".xlsx, .xls, .csv" onChange={handleFileChange} />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">{file ? file.name : 'XLSX, XLS, CSV dosyası, en fazla 5MB'}</p>
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={status === 'uploading' || !file} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400 flex items-center justify-center gap-2">
                        {status === 'uploading' ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Yükleniyor...</> : 'Listeyi Yükle ve Kaydet'}
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
                    {status === 'error' ? <ExclamationCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" /> : <CheckCircleIcon className="h-5 w-5 flex-shrink-0 mt-0.5" />}
                    <div>
                        <p className="font-semibold">{message}</p>
                        {errorDetails.length > 0 && (
                            <ul className="list-disc list-inside mt-2 text-xs space-y-1">
                                {errorDetails.map((detail, index) => (
                                    <li key={index}>{detail}</li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default SorumluUpload;