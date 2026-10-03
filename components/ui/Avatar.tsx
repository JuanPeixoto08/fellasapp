import { Image, View } from 'react-native';

import { avatarInk, avatarPalette, useTheme } from '../../lib/theme';
import { Text } from './Text';

export type AvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (parts[0][0] + last).toUpperCase();
}

function colorFor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarPalette[h % avatarPalette.length];
}

export function Avatar({ name, uri, size = 40 }: AvatarProps) {
  const t = useTheme();
  const box = { width: size, height: size, borderRadius: size / 2 };
  if (uri) {
    return (
      <Image
        accessibilityLabel={`Foto de ${name}`}
        source={{ uri }}
        style={[box, { backgroundColor: t.colors.surfaceSunken }]}
      />
    );
  }
  return (
    <View
      accessibilityLabel={`Avatar de ${name}`}
      style={[box, { backgroundColor: colorFor(name), alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text
        style={{
          color: avatarInk,
          fontFamily: t.fonts.display,
          fontSize: Math.round(size * 0.4),
          lineHeight: Math.round(size * 0.5),
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}
