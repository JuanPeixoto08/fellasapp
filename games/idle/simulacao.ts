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
  const s: Estado = { generators: [...ini.generators, ...Array(Math.max(0, cat.geradores.length - ini.generators.length)).fill(0)], upgrades: ini.upgrades, strategies: [-1, -1, -1, -1], social: SOLO, bonus };
  let v = ini.valuation;
  let relogio = 0;
  const marcos: Marcos = { segundaNotebook: null, era: { 2: null, 3: null, 4: null, 5: null }, compras1h: 0, gerador30: null, amostras: [] };
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
// a simulação não tem eventos dourados nem horta: os ramos Dourados e Horta não aceleram aqui
const NAO_ACELERA: readonly No['tipo'][] = [
  'contrato_preco', 'por_contratado', 'contrato_dias', 'emprego_mult', 'segundos',
  'dourado_freq', 'dourado_tela', 'dourado_investidor', 'dourado_duracao',
  'horta_amadurece', 'horta_vida', 'horta_cruza', 'horta_mult', 'morango_chance',
];

/** O jogador gasta os pontos na árvore: sempre o nó mais barato já liberado que acelera (empate: o de id menor). */
export function gastar(cat: Catalogo, pontos: number, ja: readonly number[] = []): { arvore: number[]; sobra: number } {
  const arvore = [...ja];
  let sobra = pontos;
  for (;;) {
    const opcoes = cat.arvore.filter(
      (n) => !arvore.includes(n.id) && (n.requer === null || arvore.includes(n.requer)) && !NAO_ACELERA.includes(n.tipo) && n.custo <= sobra,
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
