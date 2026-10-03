import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';

import { CommentItem } from '../../components/feed/CommentItem';
import { PostCard } from '../../components/PostCard';
import { Button, Screen, Text, TextField } from '../../components/ui';
import {
  addComment,
  getPost,
  listComments,
  toggleLike,
  type Comment,
  type FeedPost,
} from '../../lib/api/posts';
import { setCommentReaction, setPostReaction } from '../../lib/api/reactions';
import { withReaction } from '../../lib/reactionState';
import { useTheme } from '../../lib/theme';

export default function PostDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getPost(id), listComments(id)]);
      setPost(p);
      setComments(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o post');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onLike = async (p: FeedPost) => {
    try {
      await toggleLike(p.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao curtir');
    }
  };

  const onReactPost = async (p: FeedPost, emoji: string | null) => {
    setPost((cur) => (cur ? withReaction(cur, emoji) : cur));
    try {
      await setPostReaction(p.id, emoji);
    } catch {
      setPost((cur) => (cur ? { ...cur, reactions: p.reactions, myReaction: p.myReaction } : cur));
    }
  };

  const onReactComment = async (c: Comment, emoji: string | null) => {
    const apply = (fn: (x: Comment) => Comment) =>
      setComments((prev) => prev.map((x) => (x.id === c.id ? fn(x) : x)));
    apply((x) => withReaction(x, emoji));
    try {
      await setCommentReaction(c.id, emoji);
    } catch {
      apply((x) => ({ ...x, reactions: c.reactions, myReaction: c.myReaction }));
    }
  };

  const send = async () => {
    try {
      await addComment(id, text);
      setText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao comentar');
    }
  };

  return (
    <Screen flush>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stack.Screen options={{ headerShown: true, title: 'Post' }} />
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: t.layout.gutter, paddingVertical: t.spacing.lg, gap: t.spacing.sm }}
          ListHeaderComponent={
            post ? (
              <View style={{ marginBottom: t.spacing.md }}>
                <PostCard post={post} onToggleLike={onLike} onReact={onReactPost} />
              </View>
            ) : null
          }
          ListEmptyComponent={
            error ? (
              <Text tone="danger" align="center" accessibilityRole="alert">
                {error}
              </Text>
            ) : !post ? (
              <ActivityIndicator
                style={{ padding: t.spacing.xl }}
                color={t.colors.primary}
                accessibilityLabel="Carregando post"
              />
            ) : (
              <Text tone="muted" align="center">
                Sem comentários ainda. Puxa o assunto.
              </Text>
            )
          }
          renderItem={({ item }) => <CommentItem comment={item} onReact={onReactComment} />}
        />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: t.spacing.sm,
            padding: t.spacing.md,
            borderTopWidth: 1,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.bg,
          }}
        >
          <View style={{ flex: 1 }}>
            <TextField label="Comentar" placeholder="Fala aí…" value={text} onChangeText={setText} />
          </View>
          <Button title="Enviar" onPress={send} disabled={!text.trim()} />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
