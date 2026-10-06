import { useRef, useState } from 'react';
import { View, type AccessibilityActionEvent, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';

import { useTheme } from '../../lib/theme';

export type SliderProps = {
  /** De 0 a 1. */
  value: number;
  onChange: (value: number) => void;
  accessibilityLabel: string;
  /** `onOverlay`: claro, por cima de foto/vídeo. */
  tone?: 'default' | 'onOverlay';
  /** Começou/terminou de arrastar (quem esconde a barra no hover espera soltar). */
  onSlidingStart?: () => void;
  onSlidingEnd?: () => void;
};

/** Passo do teclado e do leitor de tela. */
const STEP = 0.1;
const clamp = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 100) / 100;
/** Setas do teclado (site): direita/cima aumenta, esquerda/baixo diminui. */
const KEY_STEP: Record<string, number> = { ArrowRight: STEP, ArrowUp: STEP, ArrowLeft: -STEP, ArrowDown: -STEP };

type KeyEvent = { nativeEvent: { key: string }; preventDefault: () => void };

/** Barra deslizante horizontal: tocar pula para o ponto, arrastar acompanha (mesmo saindo do trilho). */
export function Slider({ value, onChange, accessibilityLabel, tone = 'default', onSlidingStart, onSlidingEnd }: SliderProps) {
  const t = useTheme();
  const { width: size, track, thumb } = t.layout.slider;
  const [width, setWidth] = useState<number>(size);
  // posição do trilho na página, medida no toque: o arraste continua certo fora dele
  const origin = useRef(0);
  const at = (pageX: number) => onChange(clamp((pageX - origin.current) / width));
  const fill = tone === 'onOverlay' ? t.colors.onOverlay : t.colors.primary;
  const rest = tone === 'onOverlay' ? t.colors.overlay : t.colors.border;
  const shown = clamp(value);

  return (
    <View
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={accessibilityLabel}
      // aria-* (e não accessibilityValue): o react-native-web 0.21 só repassa estes para o <div>
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(shown * 100)}
      aria-valuetext={`${Math.round(shown * 100)}%`}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(e: AccessibilityActionEvent) => {
        if (e.nativeEvent.actionName === 'increment') onChange(clamp(shown + STEP));
        if (e.nativeEvent.actionName === 'decrement') onChange(clamp(shown - STEP));
      }}
      focusable
      // react-native-web repassa a tecla; no app o leitor de tela usa as ações acima
      {...({
        onKeyDown: (e: KeyEvent) => {
          const step = KEY_STEP[e.nativeEvent.key];
          if (step === undefined) return;
          e.preventDefault();
          onChange(clamp(shown + step));
        },
      } as object)}
      onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width || size)}
      onStartShouldSetResponder={() => true}
      onResponderTerminationRequest={() => false}
      onResponderGrant={(e: GestureResponderEvent) => {
        // trilho e bolinha não recebem toque: locationX é sempre relativo ao trilho
        origin.current = e.nativeEvent.pageX - e.nativeEvent.locationX;
        onSlidingStart?.();
        at(e.nativeEvent.pageX);
      }}
      onResponderMove={(e: GestureResponderEvent) => at(e.nativeEvent.pageX)}
      onResponderRelease={() => onSlidingEnd?.()}
      onResponderTerminate={() => onSlidingEnd?.()}
      style={{ width: size, height: t.layout.minTouch, justifyContent: 'center' }}
    >
      <View pointerEvents="none" style={{ height: track, borderRadius: t.radii.pill, backgroundColor: rest }}>
        <View style={{ width: `${shown * 100}%`, height: '100%', borderRadius: t.radii.pill, backgroundColor: fill }} />
      </View>
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: shown * width - thumb / 2,
          width: thumb,
          height: thumb,
          borderRadius: t.radii.pill,
          backgroundColor: fill,
        }}
      />
    </View>
  );
}
