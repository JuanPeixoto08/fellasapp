import { Pressable } from 'react-native';

import { useTheme, type IconSize } from '../../lib/theme';
import { Icon, type IconName } from './Icon';

export type IconButtonProps = {
  icon: IconName;
  /** Obrigatório: o botão não tem texto visível. */
  accessibilityLabel: string;
  onPress?: () => void;
  /**
   * outline = pílula com borda (ações do cabeçalho); ghost = só o ícone (ações dentro de card);
   * solid = círculo cheio em tinta (ação principal compacta, ex.: enviar comentário).
   */
  variant?: 'outline' | 'ghost' | 'solid';
  tone?: 'default' | 'muted' | 'danger';
  size?: IconSize;
  disabled?: boolean;
};

/** Botão só com ícone, alvo de toque de 44pt. */
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'outline',
  tone = 'default',
  size = 'md',
  disabled,
}: IconButtonProps) {
  const t = useTheme();
  const solid = variant === 'solid';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      hitSlop={variant === 'ghost' ? t.spacing.xs : undefined}
      style={({ pressed }) => ({
        width: t.layout.minTouch,
        height: t.layout.minTouch,
        borderRadius: t.radii.pill,
        borderWidth: variant === 'outline' ? t.borders.hairline : 0,
        borderColor: t.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: solid ? t.colors.primary : pressed ? t.colors.surfaceSunken : 'transparent',
        opacity: disabled ? 0.4 : pressed && solid ? 0.85 : 1,
      })}
    >
      <Icon
        name={icon}
        size={size}
        tone={tone === 'muted' ? 'muted' : 'default'}
        color={solid ? t.colors.onPrimary : tone === 'danger' ? t.colors.danger : undefined}
      />
    </Pressable>
  );
}
