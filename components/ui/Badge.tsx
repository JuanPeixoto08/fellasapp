import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';

export type BadgeProps = { count: number };

/**
 * Bolinha com número (ex.: notificações não lidas). 0 não aparece; acima de 9 vira "9+".
 * Decorativa: quem a contém diz o número no rótulo acessível.
 */
export function Badge({ count }: BadgeProps) {
  const t = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID="badge"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minWidth: t.layout.badgeSize,
        height: t.layout.badgeSize,
        paddingHorizontal: t.spacing.xs,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="caption" style={{ color: t.colors.onBrand, fontFamily: t.fonts.bodyBold }}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}
