/**
 * Regra das #tags (igual à do banco, 0016_post_tags.sql): '#' no começo ou depois de algo que não é
 * letra/número/_/#//, 2 a 30 letras (com acento), números ou _, sem continuar colado. Minúsculas.
 */
export const TAG_MIN = 2;
export const TAG_MAX = 30;

export const TAG_RE = /(^|[^\p{L}\p{N}_#/])#([\p{L}\p{N}_]{2,30})(?![\p{L}\p{N}_])/gu;
const TAG_CHARS = /^[\p{L}\p{N}_]*$/u;
const GLUE = /[\p{L}\p{N}_#/]/u;

export function normalizeTag(raw: string): string {
  return raw.replace(/^#/, '').normalize('NFC').toLowerCase();
}

/** Tags do texto, na ordem em que aparecem, sem repetir. */
export function extractTags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.normalize('NFC').matchAll(TAG_RE)) seen.add(normalizeTag(match[2]));
  return [...seen];
}

/** # que está sendo digitado: posição do # e o que veio depois dele até o cursor. */
export type ActiveTag = { start: number; query: string };

/** A # antes do cursor, se a pessoa está no meio de uma tag ("olha #ar|"). */
export function activeTag(text: string, cursor: number): ActiveTag | null {
  const before = text.slice(0, cursor);
  const hash = before.lastIndexOf('#');
  if (hash < 0) return null;
  const query = before.slice(hash + 1);
  if (query.length > TAG_MAX || !TAG_CHARS.test(query)) return null;
  if (hash > 0 && GLUE.test(before[hash - 1])) return null;
  return { start: hash, query };
}

/** Troca o #parcial pela tag escolhida; põe um espaço depois se não houver. */
export function insertTag(text: string, active: ActiveTag, tag: string): string {
  const end = active.start + 1 + active.query.length;
  const rest = text.slice(end);
  return `${text.slice(0, active.start)}#${tag}${rest.startsWith(' ') ? '' : ' '}${rest}`;
}
