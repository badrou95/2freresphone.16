export interface NormalizedPoint {
  /** Normalized X coordinate in [0..1] */
  x: number;
  /** Normalized Y coordinate in [0..1] */
  y: number;
}

export interface MattingOptions {
  /** Overall tolerance (10 to 90, default 38) */
  tolerance: number;
  /**
   * Mode:
   * - 'auto': automatically detects if background is white/uniform vs complex non-white photo
   * - 'flood': sharp border flood-fill for white/uniform backgrounds
   * - 'complex': edge-barrier + center-saliency + core-hole-fill for non-white/real-life backgrounds
   * - 'global_holes': also removes enclosed background holes (earbuds, ring lights) on uniform bg
   */
  mode?: 'auto' | 'flood' | 'complex' | 'global_holes';
  /** Remove soft background cast shadows that share background chroma (default true) */
  removeShadows?: boolean;
  /** Remove disconnected floating specks/islands outside the main product subject (default true) */
  removeFloatingTraces?: boolean;
  /** Edge choke / contour tightening in pixels (0 to 4, default 1.5) to eat away background fringe */
  edgeChoke?: number;
  /** Color decontamination strength (0 to 1, default 0.85) to remove halo from edge pixels */
  decontaminateColors?: number;
  /** Optional AI Vision polygon (normalized 0..1 coordinates) around the main product subject */
  subjectPolygon?: NormalizedPoint[] | null;
}

export interface SubjectBounds {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  width: number;
  height: number;
}

export interface BackgroundDiagnosis {
  isWhiteOrUniform: boolean;
  borderColorSpread: number;
  avgLuma: number;
  clusterCount: number;
}

interface RgbSample {
  r: number;
  g: number;
  b: number;
  luma: number;
  chromaR: number;
  chromaG: number;
  chromaB: number;
}

function makeSample(r: number, g: number, b: number): RgbSample {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  return {
    r,
    g,
    b,
    luma,
    chromaR: r - luma,
    chromaG: g - luma,
    chromaB: b - luma,
  };
}

/**
 * Perceptual color distance that separates luminance from chromaticity.
 */
function perceptualBgDistance(
  r: number,
  g: number,
  b: number,
  bg: RgbSample,
  removeShadows: boolean,
): number {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const dLuma = luma - bg.luma;
  const dCr = r - luma - bg.chromaR;
  const dCg = g - luma - bg.chromaG;
  const dCb = b - luma - bg.chromaB;
  const chromaDist = Math.sqrt(dCr * dCr + dCg * dCg + dCb * dCb);

  let lumaWeight = 0.85;
  if (removeShadows && bg.luma > 110 && dLuma < 0 && dLuma > -85 && chromaDist < 18) {
    lumaWeight = 0.32;
  }

  return Math.sqrt(dLuma * dLuma * lumaWeight * lumaWeight + chromaDist * chromaDist * 1.45);
}

/**
 * Sample border pixels along all 4 edges to capture lighting gradients and diagnose background type.
 */
function sampleBorderPalette(data: Uint8ClampedArray, w: number, h: number): {
  palette: RgbSample[];
  topBg: RgbSample;
  bottomBg: RgbSample;
  leftBg: RgbSample;
  rightBg: RgbSample;
  diagnosis: BackgroundDiagnosis;
} {
  const rawSamples: RgbSample[] = [];
  const stepX = Math.max(1, Math.floor(w / 28));
  const stepY = Math.max(1, Math.floor(h / 28));

  const readPx = (x: number, y: number): RgbSample => {
    const cx = Math.max(0, Math.min(w - 1, Math.round(x)));
    const cy = Math.max(0, Math.min(h - 1, Math.round(y)));
    const idx = (cy * w + cx) * 4;
    return makeSample(data[idx], data[idx + 1], data[idx + 2]);
  };

  const avgGroup = (items: RgbSample[]): RgbSample => {
    if (items.length === 0) return makeSample(255, 255, 255);
    let r = 0;
    let g = 0;
    let b = 0;
    for (const s of items) {
      r += s.r;
      g += s.g;
      b += s.b;
    }
    return makeSample(r / items.length, g / items.length, b / items.length);
  };

  const topSamples: RgbSample[] = [];
  const bottomSamples: RgbSample[] = [];
  const leftSamples: RgbSample[] = [];
  const rightSamples: RgbSample[] = [];

  for (let x = 1; x < w - 1; x += stepX) {
    const t = readPx(x, 1);
    const b = readPx(x, h - 2);
    topSamples.push(t);
    bottomSamples.push(b);
    rawSamples.push(t, b);
  }
  for (let y = 1; y < h - 1; y += stepY) {
    const l = readPx(1, y);
    const r = readPx(w - 2, y);
    leftSamples.push(l);
    rightSamples.push(r);
    rawSamples.push(l, r);
  }

  const globalAvg = avgGroup(rawSamples);
  let varianceSum = 0;
  for (const s of rawSamples) {
    const dr = s.r - globalAvg.r;
    const dg = s.g - globalAvg.g;
    const db = s.b - globalAvg.b;
    varianceSum += dr * dr + dg * dg + db * db;
  }
  const borderColorSpread =
    rawSamples.length > 0 ? Math.sqrt(varianceSum / (rawSamples.length * 3)) : 0;

  // Deduplicate into representative palette clusters
  const palette: RgbSample[] = [];
  for (const s of rawSamples) {
    const exists = palette.some(
      (p) => Math.abs(p.r - s.r) + Math.abs(p.g - s.g) + Math.abs(p.b - s.b) < 18,
    );
    if (!exists && palette.length < 24) {
      palette.push(s);
    }
  }
  if (palette.length === 0) {
    palette.push(readPx(0, 0));
  }

  // A photo is considered white or uniform studio background if border color spread is low (< 22)
  // and cluster count is small (<= 5). Otherwise it's a real-life / multi-colored / non-white background.
  const isWhiteOrUniform = borderColorSpread < 22 && palette.length <= 5;

  return {
    palette,
    topBg: avgGroup(topSamples),
    bottomBg: avgGroup(bottomSamples),
    leftBg: avgGroup(leftSamples),
    rightBg: avgGroup(rightSamples),
    diagnosis: {
      isWhiteOrUniform,
      borderColorSpread,
      avgLuma: globalAvg.luma,
      clusterCount: palette.length,
    },
  };
}

/**
 * Diagnose whether an image has a white/uniform studio background or a complex non-white background.
 */
export function diagnoseBackgroundType(
  data: Uint8ClampedArray,
  w: number,
  h: number,
): BackgroundDiagnosis {
  return sampleBorderPalette(data, w, h).diagnosis;
}

function getSpatialBgAt(
  x: number,
  y: number,
  w: number,
  h: number,
  topBg: RgbSample,
  bottomBg: RgbSample,
  leftBg: RgbSample,
  rightBg: RgbSample,
): RgbSample {
  const u = w > 1 ? x / (w - 1) : 0.5;
  const v = h > 1 ? y / (h - 1) : 0.5;
  const r = 0.5 * ((1 - v) * topBg.r + v * bottomBg.r + (1 - u) * leftBg.r + u * rightBg.r);
  const g = 0.5 * ((1 - v) * topBg.g + v * bottomBg.g + (1 - u) * leftBg.g + u * rightBg.g);
  const b = 0.5 * ((1 - v) * topBg.b + v * bottomBg.b + (1 - u) * leftBg.b + u * rightBg.b);
  return makeSample(r, g, b);
}

/**
 * Remove disconnected small foreground islands ("traces") outside the main subject component.
 */
function removeDisconnectedForegroundIslands(
  fgMask: Uint8Array,
  w: number,
  h: number,
  keepOnlyCentralMain = false,
): void {
  const total = w * h;
  const labels = new Int32Array(total);
  const compSizes: number[] = [0];
  const compCenterScore: number[] = [0];
  const queue = new Int32Array(total);
  let currentLabel = 0;
  let maxCompSize = 0;
  let bestLabel = 0;
  let bestScore = -1;

  const cxMid = w * 0.5;
  const cyMid = h * 0.5;
  const normDist = Math.max(1, Math.sqrt(cxMid * cxMid + cyMid * cyMid));

  for (let i = 0; i < total; i++) {
    if (fgMask[i] === 0 || labels[i] !== 0) continue;
    currentLabel++;
    let head = 0;
    let tail = 0;
    queue[tail++] = i;
    labels[i] = currentLabel;
    let size = 0;
    let sumX = 0;
    let sumY = 0;

    while (head < tail) {
      const curr = queue[head++];
      size++;
      const cx = curr % w;
      const cy = (curr - cx) / w;
      sumX += cx;
      sumY += cy;

      if (cx > 0) {
        const n = curr - 1;
        if (fgMask[n] === 1 && labels[n] === 0) {
          labels[n] = currentLabel;
          queue[tail++] = n;
        }
      }
      if (cx < w - 1) {
        const n = curr + 1;
        if (fgMask[n] === 1 && labels[n] === 0) {
          labels[n] = currentLabel;
          queue[tail++] = n;
        }
      }
      if (cy > 0) {
        const n = curr - w;
        if (fgMask[n] === 1 && labels[n] === 0) {
          labels[n] = currentLabel;
          queue[tail++] = n;
        }
      }
      if (cy < h - 1) {
        const n = curr + w;
        if (fgMask[n] === 1 && labels[n] === 0) {
          labels[n] = currentLabel;
          queue[tail++] = n;
        }
      }
    }

    compSizes[currentLabel] = size;
    if (size > maxCompSize) maxCompSize = size;

    const avgX = sumX / size;
    const avgY = sumY / size;
    const distFromCenter = Math.sqrt((avgX - cxMid) ** 2 + (avgY - cyMid) ** 2) / normDist;
    const centrality = Math.max(0.15, 1.15 - distFromCenter);
    const score = size * centrality;
    compCenterScore[currentLabel] = score;
    if (score > bestScore) {
      bestScore = score;
      bestLabel = currentLabel;
    }
  }

  if (maxCompSize === 0) return;
  const minKeepSize = keepOnlyCentralMain
    ? Math.max(24, Math.floor(maxCompSize * 0.12))
    : Math.max(16, Math.floor(maxCompSize * 0.035));

  for (let i = 0; i < total; i++) {
    const lbl = labels[i];
    if (lbl === 0) continue;
    if (lbl !== bestLabel && compSizes[lbl] < minKeepSize) {
      fgMask[i] = 0;
    }
  }
}

/**
 * Fill enclosed background holes inside the main foreground subject so complex backgrounds
 * never punch Swiss-cheese holes inside the product body.
 */
function fillEnclosedForegroundHoles(fgMask: Uint8Array, w: number, h: number): void {
  const total = w * h;
  const exteriorBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const seedBg = (idx: number) => {
    if (fgMask[idx] === 0 && exteriorBg[idx] === 0) {
      exteriorBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    seedBg(x);
    seedBg((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    seedBg(y * w);
    seedBg(y * w + (w - 1));
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr - cx) / w;
    if (cx > 0) seedBg(curr - 1);
    if (cx < w - 1) seedBg(curr + 1);
    if (cy > 0) seedBg(curr - w);
    if (cy < h - 1) seedBg(curr + w);
  }

  // Any pixel with fgMask === 0 that is NOT reachable from the exterior border is an interior hole -> fill it!
  for (let i = 0; i < total; i++) {
    if (fgMask[i] === 0 && exteriorBg[i] === 0) {
      fgMask[i] = 1;
    }
  }
}

/**
 * Point-in-polygon test for normalized polygon coordinates.
 */
function isPointInNormalizedPolygon(
  nx: number,
  ny: number,
  poly: NormalizedPoint[],
): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const xi = poly[i].x;
    const yi = poly[i].y;
    const xj = poly[j].x;
    const yj = poly[j].y;
    const intersect =
      yi > ny !== yj > ny && nx < ((xj - xi) * (ny - yi)) / (yj - yi + 1e-7) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Smooth binary foreground mask using a separable 2D box filter + threshold
 * so complex-background cutouts have clean, organic contours instead of jagged teeth.
 */
function smoothForegroundSilhouette(fgMask: Uint8Array, w: number, h: number, radius: number): void {
  if (radius < 1 || w < 8 || h < 8) return;
  const total = w * h;
  const temp = new Float32Array(total);

  // Horizontal pass
  for (let y = 0; y < h; y++) {
    const rowOff = y * w;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      let count = 0;
      const x0 = Math.max(0, x - radius);
      const x1 = Math.min(w - 1, x + radius);
      for (let xx = x0; xx <= x1; xx++) {
        sum += fgMask[rowOff + xx];
        count++;
      }
      temp[rowOff + x] = sum / count;
    }
  }

  // Vertical pass + majority threshold
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - radius);
    const y1 = Math.min(h - 1, y + radius);
    const count = y1 - y0 + 1;
    for (let x = 0; x < w; x++) {
      let sum = 0;
      for (let yy = y0; yy <= y1; yy++) {
        sum += temp[yy * w + x];
      }
      fgMask[y * w + x] = sum / count >= 0.5 ? 1 : 0;
    }
  }
}

/**
 * Specialized Matting Engine for NON-WHITE / COMPLEX backgrounds (wooden table, shop counter,
 * colored wall, shelves, multi-colored textures).
 * Combines:
 * 1. Outer-Frame vs. Central-Core Color Distribution Contrast (Foreground Log-Likelihood)
 * 2. 2D Sobel Edge-Barrier Map (stops background propagation at the physical contour of the product)
 * 3. Optional AI Vision Polygon Trimap Guide (when available)
 * 4. Enclosed Hole Filling + Main Central Component Selection + Contour Smoothing
 */
function buildComplexBackgroundMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options: MattingOptions,
  borderPalette: RgbSample[],
): { fgMask: Uint8Array; bgDist: Float32Array } {
  const total = w * h;
  const tolerance = Math.max(10, Math.min(90, options.tolerance ?? 38));

  // 1. Sample central product core palette (x in 28%..72%, y in 22%..78%)
  // and filter to colors that are DISTINCT from the outer border palette!
  const fgPalette: RgbSample[] = [];
  const stepX = Math.max(1, Math.floor((w * 0.44) / 14));
  const stepY = Math.max(1, Math.floor((h * 0.56) / 14));
  const xStart = Math.floor(w * 0.28);
  const xEnd = Math.ceil(w * 0.72);
  const yStart = Math.floor(h * 0.22);
  const yEnd = Math.ceil(h * 0.78);

  for (let y = yStart; y < yEnd; y += stepY) {
    for (let x = xStart; x < xEnd; x += stepX) {
      const idx = (y * w + x) * 4;
      const s = makeSample(data[idx], data[idx + 1], data[idx + 2]);
      let minBorderDist = 999;
      for (let b = 0; b < borderPalette.length; b++) {
        const d = perceptualBgDistance(s.r, s.g, s.b, borderPalette[b], false);
        if (d < minBorderDist) minBorderDist = d;
      }
      // Only include central colors that are clearly distinct from the outer background frame
      if (minBorderDist > 26) {
        const exists = fgPalette.some(
          (p) => Math.abs(p.r - s.r) + Math.abs(p.g - s.g) + Math.abs(p.b - s.b) < 20,
        );
        if (!exists && fgPalette.length < 28) {
          fgPalette.push(s);
        }
      }
    }
  }

  // 2. Compute 2D Sobel Edge Magnitude Map so strong object contours act as barriers
  const lumaArr = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    const idx = i * 4;
    lumaArr[i] = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
  }

  const edgeMag = new Float32Array(total);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = y * w + x;
      const gx =
        -lumaArr[i - w - 1] +
        lumaArr[i - w + 1] -
        2 * lumaArr[i - 1] +
        2 * lumaArr[i + 1] -
        lumaArr[i + w - 1] +
        lumaArr[i + w + 1];
      const gy =
        -lumaArr[i - w - 1] -
        2 * lumaArr[i - w] -
        lumaArr[i - w + 1] +
        lumaArr[i + w - 1] +
        2 * lumaArr[i + w] +
        lumaArr[i + w + 1];
      edgeMag[i] = Math.min(255, Math.sqrt(gx * gx + gy * gy) * 0.25);
    }
  }

  // 3. Compute combined Foreground Affinity Score (`bgDist` equivalent) for every pixel
  const bgDist = new Float32Array(total);
  const poly =
    options.subjectPolygon && options.subjectPolygon.length >= 3 ? options.subjectPolygon : null;

  for (let y = 0; y < h; y++) {
    const ny = h > 1 ? y / (h - 1) : 0.5;
    const dyCenter = (ny - 0.5) / 0.48;
    for (let x = 0; x < w; x++) {
      const nx = w > 1 ? x / (w - 1) : 0.5;
      const dxCenter = (nx - 0.5) / 0.46;
      const i = y * w + x;
      const idx = i * 4;

      if (data[idx + 3] < 10) {
        bgDist[i] = 0;
        continue;
      }

      const r = data[idx];
      const g = data[idx + 1];
      const b = data[idx + 2];

      let minBgD = 999;
      for (let p = 0; p < borderPalette.length; p++) {
        const d = perceptualBgDistance(r, g, b, borderPalette[p], options.removeShadows ?? true);
        if (d < minBgD) minBgD = d;
      }

      let minFgD = 999;
      for (let p = 0; p < fgPalette.length; p++) {
        const d = perceptualBgDistance(r, g, b, fgPalette[p], false);
        if (d < minFgD) minFgD = d;
      }

      // If foreground palette is non-empty, compare distance to bg vs distance to fg
      let score = minBgD;
      if (fgPalette.length > 0) {
        // When a pixel is much closer to the central product color than to any border color, boost its foreground score
        const ratioBoost = minBgD / (minFgD + 14);
        score = minBgD * Math.min(1.85, Math.max(0.55, ratioBoost * 0.85));
      }

      // Add Sobel edge barrier bonus so sharp product contours resist background flood
      score += edgeMag[i] * 0.52;

      // Smooth spatial prior: outer 6% frame is penalized, central product zone gets a gentle protection boost
      const radialSq = dxCenter * dxCenter + dyCenter * dyCenter;
      if (radialSq > 1.25) {
        score *= 0.72;
      } else if (radialSq < 0.45) {
        score *= 1.15;
      }

      // If AI Vision Polygon is provided, use it as a strong semantic prior
      if (poly) {
        const insidePoly = isPointInNormalizedPolygon(nx, ny, poly);
        if (!insidePoly) {
          score *= 0.35; // outside AI subject polygon -> strongly pull to background
        } else {
          score *= 1.45; // inside AI subject polygon -> protect subject
        }
      }

      bgDist[i] = score;
    }
  }

  // 4. Geodesic Edge-Stopped Flood Fill from all 4 borders
  const hardThresh = tolerance * 1.18;
  const isBg = new Uint8Array(total);
  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;

  const trySeed = (idx: number) => {
    if (isBg[idx] === 0 && bgDist[idx] <= hardThresh * 1.35) {
      isBg[idx] = 1;
      queue[tail++] = idx;
    }
  };

  for (let x = 0; x < w; x++) {
    trySeed(x);
    trySeed((h - 1) * w + x);
  }
  for (let y = 1; y < h - 1; y++) {
    trySeed(y * w);
    trySeed(y * w + (w - 1));
  }

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr - cx) / w;
    const currR = data[curr * 4];
    const currG = data[curr * 4 + 1];
    const currB = data[curr * 4 + 2];

    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        if (nx < 0 || nx >= w) continue;
        const nIdx = ny * w + nx;
        if (isBg[nIdx] === 1) continue;

        // Do NOT cross a strong Sobel object contour barrier unless score is very low
        const localEdge = edgeMag[nIdx];
        if (localEdge > 36 && bgDist[nIdx] > hardThresh * 0.78) {
          continue;
        }

        const nOff = nIdx * 4;
        const stepDiff =
          Math.abs(data[nOff] - currR) +
          Math.abs(data[nOff + 1] - currG) +
          Math.abs(data[nOff + 2] - currB);

        if (
          bgDist[nIdx] <= hardThresh ||
          (stepDiff <= 26 && localEdge < 24 && bgDist[nIdx] <= hardThresh * 1.48)
        ) {
          isBg[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }
  }

  // 5. Build foreground mask, keep main central product component, fill interior holes, and smooth silhouette
  const fgMask = new Uint8Array(total);
  for (let i = 0; i < total; i++) {
    fgMask[i] = isBg[i] === 1 ? 0 : 1;
  }

  // Keep only the main central product component (wiping disconnected background tables/shelves)
  removeDisconnectedForegroundIslands(fgMask, w, h, true);

  // Fill any enclosed holes inside the product so complex background colors never eat the inside of the product
  fillEnclosedForegroundHoles(fgMask, w, h);

  // Smooth jagged contour teeth on larger images
  const smoothRadius = Math.max(1, Math.min(3, Math.round(Math.min(w, h) / 140)));
  if (w >= 80 && h >= 80) {
    smoothForegroundSilhouette(fgMask, w, h, smoothRadius);
    fillEnclosedForegroundHoles(fgMask, w, h);
  }

  return { fgMask, bgDist };
}

/**
 * 1-Click Magic Wand Background Region Eraser:
 * Flood-erases all pixels connected to (startX, startY) that have a similar color.
 */
export function computeMagicWandMask(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  startX: number,
  startY: number,
  wandTolerance = 34,
): Uint8Array {
  const total = w * h;
  const erased = new Uint8Array(total);
  const sx = Math.max(0, Math.min(w - 1, Math.round(startX)));
  const sy = Math.max(0, Math.min(h - 1, Math.round(startY)));
  const startIdx = sy * w + sx;
  const seedR = data[startIdx * 4];
  const seedG = data[startIdx * 4 + 1];
  const seedB = data[startIdx * 4 + 2];
  const seedSample = makeSample(seedR, seedG, seedB);

  const queue = new Int32Array(total);
  let head = 0;
  let tail = 0;
  erased[startIdx] = 1;
  queue[tail++] = startIdx;

  const maxDist = wandTolerance * 1.35;

  while (head < tail) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = (curr - cx) / w;

    for (let dy = -1; dy <= 1; dy++) {
      const ny = cy + dy;
      if (ny < 0 || ny >= h) continue;
      for (let dx = -1; dx <= 1; dx++) {
        if (dx === 0 && dy === 0) continue;
        const nx = cx + dx;
        if (nx < 0 || nx >= w) continue;
        const nIdx = ny * w + nx;
        if (erased[nIdx] === 1) continue;

        const off = nIdx * 4;
        const d = perceptualBgDistance(data[off], data[off + 1], data[off + 2], seedSample, true);
        if (d <= maxDist) {
          erased[nIdx] = 1;
          queue[tail++] = nIdx;
        }
      }
    }
  }

  return erased;
}

/**
 * Multi-stage Studio Matting & Anti-Trace De-Halo Engine.
 * Automatically routes white/uniform backgrounds to the ultra-sharp flood-fill pipeline
 * and non-white/complex backgrounds to the Edge-Barrier + Core-Protected Complex Matting pipeline.
 */
export function processSubjectMatting(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  options: MattingOptions,
): void {
  const total = w * h;
  if (total === 0 || data.length < total * 4) return;

  const tolerance = Math.max(5, Math.min(95, options.tolerance ?? 38));
  const removeShadows = options.removeShadows ?? true;
  const removeFloatingTraces = options.removeFloatingTraces ?? true;
  const edgeChoke = Math.max(0, Math.min(4, options.edgeChoke ?? 1.5));
  const decontaminate = Math.max(0, Math.min(1, options.decontaminateColors ?? 0.85));

  const { palette, topBg, bottomBg, leftBg, rightBg, diagnosis } = sampleBorderPalette(data, w, h);

  // Determine effective mode: if 'auto', inspect whether the background is white/uniform vs complex non-white
  const rawMode = options.mode ?? 'auto';
  const effectiveMode: 'flood' | 'complex' | 'global_holes' =
    rawMode === 'auto'
      ? diagnosis.isWhiteOrUniform && !options.subjectPolygon
        ? 'flood'
        : 'complex'
      : rawMode;

  const hardThresh = tolerance * 1.15;
  const softWidth = Math.max(12, tolerance * 0.48);

  let fgMask: Uint8Array;
  let bgDist: Float32Array;

  if (effectiveMode === 'complex') {
    const complexRes = buildComplexBackgroundMask(data, w, h, options, palette);
    fgMask = complexRes.fgMask;
    bgDist = complexRes.bgDist;
  } else {
    // Proven White / Uniform Studio Background Pipeline
    bgDist = new Float32Array(total);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const idx = i * 4;
        if (data[idx + 3] < 10) {
          bgDist[i] = 0;
          continue;
        }
        const r = data[idx];
        const g = data[idx + 1];
        const b = data[idx + 2];

        const spatialBg = getSpatialBgAt(x, y, w, h, topBg, bottomBg, leftBg, rightBg);
        let minD = perceptualBgDistance(r, g, b, spatialBg, removeShadows);

        for (let p = 0; p < palette.length; p++) {
          const d = perceptualBgDistance(r, g, b, palette[p], removeShadows);
          if (d < minD) minD = d;
        }
        bgDist[i] = minD;
      }
    }

    const isBg = new Uint8Array(total);

    if (effectiveMode === 'global_holes') {
      for (let i = 0; i < total; i++) {
        if (bgDist[i] <= hardThresh) {
          isBg[i] = 1;
        }
      }
    } else {
      const queue = new Int32Array(total);
      let head = 0;
      let tail = 0;

      const trySeed = (idx: number) => {
        if (isBg[idx] === 0 && bgDist[idx] <= hardThresh * 1.18) {
          isBg[idx] = 1;
          queue[tail++] = idx;
        }
      };

      for (let x = 0; x < w; x++) {
        trySeed(x);
        trySeed((h - 1) * w + x);
      }
      for (let y = 1; y < h - 1; y++) {
        trySeed(y * w);
        trySeed(y * w + (w - 1));
      }

      while (head < tail) {
        const curr = queue[head++];
        const cx = curr % w;
        const cy = (curr - cx) / w;
        const currR = data[curr * 4];
        const currG = data[curr * 4 + 1];
        const currB = data[curr * 4 + 2];

        for (let dy = -1; dy <= 1; dy++) {
          const ny = cy + dy;
          if (ny < 0 || ny >= h) continue;
          for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nx = cx + dx;
            if (nx < 0 || nx >= w) continue;
            const nIdx = ny * w + nx;
            if (isBg[nIdx] === 1) continue;

            const nOff = nIdx * 4;
            const stepDiff =
              Math.abs(data[nOff] - currR) +
              Math.abs(data[nOff + 1] - currG) +
              Math.abs(data[nOff + 2] - currB);

            if (
              bgDist[nIdx] <= hardThresh ||
              (stepDiff <= 22 && bgDist[nIdx] <= hardThresh * 1.42)
            ) {
              isBg[nIdx] = 1;
              queue[tail++] = nIdx;
            }
          }
        }
      }
    }

    fgMask = new Uint8Array(total);
    for (let i = 0; i < total; i++) {
      fgMask[i] = isBg[i] === 1 ? 0 : 1;
    }

    if (removeFloatingTraces) {
      removeDisconnectedForegroundIslands(fgMask, w, h, false);
    }
  }

  // Compute distance-to-background on foreground boundary for Edge Choke & Smooth Alpha Feathering
  const distToBg = new Float32Array(total);
  for (let i = 0; i < total; i++) {
    distToBg[i] = fgMask[i] === 0 ? 0 : 10;
  }

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (distToBg[i] === 0) continue;
      let d = distToBg[i];
      if (x > 0) d = Math.min(d, distToBg[i - 1] + 1);
      if (y > 0) d = Math.min(d, distToBg[i - w] + 1);
      if (x > 0 && y > 0) d = Math.min(d, distToBg[i - w - 1] + 1.414);
      if (x < w - 1 && y > 0) d = Math.min(d, distToBg[i - w + 1] + 1.414);
      distToBg[i] = d;
    }
  }
  for (let y = h - 1; y >= 0; y--) {
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (distToBg[i] === 0) continue;
      let d = distToBg[i];
      if (x < w - 1) d = Math.min(d, distToBg[i + 1] + 1);
      if (y < h - 1) d = Math.min(d, distToBg[i + w] + 1);
      if (x < w - 1 && y < h - 1) d = Math.min(d, distToBg[i + w + 1] + 1.414);
      if (x > 0 && y < h - 1) d = Math.min(d, distToBg[i + w - 1] + 1.414);
      distToBg[i] = d;
    }
  }

  // Apply Edge Choke, Anti-Aliased Alpha Ramp, and Color Decontamination (De-Fringing)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const idx = i * 4;

      if (fgMask[i] === 0) {
        data[idx + 3] = 0;
        continue;
      }

      const dEdge = distToBg[i];
      const origAlpha = data[idx + 3] / 255;

      let colorFactor = 1;
      if (dEdge <= 4 && bgDist[i] < hardThresh + softWidth) {
        colorFactor = Math.max(0, Math.min(1, (bgDist[i] - hardThresh * 0.85) / softWidth));
      }

      let spatialFactor = 1;
      if (edgeChoke > 0) {
        const featherZone = effectiveMode === 'complex' ? 1.85 : 1.35;
        if (dEdge <= edgeChoke * 0.72) {
          spatialFactor = 0;
        } else if (dEdge < edgeChoke * 0.72 + featherZone) {
          spatialFactor = (dEdge - edgeChoke * 0.72) / featherZone;
        }
      }

      const finalAlphaNorm = Math.max(
        0,
        Math.min(
          1,
          origAlpha * (effectiveMode === 'complex' ? spatialFactor : Math.min(colorFactor, spatialFactor)),
        ),
      );
      const newAlpha = Math.round(finalAlphaNorm * 255);
      data[idx + 3] = newAlpha;

      if (newAlpha > 8 && newAlpha < 248 && decontaminate > 0 && dEdge <= 3.5) {
        const localBg = getSpatialBgAt(x, y, w, h, topBg, bottomBg, leftBg, rightBg);
        const a = Math.max(0.22, finalAlphaNorm);
        const bgWeight = (1 - a) * decontaminate;

        const rClean = Math.max(
          0,
          Math.min(255, (data[idx] - bgWeight * localBg.r) / (1 - bgWeight)),
        );
        const gClean = Math.max(
          0,
          Math.min(255, (data[idx + 1] - bgWeight * localBg.g) / (1 - bgWeight)),
        );
        const bClean = Math.max(
          0,
          Math.min(255, (data[idx + 2] - bgWeight * localBg.b) / (1 - bgWeight)),
        );

        data[idx] = Math.round(rClean);
        data[idx + 1] = Math.round(gClean);
        data[idx + 2] = Math.round(bClean);
      }
    }
  }
}

/**
 * Compute tight bounding box of non-transparent subject pixels.
 */
export function computeSubjectBounds(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  alphaThreshold = 24,
): SubjectBounds {
  let minX = w;
  let minY = h;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const a = data[(y * w + x) * 4 + 3];
      if (a >= alphaThreshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < minX || maxY < minY) {
    return { minX: 0, minY: 0, maxX: w - 1, maxY: h - 1, width: w, height: h };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: Math.max(1, maxX - minX + 1),
    height: Math.max(1, maxY - minY + 1),
  };
}
