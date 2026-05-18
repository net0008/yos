// pages/api/upload-report.js
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin'; // Merkezi admin istemcisini kullan
import { IncomingForm } from 'formidable';
import { readFileSync, unlink } from 'fs';
import { PDFDocument } from 'pdf-lib'; // PDF okunabilirliğini kontrol etmek için
import path from 'path';

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
    uploadDir: '/tmp', // Geçici yükleme dizini
    keepExtensions: true,
    maxFileSize: 10 * 1024 * 1024, // 10MB maksimum dosya boyutu
  });

  let tempFilePath = null;

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

    tempFilePath = reportFile?.filepath;

    if (!sorumluId || !donem || !ay || !reportFile) {
      return res.status(400).json({ message: 'Tüm gerekli alanlar ve dosya sağlanmalıdır.' });
    }

    // Dosya uzantısını kontrol et
    const fileExtension = path.extname(reportFile.filepath).toLowerCase();
    if (fileExtension !== '.pdf') {
      return res.status(400).json({ message: 'Sadece PDF dosyaları yüklenebilir.' });
    }

    const fileBuffer = readFileSync(reportFile.filepath);

    // PDF okunabilirlik kontrolü
    try {
      await PDFDocument.load(fileBuffer); // PDF'i yüklemeye çalış
      // Eğer buraya kadar geldiyse, PDF okunabilir demektir.
    } catch (pdfError) {
      console.error('PDF okunabilirlik hatası:', pdfError);
      return res.status(400).json({ message: 'Yüklenen dosya bozuk veya geçerli bir PDF değil. Lütfen dosyayı kontrol edip yeniden yükleyin.' });
    }

    // Supabase Storage'a yükleme
    // Dosya yolunda (key) boşluk, nokta veya Türkçe karakter (ö, vb.) olmaması için metni güvenli hale getirelim:
    const safeDonem = donem.replace(/[^a-zA-Z0-9-]/g, '_').replace(/_+/g, '_');

    // Bucket zaten '.from("raporlar")' ile seçildiği için dosya yolunun başına tekrar 'raporlar/' yazmaya gerek yoktur.
    const storagePath = `${sorumluId}/${safeDonem}-${ay}-${Date.now()}.pdf`;
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('raporlar') // Supabase Storage'da 'raporlar' adında bir bucket oluşturmanız gerekmektedir.
      .upload(storagePath, fileBuffer, {
        contentType: 'application/pdf',
        upsert: false, // Mevcut dosyayı üzerine yazma
      });

    if (uploadError) {
      console.error('Supabase Storage yükleme hatası:', uploadError);
      return res.status(500).json({ message: `Dosya yüklenirken bir hata oluştu: ${uploadError.message}. Supabase panelinden "raporlar" isimli bir Storage (Bucket) oluşturduğunuzdan emin olun.` });
    }

    // Raporun mevcut bir RAPOR_GONDERILMEMIS kaydı olup olmadığını kontrol et
    const { data: existingReport, error: existingReportError } = await supabase
      .from('raporlar')
      .select('id')
      .eq('sorumlu_id', sorumluId)
      .eq('donem', donem)
      .eq('ay', parseInt(ay, 10))
      .eq('status', 'RAPOR_GONDERILMEMIS') // Sadece eksik olarak işaretlenmiş kaydı ara
      .single();

    let dbError;
    if (existingReport) {
      // Mevcut RAPOR_GONDERILMEMIS kaydını güncelle
      const { error } = await supabase
        .from('raporlar')
        .update({
          pdf_storage_path: uploadData.path,
          status: 'beklemede', // Yeni yüklenen raporun başlangıç durumu
          yuklenme_tarihi: new Date().toISOString(),
          ai_analiz_sonucu: null, // AI analizi yeniden yapılacağı için sıfırla
        })
        .eq('id', existingReport.id);
      dbError = error;
    } else {
      // Yeni rapor kaydı oluştur
      const { error } = await supabase
        .from('raporlar')
        .insert({
          sorumlu_id: sorumluId,
          donem: donem,
          ay: parseInt(ay, 10),
          pdf_storage_path: uploadData.path,
          status: 'beklemede', // Yeni yüklenen raporun başlangıç durumu
          yuklenme_tarihi: new Date().toISOString(),
        });
      dbError = error;
    }

    if (dbError) {
      console.error('Veritabanına kayıt ekleme hatası:', dbError);
      // Eğer veritabanı kaydı başarısız olursa, yüklenen dosyayı geri almayı düşünebilirsiniz.
      await supabase.storage.from('raporlar').remove([storagePath]);
      return res.status(500).json({ message: 'Rapor bilgileri kaydedilirken bir hata oluştu.' });
    }

    // --- İlçe bazında eksik rapor kontrolü (eğer ayın 5'inden sonra ise) ---
    const currentDay = new Date().getDate();
    const reportMonth = parseInt(ay, 10);
    const currentMonth = new Date().getMonth() + 1; // getMonth() 0-11 arası döner

    // Sadece raporun ait olduğu ayın 5'inden sonra bu kontrolü yap
    // Veya, eğer rapor geçmiş bir aya aitse (örn: Mart raporu Nisan'da yüklendi)
    // Yıl atlamalarını (Örn: Aralık raporunun Ocak ayında yüklenmesi) hesaba katmak için düzeltildi
    const isAfterDeadline = (currentMonth === reportMonth && currentDay > 5) || (currentMonth !== reportMonth);

    if (isAfterDeadline) {
      // Yükleyen sorumlunun ilçe bilgisini al
      const { data: sorumluData, error: sorumluError } = await supabase
        .from('okul_sorumlulari')
        .select('ilce_adi')
        .eq('id', sorumluId)
        .single();

      if (sorumluError || !sorumluData) {
        console.error('Sorumlu ilçe bilgisi alınamadı:', sorumluError);
        // Hata olsa bile ana işlemi kesme, sadece logla
      } else {
        const ilceAdi = sorumluData.ilce_adi;

        // Bu ilçedeki tüm okul sorumlularını al
        const { data: allSorumlularInDistrict, error: allSorumlularError } = await supabase
          .from('okul_sorumlulari')
          .select('id')
          .eq('ilce_adi', ilceAdi);

        if (allSorumlularError) {
          console.error('İlçedeki tüm sorumlular alınamadı:', allSorumlularError);
        } else {
          const allSorumluIds = allSorumlularInDistrict.map(s => s.id);

          // Bu ilçede, bu dönem ve ay için yüklenmiş (veya RAPOR_GONDERILMEMIS olmayan) raporları al
          const { data: uploadedReportsInDistrict, error: uploadedReportsError } = await supabase
            .from('raporlar')
            .select('sorumlu_id')
            .eq('donem', donem)
            .eq('ay', parseInt(ay, 10))
            .neq('status', 'RAPOR_GONDERILMEMIS'); // Sadece gerçekten yüklenmiş raporları say

          if (uploadedReportsError) {
            console.error('Yüklenmiş raporlar alınamadı:', uploadedReportsError);
          } else {
            const uploadedSorumluIds = uploadedReportsInDistrict.map(r => r.sorumlu_id);

            const missingSorumluIds = allSorumluIds.filter(id => !uploadedSorumluIds.includes(id));

            for (const missingId of missingSorumluIds) {
              // Eksik rapor kaydı zaten var mı kontrol et
              const { data: existingMissingReport, error: checkMissingError } = await supabase
                .from('raporlar')
                .select('id')
                .eq('sorumlu_id', missingId)
                .eq('donem', donem)
                .eq('ay', parseInt(ay, 10))
                .eq('status', 'RAPOR_GONDERILMEMIS')
                .single();

              if (checkMissingError && checkMissingError.code !== 'PGRST116') { // PGRST116: No rows found
                console.error('Eksik rapor kontrol hatası:', checkMissingError);
                continue;
              }

              if (!existingMissingReport) {
                // Eğer eksik rapor kaydı yoksa, yeni bir placeholder oluştur
                const { error: insertMissingError } = await supabase
                  .from('raporlar')
                  .insert({
                    sorumlu_id: missingId,
                    donem: donem,
                    ay: parseInt(ay, 10),
                    status: 'RAPOR_GONDERILMEMIS',
                    pdf_storage_path: null, // Placeholder olduğu için boş
                    yuklenme_tarihi: null, // Placeholder olduğu için boş
                  });
                if (insertMissingError) {
                  console.error(`Eksik rapor placeholder eklenirken hata oluştu (Sorumlu ID: ${missingId}):`, insertMissingError);
                }
              }
            }
          }
        }
      }
    }
    // --- İlçe bazında eksik rapor kontrolü sonu ---

    return res.status(200).json({ success: true, message: 'Rapor başarıyla yüklendi.' });
  } catch (error) {
    console.error('API hatası:', error);
    return res.status(500).json({ message: 'Beklenmedik bir hata oluştu.' });
  } finally {
    if (tempFilePath) {
      unlink(tempFilePath, (err) => {
        if (err) console.error("Geçici dosya silinirken hata oluştu:", err);
      });
    }
  }
}
