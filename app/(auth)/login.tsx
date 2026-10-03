import { useState } from 'react';
import { View } from 'react-native';

import { Button, Heading, Logo, Screen, Text, TextField } from '../../components/ui';
import { authErrorMessage, sendOtp, verifyOtp } from '../../lib/api/auth';
import { useTheme } from '../../lib/theme';

export default function LoginScreen() {
  const t = useTheme();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSendCode() {
    const trimmed = email.trim().toLowerCase();
    if (!trimmed.includes('@')) {
      setError('Informe um email válido.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await sendOtp(trimmed);
      setEmail(trimmed);
      setStep('code');
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  async function onVerify() {
    if (!/^\d{6}$/.test(code)) {
      setError('O código tem 6 dígitos.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await verifyOtp(email, code);
      // O SessionProvider detecta a sessão e o guard redireciona.
    } catch (e) {
      setError(authErrorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  function onChangeEmail() {
    setStep('email');
    setCode('');
    setError(null);
  }

  return (
    <Screen scroll style={{ paddingTop: t.spacing.xxxl, gap: t.spacing.xl }}>
      <Logo height={t.layout.logoHeight.lg} />
      <View style={{ gap: t.spacing.md }}>
        <Heading level={1}>{step === 'email' ? 'Só entra quem foi chamado.' : 'Olha o seu email.'}</Heading>
        <Text tone="muted">
          {step === 'email' ? (
            'Põe seu email e a gente manda um código de 6 dígitos. Sem senha pra decorar.'
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
      {step === 'email' ? (
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
            onSubmitEditing={onSendCode}
            error={error ?? undefined}
            help="Só funciona com o email que o grupo liberou."
          />
          <Button title="Enviar código" onPress={onSendCode} loading={busy} fullWidth />
        </View>
      ) : (
        <View style={{ gap: t.spacing.lg }}>
          <TextField
            label="Código de 6 dígitos"
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            editable={!busy}
            value={code}
            onChangeText={(c) => setCode(c.replace(/\D/g, ''))}
            onSubmitEditing={onVerify}
            error={error ?? undefined}
            help="Não chegou? Olha o spam ou volta e manda de novo."
          />
          <Button title="Entrar" onPress={onVerify} loading={busy} fullWidth />
          <Button title="Voltar e usar outro email" variant="ghost" onPress={onChangeEmail} disabled={busy} fullWidth />
        </View>
      )}
    </Screen>
  );
}
