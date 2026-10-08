import { Pressable, View } from 'react-native';

import { useNowPlaying } from '../../lib/lastfm/useNowPlaying';
import { useTheme } from '../../lib/theme';
import { Text } from '../ui';
import { EqualizerBars } from './EqualizerBars';

type Props = {
  /** Usuário do Last.fm do autor do post. */
  user: string;
  /** Abre a aba Música do autor; sem isso só mostra (ex.: posts dentro do perfil da própria pessoa). */
  onPress?: () => void;
};

/**
 * "ouvindo **Música**" ao lado do nome no post: o que o autor ouve agora (ao vivo, igual ao perfil).
 * Só aparece com música tocando; encolhe antes do nome quando falta espaço.
 */
export function PostNowPlaying({ user, onPress }: Props) {
  const t = useTheme();
  const track = useNowPlaying(user);
  if (!track) return null;

  const label = `Ouvindo ${track.name}, de ${track.artist}`;
  const row = { flexDirection: 'row' as const, alignItems: 'center' as const, gap: t.spacing.xs, flexShrink: 3, minWidth: 0 };
  const content = (
    <>
      <EqualizerBars />
      <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {'ouvindo '}
        <Text variant="caption" bold>
          {track.name}
        </Text>
      </Text>
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} style={row}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      // a linha é baixa: o hitSlop completa o alvo de toque de 44
      hitSlop={{ top: t.spacing.md, bottom: t.spacing.md }}
      style={({ pressed }) => [row, { opacity: pressed ? 0.7 : 1, cursor: 'pointer' as const }]}
    >
      {content}
    </Pressable>
  );
}
