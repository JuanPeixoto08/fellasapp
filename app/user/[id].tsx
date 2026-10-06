import { Redirect, Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';

import ProfileView from '../../components/ProfileView';
import { stackHeader } from '../../components/profile/headerOptions';
import type { Profile } from '../../lib/api/profiles';
import { useSession } from '../../lib/auth/SessionProvider';
import { useTheme } from '../../lib/theme';

export default function UserProfileScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession().session?.user.id;
  // título: "Perfil" enquanto carrega, depois o @ da pessoa
  const [username, setUsername] = useState<string | null>(null);
  const onLoaded = useCallback((p: Profile) => setUsername(p.username), []);
  // o meu perfil mora na aba Perfil (com editar, membros…), venha de onde vier o link
  if (id === me) return <Redirect href="/profile" />;
  return (
    <>
      <Stack.Screen options={stackHeader(t, username ? `@${username}` : 'Perfil')} />
      <ProfileView userId={id} header onLoaded={onLoaded} />
    </>
  );
}
