import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, ConvolverFalso, destinoFalso } from './falso';
import type { Toque } from './instrumentos';
import type { Instrumento, Nota } from './musica';
import { MOLHADO_ESPACO } from './sala';
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

describe('música em segundo plano (PC)', () => {
  it('com a janela à frente maior, agenda o giro inteiro de uma vez (o navegador quase não acorda a aba escondida)', () => {
    const c = new ContextoFalso();
    c.state = 'running';
    const tempos: number[] = [];
    const toques = Object.fromEntries(['baixo', 'escovinha', 'conducao', 'bumbo', 'caixa', 'piano', 'vibrafone', 'metais']
      .map((k) => [k, ((_c, _d, t) => tempos.push(t)) as Toque])) as Record<Instrumento, Toque>;
    const notas = (): Nota[] => [0, 32, 64, 100].map((t) => ({ inst: 'baixo', t, dur: 1, altura: 41, forca: 1 }));
    let adiante = 0.12;
    const s = criarSequenciador({ ctx: () => comoContexto(c), destino: () => destinoFalso(c) }, { notas, toques, relogio: false, adiante: () => adiante });
    s.tocar(1); // 120 bpm: as notas em 0,1 / 16,1 / 32,1 / 50,1 s
    expect(tempos).toHaveLength(1);
    adiante = 70;
    s.passo();
    expect(tempos).toHaveLength(5); // o giro todo (4) + a 1ª do giro seguinte (64,1 s)
  });
  it('parar corta o que já estava agendado (canal próprio de cada rodada)', () => {
    const c = new ContextoFalso();
    c.state = 'running';
    const s = criarSequenciador({ ctx: () => comoContexto(c), destino: () => destinoFalso(c) }, { relogio: false });
    s.tocar(1);
    const canal = c.ganhos()[0];
    expect(canal.ligados).toContain(c.destination); // o canal da rodada ligado na saída da música
    s.parar();
    expect(canal.ligados).toHaveLength(0); // desligado do destino: as notas agendadas não soam
  });
});

describe('a sala das eras 6 e 7', () => {
  const montarSala = (era: number) => {
    const c = new ContextoFalso();
    c.state = 'running';
    const s = criarSequenciador({ ctx: () => comoContexto(c), destino: () => destinoFalso(c) }, { relogio: false });
    s.tocar(era);
    return c;
  };
  const molhados = (c: ContextoFalso) => c.ganhos().filter((g) => g.gain.eventos.some(([tipo, v]) => tipo === 'alvo' && v === MOLHADO_ESPACO));
  it('o canal vai seco pro destino e manda pra sala; na era 7 o molhado é o do espaço', () => {
    const c = montarSala(7);
    expect(c.criados.some((n) => n instanceof ConvolverFalso)).toBe(true);
    const canal = c.ganhos()[0];
    expect(canal.ligados).toContain(c.destination);
    expect(canal.ligados).toHaveLength(2);
    expect(molhados(c)).toHaveLength(1);
  });
  it('no swing (era 3) o molhado fica em 0: o som de sempre', () => {
    expect(molhados(montarSala(3))).toHaveLength(0);
  });
  it('o giro da Lua acaba em 64 batidas a 60 bpm (troca de giro em 64 s)', () => {
    const c = new ContextoFalso();
    c.state = 'running';
    const giros: [number, number][] = [];
    const s = criarSequenciador({ ctx: () => comoContexto(c), destino: () => destinoFalso(c) }, {
      relogio: false, toques: {} as Record<Instrumento, Toque>, notas: (era, giro) => { giros.push([era, giro]); return []; },
    });
    s.tocar(7);
    c.currentTime = 63.9;
    s.passo();
    expect(giros).toEqual([[7, 0]]);
    c.currentTime = 64.05;
    s.passo();
    expect(giros).toEqual([[7, 0], [7, 1]]);
  });
});
