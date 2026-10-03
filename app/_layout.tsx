import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import { AuthGuard } from '../lib/auth/AuthGuard';
import { SessionProvider } from '../lib/auth/SessionProvider';

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="auto" />
      <AuthGuard>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(auth)/login" />
          <Stack.Screen name="not-invited" />
        </Stack>
      </AuthGuard>
    </SessionProvider>
  );
}
