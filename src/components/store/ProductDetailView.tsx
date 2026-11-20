import React, { useEffect, useState } from 'react';
import { ArrowLeft, CheckCircle2, MessageCircle, Minus, Palette, Plus, ShieldCheck, ShoppingBag, Truck } from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ProductColorOption, PublicReview, StoreProduct, StoreSettings } from '../../types';
import { buildWhatsAppOrderUrl, formatDzd } from '../../shared/domain';
import { ProductImage } from '../ProductImage';
import { StarInput, StarRating } from '../StarRating';

interface ProductDetailViewProps {
  slug: string;
  settings: StoreSettings;
  onBack: () => void;
  onAddToCart: (product: StoreProduct, qty: number, selectedColor?: string) => void;
  onGoCheckout: () => void;
}

export function ProductDetailView({
  slug,
  settings,
  onBack,
  onAddToCart,
  onGoCheckout,
}: ProductDetailViewProps) {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>('');

  // Review submission state
  const [orderRef, setOrderRef] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiFetch<{ product: StoreProduct; reviews: PublicReview[] }>(`/api/products/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!active) return;
        setProduct(data.product);
        setReviews(data.reviews || []);
        setActiveImageIdx(0);
        setQuantity(1);
        setSelectedColor(data.product.colors?.[0]?.name || '');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message || 'Produit introuvable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setSubmittingReview(true);
    setReviewFeedback(null);
    try {
      const res = await apiFetch<{ message: string }>(`/api/products/${product.id}/reviews`, {
        method: 'POST',
        body: JSON.stringify({
          orderReference: orderRef,
          phone: reviewPhone,
          rating,
          title: reviewTitle,
          comment: reviewComment,
        }),
      });
      setReviewFeedback({ type: 'ok', msg: res.message });
      setOrderRef('');
      setReviewPhone('');
      setReviewTitle('');
      setReviewComment('');
      setRating(5);
    } catch (err: any) {
      setReviewFeedback({ type: 'err', msg: err.message || 'Impossible de publier l’avis.' });
    } finally {
      setSubmittingReview(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 animate-pulse">
          <div className="lg:col-span-6 aspect-[4/3] bg-slate-200 rounded-xl" />
          <div className="lg:col-span-6 space-y-4">
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-8 bg-slate-200 rounded w-4/5" />
            <div className="h-6 bg-slate-200 rounded w-1/4" />
            <div className="h-24 bg-slate-200 rounded" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <p className="font-display font-semibold text-lg text-slate-900">{error || 'Produit introuvable'}</p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-900 text-white text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au catalogue</span>
        </button>
      </div>
    );
  }

  const gallery = product.images && product.images.length > 0 ? product.images : [];
  const availableColors: ProductColorOption[] = Array.isArray(product.colors)
    ? product.colors.filter((c) => c && c.name)
    : [];
  const selectedColorObj = availableColors.find((c) => c.name === selectedColor);
  const mainImageUrl =
    selectedColorObj?.imageUrl || gallery[activeImageIdx]?.url || product.primaryImage || null;
  const outOfStock =
    (product.productType === 'physical' && product.stockQuantity <= 0) ||
    (product.productType === 'digital' && product.digitalAvailability === 'paused');

  const productWithColorTitle = selectedColor
    ? `${product.name} (Couleur : ${selectedColor})`
    : product.name;

  const whatsappDirectUrl = buildWhatsAppOrderUrl(settings.whatsappPhone, {
    storeName: settings.storeName,
    firstName: 'Client',
    lastName: 'Boutique',
    phone: '',
    wilayaName: 'À préciser',
    commune: 'À préciser',
    address: 'À préciser',
    deliveryType: product.productType === 'digital' ? 'digital' : 'home',
    items: [{ name: productWithColorTitle, quantity, unitPriceDzd: product.priceDzd }],
    subtotalDzd: product.priceDzd * quantity,
    discountDzd: 0,
    shippingFeeDzd: 0,
    totalDzd: product.priceDzd * quantity,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour au catalogue</span>
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
          {/* Left: Sticky Photo Gallery */}
          <div className="lg:col-span-6 lg:sticky lg:top-24 space-y-3">
            <div className="aspect-[4/3] bg-white border border-slate-200 rounded-xl overflow-hidden">
              <ProductImage src={mainImageUrl} alt={product.name} />
            </div>
            {gallery.length > 1 && (
              <div className="grid grid-cols-5 gap-2.5">
                {gallery.map((img, idx) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setActiveImageIdx(idx)}
                    aria-label={`Afficher photo ${idx + 1}`}
                    className={`aspect-square rounded-lg overflow-hidden border-2 transition-colors ${
                      idx === activeImageIdx ? 'border-blue-700' : 'border-slate-200 hover:border-slate-400'
                    }`}
                  >
                    <ProductImage src={img.url} alt={img.altText || product.name} />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Right: Contiguous Purchase Module */}
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6">
            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                <span>{product.categoryName}</span>
                {product.brand && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span>{product.brand}</span>
                  </>
                )}
                <span aria-hidden="true">·</span>
                <span className="font-mono">{product.sku}</span>
              </div>

              <h1 className="mt-2 font-display font-bold text-2xl sm:text-3xl text-slate-900 tracking-tight text-balance">
                {product.name}
              </h1>

              <div className="mt-3 flex items-center gap-4">
                <StarRating
                  rating={product.averageRating}
                  count={product.reviewCount}
                  size="md"
                />
                <a href="#avis-clients" className="text-xs font-medium text-blue-700 hover:underline">
                  Voir les avis vérifiés
                </a>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex items-baseline gap-3">
              <span className="font-mono font-bold text-2xl text-slate-900 tabular-nums">
                {formatDzd(product.priceDzd)}
              </span>
              {product.compareAtPriceDzd && product.compareAtPriceDzd > product.priceDzd && (
                <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                  {formatDzd(product.compareAtPriceDzd)}
                </span>
              )}
            </div>

            <div className="text-sm">
              {outOfStock ? (
                <p className="text-red-600 font-medium">Actuellement en rupture de stock</p>
              ) : product.productType === 'digital' ? (
                <p className="text-emerald-700 font-medium">
                  Service numérique disponible · Traitement manuel sécurisé après validation
                </p>
              ) : (
                <p className="text-emerald-700 font-medium tabular-nums">
                  En stock ({product.stockQuantity} unité{product.stockQuantity > 1 ? 's' : ''} disponible
                  {product.stockQuantity > 1 ? 's' : ''})
                </p>
              )}
            </div>

            {/* Available Colors Selector */}
            {availableColors.length > 0 && (
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                  <Palette className="w-4 h-4 text-blue-700" />
                  <span>Couleur disponible :</span>
                  <span className="text-blue-700">{selectedColor}</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {availableColors.map((c) => {
                    const active = selectedColor === c.name;
                    return (
                      <button
                        key={c.name}
                        type="button"
                        onClick={() => {
                          setSelectedColor(c.name);
                          if (c.imageUrl) {
                            const matchIdx = gallery.findIndex((g) => g.url === c.imageUrl);
                            if (matchIdx >= 0) setActiveImageIdx(matchIdx);
                          }
                        }}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          active
                            ? 'border-blue-700 bg-blue-600 text-white shadow-sm'
                            : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-white/60 shrink-0"
                          style={{ backgroundColor: c.hex || '#0f172a' }}
                        />
                        <span>{c.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {product.shortDescription && (
              <p className="text-sm text-slate-600 leading-relaxed">{product.shortDescription}</p>
            )}

            {/* Quantity & Primary Actions */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center gap-3">
                <div className="inline-flex items-center border border-slate-300 rounded-lg bg-white">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Diminuer la quantité"
                    className="p-3 text-slate-700 hover:bg-slate-50"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="px-4 font-mono font-semibold text-sm tabular-nums">{quantity}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setQuantity((q) =>
                        Math.min(product.productType === 'digital' ? 10 : Math.max(1, product.stockQuantity), q + 1),
                      )
                    }
                    aria-label="Augmenter la quantité"
                    className="p-3 text-slate-700 hover:bg-slate-50"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>

                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => onAddToCart(product, quantity, selectedColor || undefined)}
                  className="flex-1 inline-flex items-center justify-center gap-2 py-3 px-5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors"
                >
                  <ShoppingBag className="w-4 h-4" />
                  <span>Ajouter au panier</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <button
                  type="button"
                  disabled={outOfStock}
                  onClick={() => {
                    onAddToCart(product, quantity, selectedColor || undefined);
                    onGoCheckout();
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 text-white text-sm font-semibold transition-colors"
                >
                  Commander maintenant
                </button>
                <a
                  href={whatsappDirectUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>Commander sur WhatsApp</span>
                </a>
              </div>
            </div>

            <div className="pt-5 border-t border-slate-100 space-y-2.5 text-xs text-slate-600">
              {product.productType === 'digital' ? (
                <div className="flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 text-blue-700 shrink-0 mt-0.5" />
                  <span>{product.digitalActivationNote || settings.digitalOrderNote}</span>
                </div>
              ) : (
                <>
                  <div className="flex items-center gap-2.5">
                    <Truck className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>Livraison rapide 58 wilayas — À domicile ou STOP DESK.</span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Paiement à la livraison (Cash on Delivery) en DZD.</span>
                  </div>
                </>
              )}
            </div>

            {product.description && (
              <div className="pt-5 border-t border-slate-100">
                <h2 className="font-display font-semibold text-sm text-slate-900 mb-2">
                  Description détaillée
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">
                  {product.description}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Customer Reviews Section */}
      <section id="avis-clients" className="pt-10 border-t border-slate-200">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          {/* Summary + Approved Reviews */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <h2 className="font-display font-bold text-2xl text-slate-900">
                Avis clients vérifiés
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-6">
                <div>
                  <p className="font-mono font-bold text-4xl text-slate-900 tabular-nums">
                    {product.averageRating > 0 ? product.averageRating.toFixed(1) : '—'}
                    <span className="text-base font-normal text-slate-400"> / 5</span>
                  </p>
                  <StarRating rating={product.averageRating} count={product.reviewCount} size="md" showNumeric={false} />
                  <p className="text-xs text-slate-500 mt-1 tabular-nums">
                    Basé sur {product.reviewCount} avis vérifié{product.reviewCount > 1 ? 's' : ''}
                  </p>
                </div>

                {product.ratingDistribution && (
                  <div className="flex-1 min-w-[200px] space-y-1.5">
                    {([5, 4, 3, 2, 1] as const).map((star) => {
                      const c = product.ratingDistribution?.[star] || 0;
                      const pct = product.reviewCount > 0 ? Math.round((c / product.reviewCount) * 100) : 0;
                      return (
                        <div key={star} className="flex items-center gap-2 text-xs text-slate-600">
                          <span className="w-8 font-mono tabular-nums">{star} ★</span>
                          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${pct}%` }} />
                          </div>
                          <span className="w-8 text-right font-mono tabular-nums text-slate-500">{c}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {reviews.length === 0 ? (
              <div className="bg-white border border-slate-200 rounded-xl p-6 text-sm text-slate-600">
                Aucun avis publié pour le moment. Vous avez acheté cet article ? Laissez votre évaluation avec votre référence de commande.
              </div>
            ) : (
              <div className="space-y-4">
                {reviews.map((rev) => (
                  <article key={rev.id} className="bg-white border border-slate-200 rounded-xl p-5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <StarRating rating={rev.rating} showNumeric={false} />
                        <span className="text-sm font-semibold text-slate-900">{rev.customerName}</span>
                        {rev.isVerifiedPurchase && (
                          <span className="text-xs text-emerald-700 font-medium">· Achat vérifié</span>
                        )}
                      </div>
                      <span className="text-xs text-slate-400 tabular-nums">
                        {new Date(rev.createdAt).toLocaleDateString('fr-FR')}
                      </span>
                    </div>
                    {rev.title && <h3 className="text-sm font-semibold text-slate-900">{rev.title}</h3>}
                    <p className="text-sm text-slate-600 leading-relaxed">{rev.comment}</p>
                    {rev.adminReply && (
                      <div className="mt-3 pt-3 border-t border-slate-100 text-xs text-slate-600">
                        <span className="font-semibold text-slate-900">Réponse 2Frères Phone : </span>
                        {rev.adminReply}
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </div>

          {/* Verified Purchase Review Form */}
          <div className="lg:col-span-5">
            <form
              onSubmit={handleSubmitReview}
              className="bg-white border border-slate-200 rounded-xl p-6 space-y-4"
            >
              <div>
                <h3 className="font-display font-semibold text-lg text-slate-900">
                  Laisser un avis client
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  Réservé aux acheteurs ayant commandé cet article. Chaque avis est vérifié par notre équipe avant publication.
                </p>
              </div>

              <div>
                <span className="block text-xs font-semibold text-slate-700 mb-1.5">Votre note *</span>
                <StarInput value={rating} onChange={setRating} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label htmlFor="rev-order" className="block text-xs font-semibold text-slate-700 mb-1">
                    Référence commande *
                  </label>
                  <input
                    id="rev-order"
                    required
                    value={orderRef}
                    onChange={(e) => setOrderRef(e.target.value)}
                    placeholder="2FP-2026-000101"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label htmlFor="rev-phone" className="block text-xs font-semibold text-slate-700 mb-1">
                    Téléphone commande *
                  </label>
                  <input
                    id="rev-phone"
                    required
                    value={reviewPhone}
                    onChange={(e) => setReviewPhone(e.target.value)}
                    placeholder="0550 12 34 56"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="rev-title" className="block text-xs font-semibold text-slate-700 mb-1">
                  Titre (optionnel)
                </label>
                <input
                  id="rev-title"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="Ex. Très bonne qualité et livraison rapide"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label htmlFor="rev-comment" className="block text-xs font-semibold text-slate-700 mb-1">
                  Votre avis écrit *
                </label>
                <textarea
                  id="rev-comment"
                  required
                  rows={4}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder="Partagez votre expérience avec ce produit..."
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              {reviewFeedback && (
                <div
                  className={`p-3 rounded-lg text-xs border ${
                    reviewFeedback.type === 'ok'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
                      : 'bg-red-50 text-red-700 border-red-200'
                  }`}
                >
                  {reviewFeedback.msg}
                </div>
              )}

              <button
                type="submit"
                disabled={submittingReview}
                className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:bg-slate-400 text-white text-sm font-semibold transition-colors"
              >
                {submittingReview ? 'Envoi en cours...' : 'Soumettre mon avis vérifié'}
              </button>
            </form>
          </div>
        </div>
      </section>
    </div>
  );
}
