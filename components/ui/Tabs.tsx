import { Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';

export type TabItem<K extends string> = { key: K; label: string };

export type TabsProps<K extends string> = {
  items: TabItem<K>[];
  value: K;
  onChange: (key: K) => void;
};

/** Abas de seção (ex.: Posts / Fotos no perfil): rótulo + traço `brand` sob a ativa. */
export function Tabs<K extends string>({ items, value, onChange }: TabsProps<K>) {
  const t = useTheme();
  return (
    <View
      accessibilityRole="tablist"
      style={{ flexDirection: 'row', borderBottomWidth: t.borders.hairline, borderColor: t.colors.border }}
    >
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.key)}
            style={({ pressed }) => ({
              flex: 1,
              minHeight: t.layout.minTouch,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent',
            })}
          >
            <Text bold={active} tone={active ? 'default' : 'muted'}>
              {item.label}
            </Text>
            <View
              style={{
                position: 'absolute',
                bottom: -t.borders.hairline,
                height: t.borders.selected,
                width: t.spacing.xxxl,
                borderRadius: t.radii.pill,
                backgroundColor: active ? t.colors.brand : 'transparent',
              }}
            />
          </Pressable>
        );
      })}
    </View>
  );
}
