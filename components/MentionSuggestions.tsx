import { Pressable, View } from 'react-native';

import { useMemberDirectory } from '../lib/memberDirectory';
import { suggestMembers } from '../lib/mentions';
import { useTheme } from '../lib/theme';
import { Avatar, interactiveStyle, Text } from './ui';

type Props = { query: string; onPick: (username: string) => void };

/** Lista de fellas para marcar enquanto a pessoa digita "@an…" (até 5). */
export function MentionSuggestions({ query, onPick }: Props) {
  const t = useTheme();
  const options = suggestMembers(useMemberDirectory(), query);
  if (options.length === 0) return null;
  return (
    <View
      accessibilityLabel="Fellas para marcar"
      style={{
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
      }}
    >
      {options.map((m) => (
        <Pressable
          key={m.id}
          accessibilityRole="button"
          accessibilityLabel={`Marcar ${m.name} (@${m.username})`}
          onPress={() => onPick(m.username)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.md,
            ...interactiveStyle(t, state),
          })}
        >
          <Avatar name={m.name} uri={m.avatarUrl} size={t.avatarSizes.sm} />
          <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {m.name}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            @{m.username}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
