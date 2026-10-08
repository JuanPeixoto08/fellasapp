import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { useTheme, type IconSize } from '../../lib/theme';

/**
 * Selo do campeão da semana (Fellas Games): troféu com o 1 dentro, na cor da marca. É marca, não controle,
 * como o verificado. Título em disputa: o banco tira de quem tinha e dá ao novo campeão toda segunda.
 */
export function TrophyBadge({ size = 'sm' }: { size?: IconSize }) {
  const t = useTheme();
  const px = t.iconSizes[size];
  const c = t.colors.brand;
  return (
    <Svg
      width={px}
      height={px}
      viewBox="0 0 24 24"
      accessible
      accessibilityRole="image"
      accessibilityLabel="Campeão da semana"
    >
      <Path d="M7 3h10v5a5 5 0 0 1-10 0V3z" fill={c} />
      <Path
        d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10"
        fill="none"
        stroke={c}
        strokeWidth={1.8}
      />
      <Path d="M12 13v4M9.5 17h5v4h-5z" fill={c} stroke={c} strokeWidth={1.5} />
      <SvgText x={12} y={9.6} textAnchor="middle" fontSize={7.5} fontWeight="700" fill={t.colors.onBrand}>
        1
      </SvgText>
    </Svg>
  );
}
