// pages/index.js
import Layout from '../components/Layout';
import Link from 'next/link';

export default function Home() {
    return (
        <Layout title="Ana Sayfa">
            <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                <h1 className="text-4xl font-bold text-gray-800 mb-4">YEĞİTEK Rapor Yönetim Sistemine Hoş Geldiniz</h1>
                <p className="text-lg text-gray-600 mb-8">Lütfen rolünüze uygun sayfaya gidin veya giriş yapın.</p>
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                    <Link href="/sorumlu/upload" className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-lg font-medium">
                        Okul Sorumlusu (Rapor Yükle)
                    </Link>
                    <Link href="/auth/login" className="px-6 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 text-lg font-medium">
                        Admin / Koordinatör (Giriş Yap)
                    </Link>
                    {/* Admin ve Koordinatör giriş yaptıktan sonra kendi dashboard'larına yönlendirilecek */}
                </div>
            </div>
        </Layout>
    );
}