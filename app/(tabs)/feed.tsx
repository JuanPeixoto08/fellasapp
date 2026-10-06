import { useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { Composer } from '../../components/feed/Composer';
import { NewPostsPill } from '../../components/feed/NewPostsPill';
import { IdeasButton } from '../../components/ideas/IdeasButton';
import { NotificationsBell } from '../../components/notifications/NotificationsBell';
import { TagsButton } from '../../components/tags/TagsButton';
import { PostCard } from '../../components/PostCard';
import { Button, Divider, EmptyState, Logo, Screen, Text } from '../../components/ui';
import { useSession } from '../../lib/auth/SessionProvider';
import { useLayoutTier } from '../../lib/layout';
import { useTheme } from '../../lib/theme';
import type { FeedPost } from '../../lib/api/posts';
import { removePost, usePostList } from '../../lib/usePostList';

export default function FeedScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session } = useSession();
  const me = session?.user.id;
  const tier = useLayoutTier();
  const { posts, newPosts, showNewPosts, loading, refreshing, error, refresh, reload, loadMore, like, react } =
    usePostList();
  const list = useRef<FlatList<FeedPost>>(null);
  // o aviso de posts novos fica entre o topo do feed e os posts; quando esse topo sai da tela, ele flutua
  const [headerHeight, setHeaderHeight] = useState(0);
  const [scrolledPast, setScrolledPast] = useState(false);
  const openNewPosts = () => {
    showNewPosts();
    list.current?.scrollToOffset({ offset: 0, animated: true });
  };

  return (
    <Screen flush>
      <FlatList
        ref={list}
        testID="feed-list"
        data={posts}
        onScroll={(e) => setScrolledPast(headerHeight > 0 && e.nativeEvent.contentOffset.y > headerHeight)}
        scrollEventThrottle={16}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{ paddingBottom: t.spacing.xl }}
        ItemSeparatorComponent={Divider}
        ListHeaderComponent={
          <View testID="feed-header" onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
            {tier === 'compact' ? (
              <View
                style={{
                  paddingHorizontal: t.layout.gutter,
                  // o sino (alvo de 44) já dá o respiro de cima
                  paddingTop: t.spacing.sm,
                  paddingBottom: t.spacing.sm,
                  borderBottomWidth: t.borders.hairline,
                  borderColor: t.colors.border,
                }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View accessibilityRole="header">
                    <Logo height={t.layout.logoHeight.sm} />
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <TagsButton />
                    <IdeasButton />
                    <NotificationsBell />
                  </View>
                </View>
              </View>
            ) : (
              // desktop: o logo está na lateral; a coluna começa pelo compositor
              <View style={{ borderBottomWidth: t.borders.hairline, borderColor: t.colors.border }}>
                <Composer variant="inline" />
              </View>
            )}
            {scrolledPast ? null : <NewPostsPill count={newPosts} onPress={openNewPosts} />}
          </View>
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
          loading ? null : error ? (
            <EmptyState
              title="O feed não carregou"
              message="Deu ruim na conexão. Confere a internet e tenta de novo."
              actionLabel="Tentar de novo"
              onAction={reload}
            />
          ) : (
            <EmptyState
              title="Ninguém postou ainda."
              message="Quebra o gelo: manda a primeira foto ou frase pro grupo."
              actionLabel="Bora postar"
              onAction={() => router.navigate('/new')}
            />
          )
        }
        ListFooterComponent={
          error && posts.length > 0 ? (
            <View style={{ alignItems: 'center', padding: t.spacing.lg, gap: t.spacing.sm }}>
              <Text tone="muted" align="center" accessibilityRole="alert">
                Não deu pra carregar mais posts.
              </Text>
              <Button variant="secondary" title="Tentar de novo" onPress={loadMore} />
            </View>
          ) : loading && !refreshing ? (
            <ActivityIndicator
              style={{ padding: t.spacing.xl }}
              color={t.colors.primary}
              accessibilityLabel="Carregando posts"
            />
          ) : null
        }
      />
      {scrolledPast ? <NewPostsPill count={newPosts} onPress={openNewPosts} floating /> : null}
    </Screen>
  );
}
