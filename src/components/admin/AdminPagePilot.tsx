import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Copy,
  ExternalLink,
  Eye,
  ImagePlus,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { formatDzd } from '../../shared/domain';
import { ProductColorOption } from '../../types';
import { ProductImage } from '../ProductImage';
import { OkwinImageStudio, ProductColorsEditor } from './OkwinImageStudio';

interface AdminPagePilotProps {
  products: any[];
  landingPages: any[];
  onRefresh: () => void;
  onOpenLandingPage?: (slug: string) => void;
}

const DEFAULT_FORM = {
  productId: '',
  productName: '',
  title: '',
  slug: '',
  priceDzd: 3500,
  compareAtPriceDzd: 4400,
  prompt: '',
  tone: 'conversion',
  heroBadge: 'OFFRE SPÉCIALE ALGÉRIE · LIVRAISON 58 WILAYAS',
  headline: '',
  subheadline: '',
  ctaText: 'Commander maintenant — Paiement à la livraison',
  urgencyText: 'Stock limité · Expédition rapide 24h/48h',
  heroImageUrl: '',
  galleryImages: [] as string[],
  colors: [] as ProductColorOption[],
  accentColor: '#1d4ed8',
  isPublished: true,
  benefits: [
    {
      title: 'Qualité Supérieure Certifiée 2Frères Phone',
      description: 'Sélectionné et testé pour une fiabilité maximale au quotidien.',
    },
    {
      title: 'Paiement 100 % à la Livraison',
      description: 'Vous ne payez qu’à la réception de votre colis dans votre wilaya.',
    },
    {
      title: 'Livraison Express 58 Wilayas',
      description: 'À domicile ou en bureau Stop Desk sous 24h à 48h.',
    },
  ],
  specs: [
    { label: 'Garantie', value: 'Garantie satisfaction 2Frères Phone' },
    { label: 'Livraison', value: '58 Wilayas (Domicile & Stop Desk)' },
    { label: 'Paiement', value: 'En espèces à la livraison (DZD)' },
  ],
  testimonials: [
    {
      name: 'Amine B.',
      wilaya: 'Alger',
      rating: 5,
      comment: 'Reçu en 24h, produit conforme et très bonne qualité. Merci 2Frères Phone !',
    },
    {
      name: 'Sofiane K.',
      wilaya: 'Oran',
      rating: 5,
      comment: 'Service sérieux et rapide, je recommande à 100 %.',
    },
  ],
  faq: [
    {
      question: 'Comment commander et payer ?',
      answer:
        'Remplissez le formulaire sur la page. Notre équipe vous appelle pour confirmer et vous payez à la livraison.',
    },
    {
      question: 'Livrez-vous dans toutes les wilayas ?',
      answer: 'Oui, nous livrons dans les 58 wilayas à domicile ou en bureau Stop Desk.',
    },
  ],
};

export function AdminPagePilot({
  products,
  landingPages,
  onRefresh,
  onOpenLandingPage,
}: AdminPagePilotProps) {
  // Express Photo-Only Gemini AI state ("Photos + Prix de vente uniquement")
  const [quickPhotos, setQuickPhotos] = useState<string[]>([]);
  const [quickColors, setQuickColors] = useState<ProductColorOption[]>([]);
  const [showQuickOkwin, setShowQuickOkwin] = useState(false);
  const [quickPriceDzd, setQuickPriceDzd] = useState<string>('3500');
  const [quickUploading, setQuickUploading] = useState(false);
  const [quickGenerating, setQuickGenerating] = useState(false);
  const [lastCreatedLp, setLastCreatedLp] = useState<any | null>(null);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
  const [showBuilderOkwin, setShowBuilderOkwin] = useState(false);
  const [form, setForm] = useState<any>({ ...DEFAULT_FORM });
  const [generatingAi, setGeneratingAi] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const physicalProducts = useMemo(
    () => products.filter((p) => p.isActive !== false),
    [products],
  );

  // Upload multiple photos for Express Photo-Only Gemini Mode
  const handleQuickPhotosUpload = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setQuickUploading(true);
    setFeedback(null);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(fileList).slice(0, 5)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'other');
        const res = await adminFetch<{ url: string }>('/api/admin/media/upload', {
          method: 'POST',
          body: fd,
        });
        if (res.url) uploadedUrls.push(res.url);
      }
      setQuickPhotos((prev) => [...prev, ...uploadedUrls]);
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg: err?.message || 'Erreur lors du téléversement des photos.',
      });
    } finally {
      setQuickUploading(false);
    }
  };

  // 1-Click Photo + Price Gemini Vision Generation (Auto-Publish OR Open in Editor)
  const handleQuickGenerateFromPhotos = async (autoPublish: boolean) => {
    if (quickPhotos.length === 0) {
      setFeedback({
        type: 'err',
        msg: 'Veuillez ajouter au moins une photo du produit.',
      });
      return;
    }
    const priceNum = Math.max(0, Math.round(Number(quickPriceDzd) || 0));
    if (priceNum <= 0) {
      setFeedback({
        type: 'err',
        msg: 'Veuillez saisir le prix de vente en DZD.',
      });
      return;
    }

    setQuickGenerating(true);
    setFeedback(null);
    setLastCreatedLp(null);
    try {
      const res = await adminFetch<{
        generated: any;
        landingPage?: any;
        source: string;
        visionAnalyzedCount?: number;
      }>('/api/admin/pagepilot/generate', {
        method: 'POST',
        body: JSON.stringify({
          priceDzd: priceNum,
          imageUrls: quickPhotos,
          heroImageUrl: quickPhotos[0],
          colors: quickColors,
          tone: 'conversion',
          autoPublish,
        }),
      });

      const g = res.generated;
      if (autoPublish && res.landingPage) {
        setLastCreatedLp(res.landingPage);
        setQuickPhotos([]);
        setQuickColors([]);
        setShowQuickOkwin(false);
        setFeedback({
          type: 'ok',
          msg: `Gemini AI a analysé vos photos et publié la landing page « ${res.landingPage.title} » à ${formatDzd(priceNum)} !`,
        });
        onRefresh();
      } else {
        setEditingId(null);
        setForm({
          ...DEFAULT_FORM,
          productId: '',
          productName: g.productName || 'Produit 2Frères Phone',
          title: g.title || `${g.productName || 'Offre Spéciale'}`,
          priceDzd: priceNum,
          compareAtPriceDzd: g.compareAtPriceDzd || Math.round((priceNum * 1.25) / 100) * 100,
          heroBadge: g.heroBadge || DEFAULT_FORM.heroBadge,
          headline: g.headline || '',
          subheadline: g.subheadline || '',
          ctaText: g.ctaText || DEFAULT_FORM.ctaText,
          urgencyText: g.urgencyText || DEFAULT_FORM.urgencyText,
          heroImageUrl: quickPhotos[0] || '',
          galleryImages: quickPhotos,
          colors:
            quickColors.length > 0
              ? quickColors
              : Array.isArray(g.colors)
              ? g.colors
              : [],
          accentColor: g.accentColor || '#1d4ed8',
          benefits: Array.isArray(g.benefits) ? g.benefits : DEFAULT_FORM.benefits,
          specs: Array.isArray(g.specs) ? g.specs : DEFAULT_FORM.specs,
          testimonials: Array.isArray(g.testimonials) ? g.testimonials : DEFAULT_FORM.testimonials,
          faq: Array.isArray(g.faq) ? g.faq : DEFAULT_FORM.faq,
        });
        setShowBuilder(true);
        setFeedback({
          type: 'ok',
          msg: `Gemini AI a détecté « ${g.productName} » depuis vos photos et rédigé toute la page. Vérifiez ou cliquez sur Publier !`,
        });
      }
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg: err?.message || 'Erreur lors de la création par photos avec Gemini AI.',
      });
    } finally {
      setQuickGenerating(false);
    }
  };

  const openNewBuilder = (prefillProduct?: any) => {
    setEditingId(null);
    if (prefillProduct) {
      const imgs = Array.isArray(prefillProduct.images)
        ? prefillProduct.images.map((img: any) => img.url).filter(Boolean)
        : prefillProduct.primaryImage
        ? [prefillProduct.primaryImage]
        : [];
      setForm({
        ...DEFAULT_FORM,
        productId: String(prefillProduct.id),
        productName: prefillProduct.name,
        title: `${prefillProduct.name} — Offre Spéciale`,
        priceDzd: prefillProduct.priceDzd || 0,
        compareAtPriceDzd:
          prefillProduct.compareAtPriceDzd || Math.round((prefillProduct.priceDzd || 2500) * 1.25),
        prompt: prefillProduct.shortDescription || prefillProduct.description || '',
        headline: `${prefillProduct.name} — Performance & Qualité Garantie`,
        subheadline:
          prefillProduct.shortDescription ||
          prefillProduct.description ||
          `Commandez votre ${prefillProduct.name} avec livraison rapide 58 wilayas et paiement à la livraison.`,
        heroImageUrl: prefillProduct.primaryImage || imgs[0] || '',
        galleryImages: imgs,
        colors: Array.isArray(prefillProduct.colors) ? prefillProduct.colors : [],
      });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
    setFeedback(null);
    setShowBuilder(true);
  };

  const openEditBuilder = (lp: any) => {
    setEditingId(lp.id);
    const gallery = Array.isArray(lp.galleryImages) && lp.galleryImages.length > 0
      ? lp.galleryImages
      : lp.heroImageUrl
      ? [lp.heroImageUrl]
      : [];
    setForm({
      productId: lp.productId ? String(lp.productId) : '',
      productName: lp.productName || lp.title || '',
      title: lp.title || '',
      slug: lp.slug || '',
      priceDzd: lp.priceDzd ?? 0,
      compareAtPriceDzd: lp.compareAtPriceDzd ?? '',
      prompt: lp.subheadline || '',
      tone: 'conversion',
      heroBadge: lp.heroBadge || DEFAULT_FORM.heroBadge,
      headline: lp.headline || '',
      subheadline: lp.subheadline || '',
      ctaText: lp.ctaText || DEFAULT_FORM.ctaText,
      urgencyText: lp.urgencyText || DEFAULT_FORM.urgencyText,
      heroImageUrl: lp.heroImageUrl || gallery[0] || '',
      galleryImages: gallery,
      colors: Array.isArray(lp.colors) ? lp.colors : [],
      accentColor: lp.accentColor || '#1d4ed8',
      isPublished: lp.isPublished !== false,
      benefits: Array.isArray(lp.benefits) && lp.benefits.length > 0 ? lp.benefits : DEFAULT_FORM.benefits,
      specs: Array.isArray(lp.specs) && lp.specs.length > 0 ? lp.specs : DEFAULT_FORM.specs,
      testimonials:
        Array.isArray(lp.testimonials) && lp.testimonials.length > 0
          ? lp.testimonials
          : DEFAULT_FORM.testimonials,
      faq: Array.isArray(lp.faq) && lp.faq.length > 0 ? lp.faq : DEFAULT_FORM.faq,
    });
    setFeedback(null);
    setShowBuilder(true);
  };

  const handleSelectCatalogProduct = (productIdStr: string) => {
    if (!productIdStr) {
      setForm((prev: any) => ({ ...prev, productId: '' }));
      return;
    }
    const found = products.find((p) => String(p.id) === productIdStr);
    if (!found) return;
    const imgs = Array.isArray(found.images)
      ? found.images.map((img: any) => img.url).filter(Boolean)
      : found.primaryImage
      ? [found.primaryImage]
      : [];
    setForm((prev: any) => ({
      ...prev,
      productId: String(found.id),
      productName: found.name,
      title: `${found.name} — Offre Spéciale`,
      priceDzd: found.priceDzd || prev.priceDzd,
      compareAtPriceDzd: found.compareAtPriceDzd || Math.round((found.priceDzd || 2500) * 1.25),
      prompt: found.shortDescription || found.description || prev.prompt,
      headline: prev.headline || `${found.name} — Offre Exclusive Algérie`,
      subheadline:
        found.shortDescription ||
        found.description ||
        prev.subheadline,
      heroImageUrl: found.primaryImage || imgs[0] || prev.heroImageUrl,
      galleryImages: imgs.length > 0 ? imgs : prev.galleryImages,
      colors: Array.isArray(found.colors) && found.colors.length > 0 ? found.colors : prev.colors,
    }));
  };

  const handleGenerateWithAi = async () => {
    const allImages = Array.from(
      new Set([form.heroImageUrl, ...(form.galleryImages || [])].filter(Boolean)),
    );
    if (!String(form.productName || '').trim() && allImages.length === 0) {
      setFeedback({
        type: 'err',
        msg: 'Téléversez au moins une photo du produit (ou indiquez son nom) pour que Gemini AI génère la page.',
      });
      return;
    }
    setGeneratingAi(true);
    setFeedback(null);
    try {
      const res = await adminFetch<{ generated: any; source: string }>(
        '/api/admin/pagepilot/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            productName: form.productName,
            priceDzd: form.priceDzd,
            compareAtPriceDzd: form.compareAtPriceDzd,
            description: form.prompt,
            tone: form.tone,
            heroImageUrl: form.heroImageUrl || allImages[0],
            imageUrls: allImages,
          }),
        },
      );
      const g = res.generated;
      setForm((prev: any) => ({
        ...prev,
        productName: g.productName || prev.productName || 'Offre Spéciale 2Frères Phone',
        title: g.title || prev.title,
        compareAtPriceDzd: g.compareAtPriceDzd || prev.compareAtPriceDzd,
        heroBadge: g.heroBadge || prev.heroBadge,
        headline: g.headline || prev.headline,
        subheadline: g.subheadline || prev.subheadline,
        ctaText: g.ctaText || prev.ctaText,
        urgencyText: g.urgencyText || prev.urgencyText,
        accentColor: g.accentColor || prev.accentColor,
        benefits: Array.isArray(g.benefits) ? g.benefits : prev.benefits,
        specs: Array.isArray(g.specs) ? g.specs : prev.specs,
        testimonials: Array.isArray(g.testimonials) ? g.testimonials : prev.testimonials,
        faq: Array.isArray(g.faq) ? g.faq : prev.faq,
      }));
      setFeedback({
        type: 'ok',
        msg: `Gemini AI a analysé votre produit (« ${g.productName || form.productName} ») et généré toute la page !`,
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg: err?.message || 'Erreur lors de la génération Gemini AI.',
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleUploadBuilderImages = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setUploadingImage(true);
    setFeedback(null);
    try {
      const newUrls: string[] = [];
      for (const file of Array.from(fileList).slice(0, 5)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'other');
        const res = await adminFetch<{ url: string }>('/api/admin/media/upload', {
          method: 'POST',
          body: fd,
        });
        if (res.url) newUrls.push(res.url);
      }
      setForm((prev: any) => {
        const nextGallery = Array.from(new Set([...(prev.galleryImages || []), ...newUrls]));
        return {
          ...prev,
          heroImageUrl: prev.heroImageUrl || newUrls[0] || '',
          galleryImages: nextGallery,
        };
      });
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Erreur téléversement image.' });
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveLandingPage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!String(form.productName || '').trim()) {
      setFeedback({ type: 'err', msg: 'Le nom du produit est obligatoire.' });
      return;
    }
    setSaving(true);
    setFeedback(null);
    try {
      const allImages = Array.from(
        new Set([form.heroImageUrl, ...(form.galleryImages || [])].filter(Boolean)),
      );
      const payload = {
        ...form,
        heroImageUrl: form.heroImageUrl || allImages[0] || null,
        galleryImages: allImages,
        productId: form.productId ? Number(form.productId) : null,
        priceDzd: Math.max(0, Math.round(Number(form.priceDzd) || 0)),
        compareAtPriceDzd:
          form.compareAtPriceDzd !== '' && form.compareAtPriceDzd !== null
            ? Math.max(0, Math.round(Number(form.compareAtPriceDzd) || 0))
            : null,
        headline: form.headline || `${form.productName} — Offre Spéciale`,
        subheadline:
          form.subheadline ||
          `Commandez votre ${form.productName} avec livraison 58 wilayas et paiement à la livraison.`,
      };

      if (editingId) {
        await adminFetch(`/api/admin/landing-pages/${editingId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'ok', msg: 'Landing page mise à jour avec succès.' });
      } else {
        await adminFetch('/api/admin/landing-pages', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedback({ type: 'ok', msg: 'Nouvelle landing page créée et publiée !' });
      }
      setShowBuilder(false);
      setEditingId(null);
      onRefresh();
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg: err?.message || 'Impossible d’enregistrer la landing page.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLandingPage = async (id: number) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    try {
      await adminFetch(`/api/admin/landing-pages/${id}`, { method: 'DELETE' });
      setConfirmDeleteId(null);
      setFeedback({ type: 'ok', msg: 'Landing page supprimée.' });
      onRefresh();
    } catch (err: any) {
      setFeedback({ type: 'err', msg: err?.message || 'Erreur lors de la suppression.' });
    }
  };

  const handleCopyPublicLink = (lp: any) => {
    const url = `${window.location.origin}/lp/${lp.slug}`;
    navigator.clipboard?.writeText(url);
    setCopiedId(lp.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border border-slate-800">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-600/20 border border-blue-500/30 text-blue-300 text-xs font-semibold">
            <Sparkles className="w-3.5 h-3.5" />
            <span>PagePilot : Gemini Vision AI Page Builder</span>
          </div>
          <h2 className="font-display font-bold text-xl">
            Créez toute votre Landing Page uniquement par Photos + Prix de vente
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Ajoutez simplement <strong>1 ou plusieurs photos</strong> de votre produit et indiquez
            votre <strong>prix de vente (DZD)</strong>. <strong>Gemini Vision AI</strong> reconnaît
            automatiquement le produit sur vos photos et génère 100 % de la page (nom, titre
            accrocheur, arguments, fiche technique, avis clients algériens, FAQ et formulaire 58
            wilayas).
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewBuilder()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white text-xs font-semibold shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Éditeur Manuel Complet</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center justify-between gap-3 ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <span>{feedback.msg}</span>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="underline font-semibold shrink-0"
          >
            Fermer
          </button>
        </div>
      )}

      {/* Instant Success Banner when Auto-Published via Photos */}
      {lastCreatedLp && (
        <div className="bg-emerald-950 text-white border border-emerald-700 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-300">
              <Check className="w-3.5 h-3.5" />
              <span>Landing Page créée par Gemini AI &amp; Publiée</span>
            </span>
            <h3 className="font-display font-bold text-base text-white">
              {lastCreatedLp.title} — {formatDzd(lastCreatedLp.priceDzd)}
            </h3>
            <p className="text-xs text-emerald-200 font-mono">
              {window.location.origin}/lp/{lastCreatedLp.slug}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyPublicLink(lastCreatedLp)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold"
            >
              {copiedId === lastCreatedLp.id ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Lien copié !</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Copier le lien public</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() =>
                onOpenLandingPage
                  ? onOpenLandingPage(lastCreatedLp.slug)
                  : (window.location.href = `/lp/${lastCreatedLp.slug}`)
              }
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-bold"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Ouvrir la Landing Page</span>
            </button>
          </div>
        </div>
      )}

      {/* EXPRESS PHOTO-ONLY + SELLING PRICE CARD (GEMINI VISION AI) */}
      <div className="bg-white border-2 border-blue-600 rounded-2xl p-5 sm:p-6 shadow-sm space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0">
              <Camera className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                Mode Magique Gemini Vision AI
              </span>
              <h3 className="font-display font-bold text-base text-slate-900">
                Création 100 % automatique par Photos + Prix de vente uniquement
              </h3>
            </div>
          </div>
          <span className="text-xs text-slate-500">
            Aucun texte à écrire : Gemini analyse la photo et rédige toute la page
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Step 1: Upload 1 or multiple product photos */}
          <div className="lg:col-span-7 space-y-3">
            <label className="block text-xs font-bold text-slate-800">
              1. Ajoutez la ou les photos de votre produit (1 à 5 photos) *
            </label>

            <div className="flex flex-wrap items-center gap-3">
              <label className="flex flex-col items-center justify-center w-32 h-32 rounded-xl border-2 border-dashed border-blue-400 bg-blue-50/50 hover:bg-blue-50 text-blue-700 cursor-pointer transition-colors p-3 text-center">
                <ImagePlus className="w-6 h-6 mb-1.5" />
                <span className="text-xs font-bold">
                  {quickUploading ? 'Envoi...' : 'Ajouter photos'}
                </span>
                <span className="text-[10px] text-blue-600/80 mt-0.5">JPG, PNG, WebP</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={quickUploading || quickGenerating}
                  className="hidden"
                  onChange={(e) => handleQuickPhotosUpload(e.target.files)}
                />
              </label>

              {quickPhotos.map((url, idx) => (
                <div
                  key={`${url}-${idx}`}
                  className="relative w-32 h-32 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group"
                >
                  <ProductImage src={url} alt={`Photo produit ${idx + 1}`} />
                  {idx === 0 && (
                    <span className="absolute bottom-1.5 left-1.5 px-2 py-0.5 rounded bg-blue-700 text-white text-[10px] font-bold">
                      Principale
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => setQuickPhotos((prev) => prev.filter((_, i) => i !== idx))}
                    className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-slate-900/80 text-white flex items-center justify-center hover:bg-red-600"
                    title="Retirer cette photo"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>

            {/* Okwin AI Studio button in Quick Photo Mode */}
            {quickPhotos.length > 0 && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowQuickOkwin((prev) => !prev)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-xs"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>
                    {showQuickOkwin
                      ? 'Masquer Okwin AI Studio'
                      : 'Okwin AI · Modifier l’arrière-plan & Générer 4 images via Prompts'}
                  </span>
                </button>
              </div>
            )}

            {/* Quick Available Colors Selector */}
            <ProductColorsEditor
              colors={quickColors}
              onChange={setQuickColors}
              availableImages={quickPhotos}
            />
          </div>

          {/* Step 2: Selling Price + 1-Click Gemini Generation */}
          <div className="lg:col-span-5 bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                2. Mentionnez uniquement votre Prix de vente (DZD) *
              </label>
              <div className="relative">
                <input
                  type="number"
                  min={1}
                  value={quickPriceDzd}
                  onChange={(e) => setQuickPriceDzd(e.target.value)}
                  placeholder="Ex. 4500"
                  className="w-full px-4 py-3 text-lg font-mono font-bold rounded-xl border border-slate-300 bg-white text-slate-900 pr-16"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 font-mono font-bold text-xs text-slate-500">
                  DZD
                </span>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                Gemini AI calculera automatiquement l’ancien prix barré promotionnel et rédigera
                tous les arguments de vente à partir de vos photos.
              </p>
            </div>

            <div className="space-y-2 pt-1">
              <button
                type="button"
                disabled={quickGenerating || quickUploading || quickPhotos.length === 0}
                onClick={() => handleQuickGenerateFromPhotos(true)}
                className="w-full py-3 px-4 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm transition-colors"
              >
                <Sparkles className={`w-4 h-4 ${quickGenerating ? 'animate-spin' : ''}`} />
                <span>
                  {quickGenerating
                    ? 'Analyse des photos par Gemini AI en cours...'
                    : 'Créer & Publier toute la Landing Page en 1 clic'}
                </span>
              </button>

              <button
                type="button"
                disabled={quickGenerating || quickUploading || quickPhotos.length === 0}
                onClick={() => handleQuickGenerateFromPhotos(false)}
                className="w-full py-2.5 px-4 rounded-xl border border-blue-300 bg-white hover:bg-blue-50 disabled:opacity-50 text-blue-800 text-xs font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5" />
                <span>Générer par photos puis vérifier avant publication</span>
              </button>
            </div>
          </div>
        </div>

        {/* Okwin AI Photo Studio Expanded inside Quick Mode */}
        {showQuickOkwin && quickPhotos.length > 0 && (
          <OkwinImageStudio
            sourceImageUrl={quickPhotos[0]}
            productName="Produit Landing Page"
            onSourceImageUploaded={(url) => setQuickPhotos((prev) => [url, ...prev])}
            onAddGeneratedImages={(urls) =>
              setQuickPhotos((prev) => Array.from(new Set([...prev, ...urls])))
            }
          />
        )}
      </div>

      {/* Quick Start from Existing Catalog Product */}
      {!showBuilder && physicalProducts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-800 mb-2.5">
            Ou générer depuis un produit déjà présent dans votre stock :
          </p>
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {physicalProducts.slice(0, 8).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openNewBuilder(p)}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-blue-500 hover:bg-blue-50/40 text-xs font-medium text-slate-800 shrink-0 transition-colors"
              >
                <Wand2 className="w-3.5 h-3.5 text-blue-600" />
                <span className="truncate max-w-[180px]">{p.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Builder Modal / Drawer */}
      {showBuilder && (
        <form
          onSubmit={handleSaveLandingPage}
          className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm"
        >
          <div className="px-6 py-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-700" />
              <h3 className="font-display font-bold text-base text-slate-900">
                {editingId
                  ? `Modifier la Landing Page : ${form.title}`
                  : 'PagePilot AI — Éditeur de Landing Page'}
              </h3>
            </div>
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-200/60"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="p-6 space-y-6">
            {/* Step 1: Product & AI Generation Box */}
            <div className="p-4 rounded-xl bg-blue-50/60 border border-blue-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                    Étape 1 · Photos, Prix &amp; Génération Gemini Vision AI
                  </span>
                  <p className="text-xs text-slate-600">
                    Téléversez vos photos et indiquez le prix : Gemini AI détecte le produit et
                    remplit toute la page.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={generatingAi}
                  onClick={handleGenerateWithAi}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white text-xs font-semibold shadow-sm"
                >
                  <Sparkles className={`w-4 h-4 ${generatingAi ? 'animate-spin' : ''}`} />
                  <span>
                    {generatingAi
                      ? 'Analyse photo & rédaction par Gemini AI...'
                      : 'Analyser la photo & Générer avec Gemini AI'}
                  </span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Produit du stock (optionnel)
                  </label>
                  <select
                    value={form.productId}
                    onChange={(e) => handleSelectCatalogProduct(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">— Détection par photo / Offre libre —</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} ({formatDzd(p.priceDzd)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom du produit (détecté par Gemini AI) *
                  </label>
                  <input
                    required
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="Laissez vide avant de cliquer sur Générer par photo"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prix de vente (DZD) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={form.priceDzd}
                    onChange={(e) => setForm({ ...form, priceDzd: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono font-bold rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ancien prix barré (DZD)
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.compareAtPriceDzd}
                    onChange={(e) => setForm({ ...form, compareAtPriceDzd: e.target.value })}
                    className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300 bg-white"
                  />
                </div>
              </div>
            </div>

            {/* Step 2: Hero Content & Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Titre de l’offre
                    </label>
                    <input
                      value={form.title}
                      onChange={(e) => setForm({ ...form, title: e.target.value })}
                      placeholder="Ex. Offre Chargeur GaN 65W"
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Badge d’accroche supérieur
                    </label>
                    <input
                      value={form.heroBadge}
                      onChange={(e) => setForm({ ...form, heroBadge: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Grand titre persuasif (Headline) *
                  </label>
                  <input
                    required
                    value={form.headline}
                    onChange={(e) => setForm({ ...form, headline: e.target.value })}
                    placeholder="Généré automatiquement par Gemini AI"
                    className="w-full px-3 py-2 text-sm font-semibold rounded-lg border border-slate-300"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Sous-titre argumentaire
                  </label>
                  <textarea
                    rows={2}
                    value={form.subheadline}
                    onChange={(e) => setForm({ ...form, subheadline: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Texte du bouton de commande
                    </label>
                    <input
                      value={form.ctaText}
                      onChange={(e) => setForm({ ...form, ctaText: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Bandeau d’urgence / Stock
                    </label>
                    <input
                      value={form.urgencyText}
                      onChange={(e) => setForm({ ...form, urgencyText: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Couleur principale
                    </label>
                    <select
                      value={form.accentColor}
                      onChange={(e) => setForm({ ...form, accentColor: e.target.value })}
                      className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="#1d4ed8">Bleu Royal 2Frères (#1d4ed8)</option>
                      <option value="#15803d">Vert Émeraude (#15803d)</option>
                      <option value="#dc2626">Rouge Promo (#dc2626)</option>
                      <option value="#0f172a">Noir Intense (#0f172a)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Hero & Gallery Images Upload / Preview */}
              <div className="lg:col-span-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Photos du produit ({(form.galleryImages || []).length || (form.heroImageUrl ? 1 : 0)})
                </label>
                <div className="aspect-square max-h-48 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <ProductImage src={form.heroImageUrl} alt={form.productName || 'Landing page'} />
                </div>

                {Array.isArray(form.galleryImages) && form.galleryImages.length > 0 && (
                  <div className="flex items-center gap-2 overflow-x-auto pb-1">
                    {form.galleryImages.map((imgUrl: string, idx: number) => (
                      <div
                        key={`${imgUrl}-${idx}`}
                        onClick={() => setForm({ ...form, heroImageUrl: imgUrl })}
                        className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 cursor-pointer shrink-0 ${
                          form.heroImageUrl === imgUrl ? 'border-blue-600' : 'border-slate-200'
                        }`}
                      >
                        <ProductImage src={imgUrl} alt={`Galerie ${idx + 1}`} />
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Envoi...' : 'Téléverser des photos'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => handleUploadBuilderImages(e.target.files)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowBuilderOkwin((prev) => !prev)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold"
                  >
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>
                      {showBuilderOkwin ? 'Masquer Okwin AI' : 'Okwin AI · Arrière-plan & Prompts'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Available Colors Editor inside Builder */}
            <ProductColorsEditor
              colors={Array.isArray(form.colors) ? form.colors : []}
              onChange={(nextColors) => setForm({ ...form, colors: nextColors })}
              availableImages={Array.isArray(form.galleryImages) ? form.galleryImages : []}
            />

            {/* Okwin AI Photo Studio inside Builder */}
            {showBuilderOkwin && (
              <OkwinImageStudio
                sourceImageUrl={form.heroImageUrl || (form.galleryImages || [])[0] || ''}
                productName={form.productName || form.title || 'Produit Landing Page'}
                onSourceImageUploaded={(url) =>
                  setForm((prev: any) => ({
                    ...prev,
                    heroImageUrl: prev.heroImageUrl || url,
                    galleryImages: Array.from(new Set([url, ...(prev.galleryImages || [])])),
                  }))
                }
                onAddGeneratedImages={(urls) =>
                  setForm((prev: any) => ({
                    ...prev,
                    heroImageUrl: prev.heroImageUrl || urls[0] || '',
                    galleryImages: Array.from(new Set([...(prev.galleryImages || []), ...urls])),
                  }))
                }
              />
            )}

            {/* Step 3: Editable Benefits & FAQ */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-4 border-t border-slate-100">
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Arguments &amp; Bénéfices clés ({form.benefits.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        benefits: [...form.benefits, { title: 'Nouvel avantage', description: '' }],
                      })
                    }
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    + Ajouter un argument
                  </button>
                </div>
                {form.benefits.map((b: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={b.title}
                        onChange={(e) => {
                          const next = [...form.benefits];
                          next[idx] = { ...next[idx], title: e.target.value };
                          setForm({ ...form, benefits: next });
                        }}
                        placeholder="Titre de l’avantage"
                        className="flex-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            benefits: form.benefits.filter((_: any, i: number) => i !== idx),
                          })
                        }
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      value={b.description}
                      onChange={(e) => {
                        const next = [...form.benefits];
                        next[idx] = { ...next[idx], description: e.target.value };
                        setForm({ ...form, benefits: next });
                      }}
                      placeholder="Explication courte..."
                      className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                    />
                  </div>
                ))}
              </div>

              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Questions fréquentes (FAQ) ({form.faq.length})
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        faq: [...form.faq, { question: 'Nouvelle question ?', answer: '' }],
                      })
                    }
                    className="text-xs font-semibold text-blue-700 hover:underline"
                  >
                    + Ajouter une question
                  </button>
                </div>
                {form.faq.map((f: any, idx: number) => (
                  <div key={idx} className="p-2.5 rounded-lg border border-slate-200 bg-slate-50/60 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <input
                        value={f.question}
                        onChange={(e) => {
                          const next = [...form.faq];
                          next[idx] = { ...next[idx], question: e.target.value };
                          setForm({ ...form, faq: next });
                        }}
                        placeholder="Question client"
                        className="flex-1 px-2.5 py-1 text-xs font-semibold rounded border border-slate-300 bg-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setForm({
                            ...form,
                            faq: form.faq.filter((_: any, i: number) => i !== idx),
                          })
                        }
                        className="text-slate-400 hover:text-red-600 p-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    <input
                      value={f.answer}
                      onChange={(e) => {
                        const next = [...form.faq];
                        next[idx] = { ...next[idx], answer: e.target.value };
                        setForm({ ...form, faq: next });
                      }}
                      placeholder="Réponse..."
                      className="w-full px-2.5 py-1 text-xs rounded border border-slate-300 bg-white"
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-200">
              <label className="inline-flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.isPublished}
                  onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
                  className="w-4 h-4 rounded border-slate-300 text-blue-700"
                />
                <span>Landing page publiée et accessible aux clients</span>
              </label>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowBuilder(false)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
                >
                  {saving
                    ? 'Enregistrement...'
                    : editingId
                    ? 'Enregistrer les modifications'
                    : 'Publier la Landing Page'}
                </button>
              </div>
            </div>
          </div>
        </form>
      )}

      {/* Existing Landing Pages Table */}
      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
          <h3 className="font-display font-semibold text-sm text-slate-900">
            Vos Landing Pages ({landingPages.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
              <tr>
                <th className="py-3 px-4 font-semibold">Landing Page / Offre</th>
                <th className="py-3 px-4 font-semibold">Lien public (/lp/...)</th>
                <th className="py-3 px-4 font-semibold text-right">Prix</th>
                <th className="py-3 px-4 font-semibold text-right">Visites / Cmd</th>
                <th className="py-3 px-4 font-semibold">Statut</th>
                <th className="py-3 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {landingPages.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-xs text-slate-500">
                    Aucune landing page créée pour le moment. Téléversez une photo et indiquez votre
                    prix de vente dans l’encadré <strong>Mode Magique Gemini Vision AI</strong>{' '}
                    ci-dessus.
                  </td>
                </tr>
              ) : (
                landingPages.map((lp) => (
                  <tr key={lp.id} className="hover:bg-slate-50">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                          <ProductImage src={lp.heroImageUrl} alt={lp.productName} />
                        </div>
                        <div>
                          <p className="font-semibold text-slate-900">{lp.title}</p>
                          <p className="text-xs text-slate-500 truncate max-w-xs">{lp.headline}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="inline-flex items-center gap-1.5">
                        <span className="font-mono text-xs text-blue-700 bg-blue-50 px-2 py-1 rounded">
                          /lp/{lp.slug}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleCopyPublicLink(lp)}
                          title="Copier le lien public pour vos publicités"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                        >
                          {copiedId === lp.id ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      <span className="font-bold text-slate-900">{formatDzd(lp.priceDzd)}</span>
                      {lp.compareAtPriceDzd && (
                        <span className="block text-[11px] text-slate-400 line-through">
                          {formatDzd(lp.compareAtPriceDzd)}
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                      <span className="text-slate-700">{lp.viewsCount || 0} vues</span>
                      <span className="block font-bold text-emerald-700">
                        {lp.ordersCount || 0} cmd
                      </span>
                    </td>
                    <td className="py-3 px-4 text-xs">
                      {lp.isPublished ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold">
                          Publiée
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 font-semibold">
                          Brouillon
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            onOpenLandingPage
                              ? onOpenLandingPage(lp.slug)
                              : (window.location.href = `/lp/${lp.slug}`)
                          }
                          title="Voir la landing page"
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs font-semibold text-slate-700"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Voir</span>
                          <ExternalLink className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => openEditBuilder(lp)}
                          title="Modifier"
                          className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteLandingPage(lp.id)}
                          title="Supprimer"
                          className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${
                            confirmDeleteId === lp.id
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-slate-200 hover:bg-red-50 text-slate-500 hover:text-red-600'
                          }`}
                        >
                          {confirmDeleteId === lp.id ? 'Confirmer ?' : <Trash2 className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
