import { useRef, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { ChoiceRow } from './ChoiceRow';
import { Icon } from './Icon';
import { Text } from './Text';

export type SelectOption<T> = { value: T; label: string };

export type SelectProps<T extends string | number> = {
  /** Rótulo pequeno em cima do valor ("Dias"). */
  label: string;
  value: T;
  options: SelectOption<T>[];
  onChange: (value: T) => void;
  disabled?: boolean;
};

type Rect = { x: number; y: number; width: number; height: number };
type Measurable = { measureInWindow?: (cb: (x: number, y: number, width: number, height: number) => void) => void };

/** Linhas visíveis da lista antes de rolar. */
const VISIBLE_ROWS = 6;
/** Largura mínima da lista (campos estreitos, como Minutos no celular). */
const MIN_LIST_WIDTH = 96;

/**
 * Lista suspensa como no Twitter: campo com contorno (rótulo pequeno, valor e seta), tocar abre a lista
 * presa ao campo (embaixo; sem espaço, em cima). Igual no app e na web.
 */
export function Select<T extends string | number>({ label, value, options, onChange, disabled }: SelectProps<T>) {
  const t = useTheme();
  const viewport = useWindowDimensions();
  const field = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const current = options.find((o) => o.value === value);
  const shown = current?.label ?? String(value);

  const openList = () => {
    if (disabled) return;
    setAnchor(null);
    (field.current as unknown as Measurable | null)?.measureInWindow?.((x, y, width, height) =>
      setAnchor({ x, y, width, height }),
    );
    setOpen(true);
  };

  const row = t.layout.minTouch;
  const padding = t.spacing.xs;
  const listHeight = Math.min(options.length, VISIBLE_ROWS) * row + padding * 2;
  const margin = t.layout.gutter;
  const width = Math.min(Math.max(anchor?.width ?? MIN_LIST_WIDTH, MIN_LIST_WIDTH), viewport.width - margin * 2);
  let top = viewport.height / 3;
  let left: number = margin;
  if (anchor) {
    const below = anchor.y + anchor.height + t.spacing.xs;
    const above = anchor.y - listHeight - t.spacing.xs;
    top = below + listHeight <= viewport.height - margin || above < margin ? below : above;
    top = Math.max(margin, Math.min(top, viewport.height - listHeight - margin));
    left = Math.max(margin, Math.min(anchor.x, viewport.width - width - margin));
  }
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === value));

  return (
    <>
      <Pressable
        ref={field}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${shown}`}
        accessibilityHint="Abre a lista"
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        onPress={openList}
        style={({ pressed }) => ({
          flex: 1,
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.xs,
          minHeight: t.layout.minTouch + t.spacing.md,
          // estreito: no celular cabem três lado a lado (Dias / Horas / Minutos)
          paddingHorizontal: t.spacing.sm,
          paddingVertical: t.spacing.xs,
          borderWidth: t.borders.hairline,
          borderColor: open ? t.colors.primary : t.colors.border,
          borderRadius: t.radii.md,
          backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent',
          opacity: disabled ? 0.5 : 1,
          cursor: disabled ? undefined : ('pointer' as const),
        })}
      >
        <View style={{ flex: 1 }}>
          <Text variant="caption" tone="muted" numberOfLines={1}>
            {label}
          </Text>
          <Text numberOfLines={1}>{shown}</Text>
        </View>
        <Icon name="chevron-down" tone="muted" />
      </Pressable>
      <Modal visible={open} transparent animationType="none" onRequestClose={() => setOpen(false)}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Fechar lista"
          onPress={() => setOpen(false)}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          accessibilityLabel={label}
          style={{
            position: 'absolute',
            top,
            left,
            width,
            height: listHeight,
            backgroundColor: t.colors.surface,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            borderRadius: t.radii.md,
            overflow: 'hidden',
            ...t.shadows.raised,
          }}
        >
          <ScrollView
            contentContainerStyle={{ padding: padding, paddingHorizontal: t.spacing.sm }}
            // abre com a escolhida à vista
            contentOffset={{ x: 0, y: Math.max(0, (selectedIndex - 2) * row) }}
          >
            {options.map((o) => (
              <ChoiceRow
                key={String(o.value)}
                label={o.label}
                selected={o.value === value}
                onPress={() => {
                  setOpen(false);
                  if (o.value !== value) onChange(o.value);
                }}
              />
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
