import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { friendlyError } from '../../lib/errors';
import { useTheme } from '../../lib/theme';
import { Button } from './Button';
import { Heading, Text } from './Text';

export type ConfirmDialogProps = {
  visible: boolean;
  title: string;
  message?: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Pode ser assíncrono: o botão fica carregando e um erro aparece dentro do diálogo. */
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
  /** Texto do erro quando `onConfirm` falha (rede tem mensagem própria). */
  errorMessage?: string;
};

/** Confirmação de ação destrutiva (ex.: apagar post). Funciona igual no app e na web. */
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel = 'Deixa quieto',
  onConfirm,
  onClose,
  errorMessage = 'Não rolou. Tenta de novo.',
}: ConfirmDialogProps) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (visible) setError(null);
  }, [visible]);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await onConfirm();
    } catch (e) {
      setError(friendlyError(e, errorMessage));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={busy ? undefined : onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: t.colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: t.layout.gutter,
        }}
      >
        <Pressable
          onPress={busy ? undefined : onClose}
          accessibilityRole="button"
          accessibilityLabel={cancelLabel}
          style={StyleSheet.absoluteFill}
        />
        <View
          accessibilityViewIsModal
          style={[
            {
              width: '100%',
              maxWidth: t.layout.maxDialogWidth,
              backgroundColor: t.colors.surface,
              borderRadius: t.radii.lg,
              borderWidth: t.borders.hairline,
              borderColor: t.colors.border,
              padding: t.spacing.xl,
              gap: t.spacing.md,
            },
            t.shadows.raised,
          ]}
        >
          <Heading level={2}>{title}</Heading>
          {message ? <Text tone="muted">{message}</Text> : null}
          {error ? (
            <Text variant="small" tone="danger" accessibilityRole="alert">
              {error}
            </Text>
          ) : null}
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: t.spacing.sm, marginTop: t.spacing.sm }}>
            <Button title={cancelLabel} variant="ghost" onPress={onClose} disabled={busy} />
            <Button title={confirmLabel} variant="danger" onPress={confirm} loading={busy} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
