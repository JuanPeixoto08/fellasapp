import { useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, View } from 'react-native';

import { useSession } from '../../lib/auth/SessionProvider';
import { LetterboxdError, listMyReviews } from '../../lib/api/letterboxd';
import { getRecentTracks, hasLastfmKey } from '../../lib/lastfm/api';
import { matchReviewLink, ratingStars, trackMedia, type PostMedia, type ReviewMedia, type TrackMedia } from '../../lib/postMedia';
import { useTheme } from '../../lib/theme';
import { Button, Icon, IconButton, interactiveStyle, Text, TextField } from '../ui';

type Kind = 'review' | 'track';
type Props = { kind: Kind; onPick: (media: PostMedia) => void; onClose: () => void };

/** Músicas mostradas: a que está tocando (se tiver) e as últimas. */
const RECENT_TRACKS = 6;

const LINK_ERRORS = {
  not_yours: 'Esse link é de outra pessoa. Dá pra postar só review sua.',
  short_link: 'Cola o link completo (letterboxd.com/…), não o boxd.it.',
  not_review: 'Isso não parece link de review do Letterboxd.',
  missing: 'Essa review não está entre as suas 50 mais recentes.',
} as const;

type Load<T> = { status: 'loading' } | { status: 'error'; message: string; toProfile?: boolean } | { status: 'ready'; items: T[] };

/** Uma linha da lista: miniatura, título e o detalhe; toque anexa. */
function Row({ image, square, title, detail, extra, label, onPress }: {
  image: string | null;
  square: boolean;
  title: string;
  detail: string;
  extra?: ReactNode;
  label: string;
  onPress: () => void;
}) {
  const t = useTheme();
  const w = t.avatarSizes.md;
  const h = square ? w : (w * 3) / 2;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        ...interactiveStyle(t, state),
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch,
        paddingVertical: t.spacing.xs,
        paddingHorizontal: t.spacing.sm,
        borderRadius: t.radii.md,
      })}
    >
      {image ? (
        <Image source={{ uri: image }} style={{ width: w, height: h, borderRadius: t.radii.sm, backgroundColor: t.colors.surfaceSunken }} />
      ) : (
        <View style={{ width: w, height: h, borderRadius: t.radii.sm, backgroundColor: t.colors.surfaceSunken, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={square ? 'musical-notes-outline' : 'film-outline'} size="sm" tone="muted" />
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0, gap: t.borders.hairline * 2 }}>
        <Text bold numberOfLines={1}>
          {title}
        </Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="small" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
            {detail}
          </Text>
          {extra}
        </View>
      </View>
    </Pressable>
  );
}

function MiniStars({ rating }: { rating: number | null }) {
  const { full, half } = ratingStars(rating);
  if (!full && !half) return null;
  return (
    <View style={{ flexDirection: 'row' }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {Array.from({ length: full }, (_, i) => (
        <Icon key={i} name="star" size="sm" tone="muted" />
      ))}
      {half ? <Icon name="star-half" size="sm" tone="muted" /> : null}
    </View>
  );
}

/**
 * Escolher o ingresso no compositor: as suas reviews recentes do Letterboxd (ou o link de uma delas) ou a música
 * do Last.fm (tocando agora + as últimas). Caixa abaixo do texto, como a da enquete.
 */
export function MediaPicker({ kind, onPick, onClose }: Props) {
  const t = useTheme();
  const router = useRouter();
  const { profile } = useSession();
  const letterboxdUser = profile?.letterboxd_user ?? null;
  const lastfmUser = profile?.lastfm_user ?? null;
  const [load, setLoad] = useState<Load<ReviewMedia | TrackMedia>>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | undefined>();

  useEffect(() => {
    let alive = true;
    setLoad({ status: 'loading' });
    const done = (next: Load<ReviewMedia | TrackMedia>) => alive && setLoad(next);
    if (kind === 'review') {
      if (!letterboxdUser) {
        done({ status: 'error', message: 'Coloca seu usuário do Letterboxd em Editar perfil pra puxar suas reviews.', toProfile: true });
      } else {
        listMyReviews()
          .then((items) => done({ status: 'ready', items }))
          .catch((e) =>
            done({
              status: 'error',
              message: e instanceof LetterboxdError ? e.message : 'Não deu pra buscar suas reviews. Tenta de novo.',
              toProfile: e instanceof LetterboxdError && (e.kind === 'no_user' || e.kind === 'not_found'),
            }),
          );
      }
    } else if (!lastfmUser) {
      done({ status: 'error', message: 'Coloca seu usuário do Last.fm em Editar perfil pra anexar música.', toProfile: true });
    } else if (!hasLastfmKey()) {
      done({ status: 'error', message: 'Música indisponível agora.' });
    } else {
      getRecentTracks(lastfmUser, 1)
        .then((page) =>
          done({
            status: 'ready',
            items: page.items
              .slice(0, RECENT_TRACKS)
              .map(trackMedia)
              .filter((m): m is TrackMedia => m !== null),
          }),
        )
        .catch(() => done({ status: 'error', message: 'Não deu pra ver o que você ouviu. Tenta de novo.' }));
    }
    return () => {
      alive = false;
    };
  }, [kind, letterboxdUser, lastfmUser, attempt]);

  const pickFromLink = useCallback(() => {
    if (!link.trim() || !letterboxdUser) return;
    const match = matchReviewLink(link, letterboxdUser);
    if ('error' in match) return setLinkError(LINK_ERRORS[match.error]);
    const found = load.status === 'ready' ? load.items.find((m) => m.kind === 'review' && m.url.toLowerCase() === match.url) : undefined;
    if (!found) return setLinkError(LINK_ERRORS.missing);
    onPick(found);
  }, [link, letterboxdUser, load, onPick]);

  return (
    <View
      testID="media-picker"
      style={{ borderWidth: t.borders.hairline, borderColor: t.colors.border, borderRadius: t.radii.lg, padding: t.spacing.sm, gap: t.spacing.sm }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingLeft: t.spacing.sm }}>
        <Text variant="small" bold style={{ flex: 1 }}>
          {kind === 'review' ? 'Suas reviews no Letterboxd' : 'O que você tá ouvindo'}
        </Text>
        <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" size="sm" onPress={onClose} />
      </View>

      {kind === 'review' && letterboxdUser ? (
        <View style={{ paddingHorizontal: t.spacing.sm }}>
          <TextField
            label="Colar link da review"
            hideLabel
            placeholder="Cola o link de uma review sua"
            autoCapitalize="none"
            autoCorrect={false}
            value={link}
            onChangeText={(v) => {
              setLink(v);
              setLinkError(undefined);
            }}
            onSubmitEditing={pickFromLink}
            error={linkError}
          />
          {link.trim() ? (
            <View style={{ alignSelf: 'flex-start', marginTop: t.spacing.xs }}>
              <Button title="Usar esse link" variant="secondary" onPress={pickFromLink} disabled={load.status !== 'ready'} />
            </View>
          ) : null}
        </View>
      ) : null}

      {load.status === 'loading' ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.spacing.sm }}>
          <ActivityIndicator color={t.colors.primary} />
          <Text variant="small" tone="muted">
            {kind === 'review' ? 'Buscando suas reviews…' : 'Buscando suas músicas…'}
          </Text>
        </View>
      ) : load.status === 'error' ? (
        <View style={{ gap: t.spacing.sm, padding: t.spacing.sm }}>
          <Text variant="small" tone="muted" accessibilityRole="alert">
            {load.message}
          </Text>
          <View style={{ alignSelf: 'flex-start' }}>
            {load.toProfile ? (
              <Button title="Ir pra Editar perfil" variant="secondary" onPress={() => router.push('/profile/edit')} />
            ) : (
              <Button title="Tentar de novo" variant="secondary" onPress={() => setAttempt((n) => n + 1)} />
            )}
          </View>
        </View>
      ) : load.items.length === 0 ? (
        <Text variant="small" tone="muted" style={{ padding: t.spacing.sm }}>
          {kind === 'review' ? 'Nenhuma review recente no seu Letterboxd.' : 'Nada tocado ainda no seu Last.fm.'}
        </Text>
      ) : (
        <ScrollView style={{ maxHeight: t.layout.minTouch * 6 }} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          {load.items.map((m) =>
            m.kind === 'review' ? (
              <Row
                key={m.url}
                image={m.poster}
                square={false}
                title={m.title}
                detail={[m.year, m.spoiler ? 'spoiler' : null].filter(Boolean).join(' · ')}
                extra={<MiniStars rating={m.rating} />}
                label={`Anexar review de ${m.title}`}
                onPress={() => onPick(m)}
              />
            ) : (
              <Row
                key={`${m.url}-${m.live}`}
                image={m.image}
                square
                title={m.title}
                detail={m.live ? `Tocando agora · ${m.artist}` : m.artist}
                label={`Anexar ${m.title}, de ${m.artist}`}
                onPress={() => onPick(m)}
              />
            ),
          )}
        </ScrollView>
      )}
    </View>
  );
}
