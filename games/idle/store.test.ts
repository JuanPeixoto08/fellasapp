import { describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { agoraServidor, ancorar, caixa, cenaDoEstado, deveAbrirEditor, estrategiaPendente, faseDoEstado, fatoresTempo, inicioSemana, rotuloEra, segundosOportunidade, valuationAgora, vencido } from './store';

const base = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 100, rate: 2, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10, promo_ate: null, viral: [],
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});

describe('âncora no relógio do banco', () => {
  it('relógio do celular 1h adiantado não muda o valor', () => {
    const cliente = Date.parse('2026-10-12T13:00:00Z'); // celular errado
    const a = ancorar(base(), cliente);
    expect(agoraServidor(a, cliente + 10_000)).toBe(Date.parse('2026-10-12T12:00:10Z'));
    expect(valuationAgora(a, cliente + 10_000)).toBeCloseTo(120, 10);
  });
  it('dois ×5 no ar (lista boosts da 0062) somam: ×10; sem a lista, o boost_until da página velha', () => {
    const fim = new Date(Date.parse('2026-10-12T12:00:00.000Z') + 10_000).toISOString();
    expect(valuationAgora(ancorar(base({ boosts: [fim, fim], boost_until: fim }), 0), 20_000)).toBeCloseTo(100 + 2 * (10 * 10 + 10), 6);
    expect(valuationAgora(ancorar(base({ boost_until: fim }), 0), 20_000)).toBeCloseTo(100 + 2 * (10 * 5 + 10), 6);
  });
  it('bônus ×5 conta só até boost_until', () => {
    const a = ancorar(base({ boost_until: '2026-10-12T12:00:05.000Z' }), 0);
    expect(valuationAgora(a, 10_000)).toBeCloseTo(100 + 2 * 10 + 2 * 4 * 5, 10);
  });
  it('sem teto com o jogo fechado: 20h fora rendem as 20h', () => {
    expect(valuationAgora(ancorar(base(), 0), 20 * 3600_000)).toBeCloseTo(100 + 2 * 20 * 3600, 6);
  });
  it('Viralizou dura o dobro com o Hype (nó 44)', () => {
    const viral = [new Date(Date.parse('2026-10-12T12:00:00.000Z') + 150_000).toISOString()];
    expect(valuationAgora(ancorar(base({ viral }), 0), 200_000)).toBeCloseTo(100 + 2 * (200 + 9 * 60), 6);
    expect(valuationAgora(ancorar(base({ viral, bonus: { arvore: [1, 41, 42, 43, 44], conquistas: 0 } }), 0), 200_000)).toBeCloseTo(100 + 2 * (200 + 9 * 120), 6);
  });
  it('caixinha: 3 por 4h, ou o tamanho que o ramo Oportunidades der (a validade é sempre 4h)', () => {
    expect(caixa(base())).toEqual({ tamanho: 3, validadeS: 4 * 3600 });
    expect(caixa(base({ bonus: { arvore: [1, 31, 32], conquistas: 0 } }))).toEqual({ tamanho: 4, validadeS: 4 * 3600 });
    expect(caixa(base({ bonus: { arvore: [1, 31, 32, 33, 34, 35], conquistas: 0 } }))).toEqual({ tamanho: 5, validadeS: 4 * 3600 });
  });
  it('início da semana: segunda 00:00 de Brasília', () => {
    expect(inicioSemana(base({ week_start: '2026-10-12' }))).toBe(Date.parse('2026-10-12T03:00:00Z'));
  });
});

describe('o nome da era', () => {
  it('"Era 5 · Sede"; com o gerador 30 (a cena 6) vira "Era 6 · Em órbita"; o nome curto sem o número', () => {
    expect(rotuloEra(5, false)).toBe('Era 5 · Sede');
    expect(rotuloEra(5, true)).toBe('Era 6 · Em órbita');
    expect(rotuloEra(1, false)).toBe('Era 1 · Quarto');
    expect(rotuloEra(5, true, true)).toBe('Em órbita');
    expect(rotuloEra(2, false, true)).toBe('Garagem');
  });
});

describe('editor abre sozinho', () => {
  const sem = { avatar: null };
  it('antes e jogando sem avatar; nunca abrindo, com avatar, fechado ou com rascunho; não empilha com a estratégia', () => {
    expect(deveAbrirEditor(base({ ...sem, started: false }), 'antes', false, false)).toBe(true);
    expect(deveAbrirEditor(base(sem), 'jogando', false, false)).toBe(true);
    expect(deveAbrirEditor(base(sem), 'abrindo', false, false)).toBe(false);
    expect(deveAbrirEditor(base({ avatar: { pele: 3, cabelo: 0, cor_cabelo: 0, roupa: 0, cor_roupa: 0, acessorio: 2, cor_acessorio: 8 } }), 'jogando', false, false)).toBe(false);
    expect(deveAbrirEditor(base(sem), 'jogando', true, false)).toBe(false);
    expect(deveAbrirEditor(base(sem), 'jogando', false, true)).toBe(false);
    expect(deveAbrirEditor(base({ ...sem, era: 2 }), 'jogando', false, false)).toBe(false);
  });
});

describe('fase e cena', () => {
  it('sem empresa aberta: antes; empresa aberta: jogando; abrindo continua abrindo', () => {
    expect(faseDoEstado(base({ started: false }), 'jogando')).toBe('antes');
    expect(faseDoEstado(base(), 'antes')).toBe('jogando');
    expect(faseDoEstado(base(), 'abrindo')).toBe('abrindo');
  });
  it('cena da era; foguete comprado = cena 6; antes = quarto apagado', () => {
    expect(cenaDoEstado(base({ era: 3 }), 'jogando')).toBe('cena-3');
    const g = Array(30).fill(1);
    expect(cenaDoEstado(base({ era: 5, generators: g }), 'jogando')).toBe('cena-6');
    expect(cenaDoEstado(base({ started: false }), 'antes')).toBe('cena-0-antes');
  });
  it('estratégia pendente = era ≥ 2 sem escolha', () => {
    expect(estrategiaPendente(base({ era: 1 }))).toBeNull();
    expect(estrategiaPendente(base({ era: 2 }))).toBe(2);
    expect(estrategiaPendente(base({ era: 2, strategies: [0, -1, -1, -1] }))).toBeNull();
  });
  it('Rolê eterno: oportunidade fica 30 s', () => {
    expect(segundosOportunidade(base())).toBe(10);
    expect(segundosOportunidade(base({ strategies: [0, 0, 0, 2] }))).toBe(30);
    expect(segundosOportunidade(base(), [1, 31, 32])).toBe(30); // Print de tudo
    expect(segundosOportunidade(base(), [1, 31])).toBe(10);
  });
});

describe('vencimento de contrato', () => {
  it('bate o ponto quando o relógio do servidor passa de muda_em', () => {
    expect(vencido(base(), Date.parse('2026-10-20T00:00:00Z'))).toBe(false);
    const s = base({ muda_em: '2026-10-19T12:00:00.000Z' });
    expect(vencido(s, Date.parse('2026-10-19T11:59:59Z'))).toBe(false);
    expect(vencido(s, Date.parse('2026-10-19T12:00:00Z'))).toBe(true);
  });
});

describe('fatoresTempo (0076)', () => {
  it('LinkedIn com o mult do banco e Combo ×7; ausentes (página nova, banco velho) não contam', () => {
    const s = { linkedin_ate: '2026-10-15T12:01:00Z', linkedin_mult: 4.5, combo_ate: '2026-10-15T12:00:30Z' } as IdleState;
    expect(fatoresTempo(s)).toEqual([
      { ateMs: Date.parse('2026-10-15T12:01:00Z'), mult: 4.5 }, { ateMs: Date.parse('2026-10-15T12:00:30Z'), mult: 7 },
    ]);
    expect(fatoresTempo({} as IdleState)).toEqual([]);
    expect(fatoresTempo({ linkedin_ate: null, linkedin_mult: null, combo_ate: null } as IdleState)).toEqual([]);
  });
});
