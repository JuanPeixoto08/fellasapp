import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { suggestTags, type TagSuggestion } from '../lib/api/tags';
import { useTheme } from '../lib/theme';
import { interactiveStyle, Text } from './ui';

/** Espera a pessoa parar de digitar um instante antes de perguntar ao banco. */
export const TAG_SUGGEST_DEBOUNCE_MS = 200;

type Props = { query: string; onPick: (tag: string) => void };

/** Tags que já existem para completar enquanto a pessoa digita "#ar…" (até 5), com quantos posts têm. */
export function TagSuggestions({ query, onPick }: Props) {
  const t = useTheme();
  const [options, setOptions] = useState<TagSuggestion[]>([]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      suggestTags(query)
        .then((list) => alive && setOptions(list))
        .catch(() => alive && setOptions([]));
    }, TAG_SUGGEST_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (options.length === 0) return null;
  return (
    <View
      accessibilityLabel="Tags pra usar"
      style={{
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
      }}
    >
      {options.map((o) => (
        <Pressable
          key={o.tag}
          accessibilityRole="button"
          accessibilityLabel={`Usar #${o.tag}`}
          onPress={() => onPick(o.tag)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.md,
            ...interactiveStyle(t, state),
          })}
        >
          <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            #{o.tag}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {o.posts === 1 ? '1 post' : `${o.posts} posts`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
