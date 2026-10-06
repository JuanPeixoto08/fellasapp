import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Button, TextField } from '../ui';

type Props = {
  code: string;
  onChangeCode: (code: string) => void;
  onVerify: () => void;
  busy: boolean;
  error?: string | null;
  /** Ação de baixo (voltar, mandar de novo…). */
  secondary: { title: string; onPress: () => void };
};

/** Passo "digita o código de 6 dígitos" do login e do convite. */
export function OtpCodeForm({ code, onChangeCode, onVerify, busy, error, secondary }: Props) {
  const t = useTheme();
  return (
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
        onChangeText={(c) => onChangeCode(c.replace(/\D/g, ''))}
        onSubmitEditing={onVerify}
        error={error ?? undefined}
        help="Não chegou? Olha o spam ou volta e manda de novo."
      />
      <Button title="Entrar" onPress={onVerify} loading={busy} fullWidth />
      <Button title={secondary.title} variant="ghost" onPress={secondary.onPress} disabled={busy} fullWidth />
    </View>
  );
}
