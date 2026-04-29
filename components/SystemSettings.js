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

    // Seçili dönem değiştiğinde, o döneme ait ayarları veritabanından çek
    useEffect(() => {
        if (!selectedDonem) return;

        const fetchSettings = async () => {
            setIsLoading(true);
            setMessage('');

            const { data: { session }, error: sessionError } = await supabase.auth.getSession();

            if (sessionError || !session) {
                setMessage('Hata: Oturum bilgisi alınamadı. Lütfen tekrar giriş yapın.');
                setIsLoading(false);
                return;
            }
            const token = session.access_token;

            const response = await fetch(`/api/get-settings?donem=${selectedDonem}`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                },
            });
            const result = await response.json();

            if (response.ok && result.success) {
                if (result.settings) {
                    setGorevTanimlari(result.settings.gorev_tanimlari || '');
                    setAnalizKriterleri(result.settings.analiz_kriterleri || ['']);
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

    const handleSave = async () => {
        setIsLoading(true);
        setMessage('');

        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        if (sessionError || !session) {
            setMessage('Hata: Oturum bilgisi alınamadı. Kaydetme işlemi başarısız.');
            setIsLoading(false);
            return;
        }
        const token = session.access_token;

        const settingsData = {
            donem: selectedDonem,
            gorev_tanimlari: gorevTanimlari,
            analiz_kriterleri: analizKriterleri.filter(k => k.trim() !== ''), // Boş kriterleri gönderme
        };

        const { error } = await onSave(settingsData, token);

        if (error) {
            setMessage(`Hata: ${error.message}`);
        } else {
            setMessage('Ayarlar başarıyla kaydedildi!');
        }
        setIsLoading(false);
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-4">Sistem Ayarları Yönetimi</h2>

            <div className="mb-4">
                <label htmlFor="donem-select" className="block text-sm font-medium text-gray-700 mb-1">Dönem Seçin</label>
                <select id="donem-select" value={selectedDonem} onChange={(e) => setSelectedDonem(e.target.value)} className="w-full p-2 border rounded-md">
                    {donemler.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
            </div>

            <div className="mb-6">
                <label htmlFor="gorev-tanimlari" className="block text-sm font-medium text-gray-700 mb-1">Okul Sorumlusu Görev Tanımları</label>
                <textarea id="gorev-tanimlari" rows="10" value={gorevTanimlari} onChange={(e) => setGorevTanimlari(e.target.value)} className="w-full p-2 border rounded-md" placeholder="Seçili dönem için görev tanımlarını buraya girin..."></textarea>
            </div>

            <div className="mb-6">
                <h3 className="text-lg font-bold mb-2">AI Rapor Analiz Kriterleri</h3>
                <div className="space-y-2">
                    {analizKriterleri.map((kriter, index) => (
                        <div key={index} className="flex items-center gap-2">
                            <input type="text" value={kriter} onChange={(e) => handleKriterChange(index, e.target.value)} className="flex-grow p-2 border rounded-md" placeholder="Yeni kriter..." />
                            <button onClick={() => handleRemoveKriter(index)} className="p-2 text-white bg-red-500 rounded-md hover:bg-red-600"><TrashIcon className="h-5 w-5" /></button>
                        </div>
                    ))}
                </div>
                <button onClick={handleAddKriter} className="mt-2 flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800"><PlusIcon className="h-4 w-4" />Yeni Kriter Ekle</button>
            </div>

            <button onClick={handleSave} disabled={isLoading} className="w-full px-4 py-2 text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
                {isLoading ? 'Kaydediliyor...' : 'Ayarları Kaydet'}
            </button>
            {message && <p className={`mt-4 text-sm ${message.startsWith('Hata') ? 'text-red-600' : 'text-green-600'}`}>{message}</p>}
        </div>
    );
};

export default SystemSettings;