import React, { useState } from 'react';
import { ArrowUpTrayIcon, CheckCircleIcon, ExclamationCircleIcon, UserCircleIcon, IdentificationIcon, ArrowPathIcon } from '@heroicons/react/24/solid';

/**
 * Okul Sorumlusunun kimlik doğrulama ve rapor yükleme formunu içeren React bileşeni.
 */
const ReportUploadForm = () => {
    // Form state'leri
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
                body: JSON.stringify({ adSoyad, kurumKodu }),
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
            <div className="card max-w-md mx-auto text-center p-10 mt-12 border-t-4 border-t-green-500">
                <CheckCircleIcon className="h-12 w-12 text-green-500 mx-auto mb-4" />
                <h2 className="heading-2">Rapor Başarıyla Yüklendi!</h2>
                <p className="text-slate-500 mt-2">Raporunuz yapay zeka analizine alındı. İşleminiz tamamlanmıştır, teşekkür ederiz.</p>
            </div>
        );
    }

    return (
        <div className="card max-w-lg mx-auto p-6 sm:p-8 mt-10 border-t-4 border-t-indigo-600">
            <div className="text-center mb-8">
                <h1 className="heading-2 mb-2">YEĞİTEK Rapor Yükleme</h1>
                <p className="text-sm text-slate-500">Rapor yüklemek için bilgilerinizi doğrulayın.</p>
            </div>

            {status !== 'verified' ? (
                <form onSubmit={handleVerify} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kurum Kodunuz</label>
                        <input type="text" placeholder="Örn: 123456" value={kurumKodu} onChange={(e) => setKurumKodu(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Adınız Soyadınız</label>
                        <input type="text" placeholder="Örn: Ahmet Yılmaz" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <button type="submit" disabled={status === 'verifying'} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
                        {status === 'verifying' ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Doğrulanıyor...</> : <><IdentificationIcon className="h-5 w-5" /> Bilgileri Doğrula</>}
                    </button>
                </form>
            ) : (
                <form onSubmit={handleUpload} className="space-y-5 animate-fade-in">
                    <div className="p-3 bg-green-50 border border-green-200 rounded-md text-center">
                        <UserCircleIcon className="h-6 w-6 text-green-600 mx-auto mb-1" />
                        <p className="font-semibold text-green-800">Merhaba, {verifiedSorumlu.adSoyad}</p>
                        <p className="text-sm text-green-700">Kimliğiniz doğrulandı. Lütfen raporunuzu yükleyin.</p>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Dönem</label>
                            <select value={donem} onChange={(e) => setDonem(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                <option>2025-2026 1. Dönem</option>
                                <option>2025-2026 2. Dönem</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Ay</label>
                            <select value={ay} onChange={(e) => setAy(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none">
                                {Array.from({ length: 12 }, (_, i) => i + 1).map(month => (
                                    <option key={month} value={month}>{month}. Ay</option>
                                ))}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">PDF Rapor Dosyası</label>
                        <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-300 border-dashed rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors">
                            <div className="space-y-1 text-center">
                                <ArrowUpTrayIcon className="mx-auto h-10 w-10 text-gray-400" />
                                <div className="flex text-sm text-gray-600">
                                    <label htmlFor="file-upload" className="relative cursor-pointer font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none">
                                        <span>Dosya seçin</span>
                                        <input id="file-upload" name="file-upload" type="file" className="sr-only" accept=".pdf" onChange={(e) => setFile(e.target.files[0])} />
                                    </label>
                                </div>
                                <p className="text-xs text-slate-500">{file ? <span className="font-semibold text-indigo-600">{file.name}</span> : 'PDF formatında (Maks. 10MB)'}</p>
                            </div>
                        </div>
                    </div>
                    <button type="submit" disabled={status === 'uploading'} className="btn-primary w-full mt-4 flex items-center justify-center gap-2">
                        {status === 'uploading' ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Yükleniyor...</> : <><ArrowUpTrayIcon className="h-5 w-5" /> Raporu Yükle</>}
                    </button>
                </form>
            )}

            {status === 'error' && (
                <div className="mt-6 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2" />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
            )}
        </div>
    );
};

export default ReportUploadForm;