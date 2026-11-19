import 'dotenv/config';
import express from 'express';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { db, hasDatabaseConfig } from './src/db/index.ts';
import {
  adminUsers,
  carriers,
  categories,
  customers,
  digitalDeliveries,
  importMappingProfiles,
  mediaAssets,
  orderItems,
  orders,
  orderStatusHistory,
  productImages,
  productReviews,
  products,
  promotions,
  returns,
  sales,
  shippingRates,
  socialLinks,
  stockAlerts,
  stockImports,
  stockMovements,
  storeSettings,
} from './src/db/schema.ts';
import { type AuthRequest, requireAdmin } from './src/middleware/auth.ts';
import { ensureDatabaseSeeded } from './src/server/seed.ts';
import { evaluateProductLowStock, syncAllLowStockAlerts } from './src/server/stockAlerts.ts';
import {
  buildDifferentialSyncPlan,
  type ColumnMapping,
  parseStockDatabaseBuffer,
  type StockSyncMode,
} from './src/server/stockImportParser.ts';
import { ALGERIA_WILAYAS, getWilayaByCode } from './src/shared/algeria.ts';
import {
  calculatePromoDiscount,
  calculateReviewSummary,
  computeEffectiveLowStockThreshold,
  generateOrderReference,
  isValidAlgerianPhone,
  normalizeAlgerianPhone,
  type OrderStatus,
  shouldDeductStockOnStatus,
  slugify,
} from './src/shared/domain.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB max for stock DBs / photos
});

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // Lazy seed middleware on API routes (never top-level startup probe!)
  app.use('/api', async (_req, res, next) => {
    if (!hasDatabaseConfig()) {
      return res.status(503).json({
        error:
          'Base de données PostgreSQL non connectée sur Vercel : ouvrez Vercel → Storage → Create Database → Neon Postgres, puis cliquez sur Redeploy.',
      });
    }
    try {
      await ensureDatabaseSeeded();
      next();
    } catch (error) {
      console.error('API bootstrap failed:', error);
      res.status(503).json({ error: 'Service de base de données momentanément indisponible.' });
    }
  });

  // ---------------------------------------------------------------------------
  // MEDIA SERVING (Platform Logo + Product Photos stored persistently in DB)
  // ---------------------------------------------------------------------------
  app.get('/api/media/:id', async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).send('Invalid media ID');
      const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, id));
      if (!asset) return res.status(404).send('Not found');
      const buffer = Buffer.from(asset.dataBase64, 'base64');
      res.setHeader('Content-Type', asset.mimeType);
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      return res.send(buffer);
    } catch (error) {
      console.error('Error serving media:', error);
      return res.status(500).send('Media error');
    }
  });

  // ---------------------------------------------------------------------------
  // PUBLIC STOREFRONT ENDPOINTS
  // ---------------------------------------------------------------------------
  app.get('/api/store/bootstrap', async (_req, res) => {
    try {
      const [settingsRow] = await db.select().from(storeSettings).limit(1);
      const activeCategories = await db
        .select()
        .from(categories)
        .where(eq(categories.isActive, true))
        .orderBy(asc(categories.sortOrder), asc(categories.name));
      const activeSocials = await db
        .select()
        .from(socialLinks)
        .where(eq(socialLinks.isActive, true))
        .orderBy(asc(socialLinks.sortOrder));
      const activeCarriers = await db
        .select()
        .from(carriers)
        .where(eq(carriers.isActive, true))
        .orderBy(asc(carriers.id));
      const rates = await db
        .select()
        .from(shippingRates)
        .where(eq(shippingRates.isActive, true))
        .orderBy(asc(shippingRates.wilayaCode));

      // Sanitize public settings (never expose adminAlertEmail publicly)
      const publicSettings = settingsRow
        ? {
            storeName: settingsRow.storeName,
            tagline: settingsRow.tagline,
            logoUrl: settingsRow.logoUrl,
            whatsappPhone: settingsRow.whatsappPhone,
            supportEmail: settingsRow.supportEmail,
            currency: settingsRow.currency,
            storeAddress: settingsRow.storeAddress,
            codEnabled: settingsRow.codEnabled,
            digitalOrderNote: settingsRow.digitalOrderNote,
          }
        : null;

      return res.json({
        settings: publicSettings,
        categories: activeCategories,
        socialLinks: activeSocials,
        carriers: activeCarriers.map((c) => ({
          id: c.id,
          name: c.name,
          code: c.code,
          supportsHome: c.supportsHome,
          supportsStopDesk: c.supportsStopDesk,
        })),
        shippingRates: rates,
        wilayas: ALGERIA_WILAYAS,
      });
    } catch (error) {
      console.error('Bootstrap error:', error);
      return res.status(500).json({ error: 'Impossible de charger la boutique.' });
    }
  });

  app.get('/api/products', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim().toLowerCase();
      const categorySlug = String(req.query.category || '').trim();
      const group = String(req.query.group || '').trim();
      const type = String(req.query.type || '').trim();
      const featured = req.query.featured === 'true';
      const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
      const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
      const sort = String(req.query.sort || 'featured');

      const allCategories = await db.select().from(categories);
      const catMap = new Map(allCategories.map((c) => [c.id, c]));

      const allProducts = await db
        .select()
        .from(products)
        .where(eq(products.isActive, true))
        .orderBy(desc(products.isFeatured), desc(products.createdAt));

      const allImages = await db
        .select()
        .from(productImages)
        .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
      const imagesByProduct = new Map<number, typeof allImages>();
      for (const img of allImages) {
        const list = imagesByProduct.get(img.productId) || [];
        list.push(img);
        imagesByProduct.set(img.productId, list);
      }

      const approvedReviews = await db
        .select({ productId: productReviews.productId, rating: productReviews.rating })
        .from(productReviews)
        .where(eq(productReviews.status, 'approved'));
      const ratingsByProduct = new Map<number, number[]>();
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
          categoryName: cat?.name || 'Non classé',
          categorySlug: cat?.slug || '',
          categoryGroup: cat?.categoryGroup || 'accessories',
          primaryImage: imgs[0]?.url || null,
          images: imgs.map((i) => ({ id: i.id, url: i.url, altText: i.altText, isPrimary: i.isPrimary })),
          averageRating: reviewStats.averageRating,
          reviewCount: reviewStats.reviewCount,
        };
      });

      if (q) {
        enriched = enriched.filter(
          (p) =>
            p.name.toLowerCase().includes(q) ||
            (p.brand || '').toLowerCase().includes(q) ||
            p.sku.toLowerCase().includes(q) ||
            p.categoryName.toLowerCase().includes(q) ||
            (p.shortDescription || '').toLowerCase().includes(q),
        );
      }
      if (categorySlug) {
        enriched = enriched.filter((p) => p.categorySlug === categorySlug);
      }
      if (group) {
        enriched = enriched.filter((p) => p.categoryGroup === group);
      }
      if (type === 'physical' || type === 'digital') {
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

      if (sort === 'price_asc') enriched.sort((a, b) => a.priceDzd - b.priceDzd);
      else if (sort === 'price_desc') enriched.sort((a, b) => b.priceDzd - a.priceDzd);
      else if (sort === 'rating') enriched.sort((a, b) => b.averageRating - a.averageRating);
      else if (sort === 'newest') enriched.sort((a, b) => b.id - a.id);

      return res.json({ products: enriched });
    } catch (error) {
      console.error('Products list error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du catalogue.' });
    }
  });

  app.get('/api/products/:slug', async (req, res) => {
    try {
      const slug = req.params.slug;
      const [product] = await db
        .select()
        .from(products)
        .where(and(eq(products.slug, slug), eq(products.isActive, true)));

      if (!product) {
        return res.status(404).json({ error: 'Produit introuvable.' });
      }

      const cat = product.categoryId
        ? (await db.select().from(categories).where(eq(categories.id, product.categoryId)))[0]
        : null;
      const imgs = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, product.id))
        .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));

      const reviews = await db
        .select({
          id: productReviews.id,
          customerName: productReviews.customerName,
          rating: productReviews.rating,
          title: productReviews.title,
          comment: productReviews.comment,
          isVerifiedPurchase: productReviews.isVerifiedPurchase,
          adminReply: productReviews.adminReply,
          createdAt: productReviews.createdAt,
        })
        .from(productReviews)
        .where(and(eq(productReviews.productId, product.id), eq(productReviews.status, 'approved')))
        .orderBy(desc(productReviews.createdAt));

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
          digitalActivationNote:
            product.productType === 'digital'
              ? 'Livraison et activation effectuées après validation de votre commande et du paiement. Aucun identifiant n’est exposé publiquement.'
              : null,
          categoryId: product.categoryId,
          categoryName: cat?.name || 'Non classé',
          categorySlug: cat?.slug || '',
          categoryGroup: cat?.categoryGroup || 'accessories',
          images: imgs,
          averageRating: reviewSummary.averageRating,
          reviewCount: reviewSummary.reviewCount,
          ratingDistribution: reviewSummary.distribution,
        },
        reviews,
      });
    } catch (error) {
      console.error('Product detail error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du produit.' });
    }
  });

  // Verified customer review submission (must have purchased this product!)
  app.post('/api/products/:id/reviews', async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const { orderReference, phone, rating, title, comment } = req.body || {};

      if (!Number.isInteger(productId)) {
        return res.status(400).json({ error: 'Produit invalide.' });
      }
      if (!orderReference || !phone || !comment || typeof rating !== 'number') {
        return res.status(400).json({
          error: 'Veuillez renseigner votre référence de commande, téléphone, note (1-5) et avis écrit.',
        });
      }
      if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'La note doit être comprise entre 1 et 5 étoiles.' });
      }
      if (String(comment).trim().length < 8) {
        return res.status(400).json({ error: 'Votre avis doit contenir au moins 8 caractères.' });
      }

      const normalizedPhone = normalizeAlgerianPhone(String(phone));
      const cleanRef = String(orderReference).trim().toUpperCase();

      const [order] = await db
        .select()
        .from(orders)
        .where(eq(orders.reference, cleanRef));

      if (!order || normalizeAlgerianPhone(order.phone) !== normalizedPhone) {
        return res.status(403).json({
          error: 'Aucune commande correspondante trouvée pour cette référence et ce numéro de téléphone.',
        });
      }

      if (order.status === 'annulee' || order.status === 'retournee') {
        return res.status(403).json({
          error: 'Impossible de laisser un avis pour une commande annulée ou retournée.',
        });
      }

      const items = await db
        .select()
        .from(orderItems)
        .where(and(eq(orderItems.orderId, order.id), eq(orderItems.productId, productId)));

      if (items.length === 0) {
        return res.status(403).json({
          error: 'Ce produit ne figure pas dans la commande indiquée. Seuls les acheteurs vérifiés peuvent déposer un avis.',
        });
      }

      const duplicate = await db
        .select()
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, productId),
            eq(productReviews.orderId, order.id),
          ),
        );

      if (duplicate.length > 0) {
        return res.status(409).json({
          error: 'Un avis a déjà été soumis pour ce produit avec cette commande.',
        });
      }

      const [created] = await db
        .insert(productReviews)
        .values({
          productId,
          orderId: order.id,
          orderReference: order.reference,
          customerName: `${order.firstName} ${order.lastName.charAt(0).toUpperCase()}.`,
          customerPhone: normalizedPhone,
          rating: Math.round(rating),
          title: String(title || '').trim().slice(0, 120),
          comment: String(comment).trim().slice(0, 1500),
          isVerifiedPurchase: true,
          status: 'pending',
        })
        .returning();

      return res.status(201).json({
        message: 'Merci ! Votre avis d’acheteur vérifié a été envoyé pour modération par notre équipe.',
        review: {
          id: created.id,
          status: created.status,
          rating: created.rating,
        },
      });
    } catch (error) {
      console.error('Review submission error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’envoi de votre avis.' });
    }
  });

  // Checkout calculation (real DB shipping rates & promo validation)
  app.post('/api/checkout/calculate', async (req, res) => {
    try {
      const { items, wilayaCode, deliveryType, carrierId, promoCode } = req.body || {};
      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Votre panier est vide.' });
      }

      const productIds = items.map((i: any) => Number(i.productId)).filter(Number.isInteger);
      const dbProducts = await db
        .select()
        .from(products)
        .where(inArray(products.id, productIds));
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      let subtotalDzd = 0;
      let hasPhysical = false;
      let hasDigital = false;

      for (const line of items) {
        const prod = prodMap.get(Number(line.productId));
        if (!prod || !prod.isActive) {
          return res.status(400).json({ error: 'Un article du panier n’est plus disponible.' });
        }
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        subtotalDzd += prod.priceDzd * qty;
        if (prod.productType === 'digital') hasDigital = true;
        else hasPhysical = true;
      }

      let shippingFeeDzd = 0;
      let resolvedCarrierId: number | null = null;
      let resolvedCarrierName: string | null = null;
      let estimatedDays: string | null = null;

      if (hasPhysical && wilayaCode) {
        const normWilaya = String(wilayaCode).padStart(2, '0');
        let rateRows = await db
          .select()
          .from(shippingRates)
          .where(and(eq(shippingRates.wilayaCode, normWilaya), eq(shippingRates.isActive, true)));

        if (carrierId) {
          const matching = rateRows.filter((r) => r.carrierId === Number(carrierId));
          if (matching.length > 0) rateRows = matching;
        }

        const chosenRate = rateRows[0];
        if (!chosenRate) {
          return res.status(400).json({
            error: 'Aucun tarif de livraison configuré pour cette wilaya. Contactez-nous sur WhatsApp.',
          });
        }
        const [carrier] = await db.select().from(carriers).where(eq(carriers.id, chosenRate.carrierId));
        resolvedCarrierId = chosenRate.carrierId;
        resolvedCarrierName = carrier?.name || 'Transporteur configuré';
        estimatedDays = chosenRate.estimatedDays;
        shippingFeeDzd =
          deliveryType === 'stop_desk' ? chosenRate.stopDeskPriceDzd : chosenRate.homePriceDzd;
      }

      let discountDzd = 0;
      let promoFeedback: { applied: boolean; code?: string; message: string } | null = null;

      if (promoCode && String(promoCode).trim()) {
        const code = String(promoCode).trim().toUpperCase();
        const [promo] = await db
          .select()
          .from(promotions)
          .where(and(eq(promotions.code, code), eq(promotions.isActive, true)));
        if (!promo) {
          promoFeedback = { applied: false, message: 'Code promotionnel invalide ou expiré.' };
        } else if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
          promoFeedback = { applied: false, message: 'Ce code promo a atteint sa limite d’utilisation.' };
        } else if (promo.endsAt && new Date(promo.endsAt) < new Date()) {
          promoFeedback = { applied: false, message: 'Ce code promo est expiré.' };
        } else {
          const calc = calculatePromoDiscount({
            subtotalDzd,
            shippingFeeDzd,
            discountType: promo.discountType as 'percent' | 'fixed' | 'free_shipping',
            discountValue: promo.discountValue,
            minOrderDzd: promo.minOrderDzd,
          });
          if (!calc.valid) {
            promoFeedback = { applied: false, message: calc.reason || 'Conditions non remplies.' };
          } else {
            discountDzd = calc.discountDzd;
            shippingFeeDzd = calc.effectiveShippingDzd;
            promoFeedback = { applied: true, code: promo.code, message: `Code ${promo.code} appliqué.` };
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
        promoFeedback,
      });
    } catch (error) {
      console.error('Checkout calculate error:', error);
      return res.status(500).json({ error: 'Erreur lors du calcul du total.' });
    }
  });

  // Public Order Creation (no account required!)
  app.post('/api/orders', async (req, res) => {
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
        customerNotes,
      } = req.body || {};

      if (
        !String(firstName || '').trim() ||
        !String(lastName || '').trim() ||
        !String(phone || '').trim() ||
        !String(wilayaCode || '').trim() ||
        !String(commune || '').trim() ||
        !String(address || '').trim()
      ) {
        return res.status(400).json({
          error: 'Tous les champs obligatoires doivent être remplis (Nom, Prénom, Téléphone, Wilaya, Commune, Adresse).',
        });
      }

      if (!isValidAlgerianPhone(String(phone))) {
        return res.status(400).json({
          error: 'Numéro de téléphone algérien invalide (ex. 0550 12 34 56).',
        });
      }

      if (!Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Votre panier est vide.' });
      }

      const normalizedPhone = normalizeAlgerianPhone(String(phone));
      const normWilaya = String(wilayaCode).padStart(2, '0');
      const wilaya = getWilayaByCode(normWilaya);
      if (!wilaya) {
        return res.status(400).json({ error: 'Wilaya sélectionnée invalide.' });
      }

      // Check customer blocklist
      const [existingCustomer] = await db
        .select()
        .from(customers)
        .where(eq(customers.phone, normalizedPhone));
      if (existingCustomer?.isBlocked) {
        return res.status(403).json({
          error: 'Impossible de finaliser cette commande en ligne. Veuillez contacter la boutique par WhatsApp.',
        });
      }

      // Validate items & stock
      const productIds = items.map((i: any) => Number(i.productId)).filter(Number.isInteger);
      const dbProducts = await db
        .select()
        .from(products)
        .where(inArray(products.id, productIds));
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      let subtotalDzd = 0;
      let hasPhysical = false;
      let hasDigital = false;
      const resolvedItems: {
        product: typeof products.$inferSelect;
        quantity: number;
        lineTotalDzd: number;
      }[] = [];

      for (const line of items) {
        const prod = prodMap.get(Number(line.productId));
        if (!prod || !prod.isActive) {
          return res.status(400).json({ error: 'Un article sélectionné n’est plus disponible.' });
        }
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        if (prod.productType === 'physical' && prod.stockQuantity < qty) {
          return res.status(400).json({
            error: `Stock insuffisant pour "${prod.name}" (${prod.stockQuantity} disponible(s)).`,
          });
        }
        if (prod.productType === 'digital' && prod.digitalAvailability === 'paused') {
          return res.status(400).json({
            error: `Le service numérique "${prod.name}" est temporairement indisponible.`,
          });
        }
        const lineTotalDzd = prod.priceDzd * qty;
        subtotalDzd += lineTotalDzd;
        if (prod.productType === 'digital') hasDigital = true;
        else hasPhysical = true;
        resolvedItems.push({ product: prod, quantity: qty, lineTotalDzd });
      }

      // Calculate verified shipping fee
      let effectiveDeliveryType: 'home' | 'stop_desk' | 'digital' = hasPhysical
        ? deliveryType === 'stop_desk'
          ? 'stop_desk'
          : 'home'
        : 'digital';

      let shippingFeeDzd = 0;
      let resolvedCarrierId: number | null = null;
      let resolvedCarrierName: string | null = null;

      if (hasPhysical) {
        let rateRows = await db
          .select()
          .from(shippingRates)
          .where(and(eq(shippingRates.wilayaCode, normWilaya), eq(shippingRates.isActive, true)));
        if (carrierId) {
          const matching = rateRows.filter((r) => r.carrierId === Number(carrierId));
          if (matching.length > 0) rateRows = matching;
        }
        const rate = rateRows[0];
        if (!rate) {
          return res.status(400).json({ error: 'Tarif de livraison non configuré pour cette wilaya.' });
        }
        const [carrier] = await db.select().from(carriers).where(eq(carriers.id, rate.carrierId));
        resolvedCarrierId = rate.carrierId;
        resolvedCarrierName = carrier?.name || 'Transporteur configuré';
        shippingFeeDzd =
          effectiveDeliveryType === 'stop_desk' ? rate.stopDeskPriceDzd : rate.homePriceDzd;
      }

      // Apply promo code if valid
      let discountDzd = 0;
      let appliedPromoCode: string | null = null;
      if (promoCode && String(promoCode).trim()) {
        const code = String(promoCode).trim().toUpperCase();
        const [promo] = await db
          .select()
          .from(promotions)
          .where(and(eq(promotions.code, code), eq(promotions.isActive, true)));
        if (promo && (promo.maxUses === null || promo.usedCount < promo.maxUses)) {
          const calc = calculatePromoDiscount({
            subtotalDzd,
            shippingFeeDzd,
            discountType: promo.discountType as 'percent' | 'fixed' | 'free_shipping',
            discountValue: promo.discountValue,
            minOrderDzd: promo.minOrderDzd,
          });
          if (calc.valid) {
            discountDzd = calc.discountDzd;
            shippingFeeDzd = calc.effectiveShippingDzd;
            appliedPromoCode = promo.code;
            await db
              .update(promotions)
              .set({ usedCount: promo.usedCount + 1 })
              .where(eq(promotions.id, promo.id));
          }
        }
      }

      const totalDzd = Math.max(0, subtotalDzd - discountDzd + shippingFeeDzd);

      // Upsert customer
      const [customer] = await db
        .insert(customers)
        .values({
          firstName: String(firstName).trim(),
          lastName: String(lastName).trim(),
          phone: normalizedPhone,
          wilayaCode: wilaya.code,
          wilayaName: wilaya.name,
          commune: String(commune).trim(),
          address: String(address).trim(),
        })
        .onConflictDoUpdate({
          target: customers.phone,
          set: {
            firstName: String(firstName).trim(),
            lastName: String(lastName).trim(),
            wilayaCode: wilaya.code,
            wilayaName: wilaya.name,
            commune: String(commune).trim(),
            address: String(address).trim(),
            updatedAt: new Date(),
          },
        })
        .returning();

      const countRes = await db.select({ count: sql<number>`count(*)::int` }).from(orders);
      const nextSeq = (countRes[0]?.count ?? 0) + 101;
      const reference = generateOrderReference(nextSeq);

      const [createdOrder] = await db
        .insert(orders)
        .values({
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
          status: 'nouvelle',
          paymentMethod: hasPhysical ? 'cod' : 'manual_digital',
          paymentStatus: 'pending',
          promoCode: appliedPromoCode,
          subtotalDzd,
          discountDzd,
          shippingFeeDzd,
          totalDzd,
          hasDigitalItems: hasDigital,
          hasPhysicalItems: hasPhysical,
          stockDeducted: false,
          source: source === 'whatsapp' ? 'whatsapp' : 'web',
          customerNotes: customerNotes ? String(customerNotes).trim().slice(0, 500) : null,
        })
        .returning();

      for (const item of resolvedItems) {
        const [oi] = await db
          .insert(orderItems)
          .values({
            orderId: createdOrder.id,
            productId: item.product.id,
            productName: item.product.name,
            productSku: item.product.sku,
            productType: item.product.productType,
            unitPriceDzd: item.product.priceDzd,
            costPriceDzd: item.product.costPriceDzd,
            quantity: item.quantity,
            lineTotalDzd: item.lineTotalDzd,
          })
          .returning();

        if (item.product.productType === 'digital') {
          await db.insert(digitalDeliveries).values({
            orderId: createdOrder.id,
            orderItemId: oi.id,
            productId: item.product.id,
            productName: item.product.name,
            deliveryStatus: 'pending',
            activationInstructions: item.product.digitalActivationTemplate || '',
            privateFulfillmentNote: '',
          });
        }
      }

      await db.insert(orderStatusHistory).values({
        orderId: createdOrder.id,
        fromStatus: null,
        toStatus: 'nouvelle',
        note:
          source === 'whatsapp'
            ? 'Commande enregistrée via bouton WhatsApp'
            : 'Commande reçue depuis la boutique en ligne',
        changedBy: 'client',
      });

      return res.status(201).json({
        order: createdOrder,
        items: resolvedItems.map((i) => ({
          productId: i.product.id,
          name: i.product.name,
          quantity: i.quantity,
          unitPriceDzd: i.product.priceDzd,
          lineTotalDzd: i.lineTotalDzd,
          productType: i.product.productType,
        })),
      });
    } catch (error) {
      console.error('Order creation error:', error);
      return res.status(500).json({ error: 'Erreur lors de la validation de la commande.' });
    }
  });

  // Public Order Tracking via Reference (+ optional phone verification)
  app.get('/api/orders/track', async (req, res) => {
    try {
      const ref = String(req.query.reference || '').trim().toUpperCase();
      const phone = String(req.query.phone || '').trim();
      if (!ref) {
        return res.status(400).json({ error: 'Veuillez saisir votre référence de commande (ex. 2FP-2026-000101).' });
      }

      const [order] = await db.select().from(orders).where(eq(orders.reference, ref));
      if (!order) {
        return res.status(404).json({ error: `Aucune commande trouvée avec la référence ${ref}.` });
      }

      const phoneMatches = phone ? normalizeAlgerianPhone(phone) === normalizeAlgerianPhone(order.phone) : false;

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, order.id));
      const history = await db
        .select()
        .from(orderStatusHistory)
        .where(eq(orderStatusHistory.orderId, order.id))
        .orderBy(asc(orderStatusHistory.createdAt));

      // Digital delivery instructions are ONLY shared when status is 'delivered' AND phone is verified
      let digitalStatus: { productName: string; deliveryStatus: string; activationInstructions?: string }[] = [];
      if (order.hasDigitalItems) {
        const deliveries = await db
          .select()
          .from(digitalDeliveries)
          .where(eq(digitalDeliveries.orderId, order.id));
        digitalStatus = deliveries.map((d) => ({
          productName: d.productName,
          deliveryStatus: d.deliveryStatus,
          // NEVER expose credentials/privateFulfillmentNote publicly; only activation guide when delivered & phone verified
          activationInstructions:
            d.deliveryStatus === 'delivered' && phoneMatches ? d.activationInstructions : undefined,
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
          createdAt: order.createdAt,
        },
        items,
        history,
        digitalDeliveries: digitalStatus,
      });
    } catch (error) {
      console.error('Order tracking error:', error);
      return res.status(500).json({ error: 'Erreur lors du suivi de la commande.' });
    }
  });

  // ---------------------------------------------------------------------------
  // ADMIN PROTECTED API ROUTES (/api/admin/*)
  // ---------------------------------------------------------------------------
  app.get('/api/admin/me', requireAdmin, (req: AuthRequest, res) => {
    return res.json({ admin: req.adminUser });
  });

  // 1. Dashboard Overview & Real SQL Statistics
  app.get('/api/admin/dashboard', requireAdmin, async (_req, res) => {
    try {
      await syncAllLowStockAlerts();

      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const allSales = await db.select().from(sales).orderBy(desc(sales.recordedAt));
      const allProducts = await db.select().from(products);
      const allCustomers = await db.select().from(customers);
      const activeAlerts = await db
        .select()
        .from(stockAlerts)
        .where(eq(stockAlerts.status, 'active'))
        .orderBy(asc(stockAlerts.currentStock));
      const pendingReviews = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(productReviews)
        .where(eq(productReviews.status, 'pending'));
      const pendingDigital = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(digitalDeliveries)
        .where(eq(digitalDeliveries.deliveryStatus, 'pending'));
      const allImgs = await db.select({ productId: productImages.productId }).from(productImages);
      const productsWithPhotos = new Set(allImgs.map((i) => i.productId));
      const productsWithoutPhotos = allProducts.filter((p) => !productsWithPhotos.has(p.id)).length;

      const statusCounts: Record<string, number> = {
        nouvelle: 0,
        a_confirmer: 0,
        confirmee: 0,
        en_preparation: 0,
        expediee: 0,
        livree: 0,
        annulee: 0,
        retournee: 0,
      };
      for (const o of allOrders) {
        statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
      }

      const totalOrders = allOrders.length;
      const confirmedOrFurther =
        statusCounts.confirmee +
        statusCounts.en_preparation +
        statusCounts.expediee +
        statusCounts.livree +
        statusCounts.retournee;
      const confirmationRate = totalOrders > 0 ? Math.round((confirmedOrFurther / totalOrders) * 100) : 0;
      const shippedOrFinished = statusCounts.expediee + statusCounts.livree + statusCounts.retournee;
      const deliveryRate = shippedOrFinished > 0 ? Math.round((statusCounts.livree / shippedOrFinished) * 100) : 0;
      const returnRate = shippedOrFinished > 0 ? Math.round((statusCounts.retournee / shippedOrFinished) * 100) : 0;

      const deliveredRevenueDzd = allSales.reduce((acc, s) => acc + s.totalCollectedDzd, 0);
      const estimatedMarginDzd = allSales.reduce((acc, s) => acc + s.estimatedMarginDzd, 0);
      const pendingPipelineDzd = allOrders
        .filter((o) => !['livree', 'annulee', 'retournee'].includes(o.status))
        .reduce((acc, o) => acc + o.totalDzd, 0);
      const stockValuationDzd = allProducts
        .filter((p) => p.productType === 'physical')
        .reduce((acc, p) => acc + p.stockQuantity * p.priceDzd, 0);

      // Build last 14 days real chart series
      const dayMap = new Map<string, { date: string; commandes: number; ventesDzd: number }>();
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
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

      // Top wilayas by order volume
      const wilayaCounts = new Map<string, number>();
      for (const o of allOrders) {
        wilayaCounts.set(o.wilayaName, (wilayaCounts.get(o.wilayaName) || 0) + 1);
      }
      const topWilayas = Array.from(wilayaCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([wilaya, count]) => ({ wilaya, count }));

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
          pendingDigitalCount: pendingDigital[0]?.count ?? 0,
        },
        statusCounts,
        chartSeries: Array.from(dayMap.values()),
        topWilayas,
        activeLowStockAlerts: activeAlerts,
        recentOrders: allOrders.slice(0, 8),
      });
    } catch (error) {
      console.error('Admin dashboard error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement du tableau de bord.' });
    }
  });

  // 2. Orders Management + Status Transitions + Stock Deduction + Sales Recording
  app.get('/api/admin/orders', requireAdmin, async (_req, res) => {
    try {
      const allOrders = await db.select().from(orders).orderBy(desc(orders.createdAt));
      const allItems = await db.select().from(orderItems);
      const allHistory = await db
        .select()
        .from(orderStatusHistory)
        .orderBy(desc(orderStatusHistory.createdAt));

      const itemsByOrder = new Map<number, typeof allItems>();
      for (const item of allItems) {
        const list = itemsByOrder.get(item.orderId) || [];
        list.push(item);
        itemsByOrder.set(item.orderId, list);
      }

      const historyByOrder = new Map<number, typeof allHistory>();
      for (const h of allHistory) {
        const list = historyByOrder.get(h.orderId) || [];
        list.push(h);
        historyByOrder.set(h.orderId, list);
      }

      // Compute per-phone reliability stats (inspired by Mystoq/Tassyir anti-return tracking)
      const phoneStats = new Map<string, { total: number; delivered: number; returned: number; cancelled: number }>();
      for (const o of allOrders) {
        const key = normalizeAlgerianPhone(o.phone);
        const st = phoneStats.get(key) || { total: 0, delivered: 0, returned: 0, cancelled: 0 };
        st.total += 1;
        if (o.status === 'livree') st.delivered += 1;
        if (o.status === 'retournee') st.returned += 1;
        if (o.status === 'annulee') st.cancelled += 1;
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
          cancelled: 0,
        },
      }));

      return res.json({ orders: enriched });
    } catch (error) {
      console.error('Admin orders list error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des commandes.' });
    }
  });

  app.patch('/api/admin/orders/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      const { status, trackingNumber, carrierId, adminNotes, paymentStatus, note } = req.body || {};
      const [existing] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!existing) return res.status(404).json({ error: 'Commande introuvable.' });

      const nextStatus = (status || existing.status) as OrderStatus;
      let nextCarrierName = existing.carrierName;
      let nextCarrierId = existing.carrierId;
      if (carrierId !== undefined) {
        if (carrierId === null || carrierId === '') {
          nextCarrierId = null;
          nextCarrierName = null;
        } else {
          const [c] = await db.select().from(carriers).where(eq(carriers.id, Number(carrierId)));
          if (c) {
            nextCarrierId = c.id;
            nextCarrierName = c.name;
          }
        }
      }

      let stockDeducted = existing.stockDeducted;
      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const actor = req.adminUser?.email || 'admin';

      // Deduct stock once when order enters confirmed/preparing/shipped/delivered
      if (!stockDeducted && shouldDeductStockOnStatus(nextStatus)) {
        for (const item of items) {
          if (item.productId && item.productType === 'physical') {
            const [prod] = await db.select().from(products).where(eq(products.id, item.productId));
            if (prod) {
              const newQty = Math.max(0, prod.stockQuantity - item.quantity);
              await db
                .update(products)
                .set({ stockQuantity: newQty, updatedAt: new Date() })
                .where(eq(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId,
                delta: -item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `Commande ${existing.reference} (${nextStatus})`,
                createdBy: actor,
              });
              await evaluateProductLowStock(prod.id);
            }
          }
        }
        stockDeducted = true;
      }

      // If cancelled after stock was deducted -> restore stock
      if (stockDeducted && nextStatus === 'annulee' && existing.status !== 'annulee') {
        for (const item of items) {
          if (item.productId && item.productType === 'physical') {
            const [prod] = await db.select().from(products).where(eq(products.id, item.productId));
            if (prod) {
              const newQty = prod.stockQuantity + item.quantity;
              await db
                .update(products)
                .set({ stockQuantity: newQty, updatedAt: new Date() })
                .where(eq(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId,
                delta: item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `Annulation commande ${existing.reference}`,
                createdBy: actor,
              });
              await evaluateProductLowStock(prod.id);
            }
          }
        }
        stockDeducted = false;
      }

      const nextPaymentStatus =
        paymentStatus || (nextStatus === 'livree' ? 'paid' : existing.paymentStatus);

      const [updated] = await db
        .update(orders)
        .set({
          status: nextStatus,
          trackingNumber: trackingNumber !== undefined ? trackingNumber : existing.trackingNumber,
          carrierId: nextCarrierId,
          carrierName: nextCarrierName,
          adminNotes: adminNotes !== undefined ? adminNotes : existing.adminNotes,
          paymentStatus: nextPaymentStatus,
          stockDeducted,
          updatedAt: new Date(),
        })
        .where(eq(orders.id, orderId))
        .returning();

      if (nextStatus !== existing.status) {
        await db.insert(orderStatusHistory).values({
          orderId,
          fromStatus: existing.status,
          toStatus: nextStatus,
          note: note || `Statut modifié vers ${nextStatus}`,
          changedBy: actor,
        });
      }

      // Record real sale when delivered
      if (nextStatus === 'livree') {
        const cogs = items.reduce((acc, i) => acc + i.costPriceDzd * i.quantity, 0);
        const estimatedMargin = Math.max(0, existing.subtotalDzd - existing.discountDzd - cogs);
        await db
          .insert(sales)
          .values({
            orderId: existing.id,
            orderReference: existing.reference,
            customerName: `${existing.firstName} ${existing.lastName}`,
            wilayaName: existing.wilayaName,
            itemsRevenueDzd: existing.subtotalDzd,
            discountDzd: existing.discountDzd,
            shippingFeeDzd: existing.shippingFeeDzd,
            costOfGoodsDzd: cogs,
            totalCollectedDzd: existing.totalDzd,
            estimatedMarginDzd: estimatedMargin,
          })
          .onConflictDoNothing({ target: sales.orderId });
      }

      // Create return record when marked returned
      if (nextStatus === 'retournee' && existing.status !== 'retournee') {
        const existingReturn = await db.select().from(returns).where(eq(returns.orderId, orderId));
        if (existingReturn.length === 0) {
          await db.insert(returns).values({
            orderId,
            orderReference: existing.reference,
            customerName: `${existing.firstName} ${existing.lastName}`,
            phone: existing.phone,
            wilayaName: existing.wilayaName,
            reason: note || 'Colis retourné par transporteur',
            condition: 'intact',
            restocked: false,
            returnFeeDzd: 0,
            status: 'en_cours',
          });
        }
      }

      return res.json({ order: updated });
    } catch (error) {
      console.error('Update order error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour de la commande.' });
    }
  });

  app.delete('/api/admin/orders/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const orderId = Number(req.params.id);
      if (!Number.isInteger(orderId)) {
        return res.status(400).json({ error: 'Identifiant de commande invalide.' });
      }

      const [existing] = await db.select().from(orders).where(eq(orders.id, orderId));
      if (!existing) {
        return res.status(404).json({ error: 'Commande introuvable.' });
      }

      const items = await db.select().from(orderItems).where(eq(orderItems.orderId, orderId));
      const actor = req.adminUser?.email || 'admin';
      let restoredUnits = 0;

      // Restore stock automatically if stock had been deducted for this order
      if (existing.stockDeducted) {
        for (const item of items) {
          if (item.productId && item.productType === 'physical' && item.quantity > 0) {
            const [prod] = await db.select().from(products).where(eq(products.id, item.productId));
            if (prod) {
              const newQty = prod.stockQuantity + item.quantity;
              await db
                .update(products)
                .set({ stockQuantity: newQty, updatedAt: new Date() })
                .where(eq(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId: null,
                delta: item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `Restauration auto (suppression commande ${existing.reference})`,
                createdBy: actor,
              });
              await evaluateProductLowStock(prod.id);
              restoredUnits += item.quantity;
            }
          }
        }
      }

      // Preserve movement audit trail while detaching FK to deleted order
      await db.update(stockMovements).set({ orderId: null }).where(eq(stockMovements.orderId, orderId));
      await db.delete(sales).where(eq(sales.orderId, orderId));
      await db.delete(returns).where(eq(returns.orderId, orderId));
      await db.delete(digitalDeliveries).where(eq(digitalDeliveries.orderId, orderId));
      await db.delete(orderStatusHistory).where(eq(orderStatusHistory.orderId, orderId));
      await db.delete(orderItems).where(eq(orderItems.orderId, orderId));
      await db.delete(orders).where(eq(orders.id, orderId));

      return res.json({
        deleted: true,
        reference: existing.reference,
        stockWasDeducted: existing.stockDeducted,
        restoredUnits,
      });
    } catch (error) {
      console.error('Admin delete order error:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression de la commande.' });
    }
  });

  // 3. Sales Ledger
  app.get('/api/admin/sales', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(sales).orderBy(desc(sales.recordedAt));
      return res.json({ sales: list });
    } catch (error) {
      console.error('Admin sales error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des ventes.' });
    }
  });

  // 4. Categories CRUD
  app.get('/api/admin/categories', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(categories).orderBy(asc(categories.sortOrder), asc(categories.name));
      return res.json({ categories: list });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement catégories.' });
    }
  });

  app.post('/api/admin/categories', requireAdmin, async (req, res) => {
    try {
      const { name, categoryGroup, description, sortOrder, isActive } = req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Le nom de catégorie est obligatoire.' });
      }
      const slug = slugify(String(name));
      const [created] = await db
        .insert(categories)
        .values({
          name: String(name).trim(),
          slug,
          categoryGroup: categoryGroup || 'accessories',
          description: description || null,
          sortOrder: Number(sortOrder) || 0,
          isActive: isActive !== false,
        })
        .returning();
      return res.status(201).json({ category: created });
    } catch (error: any) {
      return res.status(400).json({ error: 'Impossible de créer cette catégorie (nom ou slug déjà existant).' });
    }
  });

  app.patch('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { name, categoryGroup, description, sortOrder, isActive } = req.body || {};
      const [existing] = await db.select().from(categories).where(eq(categories.id, id));
      if (!existing) return res.status(404).json({ error: 'Catégorie introuvable.' });

      const nextName = name ? String(name).trim() : existing.name;
      const [updated] = await db
        .update(categories)
        .set({
          name: nextName,
          slug: name ? slugify(nextName) : existing.slug,
          categoryGroup: categoryGroup || existing.categoryGroup,
          description: description !== undefined ? description : existing.description,
          sortOrder: sortOrder !== undefined ? Number(sortOrder) : existing.sortOrder,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
        })
        .where(eq(categories.id, id))
        .returning();
      return res.json({ category: updated });
    } catch (error) {
      return res.status(400).json({ error: 'Erreur lors de la mise à jour de la catégorie.' });
    }
  });

  app.delete('/api/admin/categories/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(categories).where(eq(categories.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression catégorie.' });
    }
  });

  // 5. Products CRUD + Direct Photo Upload + Low Stock Threshold
  app.get('/api/admin/products', requireAdmin, async (_req, res) => {
    try {
      const [settingsRow] = await db.select().from(storeSettings).limit(1);
      const globalThreshold = settingsRow?.defaultLowStockThreshold ?? 10;
      const allCats = await db.select().from(categories);
      const catMap = new Map(allCats.map((c) => [c.id, c]));

      const allProds = await db.select().from(products).orderBy(desc(products.createdAt));
      const allImgs = await db
        .select()
        .from(productImages)
        .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
      const imgMap = new Map<number, typeof allImgs>();
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
          categoryName: cat?.name || 'Non classé',
          categoryGroup: cat?.categoryGroup || 'accessories',
          images: imgs,
          primaryImage: imgs[0]?.url || null,
          hasPhotos: imgs.length > 0,
          effectiveLowStockThreshold: effectiveThreshold,
          isLowStock: p.productType === 'physical' && p.stockQuantity <= effectiveThreshold,
        };
      });

      return res.json({ products: enriched, globalLowStockThreshold: globalThreshold });
    } catch (error) {
      console.error('Admin products error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des produits.' });
    }
  });

  app.post('/api/admin/products', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const b = req.body || {};
      if (!b.name || !String(b.name).trim()) {
        return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
      }
      const cleanName = String(b.name).trim();
      const baseSlug = slugify(cleanName);
      const uniqueSuffix = Date.now().toString(36).slice(-4);
      const sku = String(b.sku || `2FP-${uniqueSuffix.toUpperCase()}`).trim();
      const slug = `${baseSlug}-${uniqueSuffix}`;

      const [created] = await db
        .insert(products)
        .values({
          categoryId: b.categoryId ? Number(b.categoryId) : null,
          sku,
          barcode: b.barcode ? String(b.barcode).trim() : null,
          name: cleanName,
          slug,
          brand: b.brand ? String(b.brand).trim() : null,
          shortDescription: b.shortDescription ? String(b.shortDescription).trim() : null,
          description: b.description ? String(b.description).trim() : '',
          productType: b.productType === 'digital' ? 'digital' : 'physical',
          priceDzd: Math.max(0, Math.round(Number(b.priceDzd) || 0)),
          compareAtPriceDzd: b.compareAtPriceDzd ? Math.round(Number(b.compareAtPriceDzd)) : null,
          costPriceDzd: Math.max(0, Math.round(Number(b.costPriceDzd) || 0)),
          stockQuantity: Math.max(0, Math.round(Number(b.stockQuantity) || 0)),
          lowStockThreshold:
            b.lowStockThreshold !== '' && b.lowStockThreshold !== null && b.lowStockThreshold !== undefined
              ? Math.max(0, Math.round(Number(b.lowStockThreshold)))
              : null,
          isFeatured: Boolean(b.isFeatured),
          isActive: b.isActive !== false,
          digitalAvailability: b.productType === 'digital' ? b.digitalAvailability || 'available' : null,
          digitalActivationTemplate: b.digitalActivationTemplate || null,
        })
        .returning();

      if (b.imageUrl && String(b.imageUrl).trim()) {
        await db.insert(productImages).values({
          productId: created.id,
          url: String(b.imageUrl).trim(),
          altText: created.name,
          sortOrder: 0,
          isPrimary: true,
        });
      }

      await evaluateProductLowStock(created.id);
      return res.status(201).json({ product: created });
    } catch (error: any) {
      console.error('Create product error:', error);
      return res.status(400).json({ error: 'Impossible de créer le produit (SKU déjà utilisé ou données invalides).' });
    }
  });

  app.patch('/api/admin/products/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(products).where(eq(products.id, id));
      if (!existing) return res.status(404).json({ error: 'Produit introuvable.' });

      const nextQty =
        b.stockQuantity !== undefined ? Math.max(0, Math.round(Number(b.stockQuantity))) : existing.stockQuantity;
      const nextThreshold =
        b.lowStockThreshold === '' || b.lowStockThreshold === null
          ? null
          : b.lowStockThreshold !== undefined
          ? Math.max(0, Math.round(Number(b.lowStockThreshold)))
          : existing.lowStockThreshold;

      const [updated] = await db
        .update(products)
        .set({
          categoryId: b.categoryId !== undefined ? (b.categoryId ? Number(b.categoryId) : null) : existing.categoryId,
          sku: b.sku ? String(b.sku).trim() : existing.sku,
          barcode: b.barcode !== undefined ? (b.barcode ? String(b.barcode).trim() : null) : existing.barcode,
          name: b.name ? String(b.name).trim() : existing.name,
          brand: b.brand !== undefined ? (b.brand ? String(b.brand).trim() : null) : existing.brand,
          shortDescription:
            b.shortDescription !== undefined ? b.shortDescription : existing.shortDescription,
          description: b.description !== undefined ? b.description : existing.description,
          productType: b.productType ? (b.productType === 'digital' ? 'digital' : 'physical') : existing.productType,
          priceDzd: b.priceDzd !== undefined ? Math.max(0, Math.round(Number(b.priceDzd))) : existing.priceDzd,
          compareAtPriceDzd:
            b.compareAtPriceDzd !== undefined
              ? b.compareAtPriceDzd
                ? Math.round(Number(b.compareAtPriceDzd))
                : null
              : existing.compareAtPriceDzd,
          costPriceDzd:
            b.costPriceDzd !== undefined ? Math.max(0, Math.round(Number(b.costPriceDzd))) : existing.costPriceDzd,
          stockQuantity: nextQty,
          lowStockThreshold: nextThreshold,
          isFeatured: b.isFeatured !== undefined ? Boolean(b.isFeatured) : existing.isFeatured,
          isActive: b.isActive !== undefined ? Boolean(b.isActive) : existing.isActive,
          digitalAvailability:
            b.digitalAvailability !== undefined ? b.digitalAvailability : existing.digitalAvailability,
          digitalActivationTemplate:
            b.digitalActivationTemplate !== undefined
              ? b.digitalActivationTemplate
              : existing.digitalActivationTemplate,
          updatedAt: new Date(),
        })
        .where(eq(products.id, id))
        .returning();

      if (nextQty !== existing.stockQuantity) {
        await db.insert(stockMovements).values({
          productId: id,
          delta: nextQty - existing.stockQuantity,
          previousQty: existing.stockQuantity,
          newQty: nextQty,
          reason: 'Modification fiche produit',
          createdBy: req.adminUser?.email || 'admin',
        });
      }

      await evaluateProductLowStock(id);
      return res.json({ product: updated });
    } catch (error) {
      console.error('Update product error:', error);
      return res.status(400).json({ error: 'Erreur lors de la mise à jour du produit.' });
    }
  });

  app.delete('/api/admin/products/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(products).where(eq(products.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression produit.' });
    }
  });

  // Upload platform logo OR product photo directly from admin panel
  app.post('/api/admin/media/upload', requireAdmin, upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Aucun fichier image reçu.' });
      }
      if (!file.mimetype.startsWith('image/')) {
        return res.status(400).json({ error: 'Seuls les fichiers image (PNG, JPG, WebP, SVG) sont acceptés.' });
      }
      if (file.size > 6 * 1024 * 1024) {
        return res.status(400).json({ error: 'Image trop lourde (maximum 6 Mo).' });
      }

      const kind = String(req.body.kind || 'product');
      const productId = req.body.productId ? Number(req.body.productId) : null;

      const [asset] = await db
        .insert(mediaAssets)
        .values({
          filename: file.originalname,
          mimeType: file.mimetype,
          dataBase64: file.buffer.toString('base64'),
          sizeBytes: file.size,
          kind,
        })
        .returning();

      const url = `/api/media/${asset.id}`;

      if (kind === 'logo') {
        const [settings] = await db.select().from(storeSettings).limit(1);
        if (settings) {
          await db
            .update(storeSettings)
            .set({ logoUrl: url, updatedAt: new Date() })
            .where(eq(storeSettings.id, settings.id));
        }
        return res.status(201).json({ url, assetId: asset.id, kind: 'logo' });
      }

      if (productId && Number.isInteger(productId)) {
        const existingImgs = await db
          .select()
          .from(productImages)
          .where(eq(productImages.productId, productId));
        const [img] = await db
          .insert(productImages)
          .values({
            productId,
            url,
            altText: file.originalname.replace(/\.[^.]+$/, ''),
            sortOrder: existingImgs.length,
            isPrimary: existingImgs.length === 0,
          })
          .returning();
        return res.status(201).json({ url, assetId: asset.id, image: img });
      }

      return res.status(201).json({ url, assetId: asset.id });
    } catch (error) {
      console.error('Media upload error:', error);
      return res.status(500).json({ error: 'Erreur lors du téléversement de l’image.' });
    }
  });

  app.post('/api/admin/products/:id/images', requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const { url, altText, isPrimary } = req.body || {};
      if (!url || !String(url).trim()) {
        return res.status(400).json({ error: 'URL image requise.' });
      }
      if (isPrimary) {
        await db.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
      }
      const existingImgs = await db.select().from(productImages).where(eq(productImages.productId, productId));
      const [img] = await db
        .insert(productImages)
        .values({
          productId,
          url: String(url).trim(),
          altText: String(altText || ''),
          sortOrder: existingImgs.length,
          isPrimary: Boolean(isPrimary) || existingImgs.length === 0,
        })
        .returning();
      return res.status(201).json({ image: img });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur ajout photo.' });
    }
  });

  app.patch('/api/admin/products/:id/images/:imageId/primary', requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      await db.update(productImages).set({ isPrimary: false }).where(eq(productImages.productId, productId));
      await db
        .update(productImages)
        .set({ isPrimary: true })
        .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
      return res.json({ updated: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur définition photo principale.' });
    }
  });

  app.delete('/api/admin/products/:id/images/:imageId', requireAdmin, async (req, res) => {
    try {
      const productId = Number(req.params.id);
      const imageId = Number(req.params.imageId);
      await db
        .delete(productImages)
        .where(and(eq(productImages.id, imageId), eq(productImages.productId, productId)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression photo.' });
    }
  });

  // 6. Stock Management, Alerts & Universal Stock Database Import Engine
  app.get('/api/admin/stock', requireAdmin, async (_req, res) => {
    try {
      await syncAllLowStockAlerts();
      const [settingsRow] = await db.select().from(storeSettings).limit(1);
      const globalThreshold = settingsRow?.defaultLowStockThreshold ?? 10;

      const movements = await db
        .select()
        .from(stockMovements)
        .orderBy(desc(stockMovements.createdAt))
        .limit(100);
      const alerts = await db
        .select()
        .from(stockAlerts)
        .orderBy(asc(stockAlerts.status), desc(stockAlerts.notifiedAt))
        .limit(100);
      const imports = await db
        .select()
        .from(stockImports)
        .orderBy(desc(stockImports.createdAt))
        .limit(30);
      const profiles = await db
        .select()
        .from(importMappingProfiles)
        .orderBy(desc(importMappingProfiles.updatedAt));

      return res.json({
        globalLowStockThreshold: globalThreshold,
        adminAlertEmail: settingsRow?.adminAlertEmail || 'badroumc@gmail.com',
        movements,
        alerts,
        imports,
        profiles,
      });
    } catch (error) {
      console.error('Admin stock error:', error);
      return res.status(500).json({ error: 'Erreur chargement des stocks.' });
    }
  });

  app.post('/api/admin/stock/adjust', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const { productId, delta, newQuantity, reason } = req.body || {};
      const [prod] = await db.select().from(products).where(eq(products.id, Number(productId)));
      if (!prod) return res.status(404).json({ error: 'Produit introuvable.' });

      const nextQty =
        newQuantity !== undefined && newQuantity !== ''
          ? Math.max(0, Math.round(Number(newQuantity)))
          : Math.max(0, prod.stockQuantity + Math.round(Number(delta) || 0));
      const actualDelta = nextQty - prod.stockQuantity;

      await db
        .update(products)
        .set({ stockQuantity: nextQty, updatedAt: new Date() })
        .where(eq(products.id, prod.id));

      await db.insert(stockMovements).values({
        productId: prod.id,
        delta: actualDelta,
        previousQty: prod.stockQuantity,
        newQty: nextQty,
        reason: String(reason || 'Ajustement manuel admin').trim(),
        createdBy: req.adminUser?.email || 'admin',
      });

      const alert = await evaluateProductLowStock(prod.id);
      return res.json({ productId: prod.id, previousQty: prod.stockQuantity, newQty: nextQty, alert });
    } catch (error) {
      console.error('Stock adjust error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’ajustement du stock.' });
    }
  });

  // Inline Stock Editor: update stockQuantity, costPriceDzd (prix d'achat), priceDzd (prix de vente), threshold & barcode
  app.patch('/api/admin/stock/product/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const productId = Number(req.params.id);
      if (!Number.isInteger(productId)) {
        return res.status(400).json({ error: 'Identifiant produit invalide.' });
      }
      const [prod] = await db.select().from(products).where(eq(products.id, productId));
      if (!prod) return res.status(404).json({ error: 'Produit introuvable.' });

      const b = req.body || {};
      const parseNonNegInt = (val: unknown, fallback: number): number => {
        if (val === undefined || val === null || val === '') return fallback;
        const n = Number(val);
        return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
      };
      const nextQty = parseNonNegInt(b.stockQuantity, prod.stockQuantity);
      const nextCost = parseNonNegInt(b.costPriceDzd, prod.costPriceDzd);
      const nextPrice = parseNonNegInt(b.priceDzd, prod.priceDzd);
      const nextThreshold =
        b.lowStockThreshold !== undefined
          ? b.lowStockThreshold === '' || b.lowStockThreshold === null
            ? null
            : parseNonNegInt(b.lowStockThreshold, prod.lowStockThreshold ?? 10)
          : prod.lowStockThreshold;
      const nextBarcode =
        b.barcode !== undefined
          ? b.barcode && String(b.barcode).trim()
            ? String(b.barcode).trim()
            : null
          : prod.barcode;

      const [updated] = await db
        .update(products)
        .set({
          stockQuantity: nextQty,
          costPriceDzd: nextCost,
          priceDzd: nextPrice,
          lowStockThreshold: nextThreshold,
          barcode: nextBarcode,
          updatedAt: new Date(),
        })
        .where(eq(products.id, productId))
        .returning();

      const actualDelta = nextQty - prod.stockQuantity;
      if (actualDelta !== 0) {
        await db.insert(stockMovements).values({
          productId: prod.id,
          delta: actualDelta,
          previousQty: prod.stockQuantity,
          newQty: nextQty,
          reason: String(b.reason || 'Modification directe gestion de stock').trim(),
          createdBy: req.adminUser?.email || 'admin',
        });
      }

      const alert = await evaluateProductLowStock(prod.id);
      return res.json({ product: updated, alert });
    } catch (error) {
      console.error('Inline stock update error:', error);
      return res.status(500).json({ error: 'Erreur lors de la mise à jour du stock et des prix.' });
    }
  });

  // Batch Inline Stock & Pricing Update
  app.patch('/api/admin/stock/batch', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const items = Array.isArray(req.body?.items) ? req.body.items : [];
      if (items.length === 0) {
        return res.status(400).json({ error: 'Aucune modification à enregistrer.' });
      }
      const parseNonNegInt = (val: unknown, fallback: number): number => {
        if (val === undefined || val === null || val === '') return fallback;
        const n = Number(val);
        return Number.isFinite(n) ? Math.max(0, Math.round(n)) : fallback;
      };

      let updatedCount = 0;
      for (const item of items) {
        const productId = Number(item?.productId);
        if (!Number.isInteger(productId)) continue;
        const [prod] = await db.select().from(products).where(eq(products.id, productId));
        if (!prod) continue;

        const nextQty = parseNonNegInt(item.stockQuantity, prod.stockQuantity);
        const nextCost = parseNonNegInt(item.costPriceDzd, prod.costPriceDzd);
        const nextPrice = parseNonNegInt(item.priceDzd, prod.priceDzd);

        await db
          .update(products)
          .set({
            stockQuantity: nextQty,
            costPriceDzd: nextCost,
            priceDzd: nextPrice,
            updatedAt: new Date(),
          })
          .where(eq(products.id, productId));

        const actualDelta = nextQty - prod.stockQuantity;
        if (actualDelta !== 0) {
          await db.insert(stockMovements).values({
            productId: prod.id,
            delta: actualDelta,
            previousQty: prod.stockQuantity,
            newQty: nextQty,
            reason: 'Mise à jour groupée gestion de stock',
            createdBy: req.adminUser?.email || 'admin',
          });
        }
        await evaluateProductLowStock(prod.id);
        updatedCount++;
      }

      return res.json({ updatedCount });
    } catch (error) {
      console.error('Batch stock update error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’enregistrement groupé du stock.' });
    }
  });

  // Preview universal stock database file (Excel, CSV, TSV, JSON, XML, SQLite, SQL)
  app.post('/api/admin/stock/import/preview', requireAdmin, upload.single('file'), async (req, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Veuillez sélectionner un fichier de base de stock.' });
      }
      const preferredTable = req.body.tableName ? String(req.body.tableName) : undefined;
      const syncMode = (req.body.syncMode || 'add_only') as StockSyncMode;
      const customMapping: ColumnMapping | null = req.body.mappingJson
        ? JSON.parse(String(req.body.mappingJson))
        : null;

      const parsed = await parseStockDatabaseBuffer(file.buffer, file.originalname, preferredTable);
      const selectedTableObj =
        parsed.tables.find((t) => t.tableName === parsed.selectedTable) || parsed.tables[0];
      const activeMapping = customMapping?.name ? customMapping : parsed.suggestedMapping;

      const existing = await db
        .select({
          id: products.id,
          sku: products.sku,
          barcode: products.barcode,
          externalRef: products.externalRef,
          name: products.name,
          priceDzd: products.priceDzd,
          costPriceDzd: products.costPriceDzd,
          stockQuantity: products.stockQuantity,
        })
        .from(products);

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
            newPrice: u.incoming.priceDzd,
          })),
          sampleSkipped: diff.skipped.slice(0, 10),
          sampleErrors: diff.errors.slice(0, 10),
        },
      });
    } catch (error: any) {
      console.error('Import preview error:', error);
      return res.status(400).json({ error: error?.message || 'Impossible de lire ce fichier.' });
    }
  });

  // Commit universal stock database import with differential sync
  app.post('/api/admin/stock/import/commit', requireAdmin, upload.single('file'), async (req: AuthRequest, res) => {
    try {
      const file = req.file;
      if (!file) {
        return res.status(400).json({ error: 'Fichier manquant.' });
      }
      const preferredTable = req.body.tableName ? String(req.body.tableName) : undefined;
      const syncMode = (req.body.syncMode || 'add_only') as StockSyncMode;
      const mapping: ColumnMapping = req.body.mappingJson
        ? JSON.parse(String(req.body.mappingJson))
        : { name: '' };
      const defaultCategoryId = req.body.defaultCategoryId ? Number(req.body.defaultCategoryId) : null;
      const saveProfileName = req.body.saveProfileName ? String(req.body.saveProfileName).trim() : '';

      const parsed = await parseStockDatabaseBuffer(file.buffer, file.originalname, preferredTable);
      const selectedTableObj =
        parsed.tables.find((t) => t.tableName === parsed.selectedTable) || parsed.tables[0];
      const activeMapping = mapping.name ? mapping : parsed.suggestedMapping;

      const existing = await db
        .select({
          id: products.id,
          sku: products.sku,
          barcode: products.barcode,
          externalRef: products.externalRef,
          name: products.name,
          priceDzd: products.priceDzd,
          costPriceDzd: products.costPriceDzd,
          stockQuantity: products.stockQuantity,
        })
        .from(products);

      const diff = buildDifferentialSyncPlan(selectedTableObj.rows, activeMapping, existing, syncMode);

      const allCats = await db.select().from(categories);
      const catByNormName = new Map(allCats.map((c) => [slugify(c.name), c.id]));

      const [importRecord] = await db
        .insert(stockImports)
        .values({
          fileName: file.originalname,
          fileFormat: parsed.format,
          sourceTableOrSheet: parsed.selectedTable,
          syncMode,
          totalRows: selectedTableObj.rows.length,
          addedCount: 0,
          updatedCount: 0,
          skippedCount: diff.skipped.length,
          errorCount: diff.errors.length,
          importedBy: req.adminUser?.email || 'admin',
        })
        .returning();

      let addedCount = 0;
      let updatedCount = 0;
      const addedProductIds: number[] = [];

      // 1. Add ONLY new articles
      for (const item of diff.toAdd) {
        let resolvedCatId = defaultCategoryId;
        if (item.categoryName) {
          const catSlug = slugify(item.categoryName);
          if (catByNormName.has(catSlug)) {
            resolvedCatId = catByNormName.get(catSlug)!;
          } else {
            const [newCat] = await db
              .insert(categories)
              .values({
                name: item.categoryName,
                slug: `${catSlug}-${Date.now().toString(36).slice(-3)}`,
                categoryGroup: item.productType === 'digital' ? 'digital' : 'accessories',
                sortOrder: 99,
                isActive: true,
              })
              .onConflictDoNothing()
              .returning();
            if (newCat) {
              catByNormName.set(catSlug, newCat.id);
              resolvedCatId = newCat.id;
            }
          }
        }

        const uniqueSlug = `${slugify(item.name)}-${Date.now().toString(36).slice(-4)}-${item.rowIndex}`;
        const safeSku = `${item.sku}`;
        const [inserted] = await db
          .insert(products)
          .values({
            categoryId: resolvedCatId,
            sku: safeSku,
            barcode: item.barcode,
            externalRef: item.externalRef,
            name: item.name,
            slug: uniqueSlug,
            brand: item.brand,
            shortDescription: item.description ? item.description.slice(0, 160) : null,
            description: item.description || '',
            productType: item.productType,
            priceDzd: item.priceDzd,
            costPriceDzd: item.costPriceDzd,
            stockQuantity: item.stockQuantity,
            lowStockThreshold: item.lowStockThreshold,
            isFeatured: false,
            isActive: true,
          })
          .onConflictDoNothing()
          .returning();

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
            createdBy: req.adminUser?.email || 'admin',
          });
          await evaluateProductLowStock(inserted.id);
        }
      }

      // 2. Update existing articles if mode is add_and_update_stock or full_sync (ALWAYS preserving photos!)
      for (const entry of diff.toUpdate) {
        const updateData: Record<string, unknown> = {
          stockQuantity: entry.incoming.stockQuantity,
          updatedAt: new Date(),
        };
        if (syncMode === 'full_sync') {
          if (entry.incoming.priceDzd > 0) updateData.priceDzd = entry.incoming.priceDzd;
          if (entry.incoming.costPriceDzd > 0) updateData.costPriceDzd = entry.incoming.costPriceDzd;
          if (entry.incoming.brand) updateData.brand = entry.incoming.brand;
          if (entry.incoming.description) updateData.description = entry.incoming.description;
        }
        await db.update(products).set(updateData).where(eq(products.id, entry.existing.id));
        if (entry.stockDelta !== 0) {
          await db.insert(stockMovements).values({
            productId: entry.existing.id,
            importId: importRecord.id,
            delta: entry.stockDelta,
            previousQty: entry.existing.stockQuantity,
            newQty: entry.incoming.stockQuantity,
            reason: `Synchro fichier stock (${file.originalname})`,
            createdBy: req.adminUser?.email || 'admin',
          });
        }
        await evaluateProductLowStock(entry.existing.id);
        updatedCount += 1;
      }

      // 3. Save mapping profile if requested
      if (saveProfileName) {
        await db
          .insert(importMappingProfiles)
          .values({
            profileName: saveProfileName,
            sourceFormat: parsed.format,
            tableOrSheetName: parsed.selectedTable,
            columnMappingJson: JSON.stringify(activeMapping),
            defaultSyncMode: syncMode,
            updatedAt: new Date(),
          })
          .onConflictDoUpdate({
            target: importMappingProfiles.profileName,
            set: {
              sourceFormat: parsed.format,
              tableOrSheetName: parsed.selectedTable,
              columnMappingJson: JSON.stringify(activeMapping),
              defaultSyncMode: syncMode,
              updatedAt: new Date(),
            },
          });
      }

      const [finalImport] = await db
        .update(stockImports)
        .set({
          addedCount,
          updatedCount,
          summaryJson: JSON.stringify({ addedProductIds }),
        })
        .where(eq(stockImports.id, importRecord.id))
        .returning();

      return res.status(201).json({
        importRecord: finalImport,
        addedProductIds,
      });
    } catch (error: any) {
      console.error('Import commit error:', error);
      return res.status(500).json({ error: error?.message || 'Erreur lors de l’importation du stock.' });
    }
  });

  // 7. Customers Management
  app.get('/api/admin/customers', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(customers).orderBy(desc(customers.updatedAt));
      const allOrders = await db.select().from(orders);

      const statsByCustomer = new Map<
        number,
        { ordersCount: number; deliveredCount: number; returnedCount: number; totalSpentDzd: number }
      >();
      for (const o of allOrders) {
        if (!o.customerId) continue;
        const st = statsByCustomer.get(o.customerId) || {
          ordersCount: 0,
          deliveredCount: 0,
          returnedCount: 0,
          totalSpentDzd: 0,
        };
        st.ordersCount += 1;
        if (o.status === 'livree') {
          st.deliveredCount += 1;
          st.totalSpentDzd += o.totalDzd;
        }
        if (o.status === 'retournee') st.returnedCount += 1;
        statsByCustomer.set(o.customerId, st);
      }

      return res.json({
        customers: list.map((c) => ({
          ...c,
          ...(statsByCustomer.get(c.id) || {
            ordersCount: 0,
            deliveredCount: 0,
            returnedCount: 0,
            totalSpentDzd: 0,
          }),
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement clients.' });
    }
  });

  app.patch('/api/admin/customers/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { isBlocked, notes } = req.body || {};
      const [existing] = await db.select().from(customers).where(eq(customers.id, id));
      if (!existing) return res.status(404).json({ error: 'Client introuvable.' });
      const [updated] = await db
        .update(customers)
        .set({
          isBlocked: isBlocked !== undefined ? Boolean(isBlocked) : existing.isBlocked,
          notes: notes !== undefined ? String(notes) : existing.notes,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, id))
        .returning();
      return res.json({ customer: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur mise à jour client.' });
    }
  });

  // 8. Customer Reviews Moderation
  app.get('/api/admin/reviews', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(productReviews).orderBy(desc(productReviews.createdAt));
      const allProds = await db.select({ id: products.id, name: products.name, slug: products.slug }).from(products);
      const prodMap = new Map(allProds.map((p) => [p.id, p]));
      return res.json({
        reviews: list.map((r) => ({
          ...r,
          productName: prodMap.get(r.productId)?.name || 'Produit supprimé',
          productSlug: prodMap.get(r.productId)?.slug || '',
        })),
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement des avis.' });
    }
  });

  app.patch('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { status, adminReply } = req.body || {};
      const [existing] = await db.select().from(productReviews).where(eq(productReviews.id, id));
      if (!existing) return res.status(404).json({ error: 'Avis introuvable.' });
      const [updated] = await db
        .update(productReviews)
        .set({
          status: status || existing.status,
          adminReply: adminReply !== undefined ? String(adminReply) : existing.adminReply,
          moderatedAt: new Date(),
        })
        .where(eq(productReviews.id, id))
        .returning();
      return res.json({ review: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur modération avis.' });
    }
  });

  app.delete('/api/admin/reviews/:id', requireAdmin, async (req, res) => {
    try {
      await db.delete(productReviews).where(eq(productReviews.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression avis.' });
    }
  });

  // 9. Carriers & Algerian Shipping Rates (58 wilayas)
  app.get('/api/admin/carriers', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(carriers).orderBy(asc(carriers.id));
      return res.json({ carriers: list });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement transporteurs.' });
    }
  });

  app.post('/api/admin/carriers', requireAdmin, async (req, res) => {
    try {
      const { name, code, supportsHome, supportsStopDesk, apiProvider, apiEndpoint, notes, isActive, seedDefaultRates } =
        req.body || {};
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: 'Nom du transporteur requis.' });
      }
      const cleanCode = String(code || slugify(name).toUpperCase().replace(/-/g, '_')).trim();
      const [created] = await db
        .insert(carriers)
        .values({
          name: String(name).trim(),
          code: cleanCode,
          supportsHome: supportsHome !== false,
          supportsStopDesk: supportsStopDesk !== false,
          apiProvider: apiProvider || 'manual',
          apiEndpoint: apiEndpoint || null,
          apiConfigured: false, // Never simulate unconfigured external APIs
          notes: notes || null,
          isActive: isActive !== false,
        })
        .returning();

      if (seedDefaultRates !== false) {
        await db.insert(shippingRates).values(
          ALGERIA_WILAYAS.map((w) => ({
            carrierId: created.id,
            wilayaCode: w.code,
            wilayaName: w.name,
            homePriceDzd: 0,
            stopDeskPriceDzd: 0,
            estimatedDays: '24-48h',
            isActive: true,
          })),
        );
      }

      return res.status(201).json({ carrier: created });
    } catch (error) {
      return res.status(400).json({ error: 'Impossible d’ajouter ce transporteur (code déjà existant).' });
    }
  });

  app.patch('/api/admin/carriers/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(carriers).where(eq(carriers.id, id));
      if (!existing) return res.status(404).json({ error: 'Transporteur introuvable.' });
      const [updated] = await db
        .update(carriers)
        .set({
          name: b.name ?? existing.name,
          supportsHome: b.supportsHome !== undefined ? Boolean(b.supportsHome) : existing.supportsHome,
          supportsStopDesk:
            b.supportsStopDesk !== undefined ? Boolean(b.supportsStopDesk) : existing.supportsStopDesk,
          apiProvider: b.apiProvider ?? existing.apiProvider,
          apiEndpoint: b.apiEndpoint !== undefined ? b.apiEndpoint : existing.apiEndpoint,
          notes: b.notes !== undefined ? b.notes : existing.notes,
          isActive: b.isActive !== undefined ? Boolean(b.isActive) : existing.isActive,
        })
        .where(eq(carriers.id, id))
        .returning();
      return res.json({ carrier: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur mise à jour transporteur.' });
    }
  });

  app.delete('/api/admin/carriers/:id', requireAdmin, async (req, res) => {
    try {
      await db.delete(carriers).where(eq(carriers.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression transporteur.' });
    }
  });

  app.get('/api/admin/shipping-rates', requireAdmin, async (req, res) => {
    try {
      const carrierId = req.query.carrierId ? Number(req.query.carrierId) : null;
      const list = carrierId
        ? await db
            .select()
            .from(shippingRates)
            .where(eq(shippingRates.carrierId, carrierId))
            .orderBy(asc(shippingRates.wilayaCode))
        : await db.select().from(shippingRates).orderBy(asc(shippingRates.carrierId), asc(shippingRates.wilayaCode));
      return res.json({ shippingRates: list });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement tarifs.' });
    }
  });

  app.patch('/api/admin/shipping-rates/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { homePriceDzd, stopDeskPriceDzd, estimatedDays, isActive } = req.body || {};
      const [existing] = await db.select().from(shippingRates).where(eq(shippingRates.id, id));
      if (!existing) return res.status(404).json({ error: 'Tarif introuvable.' });
      const [updated] = await db
        .update(shippingRates)
        .set({
          homePriceDzd:
            homePriceDzd !== undefined ? Math.max(0, Math.round(Number(homePriceDzd))) : existing.homePriceDzd,
          stopDeskPriceDzd:
            stopDeskPriceDzd !== undefined
              ? Math.max(0, Math.round(Number(stopDeskPriceDzd)))
              : existing.stopDeskPriceDzd,
          estimatedDays: estimatedDays !== undefined ? String(estimatedDays) : existing.estimatedDays,
          isActive: isActive !== undefined ? Boolean(isActive) : existing.isActive,
          updatedAt: new Date(),
        })
        .where(eq(shippingRates.id, id))
        .returning();
      return res.json({ rate: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur mise à jour tarif.' });
    }
  });

  // 10. Returns (RMA)
  app.get('/api/admin/returns', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(returns).orderBy(desc(returns.createdAt));
      return res.json({ returns: list });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement des retours.' });
    }
  });

  app.patch('/api/admin/returns/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { status, condition, reason, returnFeeDzd, restockNow, notes } = req.body || {};
      const [existing] = await db.select().from(returns).where(eq(returns.id, id));
      if (!existing) return res.status(404).json({ error: 'Retour introuvable.' });

      let restocked = existing.restocked;
      if (restockNow && !existing.restocked) {
        const items = await db.select().from(orderItems).where(eq(orderItems.orderId, existing.orderId));
        for (const item of items) {
          if (item.productId && item.productType === 'physical') {
            const [prod] = await db.select().from(products).where(eq(products.id, item.productId));
            if (prod) {
              const newQty = prod.stockQuantity + item.quantity;
              await db
                .update(products)
                .set({ stockQuantity: newQty, updatedAt: new Date() })
                .where(eq(products.id, prod.id));
              await db.insert(stockMovements).values({
                productId: prod.id,
                orderId: existing.orderId,
                delta: item.quantity,
                previousQty: prod.stockQuantity,
                newQty,
                reason: `Réintégration retour ${existing.orderReference}`,
                createdBy: req.adminUser?.email || 'admin',
              });
              await evaluateProductLowStock(prod.id);
            }
          }
        }
        restocked = true;
      }

      const [updated] = await db
        .update(returns)
        .set({
          status: restockNow ? 'reintegre' : status || existing.status,
          condition: condition || existing.condition,
          reason: reason !== undefined ? String(reason) : existing.reason,
          returnFeeDzd:
            returnFeeDzd !== undefined ? Math.max(0, Math.round(Number(returnFeeDzd))) : existing.returnFeeDzd,
          restocked,
          notes: notes !== undefined ? String(notes) : existing.notes,
        })
        .where(eq(returns.id, id))
        .returning();

      return res.json({ returnItem: updated });
    } catch (error) {
      console.error('Return update error:', error);
      return res.status(500).json({ error: 'Erreur mise à jour retour.' });
    }
  });

  // 11. Promotions CRUD
  app.get('/api/admin/promotions', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(promotions).orderBy(desc(promotions.createdAt));
      return res.json({ promotions: list });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement promotions.' });
    }
  });

  app.post('/api/admin/promotions', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      if (!b.code || !String(b.code).trim()) {
        return res.status(400).json({ error: 'Code promo requis.' });
      }
      const [created] = await db
        .insert(promotions)
        .values({
          code: String(b.code).trim().toUpperCase(),
          description: String(b.description || ''),
          discountType: b.discountType || 'percent',
          discountValue: Math.max(0, Math.round(Number(b.discountValue) || 0)),
          minOrderDzd: Math.max(0, Math.round(Number(b.minOrderDzd) || 0)),
          maxUses: b.maxUses ? Math.round(Number(b.maxUses)) : null,
          endsAt: b.endsAt ? new Date(b.endsAt) : null,
          isActive: b.isActive !== false,
        })
        .returning();
      return res.status(201).json({ promotion: created });
    } catch (error) {
      return res.status(400).json({ error: 'Code promo déjà existant ou invalide.' });
    }
  });

  app.patch('/api/admin/promotions/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(promotions).where(eq(promotions.id, id));
      if (!existing) return res.status(404).json({ error: 'Promotion introuvable.' });
      const [updated] = await db
        .update(promotions)
        .set({
          description: b.description ?? existing.description,
          discountType: b.discountType ?? existing.discountType,
          discountValue:
            b.discountValue !== undefined ? Math.max(0, Math.round(Number(b.discountValue))) : existing.discountValue,
          minOrderDzd:
            b.minOrderDzd !== undefined ? Math.max(0, Math.round(Number(b.minOrderDzd))) : existing.minOrderDzd,
          isActive: b.isActive !== undefined ? Boolean(b.isActive) : existing.isActive,
        })
        .where(eq(promotions.id, id))
        .returning();
      return res.json({ promotion: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur mise à jour promotion.' });
    }
  });

  app.delete('/api/admin/promotions/:id', requireAdmin, async (req, res) => {
    try {
      await db.delete(promotions).where(eq(promotions.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression promotion.' });
    }
  });

  // 12. Digital Products & Protected Deliveries
  app.get('/api/admin/digital-deliveries', requireAdmin, async (_req, res) => {
    try {
      const deliveries = await db
        .select()
        .from(digitalDeliveries)
        .orderBy(desc(digitalDeliveries.createdAt));
      const allOrders = await db.select().from(orders);
      const orderMap = new Map(allOrders.map((o) => [o.id, o]));

      return res.json({
        deliveries: deliveries.map((d) => {
          const ord = orderMap.get(d.orderId);
          return {
            ...d,
            orderReference: ord?.reference || '',
            customerName: ord ? `${ord.firstName} ${ord.lastName}` : '',
            customerPhone: ord?.phone || '',
            orderStatus: ord?.status || '',
            paymentStatus: ord?.paymentStatus || 'pending',
          };
        }),
      });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement livraisons numériques.' });
    }
  });

  app.patch('/api/admin/digital-deliveries/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      const { deliveryStatus, activationInstructions, privateFulfillmentNote } = req.body || {};
      const [existing] = await db.select().from(digitalDeliveries).where(eq(digitalDeliveries.id, id));
      if (!existing) return res.status(404).json({ error: 'Livraison numérique introuvable.' });

      const nextStatus = deliveryStatus || existing.deliveryStatus;
      const [updated] = await db
        .update(digitalDeliveries)
        .set({
          deliveryStatus: nextStatus,
          activationInstructions:
            activationInstructions !== undefined
              ? String(activationInstructions)
              : existing.activationInstructions,
          privateFulfillmentNote:
            privateFulfillmentNote !== undefined
              ? String(privateFulfillmentNote)
              : existing.privateFulfillmentNote,
          deliveredBy: nextStatus === 'delivered' ? req.adminUser?.email || 'admin' : existing.deliveredBy,
          deliveredAt: nextStatus === 'delivered' ? new Date() : existing.deliveredAt,
        })
        .where(eq(digitalDeliveries.id, id))
        .returning();

      // If marked delivered, mark order paymentStatus paid
      if (nextStatus === 'delivered') {
        await db
          .update(orders)
          .set({ paymentStatus: 'paid', updatedAt: new Date() })
          .where(eq(orders.id, existing.orderId));
      }

      return res.json({ delivery: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur mise à jour livraison numérique.' });
    }
  });

  // 13. Social Links Management
  app.get('/api/admin/social-links', requireAdmin, async (_req, res) => {
    try {
      const list = await db.select().from(socialLinks).orderBy(asc(socialLinks.sortOrder));
      return res.json({ socialLinks: list });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement réseaux sociaux.' });
    }
  });

  app.post('/api/admin/social-links', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const [created] = await db
        .insert(socialLinks)
        .values({
          platform: String(b.platform || 'instagram'),
          label: String(b.label || 'Réseau social'),
          urlOrHandle: String(b.urlOrHandle || ''),
          pixelId: b.pixelId ? String(b.pixelId).trim() : null,
          isActive: b.isActive !== false,
          sortOrder: Number(b.sortOrder) || 0,
        })
        .returning();
      return res.status(201).json({ socialLink: created });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur création lien social.' });
    }
  });

  app.patch('/api/admin/social-links/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const b = req.body || {};
      const [existing] = await db.select().from(socialLinks).where(eq(socialLinks.id, id));
      if (!existing) return res.status(404).json({ error: 'Lien introuvable.' });
      const [updated] = await db
        .update(socialLinks)
        .set({
          platform: b.platform !== undefined ? String(b.platform).trim() : existing.platform,
          label: b.label !== undefined ? String(b.label).trim() : existing.label,
          urlOrHandle: b.urlOrHandle !== undefined ? String(b.urlOrHandle).trim() : existing.urlOrHandle,
          pixelId:
            b.pixelId !== undefined
              ? b.pixelId && String(b.pixelId).trim()
                ? String(b.pixelId).trim()
                : null
              : existing.pixelId,
          isActive: b.isActive !== undefined ? Boolean(b.isActive) : existing.isActive,
        })
        .where(eq(socialLinks.id, id))
        .returning();
      return res.json({ socialLink: updated });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur mise à jour lien social.' });
    }
  });

  app.delete('/api/admin/social-links/:id', requireAdmin, async (req, res) => {
    try {
      await db.delete(socialLinks).where(eq(socialLinks.id, Number(req.params.id)));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression lien social.' });
    }
  });

  // 14. General Settings (Platform Logo, Global Low Stock Threshold, Admin Email, WhatsApp)
  app.get('/api/admin/settings', requireAdmin, async (_req, res) => {
    try {
      const [settings] = await db.select().from(storeSettings).limit(1);
      const emailProviderConfigured = Boolean(
        process.env.RESEND_API_KEY || (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS),
      );
      return res.json({ settings, emailProviderConfigured });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur chargement paramètres.' });
    }
  });

  app.patch('/api/admin/settings', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const [existing] = await db.select().from(storeSettings).limit(1);
      if (!existing) return res.status(404).json({ error: 'Paramètres introuvables.' });

      const nextThreshold =
        b.defaultLowStockThreshold !== undefined
          ? Math.max(0, Math.round(Number(b.defaultLowStockThreshold)))
          : existing.defaultLowStockThreshold;

      const [updated] = await db
        .update(storeSettings)
        .set({
          storeName: b.storeName !== undefined ? String(b.storeName).trim() : existing.storeName,
          tagline: b.tagline !== undefined ? String(b.tagline).trim() : existing.tagline,
          logoUrl: b.logoUrl !== undefined ? b.logoUrl : existing.logoUrl,
          whatsappPhone: b.whatsappPhone !== undefined ? String(b.whatsappPhone).trim() : existing.whatsappPhone,
          supportEmail: b.supportEmail !== undefined ? String(b.supportEmail).trim() : existing.supportEmail,
          adminAlertEmail:
            b.adminAlertEmail !== undefined ? String(b.adminAlertEmail).trim() : existing.adminAlertEmail,
          defaultLowStockThreshold: nextThreshold,
          storeAddress: b.storeAddress !== undefined ? String(b.storeAddress).trim() : existing.storeAddress,
          codEnabled: b.codEnabled !== undefined ? Boolean(b.codEnabled) : existing.codEnabled,
          digitalOrderNote:
            b.digitalOrderNote !== undefined ? String(b.digitalOrderNote).trim() : existing.digitalOrderNote,
          updatedAt: new Date(),
        })
        .where(eq(storeSettings.id, existing.id))
        .returning();

      if (nextThreshold !== existing.defaultLowStockThreshold) {
        await syncAllLowStockAlerts();
      }

      return res.json({ settings: updated });
    } catch (error) {
      console.error('Update settings error:', error);
      return res.status(500).json({ error: 'Erreur enregistrement paramètres.' });
    }
  });

  // 15. Authorized Admin Accounts Management (multi-admin Google Auth access)
  app.get('/api/admin/admins', requireAdmin, async (_req, res) => {
    try {
      const admins = await db.select().from(adminUsers).orderBy(asc(adminUsers.id));
      return res.json({ admins });
    } catch (error) {
      console.error('List admins error:', error);
      return res.status(500).json({ error: 'Erreur chargement des administrateurs.' });
    }
  });

  app.post('/api/admin/admins', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const email = String(b.email || '').trim().toLowerCase();
      const fullName = String(b.fullName || '').trim() || 'Co-gérant 2Frères Phone';
      const role = b.role === 'super_admin' ? 'super_admin' : 'admin';

      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ error: 'Veuillez saisir une adresse e-mail Google valide.' });
      }

      const [existing] = await db.select().from(adminUsers).where(eq(adminUsers.email, email));
      if (existing) {
        const [updated] = await db
          .update(adminUsers)
          .set({ fullName, role, isActive: true })
          .where(eq(adminUsers.id, existing.id))
          .returning();
        return res.json({ admin: updated });
      }

      const [created] = await db
        .insert(adminUsers)
        .values({
          email,
          fullName,
          role,
          isActive: true,
        })
        .returning();

      return res.status(201).json({ admin: created });
    } catch (error) {
      console.error('Create admin error:', error);
      return res.status(500).json({ error: 'Erreur lors de l’ajout de l’administrateur.' });
    }
  });

  app.patch('/api/admin/admins/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID invalide.' });
      const b = req.body || {};

      const [target] = await db.select().from(adminUsers).where(eq(adminUsers.id, id));
      if (!target) return res.status(404).json({ error: 'Administrateur introuvable.' });

      if (req.adminUser?.id === id && b.isActive === false) {
        return res.status(400).json({ error: 'Vous ne pouvez pas désactiver votre propre compte administrateur.' });
      }

      const [updated] = await db
        .update(adminUsers)
        .set({
          fullName: b.fullName !== undefined ? String(b.fullName).trim() : target.fullName,
          role: b.role === 'super_admin' || b.role === 'admin' ? b.role : target.role,
          isActive: b.isActive !== undefined ? Boolean(b.isActive) : target.isActive,
        })
        .where(eq(adminUsers.id, id))
        .returning();

      return res.json({ admin: updated });
    } catch (error) {
      console.error('Update admin error:', error);
      return res.status(500).json({ error: 'Erreur mise à jour administrateur.' });
    }
  });

  app.delete('/api/admin/admins/:id', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isInteger(id)) return res.status(400).json({ error: 'ID invalide.' });

      if (req.adminUser?.id === id) {
        return res.status(400).json({ error: 'Vous ne pouvez pas supprimer votre propre compte administrateur.' });
      }

      await db.delete(adminUsers).where(eq(adminUsers.id, id));
      return res.json({ ok: true });
    } catch (error) {
      console.error('Delete admin error:', error);
      return res.status(500).json({ error: 'Erreur suppression administrateur.' });
    }
  });

  return app;
}

async function startServer() {
  const app = createApp();
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = Number(process.env.PORT || 3000);
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`2Frères Phone server running on http://0.0.0.0:${PORT}`);
  });
}

if (!process.env.VERCEL) {
  startServer();
}

