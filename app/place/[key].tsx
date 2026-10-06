import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { PostCard } from '../../components/PostCard';
import { stackHeader } from '../../components/profile/headerOptions';
import { Button, Divider, EmptyState, Screen, Text } from '../../components/ui';
import { countPlacePosts } from '../../lib/api/places';
import { useSession } from '../../lib/auth/SessionProvider';
import { placeKey } from '../../lib/places';
import { useTheme } from '../../lib/theme';
import { removePost, usePostList } from '../../lib/usePostList';

/** Posts feitos num local, no formato do feed (mais novo primeiro). */
export default function PlaceScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ key: string; name?: string }>();
  const key = placeKey(String(params.key ?? ''));
  const me = useSession().session?.user.id;
  const { posts, loading, refreshing, error, refresh, reload, loadMore, like, react } = usePostList({ place: key });
  const [count, setCount] = useState<number | null>(null);
  // a grafia de quem postou; antes de carregar, a do post que foi tocado
  const title = posts[0]?.location || (params.name ? String(params.name) : '') || 'Local';

  useEffect(() => {
    let alive = true;
    setCount(null);
    // a contagem é extra: falhou, o cabeçalho fica sem ela
    countPlacePosts(key)
      .then((n) => alive && setCount(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  return (
    <>
      <Stack.Screen options={stackHeader(t, title)} />
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
              linkPlace={false}
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
          ListFooterComponent={
            error && posts.length > 0 ? (
              <View style={{ alignItems: 'center', padding: t.spacing.lg, gap: t.spacing.sm }}>
                <Text tone="muted" align="center" accessibilityRole="alert">
                  Não deu pra carregar mais posts.
                </Text>
                <Button variant="secondary" title="Tentar de novo" onPress={loadMore} />
              </View>
            ) : loading && posts.length > 0 && !refreshing ? (
              <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
            ) : error ? (
              <EmptyState
                title="Não deu pra carregar esse local"
                message="Deu ruim na conexão. Confere a internet e tenta de novo."
                actionLabel="Tentar de novo"
                onAction={reload}
              />
            ) : (
              <EmptyState title="Ninguém postou daqui ainda." message="Posta algo marcando esse lugar." />
            )
          }
        />
      </Screen>
    </>
  );
}
