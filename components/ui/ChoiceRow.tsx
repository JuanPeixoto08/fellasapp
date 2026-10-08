import { Pressable, View } from 'react-native';
import type { ReactNode } from 'react';

import { useTheme } from '../../lib/theme';
import { Icon } from './Icon';
import { interactiveStyle } from './interactive';
import { Text } from './Text';

export type ChoiceRowProps = {
  label: string;
  selected: boolean;
  onPress: () => void;
  /** Desenho antes do nome (ex.: o próprio selo). */
  leading?: ReactNode;
};

/** Opção de escolha única numa lista de configuração: tocar escolhe; a escolhida ganha o ✓ `brand`. */
export function ChoiceRow({ label, selected, onPress, leading }: ChoiceRowProps) {
  const t = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={(state) => ({
        ...interactiveStyle(t, state),
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch,
        // o fundo do toque/hover passa um pouco das bordas; o texto fica alinhado com o resto da tela
        paddingHorizontal: t.spacing.sm,
        marginHorizontal: -t.spacing.sm,
        borderRadius: t.radii.md,
      })}
    >
      {leading ? (
        <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {leading}
        </View>
      ) : null}
      <Text bold={selected} style={{ flex: 1 }}>
        {label}
      </Text>
      {selected ? <Icon name="checkmark" color={t.colors.brand} /> : null}
    </Pressable>
  );
}
