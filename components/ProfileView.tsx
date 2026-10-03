import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  getProfile,
  getSignedUrl,
  listPostsByUser,
  type Post,
  type Profile,
} from '../lib/api/profiles';

type Props = {
  userId: string;
  /** Botões (Editar/Sair) exibidos apenas no meu perfil. */
  actions?: React.ReactNode;
};

export default function ProfileView({ userId, actions }: Props) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [avatar, setAvatar] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const [p, ps] = await Promise.all([getProfile(userId), listPostsByUser(userId)]);
      setProfile(p);
      setPosts(ps);
      setAvatar(await getSignedUrl(p.avatar_url));
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perfil');
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) return <ActivityIndicator style={styles.center} />;
  if (error || !profile) {
    return <Text style={styles.error}>{error ?? 'Perfil não encontrado'}</Text>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        {avatar ? (
          <Image source={{ uri: avatar }} style={styles.avatar} accessibilityLabel="Avatar" />
        ) : (
          <View style={[styles.avatar, styles.avatarEmpty]} />
        )}
        <Text style={styles.name}>{profile.display_name || profile.username}</Text>
        <Text style={styles.username}>@{profile.username}</Text>
        {profile.bio ? <Text style={styles.bio}>{profile.bio}</Text> : null}
        {actions}
      </View>
      <Text style={styles.section}>Posts ({posts.length})</Text>
      <View style={styles.grid}>
        {posts.map((post) => (
          <PostTile key={post.id} post={post} />
        ))}
      </View>
      {posts.length === 0 ? <Text style={styles.empty}>Nenhum post ainda</Text> : null}
    </ScrollView>
  );
}

function PostTile({ post }: { post: Post }) {
  const [uri, setUri] = useState<string | null>(null);
  useEffect(() => {
    getSignedUrl(post.image_url).then(setUri);
  }, [post.image_url]);

  return (
    <View style={styles.tile} testID="post-tile">
      {uri ? (
        <Image source={{ uri }} style={styles.tileImage} />
      ) : (
        <Text style={styles.tileText} numberOfLines={4}>
          {post.body}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16 },
  center: { flex: 1 },
  header: { alignItems: 'center', gap: 6, marginBottom: 16 },
  avatar: { width: 96, height: 96, borderRadius: 48 },
  avatarEmpty: { backgroundColor: '#ddd' },
  name: { fontSize: 20, fontWeight: '600' },
  username: { color: '#666' },
  bio: { textAlign: 'center' },
  section: { fontWeight: '600', marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  tile: {
    width: '32%',
    aspectRatio: 1,
    backgroundColor: '#f2f2f2',
    padding: 4,
    overflow: 'hidden',
  },
  tileImage: { width: '100%', height: '100%' },
  tileText: { fontSize: 12 },
  empty: { color: '#888', textAlign: 'center', marginTop: 16 },
  error: { color: 'crimson', padding: 16 },
});
