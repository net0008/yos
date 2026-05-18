import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';
import CoordinatorDashboard from '../../components/CoordinatorDashboard';

export default function Dashboard() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const router = useRouter();

    useEffect(() => {
        const fetchReports = async () => {
            // 1. Oturum (Session) Kontrolü
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                router.push('/'); // Giriş yapılmamışsa ana sayfaya yönlendir
                return;
            }

            try {
                const coordinatorId = session.user.id;

                // 2. Koordinatöre atanmış okul sorumlularını bul
                const { data: assignments, error: assignError } = await supabase
                    .from('koordinator_sorumluluklari')
                    .select('sorumlu_id')
                    .eq('koordinator_id', coordinatorId);

                if (assignError) throw assignError;

                const sorumluIds = assignments.map(a => a.sorumlu_id);

                if (sorumluIds.length === 0) {
                    setReports([]);
                    setLoading(false);
                    return;
                }

                // 3. Bu sorumlulara ait raporları çek (Okul ve Sorumlu detaylarıyla)
                const { data: reportsData, error: reportsError } = await supabase
                    .from('raporlar')
                    .select(`
                        *,
                        okul_sorumlulari (ad_soyad, okul_adi, ilce_adi)
                    `)
                    .in('sorumlu_id', sorumluIds)
                    .order('created_at', { ascending: false });

                if (reportsError) throw reportsError;

                setReports(reportsData || []);
            } catch (error) {
                console.error('Raporlar yüklenirken hata:', error.message);
            } finally {
                setLoading(false);
            }
        };

        fetchReports();
    }, [router]);

    const handleReviewClick = (reportId) => {
        router.push(`/coordinator/review/${reportId}`);
    };

    return (
        <Layout title="Koordinatör Paneli">
            {loading ? (
                <div className="flex items-center justify-center h-64">
                    <p className="text-gray-500 font-medium animate-pulse">Raporlar yükleniyor, lütfen bekleyin...</p>
                </div>
            ) : (
                <CoordinatorDashboard
                    reports={reports}
                    onReviewClick={handleReviewClick}
                />
            )}
        </Layout>
    );
}