import { useCallback, useEffect, useRef, useState } from 'react';

import { deletePost, getPost, listFeed, toggleLike, type FeedFilter, type FeedPost } from './api/posts';
import { setPostReaction } from './api/reactions';
import { emitPostDeleted, onPostCreated, onPostDeleted } from './postEvents';
import { debounce, LIVE_DEBOUNCE_MS, onLive, postIdOf, type LiveChange } from './realtime';
import { withLike, withReaction } from './reactionState';

/** Apaga o post e avisa todas as listas abertas. Erro sobe para quem chamou (o diálogo mostra). */
export async function removePost(postId: string): Promise<void> {
  await deletePost(postId);
  emitPostDeleted(postId);
}

function without(set: ReadonlySet<string>, ids: string[]): ReadonlySet<string> {
  if (!ids.some((id) => set.has(id))) return set;
  const next = new Set(set);
  for (const id of ids) next.delete(id);
  return next;
}

type Options = FeedFilter & {
  /** Só começa a buscar quando true (ex.: aba que ainda não foi aberta). */
  enabled?: boolean;
};

/**
 * Lista paginada de posts (feed ou perfil) com curtida/reação otimistas e remoção.
 * Posts apagados em qualquer tela somem daqui também. Ao vivo: curtidas/comentários/reações de outras
 * pessoas atualizam o post na hora; post novo de outra pessoa só conta em `newPosts` (a lista não pula
 * enquanto a pessoa lê) até ela pedir com `showNewPosts`.
 */
export function usePostList({ authorId, photosOnly, enabled = true }: Options = {}) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  /** Posts de outras pessoas que chegaram ao vivo e ainda não estão na lista. */
  const [newIds, setNewIds] = useState<ReadonlySet<string>>(new Set());
  const postsRef = useRef(posts);
  postsRef.current = posts;

  const load = useCallback(
    async (reset: boolean, from: string | null) => {
      if (busy.current) return;
      busy.current = true;
      setLoading(true);
      setError(null);
      try {
        const page = await listFeed({ cursor: reset ? null : from, authorId, photosOnly });
        setPosts((prev) => (reset ? page.posts : [...prev, ...page.posts]));
        // recarregou do topo: o que era novo já está na lista
        if (reset) setNewIds((prev) => without(prev, page.posts.map((p) => p.id)));
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

  // ao vivo (só depois da primeira página, e só listas ativas)
  useEffect(() => {
    if (!enabled || !loaded) return;
    const stale = new Set<string>();
    const flush = debounce(() => {
      const ids = [...stale];
      stale.clear();
      for (const id of ids) {
        getPost(id)
          .then((fresh) => setPosts((prev) => prev.map((p) => (p.id === id ? fresh : p))))
          .catch(() => {});
      }
    }, LIVE_DEBOUNCE_MS);
    const belongsHere = (row: Record<string, unknown>) =>
      (!authorId || row.author_id === authorId) &&
      (!photosOnly || !!row.image_url || (Array.isArray(row.images) && row.images.length > 0));
    const onChange = (c: LiveChange) => {
      if (c.table === 'posts' && c.type === 'INSERT') {
        const newId = postIdOf(c);
        if (newId && !c.mine && belongsHere(c.row)) setNewIds((prev) => new Set(prev).add(newId));
        return;
      }
      const id = postIdOf(c);
      if (!id) return;
      if (c.table === 'posts' && c.type === 'DELETE') {
        setPosts((prev) => prev.filter((p) => p.id !== id));
        setNewIds((prev) => without(prev, [id]));
        return;
      }
      // minha curtida/reação a tela já aplicou na hora
      if (c.mine && (c.table === 'likes' || c.table === 'post_reactions')) return;
      if (!postsRef.current.some((p) => p.id === id)) return;
      stale.add(id);
      flush();
    };
    const resync = () => {
      listFeed({ cursor: null, authorId, photosOnly })
        .then((page) => {
          const shown = new Set(postsRef.current.map((p) => p.id));
          setNewIds(new Set(page.posts.filter((p) => !shown.has(p.id)).map((p) => p.id)));
          const fresh = new Map(page.posts.map((p) => [p.id, p]));
          setPosts((prev) => prev.map((p) => fresh.get(p.id) ?? p));
        })
        .catch(() => {});
    };
    const off = onLive((event) => (event.kind === 'resync' ? resync() : onChange(event)));
    return () => {
      flush.cancel();
      off();
    };
  }, [enabled, loaded, authorId, photosOnly]);

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
    /** Posts de outras pessoas que chegaram depois do carregamento (botão "Posts novos"). */
    newPosts: newIds.size,
    /** Traz os posts novos para o topo (o botão some quando a recarga chega). */
    showNewPosts: refresh,
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
