import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';

import { CommentItem } from '../../components/feed/CommentItem';
import { PostCard } from '../../components/PostCard';
import { Button, EmptyState, Screen, Text, TextField } from '../../components/ui';
import {
  addComment,
  getPost,
  listComments,
  toggleLike,
  type Comment,
  type FeedPost,
} from '../../lib/api/posts';
import { setCommentReaction, setPostReaction } from '../../lib/api/reactions';
import { friendlyError } from '../../lib/errors';
import { withLike, withReaction } from '../../lib/reactionState';
import { useTheme } from '../../lib/theme';

export default function PostDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    setLoadError(null);
    try {
      const [p, c] = await Promise.all([getPost(id), listComments(id)]);
      setPost(p);
      setComments(c);
    } catch (e) {
      setLoadError(friendlyError(e, 'Pode ter sido apagado ou a conexão caiu. Tenta de novo.'));
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onLike = async (p: FeedPost) => {
    setPost((cur) => (cur ? withLike(cur, !p.likedByMe) : cur));
    try {
      await toggleLike(p.id);
    } catch {
      setPost((cur) => (cur ? withLike(cur, p.likedByMe) : cur));
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
    if (sending || !text.trim()) return;
    setSending(true);
    setSendError(null);
    try {
      await addComment(id, text);
      setText('');
      setPost((cur) => (cur ? { ...cur, commentCount: cur.commentCount + 1 } : cur));
      // só os comentários: o post já está na tela e não precisa ser buscado (nem assinado) de novo
      setComments(await listComments(id).catch(() => comments));
    } catch (e) {
      setSendError(friendlyError(e, 'Não rolou mandar o comentário. Tenta de novo.'));
    } finally {
      setSending(false);
    }
  };

  if (loadError && !post) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: true, title: 'Post' }} />
        <EmptyState
          title="Não deu pra abrir esse post"
          message={loadError}
          actionLabel="Tentar de novo"
          onAction={load}
        />
      </Screen>
    );
  }

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
            !post ? (
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
            gap: t.spacing.sm,
            padding: t.spacing.md,
            borderTopWidth: t.borders.hairline,
            borderTopColor: t.colors.border,
            backgroundColor: t.colors.bg,
          }}
        >
          {sendError ? (
            <Text variant="small" tone="danger" accessibilityRole="alert">
              {sendError}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.spacing.sm }}>
            <View style={{ flex: 1 }}>
              <TextField
                label="Comentar"
                placeholder="Fala aí…"
                value={text}
                onChangeText={setText}
                editable={!sending}
              />
            </View>
            <Button title="Enviar" onPress={send} loading={sending} disabled={!text.trim()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}
