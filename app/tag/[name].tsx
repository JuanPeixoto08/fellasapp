import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';

import { PostCard } from '../../components/PostCard';
import { stackHeader } from '../../components/profile/headerOptions';
import { Divider, EmptyState, Screen, Text } from '../../components/ui';
import { countTagPosts } from '../../lib/api/tags';
import { useSession } from '../../lib/auth/SessionProvider';
import { normalizeTag } from '../../lib/tags';
import { useTheme } from '../../lib/theme';
import { removePost, usePostList } from '../../lib/usePostList';

/** Posts com uma #tag, no formato do feed (mais novo primeiro). */
export default function TagScreen() {
  const t = useTheme();
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const tag = normalizeTag(String(name ?? ''));
  const me = useSession().session?.user.id;
  const { posts, loading, refreshing, error, refresh, reload, loadMore, like, react } = usePostList({ tag });
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setCount(null);
    // a contagem é extra: falhou, o cabeçalho fica sem ela
    countTagPosts(tag)
      .then((n) => alive && setCount(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tag]);

  return (
    <>
      <Stack.Screen options={stackHeader(t, `#${tag}`)} />
      <Screen flush header>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={Divider}
          contentContainerStyle={{ paddingBottom: t.spacing.xl }}
          ListHeaderComponent={
            count !== null && count > 0 ? (
              <Text
                variant="small"
                tone="muted"
                style={{ paddingHorizontal: t.layout.gutter, paddingVertical: t.spacing.sm }}
              >
                {count === 1 ? '1 post' : `${count} posts`}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              onToggleLike={like}
              onReact={react}
              onPress={(p) => router.push(`/post/${p.id}`)}
              onDelete={item.author.id === me ? (p) => removePost(p.id) : undefined}
            />
          )}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
            ) : error ? (
              <EmptyState
                title="Não deu pra carregar essa tag"
                message="Deu ruim na conexão. Confere a internet e tenta de novo."
                actionLabel="Tentar de novo"
                onAction={reload}
              />
            ) : (
              <EmptyState title={`Ninguém usou #${tag} ainda.`} message="Posta algo com ela." />
            )
          }
        />
      </Screen>
    </>
  );
}
