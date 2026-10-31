import { resolve } from 'node:path';
import { defineConfig } from 'vite';

// GitHub Pages serves the site from /<repo>/, so the workflow sets BASE_PATH. Locally it is /.
export default defineConfig({
  base: process.env.BASE_PATH || '/',
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        download: resolve(import.meta.dirname, 'download/index.html'),
      },
    },
  },
});
