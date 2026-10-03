import { useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';

import { PostCard } from '../../components/PostCard';
import { listFeed, toggleLike, type FeedPost } from '../../lib/api/posts';

export default function FeedScreen() {
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

  return (
    <FlatList
      data={posts}
      keyExtractor={(p) => p.id}
      renderItem={({ item }) => (
        <PostCard
          post={item}
          onToggleLike={onLike}
          onPress={(p) => router.push(`/post/${p.id}`)}
        />
      )}
      refreshing={refreshing}
      onRefresh={onRefresh}
      onEndReached={() => cursor && load(false, cursor)}
      onEndReachedThreshold={0.5}
      ListEmptyComponent={
        loading ? null : (
          <View style={styles.center}>
            <Text>{error ?? 'Nenhum post ainda. Seja o primeiro!'}</Text>
          </View>
        )
      }
      ListFooterComponent={
        loading && !refreshing ? <ActivityIndicator style={styles.center} /> : null
      }
    />
  );
}

const styles = StyleSheet.create({
  center: { padding: 24, alignItems: 'center' },
});
