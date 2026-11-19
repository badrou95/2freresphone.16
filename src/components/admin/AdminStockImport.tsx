import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Camera,
  CheckCircle2,
  Database,
  FileSpreadsheet,
  History,
  Mail,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  Upload,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { printProductThermalLabels } from '../../lib/printer';
import { formatDzd } from '../../shared/domain';
import { StoreSettings } from '../../types';
import { FinancialMarginWidget } from './FinancialMarginWidget';

interface AdminStockImportProps {
  products: any[];
  categories: any[];
  stockData: any;
  storeSettings?: Partial<StoreSettings>;
  initialSubTab?: 'import' | 'levels' | 'alerts';
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
  initialSubTab = 'levels',
  onRefresh,
  onGoToMissingPhotos,
}: AdminStockImportProps) {
  const [subTab, setSubTab] = useState<'import' | 'levels' | 'alerts'>(initialSubTab);

  // Universal Stock Database Import State
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [syncMode, setSyncMode] = useState<'add_only' | 'add_and_update_stock' | 'full_sync'>('add_only');
  const [selectedTable, setSelectedTable] = useState<string>('');
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [saveProfileName, setSaveProfileName] = useState('');
  const [preview, setPreview] = useState<any | null>(null);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);

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
    file: File,
    opts?: { tableName?: string; mode?: string; customMapping?: Record<string, string> },
  ) => {
    setParsing(true);
    setImportError(null);
    setCommitResult(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('syncMode', opts?.mode || syncMode);
      if (opts?.tableName) fd.append('tableName', opts.tableName);
      if (opts?.customMapping && opts.customMapping.name) {
        fd.append('mappingJson', JSON.stringify(opts.customMapping));
      }
      const res = await adminFetch<any>('/api/admin/stock/import/preview', {
        method: 'POST',
        body: fd,
      });
      setPreview(res);
      setSelectedTable(res.selectedTable);
      setMapping(res.mapping || {});
    } catch (err: any) {
      setPreview(null);
      setImportError(err.message || 'Impossible d’analyser ce fichier.');
    } finally {
      setParsing(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setSelectedFile(f);
    runPreview(f);
  };

  const handleApplySavedProfile = (profile: any) => {
    try {
      const parsedMap = JSON.parse(profile.columnMappingJson);
      setMapping(parsedMap);
      setSyncMode(profile.defaultSyncMode || 'add_only');
      if (selectedFile) {
        runPreview(selectedFile, {
          tableName: profile.tableOrSheetName || selectedTable,
          mode: profile.defaultSyncMode || 'add_only',
          customMapping: parsedMap,
        });
      }
    } catch {
      // ignore invalid json
    }
  };

  const handleCommitImport = async () => {
    if (!selectedFile || !preview) return;
    setCommitting(true);
    setImportError(null);
    try {
      const fd = new FormData();
      fd.append('file', selectedFile);
      fd.append('syncMode', syncMode);
      fd.append('tableName', selectedTable);
      fd.append('mappingJson', JSON.stringify(mapping));
      if (defaultCategoryId) fd.append('defaultCategoryId', defaultCategoryId);
      if (saveProfileName.trim()) fd.append('saveProfileName', saveProfileName.trim());

      const res = await adminFetch<any>('/api/admin/stock/import/commit', {
        method: 'POST',
        body: fd,
      });
      setCommitResult(res);
      setPreview(null);
      setSelectedFile(null);
      setSaveProfileName('');
      onRefresh();
    } catch (err: any) {
      setImportError(err.message || 'Erreur lors de l’importation.');
    } finally {
      setCommitting(false);
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

  const activeAlerts = (stockData?.alerts || []).filter((a: any) => a.status === 'active');

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap p-1 bg-slate-200/70 rounded-lg">
        <button
          type="button"
          onClick={() => setSubTab('levels')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
            subTab === 'levels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Gestion &amp; Niveaux de stock ({physicalProducts.length})
        </button>
        <button
          type="button"
          onClick={() => setSubTab('import')}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold ${
            subTab === 'import' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>Importer base logiciel de stock</span>
        </button>
        <button
          type="button"
          onClick={() => setSubTab('alerts')}
          className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-semibold ${
            subTab === 'alerts' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-red-600" />
          <span>Alertes stock faible ({activeAlerts.length})</span>
        </button>
      </div>

      {subTab === 'import' && (
        <div className="space-y-6">
          {/* Universal Dropzone Card */}
          <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-5">
            <div>
              <h2 className="font-display font-bold text-lg text-slate-900">
                Importation universelle de votre base de données de stock
              </h2>
              <p className="text-sm text-slate-600 mt-1">
                Téléversez directement le fichier exporté ou la base de données de votre logiciel de caisse/stock.
                En mode par défaut <strong>« Nouveaux articles uniquement »</strong>, chaque mise à jour ajoute
                uniquement les articles nouvellement ajoutés dans votre logiciel sans écraser vos produits ni vos photos.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {[
                {
                  id: 'add_only',
                  title: 'Nouveaux articles uniquement',
                  desc: 'Ajoute uniquement les nouveaux articles absents de la boutique. Ne modifie pas les articles existants ni leurs photos.',
                },
                {
                  id: 'add_and_update_stock',
                  title: 'Nouveaux + Mise à jour quantités',
                  desc: 'Ajoute les nouveaux articles et met à jour les quantités de stock existantes (conserve 100 % des photos).',
                },
                {
                  id: 'full_sync',
                  title: 'Synchronisation complète (prix + stock)',
                  desc: 'Ajoute les nouveaux et synchronise prix et quantités des existants tout en préservant les photos.',
                },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => {
                    setSyncMode(m.id as any);
                    if (selectedFile) {
                      runPreview(selectedFile, {
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

            <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-300 hover:border-blue-600 rounded-xl p-8 cursor-pointer bg-slate-50 transition-colors">
              <FileSpreadsheet className="w-8 h-8 text-blue-700 mb-2" />
              <span className="text-sm font-semibold text-slate-900">
                {parsing
                  ? 'Analyse du fichier de base de stock en cours...'
                  : selectedFile
                  ? `Fichier chargé : ${selectedFile.name}`
                  : 'Cliquez ou déposez votre fichier de base de stock ici'}
              </span>
              <span className="text-xs text-slate-500 mt-1 text-center">
                Tous formats pris en charge : Excel (.xlsx, .xls) · CSV / TSV / TXT · JSON · XML · Base SQLite (.db, .sqlite, .sqlite3) · Sauvegarde SQL (.sql)
              </span>
              <input
                type="file"
                accept=".xlsx,.xls,.csv,.tsv,.txt,.json,.xml,.db,.sqlite,.sqlite3,.sql"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {importError && (
              <div className="p-3.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
                {importError}
              </div>
            )}

            {commitResult && (
              <div className="p-5 rounded-xl bg-emerald-50 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-bold text-emerald-950">
                      Importation terminée : {commitResult.importRecord.addedCount} nouveau(x) article(s) ajouté(s),{' '}
                      {commitResult.importRecord.updatedCount} mis à jour, {commitResult.importRecord.skippedCount} déjà existant(s) ignoré(s).
                    </p>
                    <p className="text-xs text-emerald-800 mt-1">
                      Vous pouvez maintenant ajouter les photos de vos nouveaux articles directement dans le panneau Produits.
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => setSubTab('levels')}
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg border border-emerald-700 bg-white hover:bg-emerald-100 text-emerald-900 text-xs font-semibold whitespace-nowrap"
                  >
                    <span>Modifier quantités &amp; prix</span>
                  </button>
                  <button
                    type="button"
                    onClick={onGoToMissingPhotos}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap"
                  >
                    <Camera className="w-3.5 h-3.5" />
                    <span>Ajouter les photos maintenant</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Preview & Column Mapper */}
          {preview && (
            <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-slate-100">
                <div>
                  <h3 className="font-display font-bold text-base text-slate-900">
                    Aperçu différentiel — {preview.fileName} ({preview.format.toUpperCase()})
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
                    {preview.totalRows} ligne(s) détectée(s) dans « {preview.selectedTable} »
                  </p>
                </div>

                {preview.tables && preview.tables.length > 1 && (
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-semibold text-slate-700">Table / Feuille :</label>
                    <select
                      value={selectedTable}
                      onChange={(e) => {
                        setSelectedTable(e.target.value);
                        if (selectedFile) runPreview(selectedFile, { tableName: e.target.value });
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
              </div>

              {/* Differential Summary Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-lg bg-emerald-50 border border-emerald-200">
                  <p className="text-xs text-emerald-800">Nouveaux à ajouter</p>
                  <p className="font-mono font-bold text-2xl text-emerald-900 tabular-nums mt-0.5">
                    +{preview.diffSummary.toAddCount}
                  </p>
                </div>
                <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200">
                  <p className="text-xs text-blue-800">Existants à mettre à jour</p>
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
                <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-200">
                  <p className="text-xs text-amber-800">Lignes incomplètes</p>
                  <p className="font-mono font-bold text-2xl text-amber-900 tabular-nums mt-0.5">
                    {preview.diffSummary.errorCount}
                  </p>
                </div>
              </div>

              {/* Visual Column Mapper */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900">
                    Correspondance des colonnes de votre logiciel (détectée automatiquement)
                  </h4>
                  <button
                    type="button"
                    onClick={() =>
                      selectedFile &&
                      runPreview(selectedFile, {
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
                    Aperçu des nouveaux articles qui seront ajoutés ({preview.diffSummary.toAddCount})
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
                    <option value="">Créer / Laisser non classé</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Mémoriser ce profil logiciel (optionnel)
                  </label>
                  <input
                    value={saveProfileName}
                    onChange={(e) => setSaveProfileName(e.target.value)}
                    placeholder="Ex. Mon Logiciel Caisse 2Frères"
                    className="w-full px-3 py-2 text-xs rounded-lg border border-slate-300"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setPreview(null);
                    setSelectedFile(null);
                  }}
                  className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={committing || (preview.diffSummary.toAddCount === 0 && preview.diffSummary.toUpdateCount === 0)}
                  onClick={handleCommitImport}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 disabled:bg-slate-300 text-white text-xs font-semibold"
                >
                  <Upload className="w-4 h-4" />
                  <span>
                    {committing
                      ? 'Importation en base PostgreSQL...'
                      : `Valider l’importation (+${preview.diffSummary.toAddCount} nouveau(x))`}
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
                Historique des imports de base de stock
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                  <tr>
                    <th className="py-2.5 px-4">Date</th>
                    <th className="py-2.5 px-4">Fichier</th>
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

      {subTab === 'levels' && (
        <div className="space-y-4">
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
