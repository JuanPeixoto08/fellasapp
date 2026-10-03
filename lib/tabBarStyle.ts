import type { Theme } from './theme';

export type TabBarInsets = { bottom: number; left: number; right: number };

// Altura explícita: o React Navigation já fixa `height` (49 + insets.bottom) e soma
// insets.bottom ao padding, o que espremia/cortava ícone e label. Aqui o inset entra uma vez só.
export function getTabBarStyle(t: Theme, insets: TabBarInsets) {
  const paddingTop = t.spacing.xs;
  const paddingBottom = Math.max(insets.bottom, t.spacing.xs);
  const borderTopWidth = 1;
  const labelSpace = t.typography.caption.lineHeight;
  return {
    backgroundColor: t.colors.bg,
    borderTopColor: t.colors.border,
    borderTopWidth,
    height: borderTopWidth + paddingTop + t.layout.minTouch + labelSpace + paddingBottom,
    paddingTop,
    paddingBottom,
    paddingLeft: insets.left,
    paddingRight: insets.right,
  };
}
