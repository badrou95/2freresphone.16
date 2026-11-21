import { useState } from 'react';
import {
  CheckCircle2,
  Globe,
  Languages,
  Layers,
  MessageCircle,
  Plus,
  Rocket,
  ShieldCheck,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
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
    apiNotes: 'Logistique e-commerce Algérie & intégration Colisify / Confirmation centre d’appel',
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

const SAAS_BENCHMARKS = [
  {
    group: 'Plateformes SaaS Algériennes (100% Paiement à la livraison COD & Logistique 58 Wilayas)',
    badgeColor: 'bg-emerald-100 text-emerald-900 border-emerald-200',
    platforms: [
      {
        name: 'DZBuild',
        origin: 'Algérie (DZD)',
        featuresIntegrated: [
          'Interface bilingue Français / العربية (RTL automatique)',
          'Devise DZD par défaut & Paiement 100% à la livraison (COD)',
          'Synchronisation & Export transporteurs locaux (Yalidine, ZR Express, Maystro)',
        ],
      },
      {
        name: 'Arkan',
        origin: 'Algérie (DZD)',
        featuresIntegrated: [
          'Commandes COD illimitées sans commission par vente',
          'Connexion directe aux livreurs 58 wilayas (Domicile & Stop Desk)',
          'Génération automatique de bordereaux de suivi en 1 clic',
        ],
      },
      {
        name: 'Colisify',
        origin: 'Algérie (DZD)',
        featuresIntegrated: [
          'Score de fiabilité numéro client (Historique Livrées vs Retours)',
          'Bouton Call-Center WhatsApp 1-clic pour confirmer les commandes COD avant expédition',
          'Export CSV multi-transporteurs (Yalidine, ZR Express, Maystro, Ecotrack)',
        ],
      },
      {
        name: 'Mystoq',
        origin: 'Algérie (DZD)',
        featuresIntegrated: [
          'Vue Kanban des commandes COD par statut logistique',
          'Tarification automatique par Wilaya (Domicile vs Stop Desk)',
          'Remise en stock automatique en cas de retour ou annulation',
        ],
      },
      {
        name: 'Hanoutify',
        origin: 'Algérie (DZD)',
        featuresIntegrated: [
          'Formulaire de commande COD Express 1-Page directement sur la fiche produit',
          'Sauvegarde automatique des coordonnées client (commande en 5 secondes)',
          'Expérience ultra-rapide sur mobile avec squelettes de chargement',
        ],
      },
    ],
  },
  {
    group: 'Plateformes SaaS Internationales (Outils de Conversion, Design & Catalogue)',
    badgeColor: 'bg-blue-100 text-blue-900 border-blue-200',
    platforms: [
      {
        name: 'YouCan',
        origin: 'MENA / COD',
        featuresIntegrated: [
          'Offres dégressives / Packs Quantité COD (1x, 2x -10%, 3x -15% + Livraison offerte)',
          'Barre d’achat flottante en bas d’écran (Sticky COD Bar)',
          'Compteur d’urgence & visiteurs en temps réel sur la fiche produit',
        ],
      },
      {
        name: 'Shopify',
        origin: 'International',
        featuresIntegrated: [
          'Ventes croisées « Complétez votre colis COD (-5% + 0 DZD frais de port supp.) »',
          'Architecture catalogue haute performance avec variantes couleurs & badges de stock',
          'Affichage multi-devises indicatif (DZD · EUR € · USD $) avec paiement à la livraison',
        ],
      },
      {
        name: 'WiziShop & PagePilot IA',
        origin: 'France / Europe',
        featuresIntegrated: [
          'Générateur de Landing Pages IA (PagePilot) à fort taux de conversion COD',
          'Indicateur de délai d’expédition du jour par wilaya sur chaque fiche produit',
          'Bandeau d’annonce marketing personnalisable en Français et en Arabe',
        ],
      },
      {
        name: 'BigCommerce, Wix & Squarespace',
        origin: 'International',
        featuresIntegrated: [
          'Importation massive de catalogue & décodage binaire SQL Server (.MDF + .IDF)',
          'Squelettes de chargement (Skeleton Loaders) élégants sur l’accueil et le catalogue',
          'Impression thermique de reçus, étiquettes codes-barres et bons de livraison COD',
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
  const [installingAllCarriers, setInstallingAllCarriers] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const updateConfig = (patch: Partial<SaasFeaturesConfig>) => {
    const next = saveSaasConfig(patch);
    setConfig(next);
    setStatusMessage('Configuration SaaS enregistrée et appliquée instantanément sur la boutique.');
  };

  const handleResetDefaults = () => {
    const next = saveSaasConfig(DEFAULT_SAAS_CONFIG);
    setConfig(next);
    setStatusMessage('Paramètres SaaS rétablis aux valeurs recommandées.');
  };

  const isCarrierInstalled = (code: string, name: string) =>
    carriers.some(
      (c) =>
        String(c.code || '').toUpperCase() === code.toUpperCase() ||
        String(c.name || '').toLowerCase().includes(name.toLowerCase().split(' ')[0]),
    );

  const handleInstallCarrier = async (preset: (typeof ALGERIAN_CARRIER_PRESETS)[number]) => {
    setProvisioningCode(preset.code);
    setErrorMessage(null);
    setStatusMessage(null);
    try {
      await adminFetch('/api/admin/carriers', {
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
      setStatusMessage(
        `Transporteur ${preset.name} ajouté avec succès (+ grille tarifaire 58 Wilayas Domicile & Stop Desk générée).`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || `Impossible d'installer ${preset.name}.`);
    } finally {
      setProvisioningCode(null);
    }
  };

  const handleInstallAllMissingCarriers = async () => {
    const missing = ALGERIAN_CARRIER_PRESETS.filter((p) => !isCarrierInstalled(p.code, p.name));
    if (missing.length === 0) {
      setStatusMessage('Tous les transporteurs algériens sont déjà installés et actifs.');
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
            isActive: true,
            seedDefaultRates: true,
          }),
        });
      }
      setStatusMessage(
        `${missing.length} transporteur(s) algérien(s) installés avec leurs tarifs 58 Wilayas !`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMessage(err?.message || 'Erreur lors de la synchronisation des transporteurs.');
    } finally {
      setInstallingAllCarriers(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 border border-slate-800 shadow-lg">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2 max-w-3xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-bold">
              <Rocket className="w-3.5 h-3.5" />
              <span>Hub Écosystème SaaS Algérie (100% COD) &amp; Outils Internationaux</span>
            </div>
            <h2 className="font-display font-bold text-xl sm:text-2xl">
              Toutes les fonctions de DZBuild, Arkan, Colisify, Mystoq, Hanoutify, YouCan &amp; Shopify réunies
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              Activez et personnalisez en un clic les outils de conversion 100% Paiement à la livraison (formulaire COD
              1-Page sur fiche produit, packs dégressifs, ventes croisées dans le même colis, synchronisation 58 wilayas
              Yalidine / ZR Express / Maystro, Call-Center WhatsApp anti-retour et interface bilingue FR/AR).
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => onNavigateTab('orders')}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors"
            >
              Exporter Colis (Yalidine / ZR / Maystro)
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

      {/* Control Grid: Conversion Engine + Experience & Anti-Return Tools */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 1. Conversion Engine (YouCan / Hanoutify / Mystoq / WiziShop) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-display font-bold text-sm text-slate-900">
                  Moteur de Conversion COD &amp; Fiche Produit (YouCan / Hanoutify / DZBuild)
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
                  Formulaire de commande COD Express 1-Page sur chaque fiche produit
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Permet au client de commander directement depuis la page produit en choisissant sa Wilaya, Commune et
                  Domicile/Stop Desk avec mémorisation automatique des coordonnées (DZBuild, Arkan, Hanoutify &amp; YouCan).
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
                  Augmente le panier moyen en DZD sur les accessoires et cartes gaming (inspiré de YouCan &amp; Shopify Bundles).
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
                  Ventes Croisées « Complétez votre colis COD (-5% + 0 DZD livraison supp.) »
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
                  Preuve sociale, Compteur de visiteurs &amp; Délai d’expédition Wilaya (WiziShop / YouCan)
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
                  Anti-Retour COD (Colisify), WhatsApp Direct &amp; Bilingue FR / العربية
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
                  Système Anti-Retour &amp; Confirmation Call-Center WhatsApp 1-Clic (Colisify / Mystoq)
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
                  Bouton WhatsApp Flottant « Commande COD &amp; Assistance » (DZBuild / Hanoutify)
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
                  <p className="text-[11px] text-slate-500">Bilingue RTL en 1 clic</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.bilingualArFrEnabled}
                  onChange={(e) => updateConfig({ bilingualArFrEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-emerald-600"
                />
              </label>

              <label className="flex items-center justify-between gap-2 p-3 rounded-xl border border-slate-200 bg-slate-50/60 cursor-pointer">
                <div>
                  <p className="text-xs font-bold text-slate-900">Convertisseur Devises</p>
                  <p className="text-[11px] text-slate-500">DZD (défaut) · EUR · USD</p>
                </div>
                <input
                  type="checkbox"
                  checked={config.multiCurrencyEnabled}
                  onChange={(e) => updateConfig({ multiCurrencyEnabled: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600"
                />
              </label>
            </div>

            {/* Active Currency & Language Quick Tester */}
            <div className="p-3.5 rounded-xl bg-slate-900 text-white space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold inline-flex items-center gap-1.5">
                  <Globe className="w-4 h-4 text-emerald-400" />
                  Affichage devise sur la vitrine :
                </span>
                <div className="inline-flex rounded-lg bg-slate-800 p-1 gap-1">
                  {(['DZD', 'EUR', 'USD'] as StoreCurrency[]).map((cur) => (
                    <button
                      key={cur}
                      type="button"
                      onClick={() => {
                        setActiveCurrency(cur);
                        setCurrencyState(cur);
                      }}
                      className={`px-2.5 py-1 rounded text-xs font-bold transition-colors ${
                        activeCurrency === cur
                          ? 'bg-emerald-500 text-slate-950'
                          : 'text-slate-300 hover:text-white'
                      }`}
                    >
                      {cur}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
                <span className="text-xs font-bold inline-flex items-center gap-1.5">
                  <Languages className="w-4 h-4 text-amber-400" />
                  Langue de l’interface boutique (DZBuild FR/AR) :
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

      {/* Algerian Delivery Carriers 1-Click Sync (Yalidine, ZR Express, Maystro, Noest, Guepex, Ecotrack) */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-display font-bold text-sm text-slate-900">
                Synchronisation 1-Clic avec les Sociétés de Livraison Algériennes (58 Wilayas · COD)
              </h3>
              <p className="text-xs text-slate-500">
                Activez Yalidine, ZR Express, Maystro, Noest, Guepex et Ecotrack avec génération automatique des tarifs Domicile &amp; Stop Desk
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={installingAllCarriers}
            onClick={handleInstallAllMissingCarriers}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-bold shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>
              {installingAllCarriers
                ? 'Synchronisation 58 Wilayas...'
                : 'Installer tous les transporteurs DZ manquants'}
            </span>
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {ALGERIAN_CARRIER_PRESETS.map((preset) => {
            const installed = isCarrierInstalled(preset.code, preset.name);
            const busy = provisioningCode === preset.code;
            return (
              <div
                key={preset.code}
                className={`p-4 rounded-xl border flex flex-col justify-between gap-3 ${
                  installed
                    ? 'border-emerald-200 bg-emerald-50/40'
                    : 'border-slate-200 bg-slate-50/50'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-display font-bold text-sm text-slate-900">
                      {preset.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        installed
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {installed ? 'CONNECTÉ · 58 WILAYAS' : 'DISPONIBLE'}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">{preset.apiNotes}</p>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200/70">
                  <span className="text-[11px] font-mono text-slate-500">{preset.code}</span>
                  {installed ? (
                    <button
                      type="button"
                      onClick={() => onNavigateTab('carriers')}
                      className="text-xs font-bold text-emerald-800 hover:underline"
                    >
                      Gérer tarifs 58 wilayas →
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleInstallCarrier(preset)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>{busy ? 'Activation...' : 'Activer + 58 Wilayas'}</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Comprehensive Benchmark Matrix of Algerian & International SaaS Features */}
      <div className="space-y-4">
        {SAAS_BENCHMARKS.map((section) => (
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
