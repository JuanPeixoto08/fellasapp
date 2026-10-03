import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { MemberRow } from '../components/profile/MemberRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Divider, EmptyState, Screen, Text } from '../components/ui';
import { listMembers, type Profile } from '../lib/api/profiles';
import { useTheme } from '../lib/theme';

export default function MembersScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<Profile[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listMembers()
      .then(setMembers)
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar membros'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  let body;
  if (loading) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: t.spacing.md }}>
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Chamando a galera…</Text>
      </View>
    );
  } else if (error) {
    body = (
      <EmptyState
        title="Não deu pra carregar a galera"
        message={error}
        actionLabel="Tentar de novo"
        onAction={load}
      />
    );
  } else {
    body = (
      <FlatList
        data={members}
        keyExtractor={(m) => m.id}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
        ListEmptyComponent={
          <EmptyState title="Ninguém por aqui ainda" message="Os membros do grupo aparecem nesta lista." />
        }
        renderItem={({ item }) => (
          <MemberRow member={item} onPress={() => router.push(`/user/${item.id}`)} />
        )}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Membros')} />
      <Screen>{body}</Screen>
    </>
  );
}
