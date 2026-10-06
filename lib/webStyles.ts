import { Platform } from 'react-native';

import { colors, layout } from './theme';

/**
 * CSS global da web. Com `web.output: "single"` o app/+html.tsx não é usado, então o estilo entra aqui,
 * uma vez, quando o app abre.
 * - `#root` em 100dvh: a altura acompanha a barra do navegador móvel e as colunas do desktop ocupam a tela.
 * - Campos de texto sem o anel de foco do navegador: os campos com moldura mostram o foco pela cor da
 *   borda e os sem moldura (composer) pelo cursor. Botões e links mantêm o anel (navegação por teclado).
 * - `[data-no-select]` (tela do story): segurar só pausa — sem selecionar texto nem abrir o menu de
 *   copiar/salvar imagem do navegador do celular.
 * - App da tela inicial do iPhone (`html[data-ios-app]`): o iOS 26 desfoca o topo da tela ("Liquid Glass"),
 *   e nada desliga isso. Uma faixa fixa na cor do fundo cobre o relógio e mais `layout.iosEdgeBlur` (o iOS
 *   mostra a cor lisa), e o app e as janelas (`aria-modal`) descem essa medida; a área do relógio cada tela
 *   já desconta pela área segura (no modo escuro o app desenha embaixo dele — public/index.html).
 * - Barra de rolagem fina, trilho transparente e alça na cor da borda do tema. O tema segue o sistema
 *   (`useColorScheme`), então o media query bate com o que o app desenha; `color-scheme` deixa o resto
 *   do navegador (barras, campos nativos) no mesmo tema.
 */
const blur = `${layout.iosEdgeBlur}px`;

export const WEB_CSS = `
html, body { height: 100%; }
#root { height: 100dvh; }
input:focus, input:focus-visible, textarea:focus, textarea:focus-visible { outline: none; }
[data-no-select], [data-no-select] * { -webkit-user-select: none; user-select: none; -webkit-touch-callout: none; }
html[data-ios-app] #root { box-sizing: border-box; padding-top: ${blur}; }
html[data-ios-app] [aria-modal="true"] { top: ${blur} !important; }
html[data-ios-app] body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; height: calc(env(safe-area-inset-top, 0px) + ${blur}); background: ${colors.light.bg}; z-index: 2147483647; }
:root { color-scheme: light; }
* { scrollbar-width: thin; scrollbar-color: ${colors.light.border} transparent; }
@media (prefers-color-scheme: dark) {
  :root { color-scheme: dark; }
  * { scrollbar-color: ${colors.dark.border} transparent; }
  html[data-ios-app] body::before { background: ${colors.dark.bg}; }
}
`;

/** Aberto pelo atalho da tela inicial do iPhone (`navigator.standalone` só existe no Safari do iOS). */
export function isIosHomeScreenApp(nav: { standalone?: boolean }): boolean {
  return nav.standalone === true;
}

export function injectWebStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (isIosHomeScreenApp(navigator as { standalone?: boolean })) document.documentElement.setAttribute('data-ios-app', '');
  if (document.getElementById('fellas-web-styles')) return;
  const el = document.createElement('style');
  el.id = 'fellas-web-styles';
  el.textContent = WEB_CSS;
  document.head.appendChild(el);
}
