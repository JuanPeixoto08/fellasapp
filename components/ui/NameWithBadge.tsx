import { View } from 'react-native';

import { hasBadge } from '../../lib/badges';
import { useTheme, type IconSize } from '../../lib/theme';
import { Text, type TextProps } from './Text';
import { VerifiedBadge } from './VerifiedBadge';

type Props = Omit<TextProps, 'children'> & {
  name: string;
  badges?: readonly string[] | null;
  /** Tamanho do selo: acompanha o texto (sm em linhas de lista e posts, md em título). */
  badgeSize?: IconSize;
};

/** Nome numa linha (encurta com "…") e, se a pessoa tiver, o selo de verificado logo depois. */
export function NameWithBadge({ name, badges, badgeSize = 'sm', numberOfLines = 1, ...text }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flexShrink: 1 }}>
      <Text {...text} numberOfLines={numberOfLines} style={[{ flexShrink: 1 }, text.style]}>
        {name}
      </Text>
      {hasBadge(badges, 'verified') ? <VerifiedBadge size={badgeSize} /> : null}
    </View>
  );
}
