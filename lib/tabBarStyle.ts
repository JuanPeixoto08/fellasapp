import type { Theme } from './theme';

export type TabBarInsets = { bottom: number; left: number; right: number };

// Altura explícita: o React Navigation já fixa `height` (49 + insets.bottom) e soma
// insets.bottom ao padding, o que espremia/cortava o ícone. Aqui o inset entra uma vez só.
// Só ícones (sem nome embaixo): a barra é o alvo de toque mais o respiro.
export function getTabBarStyle(t: Theme, insets: TabBarInsets) {
  const paddingTop = t.spacing.xs;
  const paddingBottom = Math.max(insets.bottom, t.spacing.xs);
  const borderTopWidth = 1;
  return {
    backgroundColor: t.colors.bg,
    borderTopColor: t.colors.border,
    borderTopWidth,
    height: borderTopWidth + paddingTop + t.layout.minTouch + paddingBottom,
    paddingTop,
    paddingBottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
}
