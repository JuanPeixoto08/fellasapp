import type { ReactNode } from 'react';
import { ScrollView, View, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useTheme } from '../../lib/theme';

export type ScreenProps = {
  children: ReactNode;
  /** Rola o conteúdo (padrão: não). */
  scroll?: boolean;
  /** Sem padding lateral (ex.: listas full-bleed). */
  flush?: boolean;
  style?: StyleProp<ViewStyle>;
  /** A tela tem cabeçalho de navegação: ele já cuida da área segura do topo. */
  header?: boolean;
};

export function Screen({ children, scroll, flush, style, header }: ScreenProps) {
  const t = useTheme();
  const inner: ViewStyle = {
    width: '100%',
    maxWidth: t.layout.maxContentWidth,
    alignSelf: 'center',
    paddingHorizontal: flush ? 0 : t.layout.gutter,
  };
  return (
    <SafeAreaView edges={header ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.bg }}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[inner, { paddingVertical: t.spacing.lg, gap: t.spacing.lg }, style]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[inner, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}
