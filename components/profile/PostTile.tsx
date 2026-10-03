import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';

import { getSignedUrl, type Post } from '../../lib/api/profiles';
import { profileColorKeys, profilePalette, useTheme } from '../../lib/theme';
import { Text } from '../ui';

type Props = {
  post: Post;
  size: number;
  /** Índice na paleta de perfil, para tiles sem imagem. */
  tone?: number;
};

/** Quadradinho do grid de posts: foto, ou o texto do post quando não há imagem. */
export function PostTile({ post, size, tone = 0 }: Props) {
  const t = useTheme();
  const tint = profilePalette[profileColorKeys[tone % profileColorKeys.length]];
  const plain = !!post.image_url;
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
        backgroundColor: plain ? t.colors.surfaceSunken : tint.bg,
        borderWidth: plain ? 1 : 0,
        borderColor: t.colors.border,
        padding: uri ? 0 : t.spacing.sm,
        overflow: 'hidden',
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: '100%', height: '100%' }} />
      ) : (
        <Text variant="caption" numberOfLines={5} style={{ color: tint.ink }}>
          {post.body}
        </Text>
      )}
    </View>
  );
}
