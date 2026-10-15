// Só no dev (entrega 5): gera os ícones das conquistas 132–139 (16×16) e os desenhos das oportunidades 3–7 (96×24, 4
// quadros de 24×24) a partir de grades 12×12 (uma letra por pixel, '.' = vazio). PNG escrito à mão com o zlib do Node:
// sem dependência. Uso: node games/dev/iconesDourados.mjs conquistas | oportunidades
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../idle/assets');
const PALETA = {
  K: '#1E1B2E', W: '#F4F1EA', Y: '#F2D27A', D: '#5A3A1E', G: '#5FD38D', V: '#2E9E5B', A: '#2A5BD7', C: '#5AA9E6',
  H: '#FF5A7A', O: '#F07A2A', R: '#E0454B',
};
const GRADES = {
  nota: [
    '............', '......HKKK..', '......KWWKC.', '......KWKWKC', '......KWK.KC', '......KWK...',
    '..HKKKKWK...', '.HKWWWWWKC..', '.HKWWWWWKC..', '..KWWWWK.C..', '...KKKKCC...', '............',
  ],
  losango: [
    '.....GG.....', '....GGGG....', '...GGVVGG...', '..GGVWWVGG..', '.GGVWWWWVGG.', 'GGVWWVVWWVGG',
    'GGVWWVVWWVGG', '.GGVWWWWVGG.', '..GGVWWVGG..', '...GGVVGG...', '....GGGG....', '.....GG.....',
  ],
  tigre: [
    '.OO......OO.', '.OKO....OKO.', '.OOOOOOOOOO.', 'OOKOOOOOOKOO', 'OWWKOOOOKWWO', 'OWKWOOOOWKWO',
    'OOOOOKKOOOOO', 'OKOOOKKOOOKO', '.OKOWWWWOKO.', '..OWWKKWWO..', '...OWWWWO...', '....OOOO....',
  ],
  combo: [
    '............', '............', '............', '.YY..YY..KK.', 'YYYYYYYYKKKK', 'YYYYYYYYKKKK',
    '.YY..YY..KK.', '............', '.K.K.KKKKK..', '..K.....K...', '.K.K...K....', '.......K....',
  ],
  cupom: [
    '............', '............', 'RRRRRRRRRRRR', 'RWWWWWWWWWWR', '.RWKKWWWKWR.', '..RKKWWKWR..',
    '..RWWWKWWR..', '.RWWWKWKKWR.', 'RWWWKWWKKWWR', 'RRRRRRRRRRRR', '............', '............',
  ],
  cashback: [
    '....YYYY....', '..YYDDDDYY..', '.YDYYYYYYDY.', '.YDYYKKYYDY.', 'YDYYKYYYYYDY', 'YDYYYKKYYYDY',
    'G.GYYYYKYYDY', 'GGGYKKKYYYDY', 'GGGGYKYYYDY.', '.YDYYYYYYDY.', '..YYDDDDYY..', '....YYYY....',
  ],
  olho: [
    '............', '............', '....KKKK....', '..KKWWWWKK..', '.KWWWAAWWWK.', 'KWWWAKKAWWWK',
    'KWWWAKKAWWWK', '.KWWWAAWWWK.', '..KKWWWWKK..', '....KKKK....', '............', '............',
  ],
  megafone: [
    '............', '.........K..', '.......KKY..', '.....KKYYY.H', '.KKKKYYYYY..', '.KWWKYYYYY.H',
    '.KWWKYYYYY..', '.KKKKYYYYY.H', '..K..KKYYY..', '..K....KKY..', '..KK.....K..', '............',
  ],
  frasco: [
    '....WWWW....', '....KKKK....', '.....WW.....', '....KWWK....', '...KGGGGK...', '..KGGGGGGK..',
    '..KGWWWWGK..', '..KGWGGWGK..', '..KGWWWWGK..', '..KGGGGGGK..', '..KGGGGGGK..', '...KKKKKK...',
  ],
};
// conquista: [grade, cor da moldura de 1 px]
const CONQUISTAS = {
  132: ['nota', 'H'], 133: ['losango', 'G'], 134: ['tigre', 'R'], 135: ['combo', 'Y'], 136: ['cupom', 'R'], 137: ['cashback', 'G'],
  138: ['tigre', 'Y'], 139: ['olho', 'A'],
};
const OPORTUNIDADES = { 3: 'megafone', 4: 'cupom', 5: 'frasco', 6: 'cashback', 7: 'olho' };

const TABELA = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii');
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
}
/** PNG RGBA w×h; cor(x, y) devolve [r, g, b, a]. */
function png(w, h, cor) {
  const passo = 1 + 4 * w;
  const linhas = Buffer.alloc(h * passo); // filtro 0 em cada linha (o 1º byte já é 0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = cor(x, y);
      const i = y * passo + 1 + 4 * x;
      linhas[i] = r;
      linhas[i + 1] = g;
      linhas[i + 2] = b;
      linhas[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr), bloco('IDAT', deflateSync(linhas)), bloco('IEND', Buffer.alloc(0)),
  ]);
}
const rgba = (letra) => {
  if (!letra || letra === '.') return [0, 0, 0, 0];
  const h = PALETA[letra];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
};
const pixel = (g, x, y) => (y >= 0 && y < 12 && x >= 0 && x < 12 ? g[y][x] : '.');

const modo = process.argv[2];
if (modo === 'conquistas') {
  // a grade no meio de 16×16 (2 px de folga), com a moldura de 1 px na cor da conquista
  for (const [id, [nome, moldura]] of Object.entries(CONQUISTAS)) {
    const g = GRADES[nome];
    const arq = resolve(ASSETS, 'conquistas', `conquista-${id}.png`);
    writeFileSync(arq, png(16, 16, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? rgba(moldura) : rgba(pixel(g, x - 2, y - 2)))));
    console.log(arq);
  }
} else if (modo === 'oportunidades') {
  // a grade em 2× (24×24) em 4 quadros que sobem e descem 1 px (a .boneco anima com steps(4))
  const SOBE = [0, -1, 0, 1];
  for (const [k, nome] of Object.entries(OPORTUNIDADES)) {
    const g = GRADES[nome];
    const arq = resolve(ASSETS, 'oportunidades', `oportunidade-${k}.png`);
    writeFileSync(arq, png(96, 24, (x, y) => rgba(pixel(g, Math.floor((x % 24) / 2), Math.floor((y - SOBE[Math.floor(x / 24)]) / 2)))));
    console.log(arq);
  }
} else {
  console.error('uso: node games/dev/iconesDourados.mjs conquistas | oportunidades');
  process.exit(1);
}
