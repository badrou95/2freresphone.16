import fs from 'fs';

let esbuild;
try {
  esbuild = await import('esbuild');
} catch {
  if (fs.existsSync('api/index.mjs')) {
    console.log('esbuild not hoisted; keeping pre-built api/index.mjs.');
    process.exit(0);
  }
  throw new Error('esbuild not found and api/index.mjs is missing.');
}

await esbuild.build({
  entryPoints: ['src/vercel-entry.ts'],
  outfile: 'api/index.mjs',
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  packages: 'external',
  define: {
    'process.env.VERCEL': '"1"',
  },
  banner: {
    js: '// Auto-generated pure ESM bundle for Vercel Serverless Functions (zero .ts imports at runtime)',
  },
});

console.log('Built api/index.mjs successfully.');
