import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stackHeader } from '../components/profile/headerOptions';
import { TAG_SUGGEST_DEBOUNCE_MS } from '../components/TagSuggestions';
import { Divider, EmptyState, interactiveStyle, Screen, Text, TextField } from '../components/ui';
import { suggestTags, type TagSuggestion } from '../lib/api/tags';
import { useTheme } from '../lib/theme';

/** Quantas tags a lista mostra (o banco aceita até 200). */
const TAGS_LIST_LIMIT = 100;

/** Todas as #tags com quantos posts cada uma tem, mais usadas primeiro; a busca filtra pelo começo. */
export default function TagsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [tags, setTags] = useState<TagSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    // digitando: espera um instante antes de perguntar ao banco; abrindo a tela, busca na hora
    const timer = setTimeout(
      () => {
        suggestTags(query, TAGS_LIST_LIMIT)
          .then((list) => {
            if (!alive) return;
            setTags(list);
            setFailed(false);
          })
          .catch(() => alive && setFailed(true))
          .finally(() => alive && setLoading(false));
      },
      query ? TAG_SUGGEST_DEBOUNCE_MS : 0,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query, attempt]);

  const searched = query.replace(/^#/, '').trim();
  let empty;
  if (loading) {
    empty = <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando tags" />;
  } else if (failed) {
    empty = (
      <EmptyState
        title="Não deu pra carregar as tags"
        message="Deu ruim na conexão. Confere a internet e tenta de novo."
        actionLabel="Tentar de novo"
        onAction={() => setAttempt((n) => n + 1)}
      />
    );
  } else if (searched) {
    empty = <EmptyState title={`Nenhuma tag começa com '${searched}'.`} />;
  } else {
    empty = <EmptyState title="Nenhuma tag ainda." message="Escreve #algo num post e ela aparece aqui." />;
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Tags')} />
      <Screen header>
        <FlatList
          data={loading || failed ? [] : tags}
          keyExtractor={(item) => item.tag}
          keyboardShouldPersistTaps="handled"
          ItemSeparatorComponent={Divider}
          contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
          ListHeaderComponent={
            <View style={{ paddingTop: t.spacing.lg, paddingBottom: t.spacing.sm }}>
              <TextField
                label="Buscar tag"
                hideLabel
                placeholder="Buscar tag"
                autoCapitalize="none"
                autoCorrect={false}
                value={query}
                onChangeText={setQuery}
              />
            </View>
          }
          ListEmptyComponent={empty}
          renderItem={({ item }) => (
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`Ver posts com #${item.tag}`}
              onPress={() => router.push(`/tag/${encodeURIComponent(item.tag)}`)}
              style={(state) => ({
                minHeight: t.layout.minTouch + t.spacing.sm,
                flexDirection: 'row',
                alignItems: 'center',
                gap: t.spacing.md,
                paddingVertical: t.spacing.sm,
                ...interactiveStyle(t, state),
              })}
            >
              <Text bold numberOfLines={1} style={{ flexShrink: 1 }}>
                #{item.tag}
              </Text>
              <Text variant="small" tone="muted">
                {item.posts === 1 ? '1 post' : `${item.posts} posts`}
              </Text>
            </Pressable>
          )}
        />
      </Screen>
    </>
  );
}
