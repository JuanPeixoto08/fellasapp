// Páginas dos jogos, publicadas em /games/<jogo>/ junto com o app (dist/).
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/games/',
  envPrefix: 'EXPO_PUBLIC_', // mesmos segredos do build do app
  envDir: resolve(import.meta.dirname, '..'), // lê o .env da raiz no dev
  // dev: o ?mock lê as migrações em ../supabase; o PGlite (wasm) não passa pelo pré-empacotamento
  server: { fs: { allow: ['..'] } },
  optimizeDeps: { exclude: ['@electric-sql/pglite'] },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 900, // three.js + supabase-js numa página só (~205 KB comprimido)
    outDir: resolve(import.meta.dirname, '../dist/games'),
    emptyOutDir: false, // o dist/ é do Expo: nunca apagar
    rollupOptions: { input: { blackjack: resolve(import.meta.dirname, 'blackjack/index.html') } },
  },
});
