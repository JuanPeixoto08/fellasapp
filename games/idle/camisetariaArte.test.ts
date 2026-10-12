// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest';
import arte from './camisetariaArte.json';
import { avatar, cantoEstampa, estampa, foto, fotoImagem, fundoBancada, LADO_FOTO, pecaComCor } from './camisetariaArte';
import { CORES, ESTILOS, INFLUENCERS, PECAS, TEMAS } from './camisetaria';

const opacos = (img: ImageData): number => { let n = 0; for (let i = 3; i < img.data.length; i += 4) if (img.data[i]) n++; return n; };
const chave = (img: ImageData): string => Array.from(img.data).join(',');
const corEm = (img: ImageData, x: number, y: number): number[] => Array.from(img.data.subarray((y * img.width + x) * 4, (y * img.width + x) * 4 + 4));
const hex = (h: string): number[] => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];

afterEach(() => vi.restoreAllMocks());

describe('foto (contrato de Mecanica.foto)', () => {
  it('foto([1,1,1,1]) é um canvas 48×48 pintado com uma imagem não vazia', () => {
    const pintadas: ImageData[] = [];
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
      () => ({ putImageData: (img: ImageData) => pintadas.push(img) }) as unknown as CanvasRenderingContext2D,
    );
    const c = foto([1, 1, 1, 1]);
    expect(c).toBeInstanceOf(HTMLCanvasElement);
    expect([c.width, c.height]).toEqual([LADO_FOTO, LADO_FOTO]);
    expect(pintadas).toHaveLength(1);
    expect(opacos(pintadas[0])).toBeGreaterThan(400);
  });

  it('sem contexto 2d (happy-dom) não quebra', () => {
    const c = foto([1, 1, 1, 1]);
    expect([c.width, c.height]).toEqual([48, 48]);
  });

  it('é determinística e muda com cada parte', () => {
    const base = chave(fotoImagem([5, 3, 1, 2]));
    expect(chave(fotoImagem([5, 3, 1, 2]))).toBe(base);
    for (const outra of [[6, 3, 1, 2], [5, 4, 1, 2], [5, 3, 2, 2], [5, 3, 1, 3]]) expect(chave(fotoImagem(outra))).not.toBe(base);
  });

  it('a estampa fica toda em cima do tecido em toda peça (até os estilos de fundo quadrado)', () => {
    for (const p of PECAS) {
      const peca = pecaComCor(p.id, '#808080');
      const [ex, ey] = cantoEstampa(p.id);
      for (let y = ey; y < ey + 16; y++) for (let x = ex; x < ex + 16; x++) {
        expect(corEm(peca, x >> 1, y >> 1)[3], `peça ${p.id} em (${x},${y})`).toBe(255);
      }
    }
  });
});

describe('estampa', () => {
  it('toda combinação tema × estilo tem 16×16 sem meia transparência', () => {
    for (const t of TEMAS) for (const e of ESTILOS) {
      const img = estampa(t.id, e.id);
      expect([img.width, img.height]).toEqual([16, 16]);
      expect(opacos(img), `${t.nome} / ${e.nome}`).toBeGreaterThan(20);
      for (let i = 3; i < img.data.length; i += 4) expect([0, 255]).toContain(img.data[i]);
    }
  });

  it('cada estilo muda a estampa (os 15 dão desenhos diferentes em todo tema)', () => {
    for (const t of TEMAS) {
      const vistos = new Set(ESTILOS.map((e) => chave(estampa(t.id, e.id))));
      expect(vistos.size, t.nome).toBe(ESTILOS.length);
    }
  });

  it('Pixel mantém o desenho, com o contorno preto de 2 px de adesivo', () => {
    const img = estampa(15, 3); // Caveira
    const linhas = (arte.estampas as Record<string, string[]>)['15'];
    const paleta = arte.paleta as Record<string, string>;
    linhas.forEach((l, y) => [...l].forEach((ch, x) => {
      if (ch !== '.') expect(corEm(img, x + 2, y + 2)).toEqual(hex(paleta[ch]));
    }));
    expect(corEm(img, 1, 7)).toEqual(hex(paleta.K)); // 1ª volta do contorno
    expect(corEm(img, 0, 7)).toEqual(hex(paleta.K)); // 2ª volta
  });

  it('Minimalista tem só duas cores', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 1);
      const cores = new Set<string>();
      for (let i = 0; i < img.data.length; i += 4) if (img.data[i + 3]) cores.add(Array.from(img.data.subarray(i, i + 3)).join());
      expect(cores.size, t.nome).toBeLessThanOrEqual(2);
    }
  });
});

describe('peças e cores', () => {
  it('o tecido troca de cor na hora e o resto não muda', () => {
    for (const p of PECAS) {
      const a = pecaComCor(p.id, CORES[0].hex);
      const b = pecaComCor(p.id, CORES[2].hex);
      expect([a.width, a.height]).toEqual([24, 24]);
      expect(chave(a)).not.toBe(chave(b));
      const linhas = (arte.pecas as Record<string, { linhas: string[] }>)[String(p.id)].linhas;
      let tecido = 0;
      linhas.forEach((l, y) => [...l].forEach((ch, x) => {
        if (ch === 'c') { tecido++; expect(corEm(b, x, y)).toEqual(hex(CORES[2].hex)); }
        else if (!'shc'.includes(ch)) expect(corEm(a, x, y)).toEqual(corEm(b, x, y));
      }));
      expect(tecido, p.nome).toBeGreaterThan(60);
    }
  });

  it('as 12 cores dão 12 peças diferentes', () => {
    expect(new Set(CORES.map((c) => chave(pecaComCor(1, c.hex)))).size).toBe(12);
  });
});

describe('influencers e bancada', () => {
  it('cada influencer tem avatar 16×16 próprio', () => {
    const vistos = new Set(INFLUENCERS.map((i) => { const a = avatar(i.id); expect([a.width, a.height]).toEqual([16, 16]); return chave(a); }));
    expect(vistos.size).toBe(INFLUENCERS.length);
  });

  it('a parede da bancada é 128×72 e cheia', () => {
    const f = fundoBancada();
    expect([f.width, f.height]).toEqual([128, 72]);
    expect(opacos(f)).toBe(128 * 72);
  });
});
