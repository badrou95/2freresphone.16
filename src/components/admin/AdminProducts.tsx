import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  FolderPlus,
  ImagePlus,
  Pencil,
  Plus,
  Search,
  Star,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { CATEGORY_GROUPS, formatDzd } from '../../shared/domain';
import { ProductImage } from '../ProductImage';

interface AdminProductsProps {
  products: any[];
  categories: any[];
  globalLowStockThreshold: number;
  initialOnlyMissingPhotos?: boolean;
  onRefresh: () => void;
}

export function AdminProducts({
  products,
  categories,
  globalLowStockThreshold,
  initialOnlyMissingPhotos = false,
  onRefresh,
}: AdminProductsProps) {
  const [subTab, setSubTab] = useState<'products' | 'categories'>('products');
  const [search, setSearch] = useState('');
  const [onlyMissingPhotos, setOnlyMissingPhotos] = useState(initialOnlyMissingPhotos);
  const [typeFilter, setTypeFilter] = useState<'all' | 'physical' | 'digital'>('all');

  // Product modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formState, setFormState] = useState<any>({});
  const [savingProduct, setSavingProduct] = useState(false);

  // Quick Photo Gallery Modal for any product (ideal right after stock DB import!)
  const [photoModalProduct, setPhotoModalProduct] = useState<any | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');

  // Category quick form
  const [catName, setCatName] = useState('');
  const [catGroup, setCatGroup] = useState<'accessories' | 'gaming' | 'digital'>('accessories');
  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<number | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<number | null>(null);

  const missingPhotoCount = products.filter((p) => !p.hasPhotos).length;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyMissingPhotos && p.hasPhotos) return false;
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.barcode || ''} ${p.categoryName} ${p.brand || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, onlyMissingPhotos, typeFilter]);

  const openCreateModal = () => {
    setEditingProduct({ isNew: true });
    setFormState({
      name: '',
      sku: '',
      barcode: '',
      brand: '',
      categoryId: categories[0]?.id || '',
      productType: 'physical',
      priceDzd: 0,
      compareAtPriceDzd: '',
      costPriceDzd: 0,
      stockQuantity: 10,
      lowStockThreshold: '',
      shortDescription: '',
      description: '',
      isFeatured: false,
      isActive: true,
      digitalAvailability: 'available',
      digitalActivationTemplate: '',
    });
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    setFormState({
      name: p.name,
      sku: p.sku,
      barcode: p.barcode || '',
      brand: p.brand || '',
      categoryId: p.categoryId || '',
      productType: p.productType,
      priceDzd: p.priceDzd,
      compareAtPriceDzd: p.compareAtPriceDzd ?? '',
      costPriceDzd: p.costPriceDzd ?? 0,
      stockQuantity: p.stockQuantity,
      lowStockThreshold: p.lowStockThreshold ?? '',
      shortDescription: p.shortDescription || '',
      description: p.description || '',
      isFeatured: p.isFeatured,
      isActive: p.isActive,
      digitalAvailability: p.digitalAvailability || 'available',
      digitalActivationTemplate: p.digitalActivationTemplate || '',
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingProduct(true);
    setFeedbackError(null);
    try {
      if (editingProduct?.isNew) {
        await adminFetch('/api/admin/products', {
          method: 'POST',
          body: JSON.stringify(formState),
        });
      } else {
        await adminFetch(`/api/admin/products/${editingProduct.id}`, {
          method: 'PATCH',
          body: JSON.stringify(formState),
        });
      }
      setEditingProduct(null);
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Erreur lors de la sauvegarde.');
    } finally {
      setSavingProduct(false);
    }
  };

  const handleDeleteProduct = async (p: any) => {
    if (confirmDeleteProdId !== p.id) {
      setConfirmDeleteProdId(p.id);
      return;
    }
    setFeedbackError(null);
    try {
      await adminFetch(`/api/admin/products/${p.id}`, { method: 'DELETE' });
      setConfirmDeleteProdId(null);
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible de supprimer ce produit.');
    }
  };

  // Direct file upload for product photos (supports selecting 1 or multiple images directly from PC/phone)
  const handleDirectPhotoUpload = async (productId: number, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    setFeedbackError(null);
    try {
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'product');
        fd.append('productId', String(productId));
        await adminFetch('/api/admin/media/upload', {
          method: 'POST',
          body: fd,
        });
      }
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Erreur lors du téléversement.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAddPhotoUrl = async (productId: number) => {
    if (!photoUrlInput.trim()) return;
    setUploadingPhoto(true);
    setFeedbackError(null);
    try {
      await adminFetch(`/api/admin/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify({ url: photoUrlInput.trim() }),
      });
      setPhotoUrlInput('');
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Erreur lors de l’ajout de la photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleSetPrimaryPhoto = async (productId: number, imageId: number) => {
    await adminFetch(`/api/admin/products/${productId}/images/${imageId}/primary`, {
      method: 'PATCH',
    });
    onRefresh();
  };

  const handleDeletePhoto = async (productId: number, imageId: number) => {
    await adminFetch(`/api/admin/products/${productId}/images/${imageId}`, {
      method: 'DELETE',
    });
    onRefresh();
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    await adminFetch('/api/admin/categories', {
      method: 'POST',
      body: JSON.stringify({ name: catName.trim(), categoryGroup: catGroup }),
    });
    setCatName('');
    onRefresh();
  };

  const handleDeleteCategory = async (id: number) => {
    if (confirmDeleteCatId !== id) {
      setConfirmDeleteCatId(id);
      return;
    }
    try {
      await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      setConfirmDeleteCatId(null);
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible de supprimer la catégorie.');
    }
  };

  // Sync live photoModalProduct from refreshed products list
  const livePhotoProduct = photoModalProduct
    ? products.find((p) => p.id === photoModalProduct.id) || photoModalProduct
    : null;

  return (
    <div className="space-y-5">
      {feedbackError && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between">
          <span>{feedbackError}</span>
          <button type="button" onClick={() => setFeedbackError(null)} className="font-semibold underline">
            Fermer
          </button>
        </div>
      )}
      {/* Top Sub-tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex p-1 bg-slate-200/70 rounded-lg">
          <button
            type="button"
            onClick={() => setSubTab('products')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
              subTab === 'products' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Produits ({products.length})
          </button>
          <button
            type="button"
            onClick={() => setSubTab('categories')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
              subTab === 'categories' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
            }`}
          >
            Catégories ({categories.length})
          </button>
        </div>

        {subTab === 'products' && (
          <button
            type="button"
            onClick={openCreateModal}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            <span>Nouveau produit</span>
          </button>
        )}
      </div>

      {subTab === 'products' ? (
        <>
          <div className="bg-white border border-slate-200 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5 flex-1">
              <div className="relative min-w-[220px] flex-1 max-w-sm">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, SKU, code-barres, catégorie..."
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as any)}
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="all">Physiques &amp; Numériques</option>
                <option value="physical">Physiques uniquement</option>
                <option value="digital">Numériques uniquement</option>
              </select>

              <button
                type="button"
                onClick={() => setOnlyMissingPhotos((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                  onlyMissingPhotos
                    ? 'bg-blue-700 text-white border-blue-700'
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                }`}
              >
                <Camera className="w-3.5 h-3.5" />
                <span>Sans photo ({missingPhotoCount})</span>
              </button>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4 font-semibold">Produit</th>
                    <th className="py-3 px-4 font-semibold">Catégorie / Type</th>
                    <th className="py-3 px-4 font-semibold text-right">Prix (DZD)</th>
                    <th className="py-3 px-4 font-semibold text-right">Stock / Seuil</th>
                    <th className="py-3 px-4 font-semibold text-right">Photos &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 shrink-0">
                            <ProductImage src={p.primaryImage} alt={p.name} />
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{p.name}</p>
                            <p className="text-xs font-mono text-slate-400">
                              {p.sku}
                              {p.barcode ? ` · CB ${p.barcode}` : ''}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{p.categoryName}</span>
                        <span className="block text-slate-400">
                          {p.productType === 'digital' ? 'Numérique' : 'Physique'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-slate-900 tabular-nums">
                        {formatDzd(p.priceDzd)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        {p.productType === 'digital' ? (
                          <span className="text-indigo-700 font-sans font-medium">
                            {p.digitalAvailability || 'Disponible'}
                          </span>
                        ) : (
                          <div>
                            <span
                              className={`font-semibold ${
                                p.isLowStock ? 'text-red-600' : 'text-slate-900'
                              }`}
                            >
                              {p.stockQuantity} u.
                            </span>
                            <span className="block text-[11px] text-slate-400">
                              Seuil : {p.effectiveLowStockThreshold}
                              {p.lowStockThreshold === null ? ' (global)' : ' (perso)'}
                            </span>
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <div className="inline-flex items-center gap-1.5">
                          <label
                            title="Téléverser directement une photo depuis votre appareil"
                            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold cursor-pointer"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            <span>Photo</span>
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              className="hidden"
                              onChange={(e) => handleDirectPhotoUpload(p.id, e.target.files)}
                            />
                          </label>
                          <button
                            type="button"
                            onClick={() => setPhotoModalProduct(p)}
                            title="Gérer la galerie photos"
                            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-xs text-slate-700"
                          >
                            <ImagePlus className="w-3.5 h-3.5" />
                            <span className="font-mono">{p.images?.length || 0}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => openEditModal(p)}
                            aria-label={`Modifier ${p.name}`}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteProduct(p)}
                            aria-label={`Supprimer ${p.name}`}
                            className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${
                              confirmDeleteProdId === p.id
                                ? 'bg-red-600 text-white border-red-600'
                                : 'border-slate-200 hover:bg-red-50 text-slate-500 hover:text-red-600'
                            }`}
                          >
                            {confirmDeleteProdId === p.id ? 'Confirmer ?' : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                        Aucun produit correspondant.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        /* Categories Manager */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <form
            onSubmit={handleCreateCategory}
            className="lg:col-span-4 bg-white border border-slate-200 rounded-xl p-5 space-y-4 h-fit"
          >
            <div className="flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-blue-700" />
              <h3 className="font-display font-semibold text-base text-slate-900">
                Ajouter une catégorie
              </h3>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de catégorie *</label>
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex. Montres connectées"
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Rayon principal</label>
              <select
                value={catGroup}
                onChange={(e) => setCatGroup(e.target.value as any)}
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                {CATEGORY_GROUPS.map((g) => (
                  <option key={g.value} value={g.value}>
                    {g.label}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="submit"
              className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
            >
              Créer la catégorie
            </button>
          </form>

          <div className="lg:col-span-8 bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4 font-semibold">Nom</th>
                  <th className="py-3 px-4 font-semibold">Rayon</th>
                  <th className="py-3 px-4 font-semibold">Slug</th>
                  <th className="py-3 px-4 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {categories.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="py-2.5 px-4 font-medium text-slate-900">{c.name}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-600">
                      {CATEGORY_GROUPS.find((g) => g.value === c.categoryGroup)?.label || c.categoryGroup}
                    </td>
                    <td className="py-2.5 px-4 font-mono text-xs text-slate-400">{c.slug}</td>
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(c.id)}
                        className={`px-2 py-1.5 rounded text-xs font-medium ${
                          confirmDeleteCatId === c.id
                            ? 'bg-red-600 text-white'
                            : 'hover:bg-red-50 text-slate-400 hover:text-red-600'
                        }`}
                      >
                        {confirmDeleteCatId === c.id ? 'Confirmer ?' : <Trash2 className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Product Create / Edit Modal */}
      {editingProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <form
            onSubmit={handleSaveProduct}
            className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl"
          >
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="font-display font-bold text-lg text-slate-900">
                {editingProduct.isNew ? 'Ajouter un produit' : `Modifier : ${editingProduct.name}`}
              </h3>
              <button
                type="button"
                onClick={() => setEditingProduct(null)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Nom du produit *</label>
                  <input
                    required
                    value={formState.name || ''}
                    onChange={(e) => setFormState({ ...formState, name: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Catégorie</label>
                  <select
                    value={formState.categoryId || ''}
                    onChange={(e) => setFormState({ ...formState, categoryId: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Non classé</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={formState.productType || 'physical'}
                    onChange={(e) => setFormState({ ...formState, productType: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="physical">Physique (Livraison COD)</option>
                    <option value="digital">Numérique (Activation)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">SKU / Référence</label>
                  <input
                    value={formState.sku || ''}
                    onChange={(e) => setFormState({ ...formState, sku: e.target.value })}
                    placeholder="Auto si vide"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Code-barres</label>
                  <input
                    value={formState.barcode || ''}
                    onChange={(e) => setFormState({ ...formState, barcode: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prix de vente (DZD) *</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formState.priceDzd ?? 0}
                    onChange={(e) => setFormState({ ...formState, priceDzd: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prix barré (DZD)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.compareAtPriceDzd ?? ''}
                    onChange={(e) => setFormState({ ...formState, compareAtPriceDzd: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Prix d’achat (DZD)</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.costPriceDzd ?? 0}
                    onChange={(e) => setFormState({ ...formState, costPriceDzd: Number(e.target.value) })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                  />
                </div>
              </div>

              {formState.productType === 'physical' ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Stock actuel</label>
                    <input
                      type="number"
                      min={0}
                      value={formState.stockQuantity ?? 0}
                      onChange={(e) => setFormState({ ...formState, stockQuantity: Number(e.target.value) })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Seuil d’alerte stock faible (laisser vide = global {globalLowStockThreshold})
                    </label>
                    <input
                      type="number"
                      min={0}
                      value={formState.lowStockThreshold ?? ''}
                      onChange={(e) => setFormState({ ...formState, lowStockThreshold: e.target.value })}
                      placeholder={`Défaut global (${globalLowStockThreshold})`}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 font-mono"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-3 p-4 rounded-lg bg-slate-50 border border-slate-200">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">Disponibilité numérique</label>
                    <select
                      value={formState.digitalAvailability || 'available'}
                      onChange={(e) => setFormState({ ...formState, digitalAvailability: e.target.value })}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    >
                      <option value="available">Disponible</option>
                      <option value="limited">Stock limité</option>
                      <option value="paused">Temporairement indisponible</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Modèle d’instructions d’activation (envoyé uniquement après validation)
                    </label>
                    <textarea
                      rows={2}
                      value={formState.digitalActivationTemplate || ''}
                      onChange={(e) => setFormState({ ...formState, digitalActivationTemplate: e.target.value })}
                      placeholder="Ne jamais mettre de mot de passe ou identifiant public ici."
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description courte</label>
                <input
                  value={formState.shortDescription || ''}
                  onChange={(e) => setFormState({ ...formState, shortDescription: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Description détaillée</label>
                <textarea
                  rows={3}
                  value={formState.description || ''}
                  onChange={(e) => setFormState({ ...formState, description: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
                />
              </div>

              <div className="flex items-center gap-6 text-sm">
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(formState.isFeatured)}
                    onChange={(e) => setFormState({ ...formState, isFeatured: e.target.checked })}
                  />
                  <span>Mettre en avant sur l’accueil</span>
                </label>
                <label className="inline-flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.isActive !== false}
                    onChange={(e) => setFormState({ ...formState, isActive: e.target.checked })}
                  />
                  <span>Visible sur la boutique</span>
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingProduct(null)}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  disabled={savingProduct}
                  className="px-5 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold"
                >
                  {savingProduct ? 'Enregistrement...' : 'Enregistrer'}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}

      {/* Product Multi-Photo Manager Modal */}
      {livePhotoProduct && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 flex items-center justify-center p-4" role="dialog" aria-modal="true">
          <div className="bg-white rounded-xl max-w-xl w-full border border-slate-200 shadow-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Photos — {livePhotoProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Téléversez directement vos photos depuis votre PC ou téléphone.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPhotoModalProduct(null)}
                className="p-2 rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-500 rounded-xl p-6 cursor-pointer bg-slate-50 transition-colors">
                <Upload className="w-6 h-6 text-blue-700 mb-2" />
                <span className="text-sm font-semibold text-slate-900">
                  {uploadingPhoto ? 'Téléversement en cours...' : 'Cliquez pour ajouter une ou plusieurs photos'}
                </span>
                <span className="text-xs text-slate-500 mt-1">PNG, JPG, WebP · Stockage persistant</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={uploadingPhoto}
                  className="hidden"
                  onChange={(e) => handleDirectPhotoUpload(livePhotoProduct.id, e.target.files)}
                />
              </label>

              <div className="flex gap-2">
                <input
                  value={photoUrlInput}
                  onChange={(e) => setPhotoUrlInput(e.target.value)}
                  placeholder="Ou coller une URL d’image (https://...)"
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-300"
                />
                <button
                  type="button"
                  disabled={uploadingPhoto || !photoUrlInput.trim()}
                  onClick={() => handleAddPhotoUrl(livePhotoProduct.id)}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-white text-xs font-semibold disabled:opacity-40"
                >
                  Ajouter URL
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                {(livePhotoProduct.images || []).map((img: any) => (
                  <div key={img.id} className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50">
                    <div className="aspect-square">
                      <ProductImage src={img.url} alt={livePhotoProduct.name} />
                    </div>
                    <div className="p-2 flex items-center justify-between gap-1 bg-white border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryPhoto(livePhotoProduct.id, img.id)}
                        className={`inline-flex items-center gap-1 text-[11px] font-medium ${
                          img.isPrimary ? 'text-blue-700' : 'text-slate-500 hover:text-slate-900'
                        }`}
                      >
                        {img.isPrimary ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3" />}
                        <span>{img.isPrimary ? 'Principale' : 'Définir'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(livePhotoProduct.id, img.id)}
                        className="text-slate-400 hover:text-red-600"
                        aria-label="Supprimer photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
