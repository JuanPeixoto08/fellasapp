import type { ReactNode } from 'react';
import { Pressable, View, type StyleProp, type ViewStyle } from 'react-native';

import { openProfile } from '../../lib/openProfile';

type Props = {
  userId: string;
  name: string;
  /** false: só mostra (ex.: posts dentro do perfil da própria pessoa, para não empilhar o mesmo perfil). */
  enabled?: boolean;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/** Foto ou nome do autor que abre o perfil dele. */
export function AuthorLink({ userId, name, enabled = true, style, children }: Props) {
  if (!enabled) return <View style={style}>{children}</View>;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ver perfil de ${name}`}
      onPress={() => openProfile(userId)}
      style={({ pressed }) => [{ cursor: 'pointer' as const, opacity: pressed ? 0.7 : 1 }, style]}
    >
      {children}
    </Pressable>
  );
}
