import { useColorScheme } from 'react-native';

export type ColorScheme = 'light' | 'dark';

export type Colors = {
  bg: string;
  surface: string;
  surfaceSunken: string;
  text: string;
  textMuted: string;
  border: string;
  primary: string;
  onPrimary: string;
  accent: string;
  onAccent: string;
  danger: string;
  onDanger: string;
  success: string;
  overlay: string;
};

export const colors: Record<ColorScheme, Colors> = {
  light: {
    bg: '#F4F1EA',
    surface: '#FFFFFF',
    surfaceSunken: '#EAE5D8',
    text: '#121212',
    textMuted: '#5E5A52',
    border: '#DAD5C8',
    primary: '#121212',
    onPrimary: '#F4F1EA',
    accent: '#FFE14D',
    onAccent: '#121212',
    danger: '#B3261E',
    onDanger: '#FFFFFF',
    success: '#2E7D4F',
    overlay: 'rgba(18, 18, 18, 0.45)',
  },
  dark: {
    bg: '#121212',
    surface: '#1D1D1D',
    surfaceSunken: '#0B0B0B',
    text: '#F4F1EA',
    textMuted: '#A8A398',
    border: '#333333',
    primary: '#F4F1EA',
    onPrimary: '#121212',
    accent: '#FFE14D',
    onAccent: '#121212',
    danger: '#FF8A80',
    onDanger: '#121212',
    success: '#7BD9A0',
    overlay: 'rgba(0, 0, 0, 0.6)',
  },
};

/** Fundos de avatar sem foto (iniciais); todos passam contraste com `avatarInk`. */
export const avatarPalette = ['#E8DFC8', '#FFE14D', '#F4B6A6', '#BFD8C4', '#C5D0E8', '#E3C7E8'] as const;
export const avatarInk = '#121212';

export const fonts = {
  display: 'InstrumentSerif_400Regular',
  displayItalic: 'InstrumentSerif_400Regular_Italic',
  body: 'Inter_400Regular',
  bodyMedium: 'Inter_500Medium',
  bodyBold: 'Inter_700Bold',
} as const;

export type TextVariant = 'display' | 'headline' | 'title' | 'lead' | 'body' | 'small' | 'caption';

export type TextStyleToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export const typography: Record<TextVariant, TextStyleToken> = {
  display: { fontFamily: fonts.display, fontSize: 48, lineHeight: 50, letterSpacing: -0.5 },
  headline: { fontFamily: fonts.display, fontSize: 36, lineHeight: 40, letterSpacing: -0.3 },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 32, letterSpacing: -0.1 },
  lead: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, letterSpacing: 0 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export type Spacing = keyof typeof spacing;

export const radii = { sm: 4, md: 8, lg: 12, pill: 999 } as const;
export type Radius = keyof typeof radii;

export const layout = {
  /** Largura máxima do conteúdo na web/tablet. */
  maxContentWidth: 640,
  gutter: spacing.lg,
  minTouch: 44,
} as const;

/** Durações em ms. */
export const motion = { fast: 120, base: 180 } as const;

export type Shadow = {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
};

export const shadows: Record<'none' | 'card' | 'raised', Shadow> = {
  none: { shadowColor: '#000000', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0, shadowRadius: 0, elevation: 0 },
  card: { shadowColor: '#121212', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 2 },
  raised: { shadowColor: '#121212', shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.14, shadowRadius: 16, elevation: 6 },
};

export type Theme = {
  scheme: ColorScheme;
  colors: Colors;
  fonts: typeof fonts;
  typography: typeof typography;
  spacing: typeof spacing;
  radii: typeof radii;
  layout: typeof layout;
  motion: typeof motion;
  shadows: typeof shadows;
};

export function getTheme(scheme: ColorScheme): Theme {
  return { scheme, colors: colors[scheme], fonts, typography, spacing, radii, layout, motion, shadows };
}

/** Tema atual conforme o esquema do sistema (claro por padrão). */
export function useTheme(): Theme {
  return getTheme(useColorScheme() === 'dark' ? 'dark' : 'light');
}
