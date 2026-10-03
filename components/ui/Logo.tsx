import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../lib/theme';

// "FELLAS" desenhado uma vez com a fonte Galaxia (Mocha Frappuccino / Lettercorner Studio) e convertido
// em contorno. O app distribui só este desenho, nunca o arquivo da fonte (licença de uso pessoal).
const VIEWBOX = '0 0 403.5 70.0';
const ASPECT = 403.5 / 70.0;
const D =
  'M28.5 70.0L28.5 0.0L0 0.0L0 70.0ZM66.8 28.9L66.8 0.1L31.3 0.1L31.3 28.9ZM66.8 54.6L66.8 31.4L31.3 31.4L31.3 54.6ZM99.9 0.0L71.4 0.0L71.4 30.8C71.4 52.5 88.9 70.0 110.6 70.0L138.2 70.0L138.2 44.0L99.9 44.0ZM138.2 26.1L138.2 0.1L102.7 0.1L102.7 26.1ZM138.2 42.7L138.2 27.3L102.7 27.3L102.7 42.7ZM174.0 38.6L174.1 38.6L174.1 0L145.2 0L145.2 57.7C150.0 46.5 161.1 38.7 174.0 38.6ZM174.0 41.2C158.1 41.2 145.2 54.1 145.2 70.0L198.8 70.0L198.8 41.1ZM231.6 38.6L231.7 38.6L231.7 0L202.8 0L202.8 57.7C207.6 46.5 218.7 38.7 231.6 38.6ZM231.6 41.2C215.7 41.2 202.8 54.1 202.8 70.0L256.4 70.0L256.4 41.1ZM326.9 28.8L326.9 0.0C288.2 0.0 256.9 31.3 256.9 70.0L285.7 70.0C285.7 68.8 285.8 67.5 285.9 66.3L298.0 66.3L298.0 70.0L326.8 70.0L326.9 31.3C315.4 31.3 305.1 36.3 298.0 44.3L298.0 46.9L292.7 46.9C300.2 36.0 312.7 28.8 326.9 28.8ZM332.9 44.2L332.9 70.0L377.0 70.0C377.0 60.1 373.0 51.1 366.4 44.2ZM398.3 28.8L403.4 28.8L403.5 0.0L351.9 0.0C366.0 3.0 378.9 9.6 389.4 19.1C392.7 22.1 395.6 25.3 398.3 28.8ZM388.0 20.5C374.1 7.8 354.9 0.0 333.7 0.0L333.7 28.8C358.7 28.8 379.0 47.3 379.0 70.0C398.0 70.0 409.9 49.8 399.8 34.3C396.5 29.2 392.6 24.6 388.0 20.5Z';

export type LogoProps = {
  /** Altura em pt; a largura segue a proporção do desenho. */
  height: number;
  /** Padrão: cor do texto (tinta), inverte com o tema. */
  color?: string;
};

/** Marca "FELLAS". Acessível como imagem com o nome do app. */
export function Logo({ height, color }: LogoProps) {
  const t = useTheme();
  // a acessibilidade fica na View: na web o Svg repassa `accessible` cru para o DOM (aviso do React)
  return (
    <View accessible accessibilityRole="image" accessibilityLabel="fellas" style={{ alignSelf: 'flex-start' }}>
      <Svg width={height * ASPECT} height={height} viewBox={VIEWBOX}>
        <Path d={D} fill={color ?? t.colors.text} />
      </Svg>
    </View>
  );
}
