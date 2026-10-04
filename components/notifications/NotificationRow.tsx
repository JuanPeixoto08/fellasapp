import { Image, Pressable, View } from 'react-native';

import { postTime } from '../../lib/format';
import { describeNotification, notificationText, type AppNotification, type NotificationKind } from '../../lib/notifications';
import { useTheme, type Theme } from '../../lib/theme';
import { Avatar, Icon, interactiveStyle, Text, type IconName } from '../ui';

function kindIcon(t: Theme, kind: NotificationKind): { name: IconName; color?: string } {
  switch (kind) {
    case 'like':
      return { name: 'heart', color: t.colors.like };
    case 'comment':
    case 'thread_reply':
      return { name: 'chatbubble-outline' };
    case 'post_reaction':
    case 'comment_reaction':
      return { name: 'happy-outline' };
    case 'birthday':
      return { name: 'gift-outline' };
    case 'new_member':
      return { name: 'person-add-outline' };
  }
}

type Props = { item: AppNotification; onPress: (n: AppNotification) => void };

/** Linha da tela de notificações: avatar com o ícone do tipo, texto com nomes em negrito, data e miniatura. */
export function NotificationRow({ item, onPress }: Props) {
  const t = useTheme();
  const who = item.actors[0];
  const icon = kindIcon(t, item.kind);
  const date = postTime(item.latestAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notificationText(item)}. ${date}`}
      onPress={() => onPress(item)}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingVertical: t.spacing.md,
        ...interactiveStyle(t, state, item.unread ? t.colors.surfaceSunken : 'transparent'),
      })}
    >
      <View
        testID={item.unread ? 'unread-dot' : undefined}
        style={{
          width: t.spacing.sm,
          height: t.spacing.sm,
          borderRadius: t.radii.pill,
          backgroundColor: item.unread ? t.colors.brand : 'transparent',
        }}
      />
      <View>
        <Avatar name={who?.name ?? 'Alguém'} uri={who?.avatarUrl} size={t.avatarSizes.md} />
        <View
          style={{
            position: 'absolute',
            right: -t.spacing.xs,
            bottom: -t.spacing.xs,
            width: t.iconSizes.md,
            height: t.iconSizes.md,
            borderRadius: t.radii.pill,
            backgroundColor: t.colors.bg,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon.name} size="sm" color={icon.color} />
        </View>
      </View>
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <Text numberOfLines={3}>
          {describeNotification(item).map((part, i) => (
            <Text key={i} bold={part.bold}>
              {part.text}
            </Text>
          ))}
        </Text>
        <Text variant="small" tone="muted">
          {date}
        </Text>
      </View>
      {item.thumbUrl ? (
        <Image
          source={{ uri: item.thumbUrl }}
          style={{ width: t.avatarSizes.md, height: t.avatarSizes.md, borderRadius: t.radii.md }}
        />
      ) : null}
    </Pressable>
  );
}
