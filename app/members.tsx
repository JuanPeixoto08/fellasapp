import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { MemberRow } from '../components/profile/MemberRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Divider, EmptyState, Screen, Text } from '../components/ui';
import { listMembers, type Profile } from '../lib/api/profiles';
import { resolveUrl, signPaths } from '../lib/api/storage';
import { friendlyError } from '../lib/errors';
import { useTheme } from '../lib/theme';

export default function MembersScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [members, setMembers] = useState<Profile[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    listMembers()
      .then(async (list) => {
        // sem as fotos a lista ainda serve (iniciais), então falha na assinatura não derruba a tela
        setAvatars(await signPaths(list.map((m) => m.avatar_url)).catch(() => new Map()));
        setMembers(list);
      })
      .catch((e) => setError(friendlyError(e, 'Pode ter sido a conexão. Tenta de novo daqui a pouco.')))
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
          <MemberRow
            member={item}
            avatarUri={resolveUrl(item.avatar_url, avatars)}
            onPress={() => router.push(`/user/${item.id}`)}
          />
        )}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Membros')} />
      <Screen header>{body}</Screen>
    </>
  );
}
