import { describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { agoraServidor, ancorar, cenaDoEstado, deveAbrirEditor, estrategiaPendente, faseDoEstado, inicioSemana, segundosOportunidade, valuationAgora, vencido } from './store';

const base = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 100, rate: 2, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  ...x,
});

describe('âncora no relógio do banco', () => {
  it('relógio do celular 1h adiantado não muda o valor', () => {
    const cliente = Date.parse('2026-10-12T13:00:00Z'); // celular errado
    const a = ancorar(base(), cliente);
    expect(agoraServidor(a, cliente + 10_000)).toBe(Date.parse('2026-10-12T12:00:10Z'));
    expect(valuationAgora(a, cliente + 10_000)).toBeCloseTo(120, 10);
  });
  it('bônus ×5 conta só até boost_until', () => {
    const a = ancorar(base({ boost_until: '2026-10-12T12:00:05.000Z' }), 0);
    expect(valuationAgora(a, 10_000)).toBeCloseTo(100 + 2 * 10 + 2 * 4 * 5, 10);
  });
  it('início da semana: segunda 00:00 de Brasília', () => {
    expect(inicioSemana(base({ week_start: '2026-10-12' }))).toBe(Date.parse('2026-10-12T03:00:00Z'));
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
