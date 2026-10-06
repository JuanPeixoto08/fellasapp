import { shrinkForUpload } from '../imageUpload';
import { cleanPlace } from '../places';
import { supabase } from '../supabase';
import type { Tables } from '../../types/database';
import {
  NO_REACTIONS,
  commentReactionsMap,
  postReactionsMap,
  type ReactionGroup,
  type ReactionSummary,
} from './reactions';
import { BUCKET, resolveUrl, signPaths } from './storage';

export const PAGE_SIZE = 10;
/** Fotos por post (mesmo limite do check posts_images_max). */
export const MAX_IMAGES = 4;

/** `avatar_url` já vem como URL assinada (pronta para exibir) ou null. */
export type Author = Pick<Tables<'profiles'>, 'id' | 'username' | 'display_name' | 'avatar_url'> & {
  /** Selos (ex.: verificado); falta em dados antigos/de teste. */
  badges?: string[];
};

export type FeedPost = {
  id: string;
  body: string;
  /** URLs assinadas (bucket privado) das fotos, na ordem; até 4. */
  images: string[];
  /** Atalho para a primeira foto (capa na aba Fotos), ou null. */
  imageUrl: string | null;
  createdAt: string;
  /** Local escrito por quem postou ("Bar do Zé"), ou null. Falta em dados antigos/de teste. */
  location?: string | null;
  /** Chave do local (minúsculas, sem acento): leva à página do local. */
  placeKey?: string | null;
  author: Author;
  likeCount: number;
  commentCount: number;
  likedByMe: boolean;
  reactions: ReactionSummary[];
  myReaction: string | null;
};

export type FeedPage = { posts: FeedPost[]; nextCursor: string | null };

export type Comment = {
  id: string;
  body: string;
  createdAt: string;
  author: Author;
  reactions: ReactionSummary[];
  myReaction: string | null;
};

type PostRow = Tables<'posts'> & {
  author: Author | null;
  likes: { count: number }[] | null;
  comments: { count: number }[] | null;
};

const AUTHOR_COLUMNS = 'id, username, display_name, avatar_url, badges';
const POST_SELECT = `*, author:profiles!posts_author_id_fkey(${AUTHOR_COLUMNS}), likes(count), comments(count)`;

const unknownAuthor = (id: string): Author => ({
  id,
  username: 'desconhecido',
  display_name: null,
  avatar_url: null,
});

async function currentUserId(): Promise<string> {
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) throw error ?? new Error('Não autenticado');
  return data.user.id;
}

/** Fotos do post: a lista `images` (0005) ou, em posts antigos/banco sem a migration, a `image_url`. */
export function imagePaths(row: { images?: string[] | null; image_url: string | null }): string[] {
  if (row.images && row.images.length > 0) return row.images.slice(0, MAX_IMAGES);
  return row.image_url ? [row.image_url] : [];
}

function mapAuthor(author: Author | null, id: string, signed: Map<string, string>): Author {
  if (!author) return unknownAuthor(id);
  return { ...author, avatar_url: resolveUrl(author.avatar_url, signed) };
}

/** Assina fotos e avatares de todos os posts em uma chamada só. */
async function mapPosts(
  rows: PostRow[],
  liked: Set<string>,
  reactions: Map<string, ReactionGroup>,
): Promise<FeedPost[]> {
  const signed = await signPaths(rows.flatMap((r) => [...imagePaths(r), r.author?.avatar_url]));
  return rows.map((row) => {
    const r = reactions.get(row.id) ?? NO_REACTIONS;
    const images = imagePaths(row)
      .map((p) => resolveUrl(p, signed))
      .filter((u): u is string => !!u);
    return {
      id: row.id,
      body: row.body,
      images,
      imageUrl: images[0] ?? null,
      createdAt: row.created_at,
      location: row.location ?? null,
      placeKey: row.place_key ?? null,
      author: mapAuthor(row.author, row.author_id, signed),
      likeCount: row.likes?.[0]?.count ?? 0,
      commentCount: row.comments?.[0]?.count ?? 0,
      likedByMe: liked.has(row.id),
      reactions: r.reactions,
      myReaction: r.myReaction,
    };
  });
}

async function likedSet(userId: string, postIds: string[]): Promise<Set<string>> {
  if (postIds.length === 0) return new Set();
  const { data, error } = await supabase
    .from('likes')
    .select('post_id')
    .eq('user_id', userId)
    .in('post_id', postIds);
  if (error) throw error;
  return new Set((data ?? []).map((l) => l.post_id));
}

/** Feed paginado por created_at (mais novos primeiro). `cursor` = created_at do último item. */
export type FeedFilter = {
  /** Só posts deste autor (perfil). */
  authorId?: string;
  /** Só posts com foto (aba Fotos do perfil). */
  photosOnly?: boolean;
  /** Só posts com esta #tag (página da tag), já em minúsculas. */
  tag?: string;
  /** Só posts deste local (página do local): a chave, já normalizada. */
  place?: string;
};

export async function listFeed(
  { cursor, authorId, photosOnly, tag, place }: { cursor?: string | null } & FeedFilter = {},
): Promise<FeedPage> {
  const userId = await currentUserId();
  let query = supabase
    .from('posts')
    .select(POST_SELECT)
    .order('created_at', { ascending: false })
    .limit(PAGE_SIZE);
  if (cursor) query = query.lt('created_at', cursor);
  if (authorId) query = query.eq('author_id', authorId);
  if (photosOnly) query = query.not('image_url', 'is', null);
  if (tag) query = query.contains('tags', [tag]);
  if (place) query = query.eq('place_key', place);

  const { data, error } = await query;
  if (error) throw error;
  const rows = (data ?? []) as unknown as PostRow[];
  const ids = rows.map((r) => r.id);
  const [liked, reactions] = await Promise.all([
    likedSet(userId, ids),
    postReactionsMap(userId, ids),
  ]);
  const posts = await mapPosts(rows, liked, reactions);
  return {
    posts,
    nextCursor:
      rows.length === PAGE_SIZE ? rows[rows.length - 1].created_at : null,
  };
}

export async function getPost(postId: string): Promise<FeedPost> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('posts')
    .select(POST_SELECT)
    .eq('id', postId)
    .single();
  if (error) throw error;
  const [liked, reactions] = await Promise.all([
    likedSet(userId, [postId]),
    postReactionsMap(userId, [postId]),
  ]);
  const [post] = await mapPosts([data as unknown as PostRow], liked, reactions);
  return post;
}

async function uploadImage(userId: string, uri: string, index: number): Promise<string> {
  const original = await (await fetch(uri)).blob();
  // GIF sobe como está; o resto vai reduzido (lib/imageUpload)
  const blob = original.type === 'image/gif' ? original : await (await fetch(await shrinkForUpload(uri))).blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  // o índice evita colisão de nome quando várias sobem no mesmo milissegundo
  const path = `${userId}/${Date.now()}-${index}.${ext}`;
  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, blob, { contentType: blob.type || 'image/jpeg' });
  if (error) throw error;
  return path;
}

async function removeImages(paths: string[]): Promise<void> {
  const own = paths.filter((p) => !/^https?:\/\//.test(p));
  if (own.length === 0) return;
  await supabase.storage.from(BUCKET).remove(own).catch(() => {});
}

export async function createPost({
  body,
  imageUris = [],
  location = null,
}: {
  body: string;
  /** Fotos locais (até 4), na ordem de exibição. */
  imageUris?: string[];
  /** Local escrito por quem posta; limpo aqui (pontas, espaços repetidos). */
  location?: string | null;
}): Promise<Tables<'posts'>> {
  const text = body.trim();
  if (!text && imageUris.length === 0) throw new Error('Escreva algo ou escolha uma imagem');
  if (imageUris.length > MAX_IMAGES) throw new Error(`No máximo ${MAX_IMAGES} fotos por post`);
  const userId = await currentUserId();
  const place = cleanPlace(location);

  const results = await Promise.allSettled(imageUris.map((uri, i) => uploadImage(userId, uri, i)));
  const paths = results.flatMap((r) => (r.status === 'fulfilled' ? [r.value] : []));
  const failed = results.find((r): r is PromiseRejectedResult => r.status === 'rejected');
  if (failed) {
    // não deixa foto órfã no bucket se o post não for criado
    await removeImages(paths);
    throw failed.reason;
  }

  // 1 foto vai só em image_url (funciona mesmo sem a migration 0005); 2+ precisam de `images`.
  // image_url sempre recebe a primeira, para apps antigos ainda abertos mostrarem ao menos ela.
  const row = {
    author_id: userId,
    body: text,
    image_url: paths[0] ?? null,
    ...(paths.length > 1 ? { images: paths } : {}),
    // só com local: sem ele o insert é o mesmo de antes (funciona mesmo sem a migration 0020)
    ...(place ? { location: place } : {}),
  };
  const { data, error } = await supabase.from('posts').insert(row).select().single();
  if (error) {
    await removeImages(paths);
    throw error;
  }
  return data;
}

/** Curte/descurte. Retorna o novo estado (true = curtido). */
export async function toggleLike(postId: string): Promise<boolean> {
  const userId = await currentUserId();
  const { data: existing, error: selectError } = await supabase
    .from('likes')
    .select('post_id')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (selectError) throw selectError;

  if (existing) {
    const { error } = await supabase
      .from('likes')
      .delete()
      .eq('post_id', postId)
      .eq('user_id', userId);
    if (error) throw error;
    return false;
  }
  const { error } = await supabase
    .from('likes')
    .insert({ post_id: postId, user_id: userId });
  if (error) throw error;
  return true;
}

export async function listComments(postId: string): Promise<Comment[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('comments')
    .select(
      `id, body, created_at, author_id, author:profiles!comments_author_id_fkey(${AUTHOR_COLUMNS})`,
    )
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  type Row = {
    id: string;
    body: string;
    created_at: string;
    author_id: string;
    author: Author | null;
  };
  const rows = (data ?? []) as unknown as Row[];
  const [reactions, signed] = await Promise.all([
    commentReactionsMap(userId, rows.map((c) => c.id)),
    signPaths(rows.map((c) => c.author?.avatar_url)),
  ]);
  return rows.map((c) => {
    const r = reactions.get(c.id) ?? NO_REACTIONS;
    return {
      id: c.id,
      body: c.body,
      createdAt: c.created_at,
      author: mapAuthor(c.author, c.author_id, signed),
      reactions: r.reactions,
      myReaction: r.myReaction,
    };
  });
}

/** Apaga um comentário meu (RLS só deixa o autor); reações nele vão junto por cascade. */
export async function deleteComment(commentId: string): Promise<void> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('author_id', userId)
    .select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Comentário não encontrado ou não é seu');
}

/**
 * Apaga um post meu (RLS só deixa o autor). Curtidas, comentários e reações vão junto por cascade;
 * a foto no bucket é removida em seguida, sem falhar a operação se a limpeza der errado.
 */
export async function deletePost(postId: string): Promise<void> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', postId)
    .eq('author_id', userId)
    // `*` em vez de listar colunas: funciona com ou sem a coluna `images` (0005)
    .select('*');
  if (error) throw error;
  const rows = (data ?? []) as Pick<Tables<'posts'>, 'image_url' | 'images'>[];
  if (rows.length === 0) throw new Error('Post não encontrado ou não é seu');
  const { image_url, images } = rows[0];
  await removeImages([...new Set([...(images ?? []), ...(image_url ? [image_url] : [])])]);
}

export async function addComment(
  postId: string,
  body: string,
): Promise<Tables<'comments'>> {
  const text = body.trim();
  if (!text) throw new Error('Comentário vazio');
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from('comments')
    .insert({ post_id: postId, author_id: userId, body: text })
    .select()
    .single();
  if (error) throw error;
  return data;
}
