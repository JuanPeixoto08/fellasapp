import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon } from '../ui';
import type { AutoScrollOrigin } from './autoScroll';

/** Ícone da rolagem automática (botão do meio), no ponto onde a pessoa clicou. */
export function AutoScrollMark({ at }: { at: AutoScrollOrigin }) {
  const t = useTheme();
  const size = t.avatarSizes.sm;
  return (
    <View
      pointerEvents="none"
      accessible={false}
      style={{
        position: 'absolute',
        left: at.x - size / 2,
        top: at.y - size / 2,
        width: size,
        height: size,
        borderRadius: t.radii.pill,
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        backgroundColor: t.colors.surface,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="swap-vertical-outline" size="md" tone="muted" />
    </View>
  );
}
