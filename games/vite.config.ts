// Páginas dos jogos, publicadas em /games/<jogo>/ junto com o app (dist/).
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/games/',
  envPrefix: 'EXPO_PUBLIC_', // mesmos segredos do build do app
  envDir: resolve(__dirname, '..'), // lê o .env da raiz no dev
  build: {
    outDir: resolve(__dirname, '../dist/games'),
    emptyOutDir: false, // o dist/ é do Expo: nunca apagar
    rollupOptions: { input: { blackjack: resolve(__dirname, 'blackjack/index.html') } },
  },
});
