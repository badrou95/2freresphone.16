export type OrderStatus =
  | 'nouvelle'
  | 'a_confirmer'
  | 'confirmee'
  | 'en_preparation'
  | 'expediee'
  | 'livree'
  | 'annulee'
  | 'retournee';

export const ORDER_STATUSES: {
  value: OrderStatus;
  label: string;
  colorClass: string;
  dotClass: string;
}[] = [
  { value: 'nouvelle', label: 'Nouvelle', colorClass: 'text-blue-700 bg-blue-50 border-blue-200', dotClass: 'bg-blue-600' },
  { value: 'a_confirmer', label: 'À confirmer', colorClass: 'text-amber-700 bg-amber-50 border-amber-200', dotClass: 'bg-amber-500' },
  { value: 'confirmee', label: 'Confirmée', colorClass: 'text-indigo-700 bg-indigo-50 border-indigo-200', dotClass: 'bg-indigo-600' },
  { value: 'en_preparation', label: 'En préparation', colorClass: 'text-sky-700 bg-sky-50 border-sky-200', dotClass: 'bg-sky-600' },
  { value: 'expediee', label: 'Expédiée', colorClass: 'text-violet-700 bg-violet-50 border-violet-200', dotClass: 'bg-violet-600' },
  { value: 'livree', label: 'Livrée', colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200', dotClass: 'bg-emerald-600' },
  { value: 'annulee', label: 'Annulée', colorClass: 'text-slate-600 bg-slate-100 border-slate-200', dotClass: 'bg-slate-400' },
  { value: 'retournee', label: 'Retournée', colorClass: 'text-red-700 bg-red-50 border-red-200', dotClass: 'bg-red-600' },
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  nouvelle: 'Nouvelle',
  a_confirmer: 'À confirmer',
  confirmee: 'Confirmée',
  en_preparation: 'En préparation',
  expediee: 'Expédiée',
  livree: 'Livrée',
  annulee: 'Annulée',
  retournee: 'Retournée',
};

export const CATEGORY_GROUPS = [
  { value: 'accessories', label: 'Accessoires téléphoniques', labelAr: 'إكسسوارات الهواتف' },
  { value: 'gaming', label: 'Jeux vidéo', labelAr: 'ألعاب الفيديو' },
  { value: 'digital', label: 'Abonnements numériques', labelAr: 'الاشتراكات الرقمية' },
] as const;

export type StoreCurrency = 'DZD' | 'EUR' | 'USD';
export type StoreLang = 'fr' | 'ar';

export function getActiveStoreCurrency(): StoreCurrency {
  if (typeof window === 'undefined') return 'DZD';
  const saved = (window as any).__2fp_currency || localStorage.getItem('2fp_store_currency');
  if (saved === 'EUR' || saved === 'USD') return saved;
  return 'DZD';
}

export function setActiveStoreCurrency(currency: StoreCurrency) {
  if (typeof window === 'undefined') return;
  (window as any).__2fp_currency = currency;
  try {
    localStorage.setItem('2fp_store_currency', currency);
    window.dispatchEvent(new CustomEvent('2fp-currency-change', { detail: currency }));
  } catch {
    // ignore
  }
}

export function getActiveStoreLang(): StoreLang {
  if (typeof window === 'undefined') return 'fr';
  const saved = (window as any).__2fp_lang || localStorage.getItem('2fp_store_lang');
  return saved === 'ar' ? 'ar' : 'fr';
}

export function setActiveStoreLang(lang: StoreLang) {
  if (typeof window === 'undefined') return;
  (window as any).__2fp_lang = lang;
  try {
    localStorage.setItem('2fp_store_lang', lang);
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.documentElement.lang = lang;
    window.dispatchEvent(new CustomEvent('2fp-lang-change', { detail: lang }));
  } catch {
    // ignore
  }
}

export const getActiveCurrency = getActiveStoreCurrency;
export const setActiveCurrency = setActiveStoreCurrency;
export const getActiveLang = getActiveStoreLang;
export const setActiveLang = setActiveStoreLang;

export interface SaasFeaturesConfig {
  directCodFormOnProduct: boolean;
  quantityBundlesEnabled: boolean;
  stickyCartBarEnabled: boolean;
  urgencyVisitorsEnabled: boolean;
  sameDayDispatchTimerEnabled: boolean;
  crossSellBundlesEnabled: boolean;
  whatsappFloatingButtonEnabled: boolean;
  liveOrderToastEnabled: boolean;
  bilingualArFrEnabled: boolean;
  multiCurrencyEnabled: boolean;
  antiReturnScoreEnabled: boolean;
  announcementBarEnabled: boolean;
  announcementTextFr: string;
  announcementTextAr: string;
}

export const DEFAULT_SAAS_CONFIG: SaasFeaturesConfig = {
  directCodFormOnProduct: true,
  quantityBundlesEnabled: true,
  stickyCartBarEnabled: true,
  urgencyVisitorsEnabled: true,
  sameDayDispatchTimerEnabled: true,
  crossSellBundlesEnabled: true,
  whatsappFloatingButtonEnabled: true,
  liveOrderToastEnabled: true,
  bilingualArFrEnabled: true,
  multiCurrencyEnabled: true,
  antiReturnScoreEnabled: true,
  announcementBarEnabled: true,
  announcementTextFr:
    'Livraison Express 58 Wilayas (Yalidine · ZR Express · Maystro) · Paiement 100% à la livraison (COD) après vérification du colis',
  announcementTextAr:
    'توصيل سريع لـ 58 ولاية (ياليدين · ZR Express · مايسترو) · الدفع 100% عند الاستلام بعد فحص الطرد',
};

export function getSaasConfig(): SaasFeaturesConfig {
  if (typeof window === 'undefined') return DEFAULT_SAAS_CONFIG;
  try {
    const raw = localStorage.getItem('2fp_saas_features_config');
    if (!raw) return DEFAULT_SAAS_CONFIG;
    return { ...DEFAULT_SAAS_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SAAS_CONFIG;
  }
}

export function saveSaasConfig(next: Partial<SaasFeaturesConfig>): SaasFeaturesConfig {
  const merged = { ...getSaasConfig(), ...next };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem('2fp_saas_features_config', JSON.stringify(merged));
      window.dispatchEvent(new CustomEvent('2fp-saas-config-change', { detail: merged }));
    } catch {
      // ignore
    }
  }
  return merged;
}

export function formatDzd(amount: number, forceDzd = false): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  if (!forceDzd && typeof window !== 'undefined') {
    const cur = getActiveStoreCurrency();
    if (cur === 'EUR') {
      const eur = (safe / 245).toFixed(2);
      return `${eur} €`;
    }
    if (cur === 'USD') {
      const usd = (safe / 225).toFixed(2);
      return `${usd} $`;
    }
  }
  return `${safe.toLocaleString('fr-DZ')} DZD`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'article';
}

export function normalizeAlgerianPhone(phone: string): string {
  const cleaned = phone.replace(/[^\d+]/g, '');
  if (cleaned.startsWith('+213')) {
    return '0' + cleaned.slice(4);
  }
  if (cleaned.startsWith('00213')) {
    return '0' + cleaned.slice(5);
  }
  if (cleaned.startsWith('213') && cleaned.length >= 12) {
    return '0' + cleaned.slice(3);
  }
  return cleaned;
}

export function isValidAlgerianPhone(phone: string): boolean {
  const normalized = normalizeAlgerianPhone(phone);
  return /^0[567]\d{8}$/.test(normalized) || /^0[234]\d{7}$/.test(normalized);
}

export function generateOrderReference(sequence?: number): string {
  const year = new Date().getFullYear();
  const suffix =
    typeof sequence === 'number'
      ? String(sequence).padStart(6, '0')
      : String(Math.floor(100000 + Math.random() * 900000));
  return `2FP-${year}-${suffix}`;
}

export function computeEffectiveLowStockThreshold(
  productThreshold: number | null | undefined,
  globalDefaultThreshold: number,
): number {
  if (typeof productThreshold === 'number' && Number.isFinite(productThreshold) && productThreshold >= 0) {
    return Math.floor(productThreshold);
  }
  return Math.max(0, Math.floor(globalDefaultThreshold));
}

export function isLowStock(
  stockQuantity: number,
  productThreshold: number | null | undefined,
  globalDefaultThreshold: number,
  productType: string = 'physical',
): boolean {
  if (productType === 'digital') return false;
  const threshold = computeEffectiveLowStockThreshold(productThreshold, globalDefaultThreshold);
  return stockQuantity <= threshold;
}

export interface PromoCalculationInput {
  subtotalDzd: number;
  shippingFeeDzd: number;
  discountType: 'percent' | 'fixed' | 'free_shipping';
  discountValue: number;
  minOrderDzd?: number;
}

export function calculatePromoDiscount(input: PromoCalculationInput): {
  valid: boolean;
  discountDzd: number;
  effectiveShippingDzd: number;
  reason?: string;
} {
  const minOrder = input.minOrderDzd ?? 0;
  if (input.subtotalDzd < minOrder) {
    return {
      valid: false,
      discountDzd: 0,
      effectiveShippingDzd: input.shippingFeeDzd,
      reason: `Minimum de commande requis : ${formatDzd(minOrder)}`,
    };
  }

  if (input.discountType === 'free_shipping') {
    return {
      valid: true,
      discountDzd: 0,
      effectiveShippingDzd: 0,
    };
  }

  if (input.discountType === 'percent') {
    const pct = Math.min(100, Math.max(0, input.discountValue));
    const discountDzd = Math.round((input.subtotalDzd * pct) / 100);
    return {
      valid: true,
      discountDzd: Math.min(input.subtotalDzd, discountDzd),
      effectiveShippingDzd: input.shippingFeeDzd,
    };
  }

  const fixed = Math.max(0, Math.round(input.discountValue));
  return {
    valid: true,
    discountDzd: Math.min(input.subtotalDzd, fixed),
    effectiveShippingDzd: input.shippingFeeDzd,
  };
}

export function calculateReviewSummary(ratings: number[]): {
  averageRating: number;
  reviewCount: number;
  distribution: Record<1 | 2 | 3 | 4 | 5, number>;
} {
  const distribution: Record<1 | 2 | 3 | 4 | 5, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (ratings.length === 0) {
    return { averageRating: 0, reviewCount: 0, distribution };
  }
  let total = 0;
  let count = 0;
  for (const r of ratings) {
    const clamped = Math.min(5, Math.max(1, Math.round(r))) as 1 | 2 | 3 | 4 | 5;
    distribution[clamped] += 1;
    total += clamped;
    count += 1;
  }
  return {
    averageRating: Math.round((total / count) * 10) / 10,
    reviewCount: count,
    distribution,
  };
}

export interface WhatsAppOrderSummary {
  storeName?: string;
  reference?: string;
  firstName: string;
  lastName: string;
  phone: string;
  wilayaName: string;
  commune: string;
  address: string;
  deliveryType: 'home' | 'stop_desk' | 'digital';
  items: { name: string; quantity: number; unitPriceDzd: number }[];
  subtotalDzd: number;
  discountDzd: number;
  shippingFeeDzd: number;
  totalDzd: number;
}

export function buildWhatsAppOrderUrl(whatsappPhone: string, order: WhatsAppOrderSummary): string {
  const digits = whatsappPhone.replace(/[^\d]/g, '');
  const deliveryLabel =
    order.deliveryType === 'digital'
      ? 'Livraison numérique après validation'
      : order.deliveryType === 'stop_desk'
      ? 'STOP DESK (Bureau transporteur)'
      : 'Livraison à domicile';

  const lines = [
    `Bonjour ${order.storeName || '2Frères Phone'}, je souhaite confirmer ma commande :`,
    order.reference ? `Référence : ${order.reference}` : null,
    '',
    'Articles :',
    ...order.items.map(
      (i) => `- ${i.name} x${i.quantity} (${formatDzd(i.unitPriceDzd * i.quantity)})`,
    ),
    '',
    `Sous-total : ${formatDzd(order.subtotalDzd)}`,
    order.discountDzd > 0 ? `Remise : -${formatDzd(order.discountDzd)}` : null,
    `Livraison (${deliveryLabel}) : ${formatDzd(order.shippingFeeDzd)}`,
    `TOTAL À PAYER : ${formatDzd(order.totalDzd)}`,
    '',
    'Coordonnées client :',
    `Nom : ${order.lastName} ${order.firstName}`,
    `Téléphone : ${order.phone}`,
    `Wilaya : ${order.wilayaName}`,
    `Commune : ${order.commune}`,
    `Adresse : ${order.address}`,
  ].filter((line): line is string => line !== null);

  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function shouldDeductStockOnStatus(status: OrderStatus): boolean {
  return status === 'confirmee' || status === 'en_preparation' || status === 'expediee' || status === 'livree';
}

export function toCsv(headers: string[], rows: (string | number | boolean | null | undefined)[][]): string {
  const escapeCell = (val: string | number | boolean | null | undefined) => {
    const str = val === null || val === undefined ? '' : String(val);
    if (/[",\n;]/.test(str)) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  };
  return [headers.map(escapeCell).join(','), ...rows.map((r) => r.map(escapeCell).join(','))].join('\n');
}

export interface StockFinancialItem {
  stockQuantity: number;
  costPriceDzd: number;
  priceDzd: number;
  productType?: string;
}

export interface FinancialMarginSummary {
  totalUnits: number;
  valuedProductsCount: number;
  productsMissingCostCount: number;
  lossProductsCount: number;
  totalCostValueDzd: number;
  totalSaleValueDzd: number;
  totalGrossMarginDzd: number;
  positiveMarginDzd: number;
  marginRatePercent: number;
  roiPercent: number;
}

export function calculateFinancialSummary(items: StockFinancialItem[]): FinancialMarginSummary {
  let totalUnits = 0;
  let valuedProductsCount = 0;
  let productsMissingCostCount = 0;
  let lossProductsCount = 0;
  let totalCostValueDzd = 0;
  let totalSaleValueDzd = 0;

  for (const item of items) {
    if (item.productType === 'digital') continue;
    const qty = Number.isFinite(Number(item.stockQuantity)) ? Math.max(0, Number(item.stockQuantity)) : 0;
    const cost = Number.isFinite(Number(item.costPriceDzd)) ? Math.max(0, Number(item.costPriceDzd)) : 0;
    const sale = Number.isFinite(Number(item.priceDzd)) ? Math.max(0, Number(item.priceDzd)) : 0;

    if (qty > 0) {
      valuedProductsCount++;
      if (cost <= 0) productsMissingCostCount++;
      if (cost > 0 && sale < cost) lossProductsCount++;
    }

    totalUnits += qty;
    totalCostValueDzd += qty * cost;
    totalSaleValueDzd += qty * sale;
  }

  const totalGrossMarginDzd = totalSaleValueDzd - totalCostValueDzd;
  const positiveMarginDzd = Math.max(0, totalGrossMarginDzd);
  const marginRatePercent =
    totalSaleValueDzd > 0 ? Math.round((totalGrossMarginDzd / totalSaleValueDzd) * 1000) / 10 : 0;
  const roiPercent =
    totalCostValueDzd > 0 ? Math.round((totalGrossMarginDzd / totalCostValueDzd) * 1000) / 10 : 0;

  return {
    totalUnits,
    valuedProductsCount,
    productsMissingCostCount,
    lossProductsCount,
    totalCostValueDzd: Math.round(totalCostValueDzd),
    totalSaleValueDzd: Math.round(totalSaleValueDzd),
    totalGrossMarginDzd: Math.round(totalGrossMarginDzd),
    positiveMarginDzd: Math.round(positiveMarginDzd),
    marginRatePercent,
    roiPercent,
  };
}

