// pages/auth/login.js
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient';
import Layout from '../../components/Layout';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        // 1. Giriş yap
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setMessage(`Giriş hatası: ${error.message}`);
            setLoading(false);
            return;
        }

        if (!data.user) {
            setMessage('Kullanıcı bilgisi alınamadı. Lütfen tekrar deneyin.');
            setLoading(false);
            return;
        }

        // 2. Profil ve rol sorgula
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('rol')
            .eq('id', data.user.id)
            .single();

        if (profileError || !profile) {
            console.error('Profil hatası:', profileError);
            await supabase.auth.signOut();

            if (profileError?.code === 'PGRST116') {
                setMessage(
                    'Profiliniz bulunamadı. ' +
                    'Supabase Dashboard → profiles tablosuna kaydınızı ekleyin.'
                );
            } else {
                setMessage(
                    `Profil okunamadı: ${profileError?.message || 'Bilinmeyen hata'}. ` +
                    'RLS politikasını kontrol edin.'
                );
            }
            setLoading(false);
            return;
        }

        // 3. Tam sayfa yönlendirme — cookie'nin SSR tarafında görünmesi için
        //    router.replace() değil window.location.href kullanıyoruz
        if (profile.rol === 'admin') {
            window.location.href = '/admin/dashboard';
        } else if (profile.rol === 'koordinator') {
            window.location.href = '/koordinator/dashboard';
        } else {
            await supabase.auth.signOut();
            setMessage(`Bilinmeyen rol: "${profile.rol}". Erişim yetkiniz yok.`);
            setLoading(false);
        }
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
                    <div className="mt-2 p-3 rounded text-sm text-center bg-red-50 border border-red-200 text-red-700">
                        {message}
                    </div>
                )}
            </div>
        </Layout>
    );
}