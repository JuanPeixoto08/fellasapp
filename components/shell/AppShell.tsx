import { useSegments } from 'expo-router';
import { useMemo, useRef, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useSession } from '../../lib/auth/SessionProvider';
import { useLayoutTier } from '../../lib/layout';
import { useTheme } from '../../lib/theme';
import { ComposeDialog } from './ComposeDialog';
import { RightRail } from './RightRail';
import { ShellContext } from './ShellContext';
import { Sidebar } from './Sidebar';
import { useForwardWheel } from './wheelForward';

/** Telas que ficam sem as colunas dos lados, só com o conteúdo no meio. */
const UNFRAMED = ['(auth)', 'not-invited', 'set-password', 'invites'];

/** A moldura só existe para membro logado, fora do login, do "sem convite" e do Convidar. */
export function shellVisible(s: { loading: boolean; hasSession: boolean; isMember: boolean; first: string | undefined }) {
  return !s.loading && s.hasSession && s.isMember && !UNFRAMED.includes(s.first ?? '');
}

/**
 * Layout por largura: em compact só repassa os filhos (celular igual a hoje); em medium/expanded
 * desenha [lateral][coluna central 600][coluna direita]. Os filhos ficam sempre na mesma posição da
 * árvore (os lados entram como null), então trocar de faixa não remonta a navegação.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  const tier = useLayoutTier();
  const { width } = useWindowDimensions();
  const { session, profile, loading } = useSession();
  const first = useSegments()[0] as string | undefined;
  const [composing, setComposing] = useState(false);
  const center = useRef<View>(null);

  const framed =
    tier !== 'compact' && shellVisible({ loading, hasSession: !!session, isMember: !!profile?.is_member, first });
  const contentWidth = framed ? t.layout.centerWidth : Math.min(width, t.layout.maxContentWidth);
  const value = useMemo(
    () => ({ contentWidth, openCompose: framed ? () => setComposing(true) : null }),
    [contentWidth, framed],
  );
  // computador: a roda em qualquer lugar da página rola o meio
  useForwardWheel(center, framed);

  return (
    <ShellContext.Provider value={value}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: t.colors.bg }}>
        {/* `framed` já exclui compact: o TS estreita `tier` por essa condição */}
        {framed ? <Sidebar tier={tier} onCompose={() => setComposing(true)} /> : null}
        <View
          ref={center}
          style={
            framed
              ? {
                  width: t.layout.centerWidth,
                  borderLeftWidth: t.borders.hairline,
                  borderRightWidth: t.borders.hairline,
                  borderColor: t.colors.border,
                }
              : { flex: 1 }
          }
        >
          {children}
        </View>
        {framed && tier === 'expanded' ? <RightRail /> : null}
      </View>
      {framed ? <ComposeDialog visible={composing} onClose={() => setComposing(false)} /> : null}
    </ShellContext.Provider>
  );
}
