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
  return 'mdf';
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
  let best = 0;
  for (let i = 0; i < aliases.length; i++) {
    const alias = aliases[i];
    if (norm === alias) {
      return 200 - i;
    }
    if (alias.length >= 4 && norm.includes(alias)) {
      best = Math.max(best, 90 - i);
    } else if (norm.length >= 4 && alias.includes(norm)) {
      best = Math.max(best, 65 - i);
    }
  }
  return best;
}

export function suggestColumnMapping(
  columns: string[],
  sampleRows: Record<string, unknown>[] = [],
): ColumnMapping {
  const pick = (
    aliases: string[],
    excludeCols: (string | undefined)[] = [],
    forbidPattern?: RegExp,
  ): string | undefined => {
    const excluded = new Set(excludeCols.filter(Boolean));
    let bestCol: string | undefined;
    let bestScore = 0;
    for (const col of columns) {
      if (excluded.has(col)) continue;
      const norm = normalizeHeader(col);
      if (forbidPattern && forbidPattern.test(norm)) continue;
      const score = scoreHeaderMatch(col, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    return bestScore >= 55 ? bestCol : undefined;
  };

  let nameCol = pick(
    [
      'designation',
      'productname',
      'product_name',
      'libelle',
      'nom_article',
      'nom_produit',
      'itemname',
      'item_name',
      'articlename',
      'article_name',
      'intitule',
      'name',
      'nom',
      'article',
      'produit',
      'titre',
      'title',
      'item',
      'label',
      'des',
    ],
    [],
    /^(id|pid|productid|product_id|code|ref|reference|sku|productcode|product_code|code_article|code_produit|barcode|code_barre|prix|price|cost|cout|qty|qte|stock|categorie|category|subcat)/,
  );

  let skuCol = pick(
    [
      'reference',
      'productcode',
      'product_code',
      'code_article',
      'code_produit',
      'sku',
      'ref',
      'itemcode',
      'item_code',
      'articlecode',
      'code_interne',
      'num_article',
      'code',
      'pid',
      'productid',
      'product_id',
      'id_article',
    ],
    [nameCol],
  );

  let barcodeCol = pick(
    ['code_barre', 'barcode', 'bar_code', 'codebarre', 'ean', 'ean13', 'upc', 'gtin', 'cb'],
    [nameCol, skuCol],
  );

  let priceCol = pick(
    [
      'prix_vente',
      'sellingprice',
      'selling_price',
      'salesprice',
      'sales_price',
      'saleprice',
      'sale_price',
      'pv_ttc',
      'pv',
      'prix_ttc',
      'unitprice',
      'unit_price',
      'retailprice',
      'mrp',
      'prix',
      'price',
      'price_dzd',
      'tarif',
      'vente',
      'montant',
      'prix1',
      'prix_u',
    ],
    [nameCol, skuCol, barcodeCol],
  );

  let costCol = pick(
    [
      'prix_achat',
      'costprice',
      'cost_price',
      'purchaseprice',
      'purchase_price',
      'buyingprice',
      'buying_price',
      'unitcost',
      'pa',
      'pa_ht',
      'cout_achat',
      'prix_revient',
      'cout',
      'cost',
      'achat',
      'pamp',
      'rate',
    ],
    [nameCol, skuCol, barcodeCol, priceCol],
  );

  let qtyCol = pick(
    [
      'quantite_stock',
      'qty',
      'quantity',
      'qte_stock',
      'quantite',
      'qte',
      'stock_actuel',
      'currentstock',
      'current_stock',
      'openingstock',
      'opening_stock',
      'stockqty',
      'stock_qty',
      'availablestock',
      'stock',
      'disponible',
      'en_stock',
      'solde',
    ],
    [nameCol, skuCol, barcodeCol, priceCol, costCol],
    /reorder|seuil|alert|min/,
  );

  const categoryCol = pick(
    [
      'categorie',
      'categoryname',
      'category_name',
      'subcategoryname',
      'subcategory_name',
      'category',
      'subcategory',
      'famille',
      'sous_famille',
      'rayon',
      'groupe',
      'type_article',
    ],
    [nameCol, skuCol, barcodeCol, priceCol, costCol, qtyCol],
  );

  const brandCol = pick(['marque', 'brand', 'fabricant', 'manufacturer'], [nameCol, skuCol]);
  const descCol = pick(['description', 'details', 'observation', 'remarque', 'notes'], [nameCol, skuCol]);
  const thresholdCol = pick(
    [
      'seuil',
      'seuil_alerte',
      'reorderpoint',
      'reorder_point',
      'reorderlevel',
      'stock_min',
      'min_stock',
      'low_stock_threshold',
      'alerte',
    ],
    [nameCol, skuCol, priceCol, costCol, qtyCol],
  );
  const typeCol = pick(['product_type', 'nature', 'type'], [nameCol, skuCol, categoryCol]);

  // Smart Data-Driven Inference from sampleRows when headers are generic (e.g. col_1, F1, Champ1)
  if (sampleRows.length > 0) {
    const sampleSlice = sampleRows.slice(0, 30);

    if (!nameCol) {
      let bestTextCol = columns[0] || '';
      let bestTextScore = -1;
      for (const col of columns) {
        if (col === skuCol || col === barcodeCol) continue;
        let score = 0;
        for (const r of sampleSlice) {
          const val = String(r[col] ?? '').trim();
          if (val.length >= 4 && /[A-Za-zÀ-ÿ]{3,}/.test(val) && !/^\d+$/.test(val)) {
            score += Math.min(val.length, 45) * (/\s/.test(val) ? 1.8 : 1);
          }
        }
        if (score > bestTextScore) {
          bestTextScore = score;
          bestTextCol = col;
        }
      }
      nameCol = bestTextCol;
    }

    // Find numeric columns not yet assigned to text fields
    const numericCols: { col: string; avg: number; max: number; isBarcode: boolean }[] = [];
    for (const col of columns) {
      if (
        col === nameCol ||
        col === categoryCol ||
        col === brandCol ||
        col === descCol ||
        col === thresholdCol
      ) {
        continue;
      }
      const normCol = normalizeHeader(col);
      if (/^(id|pid|productid|subcat|categoryid|discount|remise|tva|vat|tax)$/.test(normCol)) {
        continue;
      }
      let numCount = 0;
      let sum = 0;
      let max = 0;
      let barcodeLikes = 0;
      for (const r of sampleSlice) {
        const raw = String(r[col] ?? '').trim();
        if (/^\d{8,14}$/.test(raw)) barcodeLikes++;
        const n = parseDzdNumber(raw, -1);
        if (n >= 0 && raw !== '') {
          numCount++;
          sum += n;
          if (n > max) max = n;
        }
      }
      if (numCount >= Math.max(1, Math.floor(sampleSlice.length * 0.4))) {
        numericCols.push({
          col,
          avg: sum / numCount,
          max,
          isBarcode: barcodeLikes >= Math.max(1, Math.floor(sampleSlice.length * 0.3)),
        });
      }
    }

    if (!barcodeCol) {
      const bc = numericCols.find((c) => c.isBarcode);
      if (bc) barcodeCol = bc.col;
    }

    const priceAndQtyCandidates = numericCols.filter(
      (c) => c.col !== barcodeCol && c.col !== skuCol && !c.isBarcode,
    );

    if (!qtyCol && priceAndQtyCandidates.length > 0) {
      const smallCol = [...priceAndQtyCandidates].sort((a, b) => a.avg - b.avg)[0];
      if (smallCol && smallCol.avg <= 500 && priceAndQtyCandidates.length >= 2) {
        qtyCol = smallCol.col;
      }
    }

    const remainingPrices = priceAndQtyCandidates
      .filter((c) => c.col !== qtyCol && c.avg >= 20)
      .sort((a, b) => a.avg - b.avg);

    if (!priceCol && remainingPrices.length > 0) {
      priceCol = remainingPrices[remainingPrices.length - 1].col;
    }
    if (!costCol && remainingPrices.length >= 2) {
      const candidateCost = remainingPrices.filter((c) => c.col !== priceCol);
      if (candidateCost.length > 0) {
        costCol = candidateCost[candidateCost.length - 1].col;
      }
    }
  }

  return {
    name: nameCol || columns[0] || '',
    sku: skuCol,
    barcode: barcodeCol,
    priceDzd: priceCol,
    costPriceDzd: costCol,
    stockQuantity: qtyCol,
    categoryName: categoryCol,
    brand: brandCol,
    description: descCol,
    lowStockThreshold: thresholdCol,
    productType: typeCol,
  };
}

function isLikelyBinaryBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) return false;
  // SQL Server .MDF page header starts with 0x01 0x0F
  if (buffer.length >= 4 && buffer[0] === 0x01 && buffer[1] === 0x0f) return true;
  const checkLen = Math.min(buffer.length, 8192);
  let nulCount = 0;
  let controlCount = 0;
  for (let i = 0; i < checkLen; i++) {
    const b = buffer[i];
    if (b === 0x00) nulCount++;
    else if (b < 0x09 || (b > 0x0d && b < 0x20)) controlCount++;
  }
  return nulCount > checkLen * 0.01 || controlCount > checkLen * 0.05;
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
      const childTables = extractBestArrayFromObject(val, key);
      for (const ct of childTables) tables.push(ct);
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
  if (
    headerLen < 64 ||
    recordLen < 4 ||
    headerLen > buffer.length ||
    numRecords === 0 ||
    numRecords > 500000
  ) {
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

interface ExtractedBinaryToken {
  text: string;
  offset: number;
  nearbyInts: number[];
}

const SYSTEM_NOISE_PATTERNS =
  /^(master|model|msdb|tempdb|sys\.|sysobjects|syscolumns|sysindexes|sysschobjs|syscolpars|sysidxstats|sysallocunits|sysrowsets|sysrscols|sysfiles1|sysobjvalues|sysbinobjs|sysowners|sysprivs|sysxprops|dbo\.|INFORMATION_SCHEMA|db_owner|db_accessadmin|db_securityadmin|db_ddladmin|db_backupoperator|db_datareader|db_datawriter|sp_|xp_|fn_|PK_|FK_|IX_|DF_|CK_|PRIMARY|CLUSTERED|NONCLUSTERED|IDENTITY|CONSTRAINT|FOREIGN|REFERENCES|CHECK|DEFAULT|CREATE\s+TABLE|ALTER\s+TABLE|SELECT\s+|INSERT\s+INTO|UPDATE\s+|DELETE\s+FROM|SQL\s+Server|Microsoft|Windows|UTF-8|ISO-|http:\/\/|https:\/\/|xml\s+version|varchar|nvarchar|datetime|smallint|tinyint|bigint|decimal|numeric|uniqueidentifier|varbinary|timestamp|collation|Latin1_General|French_CI_AS|database_default|filegroup)/i;

const SQL_OR_BINARY_GARBAGE_REGEX =
  /(\bSELECT\b|\bFROM\s+dbo\.|\bINNER\s+JOIN\b|\bLEFT\s+JOIN\b|\bRIGHT\s+JOIN\b|\bGROUP\s+BY\b|\bORDER\s+BY\b|\bINSERT\s+INTO\b|\bCREATE\s+(?:TABLE|VIEW|PROC|PROCEDURE|FUNCTION|TRIGGER)\b|\bALTER\s+(?:TABLE|VIEW|PROC)\b|\bSUM\s*\(|\bCOUNT\s*\(|\bdbo\.[A-Za-z_]+|\bsys\.[A-Za-z_]+|\bLedgerBook\b|\bCustomerID\b|\bSupplierID\b|[ÅÒðÏØÞß÷þÿÑÕÆæ])/i;

function isSqlOrBinaryGarbageString(raw: string): boolean {
  const s = raw.trim();
  if (!s) return true;
  if (SYSTEM_NOISE_PATTERNS.test(s)) return true;
  if (SQL_OR_BINARY_GARBAGE_REGEX.test(s)) return true;
  // Reject strings containing multiple non-French high-bit characters or unprintable control symbols
  let weirdHighBytes = 0;
  for (let i = 0; i < s.length; i++) {
    const code = s.charCodeAt(i);
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f)) return true;
    if (code >= 0xc0 && !/[ÀÂÇÈÉÊËÎÏÔÙÛàâçèéêëîïôùû°€]/.test(s[i])) {
      weirdHighBytes++;
    }
  }
  if (weirdHighBytes > 0) return true;
  return false;
}

/**
 * Inspects binary bytes right before an extracted string token (SQL Server FixedVar row format
 * and WinDev/HFSQL binary record headers store INT16/INT32/FLOAT64/DECIMAL/MONEY quantities and prices
 * in the fixed-length column section before the variable-length column offset array).
 */
function extractNearbyBinaryNumbers(buffer: Buffer, stringOffset: number): number[] {
  const found: number[] = [];
  const start = Math.max(0, stringOffset - 72);
  const end = Math.max(0, stringOffset - 8);

  // 1. Check IEEE-754 FLOAT64 (SQL Server FLOAT column: 8 bytes)
  for (let pos = start; pos <= end && pos + 8 <= buffer.length; pos += 2) {
    const dbl = buffer.readDoubleLE(pos);
    if (
      Number.isFinite(dbl) &&
      dbl >= 50 &&
      dbl <= 500000 &&
      Math.abs(dbl - Math.round(dbl)) < 0.001
    ) {
      const rounded = Math.round(dbl);
      if ((rounded < 1000 ? rounded % 10 === 0 : rounded % 50 === 0) && !found.includes(rounded)) {
        found.push(rounded);
      }
    }
  }

  // 2. Check INT32 (SQL Server INT / DECIMAL scaled by 100)
  for (let pos = start; pos <= end && pos + 4 <= buffer.length; pos += 2) {
    const val32 = buffer.readInt32LE(pos);
    if ((val32 & 0xffff) === 0) continue;
    if (val32 > 0 && val32 <= 500000 && val32 !== 8192 && val32 !== 65535) {
      const isRoundDzdPrice =
        (val32 >= 100 && val32 < 1000 && val32 % 50 === 0) ||
        (val32 >= 1000 && val32 <= 500000 && val32 % 100 === 0);
      const isSmallStockQty = val32 >= 1 && val32 <= 80 && pos <= stringOffset - 16;
      if (isRoundDzdPrice || isSmallStockQty) {
        if (!found.includes(val32)) found.push(val32);
      }
    }
  }
  return found.slice(0, 6);
}

/**
 * Decodes a SQL Server variable-length column buffer (either NVARCHAR UTF-16LE or VARCHAR Windows-1252/UTF-8).
 * Rejects binary varbinary/hash/image slices so they never turn into garbage strings like "XWÅÒ" or "MOIÒ".
 */
function decodeSqlServerVarColumn(colBuf: Buffer): string {
  if (!colBuf || colBuf.length === 0) return '';

  // 1. Detect UTF-16LE (NVARCHAR): even byte length and high proportion of zero odd bytes
  if (colBuf.length >= 2 && colBuf.length % 2 === 0) {
    let zeroOdd = 0;
    let printableEven = 0;
    let controlPairs = 0;
    const pairs = colBuf.length >> 1;
    for (let i = 0; i < colBuf.length; i += 2) {
      const lo = colBuf[i];
      const hi = colBuf[i + 1];
      if (hi === 0x00) {
        zeroOdd++;
        if ((lo >= 0x20 && lo <= 0x7e) || (lo >= 0xc0 && lo <= 0xff)) {
          printableEven++;
        } else if (lo !== 0x09 && lo !== 0x0a && lo !== 0x0d) {
          controlPairs++;
        }
      } else if (hi === 0x06) {
        // Arabic UTF-16LE block (U+0600..U+06FF)
        zeroOdd++;
        printableEven++;
      }
    }
    if (
      controlPairs === 0 &&
      zeroOdd >= Math.ceil(pairs * 0.75) &&
      printableEven >= Math.ceil(pairs * 0.7)
    ) {
      const decoded = colBuf
        .toString('utf16le')
        .replace(/[\u0000-\u001f]+/g, ' ')
        .trim();
      return isSqlOrBinaryGarbageString(decoded) ? '' : decoded;
    }
  }

  // 2. Reject binary buffers (varbinary, password hashes, pointers, GUIDs) that contain binary control bytes
  for (let i = 0; i < colBuf.length; i++) {
    const b = colBuf[i];
    if (b < 0x20 && b !== 0x09 && b !== 0x0a && b !== 0x0d) {
      return '';
    }
    if (b >= 0x7f && b <= 0x9f) {
      return '';
    }
  }

  // 3. Decode UTF-8 or valid French Latin-1 (VARCHAR)
  const utf8 = colBuf.toString('utf8');
  const rawStr = utf8.includes('\uFFFD') ? colBuf.toString('latin1') : utf8;
  const cleaned = rawStr.replace(/\s+/g, ' ').trim();
  return isSqlOrBinaryGarbageString(cleaned) ? '' : cleaned;
}

interface SqlServerRawRecord {
  pageOffset: number;
  slotIndex: number;
  pageObjId: number;
  pageIndexId: number;
  allocUnitKey: string;
  fixedLen: number;
  numCols: number;
  nullBitmap: Buffer;
  fixedBuf: Buffer;
  varCols: string[];
}

interface SqlServerCatalogCol {
  objectId: number;
  colId: number;
  xtype: number;
  length: number;
  prec: number;
  scale: number;
  name: string;
}

/**
 * Reads a SQL Server DECIMAL / NUMERIC value from fixed-length column bytes.
 * In SQL Server FixedVar rows, DECIMAL starts with a 1-byte sign (0x01 = positive, 0x00 = negative)
 * followed by 4, 8, 12, or 16 little-endian integer bytes scaled by 10^scale.
 */
function readSqlServerDecimal(buf: Buffer, offset: number, byteLen: number, scale: number): number | null {
  if (offset + byteLen > buf.length || byteLen < 5) return null;
  // All-zero slice means NULL / 0
  let allZero = true;
  for (let i = 0; i < byteLen; i++) {
    if (buf[offset + i] !== 0) {
      allZero = false;
      break;
    }
  }
  if (allZero) return 0;

  const sign = buf[offset];
  if (sign !== 0x01 && sign !== 0x00) return null;
  const lo = buf.readUInt32LE(offset + 1);
  const mid = byteLen >= 9 ? buf.readUInt32LE(offset + 5) : 0;
  const hi = byteLen >= 13 ? buf.readUInt32LE(offset + 9) : 0;
  if (hi !== 0) return null;
  const rawVal = mid * 4294967296 + lo;
  const divisor = scale > 0 && scale <= 6 ? Math.pow(10, scale) : 1;
  const val = rawVal / divisor;
  return sign === 0x00 ? -val : val;
}

const KNOWN_SYSSCHOBJS_TYPES = new Set([
  'U ',
  'S ',
  'V ',
  'P ',
  'IT',
  'PK',
  'F ',
  'D ',
  'TR',
  'FN',
  'TF',
  'IF',
  'UQ',
  'C ',
  'SQ',
  'SN',
]);

function extractSysschobjsType(fixedBuf: Buffer): string {
  // In SQL Server 2005–2022 sys.sysschobjs: id(4B) + nsid(4B) + nsclass(1B) + status(4B) = offset 13 (2B char)
  const candidateOffsets = [13, 12, 8];
  for (const off of candidateOffsets) {
    if (off + 2 <= fixedBuf.length) {
      const code = fixedBuf.subarray(off, off + 2).toString('ascii');
      if (KNOWN_SYSSCHOBJS_TYPES.has(code)) {
        return code;
      }
    }
  }
  return '';
}

/**
 * Extracts structured SQL Server FixedVar records from 8192-byte (8KB) Data Pages (m_type === 1).
 * Uses the exact end-of-page slot offset array, SQL Server system catalog tables (sysschobjs, syscolpars,
 * sysrowsets, sysallocunits), and relational table enrichment (Product + Temp_Stock / Stock + Category)
 * so columns (Référence, Désignation, Prix d'achat, Prix de vente, Quantité) are 100% exact.
 */
function parseSqlServer8KbDataPages(buffer: Buffer, filename: string): ParsedSourceTable[] {
  const PAGE_SIZE = 8192;
  if (buffer.length < PAGE_SIZE) return [];

  const allRecords: SqlServerRawRecord[] = [];
  const sysschobjsNames = new Map<number, string>();
  const nonUserTableObjIds = new Set<number>();
  const syscolparsByObj = new Map<number, SqlServerCatalogCol[]>();
  const rowsetToObjAndIdx = new Map<string, { objectId: number; indexId: number }>();
  const allocUnitToRowset = new Map<string, string>();
  const allocUnitByObjOnly = new Map<number, string>();

  const extractRecordAt = (
    pageOff: number,
    rowRelOff: number,
    slotIdx: number,
    pageObjId: number,
    pageIndexId: number,
    allocUnitKey: string,
  ): SqlServerRawRecord | null => {
    if (rowRelOff < 96 || rowRelOff >= PAGE_SIZE - 8) return null;
    const rPos = pageOff + rowRelOff;
    if (rPos + 6 > buffer.length) return null;

    const tagA = buffer[rPos];
    const recType = (tagA >> 1) & 0x07;
    // Record type 0 = PRIMARY_RECORD, 1 = FORWARDED_RECORD (excludes ghost/deleted & index records)
    if (recType !== 0 && recType !== 1) return null;

    const fixedLen = buffer.readUInt16LE(rPos + 2);
    if (fixedLen < 4 || fixedLen > 2048 || rPos + fixedLen + 2 > pageOff + PAGE_SIZE) return null;

    const numCols = buffer.readUInt16LE(rPos + fixedLen);
    if (numCols < 1 || numCols > 250) return null;

    const nullBitmapLen = Math.ceil(numCols / 8);
    if (rPos + fixedLen + 2 + nullBitmapLen > pageOff + PAGE_SIZE) return null;

    const nullBitmap = buffer.subarray(rPos + fixedLen + 2, rPos + fixedLen + 2 + nullBitmapLen);
    const fixedBuf = buffer.subarray(rPos + 4, rPos + fixedLen);

    const varCols: string[] = [];
    const hasVarCols = (tagA & 0x20) !== 0;
    if (hasVarCols) {
      const varPos = rPos + fixedLen + 2 + nullBitmapLen;
      if (varPos + 2 > pageOff + PAGE_SIZE) return null;
      const numVarCols = buffer.readUInt16LE(varPos);
      if (numVarCols > 150 || varPos + 2 + numVarCols * 2 > pageOff + PAGE_SIZE) return null;

      let prevEndRel = fixedLen + 2 + nullBitmapLen + 2 + numVarCols * 2;
      for (let v = 0; v < numVarCols; v++) {
        const rawEnd = buffer.readUInt16LE(varPos + 2 + v * 2);
        const endRel = rawEnd & 0x7fff;
        const isComplex = (rawEnd & 0x8000) !== 0;
        if (!isComplex && endRel >= prevEndRel && rPos + endRel <= pageOff + PAGE_SIZE) {
          const colSlice = buffer.subarray(rPos + prevEndRel, rPos + endRel);
          varCols.push(decodeSqlServerVarColumn(colSlice));
        } else {
          varCols.push('');
        }
        if (endRel >= prevEndRel && endRel <= PAGE_SIZE) {
          prevEndRel = endRel;
        }
      }
    }

    return {
      pageOffset: pageOff,
      slotIndex: slotIdx,
      pageObjId,
      pageIndexId,
      allocUnitKey,
      fixedLen,
      numCols,
      nullBitmap,
      fixedBuf,
      varCols,
    };
  };

  const validXtypes = new Set([
    34, 35, 36, 40, 41, 42, 43, 48, 52, 56, 58, 59, 60, 61, 62, 98, 99, 104, 106, 108, 122, 127,
    165, 167, 173, 175, 189, 231, 239, 241,
  ]);

  // Scan all 8KB Leaf Data Pages in the .MDF file
  for (let pageOff = 0; pageOff + PAGE_SIZE <= buffer.length; pageOff += PAGE_SIZE) {
    const headerVer = buffer[pageOff];
    const pageType = buffer[pageOff + 1];
    const pageLevel = buffer[pageOff + 3];
    // Leaf Data Page in SQL Server has headerVer === 1, pageType === 1, and pageLevel === 0
    if (headerVer !== 0x01 || pageType !== 0x01 || pageLevel !== 0x00) continue;

    const slotCnt = buffer.readUInt16LE(pageOff + 22);
    if (slotCnt < 1 || slotCnt > 700) continue;

    const pageIndexId = buffer.readUInt16LE(pageOff + 6);
    const pageObjId = buffer.readUInt32LE(pageOff + 24);
    // Group pages by their actual Allocation Unit ID (pageObjId + pageIndexId), NOT by m_pageId!
    const allocUnitKey = `${pageObjId}_${pageIndexId}`;

    const seenOffsets = new Set<number>();
    for (let s = 0; s < slotCnt; s++) {
      const slotPos = pageOff + PAGE_SIZE - (s + 1) * 2;
      if (slotPos < pageOff + 96) break;
      const rowRelOff = buffer.readUInt16LE(slotPos);
      if (seenOffsets.has(rowRelOff)) continue;
      seenOffsets.add(rowRelOff);

      const rec = extractRecordAt(pageOff, rowRelOff, s, pageObjId, pageIndexId, allocUnitKey);
      if (!rec) continue;

      // 1. sys.sysschobjs (System Object ID 34): fixedBuf[0..3] = object_id, fixedBuf[13..14] = type, varCols[0] = name
      if (
        (pageObjId === 34 || (rec.fixedBuf.length >= 36 && rec.fixedBuf.length <= 48)) &&
        rec.varCols.length >= 1 &&
        /^[A-Za-z_][A-Za-z0-9_ ]{1,60}$/.test(rec.varCols[0])
      ) {
        const candObjId = rec.fixedBuf.readInt32LE(0);
        const objType = extractSysschobjsType(rec.fixedBuf);
        if (candObjId > 100 && objType) {
          if (objType === 'U ') {
            sysschobjsNames.set(candObjId, rec.varCols[0].trim());
          } else {
            nonUserTableObjIds.add(candObjId);
          }
          if (pageObjId === 34) continue;
        }
      }

      // 2. sys.syscolpars (System Object ID 41):
      // [0..3]=id(int32), [4..5]=number(int16), [6..9]=colid(int32), [10]=xtype(uint8), [11..14]=utype(int32), [15..16]=length(int16), [17]=prec, [18]=scale
      if (
        (pageObjId === 41 || (rec.fixedBuf.length >= 19 && rec.fixedBuf.length <= 64)) &&
        rec.varCols.length >= 1 &&
        /^[A-Za-z_][A-Za-z0-9_À-ÿ ]{0,60}$/.test(rec.varCols[0])
      ) {
        const tblId = rec.fixedBuf.readInt32LE(0);
        const procNum = rec.fixedBuf.readInt16LE(4);
        const colId = rec.fixedBuf.readInt32LE(6);
        const xtype = rec.fixedBuf[10];
        const colLen =
          rec.fixedBuf.length >= 19 ? rec.fixedBuf.readInt16LE(15) : rec.fixedBuf.readInt16LE(12);
        const prec = rec.fixedBuf.length >= 19 ? rec.fixedBuf[17] || 0 : rec.fixedBuf[14] || 0;
        const scale = rec.fixedBuf.length >= 19 ? rec.fixedBuf[18] || 0 : rec.fixedBuf[15] || 0;

        if (
          tblId > 1000 &&
          procNum === 0 &&
          colId >= 1 &&
          colId <= 200 &&
          validXtypes.has(xtype) &&
          colLen >= -1 &&
          colLen <= 8000
        ) {
          const list = syscolparsByObj.get(tblId) || [];
          if (!list.some((c) => c.colId === colId)) {
            list.push({
              objectId: tblId,
              colId,
              xtype,
              length: colLen,
              prec,
              scale,
              name: rec.varCols[0].trim(),
            });
            syscolparsByObj.set(tblId, list);
          }
          continue;
        }
      }

      // 3. sys.sysrowsets (System Object ID 5): [0..7]=rowsetid(int64), [8]=ownertype(uint8), [9..12]=idmajor(int32), [13..16]=idminor(int32)
      if ((pageObjId === 5 || rec.varCols.length === 0) && rec.fixedBuf.length >= 17 && rec.numCols >= 10) {
        const rowsetKey = `${rec.fixedBuf.readUInt32LE(0)}_${rec.fixedBuf.readUInt32LE(4)}`;
        const idMajor = rec.fixedBuf.readInt32LE(9);
        const idMinor = rec.fixedBuf.readInt32LE(13);
        if (idMajor > 1000 && idMinor >= 0 && idMinor <= 128) {
          rowsetToObjAndIdx.set(rowsetKey, { objectId: idMajor, indexId: idMinor });
          if (pageObjId === 5) continue;
        }
      }

      // 4. sys.sysallocunits (System Object ID 7): [0..7]=auid(int64), [8]=type(uint8), [9..16]=ownerid(int64)
      // In SQL Server 2005+, auid has low 16 bits = m_indexId at [0..1] and middle 32 bits = m_objId at [2..5]!
      if ((pageObjId === 7 || rec.varCols.length === 0) && rec.fixedBuf.length >= 17 && rec.numCols >= 7) {
        const auIndexId = rec.fixedBuf.readUInt16LE(0);
        const auObjId = rec.fixedBuf.readUInt32LE(2);
        const auType = rec.fixedBuf[8];
        const ownerRowsetKey = `${rec.fixedBuf.readUInt32LE(9)}_${rec.fixedBuf.readUInt32LE(13)}`;
        if (auObjId >= 100 && (auType === 1 || pageObjId === 7)) {
          allocUnitToRowset.set(`${auObjId}_${auIndexId}`, ownerRowsetKey);
          if (auType === 1 || !allocUnitByObjOnly.has(auObjId)) {
            allocUnitByObjOnly.set(auObjId, ownerRowsetKey);
          }
          if (pageObjId === 7) continue;
        }
      }

      // NEVER include internal SQL Server system catalog pages (pageObjId 1..99, such as 60 = sys.sysobjvalues) in user data!
      if (pageObjId > 0 && pageObjId < 100) {
        continue;
      }

      allRecords.push(rec);
    }
  }

  if (allRecords.length === 0) return [];

  // Group extracted user data records by table allocation unit & structure (allocUnitKey + numCols + fixedLen)
  const recordsByTableGroup = new Map<string, SqlServerRawRecord[]>();
  for (const rec of allRecords) {
    const groupKey = `${rec.allocUnitKey}_cols${rec.numCols}_fix${rec.fixedLen}`;
    const arr = recordsByTableGroup.get(groupKey) || [];
    arr.push(rec);
    recordsByTableGroup.set(groupKey, arr);
  }

  // Helper to compute expected fixed byte length of a syscolpars column list
  const computeExpectedFixedBytes = (cols: SqlServerCatalogCol[]): number => {
    const sorted = [...cols].sort((a, b) => a.colId - b.colId);
    let bytes = 0;
    let bitCount = 0;
    for (const c of sorted) {
      const isVar =
        c.xtype === 167 ||
        c.xtype === 231 ||
        c.xtype === 165 ||
        c.xtype === 34 ||
        c.xtype === 35 ||
        c.xtype === 99 ||
        c.xtype === 241 ||
        c.xtype === 98 ||
        c.length === -1;
      if (isVar) continue;
      if (c.xtype === 104) {
        if (bitCount % 8 === 0) bytes += 1;
        bitCount++;
      } else if (c.length > 0) {
        bytes += c.length;
      }
    }
    return bytes;
  };

  const parsedTables: ParsedSourceTable[] = [];
  let tableCounter = 1;

  for (const [, groupRecords] of recordsByTableGroup.entries()) {
    if (groupRecords.length === 0) continue;
    const sample = groupRecords[0];
    const fixedByteLen = sample.fixedBuf.length;
    const maxVarCols = Math.max(...groupRecords.map((r) => r.varCols.length), 0);

    // 1. Resolve exact table object_id via sysallocunits -> sysrowsets
    const linkedRowsetKey =
      allocUnitToRowset.get(sample.allocUnitKey) || allocUnitByObjOnly.get(sample.pageObjId);
    const rowsetInfo = linkedRowsetKey ? rowsetToObjAndIdx.get(linkedRowsetKey) : undefined;

    // Skip secondary non-clustered index pages (indexId >= 2)
    if (rowsetInfo && rowsetInfo.indexId >= 2) {
      continue;
    }

    let resolvedObjId =
      rowsetInfo?.objectId || (sample.pageObjId > 1000 ? sample.pageObjId : 0);

    // 2. Fallback: Exact Schema Signature Matcher against syscolpars (matching numCols AND fixedByteLen)
    if (!resolvedObjId || !syscolparsByObj.has(resolvedObjId)) {
      let bestMatchObjId = 0;
      let bestDiff = 999;
      for (const [candObjId, cols] of syscolparsByObj.entries()) {
        if (nonUserTableObjIds.has(candObjId)) continue;
        if (cols.length !== sample.numCols) continue;
        const expFixed = computeExpectedFixedBytes(cols);
        const diff = Math.abs(expFixed - fixedByteLen);
        if (diff <= 4 && diff < bestDiff) {
          bestDiff = diff;
          bestMatchObjId = candObjId;
        }
      }
      if (bestMatchObjId) {
        resolvedObjId = bestMatchObjId;
      }
    }

    if (resolvedObjId && nonUserTableObjIds.has(resolvedObjId)) {
      continue;
    }

    const catalogCols = resolvedObjId ? syscolparsByObj.get(resolvedObjId) : undefined;
    const catalogTableName = (resolvedObjId && sysschobjsNames.get(resolvedObjId)) || '';

    // Skip internal SQL Server or diagram tables
    if (
      catalogTableName &&
      /^(sys|dtproperties|MSreplication|__RefactorLog|trace_xe)/i.test(catalogTableName)
    ) {
      continue;
    }

    // Branch 1: Decode using exact syscolpars schema metadata
    if (catalogCols && catalogCols.length > 0) {
      const sortedCols = [...catalogCols].sort((a, b) => a.colId - b.colId);
      const colNames = sortedCols.map((c) => c.name);
      const rows: Record<string, unknown>[] = [];

      for (const rec of groupRecords) {
        const rowObj: Record<string, unknown> = {};
        let fOff = 0;
        let vIdx = 0;
        let bitCount = 0;
        let currentBitByteOff = 0;

        for (let cIdx = 0; cIdx < sortedCols.length; cIdx++) {
          const col = sortedCols[cIdx];
          const isVarType =
            col.xtype === 167 ||
            col.xtype === 231 ||
            col.xtype === 165 ||
            col.xtype === 34 ||
            col.xtype === 35 ||
            col.xtype === 99 ||
            col.xtype === 241 ||
            col.xtype === 98 ||
            col.length === -1;

          if (isVarType) {
            const rawVal = vIdx < rec.varCols.length ? rec.varCols[vIdx] : '';
            vIdx++;
            // Skip binary columns (varbinary = 165, image = 34)
            if (col.xtype === 165 || col.xtype === 34) {
              rowObj[col.name] = '';
            } else {
              rowObj[col.name] = rawVal;
            }
          } else if (col.xtype === 104) {
            // Bit-packed boolean column (up to 8 bit columns share 1 byte in fixedBuf)
            if (bitCount % 8 === 0) {
              currentBitByteOff = fOff;
              fOff += 1;
            }
            const bitVal =
              currentBitByteOff < rec.fixedBuf.length
                ? (rec.fixedBuf[currentBitByteOff] & (1 << (bitCount % 8))) !== 0
                  ? 1
                  : 0
                : 0;
            bitCount++;
            rowObj[col.name] = bitVal;
          } else {
            let decodedVal: unknown = '';
            if (fOff < rec.fixedBuf.length) {
              if (col.xtype === 56 && fOff + 4 <= rec.fixedBuf.length) {
                const v = rec.fixedBuf.readInt32LE(fOff);
                decodedVal = v >= -100000000 && v <= 500000000 ? v : 0;
              } else if (col.xtype === 52 && fOff + 2 <= rec.fixedBuf.length) {
                decodedVal = rec.fixedBuf.readInt16LE(fOff);
              } else if (col.xtype === 48 && fOff + 1 <= rec.fixedBuf.length) {
                decodedVal = rec.fixedBuf.readUInt8(fOff);
              } else if (col.xtype === 127 && fOff + 8 <= rec.fixedBuf.length) {
                const v = Number(rec.fixedBuf.readBigInt64LE(fOff));
                decodedVal = Number.isFinite(v) && Math.abs(v) <= 50000000000 ? v : 0;
              } else if (col.xtype === 62) {
                if (col.length === 4 && fOff + 4 <= rec.fixedBuf.length) {
                  const fl = rec.fixedBuf.readFloatLE(fOff);
                  decodedVal = Number.isFinite(fl) && Math.abs(fl) <= 500000000 ? Math.round(fl * 100) / 100 : 0;
                } else if (fOff + 8 <= rec.fixedBuf.length) {
                  const d = rec.fixedBuf.readDoubleLE(fOff);
                  decodedVal = Number.isFinite(d) && Math.abs(d) <= 500000000 ? Math.round(d * 100) / 100 : 0;
                }
              } else if (col.xtype === 59 && fOff + 4 <= rec.fixedBuf.length) {
                const fl = rec.fixedBuf.readFloatLE(fOff);
                decodedVal = Number.isFinite(fl) && Math.abs(fl) <= 500000000 ? Math.round(fl * 100) / 100 : 0;
              } else if (col.xtype === 60 && fOff + 8 <= rec.fixedBuf.length) {
                const m = Number(rec.fixedBuf.readBigInt64LE(fOff)) / 10000;
                decodedVal = Number.isFinite(m) && Math.abs(m) <= 500000000 ? Math.round(m * 100) / 100 : 0;
              } else if (col.xtype === 122 && fOff + 4 <= rec.fixedBuf.length) {
                const sm = rec.fixedBuf.readInt32LE(fOff) / 10000;
                decodedVal = Math.round(sm * 100) / 100;
              } else if ((col.xtype === 106 || col.xtype === 108) && col.length > 0 && fOff + col.length <= rec.fixedBuf.length) {
                decodedVal = readSqlServerDecimal(rec.fixedBuf, fOff, col.length, col.scale) ?? 0;
              } else if (col.xtype === 61 && fOff + 8 <= rec.fixedBuf.length) {
                // SQL Server datetime: second int32 is days since 1900-01-01
                const days = rec.fixedBuf.readInt32LE(fOff + 4);
                if (days >= 20000 && days <= 65000) {
                  decodedVal = new Date(Date.UTC(1900, 0, 1) + days * 86400000).toISOString().slice(0, 10);
                }
              } else if (col.xtype === 58 && fOff + 4 <= rec.fixedBuf.length) {
                const days = rec.fixedBuf.readUInt16LE(fOff + 2);
                if (days >= 20000 && days <= 65000) {
                  decodedVal = new Date(Date.UTC(1900, 0, 1) + days * 86400000).toISOString().slice(0, 10);
                }
              } else if (col.xtype === 239 && col.length > 0 && fOff + col.length <= rec.fixedBuf.length) {
                const s = rec.fixedBuf
                  .subarray(fOff, fOff + col.length)
                  .toString('utf16le')
                  .replace(/[\u0000-\u001f]+/g, ' ')
                  .trim();
                decodedVal = isSqlOrBinaryGarbageString(s) ? '' : s;
              } else if (col.xtype === 175 && col.length > 0 && fOff + col.length <= rec.fixedBuf.length) {
                decodedVal = decodeSqlServerVarColumn(rec.fixedBuf.subarray(fOff, fOff + col.length));
              }
            }
            if (col.length > 0) fOff += col.length;
            rowObj[col.name] = decodedVal ?? '';
          }
        }
        rows.push(rowObj);
      }

      if (rows.length > 0) {
        const tblName = catalogTableName || `Table_${tableCounter++}`;
        const isAcc =
          /ledger|invoice|factur|vente|caisse|journal|achat|purchase|payment|depens|charge|voucher/i.test(
            tblName,
          );
        parsedTables.push({
          tableName: tblName,
          columns: colNames,
          rows,
          tableRole: isAcc ? 'accounting' : 'stock',
        });
        continue;
      }
    }

    // Branch 2: Universal FixedVar Row Decoder (when syscolpars is absent or not matched)
    if (maxVarCols === 0) continue;

    // Filter out records that have no clean variable strings
    const cleanGroupRecords = groupRecords.filter((rec) =>
      rec.varCols.some((s) => s.length >= 2 && !isSqlOrBinaryGarbageString(s)),
    );
    if (cleanGroupRecords.length === 0) continue;

    interface VarColStats {
      index: number;
      nonEmptyCount: number;
      avgLen: number;
      spaceRatio: number;
      barcodeRatio: number;
      codeRatio: number;
      uniqueRatio: number;
      letterWordRatio: number;
    }

    const varStats: VarColStats[] = [];
    for (let v = 0; v < maxVarCols; v++) {
      let nonEmpty = 0;
      let totalLen = 0;
      let withSpaces = 0;
      let barcodes = 0;
      let codes = 0;
      let withLetterWords = 0;
      const uniq = new Set<string>();

      for (const rec of cleanGroupRecords) {
        const val = (rec.varCols[v] || '').trim();
        if (!val || isSqlOrBinaryGarbageString(val)) continue;
        nonEmpty++;
        totalLen += val.length;
        uniq.add(val.toLowerCase());
        if (/\s/.test(val)) withSpaces++;
        if (/[A-Za-zÀ-ÿ]{3,}/.test(val)) withLetterWords++;
        if (/^\d{8,14}$/.test(val)) barcodes++;
        if (/^[A-Z0-9._/-]{1,22}$/i.test(val) && !/\s/.test(val) && (/\d/.test(val) || val.length <= 12)) {
          codes++;
        }
      }

      varStats.push({
        index: v,
        nonEmptyCount: nonEmpty,
        avgLen: nonEmpty > 0 ? totalLen / nonEmpty : 0,
        spaceRatio: nonEmpty > 0 ? withSpaces / nonEmpty : 0,
        barcodeRatio: nonEmpty > 0 ? barcodes / nonEmpty : 0,
        codeRatio: nonEmpty > 0 ? codes / nonEmpty : 0,
        uniqueRatio: nonEmpty > 0 ? uniq.size / nonEmpty : 0,
        letterWordRatio: nonEmpty > 0 ? withLetterWords / nonEmpty : 0,
      });
    }

    // Pick Designation column: must have real letter words, penalize short code-like columns without spaces
    let designationColIdx = -1;
    let bestDesigScore = -1;
    for (const st of varStats) {
      if (st.nonEmptyCount === 0 || st.letterWordRatio < 0.25) continue;
      if (st.barcodeRatio > 0.5) continue;
      const codePenalty = st.spaceRatio === 0 && st.codeRatio > 0.65 ? 0.15 : 1.0;
      const score =
        st.avgLen *
        (1 + st.spaceRatio * 3.0) *
        (0.5 + st.uniqueRatio) *
        st.letterWordRatio *
        codePenalty *
        (st.nonEmptyCount / cleanGroupRecords.length);
      if (score > bestDesigScore) {
        bestDesigScore = score;
        designationColIdx = st.index;
      }
    }
    if (designationColIdx === -1) continue;

    // Pick Barcode column
    let barcodeColIdx = -1;
    for (const st of varStats) {
      if (st.index === designationColIdx) continue;
      if (st.barcodeRatio >= 0.25) {
        barcodeColIdx = st.index;
        break;
      }
    }

    // Pick Reference / Code Article column
    let referenceColIdx = -1;
    let bestRefScore = -1;
    for (const st of varStats) {
      if (st.index === designationColIdx || st.index === barcodeColIdx || st.nonEmptyCount === 0) continue;
      const score = (st.codeRatio * 2.5 + st.uniqueRatio) * (st.avgLen <= 28 ? 1.5 : 0.4);
      if (score > bestRefScore) {
        bestRefScore = score;
        referenceColIdx = st.index;
      }
    }

    // Pick Category column
    let categoryColIdx = -1;
    for (const st of varStats) {
      if (
        st.index === designationColIdx ||
        st.index === barcodeColIdx ||
        st.index === referenceColIdx ||
        st.nonEmptyCount === 0
      ) {
        continue;
      }
      if (st.letterWordRatio >= 0.3) {
        categoryColIdx = st.index;
        break;
      }
    }

    // 2b. Discover fixed-length numeric columns inside fixedBuf[0..fixedByteLen-1]
    interface DetectedNumericSlot {
      offset: number;
      byteSize: number;
      kind: 'float64' | 'decimal9' | 'decimal5' | 'money' | 'int32';
      readValue: (buf: Buffer) => number | null;
      validRatio: number;
      positiveCount: number;
      avgVal: number;
      medianVal: number;
      distinctCount: number;
      isSequentialId: boolean;
      isIntegerLike: boolean;
    }

    const candidateSlots: DetectedNumericSlot[] = [];

    const evaluateSlot = (
      offset: number,
      byteSize: number,
      kind: DetectedNumericSlot['kind'],
      reader: (buf: Buffer) => number | null,
    ) => {
      const vals: number[] = [];
      let validCount = 0;
      let posCount = 0;
      let intLikeCount = 0;
      for (const rec of cleanGroupRecords) {
        if (offset + byteSize > rec.fixedBuf.length) continue;
        const v = reader(rec.fixedBuf);
        if (v !== null && Number.isFinite(v) && v >= 0 && v <= 50000000) {
          validCount++;
          vals.push(v);
          if (v > 0) posCount++;
          if (Math.abs(v - Math.round(v)) < 0.001) intLikeCount++;
        }
      }
      const validRatio = cleanGroupRecords.length > 0 ? validCount / cleanGroupRecords.length : 0;
      if (validRatio < 0.6 || posCount === 0) return;

      const nonZero = vals.filter((x) => x > 0).sort((a, b) => a - b);
      const avgVal = nonZero.length > 0 ? nonZero.reduce((a, b) => a + b, 0) / nonZero.length : 0;
      const medianVal = nonZero.length > 0 ? nonZero[Math.floor(nonZero.length / 2)] : 0;

      let strictlyInc = 0;
      const uniqSet = new Set(vals);
      for (let i = 1; i < vals.length; i++) {
        if (vals[i] === vals[i - 1] + 1 || (vals[i] > vals[i - 1] && vals[i] - vals[i - 1] <= 5)) {
          strictlyInc++;
        }
      }
      const isSequentialId =
        offset === 0 &&
        kind === 'int32' &&
        vals.length >= 3 &&
        uniqSet.size >= vals.length * 0.9 &&
        strictlyInc >= (vals.length - 1) * 0.6;

      candidateSlots.push({
        offset,
        byteSize,
        kind,
        readValue: reader,
        validRatio,
        positiveCount: posCount,
        avgVal,
        medianVal,
        distinctCount: uniqSet.size,
        isSequentialId,
        isIntegerLike: intLikeCount >= validCount * 0.95,
      });
    };

    for (let off = 0; off + 8 <= fixedByteLen; off++) {
      evaluateSlot(off, 8, 'float64', (b) => {
        const rawLo = b.readUInt32LE(off);
        const rawHi = b.readUInt32LE(off + 4);
        if (rawLo === 0 && rawHi === 0) return 0;
        const d = b.readDoubleLE(off);
        if (!Number.isFinite(d) || d < 0.5 || d > 20000000) return null;
        if (Math.abs(d * 100 - Math.round(d * 100)) > 0.05) return null;
        return Math.round(d * 100) / 100;
      });
    }

    for (let off = 0; off + 5 <= fixedByteLen; off++) {
      if (off + 9 <= fixedByteLen) {
        evaluateSlot(off, 9, 'decimal9', (b) => {
          if (b[off] !== 0x01 && b[off] !== 0x00) return null;
          if (b.readUInt32LE(off + 5) !== 0) return null;
          const raw = b.readUInt32LE(off + 1);
          const val = raw >= 10000 && raw % 100 === 0 ? raw / 100 : raw;
          return val >= 0 && val <= 20000000 ? val : null;
        });
      }
      evaluateSlot(off, 5, 'decimal5', (b) => {
        if (b[off] !== 0x01 && b[off] !== 0x00) return null;
        const raw = b.readUInt32LE(off + 1);
        const val = raw >= 10000 && raw % 100 === 0 ? raw / 100 : raw;
        return val >= 0 && val <= 20000000 ? val : null;
      });
    }

    for (let off = 0; off + 8 <= fixedByteLen; off++) {
      evaluateSlot(off, 8, 'money', (b) => {
        if (b.readInt32LE(off + 4) !== 0) return null;
        const raw = b.readUInt32LE(off);
        if (raw === 0) return 0;
        if (raw % 100 !== 0) return null;
        const val = raw / 10000;
        return val >= 1 && val <= 20000000 ? val : null;
      });
    }

    for (let off = 0; off + 4 <= fixedByteLen; off += 2) {
      evaluateSlot(off, 4, 'int32', (b) => {
        const v = b.readInt32LE(off);
        if (v < 0 || v > 10000000) return null;
        if (v > 0 && (v & 0xffff) === 0) return null;
        return v;
      });
    }

    const kindPriority: Record<DetectedNumericSlot['kind'], number> = {
      float64: 5,
      decimal9: 5,
      money: 4,
      decimal5: 4,
      int32: 3,
    };
    candidateSlots.sort((a, b) => {
      if (a.isSequentialId !== b.isSequentialId && a.offset === 0) return a.isSequentialId ? -1 : 1;
      const pDiff = kindPriority[b.kind] - kindPriority[a.kind];
      if (pDiff !== 0) return pDiff;
      if (Math.abs(b.validRatio - a.validRatio) > 0.1) return b.validRatio - a.validRatio;
      return a.offset - b.offset;
    });

    const chosenNumericSlots: DetectedNumericSlot[] = [];
    const usedBytes = new Uint8Array(fixedByteLen);
    for (const slot of candidateSlots) {
      let overlaps = false;
      for (let b = slot.offset; b < slot.offset + slot.byteSize; b++) {
        if (usedBytes[b]) {
          overlaps = true;
          break;
        }
      }
      if (!overlaps) {
        for (let b = slot.offset; b < slot.offset + slot.byteSize; b++) usedBytes[b] = 1;
        chosenNumericSlots.push(slot);
      }
    }
    chosenNumericSlots.sort((a, b) => a.offset - b.offset);

    // Pairwise CostPrice / SellingPrice Correlation Matcher:
    // Finds the exact pair of columns (CostPrice, SellingPrice) where 30 <= Cost <= Sale and Cost/Sale >= 0.15 across rows
    const nonIdSlots = chosenNumericSlots.filter((s) => !s.isSequentialId);
    let costSlot: DetectedNumericSlot | null = null;
    let saleSlot: DetectedNumericSlot | null = null;
    let bestPairScore = -1;

    for (let i = 0; i < nonIdSlots.length; i++) {
      for (let j = 0; j < nonIdSlots.length; j++) {
        if (i === j) continue;
        const sCost = nonIdSlots[i];
        const sSale = nonIdSlots[j];
        if (sCost.medianVal < 20 || sSale.medianVal < 30 || sCost.medianVal > sSale.medianVal) continue;

        let validPairs = 0;
        for (const rec of cleanGroupRecords.slice(0, 80)) {
          const cVal = sCost.readValue(rec.fixedBuf) ?? 0;
          const pVal = sSale.readValue(rec.fixedBuf) ?? 0;
          if (cVal >= 20 && pVal >= 30 && cVal <= pVal && cVal >= pVal * 0.15) {
            validPairs++;
          }
        }
        if (validPairs === 0) continue;
        const sameKindBonus = sCost.kind === sSale.kind ? 1.5 : 1.0;
        const adjacentBonus =
          Math.abs(sSale.offset - (sCost.offset + sCost.byteSize)) <= 2 ? 1.4 : 1.0;
        const score = validPairs * sameKindBonus * adjacentBonus;
        if (score > bestPairScore) {
          bestPairScore = score;
          costSlot = sCost;
          saleSlot = sSale;
        }
      }
    }

    if (!saleSlot) {
      const priceLike = nonIdSlots
        .filter((s) => s.medianVal >= 50)
        .sort((a, b) => b.medianVal - a.medianVal);
      if (priceLike.length >= 1) saleSlot = priceLike[0];
      if (priceLike.length >= 2) costSlot = priceLike[1];
    }

    // Pick Quantity slot: integer-like slot not used by costSlot/saleSlot, preferring varying values (not constant ReorderPoint = 10)
    const remainingQtySlots = nonIdSlots
      .filter(
        (s) =>
          s !== costSlot &&
          s !== saleSlot &&
          s.isIntegerLike &&
          s.medianVal >= 0 &&
          s.medianVal <= 5000,
      )
      .sort((a, b) => b.distinctCount - a.distinctCount);
    const qtySlot: DetectedNumericSlot | null = remainingQtySlots[0] || null;

    const rows: Record<string, unknown>[] = [];
    const seenKeys = new Set<string>();

    for (let rIdx = 0; rIdx < cleanGroupRecords.length; rIdx++) {
      const rec = cleanGroupRecords[rIdx];
      let rawDesig = (rec.varCols[designationColIdx] || '').trim();
      let rawRef = referenceColIdx >= 0 ? (rec.varCols[referenceColIdx] || '').trim() : '';
      const rawBarcode = barcodeColIdx >= 0 ? (rec.varCols[barcodeColIdx] || '').trim() : '';
      const rawCat = categoryColIdx >= 0 ? (rec.varCols[categoryColIdx] || '').trim() : '';

      const embeddedRefMatch = /^([A-Z0-9._/-]{2,18})\s*[-:|]\s*(.+)$/i.exec(rawDesig);
      if (embeddedRefMatch && /[A-Za-zÀ-ÿ]{3,}/.test(embeddedRefMatch[2])) {
        if (!rawRef) rawRef = embeddedRefMatch[1].trim();
        rawDesig = embeddedRefMatch[2].trim();
      }

      if (!rawDesig || rawDesig.length < 2 || isSqlOrBinaryGarbageString(rawDesig)) continue;

      const rawCost = costSlot ? Math.max(0, Math.round(costSlot.readValue(rec.fixedBuf) ?? 0)) : 0;
      const rawSale = saleSlot ? Math.max(0, Math.round(saleSlot.readValue(rec.fixedBuf) ?? 0)) : 0;
      const rawQty = qtySlot ? Math.max(0, Math.round(qtySlot.readValue(rec.fixedBuf) ?? 0)) : 0;

      const finalCost = rawCost > 0 && rawSale > 0 ? Math.min(rawCost, rawSale) : rawCost;
      const finalSale = rawCost > 0 && rawSale > 0 ? Math.max(rawCost, rawSale) : rawSale;

      const dedupKey = `${rawRef.toLowerCase()}|${rawDesig.toLowerCase()}`;
      if (seenKeys.has(dedupKey)) continue;
      seenKeys.add(dedupKey);

      const rowObj: Record<string, unknown> = {
        reference: rawRef || rawBarcode || `ART-${String(rows.length + 1).padStart(4, '0')}`,
        code_barre: rawBarcode,
        designation: rawDesig,
        prix_achat: finalCost,
        prix_vente: finalSale,
        quantite_stock: rawQty,
        categorie: rawCat || 'Stock Import .MDF',
      };

      for (let v = 0; v < maxVarCols; v++) {
        rowObj[`texte_col_${v + 1}`] = rec.varCols[v] || '';
      }
      for (let n = 0; n < chosenNumericSlots.length; n++) {
        const s = chosenNumericSlots[n];
        rowObj[`num_col_${n + 1}`] = Math.round((s.readValue(rec.fixedBuf) ?? 0) * 100) / 100;
      }

      rows.push(rowObj);
    }

    if (rows.length > 0) {
      const baseColumns = [
        'reference',
        'code_barre',
        'designation',
        'prix_achat',
        'prix_vente',
        'quantite_stock',
        'categorie',
      ];
      const extraVarCols = Array.from({ length: maxVarCols }, (_, i) => `texte_col_${i + 1}`);
      const extraNumCols = Array.from({ length: chosenNumericSlots.length }, (_, i) => `num_col_${i + 1}`);
      parsedTables.push({
        tableName: catalogTableName || `Articles & Stock #${tableCounter++} (${filename})`,
        columns: [...baseColumns, ...extraVarCols, ...extraNumCols],
        rows,
        tableRole: 'stock',
      });
    }
  }

  // Relational Auto-Enrichment across decoded SQL Server tables:
  // In POS databases (like nabils.mdf), current stock quantities live in Temp_Stock(ProductID, Qty) or Stock(ProductID, Qty)
  // and category names live in Category / SubCategory, while products live in Product(PID, ProductCode, ProductName, CostPrice, SellingPrice).
  const stockQtyByPid = new Map<string, number>();
  const stockBarcodeByPid = new Map<string, string>();
  const categoryNameById = new Map<string, string>();
  const subCategoryNameById = new Map<string, string>();

  for (const tbl of parsedTables) {
    if (/^(temp_stock|stock|stock_store|temp_stock_company)$/i.test(tbl.tableName)) {
      const pidCol = tbl.columns.find((c) => /^(productid|pid|product_id|id_article|articleid|code_article)$/i.test(c));
      const qtyCol = tbl.columns.find((c) => /^(qty|quantity|qte|quantite|stock|currentstock)$/i.test(c));
      const bcCol = tbl.columns.find((c) => /^(barcode|code_barre|ean)$/i.test(c));
      if (pidCol && qtyCol) {
        const isTempStock = /^temp_stock/i.test(tbl.tableName);
        for (const r of tbl.rows) {
          const key = String(r[pidCol] ?? '').trim().toLowerCase();
          const q = parseDzdNumber(r[qtyCol], 0);
          if (!key) continue;
          if (isTempStock || !stockQtyByPid.has(key)) {
            stockQtyByPid.set(key, q);
          } else {
            stockQtyByPid.set(key, (stockQtyByPid.get(key) || 0) + q);
          }
          if (bcCol && r[bcCol] && !stockBarcodeByPid.has(key)) {
            stockBarcodeByPid.set(key, String(r[bcCol]).trim());
          }
        }
      }
    } else if (/^category|categories|famille$/i.test(tbl.tableName)) {
      const idCol = tbl.columns.find((c) => /^(id|categoryid|catid|code)$/i.test(c)) || tbl.columns[0];
      const nameCol = tbl.columns.find((c) => /name|nom|libelle|categorie/i.test(c)) || tbl.columns[1];
      if (idCol && nameCol) {
        for (const r of tbl.rows) {
          const k = String(r[idCol] ?? '').trim();
          const v = String(r[nameCol] ?? '').trim();
          if (k && v) categoryNameById.set(k, v);
        }
      }
    } else if (/^subcategory|subcategories|sous_famille$/i.test(tbl.tableName)) {
      const idCol = tbl.columns.find((c) => /^(id|subcategoryid|subcatid)$/i.test(c)) || tbl.columns[0];
      const nameCol = tbl.columns.find((c) => /name|nom|libelle/i.test(c)) || tbl.columns[1];
      if (idCol && nameCol) {
        for (const r of tbl.rows) {
          const k = String(r[idCol] ?? '').trim();
          const v = String(r[nameCol] ?? '').trim();
          if (k && v) subCategoryNameById.set(k, v);
        }
      }
    }
  }

  for (const tbl of parsedTables) {
    if (/^(product|products|article|articles|produit|produits)$/i.test(tbl.tableName)) {
      const pidCol = tbl.columns.find((c) => /^(pid|productid|id|id_article)$/i.test(c));
      const existingQtyCol = tbl.columns.find((c) =>
        /^(qty|quantity|quantite_stock|qte|quantite|openingstock|stock)$/i.test(c),
      );
      const subCatIdCol = tbl.columns.find((c) => /^subcategoryid|subcatid$/i.test(c));
      const catIdCol = tbl.columns.find((c) => /^categoryid|catid$/i.test(c));
      const bcCol = tbl.columns.find((c) => /^barcode|code_barre$/i.test(c));

      if (stockQtyByPid.size > 0 && pidCol) {
        if (!tbl.columns.includes('Quantite_Stock')) {
          tbl.columns.push('Quantite_Stock');
        }
        for (const r of tbl.rows) {
          const pidKey = String(r[pidCol] ?? '').trim().toLowerCase();
          const joinedQty = stockQtyByPid.get(pidKey);
          const fallbackQty = existingQtyCol ? parseDzdNumber(r[existingQtyCol], 0) : 0;
          r['Quantite_Stock'] = joinedQty !== undefined ? joinedQty : fallbackQty;
          if (bcCol && !r[bcCol] && stockBarcodeByPid.has(pidKey)) {
            r[bcCol] = stockBarcodeByPid.get(pidKey);
          }
        }
      }

      if ((subCategoryNameById.size > 0 && subCatIdCol) || (categoryNameById.size > 0 && catIdCol)) {
        if (!tbl.columns.includes('Categorie')) {
          tbl.columns.push('Categorie');
        }
        for (const r of tbl.rows) {
          const subKey = subCatIdCol ? String(r[subCatIdCol] ?? '').trim() : '';
          const catKey = catIdCol ? String(r[catIdCol] ?? '').trim() : '';
          const resolvedName =
            (subKey && subCategoryNameById.get(subKey)) ||
            (catKey && categoryNameById.get(catKey)) ||
            '';
          if (resolvedName) {
            r['Categorie'] = resolvedName;
          }
        }
      }
    }
  }

  // Sort tables so the primary Product / Articles table comes first!
  parsedTables.sort((a, b) => {
    const aIsPrimaryProd = /^(product|products|article|articles|produit|produits)$/i.test(a.tableName) ? 1 : 0;
    const bIsPrimaryProd = /^(product|products|article|articles|produit|produits)$/i.test(b.tableName) ? 1 : 0;
    if (aIsPrimaryProd !== bIsPrimaryProd) return bIsPrimaryProd - aIsPrimaryProd;
    const aIsAcc = a.tableRole === 'accounting' ? 1 : 0;
    const bIsAcc = b.tableRole === 'accounting' ? 1 : 0;
    if (aIsAcc !== bIsAcc) return aIsAcc - bIsAcc;
    return b.rows.length - a.rows.length;
  });

  return parsedTables;
}

/**
 * Extracts structured UTF-16LE and UTF-8/Latin1 tokens with their offsets from non-8KB binary files
 * (such as WinDev .IDF / .FIC or custom POS files).
 */
function extractTokensFromMdfIdfBuffer(buffer: Buffer, maxTokens = 25000): ExtractedBinaryToken[] {
  const tokens: ExtractedBinaryToken[] = [];
  const scanLimit = Math.min(buffer.length, 40 * 1024 * 1024);

  let currentUtf16 = '';
  let utf16Start = 0;
  for (let i = 0; i + 1 < scanLimit && tokens.length < maxTokens; i += 2) {
    const lo = buffer[i];
    const hi = buffer[i + 1];
    const isAsciiPrintable = hi === 0x00 && lo >= 0x20 && lo <= 0x7e;
    const isLatin1Accent = hi === 0x00 && lo >= 0xc0 && lo <= 0xff;
    if (isAsciiPrintable || isLatin1Accent) {
      if (currentUtf16.length === 0) utf16Start = i;
      if (currentUtf16.length < 220) {
        currentUtf16 += String.fromCharCode((hi << 8) | lo);
      }
    } else {
      const trimmed = currentUtf16.trim();
      if (trimmed.length >= 3 && /[A-Za-z0-9]{2,}/.test(trimmed)) {
        tokens.push({
          text: trimmed,
          offset: utf16Start,
          nearbyInts: extractNearbyBinaryNumbers(buffer, utf16Start),
        });
      }
      currentUtf16 = '';
    }
  }

  let currentAscii = '';
  let asciiStart = 0;
  for (let i = 0; i < scanLimit && tokens.length < maxTokens; i++) {
    const b = buffer[i];
    const isPrintable = (b >= 0x20 && b <= 0x7e) || (b >= 0xc0 && b <= 0xff) || b === 0x09;
    if (isPrintable) {
      if (currentAscii.length === 0) asciiStart = i;
      if (currentAscii.length < 220) {
        currentAscii += String.fromCharCode(b);
      }
    } else {
      const trimmed = currentAscii.trim();
      if (trimmed.length >= 3 && /[A-Za-z0-9]{2,}/.test(trimmed)) {
        tokens.push({
          text: trimmed,
          offset: asciiStart,
          nearbyInts: extractNearbyBinaryNumbers(buffer, asciiStart),
        });
      }
      currentAscii = '';
    }
  }

  return tokens;
}

/**
 * Reconstructs Stock / Articles rows AND Accounting / Compta rows from raw .MDF / .IDF buffers.
 * First attempts authentic SQL Server 8KB Data Page FixedVar Record decoding so columns and prices are 100% exact.
 */
function parseBinaryMdfIdfBuffers(
  files: { buffer: Buffer; originalname: string }[],
): ParsedSourceTable[] {
  const tables: ParsedSourceTable[] = [];

  // 0. Authentic SQL Server 8KB Data Page FixedVar Decoder (primary .MDF files)
  for (const file of files) {
    // Do not treat .ldf transaction log as primary data pages if a .mdf file is present
    if (/\.ldf$/i.test(file.originalname) && files.some((f) => /\.(mdf|ndf)$/i.test(f.originalname))) {
      continue;
    }
    const pageTables = parseSqlServer8KbDataPages(file.buffer, file.originalname);
    for (const pt of pageTables) {
      tables.push(pt);
    }
  }

  if (tables.length > 0) {
    return tables;
  }

  // 1. Check if any file is actually a text file (SQL dump or clean CSV/TSV without binary NUL bytes)
  for (const file of files) {
    const isBinary = isLikelyBinaryBuffer(file.buffer);
    const text = decodeBufferText(file.buffer);

    if (/INSERT\s+(?:OR\s+\w+\s+|IGNORE\s+)?INTO\s+/i.test(text)) {
      const sqlTables = parseSqlDump(text);
      for (const st of sqlTables) tables.push(st);
      continue;
    }

    if (!isBinary) {
      const printableLines = text
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(
          (l) =>
            l.length >= 5 &&
            (l.includes(';') ||
              l.includes('\t') ||
              l.includes('|') ||
              (l.split(',').length >= 3 && /[A-Za-z]{3,}/.test(l))),
        );

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
  }

  if (tables.length > 0) {
    return tables;
  }

  // 2. Fallback Binary Token Extraction (for non-8KB proprietary POS files; skip .ldf if .mdf is present)
  const cleanTokens: ExtractedBinaryToken[] = [];
  for (const file of files) {
    if (/\.ldf$/i.test(file.originalname) && files.some((f) => /\.(mdf|ndf)$/i.test(f.originalname))) {
      continue;
    }
    const rawTokens = extractTokensFromMdfIdfBuffer(file.buffer);
    for (const item of rawTokens) {
      const t = item.text.replace(/\s+/g, ' ').trim();
      if (t.length < 2 || t.length > 160) continue;
      if (isSqlOrBinaryGarbageString(t)) continue;
      if (!/[A-Za-z0-9]{2,}/.test(t)) continue;
      const alnumCount = (t.match(/[A-Za-z0-9À-ÿ]/g) || []).length;
      if (alnumCount / t.length < 0.6) continue;
      if (/[^A-Za-z0-9À-ÿ\s.,/#&()+'_-]/.test(t)) continue;
      cleanTokens.push({ text: t, offset: item.offset, nearbyInts: item.nearbyInts });
    }
  }

  const stockRows: Record<string, unknown>[] = [];
  const accountingRows: Record<string, unknown>[] = [];
  const seenNames = new Set<string>();

  const ACCOUNTING_KEYWORDS =
    /\b(facture|vente|encaissement|caisse|achat|fournisseur|charge|depense|loyer|salaire|reglement|bon\s+de|versement|avoir|recette|bilan|compta|paiement|client|ticket)\b/i;
  const CATEGORY_KEYWORDS =
    /\b(accessoire|cable|chargeur|ecouteur|casque|coque|protection|incassable|batterie|powerbank|manette|gaming|console|ps4|ps5|xbox|abonnement|iptv|netflix|spotify|telephone|smartphone|afficheur|connecteur|piece|reparation|support|montre|smartwatch|airpods|earbuds|speaker|baffle|carte|adaptateur|hub|souris|clavier|micro)\b/i;
  const BRAND_KEYWORDS =
    /\b(apple|iphone|samsung|xiaomi|redmi|oppo|realme|huawei|honor|anker|baseus|joyroom|hoco|oraimo|sony|jbl|logitech|razer|nintendo|lenovo|asus|hp|dell|infinix|tecno|condor)\b/i;

  let idx = 0;
  let generatedSkuCounter = 1;
  let generatedAccCounter = 1;
  let pendingCodeToken = '';

  while (idx < cleanTokens.length) {
    const tokenObj = cleanTokens[idx];
    const token = tokenObj.text;

    // If this token is a short code / reference (no spaces, <= 18 chars, has digits or uppercase code format),
    // save it as pendingCodeToken for the next descriptive designation instead of turning it into a product name!
    const looksLikeShortReferenceCode =
      !/\s/.test(token) &&
      token.length >= 2 &&
      token.length <= 20 &&
      (/\d/.test(token) || /^[A-Z0-9._/-]+$/.test(token)) &&
      !CATEGORY_KEYWORDS.test(token) &&
      !BRAND_KEYWORDS.test(token);

    if (looksLikeShortReferenceCode) {
      pendingCodeToken = token;
      idx++;
      continue;
    }

    // Case A: Token itself is a delimited record (separated by ; | \t)
    if (
      (token.includes(';') || token.includes('|') || token.includes('\t')) &&
      token.split(/[;|\t]/).length >= 3
    ) {
      const parts = token
        .split(/[;|\t]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const codePart = parts.find((p) => !/\s/.test(p) && /\d/.test(p) && p.length <= 20) || pendingCodeToken;
      const namePart =
        parts.find((p) => p !== codePart && /[A-Za-zÀ-ÿ]{3,}/.test(p) && !/^\d+$/.test(p)) || parts[0];
      const numericParts = parts
        .filter((p) => /^\d+([.,]\d+)?$/.test(p.replace(/\s/g, '')))
        .map((n) => Math.round(Number(n.replace(',', '.'))));

      if (ACCOUNTING_KEYWORDS.test(token)) {
        const amount = numericParts.find((n) => n >= 50) || 0;
        const cost = numericParts.find((n) => n >= 50 && n < amount) || 0;
        if (amount > 0) {
          accountingRows.push({
            reference: codePart || `CPT-MDF-${String(generatedAccCounter++).padStart(4, '0')}`,
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
        }
      } else if (namePart && namePart.length >= 3 && !isSqlOrBinaryGarbageString(namePart)) {
        const sortedPrices = numericParts.filter((n) => n >= 50 && n <= 5000000).sort((a, b) => a - b);
        const qty = numericParts.find((n) => n >= 0 && n < 500 && !sortedPrices.includes(n)) ?? 0;
        const costPrice = sortedPrices.length >= 2 ? sortedPrices[0] : 0;
        const salePrice =
          sortedPrices.length >= 2 ? sortedPrices[sortedPrices.length - 1] : sortedPrices[0] || 0;

        const normKey = namePart.toLowerCase();
        if (!seenNames.has(normKey) && stockRows.length < 3000) {
          seenNames.add(normKey);
          stockRows.push({
            reference: codePart || `MDF-${String(generatedSkuCounter++).padStart(4, '0')}`,
            code_barre: parts.find((p) => /^\d{8,14}$/.test(p)) || '',
            designation: namePart,
            categorie: CATEGORY_KEYWORDS.exec(namePart)?.[0] || 'Stock Import .MDF/.IDF',
            marque: BRAND_KEYWORDS.exec(namePart)?.[0] || '',
            prix_achat: costPrice,
            prix_vente: salePrice,
            quantite_stock: qty,
          });
        }
      }
      pendingCodeToken = '';
      idx++;
      continue;
    }

    // Case B: Descriptive product designation (must contain real words, NOT a pure reference code)
    const words = token.split(/\s+/);
    const hasReadableWords = words.some((w) => /^[A-Za-zÀ-ÿ]{3,}$/.test(w));
    const isDescriptiveName =
      hasReadableWords &&
      !/^\d+$/.test(token) &&
      token.length >= 4 &&
      token.length <= 120 &&
      !isSqlOrBinaryGarbageString(token);

    if (isDescriptiveName) {
      const windowTokens = cleanTokens.slice(idx + 1, idx + 8);
      let skuCandidate = pendingCodeToken;
      let barcodeCandidate = /^\d{8,14}$/.test(pendingCodeToken) ? pendingCodeToken : '';
      const numbers: number[] = [...tokenObj.nearbyInts];

      let consumed = 0;
      for (const wtObj of windowTokens) {
        const wt = wtObj.text;
        if (/^\d{8,14}$/.test(wt) && !barcodeCandidate) {
          barcodeCandidate = wt;
          consumed++;
        } else if (
          !/\s/.test(wt) &&
          /^[A-Z0-9._/-]{2,18}$/i.test(wt) &&
          /\d/.test(wt) &&
          !/^\d+$/.test(wt) &&
          !skuCandidate
        ) {
          skuCandidate = wt;
          consumed++;
        } else if (/^\d+([.,]\d{1,2})?$/.test(wt.replace(/\s/g, ''))) {
          const val = Math.round(Number(wt.replace(/\s/g, '').replace(',', '.')));
          if (Number.isFinite(val) && val >= 0 && val <= 50000000) {
            numbers.push(val);
            consumed++;
          }
        } else if (/[A-Za-zÀ-ÿ]{4,}/.test(wt)) {
          break;
        }
      }

      if (ACCOUNTING_KEYWORDS.test(token)) {
        const amount = numbers.find((n) => n >= 100) || 0;
        const cost = numbers.find((n) => n >= 50 && n < amount) || 0;
        if (amount > 0) {
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
        }
        pendingCodeToken = '';
        idx += 1 + consumed;
        continue;
      }

      const prices = numbers.filter((n) => n >= 100 && n <= 2000000).sort((a, b) => a - b);
      const smallNums = numbers.filter((n) => n >= 0 && n < 500 && !prices.includes(n));
      const stockQuantity = smallNums[0] ?? 0;
      const salePrice = prices.length >= 2 ? prices[prices.length - 1] : prices[0] || 0;
      const costPrice = prices.length >= 2 ? prices[0] : 0;

      let cleanDesignation = token;
      const embeddedRef = /^([A-Z0-9._/-]{2,18})\s*[-:|]\s*(.+)$/i.exec(cleanDesignation);
      if (embeddedRef && /[A-Za-zÀ-ÿ]{3,}/.test(embeddedRef[2])) {
        if (!skuCandidate) skuCandidate = embeddedRef[1].trim();
        cleanDesignation = embeddedRef[2].trim();
      }

      const normKey = cleanDesignation.toLowerCase();
      if (!seenNames.has(normKey) && !isSqlOrBinaryGarbageString(cleanDesignation) && stockRows.length < 3000) {
        seenNames.add(normKey);
        stockRows.push({
          reference: skuCandidate || `MDF-${String(generatedSkuCounter++).padStart(4, '0')}`,
          code_barre: barcodeCandidate || '',
          designation: cleanDesignation,
          categorie: CATEGORY_KEYWORDS.exec(cleanDesignation)?.[0] || 'Catalogue .MDF / .IDF',
          marque: BRAND_KEYWORDS.exec(cleanDesignation)?.[0] || '',
          prix_achat: costPrice,
          prix_vente: salePrice,
          quantite_stock: stockQuantity,
        });
      }
      pendingCodeToken = '';
      idx += 1 + consumed;
      continue;
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
      /compta|vente|factur|caisse|journal|ecritur|achat|depens|charge|reglement|mouvement|recette|ledger|invoice|purchase|payment|voucher/i.test(
        table.tableName,
      );

    const normCols = table.columns.map((c) => ({ raw: c, norm: normalizeHeader(c) }));
    const findCol = (aliases: string[]) =>
      normCols.find((c) => aliases.some((a) => c.norm === a || c.norm.includes(a)))?.raw;

    const amountCol = findCol([
      'montant_dzd',
      'montant',
      'total_ttc',
      'totalamount',
      'grandtotal',
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
      'accledger',
      'particulars',
      'narration',
      'objet',
      'motif',
      'description',
      'operation',
      'designation',
      'intitule',
    ]);
    const refCol = findCol(['reference', 'invoiceno', 'num_facture', 'numero', 'num_piece', 'code', 'id']);
    const typeCol = findCol(['type', 'nature', 'sens', 'categorie_compta', 'ledgertype']);
    const partnerCol = findCol([
      'client_fournisseur',
      'customername',
      'suppliername',
      'name',
      'client',
      'fournisseur',
      'tiers',
      'partenaire',
      'nom_client',
    ]);
    const costCol = findCol(['cout_achat_dzd', 'cout', 'prix_achat', 'pa', 'debit_achat']);
    const marginCol = findCol(['marge_dzd', 'marge', 'benefice', 'profit']);

    if (isAccTable && amountCol) {
      table.rows.slice(0, 500).forEach((row, idx) => {
        const amount = parseDzdNumber(row[amountCol], 0);
        if (amount <= 0) return;
        const rawType = typeCol ? String(row[typeCol] ?? '').toLowerCase() : table.tableName.toLowerCase();
        let entryType: NormalizedAccountingEntry['entryType'] = 'sale';
        let category = 'Ventes & Encaissements';
        if (/achat|fournisseur|appro|purchase|supplier/i.test(rawType)) {
          entryType = 'purchase';
          category = 'Achats Fournisseurs & Stock';
        } else if (/charge|depens|frais|loyer|salaire|expense/i.test(rawType)) {
          entryType = 'expense';
          category = 'Charges & Dépenses';
        }

        const cost = costCol ? parseDzdNumber(row[costCol], 0) : 0;
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
  if (stockRows.length > 0) {
    const byCategory = new Map<
      string,
      { count: number; units: number; totalCostDzd: number; totalSaleDzd: number }
    >();

    for (const row of stockRows) {
      let name = mapping.name ? String(row[mapping.name] ?? '').trim() : '';
      if (!name) continue;
      const qty = mapping.stockQuantity ? parseDzdNumber(row[mapping.stockQuantity], 0) : 0;
      const salePrice = mapping.priceDzd ? parseDzdNumber(row[mapping.priceDzd], 0) : 0;
      const costPrice = mapping.costPriceDzd ? parseDzdNumber(row[mapping.costPriceDzd], 0) : 0;
      const cat =
        (mapping.categoryName && String(row[mapping.categoryName] ?? '').trim()) ||
        'Stock Général (.MDF / .IDF)';

      const effQty = Math.max(0, qty);
      const prev = byCategory.get(cat) || { count: 0, units: 0, totalCostDzd: 0, totalSaleDzd: 0 };
      prev.count += 1;
      prev.units += effQty;
      prev.totalCostDzd += effQty * costPrice;
      prev.totalSaleDzd += effQty * salePrice;
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

  // 4. Only attempt plain text formats if the buffer is NOT binary (or if it contains explicit SQL INSERTs)
  const isBinary = isLikelyBinaryBuffer(buffer);
  const trimmedText = decodeBufferText(buffer).trim();

  if (!isBinary && (declaredFormat === 'json' || trimmedText.startsWith('{') || trimmedText.startsWith('['))) {
    try {
      const json = JSON.parse(trimmedText);
      const tables = extractBestArrayFromObject(json, 'articles');
      if (tables.length > 0) return { format: declaredFormat, tables };
    } catch {
      // Not valid JSON
    }
  }

  if (
    !isBinary &&
    (declaredFormat === 'xml' || trimmedText.startsWith('<?xml') || /^<[a-zA-Z0-9_:-]+>/.test(trimmedText))
  ) {
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

  if (!isBinary && (declaredFormat === 'csv' || declaredFormat === 'tsv')) {
    const parsed = parseDelimitedText(trimmedText, declaredFormat === 'tsv' ? '\t' : undefined);
    if (parsed.rows.length > 0) return { format: declaredFormat, tables: [parsed] };
  }

  if (declaredFormat === 'sqlite') {
    try {
      const tables = await parseSqliteBuffer(buffer);
      if (tables.length > 0) return { format: 'sqlite', tables };
    } catch {
      // Fall through to binary scanner
    }
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
    hasMdf && hasIdf ? 'mdf_idf' : detectFormatFromFilename(files[0].originalname);

  const allTables: ParsedSourceTable[] = [];

  for (const f of files) {
    // Skip .ldf SQL Server transaction log if a primary .mdf database file is already provided
    if (/\.ldf$/i.test(f.originalname) && hasMdf) {
      continue;
    }
    try {
      const res = await parseSingleFileToTables(f.buffer, f.originalname);
      for (const t of res.tables) {
        const displayTableName =
          files.length > 1 && !t.tableName.includes(f.originalname)
            ? `${t.tableName} (${f.originalname})`
            : t.tableName;
        if (!allTables.some((existing) => existing.tableName === displayTableName)) {
          allTables.push({ ...t, tableName: displayTableName });
        }
      }
    } catch {
      // Continue
    }
  }

  if (allTables.length === 0 && files.length > 1) {
    try {
      const combinedBinary = parseBinaryMdfIdfBuffers(files);
      for (const ct of combinedBinary) {
        allTables.push(ct);
      }
    } catch {
      // Ignore
    }
  }

  if (allTables.length === 0) {
    throw new Error(
      'Aucune donnée exploitable trouvée dans ces fichiers. Vérifiez vos fichiers .mdf et .idf.',
    );
  }

  let selected = allTables.find((t) => t.tableName === preferredTable);
  if (!selected) {
    selected = [...allTables].sort((a, b) => {
      const aIsAcc = a.tableRole === 'accounting' ? 1 : 0;
      const bIsAcc = b.tableRole === 'accounting' ? 1 : 0;
      if (aIsAcc !== bIsAcc) return aIsAcc - bIsAcc;
      const aMatch = /prod|articl|stock|item|invent/i.test(a.tableName) ? 1 : 0;
      const bMatch = /prod|articl|stock|item|invent/i.test(b.tableName) ? 1 : 0;
      if (aMatch !== bMatch) return bMatch - aMatch;
      return b.rows.length - a.rows.length;
    })[0];
  }

  const suggestedMapping = suggestColumnMapping(selected.columns, selected.rows);
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
  if (value === null || value === undefined || value === '') return fallback;
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
  syncMode: StockSyncMode = 'full_sync',
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

  const excludedNameKeys = new Set(
    [
      mapping.sku,
      mapping.barcode,
      mapping.priceDzd,
      mapping.costPriceDzd,
      mapping.stockQuantity,
      'reference',
      'sku',
      'code',
      'code_article',
      'code_barre',
      'barcode',
      'id',
    ]
      .filter(Boolean)
      .map((k) => String(k).toLowerCase()),
  );

  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    let rawName = mapping.name ? String(row[mapping.name] ?? '').trim() : '';

    // Fallback: if the mapped designation column is empty for this row, find a descriptive text column (NEVER the reference/SKU column!)
    if (!rawName) {
      for (const [k, val] of Object.entries(row)) {
        if (excludedNameKeys.has(k.toLowerCase())) continue;
        const str = String(val ?? '').trim();
        if (str.length >= 3 && /[A-Za-zÀ-ÿ]{3,}/.test(str)) {
          rawName = str;
          break;
        }
      }
    }

    if (!rawName) {
      errors.push({ rowIndex, reason: 'Désignation d’article manquante' });
      return;
    }

    let rawSku = mapping.sku ? String(row[mapping.sku] ?? '').trim() : '';
    const rawBarcode = mapping.barcode ? String(row[mapping.barcode] ?? '').trim() : '';

    // If rawName still begins with "REF - Designation" and rawSku is empty or generic, split them cleanly
    const embeddedPrefix = /^([A-Z0-9._/-]{2,18})\s*[-:|]\s*(.+)$/i.exec(rawName);
    if (embeddedPrefix && /[A-Za-zÀ-ÿ]{3,}/.test(embeddedPrefix[2])) {
      if (!rawSku || /^ART-\d+$|^MDF-\d+$/i.test(rawSku)) {
        rawSku = embeddedPrefix[1].trim();
      }
      rawName = embeddedPrefix[2].trim();
    }

    const normalizedNameKey = normalizeMatchKey(rawName);
    const derivedSku =
      rawSku ||
      rawBarcode ||
      `ART-${normalizedNameKey.slice(0, 8).toUpperCase() || 'STK'}-${String(rowIndex).padStart(4, '0')}`;

    const dedupKey = normalizeMatchKey(`${rawSku}|${rawName}`);
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

    // Keep the EXACT prices and quantities from the database row (never invent fake 1500 / 2200 / 10 values!)
    const rawSalePrice = mapping.priceDzd ? parseDzdNumber(row[mapping.priceDzd], 0) : 0;
    const rawCostPrice = mapping.costPriceDzd ? parseDzdNumber(row[mapping.costPriceDzd], 0) : 0;
    const rawQty = mapping.stockQuantity ? parseDzdNumber(row[mapping.stockQuantity], 0) : 0;

    const incoming: NormalizedImportProduct = {
      rowIndex,
      sku: derivedSku,
      barcode: rawBarcode || null,
      externalRef: rawSku || rawBarcode || normalizedNameKey,
      name: rawName,
      priceDzd: rawSalePrice,
      costPriceDzd: rawCostPrice,
      stockQuantity: Math.max(0, rawQty),
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
