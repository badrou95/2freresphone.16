import { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { Category, StoreProduct } from '../../types';
import { CATEGORY_GROUPS } from '../../shared/domain';
import { ProductCard } from './ProductCard';

interface CatalogViewProps {
  products: StoreProduct[];
  categories: Category[];
  initialGroup?: string;
  initialCategory?: string;
  initialQuery?: string;
  onSelectProduct: (slug: string) => void;
  onAddToCart: (product: StoreProduct) => void;
}

export function CatalogView({
  products,
  categories,
  initialGroup = '',
  initialCategory = '',
  initialQuery = '',
  onSelectProduct,
  onAddToCart,
}: CatalogViewProps) {
  const [query, setQuery] = useState(initialQuery);
  const [group, setGroup] = useState(initialGroup);
  const [categorySlug, setCategorySlug] = useState(initialCategory);
  const [productType, setProductType] = useState<'all' | 'physical' | 'digital'>('all');
  const [minPrice, setMinPrice] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [sort, setSort] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating' | 'newest'>('featured');

  const visibleCategories = useMemo(
    () => (group ? categories.filter((c) => c.categoryGroup === group) : categories),
    [categories, group],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = minPrice ? Number(minPrice) : null;
    const max = maxPrice ? Number(maxPrice) : null;

    const list = products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.brand || ''} ${p.sku} ${p.categoryName} ${p.shortDescription || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (group && p.categoryGroup !== group) return false;
      if (categorySlug && p.categorySlug !== categorySlug) return false;
      if (productType !== 'all' && p.productType !== productType) return false;
      if (min !== null && Number.isFinite(min) && p.priceDzd < min) return false;
      if (max !== null && Number.isFinite(max) && p.priceDzd > max) return false;
      return true;
    });

    const sorted = [...list];
    if (sort === 'price_asc') sorted.sort((a, b) => a.priceDzd - b.priceDzd);
    else if (sort === 'price_desc') sorted.sort((a, b) => b.priceDzd - a.priceDzd);
    else if (sort === 'rating') sorted.sort((a, b) => b.averageRating - a.averageRating);
    else if (sort === 'newest') sorted.sort((a, b) => b.id - a.id);
    return sorted;
  }, [products, query, group, categorySlug, productType, minPrice, maxPrice, sort]);

  const resetFilters = () => {
    setQuery('');
    setGroup('');
    setCategorySlug('');
    setProductType('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('featured');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">
            Catalogue 2Frères Phone
          </h1>
          <p className="text-sm text-slate-600 mt-1 tabular-nums">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''} affiché{filtered.length > 1 ? 's' : ''}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 md:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Recherche instantanée dans le catalogue"
              placeholder="Recherche instantanée..."
              className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
            />
          </div>

          <select
            aria-label="Trier les produits"
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
          >
            <option value="featured">Mise en avant</option>
            <option value="price_asc">Prix croissant (DZD)</option>
            <option value="price_desc">Prix décroissant (DZD)</option>
            <option value="rating">Mieux notés</option>
            <option value="newest">Nouveautés</option>
          </select>
        </div>
      </div>

      {/* Group segmented filter */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setGroup('');
              setCategorySlug('');
            }}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              group === '' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Tous les rayons
          </button>
          {CATEGORY_GROUPS.map((g) => (
            <button
              key={g.value}
              type="button"
              onClick={() => {
                setGroup(g.value);
                setCategorySlug('');
              }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
                group === g.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              {g.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Sidebar Filters */}
        <aside className="lg:col-span-3 space-y-6">
          <div className="bg-white border border-slate-200 rounded-xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                <SlidersHorizontal className="w-4 h-4" />
                <span>Filtres</span>
              </div>
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs text-blue-700 hover:underline inline-flex items-center gap-1"
              >
                <X className="w-3 h-3" />
                <span>Réinitialiser</span>
              </button>
            </div>

            <div>
              <label htmlFor="cat-select" className="block text-xs font-semibold text-slate-700 mb-2">
                Sous-catégorie
              </label>
              <select
                id="cat-select"
                value={categorySlug}
                onChange={(e) => setCategorySlug(e.target.value)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                <option value="">Toutes les catégories</option>
                {visibleCategories.map((c) => (
                  <option key={c.id} value={c.slug}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">Type de produit</span>
              <div className="space-y-1.5 text-sm">
                {[
                  { id: 'all', label: 'Tous' },
                  { id: 'physical', label: 'Produits physiques (Livraison)' },
                  { id: 'digital', label: 'Produits numériques' },
                ].map((opt) => (
                  <label key={opt.id} className="flex items-center gap-2 cursor-pointer text-slate-700">
                    <input
                      type="radio"
                      name="prod-type"
                      checked={productType === opt.id}
                      onChange={() => setProductType(opt.id as any)}
                      className="text-blue-700 focus:ring-blue-600"
                    />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs font-semibold text-slate-700 mb-2">Budget (DZD)</span>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  min={0}
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  placeholder="Min"
                  aria-label="Prix minimum DZD"
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 font-mono tabular-nums"
                />
                <input
                  type="number"
                  min={0}
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  placeholder="Max"
                  aria-label="Prix maximum DZD"
                  className="w-full px-2.5 py-2 text-sm rounded-lg border border-slate-300 font-mono tabular-nums"
                />
              </div>
            </div>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9">
          {filtered.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-12 text-center">
              <p className="font-display font-semibold text-base text-slate-900">
                Aucun produit ne correspond à ces critères
              </p>
              <p className="text-sm text-slate-500 mt-1">
                Essayez d’élargir votre recherche ou de réinitialiser les filtres.
              </p>
              <button
                type="button"
                onClick={resetFilters}
                className="mt-4 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium hover:bg-slate-800"
              >
                Afficher tout le catalogue
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {filtered.map((product) => (
                <ProductCard
                  key={product.id}
                  product={product}
                  onSelect={onSelectProduct}
                  onAddToCart={onAddToCart}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
