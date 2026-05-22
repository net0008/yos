// pages/sorumlu/takip.js
import Layout from '../../components/Layout';
import ReportStatusCheck from '../../components/ReportStatusCheck';
import Head from 'next/head';

export default function RaporTakipPage() {
    return (
        <Layout title="Rapor Durumu Sorgula - YEĞİTEK Rapor İnceleme Sistemi">
            <Head>
                <title>Rapor Durumu Sorgula | YEĞİTEK</title>
            </Head>
            <ReportStatusCheck />
        </Layout>
    );
}
