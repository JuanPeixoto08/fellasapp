import { useCallback, useEffect, useRef, useState } from 'react';

import { deletePost, listFeed, toggleLike, type FeedFilter, type FeedPost } from './api/posts';
import { setPostReaction } from './api/reactions';
import { emitPostDeleted, onPostCreated, onPostDeleted } from './postEvents';
import { withLike, withReaction } from './reactionState';

/** Apaga o post e avisa todas as listas abertas. Erro sobe para quem chamou (o diálogo mostra). */
export async function removePost(postId: string): Promise<void> {
  await deletePost(postId);
  emitPostDeleted(postId);
}

type Options = FeedFilter & {
  /** Só começa a buscar quando true (ex.: aba que ainda não foi aberta). */
  enabled?: boolean;
};

/**
 * Lista paginada de posts (feed ou perfil) com curtida/reação otimistas e remoção.
 * Posts apagados em qualquer tela somem daqui também.
 */
export function usePostList({ authorId, photosOnly, enabled = true }: Options = {}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(
    async (reset: boolean, from: string | null) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        const page = await listFeed({ cursor: reset ? null : from, authorId, photosOnly });
        setPosts((prev) => (reset ? page.posts : [...prev, ...page.posts]));
        setCursor(page.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar os posts');
      } finally {
        busy.current = false;
        setLoading(false);
        setRefreshing(false);
        setLoaded(true);
      }
    },
    [authorId, photosOnly],
  );

  useEffect(() => {
    if (enabled) load(true, null);
  }, [enabled, load]);

  useEffect(() => onPostDeleted((id) => setPosts((prev) => prev.filter((p) => p.id !== id))), []);

  // post novo: recarrega do topo (só listas que já carregaram alguma vez)
  useEffect(
    () =>
      onPostCreated(() => {
        if (enabled) load(true, null);
      }),
    [enabled, load],
  );

  const refresh = () => {
    setRefreshing(true);
    load(true, null);
  };

  const like = async (post: FeedPost) => {
    const apply = (liked: boolean) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? withLike(p, liked) : p)));
    apply(!post.likedByMe);
    try {
      await toggleLike(post.id);
    } catch {
      apply(post.likedByMe);
    }
  };

  const react = async (post: FeedPost, emoji: string | null) => {
    const apply = (fn: (p: FeedPost) => FeedPost) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? fn(p) : p)));
    apply((p) => withReaction(p, emoji));
    try {
      await setPostReaction(post.id, emoji);
    } catch {
      apply((p) => ({ ...p, reactions: post.reactions, myReaction: post.myReaction }));
    }
  };

  return {
    posts,
    /** Primeira página já respondeu (com ou sem erro). */
    loaded,
    loading,
    refreshing,
    error,
    refresh,
    reload: () => load(true, null),
    loadMore: () => {
      if (cursor) load(false, cursor);
    },
    like,
    react,
  };
}
