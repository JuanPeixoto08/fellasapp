import { Icon } from '../ui';
import { ActionButton } from './ActionButton';

type Props = { count: number; onPress?: () => void };

export function CommentButton({ count, onPress }: Props) {
  return (
    <ActionButton
      onPress={onPress}
      count={count}
      accessibilityLabel="Comentários"
      accessibilityValue={{ text: `${count} ${count === 1 ? 'comentário' : 'comentários'}` }}
    >
      <Icon name="chatbubble-outline" tone="muted" />
    </ActionButton>
  );
}
