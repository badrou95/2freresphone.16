import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.ts';
import {
  adminUsers,
  carriers,
  categories,
  productImages,
  products,
  promotions,
  shippingRates,
  socialLinks,
  storeSettings,
} from '../db/schema.ts';
import { ALGERIA_WILAYAS } from '../shared/algeria.ts';

let seedPromise: Promise<void> | null = null;
let seeded = false;

const IMG_ACCESSORIES = '/src/assets/images/cat_phone_accessories_1795096637386.jpg';
const IMG_GAMING = '/src/assets/images/cat_gaming_console_1795096637263.jpg';
const IMG_DIGITAL = '/src/assets/images/cat_digital_cards_1795096637686.jpg';
const IMG_AUDIO_POWER = '/src/assets/images/prod_earbuds_powerbank_1795096637141.jpg';
const IMG_HERO = '/src/assets/images/hero_2freres_tech_1795096637447.jpg';

const INITIAL_CATEGORIES = [
  // 1. Accessoires téléphoniques
  { name: 'Coques', slug: 'coques', categoryGroup: 'accessories', sortOrder: 1 },
  { name: 'Verres trempés et protections', slug: 'verres-trempes-et-protections', categoryGroup: 'accessories', sortOrder: 2 },
  { name: 'Chargeurs', slug: 'chargeurs', categoryGroup: 'accessories', sortOrder: 3 },
  { name: 'Câbles', slug: 'cables', categoryGroup: 'accessories', sortOrder: 4 },
  { name: 'Écouteurs filaires', slug: 'ecouteurs-filaires', categoryGroup: 'accessories', sortOrder: 5 },
  { name: 'Écouteurs Bluetooth', slug: 'ecouteurs-bluetooth', categoryGroup: 'accessories', sortOrder: 6 },
  { name: 'Batteries externes', slug: 'batteries-externes', categoryGroup: 'accessories', sortOrder: 7 },
  { name: 'Supports téléphoniques', slug: 'supports-telephoniques', categoryGroup: 'accessories', sortOrder: 8 },
  { name: 'Accessoires divers', slug: 'accessoires-divers', categoryGroup: 'accessories', sortOrder: 9 },
  // 2. Jeux vidéo
  { name: 'Jeux Xbox', slug: 'jeux-xbox', categoryGroup: 'gaming', sortOrder: 10 },
  { name: 'Jeux PlayStation', slug: 'jeux-playstation', categoryGroup: 'gaming', sortOrder: 11 },
  { name: 'Comptes Xbox', slug: 'comptes-xbox', categoryGroup: 'gaming', sortOrder: 12 },
  { name: 'Comptes PlayStation', slug: 'comptes-playstation', categoryGroup: 'gaming', sortOrder: 13 },
  { name: 'Abonnements gaming', slug: 'abonnements-gaming', categoryGroup: 'gaming', sortOrder: 14 },
  { name: 'Cartes cadeaux', slug: 'cartes-cadeaux', categoryGroup: 'gaming', sortOrder: 15 },
  // 3. Abonnements numériques
  { name: 'Netflix', slug: 'netflix', categoryGroup: 'digital', sortOrder: 16 },
  { name: 'Snapchat+', slug: 'snapchat-plus', categoryGroup: 'digital', sortOrder: 17 },
  { name: 'Autres abonnements', slug: 'autres-abonnements', categoryGroup: 'digital', sortOrder: 18 },
  { name: 'Services numériques', slug: 'services-numeriques', categoryGroup: 'digital', sortOrder: 19 },
];

const DDL_STATEMENTS: string[] = [
  `CREATE TABLE IF NOT EXISTS admin_users (
    id serial PRIMARY KEY,
    uid text UNIQUE,
    email text NOT NULL UNIQUE,
    full_name text NOT NULL DEFAULT 'Administrateur 2Frères Phone',
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
    store_name text NOT NULL DEFAULT '2Frères Phone',
    tagline text NOT NULL DEFAULT 'Accessoires téléphoniques, Gaming & Services numériques en Algérie',
    logo_url text,
    whatsapp_phone text NOT NULL DEFAULT '+213550000000',
    support_email text NOT NULL DEFAULT 'contact@2freresphone.dz',
    admin_alert_email text NOT NULL DEFAULT 'badroumc@gmail.com',
    default_low_stock_threshold integer NOT NULL DEFAULT 10,
    currency text NOT NULL DEFAULT 'DZD',
    store_address text NOT NULL DEFAULT 'Algérie',
    cod_enabled boolean NOT NULL DEFAULT true,
    digital_order_note text NOT NULL DEFAULT 'Livraison et activation numérique après validation de la commande et du paiement.',
    catalog_initialized boolean NOT NULL DEFAULT false,
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
  )`,
  `CREATE TABLE IF NOT EXISTS landing_pages (
    id serial PRIMARY KEY,
    title text NOT NULL,
    slug text NOT NULL UNIQUE,
    product_id integer REFERENCES products(id) ON DELETE SET NULL,
    product_name text NOT NULL,
    price_dzd integer NOT NULL DEFAULT 0,
    compare_at_price_dzd integer,
    hero_badge text NOT NULL DEFAULT 'Offre Spéciale Algérie · Livraison 58 Wilayas',
    headline text NOT NULL,
    subheadline text NOT NULL,
    cta_text text NOT NULL DEFAULT 'Commander maintenant — Paiement à la livraison',
    urgency_text text NOT NULL DEFAULT 'Stock limité · Expédition rapide 24/48h',
    hero_image_url text,
    gallery_images_json text NOT NULL DEFAULT '[]',
    colors_json text NOT NULL DEFAULT '[]',
    benefits_json text NOT NULL DEFAULT '[]',
    specs_json text NOT NULL DEFAULT '[]',
    testimonials_json text NOT NULL DEFAULT '[]',
    faq_json text NOT NULL DEFAULT '[]',
    accent_color text NOT NULL DEFAULT '#1d4ed8',
    is_published boolean NOT NULL DEFAULT true,
    views_count integer NOT NULL DEFAULT 0,
    orders_count integer NOT NULL DEFAULT 0,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
  )`,
];

async function ensureTablesExist(): Promise<void> {
  const check = await db.execute(sql`SELECT to_regclass('public.store_settings') AS tbl`);
  const existing = (check.rows?.[0] as { tbl?: string | null } | undefined)?.tbl;
  if (!existing) {
    for (const stmt of DDL_STATEMENTS) {
      await db.execute(sql.raw(stmt));
    }
    return;
  }
  // Ensure newly added columns/tables exist on pre-existing databases (e.g. Neon Postgres on Vercel)
  try {
    const colCheck = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'store_settings' AND column_name = 'catalog_initialized'`,
    );
    if (!colCheck.rows || colCheck.rows.length === 0) {
      await db.execute(
        sql.raw(
          `ALTER TABLE store_settings ADD COLUMN IF NOT EXISTS catalog_initialized boolean NOT NULL DEFAULT false`,
        ),
      );
    }
  } catch (e) {
    console.warn('Skipping catalog_initialized DDL check:', e);
  }

  try {
    const lpCheck = await db.execute(sql`SELECT to_regclass('public.landing_pages') AS tbl`);
    const lpExisting = (lpCheck.rows?.[0] as { tbl?: string | null } | undefined)?.tbl;
    if (!lpExisting) {
      await db.execute(sql.raw(DDL_STATEMENTS[DDL_STATEMENTS.length - 1]));
    }
  } catch (e) {
    console.warn('Skipping landing_pages DDL check:', e);
  }

  try {
    const prodColCheck = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'products' AND column_name = 'colors_json'`,
    );
    if (!prodColCheck.rows || prodColCheck.rows.length === 0) {
      await db.execute(
        sql.raw(`ALTER TABLE products ADD COLUMN IF NOT EXISTS colors_json text NOT NULL DEFAULT '[]'`),
      );
    }
  } catch (e) {
    console.warn('Skipping products.colors_json DDL check:', e);
  }

  try {
    const lpColCheck = await db.execute(
      sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'landing_pages' AND column_name = 'colors_json'`,
    );
    if (!lpColCheck.rows || lpColCheck.rows.length === 0) {
      await db.execute(
        sql.raw(`ALTER TABLE landing_pages ADD COLUMN IF NOT EXISTS colors_json text NOT NULL DEFAULT '[]'`),
      );
    }
  } catch (e) {
    console.warn('Skipping landing_pages.colors_json DDL check:', e);
  }
}

export async function ensureDatabaseSeeded(): Promise<void> {
  if (seeded) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      await ensureTablesExist();
      // 1. Store settings singleton
      let [settingsRow] = await db.select().from(storeSettings).limit(1);
      if (!settingsRow) {
        const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'badroumc@gmail.com').toLowerCase();
        const [insertedSettings] = await db
          .insert(storeSettings)
          .values({
            storeName: '2Frères Phone',
            tagline: 'Accessoires téléphoniques, Jeux vidéo & Abonnements numériques en Algérie',
            logoUrl: null,
            whatsappPhone: '+213550000000',
            supportEmail: 'contact@2freresphone.dz',
            adminAlertEmail: initialAdminEmail,
            defaultLowStockThreshold: 10,
            currency: 'DZD',
            storeAddress: 'Algérie — Livraison 58 Wilayas',
            codEnabled: true,
            catalogInitialized: false,
          })
          .returning();
        settingsRow = insertedSettings;
      }

      // 2. Initial admin accounts (co-owners)
      const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'badroumc@gmail.com').toLowerCase();
      const defaultAdmins = [
        { email: initialAdminEmail, fullName: 'Administrateur 2Frères Phone' },
        { email: 'badroumc@gmail.com', fullName: 'Administrateur 2Frères Phone' },
        { email: 'tigrine156@gmail.com', fullName: 'Co-gérant 2Frères Phone' },
      ];
      for (const adm of defaultAdmins) {
        await db
          .insert(adminUsers)
          .values({
            email: adm.email,
            fullName: adm.fullName,
            role: 'super_admin',
            isActive: true,
          })
          .onConflictDoNothing({ target: adminUsers.email });
      }

      // 3. Categories (only seeded once on first initialization so deleted categories never respawn)
      if (!settingsRow?.catalogInitialized) {
        const catCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(categories);
        if ((catCountRes[0]?.count ?? 0) === 0) {
          await db.insert(categories).values(INITIAL_CATEGORIES).onConflictDoNothing();
        }
      }

      // 4. Carriers & editable 58-wilaya shipping grid
      const carrierCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(carriers);
      if ((carrierCountRes[0]?.count ?? 0) === 0) {
        const [manualCarrier] = await db
          .insert(carriers)
          .values({
            name: 'Grille Standard 2Frères (Configurable)',
            code: '2FP_STANDARD',
            supportsHome: true,
            supportsStopDesk: true,
            apiProvider: 'manual',
            apiConfigured: false,
            notes: 'Grille de base modifiable depuis Tarifs de livraison. Vérifiez et ajustez selon vos contrats transporteurs.',
            isActive: true,
          })
          .returning();

        await db
          .insert(carriers)
          .values([
            {
              name: 'Yalidine Express (API à configurer)',
              code: 'YALIDINE',
              supportsHome: true,
              supportsStopDesk: true,
              apiProvider: 'yalidine',
              apiEndpoint: 'https://api.yalidine.app/v1',
              apiConfigured: false,
              notes: 'Prêt pour intégration API future (clé API et ID requis).',
              isActive: false,
            },
            {
              name: 'ZR Express (API à configurer)',
              code: 'ZREXPRESS',
              supportsHome: true,
              supportsStopDesk: true,
              apiProvider: 'zrexpress',
              apiEndpoint: 'https://procolis.com/api_v1',
              apiConfigured: false,
              notes: 'Prêt pour intégration API future (token requis).',
              isActive: false,
            },
          ])
          .onConflictDoNothing();

        if (manualCarrier) {
          const rateRows = ALGERIA_WILAYAS.map((w) => {
            const homePriceDzd =
              w.code === '16' ? 500 : w.region === 'centre' ? 650 : w.region === 'sud' ? 1100 : 800;
            const stopDeskPriceDzd =
              w.code === '16' ? 350 : w.region === 'centre' ? 450 : w.region === 'sud' ? 750 : 500;
            const estimatedDays = w.region === 'sud' ? '48-72h' : '24-48h';
            return {
              carrierId: manualCarrier.id,
              wilayaCode: w.code,
              wilayaName: w.name,
              homePriceDzd,
              stopDeskPriceDzd,
              estimatedDays,
              isActive: true,
            };
          });
          await db.insert(shippingRates).values(rateRows);
        }
      }

      // 5. Initial products catalog (ONLY seeded on first-ever database initialization)
      const prodCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(products);
      if (!settingsRow?.catalogInitialized && (prodCountRes[0]?.count ?? 0) === 0) {
        const allCats = await db.select().from(categories);
        const catBySlug = new Map(allCats.map((c) => [c.slug, c.id]));

        const starterProducts = [
          {
            categorySlug: 'coques',
            sku: '2FP-COQ-MAG15P',
            barcode: '613020000101',
            name: 'Coque MagSafe Silicone Premium iPhone 15 Pro',
            slug: 'coque-magsafe-silicone-premium-iphone-15-pro',
            brand: '2Frères Select',
            shortDescription: 'Protection antichoc doublée microfibre avec anneau magnétique MagSafe intégré.',
            description:
              'Coque de protection haut de gamme en silicone liquide toucher doux, intérieur en microfibre protectrice, bords surélevés caméra et compatibilité charge sans fil MagSafe.',
            productType: 'physical',
            priceDzd: 2400,
            compareAtPriceDzd: 2900,
            costPriceDzd: 1200,
            stockQuantity: 28,
            lowStockThreshold: 10,
            isFeatured: true,
            image: IMG_ACCESSORIES,
          },
          {
            categorySlug: 'chargeurs',
            sku: '2FP-CHG-GAN65',
            barcode: '613020000102',
            name: 'Chargeur Rapide GaN 65W Double USB-C + USB-A',
            slug: 'chargeur-rapide-gan-65w-double-usb-c',
            brand: 'Anker / GaN Pro',
            shortDescription: 'Charge ultra-rapide 65W Power Delivery compatible iPhone, Samsung, Xiaomi et PC portables.',
            description:
              'Technologie GaN compacte avec protection contre la surchauffe et les surtensions. Permet de charger simultanément 3 appareils avec répartition intelligente de puissance.',
            productType: 'physical',
            priceDzd: 4900,
            compareAtPriceDzd: 5800,
            costPriceDzd: 2900,
            stockQuantity: 19,
            lowStockThreshold: 8,
            isFeatured: true,
            image: IMG_HERO,
          },
          {
            categorySlug: 'ecouteurs-bluetooth',
            sku: '2FP-ECO-ANC01',
            barcode: '613020000103',
            name: 'Écouteurs Bluetooth TWS Réduction de Bruit Active',
            slug: 'ecouteurs-bluetooth-tws-reduction-bruit-active',
            brand: 'SoundCore Pro',
            shortDescription: 'Autonomie 30h avec boîtier USB-C, réduction active du bruit et mode faible latence.',
            description:
              'Son haute définition avec basses équilibrées, double micro pour appels clairs, résistance éclaboussures IPX5 et connexion instantanée Bluetooth 5.3.',
            productType: 'physical',
            priceDzd: 6500,
            compareAtPriceDzd: 7500,
            costPriceDzd: 3900,
            stockQuantity: 14,
            lowStockThreshold: 6,
            isFeatured: true,
            image: IMG_AUDIO_POWER,
          },
          {
            categorySlug: 'batteries-externes',
            sku: '2FP-PWR-10K',
            barcode: '613020000104',
            name: 'Batterie Externe Magnétique 10 000 mAh PD 20W',
            slug: 'batterie-externe-magnetique-10000mah-pd-20w',
            brand: '2Frères Power',
            shortDescription: 'Power bank slim aluminium anodisé avec charge rapide 20W USB-C et magnétique.',
            description:
              'Compacte et légère, idéale pour les déplacements. Indicateurs LED de charge, protection multi-couches et port bidirectionnel USB-C Power Delivery.',
            productType: 'physical',
            priceDzd: 5400,
            compareAtPriceDzd: null,
            costPriceDzd: 3200,
            stockQuantity: 7,
            lowStockThreshold: 10,
            isFeatured: true,
            image: IMG_AUDIO_POWER,
          },
          {
            categorySlug: 'verres-trempes-et-protections',
            sku: '2FP-VER-9D',
            barcode: '613020000105',
            name: 'Verre Trempé Intégral 9H Anti-Traces (Pack x2)',
            slug: 'verre-trempe-integral-9h-anti-traces-pack-2',
            brand: 'ShieldGlass',
            shortDescription: 'Dureté 9H haute transparence avec kit de pose sans bulles inclus.',
            description:
              'Protection écran bord à bord oléophobe, préserve la sensibilité tactile et la netteté HD. Disponible pour iPhone, Samsung Galaxy et Redmi.',
            productType: 'physical',
            priceDzd: 1200,
            compareAtPriceDzd: 1500,
            costPriceDzd: 450,
            stockQuantity: 45,
            lowStockThreshold: 15,
            isFeatured: false,
            image: IMG_ACCESSORIES,
          },
          {
            categorySlug: 'jeux-playstation',
            sku: '2FP-PS5-FC25',
            barcode: null,
            name: 'Jeu PlayStation PS5 / PS4 — Livraison Numérique Officielle',
            slug: 'jeu-playstation-ps5-ps4-livraison-numerique',
            brand: 'PlayStation',
            shortDescription: 'Activation vérifiée après validation de la commande et du paiement.',
            description:
              'Produit numérique livré manuellement par l’équipe 2Frères Phone après confirmation du paiement, accompagné d’un guide d’activation clair et d’un support dédié.',
            productType: 'digital',
            priceDzd: 7900,
            compareAtPriceDzd: 8900,
            costPriceDzd: 5800,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: true,
            image: IMG_GAMING,
            digitalActivationTemplate:
              'Instructions envoyées par notre équipe après validation du paiement. Ne partagez jamais vos accès.',
          },
          {
            categorySlug: 'abonnements-gaming',
            sku: '2FP-XBX-GPU3M',
            barcode: null,
            name: 'Xbox Game Pass Ultimate — Abonnement 3 Mois',
            slug: 'xbox-game-pass-ultimate-3-mois',
            brand: 'Xbox',
            shortDescription: 'Accès complet au catalogue Xbox Game Pass console & PC, EA Play inclus.',
            description:
              'Profitez de centaines de jeux sur Xbox Series X|S, Xbox One et PC. Livraison et activation traitées par notre équipe après validation de votre commande.',
            productType: 'digital',
            priceDzd: 6200,
            compareAtPriceDzd: 7000,
            costPriceDzd: 4400,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: true,
            image: IMG_GAMING,
            digitalActivationTemplate:
              'Activation manuelle sous 15 à 60 minutes après validation de votre règlement.',
          },
          {
            categorySlug: 'netflix',
            sku: '2FP-DIG-NFX1M',
            barcode: null,
            name: 'Abonnement Netflix 4K Ultra HD — 1 Mois',
            slug: 'abonnement-netflix-4k-ultra-hd-1-mois',
            brand: 'Netflix',
            shortDescription: 'Qualité 4K UHD garantie, activation rapide après confirmation de paiement.',
            description:
              'Service numérique officiel suivi par 2Frères Phone pendant toute la durée de l’abonnement. Aucun identifiant n’est stocké publiquement : livraison sécurisée après validation.',
            productType: 'digital',
            priceDzd: 1400,
            compareAtPriceDzd: null,
            costPriceDzd: 850,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: true,
            image: IMG_DIGITAL,
            digitalActivationTemplate:
              'Les consignes d’activation sont transmises en privé par notre équipe dès validation du paiement.',
          },
          {
            categorySlug: 'snapchat-plus',
            sku: '2FP-DIG-SNP3M',
            barcode: null,
            name: 'Abonnement Snapchat+ Officiel — 3 Mois',
            slug: 'abonnement-snapchat-plus-3-mois',
            brand: 'Snapchat+',
            shortDescription: 'Débloquez les fonctionnalités exclusives Snapchat+ sur votre compte personnel.',
            description:
              'Activation sécurisée sur votre compte existant après validation de la commande. Accompagnement WhatsApp en cas de besoin.',
            productType: 'digital',
            priceDzd: 2100,
            compareAtPriceDzd: 2500,
            costPriceDzd: 1350,
            stockQuantity: 99,
            lowStockThreshold: null,
            isFeatured: false,
            image: IMG_DIGITAL,
            digitalActivationTemplate:
              'Fournissez votre nom d’utilisateur Snapchat lors de la confirmation pour activation rapide.',
          },
        ];

        for (const item of starterProducts) {
          const [inserted] = await db
            .insert(products)
            .values({
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
              digitalAvailability: item.productType === 'digital' ? 'available' : null,
              digitalActivationTemplate: item.digitalActivationTemplate ?? null,
            })
            .onConflictDoNothing()
            .returning();

          if (inserted) {
            await db.insert(productImages).values({
              productId: inserted.id,
              url: item.image,
              altText: item.name,
              sortOrder: 0,
              isPrimary: true,
            });
          }
        }
      }

      // Mark catalogInitialized = true permanently so deleted starter products or categories never respawn
      if (settingsRow && !settingsRow.catalogInitialized) {
        await db
          .update(storeSettings)
          .set({ catalogInitialized: true })
          .where(eq(storeSettings.id, settingsRow.id));
      }

      // 6. Social links
      const socialCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(socialLinks);
      if ((socialCountRes[0]?.count ?? 0) === 0) {
        await db.insert(socialLinks).values([
          { platform: 'whatsapp', label: 'WhatsApp Commandes', urlOrHandle: '+213550000000', isActive: true, sortOrder: 1 },
          { platform: 'instagram', label: 'Instagram @2freresphone', urlOrHandle: 'https://instagram.com/2freresphone', isActive: true, sortOrder: 2 },
          { platform: 'facebook', label: 'Facebook 2Frères Phone', urlOrHandle: 'https://facebook.com/2freresphone', isActive: true, sortOrder: 3 },
          { platform: 'tiktok', label: 'TikTok @2freresphone', urlOrHandle: 'https://tiktok.com/@2freresphone', isActive: true, sortOrder: 4 },
        ]);
      }

      // 7. Starter promo code
      const promoCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(promotions);
      if ((promoCountRes[0]?.count ?? 0) === 0) {
        await db.insert(promotions).values({
          code: 'BIENVENUE10',
          description: '10 % de réduction dès 4 000 DZD d’achat',
          discountType: 'percent',
          discountValue: 10,
          minOrderDzd: 4000,
          maxUses: 500,
          isActive: true,
        }).onConflictDoNothing();
      }

      seeded = true;
    } catch (error) {
      seedPromise = null;
      console.error('Database seed error:', error);
      throw error;
    }
  })();

  return seedPromise;
}
