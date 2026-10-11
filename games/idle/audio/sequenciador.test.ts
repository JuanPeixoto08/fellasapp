import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, destinoFalso } from './falso';
import type { Toque } from './instrumentos';
import type { Instrumento, Nota } from './musica';
import { criarSequenciador } from './sequenciador';

function montar(comCtx = true) {
  const c = new ContextoFalso();
  c.state = 'running';
  const tocadas: { inst: string; t: number }[] = [];
  const nomes: Instrumento[] = ['baixo', 'escovinha', 'conducao', 'bumbo', 'caixa', 'piano', 'vibrafone', 'metais'];
  const toques = Object.fromEntries(nomes.map((k) => [k, ((_c, _d, t) => tocadas.push({ inst: k, t })) as Toque])) as Record<Instrumento, Toque>;
  const giros: [number, number][] = [];
  const notas = (era: number, giro: number): Nota[] => {
    giros.push([era, giro]);
    return [{ inst: 'baixo', t: 0, dur: 1, altura: 41, forca: 1 }, { inst: 'baixo', t: 64, dur: 1, altura: 41, forca: 1 }];
  };
  const s = criarSequenciador({ ctx: () => (comCtx ? comoContexto(c) : null), destino: () => destinoFalso(c) }, { notas, toques, relogio: false });
  return { c, s, tocadas, giros };
}

describe('sequenciador', () => {
  it('agenda só o que cai na janela à frente (no relógio do áudio)', () => {
    const { c, s, tocadas } = montar();
    c.currentTime = 10;
    s.tocar(1); // 120 bpm: 0,5 s por batida; começa 0,1 s à frente
    expect(tocadas).toEqual([{ inst: 'baixo', t: 10.1 }]);
    c.currentTime = 42.05;
    s.passo();
    expect(tocadas).toHaveLength(2);
    expect(tocadas[1].t).toBeCloseTo(42.1);
  });
  it('troca de era só no fim do giro, alternando tema (0) e solo (1)', () => {
    const { c, s, giros } = montar();
    s.tocar(1);
    s.mudarEra(3);
    c.currentTime = 50;
    s.passo();
    expect(giros).toEqual([[1, 0]]);
    c.currentTime = 64.05;
    s.passo();
    expect(giros).toEqual([[1, 0], [3, 1]]);
  });
  it('tocar de novo com a música já tocando só marca a era nova (não reinicia)', () => {
    const { s, giros } = montar();
    s.tocar(1);
    s.tocar(4);
    expect(giros).toEqual([[1, 0]]);
    expect(s.tocando()).toBe(true);
  });
  it('depois de um engasgo não despeja as notas atrasadas de uma vez', () => {
    const { c, s, tocadas } = montar();
    s.tocar(1);
    c.currentTime = 40; // a nota de 32,1 s passou faz 7,9 s
    s.passo();
    expect(tocadas).toHaveLength(1);
  });
  it('parado não agenda nada; sem contexto nem começa', () => {
    const a = montar();
    a.s.tocar(1);
    a.s.parar();
    a.c.currentTime = 32.05;
    a.s.passo();
    expect(a.tocadas).toHaveLength(1);
    const b = montar(false);
    b.s.tocar(1);
    expect(b.s.tocando()).toBe(false);
    expect(b.tocadas).toHaveLength(0);
  });
});
