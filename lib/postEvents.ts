type Listener = (postId: string) => void;

const deleted = new Set<Listener>();
const created = new Set<() => void>();
const commentCounts = new Set<(postId: string, delta: number) => void>();

/** Avisa as listas abertas (feed, perfil) que um post foi apagado, para tirarem ele da tela. */
export function emitPostDeleted(postId: string): void {
  for (const listener of deleted) listener(postId);
}

export function onPostDeleted(listener: Listener): () => void {
  deleted.add(listener);
  return () => {
    deleted.delete(listener);
  };
}

/** Avisa as listas abertas que entrou post novo, para recarregarem do topo. */
export function emitPostCreated(): void {
  for (const listener of created) listener();
}

export function onPostCreated(listener: () => void): () => void {
  created.add(listener);
  return () => {
    created.delete(listener);
  };
}

/** Comentei (+1) ou apaguei comentário (−1) na tela do post: as listas abertas acertam o número. */
export function emitCommentCountChanged(postId: string, delta: number): void {
  for (const listener of commentCounts) listener(postId, delta);
}

export function onCommentCountChanged(listener: (postId: string, delta: number) => void): () => void {
  commentCounts.add(listener);
  return () => {
    commentCounts.delete(listener);
  };
}

const feedTop = new Set<() => void>();

/** Tocou em Feed (aba, lateral ou logo) já estando no feed: a lista volta ao topo e recarrega. */
export function emitFeedTop(): void {
  for (const listener of feedTop) listener();
}

export function onFeedTop(listener: () => void): () => void {
  feedTop.add(listener);
  return () => {
    feedTop.delete(listener);
  };
}
