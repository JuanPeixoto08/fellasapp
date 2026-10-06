export type NotificationKind =
  | 'like'
  | 'post_reaction'
  | 'comment_reaction'
  | 'comment'
  | 'thread_reply'
  | 'birthday'
  | 'new_member'
  | 'mention'
  | 'story_reaction';

const KINDS: ReadonlySet<string> = new Set<NotificationKind>([
  'like',
  'post_reaction',
  'comment_reaction',
  'comment',
  'thread_reply',
  'birthday',
  'new_member',
  'mention',
  'story_reaction',
]);

/** Tipo que este app sabe mostrar (uma migração mais nova pode trazer outros). */
export function isNotificationKind(kind: string): kind is NotificationKind {
  return KINDS.has(kind);
}

export type NotificationPerson = { id: string; name: string; avatarUrl: string | null; username?: string };

/** Uma linha da tela de notificações (já com pessoas e miniatura resolvidas). */
export type AppNotification = {
  key: string;
  kind: NotificationKind;
  postId: string | null;
  commentId: string | null;
  /** Story da reação (`story_reaction`). */
  storyId: string | null;
  /** Até 3 pessoas, a mais recente primeiro. */
  actors: NotificationPerson[];
  /** Total de pessoas no grupo (curtidas/reações agrupadas). */
  actorCount: number;
  emojis: string[];
  body: string | null;
  latestAt: string;
  unread: boolean;
  thumbUrl: string | null;
};

export type TextPart = { text: string; bold?: boolean };

const SNIPPET_MAX = 80;

/** Trecho de comentário: espaços juntados, até 80 caracteres com "…". */
export function snippet(text: string | null): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > SNIPPET_MAX ? `${clean.slice(0, SNIPPET_MAX - 1).trimEnd()}…` : clean;
}

/** "Ana" · "Ana e Pedro" · "Ana, Pedro e Bia" · "Ana, Pedro e mais 3" (nomes em negrito). */
function peopleParts(actors: NotificationPerson[], count: number): TextPart[] {
  const total = Math.max(count, actors.length, 1);
  const shown = actors.slice(0, total > 3 ? 2 : 3).map((a) => a.name);
  if (shown.length === 0) shown.push('Alguém');
  const extra = total - shown.length;
  const parts: TextPart[] = [];
  shown.forEach((name, i) => {
    if (i > 0) parts.push({ text: extra === 0 && i === shown.length - 1 ? ' e ' : ', ' });
    parts.push({ text: name, bold: true });
  });
  if (extra > 0) parts.push({ text: ` e mais ${extra}` });
  return parts;
}

export function describeNotification(n: AppNotification): TextPart[] {
  const plural = Math.max(n.actorCount, n.actors.length) > 1;
  const who = peopleParts(n.actors, n.actorCount);
  const emojis = n.emojis.join(' ');
  switch (n.kind) {
    case 'like':
      return [...who, { text: plural ? ' curtiram seu post' : ' curtiu seu post' }];
    case 'post_reaction':
      return [...who, { text: `${plural ? ' reagiram' : ' reagiu'} ${emojis} ao seu post` }];
    case 'comment_reaction':
      return [...who, { text: `${plural ? ' reagiram' : ' reagiu'} ${emojis} ao seu comentário` }];
    case 'comment':
      return [...who, { text: ` comentou: “${snippet(n.body)}”` }];
    case 'thread_reply':
      return [...who, { text: ` também comentou num post que você comentou: “${snippet(n.body)}”` }];
    case 'birthday':
      return [{ text: 'Hoje é aniversário de ' }, ...who];
    case 'new_member':
      return [...who, { text: ' entrou no fellas' }];
    case 'story_reaction':
      return [...who, { text: `${plural ? ' reagiram' : ' reagiu'} ${emojis} ao seu story` }];
    case 'mention':
      return [...who, { text: ` te marcou num ${n.commentId ? 'comentário' : 'post'}: “${snippet(n.body)}”` }];
  }
}

export function notificationText(n: AppNotification): string {
  return describeNotification(n)
    .map((part) => part.text)
    .join('');
}

/** Rótulo acessível do sino / item da lateral. */
export function notificationsLabel(count: number): string {
  if (count <= 0) return 'Notificações';
  if (count > 9) return 'Notificações, mais de 9 novas';
  return `Notificações, ${count} ${count === 1 ? 'nova' : 'novas'}`;
}
