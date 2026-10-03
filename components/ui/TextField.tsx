import { useState } from 'react';
import { TextInput, View, type TextInputProps } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  error?: string;
  help?: string;
};

export function TextField({ label, error, help, onFocus, onBlur, editable = true, ...rest }: TextFieldProps) {
  const t = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? t.colors.danger : focused ? t.colors.primary : t.colors.border;

  return (
    <View style={{ gap: t.spacing.xs }}>
      <Text variant="small" bold>
        {label}
      </Text>
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
            paddingHorizontal: t.spacing.lg,
            paddingVertical: t.spacing.sm,
            borderRadius: t.radii.md,
            borderWidth: focused || error ? 2 : 1,
            borderColor,
            backgroundColor: t.colors.surface,
            color: t.colors.text,
            opacity: editable ? 1 : 0.5,
          },
        ]}
      />
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
