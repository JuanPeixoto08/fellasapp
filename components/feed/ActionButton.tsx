import type { ReactNode } from 'react';
import { Pressable, type AccessibilityState, type AccessibilityValue } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from '../ui';

type Props = {
  /** Ícone (ou emoji) da ação. */
  children: ReactNode;
  /** Número ao lado; 0 ou ausente não aparece. */
  count?: number;
  /** Cor do número quando a ação está ativa (ex.: curtido). */
  countColor?: string;
  onPress?: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityValue?: AccessibilityValue;
  accessibilityState?: AccessibilityState;
};

/** Ação do post sem contorno: ícone + número, alvo de toque de 44pt. */
export function ActionButton({ children, count, countColor, onPress, ...a11y }: Props) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      {...a11y}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: t.layout.minTouch,
        minWidth: t.layout.minTouch,
        paddingHorizontal: t.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.spacing.xs,
        borderRadius: t.radii.pill,
        backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent',
      })}
    >
      {children}
      {count ? (
        <Text variant="small" tone="muted" style={countColor ? { color: countColor } : undefined}>
          {count}
        </Text>
      ) : null}
    </Pressable>
  );
}
