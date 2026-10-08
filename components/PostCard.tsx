import { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';

import { CommentButton } from './feed/CommentButton';
import { LikeButton } from './feed/LikeButton';
import { PhotoViewer } from './feed/PhotoViewer';
import { PostImages } from './feed/PostImages';
import { ReactButton, ReactionBar, ReactionPicker } from './reactions';
import { Avatar, ConfirmDialog, Icon, IconButton, NameWithBadge, Text } from './ui';
import { useTheme } from '../lib/theme';
import type { FeedPost } from '../lib/api/posts';
import { postTime } from '../lib/format';
import { MentionText } from './MentionText';
import { AuthorLink } from './profile/AuthorLink';
import { PlaceLink } from './places/PlaceLink';
import { nextReaction } from '../lib/reactionState';

type Props = {
  post: FeedPost;
  onToggleLike?: (post: FeedPost) => void;
  onPress?: (post: FeedPost) => void;
  onReact?: (post: FeedPost, emoji: string | null) => void;
  /** Só para posts meus: mostra a lixeira e pede confirmação antes de chamar. */
  onDelete?: (post: FeedPost) => Promise<void>;
  /** Foto e nome abrem o perfil do autor (padrão). Desligado no perfil da própria pessoa. */
  linkAuthor?: boolean;
  /** O local abre a página dele (padrão). Desligado na própria página do local. */
  linkPlace?: boolean;
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
  onReact,
  onDelete,
  linkAuthor = true,
  linkPlace = true,
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
  // tocar numa foto abre ela em tela cheia; o resto da linha é que abre o post
  const [viewing, setViewing] = useState<number | null>(null);

  return (
    <>
      {/* A linha toda abre o post (vão ao lado do nome, abaixo da foto, entre as ações); só foto e nome abrem o perfil.
        Não acessível como um bloco: o leitor de tela segue pelos itens de dentro, e o texto já é o botão "Abrir post". */}
      <Pressable
        testID="post-row"
        onPress={onPress ? () => onPress(post) : undefined}
        disabled={!onPress}
        accessible={false}
        focusable={false}
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
          ...(onPress ? { cursor: 'pointer' as const } : null),
        }}
      >
        {/* sem esticar até o fim da linha: abaixo da foto já é o post */}
        <AuthorLink username={post.author.username} name={name} enabled={linkAuthor} style={{ alignSelf: 'flex-start' }}>
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
          {/* nome e local juntos, na altura do avatar (sem o espaço da coluna entre eles) */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: t.avatarSizes.md / 2 }}>
              <AuthorLink username={post.author.username} name={name} enabled={linkAuthor} style={{ flexShrink: 1 }}>
                <NameWithBadge name={name} badges={post.author.badges} hiddenBadges={post.author.hidden_badges} bold />
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
            {post.location ? (
              <PlaceLink location={post.location} placeKey={post.placeKey} enabled={linkPlace} />
            ) : null}
          </View>
          {post.body ? (
            <Pressable
              onPress={onPress ? () => onPress(post) : undefined}
              onLongPress={() => setPicking(true)}
              accessibilityRole="button"
              accessibilityLabel={`Abrir post de ${name}`}
            >
              <MentionText text={post.body} tags />
            </Pressable>
          ) : null}
          <PostImages uris={post.images} alt={`Foto postada por ${name}`} onPressImage={setViewing} />
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
      </Pressable>
      {/* fora da linha tocável: na web o toque num modal sobe pela árvore e abriria o post */}
      {viewing !== null ? (
        <PhotoViewer uris={post.images} index={viewing} alt={`Foto postada por ${name}`} onClose={() => setViewing(null)} />
      ) : null}
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
    </>
  );
}
