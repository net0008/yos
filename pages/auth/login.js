// pages/auth/login.js
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [messageType, setMessageType] = useState('error'); // 'error' | 'info'
    const router = useRouter();

    const showError = (msg) => {
        setMessage(msg);
        setMessageType('error');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        // 1. Kimlik doğrulama
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });

        if (error) {
            showError(`Giriş hatası: ${error.message}`);
            setLoading(false);
            return;
        }

        if (!data.user) {
            showError('Kullanıcı bilgisi alınamadı. Lütfen tekrar deneyin.');
            setLoading(false);
            return;
        }

        // 2. Profil ve rol sorgula
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', data.user.id)
            .single();

        if (profileError) {
            console.error('Profil sorgu hatası:', profileError);
            await supabase.auth.signOut();

            if (profileError.code === 'PGRST116') {
                showError(
                    'Kullanıcı profiliniz bulunamadı. ' +
                    'Lütfen yöneticinizle iletişime geçin (profiles tablosuna kayıt eklenmeli).'
                );
            } else if (profileError.code === '42501') {
                showError(
                    'Profil okuma yetkisi yok. ' +
                    'Supabase RLS politikasını kontrol edin.'
                );
            } else {
                showError(`Profil hatası: ${profileError.message}`);
            }
            setLoading(false);
            return;
        }

        if (!profile) {
            await supabase.auth.signOut();
            showError('Profil kaydı bulunamadı. Lütfen yöneticinizle iletişime geçin.');
            setLoading(false);
            return;
        }

        // 3. Role göre yönlendir
        if (profile.rol === 'admin') {
            await router.replace('/admin/dashboard');
        } else if (profile.rol === 'koordinator') {
            await router.replace('/koordinator/dashboard');
        } else {
            await supabase.auth.signOut();
            showError(`Bilinmeyen kullanıcı rolü: "${profile.rol}". Erişim yetkiniz yok.`);
            setLoading(false);
        }
        // Not: Başarılı yönlendirmede setLoading(false) çağırmıyoruz,
        // sayfa zaten değişecek. Ama yönlendirme başarısız olursa:
        setLoading(false);
    };

    return (
        <Layout title="Giriş Yap">
            <div className="w-full max-w-sm mx-auto mt-10">
                <form
                    onSubmit={handleLogin}
                    className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4"
                >
                    <div className="mb-4">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="email"
                        >
                            E-posta
                        </label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={loading}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
                        />
                    </div>
                    <div className="mb-6">
                        <label
                            className="block text-gray-700 text-sm font-bold mb-2"
                            htmlFor="password"
                        >
                            Parola
                        </label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            disabled={loading}
                            className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline disabled:bg-gray-100"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400"
                    >
                        {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>

                {message && (
                    <div
                        className={`mt-2 p-3 rounded text-sm text-center ${
                            messageType === 'error'
                                ? 'bg-red-50 border border-red-200 text-red-700'
                                : 'bg-green-50 border border-green-200 text-green-700'
                        }`}
                    >
                        {message}
                    </div>
                )}

                {/* Geliştirme ortamı debug bilgisi */}
                {process.env.NODE_ENV === 'development' && (
                    <p className="mt-4 text-center text-xs text-gray-400">
                        Supabase URL: {process.env.NEXT_PUBLIC_SUPABASE_URL ? '✓' : '✗'} |
                        Anon Key: {process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '✓' : '✗'}
                    </p>
                )}
            </div>
        </Layout>
    );
}