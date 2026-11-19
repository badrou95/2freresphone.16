// Heavy parsers (xlsx, fast-xml-parser, sql.js) are lazy-loaded on demand during stock import.

export type SupportedImportFormat = 'xlsx' | 'xls' | 'csv' | 'tsv' | 'json' | 'xml' | 'sqlite' | 'sql';

export type StockSyncMode = 'add_only' | 'add_and_update_stock' | 'full_sync';

export interface ColumnMapping {
  name: string;
  sku?: string;
  barcode?: string;
  priceDzd?: string;
  costPriceDzd?: string;
  stockQuantity?: string;
  categoryName?: string;
  brand?: string;
  description?: string;
  lowStockThreshold?: string;
  productType?: string;
}

export interface ParsedSourceTable {
  tableName: string;
  columns: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedImportFile {
  format: SupportedImportFormat;
  tables: ParsedSourceTable[];
  selectedTable: string;
  columns: string[];
  totalRows: number;
  previewRows: Record<string, unknown>[];
  suggestedMapping: ColumnMapping;
}

export interface NormalizedImportProduct {
  rowIndex: number;
  sku: string;
  barcode: string | null;
  externalRef: string;
  name: string;
  priceDzd: number;
  costPriceDzd: number;
  stockQuantity: number;
  categoryName: string | null;
  brand: string | null;
  description: string;
  lowStockThreshold: number | null;
  productType: 'physical' | 'digital';
}

export interface ExistingProductSnapshot {
  id: number;
  sku: string;
  barcode: string | null;
  externalRef: string | null;
  name: string;
  priceDzd: number;
  costPriceDzd: number;
  stockQuantity: number;
}

export interface DifferentialSyncPlan {
  toAdd: NormalizedImportProduct[];
  toUpdate: {
    existing: ExistingProductSnapshot;
    incoming: NormalizedImportProduct;
    stockDelta: number;
  }[];
  skipped: { rowIndex: number; name: string; sku: string; reason: string }[];
  errors: { rowIndex: number; reason: string }[];
}

export function detectFormatFromFilename(filename: string): SupportedImportFormat {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.sqlite') || lower.endsWith('.sqlite3') || lower.endsWith('.db')) return 'sqlite';
  if (lower.endsWith('.sql')) return 'sql';
  throw new Error(
    'Format non reconnu. Formats pris en charge : .xlsx, .xls, .csv, .tsv, .txt, .json, .xml, .db, .sqlite, .sqlite3, .sql',
  );
}

function normalizeHeader(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function scoreHeaderMatch(header: string, aliases: string[]): number {
  const norm = normalizeHeader(header);
  if (!norm) return 0;
  for (const alias of aliases) {
    if (norm === alias) return 100;
    if (norm.includes(alias) || alias.includes(norm)) return 65;
  }
  return 0;
}

export function suggestColumnMapping(columns: string[]): ColumnMapping {
  const pick = (aliases: string[]): string | undefined => {
    let bestCol: string | undefined;
    let bestScore = 0;
    for (const col of columns) {
      const score = scoreHeaderMatch(col, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    return bestScore >= 60 ? bestCol : undefined;
  };

  const name =
    pick([
      'designation',
      'libelle',
      'nom_article',
      'nom_produit',
      'article',
      'produit',
      'product_name',
      'name',
      'nom',
      'titre',
      'title',
      'item',
      'intitule',
    ]) || columns[0] || '';

  return {
    name,
    sku: pick(['sku', 'ref', 'reference', 'code_article', 'code_produit', 'code', 'id_article', 'code_interne']),
    barcode: pick(['barcode', 'code_barre', 'codebarre', 'ean', 'ean13', 'upc', 'gtin', 'cb']),
    priceDzd: pick([
      'prix_vente',
      'pv_ttc',
      'pv',
      'prix_ttc',
      'prix',
      'price',
      'price_dzd',
      'tarif',
      'vente',
      'montant',
      'selling_price',
    ]),
    costPriceDzd: pick(['prix_achat', 'pa', 'pa_ht', 'cout', 'cost', 'cost_price', 'achat', 'pamp']),
    stockQuantity: pick([
      'qte',
      'quantite',
      'qte_stock',
      'stock',
      'stock_actuel',
      'quantity',
      'qty',
      'disponible',
      'en_stock',
      'solde',
    ]),
    categoryName: pick(['categorie', 'category', 'famille', 'sous_famille', 'rayon', 'groupe', 'type_article']),
    brand: pick(['marque', 'brand', 'fabricant']),
    description: pick(['description', 'details', 'observation', 'remarque', 'notes']),
    lowStockThreshold: pick(['seuil', 'seuil_alerte', 'stock_min', 'min_stock', 'low_stock_threshold', 'alerte']),
    productType: pick(['product_type', 'nature', 'type']),
  };
}

function decodeBufferText(buffer: Buffer): string {
  const utf8 = buffer.toString('utf8');
  if (utf8.includes('\uFFFD')) {
    return buffer.toString('latin1');
  }
  return utf8.replace(/^\uFEFF/, '');
}

function parseDelimitedText(text: string, forcedDelimiter?: string): ParsedSourceTable {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { tableName: 'Feuille1', columns: [], rows: [] };
  }

  const firstLine = lines[0];
  const candidates = forcedDelimiter ? [forcedDelimiter] : [';', ',', '\t', '|'];
  let delimiter = candidates[0];
  let bestCount = -1;
  for (const sep of candidates) {
    const count = firstLine.split(sep).length - 1;
    if (count > bestCount) {
      bestCount = count;
      delimiter = sep;
    }
  }

  const parseLine = (line: string): string[] => {
    const out: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (ch === delimiter && !inQuotes) {
        out.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };

  const headers = parseLine(lines[0]).map((h, idx) => h || `col_${idx + 1}`);
  const rows: Record<string, unknown>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => v === '')) continue;
    const obj: Record<string, unknown> = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? '';
    });
    rows.push(obj);
  }
  return { tableName: 'Import CSV', columns: headers, rows };
}

function extractBestArrayFromObject(obj: unknown, pathName = 'data'): ParsedSourceTable[] {
  const tables: ParsedSourceTable[] = [];
  if (Array.isArray(obj)) {
    const objects = obj.filter((item) => item && typeof item === 'object' && !Array.isArray(item)) as Record<
      string,
      unknown
    >[];
    if (objects.length > 0) {
      const colSet = new Set<string>();
      for (const item of objects.slice(0, 50)) {
        Object.keys(item).forEach((k) => colSet.add(k));
      }
      tables.push({
        tableName: pathName,
        columns: Array.from(colSet),
        rows: objects,
      });
    }
    return tables;
  }

  if (obj && typeof obj === 'object') {
    const record = obj as Record<string, unknown>;
    const entries = Object.entries(record);
    for (const [key, val] of entries) {
      tables.push(...extractBestArrayFromObject(val, key));
    }
    if (tables.length === 0 && entries.length > 0) {
      const allPrimitives = entries.every(
        ([, v]) => v === null || v === undefined || typeof v !== 'object',
      );
      if (allPrimitives) {
        tables.push({
          tableName: pathName,
          columns: entries.map(([k]) => k),
          rows: [record],
        });
      }
    }
  }
  return tables;
}

function splitSqlValues(tupleContent: string): string[] {
  const values: string[] = [];
  let current = '';
  let inSingle = false;
  let inDouble = false;
  for (let i = 0; i < tupleContent.length; i++) {
    const ch = tupleContent[i];
    if (ch === "'" && !inDouble) {
      if (inSingle && tupleContent[i + 1] === "'") {
        current += "'";
        i++;
      } else {
        inSingle = !inSingle;
      }
    } else if (ch === '"' && !inSingle) {
      inDouble = !inDouble;
    } else if (ch === ',' && !inSingle && !inDouble) {
      values.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values.map((v) => (v.toUpperCase() === 'NULL' ? '' : v));
}

function parseSqlDump(sqlText: string): ParsedSourceTable[] {
  const tableMap = new Map<string, { columns: string[]; rows: Record<string, unknown>[] }>();
  const insertRegex = /INSERT\s+(?:OR\s+\w+\s+|IGNORE\s+)?INTO\s+[`"\[]?([\w.]+)[`"\]]?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]*?);/gi;

  let match: RegExpExecArray | null;
  while ((match = insertRegex.exec(sqlText)) !== null) {
    const rawTable = match[1].split('.').pop() || match[1];
    const colList = match[2]
      ? match[2].split(',').map((c) => c.trim().replace(/^[`"\[]|[`"\]]$/g, ''))
      : [];
    const valuesBlock = match[3];

    // Extract each (...) tuple
    const tuples: string[] = [];
    let depth = 0;
    let inSingle = false;
    let start = -1;
    for (let i = 0; i < valuesBlock.length; i++) {
      const ch = valuesBlock[i];
      if (ch === "'") {
        if (inSingle && valuesBlock[i + 1] === "'") {
          i++;
          continue;
        }
        inSingle = !inSingle;
      } else if (!inSingle && ch === '(') {
        if (depth === 0) start = i + 1;
        depth++;
      } else if (!inSingle && ch === ')') {
        depth--;
        if (depth === 0 && start >= 0) {
          tuples.push(valuesBlock.slice(start, i));
          start = -1;
        }
      }
    }

    for (const tuple of tuples) {
      const parsedVals = splitSqlValues(tuple);
      const cols =
        colList.length > 0 ? colList : parsedVals.map((_, idx) => `col_${idx + 1}`);
      if (!tableMap.has(rawTable)) {
        tableMap.set(rawTable, { columns: cols, rows: [] });
      }
      const entry = tableMap.get(rawTable)!;
      const rowObj: Record<string, unknown> = {};
      cols.forEach((c, idx) => {
        rowObj[c] = parsedVals[idx] ?? '';
      });
      entry.rows.push(rowObj);
    }
  }

  return Array.from(tableMap.entries()).map(([tableName, data]) => ({
    tableName,
    columns: data.columns,
    rows: data.rows,
  }));
}

async function parseSqliteBuffer(buffer: Buffer): Promise<ParsedSourceTable[]> {
  const { default: initSqlJs } = await import('sql.js');
  const SQL = await initSqlJs();
  const db = new SQL.Database(new Uint8Array(buffer));
  try {
    const tableResult = db.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name",
    );
    const tableNames =
      tableResult[0]?.values.map((row: unknown[]) => String(row[0])) || [];

    const tables: ParsedSourceTable[] = [];
    for (const tName of tableNames) {
      const safeName = tName.replace(/"/g, '""');
      const res = db.exec(`SELECT * FROM "${safeName}" LIMIT 5000`);
      if (res.length === 0) continue;
      const cols = res[0].columns;
      const rows = res[0].values.map((vals: unknown[]) => {
        const obj: Record<string, unknown> = {};
        cols.forEach((col: string, i: number) => {
          obj[col] = vals[i] ?? '';
        });
        return obj;
      });
      if (rows.length > 0) {
        tables.push({ tableName: tName, columns: cols, rows });
      }
    }
    return tables;
  } finally {
    db.close();
  }
}

export async function parseStockDatabaseBuffer(
  buffer: Buffer,
  filename: string,
  preferredTable?: string,
): Promise<ParsedImportFile> {
  const format = detectFormatFromFilename(filename);
  let tables: ParsedSourceTable[] = [];

  if (format === 'xlsx' || format === 'xls') {
    const XLSX = await import('xlsx');
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
      if (rows.length > 0) {
        tables.push({
          tableName: sheetName,
          columns: Object.keys(rows[0]),
          rows,
        });
      }
    }
  } else if (format === 'csv' || format === 'tsv') {
    const text = decodeBufferText(buffer);
    const parsed = parseDelimitedText(text, format === 'tsv' ? '\t' : undefined);
    if (parsed.rows.length > 0) tables.push(parsed);
  } else if (format === 'json') {
    const text = decodeBufferText(buffer);
    const json = JSON.parse(text);
    tables = extractBestArrayFromObject(json, 'articles');
  } else if (format === 'xml') {
    const text = decodeBufferText(buffer);
    const { XMLParser } = await import('fast-xml-parser');
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const parsed = parser.parse(text);
    tables = extractBestArrayFromObject(parsed, 'articles');
  } else if (format === 'sqlite') {
    tables = await parseSqliteBuffer(buffer);
  } else if (format === 'sql') {
    const text = decodeBufferText(buffer);
    tables = parseSqlDump(text);
  }

  if (tables.length === 0) {
    throw new Error('Aucune ligne exploitable trouvée dans ce fichier.');
  }

  // Pick best table if not specified (prefer table name matching product/article/stock or largest row count)
  let selected = tables.find((t) => t.tableName === preferredTable);
  if (!selected) {
    selected = [...tables].sort((a, b) => {
      const aMatch = /prod|articl|stock|item|invent/i.test(a.tableName) ? 1 : 0;
      const bMatch = /prod|articl|stock|item|invent/i.test(b.tableName) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.rows.length - a.rows.length;
    })[0];
  }

  return {
    format,
    tables,
    selectedTable: selected.tableName,
    columns: selected.columns,
    totalRows: selected.rows.length,
    previewRows: selected.rows.slice(0, 12),
    suggestedMapping: suggestColumnMapping(selected.columns),
  };
}

function parseDzdNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = String(value ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/\s+/g, '');
  if (!raw) return fallback;
  // Handle French decimals like "2500,00" or thousand separators like "2.500"
  const normalized =
    raw.includes(',') && raw.includes('.')
      ? raw.replace(/\./g, '').replace(',', '.')
      : raw.replace(',', '.');
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}

function normalizeMatchKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');
}

export function buildDifferentialSyncPlan(
  rows: Record<string, unknown>[],
  mapping: ColumnMapping,
  existingProducts: ExistingProductSnapshot[],
  syncMode: StockSyncMode = 'add_only',
): DifferentialSyncPlan {
  const bySku = new Map<string, ExistingProductSnapshot>();
  const byBarcode = new Map<string, ExistingProductSnapshot>();
  const byExternalRef = new Map<string, ExistingProductSnapshot>();
  const byName = new Map<string, ExistingProductSnapshot>();

  for (const prod of existingProducts) {
    if (prod.sku) bySku.set(normalizeMatchKey(prod.sku), prod);
    if (prod.barcode) byBarcode.set(normalizeMatchKey(prod.barcode), prod);
    if (prod.externalRef) byExternalRef.set(normalizeMatchKey(prod.externalRef), prod);
    if (prod.name) byName.set(normalizeMatchKey(prod.name), prod);
  }

  const toAdd: NormalizedImportProduct[] = [];
  const toUpdate: DifferentialSyncPlan['toUpdate'] = [];
  const skipped: DifferentialSyncPlan['skipped'] = [];
  const errors: DifferentialSyncPlan['errors'] = [];
  const seenInBatch = new Set<string>();

  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    const rawName = String(row[mapping.name] ?? '').trim();
    if (!rawName) {
      errors.push({ rowIndex, reason: 'Nom d’article manquant' });
      return;
    }

    const rawSku = mapping.sku ? String(row[mapping.sku] ?? '').trim() : '';
    const rawBarcode = mapping.barcode ? String(row[mapping.barcode] ?? '').trim() : '';
    const normalizedNameKey = normalizeMatchKey(rawName);
    const derivedSku =
      rawSku ||
      rawBarcode ||
      `IMP-${normalizedNameKey.slice(0, 10).toUpperCase() || 'ART'}-${String(rowIndex).padStart(3, '0')}`;

    const dedupKey = normalizeMatchKey(rawSku || rawBarcode || rawName);
    if (seenInBatch.has(dedupKey)) {
      skipped.push({
        rowIndex,
        name: rawName,
        sku: derivedSku,
        reason: 'Doublon dans le fichier importé',
      });
      return;
    }
    seenInBatch.add(dedupKey);

    const rawType = mapping.productType ? String(row[mapping.productType] ?? '').toLowerCase() : '';
    const productType: 'physical' | 'digital' =
      rawType.includes('num') || rawType.includes('digit') || rawType.includes('abonn')
        ? 'digital'
        : 'physical';

    const rawThreshold = mapping.lowStockThreshold ? String(row[mapping.lowStockThreshold] ?? '').trim() : '';
    const parsedThreshold = rawThreshold !== '' ? parseDzdNumber(rawThreshold, 0) : null;

    const incoming: NormalizedImportProduct = {
      rowIndex,
      sku: derivedSku,
      barcode: rawBarcode || null,
      externalRef: rawSku || rawBarcode || normalizedNameKey,
      name: rawName,
      priceDzd: mapping.priceDzd ? parseDzdNumber(row[mapping.priceDzd], 0) : 0,
      costPriceDzd: mapping.costPriceDzd ? parseDzdNumber(row[mapping.costPriceDzd], 0) : 0,
      stockQuantity: mapping.stockQuantity ? parseDzdNumber(row[mapping.stockQuantity], 0) : 0,
      categoryName: mapping.categoryName ? String(row[mapping.categoryName] ?? '').trim() || null : null,
      brand: mapping.brand ? String(row[mapping.brand] ?? '').trim() || null : null,
      description: mapping.description ? String(row[mapping.description] ?? '').trim() : '',
      lowStockThreshold: parsedThreshold,
      productType,
    };

    const matched =
      (rawSku && bySku.get(normalizeMatchKey(rawSku))) ||
      (rawBarcode && byBarcode.get(normalizeMatchKey(rawBarcode))) ||
      (rawSku && byExternalRef.get(normalizeMatchKey(rawSku))) ||
      byName.get(normalizedNameKey);

    if (!matched) {
      toAdd.push(incoming);
      return;
    }

    if (syncMode === 'add_only') {
      skipped.push({
        rowIndex,
        name: rawName,
        sku: matched.sku,
        reason: 'Déjà présent en stock (ignoré en mode ajouts uniquement)',
      });
      return;
    }

    toUpdate.push({
      existing: matched,
      incoming,
      stockDelta: incoming.stockQuantity - matched.stockQuantity,
    });
  });

  return { toAdd, toUpdate, skipped, errors };
}
