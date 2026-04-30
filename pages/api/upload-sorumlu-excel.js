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

        // Veritabanına eklenecek veriyi hazırla
        const sorumlularToUpsert = jsonData
            .map(row => ({
                ad_soyad: row.ad_soyad?.trim(),
                atama_bransi: row.atama_bransi?.trim(),
                ilce_adi: row.ilce_adi?.trim(),
                kurum_kodu: String(row.kurum_kodu || '').trim(),
                okul_adi: row.okul_adi?.trim(),
                gorevlendirme_donemi: row.gorevlendirme_donemi?.trim() || null, // Boşsa NULL yap
            }))
            .filter(row => row.ad_soyad && row.kurum_kodu && row.ilce_adi); // Gerekli alanları olanları filtrele

        if (sorumlularToUpsert.length === 0) {
            return res.status(400).json({
                message: 'Excel dosyasında geçerli veri bulunamadı. Lütfen dosyanın boş olmadığından ve sütunların şu sırada olduğundan emin olun: ' +
                    'Sıra no, ADI SOYADI, ATAMA BRANŞI, İLÇESİ, KURUM KODU, OKUL ADI, Görevlendirme Dönemi'
            });
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

// Handler'ı withAuth middleware'i ile sarmala ve sadece 'admin' rolüne izin ver
export default withAuth(handler, ['admin']);