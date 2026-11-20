import { useCallback, useEffect, useState } from 'react';
import { Lock, MapPin, MessageCircle } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { CartProvider, useCart } from './context/CartContext';
import { apiFetch } from './lib/api';
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
import { AdminShell } from './components/admin/AdminShell';

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      <StoreHeader settings={settings} route={route} navigate={navigate} />

      <main className="flex-1">
        {loading && !bootstrap ? (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-3">
            <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-sm text-slate-500">Chargement de la boutique 2Frères Phone...</p>
          </div>
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
                navigate={navigate}
                onAddToCart={(p) => addItem(p, 1)}
              />
            )}

            {route.page === 'catalog' && (
              <CatalogView
                key={`${route.group || ''}-${route.category || ''}-${route.query || ''}`}
                products={products}
                categories={bootstrap.categories}
                initialGroup={route.group || ''}
                initialCategory={route.category || ''}
                initialQuery={route.query || ''}
                onSelectProduct={(slug) => navigate(`/produit/${encodeURIComponent(slug)}`)}
                onAddToCart={(p) => addItem(p, 1)}
              />
            )}

            {route.page === 'product' && (
              <ProductDetailView
                slug={route.slug}
                settings={settings}
                onBack={() => navigate('/catalogue')}
                onAddToCart={(p, qty) => addItem(p, qty)}
                onGoCheckout={() => navigate('/commande')}
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
      </footer>

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
