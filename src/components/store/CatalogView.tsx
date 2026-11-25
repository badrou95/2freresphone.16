import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  Scale,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { Category, StoreProduct } from '../../types';
import { CATEGORY_GROUPS, formatDzd } from '../../shared/domain';
import { PaginationBar } from '../PaginationBar';
import { ProductImage } from '../ProductImage';
import { StarRating } from '../StarRating';
import { ProductCard } from './ProductCard';
import { ProductCardSkeleton } from './StoreSkeletons';

interface CatalogViewProps {
  products: StoreProduct[];
  categories: Category[];
  loading?: boolean;
  initialGroup?: string;
  initialCategory?: string;
  initialQuery?: string;
  onQueryChange?: (query: string) => void;
  onSelectProduct: (slug: string) => void;
  onAddToCart: (product: StoreProduct) => void;
}

export function CatalogView({
  products,
  categories,
  loading = false,
  initialGroup = '',
  initialCategory = '',
  initialQuery = '',
  onQueryChange,
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
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(9);
  const [compareIds, setCompareIds] = useState<number[]>([]);
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const catalogTopRef = useRef<HTMLDivElement | null>(null);

  const comparedProducts = useMemo(
    () =>
      compareIds
        .map((id) => products.find((p) => p.id === id))
        .filter((p): p is StoreProduct => Boolean(p)),
    [compareIds, products],
  );

  const lowestComparedPrice = useMemo(() => {
    if (comparedProducts.length < 2) return null;
    return Math.min(...comparedProducts.map((p) => p.priceDzd));
  }, [comparedProducts]);

  const handleToggleCompare = (product: StoreProduct) => {
    setCompareIds((prev) => {
      if (prev.includes(product.id)) {
        const next = prev.filter((id) => id !== product.id);
        if (next.length < 2) setCompareModalOpen(false);
        return next;
      }
      if (prev.length >= 3) return prev;
      return [...prev, product.id];
    });
  };

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setGroup(initialGroup);
  }, [initialGroup]);

  useEffect(() => {
    setCategorySlug(initialCategory);
  }, [initialCategory]);

  const updateQuery = (nextQuery: string) => {
    setQuery(nextQuery);
    onQueryChange?.(nextQuery);
  };

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

  // Reset to page 1 whenever filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [query, group, categorySlug, productType, minPrice, maxPrice, sort, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  const paginatedProducts = useMemo(() => {
    const start = (safePage - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, safePage, pageSize]);

  const handlePageChange = (nextPage: number) => {
    setCurrentPage(nextPage);
    if (catalogTopRef.current) {
      catalogTopRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const resetFilters = () => {
    updateQuery('');
    setGroup('');
    setCategorySlug('');
    setProductType('all');
    setMinPrice('');
    setMaxPrice('');
    setSort('featured');
    setCurrentPage(1);
  };

  return (
    <div ref={catalogTopRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-200">
        <div>
          <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">
            Catalogue 2Frères Phone
          </h1>
          <p className="text-sm text-slate-600 mt-1 tabular-nums">
            {filtered.length} produit{filtered.length > 1 ? 's' : ''} disponible{filtered.length > 1 ? 's' : ''} · Page{' '}
            <strong className="text-blue-700">{safePage}</strong> sur {totalPages} ({pageSize} par page)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative min-w-[240px] flex-1 md:flex-none">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => updateQuery(e.target.value)}
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

        {/* Product Grid + Top & Bottom Numbered Pagination */}
        <div className="lg:col-span-9 space-y-5">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
              {Array.from({ length: 6 }).map((_, idx) => (
                <ProductCardSkeleton key={idx} />
              ))}
            </div>
          ) : filtered.length === 0 ? (
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
            <>
              <PaginationBar
                currentPage={safePage}
                totalItems={filtered.length}
                pageSize={pageSize}
                pageSizeOptions={[5, 6, 9, 10]}
                onPageChange={handlePageChange}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6">
                {paginatedProducts.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={product}
                    onSelect={onSelectProduct}
                    onAddToCart={onAddToCart}
                    isCompared={compareIds.includes(product.id)}
                    compareDisabled={compareIds.length >= 3}
                    onToggleCompare={handleToggleCompare}
                  />
                ))}
              </div>

              <PaginationBar
                currentPage={safePage}
                totalItems={filtered.length}
                pageSize={pageSize}
                pageSizeOptions={[5, 6, 9, 10]}
                onPageChange={handlePageChange}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
              />
            </>
          )}
        </div>
      </div>

      {/* Floating Comparison Bar (when 1 to 3 products are checked) */}
      {comparedProducts.length > 0 && (
        <div
          role="region"
          aria-label="Comparateur de produits"
          className="fixed bottom-4 inset-x-4 z-40 max-w-5xl mx-auto bg-slate-900/95 backdrop-blur-md text-white border border-slate-700 rounded-2xl shadow-2xl p-3 sm:p-4"
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/40 text-blue-300 text-xs font-bold shrink-0">
                <Scale className="w-4 h-4" />
                <span>Comparateur ({comparedProducts.length}/3)</span>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                {comparedProducts.map((item) => (
                  <div
                    key={item.id}
                    className="inline-flex items-center gap-2 bg-slate-800 border border-slate-700 rounded-xl pl-2 pr-1.5 py-1 text-xs"
                  >
                    <ProductImage
                      src={item.primaryImage}
                      alt={item.name}
                      className="w-7 h-7 rounded object-contain bg-white shrink-0"
                    />
                    <div className="max-w-[140px] sm:max-w-[170px]">
                      <p className="font-semibold text-white truncate">{item.name}</p>
                      <p className="font-mono text-[11px] text-emerald-400 tabular-nums">
                        {formatDzd(item.priceDzd)}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleToggleCompare(item)}
                      aria-label={`Retirer ${item.name} du comparateur`}
                      className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}

                {comparedProducts.length < 2 && (
                  <span className="text-xs text-slate-300 italic pl-1">
                    Cochez encore 1 ou 2 produits pour lancer la comparaison
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 self-end md:self-center">
              <button
                type="button"
                onClick={() => {
                  setCompareIds([]);
                  setCompareModalOpen(false);
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl text-xs font-semibold text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Vider</span>
              </button>

              <button
                type="button"
                disabled={comparedProducts.length < 2}
                onClick={() => setCompareModalOpen(true)}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 disabled:bg-slate-700 disabled:text-slate-400 disabled:cursor-not-allowed text-white shadow-sm transition-colors"
              >
                <Scale className="w-4 h-4" />
                <span>Comparer ({comparedProducts.length})</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Side-by-Side Comparison Modal (2 or 3 products) */}
      {compareModalOpen && comparedProducts.length >= 2 && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Comparaison détaillée des produits"
          className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-6 overflow-y-auto"
          onClick={() => setCompareModalOpen(false)}
        >
          <div
            className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-4 border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-blue-600/20 border border-blue-500/40 text-blue-400">
                  <Scale className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">
                    Comparatif de produits ({comparedProducts.length} articles)
                  </h2>
                  <p className="text-xs text-slate-300">
                    Comparez les prix en DZD, la disponibilité et les caractéristiques côte à côte
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                aria-label="Fermer le comparateur"
                className="p-2 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Table Body */}
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full border-collapse text-left min-w-[640px]">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70">
                    <th className="p-4 w-44 text-xs font-bold uppercase tracking-wider text-slate-500 align-top">
                      Produit
                    </th>
                    {comparedProducts.map((p) => {
                      const outOfStock =
                        (p.productType === 'physical' && p.stockQuantity <= 0) ||
                        (p.productType === 'digital' && p.digitalAvailability === 'paused');

                      return (
                        <th key={p.id} className="p-4 align-top border-l border-slate-200 min-w-[200px]">
                          <div className="relative flex flex-col">
                            <button
                              type="button"
                              onClick={() => handleToggleCompare(p)}
                              title="Retirer de la comparaison"
                              className="self-end p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>

                            <a
                              href={`/produit/${p.slug}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setCompareModalOpen(false);
                                onSelectProduct(p.slug);
                              }}
                              className="aspect-[4/3] w-full max-h-36 rounded-xl border border-slate-200 bg-white overflow-hidden flex items-center justify-center mb-3"
                            >
                              <ProductImage
                                src={p.primaryImage}
                                alt={p.name}
                                className="w-full h-full object-contain"
                              />
                            </a>

                            <a
                              href={`/produit/${p.slug}`}
                              onClick={(e) => {
                                e.preventDefault();
                                setCompareModalOpen(false);
                                onSelectProduct(p.slug);
                              }}
                              className="text-sm font-bold text-slate-900 hover:text-blue-700 line-clamp-2"
                            >
                              {p.name}
                            </a>

                            <div className="mt-3 flex items-center gap-2">
                              <button
                                type="button"
                                disabled={outOfStock}
                                onClick={() => onAddToCart(p)}
                                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold bg-slate-900 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
                              >
                                <ShoppingBag className="w-3.5 h-3.5" />
                                <span>{outOfStock ? 'Rupture' : 'Ajouter au panier'}</span>
                              </button>
                            </div>
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-200 text-sm">
                  {/* Price Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Prix (Dinar Algérien)
                    </td>
                    {comparedProducts.map((p) => {
                      const isCheapest = lowestComparedPrice !== null && p.priceDzd === lowestComparedPrice;
                      const savings =
                        p.compareAtPriceDzd && p.compareAtPriceDzd > p.priceDzd
                          ? p.compareAtPriceDzd - p.priceDzd
                          : 0;
                      return (
                        <td key={p.id} className="p-4 border-l border-slate-200">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-mono font-bold text-base text-slate-900 tabular-nums">
                              {formatDzd(p.priceDzd)}
                            </span>
                            {isCheapest && (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                                <CheckCircle2 className="w-3 h-3" />
                                Meilleur prix
                              </span>
                            )}
                          </div>
                          {savings > 0 && (
                            <p className="text-xs text-slate-500 mt-0.5 font-mono tabular-nums">
                              <span className="line-through mr-1.5">{formatDzd(p.compareAtPriceDzd!)}</span>
                              <span className="text-emerald-700 font-semibold">
                                (-{formatDzd(savings)})
                              </span>
                            </p>
                          )}
                        </td>
                      );
                    })}
                  </tr>

                  {/* Rating Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Avis clients
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 border-l border-slate-200">
                        <StarRating rating={p.averageRating} count={p.reviewCount} size="sm" />
                      </td>
                    ))}
                  </tr>

                  {/* Category Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Catégorie
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 border-l border-slate-200 text-slate-800 font-medium">
                        {p.categoryName}
                      </td>
                    ))}
                  </tr>

                  {/* Brand Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Marque
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 border-l border-slate-200 text-slate-700">
                        {p.brand || '2Frères Phone'}
                      </td>
                    ))}
                  </tr>

                  {/* Availability & Delivery Type Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Disponibilité & Mode
                    </td>
                    {comparedProducts.map((p) => {
                      const outOfStock =
                        (p.productType === 'physical' && p.stockQuantity <= 0) ||
                        (p.productType === 'digital' && p.digitalAvailability === 'paused');
                      return (
                        <td key={p.id} className="p-4 border-l border-slate-200">
                          <div className="space-y-1">
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold ${
                                outOfStock
                                  ? 'bg-red-50 text-red-700'
                                  : 'bg-emerald-50 text-emerald-800'
                              }`}
                            >
                              {outOfStock
                                ? 'Rupture de stock'
                                : p.productType === 'digital'
                                ? 'Disponible (Activation numérique)'
                                : `En stock (${p.stockQuantity} unités)`}
                            </span>
                            <p className="text-xs text-slate-500">
                              {p.productType === 'digital'
                                ? 'Service numérique officiel'
                                : 'Livraison 58 Wilayas · Paiement à la livraison (COD)'}
                            </p>
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Colors Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Couleurs / Variantes
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 border-l border-slate-200">
                        {p.colors && p.colors.length > 0 ? (
                          <div className="flex flex-wrap items-center gap-1.5">
                            {p.colors.map((c) => (
                              <span
                                key={c.name}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-slate-200 bg-slate-50 text-xs text-slate-700"
                              >
                                <span
                                  className="w-2.5 h-2.5 rounded-full border border-slate-300"
                                  style={{ backgroundColor: c.hex }}
                                />
                                {c.name}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Standard</span>
                        )}
                      </td>
                    ))}
                  </tr>

                  {/* SKU Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Référence (SKU)
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 border-l border-slate-200 font-mono text-xs text-slate-600">
                        {p.sku}
                      </td>
                    ))}
                  </tr>

                  {/* Summary / Description Row */}
                  <tr>
                    <td className="p-4 text-xs font-bold text-slate-600 bg-slate-50/50">
                      Résumé & Points clés
                    </td>
                    {comparedProducts.map((p) => (
                      <td key={p.id} className="p-4 border-l border-slate-200 text-xs text-slate-600 leading-relaxed">
                        {p.shortDescription || p.description || '—'}
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={() => {
                  setCompareIds([]);
                  setCompareModalOpen(false);
                }}
                className="text-xs font-semibold text-slate-600 hover:text-red-600 transition-colors"
              >
                Effacer la sélection
              </button>
              <button
                type="button"
                onClick={() => setCompareModalOpen(false)}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-bold hover:bg-slate-800 transition-colors"
              >
                Fermer le comparatif
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
