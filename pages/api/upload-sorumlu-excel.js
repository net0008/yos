// pages/api/upload-sorumlu-excel.js
import { supabaseAdmin as supabase } from '../../lib/supabaseAdmin';
import { IncomingForm } from 'formidable';
import { readFileSync, unlink } from 'fs';
import * as XLSX from 'xlsx';
import { withAuth } from '../../lib/withAuth';

// Formidable ile dosya yüklemeyi işlemek için Next.js body parser'ı devre dışı bırakın
export const config = {
    api: {
        bodyParser: false,
    },
};

async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    const form = new IncomingForm({
        uploadDir: '/tmp',
        keepExtensions: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
    });

    let tempFilePath = null;

    try {
        const { files } = await new Promise((resolve, reject) => {
            form.parse(req, (err, fields, files) => {
                if (err) return reject(err);
                resolve({ fields, files });
            });
        });

        const excelFile = Array.isArray(files.excel) ? files.excel[0] : files.excel;
        tempFilePath = excelFile?.filepath;

        if (!excelFile) {
            return res.status(400).json({ message: 'Excel dosyası bulunamadı.' });
        }

        // Dosyayı oku ve işle
        const workbook = XLSX.readFile(tempFilePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet, {
            // Excel'deki sütun sırası: Sıra no, ADI SOYADI, ATAMA BRANŞI, İLÇESİ, KURUM KODU, OKUL ADI, Görevlendirme Dönemi
            header: ['sira_no', 'ad_soyad', 'atama_bransi', 'ilce_adi', 'kurum_kodu', 'okul_adi', 'gorevlendirme_donemi'],
            range: 1, // İlk satırı (başlıkları) atla
        });

        // Veriyi doğrula ve veritabanına eklenecek hale getir
        const sorumlularToUpsert = [];
        const validationErrors = [];
        const validDonemValues = ['Tam Gün', 'Sabah', 'Öğle'];

        jsonData.forEach((row, index) => {
            const gorevlendirmeDonemi = row.gorevlendirme_donemi?.trim() || null;
            // ENUM değerini kontrol et
            if (gorevlendirmeDonemi && !validDonemValues.includes(gorevlendirmeDonemi)) {
                validationErrors.push(`Satır ${index + 2}: Geçersiz "Görevlendirme Dönemi" değeri: "${row.gorevlendirme_donemi}". İzin verilen değerler: 'Tam Gün', 'Sabah', 'Öğle' veya boş.`);
            }

            const kurumKodu = String(row.kurum_kodu || '').trim();
            const adSoyad = row.ad_soyad?.trim();
            const ilceAdi = row.ilce_adi?.trim();

            if (adSoyad && kurumKodu && ilceAdi) {
                sorumlularToUpsert.push({
                    ad_soyad: adSoyad,
                    atama_bransi: row.atama_bransi?.trim(),
                    ilce_adi: ilceAdi,
                    kurum_kodu: kurumKodu,
                    okul_adi: row.okul_adi?.trim(),
                    gorevlendirme_donemi: gorevlendirmeDonemi,
                });
            }
        });

        if (validationErrors.length > 0) {
            // Detaylı hata mesajı ile 400 Bad Request döndür
            return res.status(400).json({
                message: 'Excel dosyasında geçersiz veriler bulundu. Lütfen hataları düzeltip tekrar deneyin.',
                errors: validationErrors,
            });
        }

        if (sorumlularToUpsert.length === 0) {
            return res.status(400).json({
                message: 'Excel dosyasında geçerli veri bulunamadı. Lütfen dosyanın boş olmadığından ve sütunların şu sırada olduğundan emin olun: ' +
                    'Sıra no, ADI SOYADI, ATAMA BRANŞI, İLÇESİ, KURUM KODU, OKUL ADI, Görevlendirme Dönemi',
            });
        }

        // 'okul_sorumlulari' tablosuna toplu ekleme/güncelleme yap
        const { error: upsertError } = await supabase
            .from('okul_sorumlulari')
            .upsert(sorumlularToUpsert, { onConflict: 'kurum_kodu' });

        if (upsertError) {
            // Genel veritabanı hataları için daha spesifik bir mesaj
            if (upsertError.message.includes('violates not-null constraint')) {
                throw new Error('Veritabanı hatası: Excel dosyasındaki bazı zorunlu alanlar (Ad Soyad, İlçe, Kurum Kodu) boş olabilir. Lütfen kontrol edin.');
            } else {
                throw new Error(`Veritabanı hatası: ${upsertError.message}`);
            }
        }

        return res.status(200).json({
            success: true,
            message: `İşlem tamamlandı. ${sorumlularToUpsert.length} kayıt başarıyla işlendi.`,
        });

    } catch (error) {
        console.error('Excel yükleme API hatası:', error);
        // Hata mesajını doğrudan istemciye gönder
        return res.status(500).json({
            message: error.message || 'Dosya yüklenirken bir sunucu hatası oluştu.',
            error: error.message, // Geliştirme için orijinal hata
        });
    } finally {
        // Geçici dosyayı sil
        if (tempFilePath) {
            unlink(tempFilePath, (err) => {
                if (err) console.error("Geçici Excel dosyası silinirken hata oluştu:", err);
            });
        }
    }
}

// Handler'ı withAuth middleware'i ile sarmala ve sadece 'admin' rolüne izin ver
export default withAuth(handler, ['admin']);