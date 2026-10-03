import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, Image, ScrollView, StyleSheet, Text, TextInput } from 'react-native';

import {
  getCurrentUserId,
  getProfile,
  updateMyProfile,
  validateUsername,
} from '../../lib/api/profiles';

export default function EditProfileScreen() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
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
    if (invalid) return setError(invalid);
    setSaving(true);
    setError(null);
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
    <ScrollView contentContainerStyle={styles.container}>
      {avatarUri ? <Image source={{ uri: avatarUri }} style={styles.avatar} /> : null}
      <Button title="Escolher foto" onPress={pickAvatar} />
      <TextInput
        style={styles.input}
        placeholder="Nome"
        value={displayName}
        onChangeText={setDisplayName}
      />
      <TextInput
        style={styles.input}
        placeholder="username"
        autoCapitalize="none"
        autoCorrect={false}
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={[styles.input, { height: 80 }]}
        placeholder="Bio"
        multiline
        value={bio}
        onChangeText={setBio}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Button title={saving ? 'Salvando...' : 'Salvar'} onPress={save} disabled={saving} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 12 },
  avatar: { width: 96, height: 96, borderRadius: 48, alignSelf: 'center' },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 10 },
  error: { color: 'crimson' },
});
