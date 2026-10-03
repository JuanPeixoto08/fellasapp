/**
 * Dados brutos dos emojis (pt), em um chunk separado: o `import()` tira ~580 KB do bundle inicial.
 * Isolado aqui porque o Jest não roda `import()` dinâmico; o jest.setup troca por `require`.
 */
export function loadRawEmojis(): Promise<unknown> {
  return import('emojibase-data/pt/compact.json').then((mod) => mod.default ?? mod);
}
