import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
  Button,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { PostCard } from '../../components/PostCard';
import {
  addComment,
  getPost,
  listComments,
  toggleLike,
  type Comment,
  type FeedPost,
} from '../../lib/api/posts';

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [post, setPost] = useState<FeedPost | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const [p, c] = await Promise.all([getPost(id), listComments(id)]);
      setPost(p);
      setComments(c);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar o post');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const onLike = async (p: FeedPost) => {
    try {
      await toggleLike(p.id);
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao curtir');
    }
  };

  const send = async () => {
    try {
      await addComment(id, text);
      setText('');
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao comentar');
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ headerShown: true, title: 'Post' }} />
      <FlatList
        data={comments}
        keyExtractor={(c) => c.id}
        ListHeaderComponent={post ? <PostCard post={post} onToggleLike={onLike} /> : null}
        ListEmptyComponent={<Text style={styles.msg}>{error ?? 'Sem comentários ainda.'}</Text>}
        renderItem={({ item }) => (
          <View style={styles.comment}>
            <Text style={styles.author}>
              {item.author.display_name || item.author.username}
            </Text>
            <Text>{item.body}</Text>
          </View>
        )}
      />
      <View style={styles.composer}>
        <TextInput
          style={styles.input}
          placeholder="Comentar..."
          value={text}
          onChangeText={setText}
        />
        <Button title="Enviar" onPress={send} disabled={!text.trim()} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  msg: { padding: 16, textAlign: 'center' },
  comment: { paddingHorizontal: 12, paddingVertical: 8 },
  author: { fontWeight: '600' },
  composer: { flexDirection: 'row', alignItems: 'center', padding: 8, gap: 8 },
  input: { flex: 1, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 8 },
});
