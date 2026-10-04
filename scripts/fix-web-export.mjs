// Pós `expo export -p web`: o Expo põe fontes, ícones e imagens de pacotes em
// dist/assets/node_modules/..., e o Cloudflare Pages (wrangler pages deploy) ignora qualquer pasta
// chamada node_modules — esses arquivos não sobem e o _redirects devolve o index.html no lugar
// (fontes caem para a do navegador, ícones somem). Aqui a pasta vira dist/assets/vendor e as
// referências no build são reescritas.
import { existsSync, readdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const DIST = 'dist';
const FROM = 'assets/node_modules/';
const TO = 'assets/vendor/';
const TEXT = /\.(js|html|json|css|map)$/;

const src = join(DIST, 'assets', 'node_modules');
if (!existsSync(src)) {
  console.log('fix-web-export: nada a fazer (sem dist/assets/node_modules)');
  process.exit(0);
}
renameSync(src, join(DIST, 'assets', 'vendor'));

let changed = 0;
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) walk(path);
    else if (TEXT.test(name)) {
      const text = readFileSync(path, 'utf8');
      if (text.includes(FROM)) {
        writeFileSync(path, text.split(FROM).join(TO));
        changed++;
      }
    }
  }
};
walk(DIST);
console.log(`fix-web-export: assets/node_modules -> assets/vendor (${changed} arquivo(s) reescrito(s))`);
