import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { stackHeader } from '../../components/profile/headerOptions';
import { Avatar, Button, Screen, Text, TextField } from '../../components/ui';
import {
  getCurrentUserId,
  formatBirthday,
  getProfile,
  parseBirthday,
  updateMyProfile,
  validateUsername,
} from '../../lib/api/profiles';
import { isProfileColorKey, profileColor, profileColorKeys, profilePalette, useTheme } from '../../lib/theme';

export default function EditProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayError, setBirthdayError] = useState<string | undefined>();
  const [accent, setAccent] = useState<string | null>(null);
  const [userId, setUserId] = useState('');
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUserId()
      .then((id) => {
        setUserId(id);
        return getProfile(id);
      })
      .then((p) => {
        setStatus(p.status ?? '');
        setLocation(p.location ?? '');
        setBirthday(formatBirthday(p.birthday));
        setAccent(isProfileColorKey(p.accent_color) ? p.accent_color : null);
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
    const parsedBirthday = parseBirthday(birthday);
    if (parsedBirthday === undefined) return setBirthdayError('Use o formato DD/MM/AAAA com uma data válida');
    setSaving(true);
    setError(null);
    setBirthdayError(undefined);
    setUsernameError(undefined);
    try {
      await updateMyProfile({
        display_name: displayName,
        username,
        bio,
        avatarUri,
        status,
        location,
        birthday: parsedBirthday,
        accent_color: accent,
      });
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
        <TextField
          label="Status"
          placeholder="🎧 ouvindo pagode"
          help="Uma frase curta, até 80 caracteres"
          maxLength={80}
          value={status}
          onChangeText={setStatus}
        />
        <TextField
          label="Cidade"
          placeholder="Onde você está"
          maxLength={60}
          value={location}
          onChangeText={setLocation}
        />
        <TextField
          label="Aniversário"
          placeholder="DD/MM/AAAA"
          keyboardType="numbers-and-punctuation"
          error={birthdayError}
          maxLength={10}
          value={birthday}
          onChangeText={(v) => {
            setBirthday(v);
            setBirthdayError(undefined);
          }}
        />
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="small" bold>
            Cor do perfil
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.md }}>
            {profileColorKeys.map((key) => {
              const selected = (accent ?? profileColor(userId).key) === key;
              return (
                <Pressable
                  key={key}
                  accessibilityRole="radio"
                  accessibilityLabel={`Cor ${key}`}
                  accessibilityState={{ selected }}
                  onPress={() => setAccent(key)}
                  style={{
                    width: t.layout.minTouch,
                    height: t.layout.minTouch,
                    borderRadius: t.radii.pill,
                    backgroundColor: profilePalette[key].bg,
                    borderWidth: selected ? 3 : 0,
                    borderColor: t.colors.text,
                  }}
                />
              );
            })}
          </View>
        </View>
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
