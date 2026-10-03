import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReactButton, ReactionBar, ReactionPicker } from '../reactions';
import { Avatar, Text } from '../ui';
import { useTheme } from '../../lib/theme';
import type { Comment } from '../../lib/api/posts';
import { nextReaction } from '../../lib/reactionState';

type Props = {
  comment: Comment;
  onReact?: (comment: Comment, emoji: string | null) => void;
};

export function CommentItem({ comment, onReact }: Props) {
  const t = useTheme();
  const [picking, setPicking] = useState(false);
  const react = (emoji: string) => onReact?.(comment, nextReaction(comment.myReaction, emoji));
  const name = comment.author.display_name || comment.author.username;
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.sm }}>
      <Avatar name={name} uri={comment.author.avatar_url} size={32} />
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <Text variant="small" bold>
          {name}
        </Text>
        <Pressable onLongPress={() => setPicking(true)} accessibilityLabel={`Comentário de ${name}`}>
          <Text>{comment.body}</Text>
        </Pressable>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: t.spacing.xs }}>
          <ReactButton onPress={() => setPicking(true)} />
          <ReactionBar reactions={comment.reactions} myReaction={comment.myReaction} onPressChip={react} />
        </View>
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
