import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import { OtpCodeForm } from '../../../components/auth/OtpCodeForm';
import { Button, Heading, Logo, Screen, Text, TextField } from '../../../components/ui';
import { authErrorMessage, sendOtp, verifyOtp } from '../../../lib/api/auth';
import { inviteErrorMessage, isDeadInvite, redeemInvite } from '../../../lib/api/invites';
import { useTheme } from '../../../lib/theme';

/**
 * Quem recebeu o link de convite: põe o email (gasta o convite), recebe o código e entra. A conta nasce
 * membro e sem senha, então o guard leva direto para "Crie sua senha".
 */
export default function InviteLandingScreen() {
  const t = useTheme();
  const router = useRouter();
  const { token } = useLocalSearchParams<{ token: string }>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [dead, setDead] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSendCode() {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      let saved: string;
      try {
        saved = await redeemInvite(String(token ?? ''), email);
      } catch (e) {
        if (isDeadInvite(e)) setDead(inviteErrorMessage(e));
        else setError(inviteErrorMessage(e));
        return;
      }
      await sendOtp(saved, { createUser: true });
      setEmail(saved);
      setStep('code');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onVerify() {
    if (!/^\d{6}$/.test(code)) return setError('O código tem 6 dígitos.');
    // a sessão nova chega pelo SessionProvider e o guard leva pra criar a senha
    return run(() => verifyOtp(email, code));
  }

  const title = dead ? 'Esse convite não vale mais.' : step === 'email' ? 'Você foi chamado pro fellas.' : 'Olha o seu email.';

  return (
    <Screen scroll style={{ paddingTop: t.spacing.xxxl, gap: t.spacing.xl }}>
      <Logo height={t.layout.logoHeight.lg} />
      <View style={{ gap: t.spacing.md }}>
        <Heading level={1}>{title}</Heading>
        <Text tone="muted">
          {dead ? (
            dead
          ) : step === 'email' ? (
            'Põe seu email e a gente manda um código de 6 dígitos. Depois você cria sua senha.'
          ) : (
            <>
              Mandamos um código de 6 dígitos para{' '}
              <Text highlight bold>
                {email}
              </Text>
              . Pode levar um minutinho.
            </>
          )}
        </Text>
      </View>

      {dead ? (
        <Button title="Já tenho conta: entrar" variant="secondary" onPress={() => router.replace('/login')} fullWidth />
      ) : step === 'email' ? (
        <View style={{ gap: t.spacing.lg }}>
          <TextField
            label="Email"
            placeholder="seu@email.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            textContentType="emailAddress"
            keyboardType="email-address"
            returnKeyType="send"
            editable={!busy}
            value={email}
            onChangeText={setEmail}
            onSubmitEditing={() => void onSendCode()}
            error={error ?? undefined}
            help="O convite fica com esse email. Confere antes de mandar."
          />
          <Button title="Receber código" onPress={() => void onSendCode()} loading={busy} fullWidth />
        </View>
      ) : (
        <OtpCodeForm
          code={code}
          onChangeCode={setCode}
          onVerify={onVerify}
          busy={busy}
          error={error}
          secondary={{ title: 'Mandar o código de novo', onPress: () => void run(() => sendOtp(email, { createUser: true })) }}
        />
      )}
    </Screen>
  );
}
