/** Abas do perfil. */
export type ProfileTab = 'posts' | 'photos' | 'music';

/** Como a aba aparece no endereço (`/@juan?aba=musica`), em pt. */
const PARAM: Record<ProfileTab, string> = { posts: 'posts', photos: 'fotos', music: 'musica' };

/** `aba` do endereço → aba do perfil; valor desconhecido ou ausente → undefined (fica em Posts). */
export function parseProfileTab(value?: string | string[]): ProfileTab | undefined {
  const v = Array.isArray(value) ? value[0] : value;
  return (Object.keys(PARAM) as ProfileTab[]).find((tab) => PARAM[tab] === v);
}

export function profileTabParam(tab: ProfileTab): string {
  return PARAM[tab];
}
