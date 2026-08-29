import { build } from 'esbuild';

await build({
  bundle: true,
  entryPoints: ['server.ts'],
  format: 'cjs',
  outfile: 'dist/server.cjs',
  packages: 'external',
  platform: 'node',
  sourcemap: true,
});
