type Listener = (postId: string) => void;

const deleted = new Set<Listener>();
const created = new Set<() => void>();

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
