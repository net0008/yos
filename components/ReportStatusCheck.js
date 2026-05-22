// components/ReportStatusCheck.js
import React, { useState, useEffect } from 'react';
import { IdentificationIcon, ArrowPathIcon, ExclamationCircleIcon, UserCircleIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/solid';

const getStatusStyle = (status) => {
    // Sorumlu için basitleştirilmiş görünüm (Sadece net kararlar gösterilir)
    if (status === 'onaylandi') return { text: 'Onaylandı', color: 'bg-green-100 text-green-800 border-green-200' };
    if (status === 'reddedildi') return { text: 'Reddedildi', color: 'bg-red-100 text-red-800 border-red-200' };
    if (status === 'duzeltme_istendi') return { text: 'Düzeltme İstendi', color: 'bg-orange-100 text-orange-800 border-orange-200' };
    if (status === 'RAPOR_GONDERILMEMIS') return { text: 'Gönderilmedi', color: 'bg-gray-100 text-gray-600 border-gray-200' };
    
    // Geri kalan tüm durumlar (ai_incelendi, beklemede, RAPOR_OKUNMUYOR, IMZA_EKSIK vb.) inceleniyor olarak yansır.
    return { text: 'İnceleniyor', color: 'bg-blue-100 text-blue-800 border-blue-200' };
};

const ReportStatusCheck = () => {
    const [adSoyad, setAdSoyad] = useState('');
    const [kurumKodu, setKurumKodu] = useState('');
    
    const [status, setStatus] = useState('idle'); // idle, verifying, verified, error
    const [errorMessage, setErrorMessage] = useState('');
    const [verifiedSorumlu, setVerifiedSorumlu] = useState(null);
    const [reports, setReports] = useState([]);
    const [loadingReports, setLoadingReports] = useState(false);

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
            fetchReports(data.sorumluId);
        } catch (error) {
            setStatus('error');
            setErrorMessage(error.message);
        }
    };

    const fetchReports = async (sorumluId) => {
        setLoadingReports(true);
        try {
            const res = await fetch('/api/get-sorumlu-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sorumluId })
            });
            const data = await res.json();
            if (res.ok) {
                setReports(data.reports || []);
            } else {
                setErrorMessage(data.message || 'Raporlar getirilemedi.');
            }
        } catch (error) {
            setErrorMessage('Raporlar yüklenirken bağlantı hatası oluştu.');
        } finally {
            setLoadingReports(false);
        }
    };

    const formatDate = (dateString) => {
        if (!dateString) return '—';
        const date = new Date(dateString);
        return date.toLocaleDateString('tr-TR', { day: '2-digit', month: 'long', year: 'numeric' });
    };

    return (
        <div className="card max-w-4xl mx-auto p-4 sm:p-6 lg:p-8 mt-10 border-t-4 border-t-indigo-600">
            <div className="text-center mb-8">
                <h1 className="heading-2 mb-2">Rapor Durumu Sorgulama</h1>
                <p className="text-sm text-slate-500">Daha önce yüklediğiniz raporların güncel durumunu takip edin.</p>
            </div>

            {status !== 'verified' ? (
                <form onSubmit={handleVerify} className="space-y-5 max-w-lg mx-auto">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Kurum Kodunuz</label>
                        <input type="text" placeholder="Örn: 123456" value={kurumKodu} onChange={(e) => setKurumKodu(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1">Adınız Soyadınız</label>
                        <input type="text" placeholder="Örn: Ahmet Yılmaz" value={adSoyad} onChange={(e) => setAdSoyad(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" />
                    </div>
                    <button type="submit" disabled={status === 'verifying'} className="btn-primary w-full mt-2 flex items-center justify-center gap-2">
                        {status === 'verifying' ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Doğrulanıyor...</> : <><DocumentMagnifyingGlassIcon className="h-5 w-5" /> Raporlarımı Bul</>}
                    </button>
                </form>
            ) : (
                <div className="animate-fade-in">
                    <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center justify-between flex-wrap gap-4 mb-6">
                        <div className="flex items-center gap-3">
                            <UserCircleIcon className="h-10 w-10 text-green-600 flex-shrink-0" />
                            <div>
                                <p className="text-sm text-green-600 font-medium">Hoş Geldiniz,</p>
                                <p className="text-lg font-bold text-green-800">{verifiedSorumlu.adSoyad}</p>
                            </div>
                        </div>
                        <button 
                            onClick={() => { setStatus('idle'); setVerifiedSorumlu(null); setReports([]); }}
                            className="text-sm font-medium text-indigo-600 hover:text-indigo-800 bg-white px-3 py-1.5 rounded border border-indigo-200 hover:border-indigo-300 transition-colors"
                        >
                            Farklı Kişi Sorgula
                        </button>
                    </div>

                    <h3 className="text-lg font-bold text-slate-800 mb-4 border-b pb-2">Yüklenen Raporlarım</h3>

                    {loadingReports ? (
                        <div className="text-center py-12">
                            <ArrowPathIcon className="h-8 w-8 animate-spin text-indigo-500 mx-auto mb-2" />
                            <p className="text-slate-500">Raporlarınız getiriliyor...</p>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12 bg-slate-50 rounded-lg border border-dashed border-slate-300">
                            <p className="text-slate-500 font-medium">Sisteme henüz yüklenmiş bir raporunuz bulunmuyor.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {reports.map((report) => {
                                const statusInfo = getStatusStyle(report.status);
                                
                                // Rapor henüz neticelendirilmediyse (İnceleniyor veya Gönderilmedi ise) altındaki değerlendirme notu alanı gösterilmez.
                                const isPending = statusInfo.text === 'İnceleniyor' || statusInfo.text === 'Gönderilmedi';

                                return (
                                    <div key={report.id} className="bg-white border rounded-xl shadow-sm overflow-hidden hover:shadow-md transition-shadow">
                                        <div className="p-5">
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                                <div>
                                                    <h4 className="font-bold text-lg text-slate-900">{report.donem}</h4>
                                                    <p className="text-sm text-slate-500">{report.ay}. Ay Raporu <span className="mx-2">•</span> Yükleme: {formatDate(report.created_at)}</p>
                                                </div>
                                                <span className={`px-3 py-1 inline-flex text-sm font-semibold rounded-full border ${statusInfo.color}`}>
                                                    {statusInfo.text}
                                                </span>
                                            </div>

                                            {/* Değerlendirme Notları (Sadece koordinatör mesajı) */}
                                            {!isPending && (
                                                <div className="mt-4 pt-4 border-t border-slate-100">
                                                    <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Değerlendirme Notları</h5>
                                                    
                                                    {report.koordinator_notu ? (
                                                        <div className="mb-3 p-4 bg-red-50 border-l-4 border-red-500 rounded-r-md shadow-sm">
                                                            <div className="flex items-start">
                                                                <ExclamationCircleIcon className="h-5 w-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                                                                <div>
                                                                    <h6 className="text-sm font-bold text-red-800 mb-1">Koordinatörün Düzeltme Mesajı:</h6>
                                                                    <p className="text-sm text-red-700 font-medium whitespace-pre-wrap">{report.koordinator_notu}</p>
                                                                </div>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="mb-3 p-4 bg-green-50 border-l-4 border-green-500 rounded-r-md shadow-sm">
                                                            <p className="text-sm text-green-800 font-medium">Raporunuz incelenmiş olup uygun görülmüştür.</p>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {status === 'error' && (
                <div className="max-w-lg mx-auto mt-6 p-3 bg-red-50 border border-red-200 rounded-md flex items-center">
                    <ExclamationCircleIcon className="h-5 w-5 text-red-500 mr-2 flex-shrink-0" />
                    <p className="text-sm text-red-700">{errorMessage}</p>
                </div>
            )}
        </div>
    );
};

export default ReportStatusCheck;
