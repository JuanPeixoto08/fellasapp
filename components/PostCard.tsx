import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { CommentButton } from './feed/CommentButton';
import { LikeButton } from './feed/LikeButton';
import { PostImages } from './feed/PostImages';
import { ReactButton, ReactionBar, ReactionPicker } from './reactions';
import { Avatar, ConfirmDialog, IconButton, Text } from './ui';
import { useTheme } from '../lib/theme';
import type { FeedPost } from '../lib/api/posts';
import { shortDate } from '../lib/format';
import { nextReaction } from '../lib/reactionState';

type Props = {
  post: FeedPost;
  onToggleLike?: (post: FeedPost) => void;
  onPress?: (post: FeedPost) => void;
  /** Toque numa foto; sem isso, a foto abre o post (`onPress`). */
  onPressImage?: (post: FeedPost, index: number) => void;
  onReact?: (post: FeedPost, emoji: string | null) => void;
  /** Só para posts meus: mostra a lixeira e pede confirmação antes de chamar. */
  onDelete?: (post: FeedPost) => Promise<void>;
};

/**
 * Post sem caixa, direto no papel (as listas separam com fio): avatar numa coluna, conteúdo na outra.
 * Ações discretas embaixo (curtir, comentar) e a carinha de reagir isolada à direita.
 */
export function PostCard({ post, onToggleLike, onPress, onPressImage, onReact, onDelete }: Props) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const react = (emoji: string) => onReact?.(post, nextReaction(post.myReaction, emoji));
  const name = post.author.display_name || post.author.username;
  const date = shortDate(post.createdAt);
  const pressImage = onPressImage
    ? (i: number) => onPressImage(post, i)
    : onPress
      ? () => onPress(post)
      : undefined;

  return (
    <View
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        flexDirection: 'row',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.xs,
        backgroundColor: hovered ? t.colors.surfaceSunken : 'transparent',
      }}
    >
      <Avatar name={name} uri={post.author.avatar_url} size={t.avatarSizes.md} />
      <View style={{ flex: 1, gap: t.spacing.sm }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: t.avatarSizes.md / 2 }}>
          <Text bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          <View style={{ flex: 1 }} />
          {date ? (
            <Text variant="caption" tone="muted">
              {date}
            </Text>
          ) : null}
          {onDelete ? (
            // a lixeira mantém 44pt de toque sem esticar a linha do nome
            <View style={{ marginVertical: -t.spacing.md, marginRight: -t.spacing.md }}>
              <IconButton
                icon="trash-outline"
                accessibilityLabel="Apagar post"
                variant="ghost"
                tone="muted"
                size="sm"
                onPress={() => setConfirming(true)}
              />
            </View>
          ) : null}
        </View>
        {post.body ? (
          <Pressable
            onPress={onPress ? () => onPress(post) : undefined}
            onLongPress={() => setPicking(true)}
            accessibilityRole="button"
            accessibilityLabel={`Abrir post de ${name}`}
          >
            <Text>{post.body}</Text>
          </Pressable>
        ) : null}
        <PostImages uris={post.images} alt={`Foto postada por ${name}`} onPressImage={pressImage} />
        <ReactionBar reactions={post.reactions} myReaction={post.myReaction} onPressChip={react} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -t.spacing.sm }}>
          <LikeButton liked={post.likedByMe} count={post.likeCount} onPress={() => onToggleLike?.(post)} />
          <CommentButton count={post.commentCount} onPress={() => onPress?.(post)} />
          <View style={{ flex: 1 }} />
          <View style={{ marginRight: -t.spacing.sm }}>
            <ReactButton myReaction={post.myReaction} onPress={() => setPicking(true)} />
          </View>
        </View>
      </View>
      <ReactionPicker
        visible={picking}
        selected={post.myReaction}
        onSelect={(emoji) => {
          setPicking(false);
          react(emoji);
        }}
        onClose={() => setPicking(false)}
      />
      {onDelete ? (
        <ConfirmDialog
          visible={confirming}
          title="Apagar esse post?"
          message="Some do feed e do seu perfil, junto com as curtidas, reações e comentários. Não tem volta."
          confirmLabel="Apagar"
          errorMessage="Não rolou apagar. Tenta de novo."
          onConfirm={async () => {
            await onDelete(post);
            setConfirming(false);
          }}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </View>
  );
}
