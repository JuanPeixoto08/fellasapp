import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStory, MAX_VIDEO_MS, STORY_PHOTO_MS, uploadStoryMedia, type StoryKind } from '../../lib/api/stories';
import { shrinkForUpload } from '../../lib/imageUpload';
import { imagesFromPaste } from '../../lib/pasteImages';
import { emitStoriesChanged } from '../../lib/storyViewerStore';
import { useTheme } from '../../lib/theme';
import { videoDurationMs } from '../../lib/videoDuration';
import { Button, IconButton, Text } from '../ui';

/** Folga para o arredondamento da duração lida do arquivo. */
const DURATION_SLACK_MS = 500;

type Picked = { kind: StoryKind; uri: string; durationMs: number };
type Asset = { uri: string; type?: string | null; duration?: number | null };

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  return <VideoView player={player} nativeControls={false} contentFit="contain" style={{ width: '100%', height: '100%' }} />;
}

type Props = { visible: boolean; onClose: () => void };

/**
 * Postar story: abre a galeria (foto ou vídeo até 15 s), mostra a prévia em tela cheia e envia. No
 * computador, Ctrl+V com uma imagem também vira o story.
 */
export function StoryComposer({ visible, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [picked, setPicked] = useState<Picked | null>(null);
  const [tooLong, setTooLong] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // a tela de fora costuma passar () => ... novo a cada render: sem ref, a galeria reabriria
  const close = useRef(onClose);
  close.current = onClose;

  const use = useCallback(async (asset: Asset) => {
    setError(null);
    setTooLong(false);
    if (asset.type !== 'video') {
      setPicked({ kind: 'photo', uri: asset.uri, durationMs: STORY_PHOTO_MS });
      return;
    }
    const duration = asset.duration ?? (await videoDurationMs(asset.uri)) ?? MAX_VIDEO_MS;
    if (duration > MAX_VIDEO_MS + DURATION_SLACK_MS) {
      setPicked(null);
      setTooLong(true);
      return;
    }
    setPicked({ kind: 'video', uri: asset.uri, durationMs: Math.min(Math.max(1, Math.round(duration)), MAX_VIDEO_MS) });
  }, []);

  const pick = useCallback(async () => {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      videoMaxDuration: MAX_VIDEO_MS / 1000,
      quality: 1,
      allowsMultipleSelection: false,
    });
    if (res.canceled || !res.assets?.[0]) return false;
    await use(res.assets[0]);
    return true;
  }, [use]);

  // abriu: vai direto para a galeria; desistiu sem nada escolhido, fecha
  useEffect(() => {
    if (!visible) {
      setPicked(null);
      setTooLong(false);
      setSending(false);
      setError(null);
      return;
    }
    let alive = true;
    pick()
      .then((ok) => {
        if (alive && !ok) close.current();
      })
      .catch(() => {
        if (alive) setError('Não consegui abrir suas fotos. Confere a permissão do app e tenta de novo.');
      });
    return () => {
      alive = false;
    };
  }, [visible, pick]);

  // web: Ctrl+V com imagem vira o story
  useEffect(() => {
    if (!visible || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onPaste = (e: ClipboardEvent) => {
      const [file] = imagesFromPaste(e as never);
      if (file) void use({ uri: URL.createObjectURL(file), type: 'image' });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [visible, use]);

  const post = async () => {
    if (!picked || sending) return;
    setSending(true);
    setError(null);
    try {
      const source = picked.kind === 'photo' ? await shrinkForUpload(picked.uri) : picked.uri;
      const { url } = await uploadStoryMedia(source);
      await createStory({ kind: picked.kind, mediaUrl: url, durationMs: picked.durationMs });
      emitStoriesChanged();
      onClose();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Não rolou postar. Tenta de novo.');
    } finally {
      setSending(false);
    }
  };

  const onOverlay = { color: t.colors.onOverlay };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.colors.viewerBg, paddingTop: insets.top, paddingBottom: insets.bottom + t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: t.spacing.sm }}>
          <IconButton icon="close" accessibilityLabel="Cancelar" variant="ghost" tone="onOverlay" onPress={onClose} disabled={sending} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.layout.gutter, gap: t.spacing.lg }}>
          {tooLong ? (
            <>
              <Text align="center" style={onOverlay}>
                Esse vídeo passa de 15 s. Escolhe um menor.
              </Text>
              <Button title="Escolher outro" variant="secondary" onPress={() => void pick()} />
            </>
          ) : picked ? (
            picked.kind === 'video' ? (
              <PreviewVideo uri={picked.uri} />
            ) : (
              <Image source={{ uri: picked.uri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
            )
          ) : error ? null : (
            <ActivityIndicator color={t.colors.onOverlay} accessibilityLabel="Abrindo suas fotos" />
          )}
        </View>

        {error ? (
          <Text accessibilityRole="alert" align="center" style={[onOverlay, { paddingHorizontal: t.layout.gutter, paddingBottom: t.spacing.sm }]}>
            {error}
          </Text>
        ) : null}
        {picked && !tooLong ? (
          <View style={{ paddingHorizontal: t.layout.gutter }}>
            <Button
              title="Postar story"
              accessibilityLabel={sending ? 'Enviando…' : 'Postar story'}
              variant="secondary"
              fullWidth
              loading={sending}
              onPress={post}
            />
          </View>
        ) : null}
      </View>
    </Modal>
  );
}
