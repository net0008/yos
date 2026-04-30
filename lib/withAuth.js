// lib/withAuth.js
import { supabaseAdmin } from './supabaseAdmin';

/**
 * API rotalarını sarmalayan bir middleware.
 * Gelen istekte geçerli bir JWT olup olmadığını kontrol eder ve kullanıcının belirtilen rollerden birine sahip olup olmadığını doğrular.
 * @param {Function} handler - Yetkilendirme başarılı olduğunda çalıştırılacak asıl API handler'ı.
 * @param {string[]} allowedRoles - İzin verilen rollerin bir dizisi (örn: ['admin', 'koordinator']).
 * @returns {Function} Next.js API handler.
 */
export function withAuth(handler, allowedRoles = []) {
    return async (req, res) => {
        const token = req.headers.authorization?.split(' ')[1];

        if (!token) {
            return res.status(401).json({ message: 'Yetkilendirme başlığı (Authorization header) bulunamadı.' });
        }

        // 1. Token ile kullanıcıyı doğrula
        const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);

        if (userError || !user) {
            return res.status(401).json({ message: 'Geçersiz token veya yetkisiz erişim.' });
        }

        // 2. Kullanıcının profilini ve rolünü al
        const { data: profile, error: profileError } = await supabaseAdmin.from('profiles').select('id, rol').eq('id', user.id).single();

        if (profileError || !profile) {
            return res.status(403).json({ message: 'Kullanıcı profili bulunamadı.' });
        }

        // 3. Rol kontrolü yap
        if (allowedRoles.length > 0 && !allowedRoles.includes(profile.rol)) {
            return res.status(403).json({ message: 'Bu işlemi yapmaya yetkiniz yok.' });
        }

        // Yetkilendirme başarılı. Asıl handler'ı çalıştır ve kullanıcı bilgisini ilet.
        req.user = { ...user, ...profile };
        return handler(req, res);
    };
}