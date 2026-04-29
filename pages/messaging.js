// pages/messaging.js
import Layout from '../components/Layout';
import MessagingInterface from '../components/MessagingInterface';
import { createClient } from '@supabase/supabase-js';
import { createServerClient } from '@supabase/ssr';
import { serialize } from 'cookie';

export default function MessagingPage({ currentUser, allUsers }) {
    if (!currentUser) {
        return (
            <Layout title="Giriş Yapın">
                <div className="text-center p-8 bg-white rounded-lg shadow-lg">
                    <h1 className="text-2xl font-bold text-gray-800">Giriş Yapmanız Gerekiyor</h1>
                    <p className="text-gray-600 mt-2">Mesajlaşma özelliğini kullanmak için lütfen giriş yapın.</p>
                </div>
            </Layout>
        );
    }

    return (
        <Layout title="Mesajlaşma">
            <MessagingInterface currentUser={currentUser} allUsers={allUsers} />
        </Layout>
    );
}

export async function getServerSideProps(context) {
    // --- Yetkilendirme Kontrolü ---
    const { req, res } = context;

    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        {
            cookies: {
                get: (name) => req.cookies[name],
                set: (name, value, options) => res.setHeader('Set-Cookie', serialize(name, value, options)),
                remove: (name, options) => res.setHeader('Set-Cookie', serialize(name, '', options)),
            },
        }
    );
    const { data: { user }, error: userError } = await supabase.auth.getUser();

    if (userError || !user) {
        return { redirect: { destination: '/auth/login', permanent: false } };
    }

    // Supabase istemcisini başlatın (Sadece sunucu tarafında kullanılacak)
    const supabaseAdmin = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );

    const { data: currentUserProfile, error: profileError } = await supabaseAdmin
        .from('profiles')
        .select('id, ad_soyad, rol')
        .eq('id', user.id)
        .single();

    if (profileError || !currentUserProfile || (currentUserProfile.rol !== 'admin' && currentUserProfile.rol !== 'koordinator')) {
        console.error('Mesajlaşma yetkilendirme hatası:', profileError);
        return { redirect: { destination: '/', permanent: false } }; // Yetkisizse ana sayfaya yönlendir
    }
    const currentUser = currentUserProfile; // Giriş yapan kullanıcının profil bilgileri
    // --- Yetkilendirme Kontrolü Sonu ---

    const { data: allUsers, error: usersError } = await supabaseAdmin.from('profiles').select('id, ad_soyad, rol');

    return { props: { currentUser, allUsers: allUsers || [] } };
}