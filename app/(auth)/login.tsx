import { useState } from 'react';
import { View } from 'react-native';

import { OtpCodeForm } from '../../components/auth/OtpCodeForm';
import { Button, Heading, Logo, Screen, Text, TextField } from '../../components/ui';
import { authErrorMessage, sendOtp, signInWithPassword, verifyOtp } from '../../lib/api/auth';
import { clearPasswordReset, markPasswordReset } from '../../lib/auth/passwordReset';
import { useTheme } from '../../lib/theme';

/**
 * password: email + senha (padrão) · email: pedir código do "esqueci a senha" · code: digitar o código.
 * Conta nova não nasce aqui: só pelo link de convite (app/(auth)/convite).
 */
type Step = 'password' | 'email' | 'code';

export default function LoginScreen() {
  const t = useTheme();
  const [step, setStep] = useState<Step>('password');
  const [email, setEmail] = useState('');
  const [password, setPasswordText] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const normalizedEmail = () => email.trim().toLowerCase();

  async function run(action: () => Promise<void>) {
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

  function onSignIn() {
    if (!normalizedEmail().includes('@')) return setError('Informe um email válido.');
    if (!password) return setError('Digite sua senha.');
    // a sessão nova chega pelo SessionProvider e o guard redireciona
    return run(async () => {
      await signInWithPassword(normalizedEmail(), password);
    });
  }

  function openCodeFlow() {
    setStep('email');
    setCode('');
    setError(null);
  }

  function onSendCode() {
    const trimmed = normalizedEmail();
    if (!trimmed.includes('@')) return setError('Informe um email válido.');
    return run(async () => {
      await sendOtp(trimmed, { createUser: false });
      setEmail(trimmed);
      setStep('code');
    });
  }

  function onVerify() {
    if (!/^\d{6}$/.test(code)) return setError('O código tem 6 dígitos.');
    return run(async () => {
      // marca antes da sessão chegar: o guard já manda direto para "Senha nova"
      markPasswordReset();
      try {
        await verifyOtp(email, code);
      } catch (e) {
        // código errado: não deixa a marca ligada (senão um login com senha depois cairia em "Senha nova")
        clearPasswordReset();
        throw e;
      }
    });
  }

  function backToPassword() {
    setStep('password');
    setCode('');
    setError(null);
  }

  const title = step === 'password' ? 'Só entra quem foi chamado.' : step === 'email' ? 'Esqueceu a senha?' : 'Olha o seu email.';

  return (
    <Screen scroll style={{ paddingTop: t.spacing.xxxl, gap: t.spacing.xl }}>
      <Logo height={t.layout.logoHeight.lg} />
      <View style={{ gap: t.spacing.md }}>
        <Heading level={1}>{title}</Heading>
        <Text tone="muted">
          {step === 'password' ? (
            'Entra com seu email e sua senha.'
          ) : step === 'email' ? (
            'A gente manda um código de 6 dígitos pro seu email e você cria uma senha nova.'
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

      {step === 'password' ? (
        <View style={{ gap: t.spacing.lg }}>
          <TextField
            label="Email"
            placeholder="seu@email.com"
            autoCapitalize="none"
            autoComplete="email"
            autoCorrect={false}
            textContentType="emailAddress"
            keyboardType="email-address"
            editable={!busy}
            value={email}
            onChangeText={setEmail}
          />
          <View style={{ gap: t.spacing.xs }}>
            <TextField
              label="Senha"
              placeholder="Sua senha"
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoComplete="current-password"
              textContentType="password"
              returnKeyType="go"
              editable={!busy}
              value={password}
              onChangeText={setPasswordText}
              onSubmitEditing={onSignIn}
              error={error ?? undefined}
            />
            <Button
              title={showPassword ? 'Esconder senha' : 'Mostrar senha'}
              variant="ghost"
              onPress={() => setShowPassword((v) => !v)}
            />
          </View>
          <Button title="Entrar" onPress={onSignIn} loading={busy} fullWidth />
          <View style={{ gap: t.spacing.xs }}>
            <Button title="Esqueci a senha" variant="ghost" onPress={openCodeFlow} disabled={busy} fullWidth />
          </View>
          <Text variant="small" tone="muted" align="center">
            Ainda não tem conta? Pede um link de convite pra quem te chamou.
          </Text>
        </View>
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
            onSubmitEditing={onSendCode}
            error={error ?? undefined}
            help="O email da sua conta."
          />
          <Button title="Enviar código" onPress={onSendCode} loading={busy} fullWidth />
          <Button title="Voltar pro login" variant="ghost" onPress={backToPassword} disabled={busy} fullWidth />
        </View>
      ) : (
        <OtpCodeForm
          code={code}
          onChangeCode={setCode}
          onVerify={onVerify}
          busy={busy}
          error={error}
          secondary={{ title: 'Voltar e usar outro email', onPress: openCodeFlow }}
        />
      )}
    </Screen>
  );
}
