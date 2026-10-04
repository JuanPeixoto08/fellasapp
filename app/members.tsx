import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { MemberRow } from '../components/profile/MemberRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Divider, EmptyState, Screen, Text } from '../components/ui';
import { resolveUrl } from '../lib/api/storage';
import { useTheme } from '../lib/theme';
import { useMembers } from '../lib/useMembers';

export default function MembersScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { members, avatars, loading, error, reload } = useMembers();

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
        onAction={reload}
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
