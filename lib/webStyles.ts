import { Platform } from 'react-native';

/**
 * CSS global da web. Com `web.output: "single"` o app/+html.tsx não é usado, então o estilo entra aqui,
 * uma vez, quando o app abre.
 * - `#root` em 100dvh: a altura acompanha a barra do navegador móvel e as colunas do desktop ocupam a tela.
 * - Campos de texto sem o anel de foco do navegador: os campos com moldura mostram o foco pela cor da
 *   borda e os sem moldura (composer) pelo cursor. Botões e links mantêm o anel (navegação por teclado).
 */
export const WEB_CSS = `
html, body { height: 100%; }
#root { height: 100dvh; }
input:focus, input:focus-visible, textarea:focus, textarea:focus-visible { outline: none; }
`;

export function injectWebStyles(): void {
  if (Platform.OS !== 'web' || typeof document === 'undefined') return;
  if (document.getElementById('fellas-web-styles')) return;
  const el = document.createElement('style');
  el.id = 'fellas-web-styles';
  el.textContent = WEB_CSS;
  document.head.appendChild(el);
}
