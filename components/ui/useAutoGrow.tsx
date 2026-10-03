import { useState, type ReactNode } from 'react';
import { Text as RNText, type TextStyle } from 'react-native';

type Options = {
  value: string | undefined;
  /** Mesma tipografia do campo, para a medida bater. */
  textStyle: TextStyle;
  /** Recuo lateral do texto dentro do campo (padding + borda), para quebrar as linhas no mesmo lugar. */
  inset: number;
  /** Somado à altura do texto (padding vertical + bordas). */
  extra: number;
  min: number;
  max?: number;
};

/**
 * Altura de um campo multilinha que acompanha o texto, crescendo e encolhendo, no app e na web.
 * Um texto invisível com o mesmo conteúdo mede a altura real: `contentSize` da web nunca encolhe e
 * já inclui o padding, o que fazia o campo crescer sozinho até o máximo.
 * Renderize `mirror` dentro do mesmo container (position relative) do campo.
 */
export function useAutoGrow({ value, textStyle, inset, extra, min, max = Infinity }: Options): {
  mirror: ReactNode;
  height: number;
} {
  const [textHeight, setTextHeight] = useState(0);
  const mirror = (
    <RNText
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      onLayout={(e) => setTextHeight(e.nativeEvent.layout.height)}
      style={[textStyle, { position: 'absolute', left: inset, right: inset, top: 0, opacity: 0 }]}
    >
      {/* espaço no fim: uma quebra de linha final também conta como linha */}
      {`${value ?? ''} `}
    </RNText>
  );
  const height = textHeight ? Math.min(max, Math.max(min, textHeight + extra)) : min;
  return { mirror, height };
}
