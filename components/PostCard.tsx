import { Image, Pressable, View } from 'react-native';

import { CommentButton } from './feed/CommentButton';
import { LikeButton } from './feed/LikeButton';
import { Avatar, Card, Text } from './ui';
import { useTheme } from '../lib/theme';
import type { FeedPost } from '../lib/api/posts';

type Props = {
  post: FeedPost;
  onToggleLike?: (post: FeedPost) => void;
  onPress?: (post: FeedPost) => void;
};

export function PostCard({ post, onToggleLike, onPress }: Props) {
  const t = useTheme();
  const name = post.author.display_name || post.author.username;
  return (
    <Card>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md }}>
        <Avatar name={name} uri={post.author.avatar_url} size={40} />
        <Text bold style={{ flex: 1 }} numberOfLines={1}>
          {name}
        </Text>
      </View>
      {post.body || post.imageUrl ? (
        <Pressable
          onPress={onPress ? () => onPress(post) : undefined}
          accessibilityRole="button"
          accessibilityLabel={`Abrir post de ${name}`}
          style={{ gap: t.spacing.md }}
        >
          {post.body ? <Text variant="lead">{post.body}</Text> : null}
          {post.imageUrl ? (
            <Image
              source={{ uri: post.imageUrl }}
              resizeMode="cover"
              accessibilityLabel={`Foto postada por ${name}`}
              style={{
                width: '100%',
                aspectRatio: 1,
                borderRadius: t.radii.md,
                backgroundColor: t.colors.surfaceSunken,
              }}
            />
          ) : null}
        </Pressable>
      ) : null}
      <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
        <LikeButton liked={post.likedByMe} count={post.likeCount} onPress={() => onToggleLike?.(post)} />
        <CommentButton count={post.commentCount} onPress={() => onPress?.(post)} />
      </View>
    </Card>
  );
}
