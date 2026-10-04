import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  PanResponder,
  Platform,
  View,
  useWindowDimensions,
  type GestureResponderEvent,
  type NativeTouchEvent,
  type PanResponderGestureState,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AVATAR_CROP,
  clampOffset,
  clampZoom,
  cropRect,
  pinchZoom,
  scaleFor,
  stepZoom,
  type Offset,
  type Size,
} from '../../lib/avatarCrop';
import { useLayoutTier } from '../../lib/layout';
import { useTheme } from '../../lib/theme';
import { Button, Heading, IconButton, Text } from '../ui';

type Props = {
  /** Foto escolhida; null = fechado. */
  uri: string | null;
  onCancel: () => void;
  /** Recebe o uri do recorte (quadrado 512, JPEG). */
  onConfirm: (uri: string) => void;
};

/** Sensibilidade da roda do mouse / pinça do touchpad (web). */
const WHEEL_ZOOM = 0.002;
const CENTER: Offset = { x: 0, y: 0 };

function fingerDistance(touches: NativeTouchEvent[]): number {
  const [a, b] = touches;
  return Math.hypot(a.pageX - b.pageX, a.pageY - b.pageY);
}

/**
 * "Ajustar foto" da foto de perfil: arrasta pra enquadrar no círculo, zoom por pinça, roda do mouse ou
 * botões. Tela cheia no celular, janela no computador. O recorte sai quadrado; o círculo é o Avatar.
 */
export function AvatarCropper({ uri, onCancel, onConfirm }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width: windowWidth } = useWindowDimensions();
  const full = useLayoutTier() === 'compact';
  const panelWidth = full ? windowWidth : Math.min(windowWidth - t.layout.gutter * 2, t.layout.maxDialogWidth);
  const stage = panelWidth - t.layout.gutter * 2;
  const viewport = stage - t.spacing.xl * 2;

  const [image, setImage] = useState<Size | null>(null);
  const [failed, setFailed] = useState(false);
  const [zoom, setZoom] = useState<number>(AVATAR_CROP.minZoom);
  const [offset, setOffset] = useState<Offset>(CENTER);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImage(null);
    setFailed(false);
    setZoom(AVATAR_CROP.minZoom);
    setOffset(CENTER);
    setSaving(false);
    setError(null);
    if (!uri) return;
    let alive = true;
    ImageManipulator.manipulate(uri)
      .renderAsync()
      .then((img) => alive && setImage({ width: img.width, height: img.height }))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uri]);

  // estado atual para os gestos (o PanResponder é criado uma vez só)
  const live = useRef({ image, viewport, zoom, offset });
  live.current = { image, viewport, zoom, offset };

  const applyZoom = (next: number, from: Offset = live.current.offset) => {
    const { image: img, viewport: v } = live.current;
    if (!img) return;
    const z = clampZoom(next);
    setZoom(z);
    setOffset(clampOffset(img, v, z, from));
  };

  const gesture = useRef({ startOffset: CENTER, startZoom: 1, startDistance: 0, fingers: 0, baseDx: 0, baseDy: 0 });
  const responder = useMemo(() => {
    const begin = (e: GestureResponderEvent, g: PanResponderGestureState) => {
      const touches = e.nativeEvent.touches;
      gesture.current = {
        startOffset: live.current.offset,
        startZoom: live.current.zoom,
        startDistance: touches.length >= 2 ? fingerDistance(touches) : 0,
        fingers: touches.length,
        baseDx: g.dx,
        baseDy: g.dy,
      };
    };
    return PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: begin,
      onPanResponderMove: (e, g) => {
        const touches = e.nativeEvent.touches;
        // trocou de 1 para 2 dedos (ou o contrário): recomeça o gesto de onde a foto está
        if (touches.length !== gesture.current.fingers) begin(e, g);
        const start = gesture.current;
        const { image: img, viewport: v, zoom: z } = live.current;
        if (!img) return;
        if (touches.length >= 2) {
          applyZoom(pinchZoom(start.startZoom, start.startDistance, fingerDistance(touches)), start.startOffset);
        } else {
          setOffset(
            clampOffset(img, v, z, {
              x: start.startOffset.x + g.dx - start.baseDx,
              y: start.startOffset.y + g.dy - start.baseDy,
            }),
          );
        }
      },
    });
  }, []);

  // web: roda do mouse e pinça do touchpad (chega como wheel)
  const stageRef = useRef<View>(null);
  useEffect(() => {
    const node = stageRef.current as unknown as HTMLElement | null;
    if (Platform.OS !== 'web' || !image || !node?.addEventListener) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      applyZoom(live.current.zoom * Math.exp(-e.deltaY * WHEEL_ZOOM));
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
  }, [image]);

  async function confirm() {
    if (!uri || !image) return;
    setSaving(true);
    setError(null);
    try {
      const rect = cropRect(image, viewport, zoom, offset);
      const cropped = await ImageManipulator.manipulate(uri)
        .crop(rect)
        .resize({ width: AVATAR_CROP.output, height: AVATAR_CROP.output })
        .renderAsync();
      const saved = await cropped.saveAsync({ compress: AVATAR_CROP.quality, format: SaveFormat.JPEG });
      onConfirm(saved.uri);
    } catch {
      setError('Não rolou recortar. Tenta de novo.');
    } finally {
      setSaving(false);
    }
  }

  const scale = image ? scaleFor(image, viewport, zoom) : 0;
  // anel escuro em volta do círculo: borda tão grossa que cobre o resto do palco (que corta o excesso)
  const dim = stage;
  const body = (
    <View style={{ gap: t.spacing.lg }}>
      <View style={{ gap: t.spacing.xs }}>
        <Heading level={2}>Ajustar foto</Heading>
        <Text variant="small" tone="muted">
          Arrasta pra enquadrar. Pra dar zoom, pinça, roda do mouse ou os botões.
        </Text>
      </View>

      {failed ? (
        <Text tone="danger" accessibilityRole="alert">
          Não consegui abrir essa foto. Tenta outra.
        </Text>
      ) : (
        <View
          ref={stageRef}
          accessibilityLabel="Foto pra enquadrar"
          {...(image ? responder.panHandlers : {})}
          style={{
            width: stage,
            height: stage,
            alignSelf: 'center',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
            borderRadius: t.radii.lg,
            backgroundColor: t.colors.viewerBg,
          }}
        >
          {image && uri ? (
            <>
              <Image
                source={{ uri }}
                style={{
                  position: 'absolute',
                  width: image.width * scale,
                  height: image.height * scale,
                  left: stage / 2 + offset.x - (image.width * scale) / 2,
                  top: stage / 2 + offset.y - (image.height * scale) / 2,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: viewport + dim * 2,
                  height: viewport + dim * 2,
                  borderRadius: t.radii.pill,
                  borderWidth: dim,
                  borderColor: t.colors.overlay,
                }}
              />
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  width: viewport,
                  height: viewport,
                  borderRadius: t.radii.pill,
                  borderWidth: t.borders.hairline,
                  borderColor: t.colors.onOverlay,
                }}
              />
            </>
          ) : (
            <ActivityIndicator color={t.colors.onOverlay} accessibilityLabel="Abrindo a foto" />
          )}
        </View>
      )}

      {image ? (
        <View style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.md }}>
          <IconButton
            icon="remove-outline"
            accessibilityLabel="Diminuir zoom"
            disabled={zoom <= AVATAR_CROP.minZoom || saving}
            onPress={() => applyZoom(stepZoom(zoom, -1))}
          />
          <IconButton
            icon="add-outline"
            accessibilityLabel="Aumentar zoom"
            disabled={zoom >= AVATAR_CROP.maxZoom || saving}
            onPress={() => applyZoom(stepZoom(zoom, 1))}
          />
        </View>
      ) : null}

      {error ? (
        <Text tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: t.spacing.md }}>
        <View style={{ flex: 1 }}>
          <Button title="Cancelar" variant="secondary" fullWidth onPress={onCancel} disabled={saving} />
        </View>
        {image ? (
          <View style={{ flex: 1 }}>
            <Button title="Usar foto" fullWidth loading={saving} onPress={confirm} />
          </View>
        ) : null}
      </View>
    </View>
  );

  return (
    <Modal visible={!!uri} transparent={!full} animationType="fade" onRequestClose={onCancel}>
      {full ? (
        <View
          accessibilityViewIsModal
          style={{
            flex: 1,
            backgroundColor: t.colors.bg,
            paddingTop: insets.top + t.spacing.lg,
            paddingBottom: insets.bottom + t.spacing.lg,
            paddingHorizontal: t.layout.gutter,
          }}
        >
          {body}
        </View>
      ) : (
        <View
          style={{
            flex: 1,
            backgroundColor: t.colors.overlay,
            alignItems: 'center',
            justifyContent: 'center',
            padding: t.layout.gutter,
          }}
        >
          <View
            accessibilityViewIsModal
            style={[
              {
                width: panelWidth,
                padding: t.layout.gutter,
                backgroundColor: t.colors.bg,
                borderRadius: t.radii.lg,
                borderWidth: t.borders.hairline,
                borderColor: t.colors.border,
              },
              t.shadows.raised,
            ]}
          >
            {body}
          </View>
        </View>
      )}
    </Modal>
  );
}
