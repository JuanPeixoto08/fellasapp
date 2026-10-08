import { useRef, useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReactButton, ReactionBar, ReactionPicker } from '../reactions';
import { Avatar, ConfirmDialog, IconButton, NameWithBadge, Text } from '../ui';
import { useTheme } from '../../lib/theme';
import type { Comment } from '../../lib/api/posts';
import { postTime } from '../../lib/format';
import { MentionText } from '../MentionText';
import { AuthorLink } from '../profile/AuthorLink';
import { nextReaction } from '../../lib/reactionState';
import { PostImages } from './PostImages';

type Props = {
  comment: Comment;
  onReact?: (comment: Comment, emoji: string | null) => void;
  /** Só para comentários meus: mostra a lixeira e pede confirmação antes de chamar. */
  onDelete?: (comment: Comment) => Promise<void>;
  /** Tocar numa imagem do comentário (abre o visualizador). */
  onPressImage?: (comment: Comment, index: number) => void;
};

/** Comentário no mesmo desenho do post: sem caixa, data à direita, chips e carinha de reagir. */
export function CommentItem({ comment, onReact, onDelete, onPressImage }: Props) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);
  const [confirming, setConfirming] = useState(false);
  // a barra de reações abre presa a este botão
  const reactAnchor = useRef<View>(null);
  const react = (emoji: string) => onReact?.(comment, nextReaction(comment.myReaction, emoji));
  const name = comment.author.display_name || comment.author.username;
  const date = postTime(comment.createdAt);
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.md, paddingHorizontal: t.layout.gutter, paddingTop: t.spacing.sm }}>
      <AuthorLink username={comment.author.username} name={name}>
        <Avatar name={name} uri={comment.author.avatar_url} size={t.avatarSizes.sm} />
      </AuthorLink>
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <AuthorLink username={comment.author.username} name={name} style={{ flexShrink: 1 }}>
            <NameWithBadge name={name} badges={comment.author.badges} featuredBadge={comment.author.featured_badge} variant="small" bold />
          </AuthorLink>
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
                accessibilityLabel="Apagar comentário"
                variant="ghost"
                tone="muted"
                size="sm"
                onPress={() => setConfirming(true)}
              />
            </View>
          ) : null}
        </View>
        {/* carinha ao lado do texto, como no WhatsApp; os chips só ocupam linha quando existem */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm }}>
          <Pressable
            onLongPress={() => setPicking(true)}
            accessibilityLabel={`Comentário de ${name}`}
            style={{ flex: 1 }}
          >
            {comment.body ? <MentionText text={comment.body} /> : null}
          </Pressable>
          <View style={{ marginVertical: -t.spacing.sm, marginRight: -t.spacing.sm }}>
            <ReactButton myReaction={comment.myReaction} onPress={() => setPicking(true)} anchorRef={reactAnchor} />
          </View>
        </View>
        {comment.images?.length ? (
          <View style={{ maxWidth: t.layout.commentMediaWidth }}>
            <PostImages
              uris={comment.images}
              alt={`Imagem de ${name}`}
              onPressImage={onPressImage ? (i) => onPressImage(comment, i) : undefined}
            />
          </View>
        ) : null}
        <ReactionBar reactions={comment.reactions} myReaction={comment.myReaction} onPressChip={react} />
        <ReactionPicker
          anchorRef={reactAnchor}
          visible={picking}
          selected={comment.myReaction}
          onSelect={(emoji) => {
            setPicking(false);
            react(emoji);
          }}
          onClose={() => setPicking(false)}
        />
      </View>
      {onDelete ? (
        <ConfirmDialog
          visible={confirming}
          title="Apagar comentário?"
          message="Some do post junto com as reações. Não tem volta."
          confirmLabel="Apagar"
          errorMessage="Não rolou apagar. Tenta de novo."
          onConfirm={async () => {
            await onDelete(comment);
            setConfirming(false);
          }}
          onClose={() => setConfirming(false)}
        />
      ) : null}
    </View>
  );
}
