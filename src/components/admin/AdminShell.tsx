import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  BarChart3,
  Bell,
  BellOff,
  Boxes,
  Database,
  Globe,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Printer,
  RefreshCw,
  Rocket,
  RotateCcw,
  Settings,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Star,
  Tag,
  Truck,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { adminFetch } from '../../lib/api';
import { ADMIN_TEAM_ROLES, getSaasConfig, saveSaasConfig } from '../../shared/domain';
import { StoreSettings } from '../../types';
import { BrandLogo } from '../BrandLogo';
import { AdminOverview } from './AdminOverview';
import { AdminOrders } from './AdminOrders';
import { AdminProducts } from './AdminProducts';
import { AdminStockImport } from './AdminStockImport';
import {
  AdminCustomers,
  AdminDigitalDeliveries,
  AdminPromotions,
  AdminReturns,
  AdminReviews,
  AdminSales,
} from './AdminOperations';
import {
  AdminCarriersAndRates,
  AdminSettings,
  AdminSocialLinks,
} from './AdminLogisticsAndSettings';
import { AdminPrinter } from './AdminPrinter';
import { AdminPagePilot } from './AdminPagePilot';
import { MdfIdfBinaryDecoderModule } from './MdfIdfBinaryDecoderModule';
import { AdminSaasEcosystemHub } from './AdminSaasEcosystemHub';

function playNewOrderChime() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    const notes = [587.33, 880]; // D5 -> A5 chime
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.14);
      gain.gain.setValueAtTime(0.15, now + i * 0.14);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.14 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.14);
      osc.stop(now + i * 0.14 + 0.26);
    });
  } catch {
    // ignore audio block
  }
}

interface AdminShellProps {
  publicSettings: StoreSettings;
  onExitAdmin: () => void;
  onStoreSettingsChanged: () => void;
}

type AdminTab =
  | 'overview'
  | 'saas_hub'
  | 'orders'
  | 'sales'
  | 'products'
  | 'stock'
  | 'mdf_import'
  | 'customers'
  | 'reviews'
  | 'carriers'
  | 'returns'
  | 'promotions'
  | 'digital'
  | 'pagepilot'
  | 'social'
  | 'printer'
  | 'settings';

export function AdminShell({
  publicSettings,
  onExitAdmin,
  onStoreSettingsChanged,
}: AdminShellProps) {
  const { user, admin, loading, authError, signInWithGoogle, signOut } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>(() => {
    try {
      const saved = localStorage.getItem('2fp_admin_active_tab') as AdminTab | null;
      if (saved) return saved;
    } catch {
      // ignore
    }
    return 'overview';
  });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showGlobalMdfModal, setShowGlobalMdfModal] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(
    () => getSaasConfig().adminOrderSoundEnabled !== false,
  );
  const prevOrdersCountRef = useRef<number | null>(null);

  // Contextual sub-navigation flags
  const [productsOnlyMissingPhotos, setProductsOnlyMissingPhotos] = useState(false);
  const [stockInitialSubTab, setStockInitialSubTab] = useState<'import' | 'levels' | 'compta' | 'alerts'>(() => {
    try {
      const saved = localStorage.getItem('2fp_admin_stock_subtab');
      if (saved === 'import' || saved === 'levels' || saved === 'compta' || saved === 'alerts') {
        return saved;
      }
    } catch {
      // ignore
    }
    return 'import';
  });

  // Admin datasets loaded from real PostgreSQL APIs
  const [loadingData, setLoadingData] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);
  const [dashboard, setDashboard] = useState<any>(null);
  const [orders, setOrders] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [globalThreshold, setGlobalThreshold] = useState<number>(10);
  const [stockData, setStockData] = useState<any>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [carriers, setCarriers] = useState<any[]>([]);
  const [shippingRates, setShippingRates] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [promotions, setPromotions] = useState<any[]>([]);
  const [digitalDeliveries, setDigitalDeliveries] = useState<any[]>([]);
  const [landingPages, setLandingPages] = useState<any[]>([]);
  const [socialLinks, setSocialLinks] = useState<any[]>([]);
  const [settingsData, setSettingsData] = useState<{ settings: any; emailProviderConfigured: boolean } | null>(null);

  const loadAllAdminData = useCallback(async () => {
    if (!admin) return;
    setLoadingData(true);
    setDataError(null);
    try {
      const [
        dashRes,
        ordersRes,
        salesRes,
        prodsRes,
        catsRes,
        stockRes,
        custRes,
        revRes,
        carRes,
        ratesRes,
        retRes,
        promoRes,
        digRes,
        lpRes,
        socRes,
        setRes,
      ] = await Promise.all([
        adminFetch<any>('/api/admin/dashboard'),
        adminFetch<any>('/api/admin/orders'),
        adminFetch<any>('/api/admin/sales'),
        adminFetch<any>('/api/admin/products'),
        adminFetch<any>('/api/admin/categories'),
        adminFetch<any>('/api/admin/stock'),
        adminFetch<any>('/api/admin/customers'),
        adminFetch<any>('/api/admin/reviews'),
        adminFetch<any>('/api/admin/carriers'),
        adminFetch<any>('/api/admin/shipping-rates'),
        adminFetch<any>('/api/admin/returns'),
        adminFetch<any>('/api/admin/promotions'),
        adminFetch<any>('/api/admin/digital-deliveries'),
        adminFetch<any>('/api/admin/landing-pages').catch(() => ({ landingPages: [] })),
        adminFetch<any>('/api/admin/social-links'),
        adminFetch<any>('/api/admin/settings'),
      ]);

      const fetchedOrders = ordersRes.orders || [];
      if (
        prevOrdersCountRef.current !== null &&
        fetchedOrders.length > prevOrdersCountRef.current &&
        getSaasConfig().adminOrderSoundEnabled !== false
      ) {
        playNewOrderChime();
      }
      prevOrdersCountRef.current = fetchedOrders.length;

      setDashboard(dashRes);
      setOrders(fetchedOrders);
      setSales(salesRes.sales || []);
      setProducts(prodsRes.products || []);
      setGlobalThreshold(prodsRes.globalLowStockThreshold ?? 10);
      setCategories(catsRes.categories || []);
      setStockData(stockRes);
      setCustomers(custRes.customers || []);
      setReviews(revRes.reviews || []);
      setCarriers(carRes.carriers || []);
      setShippingRates(ratesRes.shippingRates || []);
      setReturnsList(retRes.returns || []);
      setPromotions(promoRes.promotions || []);
      setDigitalDeliveries(digRes.deliveries || []);
      setLandingPages(lpRes.landingPages || []);
      setSocialLinks(socRes.socialLinks || []);
      setSettingsData(setRes);
    } catch (err: any) {
      setDataError(err?.message || 'Erreur lors du chargement des données back-office.');
    } finally {
      setLoadingData(false);
    }
  }, [admin]);

  useEffect(() => {
    if (admin) {
      loadAllAdminData();
    }
  }, [admin, loadAllAdminData]);

  const handleRefresh = useCallback(() => {
    loadAllAdminData();
    onStoreSettingsChanged();
  }, [loadAllAdminData, onStoreSettingsChanged]);

  const handleNavigateTab = (tab: string, extra?: any) => {
    if (tab === 'products') {
      setProductsOnlyMissingPhotos(Boolean(extra?.onlyMissingPhotos));
    }
    if (tab === 'mdf_import') {
      setStockInitialSubTab('import');
      try {
        localStorage.setItem('2fp_admin_stock_subtab', 'import');
        localStorage.setItem('2fp_admin_active_tab', 'mdf_import');
      } catch {
        // ignore
      }
      setActiveTab('mdf_import');
      setSidebarOpen(false);
      return;
    }
    if (tab === 'stock') {
      const nextSub = extra?.subTab || 'import';
      setStockInitialSubTab(nextSub);
      try {
        localStorage.setItem('2fp_admin_stock_subtab', nextSub);
      } catch {
        // ignore
      }
    }
    try {
      localStorage.setItem('2fp_admin_active_tab', tab);
    } catch {
      // ignore
    }
    setActiveTab(tab as AdminTab);
    setSidebarOpen(false);
  };

  // Loading auth gate
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-slate-300">Vérification de la session administrateur...</p>
        </div>
      </div>
    );
  }

  // Unauthenticated or Unauthorized Admin Login Gate
  if (!admin) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-900 px-8 py-7 text-center space-y-3">
            <div className="flex justify-center">
              <BrandLogo
                logoUrl={publicSettings.logoUrl}
                storeName={publicSettings.storeName}
                variant="dark"
                size="lg"
              />
            </div>
            <p className="text-xs text-slate-400">
              Espace d’administration sécurisé · Accès réservé au gérant
            </p>
          </div>

          <div className="p-8 space-y-5">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600">
              <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
              <p>
                Connectez-vous avec votre compte Google administrateur autorisé (comptes gérants :{' '}
                <span className="font-mono font-semibold text-slate-900">badroumc@gmail.com</span> ·{' '}
                <span className="font-mono font-semibold text-slate-900">tigrine156@gmail.com</span>).
              </p>
            </div>

            {authError && (
              <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                {authError}
              </div>
            )}

            <button
              type="button"
              onClick={signInWithGoogle}
              className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2.5 shadow-sm"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Se connecter avec Google</span>
            </button>

            {user && !admin && (
              <button
                type="button"
                onClick={signOut}
                className="w-full py-2.5 px-4 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold"
              >
                Changer de compte Google
                {user.email || user.providerData?.[0]?.email
                  ? ` (${user.email || user.providerData?.[0]?.email})`
                  : ''}
              </button>
            )}

            <div className="pt-3 border-t border-slate-100 text-center">
              <button
                type="button"
                onClick={onExitAdmin}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-slate-900"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Retour à la boutique 2Frères Phone</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const effectiveLogo = settingsData?.settings?.logoUrl ?? publicSettings.logoUrl;
  const effectiveStoreName = settingsData?.settings?.storeName ?? publicSettings.storeName;

  const adminRole = admin.role || 'super_admin';
  const roleLabel =
    ADMIN_TEAM_ROLES.find((r) => r.value === adminRole)?.label || 'Super Admin (Gérant)';

  const allNavGroups: {
    title: string;
    items: { id: AdminTab; label: string; icon: React.ComponentType<{ className?: string }>; badge?: number | string }[];
  }[] = [
    {
      title: 'Pilotage',
      items: [
        { id: 'overview', label: 'Vue générale', icon: LayoutDashboard },
        {
          id: 'saas_hub',
          label: 'Suite 2FP Pro & Livraison',
          icon: Rocket,
          badge: '2FP PRO',
        },
        { id: 'orders', label: 'Commandes', icon: ShoppingCart, badge: dashboard?.kpis?.newOrders || undefined },
        { id: 'sales', label: 'Ventes & Compta', icon: BarChart3 },
      ],
    },
    {
      title: 'Catalogue & Stocks',
      items: [
        {
          id: 'mdf_import',
          label: 'Ajouter le Stock (.MDF + .IDF)',
          icon: Database,
          badge: 'MDF/IDF',
        },
        { id: 'products', label: 'Produits & Catégories', icon: Package },
        {
          id: 'stock',
          label: 'Stocks, Import & Alertes',
          icon: Boxes,
          badge: dashboard?.kpis?.activeLowStockCount || undefined,
        },
        {
          id: 'digital',
          label: 'Produits numériques',
          icon: KeyRound,
          badge: dashboard?.kpis?.pendingDigitalCount || undefined,
        },
      ],
    },
    {
      title: 'Clients & Marketing',
      items: [
        {
          id: 'pagepilot',
          label: '2FP VitrinePro IA (Landing Pages)',
          icon: Sparkles,
          badge: landingPages.length || undefined,
        },
        { id: 'customers', label: 'Clients', icon: Users },
        {
          id: 'reviews',
          label: 'Avis clients',
          icon: Star,
          badge: dashboard?.kpis?.pendingReviewsCount || undefined,
        },
        { id: 'promotions', label: 'Promotions', icon: Tag },
        { id: 'returns', label: 'Retours (RMA)', icon: RotateCcw },
      ],
    },
    {
      title: 'Logistique & Config',
      items: [
        { id: 'carriers', label: 'Transporteurs & Tarifs', icon: Truck },
        { id: 'social', label: 'Réseaux sociaux', icon: Globe },
        { id: 'printer', label: 'Imprimante & Étiquettes', icon: Printer },
        { id: 'settings', label: 'Paramètres & Logo', icon: Settings },
      ],
    },
  ];

  // Role-based permissions filtering (2FP TeamGuard)
  const allowedTabsForRole: AdminTab[] | null =
    adminRole === 'confirmateur'
      ? ['orders', 'customers', 'reviews', 'returns']
      : adminRole === 'preparateur'
      ? ['orders', 'carriers', 'printer', 'returns', 'stock']
      : null;

  const navGroups = allowedTabsForRole
    ? allNavGroups
        .map((g) => ({
          ...g,
          items: g.items.filter((it) => allowedTabsForRole.includes(it.id)),
        }))
        .filter((g) => g.items.length > 0)
    : allNavGroups;

  const activeLabel =
    navGroups.flatMap((g) => g.items).find((i) => i.id === activeTab)?.label || 'Administration';

  const sidebarContent = (
    <div className="flex flex-col h-full bg-slate-900 text-slate-200">
      <div className="h-16 px-5 border-b border-slate-800 flex items-center justify-between">
        <BrandLogo logoUrl={effectiveLogo} storeName={effectiveStoreName} variant="dark" size="sm" />
        <button
          type="button"
          onClick={() => setSidebarOpen(false)}
          className="lg:hidden p-1.5 rounded text-slate-400 hover:text-white"
          aria-label="Fermer menu"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Navigation administration">
        {navGroups.map((group) => (
          <div key={group.title}>
            <p className="px-3 mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {group.title}
            </p>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => handleNavigateTab(item.id)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      active
                        ? 'bg-blue-700 text-white'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <span className="inline-flex items-center gap-2.5 truncate">
                      <Icon className="w-4 h-4 shrink-0" />
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.badge ? (
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold tabular-nums ${
                          active
                            ? 'bg-white/20 text-white'
                            : item.badge === 'MDF/IDF'
                            ? 'bg-emerald-600 text-white'
                            : 'bg-red-600 text-white'
                        }`}
                      >
                        {item.badge}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-slate-800 space-y-2">
        <div className="px-2">
          <div className="flex items-center justify-between gap-1">
            <p className="text-xs font-semibold text-white truncate">{admin.fullName}</p>
            <span className="px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800 text-[9px] font-bold">
              {roleLabel.split(' ')[0]}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate font-mono">{admin.email}</p>
        </div>
        <div className="flex items-center gap-2 pt-1">
          <button
            type="button"
            onClick={onExitAdmin}
            className="flex-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-200 text-center"
          >
            Boutique
          </button>
          <button
            type="button"
            onClick={signOut}
            className="inline-flex items-center justify-center gap-1 py-1.5 px-2.5 rounded-lg bg-slate-800 hover:bg-red-900/60 text-xs font-medium text-slate-300 hover:text-red-200"
            title="Déconnexion"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block w-64 shrink-0 border-r border-slate-800 sticky top-0 h-screen">
        {sidebarContent}
      </aside>

      {/* Mobile Sidebar Drawer */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-slate-900/60" onClick={() => setSidebarOpen(false)} />
          <div className="relative w-64 max-w-[85vw] h-full">{sidebarContent}</div>
        </div>
      )}

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 bg-white border-b border-slate-200 px-4 sm:px-6 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100"
              aria-label="Ouvrir la navigation"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h1 className="font-display font-bold text-lg text-slate-900 truncate">{activeLabel}</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const next = !soundEnabled;
                setSoundEnabled(next);
                saveSaasConfig({ adminOrderSoundEnabled: next });
                if (next) playNewOrderChime();
              }}
              title={
                soundEnabled
                  ? 'Notifications sonores de nouvelle commande activées (cliquer pour couper)'
                  : 'Notifications sonores désactivées (cliquer pour activer)'
              }
              className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold ${
                soundEnabled
                  ? 'border-blue-200 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-500'
              }`}
            >
              {soundEnabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{soundEnabled ? 'Son ON' : 'Son OFF'}</span>
            </button>
            {!allowedTabsForRole && (
              <>
                <button
                  type="button"
                  onClick={() => handleNavigateTab('saas_hub')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm"
                >
                  <Rocket className="w-3.5 h-3.5" />
                  <span>Suite 2FP Pro &amp; Livraison</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowGlobalMdfModal(true)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
                >
                  <Database className="w-3.5 h-3.5" />
                  <span>+ Ajouter le Stock (.MDF + .IDF / Compta)</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadingData}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingData ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Actualiser</span>
            </button>
          </div>
        </header>

        <main className="flex-1 p-4 sm:p-6 max-w-[1440px] w-full mx-auto">
          {dataError && (
            <div className="mb-5 p-4 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
              {dataError}
            </div>
          )}

          {activeTab === 'overview' && (
            <AdminOverview
              data={dashboard}
              products={products}
              categories={categories}
              onRefresh={handleRefresh}
              onNavigateTab={handleNavigateTab}
            />
          )}
          {activeTab === 'saas_hub' && (
            <AdminSaasEcosystemHub
              carriers={carriers}
              onRefresh={handleRefresh}
              onNavigateTab={handleNavigateTab}
            />
          )}
          {activeTab === 'orders' && (
            <AdminOrders
              orders={orders}
              carriers={carriers}
              storeSettings={settingsData?.settings || publicSettings}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'sales' && (
            <AdminSales
              sales={sales}
              orders={orders}
              products={products}
              accountingEntries={stockData?.accountingEntries || []}
              storeSettings={settingsData?.settings || publicSettings}
              onOpenMdfImport={() => handleNavigateTab('mdf_import')}
            />
          )}
          {activeTab === 'products' && (
            <AdminProducts
              key={productsOnlyMissingPhotos ? 'missing' : 'all'}
              products={products}
              categories={categories}
              globalLowStockThreshold={globalThreshold}
              storeSettings={settingsData?.settings || publicSettings}
              initialOnlyMissingPhotos={productsOnlyMissingPhotos}
              onRefresh={handleRefresh}
            />
          )}
          {(activeTab === 'stock' || activeTab === 'mdf_import') && (
            <AdminStockImport
              key={activeTab === 'mdf_import' ? 'import' : stockInitialSubTab}
              products={products}
              categories={categories}
              stockData={stockData}
              storeSettings={settingsData?.settings || publicSettings}
              initialSubTab={activeTab === 'mdf_import' ? 'import' : stockInitialSubTab}
              onRefresh={handleRefresh}
              onGoToMissingPhotos={() => handleNavigateTab('products', { onlyMissingPhotos: true })}
            />
          )}
          {activeTab === 'customers' && (
            <AdminCustomers customers={customers} onRefresh={handleRefresh} />
          )}
          {activeTab === 'reviews' && <AdminReviews reviews={reviews} onRefresh={handleRefresh} />}
          {activeTab === 'carriers' && (
            <AdminCarriersAndRates
              carriers={carriers}
              shippingRates={shippingRates}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'returns' && (
            <AdminReturns returnsList={returnsList} onRefresh={handleRefresh} />
          )}
          {activeTab === 'promotions' && (
            <AdminPromotions promotions={promotions} onRefresh={handleRefresh} />
          )}
          {activeTab === 'digital' && (
            <AdminDigitalDeliveries deliveries={digitalDeliveries} onRefresh={handleRefresh} />
          )}
          {activeTab === 'pagepilot' && (
            <AdminPagePilot
              products={products}
              landingPages={landingPages}
              onRefresh={handleRefresh}
            />
          )}
          {activeTab === 'social' && (
            <AdminSocialLinks socialLinks={socialLinks} onRefresh={handleRefresh} />
          )}
          {activeTab === 'printer' && (
            <AdminPrinter
              settings={settingsData?.settings || publicSettings}
              products={products}
              orders={orders}
            />
          )}
          {activeTab === 'settings' && (
            <AdminSettings
              settings={settingsData?.settings || publicSettings}
              emailProviderConfigured={Boolean(settingsData?.emailProviderConfigured)}
              onRefresh={handleRefresh}
            />
          )}
        </main>
      </div>

      {/* Global Modal for .MDF + .IDF Binary Decoder & Stock/Compta Importer */}
      {showGlobalMdfModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-4xl my-8 relative">
            <div className="flex justify-end mb-2">
              <button
                type="button"
                onClick={() => setShowGlobalMdfModal(false)}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-slate-900 text-white hover:bg-slate-800 text-xs font-bold shadow"
              >
                <X className="w-4 h-4" />
                <span>Fermer la fenêtre</span>
              </button>
            </div>
            <MdfIdfBinaryDecoderModule
              categories={categories}
              onRefresh={handleRefresh}
              onNavigateCompta={() => {
                setShowGlobalMdfModal(false);
                handleNavigateTab('stock', { subTab: 'compta' });
              }}
              onNavigateStockLevels={() => {
                setShowGlobalMdfModal(false);
                handleNavigateTab('stock', { subTab: 'levels' });
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
