import { Pressable } from 'react-native';

import { Text } from '../ui';
import { useTheme } from '../../lib/theme';

type Props = { count: number; onPress?: () => void };

export function CommentButton({ count, onPress }: Props) {
  const t = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Comentários"
      accessibilityValue={{ text: `${count} ${count === 1 ? 'comentário' : 'comentários'}` }}
      hitSlop={t.spacing.xs}
      style={{
        minHeight: t.layout.minTouch,
        minWidth: t.layout.minTouch,
        paddingHorizontal: t.spacing.md,
        borderRadius: t.radii.pill,
        borderWidth: 1,
        borderColor: t.colors.border,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="small" bold tone="muted">
        Comentar · {count}
      </Text>
    </Pressable>
  );
}
