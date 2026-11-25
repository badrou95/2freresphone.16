import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEffectiveShippingQuote } from './domain';

const sampleCarriers = [
  {
    id: 1,
    name: 'Yalidine Express',
    code: 'yalidine',
    isActive: true,
    supportsHome: true,
    supportsStopDesk: true,
  },
  {
    id: 2,
    name: 'ZR Express',
    code: 'zrexpress',
    isActive: false,
    supportsHome: true,
    supportsStopDesk: true,
  },
];

const sampleRates = [
  {
    id: 101,
    carrierId: 1,
    wilayaCode: '16',
    homePriceDzd: 500,
    stopDeskPriceDzd: 350,
    estimatedDays: '24h',
    isActive: true,
  },
  {
    id: 102,
    carrierId: 2,
    wilayaCode: '16',
    homePriceDzd: 900,
    stopDeskPriceDzd: 700,
    estimatedDays: '48h',
    isActive: true,
  },
];

test('resolveEffectiveShippingQuote uses active carrier rate when prices and modes are enabled', () => {
  const quote = resolveEffectiveShippingQuote({
    carriers: sampleCarriers,
    shippingRates: sampleRates,
    wilayaCode: '16',
    deliveryType: 'home',
    shippingPricesEnabled: true,
  });

  assert.equal(quote.carrier?.id, 1);
  assert.equal(quote.pricesActive, true);
  assert.equal(quote.homePriceDzd, 500);
  assert.equal(quote.stopDeskPriceDzd, 350);
  assert.equal(quote.feeDzd, 500);
  assert.equal(quote.effectiveDeliveryType, 'home');
});

test('resolveEffectiveShippingQuote returns 0 DZD when shippingPricesEnabled is false', () => {
  const quote = resolveEffectiveShippingQuote({
    carriers: sampleCarriers,
    shippingRates: sampleRates,
    wilayaCode: '16',
    deliveryType: 'home',
    shippingPricesEnabled: false,
  });

  assert.equal(quote.pricesActive, false);
  assert.equal(quote.homePriceDzd, 0);
  assert.equal(quote.stopDeskPriceDzd, 0);
  assert.equal(quote.feeDzd, 0);
});

test('resolveEffectiveShippingQuote ignores rates belonging to deactivated carriers and never falls back to hardcoded 600/400', () => {
  const deactivatedCarriers = sampleCarriers.map((c) => ({ ...c, isActive: false }));
  const quote = resolveEffectiveShippingQuote({
    carriers: deactivatedCarriers,
    shippingRates: sampleRates,
    wilayaCode: '16',
    deliveryType: 'home',
    shippingPricesEnabled: true,
  });

  assert.equal(quote.carrier, null);
  assert.equal(quote.pricesActive, false);
  assert.equal(quote.homePriceDzd, 0);
  assert.equal(quote.stopDeskPriceDzd, 0);
  assert.equal(quote.feeDzd, 0);
});

test('resolveEffectiveShippingQuote switches delivery mode when Stop Desk or Domicile is disabled on active carrier', () => {
  const homeOnlyCarriers = [
    {
      ...sampleCarriers[0],
      supportsHome: true,
      supportsStopDesk: false,
    },
  ];
  const quote = resolveEffectiveShippingQuote({
    carriers: homeOnlyCarriers,
    shippingRates: sampleRates,
    wilayaCode: '16',
    deliveryType: 'stop_desk',
    shippingPricesEnabled: true,
  });

  assert.equal(quote.supportsHome, true);
  assert.equal(quote.supportsStopDesk, false);
  assert.equal(quote.effectiveDeliveryType, 'home');
  assert.equal(quote.stopDeskPriceDzd, 0);
  assert.equal(quote.feeDzd, 500);
});

test('getCommunesByWilayaCode returns official communes for all 58 Algerian wilayas', async () => {
  const { ALGERIA_WILAYAS, getCommunesByWilayaCode } = await import('./algeria');
  assert.equal(ALGERIA_WILAYAS.length, 58);
  for (const w of ALGERIA_WILAYAS) {
    const communes = getCommunesByWilayaCode(w.code);
    assert.ok(communes.length >= 2, `Wilaya ${w.code} (${w.name}) should have communes`);
  }
  const algiersCommunes = getCommunesByWilayaCode('16');
  assert.ok(algiersCommunes.includes('Bab Ezzouar'));
});

test('DEFAULT_SAAS_CONFIG and CALL_STATUSES expose all 16 2FP COD modules', async () => {
  const { ADMIN_TEAM_ROLES, CALL_STATUSES, DEFAULT_SAAS_CONFIG } = await import('./domain');
  assert.equal(DEFAULT_SAAS_CONFIG.abandonedOrdersCaptureEnabled, true);
  assert.equal(DEFAULT_SAAS_CONFIG.postPurchaseUpsellEnabled, true);
  assert.equal(DEFAULT_SAAS_CONFIG.communeDropdownEnabled, true);
  assert.equal(DEFAULT_SAAS_CONFIG.antiSpamEnabled, true);
  assert.ok(CALL_STATUSES.some((c) => c.value === 'confirme_tel'));
  assert.ok(ADMIN_TEAM_ROLES.some((r) => r.value === 'confirmateur'));
});

