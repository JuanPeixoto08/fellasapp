import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon, Text } from '../ui';

type Props = {
  location: string;
  placeKey: string | null | undefined;
  /** false: só mostra (na página do próprio local, para não empilhar a mesma página). */
  enabled?: boolean;
};

/** Local do post, discreto abaixo do nome: ícone + nome numa linha; toque abre os posts do local. */
export function PlaceLink({ location, placeKey, enabled = true }: Props) {
  const t = useTheme();
  const row = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    alignSelf: 'flex-start' as const,
    maxWidth: '100%' as const,
  };
  const content = (
    <>
      <Icon name="location-outline" size="sm" tone="muted" />
      <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {location}
      </Text>
    </>
  );
  if (!enabled || !placeKey) return <View style={row}>{content}</View>;
  // a linha é baixa: o hitSlop completa o alvo de toque de 44
  const slop = (t.layout.minTouch - t.typography.caption.lineHeight) / 2;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ver posts em ${location}`}
      onPress={() => router.push(`/place/${encodeURIComponent(placeKey)}?name=${encodeURIComponent(location)}`)}
      hitSlop={{ top: slop, bottom: slop, left: t.spacing.xs, right: t.spacing.xs }}
      // como o AuthorLink: o hover surfaceSunken sumiria sobre a linha do post, que já acende
      style={({ pressed }) => [row, { cursor: 'pointer' as const, opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
