import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/js/main.js'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: false,           // set true for smaller size later
  sourcemap: false,
});

console.log('✅ Bundle written to dist/bundle.js');