/**
 * Emojis desenhados pelo próprio app (Twemoji, gráficos CC-BY 4.0 — crédito no README): iguais no
 * Windows, iPhone e Android, com bandeiras de verdade. PNG porque o <Image> do celular não lê SVG.
 */
const BASE = 'https://cdn.jsdelivr.net/gh/jdecked/twemoji@16.0.1/assets/72x72/';
const ZWJ = 0x200d;
const VS16 = 0xfe0f;

/** Nome do arquivo no padrão do Twemoji: código em hexa; o seletor FE0F só fica em sequência com ZWJ. */
export function twemojiUrl(emoji: string): string {
  const points = Array.from(emoji).map((c) => c.codePointAt(0) ?? 0);
  const keep = points.includes(ZWJ) ? points : points.filter((p) => p !== VS16);
  return `${BASE}${keep.map((p) => p.toString(16)).join('-')}.png`;
}
