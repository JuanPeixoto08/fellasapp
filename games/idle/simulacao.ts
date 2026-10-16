// Simulação de uma semana da Fellas Inc. para travar o ritmo (simulacao.test.ts). Jogador "esperto mas ocupado":
// primeira sessão de 1h; depois abre ao meio-dia, às 17h e à meia-noite por 10 min; em cada abertura pega até 3
// oportunidades guardadas (15 min de produção), escolhe a primeira estratégia ativa e compra, de 5 em 5 segundos,
// sempre o que tem o melhor ganho de taxa por real.
import { catalogo as padrao, type Catalogo, type No } from './catalogo';
import { LIMITE_DIA } from './oportunidades';
import {
  abertura, acumular, custoMult, efeitosArvore, era, liberada, podeComprarGerador, pontosTotais, preco, SEM_BONUS, SOLO, taxa,
  taxaPorUnidade, type Bonus, type Estado,
} from './economia';

/** No fim de cada sessão (t em segundos de jogo): F$/s, era e as melhorias gerais que a empresa tem. */
export type Amostra = { t: number; taxa: number; era: number; gerais: number[] };
export type Marcos = {
  segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null;
  amostras: Amostra[];
};

const H = 3600;
const DIA = 24 * H;
const PASSO = 5;

function sessoes(dias: number): [number, number][] {
  const s: [number, number][] = [[0, H]];
  for (let d = 0; d < dias; d++) for (const h of [12, 17, 24]) s.push([d * DIA + h * H, d * DIA + h * H + 10 * 60]);
  return s;
}

/** `bonus`: os nós da árvore e as conquistas de quem já vendeu; `gerais`: as melhorias gerais que a venda manteve;
 * `minutosOpp`: quanto vale cada oportunidade pega (15 min de produção até a entrega 5; ver valorMedio.ts). */
export function simular(cat: Catalogo = padrao, dias = 7, bonus: Bonus = SEM_BONUS, gerais: number[] = [], minutosOpp = 15): Marcos {
  const ef = efeitosArvore(cat, bonus.arvore);
  const ini = abertura(cat, ef, gerais);
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: [...ini.generators, ...Array(Math.max(0, cat.geradores.length - ini.generators.length)).fill(0)], upgrades: ini.upgrades, strategies: [-1, -1, -1, -1, -1, -1], social: SOLO, bonus };
  let v = ini.valuation;
  let relogio = 0;
  const marcos: Marcos = { segundaNotebook: null, era: { 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }, compras1h: 0, gerador30: null, amostras: [] };
  let oppHoje = 0;
  let dia = 0;

  const avancar = (ate: number) => {
    v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null);
    relogio = ate;
  };
  const comprar = () => {
    for (let i = 0; i < 40; i++) {
      const e = era(cat, s.generators);
      if (e >= 2 && s.strategies[e - 2] < 0) {
        s.strategies[e - 2] = cat.estrategias.find((x) => x.era === e && x.ativa)!.opcao;
      }
      const cm = custoMult(cat, s);
      const base = taxa(cat, s);
      let melhor: { score: number; preco: number; aplicar: () => void } | null = null;
      for (const g of cat.geradores) {
        if (!podeComprarGerador(s, g.id)) continue;
        const p = preco(g.custo, s.generators[g.id - 1], 1, cm);
        if (p > v) continue;
        const score = taxaPorUnidade(cat, s, g.id) / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.generators[g.id - 1]++ };
      }
      for (const m of cat.melhorias) {
        if (s.upgrades.includes(m.id) || !liberada(cat, m, s)) continue;
        const p = m.preco * cm;
        if (p > v) continue;
        s.upgrades.push(m.id);
        const ganho = taxa(cat, s) - base;
        s.upgrades.pop();
        const score = ganho / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.upgrades.push(m.id) };
      }
      if (!melhor) return;
      v -= melhor.preco;
      melhor.aplicar();
      if (relogio <= H) marcos.compras1h++;
      if (marcos.segundaNotebook === null && s.generators[0] >= 2) marcos.segundaNotebook = relogio;
      const agora = era(cat, s.generators);
      for (let k = 2; k <= agora; k++) if (marcos.era[k] === null) marcos.era[k] = relogio;
      if (marcos.gerador30 === null && s.generators[29] > 0) marcos.gerador30 = relogio;
    }
  };

  for (const [ini, fim] of sessoes(dias)) {
    avancar(ini);
    const d = Math.floor(ini / DIA);
    if (d !== dia) { dia = d; oppHoje = 0; }
    if (ini > 0) {
      const pegar = Math.min(ef.caixinha, LIMITE_DIA + ef.oppExtra - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 60 * minutosOpp * ef.oppBonus;
      oppHoje += pegar;
    }
    for (let t = ini; t < fim; t += PASSO) {
      avancar(t);
      comprar();
    }
    const gerais = s.upgrades.filter((id) => cat.melhorias.find((m) => m.id === id)?.tipo === 'geral');
    marcos.amostras.push({ t: fim, taxa: taxa(cat, s), era: era(cat, s.generators), gerais });
  }
  return marcos;
}

/** A primeira vez (fim de sessão) em que vender a startup rende pelo menos `minimo` pontos. */
export function primeiraVenda(m: Marcos, minimo: number): Amostra | null {
  return m.amostras.find((a) => pontosTotais(a.taxa) >= minimo) ?? null;
}

// o que não acelera o jogador sozinho da simulação: o ramo Gente (ninguém o contrata) e o tempo das oportunidades na cena
// (é só o tempo na tela: o limite dele é a caixinha). A simulação ESCOLHE a Viralizar
// na era 3, mas a conta em TS não aplica oppExtra/oppBonusMult de estratégia (só os dos nós da árvore); o banco aplica.
// a simulação não tem eventos dourados nem horta: os ramos Dourados e Horta não aceleram aqui; nem os minigames e os
// eventos de era da árvore grande (Bolsa, PPP, Mapa, Lixo, Silver tape)
const NAO_ACELERA: readonly No['tipo'][] = [
  'contrato_preco', 'por_contratado', 'contrato_dias', 'emprego_mult', 'segundos',
  'dourado_freq', 'dourado_tela', 'dourado_investidor', 'dourado_duracao',
  'horta_amadurece', 'horta_vida', 'horta_cruza', 'horta_mult', 'morango_chance',
  'opp_fs', 'contrato_desconto', 'horta_soma',
  'bolsa_corretagem', 'bolsa_limite', 'bolsa_limite_mult', 'bolsa_limite_soma', 'bolsa_espiadas', 'bolsa_escritorio',
  'conv_recarga', 'conv_trocas', 'conv_cadeira2', 'conv_cadeira3', 'conv_queda', 'conv_efeito',
  'mapa_abrir', 'mapa_nivel', 'marcos_mult', 'marcos_soma', 'tee_publico', 'tee_tempo', 'copao_mult',
  'lixo_min', 'silver_min', 'silver_mult', 'era_freq', 'era_janela',
];

/** Os portões que o jogador da simulação passa: quantas vezes vendeu e a maior era alcançada. */
export type Portoes = { vendas: number; eraMax: number };

/** O jogador gasta os pontos na árvore: sempre o nó fixo mais barato que ele pode comprar (o que pede comprado, portões
 *  passados) e que acelera (com `todos`, qualquer um); empate: o de id menor. Nunca um infinito. */
export function gastar(
  cat: Catalogo, pontos: number, ja: readonly number[] = [], portoes: Portoes = { vendas: 0, eraMax: 1 }, todos = false,
): { arvore: number[]; sobra: number } {
  const arvore = [...ja];
  let sobra = pontos;
  for (;;) {
    const opcoes = cat.arvore.filter(
      (n) => !arvore.includes(n.id) && n.cresce === null
        && (n.requer === null || arvore.includes(n.requer)) && (n.requer2 === null || arvore.includes(n.requer2))
        && (n.reqVendas === null || portoes.vendas >= n.reqVendas) && (n.reqEra === null || portoes.eraMax >= n.reqEra)
        && (todos || !NAO_ACELERA.includes(n.tipo)) && n.custo <= sobra,
    );
    if (!opcoes.length) return { arvore, sobra };
    const n = opcoes.reduce((a, b) => (b.custo < a.custo || (b.custo === a.custo && b.id < a.id) ? b : a));
    arvore.push(n.id);
    sobra -= n.custo;
  }
}

/** O jogador que vende: joga até a venda valer `pontos`, vende, gasta tudo na árvore (`gastar`) e recomeça (sem contar
 *  as conquistas, que só ajudariam). Quanto tempo levou pra chegar na era em que estava da primeira vez e depois de
 *  vender (Infinity = não chegou em `dias`). null = a venda nunca chegou a `pontos`. */
export function volta(
  cat: Catalogo = padrao, pontos = 10, dias = 14,
): { era: number; primeira: number; segunda: number; arvore: number[]; gastos: number } | null {
  const m1 = simular(cat, dias);
  const venda = primeiraVenda(m1, pontos);
  if (!venda || venda.era < 2) return null;
  const ganhos = pontosTotais(venda.taxa);
  const { arvore, sobra } = gastar(cat, ganhos);
  const m2 = simular(cat, dias, { arvore, conquistas: 0 }, venda.gerais);
  return { era: venda.era, primeira: m1.era[venda.era]!, segunda: m2.era[venda.era] ?? Infinity, arvore, gastos: ganhos - sobra };
}

/** Régua das 12 eras (spec das eras 6–7, seção 7): o dia em que o jogador da simulação chega em cada era. As 6 e 7 saem
 *  do catálogo e simulacao.test.ts trava; da 8 em diante é o alvo das próximas entregas (ainda sem catálogo). A spec pede
 *  "8–9 dias por era" e "era 12 no dia 52": do dia 16 ao 52 dá ~7 por era, e a 12 dura 8 (até o dia 60). */
export const RITMO_ERAS: Readonly<Record<number, number>> = { 6: 10, 7: 16, 8: 24, 9: 31, 10: 38, 11: 45, 12: 52 };
export const FIM_ERA_12 = 60;

/** O retrato de um jogador copiado do banco (só leitura, sem identificação; games/test/fixtures). */
export type FixtureVeterano = {
  rate: number; era: number; era_max: number; generators: number[]; upgrades: number[]; strategies: number[];
  prestige_earned: number; prestige_spent: number; prestige_count: number; nos: number[]; conquistas: number;
};
export type OpcoesVeterano = {
  /** quanto vale cada oportunidade (min de produção; com Horta e Bolsa, ver valorMedio.ts) */ minutosOpp: number;
  /** passo das compras (s): 30 deixa o teste em ~1 min; 5 é o da simulação de quem começa */ passo?: number;
  /** vende quando a venda dá esta fração a mais de pontos (ou paga o próximo nó fixo, o que vier antes) */ frac?: number;
  /** quantos dias cada empresa joga, no máximo, antes de vender do jeito que está */ maxDiasEmpresa?: number;
  /** até quando olhar (dias) */ dias?: number;
};

/** Uma empresa do zero com a árvore `bonus` (3 aberturas de 10 min por dia depois da 1ª hora, como simular), até
 *  `parar(taxa × extra)` no fim de uma abertura ou `maxDias`. Escolhe a 1ª estratégia ativa de cada era que chega (a
 *  abertura com as eras 1 a 4 já pede três). Devolve quando parou, a taxa × extra, a era e as gerais. */
function empresaAte(
  cat: Catalogo, bonus: Bonus, gerais: number[], extra: number, o: Required<OpcoesVeterano>, parar: (taxaReal: number) => boolean,
): { t: number; taxa: number; era: number; gerais: number[] } {
  const ef = efeitosArvore(cat, bonus.arvore, bonus.niveis);
  const ini = abertura(cat, ef, gerais);
  const s: Estado = { generators: ini.generators, upgrades: ini.upgrades, strategies: [-1, -1, -1, -1, -1, -1], social: SOLO, bonus };
  let v = ini.valuation;
  let relogio = 0;
  let oppHoje = 0;
  let dia = 0;
  const avancar = (ate: number) => {
    v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null);
    relogio = ate;
  };
  const comprar = () => {
    for (let i = 0; i < 60; i++) {
      const e = era(cat, s.generators);
      for (let k = 2; k <= e; k++) {
        if (s.strategies[k - 2] < 0) s.strategies[k - 2] = cat.estrategias.find((x) => x.era === k && x.ativa)!.opcao;
      }
      const cm = custoMult(cat, s);
      const base = taxa(cat, s);
      let melhor: { score: number; preco: number; aplicar: () => void } | null = null;
      for (const g of cat.geradores) {
        if (!podeComprarGerador(s, g.id)) continue;
        const p = preco(g.custo, s.generators[g.id - 1], 1, cm);
        if (p > v) continue;
        const score = taxaPorUnidade(cat, s, g.id) / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.generators[g.id - 1]++ };
      }
      for (const m of cat.melhorias) {
        if (s.upgrades.includes(m.id) || !liberada(cat, m, s)) continue;
        const p = m.preco * cm;
        if (p > v) continue;
        s.upgrades.push(m.id);
        const ganho = taxa(cat, s) - base;
        s.upgrades.pop();
        const score = ganho / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.upgrades.push(m.id) };
      }
      if (!melhor) return;
      v -= melhor.preco;
      melhor.aplicar();
    }
  };
  const fimDe = () => ({
    taxa: taxa(cat, s) * extra, era: era(cat, s.generators),
    gerais: s.upgrades.filter((id) => cat.melhorias.find((m) => m.id === id)?.tipo === 'geral'),
  });
  const ses = sessoes(o.maxDiasEmpresa);
  for (const [ini0, fim] of ses) {
    avancar(ini0);
    const d = Math.floor(ini0 / DIA);
    if (d !== dia) { dia = d; oppHoje = 0; }
    if (ini0 > 0) {
      const pegar = Math.min(ef.caixinha, LIMITE_DIA + ef.oppExtra - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 60 * o.minutosOpp * ef.oppBonus;
      oppHoje += pegar;
    }
    for (let t = ini0; t < fim; t += o.passo) {
      avancar(t);
      comprar();
    }
    if (parar(taxa(cat, s) * extra)) return { t: fim, ...fimDe() };
  }
  return { t: ses[ses.length - 1][1], ...fimDe() };
}

/**
 * O veterano da árvore grande: vende agora (o F$/s do retrato), gasta no nó fixo mais barato que pode (todos os tipos;
 * gastar com `todos`), recomeça e vende de novo no fim da abertura em que a venda dá `frac` a mais de pontos ou paga o
 * próximo nó fixo liberado (o que vier antes; se a empresa não chega em `maxDiasEmpresa`, vende do jeito que está). A
 * taxa do modelo × `extra` (= F$/s real ÷ F$/s do modelo no retrato: contratos, convidados, Mapa, Horta) é o que vale
 * nos pontos. `dia` = quando a parte fixa fechou (null = não fechou em `dias`); `multCheio` = quanto a árvore fixa
 * cheia multiplica a produção do retrato (contra a árvore de hoje cheia).
 */
export function veterano(fix: FixtureVeterano, cat: Catalogo = padrao, opcoes: OpcoesVeterano): {
  dia: number | null; vendas: number; multCheio: number; extra: number; log: string[];
  /** fração do custo da parte fixa NOVA (nós fixos acima do 65) já comprada na última conta */ comprado: number;
  /** quando parou de crescer (dia da última compra de nó fixo; igual a `dia` se fechou) */ diaTrava: number;
} {
  const o: Required<OpcoesVeterano> = { passo: 30, frac: 0.3, maxDiasEmpresa: 15, dias: 60, ...opcoes };
  const retrato = (arvore: number[]): Estado => ({
    generators: fix.generators, upgrades: fix.upgrades, strategies: fix.strategies, social: SOLO, bonus: { arvore, conquistas: fix.conquistas },
  });
  const extra = fix.rate / taxa(cat, retrato(fix.nos));
  const hoje = cat.arvore.filter((n) => n.id <= 65).map((n) => n.id);
  const novos = cat.arvore.filter((n) => n.id > 65 && n.cresce === null);
  const custoNovos = novos.reduce((a, n) => a + n.custo, 0);
  const pct = (arv: number[]) => novos.filter((n) => arv.includes(n.id)).reduce((a, n) => a + n.custo, 0) / custoNovos;
  let diaTrava = 0;
  let ultimo = fix.nos.length;
  const fixos = cat.arvore.filter((n) => n.cresce === null).map((n) => n.id);
  const multCheio = taxa(cat, retrato(fixos)) / taxa(cat, retrato(hoje));
  let ganhos = pontosTotais(fix.rate);
  let gastos = fix.prestige_spent;
  let vendas = fix.prestige_count + 1;
  let eraMax = fix.era_max;
  let arvore = [...fix.nos];
  let gerais: number[] = [];
  let t = 0;
  const log = [`dia 0: vende, total ${ganhos}`];
  for (let volta = 0; volta < 60 && t < o.dias * DIA; volta++) {
    const g = gastar(cat, ganhos - gastos, arvore, { vendas, eraMax }, true);
    gastos += ganhos - gastos - g.sobra;
    arvore = g.arvore;
    if (arvore.length > ultimo) { ultimo = arvore.length; diaTrava = t / DIA; }
    const faltam = cat.arvore.filter((n) => n.cresce === null && !arvore.includes(n.id));
    log.push(`dia ${(t / DIA).toFixed(1)}: vendas ${vendas}, ganhos ${ganhos}, livres ${ganhos - gastos}, faltam ${faltam.length}`);
    if (!faltam.length) return { dia: t / DIA, vendas, multCheio, extra, log, comprado: pct(arvore), diaTrava: t / DIA };
    const liberados = faltam.filter((n) => (n.requer === null || arvore.includes(n.requer)) && (n.requer2 === null || arvore.includes(n.requer2))
      && (n.reqVendas === null || vendas >= n.reqVendas) && (n.reqEra === null || eraMax >= n.reqEra));
    const precisa = liberados.length ? Math.min(...liberados.map((n) => n.custo)) - (ganhos - gastos) : Infinity;
    const meta = Math.max(ganhos + 1, Math.min(ganhos * (1 + o.frac), ganhos + precisa));
    const r = empresaAte(cat, { arvore, conquistas: fix.conquistas }, gerais, extra, o, (x) => pontosTotais(x) >= meta);
    if (pontosTotais(r.taxa) <= ganhos) {
      log.push('travou: a venda não dá ponto');
      return { dia: null, vendas, multCheio, extra, log, comprado: pct(arvore), diaTrava };
    }
    t += r.t;
    log.push('empresa terminou no dia ' + (t / DIA).toFixed(2) + ' com ' + pontosTotais(r.taxa));
    eraMax = Math.max(eraMax, r.era);
    ganhos = pontosTotais(r.taxa);
    vendas++;
    gerais = r.gerais;
  }
  return { dia: null, vendas, multCheio, extra, log, comprado: pct(arvore), diaTrava };
}
