import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AvatarCropper } from '../../components/profile/AvatarCropper';
import { stackHeader } from '../../components/profile/headerOptions';
import { Avatar, Button, Divider, Screen, Text, TextField } from '../../components/ui';
import { useSession } from '../../lib/auth/SessionProvider';
import {
  getCurrentUserId,
  formatBirthday,
  getProfile,
  maskBirthday,
  PROFILE_LIMITS,
  parseBirthday,
  updateMyProfile,
  validateUsername,
} from '../../lib/api/profiles';
import { friendlyError, isUniqueViolation } from '../../lib/errors';
import { useTheme } from '../../lib/theme';

const BIRTHDAY_ERROR = 'Essa data não rola. Usa DD/MM/AAAA, tipo 20/05/1999.';

export default function EditProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayError, setBirthdayError] = useState<string | undefined>();
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  /** Foto escolhida esperando o "Ajustar foto". */
  const [cropUri, setCropUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getCurrentUserId()
      .then(getProfile)
      .then((p) => {
        setStatus(p.status ?? '');
        setLocation(p.location ?? '');
        setBirthday(formatBirthday(p.birthday));
        setDisplayName(p.display_name ?? '');
        setUsername(p.username);
        setBio(p.bio ?? '');
      })
      .catch((e) => setError(friendlyError(e, 'Não deu pra carregar seu perfil. Volta e tenta de novo.')));
  }, []);

  async function pickAvatar() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // sem recorte do sistema e sem compressão: o AvatarCropper enquadra e salva 512 em JPEG
      quality: 1,
    });
    if (!res.canceled) setCropUri(res.assets[0].uri);
  }

  async function save() {
    const invalid = validateUsername(username.trim().toLowerCase());
    if (invalid) return setUsernameError(invalid);
    const parsedBirthday = parseBirthday(birthday);
    if (parsedBirthday === undefined) return setBirthdayError(BIRTHDAY_ERROR);
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
      });
      router.back();
    } catch (e) {
      if (isUniqueViolation(e)) setUsernameError('Esse usuário já é de outro fella. Escolhe outro.');
      else setError(friendlyError(e, 'Não rolou salvar. Tenta de novo.'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Editar perfil')} />
      <AvatarCropper
        uri={cropUri}
        onCancel={() => setCropUri(null)}
        onConfirm={(uri) => {
          setAvatarUri(uri);
          setCropUri(null);
        }}
      />
      <Screen scroll header style={{ paddingBottom: t.spacing.xl + insets.bottom }}>
        <View style={{ alignItems: 'center', gap: t.spacing.md }}>
          <Avatar name={displayName || username || '?'} uri={avatarUri} size={t.avatarSizes.xl} />
          <Button
            title={avatarUri ? 'Trocar foto' : 'Escolher foto'}
            variant="secondary"
            onPress={pickAvatar}
          />
        </View>
        <TextField
          label="Nome"
          placeholder="Como a galera te chama"
          maxLength={PROFILE_LIMITS.displayName}
          value={displayName}
          onChangeText={setDisplayName}
        />
        <TextField
          label="Usuário"
          placeholder="seu_usuario"
          error={usernameError}
          help="3 a 30 caracteres: letras minúsculas, números e _"
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
          maxLength={PROFILE_LIMITS.bio}
          help={`${bio.length}/${PROFILE_LIMITS.bio}`}
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
          keyboardType="number-pad"
          error={birthdayError}
          maxLength={10}
          value={birthday}
          onChangeText={(v) => {
            setBirthday(maskBirthday(v));
            setBirthdayError(undefined);
          }}
          onBlur={() => {
            if (parseBirthday(birthday) === undefined) setBirthdayError(BIRTHDAY_ERROR);
          }}
        />
        {error ? (
          <Text tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
        <Button title="Salvar" fullWidth loading={saving} onPress={save} />
        <Divider />
        <Button title="Sair da conta" variant="ghost" fullWidth onPress={() => void signOut()} disabled={saving} />
      </Screen>
    </>
  );
}
