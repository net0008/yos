// pages/messaging.js
import Layout from '../components/Layout';
import MessagingInterface from '../components/MessagingInterface';
import { createClient } from '@supabase/supabase-js';

// Supabase istemcisini başlatın (Sadece sunucu tarafında kullanılacak)
const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

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
    // Gerçek bir uygulamada, kullanıcının oturum açmış ve rolünün 'admin' veya 'koordinator' olduğu burada kontrol edilmelidir.
    // const { user } = await supabaseAdmin.auth.api.getUserByCookie(context.req);
    // if (!user) {
    //     return { redirect: { destination: '/auth/login', permanent: false } };
    // }
    // const { data: currentUserProfile, error: profileError } = await supabaseAdmin.from('profiles').select('id, ad_soyad, rol').eq('id', user.id).single();
    // if (profileError || !currentUserProfile || (currentUserProfile.rol !== 'admin' && currentUserProfile.rol !== 'koordinator')) {
    //     return { redirect: { destination: '/auth/login', permanent: false } };
    // }
    const currentUser = { id: 'some-user-uuid', ad_soyad: 'Test Admin', rol: 'admin' }; // Geliştirme için geçici kullanıcı
    // --- Yetkilendirme Kontrolü Sonu ---

    const { data: allUsers, error: usersError } = await supabaseAdmin.from('profiles').select('id, ad_soyad, rol');

    return { props: { currentUser, allUsers: allUsers || [] } };
}
