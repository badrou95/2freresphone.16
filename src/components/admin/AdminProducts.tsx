import React, { useMemo, useState } from 'react';
import {
  Camera,
  Check,
  Database,
  FolderPlus,
  ImagePlus,
  Pencil,
  Plus,
  Printer,
  Search,
  Sparkles,
  Star,
  Trash2,
  Upload,
  X,
  ZoomIn,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { printProductThermalLabels } from '../../lib/printer';
import { CATEGORY_GROUPS, formatDzd } from '../../shared/domain';
import { StoreSettings } from '../../types';
import { ImageZoomLightbox } from '../ImageZoomLightbox';
import { ProductImage } from '../ProductImage';
import { MdfIdfBinaryDecoderModule } from './MdfIdfBinaryDecoderModule';
import { OkwinImageStudio, ProductColorsEditor } from './OkwinImageStudio';

const QUICK_PRESET_CATEGORIES: {
  name: string;
  categoryGroup: 'accessories' | 'gaming' | 'digital';
  description: string;
}[] = [
  {
    name: 'Kits oreillettes filaires',
    categoryGroup: 'accessories',
    description: 'Écouteurs et kits piétons filaires Jack 3.5mm, Type-C et Lightning',
  },
  {
    name: 'Supports de téléphone',
    categoryGroup: 'accessories',
    description: 'Supports voiture, bureau, vélo et trépieds pour smartphones',
  },
  {
    name: 'Promotion',
    categoryGroup: 'accessories',
    description: 'Offres spéciales, déstockage et promotions flash',
  },
  {
    name: 'Écouteurs Bluetooth & AirPods',
    categoryGroup: 'accessories',
    description: 'Écouteurs sans fil TWS et casques audio Bluetooth',
  },
  {
    name: 'Chargeurs & Câbles Rapides',
    categoryGroup: 'accessories',
    description: 'Chargeurs secteur Fast Charge, GaN et câbles renforcés',
  },
  {
    name: 'Coques & Verres Trempés',
    categoryGroup: 'accessories',
    description: 'Protections antichoc et films verre trempé 9H',
  },
  {
    name: 'Batteries Externes (Powerbank)',
    categoryGroup: 'accessories',
    description: 'Powerbanks haute capacité 10000mAh à 30000mAh',
  },
  {
    name: 'Montres Connectées',
    categoryGroup: 'accessories',
    description: 'Smartwatches et bracelets connectés',
  },
];

interface AdminProductsProps {
  products: any[];
  categories: any[];
  globalLowStockThreshold: number;
  storeSettings?: Partial<StoreSettings>;
  initialOnlyMissingPhotos?: boolean;
  onRefresh: () => void;
}

export function AdminProducts({
  products,
  categories,
  globalLowStockThreshold,
  storeSettings = {},
  initialOnlyMissingPhotos = false,
  onRefresh,
}: AdminProductsProps) {
  const [subTab, setSubTab] = useState<'products' | 'categories'>('products');
  const [showMdfDecoder, setShowMdfDecoder] = useState<boolean>(true);
  const [search, setSearch] = useState('');
  const [onlyMissingPhotos, setOnlyMissingPhotos] = useState(initialOnlyMissingPhotos);
  const [typeFilter, setTypeFilter] = useState<'all' | 'physical' | 'digital'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  // Product modal
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [formState, setFormState] = useState<any>({});
  const [savingProduct, setSavingProduct] = useState(false);
  const [showModalOkwin, setShowModalOkwin] = useState(false);

  // Inline quick category creation inside Product modal
  const [showInlineNewCat, setShowInlineNewCat] = useState(false);
  const [inlineNewCatName, setInlineNewCatName] = useState('');

  // Fullscreen image zoom lightbox
  const [lightboxData, setLightboxData] = useState<{
    images: { url: string; alt?: string }[];
    initialIndex: number;
    title?: string;
  } | null>(null);

  // Quick Photo Gallery Modal for any product (ideal right after stock DB import!)
  const [photoModalProduct, setPhotoModalProduct] = useState<any | null>(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [photoUrlInput, setPhotoUrlInput] = useState('');
  const [showPhotoModalOkwin, setShowPhotoModalOkwin] = useState(false);
  const [selectedOkwinSourceUrl, setSelectedOkwinSourceUrl] = useState<string>('');

  // Category quick form (create & edit) + multi-select bulk delete
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [catName, setCatName] = useState('');
  const [catGroup, setCatGroup] = useState<'accessories' | 'gaming' | 'digital'>('accessories');
  const [catDescription, setCatDescription] = useState('');
  const [savingCategory, setSavingCategory] = useState(false);
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>([]);
  const [confirmBulkDeleteCats, setConfirmBulkDeleteCats] = useState(false);
  const [bulkDeletingCats, setBulkDeletingCats] = useState(false);

  const [feedbackError, setFeedbackError] = useState<string | null>(null);
  const [feedbackSuccess, setFeedbackSuccess] = useState<string | null>(null);
  const [confirmDeleteProdId, setConfirmDeleteProdId] = useState<number | null>(null);
  const [confirmDeleteCatId, setConfirmDeleteCatId] = useState<number | null>(null);

  // Multi-select & bulk delete state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const missingPhotoCount = products.filter((p) => !p.hasPhotos).length;

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products.filter((p) => {
      if (onlyMissingPhotos && p.hasPhotos) return false;
      if (typeFilter !== 'all' && p.productType !== typeFilter) return false;
      if (categoryFilter !== 'all' && String(p.categoryId || '') !== categoryFilter) return false;
      if (q) {
        const hay = `${p.name} ${p.sku} ${p.barcode || ''} ${p.categoryName} ${p.brand || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [products, search, onlyMissingPhotos, typeFilter, categoryFilter]);

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);
  const visibleIds = useMemo(() => filteredProducts.map((p) => p.id as number), [filteredProducts]);
  const allVisibleSelected =
    visibleIds.length > 0 && visibleIds.every((id) => selectedSet.has(id));
  const someVisibleSelected =
    visibleIds.some((id) => selectedSet.has(id)) && !allVisibleSelected;

  const toggleSelectOne = (id: number) => {
    setConfirmBulkDelete(false);
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAllVisible = () => {
    setConfirmBulkDelete(false);
    if (allVisibleSelected) {
      const visibleSet = new Set(visibleIds);
      setSelectedIds((prev) => prev.filter((id) => !visibleSet.has(id)));
    } else {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (!confirmBulkDelete) {
      setConfirmBulkDelete(true);
      return;
    }
    setBulkDeleting(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const res = await adminFetch<{ deletedCount: number }>('/api/admin/products/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedIds }),
      });
      setSelectedIds([]);
      setConfirmBulkDelete(false);
      setFeedbackSuccess(
        `${res.deletedCount} produit${res.deletedCount > 1 ? 's' : ''} supprimé${res.deletedCount > 1 ? 's' : ''} avec succès.`,
      );
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible de supprimer les produits sélectionnés.');
    } finally {
      setBulkDeleting(false);
    }
  };

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
      colors: [],
      imageUrls: [],
    });
    setShowModalOkwin(false);
  };

  const openEditModal = (p: any) => {
    setEditingProduct(p);
    const existingImageUrls = Array.isArray(p.images)
      ? p.images.map((i: any) => i.url).filter(Boolean)
      : p.primaryImage
      ? [p.primaryImage]
      : [];
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
      colors: Array.isArray(p.colors) ? p.colors : [],
      imageUrls: existingImageUrls,
    });
    setShowModalOkwin(false);
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

  // Upload photo inside Create/Edit product modal
  const handleModalPhotoUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setUploadingPhoto(true);
    setFeedbackError(null);
    try {
      const uploadedUrls: string[] = [];
      for (const file of Array.from(files)) {
        const fd = new FormData();
        fd.append('file', file);
        fd.append('kind', 'product');
        if (editingProduct && !editingProduct.isNew && editingProduct.id) {
          fd.append('productId', String(editingProduct.id));
        }
        const res = await adminFetch<{ url: string }>('/api/admin/media/upload', {
          method: 'POST',
          body: fd,
        });
        if (res.url) uploadedUrls.push(res.url);
      }
      setFormState((prev: any) => ({
        ...prev,
        imageUrls: Array.from(new Set([...(prev.imageUrls || []), ...uploadedUrls])),
      }));
      if (editingProduct && !editingProduct.isNew) {
        onRefresh();
      }
    } catch (err: any) {
      setFeedbackError(err.message || 'Erreur lors du téléversement.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const handleAttachOkwinImagesToModalProduct = async (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    if (editingProduct && !editingProduct.isNew && editingProduct.id) {
      for (const url of urls) {
        await adminFetch(`/api/admin/products/${editingProduct.id}/images`, {
          method: 'POST',
          body: JSON.stringify({ url }),
        });
      }
      onRefresh();
    }
    setFormState((prev: any) => ({
      ...prev,
      imageUrls: Array.from(new Set([...(prev.imageUrls || []), ...urls])),
    }));
  };

  const handleSetOkwinImageAsPrimaryInModal = async (url: string) => {
    if (!url) return;
    if (editingProduct && !editingProduct.isNew && editingProduct.id) {
      await adminFetch(`/api/admin/products/${editingProduct.id}/images`, {
        method: 'POST',
        body: JSON.stringify({ url, isPrimary: true }),
      });
      onRefresh();
    }
    setFormState((prev: any) => {
      const existing = Array.isArray(prev.imageUrls) ? prev.imageUrls : [];
      return {
        ...prev,
        imageUrls: [url, ...existing.filter((u: string) => u !== url)],
      };
    });
  };

  const handleSetModalPhotoPrimary = async (url: string) => {
    if (!url) return;
    setFormState((prev: any) => {
      const existing = Array.isArray(prev.imageUrls) ? prev.imageUrls : [];
      return {
        ...prev,
        imageUrls: [url, ...existing.filter((u: string) => u !== url)],
      };
    });
    if (editingProduct && !editingProduct.isNew && editingProduct.id) {
      const liveProd = products.find((p) => p.id === editingProduct.id) || editingProduct;
      const matchingImg = (liveProd.images || []).find((i: any) => i.url === url);
      if (matchingImg?.id) {
        await adminFetch(`/api/admin/products/${editingProduct.id}/images/${matchingImg.id}/primary`, {
          method: 'PATCH',
        });
      } else {
        await adminFetch(`/api/admin/products/${editingProduct.id}/images`, {
          method: 'POST',
          body: JSON.stringify({ url, isPrimary: true }),
        });
      }
      onRefresh();
    }
  };

  const handleRemoveModalPhoto = async (url: string) => {
    setFormState((prev: any) => {
      const existing = Array.isArray(prev.imageUrls) ? prev.imageUrls : [];
      return {
        ...prev,
        imageUrls: existing.filter((u: string) => u !== url),
      };
    });
    if (editingProduct && !editingProduct.isNew && editingProduct.id) {
      const liveProd = products.find((p) => p.id === editingProduct.id) || editingProduct;
      const matchingImg = (liveProd.images || []).find((i: any) => i.url === url);
      if (matchingImg?.id) {
        await adminFetch(`/api/admin/products/${editingProduct.id}/images/${matchingImg.id}`, {
          method: 'DELETE',
        });
        onRefresh();
      }
    }
  };

  const handleAttachOkwinImagesToPhotoModal = async (productId: number, urls: string[]) => {
    if (!urls || urls.length === 0) return;
    for (const url of urls) {
      await adminFetch(`/api/admin/products/${productId}/images`, {
        method: 'POST',
        body: JSON.stringify({ url }),
      });
    }
    onRefresh();
  };

  const handleSetOkwinImageAsPrimaryInPhotoModal = async (productId: number, url: string) => {
    if (!url) return;
    await adminFetch(`/api/admin/products/${productId}/images`, {
      method: 'POST',
      body: JSON.stringify({ url, isPrimary: true }),
    });
    onRefresh();
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

  const productCountByCategory = useMemo(() => {
    const counts = new Map<number, number>();
    for (const p of products) {
      if (p.categoryId) {
        counts.set(p.categoryId, (counts.get(p.categoryId) || 0) + 1);
      }
    }
    return counts;
  }, [products]);

  const selectedCatSet = useMemo(() => new Set(selectedCategoryIds), [selectedCategoryIds]);
  const allCatIds = useMemo(() => categories.map((c) => c.id as number), [categories]);
  const allCatsSelected =
    allCatIds.length > 0 && allCatIds.every((id) => selectedCatSet.has(id));
  const someCatsSelected =
    allCatIds.some((id) => selectedCatSet.has(id)) && !allCatsSelected;

  const toggleSelectCategory = (id: number) => {
    setConfirmBulkDeleteCats(false);
    setSelectedCategoryIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id],
    );
  };

  const toggleSelectAllCategories = () => {
    setConfirmBulkDeleteCats(false);
    if (allCatsSelected) {
      setSelectedCategoryIds([]);
    } else {
      setSelectedCategoryIds(allCatIds);
    }
  };

  const startEditCategory = (c: any) => {
    setEditingCategoryId(c.id);
    setCatName(c.name || '');
    setCatGroup((c.categoryGroup || 'accessories') as 'accessories' | 'gaming' | 'digital');
    setCatDescription(c.description || '');
    setFeedbackError(null);
  };

  const cancelEditCategory = () => {
    setEditingCategoryId(null);
    setCatName('');
    setCatGroup('accessories');
    setCatDescription('');
  };

  const handleQuickCreateCategory = async (
    name: string,
    group: 'accessories' | 'gaming' | 'digital' = 'accessories',
    description = '',
    selectInModal = false,
  ) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSavingCategory(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const created = await adminFetch<{ id: number; name: string }>('/api/admin/categories', {
        method: 'POST',
        body: JSON.stringify({
          name: trimmed,
          categoryGroup: group,
          description: description || null,
        }),
      });
      setFeedbackSuccess(`Catégorie « ${trimmed} » ajoutée avec succès.`);
      if (selectInModal && created?.id) {
        setFormState((prev: any) => ({ ...prev, categoryId: created.id }));
      }
      setInlineNewCatName('');
      setShowInlineNewCat(false);
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible de créer la catégorie.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catName.trim()) return;
    setSavingCategory(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const payload = {
        name: catName.trim(),
        categoryGroup: catGroup,
        description: catDescription.trim() || null,
      };
      if (editingCategoryId) {
        await adminFetch(`/api/admin/categories/${editingCategoryId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        setFeedbackSuccess(`Catégorie « ${catName.trim()} » modifiée avec succès.`);
      } else {
        await adminFetch('/api/admin/categories', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setFeedbackSuccess(`Catégorie « ${catName.trim()} » créée avec succès.`);
      }
      cancelEditCategory();
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible d’enregistrer la catégorie.');
    } finally {
      setSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number, skipConfirm = false) => {
    if (!skipConfirm && confirmDeleteCatId !== id) {
      setConfirmDeleteCatId(id);
      return;
    }
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      await adminFetch(`/api/admin/categories/${id}`, { method: 'DELETE' });
      setConfirmDeleteCatId(null);
      setSelectedCategoryIds((prev) => prev.filter((item) => item !== id));
      if (editingCategoryId === id) cancelEditCategory();
      if (String(formState.categoryId || '') === String(id)) {
        setFormState((prev: any) => ({ ...prev, categoryId: '' }));
      }
      setFeedbackSuccess('Catégorie supprimée avec succès.');
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible de supprimer la catégorie.');
    }
  };

  const handleBulkDeleteCategories = async () => {
    if (selectedCategoryIds.length === 0) return;
    if (!confirmBulkDeleteCats) {
      setConfirmBulkDeleteCats(true);
      return;
    }
    setBulkDeletingCats(true);
    setFeedbackError(null);
    setFeedbackSuccess(null);
    try {
      const res = await adminFetch<{ deletedCount: number }>('/api/admin/categories/bulk-delete', {
        method: 'POST',
        body: JSON.stringify({ ids: selectedCategoryIds }),
      });
      if (editingCategoryId && selectedCategoryIds.includes(editingCategoryId)) {
        cancelEditCategory();
      }
      setSelectedCategoryIds([]);
      setConfirmBulkDeleteCats(false);
      setFeedbackSuccess(
        `${res.deletedCount} catégorie${res.deletedCount > 1 ? 's' : ''} supprimée${res.deletedCount > 1 ? 's' : ''} avec succès (les produits associés restent conservés).`,
      );
      onRefresh();
    } catch (err: any) {
      setFeedbackError(err.message || 'Impossible de supprimer les catégories sélectionnées.');
    } finally {
      setBulkDeletingCats(false);
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
      {feedbackSuccess && (
        <div className="p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-medium flex items-center justify-between">
          <span>{feedbackSuccess}</span>
          <button type="button" onClick={() => setFeedbackSuccess(null)} className="font-semibold underline">
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
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setShowMdfDecoder((v) => !v)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
            >
              <Database className="w-4 h-4" />
              <span>
                {showMdfDecoder
                  ? 'Masquer Décodage Binaire .MDF + .IDF'
                  : '+ Ajouter le Stock (.MDF + .IDF / Compta)'}
              </span>
            </button>
            <button
              type="button"
              onClick={openCreateModal}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold"
            >
              <Plus className="w-4 h-4" />
              <span>Nouveau produit</span>
            </button>
          </div>
        )}
      </div>

      {showMdfDecoder && (
        <MdfIdfBinaryDecoderModule
          categories={categories}
          onRefresh={onRefresh}
        />
      )}

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

              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                aria-label="Filtrer par catégorie"
                className="px-3 py-2 text-sm rounded-lg border border-slate-300 bg-white"
              >
                <option value="all">Toutes les catégories</option>
                {categories.map((c) => (
                  <option key={c.id} value={String(c.id)}>
                    {c.name}
                  </option>
                ))}
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

          {/* Bulk Selection Action Bar */}
          {selectedIds.length > 0 && (
            <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex flex-wrap items-center gap-3 text-xs">
                <span className="font-bold">
                  {selectedIds.length} produit{selectedIds.length > 1 ? 's' : ''} sélectionné
                  {selectedIds.length > 1 ? 's' : ''}
                </span>
                {!allVisibleSelected && visibleIds.length > 0 && (
                  <button
                    type="button"
                    onClick={toggleSelectAllVisible}
                    className="underline text-blue-300 hover:text-white font-medium"
                  >
                    Tout sélectionner ({visibleIds.length})
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedIds([]);
                    setConfirmBulkDelete(false);
                  }}
                  className="underline text-slate-300 hover:text-white"
                >
                  Tout désélectionner
                </button>
              </div>
              <div className="flex items-center gap-2">
                {confirmBulkDelete && (
                  <button
                    type="button"
                    disabled={bulkDeleting}
                    onClick={() => setConfirmBulkDelete(false)}
                    className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                  >
                    Annuler
                  </button>
                )}
                <button
                  type="button"
                  disabled={bulkDeleting}
                  onClick={handleBulkDelete}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    confirmBulkDelete
                      ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-300'
                      : 'bg-red-600/90 hover:bg-red-600 text-white'
                  }`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>
                    {bulkDeleting
                      ? 'Suppression en cours...'
                      : confirmBulkDelete
                      ? `Confirmer la suppression (${selectedIds.length}) ?`
                      : `Supprimer la sélection (${selectedIds.length})`}
                  </span>
                </button>
              </div>
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 pl-4 pr-2 w-10">
                      <input
                        type="checkbox"
                        checked={allVisibleSelected}
                        ref={(el) => {
                          if (el) el.indeterminate = someVisibleSelected;
                        }}
                        onChange={toggleSelectAllVisible}
                        aria-label="Sélectionner tous les produits affichés"
                        title="Tout sélectionner / Tout désélectionner"
                        className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                      />
                    </th>
                    <th className="py-3 px-4 font-semibold">Produit</th>
                    <th className="py-3 px-4 font-semibold">Catégorie / Type</th>
                    <th className="py-3 px-4 font-semibold text-right">Prix vente / achat</th>
                    <th className="py-3 px-4 font-semibold text-right">Stock / Seuil</th>
                    <th className="py-3 px-4 font-semibold text-right">Photos &amp; Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredProducts.map((p) => {
                    const isSelected = selectedSet.has(p.id);
                    return (
                    <tr key={p.id} className={isSelected ? 'bg-blue-50/50' : 'hover:bg-slate-50'}>
                      <td className="py-3 pl-4 pr-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSelectOne(p.id)}
                          aria-label={`Sélectionner ${p.name}`}
                          className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                        />
                      </td>
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
                            {Array.isArray(p.colors) && p.colors.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                {p.colors.slice(0, 6).map((c: any, idx: number) => (
                                  <span
                                    key={idx}
                                    title={c.name}
                                    className="w-3 h-3 rounded-full border border-slate-300"
                                    style={{ backgroundColor: c.hex }}
                                  />
                                ))}
                                <span className="text-[10px] text-slate-500 ml-0.5">
                                  ({p.colors.length} couleur{p.colors.length > 1 ? 's' : ''})
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        <span className="font-medium text-slate-800">{p.categoryName}</span>
                        <span className="block text-slate-400">
                          {p.productType === 'digital' ? 'Numérique' : 'Physique'}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        <span className="font-semibold text-slate-900">{formatDzd(p.priceDzd)}</span>
                        <span className="block text-[11px] text-slate-400">
                          Achat : {formatDzd(p.costPriceDzd || 0)}
                        </span>
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
                            onClick={() =>
                              printProductThermalLabels(
                                [
                                  {
                                    name: p.name,
                                    sku: p.sku,
                                    barcode: p.barcode || p.sku,
                                    priceDzd: p.priceDzd,
                                    copies: 1,
                                  },
                                ],
                                storeSettings,
                              )
                            }
                            title="Imprimer étiquette thermique"
                            aria-label={`Imprimer étiquette ${p.name}`}
                            className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                          >
                            <Printer className="w-3.5 h-3.5" />
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
                    );
                  })}
                  {filteredProducts.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
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
            onSubmit={handleSaveCategory}
            className={`lg:col-span-4 bg-white border rounded-xl p-5 space-y-4 h-fit ${
              editingCategoryId ? 'border-blue-400 ring-1 ring-blue-100' : 'border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                {editingCategoryId ? (
                  <Pencil className="w-4 h-4 text-blue-700" />
                ) : (
                  <FolderPlus className="w-4 h-4 text-blue-700" />
                )}
                <h3 className="font-display font-semibold text-base text-slate-900">
                  {editingCategoryId ? 'Modifier la catégorie' : 'Ajouter une catégorie'}
                </h3>
              </div>
              {editingCategoryId && (
                <button
                  type="button"
                  onClick={cancelEditCategory}
                  className="text-xs font-semibold text-slate-500 hover:text-slate-800"
                >
                  Annuler
                </button>
              )}
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Nom de catégorie *</label>
              <input
                required
                value={catName}
                onChange={(e) => setCatName(e.target.value)}
                placeholder="Ex. Kits oreillettes filaires, Supports de téléphone, Promotion..."
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
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Description (optionnel)
              </label>
              <input
                value={catDescription}
                onChange={(e) => setCatDescription(e.target.value)}
                placeholder="Courte description de la catégorie..."
                className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300"
              />
            </div>
            <div className="flex items-center gap-2">
              {editingCategoryId && (
                <button
                  type="button"
                  onClick={cancelEditCategory}
                  className="flex-1 py-2.5 px-4 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold"
                >
                  Annuler
                </button>
              )}
              <button
                type="submit"
                disabled={savingCategory}
                className={`flex-1 py-2.5 px-4 rounded-lg text-white text-xs font-semibold ${
                  editingCategoryId
                    ? 'bg-blue-700 hover:bg-blue-800'
                    : 'bg-slate-900 hover:bg-slate-800'
                }`}
              >
                {savingCategory
                  ? 'Enregistrement...'
                  : editingCategoryId
                  ? 'Enregistrer la modification'
                  : 'Créer la catégorie'}
              </button>
            </div>

            {/* 1-Click Quick Suggested Categories */}
            <div className="pt-3 border-t border-slate-200 space-y-2">
              <span className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                Ajout rapide en 1 clic :
              </span>
              <div className="flex flex-wrap gap-1.5">
                {QUICK_PRESET_CATEGORIES.map((preset) => {
                  const exists = categories.some(
                    (c) => (c.name || '').trim().toLowerCase() === preset.name.toLowerCase(),
                  );
                  return (
                    <button
                      key={preset.name}
                      type="button"
                      disabled={savingCategory || exists}
                      onClick={() =>
                        handleQuickCreateCategory(
                          preset.name,
                          preset.categoryGroup,
                          preset.description,
                          false,
                        )
                      }
                      className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold border transition-colors ${
                        exists
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200 cursor-default'
                          : 'bg-slate-50 hover:bg-blue-50 text-slate-800 hover:text-blue-700 border-slate-200 hover:border-blue-300'
                      }`}
                    >
                      {exists ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                      <span>{preset.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </form>

          <div className="lg:col-span-8 space-y-3">
            {/* Bulk Category Selection Bar */}
            {selectedCategoryIds.length > 0 && (
              <div className="bg-slate-900 text-white rounded-xl px-4 py-3 flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <span className="font-bold">
                    {selectedCategoryIds.length} catégorie
                    {selectedCategoryIds.length > 1 ? 's' : ''} sélectionnée
                    {selectedCategoryIds.length > 1 ? 's' : ''}
                  </span>
                  {!allCatsSelected && allCatIds.length > 0 && (
                    <button
                      type="button"
                      onClick={toggleSelectAllCategories}
                      className="underline text-blue-300 hover:text-white font-medium"
                    >
                      Tout sélectionner ({allCatIds.length})
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedCategoryIds([]);
                      setConfirmBulkDeleteCats(false);
                    }}
                    className="underline text-slate-300 hover:text-white"
                  >
                    Tout désélectionner
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  {confirmBulkDeleteCats && (
                    <button
                      type="button"
                      disabled={bulkDeletingCats}
                      onClick={() => setConfirmBulkDeleteCats(false)}
                      className="px-3 py-1.5 rounded-lg border border-slate-600 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                    >
                      Annuler
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={bulkDeletingCats}
                    onClick={handleBulkDeleteCategories}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                      confirmBulkDeleteCats
                        ? 'bg-red-600 hover:bg-red-700 text-white ring-2 ring-red-300'
                        : 'bg-red-600/90 hover:bg-red-600 text-white'
                    }`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>
                      {bulkDeletingCats
                        ? 'Suppression...'
                        : confirmBulkDeleteCats
                        ? `Confirmer la suppression (${selectedCategoryIds.length}) ?`
                        : `Supprimer la sélection (${selectedCategoryIds.length})`}
                    </span>
                  </button>
                </div>
              </div>
            )}

            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                    <tr>
                      <th className="py-3 pl-4 pr-2 w-10">
                        <input
                          type="checkbox"
                          checked={allCatsSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someCatsSelected;
                          }}
                          onChange={toggleSelectAllCategories}
                          aria-label="Sélectionner toutes les catégories"
                          title="Tout sélectionner / Tout désélectionner"
                          className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                        />
                      </th>
                      <th className="py-3 px-4 font-semibold">Nom</th>
                      <th className="py-3 px-4 font-semibold">Rayon</th>
                      <th className="py-3 px-4 font-semibold text-right">Produits</th>
                      <th className="py-3 px-4 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {categories.map((c) => {
                      const isSelected = selectedCatSet.has(c.id);
                      const isEditing = editingCategoryId === c.id;
                      const prodCount = productCountByCategory.get(c.id) || 0;
                      return (
                        <tr
                          key={c.id}
                          className={
                            isEditing
                              ? 'bg-blue-50/70'
                              : isSelected
                              ? 'bg-blue-50/40'
                              : 'hover:bg-slate-50'
                          }
                        >
                          <td className="py-2.5 pl-4 pr-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleSelectCategory(c.id)}
                              aria-label={`Sélectionner ${c.name}`}
                              className="w-4 h-4 rounded border-slate-300 text-blue-700 focus:ring-blue-600 cursor-pointer"
                            />
                          </td>
                          <td className="py-2.5 px-4">
                            <p className="font-medium text-slate-900">{c.name}</p>
                            <p className="font-mono text-[11px] text-slate-400">
                              {c.slug}
                              {c.description ? ` · ${c.description}` : ''}
                            </p>
                          </td>
                          <td className="py-2.5 px-4 text-xs text-slate-600">
                            {CATEGORY_GROUPS.find((g) => g.value === c.categoryGroup)?.label ||
                              c.categoryGroup}
                          </td>
                          <td className="py-2.5 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                            {prodCount}
                          </td>
                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => startEditCategory(c)}
                                aria-label={`Modifier ${c.name}`}
                                title="Modifier la catégorie"
                                className={`p-1.5 rounded-lg border text-xs ${
                                  isEditing
                                    ? 'bg-blue-700 text-white border-blue-700'
                                    : 'border-slate-200 hover:bg-slate-100 text-slate-600'
                                }`}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteCategory(c.id)}
                                aria-label={`Supprimer ${c.name}`}
                                title="Supprimer la catégorie"
                                className={`px-2 py-1.5 rounded-lg border text-xs font-medium ${
                                  confirmDeleteCatId === c.id
                                    ? 'bg-red-600 text-white border-red-600'
                                    : 'border-slate-200 hover:bg-red-50 text-slate-400 hover:text-red-600'
                                }`}
                              >
                                {confirmDeleteCatId === c.id ? (
                                  'Confirmer ?'
                                ) : (
                                  <Trash2 className="w-3.5 h-3.5" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                    {categories.length === 0 && (
                      <tr>
                        <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                          Aucune catégorie créée pour l’instant.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
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
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <label className="block text-xs font-semibold text-slate-700">Catégorie</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setShowInlineNewCat((v) => !v)}
                        className="text-[11px] font-bold text-blue-700 hover:underline inline-flex items-center gap-0.5"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Nouvelle catégorie</span>
                      </button>
                      {formState.categoryId && (
                        <button
                          type="button"
                          onClick={() => handleDeleteCategory(Number(formState.categoryId), true)}
                          className="text-[11px] font-semibold text-red-600 hover:underline inline-flex items-center gap-0.5"
                          title="Supprimer la catégorie actuellement sélectionnée"
                        >
                          <Trash2 className="w-3 h-3" />
                          <span>Supprimer</span>
                        </button>
                      )}
                    </div>
                  </div>
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

                  {/* Inline New Category Creator inside Product Modal */}
                  {showInlineNewCat && (
                    <div className="flex items-center gap-1.5 pt-1">
                      <input
                        value={inlineNewCatName}
                        onChange={(e) => setInlineNewCatName(e.target.value)}
                        placeholder="Ex. Kits oreillettes filaires, Supports..."
                        className="flex-1 px-2.5 py-1.5 text-xs rounded-lg border border-blue-300 bg-blue-50/40"
                      />
                      <button
                        type="button"
                        disabled={savingCategory || !inlineNewCatName.trim()}
                        onClick={() =>
                          handleQuickCreateCategory(inlineNewCatName, 'accessories', '', true)
                        }
                        className="px-2.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:opacity-40 text-white text-xs font-bold"
                      >
                        Ajouter
                      </button>
                    </div>
                  )}

                  {/* Quick 1-click preset chips right below category select if missing */}
                  <div className="flex flex-wrap gap-1 pt-0.5">
                    {QUICK_PRESET_CATEGORIES.slice(0, 4).map((preset) => {
                      const existing = categories.find(
                        (c) => (c.name || '').trim().toLowerCase() === preset.name.toLowerCase(),
                      );
                      if (existing) {
                        const isSelected = String(formState.categoryId || '') === String(existing.id);
                        return (
                          <button
                            key={preset.name}
                            type="button"
                            onClick={() => setFormState({ ...formState, categoryId: existing.id })}
                            className={`px-2 py-0.5 rounded text-[10px] font-semibold border transition-colors ${
                              isSelected
                                ? 'bg-blue-700 text-white border-blue-700'
                                : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                            }`}
                          >
                            {preset.name}
                          </button>
                        );
                      }
                      return (
                        <button
                          key={preset.name}
                          type="button"
                          disabled={savingCategory}
                          onClick={() =>
                            handleQuickCreateCategory(
                              preset.name,
                              preset.categoryGroup,
                              preset.description,
                              true,
                            )
                          }
                          className="px-2 py-0.5 rounded text-[10px] font-semibold bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200"
                          title={`Créer et sélectionner « ${preset.name} »`}
                        >
                          + {preset.name}
                        </button>
                      );
                    })}
                  </div>
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

              {/* Available Colors Editor */}
              <ProductColorsEditor
                colors={Array.isArray(formState.colors) ? formState.colors : []}
                onChange={(nextColors) => setFormState({ ...formState, colors: nextColors })}
                availableImages={Array.isArray(formState.imageUrls) ? formState.imageUrls : []}
              />

              {/* Product Photos + Okwin AI Studio (Background Changer & Multi-Image Prompt Generator) */}
              <div className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h4 className="text-xs font-bold text-slate-900">
                      Photos du produit ({(formState.imageUrls || []).length})
                    </h4>
                    <p className="text-[11px] text-slate-500">
                      Cliquez sur <strong>⭐ Principale</strong> pour choisir la photo n°1 ou sur{' '}
                      <strong>×</strong> pour supprimer une photo.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-white hover:bg-blue-50 text-blue-700 text-xs font-semibold cursor-pointer">
                      <Upload className="w-3.5 h-3.5" />
                      <span>{uploadingPhoto ? 'Envoi...' : 'Ajouter photos'}</span>
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={(e) => handleModalPhotoUpload(e.target.files)}
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowModalOkwin((prev) => !prev)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold shadow-2xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>
                        {showModalOkwin ? 'Masquer Okwin AI' : 'Okwin AI · Modifier l’arrière-plan'}
                      </span>
                    </button>
                  </div>
                </div>

                {Array.isArray(formState.imageUrls) && formState.imageUrls.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
                    {formState.imageUrls.map((url: string, idx: number) => {
                      const isPrimary = idx === 0;
                      return (
                        <div
                          key={`${url}-${idx}`}
                          className={`rounded-xl overflow-hidden border bg-white flex flex-col ${
                            isPrimary ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'
                          }`}
                        >
                          <div className="relative aspect-square bg-white">
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxData({
                                  images: formState.imageUrls.map((u: string, i: number) => ({
                                    url: u,
                                    alt: `${formState.name || 'Produit'} - Photo ${i + 1}`,
                                  })),
                                  initialIndex: idx,
                                  title: formState.name || 'Photo du produit',
                                })
                              }
                              className="w-full h-full block cursor-zoom-in"
                              title="Cliquer pour agrandir la photo"
                            >
                              <ProductImage src={url} alt={`Photo ${idx + 1}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setLightboxData({
                                  images: formState.imageUrls.map((u: string, i: number) => ({
                                    url: u,
                                    alt: `${formState.name || 'Produit'} - Photo ${i + 1}`,
                                  })),
                                  initialIndex: idx,
                                  title: formState.name || 'Photo du produit',
                                })
                              }
                              className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-blue-700 text-white flex items-center justify-center"
                              title="Agrandir l'image"
                            >
                              <ZoomIn className="w-3 h-3" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveModalPhoto(url)}
                              className="absolute top-1.5 right-1.5 w-6 h-6 rounded-full bg-red-600/90 hover:bg-red-700 text-white flex items-center justify-center shadow-xs"
                              title="Supprimer cette photo"
                              aria-label={`Supprimer photo ${idx + 1}`}
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          <div className="p-1.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-1">
                            {isPrimary ? (
                              <span className="w-full inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-blue-700 text-white text-[10px] font-bold">
                                <Check className="w-3 h-3" />
                                <span>Photo Principale</span>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleSetModalPhotoPrimary(url)}
                                className="w-full inline-flex items-center justify-center gap-1 py-1 px-2 rounded-lg bg-white hover:bg-amber-50 text-slate-700 hover:text-amber-800 border border-slate-200 hover:border-amber-300 text-[10px] font-bold transition-colors"
                                title="Choisir cette photo comme Photo Principale"
                              >
                                <Star className="w-3 h-3 text-amber-500" />
                                <span>Choisir Principale</span>
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {showModalOkwin && (
                  <OkwinImageStudio
                    sourceImageUrl={(formState.imageUrls || [])[0] || ''}
                    productName={formState.name || 'Produit 2Frères Phone'}
                    onSourceImageUploaded={(url) =>
                      setFormState((prev: any) => ({
                        ...prev,
                        imageUrls: Array.from(new Set([url, ...(prev.imageUrls || [])])),
                      }))
                    }
                    onAddGeneratedImages={handleAttachOkwinImagesToModalProduct}
                    onSetPrimaryImage={handleSetOkwinImageAsPrimaryInModal}
                  />
                )}
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
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-slate-200 shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h3 className="font-display font-bold text-base text-slate-900">
                  Photos — {livePhotoProduct.name}
                </h3>
                <p className="text-xs text-slate-500">
                  Cliquez sur une photo pour l’agrandir, choisissez la photo principale ou supprimez-la.
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

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {(livePhotoProduct.images || []).map((img: any, idx: number) => (
                  <div
                    key={img.id}
                    className={`border rounded-xl overflow-hidden bg-slate-50 ${
                      img.isPrimary ? 'border-blue-600 ring-2 ring-blue-500/20' : 'border-slate-200'
                    }`}
                  >
                    <div className="relative aspect-square bg-white">
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxData({
                            images: (livePhotoProduct.images || []).map((im: any, i: number) => ({
                              url: im.url,
                              alt: `${livePhotoProduct.name} - Photo ${i + 1}`,
                            })),
                            initialIndex: idx,
                            title: livePhotoProduct.name,
                          })
                        }
                        className="w-full h-full block cursor-zoom-in"
                        title="Cliquer pour agrandir la photo"
                      >
                        <ProductImage src={img.url} alt={livePhotoProduct.name} />
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          setLightboxData({
                            images: (livePhotoProduct.images || []).map((im: any, i: number) => ({
                              url: im.url,
                              alt: `${livePhotoProduct.name} - Photo ${i + 1}`,
                            })),
                            initialIndex: idx,
                            title: livePhotoProduct.name,
                          })
                        }
                        className="absolute top-1.5 left-1.5 w-6 h-6 rounded-full bg-slate-900/75 hover:bg-blue-700 text-white flex items-center justify-center"
                        title="Agrandir l'image"
                      >
                        <ZoomIn className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="p-2 flex items-center justify-between gap-1 bg-white border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleSetPrimaryPhoto(livePhotoProduct.id, img.id)}
                        className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-md ${
                          img.isPrimary
                            ? 'bg-blue-700 text-white'
                            : 'bg-slate-100 text-slate-700 hover:bg-amber-50 hover:text-amber-800'
                        }`}
                      >
                        {img.isPrimary ? <Check className="w-3 h-3" /> : <Star className="w-3 h-3 text-amber-500" />}
                        <span>{img.isPrimary ? 'Principale' : 'Choisir'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedOkwinSourceUrl(img.url);
                          setShowPhotoModalOkwin(true);
                        }}
                        title="Modifier l’arrière-plan avec Okwin AI"
                        className="text-indigo-600 hover:text-indigo-800 text-[11px] font-bold inline-flex items-center gap-0.5"
                      >
                        <Sparkles className="w-3 h-3" />
                        <span>Okwin</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePhoto(livePhotoProduct.id, img.id)}
                        className="p-1 rounded-md text-red-500 hover:bg-red-50 hover:text-red-700"
                        title="Supprimer cette photo"
                        aria-label="Supprimer photo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Okwin AI Studio inside Photo Manager Modal */}
              <div className="pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedOkwinSourceUrl && livePhotoProduct.images?.[0]?.url) {
                      setSelectedOkwinSourceUrl(livePhotoProduct.images[0].url);
                    }
                    setShowPhotoModalOkwin((prev) => !prev);
                  }}
                  className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-2 shadow-sm"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {showPhotoModalOkwin
                      ? 'Masquer Okwin AI Photo Studio'
                      : 'Okwin AI · Modifier l’arrière-plan & Générer d’autres images via Prompts'}
                  </span>
                </button>

                {showPhotoModalOkwin && (
                  <div className="mt-3">
                    <OkwinImageStudio
                      sourceImageUrl={
                        selectedOkwinSourceUrl || livePhotoProduct.images?.[0]?.url || ''
                      }
                      productName={livePhotoProduct.name}
                      onSourceImageUploaded={(url) => {
                        setSelectedOkwinSourceUrl(url);
                        handleAttachOkwinImagesToPhotoModal(livePhotoProduct.id, [url]);
                      }}
                      onAddGeneratedImages={(urls) =>
                        handleAttachOkwinImagesToPhotoModal(livePhotoProduct.id, urls)
                      }
                      onSetPrimaryImage={(url) =>
                        handleSetOkwinImageAsPrimaryInPhotoModal(livePhotoProduct.id, url)
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {lightboxData && (
        <ImageZoomLightbox
          images={lightboxData.images}
          initialIndex={lightboxData.initialIndex}
          title={lightboxData.title}
          onClose={() => setLightboxData(null)}
        />
      )}
    </div>
  );
}
