import { describe, expect, it } from 'vitest';

import { colar, recortar, vazia, type Imagem } from './imagem';
import {
  boneco, CADEIRA, linhaAcessorio, linhaCabelo, linhaRoupa, LINHAS_KIT, montarTira, naCadeira, ocuparVagas,
  posicaoNoQuadro, POSES, QUADROS_POSE, validarVagas, type Kit, type Pose, type Vaga, type Vagas,
} from './montagem';
import { CORES, CORES_CABELO, MARCADORES, PADRAO, PELES, type Visual } from './personagem';

const PRETO = '#0B0A0E';
const rgba = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const pinta = (img: Imagem, x: number, y: number, h: string) => img.d.set(rgba(h), (y * img.w + x) * 4);
const cor = (img: Imagem, x: number, y: number): string | null => {
  const i = (y * img.w + x) * 4;
  if (!img.d[i + 3]) return null;
  return `#${[0, 1, 2].map((k) => img.d[i + k].toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
const cheia = (w: number, h: number, c: string) => {
  const img = vazia(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pinta(img, x, y, c);
  return img;
};

/**
 * Kit de mentira. Em cada célula (quadro q, linha l):
 *  corpo: (0,0) no tom do meio da pele e (q, h-1) preto (diz o quadro);
 *  cabelo k: (1,0) e (1,1+k); roupa k: (2,0) e (2,1+k); acessório k: (3,0) e (3,1+k), no tom do meio do marcador;
 *  e toda peça (menos o corpo) pinta também (0,2), para provar quem fica por cima.
 */
function kitFalso(): Kit {
  const poses = {} as Record<Pose, Imagem>;
  for (const p of [1, 2, 3, 4, 5, 6] as Pose[]) {
    const { w, h } = POSES[p];
    const folha = vazia(QUADROS_POSE * w, LINHAS_KIT * h);
    for (let q = 0; q < QUADROS_POSE; q++) {
      const em = (l: number, x: number, y: number, c: string) => pinta(folha, q * w + x, l * h + y, c);
      em(0, 0, 0, MARCADORES.pele[1]);
      em(0, q, h - 1, PRETO);
      for (let k = 0; k < 6; k++) for (const [x, y] of [[1, 0], [1, 1 + k], [0, 2]]) em(linhaCabelo(k), x, y, MARCADORES.cabelo[1]);
      for (let k = 0; k < 4; k++) for (const [x, y] of [[2, 0], [2, 1 + k], [0, 2]]) em(linhaRoupa(k), x, y, MARCADORES.roupa[1]);
      for (let k = 1; k < 6; k++) for (const [x, y] of [[3, 0], [3, 1 + k], [0, 2]]) em(linhaAcessorio(k), x, y, MARCADORES.acessorio[1]);
    }
    poses[p] = folha;
  }
  return { poses, estagiario: { 3: cheia(QUADROS_POSE * POSES[3].w, POSES[3].h, '#FF5A6E') } };
}
const V: Visual = { pele: 0, cabelo: 2, cor_cabelo: 5, roupa: 3, cor_roupa: 6, acessorio: 4, cor_acessorio: 9 };
const vaga = (id: string, papel: 'dono' | 'contratado', freela?: Visual | 'estagiario', x = 0, y = 0, pose: Pose = 5): Vaga =>
  ({ id, papel, freela, x, y, pose, espelhada: false });

describe('imagem', () => {
  it('colar: transparente não pinta, espelha e corta na borda', () => {
    const src = vazia(3, 1);
    pinta(src, 0, 0, '#111111');
    pinta(src, 2, 0, '#222222');
    const d = cheia(4, 1, '#FFFFFF');
    colar(d, src, 0, 0);
    expect([cor(d, 0, 0), cor(d, 1, 0), cor(d, 2, 0)]).toEqual(['#111111', '#FFFFFF', '#222222']);
    const e = cheia(4, 1, '#FFFFFF');
    colar(e, src, 2, 0, true); // espelhado: #222222 cai em x=2 e #111111 em x=4 (fora)
    expect([cor(e, 2, 0), cor(e, 3, 0)]).toEqual(['#222222', '#FFFFFF']);
  });
  it('recortar fora da imagem dá transparente', () => {
    expect(cor(recortar(cheia(2, 2, '#FFFFFF'), 1, 1, 2, 2), 1, 1)).toBeNull();
  });
});

describe('boneco', () => {
  it('corpo, roupa, cabelo e acessório, nessa ordem, com as cores do visual', () => {
    const b = boneco(kitFalso(), V, 1, 0);
    expect([b.w, b.h]).toEqual([16, 22]);
    expect(cor(b, 0, 0)).toBe(PELES[0][1]);
    expect(cor(b, 1, 3)).toBe(CORES_CABELO[5][1]); // cabelo 2
    expect(cor(b, 2, 4)).toBe(CORES[6][1]); // roupa 3
    expect(cor(b, 3, 5)).toBe(CORES[9][1]); // acessório 4
    expect(cor(b, 1, 2)).toBeNull(); // cabelo 1 não foi escolhido
    expect(cor(b, 0, 2)).toBe(CORES[9][1]); // o acessório fica por cima de tudo
  });
  it('sem acessório a linha dele não entra; cabelo fica por cima da roupa', () => {
    const b = boneco(kitFalso(), { ...V, acessorio: 0 }, 1, 0);
    expect(cor(b, 3, 0)).toBeNull();
    expect(cor(b, 0, 2)).toBe(CORES_CABELO[5][1]);
  });
  it('quadro da pose = quadro da cena % 4', () => {
    const b = boneco(kitFalso(), V, 5, 6);
    expect(cor(b, 2, POSES[5].h - 1)).toBe(PRETO);
    expect(cor(b, 0, POSES[5].h - 1)).toBeNull();
  });
  it('naCadeira: a pose 1 em (4,2) e a cadeira por cima', () => {
    const cadeira = vazia(CADEIRA.w, CADEIRA.h);
    pinta(cadeira, CADEIRA.x, CADEIRA.y, '#8E8A96');
    const img = naCadeira(kitFalso(), cadeira, V);
    expect([img.w, img.h]).toEqual([24, 30]);
    expect(cor(img, CADEIRA.x, CADEIRA.y)).toBe('#8E8A96');
    expect(cor(img, CADEIRA.x + 1, CADEIRA.y)).toBe(CORES_CABELO[5][1]);
  });
});

describe('vagas', () => {
  it('dono na vaga de dono; contratados do mais recente pro mais antigo, na ordem do JSON; sobra = freela', () => {
    const F: Visual = { ...PADRAO, pele: 5 };
    const v: Vagas = { quadros: 8, vagas: [vaga('a', 'contratado', F), vaga('voce', 'dono'), vaga('b', 'contratado', 'estagiario'), vaga('c', 'contratado', F)] };
    const E1 = { ...PADRAO, roupa: 1 };
    const E2 = { ...PADRAO, roupa: 2 };
    expect(ocuparVagas(v, PADRAO, [E1, E2]).map((o) => [o.vaga.id, o.quem])).toEqual([
      ['a', { visual: E1 }], ['voce', { visual: PADRAO }], ['b', { visual: E2 }], ['c', { visual: F }],
    ]);
    expect(ocuparVagas(v, PADRAO, []).map((o) => o.quem)).toEqual([{ visual: F }, { visual: PADRAO }, { estagiario: true }, { visual: F }]);
    expect(ocuparVagas(v, PADRAO, [E1, E2, E1, E2]).filter((o) => o.vaga.papel === 'contratado')).toHaveLength(3);
  });
  it('trilha muda a posição por quadro; null some', () => {
    const v: Vaga = { ...vaga('voce', 'dono'), trilha: [null, { x: 5, pose: 1 }, {}] };
    expect(posicaoNoQuadro(v, 0)).toBeNull();
    expect(posicaoNoQuadro(v, 1)).toEqual({ x: 5, y: 0, pose: 1, espelhada: false });
    expect(posicaoNoQuadro(v, 2)).toEqual({ x: 0, y: 0, pose: 5, espelhada: false });
    expect(posicaoNoQuadro({ ...v, trilha: undefined }, 7)).toEqual({ x: 0, y: 0, pose: 5, espelhada: false });
  });
});

describe('montarTira', () => {
  const fundo = () => {
    const f = vazia(2 * 160, 96);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 320; x++) pinta(f, x, y, x < 160 ? '#121212' : '#222222');
    return f;
  };
  const so = (vagas: Vaga[]): Vagas => ({ quadros: 2, vagas });

  it('fundo, pessoa com as cores dela e frente por cima, quadro a quadro', () => {
    const vg = so([vaga('voce', 'dono', undefined, 10, 10)]);
    const frente = vazia(320, 96);
    pinta(frente, 160 + 10, 10, '#FFFFFF');
    const t = montarTira({ fundo: fundo(), frente, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect([t.w, t.h]).toEqual([320, 96]);
    expect(cor(t, 10, 10)).toBe(PELES[0][1]);
    expect(cor(t, 9, 10)).toBe('#121212');
    expect(cor(t, 170, 10)).toBe('#FFFFFF'); // quadro 1: a frente cobre a pessoa
    expect(cor(t, 171, 10)).toBe(CORES_CABELO[5][1]); // o resto da pessoa continua
    expect(cor(t, 10, 22)).toBe(PRETO); // quadro 0 da pose em (0, h-1)
    expect(cor(t, 171, 22)).toBe(PRETO); // quadro 1 da pose em (1, h-1)
    expect(cor(t, 170, 22)).toBe('#222222');
  });
  it('espelhada: o pixel da esquerda vai pra direita', () => {
    const vg = so([{ ...vaga('voce', 'dono', undefined, 10, 10), espelhada: true }]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect(cor(t, 10 + POSES[5].w - 1, 10)).toBe(PELES[0][1]);
    expect(cor(t, 10, 10)).toBe('#121212');
  });
  it('quem tem o pé mais baixo na tela fica na frente (não a ordem do JSON); nada vaza pro quadro do lado', () => {
    const atras = vaga('atras', 'contratado', { ...V, pele: 5 }, 20, 10); // pé em 10 + 13
    const naFrente = vaga('frente', 'contratado', { ...V, pele: 1 }, 20, 12); // pé em 12 + 13
    const borda = { ...vaga('voce', 'dono', undefined, 155, 40), espelhada: true }; // a pele cairia em x = 163
    const vg = so([naFrente, atras, borda]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect(cor(t, 20, 12)).toBe(PELES[1][1]); // o (0,0) de "frente" cobre o (0,2) de "atras"
    expect(cor(t, 163, 40)).toBe('#222222');
  });
  it('sem o kit (arte não carregou): só fundo e frente', () => {
    const vg = so([vaga('voce', 'dono', undefined, 10, 10)]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), null);
    expect(cor(t, 10, 10)).toBe('#121212');
  });
  it('estagiário oficial usa a folha dele; pose sem folha não desenha nada', () => {
    const vg = so([vaga('voce', 'dono', undefined, 0, 0), vaga('e', 'contratado', 'estagiario', 30, 10, 3), vaga('e2', 'contratado', 'estagiario', 60, 10, 4)]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect(cor(t, 30, 10)).toBe('#FF5A6E');
    expect(cor(t, 60, 10)).toBe('#121212');
  });
});

describe('validarVagas', () => {
  const ok: Vagas = {
    quadros: 8,
    vagas: [
      { id: 'voce', papel: 'dono', pose: 1, x: 60, y: 40, espelhada: false },
      { id: 'estagiario', papel: 'contratado', pose: 3, x: 20, y: 50, espelhada: true, freela: 'estagiario' },
    ],
  };
  it('JSON certo: sem erro', () => expect(validarVagas(ok, 8, 1)).toEqual([]));
  it('acusa o que quebraria a montagem', () => {
    expect(validarVagas(ok, 12, 1)).toContain('quadros 8 ≠ 12');
    expect(validarVagas(ok, 8, 3)).toContain('1 vagas de contratado (precisa de 3)');
    expect(validarVagas({ ...ok, vagas: [ok.vagas[1]] }, 8, 1)).toContain('0 vagas de dono (precisa de 1)');
    expect(validarVagas({ ...ok, vagas: [ok.vagas[0], { ...ok.vagas[1], freela: undefined }] }, 8, 1)).toContain('estagiario: vaga de contratado sem freela');
    expect(validarVagas({ ...ok, vagas: [{ ...ok.vagas[0], x: 150 }, ok.vagas[1]] }, 8, 1)).toContain('voce: fora da cena no quadro 0');
    expect(validarVagas({ ...ok, vagas: [{ ...ok.vagas[0], trilha: [null] }, ok.vagas[1]] }, 8, 1)).toContain('voce: trilha com 1 quadros');
    expect(validarVagas({ ...ok, vagas: [ok.vagas[0], { ...ok.vagas[1], freela: { ...PADRAO, pele: 9 } }] }, 8, 1)).toContain('estagiario: freela com visual inválido');
    expect(validarVagas(null, 8, 1)).toEqual(['sem lista de vagas']);
  });
});
