import type { Ref } from 'react';
import { Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { ActionButton } from '../feed/ActionButton';
import { Emoji, Icon, Text } from '../ui';

export type ReactionGroup = { emoji: string; count: number };

type BarProps = {
  reactions: ReactionGroup[];
  myReaction: string | null;
  onPressChip?: (emoji: string) => void;
};

/** Chips mínimos "😂 3", um por emoji; o da minha reação fica invertido (acento neutro). */
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
            hitSlop={{ top: t.spacing.sm, bottom: t.spacing.sm, left: t.spacing.xs, right: t.spacing.xs }}
          >
            <View
              style={{
                height: t.layout.chipHeight,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                paddingHorizontal: t.spacing.sm,
                borderRadius: t.radii.pill,
                borderWidth: t.borders.hairline,
                borderColor: mine ? t.colors.accent : t.colors.border,
                backgroundColor: mine ? t.colors.accent : 'transparent',
              }}
            >
              <Emoji emoji={emoji} size="sm" />
              <Text variant="caption" tone="muted" style={mine ? { color: t.colors.onAccent } : undefined}>
                {count}
              </Text>
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

type ButtonProps = {
  onPress?: () => void;
  /** Minha reação atual: aparece no lugar da carinha. */
  myReaction?: string | null;
  /** Para a barra de reações abrir presa a este botão (ReactionPicker anchorRef). */
  anchorRef?: Ref<View>;
};

/** Abre o seletor de reações; quando já reagi, mostra o meu emoji (tocar troca ou remove). */
export function ReactButton({ onPress, myReaction, anchorRef }: ButtonProps) {
  return (
    <View ref={anchorRef} collapsable={false}>
      <ActionButton
        onPress={onPress}
        accessibilityLabel="Reagir"
        accessibilityHint={myReaction ? `Sua reação: ${myReaction}. Toque para trocar ou remover` : undefined}
      >
        {myReaction ? <Emoji emoji={myReaction} size="md" /> : <Icon name="happy-outline" tone="muted" />}
      </ActionButton>
    </View>
  );
}
