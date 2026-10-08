import { Pressable, View } from 'react-native';

import type { Profile } from '../../lib/api/profiles';
import { useTheme } from '../../lib/theme';
import { Avatar, interactiveStyle, NameWithBadge, Text } from '../ui';

type Props = { member: Profile; avatarUri?: string | null; onPress: () => void };

export function MemberRow({ member, avatarUri, onPress }: Props) {
  const t = useTheme();
  const name = member.display_name || member.username;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${name}`}
      onPress={onPress}
      style={(state) => ({
        minHeight: t.layout.minTouch + t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingVertical: t.spacing.sm,
        ...interactiveStyle(t, state),
      })}
    >
      <Avatar name={name} uri={avatarUri} size={t.layout.minTouch} />
      <View style={{ flex: 1 }}>
        <NameWithBadge name={name} badges={member.badges} hiddenBadges={member.hidden_badges} bold />
        <Text variant="small" tone="muted" numberOfLines={1}>
          @{member.username}
        </Text>
      </View>
    </Pressable>
  );
}
