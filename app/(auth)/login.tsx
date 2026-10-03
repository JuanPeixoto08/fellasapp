import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { authErrorMessage, sendOtp, verifyOtp } from '../../lib/api/auth';

export default function LoginScreen() {
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

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Bem-vindo</Text>
      {step === 'email' ? (
        <>
          <Text style={styles.text}>Digite seu email para receber um código de acesso.</Text>
          <TextInput
            style={styles.input}
            placeholder="seu@email.com"
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />
          <Pressable accessibilityRole="button" style={styles.button} onPress={onSendCode} disabled={busy}>
            <Text style={styles.buttonText}>Enviar código</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={styles.text}>Enviamos um código de 6 dígitos para {email}.</Text>
          <TextInput
            style={styles.input}
            placeholder="000000"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
          />
          <Pressable accessibilityRole="button" style={styles.button} onPress={onVerify} disabled={busy}>
            <Text style={styles.buttonText}>Entrar</Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setStep('email');
              setCode('');
              setError(null);
            }}
          >
            <Text style={styles.link}>Usar outro email</Text>
          </Pressable>
        </>
      )}
      {busy ? <ActivityIndicator /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 12 },
  title: { fontSize: 24, fontWeight: '700' },
  text: { fontSize: 15, textAlign: 'center', color: '#555' },
  input: { width: '100%', maxWidth: 360, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16 },
  button: { backgroundColor: '#111', paddingVertical: 12, paddingHorizontal: 32, borderRadius: 8 },
  buttonText: { color: '#fff', fontWeight: '600' },
  link: { color: '#0a58ca' },
  error: { color: '#c00', textAlign: 'center' },
});
