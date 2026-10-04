import { STORIES_URL } from '../storiesConfig';
import { supabase } from '../supabase';
import { isValidReactionEmoji } from './reactions';
import { getCurrentUserId } from './profiles';
import { resolveUrl, signPaths } from './storage';

export type StoryKind = 'photo' | 'video';
export type Story = { id: string; authorId: string; kind: StoryKind; mediaUrl: string; durationMs: number; createdAt: string; seen: boolean; myReaction: string | null };
export type StoryAuthor = { id: string; name: string; username: string; avatarUrl: string | null };
export type StoryGroup = { author: StoryAuthor; stories: Story[]; hasUnseen: boolean; latestAt: string };
export type StoryViewer = { person: StoryAuthor; viewedAt: string; emoji: string | null };

export const STORY_PHOTO_MS = 5000;
export const MAX_VIDEO_MS = 15000;
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/** Erro de envio com mensagem pt-BR pronta para a tela (o resto passa por friendlyError). */
export class StoryUploadError extends Error {}

const UPLOAD_ERRORS: Record<number, string> = {
  401: 'Sua sessão expirou. Entra de novo.',
  403: 'Só fellas podem postar story.',
  413: 'Arquivo grande demais: foto até 5 MB, vídeo até 50 MB.',
  415: 'Esse tipo de arquivo não rola. Usa foto ou vídeo.',
};

/** Manda o arquivo para o Worker (R2) com o login; devolve o link secreto. */
export async function uploadStoryMedia(uri: string): Promise<{ url: string; contentType: string }> {
  const blob = await (await fetch(uri)).blob();
  const contentType = blob.type || 'application/octet-stream';
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StoryUploadError(UPLOAD_ERRORS[401]);
  let res: Response;
  try {
    res = await fetch(`${STORIES_URL}/upload`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': contentType },
      body: blob,
    });
  } catch {
    // sem rede (ou o Worker caiu sem responder): o navegador só diz "Failed to fetch"
    throw new StoryUploadError('Sem conexão. Confere a internet e tenta de novo.');
  }
  if (!res.ok) throw new StoryUploadError(UPLOAD_ERRORS[res.status] ?? 'Não rolou enviar. Tenta de novo.');
  const { url } = (await res.json()) as { url: string };
  return { url, contentType };
}

export async function createStory(input: { kind: StoryKind; mediaUrl: string; durationMs: number }): Promise<void> {
  const me = await getCurrentUserId();
  const { error } = await supabase
    .from('stories')
    .insert({ author_id: me, kind: input.kind, media_url: input.mediaUrl, duration_ms: input.durationMs });
  if (error) throw error;
}

type Row = {
  id: string; author_id: string; kind: StoryKind; media_url: string; duration_ms: number; created_at: string;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
};

/** Stories das últimas 24 h, agrupados por autor (cada grupo do mais antigo ao mais novo). */
export async function listActiveStories(now: Date = new Date()): Promise<StoryGroup[]> {
  const me = await getCurrentUserId();
  const since = new Date(now.getTime() - STORY_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('id, author_id, kind, media_url, duration_ms, created_at, author:profiles(id, username, display_name, avatar_url)')
    .gt('created_at', since)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const rows = (data ?? []) as unknown as Row[];
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [views, reactions, signed] = await Promise.all([
    supabase.from('story_views').select('story_id').eq('viewer_id', me).in('story_id', ids),
    supabase.from('story_reactions').select('story_id, emoji').eq('user_id', me).in('story_id', ids),
    signPaths(rows.map((r) => r.author?.avatar_url)).catch(() => new Map<string, string>()),
  ]);
  const seen = new Set(((views.data ?? []) as { story_id: string }[]).map((v) => v.story_id));
  const mine = new Map(((reactions.data ?? []) as { story_id: string; emoji: string }[]).map((r) => [r.story_id, r.emoji]));
  const groups = new Map<string, StoryGroup>();
  for (const r of rows) {
    const a = r.author;
    let g = groups.get(r.author_id);
    if (!g) {
      g = {
        author: {
          id: r.author_id,
          username: a?.username ?? '',
          name: a?.display_name || a?.username || 'Alguém',
          avatarUrl: resolveUrl(a?.avatar_url, signed),
        },
        stories: [],
        hasUnseen: false,
        latestAt: r.created_at,
      };
      groups.set(r.author_id, g);
    }
    const story: Story = {
      id: r.id, authorId: r.author_id, kind: r.kind, mediaUrl: r.media_url, durationMs: r.duration_ms,
      createdAt: r.created_at, seen: seen.has(r.id), myReaction: mine.get(r.id) ?? null,
    };
    g.stories.push(story);
    g.latestAt = r.created_at;
    if (!story.seen) g.hasUnseen = true;
  }
  return [...groups.values()];
}

export async function markStoryViewed(storyId: string): Promise<void> {
  const me = await getCurrentUserId();
  await supabase.from('story_views').upsert({ story_id: storyId, viewer_id: me }, { ignoreDuplicates: true });
}

/** Quem viu o meu story (a política só deixa o dono ver), com o emoji de quem reagiu. */
export async function listStoryViewers(storyId: string): Promise<StoryViewer[]> {
  const me = await getCurrentUserId();
  const [views, reactions] = await Promise.all([
    supabase
      .from('story_views')
      .select('viewed_at, viewer:profiles(id, username, display_name, avatar_url)')
      .eq('story_id', storyId)
      // eu também marco que vi o meu story (o anel); a lista é de quem mais viu
      .neq('viewer_id', me)
      .order('viewed_at', { ascending: false }),
    supabase.from('story_reactions').select('user_id, emoji').eq('story_id', storyId),
  ]);
  if (views.error) throw views.error;
  type V = { viewed_at: string; viewer: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null };
  const list = (views.data ?? []) as unknown as V[];
  const emoji = new Map(((reactions.data ?? []) as { user_id: string; emoji: string }[]).map((r) => [r.user_id, r.emoji]));
  const signed = await signPaths(list.map((v) => v.viewer?.avatar_url)).catch(() => new Map<string, string>());
  return list
    .filter((v) => v.viewer)
    .map((v) => ({
      person: {
        id: v.viewer!.id,
        username: v.viewer!.username,
        name: v.viewer!.display_name || v.viewer!.username,
        avatarUrl: resolveUrl(v.viewer!.avatar_url, signed),
      },
      viewedAt: v.viewed_at,
      emoji: emoji.get(v.viewer!.id) ?? null,
    }));
}

export async function reactToStory(storyId: string, emoji: string | null): Promise<void> {
  const me = await getCurrentUserId();
  if (emoji === null) {
    const { error } = await supabase.from('story_reactions').delete().eq('story_id', storyId).eq('user_id', me);
    if (error) throw error;
    return;
  }
  if (!isValidReactionEmoji(emoji)) throw new Error('Reação inválida');
  const { error } = await supabase.from('story_reactions').upsert({ story_id: storyId, user_id: me, emoji });
  if (error) throw error;
}

export async function deleteStory(storyId: string): Promise<void> {
  const { error } = await supabase.from('stories').delete().eq('id', storyId);
  if (error) throw error;
}
