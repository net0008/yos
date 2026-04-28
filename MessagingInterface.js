// components/MessagingInterface.js
import React, { useState, useEffect, useRef } from 'react';
import { PaperAirplaneIcon, UserGroupIcon, UserIcon } from '@heroicons/react/24/solid';

/**
 * Kullanıcılar (Admin/Koordinatör) arası mesajlaşma arayüzü.
 * @param {object} props - Bileşen propları.
 * @param {object} props.currentUser - Giriş yapmış kullanıcının profil bilgileri (id, ad_soyad, rol).
 * @param {object[]} props.allUsers - Sistemdeki tüm Admin ve Koordinatörlerin listesi.
 */
const MessagingInterface = ({ currentUser, allUsers }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [selectedRecipient, setSelectedRecipient] = useState(null); // null: genel, UUID: birebir
    const messagesEndRef = useRef(null);

    const recipientName = selectedRecipient
        ? allUsers.find(u => u.id === selectedRecipient)?.ad_soyad || 'Bilinmeyen Kullanıcı'
        : 'Genel Sohbet';

    const fetchMessages = async () => {
        // Gerçek uygulamada, Authorization header'ı ile token gönderilmelidir.
        const response = await fetch(`/api/get-messages?${selectedRecipient ? `alici_id=${selectedRecipient}` : ''}`, {
            headers: {
                'Authorization': `Bearer YOUR_AUTH_TOKEN` // Buraya gerçek token gelecek
            }
        });
        const data = await response.json();
        if (data.success) {
            setMessages(data.messages);
        } else {
            console.error('Mesajlar çekilirken hata:', data.message);
        }
    };

    useEffect(() => {
        fetchMessages();
        // Supabase Realtime ile mesajları anlık güncelleme eklenebilir.
        // const channel = supabase.channel('messages');
        // channel.on('postgres_changes', { event: '*', schema: 'public', table: 'mesajlar' }, payload => {
        //     fetchMessages();
        // }).subscribe();
        // return () => supabase.removeChannel(channel);
    }, [selectedRecipient]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (newMessage.trim() === '') return;

        // Gerçek uygulamada, Authorization header'ı ile token gönderilmelidir.
        const response = await fetch('/api/send-message', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer YOUR_AUTH_TOKEN` // Buraya gerçek token gelecek
            },
            body: JSON.stringify({
                alici_id: selectedRecipient,
                icerik: newMessage,
            }),
        });

        const data = await response.json();
        if (data.success) {
            setNewMessage('');
            fetchMessages(); // Mesaj gönderildikten sonra mesajları yeniden çek
        } else {
            console.error('Mesaj gönderilirken hata:', data.message);
        }
    };

    return (
        <div className="flex h-[80vh] bg-white rounded-lg shadow-md overflow-hidden">
            {/* Sol Panel: Kullanıcı Listesi */}
            <div className="w-1/4 border-r bg-gray-50">
                <div className="p-4 border-b">
                    <h3 className="font-bold text-lg">Sohbetler</h3>
                </div>
                <ul className="overflow-y-auto h-full pb-20">
                    <li
                        className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 ${!selectedRecipient ? 'bg-indigo-100 font-semibold' : ''}`}
                        onClick={() => setSelectedRecipient(null)}
                    >
                        <UserGroupIcon className="h-6 w-6 text-gray-600 mr-3" />
                        Genel Sohbet
                    </li>
                    {allUsers.filter(u => u.id !== currentUser.id).map(user => (
                        <li
                            key={user.id}
                            className={`flex items-center p-3 cursor-pointer hover:bg-gray-100 ${selectedRecipient === user.id ? 'bg-indigo-100 font-semibold' : ''}`}
                            onClick={() => setSelectedRecipient(user.id)}
                        >
                            <UserIcon className="h-6 w-6 text-gray-600 mr-3" />
                            {user.ad_soyad} ({user.rol})
                        </li>
                    ))}
                </ul>
            </div>

            {/* Sağ Panel: Mesaj Kutusu */}
            <div className="flex-1 flex flex-col">
                <div className="p-4 border-b bg-gray-50">
                    <h3 className="font-bold text-lg">{recipientName}</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {messages.map((msg) => (
                        <div
                            key={msg.id}
                            className={`flex ${msg.gonderen.id === currentUser.id ? 'justify-end' : 'justify-start'}`}
                        >
                            <div
                                className={`max-w-[70%] p-3 rounded-lg shadow-sm ${msg.gonderen.id === currentUser.id
                                        ? 'bg-indigo-500 text-white'
                                        : 'bg-gray-200 text-gray-800'
                                    }`}
                            >
                                <p className="text-xs font-semibold mb-1">
                                    {msg.gonderen.id === currentUser.id ? 'Siz' : msg.gonderen.ad_soyad}
                                </p>
                                <p>{msg.icerik}</p>
                                <p className="text-right text-xs mt-1 opacity-75">
                                    {new Date(msg.gonderilme_tarihi).toLocaleTimeString()}
                                </p>
                            </div>
                        </div>
                    ))}
                    <div ref={messagesEndRef} />
                </div>
                <form onSubmit={handleSendMessage} className="p-4 border-t bg-gray-50 flex items-center gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Mesajınızı yazın..."
                        className="flex-1 p-2 border rounded-md focus:ring-2 focus:ring-indigo-500"
                    />
                    <button
                        type="submit"
                        className="p-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
                    >
                        <PaperAirplaneIcon className="h-6 w-6" />
                    </button>
                </form>
            </div>
        </div>
    );
};

export default MessagingInterface;