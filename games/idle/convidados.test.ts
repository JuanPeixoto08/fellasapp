import { describe, expect, it } from 'vitest';

import {
  CONVIDADOS, CR, custoGeradores, custoMelhorias, deltaOportunidades, derrubada, derrubadaAte, destrancada, efeitosTexto, eventoEm, faixaEm, GABE, GEMAPLYS, kojimaMult,
  LUVA, MCVV, multGerador, multProducao, peso, TOBY, tobyMult, trocasAgora, type Cadeiras,
} from './convidados';
import { tipoDourado } from './dourados';

const H = 3_600_000;
const cad = (cadeira: (number | null)[], x: Partial<Cadeiras> = {}): Cadeiras => ({
  cadeira, desde: cadeira.map((id) => (id ? '2026-10-12T00:00:00.000Z' : null)), trocas: 3, trocas_t: null, ...x,
});
const UID = '00000000-0000-0000-0000-00000000000a';

describe('o catálogo', () => {
  it('os 11 da spec, ids 1 a 11', () => {
    expect(CONVIDADOS.map((c) => c.nome)).toEqual([
      'Cristiano Ronaldo', 'Daniel Vorcaro', 'Gemaplys', 'Luva de Pedreiro', 'Hideo Kojima', 'Gabe Newell', 'Terry Crews',
      'Viniccius13', 'MC V.V', 'Toby Fox', 'VSauce',
    ]);
    expect(CONVIDADOS.map((c) => c.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
});

describe('as cadeiras', () => {
  it('abrem com 1, 25 e 50 PPP Podcasts; o peso é o da cadeira aberta', () => {
    expect([destrancada(0, 0), destrancada(0, 1), destrancada(1, 24), destrancada(1, 25), destrancada(2, 50)]).toEqual([false, true, false, true, true]);
    const c = cad([null, CR, null]);
    expect(peso(c, 24, CR)).toBe(0);
    expect(peso(c, 25, CR)).toBe(0.5);
    expect(peso(c, 25, LUVA)).toBe(0);
  });
  it('trocas: cada uma volta em 1 h, uma por vez, até 3', () => {
    const t0 = Date.parse('2026-10-12T12:00:00.000Z');
    expect(trocasAgora({ trocas: 3, trocas_t: null }, t0)).toEqual({ trocas: 3, proximaMs: null });
    const c = { trocas: 1, trocas_t: new Date(t0).toISOString() };
    expect(trocasAgora(c, t0 + 1.5 * H)).toEqual({ trocas: 2, proximaMs: t0 + 2 * H });
    expect(trocasAgora(c, t0 + 2 * H)).toEqual({ trocas: 3, proximaMs: null });
    expect(trocasAgora({ trocas: 0, trocas_t: new Date(t0).toISOString() }, t0 + 10 * 60_000)).toEqual({ trocas: 0, proximaMs: t0 + H });
  });
});

describe('os efeitos', () => {
  it('Kojima: −10% ao sentar, +40% em 24 h, em degraus de hora', () => {
    expect(kojimaMult(1, 0, 0)).toBeCloseTo(0.9, 12);
    expect(kojimaMult(1, 0, 24 * H)).toBeCloseTo(1.4, 12);
    expect(kojimaMult(1, 0, 99 * H)).toBeCloseTo(1.4, 12);
    expect(kojimaMult(0.5, 0, 12.9 * H)).toBeCloseTo(1 + 0.5 * (-0.1 + 0.25), 12);
  });
  it('Toby Fox: começa em 0, +2% por hora inteira, até +40% em 20 h', () => {
    expect(tobyMult(1, 0, 0)).toBe(1);
    expect(tobyMult(1, 0, 0.99 * H)).toBe(1);
    expect(tobyMult(1, 0, H)).toBeCloseTo(1.02, 12);
    expect(tobyMult(1, 0, 20 * H)).toBeCloseTo(1.4, 12);
    expect(tobyMult(1, 0, 99 * H)).toBeCloseTo(1.4, 12);
    expect(tobyMult(0.25, 0, 10.5 * H)).toBeCloseTo(1 + 0.25 * 0.2, 12);
  });
  it('produção: Cristiano na frente +15%, no meio +7,5%; Luva −5%; Toby no meio sobe com as horas', () => {
    const t = Date.parse('2026-10-12T18:00:00Z'); // 18 h depois de sentar
    expect(multProducao({ c: cad([CR, null, null]), ppp: 50, uid: UID }, t)).toBeCloseTo(1.15, 12);
    expect(multProducao({ c: cad([null, CR, null]), ppp: 50, uid: UID }, t)).toBeCloseTo(1.075, 12);
    expect(multProducao({ c: cad([LUVA, TOBY, null]), ppp: 50, uid: UID }, t)).toBeCloseTo(0.95 * (1 + 0.5 * 0.36), 12);
    // nenhum gerador ganha nada a mais sozinho (o Food truck da Ana acabou)
    const s = { user_id: UID, generators: Array(30).fill(0).map((_, i) => (i === 12 ? 50 : 0)), convidados: cad([TOBY, null, null]) };
    expect(multGerador(s, 11, t)).toBeCloseTo(multGerador(s, 1, t), 12);
  });
  it('custos e oportunidades: Gabe, Cristiano, Luva por cadeira', () => {
    expect(custoGeradores(cad([GABE, null, null]), 50)).toBeCloseTo(0.9, 12);
    expect(custoMelhorias(cad([null, CR, null]), 50)).toBeCloseTo(1.05, 12);
    expect(custoMelhorias(cad([TOBY, CR, null]), 50)).toBeCloseTo(1.1 * 1.05, 12);
    expect([0, 1, 2].map((i) => deltaOportunidades(cad([0, 1, 2].map((j) => (j === i ? LUVA : null))), 50))).toEqual([5, 3, 2]);
    expect([0, 1, 2].map((i) => deltaOportunidades(cad([0, 1, 2].map((j) => (j === i ? GABE : null))), 50))).toEqual([-3, -2, -1]);
  });
  it('MC V.V: a derrubada começa na faixa e dura 30 min (uma em cada ~4)', () => {
    const desde = Date.parse('2026-10-12T00:00:00Z');
    let derrubadas = 0;
    for (let k = 1; k <= 400; k++) {
      const ini = desde + k * 2 * H;
      const ate = derrubadaAte(UID, 1, desde, ini + 60_000);
      if (ate !== null) {
        derrubadas++;
        expect(ate).toBe(ini + 30 * 60_000);
        expect(derrubadaAte(UID, 1, desde, ini + 31 * 60_000)).toBeNull();
      }
    }
    expect(derrubadas).toBeGreaterThan(60);
    expect(derrubadas).toBeLessThan(140);
    expect(derrubadaAte(UID, 1, desde, desde + H)).toBeNull(); // antes da 1ª faixa
  });
});

describe('os textos', async () => {
  const { efeitosTexto, aoVivo, KOJIMA, MCVV } = await import('./convidados');
  it('por extenso e escalados pela cadeira', () => {
    expect(efeitosTexto(1, 1)).toEqual(['Produção +15%', 'Melhorias 10% mais caras']);
    expect(efeitosTexto(6, 0.5)).toEqual(['Geradores 5% mais baratos', '−2 oportunidades por dia']);
    expect(efeitosTexto(9, 0.25)).toEqual(['Uma faixa a cada 8 h: evento dourado garantido', '25% de derrubada: produção −2,5% por 30 min']);
  });
  it('ao vivo: Kojima subindo, a próxima faixa do MC V.V', () => {
    const d = Date.parse('2026-10-12T00:00:00Z');
    expect(aoVivo(KOJIMA, 1, d, UID, d + 90 * 60_000)).toBe('Agora: produção −7,9% · sobe em 30 min');
    expect(aoVivo(KOJIMA, 1, d, UID, d + 30 * H)).toBe('Agora: produção +40% (no máximo)');
    expect(aoVivo(MCVV, 1, d, UID, d + 30 * 60_000)).toBe('Próxima faixa em 1 h 30 min');
    expect(aoVivo(10, 1, d, UID, d + 150 * 60_000)).toBe('Agora: produção +4% · sobe em 30 min');
    expect(aoVivo(10, 0.5, d, UID, d + 25 * H)).toBe('Agora: produção +20% (no máximo)');
    expect(efeitosTexto(10, 1)).toEqual(['Produção sobe +2% por hora sentado, até +40%', 'Melhorias 10% mais caras; trocar ou tirar zera']);
  });
});

describe('eventos com o ramo Dourados da árvore', () => {
  const est = (arvore: number[], c?: Cadeiras) => ({ user_id: UID, generators: Array(30).fill(0), convidados: c, bonus: { arvore } });
  const contar = (s: ReturnType<typeof est>) => {
    let n = 0;
    for (let x = 1_760_000_000; x < 1_760_060_000; x++) if (eventoEm(s, x)) n++;
    return n;
  };
  it('Dia de sorte: uns 2× mais eventos; Olho de lince: 24 s na tela', () => {
    const sem = contar(est([]));
    const com = contar(est([1, 41, 42, 43, 44, 45]));
    expect(com / sem).toBeGreaterThan(1.6);
    expect(com / sem).toBeLessThan(2.4);
    const um = (s: ReturnType<typeof est>) => { for (let x = 1_760_000_000; ; x++) { const e = eventoEm(s, x); if (e) return e; } };
    expect(um(est([1, 41, 42])).janelaS).toBe(24);
    expect(um(est([])).janelaS).toBe(12);
  });
  it('com o Gemaplys na frente, metade do tempo na tela (24 vira 12)', () => {
    const s = { ...est([1, 41, 42], cad([GEMAPLYS, null, null])), generators: [...Array(12).fill(0), 1, ...Array(17).fill(0)] };
    for (let x = 1_760_000_000; ; x++) { const e = eventoEm(s, x); if (e) { expect(e.janelaS).toBe(12); break; } }
  });
  it('o texto do Gemaplys não fala mais "eram 12" (com o Olho de lince seriam 24)', () => {
    expect(efeitosTexto(GEMAPLYS, 1)[1]).toBe('Ficam 50% menos tempo na tela');
  });
});

describe('a faixa do MC V.V com a roda nova (0076)', () => {
  it('nunca dá Tigrinho: o 7 vira Investidor (0)', () => {
    const uid = '4a681416-b4ee-4976-8cdd-540cc816f28c';
    let seg = 1_760_000_000;
    while (tipoDourado(uid, seg) !== 7 || derrubada(uid, seg - 7200, 1)) seg++;
    const c = { cadeira: [MCVV, null, null], desde: [new Date((seg - 7200) * 1000).toISOString(), null, null], trocas: 3, trocas_t: null };
    expect(faixaEm(uid, c, 1, seg)).toBe(0);
  });
});
