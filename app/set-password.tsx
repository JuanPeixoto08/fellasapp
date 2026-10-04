import { useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Heading, Logo, Screen, Text, TextField } from '../components/ui';
import { authErrorMessage, setPassword, signOut } from '../lib/api/auth';
import { clearPasswordReset, usePasswordResetPending } from '../lib/auth/passwordReset';
import { useTheme } from '../lib/theme';

const MIN_LENGTH = 8;

/**
 * Senha obrigatória: depois do primeiro acesso (código por email) ou do "esqueci a senha". O guard
 * segura a pessoa aqui até salvar.
 */
export default function SetPasswordScreen() {
  const t = useTheme();
  const router = useRouter();
  const resetting = usePasswordResetPending();
  const [password, setPasswordText] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSave() {
    if (password.length < MIN_LENGTH) return setError(`A senha precisa ter pelo menos ${MIN_LENGTH} caracteres.`);
    if (password !== confirm) return setError('As senhas não batem.');
    setBusy(true);
    setError(null);
    try {
      await setPassword(password);
      clearPasswordReset();
      router.replace('/feed');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onSignOut() {
    // desistiu de trocar: a senha antiga continua valendo; a sessão nova chega nula e o guard leva pro login
    clearPasswordReset();
    try {
      await signOut();
    } catch (e) {
      setError(authErrorMessage(e));
    }
  }

  return (
    <Screen scroll style={{ paddingTop: t.spacing.xxxl, gap: t.spacing.xl }}>
      <Logo height={t.layout.logoHeight.lg} />
      <View style={{ gap: t.spacing.md }}>
        <Heading level={1}>{resetting ? 'Senha nova' : 'Cria sua senha'}</Heading>
        <Text tone="muted">
          {resetting
            ? 'Escolhe uma senha nova. Ela passa a valer na hora.'
            : 'Daqui pra frente você entra com email e senha. O código por email fica só pra quando esquecer.'}
        </Text>
      </View>
      <View style={{ gap: t.spacing.lg }}>
        <TextField
          label="Senha"
          placeholder={`Pelo menos ${MIN_LENGTH} caracteres`}
          secureTextEntry={!show}
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!busy}
          value={password}
          onChangeText={setPasswordText}
        />
        <View style={{ gap: t.spacing.xs }}>
          <TextField
            label="Confirma a senha"
            placeholder="Digita de novo"
            secureTextEntry={!show}
            autoCapitalize="none"
            autoComplete="new-password"
            textContentType="newPassword"
            returnKeyType="done"
            editable={!busy}
            value={confirm}
            onChangeText={setConfirm}
            onSubmitEditing={onSave}
            error={error ?? undefined}
          />
          <Button title={show ? 'Esconder senha' : 'Mostrar senha'} variant="ghost" onPress={() => setShow((v) => !v)} />
        </View>
        <Button title="Salvar senha" onPress={onSave} loading={busy} fullWidth />
        <Button title="Sair" variant="ghost" onPress={onSignOut} disabled={busy} fullWidth />
      </View>
    </Screen>
  );
}
