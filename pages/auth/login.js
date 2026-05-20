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

    // Kullanıcı zaten giriş yapmışsa, rolüne göre direkt panele yönlendir
    useEffect(() => {
        const checkExistingSession = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (session) {
                // Rol bilgisini API üzerinden güvenli şekilde al (service role kullanır)
                try {
                    const res = await fetch('/api/get-my-role', {
                        headers: { Authorization: `Bearer ${session.access_token}` },
                    });
                    if (res.ok) {
                        const { rol } = await res.json();
                        if (rol === 'admin') router.replace('/admin/dashboard');
                        else if (rol === 'koordinator') router.replace('/coordinator/dashboard');
                    }
                } catch (_) { /* sessizce geç */ }
            }
        };
        checkExistingSession();
    }, [router]);

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setErrorMsg('');

        try {
            // 1. Auth ile giriş yap
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // 2. Rolü API üzerinden al — bu API service_role key kullanır, RLS'yi atlar
            const res = await fetch('/api/get-my-role', {
                headers: { Authorization: `Bearer ${authData.session.access_token}` },
            });

            const data = await res.json();

            if (!res.ok) {
                // Profil bulunamadı veya başka hata
                await supabase.auth.signOut();
                throw new Error(data.message || 'Kullanıcı profili bulunamadı. Sistem yöneticisiyle iletişime geçin.');
            }

            // 3. Role göre yönlendir
            if (data.rol === 'admin') {
                router.replace('/admin/dashboard');
            } else if (data.rol === 'koordinator') {
                router.replace('/coordinator/dashboard');
            } else {
                await supabase.auth.signOut();
                throw new Error('Bilinmeyen veya yetkisiz kullanıcı rolü.');
            }

        } catch (error) {
            const msg = error.message;
            setErrorMsg(
                msg === 'Invalid login credentials'
                    ? 'E-posta veya şifre hatalı!'
                    : msg
            );
            setLoading(false); // Sadece hata durumunda burada durdur
        }
        // NOT: Başarılı girişte loading=true kalır; yönlendirme tamamlanınca sayfa unmount olur
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
                            <input
                                type="email"
                                required
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="ornek@meb.gov.tr"
                                disabled={loading}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Şifre</label>
                            <input
                                type="password"
                                required
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="••••••••"
                                disabled={loading}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="btn-primary w-full flex items-center justify-center gap-2 mt-4"
                        >
                            {loading
                                ? <><ArrowPathIcon className="h-5 w-5 animate-spin" /> Giriş Yapılıyor...</>
                                : <><ArrowRightOnRectangleIcon className="h-5 w-5" /> Giriş Yap</>
                            }
                        </button>
                    </form>
                </div>
            </div>
        </Layout>
    );
}