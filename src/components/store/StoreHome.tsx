import React, { useState } from 'react';
import { ArrowRight, CheckCircle2, Search, ShieldCheck, Truck } from 'lucide-react';
import { StoreBootstrap, StoreProduct } from '../../types';
import { ProductCard } from './ProductCard';

const HERO_IMG = '/src/assets/images/hero_2freres_tech_1795096637447.jpg';
const CAT_ACC_IMG = '/src/assets/images/cat_phone_accessories_1795096637386.jpg';
const CAT_GAMING_IMG = '/src/assets/images/cat_gaming_console_1795096637263.jpg';
const CAT_DIGITAL_IMG = '/src/assets/images/cat_digital_cards_1795096637686.jpg';

interface StoreHomeProps {
  bootstrap: StoreBootstrap;
  products: StoreProduct[];
  navigate: (path: string) => void;
  onAddToCart: (product: StoreProduct) => void;
}

export function StoreHome({ bootstrap, products, navigate, onAddToCart }: StoreHomeProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const featuredProducts = products.filter((p) => p.isFeatured).slice(0, 6);
  const displayProducts = featuredProducts.length > 0 ? featuredProducts : products.slice(0, 6);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/catalogue?q=${encodeURIComponent(q)}` : '/catalogue');
  };

  const collections = [
    {
      title: 'Accessoires téléphoniques',
      description: 'Coques, verres trempés, chargeurs rapides GaN, câbles, écouteurs Bluetooth et batteries externes.',
      image: CAT_ACC_IMG,
      path: '/catalogue?group=accessories',
      count: products.filter((p) => p.categoryGroup === 'accessories').length,
    },
    {
      title: 'Jeux vidéo & Gaming',
      description: 'Jeux Xbox & PlayStation, comptes vérifiés, abonnements gaming et cartes cadeaux.',
      image: CAT_GAMING_IMG,
      path: '/catalogue?group=gaming',
      count: products.filter((p) => p.categoryGroup === 'gaming').length,
    },
    {
      title: 'Abonnements numériques',
      description: 'Netflix 4K, Snapchat+ et services numériques activés après validation de votre commande.',
      image: CAT_DIGITAL_IMG,
      path: '/catalogue?group=digital',
      count: products.filter((p) => p.categoryGroup === 'digital').length,
    },
  ];

  return (
    <div className="space-y-16 pb-20">
      {/* Section 1: Editorial Split Hero */}
      <section className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-stretch">
            <div className="lg:col-span-6 flex flex-col justify-center">
              <p className="text-xs font-medium text-blue-700 tracking-wide">
                Boutique officielle en Algérie · Paiement à la livraison (DZD)
              </p>
              <h1
                className="mt-3 font-display font-bold text-slate-900 tracking-tight leading-[1.1] text-balance"
                style={{ fontSize: 'clamp(2.1rem, 3.8vw, 3.25rem)' }}
              >
                Accessoires mobile, gaming et abonnements livrés partout en Algérie.
              </h1>
              <p className="mt-4 text-base text-slate-600 leading-relaxed max-w-xl">
                {bootstrap.settings.tagline}. Commandez en quelques secondes sans créer de compte,
                avec livraison à domicile ou en STOP DESK dans les 58 wilayas.
              </p>

              <form onSubmit={handleSearch} className="mt-7 flex gap-2 max-w-lg">
                <label htmlFor="home-search" className="sr-only">
                  Rechercher un produit
                </label>
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="home-search"
                    type="search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Coque iPhone, chargeur 65W, Game Pass, Netflix..."
                    className="w-full pl-10 pr-4 py-3 rounded-lg border border-slate-300 bg-white text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-blue-600"
                  />
                </div>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors whitespace-nowrap shrink-0"
                >
                  Rechercher
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <Truck className="w-4 h-4 text-blue-700 shrink-0" />
                  <span>58 wilayas Domicile &amp; Stop Desk</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Paiement à la livraison (COD)</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-slate-700 shrink-0" />
                  <span>Produits numériques protégés</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="rounded-xl overflow-hidden bg-slate-100 border border-slate-200 h-full min-h-[280px]">
                <img
                  src={HERO_IMG}
                  alt="Sélection d'accessoires téléphoniques et manette gaming 2Frères Phone"
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Three Core Store Universes */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-bold text-2xl text-slate-900 tracking-tight">
              Nos rayons
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Trois pôles spécialisés gérés directement en stock par 2Frères Phone.
            </p>
          </div>
          <a
            href="/catalogue"
            onClick={(e) => {
              e.preventDefault();
              navigate('/catalogue');
            }}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>Tout voir</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {collections.map((col) => (
            <a
              key={col.title}
              href={col.path}
              onClick={(e) => {
                e.preventDefault();
                navigate(col.path);
              }}
              className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col hover:border-slate-300 transition-colors"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <img
                  src={col.image}
                  alt={col.title}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <p className="text-xs text-slate-500 tabular-nums">
                  {col.count} article{col.count > 1 ? 's' : ''} disponibles
                </p>
                <h3 className="mt-1 font-display font-semibold text-lg text-slate-900 group-hover:text-blue-700 transition-colors">
                  {col.title}
                </h3>
                <p className="mt-1.5 text-sm text-slate-600 leading-relaxed flex-1">
                  {col.description}
                </p>
              </div>
            </a>
          ))}
        </div>
      </section>

      {/* Section 3: Featured Products Grid */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4 mb-6">
          <div>
            <h2 className="font-display font-bold text-2xl text-slate-900 tracking-tight">
              Sélection du moment
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Prix transparents en Dinars algériens (DZD) et avis d’acheteurs vérifiés.
            </p>
          </div>
          <a
            href="/catalogue"
            onClick={(e) => {
              e.preventDefault();
              navigate('/catalogue');
            }}
            className="text-sm font-semibold text-blue-700 hover:text-blue-800 inline-flex items-center gap-1 whitespace-nowrap"
          >
            <span>Explorer le catalogue</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {displayProducts.map((product) => (
            <ProductCard
              key={product.id}
              product={product}
              onSelect={(slug) => navigate(`/produit/${slug}`)}
              onAddToCart={onAddToCart}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
