import { describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo, type Melhoria } from './catalogo';
import {
  dicaContratos, dicaDesafio, dicaEventoEra, dicaGerador, dicaMarco, dicaMelhoria, dicaNivel, dicaOportunidade, dicaPino, dicaProducao, dicaTeeCor, dicaTeeEstilo, dicaTeeFoco,
  dicaTeeLote, dicaTeePeca, dicaTeeRelatorio, dicaTeeTema, dicaTeeTrancados, tempoDeProducao,
} from './dica';
import { caderno } from './camisetaria';
import { MARCOS } from './mapa';
import type { LugarEstado } from '../shared/types';
import { fatores, multContratos, taxa } from './economia';
import { formatarValor } from './formatar';

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
  it('mostra o Mapa do rolê (que já multiplica o gerador) quando tem marco', () => {
    const s = comTaxa({ generators: gens({ 1: 3 }), mapa_mult: 1.07 });
    expect(textos(dicaGerador(s, 1, 1))).toContain('Mapa do rolê: ×1,07');
    expect(textos(dicaGerador(comTaxa({ generators: gens({ 1: 3 }) }), 1, 1)).some((x) => x.startsWith('Mapa do rolê'))).toBe(false);
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
    expect(t).toContain('Agora: ×10 das oportunidades');
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

describe('caixinhas do Mapa do rolê', () => {
  it('dica do pino fechado: preço, horas e o que falta', () => {
    const p = { id: 3, faixa: 'barato', lote: 1, lancado: true, horas: 2, era: 2, moeda: 'cupom', numero: 'pct', preco: 12_300_000,
      nome: null, frase: null, icone: null, x: null, y: null, aberto: false, nivel: null, moeda_qtd: null, fas: null, dono: null } as const;
    expect(dicaPino(p, 20_000_000, 2)).toBe('Abre por F$ 12,3 mi (2 h da sua produção).');
    expect(dicaPino(p, 1_000_000, 1)).toContain('Precisa da era 2.');
    expect(dicaPino(p, 1_000_000, 2)).toContain('Falta F$ 11,3 mi.');
  });
  it('dica do desafio por prêmio', () => {
    expect(dicaDesafio({ id: 1, texto: 'x', premio: 'horas', premio_valor: 2, feito: false })).toBe('Prêmio: 2 h da sua produção em F$.');
    expect(dicaDesafio({ id: 1, texto: 'x', premio: 'legado', premio_valor: 3, feito: true })).toBe('Prêmio: 3 pontos do Legado. Já fez esta semana.');
    // o Investidor diz quanto paga agora (ganhoInvestidor: com o Investidor anjo e a horta); sem o número, só o nome
    expect(dicaDesafio({ id: 1, texto: 'x', premio: 'investidor', premio_valor: 1, feito: false }, 2400))
      .toBe('Prêmio: um Investidor na hora, F$ 2,4 mil agora.');
    expect(dicaDesafio({ id: 1, texto: 'x', premio: 'investidor', premio_valor: 1, feito: false })).toBe('Prêmio: um Investidor na hora.');
    expect(dicaDesafio({ id: 1, texto: 'x', premio: 'legado', premio_valor: 1, feito: false })).toBe('Prêmio: 1 ponto do Legado.');
  });
  const lugar = (x: Partial<LugarEstado> = {}): LugarEstado => ({
    id: 3, moeda_nome: 'cupom', numero: 'pct', lancado: true, nome: null, frase: null, icone: null,
    aberto: true, nivel: 3, moeda: 50, fas: 10, volume: 2, lendario: false, marcos: [], preco_nivel: 240,
    desafio: null, podio: [], semana: [], dono: null, caderninho: [], mecanica: null, server_now: '2026-10-12T12:00:00Z', ...x,
  });
  const marco = (id: number) => MARCOS.find((m) => m.id === id)!;
  it('dica do marco: bônus, o que precisa e onde a pessoa está; ganho diz que já ganhou', () => {
    expect(dicaMarco(marco(31), lugar())).toBe('+2% de produção na empresa. Nível 5 (você está no 3).');
    expect(dicaMarco(marco(31), lugar({ marcos: [31] }))).toBe('+2% de produção na empresa. Nível 5. Já ganhou.');
    expect(dicaMarco(marco(36), lugar())).toBe('+3% de produção na empresa. Um resultado lendário neste lugar.');
    expect(dicaMarco(marco(37), lugar())).toBe('+3% de produção na empresa. 115.000 fãs (você tem 10).');
    expect(dicaMarco(marco(38), lugar())).toBe('+2% de produção na empresa. 50 coleções (você fez 2).');
  });
  it('dica do nível: de quanto pra quanto, o preço na moeda do lugar e o que libera', () => {
    expect(dicaNivel(lugar({ nivel: 4 }), ['Tema praia', 'Peça regata'])).toBe('Nível 4 → 5 por 240 cupons. Rende mais e libera: Tema praia, Peça regata.');
    expect(dicaNivel(lugar({ nivel: 4 }), [])).toBe('Nível 4 → 5 por 240 cupons. Rende mais.');
    expect(dicaNivel(lugar({ nivel: 25, preco_nivel: null }), [])).toBe('Nível 25: o máximo.');
  });
});

describe('caixinhas da camisetaria (bancada e caderninho)', () => {
  const cad = caderno([
    { tipo: 'combo', a: 2, b: 1, rotulo: 4 }, { tipo: 'combo', a: 1, b: 1, rotulo: 1 },
    { tipo: 'peca', a: 1, b: 2, rotulo: 2 }, { tipo: 'peca', a: 2, b: 2, rotulo: 0 }, { tipo: 'peca', a: 1, b: 1, rotulo: 1 },
    { tipo: 'foco', a: 1, b: 0, rotulo: 352 },
  ]);
  it('tema: o que o caderninho sabe com o estilo escolhido; nunca testado = "Ainda não testou"; em alta; trancado', () => {
    expect(dicaTeeTema(2, 1, 1, cad, 30)).toBe('Com Minimalista: Combinação ótima!');
    expect(dicaTeeTema(1, 1, 1, cad, 30)).toBe('Com Minimalista: Combinação ruim.');
    expect(dicaTeeTema(3, 1, 1, cad, 30)).toBe('Ainda não testou com Minimalista.');
    expect(dicaTeeTema(3, 1, 1, cad, 3)).toBe('Ainda não testou com Minimalista. Em alta esta semana: a nota sobe.');
    expect(dicaTeeTema(7, 1, 1, cad, 30)).toBe('Libera no nível 2.');
  });
  it('estilo: com o tema escolhido e o foco ideal se tem relatório', () => {
    expect(dicaTeeEstilo(1, 2, 1, cad)).toBe('Com Praia: Combinação ótima! Foco ideal: Arte 3 · Tecido 5 · Divulgação 2.');
    expect(dicaTeeEstilo(2, 2, 1, cad)).toBe('Ainda não testou com Praia. Foco ideal: só com o relatório.');
    expect(dicaTeeEstilo(4, 2, 1, cad)).toBe('Libera no nível 2.');
  });
  it('peça: custo, preço de venda e se combina com o tema escolhido', () => {
    expect(dicaTeePeca(1, 2, 1, cad)).toBe('Custa 3 cupons e vende por 19,5. Com Praia: combina.');
    expect(dicaTeePeca(2, 2, 1, cad)).toBe('Custa 2 cupons e vende por 13. Com Praia: não combina.');
    expect(dicaTeePeca(1, 1, 1, cad)).toBe('Custa 3 cupons e vende por 19,5. Com Meme: nem ajuda nem atrapalha.');
    expect(dicaTeePeca(2, 1, 1, cad)).toBe('Custa 2 cupons e vende por 13. Ainda não testou com Meme.');
    expect(dicaTeePeca(3, 1, 1, cad)).toBe('Libera no nível 4.');
  });
  it('cor: forte ou discreta; trancada', () => {
    expect(dicaTeeCor(3, 1)).toBe('Cor forte: o @SuperMauro64 curte.');
    expect(dicaTeeCor(1, 1)).toBe('Cor discreta.');
    expect(dicaTeeCor(5, 1)).toBe('Libera no nível 3.');
  });
  it('foco: o ideal do estilo se tem relatório; senão, segredo', () => {
    expect(dicaTeeFoco(1, cad)).toBe('O ideal do Minimalista: Arte 3 · Tecido 5 · Divulgação 2. Quanto mais longe dele, menor a nota.');
    expect(dicaTeeFoco(2, cad)).toBe('O ideal do Rabisco de caneta é segredo. Depois de lançar um, o relatório do caderninho mostra.');
  });
  it('lote: peças, custo, tempo e quanto rende esgotando', () => {
    expect(dicaTeeLote(1, 1, 0)).toBe('12 peças por 36 cupons. Fica pronto em 2 min e vende em 30 min a 19,5 cupons a peça: esgotando, rende 234.');
    expect(dicaTeeLote(1, 1, 2)).toBe('84 peças por 252 cupons. Fica pronto em 10 min e vende em 30 min a 19,5 cupons a peça: esgotando, rende 1.638.');
  });
  it('o cadeado do grupo: o próximo, o nível e quantos ainda faltam', () => {
    expect(dicaTeeTrancados('tema', 1)).toBe('Próximo: Signo, no nível 2. Depois mais 23 temas até o nível 25.');
    expect(dicaTeeTrancados('peca', 13)).toBe('Próximo: Moletom, no nível 19.');
    expect(dicaTeeTrancados('estilo', 23)).toBe('Próximo: Gótico, no nível 24. Depois mais 1 estilo até o nível 25.');
    expect(dicaTeeTrancados('cor', 25)).toBe('');
    // o tema da semana ainda trancado entra no cadeado dos temas
    expect(dicaTeeTrancados('tema', 1, 9)).toBe('Próximo: Signo, no nível 2. Depois mais 23 temas até o nível 25. Em alta esta semana: Crise financeira (libera no nível 4).');
    expect(dicaTeeTrancados('tema', 1, 2)).toBe('Próximo: Signo, no nível 2. Depois mais 23 temas até o nível 25.');
    expect(dicaTeeTrancados('estilo', 1, 9)).toBe(dicaTeeTrancados('estilo', 1));
  });
  it('relatório: o que mostra, o preço e quanto falta', () => {
    expect(dicaTeeRelatorio(4, 50, 80)).toBe('Mostra pra sempre o foco ideal do Grafite. Custa 50 cupons.');
    expect(dicaTeeRelatorio(4, 67.5, 30)).toBe('Mostra pra sempre o foco ideal do Grafite. Custa 68 cupons. Faltam 38.');
  });
});

describe('caixinha da oportunidade (0062: tudo empilha)', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z');
  const fim = '2026-10-12T12:00:30.000Z';
  it('×5: sem nenhum no ar diz que soma; com dois no ar, pegar agora deixa ×15', () => {
    expect(textos(dicaOportunidade(estado(), 1, agora)!)).toEqual(['Soma: pegar outra com esta no ar dá ×10, e o Viralizou multiplica por cima']);
    expect(textos(dicaOportunidade(estado({ boosts: [fim, fim] }), 1, agora)!)).toEqual(['Agora: ×10 no ar. Pegando esta, vira ×15']);
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

describe('caixinha da oportunidade com "rendem o dobro" (Viralizar / Xepa: conta como 2 pegas)', () => {
  const agora = Date.parse('2026-10-12T12:00:00.000Z');
  const g = Array(30).fill(0);
  g[12] = 1;
  const viralizar = (x: Partial<IdleState> = {}) => estado({ era: 3, generators: g, strategies: [0, 0, -1, -1], ...x });
  it('×5: conta como 2 de uma vez (×10); com um no ar, pegar vira ×15', () => {
    expect(textos(dicaOportunidade(viralizar(), 1, agora)!)).toEqual(['Rendem o dobro: conta como 2 de uma vez (×10)']);
    expect(textos(dicaOportunidade(viralizar({ boosts: ['2026-10-12T12:00:30.000Z'] }), 1, agora)!)).toEqual(['Agora: ×5 no ar. Pegando esta, vira ×15']);
  });
  it('metade: guarda 2 de uma vez; com 1 guardada, as próximas 3', () => {
    expect(textos(dicaOportunidade(viralizar(), 2, agora)!)).toEqual(['Rendem o dobro: guarda 2 compras pela metade de uma vez']);
    expect(textos(dicaOportunidade(viralizar({ meias: 1, half_price: true }), 2, agora)!)).toEqual(['Você tem 1 guardada. Pegando esta, as próximas 3 compras saem pela metade']);
  });
});

describe('caixinha dos eventos de era', () => {
  it('dicaEventoEra diz o que dá agora, em números', () => {
    expect(dicaEventoEra(3, 1000).linhas[0].texto).toBe(`Dá ${formatarValor(1_800_000)} agora`);
    expect(dicaEventoEra(5, 1000).linhas[0].texto).toBe(`Cada gol: ${formatarValor(300_000)} (até 7)`);
    expect(dicaEventoEra(1, 1000).linhas[0].texto).toBe('Produção ×3 por 3 min');
  });
});
