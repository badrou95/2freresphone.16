import React, { useState } from 'react';
import {
  Calculator,
  CheckCircle2,
  Cpu,
  Database,
  FileSpreadsheet,
  HardDrive,
  Layers,
  RefreshCw,
  Save,
  Sparkles,
  Upload,
} from 'lucide-react';
import { adminFetch } from '../../lib/api';
import { formatDzd } from '../../shared/domain';

interface MdfIdfBinaryDecoderModuleProps {
  categories?: any[];
  onRefresh: () => void;
  onNavigateCompta?: () => void;
  onNavigateStockLevels?: () => void;
  compact?: boolean;
}

/**
 * Compacts large binary database files (.mdf, .idf, .ldf, .ndf, .bak, .dbf) in the browser
 * by collapsing long empty zero-byte (0x00) allocation runs so even 100MB+ .MDF/.IDF files
 * upload rapidly without hitting serverless payload limits.
 */
export async function compactDatabaseFileForUpload(file: File): Promise<File> {
  const isBinaryDbExt = /\.(mdf|idf|ldf|ndf|idx|ndx|bak|dat|dbf|fic)$/i.test(file.name);
  if (!isBinaryDbExt && file.size <= 2.5 * 1024 * 1024) {
    return file;
  }
  if (file.size <= 1.5 * 1024 * 1024) {
    return file;
  }
  try {
    const sliceLimit = Math.min(file.size, 60 * 1024 * 1024);
    const ab = await file.slice(0, sliceLimit).arrayBuffer();
    const src = new Uint8Array(ab);
    if (
      file.size <= 3.5 * 1024 * 1024 &&
      src.length >= 4 &&
      ((src[0] === 0x50 && src[1] === 0x4b) || (src[0] === 0xd0 && src[1] === 0xcf) || src[0] === 0x53)
    ) {
      return file;
    }
    const maxOut = 2.2 * 1024 * 1024;
    const out = new Uint8Array(Math.min(src.length, maxOut));
    let outIdx = 0;
    let zeroRun = 0;
    for (let i = 0; i < src.length && outIdx < maxOut; i++) {
      const b = src[i];
      if (b === 0) {
        zeroRun++;
        if (zeroRun <= 4) {
          out[outIdx++] = 0;
        }
      } else {
        zeroRun = 0;
        out[outIdx++] = b;
      }
    }
    const compactedBlob = new Blob([out.subarray(0, outIdx)], {
      type: file.type || 'application/octet-stream',
    });
    return new File([compactedBlob], file.name, {
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
    });
  } catch {
    return file;
  }
}

export function MdfIdfBinaryDecoderModule({
  categories = [],
  onRefresh,
  onNavigateCompta,
  onNavigateStockLevels,
}: MdfIdfBinaryDecoderModuleProps) {
  const [mdfFile, setMdfFile] = useState<File | null>(null);
  const [idfFile, setIdfFile] = useState<File | null>(null);
  const [extraFiles, setExtraFiles] = useState<File[]>([]);
  const [syncMode, setSyncMode] = useState<'full_sync' | 'add_and_update_stock' | 'add_only'>('full_sync');
  const [generateAccounting, setGenerateAccounting] = useState<boolean>(true);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [autoIntegrateOnSelect, setAutoIntegrateOnSelect] = useState<boolean>(false);

  const [parsing, setParsing] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);

  const allFiles: File[] = [
    ...(mdfFile ? [mdfFile] : []),
    ...(idfFile ? [idfFile] : []),
    ...extraFiles,
  ];

  const runBinaryDecodePreview = async (filesToAnalyze: File[], shouldAutoCommit = false) => {
    if (filesToAnalyze.length === 0) return;
    setParsing(true);
    setErrorMsg(null);
    setCommitResult(null);
    try {
      const compactedFiles = await Promise.all(
        filesToAnalyze.map((f) => compactDatabaseFileForUpload(f)),
      );
      const fd = new FormData();
      for (const f of compactedFiles) {
        fd.append('files', f);
      }
      fd.append('syncMode', syncMode);
      const res = await adminFetch<any>('/api/admin/stock/import/preview', {
        method: 'POST',
        body: fd,
      });
      setPreview(res);

      if (shouldAutoCommit || autoIntegrateOnSelect) {
        await executeCommit(filesToAnalyze, res);
      }
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du décodage binaire des fichiers .MDF / .IDF.');
    } finally {
      setParsing(false);
    }
  };

  const executeCommit = async (filesToCommit?: File[], previewOverride?: any) => {
    const targetFiles = filesToCommit && filesToCommit.length > 0 ? filesToCommit : allFiles;
    if (targetFiles.length === 0) {
      setErrorMsg('Veuillez sélectionner votre fichier .MDF (Point 1) et/ou votre fichier .IDF (Point 2).');
      return;
    }
    setCommitting(true);
    setErrorMsg(null);
    try {
      const compactedFiles = await Promise.all(
        targetFiles.map((f) => compactDatabaseFileForUpload(f)),
      );
      const fd = new FormData();
      for (const f of compactedFiles) {
        fd.append('files', f);
      }
      const activePreview = previewOverride || preview;
      if (activePreview?.selectedTable) {
        fd.append('tableName', activePreview.selectedTable);
      }
      fd.append('syncMode', syncMode);
      fd.append('generateAccounting', generateAccounting ? 'true' : 'false');
      if (activePreview?.inferredMapping) {
        fd.append('mapping', JSON.stringify(activePreview.inferredMapping));
      }
      if (defaultCategoryId) {
        fd.append('defaultCategoryId', defaultCategoryId);
      }

      const res = await adminFetch<any>('/api/admin/stock/import/commit', {
        method: 'POST',
        body: fd,
      });
      setCommitResult(res);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors de la sauvegarde et de l’intégration dans la base de données.');
    } finally {
      setCommitting(false);
    }
  };

  const handleSelectSlot = (slot: 'mdf' | 'idf', file: File | null) => {
    if (!file) return;
    const nextMdf = slot === 'mdf' ? file : mdfFile;
    const nextIdf = slot === 'idf' ? file : idfFile;
    if (slot === 'mdf') setMdfFile(file);
    if (slot === 'idf') setIdfFile(file);

    const combined = [
      ...(nextMdf ? [nextMdf] : []),
      ...(nextIdf ? [nextIdf] : []),
      ...extraFiles,
    ];
    runBinaryDecodePreview(combined, false);
  };

  const handleSelectMultiple = (fileList: FileList | null, immediateCommit = false) => {
    if (!fileList || fileList.length === 0) return;
    const arr = Array.from(fileList);
    const foundMdf = arr.find((f) => /\.(mdf|ndf)$/i.test(f.name));
    const foundIdf = arr.find((f) => /\.(idf|ldf|idx|ndx)$/i.test(f.name));
    const others = arr.filter((f) => f !== foundMdf && f !== foundIdf);

    if (foundMdf) setMdfFile(foundMdf);
    if (foundIdf) setIdfFile(foundIdf);
    setExtraFiles(others);

    const combined = [
      ...(foundMdf ? [foundMdf] : mdfFile ? [mdfFile] : []),
      ...(foundIdf ? [foundIdf] : idfFile ? [idfFile] : []),
      ...others,
    ];
    runBinaryDecodePreview(combined.length > 0 ? combined : arr, immediateCommit);
  };

  return (
    <div className="bg-white border-2 border-blue-600 rounded-2xl p-5 sm:p-6 shadow-md space-y-5">
      {/* Header Banner */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-blue-700 text-white text-xs font-bold uppercase tracking-wider shadow-sm">
              <Cpu className="w-3.5 h-3.5" />
              <span>Module Décodage Binaire .MDF + .IDF · Ajouter le Stock &amp; Compta</span>
            </span>
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-900 text-[11px] font-bold">
              <Database className="w-3.5 h-3.5" />
              <span>SQL Server 8Ko Pages · UTF-16LE / Latin1 / Int32 · DBase · SQLite · Excel</span>
            </span>
          </div>
          <h2 className="font-display font-bold text-base sm:text-lg text-slate-900">
            Ajouter le Stock &amp; Générer toute votre Comptabilité depuis vos fichiers .MDF et .IDF
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Chargez votre fichier <strong>.MDF</strong> (Point 1) et votre fichier <strong>.IDF</strong> (Point 2) ci-dessous, puis cliquez sur le bouton vert{' '}
            <strong>« Sauvegarder &amp; Intégrer maintenant dans le système »</strong> pour créer automatiquement tout votre stock et votre comptabilité.
          </p>
        </div>

        {/* 1-Click Direct Upload & Auto-Integrate Button */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors">
            <Sparkles className="w-4 h-4" />
            <span>Sélectionner .MDF + .IDF &amp; Intégrer en 1 Clic</span>
            <input
              type="file"
              multiple
              accept=".mdf,.idf,.ldf,.ndf,.idx,.ndx,.dbf,.fic,.bak,.dat,.xlsx,.xls,.csv,.tsv,.txt,.json,.xml,.db,.sqlite,.sqlite3,.sql"
              onChange={(e) => handleSelectMultiple(e.target.files, true)}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Point 1 (.MDF) & Point 2 (.IDF) Dedicated Binary Upload Slots */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* POINT 1: .MDF */}
        <label
          className={`flex flex-col justify-between p-4 sm:p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            mdfFile
              ? 'border-blue-600 bg-blue-50/70 shadow-sm'
              : 'border-blue-300 hover:border-blue-600 bg-slate-50/80'
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-blue-800">
                  Point 1 · Fichier Base de Données (.MDF)
                </span>
                {mdfFile && (
                  <span className="px-2 py-0.5 rounded bg-blue-700 text-white text-[10px] font-bold">
                    CHARGÉ
                  </span>
                )}
              </div>
              <p className="font-display font-bold text-sm text-slate-900 mt-1 truncate">
                {mdfFile ? mdfFile.name : 'Cliquez ici pour uploader votre fichier .MDF'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {mdfFile
                  ? `Taille : ${Math.max(1, Math.round(mdfFile.size / 1024))} Ko · Prêt pour le décodage binaire`
                  : 'Décodage binaire des tables Articles, Produits, Prix d’achat/vente et Écritures comptables'}
              </p>
            </div>
          </div>
          <input
            type="file"
            accept=".mdf,.ndf,.dbf,.bak,.db,.sqlite,.sqlite3,.sql,.xlsx,.xls,.csv,.json,.xml"
            onChange={(e) => handleSelectSlot('mdf', e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>

        {/* POINT 2: .IDF */}
        <label
          className={`flex flex-col justify-between p-4 sm:p-5 rounded-xl border-2 border-dashed cursor-pointer transition-all ${
            idfFile
              ? 'border-emerald-600 bg-emerald-50/70 shadow-sm'
              : 'border-emerald-300 hover:border-emerald-600 bg-slate-50/80'
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
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-800">
                  Point 2 · Fichier Index &amp; Inventaire (.IDF)
                </span>
                {idfFile && (
                  <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-[10px] font-bold">
                    CHARGÉ
                  </span>
                )}
              </div>
              <p className="font-display font-bold text-sm text-slate-900 mt-1 truncate">
                {idfFile ? idfFile.name : 'Cliquez ici pour uploader votre fichier .IDF'}
              </p>
              <p className="text-xs text-slate-600 mt-1">
                {idfFile
                  ? `Taille : ${Math.max(1, Math.round(idfFile.size / 1024))} Ko · Prêt pour la fusion d’index`
                  : 'Décodage binaire des index, quantités en stock, mouvements et journaux (.idf, .ldf, .idx)'}
              </p>
            </div>
          </div>
          <input
            type="file"
            accept=".idf,.ldf,.idx,.ndx,.mdf,.dbf,.bak,.db,.sqlite,.sql,.csv,.json,.xml"
            onChange={(e) => handleSelectSlot('idf', e.target.files?.[0] || null)}
            className="hidden"
          />
        </label>
      </div>

      {/* Multi-file dropzone + Category & Auto-Integrate options */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
        <label className="lg:col-span-6 flex items-center justify-between gap-3 border border-slate-300 hover:border-blue-600 rounded-xl px-4 py-3 cursor-pointer bg-slate-50/80 transition-colors">
          <div className="flex items-center gap-2.5 min-w-0">
            <FileSpreadsheet className="w-4 h-4 text-blue-700 shrink-0" />
            <span className="text-xs font-semibold text-slate-800 truncate">
              {allFiles.length > 0
                ? `Fichiers sélectionnés (${allFiles.length}) : ${allFiles.map((f) => f.name).join(' + ')}`
                : 'Ou sélectionner les 2 fichiers (.MDF + .IDF) ensemble en un seul clic'}
            </span>
          </div>
          <span className="px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 text-[11px] font-bold shrink-0">
            Parcourir...
          </span>
          <input
            type="file"
            multiple
            accept=".mdf,.idf,.ldf,.ndf,.idx,.ndx,.dbf,.fic,.bak,.dat,.xlsx,.xls,.csv,.tsv,.txt,.json,.xml,.db,.sqlite,.sqlite3,.sql"
            onChange={(e) => handleSelectMultiple(e.target.files, false)}
            className="hidden"
          />
        </label>

        <div className="lg:col-span-3">
          <select
            value={defaultCategoryId}
            onChange={(e) => setDefaultCategoryId(e.target.value)}
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white font-medium text-slate-800"
          >
            <option value="">Catégorie auto (détectée du .MDF)</option>
            {categories.map((c: any) => (
              <option key={c.id} value={String(c.id)}>
                Catégorie : {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="lg:col-span-3">
          <select
            value={syncMode}
            onChange={(e) => setSyncMode(e.target.value as any)}
            className="w-full px-3 py-2.5 text-xs rounded-xl border border-slate-300 bg-white font-semibold text-slate-800"
          >
            <option value="full_sync">Mode : Sync complète (Stock + Prix + Compta)</option>
            <option value="add_and_update_stock">Mode : Ajouter + Mettre à jour quantités</option>
            <option value="add_only">Mode : Nouveaux produits uniquement</option>
          </select>
        </div>
      </div>

      {/* ALWAYS-VISIBLE ACTION BAR TO SAVE & INTEGRATE INTO POSTGRESQL */}
      <div
        className={`p-4 sm:p-5 rounded-xl border-2 transition-all ${
          allFiles.length > 0
            ? 'bg-emerald-50 border-emerald-600 shadow-md'
            : 'bg-slate-100/90 border-slate-300'
        }`}
      >
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                  allFiles.length > 0 ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-800'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Action d’intégration Base de Données</span>
              </span>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-950 cursor-pointer ml-1">
                <input
                  type="checkbox"
                  checked={generateAccounting}
                  onChange={(e) => setGenerateAccounting(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-700"
                />
                <span>Générer aussi toute la Comptabilité (Bilan, Achats, Ventes, Marges)</span>
              </label>
              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 cursor-pointer ml-2">
                <input
                  type="checkbox"
                  checked={autoIntegrateOnSelect}
                  onChange={(e) => setAutoIntegrateOnSelect(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-blue-700"
                />
                <span>Intégration auto dès sélection</span>
              </label>
            </div>

            <p className="text-sm font-bold text-slate-900">
              {parsing
                ? 'Décodage binaire des pages .MDF / .IDF en cours...'
                : allFiles.length > 0
                ? `Prêt à sauvegarder : ${allFiles.map((f) => f.name).join(' + ')}${
                    preview
                      ? ` → ${
                          (preview.diffSummary?.toAddCount || 0) +
                          (preview.diffSummary?.toUpdateCount || 0)
                        } article(s) Stock + ${
                          preview.accountingPreview?.totalEntries ?? 0
                        } écriture(s) Compta décodés`
                      : ''
                  }`
                : 'Étape 1 : Choisissez votre fichier .MDF et/ou .IDF ci-dessus · Étape 2 : Cliquez sur le bouton vert à droite'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {allFiles.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={parsing || committing}
                  onClick={() => runBinaryDecodePreview(allFiles, false)}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${parsing ? 'animate-spin' : ''}`} />
                  <span>{parsing ? 'Décodage...' : 'Décoder / Aperçu'}</span>
                </button>
                <button
                  type="button"
                  disabled={committing}
                  onClick={() => {
                    setMdfFile(null);
                    setIdfFile(null);
                    setExtraFiles([]);
                    setPreview(null);
                    setErrorMsg(null);
                  }}
                  className="px-3 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-600"
                >
                  Réinitialiser
                </button>
              </>
            )}

            <button
              type="button"
              disabled={allFiles.length === 0 || committing}
              onClick={() => executeCommit()}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                allFiles.length > 0
                  ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer ring-2 ring-emerald-400/50'
                  : 'bg-slate-300 text-slate-500 cursor-not-allowed'
              }`}
            >
              <Upload className="w-4 h-4" />
              <span>
                {committing
                  ? 'Sauvegarde & Intégration du Stock + Compta en cours...'
                  : 'SAUVEGARDER & INTÉGRER MAINTENANT (GÉNÉRER STOCK + COMPTA)'}
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Error Message */}
      {errorMsg && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-xs sm:text-sm text-red-700 font-medium">
          {errorMsg}
        </div>
      )}

      {/* Commit Confirmation Banner */}
      {commitResult && (
        <div className="p-5 rounded-xl bg-emerald-50 border-2 border-emerald-600 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-6 h-6 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-bold text-emerald-950">
                Base de données .MDF / .IDF intégrée avec succès dans votre système !
              </p>
              <p className="text-xs text-emerald-900 mt-1">
                <strong>+{commitResult.importRecord?.addedCount ?? 0}</strong> nouveaux articles créés ·{' '}
                <strong>{commitResult.importRecord?.updatedCount ?? 0}</strong> articles mis à jour ·{' '}
                <strong>+{commitResult.accountingGeneratedCount ?? 0}</strong> écritures comptables générées dans la Compta.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {onNavigateStockLevels && (
              <button
                type="button"
                onClick={onNavigateStockLevels}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Voir le Stock ({commitResult.importRecord?.totalRows ?? 0})</span>
              </button>
            )}
            {onNavigateCompta && (
              <button
                type="button"
                onClick={onNavigateCompta}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
              >
                <Calculator className="w-3.5 h-3.5" />
                <span>Ouvrir la Comptabilité générée</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Compact Decoded Preview Summary */}
      {preview && (
        <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="px-2.5 py-1 rounded bg-blue-100 text-blue-900 text-xs font-bold">
                Décodage Binaire OK : {preview.selectedTable} ({String(preview.format || 'mdf_idf').toUpperCase()})
              </span>
              <span className="px-2.5 py-1 rounded bg-emerald-100 text-emerald-900 text-xs font-bold">
                +{preview.diffSummary?.toAddCount ?? 0} nouveaux articles
              </span>
              <span className="px-2.5 py-1 rounded bg-indigo-100 text-indigo-900 text-xs font-bold">
                {preview.diffSummary?.toUpdateCount ?? 0} articles à mettre à jour
              </span>
              {preview.accountingPreview && (
                <span className="px-2.5 py-1 rounded bg-amber-100 text-amber-900 text-xs font-bold">
                  {preview.accountingPreview.totalEntries} écriture(s) Compta · Valeur Stock :{' '}
                  {formatDzd(preview.accountingPreview.stockSaleValuationDzd || 0)} (Marge : +
                  {formatDzd(preview.accountingPreview.stockPotentialMarginDzd || 0)})
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={committing}
              onClick={() => executeCommit()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold shadow-sm"
            >
              <Save className="w-3.5 h-3.5" />
              <span>
                {committing
                  ? 'Intégration en cours...'
                  : 'Confirmer & Sauvegarder ce Stock + Compta'}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
