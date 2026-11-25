import { useCallback, useEffect, useState } from 'react';
import { Lock, MapPin, MessageCircle, Smartphone, X } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { apiFetch } from './lib/api';
import { initStoreAdPixels, trackAdPixelEvent } from './lib/pixels';
import { StoreBootstrap, StoreProduct, StoreSettings } from './types';
import { BrandLogo } from './components/BrandLogo';
import { StoreHeader, StoreRoute } from './components/store/StoreHeader';
import { StoreHome } from './components/store/StoreHome';
import { CatalogView } from './components/store/CatalogView';
import { ProductDetailView } from './components/store/ProductDetailView';
import { CheckoutView } from './components/store/CheckoutView';
import { OrderTrackingView } from './components/store/OrderTrackingView';
import { LandingPageView } from './components/store/LandingPageView';
import { CartDrawer } from './components/store/CartDrawer';
import { CatalogViewSkeleton, StoreHomeSkeleton } from './components/store/StoreSkeletons';
import { AdminShell } from './components/admin/AdminShell';
import { getSaasConfig } from './shared/domain';

const DEFAULT_SETTINGS: StoreSettings = {
  storeName: '2Frères Phone',
  tagline: 'Accessoires téléphoniques, Gaming & Services numériques en Algérie',
  logoUrl: null,
  whatsappPhone: '213550000000',
  supportEmail: 'contact@2freresphone.dz',
  currency: 'DZD',
  storeAddress: 'Algérie · Livraison 58 Wilayas',
  codEnabled: true,
  digitalOrderNote:
    'Les produits numériques sont activés manuellement après confirmation de commande et validation du paiement.',
};

type AppRoute = StoreRoute | { page: 'admin' };

function parseLocation(): AppRoute {
  const pathname = window.location.pathname || '/';
  const params = new URLSearchParams(window.location.search);

  if (pathname === '/admin' || pathname.startsWith('/admin/')) {
    return { page: 'admin' };
  }
  if (pathname === '/catalogue') {
    return {
      page: 'catalog',
      group: params.get('group') || undefined,
      category: params.get('category') || undefined,
      query: params.get('q') || undefined,
    };
  }
  if (pathname.startsWith('/produit/')) {
    const slug = decodeURIComponent(pathname.replace('/produit/', '').replace(/\/$/, ''));
    if (slug) return { page: 'product', slug };
  }
  if (pathname.startsWith('/lp/')) {
    const slug = decodeURIComponent(pathname.replace('/lp/', '').replace(/\/$/, ''));
    if (slug) return { page: 'landing', slug };
  }
  if (pathname === '/commande') {
    return { page: 'checkout' };
  }
  if (pathname === '/suivi') {
    return { page: 'track', reference: params.get('ref') || undefined };
  }
  return { page: 'home' };
}

function StorefrontApp() {
  const { addItem } = useCart();
  const [route, setRoute] = useState<AppRoute>(() => parseLocation());
  const [bootstrap, setBootstrap] = useState<StoreBootstrap | null>(null);
  const [products, setProducts] = useState<StoreProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pwaDismissed, setPwaDismissed] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem('2fp_pwa_dismissed') === '1';
    } catch {
      return false;
    }
  });
  const [pwaModalOpen, setPwaModalOpen] = useState(false);

  const navigate = useCallback((to: string) => {
    if (window.location.pathname + window.location.search !== to) {
      window.history.pushState({}, '', to);
    }
    setRoute(parseLocation());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, []);

  useEffect(() => {
    const onPop = () => setRoute(parseLocation());
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const [, setUiTick] = useState(0);
  useEffect(() => {
    initStoreAdPixels(getSaasConfig());
    const bump = () => {
      initStoreAdPixels(getSaasConfig());
      setUiTick((t) => t + 1);
    };
    window.addEventListener('2fp-currency-change', bump);
    window.addEventListener('2fp-lang-change', bump);
    window.addEventListener('2fp-saas-config-change', bump);
    return () => {
      window.removeEventListener('2fp-currency-change', bump);
      window.removeEventListener('2fp-lang-change', bump);
      window.removeEventListener('2fp-saas-config-change', bump);
    };
  }, []);

  const loadStoreData = useCallback(async () => {
    try {
      const [bootRes, prodsRes] = await Promise.all([
        apiFetch<StoreBootstrap>('/api/store/bootstrap'),
        apiFetch<{ products: StoreProduct[] }>('/api/products'),
      ]);
      setBootstrap(bootRes);
      setProducts(prodsRes.products || []);
      setLoadError(null);
    } catch (err: any) {
      setLoadError(err?.message || 'Impossible de charger la boutique.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStoreData();
  }, [loadStoreData]);

  const settings = bootstrap?.settings || DEFAULT_SETTINGS;

  // Back-Office route (/admin)
  if (route.page === 'admin') {
    return (
      <AdminShell
        publicSettings={settings}
        onExitAdmin={() => {
          loadStoreData();
          navigate('/');
        }}
        onStoreSettingsChanged={loadStoreData}
      />
    );
  }

  const whatsappDigits = settings.whatsappPhone.replace(/\D/g, '');
  const activeSocials = (bootstrap?.socialLinks || []).filter((s) => s.isActive);

  const handleAddToCartWithPixel = (p: StoreProduct, qty = 1, color?: string) => {
    addItem(p, qty, color);
    trackAdPixelEvent(
      'AddToCart',
      {
        content_ids: [String(p.id)],
        content_name: p.name,
        value: p.priceDzd * qty,
        currency: 'DZD',
        num_items: qty,
      },
      getSaasConfig(),
    );
  };

  const handleHeaderSearchChange = useCallback((nextQuery: string) => {
    const params = new URLSearchParams(window.location.search);
    const currentGroup = params.get('group') || undefined;
    const currentCategory = params.get('category') || undefined;

    const nextParams = new URLSearchParams();
    if (currentGroup) nextParams.set('group', currentGroup);
    if (currentCategory) nextParams.set('category', currentCategory);
    if (nextQuery.trim()) nextParams.set('q', nextQuery);

    const qs = nextParams.toString();
    const targetUrl = qs ? `/catalogue?${qs}` : '/catalogue';

    if (window.location.pathname === '/catalogue') {
      window.history.replaceState({}, '', targetUrl);
    } else {
      window.history.pushState({}, '', targetUrl);
    }

    setRoute({
      page: 'catalog',
      group: currentGroup,
      category: currentCategory,
      query: nextQuery || undefined,
    });
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <StoreHeader
        settings={settings}
        route={route}
        navigate={navigate}
        searchQuery={route.page === 'catalog' ? route.query || '' : ''}
        onSearchChange={handleHeaderSearchChange}
      />

      <main className="flex-1">
        {loading && !bootstrap ? (
          route.page === 'catalog' ? (
            <CatalogViewSkeleton />
          ) : (
            <StoreHomeSkeleton />
          )
        ) : loadError && !bootstrap ? (
          <div className="max-w-lg mx-auto px-4 py-20 text-center space-y-4">
            <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-xl p-4">
              {loadError}
            </p>
            <button
              type="button"
              onClick={loadStoreData}
              className="px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-semibold"
            >
              Réessayer
            </button>
          </div>
        ) : bootstrap ? (
          <>
            {route.page === 'home' && (
              <StoreHome
                bootstrap={bootstrap}
                products={products}
                loading={loading}
                navigate={navigate}
                onAddToCart={(p) => handleAddToCartWithPixel(p, 1)}
              />
            )}

            {route.page === 'catalog' && (
              <CatalogView
                products={products}
                categories={bootstrap.categories}
                loading={loading}
                initialGroup={route.group || ''}
                initialCategory={route.category || ''}
                initialQuery={route.query || ''}
                onQueryChange={handleHeaderSearchChange}
                onSelectProduct={(slug) => navigate(`/produit/${encodeURIComponent(slug)}`)}
                onAddToCart={(p) => handleAddToCartWithPixel(p, 1)}
              />
            )}

            {route.page === 'product' && (
              <ProductDetailView
                slug={route.slug}
                settings={settings}
                bootstrap={bootstrap}
                allProducts={products}
                onSelectProduct={(nextSlug) => navigate(`/produit/${encodeURIComponent(nextSlug)}`)}
                onBack={() => navigate('/catalogue')}
                onAddToCart={(p, qty, color) => handleAddToCartWithPixel(p, qty, color)}
                onGoCheckout={() => navigate('/commande')}
                onTrackOrder={(ref) => navigate(`/suivi?ref=${encodeURIComponent(ref)}`)}
              />
            )}

            {route.page === 'checkout' && (
              <CheckoutView
                bootstrap={bootstrap}
                onTrackOrder={(ref) => navigate(`/suivi?ref=${encodeURIComponent(ref)}`)}
                onContinueShopping={() => navigate('/catalogue')}
              />
            )}

            {route.page === 'track' && (
              <OrderTrackingView initialReference={route.reference || ''} />
            )}

            {route.page === 'landing' && (
              <LandingPageView
                slug={route.slug}
                bootstrap={bootstrap}
                onTrackOrder={(ref) => navigate(`/suivi?ref=${encodeURIComponent(ref)}`)}
                onBackToStore={() => navigate('/')}
              />
            )}
          </>
        ) : null}
      </main>

      {/* Storefront Footer */}
      <footer className="bg-slate-900 text-slate-300 border-t border-slate-800 mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 grid grid-cols-1 md:grid-cols-12 gap-8">
          <div className="md:col-span-5 space-y-3">
            <BrandLogo logoUrl={settings.logoUrl} storeName={settings.storeName} variant="dark" size="md" />
            <p className="text-sm text-slate-400 max-w-sm leading-relaxed">{settings.tagline}</p>
            <div className="flex items-center gap-2 text-xs text-slate-400">
              <MapPin className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{settings.storeAddress}</span>
            </div>
          </div>

          <div className="md:col-span-3 space-y-2.5">
            <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-white">
              Boutique
            </h3>
            <ul className="space-y-2 text-sm">
              <li>
                <button type="button" onClick={() => navigate('/catalogue')} className="hover:text-white">
                  Tout le catalogue
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/catalogue?group=accessories')}
                  className="hover:text-white"
                >
                  Accessoires téléphoniques
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/catalogue?group=gaming')}
                  className="hover:text-white"
                >
                  Jeux vidéo &amp; Gaming
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => navigate('/catalogue?group=digital')}
                  className="hover:text-white"
                >
                  Abonnements numériques
                </button>
              </li>
              <li>
                <button type="button" onClick={() => navigate('/suivi')} className="hover:text-white">
                  Suivi de commande
                </button>
              </li>
            </ul>
          </div>

          <div className="md:col-span-4 space-y-3">
            <h3 className="font-display font-semibold text-xs uppercase tracking-wider text-white">
              Contact &amp; Réseaux
            </h3>
            <a
              href={`https://wa.me/${whatsappDigits}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Commander / Contacter sur WhatsApp</span>
            </a>
            {activeSocials.length > 0 && (
              <div className="flex flex-wrap gap-3 pt-1 text-xs">
                {activeSocials.map((s) => (
                  <a
                    key={s.id}
                    href={s.urlOrHandle}
                    target="_blank"
                    rel="noreferrer"
                    className="text-slate-400 hover:text-white underline underline-offset-4"
                  >
                    {s.label}
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <span>
              © {new Date().getFullYear()} {settings.storeName} — Paiement à la livraison (DZD) · 58 Wilayas
            </span>
            <div className="flex items-center gap-4">
              {getSaasConfig().pwaInstallBannerEnabled && (
                <button
                  type="button"
                  onClick={() => setPwaModalOpen(true)}
                  className="inline-flex items-center gap-1.5 text-slate-400 hover:text-white transition-colors"
                >
                  <Smartphone className="w-3.5 h-3.5" />
                  <span>Installer l’application mobile</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('/admin')}
                className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-300 transition-colors"
              >
                <Lock className="w-3 h-3" />
                <span>Administration</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {getSaasConfig().pwaInstallBannerEnabled && !pwaDismissed && route.page === 'home' && (
        <div className="fixed bottom-4 left-4 z-30 max-w-xs bg-slate-900 text-white border border-slate-700 rounded-2xl p-3.5 shadow-xl flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
            <Smartphone className="w-5 h-5" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold">Application {settings.storeName}</p>
            <p className="text-[11px] text-slate-300 mt-0.5">
              Ajoutez la boutique et le tableau de bord sur votre écran d’accueil mobile.
            </p>
            <div className="flex items-center gap-2 mt-2">
              <button
                type="button"
                onClick={() => setPwaModalOpen(true)}
                className="px-2.5 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[11px] font-bold"
              >
                Installer
              </button>
              <button
                type="button"
                onClick={() => {
                  setPwaDismissed(true);
                  try {
                    sessionStorage.setItem('2fp_pwa_dismissed', '1');
                  } catch {
                    // ignore
                  }
                }}
                className="text-[11px] text-slate-400 hover:text-white"
              >
                Plus tard
              </button>
            </div>
          </div>
        </div>
      )}

      {pwaModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 border border-slate-200 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone className="w-5 h-5 text-blue-700" />
                <h3 className="font-display font-bold text-base text-slate-900">
                  Installer {settings.storeName} sur votre téléphone
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPwaModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-2.5 text-xs text-slate-600">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">Sur Android (Chrome)</p>
                <p className="mt-0.5">
                  Appuyez sur le menu <strong>⋮</strong> en haut à droite puis sélectionnez{' '}
                  <strong>« Installer l’application »</strong> ou <strong>« Ajouter à l’écran d’accueil »</strong>.
                </p>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <p className="font-bold text-slate-900">Sur iPhone / iPad (Safari)</p>
                <p className="mt-0.5">
                  Appuyez sur le bouton <strong>Partager</strong> en bas de l’écran puis choisissez{' '}
                  <strong>« Sur l’écran d’accueil »</strong>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setPwaModalOpen(false)}
              className="w-full py-2.5 rounded-xl bg-slate-900 text-white text-xs font-bold"
            >
              Compris
            </button>
          </div>
        </div>
      )}

      {getSaasConfig().whatsappFloatingButtonEnabled && route.page !== 'product' && (
        <a
          href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
            `Bonjour ${settings.storeName}, je souhaite commander un article avec livraison (paiement à la livraison COD).`,
          )}`}
          target="_blank"
          rel="noreferrer"
          title="Assistance & Commande rapide sur WhatsApp"
          className="fixed bottom-5 right-5 z-30 inline-flex items-center gap-2 px-4 py-3 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-lg transition-transform hover:scale-105"
        >
          <MessageCircle className="w-4 h-4" />
          <span className="hidden sm:inline">WhatsApp · Commande COD</span>
        </a>
      )}

      <CartDrawer onCheckout={() => navigate('/commande')} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <CartProvider>
        <StorefrontApp />
      </CartProvider>
    </AuthProvider>
  );
}
