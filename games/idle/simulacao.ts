// Simulação de uma semana da Fellas Inc. para travar o ritmo (simulacao.test.ts). Jogador "esperto mas ocupado":
// primeira sessão de 1h; depois abre ao meio-dia, às 17h e à meia-noite por 10 min; em cada abertura pega até 3
// oportunidades guardadas (15 min de produção), escolhe a primeira estratégia ativa e compra, de 5 em 5 segundos,
// sempre o que tem o melhor ganho de taxa por real.
import { catalogo as padrao, type Catalogo } from './catalogo';
import { acumular, custoMult, era, liberada, podeComprarGerador, preco, SOLO, taxa, taxaPorUnidade, type Estado } from './economia';

export type Marcos = { segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null };

const H = 3600;
const DIA = 24 * H;
const PASSO = 5;

function sessoes(dias: number): [number, number][] {
  const s: [number, number][] = [[0, H]];
  for (let d = 0; d < dias; d++) for (const h of [12, 17, 24]) s.push([d * DIA + h * H, d * DIA + h * H + 10 * 60]);
  return s;
}

export function simular(cat: Catalogo = padrao, dias = 7): Marcos {
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1], social: SOLO };
  s.generators[0] = 1;
  let v = 10;
  let relogio = 0;
  const marcos: Marcos = { segundaNotebook: null, era: { 2: null, 3: null, 4: null, 5: null }, compras1h: 0, gerador30: null };
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
      const pegar = Math.min(3, 10 - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 900;
      oppHoje += pegar;
    }
    for (let t = ini; t < fim; t += PASSO) {
      avancar(t);
      comprar();
    }
  }
  return marcos;
}
