import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, Text as RNText, View } from 'react-native';

import { useTheme } from '../../lib/theme';

export const DEFAULT_REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

type Props = {
  visible: boolean;
  selected: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  emojis?: readonly string[];
};

/** Barra flutuante em pílula com os emojis de reação; toque fora fecha. */
export function ReactionPicker({ visible, selected, onSelect, onClose, emojis = DEFAULT_REACTION_EMOJIS }: Props) {
  const t = useTheme();
  const anim = useRef(new Animated.Value(visible ? 1 : 0)).current;
  const reduceMotion = useRef(false);

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
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Fechar reações"
        style={{ flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', justifyContent: 'center' }}
      >
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
              borderWidth: 1,
              borderColor: t.colors.border,
              opacity: anim,
              transform: [{ scale: anim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) }],
            },
            t.shadows.raised,
          ]}
        >
          {emojis.map((emoji) => {
            const isSelected = emoji === selected;
            return (
              <Pressable
                key={emoji}
                onPress={() => onSelect(emoji)}
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
                  <RNText style={{ fontSize: 26 }}>{emoji}</RNText>
                </View>
              </Pressable>
            );
          })}
        </Animated.View>
      </Pressable>
    </Modal>
  );
}
