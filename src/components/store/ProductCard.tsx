import { useState } from 'react';
import { ShoppingBag, ZoomIn } from 'lucide-react';
import { StoreProduct } from '../../types';
import { formatDzd } from '../../shared/domain';
import { ImageZoomLightbox } from '../ImageZoomLightbox';
import { ProductImage } from '../ProductImage';
import { StarRating } from '../StarRating';

interface ProductCardProps {
  product: StoreProduct;
  onSelect: (slug: string) => void;
  onAddToCart: (product: StoreProduct) => void;
}

export function ProductCard({ product, onSelect, onAddToCart }: ProductCardProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const outOfStock =
    (product.productType === 'physical' && product.stockQuantity <= 0) ||
    (product.productType === 'digital' && product.digitalAvailability === 'paused');

  const galleryImages =
    product.images && product.images.length > 0
      ? product.images.map((g) => ({ url: g.url, alt: g.altText || product.name }))
      : product.primaryImage
      ? [{ url: product.primaryImage, alt: product.name }]
      : [];

  return (
    <>
      <article className="group bg-white border border-slate-200 rounded-xl overflow-hidden flex flex-col transition-transform duration-200 hover:-translate-y-0.5 hover:border-slate-300">
        <div className="aspect-[4/3] bg-white overflow-hidden relative border-b border-slate-100">
          <a
            href={`/produit/${product.slug}`}
            onClick={(e) => {
              e.preventDefault();
              onSelect(product.slug);
            }}
            className="block w-full h-full"
          >
            <ProductImage
              src={product.primaryImage}
              alt={product.name}
              className="w-full h-full object-contain bg-white transition-transform duration-300 group-hover:scale-[1.02]"
            />
          </a>
          {product.primaryImage && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setLightboxOpen(true);
              }}
              aria-label={`Agrandir l'image de ${product.name}`}
              title="Agrandir l'image pour voir l'intégralité"
              className="absolute top-2.5 right-2.5 p-2 rounded-lg bg-slate-900/75 hover:bg-blue-700 text-white shadow-sm backdrop-blur-xs transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span className="truncate">{product.categoryName}</span>
            <span aria-hidden="true">·</span>
            <span className={outOfStock ? 'text-red-600 font-medium' : 'text-emerald-700'}>
              {outOfStock
                ? 'Rupture'
                : product.productType === 'digital'
                ? 'Numérique'
                : 'En stock'}
            </span>
          </div>

          <h3 className="mt-1.5 text-[15px] font-semibold text-slate-900 leading-snug line-clamp-2">
            <a
              href={`/produit/${product.slug}`}
              onClick={(e) => {
                e.preventDefault();
                onSelect(product.slug);
              }}
              className="hover:text-blue-700 transition-colors"
            >
              {product.name}
            </a>
          </h3>

          <div className="mt-2">
            <StarRating
              rating={product.averageRating}
              count={product.reviewCount}
              size="sm"
            />
          </div>

          <div className="mt-auto pt-4 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono font-semibold text-[15px] text-slate-900 tabular-nums">
                {formatDzd(product.priceDzd)}
              </p>
              {product.compareAtPriceDzd && product.compareAtPriceDzd > product.priceDzd && (
                <p className="font-mono text-xs text-slate-400 line-through tabular-nums">
                  {formatDzd(product.compareAtPriceDzd)}
                </p>
              )}
            </div>

            <button
              type="button"
              disabled={outOfStock}
              onClick={() => onAddToCart(product)}
              aria-label={`Ajouter ${product.name} au panier`}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-slate-900 text-white hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              <span>Ajouter</span>
            </button>
          </div>
        </div>
      </article>

      {lightboxOpen && galleryImages.length > 0 && (
        <ImageZoomLightbox
          images={galleryImages}
          title={product.name}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </>
  );
}
