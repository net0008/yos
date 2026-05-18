// pages/coordinator/dashboard.js
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import CoordinatorDashboard from '../../components/CoordinatorDashboard';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function CoordinatorDashboardPage({ reports }) {
    const router = useRouter();

    // [reportId].js yerine /coordinator/review?id=X kullanıyoruz
    // Köşeli parantezli dosya adı bazı ortamlarda 404'e neden olduğu için
    const handleReviewClick = (reportId) => {
        router.push(`/coordinator/review?id=${reportId}`);
    };

    return (
        <Layout title="Koordinatör Paneli">
            <CoordinatorDashboard reports={reports} onReviewClick={handleReviewClick} />
        </Layout>
    );
}

export async function getServerSideProps(context) {
    const { req, res } = context;

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get: (name) => req.cookies[name],
                set: (name, value, options) =>
                    res.setHeader('Set-Cookie', serialize(name, value, options)),
                remove: (name, options) =>
                    res.setHeader('Set-Cookie', serialize(name, '', options)),
            },
        }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const { data: profile } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profile?.rol !== 'koordinator') {
        return { redirect: { destination: '/', permanent: false } };
    }

    try {
        // Bu koordinatöre atanmış sorumlu ID'lerini al
        const { data: assignments, error: assignError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('sorumlu_id')
            .eq('koordinator_id', user.id);

        if (assignError) throw assignError;

        if (!assignments || assignments.length === 0) {
            return { props: { reports: [] } };
        }

        const sorumluIds = assignments.map((a) => a.sorumlu_id);

        // Bu sorumluların raporlarını, sorumlu bilgileriyle birlikte çek
        const { data: reports, error: reportsError } = await supabaseAdmin
            .from('raporlar')
            .select(`
                id,
                donem,
                ay,
                status,
                yuklenme_tarihi,
                okul_sorumlulari (
                    ad_soyad,
                    okul_adi,
                    ilce_adi
                )
            `)
            .in('sorumlu_id', sorumluIds)
            .order('yuklenme_tarihi', { ascending: false });

        if (reportsError) throw reportsError;

        return {
            props: {
                reports: reports || [],
            },
        };
    } catch (error) {
        console.error('Koordinatör dashboard veri çekme hatası:', error.message);
        return { props: { reports: [] } };
    }
}