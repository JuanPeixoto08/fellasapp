import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { useTheme } from '../../lib/theme';

const BARS = 3;

/** Três barrinhas subindo e descendo ("tocando agora"). Com "reduzir movimento", ficam paradas. */
export function EqualizerBars() {
  const t = useTheme();
  const height = t.iconSizes.sm * 0.6;
  const values = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.4))).current;
  const [still, setStill] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduce) => !cancelled && setStill(!!reduce))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (still) return;
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300 + i * 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 300 + i * 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [still, values]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.borders.hairline * 2, height }}
    >
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: t.borders.hairline * 2,
            height,
            backgroundColor: t.colors.brand,
            transform: [{ scaleY: still ? 0.7 : v }],
          }}
        />
      ))}
    </View>
  );
}
