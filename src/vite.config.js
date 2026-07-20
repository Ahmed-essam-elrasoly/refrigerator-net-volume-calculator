import { defineConfig } from 'vite';

export default defineConfig({
  // Serve files from the current root directory
  root: '.', 
  // CRITICAL: This ensures asset paths are relative so they work in an offline .exe
  base: './', 
  
  server: {
    port: 3000,
    open: true, // Automatically open the app in the default browser when started
  },
  
  build: {
    // Output optimized production files to the 'dist' directory
    outDir: 'dist',
    emptyOutDir: true,
    
    // Generate source maps for easier debugging in production
    sourcemap: true,
    
    // Minify the output to save space and load faster
    minify: 'esbuild'
  }
});