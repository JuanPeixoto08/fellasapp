import { Pressable } from 'react-native';

import { useNowPlaying } from '../../lib/lastfm/useNowPlaying';
import { useTheme } from '../../lib/theme';
import { Text } from '../ui';
import { ArtistTile } from './ArtistTile';
import { EqualizerBars } from './EqualizerBars';

type Props = { user: string; onPress: () => void };

/** "Ouvindo agora" discreto no cabeçalho do perfil: só aparece com música tocando. */
export function NowPlayingLine({ user, onPress }: Props) {
  const t = useTheme();
  const track = useNowPlaying(user);
  if (!track) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvindo agora: ${track.name}, de ${track.artist}`}
      onPress={onPress}
      // a linha é baixa: o hitSlop completa o alvo de toque de 44
      hitSlop={{ top: t.spacing.md, bottom: t.spacing.md, left: t.spacing.xs, right: t.spacing.xs }}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        opacity: pressed ? 0.7 : 1,
        cursor: 'pointer' as const,
      })}
    >
      <ArtistTile name={track.album ?? track.name} uri={track.image} size={t.iconSizes.lg} />
      <EqualizerBars />
      <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
        <Text variant="small" bold>
          {track.name}
        </Text>
        <Text variant="small" tone="muted">{` — ${track.artist}`}</Text>
      </Text>
    </Pressable>
  );
}
