import { Redirect, Stack, useLocalSearchParams } from 'expo-router';

import ProfileView from '../../components/ProfileView';
import { stackHeader } from '../../components/profile/headerOptions';
import { useSession } from '../../lib/auth/SessionProvider';
import { useTheme } from '../../lib/theme';

export default function UserProfileScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const me = useSession().session?.user.id;
  // o meu perfil mora na aba Perfil (com editar, membros…), venha de onde vier o link
  if (id === me) return <Redirect href="/profile" />;
  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Perfil')} />
      <ProfileView userId={id} header />
    </>
  );
}
