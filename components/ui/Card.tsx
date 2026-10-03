import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';

export type CardProps = {
  children: ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Card({ children, onPress, accessibilityLabel, style }: CardProps) {
  const t = useTheme();
  const surface: ViewStyle = {
    backgroundColor: t.colors.surface,
    borderRadius: t.radii.lg,
    borderWidth: 1,
    borderColor: t.colors.border,
    padding: t.spacing.lg,
    gap: t.spacing.md,
    ...(t.scheme === 'light' ? t.shadows.card : t.shadows.none),
  };
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={[surface, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[surface, style]}>{children}</View>;
}
