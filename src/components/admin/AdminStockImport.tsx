import React, { useState } from 'react';
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
  RefreshCw,
  Upload,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { formatDzd } from '../../shared/domain';

interface AdminStockImportProps {
  products: any[];
  categories: any[];
  stockData: any;
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
  initialSubTab = 'import',
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

  // Manual quick stock adjust
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');

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
    try {
      await adminFetch('/api/admin/stock/adjust', {
        method: 'POST',
        body: JSON.stringify({
          productId,
          delta,
          reason: delta > 0 ? 'Réapprovisionnement rapide admin' : 'Sortie manuelle admin',
        }),
      });
      onRefresh();
    } finally {
      setAdjustingId(null);
    }
  };

  const physicalProducts = products.filter((p) => p.productType === 'physical');
  const filteredLevels = physicalProducts.filter((p) => {
    if (stockFilter === 'low') return p.isLowStock;
    if (stockFilter === 'out') return p.stockQuantity <= 0;
    return true;
  });

  const activeAlerts = (stockData?.alerts || []).filter((a: any) => a.status === 'active');

  return (
    <div className="space-y-5">
      <div className="inline-flex flex-wrap p-1 bg-slate-200/70 rounded-lg">
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
          onClick={() => setSubTab('levels')}
          className={`px-4 py-1.5 rounded-md text-xs font-semibold ${
            subTab === 'levels' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'
          }`}
        >
          Niveaux de stock ({physicalProducts.length})
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
                <button
                  type="button"
                  onClick={onGoToMissingPhotos}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold whitespace-nowrap shrink-0"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>Ajouter les photos maintenant</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
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
                          <th className="py-2 px-3 text-right">Prix (DZD)</th>
                          <th className="py-2 px-3 text-right">Stock</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {preview.diffSummary.sampleToAdd.map((item: any, idx: number) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-mono text-slate-600">{item.sku}</td>
                            <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                            <td className="py-2 px-3 text-slate-600">{item.categoryName || 'Défaut'}</td>
                            <td className="py-2 px-3 text-right font-mono tabular-nums">{formatDzd(item.priceDzd)}</td>
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
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between gap-3">
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
            <span className="text-xs text-slate-500">
              Seuil global par défaut : <strong className="font-mono">{stockData?.globalLowStockThreshold ?? 10}</strong> u.
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <tr>
                  <th className="py-3 px-4">Article</th>
                  <th className="py-3 px-4 text-right">Stock actuel</th>
                  <th className="py-3 px-4 text-right">Seuil alerte</th>
                  <th className="py-3 px-4 text-right">Ajustement rapide</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredLevels.map((p) => (
                  <tr key={p.id}>
                    <td className="py-3 px-4">
                      <p className="font-medium text-slate-900">{p.name}</p>
                      <p className="text-xs font-mono text-slate-400">{p.sku}</p>
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold tabular-nums">
                      <span className={p.isLowStock ? 'text-red-600' : 'text-slate-900'}>
                        {p.stockQuantity}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-xs text-slate-600 tabular-nums">
                      {p.effectiveLowStockThreshold}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          disabled={adjustingId === p.id || p.stockQuantity <= 0}
                          onClick={() => handleQuickAdjust(p.id, -1)}
                          className="px-2.5 py-1 rounded border border-slate-300 text-xs font-mono hover:bg-slate-50"
                        >
                          -1
                        </button>
                        <button
                          type="button"
                          disabled={adjustingId === p.id}
                          onClick={() => handleQuickAdjust(p.id, 5)}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-900 text-white text-xs font-mono hover:bg-slate-800"
                        >
                          <Plus className="w-3 h-3" />5
                        </button>
                        <button
                          type="button"
                          disabled={adjustingId === p.id}
                          onClick={() => handleQuickAdjust(p.id, 20)}
                          className="px-2.5 py-1 rounded border border-blue-200 bg-blue-50 text-blue-700 text-xs font-mono hover:bg-blue-100"
                        >
                          +20
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
