import { describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo, type Melhoria } from './catalogo';
import { dicaContratos, dicaGerador, dicaMelhoria, dicaOportunidade, dicaProducao, tempoDeProducao } from './dica';
import { fatores, multContratos, taxa } from './economia';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0, generators: Array(30).fill(0),
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10, promo_ate: null, viral: [],
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});
/** Estado com a taxa que o banco mandaria (a conta da página × a horta). */
const comTaxa = (x: Partial<IdleState>) => {
  const s = estado(x);
  return { ...s, rate: taxa(catalogo, s) * (1 + (s.horta_bonus?.producao ?? 0)) };
};
const textos = (d: { linhas: { texto: string }[] }) => d.linhas.map((l) => l.texto);
const gens = (pares: Record<number, number>) => {
  const g = Array(30).fill(0);
  for (const [id, n] of Object.entries(pares)) g[Number(id) - 1] = n;
  return g;
};
const melhoria = (f: (m: Melhoria) => boolean) => catalogo.melhorias.find(f)!;

describe('quanto tempo da sua produção', () => {
  it('segundos, minutos, horas e dias, curtinho', () => {
    expect(tempoDeProducao(0)).toBe('menos de 1 s');
    expect(tempoDeProducao(8.4)).toBe('8 s');
    expect(tempoDeProducao(68)).toBe('1 min 8 s');
    expect(tempoDeProducao(600)).toBe('10 min');
    expect(tempoDeProducao(3 * 3600 + 12 * 60 + 30)).toBe('3 h 12 min');
    expect(tempoDeProducao(2 * 86400 + 5 * 3600)).toBe('2 dias 5 h');
    expect(tempoDeProducao(Infinity)).toBe('muito tempo');
  });
});

describe('caixinha do gerador', () => {
  it('quanto cada um e todos rendem, a fatia da produção e o próximo em tempo de produção', () => {
    const s = comTaxa({ generators: gens({ 1: 10, 2: 10 }) });
    const f = fatores(catalogo, s);
    const cada = f.porGerador[1] * f.global;
    const d = dicaGerador(s, 2, s.rate * 120);
    expect(d.titulo).toBe(catalogo.geradores[1].nome);
    const t = textos(d);
    expect(t[0]).toMatch(/^Cada um rende \+F\$ /);
    const fatia = Math.round((10 * cada) / s.rate * 100);
    expect(t).toContain(`Os 10 rendem ${t[1].split('rendem ')[1]}`);
    expect(t[1]).toContain(`${fatia}% da sua produção`);
    expect(t.at(-1)).toMatch(/^O próximo custa F\$ .+ · 2 min da sua produção$/);
  });
  it('sem nenhum: só quanto cada um renderia e o preço', () => {
    const s = comTaxa({ generators: gens({ 1: 1 }) });
    const t = textos(dicaGerador(s, 2, 100));
    expect(t[0]).toMatch(/^Cada um rende/);
    expect(t.some((x) => x.startsWith('Os 0'))).toBe(false);
    const um = textos(dicaGerador(comTaxa({ generators: gens({ 1: 1 }) }), 1, 100));
    expect(um[1]).toMatch(/^O seu rende \+F\$ .+ · 100% da sua produção$/);
  });
  it('mostra as melhorias do gerador, as sinergias e a horta que entram nele', () => {
    const sin = melhoria((m) => m.tipo === 'sinergia') as Extract<Melhoria, { tipo: 'sinergia' }>;
    const dobra = melhoria((m) => m.tipo === 'gerador' && m.gerador === sin.alvo);
    const s = comTaxa({
      generators: gens({ [sin.alvo]: 5, [sin.fonte]: 10 }), upgrades: [dobra.id, sin.id],
      horta_bonus: { producao: 0.05, geradores: 0, melhorias: 0, oportunidades: 0 },
    });
    const t = textos(dicaGerador(s, sin.alvo, 1));
    expect(t).toContain('Melhorias: rende 2× mais');
    expect(t).toContain(`Sinergias: +${Math.round(sin.porUnidade * 10 * 100)}%`);
    expect(t).toContain('Horta: +5%');
  });
});

describe('caixinha da melhoria', () => {
  it('melhoria de gerador: dobra, quanto soma agora e o preço em tempo de produção', () => {
    const m = melhoria((x) => x.tipo === 'gerador' && x.gerador === 1);
    const s = comTaxa({ generators: gens({ 1: 4 }) });
    const d = dicaMelhoria(s, m, s.rate * 30);
    const t = textos(d);
    expect(d.titulo).toBe(m.nome);
    expect(t[0]).toBe(`"${catalogo.geradores[0].nome}" rende o dobro`);
    expect(t).toContain(`Agora: +F$ ${t.find((x) => x.startsWith('Agora'))!.split('+F$ ')[1]}`);
    expect(t.at(-1)).toBe(`Custa ${t.at(-1)!.split('Custa ')[1].split(' · ')[0]} · 30 s da sua produção`);
  });
  it('melhoria geral: a produção toda vezes o multiplicador', () => {
    const m = melhoria((x) => x.tipo === 'geral') as Extract<Melhoria, { tipo: 'geral' }>;
    const s = comTaxa({ generators: gens({ 1: 4 }) });
    const t = textos(dicaMelhoria(s, m, 1));
    expect(t[0]).toBe(`Toda a produção ×${m.mult.toLocaleString('pt-BR')}`);
  });
  it('sinergia: quanto dá hoje com o que você tem; comprada não mostra preço', () => {
    const m = melhoria((x) => x.tipo === 'sinergia') as Extract<Melhoria, { tipo: 'sinergia' }>;
    const s = comTaxa({ generators: gens({ [m.fonte]: 20, [m.alvo]: 3 }) });
    const t = textos(dicaMelhoria(s, m, null));
    const fonte = catalogo.geradores[m.fonte - 1].nome;
    const alvo = catalogo.geradores[m.alvo - 1].nome;
    expect(t[0]).toBe(`Cada "${fonte}" dá +${(m.porUnidade * 100).toLocaleString('pt-BR')}% em "${alvo}"`);
    expect(t[1]).toBe(`Com os seus 20: "${alvo}" +${Math.round(m.porUnidade * 20 * 100)}%`);
    expect(t.some((x) => x.startsWith('Custa'))).toBe(false);
  });
});

describe('caixinha da produção (o F$/s do topo)', () => {
  it('a base dos geradores e cada multiplicador; o produto bate com o total', () => {
    const geral = melhoria((x) => x.tipo === 'geral') as Extract<Melhoria, { tipo: 'geral' }>;
    const s = comTaxa({
      generators: gens({ 1: 10, 2: 3 }), upgrades: [geral.id], bonus: { arvore: [], conquistas: 4 },
      social: { contratei: 2, empregos: [] }, horta_bonus: { producao: 0.1, geradores: 0, melhorias: 0, oportunidades: 0 },
    });
    const d = dicaProducao(s, Date.parse(s.server_now));
    const t = textos(d);
    expect(d.titulo).toBe('De onde vem sua produção');
    expect(t[0]).toMatch(/^Geradores: \+F\$ /);
    expect(t).toContain(`Melhorias gerais: ×${geral.mult.toLocaleString('pt-BR')}`);
    expect(t).toContain('Conquistas e árvore: ×1,04');
    expect(t).toContain(`Contratos: ×${(Math.round(multContratos(catalogo, s) * 100) / 100).toLocaleString('pt-BR')}`);
    expect(t).toContain('Horta: ×1,1');
    expect(t.at(-1)).toMatch(/^Total: \+F\$ /);
  });
  it('Investidor e Viralizou valendo aparecem como "agora"', () => {
    const agora = Date.parse('2026-10-12T12:00:00.000Z');
    const s = comTaxa({
      generators: gens({ 1: 1 }), boost_until: '2026-10-12T12:00:40.000Z', boosts: ['2026-10-12T12:00:30.000Z', '2026-10-12T12:00:40.000Z'],
      viral: ['2026-10-12T12:00:40.000Z', '2026-10-12T12:00:50.000Z', '2026-10-12T11:59:00.000Z'],
    });
    const t = textos(dicaProducao(s, agora));
    expect(t).toContain('Agora: ×25 das oportunidades');
    expect(t).toContain('Agora: ×100 do Viralizou');
  });
});

describe('caixinha dos contratos', () => {
  it('quem você contratou e o piso de freela', () => {
    const t = textos(dicaContratos(estado({ social: { contratei: 3, empregos: [] } })));
    expect(t).toContain('Você contratou 3: +30%');
    expect(t).toContain('Ninguém te contratou: piso de freela +2%');
  });
  it('trabalhando pra outras empresas', () => {
    const t = textos(dicaContratos(estado({ social: { contratei: 0, empregos: [1, 1] } })));
    expect(t).toContain('Trabalha em 2 empresas: +4%');
  });
});

describe('caixinha da oportunidade (0062: tudo empilha)', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z');
  const fim = '2026-10-12T12:00:30.000Z';
  it('×5: sem nenhum no ar diz que empilha; com dois no ar, pegar agora deixa ×125', () => {
    expect(textos(dicaOportunidade(estado(), 1, agora)!)).toEqual(['Empilha: pegar outra com esta no ar dá ×25, e com o Viralizou multiplica de novo']);
    expect(textos(dicaOportunidade(estado({ boosts: [fim, fim] }), 1, agora)!)).toEqual(['Agora: ×25 no ar. Pegando esta, vira ×125']);
  });
  it('metade: sem nenhuma guardada diz que empilha; com uma, as próximas 2 compras', () => {
    expect(textos(dicaOportunidade(estado(), 2, agora)!)).toEqual(['Empilha: cada uma guardada vale uma compra pela metade']);
    expect(textos(dicaOportunidade(estado({ meias: 1, half_price: true }), 2, agora)!)).toEqual(['Você tem 1 guardada. Pegando esta, as próximas 2 compras saem pela metade']);
    expect(textos(dicaOportunidade(estado({ meias: 3, half_price: true }), 2, agora)!)).toEqual(['Você tem 3 guardadas. Pegando esta, as próximas 4 compras saem pela metade']);
  });
  it('os 15 minutos de produção não têm caixinha (o texto da linha já diz tudo)', () => {
    expect(dicaOportunidade(estado(), 0, agora)).toBeNull();
  });
});

