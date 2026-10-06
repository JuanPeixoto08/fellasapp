import { router } from 'expo-router';

/** Endereço do perfil pelo @ (`/@juan`). O meu também: a tela manda para a aba Perfil. */
export const profilePath = (username: string): `/@${string}` => `/@${username}`;

/** Abre o perfil de um fella pelo @. */
export function openProfile(username: string): void {
  router.push(profilePath(username));
}
