import fs from 'fs';
import path from 'path';
import type { Auth } from 'firebase-admin/auth';

function resolveFirebaseProjectId(): string {
  if (process.env.FIREBASE_PROJECT_ID) {
    return process.env.FIREBASE_PROJECT_ID;
  }
  const candidates = [
    path.resolve(process.cwd(), 'firebase-applet-config.json'),
    path.resolve(process.cwd(), '..', 'firebase-applet-config.json'),
  ];
  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        if (parsed?.projectId) return String(parsed.projectId);
      }
    } catch {
      // ignore and try fallback
    }
  }
  return 'xenon-tempest-nq7xb';
}

let cachedAuth: Auth | null = null;

export async function getAdminAuth(): Promise<Auth> {
  if (cachedAuth) return cachedAuth;
  const { initializeApp, getApps } = await import('firebase-admin/app');
  const { getAuth } = await import('firebase-admin/auth');
  if (!getApps().length) {
    initializeApp({
      projectId: resolveFirebaseProjectId(),
    });
  }
  cachedAuth = getAuth();
  return cachedAuth;
}
