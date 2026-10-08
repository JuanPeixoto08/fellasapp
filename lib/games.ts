import { Linking, Platform } from 'react-native';

import { WEB_URL } from './api/invites';

/**
 * Abre a mesa de um jogo. As mesas são páginas próprias (projeto `games/`, Vite + Three.js) na mesma origem do
 * app: na web, é uma navegação de página inteira (sai do roteador do app); fora da web, abre o site.
 */
export function openGame(slug: string): void {
  const path = `/games/${slug}/`;
  if (Platform.OS === 'web' && typeof window !== 'undefined') window.location.assign(path);
  else void Linking.openURL(`${WEB_URL}${path}`);
}
