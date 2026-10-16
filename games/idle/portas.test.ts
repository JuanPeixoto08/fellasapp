import { describe, expect, it } from 'vitest';

import type { BolsaEstado, HortaEstado, IdleState, MapaEstado } from '../shared/types';
import { portaBolsa, portaConvidados, portaHorta, portaMapa } from './portas';

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
    expect(r.st).toBe('Produção +1% · coleção 2/8');
    expect(r.badge).toBe('1 madura');
  });
  it('Horta: o resumo cabe na porta (só o bônus principal, não a lista toda)', () => {
    const h: HortaEstado = {
      lado: 5, food_trucks: 124, descobertas: [1, 2, 4], server_now: '', bonus: { producao: 0.05, geradores: 0.02, melhorias: 0, oportunidades: 0.2 }, plantas: [],
    };
    expect(portaHorta(estado({ generators: gens({ 11: 124 }), horta_bonus: h.bonus }), h, AGORA).st).toBe('Produção +5% · coleção 3/8');
    const semProducao = { ...h.bonus, producao: 0 };
    expect(portaHorta(estado({ generators: gens({ 11: 124 }), horta_bonus: semProducao }), { ...h, bonus: semProducao }, AGORA).st).toBe('Geradores 2% mais baratos · coleção 3/8');
    const nada = { producao: 0, geradores: 0, melhorias: 0, oportunidades: 0 };
    expect(portaHorta(estado({ generators: gens({ 11: 124 }), horta_bonus: nada }), { ...h, bonus: nada }, AGORA).st).toBe('Nada madura ainda · coleção 3/8');
  });
  it('Convidados: quantos sentados e as trocas; cadeira aberta vazia vira selo', () => {
    const c = { cadeira: [1, null, null], desde: ['2026-10-14T17:00:00Z', null, null], trocas: 3, trocas_t: null, ppp: 30, derrubada_ate: null };
    const r = portaConvidados(estado({ generators: gens({ 13: 30 }), convidados: c }), AGORA);
    expect(r).toEqual({ st: '1 sentado · trocas 3/3', badge: 'Cadeira vazia', trancada: false });
    // com a árvore grande (0082): o máximo vem do banco
    const arv = { ...c, trocas: 5, trocas_max: 5, recarga_s: 1800 };
    expect(portaConvidados(estado({ generators: gens({ 13: 30 }), convidados: arv }), AGORA).st).toBe('1 sentado · trocas 5/5');
  });
  it('Mapa: era antes da 2 diz quando abre; sem estado, o convite; depois, quantos lugares abertos', () => {
    expect(portaMapa(estado({ era: 1 }), null)).toEqual({ st: 'Abre na era 2', badge: null, trancada: true });
    expect(portaMapa(estado({ era: 2 }), null)).toEqual({ st: 'Os lugares do rolê', badge: null, trancada: false });
    const m = (abertos: number): MapaEstado => ({ mapa: null, mult: 1, lugares: [3, 4, 7].map((id, i) => ({ id, aberto: i < abertos })) as MapaEstado['lugares'] });
    expect(portaMapa(estado({ era: 3 }), m(0)).st).toBe('Nenhum lugar aberto');
    expect(portaMapa(estado({ era: 3 }), m(1)).st).toBe('1 lugar aberto');
    expect(portaMapa(estado({ era: 3 }), m(2)).st).toBe('2 lugares abertos');
  });
  it('Mapa do rolê: quem vendeu a startup (era 1) e tem lugar aberto não vê a porta trancada', () => {
    const m = (abertos: number): MapaEstado => ({ mapa: null, mult: 1, lugares: [3, 4, 7].map((id, i) => ({ id, aberto: i < abertos })) as MapaEstado['lugares'] });
    expect(portaMapa(estado({ era: 1 }), m(1))).toEqual({ st: '1 lugar aberto', badge: null, trancada: false });
    expect(portaMapa(estado({ era: 1 }), m(0))).toEqual({ st: 'Abre na era 2', badge: null, trancada: true });
    // sem o mapa buscado ainda: o estado diz quantos (idle_json, mapa_abertos)
    expect(portaMapa(estado({ era: 1, mapa_abertos: 2 }), null)).toEqual({ st: '2 lugares abertos', badge: null, trancada: false });
    expect(portaMapa(estado({ era: 1, mapa_abertos: 0 }), null)).toEqual({ st: 'Abre na era 2', badge: null, trancada: true });
  });
});
