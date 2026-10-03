import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';
import { useAutoGrow } from './useAutoGrow';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Rótulo só para leitor de tela (ex.: campo de busca com placeholder). */
  hideLabel?: boolean;
  error?: string;
  help?: string;
  /** field = caixa padrão de formulário; pill = campo arredondado de composer (comentário), cresce até ~3 linhas. */
  shape?: 'field' | 'pill';
};

export function TextField({
  label,
  hideLabel,
  error,
  help,
  shape = 'field',
  onFocus,
  onBlur,
  editable = true,
  ...rest
}: TextFieldProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.danger : focused ? t.colors.primary : t.colors.border;
  const pill = shape === 'pill';
  const paddingHorizontal = t.spacing.lg;
  const paddingVertical = t.spacing.sm;
  // pill multilinha: 1 linha vazia, cresce com o texto até ~3 linhas e encolhe ao apagar
  const grow = useAutoGrow({
    value: rest.value,
    textStyle: t.typography.body,
    inset: paddingHorizontal + t.borders.hairline,
    extra: (paddingVertical + t.borders.hairline) * 2,
    min: t.layout.minTouch,
    max: t.layout.minTouch * 3,
  });
  const autoGrow = pill && !!rest.multiline;

  return (
    <View style={{ gap: t.spacing.xs }}>
      {hideLabel ? null : (
        <Text variant="small" bold>
          {label}
        </Text>
      )}
      <View>
        {autoGrow ? grow.mirror : null}
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.primary}
          editable={editable}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          {...rest}
          style={[
            t.typography.body,
            {
              minHeight: t.layout.minTouch,
              height: autoGrow ? grow.height : undefined,
              paddingHorizontal,
              paddingVertical,
              borderRadius: pill ? t.layout.minTouch / 2 : t.radii.md,
              // espessura fixa: o foco aparece só na cor da borda, sem o campo "pular"
              borderWidth: t.borders.hairline,
              borderColor,
              backgroundColor: t.colors.surface,
              color: t.colors.text,
              opacity: editable ? 1 : 0.5,
            },
          ]}
        />
      </View>
      {error ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {error}
        </Text>
      ) : help ? (
        <Text variant="small" tone="muted">
          {help}
        </Text>
      ) : null}
    </View>
  );
}
