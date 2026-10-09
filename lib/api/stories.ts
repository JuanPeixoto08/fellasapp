import { Platform } from 'react-native';

import { storyMediaUrl, storyOriginalUrl, storyThumbUrl } from '../cloudinary';
import { STORIES_FUNCTION_URL } from '../storiesConfig';
import { supabase } from '../supabase';
import { isValidReactionEmoji } from './reactions';
import { getCurrentUserId } from './profiles';
import { resolveUrl, signPaths } from './storage';

export type StoryKind = 'photo' | 'video';
export type Story = { id: string; authorId: string; kind: StoryKind; mediaUrl: string; /** Original: toca enquanto a versão reduzida do vídeo ainda processa. */ originalUrl?: string; /** Miniatura dos cartões do carrossel (computador). */ thumbUrl?: string; durationMs: number; createdAt: string; seen: boolean; myReaction: string | null; /** Post de onde o story veio ("compartilhar no story"): mostra "Ver post". */ postId?: string | null };
export type StoryAuthor = { id: string; name: string; username: string; avatarUrl: string | null };
export type StoryGroup = { author: StoryAuthor; stories: Story[]; hasUnseen: boolean; latestAt: string };
export type StoryViewer = { person: StoryAuthor; viewedAt: string; emoji: string | null };

export const STORY_PHOTO_MS = 5000;
export const MAX_VIDEO_MS = 15000;
export const STORY_TTL_MS = 24 * 60 * 60 * 1000;

/** Erro de envio com mensagem pt-BR pronta para a tela (o resto passa por friendlyError). */
export class StoryUploadError extends Error {}

const SIGN_ERRORS: Record<number, string> = {
  401: 'Sua sessão expirou. Entra de novo.',
  403: 'Só fellas podem postar story.',
};
const OFFLINE = 'Sem conexão. Confere a internet e tenta de novo.';
const GENERIC = 'Não rolou enviar. Tenta de novo.';
export const STORY_LIMIT_MESSAGE = 'Os stories bateram o limite do mês. Volta dia 1.';

type Signed = { uploadUrl: string; fields: Record<string, string> };
type Uploaded = { public_id: string; duration?: number };

async function sessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StoryUploadError(SIGN_ERRORS[401]);
  return token;
}

/** Chama a função dos stories com o login; rede caída vira mensagem pt-BR. */
async function callFunction(route: 'sign' | 'delete', token: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${STORIES_FUNCTION_URL}/${route}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StoryUploadError(OFFLINE);
  }
}

async function signUpload(token: string, kind: StoryKind): Promise<Signed> {
  const res = await callFunction('sign', token, { kind });
  if (!res.ok) throw new StoryUploadError(SIGN_ERRORS[res.status] ?? GENERIC);
  return (await res.json()) as Signed;
}

/** O arquivo no formulário: na web um Blob; no celular o RN lê do disco pelo uri. */
async function filePart(uri: string, kind: StoryKind): Promise<Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  const name = kind === 'video' ? 'story.mp4' : 'story.jpg';
  return { uri, name, type: kind === 'video' ? 'video/mp4' : 'image/jpeg' } as unknown as Blob;
}

/**
 * Envia o arquivo ao Cloudinary em duas etapas: a função assina (só membro) e o app manda direto.
 * Devolve o nome do arquivo e a duração (vídeo: a que o Cloudinary mediu, até 15 s).
 */
export async function uploadStoryMedia(uri: string, kind: StoryKind): Promise<{ mediaId: string; durationMs: number }> {
  for (let attempt = 0; ; attempt++) {
    // dentro do laço: na nova tentativa o login pode ter sido renovado (o token dura 1 h, como a assinatura)
    const token = await sessionToken();
    const signed = await signUpload(token, kind);
    const form = new FormData();
    for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
    form.append('file', await filePart(uri, kind));
    let res: Response;
    try {
      res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
    } catch {
      throw new StoryUploadError(OFFLINE);
    }
    const out = (await res.json().catch(() => ({}))) as Uploaded & { error?: { message?: string } };
    if (res.ok) {
      const durationMs =
        kind === 'photo' ? STORY_PHOTO_MS : Math.min(MAX_VIDEO_MS, Math.max(1, Math.round((out.duration ?? 0) * 1000)));
      return { mediaId: out.public_id, durationMs };
    }
    const message = out.error?.message ?? '';
    // assinatura vale 1 h: se venceu no caminho, pede outra uma vez
    if (/stale request/i.test(message) && attempt === 0) continue;
    throw new StoryUploadError(/limit|quota/i.test(message) ? STORY_LIMIT_MESSAGE : GENERIC);
  }
}

export async function createStory(input: { kind: StoryKind; mediaId: string; durationMs: number; postId?: string }): Promise<void> {
  const me = await getCurrentUserId();
  const { error } = await supabase.from('stories').insert({
    author_id: me,
    kind: input.kind,
    media_id: input.mediaId,
    duration_ms: input.durationMs,
    ...(input.postId ? { post_id: input.postId } : {}),
  });
  if (error) throw error;
}

type Row = {
  id: string; author_id: string; kind: StoryKind; media_id: string; duration_ms: number; created_at: string; post_id?: string | null;
  author: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null;
};

/** Stories das últimas 24 h, agrupados por autor (cada grupo do mais antigo ao mais novo). */
export async function listActiveStories(now: Date = new Date()): Promise<StoryGroup[]> {
  const me = await getCurrentUserId();
  const since = new Date(now.getTime() - STORY_TTL_MS).toISOString();
  const { data, error } = await supabase
    .from('stories')
    .select('id, author_id, kind, media_id, duration_ms, created_at, post_id, author:profiles!stories_author_id_fkey(id, username, display_name, avatar_url)')
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
      id: r.id, authorId: r.author_id, kind: r.kind,
      mediaUrl: storyMediaUrl(r.media_id, r.kind), originalUrl: storyOriginalUrl(r.media_id, r.kind),
      thumbUrl: storyThumbUrl(r.media_id, r.kind),
      durationMs: r.duration_ms, createdAt: r.created_at, seen: seen.has(r.id), myReaction: mine.get(r.id) ?? null,
      postId: r.post_id ?? null,
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

/** Apaga pela função: o arquivo some do Cloudinary na hora e a linha do banco junto. */
export async function deleteStory(storyId: string): Promise<void> {
  const res = await callFunction('delete', await sessionToken(), { storyId });
  if (!res.ok) throw new StoryUploadError('Não rolou apagar. Tenta de novo.');
}
