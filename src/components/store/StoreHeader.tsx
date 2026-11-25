import { useEffect, useState } from 'react';
import { Globe, Menu, Search, ShoppingBag, Truck, X } from 'lucide-react';
import { BrandLogo } from '../BrandLogo';
import { useCart } from '../../context/CartContext';
import {
  getActiveStoreCurrency,
  getActiveStoreLang,
  getSaasConfig,
  setActiveStoreCurrency,
  setActiveStoreLang,
  StoreCurrency,
  StoreLang,
} from '../../shared/domain';
import { StoreSettings } from '../../types';

export type StoreRoute =
  | { page: 'home' }
  | { page: 'catalog'; group?: string; category?: string; query?: string }
  | { page: 'product'; slug: string }
  | { page: 'landing'; slug: string }
  | { page: 'checkout' }
  | { page: 'track'; reference?: string };

interface StoreHeaderProps {
  settings: StoreSettings;
  route: StoreRoute;
  navigate: (to: string) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
}

export function StoreHeader({
  settings,
  route,
  navigate,
  searchQuery = '',
  onSearchChange,
}: StoreHeaderProps) {
  const { totalItems, setIsOpen } = useCart();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [currency, setCurrency] = useState<StoreCurrency>(() => getActiveStoreCurrency());
  const [lang, setLang] = useState<StoreLang>(() => getActiveStoreLang());
  const [saasConfig, setSaasConfig] = useState(() => getSaasConfig());
  const [localQuery, setLocalQuery] = useState<string>(
    searchQuery || (route.page === 'catalog' && route.query ? route.query : ''),
  );

  useEffect(() => {
    if (route.page === 'catalog') {
      setLocalQuery(route.query ?? searchQuery ?? '');
    } else if (!searchQuery) {
      setLocalQuery('');
    }
  }, [route, searchQuery]);

  useEffect(() => {
    const onCur = () => setCurrency(getActiveStoreCurrency());
    const onLang = () => setLang(getActiveStoreLang());
    const onCfg = () => setSaasConfig(getSaasConfig());
    window.addEventListener('2fp-currency-change', onCur);
    window.addEventListener('2fp-lang-change', onLang);
    window.addEventListener('2fp-saas-config-change', onCfg);
    return () => {
      window.removeEventListener('2fp-currency-change', onCur);
      window.removeEventListener('2fp-lang-change', onLang);
      window.removeEventListener('2fp-saas-config-change', onCfg);
    };
  }, []);

  const isAr = lang === 'ar';

  const handleQuickSearchInput = (val: string) => {
    setLocalQuery(val);
    if (onSearchChange) {
      onSearchChange(val);
    } else {
      const trimmed = val.trim();
      navigate(trimmed ? `/catalogue?q=${encodeURIComponent(trimmed)}` : '/catalogue');
    }
  };

  const navItems = [
    { label: isAr ? 'الرئيسية' : 'Accueil', path: '/', active: route.page === 'home' },
    {
      label: isAr ? 'الكتالوج' : 'Catalogue',
      path: '/catalogue',
      active: route.page === 'catalog' && !route.group,
    },
    {
      label: isAr ? 'إكسسوارات' : 'Accessoires',
      path: '/catalogue?group=accessories',
      active: route.page === 'catalog' && route.group === 'accessories',
    },
    {
      label: isAr ? 'ألعاب الفيديو' : 'Jeux vidéo',
      path: '/catalogue?group=gaming',
      active: route.page === 'catalog' && route.group === 'gaming',
    },
    {
      label: isAr ? 'تتبع الطلب' : 'Suivi',
      path: '/suivi',
      active: route.page === 'track',
    },
  ];

  const handleNav = (path: string) => {
    setMobileMenuOpen(false);
    navigate(path);
  };

  const handleSwitchLang = (next: StoreLang) => {
    setLang(next);
    setActiveStoreLang(next);
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200">
      {/* Top 2FP DzCore Announcement Bar */}
      {(saasConfig.announcementBarEnabled || saasConfig.bilingualArFrEnabled) && (
        <div className="bg-slate-900 text-slate-200 text-[11px] sm:text-xs border-b border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2">
            {saasConfig.announcementBarEnabled ? (
              <div className="flex items-center gap-2 truncate">
                <Truck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span className="font-medium truncate">
                  {isAr ? saasConfig.announcementTextAr : saasConfig.announcementTextFr}
                </span>
              </div>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-3 shrink-0 ml-auto">
              {/* Bilingual FR / AR Selector (2FP DzCore) */}
              {saasConfig.bilingualArFrEnabled && (
                <div className="inline-flex items-center gap-1 bg-slate-800 rounded-md px-1.5 py-0.5 border border-slate-700">
                  <Globe className="w-3 h-3 text-blue-400" />
                  <button
                    type="button"
                    onClick={() => handleSwitchLang('fr')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      lang === 'fr' ? 'bg-blue-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    FR
                  </button>
                  <button
                    type="button"
                    onClick={() => handleSwitchLang('ar')}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-bold transition-colors ${
                      lang === 'ar' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    العربية
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 lg:gap-6">
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
        <nav aria-label="Navigation principale" className="hidden lg:flex items-center gap-6">
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

        {/* Zone 2.5: Quick real-time catalog search bar */}
        <div className="hidden sm:flex items-center flex-1 max-w-xs lg:max-w-sm">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={localQuery}
              onChange={(e) => handleQuickSearchInput(e.target.value)}
              aria-label={isAr ? 'بحث سريع في الكتالوج' : 'Recherche rapide dans le catalogue'}
              placeholder={
                isAr
                  ? 'ابحث عن منتج، علامة، مرجع...'
                  : 'Recherche rapide (produit, marque, réf...)'
              }
              className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50/90 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600 transition-all"
            />
            {localQuery && (
              <button
                type="button"
                onClick={() => handleQuickSearchInput('')}
                aria-label={isAr ? 'مسح البحث' : 'Effacer la recherche'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Zone 3: Single primary action (Cart) + Mobile menu toggle */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setIsOpen(true)}
            aria-label={`Ouvrir le panier (${totalItems} articles)`}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
          >
            <ShoppingBag className="w-4 h-4" />
            <span>{isAr ? 'السلة' : 'Panier'}</span>
            <span className="font-mono text-xs tabular-nums text-slate-300">({totalItems})</span>
          </button>

          <button
            type="button"
            onClick={() => setMobileMenuOpen((v) => !v)}
            aria-label={mobileMenuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={mobileMenuOpen}
            className="lg:hidden p-2 rounded-lg text-slate-700 hover:bg-slate-100"
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
        </div>
      </div>

      {/* Mobile quick search bar */}
      <div className="sm:hidden px-4 pb-2.5">
        <div className="relative w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={localQuery}
            onChange={(e) => handleQuickSearchInput(e.target.value)}
            aria-label={isAr ? 'بحث سريع في الكتالوج' : 'Recherche rapide dans le catalogue'}
            placeholder={
              isAr
                ? 'ابحث عن منتج، علامة، مرجع...'
                : 'Recherche rapide (produit, marque, réf...)'
            }
            className="w-full pl-9 pr-8 py-1.5 text-sm rounded-lg border border-slate-200 bg-slate-50 text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
          />
          {localQuery && (
            <button
              type="button"
              onClick={() => handleQuickSearchInput('')}
              aria-label={isAr ? 'مسح البحث' : 'Effacer la recherche'}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-slate-400 hover:text-slate-700"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {mobileMenuOpen && (
        <nav
          aria-label="Navigation mobile"
          className="lg:hidden border-t border-slate-200 bg-white px-4 py-3 flex flex-col gap-1"
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
            {isAr ? 'الاشتراكات الرقمية' : 'Abonnements numériques'}
          </a>
        </nav>
      )}
    </header>
  );
}
