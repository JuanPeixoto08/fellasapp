import * as ImagePicker from 'expo-image-picker';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, View } from 'react-native';
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
import { resolveUrl, signPaths } from '../../lib/api/storage';
import { getUserInfo, hasLastfmKey, LastfmError } from '../../lib/lastfm/api';
import { isValidLastfmUser } from '../../lib/lastfm/map';
import { friendlyError, isUniqueViolation } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { gifProblem, isGif } from '../../lib/profileImage';

const BIRTHDAY_ERROR = 'Essa data não rola. Usa DD/MM/AAAA, tipo 20/05/1999.';

export default function EditProfileScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signOut, refreshProfile } = useSession();
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [status, setStatus] = useState('');
  const [location, setLocation] = useState('');
  const [birthday, setBirthday] = useState('');
  const [birthdayError, setBirthdayError] = useState<string | undefined>();
  /** Foto nova escolhida (vai pro upload ao salvar). */
  const [avatarUri, setAvatarUri] = useState<string | undefined>();
  /** Foto que já está salva: só para mostrar (salvar sem trocar não reenvia). */
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null);
  /** Banner novo (já recortado), o salvo (só para mostrar) e se a pessoa mandou tirar. */
  const [bannerUri, setBannerUri] = useState<string | undefined>();
  const [currentBanner, setCurrentBanner] = useState<string | null>(null);
  const [removeBanner, setRemoveBanner] = useState(false);
  /** Foto escolhida esperando o "Ajustar foto" (círculo da foto de perfil ou retângulo do banner). */
  const [crop, setCrop] = useState<{ uri: string; shape: 'circle' | 'banner' } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [usernameError, setUsernameError] = useState<string | undefined>();
  const [lastfm, setLastfm] = useState('');
  /** O que está salvo: igual a isso, não pergunta de novo ao Last.fm. */
  const [savedLastfm, setSavedLastfm] = useState('');
  const [lastfmError, setLastfmError] = useState<string | undefined>();
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
        setLastfm(p.lastfm_user ?? '');
        setSavedLastfm(p.lastfm_user ?? '');
        // foto e banner são extras: se a assinatura falhar, a tela continua com a letra e a faixa lisa
        signPaths([p.avatar_url, p.banner_url])
          .then((signed) => {
            setCurrentAvatar(resolveUrl(p.avatar_url, signed));
            setCurrentBanner(resolveUrl(p.banner_url, signed));
          })
          .catch(() => {});
      })
      .catch((e) => setError(friendlyError(e, 'Não deu pra carregar seu perfil. Volta e tenta de novo.')));
  }, []);

  async function pick(shape: 'circle' | 'banner') {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      // sem recorte do sistema e sem compressão: o AvatarCropper enquadra (círculo ou banner) e salva em JPEG
      quality: 1,
    });
    if (res.canceled) return;
    const asset = res.assets[0];
    // GIF na foto de perfil sobe como está: o ajuste salva em JPEG e a animação se perderia
    if (shape === 'circle' && isGif(asset)) {
      const problem = gifProblem(asset);
      if (problem) return setError(problem);
      setError(null);
      setAvatarUri(asset.uri);
      return;
    }
    setCrop({ uri: asset.uri, shape });
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
    setLastfmError(undefined);
    const lastfmUser = lastfm.trim();
    if (lastfmUser && lastfmUser !== savedLastfm) {
      if (!isValidLastfmUser(lastfmUser)) {
        setSaving(false);
        return setLastfmError('Usuário do Last.fm inválido.');
      }
      if (hasLastfmKey()) {
        try {
          await getUserInfo(lastfmUser);
        } catch (e) {
          setSaving(false);
          return setLastfmError(
            e instanceof LastfmError && e.kind === 'not_found'
              ? 'Não achamos esse usuário no Last.fm.'
              : 'Não deu pra conferir no Last.fm agora. Tenta de novo.',
          );
        }
      }
    }
    try {
      await updateMyProfile({
        display_name: displayName,
        username,
        bio,
        avatarUri,
        bannerUri,
        removeBanner,
        status,
        location,
        birthday: parsedBirthday,
        lastfmUser,
      });
      // a cópia do perfil na sessão alimenta minha foto na lateral, no compositor e no comentário
      await refreshProfile();
      router.back();
    } catch (e) {
      if (isUniqueViolation(e)) setUsernameError('Esse usuário já é de outro fella. Escolhe outro.');
      else setError(friendlyError(e, 'Não rolou salvar. Tenta de novo.'));
    } finally {
      setSaving(false);
    }
  }

  const shownBanner = removeBanner ? null : (bannerUri ?? currentBanner);
  const bannerBox = {
    width: '100%' as const,
    aspectRatio: t.layout.bannerAspect,
    borderRadius: t.radii.md,
    backgroundColor: t.colors.surfaceSunken,
  };

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Editar perfil')} />
      <AvatarCropper
        uri={crop?.uri ?? null}
        shape={crop?.shape}
        onCancel={() => setCrop(null)}
        onConfirm={(uri) => {
          if (crop?.shape === 'banner') {
            setBannerUri(uri);
            setRemoveBanner(false);
          } else {
            setAvatarUri(uri);
          }
          setCrop(null);
        }}
      />
      <Screen scroll header style={{ paddingBottom: t.spacing.xl + insets.bottom }}>
        <View style={{ gap: t.spacing.sm }}>
          <Text variant="small" bold>
            Banner
          </Text>
          {shownBanner ? (
            <Image accessibilityLabel="Seu banner" source={{ uri: shownBanner }} style={bannerBox} />
          ) : (
            <View style={bannerBox} />
          )}
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            <Button
              title={shownBanner ? 'Trocar banner' : 'Escolher banner'}
              variant="secondary"
              onPress={() => void pick('banner')}
            />
            {shownBanner ? (
              <Button
                title="Tirar banner"
                variant="ghost"
                onPress={() => {
                  setBannerUri(undefined);
                  setRemoveBanner(true);
                }}
              />
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: 'center', gap: t.spacing.md }}>
          <Avatar name={displayName || username || '?'} uri={avatarUri ?? currentAvatar} size={t.avatarSizes.xl} />
          <Button
            title={avatarUri || currentAvatar ? 'Trocar foto' : 'Escolher foto'}
            variant="secondary"
            onPress={() => void pick('circle')}
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
          label="Usuário no Last.fm"
          placeholder="seu_usuario"
          help="Pra mostrar o que você ouve no seu perfil."
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={15}
          value={lastfm}
          onChangeText={(v) => {
            setLastfm(v);
            if (lastfmError) setLastfmError(undefined);
          }}
          error={lastfmError}
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
