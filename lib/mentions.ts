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

export type MentionPart<M> = { text: string; member?: M };

/** Divide o texto em pedaços; @usuario de quem existe vira menção (o resto fica texto comum). */
export function splitMentions<M>(text: string, byUsername: Map<string, M>): MentionPart<M>[] {
  const parts: MentionPart<M>[] = [];
  let last = 0;
  let plain = '';
  for (const match of text.matchAll(MENTION)) {
    const member = byUsername.get(match[2].toLowerCase());
    if (!member) continue;
    const at = (match.index ?? 0) + match[1].length;
    plain += text.slice(last, at);
    if (plain) parts.push({ text: plain });
    plain = '';
    parts.push({ text: `@${match[2]}`, member });
    last = at + 1 + match[2].length;
  }
  plain += text.slice(last);
  if (plain) parts.push({ text: plain });
  return parts;
}
