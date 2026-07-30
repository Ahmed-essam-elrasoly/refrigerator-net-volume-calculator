import * as esbuild from 'esbuild';
import fs from 'fs';

async function buildStandalone() {
  console.log('Building standalone offline app...');

  // 1. Build the JS bundle in memory (do not write to disk)
  const jsResult = await esbuild.build({
    entryPoints: ['src/js/main.js'],
    bundle: true,
    write: false, 
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true, // Minifying keeps the single file size down
  });
  
  // Extract the bundled JavaScript code
  const jsCode = jsResult.outputFiles[0].text;

  // 2. Read the CSS file
  const cssCode = fs.readFileSync('src/css/style.css', 'utf-8');

  // 3. Read the HTML template
  let html = fs.readFileSync('src/index.html', 'utf-8');

  // 4. Inject CSS and JS directly into the HTML
  html = html.replace(
    '<link rel="stylesheet" href="css/style.css">',
    `<style>\n${cssCode}\n</style>`
  );

  html = html.replace(
    '<script type="module" src="js/main.js"></script>',
    `<script>\n${jsCode}\n</script>`
  );

  // 5. Write the final single-file application to your root directory
  fs.writeFileSync('Refrigerator_Calculator.html', html);
  console.log('✅ Standalone app created: Refrigerator_Calculator.html');
}

buildStandalone().catch((err) => {
  console.error(err);
  process.exit(1);
});