import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Eraser,
  ImagePlus,
  Layers,
  Palette,
  Plus,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Star,
  Wand2,
  X,
  ZoomIn,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import {
  BackgroundDiagnosis,
  computeMagicWandMask,
  computeSubjectBounds,
  diagnoseBackgroundType,
  MattingOptions,
  processSubjectMatting,
} from '../../lib/imageMatting';
import { ProductColorOption } from '../../types';
import { ImageZoomLightbox } from '../ImageZoomLightbox';

export interface OkwinSceneConfig {
  id: string;
  label: string;
  promptDescription: string;
  bgPrimary: string;
  bgSecondary: string;
  bgAccent: string;
  podiumColor: string;
  glowColor: string;
  lightAngle: 'top-left' | 'center' | 'top-right';
  floorStyle: 'podium' | 'reflection' | 'marble' | 'neon-grid';
  scale?: number;
  offsetY?: number;
}

export const OKWIN_PRESET_PROMPTS: OkwinSceneConfig[] = [
  {
    id: 'studio-blanc',
    label: 'Studio Blanc Pur E-Commerce',
    promptDescription: 'Fond blanc pur professionnel type Apple/Amazon avec podium 3D et ombre portée douce',
    bgPrimary: '#ffffff',
    bgSecondary: '#f1f5f9',
    bgAccent: '#cbd5e1',
    podiumColor: '#f8fafc',
    glowColor: '#ffffff',
    lightAngle: 'center',
    floorStyle: 'podium',
  },
  {
    id: 'tech-neon',
    label: 'Studio Tech & Néon Bleu 2Frères',
    promptDescription: 'Fond carbone profond avec double halo lumineux bleu électrique et reflet miroir',
    bgPrimary: '#090d16',
    bgSecondary: '#1e3a8a',
    bgAccent: '#38bdf8',
    podiumColor: '#0f172a',
    glowColor: '#2563eb',
    lightAngle: 'top-left',
    floorStyle: 'reflection',
  },
  {
    id: 'luxe-or',
    label: 'Podium Luxe Noir & Or',
    promptDescription: 'Ambiance haut de gamme noir anthracite, éclairage doré chaud et socle marbre',
    bgPrimary: '#09090b',
    bgSecondary: '#27272a',
    bgAccent: '#f59e0b',
    podiumColor: '#18181b',
    glowColor: '#fbbf24',
    lightAngle: 'top-right',
    floorStyle: 'marble',
  },
  {
    id: 'gaming-rgb',
    label: 'Setup Gaming RGB Cyber',
    promptDescription: 'Arrière-plan gaming néon violet & cyan avec grille perspective laser 3D',
    bgPrimary: '#0f051d',
    bgSecondary: '#3b0764',
    bgAccent: '#ec4899',
    podiumColor: '#1e1b4b',
    glowColor: '#a855f7',
    lightAngle: 'center',
    floorStyle: 'neon-grid',
  },
  {
    id: 'nature-bois',
    label: 'Table Bois & Lumière Naturelle',
    promptDescription: 'Fond beige crème lumineux avec surface bois chaud et éclairage naturel doux',
    bgPrimary: '#fefaf4',
    bgSecondary: '#f3e5d0',
    bgAccent: '#d97706',
    podiumColor: '#d6bfa3',
    glowColor: '#fde68a',
    lightAngle: 'top-left',
    floorStyle: 'podium',
  },
  {
    id: 'promo-flash',
    label: 'Studio Promo Flash Rouge',
    promptDescription: 'Fond dynamique rouge performance & halo orange pour publicités haute conversion',
    bgPrimary: '#450a0a',
    bgSecondary: '#991b1b',
    bgAccent: '#f97316',
    podiumColor: '#7f1d1d',
    glowColor: '#ef4444',
    lightAngle: 'center',
    floorStyle: 'podium',
  },
  {
    id: 'glacier-3d',
    label: 'Minimaliste Bleu Glacier 3D',
    promptDescription: 'Dégradé bleu glacier apaisant avec podium cylindrique 3D moderne',
    bgPrimary: '#f0f9ff',
    bgSecondary: '#bae6fd',
    bgAccent: '#0284c7',
    podiumColor: '#e0f2fe',
    glowColor: '#38bdf8',
    lightAngle: 'top-right',
    floorStyle: 'podium',
  },
  {
    id: 'emeraude-pro',
    label: 'Studio Émeraude Confiance',
    promptDescription: 'Fond vert émeraude profond avec éclairage studio blanc chaud et reflet vitré',
    bgPrimary: '#022c22',
    bgSecondary: '#065f46',
    bgAccent: '#34d399',
    podiumColor: '#064e3b',
    glowColor: '#10b981',
    lightAngle: 'top-left',
    floorStyle: 'reflection',
  },
];

export const PRESET_PRODUCT_COLORS: ProductColorOption[] = [
  { name: 'Noir Intense', hex: '#111827' },
  { name: 'Blanc Pur', hex: '#F8FAFC' },
  { name: 'Bleu Royal', hex: '#1D4ED8' },
  { name: 'Gris Titane', hex: '#64748B' },
  { name: 'Argent / Silver', hex: '#CBD5E1' },
  { name: 'Or / Gold', hex: '#D97706' },
  { name: 'Rouge', hex: '#DC2626' },
  { name: 'Vert Émeraude', hex: '#15803D' },
  { name: 'Rose', hex: '#EC4899' },
  { name: 'Violet', hex: '#7C3AED' },
];

interface ProductColorsEditorProps {
  colors: ProductColorOption[];
  onChange: (nextColors: ProductColorOption[]) => void;
  availableImages?: string[];
}

export function ProductColorsEditor({
  colors,
  onChange,
  availableImages = [],
}: ProductColorsEditorProps) {
  const [customName, setCustomName] = useState('');
  const [customHex, setCustomHex] = useState('#1d4ed8');

  const hasColor = (name: string) =>
    colors.some((c) => c.name.toLowerCase() === name.toLowerCase());

  const togglePresetColor = (preset: ProductColorOption) => {
    if (hasColor(preset.name)) {
      onChange(colors.filter((c) => c.name.toLowerCase() !== preset.name.toLowerCase()));
    } else {
      onChange([...colors, { ...preset }]);
    }
  };

  const handleAddCustomColor = () => {
    const trimmed = customName.trim();
    if (!trimmed) return;
    if (hasColor(trimmed)) return;
    onChange([...colors, { name: trimmed, hex: customHex }]);
    setCustomName('');
  };

  return (
    <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/70 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Palette className="w-4 h-4 text-blue-700" />
          <span className="text-xs font-bold text-slate-900">
            Couleurs disponibles pour ce produit ({colors.length})
          </span>
        </div>
        <span className="text-[11px] text-slate-500">
          Le client pourra choisir sa couleur lors de la commande
        </span>
      </div>

      {/* Quick Preset Color Chips */}
      <div className="flex flex-wrap gap-1.5">
        {PRESET_PRODUCT_COLORS.map((preset) => {
          const active = hasColor(preset.name);
          return (
            <button
              key={preset.name}
              type="button"
              onClick={() => togglePresetColor(preset)}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                active
                  ? 'bg-blue-700 text-white border-blue-700 shadow-sm'
                  : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
              }`}
            >
              <span
                className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                style={{ backgroundColor: preset.hex }}
              />
              <span>{preset.name}</span>
              {active && <Check className="w-3 h-3" />}
            </button>
          );
        })}
      </div>

      {/* Custom Color Adder */}
      <div className="flex flex-wrap items-center gap-2 pt-1">
        <input
          type="color"
          value={customHex}
          onChange={(e) => setCustomHex(e.target.value)}
          className="w-8 h-8 rounded cursor-pointer border border-slate-300 bg-white p-0.5"
          title="Choisir la teinte"
        />
        <input
          value={customName}
          onChange={(e) => setCustomName(e.target.value)}
          placeholder="Ajouter une autre couleur (ex. Bleu Nuit, Beige...)"
          className="flex-1 min-w-[180px] px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
        />
        <button
          type="button"
          onClick={handleAddCustomColor}
          disabled={!customName.trim()}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white text-xs font-semibold"
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Ajouter couleur</span>
        </button>
      </div>

      {/* Selected Colors List (with optional image association) */}
      {colors.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-200/80">
          {colors.map((c, idx) => (
            <div
              key={`${c.name}-${idx}`}
              className="inline-flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 text-xs shadow-2xs"
            >
              <span
                className="w-4 h-4 rounded-full border border-slate-300 shrink-0"
                style={{ backgroundColor: c.hex }}
              />
              <span className="font-semibold text-slate-800">{c.name}</span>
              {availableImages.length > 1 && (
                <select
                  value={c.imageUrl || ''}
                  onChange={(e) => {
                    const next = [...colors];
                    next[idx] = { ...next[idx], imageUrl: e.target.value || undefined };
                    onChange(next);
                  }}
                  className="text-[11px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-600"
                  title="Associer une photo à cette couleur"
                >
                  <option value="">Photo auto</option>
                  {availableImages.map((imgUrl, i) => (
                    <option key={imgUrl} value={imgUrl}>
                      Photo #{i + 1}
                    </option>
                  ))}
                </select>
              )}
              <button
                type="button"
                onClick={() => onChange(colors.filter((_, i) => i !== idx))}
                className="text-slate-400 hover:text-red-600"
                title="Retirer cette couleur"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper: Remove background from product image using Multi-Stage Studio Matting & Anti-Trace De-Halo Engine,
// apply any optional manual eraser/restore mask, and auto-crop to tight subject bounds for centered podium placement.
function extractSubjectCanvas(
  img: HTMLImageElement,
  removeBg: boolean,
  mattingOpts: MattingOptions,
  manualMaskCanvas?: HTMLCanvasElement | null,
): HTMLCanvasElement {
  const w = img.naturalWidth || img.width || 800;
  const h = img.naturalHeight || img.height || 800;
  const off = document.createElement('canvas');
  off.width = w;
  off.height = h;
  const ctx = off.getContext('2d');
  if (!ctx) return off;

  ctx.drawImage(img, 0, 0, w, h);
  if (!removeBg) return off;

  try {
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    processSubjectMatting(data, w, h, mattingOpts);

    // Apply optional manual touch-up mask (Red channel = force erase, Green channel = force restore from original)
    if (manualMaskCanvas && manualMaskCanvas.width === w && manualMaskCanvas.height === h) {
      const maskCtx = manualMaskCanvas.getContext('2d');
      if (maskCtx) {
        const maskData = maskCtx.getImageData(0, 0, w, h).data;
        // Also read original image pixels for restore strokes
        const origCanvas = document.createElement('canvas');
        origCanvas.width = w;
        origCanvas.height = h;
        const origCtx = origCanvas.getContext('2d');
        origCtx?.drawImage(img, 0, 0, w, h);
        const origData = origCtx?.getImageData(0, 0, w, h).data;

        for (let i = 0; i < data.length; i += 4) {
          const eraseWeight = maskData[i]; // R = erase
          const restoreWeight = maskData[i + 1]; // G = restore
          if (eraseWeight > 10) {
            const factor = Math.max(0, 1 - eraseWeight / 255);
            data[i + 3] = Math.round(data[i + 3] * factor);
          } else if (restoreWeight > 10 && origData) {
            data[i] = origData[i];
            data[i + 1] = origData[i + 1];
            data[i + 2] = origData[i + 2];
            data[i + 3] = Math.max(data[i + 3], restoreWeight);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Auto-trim transparent borders so the isolated product sits centered on the 3D studio podium
    const bounds = computeSubjectBounds(data, w, h, 22);
    if (bounds.width > 12 && bounds.height > 12 && (bounds.width < w || bounds.height < h)) {
      const pad = Math.round(Math.max(bounds.width, bounds.height) * 0.04);
      const sx = Math.max(0, bounds.minX - pad);
      const sy = Math.max(0, bounds.minY - pad);
      const sw = Math.min(w - sx, bounds.width + pad * 2);
      const sh = Math.min(h - sy, bounds.height + pad * 2);

      const trimmed = document.createElement('canvas');
      trimmed.width = sw;
      trimmed.height = sh;
      const tCtx = trimmed.getContext('2d');
      if (tCtx) {
        tCtx.drawImage(off, sx, sy, sw, sh, 0, 0, sw, sh);
        return trimmed;
      }
    }
  } catch {
    // Fallback if CORS prevents getImageData
  }
  return off;
}

// Helper: Render complete 1000x1000 Studio Product Photo with scene config
function renderOkwinStudioCanvas(
  subjectCanvas: HTMLCanvasElement,
  scene: OkwinSceneConfig,
  removeBg: boolean,
): string {
  const size = 1000;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (!ctx) return '';

  // 1. Background Studio Gradient
  const grad =
    scene.lightAngle === 'top-left'
      ? ctx.createLinearGradient(0, 0, size, size)
      : scene.lightAngle === 'top-right'
      ? ctx.createLinearGradient(size, 0, 0, size)
      : ctx.createRadialGradient(
          size * 0.5,
          size * 0.38,
          size * 0.08,
          size * 0.5,
          size * 0.5,
          size * 0.78,
        );

  grad.addColorStop(0, scene.bgSecondary || '#1e3a8a');
  grad.addColorStop(1, scene.bgPrimary || '#0f172a');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);

  // 2. Ambient Back Glow / Halo behind product
  const glowGrad = ctx.createRadialGradient(
    size * 0.5,
    size * 0.44,
    size * 0.04,
    size * 0.5,
    size * 0.44,
    size * 0.46,
  );
  glowGrad.addColorStop(0, `${scene.glowColor || '#3b82f6'}55`);
  glowGrad.addColorStop(0.55, `${scene.bgAccent || '#38bdf8'}22`);
  glowGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = glowGrad;
  ctx.fillRect(0, 0, size, size);

  // 3. Floor / Podium / Neon Grid
  const floorY = size * 0.73;
  if (scene.floorStyle === 'neon-grid') {
    ctx.save();
    ctx.strokeStyle = `${scene.bgAccent || '#ec4899'}44`;
    ctx.lineWidth = 2;
    for (let y = floorY; y < size; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(size, y);
      ctx.stroke();
    }
    for (let x = -size * 0.4; x <= size * 1.4; x += 90) {
      ctx.beginPath();
      ctx.moveTo(size * 0.5, floorY - 40);
      ctx.lineTo(x, size);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Draw 3D Cylindrical Podium
  ctx.save();
  const podiumW = size * 0.64;
  const podiumH = size * 0.11;
  const podiumX = size * 0.5;
  const podiumY = size * 0.78;

  // Podium base side
  ctx.fillStyle = scene.podiumColor || '#1e293b';
  ctx.beginPath();
  ctx.ellipse(podiumX, podiumY + 34, podiumW * 0.5, podiumH * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Podium top surface
  const topGrad = ctx.createLinearGradient(
    podiumX - podiumW * 0.5,
    podiumY,
    podiumX + podiumW * 0.5,
    podiumY,
  );
  topGrad.addColorStop(0, scene.podiumColor || '#1e293b');
  topGrad.addColorStop(0.5, scene.bgSecondary || '#334155');
  topGrad.addColorStop(1, scene.podiumColor || '#1e293b');
  ctx.fillStyle = topGrad;
  ctx.beginPath();
  ctx.ellipse(podiumX, podiumY, podiumW * 0.5, podiumH * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rim accent line on podium
  ctx.strokeStyle = `${scene.bgAccent || '#38bdf8'}66`;
  ctx.lineWidth = 3;
  ctx.stroke();
  ctx.restore();

  // 4. Soft Contact Shadow under product
  ctx.save();
  const shadowGrad = ctx.createRadialGradient(
    size * 0.5,
    podiumY - 4,
    10,
    size * 0.5,
    podiumY - 4,
    podiumW * 0.36,
  );
  shadowGrad.addColorStop(0, 'rgba(0,0,0,0.52)');
  shadowGrad.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = shadowGrad;
  ctx.beginPath();
  ctx.ellipse(size * 0.5, podiumY - 4, podiumW * 0.36, podiumH * 0.28, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();

  // 5. Draw Product Subject (with optional reflection & studio drop shadow)
  const scaleFactor = scene.scale || 1;
  const offsetY = scene.offsetY || 0;
  const maxBox = size * 0.64 * scaleFactor;
  const sw = subjectCanvas.width || 800;
  const sh = subjectCanvas.height || 800;
  const ratio = Math.min(maxBox / sw, maxBox / sh);
  const drawW = sw * ratio;
  const drawH = sh * ratio;
  const drawX = (size - drawW) / 2;
  const drawY = podiumY - drawH + 14 + offsetY;

  // Floor reflection
  if (scene.floorStyle === 'reflection') {
    ctx.save();
    ctx.translate(0, (podiumY + 12) * 2);
    ctx.scale(1, -1);
    ctx.globalAlpha = 0.16;
    ctx.drawImage(subjectCanvas, drawX, drawY, drawW, drawH);
    ctx.restore();
  }

  ctx.save();
  ctx.shadowColor = 'rgba(0, 0, 0, 0.38)';
  ctx.shadowBlur = 32;
  ctx.shadowOffsetY = 16;

  if (!removeBg) {
    // Rounded studio card framing if original background is kept
    const r = 36;
    ctx.beginPath();
    ctx.roundRect(drawX, drawY, drawW, drawH, r);
    ctx.clip();
  }

  ctx.drawImage(subjectCanvas, drawX, drawY, drawW, drawH);
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.94);
}

interface OkwinImageStudioProps {
  sourceImageUrl: string;
  productName?: string;
  onSourceImageUploaded?: (url: string) => void;
  onAddGeneratedImages: (urls: string[]) => void;
  onSetPrimaryImage?: (url: string) => void;
}

export function OkwinImageStudio({
  sourceImageUrl,
  productName = 'Produit 2Frères Phone',
  onSourceImageUploaded,
  onAddGeneratedImages,
  onSetPrimaryImage,
}: OkwinImageStudioProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(OKWIN_PRESET_PROMPTS[0].id);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [mattingMode, setMattingMode] = useState<'auto' | 'complex' | 'flood' | 'global_holes'>('auto');
  const [bgDiagnosis, setBgDiagnosis] = useState<BackgroundDiagnosis | null>(null);
  const [subjectPolygon, setSubjectPolygon] = useState<{ x: number; y: number }[] | undefined>(
    undefined,
  );
  const [analyzingSubject, setAnalyzingSubject] = useState<boolean>(false);
  const [removeShadows, setRemoveShadows] = useState<boolean>(true);
  const [tolerance, setTolerance] = useState<number>(38);
  const [edgeChoke, setEdgeChoke] = useState<number>(1.8);
  const [generating, setGenerating] = useState<boolean>(false);
  const [savingUrls, setSavingUrls] = useState<boolean>(false);
  const [uploadingSource, setUploadingSource] = useState<boolean>(false);
  const [previews, setPreviews] = useState<{ label: string; dataUrl: string }[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  // Manual Eraser / Magic Wand / Restore Touch-Up Studio state
  const [showEraserModal, setShowEraserModal] = useState<boolean>(false);
  const [brushMode, setBrushMode] = useState<'wand' | 'erase' | 'restore'>('wand');
  const [brushSize, setBrushSize] = useState<number>(28);
  const [wandTolerance, setWandTolerance] = useState<number>(32);
  const [isPainting, setIsPainting] = useState<boolean>(false);
  const [maskRevision, setMaskRevision] = useState<number>(0);

  const loadedImgRef = useRef<HTMLImageElement | null>(null);
  const manualMaskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const editorPreviewCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const activeScenesRef = useRef<OkwinSceneConfig[]>([]);

  const selectedPreset =
    OKWIN_PRESET_PROMPTS.find((p) => p.id === selectedPresetId) || OKWIN_PRESET_PROMPTS[0];

  // Generate 4 studio variations from preset or custom scenes
  const buildVariationsFromBaseScene = (base: OkwinSceneConfig): OkwinSceneConfig[] => [
    { ...base, label: `${base.label} · Vue Principale`, scale: 1.0, offsetY: 0 },
    {
      ...base,
      label: `${base.label} · Zoom Détail Pro`,
      scale: 1.14,
      offsetY: 10,
      lightAngle: base.lightAngle === 'center' ? 'top-left' : 'center',
    },
    {
      ...base,
      label: `${base.label} · Reflet Miroir Studio`,
      scale: 0.95,
      offsetY: -8,
      floorStyle: 'reflection',
      lightAngle: 'top-right',
    },
    {
      ...base,
      label: `${base.label} · Halo Haute Conversion`,
      scale: 1.05,
      offsetY: 0,
      bgPrimary: base.bgSecondary,
      bgSecondary: base.bgPrimary,
    },
  ];

  const getMattingOptions = (): MattingOptions => ({
    tolerance,
    mode: mattingMode,
    removeShadows,
    removeFloatingTraces: true,
    edgeChoke,
    decontaminateColors: 0.92,
    subjectPolygon,
  });

  const generateFromScenes = (scenes: OkwinSceneConfig[]) => {
    const img = loadedImgRef.current;
    if (!img) return;
    activeScenesRef.current = scenes;
    const subjectCanvas = extractSubjectCanvas(
      img,
      removeBg,
      getMattingOptions(),
      manualMaskCanvasRef.current,
    );
    const rendered = scenes.map((sc) => ({
      label: sc.label,
      dataUrl: renderOkwinStudioCanvas(subjectCanvas, sc, removeBg),
    }));
    setPreviews(rendered);
  };

  // Load source image whenever sourceImageUrl changes
  useEffect(() => {
    if (!sourceImageUrl) {
      setPreviews([]);
      setBgDiagnosis(null);
      setSubjectPolygon(undefined);
      manualMaskCanvasRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImgRef.current = img;
      setSubjectPolygon(undefined);
      const w = img.naturalWidth || img.width || 800;
      const h = img.naturalHeight || img.height || 800;
      // Diagnose whether background is uniform/white or complex/real-world photo
      try {
        const diagCanvas = document.createElement('canvas');
        diagCanvas.width = w;
        diagCanvas.height = h;
        const dCtx = diagCanvas.getContext('2d');
        if (dCtx) {
          dCtx.drawImage(img, 0, 0, w, h);
          const diagData = dCtx.getImageData(0, 0, w, h).data;
          const diag = diagnoseBackgroundType(diagData, w, h);
          setBgDiagnosis(diag);
        }
      } catch {
        setBgDiagnosis(null);
      }

      // Initialize blank manual mask canvas matching image dimensions
      const mask = document.createElement('canvas');
      mask.width = w;
      mask.height = h;
      manualMaskCanvasRef.current = mask;
      const scenes = buildVariationsFromBaseScene(selectedPreset);
      activeScenesRef.current = scenes;
      generateFromScenes(scenes);
    };
    img.src = sourceImageUrl;
  }, [sourceImageUrl]);

  // Re-render whenever preset or anti-trace matting controls change
  useEffect(() => {
    if (!loadedImgRef.current) return;
    const scenes =
      activeScenesRef.current.length > 0 && customPrompt.trim()
        ? activeScenesRef.current
        : buildVariationsFromBaseScene(selectedPreset);
    generateFromScenes(scenes);
  }, [
    selectedPresetId,
    removeBg,
    mattingMode,
    removeShadows,
    tolerance,
    edgeChoke,
    maskRevision,
    subjectPolygon,
  ]);

  // Render live checkerboard cutout preview inside the manual eraser / magic wand modal
  useEffect(() => {
    if (!showEraserModal || !loadedImgRef.current || !editorPreviewCanvasRef.current) return;
    const img = loadedImgRef.current;
    const canvas = editorPreviewCanvasRef.current;
    const w = img.naturalWidth || img.width || 800;
    const h = img.naturalHeight || img.height || 800;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Draw high-contrast checkerboard background so any remaining trace is immediately visible
    const tile = Math.max(12, Math.round(Math.max(w, h) / 32));
    for (let y = 0; y < h; y += tile) {
      for (let x = 0; x < w; x += tile) {
        const isDark = ((x / tile + y / tile) & 1) === 0;
        ctx.fillStyle = isDark ? '#1e293b' : '#334155';
        ctx.fillRect(x, y, tile, tile);
      }
    }

    // Draw isolated subject without auto-crop so user paints at exact image coordinates
    const rawOff = document.createElement('canvas');
    rawOff.width = w;
    rawOff.height = h;
    const rCtx = rawOff.getContext('2d');
    if (rCtx) {
      rCtx.drawImage(img, 0, 0, w, h);
      try {
        const imgData = rCtx.getImageData(0, 0, w, h);
        const data = imgData.data;
        processSubjectMatting(data, w, h, getMattingOptions());
        if (manualMaskCanvasRef.current) {
          const mCtx = manualMaskCanvasRef.current.getContext('2d');
          const origCanvas = document.createElement('canvas');
          origCanvas.width = w;
          origCanvas.height = h;
          const oCtx = origCanvas.getContext('2d');
          oCtx?.drawImage(img, 0, 0, w, h);
          const origData = oCtx?.getImageData(0, 0, w, h).data;
          if (mCtx) {
            const mData = mCtx.getImageData(0, 0, w, h).data;
            for (let i = 0; i < data.length; i += 4) {
              if (mData[i] > 10) {
                data[i + 3] = Math.round(data[i + 3] * Math.max(0, 1 - mData[i] / 255));
              } else if (mData[i + 1] > 10 && origData) {
                data[i] = origData[i];
                data[i + 1] = origData[i + 1];
                data[i + 2] = origData[i + 2];
                data[i + 3] = Math.max(data[i + 3], mData[i + 1]);
              }
            }
          }
        }
        rCtx.putImageData(imgData, 0, 0);
      } catch {
        // ignore
      }
      ctx.drawImage(rawOff, 0, 0);
    }
  }, [
    showEraserModal,
    mattingMode,
    removeShadows,
    tolerance,
    edgeChoke,
    maskRevision,
    subjectPolygon,
  ]);

  const applyMagicWandAt = (x: number, y: number) => {
    const img = loadedImgRef.current;
    const maskCanvas = manualMaskCanvasRef.current;
    if (!img || !maskCanvas) return;
    const w = maskCanvas.width;
    const h = maskCanvas.height;

    const origCanvas = document.createElement('canvas');
    origCanvas.width = w;
    origCanvas.height = h;
    const oCtx = origCanvas.getContext('2d');
    if (!oCtx) return;
    oCtx.drawImage(img, 0, 0, w, h);
    const origData = oCtx.getImageData(0, 0, w, h).data;

    const regionMask = computeMagicWandMask(
      origData,
      w,
      h,
      Math.round(x),
      Math.round(y),
      wandTolerance,
    );

    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;
    const maskImgData = mCtx.getImageData(0, 0, w, h);
    const mData = maskImgData.data;

    for (let idx = 0; idx < w * h; idx++) {
      if (regionMask[idx] === 1) {
        const p = idx * 4;
        mData[p] = 255; // Red = erase
        mData[p + 1] = 0;
        mData[p + 2] = 0;
        mData[p + 3] = 255;
      }
    }
    mCtx.putImageData(maskImgData, 0, 0);
    setMaskRevision((r) => r + 1);
  };

  const applyBrushStrokeAt = (e: React.PointerEvent<HTMLCanvasElement>, isInitialClick = false) => {
    const previewCanvas = editorPreviewCanvasRef.current;
    const maskCanvas = manualMaskCanvasRef.current;
    if (!previewCanvas || !maskCanvas) return;

    const rect = previewCanvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    const scaleX = maskCanvas.width / rect.width;
    const scaleY = maskCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (brushMode === 'wand') {
      if (isInitialClick) {
        applyMagicWandAt(x, y);
      }
      return;
    }

    const radius = (brushSize * Math.max(scaleX, scaleY)) / 2;

    const mCtx = maskCanvas.getContext('2d');
    if (!mCtx) return;

    mCtx.save();
    mCtx.beginPath();
    mCtx.arc(x, y, radius, 0, Math.PI * 2);
    // Red = erase trace, Green = restore subject
    mCtx.fillStyle = brushMode === 'erase' ? 'rgb(255, 0, 0)' : 'rgb(0, 255, 0)';
    mCtx.fill();
    mCtx.restore();

    setMaskRevision((r) => r + 1);
  };

  const handleResetManualMask = () => {
    const maskCanvas = manualMaskCanvasRef.current;
    if (!maskCanvas) return;
    const mCtx = maskCanvas.getContext('2d');
    mCtx?.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    setSubjectPolygon(undefined);
    setMaskRevision((r) => r + 1);
  };

  // Call Gemini Vision Polygon Contour API for photos with complex/non-white backgrounds
  const handleAnalyzeSubjectWithAiVision = async () => {
    const img = loadedImgRef.current;
    if (!img) return;
    setAnalyzingSubject(true);
    setStatusMsg(null);
    try {
      const maxDim = 640;
      const w = img.naturalWidth || img.width || 640;
      const h = img.naturalHeight || img.height || 640;
      const scale = Math.min(1, maxDim / Math.max(w, h));
      const sw = Math.max(64, Math.round(w * scale));
      const sh = Math.max(64, Math.round(h * scale));
      const tmp = document.createElement('canvas');
      tmp.width = sw;
      tmp.height = sh;
      const tCtx = tmp.getContext('2d');
      tCtx?.drawImage(img, 0, 0, sw, sh);
      const imageDataUrl = tmp.toDataURL('image/jpeg', 0.85);

      const res = await adminFetch<{
        polygon: { x: number; y: number }[];
        source: string;
        backgroundType?: string;
      }>('/api/admin/okwin/analyze-subject', {
        method: 'POST',
        body: JSON.stringify({
          imageDataUrl,
          productName,
        }),
      });

      if (Array.isArray(res.polygon) && res.polygon.length >= 3) {
        setRemoveBg(true);
        setMattingMode('complex');
        setSubjectPolygon(res.polygon);
        setStatusMsg(
          'Détourage IA Vision appliqué : la silhouette du produit a été isolée de l’arrière-plan complexe.',
        );
      }
    } catch (err: any) {
      setStatusMsg(err?.message || 'Erreur lors de l’analyse IA Vision du contour.');
    } finally {
      setAnalyzingSubject(false);
    }
  };

  const handleUploadSourceFile = async (file: File | undefined) => {
    if (!file) return;
    setUploadingSource(true);
    setStatusMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'other');
      const res = await adminFetch<{ url: string }>('/api/admin/media/upload', {
        method: 'POST',
        body: fd,
      });
      if (res.url && onSourceImageUploaded) {
        onSourceImageUploaded(res.url);
      }
    } catch (err: any) {
      setStatusMsg(err?.message || 'Erreur lors du téléversement de la photo source.');
    } finally {
      setUploadingSource(false);
    }
  };

  // Generate 4 variations from custom prompt via Gemini AI
  const handleGenerateCustomPrompt = async () => {
    if (!sourceImageUrl || !loadedImgRef.current) {
      setStatusMsg('Veuillez d’abord téléverser ou sélectionner une photo produit.');
      return;
    }
    setGenerating(true);
    setStatusMsg(null);
    try {
      if (!customPrompt.trim()) {
        generateFromScenes(buildVariationsFromBaseScene(selectedPreset));
        setStatusMsg('4 nouvelles images générées avec le prompt prédéfini sélectionné.');
        return;
      }

      const res = await adminFetch<{ variations: any[]; source: string }>(
        '/api/admin/okwin/scene-prompt',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: customPrompt.trim(),
            productName,
          }),
        },
      );

      const scenes: OkwinSceneConfig[] = (res.variations || []).slice(0, 4).map((v, idx) => ({
        id: `custom-${idx}`,
        label: v.label || `Variation Studio #${idx + 1}`,
        promptDescription: customPrompt,
        bgPrimary: v.bgPrimary || '#0f172a',
        bgSecondary: v.bgSecondary || '#1e3a8a',
        bgAccent: v.bgAccent || '#38bdf8',
        podiumColor: v.podiumColor || '#1e293b',
        glowColor: v.glowColor || '#3b82f6',
        lightAngle: (v.lightAngle as any) || 'center',
        floorStyle: (v.floorStyle as any) || 'podium',
        scale: idx === 1 ? 1.12 : idx === 2 ? 0.96 : 1.0,
      }));

      generateFromScenes(scenes);
      setStatusMsg(
        `Okwin AI + Gemini a généré 4 nouvelles images selon votre prompt : « ${customPrompt.trim()} »`,
      );
    } catch (err: any) {
      setStatusMsg(err?.message || 'Erreur lors de la génération Okwin AI.');
    } finally {
      setGenerating(false);
    }
  };

  // Convert dataURL to Blob and upload to /api/admin/media/upload so it persists in PostgreSQL
  const uploadDataUrlToMedia = async (dataUrl: string, index: number): Promise<string> => {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const file = new File([blob], `okwin-studio-${Date.now()}-${index}.jpg`, {
      type: 'image/jpeg',
    });
    const fd = new FormData();
    fd.append('file', file);
    fd.append('kind', 'other');
    const uploaded = await adminFetch<{ url: string }>('/api/admin/media/upload', {
      method: 'POST',
      body: fd,
    });
    return uploaded.url;
  };

  const handleSaveOneVariation = async (dataUrl: string, idx: number, asPrimary = false) => {
    setSavingUrls(true);
    setStatusMsg(null);
    try {
      const url = await uploadDataUrlToMedia(dataUrl, idx);
      if (asPrimary && onSetPrimaryImage) {
        onSetPrimaryImage(url);
        setStatusMsg('Photo Okwin Studio définie comme PHOTO PRINCIPALE du produit !');
      } else {
        onAddGeneratedImages([url]);
        setStatusMsg('Image Okwin Studio ajoutée avec succès à la galerie du produit !');
      }
    } catch (err: any) {
      setStatusMsg(err?.message || 'Impossible d’enregistrer l’image générée.');
    } finally {
      setSavingUrls(false);
    }
  };

  const handleSaveAllVariations = async () => {
    if (previews.length === 0) return;
    setSavingUrls(true);
    setStatusMsg(null);
    try {
      const uploadedUrls: string[] = [];
      for (let i = 0; i < previews.length; i++) {
        const url = await uploadDataUrlToMedia(previews[i].dataUrl, i);
        if (url) uploadedUrls.push(url);
      }
      onAddGeneratedImages(uploadedUrls);
      setStatusMsg(
        `${uploadedUrls.length} nouvelles images Okwin Studio ajoutées à votre produit / landing page !`,
      );
    } catch (err: any) {
      setStatusMsg(err?.message || 'Erreur lors de l’ajout des images.');
    } finally {
      setSavingUrls(false);
    }
  };

  const isComplexBgDetected = bgDiagnosis && !bgDiagnosis.isWhiteOrUniform;

  return (
    <div className="rounded-2xl border-2 border-indigo-600/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-5 space-y-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Okwin AI Photo Studio Pro · Fonds Blancs &amp; Fonds Complexes</span>
            </div>
            {bgDiagnosis && (
              <span
                className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                  bgDiagnosis.isWhiteOrUniform
                    ? 'bg-emerald-500/20 border border-emerald-400/40 text-emerald-300'
                    : 'bg-amber-500/20 border border-amber-400/40 text-amber-300'
                }`}
              >
                <ShieldCheck className="w-3 h-3" />
                <span>
                  {bgDiagnosis.isWhiteOrUniform
                    ? 'Fond Blanc / Uni détecté · Détourage Studio Ultra-Net'
                    : 'Fond Complexe / Photo Boutique détecté · Moteur Intelligent Actif'}
                </span>
              </span>
            )}
          </div>
          <h4 className="font-display font-bold text-base text-white">
            Détourage Intelligent (Fonds Blancs + Photos Réelles Sans Fond Blanc) &amp; Studio 3D
          </h4>
          <p className="text-xs text-slate-300">
            Détecte automatiquement si votre photo a déjà un fond blanc ou un fond complexe (table,
            comptoir, boutique), bouche les trous internes et permet de choisir n’importe quelle
            photo générée comme <strong>Photo Principale</strong>.
          </p>
        </div>

        {!sourceImageUrl && onSourceImageUploaded && (
          <label className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer shrink-0">
            <ImagePlus className="w-4 h-4" />
            <span>{uploadingSource ? 'Envoi...' : 'Choisir une photo produit'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => handleUploadSourceFile(e.target.files?.[0])}
            />
          </label>
        )}
      </div>

      {statusMsg && (
        <div className="px-3.5 py-2.5 rounded-xl bg-indigo-950/90 border border-indigo-400/40 text-xs text-indigo-200 flex items-center justify-between gap-2">
          <span>{statusMsg}</span>
          <button
            type="button"
            onClick={() => setStatusMsg(null)}
            className="text-indigo-300 hover:text-white underline text-[11px]"
          >
            Fermer
          </button>
        </div>
      )}

      {!sourceImageUrl ? (
        <div className="py-8 text-center space-y-3 border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
          <p className="text-xs text-slate-300">
            Téléversez d’abord une première photo de votre produit pour activer le studio
            d’arrière-plan <strong>Okwin AI Pro</strong>.
          </p>
          {onSourceImageUploaded && (
            <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold cursor-pointer">
              <ImagePlus className="w-4 h-4" />
              <span>{uploadingSource ? 'Téléversement...' : 'Téléverser une photo maintenant'}</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => handleUploadSourceFile(e.target.files?.[0])}
              />
            </label>
          )}
        </div>
      ) : (
        <>
          {/* 1. Predefined Studio Prompts */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">
              1. Prompts d’arrière-plan prédéfinis (1 clic) :
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {OKWIN_PRESET_PROMPTS.map((preset) => {
                const active = selectedPresetId === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setCustomPrompt('');
                    }}
                    className={`p-2.5 rounded-xl border text-left transition-all flex items-center gap-2.5 ${
                      active
                        ? 'border-indigo-400 bg-indigo-600/30 text-white ring-2 ring-indigo-400/30'
                        : 'border-slate-700 bg-slate-800/70 hover:bg-slate-800 text-slate-300'
                    }`}
                  >
                    <span
                      className="w-6 h-6 rounded-lg shrink-0 border border-white/20"
                      style={{
                        background: `linear-gradient(135deg, ${preset.bgSecondary}, ${preset.bgPrimary})`,
                      }}
                    />
                    <span className="text-xs font-semibold leading-tight line-clamp-2">
                      {preset.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Custom Prompt Input */}
          <div className="space-y-2">
            <label className="block text-xs font-bold text-slate-200">
              2. Ou créez votre propre prompt personnalisé (Okwin + Gemini AI) :
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                value={customPrompt}
                onChange={(e) => setCustomPrompt(e.target.value)}
                placeholder="Ex. Fond bleu nuit futuriste avec néon turquoise, podium marbre noir et reflet miroir..."
                className="flex-1 px-3.5 py-2.5 text-xs rounded-xl border border-slate-700 bg-slate-800/90 text-white placeholder:text-slate-400"
              />
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerateCustomPrompt}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-bold shrink-0 shadow-sm"
              >
                <Wand2 className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>
                  {generating ? 'Génération IA...' : 'Générer 4 variations avec ce prompt'}
                </span>
              </button>
            </div>
          </div>

          {/* 3. Pro Dual-Engine Background Isolation (White Background vs Complex Non-White Background) */}
          <div className="p-3.5 rounded-xl bg-slate-950/70 border border-slate-800 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span className="text-xs font-bold text-white">
                  3. Mode de Détourage (Fonds Blancs &amp; Photos Sans Fond Blanc) :
                </span>
                <div className="inline-flex flex-wrap rounded-lg bg-slate-900 p-0.5 border border-slate-700 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveBg(true);
                      setMattingMode('auto');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      removeBg && mattingMode === 'auto'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Auto Intelligent ({isComplexBgDetected ? 'Fond Complexe' : 'Fond Blanc'})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveBg(true);
                      setMattingMode('complex');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      removeBg && mattingMode === 'complex'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Photo Sans Fond Blanc (Complexe)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRemoveBg(true);
                      setMattingMode('flood');
                    }}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      removeBg && mattingMode === 'flood'
                        ? 'bg-indigo-600 text-white'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Studio Fond Blanc
                  </button>
                  <button
                    type="button"
                    onClick={() => setRemoveBg(false)}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${
                      !removeBg ? 'bg-indigo-600 text-white' : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Cadre Vitrine 3D (Garder le fond)
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {removeBg && (
                  <button
                    type="button"
                    disabled={analyzingSubject}
                    onClick={handleAnalyzeSubjectWithAiVision}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white shadow-xs transition-colors"
                    title="Utilise Gemini Vision pour tracer la silhouette du produit sur les photos difficiles sans fond blanc"
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${analyzingSubject ? 'animate-spin' : ''}`} />
                    <span>
                      {analyzingSubject
                        ? 'Analyse IA...'
                        : subjectPolygon
                        ? 'Silhouette IA Active ✓'
                        : 'Détourage IA Vision (Fond Complexe)'}
                    </span>
                  </button>
                )}

                {removeBg && (
                  <button
                    type="button"
                    onClick={() => setShowEraserModal((v) => !v)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      showEraserModal
                        ? 'bg-amber-500 text-slate-950 border-amber-400'
                        : 'bg-slate-800 hover:bg-slate-700 text-amber-300 border-amber-500/40'
                    }`}
                  >
                    <Eraser className="w-3.5 h-3.5" />
                    <span>
                      {showEraserModal
                        ? 'Fermer Baguette & Gomme'
                        : 'Baguette Magique 1-Clic & Gomme'}
                    </span>
                  </button>
                )}
              </div>
            </div>

            {removeBg && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-800/80 text-xs">
                <label className="inline-flex items-center gap-2 cursor-pointer text-slate-200">
                  <input
                    type="checkbox"
                    checked={removeShadows}
                    onChange={(e) => setRemoveShadows(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 text-indigo-500"
                  />
                  <span>Supprimer ombres &amp; traces de table</span>
                </label>

                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-[11px] text-slate-300 whitespace-nowrap">
                    Puissance détourage ({tolerance}) :
                  </span>
                  <input
                    type="range"
                    min={14}
                    max={85}
                    value={tolerance}
                    onChange={(e) => setTolerance(Number(e.target.value))}
                    className="w-28 accent-indigo-400"
                  />
                </div>

                <div className="flex items-center justify-between sm:justify-start gap-2">
                  <span className="text-[11px] text-slate-300 whitespace-nowrap">
                    Finesse Anti-Halo ({edgeChoke.toFixed(1)}px) :
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={3.5}
                    step={0.5}
                    value={edgeChoke}
                    onChange={(e) => setEdgeChoke(Number(e.target.value))}
                    className="w-28 accent-emerald-400"
                  />
                </div>
              </div>
            )}

            {/* Manual Magic Wand / Eraser / Restore Interactive Canvas Panel */}
            {removeBg && showEraserModal && (
              <div className="p-3.5 rounded-xl bg-slate-900 border border-amber-500/40 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-amber-300">
                      Outil de Retouche Directe :
                    </span>
                    <button
                      type="button"
                      onClick={() => setBrushMode('wand')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold inline-flex items-center gap-1 ${
                        brushMode === 'wand'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      <Wand2 className="w-3 h-3" />
                      <span>Baguette Magique (1 clic = effacer une zone de fond)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrushMode('erase')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        brushMode === 'erase'
                          ? 'bg-red-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Gomme (Pinceau)
                    </button>
                    <button
                      type="button"
                      onClick={() => setBrushMode('restore')}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold ${
                        brushMode === 'restore'
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                      }`}
                    >
                      Restaurer le produit
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    {brushMode === 'wand' ? (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <span>Tolérance baguette ({wandTolerance}) :</span>
                        <input
                          type="range"
                          min={12}
                          max={75}
                          value={wandTolerance}
                          onChange={(e) => setWandTolerance(Number(e.target.value))}
                          className="w-20 accent-indigo-400"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-300">
                        <span>Taille pinceau :</span>
                        <input
                          type="range"
                          min={8}
                          max={80}
                          value={brushSize}
                          onChange={(e) => setBrushSize(Number(e.target.value))}
                          className="w-20 accent-amber-400"
                        />
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={handleResetManualMask}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-200"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>Réinitialiser</span>
                    </button>
                  </div>
                </div>

                <div className="flex justify-center bg-slate-950 rounded-xl p-2 border border-slate-800">
                  <canvas
                    ref={editorPreviewCanvasRef}
                    onPointerDown={(e) => {
                      setIsPainting(true);
                      applyBrushStrokeAt(e, true);
                    }}
                    onPointerMove={(e) => {
                      if (isPainting && brushMode !== 'wand') applyBrushStrokeAt(e, false);
                    }}
                    onPointerUp={() => setIsPainting(false)}
                    onPointerLeave={() => setIsPainting(false)}
                    className="max-h-72 w-auto object-contain rounded-lg cursor-crosshair touch-none"
                  />
                </div>
                <p className="text-[11px] text-slate-400 text-center">
                  {brushMode === 'wand'
                    ? 'Cliquez simplement sur n’importe quel morceau d’arrière-plan restant pour l’effacer d’un seul clic.'
                    : 'Passez la souris ou le doigt sur le damier pour effacer une trace ou restaurer une partie du produit.'}
                </p>
              </div>
            )}
          </div>

          {/* 4. Generated Studio Previews Grid */}
          {previews.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-200">
                  4 nouvelles images générées (cliquez sur une photo pour l’agrandir ou choisissez-la comme Principale) :
                </span>
                <button
                  type="button"
                  disabled={savingUrls}
                  onClick={handleSaveAllVariations}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 text-xs font-bold shadow-sm"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>
                    {savingUrls
                      ? 'Ajout des images en cours...'
                      : 'Ajouter les 4 images à la galerie (+4 photos)'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {previews.map((item, idx) => (
                  <div
                    key={idx}
                    className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex flex-col group"
                  >
                    <div className="aspect-square w-full bg-slate-950 relative">
                      <button
                        type="button"
                        onClick={() => setLightboxIdx(idx)}
                        aria-label={`Agrandir ${item.label}`}
                        className="w-full h-full block cursor-zoom-in focus:outline-none"
                      >
                        <img
                          src={item.dataUrl}
                          alt={item.label}
                          className="w-full h-full object-contain transition-transform duration-200 group-hover:scale-[1.02]"
                        />
                      </button>
                      <button
                        type="button"
                        onClick={() => setLightboxIdx(idx)}
                        aria-label={`Voir ${item.label} en plein écran`}
                        title="Agrandir pour voir l'intégralité de la photo"
                        className="absolute top-2 right-2 p-1.5 rounded-lg bg-slate-900/80 hover:bg-indigo-600 text-white text-xs backdrop-blur-xs shadow transition-colors"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <div className="p-2 flex flex-col gap-1.5 justify-between flex-1">
                      <p className="text-[11px] font-medium text-slate-200 truncate">
                        {item.label}
                      </p>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          disabled={savingUrls}
                          onClick={() => handleSaveOneVariation(item.dataUrl, idx, true)}
                          className="w-full py-1.5 px-2 rounded-lg bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 text-[11px] font-bold flex items-center justify-center gap-1 shadow-2xs"
                          title="Définir immédiatement cette image Okwin comme Photo Principale du produit"
                        >
                          <Star className="w-3 h-3 fill-slate-950" />
                          <span>Choisir Principale</span>
                        </button>
                        <button
                          type="button"
                          disabled={savingUrls}
                          onClick={() => handleSaveOneVariation(item.dataUrl, idx, false)}
                          className="w-full py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Ajouter galerie</span>
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {lightboxIdx !== null && previews.length > 0 && (
        <ImageZoomLightbox
          images={previews.map((p) => ({ url: p.dataUrl, alt: p.label }))}
          initialIndex={lightboxIdx}
          title={previews[lightboxIdx]?.label || productName}
          onClose={() => setLightboxIdx(null)}
        />
      )}
    </div>
  );
}

