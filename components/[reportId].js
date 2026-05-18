import Layout from '../../../components/Layout';
import ReportReview from '../../../components/ReportReview';
import { supabase } from '../../../lib/supabaseClient'; // Paylaşılan client-side istemci
import { createClient as createAdminClient } from '@supabase/supabase-js'; // Sunucu tarafı için
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function ReportDetailPage({ report, pdfUrl }) {
    const handleUpdateReportStatus = async (reportId, status, correctionNote = null) => {
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            console.error("Oturum bulunamadı, rapor durumu güncellenemiyor.");
            return { success: false, message: "Oturum bulunamadı." };
        }
        const token = session.access_token;

        const response = await fetch('/api/update-report-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reportId, status, correctionNote }),
        });
        return await response.json();
    };

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
        <Layout title={`Rapor İnceleme: ${report.okul_sorumlulari.ad_soyad} - ${report.donem} ${report.ay}. Ay`}>
            <ReportReview
                report={report}
                pdfUrl={pdfUrl}
                onUpdateStatus={handleUpdateReportStatus}
            />
        </Layout>
    );
}

export async function getServerSideProps(context) {
    const { req, res } = context;
    const { reportId } = context.params;

    // Supabase istemcisini başlatın (Sadece sunucu tarafında kullanılacak)
    const supabaseAdmin = createAdminClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    // --- Koordinatör Yetkilendirme Kontrolü ---
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get: (name) => req.cookies[name],
                set: (name, value, options) => res.setHeader('Set-Cookie', serialize(name, value, options)),
                remove: (name, options) => res.setHeader('Set-Cookie', serialize(name, '', options)),
            },
        }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (!user) {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || !profile || profile?.rol !== 'koordinator') {
        console.error('Rapor inceleme yetkilendirme hatası:', profileError);
        return { redirect: { destination: '/', permanent: false } }; // Koordinatör değilse ana sayfaya yönlendir
    }
    const coordinatorId = user.id;
    // --- Yetkilendirme Kontrolü Sonu ---

    // Raporu veritabanından çek
    const { data: reportData, error: reportError } = await supabaseAdmin
        .from('raporlar')
        .select(`
            *,
            okul_sorumlulari(
                id,
                ilce_adi,
                ad_soyad,
                okul_adi
            )
        `)
        .eq('id', reportId)
        .single();

    if (reportError || !reportData) {
        console.error('Rapor çekilirken hata:', reportError);
        return { props: { report: null, pdfUrl: null } };
    }

    // --- Raporun Koordinatöre Ait Olup Olmadığını Kontrol Et ---
    const { data: assignmentCheck, error: assignmentCheckError } = await supabaseAdmin
        .from('koordinator_sorumluluklari')
        .select('id')
        .eq('koordinator_id', coordinatorId)
        .eq('sorumlu_id', reportData.sorumlu_id)
        .single();

    if (assignmentCheckError || !assignmentCheck) {
        console.error('Koordinatörün bu rapora erişim yetkisi yok:', assignmentCheckError);
        return { props: { report: null, pdfUrl: null } }; // Yetkisiz erişim
    }
    // --- Rapor Aitlik Kontrolü Sonu ---

    // PDF için imzalı URL oluştur (geçici ve güvenli erişim için)
    const { data: signedUrlData } = await supabaseAdmin.storage.from('raporlar').createSignedUrl(reportData.pdf_storage_path, 3600); // 1 saat geçerli

    return { props: { report: reportData, pdfUrl: signedUrlData?.signedUrl || null } };
}