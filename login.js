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

        const { error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setMessage(`Giriş hatası: ${error.message}`);
        } else {
            // signInWithPassword zaten user bilgisini döndürür.
            // Eğer hata yoksa, `data.user` objesi dolu olacaktır.
            const user = data.user; // signInWithPassword'dan dönen user objesini kullan
            if (user) { // user null değilse devam et
                setMessage('Başarıyla giriş yapıldı! Yönlendiriliyorsunuz...');
                const { data: profile, error: profileError } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('id', user.id)
                    .single();

                if (profileError) {
                    console.error('Profil bilgisi çekilirken hata:', profileError);
                    setMessage('Profil bilgisi alınamadı. Lütfen tekrar deneyin.');
                    await supabase.auth.signOut(); // Hata durumunda çıkış yap
                } else if (!profile) { // Profil bulunamadıysa
                    setMessage('Kullanıcı profili bulunamadı. Lütfen yöneticinizle iletişime geçin.');
                    await supabase.auth.signOut();
                } else if (profile.rol === 'admin') {
                    router.replace('/admin/dashboard'); // Giriş sonrası geri tuşuyla login sayfasına dönmeyi engelle
                } else if (profile.rol === 'koordinator') {
                    router.replace('/coordinator/dashboard'); // Giriş sonrası geri tuşuyla login sayfasına dönmeyi engelle
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