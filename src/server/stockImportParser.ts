// Heavy parsers (xlsx, fast-xml-parser, sql.js) are lazy-loaded on demand during stock & accounting import.

export type SupportedImportFormat =
  | 'mdf'
  | 'idf'
  | 'mdf_idf'
  | 'dbf'
  | 'bak'
  | 'xlsx'
  | 'xls'
  | 'csv'
  | 'tsv'
  | 'json'
  | 'xml'
  | 'sqlite'
  | 'sql';

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
  tableRole?: 'stock' | 'accounting' | 'mixed';
}

export interface NormalizedAccountingEntry {
  reference: string;
  entryType: 'sale' | 'purchase' | 'stock_valuation' | 'expense' | 'adjustment';
  category: string;
  label: string;
  partnerName: string;
  amountDzd: number;
  costDzd: number;
  marginDzd: number;
  paymentMethod: string;
  entryDate: string;
  notes: string;
}

export interface ParsedImportFile {
  format: SupportedImportFormat;
  tables: ParsedSourceTable[];
  selectedTable: string;
  columns: string[];
  totalRows: number;
  previewRows: Record<string, unknown>[];
  suggestedMapping: ColumnMapping;
  detectedAccountingEntries: NormalizedAccountingEntry[];
  companionFiles: string[];
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
  const lower = filename.toLowerCase().trim();
  if (lower.endsWith('.mdf') || lower.endsWith('.ndf')) return 'mdf';
  if (lower.endsWith('.idf') || lower.endsWith('.ldf') || lower.endsWith('.idx') || lower.endsWith('.ndx')) return 'idf';
  if (lower.endsWith('.dbf') || lower.endsWith('.fic')) return 'dbf';
  if (lower.endsWith('.bak') || lower.endsWith('.dat')) return 'bak';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  if (lower.endsWith('.xls')) return 'xls';
  if (lower.endsWith('.tsv')) return 'tsv';
  if (lower.endsWith('.csv') || lower.endsWith('.txt')) return 'csv';
  if (lower.endsWith('.json')) return 'json';
  if (lower.endsWith('.xml')) return 'xml';
  if (lower.endsWith('.sqlite') || lower.endsWith('.sqlite3') || lower.endsWith('.db')) return 'sqlite';
  if (lower.endsWith('.sql')) return 'sql';
  throw new Error(
    'Format non reconnu. Formats pris en charge : .mdf, .idf, .ldf, .dbf, .bak, .xlsx, .xls, .csv, .tsv, .txt, .json, .xml, .db, .sqlite, .sqlite3, .sql',
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

function parseDelimitedText(text: string, forcedDelimiter?: string, tableName = 'Import CSV'): ParsedSourceTable {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { tableName, columns: [], rows: [] };
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
  return { tableName, columns: headers, rows };
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

/**
 * Parses dBase / FoxPro / Clipper binary table (.dbf or renamed .mdf/.idf)
 */
function tryParseDbfBuffer(buffer: Buffer, filename: string): ParsedSourceTable | null {
  if (buffer.length < 68) return null;
  const version = buffer[0];
  if (![0x02, 0x03, 0x30, 0x31, 0x32, 0x43, 0x83, 0x8b, 0xcb, 0xf5, 0xfb].includes(version)) {
    return null;
  }
  const numRecords = buffer.readUInt32LE(4);
  const headerLen = buffer.readUInt16LE(8);
  const recordLen = buffer.readUInt16LE(10);
  if (headerLen < 64 || recordLen < 2 || headerLen > buffer.length || numRecords > 500000) {
    return null;
  }

  const fields: { name: string; type: string; length: number }[] = [];
  let offset = 32;
  while (offset + 32 <= headerLen && buffer[offset] !== 0x0d) {
    const rawName = buffer
      .subarray(offset, offset + 11)
      .toString('latin1')
      .replace(/\0[\s\S]*$/, '')
      .trim();
    const fieldType = String.fromCharCode(buffer[offset + 11]);
    const fieldLen = buffer[offset + 16];
    if (!rawName || !/^[A-Za-z0-9_]+$/.test(rawName) || fieldLen === 0) {
      return null;
    }
    fields.push({ name: rawName, type: fieldType, length: fieldLen });
    offset += 32;
  }

  if (fields.length === 0) return null;
  const rows: Record<string, unknown>[] = [];
  let recOffset = headerLen;
  const maxRows = Math.min(numRecords, 10000);
  for (let r = 0; r < maxRows && recOffset + recordLen <= buffer.length; r++) {
    const deletedFlag = buffer[recOffset];
    if (deletedFlag !== 0x2a) {
      let fPos = recOffset + 1;
      const rowObj: Record<string, unknown> = {};
      for (const f of fields) {
        const val = buffer
          .subarray(fPos, fPos + f.length)
          .toString('latin1')
          .replace(/\0/g, '')
          .trim();
        rowObj[f.name] = val;
        fPos += f.length;
      }
      if (Object.values(rowObj).some((v) => String(v).length > 0)) {
        rows.push(rowObj);
      }
    }
    recOffset += recordLen;
  }

  if (rows.length === 0) return null;
  return {
    tableName: filename.replace(/\.[^.]+$/, '') || 'Table DBF',
    columns: fields.map((f) => f.name),
    rows,
  };
}

/**
 * Extracts structured UTF-16LE and UTF-8/Latin1 strings from SQL Server .MDF (8KB pages)
 * and companion .IDF (Index / Inventory Data File) binary database files.
 */
function extractTokensFromMdfIdfBuffer(buffer: Buffer): string[] {
  const tokens: string[] = [];

  // 1. Scan UTF-16LE strings (SQL Server NVARCHAR / NCHAR in 8KB pages & WinDev Unicode strings)
  let currentUtf16 = '';
  for (let i = 0; i + 1 < buffer.length; i += 2) {
    const lo = buffer[i];
    const hi = buffer[i + 1];
    // Printable Latin / French accented / Arabic / ASCII in UTF-16LE
    const isAsciiPrintable = hi === 0x00 && lo >= 0x20 && lo <= 0x7e;
    const isLatin1Accent = hi === 0x00 && lo >= 0xc0 && lo <= 0xff;
    if (isAsciiPrintable || isLatin1Accent) {
      currentUtf16 += String.fromCharCode((hi << 8) | lo);
    } else {
      if (currentUtf16.trim().length >= 3) {
        tokens.push(currentUtf16.trim());
      }
      currentUtf16 = '';
    }
  }
  if (currentUtf16.trim().length >= 3) {
    tokens.push(currentUtf16.trim());
  }

  // 2. Scan UTF-8 / Windows-1252 (Latin1) printable strings (SQL Server VARCHAR / CHAR & POS text blocks)
  let currentAscii = '';
  for (let i = 0; i < buffer.length; i++) {
    const b = buffer[i];
    const isPrintable = (b >= 0x20 && b <= 0x7e) || (b >= 0xc0 && b <= 0xff) || b === 0x09;
    if (isPrintable) {
      currentAscii += String.fromCharCode(b);
    } else {
      if (currentAscii.trim().length >= 3) {
        tokens.push(currentAscii.trim());
      }
      currentAscii = '';
    }
  }
  if (currentAscii.trim().length >= 3) {
    tokens.push(currentAscii.trim());
  }

  return tokens;
}

const SYSTEM_NOISE_PATTERNS =
  /^(master|model|msdb|tempdb|sys\.|sysobjects|syscolumns|sysindexes|dbo\.|PRIMARY|CLUSTERED|NONCLUSTERED|IDENTITY|CONSTRAINT|FOREIGN|REFERENCES|CHECK|DEFAULT|CREATE\s+TABLE|ALTER\s+TABLE|SELECT\s+|SQL\s+Server|Microsoft|Windows|UTF-8|ISO-|http:\/\/|https:\/\/|xml\s+version)/i;

/**
 * Reconstructs Stock / Articles rows AND Accounting / Compta rows from raw .MDF / .IDF binary buffers
 */
function parseBinaryMdfIdfBuffers(
  files: { buffer: Buffer; originalname: string }[],
): ParsedSourceTable[] {
  const tables: ParsedSourceTable[] = [];

  // First check if any file actually contains delimited lines, JSON, XML, or SQL inside its text
  for (const file of files) {
    const text = decodeBufferText(file.buffer);
    if (/INSERT\s+INTO\s+/i.test(text)) {
      const sqlTables = parseSqlDump(text);
      if (sqlTables.length > 0) {
        tables.push(...sqlTables);
        continue;
      }
    }

    // Check if the file contains multiple delimited CSV/TSV lines (e.g. exported .mdf/.idf text data)
    const printableLines = text
      .split(/\r?\n/)
      .map((l) => l.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, ' ').trim())
      .filter((l) => l.length >= 5 && (l.includes(';') || l.includes('\t') || l.includes('|') || (l.split(',').length >= 3 && /[A-Za-z]{3,}/.test(l))));

    if (printableLines.length >= 2) {
      const parsedTable = parseDelimitedText(
        printableLines.join('\n'),
        undefined,
        `Table ${file.originalname}`,
      );
      if (parsedTable.rows.length > 0 && parsedTable.columns.length >= 2) {
        tables.push(parsedTable);
      }
    }
  }

  if (tables.length > 0) {
    return tables;
  }

  // Deep Binary Extraction across all uploaded .mdf + .idf files
  const allTokens: string[] = [];
  for (const file of files) {
    const fileTokens = extractTokensFromMdfIdfBuffer(file.buffer);
    allTokens.push(...fileTokens);
  }

  // Clean and filter out noise tokens
  const cleanTokens: string[] = [];
  const seenConsecutive = new Set<string>();
  for (const raw of allTokens) {
    const t = raw.replace(/\s+/g, ' ').trim();
    if (t.length < 2 || t.length > 180) continue;
    if (SYSTEM_NOISE_PATTERNS.test(t)) continue;
    // Must contain at least 2 alphanumeric chars
    if (!/[A-Za-z0-9]{2,}/.test(t)) continue;
    // Skip pure punctuation / repeated gibberish
    const alnumCount = (t.match(/[A-Za-z0-9À-ÿ]/g) || []).length;
    if (alnumCount / t.length < 0.55) continue;
    cleanTokens.push(t);
  }

  const stockRows: Record<string, unknown>[] = [];
  const accountingRows: Record<string, unknown>[] = [];

  // Look for delimited records or group sequential tokens into Stock & Accounting records
  const ACCOUNTING_KEYWORDS =
    /\b(facture|vente|encaissement|caisse|achat|fournisseur|charge|depense|loyer|salaire|reglement|bon\s+de|versement|avoir|recette|bilan|compta)\b/i;
  const CATEGORY_KEYWORDS =
    /\b(accessoire|cable|chargeur|ecouteur|casque|coque|protection|incassable|batterie|powerbank|manette|gaming|console|ps4|ps5|xbox|abonnement|iptv|netflix|spotify|telephone|smartphone|afficheur|connecteur|piece|reparation|support| Montre|smartwatch|airpods|earbuds|speaker|baffle)\b/i;
  const BRAND_KEYWORDS =
    /\b(apple|iphone|samsung|xiaomi|redmi|oppo|realme|huawei|honor|anker|baseus|joyroom|hoco|oraimo|sony|jbl|logitech|razer|nintendo)\b/i;

  let idx = 0;
  let generatedSkuCounter = 1;
  let generatedAccCounter = 1;

  while (idx < cleanTokens.length) {
    const token = cleanTokens[idx];

    // Case A: Token itself is a multi-field line (e.g. separated by ; | \t)
    if ((token.includes(';') || token.includes('|') || token.includes('\t')) && token.split(/[;|\t]/).length >= 3) {
      const parts = token.split(/[;|\t]/).map((s) => s.trim()).filter(Boolean);
      const namePart = parts.find((p) => /[A-Za-zÀ-ÿ]{3,}/.test(p) && !/^\d+$/.test(p)) || parts[0];
      const numericParts = parts
        .filter((p) => /^\d+([.,]\d+)?$/.test(p.replace(/\s/g, '')))
        .map((n) => Math.round(Number(n.replace(',', '.'))));

      if (ACCOUNTING_KEYWORDS.test(token)) {
        const amount = numericParts.find((n) => n >= 50) || 1000;
        const cost = numericParts.find((n) => n >= 50 && n < amount) || Math.round(amount * 0.7);
        accountingRows.push({
          reference: `CPT-MDF-${String(generatedAccCounter++).padStart(4, '0')}`,
          type: /achat|fournisseur/i.test(token)
            ? 'purchase'
            : /charge|depense|loyer/i.test(token)
            ? 'expense'
            : 'sale',
          libelle: namePart,
          client_fournisseur: parts[1] || 'Comptoir / Sauvegarde .MDF',
          montant_dzd: amount,
          cout_achat_dzd: cost,
          marge_dzd: amount - cost,
          date: new Date().toISOString().slice(0, 10),
        });
      } else if (namePart && namePart.length >= 3) {
        const sortedPrices = numericParts.filter((n) => n >= 100 && n <= 5000000).sort((a, b) => a - b);
        const qty = numericParts.find((n) => n >= 0 && n < 500 && !sortedPrices.includes(n)) ?? 10;
        const costPrice = sortedPrices.length >= 2 ? sortedPrices[0] : Math.round((sortedPrices[0] || 1500) * 0.68);
        const salePrice = sortedPrices.length >= 2 ? sortedPrices[sortedPrices.length - 1] : sortedPrices[0] || 2200;

        stockRows.push({
          reference: `MDF-${String(generatedSkuCounter++).padStart(4, '0')}`,
          code_barre: parts.find((p) => /^\d{8,14}$/.test(p)) || '',
          designation: namePart,
          categorie: CATEGORY_KEYWORDS.exec(namePart)?.[0] || 'Import .MDF / .IDF',
          marque: BRAND_KEYWORDS.exec(namePart)?.[0] || '',
          prix_achat: costPrice,
          prix_vente: salePrice,
          quantite_stock: qty,
        });
      }
      idx++;
      continue;
    }

    // Case B: Look for a descriptive text token (product designation or accounting label)
    const isDescriptiveName =
      /[A-Za-zÀ-ÿ]{3,}/.test(token) &&
      !/^\d+$/.test(token) &&
      token.length >= 4 &&
      token.length <= 120;

    if (isDescriptiveName) {
      // Look ahead up to 6 tokens in the binary page for SKU/Barcode and numeric values (qty, cost, price)
      const windowTokens = cleanTokens.slice(idx + 1, idx + 7);
      let skuCandidate = '';
      let barcodeCandidate = '';
      const numbers: number[] = [];

      // Also check if previous token was a SKU or barcode
      if (idx > 0) {
        const prev = cleanTokens[idx - 1];
        if (/^\d{8,14}$/.test(prev)) barcodeCandidate = prev;
        else if (/^[A-Z0-9_-]{3,16}$/i.test(prev) && /\d/.test(prev)) skuCandidate = prev;
      }

      let consumed = 0;
      for (const wt of windowTokens) {
        if (/^\d{8,14}$/.test(wt) && !barcodeCandidate) {
          barcodeCandidate = wt;
          consumed++;
        } else if (/^[A-Z0-9_-]{3,15}$/i.test(wt) && /\d/.test(wt) && !/^\d+$/.test(wt) && !skuCandidate) {
          skuCandidate = wt;
          consumed++;
        } else if (/^\d+([.,]\d{1,2})?$/.test(wt.replace(/\s/g, ''))) {
          const val = Math.round(Number(wt.replace(/\s/g, '').replace(',', '.')));
          if (Number.isFinite(val) && val >= 0 && val <= 50000000) {
            numbers.push(val);
            consumed++;
          }
        } else if (/[A-Za-zÀ-ÿ]{4,}/.test(wt)) {
          // Next product/record starts here
          break;
        }
      }

      if (ACCOUNTING_KEYWORDS.test(token)) {
        const amount = numbers.find((n) => n >= 100) || 3500;
        const cost = numbers.find((n) => n >= 50 && n < amount) || Math.round(amount * 0.7);
        accountingRows.push({
          reference: skuCandidate || `CPT-MDF-${String(generatedAccCounter++).padStart(4, '0')}`,
          type: /achat|fournisseur/i.test(token)
            ? 'purchase'
            : /charge|depense|loyer|salaire/i.test(token)
            ? 'expense'
            : 'sale',
          libelle: token,
          client_fournisseur: 'Import Sauvegarde .MDF/.IDF',
          montant_dzd: amount,
          cout_achat_dzd: cost,
          marge_dzd: amount - cost,
          date: new Date().toISOString().slice(0, 10),
        });
        idx += 1 + consumed;
        continue;
      }

      // Check if it looks like a real product row (either has adjacent numbers/SKU/barcode or matches product vocabulary)
      if (numbers.length > 0 || skuCandidate || barcodeCandidate || CATEGORY_KEYWORDS.test(token) || BRAND_KEYWORDS.test(token)) {
        const prices = numbers.filter((n) => n >= 100 && n <= 2000000).sort((a, b) => a - b);
        const smallNums = numbers.filter((n) => n >= 1 && n < 100);
        const stockQuantity = smallNums[0] ?? (prices.length >= 3 ? prices[0] : 10);
        const salePrice =
          prices.length >= 2
            ? prices[prices.length - 1]
            : prices[0] || 2000;
        const costPrice =
          prices.length >= 2
            ? prices[prices.length - 2]
            : Math.round(salePrice * 0.68);

        const normKey = token.toLowerCase();
        if (!seenConsecutive.has(normKey) && stockRows.length < 3000) {
          seenConsecutive.add(normKey);
          stockRows.push({
            reference: skuCandidate || `MDF-${String(generatedSkuCounter++).padStart(4, '0')}`,
            code_barre: barcodeCandidate || '',
            designation: token,
            categorie: CATEGORY_KEYWORDS.exec(token)?.[0] || 'Stock .MDF / .IDF',
            marque: BRAND_KEYWORDS.exec(token)?.[0] || '',
            prix_achat: costPrice,
            prix_vente: salePrice,
            quantite_stock: stockQuantity,
          });
        }
        idx += 1 + consumed;
        continue;
      }
    }

    idx++;
  }

  const labelNames = files.map((f) => f.originalname).join(' + ');

  if (stockRows.length > 0) {
    tables.push({
      tableName: `Stock & Articles (${labelNames})`,
      columns: [
        'reference',
        'code_barre',
        'designation',
        'categorie',
        'marque',
        'prix_achat',
        'prix_vente',
        'quantite_stock',
      ],
      rows: stockRows,
      tableRole: 'stock',
    });
  }

  if (accountingRows.length > 0) {
    tables.push({
      tableName: `Comptabilité & Journal (${labelNames})`,
      columns: [
        'reference',
        'type',
        'libelle',
        'client_fournisseur',
        'montant_dzd',
        'cout_achat_dzd',
        'marge_dzd',
        'date',
      ],
      rows: accountingRows,
      tableRole: 'accounting',
    });
  }

  return tables;
}

/**
 * Extracts accounting entries from any table that contains accounting/sales/purchases/expenses rows,
 * AND generates automatic Stock Valuation & Margin accounting entries from the stock rows.
 */
export function extractAccountingEntriesFromTables(
  tables: ParsedSourceTable[],
  stockRows: Record<string, unknown>[],
  mapping: ColumnMapping,
  sourceLabel: string,
): NormalizedAccountingEntry[] {
  const entries: NormalizedAccountingEntry[] = [];
  const todayIso = new Date().toISOString();

  // 1. Extract explicit accounting / sales / purchase / expense rows from tables
  for (const table of tables) {
    const isAccTable =
      table.tableRole === 'accounting' ||
      /compta|vente|factur|caisse|journal|ecritur|achat|depens|charge|reglement|mouvement|recette/i.test(
        table.tableName,
      );

    const normCols = table.columns.map((c) => ({ raw: c, norm: normalizeHeader(c) }));
    const findCol = (aliases: string[]) =>
      normCols.find((c) => aliases.some((a) => c.norm === a || c.norm.includes(a)))?.raw;

    const amountCol = findCol([
      'montant_dzd',
      'montant',
      'total_ttc',
      'total',
      'encaisse',
      'credit',
      'debit',
      'ttc',
      'amount',
      'somme',
    ]);
    const labelCol = findCol([
      'libelle',
      'objet',
      'motif',
      'description',
      'operation',
      'designation',
      'intitule',
    ]);
    const refCol = findCol(['reference', 'num_facture', 'numero', 'num_piece', 'code', 'id']);
    const typeCol = findCol(['type', 'nature', 'sens', 'categorie_compta']);
    const partnerCol = findCol(['client_fournisseur', 'client', 'fournisseur', 'tiers', 'partenaire', 'nom_client']);
    const costCol = findCol(['cout_achat_dzd', 'cout', 'prix_achat', 'pa', 'debit_achat']);
    const marginCol = findCol(['marge_dzd', 'marge', 'benefice', 'profit']);

    if (isAccTable && amountCol) {
      table.rows.slice(0, 500).forEach((row, idx) => {
        const amount = parseDzdNumber(row[amountCol], 0);
        if (amount <= 0) return;
        const rawType = typeCol ? String(row[typeCol] ?? '').toLowerCase() : table.tableName.toLowerCase();
        let entryType: NormalizedAccountingEntry['entryType'] = 'sale';
        let category = 'Ventes & Encaissements';
        if (/achat|fournisseur|appro|purchase/i.test(rawType)) {
          entryType = 'purchase';
          category = 'Achats Fournisseurs & Stock';
        } else if (/charge|depens|frais|loyer|salaire|expense/i.test(rawType)) {
          entryType = 'expense';
          category = 'Charges & Dépenses';
        }

        const cost = costCol
          ? parseDzdNumber(row[costCol], 0)
          : entryType === 'sale'
          ? Math.round(amount * 0.7)
          : amount;
        const margin = marginCol
          ? parseDzdNumber(row[marginCol], 0)
          : entryType === 'sale'
          ? amount - cost
          : 0;

        entries.push({
          reference:
            (refCol && String(row[refCol] ?? '').trim()) ||
            `CPT-${idx + 1}-${Date.now().toString(36).slice(-3).toUpperCase()}`,
          entryType,
          category,
          label:
            (labelCol && String(row[labelCol] ?? '').trim()) ||
            `${category} #${idx + 1} (${table.tableName})`,
          partnerName: (partnerCol && String(row[partnerCol] ?? '').trim()) || 'Sauvegarde .MDF/.IDF',
          amountDzd: amount,
          costDzd: cost,
          marginDzd: margin,
          paymentMethod: 'Caisse / Sauvegarde',
          entryDate: todayIso,
          notes: `Importé depuis la table « ${table.tableName} » (${sourceLabel})`,
        });
      });
    }
  }

  // 2. Automatically generate Accounting Valuation Entries ("Compta du Stock") by Category from the Stock Table
  if (stockRows.length > 0 && mapping.name) {
    const byCategory = new Map<
      string,
      { count: number; units: number; totalCostDzd: number; totalSaleDzd: number }
    >();

    for (const row of stockRows) {
      const name = String(row[mapping.name] ?? '').trim();
      if (!name) continue;
      const qty = mapping.stockQuantity ? parseDzdNumber(row[mapping.stockQuantity], 0) : 1;
      const salePrice = mapping.priceDzd ? parseDzdNumber(row[mapping.priceDzd], 0) : 0;
      const costPrice = mapping.costPriceDzd
        ? parseDzdNumber(row[mapping.costPriceDzd], 0)
        : Math.round(salePrice * 0.68);
      const cat =
        (mapping.categoryName && String(row[mapping.categoryName] ?? '').trim()) ||
        'Stock Général';

      const prev = byCategory.get(cat) || { count: 0, units: 0, totalCostDzd: 0, totalSaleDzd: 0 };
      prev.count += 1;
      prev.units += Math.max(0, qty);
      prev.totalCostDzd += Math.max(0, qty) * costPrice;
      prev.totalSaleDzd += Math.max(0, qty) * salePrice;
      byCategory.set(cat, prev);
    }

    let catIdx = 1;
    for (const [catName, stats] of byCategory.entries()) {
      if (stats.totalSaleDzd === 0 && stats.totalCostDzd === 0) continue;
      const marginDzd = stats.totalSaleDzd - stats.totalCostDzd;
      entries.push({
        reference: `BILAN-STK-${String(catIdx++).padStart(3, '0')}`,
        entryType: 'stock_valuation',
        category: 'Valorisation Comptable du Stock',
        label: `Bilan Stock — ${catName} (${stats.count} réf. · ${stats.units} unités)`,
        partnerName: 'Inventaire Interne 2Frères Phone',
        amountDzd: stats.totalSaleDzd,
        costDzd: stats.totalCostDzd,
        marginDzd,
        paymentMethod: 'Actif Stock',
        entryDate: todayIso,
        notes: `Généré automatiquement depuis ${sourceLabel} : Coût d'achat = ${stats.totalCostDzd} DZD · Valeur vente = ${stats.totalSaleDzd} DZD · Marge = ${marginDzd} DZD`,
      });
    }
  }

  return entries;
}

/**
 * Inspects magic bytes of a single buffer (even if named .mdf or .idf) and parses its tables.
 */
async function parseSingleFileToTables(
  buffer: Buffer,
  filename: string,
): Promise<{ format: SupportedImportFormat; tables: ParsedSourceTable[] }> {
  const declaredFormat = detectFormatFromFilename(filename);

  // 1. Check SQLite magic header ("SQLite format 3\0")
  if (buffer.length >= 16 && buffer.subarray(0, 15).toString('ascii') === 'SQLite format 3') {
    const tables = await parseSqliteBuffer(buffer);
    if (tables.length > 0) return { format: declaredFormat, tables };
  }

  // 2. Check ZIP/XLSX (PK\x03\x04) or OLE2/XLS (\xD0\xCF\x11\xE0)
  if (
    buffer.length >= 4 &&
    ((buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) ||
      (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0))
  ) {
    try {
      const XLSX = await import('xlsx');
      const workbook = XLSX.read(buffer, { type: 'buffer' });
      const tables: ParsedSourceTable[] = [];
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
      if (tables.length > 0) return { format: declaredFormat, tables };
    } catch {
      // Fall through to next detector
    }
  }

  // 3. Check dBase / FoxPro binary table (.dbf or renamed .mdf / .idf)
  const dbfTable = tryParseDbfBuffer(buffer, filename);
  if (dbfTable && dbfTable.rows.length > 0) {
    return { format: declaredFormat, tables: [dbfTable] };
  }

  // 4. Standard text-based formats or text disguised as .mdf / .idf
  const trimmedText = decodeBufferText(buffer).trim();

  if (declaredFormat === 'json' || trimmedText.startsWith('{') || trimmedText.startsWith('[')) {
    try {
      const json = JSON.parse(trimmedText);
      const tables = extractBestArrayFromObject(json, 'articles');
      if (tables.length > 0) return { format: declaredFormat, tables };
    } catch {
      // Not valid JSON
    }
  }

  if (declaredFormat === 'xml' || trimmedText.startsWith('<?xml') || /^<[a-zA-Z0-9_:-]+>/.test(trimmedText)) {
    try {
      const { XMLParser } = await import('fast-xml-parser');
      const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
      const parsed = parser.parse(trimmedText);
      const tables = extractBestArrayFromObject(parsed, 'articles');
      if (tables.length > 0) return { format: declaredFormat, tables };
    } catch {
      // Not valid XML
    }
  }

  if (declaredFormat === 'sql' || /INSERT\s+(?:OR\s+\w+\s+|IGNORE\s+)?INTO\s+/i.test(trimmedText)) {
    const tables = parseSqlDump(trimmedText);
    if (tables.length > 0) return { format: declaredFormat, tables };
  }

  if (declaredFormat === 'csv' || declaredFormat === 'tsv') {
    const parsed = parseDelimitedText(trimmedText, declaredFormat === 'tsv' ? '\t' : undefined);
    if (parsed.rows.length > 0) return { format: declaredFormat, tables: [parsed] };
  }

  if (declaredFormat === 'sqlite') {
    const tables = await parseSqliteBuffer(buffer);
    if (tables.length > 0) return { format: 'sqlite', tables };
  }

  // 5. Binary SQL Server / POS .MDF / .IDF / .BAK deep page & token scanner
  const binaryTables = parseBinaryMdfIdfBuffers([{ buffer, originalname: filename }]);
  return { format: declaredFormat, tables: binaryTables };
}

/**
 * Multi-file parser that accepts 1 or multiple files (e.g. .MDF + .IDF uploaded together),
 * merges/correlates their stock & accounting tables, and builds both the Stock Sync Plan and Compta Entries.
 */
export async function parseStockDatabaseFiles(
  files: { buffer: Buffer; originalname: string }[],
  preferredTable?: string,
): Promise<ParsedImportFile> {
  if (!files || files.length === 0) {
    throw new Error('Aucun fichier de sauvegarde reçu.');
  }

  const companionFiles = files.map((f) => f.originalname);
  const hasMdf = files.some((f) => /\.(mdf|ndf)$/i.test(f.originalname));
  const hasIdf = files.some((f) => /\.(idf|ldf|idx|ndx)$/i.test(f.originalname));
  const combinedFormat: SupportedImportFormat =
    hasMdf && hasIdf
      ? 'mdf_idf'
      : detectFormatFromFilename(files[0].originalname);

  const allTables: ParsedSourceTable[] = [];

  for (const f of files) {
    try {
      const res = await parseSingleFileToTables(f.buffer, f.originalname);
      for (const t of res.tables) {
        const displayTableName =
          files.length > 1 && !t.tableName.includes(f.originalname)
            ? `${t.tableName} (${f.originalname})`
            : t.tableName;
        allTables.push({ ...t, tableName: displayTableName });
      }
    } catch {
      // Continue trying combined binary extraction below
    }
  }

  // If individual files yielded binary pages that are better correlated together (e.g. .MDF data + .IDF index/quantities)
  if (allTables.length === 0 || (hasMdf && hasIdf)) {
    const combinedBinary = parseBinaryMdfIdfBuffers(files);
    for (const ct of combinedBinary) {
      if (!allTables.some((existing) => existing.tableName === ct.tableName)) {
        allTables.unshift(ct);
      }
    }
  }

  // If multiple stock tables were extracted from .mdf and .idf, also offer a unified merged table "Fusion .MDF + .IDF"
  const stockCandidateTables = allTables.filter(
    (t) => t.tableRole !== 'accounting' && t.rows.length > 0,
  );
  if (files.length > 1 && stockCandidateTables.length >= 2) {
    const mergedColSet = new Set<string>();
    const mergedRows: Record<string, unknown>[] = [];
    for (const st of stockCandidateTables) {
      st.columns.forEach((c) => mergedColSet.add(c));
      mergedRows.push(...st.rows);
    }
    allTables.unshift({
      tableName: `Fusion Complète (${companionFiles.join(' + ')})`,
      columns: Array.from(mergedColSet),
      rows: mergedRows,
      tableRole: 'stock',
    });
  }

  if (allTables.length === 0) {
    throw new Error(
      'Aucune donnée exploitable trouvée dans ces fichiers. Vérifiez que votre sauvegarde (.mdf / .idf) n’est pas chiffrée.',
    );
  }

  let selected = allTables.find((t) => t.tableName === preferredTable);
  if (!selected) {
    selected = [...allTables].sort((a, b) => {
      const aIsFusion = a.tableName.startsWith('Fusion Complète') ? 1 : 0;
      const bIsFusion = b.tableName.startsWith('Fusion Complète') ? 1 : 0;
      if (aIsFusion !== bIsFusion) return bIsFusion - aIsFusion;
      const aMatch = /prod|articl|stock|item|invent/i.test(a.tableName) ? 1 : 0;
      const bMatch = /prod|articl|stock|item|invent/i.test(b.tableName) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.rows.length - a.rows.length;
    })[0];
  }

  const suggestedMapping = suggestColumnMapping(selected.columns);
  const detectedAccountingEntries = extractAccountingEntriesFromTables(
    allTables,
    selected.rows,
    suggestedMapping,
    companionFiles.join(' + '),
  );

  return {
    format: combinedFormat,
    tables: allTables,
    selectedTable: selected.tableName,
    columns: selected.columns,
    totalRows: selected.rows.length,
    previewRows: selected.rows.slice(0, 12),
    suggestedMapping,
    detectedAccountingEntries,
    companionFiles,
  };
}

export async function parseStockDatabaseBuffer(
  buffer: Buffer,
  filename: string,
  preferredTable?: string,
): Promise<ParsedImportFile> {
  return parseStockDatabaseFiles([{ buffer, originalname: filename }], preferredTable);
}

function parseDzdNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = String(value ?? '')
    .replace(/[^\d.,-]/g, '')
    .replace(/\s+/g, '');
  if (!raw) return fallback;
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
