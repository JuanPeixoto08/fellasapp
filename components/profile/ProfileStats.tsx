import { View } from 'react-native';

import type { ProfileStats as Stats } from '../../lib/api/profileStats';
import { useTheme } from '../../lib/theme';
import { Text } from '../ui';

export type ProfileStatsProps = {
  stats: Pick<Stats, 'posts' | 'likesReceived' | 'commentsReceived'>;
  /** Cor do perfil: fundo e tinta (texto) com contraste garantido. */
  color?: { bg: string; ink: string };
};

export function ProfileStats({ stats, color }: ProfileStatsProps) {
  const t = useTheme();
  const items = [
    { value: stats.posts, label: 'posts' },
    { value: stats.likesReceived, label: 'curtidas' },
    { value: stats.commentsReceived, label: 'comentários' },
  ];
  return (
    <View
      accessibilityRole="summary"
      style={{
        flexDirection: 'row',
        backgroundColor: color?.bg ?? t.colors.surface,
        borderRadius: t.radii.lg,
        borderWidth: color ? 0 : 1,
        borderColor: t.colors.border,
        paddingVertical: t.spacing.lg,
        paddingHorizontal: t.spacing.md,
      }}
    >
      {items.map((item) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
          style={{ flex: 1, alignItems: 'center' }}
        >
          <Text variant="headline" style={color ? { color: color.ink } : undefined}>
            {String(item.value)}
          </Text>
          <Text variant="caption" tone="muted" style={color ? { color: color.ink } : undefined}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default ProfileStats;
