import { UNICORNIO } from '../../lib/pixelArt';
import { useTheme, type IconSize } from '../../lib/theme';
import { PixelArt } from './PixelArt';

/** Selo de unicórnio da semana (maior valuation da Fellas Inc.), em pixel art. */
export function UnicornBadge({ size = 'sm' }: { size?: IconSize }) {
  const t = useTheme();
  return <PixelArt pixels={UNICORNIO} tamanho={t.iconSizes[size]} rotulo="Unicórnio da semana" />;
}
