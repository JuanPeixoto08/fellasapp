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
  brand: string;
  /** Fundo roxo suave (chip da minha reação): emoji amarelo continua visível, ao contrário do creme do `accent`. */
  brandSoft: string;
  /** Texto sobre `brand` (bolinha de notificações). */
  onBrand: string;
  /** Coração curtido: vermelho próprio, diferente do `danger`. */
  like: string;
  /** Selo de verificado (mesmo vermelho do coração curtido). */
  verified: string;
  danger: string;
  onDanger: string;
  success: string;
  overlay: string;
  /** Ícone/texto sobre `overlay` ou foto (✕ da miniatura, visualizador): claro nos dois temas. */
  onOverlay: string;
  /** Fundo do visualizador de fotos em tela cheia (escuro nos dois temas). */
  viewerBg: string;
  /** Bolinha da chave liga/desliga (`Switch`), sobre o trilho `brand` (ligada) ou `border` (desligada). */
  switchThumb: string;
  /** Disco de vinil da música no post (`PostTicket`) e os sulcos dele: preto nos dois temas. */
  vinyl: string;
  vinylGroove: string;
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
    accent: '#2E2B26',
    onAccent: '#F4F1EA',
    brand: '#5B3FD9',
    brandSoft: '#E6DFFB',
    onBrand: '#FFFFFF',
    like: '#C81E3A',
    verified: '#C81E3A',
    danger: '#B3261E',
    onDanger: '#FFFFFF',
    success: '#2E7D4F',
    overlay: 'rgba(18, 18, 18, 0.45)',
    onOverlay: '#F4F1EA',
    viewerBg: '#0B0B0B',
    switchThumb: '#FFFFFF',
    vinyl: '#151515',
    vinylGroove: '#2A2A2A',
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
    accent: '#E0DCD3',
    onAccent: '#121212',
    brand: '#B8A2FF',
    brandSoft: '#2B2347',
    onBrand: '#121212',
    like: '#FF5A6E',
    verified: '#FF5A6E',
    danger: '#FF8A80',
    onDanger: '#121212',
    success: '#7BD9A0',
    overlay: 'rgba(0, 0, 0, 0.6)',
    onOverlay: '#F4F1EA',
    viewerBg: '#0B0B0B',
    switchThumb: '#F4F1EA',
    vinyl: '#050505',
    vinylGroove: '#1C1C1C',
  },
};

/** Fundos de avatar sem foto (iniciais); todos passam contraste com `avatarInk`. */
export const avatarPalette = ['#E8DFC8', '#D9D3C4', '#F4B6A6', '#BFD8C4', '#C5D0E8', '#E3C7E8'] as const;
export const avatarInk = '#121212';


export const fonts = {
  /** Títulos: Golos Text em peso alto; hierarquia por tamanho + peso (sem serifa desde out/2026). */
  display: 'GolosText_700Bold',
  displaySemiBold: 'GolosText_600SemiBold',
  body: 'GolosText_400Regular',
  bodyMedium: 'GolosText_500Medium',
  bodyBold: 'GolosText_700Bold',
} as const;

export type TextVariant = 'display' | 'headline' | 'title' | 'lead' | 'body' | 'small' | 'caption';

export type TextStyleToken = {
  fontFamily: string;
  fontSize: number;
  lineHeight: number;
  letterSpacing: number;
};

export const typography: Record<TextVariant, TextStyleToken> = {
  display: { fontFamily: fonts.display, fontSize: 48, lineHeight: 52, letterSpacing: -1.2 },
  headline: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, letterSpacing: -0.6 },
  title: { fontFamily: fonts.displaySemiBold, fontSize: 24, lineHeight: 30, letterSpacing: -0.4 },
  lead: { fontFamily: fonts.body, fontSize: 18, lineHeight: 26, letterSpacing: 0 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23, letterSpacing: 0 },
  small: { fontFamily: fonts.body, fontSize: 14, lineHeight: 20, letterSpacing: 0 },
  caption: { fontFamily: fonts.bodyMedium, fontSize: 12, lineHeight: 16, letterSpacing: 0.2 },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 } as const;
export type Spacing = keyof typeof spacing;

export const radii = { sm: 4, md: 8, lg: 12, pill: 999 } as const;
export type Radius = keyof typeof radii;

/** Espessuras de borda: `hairline` para contornos, `selected` para marcar a opção escolhida. */
export const borders = { hairline: 1, selected: 3 } as const;

/** Tamanhos de ícone (Ionicons): sm acompanha texto small, md o body, lg ações soltas. */
export const iconSizes = { sm: 16, md: 20, lg: 24 } as const;
export type IconSize = keyof typeof iconSizes;

/** Emojis desenhados (Twemoji): chip de reação (sm), botão de reagir (md), barra e seletor (lg). */
export const emojiSizes = { sm: 16, md: 20, lg: 28 } as const;
export type EmojiSize = keyof typeof emojiSizes;

/** Avatares: sm comentário · md card do feed · lg cabeçalho do perfil · xl edição de perfil. */
export const avatarSizes = { sm: 32, md: 40, lg: 56, xl: 88 } as const;

export const layout = {
  /** Largura máxima do conteúdo na web/tablet. */
  maxContentWidth: 640,
  /** Faixas de largura (px): abaixo de `medium` é celular em pé (tab bar). */
  breakpoints: { medium: 700, expanded: 1100 },
  /** Coluna central nas faixas medium/expanded. */
  centerWidth: 600,
  /** Coluna do meio das rotas largas (Fellas Games), sem a coluna da direita. */
  wideCenterWidth: 960,
  /** Miniatura da mesa no card de cada jogo (Fellas Games). */
  gameArt: { width: 112, height: 76, card: 34 },
  /** Barra lateral: só ícones (medium) ou ícone + nome (expanded). */
  sidebarWidth: { medium: 72, expanded: 260 },
  /** Coluna da direita (só expanded). */
  railWidth: 350,
  /** Largura máxima de diálogos (confirmação). */
  maxDialogWidth: 400,
  /** Altura visual do chip de reação; o toque completa os 44 com hitSlop. */
  chipHeight: 28,
  /** Painel "mais emojis" no computador (preso ao botão de reagir). */
  emojiPanelHeight: 420,
  /** Altura (e largura mínima) da bolinha de contagem. */
  badgeSize: 18,
  /** Fresta entre fotos de um mesmo post. */
  mediaGap: 2,
  /** Altura da marca FELLAS: lateral estreita (xs), topo do feed (sm), login/carregamento (lg). */
  logoHeight: { xs: 10, sm: 24, lg: 44 },
  /** Altura das folhas que sobem de baixo (seletor de emoji), como fração da tela. */
  sheetHeightRatio: 0.75,
  /** Proporções (largura/altura) das fotos no post: 1 foto fica entre min e max; 2+ usam grid. */
  mediaAspect: { min: 3 / 4, max: 1.91, grid: 16 / 9 },
  /** Banner do perfil (largura/altura), como no Twitter. */
  bannerAspect: 3,
  /** Story em pé (largura/altura) e, no computador, a altura dos cartões ao lado como fração do aberto. */
  storyAspect: 9 / 16,
  storySideScale: 0.45,
  /** Desfoque da imagem que preenche o story atrás de uma foto/vídeo que não é em pé. */
  storyBackdropBlur: 24,
  /** Barra deslizante (volume dos stories): comprimento, espessura do trilho e bolinha. O toque tem `minTouch` de altura. */
  slider: { width: 88, track: 4, thumb: 12 },
  /** Imagens de um comentário: largura máxima do bloco e lado da miniatura no campo de comentar. */
  commentMediaWidth: 280,
  commentThumb: 64,
  /**
   * Ingresso no post (review/música): largura do canhoto (pôster 2:3 na review, capa quadrada na música),
   * altura mínima, raio dos recortes redondos e o espaçamento das letras do rótulo do bilhete.
   */
  ticket: { reviewStub: 92, reviewMinHeight: 138, notch: 10, kickerTracking: 1.2 },
  /** Música no post: capa (`sleeve`) com o disco saindo dela; o selo do disco (`label`) é a capa; uma volta em `spinMs`. */
  vinyl: { sleeve: 88, disc: 84, discOffset: 50, label: 32, spinMs: 3200 },
  gutter: spacing.lg,
  minTouch: 44,
} as const;

/**
 * Mesa dos Fellas Games: a única cor fora do zine no app, só na miniatura dos jogos (a mesa em si é a página
 * própria em `games/`). Igual nos dois temas, como um objeto desenhado.
 */
export const gameTable = {
  felt: ['#1d8a58', '#0e5a3a', '#0a4029'],
  rim: '#5a3a1e',
  card: '#FFFFFF',
  cardRed: '#C81E3A',
  cardInk: '#121212',
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
  borders: typeof borders;
  iconSizes: typeof iconSizes;
  emojiSizes: typeof emojiSizes;
  avatarSizes: typeof avatarSizes;
  layout: typeof layout;
  motion: typeof motion;
  shadows: typeof shadows;
};

export function getTheme(scheme: ColorScheme): Theme {
  return {
    scheme,
    colors: colors[scheme],
    fonts,
    typography,
    spacing,
    radii,
    borders,
    iconSizes,
    emojiSizes,
    avatarSizes,
    layout,
    motion,
    shadows,
  };
}

/** Tema atual conforme o esquema do sistema (claro por padrão). */
export function useTheme(): Theme {
  return getTheme(useColorScheme() === 'dark' ? 'dark' : 'light');
}
