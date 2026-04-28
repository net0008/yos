// pages/coordinator/[reportId].js
import Layout from '../../components/Layout';
import ReportReview from '../../components/ReportReview';
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın (Sadece sunucu tarafında kullanılacak)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default function ReportDetailPage({ report, pdfUrl }) {
    if (!report) {
        return (
            <Layout title="Rapor Bulunamadı">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold text-gray-800">Rapor Bulunamadı</h1>
                    <p className="text-gray-600 mt-2">İstediğiniz rapor mevcut değil veya erişim izniniz yok.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title={`Rapor İnceleme: ${report.id}`}>
            <ReportReview report={report} pdfUrl={pdfUrl} />
        </Layout>
    );
}

export async function getServerSideProps(context) {
    const { reportId } = context.params;

    // Raporu veritabanından çek
    const { data: reportData, error: reportError } = await supabaseAdmin
        .from('raporlar')
        .select('*')
        .eq('id', reportId)
        .single();

    if (reportError || !reportData) {
        console.error('Rapor çekilirken hata:', reportError);
        return { props: { report: null, pdfUrl: null } };
    }

    // PDF için imzalı URL oluştur (geçici ve güvenli erişim için)
    const { data: signedUrlData } = await supabaseAdmin.storage.from('raporlar').createSignedUrl(reportData.pdf_storage_path, 3600); // 1 saat geçerli

    return { props: { report: reportData, pdfUrl: signedUrlData?.signedUrl || null } };
}