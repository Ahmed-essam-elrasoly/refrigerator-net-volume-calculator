import * as esbuild from 'esbuild';
import fs from 'fs';

async function buildStandalone() {
  const jsResult = await esbuild.build({
    entryPoints: ['src/js/main.js'],
    bundle: true,
    write: false,
    format: 'iife',
    platform: 'browser',
    target: 'es2020',
    minify: true,
  });

  // 1. Escape </script> tags that might exist inside external libraries (like SheetJS)
  // This prevents the browser HTML parser from closing the tag prematurely.
  const jsCode = jsResult.outputFiles[0].text.replace(/<\/script>/g, '<\\/script>');
  const cssCode = fs.readFileSync('src/css/style.css', 'utf-8');

  let html = fs.readFileSync('src/index.html', 'utf-8');

  // 2. Inject CSS safely using a replacer function
  html = html.replace(
    /<link rel="stylesheet" href="css\/style\.css">/,
    () => `<style>\n${cssCode}\n</style>`
  );

  // 3. Inject JS safely using a replacer function
  // This prevents String.replace from corrupting minified variables containing "$"
  html = html.replace(
    /<script type="module" src="js\/main\.js"><\/script>/,
    () => `<script>\n${jsCode}\n</script>`
  );

  fs.writeFileSync('Refrigerator_Calculator.html', html);
  console.log('✅ Standalone app created successfully: Refrigerator_Calculator.html');
}

buildStandalone().catch((err) => {
  console.error(err);
  process.exit(1);
});