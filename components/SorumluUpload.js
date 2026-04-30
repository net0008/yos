// components/SorumluUpload.js
import React, { useState } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, ArrowPathIcon } from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';

const SorumluUpload = () => {
    const [file, setFile] = useState(null);
    const [status, setStatus] = useState('idle'); // idle, uploading, success, error
    const [message, setMessage] = useState('');
    const [errorDetails, setErrorDetails] = useState([]);

    const handleFileChange = (e) => {
        setFile(e.target.files[0]);
        setStatus('idle');
        setMessage('');
        setErrorDetails([]);
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
        } catch (error) {
            setStatus('error');
            setMessage(error.message);
            setErrorDetails(error.details || []); // Hatadan 'details' dizisini al
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-1">Okul Sorumluları Yönetimi</h2>
            <p className="text-sm text-gray-500 mb-6">
                Okul sorumlularını Excel dosyası kullanarak sisteme toplu olarak ekleyin veya güncelleyin.
                Dosyanızın sütunları şu sırada olmalıdır: <code className="text-xs bg-gray-100 p-1 rounded">Sıra no</code>, <code className="text-xs bg-gray-100 p-1 rounded">ADI SOYADI</code>, <code className="text-xs bg-gray-100 p-1 rounded">ATAMA BRANŞI</code>, <code className="text-xs bg-gray-100 p-1 rounded">İLÇESİ</code>, <code className="text-xs bg-gray-100 p-1 rounded">KURUM KODU</code>, <code className="text-xs bg-gray-100 p-1 rounded">OKUL ADI</code>, <code className="text-xs bg-gray-100 p-1 rounded">Görevlendirme Dönemi</code>.
            </p>

            <form onSubmit={handleUpload} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-600">Excel Dosyası</label>
                    <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                        <div className="space-y-1 text-center">
                            <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
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