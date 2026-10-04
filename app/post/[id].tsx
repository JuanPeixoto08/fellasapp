import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CommentItem } from '../../components/feed/CommentItem';
import { PhotoViewer } from '../../components/feed/PhotoViewer';
import { PostCard } from '../../components/PostCard';
import { stackHeader } from '../../components/profile/headerOptions';
import { Avatar, EmptyState, IconButton, Screen, Text, TextField } from '../../components/ui';
import {
  addComment,
  getPost,
  listComments,
  toggleLike,
  type Comment,
  type FeedPost,
} from '../../lib/api/posts';
import { setCommentReaction, setPostReaction } from '../../lib/api/reactions';
import { useSession } from '../../lib/auth/SessionProvider';
import { friendlyError } from '../../lib/errors';
import { withLike, withReaction } from '../../lib/reactionState';
import { debounce, LIVE_DEBOUNCE_MS, onLive, postIdOf, type LiveEvent } from '../../lib/realtime';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';
import { removePost } from '../../lib/usePostList';

export default function PostDetailScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const myId = useSession().session?.user.id;
  const me = useMyAvatar();
  const insets = useSafeAreaInsets();
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

  // ao vivo: o que outras pessoas fazem neste post (ou nos comentários dele) aparece sozinho
  const commentsRef = useRef(comments);
  commentsRef.current = comments;
  useEffect(() => {
    const live = debounce(() => void load(), LIVE_DEBOUNCE_MS);
    const concernsThisPost = (event: LiveEvent) => {
      if (event.kind === 'resync') return true;
      if (event.mine) return false; // o que eu fiz a tela já mostrou
      if (postIdOf(event) === id) return true;
      const commentId = event.table === 'comment_reactions' ? event.row.comment_id : event.table === 'comments' ? event.row.id : null;
      return !!commentId && commentsRef.current.some((c) => c.id === commentId);
    };
    const off = onLive((event) => {
      if (concernsThisPost(event)) live();
    });
    return () => {
      live.cancel();
      off();
    };
  }, [id, load]);

  const onLike = async (p: FeedPost) => {
    setPost((cur) => (cur ? withLike(cur, !p.likedByMe) : cur));
    try {
      await toggleLike(p.id);
    } catch {
      setPost((cur) => (cur ? withLike(cur, p.likedByMe) : cur));
    }
  };

  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const onDelete = async (p: FeedPost) => {
    await removePost(p.id);
    router.back();
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
      <Screen header>
        <Stack.Screen options={stackHeader(t, 'Post')} />
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
    <Screen flush header>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Stack.Screen options={stackHeader(t, 'Post')} />
        <FlatList
          data={comments}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingBottom: t.spacing.lg, gap: t.spacing.sm }}
          ListHeaderComponent={
            post ? (
              <View style={{ borderBottomWidth: t.borders.hairline, borderColor: t.colors.border }}>
                <PostCard
                  post={post}
                  onToggleLike={onLike}
                  onReact={onReactPost}
                  onPressImage={(_, i) => setViewerIndex(i)}
                  onDelete={post.author.id === myId ? onDelete : undefined}
                />
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
              <Text tone="muted" align="center" style={{ padding: t.spacing.xl }}>
                Sem comentários ainda. Puxa o assunto.
              </Text>
            )
          }
          renderItem={({ item }) => <CommentItem comment={item} onReact={onReactComment} />}
        />
        <View
          style={{
            gap: t.spacing.sm,
            paddingHorizontal: t.layout.gutter,
            paddingTop: t.spacing.sm,
            paddingBottom: t.spacing.sm + insets.bottom,
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
            {/* avatar centrado na altura de uma linha do campo (44) */}
            <View style={{ height: t.layout.minTouch, justifyContent: 'center' }}>
              <Avatar name={me.name} uri={me.uri} size={t.avatarSizes.sm} />
            </View>
            <View style={{ flex: 1 }}>
              <TextField
                label="Comentar"
                hideLabel
                shape="pill"
                multiline
                numberOfLines={1}
                placeholder={`Comentar como ${me.name.split(' ')[0]}…`}
                value={text}
                onChangeText={setText}
                editable={!sending}
                maxLength={1000}
              />
            </View>
            <IconButton
              icon="arrow-up"
              variant="solid"
              accessibilityLabel="Enviar"
              onPress={send}
              disabled={!text.trim() || sending}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
      {post && viewerIndex !== null ? (
        <PhotoViewer
          uris={post.images}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          alt={`Foto postada por ${post.author.display_name || post.author.username}`}
        />
      ) : null}
    </Screen>
  );
}
