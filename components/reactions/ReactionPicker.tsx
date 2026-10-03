import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, View } from 'react-native';

import { pushRecentEmoji, QUICK_REACTIONS } from '../../lib/emoji';
import { useTheme } from '../../lib/theme';
import { IconButton, Text } from '../ui';
import { EmojiPicker } from './EmojiPicker';

export const DEFAULT_REACTION_EMOJIS: readonly string[] = QUICK_REACTIONS;

type Props = {
  visible: boolean;
  selected: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  emojis?: readonly string[];
};

/**
 * Barra flutuante em pílula com os emojis rápidos e um "+" que abre o seletor completo.
 * Se a minha reação não é um dos rápidos, ela aparece primeiro (tocar remove). Toque fora fecha.
 */
export function ReactionPicker({ visible, selected, onSelect, onClose, emojis = DEFAULT_REACTION_EMOJIS }: Props) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reduceMotion = useRef(false);
  const [full, setFull] = useState(false);
  const quick = selected && !emojis.includes(selected) ? [selected, ...emojis.slice(0, emojis.length - 1)] : emojis;

  useEffect(() => {
    if (!visible) setFull(false);
  }, [visible]);

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

  return (
    <>
      {/* só monta quando o "+" é tocado: cada post tem um ReactionPicker */}
      {visible && full ? <EmojiPicker visible selected={selected} onSelect={onSelect} onClose={onClose} /> : null}
      <Modal visible={visible && !full} transparent animationType="none" onRequestClose={onClose}>
        <View style={{ flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center' }}>
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
                    <Text variant="title">{emoji}</Text>
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
