import Layout from '../components/Layout';
import Link from 'next/link';
import { DocumentArrowUpIcon, ChartBarIcon, ShieldCheckIcon } from '@heroicons/react/24/outline';

export default function Home() {
    return (
        <Layout title="YEĞİTEK Ana Sayfa">
            <div className="flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="text-center max-w-3xl mx-auto mb-16">
                    <h1 className="heading-1 mb-6">
                        <span className="block text-indigo-600 mb-2">YEĞİTEK</span>
                        Rapor Yönetim Sistemi
                    </h1>
                    <p className="text-lg sm:text-xl text-slate-500">
                        Okul sorumluları, koordinatörler ve yöneticiler için geliştirilmiş, yapay zeka destekli akıllı rapor analiz ve takip platformu.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 w-full max-w-6xl">
                    {/* Okul Sorumlusu Kartı */}
                    <div className="card flex flex-col items-center text-center p-8 border-t-4 border-t-indigo-500">
                        <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-indigo-50/50">
                            <DocumentArrowUpIcon className="h-8 w-8" />
                        </div>
                        <h2 className="heading-2 mb-3">Okul Sorumlusu</h2>
                        <p className="text-slate-500 mb-8 flex-grow">Aylık faaliyet raporlarınızı PDF formatında yükleyin ve durumunu takip edin.</p>
                        <Link href="/sorumlu/upload" className="btn-primary w-full">Rapor Yükle</Link>
                    </div>

                    {/* Koordinatör Kartı */}
                    <div className="card flex flex-col items-center text-center p-8 border-t-4 border-t-emerald-500">
                        <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mb-6 ring-8 ring-emerald-50/50">
                            <ChartBarIcon className="h-8 w-8" />
                        </div>
                        <h2 className="heading-2 mb-3">Koordinatör</h2>
                        <p className="text-slate-500 mb-8 flex-grow">Sorumlu olduğunuz okulların raporlarını AI analizleriyle inceleyin ve yönetin.</p>
                        <Link href="/auth/login" className="btn-outline w-full !text-emerald-700 !border-emerald-200 hover:!bg-emerald-50">Koordinatör Girişi</Link>
                    </div>

                    {/* Admin Kartı */}
                    <div className="card flex flex-col items-center text-center p-8 border-t-4 border-t-slate-800">
                        <div className="h-16 w-16 bg-slate-100 text-slate-800 rounded-full flex items-center justify-center mb-6 ring-8 ring-slate-50/50">
                            <ShieldCheckIcon className="h-8 w-8" />
                        </div>
                        <h2 className="heading-2 mb-3">Sistem Yöneticisi</h2>
                        <p className="text-slate-500 mb-8 flex-grow">Kullanıcıları yönetin, görev dağılımlarını yapın ve sistem ayarlarını yapılandırın.</p>
                        <Link href="/auth/login" className="btn-outline w-full !text-slate-700 hover:!bg-slate-100 hover:!border-slate-300">Admin Girişi</Link>
                    </div>
                </div>
            </div>
        </Layout>
    );
}
