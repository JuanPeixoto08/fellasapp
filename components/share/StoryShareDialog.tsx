import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStory, StoryUploadError, uploadStoryMedia } from '../../lib/api/stories';
import type { FeedPost } from '../../lib/api/posts';
import { friendlyError } from '../../lib/errors';
import { useLayoutTier } from '../../lib/layout';
import { useMembersByUsername } from '../../lib/memberDirectory';
import { BACKGROUND_LABEL, BACKGROUND_ORDER, type StoryBackground } from '../../lib/storyCard/contrast';
import { prepareCard, storyBlob, type PreparedCard } from '../../lib/storyCard/draw';
import { canShareFiles, shareOrDownload } from '../../lib/storyCard/share';
import { cardSource } from '../../lib/storyCard/source';
import { emitStoriesChanged } from '../../lib/storyViewerStore';
import { storyCard, useTheme } from '../../lib/theme';
import { Button, IconButton, Text } from '../ui';

type Props = { post: FeedPost; visible: boolean; onClose: () => void };
/** Imagem pronta de um fundo: o Blob (para compartilhar na hora do toque) e o endereço local (prévia). */
type Preview = { bg: StoryBackground; blob: Blob; url: string };

/**
 * Montador do "compartilhar no story": prévia 9:16 (a própria imagem gerada), bolinhas de fundo e os dois
 * destinos — planilha de compartilhar do celular (Instagram → Story; no computador, baixa) e o story do
 * Fellas, ligado ao post ("Ver post"). Palco escuro, igual ao "Ajustar foto"; janela no meio no computador.
 */
export function StoryShareDialog({ post, visible, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const desktop = useLayoutTier() !== 'compact';
  const byUsername = useMembersByUsername();
  const shareFiles = useMemo(() => canShareFiles(), []);
  const [prepared, setPrepared] = useState<PreparedCard | null>(null);
  const [bg, setBg] = useState<StoryBackground | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const name = post.author.display_name || post.author.username;

  const forget = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };
  useEffect(
    () => () => {
      forget();
      clearTimeout(closeTimer.current);
    },
    [],
  );

  // fontes, fotos e layout: uma vez por abertura (e a cada "Tentar de novo")
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setFailed(false);
    setPrepared(null);
    setPreview(null);
    setError(null);
    setDone(false);
    prepareCard(cardSource(post, byUsername))
      .then((card) => {
        if (!active) return;
        setPrepared(card);
        setBg(card.hasPhoto ? 'photo' : 'violeta');
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [visible, post, byUsername, attempt]);

  // a imagem do fundo escolhido; a anterior fica na tela até a nova chegar
  useEffect(() => {
    if (!prepared || !bg) return;
    let active = true;
    storyBlob(prepared, bg)
      .then((blob) => {
        if (!active) return;
        forget();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreview({ bg, blob, url });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [prepared, bg]);

  // sem await antes: o Safari só abre a planilha dentro do toque
  const toInstagram = () => {
    if (!preview) return;
    setError(null);
    shareOrDownload(preview.blob).catch(() => setError('Não rolou compartilhar. Tenta de novo.'));
  };

  const toFellas = async () => {
    if (!preview || sending) return;
    setSending(true);
    setError(null);
    try {
      const { mediaId, durationMs } = await uploadStoryMedia(preview.url, 'photo');
      await createStory({ kind: 'photo', mediaId, durationMs, postId: post.id });
      emitStoriesChanged();
      setDone(true);
      closeTimer.current = setTimeout(onClose, t.motion.confirm);
    } catch (e) {
      setError(e instanceof StoryUploadError ? e.message : friendlyError(e, 'Não rolou postar o story. Tenta de novo.'));
    } finally {
      setSending(false);
    }
  };

  const onOverlay = { color: t.colors.onOverlay };
  const options = BACKGROUND_ORDER.filter((b) => b !== 'photo' || prepared?.hasPhoto);

  const stage = (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.viewerBg,
        borderRadius: desktop ? t.radii.lg : 0,
        overflow: 'hidden',
        paddingTop: desktop ? t.spacing.sm : insets.top,
        paddingBottom: (desktop ? 0 : insets.bottom) + t.spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.sm, gap: t.spacing.xs }}>
        <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" tone="onOverlay" onPress={onClose} disabled={sending} />
        <Text bold style={onOverlay}>
          Compartilhar no story
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.md, gap: t.spacing.lg }}>
        {failed ? (
          <>
            <Text align="center" style={onOverlay}>
              Não rolou montar a imagem. Tenta de novo.
            </Text>
            <Button title="Tentar de novo" variant="overlayOutline" onPress={() => setAttempt((a) => a + 1)} />
          </>
        ) : (
          <View
            style={{
              height: '100%',
              aspectRatio: t.layout.storyAspect,
              borderRadius: t.radii.lg,
              overflow: 'hidden',
              backgroundColor: t.colors.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {preview ? (
              <Image
                testID="story-share-preview"
                accessibilityLabel={`Prévia do story com o post de ${name}`}
                source={{ uri: preview.url }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <ActivityIndicator color={t.colors.onOverlay} accessibilityLabel="Montando a imagem" />
            )}
          </View>
        )}
      </View>

      {prepared && !failed ? (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.xs, paddingBottom: t.spacing.md }}>
          {options.map((b) => (
            <BackgroundDot key={b} bg={b} photoUrl={post.images[0] ?? null} selected={b === bg} onPress={() => setBg(b)} />
          ))}
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" align="center" style={[onOverlay, { paddingHorizontal: t.layout.gutter, paddingBottom: t.spacing.sm }]}>
          {error}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: t.spacing.sm, paddingHorizontal: t.layout.gutter }}>
        <View style={{ flex: 1 }}>
          <Button
            title={shareFiles ? 'Instagram' : 'Baixar imagem'}
            icon={shareFiles ? 'logo-instagram' : 'download-outline'}
            variant="overlayOutline"
            fullWidth
            disabled={!preview || sending}
            onPress={toInstagram}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={done ? 'Foi pro seu story' : 'Story do Fellas'}
            icon={done ? 'checkmark' : 'add-circle-outline'}
            variant="overlay"
            fullWidth
            loading={sending}
            disabled={!preview || done}
            onPress={() => void toFellas()}
          />
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={sending ? () => {} : onClose}>
      {desktop ? (
        <View style={{ flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', padding: t.spacing.xxxl }}>
          <View style={{ flex: 1, width: t.layout.storyShare.width }}>{stage}</View>
        </View>
      ) : (
        stage
      )}
    </Modal>
  );
}

/** Bolinha de um fundo: anel `onOverlay` na escolhida; a da foto mostra a própria foto. */
function BackgroundDot({ bg, photoUrl, selected, onPress }: { bg: StoryBackground; photoUrl: string | null; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const d = t.layout.storyShare.dot;
  const dot = { width: d, height: d, borderRadius: d / 2, borderWidth: t.borders.hairline, borderColor: t.colors.overlay };
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={BACKGROUND_LABEL[bg]}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        width: t.layout.minTouch,
        height: t.layout.minTouch,
        borderRadius: t.radii.pill,
        borderWidth: t.borders.selected,
        borderColor: selected ? t.colors.onOverlay : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {bg === 'photo' && photoUrl ? (
        <Image source={{ uri: photoUrl }} style={dot} />
      ) : (
        <View style={[dot, { backgroundColor: bg === 'photo' ? t.colors.overlay : storyCard.backgrounds[bg] }]} />
      )}
    </Pressable>
  );
}
