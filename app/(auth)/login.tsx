import { useState } from 'react';
import { View } from 'react-native';

import { Button, Heading, Logo, Screen, Text, TextField } from '../../components/ui';
import { authErrorMessage, sendOtp, signInWithPassword, verifyOtp } from '../../lib/api/auth';
import { clearPasswordReset, markPasswordReset } from '../../lib/auth/passwordReset';
import { useTheme } from '../../lib/theme';

/** password: email + senha (padrão) · email: pedir código · code: digitar o código. */
type Step = 'password' | 'email' | 'code';
/** Por que o código foi pedido: primeiro acesso (pode criar conta) ou "esqueci a senha". */
type Purpose = 'first' | 'forgot';

const COPY: Record<Purpose, { title: string; text: string }> = {
  first: {
    title: 'Primeiro acesso',
    text: 'Põe seu email e a gente manda um código de 6 dígitos. Depois você cria sua senha.',
  },
  forgot: {
    title: 'Esqueceu a senha?',
    text: 'A gente manda um código de 6 dígitos pro seu email e você cria uma senha nova.',
  },
};

export default function LoginScreen() {
  const t = useTheme();
  const [step, setStep] = useState<Step>('password');
  const [purpose, setPurpose] = useState<Purpose>('first');
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

  function openCodeFlow(next: Purpose) {
    setPurpose(next);
    setStep('email');
    setCode('');
    setError(null);
  }

  function onSendCode() {
    const trimmed = normalizedEmail();
    if (!trimmed.includes('@')) return setError('Informe um email válido.');
    return run(async () => {
      await sendOtp(trimmed, { createUser: purpose === 'first' });
      setEmail(trimmed);
      setStep('code');
    });
  }

  function onVerify() {
    if (!/^\d{6}$/.test(code)) return setError('O código tem 6 dígitos.');
    return run(async () => {
      // marca antes da sessão chegar: o guard já manda direto para "Senha nova"
      if (purpose === 'forgot') markPasswordReset();
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

  const title = step === 'password' ? 'Só entra quem foi chamado.' : step === 'email' ? COPY[purpose].title : 'Olha o seu email.';

  return (
    <Screen scroll style={{ paddingTop: t.spacing.xxxl, gap: t.spacing.xl }}>
      <Logo height={t.layout.logoHeight.lg} />
      <View style={{ gap: t.spacing.md }}>
        <Heading level={1}>{title}</Heading>
        <Text tone="muted">
          {step === 'password' ? (
            'Entra com seu email e sua senha.'
          ) : step === 'email' ? (
            COPY[purpose].text
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
            <Button title="Primeiro acesso? Receber código" variant="ghost" onPress={() => openCodeFlow('first')} disabled={busy} fullWidth />
            <Button title="Esqueci a senha" variant="ghost" onPress={() => openCodeFlow('forgot')} disabled={busy} fullWidth />
          </View>
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
            help="Só funciona com o email que o grupo liberou."
          />
          <Button title="Enviar código" onPress={onSendCode} loading={busy} fullWidth />
          <Button title="Voltar pro login" variant="ghost" onPress={backToPassword} disabled={busy} fullWidth />
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
          <Button title="Voltar e usar outro email" variant="ghost" onPress={() => openCodeFlow(purpose)} disabled={busy} fullWidth />
        </View>
      )}
    </Screen>
  );
}
