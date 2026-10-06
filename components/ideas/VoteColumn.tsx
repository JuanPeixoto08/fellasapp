import { Pressable, View } from 'react-native';

import { formatScore, type Vote } from '../../lib/ideas';
import { useTheme } from '../../lib/theme';
import { Icon, interactiveStyle, Text } from '../ui';

type Props = { score: number; myVote: Vote; onVote: (tapped: 1 | -1) => void };

/** ▲ pontuação ▼ do mural de ideias. Meu voto: seta e número em `brand`. */
export function VoteColumn({ score, myVote, onVote }: Props) {
  const t = useTheme();
  const arrow = (dir: 1 | -1) => {
    const on = myVote === dir;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir === 1 ? 'Votar a favor' : 'Votar contra'}
        accessibilityState={{ selected: on }}
        onPress={() => onVote(dir)}
        style={(state) => ({
          width: t.layout.minTouch,
          height: t.layout.minTouch,
          borderRadius: t.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          ...interactiveStyle(t, state),
        })}
      >
        <Icon
          name={dir === 1 ? 'chevron-up-outline' : 'chevron-down-outline'}
          size="lg"
          color={on ? t.colors.brand : t.colors.textMuted}
        />
      </Pressable>
    );
  };
  const mine = myVote === 1 ? ', seu voto: a favor' : myVote === -1 ? ', seu voto: contra' : '';
  const label = `${formatScore(score)} pontos${mine}`;
  return (
    <View style={{ alignItems: 'center' }}>
      {arrow(1)}
      <Text
        accessibilityLabel={label}
        bold={myVote !== null}
        style={myVote !== null ? { color: t.colors.brand } : undefined}
      >
        {formatScore(score)}
      </Text>
      {arrow(-1)}
    </View>
  );
}
