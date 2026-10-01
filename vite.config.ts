import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  define:{__HF_BUILD_ID__:JSON.stringify(process.env.VERCEL_URL || `local-${new Date().toISOString()}`),__HF_RULES_HASH__:JSON.stringify(createHash('sha256').update(readFileSync('firestore.rules')).digest('hex'))},
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          // 三份卡片 JSON（約 430KB）被多個 Provider 靜態 import，一定會進主要
          // 進入點；拆成獨立 chunk 讓瀏覽器並行下載，且這份資料很少變動，之後
          // 改版時可以沿用瀏覽器快取，不用每次都重抓。
          if (id.includes('/src/data/cards/') || id.endsWith('/src/constants/cards.ts')) {
            return 'card-data';
          }
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
});
