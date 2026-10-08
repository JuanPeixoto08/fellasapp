import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';

import { useTheme } from '../../lib/theme';

// "FELLAS" desenhado uma vez com a Monocraft Bold (Idrees Hassan, SIL Open Font License 1.1, uso comercial
// liberado) e convertido em contorno. O app distribui só este desenho, não o arquivo da fonte.
const VIEWBOX = '0 0 4248 888';
const ASPECT = 4248 / 888;
const D =
  'M0 888V0H648V168H168V240H408V408H168V888ZM720 888V0H1368V168H888V240H1128V408H888V720H1368V888ZM1440 888V0H1608V720H2088V888ZM2160 888V0H2328V720H2808V888ZM3048 240H3360V168H3048ZM2880 888V120H3000V0H3408V120H3528V888H3360V408H3048V888ZM3720 888V768H3600V600H3768V720H4080V408H3720V288H3600V120H3720V0H4248V168H3768V240H4128V360H4248V768H4128V888Z';

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
        <Path d={D} fill={color ?? t.colors.text} />
      </Svg>
    </View>
  );
}
