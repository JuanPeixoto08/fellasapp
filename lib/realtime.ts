/**
 * Tempo real: o `RealtimeSync` escuta o banco (Supabase Realtime) e repassa cada mudança para quem
 * estiver na tela (feed, post, notificações, coluna da direita). Quem escuta decide o que buscar de novo.
 * `resync` = a conexão voltou ou o app voltou para a frente: eventos podem ter passado, atualize tudo.
 */
export const LIVE_TABLES = [
  'posts',
  'likes',
  'comments',
  'post_reactions',
  'comment_reactions',
  'profiles',
  'ideas',
  'idea_votes',
  'stories',
  'story_reactions',
] as const;
export type LiveTable = (typeof LIVE_TABLES)[number];

export type LiveChange = {
  kind: 'change';
  table: LiveTable;
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  /** Linha nova (INSERT/UPDATE) ou a antiga (DELETE: só a chave primária). */
  row: Record<string, unknown>;
  /** Fui eu que fiz (a tela já se atualizou sozinha). */
  mine: boolean;
};
export type LiveEvent = LiveChange | { kind: 'resync' };

/** Rajadas de eventos (várias curtidas seguidas) viram uma busca só. */
export const LIVE_DEBOUNCE_MS = 800;

const listeners = new Set<(event: LiveEvent) => void>();

export function onLive(listener: (event: LiveEvent) => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function emitLive(event: LiveEvent): void {
  for (const listener of listeners) listener(event);
}

const str = (v: unknown): string | null => (typeof v === 'string' ? v : null);

/** Quem fez a mudança: autor do post/comentário/ideia/story, dono da curtida/reação/voto, o próprio perfil. */
export function actorOf(table: LiveTable, row: Record<string, unknown>): string | null {
  switch (table) {
    case 'posts':
    case 'comments':
    case 'ideas':
    case 'stories':
      return str(row.author_id);
    case 'profiles':
      return str(row.id);
    default:
      return str(row.user_id);
  }
}

/** Post afetado, quando a linha diz (DELETE de comentário e reação em comentário não dizem). */
export function postIdOf(change: LiveChange): string | null {
  if (change.table === 'posts') return str(change.row.id);
  if (change.table === 'likes' || change.table === 'comments' || change.table === 'post_reactions') {
    return str(change.row.post_id);
  }
  return null;
}

/** Mudança que pode virar notificação para mim (curtida, comentário, reação, post que me marca; fella novo). */
export function affectsNotifications(event: LiveEvent): boolean {
  if (event.kind === 'resync') return true;
  if (event.mine) return false;
  // mural de ideias não gera notificação
  if (event.table === 'ideas' || event.table === 'idea_votes') return false;
  if (event.table === 'stories') return false; // story novo aparece na faixa, não vira notificação
  if (event.table === 'profiles' || event.table === 'posts') return event.type === 'INSERT';
  return true;
}

export function debounce(fn: () => void, ms: number): (() => void) & { cancel: () => void } {
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      fn();
    }, ms);
  };
  run.cancel = () => {
    if (timer) clearTimeout(timer);
    timer = null;
  };
  return run;
}
