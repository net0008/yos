import React from 'react';
import Layout from '../../components/Layout';
import CoordinatorDashboard from '../../components/CoordinatorDashboard';
import { useRouter } from 'next/router';
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function CoordinatorDashboardPage({ reports }) {
    const router = useRouter();

    // Rapor detayına (İncele) gitmek için yönlendirme fonksiyonu
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

    if (!user) {
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
        // 1. Koordinatöre atanan okul sorumlularını bul
        const { data: assignments } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .select('sorumlu_id')
            .eq('koordinator_id', user.id);

        const sorumluIds = (assignments || []).map(a => a.sorumlu_id);
        let reportsData = [];

        if (sorumluIds.length > 0) {
            // 2. Bu sorumlulara ait tüm raporları çek
            const { data: reports } = await supabaseAdmin
                .from('raporlar')
                .select('id, status, donem, ay, created_at, okul_sorumlulari(ad_soyad, okul_adi, ilce_adi)')
                .in('sorumlu_id', sorumluIds)
                .order('created_at', { ascending: false });

            if (reports) reportsData = reports;
        }

        return { props: { reports: reportsData } };
    } catch (error) {
        console.error('Koordinatör dashboard veri çekme hatası:', error.message);
        return { props: { reports: [] } };
    }
}