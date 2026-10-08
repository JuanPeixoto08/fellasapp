import { useId, useState, type ReactNode } from 'react';
import { Linking, Platform, Pressable, View, type LayoutChangeEvent } from 'react-native';
import Svg, { ClipPath, Defs, Image as SvgImage, Line, Path } from 'react-native-svg';

import { dayLabel, ratingStars, type PostMedia, type ReviewMedia, type TrackMedia } from '../../lib/postMedia';
import { useTheme } from '../../lib/theme';
import { Icon, IconButton, interactiveStyle, Text } from '../ui';

type Props = {
  media: PostMedia;
  /** No compositor: ✕ para tirar o ingresso (e sem abrir links). */
  onRemove?: () => void;
};

const open = (url: string) => void Linking.openURL(url).catch(() => {});

/** Contorno do ingresso: retângulo arredondado com os dois recortes redondos na linha do picote. */
function ticketPath(w: number, h: number, stub: number, r: number, n: number): string {
  return [
    `M${r},0 H${stub - n} A${n},${n} 0 0 0 ${stub + n},0 H${w - r} A${r},${r} 0 0 1 ${w},${r}`,
    `V${h - r} A${r},${r} 0 0 1 ${w - r},${h} H${stub + n} A${n},${n} 0 0 0 ${stub - n},${h}`,
    `H${r} A${r},${r} 0 0 1 0,${h - r} V${r} A${r},${r} 0 0 1 ${r},0 Z`,
  ].join(' ');
}

/**
 * O canhoto de cinema: fundo `surface` recortado (os recortes são buracos de verdade, aparecem o fundo do
 * post), a imagem no canhoto cortada pelo mesmo contorno, picote tracejado e o conteúdo do lado direito.
 */
function Ticket({
  stub,
  minHeight,
  image,
  imageLabel,
  fallbackIcon,
  children,
}: {
  stub: number;
  minHeight: number;
  image: string | null;
  imageLabel: string;
  fallbackIcon: 'film-outline' | 'musical-notes-outline';
  children: ReactNode;
}) {
  const t = useTheme();
  const clip = `ticket-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}`;
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);
  const notch = t.layout.ticket.notch;
  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    if (width && height && (width !== size?.w || height !== size?.h)) setSize({ w: width, h: height });
  };
  return (
    <View onLayout={onLayout} style={{ flexDirection: 'row', minHeight }}>
      {size ? (
        <Svg width={size.w} height={size.h} style={{ position: 'absolute', top: 0, left: 0 }} pointerEvents="none">
          <Defs>
            <ClipPath id={clip}>
              <Path d={ticketPath(size.w, size.h, stub, t.radii.lg, notch)} />
            </ClipPath>
          </Defs>
          <Path d={ticketPath(size.w, size.h, stub, t.radii.lg, notch)} fill={t.colors.surface} />
          {image ? (
            <SvgImage
              href={{ uri: image }}
              x={0}
              y={0}
              width={stub}
              height={size.h}
              preserveAspectRatio="xMidYMid slice"
              clipPath={`url(#${clip})`}
            />
          ) : null}
          <Line
            x1={stub}
            y1={notch + t.spacing.xs}
            x2={stub}
            y2={size.h - notch - t.spacing.xs}
            stroke={t.colors.border}
            strokeWidth={t.borders.hairline * 2}
            strokeDasharray="4 4"
          />
        </Svg>
      ) : null}
      <View
        accessible={!!image}
        accessibilityRole={image ? 'image' : undefined}
        accessibilityLabel={image ? imageLabel : undefined}
        style={{ width: stub, alignItems: 'center', justifyContent: 'center' }}
      >
        {image ? null : <Icon name={fallbackIcon} tone="muted" />}
      </View>
      <View style={{ flex: 1, minWidth: 0, paddingVertical: t.spacing.md, paddingLeft: t.spacing.md + t.spacing.xs, paddingRight: t.spacing.md, justifyContent: 'center', gap: t.spacing.xs }}>
        {children}
      </View>
    </View>
  );
}

/** Rótulo pequeno do ingresso ("Sessão · 30 dez 2025", "Tocando agora"): um campo do bilhete, não enfeite. */
function Stub({ children }: { children: string }) {
  const t = useTheme();
  return (
    <Text variant="caption" tone="muted" bold numberOfLines={1} style={{ textTransform: 'uppercase', letterSpacing: t.layout.ticket.kickerTracking }}>
      {children}
    </Text>
  );
}

function Stars({ rating }: { rating: number | null }) {
  const { full, half } = ratingStars(rating);
  if (!full && !half) return null;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={`${rating} de 5 estrelas`} style={{ flexDirection: 'row' }}>
      {Array.from({ length: full }, (_, i) => (
        <Icon key={i} name="star" size="sm" />
      ))}
      {half ? <Icon name="star-half" size="sm" /> : null}
    </View>
  );
}

function OpenLink({ url, label, enabled }: { url: string; label: string; enabled: boolean }) {
  const t = useTheme();
  if (!enabled) return null;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={() => open(url)}
      hitSlop={{ top: t.spacing.md, bottom: t.spacing.md }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, alignSelf: 'flex-start', opacity: pressed ? 0.7 : 1, cursor: 'pointer' as const })}
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <Icon name="open-outline" size="sm" tone="muted" />
    </Pressable>
  );
}

/** Review: 4 linhas + "mais"; com spoiler marcado no Letterboxd, escondida até tocar. */
function ReviewText({ text, spoiler }: { text: string; spoiler: boolean }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  const [shown, setShown] = useState(!spoiler);
  if (!text) return null;
  const body = (
    <View style={{ gap: t.spacing.xs }}>
      <Text variant="small" numberOfLines={open ? undefined : 4}>
        {text}
      </Text>
      {open ? null : (
        <Pressable accessibilityRole="button" accessibilityLabel="Ler a review inteira" onPress={() => setOpen(true)} hitSlop={t.spacing.md} style={{ alignSelf: 'flex-start', cursor: 'pointer' as const }}>
          <Text variant="small" bold>
            mais
          </Text>
        </Pressable>
      )}
    </View>
  );
  if (shown) return body;
  return (
    <View>
      {/* web: borrado; no app (sem desfoque nativo) o texto some e guarda o lugar */}
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={Platform.OS === 'web' ? ({ filter: 'blur(6px)' } as object) : { opacity: 0 }}
      >
        {body}
      </View>
      <View style={{ position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Pode ter spoiler. Toque pra ler"
          onPress={() => setShown(true)}
          style={(state) => ({
            ...interactiveStyle(t, state, t.colors.surface),
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.lg,
            borderRadius: t.radii.pill,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            justifyContent: 'center',
          })}
        >
          <Text variant="small" bold>
            Pode ter spoiler · toque pra ler
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

function ReviewTicket({ media, interactive }: { media: ReviewMedia; interactive: boolean }) {
  const t = useTheme();
  const day = dayLabel(media.watched);
  const sub = [media.year, media.rewatch ? 'revi' : null].filter(Boolean).join(' · ');
  const label = [
    `Review de ${media.title}${media.year ? ` (${media.year})` : ''}`,
    media.rating ? `${media.rating} de 5 estrelas` : null,
    media.liked ? 'curtiu' : null,
    day ? `vista em ${day}` : null,
  ]
    .filter(Boolean)
    .join(', ');
  const ticket = (
    <Ticket stub={t.layout.ticket.reviewStub} minHeight={t.layout.ticket.reviewMinHeight} image={media.poster} imageLabel={`Pôster de ${media.title}`} fallbackIcon="film-outline">
      {day ? <Stub>{`Sessão · ${day}`}</Stub> : null}
      <Text variant="lead" bold numberOfLines={3}>
        {media.title}
      </Text>
      {sub ? (
        <Text variant="small" tone="muted">
          {sub}
        </Text>
      ) : null}
      {media.rating || media.liked ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Stars rating={media.rating} />
          {media.liked ? (
            <View accessible accessibilityRole="image" accessibilityLabel="Curtiu o filme">
              <Icon name="heart" size="sm" color={t.colors.like} />
            </View>
          ) : null}
        </View>
      ) : null}
    </Ticket>
  );
  return (
    <>
      {interactive ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${label}. Abrir no Letterboxd`} onPress={() => open(media.url)} style={{ cursor: 'pointer' as const }}>
          {ticket}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label}>
          {ticket}
        </View>
      )}
      <ReviewText text={media.text} spoiler={media.spoiler} />
      <OpenLink url={media.url} label="Abrir no Letterboxd" enabled={interactive} />
    </>
  );
}

function TrackTicket({ media, interactive }: { media: TrackMedia; interactive: boolean }) {
  const t = useTheme();
  const label = `${media.live ? 'Tocando agora' : 'Ouviu'}: ${media.title}, de ${media.artist}`;
  const ticket = (
    <Ticket stub={t.layout.ticket.trackStub} minHeight={t.layout.ticket.trackMinHeight} image={media.image} imageLabel={`Capa de ${media.album ?? media.title}`} fallbackIcon="musical-notes-outline">
      <Stub>{media.live ? 'Tocando agora' : 'Ouvi'}</Stub>
      <Text variant="lead" bold numberOfLines={2}>
        {media.title}
      </Text>
      <Text variant="small" tone="muted" numberOfLines={1}>
        {media.artist}
      </Text>
    </Ticket>
  );
  return (
    <>
      {interactive ? (
        <Pressable accessibilityRole="link" accessibilityLabel={`${label}. Abrir no Last.fm`} onPress={() => open(media.url)} style={{ cursor: 'pointer' as const }}>
          {ticket}
        </Pressable>
      ) : (
        <View accessible accessibilityLabel={label}>
          {ticket}
        </View>
      )}
      <OpenLink url={media.url} label="Abrir no Last.fm" enabled={interactive} />
    </>
  );
}

/**
 * Ingresso no post (review do Letterboxd ou música): contorno fino juntando o bilhete, o texto e o link,
 * como a caixa da enquete. No compositor, com ✕ para tirar.
 */
export function PostTicket({ media, onRemove }: Props) {
  const t = useTheme();
  const interactive = !onRemove;
  return (
    <View
      testID="post-ticket"
      style={{
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.lg,
        padding: t.spacing.sm + t.spacing.xs / 2,
        gap: t.spacing.sm + t.spacing.xs / 2,
      }}
    >
      {media.kind === 'review' ? <ReviewTicket media={media} interactive={interactive} /> : <TrackTicket media={media} interactive={interactive} />}
      {onRemove ? (
        <View style={{ position: 'absolute', top: -t.spacing.sm, right: -t.spacing.sm }}>
          <IconButton
            icon="close"
            accessibilityLabel={media.kind === 'review' ? 'Tirar a review' : 'Tirar a música'}
            variant="ghost"
            size="sm"
            onPress={onRemove}
          />
        </View>
      ) : null}
    </View>
  );
}
