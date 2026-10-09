import { Image, View } from 'react-native';

import { avatarColor, initials, INITIALS_SCALE } from '../../lib/avatarLook';
import { avatarInk, useTheme } from '../../lib/theme';
import { Text } from './Text';

export type AvatarProps = {
  name: string;
  uri?: string | null;
  size?: number;
};

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
      style={[box, { backgroundColor: avatarColor(name), alignItems: 'center', justifyContent: 'center' }]}
    >
      <Text
        style={{
          color: avatarInk,
          fontFamily: t.fonts.display,
          fontSize: Math.round(size * INITIALS_SCALE),
          lineHeight: Math.round(size * 0.5),
        }}
      >
        {initials(name)}
      </Text>
    </View>
  );
}
