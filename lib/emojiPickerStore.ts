import { useSyncExternalStore } from 'react';

import type { Rect } from './popover';

/** Pedido de abrir o seletor completo de emojis (o "+" da barra de reações). */
export type EmojiPickerRequest = {
  selected: string | null;
  /** Botão de reagir medido: no computador o painel abre preso a ele. */
  anchor: Rect | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
};

/**
 * O seletor completo é desenhado uma vez só, na raiz do app (`EmojiPickerHost`), fora das listas: dentro
 * do post (que mora na lista do feed) a lista de emojis vira "lista aninhada" e não rola por conta própria.
 */
let request: EmojiPickerRequest | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function openEmojiPicker(next: EmojiPickerRequest): void {
  request = next;
  emit();
}

export function closeEmojiPicker(): void {
  if (!request) return;
  request = null;
  emit();
}

export function useEmojiPickerRequest(): EmojiPickerRequest | null {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => request,
    () => request,
  );
}
