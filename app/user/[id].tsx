import { Stack, useLocalSearchParams } from 'expo-router';

import ProfileView from '../../components/ProfileView';
import { stackHeader } from '../../components/profile/headerOptions';
import { useTheme } from '../../lib/theme';

export default function UserProfileScreen() {
  const t = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Perfil')} />
      <ProfileView userId={id} header />
    </>
  );
}
