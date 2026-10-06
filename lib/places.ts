/** Tamanho máximo do local (mesmo check posts_location_len, 0020). */
export const PLACE_MAX = 60;

/**
 * Letras com acento e a versão sem, na mesma ordem. É a mesma tabela do translate de
 * public.place_key (0020_post_location.sql): app e banco chegam na mesma chave.
 */
export const ACCENTS_FROM = 'áàâãäåāéèêëēíìîïīóòôõöōúùûüūçñý';
export const ACCENTS_TO = 'aaaaaaaeeeeeiiiiioooooouuuuucny';

const TO = Array.from(ACCENTS_TO);
const STRIP = new Map(Array.from(ACCENTS_FROM, (c, i) => [c, TO[i]] as const));

/** Local como vai pro banco: sem espaços nas pontas nem repetidos; vazio vira null (igual ao gatilho). */
export function cleanPlace(raw: string | null | undefined): string | null {
  const text = (raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  return text || null;
}

/** Chave do local (igual a public.place_key): "Bar do Zé" e "bar do ze" viram "bar do ze". */
export function placeKey(raw: string | null | undefined): string {
  const text = cleanPlace(raw);
  if (!text) return '';
  return Array.from(text.toLowerCase(), (c) => STRIP.get(c) ?? c).join('');
}
