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

/** O que a tela inicial deixa fora da cena, em px da base: o topo (64) + o respiro em cima da cena (24) + a margem de
 *  baixo (32); dos lados, a margem da página (32 + 32). */
const RESERVA_ALTURA = 64 + 24 + 32;
const RESERVA_LARGURA = 64;

/** `inicio`: a tela antes do Abrir CNPJ, só a cena com a caixa de diálogo; a cena cresce até ocupar a tela. */
export function escalaPc(largura: number, altura: number, inicio = false): Escala {
  if (largura < 1100) return { zoom: 1, cena: 0, largura };
  const zoom = Math.min(MAX_ZOOM, Math.max(1, Math.min(largura / BASE_LARGURA, altura / BASE_ALTURA)));
  const base = Math.min(largura / zoom, (altura / zoom) * PROPORCAO_MAX);
  // 4× na base (640 × 384): a tela inicial tem espaço desde que os minigames saíram
  let cena = Math.max(4, Math.floor(4 * zoom + 1e-9));
  if (inicio) {
    const cabeW = (base - RESERVA_LARGURA) * zoom;
    const cabeH = (altura / zoom - RESERVA_ALTURA) * zoom;
    cena = Math.max(cena, Math.floor(Math.min(cabeW / 160, cabeH / 96) + 1e-9));
  }
  return { zoom, cena, largura: base };
}
