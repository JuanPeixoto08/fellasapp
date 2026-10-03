import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

import type { Theme } from '../../lib/theme';

type StackOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;

/** Cabeçalho das telas empilhadas (perfil, membros, edição) no estilo zine. */
export function stackHeader(t: Theme, title: string): StackOptions {
  return {
    headerShown: true,
    title,
    headerBackTitle: 'Voltar',
    headerShadowVisible: false,
    headerTintColor: t.colors.text,
    headerStyle: { backgroundColor: t.colors.bg },
    headerTitleStyle: { fontFamily: t.fonts.display, fontSize: t.typography.lead.fontSize, color: t.colors.text },
    contentStyle: { backgroundColor: t.colors.bg },
  };
}
