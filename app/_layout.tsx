import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="(auth)/login" />
        <Stack.Screen name="profile/edit" options={{ headerShown: true, title: 'Editar perfil' }} />
        <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'Perfil' }} />
        <Stack.Screen name="members" options={{ headerShown: true, title: 'Membros' }} />
      </Stack>
    </>
  );
}
