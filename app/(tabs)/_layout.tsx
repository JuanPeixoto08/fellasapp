import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

function tabIcon(active: IconName, inactive: IconName) {
  return function TabIcon({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) {
    return <Ionicons name={focused ? active : inactive} size={size} color={color} />;
  };
}

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: t.colors.bg },
        tabBarActiveTintColor: t.colors.brand,
        tabBarInactiveTintColor: t.colors.textMuted,
        tabBarLabelStyle: { fontFamily: t.fonts.bodyMedium, fontSize: t.typography.caption.fontSize },
        tabBarStyle: {
          backgroundColor: t.colors.bg,
          borderTopColor: t.colors.border,
          borderTopWidth: 1,
          minHeight: t.layout.minTouch + t.spacing.sm + insets.bottom,
          paddingTop: t.spacing.xs,
          paddingBottom: Math.max(insets.bottom, t.spacing.xs),
          paddingHorizontal: insets.left,
        },
      }}
    >
      <Tabs.Screen
        name="feed"
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
