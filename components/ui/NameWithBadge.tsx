import { View } from 'react-native';

import { shownBadge } from '../../lib/badges';
import { useTheme, type IconSize } from '../../lib/theme';
import { Text, type TextProps } from './Text';
import { UserBadge } from './UserBadge';

type Props = Omit<TextProps, 'children'> & {
  name: string;
  badges?: readonly string[] | null;
  /** Selo que a pessoa escolheu no Editar perfil (entre os que tem). */
  featuredBadge?: string | null;
  /** Tamanho do selo: acompanha o texto (sm em linhas de lista e posts, md em título). */
  badgeSize?: IconSize;
};

/** Nome numa linha (encurta com "…") e, se a pessoa tiver selo, o escolhido por ela logo depois. */
export function NameWithBadge({ name, badges, featuredBadge, badgeSize = 'sm', numberOfLines = 1, ...text }: Props) {
  const t = useTheme();
  const badge = shownBadge(badges, featuredBadge);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flexShrink: 1 }}>
      <Text {...text} numberOfLines={numberOfLines} style={[{ flexShrink: 1 }, text.style]}>
        {name}
      </Text>
      {badge ? <UserBadge badge={badge} size={badgeSize} /> : null}
    </View>
  );
}
