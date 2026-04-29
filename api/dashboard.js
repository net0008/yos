// pages/coordinator/dashboard.js
import Layout from '../../components/Layout';
import CoordinatorDashboard from '../../components/CoordinatorDashboard';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';

// Supabase istemcisini başlatın (Sadece sunucu tarafında kullanılacak)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default function CoordinatorPanel({ reports }) {
    const router = useRouter();

    const handleReviewClick = (reportId) => {
        router.push(`/coordinator/${reportId}`);
    };

    return (
        <Layout title="Koordinatör Paneli">
            <CoordinatorDashboard reports={reports} onReviewClick={handleReviewClick} />
        </Layout>
    );
}

export async function getServerSideProps(context) {
    // --- Koordinatör Yetkilendirme Kontrolü (Örnek) ---
    const { user } = await supabaseAdmin.auth.api.getUserByCookie(context.req);

    // Kullanıcı oturum açmamışsa veya rolü koordinator değilse giriş sayfasına yönlendir
    const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('rol').eq('id', user?.id).single();

    if (profileError || !user || profile?.rol !== 'koordinator') {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const coordinatorId = user.id; // Giriş yapan koordinatörün ID'si
    // --- Yetkilendirme Kontrolü Sonu ---

    // Koordinatöre atanan okul sorumlularının ID'lerini al
    const { data: assignedSorumlular, error: assignedError } = await supabaseAdmin
        .from('koordinator_sorumluluklari')
        .select('sorumlu_id')
        .eq('koordinator_id', coordinatorId);

    if (assignedError || !assignedSorumlular) {
        console.error('Atanmış sorumlular çekilirken hata:', assignedError);
        return { props: { reports: [] } };
    }

    const sorumluIds = assignedSorumlular.map(s => s.sorumlu_id);

    // Bu sorumlulara ait raporları ve sorumlu bilgilerini çek
    const { data: reportsData, error: reportsError } = await supabaseAdmin
        .from('raporlar')
        .select('*, okul_sorumlulari(ad_soyad, ilce_adi)') // Join ile sorumlu bilgilerini de çek
        .in('sorumlu_id', sorumluIds);

    return { props: { reports: reportsData || [] } };
}