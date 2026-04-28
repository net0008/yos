// pages/auth/login.js
import React, { useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';

// Supabase istemcisini başlatın (Client tarafında kullanılacak)
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

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

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setMessage(`Giriş hatası: ${error.message}`);
        } else {
            setMessage('Başarıyla giriş yapıldı! Yönlendiriliyorsunuz...');
            // Kullanıcının rolüne göre yönlendirme yap
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('id', user.id)
                    .single();

                if (profileError || !profile) {
                    console.error('Profil bilgisi çekilirken hata:', profileError);
                    setMessage('Profil bilgisi alınamadı. Lütfen tekrar deneyin.');
                    await supabase.auth.signOut(); // Hata durumunda çıkış yap
                } else if (profile.rol === 'admin') {
                    router.push('/admin/dashboard');
                } else if (profile.rol === 'koordinator') {
                    router.push('/coordinator/dashboard');
                } else {
                    setMessage('Bilinmeyen kullanıcı rolü. Lütfen yöneticinizle iletişime geçin.');
                    await supabase.auth.signOut();
                }
            }
        }
        setLoading(false);
    };

    return (
        <Layout title="Giriş Yap">
            <div className="max-w-md mx-auto p-6 bg-white rounded-lg shadow-md mt-10">
                <h1 className="text-2xl font-bold text-center mb-6">Giriş Yap</h1>
                <form onSubmit={handleLogin} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700">E-posta</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="w-full p-2 border rounded-md mt-1" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700">Parola</label>
                        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className="w-full p-2 border rounded-md mt-1" />
                    </div>
                    <button type="submit" disabled={loading} className="w-full py-2 px-4 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                        {loading ? 'Giriş Yapılıyor...' : 'Giriş Yap'}
                    </button>
                </form>
                {message && <p className={`mt-4 text-center ${message.includes('hata') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
            </div>
        </Layout>
    );
}