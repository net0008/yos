// components/Layout.js
import React from 'react';
import Link from 'next/link';

const Layout = ({ children, title = 'YEĞİTEK Rapor Sistemi' }) => {
    return (
        <div className="min-h-screen bg-gray-100">
            <header className="bg-indigo-600 text-white p-4 shadow-md">
                <nav className="container mx-auto flex justify-between items-center">
                    <Link href="/" className="text-2xl font-bold">
                        YEĞİTEK
                    </Link>
                    <div className="space-x-4">
                        {/* Rol bazlı navigasyon linkleri buraya eklenebilir */}
                        {/* <Link href="/admin/dashboard" className="hover:text-indigo-200">Admin</Link> */}
                        {/* <Link href="/coordinator/dashboard" className="hover:text-indigo-200">Koordinatör</Link> */}
                    </div>
                </nav>
            </header>
            <main className="container mx-auto py-8">
                {children}
            </main>
        </div>
    );
};

export default Layout;