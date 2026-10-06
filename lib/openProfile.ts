import { router } from 'expo-router';

/** Abre o perfil de um fella. O meu cai na aba Perfil (app/user/[id] redireciona). */
export function openProfile(userId: string): void {
  router.push(`/user/${userId}`);
}
