import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text } from 'react-native';

import { listMembers, type Profile } from '../lib/api/profiles';

export default function MembersScreen() {
  const router = useRouter();
  const [members, setMembers] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listMembers()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar membros'));
  }, []);

  if (error) return <Text style={styles.error}>{error}</Text>;

  return (
    <FlatList
      data={members}
      keyExtractor={(m) => m.id}
      renderItem={({ item }) => (
        <Pressable style={styles.row} onPress={() => router.push(`/user/${item.id}`)}>
          <Text style={styles.name}>{item.display_name || item.username}</Text>
          <Text style={styles.username}>@{item.username}</Text>
        </Pressable>
      )}
    />
  );
}

const styles = StyleSheet.create({
  row: { padding: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#ccc' },
  name: { fontWeight: '600' },
  username: { color: '#666' },
  error: { color: 'crimson', padding: 16 },
});
