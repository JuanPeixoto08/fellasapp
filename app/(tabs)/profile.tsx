import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { View } from 'react-native';

import ProfileView from '../../components/ProfileView';
import { Button } from '../../components/ui';
import { getCurrentUserId } from '../../lib/api/profiles';
import { useSession } from '../../lib/auth/SessionProvider';
import { useTheme } from '../../lib/theme';

export default function ProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const { signOut } = useSession();
  const [userId, setUserId] = useState<string | null>(null);
  const [version, setVersion] = useState(0);

  useFocusEffect(
    useCallback(() => {
      getCurrentUserId()
        .then(setUserId)
        .catch(() => setUserId(null));
      setVersion((v) => v + 1); // recarrega após editar
    }, []),
  );

  if (!userId) return <View style={{ flex: 1, backgroundColor: t.colors.bg }} />;

  return (
    <ProfileView
      key={version}
      userId={userId}
      actions={
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: t.spacing.sm }}>
          <Button title="Editar perfil" variant="secondary" onPress={() => router.push('/profile/edit')} />
          <Button title="Membros" variant="secondary" onPress={() => router.push('/members')} />
          <Button title="Sair" variant="ghost" onPress={() => void signOut()} />
        </View>
      }
    />
  );
}
