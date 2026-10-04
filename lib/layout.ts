import { useWindowDimensions } from 'react-native';

import { layout } from './theme';

export type LayoutTier = 'compact' | 'medium' | 'expanded';

/** compact < 700 (celular em pé) · medium 700–1099 (lateral só ícones) · expanded ≥ 1100 (3 colunas). */
export function tierForWidth(width: number): LayoutTier {
  if (width >= layout.breakpoints.expanded) return 'expanded';
  if (width >= layout.breakpoints.medium) return 'medium';
  return 'compact';
}

/** Faixa atual pela largura da janela; muda na hora ao redimensionar. */
export function useLayoutTier(): LayoutTier {
  return tierForWidth(useWindowDimensions().width);
}
