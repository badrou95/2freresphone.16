// Resilient zero-top-level-import Vercel Serverless entry point
let cachedApp = null;

export default async function handler(req, res) {
  try {
    if (!cachedApp) {
      const mod = await import('./_app.mjs');
      cachedApp = mod.default;
    }
    return cachedApp(req, res);
  } catch (err) {
    console.error('VERCEL_API_BOOT_ERROR:', err);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(
      JSON.stringify({
        error: `Erreur serveur API : ${err?.message || String(err)}`,
        code: err?.code || null,
      }),
    );
  }
}
