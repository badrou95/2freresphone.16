import { useState } from 'react';
import { Menu, ShoppingBag, X } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { useCart } from '../../context/CartContext';
import { StoreSettings } from '../../types';

export type StoreRoute =
  | { page: 'home' }
  | { page: 'catalog'; group?: string; category?: string; query?: string }
  | { page: 'product'; slug: string }
  | { page: 'checkout' }
  | { page: 'track'; reference?: string };

interface StoreHeaderProps {
  settings: StoreSettings;
  route: StoreRoute;
  navigate: (to: string) => void;
}

export function StoreHeader({ settings, route, navigate }: StoreHeaderProps) {
  const { totalItems, setIsOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems = [
    { label: 'Accueil', path: '/', active: route.page === 'home' },
    {
      label: 'Catalogue',
      path: '/catalogue',
      active: route.page === 'catalog' && !route.group,
    },
    {
      label: 'Accessoires',
      path: '/catalogue?group=accessories',
      active: route.page === 'catalog' && route.group === 'accessories',
    },
    {
      label: 'Jeux vidéo',
      path: '/catalogue?group=gaming',
      active: route.page === 'catalog' && route.group === 'gaming',
    },
    {
      label: 'Suivi',
      path: '/suivi',
      active: route.page === 'track',
    },
  ];

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Brand mark (single-line) */}
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            handleNav('/');
          }}
          className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded"
        >
          <BrandLogo logoUrl={settings.logoUrl} storeName={settings.storeName} />
        </a>

        {/* Zone 2: Clean single-line nav links */}
        <nav aria-label="Navigation principale" className="hidden md:flex items-center gap-7">
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                handleNav(item.path);
              }}
              className={`text-sm font-medium whitespace-nowrap shrink-0 transition-colors pb-0.5 border-b-2 ${
                item.active
                  ? 'text-slate-900 border-blue-700'
                  : 'text-slate-600 border-transparent hover:text-slate-900 hover:border-slate-300'
              }`}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* Zone 3: Single primary action (Cart) + Mobile menu toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={`Ouvrir le panier (${totalItems} articles)`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>Panier</span>
            <span className="font-mono text-xs tabular-nums text-slate-300">({totalItems})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
            className="md:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          aria-label="Navigation mobile"
          className="md:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1"
        >
          {navItems.map((item) => (
            <a
              key={item.path}
              href={item.path}
              onClick={(e) => {
                e.preventDefault();
                handleNav(item.path);
              }}
              className={`px-3 py-2.5 rounded-lg text-sm font-medium ${
                item.active ? 'bg-slate-100 text-slate-900' : 'text-slate-600 hover:bg-slate-50'
              }`}
            >
              {item.label}
            </a>
          ))}
          <a
            href="/catalogue?group=digital"
            onClick={(e) => {
              e.preventDefault();
              handleNav('/catalogue?group=digital');
            }}
            className="px-3 py-2.5 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Abonnements numériques
          </a>
        </nav>
      )}
    </header>
  );
}
