// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const html = readFileSync(`${__dirname}/../public/index.html`, 'utf8');
const manifest = JSON.parse(readFileSync(`${__dirname}/../public/manifest.json`, 'utf8'));

describe('app instalado (atalho da tela inicial)', () => {
  it('manifesto: o site inteiro é o app, aberto sem as barras do navegador', () => {
    expect(manifest).toMatchObject({ name: 'fellas', short_name: 'fellas', start_url: '/', scope: '/', display: 'standalone' });
  });

  it('index.html liga o manifesto e o modo app do iPhone', () => {
    expect(html).toContain('<link rel="manifest" href="/manifest.json" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-capable" content="yes" />');
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="fellas" />');
  });

  it('não mexe na área segura nem na barra de status (foi isso que criou as barras no iPhone)', () => {
    expect(html).not.toContain('viewport-fit=cover');
    expect(html).not.toContain('apple-mobile-web-app-status-bar-style');
  });

  it('o Expo preenche o modelo e põe o app no #root', () => {
    expect(html).toContain('%LANG_ISO_CODE%');
    expect(html).toContain('%WEB_TITLE%');
    expect(html).toContain('<div id="root"></div>');
  });
});
