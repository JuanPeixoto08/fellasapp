import { useSyncExternalStore } from 'react';

import type { StoryGroup } from './api/stories';

export type StoriesRequest = { groups: StoryGroup[]; authorId: string; storyId?: string };

/** O viewer é desenhado uma vez só, na raiz (StoryViewerHost), e abre de qualquer lugar (faixa, notificação). */
let request: StoriesRequest | null = null;
const listeners = new Set<() => void>();
const changed = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function openStories(groups: StoryGroup[], authorId: string, storyId?: string): void {
  request = { groups, authorId, storyId };
  emit();
}

export function closeStories(): void {
  if (!request) return;
  request = null;
  emit();
}

export function useStoriesRequest(): StoriesRequest | null {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    () => request,
    () => request,
  );
}

/** Postei ou apaguei um story: a faixa recarrega. */
export function emitStoriesChanged(): void {
  changed.forEach((l) => l());
}

export function onStoriesChanged(listener: () => void): () => void {
  changed.add(listener);
  return () => {
    changed.delete(listener);
  };
}
