import { defineConfig } from 'vite';
import path from 'node:path';

export default defineConfig({
  root: path.resolve(__dirname, 'renderer'),
  base: './',
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      input: path.resolve(__dirname, 'renderer/index.html')
    }
  },
  resolve: {
    alias: {
      ol: path.resolve(__dirname, 'node_modules/ol')
    }
  }
});
