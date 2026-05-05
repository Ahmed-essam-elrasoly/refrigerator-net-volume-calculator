import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

// Build the bundle
await esbuild.build({
  entryPoints: ['src/js/main.js'],
  bundle: true,
  outfile: 'dist/bundle.js',
  format: 'iife',
  platform: 'browser',
  target: 'es2020',
  minify: false,
  sourcemap: false,
});

console.log('✅ Bundle written to dist/bundle.js');

// Copy index.html from src to dist, replacing the module script tag
let html = fs.readFileSync('src/index.html', 'utf-8');
html = html.replace(
  '<script type="module" src="js/main.js"></script>',
  '<script src="bundle.js"></script>'
);
fs.writeFileSync('dist/index.html', html);
console.log('✅ dist/index.html updated with production script tag');

// Copy CSS folder
const copyDir = (src, dest) => {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
};
copyDir('src/css', 'dist/css');
console.log('✅ dist/css folder copied');