import { View } from 'react-native';

import { Avatar, Text } from '../ui';
import { useTheme } from '../../lib/theme';
import type { Comment } from '../../lib/api/posts';

export function CommentItem({ comment }: { comment: Comment }) {
  const t = useTheme();
  const name = comment.author.display_name || comment.author.username;
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.md, paddingVertical: t.spacing.sm }}>
      <Avatar name={name} uri={comment.author.avatar_url} size={32} />
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <Text variant="small" bold>
          {name}
        </Text>
        <Text>{comment.body}</Text>
      </View>
    </View>
  );
}
