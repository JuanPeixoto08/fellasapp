import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing, Pressable, View } from 'react-native';

import { Text } from '../ui';
import { useTheme } from '../../lib/theme';

type Props = {
  liked: boolean;
  count: number;
  onPress?: () => void;
};

/**
 * Curtir: o marca-texto "passa" por trás do rótulo (preenchimento amarelo que abre da esquerda)
 * junto com um pop curto. Ao descurtir, só some. Sem animação se reduzir movimento.
 */
export function LikeButton({ liked, count, onPress }: Props) {
  const t = useTheme();
  const fill = useRef(new Animated.Value(liked ? 1 : 0)).current;
  const pop = useRef(new Animated.Value(1)).current;
  const first = useRef(true);
  const reduceMotion = useRef(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled?.()
      ?.then((v) => {
        reduceMotion.current = v;
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    if (reduceMotion.current || !liked) {
      fill.setValue(liked ? 1 : 0);
      return;
    }
    fill.setValue(0);
    pop.setValue(0.92);
    const ease = Easing.out(Easing.exp);
    Animated.parallel([
      Animated.timing(fill, { toValue: 1, duration: t.motion.base * 2, easing: ease, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: t.motion.base * 2, easing: ease, useNativeDriver: true }),
    ]).start();
  }, [liked, fill, pop, t.motion.base]);

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}
      accessibilityValue={{ text: `${count} ${count === 1 ? 'curtida' : 'curtidas'}` }}
      accessibilityState={{ selected: liked }}
      hitSlop={t.spacing.xs}
    >
      <Animated.View
        style={{
          minHeight: t.layout.minTouch,
          minWidth: t.layout.minTouch,
          paddingHorizontal: t.spacing.md,
          borderRadius: t.radii.pill,
          borderWidth: 1,
          borderColor: liked ? t.colors.accent : t.colors.border,
          overflow: 'hidden',
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pop }],
        }}
      >
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: t.colors.accent,
            opacity: fill,
            transform: [{ scaleX: fill }],
          }}
        />
        <View>
          <Text
            variant="small"
            bold
            tone="muted"
            style={liked ? { color: t.colors.onAccent } : null}
          >
            {liked ? 'Curtiu' : 'Curtir'} · {count}
          </Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}
