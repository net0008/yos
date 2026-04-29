// pages/test-supabase-config.js
import Layout from '../components/Layout';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';
import React, { useState, useEffect } from 'react';

export default function TestSupabaseConfig({ serverSideEnv, serverSideError }) {
    const [clientSideEnv, setClientSideEnv] = useState({});
    const [clientSideError, setClientSideError] = useState(null);

    useEffect(() => {
        try {
            const publicUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            const publicAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

            if (!publicUrl || !publicAnonKey) {
                throw new Error('Client-side Supabase URL veya Anon Key eksik.');
            }

            // Attempt to create a client-side Supabase client
            const clientSupabase = createClient(publicUrl, publicAnonKey);
            setClientSideEnv({
                NEXT_PUBLIC_SUPABASE_URL: publicUrl ? 'Tanımlı' : 'Tanımsız',
                NEXT_PUBLIC_SUPABASE_ANON_KEY: publicAnonKey ? 'Tanımlı' : 'Tanımsız',
                clientSupabaseInitialized: true,
            });
        } catch (err) {
            setClientSideError(err.message);
            setClientSideEnv({
                NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Tanımlı' : 'Tanımsız',
                NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Tanımlı' : 'Tanımsız',
                clientSupabaseInitialized: false,
            });
        }
    }, []);

    return (
        <Layout title="Supabase Yapılandırma Testi">
            <div className="max-w-2xl mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
                <h1 className="text-2xl font-bold text-center mb-6">Supabase Ortam Değişkeni Testi</h1>

                <div className="mb-6">
                    <h2 className="text-xl font-semibold mb-3">Sunucu Tarafı (getServerSideProps)</h2>
                    {serverSideError ? (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Hata:</strong>
                            <span className="block sm:inline"> {serverSideError}</span>
                        </div>
                    ) : (
                        <ul className="list-disc list-inside space-y-1">
                            <li><span className="font-medium">NEXT_PUBLIC_SUPABASE_URL:</span> {serverSideEnv.NEXT_PUBLIC_SUPABASE_URL}</li>
                            <li><span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span> {serverSideEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}</li>
                            <li><span className="font-medium">SUPABASE_SERVICE_ROLE_KEY:</span> {serverSideEnv.SUPABASE_SERVICE_ROLE_KEY}</li>
                            <li><span className="font-medium">Server-side Supabase Admin Client:</span> {serverSideEnv.supabaseAdminInitialized ? 'Başarılı' : 'Başarısız'}</li>
                        </ul>
                    )}
                </div>

                <div>
                    <h2 className="text-xl font-semibold mb-3">İstemci Tarafı (Tarayıcı)</h2>
                    {clientSideError ? (
                        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
                            <strong className="font-bold">Hata:</strong>
                            <span className="block sm:inline"> {clientSideError}</span>
                        </div>
                    ) : (
                        <ul className="list-disc list-inside space-y-1">
                            <li><span className="font-medium">NEXT_PUBLIC_SUPABASE_URL:</span> {clientSideEnv.NEXT_PUBLIC_SUPABASE_URL}</li>
                            <li><span className="font-medium">NEXT_PUBLIC_SUPABASE_ANON_KEY:</span> {clientSideEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY}</li>
                            <li><span className="font-medium">Client-side Supabase Client:</span> {clientSideEnv.clientSupabaseInitialized ? 'Başarılı' : 'Başarısız'}</li>
                        </ul>
                    )}
                </div>

                <p className="mt-6 text-sm text-gray-600">
                    "Tanımlı" veya "Başarılı" görmeniz beklenir. "Tanımsız" veya "Başarısız" görüyorsanız, Vercel ortam değişkenlerinizi kontrol edin.
                    `SUPABASE_SERVICE_ROLE_KEY` sadece sunucu tarafında erişilebilir olmalıdır.
                </p>
            </div>
        </Layout>
    );
}

export async function getServerSideProps(context) {
    let serverSideEnv = {
        NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Tanımlı' : 'Tanımsız',
        NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? 'Tanımlı' : 'Tanımsız',
        SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Tanımlı' : 'Tanımsız',
        supabaseAdminInitialized: false,
    };
    let serverSideError = null;

    try {
        // Test server-side Supabase Admin client initialization
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL,
            process.env.SUPABASE_SERVICE_ROLE_KEY
        );
        serverSideEnv.supabaseAdminInitialized = true;
    } catch (err) {
        serverSideError = err.message;
        serverSideEnv.supabaseAdminInitialized = false;
    }

    return {
        props: {
            serverSideEnv,
            serverSideError,
        },
    };
}