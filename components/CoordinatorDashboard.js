// components/CoordinatorDashboard.js
import React, { useState, useMemo } from 'react';
import { MagnifyingGlassIcon, FunnelIcon, DocumentMagnifyingGlassIcon } from '@heroicons/react/24/outline';

/**
 * Rapor durumlarına göre renklendirme ve metin sağlayan yardımcı fonksiyon.
 * @param {string} status - Raporun durumu.
 * @returns {{text: string, color: string}} - Durum metni ve Tailwind CSS renk sınıfı.
 */
const getStatusStyle = (status) => {
    const styles = {
        onaylandi: { text: 'Onaylandı', color: 'bg-green-100 text-green-800' },
        reddedildi: { text: 'Reddedildi', color: 'bg-red-100 text-red-800' },
        koordinator_onayinda: { text: 'Onay Bekliyor', color: 'bg-blue-100 text-blue-800' },
        ai_incelendi: { text: 'AI İnceliyor', color: 'bg-purple-100 text-purple-800' },
        beklemede: { text: 'Yüklendi', color: 'bg-gray-100 text-gray-800' },
        RAPOR_GONDERILMEMIS: { text: 'Rapor Gönderilmemiş', color: 'bg-red-200 text-red-900 font-bold' },
        IMZA_MUHUR_EKSİK: { text: 'İmza/Mühür Eksik', color: 'bg-yellow-100 text-yellow-800' },
        FORMAT_HATALI: { text: 'Format Hatalı', color: 'bg-yellow-100 text-yellow-800' },
        // Diğer tüm durumlar için varsayılan stil
    };
    const defaultStyle = { text: status, color: 'bg-gray-100 text-gray-800' };
    return styles[status] || defaultStyle;
};

/**
 * Koordinatörün ana panelini (dashboard) oluşturan React bileşeni.
 * @param {object} props - Bileşen propları.
 * @param {object[]} props.reports - Koordinatöre atanan tüm raporların listesi. Her rapor, sorumlu bilgilerini de içermelidir.
 * @param {function} props.onReviewClick - "İncele" butonuna tıklandığında çağrılacak fonksiyon.
 */
const CoordinatorDashboard = ({ reports, onReviewClick }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');

    const filteredReports = useMemo(() => {
        return reports.filter(report => {
            const matchesSearch =
                report.okul_sorumlulari.ad_soyad.toLowerCase().includes(searchTerm.toLowerCase()) ||
                report.okul_sorumlulari.ilce_adi.toLowerCase().includes(searchTerm.toLowerCase());

            const matchesStatus = statusFilter === 'all' || report.status === statusFilter;

            return matchesSearch && matchesStatus;
        });
    }, [reports, searchTerm, statusFilter]);

    // Filtreleme için mevcut tüm durumları raporlardan al
    const allStatuses = useMemo(() => [...new Set(reports.map(r => r.status))], [reports]);

    return (
        <div className="p-4 sm:p-6 lg:p-8 bg-gray-50 min-h-screen">
            <div className="max-w-7xl mx-auto">
                <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">Koordinatör Paneli</h1>

                {/* Filtreleme ve Arama */}
                <div className="flex flex-col sm:flex-row gap-4 mb-6">
                    <div className="relative flex-grow">
                        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Sorumlu adı veya ilçe ara..."
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
                <div className="bg-white shadow-sm rounded-lg overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Adı Soyadı</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">İlçe</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rapor Dönemi</th>
                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                                    <th scope="col" className="relative px-6 py-3"><span className="sr-only">İncele</span></th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredReports.map((report) => {
                                    const { text, color } = getStatusStyle(report.status);
                                    return (
                                        <tr key={report.id}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{report.okul_sorumlulari.ad_soyad}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{report.okul_sorumlulari.ilce_adi}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{`${report.donem} - ${report.ay}. Ay`}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${color}`}>
                                                    {text}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button onClick={() => onReviewClick(report.id)} className="text-indigo-600 hover:text-indigo-900 flex items-center gap-1">
                                                    <DocumentMagnifyingGlassIcon className="h-5 w-5" /> İncele
                                                </button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default CoordinatorDashboard;