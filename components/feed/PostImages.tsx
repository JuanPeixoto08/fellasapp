import { useEffect, useState } from 'react';
import { Image, Pressable, View, type ViewStyle } from 'react-native';

import { useTheme } from '../../lib/theme';

type Props = {
  uris: string[];
  /** Base do rótulo acessível, ex.: "Foto postada por Ana". */
  alt: string;
  onPressImage?: (index: number) => void;
};

// proporção real de cada foto já medida, para não "pular" ao reaparecer na lista
const aspectCache = new Map<string, number>();

/** Fotos do post como no Twitter: 1 na proporção original (limitada); 2, 3 ou 4 em grade. */
export function PostImages({ uris, alt, onPressImage }: Props) {
  const t = useTheme();
  const shown = uris.slice(0, 4);
  const single = shown.length === 1 ? shown[0] : null;
  const [aspect, setAspect] = useState(() => (single && aspectCache.get(single)) || 1);

  useEffect(() => {
    if (!single) return;
    const cached = aspectCache.get(single);
    if (cached) {
      setAspect(cached);
      return;
    }
    let active = true;
    try {
      Image.getSize(
        single,
        (w, h) => {
          if (!w || !h) return;
          const { min, max } = t.layout.mediaAspect;
          const ratio = Math.min(max, Math.max(min, w / h));
          aspectCache.set(single, ratio);
          if (active) setAspect(ratio);
        },
        () => {},
      );
    } catch {
      // sem medida, a foto fica quadrada
    }
    return () => {
      active = false;
    };
  }, [single, t.layout.mediaAspect]);

  if (shown.length === 0) return null;

  const tile = (index: number, style?: ViewStyle) => (
    <Pressable
      key={shown[index]}
      onPress={onPressImage ? () => onPressImage(index) : undefined}
      disabled={!onPressImage}
      accessibilityRole={onPressImage ? 'button' : 'image'}
      accessibilityLabel={shown.length > 1 ? `${alt} (${index + 1} de ${shown.length})` : alt}
      style={[{ flex: 1, backgroundColor: t.colors.surfaceSunken }, style]}
    >
      <Image source={{ uri: shown[index] }} resizeMode="cover" style={{ width: '100%', height: '100%' }} />
    </Pressable>
  );

  const gap = t.layout.mediaGap;
  const frame: ViewStyle = {
    width: '100%',
    aspectRatio: single ? aspect : t.layout.mediaAspect.grid,
    borderRadius: t.radii.lg,
    borderWidth: t.borders.hairline,
    borderColor: t.colors.border,
    overflow: 'hidden',
    flexDirection: 'row',
    gap,
  };

  if (shown.length === 1) return <View style={frame}>{tile(0)}</View>;
  if (shown.length === 2) return <View style={frame}>{[tile(0), tile(1)]}</View>;
  if (shown.length === 3) {
    return (
      <View style={frame}>
        {tile(0)}
        <View style={{ flex: 1, gap }}>{[tile(1), tile(2)]}</View>
      </View>
    );
  }
  return (
    <View style={frame}>
      <View style={{ flex: 1, gap }}>{[tile(0), tile(2)]}</View>
      <View style={{ flex: 1, gap }}>{[tile(1), tile(3)]}</View>
    </View>
  );
}
