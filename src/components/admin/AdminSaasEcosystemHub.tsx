import { useState } from 'react';
import {
  Bell,
  CheckCircle2,
  Copy,
  ExternalLink,
  FileSpreadsheet,
  Globe,
  Languages,
  Layers,
  MessageCircle,
  Palette,
  Plus,
  Power,
  PowerOff,
  Radio,
  Rocket,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Trash2,
  Truck,
  Zap,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { clearTrackedPixelEventsLog, getTrackedPixelEventsLog } from '../../lib/pixels';
import {
  DEFAULT_SAAS_CONFIG,
  getActiveCurrency,
  getActiveLang,
  getSaasConfig,
  SaasFeaturesConfig,
  saveSaasConfig,
  setActiveCurrency,
  setActiveLang,
  StoreCurrency,
  StoreLang,
} from '../../shared/domain';

interface AdminSaasEcosystemHubProps {
  carriers: any[];
  onRefresh: () => void;
  onNavigateTab: (tab: string) => void;
}

const ALGERIAN_CARRIER_PRESETS = [
  {
    name: 'Yalidine Express',
    code: 'YALIDINE',
    contactPhone: '023 80 40 50',
    apiNotes: 'Leader national 58 wilayas · Livraison à domicile & Bureaux Stop Desk (COD)',
  },
  {
    name: 'ZR Express',
    code: 'ZREXPRESS',
    contactPhone: '0560 00 11 22',
    apiNotes: 'Réseau rapide 58 wilayas · Recouvrement COD & Stop Desk pro',
  },
  {
    name: 'Maystro Delivery',
    code: 'MAYSTRO',
    contactPhone: '0550 99 88 77',
    apiNotes: 'Logistique e-commerce Algérie & intégration 2FP ColisGuard / Confirmation centre d’appel',
  },
  {
    name: 'Noest Express',
    code: 'NOEST',
    contactPhone: '0561 44 55 66',
    apiNotes: 'Messagerie express nord, hauts plateaux & sud Algérie',
  },
  {
    name: 'Guepex Delivery',
    code: 'GUEPEX',
    contactPhone: '0555 22 33 44',
    apiNotes: 'Transporteur rapide COD & Stop Desk multi-wilayas',
  },
  {
    name: 'Ecotrack / DHD',
    code: 'ECOTRACK',
    contactPhone: '0540 12 34 56',
    apiNotes: 'Agrégateur logistique algérien multi-transporteurs COD',
  },
];

const PROPRIETARY_2FP_MODULES = [
  {
    group: 'Modules Propriétaires 2Frères Phone — Marché Algérien (100% COD & Logistique 58 Wilayas)',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    platforms: [
      {
        name: '2FP DzCore & 1 541 Communes',
        origin: 'Natif Algérie (DZD)',
        featuresIntegrated: [
          'Interface bilingue Français / العربية (RTL automatique)',
          'Sélecteur officiel des communes d’Algérie lié aux 58 Wilayas',
          'Devise DZD par défaut & Paiement 100% à la livraison (COD)',
        ],
      },
      {
        name: '2FP WilayaConnect & CodReconcile',
        origin: 'Logistique & Pointage COD',
        featuresIntegrated: [
          'Activation/désactivation par transporteur et par mode (Domicile & Stop Desk)',
          'Réconciliation COD des versements transporteurs (Encaissé vs En attente)',
          'Génération automatique de bordereaux de suivi en 1 clic',
        ],
      },
      {
        name: '2FP CallCenter & ColisGuard',
        origin: 'Confirmation & Anti-Retour',
        featuresIntegrated: [
          'File d’appels dédiée (Appel 1, Appel 2, Reporté, Confirmé, Faux numéro)',
          'Score de fiabilité numéro client (Historique Livrées vs Retours)',
          'Blocage anti-spam & Liste noire numéro en 1 clic',
        ],
      },
      {
        name: '2FP AbandonGuard & PostUpsell',
        origin: 'Récupération & Panier +',
        featuresIntegrated: [
          'Capture automatique en temps réel des commandes COD abandonnées',
          'Relance WhatsApp 1-clic & conversion directe en commande confirmée',
          'Upsell Post-Achat en 1 clic sur l’écran de remerciement (0 DZD livraison)',
        ],
      },
      {
        name: '2FP PixelEngine & AdCatalogFeed',
        origin: 'Marketing & Pixels',
        featuresIntegrated: [
          'Pixels natifs Meta/Facebook, TikTok, Snapchat & Google Tag',
          'Flux Catalogue Publicitaire Automatique XML & CSV en DZD (/api/feed/catalog.xml)',
          'Synchronisation temps réel avec Google Sheets via Webhook (2FP SheetsSync)',
        ],
      },
      {
        name: '2FP FormBuilder & TeamGuard',
        origin: 'Personnalisation & Équipe',
        featuresIntegrated: [
          'Personnalisateur du formulaire COD (champs Adresse, Notes, Texte & Couleur bouton)',
          'Sous-comptes Équipe avec rôles (Super Admin, Admin, Confirmateur, Préparateur)',
          'Calculateur de rentabilité Net COD, ROAS & CPA publicitaire',
        ],
      },
    ],
  },
];

export function AdminSaasEcosystemHub({
  carriers,
  onRefresh,
  onNavigateTab,
}: AdminSaasEcosystemHubProps) {
  const [config, setConfig] = useState<SaasFeaturesConfig>(() => getSaasConfig());
  const [activeCurrency, setCurrencyState] = useState<StoreCurrency>(() => getActiveCurrency());
  const [activeLang, setLangState] = useState<StoreLang>(() => getActiveLang());
  const [provisioningCode, setProvisioningCode] = useState<string | null>(null);
  const [busyCarrierId, setBusyCarrierId] = useState<number | null>(null);
  const [installingAllCarriers, setInstallingAllCarriers] = useState(false);
  const [bulkPriceBusy, setBulkPriceBusy] = useState(false);
  const [testingSheets, setTestingSheets] = useState(false);
  const [pixelEvents, setPixelEvents] = useState<any[]>(() => getTrackedPixelEventsLog());
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateConfig = (patch: Partial<SaasFeaturesConfig>) => {
    const next = saveSaasConfig(patch);
    setConfig(next);
    setStatusMessage('Configuration 2FP Pro enregistrée et appliquée instantanément sur la boutique.');
  };

  const handleResetDefaults = () => {
    const next = saveSaasConfig(DEFAULT_SAAS_CONFIG);
    setConfig(next);
    setStatusMessage('Paramètres 2FP Pro rétablis aux valeurs recommandées.');
  };

  const findInstalledCarrier = (code: string, name: string) =>
    carriers.find(
      (c) =>
        String(c.code || '').toUpperCase() === code.toUpperCase() ||
        String(c.name || '').toLowerCase().includes(name.toLowerCase().split(' ')[0]),
    ) || null;

  const handleInstallCarrier = async (
    preset: (typeof ALGERIAN_CARRIER_PRESETS)[number],
    exclusive = false,
  ) => {
    setProvisioningCode(preset.code);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await adminFetch<{ carrier: any }>('/api/admin/carriers', {
        method: 'POST',
        body: JSON.stringify({
          name: preset.name,
          code: preset.code,
          contactPhone: preset.contactPhone,
          apiNotes: preset.apiNotes,
          isActive: true,
          seedDefaultRates: true,
        }),
      });
      if (exclusive && res.carrier?.id) {
        await adminFetch(`/api/admin/carriers/${res.carrier.id}/set-exclusive`, {
          method: 'POST',
          body: JSON.stringify({ activateRates: true }),
        });
        setStatusMessage(
          `${preset.name} est installé et activé comme votre UNIQUE transporteur (les autres ont été désactivés).`,
        );
      } else {
        setStatusMessage(
          `Transporteur ${preset.name} ajouté avec succès (+ grille tarifaire 58 Wilayas Domicile & Stop Desk).`,
        );
      }
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || `Impossible d'installer ${preset.name}.`);
    } finally {
      setProvisioningCode(null);
    }
  };

  const handleToggleCarrierActive = async (carrier: any) => {
    setBusyCarrierId(carrier.id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const nextActive = !carrier.isActive;
      await adminFetch(`/api/admin/carriers/${carrier.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: nextActive }),
      });
      setStatusMessage(
        nextActive
          ? `Transporteur ${carrier.name} activé.`
          : `Transporteur ${carrier.name} désactivé (ses tarifs ne sont plus appliqués sur la boutique).`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors du changement de statut du transporteur.');
    } finally {
      setBusyCarrierId(null);
    }
  };

  const handleSetExclusiveCarrier = async (carrier: any) => {
    setBusyCarrierId(carrier.id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await adminFetch<{ message: string }>(
        `/api/admin/carriers/${carrier.id}/set-exclusive`,
        {
          method: 'POST',
          body: JSON.stringify({ activateRates: true }),
        },
      );
      setStatusMessage(
        res.message || `${carrier.name} est désormais votre unique transporteur actif.`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de l’activation exclusive.');
    } finally {
      setBusyCarrierId(null);
    }
  };

  const handleToggleCarrierMode = async (
    carrier: any,
    field: 'supportsHome' | 'supportsStopDesk',
  ) => {
    setBusyCarrierId(carrier.id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const nextVal = !carrier[field];
      await adminFetch(`/api/admin/carriers/${carrier.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ [field]: nextVal }),
      });
      const modeLabel = field === 'supportsHome' ? 'Livraison à Domicile' : 'Bureau Stop Desk';
      setStatusMessage(
        `${carrier.name} : mode « ${modeLabel} » ${nextVal ? 'activé' : 'désactivé'}.`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Impossible de modifier ce mode de transport.');
    } finally {
      setBusyCarrierId(null);
    }
  };

  const handleBulkCarrierPrices = async (
    carrier: any,
    action: 'deactivate_all' | 'activate_all' | 'zero_prices',
  ) => {
    setBusyCarrierId(carrier.id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await adminFetch<{ message: string }>(
        `/api/admin/carriers/${carrier.id}/bulk-rates`,
        {
          method: 'POST',
          body: JSON.stringify({ action }),
        },
      );
      setStatusMessage(res.message || 'Tarifs du transporteur mis à jour.');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la mise à jour des tarifs.');
    } finally {
      setBusyCarrierId(null);
    }
  };

  const handleDeleteCarrier = async (carrier: any) => {
    setBusyCarrierId(carrier.id);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await adminFetch(`/api/admin/carriers/${carrier.id}`, { method: 'DELETE' });
      setStatusMessage(`Transporteur ${carrier.name} supprimé.`);
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la suppression du transporteur.');
    } finally {
      setBusyCarrierId(null);
    }
  };

  const handleGlobalCarrierAction = async (
    action: 'deactivate_all_carriers' | 'deactivate_all_prices' | 'activate_all_prices',
  ) => {
    setBulkPriceBusy(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      const res = await adminFetch<{ message: string }>('/api/admin/carriers/bulk-all', {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      if (action === 'deactivate_all_prices') {
        const next = saveSaasConfig({ shippingPricesEnabled: false });
        setConfig(next);
      } else if (action === 'activate_all_prices') {
        const next = saveSaasConfig({ shippingPricesEnabled: true });
        setConfig(next);
      }
      setStatusMessage(res.message || 'Opération effectuée.');
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de l’opération globale sur les transporteurs.');
    } finally {
      setBulkPriceBusy(false);
    }
  };

  const handleInstallAllMissingCarriers = async () => {
    const missing = ALGERIAN_CARRIER_PRESETS.filter((p) => !findInstalledCarrier(p.code, p.name));
    if (missing.length === 0) {
      setStatusMessage('Tous les transporteurs algériens sont déjà installés.');
      return;
    }
    setInstallingAllCarriers(true);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      for (const preset of missing) {
        await adminFetch('/api/admin/carriers', {
          method: 'POST',
          body: JSON.stringify({
            name: preset.name,
            code: preset.code,
            contactPhone: preset.contactPhone,
            apiNotes: preset.apiNotes,
            isActive: false, // Installed as inactive so the merchant activates only the one they work with!
            seedDefaultRates: true,
          }),
        });
      }
      setStatusMessage(
        `${missing.length} transporteur(s) installés (en mode désactivé par défaut : cliquez sur « Activer uniquement » sur la société avec laquelle vous travaillez).`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la synchronisation des transporteurs.');
    } finally {
      setInstallingAllCarriers(false);
    }
  };

  const activeCarriersCount = carriers.filter((c) => c.isActive).length;

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <Rocket className="w-3.5 h-3.5" />
              <span>Suite Propriétaire 2Frères Phone (2FP Pro) · 100% Paiement à la Livraison (COD)</span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl">
              Centre de Pilotage 2FP Pro : Conversion COD, Livraison 58 Wilayas &amp; Modules Exclusifs
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Activez ou désactivez librement vos modules exclusifs <strong>2Frères Phone</strong> (formulaire COD
              1-Page <em>2FP ExpressCheckout</em>, packs dégressifs <em>2FP BoostCOD</em>, bouclier anti-retour{' '}
              <em>2FP ColisGuard</em>, studio photo <em>2FP Lumina IA</em>) et choisissez uniquement le transporteur et
              les modes de livraison avec lesquels vous travaillez.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              Exporter Colis Transporteurs
            </button>
            <button
              type="button"
              onClick={handleResetDefaults}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700"
            >
              Valeurs recommandées
            </button>
          </div>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-3">
          <span className="inline-flex items-center gap-2 font-semibold">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            {statusMessage}
          </span>
          <button
            type="button"
            onClick={() => setStatusMessage(null)}
            className="font-bold underline"
          >
            OK
          </button>
        </div>
      )}

      {errorMessage && (
        <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 flex items-center justify-between gap-3">
          <span>{errorMessage}</span>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="font-bold underline"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Algerian Delivery Carriers: Activate ONLY Your Carrier + Deactivate Prices & Transport Modes */}
      <div className="bg-white border-2 border-emerald-600 rounded-2xl p-5 space-y-5 shadow-xs">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-100 pb-4">
          <div className="flex items-start gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="font-display font-bold text-base text-slate-900">
                  2FP WilayaConnect — Transporteurs, Modes de Transport &amp; Activation/Désactivation des Prix
                </h3>
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
                  {activeCarriersCount} transporteur(s) actif(s)
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Activez <strong>uniquement la société de livraison avec laquelle vous travaillez</strong>, désactivez
                les autres transporteurs, choisissez vos modes (<strong>Domicile</strong> / <strong>Stop Desk</strong>)
                ou désactivez complètement les prix des transporteurs en 1 clic.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              disabled={bulkPriceBusy}
              onClick={() => handleGlobalCarrierAction('deactivate_all_prices')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
            >
              <PowerOff className="w-3.5 h-3.5" />
              <span>Désactiver tous les prix transporteurs (0 DZD)</span>
            </button>
            <button
              type="button"
              disabled={bulkPriceBusy}
              onClick={() => handleGlobalCarrierAction('activate_all_prices')}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
            >
              <Power className="w-3.5 h-3.5" />
              <span>Réactiver les prix transporteurs</span>
            </button>
            <button
              type="button"
              disabled={bulkPriceBusy}
              onClick={() => handleGlobalCarrierAction('deactivate_all_carriers')}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 disabled:opacity-50 text-slate-700 text-xs font-bold"
            >
              <span>Tout désactiver</span>
            </button>
            <button
              type="button"
              disabled={installingAllCarriers}
              onClick={handleInstallAllMissingCarriers}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-50 text-white text-xs font-bold"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>
                {installingAllCarriers ? 'Ajout...' : 'Ajouter les transporteurs à la liste'}
              </span>
            </button>
          </div>
        </div>

        {/* Global Switch for Carrier Prices Display & Billing */}
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-bold text-slate-900">
              Facturation &amp; Affichage des prix des transporteurs sur la boutique (Fiches produits, Panier &amp; Landing Pages)
            </p>
            <p className="text-[11px] text-slate-600 mt-0.5">
              {config.shippingPricesEnabled
                ? 'ACTIF : Les tarifs 58 Wilayas du transporteur actif sont calculés automatiquement selon le mode (Domicile ou Stop Desk).'
                : 'DÉSACTIVÉ : Aucun prix de transporteur n’est facturé sur le site (0 DZD — livraison confirmée par téléphone avec le client).'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateConfig({ shippingPricesEnabled: !config.shippingPricesEnabled })}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
              config.shippingPricesEnabled
                ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {config.shippingPricesEnabled ? (
              <>
                <Power className="w-4 h-4" />
                <span>Prix Transporteurs : ACTIVÉS (Cliquer pour Désactiver)</span>
              </>
            ) : (
              <>
                <PowerOff className="w-4 h-4" />
                <span>Prix Transporteurs : DÉSACTIVÉS (Cliquer pour Réactiver)</span>
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {ALGERIAN_CARRIER_PRESETS.map((preset) => {
            const installedCarrier = findInstalledCarrier(preset.code, preset.name);
            const isActive = Boolean(installedCarrier?.isActive);
            const isExclusive = isActive && activeCarriersCount === 1;
            const busy =
              provisioningCode === preset.code ||
              (installedCarrier && busyCarrierId === installedCarrier.id);

            return (
              <div
                key={preset.code}
                className={`p-4 rounded-xl border-2 flex flex-col justify-between gap-3 transition-all ${
                  isActive
                    ? 'border-emerald-600 bg-emerald-50/40 shadow-xs'
                    : installedCarrier
                    ? 'border-slate-200 bg-white'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-slate-900">
                      {preset.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        isExclusive
                          ? 'bg-emerald-700 text-white'
                          : isActive
                          ? 'bg-emerald-600 text-white'
                          : installedCarrier
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isExclusive
                        ? 'UNIQUE ACTIF ★'
                        : isActive
                        ? 'ACTIF · 58 WILAYAS'
                        : installedCarrier
                        ? 'DÉSACTIVÉ'
                        : 'NON ACTIVÉ'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{preset.apiNotes}</p>

                  {/* Transport Modes Toggles (Domicile & Stop Desk) when installed */}
                  {installedCarrier && (
                    <div className="pt-2 space-y-1.5">
                      <p className="text-[11px] font-bold text-slate-700">
                        Modes de transport autorisés :
                      </p>
                      <div className="grid grid-cols-2 gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => handleToggleCarrierMode(installedCarrier, 'supportsHome')}
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border text-center transition-colors ${
                            installedCarrier.supportsHome !== false
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-slate-100 text-slate-500 border-slate-300 line-through'
                          }`}
                        >
                          Domicile : {installedCarrier.supportsHome !== false ? 'Actif' : 'OFF'}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            handleToggleCarrierMode(installedCarrier, 'supportsStopDesk')
                          }
                          className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold border text-center transition-colors ${
                            installedCarrier.supportsStopDesk !== false
                              ? 'bg-blue-600 text-white border-blue-700'
                              : 'bg-slate-100 text-slate-500 border-slate-300 line-through'
                          }`}
                        >
                          Stop Desk :{' '}
                          {installedCarrier.supportsStopDesk !== false ? 'Actif' : 'OFF'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-2 pt-2 border-t border-slate-200/80">
                  {installedCarrier ? (
                    <>
                      <div className="flex flex-wrap items-center gap-1.5">
                        {!isExclusive && (
                          <button
                            type="button"
                            disabled={Boolean(busy)}
                            onClick={() => handleSetExclusiveCarrier(installedCarrier)}
                            className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
                            title="Active uniquement ce transporteur et désactive tous les autres"
                          >
                            <Star className="w-3 h-3 fill-white" />
                            <span>Activer uniquement</span>
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => handleToggleCarrierActive(installedCarrier)}
                          className={`flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold ${
                            isActive
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border border-amber-300'
                              : 'bg-slate-900 hover:bg-slate-800 text-white'
                          }`}
                        >
                          {isActive ? (
                            <>
                              <PowerOff className="w-3 h-3" />
                              <span>Désactiver</span>
                            </>
                          ) : (
                            <>
                              <Power className="w-3 h-3" />
                              <span>Activer</span>
                            </>
                          )}
                        </button>
                      </div>

                      <div className="flex items-center justify-between gap-1.5">
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() =>
                            handleBulkCarrierPrices(installedCarrier, 'deactivate_all')
                          }
                          className="px-2 py-1 rounded border border-slate-300 bg-white hover:bg-slate-100 text-[10px] font-semibold text-slate-700"
                          title="Désactiver les prix des 58 wilayas pour ce transporteur"
                        >
                          Désactiver prix
                        </button>
                        <button
                          type="button"
                          onClick={() => onNavigateTab('carriers')}
                          className="text-[11px] font-bold text-emerald-800 hover:underline"
                        >
                          Tarifs 58 wilayas →
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(busy)}
                          onClick={() => handleDeleteCarrier(installedCarrier)}
                          className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50"
                          title="Retirer ce transporteur"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  ) : (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => handleInstallCarrier(preset, true)}
                        className="flex-1 inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-[11px] font-bold"
                        title="Installer et activer uniquement cette société de livraison"
                      >
                        <Star className="w-3 h-3 fill-white" />
                        <span>{busy ? 'Activation...' : 'Activer uniquement'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={Boolean(busy)}
                        onClick={() => handleInstallCarrier(preset, false)}
                        className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[11px] font-bold"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Ajouter</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Control Grid: Conversion Engine + Experience & Anti-Return Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Conversion Engine (2FP ExpressCheckout / 2FP BoostCOD / 2FP SmartCatalog) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Moteur de Conversion COD &amp; Fiche Produit (2FP ExpressCheckout &amp; BoostCOD)
                </h3>
                <p className="text-xs text-slate-500">
                  Maximisez vos commandes directes à la livraison sur mobile et augmentez le panier moyen
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Formulaire de commande COD Express 1-Page sur chaque fiche produit (2FP ExpressCheckout)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permet au client de commander directement depuis la page produit en choisissant sa Wilaya, Commune et
                  son mode de livraison avec mémorisation automatique des coordonnées.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.directCodFormOnProduct}
                onChange={(e) => updateConfig({ directCodFormOnProduct: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Offres Packs Dégressifs COD (1x Standard · 2x -10% Populaire · 3x -15% + Livraison Offerte)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Module <strong>2FP BoostCOD</strong> : augmente le panier moyen en DZD sur les accessoires et cartes gaming.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.quantityBundlesEnabled}
                onChange={(e) => updateConfig({ quantityBundlesEnabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Ventes Croisées « Complétez votre colis COD (-5% + 0 DZD livraison supp.) » (2FP SmartCatalog)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Propose d’ajouter un article complémentaire en 1 clic dans le même colis COD sans frais de port additionnels.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.crossSellBundlesEnabled}
                onChange={(e) => updateConfig({ crossSellBundlesEnabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Barre d’achat flottante en bas d’écran (Sticky COD Express Bar)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Garde le prix et le bouton « Commander COD (58 Wilayas) » toujours visibles lors du défilement sur smartphone.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.stickyCartBarEnabled}
                onChange={(e) => updateConfig({ stickyCartBarEnabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Preuve sociale, Compteur de visiteurs &amp; Délai d’expédition Wilaya (2FP ChronoWilaya)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Affiche le nombre de visiteurs consultant l’article, l’alerte de stock faible et le délai d’expédition vers la wilaya choisie.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.urgencyVisitorsEnabled}
                onChange={(e) =>
                  updateConfig({
                    urgencyVisitorsEnabled: e.target.checked,
                    sameDayDispatchTimerEnabled: e.target.checked,
                  })
                }
                className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>
          </div>
        </div>

        {/* 2. Anti-Retour Call-Center, WhatsApp Quick Order, Bilingual FR/AR & Multi-Currency Display */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
                <MessageCircle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Bouclier Anti-Retour COD (2FP ColisGuard), WhatsApp Direct &amp; Bilingue FR / العربية
                </h3>
                <p className="text-xs text-slate-500">
                  Réduisez les retours de colis et adaptez la vitrine à tous vos clients algériens
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Système Anti-Retour &amp; Confirmation Call-Center WhatsApp 1-Clic (2FP ColisGuard)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Affiche l’historique de fiabilité du numéro client (commandes livrées vs retournées) et permet de confirmer chaque commande sur WhatsApp en 1 clic.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.antiReturnScoreEnabled}
                onChange={(e) => updateConfig({ antiReturnScoreEnabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
            </label>

            <label className="flex items-start justify-between gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">
                  Bouton WhatsApp Flottant « Commande COD &amp; Assistance 2FP Direct »
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Affiche un bouton WhatsApp permanent en bas à droite de la boutique pour accompagner les clients qui préfèrent commander par message.
                </p>
              </div>
              <input
                type="checkbox"
                checked={config.whatsappFloatingButtonEnabled}
                onChange={(e) => updateConfig({ whatsappFloatingButtonEnabled: e.target.checked })}
                className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-900">Sélecteur FR / العربية</p>
                  <p className="text-[11px] text-slate-500">Bilingue RTL en 1 clic (2FP DzCore)</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.bilingualArFrEnabled}
                  onChange={(e) => updateConfig({ bilingualArFrEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
              </label>

              <div className="flex items-center justify-between gap-2 p-3 rounded-xl border border-emerald-200 bg-emerald-50/60">
                <div>
                  <p className="text-xs font-bold text-slate-900">Devise Officielle Unique</p>
                  <p className="text-[11px] text-emerald-800 font-semibold">Dinar Algérien (DZD / DA) uniquement</p>
                </div>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold">
                  100% DZD
                </span>
              </div>
            </div>

            {/* Active Language Quick Tester */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold inline-flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-amber-400" />
                  Langue de l’interface boutique (2FP DzCore FR/AR) :
                </span>
                <div className="inline-flex rounded-lg bg-slate-800 p-1 gap-1">
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLang('fr');
                      setLangState('fr');
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      activeLang === 'fr' ? 'bg-blue-600 text-white' : 'text-slate-300'
                    }`}
                  >
                    Français (FR)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveLang('ar');
                      setLangState('ar');
                    }}
                    className={`px-2.5 py-1 rounded text-xs font-bold ${
                      activeLang === 'ar' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'
                    }`}
                  >
                    العربية (AR)
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* NEW: 2FP PixelEngine, Flux Catalogue Publicitaire XML/CSV & Google Sheets Live Sync */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 2FP PixelEngine & 2FP AdCatalogFeed */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Radio className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  2FP PixelEngine &amp; Flux Catalogue Publicitaire (Meta &amp; TikTok)
                </h3>
                <p className="text-xs text-slate-500">
                  Pixels natifs (ViewContent, AddToCart, InitiateCheckout, Purchase) + Flux XML/CSV DZD
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Meta / Facebook Pixel ID
              </label>
              <input
                type="text"
                value={config.metaPixelId}
                onChange={(e) => updateConfig({ metaPixelId: e.target.value })}
                placeholder="Ex. 123456789012345"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                TikTok Pixel ID
              </label>
              <input
                type="text"
                value={config.tiktokPixelId}
                onChange={(e) => updateConfig({ tiktokPixelId: e.target.value })}
                placeholder="Ex. C8ABCDEF123456"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Snapchat Pixel ID
              </label>
              <input
                type="text"
                value={config.snapchatPixelId}
                onChange={(e) => updateConfig({ snapchatPixelId: e.target.value })}
                placeholder="Ex. a1b2c3d4-e5f6..."
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Google Tag / Ads ID
              </label>
              <input
                type="text"
                value={config.googleTagId}
                onChange={(e) => updateConfig({ googleTagId: e.target.value })}
                placeholder="Ex. G-XXXXXXXXXX"
                className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300"
              />
            </div>
          </div>

          {/* 2FP AdCatalogFeed XML & CSV */}
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <p className="text-xs font-bold text-slate-900">
              Flux Catalogue Publicitaire Automatique (2FP AdCatalogFeed · Devise DZD)
            </p>
            <p className="text-[11px] text-slate-600">
              Copiez ces liens dans Meta Commerce Manager ou TikTok Ads Manager pour synchroniser automatiquement vos produits en stock :
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const url = `${window.location.origin}/api/feed/catalog.xml`;
                  navigator.clipboard?.writeText(url);
                  setStatusMessage(`Lien Flux XML copié : ${url}`);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Copier Lien XML (Meta/FB)</span>
              </button>
              <a
                href="/api/feed/catalog.xml"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-100 text-xs font-semibold text-slate-700"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Ouvrir XML</span>
              </a>
              <a
                href="/api/feed/catalog.csv"
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Télécharger Flux CSV (TikTok/Meta)</span>
              </a>
            </div>
          </div>

          {/* Live Pixel Event Log */}
          <div className="p-3 rounded-xl bg-slate-900 text-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-emerald-400">
                Journal des événements Pixels déclenchés ({pixelEvents.length})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPixelEvents(getTrackedPixelEventsLog())}
                  className="text-[10px] underline text-slate-300 hover:text-white"
                >
                  Actualiser
                </button>
                {pixelEvents.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      clearTrackedPixelEventsLog();
                      setPixelEvents([]);
                    }}
                    className="text-[10px] underline text-red-400 hover:text-red-300"
                  >
                    Vider
                  </button>
                )}
              </div>
            </div>
            {pixelEvents.length === 0 ? (
              <p className="text-[11px] text-slate-400">
                Aucun événement enregistré dans cette session. Ouvrez une fiche produit pour tester ViewContent / Purchase.
              </p>
            ) : (
              <div className="max-h-28 overflow-y-auto space-y-1 font-mono text-[10px]">
                {pixelEvents.slice(0, 8).map((ev, idx) => (
                  <div key={idx} className="flex items-center justify-between text-slate-300">
                    <span className="text-emerald-300 font-bold">{ev.event}</span>
                    <span className="truncate max-w-[180px]">{ev.payload?.content_name || ''}</span>
                    <span>{ev.payload?.value ? `${ev.payload.value} DZD` : ''}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2FP FormBuilder, 1 541 Communes, AbandonGuard, PostUpsell, Anti-Spam & SheetsSync */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
                <Palette className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  2FP FormBuilder, Communes d’Algérie, AbandonGuard &amp; Google Sheets
                </h3>
                <p className="text-xs text-slate-500">
                  Personnalisez le formulaire COD, l’Upsell post-achat, l’Anti-Spam et le Webhook Google Sheets
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Sélecteur Communes Officiel</p>
                <p className="text-[10px] text-slate-500">Lié aux 58 Wilayas d’Algérie</p>
              </div>
              <input
                type="checkbox"
                checked={config.communeDropdownEnabled}
                onChange={(e) => updateConfig({ communeDropdownEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">2FP AbandonGuard</p>
                <p className="text-[10px] text-slate-500">Capture auto paniers COD</p>
              </div>
              <input
                type="checkbox"
                checked={config.abandonedOrdersCaptureEnabled}
                onChange={(e) => updateConfig({ abandonedOrdersCaptureEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-amber-600"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Champ Adresse complète</p>
                <p className="text-[10px] text-slate-500">Afficher dans le formulaire COD</p>
              </div>
              <input
                type="checkbox"
                checked={config.formShowAddressField}
                onChange={(e) => updateConfig({ formShowAddressField: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Champ Note / Remarque</p>
                <p className="text-[10px] text-slate-500">Afficher dans le formulaire COD</p>
              </div>
              <input
                type="checkbox"
                checked={config.formShowNotesField}
                onChange={(e) => updateConfig({ formShowNotesField: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Upsell Post-Achat 1-Clic</p>
                <p className="text-[10px] text-slate-500">-{config.postPurchaseUpsellDiscountPct}% sur l’écran Merci</p>
              </div>
              <input
                type="checkbox"
                checked={config.postPurchaseUpsellEnabled}
                onChange={(e) => updateConfig({ postPurchaseUpsellEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div>
                <p className="text-xs font-bold text-slate-900">Anti-Spam &amp; Faux Numéros</p>
                <p className="text-[10px] text-slate-500">Cooldown {config.antiSpamCooldownMinutes} min / N°</p>
              </div>
              <input
                type="checkbox"
                checked={config.antiSpamEnabled}
                onChange={(e) => updateConfig({ antiSpamEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-red-600"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5 text-blue-700" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Alerte Sonore Admin</p>
                  <p className="text-[10px] text-slate-500">Sonnerie nouvelle commande</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.adminOrderSoundEnabled}
                onChange={(e) => updateConfig({ adminOrderSoundEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-blue-700"
              />
            </label>

            <label className="flex items-center justify-between gap-2 p-2.5 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
              <div className="flex items-center gap-1.5">
                <Smartphone className="w-3.5 h-3.5 text-emerald-700" />
                <div>
                  <p className="text-xs font-bold text-slate-900">Mode Application Mobile</p>
                  <p className="text-[10px] text-slate-500">Bandeau d’installation PWA</p>
                </div>
              </div>
              <input
                type="checkbox"
                checked={config.pwaInstallBannerEnabled}
                onChange={(e) => updateConfig({ pwaInstallBannerEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-slate-300 text-emerald-600"
              />
            </label>
          </div>

          {/* CTA Text, Color & Store Theme */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Texte du bouton de commande COD
              </label>
              <input
                type="text"
                value={config.formCtaText}
                onChange={(e) => updateConfig({ formCtaText: e.target.value })}
                className="w-full px-3 py-1.5 text-xs rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Couleur du bouton COD
              </label>
              <select
                value={config.formCtaColor}
                onChange={(e) => updateConfig({ formCtaColor: e.target.value as any })}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="emerald">Vert Émeraude (COD)</option>
                <option value="blue">Bleu 2FP Officiel</option>
                <option value="red">Rouge Promo</option>
                <option value="amber">Orange Express</option>
                <option value="slate">Noir Carbone</option>
              </select>
            </div>
          </div>

          {/* Google Sheets Live Webhook Sync */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 inline-flex items-center gap-1.5">
                <FileSpreadsheet className="w-4 h-4 text-emerald-700" />
                2FP SheetsSync — Synchronisation Google Sheets en Temps Réel
              </span>
              <input
                type="checkbox"
                checked={config.googleSheetsSyncEnabled}
                onChange={(e) => updateConfig({ googleSheetsSyncEnabled: e.target.checked })}
                className="h-4 w-4 rounded border-emerald-300 text-emerald-700"
              />
            </div>
            <div className="flex gap-2">
              <input
                type="url"
                value={config.googleSheetsWebhookUrl}
                onChange={(e) => updateConfig({ googleSheetsWebhookUrl: e.target.value })}
                placeholder="https://script.google.com/macros/s/.../exec"
                className="flex-1 px-3 py-1.5 text-xs font-mono rounded-lg border border-emerald-300 bg-white"
              />
              <button
                type="button"
                disabled={testingSheets || !config.googleSheetsWebhookUrl}
                onClick={async () => {
                  setTestingSheets(true);
                  setErrorMessage(null);
                  try {
                    const res = await adminFetch<{ message: string }>(
                      '/api/admin/webhooks/google-sheets-test',
                      {
                        method: 'POST',
                        body: JSON.stringify({ webhookUrl: config.googleSheetsWebhookUrl }),
                      },
                    );
                    setStatusMessage(res.message);
                  } catch (err: any) {
                    setErrorMessage(err?.message || 'Échec du test Webhook Google Sheets.');
                  } finally {
                    setTestingSheets(false);
                  }
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold whitespace-nowrap"
              >
                {testingSheets ? 'Envoi...' : 'Tester 1-Clic'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Bilingual Announcement Bar Editor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">
                Bandeau d’annonce Bilingue FR / العربية (Haut de boutique)
              </h3>
              <p className="text-xs text-slate-500">
                Affiche vos garanties de livraison 58 Wilayas et Paiement 100% à la livraison (COD) en Français et en Arabe
              </p>
            </div>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={config.announcementBarEnabled}
              onChange={(e) => updateConfig({ announcementBarEnabled: e.target.checked })}
              className="h-4 w-4 rounded border-slate-300 text-blue-700"
            />
            <span>Afficher le bandeau</span>
          </label>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message en Français (FR)
            </label>
            <input
              type="text"
              value={config.announcementTextFr}
              onChange={(e) => updateConfig({ announcementTextFr: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Message en Arabe (العربية)
            </label>
            <input
              type="text"
              dir="rtl"
              value={config.announcementTextAr}
              onChange={(e) => updateConfig({ announcementTextAr: e.target.value })}
              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
            />
          </div>
        </div>
      </div>

      {/* Proprietary 2Frères Phone Modules Architecture Matrix */}
      <div className="space-y-4">
        {PROPRIETARY_2FP_MODULES.map((section) => (
          <div
            key={section.group}
            className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs"
          >
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-blue-700" />
              <h3 className="font-display font-bold text-sm text-slate-900">{section.group}</h3>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {section.platforms.map((plat) => (
                <div
                  key={plat.name}
                  className="p-4 rounded-xl border border-slate-200 bg-slate-50/40 space-y-2.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-display font-bold text-sm text-slate-900">
                      {plat.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold border ${section.badgeColor}`}
                    >
                      {plat.origin}
                    </span>
                  </div>
                  <ul className="space-y-1.5">
                    {plat.featuresIntegrated.map((feat) => (
                      <li key={feat} className="flex items-start gap-2 text-xs text-slate-700">
                        <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
