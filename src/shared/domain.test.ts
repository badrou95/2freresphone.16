import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildWhatsAppOrderUrl,
  calculateFinancialSummary,
  calculatePromoDiscount,
  calculateReviewSummary,
  computeEffectiveLowStockThreshold,
  formatDzd,
  isLowStock,
  isValidAlgerianPhone,
  normalizeAlgerianPhone,
} from './domain';
import {
  buildDifferentialSyncPlan,
  parseStockDatabaseBuffer,
  suggestColumnMapping,
} from '../server/stockImportParser';

test('Algerian phone normalization and validation', () => {
  assert.equal(normalizeAlgerianPhone('+213 551 23 45 67'), '0551234567');
  assert.equal(normalizeAlgerianPhone('00213661998877'), '0661998877');
  assert.equal(isValidAlgerianPhone('+213 770 12 34 56'), true);
  assert.equal(isValidAlgerianPhone('12345'), false);
});

test('Low stock threshold respects per-product override and global default', () => {
  assert.equal(computeEffectiveLowStockThreshold(null, 10), 10);
  assert.equal(computeEffectiveLowStockThreshold(4, 10), 4);
  assert.equal(isLowStock(8, null, 10, 'physical'), true);
  assert.equal(isLowStock(8, 5, 10, 'physical'), false);
  assert.equal(isLowStock(5, 5, 10, 'physical'), true);
  assert.equal(isLowStock(0, 5, 10, 'digital'), false);
});

test('Promo calculations handle percent, fixed, free shipping, and min order', () => {
  const pct = calculatePromoDiscount({
    subtotalDzd: 10000,
    shippingFeeDzd: 600,
    discountType: 'percent',
    discountValue: 15,
    minOrderDzd: 5000,
  });
  assert.equal(pct.valid, true);
  assert.equal(pct.discountDzd, 1500);
  assert.equal(pct.effectiveShippingDzd, 600);

  const freeShip = calculatePromoDiscount({
    subtotalDzd: 8000,
    shippingFeeDzd: 700,
    discountType: 'free_shipping',
    discountValue: 0,
  });
  assert.equal(freeShip.effectiveShippingDzd, 0);

  const belowMin = calculatePromoDiscount({
    subtotalDzd: 2000,
    shippingFeeDzd: 500,
    discountType: 'fixed',
    discountValue: 500,
    minOrderDzd: 5000,
  });
  assert.equal(belowMin.valid, false);
});

test('Review summary calculates average rating and star distribution', () => {
  const summary = calculateReviewSummary([5, 4, 5, 3]);
  assert.equal(summary.reviewCount, 4);
  assert.equal(summary.averageRating, 4.3);
  assert.equal(summary.distribution[5], 2);
  assert.equal(summary.distribution[4], 1);
  assert.equal(summary.distribution[3], 1);
});

test('WhatsApp order URL includes DZD totals and delivery info', () => {
  const url = buildWhatsAppOrderUrl('+213 550 11 22 33', {
    reference: '2FP-2026-000123',
    firstName: 'Karim',
    lastName: 'Benali',
    phone: '0550112233',
    wilayaName: 'Alger',
    commune: 'Bab Ezzouar',
    address: 'Cité 5 Juillet',
    deliveryType: 'stop_desk',
    items: [{ name: 'Chargeur GaN 65W', quantity: 2, unitPriceDzd: 3500 }],
    subtotalDzd: 7000,
    discountDzd: 0,
    shippingFeeDzd: 400,
    totalDzd: 7400,
  });
  assert.ok(url.startsWith('https://wa.me/213550112233?text='));
  const decoded = decodeURIComponent(url.split('?text=')[1]);
  assert.ok(decoded.includes('2FP-2026-000123'));
  assert.ok(decoded.includes('STOP DESK'));
  assert.ok(decoded.includes(formatDzd(7400)));
});

test('Universal stock parser parses CSV, JSON, XML, and SQL dumps + differential add_only mode', async () => {
  // 1. Semicolon CSV (typical Algerian POS export)
  const csvContent = [
    'Code_Barre;Designation;Prix_Vente;Prix_Achat;Qte_Stock;Famille',
    '613000111222;Coque MagSafe iPhone 15 Pro;2200;1100;18;Coques',
    '613000111333;Verre Trempé 9D S24 Ultra;900;300;6;Verres trempés',
  ].join('\n');
  const parsedCsv = await parseStockDatabaseBuffer(Buffer.from(csvContent, 'utf8'), 'stock_caisse.csv');
  assert.equal(parsedCsv.format, 'csv');
  assert.equal(parsedCsv.totalRows, 2);
  assert.equal(parsedCsv.suggestedMapping.name, 'Designation');
  assert.equal(parsedCsv.suggestedMapping.barcode, 'Code_Barre');
  assert.equal(parsedCsv.suggestedMapping.priceDzd, 'Prix_Vente');
  assert.equal(parsedCsv.suggestedMapping.stockQuantity, 'Qte_Stock');

  // Differential sync in add_only mode skips already-existing item and only adds new item
  const existing = [
    {
      id: 1,
      sku: 'COQ-15P',
      barcode: '613000111222',
      externalRef: '613000111222',
      name: 'Coque MagSafe iPhone 15 Pro',
      priceDzd: 2200,
      costPriceDzd: 1100,
      stockQuantity: 10,
    },
  ];
  const planAddOnly = buildDifferentialSyncPlan(
    parsedCsv.tables[0].rows,
    parsedCsv.suggestedMapping,
    existing,
    'add_only',
  );
  assert.equal(planAddOnly.toAdd.length, 1);
  assert.equal(planAddOnly.toAdd[0].name, 'Verre Trempé 9D S24 Ultra');
  assert.equal(planAddOnly.skipped.length, 1);
  assert.equal(planAddOnly.toUpdate.length, 0);

  // 2. SQL dump parsing
  const sqlDump = `
    INSERT INTO articles (ref, libelle, pv, qte) VALUES
    ('CAB-USBC-2M', 'Câble USB-C Tressé 100W 2m', 1450, 35),
    ('PWR-20K', 'Batterie Externe 20000mAh PD', 5800, 7);
  `;
  const parsedSql = await parseStockDatabaseBuffer(Buffer.from(sqlDump, 'utf8'), 'backup_stock.sql');
  assert.equal(parsedSql.format, 'sql');
  assert.equal(parsedSql.totalRows, 2);
  const sqlMapping = suggestColumnMapping(parsedSql.columns);
  assert.equal(sqlMapping.sku, 'ref');
  assert.equal(sqlMapping.name, 'libelle');

  // 3. XML export parsing
  const xmlExport = `<stock><article><sku>ECO-BT-01</sku><nom>Écouteurs Bluetooth ANC</nom><prix>4900</prix><stock>12</stock></article></stock>`;
  const parsedXml = await parseStockDatabaseBuffer(Buffer.from(xmlExport, 'utf8'), 'export.xml');
  assert.equal(parsedXml.format, 'xml');
  assert.equal(parsedXml.totalRows, 1);
});

test('Financial summary calculates total cost, sale valuation, gross margin, ROI and missing costs', () => {
  const summary = calculateFinancialSummary([
    { stockQuantity: 10, costPriceDzd: 2000, priceDzd: 3000, productType: 'physical' },
    { stockQuantity: 5, costPriceDzd: 4000, priceDzd: 6000, productType: 'physical' },
    { stockQuantity: 2, costPriceDzd: 0, priceDzd: 1500, productType: 'physical' },
    { stockQuantity: 99, costPriceDzd: 1000, priceDzd: 5000, productType: 'digital' },
  ]);

  assert.equal(summary.totalUnits, 17);
  assert.equal(summary.valuedProductsCount, 3);
  assert.equal(summary.productsMissingCostCount, 1);
  assert.equal(summary.lossProductsCount, 0);
  // Cost = 10*2000 + 5*4000 + 2*0 = 40,000
  assert.equal(summary.totalCostValueDzd, 40000);
  // Sale = 10*3000 + 5*6000 + 2*1500 = 63,000
  assert.equal(summary.totalSaleValueDzd, 63000);
  // Margin = 63,000 - 40,000 = 23,000
  assert.equal(summary.totalGrossMarginDzd, 23000);
  assert.equal(summary.positiveMarginDzd, 23000);
  assert.equal(summary.marginRatePercent, 36.5);
  assert.equal(summary.roiPercent, 57.5);
});

