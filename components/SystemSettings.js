// components/SystemSettings.js
import React, { useState, useEffect } from 'react';
import { PlusIcon, TrashIcon } from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient'; // Paylaşılan istemciyi içe aktar

/**
 * Admin'in sistem ayarlarını (görevler, kriterler) yönettiği arayüz.
 * @param {object} props - Bileşen propları.
 * @param {string[]} props.donemler - Sistemdeki tüm dönemlerin listesi (örn: ["2025-2026 1. Dönem"]).
 * @param {function} props.onSave - Kaydet butonuna basıldığında çağrılacak fonksiyon.
 */
const SystemSettings = ({ donemler, onSave }) => {
    const [selectedDonem, setSelectedDonem] = useState(donemler[0] || '');
    const [gorevTanimlari, setGorevTanimlari] = useState('');
    const [analizKriterleri, setAnalizKriterleri] = useState(['']);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [savingSection, setSavingSection] = useState(null);
    const [saveMessages, setSaveMessages] = useState({ gorevler: null, kriterler: null });

    // Seçili dönem değiştiğinde, o döneme ait ayarları veritabanından çek
    useEffect(() => {
        if (!selectedDonem) return;

        const fetchSettings = async () => {
            setIsLoading(true);
            setMessage('');
            setSaveMessages({ gorevler: null, kriterler: null });

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                setMessage('Hata: Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.');
                setIsLoading(false);
                return;
            }
            const token = session.access_token;

            // Tarayıcı önbelleğini (cache) kırmak ve her zaman en güncel veriyi almak için timestamp (t) eklendi
            const response = await fetch(`/api/get-settings?donem=${encodeURIComponent(selectedDonem)}&t=${Date.now()}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });
            const result = await response.json();

            if (response.ok && result.success) {
                if (result.settings) {
                    setGorevTanimlari(result.settings.gorev_tanimlari || '');

                    let kriterlerArray = result.settings.analiz_kriterleri;
                    // Veritabanından gelen verinin geçerli bir dizi olduğundan emin ol (farklı formatlarda kaydedilmişse kurtar)
                    if (!Array.isArray(kriterlerArray)) {
                        try {
                            kriterlerArray = JSON.parse(kriterlerArray);
                        } catch (e) {
                            kriterlerArray = typeof kriterlerArray === 'string' && kriterlerArray.trim() !== '' ? [kriterlerArray] : [''];
                        }
                    }

                    if (!Array.isArray(kriterlerArray) || kriterlerArray.length === 0) {
                        kriterlerArray = [''];
                    }

                    setAnalizKriterleri(kriterlerArray);
                } else {
                    // Eğer o dönem için ayar yoksa formu temizle
                    setGorevTanimlari('');
                    setAnalizKriterleri(['']);
                }
            } else {
                console.error('Ayarlar çekilirken hata:', result.message);
                setMessage(`Hata: Ayarlar çekilemedi. (${result.message})`);
            }
            setIsLoading(false);
        };

        fetchSettings();
    }, [selectedDonem]);

    const handleAddKriter = () => {
        setAnalizKriterleri([...analizKriterleri, '']);
    };

    const handleRemoveKriter = (index) => {
        const newKriterler = analizKriterleri.filter((_, i) => i !== index);
        setAnalizKriterleri(newKriterler);
    };

    const handleKriterChange = (index, value) => {
        const newKriterler = [...analizKriterleri];
        newKriterler[index] = value;
        setAnalizKriterleri(newKriterler);
    };

    const handleSave = async (section) => {
        setSavingSection(section);
        setSaveMessages(prev => ({ ...prev, [section]: null }));

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            setSaveMessages(prev => ({ ...prev, [section]: { type: 'error', text: 'Hata: Oturum bilgisi alınamadı.' } }));
            setSavingSection(null);
            return;
        }
        const token = session.access_token;

        const cleanedKriterler = analizKriterleri.filter(k => k.trim() !== '');

        const settingsData = {
            donem: selectedDonem,
            gorev_tanimlari: gorevTanimlari,
            analiz_kriterleri: cleanedKriterler,
        };

        try {
            const result = await onSave(settingsData, token);

            if (!result.success) {
                setSaveMessages(prev => ({ ...prev, [section]: { type: 'error', text: `Hata: ${result.message || 'Bilinmeyen bir hata oluştu.'}` } }));
            } else {
                setSaveMessages(prev => ({ ...prev, [section]: { type: 'success', text: 'Başarıyla kaydedildi!' } }));
                setAnalizKriterleri(cleanedKriterler.length > 0 ? cleanedKriterler : ['']);
                setTimeout(() => {
                    setSaveMessages(prev => ({ ...prev, [section]: null }));
                }, 4000);
            }
        } catch (err) {
            setSaveMessages(prev => ({ ...prev, [section]: { type: 'error', text: 'Sunucu ile bağlantı kurulamadı.' } }));
        }
        setSavingSection(null);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Sistem Ayarları Yönetimi</h2>

            <div className="mb-4">
                <label htmlFor="donem-select" className="block text-sm font-medium text-gray-700 mb-1">Ayarların Geçerli Olacağı Dönem</label>
                <select id="donem-select" value={selectedDonem} onChange={(e) => setSelectedDonem(e.target.value)} className="w-full p-2 border rounded-md">
                    {donemler.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>
            {isLoading && <p className="text-sm text-gray-500 mb-4">Ayarlar yükleniyor...</p>}
            {message && <p className="text-sm text-red-600 mb-4">{message}</p>}

            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <label htmlFor="gorev-tanimlari" className="block text-lg font-bold text-gray-800 mb-2">1. Okul Sorumlusu Görev Tanımları</label>
                <p className="text-sm text-gray-500 mb-2">Bu tanımlar, yapay zekanın raporu incelerken okul sorumlusunun asıl görevlerini bilmesini sağlar.</p>
                <textarea id="gorev-tanimlari" rows="10" value={gorevTanimlari} onChange={(e) => setGorevTanimlari(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Seçili dönem için görev tanımlarını buraya girin..."></textarea>

                <div className="mt-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <button onClick={() => handleSave('gorevler')} disabled={savingSection !== null} className="px-4 py-2 text-white bg-indigo-600 font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                        {savingSection === 'gorevler' ? 'Kaydediliyor...' : 'Görev Tanımlarını Kaydet'}
                    </button>
                    {saveMessages.gorevler && (
                        <span className={`text-sm font-medium ${saveMessages.gorevler.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {saveMessages.gorevler.text}
                        </span>
                    )}
                </div>
            </div>

            <div className="mb-6 p-4 border rounded-lg bg-gray-50">
                <h3 className="text-lg font-bold text-gray-800 mb-2">2. AI Rapor Analiz Kriterleri</h3>
                <p className="text-sm text-gray-500 mb-4">Yapay zeka, raporu okurken buradaki kriterlerin her birini tek tek test edip 'UYGUN/UYGUN DEĞİL' kararı verir.</p>
                <div className="space-y-2">
                    {analizKriterleri.map((kriter, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input type="text" value={kriter} onChange={(e) => handleKriterChange(index, e.target.value)} className="flex-grow p-2 border rounded-md" placeholder="Yeni kriter..." />
                            <button onClick={() => handleRemoveKriter(index)} className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600"><TrashIcon className="h-5 w-5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddKriter} className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"><PlusIcon className="h-4 w-4" />Yeni Kriter Ekle</button>

                <div className="mt-4 border-t border-gray-200 pt-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <button onClick={() => handleSave('kriterler')} disabled={savingSection !== null} className="px-4 py-2 text-white bg-indigo-600 font-medium rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                        {savingSection === 'kriterler' ? 'Kaydediliyor...' : 'Analiz Kriterlerini Kaydet'}
                    </button>
                    {saveMessages.kriterler && (
                        <span className={`text-sm font-medium ${saveMessages.kriterler.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
                            {saveMessages.kriterler.text}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};

export default SystemSettings;