import { useRef } from 'react';
import { ActivityIndicator, Animated, Pressable, type StyleProp, type ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type ButtonProps = {
  title: string;
  /** Ícone antes do texto (some enquanto carrega). */
  icon?: IconName;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'overlay' | 'overlayOutline';
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  icon,
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
    overlay: t.colors.onOverlay,
    overlayOutline: 'transparent',
  }[variant];
  const fg = {
    primary: t.colors.onPrimary,
    danger: t.colors.onDanger,
    secondary: t.colors.text,
    ghost: t.colors.primary,
    overlay: t.colors.viewerBg,
    overlayOutline: t.colors.onOverlay,
  }[variant];
  const outlined = variant === 'secondary' || variant === 'overlayOutline';

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
            borderWidth: outlined ? t.borders.hairline : 0,
            borderColor: variant === 'overlayOutline' ? t.colors.onOverlay : t.colors.border,
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
        {icon && !loading ? <Icon name={icon} color={fg} /> : null}
        <Text bold style={{ color: fg }}>
          {title}
        </Text>
      </Animated.View>
    </Pressable>
  );
}
