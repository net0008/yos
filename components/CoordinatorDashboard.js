// components/CoordinatorDashboard.js
import React, { useState, useMemo } from 'react';
import {
    MagnifyingGlassIcon,
    FunnelIcon,
    DocumentMagnifyingGlassIcon,
    SparklesIcon,
    ArrowPathIcon,
    TrashIcon,
    CalendarIcon
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
        RAPOR_GONDERILMEMIS:   { text: 'Rapor Gönderilmedi', color: 'bg-gray-100 text-gray-500 font-bold' },
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

const DONEMLER = [
    '2024-2025 1. Dönem',
    '2024-2025 2. Dönem',
    '2025-2026 1. Dönem',
    '2025-2026 2. Dönem',
    '2026-2027 1. Dönem',
    '2026-2027 2. Dönem',
];

const AYLAR = [
    { value: '9', label: '9 (Eylül)' },
    { value: '10', label: '10 (Ekim)' },
    { value: '11', label: '11 (Kasım)' },
    { value: '12', label: '12 (Aralık)' },
    { value: '1', label: '1 (Ocak)' },
    { value: '2', label: '2 (Şubat)' },
    { value: '3', label: '3 (Mart)' },
    { value: '4', label: '4 (Nisan)' },
    { value: '5', label: '5 (Mayıs)' },
    { value: '6', label: '6 (Haziran)' }
];

const CoordinatorDashboard = ({ sorumlular = [], reports: initialReports = [], onReviewClick }) => {
    const [reports, setReports] = useState(initialReports);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    
    // Filtreleme için varsayılan dönem ve ay. İhtiyaca göre dinamik yapılabilir.
    const [selectedDonem, setSelectedDonem] = useState('2025-2026 2. Dönem');
    const [selectedAy, setSelectedAy] = useState('9');
    
    const [analyzingIds, setAnalyzingIds] = useState(new Set());
    const [deletingIds, setDeletingIds] = useState(new Set());
    const [flashMsg, setFlashMsg] = useState('');

    // Seçili dönem ve aya göre her bir sorumlu için rapor durumunu belirler
    const mappedData = useMemo(() => {
        return sorumlular.map(sorumlu => {
            const report = reports.find(r => r.sorumlu_id === sorumlu.id && r.donem === selectedDonem && String(r.ay) === selectedAy);
            return {
                sorumlu,
                report: report || null,
                status: report ? report.status : 'RAPOR_GONDERILMEMIS'
            };
        });
    }, [sorumlular, reports, selectedDonem, selectedAy]);

    // Arama ve statü filtrelemesini uygular
    const filteredData = useMemo(() => {
        return mappedData.filter(item => {
            const matchesSearch =
                item.sorumlu.ad_soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.sorumlu.okul_adi?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                item.sorumlu.ilce_adi?.toLowerCase().includes(searchTerm.toLowerCase());
            
            const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
            
            return matchesSearch && matchesStatus;
        });
    }, [mappedData, searchTerm, statusFilter]);

    const allStatuses = useMemo(() => [...new Set(mappedData.map(d => d.status))], [mappedData]);

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
        if (!window.confirm('Bu raporu silmek istediğinize emin misiniz? Sadece rapor ve analiz silinecek, sorumlu durumu "Gönderilmedi" olarak sıfırlanacaktır.')) {
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
                // Rapor başarıyla silindiğinde, state'ten çıkarıyoruz.
                // Bu sayede o kişi için rapor bulunamayacak ve durumu RAPOR_GONDERILMEMIS (reset) olacaktır.
                setReports(prev => prev.filter(r => r.id !== reportId));
                setFlashMsg('✅ Rapor başarıyla silindi. Kişi durumu sıfırlandı.');
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
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                    <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Koordinatör Paneli</h1>
                    
                    {/* Dönem ve Ay Seçimi */}
                    <div className="flex items-center gap-3 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                        <CalendarIcon className="h-5 w-5 text-gray-400 ml-2" />
                        <select 
                            value={selectedDonem} 
                            onChange={(e) => setSelectedDonem(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer"
                        >
                            {DONEMLER.map(donem => <option key={donem} value={donem}>{donem}</option>)}
                        </select>
                        <span className="text-gray-300">|</span>
                        <select 
                            value={selectedAy} 
                            onChange={(e) => setSelectedAy(e.target.value)}
                            className="bg-transparent border-none text-sm font-medium text-gray-700 focus:ring-0 cursor-pointer"
                        >
                            {AYLAR.map(ay => <option key={ay.value} value={ay.value}>{ay.label}</option>)}
                        </select>
                    </div>
                </div>

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
                <div className="bg-white shadow-sm rounded-lg overflow-hidden w-full border border-gray-200">
                    <div className="w-full overflow-x-auto">
                        <table className="w-full divide-y divide-gray-200 min-w-[800px]">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">No</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adı Soyadı</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Okul Adı</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">İlçe</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-32">Durum</th>
                                    <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">AI Sonucu</th>
                                    <th scope="col" className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider w-48">İşlemler</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredData.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="px-6 py-10 text-center text-sm text-gray-400">
                                            Gösterilecek kişi/rapor bulunamadı.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredData.map((item, index) => {
                                        const { sorumlu, report, status } = item;
                                        const { text, color } = getStatusStyle(status);
                                        
                                        const isAnalyzing = report ? analyzingIds.has(report.id) : false;
                                        const isDeleting = report ? deletingIds.has(report.id) : false;
                                        const showTrigger = report ? canTriggerAnalysis(status) : false;
                                        const isRaporGonderilmemis = status === 'RAPOR_GONDERILMEMIS';

                                        // AI Sonucu
                                        let aiResult = '—';
                                        if (report) {
                                            if (report.ai_analiz_sonucu) {
                                                try {
                                                    const parsed = typeof report.ai_analiz_sonucu === 'string'
                                                        ? JSON.parse(report.ai_analiz_sonucu)
                                                        : report.ai_analiz_sonucu;
                                                    aiResult = parsed?.genel_durum || '—';
                                                } catch { aiResult = 'Veri Hatası'; }
                                            } else if (status === 'beklemede') {
                                                aiResult = 'Bekliyor';
                                            } else if (status === 'ai_incelendi') {
                                                aiResult = 'İşleniyor…';
                                            } else if (status === 'ai_analiz_hatasi') {
                                                aiResult = 'Hata';
                                            }
                                        }

                                        const resultColor =
                                            aiResult === 'UYGUN' ? 'text-green-600 font-semibold' :
                                            aiResult === 'UYGUN DEĞİL' ? 'text-red-600 font-semibold' :
                                            aiResult === 'Hata' ? 'text-red-400' :
                                            'text-gray-400';

                                        return (
                                            <tr key={sorumlu.id} className="hover:bg-gray-50 transition-colors">
                                                <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                                                <td className="px-4 py-3 text-sm font-medium text-gray-900">
                                                    {sorumlu.ad_soyad}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">
                                                    {sorumlu.okul_adi || '—'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">
                                                    {sorumlu.ilce_adi || '—'}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap">
                                                    <span 
                                                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${color}`}
                                                        title={status === 'ai_analiz_hatasi' ? "Yapay zeka sunucuları şu an çok yoğun. Lütfen birkaç dakika sonra 'Analiz Et' butonuna tıklayarak tekrar deneyin." : undefined}
                                                    >
                                                        {text}
                                                    </span>
                                                </td>
                                                <td className={`px-4 py-3 whitespace-nowrap text-sm ${resultColor}`}>
                                                    {aiResult}
                                                </td>
                                                <td className="px-4 py-3 whitespace-nowrap text-right text-sm font-medium">
                                                    <div className="flex items-center justify-end gap-2 flex-wrap">
                                                        {/* Analiz Başlat butonu */}
                                                        {showTrigger && report && (
                                                            <button
                                                                onClick={() => handleTriggerAnalysis(report.id)}
                                                                disabled={isAnalyzing}
                                                                title="Yapay Zeka Analizini Başlat"
                                                                className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 px-2 py-1 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            >
                                                                {isAnalyzing
                                                                    ? <ArrowPathIcon className="h-4 w-4 animate-spin" />
                                                                    : <SparklesIcon className="h-4 w-4" />
                                                                }
                                                            </button>
                                                        )}
                                                        {/* İncele butonu */}
                                                        <button
                                                            onClick={() => report && onReviewClick(report.id)}
                                                            disabled={isRaporGonderilmemis || !report}
                                                            className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1 bg-indigo-50 hover:bg-indigo-100 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={isRaporGonderilmemis ? "Rapor yüklenmemiş" : "Raporu İncele"}
                                                        >
                                                            <DocumentMagnifyingGlassIcon className="h-4 w-4" /> <span>İncele</span>
                                                        </button>
                                                        {/* Sil butonu */}
                                                        <button
                                                            onClick={() => report && handleDeleteReport(report.id)}
                                                            disabled={isDeleting || isRaporGonderilmemis || !report}
                                                            className="text-red-600 hover:text-red-900 flex items-center gap-1 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                                            title={isRaporGonderilmemis ? "Silinecek rapor yok" : "Raporu Sil"}
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