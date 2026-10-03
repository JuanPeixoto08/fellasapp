import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import type { FeedPost } from '../lib/api/posts';

type Props = {
  post: FeedPost;
  onToggleLike?: (post: FeedPost) => void;
  onPress?: (post: FeedPost) => void;
};

export function PostCard({ post, onToggleLike, onPress }: Props) {
  const name = post.author.display_name || post.author.username;
  return (
    <View style={styles.card}>
      <View style={styles.header}>
        {post.author.avatar_url ? (
          <Image source={{ uri: post.author.avatar_url }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>{name.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <Text style={styles.name}>{name}</Text>
      </View>
      <Pressable onPress={() => onPress?.(post)}>
        {post.body ? <Text style={styles.body}>{post.body}</Text> : null}
        {post.imageUrl ? (
          <Image
            source={{ uri: post.imageUrl }}
            style={styles.image}
            resizeMode="cover"
            accessibilityLabel="Imagem do post"
          />
        ) : null}
      </Pressable>
      <View style={styles.actions}>
        <Pressable
          onPress={() => onToggleLike?.(post)}
          accessibilityRole="button"
          accessibilityLabel={post.likedByMe ? 'Descurtir' : 'Curtir'}
        >
          <Text style={[styles.action, post.likedByMe && styles.liked]}>
            {post.likedByMe ? '♥' : '♡'} {post.likeCount}
          </Text>
        </Pressable>
        <Pressable
          onPress={() => onPress?.(post)}
          accessibilityRole="button"
          accessibilityLabel="Comentários"
        >
          <Text style={styles.action}>💬 {post.commentCount}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#ccc',
    backgroundColor: '#fff',
  },
  header: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 8 },
  avatarFallback: { backgroundColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontWeight: '700' },
  name: { fontWeight: '600', fontSize: 15 },
  body: { fontSize: 16, marginBottom: 8 },
  image: { width: '100%', aspectRatio: 1, borderRadius: 8, backgroundColor: '#eee' },
  actions: { flexDirection: 'row', gap: 20, marginTop: 8 },
  action: { fontSize: 15, color: '#444' },
  liked: { color: '#e0245e' },
});
