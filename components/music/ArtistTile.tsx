import { Image, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Avatar, Icon } from '../ui';

type Props = { name: string; uri: string | null; size: number; round?: boolean };

/**
 * Capa de álbum/música ou imagem de artista. Artista sem foto (o Last.fm não fornece mais) vira a
 * inicial, como o Avatar sem foto; capa vazia vira um quadrado com nota musical.
 */
export function ArtistTile({ name, uri, size, round = false }: Props) {
  const t = useTheme();
  const radius = round ? size / 2 : size <= t.layout.minTouch / 2 ? t.radii.sm : t.radii.md;
  if (uri) {
    return (
      <Image
        accessibilityLabel={`Imagem de ${name}`}
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: t.colors.surfaceSunken }}
      />
    );
  }
  if (round) return <Avatar name={name} uri={null} size={size} />;
  return (
    <View
      testID="cover-empty"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="musical-notes-outline" size="sm" tone="muted" />
    </View>
  );
}
