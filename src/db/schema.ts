import { relations } from 'drizzle-orm';
import {
  boolean,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
} from 'drizzle-orm/pg-core';

export const adminUsers = pgTable('admin_users', {
  id: serial('id').primaryKey(),
  uid: text('uid').unique(),
  email: text('email').notNull().unique(),
  fullName: text('full_name').notNull().default('Administrateur 2Frères Phone'),
  role: text('role').notNull().default('super_admin'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const mediaAssets = pgTable('media_assets', {
  id: serial('id').primaryKey(),
  filename: text('filename').notNull(),
  mimeType: text('mime_type').notNull(),
  dataBase64: text('data_base64').notNull(),
  sizeBytes: integer('size_bytes').notNull().default(0),
  kind: text('kind').notNull().default('product'), // 'logo' | 'product' | 'other'
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const storeSettings = pgTable('store_settings', {
  id: serial('id').primaryKey(),
  storeName: text('store_name').notNull().default('2Frères Phone'),
  tagline: text('tagline')
    .notNull()
    .default('Accessoires téléphoniques, Gaming & Services numériques en Algérie'),
  logoUrl: text('logo_url'),
  whatsappPhone: text('whatsapp_phone').notNull().default('+213550000000'),
  supportEmail: text('support_email').notNull().default('contact@2freresphone.dz'),
  adminAlertEmail: text('admin_alert_email').notNull().default('badroumc@gmail.com'),
  defaultLowStockThreshold: integer('default_low_stock_threshold').notNull().default(10),
  currency: text('currency').notNull().default('DZD'),
  storeAddress: text('store_address').notNull().default('Algérie'),
  codEnabled: boolean('cod_enabled').notNull().default(true),
  digitalOrderNote: text('digital_order_note')
    .notNull()
    .default('Livraison et activation numérique après validation de la commande et du paiement.'),
  catalogInitialized: boolean('catalog_initialized').notNull().default(false),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  parentId: integer('parent_id'),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  categoryGroup: text('category_group').notNull().default('accessories'), // 'accessories' | 'gaming' | 'digital'
  description: text('description'),
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const products = pgTable('products', {
  id: serial('id').primaryKey(),
  categoryId: integer('category_id')
    .references(() => categories.id, { onDelete: 'set null' }),
  sku: text('sku').notNull().unique(),
  barcode: text('barcode'),
  externalRef: text('external_ref'),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  brand: text('brand'),
  shortDescription: text('short_description'),
  description: text('description').notNull().default(''),
  productType: text('product_type').notNull().default('physical'), // 'physical' | 'digital'
  priceDzd: integer('price_dzd').notNull().default(0),
  compareAtPriceDzd: integer('compare_at_price_dzd'),
  costPriceDzd: integer('cost_price_dzd').notNull().default(0),
  stockQuantity: integer('stock_quantity').notNull().default(0),
  lowStockThreshold: integer('low_stock_threshold'), // null => uses store_settings.defaultLowStockThreshold
  isFeatured: boolean('is_featured').notNull().default(false),
  isActive: boolean('is_active').notNull().default(true),
  digitalAvailability: text('digital_availability').default('available'), // 'available' | 'limited' | 'paused'
  digitalActivationTemplate: text('digital_activation_template'),
  colorsJson: text('colors_json').notNull().default('[]'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const productImages = pgTable('product_images', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  url: text('url').notNull(),
  altText: text('alt_text').notNull().default(''),
  sortOrder: integer('sort_order').notNull().default(0),
  isPrimary: boolean('is_primary').notNull().default(false),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const carriers = pgTable('carriers', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  supportsHome: boolean('supports_home').notNull().default(true),
  supportsStopDesk: boolean('supports_stop_desk').notNull().default(true),
  apiProvider: text('api_provider').notNull().default('manual'), // 'manual' | 'yalidine' | 'zrexpress' | 'noest' | 'ecotrack' | 'maystro'
  apiEndpoint: text('api_endpoint'),
  apiConfigured: boolean('api_configured').notNull().default(false),
  notes: text('notes'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const shippingRates = pgTable('shipping_rates', {
  id: serial('id').primaryKey(),
  carrierId: integer('carrier_id')
    .references(() => carriers.id, { onDelete: 'cascade' })
    .notNull(),
  wilayaCode: text('wilaya_code').notNull(),
  wilayaName: text('wilaya_name').notNull(),
  homePriceDzd: integer('home_price_dzd').notNull().default(0),
  stopDeskPriceDzd: integer('stop_desk_price_dzd').notNull().default(0),
  estimatedDays: text('estimated_days').notNull().default('24-48h'),
  isActive: boolean('is_active').notNull().default(true),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const customers = pgTable('customers', {
  id: serial('id').primaryKey(),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone').notNull().unique(),
  wilayaCode: text('wilaya_code').notNull().default('16'),
  wilayaName: text('wilaya_name').notNull().default('Alger'),
  commune: text('commune').notNull().default(''),
  address: text('address').notNull().default(''),
  isBlocked: boolean('is_blocked').notNull().default(false),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orders = pgTable('orders', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull().unique(),
  customerId: integer('customer_id')
    .references(() => customers.id, { onDelete: 'set null' }),
  firstName: text('first_name').notNull(),
  lastName: text('last_name').notNull(),
  phone: text('phone').notNull(),
  wilayaCode: text('wilaya_code').notNull(),
  wilayaName: text('wilaya_name').notNull(),
  commune: text('commune').notNull(),
  address: text('address').notNull(),
  deliveryType: text('delivery_type').notNull().default('home'), // 'home' | 'stop_desk' | 'digital'
  carrierId: integer('carrier_id')
    .references(() => carriers.id, { onDelete: 'set null' }),
  carrierName: text('carrier_name'),
  trackingNumber: text('tracking_number'),
  status: text('status').notNull().default('nouvelle'),
  // nouvelle | a_confirmer | confirmee | en_preparation | expediee | livree | annulee | retournee
  paymentMethod: text('payment_method').notNull().default('cod'), // 'cod' | 'manual_digital'
  paymentStatus: text('payment_status').notNull().default('pending'), // 'pending' | 'paid' | 'refunded'
  promoCode: text('promo_code'),
  subtotalDzd: integer('subtotal_dzd').notNull().default(0),
  discountDzd: integer('discount_dzd').notNull().default(0),
  shippingFeeDzd: integer('shipping_fee_dzd').notNull().default(0),
  totalDzd: integer('total_dzd').notNull().default(0),
  hasDigitalItems: boolean('has_digital_items').notNull().default(false),
  hasPhysicalItems: boolean('has_physical_items').notNull().default(true),
  stockDeducted: boolean('stock_deducted').notNull().default(false),
  source: text('source').notNull().default('web'), // 'web' | 'whatsapp' | 'admin'
  callStatus: text('call_status').notNull().default('non_appele'),
  // non_appele | appel_1_sans_reponse | appel_2_eteint | appel_3_reporte | confirme_tel | annule_client | faux_numero
  callAttempts: integer('call_attempts').notNull().default(0),
  callNotes: text('call_notes'),
  customerNotes: text('customer_notes'),
  adminNotes: text('admin_notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const orderItems = pgTable('order_items', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  productSku: text('product_sku').notNull().default(''),
  productType: text('product_type').notNull().default('physical'),
  unitPriceDzd: integer('unit_price_dzd').notNull(),
  costPriceDzd: integer('cost_price_dzd').notNull().default(0),
  quantity: integer('quantity').notNull().default(1),
  lineTotalDzd: integer('line_total_dzd').notNull(),
});

export const orderStatusHistory = pgTable('order_status_history', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  fromStatus: text('from_status'),
  toStatus: text('to_status').notNull(),
  note: text('note'),
  changedBy: text('changed_by').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const sales = pgTable('sales', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull()
    .unique(),
  orderReference: text('order_reference').notNull(),
  customerName: text('customer_name').notNull(),
  wilayaName: text('wilaya_name').notNull(),
  itemsRevenueDzd: integer('items_revenue_dzd').notNull().default(0),
  discountDzd: integer('discount_dzd').notNull().default(0),
  shippingFeeDzd: integer('shipping_fee_dzd').notNull().default(0),
  costOfGoodsDzd: integer('cost_of_goods_dzd').notNull().default(0),
  totalCollectedDzd: integer('total_collected_dzd').notNull().default(0),
  estimatedMarginDzd: integer('estimated_margin_dzd').notNull().default(0),
  recordedAt: timestamp('recorded_at').defaultNow().notNull(),
});

export const stockImports = pgTable('stock_imports', {
  id: serial('id').primaryKey(),
  fileName: text('file_name').notNull(),
  fileFormat: text('file_format').notNull(),
  sourceTableOrSheet: text('source_table_or_sheet'),
  syncMode: text('sync_mode').notNull().default('add_only'), // 'add_only' | 'add_and_update_stock' | 'full_sync'
  totalRows: integer('total_rows').notNull().default(0),
  addedCount: integer('added_count').notNull().default(0),
  updatedCount: integer('updated_count').notNull().default(0),
  skippedCount: integer('skipped_count').notNull().default(0),
  errorCount: integer('error_count').notNull().default(0),
  summaryJson: text('summary_json'),
  importedBy: text('imported_by').notNull().default('admin'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const accountingEntries = pgTable('accounting_entries', {
  id: serial('id').primaryKey(),
  reference: text('reference').notNull(),
  entryType: text('entry_type').notNull().default('sale'), // 'sale' | 'purchase' | 'stock_valuation' | 'expense' | 'adjustment'
  category: text('category').notNull().default('Ventes & Caisse'),
  label: text('label').notNull(),
  partnerName: text('partner_name').notNull().default(''),
  amountDzd: integer('amount_dzd').notNull().default(0),
  costDzd: integer('cost_dzd').notNull().default(0),
  marginDzd: integer('margin_dzd').notNull().default(0),
  paymentMethod: text('payment_method').notNull().default('Espèces / Caisse'),
  sourceFile: text('source_file'),
  importId: integer('import_id').references(() => stockImports.id, { onDelete: 'set null' }),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  entryDate: timestamp('entry_date').defaultNow().notNull(),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const importMappingProfiles = pgTable('import_mapping_profiles', {
  id: serial('id').primaryKey(),
  profileName: text('profile_name').notNull().unique(),
  sourceFormat: text('source_format').notNull(),
  tableOrSheetName: text('table_or_sheet_name'),
  columnMappingJson: text('column_mapping_json').notNull(),
  defaultSyncMode: text('default_sync_mode').notNull().default('add_only'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const stockMovements = pgTable('stock_movements', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  orderId: integer('order_id').references(() => orders.id, { onDelete: 'set null' }),
  importId: integer('import_id').references(() => stockImports.id, { onDelete: 'set null' }),
  delta: integer('delta').notNull(),
  previousQty: integer('previous_qty').notNull(),
  newQty: integer('new_qty').notNull(),
  reason: text('reason').notNull(),
  createdBy: text('created_by').notNull().default('system'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const stockAlerts = pgTable('stock_alerts', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  productName: text('product_name').notNull(),
  productSku: text('product_sku').notNull(),
  currentStock: integer('current_stock').notNull(),
  thresholdUsed: integer('threshold_used').notNull(),
  status: text('status').notNull().default('active'), // 'active' | 'resolved'
  emailStatus: text('email_status').notNull().default('pending'), // 'sent' | 'not_configured' | 'failed' | 'pending'
  emailRecipient: text('email_recipient'),
  emailError: text('email_error'),
  notifiedAt: timestamp('notified_at').defaultNow().notNull(),
  resolvedAt: timestamp('resolved_at'),
});

export const productReviews = pgTable('product_reviews', {
  id: serial('id').primaryKey(),
  productId: integer('product_id')
    .references(() => products.id, { onDelete: 'cascade' })
    .notNull(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'set null' }),
  orderReference: text('order_reference').notNull(),
  customerName: text('customer_name').notNull(),
  customerPhone: text('customer_phone').notNull(),
  rating: integer('rating').notNull(), // 1..5
  title: text('title').notNull().default(''),
  comment: text('comment').notNull(),
  isVerifiedPurchase: boolean('is_verified_purchase').notNull().default(true),
  status: text('status').notNull().default('pending'), // 'pending' | 'approved' | 'rejected'
  adminReply: text('admin_reply'),
  moderatedAt: timestamp('moderated_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const returns = pgTable('returns', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  orderReference: text('order_reference').notNull(),
  customerName: text('customer_name').notNull(),
  phone: text('phone').notNull(),
  wilayaName: text('wilaya_name').notNull(),
  reason: text('reason').notNull().default('Client injoignable'),
  condition: text('condition').notNull().default('intact'), // 'intact' | 'damaged' | 'missing_parts'
  restocked: boolean('restocked').notNull().default(false),
  returnFeeDzd: integer('return_fee_dzd').notNull().default(0),
  status: text('status').notNull().default('en_cours'), // 'en_cours' | 'recu' | 'reintegre' | 'cloture'
  notes: text('notes'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const promotions = pgTable('promotions', {
  id: serial('id').primaryKey(),
  code: text('code').notNull().unique(),
  description: text('description').notNull().default(''),
  discountType: text('discount_type').notNull().default('percent'), // 'percent' | 'fixed' | 'free_shipping'
  discountValue: integer('discount_value').notNull().default(0),
  minOrderDzd: integer('min_order_dzd').notNull().default(0),
  maxUses: integer('max_uses'),
  usedCount: integer('used_count').notNull().default(0),
  startsAt: timestamp('starts_at'),
  endsAt: timestamp('ends_at'),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const digitalDeliveries = pgTable('digital_deliveries', {
  id: serial('id').primaryKey(),
  orderId: integer('order_id')
    .references(() => orders.id, { onDelete: 'cascade' })
    .notNull(),
  orderItemId: integer('order_item_id')
    .references(() => orderItems.id, { onDelete: 'cascade' })
    .notNull(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  deliveryStatus: text('delivery_status').notNull().default('pending'), // 'pending' | 'payment_verified' | 'delivered' | 'cancelled'
  activationInstructions: text('activation_instructions').notNull().default(''),
  privateFulfillmentNote: text('private_fulfillment_note').notNull().default(''),
  deliveredBy: text('delivered_by'),
  deliveredAt: timestamp('delivered_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const socialLinks = pgTable('social_links', {
  id: serial('id').primaryKey(),
  platform: text('platform').notNull(), // 'whatsapp' | 'instagram' | 'facebook' | 'tiktok' | 'youtube' | 'snapchat' | 'telegram'
  label: text('label').notNull(),
  urlOrHandle: text('url_or_handle').notNull(),
  pixelId: text('pixel_id'),
  isActive: boolean('is_active').notNull().default(true),
  sortOrder: integer('sort_order').notNull().default(0),
});

export const landingPages = pgTable('landing_pages', {
  id: serial('id').primaryKey(),
  title: text('title').notNull(),
  slug: text('slug').notNull().unique(),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull(),
  priceDzd: integer('price_dzd').notNull().default(0),
  compareAtPriceDzd: integer('compare_at_price_dzd'),
  heroBadge: text('hero_badge').notNull().default('Offre Spéciale Algérie · Livraison 58 Wilayas'),
  headline: text('headline').notNull(),
  subheadline: text('subheadline').notNull(),
  ctaText: text('cta_text').notNull().default('Commander maintenant — Paiement à la livraison'),
  urgencyText: text('urgency_text').notNull().default('Stock limité · Expédition rapide 24/48h'),
  heroImageUrl: text('hero_image_url'),
  galleryImagesJson: text('gallery_images_json').notNull().default('[]'),
  colorsJson: text('colors_json').notNull().default('[]'),
  benefitsJson: text('benefits_json').notNull().default('[]'),
  specsJson: text('specs_json').notNull().default('[]'),
  testimonialsJson: text('testimonials_json').notNull().default('[]'),
  faqJson: text('faq_json').notNull().default('[]'),
  accentColor: text('accent_color').notNull().default('#1d4ed8'),
  isPublished: boolean('is_published').notNull().default(true),
  viewsCount: integer('views_count').notNull().default(0),
  ordersCount: integer('orders_count').notNull().default(0),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const abandonedOrders = pgTable('abandoned_orders', {
  id: serial('id').primaryKey(),
  fullName: text('full_name').notNull().default('Client'),
  phone: text('phone').notNull(),
  wilayaCode: text('wilaya_code').notNull().default('16'),
  wilayaName: text('wilaya_name').notNull().default('Alger'),
  commune: text('commune').notNull().default(''),
  deliveryType: text('delivery_type').notNull().default('home'),
  productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
  productName: text('product_name').notNull().default('Article en cours'),
  productPriceDzd: integer('product_price_dzd').notNull().default(0),
  quantity: integer('quantity').notNull().default(1),
  selectedColor: text('selected_color'),
  sourcePage: text('source_page').notNull().default('product'), // 'product' | 'checkout' | 'landing_page'
  status: text('status').notNull().default('en_attente'), // 'en_attente' | 'relance_whatsapp' | 'recuperee' | 'ignoree'
  recoveredOrderId: integer('recovered_order_id'),
  notes: text('notes').notNull().default(''),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
});

export const categoriesRelations = relations(categories, ({ many }) => ({
  products: many(products),
}));

export const productsRelations = relations(products, ({ one, many }) => ({
  category: one(categories, {
    fields: [products.categoryId],
    references: [categories.id],
  }),
  images: many(productImages),
  reviews: many(productReviews),
}));

export const productImagesRelations = relations(productImages, ({ one }) => ({
  product: one(products, {
    fields: [productImages.productId],
    references: [products.id],
  }),
}));

export const ordersRelations = relations(orders, ({ many }) => ({
  items: many(orderItems),
  history: many(orderStatusHistory),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
  order: one(orders, {
    fields: [orderItems.orderId],
    references: [orders.id],
  }),
}));
