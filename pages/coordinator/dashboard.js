// pages/coordinator/dashboard.js
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import CoordinatorDashboard from '../../components/CoordinatorDashboard';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function CoordinatorDashboardPage({ sorumlular, reports }) {
    const router = useRouter();

    const handleReviewClick = (reportId) => {
        router.push(`/coordinator/review/${reportId}`);
    };

    return (
        <Layout title="Koordinatör Paneli">
            <CoordinatorDashboard sorumlular={sorumlular} reports={reports} onReviewClick={handleReviewClick} />
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
            return { props: { sorumlular: [], reports: [] } };
        }

        const sorumluIds = assignments.map((a) => a.sorumlu_id);

        // Bu sorumluların bilgilerini çek
        const { data: sorumlular, error: sorumlularError } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('id, ad_soyad, okul_adi, ilce_adi')
            .in('id', sorumluIds)
            .order('ilce_adi', { ascending: true })
            .order('okul_adi', { ascending: true });

        if (sorumlularError) throw sorumlularError;

        // Bu sorumluların raporlarını çek (okul_sorumlulari bilgisine gerek yok, sorumlu_id yeterli)
        const { data: reports, error: reportsError } = await supabaseAdmin
            .from('raporlar')
            .select(`
                id,
                donem,
                ay,
                status,
                yuklenme_tarihi,
                ai_analiz_sonucu,
                sorumlu_id
            `)
            .in('sorumlu_id', sorumluIds);

        if (reportsError) throw reportsError;

        return {
            props: {
                sorumlular: sorumlular || [],
                reports: reports || [],
            },
        };
    } catch (error) {
        console.error('Koordinatör dashboard veri çekme hatası:', error.message);
        return { props: { sorumlular: [], reports: [] } };
    }
}