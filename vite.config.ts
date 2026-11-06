import { defineConfig } from 'vitest/config';
import vue from '@vitejs/plugin-vue';
import { viteSingleFile } from 'vite-plugin-singlefile';
import { fileURLToPath } from 'node:url';

const dir = (p: string) => fileURLToPath(new URL(p, import.meta.url));

// The build inlines all JS and CSS into dist/index.html, so the dashboard
// still opens straight from the file system (file://) with no server.
export default defineConfig({
  base: './',
  plugins: [vue(), viteSingleFile()],
  // Import paths by area instead of ../../ (mirrored in tsconfig.json "paths").
  resolve: {
    alias: {
      '@core': dir('./src/core'),
      '@features': dir('./src/features'),
      '@sources': dir('./src/sources'),
      '@components': dir('./src/components'),
      '@': dir('./src'),
    },
  },
  build: { target: 'es2022', outDir: 'dist', emptyOutDir: true },
  // Unit tests live in tests/; each source's parser tests sit next to it, with saved replies in fixtures/.
  test: { environment: 'node', include: ['tests/**/*.test.ts', 'src/**/*.test.ts'] },
});
