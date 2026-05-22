import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../lib/supabaseClient';
import { ArrowLeftOnRectangleIcon, UserCircleIcon } from '@heroicons/react/24/outline';

const roleLabel = (rol) => {
    if (rol === 'admin') return 'Yönetici';
    if (rol === 'koordinator') return 'Koordinatör';
    return rol || '';
};

const Layout = ({ children, title = 'YEĞİTEK Okul Sorumlusu Rapor İnceleme Sistemi' }) => {
    const router = useRouter();
    const [session, setSession] = useState(null);
    const [profile, setProfile] = useState(null);

    useEffect(() => {
        const fetchProfile = async (session) => {
            if (!session?.access_token) { setProfile(null); return; }
            try {
                const res = await fetch('/api/get-my-role', {
                    headers: { Authorization: `Bearer ${session.access_token}` },
                });
                if (res.ok) {
                    const data = await res.json();
                    setProfile(data);
                } else {
                    setProfile(null);
                }
            } catch (_) { setProfile(null); }
        };

        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            fetchProfile(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
            fetchProfile(session);
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
                <meta name="description" content="YEĞİTEK Okul Sorumlusu aylık faaliyet raporlarının yapay zeka destekli inceleme ve takip sistemi." />
                <link rel="icon" href="/favicon.ico" />
            </Head>

            <div className="min-h-screen bg-slate-50 text-slate-900 font-sans flex flex-col">
                {/* ── HEADER ── */}
                <header className="bg-indigo-700 text-white shadow-lg sticky top-0 z-50">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                        <div className="flex items-center justify-between h-16 gap-4">

                            {/* SOL — Sistem adı + anasayfaya link */}
                            <Link
                                href="/"
                                className="flex-shrink-0 flex items-center transition-opacity hover:opacity-80"
                                title="Anasayfaya Git"
                            >
                                <img 
                                    src="/images/logo.png" 
                                    alt="YEĞİTEK Okul Sorumlusu Rapor İnceleme Sistemi" 
                                    className="h-10 sm:h-12 w-auto object-contain"
                                />
                            </Link>

                            {/* ORTA — Sayfa başlığı */}
                            <div className="absolute left-1/2 -translate-x-1/2 text-center pointer-events-none hidden lg:block">
                                <h1 className="text-lg xl:text-xl font-bold tracking-wide text-white drop-shadow-sm">
                                    YEĞİTEK Okul Sorumlusu Rapor İnceleme Sistemi
                                </h1>
                            </div>

                            {/* SAĞ — Kullanıcı bilgisi + Çıkış */}
                            <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
                                {session && profile && (
                                    <div className="hidden sm:flex flex-col items-end leading-tight">
                                        <span className="text-sm font-semibold text-white truncate max-w-[160px]">
                                            {profile.ad_soyad}
                                        </span>
                                        <span className="text-xs text-indigo-300 font-medium">
                                            {roleLabel(profile.rol)}
                                        </span>
                                    </div>
                                )}
                                {session && profile && (
                                    <UserCircleIcon className="h-8 w-8 text-indigo-300 hidden sm:block flex-shrink-0" />
                                )}
                                {session && (
                                    <button
                                        onClick={handleLogout}
                                        className="flex items-center gap-1.5 text-sm font-medium text-white hover:text-red-200 transition-colors bg-indigo-600/60 hover:bg-red-600/80 px-3 py-1.5 rounded-md border border-indigo-500 hover:border-red-400 shadow-sm"
                                        title="Güvenli Çıkış Yap"
                                    >
                                        <ArrowLeftOnRectangleIcon className="h-5 w-5 flex-shrink-0" />
                                        <span className="hidden sm:inline">Çıkış</span>
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </header>

                {/* ── MAIN ── */}
                <main className="flex-1 max-w-7xl w-full mx-auto py-8 px-4 sm:px-6 lg:px-8">
                    {children}
                </main>

                {/* ── FOOTER ── */}
                <footer className="bg-indigo-800 text-indigo-200 mt-auto">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-col sm:flex-row items-center justify-center gap-1 text-sm text-center">
                        <span>© 2026 Hasbi Erdoğmuş. Tüm hakları saklıdır.</span>
                        <span className="hidden sm:inline text-indigo-500">·</span>
                        <a
                            href="https://hasbierdogmus.com.tr"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-indigo-300 hover:text-white font-medium transition-colors underline underline-offset-2"
                        >
                            hasbierdogmus.com.tr
                        </a>
                    </div>
                </footer>
            </div>
        </>
    );
};

export default Layout;
