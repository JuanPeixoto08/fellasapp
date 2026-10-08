import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { tabHeader } from '../../components/profile/headerOptions';
import { Badge } from '../../components/ui';
import { useLayoutTier } from '../../lib/layout';
import { notificationsLabel } from '../../lib/notifications';
import { useUnreadNotifications } from '../../lib/notificationsStore';
import { emitFeedTop } from '../../lib/postEvents';
import { getTabBarStyle } from '../../lib/tabBarStyle';
import { useTheme } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  };
}

/** Sino da barra de baixo, com a bolinha de não lidas no canto. */
export function NotificationsTabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
  const count = useUnreadNotifications();
  return (
    <View>
      <Ionicons name={focused ? 'notifications' : 'notifications-outline'} size={size} color={color} />
      <View pointerEvents="none" style={{ position: 'absolute', top: -size / 3, right: -size / 2 }}>
        <Badge count={count} />
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const tier = useLayoutTier();
  const unread = useUnreadNotifications();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.colors.bg },
        tabBarActiveTintColor: t.colors.brand,
        tabBarInactiveTintColor: t.colors.textMuted,
        // só ícones, lado a lado; o nome fica no rótulo acessível
        tabBarShowLabel: false,
        // no desktop a navegação é a barra lateral da moldura
        tabBarStyle: tier === 'compact' ? getTabBarStyle(t, insets) : { display: 'none' },
      }}
    >
      <Tabs.Screen
        name="feed"
        // tocar na aba Feed já estando nela: topo e recarrega
        listeners={({ navigation }) => ({
          tabPress: () => {
            if (navigation.isFocused()) emitFeedTop();
          },
        })}
        options={{
          title: 'Feed',
          tabBarAccessibilityLabel: 'Feed',
          tabBarIcon: tabIcon('newspaper', 'newspaper-outline'),
        }}
      />
      <Tabs.Screen
        name="new"
        options={{
          title: 'Novo post',
          tabBarAccessibilityLabel: 'Novo post',
          tabBarIcon: tabIcon('add-circle', 'add-circle-outline'),
        }}
      />
      <Tabs.Screen
        name="notifications"
        options={{
          ...tabHeader(t, 'Notificações'),
          tabBarAccessibilityLabel: notificationsLabel(unread),
          tabBarIcon: NotificationsTabIcon,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          tabBarAccessibilityLabel: 'Perfil',
          tabBarIcon: tabIcon('person', 'person-outline'),
        }}
      />
    </Tabs>
  );
}
