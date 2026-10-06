import { Ionicons } from '@expo/vector-icons';

import { useTheme, type IconSize } from '../../lib/theme';

/**
 * Selo de verificado: check num círculo vermelho preenchido, ao lado do nome. É marca, não controle, por
 * isso foge da regra do `-outline` (como no Twitter).
 */
export function VerifiedBadge({ size = 'sm' }: { size?: IconSize }) {
  const t = useTheme();
  return (
    <Ionicons
      name="checkmark-circle"
      size={t.iconSizes[size]}
      color={t.colors.verified}
      accessible
      accessibilityRole="image"
      accessibilityLabel="Verificado"
    />
  );
}
