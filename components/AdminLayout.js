// components/AdminLayout.js
import React from 'react';
import Link from 'next/link';
import Layout from './Layout'; // The main app layout

const tabs = [
    { id: 'sorumlu', name: '1. Aşama: Sorumlu Yönetimi', href: '/admin/dashboard' },
    { id: 'koordinator', name: '2. Aşama: Koordinatör Yönetimi', href: '/admin/koordinator' },
    { id: 'atama', name: '3. Aşama: Görev Dağılımı', href: '/admin/atama' },
    { id: 'ayarlar', name: '4. Aşama: Sistem Ayarları', href: '/admin/ayarlar' },
];

const AdminLayout = ({ children, activeTab }) => {
    return (
        <Layout title="Admin Paneli">
            <h1 className="text-3xl font-bold text-gray-900 mb-6">Admin Yönetim Paneli</h1>

            <div className="mb-6 border-b border-gray-200">
                <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
                    {tabs.map((tab) => (
                        <Link
                            key={tab.id}
                            href={tab.href}
                            className={`${activeTab === tab.id
                                ? 'border-indigo-500 text-indigo-600'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
                        >
                            {tab.name}
                        </Link>
                    ))}
                </nav>
            </div>

            <div className="mt-4">{children}</div>
        </Layout>
    );
};

export default AdminLayout;