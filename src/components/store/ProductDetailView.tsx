import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Flame,
  Landmark,
  MapPin,
  MessageCircle,
  Minus,
  PackageCheck,
  Palette,
  PhoneCall,
  Plus,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Truck,
  Zap,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { ALGERIA_WILAYAS } from '../../shared/algeria';
import {
  buildWhatsAppOrderUrl,
  formatDzd,
  getSaasConfig,
  isValidAlgerianPhone,
} from '../../shared/domain';
import {
  ProductColorOption,
  PublicReview,
  StoreBootstrap,
  StoreProduct,
  StoreSettings,
} from '../../types';
import { ProductImage } from '../ProductImage';
import { StarInput, StarRating } from '../StarRating';

interface ProductDetailViewProps {
  slug: string;
  settings: StoreSettings;
  bootstrap?: StoreBootstrap | null;
  allProducts?: StoreProduct[];
  onSelectProduct?: (slug: string) => void;
  onBack: () => void;
  onAddToCart: (product: StoreProduct, qty: number, selectedColor?: string) => void;
  onGoCheckout: () => void;
  onTrackOrder?: (reference: string) => void;
}

export function ProductDetailView({
  slug,
  settings,
  bootstrap,
  allProducts = [],
  onSelectProduct,
  onBack,
  onAddToCart,
  onGoCheckout,
  onTrackOrder,
}: ProductDetailViewProps) {
  const [product, setProduct] = useState<StoreProduct | null>(null);
  const [reviews, setReviews] = useState<PublicReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeImageIdx, setActiveImageIdx] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedBundle, setSelectedBundle] = useState<1 | 2 | 3>(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [selectedCrossSellIds, setSelectedCrossSellIds] = useState<number[]>([]);
  const [saasConfig, setSaasConfig] = useState(() => getSaasConfig());
  const expressFormRef = useRef<HTMLDivElement | null>(null);

  // Direct 1-Page COD Express Order Form State (DZBuild / Arkan / YouCan / Mystoq / Hanoutify) — 100% COD
  const [expressFullName, setExpressFullName] = useState(() => {
    try {
      return localStorage.getItem('2fp_cod_draft_name') || '';
    } catch {
      return '';
    }
  });
  const [expressPhone, setExpressPhone] = useState(() => {
    try {
      return localStorage.getItem('2fp_cod_draft_phone') || '';
    } catch {
      return '';
    }
  });
  const [expressWilaya, setExpressWilaya] = useState(() => {
    try {
      return localStorage.getItem('2fp_cod_draft_wilaya') || '16';
    } catch {
      return '16';
    }
  });
  const [expressCommune, setExpressCommune] = useState(() => {
    try {
      return localStorage.getItem('2fp_cod_draft_commune') || '';
    } catch {
      return '';
    }
  });
  const [expressAddress, setExpressAddress] = useState('');
  const [expressDeliveryType, setExpressDeliveryType] = useState<'home' | 'stop_desk'>('home');
  const [expressCarrierId, setExpressCarrierId] = useState<number | null>(null);
  const [expressSubmitting, setExpressSubmitting] = useState(false);
  const [expressError, setExpressError] = useState<string | null>(null);
  const [expressSuccessOrder, setExpressSuccessOrder] = useState<any | null>(null);

  // Auto-save COD form draft to localStorage so returning customers order in 5 seconds (Hanoutify / Colisify)
  useEffect(() => {
    try {
      localStorage.setItem('2fp_cod_draft_name', expressFullName);
      localStorage.setItem('2fp_cod_draft_phone', expressPhone);
      localStorage.setItem('2fp_cod_draft_wilaya', expressWilaya);
      localStorage.setItem('2fp_cod_draft_commune', expressCommune);
    } catch {
      // ignore
    }
  }, [expressCommune, expressFullName, expressPhone, expressWilaya]);

  // Review submission state
  const [orderRef, setOrderRef] = useState('');
  const [reviewPhone, setReviewPhone] = useState('');
  const [rating, setRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  useEffect(() => {
    const onCfg = () => setSaasConfig(getSaasConfig());
    const onCur = () => setSaasConfig({ ...getSaasConfig() });
    window.addEventListener('2fp-saas-config-change', onCfg);
    window.addEventListener('2fp-currency-change', onCur);
    return () => {
      window.removeEventListener('2fp-saas-config-change', onCfg);
      window.removeEventListener('2fp-currency-change', onCur);
    };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setExpressSuccessOrder(null);
    setSelectedCrossSellIds([]);
    apiFetch<{ product: StoreProduct; reviews: PublicReview[] }>(`/api/products/${encodeURIComponent(slug)}`)
      .then((data) => {
        if (!active) return;
        setProduct(data.product);
        setReviews(data.reviews || []);
        setActiveImageIdx(0);
        setQuantity(1);
        setSelectedBundle(1);
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

  const wilayaList = bootstrap?.wilayas?.length ? bootstrap.wilayas : ALGERIA_WILAYAS;
  const activeCarriers = bootstrap?.carriers || [];

  // Complementary Cross-Sell products ("Fréquemment achetés ensemble" — Shopify / YouCan / BigCommerce)
  const crossSellCandidates = useMemo(() => {
    if (!product || !allProducts.length) return [];
    const sameCat = allProducts.filter(
      (p) =>
        p.id !== product.id &&
        (p.productType !== 'physical' || p.stockQuantity > 0) &&
        p.categoryId === product.categoryId,
    );
    const others = allProducts.filter(
      (p) =>
        p.id !== product.id &&
        (p.productType !== 'physical' || p.stockQuantity > 0) &&
        p.categoryId !== product.categoryId,
    );
    return [...sameCat, ...others].slice(0, 2);
  }, [allProducts, product]);

  const selectedCrossSellProducts = useMemo(
    () => crossSellCandidates.filter((p) => selectedCrossSellIds.includes(p.id)),
    [crossSellCandidates, selectedCrossSellIds],
  );

  // Calculate live shipping fee for the selected wilaya & carrier
  const liveShippingInfo = useMemo(() => {
    if (!product || product.productType === 'digital') {
      return { homePriceDzd: 0, stopDeskPriceDzd: 0, feeDzd: 0, estimatedDays: 'Immédiat' };
    }
    const rates = (bootstrap?.shippingRates || []).filter((r) => r.wilayaCode === expressWilaya && r.isActive);
    const chosenRate =
      (expressCarrierId ? rates.find((r) => r.carrierId === expressCarrierId) : rates[0]) || rates[0];
    const homePrice = chosenRate ? chosenRate.homePriceDzd : 600;
    const stopDeskPrice = chosenRate ? chosenRate.stopDeskPriceDzd : 400;
    const baseFee = expressDeliveryType === 'stop_desk' ? stopDeskPrice : homePrice;
    // Bundle 3 offers free/priority shipping discount
    const effectiveFee = selectedBundle === 3 ? 0 : baseFee;
    return {
      homePriceDzd: homePrice,
      stopDeskPriceDzd: stopDeskPrice,
      feeDzd: effectiveFee,
      estimatedDays: chosenRate?.estimatedDays || '24h-48h',
    };
  }, [bootstrap?.shippingRates, expressCarrierId, expressDeliveryType, expressWilaya, product, selectedBundle]);

  // Bundle discount pricing + Cross-sell add-ons (YouCan / DZBuild / Colisify / Shopify style)
  const bundlePricing = useMemo(() => {
    const unit = product?.priceDzd || 0;
    const discountPct =
      saasConfig.quantityBundlesEnabled && selectedBundle === 2
        ? 10
        : saasConfig.quantityBundlesEnabled && selectedBundle === 3
        ? 15
        : 0;
    const effectiveUnit = Math.round((unit * (100 - discountPct)) / 100);
    const mainSubtotalDzd = effectiveUnit * quantity;
    const crossSellTotalDzd = selectedCrossSellProducts.reduce(
      (acc, p) => acc + Math.round(p.priceDzd * 0.95), // -5% bonus when added to same COD parcel
      0,
    );
    const subtotalDzd = mainSubtotalDzd + crossSellTotalDzd;
    const savingsDzd =
      Math.max(0, unit * quantity - mainSubtotalDzd) +
      selectedCrossSellProducts.reduce((acc, p) => acc + (p.priceDzd - Math.round(p.priceDzd * 0.95)), 0);
    const totalDzd = subtotalDzd + liveShippingInfo.feeDzd;
    return {
      unitDzd: unit,
      discountPct,
      effectiveUnitDzd: effectiveUnit,
      mainSubtotalDzd,
      crossSellTotalDzd,
      subtotalDzd,
      savingsDzd,
      totalDzd,
    };
  }, [
    liveShippingInfo.feeDzd,
    product?.priceDzd,
    quantity,
    saasConfig.quantityBundlesEnabled,
    selectedBundle,
    selectedCrossSellProducts,
  ]);

  const handleSelectBundle = (bundleQty: 1 | 2 | 3) => {
    setSelectedBundle(bundleQty);
    setQuantity(bundleQty);
  };

  const toggleCrossSell = (id: number) => {
    setSelectedCrossSellIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const handleExpressOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    setExpressError(null);

    const trimmedName = expressFullName.trim();
    if (trimmedName.length < 2) {
      setExpressError('Veuillez saisir votre nom et prénom.');
      return;
    }
    if (!isValidAlgerianPhone(expressPhone)) {
      setExpressError('Veuillez saisir un numéro de téléphone algérien valide (ex: 0550 12 34 56).');
      return;
    }

    const parts = trimmedName.split(/\s+/);
    const firstName = parts[0] || 'Client';
    const lastName = parts.slice(1).join(' ') || 'Algérie';
    const wilayaObj = wilayaList.find((w) => w.code === expressWilaya);
    const communeFinal = expressCommune.trim() || wilayaObj?.name || 'Centre';
    const addressFinal =
      expressAddress.trim() ||
      (expressDeliveryType === 'stop_desk'
        ? `Bureau Stop Desk (${wilayaObj?.name || expressWilaya})`
        : `${communeFinal}, ${wilayaObj?.name || ''}`);

    setExpressSubmitting(true);
    try {
      const orderItems = [
        {
          productId: product.id,
          quantity,
          selectedColor: selectedColor || undefined,
          customPriceDzd: bundlePricing.effectiveUnitDzd,
        },
        ...selectedCrossSellProducts.map((cp) => ({
          productId: cp.id,
          quantity: 1,
          customPriceDzd: Math.round(cp.priceDzd * 0.95),
        })),
      ];

      const res = await apiFetch<{ order: any }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName,
          phone: expressPhone,
          wilayaCode: expressWilaya,
          commune: communeFinal,
          address: addressFinal,
          deliveryType: product.productType === 'digital' ? 'digital' : expressDeliveryType,
          carrierId: expressCarrierId || activeCarriers[0]?.id || undefined,
          source: 'web',
          customerNotes: `[Paiement à la livraison COD]${
            selectedBundle > 1 ? ` · Pack Offre ${selectedBundle} unités (-${bundlePricing.discountPct}%)` : ''
          }${
            selectedCrossSellProducts.length > 0
              ? ` · +${selectedCrossSellProducts.length} article(s) groupé(s) dans le même colis`
              : ''
          }`,
          items: orderItems,
        }),
      });
      setExpressSuccessOrder(res.order);
    } catch (err: any) {
      setExpressError(err?.message || 'Erreur lors de la validation de votre commande.');
    } finally {
      setExpressSubmitting(false);
    }
  };

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
        <div className="h-4 w-36 bg-slate-200/80 rounded-md animate-pulse mb-6" />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-6 space-y-3">
            <div className="aspect-[4/3] bg-gradient-to-br from-slate-100 via-slate-200/75 to-slate-100 rounded-xl animate-pulse" />
            <div className="grid grid-cols-5 gap-2.5">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="aspect-square rounded-lg bg-slate-200/70 animate-pulse" />
              ))}
            </div>
          </div>
          <div className="lg:col-span-6 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-5">
            <div className="h-4 bg-slate-200/80 rounded-md w-1/3 animate-pulse" />
            <div className="h-8 bg-slate-200/90 rounded-lg w-4/5 animate-pulse" />
            <div className="h-7 bg-slate-200/90 rounded-lg w-1/3 animate-pulse" />
            <div className="h-24 bg-slate-100 rounded-xl animate-pulse" />
            <div className="h-56 bg-slate-100 rounded-xl animate-pulse" />
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

  const selectedWilayaObj = wilayaList.find((w) => w.code === expressWilaya);

  const whatsappDirectUrl = buildWhatsAppOrderUrl(settings.whatsappPhone, {
    storeName: settings.storeName,
    firstName: expressFullName || 'Client',
    lastName: '',
    phone: expressPhone || '',
    wilayaName: selectedWilayaObj ? `${selectedWilayaObj.code} - ${selectedWilayaObj.name}` : 'À préciser',
    commune: expressCommune || 'À préciser',
    address: expressAddress || 'À préciser',
    deliveryType: product.productType === 'digital' ? 'digital' : expressDeliveryType,
    items: [{ name: productWithColorTitle, quantity, unitPriceDzd: bundlePricing.effectiveUnitDzd }],
    subtotalDzd: bundlePricing.subtotalDzd,
    discountDzd: bundlePricing.savingsDzd,
    shippingFeeDzd: liveShippingInfo.feeDzd,
    totalDzd: bundlePricing.totalDzd,
  });

  // Deterministic live viewer count for social proof (YouCan / WiziShop style)
  const liveViewersCount = ((product.id * 7) % 14) + 6;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-16 pb-28">
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
            <div className="aspect-[4/3] bg-white border border-slate-200 rounded-xl overflow-hidden relative">
              <ProductImage src={mainImageUrl} alt={product.name} />
              {bundlePricing.discountPct > 0 && (
                <span className="absolute top-3 left-3 px-3 py-1 rounded-md bg-red-600 text-white text-xs font-bold shadow-sm">
                  OFFRE PACK -{bundlePricing.discountPct}%
                </span>
              )}
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

          {/* Right: Contiguous Purchase & 1-Page COD Express Module */}
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

              <div className="mt-3 flex flex-wrap items-center gap-4">
                <StarRating rating={product.averageRating} count={product.reviewCount} size="md" />
                <a href="#avis-clients" className="text-xs font-medium text-blue-700 hover:underline">
                  Voir les avis vérifiés
                </a>
              </div>
            </div>

            {/* Live Social Proof & Urgency Bar (YouCan / WiziShop / Mystoq feature) */}
            {saasConfig.urgencyVisitorsEnabled && !outOfStock && (
              <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-amber-50/90 border border-amber-200 text-xs text-amber-950">
                <div className="flex items-center gap-2 font-semibold">
                  <Eye className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>
                    <strong>{liveViewersCount} personnes</strong> consultent cet article en ce moment
                  </span>
                </div>
                {product.productType === 'physical' && product.stockQuantity <= 15 && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold">
                    <Flame className="w-3.5 h-3.5" />
                    <span>Plus que {product.stockQuantity} en stock</span>
                  </span>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-baseline gap-3">
              <span className="font-mono font-bold text-2xl sm:text-3xl text-slate-900 tabular-nums">
                {formatDzd(bundlePricing.effectiveUnitDzd)}
              </span>
              {(bundlePricing.discountPct > 0 ||
                (product.compareAtPriceDzd && product.compareAtPriceDzd > product.priceDzd)) && (
                <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                  {formatDzd(
                    bundlePricing.discountPct > 0
                      ? product.priceDzd
                      : product.compareAtPriceDzd || product.priceDzd,
                  )}
                </span>
              )}
              {bundlePricing.savingsDzd > 0 && (
                <span className="px-2.5 py-0.5 rounded-md bg-emerald-100 text-emerald-900 text-xs font-bold">
                  Économisez {formatDzd(bundlePricing.savingsDzd)}
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
                  {product.stockQuantity > 1 ? 's' : ''}) · Expédition immédiate 58 Wilayas
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

            {/* Quantity Bundles / Offres Dégressives COD (DZBuild / YouCan / Colisify / Shopify Bundles) */}
            {saasConfig.quantityBundlesEnabled && !outOfStock && product.stockQuantity >= 2 && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                    Offres Packs &amp; Remises Quantité (COD)
                  </span>
                  <span className="text-[11px] font-semibold text-emerald-700">
                    Achetez plus, économisez plus
                  </span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                  {[
                    {
                      qty: 1 as const,
                      title: '1 Unité',
                      badge: 'Standard',
                      desc: formatDzd(product.priceDzd),
                    },
                    {
                      qty: 2 as const,
                      title: '2 Unités (-10%)',
                      badge: 'Populaire',
                      desc: `${formatDzd(Math.round(product.priceDzd * 0.9))} / u.`,
                    },
                    {
                      qty: 3 as const,
                      title: '3 Unités (-15%)',
                      badge: 'Livraison Offerte',
                      desc: `${formatDzd(Math.round(product.priceDzd * 0.85))} / u.`,
                    },
                  ].map((b) => {
                    const active = selectedBundle === b.qty && quantity === b.qty;
                    return (
                      <button
                        key={b.qty}
                        type="button"
                        onClick={() => handleSelectBundle(b.qty)}
                        className={`p-3 rounded-xl border-2 text-left transition-all ${
                          active
                            ? 'border-blue-700 bg-blue-50/70 shadow-xs'
                            : 'border-slate-200 hover:border-slate-300 bg-white'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-xs font-bold text-slate-900">{b.title}</span>
                          <span
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                              b.qty === 3
                                ? 'bg-emerald-600 text-white'
                                : b.qty === 2
                                ? 'bg-blue-600 text-white'
                                : 'bg-slate-100 text-slate-700'
                            }`}
                          >
                            {b.badge}
                          </span>
                        </div>
                        <p className="mt-1 font-mono text-xs font-semibold text-slate-700">{b.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* DIRECT 1-PAGE COD EXPRESS CHECKOUT FORM ON PRODUCT PAGE (DZBuild / Arkan / Mystoq / Hanoutify / YouCan) */}
            {saasConfig.directCodFormOnProduct && !outOfStock && (
              <div
                ref={expressFormRef}
                id="formulaire-cod-express"
                className="rounded-2xl border-2 border-blue-600 bg-slate-50/90 p-4 sm:p-5 space-y-4 shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <span className="p-2 rounded-lg bg-blue-700 text-white">
                      <Zap className="w-4 h-4" />
                    </span>
                    <div>
                      <h2 className="font-display font-bold text-sm sm:text-base text-slate-900">
                        Commande Express 1-Clic — 58 Wilayas
                      </h2>
                      <p className="text-[11px] text-slate-600">
                        Remplissez vos coordonnées ci-dessous · Paiement 100% à la livraison après vérification du colis
                      </p>
                    </div>
                  </div>
                  <span className="px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold">
                    Yalidine · ZR Express · Maystro
                  </span>
                </div>

                {/* Same-Day Dispatch Timer (WiziShop / Shopify / Colisify feature) */}
                {saasConfig.sameDayDispatchTimerEnabled && product.productType === 'physical' && (
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-950">
                    <Clock className="w-4 h-4 text-blue-700 shrink-0" />
                    <span>
                      Expédition rapide vers <strong>{selectedWilayaObj?.name || 'votre wilaya'}</strong> (Délai estimé :{' '}
                      <strong>{liveShippingInfo.estimatedDays}</strong>) · Vérification du colis à l’ouverture autorisée.
                    </span>
                  </div>
                )}

                {expressSuccessOrder ? (
                  <div className="p-4 rounded-xl bg-emerald-50 border-2 border-emerald-600 space-y-3">
                    <div className="flex items-start gap-3">
                      <PackageCheck className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-bold text-emerald-950">
                          Commande {expressSuccessOrder.reference} enregistrée avec succès !
                        </p>
                        <p className="text-xs text-emerald-900 mt-1">
                          Notre équipe 2Frères Phone vous contacte par téléphone au{' '}
                          <strong>{expressSuccessOrder.phone}</strong> pour confirmer l’expédition vers{' '}
                          <strong>{expressSuccessOrder.wilayaName}</strong>.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      {onTrackOrder && (
                        <button
                          type="button"
                          onClick={() => onTrackOrder(expressSuccessOrder.reference)}
                          className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
                        >
                          Suivre ma commande ({expressSuccessOrder.reference})
                        </button>
                      )}
                      <a
                        href={whatsappDirectUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold"
                      >
                        <MessageCircle className="w-3.5 h-3.5" />
                        <span>Confirmer par WhatsApp</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleExpressOrderSubmit} className="space-y-3.5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Nom complet (Nom &amp; Prénom) *
                        </label>
                        <input
                          type="text"
                          required
                          value={expressFullName}
                          onChange={(e) => setExpressFullName(e.target.value)}
                          placeholder="Ex: Amine Benali"
                          className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                        />
                      </div>

                      <div>
                        <label className="block text-xs font-bold text-slate-800 mb-1">
                          Téléphone (05 / 06 / 07) *
                        </label>
                        <div className="relative">
                          <PhoneCall className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                          <input
                            type="tel"
                            required
                            value={expressPhone}
                            onChange={(e) => setExpressPhone(e.target.value)}
                            placeholder="0550 12 34 56"
                            className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                          />
                        </div>
                      </div>
                    </div>

                    {product.productType === 'physical' && (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                              Wilaya (58 Wilayas) *
                            </label>
                            <select
                              value={expressWilaya}
                              onChange={(e) => setExpressWilaya(e.target.value)}
                              className="w-full px-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                            >
                              {wilayaList.map((w) => (
                                <option key={w.code} value={w.code}>
                                  {w.code} - {w.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-bold text-slate-800 mb-1">
                              Commune / Adresse *
                            </label>
                            <div className="relative">
                              <MapPin className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                              <input
                                type="text"
                                required
                                value={expressCommune}
                                onChange={(e) => {
                                  setExpressCommune(e.target.value);
                                  setExpressAddress(e.target.value);
                                }}
                                placeholder="Ex: Bab Ezzouar, Centre-ville..."
                                className="w-full pl-9 pr-3 py-2.5 text-sm rounded-xl border border-slate-300 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-blue-600"
                              />
                            </div>
                          </div>
                        </div>

                        {/* Delivery Mode: Domicile vs Stop Desk */}
                        <div className="grid grid-cols-2 gap-2.5">
                          <button
                            type="button"
                            onClick={() => setExpressDeliveryType('home')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              expressDeliveryType === 'home'
                                ? 'border-blue-700 bg-blue-600 text-white shadow-xs'
                                : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">Livraison à Domicile</span>
                              <Truck className="w-4 h-4" />
                            </div>
                            <p
                              className={`mt-1 font-mono text-xs font-semibold ${
                                expressDeliveryType === 'home' ? 'text-blue-100' : 'text-slate-600'
                              }`}
                            >
                              {selectedBundle === 3
                                ? 'OFFERTE (0 DZD)'
                                : formatDzd(liveShippingInfo.homePriceDzd)}
                            </p>
                          </button>

                          <button
                            type="button"
                            onClick={() => setExpressDeliveryType('stop_desk')}
                            className={`p-3 rounded-xl border text-left transition-all ${
                              expressDeliveryType === 'stop_desk'
                                ? 'border-blue-700 bg-blue-600 text-white shadow-xs'
                                : 'border-slate-300 bg-white text-slate-800 hover:border-slate-400'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-bold">Bureau Stop Desk</span>
                              <Landmark className="w-4 h-4" />
                            </div>
                            <p
                              className={`mt-1 font-mono text-xs font-semibold ${
                                expressDeliveryType === 'stop_desk' ? 'text-blue-100' : 'text-slate-600'
                              }`}
                            >
                              {selectedBundle === 3
                                ? 'OFFERTE (0 DZD)'
                                : formatDzd(liveShippingInfo.stopDeskPriceDzd)}
                            </p>
                          </button>
                        </div>

                        {activeCarriers.length > 1 && (
                          <div>
                            <label className="block text-[11px] font-bold text-slate-700 mb-1">
                              Société de livraison (Yalidine / ZR Express / Maystro)
                            </label>
                            <select
                              value={expressCarrierId || activeCarriers[0]?.id || ''}
                              onChange={(e) => setExpressCarrierId(Number(e.target.value))}
                              className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold text-slate-800"
                            >
                              {activeCarriers.map((c) => (
                                <option key={c.id} value={c.id}>
                                  {c.name} ({liveShippingInfo.estimatedDays})
                                </option>
                              ))}
                            </select>
                          </div>
                        )}
                      </>
                    )}

                    {/* Cross-Sell / Frequently Bought Together in the same COD Parcel (Shopify / YouCan / BigCommerce) */}
                    {saasConfig.crossSellBundlesEnabled && crossSellCandidates.length > 0 && (
                      <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-amber-950">
                            Complétez votre colis (-5% + 0 DZD livraison supp.)
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-200 text-amber-950">
                            Même colis COD
                          </span>
                        </div>
                        <div className="space-y-1.5">
                          {crossSellCandidates.map((cp) => {
                            const checked = selectedCrossSellIds.includes(cp.id);
                            const discountedPrice = Math.round(cp.priceDzd * 0.95);
                            return (
                              <label
                                key={cp.id}
                                className={`flex items-center justify-between gap-2 p-2 rounded-lg border text-xs cursor-pointer transition-colors ${
                                  checked
                                    ? 'border-blue-600 bg-blue-50/80 text-slate-900'
                                    : 'border-amber-200/80 bg-white text-slate-700 hover:bg-amber-50/40'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <input
                                    type="checkbox"
                                    checked={checked}
                                    onChange={() => toggleCrossSell(cp.id)}
                                    className="h-4 w-4 rounded border-slate-300 text-blue-700 shrink-0"
                                  />
                                  <span className="font-semibold truncate">{cp.name}</span>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0 font-mono">
                                  <span className="text-[11px] text-slate-400 line-through">
                                    {formatDzd(cp.priceDzd)}
                                  </span>
                                  <span className="font-bold text-emerald-700">
                                    +{formatDzd(discountedPrice)}
                                  </span>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* 100% COD Guarantee Banner */}
                    <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center gap-2 text-xs text-emerald-950">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-semibold">
                        Paiement 100% à la livraison (Espèces / COD) après réception de votre commande.
                      </span>
                    </div>

                    {/* Live Cost Summary Breakdown */}
                    <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-1.5 text-xs">
                      <div className="flex items-center justify-between text-slate-600">
                        <span>
                          Article principal ({quantity} unité{quantity > 1 ? 's' : ''})
                        </span>
                        <span className="font-mono font-semibold">{formatDzd(bundlePricing.mainSubtotalDzd)}</span>
                      </div>
                      {selectedCrossSellProducts.length > 0 && (
                        <div className="flex items-center justify-between text-emerald-700">
                          <span>
                            +{selectedCrossSellProducts.length} article(s) groupé(s) (-5%)
                          </span>
                          <span className="font-mono font-semibold">
                            +{formatDzd(bundlePricing.crossSellTotalDzd)}
                          </span>
                        </div>
                      )}
                      <div className="flex items-center justify-between text-slate-600">
                        <span>
                          Livraison ({selectedWilayaObj?.name || 'Wilaya'} ·{' '}
                          {expressDeliveryType === 'stop_desk' ? 'Stop Desk' : 'Domicile'})
                        </span>
                        <span className="font-mono font-semibold text-emerald-700">
                          {liveShippingInfo.feeDzd === 0 ? 'GRATUITE' : formatDzd(liveShippingInfo.feeDzd)}
                        </span>
                      </div>
                      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-sm font-bold text-slate-900">
                        <span>Total à payer à la livraison</span>
                        <span className="font-mono text-base text-blue-700">
                          {formatDzd(bundlePricing.totalDzd)}
                        </span>
                      </div>
                    </div>

                    {expressError && (
                      <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                        {expressError}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={expressSubmitting}
                      className="w-full py-3.5 px-5 rounded-xl bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-400 text-white text-sm font-bold shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4" />
                      <span>
                        {expressSubmitting
                          ? 'Validation de votre commande en cours...'
                          : `COMMANDER MAINTENANT — PAIEMENT À LA LIVRAISON (${formatDzd(bundlePricing.totalDzd)})`}
                      </span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {product.shortDescription && (
              <p className="text-sm text-slate-600 leading-relaxed">{product.shortDescription}</p>
            )}

            {/* Quantity & Secondary Cart / WhatsApp Actions */}
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
                  Passer par le panier multi-articles
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
                    <span>
                      Livraison rapide 58 wilayas (Yalidine, ZR Express, Maystro) — À domicile ou STOP DESK.
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>
                      Paiement 100% à la livraison (Cash on Delivery) après réception de votre commande.
                    </span>
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

      {/* Sticky Bottom Conversion Bar (YouCan / Shopify / WiziShop feature) */}
      {saasConfig.stickyCartBarEnabled && !outOfStock && (
        <div className="fixed bottom-0 inset-x-0 z-30 bg-white/95 backdrop-blur border-t border-slate-200 shadow-lg py-2.5 px-4">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-lg border border-slate-200 overflow-hidden shrink-0 hidden sm:block">
                <ProductImage src={mainImageUrl} alt={product.name} />
              </div>
              <div className="min-w-0">
                <p className="text-xs sm:text-sm font-bold text-slate-900 truncate">{product.name}</p>
                <p className="font-mono text-xs font-bold text-blue-700">
                  {formatDzd(bundlePricing.effectiveUnitDzd)}{' '}
                  {selectedBundle > 1 && (
                    <span className="text-emerald-700">· Pack {selectedBundle}x</span>
                  )}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  expressFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="px-4 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs sm:text-sm font-bold shadow-xs cursor-pointer"
              >
                Commander COD (58 Wilayas)
              </button>
              <button
                type="button"
                onClick={() => onAddToCart(product, quantity, selectedColor || undefined)}
                className="px-3.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold hidden sm:inline-flex items-center gap-1.5"
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>+ Panier</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
