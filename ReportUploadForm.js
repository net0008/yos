// components/ReportUploadForm.js
import React, { useState } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, UserCircleIcon } from '@heroicons/react/24/solid';

/**
 * Okul Sorumlusunun kimlik doğrulama ve rapor yükleme formunu içeren React bileşeni.
 */
const ReportUploadForm = () => {
    // Form state'leri
    const [ilce, setIlce] = useState('');
    const [adSoyad, setAdSoyad] = useState('');
    const [kurumKodu, setKurumKodu] = useState('');
    const [donem, setDonem] = useState('2025-2026 1. Dönem'); // Örnek dönem
    const [ay, setAy] = useState(new Date().getMonth() + 1); // Mevcut ay
    const [file, setFile] = useState(null);

    // Arayüz durum state'leri
    const [status, setStatus] = useState('idle'); // idle, verifying, verified, uploading, success, error
    const [errorMessage, setErrorMessage] = useState('');
    const [verifiedSorumlu, setVerifiedSorumlu] = useState(null);

    const handleVerify = async (e) => {
        e.preventDefault();
        setStatus('verifying');
        setErrorMessage('');

        try {
            const response = await fetch('/api/verify-sorumlu', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ilce, adSoyad, kurumKodu }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Doğrulama sırasında bir hata oluştu.');
            }

            setVerifiedSorumlu({ id: data.sorumluId, adSoyad: data.adSoyad });
            setStatus('verified');
        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
        }
    };

    const handleUpload = async (e) => {
        e.preventDefault();
        if (!file) {
            setErrorMessage('Lütfen bir PDF dosyası seçin.');
            return;
        }
        setStatus('uploading');
        setErrorMessage('');

        const formData = new FormData();
        formData.append('sorumluId', verifiedSorumlu.id);
        formData.append('donem', donem);
        formData.append('ay', ay);
        formData.append('report', file);

        try {
            const response = await fetch('/api/upload-report', {
                method: 'POST',
                body: formData,
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'Yükleme sırasında bir hata oluştu.');
            }

            setStatus('success');
        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
        }
    };

    if (status === 'success') {
        return (
            <div className="max-w-md mx-auto text-center p-8 bg-white rounded-lg shadow-lg mt-10">
                <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
                <h2 className="text-2xl font-bold text-gray-800">Rapor Başarıyla Yüklendi!</h2>
                <p className="text-gray-600 mt-2">Raporunuz sisteme başarıyla kaydedilmiştir. Teşekkür ederiz.</p>
            </div>
        );
    }

    return (
        <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
            <h1 className="text-2xl font-bold text-center mb-6">YEĞİTEK Rapor Yükleme Sistemi</h1>

            {status !== 'verified' ? (
                <form onSubmit={handleVerify} className="space-y-4">
                    <h2 className="font-semibold text-gray-700">Lütfen Bilgilerinizi Girin</h2>
                    <div>
                        <label className="block text-sm font-medium text-gray-600">İlçe Adı</label>
                        <input type="text" value={ilce} onChange={(e) => setIlce(e.target.value)} required className="w-full p-2 border rounded-md mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600">Adınız Soyadınız</label>
                        <input type="text" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} required className="w-full p-2 border rounded-md mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600">Kurum Kodu</label>
                        <input type="text" value={kurumKodu} onChange={(e) => setKurumKodu(e.target.value)} required className="w-full p-2 border rounded-md mt-1" />
                    </div>
                    <button type="submit" disabled={status === 'verifying'} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                        {status === 'verifying' ? 'Doğrulanıyor...' : 'Bilgileri Doğrula'}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleUpload} className="space-y-4">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md text-center">
                        <UserCircleIcon className="h-8 w-8 text-green-600 mx-auto mb-1" />
                        <p className="font-semibold text-green-800">Merhaba, {verifiedSorumlu.adSoyad}</p>
                        <p className="text-sm text-green-700">Kimliğiniz doğrulandı. Lütfen raporunuzu yükleyin.</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-600">Dönem</label>
                            <select value={donem} onChange={(e) => setDonem(e.target.value)} className="w-full p-2 border rounded-md mt-1">
                                <option>2025-2026 1. Dönem</option>
                                <option>2025-2026 2. Dönem</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-600">Ay</label>
                            <select value={ay} onChange={(e) => setAy(e.target.value)} className="w-full p-2 border rounded-md mt-1">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                    <option key={month} value={month}>{month}. Ay</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-600">PDF Rapor Dosyası</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
                            <div className="space-y-1 text-center">
                                <ArrowUpTrayIcon className="mx-auto h-12 w-12 text-gray-400" />
                                <div className="flex text-sm text-gray-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                        <span>Dosya seçin</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
                                    </label>
                                </div>
                                <p className="text-xs text-gray-500">{file ? file.name : 'PDF, en fazla 10MB'}</p>
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={status === 'uploading'} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                        {status === 'uploading' ? 'Yükleniyor...' : 'Raporu Yükle'}
                    </button>
                </form>
            )}

            {status === 'error' && (
                <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
            )}
        </div>
    );
};

export default ReportUploadForm;