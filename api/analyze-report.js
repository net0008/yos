// pages/api/analyze-report.js
import { createClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import pdf from 'pdf-parse';

// Supabase istemcisini başlatın
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Gemini AI istemcisini başlatın (Ortam değişkenlerinde GEMINI_API_KEY tanımlı olmalıdır)
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Veritabanından Admin tarafından tanımlanmış dinamik ayarları çeker.
 * Gerçek bir uygulamada bu veriler bir 'ayarlar' tablosundan gelmelidir.
 * Şimdilik, geliştirme kolaylığı için değerleri burada tanımlıyoruz.
 */
async function getSystemSettings() {
    const gorevler = `
    a) Donanım ve altyapı desteği sağlanan okullarda okul yöneticisi, öğretmen, öğrenci ve velilere yönelik bilgilendirme, tanıtım, uygulama ve rehberlik faaliyetlerini planlar ve yürütür.
    b) Bakanlık eğitim platformlarına (EBA, ÖBA vb.) öğretmen ve öğrencilerin erişimini sağlamak amacıyla uygun giriş yöntemlerini tanıtır ve rehberlik yapar.
    c) Görevli olduğu okulda EBA içeriklerinin ve diğer dijital içeriklerin sınıf içi ve sınıf dışı kullanımını destekler; okul yöneticisi, öğretmen ve öğrencilere yönelik tanıtım ve bilgilendirme toplantıları düzenler.
    ç) Öğretmenlerin dijital içerikleri etkin biçimde derslerinde kullanmalarına destek olur; yeni geliştirilen dijital içeriklerin tanıtım ve yaygınlaştırma çalışmalarını yürütür
    d) EBA platformunda yapılan öğrenci paylaşımlarını haftalık olarak kontrol eder, uygunsuz paylaşımları kaldırır ve gerekli durumlarda öğrencilere, öğretmenlere ve okul yönetimine yönelik gerekli uyarı ve bilgilendirme işlemlerini yapar.
    e) Genel Müdürlük tarafından yürütülen ulusal ve uluslararası projeler kapsamında okul yöneticisi koordinasyonunda okuldaki okul yöneticisi, öğretmen, öğrenci ve velilere yönelik bilgilendirme ve tanıtım toplantıları düzenler.
    f) Öğretmen Bilişim Ağı (ÖBA) platformunun kullanımında okul yöneticilerine ve öğretmenlere rehberlik sağlar.
    g) Okulda bulunan etkileşimli tahta ve bilgisayarlarda kullanılan Genel Müdürlük tarafından geliştirilen/desteklenen işletim sistemlerinin kurulum, kullanımı ve güncelliğini sağlar; okul yöneticisi ve öğretmenlere geliştirilen/ desteklenen işletim sisteminin kullanımı hakkında rehberlik yapar.
    ğ) FATİH Projesi kapsamında kurulan bilişim donanımları, bilişim teknolojileri sınıfları ve yenilikçi sınıfların amacına uygun şekilde okul yönetimi ile birlikte planlama, uygulama ve izleme faaliyetlerini yürütür. Kullanımını; ilgili yazılımların ve ders içeriklerinin güncel kalmasını sağlar.
    h) Okulda bulunan bilişim teknolojisi araçlarının garanti süresi içinde uygun kullanımını sağlar; garanti ve arıza takip işlemlerinde ilgili birimlerle koordinasyonu yürütür ve okul yönetimine bu konuda rehberlik eder.
    ı) Okullarda BT alanında düzenlenecek yarışma ve etkinlikleri vb. planlar, organize eder ve yürütür; ayrıca bu yarışmalarda kurulacak değerlendirme komisyonlarında görev alır.
    i) Okulun web sitesinin güncellenmesi ve yayında kalmasını sağlar; web sitesi yayın ekibinde aktif olarak görev alır ve web sitesi yayın ekibinin uygun gördüğü içeriklerin yayınlanmasını sağlar.
    j) Okulun bilişim teknolojilerine ilişkin faaliyetleri hakkında bilgi paylaşımını sağlar ve okulun web sitesinde bu bilgilerin güncel tutulmasından sorumludur.
    k) Genel müdürlük tarafından yürütülen ulusal ve uluslararası bilişim teknolojileri projelerinde öğretmen ve öğrencilere yönelik rehberlik ve bilgilendirme faaliyetleri yürütür.
    l) Yürüttüğü rehberlik faaliyetlerini aylık olarak “YEĞİTEK Okul Sorumlusu Çalışma Bildirim Formu”na işler; okul müdürünün onayı ile YEĞİTEK İl Yöneticisine sunar.
    m) YEĞİTEK Okul Sorumlusu, görevlerini yerine getirirken YEĞİTEK İl Yöneticisi, YEĞİTEK Bilişim Koordinatörü Koordinatörü ve YEĞİTEK Proje Koordinatörü ile işbirliği içinde çalışır.
    n) Okullarda internetin bilinçli, güvenli ve etkin kullanımına yönelik öğretmen, öğrenci ve velilere yönelik faaliyetleri planlar. Faaliyetlerde öğrencilere bilgilendirme çalışmalarını rehberlik ve psikolojik danışma servisi ve diğer öğretmenlerle birlikte koordine eder ve uygular. Bu konuda çeşitli okul içi konferans, panel, afiş gibi çalışmaları planlar ve yürütür.
    o) Görevlendirildiği tarihten itibaren en geç on beş (15) gün içinde çalışma planı hazırlar ve okul müdürlüğü ile Yenilik ve Eğitim Teknolojileri Hizmetleri Şubesine sunar. Çalışma planına uygun faaliyetin yürütülmesinden okul müdürlüğü sorumludur.
    ö) YEĞİTEK Okul Sorumlusu, faaliyetlerini YEĞİTEK İl Yöneticisi, YEĞİTEK Bilişim Koordinatörü ve YEĞİTEK Proje Koordinatörünün planlamaları doğrultusunda, eğitim kurumu yöneticilerinin bilgisi dâhilinde gerçekleştirir.
  `;

    const kriterler = [
        'UYGUN DEĞİL - İmza ve/veya mühür eksik',
        'UYGUN DEĞİL - Rapor formatı bozulmuş/hatalı format',
        'UYGUN DEĞİL - Raporda genel ifadeler kullanılmış, yapılan işler ayrıntılarıyla açıklanmalıdır.',
        'UYGUN DEĞİL - Bir bölüm boş bırakıldıysa neden boş bırakıldığı açıklanmalıdır. "Okuldaki öğretmenlerin Ve öğrencilerin EBA da aktif olma yüzdesi (1. Dönem/2. Dönem)" Sadec bu kısım boş olabilir.',
        'UYGUN DEĞİL - Raporun üst kısmındaki bilgiler eksik/hatalı',
        'UYGUN DEĞİL - Onay tarihi eksik',
        'UYGUN DEĞİL - Eski format kullanılmış. "Farklı şablona sahip bir rapor olursa"',
    ];

    return { gorevler, kriterler };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ message: 'Sadece POST istekleri kabul edilir.' });
    }

    // Bu endpoint genellikle bir Supabase webhook tarafından tetiklenir.
    const { record: rapor } = req.body;

    if (!rapor || !rapor.id) {
        return res.status(400).json({ message: 'Geçerli rapor kaydı bilgisi zorunludur.' });
    }

    const rapor_id = rapor.id;

    try {
        // Analiz başlamadan durumu güncelle
        await supabase.from('raporlar').update({ status: 'ai_incelendi' }).eq('id', rapor_id);

        // PDF dosyasını Storage'dan indir
        const { data: fileData, error: downloadError } = await supabase.storage
            .from('raporlar')
            .download(rapor.pdf_storage_path);

        if (downloadError) throw new Error(`PDF indirme hatası: ${downloadError.message}`);

        const fileBuffer = Buffer.from(await fileData.arrayBuffer());
        const pdfText = (await pdf(fileBuffer)).text;

        const { gorevler, kriterler } = await getSystemSettings();

        const prompt = `
      SENARYO: Sen, YEĞİTEK Okul Sorumluları tarafından yüklenen aylık faaliyet raporlarını denetleyen uzman bir denetçisin.
      GÖREV: Sana metin olarak verilen PDF raporunu analiz et ve bulgularını sadece ve sadece istenen JSON formatında döndür. Başka hiçbir açıklama ekleme.
      REFERANS BİLGİLERİ:
      1. Okul Sorumlusunun Resmi Görev Tanımları:
      ---
      ${gorevler}
      ---
      2. Değerlendirme Kriterleri (Bunları kontrol etmelisin):
      ---
      ${kriterler.join('\n')}
      ---
      İSTENEN JSON ÇIKTI YAPISI:
      {
        "analiz_ozeti": "1-2 cümlelik genel bir özet.",
        "genel_durum": "Tüm kriterler başarılı ise 'UYGUN', herhangi biri başarısız ise 'UYGUN DEĞİL' yaz.",
        "kontrol_listesi": [{"kriter": "Değerlendirme kriterinin tam metni", "durum": "'BAŞARILI' veya 'BAŞARISIZ'", "aciklama": "Bu kararı neden verdiğini kısaca açıkla."}],
        "gorev_kapsami_analizi": {"kapsam_disi_faaliyetler": ["Görev tanımı dışında tespit ettiğin faaliyetleri buraya dizi olarak ekle."], "aciklama": "Kapsam dışı faaliyetler hakkında kısa bir yorum."},
        "siradisi_durumlar": ["Raporda belirtilen 'etkileşimli tahta hurdaya çıktı' gibi dikkat çekici, aksaklık veya özel durumları bu diziye ekle."]
      }
      ANALİZ EDİLECEK RAPOR METNİ:
      ---
      ${pdfText}
      ---
    `;

        const model = genAI.getGenerativeModel({ model: "gemini-pro" });
        const result = await model.generateContent(prompt);
        const response = await result.response;
        let responseText = response.text();

        responseText = responseText.replace('```json', '').replace('```', '').trim();
        const analysisResult = JSON.parse(responseText);

        let finalStatus = 'koordinator_onayinda';
        if (analysisResult.genel_durum === 'UYGUN DEĞİL') {
            const imzaEksik = analysisResult.kontrol_listesi.find(item => item.kriter.includes('İmza') && item.durum === 'BAŞARISIZ');
            const formatHatali = analysisResult.kontrol_listesi.find(item => item.kriter.includes('format') && item.durum === 'BAŞARISIZ');
            if (imzaEksik) finalStatus = 'IMZA_MUHUR_EKSİK';
            else if (formatHatali) finalStatus = 'FORMAT_HATALI';
            else finalStatus = 'reddedildi'; // Genel bir 'uygun değil' durumu
        } else if (analysisResult.genel_durum === 'UYGUN') {
            finalStatus = 'onaylandi'; // Otomatik onay veya koordinatör onayı için 'koordinator_onayinda'
        }

        const { error: updateError } = await supabase
            .from('raporlar')
            .update({
                ai_analiz_sonucu: analysisResult,
                status: finalStatus
            })
            .eq('id', rapor_id);

        if (updateError) throw new Error(`Analiz sonucu güncellenirken hata: ${updateError.message}`);

        res.status(200).json({ success: true, message: 'Rapor başarıyla analiz edildi.' });

    } catch (error) {
        console.error(`Rapor analizi API hatası (Rapor ID: ${rapor_id}):`, error);
        await supabase.from('raporlar').update({ status: 'ai_analiz_hatasi' }).eq('id', rapor_id);
        return res.status(500).json({ message: 'Rapor analizi sırasında bir sunucu hatası oluştu.', error: error.message });
    }
}