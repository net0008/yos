// pages/koordinator/dashboard.js
import Layout from '../../components/Layout';
import CoordinatorDashboard from '../../components/CoordinatorDashboard';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { useRouter } from 'next/router';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

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

    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const { data: profile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('rol')
        .eq('id', user.id)
        .single();

    if (profileError || profile?.rol !== 'koordinator') {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    const coordinatorId = user.id;

    // Koordinatöre atanan sorumluların ID'lerini al
    const { data: assignedSorumlular, error: assignedError } = await supabaseAdmin
        .from('koordinator_sorumluluklari')
        .select('sorumlu_id')
        .eq('koordinator_id', coordinatorId);

    if (assignedError || !assignedSorumlular) {
        console.error('Atanmış sorumlular çekilirken hata:', assignedError);
        return { props: { reports: [] } };
    }

    const sorumluIds = assignedSorumlular.map((s) => s.sorumlu_id);

    if (sorumluIds.length === 0) {
        return { props: { reports: [] } };
    }

    const { data: reportsData, error: reportsError } = await supabaseAdmin
        .from('raporlar')
        .select('*, okul_sorumlulari(ad_soyad, ilce_adi, okul_adi)')
        .in('sorumlu_id', sorumluIds);

    if (reportsError) {
        console.error('Raporlar çekilirken hata:', reportsError);
        return { props: { reports: [] } };
    }

    return { props: { reports: reportsData || [] } };
}