import { Stack, useFocusEffect, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationRow } from '../components/notifications/NotificationRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Divider, EmptyState, Screen } from '../components/ui';
import { fetchNotifications, markNotificationsSeen } from '../lib/api/notifications';
import { listActiveStories } from '../lib/api/stories';
import type { AppNotification } from '../lib/notifications';
import { setUnreadNotifications } from '../lib/notificationsStore';
import { openStories } from '../lib/storyViewerStore';
import { affectsNotifications, debounce, LIVE_DEBOUNCE_MS, onLive } from '../lib/realtime';
import { useTheme } from '../lib/theme';

export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  // chaves que chegaram como novas nesta visita: abrir uma notificação e voltar não apaga o destaque das outras
  const newThisVisit = useRef(new Set<string>());

  /**
   * Busca, mostra (as novas já vêm marcadas) e só então marca tudo como visto.
   * `silent` (ao vivo): sem carregando e, se falhar, fica a lista que já está na tela.
   */
  const load = useCallback(async (mode: 'show' | 'pull' | 'silent' = 'show') => {
    if (mode === 'pull') setRefreshing(true);
    else if (mode === 'show') setLoading(true);
    try {
      const list = await fetchNotifications();
      for (const n of list) if (n.unread) newThisVisit.current.add(n.key);
      setItems(list.map((n) => (newThisVisit.current.has(n.key) ? { ...n, unread: true } : n)));
      setError(false);
      await markNotificationsSeen().catch(() => {});
      setUnreadNotifications(0);
    } catch {
      if (mode !== 'silent') setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // tempo real: com a tela à vista, o que chega entra sozinho. Escondida atrás de um post aberto daqui
  // ela não recarrega (nem marcaria como visto o que a pessoa ainda não viu); ao voltar, o foco recarrega.
  const focused = useIsFocused();
  useEffect(() => {
    if (!focused) return;
    const live = debounce(() => void load('silent'), LIVE_DEBOUNCE_MS);
    const off = onLive((event) => {
      if (affectsNotifications(event)) live();
    });
    return () => {
      live.cancel();
      off();
    };
  }, [focused, load]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = (n: AppNotification) => {
    if (n.kind === 'story_reaction' && n.storyId) {
      // abre o meu story que recebeu a reação (se já sumiu, não faz nada)
      const storyId = n.storyId;
      listActiveStories()
        .then((groups) => {
          const group = groups.find((g) => g.stories.some((s) => s.id === storyId));
          if (group) openStories(groups, group.author.id, storyId);
        })
        .catch(() => {});
      return;
    }
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
        onRefresh={() => void load('pull')}
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
