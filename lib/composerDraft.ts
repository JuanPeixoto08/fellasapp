import { useSyncExternalStore } from 'react';

export type Draft = { body: string; imageUris: string[] };

const EMPTY: Draft = { body: '', imageUris: [] };
let draft: Draft = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Rascunho único do post: página /new, topo do feed e janela mostram o mesmo texto e fotos, então
 * redimensionar a janela (que troca o formato) não perde nada.
 */
export function useDraft(): Draft {
  return useSyncExternalStore(subscribe, () => draft, () => draft);
}

export function setDraft(next: Draft | ((d: Draft) => Draft)): void {
  draft = typeof next === 'function' ? next(draft) : next;
  for (const listener of listeners) listener();
}

export function clearDraft(): void {
  setDraft(EMPTY);
}
