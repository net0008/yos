// components/CoordinatorManagement.js
import React, { useEffect, useMemo, useState } from 'react';
import {
  PlusIcon,
  TrashIcon,
  UserCircleIcon,
  CheckCircleIcon,
  ExclamationCircleIcon,
  ArrowPathIcon,
  MapPinIcon,
} from '@heroicons/react/24/solid';
import { supabase } from '../lib/supabaseClient';

const CoordinatorManagement = ({
  initialCoordinators = [],
  districts = [],
  initialAssignments = {},
  onCoordinatorAdded,
  onCoordinatorDeleted,
}) => {
  const [coordinators, setCoordinators] = useState(initialCoordinators);
  const [districtAssignments, setDistrictAssignments] = useState(initialAssignments || {});
  const [form, setForm] = useState({ adSoyad: '', email: '', password: '' });
  const [assignmentForm, setAssignmentForm] = useState({ ilceAdi: '', koordinatorId: '' });
  const [loading, setLoading] = useState(false);
  const [assignmentLoading, setAssignmentLoading] = useState(false);
  const [deleteLoadingId, setDeleteLoadingId] = useState(null);
  const [deleteAssignmentDistrict, setDeleteAssignmentDistrict] = useState('');
  const [message, setMessage] = useState({ text: '', type: '' });

  useEffect(() => {
    setCoordinators(initialCoordinators || []);
  }, [initialCoordinators]);

  useEffect(() => {
    setDistrictAssignments(initialAssignments || {});
  }, [initialAssignments]);

  const showMsg = (text, type = 'success') => {
    setMessage({ text, type });
    setTimeout(() => setMessage({ text: '', type: '' }), 5000);
  };

  const getToken = async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    return session?.access_token;
  };

  const assignmentRows = useMemo(() => {
    return Object.entries(districtAssignments)
      .map(([ilceAdi, koordinatorId]) => ({
        ilceAdi,
        koordinatorId,
        coordinator: coordinators.find((c) => c.id === koordinatorId),
      }))
      .sort((a, b) => a.ilceAdi.localeCompare(b.ilceAdi, 'tr'));
  }, [districtAssignments, coordinators]);

  const handleAdd = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ text: '', type: '' });

    try {
      const token = await getToken();
      if (!token) {
        showMsg('Oturum bulunamadı. Lütfen tekrar giriş yapın.', 'error');
        return;
      }

      const res = await fetch('/api/create-coordinator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          adSoyad: form.adSoyad,
          email: form.email,
          password: form.password,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMsg(data.message || 'Koordinatör eklenemedi.', 'error');
        return;
      }

      const newCoordinator = data.koordinator;
      setCoordinators((prev) => [...prev, newCoordinator]);
      onCoordinatorAdded?.(newCoordinator);
      setForm({ adSoyad: '', email: '', password: '' });
      showMsg(`"${newCoordinator.ad_soyad}" başarıyla eklendi.`);
    } catch (err) {
      showMsg(`Hata: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignDistrict = async (e) => {
    e.preventDefault();

    if (!assignmentForm.ilceAdi || !assignmentForm.koordinatorId) {
      showMsg('Lütfen ilçe ve koordinatör seçin.', 'error');
      return;
    }

    setAssignmentLoading(true);
    try {
      const token = await getToken();
      if (!token) {
        showMsg('Oturum bulunamadı.', 'error');
        return;
      }

      const res = await fetch('/api/assign-district', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(assignmentForm),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Atama başarısız.');

      setDistrictAssignments((prev) => ({
        ...prev,
        [assignmentForm.ilceAdi]: assignmentForm.koordinatorId,
      }));
      setAssignmentForm({ ilceAdi: '', koordinatorId: '' });
      showMsg(data.message || 'İlçe koordinatörü kaydedildi.');
    } catch (err) {
      showMsg(`Hata: ${err.message}`, 'error');
    } finally {
      setAssignmentLoading(false);
    }
  };

  const handleDeleteAssignment = async (ilceAdi) => {
    if (!confirm(`${ilceAdi} ilçesi eşleştirmesi silinsin mi?`)) return;

    setDeleteAssignmentDistrict(ilceAdi);
    try {
      const token = await getToken();
      if (!token) {
        showMsg('Oturum bulunamadı.', 'error');
        return;
      }

      const res = await fetch('/api/delete-district-assignment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ ilceAdi }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Eşleştirme silinemedi.');

      setDistrictAssignments((prev) => {
        const next = { ...prev };
        delete next[ilceAdi];
        return next;
      });

      showMsg(data.message || 'Eşleştirme silindi.');
    } catch (err) {
      showMsg(`Hata: ${err.message}`, 'error');
    } finally {
      setDeleteAssignmentDistrict('');
    }
  };

  const handleDelete = async (koordinatorId, adSoyad) => {
    if (!confirm(`"${adSoyad}" koordinatörünü silmek istediğinizden emin misiniz?`)) return;

    setDeleteLoadingId(koordinatorId);
    try {
      const token = await getToken();
      if (!token) {
        showMsg('Oturum bulunamadı.', 'error');
        return;
      }

      const res = await fetch('/api/delete-coordinator', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ koordinatorId }),
      });

      const data = await res.json();
      if (!res.ok) {
        showMsg(data.message || 'Silinemedi.', 'error');
        return;
      }

      setCoordinators((prev) => prev.filter((k) => k.id !== koordinatorId));
      setDistrictAssignments((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((district) => {
          if (next[district] === koordinatorId) delete next[district];
        });
        return next;
      });

      onCoordinatorDeleted?.(koordinatorId);
      showMsg(`"${adSoyad}" başarıyla silindi.`);
    } catch (err) {
      showMsg(`Hata: ${err.message}`, 'error');
    } finally {
      setDeleteLoadingId(null);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md max-w-4xl mx-auto">
      <h2 className="text-xl font-bold mb-1 text-gray-800">Koordinatör Yönetimi</h2>
      <p className="text-sm text-gray-500 mb-4">Önceden eklenen koordinatörler aşağıda listelenir.</p>

      {message.text && (
        <div
          className={`mb-4 p-3 rounded-md text-sm flex items-center gap-2 ${
            message.type === 'error'
              ? 'bg-red-50 border border-red-200 text-red-700'
              : 'bg-green-50 border border-green-200 text-green-700'
          }`}
        >
          {message.type === 'error' ? (
            <ExclamationCircleIcon className="h-4 w-4 flex-shrink-0" />
          ) : (
            <CheckCircleIcon className="h-4 w-4 flex-shrink-0" />
          )}
          {message.text}
        </div>
      )}

      <form onSubmit={handleAdd} className="bg-gray-50 border rounded-lg p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <PlusIcon className="h-4 w-4 text-indigo-600" />
          Yeni Koordinatör Ekle
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input type="text" value={form.adSoyad} onChange={(e) => setForm((p) => ({ ...p, adSoyad: e.target.value }))} required placeholder="Ad Soyad" className="w-full p-2 border rounded-md text-sm" />
          <input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required placeholder="E-posta" className="w-full p-2 border rounded-md text-sm" />
          <input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required minLength={6} placeholder="Şifre" className="w-full p-2 border rounded-md text-sm" />
        </div>
        <button type="submit" disabled={loading} className="mt-3 px-4 py-1.5 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400 flex items-center gap-1.5">
          {loading ? <><ArrowPathIcon className="h-3.5 w-3.5 animate-spin" />Ekleniyor...</> : <><PlusIcon className="h-3.5 w-3.5" />Koordinatör Ekle</>}
        </button>
      </form>

      <form onSubmit={handleAssignDistrict} className="bg-gray-50 border rounded-lg p-4 mb-5">
        <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
          <MapPinIcon className="h-4 w-4 text-indigo-600" />
          İlçe Koordinatörü Ekle / Güncelle
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <select value={assignmentForm.ilceAdi} onChange={(e) => setAssignmentForm((p) => ({ ...p, ilceAdi: e.target.value }))} className="w-full p-2 border rounded-md text-sm">
            <option value="">İlçe seçin</option>
            {districts.map((d) => <option key={d.ilce_adi} value={d.ilce_adi}>{d.ilce_adi}</option>)}
          </select>

          <select value={assignmentForm.koordinatorId} onChange={(e) => setAssignmentForm((p) => ({ ...p, koordinatorId: e.target.value }))} className="w-full p-2 border rounded-md text-sm">
            <option value="">Koordinatör seçin</option>
            {coordinators.map((c) => <option key={c.id} value={c.id}>{c.ad_soyad}</option>)}
          </select>

          <button type="submit" disabled={assignmentLoading} className="px-4 py-2 bg-indigo-600 text-white text-sm rounded-md hover:bg-indigo-700 disabled:bg-gray-400">
            {assignmentLoading ? 'Kaydediliyor...' : 'İlçe Koordinatörü Ekle'}
          </button>
        </div>
      </form>

      <div className="border rounded-lg overflow-hidden mb-5">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kayıtlı İlçe Koordinatörleri</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Koordinatör</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignmentRows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">Kayıtlı ilçe koordinatörü yok.</td>
              </tr>
            ) : (
              assignmentRows.map((row) => (
                <tr key={row.ilceAdi}>
                  <td className="px-4 py-3 text-sm text-gray-900">{row.ilceAdi}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{row.coordinator?.ad_soyad || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDeleteAssignment(row.ilceAdi)} disabled={deleteAssignmentDistrict === row.ilceAdi} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-40">
                      {deleteAssignmentDistrict === row.ilceAdi ? <ArrowPathIcon className="h-3 w-3 animate-spin" /> : <TrashIcon className="h-3 w-3" />}
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="border rounded-lg overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Ad Soyad</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">E-posta</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">İşlem</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {coordinators.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-sm text-gray-400">Henüz koordinatör yok.</td>
              </tr>
            ) : (
              coordinators.map((k) => (
                <tr key={k.id}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <UserCircleIcon className="h-4 w-4 text-indigo-400 flex-shrink-0" />
                      <span className="text-sm text-gray-900">{k.ad_soyad}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{k.email || '—'}</td>
                  <td className="px-4 py-3 text-right">
                    <button onClick={() => handleDelete(k.id, k.ad_soyad)} disabled={deleteLoadingId === k.id} className="inline-flex items-center gap-1 px-2 py-1 text-xs text-red-600 hover:text-red-800 hover:bg-red-50 rounded disabled:opacity-40">
                      {deleteLoadingId === k.id ? <ArrowPathIcon className="h-3 w-3 animate-spin" /> : <TrashIcon className="h-3 w-3" />}
                      Sil
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CoordinatorManagement;