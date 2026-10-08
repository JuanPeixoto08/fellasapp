import { useLocalSearchParams, useRouter } from 'expo-router';
import { View } from 'react-native';

import ProfileView from '../../components/ProfileView';
import { IconButton } from '../../components/ui';
import { useSession } from '../../lib/auth/SessionProvider';
import { parseProfileTab } from '../../lib/profileTab';
import { useTheme } from '../../lib/theme';

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { session, profile } = useSession();
  const userId = session?.user.id;
  const { aba } = useLocalSearchParams<{ aba?: string }>();

  if (!userId) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;

  return (
    <ProfileView
      userId={userId}
      initialTab={parseProfileTab(aba)}
      actions={
        <>
          {profile?.is_admin ? (
            <IconButton icon="person-add-outline" accessibilityLabel="Convidar" onPress={() => router.push('/invites')} />
          ) : null}
          <IconButton icon="people-outline" accessibilityLabel="Membros" onPress={() => router.push('/members')} />
          <IconButton icon="create-outline" accessibilityLabel="Editar perfil" onPress={() => router.push('/profile/edit')} />
        </>
      }
    />
  );
}
