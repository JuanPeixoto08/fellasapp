import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, FlatList, Image, Modal, PanResponder, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/theme';
import { Icon, Text, type IconName } from '../ui';

type Props = {
  uris: string[];
  /** Foto aberta; null fecha o visualizador. */
  index: number | null;
  onClose: () => void;
  /** Base do rótulo acessível de cada foto. */
  alt: string;
};

/** Tecla → ação no visualizador (web): ← → trocam de foto, Esc fecha. */
export function viewerKeyAction(
  key: string,
  current: number,
  count: number,
): { type: 'go'; to: number } | { type: 'close' } | null {
  if (key === 'Escape') return { type: 'close' };
  if (key === 'ArrowRight' && current < count - 1) return { type: 'go', to: current + 1 };
  if (key === 'ArrowLeft' && current > 0) return { type: 'go', to: current - 1 };
  return null;
}

/** Arrasto vertical a partir do qual soltar fecha (fração da altura da tela), ou velocidade de "jogar" a foto. */
const DISMISS_FRACTION = 0.15;
const DISMISS_VELOCITY = 0.8;

/** Ao soltar o arrasto vertical: fecha (para cima ou para baixo, como no Twitter) ou volta a foto ao lugar. */
export function swipeDismiss(dy: number, vy: number, screenHeight: number): 'close' | 'stay' {
  if (Math.abs(dy) > screenHeight * DISMISS_FRACTION) return 'close';
  if (Math.abs(vy) > DISMISS_VELOCITY && Math.sign(vy) === Math.sign(dy)) return 'close';
  return 'stay';
}

/** O gesto é vertical (fechar) e não horizontal (trocar de foto)? */
export function isVerticalSwipe(dx: number, dy: number): boolean {
  return Math.abs(dy) > 10 && Math.abs(dy) > Math.abs(dx) * 1.5;
}

/** Deslizar para fechar só no celular: no app nativo e na web com tela de toque (não com mouse). */
function touchDevice(): boolean {
  if (Platform.OS !== 'web') return true;
  return typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
}

/**
 * Fotos do post em tela cheia: desliza para os lados troca de foto, "1/3" no topo, ✕ à direita fecha.
 * No celular, arrastar a foto para cima ou para baixo também fecha. Sem zoom por enquanto.
 */
export function PhotoViewer({ uris, index, onClose, alt }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const list = useRef<FlatList<string>>(null);
  const [current, setCurrent] = useState(index ?? 0);
  const open = index !== null;
  const drag = useRef(new Animated.Value(0)).current;
  const swipe = useMemo(touchDevice, []);

  useEffect(() => {
    if (index !== null) {
      setCurrent(index);
      drag.setValue(0);
    }
  }, [index, drag]);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(uris.length - 1, to));
    setCurrent(next);
    list.current?.scrollToIndex({ index: next, animated: true });
  };

  // estado atual para o gesto (o PanResponder é criado uma vez só)
  const live = useRef({ height, onClose });
  live.current = { height, onClose };

  const responder = useMemo(() => {
    const useNativeDriver = Platform.OS !== 'web';
    const settle = () => Animated.spring(drag, { toValue: 0, useNativeDriver }).start();
    return PanResponder.create({
      // pega só o arrasto vertical; o horizontal continua com a lista (trocar de foto)
      onMoveShouldSetPanResponderCapture: (_, g) => isVerticalSwipe(g.dx, g.dy),
      onPanResponderMove: (_, g) => drag.setValue(g.dy),
      onPanResponderRelease: (_, g) => {
        const h = live.current.height;
        if (swipeDismiss(g.dy, g.vy, h) === 'stay') return settle();
        // a foto sai pelo lado para onde foi jogada, depois fecha
        Animated.timing(drag, { toValue: g.dy < 0 ? -h : h, duration: t.motion.base, useNativeDriver }).start(() =>
          live.current.onClose(),
        );
      },
      onPanResponderTerminate: settle,
    });
  }, [drag, t.motion.base]);

  // o fundo escuro some conforme a foto se afasta do centro
  const backdrop = drag.interpolate({ inputRange: [-height, 0, height], outputRange: [0, 1, 0] });

  // teclado só na web e só com o visualizador aberto
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const action = viewerKeyAction(e.key, current, uris.length);
      if (!action) return;
      e.preventDefault();
      if (action.type === 'close') onClose();
      else go(action.to);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  // botão sobre o fundo escuro: cor fixa clara, nos dois temas
  const control = (icon: IconName, label: string, onPress: () => void) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={{
        width: t.layout.minTouch,
        height: t.layout.minTouch,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.overlay,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name={icon} color={t.colors.onOverlay} />
    </Pressable>
  );

  return (
    <Modal visible={open} animationType="fade" onRequestClose={onClose} transparent>
      <View accessibilityViewIsModal style={{ flex: 1 }}>
        <Animated.View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: t.colors.viewerBg,
            opacity: backdrop,
          }}
        />
        {open ? (
          <Animated.View
            style={{ flex: 1, transform: [{ translateY: drag }] }}
            {...(swipe ? responder.panHandlers : null)}
          >
            <FlatList
              ref={list}
              data={uris}
              keyExtractor={(u) => u}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={index ?? 0}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={(e) => setCurrent(Math.round(e.nativeEvent.contentOffset.x / width))}
              renderItem={({ item, index: i }) => (
                <Image
                  source={{ uri: item }}
                  resizeMode="contain"
                  accessibilityLabel={uris.length > 1 ? `${alt} (${i + 1} de ${uris.length})` : alt}
                  style={{ width, height }}
                />
              )}
            />
          </Animated.View>
        ) : null}
        <View
          style={{
            position: 'absolute',
            top: insets.top + t.spacing.sm,
            left: t.spacing.sm,
            right: t.spacing.sm,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <View style={{ width: t.layout.minTouch }} />
          {uris.length > 1 ? (
            <Text bold style={{ color: t.colors.onOverlay }} accessibilityLiveRegion="polite">
              {current + 1}/{uris.length}
            </Text>
          ) : null}
          {control('close', 'Fechar fotos', onClose)}
        </View>
        {/* na web não tem gesto de deslizar com o mouse: setas para trocar de foto */}
        {Platform.OS === 'web' && uris.length > 1 ? (
          <View
            pointerEvents="box-none"
            style={{
              position: 'absolute',
              top: 0,
              bottom: 0,
              left: t.spacing.sm,
              right: t.spacing.sm,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            {current > 0 ? control('chevron-back', 'Foto anterior', () => go(current - 1)) : <View />}
            {current < uris.length - 1 ? control('chevron-forward', 'Próxima foto', () => go(current + 1)) : <View />}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
