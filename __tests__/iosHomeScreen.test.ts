// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

import { colors, layout } from '../lib/theme';
import { isIosHomeScreenApp, WEB_CSS } from '../lib/webStyles';

const { readFileSync } = require('fs');
const html = readFileSync(`${__dirname}/../public/index.html`, 'utf8');

describe('app da tela inicial do iPhone', () => {
  it('index.html próprio: modo app, nome, barra de status padrão e cor do tema clara/escura', () => {
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="fellas" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-status-bar-style" content="default" />');
    expect(html).toContain(`<meta name="theme-color" media="(prefers-color-scheme: light)" content="${colors.light.bg}" />`);
    expect(html).toContain(`<meta name="theme-color" media="(prefers-color-scheme: dark)" content="${colors.dark.bg}" />`);
    // o Expo preenche estes e põe os scripts antes do </body>
    expect(html).toContain('%LANG_ISO_CODE%');
    expect(html).toContain('%WEB_TITLE%');
    expect(html).toContain('<div id="root"></div>');
  });

  it('só o app da tela inicial do iPhone (navigator.standalone) é tratado', () => {
    expect(isIosHomeScreenApp({ standalone: true })).toBe(true);
    expect(isIosHomeScreenApp({ standalone: false })).toBe(false);
    expect(isIosHomeScreenApp({})).toBe(false);
  });

  it('nele, o desfoque do iOS 26 cai sobre uma faixa lisa: conteúdo e janelas descem', () => {
    const h = `${layout.iosEdgeBlur}px`;
    expect(WEB_CSS).toContain(`html[data-ios-app] #root { box-sizing: border-box; padding-top: ${h}; }`);
    expect(WEB_CSS).toContain(`html[data-ios-app] [aria-modal="true"] { top: ${h} !important; }`);
    expect(WEB_CSS).toContain(
      `html[data-ios-app] body::before { content: ''; position: fixed; top: 0; left: 0; right: 0; height: ${h}; background: ${colors.light.bg}; z-index: 2147483647; }`,
    );
    expect(WEB_CSS).toContain(`html[data-ios-app] body::before { background: ${colors.dark.bg}; }`);
  });
});
