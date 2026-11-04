import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';

// The build inlines all JS and CSS into dist/index.html, so the dashboard
// still opens straight from the file system (file://) with no server.
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});
