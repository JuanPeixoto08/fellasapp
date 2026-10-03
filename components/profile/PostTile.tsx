import { Image, Pressable, View } from 'react-native';

import type { FeedPost } from '../../lib/api/posts';
import { useTheme } from '../../lib/theme';
import { Icon } from '../ui';

type Props = {
  post: FeedPost;
  size: number;
  onPress?: (post: FeedPost) => void;
};

/** Quadradinho da aba Fotos: a primeira foto do post (+ ícone quando tem várias); tocar abre o post. */
export function PostTile({ post, size, onPress }: Props) {
  const t = useTheme();
  const count = post.images.length;
  const label = count > 1 ? `Abrir post com ${count} fotos` : 'Abrir foto';
  return (
    <Pressable
      testID="post-tile"
      accessibilityRole="button"
      accessibilityLabel={post.body ? `${label}: ${post.body}` : label}
      onPress={() => onPress?.(post)}
      style={({ pressed }) => ({
        width: size,
        height: size,
        borderRadius: t.radii.sm,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        opacity: pressed ? 0.8 : 1,
      })}
    >
      {post.imageUrl ? (
        <Image source={{ uri: post.imageUrl }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Icon name="image-outline" size="lg" tone="muted" />
      )}
      {count > 1 ? (
        <View
          testID="post-tile-multi"
          style={{
            position: 'absolute',
            top: t.spacing.xs,
            right: t.spacing.xs,
            padding: t.spacing.xs,
            borderRadius: t.radii.sm,
            backgroundColor: t.colors.overlay,
          }}
        >
          <Icon name="copy-outline" size="sm" color={t.colors.onOverlay} />
        </View>
      ) : null}
    </Pressable>
  );
}
