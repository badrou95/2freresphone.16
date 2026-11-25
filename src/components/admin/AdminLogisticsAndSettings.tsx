import React, { useMemo, useState } from 'react';
import {
  CheckCircle2,
  Globe,
  Image as ImageIcon,
  Info,
  Mail,
  Pencil,
  Plus,
  Power,
  PowerOff,
  Save,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import {
  ADMIN_TEAM_ROLES,
  AdminTeamRole,
  formatDzd,
  getSaasConfig,
  saveSaasConfig,
} from '../../shared/domain';
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
  const [shippingPricesEnabled, setShippingPricesEnabled] = useState<boolean>(
    () => getSaasConfig().shippingPricesEnabled !== false,
  );
  const [busyAction, setBusyAction] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  // Add carrier form
  const [carrierName, setCarrierName] = useState('');
  const [apiProvider, setApiProvider] = useState('manual');
  const [apiEndpoint, setApiEndpoint] = useState('');
  const [addingCarrier, setAddingCarrier] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeCarrierId = selectedCarrierId || carriers[0]?.id || 0;
  const activeCarriersCount = carriers.filter((c) => c.isActive).length;

  const filteredRates = useMemo(() => {
    const q = wilayaSearch.trim().toLowerCase();
    return shippingRates
      .filter((r) => r.carrierId === activeCarrierId)
      .filter((r) => !q || `${r.wilayaCode} ${r.wilayaName}`.toLowerCase().includes(q));
  }, [shippingRates, activeCarrierId, wilayaSearch]);

  const handleToggleGlobalShippingPrices = () => {
    const nextVal = !shippingPricesEnabled;
    saveSaasConfig({ shippingPricesEnabled: nextVal });
    setShippingPricesEnabled(nextVal);
    setStatusMsg(
      nextVal
        ? 'Prix des transporteurs activés sur la boutique.'
        : 'Prix des transporteurs désactivés sur toute la boutique (0 DZD facturé).',
    );
  };

  const handleAddCarrier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!carrierName.trim()) return;
    setAddingCarrier(true);
    setError(null);
    setStatusMsg(null);
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
      setStatusMsg(`Transporteur ${res.carrier?.name || ''} ajouté avec sa grille 58 wilayas.`);
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
    setBusyAction(true);
    setError(null);
    setStatusMsg(null);
    try {
      const nextActive = !c.isActive;
      await adminFetch(`/api/admin/carriers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      setStatusMsg(
        nextActive
          ? `Transporteur ${c.name} activé.`
          : `Transporteur ${c.name} désactivé (ses prix ne sont plus appliqués).`,
      );
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleSetExclusiveCarrier = async (c: any) => {
    setBusyAction(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await adminFetch<{ message: string }>(`/api/admin/carriers/${c.id}/set-exclusive`, {
        method: 'POST',
        body: JSON.stringify({ activateRates: true }),
      });
      setSelectedCarrierId(c.id);
      setStatusMsg(res.message || `${c.name} est désormais votre unique transporteur actif.`);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleToggleCarrierMode = async (c: any, field: 'supportsHome' | 'supportsStopDesk') => {
    setBusyAction(true);
    setError(null);
    setStatusMsg(null);
    try {
      const nextVal = !c[field];
      await adminFetch(`/api/admin/carriers/${c.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: nextVal }),
      });
      const label = field === 'supportsHome' ? 'Livraison à Domicile' : 'Bureau Stop Desk';
      setStatusMsg(`${c.name} : mode « ${label} » ${nextVal ? 'activé' : 'désactivé'}.`);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleDeleteCarrier = async (c: any) => {
    setBusyAction(true);
    setError(null);
    setStatusMsg(null);
    try {
      await adminFetch(`/api/admin/carriers/${c.id}`, { method: 'DELETE' });
      setStatusMsg(`Transporteur ${c.name} supprimé.`);
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleBulkRatesAction = async (
    carrierId: number,
    action: 'deactivate_all' | 'activate_all' | 'zero_prices',
  ) => {
    if (!carrierId) return;
    setBusyAction(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await adminFetch<{ message: string }>(
        `/api/admin/carriers/${carrierId}/bulk-rates`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        },
      );
      setRateEdits({});
      setStatusMsg(res.message || 'Grille 58 wilayas mise à jour.');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  const handleGlobalBulkAction = async (
    action: 'deactivate_all_carriers' | 'deactivate_all_prices' | 'activate_all_prices',
  ) => {
    setBusyAction(true);
    setError(null);
    setStatusMsg(null);
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/carriers/bulk-all', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      if (action === 'deactivate_all_prices') {
        saveSaasConfig({ shippingPricesEnabled: false });
        setShippingPricesEnabled(false);
      } else if (action === 'activate_all_prices') {
        saveSaasConfig({ shippingPricesEnabled: true });
        setShippingPricesEnabled(true);
      }
      setRateEdits({});
      setStatusMsg(res.message || 'Opération globale effectuée.');
      onRefresh();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusyAction(false);
    }
  };

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">{error}</div>
      )}
      {statusMsg && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <span className="font-semibold">{statusMsg}</span>
          <button type="button" onClick={() => setStatusMsg(null)} className="underline font-bold">
            OK
          </button>
        </div>
      )}

      {/* Global Carrier Prices & Exclusive Mode Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-5 border border-slate-800 flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-bold">
              2FP WilayaConnect · Contrôle des Transporteurs &amp; Tarifs
            </span>
            <span className="text-xs text-slate-300">
              {activeCarriersCount} transporteur(s) actif(s)
            </span>
          </div>
          <h3 className="font-display font-bold text-base">
            Activez uniquement votre société de livraison ou désactivez les prix des transporteurs
          </h3>
          <p className="text-xs text-slate-300">
            Cliquez sur <strong>« Activer uniquement »</strong> sur le transporteur avec lequel vous travaillez pour
            désactiver automatiquement les autres, activez/désactivez les modes <strong>Domicile</strong> et{' '}
            <strong>Stop Desk</strong>, ou désactivez tous les prix de livraison en un clic.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleToggleGlobalShippingPrices}
            className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold transition-colors ${
              shippingPricesEnabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {shippingPricesEnabled ? (
              <>
                <Power className="w-3.5 h-3.5" />
                <span>Prix Transporteurs : ACTIVÉS (Désactiver)</span>
              </>
            ) : (
              <>
                <PowerOff className="w-3.5 h-3.5" />
                <span>Prix Transporteurs : DÉSACTIVÉS (Réactiver)</span>
              </>
            )}
          </button>
          <button
            type="button"
            disabled={busyAction}
            onClick={() => handleGlobalBulkAction('deactivate_all_prices')}
            className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold"
          >
            Désactiver tous les prix (0 DZD)
          </button>
          <button
            type="button"
            disabled={busyAction}
            onClick={() => handleGlobalBulkAction('deactivate_all_carriers')}
            className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-200 text-xs font-semibold"
          >
            Désactiver tous les transporteurs
          </button>
        </div>
      </div>

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
              <option value="yalidine_future">Connecteur API Yalidine</option>
              <option value="zrexpress_future">Connecteur API ZR Express</option>
              <option value="custom_api">Connecteur API personnalisé</option>
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
            Les 58 wilayas sont générées à 0 DZD afin que vous saisissiez uniquement vos tarifs officiels vérifiés.
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
          {carriers.map((c) => {
            const isExclusive = Boolean(c.isActive) && activeCarriersCount === 1;
            return (
              <div
                key={c.id}
                className={`bg-white border rounded-xl p-4 space-y-3 ${
                  activeCarrierId === c.id ? 'border-blue-600 ring-1 ring-blue-600' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-display font-semibold text-sm text-slate-900">{c.name}</p>
                      <span className="text-[11px] font-mono text-slate-500">({c.code})</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          isExclusive
                            ? 'bg-emerald-700 text-white'
                            : c.isActive
                            ? 'bg-emerald-100 text-emerald-900'
                            : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {isExclusive ? 'UNIQUE ACTIF ★' : c.isActive ? 'ACTIF' : 'DÉSACTIVÉ'}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Cliquez sur les modes ci-dessous pour activer ou désactiver Domicile / Stop Desk pour ce transporteur.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {!isExclusive && (
                      <button
                        type="button"
                        disabled={busyAction}
                        onClick={() => handleSetExclusiveCarrier(c)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold"
                        title="Active uniquement ce transporteur et désactive tous les autres"
                      >
                        <Star className="w-3.5 h-3.5 fill-white" />
                        <span>Activer uniquement</span>
                      </button>
                    )}
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
                      disabled={busyAction}
                      onClick={() => toggleCarrierActive(c)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        c.isActive
                          ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                          : 'bg-slate-900 hover:bg-slate-800 text-white'
                      }`}
                    >
                      {c.isActive ? 'Désactiver' : 'Activer'}
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleDeleteCarrier(c)}
                      className="p-1.5 rounded-lg border border-slate-200 text-slate-400 hover:text-red-600 hover:bg-red-50"
                      title="Supprimer ce transporteur"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Delivery Mode Switches: Domicile & Stop Desk + Quick Rate Deactivation */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold text-slate-600">Modes de transport :</span>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleToggleCarrierMode(c, 'supportsHome')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        c.supportsHome !== false
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                      }`}
                    >
                      Livraison à Domicile : {c.supportsHome !== false ? 'Activé' : 'Désactivé'}
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleToggleCarrierMode(c, 'supportsStopDesk')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                        c.supportsStopDesk !== false
                          ? 'bg-blue-50 text-blue-800 border-blue-300'
                          : 'bg-slate-100 text-slate-400 border-slate-200 line-through'
                      }`}
                    >
                      Bureau Stop Desk : {c.supportsStopDesk !== false ? 'Activé' : 'Désactivé'}
                    </button>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleBulkRatesAction(c.id, 'deactivate_all')}
                      className="px-2.5 py-1 rounded-lg border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-900 text-[11px] font-bold"
                    >
                      Désactiver prix 58 wilayas
                    </button>
                    <button
                      type="button"
                      disabled={busyAction}
                      onClick={() => handleBulkRatesAction(c.id, 'activate_all')}
                      className="px-2.5 py-1 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 text-[11px] font-bold"
                    >
                      Réactiver prix 58 wilayas
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
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
              Modifiez directement vos tarifs À domicile et STOP DESK en DZD ou désactivez tous les prix en 1 clic.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {activeCarrierId > 0 && (
              <>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => handleBulkRatesAction(activeCarrierId, 'deactivate_all')}
                  className="px-3 py-1.5 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 text-xs font-bold"
                >
                  Tout désactiver (58 Wilayas)
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => handleBulkRatesAction(activeCarrierId, 'zero_prices')}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold"
                >
                  Mettre tous les prix à 0 DZD
                </button>
                <button
                  type="button"
                  disabled={busyAction}
                  onClick={() => handleBulkRatesAction(activeCarrierId, 'activate_all')}
                  className="px-3 py-1.5 rounded-lg bg-emerald-100 hover:bg-emerald-200 text-emerald-900 text-xs font-bold"
                >
                  Tout réactiver (58 Wilayas)
                </button>
              </>
            )}
            <div className="relative w-56">
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
// 13. SOCIAL LINKS (ADD + EDIT + TOGGLE + DELETE)
// ---------------------------------------------------------------------------
export function AdminSocialLinks({
  socialLinks,
  onRefresh,
}: {
  socialLinks: any[];
  onRefresh: () => void;
}) {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [platform, setPlatform] = useState('instagram');
  const [label, setLabel] = useState('');
  const [urlOrHandle, setUrlOrHandle] = useState('');
  const [pixelId, setPixelId] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);
  const formRef = React.useRef<HTMLFormElement | null>(null);

  const resetForm = () => {
    setEditingId(null);
    setPlatform('instagram');
    setLabel('');
    setUrlOrHandle('');
    setPixelId('');
  };

  const startEdit = (s: any) => {
    setEditingId(s.id);
    setPlatform(s.platform || 'instagram');
    setLabel(s.label || '');
    setUrlOrHandle(s.urlOrHandle || '');
    setPixelId(s.pixelId || '');
    setFeedback(null);
    formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !urlOrHandle.trim()) return;
    setSaving(true);
    setFeedback(null);
    try {
      if (editingId !== null) {
        await adminFetch(`/api/admin/social-links/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify({
            platform,
            label: label.trim(),
            urlOrHandle: urlOrHandle.trim(),
            pixelId: pixelId.trim() || null,
          }),
        });
        setFeedback({ type: 'ok', msg: 'Lien du réseau social modifié avec succès.' });
      } else {
        await adminFetch('/api/admin/social-links', {
          method: 'POST',
          body: JSON.stringify({
            platform,
            label: label.trim(),
            urlOrHandle: urlOrHandle.trim(),
            pixelId: pixelId.trim() || null,
          }),
        });
        setFeedback({ type: 'ok', msg: 'Réseau social ajouté avec succès.' });
      }
      resetForm();
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Erreur lors de l’enregistrement.' });
    } finally {
      setSaving(false);
    }
  };

  const toggleLink = async (s: any) => {
    setFeedback(null);
    try {
      await adminFetch(`/api/admin/social-links/${s.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Erreur de mise à jour.' });
    }
  };

  const deleteLink = async (id: number) => {
    setFeedback(null);
    try {
      await adminFetch(`/api/admin/social-links/${id}`, { method: 'DELETE' });
      if (editingId === id) resetForm();
      setFeedback({ type: 'ok', msg: 'Lien supprimé.' });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Erreur lors de la suppression.' });
    }
  };

  return (
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          ref={formRef}
          onSubmit={handleSubmit}
          className={`lg:col-span-4 bg-white border rounded-xl p-5 space-y-4 h-fit ${
            editingId !== null ? 'border-blue-400 ring-2 ring-blue-100' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Globe className="w-4 h-4 text-blue-700" />
              <h3 className="font-display font-semibold text-base text-slate-900">
                {editingId !== null ? 'Modifier le réseau social' : 'Ajouter un réseau social'}
              </h3>
            </div>
            {editingId !== null && (
              <button
                type="button"
                onClick={resetForm}
                className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-500 hover:bg-slate-100"
              >
                <X className="w-3.5 h-3.5" />
                <span>Annuler</span>
              </button>
            )}
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
              <option value="snapchat">Snapchat</option>
              <option value="telegram">Telegram</option>
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
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className={`flex-1 py-2.5 px-4 rounded-lg text-white text-xs font-semibold ${
                editingId !== null
                  ? 'bg-blue-700 hover:bg-blue-800'
                  : 'bg-slate-900 hover:bg-slate-800'
              }`}
            >
              {saving
                ? 'Enregistrement...'
                : editingId !== null
                  ? 'Enregistrer les modifications'
                  : 'Enregistrer le réseau'}
            </button>
          </div>
        </form>

        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
          {socialLinks.length === 0 ? (
            <div className="p-8 text-center text-sm text-slate-500">
              Aucun réseau social configuré pour le moment.
            </div>
          ) : (
            <>
              {/* Mobile Cards */}
              <div className="divide-y divide-slate-100 md:hidden">
                {socialLinks.map((s) => (
                  <div
                    key={s.id}
                    className={`p-4 space-y-2.5 ${editingId === s.id ? 'bg-blue-50/50' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{s.label}</p>
                        <p className="text-[11px] font-semibold text-slate-400 uppercase">{s.platform}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggleLink(s)}
                        className={`px-2.5 py-1 rounded text-xs font-semibold ${
                          s.isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                        }`}
                      >
                        {s.isActive ? 'Visible' : 'Masqué'}
                      </button>
                    </div>
                    <p className="text-xs text-blue-700 break-all">{s.urlOrHandle}</p>
                    {s.pixelId && (
                      <p className="text-[11px] font-mono text-slate-500">Pixel : {s.pixelId}</p>
                    )}
                    <div className="flex items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => startEdit(s)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 text-xs font-semibold hover:bg-blue-100"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                        <span>Modifier</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteLink(s.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-slate-600 hover:text-red-600 hover:bg-red-50 text-xs font-semibold"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Supprimer</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table */}
              <div className="hidden md:block overflow-x-auto">
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
                      <tr
                        key={s.id}
                        className={`hover:bg-slate-50 ${editingId === s.id ? 'bg-blue-50/50' : ''}`}
                      >
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{s.label}</p>
                          <p className="text-xs text-slate-400 uppercase">{s.platform}</p>
                        </td>
                        <td className="py-3 px-4 text-xs text-blue-700 break-all">{s.urlOrHandle}</td>
                        <td className="py-3 px-4 font-mono text-xs text-slate-500">{s.pixelId || '—'}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => startEdit(s)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold"
                            >
                              <Pencil className="w-3 h-3" />
                              <span>Modifier</span>
                            </button>
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
            </>
          )}
        </div>
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
  const [newAdminRole, setNewAdminRole] = useState<AdminTeamRole>('confirmateur');
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
          fullName: newAdminName.trim() || 'Membre Équipe 2Frères Phone',
          role: newAdminRole,
        }),
      });
      setNewAdminEmail('');
      setNewAdminName('');
      setFeedback({
        type: 'ok',
        msg: 'Nouveau membre d’équipe (2FP TeamGuard) ajouté avec ses permissions dédiées.',
      });
      await loadAdmins();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message || 'Erreur lors de l’ajout du compte administrateur.' });
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleChangeAdminRole = async (adm: any, role: AdminTeamRole) => {
    setFeedback(null);
    try {
      await adminFetch(`/api/admin/admins/${adm.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      setFeedback({ type: 'ok', msg: `Rôle mis à jour pour ${adm.email}.` });
      await loadAdmins();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err.message });
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

      {/* Authorized Admin & Team Sub-Accounts Card (2FP TeamGuard) */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-700" />
              <span>2FP TeamGuard — Équipe, Co-gérants &amp; Sous-Comptes avec Permissions</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">
              Ajoutez des comptes Google avec des rôles précis : <strong>Super Admin</strong> (accès total + compta),{' '}
              <strong>Confirmateur Centre d’Appel</strong> (uniquement commandes &amp; clients sans accès à la compta) ou{' '}
              <strong>Préparateur / Logistique</strong> (uniquement colis, transporteurs &amp; imprimante).
            </p>
          </div>
        </div>

        <form onSubmit={handleAddAdmin} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
          <input
            type="email"
            required
            value={newAdminEmail}
            onChange={(e) => setNewAdminEmail(e.target.value)}
            placeholder="membre.equipe@gmail.com"
            className="sm:col-span-4 px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <input
            type="text"
            value={newAdminName}
            onChange={(e) => setNewAdminName(e.target.value)}
            placeholder="Nom (ex. Confirmateur 1)"
            className="sm:col-span-3 px-3 py-2 text-sm rounded-lg border border-slate-300"
          />
          <select
            value={newAdminRole}
            onChange={(e) => setNewAdminRole(e.target.value as AdminTeamRole)}
            className="sm:col-span-3 px-2.5 py-2 text-xs font-semibold rounded-lg border border-slate-300 bg-white"
          >
            {ADMIN_TEAM_ROLES.map((r) => (
              <option key={r.value} value={r.value}>
                {r.label}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={savingAdmin}
            className="sm:col-span-2 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{savingAdmin ? 'Ajout...' : 'Ajouter'}</span>
          </button>
        </form>

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-2.5 px-4 font-semibold">Compte Google</th>
                <th className="py-2.5 px-4 font-semibold">Nom</th>
                <th className="py-2.5 px-4 font-semibold">Rôle &amp; Permissions</th>
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
                    <select
                      value={adm.role || 'super_admin'}
                      onChange={(e) => handleChangeAdminRole(adm, e.target.value as AdminTeamRole)}
                      className="px-2 py-1 text-xs font-semibold rounded border border-slate-300 bg-white"
                    >
                      {ADMIN_TEAM_ROLES.map((r) => (
                        <option key={r.value} value={r.value}>
                          {r.label}
                        </option>
                      ))}
                    </select>
                  </td>
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
