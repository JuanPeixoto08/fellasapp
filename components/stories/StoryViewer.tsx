import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Image, Modal, PanResponder, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  deleteStory,
  listStoryViewers,
  markStoryViewed,
  reactToStory,
  type StoryGroup,
  type StoryViewer as Viewer,
} from '../../lib/api/stories';
import { useSession } from '../../lib/auth/SessionProvider';
import { useLayoutTier, useWindowSize } from '../../lib/layout';
import { postTime } from '../../lib/format';
import { nextReaction } from '../../lib/reactionState';
import { carouselLayout } from '../../lib/storyCarousel';
import { nextCursor, prevCursor, startAt, type Cursor } from '../../lib/storyPlayer';
import { emitStoriesChanged } from '../../lib/storyViewerStore';
import { loadVolume, saveVolume } from '../../lib/storyVolume';
import { useTheme } from '../../lib/theme';
import { ReactionPicker } from '../reactions';
import { Avatar, ConfirmDialog, Emoji, Icon, IconButton, Slider, Text } from '../ui';
import { StoryCarouselCard } from './StoryCarouselCard';
import { StoryVideo } from './StoryVideo';

/** Passo do relógio do story (ms). */
const TICK = 50;
/** Arrastar para baixo além disso fecha. */
const CLOSE_DRAG = 80;

type Props = { groups: StoryGroup[]; authorId: string; storyId?: string; onClose: () => void };

/**
 * Stories: barrinhas de progresso, foto (5 s) ou vídeo (até 15 s) passando sozinho, toque à
 * direita/esquerda avança/volta, segurar ou o botão do topo pausa, arrastar para baixo ou Esc fecha. No meu
 * story, "Visto por" e apagar; no dos outros, reagir com emoji. Celular: tela cheia. Computador: o story
 * num quadro em pé com as outras pessoas em cartões dos lados e setas ‹ ›.
 */
export function StoryViewer({ groups: initial, authorId, storyId, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const myId = useSession().session?.user.id;
  const [groups, setGroups] = useState(initial);
  const [cursor, setCursor] = useState<Cursor | null>(() => startAt(initial, authorId, storyId));
  // relógio preso ao story: trocar de story zera na hora (senão o tempo do anterior pularia o próximo)
  const [clock, setClock] = useState<{ id: string; ms: number }>({ id: '', ms: 0 });
  // segurar a tela pausa só enquanto segura; o botão do topo pausa até tocar de novo
  const [held, setHeld] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [muted, setMuted] = useState(false);
  // volume (só no computador; no celular é o do aparelho): nunca guarda 0 — arrastar até o 0 é o mudo
  const [volume, setVolume] = useState(loadVolume);
  const [soundHover, setSoundHover] = useState(false);
  const [soundFocus, setSoundFocus] = useState(false);
  const [sliding, setSliding] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // volume de quando o arraste começou: arrastar até o 0 e religar volta nele, não no ponto do meio do caminho
  const dragFrom = useRef<number | null>(null);
  useEffect(() => () => clearTimeout(blurTimer.current), []);
  const changeVolume = (v: number) => {
    if (v === 0) {
      setMuted(true);
      if (dragFrom.current !== null) {
        setVolume(dragFrom.current);
        saveVolume(dragFrom.current);
      }
      return;
    }
    setVolume(v);
    saveVolume(v);
    setMuted(false);
  };
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  // o relógio só anda com a foto/vídeo carregado (internet lenta não come o começo do story)
  const [readyId, setReadyId] = useState<string | null>(null);
  const reactAnchor = useRef<View>(null);
  const desktop = useLayoutTier() !== 'compact';
  const win = useWindowSize();
  // no quadro do computador não há barra de status nem gesto do sistema
  const edge = desktop ? { top: 0, bottom: 0 } : insets;

  const group = cursor ? groups[cursor.group] : null;
  const story = group && cursor ? group.stories[cursor.story] : null;
  const mine = !!group && group.author.id === myId;
  const ready = !!story && readyId === story.id;
  const halted = held || pinned || viewersOpen || confirming || picking;
  const stopped = halted || !ready;
  const elapsed = story && clock.id === story.id ? clock.ms : 0;

  const goNext = useCallback(() => {
    if (!cursor) return;
    const next = nextCursor(groups, cursor);
    if (next) setCursor(next);
    else onClose();
  }, [cursor, groups, onClose]);
  const goPrev = useCallback(() => {
    if (cursor) setCursor(prevCursor(groups, cursor));
  }, [cursor, groups]);

  // story novo na tela: conta como visto, zera o relógio e (no meu) busca quem viu
  useEffect(() => {
    if (!story) return;
    setViewers(null);
    markStoryViewed(story.id).catch(() => {});
    if (mine) {
      listStoryViewers(story.id)
        .then(setViewers)
        .catch(() => setViewers([]));
    }
  }, [story, mine]);

  // relógio: passa sozinho ao fim da duração
  useEffect(() => {
    if (!story || stopped) return;
    const id = story.id;
    const timer = setInterval(() => setClock((c) => ({ id, ms: (c.id === id ? c.ms : 0) + TICK })), TICK);
    return () => clearInterval(timer);
  }, [story, stopped]);
  useEffect(() => {
    if (story && elapsed >= story.durationMs) goNext();
  }, [elapsed, story, goNext]);

  // web: setas e Esc
  useEffect(() => {
    if (Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') goNext();
      else if (e.key === 'ArrowLeft') goPrev();
      else if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [goNext, goPrev, onClose]);

  const drag = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dy > 12 && Math.abs(g.dy) > Math.abs(g.dx),
        onPanResponderRelease: (_, g) => {
          if (g.dy > CLOSE_DRAG) onClose();
        },
      }),
    [onClose],
  );

  if (!group || !story || !cursor) return null;
  const total = group.stories.length;

  const react = (emoji: string) => {
    setPicking(false);
    const next = nextReaction(story.myReaction, emoji);
    setGroups((gs) =>
      gs.map((g, gi) =>
        gi !== cursor.group
          ? g
          : { ...g, stories: g.stories.map((s, si) => (si === cursor.story ? { ...s, myReaction: next } : s)) },
      ),
    );
    reactToStory(story.id, next).catch(() => {});
  };

  const openPost = (postId: string) => {
    onClose();
    router.push(`/post/${postId}`);
  };

  const remove = async () => {
    await deleteStory(story.id);
    emitStoriesChanged();
    setConfirming(false);
    const left = group.stories.filter((s) => s.id !== story.id);
    if (left.length === 0) {
      const rest = groups.filter((_, gi) => gi !== cursor.group);
      if (rest.length === 0 || cursor.group >= rest.length) return onClose();
      setGroups(rest);
      setCursor({ group: cursor.group, story: 0 });
      return;
    }
    setGroups((gs) => gs.map((g, gi) => (gi === cursor.group ? { ...g, stories: left } : g)));
    setCursor({ group: cursor.group, story: Math.min(cursor.story, left.length - 1) });
  };

  const onOverlay = { color: t.colors.onOverlay };

  const backdrop = story.kind === 'photo' ? story.mediaUrl : story.thumbUrl;
  // o que fica dentro do story: no celular é a tela toda; no computador, o quadro do meio
  const stage = (
    <>
    <View
      accessibilityLabel={`Story ${cursor.story + 1} de ${total} de ${group.author.name}`}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
    >
      {/* a mesma imagem, desfocada e escurecida, preenche o quadro atrás de mídia deitada */}
      {backdrop ? (
        <>
          <Image
            testID="story-backdrop"
            source={{ uri: backdrop }}
            resizeMode="cover"
            blurRadius={t.layout.storyBackdropBlur}
            style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}
          />
          <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: t.colors.overlay }} />
        </>
      ) : null}
      {story.kind === 'video' ? (
        // camada própria: na web o <video> não tem posição e ficava atrás do fundo desfocado
        <View testID="story-video-layer" style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 }}>
          <StoryVideo
            key={story.id}
            uri={story.mediaUrl}
            fallbackUri={story.originalUrl}
            paused={halted}
            muted={muted}
            volume={desktop ? volume : 1}
            onReady={() => setReadyId(story.id)}
            onBlocked={() => setMuted(true)}
          />
        </View>
      ) : (
        <Image
          testID="story-photo"
          source={{ uri: story.mediaUrl }}
          resizeMode="contain"
          onLoad={() => setReadyId(story.id)}
          onError={() => setReadyId(story.id)}
          style={{ width: '100%', height: '100%' }}
        />
      )}
    </View>

    {/* toque: esquerda volta, direita avança; segurar pausa */}
    <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, flexDirection: 'row' }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Anterior"
        onPress={goPrev}
        onLongPress={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        style={{ flex: 3 }}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Próximo"
        onPress={goNext}
        onLongPress={() => setHeld(true)}
        onPressOut={() => setHeld(false)}
        style={{ flex: 7 }}
      />
    </View>

    {/* topo: progresso, autor, som, fechar */}
    <View
      style={{
        position: 'absolute',
        top: edge.top + t.spacing.sm,
        left: t.spacing.sm,
        right: t.spacing.sm,
        gap: t.spacing.sm,
      }}
    >
      <View style={{ flexDirection: 'row', gap: t.spacing.xs }}>
        {group.stories.map((s, i) => {
          const fill = i < cursor.story ? 1 : i > cursor.story ? 0 : Math.min(1, elapsed / s.durationMs);
          return (
            <View
              key={s.id}
              style={{
                flex: 1,
                height: t.borders.selected,
                borderRadius: t.radii.pill,
                backgroundColor: t.colors.overlay,
                overflow: 'hidden',
              }}
            >
              <View style={{ width: `${fill * 100}%`, height: '100%', backgroundColor: t.colors.onOverlay }} />
            </View>
          );
        })}
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
        <Avatar name={group.author.name} uri={group.author.avatarUrl} size={t.avatarSizes.sm} />
        <Text variant="small" bold style={onOverlay} numberOfLines={1}>
          {group.author.name}
        </Text>
        <Text variant="small" style={[onOverlay, { flex: 1 }]} numberOfLines={1}>
          {postTime(story.createdAt)}
        </Text>
        <IconButton
          icon={pinned ? 'play-outline' : 'pause-outline'}
          accessibilityLabel={pinned ? 'Continuar' : 'Pausar'}
          variant="ghost"
          tone="onOverlay"
          onPress={() => setPinned((p) => !p)}
        />
        {story.kind === 'video' ? (
          // computador: a barra de volume abre ao passar o mouse (ou com o foco do teclado) no som
          <View
            testID="story-sound"
            {...({
              // react-native-web repassa mouse e foco para o <div>; no app nada disso acontece
              onMouseEnter: () => setSoundHover(true),
              onMouseLeave: () => setSoundHover(false),
              // foco que entra/sai do botão ou da barra (no site o evento sobe); a saída espera um instante
              // porque do botão para a barra o foco sai de um e entra no outro
              onFocus: () => {
                clearTimeout(blurTimer.current);
                setSoundFocus(true);
              },
              onBlur: () => {
                clearTimeout(blurTimer.current);
                blurTimer.current = setTimeout(() => setSoundFocus(false), 0);
              },
            } as object)}
            style={{ flexDirection: 'row', alignItems: 'center' }}
          >
            {desktop && (soundHover || soundFocus || sliding) ? (
              <Slider
                value={muted ? 0 : volume}
                onChange={changeVolume}
                accessibilityLabel="Volume"
                tone="onOverlay"
                onSlidingStart={() => {
                  dragFrom.current = muted ? null : volume;
                  setSliding(true);
                }}
                onSlidingEnd={() => {
                  dragFrom.current = null;
                  setSliding(false);
                }}
              />
            ) : null}
            <IconButton
              icon={muted ? 'volume-mute-outline' : 'volume-high-outline'}
              accessibilityLabel={muted ? 'Ligar som' : 'Desligar som'}
              variant="ghost"
              tone="onOverlay"
              onPress={() => setMuted((m) => !m)}
            />
          </View>
        ) : null}
        {desktop ? null : (
          <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" tone="onOverlay" onPress={onClose} />
        )}
      </View>
    </View>

    {/* rodapé: meu story (visto por, apagar) ou reagir */}
    <View
      style={{
        position: 'absolute',
        bottom: edge.bottom + t.spacing.md,
        left: t.layout.gutter,
        right: t.layout.gutter,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: mine ? 'space-between' : 'flex-end',
      }}
    >
      {mine ? (
        <>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Visto por ${viewers?.length ?? 0}`}
            onPress={() => setViewersOpen(true)}
            style={{ minHeight: t.layout.minTouch, justifyContent: 'center' }}
          >
            <Text variant="small" bold style={onOverlay}>
              Visto por {viewers?.length ?? 0}
            </Text>
          </Pressable>
          <IconButton
            icon="trash-outline"
            accessibilityLabel="Apagar story"
            variant="ghost"
            tone="onOverlay"
            onPress={() => setConfirming(true)}
          />
        </>
      ) : (
        <View ref={reactAnchor} collapsable={false}>
          {story.myReaction ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reagir"
              accessibilityHint={`Sua reação: ${story.myReaction}. Toque para trocar ou remover`}
              onPress={() => setPicking(true)}
              style={{ minWidth: t.layout.minTouch, minHeight: t.layout.minTouch, alignItems: 'center', justifyContent: 'center' }}
            >
              <Emoji emoji={story.myReaction} size="lg" />
            </Pressable>
          ) : (
            <IconButton
              icon="happy-outline"
              accessibilityLabel="Reagir"
              variant="ghost"
              tone="onOverlay"
              onPress={() => setPicking(true)}
            />
          )}
        </View>
      )}
    </View>

    {/* story que veio de um post: pílula acima do rodapé (não conta como toque de passar/voltar) */}
    {story.postId ? (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: edge.bottom + t.spacing.md + t.layout.minTouch + t.spacing.sm,
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ver post"
          onPress={() => openPost(story.postId!)}
          style={{
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.lg,
            borderRadius: t.radii.pill,
            backgroundColor: t.colors.overlay,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.onOverlay,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
          }}
        >
          <Icon name="arrow-forward-outline" size="sm" color={t.colors.onOverlay} />
          <Text variant="small" bold style={onOverlay}>
            Ver post
          </Text>
        </Pressable>
      </View>
    ) : null}

    <ReactionPicker
      visible={picking}
      selected={story.myReaction}
      onSelect={react}
      onClose={() => setPicking(false)}
      anchorRef={reactAnchor}
      allowMore={false}
    />

    {viewersOpen ? (
      <View
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          maxHeight: '60%',
          backgroundColor: t.colors.surface,
          borderTopLeftRadius: t.radii.lg,
          borderTopRightRadius: t.radii.lg,
          paddingBottom: edge.bottom,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: t.layout.gutter,
            paddingTop: t.spacing.sm,
          }}
        >
          <Text bold>Visto por {viewers?.length ?? 0}</Text>
          <IconButton icon="close" accessibilityLabel="Fechar lista" variant="ghost" onPress={() => setViewersOpen(false)} />
        </View>
        <ScrollView contentContainerStyle={{ paddingHorizontal: t.layout.gutter, paddingBottom: t.spacing.md }}>
          {(viewers ?? []).length === 0 ? (
            <Text tone="muted">Ninguém viu ainda.</Text>
          ) : (
            (viewers ?? []).map((v) => (
              <View
                key={v.person.id}
                style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.layout.minTouch }}
              >
                <Avatar name={v.person.name} uri={v.person.avatarUrl} size={t.avatarSizes.sm} />
                <Text bold style={{ flex: 1 }} numberOfLines={1}>
                  {v.person.name}
                </Text>
                {v.emoji ? <Emoji emoji={v.emoji} size="md" /> : null}
                <Text variant="small" tone="muted">
                  {postTime(v.viewedAt)}
                </Text>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    ) : null}

    <ConfirmDialog
      visible={confirming}
      title="Apagar este story?"
      message="Ele some para todo mundo agora."
      confirmLabel="Apagar"
      onConfirm={remove}
      onClose={() => setConfirming(false)}
    />
    </>
  );

  const hasPrev = cursor.group > 0 || cursor.story > 0;
  const hasNext = cursor.group < groups.length - 1 || cursor.story < total - 1;
  const deck = desktop
    ? carouselLayout({
        width: win.width,
        height: win.height,
        count: groups.length,
        current: cursor.group,
        aspect: t.layout.storyAspect,
        sideScale: t.layout.storySideScale,
        margin: t.spacing.xl,
        gap: t.spacing.xxxl,
        arrowZone: t.layout.minTouch + t.spacing.lg,
      })
    : null;
  const arrow = (icon: 'chevron-back-outline' | 'chevron-forward-outline', label: string, onPress: () => void, at: { x: number; y: number }) => (
    <View
      style={{
        position: 'absolute',
        left: at.x - t.layout.minTouch / 2,
        top: at.y - t.layout.minTouch / 2,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.overlay,
      }}
    >
      <IconButton icon={icon} accessibilityLabel={label} variant="ghost" tone="onOverlay" onPress={onPress} />
    </View>
  );

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View
        testID="story-viewer"
        // web: data-no-select (lib/webStyles) — segurar só pausa, sem selecionar nem abrir o menu de copiar
        {...({ dataSet: { noSelect: 'true' } } as object)}
        style={{ flex: 1, backgroundColor: t.colors.viewerBg }}
        {...drag.panHandlers}
      >
        {deck ? (
          <>
            {deck.cards.map((c) => (
              <StoryCarouselCard
                key={groups[c.group].author.id}
                group={groups[c.group]}
                rect={c}
                onPress={() => setCursor(startAt(groups, groups[c.group].author.id))}
              />
            ))}
            <View
              testID="story-frame"
              style={{
                position: 'absolute',
                left: deck.frame.x,
                top: deck.frame.y,
                width: deck.frame.width,
                height: deck.frame.height,
                borderRadius: t.radii.lg,
                overflow: 'hidden',
              }}
            >
              {stage}
            </View>
            {hasPrev ? arrow('chevron-back-outline', 'Story anterior', goPrev, deck.prevArrow) : null}
            {hasNext ? arrow('chevron-forward-outline', 'Próximo story', goNext, deck.nextArrow) : null}
            <View style={{ position: 'absolute', top: t.spacing.md, right: t.spacing.md }}>
              <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" tone="onOverlay" onPress={onClose} />
            </View>
          </>
        ) : (
          stage
        )}
      </View>
    </Modal>
  );
}
