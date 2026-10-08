import { Switch as NativeSwitch, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';

export type SwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  disabled?: boolean;
};

/** Chave liga/desliga do sistema (iOS, Android e web), com as cores do tema: trilho `brand` quando ligada. */
export function Switch({ value, onChange, accessibilityLabel, accessibilityHint, disabled }: SwitchProps) {
  const t = useTheme();
  return (
    <NativeSwitch
      value={value}
      onValueChange={onChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      trackColor={{ false: t.colors.border, true: t.colors.brand }}
      thumbColor={t.colors.switchThumb}
      ios_backgroundColor={t.colors.border}
      // web: o react-native-web usa estes para a chave ligada
      {...({ activeThumbColor: t.colors.switchThumb, activeTrackColor: t.colors.brand } as object)}
      style={{ opacity: disabled ? 0.5 : 1 }}
    />
  );
}

export type SwitchRowProps = Omit<SwitchProps, 'accessibilityLabel' | 'accessibilityHint'> & {
  label: string;
  /** Uma linha curta embaixo do rótulo (também vira a dica do leitor de tela). */
  help?: string;
};

/** Linha de configuração: rótulo e ajuda à esquerda, chave à direita (altura mínima de toque). */
export function SwitchRow({ label, help, ...toggle }: SwitchRowProps) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.md, minHeight: t.layout.minTouch }}>
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <Text tone={toggle.disabled ? 'muted' : 'default'}>{label}</Text>
        {help ? (
          <Text variant="small" tone="muted">
            {help}
          </Text>
        ) : null}
      </View>
      <Switch {...toggle} accessibilityLabel={label} accessibilityHint={help} />
    </View>
  );
}
