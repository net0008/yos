// components/CoordinatorDashboard.js
import React, { useState, useMemo } from 'react';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    DocumentMagnifyingGlassIcon,
    SparklesIcon,
    ArrowPathIcon,
    TrashIcon,
} from '@heroicons/react/24/outline';
import { supabase } from '../lib/supabaseClient';

/**
 * Rapor durumlarına göre renklendirme ve metin sağlayan yardımcı fonksiyon.
 */
const getStatusStyle = (status) => {
    const styles = {
        onaylandi:             { text: 'Onaylandı',          color: 'bg-green-100 text-green-800' },
        reddedildi:            { text: 'Reddedildi',         color: 'bg-red-100 text-red-800' },
        koordinator_onayinda:  { text: 'Onay Bekliyor',      color: 'bg-blue-100 text-blue-800' },
        ai_incelendi:          { text: 'AI İnceliyor',        color: 'bg-purple-100 text-purple-800' },
        beklemede:             { text: 'Yüklendi',           color: 'bg-gray-100 text-gray-800' },
        duzeltme_istendi:      { text: 'Düzeltme İstendi',   color: 'bg-orange-100 text-orange-800' },
        ai_analiz_hatasi:      { text: 'Analiz Hatası',      color: 'bg-red-100 text-red-700' },
        RAPOR_GONDERILMEMIS:   { text: 'Rapor Gönderilmemiş', color: 'bg-red-200 text-red-900 font-bold' },
        IMZA_MUHUR_EKSİK:      { text: 'İmza/Mühür Eksik',  color: 'bg-yellow-100 text-yellow-800' },
        FORMAT_HATALI:         { text: 'Format Hatalı',      color: 'bg-yellow-100 text-yellow-800' },
        ESKI_FORMAT:           { text: 'Eski Format',        color: 'bg-yellow-100 text-yellow-800' },
        GENEL_IFADE:           { text: 'Genel İfade',        color: 'bg-yellow-100 text-yellow-800' },
        BOS_BOLUM_ACIKLAMA_YOK:{ text: 'Boş Bölüm',         color: 'bg-yellow-100 text-yellow-800' },
        UST_BILGI_EKSİK_HATALI:{ text: 'Üst Bilgi Eksik',   color: 'bg-yellow-100 text-yellow-800' },
        ONAY_TARIHI_EKSİK:     { text: 'Onay Tarihi Eksik', color: 'bg-yellow-100 text-yellow-800' },
        RAPOR_OKUNMUYOR:       { text: 'Rapor Okunamıyor',  color: 'bg-red-100 text-red-800' },
    };
    return styles[status] || { text: status, color: 'bg-gray-100 text-gray-800' };
};

// Analiz tetiklenebilir durumlar
const canTriggerAnalysis = (status) =>
    ['beklemede', 'ai_analiz_hatasi', 'duzeltme_istendi'].includes(status);

const CoordinatorDashboard = ({ reports: initialReports, onReviewClick }) => {
    const [reports, setReports] = useState(initialReports);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [analyzingIds, setAnalyzingIds] = useState(new Set());
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [flashMsg, setFlashMsg] = useState('');

    const filteredReports = useMemo(() => {
        return reports.filter(report => {
            const matchesSearch =
                report.okul_sorumlulari.ad_soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                report.okul_sorumlulari.okul_adi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                report.okul_sorumlulari.ilce_adi.toLowerCase().includes(searchTerm.toLowerCase());
            const matchesStatus = statusFilter === 'all' || report.status === statusFilter;
            return matchesSearch && matchesStatus;
        });
    }, [reports, searchTerm, statusFilter]);

    const allStatuses = useMemo(() => [...new Set(reports.map(r => r.status))], [reports]);

    const handleTriggerAnalysis = async (reportId) => {
        setAnalyzingIds(prev => new Set(prev).add(reportId));
        setFlashMsg('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) { setFlashMsg('Oturum bulunamadı.'); return; }

            const res = await fetch('/api/trigger-analysis', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ reportId }),
            });
            const data = await res.json();

            if (res.ok) {
                // Analiz tamamlandı — gerçek sonucu state'e yaz
                setReports(prev =>
                    prev.map(r =>
                        r.id === reportId ? { ...r, status: data.finalStatus } : r
                    )
                );
                const durum = data.genel_durum === 'UYGUN' ? '✅ UYGUN' : data.genel_durum === 'UYGUN DEĞİL' ? '⚠️ UYGUN DEĞİL' : '🔄 İnceleniyor';
                setFlashMsg(`Analiz tamamlandı → ${durum}. Detay için "İncele" butonuna tıklayın.`);
            } else {
                setFlashMsg(`⚠️ ${data.message}`);
            }
        } catch (err) {
            setFlashMsg(`❌ Hata: ${err.message}`);
        } finally {
            setAnalyzingIds(prev => {
                const next = new Set(prev);
                next.delete(reportId);
                return next;
            });
            setTimeout(() => setFlashMsg(''), 8000);
        }
    };

    const handleDeleteReport = async (reportId) => {
        if (!window.confirm('Bu raporu silmek istediğinize emin misiniz? Bu işlem geri alınamaz.')) {
            return;
        }
        
        setDeletingIds(prev => new Set(prev).add(reportId));
        setFlashMsg('');
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const token = session?.access_token;
            if (!token) { setFlashMsg('Oturum bulunamadı.'); return; }

            const res = await fetch('/api/delete-report', {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ reportId }),
            });
            const data = await res.json();

            if (res.ok) {
                setReports(prev => prev.filter(r => r.id !== reportId));
                setFlashMsg('✅ Rapor başarıyla silindi.');
            } else {
                setFlashMsg(`⚠️ Rapor silinemedi: ${data.message}`);
            }
        } catch (err) {
            setFlashMsg(`❌ Hata: ${err.message}`);
        } finally {
            setDeletingIds(prev => {
                const next = new Set(prev);
                next.delete(reportId);
                return next;
            });
            setTimeout(() => setFlashMsg(''), 5000);
        }
    };

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Koordinatör Paneli</h1>

                {/* Flash Mesaj */}
                {flashMsg && (
                    <div className="mb-4 p-3 bg-indigo-50 border border-indigo-200 text-indigo-800 text-sm rounded-lg font-medium">
                        {flashMsg}
                    </div>
                )}

                {/* Filtreleme ve Arama */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-grow">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Sorumlu adı, okul adı veya ilçe ara..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                        />
                    </div>
                    <div className="relative">
                        <FunnelIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <select
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                            className="w-full sm:w-auto pl-10 pr-4 py-2 border rounded-md appearance-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="all">Tüm Durumlar</option>
                            {allStatuses.map(status => (
                                <option key={status} value={status}>{getStatusStyle(status).text}</option>
                            ))}
                        </select>
                    </div>
                </div>

                {/* Rapor Listesi Tablosu */}
                <div className="bg-white shadow-sm rounded-lg overflow-hidden w-full">
                    <div className="w-full">
                        <table className="w-full divide-y divide-gray-200 table-fixed">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-8">No</th>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Adı Soyadı</th>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32 lg:w-48">Okul Adı</th>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">İlçe</th>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Rapor Dönemi</th>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">Durum</th>
                                    <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">AI Sonucu</th>
                                    <th scope="col" className="relative px-2 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-40">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredReports.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="px-6 py-10 text-center text-sm text-gray-400">
                                            Gösterilecek rapor bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredReports.map((report, index) => {
                                        const { text, color } = getStatusStyle(report.status);
                                        const isAnalyzing = analyzingIds.has(report.id);
                                        const isDeleting = deletingIds.has(report.id);
                                        const showTrigger = canTriggerAnalysis(report.status);
                                        const isRaporGonderilmemis = report.status === 'RAPOR_GONDERILMEMIS';

                                        // AI Sonucu
                                        let aiResult = '—';
                                        if (report.ai_analiz_sonucu) {
                                            try {
                                                const parsed = typeof report.ai_analiz_sonucu === 'string'
                                                    ? JSON.parse(report.ai_analiz_sonucu)
                                                    : report.ai_analiz_sonucu;
                                                aiResult = parsed?.genel_durum || '—';
                                            } catch { aiResult = 'Veri Hatası'; }
                                        } else if (report.status === 'beklemede') {
                                            aiResult = 'Bekliyor';
                                        } else if (report.status === 'ai_incelendi') {
                                            aiResult = 'İşleniyor…';
                                        } else if (report.status === 'ai_analiz_hatasi') {
                                            aiResult = 'Hata';
                                        }

                                        const resultColor =
                                            aiResult === 'UYGUN' ? 'text-green-600 font-semibold' :
                                            aiResult === 'UYGUN DEĞİL' ? 'text-red-600 font-semibold' :
                                            aiResult === 'Hata' ? 'text-red-400' :
                                            'text-gray-400';

                                        return (
                                            <tr key={report.id} className="hover:bg-gray-50">
                                                <td className="px-2 py-2 whitespace-normal text-xs text-gray-500 break-words">{index + 1}</td>
                                                <td className="px-2 py-2 whitespace-normal text-xs font-medium text-gray-900 break-words">
                                                    {report.okul_sorumlulari.ad_soyad}
                                                </td>
                                                <td className="px-2 py-2 whitespace-normal text-xs text-gray-500 break-words">
                                                    {report.okul_sorumlulari.okul_adi || '—'}
                                                </td>
                                                <td className="px-2 py-2 whitespace-normal text-xs text-gray-500 break-words">
                                                    {report.okul_sorumlulari.ilce_adi}
                                                </td>
                                                <td className="px-2 py-2 whitespace-normal text-xs text-gray-500 break-words">
                                                    {`${report.donem} - ${report.ay}. Ay`}
                                                </td>
                                                <td className="px-2 py-2 whitespace-normal text-xs break-words">
                                                    <span className={`px-1.5 py-0.5 inline-flex text-[10px] sm:text-xs leading-4 font-semibold rounded-full ${color}`}>
                                                        {text}
                                                    </span>
                                                </td>
                                                <td className={`px-2 py-2 whitespace-normal text-xs break-words ${resultColor}`}>
                                                    {aiResult}
                                                </td>
                                                <td className="px-2 py-2 whitespace-normal text-right text-xs font-medium">
                                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                                        {/* Analiz Başlat butonu — sadece uygun durumlarda göster */}
                                                        {showTrigger && (
                                                            <button
                                                                onClick={() => handleTriggerAnalysis(report.id)}
                                                                disabled={isAnalyzing}
                                                                title="Yapay Zeka Analizini Başlat"
                                                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isAnalyzing
                                                                    ? <ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />
                                                                    : <SparklesIcon className="h-3.5 w-3.5" />
                                                                }
                                                                {isAnalyzing ? 'Başlatılıyor…' : 'Analiz Et'}
                                                            </button>
                                                        )}
                                                        {/* İncele butonu */}
                                                        <button
                                                            onClick={() => onReviewClick(report.id)}
                                                            disabled={isRaporGonderilmemis}
                                                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={isRaporGonderilmemis ? "Kişiye ait yüklenmiş rapor bulunmadığı için incelenemez" : "Raporu İncele"}
                                                        >
                                                            <DocumentMagnifyingGlassIcon className="h-4 w-4" /> <span className="hidden sm:inline">İncele</span>
                                                        </button>
                                                        {/* Sil butonu */}
                                                        <button
                                                            onClick={() => handleDeleteReport(report.id)}
                                                            disabled={isDeleting || isRaporGonderilmemis}
                                                            className="text-red-600 hover:text-red-900 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={isRaporGonderilmemis ? "Kişiye ait yüklenmiş rapor bulunmadığı için silinemez" : "Raporu Sil"}
                                                        >
                                                            {isDeleting ? <ArrowPathIcon className="h-4 w-4 animate-spin" /> : <TrashIcon className="h-4 w-4" />}
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoordinatorDashboard;