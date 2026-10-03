import { useEffect, useRef } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon } from '../ui';
import { ActionButton } from './ActionButton';

type Props = {
  liked: boolean;
  count: number;
  onPress?: () => void;
};

/** Curtir: coração que enche de vermelho com um pulinho curto. Sem animação se reduzir movimento. */
export function LikeButton({ liked, count, onPress }: Props) {
  const t = useTheme();
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
    if (!liked || reduceMotion.current) return;
    const ease = Easing.out(Easing.exp);
    Animated.sequence([
      Animated.timing(pop, { toValue: 1.25, duration: t.motion.fast, easing: ease, useNativeDriver: true }),
      Animated.timing(pop, { toValue: 1, duration: t.motion.fast, easing: ease, useNativeDriver: true }),
    ]).start();
  }, [liked, pop, t.motion.fast]);

  return (
    <ActionButton
      onPress={onPress}
      count={count}
      countColor={liked ? t.colors.like : undefined}
      accessibilityLabel={liked ? 'Descurtir' : 'Curtir'}
      accessibilityValue={{ text: `${count} ${count === 1 ? 'curtida' : 'curtidas'}` }}
      accessibilityState={{ selected: liked }}
    >
      <Animated.View style={{ transform: [{ scale: pop }] }}>
        <Icon name={liked ? 'heart' : 'heart-outline'} tone="muted" color={liked ? t.colors.like : undefined} />
      </Animated.View>
    </ActionButton>
  );
}
