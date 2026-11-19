import type { Request, Response, NextFunction } from 'express';
import { eq } from 'drizzle-orm';
import { verifyFirebaseIdToken, type VerifiedFirebaseToken } from '../lib/firebase-admin.ts';
import { db } from '../db/index.ts';
import { adminUsers } from '../db/schema.ts';

export interface AuthRequest extends Request {
  user?: VerifiedFirebaseToken;
  adminUser?: typeof adminUsers.$inferSelect;
}

const INITIAL_ADMIN_EMAILS = Array.from(
  new Set(
    [
      (process.env.INITIAL_ADMIN_EMAIL || 'badroumc@gmail.com').toLowerCase(),
      'badroumc@gmail.com',
      'tigrine156@gmail.com',
    ].filter(Boolean),
  ),
);

export async function getOrCreateAdminRecord(decoded: VerifiedFirebaseToken) {
  const email = (decoded.email || '').toLowerCase();
  if (!email) return null;

  const existing = await db
    .select()
    .from(adminUsers)
    .where(eq(adminUsers.email, email));

  if (existing.length > 0) {
    const rec = existing[0];
    if (!rec.isActive) return null;
    if (!rec.uid) {
      const [updated] = await db
        .update(adminUsers)
        .set({
          uid: decoded.uid,
          fullName: decoded.name || rec.fullName,
        })
        .where(eq(adminUsers.id, rec.id))
        .returning();
      return updated;
    }
    return rec;
  }

  // Auto-provision the initial admin emails configured for the store co-owners
  if (INITIAL_ADMIN_EMAILS.includes(email)) {
    const [created] = await db
      .insert(adminUsers)
      .values({
        uid: decoded.uid,
        email,
        fullName: decoded.name || 'Administrateur 2Frères Phone',
        role: 'super_admin',
        isActive: true,
      })
      .onConflictDoUpdate({
        target: adminUsers.email,
        set: {
          uid: decoded.uid,
          fullName: decoded.name || 'Administrateur 2Frères Phone',
        },
      })
      .returning();
    return created;
  }

  return null;
}

export const requireAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentification administrateur requise.' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = await verifyFirebaseIdToken(token);
    req.user = decoded;

    const admin = await getOrCreateAdminRecord(decoded);
    if (!admin) {
      return res.status(403).json({
        error: `Accès refusé : le compte ${decoded.email || ''} n'est pas autorisé sur le back-office 2Frères Phone.`,
      });
    }

    req.adminUser = admin;
    next();
  } catch (error) {
    console.error('Admin auth verification failed:', error);
    return res.status(401).json({ error: 'Session invalide ou expirée. Veuillez vous reconnecter.' });
  }
};
