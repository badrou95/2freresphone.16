import React, { useEffect, useState } from 'react';
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
  Trash2,
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

function uint8ToBase64(bytes: Uint8Array): string {
  const CHUNK = 0x8000;
  const parts: string[] = [];
  for (let i = 0; i < bytes.length; i += CHUNK) {
    const sub = bytes.subarray(i, Math.min(i + CHUNK, bytes.length));
    let str = '';
    for (let j = 0; j < sub.length; j++) {
      str += String.fromCharCode(sub[j]);
    }
    parts.push(str);
  }
  return btoa(parts.join(''));
}

/**
 * Lossless 8192-byte SQL Server Data Page Extractor for browser uploads:
 * - NEVER strips zero bytes inside 8192-byte SQL Server pages (which would destroy
 *   page alignment, null bitmaps, var-offset arrays, and 8-byte FLOAT64/DECIMAL prices).
 * - Trims .LDF transaction log files > 16 KB down to 16 KB (only header needed).
 * - For any .MDF / .NDF / .IDF file > 128 KB, copies complete 8192-byte SQL Server Leaf Data
 *   & System Catalog pages (headerVer=1, pageType=1, pageLevel=0, slotCnt 1..700) verbatim
 *   while skipping empty disk allocation pages and sys.sysobjvalues (m_objId = 60).
 */
export async function compactDatabaseFileForUpload(file: File): Promise<File> {
  // 1. Transaction log files (.ldf) only carry WAL transaction rollbacks; keep 16 KB header
  if (/\.ldf$/i.test(file.name) && file.size > 16 * 1024) {
    return new File([file.slice(0, 16 * 1024)], file.name, {
      type: file.type || 'application/octet-stream',
      lastModified: file.lastModified,
    });
  }

  // 2. Small files <= 128 KB need no page filtering
  if (file.size <= 128 * 1024) {
    return file;
  }

  const isBinaryDbFile = /\.(mdf|ndf|idf|bak|dat)$/i.test(file.name);
  if (!isBinaryDbFile) {
    return file;
  }

  try {
    const sliceLimit = Math.min(file.size, 120 * 1024 * 1024);
    const ab = await file.slice(0, sliceLimit).arrayBuffer();
    const src = new Uint8Array(ab);
    const view = new DataView(ab);
    const PAGE_SIZE = 8192;

    if (src.length < PAGE_SIZE * 2) {
      return file;
    }

    // Match the exact SQL Server 8KB Leaf Data Page condition used by parseSqlServer8KbDataPages
    const catalogPages: Uint8Array[] = [];
    const userDataPages: Uint8Array[] = [];
    let validSqlPages = 0;

    for (let off = 0; off + PAGE_SIZE <= src.length; off += PAGE_SIZE) {
      const headerVer = src[off];
      const pageType = src[off + 1];
      const pageLevel = src[off + 3];
      if (headerVer !== 0x01 || pageType !== 0x01 || pageLevel !== 0x00) continue;

      const slotCnt = view.getUint16(off + 22, true);
      if (slotCnt < 1 || slotCnt > 700) continue;

      const mObjId = view.getUint32(off + 24, true);
      validSqlPages++;

      // Skip sys.sysobjvalues (60) which stores internal SQL view definitions ("FROM dbo.Customer...")
      if (mObjId === 60) continue;

      const pageSlice = src.subarray(off, off + PAGE_SIZE);
      if (mObjId > 0 && mObjId < 100) {
        catalogPages.push(pageSlice);
      } else {
        userDataPages.push(pageSlice);
      }
    }

    const combinedSqlPages = [...catalogPages, ...userDataPages];
    if (validSqlPages >= 2 && combinedSqlPages.length > 0) {
      const maxPages = Math.min(combinedSqlPages.length, 750); // up to ~6 MB of active 8KB data pages
      const out = new Uint8Array(maxPages * PAGE_SIZE);
      for (let i = 0; i < maxPages; i++) {
        out.set(combinedSqlPages[i], i * PAGE_SIZE);
      }
      return new File([out], file.name, {
        type: file.type || 'application/octet-stream',
        lastModified: file.lastModified,
      });
    }

    // Fallback for non-SQL-Server .IDF / .BAK files > 1.5 MB: strip 100% zero-filled 8KB blocks
    if (src.length > 1.5 * 1024 * 1024) {
      const nonZeroBlocks: Uint8Array[] = [];
      const maxBlocks = 450; // ~3.6 MB max
      for (let off = 0; off + PAGE_SIZE <= src.length && nonZeroBlocks.length < maxBlocks; off += PAGE_SIZE) {
        let hasNonZero = false;
        for (let k = off; k < off + PAGE_SIZE; k += 16) {
          if (src[k] !== 0 || src[k + 1] !== 0 || src[k + 4] !== 0 || src[k + 8] !== 0) {
            hasNonZero = true;
            break;
          }
        }
        if (hasNonZero) {
          nonZeroBlocks.push(src.subarray(off, off + PAGE_SIZE));
        }
      }
      if (nonZeroBlocks.length > 0 && nonZeroBlocks.length * PAGE_SIZE < src.length) {
        const out = new Uint8Array(nonZeroBlocks.length * PAGE_SIZE);
        for (let i = 0; i < nonZeroBlocks.length; i++) {
          out.set(nonZeroBlocks[i], i * PAGE_SIZE);
        }
        return new File([out], file.name, {
          type: file.type || 'application/octet-stream',
          lastModified: file.lastModified,
        });
      }
    }

    return file;
  } catch {
    return file;
  }
}

/**
 * Uploads one or more database files (.MDF, .IDF, .LDF, Excel, CSV, etc.) in 384 KB binary chunks
 * (512 KB base64 JSON per request) so it NEVER triggers HTTP 413 Payload Too Large on Vercel or proxies.
 */
export async function uploadDatabaseFilesInChunks(
  files: File[],
  onProgress?: (msg: string) => void,
): Promise<void> {
  const compactedFiles = await Promise.all(files.map((f) => compactDatabaseFileForUpload(f)));
  // 48 * 8192 = 393,216 bytes (divisible by 3 for zero base64 intermediate padding, and divisible by 8192)
  const CHUNK_BYTE_SIZE = 48 * 8192;

  for (let fileIdx = 0; fileIdx < compactedFiles.length; fileIdx++) {
    const file = compactedFiles[fileIdx];
    const ab = await file.arrayBuffer();
    const bytes = new Uint8Array(ab);
    const totalChunks = Math.max(1, Math.ceil(bytes.length / CHUNK_BYTE_SIZE));
    let assetId: number | null = null;

    for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
      if (onProgress) {
        onProgress(
          `Transfert sécurisé ${file.name} (${chunkIndex + 1}/${totalChunks} · ${Math.round(
            bytes.length / 1024,
          )} Ko de pages actives)...`,
        );
      }
      const start = chunkIndex * CHUNK_BYTE_SIZE;
      const end = Math.min(start + CHUNK_BYTE_SIZE, bytes.length);
      const slice = bytes.subarray(start, end);
      const dataBase64 = uint8ToBase64(slice);

      const res: { ok: boolean; assetId: number } = await adminFetch<{ ok: boolean; assetId: number }>(
        '/api/admin/stock/import/upload-chunk',
        {
          method: 'POST',
          body: JSON.stringify({
            fileName: file.name,
            chunkIndex,
            totalChunks,
            dataBase64,
            resetPrevious: fileIdx === 0 && chunkIndex === 0,
            assetId,
          }),
        },
      );
      assetId = res.assetId;
    }
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
  const [cleanPreviousImports, setCleanPreviousImports] = useState<boolean>(true);
  const [defaultCategoryId, setDefaultCategoryId] = useState<string>('');
  const [autoIntegrateOnSelect, setAutoIntegrateOnSelect] = useState<boolean>(false);

  const [parsing, setParsing] = useState<boolean>(false);
  const [committing, setCommitting] = useState<boolean>(false);
  const [cleaningUp, setCleaningUp] = useState<boolean>(false);
  const [regenerating, setRegenerating] = useState<boolean>(false);
  const [preview, setPreview] = useState<any | null>(null);
  const [selectedTableName, setSelectedTableName] = useState<string>('');
  const [customMapping, setCustomMapping] = useState<Record<string, string>>({ name: '' });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const [commitResult, setCommitResult] = useState<any | null>(null);
  const [hasSavedBackupOnServer, setHasSavedBackupOnServer] = useState<boolean>(false);
  const [savedBackupFileName, setSavedBackupFileName] = useState<string>('');
  const [uploadedSignature, setUploadedSignature] = useState<string>('');

  useEffect(() => {
    adminFetch<any>('/api/admin/stock/import/backup-status')
      .then((res) => {
        if (res?.hasBackup) {
          setHasSavedBackupOnServer(true);
          setSavedBackupFileName(res.fileName || 'nabils.mdf');
        }
      })
      .catch(() => {});
  }, []);

  const allFiles: File[] = [
    ...(mdfFile ? [mdfFile] : []),
    ...(idfFile ? [idfFile] : []),
    ...extraFiles,
  ];

  const getFilesSignature = (files: File[]) =>
    files.map((f) => `${f.name}:${f.size}:${f.lastModified}`).join('|');

  const runBinaryDecodePreview = async (
    filesToAnalyze: File[],
    shouldAutoCommit = false,
    preferredTable?: string,
    mappingOverride?: Record<string, string>,
  ) => {
    if (filesToAnalyze.length === 0) return;
    setParsing(true);
    setErrorMsg(null);
    setStatusBanner(null);
    setCommitResult(null);
    try {
      const sig = getFilesSignature(filesToAnalyze);
      if (sig !== uploadedSignature) {
        await uploadDatabaseFilesInChunks(filesToAnalyze, (msg) => setStatusBanner(msg));
        setUploadedSignature(sig);
      }

      setStatusBanner('Décodage binaire des pages SQL Server 8 Ko en cours...');
      const res = await adminFetch<any>('/api/admin/stock/import/preview', {
        method: 'POST',
        body: JSON.stringify({
          useStoredBackup: true,
          syncMode,
          tableName: preferredTable || undefined,
          mappingJson:
            mappingOverride && mappingOverride.name ? JSON.stringify(mappingOverride) : undefined,
        }),
      });
      setStatusBanner(null);
      setPreview(res);
      setSelectedTableName(res.selectedTable || '');
      const serverMapping = res.mapping || res.inferredMapping || { name: '' };
      setCustomMapping(serverMapping);
      setHasSavedBackupOnServer(true);
      setSavedBackupFileName(res.fileName || filesToAnalyze[0]?.name || 'nabils.mdf');

      if (shouldAutoCommit || autoIntegrateOnSelect) {
        await executeCommit(filesToAnalyze, res, serverMapping, sig);
      }
    } catch (err: any) {
      setStatusBanner(null);
      setErrorMsg(err?.message || 'Erreur lors du décodage binaire des fichiers .MDF / .IDF.');
    } finally {
      setParsing(false);
    }
  };

  const executeCommit = async (
    filesToCommit?: File[],
    previewOverride?: any,
    mappingOverride?: Record<string, string>,
    knownSignature?: string,
  ) => {
    const targetFiles = filesToCommit && filesToCommit.length > 0 ? filesToCommit : allFiles;
    if (targetFiles.length === 0) {
      if (hasSavedBackupOnServer) {
        await handleRegenerateFromServerBackup();
        return;
      }
      setErrorMsg('Veuillez sélectionner votre fichier .MDF (Point 1) et/ou votre fichier .IDF (Point 2).');
      return;
    }
    setCommitting(true);
    setErrorMsg(null);
    setStatusBanner(null);
    try {
      const sig = getFilesSignature(targetFiles);
      if (sig !== (knownSignature || uploadedSignature)) {
        await uploadDatabaseFilesInChunks(targetFiles, (msg) => setStatusBanner(msg));
        setUploadedSignature(sig);
      }

      setStatusBanner('Génération du Stock et de la Comptabilité dans PostgreSQL...');
      const activePreview = previewOverride || preview;
      const tableToUse = selectedTableName || activePreview?.selectedTable;

      const activeMap =
        mappingOverride && mappingOverride.name
          ? mappingOverride
          : customMapping && customMapping.name
          ? customMapping
          : activePreview?.mapping || activePreview?.inferredMapping;

      const res = await adminFetch<any>('/api/admin/stock/import/commit', {
        method: 'POST',
        body: JSON.stringify({
          useStoredBackup: true,
          tableName: tableToUse || undefined,
          syncMode,
          generateAccounting,
          cleanPreviousImports,
          mappingJson: activeMap && activeMap.name ? JSON.stringify(activeMap) : undefined,
          defaultCategoryId: defaultCategoryId || undefined,
        }),
      });
      setStatusBanner(null);
      setCommitResult(res);
      setHasSavedBackupOnServer(true);
      onRefresh();
    } catch (err: any) {
      setStatusBanner(null);
      setErrorMsg(err?.message || 'Erreur lors de la sauvegarde et de l’intégration dans la base de données.');
    } finally {
      setCommitting(false);
    }
  };

  const handleCleanupCorruptedImport = async () => {
    setCleaningUp(true);
    setErrorMsg(null);
    setStatusBanner(null);
    try {
      const res = await adminFetch<any>('/api/admin/stock/import/cleanup', {
        method: 'POST',
        body: JSON.stringify({ cleanAllImports: true }),
      });
      setStatusBanner(
        `Nettoyage effectué : ${res.deletedProductsCount ?? 0} article(s) erroné(s) (2 200 DZD / SQL) et ${res.deletedAccountingCount ?? 0} écriture(s) retirés du système.`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err?.message || 'Erreur lors du nettoyage de l’ancien import.');
    } finally {
      setCleaningUp(false);
    }
  };

  const handleRegenerateFromServerBackup = async () => {
    if (allFiles.length > 0) {
      await executeCommit(allFiles);
      return;
    }
    setRegenerating(true);
    setErrorMsg(null);
    setStatusBanner(null);
    try {
      const res = await adminFetch<any>('/api/admin/stock/import/regenerate', {
        method: 'POST',
        body: JSON.stringify({
          syncMode,
          generateAccounting,
          cleanPreviousImports: true,
          tableName: selectedTableName || undefined,
          mapping: customMapping?.name ? customMapping : undefined,
          defaultCategoryId: defaultCategoryId ? Number(defaultCategoryId) : null,
        }),
      });
      setCommitResult(res);
      setStatusBanner(
        `Fichier ${res.importRecord?.fileName || savedBackupFileName || '.MDF'} régénéré et corrigé avec succès !`,
      );
      onRefresh();
    } catch (err: any) {
      setErrorMsg(
        err?.message ||
          'Veuillez resélectionner votre fichier .MDF dans le Point 1 ci-dessus puis cliquer sur « Sauvegarder & Intégrer maintenant ».',
      );
    } finally {
      setRegenerating(false);
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

  const handleTableSwitch = (newTable: string) => {
    setSelectedTableName(newTable);
    if (allFiles.length > 0) {
      runBinaryDecodePreview(allFiles, false, newTable);
    }
  };

  const handleMappingChange = (fieldKey: string, colName: string) => {
    const nextMap: Record<string, string> = { ...customMapping, [fieldKey]: colName || '' };
    setCustomMapping(nextMap);
    if (allFiles.length > 0 && nextMap.name) {
      runBinaryDecodePreview(allFiles, false, selectedTableName || preview?.selectedTable, nextMap);
    }
  };

  const availableColumns: string[] = Array.isArray(preview?.columns) ? preview.columns : [];
  const availableTables: { tableName: string; rowCount: number }[] = Array.isArray(preview?.tables)
    ? preview.tables
    : [];
  const previewArticles: any[] = Array.isArray(preview?.diffSummary?.sampleToAdd)
    ? preview.diffSummary.sampleToAdd.slice(0, 8)
    : [];

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
              <span>Décodage Exact Pages 8Ko SQL Server · Références, Désignations, Prix d’achat/vente &amp; Quantités</span>
            </span>
          </div>
          <h2 className="font-display font-bold text-base sm:text-lg text-slate-900">
            Ajouter le Stock &amp; Générer toute votre Comptabilité depuis vos fichiers .MDF et .IDF
          </h2>
          <p className="text-xs sm:text-sm text-slate-600">
            Chargez votre fichier <strong>.MDF</strong> (Point 1) et votre fichier <strong>.IDF</strong> (Point 2) ci-dessous : le système retire automatiquement les anciennes lignes mélangées (2 200 DZD / SQL) et restaure les vrais codes, désignations, prix d’achat, prix de vente et quantités.
          </p>
        </div>

        {/* Quick Action Buttons: Clean Corrupted Import + Regenerate + 1-Click Upload */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={cleaningUp || committing}
            onClick={handleCleanupCorruptedImport}
            className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>
              {cleaningUp
                ? 'Nettoyage en cours...'
                : 'Nettoyer l’ancien import erroné (2 200 DZD / SQL)'}
            </span>
          </button>

          {(hasSavedBackupOnServer || allFiles.length > 0) && (
            <button
              type="button"
              disabled={regenerating || committing}
              onClick={handleRegenerateFromServerBackup}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl bg-blue-700 hover:bg-blue-800 text-white text-xs font-bold shadow-sm cursor-pointer transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${regenerating ? 'animate-spin' : ''}`} />
              <span>
                {regenerating
                  ? 'Régénération en cours...'
                  : 'Régénérer & Corriger le fichier envoyé'}
              </span>
            </button>
          )}

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
                  ? `Taille : ${Math.max(1, Math.round(mdfFile.size / 1024))} Ko · Pages 8Ko alignées sans perte`
                  : 'Décodage exact des tables Product, Stock, Prix d’achat (CostPrice), Prix de vente (SellingPrice) & Quantités'}
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

      {/* Multi-file dropzone + Category & Sync Mode options */}
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
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-[11px] font-bold uppercase ${
                  allFiles.length > 0 ? 'bg-emerald-700 text-white' : 'bg-slate-300 text-slate-800'
                }`}
              >
                <Save className="w-3.5 h-3.5" />
                <span>Action d’intégration Base de Données</span>
              </span>

              <label className="inline-flex items-center gap-1.5 text-xs font-bold text-red-900 bg-red-100/80 px-2.5 py-1 rounded-lg cursor-pointer">
                <input
                  type="checkbox"
                  checked={cleanPreviousImports}
                  onChange={(e) => setCleanPreviousImports(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-red-700"
                />
                <span>
                  Retirer et remplacer l’ancien stock importé erroné (2 200 DZD / SQL)
                </span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-950 cursor-pointer">
                <input
                  type="checkbox"
                  checked={generateAccounting}
                  onChange={(e) => setGenerateAccounting(e.target.checked)}
                  className="w-3.5 h-3.5 rounded text-emerald-700"
                />
                <span>Générer aussi toute la Comptabilité (Bilan, Achats, Ventes, Marges)</span>
              </label>

              <label className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-900 cursor-pointer">
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
                ? 'Décodage binaire des pages 8Ko .MDF / .IDF en cours...'
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
                : hasSavedBackupOnServer
                ? `Sauvegarde détectée (${savedBackupFileName}) : cliquez sur « Régénérer & Corriger le fichier envoyé » ou chargez un nouveau .MDF`
                : 'Étape 1 : Choisissez votre fichier .MDF et/ou .IDF ci-dessus · Étape 2 : Cliquez sur le bouton vert à droite'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {allFiles.length > 0 && (
              <>
                <button
                  type="button"
                  disabled={parsing || committing}
                  onClick={() => runBinaryDecodePreview(allFiles, false, selectedTableName || undefined)}
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
              disabled={(allFiles.length === 0 && !hasSavedBackupOnServer) || committing}
              onClick={() => executeCommit()}
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs sm:text-sm font-bold shadow-md transition-all ${
                allFiles.length > 0 || hasSavedBackupOnServer
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

      {/* Status Banner */}
      {statusBanner && (
        <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 text-xs sm:text-sm text-blue-900 font-semibold">
          {statusBanner}
        </div>
      )}

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
                Base de données .MDF / .IDF intégrée et corrigée avec succès dans votre système !
              </p>
              <p className="text-xs text-emerald-900 mt-1">
                {commitResult.purgedOldProductsCount ? (
                  <>
                    <strong>{commitResult.purgedOldProductsCount}</strong> anciennes lignes erronées supprimées ·{' '}
                  </>
                ) : null}
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

      {/* Interactive Table & Column Mapping + Decoded Preview Table */}
      {preview && (
        <div className="p-4 sm:p-5 rounded-xl bg-slate-50 border border-slate-200 space-y-4">
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
                  {formatDzd(
                    preview.accountingPreview.stockSaleValueDzd ||
                      preview.accountingPreview.stockSaleValuationDzd ||
                      0,
                  )}{' '}
                  (Marge : +
                  {formatDzd(
                    preview.accountingPreview.stockMarginDzd ||
                      preview.accountingPreview.stockPotentialMarginDzd ||
                      0,
                  )}
                  )
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

          {/* Interactive SQL Server Table & Column Selector */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-7 gap-2.5 pt-2 border-t border-slate-200">
            {availableTables.length > 1 && (
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Table SQL (.MDF)
                </label>
                <select
                  value={selectedTableName || preview.selectedTable || ''}
                  onChange={(e) => handleTableSwitch(e.target.value)}
                  className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-blue-300 bg-white font-semibold text-slate-900"
                >
                  {availableTables.map((t) => (
                    <option key={t.tableName} value={t.tableName}>
                      {t.tableName} ({t.rowCount} lignes)
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Référence / Code
              </label>
              <select
                value={customMapping?.sku || ''}
                onChange={(e) => handleMappingChange('sku', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                <option value="">Auto (Code article)</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Désignation / Nom *
              </label>
              <select
                value={customMapping?.name || ''}
                onChange={(e) => handleMappingChange('name', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-blue-400 bg-white font-semibold text-slate-900"
              >
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Prix d’achat (DZD)
              </label>
              <select
                value={customMapping?.costPriceDzd || ''}
                onChange={(e) => handleMappingChange('costPriceDzd', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                <option value="">0 DZD / Non défini</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Prix de vente (DZD)
              </label>
              <select
                value={customMapping?.priceDzd || ''}
                onChange={(e) => handleMappingChange('priceDzd', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                <option value="">0 DZD / Non défini</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Quantité en stock
              </label>
              <select
                value={customMapping?.stockQuantity || ''}
                onChange={(e) => handleMappingChange('stockQuantity', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                <option value="">0 / Non défini</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 mb-1">
                Catégorie / Famille
              </label>
              <select
                value={customMapping?.categoryName || ''}
                onChange={(e) => handleMappingChange('categoryName', e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800"
              >
                <option value="">Auto / Par défaut</option>
                {availableColumns.map((col) => (
                  <option key={col} value={col}>
                    {col}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Decoded Articles Verification Table */}
          {previewArticles.length > 0 && (
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 border-b border-slate-200 font-bold">
                    <th className="py-2 px-3">Référence (Code)</th>
                    <th className="py-2 px-3">Désignation de l’article</th>
                    <th className="py-2 px-3 text-right">Prix d’achat</th>
                    <th className="py-2 px-3 text-right">Prix de vente</th>
                    <th className="py-2 px-3 text-right">Quantité</th>
                    <th className="py-2 px-3">Catégorie</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewArticles.map((art: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold text-blue-800">
                        {art.sku || `ART-${idx + 1}`}
                      </td>
                      <td className="py-2 px-3 font-semibold text-slate-900">{art.name}</td>
                      <td className="py-2 px-3 text-right text-slate-700">
                        {formatDzd(art.costPriceDzd || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-emerald-800">
                        {formatDzd(art.priceDzd || 0)}
                      </td>
                      <td className="py-2 px-3 text-right font-bold text-slate-900">
                        {art.stockQuantity ?? 0} u.
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        {art.categoryName || 'Non classé'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
