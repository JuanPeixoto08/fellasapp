import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Button, View } from 'react-native';

import ProfileView from '../../components/ProfileView';
import { getCurrentUserId } from '../../lib/api/profiles';
import { supabase } from '../../lib/supabase';

export default function ProfileScreen() {
  const router = useRouter();
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

  if (!userId) return <View style={{ flex: 1 }} />;

  return (
    <ProfileView
      key={version}
      userId={userId}
      actions={
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Button title="Editar" onPress={() => router.push('/profile/edit')} />
          <Button title="Membros" onPress={() => router.push('/members')} />
          <Button title="Sair" onPress={() => supabase.auth.signOut()} />
        </View>
      }
    />
  );
}
