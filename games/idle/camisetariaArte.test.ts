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

describe('o que cada estilo faz (nos pixels)', () => {
  const H = (c: number[]): string => '#' + c.slice(0, 3).map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase();
  const cores = (img: ImageData): Set<string> => {
    const s = new Set<string>();
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const c = corEm(img, x, y); if (c[3]) s.add(H(c)); }
    return s;
  };
  const linhas = (t: number): string[] => (arte.estampas as Record<string, string[]>)[String(t)];
  /** Os pixels do desenho do tema (já na posição da estampa) e a volta de 1 px em torno dele. */
  const desenho = (t: number): Set<string> => {
    const s = new Set<string>();
    linhas(t).forEach((l, y) => [...l].forEach((ch, x) => { if (ch !== '.') s.add(`${x + 2},${y + 2}`); }));
    return s;
  };
  const volta = (t: number): Set<string> => {
    const d = desenho(t), s = new Set<string>();
    for (const k of d) {
      const [x, y] = k.split(',').map(Number);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (!d.has(`${x + dx},${y + dy}`)) s.add(`${x + dx},${y + dy}`);
    }
    return s;
  };
  const xyDe = (k: string): [number, number] => k.split(',').map(Number) as [number, number];
  const PRETO = '#0B0A0E', BRANCO = '#F4F1EA';

  it('Rabisco desenha com caneta azul', () => {
    for (const t of TEMAS) expect(cores(estampa(t.id, 2)).has('#2B3A8C'), t.nome).toBe(true);
  });

  it('Grafite usa as duas cores de destaque do lugar (contorno e respingo)', () => {
    for (const t of TEMAS) {
      const c = cores(estampa(t.id, 4));
      expect(c.has('#FFD25E') && c.has('#5ED18A'), t.nome).toBe(true);
    }
  });

  it('Vintage desbota (nenhum preto puro) e falha (some pixel do desenho)', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 5);
      expect(cores(img).has(PRETO), t.nome).toBe(false);
      expect([...desenho(t.id)].filter((k) => !corEm(img, ...xyDe(k))[3]).length, t.nome).toBeGreaterThan(0);
    }
  });

  it('Estêncil tem uma cor só, com vazados dentro do desenho', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 6);
      expect(cores(img).size, t.nome).toBe(1);
      expect([...desenho(t.id)].filter((k) => !corEm(img, ...xyDe(k))[3]).length, t.nome).toBeGreaterThan(0);
    }
  });

  it('Tie-dye tem o fundo redondo em espiral com 3 ou mais cores e os cantos vazios', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 7);
      const ocupado = new Set([...desenho(t.id), ...volta(t.id)]);
      const fundo = new Set<string>();
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (!ocupado.has(`${x},${y}`) && corEm(img, x, y)[3]) fundo.add(H(corEm(img, x, y)));
      expect(fundo.size, t.nome).toBeGreaterThanOrEqual(3);
      expect(corEm(img, 0, 0)[3], t.nome).toBe(0);
    }
  });

  it('Xilogravura é preto e papel, com moldura preta', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 8);
      expect([...cores(img)].sort(), t.nome).toEqual(['#0B0A0E', '#E8E0CC']);
      for (let k = 0; k < 16; k++) for (const [x, y] of [[k, 0], [k, 15], [0, k], [15, k]]) expect(H(corEm(img, x, y))).toBe(PRETO);
    }
  });

  it('Neon fica numa placa escura de cantos cortados', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 9);
      expect(H(corEm(img, 0, 7)), t.nome).toBe('#15141B');
      expect(H(corEm(img, 15, 8)), t.nome).toBe('#15141B');
      expect(corEm(img, 0, 0)[3], t.nome).toBe(0);
    }
  });

  it('Bordado faz o ponto em X: vizinhos da mesma cor no desenho saem em dois tons alternados', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 10);
      let pares = 0;
      linhas(t.id).forEach((r, y) => [...r].forEach((ch, x) => {
        if (ch === '.' || r[x + 1] !== ch) return;
        pares++;
        expect(corEm(img, x + 2, y + 2), `${t.nome} (${x},${y})`).not.toEqual(corEm(img, x + 3, y + 2));
      }));
      expect(pares, t.nome).toBeGreaterThan(0);
    }
  });

  it('Pop art tem a retícula: um ponto a cada 2 px no fundo', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 11);
      expect(corEm(img, 0, 0), t.nome).toEqual(corEm(img, 2, 0));
      expect(corEm(img, 0, 0), t.nome).toEqual(corEm(img, 0, 2));
      expect(corEm(img, 1, 0), t.nome).not.toEqual(corEm(img, 0, 0));
      expect(corEm(img, 1, 0), t.nome).toEqual(corEm(img, 0, 1));
    }
  });

  it('Colagem mostra o papel dos recortes', () => {
    for (const t of TEMAS) {
      const c = cores(estampa(t.id, 12));
      expect(c.has('#E8E0CC') || c.has('#FF8FB8'), t.nome).toBe(true);
    }
  });

  it('Aquarela não tem preto puro nem contorno escuro', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 13);
      expect(cores(img).has(PRETO), t.nome).toBe(false);
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) {
        const c = corEm(img, x, y);
        if (c[3]) expect(0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2], `${t.nome} (${x},${y})`).toBeGreaterThan(30);
      }
    }
  });

  it('Gótico é só preto e branco, com o contorno branco colado no desenho', () => {
    for (const t of TEMAS) {
      const img = estampa(t.id, 14);
      expect([...cores(img)].sort(), t.nome).toEqual([PRETO, BRANCO].sort());
      for (const k of volta(t.id)) expect(H(corEm(img, ...xyDe(k))), t.nome).toBe(BRANCO);
    }
  });

  it('Y2K tem o rosa-choque e o cromado', () => {
    const CROMADO = ['#F4F6FF', '#B4C4F0', '#4A5A8C', '#D8E0FF', '#8DA2D9'];
    for (const t of TEMAS) {
      const c = cores(estampa(t.id, 15));
      expect(c.has('#FF4FA3'), t.nome).toBe(true);
      expect(CROMADO.filter((x) => c.has(x)).length, t.nome).toBeGreaterThanOrEqual(2);
    }
  });

  it('a estampa guardada não se estraga se quem recebeu mexer nela', () => {
    const a = estampa(1, 3);
    const antes = chave(a);
    a.data.fill(0);
    expect(chave(estampa(1, 3))).toBe(antes);
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
