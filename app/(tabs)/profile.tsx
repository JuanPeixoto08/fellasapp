import { useRouter } from 'expo-router';
import { View } from 'react-native';

import ProfileView from '../../components/ProfileView';
import { IconButton } from '../../components/ui';
import { useSession } from '../../lib/auth/SessionProvider';
import { useTheme } from '../../lib/theme';

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const userId = useSession().session?.user.id;

  if (!userId) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;

  return (
    <ProfileView
      userId={userId}
      actions={
        <>
          <IconButton icon="people-outline" accessibilityLabel="Membros" onPress={() => router.push('/members')} />
          <IconButton icon="create-outline" accessibilityLabel="Editar perfil" onPress={() => router.push('/profile/edit')} />
        </>
      }
    />
  );
}
