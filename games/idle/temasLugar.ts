// Mapa do rolê: cada lugar tem o próprio estilo de pixel art, com as cores tiradas do ícone dele (o ícone mora só no
// banco; aqui só ficam as cores, pelo número do lugar). O tema troca poucas variáveis dentro da tela do lugar (fundo,
// superfície, destaque, segundo destaque, texto e borda) e o destaque do pino no mapa; o idle.css continua com os
// tokens dele. Lugar sem tema usa os tokens de sempre.

export type TemaLugar = { fundo: string; superficie: string; acento: string; acento2: string; texto: string; borda: string };

/** Lote 1: a camisetaria (3), o copão (4) e o jantar (7). */
export const TEMAS_LUGAR: Partial<Record<number, TemaLugar>> = {
  3: { fundo: '#1A1510', superficie: '#2A2118', acento: '#FFD25E', acento2: '#5ED18A', texto: '#F4F1EA', borda: '#654633' },
  4: { fundo: '#0B0A0E', superficie: '#211F29', acento: '#FF5A6E', acento2: '#E8954A', texto: '#F4F1EA', borda: '#8C2A3D' },
  7: { fundo: '#15141B', superficie: '#2A2D38', acento: '#FFE9A8', acento2: '#C9962F', texto: '#F4F1EA', borda: '#4A3D2A' },
};

const PAPEIS = ['fundo', 'superficie', 'acento', 'acento2', 'texto', 'borda'] as const;

/** Põe (ou tira) o tema do lugar no elemento: `data-tema` e as variáveis --lugar-*. */
export function aplicarTema(alvo: HTMLElement, id: number | null): void {
  const t = id === null ? undefined : TEMAS_LUGAR[id];
  for (const p of PAPEIS) {
    if (t) alvo.style.setProperty(`--lugar-${p}`, t[p]);
    else alvo.style.removeProperty(`--lugar-${p}`);
  }
  if (t) alvo.dataset.tema = String(id);
  else delete alvo.dataset.tema;
}
