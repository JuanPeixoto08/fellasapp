import { useEffect, useSyncExternalStore } from 'react';

export type Draft = { body: string; imageUris: string[]; location: string | null };

const EMPTY: Draft = { body: '', imageUris: [], location: null };
let draft: Draft = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Rascunho único do post: página /new, topo do feed e janela mostram o mesmo texto, fotos e local, então
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

/**
 * O rascunho vive em memória, fora da conta: sem isto, depois de um logout (ou troca de conta) num
 * aparelho/navegador compartilhado a próxima pessoa veria — e poderia postar — o rascunho da anterior.
 * Limpa sempre que o usuário logado muda; o mesmo usuário (token renovado, re-render) mantém.
 */
export function useClearDraftOnUserChange(userId: string | undefined): void {
  useEffect(() => {
    clearDraft();
  }, [userId]);
}
