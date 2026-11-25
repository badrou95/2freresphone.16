import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Copy, MessageCircle, ShieldCheck, Tag, Truck } from 'lucide-react';
import { useCart } from '../../context/CartContext';
import { apiFetch } from '../../lib/api';
import { initStoreAdPixels, trackAdPixelEvent } from '../../lib/pixels';
import { getCommunesByWilayaCode } from '../../shared/algeria';
import { StoreBootstrap } from '../../types';
import {
  buildWhatsAppOrderUrl,
  formatDzd,
  getSaasConfig,
  isValidAlgerianPhone,
  resolveEffectiveShippingQuote,
} from '../../shared/domain';
import { ProductImage } from '../ProductImage';

interface CheckoutViewProps {
  bootstrap: StoreBootstrap;
  onTrackOrder: (reference: string) => void;
  onContinueShopping: () => void;
}

interface QuoteResult {
  subtotalDzd: number;
  discountDzd: number;
  shippingFeeDzd: number;
  totalDzd: number;
  hasPhysical: boolean;
  hasDigital: boolean;
  carrierId: number | null;
  carrierName: string | null;
  estimatedDays: string | null;
  promoFeedback: { applied: boolean; code?: string; message: string } | null;
}

export function CheckoutView({ bootstrap, onTrackOrder, onContinueShopping }: CheckoutViewProps) {
  const { items, subtotalDzd, hasPhysical, hasDigital, clearCart } = useCart();

  const [lastName, setLastName] = useState('');
  const [firstName, setFirstName] = useState('');
  const [phone, setPhone] = useState('');
  const [wilayaCode, setWilayaCode] = useState('16');
  const [commune, setCommune] = useState('');
  const [customCommuneMode, setCustomCommuneMode] = useState(false);
  const [address, setAddress] = useState('');
  const [deliveryType, setDeliveryType] = useState<'home' | 'stop_desk'>('home');
  const [carrierId, setCarrierId] = useState<number | ''>(bootstrap.carriers[0]?.id ?? '');
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState('');
  const [customerNotes, setCustomerNotes] = useState('');

  const [quote, setQuote] = useState<QuoteResult | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<any | null>(null);
  const [copiedRef, setCopiedRef] = useState(false);
  const [upsellAdding, setUpsellAdding] = useState(false);
  const [upsellAddedMessage, setUpsellAddedMessage] = useState<string | null>(null);

  const [saasConfig, setSaasConfig] = useState(() => getSaasConfig());

  useEffect(() => {
    const onCfg = () => setSaasConfig(getSaasConfig());
    window.addEventListener('2fp-saas-config-change', onCfg);
    return () => window.removeEventListener('2fp-saas-config-change', onCfg);
  }, []);

  useEffect(() => {
    initStoreAdPixels(saasConfig);
    if (items.length > 0) {
      trackAdPixelEvent(
        'InitiateCheckout',
        {
          content_id: items.map((i) => String(i.productId)).join(','),
          content_name: items.map((i) => i.name).join(' + '),
          value: subtotalDzd,
          currency: 'DZD',
          quantity: items.reduce((a, i) => a + i.quantity, 0),
        },
        saasConfig,
      );
    }
  }, [items, saasConfig, subtotalDzd]);

  const wilayaCommunes = useMemo(() => getCommunesByWilayaCode(wilayaCode), [wilayaCode]);

  useEffect(() => {
    if (saasConfig.communeDropdownEnabled && wilayaCommunes.length > 0 && !customCommuneMode) {
      if (!commune || !wilayaCommunes.includes(commune)) {
        setCommune(wilayaCommunes[0]);
      }
    }
  }, [commune, customCommuneMode, saasConfig.communeDropdownEnabled, wilayaCommunes]);

  // Real-time Abandoned COD Order Auto-Capture (2FP AbandonGuard)
  useEffect(() => {
    if (!saasConfig.abandonedOrdersCaptureEnabled || items.length === 0 || confirmedOrder) return;
    if (!isValidAlgerianPhone(phone)) return;

    const timer = setTimeout(() => {
      const firstItem = items[0];
      apiFetch('/api/abandoned-orders/capture', {
        method: 'POST',
        body: JSON.stringify({
          fullName: `${firstName} ${lastName}`.trim(),
          phone,
          wilayaCode,
          commune,
          address,
          deliveryType,
          productId: firstItem?.productId || null,
          productName: items.map((i) => `${i.name} x${i.quantity}`).join(' + '),
          productPriceDzd: subtotalDzd,
          quantity: items.reduce((acc, i) => acc + i.quantity, 0),
          selectedColor: firstItem?.selectedColor || '',
          sourcePage: 'checkout',
        }),
      }).catch(() => {
        // silent background capture
      });
    }, 900);

    return () => clearTimeout(timer);
  }, [
    address,
    commune,
    confirmedOrder,
    deliveryType,
    firstName,
    items,
    lastName,
    phone,
    saasConfig.abandonedOrdersCaptureEnabled,
    subtotalDzd,
    wilayaCode,
  ]);

  const localCarrierQuote = resolveEffectiveShippingQuote({
    carriers: bootstrap.carriers,
    shippingRates: bootstrap.shippingRates,
    wilayaCode,
    deliveryType,
    requestedCarrierId: carrierId || null,
    shippingPricesEnabled: saasConfig.shippingPricesEnabled,
  });

  useEffect(() => {
    if (hasPhysical && localCarrierQuote.effectiveDeliveryType !== deliveryType) {
      setDeliveryType(localCarrierQuote.effectiveDeliveryType);
    }
  }, [deliveryType, hasPhysical, localCarrierQuote.effectiveDeliveryType]);

  useEffect(() => {
    if (items.length === 0) {
      setQuote(null);
      return;
    }
    let active = true;
    setQuoteError(null);
    apiFetch<QuoteResult>('/api/checkout/calculate', {
      method: 'POST',
      body: JSON.stringify({
        items: items.map((i) => ({ productId: i.productId, quantity: i.quantity })),
        wilayaCode,
        deliveryType: hasPhysical ? localCarrierQuote.effectiveDeliveryType : 'digital',
        carrierId: carrierId || undefined,
        promoCode: appliedPromo || undefined,
        shippingPricesEnabled: saasConfig.shippingPricesEnabled,
      }),
    })
      .then((res) => {
        if (active) setQuote(res);
      })
      .catch((err) => {
        if (active) setQuoteError(err.message);
      });
    return () => {
      active = false;
    };
  }, [
    items,
    wilayaCode,
    localCarrierQuote.effectiveDeliveryType,
    carrierId,
    appliedPromo,
    hasPhysical,
    saasConfig.shippingPricesEnabled,
  ]);

  const selectedWilayaName =
    bootstrap.wilayas.find((w) => w.code === wilayaCode)?.name || 'Alger';

  const handlePlaceOrder = async (source: 'web' | 'whatsapp', e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setSubmitError(null);
    setSubmitting(true);
    try {
      const effectiveAddress =
        address.trim() ||
        (localCarrierQuote.effectiveDeliveryType === 'stop_desk'
          ? `Bureau Stop Desk (${commune || selectedWilayaName})`
          : `${commune || 'Centre'}, ${selectedWilayaName}`);

      const res = await apiFetch<{ order: any; items: any[] }>('/api/orders', {
        method: 'POST',
        body: JSON.stringify({
          firstName,
          lastName: lastName.trim() || firstName.trim() || 'Algérie',
          phone,
          wilayaCode,
          commune: commune || selectedWilayaName,
          address: effectiveAddress,
          deliveryType: hasPhysical ? localCarrierQuote.effectiveDeliveryType : 'digital',
          carrierId: carrierId || undefined,
          promoCode: appliedPromo || undefined,
          shippingPricesEnabled: saasConfig.shippingPricesEnabled,
          antiSpamEnabled: saasConfig.antiSpamEnabled,
          antiSpamCooldownMinutes: saasConfig.antiSpamCooldownMinutes,
          googleSheetsWebhookUrl:
            saasConfig.googleSheetsSyncEnabled && saasConfig.googleSheetsWebhookUrl
              ? saasConfig.googleSheetsWebhookUrl
              : undefined,
          customerNotes,
          source,
          items: items.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            selectedColor: i.selectedColor || undefined,
          })),
        }),
      });
      setConfirmedOrder({ ...res.order, orderedItems: res.items });
      trackAdPixelEvent(
        'Purchase',
        {
          content_id: res.order?.reference,
          content_name: items.map((i) => i.name).join(' + '),
          value: res.order?.totalDzd || subtotalDzd,
          currency: 'DZD',
          quantity: items.reduce((a, i) => a + i.quantity, 0),
          order_reference: res.order?.reference,
        },
        saasConfig,
      );
      clearCart();
    } catch (err: any) {
      setSubmitError(err.message || 'Impossible de valider votre commande.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddPostPurchaseUpsell = async () => {
    if (!confirmedOrder) return;
    setUpsellAdding(true);
    setSubmitError(null);
    const discountPct = Math.min(50, Math.max(5, Number(saasConfig.postPurchaseUpsellDiscountPct) || 20));
    const upsellPrice = Math.round((2500 * (100 - discountPct)) / 100);
    const upsellName = 'Pack Protection 2FP (Câble Charge Rapide + Verre Trempé 9H)';
    try {
      const res = await apiFetch<{ order: any }>(
        `/api/orders/${encodeURIComponent(confirmedOrder.reference)}/upsell`,
        {
          method: 'POST',
          body: JSON.stringify({
            phone: confirmedOrder.phone,
            customName: upsellName,
            customPriceDzd: upsellPrice,
            quantity: 1,
          }),
        },
      );
      setConfirmedOrder((prev: any) => ({
        ...prev,
        ...res.order,
        orderedItems: [
          ...(prev.orderedItems || []),
          { name: `${upsellName} (Offre Post-Achat 1-Clic)`, quantity: 1, unitPriceDzd: upsellPrice },
        ],
      }));
      setUpsellAddedMessage(
        `${upsellName} (+${formatDzd(upsellPrice)}) ajouté à votre colis sans frais de port supplémentaires !`,
      );
    } catch (err: any) {
      setSubmitError(err?.message || 'Impossible d’ajouter cette offre.');
    } finally {
      setUpsellAdding(false);
    }
  };

  if (confirmedOrder) {
    const waConfirmUrl = buildWhatsAppOrderUrl(bootstrap.settings.whatsappPhone, {
      storeName: bootstrap.settings.storeName,
      reference: confirmedOrder.reference,
      firstName: confirmedOrder.firstName,
      lastName: confirmedOrder.lastName,
      phone: confirmedOrder.phone,
      wilayaName: confirmedOrder.wilayaName,
      commune: confirmedOrder.commune,
      address: confirmedOrder.address,
      deliveryType: confirmedOrder.deliveryType,
      items: (confirmedOrder.orderedItems || []).map((i: any) => ({
        name: i.name || i.productName,
        quantity: i.quantity,
        unitPriceDzd: i.unitPriceDzd,
      })),
      subtotalDzd: confirmedOrder.subtotalDzd,
      discountDzd: confirmedOrder.discountDzd,
      shippingFeeDzd: confirmedOrder.shippingFeeDzd,
      totalDzd: confirmedOrder.totalDzd,
    });
    const discountPct = Math.min(50, Math.max(5, Number(saasConfig.postPurchaseUpsellDiscountPct) || 20));
    const upsellPrice = Math.round((2500 * (100 - discountPct)) / 100);

    return (
      <div className="max-w-2xl mx-auto px-4 py-14">
        <div className="bg-white border border-slate-200 rounded-xl p-8 space-y-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <h1 className="font-display font-bold text-2xl text-slate-900">
                Commande enregistrée avec succès
              </h1>
              <p className="text-sm text-slate-600 mt-1">
                Merci {confirmedOrder.firstName}. Conservez votre référence pour suivre l’avancement de votre commande ou laisser un avis vérifié.
              </p>
            </div>
          </div>

          <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-500">Référence de commande</p>
              <p className="font-mono font-bold text-xl text-slate-900 tracking-wide">
                {confirmedOrder.reference}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(confirmedOrder.reference);
                setCopiedRef(true);
                setTimeout(() => setCopiedRef(false), 2000);
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-100"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedRef ? 'Copiée' : 'Copier'}</span>
            </button>
          </div>

          {/* 1-Click Post-Purchase Upsell Offer (2FP PostUpsell) */}
          {saasConfig.postPurchaseUpsellEnabled && (
            <div className="p-4 rounded-xl bg-amber-50 border-2 border-amber-400 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="px-2 py-0.5 rounded bg-red-600 text-white text-[10px] font-bold">
                  OFFRE POST-ACHAT EN 1 CLIC (-{discountPct}% + 0 DZD LIVRAISON)
                </span>
                <span className="text-xs font-bold text-amber-950">Même colis COD</span>
              </div>
              {upsellAddedMessage ? (
                <p className="text-xs font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 rounded-lg p-2.5">
                  ✓ {upsellAddedMessage}
                </p>
              ) : (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-bold text-slate-900">
                      Pack Protection 2FP (Câble Charge Rapide + Verre Trempé 9H)
                    </p>
                    <p className="text-xs font-mono mt-0.5">
                      <span className="line-through text-slate-400 mr-1.5">{formatDzd(2500)}</span>
                      <span className="font-bold text-emerald-700">+{formatDzd(upsellPrice)}</span>
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={upsellAdding}
                    onClick={handleAddPostPurchaseUpsell}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-bold"
                  >
                    {upsellAdding ? 'Ajout...' : '+ Ajouter en 1 clic à mon colis'}
                  </button>
                </div>
              )}
            </div>
          )}

          <div className="space-y-2 text-sm border-t border-slate-100 pt-4">
            <div className="flex justify-between">
              <span className="text-slate-600">Articles</span>
              <span className="font-mono tabular-nums">{formatDzd(confirmedOrder.subtotalDzd)}</span>
            </div>
            {confirmedOrder.discountDzd > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Remise ({confirmedOrder.promoCode})</span>
                <span className="font-mono tabular-nums">-{formatDzd(confirmedOrder.discountDzd)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-slate-600">
                Livraison ({confirmedOrder.wilayaName} ·{' '}
                {confirmedOrder.deliveryType === 'stop_desk'
                  ? 'STOP DESK'
                  : confirmedOrder.deliveryType === 'digital'
                  ? 'Numérique'
                  : 'À domicile'}
                )
              </span>
              <span className="font-mono tabular-nums">{formatDzd(confirmedOrder.shippingFeeDzd)}</span>
            </div>
            <div className="flex justify-between font-semibold text-base text-slate-900 pt-2 border-t border-slate-200">
              <span>Total à payer</span>
              <span className="font-mono tabular-nums">{formatDzd(confirmedOrder.totalDzd)}</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              type="button"
              onClick={() => onTrackOrder(confirmedOrder.reference)}
              className="py-3 px-4 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold transition-colors"
            >
              Suivre ma commande
            </button>
            <a
              href={waConfirmUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 py-3 px-4 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Confirmer sur WhatsApp</span>
            </a>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16 text-center space-y-4">
        <h1 className="font-display font-bold text-2xl text-slate-900">Votre panier est vide</h1>
        <p className="text-sm text-slate-600">
          Sélectionnez un ou plusieurs articles dans le catalogue pour passer commande sans créer de compte.
        </p>
        <button
          type="button"
          onClick={onContinueShopping}
          className="px-5 py-2.5 rounded-lg bg-slate-900 text-white text-sm font-semibold hover:bg-slate-800"
        >
          Parcourir le catalogue
        </button>
      </div>
    );
  }

  const effectiveShipping = quote?.shippingFeeDzd ?? 0;
  const effectiveDiscount = quote?.discountDzd ?? 0;
  const effectiveTotal = quote?.totalDzd ?? subtotalDzd;

  const whatsappPreviewUrl = buildWhatsAppOrderUrl(bootstrap.settings.whatsappPhone, {
    storeName: bootstrap.settings.storeName,
    firstName: firstName || 'Client',
    lastName: lastName || '',
    phone: phone || 'Non renseigné',
    wilayaName: selectedWilayaName,
    commune: commune || 'Non renseignée',
    address: address || 'Non renseignée',
    deliveryType: hasPhysical ? deliveryType : 'digital',
    items: items.map((i) => ({ name: i.name, quantity: i.quantity, unitPriceDzd: i.priceDzd })),
    subtotalDzd,
    discountDzd: effectiveDiscount,
    shippingFeeDzd: effectiveShipping,
    totalDzd: effectiveTotal,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
      <div className="mb-8">
        <h1 className="font-display font-bold text-3xl text-slate-900 tracking-tight">
          Finaliser votre commande
        </h1>
        <p className="text-sm text-slate-600 mt-1">
          Commande directe sans inscription · Paiement à la livraison (DZD) pour les articles physiques.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <form
          onSubmit={(e) => handlePlaceOrder('web', e)}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-xl p-6 sm:p-8 space-y-6"
        >
          <div>
            <h2 className="font-display font-semibold text-lg text-slate-900">
              Coordonnées de livraison
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">Tous les champs marqués * sont obligatoires.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="chk-lastname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Nom *
              </label>
              <input
                id="chk-lastname"
                required
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Ex. Benali"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="chk-firstname" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Prénom *
              </label>
              <input
                id="chk-firstname"
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Ex. Karim"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="chk-phone" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Téléphone (Algérie) *
              </label>
              <input
                id="chk-phone"
                required
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="0550 12 34 56"
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 font-mono focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
            <div>
              <label htmlFor="chk-wilaya" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Wilaya (58 wilayas) *
              </label>
              <select
                id="chk-wilaya"
                required
                value={wilayaCode}
                onChange={(e) => setWilayaCode(e.target.value)}
                className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
              >
                {bootstrap.wilayas.map((w) => (
                  <option key={w.code} value={w.code}>
                    {w.code} — {w.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="chk-commune" className="block text-xs font-semibold text-slate-700">
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
                    {customCommuneMode ? 'Liste officielle' : 'Autre commune'}
                  </button>
                )}
              </div>
              {saasConfig.communeDropdownEnabled && !customCommuneMode && wilayaCommunes.length > 0 ? (
                <select
                  id="chk-commune"
                  required
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 bg-white focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {wilayaCommunes.map((cName) => (
                    <option key={cName} value={cName}>
                      {cName}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  id="chk-commune"
                  required
                  value={commune}
                  onChange={(e) => setCommune(e.target.value)}
                  placeholder="Ex. Bab Ezzouar"
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              )}
            </div>
            {saasConfig.formShowAddressField && (
              <div>
                <label htmlFor="chk-address" className="block text-xs font-semibold text-slate-700 mb-1.5">
                  Adresse complète *
                </label>
                <input
                  id="chk-address"
                  required
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Cité, rue, bâtiment..."
                  className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            )}
          </div>

          {hasPhysical ? (
            <div className="pt-4 border-t border-slate-100 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-semibold text-base text-slate-900">
                  Mode de livraison
                </h3>
                {quote?.estimatedDays && (
                  <span className="text-xs text-slate-500">Délai estimé : {quote.estimatedDays}</span>
                )}
              </div>

              {bootstrap.carriers.length > 1 && (
                <div>
                  <label htmlFor="chk-carrier" className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Transporteur
                  </label>
                  <select
                    id="chk-carrier"
                    value={carrierId}
                    onChange={(e) => setCarrierId(e.target.value ? Number(e.target.value) : '')}
                    className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    {bootstrap.carriers.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {(localCarrierQuote.supportsHome || localCarrierQuote.supportsStopDesk) && (
                <div
                  className={`grid grid-cols-1 gap-3 ${
                    localCarrierQuote.supportsHome && localCarrierQuote.supportsStopDesk
                      ? 'sm:grid-cols-2'
                      : ''
                  }`}
                >
                  {localCarrierQuote.supportsHome && (
                    <button
                      type="button"
                      onClick={() => setDeliveryType('home')}
                      className={`p-4 rounded-xl border text-left transition-colors ${
                        localCarrierQuote.effectiveDeliveryType === 'home'
                          ? 'border-blue-700 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">À domicile</span>
                        <Truck className="w-4 h-4 text-blue-700" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Livraison directe à votre adresse ({selectedWilayaName})
                      </p>
                    </button>
                  )}

                  {localCarrierQuote.supportsStopDesk && (
                    <button
                      type="button"
                      onClick={() => setDeliveryType('stop_desk')}
                      className={`p-4 rounded-xl border text-left transition-colors ${
                        localCarrierQuote.effectiveDeliveryType === 'stop_desk'
                          ? 'border-blue-700 bg-blue-50/50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold text-slate-900">STOP DESK</span>
                        <Truck className="w-4 h-4 text-slate-600" />
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Retrait au bureau transporteur de la wilaya
                      </p>
                    </button>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex items-start gap-3 text-sm text-slate-700">
              <ShieldCheck className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold text-slate-900">Commande 100 % numérique (0 DZD de livraison)</p>
                <p className="text-xs text-slate-600 mt-0.5">{bootstrap.settings.digitalOrderNote}</p>
              </div>
            </div>
          )}

          {hasDigital && hasPhysical && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-900">
              Votre panier contient des produits physiques (paiement à la livraison) et numériques (activés après validation).
            </div>
          )}

          {saasConfig.formShowNotesField && (
            <div>
              <label htmlFor="chk-notes" className="block text-xs font-semibold text-slate-700 mb-1.5">
                Remarque pour la commande (optionnel)
              </label>
              <textarea
                id="chk-notes"
                rows={2}
                value={customerNotes}
                onChange={(e) => setCustomerNotes(e.target.value)}
                placeholder="Modèle exact de téléphone, couleur souhaitée, créneau d'appel..."
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
          )}

          {(quoteError || submitError) && (
            <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
              {submitError || quoteError}
            </div>
          )}

          <div className="pt-2 space-y-3">
            <button
              type="submit"
              disabled={submitting}
              className={`w-full py-3.5 px-5 rounded-lg disabled:bg-slate-400 text-white text-sm font-semibold transition-colors ${
                saasConfig.formCtaColor === 'emerald'
                  ? 'bg-emerald-600 hover:bg-emerald-700'
                  : saasConfig.formCtaColor === 'red'
                  ? 'bg-red-600 hover:bg-red-700'
                  : saasConfig.formCtaColor === 'amber'
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : saasConfig.formCtaColor === 'slate'
                  ? 'bg-slate-900 hover:bg-slate-800'
                  : 'bg-blue-700 hover:bg-blue-800'
              }`}
            >
              {submitting
                ? 'Validation en cours...'
                : `${saasConfig.formCtaText || 'Confirmer la commande'} — ${formatDzd(effectiveTotal)}`}
            </button>

            <a
              href={whatsappPreviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full inline-flex items-center justify-center gap-2 py-3 px-5 rounded-lg border border-emerald-600 text-emerald-700 hover:bg-emerald-50 text-sm font-semibold transition-colors"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Commander directement par WhatsApp</span>
            </a>
          </div>
        </form>

        {/* Order Summary */}
        <aside className="lg:col-span-5 bg-white border border-slate-200 rounded-xl p-6 space-y-5 lg:sticky lg:top-24">
          <h2 className="font-display font-semibold text-lg text-slate-900">
            Récapitulatif de commande
          </h2>

          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {items.map((item) => (
              <div key={item.productId} className="py-3 flex items-center gap-3">
                <div className="w-14 h-14 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                  <ProductImage src={item.image} alt={item.name} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-900 truncate">{item.name}</p>
                  <p className="text-xs text-slate-500 tabular-nums">
                    Qté : {item.quantity} × {formatDzd(item.priceDzd)}
                  </p>
                </div>
                <span className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                  {formatDzd(item.priceDzd * item.quantity)}
                </span>
              </div>
            ))}
          </div>

          {/* Promo code */}
          <div className="pt-4 border-t border-slate-100">
            <label htmlFor="chk-promo" className="block text-xs font-semibold text-slate-700 mb-1.5">
              Code promotionnel
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="chk-promo"
                  value={promoCode}
                  onChange={(e) => setPromoCode(e.target.value)}
                  placeholder="Ex. BIENVENUE10"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300 font-mono uppercase"
                />
              </div>
              <button
                type="button"
                onClick={() => setAppliedPromo(promoCode.trim().toUpperCase())}
                className="px-4 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800 whitespace-nowrap"
              >
                Appliquer
              </button>
            </div>
            {quote?.promoFeedback && (
              <p
                className={`mt-1.5 text-xs ${
                  quote.promoFeedback.applied ? 'text-emerald-700' : 'text-red-600'
                }`}
              >
                {quote.promoFeedback.message}
              </p>
            )}
          </div>

          {/* Totals */}
          <div className="pt-4 border-t border-slate-200 space-y-2.5 text-sm">
            <div className="flex justify-between text-slate-600">
              <span>Montant des articles</span>
              <span className="font-mono tabular-nums">{formatDzd(subtotalDzd)}</span>
            </div>
            {effectiveDiscount > 0 && (
              <div className="flex justify-between text-emerald-700">
                <span>Remise promo</span>
                <span className="font-mono tabular-nums">-{formatDzd(effectiveDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-slate-600">
              <span>
                Frais de livraison ({selectedWilayaName} ·{' '}
                {!hasPhysical
                  ? 'Numérique'
                  : localCarrierQuote.effectiveDeliveryType === 'stop_desk'
                  ? 'STOP DESK'
                  : 'À domicile'}
                )
              </span>
              <span className="font-mono tabular-nums">
                {!localCarrierQuote.pricesActive && hasPhysical
                  ? "Confirmés à l'appel"
                  : formatDzd(effectiveShipping)}
              </span>
            </div>
            <div className="flex justify-between text-base font-bold text-slate-900 pt-3 border-t border-slate-200">
              <span>Total à payer</span>
              <span className="font-mono tabular-nums text-blue-700">{formatDzd(effectiveTotal)}</span>
            </div>
            <p className="text-xs text-slate-500 pt-1">
              Mode principal : Paiement à la livraison (Cash on Delivery) en DZD.
            </p>
          </div>
        </aside>
      </div>
    </div>
  );
}
