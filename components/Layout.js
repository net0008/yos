import React from 'react';
import Head from 'next/head';
import Link from 'next/link';

const Layout = ({ children, title = 'YEĞİTEK Rapor Sistemi' }) => {
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
