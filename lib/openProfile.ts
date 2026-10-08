import { router } from 'expo-router';

import { profileTabParam, type ProfileTab } from './profileTab';

/** Endereço do perfil pelo @ (`/@juan`). O meu também: a tela manda para a aba Perfil. */
export const profilePath = (username: string): `/@${string}` => `/@${username}`;

/** Abre o perfil de um fella pelo @; `tab` abre direto numa aba (ex.: Música, pelo "ouvindo agora"). */
export function openProfile(username: string, opts?: { tab?: ProfileTab }): void {
  router.push(opts?.tab ? `${profilePath(username)}?aba=${profileTabParam(opts.tab)}` : profilePath(username));
}
