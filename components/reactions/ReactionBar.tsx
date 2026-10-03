import { Pressable, View } from 'react-native';

import { Icon, Text } from '../ui';
import { useTheme } from '../../lib/theme';

export type ReactionGroup = { emoji: string; count: number };

type BarProps = {
  reactions: ReactionGroup[];
  myReaction: string | null;
  onPressChip?: (emoji: string) => void;
};

/** Chips agrupados "❤️ 3"; o da minha reação fica com borda/fundo accent. */
export function ReactionBar({ reactions, myReaction, onPressChip }: BarProps) {
  const t = useTheme();
  if (!reactions || reactions.length === 0) return null;

  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.xs }}>
      {reactions.map(({ emoji, count }) => {
        const mine = emoji === myReaction;
        return (
          <Pressable
            key={emoji}
            onPress={() => onPressChip?.(emoji)}
            accessibilityRole="button"
            accessibilityLabel={`${emoji} ${count} ${count === 1 ? 'reação' : 'reações'}`}
            accessibilityHint={mine ? 'Toque para remover sua reação' : 'Toque para reagir com este emoji'}
            accessibilityState={{ selected: mine }}
            hitSlop={t.spacing.xs}
          >
            <View
              style={{
                minHeight: t.layout.minTouch,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                paddingHorizontal: t.spacing.md,
                borderRadius: t.radii.pill,
                borderWidth: 1,
                borderColor: mine ? t.colors.accent : t.colors.border,
                backgroundColor: mine ? t.colors.accent : t.colors.surface,
              }}
            >
              <Text variant="small">{emoji}</Text>
              <Text
                variant="small"
                bold
                tone={mine ? undefined : 'muted'}
                style={mine ? { color: t.colors.onAccent } : undefined}
              >
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

type ButtonProps = { onPress?: () => void };

/** Botão pequeno (carinha) que abre o seletor de reações. */
export function ReactButton({ onPress }: ButtonProps) {
  const t = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel="Reagir" hitSlop={t.spacing.xs}>
      <View
        style={{
          minHeight: t.layout.minTouch,
          minWidth: t.layout.minTouch,
          paddingHorizontal: t.spacing.md,
          borderRadius: t.radii.pill,
          borderWidth: t.borders.hairline,
          borderColor: t.colors.border,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon name="happy-outline" size="md" tone="muted" />
      </View>
    </Pressable>
  );
}
