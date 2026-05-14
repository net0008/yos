import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeftOnRectangleIcon } from '@heroicons/react/24/outline';

const Layout = ({ children, title = 'YEĞİTEK Rapor Sistemi' }) => {
    const router = useRouter();
    const [session, setSession] = useState(null);

    useEffect(() => {
        // İlk yüklemede mevcut oturumu al
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
        });

        // Oturum değişikliklerini dinle (giriş/çıkış vb.)
        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    return (
        <>
            <Head>
                <title>{title}</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
                <link rel="icon" href="/favicon.ico" />
            </Head>
            <div className="page-bg">
                <header className="top-navbar">
                    <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8 flex items-center justify-between">
                        <Link href="/" className="nav-brand hover:text-indigo-200 transition-colors">
                            {title}
                        </Link>
                        {session && (
                            <button
                                onClick={handleLogout}
                                className="flex items-center gap-2 text-sm font-medium text-white hover:text-red-100 transition-colors bg-indigo-700/50 hover:bg-red-600/80 px-3 py-1.5 rounded-md border border-indigo-500 hover:border-red-500 shadow-sm"
                                title="Güvenli Çıkış Yap"
                            >
                                <ArrowLeftOnRectangleIcon className="h-5 w-5" />
                                <span className="hidden sm:inline">Çıkış Yap</span>
                            </button>
                        )}
                    </div>
                </header>
                <main className="container-main">
                    {children}
                </main>
            </div>
        </>
    );
};

export default Layout;
