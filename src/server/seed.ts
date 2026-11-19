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

export async function ensureDatabaseSeeded(): Promise<void> {
  if (seeded) return;
  if (seedPromise) return seedPromise;

  seedPromise = (async () => {
    try {
      // 1. Store settings singleton
      const existingSettings = await db.select().from(storeSettings).limit(1);
      if (existingSettings.length === 0) {
        const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'badroumc@gmail.com').toLowerCase();
        await db.insert(storeSettings).values({
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
        });
      }

      // 2. Initial admin account
      const initialAdminEmail = (process.env.INITIAL_ADMIN_EMAIL || 'badroumc@gmail.com').toLowerCase();
      await db
        .insert(adminUsers)
        .values({
          email: initialAdminEmail,
          fullName: 'Administrateur 2Frères Phone',
          role: 'super_admin',
          isActive: true,
        })
        .onConflictDoNothing({ target: adminUsers.email });

      // 3. Categories
      const catCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(categories);
      if ((catCountRes[0]?.count ?? 0) === 0) {
        await db.insert(categories).values(INITIAL_CATEGORIES).onConflictDoNothing();
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

      // 5. Initial products catalog (only if empty)
      const prodCountRes = await db.select({ count: sql<number>`count(*)::int` }).from(products);
      if ((prodCountRes[0]?.count ?? 0) === 0) {
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
