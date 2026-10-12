import { describe, expect, it } from 'vitest';

import type { BolsaEstado, HortaEstado, IdleState } from '../shared/types';
import { portaBolsa, portaConvidados, portaHorta } from './portas';

const AGORA = Date.parse('2026-10-14T18:00:00.000Z');
const gens = (pares: Record<number, number>) => { const g = Array(30).fill(0); for (const [k, v] of Object.entries(pares)) g[Number(k) - 1] = v; return g; };
const estado = (x: Partial<IdleState>): IdleState => ({ user_id: 'u', generators: gens({ 1: 1 }), ...x }) as IdleState;

describe('o resumo das portas', () => {
  it('trancadas dizem o que comprar pra abrir', () => {
    const s = estado({});
    expect(portaBolsa(s, null)).toMatchObject({ trancada: true, st: 'Compra 1 Grupo de trader pra abrir' });
    expect(portaHorta(s, null, AGORA)).toMatchObject({ trancada: true, st: 'Compra 1 Food truck pra abrir' });
    expect(portaConvidados(s, AGORA)).toMatchObject({ trancada: true, st: 'Compra 1 PPP Podcast pra abrir' });
  });
  it('Bolsa: a empresa que mais mexeu na hora e quantas são suas; pó vira selo', () => {
    const b = {
      empresas: [
        { id: 1, valor: 33, limite: 120, risco: false, rj_ate: null, historico: [30, 33] },
        { id: 3, valor: 60, limite: 120, risco: false, rj_ate: null, historico: [40, 60] },
      ],
      carteira: [{ empresa: 1, qtd: 10, custo: 300 }], viraram_po: [{ empresa: 4, qtd: 5 }],
    } as unknown as BolsaEstado;
    const r = portaBolsa(estado({ generators: gens({ 19: 1 }) }), b);
    expect(r.st).toBe('COCH +50% na hora · 1 empresa sua');
    expect(r.badge).toBe('Virou pó');
  });
  it('Horta: tamanho, bônus e coleção; o selo conta as maduras', () => {
    const h: HortaEstado = {
      lado: 2, food_trucks: 3, descobertas: [1, 2], server_now: '', bonus: { producao: 0.01, geradores: 0, melhorias: 0, oportunidades: 0 },
      plantas: [{ canteiro: 0, especie: 1, inicio: new Date(AGORA - 2 * 3600_000).toISOString(), origem: 'plantada' }],
    };
    const r = portaHorta(estado({ generators: gens({ 11: 3 }), horta_bonus: h.bonus }), h, AGORA);
    expect(r.st).toBe('2 × 2 · Produção +1% · coleção 2/8');
    expect(r.badge).toBe('1 madura');
  });
  it('Convidados: quantos sentados e as trocas; cadeira aberta vazia vira selo', () => {
    const c = { cadeira: [1, null, null], desde: ['2026-10-14T17:00:00Z', null, null], trocas: 3, trocas_t: null, ppp: 30, derrubada_ate: null };
    const r = portaConvidados(estado({ generators: gens({ 13: 30 }), convidados: c }), AGORA);
    expect(r).toEqual({ st: '1 sentado · trocas 3/3', badge: 'Cadeira vazia', trancada: false });
  });
});
