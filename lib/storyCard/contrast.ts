import { storyCard } from '../theme';

export type StoryBackground = 'photo' | 'violeta' | 'tinta' | 'vermelho' | 'papel';

/** Ordem das bolinhas no montador (a da foto só aparece em post com foto). */
export const BACKGROUND_ORDER: StoryBackground[] = ['photo', 'violeta', 'tinta', 'vermelho', 'papel'];

export const BACKGROUND_LABEL: Record<StoryBackground, string> = {
  photo: 'Fundo com a foto do post',
  violeta: 'Fundo violeta',
  tinta: 'Fundo tinta',
  vermelho: 'Fundo vermelho',
  papel: 'Fundo papel',
};

export type CardShadow = { color: string; blur: number; offsetY: number };
export type CardPalette = { bg: string | null; mark: string; tape: string; paper: string; shadow: CardShadow };

/** Luminância relativa (WCAG) de uma cor `#RRGGBB`. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Cores que mudam com o fundo: marca FELLAS, fita, papel do recorte e sombra. Fundo claro (papel) pede
 * marca em tinta e recorte branco; o resto (e a foto, que vai escurecida) pede marca em papel.
 */
export function paletteFor(bg: StoryBackground): CardPalette {
  const color = bg === 'photo' ? null : storyCard.backgrounds[bg];
  const light = color !== null && luminance(color) > 0.5;
  return {
    bg: color,
    mark: light ? storyCard.ink : storyCard.paper,
    tape: light ? storyCard.tapeOnLight : storyCard.tape,
    paper: light ? storyCard.paperOnLight : storyCard.paper,
    shadow: light ? storyCard.shadowOnLight : storyCard.shadow,
  };
}
