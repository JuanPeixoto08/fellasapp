import type { ComponentProps } from 'react';
import type { Stack } from 'expo-router';

import type { Theme } from '../../lib/theme';

type StackOptions = NonNullable<ComponentProps<typeof Stack.Screen>['options']>;

/** Cabeçalho no estilo zine, igual em pilha e em aba (ex.: Notificações). */
export function tabHeader(t: Theme, title: string) {
  return {
    headerShown: true,
    title,
    headerShadowVisible: false,
    headerTintColor: t.colors.text,
    headerStyle: { backgroundColor: t.colors.bg },
    headerTitleStyle: { fontFamily: t.fonts.display, fontSize: t.typography.lead.fontSize, color: t.colors.text },
  };
}

/** Cabeçalho das telas empilhadas (perfil, membros, edição) no estilo zine. */
export function stackHeader(t: Theme, title: string): StackOptions {
  return {
    ...tabHeader(t, title),
    headerBackTitle: 'Voltar',
    contentStyle: { backgroundColor: t.colors.bg },
  };
}
