// pages/api/upload-report.js
import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import { readFileSync } from 'fs';
import { PDFDocument } from 'pdf-lib'; // PDF okunabilirliğini kontrol etmek için
import path from 'path';

// Supabase istemcisini başlatın
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Formidable ile dosya yüklemeyi işlemek için Next.js body parser'ı devre dışı bırakın
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
  }

  const form = new IncomingForm({
    uploadDir: './tmp', // Geçici yükleme dizini
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB maksimum dosya boyutu
  });

  try {
    const { fields, files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const sorumluId = Array.isArray(fields.sorumluId) ? fields.sorumluId[0] : fields.sorumluId;
    const donem = Array.isArray(fields.donem) ? fields.donem[0] : fields.donem;
    const ay = Array.isArray(fields.ay) ? fields.ay[0] : fields.ay;
    const reportFile = Array.isArray(files.report) ? files.report[0] : files.report;

    if (!sorumluId || !donem || !ay || !reportFile) {
      return res.status(400).json({ message: 'Tüm gerekli alanlar ve dosya sağlanmalıdır.' });
    }

    // Dosya uzantısını kontrol et
    const fileExtension = path.extname(reportFile.filepath).toLowerCase();
    if (fileExtension !== '.pdf') {
      return res.status(400).json({ message: 'Sadece PDF dosyaları yüklenebilir.' });
    }

    // PDF okunabilirlik kontrolü
    try {
      const pdfBytes = readFileSync(reportFile.filepath);
      await PDFDocument.load(pdfBytes); // PDF'i yüklemeye çalış
      // Eğer buraya kadar geldiyse, PDF okunabilir demektir.
    } catch (pdfError) {
      console.error('PDF okunabilirlik hatası:', pdfError);
      // Geçici dosyayı sil
      await unlink(reportFile.filepath);
      return res.status(400).json({ message: 'Yüklenen dosya bozuk veya geçerli bir PDF değil. Lütfen dosyayı kontrol edip yeniden yükleyin.' });
    }

    // Supabase Storage'a yükleme
    const storagePath = `raporlar/${sorumluId}/${donem}-${ay}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('raporlar') // Supabase Storage'da 'raporlar' adında bir bucket oluşturmanız gerekmektedir.
      .upload(storagePath, readFileSync(reportFile.filepath), {
        contentType: 'application/pdf',
        upsert: false, // Mevcut dosyayı üzerine yazma
      });

    // Geçici dosyayı sil
    await unlink(reportFile.filepath);

    if (uploadError) {
      console.error('Supabase Storage yükleme hatası:', uploadError);
      return res.status(500).json({ message: 'Dosya yüklenirken bir hata oluştu.' });
    }

    // raporlar tablosuna kayıt ekleme
    const { error: dbError } = await supabase
      .from('raporlar')
      .insert({
        sorumlu_id: sorumluId,
        donem: donem, // Bu alanın `donemler` tablosundaki `id` ile eşleşmesi gerekecek
        ay: parseInt(ay, 10),
        pdf_storage_path: uploadData.path,
        // Diğer varsayılan alanlar (yuklenme_tarihi, ai_analiz_sonucu, koordinator_onayi) Supabase tarafından yönetilebilir
      });

    if (dbError) {
      console.error('Veritabanına kayıt ekleme hatası:', dbError);
      // Eğer veritabanı kaydı başarısız olursa, yüklenen dosyayı geri almayı düşünebilirsiniz.
      await supabase.storage.from('raporlar').remove([storagePath]);
      return res.status(500).json({ message: 'Rapor bilgileri kaydedilirken bir hata oluştu.' });
    }

    return res.status(200).json({ success: true, message: 'Rapor başarıyla yüklendi.' });

  } catch (error) {
    console.error('API hatası:', error);
    return res.status(500).json({ message: 'Beklenmedik bir hata oluştu.' });
  } finally {
    // Formidable'ın oluşturduğu geçici dosyaları temizlemek için ek mantık gerekebilir
    // Örneğin, 'fs/promises' modülünden 'unlink' fonksiyonunu kullanmak
    const { unlink } = await import('fs/promises');
    // Formidable'ın geçici dosyaları otomatik olarak silmesi için 'onFileEnd' veya benzeri bir hook kullanmak daha iyi olabilir.
    // Şimdilik, her durumda temizlik için bir deneme yapalım.
    // Ancak, bu kısım Formidable'ın kendi temizleme mekanizmasıyla çakışabilir veya gereksiz olabilir.
    // Genellikle 'form.parse' tamamlandığında dosyalar silinir.
  }
}
