import { useEffect, useRef, useState, type RefObject } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';

import { pushRecentEmoji, QUICK_REACTIONS } from '../../lib/emoji';
import { placePopover, type Rect } from '../../lib/popover';
import { useTheme } from '../../lib/theme';
import { Emoji, IconButton } from '../ui';
import { EmojiPicker } from './EmojiPicker';

export const DEFAULT_REACTION_EMOJIS: readonly string[] = QUICK_REACTIONS;

/** O que dá para medir na tela (o View em volta do botão de reagir). */
type Measurable = { measureInWindow: (cb: (x: number, y: number, width: number, height: number) => void) => void };

type Props = {
  visible: boolean;
  selected: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  emojis?: readonly string[];
  /** Botão de reagir: a barra (e o painel de mais emojis no computador) abre presa a ele. */
  anchorRef?: RefObject<Measurable | View | null>;
};

/**
 * Barra em pílula com os emojis rápidos e um "+" que abre o seletor completo, presa ao botão de reagir
 * (acima dele; sem espaço, embaixo). Se a minha reação não é um dos rápidos, ela aparece primeiro
 * (tocar remove). Toque fora fecha.
 */
export function ReactionPicker({
  visible,
  selected,
  onSelect,
  onClose,
  emojis = DEFAULT_REACTION_EMOJIS,
  anchorRef,
}: Props) {
  const t = useTheme();
  const viewport = useWindowDimensions();
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reduceMotion = useRef(false);
  const [full, setFull] = useState(false);
  const [anchor, setAnchor] = useState<Rect | null>(null);
  const quick = selected && !emojis.includes(selected) ? [selected, ...emojis.slice(0, emojis.length - 1)] : emojis;

  useEffect(() => {
    if (!visible) {
      setFull(false);
      setAnchor(null);
      return;
    }
    const node = anchorRef?.current as Measurable | null | undefined;
    node?.measureInWindow?.((x, y, width, height) => setAnchor({ x, y, width, height }));
  }, [visible, anchorRef]);

  const pick = (emoji: string) => {
    pushRecentEmoji(emoji);
    onSelect(emoji);
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => {
        reduceMotion.current = v;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!visible) return;
    if (reduceMotion.current) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, {
      toValue: 1,
      duration: t.motion.base,
      easing: Easing.out(Easing.exp),
      useNativeDriver: true,
    }).start();
  }, [visible, anim, t.motion.base]);

  // tamanho da pílula: os rápidos + o "+", cada um com alvo de 44
  const slots = quick.length + 1;
  const size = {
    width: slots * t.layout.minTouch + (slots - 1) * t.spacing.xs + t.spacing.xs * 2,
    height: t.layout.minTouch + t.spacing.xs * 2,
  };
  const place = anchor ? placePopover(anchor, size, viewport, t.layout.gutter, t.spacing.xs) : null;

  return (
    <>
      {/* só monta quando o "+" é tocado: cada post tem um ReactionPicker */}
      {visible && full ? (
        <EmojiPicker visible selected={selected} onSelect={onSelect} onClose={onClose} anchor={anchor} />
      ) : null}
      <Modal visible={visible && !full} transparent animationType="none" onRequestClose={onClose}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel="Fechar reações"
            style={StyleSheet.absoluteFill}
          />
          <Animated.View
            accessibilityRole="toolbar"
            accessibilityLabel="Escolher reação"
            style={[
              {
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.xs,
                padding: t.spacing.xs,
                borderRadius: t.radii.pill,
                backgroundColor: t.colors.surface,
                borderWidth: t.borders.hairline,
                borderColor: t.colors.border,
                opacity: anim,
                transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
              },
              // preso ao botão; sem medida (ex.: teste), fica no centro
              place ? { position: 'absolute', left: place.left, top: place.top, width: size.width } : null,
              t.shadows.raised,
            ]}
          >
            {quick.map((emoji) => {
              const isSelected = emoji === selected;
              return (
                <Pressable
                  key={emoji}
                  onPress={() => pick(emoji)}
                  accessibilityRole="button"
                  accessibilityLabel={`Reagir com ${emoji}`}
                  accessibilityState={{ selected: isSelected }}
                >
                  <View
                    style={{
                      minHeight: t.layout.minTouch,
                      minWidth: t.layout.minTouch,
                      borderRadius: t.radii.pill,
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isSelected ? t.colors.accent : 'transparent',
                    }}
                  >
                    <Emoji emoji={emoji} size="lg" />
                  </View>
                </Pressable>
              );
            })}
            <IconButton icon="add" accessibilityLabel="Mais emojis" variant="ghost" tone="muted" onPress={() => setFull(true)} />
          </Animated.View>
        </View>
      </Modal>
    </>
  );
}
