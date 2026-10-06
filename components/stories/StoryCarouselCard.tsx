import { Image, Pressable, View } from 'react-native';

import type { StoryGroup } from '../../lib/api/stories';
import { postTime } from '../../lib/format';
import type { Rect } from '../../lib/storyCarousel';
import { useTheme } from '../../lib/theme';
import { Avatar, Text } from '../ui';

type Props = { group: StoryGroup; rect: Rect; onPress: () => void };

/**
 * Cartão de outra pessoa ao lado do story aberto (computador): miniatura escurecida do próximo story dela,
 * foto com anel (`brand` se tem novidade), nome e horário. Toque abre os stories dela.
 */
export function StoryCarouselCard({ group, rect, onPress }: Props) {
  const t = useTheme();
  const story = group.stories.find((s) => !s.seen) ?? group.stories[0];
  const thumb = story?.thumbUrl ?? (story?.kind === 'photo' ? story.mediaUrl : undefined);
  const onOverlay = { color: t.colors.onOverlay };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ver stories de ${group.author.name}`}
      onPress={onPress}
      style={({ pressed }) => ({
        position: 'absolute',
        left: rect.x,
        top: rect.y,
        width: rect.width,
        height: rect.height,
        borderRadius: t.radii.lg,
        overflow: 'hidden',
        backgroundColor: t.colors.surfaceSunken,
        opacity: pressed ? 0.85 : 1,
        cursor: 'pointer' as const,
      })}
    >
      {thumb ? (
        <Image source={{ uri: thumb }} resizeMode="cover" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }} />
      ) : null}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          backgroundColor: t.colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          gap: t.spacing.xs,
          padding: t.spacing.sm,
        }}
      >
        <View
          style={{
            padding: t.borders.hairline,
            borderRadius: t.radii.pill,
            borderWidth: t.borders.selected,
            borderColor: group.hasUnseen ? t.colors.brand : t.colors.onOverlay,
          }}
        >
          <Avatar name={group.author.name} uri={group.author.avatarUrl} size={t.avatarSizes.lg} />
        </View>
        <Text variant="small" bold align="center" numberOfLines={1} style={onOverlay}>
          {group.author.name}
        </Text>
        {story ? (
          <Text variant="caption" align="center" style={onOverlay}>
            {postTime(story.createdAt)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
