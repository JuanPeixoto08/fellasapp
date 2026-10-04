import type { Database } from '../../types/database';
import { isNotificationKind, type AppNotification, type NotificationKind, type NotificationPerson } from '../notifications';
import { supabase } from '../supabase';
import { resolveUrl, signPaths } from './storage';

const FEED_LIMIT = 50;

// o cliente do Supabase não é tipado pelo Database: as linhas da função vêm daqui
type FeedRow = Database['public']['Functions']['notifications_feed']['Returns'][number];
type PersonRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type PostRow = { id: string; image_url: string | null; images: string[] | null };

/** Lista da tela: a função do banco já agrupa e ordena; aqui entram nomes, fotos e miniaturas. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('notifications_feed', { p_limit: FEED_LIMIT });
  if (error) throw error;
  // tipo desconhecido (app aberto mais velho que a migração) fica de fora em vez de quebrar a tela
  const rows = ((data ?? []) as FeedRow[]).filter((r) => isNotificationKind(r.kind));
  if (rows.length === 0) return [];

  const personIds = [...new Set(rows.flatMap((r) => r.actor_ids ?? []))];
  const postIds = [...new Set(rows.map((r) => r.post_id).filter((id): id is string => !!id))];
  const [people, posts] = await Promise.all([
    personIds.length
      ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', personIds)
      : Promise.resolve({ data: [] as PersonRow[], error: null }),
    postIds.length
      ? supabase.from('posts').select('id, image_url, images').in('id', postIds)
      : Promise.resolve({ data: [] as PostRow[], error: null }),
  ]);
  if (people.error) throw people.error;
  if (posts.error) throw posts.error;

  const personRows = (people.data ?? []) as PersonRow[];
  const firstPhoto = new Map(
    ((posts.data ?? []) as PostRow[]).map((p) => [p.id, p.images?.[0] ?? p.image_url ?? null]),
  );
  const signed = await signPaths([...personRows.map((p) => p.avatar_url), ...firstPhoto.values()]).catch(
    () => new Map<string, string>(),
  );
  const byId = new Map<string, NotificationPerson>(
    personRows.map((p) => [
      p.id,
      { id: p.id, name: p.display_name || p.username, avatarUrl: resolveUrl(p.avatar_url, signed) },
    ]),
  );

  return rows.map((r) => {
    const actorIds = r.actor_ids ?? [];
    return {
      key: [r.kind, r.post_id ?? '', r.comment_id ?? '', actorIds[0] ?? ''].join(':'),
      kind: r.kind as NotificationKind,
      postId: r.post_id,
      commentId: r.comment_id,
      actors: actorIds.map((id) => byId.get(id)).filter((p): p is NotificationPerson => !!p),
      actorCount: r.actor_count,
      emojis: r.emojis ?? [],
      body: r.body,
      latestAt: r.latest_at,
      unread: r.unread,
      thumbUrl: r.post_id ? resolveUrl(firstPhoto.get(r.post_id), signed) : null,
    };
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_notifications_count');
  if (error) throw error;
  return (data as number | null) ?? 0;
}

export async function markNotificationsSeen(): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_seen');
  if (error) throw error;
}
