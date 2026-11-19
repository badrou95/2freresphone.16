import { formatDzd } from '../shared/domain';
import { StoreSettings } from '../types';

export type ReceiptFormat = 'thermal_80mm' | 'thermal_58mm' | 'a4';
export type DeliverySlipFormat = 'a4' | 'a5' | 'thermal_80mm';
export type ThermalLabelSize = '50x30' | '40x30' | '60x40' | '38x25';
export type PrinterConnectionType = 'system_usb' | 'bluetooth' | 'network_wifi';

export interface PrinterConfig {
  printerName: string;
  connectionType: PrinterConnectionType;
  receiptFormat: ReceiptFormat;
  deliverySlipFormat: DeliverySlipFormat;
  labelSize: ThermalLabelSize;
  showLogo: boolean;
  showBarcode: boolean;
  showPriceOnLabel: boolean;
  showStoreNameOnLabel: boolean;
  defaultLabelCopies: number;
  footerNote: string;
}

const STORAGE_KEY = '2freres_printer_config_v1';

export const DEFAULT_PRINTER_CONFIG: PrinterConfig = {
  printerName: 'Imprimante thermique 2Frères (80mm / Étiquettes)',
  connectionType: 'system_usb',
  receiptFormat: 'thermal_80mm',
  deliverySlipFormat: 'a4',
  labelSize: '50x30',
  showLogo: true,
  showBarcode: true,
  showPriceOnLabel: true,
  showStoreNameOnLabel: true,
  defaultLabelCopies: 1,
  footerNote: 'Merci pour votre confiance — 2Frères Phone Algérie',
};

export const LABEL_DIMENSIONS_MM: Record<ThermalLabelSize, { width: number; height: number; label: string }> = {
  '50x30': { width: 50, height: 30, label: '50 × 30 mm (Standard Xprinter / Rongta)' },
  '40x30': { width: 40, height: 30, label: '40 × 30 mm (Compacte)' },
  '60x40': { width: 60, height: 40, label: '60 × 40 mm (Grande étiquette)' },
  '38x25': { width: 38, height: 25, label: '38 × 25 mm (Petite étiquette accessoires)' },
};

export function loadPrinterConfig(): PrinterConfig {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_PRINTER_CONFIG };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_PRINTER_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_PRINTER_CONFIG };
  }
}

export function savePrinterConfig(config: PrinterConfig): PrinterConfig {
  const sanitized: PrinterConfig = {
    ...DEFAULT_PRINTER_CONFIG,
    ...config,
    printerName: String(config.printerName || DEFAULT_PRINTER_CONFIG.printerName).trim(),
    defaultLabelCopies: Math.max(1, Math.min(200, Math.round(Number(config.defaultLabelCopies) || 1))),
    footerNote: String(config.footerNote ?? DEFAULT_PRINTER_CONFIG.footerNote).trim(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(sanitized));
  } catch {
    // ignore storage quota errors
  }
  return sanitized;
}

function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// ---------------------------------------------------------------------------
// REAL SCANNABLE CODE 128B BARCODE SVG GENERATOR (zero external dependencies)
// ---------------------------------------------------------------------------
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

export function generateCode128Svg(rawText: string, heightPx = 36): string {
  // Keep printable ASCII 32..126 supported by Code 128B
  const clean = String(rawText || '2FP-000')
    .replace(/[^\x20-\x7E]/g, '')
    .trim()
    .slice(0, 32) || '2FP-000';

  const codes: number[] = [104]; // START CODE B
  let checksum = 104;
  for (let i = 0; i < clean.length; i++) {
    const val = clean.charCodeAt(i) - 32;
    codes.push(val);
    checksum += val * (i + 1);
  }
  codes.push(checksum % 103);
  codes.push(106); // STOP

  const quietModules = 8;
  let x = quietModules;
  const rects: string[] = [];

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] || CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      const isBar = i % 2 === 0;
      if (isBar) {
        rects.push(`<rect x="${x}" y="0" width="${width}" height="${heightPx}" fill="#000" />`);
      }
      x += width;
    }
  }

  const totalWidth = x + quietModules;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${totalWidth} ${heightPx}" preserveAspectRatio="none" style="width:100%;height:${heightPx}px;display:block;shape-rendering:crispEdges;">${rects.join('')}</svg>`;
}

// ---------------------------------------------------------------------------
// HIDDEN IFRAME PRINT ENGINE (no window.open — works on PC, mobile & iframes)
// ---------------------------------------------------------------------------
export function printHtmlDocument(html: string): void {
  const existing = document.getElementById('2freres-print-frame');
  if (existing) existing.remove();

  const iframe = document.createElement('iframe');
  iframe.id = '2freres-print-frame';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc || !iframe.contentWindow) {
    iframe.remove();
    return;
  }

  doc.open();
  doc.write(html);
  doc.close();

  const triggerPrint = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(() => {
        iframe.remove();
      }, 2000);
    }
  };

  // Wait briefly for logo images (if any) to decode before opening print dialog
  const imgs = Array.from(doc.images || []);
  if (imgs.length === 0) {
    window.setTimeout(triggerPrint, 120);
  } else {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      window.setTimeout(triggerPrint, 120);
    };
    Promise.all(
      imgs.map(
        (img) =>
          new Promise<void>((resolve) => {
            if (img.complete) return resolve();
            img.onload = () => resolve();
            img.onerror = () => resolve();
          }),
      ),
    ).then(finish);
    window.setTimeout(finish, 1200);
  }
}

function renderStoreBrandHeader(settings: Partial<StoreSettings>, config: PrinterConfig, compact = false): string {
  const name = escapeHtml(settings.storeName || '2Frères Phone');
  const phone = escapeHtml(settings.whatsappPhone || '');
  const address = escapeHtml(settings.storeAddress || 'Algérie — Livraison 58 Wilayas');
  const logoHtml =
    config.showLogo && settings.logoUrl
      ? `<img src="${escapeHtml(settings.logoUrl)}" alt="${name}" style="max-height:${compact ? '28px' : '42px'};max-width:${compact ? '120px' : '160px'};object-fit:contain;margin-bottom:4px;" />`
      : '';
  return `
    <div style="text-align:${compact ? 'center' : 'left'};">
      ${logoHtml}
      <div style="font-weight:800;font-size:${compact ? '15px' : '19px'};letter-spacing:-0.02em;">${name}</div>
      <div style="font-size:${compact ? '10px' : '11px'};color:#334155;">${address}</div>
      ${phone ? `<div style="font-size:${compact ? '10px' : '11px'};color:#0f172a;font-weight:600;">Tél / WhatsApp : ${phone}</div>` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 1. BON DE LIVRAISON (A4 / A5 / Thermique 80mm)
// ---------------------------------------------------------------------------
export function printDeliverySlip(
  order: any,
  settings: Partial<StoreSettings>,
  overrideConfig?: Partial<PrinterConfig>,
): void {
  const config = { ...loadPrinterConfig(), ...overrideConfig };
  const isThermal = config.deliverySlipFormat === 'thermal_80mm';
  const pageRule =
    config.deliverySlipFormat === 'a5'
      ? '@page { size: A5 portrait; margin: 8mm; }'
      : isThermal
        ? '@page { size: 80mm auto; margin: 2mm; }'
        : '@page { size: A4 portrait; margin: 12mm; }';

  const deliveryModeLabel =
    order.deliveryType === 'stop_desk'
      ? 'STOP DESK (Bureau transporteur)'
      : order.deliveryType === 'digital'
        ? 'Livraison numérique'
        : 'Livraison à domicile';

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const barcodeSvg = config.showBarcode ? generateCode128Svg(order.reference || `CMD-${order.id}`, isThermal ? 32 : 42) : '';
  const createdStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('fr-FR')
    : new Date().toLocaleString('fr-FR');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Bon de livraison ${escapeHtml(order.reference)}</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: ${isThermal ? '4px' : '0'};
      font-size: ${isThermal ? '11px' : '12px'};
      line-height: 1.4;
      width: ${isThermal ? '76mm' : '100%'};
    }
    .box { border: 1px solid #cbd5e1; border-radius: 6px; padding: ${isThermal ? '6px' : '10px 12px'}; margin-bottom: 10px; }
    table { width: 100%; border-collapse: collapse; margin: 8px 0; }
    th, td { border-bottom: 1px solid #e2e8f0; padding: ${isThermal ? '4px 2px' : '6px 8px'}; text-align: left; }
    th { background: #f8fafc; font-size: ${isThermal ? '10px' : '11px'}; text-transform: uppercase; color: #475569; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .total-box { background: #0f172a; color: #fff; padding: 8px 12px; border-radius: 6px; display: flex; justify-content: space-between; align-items: center; font-weight: 800; font-size: ${isThermal ? '13px' : '15px'}; margin-top: 8px; }
    .footer { margin-top: 12px; text-align: center; font-size: 10px; color: #475569; border-top: 1px dashed #94a3b8; padding-top: 6px; }
  </style>
</head>
<body>
  <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:8px;border-bottom:2px solid #0f172a;padding-bottom:8px;margin-bottom:10px;">
    ${renderStoreBrandHeader(settings, config, isThermal)}
    <div style="text-align:${isThermal ? 'center' : 'right'};width:${isThermal ? '100%' : 'auto'};">
      <div style="display:inline-block;background:#0f172a;color:#fff;padding:3px 10px;border-radius:4px;font-weight:800;font-size:${isThermal ? '11px' : '13px'};letter-spacing:0.04em;">
        BON DE LIVRAISON
      </div>
      <div class="mono" style="font-size:${isThermal ? '13px' : '15px'};font-weight:800;margin-top:4px;">${escapeHtml(order.reference)}</div>
      <div style="font-size:10px;color:#475569;">Date : ${escapeHtml(createdStr)}</div>
      ${order.trackingNumber ? `<div class="mono" style="font-size:11px;font-weight:700;">Suivi : ${escapeHtml(order.trackingNumber)}</div>` : ''}
    </div>
  </div>

  ${
    barcodeSvg
      ? `<div style="max-width:${isThermal ? '100%' : '260px'};margin:0 auto 10px auto;text-align:center;">
          ${barcodeSvg}
          <div class="mono" style="font-size:10px;font-weight:700;letter-spacing:0.08em;margin-top:2px;">${escapeHtml(order.reference)}</div>
        </div>`
      : ''
  }

  <div class="box">
    <div style="font-size:10px;text-transform:uppercase;font-weight:700;color:#475569;margin-bottom:4px;">Destinataire / Client</div>
    <div style="font-size:${isThermal ? '13px' : '14px'};font-weight:800;">${escapeHtml(order.firstName)} ${escapeHtml(order.lastName)}</div>
    <div class="mono" style="font-weight:700;font-size:${isThermal ? '12px' : '13px'};margin:2px 0;">Tél : ${escapeHtml(order.phone)}</div>
    <div><strong>Wilaya :</strong> ${escapeHtml(order.wilayaName)} ${order.wilayaCode ? `(${escapeHtml(order.wilayaCode)})` : ''} — <strong>Commune :</strong> ${escapeHtml(order.commune)}</div>
    ${order.address ? `<div><strong>Adresse :</strong> ${escapeHtml(order.address)}</div>` : ''}
    <div style="margin-top:4px;"><strong>Mode :</strong> ${escapeHtml(deliveryModeLabel)}${order.carrierName ? ` · <strong>Transporteur :</strong> ${escapeHtml(order.carrierName)}` : ''}</div>
  </div>

  <table>
    <thead>
      <tr>
        <th>Article</th>
        <th class="right">Qté</th>
        <th class="right">P.U.</th>
        <th class="right">Total</th>
      </tr>
    </thead>
    <tbody>
      ${items
        .map(
          (item) => `<tr>
            <td><strong>${escapeHtml(item.productName)}</strong>${item.productSku ? `<div class="mono" style="font-size:9px;color:#64748b;">${escapeHtml(item.productSku)}</div>` : ''}</td>
            <td class="right mono">${Number(item.quantity)}</td>
            <td class="right mono">${escapeHtml(formatDzd(item.unitPriceDzd))}</td>
            <td class="right mono"><strong>${escapeHtml(formatDzd(item.lineTotalDzd))}</strong></td>
          </tr>`,
        )
        .join('')}
    </tbody>
  </table>

  <div style="margin-left:auto;max-width:${isThermal ? '100%' : '280px'};font-size:11px;">
    <div style="display:flex;justify-content:space-between;padding:2px 0;">
      <span>Sous-total articles</span>
      <span class="mono">${escapeHtml(formatDzd(order.subtotalDzd))}</span>
    </div>
    ${
      Number(order.discountDzd) > 0
        ? `<div style="display:flex;justify-content:space-between;padding:2px 0;color:#059669;">
            <span>Remise${order.promoCode ? ` (${escapeHtml(order.promoCode)})` : ''}</span>
            <span class="mono">-${escapeHtml(formatDzd(order.discountDzd))}</span>
          </div>`
        : ''
    }
    <div style="display:flex;justify-content:space-between;padding:2px 0;">
      <span>Frais de livraison</span>
      <span class="mono">${escapeHtml(formatDzd(order.shippingFeeDzd))}</span>
    </div>
    <div class="total-box">
      <span>TOTAL À PAYER (COD)</span>
      <span class="mono">${escapeHtml(formatDzd(order.totalDzd))}</span>
    </div>
  </div>

  ${
    !isThermal
      ? `<div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:24px;">
          <div style="border:1px dashed #94a3b8;border-radius:6px;padding:10px;min-height:64px;font-size:10px;color:#475569;">
            Cachet &amp; Signature 2Frères Phone
          </div>
          <div style="border:1px dashed #94a3b8;border-radius:6px;padding:10px;min-height:64px;font-size:10px;color:#475569;">
            Reçu conforme — Signature du client
          </div>
        </div>`
      : ''
  }

  <div class="footer">${escapeHtml(config.footerNote)}</div>
</body>
</html>`;

  printHtmlDocument(html);
}

// ---------------------------------------------------------------------------
// 2. BON D'ACHAT / REÇU DE CAISSE (Thermique 80mm / 58mm / A4)
// ---------------------------------------------------------------------------
export function printPurchaseReceipt(
  order: any,
  settings: Partial<StoreSettings>,
  overrideConfig?: Partial<PrinterConfig>,
): void {
  const config = { ...loadPrinterConfig(), ...overrideConfig };
  const is58 = config.receiptFormat === 'thermal_58mm';
  const isA4 = config.receiptFormat === 'a4';
  const pageRule = is58
    ? '@page { size: 58mm auto; margin: 1.5mm; }'
    : isA4
      ? '@page { size: A4 portrait; margin: 14mm; }'
      : '@page { size: 80mm auto; margin: 2mm; }';

  const items: any[] = Array.isArray(order.items) ? order.items : [];
  const createdStr = order.createdAt
    ? new Date(order.createdAt).toLocaleString('fr-FR')
    : order.recordedAt
      ? new Date(order.recordedAt).toLocaleString('fr-FR')
      : new Date().toLocaleString('fr-FR');
  const reference = order.reference || order.orderReference || `VNT-${order.id}`;
  const customerName = order.customerName || `${order.firstName || ''} ${order.lastName || ''}`.trim();
  const totalAmount = order.totalDzd ?? order.totalCollectedDzd ?? 0;
  const subtotalAmount = order.subtotalDzd ?? order.itemsRevenueDzd ?? totalAmount;
  const shippingAmount = order.shippingFeeDzd ?? 0;
  const discountAmount = order.discountDzd ?? 0;

  const barcodeSvg = config.showBarcode ? generateCode128Svg(reference, is58 ? 26 : 32) : '';

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Bon d'achat ${escapeHtml(reference)}</title>
  <style>
    ${pageRule}
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000;
      margin: 0 auto;
      padding: ${isA4 ? '0' : '3px'};
      width: ${is58 ? '54mm' : isA4 ? '100%' : '76mm'};
      font-size: ${is58 ? '10px' : isA4 ? '12px' : '11px'};
      line-height: 1.35;
    }
    .sep { border-top: 1px dashed #000; margin: 6px 0; }
    .mono { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
    .row { display: flex; justify-content: space-between; gap: 6px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { padding: 3px 0; border-bottom: 1px dotted #94a3b8; text-align: left; }
    .right { text-align: right; font-variant-numeric: tabular-nums; }
  </style>
</head>
<body>
  ${renderStoreBrandHeader(settings, config, !isA4)}
  <div class="sep"></div>
  <div style="text-align:center;font-weight:800;font-size:${is58 ? '12px' : '13px'};letter-spacing:0.04em;">
    BON D'ACHAT / REÇU
  </div>
  <div style="text-align:center;font-size:10px;" class="mono">${escapeHtml(reference)} · ${escapeHtml(createdStr)}</div>
  <div class="sep"></div>

  <div><strong>Client :</strong> ${escapeHtml(customerName || 'Client comptoir')}</div>
  ${order.phone ? `<div class="mono"><strong>Tél :</strong> ${escapeHtml(order.phone)}</div>` : ''}
  ${order.wilayaName ? `<div><strong>Wilaya :</strong> ${escapeHtml(order.wilayaName)}${order.commune ? ` · ${escapeHtml(order.commune)}` : ''}</div>` : ''}

  <div class="sep"></div>
  ${
    items.length > 0
      ? `<table>
          <thead>
            <tr>
              <th>Article</th>
              <th class="right">Qté</th>
              <th class="right">Total</th>
            </tr>
          </thead>
          <tbody>
            ${items
              .map(
                (i) => `<tr>
                  <td>${escapeHtml(i.productName)}</td>
                  <td class="right mono">×${Number(i.quantity)}</td>
                  <td class="right mono">${escapeHtml(formatDzd(i.lineTotalDzd))}</td>
                </tr>`,
              )
              .join('')}
          </tbody>
        </table>`
      : `<div class="row"><span>Articles commande ${escapeHtml(reference)}</span><span class="mono">${escapeHtml(formatDzd(subtotalAmount))}</span></div>`
  }

  <div class="sep"></div>
  <div class="row"><span>Sous-total</span><span class="mono">${escapeHtml(formatDzd(subtotalAmount))}</span></div>
  ${Number(discountAmount) > 0 ? `<div class="row"><span>Remise</span><span class="mono">-${escapeHtml(formatDzd(discountAmount))}</span></div>` : ''}
  ${Number(shippingAmount) > 0 ? `<div class="row"><span>Livraison</span><span class="mono">${escapeHtml(formatDzd(shippingAmount))}</span></div>` : ''}
  <div class="row" style="font-weight:800;font-size:${is58 ? '13px' : '14px'};margin-top:4px;padding-top:4px;border-top:1px solid #000;">
    <span>TOTAL NET</span>
    <span class="mono">${escapeHtml(formatDzd(totalAmount))}</span>
  </div>

  ${
    barcodeSvg
      ? `<div style="margin-top:8px;text-align:center;">
          ${barcodeSvg}
          <div class="mono" style="font-size:9px;margin-top:2px;">${escapeHtml(reference)}</div>
        </div>`
      : ''
  }

  <div class="sep"></div>
  <div style="text-align:center;font-size:9.5px;">${escapeHtml(config.footerNote)}</div>
</body>
</html>`;

  printHtmlDocument(html);
}

// ---------------------------------------------------------------------------
// 3. ÉTIQUETTES THERMIQUES PRODUITS (50×30 / 40×30 / 60×40 / 38×25 mm)
// ---------------------------------------------------------------------------
export interface ThermalLabelJobItem {
  name: string;
  sku: string;
  barcode?: string | null;
  priceDzd: number;
  copies: number;
}

export function printProductThermalLabels(
  items: ThermalLabelJobItem[],
  settings: Partial<StoreSettings>,
  overrideConfig?: Partial<PrinterConfig>,
): void {
  const config = { ...loadPrinterConfig(), ...overrideConfig };
  const dims = LABEL_DIMENSIONS_MM[config.labelSize] || LABEL_DIMENSIONS_MM['50x30'];
  const storeName = escapeHtml(settings.storeName || '2Frères Phone');
  const isCompact = dims.width <= 40;
  const barcodeHeight = dims.height >= 40 ? 34 : dims.height >= 30 ? 26 : 20;

  const expandedLabels: ThermalLabelJobItem[] = [];
  for (const item of items) {
    const count = Math.max(1, Math.min(200, Math.round(Number(item.copies) || 1)));
    for (let i = 0; i < count; i++) {
      expandedLabels.push(item);
    }
  }

  if (expandedLabels.length === 0) return;

  const labelsHtml = expandedLabels
    .map((item) => {
      const codeValue = (item.barcode || item.sku || '2FP').trim();
      const barcodeSvg = config.showBarcode ? generateCode128Svg(codeValue, barcodeHeight) : '';
      return `
        <div class="label">
          <div class="top">
            ${config.showStoreNameOnLabel ? `<div class="brand">${storeName}</div>` : ''}
            <div class="name">${escapeHtml(item.name)}</div>
          </div>
          ${
            barcodeSvg
              ? `<div class="barcode-wrap">
                  ${barcodeSvg}
                  <div class="code">${escapeHtml(codeValue)}</div>
                </div>`
              : `<div class="code">${escapeHtml(codeValue)}</div>`
          }
          ${
            config.showPriceOnLabel
              ? `<div class="price">${escapeHtml(formatDzd(item.priceDzd))}</div>`
              : ''
          }
        </div>
      `;
    })
    .join('');

  const html = `<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8" />
  <title>Étiquettes thermiques — ${storeName}</title>
  <style>
    @page {
      size: ${dims.width}mm ${dims.height}mm;
      margin: 0;
    }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif;
      color: #000;
      background: #fff;
    }
    .label {
      width: ${dims.width}mm;
      height: ${dims.height}mm;
      padding: ${isCompact ? '1.5mm 2mm' : '2mm 2.5mm'};
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      align-items: center;
      text-align: center;
      overflow: hidden;
      page-break-after: always;
      break-after: page;
    }
    .label:last-child {
      page-break-after: auto;
      break-after: auto;
    }
    .top { width: 100%; }
    .brand {
      font-size: ${isCompact ? '6.5pt' : '7.5pt'};
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      line-height: 1.1;
    }
    .name {
      font-size: ${isCompact ? '7pt' : dims.height >= 40 ? '9pt' : '7.8pt'};
      font-weight: 700;
      line-height: 1.15;
      max-height: ${isCompact ? '2.3em' : '2.4em'};
      overflow: hidden;
      margin-top: 1px;
    }
    .barcode-wrap {
      width: 96%;
      margin: 1px auto;
    }
    .code {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: ${isCompact ? '6.5pt' : '7.5pt'};
      font-weight: 700;
      letter-spacing: 0.05em;
      line-height: 1.1;
      margin-top: 1px;
    }
    .price {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: ${isCompact ? '9.5pt' : dims.height >= 40 ? '13pt' : '11pt'};
      font-weight: 900;
      line-height: 1.1;
    }
  </style>
</head>
<body>
  ${labelsHtml}
</body>
</html>`;

  printHtmlDocument(html);
}

// ---------------------------------------------------------------------------
// 4. TEST IMPRIMANTE
// ---------------------------------------------------------------------------
export function printPrinterTestPage(
  settings: Partial<StoreSettings>,
  config: PrinterConfig,
  mode: 'label' | 'receipt' = 'label',
): void {
  if (mode === 'label') {
    printProductThermalLabels(
      [
        {
          name: 'Test Étiquette Thermique 2Frères Phone',
          sku: '2FP-TEST-001',
          barcode: '2FP-TEST-001',
          priceDzd: 2500,
          copies: 1,
        },
      ],
      settings,
      config,
    );
    return;
  }

  printPurchaseReceipt(
    {
      reference: '2FP-TEST-001',
      createdAt: new Date().toISOString(),
      firstName: 'Test',
      lastName: config.printerName,
      phone: settings.whatsappPhone || '0550000000',
      wilayaName: 'Alger',
      commune: 'Test Imprimante',
      subtotalDzd: 2500,
      discountDzd: 0,
      shippingFeeDzd: 0,
      totalDzd: 2500,
      items: [
        {
          productName: 'Test Impression Reçu 2Frères Phone',
          quantity: 1,
          lineTotalDzd: 2500,
        },
      ],
    },
    settings,
    config,
  );
}
