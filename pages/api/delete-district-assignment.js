import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { supabase } from '../../lib/supabaseClient';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Yetkisiz erişim.' });

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ message: 'Geçersiz token.' });

    const { data: profile } = await supabaseAdmin.from('profiles').select('rol').eq('id', user.id).single();
    if (profile?.rol !== 'admin') return res.status(403).json({ message: 'Bu işlem için admin yetkisi gerekir.' });

    const { ilceAdi } = req.body;
    if (!ilceAdi) return res.status(400).json({ message: 'İlçe adı zorunludur.' });

    const { data: sorumlular, error: sErr } = await supabaseAdmin
      .from('okul_sorumlulari')
      .select('id')
      .eq('ilce_adi', ilceAdi);
    if (sErr) throw sErr;

    const ids = (sorumlular || []).map((s) => s.id);
    if (ids.length > 0) {
      const { error: dErr } = await supabaseAdmin
        .from('koordinator_sorumluluklari')
        .delete()
        .in('okul_sorumlusu_id', ids);
      if (dErr) throw dErr;
    }

    return res.status(200).json({ message: `${ilceAdi} eşleştirmesi silindi.` });
  } catch (error) {
    return res.status(500).json({ message: error.message || 'Sunucu hatası.' });
  }
}
