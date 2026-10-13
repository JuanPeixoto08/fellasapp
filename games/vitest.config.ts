import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['**/*.test.ts'],
    exclude: ['node_modules/**'],
    testTimeout: 20000,
    // no CI (máquina mais lenta) testes de relógio de verdade estouram por milésimos: uma segunda chance antes de
    // reprovar o deploy. Local continua sem repetir, pra falha de verdade aparecer na hora.
    retry: process.env.CI ? 1 : 0,
  },
});
