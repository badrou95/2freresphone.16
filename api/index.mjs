// Auto-generated pure ESM bundle for Vercel Serverless Functions (zero .ts imports at runtime)
var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server.ts
import "dotenv/config";
import express from "express";
import multer from "multer";
import path2 from "path";
import { fileURLToPath } from "url";
import { and as and2, asc, desc, eq as eq4, inArray, sql as sql2 } from "drizzle-orm";

// src/db/index.ts
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// src/db/schema.ts
var schema_exports = {};
__export(schema_exports, {
  adminUsers: () => adminUsers,
  carriers: () => carriers,
  categories: () => categories,
  categoriesRelations: () => categoriesRelations,
  customers: () => customers,
  digitalDeliveries: () => digitalDeliveries,
  importMappingProfiles: () => importMappingProfiles,
  mediaAssets: () => mediaAssets,
  orderItems: () => orderItems,
  orderItemsRelations: () => orderItemsRelations,
  orderStatusHistory: () => orderStatusHistory,
  orders: () => orders,
  ordersRelations: () => ordersRelations,
  productImages: () => productImages,
  productImagesRelations: () => productImagesRelations,
  productReviews: () => productReviews,
  products: () => products,
  productsRelations: () => productsRelations,
  promotions: () => promotions,
  returns: () => returns,
  sales: () => sales,
  shippingRates: () => shippingRates,
  socialLinks: () => socialLinks,
  stockAlerts: () => stockAlerts,
  stockImports: () => stockImports,
  stockMovements: () => stockMovements,
  storeSettings: () => storeSettings
});
import { relations } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp
} from "drizzle-orm/pg-core";
var adminUsers = pgTable("admin_users", {
  id: serial("id").primaryKey(),
  uid: text("uid").unique(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull().default("Administrateur 2Fr\xE8res Phone"),
  role: text("role").notNull().default("super_admin"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var mediaAssets = pgTable("media_assets", {
  id: serial("id").primaryKey(),
  filename: text("filename").notNull(),
  mimeType: text("mime_type").notNull(),
  dataBase64: text("data_base64").notNull(),
  sizeBytes: integer("size_bytes").notNull().default(0),
  kind: text("kind").notNull().default("product"),
  // 'logo' | 'product' | 'other'
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var storeSettings = pgTable("store_settings", {
  id: serial("id").primaryKey(),
  storeName: text("store_name").notNull().default("2Fr\xE8res Phone"),
  tagline: text("tagline").notNull().default("Accessoires t\xE9l\xE9phoniques, Gaming & Services num\xE9riques en Alg\xE9rie"),
  logoUrl: text("logo_url"),
  whatsappPhone: text("whatsapp_phone").notNull().default("+213550000000"),
  supportEmail: text("support_email").notNull().default("contact@2freresphone.dz"),
  adminAlertEmail: text("admin_alert_email").notNull().default("badroumc@gmail.com"),
  defaultLowStockThreshold: integer("default_low_stock_threshold").notNull().default(10),
  currency: text("currency").notNull().default("DZD"),
  storeAddress: text("store_address").notNull().default("Alg\xE9rie"),
  codEnabled: boolean("cod_enabled").notNull().default(true),
  digitalOrderNote: text("digital_order_note").notNull().default("Livraison et activation num\xE9rique apr\xE8s validation de la commande et du paiement."),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  categoryGroup: text("category_group").notNull().default("accessories"),
  // 'accessories' | 'gaming' | 'digital'
  description: text("description"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var products = pgTable("products", {
  id: serial("id").primaryKey(),
  categoryId: integer("category_id").references(() => categories.id, { onDelete: "set null" }),
  sku: text("sku").notNull().unique(),
  barcode: text("barcode"),
  externalRef: text("external_ref"),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  brand: text("brand"),
  shortDescription: text("short_description"),
  description: text("description").notNull().default(""),
  productType: text("product_type").notNull().default("physical"),
  // 'physical' | 'digital'
  priceDzd: integer("price_dzd").notNull().default(0),
  compareAtPriceDzd: integer("compare_at_price_dzd"),
  costPriceDzd: integer("cost_price_dzd").notNull().default(0),
  stockQuantity: integer("stock_quantity").notNull().default(0),
  lowStockThreshold: integer("low_stock_threshold"),
  // null => uses store_settings.defaultLowStockThreshold
  isFeatured: boolean("is_featured").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  digitalAvailability: text("digital_availability").default("available"),
  // 'available' | 'limited' | 'paused'
  digitalActivationTemplate: text("digital_activation_template"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var productImages = pgTable("product_images", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  url: text("url").notNull(),
  altText: text("alt_text").notNull().default(""),
  sortOrder: integer("sort_order").notNull().default(0),
  isPrimary: boolean("is_primary").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var carriers = pgTable("carriers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  code: text("code").notNull().unique(),
  supportsHome: boolean("supports_home").notNull().default(true),
  supportsStopDesk: boolean("supports_stop_desk").notNull().default(true),
  apiProvider: text("api_provider").notNull().default("manual"),
  // 'manual' | 'yalidine' | 'zrexpress' | 'noest' | 'ecotrack' | 'maystro'
  apiEndpoint: text("api_endpoint"),
  apiConfigured: boolean("api_configured").notNull().default(false),
  notes: text("notes"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var shippingRates = pgTable("shipping_rates", {
  id: serial("id").primaryKey(),
  carrierId: integer("carrier_id").references(() => carriers.id, { onDelete: "cascade" }).notNull(),
  wilayaCode: text("wilaya_code").notNull(),
  wilayaName: text("wilaya_name").notNull(),
  homePriceDzd: integer("home_price_dzd").notNull().default(0),
  stopDeskPriceDzd: integer("stop_desk_price_dzd").notNull().default(0),
  estimatedDays: text("estimated_days").notNull().default("24-48h"),
  isActive: boolean("is_active").notNull().default(true),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var customers = pgTable("customers", {
  id: serial("id").primaryKey(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull().unique(),
  wilayaCode: text("wilaya_code").notNull().default("16"),
  wilayaName: text("wilaya_name").notNull().default("Alger"),
  commune: text("commune").notNull().default(""),
  address: text("address").notNull().default(""),
  isBlocked: boolean("is_blocked").notNull().default(false),
  notes: text("notes").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var orders = pgTable("orders", {
  id: serial("id").primaryKey(),
  reference: text("reference").notNull().unique(),
  customerId: integer("customer_id").references(() => customers.id, { onDelete: "set null" }),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone").notNull(),
  wilayaCode: text("wilaya_code").notNull(),
  wilayaName: text("wilaya_name").notNull(),
  commune: text("commune").notNull(),
  address: text("address").notNull(),
  deliveryType: text("delivery_type").notNull().default("home"),
  // 'home' | 'stop_desk' | 'digital'
  carrierId: integer("carrier_id").references(() => carriers.id, { onDelete: "set null" }),
  carrierName: text("carrier_name"),
  trackingNumber: text("tracking_number"),
  status: text("status").notNull().default("nouvelle"),
  // nouvelle | a_confirmer | confirmee | en_preparation | expediee | livree | annulee | retournee
  paymentMethod: text("payment_method").notNull().default("cod"),
  // 'cod' | 'manual_digital'
  paymentStatus: text("payment_status").notNull().default("pending"),
  // 'pending' | 'paid' | 'refunded'
  promoCode: text("promo_code"),
  subtotalDzd: integer("subtotal_dzd").notNull().default(0),
  discountDzd: integer("discount_dzd").notNull().default(0),
  shippingFeeDzd: integer("shipping_fee_dzd").notNull().default(0),
  totalDzd: integer("total_dzd").notNull().default(0),
  hasDigitalItems: boolean("has_digital_items").notNull().default(false),
  hasPhysicalItems: boolean("has_physical_items").notNull().default(true),
  stockDeducted: boolean("stock_deducted").notNull().default(false),
  source: text("source").notNull().default("web"),
  // 'web' | 'whatsapp' | 'admin'
  customerNotes: text("customer_notes"),
  adminNotes: text("admin_notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var orderItems = pgTable("order_items", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull().default(""),
  productType: text("product_type").notNull().default("physical"),
  unitPriceDzd: integer("unit_price_dzd").notNull(),
  costPriceDzd: integer("cost_price_dzd").notNull().default(0),
  quantity: integer("quantity").notNull().default(1),
  lineTotalDzd: integer("line_total_dzd").notNull()
});
var orderStatusHistory = pgTable("order_status_history", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  fromStatus: text("from_status"),
  toStatus: text("to_status").notNull(),
  note: text("note"),
  changedBy: text("changed_by").notNull().default("system"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var sales = pgTable("sales", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull().unique(),
  orderReference: text("order_reference").notNull(),
  customerName: text("customer_name").notNull(),
  wilayaName: text("wilaya_name").notNull(),
  itemsRevenueDzd: integer("items_revenue_dzd").notNull().default(0),
  discountDzd: integer("discount_dzd").notNull().default(0),
  shippingFeeDzd: integer("shipping_fee_dzd").notNull().default(0),
  costOfGoodsDzd: integer("cost_of_goods_dzd").notNull().default(0),
  totalCollectedDzd: integer("total_collected_dzd").notNull().default(0),
  estimatedMarginDzd: integer("estimated_margin_dzd").notNull().default(0),
  recordedAt: timestamp("recorded_at").defaultNow().notNull()
});
var stockImports = pgTable("stock_imports", {
  id: serial("id").primaryKey(),
  fileName: text("file_name").notNull(),
  fileFormat: text("file_format").notNull(),
  sourceTableOrSheet: text("source_table_or_sheet"),
  syncMode: text("sync_mode").notNull().default("add_only"),
  // 'add_only' | 'add_and_update_stock' | 'full_sync'
  totalRows: integer("total_rows").notNull().default(0),
  addedCount: integer("added_count").notNull().default(0),
  updatedCount: integer("updated_count").notNull().default(0),
  skippedCount: integer("skipped_count").notNull().default(0),
  errorCount: integer("error_count").notNull().default(0),
  summaryJson: text("summary_json"),
  importedBy: text("imported_by").notNull().default("admin"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var importMappingProfiles = pgTable("import_mapping_profiles", {
  id: serial("id").primaryKey(),
  profileName: text("profile_name").notNull().unique(),
  sourceFormat: text("source_format").notNull(),
  tableOrSheetName: text("table_or_sheet_name"),
  columnMappingJson: text("column_mapping_json").notNull(),
  defaultSyncMode: text("default_sync_mode").notNull().default("add_only"),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var stockMovements = pgTable("stock_movements", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  importId: integer("import_id").references(() => stockImports.id, { onDelete: "set null" }),
  delta: integer("delta").notNull(),
  previousQty: integer("previous_qty").notNull(),
  newQty: integer("new_qty").notNull(),
  reason: text("reason").notNull(),
  createdBy: text("created_by").notNull().default("system"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var stockAlerts = pgTable("stock_alerts", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  productName: text("product_name").notNull(),
  productSku: text("product_sku").notNull(),
  currentStock: integer("current_stock").notNull(),
  thresholdUsed: integer("threshold_used").notNull(),
  status: text("status").notNull().default("active"),
  // 'active' | 'resolved'
  emailStatus: text("email_status").notNull().default("pending"),
  // 'sent' | 'not_configured' | 'failed' | 'pending'
  emailRecipient: text("email_recipient"),
  emailError: text("email_error"),
  notifiedAt: timestamp("notified_at").defaultNow().notNull(),
  resolvedAt: timestamp("resolved_at")
});
var productReviews = pgTable("product_reviews", {
  id: serial("id").primaryKey(),
  productId: integer("product_id").references(() => products.id, { onDelete: "cascade" }).notNull(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "set null" }),
  orderReference: text("order_reference").notNull(),
  customerName: text("customer_name").notNull(),
  customerPhone: text("customer_phone").notNull(),
  rating: integer("rating").notNull(),
  // 1..5
  title: text("title").notNull().default(""),
  comment: text("comment").notNull(),
  isVerifiedPurchase: boolean("is_verified_purchase").notNull().default(true),
  status: text("status").notNull().default("pending"),
  // 'pending' | 'approved' | 'rejected'
  adminReply: text("admin_reply"),
  moderatedAt: timestamp("moderated_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var returns = pgTable("returns", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  orderReference: text("order_reference").notNull(),
  customerName: text("customer_name").notNull(),
  phone: text("phone").notNull(),
  wilayaName: text("wilaya_name").notNull(),
  reason: text("reason").notNull().default("Client injoignable"),
  condition: text("condition").notNull().default("intact"),
  // 'intact' | 'damaged' | 'missing_parts'
  restocked: boolean("restocked").notNull().default(false),
  returnFeeDzd: integer("return_fee_dzd").notNull().default(0),
  status: text("status").notNull().default("en_cours"),
  // 'en_cours' | 'recu' | 'reintegre' | 'cloture'
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var promotions = pgTable("promotions", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description").notNull().default(""),
  discountType: text("discount_type").notNull().default("percent"),
  // 'percent' | 'fixed' | 'free_shipping'
  discountValue: integer("discount_value").notNull().default(0),
  minOrderDzd: integer("min_order_dzd").notNull().default(0),
  maxUses: integer("max_uses"),
  usedCount: integer("used_count").notNull().default(0),
  startsAt: timestamp("starts_at"),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var digitalDeliveries = pgTable("digital_deliveries", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").references(() => orders.id, { onDelete: "cascade" }).notNull(),
  orderItemId: integer("order_item_id").references(() => orderItems.id, { onDelete: "cascade" }).notNull(),
  productId: integer("product_id").references(() => products.id, { onDelete: "set null" }),
  productName: text("product_name").notNull(),
  deliveryStatus: text("delivery_status").notNull().default("pending"),
  // 'pending' | 'payment_verified' | 'delivered' | 'cancelled'
  activationInstructions: text("activation_instructions").notNull().default(""),
  privateFulfillmentNote: text("private_fulfillment_note").notNull().default(""),
  deliveredBy: text("delivered_by"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var socialLinks = pgTable("social_links", {
  id: serial("id").primaryKey(),
  platform: text("platform").notNull(),
  // 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'snapchat' | 'telegram'
  label: text("label").notNull(),
  urlOrHandle: text("url_or_handle").notNull(),
  pixelId: text("pixel_id"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0)
});
var categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products)
}));
var productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id]
  }),
  images: many(productImages),
  reviews: many(productReviews)
}));
var productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id]
  })
}));
var ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  history: many(orderStatusHistory)
}));
var orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id]
  })
}));

// src/db/index.ts
var createPool = () => {
  if (!global._postgresPool) {
    if (process.env.SQL_HOST) {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        ...process.env.SQL_PORT ? { port: Number(process.env.SQL_PORT) } : {},
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        ssl: process.env.SQL_SSL === "true" ? { rejectUnauthorized: false } : void 0,
        max: 10,
        connectionTimeoutMillis: 15e3
      });
    } else if (process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED) {
      global._postgresPool = new Pool({
        connectionString: process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED,
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15e3
      });
    } else if (process.env.PGHOST) {
      global._postgresPool = new Pool({
        host: process.env.PGHOST,
        port: process.env.PGPORT ? Number(process.env.PGPORT) : 5432,
        user: process.env.PGUSER,
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE,
        ssl: { rejectUnauthorized: false },
        max: 10,
        connectionTimeoutMillis: 15e3
      });
    } else {
      global._postgresPool = new Pool({
        host: process.env.SQL_HOST,
        user: process.env.SQL_USER,
        password: process.env.SQL_PASSWORD,
        database: process.env.SQL_DB_NAME,
        max: 10,
        connectionTimeoutMillis: 5e3
      });
    }
    global._postgresPool.on("error", (err) => {
      console.error("Unexpected error on idle SQL pool client:", err);
    });
  }
  return global._postgresPool;
};
function hasDatabaseConfig() {
  return Boolean(
    process.env.SQL_HOST || process.env.POSTGRES_URL || process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL || process.env.POSTGRES_URL_NON_POOLING || process.env.DATABASE_URL_UNPOOLED || process.env.PGHOST
  );
}
var pool = createPool();
var db = drizzle(pool, { schema: schema_exports });

// src/middleware/auth.ts
import { eq } from "drizzle-orm";

// src/lib/firebase-admin.ts
import fs from "fs";
import path from "path";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
function resolveFirebaseProjectId() {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  const candidates = [
    path.resolve(process.cwd(), "firebase-applet-config.json"),
    path.resolve(process.cwd(), "..", "firebase-applet-config.json")
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
        if (parsed?.projectId) return String(parsed.projectId);
      }
    } catch {
    }
  }
  return "xenon-tempest-nq7xb";
}
if (!getApps().length) {
  initializeApp({
    projectId: resolveFirebaseProjectId()
  });
}
var adminAuth = getAuth();

// src/middleware/auth.ts
var INITIAL_ADMIN_EMAILS = Array.from(
  new Set(
    [
      (process.env.INITIAL_ADMIN_EMAIL || "badroumc@gmail.com").toLowerCase(),
      "badroumc@gmail.com",
      "tigrine156@gmail.com"
    ].filter(Boolean)
  )
);
async function getOrCreateAdminRecord(decoded) {
  const email = (decoded.email || "").toLowerCase();
  if (!email) return null;
  const existing = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
  if (existing.length > 0) {
    const rec = existing[0];
    if (!rec.isActive) return null;
    if (!rec.uid) {
      const [updated] = await db.update(adminUsers).set({
        uid: decoded.uid,
        fullName: decoded.name || rec.fullName
      }).where(eq(adminUsers.id, rec.id)).returning();
      return updated;
    }
    return rec;
  }
  if (INITIAL_ADMIN_EMAILS.includes(email)) {
    const [created] = await db.insert(adminUsers).values({
      uid: decoded.uid,
      email,
      fullName: decoded.name || "Administrateur 2Fr\xE8res Phone",
      role: "super_admin",
      isActive: true
    }).onConflictDoUpdate({
      target: adminUsers.email,
      set: {
        uid: decoded.uid,
        fullName: decoded.name || "Administrateur 2Fr\xE8res Phone"
      }
    }).returning();
    return created;
  }
  return null;
}
var requireAdmin = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authentification administrateur requise." });
  }
  const token = authHeader.split("Bearer ")[1];
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    req.user = decoded;
    const admin = await getOrCreateAdminRecord(decoded);
    if (!admin) {
      return res.status(403).json({
        error: `Acc\xE8s refus\xE9 : le compte ${decoded.email || ""} n'est pas autoris\xE9 sur le back-office 2Fr\xE8res Phone.`
      });
    }
    req.adminUser = admin;
    next();
  } catch (error) {
    console.error("Admin auth verification failed:", error);
    return res.status(401).json({ error: "Session invalide ou expir\xE9e. Veuillez vous reconnecter." });
  }
};

// src/server/seed.ts
import { sql } from "drizzle-orm";

// src/shared/algeria.ts
var ALGERIA_WILAYAS = [
  { code: "01", name: "Adrar", region: "sud" },
  { code: "02", name: "Chlef", region: "centre" },
  { code: "03", name: "Laghouat", region: "sud" },
  { code: "04", name: "Oum El Bouaghi", region: "est" },
  { code: "05", name: "Batna", region: "est" },
  { code: "06", name: "B\xE9ja\xEFa", region: "centre" },
  { code: "07", name: "Biskra", region: "sud" },
  { code: "08", name: "B\xE9char", region: "sud" },
  { code: "09", name: "Blida", region: "centre" },
  { code: "10", name: "Bouira", region: "centre" },
  { code: "11", name: "Tamanrasset", region: "sud" },
  { code: "12", name: "T\xE9bessa", region: "est" },
  { code: "13", name: "Tlemcen", region: "ouest" },
  { code: "14", name: "Tiaret", region: "ouest" },
  { code: "15", name: "Tizi Ouzou", region: "centre" },
  { code: "16", name: "Alger", region: "centre" },
  { code: "17", name: "Djelfa", region: "sud" },
  { code: "18", name: "Jijel", region: "est" },
  { code: "19", name: "S\xE9tif", region: "est" },
  { code: "20", name: "Sa\xEFda", region: "ouest" },
  { code: "21", name: "Skikda", region: "est" },
  { code: "22", name: "Sidi Bel Abb\xE8s", region: "ouest" },
  { code: "23", name: "Annaba", region: "est" },
  { code: "24", name: "Guelma", region: "est" },
  { code: "25", name: "Constantine", region: "est" },
  { code: "26", name: "M\xE9d\xE9a", region: "centre" },
  { code: "27", name: "Mostaganem", region: "ouest" },
  { code: "28", name: "M'Sila", region: "centre" },
  { code: "29", name: "Mascara", region: "ouest" },
  { code: "30", name: "Ouargla", region: "sud" },
  { code: "31", name: "Oran", region: "ouest" },
  { code: "32", name: "El Bayadh", region: "sud" },
  { code: "33", name: "Illizi", region: "sud" },
  { code: "34", name: "Bordj Bou Arr\xE9ridj", region: "est" },
  { code: "35", name: "Boumerd\xE8s", region: "centre" },
  { code: "36", name: "El Tarf", region: "est" },
  { code: "37", name: "Tindouf", region: "sud" },
  { code: "38", name: "Tissemsilt", region: "ouest" },
  { code: "39", name: "El Oued", region: "sud" },
  { code: "40", name: "Khenchela", region: "est" },
  { code: "41", name: "Souk Ahras", region: "est" },
  { code: "42", name: "Tipaza", region: "centre" },
  { code: "43", name: "Mila", region: "est" },
  { code: "44", name: "A\xEFn Defla", region: "centre" },
  { code: "45", name: "Na\xE2ma", region: "sud" },
  { code: "46", name: "A\xEFn T\xE9mouchent", region: "ouest" },
  { code: "47", name: "Gharda\xEFa", region: "sud" },
  { code: "48", name: "Relizane", region: "ouest" },
  { code: "49", name: "Timimoun", region: "sud" },
  { code: "50", name: "Bordj Badji Mokhtar", region: "sud" },
  { code: "51", name: "Ouled Djellal", region: "sud" },
  { code: "52", name: "B\xE9ni Abb\xE8s", region: "sud" },
  { code: "53", name: "In Salah", region: "sud" },
  { code: "54", name: "In Guezzam", region: "sud" },
  { code: "55", name: "Touggourt", region: "sud" },
  { code: "56", name: "Djanet", region: "sud" },
  { code: "57", name: "El M'Ghair", region: "sud" },
  { code: "58", name: "El Meniaa", region: "sud" }
];
function getWilayaByCode(code) {
  const normalized = code.trim().padStart(2, "0");
  return ALGERIA_WILAYAS.find((w) => w.code === normalized);
}

// src/server/seed.ts
var seedPromise = null;
var seeded = false;
var IMG_ACCESSORIES = "/src/assets/images/cat_phone_accessories_1795096637386.jpg";
var IMG_GAMING = "/src/assets/images/cat_gaming_console_1795096637263.jpg";
var IMG_DIGITAL = "/src/assets/images/cat_digital_cards_1795096637686.jpg";
var IMG_AUDIO_POWER = "/src/assets/images/prod_earbuds_powerbank_1795096637141.jpg";
var IMG_HERO = "/src/assets/images/hero_2freres_tech_1795096637447.jpg";
var INITIAL_CATEGORIES = [
  // 1. Accessoires téléphoniques
  { name: "Coques", slug: "coques", categoryGroup: "accessories", sortOrder: 1 },
  { name: "Verres tremp\xE9s et protections", slug: "verres-trempes-et-protections", categoryGroup: "accessories", sortOrder: 2 },
  { name: "Chargeurs", slug: "chargeurs", categoryGroup: "accessories", sortOrder: 3 },
  { name: "C\xE2bles", slug: "cables", categoryGroup: "accessories", sortOrder: 4 },
  { name: "\xC9couteurs filaires", slug: "ecouteurs-filaires", categoryGroup: "accessories", sortOrder: 5 },
  { name: "\xC9couteurs Bluetooth", slug: "ecouteurs-bluetooth", categoryGroup: "accessories", sortOrder: 6 },
  { name: "Batteries externes", slug: "batteries-externes", categoryGroup: "accessories", sortOrder: 7 },
  { name: "Supports t\xE9l\xE9phoniques", slug: "supports-telephoniques", categoryGroup: "accessories", sortOrder: 8 },
  { name: "Accessoires divers", slug: "accessoires-divers", categoryGroup: "accessories", sortOrder: 9 },
  // 2. Jeux vidéo
  { name: "Jeux Xbox", slug: "jeux-xbox", categoryGroup: "gaming", sortOrder: 10 },
  { name: "Jeux PlayStation", slug: "jeux-playstation", categoryGroup: "gaming", sortOrder: 11 },
  { name: "Comptes Xbox", slug: "comptes-xbox", categoryGroup: "gaming", sortOrder: 12 },
  { name: "Comptes PlayStation", slug: "comptes-playstation", categoryGroup: "gaming", sortOrder: 13 },
  { name: "Abonnements gaming", slug: "abonnements-gaming", categoryGroup: "gaming", sortOrder: 14 },
  { name: "Cartes cadeaux", slug: "cartes-cadeaux", categoryGroup: "gaming", sortOrder: 15 },
  // 3. Abonnements numériques
  { name: "Netflix", slug: "netflix", categoryGroup: "digital", sortOrder: 16 },
  { name: "Snapchat+", slug: "snapchat-plus", categoryGroup: "digital", sortOrder: 17 },
  { name: "Autres abonnements", slug: "autres-abonnements", categoryGroup: "digital", sortOrder: 18 },
  { name: "Services num\xE9riques", slug: "services-numeriques", categoryGroup: "digital", sortOrder: 19 }
];
var DDL_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id serial PRIMARY KEY,
    uid text UNIQUE,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL DEFAULT 'Administrateur 2Fr\xE8res Phone',
    role text NOT NULL DEFAULT 'super_admin',
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS media_assets (
    id serial PRIMARY KEY,
    filename text NOT NULL,
    mime_type text NOT NULL,
    data_base64 text NOT NULL,
    size_bytes integer NOT NULL DEFAULT 0,
    kind text NOT NULL DEFAULT 'product',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS store_settings (
    id serial PRIMARY KEY,
    store_name text NOT NULL DEFAULT '2Fr\xE8res Phone',
    tagline text NOT NULL DEFAULT 'Accessoires t\xE9l\xE9phoniques, Gaming & Services num\xE9riques en Alg\xE9rie',
    logo_url text,
    whatsapp_phone text NOT NULL DEFAULT '+213550000000',
    support_email text NOT NULL DEFAULT 'contact@2freresphone.dz',
    admin_alert_email text NOT NULL DEFAULT 'badroumc@gmail.com',
    default_low_stock_threshold integer NOT NULL DEFAULT 10,
    currency text NOT NULL DEFAULT 'DZD',
    store_address text NOT NULL DEFAULT 'Alg\xE9rie',
    cod_enabled boolean NOT NULL DEFAULT true,
    digital_order_note text NOT NULL DEFAULT 'Livraison et activation num\xE9rique apr\xE8s validation de la commande et du paiement.',
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS categories (
    id serial PRIMARY KEY,
    parent_id integer,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    category_group text NOT NULL DEFAULT 'accessories',
    description text,
    sort_order integer NOT NULL DEFAULT 0,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS products (
    id serial PRIMARY KEY,
    category_id integer REFERENCES categories(id) ON DELETE SET NULL,
    sku text NOT NULL UNIQUE,
    barcode text,
    external_ref text,
    name text NOT NULL,
    slug text NOT NULL UNIQUE,
    brand text,
    short_description text,
    description text NOT NULL DEFAULT '',
    product_type text NOT NULL DEFAULT 'physical',
    price_dzd integer NOT NULL DEFAULT 0,
    compare_at_price_dzd integer,
    cost_price_dzd integer NOT NULL DEFAULT 0,
    stock_quantity integer NOT NULL DEFAULT 0,
    low_stock_threshold integer,
    is_featured boolean NOT NULL DEFAULT false,
    is_active boolean NOT NULL DEFAULT true,
    digital_availability text DEFAULT 'available',
    digital_activation_template text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS product_images (
    id serial PRIMARY KEY,
    product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    url text NOT NULL,
    alt_text text NOT NULL DEFAULT '',
    sort_order integer NOT NULL DEFAULT 0,
    is_primary boolean NOT NULL DEFAULT false,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS carriers (
    id serial PRIMARY KEY,
    name text NOT NULL,
    code text NOT NULL UNIQUE,
    supports_home boolean NOT NULL DEFAULT true,
    supports_stop_desk boolean NOT NULL DEFAULT true,
    api_provider text NOT NULL DEFAULT 'manual',
    api_endpoint text,
    api_configured boolean NOT NULL DEFAULT false,
    notes text,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS shipping_rates (
    id serial PRIMARY KEY,
    carrier_id integer NOT NULL REFERENCES carriers(id) ON DELETE CASCADE,
    wilaya_code text NOT NULL,
    wilaya_name text NOT NULL,
    home_price_dzd integer NOT NULL DEFAULT 0,
    stop_desk_price_dzd integer NOT NULL DEFAULT 0,
    estimated_days text NOT NULL DEFAULT '24-48h',
    is_active boolean NOT NULL DEFAULT true,
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS customers (
    id serial PRIMARY KEY,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text NOT NULL UNIQUE,
    wilaya_code text NOT NULL DEFAULT '16',
    wilaya_name text NOT NULL DEFAULT 'Alger',
    commune text NOT NULL DEFAULT '',
    address text NOT NULL DEFAULT '',
    is_blocked boolean NOT NULL DEFAULT false,
    notes text NOT NULL DEFAULT '',
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS orders (
    id serial PRIMARY KEY,
    reference text NOT NULL UNIQUE,
    customer_id integer REFERENCES customers(id) ON DELETE SET NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    phone text NOT NULL,
    wilaya_code text NOT NULL,
    wilaya_name text NOT NULL,
    commune text NOT NULL,
    address text NOT NULL,
    delivery_type text NOT NULL DEFAULT 'home',
    carrier_id integer REFERENCES carriers(id) ON DELETE SET NULL,
    carrier_name text,
    tracking_number text,
    status text NOT NULL DEFAULT 'nouvelle',
    payment_method text NOT NULL DEFAULT 'cod',
    payment_status text NOT NULL DEFAULT 'pending',
    promo_code text,
    subtotal_dzd integer NOT NULL DEFAULT 0,
    discount_dzd integer NOT NULL DEFAULT 0,
    shipping_fee_dzd integer NOT NULL DEFAULT 0,
    total_dzd integer NOT NULL DEFAULT 0,
    has_digital_items boolean NOT NULL DEFAULT false,
    has_physical_items boolean NOT NULL DEFAULT true,
    stock_deducted boolean NOT NULL DEFAULT false,
    source text NOT NULL DEFAULT 'web',
    customer_notes text,
    admin_notes text,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS order_items (
    id serial PRIMARY KEY,
    order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    product_id integer REFERENCES products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    product_sku text NOT NULL DEFAULT '',
    product_type text NOT NULL DEFAULT 'physical',
    unit_price_dzd integer NOT NULL,
    cost_price_dzd integer NOT NULL DEFAULT 0,
    quantity integer NOT NULL DEFAULT 1,
    line_total_dzd integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS order_status_history (
    id serial PRIMARY KEY,
    order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    from_status text,
    to_status text NOT NULL,
    note text,
    changed_by text NOT NULL DEFAULT 'system',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS sales (
    id serial PRIMARY KEY,
    order_id integer NOT NULL UNIQUE REFERENCES orders(id) ON DELETE CASCADE,
    order_reference text NOT NULL,
    customer_name text NOT NULL,
    wilaya_name text NOT NULL,
    items_revenue_dzd integer NOT NULL DEFAULT 0,
    discount_dzd integer NOT NULL DEFAULT 0,
    shipping_fee_dzd integer NOT NULL DEFAULT 0,
    cost_of_goods_dzd integer NOT NULL DEFAULT 0,
    total_collected_dzd integer NOT NULL DEFAULT 0,
    estimated_margin_dzd integer NOT NULL DEFAULT 0,
    recorded_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS stock_imports (
    id serial PRIMARY KEY,
    file_name text NOT NULL,
    file_format text NOT NULL,
    source_table_or_sheet text,
    sync_mode text NOT NULL DEFAULT 'add_only',
    total_rows integer NOT NULL DEFAULT 0,
    added_count integer NOT NULL DEFAULT 0,
    updated_count integer NOT NULL DEFAULT 0,
    skipped_count integer NOT NULL DEFAULT 0,
    error_count integer NOT NULL DEFAULT 0,
    summary_json text,
    imported_by text NOT NULL DEFAULT 'admin',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS import_mapping_profiles (
    id serial PRIMARY KEY,
    profile_name text NOT NULL UNIQUE,
    source_format text NOT NULL,
    table_or_sheet_name text,
    column_mapping_json text NOT NULL,
    default_sync_mode text NOT NULL DEFAULT 'add_only',
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS stock_movements (
    id serial PRIMARY KEY,
    product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id integer REFERENCES orders(id) ON DELETE SET NULL,
    import_id integer REFERENCES stock_imports(id) ON DELETE SET NULL,
    delta integer NOT NULL,
    previous_qty integer NOT NULL,
    new_qty integer NOT NULL,
    reason text NOT NULL,
    created_by text NOT NULL DEFAULT 'system',
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS stock_alerts (
    id serial PRIMARY KEY,
    product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    product_name text NOT NULL,
    product_sku text NOT NULL,
    current_stock integer NOT NULL,
    threshold_used integer NOT NULL,
    status text NOT NULL DEFAULT 'active',
    email_status text NOT NULL DEFAULT 'pending',
    email_recipient text,
    email_error text,
    notified_at timestamp NOT NULL DEFAULT now(),
    resolved_at timestamp
  )`,
  `CREATE TABLE IF NOT EXISTS product_reviews (
    id serial PRIMARY KEY,
    product_id integer NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    order_id integer REFERENCES orders(id) ON DELETE SET NULL,
    order_reference text NOT NULL,
    customer_name text NOT NULL,
    customer_phone text NOT NULL,
    rating integer NOT NULL,
    title text NOT NULL DEFAULT '',
    comment text NOT NULL,
    is_verified_purchase boolean NOT NULL DEFAULT true,
    status text NOT NULL DEFAULT 'pending',
    admin_reply text,
    moderated_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS returns (
    id serial PRIMARY KEY,
    order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_reference text NOT NULL,
    customer_name text NOT NULL,
    phone text NOT NULL,
    wilaya_name text NOT NULL,
    reason text NOT NULL DEFAULT 'Client injoignable',
    condition text NOT NULL DEFAULT 'intact',
    restocked boolean NOT NULL DEFAULT false,
    return_fee_dzd integer NOT NULL DEFAULT 0,
    status text NOT NULL DEFAULT 'en_cours',
    notes text,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS promotions (
    id serial PRIMARY KEY,
    code text NOT NULL UNIQUE,
    description text NOT NULL DEFAULT '',
    discount_type text NOT NULL DEFAULT 'percent',
    discount_value integer NOT NULL DEFAULT 0,
    min_order_dzd integer NOT NULL DEFAULT 0,
    max_uses integer,
    used_count integer NOT NULL DEFAULT 0,
    starts_at timestamp,
    ends_at timestamp,
    is_active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS digital_deliveries (
    id serial PRIMARY KEY,
    order_id integer NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    order_item_id integer NOT NULL REFERENCES order_items(id) ON DELETE CASCADE,
    product_id integer REFERENCES products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    delivery_status text NOT NULL DEFAULT 'pending',
    activation_instructions text NOT NULL DEFAULT '',
    private_fulfillment_note text NOT NULL DEFAULT '',
    delivered_by text,
    delivered_at timestamp,
    created_at timestamp NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS social_links (
    id serial PRIMARY KEY,
    platform text NOT NULL,
    label text NOT NULL,
    url_or_handle text NOT NULL,
    pixel_id text,
    is_active boolean NOT NULL DEFAULT true,
    sort_order integer NOT NULL DEFAULT 0
  )`
];
async function ensureTablesExist() {
  const check = await db.execute(sql`SELECT to_regclass('public.store_settings') AS tbl`);
  const existing = check.rows?.[0]?.tbl;
  if (existing) return;
  for (const stmt of DDL_STATEMENTS) {
    await db.execute(sql.raw(stmt));
  }
}
async function ensureDatabaseSeeded() {
  if (seeded) return;
  if (seedPromise) return seedPromise;
  seedPromise = (async () => {
    try {
      await ensureTablesExist();
      const existingSettings = await db.select().from(storeSettings).limit(1);
      if (existingSettings.length === 0) {
        const initialAdminEmail2 = (process.env.INITIAL_ADMIN_EMAIL || "badroumc@gmail.com").toLowerCase();
        await db.insert(storeSettings).values({
          storeName: "2Fr\xE8res Phone",
          tagline: "Accessoires t\xE9l\xE9phoniques, Jeux vid\xE9o & Abonnements num\xE9riques en Alg\xE9rie",
          logoUrl: null,
          whatsappPhone: "+213550000000",
          supportEmail: "contact@2freresphone.dz",
          adminAlertEmail: initialAdminEmail2,
          defaultLowStockThreshold: 10,
          currency: "DZD",
          storeAddress: "Alg\xE9rie \u2014 Livraison 58 Wilayas",
          codEnabled: true
        });
      }
      const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || "badroumc@gmail.com").toLowerCase();
      const defaultAdmins = [
        { email: initialAdminEmail, fullName: "Administrateur 2Fr\xE8res Phone" },
        { email: "badroumc@gmail.com", fullName: "Administrateur 2Fr\xE8res Phone" },
        { email: "tigrine156@gmail.com", fullName: "Co-g\xE9rant 2Fr\xE8res Phone" }
      ];
      for (const adm of defaultAdmins) {
        await db.insert(adminUsers).values({
          email: adm.email,
          fullName: adm.fullName,
          role: "super_admin",
          isActive: true
        }).onConflictDoNothing({ target: adminUsers.email });
      }
      const catCountRes = await db.select({ count: sql`count(*)::int` }).from(categories);
      if ((catCountRes[0]?.count ?? 0) === 0) {
        await db.insert(categories).values(INITIAL_CATEGORIES).onConflictDoNothing();
      }
      const carrierCountRes = await db.select({ count: sql`count(*)::int` }).from(carriers);
      if ((carrierCountRes[0]?.count ?? 0) === 0) {
        const [manualCarrier] = await db.insert(carriers).values({
          name: "Grille Standard 2Fr\xE8res (Configurable)",
          code: "2FP_STANDARD",
          supportsHome: true,
          supportsStopDesk: true,
          apiProvider: "manual",
          apiConfigured: false,
          notes: "Grille de base modifiable depuis Tarifs de livraison. V\xE9rifiez et ajustez selon vos contrats transporteurs.",
          isActive: true
        }).returning();
        await db.insert(carriers).values([
          {
            name: "Yalidine Express (API \xE0 configurer)",
            code: "YALIDINE",
            supportsHome: true,
            supportsStopDesk: true,
            apiProvider: "yalidine",
            apiEndpoint: "https://api.yalidine.app/v1",
            apiConfigured: false,
            notes: "Pr\xEAt pour int\xE9gration API future (cl\xE9 API et ID requis).",
            isActive: false
          },
          {
            name: "ZR Express (API \xE0 configurer)",
            code: "ZREXPRESS",
            supportsHome: true,
            supportsStopDesk: true,
            apiProvider: "zrexpress",
            apiEndpoint: "https://procolis.com/api_v1",
            apiConfigured: false,
            notes: "Pr\xEAt pour int\xE9gration API future (token requis).",
            isActive: false
          }
        ]).onConflictDoNothing();
        if (manualCarrier) {
          const rateRows = ALGERIA_WILAYAS.map((w) => {
            const homePriceDzd = w.code === "16" ? 500 : w.region === "centre" ? 650 : w.region === "sud" ? 1100 : 800;
            const stopDeskPriceDzd = w.code === "16" ? 350 : w.region === "centre" ? 450 : w.region === "sud" ? 750 : 500;
            const estimatedDays = w.region === "sud" ? "48-72h" : "24-48h";
            return {
              carrierId: manualCarrier.id,
              wilayaCode: w.code,
              wilayaName: w.name,
              homePriceDzd,
              stopDeskPriceDzd,
              estimatedDays,
              isActive: true
            };
          });
          await db.insert(shippingRates).values(rateRows);
        }
      }
      const prodCountRes = await db.select({ count: sql`count(*)::int` }).from(products);
      if ((prodCountRes[0]?.count ?? 0) === 0) {
        const allCats = await db.select().from(categories);
        const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));
        const starterProducts = [
          {
            categorySlug: "coques",
            sku: "2FP-COQ-MAG15P",
            barcode: "613020000101",
            name: "Coque MagSafe Silicone Premium iPhone 15 Pro",
            slug: "coque-magsafe-silicone-premium-iphone-15-pro",
            brand: "2Fr\xE8res Select",
            shortDescription: "Protection antichoc doubl\xE9e microfibre avec anneau magn\xE9tique MagSafe int\xE9gr\xE9.",
            description: "Coque de protection haut de gamme en silicone liquide toucher doux, int\xE9rieur en microfibre protectrice, bords sur\xE9lev\xE9s cam\xE9ra et compatibilit\xE9 charge sans fil MagSafe.",
            productType: "physical",
            priceDzd: 2400,
            compareAtPriceDzd: 2900,
            costPriceDzd: 1200,
            stockQuantity: 28,
            lowStockThreshold: 10,
            isFeatured: true,
            image: IMG_ACCESSORIES
          },
          {
            categorySlug: "chargeurs",
            sku: "2FP-CHG-GAN65",
            barcode: "613020000102",
            name: "Chargeur Rapide GaN 65W Double USB-C + USB-A",
            slug: "chargeur-rapide-gan-65w-double-usb-c",
            brand: "Anker / GaN Pro",
            shortDescription: "Charge ultra-rapide 65W Power Delivery compatible iPhone, Samsung, Xiaomi et PC portables.",
            description: "Technologie GaN compacte avec protection contre la surchauffe et les surtensions. Permet de charger simultan\xE9ment 3 appareils avec r\xE9partition intelligente de puissance.",
            productType: "physical",
            priceDzd: 4900,
            compareAtPriceDzd: 5800,
            costPriceDzd: 2900,
            stockQuantity: 19,
            lowStockThreshold: 8,
            isFeatured: true,
            image: IMG_HERO
          },
          {
            categorySlug: "ecouteurs-bluetooth",
            sku: "2FP-ECO-ANC01",
            barcode: "613020000103",
            name: "\xC9couteurs Bluetooth TWS R\xE9duction de Bruit Active",
            slug: "ecouteurs-bluetooth-tws-reduction-bruit-active",
            brand: "SoundCore Pro",
            shortDescription: "Autonomie 30h avec bo\xEEtier USB-C, r\xE9duction active du bruit et mode faible latence.",
            description: "Son haute d\xE9finition avec basses \xE9quilibr\xE9es, double micro pour appels clairs, r\xE9sistance \xE9claboussures IPX5 et connexion instantan\xE9e Bluetooth 5.3.",
            productType: "physical",
            priceDzd: 6500,
            compareAtPriceDzd: 7500,
            costPriceDzd: 3900,
            stockQuantity: 14,
            lowStockThreshold: 6,
            isFeatured: true,
            image: IMG_AUDIO_POWER
          },
          {
            categorySlug: "batteries-externes",
            sku: "2FP-PWR-10K",
            barcode: "613020000104",
            name: "Batterie Externe Magn\xE9tique 10 000 mAh PD 20W",
            slug: "batterie-externe-magnetique-10000mah-pd-20w",
            brand: "2Fr\xE8res Power",
            shortDescription: "Power bank slim aluminium anodis\xE9 avec charge rapide 20W USB-C et magn\xE9tique.",
            description: "Compacte et l\xE9g\xE8re, id\xE9ale pour les d\xE9placements. Indicateurs LED de charge, protection multi-couches et port bidirectionnel USB-C Power Delivery.",
            productType: "physical",
            priceDzd: 5400,
            compareAtPriceDzd: null,
            costPriceDzd: 3200,
            stockQuantity: 7,
            lowStockThreshold: 10,
            isFeatured: true,
            image: IMG_AUDIO_POWER
          },
          {
            categorySlug: "verres-trempes-et-protections",
            sku: "2FP-VER-9D",
            barcode: "613020000105",
            name: "Verre Tremp\xE9 Int\xE9gral 9H Anti-Traces (Pack x2)",
            slug: "verre-trempe-integral-9h-anti-traces-pack-2",
            brand: "ShieldGlass",
            shortDescription: "Duret\xE9 9H haute transparence avec kit de pose sans bulles inclus.",
            description: "Protection \xE9cran bord \xE0 bord ol\xE9ophobe, pr\xE9serve la sensibilit\xE9 tactile et la nettet\xE9 HD. Disponible pour iPhone, Samsung Galaxy et Redmi.",
            productType: "physical",
            priceDzd: 1200,
            compareAtPriceDzd: 1500,
            costPriceDzd: 450,
            stockQuantity: 45,
            lowStockThreshold: 15,
            isFeatured: false,
            image: IMG_ACCESSORIES
          },
          {
            categorySlug: "jeux-playstation",
            sku: "2FP-PS5-FC25",
            barcode: null,
            name: "Jeu PlayStation PS5 / PS4 \u2014 Livraison Num\xE9rique Officielle",
            slug: "jeu-playstation-ps5-ps4-livraison-numerique",
            brand: "PlayStation",
            shortDescription: "Activation v\xE9rifi\xE9e apr\xE8s validation de la commande et du paiement.",
            description: "Produit num\xE9rique livr\xE9 manuellement par l\u2019\xE9quipe 2Fr\xE8res Phone apr\xE8s confirmation du paiement, accompagn\xE9 d\u2019un guide d\u2019activation clair et d\u2019un support d\xE9di\xE9.",
            productType: "digital",
            priceDzd: 7900,
            compareAtPriceDzd: 8900,
            costPriceDzd: 5800,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: true,
            image: IMG_GAMING,
            digitalActivationTemplate: "Instructions envoy\xE9es par notre \xE9quipe apr\xE8s validation du paiement. Ne partagez jamais vos acc\xE8s."
          },
          {
            categorySlug: "abonnements-gaming",
            sku: "2FP-XBX-GPU3M",
            barcode: null,
            name: "Xbox Game Pass Ultimate \u2014 Abonnement 3 Mois",
            slug: "xbox-game-pass-ultimate-3-mois",
            brand: "Xbox",
            shortDescription: "Acc\xE8s complet au catalogue Xbox Game Pass console & PC, EA Play inclus.",
            description: "Profitez de centaines de jeux sur Xbox Series X|S, Xbox One et PC. Livraison et activation trait\xE9es par notre \xE9quipe apr\xE8s validation de votre commande.",
            productType: "digital",
            priceDzd: 6200,
            compareAtPriceDzd: 7e3,
            costPriceDzd: 4400,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: true,
            image: IMG_GAMING,
            digitalActivationTemplate: "Activation manuelle sous 15 \xE0 60 minutes apr\xE8s validation de votre r\xE8glement."
          },
          {
            categorySlug: "netflix",
            sku: "2FP-DIG-NFX1M",
            barcode: null,
            name: "Abonnement Netflix 4K Ultra HD \u2014 1 Mois",
            slug: "abonnement-netflix-4k-ultra-hd-1-mois",
            brand: "Netflix",
            shortDescription: "Qualit\xE9 4K UHD garantie, activation rapide apr\xE8s confirmation de paiement.",
            description: "Service num\xE9rique officiel suivi par 2Fr\xE8res Phone pendant toute la dur\xE9e de l\u2019abonnement. Aucun identifiant n\u2019est stock\xE9 publiquement : livraison s\xE9curis\xE9e apr\xE8s validation.",
            productType: "digital",
            priceDzd: 1400,
            compareAtPriceDzd: null,
            costPriceDzd: 850,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: true,
            image: IMG_DIGITAL,
            digitalActivationTemplate: "Les consignes d\u2019activation sont transmises en priv\xE9 par notre \xE9quipe d\xE8s validation du paiement."
          },
          {
            categorySlug: "snapchat-plus",
            sku: "2FP-DIG-SNP3M",
            barcode: null,
            name: "Abonnement Snapchat+ Officiel \u2014 3 Mois",
            slug: "abonnement-snapchat-plus-3-mois",
            brand: "Snapchat+",
            shortDescription: "D\xE9bloquez les fonctionnalit\xE9s exclusives Snapchat+ sur votre compte personnel.",
            description: "Activation s\xE9curis\xE9e sur votre compte existant apr\xE8s validation de la commande. Accompagnement WhatsApp en cas de besoin.",
            productType: "digital",
            priceDzd: 2100,
            compareAtPriceDzd: 2500,
            costPriceDzd: 1350,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: false,
            image: IMG_DIGITAL,
            digitalActivationTemplate: "Fournissez votre nom d\u2019utilisateur Snapchat lors de la confirmation pour activation rapide."
          }
        ];
        for (const item of starterProducts) {
          const [inserted] = await db.insert(products).values({
            categoryId: catBySlug.get(item.categorySlug) ?? null,
            sku: item.sku,
            barcode: item.barcode,
            name: item.name,
            slug: item.slug,
            brand: item.brand,
            shortDescription: item.shortDescription,
            description: item.description,
            productType: item.productType,
            priceDzd: item.priceDzd,
            compareAtPriceDzd: item.compareAtPriceDzd,
            costPriceDzd: item.costPriceDzd,
            stockQuantity: item.stockQuantity,
            lowStockThreshold: item.lowStockThreshold,
            isFeatured: item.isFeatured,
            isActive: true,
            digitalAvailability: item.productType === "digital" ? "available" : null,
            digitalActivationTemplate: item.digitalActivationTemplate ?? null
          }).onConflictDoNothing().returning();
          if (inserted) {
            await db.insert(productImages).values({
              productId: inserted.id,
              url: item.image,
              altText: item.name,
              sortOrder: 0,
              isPrimary: true
            });
          }
        }
      }
      const socialCountRes = await db.select({ count: sql`count(*)::int` }).from(socialLinks);
      if ((socialCountRes[0]?.count ?? 0) === 0) {
        await db.insert(socialLinks).values([
          { platform: "whatsapp", label: "WhatsApp Commandes", urlOrHandle: "+213550000000", isActive: true, sortOrder: 1 },
          { platform: "instagram", label: "Instagram @2freresphone", urlOrHandle: "https://instagram.com/2freresphone", isActive: true, sortOrder: 2 },
          { platform: "facebook", label: "Facebook 2Fr\xE8res Phone", urlOrHandle: "https://facebook.com/2freresphone", isActive: true, sortOrder: 3 },
          { platform: "tiktok", label: "TikTok @2freresphone", urlOrHandle: "https://tiktok.com/@2freresphone", isActive: true, sortOrder: 4 }
        ]);
      }
      const promoCountRes = await db.select({ count: sql`count(*)::int` }).from(promotions);
      if ((promoCountRes[0]?.count ?? 0) === 0) {
        await db.insert(promotions).values({
          code: "BIENVENUE10",
          description: "10 % de r\xE9duction d\xE8s 4 000 DZD d\u2019achat",
          discountType: "percent",
          discountValue: 10,
          minOrderDzd: 4e3,
          maxUses: 500,
          isActive: true
        }).onConflictDoNothing();
      }
      seeded = true;
    } catch (error) {
      seedPromise = null;
      console.error("Database seed error:", error);
      throw error;
    }
  })();
  return seedPromise;
}

// src/server/stockAlerts.ts
import { and, eq as eq3 } from "drizzle-orm";

// src/shared/domain.ts
function formatDzd(amount) {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  return `${safe.toLocaleString("fr-DZ")} DZD`;
}
function slugify(input) {
  return input.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "article";
}
function normalizeAlgerianPhone(phone) {
  const cleaned = phone.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+213")) {
    return "0" + cleaned.slice(4);
  }
  if (cleaned.startsWith("00213")) {
    return "0" + cleaned.slice(5);
  }
  if (cleaned.startsWith("213") && cleaned.length >= 12) {
    return "0" + cleaned.slice(3);
  }
  return cleaned;
}
function isValidAlgerianPhone(phone) {
  const normalized = normalizeAlgerianPhone(phone);
  return /^0[567]\d{8}$/.test(normalized) || /^0[234]\d{7}$/.test(normalized);
}
function generateOrderReference(sequence) {
  const year = (/* @__PURE__ */ new Date()).getFullYear();
  const suffix = typeof sequence === "number" ? String(sequence).padStart(6, "0") : String(Math.floor(1e5 + Math.random() * 9e5));
  return `2FP-${year}-${suffix}`;
}
function computeEffectiveLowStockThreshold(productThreshold, globalDefaultThreshold) {
  if (typeof productThreshold === "number" && Number.isFinite(productThreshold) && productThreshold >= 0) {
    return Math.floor(productThreshold);
  }
  return Math.max(0, Math.floor(globalDefaultThreshold));
}
function isLowStock(stockQuantity, productThreshold, globalDefaultThreshold, productType = "physical") {
  if (productType === "digital") return false;
  const threshold = computeEffectiveLowStockThreshold(productThreshold, globalDefaultThreshold);
  return stockQuantity <= threshold;
}
function calculatePromoDiscount(input) {
  const minOrder = input.minOrderDzd ?? 0;
  if (input.subtotalDzd < minOrder) {
    return {
      valid: false,
      discountDzd: 0,
      effectiveShippingDzd: input.shippingFeeDzd,
      reason: `Minimum de commande requis : ${formatDzd(minOrder)}`
    };
  }
  if (input.discountType === "free_shipping") {
    return {
      valid: true,
      discountDzd: 0,
      effectiveShippingDzd: 0
    };
  }
  if (input.discountType === "percent") {
    const pct = Math.min(100, Math.max(0, input.discountValue));
    const discountDzd = Math.round(input.subtotalDzd * pct / 100);
    return {
      valid: true,
      discountDzd: Math.min(input.subtotalDzd, discountDzd),
      effectiveShippingDzd: input.shippingFeeDzd
    };
  }
  const fixed = Math.max(0, Math.round(input.discountValue));
  return {
    valid: true,
    discountDzd: Math.min(input.subtotalDzd, fixed),
    effectiveShippingDzd: input.shippingFeeDzd
  };
}
function calculateReviewSummary(ratings) {
  const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  if (ratings.length === 0) {
    return { averageRating: 0, reviewCount: 0, distribution };
  }
  let total = 0;
  let count = 0;
  for (const r of ratings) {
    const clamped = Math.min(5, Math.max(1, Math.round(r)));
    distribution[clamped] += 1;
    total += clamped;
    count += 1;
  }
  return {
    averageRating: Math.round(total / count * 10) / 10,
    reviewCount: count,
    distribution
  };
}
function shouldDeductStockOnStatus(status) {
  return status === "confirmee" || status === "en_preparation" || status === "expediee" || status === "livree";
}

// src/server/emailService.ts
import nodemailer from "nodemailer";
async function sendLowStockAlertEmail(payload) {
  const subject = `[${payload.storeName}] Alerte stock faible \u2014 ${payload.productName} (${payload.currentStock} restant${payload.currentStock > 1 ? "s" : ""})`;
  const textBody = [
    `Alerte de stock faible sur ${payload.storeName}`,
    "",
    `Produit : ${payload.productName}`,
    `SKU : ${payload.productSku}`,
    `Stock actuel : ${payload.currentStock} unit\xE9(s)`,
    `Seuil configur\xE9 : ${payload.thresholdUsed} unit\xE9(s)`,
    "",
    `Connectez-vous au panneau administrateur (/admin) pour r\xE9approvisionner cet article.`
  ].join("\n");
  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 8px;">
      <p style="margin: 0 0 8px; font-size: 12px; color: #dc2626; font-weight: 600;">ALERTE STOCK FAIBLE \u2014 ${payload.storeName}</p>
      <h2 style="margin: 0 0 16px; font-size: 18px;">${payload.productName}</h2>
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr><td style="padding: 8px 0; color: #64748b;">R\xE9f\xE9rence (SKU)</td><td style="padding: 8px 0; text-align: right; font-family: monospace;">${payload.productSku}</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b; border-top: 1px solid #f1f5f9;">Stock actuel</td><td style="padding: 8px 0; text-align: right; font-weight: 700; color: #dc2626; border-top: 1px solid #f1f5f9;">${payload.currentStock} unit\xE9(s)</td></tr>
        <tr><td style="padding: 8px 0; color: #64748b; border-top: 1px solid #f1f5f9;">Seuil d'alerte</td><td style="padding: 8px 0; text-align: right; border-top: 1px solid #f1f5f9;">${payload.thresholdUsed} unit\xE9(s)</td></tr>
      </table>
      <p style="margin: 20px 0 0; font-size: 13px; color: #475569;">Rendez-vous dans votre tableau de bord administrateur <strong>/admin</strong> pour r\xE9approvisionner cet article ou importer votre derni\xE8re base de stock.</p>
    </div>
  `;
  if (process.env.RESEND_API_KEY) {
    try {
      const response = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          from: process.env.SMTP_FROM || "2Freres Phone <onboarding@resend.dev>",
          to: [payload.recipientEmail],
          subject,
          text: textBody,
          html: htmlBody
        })
      });
      if (!response.ok) {
        const errText = await response.text();
        return { status: "failed", error: `Resend HTTP ${response.status}: ${errText.slice(0, 180)}` };
      }
      return { status: "sent" };
    } catch (error) {
      return { status: "failed", error: error?.message || "Erreur Resend" };
    }
  }
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT || 587),
        secure: Number(process.env.SMTP_PORT || 587) === 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: payload.recipientEmail,
        subject,
        text: textBody,
        html: htmlBody
      });
      return { status: "sent" };
    } catch (error) {
      return { status: "failed", error: error?.message || "Erreur SMTP" };
    }
  }
  return {
    status: "not_configured",
    error: "Configurez SMTP_HOST/SMTP_USER/SMTP_PASS ou RESEND_API_KEY dans les variables d\u2019environnement pour activer l\u2019envoi r\xE9el d\u2019e-mails."
  };
}

// src/server/stockAlerts.ts
async function evaluateProductLowStock(productId) {
  const [product] = await db.select().from(products).where(eq3(products.id, productId));
  if (!product) return null;
  const [settings] = await db.select().from(storeSettings).limit(1);
  const globalThreshold = settings?.defaultLowStockThreshold ?? 10;
  const threshold = computeEffectiveLowStockThreshold(product.lowStockThreshold, globalThreshold);
  const recipient = settings?.adminAlertEmail || process.env.INITIAL_ADMIN_EMAIL || "badroumc@gmail.com";
  const storeName = settings?.storeName || "2Fr\xE8res Phone";
  const low = product.isActive && isLowStock(product.stockQuantity, product.lowStockThreshold, globalThreshold, product.productType);
  const existingActive = await db.select().from(stockAlerts).where(and(eq3(stockAlerts.productId, product.id), eq3(stockAlerts.status, "active")));
  if (!low) {
    if (existingActive.length > 0) {
      await db.update(stockAlerts).set({
        status: "resolved",
        currentStock: product.stockQuantity,
        resolvedAt: /* @__PURE__ */ new Date()
      }).where(and(eq3(stockAlerts.productId, product.id), eq3(stockAlerts.status, "active")));
    }
    return null;
  }
  if (existingActive.length > 0) {
    const active = existingActive[0];
    const droppedToZero = active.currentStock > 0 && product.stockQuantity === 0;
    let emailStatus = active.emailStatus;
    let emailError = active.emailError;
    if (droppedToZero) {
      const dispatch2 = await sendLowStockAlertEmail({
        recipientEmail: recipient,
        storeName,
        productName: product.name,
        productSku: product.sku,
        currentStock: product.stockQuantity,
        thresholdUsed: threshold
      });
      emailStatus = dispatch2.status;
      emailError = dispatch2.error || null;
    }
    const [updated] = await db.update(stockAlerts).set({
      productName: product.name,
      productSku: product.sku,
      currentStock: product.stockQuantity,
      thresholdUsed: threshold,
      emailStatus,
      emailRecipient: recipient,
      emailError
    }).where(eq3(stockAlerts.id, active.id)).returning();
    return updated;
  }
  const dispatch = await sendLowStockAlertEmail({
    recipientEmail: recipient,
    storeName,
    productName: product.name,
    productSku: product.sku,
    currentStock: product.stockQuantity,
    thresholdUsed: threshold
  });
  const [created] = await db.insert(stockAlerts).values({
    productId: product.id,
    productName: product.name,
    productSku: product.sku,
    currentStock: product.stockQuantity,
    thresholdUsed: threshold,
    status: "active",
    emailStatus: dispatch.status,
    emailRecipient: recipient,
    emailError: dispatch.error || null
  }).returning();
  return created;
}
async function syncAllLowStockAlerts() {
  const allProducts = await db.select({ id: products.id }).from(products);
  for (const p of allProducts) {
    await evaluateProductLowStock(p.id);
  }
}

// src/server/stockImportParser.ts
import * as XLSX from "xlsx";
import { XMLParser } from "fast-xml-parser";
import initSqlJs from "sql.js";
function detectFormatFromFilename(filename) {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  if (lower.endsWith(".tsv")) return "tsv";
  if (lower.endsWith(".csv") || lower.endsWith(".txt")) return "csv";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".xml")) return "xml";
  if (lower.endsWith(".sqlite") || lower.endsWith(".sqlite3") || lower.endsWith(".db")) return "sqlite";
  if (lower.endsWith(".sql")) return "sql";
  throw new Error(
    "Format non reconnu. Formats pris en charge : .xlsx, .xls, .csv, .tsv, .txt, .json, .xml, .db, .sqlite, .sqlite3, .sql"
  );
}
function normalizeHeader(raw) {
  return raw.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}
function scoreHeaderMatch(header, aliases) {
  const norm = normalizeHeader(header);
  if (!norm) return 0;
  for (const alias of aliases) {
    if (norm === alias) return 100;
    if (norm.includes(alias) || alias.includes(norm)) return 65;
  }
  return 0;
}
function suggestColumnMapping(columns) {
  const pick = (aliases) => {
    let bestCol;
    let bestScore = 0;
    for (const col of columns) {
      const score = scoreHeaderMatch(col, aliases);
      if (score > bestScore) {
        bestScore = score;
        bestCol = col;
      }
    }
    return bestScore >= 60 ? bestCol : void 0;
  };
  const name = pick([
    "designation",
    "libelle",
    "nom_article",
    "nom_produit",
    "article",
    "produit",
    "product_name",
    "name",
    "nom",
    "titre",
    "title",
    "item",
    "intitule"
  ]) || columns[0] || "";
  return {
    name,
    sku: pick(["sku", "ref", "reference", "code_article", "code_produit", "code", "id_article", "code_interne"]),
    barcode: pick(["barcode", "code_barre", "codebarre", "ean", "ean13", "upc", "gtin", "cb"]),
    priceDzd: pick([
      "prix_vente",
      "pv_ttc",
      "pv",
      "prix_ttc",
      "prix",
      "price",
      "price_dzd",
      "tarif",
      "vente",
      "montant",
      "selling_price"
    ]),
    costPriceDzd: pick(["prix_achat", "pa", "pa_ht", "cout", "cost", "cost_price", "achat", "pamp"]),
    stockQuantity: pick([
      "qte",
      "quantite",
      "qte_stock",
      "stock",
      "stock_actuel",
      "quantity",
      "qty",
      "disponible",
      "en_stock",
      "solde"
    ]),
    categoryName: pick(["categorie", "category", "famille", "sous_famille", "rayon", "groupe", "type_article"]),
    brand: pick(["marque", "brand", "fabricant"]),
    description: pick(["description", "details", "observation", "remarque", "notes"]),
    lowStockThreshold: pick(["seuil", "seuil_alerte", "stock_min", "min_stock", "low_stock_threshold", "alerte"]),
    productType: pick(["product_type", "nature", "type"])
  };
}
function decodeBufferText(buffer) {
  const utf8 = buffer.toString("utf8");
  if (utf8.includes("\uFFFD")) {
    return buffer.toString("latin1");
  }
  return utf8.replace(/^\uFEFF/, "");
}
function parseDelimitedText(text2, forcedDelimiter) {
  const lines = text2.split(/\r?\n/).map((l) => l.trim()).filter((l) => l.length > 0);
  if (lines.length === 0) {
    return { tableName: "Feuille1", columns: [], rows: [] };
  }
  const firstLine = lines[0];
  const candidates = forcedDelimiter ? [forcedDelimiter] : [";", ",", "	", "|"];
  let delimiter = candidates[0];
  let bestCount = -1;
  for (const sep of candidates) {
    const count = firstLine.split(sep).length - 1;
    if (count > bestCount) {
      bestCount = count;
      delimiter = sep;
    }
  }
  const parseLine = (line) => {
    const out = [];
    let current = "";
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
        current = "";
      } else {
        current += ch;
      }
    }
    out.push(current.trim());
    return out;
  };
  const headers = parseLine(lines[0]).map((h, idx) => h || `col_${idx + 1}`);
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => v === "")) continue;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = values[idx] ?? "";
    });
    rows.push(obj);
  }
  return { tableName: "Import CSV", columns: headers, rows };
}
function extractBestArrayFromObject(obj, pathName = "data") {
  const tables = [];
  if (Array.isArray(obj)) {
    const objects = obj.filter((item) => item && typeof item === "object" && !Array.isArray(item));
    if (objects.length > 0) {
      const colSet = /* @__PURE__ */ new Set();
      for (const item of objects.slice(0, 50)) {
        Object.keys(item).forEach((k) => colSet.add(k));
      }
      tables.push({
        tableName: pathName,
        columns: Array.from(colSet),
        rows: objects
      });
    }
    return tables;
  }
  if (obj && typeof obj === "object") {
    const record = obj;
    const entries = Object.entries(record);
    for (const [key, val] of entries) {
      tables.push(...extractBestArrayFromObject(val, key));
    }
    if (tables.length === 0 && entries.length > 0) {
      const allPrimitives = entries.every(
        ([, v]) => v === null || v === void 0 || typeof v !== "object"
      );
      if (allPrimitives) {
        tables.push({
          tableName: pathName,
          columns: entries.map(([k]) => k),
          rows: [record]
        });
      }
    }
  }
  return tables;
}
function splitSqlValues(tupleContent) {
  const values = [];
  let current = "";
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
    } else if (ch === "," && !inSingle && !inDouble) {
      values.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  values.push(current.trim());
  return values.map((v) => v.toUpperCase() === "NULL" ? "" : v);
}
function parseSqlDump(sqlText) {
  const tableMap = /* @__PURE__ */ new Map();
  const insertRegex = /INSERT\s+(?:OR\s+\w+\s+|IGNORE\s+)?INTO\s+[`"\[]?([\w.]+)[`"\]]?\s*(?:\(([^)]+)\))?\s*VALUES\s*([\s\S]*?);/gi;
  let match;
  while ((match = insertRegex.exec(sqlText)) !== null) {
    const rawTable = match[1].split(".").pop() || match[1];
    const colList = match[2] ? match[2].split(",").map((c) => c.trim().replace(/^[`"\[]|[`"\]]$/g, "")) : [];
    const valuesBlock = match[3];
    const tuples = [];
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
      } else if (!inSingle && ch === "(") {
        if (depth === 0) start = i + 1;
        depth++;
      } else if (!inSingle && ch === ")") {
        depth--;
        if (depth === 0 && start >= 0) {
          tuples.push(valuesBlock.slice(start, i));
          start = -1;
        }
      }
    }
    for (const tuple of tuples) {
      const parsedVals = splitSqlValues(tuple);
      const cols = colList.length > 0 ? colList : parsedVals.map((_, idx) => `col_${idx + 1}`);
      if (!tableMap.has(rawTable)) {
        tableMap.set(rawTable, { columns: cols, rows: [] });
      }
      const entry = tableMap.get(rawTable);
      const rowObj = {};
      cols.forEach((c, idx) => {
        rowObj[c] = parsedVals[idx] ?? "";
      });
      entry.rows.push(rowObj);
    }
  }
  return Array.from(tableMap.entries()).map(([tableName, data]) => ({
    tableName,
    columns: data.columns,
    rows: data.rows
  }));
}
async function parseSqliteBuffer(buffer) {
  const SQL = await initSqlJs();
  const db2 = new SQL.Database(new Uint8Array(buffer));
  try {
    const tableResult = db2.exec(
      "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"
    );
    const tableNames = tableResult[0]?.values.map((row) => String(row[0])) || [];
    const tables = [];
    for (const tName of tableNames) {
      const safeName = tName.replace(/"/g, '""');
      const res = db2.exec(`SELECT * FROM "${safeName}" LIMIT 5000`);
      if (res.length === 0) continue;
      const cols = res[0].columns;
      const rows = res[0].values.map((vals) => {
        const obj = {};
        cols.forEach((col, i) => {
          obj[col] = vals[i] ?? "";
        });
        return obj;
      });
      if (rows.length > 0) {
        tables.push({ tableName: tName, columns: cols, rows });
      }
    }
    return tables;
  } finally {
    db2.close();
  }
}
async function parseStockDatabaseBuffer(buffer, filename, preferredTable) {
  const format = detectFormatFromFilename(filename);
  let tables = [];
  if (format === "xlsx" || format === "xls") {
    const workbook = XLSX.read(buffer, { type: "buffer" });
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      if (rows.length > 0) {
        tables.push({
          tableName: sheetName,
          columns: Object.keys(rows[0]),
          rows
        });
      }
    }
  } else if (format === "csv" || format === "tsv") {
    const text2 = decodeBufferText(buffer);
    const parsed = parseDelimitedText(text2, format === "tsv" ? "	" : void 0);
    if (parsed.rows.length > 0) tables.push(parsed);
  } else if (format === "json") {
    const text2 = decodeBufferText(buffer);
    const json = JSON.parse(text2);
    tables = extractBestArrayFromObject(json, "articles");
  } else if (format === "xml") {
    const text2 = decodeBufferText(buffer);
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "" });
    const parsed = parser.parse(text2);
    tables = extractBestArrayFromObject(parsed, "articles");
  } else if (format === "sqlite") {
    tables = await parseSqliteBuffer(buffer);
  } else if (format === "sql") {
    const text2 = decodeBufferText(buffer);
    tables = parseSqlDump(text2);
  }
  if (tables.length === 0) {
    throw new Error("Aucune ligne exploitable trouv\xE9e dans ce fichier.");
  }
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
    suggestedMapping: suggestColumnMapping(selected.columns)
  };
}
function parseDzdNumber(value, fallback = 0) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.max(0, Math.round(value));
  const raw = String(value ?? "").replace(/[^\d.,-]/g, "").replace(/\s+/g, "");
  if (!raw) return fallback;
  const normalized = raw.includes(",") && raw.includes(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : fallback;
}
function normalizeMatchKey(value) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}
function buildDifferentialSyncPlan(rows, mapping, existingProducts, syncMode = "add_only") {
  const bySku = /* @__PURE__ */ new Map();
  const byBarcode = /* @__PURE__ */ new Map();
  const byExternalRef = /* @__PURE__ */ new Map();
  const byName = /* @__PURE__ */ new Map();
  for (const prod of existingProducts) {
    if (prod.sku) bySku.set(normalizeMatchKey(prod.sku), prod);
    if (prod.barcode) byBarcode.set(normalizeMatchKey(prod.barcode), prod);
    if (prod.externalRef) byExternalRef.set(normalizeMatchKey(prod.externalRef), prod);
    if (prod.name) byName.set(normalizeMatchKey(prod.name), prod);
  }
  const toAdd = [];
  const toUpdate = [];
  const skipped = [];
  const errors = [];
  const seenInBatch = /* @__PURE__ */ new Set();
  rows.forEach((row, index) => {
    const rowIndex = index + 1;
    const rawName = String(row[mapping.name] ?? "").trim();
    if (!rawName) {
      errors.push({ rowIndex, reason: "Nom d\u2019article manquant" });
      return;
    }
    const rawSku = mapping.sku ? String(row[mapping.sku] ?? "").trim() : "";
    const rawBarcode = mapping.barcode ? String(row[mapping.barcode] ?? "").trim() : "";
    const normalizedNameKey = normalizeMatchKey(rawName);
    const derivedSku = rawSku || rawBarcode || `IMP-${normalizedNameKey.slice(0, 10).toUpperCase() || "ART"}-${String(rowIndex).padStart(3, "0")}`;
    const dedupKey = normalizeMatchKey(rawSku || rawBarcode || rawName);
    if (seenInBatch.has(dedupKey)) {
      skipped.push({
        rowIndex,
        name: rawName,
        sku: derivedSku,
        reason: "Doublon dans le fichier import\xE9"
      });
      return;
    }
    seenInBatch.add(dedupKey);
    const rawType = mapping.productType ? String(row[mapping.productType] ?? "").toLowerCase() : "";
    const productType = rawType.includes("num") || rawType.includes("digit") || rawType.includes("abonn") ? "digital" : "physical";
    const rawThreshold = mapping.lowStockThreshold ? String(row[mapping.lowStockThreshold] ?? "").trim() : "";
    const parsedThreshold = rawThreshold !== "" ? parseDzdNumber(rawThreshold, 0) : null;
    const incoming = {
      rowIndex,
      sku: derivedSku,
      barcode: rawBarcode || null,
      externalRef: rawSku || rawBarcode || normalizedNameKey,
      name: rawName,
      priceDzd: mapping.priceDzd ? parseDzdNumber(row[mapping.priceDzd], 0) : 0,
      costPriceDzd: mapping.costPriceDzd ? parseDzdNumber(row[mapping.costPriceDzd], 0) : 0,
      stockQuantity: mapping.stockQuantity ? parseDzdNumber(row[mapping.stockQuantity], 0) : 0,
      categoryName: mapping.categoryName ? String(row[mapping.categoryName] ?? "").trim() || null : null,
      brand: mapping.brand ? String(row[mapping.brand] ?? "").trim() || null : null,
      description: mapping.description ? String(row[mapping.description] ?? "").trim() : "",
      lowStockThreshold: parsedThreshold,
      productType
    };
    const matched = rawSku && bySku.get(normalizeMatchKey(rawSku)) || rawBarcode && byBarcode.get(normalizeMatchKey(rawBarcode)) || rawSku && byExternalRef.get(normalizeMatchKey(rawSku)) || byName.get(normalizedNameKey);
    if (!matched) {
      toAdd.push(incoming);
      return;
    }
    if (syncMode === "add_only") {
      skipped.push({
        rowIndex,
        name: rawName,
        sku: matched.sku,
        reason: "D\xE9j\xE0 pr\xE9sent en stock (ignor\xE9 en mode ajouts uniquement)"
      });
      return;
    }
    toUpdate.push({
      existing: matched,
      incoming,
      stockDelta: incoming.stockQuantity - matched.stockQuantity
    });
  });
  return { toAdd, toUpdate, skipped, errors };
}

// server.ts
var __filename = fileURLToPath(import.meta.url);
var __dirname = path2.dirname(__filename);
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }
  // 25 MB max for stock DBs / photos
});
function createApp() {
  const app2 = express();
  app2.use(express.json({ limit: "15mb" }));
  app2.use(express.urlencoded({ extended: true, limit: "15mb" }));
  app2.use("/api", async (_req, res, next) => {
    if (!hasDatabaseConfig()) {
      return res.status(503).json({
        error: "Base de donn\xE9es PostgreSQL non connect\xE9e sur Vercel : ouvrez Vercel \u2192 Storage \u2192 Create Database \u2192 Neon Postgres, puis cliquez sur Redeploy."
      });
    }
    try {
      await ensureDatabaseSeeded();
      next();
    } catch (error) {
      console.error("API bootstrap failed:", error);
      res.status(503).json({ error: "Service de base de donn\xE9es momentan\xE9ment indisponible." });
    }
  });
  app2.get("/api/media/:id", async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).send("Invalid media ID");
      const [asset] = await db.select().from(mediaAssets).where(eq4(mediaAssets.id, id));
      if (!asset) return res.status(404).send("Not found");
      const buffer = Buffer.from(asset.dataBase64, "base64");
      res.setHeader("Content-Type", asset.mimeType);
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return res.send(buffer);
    } catch (error) {
      console.error("Error serving media:", error);
      return res.status(500).send("Media error");
    }
  });
  app2.get("/api/store/bootstrap", async (_req, res) => {
    try {
      const [settingsRow] = await db.select().from(storeSettings).limit(1);
      const activeCategories = await db.select().from(categories).where(eq4(categories.isActive, true)).orderBy(asc(categories.sortOrder), asc(categories.name));
      const activeSocials = await db.select().from(socialLinks).where(eq4(socialLinks.isActive, true)).orderBy(asc(socialLinks.sortOrder));
      const activeCarriers = await db.select().from(carriers).where(eq4(carriers.isActive, true)).orderBy(asc(carriers.id));
      const rates = await db.select().from(shippingRates).where(eq4(shippingRates.isActive, true)).orderBy(asc(shippingRates.wilayaCode));
      const publicSettings = settingsRow ? {
        storeName: settingsRow.storeName,
        tagline: settingsRow.tagline,
        logoUrl: settingsRow.logoUrl,
        whatsappPhone: settingsRow.whatsappPhone,
        supportEmail: settingsRow.supportEmail,
        currency: settingsRow.currency,
        storeAddress: settingsRow.storeAddress,
        codEnabled: settingsRow.codEnabled,
        digitalOrderNote: settingsRow.digitalOrderNote
      } : null;
      return res.json({
        settings: publicSettings,
        categories: activeCategories,
        socialLinks: activeSocials,
        carriers: activeCarriers.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          supportsHome: c.supportsHome,
          supportsStopDesk: c.supportsStopDesk
        })),
        shippingRates: rates,
        wilayas: ALGERIA_WILAYAS
      });
    } catch (error) {
      console.error("Bootstrap error:", error);
      return res.status(500).json({ error: "Impossible de charger la boutique." });
    }
  });
  app2.get("/api/products", async (req, res) => {
    try {
      const q = String(req.query.q || "").trim().toLowerCase();
      const categorySlug = String(req.query.category || "").trim();
      const group = String(req.query.group || "").trim();
      const type = String(req.query.type || "").trim();
      const featured = req.query.featured === "true";
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
      const sort = String(req.query.sort || "featured");
      const allCategories = await db.select().from(categories);
      const catMap = new Map(allCategories.map((c) => [c.id, c]));
      const allProducts = await db.select().from(products).where(eq4(products.isActive, true)).orderBy(desc(products.isFeatured), desc(products.createdAt));
      const allImages = await db.select().from(productImages).orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
      const imagesByProduct = /* @__PURE__ */ new Map();
      for (const img of allImages) {
        const list = imagesByProduct.get(img.productId) || [];
        list.push(img);
        imagesByProduct.set(img.productId, list);
      }
      const approvedReviews = await db.select({ productId: productReviews.productId, rating: productReviews.rating }).from(productReviews).where(eq4(productReviews.status, "approved"));
      const ratingsByProduct = /* @__PURE__ */ new Map();
      for (const r of approvedReviews) {
        const arr = ratingsByProduct.get(r.productId) || [];
        arr.push(r.rating);
        ratingsByProduct.set(r.productId, arr);
      }
      let enriched = allProducts.map((p) => {
        const cat = p.categoryId ? catMap.get(p.categoryId) : null;
        const imgs = imagesByProduct.get(p.id) || [];
        const reviewStats = calculateReviewSummary(ratingsByProduct.get(p.id) || []);
        return {
          id: p.id,
          sku: p.sku,
          name: p.name,
          slug: p.slug,
          brand: p.brand,
          shortDescription: p.shortDescription,
          description: p.description,
          productType: p.productType,
          priceDzd: p.priceDzd,
          compareAtPriceDzd: p.compareAtPriceDzd,
          stockQuantity: p.stockQuantity,
          isFeatured: p.isFeatured,
          digitalAvailability: p.digitalAvailability,
          categoryId: p.categoryId,
          categoryName: cat?.name || "Non class\xE9",
          categorySlug: cat?.slug || "",
          categoryGroup: cat?.categoryGroup || "accessories",
          primaryImage: imgs[0]?.url || null,
          images: imgs.map((i) => ({ id: i.id, url: i.url, altText: i.altText, isPrimary: i.isPrimary })),
          averageRating: reviewStats.averageRating,
          reviewCount: reviewStats.reviewCount
        };
      });
      if (q) {
        enriched = enriched.filter(
          (p) => p.name.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.categoryName.toLowerCase().includes(q) || (p.shortDescription || "").toLowerCase().includes(q)
        );
      }
      if (categorySlug) {
        enriched = enriched.filter((p) => p.categorySlug === categorySlug);
      }
      if (group) {
        enriched = enriched.filter((p) => p.categoryGroup === group);
      }
      if (type === "physical" || type === "digital") {
        enriched = enriched.filter((p) => p.productType === type);
      }
      if (featured) {
        enriched = enriched.filter((p) => p.isFeatured);
      }
      if (minPrice !== null && Number.isFinite(minPrice)) {
        enriched = enriched.filter((p) => p.priceDzd >= minPrice);
      }
      if (maxPrice !== null && Number.isFinite(maxPrice)) {
        enriched = enriched.filter((p) => p.priceDzd <= maxPrice);
      }
      if (sort === "price_asc") enriched.sort((a, b) => a.priceDzd - b.priceDzd);
      else if (sort === "price_desc") enriched.sort((a, b) => b.priceDzd - a.priceDzd);
      else if (sort === "rating") enriched.sort((a, b) => b.averageRating - a.averageRating);
      else if (sort === "newest") enriched.sort((a, b) => b.id - a.id);
      return res.json({ products: enriched });
    } catch (error) {
      console.error("Products list error:", error);
      return res.status(500).json({ error: "Erreur lors du chargement du catalogue." });
    }
  });
  app2.get("/api/products/:slug", async (req, res) => {
    try {
      const slug = req.params.slug;
      const [product] = await db.select().from(products).where(and2(eq4(products.slug, slug), eq4(products.isActive, true)));
      if (!product) {
        return res.status(404).json({ error: "Produit introuvable." });
      }
      const cat = product.categoryId ? (await db.select().from(categories).where(eq4(categories.id, product.categoryId)))[0] : null;
      const imgs = await db.select().from(productImages).where(eq4(productImages.productId, product.id)).orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
      const reviews = await db.select({
        id: productReviews.id,
        customerName: productReviews.customerName,
        rating: productReviews.rating,
        title: productReviews.title,
        comment: productReviews.comment,
        isVerifiedPurchase: productReviews.isVerifiedPurchase,
        adminReply: productReviews.adminReply,
        createdAt: productReviews.createdAt
      }).from(productReviews).where(and2(eq4(productReviews.productId, product.id), eq4(productReviews.status, "approved"))).orderBy(desc(productReviews.createdAt));
      const reviewSummary = calculateReviewSummary(reviews.map((r) => r.rating));
      return res.json({
        product: {
          id: product.id,
          sku: product.sku,
          name: product.name,
          slug: product.slug,
          brand: product.brand,
          shortDescription: product.shortDescription,
          description: product.description,
          productType: product.productType,
          priceDzd: product.priceDzd,
          compareAtPriceDzd: product.compareAtPriceDzd,
          stockQuantity: product.stockQuantity,
          digitalAvailability: product.digitalAvailability,
          digitalActivationNote: product.productType === "digital" ? "Livraison et activation effectu\xE9es apr\xE8s validation de votre commande et du paiement. Aucun identifiant n\u2019est expos\xE9 publiquement." : null,
          categoryId: product.categoryId,
          categoryName: cat?.name || "Non class\xE9",
          categorySlug: cat?.slug || "",
          categoryGroup: cat?.categoryGroup || "accessories",
          images: imgs,
          averageRating: reviewSummary.averageRating,
          reviewCount: reviewSummary.reviewCount,
          ratingDistribution: reviewSummary.distribution
        },
        reviews
      });
    } catch (error) {
      console.error("Product detail error:", error);
      return res.status(500).json({ error: "Erreur lors du chargement du produit." });
    }
  });
  app2.post("/api/products/:id/reviews", async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const { orderReference, phone, rating, title, comment } = req.body || {};
      if (!Number.isInteger(productId)) {
        return res.status(400).json({ error: "Produit invalide." });
      }
      if (!orderReference || !phone || !comment || typeof rating !== "number") {
        return res.status(400).json({
          error: "Veuillez renseigner votre r\xE9f\xE9rence de commande, t\xE9l\xE9phone, note (1-5) et avis \xE9crit."
        });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: "La note doit \xEAtre comprise entre 1 et 5 \xE9toiles." });
      }
      if (String(comment).trim().length < 8) {
        return res.status(400).json({ error: "Votre avis doit contenir au moins 8 caract\xE8res." });
      }
      const normalizedPhone = normalizeAlgerianPhone(String(phone));
      const cleanRef = String(orderReference).trim().toUpperCase();
      const [order] = await db.select().from(orders).where(eq4(orders.reference, cleanRef));
      if (!order || normalizeAlgerianPhone(order.phone) !== normalizedPhone) {
        return res.status(403).json({
          error: "Aucune commande correspondante trouv\xE9e pour cette r\xE9f\xE9rence et ce num\xE9ro de t\xE9l\xE9phone."
        });
      }
      if (order.status === "annulee" || order.status === "retournee") {
        return res.status(403).json({
          error: "Impossible de laisser un avis pour une commande annul\xE9e ou retourn\xE9e."
        });
      }
      const items = await db.select().from(orderItems).where(and2(eq4(orderItems.orderId, order.id), eq4(orderItems.productId, productId)));
      if (items.length === 0) {
        return res.status(403).json({
          error: "Ce produit ne figure pas dans la commande indiqu\xE9e. Seuls les acheteurs v\xE9rifi\xE9s peuvent d\xE9poser un avis."
        });
      }
      const duplicate = await db.select().from(productReviews).where(
        and2(
          eq4(productReviews.productId, productId),
          eq4(productReviews.orderId, order.id)
        )
      );
      if (duplicate.length > 0) {
        return res.status(409).json({
          error: "Un avis a d\xE9j\xE0 \xE9t\xE9 soumis pour ce produit avec cette commande."
        });
      }
      const [created] = await db.insert(productReviews).values({
        productId,
        orderId: order.id,
        orderReference: order.reference,
        customerName: `${order.firstName} ${order.lastName.charAt(0).toUpperCase()}.`,
        customerPhone: normalizedPhone,
        rating: Math.round(rating),
        title: String(title || "").trim().slice(0, 120),
        comment: String(comment).trim().slice(0, 1500),
        isVerifiedPurchase: true,
        status: "pending"
      }).returning();
      return res.status(201).json({
        message: "Merci ! Votre avis d\u2019acheteur v\xE9rifi\xE9 a \xE9t\xE9 envoy\xE9 pour mod\xE9ration par notre \xE9quipe.",
        review: {
          id: created.id,
          status: created.status,
          rating: created.rating
        }
      });
    } catch (error) {
      console.error("Review submission error:", error);
      return res.status(500).json({ error: "Erreur lors de l\u2019envoi de votre avis." });
    }
  });
  app2.post("/api/checkout/calculate", async (req, res) => {
    try {
      const { items, wilayaCode, deliveryType, carrierId, promoCode } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Votre panier est vide." });
      }
      const productIds = items.map((i) => Number(i.productId)).filter(Number.isInteger);
      const dbProducts = await db.select().from(products).where(inArray(products.id, productIds));
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
      let subtotalDzd = 0;
      let hasPhysical = false;
      let hasDigital = false;
      for (const line of items) {
        const prod = prodMap.get(Number(line.productId));
        if (!prod || !prod.isActive) {
          return res.status(400).json({ error: "Un article du panier n\u2019est plus disponible." });
        }
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        subtotalDzd += prod.priceDzd * qty;
        if (prod.productType === "digital") hasDigital = true;
        else hasPhysical = true;
      }
      let shippingFeeDzd = 0;
      let resolvedCarrierId = null;
      let resolvedCarrierName = null;
      let estimatedDays = null;
      if (hasPhysical && wilayaCode) {
        const normWilaya = String(wilayaCode).padStart(2, "0");
        let rateRows = await db.select().from(shippingRates).where(and2(eq4(shippingRates.wilayaCode, normWilaya), eq4(shippingRates.isActive, true)));
        if (carrierId) {
          const matching = rateRows.filter((r) => r.carrierId === Number(carrierId));
          if (matching.length > 0) rateRows = matching;
        }
        const chosenRate = rateRows[0];
        if (!chosenRate) {
          return res.status(400).json({
            error: "Aucun tarif de livraison configur\xE9 pour cette wilaya. Contactez-nous sur WhatsApp."
          });
        }
        const [carrier] = await db.select().from(carriers).where(eq4(carriers.id, chosenRate.carrierId));
        resolvedCarrierId = chosenRate.carrierId;
        resolvedCarrierName = carrier?.name || "Transporteur configur\xE9";
        estimatedDays = chosenRate.estimatedDays;
        shippingFeeDzd = deliveryType === "stop_desk" ? chosenRate.stopDeskPriceDzd : chosenRate.homePriceDzd;
      }
      let discountDzd = 0;
      let promoFeedback = null;
      if (promoCode && String(promoCode).trim()) {
        const code = String(promoCode).trim().toUpperCase();
        const [promo] = await db.select().from(promotions).where(and2(eq4(promotions.code, code), eq4(promotions.isActive, true)));
        if (!promo) {
          promoFeedback = { applied: false, message: "Code promotionnel invalide ou expir\xE9." };
        } else if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
          promoFeedback = { applied: false, message: "Ce code promo a atteint sa limite d\u2019utilisation." };
        } else if (promo.endsAt && new Date(promo.endsAt) < /* @__PURE__ */ new Date()) {
          promoFeedback = { applied: false, message: "Ce code promo est expir\xE9." };
        } else {
          const calc = calculatePromoDiscount({
            subtotalDzd,
            shippingFeeDzd,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            minOrderDzd: promo.minOrderDzd
          });
          if (!calc.valid) {
            promoFeedback = { applied: false, message: calc.reason || "Conditions non remplies." };
          } else {
            discountDzd = calc.discountDzd;
            shippingFeeDzd = calc.effectiveShippingDzd;
            promoFeedback = { applied: true, code: promo.code, message: `Code ${promo.code} appliqu\xE9.` };
          }
        }
      }
      const totalDzd = Math.max(0, subtotalDzd - discountDzd + shippingFeeDzd);
      return res.json({
        subtotalDzd,
        discountDzd,
        shippingFeeDzd,
        totalDzd,
        hasPhysical,
        hasDigital,
        carrierId: resolvedCarrierId,
        carrierName: resolvedCarrierName,
        estimatedDays,
        promoFeedback
      });
    } catch (error) {
      console.error("Checkout calculate error:", error);
      return res.status(500).json({ error: "Erreur lors du calcul du total." });
    }
  });
  app2.post("/api/orders", async (req, res) => {
    try {
      const {
        firstName,
        lastName,
        phone,
        wilayaCode,
        commune,
        address,
        deliveryType,
        carrierId,
        promoCode,
        items,
        source,
        customerNotes
      } = req.body || {};
      if (!String(firstName || "").trim() || !String(lastName || "").trim() || !String(phone || "").trim() || !String(wilayaCode || "").trim() || !String(commune || "").trim() || !String(address || "").trim()) {
        return res.status(400).json({
          error: "Tous les champs obligatoires doivent \xEAtre remplis (Nom, Pr\xE9nom, T\xE9l\xE9phone, Wilaya, Commune, Adresse)."
        });
      }
      if (!isValidAlgerianPhone(String(phone))) {
        return res.status(400).json({
          error: "Num\xE9ro de t\xE9l\xE9phone alg\xE9rien invalide (ex. 0550 12 34 56)."
        });
      }
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: "Votre panier est vide." });
      }
      const normalizedPhone = normalizeAlgerianPhone(String(phone));
      const normWilaya = String(wilayaCode).padStart(2, "0");
      const wilaya = getWilayaByCode(normWilaya);
      if (!wilaya) {
        return res.status(400).json({ error: "Wilaya s\xE9lectionn\xE9e invalide." });
      }
      const [existingCustomer] = await db.select().from(customers).where(eq4(customers.phone, normalizedPhone));
      if (existingCustomer?.isBlocked) {
        return res.status(403).json({
          error: "Impossible de finaliser cette commande en ligne. Veuillez contacter la boutique par WhatsApp."
        });
      }
      const productIds = items.map((i) => Number(i.productId)).filter(Number.isInteger);
      const dbProducts = await db.select().from(products).where(inArray(products.id, productIds));
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));
      let subtotalDzd = 0;
      let hasPhysical = false;
      let hasDigital = false;
      const resolvedItems = [];
      for (const line of items) {
        const prod = prodMap.get(Number(line.productId));
        if (!prod || !prod.isActive) {
          return res.status(400).json({ error: "Un article s\xE9lectionn\xE9 n\u2019est plus disponible." });
        }
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        if (prod.productType === "physical" && prod.stockQuantity < qty) {
          return res.status(400).json({
            error: `Stock insuffisant pour "${prod.name}" (${prod.stockQuantity} disponible(s)).`
          });
        }
        if (prod.productType === "digital" && prod.digitalAvailability === "paused") {
          return res.status(400).json({
            error: `Le service num\xE9rique "${prod.name}" est temporairement indisponible.`
          });
        }
        const lineTotalDzd = prod.priceDzd * qty;
        subtotalDzd += lineTotalDzd;
        if (prod.productType === "digital") hasDigital = true;
        else hasPhysical = true;
        resolvedItems.push({ product: prod, quantity: qty, lineTotalDzd });
      }
      let effectiveDeliveryType = hasPhysical ? deliveryType === "stop_desk" ? "stop_desk" : "home" : "digital";
      let shippingFeeDzd = 0;
      let resolvedCarrierId = null;
      let resolvedCarrierName = null;
      if (hasPhysical) {
        let rateRows = await db.select().from(shippingRates).where(and2(eq4(shippingRates.wilayaCode, normWilaya), eq4(shippingRates.isActive, true)));
        if (carrierId) {
          const matching = rateRows.filter((r) => r.carrierId === Number(carrierId));
          if (matching.length > 0) rateRows = matching;
        }
        const rate = rateRows[0];
        if (!rate) {
          return res.status(400).json({ error: "Tarif de livraison non configur\xE9 pour cette wilaya." });
        }
        const [carrier] = await db.select().from(carriers).where(eq4(carriers.id, rate.carrierId));
        resolvedCarrierId = rate.carrierId;
        resolvedCarrierName = carrier?.name || "Transporteur configur\xE9";
        shippingFeeDzd = effectiveDeliveryType === "stop_desk" ? rate.stopDeskPriceDzd : rate.homePriceDzd;
      }
      let discountDzd = 0;
      let appliedPromoCode = null;
      if (promoCode && String(promoCode).trim()) {
        const code = String(promoCode).trim().toUpperCase();
        const [promo] = await db.select().from(promotions).where(and2(eq4(promotions.code, code), eq4(promotions.isActive, true)));
        if (promo && (promo.maxUses === null || promo.usedCount < promo.maxUses)) {
          const calc = calculatePromoDiscount({
            subtotalDzd,
            shippingFeeDzd,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
            minOrderDzd: promo.minOrderDzd
          });
          if (calc.valid) {
            discountDzd = calc.discountDzd;
            shippingFeeDzd = calc.effectiveShippingDzd;
            appliedPromoCode = promo.code;
            await db.update(promotions).set({ usedCount: promo.usedCount + 1 }).where(eq4(promotions.id, promo.id));
          }
        }
      }
      const totalDzd = Math.max(0, subtotalDzd - discountDzd + shippingFeeDzd);
      const [customer] = await db.insert(customers).values({
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: normalizedPhone,
        wilayaCode: wilaya.code,
        wilayaName: wilaya.name,
        commune: String(commune).trim(),
        address: String(address).trim()
      }).onConflictDoUpdate({
        target: customers.phone,
        set: {
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          wilayaCode: wilaya.code,
          wilayaName: wilaya.name,
          commune: String(commune).trim(),
          address: String(address).trim(),
          updatedAt: /* @__PURE__ */ new Date()
        }
      }).returning();
      const countRes = await db.select({ count: sql2`count(*)::int` }).from(orders);
      const nextSeq = (countRes[0]?.count ?? 0) + 101;
      const reference = generateOrderReference(nextSeq);
      const [createdOrder] = await db.insert(orders).values({
        reference,
        customerId: customer.id,
        firstName: String(firstName).trim(),
        lastName: String(lastName).trim(),
        phone: normalizedPhone,
        wilayaCode: wilaya.code,
        wilayaName: wilaya.name,
        commune: String(commune).trim(),
        address: String(address).trim(),
        deliveryType: effectiveDeliveryType,
        carrierId: resolvedCarrierId,
        carrierName: resolvedCarrierName,
        status: "nouvelle",
        paymentMethod: hasPhysical ? "cod" : "manual_digital",
        paymentStatus: "pending",
        promoCode: appliedPromoCode,
        subtotalDzd,
        discountDzd,
        shippingFeeDzd,
        totalDzd,
        hasDigitalItems: hasDigital,
        hasPhysicalItems: hasPhysical,
        stockDeducted: false,
        source: source === "whatsapp" ? "whatsapp" : "web",
        customerNotes: customerNotes ? String(customerNotes).trim().slice(0, 500) : null
      }).returning();
      for (const item of resolvedItems) {
        const [oi] = await db.insert(orderItems).values({
          orderId: createdOrder.id,
          productId: item.product.id,
          productName: item.product.name,
          productSku: item.product.sku,
          productType: item.product.productType,
          unitPriceDzd: item.product.priceDzd,
          costPriceDzd: item.product.costPriceDzd,
          quantity: item.quantity,
          lineTotalDzd: item.lineTotalDzd
        }).returning();
        if (item.product.productType === "digital") {
          await db.insert(digitalDeliveries).values({
            orderId: createdOrder.id,
            orderItemId: oi.id,
            productId: item.product.id,
            productName: item.product.name,
            deliveryStatus: "pending",
            activationInstructions: item.product.digitalActivationTemplate || "",
            privateFulfillmentNote: ""
          });
        }
      }
      await db.insert(orderStatusHistory).values({
        orderId: createdOrder.id,
        fromStatus: null,
        toStatus: "nouvelle",
        note: source === "whatsapp" ? "Commande enregistr\xE9e via bouton WhatsApp" : "Commande re\xE7ue depuis la boutique en ligne",
        changedBy: "client"
      });
      return res.status(201).json({
        order: createdOrder,
        items: resolvedItems.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unitPriceDzd: i.product.priceDzd,
          lineTotalDzd: i.lineTotalDzd,
          productType: i.product.productType
        }))
      });
    } catch (error) {
      console.error("Order creation error:", error);
      return res.status(500).json({ error: "Erreur lors de la validation de la commande." });
    }
  });
  app2.get("/api/orders/track", async (req, res) => {
    try {
      const ref = String(req.query.reference || "").trim().toUpperCase();
      const phone = String(req.query.phone || "").trim();
      if (!ref) {
        return res.status(400).json({ error: "Veuillez saisir votre r\xE9f\xE9rence de commande (ex. 2FP-2026-000101)." });
      }
      const [order] = await db.select().from(orders).where(eq4(orders.reference, ref));
      if (!order) {
        return res.status(404).json({ error: `Aucune commande trouv\xE9e avec la r\xE9f\xE9rence ${ref}.` });
      }
      const phoneMatches = phone ? normalizeAlgerianPhone(phone) === normalizeAlgerianPhone(order.phone) : false;
      const items = await db.select().from(orderItems).where(eq4(orderItems.orderId, order.id));
      const history = await db.select().from(orderStatusHistory).where(eq4(orderStatusHistory.orderId, order.id)).orderBy(asc(orderStatusHistory.createdAt));
      let digitalStatus = [];
      if (order.hasDigitalItems) {
        const deliveries = await db.select().from(digitalDeliveries).where(eq4(digitalDeliveries.orderId, order.id));
        digitalStatus = deliveries.map((d) => ({
          productName: d.productName,
          deliveryStatus: d.deliveryStatus,
          // NEVER expose credentials/privateFulfillmentNote publicly; only activation guide when delivered & phone verified
          activationInstructions: d.deliveryStatus === "delivered" && phoneMatches ? d.activationInstructions : void 0
        }));
      }
      return res.json({
        order: {
          reference: order.reference,
          status: order.status,
          firstName: order.firstName,
          wilayaName: order.wilayaName,
          commune: order.commune,
          deliveryType: order.deliveryType,
          carrierName: order.carrierName,
          trackingNumber: order.trackingNumber,
          subtotalDzd: order.subtotalDzd,
          discountDzd: order.discountDzd,
          shippingFeeDzd: order.shippingFeeDzd,
          totalDzd: order.totalDzd,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          hasDigitalItems: order.hasDigitalItems,
          createdAt: order.createdAt
        },
        items,
        history,
        digitalDeliveries: digitalStatus
      });
    } catch (error) {
      console.error("Order tracking error:", error);
      return res.status(500).json({ error: "Erreur lors du suivi de la commande." });
    }
  });
  app2.get("/api/admin/me", requireAdmin, (req, res) => {
    return res.json({ admin: req.adminUser });
  });
  app2.get("/api/admin/dashboard", requireAdmin, async (_req, res) => {
    try {
      await syncAllLowStockAlerts();
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const allSales = await db.select().from(sales).orderBy(desc(sales.recordedAt));
      const allProducts = await db.select().from(products);
      const allCustomers = await db.select().from(customers);
      const activeAlerts = await db.select().from(stockAlerts).where(eq4(stockAlerts.status, "active")).orderBy(asc(stockAlerts.currentStock));
      const pendingReviews = await db.select({ count: sql2`count(*)::int` }).from(productReviews).where(eq4(productReviews.status, "pending"));
      const pendingDigital = await db.select({ count: sql2`count(*)::int` }).from(digitalDeliveries).where(eq4(digitalDeliveries.deliveryStatus, "pending"));
      const allImgs = await db.select({ productId: productImages.productId }).from(productImages);
      const productsWithPhotos = new Set(allImgs.map((i) => i.productId));
      const productsWithoutPhotos = allProducts.filter((p) => !productsWithPhotos.has(p.id)).length;
      const statusCounts = {
        nouvelle: 0,
        a_confirmer: 0,
        confirmee: 0,
        en_preparation: 0,
        expediee: 0,
        livree: 0,
        annulee: 0,
        retournee: 0
      };
      for (const o of allOrders) {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      }
      const totalOrders = allOrders.length;
      const confirmedOrFurther = statusCounts.confirmee + statusCounts.en_preparation + statusCounts.expediee + statusCounts.livree + statusCounts.retournee;
      const confirmationRate = totalOrders > 0 ? Math.round(confirmedOrFurther / totalOrders * 100) : 0;
      const shippedOrFinished = statusCounts.expediee + statusCounts.livree + statusCounts.retournee;
      const deliveryRate = shippedOrFinished > 0 ? Math.round(statusCounts.livree / shippedOrFinished * 100) : 0;
      const returnRate = shippedOrFinished > 0 ? Math.round(statusCounts.retournee / shippedOrFinished * 100) : 0;
      const deliveredRevenueDzd = allSales.reduce((acc, s) => acc + s.totalCollectedDzd, 0);
      const estimatedMarginDzd = allSales.reduce((acc, s) => acc + s.estimatedMarginDzd, 0);
      const pendingPipelineDzd = allOrders.filter((o) => !["livree", "annulee", "retournee"].includes(o.status)).reduce((acc, o) => acc + o.totalDzd, 0);
      const stockValuationDzd = allProducts.filter((p) => p.productType === "physical").reduce((acc, p) => acc + p.stockQuantity * p.priceDzd, 0);
      const dayMap = /* @__PURE__ */ new Map();
      for (let i = 13; i >= 0; i--) {
        const d = /* @__PURE__ */ new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().slice(0, 10);
        dayMap.set(key, { date: key.slice(5), commandes: 0, ventesDzd: 0 });
      }
      for (const o of allOrders) {
        const key = new Date(o.createdAt).toISOString().slice(0, 10);
        const entry = dayMap.get(key);
        if (entry) entry.commandes += 1;
      }
      for (const s of allSales) {
        const key = new Date(s.recordedAt).toISOString().slice(0, 10);
        const entry = dayMap.get(key);
        if (entry) entry.ventesDzd += s.totalCollectedDzd;
      }
      const wilayaCounts = /* @__PURE__ */ new Map();
      for (const o of allOrders) {
        wilayaCounts.set(o.wilayaName, (wilayaCounts.get(o.wilayaName) || 0) + 1);
      }
      const topWilayas = Array.from(wilayaCounts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([wilaya, count]) => ({ wilaya, count }));
      return res.json({
        kpis: {
          totalOrders,
          newOrders: statusCounts.nouvelle + statusCounts.a_confirmer,
          deliveredRevenueDzd,
          estimatedMarginDzd,
          pendingPipelineDzd,
          confirmationRate,
          deliveryRate,
          returnRate,
          totalProducts: allProducts.length,
          productsWithoutPhotos,
          totalCustomers: allCustomers.length,
          stockValuationDzd,
          activeLowStockCount: activeAlerts.length,
          pendingReviewsCount: pendingReviews[0]?.count ?? 0,
          pendingDigitalCount: pendingDigital[0]?.count ?? 0
        },
        statusCounts,
        chartSeries: Array.from(dayMap.values()),
        topWilayas,
        activeLowStockAlerts: activeAlerts,
        recentOrders: allOrders.slice(0, 8)
      });
    } catch (error) {
      console.error("Admin dashboard error:", error);
      return res.status(500).json({ error: "Erreur lors du chargement du tableau de bord." });
    }
  });
  app2.get("/api/admin/orders", requireAdmin, async (_req, res) => {
    try {
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const allItems = await db.select().from(orderItems);
      const allHistory = await db.select().from(orderStatusHistory).orderBy(desc(orderStatusHistory.createdAt));
      const itemsByOrder = /* @__PURE__ */ new Map();
      for (const item of allItems) {
        const list = itemsByOrder.get(item.orderId) || [];
        list.push(item);
        itemsByOrder.set(item.orderId, list);
      }
      const historyByOrder = /* @__PURE__ */ new Map();
      for (const h of allHistory) {
        const list = historyByOrder.get(h.orderId) || [];
        list.push(h);
        historyByOrder.set(h.orderId, list);
      }
      const phoneStats = /* @__PURE__ */ new Map();
      for (const o of allOrders) {
        const key = normalizeAlgerianPhone(o.phone);
        const st = phoneStats.get(key) || { total: 0, delivered: 0, returned: 0, cancelled: 0 };
        st.total += 1;
        if (o.status === "livree") st.delivered += 1;
        if (o.status === "retournee") st.returned += 1;
        if (o.status === "annulee") st.cancelled += 1;
        phoneStats.set(key, st);
      }
      const enriched = allOrders.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) || [],
        history: historyByOrder.get(o.id) || [],
        phoneReliability: phoneStats.get(normalizeAlgerianPhone(o.phone)) || {
          total: 1,
          delivered: 0,
          returned: 0,
          cancelled: 0
        }
      }));
      return res.json({ orders: enriched });
    } catch (error) {
      console.error("Admin orders list error:", error);
      return res.status(500).json({ error: "Erreur lors du chargement des commandes." });
    }
  });
  app2.patch("/api/admin/orders/:id", requireAdmin, async (req, res) => {
    try {
      const orderId = Number(req.params.id);
      const { status, trackingNumber, carrierId, adminNotes, paymentStatus, note } = req.body || {};
      const [existing] = await db.select().from(orders).where(eq4(orders.id, orderId));
      if (!existing) return res.status(404).json({ error: "Commande introuvable." });
      const nextStatus = status || existing.status;
      let nextCarrierName = existing.carrierName;
      let nextCarrierId = existing.carrierId;
      if (carrierId !== void 0) {
        if (carrierId === null || carrierId === "") {
          nextCarrierId = null;
          nextCarrierName = null;
        } else {
          const [c] = await db.select().from(carriers).where(eq4(carriers.id, Number(carrierId)));
          if (c) {
            nextCarrierId = c.id;
            nextCarrierName = c.name;
          }
        }
      }
      let stockDeducted = existing.stockDeducted;
      const items = await db.select().from(orderItems).where(eq4(orderItems.orderId, orderId));
      const actor = req.adminUser?.email || "admin";
      if (!stockDeducted && shouldDeductStockOnStatus(nextStatus)) {
        for (const item of items) {
          if (item.productId && item.productType === "physical") {
            const [prod] = await db.select().from(products).where(eq4(products.id, item.productId));
            if (prod) {
              const newQty = Math.max(0, prod.stockQuantity - item.quantity);
              await db.update(products).set({ stockQuantity: newQty, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId,
                delta: -item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `Commande ${existing.reference} (${nextStatus})`,
                createdBy: actor
              });
              await evaluateProductLowStock(prod.id);
            }
          }
        }
        stockDeducted = true;
      }
      if (stockDeducted && nextStatus === "annulee" && existing.status !== "annulee") {
        for (const item of items) {
          if (item.productId && item.productType === "physical") {
            const [prod] = await db.select().from(products).where(eq4(products.id, item.productId));
            if (prod) {
              const newQty = prod.stockQuantity + item.quantity;
              await db.update(products).set({ stockQuantity: newQty, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId,
                delta: item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `Annulation commande ${existing.reference}`,
                createdBy: actor
              });
              await evaluateProductLowStock(prod.id);
            }
          }
        }
        stockDeducted = false;
      }
      const nextPaymentStatus = paymentStatus || (nextStatus === "livree" ? "paid" : existing.paymentStatus);
      const [updated] = await db.update(orders).set({
        status: nextStatus,
        trackingNumber: trackingNumber !== void 0 ? trackingNumber : existing.trackingNumber,
        carrierId: nextCarrierId,
        carrierName: nextCarrierName,
        adminNotes: adminNotes !== void 0 ? adminNotes : existing.adminNotes,
        paymentStatus: nextPaymentStatus,
        stockDeducted,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(orders.id, orderId)).returning();
      if (nextStatus !== existing.status) {
        await db.insert(orderStatusHistory).values({
          orderId,
          fromStatus: existing.status,
          toStatus: nextStatus,
          note: note || `Statut modifi\xE9 vers ${nextStatus}`,
          changedBy: actor
        });
      }
      if (nextStatus === "livree") {
        const cogs = items.reduce((acc, i) => acc + i.costPriceDzd * i.quantity, 0);
        const estimatedMargin = Math.max(0, existing.subtotalDzd - existing.discountDzd - cogs);
        await db.insert(sales).values({
          orderId: existing.id,
          orderReference: existing.reference,
          customerName: `${existing.firstName} ${existing.lastName}`,
          wilayaName: existing.wilayaName,
          itemsRevenueDzd: existing.subtotalDzd,
          discountDzd: existing.discountDzd,
          shippingFeeDzd: existing.shippingFeeDzd,
          costOfGoodsDzd: cogs,
          totalCollectedDzd: existing.totalDzd,
          estimatedMarginDzd: estimatedMargin
        }).onConflictDoNothing({ target: sales.orderId });
      }
      if (nextStatus === "retournee" && existing.status !== "retournee") {
        const existingReturn = await db.select().from(returns).where(eq4(returns.orderId, orderId));
        if (existingReturn.length === 0) {
          await db.insert(returns).values({
            orderId,
            orderReference: existing.reference,
            customerName: `${existing.firstName} ${existing.lastName}`,
            phone: existing.phone,
            wilayaName: existing.wilayaName,
            reason: note || "Colis retourn\xE9 par transporteur",
            condition: "intact",
            restocked: false,
            returnFeeDzd: 0,
            status: "en_cours"
          });
        }
      }
      return res.json({ order: updated });
    } catch (error) {
      console.error("Update order error:", error);
      return res.status(500).json({ error: "Erreur lors de la mise \xE0 jour de la commande." });
    }
  });
  app2.get("/api/admin/sales", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(sales).orderBy(desc(sales.recordedAt));
      return res.json({ sales: list });
    } catch (error) {
      console.error("Admin sales error:", error);
      return res.status(500).json({ error: "Erreur lors du chargement des ventes." });
    }
  });
  app2.get("/api/admin/categories", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
      return res.json({ categories: list });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement cat\xE9gories." });
    }
  });
  app2.post("/api/admin/categories", requireAdmin, async (req, res) => {
    try {
      const { name, categoryGroup, description, sortOrder, isActive } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Le nom de cat\xE9gorie est obligatoire." });
      }
      const slug = slugify(String(name));
      const [created] = await db.insert(categories).values({
        name: String(name).trim(),
        slug,
        categoryGroup: categoryGroup || "accessories",
        description: description || null,
        sortOrder: Number(sortOrder) || 0,
        isActive: isActive !== false
      }).returning();
      return res.status(201).json({ category: created });
    } catch (error) {
      return res.status(400).json({ error: "Impossible de cr\xE9er cette cat\xE9gorie (nom ou slug d\xE9j\xE0 existant)." });
    }
  });
  app2.patch("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, categoryGroup, description, sortOrder, isActive } = req.body || {};
      const [existing] = await db.select().from(categories).where(eq4(categories.id, id));
      if (!existing) return res.status(404).json({ error: "Cat\xE9gorie introuvable." });
      const nextName = name ? String(name).trim() : existing.name;
      const [updated] = await db.update(categories).set({
        name: nextName,
        slug: name ? slugify(nextName) : existing.slug,
        categoryGroup: categoryGroup || existing.categoryGroup,
        description: description !== void 0 ? description : existing.description,
        sortOrder: sortOrder !== void 0 ? Number(sortOrder) : existing.sortOrder,
        isActive: isActive !== void 0 ? Boolean(isActive) : existing.isActive
      }).where(eq4(categories.id, id)).returning();
      return res.json({ category: updated });
    } catch (error) {
      return res.status(400).json({ error: "Erreur lors de la mise \xE0 jour de la cat\xE9gorie." });
    }
  });
  app2.delete("/api/admin/categories/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(categories).where(eq4(categories.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression cat\xE9gorie." });
    }
  });
  app2.get("/api/admin/products", requireAdmin, async (_req, res) => {
    try {
      const [settingsRow] = await db.select().from(storeSettings).limit(1);
      const globalThreshold = settingsRow?.defaultLowStockThreshold ?? 10;
      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map((c) => [c.id, c]));
      const allProds = await db.select().from(products).orderBy(desc(products.createdAt));
      const allImgs = await db.select().from(productImages).orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
      const imgMap = /* @__PURE__ */ new Map();
      for (const img of allImgs) {
        const arr = imgMap.get(img.productId) || [];
        arr.push(img);
        imgMap.set(img.productId, arr);
      }
      const enriched = allProds.map((p) => {
        const imgs = imgMap.get(p.id) || [];
        const cat = p.categoryId ? catMap.get(p.categoryId) : null;
        const effectiveThreshold = computeEffectiveLowStockThreshold(p.lowStockThreshold, globalThreshold);
        return {
          ...p,
          categoryName: cat?.name || "Non class\xE9",
          categoryGroup: cat?.categoryGroup || "accessories",
          images: imgs,
          primaryImage: imgs[0]?.url || null,
          hasPhotos: imgs.length > 0,
          effectiveLowStockThreshold: effectiveThreshold,
          isLowStock: p.productType === "physical" && p.stockQuantity <= effectiveThreshold
        };
      });
      return res.json({ products: enriched, globalLowStockThreshold: globalThreshold });
    } catch (error) {
      console.error("Admin products error:", error);
      return res.status(500).json({ error: "Erreur lors du chargement des produits." });
    }
  });
  app2.post("/api/admin/products", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.name || !String(b.name).trim()) {
        return res.status(400).json({ error: "Le nom du produit est obligatoire." });
      }
      const cleanName = String(b.name).trim();
      const baseSlug = slugify(cleanName);
      const uniqueSuffix = Date.now().toString(36).slice(-4);
      const sku = String(b.sku || `2FP-${uniqueSuffix.toUpperCase()}`).trim();
      const slug = `${baseSlug}-${uniqueSuffix}`;
      const [created] = await db.insert(products).values({
        categoryId: b.categoryId ? Number(b.categoryId) : null,
        sku,
        barcode: b.barcode ? String(b.barcode).trim() : null,
        name: cleanName,
        slug,
        brand: b.brand ? String(b.brand).trim() : null,
        shortDescription: b.shortDescription ? String(b.shortDescription).trim() : null,
        description: b.description ? String(b.description).trim() : "",
        productType: b.productType === "digital" ? "digital" : "physical",
        priceDzd: Math.max(0, Math.round(Number(b.priceDzd) || 0)),
        compareAtPriceDzd: b.compareAtPriceDzd ? Math.round(Number(b.compareAtPriceDzd)) : null,
        costPriceDzd: Math.max(0, Math.round(Number(b.costPriceDzd) || 0)),
        stockQuantity: Math.max(0, Math.round(Number(b.stockQuantity) || 0)),
        lowStockThreshold: b.lowStockThreshold !== "" && b.lowStockThreshold !== null && b.lowStockThreshold !== void 0 ? Math.max(0, Math.round(Number(b.lowStockThreshold))) : null,
        isFeatured: Boolean(b.isFeatured),
        isActive: b.isActive !== false,
        digitalAvailability: b.productType === "digital" ? b.digitalAvailability || "available" : null,
        digitalActivationTemplate: b.digitalActivationTemplate || null
      }).returning();
      if (b.imageUrl && String(b.imageUrl).trim()) {
        await db.insert(productImages).values({
          productId: created.id,
          url: String(b.imageUrl).trim(),
          altText: created.name,
          sortOrder: 0,
          isPrimary: true
        });
      }
      await evaluateProductLowStock(created.id);
      return res.status(201).json({ product: created });
    } catch (error) {
      console.error("Create product error:", error);
      return res.status(400).json({ error: "Impossible de cr\xE9er le produit (SKU d\xE9j\xE0 utilis\xE9 ou donn\xE9es invalides)." });
    }
  });
  app2.patch("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(products).where(eq4(products.id, id));
      if (!existing) return res.status(404).json({ error: "Produit introuvable." });
      const nextQty = b.stockQuantity !== void 0 ? Math.max(0, Math.round(Number(b.stockQuantity))) : existing.stockQuantity;
      const nextThreshold = b.lowStockThreshold === "" || b.lowStockThreshold === null ? null : b.lowStockThreshold !== void 0 ? Math.max(0, Math.round(Number(b.lowStockThreshold))) : existing.lowStockThreshold;
      const [updated] = await db.update(products).set({
        categoryId: b.categoryId !== void 0 ? b.categoryId ? Number(b.categoryId) : null : existing.categoryId,
        sku: b.sku ? String(b.sku).trim() : existing.sku,
        barcode: b.barcode !== void 0 ? b.barcode ? String(b.barcode).trim() : null : existing.barcode,
        name: b.name ? String(b.name).trim() : existing.name,
        brand: b.brand !== void 0 ? b.brand ? String(b.brand).trim() : null : existing.brand,
        shortDescription: b.shortDescription !== void 0 ? b.shortDescription : existing.shortDescription,
        description: b.description !== void 0 ? b.description : existing.description,
        productType: b.productType ? b.productType === "digital" ? "digital" : "physical" : existing.productType,
        priceDzd: b.priceDzd !== void 0 ? Math.max(0, Math.round(Number(b.priceDzd))) : existing.priceDzd,
        compareAtPriceDzd: b.compareAtPriceDzd !== void 0 ? b.compareAtPriceDzd ? Math.round(Number(b.compareAtPriceDzd)) : null : existing.compareAtPriceDzd,
        costPriceDzd: b.costPriceDzd !== void 0 ? Math.max(0, Math.round(Number(b.costPriceDzd))) : existing.costPriceDzd,
        stockQuantity: nextQty,
        lowStockThreshold: nextThreshold,
        isFeatured: b.isFeatured !== void 0 ? Boolean(b.isFeatured) : existing.isFeatured,
        isActive: b.isActive !== void 0 ? Boolean(b.isActive) : existing.isActive,
        digitalAvailability: b.digitalAvailability !== void 0 ? b.digitalAvailability : existing.digitalAvailability,
        digitalActivationTemplate: b.digitalActivationTemplate !== void 0 ? b.digitalActivationTemplate : existing.digitalActivationTemplate,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(products.id, id)).returning();
      if (nextQty !== existing.stockQuantity) {
        await db.insert(stockMovements).values({
          productId: id,
          delta: nextQty - existing.stockQuantity,
          previousQty: existing.stockQuantity,
          newQty: nextQty,
          reason: "Modification fiche produit",
          createdBy: req.adminUser?.email || "admin"
        });
      }
      await evaluateProductLowStock(id);
      return res.json({ product: updated });
    } catch (error) {
      console.error("Update product error:", error);
      return res.status(400).json({ error: "Erreur lors de la mise \xE0 jour du produit." });
    }
  });
  app2.delete("/api/admin/products/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(products).where(eq4(products.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression produit." });
    }
  });
  app2.post("/api/admin/media/upload", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Aucun fichier image re\xE7u." });
      }
      if (!file.mimetype.startsWith("image/")) {
        return res.status(400).json({ error: "Seuls les fichiers image (PNG, JPG, WebP, SVG) sont accept\xE9s." });
      }
      if (file.size > 6 * 1024 * 1024) {
        return res.status(400).json({ error: "Image trop lourde (maximum 6 Mo)." });
      }
      const kind = String(req.body.kind || "product");
      const productId = req.body.productId ? Number(req.body.productId) : null;
      const [asset] = await db.insert(mediaAssets).values({
        filename: file.originalname,
        mimeType: file.mimetype,
        dataBase64: file.buffer.toString("base64"),
        sizeBytes: file.size,
        kind
      }).returning();
      const url = `/api/media/${asset.id}`;
      if (kind === "logo") {
        const [settings] = await db.select().from(storeSettings).limit(1);
        if (settings) {
          await db.update(storeSettings).set({ logoUrl: url, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(storeSettings.id, settings.id));
        }
        return res.status(201).json({ url, assetId: asset.id, kind: "logo" });
      }
      if (productId && Number.isInteger(productId)) {
        const existingImgs = await db.select().from(productImages).where(eq4(productImages.productId, productId));
        const [img] = await db.insert(productImages).values({
          productId,
          url,
          altText: file.originalname.replace(/\.[^.]+$/, ""),
          sortOrder: existingImgs.length,
          isPrimary: existingImgs.length === 0
        }).returning();
        return res.status(201).json({ url, assetId: asset.id, image: img });
      }
      return res.status(201).json({ url, assetId: asset.id });
    } catch (error) {
      console.error("Media upload error:", error);
      return res.status(500).json({ error: "Erreur lors du t\xE9l\xE9versement de l\u2019image." });
    }
  });
  app2.post("/api/admin/products/:id/images", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const { url, altText, isPrimary } = req.body || {};
      if (!url || !String(url).trim()) {
        return res.status(400).json({ error: "URL image requise." });
      }
      if (isPrimary) {
        await db.update(productImages).set({ isPrimary: false }).where(eq4(productImages.productId, productId));
      }
      const existingImgs = await db.select().from(productImages).where(eq4(productImages.productId, productId));
      const [img] = await db.insert(productImages).values({
        productId,
        url: String(url).trim(),
        altText: String(altText || ""),
        sortOrder: existingImgs.length,
        isPrimary: Boolean(isPrimary) || existingImgs.length === 0
      }).returning();
      return res.status(201).json({ image: img });
    } catch (error) {
      return res.status(500).json({ error: "Erreur ajout photo." });
    }
  });
  app2.patch("/api/admin/products/:id/images/:imageId/primary", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      await db.update(productImages).set({ isPrimary: false }).where(eq4(productImages.productId, productId));
      await db.update(productImages).set({ isPrimary: true }).where(and2(eq4(productImages.id, imageId), eq4(productImages.productId, productId)));
      return res.json({ updated: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur d\xE9finition photo principale." });
    }
  });
  app2.delete("/api/admin/products/:id/images/:imageId", requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      await db.delete(productImages).where(and2(eq4(productImages.id, imageId), eq4(productImages.productId, productId)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression photo." });
    }
  });
  app2.get("/api/admin/stock", requireAdmin, async (_req, res) => {
    try {
      await syncAllLowStockAlerts();
      const [settingsRow] = await db.select().from(storeSettings).limit(1);
      const globalThreshold = settingsRow?.defaultLowStockThreshold ?? 10;
      const movements = await db.select().from(stockMovements).orderBy(desc(stockMovements.createdAt)).limit(100);
      const alerts = await db.select().from(stockAlerts).orderBy(asc(stockAlerts.status), desc(stockAlerts.notifiedAt)).limit(100);
      const imports = await db.select().from(stockImports).orderBy(desc(stockImports.createdAt)).limit(30);
      const profiles = await db.select().from(importMappingProfiles).orderBy(desc(importMappingProfiles.updatedAt));
      return res.json({
        globalLowStockThreshold: globalThreshold,
        adminAlertEmail: settingsRow?.adminAlertEmail || "badroumc@gmail.com",
        movements,
        alerts,
        imports,
        profiles
      });
    } catch (error) {
      console.error("Admin stock error:", error);
      return res.status(500).json({ error: "Erreur chargement des stocks." });
    }
  });
  app2.post("/api/admin/stock/adjust", requireAdmin, async (req, res) => {
    try {
      const { productId, delta, newQuantity, reason } = req.body || {};
      const [prod] = await db.select().from(products).where(eq4(products.id, Number(productId)));
      if (!prod) return res.status(404).json({ error: "Produit introuvable." });
      const nextQty = newQuantity !== void 0 && newQuantity !== "" ? Math.max(0, Math.round(Number(newQuantity))) : Math.max(0, prod.stockQuantity + Math.round(Number(delta) || 0));
      const actualDelta = nextQty - prod.stockQuantity;
      await db.update(products).set({ stockQuantity: nextQty, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(products.id, prod.id));
      await db.insert(stockMovements).values({
        productId: prod.id,
        delta: actualDelta,
        previousQty: prod.stockQuantity,
        newQty: nextQty,
        reason: String(reason || "Ajustement manuel admin").trim(),
        createdBy: req.adminUser?.email || "admin"
      });
      const alert = await evaluateProductLowStock(prod.id);
      return res.json({ productId: prod.id, previousQty: prod.stockQuantity, newQty: nextQty, alert });
    } catch (error) {
      console.error("Stock adjust error:", error);
      return res.status(500).json({ error: "Erreur lors de l\u2019ajustement du stock." });
    }
  });
  app2.post("/api/admin/stock/import/preview", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Veuillez s\xE9lectionner un fichier de base de stock." });
      }
      const preferredTable = req.body.tableName ? String(req.body.tableName) : void 0;
      const syncMode = req.body.syncMode || "add_only";
      const customMapping = req.body.mappingJson ? JSON.parse(String(req.body.mappingJson)) : null;
      const parsed = await parseStockDatabaseBuffer(file.buffer, file.originalname, preferredTable);
      const selectedTableObj = parsed.tables.find((t) => t.tableName === parsed.selectedTable) || parsed.tables[0];
      const activeMapping = customMapping?.name ? customMapping : parsed.suggestedMapping;
      const existing = await db.select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        externalRef: products.externalRef,
        name: products.name,
        priceDzd: products.priceDzd,
        costPriceDzd: products.costPriceDzd,
        stockQuantity: products.stockQuantity
      }).from(products);
      const diff = buildDifferentialSyncPlan(selectedTableObj.rows, activeMapping, existing, syncMode);
      return res.json({
        fileName: file.originalname,
        format: parsed.format,
        tables: parsed.tables.map((t) => ({ tableName: t.tableName, rowCount: t.rows.length })),
        selectedTable: parsed.selectedTable,
        columns: parsed.columns,
        totalRows: parsed.totalRows,
        previewRows: parsed.previewRows,
        mapping: activeMapping,
        diffSummary: {
          toAddCount: diff.toAdd.length,
          toUpdateCount: diff.toUpdate.length,
          skippedCount: diff.skipped.length,
          errorCount: diff.errors.length,
          sampleToAdd: diff.toAdd.slice(0, 15),
          sampleToUpdate: diff.toUpdate.slice(0, 15).map((u) => ({
            sku: u.existing.sku,
            name: u.existing.name,
            oldStock: u.existing.stockQuantity,
            newStock: u.incoming.stockQuantity,
            oldPrice: u.existing.priceDzd,
            newPrice: u.incoming.priceDzd
          })),
          sampleSkipped: diff.skipped.slice(0, 10),
          sampleErrors: diff.errors.slice(0, 10)
        }
      });
    } catch (error) {
      console.error("Import preview error:", error);
      return res.status(400).json({ error: error?.message || "Impossible de lire ce fichier." });
    }
  });
  app2.post("/api/admin/stock/import/commit", requireAdmin, upload.single("file"), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: "Fichier manquant." });
      }
      const preferredTable = req.body.tableName ? String(req.body.tableName) : void 0;
      const syncMode = req.body.syncMode || "add_only";
      const mapping = req.body.mappingJson ? JSON.parse(String(req.body.mappingJson)) : { name: "" };
      const defaultCategoryId = req.body.defaultCategoryId ? Number(req.body.defaultCategoryId) : null;
      const saveProfileName = req.body.saveProfileName ? String(req.body.saveProfileName).trim() : "";
      const parsed = await parseStockDatabaseBuffer(file.buffer, file.originalname, preferredTable);
      const selectedTableObj = parsed.tables.find((t) => t.tableName === parsed.selectedTable) || parsed.tables[0];
      const activeMapping = mapping.name ? mapping : parsed.suggestedMapping;
      const existing = await db.select({
        id: products.id,
        sku: products.sku,
        barcode: products.barcode,
        externalRef: products.externalRef,
        name: products.name,
        priceDzd: products.priceDzd,
        costPriceDzd: products.costPriceDzd,
        stockQuantity: products.stockQuantity
      }).from(products);
      const diff = buildDifferentialSyncPlan(selectedTableObj.rows, activeMapping, existing, syncMode);
      const allCats = await db.select().from(categories);
      const catByNormName = new Map(allCats.map((c) => [slugify(c.name), c.id]));
      const [importRecord] = await db.insert(stockImports).values({
        fileName: file.originalname,
        fileFormat: parsed.format,
        sourceTableOrSheet: parsed.selectedTable,
        syncMode,
        totalRows: selectedTableObj.rows.length,
        addedCount: 0,
        updatedCount: 0,
        skippedCount: diff.skipped.length,
        errorCount: diff.errors.length,
        importedBy: req.adminUser?.email || "admin"
      }).returning();
      let addedCount = 0;
      let updatedCount = 0;
      const addedProductIds = [];
      for (const item of diff.toAdd) {
        let resolvedCatId = defaultCategoryId;
        if (item.categoryName) {
          const catSlug = slugify(item.categoryName);
          if (catByNormName.has(catSlug)) {
            resolvedCatId = catByNormName.get(catSlug);
          } else {
            const [newCat] = await db.insert(categories).values({
              name: item.categoryName,
              slug: `${catSlug}-${Date.now().toString(36).slice(-3)}`,
              categoryGroup: item.productType === "digital" ? "digital" : "accessories",
              sortOrder: 99,
              isActive: true
            }).onConflictDoNothing().returning();
            if (newCat) {
              catByNormName.set(catSlug, newCat.id);
              resolvedCatId = newCat.id;
            }
          }
        }
        const uniqueSlug = `${slugify(item.name)}-${Date.now().toString(36).slice(-4)}-${item.rowIndex}`;
        const safeSku = `${item.sku}`;
        const [inserted] = await db.insert(products).values({
          categoryId: resolvedCatId,
          sku: safeSku,
          barcode: item.barcode,
          externalRef: item.externalRef,
          name: item.name,
          slug: uniqueSlug,
          brand: item.brand,
          shortDescription: item.description ? item.description.slice(0, 160) : null,
          description: item.description || "",
          productType: item.productType,
          priceDzd: item.priceDzd,
          costPriceDzd: item.costPriceDzd,
          stockQuantity: item.stockQuantity,
          lowStockThreshold: item.lowStockThreshold,
          isFeatured: false,
          isActive: true
        }).onConflictDoNothing().returning();
        if (inserted) {
          addedCount += 1;
          addedProductIds.push(inserted.id);
          await db.insert(stockMovements).values({
            productId: inserted.id,
            importId: importRecord.id,
            delta: item.stockQuantity,
            previousQty: 0,
            newQty: item.stockQuantity,
            reason: `Import logiciel (${file.originalname})`,
            createdBy: req.adminUser?.email || "admin"
          });
          await evaluateProductLowStock(inserted.id);
        }
      }
      for (const entry of diff.toUpdate) {
        const updateData = {
          stockQuantity: entry.incoming.stockQuantity,
          updatedAt: /* @__PURE__ */ new Date()
        };
        if (syncMode === "full_sync") {
          if (entry.incoming.priceDzd > 0) updateData.priceDzd = entry.incoming.priceDzd;
          if (entry.incoming.costPriceDzd > 0) updateData.costPriceDzd = entry.incoming.costPriceDzd;
          if (entry.incoming.brand) updateData.brand = entry.incoming.brand;
          if (entry.incoming.description) updateData.description = entry.incoming.description;
        }
        await db.update(products).set(updateData).where(eq4(products.id, entry.existing.id));
        if (entry.stockDelta !== 0) {
          await db.insert(stockMovements).values({
            productId: entry.existing.id,
            importId: importRecord.id,
            delta: entry.stockDelta,
            previousQty: entry.existing.stockQuantity,
            newQty: entry.incoming.stockQuantity,
            reason: `Synchro fichier stock (${file.originalname})`,
            createdBy: req.adminUser?.email || "admin"
          });
        }
        await evaluateProductLowStock(entry.existing.id);
        updatedCount += 1;
      }
      if (saveProfileName) {
        await db.insert(importMappingProfiles).values({
          profileName: saveProfileName,
          sourceFormat: parsed.format,
          tableOrSheetName: parsed.selectedTable,
          columnMappingJson: JSON.stringify(activeMapping),
          defaultSyncMode: syncMode,
          updatedAt: /* @__PURE__ */ new Date()
        }).onConflictDoUpdate({
          target: importMappingProfiles.profileName,
          set: {
            sourceFormat: parsed.format,
            tableOrSheetName: parsed.selectedTable,
            columnMappingJson: JSON.stringify(activeMapping),
            defaultSyncMode: syncMode,
            updatedAt: /* @__PURE__ */ new Date()
          }
        });
      }
      const [finalImport] = await db.update(stockImports).set({
        addedCount,
        updatedCount,
        summaryJson: JSON.stringify({ addedProductIds })
      }).where(eq4(stockImports.id, importRecord.id)).returning();
      return res.status(201).json({
        importRecord: finalImport,
        addedProductIds
      });
    } catch (error) {
      console.error("Import commit error:", error);
      return res.status(500).json({ error: error?.message || "Erreur lors de l\u2019importation du stock." });
    }
  });
  app2.get("/api/admin/customers", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(customers).orderBy(desc(customers.updatedAt));
      const allOrders = await db.select().from(orders);
      const statsByCustomer = /* @__PURE__ */ new Map();
      for (const o of allOrders) {
        if (!o.customerId) continue;
        const st = statsByCustomer.get(o.customerId) || {
          ordersCount: 0,
          deliveredCount: 0,
          returnedCount: 0,
          totalSpentDzd: 0
        };
        st.ordersCount += 1;
        if (o.status === "livree") {
          st.deliveredCount += 1;
          st.totalSpentDzd += o.totalDzd;
        }
        if (o.status === "retournee") st.returnedCount += 1;
        statsByCustomer.set(o.customerId, st);
      }
      return res.json({
        customers: list.map((c) => ({
          ...c,
          ...statsByCustomer.get(c.id) || {
            ordersCount: 0,
            deliveredCount: 0,
            returnedCount: 0,
            totalSpentDzd: 0
          }
        }))
      });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement clients." });
    }
  });
  app2.patch("/api/admin/customers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { isBlocked, notes } = req.body || {};
      const [existing] = await db.select().from(customers).where(eq4(customers.id, id));
      if (!existing) return res.status(404).json({ error: "Client introuvable." });
      const [updated] = await db.update(customers).set({
        isBlocked: isBlocked !== void 0 ? Boolean(isBlocked) : existing.isBlocked,
        notes: notes !== void 0 ? String(notes) : existing.notes,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(customers.id, id)).returning();
      return res.json({ customer: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mise \xE0 jour client." });
    }
  });
  app2.get("/api/admin/reviews", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
      const allProds = await db.select({ id: products.id, name: products.name, slug: products.slug }).from(products);
      const prodMap = new Map(allProds.map((p) => [p.id, p]));
      return res.json({
        reviews: list.map((r) => ({
          ...r,
          productName: prodMap.get(r.productId)?.name || "Produit supprim\xE9",
          productSlug: prodMap.get(r.productId)?.slug || ""
        }))
      });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement des avis." });
    }
  });
  app2.patch("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, adminReply } = req.body || {};
      const [existing] = await db.select().from(productReviews).where(eq4(productReviews.id, id));
      if (!existing) return res.status(404).json({ error: "Avis introuvable." });
      const [updated] = await db.update(productReviews).set({
        status: status || existing.status,
        adminReply: adminReply !== void 0 ? String(adminReply) : existing.adminReply,
        moderatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(productReviews.id, id)).returning();
      return res.json({ review: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mod\xE9ration avis." });
    }
  });
  app2.delete("/api/admin/reviews/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(productReviews).where(eq4(productReviews.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression avis." });
    }
  });
  app2.get("/api/admin/carriers", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(carriers).orderBy(asc(carriers.id));
      return res.json({ carriers: list });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement transporteurs." });
    }
  });
  app2.post("/api/admin/carriers", requireAdmin, async (req, res) => {
    try {
      const { name, code, supportsHome, supportsStopDesk, apiProvider, apiEndpoint, notes, isActive, seedDefaultRates } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Nom du transporteur requis." });
      }
      const cleanCode = String(code || slugify(name).toUpperCase().replace(/-/g, "_")).trim();
      const [created] = await db.insert(carriers).values({
        name: String(name).trim(),
        code: cleanCode,
        supportsHome: supportsHome !== false,
        supportsStopDesk: supportsStopDesk !== false,
        apiProvider: apiProvider || "manual",
        apiEndpoint: apiEndpoint || null,
        apiConfigured: false,
        // Never simulate unconfigured external APIs
        notes: notes || null,
        isActive: isActive !== false
      }).returning();
      if (seedDefaultRates !== false) {
        await db.insert(shippingRates).values(
          ALGERIA_WILAYAS.map((w) => ({
            carrierId: created.id,
            wilayaCode: w.code,
            wilayaName: w.name,
            homePriceDzd: 0,
            stopDeskPriceDzd: 0,
            estimatedDays: "24-48h",
            isActive: true
          }))
        );
      }
      return res.status(201).json({ carrier: created });
    } catch (error) {
      return res.status(400).json({ error: "Impossible d\u2019ajouter ce transporteur (code d\xE9j\xE0 existant)." });
    }
  });
  app2.patch("/api/admin/carriers/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(carriers).where(eq4(carriers.id, id));
      if (!existing) return res.status(404).json({ error: "Transporteur introuvable." });
      const [updated] = await db.update(carriers).set({
        name: b.name ?? existing.name,
        supportsHome: b.supportsHome !== void 0 ? Boolean(b.supportsHome) : existing.supportsHome,
        supportsStopDesk: b.supportsStopDesk !== void 0 ? Boolean(b.supportsStopDesk) : existing.supportsStopDesk,
        apiProvider: b.apiProvider ?? existing.apiProvider,
        apiEndpoint: b.apiEndpoint !== void 0 ? b.apiEndpoint : existing.apiEndpoint,
        notes: b.notes !== void 0 ? b.notes : existing.notes,
        isActive: b.isActive !== void 0 ? Boolean(b.isActive) : existing.isActive
      }).where(eq4(carriers.id, id)).returning();
      return res.json({ carrier: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mise \xE0 jour transporteur." });
    }
  });
  app2.delete("/api/admin/carriers/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(carriers).where(eq4(carriers.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression transporteur." });
    }
  });
  app2.get("/api/admin/shipping-rates", requireAdmin, async (req, res) => {
    try {
      const carrierId = req.query.carrierId ? Number(req.query.carrierId) : null;
      const list = carrierId ? await db.select().from(shippingRates).where(eq4(shippingRates.carrierId, carrierId)).orderBy(asc(shippingRates.wilayaCode)) : await db.select().from(shippingRates).orderBy(asc(shippingRates.carrierId), asc(shippingRates.wilayaCode));
      return res.json({ shippingRates: list });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement tarifs." });
    }
  });
  app2.patch("/api/admin/shipping-rates/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { homePriceDzd, stopDeskPriceDzd, estimatedDays, isActive } = req.body || {};
      const [existing] = await db.select().from(shippingRates).where(eq4(shippingRates.id, id));
      if (!existing) return res.status(404).json({ error: "Tarif introuvable." });
      const [updated] = await db.update(shippingRates).set({
        homePriceDzd: homePriceDzd !== void 0 ? Math.max(0, Math.round(Number(homePriceDzd))) : existing.homePriceDzd,
        stopDeskPriceDzd: stopDeskPriceDzd !== void 0 ? Math.max(0, Math.round(Number(stopDeskPriceDzd))) : existing.stopDeskPriceDzd,
        estimatedDays: estimatedDays !== void 0 ? String(estimatedDays) : existing.estimatedDays,
        isActive: isActive !== void 0 ? Boolean(isActive) : existing.isActive,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(shippingRates.id, id)).returning();
      return res.json({ rate: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mise \xE0 jour tarif." });
    }
  });
  app2.get("/api/admin/returns", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(returns).orderBy(desc(returns.createdAt));
      return res.json({ returns: list });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement des retours." });
    }
  });
  app2.patch("/api/admin/returns/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, condition, reason, returnFeeDzd, restockNow, notes } = req.body || {};
      const [existing] = await db.select().from(returns).where(eq4(returns.id, id));
      if (!existing) return res.status(404).json({ error: "Retour introuvable." });
      let restocked = existing.restocked;
      if (restockNow && !existing.restocked) {
        const items = await db.select().from(orderItems).where(eq4(orderItems.orderId, existing.orderId));
        for (const item of items) {
          if (item.productId && item.productType === "physical") {
            const [prod] = await db.select().from(products).where(eq4(products.id, item.productId));
            if (prod) {
              const newQty = prod.stockQuantity + item.quantity;
              await db.update(products).set({ stockQuantity: newQty, updatedAt: /* @__PURE__ */ new Date() }).where(eq4(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId: existing.orderId,
                delta: item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `R\xE9int\xE9gration retour ${existing.orderReference}`,
                createdBy: req.adminUser?.email || "admin"
              });
              await evaluateProductLowStock(prod.id);
            }
          }
        }
        restocked = true;
      }
      const [updated] = await db.update(returns).set({
        status: restockNow ? "reintegre" : status || existing.status,
        condition: condition || existing.condition,
        reason: reason !== void 0 ? String(reason) : existing.reason,
        returnFeeDzd: returnFeeDzd !== void 0 ? Math.max(0, Math.round(Number(returnFeeDzd))) : existing.returnFeeDzd,
        restocked,
        notes: notes !== void 0 ? String(notes) : existing.notes
      }).where(eq4(returns.id, id)).returning();
      return res.json({ returnItem: updated });
    } catch (error) {
      console.error("Return update error:", error);
      return res.status(500).json({ error: "Erreur mise \xE0 jour retour." });
    }
  });
  app2.get("/api/admin/promotions", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(promotions).orderBy(desc(promotions.createdAt));
      return res.json({ promotions: list });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement promotions." });
    }
  });
  app2.post("/api/admin/promotions", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.code || !String(b.code).trim()) {
        return res.status(400).json({ error: "Code promo requis." });
      }
      const [created] = await db.insert(promotions).values({
        code: String(b.code).trim().toUpperCase(),
        description: String(b.description || ""),
        discountType: b.discountType || "percent",
        discountValue: Math.max(0, Math.round(Number(b.discountValue) || 0)),
        minOrderDzd: Math.max(0, Math.round(Number(b.minOrderDzd) || 0)),
        maxUses: b.maxUses ? Math.round(Number(b.maxUses)) : null,
        endsAt: b.endsAt ? new Date(b.endsAt) : null,
        isActive: b.isActive !== false
      }).returning();
      return res.status(201).json({ promotion: created });
    } catch (error) {
      return res.status(400).json({ error: "Code promo d\xE9j\xE0 existant ou invalide." });
    }
  });
  app2.patch("/api/admin/promotions/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(promotions).where(eq4(promotions.id, id));
      if (!existing) return res.status(404).json({ error: "Promotion introuvable." });
      const [updated] = await db.update(promotions).set({
        description: b.description ?? existing.description,
        discountType: b.discountType ?? existing.discountType,
        discountValue: b.discountValue !== void 0 ? Math.max(0, Math.round(Number(b.discountValue))) : existing.discountValue,
        minOrderDzd: b.minOrderDzd !== void 0 ? Math.max(0, Math.round(Number(b.minOrderDzd))) : existing.minOrderDzd,
        isActive: b.isActive !== void 0 ? Boolean(b.isActive) : existing.isActive
      }).where(eq4(promotions.id, id)).returning();
      return res.json({ promotion: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mise \xE0 jour promotion." });
    }
  });
  app2.delete("/api/admin/promotions/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(promotions).where(eq4(promotions.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression promotion." });
    }
  });
  app2.get("/api/admin/digital-deliveries", requireAdmin, async (_req, res) => {
    try {
      const deliveries = await db.select().from(digitalDeliveries).orderBy(desc(digitalDeliveries.createdAt));
      const allOrders = await db.select().from(orders);
      const orderMap = new Map(allOrders.map((o) => [o.id, o]));
      return res.json({
        deliveries: deliveries.map((d) => {
          const ord = orderMap.get(d.orderId);
          return {
            ...d,
            orderReference: ord?.reference || "",
            customerName: ord ? `${ord.firstName} ${ord.lastName}` : "",
            customerPhone: ord?.phone || "",
            orderStatus: ord?.status || "",
            paymentStatus: ord?.paymentStatus || "pending"
          };
        })
      });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement livraisons num\xE9riques." });
    }
  });
  app2.patch("/api/admin/digital-deliveries/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { deliveryStatus, activationInstructions, privateFulfillmentNote } = req.body || {};
      const [existing] = await db.select().from(digitalDeliveries).where(eq4(digitalDeliveries.id, id));
      if (!existing) return res.status(404).json({ error: "Livraison num\xE9rique introuvable." });
      const nextStatus = deliveryStatus || existing.deliveryStatus;
      const [updated] = await db.update(digitalDeliveries).set({
        deliveryStatus: nextStatus,
        activationInstructions: activationInstructions !== void 0 ? String(activationInstructions) : existing.activationInstructions,
        privateFulfillmentNote: privateFulfillmentNote !== void 0 ? String(privateFulfillmentNote) : existing.privateFulfillmentNote,
        deliveredBy: nextStatus === "delivered" ? req.adminUser?.email || "admin" : existing.deliveredBy,
        deliveredAt: nextStatus === "delivered" ? /* @__PURE__ */ new Date() : existing.deliveredAt
      }).where(eq4(digitalDeliveries.id, id)).returning();
      if (nextStatus === "delivered") {
        await db.update(orders).set({ paymentStatus: "paid", updatedAt: /* @__PURE__ */ new Date() }).where(eq4(orders.id, existing.orderId));
      }
      return res.json({ delivery: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mise \xE0 jour livraison num\xE9rique." });
    }
  });
  app2.get("/api/admin/social-links", requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(socialLinks).orderBy(asc(socialLinks.sortOrder));
      return res.json({ socialLinks: list });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement r\xE9seaux sociaux." });
    }
  });
  app2.post("/api/admin/social-links", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const [created] = await db.insert(socialLinks).values({
        platform: String(b.platform || "instagram"),
        label: String(b.label || "R\xE9seau social"),
        urlOrHandle: String(b.urlOrHandle || ""),
        pixelId: b.pixelId ? String(b.pixelId).trim() : null,
        isActive: b.isActive !== false,
        sortOrder: Number(b.sortOrder) || 0
      }).returning();
      return res.status(201).json({ socialLink: created });
    } catch (error) {
      return res.status(500).json({ error: "Erreur cr\xE9ation lien social." });
    }
  });
  app2.patch("/api/admin/social-links/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(socialLinks).where(eq4(socialLinks.id, id));
      if (!existing) return res.status(404).json({ error: "Lien introuvable." });
      const [updated] = await db.update(socialLinks).set({
        label: b.label ?? existing.label,
        urlOrHandle: b.urlOrHandle ?? existing.urlOrHandle,
        pixelId: b.pixelId !== void 0 ? b.pixelId : existing.pixelId,
        isActive: b.isActive !== void 0 ? Boolean(b.isActive) : existing.isActive
      }).where(eq4(socialLinks.id, id)).returning();
      return res.json({ socialLink: updated });
    } catch (error) {
      return res.status(500).json({ error: "Erreur mise \xE0 jour lien social." });
    }
  });
  app2.delete("/api/admin/social-links/:id", requireAdmin, async (req, res) => {
    try {
      await db.delete(socialLinks).where(eq4(socialLinks.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: "Erreur suppression lien social." });
    }
  });
  app2.get("/api/admin/settings", requireAdmin, async (_req, res) => {
    try {
      const [settings] = await db.select().from(storeSettings).limit(1);
      const emailProviderConfigured = Boolean(
        process.env.RESEND_API_KEY || process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
      );
      return res.json({ settings, emailProviderConfigured });
    } catch (error) {
      return res.status(500).json({ error: "Erreur chargement param\xE8tres." });
    }
  });
  app2.patch("/api/admin/settings", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const [existing] = await db.select().from(storeSettings).limit(1);
      if (!existing) return res.status(404).json({ error: "Param\xE8tres introuvables." });
      const nextThreshold = b.defaultLowStockThreshold !== void 0 ? Math.max(0, Math.round(Number(b.defaultLowStockThreshold))) : existing.defaultLowStockThreshold;
      const [updated] = await db.update(storeSettings).set({
        storeName: b.storeName !== void 0 ? String(b.storeName).trim() : existing.storeName,
        tagline: b.tagline !== void 0 ? String(b.tagline).trim() : existing.tagline,
        logoUrl: b.logoUrl !== void 0 ? b.logoUrl : existing.logoUrl,
        whatsappPhone: b.whatsappPhone !== void 0 ? String(b.whatsappPhone).trim() : existing.whatsappPhone,
        supportEmail: b.supportEmail !== void 0 ? String(b.supportEmail).trim() : existing.supportEmail,
        adminAlertEmail: b.adminAlertEmail !== void 0 ? String(b.adminAlertEmail).trim() : existing.adminAlertEmail,
        defaultLowStockThreshold: nextThreshold,
        storeAddress: b.storeAddress !== void 0 ? String(b.storeAddress).trim() : existing.storeAddress,
        codEnabled: b.codEnabled !== void 0 ? Boolean(b.codEnabled) : existing.codEnabled,
        digitalOrderNote: b.digitalOrderNote !== void 0 ? String(b.digitalOrderNote).trim() : existing.digitalOrderNote,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq4(storeSettings.id, existing.id)).returning();
      if (nextThreshold !== existing.defaultLowStockThreshold) {
        await syncAllLowStockAlerts();
      }
      return res.json({ settings: updated });
    } catch (error) {
      console.error("Update settings error:", error);
      return res.status(500).json({ error: "Erreur enregistrement param\xE8tres." });
    }
  });
  app2.get("/api/admin/admins", requireAdmin, async (_req, res) => {
    try {
      const admins = await db.select().from(adminUsers).orderBy(asc(adminUsers.id));
      return res.json({ admins });
    } catch (error) {
      console.error("List admins error:", error);
      return res.status(500).json({ error: "Erreur chargement des administrateurs." });
    }
  });
  app2.post("/api/admin/admins", requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const email = String(b.email || "").trim().toLowerCase();
      const fullName = String(b.fullName || "").trim() || "Co-g\xE9rant 2Fr\xE8res Phone";
      const role = b.role === "super_admin" ? "super_admin" : "admin";
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: "Veuillez saisir une adresse e-mail Google valide." });
      }
      const [existing] = await db.select().from(adminUsers).where(eq4(adminUsers.email, email));
      if (existing) {
        const [updated] = await db.update(adminUsers).set({ fullName, role, isActive: true }).where(eq4(adminUsers.id, existing.id)).returning();
        return res.json({ admin: updated });
      }
      const [created] = await db.insert(adminUsers).values({
        email,
        fullName,
        role,
        isActive: true
      }).returning();
      return res.status(201).json({ admin: created });
    } catch (error) {
      console.error("Create admin error:", error);
      return res.status(500).json({ error: "Erreur lors de l\u2019ajout de l\u2019administrateur." });
    }
  });
  app2.patch("/api/admin/admins/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalide." });
      const b = req.body || {};
      const [target] = await db.select().from(adminUsers).where(eq4(adminUsers.id, id));
      if (!target) return res.status(404).json({ error: "Administrateur introuvable." });
      if (req.adminUser?.id === id && b.isActive === false) {
        return res.status(400).json({ error: "Vous ne pouvez pas d\xE9sactiver votre propre compte administrateur." });
      }
      const [updated] = await db.update(adminUsers).set({
        fullName: b.fullName !== void 0 ? String(b.fullName).trim() : target.fullName,
        role: b.role === "super_admin" || b.role === "admin" ? b.role : target.role,
        isActive: b.isActive !== void 0 ? Boolean(b.isActive) : target.isActive
      }).where(eq4(adminUsers.id, id)).returning();
      return res.json({ admin: updated });
    } catch (error) {
      console.error("Update admin error:", error);
      return res.status(500).json({ error: "Erreur mise \xE0 jour administrateur." });
    }
  });
  app2.delete("/api/admin/admins/:id", requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: "ID invalide." });
      if (req.adminUser?.id === id) {
        return res.status(400).json({ error: "Vous ne pouvez pas supprimer votre propre compte administrateur." });
      }
      await db.delete(adminUsers).where(eq4(adminUsers.id, id));
      return res.json({ ok: true });
    } catch (error) {
      console.error("Delete admin error:", error);
      return res.status(500).json({ error: "Erreur suppression administrateur." });
    }
  });
  return app2;
}
if (false) {
  startServer();
}

// src/vercel-entry.ts
var app = createApp();
var vercel_entry_default = app;
export {
  vercel_entry_default as default
};
