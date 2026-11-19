import fs from 'fs';

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  if (fs.existsSync('api/_app.mjs')) {
    console.log('esbuild not hoisted; keeping pre-built api/_app.mjs.');
    process.exit(0);
  }
  throw new Error('esbuild not found and api/_app.mjs is missing.');
}

await esbuild.build({
  entryPoints: ['src/vercel-entry.ts'],
  outfile: 'api/_app.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  define: {
    'process.env.VERCEL': '"1"',
  },
  banner: {
    js: '// Auto-generated pure ESM Express bundle for Vercel Serverless Functions',
  },
});

console.log('Built api/_app.mjs successfully.');
