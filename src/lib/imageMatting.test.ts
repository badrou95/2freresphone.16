import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeMagicWandMask,
  computeSubjectBounds,
  diagnoseBackgroundType,
  processSubjectMatting,
} from './imageMatting';

function createSyntheticWhiteBgImage(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const gradVal = Math.round(245 - ((x + y) / (w + h)) * 30);
      data[idx] = gradVal;
      data[idx + 1] = gradVal;
      data[idx + 2] = gradVal + 2;
      data[idx + 3] = 255;

      // Soft cast shadow under the product
      if (y >= 38 && y <= 43 && x >= 16 && x <= 34) {
        data[idx] = 188;
        data[idx + 1] = 188;
        data[idx + 2] = 190;
      }

      // Floating trace in background
      if (x >= 6 && x <= 7 && y >= 8 && y <= 9) {
        data[idx] = 80;
        data[idx + 1] = 85;
        data[idx + 2] = 95;
      }

      // Main product subject in center
      if (x >= 15 && x <= 35 && y >= 12 && y <= 38) {
        data[idx] = 20;
        data[idx + 1] = 45;
        data[idx + 2] = 120;

        // White detail inside product
        if (x >= 22 && x <= 28 && y >= 22 && y <= 28) {
          data[idx] = 242;
          data[idx + 1] = 242;
          data[idx + 2] = 244;
        }
      }
    }
  }

  return data;
}

function createSyntheticNonWhiteComplexBgImage(w: number, h: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(w * h * 4);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      // Top half of background: dark grey-blue shop wall
      if (y < h * 0.55) {
        data[idx] = 65;
        data[idx + 1] = 75;
        data[idx + 2] = 92;
      } else {
        // Bottom half of background: warm brown wooden counter
        data[idx] = 152;
        data[idx + 1] = 104;
        data[idx + 2] = 62;
      }
      data[idx + 3] = 255;

      // Main product in center (x in 18..42, y in 14..46): vibrant emerald/cyan smartphone box
      if (x >= 18 && x <= 42 && y >= 14 && y <= 46) {
        data[idx] = 12;
        data[idx + 1] = 210;
        data[idx + 2] = 175;

        // Interior dark label inside product that happens to look like the top wall color!
        // Must NOT be hollowed out!
        if (x >= 26 && x <= 34 && y >= 26 && y <= 34) {
          data[idx] = 66;
          data[idx + 1] = 76;
          data[idx + 2] = 90;
        }
      }
    }
  }

  return data;
}

test('diagnoseBackgroundType distinguishes white/uniform background from non-white complex background', () => {
  const whiteImg = createSyntheticWhiteBgImage(50, 50);
  const complexImg = createSyntheticNonWhiteComplexBgImage(60, 60);

  const whiteDiag = diagnoseBackgroundType(whiteImg, 50, 50);
  const complexDiag = diagnoseBackgroundType(complexImg, 60, 60);

  assert.equal(whiteDiag.isWhiteOrUniform, true, 'white studio photo should be diagnosed as uniform');
  assert.equal(
    complexDiag.isWhiteOrUniform,
    false,
    'two-tone wall + wooden counter photo should be diagnosed as complex non-white background',
  );
});

test('processSubjectMatting (auto mode) keeps white-background perfection intact', () => {
  const w = 50;
  const h = 50;
  const data = createSyntheticWhiteBgImage(w, h);

  processSubjectMatting(data, w, h, {
    tolerance: 38,
    mode: 'auto',
    removeShadows: true,
    removeFloatingTraces: true,
    edgeChoke: 1.0,
    decontaminateColors: 0.85,
  });

  assert.equal(data[(2 * w + 2) * 4 + 3], 0, 'top-left background should be transparent');
  assert.equal(data[(41 * w + 25) * 4 + 3], 0, 'cast shadow under product should be removed');
  assert.equal(data[(8 * w + 6) * 4 + 3], 0, 'floating background trace should be removed');
  assert.equal(data[(20 * w + 20) * 4 + 3], 255, 'main product body should stay opaque');
  assert.equal(data[(25 * w + 25) * 4 + 3], 255, 'white detail inside product must stay intact');
});

test('processSubjectMatting (auto/complex mode) cleanly isolates product on non-white multi-colored background without hollowing product interior', () => {
  const w = 60;
  const h = 60;
  const data = createSyntheticNonWhiteComplexBgImage(w, h);

  processSubjectMatting(data, w, h, {
    tolerance: 40,
    mode: 'auto',
    removeShadows: true,
    removeFloatingTraces: true,
    edgeChoke: 1.0,
  });

  // Top dark wall (5, 5) and bottom wooden counter (55, 55) must BOTH be transparent
  assert.equal(data[(5 * w + 5) * 4 + 3], 0, 'dark shop wall background should be removed');
  assert.equal(data[(55 * w + 55) * 4 + 3], 0, 'wooden counter background should be removed');

  // Product body at (22, 22) must be opaque
  assert.equal(data[(22 * w + 22) * 4 + 3], 255, 'product body on complex background must be kept');

  // Interior dark label at (30, 30) that matches wall color must be protected by enclosed hole filling
  assert.equal(
    data[(30 * w + 30) * 4 + 3],
    255,
    'interior product detail matching background color must not be hollowed out',
  );

  const bounds = computeSubjectBounds(data, w, h);
  assert.ok(bounds.minX >= 17 && bounds.minX <= 20, `expected minX around 18, got ${bounds.minX}`);
  assert.ok(bounds.maxX >= 40 && bounds.maxX <= 43, `expected maxX around 42, got ${bounds.maxX}`);
});

test('computeMagicWandMask selects connected background region of similar color in 1 click', () => {
  const w = 60;
  const h = 60;
  const data = createSyntheticNonWhiteComplexBgImage(w, h);
  // Click on bottom wooden counter at (10, 50)
  const mask = computeMagicWandMask(data, w, h, 10, 50, 30);

  assert.equal(mask[50 * w + 10], 1, 'clicked wooden counter pixel should be selected');
  assert.equal(mask[52 * w + 48], 1, 'connected wooden counter pixel should be selected');
  assert.equal(mask[30 * w + 30], 0, 'product pixel must not be selected by magic wand');
});
