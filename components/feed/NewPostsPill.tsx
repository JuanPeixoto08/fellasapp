import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Button } from '../ui';

type Props = { count: number; onPress: () => void };

/**
 * "Posts novos" flutuando no topo do feed: post de outra pessoa chegou ao vivo, mas a lista só muda
 * quando a pessoa toca (não pula enquanto ela lê).
 */
export function NewPostsPill({ count, onPress }: Props) {
  const t = useTheme();
  if (count <= 0) return null;
  const label = count === 1 ? '1 post novo' : `${count} posts novos`;
  return (
    <View
      pointerEvents="box-none"
      style={{ position: 'absolute', top: t.spacing.md, left: 0, right: 0, alignItems: 'center' }}
    >
      <Button title={label} onPress={onPress} style={t.shadows.raised} />
    </View>
  );
}
