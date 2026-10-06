import { Pressable, View } from 'react-native';

import { formatThousands } from '../../lib/lastfm/map';
import { useCover } from '../../lib/lastfm/covers';
import type { LastfmTopItem, LastfmTopKind } from '../../lib/lastfm/types';
import { useTheme } from '../../lib/theme';
import { interactiveStyle, Text } from '../ui';
import { ArtistTile } from './ArtistTile';

type Props = { item: LastfmTopItem; kind: LastfmTopKind; onPress: () => void };

/** Uma linha do ranking: posição, imagem, nome (e artista em álbuns/músicas) e plays. */
export function TopRow({ item, kind, onPress }: Props) {
  const t = useTheme();
  // tops de músicas e artistas chegam sem imagem: busca quando a linha aparece (álbuns já vêm com capa)
  const cover = useCover(
    kind === 'artists' ? 'artist' : 'track',
    kind === 'artists' ? item.name : item.artist,
    item.name,
    kind !== 'albums' && !item.image,
  );
  const plays = `${formatThousands(item.plays)} ${item.plays === 1 ? 'play' : 'plays'}`;
  const label = `${item.rank}º ${item.name}${item.artist ? `, de ${item.artist}` : ''}, ${plays}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch + t.spacing.sm,
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.layout.gutter,
        ...interactiveStyle(t, state),
      })}
    >
      <Text variant="small" tone="muted" style={{ minWidth: t.spacing.xl, textAlign: 'right' }}>
        {String(item.rank)}
      </Text>
      <ArtistTile name={item.name} uri={item.image ?? cover} size={t.avatarSizes.md} round={kind === 'artists'} />
      <View style={{ flex: 1 }}>
        <Text bold numberOfLines={1}>
          {item.name}
        </Text>
        {item.artist ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {item.artist}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="muted">
        {plays}
      </Text>
    </Pressable>
  );
}
