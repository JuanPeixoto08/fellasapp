import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Button } from '../ui';

type Props = {
  count: number;
  onPress: () => void;
  /** Por cima da lista, no topo da coluna (quando o topo do feed já saiu da tela). */
  floating?: boolean;
};

/**
 * "Posts novos": post de outra pessoa chegou ao vivo, mas a lista só muda quando a pessoa toca (não pula
 * enquanto ela lê). No fluxo, fica centralizado entre o compositor e os posts; rolando, flutua no topo.
 */
export function NewPostsPill({ count, onPress, floating = false }: Props) {
  const t = useTheme();
  if (count <= 0) return null;
  const label = count === 1 ? '1 post novo' : `${count} posts novos`;
  return (
    <View
      testID="new-posts-pill"
      pointerEvents="box-none"
      style={
        floating
          ? { position: 'absolute', top: t.spacing.md, left: 0, right: 0 }
          : { paddingVertical: t.spacing.sm }
      }
    >
      {/* o Button se alinha à esquerda por padrão; este View o centraliza */}
      <View testID="new-posts-pill-center" style={{ alignSelf: 'center' }}>
        <Button title={label} onPress={onPress} style={floating ? t.shadows.raised : undefined} />
      </View>
    </View>
  );
}
