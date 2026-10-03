import { Pressable, View } from 'react-native';

import type { Profile } from '../../lib/api/profiles';
import { useTheme } from '../../lib/theme';
import { Avatar, Text } from '../ui';

type Props = { member: Profile; avatarUri?: string | null; onPress: () => void };

export function MemberRow({ member, avatarUri, onPress }: Props) {
  const t = useTheme();
  const name = member.display_name || member.username;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver perfil de ${name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: t.layout.minTouch + t.spacing.lg,
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingVertical: t.spacing.sm,
        backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent',
      })}
    >
      <Avatar name={name} uri={avatarUri} size={t.layout.minTouch} />
      <View style={{ flex: 1 }}>
        <Text bold numberOfLines={1}>
          {name}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          @{member.username}
        </Text>
      </View>
    </Pressable>
  );
}
