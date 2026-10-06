import { Pressable, View } from 'react-native';

import { postTime } from '../../lib/format';
import type { LastfmTrack } from '../../lib/lastfm/types';
import { useTheme } from '../../lib/theme';
import { interactiveStyle, Text } from '../ui';
import { ArtistTile } from './ArtistTile';

type Props = { track: LastfmTrack; onPress: () => void };

/** Uma música das recentes: capa, nome, artista e há quanto tempo (ou "● agora"). */
export function TrackRow({ track, onPress }: Props) {
  const t = useTheme();
  const label = `${track.name}, de ${track.artist}${track.nowPlaying ? ', ouvindo agora' : ''}`;
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
      <ArtistTile name={track.album ?? track.name} uri={track.image} size={t.avatarSizes.md} />
      <View style={{ flex: 1 }}>
        <Text bold numberOfLines={1}>
          {track.name}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      {track.nowPlaying ? (
        <Text variant="caption" bold style={{ color: t.colors.brand }}>
          ● agora
        </Text>
      ) : track.playedAt ? (
        <Text variant="caption" tone="muted">
          {postTime(track.playedAt)}
        </Text>
      ) : null}
    </Pressable>
  );
}
