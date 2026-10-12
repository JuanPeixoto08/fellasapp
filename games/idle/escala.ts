// Escala do PC: a tela é montada numa base de 1280 × 720 e cresce com a janela (zoom), pra não sobrar espaço vazio em
// 1920 ou 2560. A cena (160 × 96) só cresce por inteiro, pra o pixel art não borrar. Celular (< 1100) fica como está.
export const BASE_LARGURA = 1280;
export const BASE_ALTURA = 720;
const MAX_ZOOM = 3;
const PROPORCAO_MAX = 2; // largura da base no máximo 2 × a altura (o resto vira margem)

export type Escala = {
  /** zoom do .idle */
  zoom: number;
  /** a cena em vezes 160 × 96 (0 = celular, o CSS decide) */
  cena: number;
  /** largura da base em px (já sem o zoom) */
  largura: number;
};

export function escalaPc(largura: number, altura: number): Escala {
  if (largura < 1100) return { zoom: 1, cena: 0, largura };
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Math.min(largura / BASE_LARGURA, altura / BASE_ALTURA)));
  const cena = Math.max(4, Math.floor(4 * zoom + 1e-9)); // 4× na base (640 × 384): a tela inicial tem espaço desde que os minigames saíram
  return { zoom, cena, largura: Math.min(largura / zoom, (altura / zoom) * PROPORCAO_MAX) };
}
