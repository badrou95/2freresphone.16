import 'dotenv/config';
import express from 'express';
import fs from 'fs';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { GoogleGenAI, Type } from '@google/genai';
import { db, hasDatabaseConfig } from './src/db/index.ts';
import {
  accountingEntries,
  adminUsers,
  carriers,
  categories,
  customers,
  digitalDeliveries,
  importMappingProfiles,
  landingPages,
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
  extractAccountingEntriesFromTables,
  parseStockDatabaseBuffer,
  parseStockDatabaseFiles,
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
  limits: { fileSize: 150 * 1024 * 1024 }, // 150 MB max for .mdf / .idf database backups & photos
});

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

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
          colors: (() => {
            try {
              const parsed = JSON.parse(p.colorsJson || '[]');
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })(),
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
          colors: (() => {
            try {
              const parsed = JSON.parse(product.colorsJson || '[]');
              return Array.isArray(parsed) ? parsed : [];
            } catch {
              return [];
            }
          })(),
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

      // Validate items & stock (also supports standalone landing page items via landingPageId)
      const landingPageId = req.body?.landingPageId ? Number(req.body.landingPageId) : null;
      const productIds = items.map((i: any) => Number(i.productId)).filter((n: number) => Number.isInteger(n) && n > 0);
      const dbProducts =
        productIds.length > 0
          ? await db.select().from(products).where(inArray(products.id, productIds))
          : [];
      const prodMap = new Map(dbProducts.map((p) => [p.id, p]));

      let subtotalDzd = 0;
      let hasPhysical = false;
      let hasDigital = false;
      const resolvedItems: {
        productId: number | null;
        productName: string;
        productSku: string;
        productType: string;
        unitPriceDzd: number;
        costPriceDzd: number;
        digitalActivationTemplate: string | null;
        quantity: number;
        lineTotalDzd: number;
      }[] = [];

      for (const line of items) {
        const qty = Math.max(1, Math.floor(Number(line.quantity) || 1));
        const prod = line.productId ? prodMap.get(Number(line.productId)) : undefined;

        if (prod) {
          if (!prod.isActive) {
            return res.status(400).json({ error: 'Un article sélectionné n’est plus disponible.' });
          }
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
          const unitPrice =
            line.customPriceDzd && Number(line.customPriceDzd) > 0
              ? Math.round(Number(line.customPriceDzd))
              : prod.priceDzd;
          const lineTotalDzd = unitPrice * qty;
          subtotalDzd += lineTotalDzd;
          if (prod.productType === 'digital') hasDigital = true;
          else hasPhysical = true;
          const colorLabel = line.selectedColor ? ` — Couleur : ${String(line.selectedColor).trim()}` : '';
          resolvedItems.push({
            productId: prod.id,
            productName: `${prod.name}${colorLabel}`,
            productSku: prod.sku,
            productType: prod.productType,
            unitPriceDzd: unitPrice,
            costPriceDzd: prod.costPriceDzd,
            digitalActivationTemplate: prod.digitalActivationTemplate,
            quantity: qty,
            lineTotalDzd,
          });
        } else if (line.customName && Number(line.customPriceDzd) > 0) {
          const unitPrice = Math.round(Number(line.customPriceDzd));
          const lineTotalDzd = unitPrice * qty;
          subtotalDzd += lineTotalDzd;
          hasPhysical = true;
          const colorLabel = line.selectedColor ? ` — Couleur : ${String(line.selectedColor).trim()}` : '';
          resolvedItems.push({
            productId: null,
            productName: `${String(line.customName).trim()}${colorLabel}`,
            productSku: String(line.customSku || 'LP-OFFER').trim(),
            productType: 'physical',
            unitPriceDzd: unitPrice,
            costPriceDzd: 0,
            digitalActivationTemplate: null,
            quantity: qty,
            lineTotalDzd,
          });
        } else {
          return res.status(400).json({ error: 'Un article sélectionné n’est plus disponible.' });
        }
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
            productId: item.productId,
            productName: item.productName,
            productSku: item.productSku,
            productType: item.productType,
            unitPriceDzd: item.unitPriceDzd,
            costPriceDzd: item.costPriceDzd,
            quantity: item.quantity,
            lineTotalDzd: item.lineTotalDzd,
          })
          .returning();

        if (item.productType === 'digital') {
          await db.insert(digitalDeliveries).values({
            orderId: createdOrder.id,
            orderItemId: oi.id,
            productId: item.productId,
            productName: item.productName,
            deliveryStatus: 'pending',
            activationInstructions: item.digitalActivationTemplate || '',
            privateFulfillmentNote: '',
          });
        }
      }

      if (landingPageId && Number.isInteger(landingPageId)) {
        await db
          .update(landingPages)
          .set({ ordersCount: sql`${landingPages.ordersCount} + 1` })
          .where(eq(landingPages.id, landingPageId));
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
          productId: i.productId,
          name: i.productName,
          quantity: i.quantity,
          unitPriceDzd: i.unitPriceDzd,
          lineTotalDzd: i.lineTotalDzd,
          productType: i.productType,
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
      const physicalProductsList = allProducts.filter(
        (p) => p.productType === 'physical' && Math.max(0, Number(p.stockQuantity) || 0) > 0,
      );
      const stockValuationDzd = physicalProductsList.reduce(
        (acc, p) => acc + Math.max(0, Number(p.stockQuantity) || 0) * Math.max(0, Number(p.priceDzd) || 0),
        0,
      );
      const stockCostValuationDzd = physicalProductsList.reduce(
        (acc, p) => acc + Math.max(0, Number(p.stockQuantity) || 0) * Math.max(0, Number(p.costPriceDzd) || 0),
        0,
      );
      const stockLatentMarginDzd = stockValuationDzd - stockCostValuationDzd;

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
          stockCostValuationDzd,
          stockLatentMarginDzd,
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

  // Helper to guarantee accounting_entries table exists on any pre-existing PostgreSQL / Neon DB
  let accountingTableChecked = false;
  const ensureAccountingTableReady = async () => {
    if (accountingTableChecked) return;
    try {
      await db.execute(
        sql.raw(`CREATE TABLE IF NOT EXISTS accounting_entries (
          id serial PRIMARY KEY,
          reference text NOT NULL,
          entry_type text NOT NULL DEFAULT 'sale',
          category text NOT NULL DEFAULT 'Ventes & Caisse',
          label text NOT NULL,
          partner_name text NOT NULL DEFAULT '',
          amount_dzd integer NOT NULL DEFAULT 0,
          cost_dzd integer NOT NULL DEFAULT 0,
          margin_dzd integer NOT NULL DEFAULT 0,
          payment_method text NOT NULL DEFAULT 'Espèces / Caisse',
          source_file text,
          import_id integer REFERENCES stock_imports(id) ON DELETE SET NULL,
          order_id integer REFERENCES orders(id) ON DELETE SET NULL,
          entry_date timestamp NOT NULL DEFAULT now(),
          notes text NOT NULL DEFAULT '',
          created_at timestamp NOT NULL DEFAULT now()
        )`),
      );
      accountingTableChecked = true;
    } catch (e) {
      console.warn('ensureAccountingTableReady warning:', e);
    }
  };

  // Automatically purges corrupted MDF token-scraper rows (2200 DZD / 1496 DZD / SQL view fragments / binary garbage)
  // or cleans all previous MDF imports when forceCleanAllImports = true
  let autoCorruptedPurgeDone = false;
  const purgeCorruptedMdfProducts = async (
    forceCleanAllImports = false,
  ): Promise<{ deletedProductsCount: number; deletedAccountingCount: number }> => {
    if (!forceCleanAllImports && autoCorruptedPurgeDone) {
      return { deletedProductsCount: 0, deletedAccountingCount: 0 };
    }
    try {
      await ensureAccountingTableReady();
      let deletedProductsCount = 0;
      let deletedAccountingCount = 0;

      if (forceCleanAllImports) {
        // Delete all accounting entries from previous stock imports
        const delAcc = await db.execute(
          sql.raw(`DELETE FROM accounting_entries WHERE import_id IS NOT NULL RETURNING id`),
        );
        deletedAccountingCount = Array.isArray((delAcc as any)?.rows)
          ? (delAcc as any).rows.length
          : 0;

        // Delete all products created by previous MDF/stock imports that are not tied to customer orders
        const delProds = await db.execute(
          sql.raw(`
            DELETE FROM products
            WHERE id NOT IN (SELECT product_id FROM order_items WHERE product_id IS NOT NULL)
              AND (
                sku LIKE 'MDF-%'
                OR sku LIKE 'ART-%'
                OR id IN (SELECT product_id FROM stock_movements WHERE import_id IS NOT NULL AND product_id IS NOT NULL)
                OR (price_dzd = 2200 AND cost_price_dzd = 1496)
                OR name ~* '(FROM dbo\\.|GROUP BY |INNER JOIN|LEFT JOIN|LedgerBook|CustomerID|SUM\\(dbo\\.)'
                OR name ~ '[ÅÒðÏØÞß÷þÿ]'
              )
            RETURNING id
          `),
        );
        deletedProductsCount = Array.isArray((delProds as any)?.rows)
          ? (delProds as any).rows.length
          : 0;

        await db.execute(sql.raw(`DELETE FROM stock_movements WHERE import_id IS NOT NULL`));
      } else {
        // Automatic cleanup of corrupted rows from the old zero-stripped token scraper
        const delProds = await db.execute(
          sql.raw(`
            DELETE FROM products
            WHERE id NOT IN (SELECT product_id FROM order_items WHERE product_id IS NOT NULL)
              AND (
                (sku LIKE 'MDF-%' AND price_dzd = 2200 AND cost_price_dzd = 1496)
                OR (price_dzd = 2200 AND cost_price_dzd = 1496 AND sku ~ '^MDF-[0-9]+')
                OR name ~* '(FROM dbo\\.|GROUP BY |INNER JOIN|LEFT JOIN|LedgerBook|CustomerID|SUM\\(dbo\\.|sys\\.sys)'
                OR name ~ '[ÅÒðÏØÞß÷þÿ]'
              )
            RETURNING id
          `),
        );
        deletedProductsCount = Array.isArray((delProds as any)?.rows)
          ? (delProds as any).rows.length
          : 0;

        // Also delete corrupted accounting entries whose label contains SQL or binary garbage
        const delAcc = await db.execute(
          sql.raw(`
            DELETE FROM accounting_entries
            WHERE label ~* '(FROM dbo\\.|GROUP BY |INNER JOIN|LedgerBook|CustomerID|SUM\\(dbo\\.)'
               OR label ~ '[ÅÒðÏØÞß÷þÿ]'
            RETURNING id
          `),
        );
        deletedAccountingCount = Array.isArray((delAcc as any)?.rows)
          ? (delAcc as any).rows.length
          : 0;

        autoCorruptedPurgeDone = true;
      }

      return { deletedProductsCount, deletedAccountingCount };
    } catch (e) {
      console.warn('purgeCorruptedMdfProducts warning:', e);
      return { deletedProductsCount: 0, deletedAccountingCount: 0 };
    }
  };

  // Persist uploaded .MDF / .IDF buffers in mediaAssets (kind = 'mdf_backup') so the admin can regenerate in 1 click
  const saveMdfBackupToMediaAssets = async (
    files: { buffer: Buffer; originalname: string; mimetype?: string }[],
  ) => {
    try {
      if (!files || files.length === 0) return;
      await db.delete(mediaAssets).where(eq(mediaAssets.kind, 'mdf_backup'));
      for (const f of files.slice(0, 3)) {
        if (f.buffer.length <= 6 * 1024 * 1024) {
          await db.insert(mediaAssets).values({
            filename: f.originalname,
            mimeType: f.mimetype || 'application/octet-stream',
            dataBase64: f.buffer.toString('base64'),
            sizeBytes: f.buffer.length,
            kind: 'mdf_backup',
          });
        }
      }
    } catch (e) {
      console.warn('saveMdfBackupToMediaAssets warning:', e);
    }
  };

  // 3. Sales Ledger & Complete Accounting (Compta)
  app.get('/api/admin/sales', requireAdmin, async (_req, res) => {
    try {
      await ensureAccountingTableReady();
      await purgeCorruptedMdfProducts(false);
      const [list, entries] = await Promise.all([
        db.select().from(sales).orderBy(desc(sales.recordedAt)),
        db
          .select()
          .from(accountingEntries)
          .orderBy(desc(accountingEntries.entryDate), desc(accountingEntries.id))
          .catch(() => []),
      ]);
      return res.json({ sales: list, accountingEntries: entries });
    } catch (error) {
      console.error('Admin sales error:', error);
      return res.status(500).json({ error: 'Erreur lors du chargement des ventes et de la comptabilité.' });
    }
  });

  app.post('/api/admin/accounting', requireAdmin, async (req: AuthRequest, res) => {
    try {
      await ensureAccountingTableReady();
      const b = req.body || {};
      const label = String(b.label || '').trim();
      if (!label) {
        return res.status(400).json({ error: 'Le libellé de l’écriture comptable est obligatoire.' });
      }
      const entryType = ['sale', 'purchase', 'stock_valuation', 'expense', 'adjustment'].includes(b.entryType)
        ? b.entryType
        : 'sale';
      const amountDzd = Math.max(0, Math.round(Number(b.amountDzd) || 0));
      const costDzd = Math.max(0, Math.round(Number(b.costDzd) || 0));
      const marginDzd =
        b.marginDzd !== undefined && b.marginDzd !== ''
          ? Math.round(Number(b.marginDzd))
          : entryType === 'sale' || entryType === 'stock_valuation'
          ? amountDzd - costDzd
          : entryType === 'expense'
          ? -amountDzd
          : 0;

      const [created] = await db
        .insert(accountingEntries)
        .values({
          reference: String(b.reference || `CPT-${Date.now().toString(36).slice(-5).toUpperCase()}`).trim(),
          entryType,
          category: String(b.category || 'Journal Comptable').trim(),
          label,
          partnerName: String(b.partnerName || '').trim(),
          amountDzd,
          costDzd,
          marginDzd,
          paymentMethod: String(b.paymentMethod || 'Espèces / Caisse').trim(),
          sourceFile: b.sourceFile ? String(b.sourceFile) : 'Saisie manuelle admin',
          notes: String(b.notes || '').trim(),
          entryDate: b.entryDate ? new Date(b.entryDate) : new Date(),
        })
        .returning();

      return res.status(201).json({ entry: created });
    } catch (error) {
      console.error('Create accounting entry error:', error);
      return res.status(500).json({ error: 'Impossible d’enregistrer l’écriture comptable.' });
    }
  });

  app.delete('/api/admin/accounting/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(accountingEntries).where(eq(accountingEntries.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur lors de la suppression de l’écriture comptable.' });
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
      const trimmedName = String(name).trim();
      const baseSlug = slugify(trimmedName) || `cat-${Date.now()}`;
      const existingBySlug = await db.select().from(categories).where(eq(categories.slug, baseSlug));
      if (
        existingBySlug.length > 0 &&
        existingBySlug[0].name.trim().toLowerCase() === trimmedName.toLowerCase()
      ) {
        return res.status(200).json({ category: existingBySlug[0] });
      }
      const finalSlug =
        existingBySlug.length > 0 ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;

      const [created] = await db
        .insert(categories)
        .values({
          name: trimmedName,
          slug: finalSlug,
          categoryGroup: categoryGroup || 'accessories',
          description: description || null,
          sortOrder: Number(sortOrder) || 0,
          isActive: isActive !== false,
        })
        .returning();
      return res.status(201).json({ category: created });
    } catch (error: any) {
      return res.status(400).json({ error: 'Impossible de créer cette catégorie.' });
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
          slug: name ? slugify(nextName) || existing.slug : existing.slug,
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
      await db.update(storeSettings).set({ catalogInitialized: true });
      await db.update(products).set({ categoryId: null }).where(eq(products.categoryId, id));
      await db.delete(categories).where(eq(categories.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression catégorie.' });
    }
  });

  // Bulk delete multiple categories at once (products stay intact with categoryId = null)
  app.post('/api/admin/categories/bulk-delete', requireAdmin, async (req, res) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const uniqueIds = Array.from(
        new Set(
          rawIds
            .map((v: unknown) => Number(v))
            .filter((n: number) => Number.isInteger(n) && n > 0),
        ),
      ) as number[];

      if (uniqueIds.length === 0) {
        return res.status(400).json({ error: 'Aucune catégorie sélectionnée à supprimer.' });
      }

      await db.update(storeSettings).set({ catalogInitialized: true });
      await db.update(products).set({ categoryId: null }).where(inArray(products.categoryId, uniqueIds));
      const deletedRows = await db
        .delete(categories)
        .where(inArray(categories.id, uniqueIds))
        .returning({ id: categories.id });

      return res.json({
        deletedCount: deletedRows.length,
        deletedIds: deletedRows.map((r) => r.id),
      });
    } catch (error) {
      console.error('Bulk delete categories error:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression multiple des catégories.' });
    }
  });

  // 5. Products CRUD + Direct Photo Upload + Low Stock Threshold
  app.get('/api/admin/products', requireAdmin, async (_req, res) => {
    try {
      await purgeCorruptedMdfProducts(false);
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
        let parsedColors: any[] = [];
        try {
          const c = JSON.parse(p.colorsJson || '[]');
          if (Array.isArray(c)) parsedColors = c;
        } catch {
          parsedColors = [];
        }
        return {
          ...p,
          colors: parsedColors,
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
          colorsJson: JSON.stringify(Array.isArray(b.colors) ? b.colors : []),
        })
        .returning();

      const incomingImages: string[] = Array.isArray(b.imageUrls)
        ? b.imageUrls.map((u: any) => String(u || '').trim()).filter(Boolean)
        : b.imageUrl && String(b.imageUrl).trim()
        ? [String(b.imageUrl).trim()]
        : [];

      for (let i = 0; i < incomingImages.length; i++) {
        await db.insert(productImages).values({
          productId: created.id,
          url: incomingImages[i],
          altText: created.name,
          sortOrder: i,
          isPrimary: i === 0,
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
          colorsJson:
            b.colors !== undefined ? JSON.stringify(Array.isArray(b.colors) ? b.colors : []) : existing.colorsJson,
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

      // Sync productImages whenever imageUrls array is passed in PATCH body (supports deleting & setting primary photo!)
      if (Array.isArray(b.imageUrls)) {
        const cleanUrls = Array.from(
          new Set(
            b.imageUrls
              .map((u: unknown) => String(u || '').trim())
              .filter(Boolean),
          ),
        ) as string[];
        await db.delete(productImages).where(eq(productImages.productId, id));
        for (let i = 0; i < cleanUrls.length; i++) {
          await db.insert(productImages).values({
            productId: id,
            url: cleanUrls[i],
            altText: updated.name,
            sortOrder: i,
            isPrimary: i === 0,
          });
        }
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
      await db.update(storeSettings).set({ catalogInitialized: true });
      await db.delete(products).where(eq(products.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression produit.' });
    }
  });

  // Bulk delete multiple products at once
  app.post('/api/admin/products/bulk-delete', requireAdmin, async (req, res) => {
    try {
      const rawIds = Array.isArray(req.body?.ids) ? req.body.ids : [];
      const uniqueIds = Array.from(
        new Set(
          rawIds
            .map((v: unknown) => Number(v))
            .filter((n: number) => Number.isInteger(n) && n > 0),
        ),
      ) as number[];

      if (uniqueIds.length === 0) {
        return res.status(400).json({ error: 'Aucun produit sélectionné à supprimer.' });
      }

      await db.update(storeSettings).set({ catalogInitialized: true });
      const deletedRows = await db
        .delete(products)
        .where(inArray(products.id, uniqueIds))
        .returning({ id: products.id });

      return res.json({
        deletedCount: deletedRows.length,
        deletedIds: deletedRows.map((r) => r.id),
      });
    } catch (error) {
      console.error('Bulk delete products error:', error);
      return res.status(500).json({ error: 'Erreur lors de la suppression multiple des produits.' });
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

      // If remaining photos exist and none is marked isPrimary, promote the first one automatically
      const remaining = await db
        .select()
        .from(productImages)
        .where(eq(productImages.productId, productId))
        .orderBy(desc(productImages.isPrimary), asc(productImages.sortOrder));
      if (remaining.length > 0 && !remaining.some((img) => img.isPrimary)) {
        await db
          .update(productImages)
          .set({ isPrimary: true })
          .where(eq(productImages.id, remaining[0].id));
      }

      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur suppression photo.' });
    }
  });

  // 6. Stock Management, Alerts & Universal Stock Database Import Engine
  app.get('/api/admin/stock', requireAdmin, async (_req, res) => {
    try {
      await ensureAccountingTableReady();
      await purgeCorruptedMdfProducts(false);
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
      const accounting = await db
        .select()
        .from(accountingEntries)
        .orderBy(desc(accountingEntries.entryDate), desc(accountingEntries.id))
        .limit(300)
        .catch(() => []);

      return res.json({
        globalLowStockThreshold: globalThreshold,
        adminAlertEmail: settingsRow?.adminAlertEmail || 'badroumc@gmail.com',
        movements,
        alerts,
        imports,
        profiles,
        accountingEntries: accounting,
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

  // Check if a .MDF / .IDF backup is stored on the server for 1-click regeneration
  app.get('/api/admin/stock/import/backup-status', requireAdmin, async (_req, res) => {
    try {
      const backups = await db
        .select({ id: mediaAssets.id, filename: mediaAssets.filename, createdAt: mediaAssets.createdAt })
        .from(mediaAssets)
        .where(eq(mediaAssets.kind, 'mdf_backup'))
        .orderBy(desc(mediaAssets.id))
        .limit(3);
      return res.json({
        hasBackup: backups.length > 0,
        fileName: backups.map((b) => b.filename).join(' + '),
      });
    } catch {
      return res.json({ hasBackup: false });
    }
  });

  // Explicit 1-click cleanup endpoint to remove corrupted or previous MDF imports
  app.post('/api/admin/stock/import/cleanup', requireAdmin, async (req, res) => {
    try {
      const cleanAll = req.body?.cleanAllImports !== false;
      const result = await purgeCorruptedMdfProducts(cleanAll);
      await syncAllLowStockAlerts().catch(() => {});
      return res.json({
        ok: true,
        ...result,
      });
    } catch (error: any) {
      return res.status(500).json({ error: error?.message || 'Erreur lors du nettoyage.' });
    }
  });

  // Chunked upload endpoint for large .MDF / .IDF files (prevents HTTP 413 on Vercel & reverse proxies)
  app.post('/api/admin/stock/import/upload-chunk', requireAdmin, async (req, res) => {
    try {
      const { fileName, chunkIndex, totalChunks, dataBase64, resetPrevious, assetId } = req.body || {};
      if (!fileName || typeof dataBase64 !== 'string') {
        return res.status(400).json({ error: 'Paramètres de fragment (chunk) manquants.' });
      }
      const idx = Number(chunkIndex) || 0;
      const total = Number(totalChunks) || 1;
      const chunkByteLen = Math.round((dataBase64.length * 3) / 4);

      if (idx === 0 && resetPrevious) {
        await db.delete(mediaAssets).where(eq(mediaAssets.kind, 'mdf_backup'));
      }

      if (idx === 0) {
        const [inserted] = await db
          .insert(mediaAssets)
          .values({
            filename: String(fileName),
            mimeType: 'application/octet-stream',
            dataBase64,
            sizeBytes: chunkByteLen,
            kind: 'mdf_backup',
          })
          .returning({ id: mediaAssets.id });
        return res.json({
          ok: true,
          assetId: inserted.id,
          chunkIndex: idx,
          totalChunks: total,
        });
      }

      const targetId = Number(assetId);
      if (!targetId) {
        return res.status(400).json({ error: 'assetId manquant pour la suite du fichier.' });
      }

      await db
        .update(mediaAssets)
        .set({
          dataBase64: sql`${mediaAssets.dataBase64} || ${dataBase64}`,
          sizeBytes: sql`${mediaAssets.sizeBytes} + ${chunkByteLen}`,
        })
        .where(eq(mediaAssets.id, targetId));

      return res.json({
        ok: true,
        assetId: targetId,
        chunkIndex: idx,
        totalChunks: total,
      });
    } catch (error: any) {
      console.error('Upload chunk error:', error);
      return res.status(500).json({ error: error?.message || 'Erreur lors du transfert par fragments.' });
    }
  });

  // Preview universal stock & accounting database files (.MDF + .IDF, DBF, BAK, Excel, CSV, TSV, JSON, XML, SQLite, SQL)
  app.post('/api/admin/stock/import/preview', requireAdmin, upload.any(), async (req, res) => {
    try {
      await purgeCorruptedMdfProducts(false);
      const uploadedFiles = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : req.file
        ? [req.file]
        : [];

      let filesToParse: { buffer: Buffer; originalname: string }[] = [];

      if (uploadedFiles.length > 0) {
        await saveMdfBackupToMediaAssets(uploadedFiles);
        filesToParse = uploadedFiles.map((f) => ({ buffer: f.buffer, originalname: f.originalname }));
      } else {
        const savedBackups = await db
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.kind, 'mdf_backup'))
          .orderBy(asc(mediaAssets.id));
        if (savedBackups.length === 0) {
          return res
            .status(400)
            .json({ error: 'Veuillez sélectionner votre fichier (ou vos deux fichiers .mdf et .idf).' });
        }
        filesToParse = savedBackups.map((b) => ({
          buffer: Buffer.from(b.dataBase64, 'base64'),
          originalname: b.filename || 'nabils.mdf',
        }));
      }

      const preferredTable = req.body?.tableName ? String(req.body.tableName) : undefined;
      const syncMode = (req.body?.syncMode || 'full_sync') as StockSyncMode;
      const rawMapStr = req.body?.mappingJson || req.body?.mapping;
      const customMapping: ColumnMapping | null = rawMapStr
        ? typeof rawMapStr === 'string'
          ? JSON.parse(rawMapStr)
          : rawMapStr
        : null;

      const parsed = await parseStockDatabaseFiles(filesToParse, preferredTable);
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

      const combinedFileName = filesToParse.map((f) => f.originalname).join(' + ');
      const accountingEntriesPreview = extractAccountingEntriesFromTables(
        parsed.tables,
        selectedTableObj.rows,
        activeMapping,
        combinedFileName,
      );

      const accountingTotals = accountingEntriesPreview.reduce(
        (acc, e) => {
          if (e.entryType === 'sale') {
            acc.salesDzd += e.amountDzd;
            acc.salesMarginDzd += e.marginDzd;
          } else if (e.entryType === 'purchase') {
            acc.purchasesDzd += e.amountDzd;
          } else if (e.entryType === 'expense') {
            acc.expensesDzd += e.amountDzd;
          } else if (e.entryType === 'stock_valuation') {
            acc.stockSaleValueDzd += e.amountDzd;
            acc.stockCostValueDzd += e.costDzd;
            acc.stockMarginDzd += e.marginDzd;
          }
          return acc;
        },
        {
          salesDzd: 0,
          salesMarginDzd: 0,
          purchasesDzd: 0,
          expensesDzd: 0,
          stockSaleValueDzd: 0,
          stockCostValueDzd: 0,
          stockMarginDzd: 0,
        },
      );

      return res.json({
        fileName: combinedFileName,
        companionFiles: parsed.companionFiles,
        format: parsed.format,
        tables: parsed.tables.map((t) => ({ tableName: t.tableName, rowCount: t.rows.length })),
        selectedTable: parsed.selectedTable,
        columns: parsed.columns,
        totalRows: parsed.totalRows,
        previewRows: parsed.previewRows,
        mapping: activeMapping,
        accountingPreview: {
          totalEntries: accountingEntriesPreview.length,
          ...accountingTotals,
          sampleEntries: accountingEntriesPreview.slice(0, 12),
        },
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

  // Core helper to execute a full database import commit from buffer files
  const executeDatabaseImportCommit = async (opts: {
    files: { buffer: Buffer; originalname: string }[];
    preferredTable?: string;
    syncMode: StockSyncMode;
    mapping: ColumnMapping;
    defaultCategoryId: number | null;
    saveProfileName: string;
    generateAccounting: boolean;
    cleanPreviousImports: boolean;
    importedBy: string;
  }) => {
    const {
      files,
      preferredTable,
      syncMode,
      mapping,
      defaultCategoryId,
      saveProfileName,
      generateAccounting,
      cleanPreviousImports,
      importedBy,
    } = opts;

    const purgeStats = await purgeCorruptedMdfProducts(cleanPreviousImports);

    const parsed = await parseStockDatabaseFiles(files, preferredTable);
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

    const combinedFileName = files.map((f) => f.originalname).join(' + ');

    const [importRecord] = await db
      .insert(stockImports)
      .values({
        fileName: combinedFileName,
        fileFormat: parsed.format,
        sourceTableOrSheet: parsed.selectedTable,
        syncMode,
        totalRows: selectedTableObj.rows.length,
        addedCount: 0,
        updatedCount: 0,
        skippedCount: diff.skipped.length,
        errorCount: diff.errors.length,
        importedBy,
      })
      .returning();

    await ensureAccountingTableReady();
    await db.update(storeSettings).set({ catalogInitialized: true });

    const clampInt32 = (val: unknown, min = -2000000000, max = 2000000000): number => {
      const n = Math.round(Number(val) || 0);
      if (!Number.isFinite(n)) return 0;
      return Math.min(max, Math.max(min, n));
    };

    let addedCount = 0;
    let updatedCount = 0;
    const addedProductIds: number[] = [];

    const usedSkus = new Set<string>(existing.map((e) => String(e.sku || '').toLowerCase()));

    // 1a. Resolve or create categories first
    for (const item of diff.toAdd) {
      if (item.categoryName) {
        const catSlug = slugify(item.categoryName) || 'catalogue-mdf';
        if (!catByNormName.has(catSlug)) {
          const [newCat] = await db
            .insert(categories)
            .values({
              name: String(item.categoryName).slice(0, 120),
              slug: `${catSlug}-${Date.now().toString(36).slice(-3)}-${item.rowIndex}`,
              categoryGroup: item.productType === 'digital' ? 'digital' : 'accessories',
              sortOrder: 99,
              isActive: true,
            })
            .onConflictDoNothing()
            .returning();
          if (newCat) {
            catByNormName.set(catSlug, newCat.id);
          }
        }
      }
    }

    // 1b. Batch-insert new articles in chunks of 80 for fast execution on serverless Postgres
    const productRowsToInsert = diff.toAdd.map((item, idx) => {
      let resolvedCatId = defaultCategoryId;
      if (item.categoryName) {
        const catSlug = slugify(item.categoryName) || 'catalogue-mdf';
        if (catByNormName.has(catSlug)) {
          resolvedCatId = catByNormName.get(catSlug)!;
        }
      }
      let candidateSku = String(item.sku || `ART-${importRecord.id}-${idx + 1}`).trim().slice(0, 80);
      if (!candidateSku || usedSkus.has(candidateSku.toLowerCase())) {
        candidateSku = `${candidateSku || 'ART'}-${importRecord.id}-${item.rowIndex}`;
      }
      usedSkus.add(candidateSku.toLowerCase());

      const baseSlug = slugify(item.name) || 'article';
      const uniqueSlug = `${baseSlug.slice(0, 80)}-${importRecord.id}-${item.rowIndex}-${idx}`;

      return {
        categoryId: resolvedCatId,
        sku: candidateSku,
        barcode: item.barcode ? String(item.barcode).slice(0, 80) : null,
        externalRef: item.externalRef ? String(item.externalRef).slice(0, 80) : null,
        name: String(item.name || 'Article Stock').slice(0, 220),
        slug: uniqueSlug,
        brand: item.brand ? String(item.brand).slice(0, 80) : null,
        shortDescription: item.description ? String(item.description).slice(0, 160) : null,
        description: item.description ? String(item.description) : '',
        productType: item.productType,
        priceDzd: clampInt32(item.priceDzd, 0),
        costPriceDzd: clampInt32(item.costPriceDzd, 0),
        stockQuantity: clampInt32(item.stockQuantity, 0),
        lowStockThreshold: item.lowStockThreshold !== null ? clampInt32(item.lowStockThreshold, 0) : null,
        isFeatured: false,
        isActive: true,
      };
    });

    const CHUNK_SIZE = 80;
    const movementsToInsert: {
      productId: number;
      importId: number;
      delta: number;
      previousQty: number;
      newQty: number;
      reason: string;
      createdBy: string;
    }[] = [];

    for (let i = 0; i < productRowsToInsert.length; i += CHUNK_SIZE) {
      const chunk = productRowsToInsert.slice(i, i + CHUNK_SIZE);
      const insertedChunk = await db
        .insert(products)
        .values(chunk)
        .onConflictDoNothing()
        .returning({ id: products.id, stockQuantity: products.stockQuantity });

      for (const ins of insertedChunk) {
        addedCount += 1;
        addedProductIds.push(ins.id);
        movementsToInsert.push({
          productId: ins.id,
          importId: importRecord.id,
          delta: ins.stockQuantity,
          previousQty: 0,
          newQty: ins.stockQuantity,
          reason: `Import sauvegarde (${combinedFileName})`,
          createdBy: importedBy,
        });
      }
    }

    // 2. Update existing articles if mode is add_and_update_stock or full_sync (ALWAYS preserving photos!)
    for (const entry of diff.toUpdate) {
      const nextQty = clampInt32(entry.incoming.stockQuantity, 0);
      const updateData: Record<string, unknown> = {
        stockQuantity: nextQty,
        updatedAt: new Date(),
      };
      if (syncMode === 'full_sync') {
        if (entry.incoming.priceDzd > 0) updateData.priceDzd = clampInt32(entry.incoming.priceDzd, 0);
        if (entry.incoming.costPriceDzd > 0) updateData.costPriceDzd = clampInt32(entry.incoming.costPriceDzd, 0);
        if (entry.incoming.brand) updateData.brand = String(entry.incoming.brand).slice(0, 80);
        if (entry.incoming.description) updateData.description = String(entry.incoming.description);
      }
      await db.update(products).set(updateData).where(eq(products.id, entry.existing.id));
      if (entry.stockDelta !== 0) {
        movementsToInsert.push({
          productId: entry.existing.id,
          importId: importRecord.id,
          delta: clampInt32(entry.stockDelta),
          previousQty: clampInt32(entry.existing.stockQuantity, 0),
          newQty: nextQty,
          reason: `Synchro fichier stock (${combinedFileName})`,
          createdBy: importedBy,
        });
      }
      updatedCount += 1;
    }

    // Batch-insert stock movements
    for (let i = 0; i < movementsToInsert.length; i += CHUNK_SIZE) {
      const movChunk = movementsToInsert.slice(i, i + CHUNK_SIZE);
      await db.insert(stockMovements).values(movChunk).catch((e) => {
        console.warn('Stock movement batch insert warning:', e);
      });
    }

    // 3. Generate & store Complete Accounting ("Toute la Compta") in PostgreSQL
    let accountingGeneratedCount = 0;
    if (generateAccounting) {
      await ensureAccountingTableReady();
      const extractedAccounting = extractAccountingEntriesFromTables(
        parsed.tables,
        selectedTableObj.rows,
        activeMapping,
        combinedFileName,
      );
      const accountingRowsToInsert = extractedAccounting.map((acc, idx) => ({
        reference: `${String(acc.reference || `CPT-${idx + 1}`).slice(0, 60)}-${importRecord.id}`,
        entryType: acc.entryType || 'sale',
        category: String(acc.category || 'Ventes & Encaissements').slice(0, 100),
        label: String(acc.label || 'Écriture comptable importée').slice(0, 240),
        partnerName: String(acc.partnerName || 'Sauvegarde .MDF/.IDF').slice(0, 140),
        amountDzd: clampInt32(acc.amountDzd, 0),
        costDzd: clampInt32(acc.costDzd, 0),
        marginDzd: clampInt32(acc.marginDzd),
        paymentMethod: String(acc.paymentMethod || 'Caisse / Sauvegarde').slice(0, 80),
        sourceFile: String(combinedFileName).slice(0, 160),
        importId: importRecord.id,
        entryDate: acc.entryDate ? new Date(acc.entryDate) : new Date(),
        notes: String(acc.notes || ''),
      }));

      for (let i = 0; i < accountingRowsToInsert.length; i += CHUNK_SIZE) {
        const accChunk = accountingRowsToInsert.slice(i, i + CHUNK_SIZE);
        try {
          await db.insert(accountingEntries).values(accChunk);
          accountingGeneratedCount += accChunk.length;
        } catch (accErr) {
          console.warn('Batch accounting insert fallback to single row:', accErr);
          for (const singleAcc of accChunk) {
            try {
              await db.insert(accountingEntries).values(singleAcc);
              accountingGeneratedCount += 1;
            } catch (singleErr) {
              console.warn('Skipping malformed accounting entry:', singleErr);
            }
          }
        }
      }
    }

    // 4. Save mapping profile if requested
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

    await syncAllLowStockAlerts().catch(() => {});

    const [finalImport] = await db
      .update(stockImports)
      .set({
        addedCount,
        updatedCount,
        summaryJson: JSON.stringify({
          addedProductIds: addedProductIds.slice(0, 500),
          accountingGeneratedCount,
          purgedOldProductsCount: purgeStats.deletedProductsCount,
        }),
      })
      .where(eq(stockImports.id, importRecord.id))
      .returning();

    return {
      importRecord: finalImport,
      addedProductIds,
      accountingGeneratedCount,
      purgedOldProductsCount: purgeStats.deletedProductsCount,
    };
  };

  // Commit universal stock & accounting database import (.MDF + .IDF, etc.) with differential sync
  app.post('/api/admin/stock/import/commit', requireAdmin, upload.any(), async (req: AuthRequest, res) => {
    try {
      const uploadedFiles = Array.isArray(req.files)
        ? (req.files as Express.Multer.File[])
        : req.file
        ? [req.file]
        : [];

      let filesToCommit: { buffer: Buffer; originalname: string }[] = [];
      if (uploadedFiles.length > 0) {
        await saveMdfBackupToMediaAssets(uploadedFiles);
        filesToCommit = uploadedFiles.map((f) => ({ buffer: f.buffer, originalname: f.originalname }));
      } else {
        const savedBackups = await db
          .select()
          .from(mediaAssets)
          .where(eq(mediaAssets.kind, 'mdf_backup'))
          .orderBy(asc(mediaAssets.id));
        if (savedBackups.length === 0) {
          return res.status(400).json({ error: 'Fichier(s) de sauvegarde manquant(s).' });
        }
        filesToCommit = savedBackups.map((b) => ({
          buffer: Buffer.from(b.dataBase64, 'base64'),
          originalname: b.filename || 'nabils.mdf',
        }));
      }

      const preferredTable = req.body?.tableName ? String(req.body.tableName) : undefined;
      const syncMode = (req.body?.syncMode || 'full_sync') as StockSyncMode;
      const rawMapStr = req.body?.mappingJson || req.body?.mapping;
      const mapping: ColumnMapping = rawMapStr
        ? typeof rawMapStr === 'string'
          ? JSON.parse(rawMapStr)
          : rawMapStr
        : { name: '' };
      const defaultCategoryId = req.body?.defaultCategoryId ? Number(req.body.defaultCategoryId) : null;
      const saveProfileName = req.body?.saveProfileName ? String(req.body.saveProfileName).trim() : '';
      const generateAccounting = req.body?.generateAccounting !== 'false' && req.body?.generateAccounting !== false;
      const cleanPreviousImports = req.body?.cleanPreviousImports !== 'false' && req.body?.cleanPreviousImports !== false;

      const result = await executeDatabaseImportCommit({
        files: filesToCommit,
        preferredTable,
        syncMode,
        mapping,
        defaultCategoryId,
        saveProfileName,
        generateAccounting,
        cleanPreviousImports,
        importedBy: req.adminUser?.email || 'admin',
      });

      return res.status(201).json(result);
    } catch (error: any) {
      console.error('Import commit error:', error);
      return res.status(500).json({ error: error?.message || 'Erreur lors de l’importation du stock et de la comptabilité.' });
    }
  });

  // 1-Click Regenerate & Fix from the last uploaded .MDF / .IDF backup stored in mediaAssets
  app.post('/api/admin/stock/import/regenerate', requireAdmin, async (req: AuthRequest, res) => {
    try {
      const savedBackups = await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.kind, 'mdf_backup'))
        .orderBy(asc(mediaAssets.id));

      if (savedBackups.length === 0) {
        await purgeCorruptedMdfProducts(true);
        return res.status(400).json({
          error:
            'Les anciennes lignes erronées ont été nettoyées. Veuillez resélectionner votre fichier .MDF dans le Point 1 puis cliquer sur « Sauvegarder & Intégrer maintenant ».',
        });
      }

      const files = savedBackups.map((b) => ({
        buffer: Buffer.from(b.dataBase64, 'base64'),
        originalname: b.filename || 'nabils.mdf',
      }));

      const b = req.body || {};
      const result = await executeDatabaseImportCommit({
        files,
        preferredTable: b.tableName ? String(b.tableName) : undefined,
        syncMode: (b.syncMode || 'full_sync') as StockSyncMode,
        mapping: b.mapping && b.mapping.name ? b.mapping : { name: '' },
        defaultCategoryId: b.defaultCategoryId ? Number(b.defaultCategoryId) : null,
        saveProfileName: '',
        generateAccounting: b.generateAccounting !== false,
        cleanPreviousImports: true,
        importedBy: req.adminUser?.email || 'admin',
      });

      return res.json(result);
    } catch (error: any) {
      console.error('Regenerate MDF backup error:', error);
      return res.status(500).json({
        error: error?.message || 'Erreur lors de la régénération de la sauvegarde .MDF.',
      });
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

  // ---------------------------------------------------------------------------
  // 16. PAGEPILOT: AI LANDING PAGE BUILDER (Admin + Public Conversion Pages)
  // ---------------------------------------------------------------------------
  const serializeLandingPage = (row: typeof landingPages.$inferSelect) => {
    const parseJsonSafe = <T,>(raw: string | null | undefined, fallback: T): T => {
      if (!raw) return fallback;
      try {
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };
    return {
      ...row,
      galleryImages: parseJsonSafe<string[]>(row.galleryImagesJson, []),
      colors: parseJsonSafe<{ name: string; hex: string; imageUrl?: string }[]>(row.colorsJson || '[]', []),
      benefits: parseJsonSafe<{ title: string; description: string }[]>(row.benefitsJson, []),
      specs: parseJsonSafe<{ label: string; value: string }[]>(row.specsJson, []),
      testimonials: parseJsonSafe<{ name: string; wilaya: string; rating: number; comment: string }[]>(
        row.testimonialsJson,
        [],
      ),
      faq: parseJsonSafe<{ question: string; answer: string }[]>(row.faqJson, []),
    };
  };

  // Public: get published landing page by slug and increment views
  app.get('/api/landing-pages/:slug', async (req, res) => {
    try {
      const slug = String(req.params.slug || '').trim().toLowerCase();
      const [page] = await db.select().from(landingPages).where(eq(landingPages.slug, slug));
      if (!page || !page.isPublished) {
        return res.status(404).json({ error: 'Cette page d’offre spéciale est introuvable ou inactive.' });
      }
      await db
        .update(landingPages)
        .set({ viewsCount: sql`${landingPages.viewsCount} + 1` })
        .where(eq(landingPages.id, page.id));

      return res.json({ landingPage: serializeLandingPage({ ...page, viewsCount: page.viewsCount + 1 }) });
    } catch (error) {
      console.error('Get public landing page error:', error);
      return res.status(500).json({ error: 'Erreur chargement de la landing page.' });
    }
  });

  // Admin: list all landing pages
  app.get('/api/admin/landing-pages', requireAdmin, async (_req, res) => {
    try {
      const rows = await db.select().from(landingPages).orderBy(desc(landingPages.createdAt));
      return res.json({ landingPages: rows.map(serializeLandingPage) });
    } catch (error) {
      console.error('Admin list landing pages error:', error);
      return res.status(500).json({ error: 'Erreur chargement des landing pages.' });
    }
  });

  // Admin: PagePilot AI Generator using @google/genai (gemini-4-hydrogen) with Multimodal Photo Analysis
  app.post('/api/admin/pagepilot/generate', requireAdmin, async (req, res) => {
    const b = req.body || {};
    const rawProductName = String(b.productName || '').trim();
    const priceDzd = Math.max(0, Math.round(Number(b.priceDzd) || 0));
    const compareAtPriceDzd = b.compareAtPriceDzd
      ? Math.max(0, Math.round(Number(b.compareAtPriceDzd)))
      : Math.round((priceDzd || 3500) * 1.25 / 100) * 100;
    const keyInfo = String(b.description || b.prompt || '').trim();
    const tone = String(b.tone || 'conversion').trim();
    const autoPublish = Boolean(b.autoPublish);

    // Collect image URLs (from multi-photo upload or heroImageUrl)
    const rawImages: string[] = Array.isArray(b.imageUrls)
      ? b.imageUrls.map((u: any) => String(u || '').trim()).filter(Boolean)
      : [];
    if (b.heroImageUrl && String(b.heroImageUrl).trim() && !rawImages.includes(String(b.heroImageUrl).trim())) {
      rawImages.unshift(String(b.heroImageUrl).trim());
    }

    if (!rawProductName && rawImages.length === 0) {
      return res.status(400).json({
        error: 'Veuillez téléverser au moins une photo du produit (ou indiquer un nom de produit).',
      });
    }

    // Resolve image binaries (from mediaAssets table, data URLs, or local public files) for Gemini Vision
    const imageParts: Array<{ inlineData: { mimeType: string; data: string } }> = [];
    const filenameHints: string[] = [];

    for (const imgUrl of rawImages.slice(0, 4)) {
      try {
        const mediaMatch = imgUrl.match(/^\/api\/media\/(\d+)$/);
        if (mediaMatch) {
          const assetId = Number(mediaMatch[1]);
          const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));
          if (asset && asset.dataBase64 && asset.mimeType.startsWith('image/')) {
            imageParts.push({
              inlineData: {
                mimeType: asset.mimeType,
                data: asset.dataBase64,
              },
            });
            const cleanedName = String(asset.filename || '')
              .replace(/\.[^.]+$/, '')
              .replace(/[-_]+/g, ' ')
              .replace(/\b(IMG|DSC|Screenshot|WhatsApp|Image|Photo|\d{6,})\b/gi, '')
              .trim();
            if (cleanedName.length >= 3) {
              filenameHints.push(cleanedName);
            }
          }
          continue;
        }

        const dataUrlMatch = imgUrl.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
        if (dataUrlMatch) {
          imageParts.push({
            inlineData: {
              mimeType: dataUrlMatch[1],
              data: dataUrlMatch[2],
            },
          });
          continue;
        }

        if (imgUrl.startsWith('/')) {
          const localPath = path.join(process.cwd(), 'public', imgUrl.replace(/^\//, ''));
          if (fs.existsSync(localPath)) {
            const buf = fs.readFileSync(localPath);
            const ext = path.extname(localPath).toLowerCase();
            const mimeType =
              ext === '.png'
                ? 'image/png'
                : ext === '.webp'
                ? 'image/webp'
                : 'image/jpeg';
            imageParts.push({
              inlineData: {
                mimeType,
                data: buf.toString('base64'),
              },
            });
          }
        }
      } catch (imgErr) {
        console.warn('Could not load image part for Gemini Vision:', imgErr);
      }
    }

    const fallbackProductName =
      rawProductName || filenameHints[0] || 'Offre Spéciale 2Frères Phone';

    const buildTemplateCopy = (detectedName = fallbackProductName) => ({
      productName: detectedName,
      title: `${detectedName} — Offre Spéciale`,
      compareAtPriceDzd,
      heroBadge: 'OFFRE LIMITÉE ALGÉRIE · LIVRAISON 58 WILAYAS',
      headline: `${detectedName} : Qualité supérieure & performance garantie au meilleur prix`,
      subheadline:
        keyInfo ||
        `Commandez dès maintenant votre ${detectedName} chez 2Frères Phone à seulement ${priceDzd} DZD. Paiement à la livraison après vérification et expédition express 24h/48h dans les 58 wilayas.`,
      ctaText: 'Commander maintenant — Paiement à la livraison',
      urgencyText: 'Offre promotionnelle en stock limité · Expédition rapide 24h/48h',
      accentColor: '#1d4ed8',
      benefits: [
        {
          title: 'Qualité Supérieure Certifiée 2Frères Phone',
          description: 'Produit testé et sélectionné avec soin pour une fiabilité maximale au quotidien.',
        },
        {
          title: 'Paiement 100 % à la Livraison (Main à Main)',
          description: 'Vous ne payez qu’à la réception de votre colis, à domicile ou en bureau Stop Desk.',
        },
        {
          title: 'Livraison Express 58 Wilayas',
          description: 'Expédition suivie sous 24h à 48h partout en Algérie avec confirmation téléphonique.',
        },
        {
          title: 'Garantie & Support Client 7j/7',
          description: 'Assistance directe par WhatsApp et téléphone par l’équipe 2Frères Phone.',
        },
      ],
      specs: [
        { label: 'Produit', value: detectedName },
        { label: 'État', value: 'Neuf sous emballage scellé' },
        { label: 'Garantie', value: 'Garantie satisfaction 2Frères Phone' },
        { label: 'Livraison', value: '58 Wilayas (À domicile & Stop Desk)' },
        { label: 'Paiement', value: `${priceDzd} DZD à la livraison` },
      ],
      testimonials: [
        {
          name: 'Amine B.',
          wilaya: 'Alger',
          rating: 5,
          comment: 'Reçu en 24h ! Exactement comme sur les photos, excellente qualité. Merci 2Frères Phone.',
        },
        {
          name: 'Sofiane K.',
          wilaya: 'Oran',
          rating: 5,
          comment: 'Très satisfait de mon achat, emballage soigné et service client très sérieux au téléphone.',
        },
        {
          name: 'Yacine M.',
          wilaya: 'Constantine',
          rating: 5,
          comment: 'Rapport qualité/prix imbattable. Je recommande à 100 %.',
        },
      ],
      faq: [
        {
          question: 'Comment se passe la commande et le paiement ?',
          answer:
            'Remplissez simplement vos coordonnées dans le formulaire sur cette page. Notre équipe vous appelle pour confirmer, puis vous payez en espèces à la réception du colis dans votre wilaya.',
        },
        {
          question: 'Le produit reçu est-il identique aux photos ?',
          answer:
            'Oui, toutes nos photos présentent fidèlement le produit expédié par 2Frères Phone avec contrôle qualité avant envoi.',
        },
        {
          question: 'Quels sont les délais de livraison dans ma wilaya ?',
          answer:
            'La livraison prend 24h à 48h pour les wilayas du Nord et 48h à 72h pour les wilayas du Sud, à domicile ou en bureau Stop Desk.',
        },
      ],
    });

    const maybeAutoPublish = async (generatedData: any, source: string) => {
      if (!autoPublish) {
        return res.json({
          generated: generatedData,
          source,
          visionAnalyzedCount: imageParts.length,
        });
      }
      const pName = String(generatedData.productName || fallbackProductName).trim();
      const title = String(generatedData.title || `${pName} — Offre Spéciale`).trim();
      const baseSlug = slugify(title);
      const existingSlug = await db.select().from(landingPages).where(eq(landingPages.slug, baseSlug));
      const finalSlug =
        existingSlug.length > 0 ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;

      const incomingColors = Array.isArray(b.colors) && b.colors.length > 0
        ? b.colors
        : Array.isArray(generatedData.colors)
        ? generatedData.colors
        : [];

      const [created] = await db
        .insert(landingPages)
        .values({
          title,
          slug: finalSlug,
          productId: b.productId ? Number(b.productId) : null,
          productName: pName,
          priceDzd,
          compareAtPriceDzd: generatedData.compareAtPriceDzd || compareAtPriceDzd,
          heroBadge: String(generatedData.heroBadge || 'OFFRE SPÉCIALE ALGÉRIE · LIVRAISON 58 WILAYAS').trim(),
          headline: String(generatedData.headline || title).trim(),
          subheadline: String(generatedData.subheadline || '').trim(),
          ctaText: String(generatedData.ctaText || 'Commander maintenant — Paiement à la livraison').trim(),
          urgencyText: String(generatedData.urgencyText || 'Stock limité · Expédition rapide 24/48h').trim(),
          heroImageUrl: rawImages[0] || null,
          galleryImagesJson: JSON.stringify(rawImages),
          colorsJson: JSON.stringify(incomingColors),
          benefitsJson: JSON.stringify(Array.isArray(generatedData.benefits) ? generatedData.benefits : []),
          specsJson: JSON.stringify(Array.isArray(generatedData.specs) ? generatedData.specs : []),
          testimonialsJson: JSON.stringify(Array.isArray(generatedData.testimonials) ? generatedData.testimonials : []),
          faqJson: JSON.stringify(Array.isArray(generatedData.faq) ? generatedData.faq : []),
          accentColor: String(generatedData.accentColor || '#1d4ed8').trim(),
          isPublished: true,
        })
        .returning();

      return res.json({
        generated: { ...generatedData, colors: incomingColors },
        landingPage: serializeLandingPage(created),
        source,
        visionAnalyzedCount: imageParts.length,
      });
    };

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey) {
      return await maybeAutoPublish(buildTemplateCopy(), 'template');
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const promptText = `Tu es PagePilot AI (propulsé par Gemini Vision), expert en création de landing pages e-commerce à très haute conversion pour le marché algérien (boutique "2Frères Phone").
${
  imageParts.length > 0
    ? `Analyse attentivement la ou les ${imageParts.length} photo(s) du produit ci-jointes. Identifie visuellement le produit exact (type d'appareil ou accessoire, marque/modèle si visible, design, connectique, fonctionnalités visibles, couleur, finition) et rédige la TOTALITÉ de la landing page de vente à partir de ces photos.`
    : ''
}
Informations fournies par le vendeur :
- Prix de vente : ${priceDzd} DZD (Ancien prix barré suggéré : ${compareAtPriceDzd} DZD)
${rawProductName ? `- Nom indiqué par le vendeur : ${rawProductName}` : `- Nom du produit : À DÉTECTER ET RÉDIGER AUTOMATIQUEMENT À PARTIR DES PHOTOS`}
${keyInfo ? `- Notes complémentaires : ${keyInfo}` : ''}
- Style marketing souhaité : ${tone}

Génère en français :
1. "productName" : Le nom commercial précis, clair et attractif du produit vu sur les photos.
2. "title" : Le titre de l'offre spéciale.
3. "heroBadge" : Un badge d'accroche court en majuscules (ex: OFFRE SPÉCIALE ALGÉRIE · LIVRAISON 58 WILAYAS).
4. "headline" : Un grand titre ultra-persuasif mettant en avant le bénéfice principal visible du produit.
5. "subheadline" : Un sous-titre rassurant mentionnant les atouts du produit, le prix de ${priceDzd} DZD, la livraison 58 wilayas et le paiement à la livraison.
6. "ctaText" : Le texte du bouton d'achat.
7. "urgencyText" : Un message d'urgence/stock limité en haut de page.
8. "accentColor" : Une couleur hexadécimale adaptée à l'univers visuel de la photo parmi "#1d4ed8" (bleu tech), "#0f172a" (noir premium), "#15803d" (vert confiance), ou "#dc2626" (rouge promo/gaming).
9. "benefits" : 4 arguments de vente concrets basés sur les caractéristiques visuelles du produit + livraison Algérie.
10. "specs" : 5 caractéristiques techniques pertinentes déduites du produit sur les photos.
11. "testimonials" : 3 avis clients algériens réalistes (avec prénom, wilaya comme Alger, Oran, Constantine, Sétif, Béjaïa et note 5/5) parlant spécifiquement de ce produit.
12. "faq" : 3 questions/réponses fréquentes adaptées à ce produit et à la livraison COD 58 wilayas.
13. "colors" : Liste des couleurs visibles sur la ou les photos du produit (ex: [{"name": "Noir Intense", "hex": "#111827"}, {"name": "Blanc", "hex": "#F8FAFC"}]).`;

      const contentsPayload =
        imageParts.length > 0 ? [...imageParts, { text: promptText }] : promptText;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: contentsPayload,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              productName: { type: Type.STRING },
              title: { type: Type.STRING },
              heroBadge: { type: Type.STRING },
              headline: { type: Type.STRING },
              subheadline: { type: Type.STRING },
              ctaText: { type: Type.STRING },
              urgencyText: { type: Type.STRING },
              accentColor: { type: Type.STRING },
              colors: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    hex: { type: Type.STRING },
                  },
                },
              },
              benefits: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    description: { type: Type.STRING },
                  },
                },
              },
              specs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    value: { type: Type.STRING },
                  },
                },
              },
              testimonials: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    wilaya: { type: Type.STRING },
                    rating: { type: Type.INTEGER },
                    comment: { type: Type.STRING },
                  },
                },
              },
              faq: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    question: { type: Type.STRING },
                    answer: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const detectedProductName = String(parsed.productName || rawProductName || fallbackProductName).trim();
      const fallback = buildTemplateCopy(detectedProductName);
      const allowedColors = ['#1d4ed8', '#15803d', '#dc2626', '#0f172a'];
      const chosenColor = allowedColors.includes(String(parsed.accentColor || '').trim())
        ? String(parsed.accentColor).trim()
        : '#1d4ed8';

      const finalGenerated = {
        productName: detectedProductName,
        title: parsed.title || fallback.title,
        compareAtPriceDzd,
        heroBadge: parsed.heroBadge || fallback.heroBadge,
        headline: parsed.headline || fallback.headline,
        subheadline: parsed.subheadline || fallback.subheadline,
        ctaText: parsed.ctaText || fallback.ctaText,
        urgencyText: parsed.urgencyText || fallback.urgencyText,
        accentColor: chosenColor,
        colors:
          Array.isArray(b.colors) && b.colors.length > 0
            ? b.colors
            : Array.isArray(parsed.colors) && parsed.colors.length > 0
            ? parsed.colors
            : [],
        benefits: Array.isArray(parsed.benefits) && parsed.benefits.length > 0 ? parsed.benefits : fallback.benefits,
        specs: Array.isArray(parsed.specs) && parsed.specs.length > 0 ? parsed.specs : fallback.specs,
        testimonials:
          Array.isArray(parsed.testimonials) && parsed.testimonials.length > 0
            ? parsed.testimonials
            : fallback.testimonials,
        faq: Array.isArray(parsed.faq) && parsed.faq.length > 0 ? parsed.faq : fallback.faq,
      };

      return await maybeAutoPublish(finalGenerated, 'gemini');
    } catch (error) {
      console.warn('PagePilot Gemini fallback to template:', error);
      return await maybeAutoPublish(buildTemplateCopy(), 'template');
    }
  });

  // Admin: Okwin AI Studio — Interpret custom background/scene prompt with Gemini (gemini-4-hydrogen)
  app.post('/api/admin/okwin/scene-prompt', requireAdmin, async (req, res) => {
    const b = req.body || {};
    const customPrompt = String(b.prompt || '').trim();
    const productName = String(b.productName || 'Produit 2Frères Phone').trim();

    const defaultVariations = [
      {
        label: 'Studio Principal',
        bgPrimary: '#0f172a',
        bgSecondary: '#1e3a8a',
        bgAccent: '#38bdf8',
        podiumColor: '#1e293b',
        glowColor: '#3b82f6',
        lightAngle: 'top-left',
        floorStyle: 'reflection',
      },
      {
        label: 'Angle Lumineux Pur',
        bgPrimary: '#f8fafc',
        bgSecondary: '#e2e8f0',
        bgAccent: '#2563eb',
        podiumColor: '#ffffff',
        glowColor: '#60a5fa',
        lightAngle: 'center',
        floorStyle: 'podium',
      },
      {
        label: 'Contraste Luxe & Or',
        bgPrimary: '#18181b',
        bgSecondary: '#27272a',
        bgAccent: '#f59e0b',
        podiumColor: '#27272a',
        glowColor: '#fbbf24',
        lightAngle: 'top-right',
        floorStyle: 'marble',
      },
      {
        label: 'Ambiance Promo Dynamique',
        bgPrimary: '#450a0a',
        bgSecondary: '#991b1b',
        bgAccent: '#f97316',
        podiumColor: '#7f1d1d',
        glowColor: '#ef4444',
        lightAngle: 'center',
        floorStyle: 'podium',
      },
    ];

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || !customPrompt) {
      return res.json({ variations: defaultVariations, source: 'preset' });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: `Tu es Okwin AI Studio, directeur artistique photo e-commerce pour "2Frères Phone".
Le vendeur souhaite modifier l'arrière-plan et générer 4 variations studio de la photo du produit "${productName}" avec ce prompt personnalisé :
"${customPrompt}"

Génère 4 variations visuelles complémentaires (codes couleurs hexadécimaux #RRGGBB valides) qui correspondent fidèlement au prompt :
- "label" : Nom court de la variation en français
- "bgPrimary" : Couleur hex principale du fond
- "bgSecondary" : Couleur hex secondaire du dégradé
- "bgAccent" : Couleur hex du halo / néon / lumière d'accentuation
- "podiumColor" : Couleur hex du podium ou surface sous le produit
- "glowColor" : Couleur hex de la lueur derrière le produit
- "lightAngle" : "top-left" | "center" | "top-right"
- "floorStyle" : "podium" | "reflection" | "marble" | "neon-grid"`,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              variations: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    label: { type: Type.STRING },
                    bgPrimary: { type: Type.STRING },
                    bgSecondary: { type: Type.STRING },
                    bgAccent: { type: Type.STRING },
                    podiumColor: { type: Type.STRING },
                    glowColor: { type: Type.STRING },
                    lightAngle: { type: Type.STRING },
                    floorStyle: { type: Type.STRING },
                  },
                },
              },
            },
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const variations =
        Array.isArray(parsed.variations) && parsed.variations.length > 0
          ? parsed.variations
          : defaultVariations;
      return res.json({ variations, source: 'gemini' });
    } catch (err) {
      console.warn('Okwin Gemini prompt fallback:', err);
      return res.json({ variations: defaultVariations, source: 'preset' });
    }
  });

  // Admin: Okwin AI Studio — Analyze non-white / complex background photo with Gemini Vision to return a subject contour polygon
  app.post('/api/admin/okwin/analyze-subject', requireAdmin, async (req, res) => {
    const b = req.body || {};
    const imageBase64 = String(b.imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const mimeType = String(b.mimeType || 'image/jpeg');
    const productName = String(b.productName || 'Produit').trim();

    const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
    if (!apiKey || !imageBase64) {
      return res.json({ polygon: null, source: 'local' });
    }

    try {
      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: [
          {
            inlineData: {
              mimeType,
              data: imageBase64,
            },
          },
          {
            text: `Identify the main foreground product ("${productName}") in this photo and trace its outer silhouette boundary as a tight polygon of 12 to 20 points in clockwise order.
Return normalized coordinates where x and y are floats between 0.0 and 1.0 (0,0 is top-left, 1,1 is bottom-right). Exclude table surfaces, walls, shelves, and background clutter.`,
          },
        ],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              polygon: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    x: { type: Type.NUMBER },
                    y: { type: Type.NUMBER },
                  },
                  required: ['x', 'y'],
                },
              },
            },
            required: ['polygon'],
          },
        },
      });

      const parsed = JSON.parse((response.text ?? '{}').trim());
      const rawPoly = Array.isArray(parsed.polygon) ? parsed.polygon : [];
      const cleanPoly = rawPoly
        .map((pt: any) => ({
          x: Math.max(0, Math.min(1, Number(pt?.x) || 0)),
          y: Math.max(0, Math.min(1, Number(pt?.y) || 0)),
        }))
        .filter((pt: { x: number; y: number }) => Number.isFinite(pt.x) && Number.isFinite(pt.y));

      return res.json({
        polygon: cleanPoly.length >= 4 ? cleanPoly : null,
        source: 'gemini-vision',
      });
    } catch (err) {
      console.warn('Okwin Gemini Vision polygon fallback to local edge-barrier:', err);
      return res.json({ polygon: null, source: 'local' });
    }
  });

  // Admin: create landing page
  app.post('/api/admin/landing-pages', requireAdmin, async (req, res) => {
    try {
      const b = req.body || {};
      const productName = String(b.productName || b.title || '').trim();
      if (!productName) {
        return res.status(400).json({ error: 'Le nom du produit est obligatoire.' });
      }
      const title = String(b.title || productName).trim();
      const baseSlug = slugify(String(b.slug || title));
      const existingSlug = await db.select().from(landingPages).where(eq(landingPages.slug, baseSlug));
      const finalSlug =
        existingSlug.length > 0 ? `${baseSlug}-${Math.floor(100 + Math.random() * 900)}` : baseSlug;

      const [created] = await db
        .insert(landingPages)
        .values({
          title,
          slug: finalSlug,
          productId: b.productId ? Number(b.productId) : null,
          productName,
          priceDzd: Math.max(0, Math.round(Number(b.priceDzd) || 0)),
          compareAtPriceDzd:
            b.compareAtPriceDzd !== undefined && b.compareAtPriceDzd !== '' && b.compareAtPriceDzd !== null
              ? Math.max(0, Math.round(Number(b.compareAtPriceDzd)))
              : null,
          heroBadge: String(b.heroBadge || 'Offre Spéciale Algérie · Livraison 58 Wilayas').trim(),
          headline: String(b.headline || title).trim(),
          subheadline: String(b.subheadline || '').trim(),
          ctaText: String(b.ctaText || 'Commander maintenant — Paiement à la livraison').trim(),
          urgencyText: String(b.urgencyText || 'Stock limité · Expédition rapide 24/48h').trim(),
          heroImageUrl: b.heroImageUrl ? String(b.heroImageUrl).trim() : null,
          galleryImagesJson: JSON.stringify(Array.isArray(b.galleryImages) ? b.galleryImages : []),
          colorsJson: JSON.stringify(Array.isArray(b.colors) ? b.colors : []),
          benefitsJson: JSON.stringify(Array.isArray(b.benefits) ? b.benefits : []),
          specsJson: JSON.stringify(Array.isArray(b.specs) ? b.specs : []),
          testimonialsJson: JSON.stringify(Array.isArray(b.testimonials) ? b.testimonials : []),
          faqJson: JSON.stringify(Array.isArray(b.faq) ? b.faq : []),
          accentColor: String(b.accentColor || '#1d4ed8').trim(),
          isPublished: b.isPublished !== false,
        })
        .returning();

      return res.status(201).json({ landingPage: serializeLandingPage(created) });
    } catch (error) {
      console.error('Create landing page error:', error);
      return res.status(400).json({ error: 'Erreur lors de la création de la landing page.' });
    }
  });

  // Admin: update landing page
  app.patch('/api/admin/landing-pages/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      const [existing] = await db.select().from(landingPages).where(eq(landingPages.id, id));
      if (!existing) return res.status(404).json({ error: 'Landing page introuvable.' });

      const b = req.body || {};
      const nextSlug =
        b.slug && String(b.slug).trim() ? slugify(String(b.slug).trim()) : existing.slug;

      const [updated] = await db
        .update(landingPages)
        .set({
          title: b.title !== undefined ? String(b.title).trim() : existing.title,
          slug: nextSlug,
          productId:
            b.productId !== undefined ? (b.productId ? Number(b.productId) : null) : existing.productId,
          productName: b.productName !== undefined ? String(b.productName).trim() : existing.productName,
          priceDzd:
            b.priceDzd !== undefined ? Math.max(0, Math.round(Number(b.priceDzd) || 0)) : existing.priceDzd,
          compareAtPriceDzd:
            b.compareAtPriceDzd !== undefined
              ? b.compareAtPriceDzd !== '' && b.compareAtPriceDzd !== null
                ? Math.max(0, Math.round(Number(b.compareAtPriceDzd)))
                : null
              : existing.compareAtPriceDzd,
          heroBadge: b.heroBadge !== undefined ? String(b.heroBadge).trim() : existing.heroBadge,
          headline: b.headline !== undefined ? String(b.headline).trim() : existing.headline,
          subheadline: b.subheadline !== undefined ? String(b.subheadline).trim() : existing.subheadline,
          ctaText: b.ctaText !== undefined ? String(b.ctaText).trim() : existing.ctaText,
          urgencyText: b.urgencyText !== undefined ? String(b.urgencyText).trim() : existing.urgencyText,
          heroImageUrl:
            b.heroImageUrl !== undefined
              ? b.heroImageUrl
                ? String(b.heroImageUrl).trim()
                : null
              : existing.heroImageUrl,
          galleryImagesJson:
            b.galleryImages !== undefined ? JSON.stringify(b.galleryImages) : existing.galleryImagesJson,
          colorsJson:
            b.colors !== undefined ? JSON.stringify(Array.isArray(b.colors) ? b.colors : []) : existing.colorsJson,
          benefitsJson: b.benefits !== undefined ? JSON.stringify(b.benefits) : existing.benefitsJson,
          specsJson: b.specs !== undefined ? JSON.stringify(b.specs) : existing.specsJson,
          testimonialsJson:
            b.testimonials !== undefined ? JSON.stringify(b.testimonials) : existing.testimonialsJson,
          faqJson: b.faq !== undefined ? JSON.stringify(b.faq) : existing.faqJson,
          accentColor: b.accentColor !== undefined ? String(b.accentColor).trim() : existing.accentColor,
          isPublished: b.isPublished !== undefined ? Boolean(b.isPublished) : existing.isPublished,
          updatedAt: new Date(),
        })
        .where(eq(landingPages.id, id))
        .returning();

      return res.json({ landingPage: serializeLandingPage(updated) });
    } catch (error) {
      console.error('Update landing page error:', error);
      return res.status(400).json({ error: 'Erreur lors de la mise à jour de la landing page.' });
    }
  });

  // Admin: delete landing page
  app.delete('/api/admin/landing-pages/:id', requireAdmin, async (req, res) => {
    try {
      const id = Number(req.params.id);
      await db.delete(landingPages).where(eq(landingPages.id, id));
      return res.json({ deleted: true });
    } catch (error) {
      return res.status(500).json({ error: 'Erreur lors de la suppression de la landing page.' });
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


