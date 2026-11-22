import React, { useEffect, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  RotateCcw,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';

export interface LightboxImageItem {
  url: string;
  alt?: string;
}

interface ImageZoomLightboxProps {
  images: LightboxImageItem[];
  initialIndex?: number;
  title?: string;
  onClose: () => void;
}

export function ImageZoomLightbox({
  images,
  initialIndex = 0,
  title,
  onClose,
}: ImageZoomLightboxProps) {
  const validImages = images.filter((img) => img && img.url);
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(validImages.length - 1, initialIndex)),
  );
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  useEffect(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, [currentIndex]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight' && validImages.length > 1) {
        setCurrentIndex((prev) => (prev + 1) % validImages.length);
      } else if (e.key === 'ArrowLeft' && validImages.length > 1) {
        setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length);
      } else if (e.key === '+' || e.key === '=') {
        setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(2))));
      } else if (e.key === '-') {
        setZoom((z) => {
          const next = Math.max(1, Number((z - 0.5).toFixed(2)));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, validImages.length]);

  if (validImages.length === 0) return null;

  const activeItem = validImages[currentIndex] || validImages[0];

  const handleZoomIn = () => {
    setZoom((z) => Math.min(3, Number((z + 0.5).toFixed(2))));
  };

  const handleZoomOut = () => {
    setZoom((z) => {
      const next = Math.max(1, Number((z - 0.5).toFixed(2)));
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleImageClick = () => {
    if (dragging) return;
    if (zoom === 1) {
      setZoom(2);
    } else {
      handleResetZoom();
    }
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (zoom <= 1) return;
    setDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragging || zoom <= 1) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  };

  const handlePointerUp = () => {
    setDragging(false);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title ? `Aperçu intégral : ${title}` : 'Aperçu intégral de la photo'}
      className="fixed inset-0 z-50 bg-slate-950/95 backdrop-blur-md flex flex-col select-none"
      onClick={onClose}
    >
      {/* Top Toolbar */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 px-4 sm:px-6 py-3.5 bg-slate-900/90 border-b border-slate-800 text-white"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-3 min-w-0">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-400/30 text-blue-300 text-xs font-bold shrink-0">
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Vue Intégrale HD</span>
          </span>
          {title && (
            <h3 className="font-display font-bold text-sm sm:text-base text-white truncate">
              {title}
            </h3>
          )}
          {validImages.length > 1 && (
            <span className="text-xs font-mono text-slate-400 shrink-0">
              ({currentIndex + 1} / {validImages.length})
            </span>
          )}
        </div>

        {/* Zoom Controls */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            aria-label="Zoom arrière"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors"
            title="Zoom arrière (-)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="px-2.5 py-1 rounded-lg bg-slate-800 font-mono text-xs font-bold text-slate-200 min-w-[58px] text-center">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 3}
            aria-label="Zoom avant"
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-40 text-white transition-colors"
            title="Zoom avant (+)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {zoom > 1 && (
            <button
              type="button"
              onClick={handleResetZoom}
              aria-label="Réinitialiser le zoom"
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
              title="Voir l'image entière (100%)"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">100%</span>
            </button>
          )}

          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer l'aperçu photo"
            className="ml-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors"
          >
            <X className="w-4 h-4" />
            <span>Fermer</span>
          </button>
        </div>
      </div>

      {/* Main Uncropped Photo Viewport */}
      <div
        className="relative flex-1 flex items-center justify-center overflow-hidden p-4 sm:p-8"
        onClick={(e) => e.stopPropagation()}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
      >
        {validImages.length > 1 && (
          <button
            type="button"
            onClick={() =>
              setCurrentIndex((prev) => (prev - 1 + validImages.length) % validImages.length)
            }
            aria-label="Photo précédente"
            className="absolute left-3 sm:left-6 z-10 p-3 rounded-full bg-slate-900/85 hover:bg-blue-600 text-white border border-white/15 shadow-lg transition-colors"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        <div
          className={`w-full h-full flex items-center justify-center ${
            zoom > 1 ? 'cursor-grab active:cursor-grabbing' : 'cursor-zoom-in'
          }`}
          onClick={handleImageClick}
        >
          <img
            src={activeItem.url}
            alt={activeItem.alt || title || 'Photo produit'}
            referrerPolicy="no-referrer"
            draggable={false}
            style={{
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transition: dragging ? 'none' : 'transform 180ms ease-out',
            }}
            className="max-w-full max-h-[78vh] w-auto h-auto object-contain rounded-lg shadow-2xl"
          />
        </div>

        {validImages.length > 1 && (
          <button
            type="button"
            onClick={() => setCurrentIndex((prev) => (prev + 1) % validImages.length)}
            aria-label="Photo suivante"
            className="absolute right-3 sm:right-6 z-10 p-3 rounded-full bg-slate-900/85 hover:bg-blue-600 text-white border border-white/15 shadow-lg transition-colors"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}
      </div>

      {/* Bottom Gallery Thumbnails & Hint */}
      <div
        className="px-4 py-3 bg-slate-900/90 border-t border-slate-800 flex flex-col items-center gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {validImages.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            {validImages.map((img, idx) => (
              <button
                key={`${img.url}-${idx}`}
                type="button"
                onClick={() => setCurrentIndex(idx)}
                aria-label={`Miniature photo ${idx + 1}`}
                className={`w-14 h-14 rounded-lg overflow-hidden border-2 shrink-0 transition-all bg-slate-950 ${
                  idx === currentIndex
                    ? 'border-blue-500 ring-2 ring-blue-500/30 scale-105'
                    : 'border-slate-700 opacity-65 hover:opacity-100'
                }`}
              >
                <img
                  src={img.url}
                  alt={img.alt || `Photo ${idx + 1}`}
                  referrerPolicy="no-referrer"
                  className="w-full h-full object-contain"
                />
              </button>
            ))}
          </div>
        )}
        <p className="text-[11px] text-slate-400 text-center">
          Astuce : Cliquez sur l’image pour zoomer (200%) ou voir l’intégralité de la photo (100%)
          {zoom > 1 ? ' · Glissez pour déplacer l’image' : ''}
        </p>
      </div>
    </div>
  );
}
