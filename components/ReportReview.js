// components/ReportReview.js
import React, { useState } from 'react';
// Bu bileşen, ikonları göstermek için @heroicons/react kütüphanesini kullanır.
// Projenize eklemek için: npm install @heroicons/react
import { CheckCircleIcon, XCircleIcon, ExclamationTriangleIcon, InformationCircleIcon } from '@heroicons/react/24/solid';
import { useRouter } from 'next/router';

/**
 * Koordinatörün rapor inceleme arayüzünü oluşturan React bileşeni.
 * @param {object} props - Bileşen propları.
 * @param {object} props.report - 'raporlar' tablosundan gelen, AI analiz sonucunu da içeren rapor nesnesi.
 * @param {string} props.pdfUrl - Supabase Storage'dan alınan, PDF'i güvenli bir şekilde görüntülemek için oluşturulmuş imzalı URL.
 */
const ReportReview = ({ report, pdfUrl, onUpdateStatus }) => {
    // `ai_analiz_sonucu` alanını daha kolay erişim için bir değişkene ata
    const [correctionNote, setCorrectionNote] = useState(report?.koordinator_notu || '');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();

    const analysis = report?.ai_analiz_sonucu;

    if (!report) {
        return <div className="flex items-center justify-center h-screen">Rapor bilgisi yükleniyor...</div>;
    }

    return (
        <div className="flex flex-col lg:flex-row gap-6 p-4 bg-gray-50 min-h-screen font-sans">
            {/* Sol Taraf: PDF Görüntüleyici */}
            <div className="lg:w-1/2 xl:w-2/3 h-[90vh] flex flex-col">
                <div className="mb-2">
                    <button onClick={() => router.back()} className="text-indigo-600 hover:text-indigo-800 text-sm mb-2 flex items-center font-medium transition-colors">
                        <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"></path></svg>
                        Geri Dön
                    </button>
                    <h2 className="text-xl font-bold text-gray-800">Rapor Önizleme</h2>
                    <p className="text-sm text-gray-600">
                        {report.okul_sorumlulari.ad_soyad} - {report.okul_sorumlulari.okul_adi || report.okul_sorumlulari.ilce_adi}
                    </p>
                </div>
                <div className="flex-grow border rounded-lg bg-white shadow-sm overflow-hidden">
                    {pdfUrl ? (
                        <iframe src={pdfUrl} className="w-full h-full" title="Rapor PDF" />
                    ) : (
                        <div className="flex items-center justify-center h-full text-gray-500">
                            PDF önizlemesi yüklenemedi.
                        </div>
                    )}
                </div>
            </div>

            {/* Sağ Taraf: Analiz ve Eylemler */}
            <div className="lg:w-1/2 xl:w-1/3 h-[90vh] overflow-y-auto pr-2">
                <h2 className="text-xl font-bold mb-2 text-gray-800">AI Analiz Sonuçları ve Eylemler</h2>
                {!analysis ? (
                    <div className="p-4 border rounded-lg bg-white shadow-sm text-center text-gray-600">
                        Bu rapor için henüz bir AI analizi bulunmuyor veya analiz devam ediyor.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {/* Genel Durum */}
                        <div className="p-4 border rounded-lg bg-white shadow-sm">
                            <h3 className={`font-bold text-lg mb-2 ${analysis.genel_durum === 'UYGUN' ? 'text-green-600' : 'text-red-600'}`}>
                                Genel Durum: {analysis.genel_durum}
                            </h3>
                            <p className="text-gray-600">{analysis.analiz_ozeti}</p>
                        </div>

                        {/* Kontrol Listesi */}
                        <div className="p-4 border rounded-lg bg-white shadow-sm">
                            <h3 className="font-bold text-lg mb-2">Analiz Kontrol Listesi</h3>
                            <ul className="space-y-3">
                                {analysis.kontrol_listesi?.map((item, index) => (
                                    <li key={index} className="flex items-start">
                                        {item.durum === 'UYGUN' ? (
                                            <CheckCircleIcon className="h-6 w-6 text-green-500 mr-3 mt-0.5 flex-shrink-0" />
                                        ) : (
                                            <XCircleIcon className="h-6 w-6 text-red-500 mr-3 mt-0.5 flex-shrink-0" />
                                        )}
                                        <div>
                                            <p className="font-semibold text-gray-800">{item.kriter}</p>
                                            <p className="text-sm text-gray-500">{item.aciklama}</p>
                                        </div>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        {/* Görev Kapsamı Analizi */}
                        {analysis.gorev_kapsami_analizi?.kapsam_disi_faaliyetler?.length > 0 && (
                            <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                                <h3 className="font-bold text-lg mb-2 flex items-center"><ExclamationTriangleIcon className="h-5 w-5 mr-2 text-yellow-600" />Görev Kapsamı Dışı Faaliyetler</h3>
                                <ul className="list-disc list-inside space-y-1 text-yellow-800">
                                    {analysis.gorev_kapsami_analizi.kapsam_disi_faaliyetler.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                                <p className="text-sm text-yellow-700 mt-2">{analysis.gorev_kapsami_analizi.aciklama}</p>
                            </div>
                        )}

                        {/* Sıradışı Durumlar */}
                        {analysis.siradisi_durumlar?.length > 0 && (
                            <div className="p-4 border rounded-lg bg-blue-50 border-blue-200">
                                <h3 className="font-bold text-lg mb-2 flex items-center"><InformationCircleIcon className="h-5 w-5 mr-2 text-blue-600" />Tespit Edilen Sıradışı Durumlar</h3>
                                <ul className="list-disc list-inside space-y-1 text-blue-800">
                                    {analysis.siradisi_durumlar.map((item, index) => (
                                        <li key={index}>{item}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        {/* Eylemler */}
                        <div className="p-4 border rounded-lg bg-white shadow-sm">
                            <h3 className="font-bold text-lg mb-2">Koordinatör Eylemleri</h3>
                            <div className="space-y-3">
                                <textarea
                                    className="w-full p-2 border rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                                    rows="3"
                                    placeholder="Raporla ilgili yorumunuzu veya düzeltme talebinizi buraya yazın..."
                                    value={correctionNote}
                                    onChange={(e) => setCorrectionNote(e.target.value)}
                                    disabled={isSubmitting}
                                ></textarea>
                                <div className="flex flex-col sm:flex-row gap-3">
                                    <button
                                        onClick={async () => {
                                            setIsSubmitting(true);
                                            setMessage('');
                                            const result = await onUpdateStatus(report.id, 'duzeltme_istendi', correctionNote);
                                            if (result.success) {
                                                setMessage('Düzeltme talebi başarıyla gönderildi.');
                                                router.push('/coordinator/dashboard'); // Dashboard'a geri dön
                                            } else {
                                                setMessage(`Hata: ${result.message}`);
                                            }
                                            setIsSubmitting(false);
                                        }}
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-2 text-white bg-red-600 rounded-md hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500">
                                        Düzeltme İste
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setIsSubmitting(true);
                                            setMessage('');
                                            const result = await onUpdateStatus(report.id, 'onaylandi');
                                            if (result.success) {
                                                setMessage('Rapor başarıyla onaylandı.');
                                                router.push('/coordinator/dashboard'); // Dashboard'a geri dön
                                            } else {
                                                setMessage(`Hata: ${result.message}`);
                                            }
                                            setIsSubmitting(false);
                                        }}
                                        disabled={isSubmitting}
                                        className="w-full px-4 py-2 text-white bg-green-600 rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500">
                                        Manuel Olarak Onayla
                                    </button>
                                </div>
                            </div>
                            {message && <p className={`mt-4 text-sm ${message.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default ReportReview;