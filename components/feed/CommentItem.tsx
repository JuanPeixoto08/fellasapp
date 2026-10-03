import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReactButton, ReactionBar, ReactionPicker } from '../reactions';
import { Avatar, Text } from '../ui';
import { useTheme } from '../../lib/theme';
import type { Comment } from '../../lib/api/posts';
import { shortDate } from '../../lib/format';
import { nextReaction } from '../../lib/reactionState';

type Props = {
  comment: Comment;
  onReact?: (comment: Comment, emoji: string | null) => void;
};

/** Comentário no mesmo desenho do post: sem caixa, data à direita, chips e carinha de reagir. */
export function CommentItem({ comment, onReact }: Props) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);
  const react = (emoji: string) => onReact?.(comment, nextReaction(comment.myReaction, emoji));
  const name = comment.author.display_name || comment.author.username;
  const date = shortDate(comment.createdAt);
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.md, paddingHorizontal: t.layout.gutter, paddingTop: t.spacing.sm }}>
      <Avatar name={name} uri={comment.author.avatar_url} size={t.avatarSizes.sm} />
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {name}
          </Text>
          <View style={{ flex: 1 }} />
          {date ? (
            <Text variant="caption" tone="muted">
              {date}
            </Text>
          ) : null}
        </View>
        {/* carinha ao lado do texto, como no WhatsApp; os chips só ocupam linha quando existem */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: t.spacing.sm }}>
          <Pressable
            onLongPress={() => setPicking(true)}
            accessibilityLabel={`Comentário de ${name}`}
            style={{ flex: 1 }}
          >
            <Text>{comment.body}</Text>
          </Pressable>
          <View style={{ marginVertical: -t.spacing.sm, marginRight: -t.spacing.sm }}>
            <ReactButton myReaction={comment.myReaction} onPress={() => setPicking(true)} />
          </View>
        </View>
        <ReactionBar reactions={comment.reactions} myReaction={comment.myReaction} onPressChip={react} />
        <ReactionPicker
          visible={picking}
          selected={comment.myReaction}
          onSelect={(emoji) => {
            setPicking(false);
            react(emoji);
          }}
          onClose={() => setPicking(false)}
        />
      </View>
    </View>
  );
}
