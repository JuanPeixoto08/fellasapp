import type { PressableStateCallbackType } from 'react-native';

import type { Theme } from '../../lib/theme';

/**
 * Fundo de item clicável: pressionado (toque) ou com o mouse em cima (web/iPad com cursor) ganha
 * `surfaceSunken`; cursor de mão no desktop. O react-native-web entrega `hovered` no estado do
 * Pressable, mas os tipos do RN não declaram — por isso o cast.
 */
export function interactiveStyle(
  t: Theme,
  state: PressableStateCallbackType,
  base: string = 'transparent',
): { backgroundColor: string; cursor: 'pointer' } {
  const hovered = (state as PressableStateCallbackType & { hovered?: boolean }).hovered;
  return { backgroundColor: state.pressed || hovered ? t.colors.surfaceSunken : base, cursor: 'pointer' };
}
