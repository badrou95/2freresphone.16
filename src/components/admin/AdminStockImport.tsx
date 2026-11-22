import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Calculator,
  Camera,
  CheckCircle2,
  Database,
  Download,
  FileSpreadsheet,
  HardDrive,
  History,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { printProductThermalLabels } from '../../lib/printer';
import { formatDzd, toCsv } from '../../shared/domain';
import { StoreSettings } from '../../types';
import { FinancialMarginWidget } from './FinancialMarginWidget';
import {
  MdfIdfBinaryDecoderModule,
  uploadDatabaseFilesInChunks,
} from './MdfIdfBinaryDecoderModule';

interface AdminStockImportProps {
  products: any[];
  categories: any[];
  stockData: any;
  storeSettings?: Partial<StoreSettings>;
  initialSubTab?: 'import' | 'levels' | 'compta' | 'alerts';
  onRefresh: () => void;
  onGoToMissingPhotos: () => void;
}

const MAPPING_FIELDS: { key: string; label: string; required?: boolean }[] = [
  { key: 'name', label: 'Nom / Désignation *', required: true },
  { key: 'sku', label: 'Référence / SKU' },
  { key: 'barcode', label: 'Code-barres' },
  { key: 'priceDzd', label: 'Prix de vente (DZD)' },
  { key: 'costPriceDzd', label: 'Prix d’achat (DZD)' },
  { key: 'stockQuantity', label: 'Quantité en stock' },
  { key: 'categoryName', label: 'Catégorie / Famille' },
  { key: 'brand', label: 'Marque' },
  { key: 'lowStockThreshold', label: 'Seuil alerte stock' },
  { key: 'description', label: 'Description' },
];

export function AdminStockImport({
  products,
  categories,
  stockData,
  storeSettings = {},
  initialSubTab = 'import',
  onRefresh,
  onGoToMissingPhotos,
}: AdminStockImportProps) {
  const [subTab, setSubTab] = useState<'import' | 'levels' | 'compta' | 'alerts'>(() => {
    if (initialSubTab) return initialSubTab;
    try {
      const saved = localStorage.getItem('2fp_admin_stock_subtab');
      if (saved === 'import' || saved === 'levels' || saved === 'compta' || saved === 'alerts') {
        return saved;
      }
    } catch {
      // ignore storage errors
    }
    return 'import';
  });

  const handleChangeSubTab = (next: 'import' | 'levels' | 'compta' | 'alerts') => {
    setSubTab(next);
    try {
      localStorage.setItem('2fp_admin_stock_subtab', next);
    } catch {
      // ignore
    }
  };

  // Dual .MDF + .IDF and Universal Stock/Compta Database Import State
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mdfFile, setMdfFile] = useState<File | null>(null);
  const [idfFile, setIdfFile] = useState<File | null>(null);
  const [generateAccounting, setGenerateAccounting] = useState<boolean>(true);
  const [syncMode, setSyncMode] = useState<'add_only' | 'add_and_update_stock' | 'full_sync'>('full_sync');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [saveProfileName, setSaveProfileName] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);

  // Compta manual entry & filter state
  const [comptaSearch, setComptaSearch] = useState('');
  const [comptaTypeFilter, setComptaTypeFilter] = useState<string>('all');
  const [newEntryType, setNewEntryType] = useState<'sale' | 'purchase' | 'expense' | 'stock_valuation'>('sale');
  const [newEntryLabel, setNewEntryLabel] = useState('');
  const [newEntryPartner, setNewEntryPartner] = useState('');
  const [newEntryAmount, setNewEntryAmount] = useState('');
  const [newEntryCost, setNewEntryCost] = useState('');
  const [addingEntry, setAddingEntry] = useState(false);

  // Manual quick stock adjust & inline editor (quantity, cost price, sale price)
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [savingInlineId, setSavingInlineId] = useState<number | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [levelSearch, setLevelSearch] = useState('');
  const [draftRows, setDraftRows] = useState<
    Record<number, { stockQuantity: string; costPriceDzd: string; priceDzd: string }>
  >({});
  const [stockFeedback, setStockFeedback] = useState<{ type: 'ok' | 'err'; msg: string } | null>(null);

  const runPreview = async (
    filesToAnalyze: File[],
    opts?: { tableName?: string; mode?: string; customMapping?: Record<string, string> },
  ) => {
    if (!filesToAnalyze || filesToAnalyze.length === 0) return;
    setParsing(true);
    setImportError(null);
    setCommitResult(null);
    try {
      await uploadDatabaseFilesInChunks(filesToAnalyze);
      const res = await adminFetch<any>('/api/admin/stock/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          useStoredBackup: true,
          syncMode: opts?.mode || syncMode,
          ...(opts?.tableName ? { tableName: opts.tableName } : {}),
          ...(opts?.customMapping && opts.customMapping.name
            ? { mappingJson: JSON.stringify(opts.customMapping) }
            : {}),
        }),
      });
      setPreview(res);
      setSelectedTable(res.selectedTable);
      setMapping(res.mapping || {});
    } catch (err: any) {
      setPreview(null);
      setImportError(err.message || 'Impossible d’analyser ces fichiers de sauvegarde.');
    } finally {
      setParsing(false);
    }
  };

  const handleSpecificMdfOrIdfChange = (kind: 'mdf' | 'idf', file: File | null) => {
    const nextMdf = kind === 'mdf' ? file : mdfFile;
    const nextIdf = kind === 'idf' ? file : idfFile;
    if (kind === 'mdf') setMdfFile(file);
    if (kind === 'idf') setIdfFile(file);
    const combined = [nextMdf, nextIdf].filter(Boolean) as File[];
    setSelectedFiles(combined);
    if (combined.length > 0) {
      runPreview(combined);
    }
  };

  const handleMultiFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = Array.from(e.target.files || []) as File[];
    if (fileList.length === 0) return;
    const detectedMdf = fileList.find((f) => /\.(mdf|ndf)$/i.test(f.name)) || null;
    const detectedIdf = fileList.find((f) => /\.(idf|ldf|idx|ndx)$/i.test(f.name)) || null;
    if (detectedMdf) setMdfFile(detectedMdf);
    if (detectedIdf) setIdfFile(detectedIdf);
    setSelectedFiles(fileList);
    runPreview(fileList);
  };

  const handleApplySavedProfile = (profile: any) => {
    try {
      const parsedMap = JSON.parse(profile.columnMappingJson);
      setMapping(parsedMap);
      setSyncMode(profile.defaultSyncMode || 'full_sync');
      if (selectedFiles.length > 0) {
        runPreview(selectedFiles, {
          tableName: profile.tableOrSheetName || selectedTable,
          mode: profile.defaultSyncMode || 'full_sync',
          customMapping: parsedMap,
        });
      }
    } catch {
      // ignore invalid json
    }
  };

  const handleCommitImport = async () => {
    if (selectedFiles.length === 0) {
      setImportError('Veuillez d’abord sélectionner votre fichier .MDF ou .IDF.');
      return;
    }
    setCommitting(true);
    setImportError(null);
    try {
      await uploadDatabaseFilesInChunks(selectedFiles);
      const res = await adminFetch<any>('/api/admin/stock/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          useStoredBackup: true,
          syncMode,
          ...(selectedTable ? { tableName: selectedTable } : {}),
          ...(mapping && mapping.name ? { mappingJson: JSON.stringify(mapping) } : {}),
          generateAccounting: generateAccounting ? 'true' : 'false',
          ...(defaultCategoryId ? { defaultCategoryId } : {}),
          ...(saveProfileName.trim() ? { saveProfileName: saveProfileName.trim() } : {}),
        }),
      });
      setCommitResult(res);
      setPreview(null);
      setSelectedFiles([]);
      setMdfFile(null);
      setIdfFile(null);
      setSaveProfileName('');
      onRefresh();
    } catch (err: any) {
      setImportError(err.message || 'Erreur lors de l’importation de la sauvegarde.');
    } finally {
      setCommitting(false);
    }
  };

  const handleAddAccountingEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEntryLabel.trim()) return;
    setAddingEntry(true);
    try {
      await adminFetch('/api/admin/accounting', {
        method: 'POST',
        body: JSON.stringify({
          entryType: newEntryType,
          category:
            newEntryType === 'sale'
              ? 'Ventes & Encaissements'
              : newEntryType === 'purchase'
              ? 'Achats Fournisseurs & Stock'
              : newEntryType === 'expense'
              ? 'Charges & Dépenses'
              : 'Valorisation Comptable du Stock',
          label: newEntryLabel.trim(),
          partnerName: newEntryPartner.trim() || 'Comptabilité 2Frères Phone',
          amountDzd: Math.max(0, Math.round(Number(newEntryAmount) || 0)),
          costDzd: Math.max(0, Math.round(Number(newEntryCost) || 0)),
        }),
      });
      setNewEntryLabel('');
      setNewEntryPartner('');
      setNewEntryAmount('');
      setNewEntryCost('');
      onRefresh();
    } catch (err: any) {
      setStockFeedback({ type: 'err', msg: err?.message || 'Impossible d’ajouter l’écriture comptable.' });
    } finally {
      setAddingEntry(false);
    }
  };

  const handleDeleteAccountingEntry = async (id: number) => {
    try {
      await adminFetch(`/api/admin/accounting/${id}`, { method: 'DELETE' });
      onRefresh();
    } catch {
      // ignore
    }
  };

  const handleQuickAdjust = async (productId: number, delta: number) => {
    setAdjustingId(productId);
    setStockFeedback(null);
    try {
      const res = await adminFetch<any>('/api/admin/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          delta,
          reason: delta > 0 ? 'Réapprovisionnement rapide admin' : 'Sortie manuelle admin',
        }),
      });
      setDraftRows((prev) => {
        if (!prev[productId]) return prev;
        return {
          ...prev,
          [productId]: {
            ...prev[productId],
            stockQuantity: String(res.newQty ?? 0),
          },
        };
      });
      onRefresh();
    } catch (err: any) {
      setStockFeedback({ type: 'err', msg: err?.message || 'Erreur lors de l’ajustement rapide.' });
    } finally {
      setAdjustingId(null);
    }
  };

  const getRowDraft = (p: any) =>
    draftRows[p.id] || {
      stockQuantity: String(p.stockQuantity ?? 0),
      costPriceDzd: String(p.costPriceDzd ?? 0),
      priceDzd: String(p.priceDzd ?? 0),
    };

  const updateRowDraft = (
    p: any,
    field: 'stockQuantity' | 'costPriceDzd' | 'priceDzd',
    value: string,
  ) => {
    setDraftRows((prev) => ({
      ...prev,
      [p.id]: {
        ...(prev[p.id] || {
          stockQuantity: String(p.stockQuantity ?? 0),
          costPriceDzd: String(p.costPriceDzd ?? 0),
          priceDzd: String(p.priceDzd ?? 0),
        }),
        [field]: value,
      },
    }));
  };

  const handleSaveInlineRow = async (p: any) => {
    const draft = getRowDraft(p);
    setSavingInlineId(p.id);
    setStockFeedback(null);
    try {
      await adminFetch(`/api/admin/stock/product/${p.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          stockQuantity: Math.max(0, Math.round(Number(draft.stockQuantity) || 0)),
          costPriceDzd: Math.max(0, Math.round(Number(draft.costPriceDzd) || 0)),
          priceDzd: Math.max(0, Math.round(Number(draft.priceDzd) || 0)),
        }),
      });
      setDraftRows((prev) => {
        const copy = { ...prev };
        delete copy[p.id];
        return copy;
      });
      setStockFeedback({
        type: 'ok',
        msg: `${p.name} mis à jour (Stock : ${draft.stockQuantity} u. · Achat : ${formatDzd(Number(draft.costPriceDzd) || 0)} · Vente : ${formatDzd(Number(draft.priceDzd) || 0)}).`,
      });
      onRefresh();
    } catch (err: any) {
      setStockFeedback({ type: 'err', msg: err?.message || 'Erreur lors de la mise à jour du produit.' });
    } finally {
      setSavingInlineId(null);
    }
  };

  const dirtyProductIds = useMemo(() => Object.keys(draftRows).map(Number), [draftRows]);

  const handleSaveAllDirty = async () => {
    if (dirtyProductIds.length === 0) return;
    setSavingAll(true);
    setStockFeedback(null);
    try {
      const items = dirtyProductIds.map((productId) => {
        const d = draftRows[productId];
        return {
          productId,
          stockQuantity: Math.max(0, Math.round(Number(d.stockQuantity) || 0)),
          costPriceDzd: Math.max(0, Math.round(Number(d.costPriceDzd) || 0)),
          priceDzd: Math.max(0, Math.round(Number(d.priceDzd) || 0)),
        };
      });
      const res = await adminFetch<{ updatedCount: number }>('/api/admin/stock/batch', {
        method: 'PATCH',
        body: JSON.stringify({ items }),
      });
      setDraftRows({});
      setStockFeedback({
        type: 'ok',
        msg: `${res.updatedCount} article(s) mis à jour en base de données (quantités, prix d’achat et prix de vente).`,
      });
      onRefresh();
    } catch (err: any) {
      setStockFeedback({ type: 'err', msg: err?.message || 'Erreur lors de l’enregistrement groupé.' });
    } finally {
      setSavingAll(false);
    }
  };

  const physicalProducts = useMemo(
    () => products.filter((p) => p.productType === 'physical'),
    [products],
  );
  const productNameById = useMemo(() => {
    const map = new Map<number, { name: string; sku: string }>();
    for (const p of products) map.set(p.id, { name: p.name, sku: p.sku });
    return map;
  }, [products]);

  const filteredLevels = useMemo(() => {
    const q = levelSearch.trim().toLowerCase();
    return physicalProducts.filter((p) => {
      if (stockFilter === 'low' && !p.isLowStock) return false;
      if (stockFilter === 'out' && p.stockQuantity > 0) return false;
      if (categoryFilter !== 'all' && String(p.categoryId || '') !== categoryFilter) return false;
      if (q && !`${p.name} ${p.sku} ${p.barcode || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [physicalProducts, stockFilter, categoryFilter, levelSearch]);

  const liveFinancialItems = useMemo(
    () =>
      physicalProducts.map((p) => {
        const d = draftRows[p.id];
        return {
          productType: p.productType,
          stockQuantity: Number(d ? d.stockQuantity : p.stockQuantity) || 0,
          costPriceDzd: Number(d ? d.costPriceDzd : p.costPriceDzd) || 0,
          priceDzd: Number(d ? d.priceDzd : p.priceDzd) || 0,
        };
      }),
    [physicalProducts, draftRows],
  );

  const accountingEntriesList: any[] = useMemo(
    () => stockData?.accountingEntries || [],
    [stockData],
  );

  const filteredAccounting = useMemo(() => {
    const q = comptaSearch.trim().toLowerCase();
    return accountingEntriesList.filter((e) => {
      if (comptaTypeFilter !== 'all' && e.entryType !== comptaTypeFilter) return false;
      if (q && !`${e.reference} ${e.label} ${e.partnerName} ${e.category} ${e.sourceFile || ''}`.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [accountingEntriesList, comptaSearch, comptaTypeFilter]);

  const comptaSummary = useMemo(() => {
    return accountingEntriesList.reduce(
      (acc, e) => {
        const amount = Number(e.amountDzd) || 0;
        const cost = Number(e.costDzd) || 0;
        const margin = Number(e.marginDzd) || 0;
        if (e.entryType === 'sale') {
          acc.salesDzd += amount;
          acc.salesMarginDzd += margin;
        } else if (e.entryType === 'purchase') {
          acc.purchasesDzd += amount;
        } else if (e.entryType === 'expense') {
          acc.expensesDzd += amount;
        } else if (e.entryType === 'stock_valuation') {
          acc.stockSaleDzd += amount;
          acc.stockCostDzd += cost;
          acc.stockMarginDzd += margin;
        }
        return acc;
      },
      {
        salesDzd: 0,
        salesMarginDzd: 0,
        purchasesDzd: 0,
        expensesDzd: 0,
        stockSaleDzd: 0,
        stockCostDzd: 0,
        stockMarginDzd: 0,
      },
    );
  }, [accountingEntriesList]);

  const activeAlerts = (stockData?.alerts || []).filter((a: any) => a.status === 'active');

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap p-1.5 bg-slate-200/80 rounded-xl gap-1.5">
        <button
          type="button"
          onClick={() => handleChangeSubTab('import')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
            subTab === 'import'
              ? 'bg-blue-700 text-white shadow-sm'
              : 'bg-white/60 text-blue-900 hover:bg-white'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>1. Décodage Binaire .MDF + .IDF (Ajouter le Stock &amp; Compta)</span>
        </button>
        <button
          type="button"
          onClick={() => handleChangeSubTab('levels')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === 'levels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          2. Ajouter &amp; Gérer le Stock ({physicalProducts.length})
        </button>
        <button
          type="button"
          onClick={() => handleChangeSubTab('compta')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === 'compta'
              ? 'bg-emerald-700 text-white shadow-sm'
              : 'text-emerald-900 bg-white/60 hover:bg-white'
          }`}
        >
          <Calculator className="w-3.5 h-3.5" />
          <span>3. Comptabilité &amp; Bilan ({accountingEntriesList.length})</span>
        </button>
        <button
          type="button"
          onClick={() => handleChangeSubTab('alerts')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            subTab === 'alerts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-700 hover:bg-white/60'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>4. Alertes stock faible ({activeAlerts.length})</span>
        </button>
      </div>

      {subTab === 'import' && (
        <div className="space-y-6">
          {/* Dual .MDF + .IDF & Universal Database Backup Dropzone Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 text-blue-900 text-[11px] font-bold mb-2">
                  <HardDrive className="w-3.5 h-3.5" />
                  <span>INTÉGRATION SAUVEGARDE .MDF + .IDF (STOCK + COMPTABILITÉ)</span>
                </span>
                <h2 className="font-display font-bold text-lg text-slate-900">
                  Importez vos deux fichiers de sauvegarde (.MDF et .IDF) pour générer tout votre stock et votre compta
                </h2>
                <p className="text-sm text-slate-600 mt-1">
                  Chargez votre fichier principal <strong>.mdf</strong> (Point 1) ainsi que votre fichier d’index/données{' '}
                  <strong>.idf</strong> (Point 2), puis cliquez sur le bouton vert{' '}
                  <strong>« Sauvegarder &amp; Intégrer maintenant dans le système »</strong> juste en dessous pour générer
                  votre stock et votre comptabilité.
                </p>
              </div>
            </div>

            {/* Dedicated 2-Point Upload Slots: Point 1 (.MDF) + Point 2 (.IDF) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Slot 1: Fichier .MDF */}
              <label
                className={`flex flex-col justify-between p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  mdfFile
                    ? 'border-blue-600 bg-blue-50/50'
                    : 'border-slate-300 hover:border-blue-600 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      mdfFile ? 'bg-blue-700 text-white' : 'bg-blue-100 text-blue-700'
                    }`}
                  >
                    <Database className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-blue-700">
                      Point 1 · Fichier Base de Données (.MDF)
                    </span>
                    <p className="font-display font-bold text-sm text-slate-900 mt-0.5 truncate">
                      {mdfFile ? mdfFile.name : 'Cliquez ici pour choisir votre fichier .MDF'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {mdfFile
                        ? `Fichier chargé (${Math.max(1, Math.round(mdfFile.size / 1024))} Ko) · Cliquez pour remplacer`
                        : 'Contient les tables principales (Articles, Stock, Prix d’achat/vente, Ventes & Compta)'}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".mdf,.ndf,.dbf,.bak,.db,.sqlite,.sqlite3,.sql,.xlsx,.xls,.csv,.json,.xml"
                  onChange={(e) => handleSpecificMdfOrIdfChange('mdf', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>

              {/* Slot 2: Fichier .IDF */}
              <label
                className={`flex flex-col justify-between p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
                  idfFile
                    ? 'border-emerald-600 bg-emerald-50/50'
                    : 'border-slate-300 hover:border-emerald-600 bg-slate-50/70'
                }`}
              >
                <div className="flex items-start gap-3.5">
                  <div
                    className={`p-3 rounded-xl shrink-0 ${
                      idfFile ? 'bg-emerald-700 text-white' : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <HardDrive className="w-6 h-6" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-700">
                      Point 2 · Fichier Index &amp; Inventaire (.IDF)
                    </span>
                    <p className="font-display font-bold text-sm text-slate-900 mt-0.5 truncate">
                      {idfFile ? idfFile.name : 'Cliquez ici pour choisir votre fichier .IDF'}
                    </p>
                    <p className="text-xs text-slate-500 mt-1">
                      {idfFile
                        ? `Fichier chargé (${Math.max(1, Math.round(idfFile.size / 1024))} Ko) · Cliquez pour remplacer`
                        : 'Contient les index, quantités en stock, mouvements et journaux associés (.idf, .ldf, .idx)'}
                    </p>
                  </div>
                </div>
                <input
                  type="file"
                  accept=".idf,.ldf,.idx,.ndx,.mdf,.dbf,.bak,.db,.sqlite,.sql,.csv,.json,.xml"
                  onChange={(e) => handleSpecificMdfOrIdfChange('idf', e.target.files?.[0] || null)}
                  className="hidden"
                />
              </label>
            </div>

            {/* Or select both files simultaneously in one click */}
            <label className="flex flex-col items-center justify-center border border-slate-200 hover:border-blue-500 rounded-xl p-4 cursor-pointer bg-slate-50/60 transition-colors">
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-800">
                <FileSpreadsheet className="w-4 h-4 text-blue-700" />
                <span>
                  {parsing
                    ? 'Lecture et analyse de vos fichiers .MDF / .IDF en cours...'
                    : selectedFiles.length > 0
                    ? `Fichier(s) chargé(s) : ${selectedFiles.map((f) => f.name).join(' + ')}`
                    : 'Ou cliquez ici pour sélectionner vos deux fichiers (.mdf + .idf) en même temps'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 mt-1 text-center">
                Formats compatibles : <strong>.mdf</strong> · <strong>.idf</strong> · .ldf · .dbf · .bak · .sql · .sqlite · .db · .xlsx · .xls · .csv · .json · .xml
              </span>
              <input
                type="file"
                multiple
                accept=".mdf,.idf,.ldf,.ndf,.idx,.ndx,.dbf,.fic,.bak,.dat,.xlsx,.xls,.csv,.tsv,.txt,.json,.xml,.db,.sqlite,.sqlite3,.sql"
                onChange={handleMultiFileChange}
                className="hidden"
              />
            </label>

            {/* ALWAYS-VISIBLE SAVE & INTEGRATE ACTION BAR (NO SCROLLING NEEDED) */}
            <div
              className={`p-5 rounded-xl border-2 transition-all ${
                selectedFiles.length > 0
                  ? 'bg-emerald-50/90 border-emerald-500 shadow-md'
                  : 'bg-slate-50 border-slate-200'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-[11px] font-bold uppercase ${
                        selectedFiles.length > 0
                          ? 'bg-emerald-700 text-white'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>Étape Finale · Sauvegarder &amp; Intégrer dans le système</span>
                    </span>
                    {parsing && (
                      <span className="text-xs font-semibold text-blue-700 animate-pulse">
                        Analyse en cours...
                      </span>
                    )}
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {selectedFiles.length > 0
                      ? `Prêt à intégrer : ${selectedFiles.map((f) => f.name).join(' + ')}${
                          preview
                            ? ` (${preview.diffSummary.toAddCount + preview.diffSummary.toUpdateCount} article(s) Stock + ${preview.accountingPreview?.totalEntries ?? 0} écriture(s) Compta détectés)`
                            : ''
                        }`
                      : 'Sélectionnez votre fichier .MDF (Point 1) et/ou votre fichier .IDF (Point 2) ci-dessus, puis cliquez sur le bouton à droite pour tout enregistrer.'}
                  </p>
                  <p className="text-xs text-slate-600">
                    Cette action enregistre automatiquement tous les produits dans votre stock (quantités, prix d’achat, prix de vente) et génère toute votre comptabilité dans la base de données.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  {selectedFiles.length > 0 && (
                    <>
                      <button
                        type="button"
                        disabled={parsing || committing}
                        onClick={() => runPreview(selectedFiles)}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${parsing ? 'animate-spin' : ''}`} />
                        <span>{parsing ? 'Analyse...' : 'Analyser / Aperçu'}</span>
                      </button>
                      <button
                        type="button"
                        disabled={committing}
                        onClick={() => {
                          setPreview(null);
                          setSelectedFiles([]);
                          setMdfFile(null);
                          setIdfFile(null);
                          setImportError(null);
                        }}
                        className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600"
                      >
                        Vider
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    disabled={selectedFiles.length === 0 || committing}
                    onClick={handleCommitImport}
                    className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                      selectedFiles.length > 0
                        ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer'
                        : 'bg-slate-300 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    <Upload className="w-4 h-4" />
                    <span>
                      {committing
                        ? 'Intégration du Stock & de la Compta en cours...'
                        : selectedFiles.length > 0
                        ? 'Sauvegarder & Intégrer maintenant (Générer Stock + Compta)'
                        : 'Sauvegarder & Intégrer dans le système'}
                    </span>
                  </button>
                </div>
              </div>
            </div>

            {/* Sync Mode & Accounting Generation Checkbox */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'full_sync',
                  title: 'Synchronisation complète (Stock + Prix + Compta)',
                  desc: 'Génère tout votre stock, met à jour les quantités, prix d’achat et prix de vente, et génère votre comptabilité.',
                },
                {
                  id: 'add_and_update_stock',
                  title: 'Nouveaux + Mise à jour quantités',
                  desc: 'Ajoute les nouveaux articles et met à jour les quantités de stock existantes (conserve 100 % des photos).',
                },
                {
                  id: 'add_only',
                  title: 'Nouveaux articles uniquement',
                  desc: 'Ajoute uniquement les nouveaux articles absents de la boutique sans modifier les existants.',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSyncMode(m.id as any);
                    if (selectedFiles.length > 0) {
                      runPreview(selectedFiles, {
                        tableName: selectedTable,
                        mode: m.id,
                        customMapping: mapping,
                      });
                    }
                  }}
                  className={`p-4 rounded-xl border text-left transition-colors ${
                    syncMode === m.id
                      ? 'border-blue-700 bg-blue-50/50'
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-900">{m.title}</p>
                  <p className="text-xs text-slate-600 mt-1 leading-relaxed">{m.desc}</p>
                </button>
              ))}
            </div>

            <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 flex items-center justify-between gap-3">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-emerald-950">
                <input
                  type="checkbox"
                  checked={generateAccounting}
                  onChange={(e) => setGenerateAccounting(e.target.checked)}
                  className="w-4 h-4 rounded border-emerald-400 text-emerald-700"
                />
                <span>
                  Générer automatiquement toute la Comptabilité (Bilan financier du stock, Prix d’achat/vente, Marges &amp; Écritures comptables)
                </span>
              </label>
              <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase shrink-0">
                Recommandé
              </span>
            </div>

            {/* Saved Software Mapping Profiles */}
            {stockData?.profiles && stockData.profiles.length > 0 && (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="text-slate-500 font-medium">Profils logiciels enregistrés :</span>
                {stockData.profiles.map((prof: any) => (
                  <button
                    key={prof.id}
                    type="button"
                    onClick={() => handleApplySavedProfile(prof)}
                    className="px-2.5 py-1 rounded-md border border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-800 font-medium"
                  >
                    {prof.profileName} ({prof.sourceFormat.toUpperCase()})
                  </button>
                ))}
              </div>
            )}

            {importError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {importError}
              </div>
            )}

            {commitResult && (
              <div className="p-5 rounded-xl bg-emerald-50 border-2 border-emerald-500 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-950">
                      Sauvegarde intégrée avec succès : {commitResult.importRecord.addedCount} nouveau(x) article(s) ajouté(s),{' '}
                      {commitResult.importRecord.updatedCount} mis à jour, et{' '}
                      {commitResult.accountingGeneratedCount ?? 0} écriture(s) comptable(s) générée(s) dans votre Compta !
                    </p>
                    <p className="text-xs text-emerald-800 mt-1">
                      Votre stock et votre bilan comptable sont maintenant enregistrés dans PostgreSQL.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleChangeSubTab('compta')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap shadow-sm"
                  >
                    <Calculator className="w-3.5 h-3.5" />
                    <span>Voir toute ma Compta générée</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleChangeSubTab('levels')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-100 text-emerald-900 text-xs font-semibold whitespace-nowrap"
                  >
                    <span>Voir mon Stock &amp; Marges</span>
                  </button>
                  <button
                    type="button"
                    onClick={onGoToMissingPhotos}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-800 text-xs font-semibold whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ajouter des photos</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview & Column Mapper + Accounting Preview */}
          {preview && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Aperçu détaillé Stock &amp; Comptabilité — {preview.fileName} ({preview.format.toUpperCase()})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {preview.totalRows} ligne(s) détectée(s) dans « {preview.selectedTable} »
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  {preview.tables && preview.tables.length > 1 && (
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-semibold text-slate-700">Table / Fichier :</label>
                      <select
                        value={selectedTable}
                        onChange={(e) => {
                          setSelectedTable(e.target.value);
                          if (selectedFiles.length > 0) runPreview(selectedFiles, { tableName: e.target.value });
                        }}
                        className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      >
                        {preview.tables.map((t: any) => (
                          <option key={t.tableName} value={t.tableName}>
                            {t.tableName} ({t.rowCount} lignes)
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <button
                    type="button"
                    disabled={committing}
                    onClick={handleCommitImport}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>
                      {committing
                        ? 'Intégration en cours...'
                        : `Sauvegarder & Intégrer (+${preview.diffSummary.toAddCount + preview.diffSummary.toUpdateCount} Stock / +${preview.accountingPreview?.totalEntries ?? 0} Compta)`}
                    </span>
                  </button>
                </div>
              </div>

              {/* Differential Summary Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-xs text-emerald-800">Nouveaux articles stock</p>
                  <p className="font-mono font-bold text-2xl text-emerald-900 tabular-nums mt-0.5">
                    +{preview.diffSummary.toAddCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-800">Articles mis à jour</p>
                  <p className="font-mono font-bold text-2xl text-blue-900 tabular-nums mt-0.5">
                    {preview.diffSummary.toUpdateCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-slate-50 border border-slate-200">
                  <p className="text-xs text-slate-600">Déjà en stock (ignorés)</p>
                  <p className="font-mono font-bold text-2xl text-slate-900 tabular-nums mt-0.5">
                    {preview.diffSummary.skippedCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-indigo-50 border border-indigo-200">
                  <p className="text-xs text-indigo-800">Écritures Compta générées</p>
                  <p className="font-mono font-bold text-2xl text-indigo-900 tabular-nums mt-0.5">
                    +{preview.accountingPreview?.totalEntries ?? 0}
                  </p>
                </div>
              </div>

              {/* Preview of Generated Accounting (Compta) */}
              {preview.accountingPreview && preview.accountingPreview.totalEntries > 0 && (
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <Calculator className="w-4 h-4 text-emerald-700" />
                      <h4 className="text-xs font-bold text-slate-900">
                        Synthèse Comptable détectée dans votre sauvegarde (.MDF / .IDF)
                      </h4>
                    </div>
                    <span className="text-[11px] font-semibold text-emerald-700">
                      {preview.accountingPreview.totalEntries} écriture(s) prête(s) à être intégrée(s)
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3 rounded-lg bg-white border border-blue-200">
                      <p className="text-[11px] text-slate-500">Valeur Vente Stock / CA</p>
                      <p className="font-mono font-bold text-sm text-blue-700 mt-0.5">
                        {formatDzd(
                          (preview.accountingPreview.stockSaleValueDzd || 0) +
                            (preview.accountingPreview.salesDzd || 0),
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-red-200">
                      <p className="text-[11px] text-slate-500">Coût d’Achat Stock &amp; Charges</p>
                      <p className="font-mono font-bold text-sm text-red-600 mt-0.5">
                        {formatDzd(
                          (preview.accountingPreview.stockCostValueDzd || 0) +
                            (preview.accountingPreview.purchasesDzd || 0) +
                            (preview.accountingPreview.expensesDzd || 0),
                        )}
                      </p>
                    </div>
                    <div className="p-3 rounded-lg bg-white border border-emerald-200">
                      <p className="text-[11px] text-slate-500">Marge Bénéficiaire Générée</p>
                      <p className="font-mono font-bold text-sm text-emerald-700 mt-0.5">
                        +{formatDzd(
                          (preview.accountingPreview.stockMarginDzd || 0) +
                            (preview.accountingPreview.salesMarginDzd || 0),
                        )}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Visual Column Mapper */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Correspondance des colonnes de votre sauvegarde (détectée automatiquement)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      selectedFiles.length > 0 &&
                      runPreview(selectedFiles, {
                        tableName: selectedTable,
                        mode: syncMode,
                        customMapping: mapping,
                      })
                    }
                    className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Recalculer l’aperçu</span>
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {MAPPING_FIELDS.map((field) => (
                    <div key={field.key}>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        {field.label}
                      </label>
                      <select
                        value={mapping[field.key] || ''}
                        onChange={(e) => setMapping({ ...mapping, [field.key]: e.target.value })}
                        className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                      >
                        <option value="">— Ignorer —</option>
                        {preview.columns.map((col: string) => (
                          <option key={col} value={col}>
                            {col}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              {/* Sample New Articles Preview */}
              {preview.diffSummary.sampleToAdd.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold text-slate-900 mb-2">
                    Aperçu des articles de stock détectés ({preview.diffSummary.toAddCount})
                  </h4>
                  <div className="overflow-x-auto border border-slate-200 rounded-lg">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                        <tr>
                          <th className="py-2 px-3">SKU / Code</th>
                          <th className="py-2 px-3">Nom de l’article</th>
                          <th className="py-2 px-3">Catégorie</th>
                          <th className="py-2 px-3 text-right">Prix d’achat (DZD)</th>
                          <th className="py-2 px-3 text-right">Prix de vente (DZD)</th>
                          <th className="py-2 px-3 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.diffSummary.sampleToAdd.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono text-slate-600">{item.sku}</td>
                            <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                            <td className="py-2 px-3 text-slate-600">{item.categoryName || 'Défaut'}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums text-slate-600">
                              {formatDzd(item.costPriceDzd || 0)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums font-semibold text-slate-900">
                              {formatDzd(item.priceDzd)}
                            </td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{item.stockQuantity}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Commit Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-slate-100">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Catégorie par défaut (si absente du fichier)
                  </label>
                  <select
                    value={defaultCategoryId}
                    onChange={(e) => setDefaultCategoryId(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white"
                  >
                    <option value="">Créer automatiquement selon la sauvegarde</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mémoriser ce profil de sauvegarde (.MDF / .IDF)
                  </label>
                  <input
                    value={saveProfileName}
                    onChange={(e) => setSaveProfileName(e.target.value)}
                    placeholder="Ex. Sauvegarde Système .MDF + .IDF"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFiles([]);
                    setMdfFile(null);
                    setIdfFile(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={committing}
                  onClick={handleCommitImport}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white text-xs font-bold shadow-sm"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {committing
                      ? 'Génération du Stock & de la Compta en cours...'
                      : `Sauvegarder & Intégrer le Stock (+${preview.diffSummary.toAddCount + preview.diffSummary.toUpdateCount}) & Toute la Compta (+${preview.accountingPreview?.totalEntries ?? 0})`}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Import History */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
              <History className="w-4 h-4 text-slate-500" />
              <h3 className="font-display font-semibold text-sm text-slate-900">
                Historique des imports de sauvegarde (.MDF / .IDF / Stock)
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Fichier(s)</th>
                    <th className="py-2.5 px-4">Mode</th>
                    <th className="py-2.5 px-4 text-right">Ajoutés</th>
                    <th className="py-2.5 px-4 text-right">Mis à jour</th>
                    <th className="py-2.5 px-4 text-right">Ignorés</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(stockData?.imports || []).length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-500">
                        Aucun import effectué pour l’instant.
                      </td>
                    </tr>
                  ) : (
                    stockData.imports.map((imp: any) => (
                      <tr key={imp.id}>
                        <td className="py-2.5 px-4 tabular-nums text-slate-500">
                          {new Date(imp.createdAt).toLocaleString('fr-FR')}
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {imp.fileName}{' '}
                          <span className="font-mono text-[10px] uppercase text-slate-400">
                            ({imp.fileFormat})
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-slate-600">{imp.syncMode}</td>
                        <td className="py-2.5 px-4 text-right font-mono font-semibold text-emerald-700 tabular-nums">
                          +{imp.addedCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-blue-700 tabular-nums">
                          {imp.updatedCount}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-500 tabular-nums">
                          {imp.skippedCount}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'compta' && (
        <div className="space-y-5">
          {/* Global Financial Donut + Stock Accounting Summary */}
          <FinancialMarginWidget
            items={liveFinancialItems}
            title="Bilan Comptable Global & Valorisation du Stock (.MDF / .IDF)"
            subtitle="Calculé automatiquement à partir de votre stock importé, de vos prix d’achat, prix de vente et écritures comptables"
          />

          {/* Accounting KPIs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Valorisation Vente Stock (Compta)</p>
              <p className="mt-1 font-mono font-bold text-lg text-blue-700 tabular-nums">
                {formatDzd(comptaSummary.stockSaleDzd)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Coût d’achat : {formatDzd(comptaSummary.stockCostDzd)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Marge Bénéficiaire Stock</p>
              <p className="mt-1 font-mono font-bold text-lg text-emerald-700 tabular-nums">
                +{formatDzd(comptaSummary.stockMarginDzd)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">Bénéfice latent sur inventaire</p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Ventes &amp; Recettes Comptabilisées</p>
              <p className="mt-1 font-mono font-bold text-lg text-slate-900 tabular-nums">
                {formatDzd(comptaSummary.salesDzd)}
              </p>
              <p className="text-[11px] text-emerald-700 mt-0.5">
                Marge ventes : +{formatDzd(comptaSummary.salesMarginDzd)}
              </p>
            </div>
            <div className="bg-white border border-slate-200 rounded-xl p-4">
              <p className="text-xs text-slate-500">Achats Fournisseurs &amp; Charges</p>
              <p className="mt-1 font-mono font-bold text-lg text-red-600 tabular-nums">
                {formatDzd(comptaSummary.purchasesDzd + comptaSummary.expensesDzd)}
              </p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Achats : {formatDzd(comptaSummary.purchasesDzd)} · Charges : {formatDzd(comptaSummary.expensesDzd)}
              </p>
            </div>
          </div>

          {/* Quick Add Accounting Entry Form */}
          <form
            onSubmit={handleAddAccountingEntry}
            className="bg-white border border-slate-200 rounded-xl p-4 space-y-3"
          >
            <h3 className="font-display font-bold text-sm text-slate-900">
              Ajouter une écriture comptable manuelle
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <select
                value={newEntryType}
                onChange={(e) => setNewEntryType(e.target.value as any)}
                className="px-3 py-2 text-xs rounded-lg border border-slate-300 bg-white font-semibold"
              >
                <option value="sale">Recette / Vente</option>
                <option value="purchase">Achat Fournisseur</option>
                <option value="expense">Charge / Dépense</option>
                <option value="stock_valuation">Valorisation Stock</option>
              </select>
              <input
                required
                value={newEntryLabel}
                onChange={(e) => setNewEntryLabel(e.target.value)}
                placeholder="Libellé (ex. Facture fournisseur, Vente comptoir...)"
                className="lg:col-span-2 px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
              <input
                value={newEntryPartner}
                onChange={(e) => setNewEntryPartner(e.target.value)}
                placeholder="Client / Fournisseur"
                className="px-3 py-2 text-xs rounded-lg border border-slate-300"
              />
              <input
                required
                type="number"
                min={0}
                value={newEntryAmount}
                onChange={(e) => setNewEntryAmount(e.target.value)}
                placeholder="Montant TTC (DZD)"
                className="px-3 py-2 text-xs font-mono rounded-lg border border-slate-300"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  min={0}
                  value={newEntryCost}
                  onChange={(e) => setNewEntryCost(e.target.value)}
                  placeholder="Coût achat (DZD)"
                  className="w-full px-3 py-2 text-xs font-mono rounded-lg border border-slate-300"
                />
                <button
                  type="submit"
                  disabled={addingEntry}
                  className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold shrink-0"
                >
                  {addingEntry ? '...' : 'Ajouter'}
                </button>
              </div>
            </div>
          </form>

          {/* Accounting Ledger Table */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={comptaTypeFilter}
                  onChange={(e) => setComptaTypeFilter(e.target.value)}
                  className="px-3 py-1.5 text-xs rounded-lg border border-slate-300 bg-white"
                >
                  <option value="all">Toutes les écritures ({accountingEntriesList.length})</option>
                  <option value="stock_valuation">Bilans &amp; Valorisation Stock</option>
                  <option value="sale">Ventes &amp; Encaissements</option>
                  <option value="purchase">Achats Fournisseurs</option>
                  <option value="expense">Charges &amp; Dépenses</option>
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={comptaSearch}
                    onChange={(e) => setComptaSearch(e.target.value)}
                    placeholder="Rechercher écriture, référence..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-56"
                  />
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  const csv = toCsv(
                    [
                      'Référence',
                      'Date',
                      'Type',
                      'Catégorie',
                      'Libellé',
                      'Tiers',
                      'Montant DZD',
                      'Coût Achat DZD',
                      'Marge DZD',
                      'Source',
                    ],
                    filteredAccounting.map((e) => [
                      e.reference,
                      new Date(e.entryDate || e.createdAt).toLocaleDateString('fr-FR'),
                      e.entryType,
                      e.category,
                      e.label,
                      e.partnerName,
                      e.amountDzd,
                      e.costDzd,
                      e.marginDzd,
                      e.sourceFile || '',
                    ]),
                  );
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `2freres-comptabilite-${new Date().toISOString().slice(0, 10)}.csv`;
                  a.click();
                  URL.revokeObjectURL(url);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exporter Compta (CSV)</span>
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Référence</th>
                    <th className="py-2.5 px-3">Date</th>
                    <th className="py-2.5 px-3">Catégorie</th>
                    <th className="py-2.5 px-4">Libellé de l’écriture</th>
                    <th className="py-2.5 px-3">Source</th>
                    <th className="py-2.5 px-3 text-right">Montant (DZD)</th>
                    <th className="py-2.5 px-3 text-right">Coût Achat (DZD)</th>
                    <th className="py-2.5 px-3 text-right">Marge (DZD)</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredAccounting.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-10 text-center text-slate-500">
                        Aucune écriture comptable enregistrée. Importez vos fichiers{' '}
                        <strong>.mdf et .idf</strong> dans l’onglet « Importer Sauvegarde » pour générer automatiquement toute votre comptabilité.
                      </td>
                    </tr>
                  ) : (
                    filteredAccounting.map((entry: any) => (
                      <tr key={entry.id} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 font-mono font-semibold text-slate-900">
                          {entry.reference}
                        </td>
                        <td className="py-2.5 px-3 tabular-nums text-slate-500">
                          {new Date(entry.entryDate || entry.createdAt).toLocaleDateString('fr-FR')}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${
                              entry.entryType === 'sale'
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : entry.entryType === 'stock_valuation'
                                ? 'bg-blue-50 text-blue-800 border border-blue-200'
                                : 'bg-red-50 text-red-700 border border-red-200'
                            }`}
                          >
                            {entry.category}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 font-medium text-slate-900">
                          {entry.label}
                          {entry.partnerName && (
                            <span className="block text-[11px] text-slate-400">{entry.partnerName}</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {entry.sourceFile || 'Système'}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900 tabular-nums">
                          {formatDzd(entry.amountDzd)}
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-red-600 tabular-nums">
                          {formatDzd(entry.costDzd)}
                        </td>
                        <td
                          className={`py-2.5 px-3 text-right font-mono font-bold tabular-nums ${
                            entry.marginDzd >= 0 ? 'text-emerald-700' : 'text-red-600'
                          }`}
                        >
                          {entry.marginDzd >= 0 ? '+' : ''}
                          {formatDzd(entry.marginDzd)}
                        </td>
                        <td className="py-2.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => handleDeleteAccountingEntry(entry.id)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50"
                            title="Supprimer cette écriture"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {subTab === 'levels' && (
        <div className="space-y-4">
          {/* Always-Visible .MDF + .IDF Binary Decoder & Stock/Compta Importer inside "Ajouter & Gérer le Stock" */}
          <MdfIdfBinaryDecoderModule
            categories={categories}
            onRefresh={onRefresh}
            onNavigateCompta={() => handleChangeSubTab('compta')}
            onNavigateStockLevels={() => handleChangeSubTab('levels')}
          />

          {stockFeedback && (
            <div
              className={`p-3 rounded-xl border text-xs font-medium flex items-center justify-between gap-2 ${
                stockFeedback.type === 'ok'
                  ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                  : 'bg-red-50 border-red-200 text-red-700'
              }`}
            >
              <span>{stockFeedback.msg}</span>
              <button
                type="button"
                onClick={() => setStockFeedback(null)}
                className="font-semibold underline shrink-0"
              >
                Fermer
              </button>
            </div>
          )}

          {/* Financial Margin Donut Widget (Vert / Rouge / Bleu) - live updated with draft edits */}
          <FinancialMarginWidget
            items={liveFinancialItems}
            hasUnsavedDrafts={dirtyProductIds.length > 0}
          />

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex p-1 bg-slate-100 rounded-lg text-xs">
                  {[
                    { id: 'all', label: 'Tous' },
                    { id: 'low', label: 'Stock faible' },
                    { id: 'out', label: 'Rupture' },
                  ].map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setStockFilter(f.id as any)}
                      className={`px-3 py-1 rounded-md font-medium ${
                        stockFilter === f.id ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-700"
                  aria-label="Filtrer par catégorie"
                >
                  <option value="all">Toutes les catégories</option>
                  {categories.map((c) => (
                    <option key={c.id} value={String(c.id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="search"
                    value={levelSearch}
                    onChange={(e) => setLevelSearch(e.target.value)}
                    placeholder="Rechercher article, SKU..."
                    className="pl-8 pr-3 py-1.5 text-xs rounded-lg border border-slate-300 w-52"
                  />
                </div>
              </div>

              {dirtyProductIds.length > 0 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={savingAll}
                    onClick={() => setDraftRows({})}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Annuler ({dirtyProductIds.length})
                  </button>
                  <button
                    type="button"
                    disabled={savingAll}
                    onClick={handleSaveAllDirty}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5" />
                    <span>
                      {savingAll
                        ? 'Enregistrement...'
                        : `Enregistrer tout (${dirtyProductIds.length} modifié${dirtyProductIds.length > 1 ? 's' : ''})`}
                    </span>
                  </button>
                </div>
              ) : (
                <span className="text-xs text-slate-500">
                  Modifiez directement la quantité, le <strong>prix d’achat</strong> et le{' '}
                  <strong>prix de vente</strong> (Entrée ou <strong>Enregistrer</strong>).
                </span>
              )}
            </div>

            {/* Mobile Cards for Inline Stock & Prices */}
            <div className="divide-y divide-slate-100 lg:hidden">
              {filteredLevels.map((p) => {
                const draft = getRowDraft(p);
                const costNum = Number(draft.costPriceDzd) || 0;
                const saleNum = Number(draft.priceDzd) || 0;
                const margin = saleNum - costNum;
                const marginPct = costNum > 0 ? Math.round((margin / costNum) * 100) : null;
                const isDirty = Boolean(draftRows[p.id]);
                const onKeyEnter = (e: React.KeyboardEvent) => {
                  if (e.key === 'Enter') handleSaveInlineRow(p);
                };
                return (
                  <div key={p.id} className={`p-4 space-y-3 ${isDirty ? 'bg-blue-50/40' : ''}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-sm text-slate-900">{p.name}</p>
                        <p className="text-[11px] font-mono text-slate-400">
                          {p.sku} {p.barcode ? `· ${p.barcode}` : ''}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          printProductThermalLabels(
                            [
                              {
                                name: p.name,
                                sku: p.sku,
                                barcode: p.barcode || p.sku,
                                priceDzd: saleNum,
                                copies: 1,
                              },
                            ],
                            storeSettings,
                          )
                        }
                        title="Imprimer étiquette thermique"
                        className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-100"
                      >
                        <Printer className="w-4 h-4" />
                      </button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Quantité stock
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.stockQuantity}
                          onChange={(e) => updateRowDraft(p, 'stockQuantity', e.target.value)}
                          onKeyDown={onKeyEnter}
                          className="w-full px-2 py-1.5 font-mono text-xs font-bold rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Prix d’achat (DZD)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.costPriceDzd}
                          onChange={(e) => updateRowDraft(p, 'costPriceDzd', e.target.value)}
                          onKeyDown={onKeyEnter}
                          className="w-full px-2 py-1.5 font-mono text-xs rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">
                          Prix de vente (DZD)
                        </label>
                        <input
                          type="number"
                          min={0}
                          value={draft.priceDzd}
                          onChange={(e) => updateRowDraft(p, 'priceDzd', e.target.value)}
                          onKeyDown={onKeyEnter}
                          className="w-full px-2 py-1.5 font-mono text-xs font-semibold rounded-lg border border-slate-300 bg-white"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2 pt-1">
                      <span
                        className={`text-xs font-mono font-semibold ${
                          margin >= 0 ? 'text-emerald-700' : 'text-red-600'
                        }`}
                      >
                        Marge : {formatDzd(margin)}
                        {marginPct !== null ? ` (${marginPct >= 0 ? '+' : ''}${marginPct}%)` : ''}
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={adjustingId === p.id || p.stockQuantity <= 0}
                          onClick={() => handleQuickAdjust(p.id, -1)}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          disabled={adjustingId === p.id}
                          onClick={() => handleQuickAdjust(p.id, 1)}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                        >
                          +1
                        </button>
                        <button
                          type="button"
                          disabled={adjustingId === p.id}
                          onClick={() => handleQuickAdjust(p.id, 5)}
                          className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          disabled={savingInlineId === p.id}
                          onClick={() => handleSaveInlineRow(p)}
                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                            isDirty
                              ? 'bg-blue-700 text-white hover:bg-blue-800'
                              : 'bg-slate-900 text-white hover:bg-slate-800'
                          }`}
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>{savingInlineId === p.id ? '...' : 'Enregistrer'}</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
              {filteredLevels.length === 0 && (
                <div className="py-10 text-center text-sm text-slate-500">
                  Aucun article trouvé dans le stock.
                </div>
              )}
            </div>

            {/* Desktop Inline Stock & Pricing Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                  <tr>
                    <th className="py-3 px-4">Article</th>
                    <th className="py-3 px-3 text-right">Quantité stock</th>
                    <th className="py-3 px-3 text-right">Prix d’achat (DZD)</th>
                    <th className="py-3 px-3 text-right">Prix de vente (DZD)</th>
                    <th className="py-3 px-3 text-right">Marge</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLevels.map((p) => {
                    const draft = getRowDraft(p);
                    const costNum = Number(draft.costPriceDzd) || 0;
                    const saleNum = Number(draft.priceDzd) || 0;
                    const margin = saleNum - costNum;
                    const marginPct = costNum > 0 ? Math.round((margin / costNum) * 100) : null;
                    const isDirty = Boolean(draftRows[p.id]);
                    const onKeyEnter = (e: React.KeyboardEvent) => {
                      if (e.key === 'Enter') handleSaveInlineRow(p);
                    };
                    return (
                      <tr key={p.id} className={isDirty ? 'bg-blue-50/40' : 'hover:bg-slate-50'}>
                        <td className="py-3 px-4">
                          <p className="font-medium text-slate-900">{p.name}</p>
                          <p className="text-xs font-mono text-slate-400">
                            {p.sku} {p.barcode ? `· ${p.barcode}` : ''} · Seuil {p.effectiveLowStockThreshold}
                          </p>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              disabled={adjustingId === p.id || p.stockQuantity <= 0}
                              onClick={() => handleQuickAdjust(p.id, -1)}
                              className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono hover:bg-slate-100"
                              title="Retirer 1 unité"
                            >
                              -1
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={draft.stockQuantity}
                              onChange={(e) => updateRowDraft(p, 'stockQuantity', e.target.value)}
                              onKeyDown={onKeyEnter}
                              aria-label={`Quantité stock ${p.name}`}
                              className={`w-20 px-2 py-1 text-right font-mono font-bold text-xs rounded border border-slate-300 bg-white tabular-nums ${
                                Number(draft.stockQuantity) <= p.effectiveLowStockThreshold
                                  ? 'text-red-600 border-red-300'
                                  : 'text-slate-900'
                              }`}
                            />
                            <button
                              type="button"
                              disabled={adjustingId === p.id}
                              onClick={() => handleQuickAdjust(p.id, 1)}
                              className="px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono hover:bg-slate-100"
                              title="Ajouter 1 unité"
                            >
                              +1
                            </button>
                            <button
                              type="button"
                              disabled={adjustingId === p.id}
                              onClick={() => handleQuickAdjust(p.id, 5)}
                              className="inline-flex items-center px-2 py-1 rounded border border-slate-300 bg-white text-xs font-mono hover:bg-slate-100"
                              title="Ajouter 5 unités"
                            >
                              <Plus className="w-3 h-3" />5
                            </button>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={draft.costPriceDzd}
                            onChange={(e) => updateRowDraft(p, 'costPriceDzd', e.target.value)}
                            onKeyDown={onKeyEnter}
                            aria-label={`Prix d'achat ${p.name}`}
                            className="w-28 px-2.5 py-1 text-right font-mono text-xs rounded border border-slate-300 bg-white tabular-nums"
                          />
                        </td>
                        <td className="py-3 px-3 text-right">
                          <input
                            type="number"
                            min={0}
                            value={draft.priceDzd}
                            onChange={(e) => updateRowDraft(p, 'priceDzd', e.target.value)}
                            onKeyDown={onKeyEnter}
                            aria-label={`Prix de vente ${p.name}`}
                            className="w-28 px-2.5 py-1 text-right font-mono font-semibold text-xs rounded border border-slate-300 bg-white tabular-nums"
                          />
                        </td>
                        <td className="py-3 px-3 text-right font-mono text-xs tabular-nums">
                          <span className={`font-semibold ${margin >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                            {formatDzd(margin)}
                          </span>
                          {marginPct !== null && (
                            <span className="block text-[10px] text-slate-400">
                              {marginPct >= 0 ? `+${marginPct}%` : `${marginPct}%`}
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              disabled={savingInlineId === p.id}
                              onClick={() => handleSaveInlineRow(p)}
                              className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold ${
                                isDirty
                                  ? 'bg-blue-700 text-white hover:bg-blue-800'
                                  : 'bg-slate-900 text-white hover:bg-slate-800'
                              }`}
                            >
                              <Save className="w-3.5 h-3.5" />
                              <span>{savingInlineId === p.id ? '...' : 'Enregistrer'}</span>
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
                                      priceDzd: saleNum,
                                      copies: 1,
                                    },
                                  ],
                                  storeSettings,
                                )
                              }
                              title="Imprimer étiquette thermique"
                              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredLevels.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-10 text-center text-sm text-slate-500">
                        Aucun article trouvé dans le stock.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Stock Movements Audit Trail */}
          {(stockData?.movements || []).length > 0 && (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-5 py-3.5 border-b border-slate-200 flex items-center gap-2">
                <History className="w-4 h-4 text-slate-500" />
                <h3 className="font-display font-semibold text-sm text-slate-900">
                  Derniers mouvements de stock
                </h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                    <tr>
                      <th className="py-2.5 px-4">Date</th>
                      <th className="py-2.5 px-4">Article</th>
                      <th className="py-2.5 px-4 text-right">Variation</th>
                      <th className="py-2.5 px-4 text-right">Avant → Après</th>
                      <th className="py-2.5 px-4">Motif</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {(stockData?.movements || []).slice(0, 15).map((m: any) => {
                      const info = productNameById.get(m.productId);
                      return (
                        <tr key={m.id}>
                          <td className="py-2 px-4 tabular-nums text-slate-500">
                            {new Date(m.createdAt).toLocaleString('fr-FR')}
                          </td>
                          <td className="py-2 px-4 font-medium text-slate-900">
                            {info ? info.name : `Produit #${m.productId}`}
                          </td>
                          <td
                            className={`py-2 px-4 text-right font-mono font-semibold tabular-nums ${
                              m.delta > 0 ? 'text-emerald-700' : m.delta < 0 ? 'text-red-600' : 'text-slate-500'
                            }`}
                          >
                            {m.delta > 0 ? `+${m.delta}` : m.delta}
                          </td>
                          <td className="py-2 px-4 text-right font-mono text-slate-600 tabular-nums">
                            {m.previousQty} → {m.newQty}
                          </td>
                          <td className="py-2 px-4 text-slate-600">{m.reason}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {subTab === 'alerts' && (
        <div className="space-y-5">
          <div className="bg-white border border-slate-200 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <Mail className="w-5 h-5 text-blue-700 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-display font-semibold text-sm text-slate-900">
                  Notifications e-mail d’alertes stock faible
                </h3>
                <p className="text-xs text-slate-600 mt-0.5">
                  Destinataire administrateur : <span className="font-mono font-semibold">{stockData?.adminAlertEmail}</span> · Seuil global par défaut : <span className="font-mono font-semibold">{stockData?.globalLowStockThreshold ?? 10}</span> unités (modifiable par produit et dans Paramètres généraux).
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4">Produit</th>
                  <th className="py-3 px-4 text-right">Stock / Seuil</th>
                  <th className="py-3 px-4">Statut alerte</th>
                  <th className="py-3 px-4">Notification e-mail</th>
                  <th className="py-3 px-4 text-right">Réappro rapide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(stockData?.alerts || []).length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-sm text-slate-500">
                      Aucune alerte de stock faible enregistrée.
                    </td>
                  </tr>
                ) : (
                  stockData.alerts.map((a: any) => (
                    <tr key={a.id}>
                      <td className="py-3 px-4">
                        <p className="font-medium text-slate-900">{a.productName}</p>
                        <p className="text-xs font-mono text-slate-400">{a.productSku}</p>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-xs tabular-nums">
                        <span className="font-bold text-red-600">{a.currentStock}</span> / {a.thresholdUsed}
                      </td>
                      <td className="py-3 px-4 text-xs font-semibold">
                        {a.status === 'active' ? (
                          <span className="text-red-600">Active</span>
                        ) : (
                          <span className="text-emerald-700">Résolue</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {a.emailStatus === 'sent'
                          ? `Envoyé à ${a.emailRecipient}`
                          : a.emailStatus === 'not_configured'
                          ? 'SMTP/Resend non configuré (alerte dashboard active)'
                          : a.emailError || a.emailStatus}
                      </td>
                      <td className="py-3 px-4 text-right">
                        {a.status === 'active' && (
                          <button
                            type="button"
                            onClick={() => handleQuickAdjust(a.productId, a.thresholdUsed + 10)}
                            className="px-3 py-1.5 rounded-lg bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                          >
                            +{a.thresholdUsed + 10} u.
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
