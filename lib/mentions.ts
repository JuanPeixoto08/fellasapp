import { normalizeTag, TAG_RE } from './tags';

/** Um fella que pode ser marcado com @usuario. */
export type MentionMember = { id: string; username: string; name: string; avatarUrl: string | null };

/** @ que está sendo digitado: posição do @ e o que veio depois dele até o cursor. */
export type ActiveMention = { start: number; query: string };

/** Mesmo formato de profiles.username (0001_init.sql). */
const USERNAME_CHARS = /^[a-z0-9_]*$/i;
const MENTION = /(^|[^a-z0-9_@])@([a-z0-9_]{3,30})(?![a-z0-9_])/gi;

/**
 * O @ antes do cursor, se a pessoa está no meio de uma menção ("oi @an|"). Não conta e-mail (letra
 * colada antes do @) nem depois de um espaço.
 */
export function activeMention(text: string, cursor: number): ActiveMention | null {
  const before = text.slice(0, cursor);
  const at = before.lastIndexOf('@');
  if (at < 0) return null;
  const query = before.slice(at + 1);
  if (!USERNAME_CHARS.test(query) || query.length > 30) return null;
  if (at > 0 && /[a-z0-9_]/i.test(before[at - 1])) return null;
  return { start: at, query };
}

const fold = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

/** Fellas que combinam com o que foi digitado: começo do usuário, do nome ou de uma palavra do nome. */
export function suggestMembers<M extends MentionMember>(members: M[], query: string, limit = 5): M[] {
  const q = fold(query);
  return members
    .filter((m) => !q || m.username.startsWith(q) || fold(m.name).split(/\s+/).some((w) => w.startsWith(q)))
    .slice(0, limit);
}

/** Troca o @parcial pelo @usuario escolhido; põe um espaço depois se não houver. */
export function insertMention(text: string, active: ActiveMention, username: string): string {
  const end = active.start + 1 + active.query.length;
  const rest = text.slice(end);
  return `${text.slice(0, active.start)}@${username}${rest.startsWith(' ') ? '' : ' '}${rest}`;
}

export type MentionPart<M> = { text: string; member?: M; tag?: string; url?: string };

/** Só https (nada de http, javascript:, data:); começa no início ou depois de algo que não é letra. */
const LINK = /(^|[^a-z0-9_])(https:\/\/[^\s<>"]+)/gi;
/** Pontuação colada no fim ("olha https://a.com.") não faz parte do link. */
const TRAILING = /[.,;:!?'"…\]}]+$/;
const LINK_SHOWN = 33;

/** O link como entra no texto: sem a pontuação do fim; ")" sai quando o link não abriu "(". */
function trimLink(raw: string): string {
  let url = raw.replace(TRAILING, '');
  while (url.endsWith(')') && !url.includes('(')) url = url.slice(0, -1).replace(TRAILING, '');
  return url;
}

/** Como o link aparece: sem https:// e www., cortado com "…" quando é comprido. */
export function shortLink(url: string): string {
  const bare = url.replace(/^https:\/\//i, '').replace(/^www\./i, '');
  return bare.length > LINK_SHOWN ? `${bare.slice(0, LINK_SHOWN)}…` : bare;
}

/**
 * Divide o texto em pedaços; link https vira link, @usuario de quem existe vira menção e, com `tags`,
 * #tag vira tag (o resto fica texto comum).
 */
export function splitMentions<M>(
  text: string,
  byUsername: Map<string, M>,
  { tags = false }: { tags?: boolean } = {},
): MentionPart<M>[] {
  const hits: { at: number; length: number; part: MentionPart<M> }[] = [];
  // links primeiro: @ e # dentro de um link continuam parte dele
  for (const match of text.matchAll(LINK)) {
    const url = trimLink(match[2]);
    const at = (match.index ?? 0) + match[1].length;
    if (url.length > 'https://'.length) hits.push({ at, length: url.length, part: { text: shortLink(url), url } });
  }
  for (const match of text.matchAll(MENTION)) {
    const member = byUsername.get(match[2].toLowerCase());
    if (!member) continue;
    const at = (match.index ?? 0) + match[1].length;
    hits.push({ at, length: 1 + match[2].length, part: { text: `@${match[2]}`, member } });
  }
  if (tags) {
    for (const match of text.matchAll(TAG_RE)) {
      const at = (match.index ?? 0) + match[1].length;
      hits.push({ at, length: 1 + match[2].length, part: { text: `#${match[2]}`, tag: normalizeTag(match[2]) } });
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const parts: MentionPart<M>[] = [];
  let last = 0;
  for (const hit of hits) {
    if (hit.at < last) continue;
    if (hit.at > last) parts.push({ text: text.slice(last, hit.at) });
    parts.push(hit.part);
    last = hit.at + hit.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
