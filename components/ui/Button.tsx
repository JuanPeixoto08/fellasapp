import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';

export type ButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  fullWidth,
  accessibilityLabel,
  style,
}: ButtonProps) {
  const t = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const inactive = disabled || loading;

  const bg = {
    primary: t.colors.primary,
    danger: t.colors.danger,
    secondary: t.colors.surface,
    ghost: 'transparent',
  }[variant];
  const fg = {
    primary: t.colors.onPrimary,
    danger: t.colors.onDanger,
    secondary: t.colors.text,
    ghost: t.colors.primary,
  }[variant];

  const press = (to: number) =>
    Animated.timing(scale, { toValue: to, duration: t.motion.fast, useNativeDriver: true }).start();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      onPressIn={() => press(0.97)}
      onPressOut={() => press(1)}
      style={{ alignSelf: fullWidth ? 'stretch' : 'flex-start' }}
    >
      <Animated.View
        style={[
          {
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.xl,
            borderRadius: t.radii.md,
            backgroundColor: bg,
            borderWidth: variant === 'secondary' ? 1 : 0,
            borderColor: t.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'row',
            gap: t.spacing.sm,
            opacity: inactive ? 0.5 : 1,
            transform: [{ scale }],
          },
          style,
        ]}
      >
        {loading ? <ActivityIndicator color={fg} /> : null}
        <Text bold style={{ color: fg }}>
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
