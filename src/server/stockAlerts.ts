import { and, eq } from 'drizzle-orm';
import { db } from '../db/index.ts';
import { products, stockAlerts, storeSettings } from '../db/schema.ts';
import { computeEffectiveLowStockThreshold, isLowStock } from '../shared/domain.ts';
import { sendLowStockAlertEmail } from './emailService.ts';

export async function evaluateProductLowStock(productId: number) {
  const [product] = await db.select().from(products).where(eq(products.id, productId));
  if (!product) return null;

  const [settings] = await db.select().from(storeSettings).limit(1);
  const globalThreshold = settings?.defaultLowStockThreshold ?? 10;
  const threshold = computeEffectiveLowStockThreshold(product.lowStockThreshold, globalThreshold);
  const recipient = settings?.adminAlertEmail || process.env.INITIAL_ADMIN_EMAIL || 'badroumc@gmail.com';
  const storeName = settings?.storeName || '2Frères Phone';

  const low = product.isActive && isLowStock(product.stockQuantity, product.lowStockThreshold, globalThreshold, product.productType);

  const existingActive = await db
    .select()
    .from(stockAlerts)
    .where(and(eq(stockAlerts.productId, product.id), eq(stockAlerts.status, 'active')));

  if (!low) {
    if (existingActive.length > 0) {
      await db
        .update(stockAlerts)
        .set({
          status: 'resolved',
          currentStock: product.stockQuantity,
          resolvedAt: new Date(),
        })
        .where(and(eq(stockAlerts.productId, product.id), eq(stockAlerts.status, 'active')));
    }
    return null;
  }

  // Already active alert -> update current stock count without spamming duplicate email unless dropped to 0 from >0
  if (existingActive.length > 0) {
    const active = existingActive[0];
    const droppedToZero = active.currentStock > 0 && product.stockQuantity === 0;
    let emailStatus = active.emailStatus;
    let emailError = active.emailError;

    if (droppedToZero) {
      const dispatch = await sendLowStockAlertEmail({
        recipientEmail: recipient,
        storeName,
        productName: product.name,
        productSku: product.sku,
        currentStock: product.stockQuantity,
        thresholdUsed: threshold,
      });
      emailStatus = dispatch.status;
      emailError = dispatch.error || null;
    }

    const [updated] = await db
      .update(stockAlerts)
      .set({
        productName: product.name,
        productSku: product.sku,
        currentStock: product.stockQuantity,
        thresholdUsed: threshold,
        emailStatus,
        emailRecipient: recipient,
        emailError,
      })
      .where(eq(stockAlerts.id, active.id))
      .returning();
    return updated;
  }

  // New low stock event -> dispatch email notification to admin and record alert
  const dispatch = await sendLowStockAlertEmail({
    recipientEmail: recipient,
    storeName,
    productName: product.name,
    productSku: product.sku,
    currentStock: product.stockQuantity,
    thresholdUsed: threshold,
  });

  const [created] = await db
    .insert(stockAlerts)
    .values({
      productId: product.id,
      productName: product.name,
      productSku: product.sku,
      currentStock: product.stockQuantity,
      thresholdUsed: threshold,
      status: 'active',
      emailStatus: dispatch.status,
      emailRecipient: recipient,
      emailError: dispatch.error || null,
    })
    .returning();

  return created;
}

export async function syncAllLowStockAlerts() {
  const allProducts = await db.select({ id: products.id }).from(products);
  for (const p of allProducts) {
    await evaluateProductLowStock(p.id);
  }
}
