import {
  GolosText_400Regular,
  GolosText_500Medium,
  GolosText_600SemiBold,
  GolosText_700Bold,
} from '@expo-google-fonts/golos-text';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

SplashScreen.preventAutoHideAsync().catch(() => {});
injectWebStyles();

import { NotificationsSync } from '../components/notifications/NotificationsSync';
import { EmojiPickerHost } from '../components/reactions/EmojiPickerHost';
import { MemberDirectorySync } from '../components/realtime/MemberDirectorySync';
import { RealtimeSync } from '../components/realtime/RealtimeSync';
import { AppShell } from '../components/shell/AppShell';
import { AuthGuard } from '../lib/auth/AuthGuard';
import { SessionProvider } from '../lib/auth/SessionProvider';
import { injectWebStyles } from '../lib/webStyles';

export default function RootLayout() {
  const [loaded, error] = useFonts({
    GolosText_400Regular,
    GolosText_500Medium,
    GolosText_600SemiBold,
    GolosText_700Bold,
  });
  const ready = loaded || !!error; // sem fonte custom o app ainda abre, com a fonte do sistema

  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);

  if (!ready) return null;

  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <NotificationsSync />
      <RealtimeSync />
      <MemberDirectorySync />
      <AuthGuard>
        <AppShell>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="(auth)/convite/[token]" />
            <Stack.Screen name="not-invited" />
            <Stack.Screen name="set-password" />
            <Stack.Screen name="profile/edit" options={{ headerShown: true, title: 'Editar perfil' }} />
            <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'Perfil' }} />
            <Stack.Screen name="members" options={{ headerShown: true, title: 'Membros' }} />
            <Stack.Screen name="invites" options={{ headerShown: true, title: 'Convidar' }} />
            <Stack.Screen name="ideas" options={{ headerShown: true, title: 'Ideias' }} />
            <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notificações' }} />
          </Stack>
        </AppShell>
        <EmojiPickerHost />
      </AuthGuard>
    </SessionProvider>
  );
}
