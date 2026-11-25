import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  HelpCircle,
  Images,
  MessageCircle,
  Palette,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  Star,
  Truck,
  ZoomIn,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { initStoreAdPixels, trackAdPixelEvent } from '../../lib/pixels';
import { ALGERIA_WILAYAS, getCommunesByWilayaCode } from '../../shared/algeria';
import {
  buildWhatsAppOrderUrl,
  formatDzd,
  getSaasConfig,
  isValidAlgerianPhone,
  resolveEffectiveShippingQuote,
} from '../../shared/domain';
import { ProductColorOption, StoreBootstrap } from '../../types';
import { ImageZoomLightbox } from '../ImageZoomLightbox';
import { ProductImage } from '../ProductImage';

interface LandingPageViewProps {
  slug: string;
  bootstrap: StoreBootstrap;
  onTrackOrder: (reference: string) => void;
  onBackToStore: () => void;
}

export function LandingPageView({
  slug,
  bootstrap,
  onTrackOrder,
  onBackToStore,
}: LandingPageViewProps) {
  const [page, setPage] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Direct Express Order Form (COD 58 Wilayas)
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilayaCode, setWilayaCode] = useState('16');
  const [commune, setCommune] = useState('');
  const [customCommuneMode, setCustomCommuneMode] = useState(false);
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'home' | 'stop_desk'>('home');
  const [quantity, setQuantity] = useState(1);
  const [selectedColor, setSelectedColor] = useState<string>('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState<string | null>(null);
  const [createdOrder, setCreatedOrder] = useState<any | null>(null);
  const [upsellAdded, setUpsellAdded] = useState(false);
  const [upsellAdding, setUpsellAdding] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string>('');
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const saasConfig = getSaasConfig();

  const wilayaCommunes = useMemo(
    () => getCommunesByWilayaCode(wilayaCode),
    [wilayaCode],
  );

  useEffect(() => {
    if (saasConfig.communeDropdownEnabled && !customCommuneMode && wilayaCommunes.length > 0) {
      if (!commune || !wilayaCommunes.includes(commune)) {
        setCommune(wilayaCommunes[0]);
      }
    }
  }, [wilayaCode, wilayaCommunes, saasConfig.communeDropdownEnabled, customCommuneMode]);

  const availableColors: ProductColorOption[] = useMemo(() => {
    if (!page || !Array.isArray(page.colors)) return [];
    return page.colors.filter((c: any) => c && typeof c.name === 'string' && c.name.trim());
  }, [page]);

  const galleryList = useMemo(() => {
    if (!page) return [];
    const raw = Array.isArray(page.galleryImages) ? page.galleryImages : [];
    const colorImgs = availableColors.map((c) => c.imageUrl).filter(Boolean);
    return Array.from(new Set([page.heroImageUrl, ...raw, ...colorImgs].filter(Boolean)));
  }, [page, availableColors]);

  const activeImage = selectedImage || page?.heroImageUrl || galleryList[0] || '';

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedImage('');
    setSelectedColor('');
    initStoreAdPixels(saasConfig);
    apiFetch<{ landingPage: any }>(`/api/landing-pages/${encodeURIComponent(slug)}`)
      .then((res) => {
        if (!active) return;
        setPage(res.landingPage);
        const firstColor =
          Array.isArray(res.landingPage?.colors) && res.landingPage.colors.length > 0
            ? res.landingPage.colors[0].name
            : '';
        setSelectedColor(firstColor);
        if (res.landingPage) {
          trackAdPixelEvent(
            'ViewContent',
            {
              content_ids: [String(res.landingPage.productId || res.landingPage.id)],
              content_name: res.landingPage.productName,
              value: Number(res.landingPage.priceDzd) || 0,
              currency: 'DZD',
            },
            saasConfig,
          );
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err?.message || 'Cette page d’offre spéciale est introuvable.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [slug]);

  const handleSelectColor = (color: ProductColorOption) => {
    setSelectedColor(color.name);
    if (color.imageUrl) {
      setSelectedImage(color.imageUrl);
    }
  };

  const liveShippingQuote = useMemo(
    () =>
      resolveEffectiveShippingQuote({
        carriers: bootstrap.carriers || [],
        shippingRates: bootstrap.shippingRates || [],
        wilayaCode,
        deliveryType,
        shippingPricesEnabled: saasConfig.shippingPricesEnabled,
      }),
    [bootstrap.carriers, bootstrap.shippingRates, deliveryType, saasConfig.shippingPricesEnabled, wilayaCode],
  );

  useEffect(() => {
    if (liveShippingQuote.effectiveDeliveryType !== deliveryType) {
      setDeliveryType(liveShippingQuote.effectiveDeliveryType);
    }
  }, [deliveryType, liveShippingQuote.effectiveDeliveryType]);

  const shippingFeeDzd = liveShippingQuote.feeDzd;

  const unitPriceDzd = Number(page?.priceDzd) || 0;
  const subtotalDzd = unitPriceDzd * quantity;
  const totalDzd = subtotalDzd + shippingFeeDzd;

  // Real-time Abandoned COD Order auto-capture on Landing Page
  useEffect(() => {
    if (!saasConfig.abandonedOrdersCaptureEnabled || !page || createdOrder) return;
    if (!isValidAlgerianPhone(phone)) return;

    const timer = setTimeout(() => {
      apiFetch('/api/abandoned-orders/capture', {
        method: 'POST',
        body: JSON.stringify({
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          phone: phone.trim(),
          wilayaCode,
          commune: commune.trim(),
          address: address.trim(),
          deliveryType: liveShippingQuote.effectiveDeliveryType,
          productId: page.productId || null,
          productName: selectedColor
            ? `${page.productName} (Couleur : ${selectedColor})`
            : page.productName,
          quantity,
          totalDzd,
          source: 'landing_page',
        }),
      }).catch(() => {});
    }, 900);

    return () => clearTimeout(timer);
  }, [
    phone,
    firstName,
    lastName,
    wilayaCode,
    commune,
    address,
    quantity,
    selectedColor,
    totalDzd,
    page,
    createdOrder,
    saasConfig.abandonedOrdersCaptureEnabled,
  ]);

  const handleSubmitOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!page) return;
    setOrderError(null);

    if (!isValidAlgerianPhone(phone)) {
      setOrderError('Veuillez saisir un numéro de téléphone algérien valide (ex. 0550 12 34 56).');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        phone: phone.trim(),
        wilayaCode,
        commune: commune.trim(),
        address: address.trim() || commune.trim(),
        deliveryType: liveShippingQuote.effectiveDeliveryType,
        carrierId: liveShippingQuote.carrier?.id,
        shippingPricesEnabled: saasConfig.shippingPricesEnabled,
        antiSpamEnabled: saasConfig.antiSpamEnabled,
        antiSpamCooldownMinutes: saasConfig.antiSpamCooldownMinutes,
        googleSheetsWebhookUrl: saasConfig.googleSheetsSyncEnabled
          ? saasConfig.googleSheetsWebhookUrl
          : '',
        customerNotes:
          customerNotes.trim() ||
          `Commande via Landing Page : ${page.title}${selectedColor ? ` (Couleur : ${selectedColor})` : ''}`,
        landingPageId: page.id,
        items: [
          {
            productId: page.productId || null,
            customName: page.productName,
            customPriceDzd: unitPriceDzd,
            customSku: `LP-${page.id}`,
            quantity,
            selectedColor: selectedColor || undefined,
          },
        ],
      };

      const res = await apiFetch<{ order: any }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify(payload),
      });
      setCreatedOrder(res.order);
      setUpsellAdded(false);
      trackAdPixelEvent(
        'Purchase',
        {
          content_ids: [String(page.productId || page.id)],
          content_name: page.productName,
          value: res.order.totalDzd,
          currency: 'DZD',
          num_items: quantity,
        },
        saasConfig,
      );
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: any) {
      setOrderError(err?.message || 'Impossible d’enregistrer votre commande.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-5xl mx-auto px-4 py-24 text-center space-y-3">
        <div className="w-8 h-8 border-2 border-blue-700 border-t-transparent rounded-full animate-spin mx-auto" />
        <p className="text-sm text-slate-500">Chargement de l’offre spéciale...</p>
      </div>
    );
  }

  if (error || !page) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
        <p className="p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">
          {error || 'Landing page introuvable.'}
        </p>
        <button
          type="button"
          onClick={onBackToStore}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-xs font-semibold"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Retour à la boutique 2Frères Phone</span>
        </button>
      </div>
    );
  }

  const displayProductNameWithColor = selectedColor
    ? `${page.productName} (Couleur : ${selectedColor})`
    : page.productName;

  if (createdOrder) {
    const whatsappUrl = buildWhatsAppOrderUrl(bootstrap.settings.whatsappPhone, {
      storeName: bootstrap.settings.storeName,
      reference: createdOrder.reference,
      firstName: createdOrder.firstName,
      lastName: createdOrder.lastName,
      phone: createdOrder.phone,
      wilayaName: createdOrder.wilayaName,
      commune: createdOrder.commune,
      address: createdOrder.address,
      deliveryType: createdOrder.deliveryType,
      items: [{ name: displayProductNameWithColor, quantity, unitPriceDzd }],
      subtotalDzd: createdOrder.subtotalDzd,
      discountDzd: createdOrder.discountDzd,
      shippingFeeDzd: createdOrder.shippingFeeDzd,
      totalDzd: createdOrder.totalDzd,
    });

    const discountPct = Math.max(5, Math.min(60, Number(saasConfig.postPurchaseUpsellDiscountPct) || 20));
    const upsellUnitPrice = Math.max(200, Math.round(unitPriceDzd * (1 - discountPct / 100)));

    const handleAcceptUpsell = async () => {
      if (upsellAdding || upsellAdded) return;
      setUpsellAdding(true);
      try {
        const res = await apiFetch<{ order: any }>(
          `/api/orders/${encodeURIComponent(createdOrder.reference)}/upsell`,
          {
            method: 'POST',
            body: JSON.stringify({
              productId: page.productId || null,
              customName: `${page.productName} (2e unité -${discountPct}%)`,
              quantity: 1,
              discountPct,
              customPriceDzd: upsellUnitPrice,
            }),
          },
        );
        setCreatedOrder(res.order);
        setUpsellAdded(true);
      } catch {
        // ignore
      } finally {
        setUpsellAdding(false);
      }
    };

    return (
      <div className="max-w-2xl mx-auto px-4 py-12">
        <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center space-y-5 shadow-sm">
          <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-700">
              Commande Confirmée
            </span>
            <h1 className="font-display font-bold text-2xl text-slate-900">
              Merci {createdOrder.firstName} ! Votre commande est enregistrée
            </h1>
            <p className="text-sm text-slate-600">
              Référence de suivi :{' '}
              <span className="font-mono font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                {createdOrder.reference}
              </span>
            </p>
          </div>

          {saasConfig.postPurchaseUpsellEnabled && (
            <div className="p-4 rounded-xl border-2 border-amber-400 bg-amber-50/80 text-left space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[11px] font-bold">
                  <Gift className="w-3.5 h-3.5" />
                  OFFRE POST-ACHAT EN 1 CLIC (-{discountPct}% · 0 DZD LIVRAISON)
                </span>
              </div>
              {upsellAdded ? (
                <p className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  2e unité ajoutée à votre colis avec -{discountPct}% de remise (Paiement à la livraison) !
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-slate-900">
                      Ajoutez une 2e unité de {page.productName} dans le même colis
                    </p>
                    <p className="text-xs text-slate-600 mt-0.5">
                      Seulement{' '}
                      <span className="font-mono font-bold text-emerald-700">
                        {formatDzd(upsellUnitPrice)}
                      </span>{' '}
                      au lieu de <span className="line-through">{formatDzd(unitPriceDzd)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={upsellAdding}
                    onClick={handleAcceptUpsell}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {upsellAdding ? 'Ajout...' : '+ Ajouter en 1 clic à ma commande'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-500">Offre commandée :</span>
              <span className="font-semibold text-slate-900">
                {displayProductNameWithColor} × {quantity}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Destination :</span>
              <span className="font-semibold text-slate-900">
                {createdOrder.wilayaName} — {createdOrder.commune}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Frais de livraison :</span>
              <span className="font-mono text-slate-800">{formatDzd(createdOrder.shippingFeeDzd)}</span>
            </div>
            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm">
              <span className="font-bold text-slate-900">Total à payer à la livraison :</span>
              <span className="font-mono font-bold text-blue-700">
                {formatDzd(createdOrder.totalDzd)}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3 justify-center pt-2">
            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Confirmer rapidement par WhatsApp</span>
            </a>
            <button
              type="button"
              onClick={() => onTrackOrder(createdOrder.reference)}
              className="inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold"
            >
              <span>Suivre ma commande</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  const discountPercent =
    page.compareAtPriceDzd && page.compareAtPriceDzd > page.priceDzd
      ? Math.round(((page.compareAtPriceDzd - page.priceDzd) / page.compareAtPriceDzd) * 100)
      : null;

  const benefitsList = Array.isArray(page.benefits) ? page.benefits : [];

  return (
    <div className="bg-slate-50 pb-16">
      {/* Top Urgency Bar */}
      <div
        className="text-white text-center py-2.5 px-4 text-xs font-semibold"
        style={{ backgroundColor: page.accentColor || '#1d4ed8' }}
      >
        <span>{page.urgencyText || 'Offre spéciale en stock limité · Livraison rapide 58 Wilayas'}</span>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-12">
        {/* Hero + Express COD Order Form */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: Product Visuals & Headline */}
          <div className="lg:col-span-7 space-y-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-100 text-blue-900 text-xs font-bold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>{page.heroBadge}</span>
              </span>
              <h1 className="font-display font-bold text-2xl sm:text-4xl text-slate-900 leading-tight">
                {page.headline}
              </h1>
              <p className="text-sm sm:text-base text-slate-600 leading-relaxed">
                {page.subheadline}
              </p>
            </div>

            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
              <div className="aspect-[4/3] w-full bg-white relative group">
                <button
                  type="button"
                  onClick={() => (activeImage || page.heroImageUrl) && setLightboxOpen(true)}
                  aria-label={`Agrandir la photo de ${page.productName}`}
                  className="w-full h-full block cursor-zoom-in focus:outline-none"
                >
                  <ProductImage
                    src={activeImage || page.heroImageUrl}
                    alt={page.productName}
                    className="w-full h-full object-contain bg-white transition-transform duration-300 group-hover:scale-[1.02]"
                  />
                </button>
                {discountPercent && (
                  <span className="absolute top-4 left-4 px-3 py-1 rounded-lg bg-red-600 text-white font-mono text-xs font-bold shadow pointer-events-none">
                    -{discountPercent}% PROMO
                  </span>
                )}
                {(activeImage || page.heroImageUrl) && (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Cliquer pour agrandir l'image"
                    className="absolute bottom-3 left-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-900/80 hover:bg-blue-700 text-white text-xs font-semibold backdrop-blur-xs shadow-md transition-colors"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Agrandir l’image</span>
                  </button>
                )}
                {galleryList.length > 1 && (
                  <span className="absolute bottom-3 right-3 px-2.5 py-1 rounded-lg bg-slate-900/80 text-white text-[11px] font-semibold backdrop-blur-sm pointer-events-none">
                    {galleryList.indexOf(activeImage) + 1 || 1} / {galleryList.length} photos
                  </span>
                )}
              </div>

              {galleryList.length > 1 && (
                <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2.5 overflow-x-auto">
                  {galleryList.map((imgUrl: string, idx: number) => (
                    <button
                      key={`${imgUrl}-${idx}`}
                      type="button"
                      onClick={() => setSelectedImage(imgUrl)}
                      className={`w-16 h-16 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                        (activeImage || page.heroImageUrl) === imgUrl
                          ? 'border-blue-600 ring-2 ring-blue-600/20'
                          : 'border-slate-200 opacity-75 hover:opacity-100'
                      }`}
                    >
                      <ProductImage src={imgUrl} alt={`${page.productName} ${idx + 1}`} />
                    </button>
                  ))}
                </div>
              )}

              {/* Available Colors Bar inside Hero Card */}
              {availableColors.length > 0 && (
                <div className="px-5 py-3.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-slate-800">
                    <Palette className="w-4 h-4 text-blue-700" />
                    <span>Couleurs disponibles :</span>
                    {selectedColor && (
                      <span className="text-blue-700 font-semibold">{selectedColor}</span>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {availableColors.map((c) => {
                      const active = selectedColor === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => handleSelectColor(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            active
                              ? 'border-blue-700 bg-blue-50 text-blue-950 ring-2 ring-blue-600/15'
                              : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span
                            className="w-3.5 h-3.5 rounded-full border border-slate-300 shrink-0"
                            style={{ backgroundColor: c.hex || '#0f172a' }}
                          />
                          <span>{c.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="p-5 flex flex-wrap items-center justify-between gap-4 bg-slate-900 text-white">
                <div>
                  <p className="text-xs text-slate-400">Prix de l’offre spéciale</p>
                  <div className="flex items-baseline gap-2.5 mt-0.5">
                    <span className="font-mono font-bold text-2xl text-white tabular-nums">
                      {formatDzd(page.priceDzd)}
                    </span>
                    {page.compareAtPriceDzd && (
                      <span className="font-mono text-sm text-slate-400 line-through tabular-nums">
                        {formatDzd(page.compareAtPriceDzd)}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-300">
                  <span className="inline-flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-emerald-400" />
                    <span>58 Wilayas</span>
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-blue-400" />
                    <span>Paiement à la livraison</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Key Benefits */}
            {benefitsList.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {benefitsList.map((b: any, idx: number) => (
                  <div
                    key={idx}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex items-start gap-3"
                  >
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                    <div>
                      <h3 className="font-display font-bold text-sm text-slate-900">{b.title}</h3>
                      <p className="text-xs text-slate-600 mt-1 leading-relaxed">{b.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Direct 1-Step Order Form (COD) */}
          <div className="lg:col-span-5 lg:sticky lg:top-20">
            <form
              onSubmit={handleSubmitOrder}
              id="order-form-cod"
              className="bg-white border-2 border-blue-700 rounded-2xl p-5 sm:p-6 space-y-4 shadow-lg"
            >
              <div className="border-b border-slate-100 pb-3">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                  Commande Directe · Paiement à la livraison
                </span>
                <h2 className="font-display font-bold text-lg text-slate-900 mt-0.5">
                  Remplissez vos coordonnées pour commander
                </h2>
              </div>

              {orderError && (
                <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700">
                  {orderError}
                </div>
              )}

              {/* Color selector directly inside the COD Order Form */}
              {availableColors.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                  <label className="block text-xs font-bold text-slate-800">
                    Choisissez votre couleur * :{' '}
                    <span className="text-blue-700">{selectedColor}</span>
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {availableColors.map((c) => {
                      const active = selectedColor === c.name;
                      return (
                        <button
                          key={c.name}
                          type="button"
                          onClick={() => handleSelectColor(c)}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prénom *</label>
                  <input
                    required
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Votre prénom"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom *</label>
                  <input
                    required
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Votre nom"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Numéro de téléphone (05 / 06 / 07) *
                </label>
                <input
                  required
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="0550 12 34 56"
                  className="w-full px-3 py-2 text-sm font-mono rounded-lg border border-slate-300"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Wilaya (58 Wilayas) *
                  </label>
                  <select
                    value={wilayaCode}
                    onChange={(e) => setWilayaCode(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {ALGERIA_WILAYAS.map((w) => (
                      <option key={w.code} value={w.code}>
                        {w.code} - {w.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-xs font-semibold text-slate-700">
                      Commune *
                    </label>
                    {saasConfig.communeDropdownEnabled && wilayaCommunes.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setCustomCommuneMode((m) => !m);
                          if (!customCommuneMode) setCommune('');
                          else setCommune(wilayaCommunes[0] || '');
                        }}
                        className="text-[11px] font-semibold text-blue-700 hover:underline"
                      >
                        {customCommuneMode ? 'Liste' : 'Autre'}
                      </button>
                    )}
                  </div>
                  {saasConfig.communeDropdownEnabled && !customCommuneMode && wilayaCommunes.length > 0 ? (
                    <select
                      required
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      {wilayaCommunes.map((cName) => (
                        <option key={cName} value={cName}>
                          {cName}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      required
                      value={commune}
                      onChange={(e) => setCommune(e.target.value)}
                      placeholder="Ex. Bab Ezzouar"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                    />
                  )}
                </div>
              </div>

              {saasConfig.formShowAddressField && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Adresse de livraison *
                  </label>
                  <input
                    required
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Quartier, rue ou bureau Stop Desk"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                </div>
              )}

              {/* Delivery Mode & Quantity */}
              {(liveShippingQuote.supportsHome || liveShippingQuote.supportsStopDesk) && (
                <div
                  className={`grid gap-2 pt-1 ${
                    liveShippingQuote.supportsHome && liveShippingQuote.supportsStopDesk
                      ? 'grid-cols-2'
                      : 'grid-cols-1'
                  }`}
                >
                  {liveShippingQuote.supportsHome && (
                    <button
                      type="button"
                      onClick={() => setDeliveryType('home')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        liveShippingQuote.effectiveDeliveryType === 'home'
                          ? 'border-blue-700 bg-blue-50/70 font-semibold text-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="block">À domicile</span>
                      <span className="font-mono font-bold text-blue-700">
                        {!liveShippingQuote.pricesActive
                          ? "Tarif confirmé à l'appel"
                          : formatDzd(liveShippingQuote.homePriceDzd)}
                      </span>
                    </button>
                  )}
                  {liveShippingQuote.supportsStopDesk && (
                    <button
                      type="button"
                      onClick={() => setDeliveryType('stop_desk')}
                      className={`p-2.5 rounded-xl border text-left text-xs transition-colors ${
                        liveShippingQuote.effectiveDeliveryType === 'stop_desk'
                          ? 'border-blue-700 bg-blue-50/70 font-semibold text-slate-900'
                          : 'border-slate-200 text-slate-600'
                      }`}
                    >
                      <span className="block">Stop Desk (Bureau)</span>
                      <span className="font-mono font-bold text-blue-700">
                        {!liveShippingQuote.pricesActive
                          ? "Tarif confirmé à l'appel"
                          : formatDzd(liveShippingQuote.stopDeskPriceDzd)}
                      </span>
                    </button>
                  )}
                </div>
              )}

              <div className="flex items-center justify-between pt-1">
                <span className="text-xs font-semibold text-slate-700">Quantité :</span>
                <div className="inline-flex items-center border border-slate-300 rounded-lg overflow-hidden">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="px-3 py-1 text-sm font-bold bg-slate-50 hover:bg-slate-100"
                  >
                    -
                  </button>
                  <span className="px-4 py-1 font-mono text-sm font-bold tabular-nums">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => q + 1)}
                    className="px-3 py-1 text-sm font-bold bg-slate-50 hover:bg-slate-100"
                  >
                    +
                  </button>
                </div>
              </div>

              {/* Order Summary Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5 text-xs">
                <div className="flex justify-between text-slate-600">
                  <span>
                    {displayProductNameWithColor} × {quantity}
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {formatDzd(subtotalDzd)}
                  </span>
                </div>
                <div className="flex justify-between text-slate-600">
                  <span>
                    Livraison ({liveShippingQuote.effectiveDeliveryType === 'stop_desk' ? 'Stop Desk' : 'À domicile'})
                  </span>
                  <span className="font-mono font-semibold text-slate-900">
                    {!liveShippingQuote.pricesActive
                      ? "Confirmée à l'appel"
                      : formatDzd(shippingFeeDzd)}
                  </span>
                </div>
                <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-bold text-slate-900">
                  <span>Total à payer à la livraison</span>
                  <span className="font-mono text-blue-700">{formatDzd(totalDzd)}</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3.5 px-5 rounded-xl text-white font-display font-bold text-sm shadow-md transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
                style={{ backgroundColor: page.accentColor || '#1d4ed8' }}
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {submitting
                    ? 'Validation de votre commande...'
                    : page.ctaText || 'Commander maintenant — Paiement à la livraison'}
                </span>
              </button>
            </form>
          </div>
        </div>

        {/* Full Multi-Image Visual Showcase Section (when multiple images exist) */}
        {galleryList.length > 1 && (
          <section className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-blue-700">
                  <Images className="w-4 h-4" />
                  <span>Présentation Visuelle Complète ({galleryList.length} visuels)</span>
                </span>
                <h2 className="font-display font-bold text-xl sm:text-2xl text-slate-900 mt-0.5">
                  Découvrez {page.productName} sous tous les angles
                </h2>
              </div>
              <a
                href="#order-form-cod"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-white text-xs font-semibold shadow-sm"
                style={{ backgroundColor: page.accentColor || '#1d4ed8' }}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>Commander ({formatDzd(page.priceDzd)})</span>
              </a>
            </div>

            {/* Alternating Feature + Studio Photo Blocks */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {galleryList.map((imgUrl: string, idx: number) => {
                const pairedBenefit = benefitsList[idx % Math.max(1, benefitsList.length)];
                return (
                  <div
                    key={`showcase-${idx}`}
                    onClick={() => {
                      setSelectedImage(imgUrl);
                      window.scrollTo({ top: 0, behavior: 'smooth' });
                    }}
                    className="group cursor-pointer rounded-2xl border border-slate-200 overflow-hidden bg-slate-50 hover:border-blue-400 transition-all flex flex-col"
                  >
                    <div className="aspect-[4/3] w-full bg-white relative overflow-hidden">
                      <ProductImage
                        src={imgUrl}
                        alt={`${page.productName} - Vue ${idx + 1}`}
                      />
                      <span className="absolute top-3 left-3 px-2.5 py-1 rounded-md bg-slate-900/75 text-white text-[11px] font-bold">
                        Vue Studio #{idx + 1}
                      </span>
                    </div>
                    {pairedBenefit && (
                      <div className="p-4 bg-white border-t border-slate-100 flex items-start gap-3">
                        <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <h3 className="font-display font-bold text-sm text-slate-900">
                            {pairedBenefit.title}
                          </h3>
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                            {pairedBenefit.description}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Specifications & Customer Testimonials */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {Array.isArray(page.specs) && page.specs.length > 0 && (
            <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900">
                Caractéristiques de l’offre
              </h3>
              <dl className="divide-y divide-slate-100 text-xs">
                {availableColors.length > 0 && (
                  <div className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500 font-medium">Couleurs disponibles</dt>
                    <dd className="text-slate-900 font-semibold text-right">
                      {availableColors.map((c) => c.name).join(', ')}
                    </dd>
                  </div>
                )}
                {page.specs.map((s: any, idx: number) => (
                  <div key={idx} className="py-2.5 flex justify-between gap-4">
                    <dt className="text-slate-500 font-medium">{s.label}</dt>
                    <dd className="text-slate-900 font-semibold text-right">{s.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {Array.isArray(page.testimonials) && page.testimonials.length > 0 && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <h3 className="font-display font-bold text-base text-slate-900">
                Avis de nos clients en Algérie
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {page.testimonials.map((t: any, idx: number) => (
                  <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-slate-900">
                        {t.name} · <span className="text-slate-500 font-normal">{t.wilaya}</span>
                      </span>
                      <div className="flex items-center text-amber-500">
                        {Array.from({ length: Number(t.rating) || 5 }).map((_, i) => (
                          <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">« {t.comment} »</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* FAQ Section */}
        {Array.isArray(page.faq) && page.faq.length > 0 && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-blue-700" />
              <h3 className="font-display font-bold text-base text-slate-900">
                Questions fréquentes
              </h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {page.faq.map((f: any, idx: number) => (
                <div key={idx} className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                  <p className="font-bold text-xs text-slate-900">{f.question}</p>
                  <p className="text-xs text-slate-600 leading-relaxed">{f.answer}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {lightboxOpen && (activeImage || page.heroImageUrl) && (
        <ImageZoomLightbox
          images={
            galleryList.length > 0
              ? galleryList.map((u: string, i: number) => ({
                  url: u,
                  alt: `${page.productName} ${i + 1}`,
                }))
              : [{ url: activeImage || page.heroImageUrl, alt: page.productName }]
          }
          initialIndex={
            galleryList.length > 0
              ? Math.max(0, galleryList.indexOf(activeImage || page.heroImageUrl))
              : 0
          }
          title={page.productName}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}
