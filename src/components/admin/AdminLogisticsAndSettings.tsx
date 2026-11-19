import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Info,
  Mail,
  Plus,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  Truck,
  Upload,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { formatDzd } from '../../shared/domain';
import { BrandLogo } from '../BrandLogo';

// ---------------------------------------------------------------------------
// 8 & 9. CARRIERS + 58-WILAYA SHIPPING RATES
// ---------------------------------------------------------------------------
export function AdminCarriersAndRates({
  carriers,
  shippingRates,
  onRefresh,
}: {
  carriers: any[];
  shippingRates: any[];
  onRefresh: () => void;
}) {
  const [selectedCarrierId, setSelectedCarrierId] = useState<number>(carriers[0]?.id || 0);
  const [wilayaSearch, setWilayaSearch] = useState('');
  const [rateEdits, setRateEdits] = useState<
    Record<number, { homePriceDzd: number; stopDeskPriceDzd: number; estimatedDays: string; isActive: boolean }>
  >({});
  const [savingRateId, setSavingRateId] = useState<number | null>(null);
  const [savedRateId, setSavedRateId] = useState<number | null>(null);

  // Add carrier form
  const [carrierName, setCarrierName] = useState('');
  const [apiProvider, setApiProvider] = useState('manual');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [addingCarrier, setAddingCarrier] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCarrierId = selectedCarrierId || carriers[0]?.id || 0;

  const filteredRates = useMemo(() => {
    const q = wilayaSearch.trim().toLowerCase();
    return shippingRates
      .filter((r) => r.carrierId === activeCarrierId)
      .filter((r) => !q || `${r.wilayaCode} ${r.wilayaName}`.toLowerCase().includes(q));
  }, [shippingRates, activeCarrierId, wilayaSearch]);

  const handleAddCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierName.trim()) return;
    setAddingCarrier(true);
    setError(null);
    try {
      const res = await adminFetch<any>('/api/admin/carriers', {
        method: 'POST',
        body: JSON.stringify({
          name: carrierName.trim(),
          apiProvider,
          apiEndpoint: apiEndpoint.trim() || null,
          supportsHome: true,
          supportsStopDesk: true,
          seedDefaultRates: true,
        }),
      });
      setCarrierName('');
      setApiEndpoint('');
      if (res.carrier?.id) setSelectedCarrierId(res.carrier.id);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setAddingCarrier(false);
    }
  };

  const handleSaveRate = async (r: any) => {
    const draft = rateEdits[r.id] || {
      homePriceDzd: r.homePriceDzd,
      stopDeskPriceDzd: r.stopDeskPriceDzd,
      estimatedDays: r.estimatedDays,
      isActive: r.isActive,
    };
    setSavingRateId(r.id);
    setError(null);
    try {
      await adminFetch(`/api/admin/shipping-rates/${r.id}`, {
        method: 'PATCH',
        body: JSON.stringify(draft),
      });
      setSavedRateId(r.id);
      setTimeout(() => setSavedRateId((cur) => (cur === r.id ? null : cur)), 1500);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSavingRateId(null);
    }
  };

  const toggleCarrierActive = async (c: any) => {
    await adminFetch(`/api/admin/carriers/${c.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !c.isActive }),
    });
    onRefresh();
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}

      {/* Carriers section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleAddCarrier}
          className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
        >
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-blue-700" />
            <h3 className="font-display font-semibold text-base text-slate-900">
              Ajouter un transporteur
            </h3>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nom du transporteur *</label>
            <input
              required
              value={carrierName}
              onChange={(e) => setCarrierName(e.target.value)}
              placeholder="Ex. Yalidine, ZR Express, Kazitour..."
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Mode de connexion</label>
            <select
              value={apiProvider}
              onChange={(e) => setApiProvider(e.target.value)}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
            >
              <option value="manual">Manuel (Grille tarifaire gérée ici)</option>
              <option value="yalidine_future">Connecteur API Yalidine (futur)</option>
              <option value="zrexpress_future">Connecteur API ZR Express (futur)</option>
              <option value="custom_api">Connecteur API personnalisé (futur)</option>
            </select>
          </div>
          {apiProvider !== 'manual' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Endpoint API (optionnel)</label>
              <input
                value={apiEndpoint}
                onChange={(e) => setApiEndpoint(e.target.value)}
                placeholder="https://api.transporteur.dz/..."
                className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
              />
            </div>
          )}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Les 58 wilayas sont générées à 0 DZD afin que vous saisissiez uniquement vos tarifs officiels vérifiés. Aucune connexion API externe n’est simulée.
          </p>
          <button
            type="submit"
            disabled={addingCarrier}
            className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>{addingCarrier ? 'Création...' : 'Créer le transporteur'}</span>
          </button>
        </form>

        <div className="lg:col-span-8 space-y-3">
          {carriers.map((c) => (
            <div
              key={c.id}
              className={`bg-white border rounded-xl p-4 flex flex-wrap items-center justify-between gap-3 ${
                activeCarrierId === c.id ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
              }`}
            >
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-display font-semibold text-sm text-slate-900">{c.name}</p>
                  <span className="text-[11px] font-mono text-slate-500">({c.code})</span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  Modes : {c.supportsHome ? 'Domicile' : ''}{c.supportsHome && c.supportsStopDesk ? ' + ' : ''}
                  {c.supportsStopDesk ? 'STOP DESK' : ''} · API :{' '}
                  {c.apiConfigured ? 'Connectée' : 'Gestion manuelle (API non connectée)'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedCarrierId(c.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                    activeCarrierId === c.id
                      ? 'bg-blue-700 text-white'
                      : 'border border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Grille 58 wilayas
                </button>
                <button
                  type="button"
                  onClick={() => toggleCarrierActive(c)}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold ${
                    c.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {c.isActive ? 'Actif' : 'Désactivé'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 58-Wilaya Editable Rates Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-display font-semibold text-base text-slate-900">
              Tarifs de livraison — {carriers.find((c) => c.id === activeCarrierId)?.name || 'Transporteur'}
            </h3>
            <p className="text-xs text-slate-500">
              Modifiez directement vos tarifs À domicile et STOP DESK en DZD puis cliquez sur Enregistrer.
            </p>
          </div>
          <div className="relative w-64">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={wilayaSearch}
              onChange={(e) => setWilayaSearch(e.target.value)}
              placeholder="Rechercher une wilaya..."
              className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-300"
            />
          </div>
        </div>

        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500 sticky top-0">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Wilaya</th>
                <th className="py-2.5 px-4 font-semibold">À domicile (DZD)</th>
                <th className="py-2.5 px-4 font-semibold">STOP DESK (DZD)</th>
                <th className="py-2.5 px-4 font-semibold">Délai estimé</th>
                <th className="py-2.5 px-4 font-semibold">Actif</th>
                <th className="py-2.5 px-4 font-semibold text-right">Enregistrer</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRates.map((r) => {
                const draft = rateEdits[r.id] || {
                  homePriceDzd: r.homePriceDzd,
                  stopDeskPriceDzd: r.stopDeskPriceDzd,
                  estimatedDays: r.estimatedDays,
                  isActive: r.isActive,
                };
                return (
                  <tr key={r.id} className="hover:bg-slate-50">
                    <td className="py-2 px-4 text-xs font-medium text-slate-900">
                      <span className="font-mono text-slate-400 mr-1.5">{r.wilayaCode}</span>
                      {r.wilayaName}
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        min={0}
                        value={draft.homePriceDzd}
                        onChange={(e) =>
                          setRateEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, homePriceDzd: Number(e.target.value) },
                          }))
                        }
                        className="w-28 px-2.5 py-1 text-xs rounded border border-slate-300 font-mono tabular-nums"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="number"
                        min={0}
                        value={draft.stopDeskPriceDzd}
                        onChange={(e) =>
                          setRateEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, stopDeskPriceDzd: Number(e.target.value) },
                          }))
                        }
                        className="w-28 px-2.5 py-1 text-xs rounded border border-slate-300 font-mono tabular-nums"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        value={draft.estimatedDays}
                        onChange={(e) =>
                          setRateEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, estimatedDays: e.target.value },
                          }))
                        }
                        className="w-24 px-2.5 py-1 text-xs rounded border border-slate-300"
                      />
                    </td>
                    <td className="py-2 px-4">
                      <input
                        type="checkbox"
                        checked={draft.isActive}
                        onChange={(e) =>
                          setRateEdits((prev) => ({
                            ...prev,
                            [r.id]: { ...draft, isActive: e.target.checked },
                          }))
                        }
                      />
                    </td>
                    <td className="py-2 px-4 text-right">
                      <button
                        type="button"
                        disabled={savingRateId === r.id}
                        onClick={() => handleSaveRate(r)}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                      >
                        {savedRateId === r.id ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                            <span>OK</span>
                          </>
                        ) : (
                          <>
                            <Save className="w-3.5 h-3.5" />
                            <span>Enregistrer</span>
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 13. SOCIAL LINKS
// ---------------------------------------------------------------------------
export function AdminSocialLinks({
  socialLinks,
  onRefresh,
}: {
  socialLinks: any[];
  onRefresh: () => void;
}) {
  const [platform, setPlatform] = useState('instagram');
  const [label, setLabel] = useState('');
  const [urlOrHandle, setUrlOrHandle] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [saving, setSaving] = useState(false);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !urlOrHandle.trim()) return;
    setSaving(true);
    try {
      await adminFetch('/api/admin/social-links', {
        method: 'POST',
        body: JSON.stringify({ platform, label, urlOrHandle, pixelId: pixelId || null }),
      });
      setLabel('');
      setUrlOrHandle('');
      setPixelId('');
      onRefresh();
    } finally {
      setSaving(false);
    }
  };

  const toggleLink = async (s: any) => {
    await adminFetch(`/api/admin/social-links/${s.id}`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive: !s.isActive }),
    });
    onRefresh();
  };

  const deleteLink = async (id: number) => {
    await adminFetch(`/api/admin/social-links/${id}`, { method: 'DELETE' });
    onRefresh();
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      <form
        onSubmit={handleAdd}
        className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
      >
        <div className="flex items-center gap-2">
          <Globe className="w-4 h-4 text-blue-700" />
          <h3 className="font-display font-semibold text-base text-slate-900">
            Ajouter un réseau social
          </h3>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Plateforme</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
          >
            <option value="whatsapp">WhatsApp</option>
            <option value="instagram">Instagram</option>
            <option value="facebook">Facebook</option>
            <option value="tiktok">TikTok</option>
            <option value="youtube">YouTube</option>
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Libellé affiché *</label>
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex. Instagram @2freresphone"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">URL ou lien direct *</label>
          <input
            required
            value={urlOrHandle}
            onChange={(e) => setUrlOrHandle(e.target.value)}
            placeholder="https://instagram.com/2freresphone"
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Pixel ID (optionnel)</label>
          <input
            value={pixelId}
            onChange={(e) => setPixelId(e.target.value)}
            placeholder="Meta Pixel / TikTok Pixel ID"
            className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 font-mono"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
        >
          {saving ? 'Ajout...' : 'Enregistrer le réseau'}
        </button>
      </form>

      <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
            <tr>
              <th className="py-3 px-4 font-semibold">Plateforme</th>
              <th className="py-3 px-4 font-semibold">Lien / Identifiant</th>
              <th className="py-3 px-4 font-semibold">Pixel</th>
              <th className="py-3 px-4 font-semibold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {socialLinks.map((s) => (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="py-3 px-4">
                  <p className="font-medium text-slate-900">{s.label}</p>
                  <p className="text-xs text-slate-400 uppercase">{s.platform}</p>
                </td>
                <td className="py-3 px-4 text-xs text-blue-700 break-all">{s.urlOrHandle}</td>
                <td className="py-3 px-4 font-mono text-xs text-slate-500">{s.pixelId || '—'}</td>
                <td className="py-3 px-4 text-right">
                  <div className="inline-flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => toggleLink(s)}
                      className={`px-2.5 py-1 rounded text-xs font-semibold ${
                        s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {s.isActive ? 'Visible' : 'Masqué'}
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteLink(s.id)}
                      className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                      aria-label="Supprimer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// 14. GENERAL SETTINGS + DIRECT PLATFORM LOGO UPLOAD + LOW STOCK ALERT CONFIG
// ---------------------------------------------------------------------------
export function AdminSettings({
  settings,
  emailProviderConfigured,
  onRefresh,
}: {
  settings: any;
  emailProviderConfigured: boolean;
  onRefresh: () => void;
}) {
  const [form, setForm] = useState<any>(settings || {});
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const [adminsList, setAdminsList] = useState<any[]>([]);
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminName, setNewAdminName] = useState('');
  const [savingAdmin, setSavingAdmin] = useState(false);

  const loadAdmins = React.useCallback(async () => {
    try {
      const res = await adminFetch<{ admins: any[] }>('/api/admin/admins');
      setAdminsList(res.admins || []);
    } catch {
      // ignore initial load error if unauthenticated
    }
  }, []);

  React.useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  React.useEffect(() => {
    loadAdmins();
  }, [loadAdmins]);

  const handleAddAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAdminEmail.trim()) return;
    setSavingAdmin(true);
    setFeedback(null);
    try {
      await adminFetch('/api/admin/admins', {
        method: 'POST',
        body: JSON.stringify({
          email: newAdminEmail.trim().toLowerCase(),
          fullName: newAdminName.trim() || 'Co-gérant 2Frères Phone',
          role: 'super_admin',
        }),
      });
      setNewAdminEmail('');
      setNewAdminName('');
      setFeedback({ type: 'ok', msg: 'Nouveau compte administrateur Google ajouté et autorisé immédiatement.' });
      await loadAdmins();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message || 'Erreur lors de l’ajout du compte administrateur.' });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleToggleAdmin = async (adm: any) => {
    setFeedback(null);
    try {
      await adminFetch(`/api/admin/admins/${adm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !adm.isActive }),
      });
      await loadAdmins();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message });
    }
  };

  const handleDeleteAdmin = async (adm: any) => {
    setFeedback(null);
    try {
      await adminFetch(`/api/admin/admins/${adm.id}`, { method: 'DELETE' });
      setFeedback({ type: 'ok', msg: `Accès supprimé pour ${adm.email}.` });
      await loadAdmins();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message });
    }
  };

  const handleUploadLogo = async (file: File | undefined) => {
    if (!file) return;
    setUploadingLogo(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'logo');
      const res = await adminFetch<{ url: string }>('/api/admin/media/upload', {
        method: 'POST',
        body: fd,
      });
      setForm((prev: any) => ({ ...prev, logoUrl: res.url }));
      setFeedback({
        type: 'ok',
        msg: 'Logo de la plateforme téléversé et appliqué sur toute la boutique et l’administration.',
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message || 'Erreur lors du téléversement du logo.' });
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogo = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({ logoUrl: null }),
      });
      setForm((prev: any) => ({ ...prev, logoUrl: null }));
      setFeedback({ type: 'ok', msg: 'Logo retiré. Le nom texte 2Frères Phone est affiché par défaut.' });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      await adminFetch('/api/admin/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          storeName: form.storeName,
          tagline: form.tagline,
          whatsappPhone: form.whatsappPhone,
          supportEmail: form.supportEmail,
          adminAlertEmail: form.adminAlertEmail,
          defaultLowStockThreshold: Number(form.defaultLowStockThreshold ?? 10),
          storeAddress: form.storeAddress,
          codEnabled: Boolean(form.codEnabled),
          digitalOrderNote: form.digitalOrderNote,
        }),
      });
      setFeedback({ type: 'ok', msg: 'Paramètres généraux enregistrés avec succès.' });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message || 'Erreur lors de la sauvegarde.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          {feedback.msg}
        </div>
      )}

      {/* PLATFORM LOGO UPLOADER CARD */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <div className="flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-blue-700" />
              <h3 className="font-display font-bold text-base text-slate-900">
                Logo officiel de la plateforme
              </h3>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Téléversez directement votre logo depuis votre PC ou téléphone. Il est stocké en base de données et affiché automatiquement dans l’en-tête boutique, le pied de page et le back-office.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold cursor-pointer">
              <Upload className="w-4 h-4" />
              <span>{uploadingLogo ? 'Téléversement...' : 'Choisir / Téléverser le logo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml"
                disabled={uploadingLogo}
                className="hidden"
                onChange={(e) => handleUploadLogo(e.target.files?.[0])}
              />
            </label>
            {form.logoUrl && (
              <button
                type="button"
                disabled={saving}
                onClick={handleRemoveLogo}
                className="px-3 py-2 rounded-lg border border-slate-300 hover:bg-red-50 hover:text-red-600 text-xs font-semibold text-slate-600"
              >
                Retirer
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-xl p-5 bg-white">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-3">
              Aperçu en-tête boutique (fond clair)
            </p>
            <BrandLogo logoUrl={form.logoUrl} storeName={form.storeName || '2Frères Phone'} variant="light" size="lg" />
          </div>
          <div className="border border-slate-800 rounded-xl p-5 bg-slate-900">
            <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wide mb-3">
              Aperçu back-office (fond sombre)
            </p>
            <BrandLogo logoUrl={form.logoUrl} storeName={form.storeName || '2Frères Phone'} variant="dark" size="lg" />
          </div>
        </div>
      </div>

      {/* GENERAL SETTINGS & LOW STOCK ALERTS FORM */}
      <form onSubmit={handleSaveSettings} className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <h3 className="font-display font-bold text-base text-slate-900">
          Identité boutique, WhatsApp &amp; Alertes stock faible
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de la boutique</label>
            <input
              value={form.storeName || ''}
              onChange={(e) => setForm({ ...form, storeName: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Téléphone WhatsApp commandes</label>
            <input
              value={form.whatsappPhone || ''}
              onChange={(e) => setForm({ ...form, whatsappPhone: e.target.value })}
              placeholder="213550000000"
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Slogan / Sous-titre</label>
          <input
            value={form.tagline || ''}
            onChange={(e) => setForm({ ...form, tagline: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Adresse magasin</label>
            <input
              value={form.storeAddress || ''}
              onChange={(e) => setForm({ ...form, storeAddress: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">E-mail support client</label>
            <input
              type="email"
              value={form.supportEmail || ''}
              onChange={(e) => setForm({ ...form, supportEmail: e.target.value })}
              className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
            />
          </div>
        </div>

        {/* Low Stock Alert Settings */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
          <div className="flex items-center gap-2">
            <Mail className="w-4 h-4 text-blue-700" />
            <h4 className="font-semibold text-sm text-slate-900">Alertes de stock faible</h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Seuil global par défaut (unités)
              </label>
              <input
                type="number"
                min={0}
                value={form.defaultLowStockThreshold ?? 10}
                onChange={(e) => setForm({ ...form, defaultLowStockThreshold: Number(e.target.value) })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white font-mono"
              />
              <p className="text-[11px] text-slate-500 mt-1">
                Chaque produit peut aussi avoir son propre seuil personnalisé dans sa fiche.
              </p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                E-mail destinataire des alertes stock
              </label>
              <input
                type="email"
                value={form.adminAlertEmail || ''}
                onChange={(e) => setForm({ ...form, adminAlertEmail: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              />
            </div>
          </div>

          <div
            className={`p-3 rounded-lg border text-xs flex items-start gap-2 ${
              emailProviderConfigured
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <Info className="w-4 h-4 shrink-0 mt-0.5" />
            <span>
              {emailProviderConfigured
                ? 'Serveur e-mail configuré : les alertes stock faible sont envoyées automatiquement par e-mail à chaque passage sous le seuil.'
                : 'Envoi e-mail en attente de configuration SMTP/Resend : les alertes apparaissent immédiatement dans le tableau de bord. Ajoutez RESEND_API_KEY ou SMTP_HOST/SMTP_USER/SMTP_PASS dans vos variables d’environnement Vercel pour activer l’envoi réel par e-mail.'}
            </span>
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">
            Message informatif produits numériques (affiché sur la boutique)
          </label>
          <textarea
            rows={2}
            value={form.digitalOrderNote || ''}
            onChange={(e) => setForm({ ...form, digitalOrderNote: e.target.value })}
            className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
        </div>

        <label className="inline-flex items-center gap-2 text-sm text-slate-700 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(form.codEnabled)}
            onChange={(e) => setForm({ ...form, codEnabled: e.target.checked })}
          />
          <span>Activer le Paiement à la livraison (COD) comme mode principal</span>
        </label>

        <div className="pt-2 flex justify-end">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold"
          >
            <Save className="w-4 h-4" />
            <span>{saving ? 'Enregistrement...' : 'Enregistrer les paramètres'}</span>
          </button>
        </div>
      </form>

      {/* Authorized Admin Accounts Card */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>Comptes administrateurs autorisés</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Ajoutez une deuxième adresse Gmail (ex. celle de votre frère) pour lui donner un accès complet au
              back-office via la connexion Google.
            </p>
          </div>
        </div>

        <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="email"
            required
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="adresse.frere@gmail.com"
            className="sm:col-span-5 px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <input
            type="text"
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            placeholder="Nom (ex. Co-gérant)"
            className="sm:col-span-4 px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <button
            type="submit"
            disabled={savingAdmin}
            className="sm:col-span-3 inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{savingAdmin ? 'Ajout...' : 'Autoriser'}</span>
          </button>
        </form>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Compte Google</th>
                <th className="py-2.5 px-4 font-semibold">Nom</th>
                <th className="py-2.5 px-4 font-semibold">Statut</th>
                <th className="py-2.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {adminsList.map((adm) => (
                <tr key={adm.id} className="hover:bg-slate-50">
                  <td className="py-2.5 px-4 font-mono text-xs text-slate-900">{adm.email}</td>
                  <td className="py-2.5 px-4 text-xs text-slate-600">{adm.fullName}</td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[11px] font-semibold ${
                        adm.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {adm.isActive ? 'Actif' : 'Désactivé'}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="inline-flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleToggleAdmin(adm)}
                        className="px-2 py-1 rounded border border-slate-200 hover:bg-slate-100 text-[11px] font-medium text-slate-700"
                      >
                        {adm.isActive ? 'Désactiver' : 'Réactiver'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteAdmin(adm)}
                        className="p-1.5 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                        aria-label="Supprimer cet administrateur"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
