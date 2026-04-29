// pages/api/upload-sorumlu-excel.js
import { createClient } from '@supabase/supabase-js';
import { IncomingForm } from 'formidable';
import { readFileSync, unlink } from 'fs';
import * as XLSX from 'xlsx';

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

    // --- Admin Rol Kontrolü ---
    // Bu bölüm, assign-district.js'deki gibi, isteği yapanın admin olduğunu doğrulamalıdır.
    // Güvenlik için bu kontrolün eklenmesi kritik öneme sahiptir.
    // Şimdilik, geliştirme kolaylığı için bu kontrolü atlıyoruz ama canlıya almadan önce eklenmelidir.
    // --- Rol Kontrolü Sonu ---

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
            header: ['ilce_adi', 'ad_soyad', 'kurum_kodu'], // Sütun başlıklarını zorunlu kıl
            range: 1, // İlk satırı (başlıkları) atla
        });

        // Veritabanına eklenecek veriyi hazırla
        const sorumlularToUpsert = jsonData
            .map(row => ({
                ilce_adi: row.ilce_adi?.trim(),
                ad_soyad: row.ad_soyad?.trim(),
                kurum_kodu: String(row.kurum_kodu).trim(), // Kurum kodunu her zaman string olarak al
            }))
            .filter(row => row.ilce_adi && row.ad_soyad && row.kurum_kodu); // Boş satırları filtrele

        if (sorumlularToUpsert.length === 0) {
            return res.status(400).json({ message: 'Excel dosyasında geçerli veri bulunamadı. Lütfen sütun başlıklarının (ilce_adi, ad_soyad, kurum_kodu) doğru olduğundan ve dosyanın boş olmadığından emin olun.' });
        }

        // 'okul_sorumlulari' tablosuna toplu ekleme/güncelleme yap
        const { error: upsertError } = await supabase
            .from('okul_sorumlulari')
            .upsert(sorumlularToUpsert, { onConflict: 'kurum_kodu' });

        if (upsertError) {
            throw new Error(`Veritabanı hatası: ${upsertError.message}`);
        }

        return res.status(200).json({
            success: true,
            message: `İşlem tamamlandı. ${sorumlularToUpsert.length} kayıt başarıyla işlendi.`,
        });

    } catch (error) {
        console.error('Excel yükleme API hatası:', error);
        return res.status(500).json({ message: 'Dosya yüklenirken bir sunucu hatası oluştu.', error: error.message });
    } finally {
        // Geçici dosyayı sil
        if (tempFilePath) {
            unlink(tempFilePath, (err) => {
                if (err) console.error("Geçici Excel dosyası silinirken hata oluştu:", err);
            });
        }
    }
}