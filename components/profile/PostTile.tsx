import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { getSignedUrl, type Post } from '../../lib/api/profiles';
import { useTheme } from '../../lib/theme';
import { Text } from '../ui';

type Props = { post: Post; size: number };

/** Quadradinho do grid de posts: foto, ou o texto do post quando não há imagem. */
export function PostTile({ post, size }: Props) {
  const t = useTheme();
  const [uri, setUri] = useState<string | null>(null);

  useEffect(() => {
    getSignedUrl(post.image_url).then(setUri);
  }, [post.image_url]);

  return (
    <View
      testID="post-tile"
      accessibilityLabel={post.image_url ? 'Post com foto' : `Post: ${post.body}`}
      style={{
        width: size,
        height: size,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surfaceSunken,
        borderWidth: 1,
        borderColor: t.colors.border,
        padding: uri ? 0 : t.spacing.sm,
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text variant="caption" numberOfLines={5}>
          {post.body}
        </Text>
      )}
    </View>
  );
}
