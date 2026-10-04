import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  getRecentEmojis,
  loadEmojiGroups,
  pushRecentEmoji,
  searchEmojis,
  type EmojiGroup,
  type EmojiItem,
} from '../../lib/emoji';
import { useLayoutTier } from '../../lib/layout';
import { placePopover, type Rect } from '../../lib/popover';
import { useTheme } from '../../lib/theme';
import { Emoji, EmptyState, Icon, IconButton, Text, TextField, type IconName } from '../ui';

type Props = {
  visible: boolean;
  selected: string | null;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  /** Botão de reagir (medido): no computador o painel abre preso a ele. */
  anchor?: Rect | null;
};

type Row =
  | { type: 'header'; key: string; group: string; title: string }
  | { type: 'row'; key: string; group: string; emojis: EmojiItem[] };

const GROUP_ICONS: Record<string, IconName> = {
  recent: 'time-outline',
  smileys: 'happy-outline',
  people: 'hand-left-outline',
  animals: 'paw-outline',
  food: 'fast-food-outline',
  travel: 'airplane-outline',
  activities: 'football-outline',
  objects: 'bulb-outline',
  symbols: 'heart-outline',
  flags: 'flag-outline',
};

function toRows(groups: EmojiGroup[], columns: number, withHeaders: boolean): Row[] {
  const rows: Row[] = [];
  for (const g of groups) {
    if (g.emojis.length === 0) continue;
    if (withHeaders) rows.push({ type: 'header', key: `h-${g.key}`, group: g.key, title: g.title });
    for (let i = 0; i < g.emojis.length; i += columns) {
      rows.push({ type: 'row', key: `${g.key}-${i}`, group: g.key, emojis: g.emojis.slice(i, i + columns) });
    }
  }
  return rows;
}

/**
 * Seletor com todos os emojis (desenhados pelo app): busca em português, recentes e categorias. Sobe de
 * baixo no celular; no computador é um painel de altura fixa preso ao botão de reagir (ou centralizado).
 */
export function EmojiPicker({ visible, selected, onSelect, onClose, anchor }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const panel = useLayoutTier() !== 'compact';
  const list = useRef<FlatList<Row>>(null);
  const [groups, setGroups] = useState<EmojiGroup[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [recents, setRecents] = useState<string[]>([]);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState<string>('smileys');

  const load = useCallback(() => {
    setFailed(false);
    loadEmojiGroups()
      .then(setGroups)
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!visible) return;
    setQuery('');
    getRecentEmojis().then(setRecents);
    if (!groups) load();
  }, [visible, groups, load]);

  // celular: folha de baixo na largura da tela; desktop: painel centralizado de 400
  const sheetWidth = panel
    ? Math.min(width - t.layout.gutter * 2, t.layout.maxDialogWidth)
    : Math.min(width, t.layout.maxContentWidth);
  const columns = Math.max(1, Math.floor((sheetWidth - t.layout.gutter * 2) / t.layout.minTouch));
  const cell = Math.floor((sheetWidth - t.layout.gutter * 2) / columns);
  const headerHeight = t.spacing.xxl;
  const panelHeight = Math.min(t.layout.emojiPanelHeight, height - t.layout.gutter * 2);
  const place =
    panel && anchor
      ? placePopover(anchor, { width: sheetWidth, height: panelHeight }, { width, height }, t.layout.gutter, t.spacing.xs)
      : null;

  const byEmoji = useMemo(() => {
    const map = new Map<string, EmojiItem>();
    for (const g of groups ?? []) for (const e of g.emojis) map.set(e.emoji, e);
    return map;
  }, [groups]);

  const allGroups = useMemo<EmojiGroup[]>(() => {
    if (!groups) return [];
    const recent = recents.map((e) => byEmoji.get(e) ?? { emoji: e, label: e, search: '' });
    return [{ key: 'recent', title: 'Recentes', emojis: recent }, ...groups];
  }, [groups, recents, byEmoji]);

  const searching = query.trim().length > 0;
  const rows = useMemo(() => {
    if (searching) return toRows([{ key: 'search', title: '', emojis: searchEmojis(allGroups, query) }], columns, false);
    return toRows(allGroups, columns, true);
  }, [searching, allGroups, query, columns]);

  // alturas fixas: cabeçalho e linha de emojis; permite pular direto para a categoria
  const layout = useMemo(() => {
    let offset = 0;
    return rows.map((r) => {
      const length = r.type === 'header' ? headerHeight : cell;
      const item = { length, offset };
      offset += length;
      return item;
    });
  }, [rows, cell, headerHeight]);

  const jumpTo = (group: string) => {
    setActive(group);
    const index = rows.findIndex((r) => r.type === 'header' && r.group === group);
    if (index >= 0) list.current?.scrollToIndex({ index, animated: false });
  };

  const pick = (emoji: string) => {
    pushRecentEmoji(emoji);
    onSelect(emoji);
  };

  // o FlatList não aceita trocar esse callback entre renders: a busca é lida por ref
  const searchingRef = useRef(searching);
  searchingRef.current = searching;
  const onViewable = useRef(({ viewableItems }: { viewableItems: { item: Row }[] }) => {
    const first = viewableItems[0]?.item;
    if (first && !searchingRef.current) setActive(first.group);
  }).current;

  const sections = allGroups.filter((g) => g.emojis.length > 0).map((g) => g.key);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          // preso ao botão (computador) não escurece a tela; folha de baixo (celular) escurece
          backgroundColor: place ? 'transparent' : t.colors.overlay,
          justifyContent: panel ? 'center' : 'flex-end',
        }}
      >
        <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Fechar emojis" style={StyleSheet.absoluteFill} />
        <View
          testID="emoji-sheet"
          accessibilityViewIsModal
          style={{
            width: panel ? sheetWidth : '100%',
            maxWidth: t.layout.maxContentWidth,
            alignSelf: 'center',
            height: panel ? panelHeight : height * t.layout.sheetHeightRatio,
            // a lista rola por dentro: nada passa da borda do painel
            overflow: 'hidden',
            ...(place ? { position: 'absolute', left: place.left, top: place.top } : null),
            ...(panel ? t.shadows.raised : null),
            backgroundColor: t.colors.surface,
            ...(panel
              ? { borderRadius: t.radii.lg }
              : { borderTopLeftRadius: t.radii.lg, borderTopRightRadius: t.radii.lg }),
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            paddingBottom: panel ? 0 : insets.bottom,
          }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, padding: t.layout.gutter, paddingBottom: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Buscar emoji"
                hideLabel
                placeholder="Buscar (ex.: kkk, festa, coração)"
                value={query}
                onChangeText={setQuery}
                autoCorrect={false}
                autoCapitalize="none"
                returnKeyType="search"
              />
            </View>
            <IconButton icon="close" accessibilityLabel="Fechar emojis" variant="ghost" onPress={onClose} />
          </View>
          {!searching && groups ? (
            <View
              accessibilityRole="tablist"
              style={{
                flexDirection: 'row',
                paddingHorizontal: t.spacing.sm,
                borderBottomWidth: t.borders.hairline,
                borderColor: t.colors.border,
              }}
            >
              {/* até 10 categorias dividem a largura por igual (44 de altura, largura flexível) */}
              {sections.map((key) => {
                const on = active === key;
                return (
                  <Pressable
                    key={key}
                    accessibilityRole="tab"
                    accessibilityLabel={allGroups.find((g) => g.key === key)?.title ?? key}
                    accessibilityState={{ selected: on }}
                    onPress={() => jumpTo(key)}
                    style={{
                      flex: 1,
                      height: t.layout.minTouch,
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderBottomWidth: t.borders.selected,
                      borderColor: on ? t.colors.text : 'transparent',
                    }}
                  >
                    <Icon name={GROUP_ICONS[key]} size="sm" tone={on ? 'default' : 'muted'} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
          {failed ? (
            <EmptyState
              title="Os emojis não carregaram"
              message="Confere a internet e tenta de novo."
              actionLabel="Tentar de novo"
              onAction={load}
            />
          ) : !groups ? (
            <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando emojis" />
          ) : (
            <FlatList
              ref={list}
              style={{ flex: 1 }}
              data={rows}
              keyExtractor={(r) => r.key}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: t.layout.gutter, paddingBottom: t.spacing.lg }}
              getItemLayout={(_, index) => ({ ...layout[index], index })}
              initialNumToRender={12}
              windowSize={7}
              onViewableItemsChanged={onViewable}
              ListEmptyComponent={
                <Text tone="muted" align="center" style={{ padding: t.spacing.xl }}>
                  Nada com “{query.trim()}”. Tenta outra palavra.
                </Text>
              }
              renderItem={({ item }) =>
                item.type === 'header' ? (
                  <View style={{ height: headerHeight, justifyContent: 'flex-end', paddingBottom: t.spacing.xs }}>
                    <Text variant="caption" tone="muted" accessibilityRole="header">
                      {item.title}
                    </Text>
                  </View>
                ) : (
                  <View style={{ flexDirection: 'row', height: cell }}>
                    {item.emojis.map((e) => {
                      const isSelected = e.emoji === selected;
                      return (
                        <Pressable
                          key={e.emoji}
                          onPress={() => pick(e.emoji)}
                          accessibilityRole="button"
                          accessibilityLabel={e.label}
                          accessibilityState={{ selected: isSelected }}
                          style={({ pressed }) => ({
                            width: cell,
                            height: cell,
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: t.radii.pill,
                            backgroundColor: isSelected ? t.colors.accent : pressed ? t.colors.surfaceSunken : 'transparent',
                          })}
                        >
                          <Emoji emoji={e.emoji} size="lg" />
                        </Pressable>
                      );
                    })}
                  </View>
                )
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}
