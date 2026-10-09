import { Icon } from '../ui';
import { ActionButton } from './ActionButton';

type Props = { onPress: () => void };

/** Compartilhar no story: abre o montador (só na web, onde dá para gerar a imagem). */
export function ShareButton({ onPress }: Props) {
  return (
    <ActionButton onPress={onPress} accessibilityLabel="Compartilhar no story">
      <Icon name="share-outline" tone="muted" />
    </ActionButton>
  );
}
