import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { PostCard } from '../../components/PostCard';
import { Button, EmptyState, Heading, Screen, Text } from '../../components/ui';
import { listFeed, toggleLike, type FeedPost } from '../../lib/api/posts';
import { setPostReaction } from '../../lib/api/reactions';
import { withReaction } from '../../lib/reactionState';
import { useTheme } from '../../lib/theme';

export default function FeedScreen() {
  const t = useTheme();
  const router = useRouter();
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);

  const load = useCallback(async (reset: boolean, from: string | null) => {
    if (busy.current) return;
    busy.current = true;
    setLoading(true);
    setError(null);
    try {
      const page = await listFeed({ cursor: reset ? null : from });
      setPosts((prev) => (reset ? page.posts : [...prev, ...page.posts]));
      setCursor(page.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o feed');
    } finally {
      busy.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(true, null);
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load(true, null);
  };

  const onLike = async (post: FeedPost) => {
    const apply = (liked: boolean) =>
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id
            ? { ...p, likedByMe: liked, likeCount: p.likeCount + (liked ? 1 : -1) }
            : p,
        ),
      );
    apply(!post.likedByMe);
    try {
      await toggleLike(post.id);
    } catch {
      apply(post.likedByMe);
    }
  };

  const onReact = async (post: FeedPost, emoji: string | null) => {
    const apply = (fn: (p: FeedPost) => FeedPost) =>
      setPosts((prev) => prev.map((p) => (p.id === post.id ? fn(p) : p)));
    apply((p) => withReaction(p, emoji));
    try {
      await setPostReaction(post.id, emoji);
    } catch {
      apply((p) => ({ ...p, reactions: post.reactions, myReaction: post.myReaction }));
    }
  };

  return (
    <Screen flush>
      <FlatList
        data={posts}
        keyExtractor={(p) => p.id}
        contentContainerStyle={{
          paddingHorizontal: t.layout.gutter,
          paddingBottom: t.spacing.xl,
          gap: t.spacing.lg,
        }}
        ListHeaderComponent={
          <View style={{ paddingTop: t.spacing.lg, paddingBottom: t.spacing.xs }}>
            <Heading level={1}>Os fellas</Heading>
          </View>
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onToggleLike={onLike}
            onReact={onReact}
            onPress={(p) => router.push(`/post/${p.id}`)}
          />
        )}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onEndReached={() => cursor && load(false, cursor)}
        onEndReachedThreshold={0.5}
        ListEmptyComponent={
          loading ? null : error ? (
            <EmptyState
              title="O feed não carregou"
              message="Deu ruim na conexão. Confere a internet e tenta de novo."
              actionLabel="Tentar de novo"
              onAction={() => load(true, null)}
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
              <Button variant="secondary" title="Tentar de novo" onPress={() => load(false, cursor)} />
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
    </Screen>
  );
}
