import { View } from 'react-native';

import type { ProfileStats as Stats } from '../../lib/api/profileStats';
import { useTheme } from '../../lib/theme';
import { Text } from '../ui';

export type ProfileStatsProps = {
  stats: Pick<Stats, 'posts' | 'likesReceived' | 'commentsReceived'>;
};

/** Números do perfil entre fios, como cabeçalho de jornal: discretos, sem bloco de cor. */
export function ProfileStats({ stats }: ProfileStatsProps) {
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
        paddingVertical: t.spacing.md,
        borderTopWidth: t.borders.hairline,
        borderBottomWidth: t.borders.hairline,
        borderColor: t.colors.border,
      }}
    >
      {items.map((item, i) => (
        <View
          key={item.label}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
          style={{
            flex: 1,
            alignItems: 'center',
            borderLeftWidth: i === 0 ? 0 : t.borders.hairline,
            borderColor: t.colors.border,
          }}
        >
          <Text variant="title">{String(item.value)}</Text>
          <Text variant="caption" tone="muted">
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

export default ProfileStats;
