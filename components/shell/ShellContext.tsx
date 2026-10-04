import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '../../lib/theme';

export type ShellValue = {
  /** Largura útil da coluna de conteúdo (600 no desktop). */
  contentWidth: number;
  /** Abre a janela do compositor; null quando não há moldura (celular). */
  openCompose: (() => void) | null;
};

export const ShellContext = createContext<ShellValue | null>(null);

/**
 * Largura da coluna de conteúdo. Telas que calculam tamanhos (grade de fotos, miniaturas) usam
 * isto e não a largura da janela: no desktop a janela tem 1440 e a coluna, 600.
 */
export function useContentWidth(): number {
  const shell = useContext(ShellContext);
  const { width } = useWindowDimensions();
  const t = useTheme();
  return shell?.contentWidth ?? Math.min(width, t.layout.maxContentWidth);
}

export function useOpenCompose(): (() => void) | null {
  return useContext(ShellContext)?.openCompose ?? null;
}
