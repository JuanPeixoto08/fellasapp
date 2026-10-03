import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme, type IconSize } from '../../lib/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export type IconProps = {
  name: IconName;
  size?: IconSize;
  tone?: 'default' | 'muted';
  /** Cor explícita, ex.: `ink` sobre a cor de perfil. Vence `tone`. */
  color?: string;
};

/** Ícone desenhado (Ionicons). Decorativo: o rótulo acessível fica no controle que o contém. */
export function Icon({ name, size = 'md', tone = 'default', color }: IconProps) {
  const t = useTheme();
  return (
    <Ionicons
      name={name}
      size={t.iconSizes[size]}
      color={color ?? (tone === 'muted' ? t.colors.textMuted : t.colors.text)}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}
