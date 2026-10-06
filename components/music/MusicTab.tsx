import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRecentTracks, getTop, getUserInfo } from '../../lib/lastfm/api';
import { DEFAULT_PERIOD, formatThousands, PERIODS, sinceYear } from '../../lib/lastfm/map';
import type { LastfmPeriod, LastfmTopItem, LastfmTopKind, LastfmTrack, LastfmUser } from '../../lib/lastfm/types';
import { useLastfmPages } from '../../lib/lastfm/useLastfmPages';
import { useTheme } from '../../lib/theme';
import { Divider, EmptyState, Text } from '../ui';
import { TopRow } from './TopRow';
import { TrackRow } from './TrackRow';

type Section = 'recent' | LastfmTopKind;
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'recent', label: 'Recentes' },
  { key: 'artists', label: 'Artistas' },
  { key: 'albums', label: 'Álbuns' },
  { key: 'tracks', label: 'Músicas' },
];

const ERROR_TEXT: Record<string, string> = {
  private: 'O Last.fm dessa pessoa está privado.',
  not_found: 'Esse usuário do Last.fm não existe mais.',
  no_key: 'Last.fm não configurado.',
};

const openUrl = (url: string) => {
  if (url) Linking.openURL(url).catch(() => {});
};

type Props = { user: string; top: ReactNode };

/** Aba Música do perfil: resumo, sub-abas (Recentes, Artistas, Álbuns, Músicas) e listas infinitas. */
export function MusicTab({ user, top }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('recent');
  const [period, setPeriod] = useState<LastfmPeriod>(DEFAULT_PERIOD);
  const [info, setInfo] = useState<LastfmUser | null>(null);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    // o resumo é extra: falhou, a aba segue sem ele
    getUserInfo(user)
      .then((u) => alive && setInfo(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const key = section === 'recent' ? `${user}:recent` : `${user}:${section}:${period}`;
  const fetchPage = useCallback(
    (page: number) => (section === 'recent' ? getRecentTracks(user, page) : getTop(section, user, period, page)),
    [user, section, period],
  );
  const { items, loading, error, loadMore, reload } = useLastfmPages<LastfmTrack | LastfmTopItem>(key, fetchPage);

  const since = sinceYear(info?.registeredAt ?? null);
  const header = (
    <View>
      {top}
      <View style={{ gap: t.spacing.sm, paddingHorizontal: t.layout.gutter, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm }}>
        {info ? (
          <Text variant="small" tone="muted">
            {`${formatThousands(info.playcount)} scrobbles${since ? ` · desde ${since}` : ''}`}
          </Text>
        ) : null}
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {SECTIONS.map((s) => {
            const on = s.key === section;
            return (
              <Pressable
                key={s.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setSection(s.key)}
                style={{
                  minHeight: t.layout.minTouch * 0.75,
                  justifyContent: 'center',
                  paddingHorizontal: t.spacing.md,
                  borderRadius: t.radii.pill,
                  borderWidth: t.borders.hairline,
                  borderColor: on ? t.colors.primary : t.colors.border,
                  backgroundColor: on ? t.colors.primary : 'transparent',
                }}
              >
                <Text variant="small" bold={on} style={{ color: on ? t.colors.onPrimary : t.colors.textMuted }}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {section !== 'recent' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: t.spacing.md }}>
            {PERIODS.map((p) => {
              const on = p.value === period;
              return (
                <Pressable
                  key={p.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.label}
                  onPress={() => setPeriod(p.value)}
                  hitSlop={t.spacing.sm}
                  style={{ paddingVertical: t.spacing.xs }}
                >
                  <Text
                    variant="small"
                    bold={on}
                    style={{ color: on ? t.colors.brand : t.colors.textMuted, textDecorationLine: on ? 'underline' : 'none' }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );

  let empty;
  if (loading) {
    empty = (
      <View style={{ alignItems: 'center', gap: t.spacing.md, padding: t.spacing.xl }}>
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Buscando as músicas…</Text>
      </View>
    );
  } else if (error && ERROR_TEXT[error.kind]) {
    empty = <EmptyState title={ERROR_TEXT[error.kind]} />;
  } else if (error) {
    empty = (
      <EmptyState
        title="Não deu pra falar com o Last.fm"
        message="Confere a internet e tenta de novo daqui a pouco."
        actionLabel="Tentar de novo"
        onAction={reload}
      />
    );
  } else {
    empty = <EmptyState title="Nada por aqui ainda." />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => `${key}:${i}`}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Divider}
      ListEmptyComponent={empty}
      ListFooterComponent={
        loading && items.length > 0 ? (
          <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando mais" />
        ) : null
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{
        width: '100%',
        maxWidth: t.layout.maxContentWidth,
        alignSelf: 'center',
        paddingBottom: t.spacing.xxl + insets.bottom,
      }}
      renderItem={({ item }) =>
        section === 'recent' ? (
          <TrackRow track={item as LastfmTrack} onPress={() => openUrl(item.url)} />
        ) : (
          <TopRow item={item as LastfmTopItem} kind={section} onPress={() => openUrl(item.url)} />
        )
      }
    />
  );
}
