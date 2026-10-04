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
import { postTime } from '../../lib/format';
import { nextReaction } from '../../lib/reactionState';
import { nextCursor, prevCursor, startAt, type Cursor } from '../../lib/storyPlayer';
import { emitStoriesChanged } from '../../lib/storyViewerStore';
import { useTheme } from '../../lib/theme';
import { ReactionPicker } from '../reactions';
import { Avatar, ConfirmDialog, Emoji, IconButton, Text } from '../ui';
import { StoryVideo } from './StoryVideo';

/** Passo do relógio do story (ms). */
const TICK = 50;
/** Arrastar para baixo além disso fecha. */
const CLOSE_DRAG = 80;

type Props = { groups: StoryGroup[]; authorId: string; storyId?: string; onClose: () => void };

/**
 * Stories em tela cheia: barrinhas de progresso, foto (5 s) ou vídeo (até 15 s) passando sozinho, toque
 * à direita/esquerda avança/volta, segurar pausa, arrastar para baixo ou Esc fecha. No meu story,
 * "Visto por" e apagar; no dos outros, reagir com emoji.
 */
export function StoryViewer({ groups: initial, authorId, storyId, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const myId = useSession().session?.user.id;
  const [groups, setGroups] = useState(initial);
  const [cursor, setCursor] = useState<Cursor | null>(() => startAt(initial, authorId, storyId));
  // relógio preso ao story: trocar de story zera na hora (senão o tempo do anterior pularia o próximo)
  const [clock, setClock] = useState<{ id: string; ms: number }>({ id: '', ms: 0 });
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [viewers, setViewers] = useState<Viewer[] | null>(null);
  const [viewersOpen, setViewersOpen] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [picking, setPicking] = useState(false);
  // o relógio só anda com a foto/vídeo carregado (internet lenta não come o começo do story)
  const [readyId, setReadyId] = useState<string | null>(null);
  const reactAnchor = useRef<View>(null);

  const group = cursor ? groups[cursor.group] : null;
  const story = group && cursor ? group.stories[cursor.story] : null;
  const mine = !!group && group.author.id === myId;
  const ready = !!story && readyId === story.id;
  const stopped = paused || viewersOpen || confirming || picking || !ready;
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

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: t.colors.viewerBg }} {...drag.panHandlers}>
        <View
          accessibilityLabel={`Story ${cursor.story + 1} de ${total} de ${group.author.name}`}
          style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}
        >
          {story.kind === 'video' ? (
            <StoryVideo
              key={story.id}
              uri={story.mediaUrl}
              paused={paused || viewersOpen || confirming || picking}
              muted={muted}
              onReady={() => setReadyId(story.id)}
              onBlocked={() => setMuted(true)}
            />
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
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            style={{ flex: 3 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Próximo"
            onPress={goNext}
            onLongPress={() => setPaused(true)}
            onPressOut={() => setPaused(false)}
            style={{ flex: 7 }}
          />
        </View>

        {/* topo: progresso, autor, som, fechar */}
        <View
          style={{
            position: 'absolute',
            top: insets.top + t.spacing.sm,
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
            {story.kind === 'video' ? (
              <IconButton
                icon={muted ? 'volume-mute-outline' : 'volume-high-outline'}
                accessibilityLabel={muted ? 'Ligar som' : 'Desligar som'}
                variant="ghost"
                tone="onOverlay"
                onPress={() => setMuted((m) => !m)}
              />
            ) : null}
            <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" tone="onOverlay" onPress={onClose} />
          </View>
        </View>

        {/* rodapé: meu story (visto por, apagar) ou reagir */}
        <View
          style={{
            position: 'absolute',
            bottom: insets.bottom + t.spacing.md,
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
              paddingBottom: insets.bottom,
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
      </View>
    </Modal>
  );
}
