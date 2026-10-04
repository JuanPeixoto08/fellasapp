import { useSyncExternalStore } from 'react';

/**
 * "Esqueci a senha" em andamento: a pessoa entrou com o código e precisa criar uma senha nova antes de
 * seguir. Fica só em memória (fechar o app cancela a redefinição; a senha antiga continua valendo).
 */
let pending = false;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function markPasswordReset(): void {
  pending = true;
  emit();
}

export function clearPasswordReset(): void {
  pending = false;
  emit();
}

export function isPasswordResetPending(): boolean {
  return pending;
}

export function usePasswordResetPending(): boolean {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => pending,
    () => pending,
  );
}
