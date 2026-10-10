import { View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

import type { Pixels } from '../../lib/pixelArt';

/** Pixel art em SVG: um retângulo por trecho da mesma cor (com uma sobra mínima para não abrir fresta entre eles). */
export function PixelArt({ pixels, tamanho, rotulo }: { pixels: Pixels; tamanho: number; rotulo?: string }) {
  const w = pixels.linhas[0].length;
  const h = pixels.linhas.length;
  const rects: { x: number; y: number; n: number; c: string }[] = [];
  pixels.linhas.forEach((linha, y) => {
    let x = 0;
    while (x < w) {
      const ch = linha[x];
      let n = 1;
      while (x + n < w && linha[x + n] === ch) n++;
      if (ch !== '.') rects.push({ x, y, n, c: pixels.cores[ch] });
      x += n;
    }
  });
  const svg = (
    <Svg width={tamanho} height={(tamanho * h) / w} viewBox={`0 0 ${w} ${h}`}>
      {rects.map((r) => (
        <Rect key={`${r.x}-${r.y}`} x={r.x} y={r.y} width={r.n + 0.04} height={1.04} fill={r.c} />
      ))}
    </Svg>
  );
  // o rótulo fica na View: no Svg, a web jogaria `accessible` como atributo do DOM
  return rotulo ? (
    <View accessible accessibilityRole="image" accessibilityLabel={rotulo}>
      {svg}
    </View>
  ) : (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">{svg}</View>
  );
}
