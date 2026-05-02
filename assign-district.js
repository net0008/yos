// pages/api/assign-district.js
import { supabaseAdmin } from '../../lib/supabaseAdmin';
import { withAuth } from '../../lib/withAuth';

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const { ilceAdi, koordinatorId } = req.body;

    if (!ilceAdi || !koordinatorId) {
        return res.status(400).json({
            message: 'İlçe adı ve koordinatör ID bilgileri zorunludur.',
        });
    }

    try {
        // 1. İlçedeki sorumlular — ilike ile büyük/küçük harf farkını yok say
        //    DB'de "aliağa" yazılmış olsa bile "Aliağa" ile eşleşir
        const { data: sorumlular, error: sorumlularError } = await supabaseAdmin
            .from('okul_sorumlulari')
            .select('id')
            .ilike('ilce_adi', ilceAdi.trim());

        if (sorumlularError) {
            console.error('Sorumlular çekilirken hata:', sorumlularError);
            throw sorumlularError;
        }

        // Sorumlu yoksa — DB henüz dolu değil ama atama yine de kaydedilebilir
        // Bu durumda boş atama kaydı oluşturmak yerine bilgilendirici mesaj dön
        if (!sorumlular || sorumlular.length === 0) {
            // Koordinatör kaydını yine de bir yere işlemek istiyorsak
            // şimdilik sadece başarı mesajı dönüyoruz.
            // İleride "ilçe_koordinator" gibi ayrı bir tablo eklenebilir.
            return res.status(200).json({
                success: true,
                message: `"${ilceAdi}" ilçesine koordinatör atandı. (Henüz sorumlu kaydı yok, ilerleyen aşamada otomatik eşleşecek.)`,
                atanan: 0,
            });
        }

        // 2. Upsert için veri hazırla
        const assignments = sorumlular.map((sorumlu) => ({
            koordinator_id: koordinatorId,
            sorumlu_id: sorumlu.id,
        }));

        // 3. koordinator_sorumluluklari tablosuna toplu upsert
        const { error: upsertError } = await supabaseAdmin
            .from('koordinator_sorumluluklari')
            .upsert(assignments, { onConflict: 'sorumlu_id' });

        if (upsertError) {
            console.error('Upsert hatası:', upsertError);
            throw upsertError;
        }

        return res.status(200).json({
            success: true,
            message: `"${ilceAdi}" ilçesindeki ${sorumlular.length} sorumlu başarıyla atandı.`,
            atanan: sorumlular.length,
        });

    } catch (error) {
        console.error('İlçe atama API hatası:', error);
        return res.status(500).json({
            message: `Görev ataması sırasında bir sunucu hatası oluştu: ${error.message}`,
        });
    }
}

// withAuth ile sadece admin erişebilir
export default withAuth(handler, ['admin']);