import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationRow } from '../components/notifications/NotificationRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Divider, EmptyState, Screen } from '../components/ui';
import { fetchNotifications, markNotificationsSeen } from '../lib/api/notifications';
import type { AppNotification } from '../lib/notifications';
import { setUnreadNotifications } from '../lib/notificationsStore';
import { useTheme } from '../lib/theme';

export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  /** Busca, mostra (as novas já vêm marcadas) e só então marca tudo como visto. */
  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await fetchNotifications();
      setItems(list);
      setError(false);
      await markNotificationsSeen().catch(() => {});
      setUnreadNotifications(0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = (n: AppNotification) => {
    if (n.postId) router.push(`/post/${n.postId}`);
    else if (n.actors[0]) router.push(`/user/${n.actors[0].id}`);
  };

  let body;
  if (loading && items.length === 0) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.primary} accessibilityLabel="Carregando notificações" />
      </View>
    );
  } else if (error && items.length === 0) {
    body = (
      <EmptyState
        title="Não deu pra carregar as notificações."
        message="Confere a internet e tenta de novo."
        actionLabel="Tentar de novo"
        onAction={() => void load()}
      />
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(n) => n.key}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        ListEmptyComponent={
          <EmptyState
            title="Nada por aqui ainda."
            message="Quando alguém curtir, comentar ou reagir, aparece aqui."
          />
        }
        renderItem={({ item }) => <NotificationRow item={item} onPress={open} />}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Notificações')} />
      <Screen header>{body}</Screen>
    </>
  );
}
