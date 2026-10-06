import { Image, Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon } from './Icon';

export type ImageThumbsProps = {
  uris: string[];
  /** Lado de cada miniatura (quadrada). */
  size: number;
  /** Como chamar cada uma nos rótulos: "Foto 1 de 2" / "Remover foto 1". */
  noun: 'foto' | 'imagem';
  disabled?: boolean;
  onRemove: (index: number) => void;
};

/** Miniaturas do que vai ser enviado, cada uma com ✕ no canto (toque de 44). */
export function ImageThumbs({ uris, size, noun, disabled, onRemove }: ImageThumbsProps) {
  const t = useTheme();
  const Noun = noun[0].toUpperCase() + noun.slice(1);
  if (uris.length === 0) return null;
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
      {uris.map((uri, i) => (
        <View key={uri} style={{ width: size, height: size }}>
          <Image
            source={{ uri }}
            accessibilityLabel={`${Noun} ${i + 1} de ${uris.length}`}
            style={{ width: '100%', height: '100%', borderRadius: t.radii.md, backgroundColor: t.colors.surfaceSunken }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Remover ${noun} ${i + 1}`}
            disabled={disabled}
            onPress={() => onRemove(i)}
            style={{
              position: 'absolute',
              top: 0,
              right: 0,
              width: t.layout.minTouch,
              height: t.layout.minTouch,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <View
              style={{
                width: t.layout.chipHeight,
                height: t.layout.chipHeight,
                borderRadius: t.radii.pill,
                backgroundColor: t.colors.overlay,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon name="close" size="sm" color={t.colors.onOverlay} />
            </View>
          </Pressable>
        </View>
      ))}
    </View>
  );
}
