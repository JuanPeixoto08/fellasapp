import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  createStory,
  MAX_VIDEO_MS,
  STORY_PHOTO_MS,
  StoryUploadError,
  uploadStoryMedia,
  type StoryKind,
} from '../../lib/api/stories';
import { friendlyError } from '../../lib/errors';
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
/** Vídeo que não dá para postar: longo demais ou duração ilegível. */
type Problem = 'tooLong' | 'unreadable' | null;

const PROBLEM_TEXT: Record<Exclude<Problem, null>, string> = {
  tooLong: 'Esse vídeo passa de 15 s. Escolhe um menor.',
  unreadable: 'Não consegui ler esse vídeo. Tenta outro.',
};

function PreviewVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (p) => {
    p.muted = true;
    p.loop = true;
    p.play();
  });
  // playsInline: sem isso o Safari do iPhone abre o player do sistema em tela cheia
  return (
    <VideoView player={player} nativeControls={false} playsInline contentFit="contain" style={{ width: '100%', height: '100%' }} />
  );
}

/**
 * Duração em ms. Na web a galeria entrega `duration` em segundos (e 0 quando falha), então vale a lida
 * do arquivo; no celular vem em ms. null = ilegível.
 */
async function durationOf(asset: Asset): Promise<number | null> {
  const fromPicker = Platform.OS === 'web' ? null : asset.duration;
  const ms = fromPicker && fromPicker > 0 ? fromPicker : await videoDurationMs(asset.uri);
  return ms && Number.isFinite(ms) && ms > 0 ? ms : null;
}

type Props = { visible: boolean; onClose: () => void };

/**
 * Postar story: foto ou vídeo até 15 s, prévia em tela cheia e envio. No celular a galeria abre na hora;
 * no computador abre com um botão de escolher e dá para colar uma imagem (Ctrl+V).
 */
export function StoryComposer({ visible, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const web = Platform.OS === 'web';
  const [picked, setPicked] = useState<Picked | null>(null);
  const [problem, setProblem] = useState<Problem>(null);
  const [opening, setOpening] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // a tela de fora costuma passar () => ... novo a cada render: sem ref, a galeria reabriria
  const close = useRef(onClose);
  close.current = onClose;

  const use = useCallback(async (asset: Asset) => {
    setError(null);
    setProblem(null);
    if (asset.type !== 'video') {
      setPicked({ kind: 'photo', uri: asset.uri, durationMs: STORY_PHOTO_MS });
      return;
    }
    const duration = await durationOf(asset);
    if (duration === null || duration > MAX_VIDEO_MS + DURATION_SLACK_MS) {
      setPicked(null);
      setProblem(duration === null ? 'unreadable' : 'tooLong');
      return;
    }
    setPicked({ kind: 'video', uri: asset.uri, durationMs: Math.min(Math.round(duration), MAX_VIDEO_MS) });
  }, []);

  /** Abre a galeria; false se a pessoa desistiu. */
  const pick = useCallback(async () => {
    setOpening(true);
    try {
      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images', 'videos'],
        videoMaxDuration: MAX_VIDEO_MS / 1000,
        quality: 1,
        allowsMultipleSelection: false,
      });
      if (res.canceled || !res.assets?.[0]) return false;
      await use(res.assets[0]);
      return true;
    } catch {
      setError('Não consegui abrir suas fotos. Confere a permissão do app e tenta de novo.');
      return true;
    } finally {
      setOpening(false);
    }
  }, [use]);

  // celular: abriu, vai direto para a galeria (desistiu sem nada, fecha). Computador: espera o botão ou Ctrl+V
  useEffect(() => {
    if (!visible) {
      setPicked(null);
      setProblem(null);
      setSending(false);
      setError(null);
      return;
    }
    if (web) return;
    let alive = true;
    pick().then((ok) => {
      if (alive && !ok) close.current();
    });
    return () => {
      alive = false;
    };
  }, [visible, pick, web]);

  // web: Ctrl+V com imagem vira o story
  useEffect(() => {
    if (!visible || !web || typeof document === 'undefined') return;
    const onPaste = (e: ClipboardEvent) => {
      const [file] = imagesFromPaste(e as never);
      if (file) void use({ uri: URL.createObjectURL(file), type: 'image' });
    };
    document.addEventListener('paste', onPaste);
    return () => document.removeEventListener('paste', onPaste);
  }, [visible, web, use]);

  const post = async () => {
    if (!picked || sending) return;
    setSending(true);
    setError(null);
    try {
      const source = picked.kind === 'photo' ? await shrinkForUpload(picked.uri) : picked.uri;
      const { mediaId, durationMs } = await uploadStoryMedia(source, picked.kind);
      await createStory({ kind: picked.kind, mediaId, durationMs });
      emitStoriesChanged();
      onClose();
    } catch (e) {
      // só o erro de envio já vem em português; o resto (banco, rede) passa pelo tradutor
      setError(e instanceof StoryUploadError ? e.message : friendlyError(e, 'Não rolou postar. Tenta de novo.'));
    } finally {
      setSending(false);
    }
  };

  const onOverlay = { color: t.colors.onOverlay };
  // Button usa alignSelf flex-start; o wrapper centraliza na coluna
  const choose = (
    <View style={{ alignSelf: 'center' }}>
      <Button title="Escolher foto ou vídeo" variant="secondary" onPress={() => void pick()} loading={opening} />
    </View>
  );

  let middle;
  if (problem) {
    middle = (
      <>
        <Text align="center" style={onOverlay}>
          {PROBLEM_TEXT[problem]}
        </Text>
        {choose}
      </>
    );
  } else if (picked) {
    middle =
      picked.kind === 'video' ? (
        <PreviewVideo uri={picked.uri} />
      ) : (
        <Image source={{ uri: picked.uri }} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
      );
  } else if (web) {
    middle = (
      <>
        <Text align="center" style={onOverlay}>
          Escolhe uma foto ou um vídeo de até 15 s, ou cola uma imagem (Ctrl+V).
        </Text>
        {choose}
      </>
    );
  } else if (!error) {
    middle = <ActivityIndicator color={t.colors.onOverlay} accessibilityLabel="Abrindo suas fotos" />;
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.colors.viewerBg, paddingTop: insets.top, paddingBottom: insets.bottom + t.spacing.md }}>
        <View style={{ flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: t.spacing.sm }}>
          <IconButton icon="close" accessibilityLabel="Cancelar" variant="ghost" tone="onOverlay" onPress={onClose} disabled={sending} />
        </View>

        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: t.layout.gutter, gap: t.spacing.lg }}>
          {middle}
        </View>

        {error ? (
          <Text accessibilityRole="alert" align="center" style={[onOverlay, { paddingHorizontal: t.layout.gutter, paddingBottom: t.spacing.sm }]}>
            {error}
          </Text>
        ) : null}
        {picked && !problem ? (
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
