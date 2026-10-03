import { Image, View } from 'react-native';

import type { Post } from '../../lib/api/profiles';
import { profileColorKeys, profilePalette, useTheme } from '../../lib/theme';
import { Icon, Text } from '../ui';

type Props = {
  post: Post;
  /** URL assinada da foto (o ProfileView assina o grid inteiro de uma vez). */
  imageUri: string | null;
  size: number;
  /** Índice na paleta de perfil, para tiles sem imagem. */
  tone?: number;
};

/** Quadradinho do grid de posts: foto, ou o texto do post quando não há imagem. */
export function PostTile({ post, imageUri, size, tone = 0 }: Props) {
  const t = useTheme();
  const tint = profilePalette[profileColorKeys[tone % profileColorKeys.length]];
  const photo = !!post.image_url;

  return (
    <View
      testID="post-tile"
      accessibilityLabel={photo ? 'Post com foto' : `Post: ${post.body}`}
      style={{
        width: size,
        height: size,
        borderRadius: t.radii.md,
        backgroundColor: photo ? t.colors.surfaceSunken : tint.bg,
        borderWidth: photo ? t.borders.hairline : 0,
        borderColor: t.colors.border,
        padding: photo ? 0 : t.spacing.sm,
        alignItems: photo && !imageUri ? 'center' : undefined,
        justifyContent: photo && !imageUri ? 'center' : undefined,
        overflow: 'hidden',
      }}
    >
      {photo ? (
        imageUri ? (
          <Image source={{ uri: imageUri }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Icon name="image-outline" size="lg" tone="muted" />
        )
      ) : (
        <Text variant="caption" numberOfLines={5} style={{ color: tint.ink }}>
          {post.body}
        </Text>
      )}
    </View>
  );
}
