import React, { useMemo, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  Eye,
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
import { ProductImage } from '../ProductImage';

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
  compareAtPriceDzd: 4500,
  prompt: '',
  tone: 'conversion',
  heroBadge: 'OFFRE SPÉCIALE ALGÉRIE · LIVRAISON 58 WILAYAS',
  headline: '',
  subheadline: '',
  ctaText: 'Commander maintenant — Paiement à la livraison',
  urgencyText: 'Stock limité · Expédition rapide 24h/48h',
  heroImageUrl: '',
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
  const [editingId, setEditingId] = useState<number | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);
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

  const openNewBuilder = (prefillProduct?: any) => {
    setEditingId(null);
    if (prefillProduct) {
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
        heroImageUrl: prefillProduct.primaryImage || '',
      });
    } else {
      setForm({ ...DEFAULT_FORM });
    }
    setFeedback(null);
    setShowBuilder(true);
  };

  const openEditBuilder = (lp: any) => {
    setEditingId(lp.id);
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
      heroImageUrl: lp.heroImageUrl || '',
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
      heroImageUrl: found.primaryImage || prev.heroImageUrl,
    }));
  };

  const handleGenerateWithAi = async () => {
    if (!String(form.productName || '').trim()) {
      setFeedback({
        type: 'err',
        msg: 'Veuillez d’abord sélectionner un produit ou saisir le nom du produit.',
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
          }),
        },
      );
      const g = res.generated;
      setForm((prev: any) => ({
        ...prev,
        title: g.title || prev.title,
        heroBadge: g.heroBadge || prev.heroBadge,
        headline: g.headline || prev.headline,
        subheadline: g.subheadline || prev.subheadline,
        ctaText: g.ctaText || prev.ctaText,
        urgencyText: g.urgencyText || prev.urgencyText,
        benefits: Array.isArray(g.benefits) ? g.benefits : prev.benefits,
        specs: Array.isArray(g.specs) ? g.specs : prev.specs,
        testimonials: Array.isArray(g.testimonials) ? g.testimonials : prev.testimonials,
        faq: Array.isArray(g.faq) ? g.faq : prev.faq,
      }));
      setFeedback({
        type: 'ok',
        msg: 'PagePilot AI a généré votre landing page haute conversion ! Vous pouvez ajuster chaque texte ci-dessous avant d’enregistrer.',
      });
    } catch (err: any) {
      setFeedback({
        type: 'err',
        msg: err?.message || 'Erreur lors de la génération PagePilot AI.',
      });
    } finally {
      setGeneratingAi(false);
    }
  };

  const handleUploadHeroImage = async (file: File | undefined) => {
    if (!file) return;
    setUploadingImage(true);
    setFeedback(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('kind', 'other');
      const res = await adminFetch<{ url: string }>('/api/admin/media/upload', {
        method: 'POST',
        body: fd,
      });
      setForm((prev: any) => ({ ...prev, heroImageUrl: res.url }));
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
      const payload = {
        ...form,
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
            <span>PagePilot : AI Page Builder</span>
          </div>
          <h2 className="font-display font-bold text-xl">
            Créez des Landing Pages de vente en 1 clic avec l’IA
          </h2>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Sélectionnez un produit de votre stock (ou créez une offre spéciale), cliquez sur{' '}
            <strong>Générer avec PagePilot AI</strong> et obtenez instantanément une page de vente
            complète avec arguments, avis clients, FAQ et formulaire de commande directe 58 wilayas
            (idéal pour vos publicités Facebook, Instagram et TikTok Ads).
          </p>
        </div>

        <button
          type="button"
          onClick={() => openNewBuilder()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shrink-0 shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>Nouvelle Landing Page</span>
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

      {/* Quick Start from Existing Catalog Product */}
      {!showBuilder && physicalProducts.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="text-xs font-bold text-slate-800 mb-2.5">
            Génération rapide depuis un article de votre catalogue :
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
                  : 'PagePilot AI — Constructeur de Landing Page'}
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
                    Étape 1 · Source du produit &amp; Génération IA
                  </span>
                  <p className="text-xs text-slate-600">
                    Reliez un produit de votre stock ou entrez un nom d’offre, puis laissez PagePilot AI
                    rédiger toute la page.
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
                      ? 'Rédaction par PagePilot AI...'
                      : 'Générer toute la page avec PagePilot AI'}
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
                    <option value="">— Offre libre / Produit personnalisé —</option>
                    {products.map((p) => (
                      <option key={p.id} value={String(p.id)}>
                        {p.name} ({formatDzd(p.priceDzd)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Nom du produit / de l’offre *
                  </label>
                  <input
                    required
                    value={form.productName}
                    onChange={(e) => setForm({ ...form, productName: e.target.value })}
                    placeholder="Ex. Écouteurs Anker SoundCore ANC"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Prix de l’offre (DZD) *
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

              <div className="grid grid-cols-1 lg:grid-cols-4 gap-3">
                <div className="lg:col-span-3">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Points forts ou description rapide pour guider l’IA (optionnel)
                  </label>
                  <input
                    value={form.prompt}
                    onChange={(e) => setForm({ ...form, prompt: e.target.value })}
                    placeholder="Ex. Charge rapide 65W GaN, compatible iPhone 15 Pro & Samsung S24, garantie 12 mois, cadeau offert..."
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Style marketing
                  </label>
                  <select
                    value={form.tone}
                    onChange={(e) => setForm({ ...form, tone: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="conversion">Haute Conversion (Facebook / TikTok Ads)</option>
                    <option value="premium">Premium &amp; Technologie</option>
                    <option value="promo">Offre Flash &amp; Urgence</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Step 2: Hero Content & Visuals */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-8 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Titre interne / Onglet
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
                    placeholder="Ex. Chargez 3 appareils simultanément à vitesse maximale"
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

              {/* Hero Image Upload / Preview */}
              <div className="lg:col-span-4 space-y-3">
                <label className="block text-xs font-semibold text-slate-700">
                  Photo principale de la Landing Page
                </label>
                <div className="aspect-square max-h-48 w-full rounded-xl overflow-hidden bg-slate-100 border border-slate-200 flex items-center justify-center">
                  <ProductImage src={form.heroImageUrl} alt={form.productName || 'Landing page'} />
                </div>
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{uploadingImage ? 'Envoi...' : 'Téléverser une photo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => handleUploadHeroImage(e.target.files?.[0])}
                    />
                  </label>
                  <input
                    value={form.heroImageUrl}
                    onChange={(e) => setForm({ ...form, heroImageUrl: e.target.value })}
                    placeholder="Ou URL d’image..."
                    className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>
            </div>

            {/* Step 3: Editable Benefits & Specs */}
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
                    Aucune landing page créée pour le moment. Cliquez sur{' '}
                    <strong>« Nouvelle Landing Page »</strong> ou sur un produit ci-dessus pour lancer{' '}
                    <strong>PagePilot AI</strong>.
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
