import { useSyncExternalStore } from 'react';

/** Intervalo da busca do número de não lidas enquanto o app está aberto. */
export const UNREAD_POLL_MS = 60_000;

let unread = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Número de notificações não lidas (bolinha do sino e da lateral). */
export function useUnreadNotifications(): number {
  return useSyncExternalStore(subscribe, () => unread, () => unread);
}

export function getUnreadNotifications(): number {
  return unread;
}

export function setUnreadNotifications(next: number): void {
  if (next === unread) return;
  unread = next;
  for (const listener of listeners) listener();
}
