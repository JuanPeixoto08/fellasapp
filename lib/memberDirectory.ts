import { useMemo, useSyncExternalStore } from 'react';

import type { MentionMember } from './mentions';

/**
 * Fellas do grupo para marcar com @ e destacar menções em qualquer tela (mantido pelo
 * `MemberDirectorySync`, que carrega ao entrar e atualiza ao vivo).
 */
let members: MentionMember[] = [];
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMemberDirectory(): MentionMember[] {
  return members;
}

export function setMemberDirectory(next: MentionMember[]): void {
  members = next;
  for (const listener of listeners) listener();
}

export function useMemberDirectory(): MentionMember[] {
  return useSyncExternalStore(subscribe, getMemberDirectory, getMemberDirectory);
}

/** Por usuário (minúsculo), para achar quem foi marcado num texto. */
export function useMembersByUsername(): Map<string, MentionMember> {
  const list = useMemberDirectory();
  return useMemo(() => new Map(list.map((m) => [m.username.toLowerCase(), m])), [list]);
}
