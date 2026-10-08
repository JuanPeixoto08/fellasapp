import { View } from 'react-native';

import { hasBadge, visibleBadges } from '../../lib/badges';
import { useTheme, type IconSize } from '../../lib/theme';
import { Text, type TextProps } from './Text';
import { VerifiedBadge } from './VerifiedBadge';

type Props = Omit<TextProps, 'children'> & {
  name: string;
  badges?: readonly string[] | null;
  /** Selos que a pessoa escondeu no Editar perfil. */
  hiddenBadges?: readonly string[] | null;
  /** Tamanho do selo: acompanha o texto (sm em linhas de lista e posts, md em título). */
  badgeSize?: IconSize;
};

/** Nome numa linha (encurta com "…") e, se a pessoa tiver (e não escondeu), o selo de verificado logo depois. */
export function NameWithBadge({ name, badges, hiddenBadges, badgeSize = 'sm', numberOfLines = 1, ...text }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flexShrink: 1 }}>
      <Text {...text} numberOfLines={numberOfLines} style={[{ flexShrink: 1 }, text.style]}>
        {name}
      </Text>
      {hasBadge(visibleBadges(badges, hiddenBadges), 'verified') ? <VerifiedBadge size={badgeSize} /> : null}
    </View>
  );
}
