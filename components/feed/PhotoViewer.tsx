import { useEffect, useRef, useState } from 'react';
import { FlatList, Image, Modal, Platform, Pressable, useWindowDimensions, View } from 'react-native';
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

/** Fotos do post em tela cheia: desliza para os lados, "1/3" no topo, ✕ fecha. Sem zoom por enquanto. */
export function PhotoViewer({ uris, index, onClose, alt }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const list = useRef<FlatList<string>>(null);
  const [current, setCurrent] = useState(index ?? 0);
  const open = index !== null;

  useEffect(() => {
    if (index !== null) setCurrent(index);
  }, [index]);

  const go = (to: number) => {
    const next = Math.max(0, Math.min(uris.length - 1, to));
    setCurrent(next);
    list.current?.scrollToIndex({ index: next, animated: true });
  };

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
      <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: t.colors.viewerBg }}>
        {open ? (
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
          {control('close', 'Fechar fotos', onClose)}
          {uris.length > 1 ? (
            <Text bold style={{ color: t.colors.onOverlay }} accessibilityLiveRegion="polite">
              {current + 1}/{uris.length}
            </Text>
          ) : null}
          <View style={{ width: t.layout.minTouch }} />
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
