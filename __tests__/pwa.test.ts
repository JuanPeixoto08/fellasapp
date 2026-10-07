// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => {
  readFileSync: (path: string, encoding?: string) => string & { readUInt32BE: (offset: number) => number };
};
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

  it('ícone do app (aba, atalho do iPhone e Android): PNGs quadrados nos tamanhos certos', () => {
    // largura e altura ficam nos bytes 16–23 do PNG
    const size = (file: string) => {
      const png = readFileSync(`${__dirname}/../public/${file}`);
      return [png.readUInt32BE(16), png.readUInt32BE(20)];
    };
    expect(manifest.icons).toEqual([
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ]);
    expect(size('icon-192.png')).toEqual([192, 192]);
    expect(size('icon-512.png')).toEqual([512, 512]);
    expect(size('apple-touch-icon.png')).toEqual([180, 180]);
    expect(size('favicon.png')).toEqual([48, 48]);
    // fundo transparente: o canto de cima (fora do desenho) não tem cor
    const { PNG } = require('pngjs') as unknown as { PNG: { sync: { read: (b: unknown) => { data: Uint8Array } } } };
    for (const file of ['icon-192.png', 'icon-512.png', 'apple-touch-icon.png', 'favicon.png']) {
      const { data } = PNG.sync.read(readFileSync(`${__dirname}/../public/${file}`));
      expect([file, data[3]]).toEqual([file, 0]);
    }
    expect(html).toContain('<link rel="icon" type="image/png" href="/favicon.png" />');
    expect(html).toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png" />');
  });
});
