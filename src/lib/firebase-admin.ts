import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export interface VerifiedFirebaseToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  sub: string;
  aud: string;
  iss: string;
  iat: number;
  exp: number;
}

const GOOGLE_CERTS_URL =
  'https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com';

let cachedCerts: Record<string, string> | null = null;
let cachedCertsExpiresAt = 0;

export function resolveFirebaseProjectId(): string {
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

async function fetchGooglePublicCerts(forceRefresh = false): Promise<Record<string, string>> {
  const now = Date.now();
  if (!forceRefresh && cachedCerts && now < cachedCertsExpiresAt) {
    return cachedCerts;
  }

  const res = await fetch(GOOGLE_CERTS_URL);
  if (!res.ok) {
    throw new Error(`Impossible de récupérer les certificats publics Google (${res.status}).`);
  }

  const certs = (await res.json()) as Record<string, string>;
  const cacheControl = res.headers.get('cache-control') || '';
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/i);
  const maxAgeSec = maxAgeMatch ? Number(maxAgeMatch[1]) : 3600;

  cachedCerts = certs;
  cachedCertsExpiresAt = now + Math.max(60, maxAgeSec) * 1000;
  return certs;
}

function decodeBase64UrlJson<T = Record<string, unknown>>(segment: string): T {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
  const raw = Buffer.from(padded, 'base64').toString('utf8');
  return JSON.parse(raw) as T;
}

/**
 * Cryptographically verifies a Firebase Auth ID Token (RS256 JWT) directly
 * against Google's official X.509 public certificates.
 * Works identically on Vercel Serverless (AWS Lambda) and Google Cloud Run
 * without requiring GCP Application Default Credentials or service account keys.
 */
export async function verifyFirebaseIdToken(idToken: string): Promise<VerifiedFirebaseToken> {
  const parts = idToken.split('.');
  if (parts.length !== 3) {
    throw new Error('Format de jeton Firebase invalide.');
  }

  const [headerB64, payloadB64, signatureB64] = parts;
  const header = decodeBase64UrlJson<{ alg?: string; kid?: string }>(headerB64);
  const payload = decodeBase64UrlJson<VerifiedFirebaseToken>(payloadB64);

  if (header.alg !== 'RS256' || !header.kid) {
    throw new Error('Algorithme ou identifiant de clé JWT non autorisé.');
  }

  let certs = await fetchGooglePublicCerts(false);
  let cert = certs[header.kid];
  if (!cert) {
    // Key rotation: retry once with fresh Google public certificates
    certs = await fetchGooglePublicCerts(true);
    cert = certs[header.kid];
  }
  if (!cert) {
    throw new Error('Certificat public Google introuvable pour ce jeton.');
  }

  const verifier = crypto.createVerify('RSA-SHA256');
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();

  const normalizedSig = signatureB64.replace(/-/g, '+').replace(/_/g, '/');
  const sigBuf = Buffer.from(
    normalizedSig + '='.repeat((4 - (normalizedSig.length % 4)) % 4),
    'base64',
  );

  const isValidSignature = verifier.verify(cert, sigBuf);
  if (!isValidSignature) {
    throw new Error('Signature cryptographique du jeton Firebase invalide.');
  }

  const projectId = resolveFirebaseProjectId();
  const expectedIssuer = `https://securetoken.google.com/${projectId}`;
  const nowSec = Math.floor(Date.now() / 1000);

  if (payload.aud !== projectId) {
    throw new Error(`Audience Firebase invalide (${payload.aud}).`);
  }
  if (payload.iss !== expectedIssuer) {
    throw new Error(`Émetteur Firebase invalide (${payload.iss}).`);
  }
  if (!payload.sub || typeof payload.sub !== 'string') {
    throw new Error('Identifiant utilisateur Firebase manquant.');
  }
  if (typeof payload.exp !== 'number' || payload.exp <= nowSec - 60) {
    throw new Error('Jeton Firebase expiré.');
  }
  if (typeof payload.iat !== 'number' || payload.iat > nowSec + 300) {
    throw new Error('Horodatage du jeton Firebase invalide.');
  }

  return {
    ...payload,
    uid: payload.sub,
  };
}
