import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Button } from './Button';
import { Heading, Text } from './Text';

export type EmptyStateProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
};

export function EmptyState({ title, message, actionLabel, onAction }: EmptyStateProps) {
  const t = useTheme();
  return (
    <View style={{ alignItems: 'center', padding: t.spacing.xxl, gap: t.spacing.md }}>
      <Heading level={2} align="center">
        {title}
      </Heading>
      {message ? (
        <Text tone="muted" align="center">
          {message}
        </Text>
      ) : null}
      {actionLabel && onAction ? (
        // o Button se alinha à esquerda por padrão; a View o deixa centralizado aqui
        <View>
          <Button title={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}
