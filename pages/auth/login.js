import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Layout from '../../components/Layout';
import { supabase } from '../../lib/supabaseClient';
import { ArrowRightOnRectangleIcon, ArrowPathIcon } from '@heroicons/react/24/outline';

export default function Login() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const router = useRouter();

    // Kullanıcı zaten giriş yapmışsa, onu rolüne göre direkt içeri al (login ekranında bekletme)
    useEffect(() => {
        const checkExistingSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                const { data: profile } = await supabase
                    .from('profiles')
                    .select('rol')
                    .eq('id', session.user.id)
                    .single();

                if (profile?.rol === 'admin') router.push('/admin/dashboard');
                else if (profile?.rol === 'koordinator') router.push('/coordinator/dashboard');
            }
        };
        checkExistingSession();
    }, [router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            // Supabase ile E-posta ve Şifre doğrulama
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Kullanıcının rolünü profil tablosundan kontrol et
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('rol')
                .eq('id', authData.user.id)
                .single();

            if (profileError) throw profileError;

            // Başarılı giriş sonrası rol bazlı Akıllı Yönlendirme
            if (profile.rol === 'admin') {
                router.push('/admin/dashboard');
            } else if (profile.rol === 'koordinator') {
                router.push('/coordinator/dashboard');
            } else {
                setErrorMsg('Bilinmeyen veya yetkisiz kullanıcı rolü.');
                await supabase.auth.signOut();
            }
        } catch (error) {
            setErrorMsg(error.message === 'Invalid login credentials' ? 'E-posta veya şifre hatalı!' : error.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Layout title="Sisteme Giriş">
            <div className="flex justify-center items-center py-12 px-4 sm:px-6 lg:px-8">
                <div className="card w-full max-w-md p-8 border-t-4 border-t-indigo-600">
                    <div className="text-center mb-8">
                        <h2 className="heading-2 mb-2">Yönetici Girişi</h2>
                        <p className="text-sm text-slate-500">Admin veya Koordinatör bilgilerinizi giriniz.</p>
                    </div>

                    {errorMsg && (
                        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-md text-center font-medium">
                            {errorMsg}
                        </div>
                    )}

                    <form onSubmit={handleLogin} className="space-y-5">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">E-posta Adresi</label>
                            <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="ornek@meb.gov.tr" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                            <input type="password" required value={password} onChange={(e) => setPassword(e.target.value)} className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none" placeholder="••••••••" />
                        </div>

                        <button type="submit" disabled={loading} className="btn-primary w-full flex items-center justify-center gap-2 mt-4">
                            {loading ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Giriş Yapılıyor...</> : <><ArrowRightOnRectangleIcon className="h-5 w-5" /> Giriş Yap</>}
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    );
}