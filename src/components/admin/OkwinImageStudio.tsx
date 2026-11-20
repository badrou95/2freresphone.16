import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  ImagePlus,
  Layers,
  Palette,
  Plus,
  RefreshCw,
  Sparkles,
  Trash2,
  Wand2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { ProductColorOption } from '../../types';

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

// Helper: Remove uniform/corner background from product image on an offscreen canvas
function extractSubjectCanvas(
  img: HTMLImageElement,
  removeBg: boolean,
  tolerance: number,
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

    // Sample corner & border pixels to estimate background color
    const samplePoints = [
      [2, 2],
      [w - 3, 2],
      [2, h - 3],
      [w - 3, h - 3],
      [Math.floor(w / 2), 2],
      [2, Math.floor(h / 2)],
      [w - 3, Math.floor(h / 2)],
    ];

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    let count = 0;

    for (const [sx, sy] of samplePoints) {
      const clampedX = Math.max(0, Math.min(w - 1, sx));
      const clampedY = Math.max(0, Math.min(h - 1, sy));
      const idx = (clampedY * w + clampedX) * 4;
      rSum += data[idx];
      gSum += data[idx + 1];
      bSum += data[idx + 2];
      count++;
    }

    const bgR = rSum / count;
    const bgG = gSum / count;
    const bgB = bSum / count;
    const thresh = tolerance * 1.8;
    const softRange = 28;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const dist = Math.sqrt((r - bgR) ** 2 + (g - bgG) ** 2 + (b - bgB) ** 2);
      if (dist < thresh) {
        data[i + 3] = 0;
      } else if (dist < thresh + softRange) {
        const factor = (dist - thresh) / softRange;
        data[i + 3] = Math.round(data[i + 3] * factor);
      }
    }

    ctx.putImageData(imgData, 0, 0);
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
      : ctx.createRadialGradient(size * 0.5, size * 0.38, size * 0.08, size * 0.5, size * 0.5, size * 0.78);

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
  const topGrad = ctx.createLinearGradient(podiumX - podiumW * 0.5, podiumY, podiumX + podiumW * 0.5, podiumY);
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
  const drawY = podiumY - drawH + 18 + offsetY;

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

  return canvas.toDataURL('image/jpeg', 0.92);
}

interface OkwinImageStudioProps {
  sourceImageUrl: string;
  productName?: string;
  onSourceImageUploaded?: (url: string) => void;
  onAddGeneratedImages: (urls: string[]) => void;
}

export function OkwinImageStudio({
  sourceImageUrl,
  productName = 'Produit 2Frères Phone',
  onSourceImageUploaded,
  onAddGeneratedImages,
}: OkwinImageStudioProps) {
  const [selectedPresetId, setSelectedPresetId] = useState<string>(OKWIN_PRESET_PROMPTS[0].id);
  const [customPrompt, setCustomPrompt] = useState<string>('');
  const [removeBg, setRemoveBg] = useState<boolean>(true);
  const [tolerance, setTolerance] = useState<number>(36);
  const [generating, setGenerating] = useState<boolean>(false);
  const [savingUrls, setSavingUrls] = useState<boolean>(false);
  const [uploadingSource, setUploadingSource] = useState<boolean>(false);
  const [previews, setPreviews] = useState<{ label: string; dataUrl: string }[]>([]);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const loadedImgRef = useRef<HTMLImageElement | null>(null);

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

  const generateFromScenes = (scenes: OkwinSceneConfig[]) => {
    const img = loadedImgRef.current;
    if (!img) return;
    const subjectCanvas = extractSubjectCanvas(img, removeBg, tolerance);
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
      return;
    }
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      loadedImgRef.current = img;
      generateFromScenes(buildVariationsFromBaseScene(selectedPreset));
    };
    img.src = sourceImageUrl;
  }, [sourceImageUrl, selectedPresetId, removeBg, tolerance]);

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

  const handleSaveOneVariation = async (dataUrl: string, idx: number) => {
    setSavingUrls(true);
    setStatusMsg(null);
    try {
      const url = await uploadDataUrlToMedia(dataUrl, idx);
      onAddGeneratedImages([url]);
      setStatusMsg('Image Okwin Studio ajoutée avec succès à la galerie du produit !');
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

  return (
    <div className="rounded-2xl border-2 border-indigo-600/80 bg-gradient-to-br from-slate-900 via-slate-900 to-indigo-950 text-white p-5 space-y-5 shadow-md">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 text-indigo-300 text-[11px] font-bold uppercase tracking-wider">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Okwin AI Photo Studio · Arrière-plan &amp; Multi-Images</span>
          </div>
          <h4 className="font-display font-bold text-base text-white">
            Modifiez l’arrière-plan de votre produit &amp; générez d’autres images via Prompts
          </h4>
          <p className="text-xs text-slate-300">
            Choisissez un décor studio prédéfini ou écrivez votre propre prompt personnalisé pour
            générer 4 nouvelles photos professionnelles de votre produit.
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
            d’arrière-plan <strong>Okwin AI</strong>.
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

          {/* 3. Background Isolation Controls */}
          <div className="flex flex-wrap items-center justify-between gap-4 pt-1 text-xs text-slate-300">
            <label className="inline-flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={removeBg}
                onChange={(e) => setRemoveBg(e.target.checked)}
                className="w-4 h-4 rounded border-slate-600 text-indigo-500"
              />
              <span className="font-semibold">
                Détourer automatiquement l’arrière-plan d’origine du produit
              </span>
            </label>

            {removeBg && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-400">Précision du détourage :</span>
                <input
                  type="range"
                  min={12}
                  max={85}
                  value={tolerance}
                  onChange={(e) => setTolerance(Number(e.target.value))}
                  className="w-28 accent-indigo-400"
                />
              </div>
            )}
          </div>

          {/* 4. Generated Studio Previews Grid */}
          {previews.length > 0 && (
            <div className="space-y-3 pt-2 border-t border-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold text-indigo-200">
                  4 nouvelles images générées pour votre produit :
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
                    className="rounded-xl overflow-hidden border border-slate-700 bg-slate-800 flex flex-col"
                  >
                    <div className="aspect-square w-full bg-slate-950 relative">
                      <img
                        src={item.dataUrl}
                        alt={item.label}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="p-2 flex flex-col gap-1.5 justify-between flex-1">
                      <p className="text-[11px] font-medium text-slate-200 truncate">
                        {item.label}
                      </p>
                      <button
                        type="button"
                        disabled={savingUrls}
                        onClick={() => handleSaveOneVariation(item.dataUrl, idx)}
                        className="w-full py-1.5 px-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-[11px] font-bold flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Utiliser cette photo</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
