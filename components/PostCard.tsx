import { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { CommentButton } from './feed/CommentButton';
import { LikeButton } from './feed/LikeButton';
import { PostImages } from './feed/PostImages';
import { ReactButton, ReactionBar, ReactionPicker } from './reactions';
import { Avatar, ConfirmDialog, Icon, IconButton, Text } from './ui';
import { useTheme } from '../lib/theme';
import type { FeedPost } from '../lib/api/posts';
import { postTime } from '../lib/format';
import { MentionText } from './MentionText';
import { AuthorLink } from './profile/AuthorLink';
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
  /** Foto e nome abrem o perfil do autor (padrão). Desligado no perfil da própria pessoa. */
  linkAuthor?: boolean;
  /** Post fixado no topo do perfil: etiqueta "Fixado". */
  pinned?: boolean;
  /** Só no meu perfil: alfinete para fixar/desafixar. */
  onTogglePin?: (post: FeedPost) => void;
};

/**
 * Post sem caixa, direto no papel (as listas separam com fio): avatar numa coluna, conteúdo na outra.
 * Ações discretas embaixo (curtir, comentar) e a carinha de reagir isolada à direita.
 */
export function PostCard({
  post,
  onToggleLike,
  onPress,
  onPressImage,
  onReact,
  onDelete,
  linkAuthor = true,
  pinned = false,
  onTogglePin,
}: Props) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);
  // a barra de reações abre presa a este botão
  const reactAnchor = useRef<View>(null);
  const [confirming, setConfirming] = useState(false);
  const [hovered, setHovered] = useState(false);
  const react = (emoji: string) => onReact?.(post, nextReaction(post.myReaction, emoji));
  const name = post.author.display_name || post.author.username;
  const date = postTime(post.createdAt);
  const pressImage = onPressImage
    ? (i: number) => onPressImage(post, i)
    : onPress
      ? () => onPress(post)
      : undefined;

  return (
    <View
      testID="post-row"
      // hover só na web: no RN 0.86 o toque também dispara pointerenter/leave e a linha piscaria no celular
      {...(Platform.OS === 'web'
        ? { onPointerEnter: () => setHovered(true), onPointerLeave: () => setHovered(false) }
        : null)}
      style={{
        flexDirection: 'row',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.xs,
        backgroundColor: hovered ? t.colors.surfaceSunken : 'transparent',
      }}
    >
      <AuthorLink userId={post.author.id} name={name} enabled={linkAuthor}>
        <Avatar name={name} uri={post.author.avatar_url} size={t.avatarSizes.md} />
      </AuthorLink>
      <View style={{ flex: 1, gap: t.spacing.sm }}>
        {pinned ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs }}>
            <Icon name="pin-outline" size="sm" tone="muted" />
            <Text variant="caption" tone="muted" bold>
              Fixado
            </Text>
          </View>
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: t.avatarSizes.md / 2 }}>
          <AuthorLink userId={post.author.id} name={name} enabled={linkAuthor} style={{ flexShrink: 1 }}>
            <Text bold numberOfLines={1}>
              {name}
            </Text>
          </AuthorLink>
          <View style={{ flex: 1 }} />
          {date ? (
            <Text variant="caption" tone="muted">
              {date}
            </Text>
          ) : null}
          {onTogglePin ? (
            <View style={{ marginVertical: -t.spacing.md, marginRight: onDelete ? -t.spacing.md : 0 }}>
              <IconButton
                icon="pin-outline"
                accessibilityLabel={pinned ? 'Desafixar do perfil' : 'Fixar no perfil'}
                variant="ghost"
                tone={pinned ? 'default' : 'muted'}
                size="sm"
                onPress={() => onTogglePin(post)}
              />
            </View>
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
            <MentionText text={post.body} />
          </Pressable>
        ) : null}
        <PostImages uris={post.images} alt={`Foto postada por ${name}`} onPressImage={pressImage} />
        <ReactionBar reactions={post.reactions} myReaction={post.myReaction} onPressChip={react} />
        <View style={{ flexDirection: 'row', alignItems: 'center', marginLeft: -t.spacing.sm }}>
          <LikeButton liked={post.likedByMe} count={post.likeCount} onPress={() => onToggleLike?.(post)} />
          <CommentButton count={post.commentCount} onPress={() => onPress?.(post)} />
          <View style={{ flex: 1 }} />
          <View style={{ marginRight: -t.spacing.sm }}>
            <ReactButton myReaction={post.myReaction} onPress={() => setPicking(true)} anchorRef={reactAnchor} />
          </View>
        </View>
      </View>
      <ReactionPicker
        anchorRef={reactAnchor}
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
