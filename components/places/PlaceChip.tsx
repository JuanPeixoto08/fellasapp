import { Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon, Text } from '../ui';

type Props = {
  location: string;
  disabled?: boolean;
  onEdit: () => void;
  onRemove: () => void;
};

/** Local escolhido no compositor: chip com o nome (toque edita) e ✕ (tira). */
export function PlaceChip({ location, disabled, onEdit, onRemove }: Props) {
  const t = useTheme();
  // o chip é mais baixo que 44: o hitSlop completa o alvo de toque
  const slop = (t.layout.minTouch - t.layout.chipHeight) / 2;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        maxWidth: '100%',
        height: t.layout.chipHeight,
        paddingLeft: t.spacing.sm,
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.pill,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Trocar local (${location})`}
        onPress={onEdit}
        disabled={disabled}
        hitSlop={{ top: slop, bottom: slop }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flexShrink: 1, cursor: 'pointer' }}
      >
        <Icon name="location-outline" size="sm" />
        <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
          {location}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tirar local"
        onPress={onRemove}
        disabled={disabled}
        hitSlop={{ top: slop, bottom: slop, right: t.spacing.xs }}
        style={{
          width: t.layout.chipHeight,
          height: t.layout.chipHeight,
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name="close" size="sm" tone="muted" />
      </Pressable>
    </View>
  );
}
