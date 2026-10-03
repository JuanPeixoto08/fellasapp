import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stackHeader } from '../../components/profile/headerOptions';
import { Avatar, Button, Screen, Text, TextField } from '../../components/ui';
import {
  getCurrentUserId,
  getProfile,
  updateMyProfile,
  validateUsername,
} from '../../lib/api/profiles';
import { useTheme } from '../../lib/theme';

export default function EditProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUserId()
      .then(getProfile)
      .then((p) => {
        setDisplayName(p.display_name ?? '');
        setUsername(p.username);
        setBio(p.bio ?? '');
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Erro ao carregar perfil'));
  }, []);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (!res.canceled) setAvatarUri(res.assets[0].uri);
  }

  async function save() {
    const invalid = validateUsername(username.trim().toLowerCase());
    if (invalid) return setUsernameError(invalid);
    setSaving(true);
    setError(null);
    setUsernameError(undefined);
    try {
      await updateMyProfile({ display_name: displayName, username, bio, avatarUri });
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Editar perfil')} />
      <Screen scroll style={{ paddingBottom: t.spacing.xl + insets.bottom }}>
        <View style={{ alignItems: 'center', gap: t.spacing.md }}>
          <Avatar name={displayName || username || '?'} uri={avatarUri} size={t.layout.minTouch * 2} />
          <Button
            title={avatarUri ? 'Trocar foto' : 'Escolher foto'}
            variant="secondary"
            onPress={pickAvatar}
          />
        </View>
        <TextField
          label="Nome"
          placeholder="Como a galera te chama"
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label="Usuário"
          placeholder="seu_usuario"
          error={usernameError}
          help="3 a 20 caracteres: letras minúsculas, números e _"
          autoCapitalize="none"
          autoCorrect={false}
          value={username}
          onChangeText={(v) => {
            setUsername(v);
            setUsernameError(undefined);
          }}
        />
        <TextField
          label="Bio"
          placeholder="Conta uma coisa sobre você"
          multiline
          value={bio}
          onChangeText={setBio}
        />
        {error ? (
          <Text tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button title="Salvar" fullWidth loading={saving} onPress={save} />
      </Screen>
    </>
  );
}
