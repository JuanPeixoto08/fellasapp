import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { suggestPlaces, type PlaceSuggestion } from '../../lib/api/places';
import { cleanPlace, placeKey } from '../../lib/places';
import { useTheme } from '../../lib/theme';
import { interactiveStyle, Text } from '../ui';

/** Espera a pessoa parar de digitar um instante antes de perguntar ao banco. */
export const PLACE_SUGGEST_DEBOUNCE_MS = 200;

type Props = { query: string; onPick: (name: string) => void };

/**
 * Locais que o grupo já usou enquanto a pessoa digita (até 5, mais usados primeiro), com quantos posts
 * têm. Se o digitado ainda não é um deles, a última linha oferece usar como está.
 */
export function PlaceSuggestions({ query, onPick }: Props) {
  const t = useTheme();
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      suggestPlaces(query)
        .then((list) => alive && setOptions(list))
        .catch(() => alive && setOptions([]));
    }, PLACE_SUGGEST_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const typed = cleanPlace(query);
  const typedKey = placeKey(query);
  const offerTyped = !!typed && !options.some((o) => o.key === typedKey);
  if (options.length === 0 && !offerTyped) return null;

  const option = (key: string, label: string, onPress: () => void, children: ReactNode) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch,
        paddingHorizontal: t.spacing.md,
        ...interactiveStyle(t, state),
      })}
    >
      {children}
    </Pressable>
  );

  return (
    <View
      accessibilityLabel="Locais pra usar"
      style={{
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
      }}
    >
      {options.map((o) =>
        option(
          o.key,
          `Usar ${o.name}`,
          () => onPick(o.name),
          <>
            <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
              {o.name}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {o.posts === 1 ? '1 post' : `${o.posts} posts`}
            </Text>
          </>,
        ),
      )}
      {offerTyped && typed
        ? option(
            '__typed',
            `Usar "${typed}"`,
            () => onPick(typed),
            <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
              Usar "{typed}"
            </Text>,
          )
        : null}
    </View>
  );
}
