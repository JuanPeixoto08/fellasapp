import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { LOGO_PATH, LOGO_VIEWBOX } from '../../lib/logoPath';
import { useTheme } from '../../lib/theme';

const VIEWBOX = `0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
const ASPECT = LOGO_VIEWBOX.width / LOGO_VIEWBOX.height;

export type LogoProps = {
  /** Altura em pt; a largura segue a proporção do desenho. */
  height: number;
  /** Padrão: cor do texto (tinta), inverte com o tema. */
  color?: string;
  /** Centraliza no contêiner (ex.: tela de carregamento). Padrão: encostado no início. */
  centered?: boolean;
};

/** Marca "FELLAS". Acessível como imagem com o nome do app. */
export function Logo({ height, color, centered }: LogoProps) {
  const t = useTheme();
  // a acessibilidade fica na View: na web o Svg repassa `accessible` cru para o DOM (aviso do React)
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="fellas"
      style={{ alignSelf: centered ? 'center' : 'flex-start' }}
    >
      <Svg width={height * ASPECT} height={height} viewBox={VIEWBOX}>
        <Path d={LOGO_PATH} fill={color ?? t.colors.text} />
      </Svg>
    </View>
  );
}
