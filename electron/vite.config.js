import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  root: path.join(__dirname, 'src'), // index.html burada
  base: './',                        // prod’da relative asset yüklemesi
  build: {
    outDir: path.join(__dirname, 'dist'),
    emptyOutDir: true
  }
});
