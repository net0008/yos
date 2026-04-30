// pages/auth/login.js
import React, { useState } from 'react';
import { supabase } from '../../lib/supabaseClient'; // Paylaşılan istemciyi içe aktar
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const router = useRouter();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setMessage(`Giriş hatası: ${error.message}`);
            setLoading(false);
            return;
        }

        if (data.user) {
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('rol')
                .eq('id', data.user.id)
                .single();

            if (profileError || !profile) {
                console.error('Profil bilgisi çekilirken hata:', profileError);
                setMessage('Profil bilgisi alınamadı veya kullanıcı rolü tanımsız. Lütfen yöneticinizle iletişime geçin.');
                await supabase.auth.signOut(); // Hata durumunda çıkış yap
                setLoading(false);
            } else if (profile.rol === 'admin') {
                router.replace('/admin/dashboard');
            } else if (profile.rol === 'koordinator') {
                router.replace('/koordinator/dashboard'); // 'coordinator' -> 'koordinator' olarak düzeltildi.
            } else {
                setMessage('Bilinmeyen kullanıcı rolü. Bu sayfaya erişim yetkiniz yok.');
                await supabase.auth.signOut();
                setLoading(false);
            }
        } else {
            setMessage('Kullanıcı bilgisi alınamadı. Lütfen tekrar deneyin.');
            setLoading(false);
        }
    };

    return (
        <Layout title="Giriş Yap">
            <div className="w-full max-w-sm mx-auto mt-10">
                <form onSubmit={handleLogin} className="bg-white shadow-md rounded px-8 pt-6 pb-8 mb-4">
                    {/* Layout zaten bir başlık ("Giriş Yap") sağladığı için form içindeki tekrar eden başlık kaldırıldı. */}
                    <div className="mb-4">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">E-posta</label>
                        <input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline" />
                    </div>
                    <div className="mb-6">
                        <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="password">Parola</label>
                        <input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 mb-3 leading-tight focus:outline-none focus:shadow-outline" />
                    </div>
                    <div className="flex items-center justify-between">
                        <button type="submit" disabled={loading} className="w-full bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded focus:outline-none focus:shadow-outline disabled:bg-gray-400">
                            {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                        </button>
                    </div>
                </form>
                {message && <p className={`mt-4 text-center text-sm ${message.includes('hata') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
            </div>
        </Layout>
    );
}