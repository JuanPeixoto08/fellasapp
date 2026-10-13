// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import arte from './copaoArte.json';
import {
  balao, CAUDA_BALAO, cantoExtra, COR_BASE, COR_MISTURA, corLiquido, extraImagem, EXTRA_ACUCAR, EXTRA_SAL, foto, fotoImagem,
  fundoBar, LADO_FOTO, proporcaoBase, recipiente,
} from './copaoArte';
import { BASES, EXTRAS, MISTURAS, TAMANHOS } from './copao';
import { TEMAS_LUGAR } from './temasLugar';

type Rec = { liquido: number[]; linhas: string[] };
const recs = arte.recipientes as unknown as Record<string, Rec>;
const paleta = arte.paleta as Record<string, string>;

const opacos = (img: ImageData): number => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };
const chave = (img: ImageData): string => Array.from(img.data).join(',');
const corEm = (img: ImageData, x: number, y: number): number[] => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const hex = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const H = (c: readonly number[]): string => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
/** Os pixels da letra no recipiente, de cima pra baixo. */
const letras = (t: number, ch: string): [number, number][] =>
  recs[String(t)].linhas.flatMap((l, y) => [...l].flatMap((c, x) => (c === ch ? [[x, y] as [number, number]] : [])));
/** Caixa dos pixels opacos: [x0, y0, x1, y1]. */
function caixa(img: ImageData): number[] {
  let x0 = 99, y0 = 99, x1 = -1, y1 = -1;
  for (let y = 0; y < img.height; y++) for (let x = 0; x < img.width; x++) if (corEm(img, x, y)[3]) {
    x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
  }
  return [x0, y0, x1, y1];
}

afterEach(() => vi.restoreAllMocks());

describe('foto (contrato de Mecanica.foto)', () => {
  it('foto([base, mistura, extra, tamanho, força]) é um canvas 48×48 pintado com uma imagem não vazia', () => {
    const pintadas: ImageData[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ putImageData: (img: ImageData) => pintadas.push(img) }) as unknown as CanvasRenderingContext2D,
    );
    const c = foto([1, 1, 1, 1, 5]);
    expect(c).toBeInstanceOf(HTMLCanvasElement);
    expect([c.width, c.height]).toEqual([LADO_FOTO, LADO_FOTO]);
    expect(pintadas).toHaveLength(1);
    expect([pintadas[0].width, pintadas[0].height]).toEqual([48, 48]);
    expect(opacos(pintadas[0])).toBeGreaterThan(400);
  });

  it('sem contexto 2d (happy-dom) não quebra', () => {
    const c = foto([2, 3, 4, 2, 6]);
    expect([c.width, c.height]).toEqual([48, 48]);
  });

  it('é determinística, sem meia transparência, e muda com cada parte', () => {
    const base = chave(fotoImagem([5, 3, 1, 2, 5]));
    expect(chave(fotoImagem([5, 3, 1, 2, 5]))).toBe(base);
    for (const outra of [[6, 3, 1, 2, 5], [5, 4, 1, 2, 5], [5, 3, 2, 2, 5], [5, 3, 1, 3, 5], [5, 3, 1, 2, 8]]) {
      expect(chave(fotoImagem(outra)), outra.join()).not.toBe(base);
    }
    for (const t of TAMANHOS) for (const e of EXTRAS) {
      const img = fotoImagem([1 + (e.id % 12), 1 + (e.id % 15), e.id, t.id, 1 + (e.id % 10)]);
      for (let i = 3; i < img.data.length; i += 4) expect([0, 255]).toContain(img.data[i]);
    }
  });
});

describe('o líquido: a base embaixo, a mistura em cima', () => {
  it('cada base e cada mistura tem a sua cor, todas diferentes', () => {
    expect(COR_BASE).toHaveLength(BASES.length);
    expect(COR_MISTURA).toHaveLength(MISTURAS.length);
    expect(new Set(COR_BASE).size).toBe(BASES.length);
    expect(new Set(COR_MISTURA).size).toBe(MISTURAS.length);
  });

  it('em todo tamanho, o fundo do líquido tem a cor da base (força alta) e o alto a cor da mistura (força baixa)', () => {
    for (const t of TAMANHOS) {
      const ls = letras(t.id, 'L');
      expect(ls.length, t.nome).toBeGreaterThan(30);
      const fundo = ls[ls.length - 1], alto = ls[0];
      for (const b of BASES) {
        const img = recipiente(t.id, b.id, 1, 10);
        expect(H(corEm(img, ...fundo)), `${t.nome} / ${b.nome}`).toBe(COR_BASE[b.id - 1]);
      }
      for (const m of MISTURAS) {
        const img = recipiente(t.id, 1, m.id, 1);
        expect(H(corEm(img, ...alto)), `${t.nome} / ${m.nome}`).toBe(COR_MISTURA[m.id - 1]);
      }
    }
  });

  it('trocar a base muda o fundo e não o alto; trocar a mistura muda o alto e não o fundo', () => {
    const ls = letras(2, 'L');
    const fundo = ls[ls.length - 1], alto = ls[0];
    const a = recipiente(2, 2, 3, 5), b = recipiente(2, 9, 3, 5), c = recipiente(2, 2, 10, 5);
    expect(corEm(a, ...fundo)).not.toEqual(corEm(b, ...fundo));
    expect(corEm(a, ...alto)).toEqual(corEm(b, ...alto));
    expect(corEm(a, ...alto)).not.toEqual(corEm(c, ...alto));
    expect(corEm(a, ...fundo)).toEqual(corEm(c, ...fundo));
  });

  it('a força é a proporção: mais força, mais pixels com a cor da base', () => {
    expect(proporcaoBase(1)).toBeCloseTo(0.1);
    expect(proporcaoBase(10)).toBeCloseTo(0.9);
    for (const t of TAMANHOS) {
      const ls = letras(t.id, 'L');
      const daBase = (f: number) => { const img = recipiente(t.id, 3, 1, f); return ls.filter((p) => H(corEm(img, ...p)) === COR_BASE[2]).length; };
      let antes = -1;
      for (let f = 1; f <= 10; f++) { const n = daBase(f); expect(n, `${t.nome} força ${f}`).toBeGreaterThanOrEqual(antes); antes = n; }
      expect(daBase(10), t.nome).toBeGreaterThan(daBase(1) + ls.length / 2);
    }
  });

  it('a divisa é um degradê: entre a base e a mistura aparecem cores do meio', () => {
    const r = recs['2'];
    const meio = new Set<string>();
    for (let y = r.liquido[0]; y <= r.liquido[1]; y++) meio.add(H(corLiquido(4, 4, 5, y, r.liquido)));
    expect(meio.has(COR_BASE[3]) && meio.has(COR_MISTURA[3])).toBe(true);
    expect(meio.size).toBeGreaterThanOrEqual(4);
  });

  it('o gelo e a luz do vidro clareiam o líquido; o gelo fica dentro do recipiente', () => {
    for (const t of TAMANHOS) {
      const img = recipiente(t.id, 4, 4, 5); // cola: líquido bem escuro
      const gelo = letras(t.id, 'I');
      expect(gelo.length, t.nome).toBeGreaterThan(5);
      const luz = (c: number[]) => 0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2];
      for (const p of gelo) expect(luz(corEm(img, ...p)), `${t.nome} ${p}`).toBeGreaterThan(100);
    }
  });
});

describe('os tamanhos são recipientes diferentes', () => {
  it('copo, copão e balde têm silhuetas diferentes; o copão é o mais alto e o balde o mais largo', () => {
    const [copo, copao, balde] = TAMANHOS.map((t) => recipiente(t.id, 1, 1, 5));
    const silhueta = (img: ImageData) => Array.from(img.data).filter((_, i) => i % 4 === 3).join('');
    expect(new Set([copo, copao, balde].map(silhueta)).size).toBe(3);
    const alt = (img: ImageData) => { const [, y0, , y1] = caixa(img); return y1 - y0; };
    const larg = (img: ImageData) => { const [x0, , x1] = caixa(img); return x1 - x0; };
    expect(alt(copao)).toBeGreaterThan(alt(copo));
    expect(larg(balde)).toBeGreaterThan(larg(copao));
    expect(larg(copao)).toBeGreaterThan(larg(copo));
    expect(letras(3, 'L').length).toBeGreaterThan(letras(2, 'L').length);
    expect(letras(2, 'L').length).toBeGreaterThan(letras(1, 'L').length);
  });

  it('o copão e o balde têm canudo (listrado de vermelho e branco); o copo não', () => {
    expect(letras(1, 'c')).toHaveLength(0);
    for (const t of [2, 3]) {
      const img = recipiente(t, 1, 1, 5);
      const cs = letras(t, 'c');
      expect(cs.length).toBeGreaterThan(4);
      expect(H(corEm(img, ...cs[0]))).toBe(TEMAS_LUGAR[4]!.acento);
      expect(letras(t, 'w').length).toBeGreaterThan(2);
    }
  });

  it('tudo tem contorno preto: de fora, nenhum pixel pintado encosta no vazio sem passar pelo contorno', () => {
    for (const t of TAMANHOS) {
      const r = recs[String(t.id)].linhas;
      expect(r).toHaveLength(48);
      for (const l of r) expect(l).toHaveLength(48);
      // o vazio de fora: o que se alcança pelo vazio a partir da beirada (o vidro vazio de dentro fica de fora disso)
      const fora = new Set<string>();
      const fila: [number, number][] = [];
      for (let k = 0; k < 48; k++) for (const [x, y] of [[k, 0], [k, 47], [0, k], [47, k]]) if (r[y][x] === '.') fila.push([x, y]);
      while (fila.length) {
        const [x, y] = fila.pop()!;
        const k = `${x},${y}`;
        if (fora.has(k) || x < 0 || y < 0 || x > 47 || y > 47 || r[y][x] !== '.') continue;
        fora.add(k);
        fila.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
      let tocou = 0;
      r.forEach((l, y) => [...l].forEach((ch, x) => {
        if (ch === '.' || ch === 'K') return;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (fora.has(`${x + dx},${y + dy}`)) tocou++;
      }));
      expect(tocou, t.nome).toBe(0);
      expect(letras(t.id, 'K').length, t.nome).toBeGreaterThan(60);
    }
  });
});

describe('os extras', () => {
  it('são 12 enfeites 8×8 diferentes, com contorno', () => {
    const vistos = new Set(EXTRAS.map((e) => { const img = extraImagem(e.id); expect([img.width, img.height]).toEqual([8, 8]); return chave(img); }));
    expect(vistos.size).toBe(EXTRAS.length);
    for (const e of EXTRAS) {
      const img = extraImagem(e.id);
      let pretos = 0;
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) if (H(corEm(img, x, y)) === paleta.K) pretos++;
      expect(pretos, e.nome).toBeGreaterThan(8);
    }
  });

  it('o enfeite do extra aparece na foto, no lugar dele, em todo tamanho', () => {
    for (const t of TAMANHOS) for (const e of EXTRAS) {
      const img = fotoImagem([2, 2, e.id, t.id, 5]);
      const sprite = extraImagem(e.id);
      const [ex, ey] = cantoExtra(t.id, e.id);
      expect(ex >= 0 && ey >= 0 && ex + 8 <= 48 && ey + 8 <= 48, `${t.nome} / ${e.nome}`).toBe(true);
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        if (sprite.data[(y * 8 + x) * 4 + 3]) expect(corEm(img, ex + x, ey + y), `${t.nome} / ${e.nome}`).toEqual(corEm(sprite, x, y));
      }
      const sem = recipiente(t.id, 2, 2, 5);
      expect(chave(img), `${t.nome} / ${e.nome}`).not.toBe(chave(sem));
    }
  });

  it('sal e açúcar cobrem a borda do recipiente (fora do enfeite)', () => {
    for (const t of TAMANHOS) {
      const borda = [...letras(t.id, 'r'), ...letras(t.id, 'R')];
      expect(borda.length, t.nome).toBeGreaterThan(10);
      const limao = fotoImagem([1, 1, 1, t.id, 5]);
      for (const extra of [EXTRA_SAL, EXTRA_ACUCAR]) {
        const img = fotoImagem([1, 1, extra, t.id, 5]);
        const [ex, ey] = cantoExtra(t.id, extra);
        const fora = borda.filter(([x, y]) => !(x >= ex && x < ex + 8 && y >= ey && y < ey + 8));
        const mudou = fora.filter((p) => H(corEm(img, ...p)) !== H(corEm(limao, ...p)));
        expect(mudou.length, `${t.nome} / ${extra}`).toBeGreaterThan(fora.length / 2);
      }
      const sal = fotoImagem([1, 1, EXTRA_SAL, t.id, 5]), acucar = fotoImagem([1, 1, EXTRA_ACUCAR, t.id, 5]);
      expect(chave(sal)).not.toBe(chave(acucar));
    }
  });
});

describe('o bar e o chat', () => {
  it('o fundo do bar é 128×72, cheio, com o neon do lugar 4', () => {
    const f = fundoBar();
    expect([f.width, f.height]).toEqual([128, 72]);
    expect(opacos(f)).toBe(128 * 72);
    const cores = new Set<string>();
    for (let y = 0; y < 72; y++) for (let x = 0; x < 128; x++) cores.add(H(corEm(f, x, y)));
    expect(cores.has(TEMAS_LUGAR[4]!.acento)).toBe(true);
    expect(cores.has(TEMAS_LUGAR[4]!.acento2)).toBe(true);
  });

  it('o balão tem o tamanho pedido, cauda do lado de quem fala, contorno preto e a cor do tipo', () => {
    const w = 30, h = 10;
    const esq = balao(w, h, 'esq', 'galera'), dir = balao(w, h, 'dir', 'galera');
    expect([esq.width, esq.height]).toEqual([w, h + CAUDA_BALAO]);
    const ultima = h + CAUDA_BALAO - 1;
    const naUltima = (img: ImageData) => { const xs: number[] = []; for (let x = 0; x < w; x++) if (corEm(img, x, ultima)[3]) xs.push(x); return xs; };
    expect(Math.max(...naUltima(esq))).toBeLessThan(w / 2);
    expect(Math.min(...naUltima(dir))).toBeGreaterThan(w / 2);
    expect(corEm(esq, 0, 0)[3]).toBe(0); // canto cortado
    expect(H(corEm(esq, 0, 5))).toBe(paleta.K);
    expect(H(corEm(esq, 10, 3))).toBe(TEMAS_LUGAR[4]!.texto);
    expect(H(corEm(balao(w, h, 'esq', 'pt'), 10, 3))).toBe(TEMAS_LUGAR[4]!.acento);
    expect(H(corEm(balao(w, h, 'esq', 'dj'), 10, 3))).toBe(TEMAS_LUGAR[4]!.acento2);
    expect(() => balao(4, 4, 'esq', 'galera')).toThrow();
  });
});
