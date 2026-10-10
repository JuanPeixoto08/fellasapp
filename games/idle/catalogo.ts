// Catálogo da Fellas Inc. montado a partir dos textos (nomes.ts) e dos parâmetros de balanceamento.
// É a fonte única: o banco recebe uma cópia gerada (0033, ver catalogoSql) e um teste trava os dois iguais.
import { ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS } from './nomes';

/** Balanceamento (ajustado pela simulação, Task 2). custo_g = custoInicial·crescimentoCusto^(g-1);
 *  renda_g = custo_g / (retornoInicial·crescimentoRetorno^(g-1)) (segundos pra se pagar). */
export const PARAMETROS = { custoInicial: 15, crescimentoCusto: 3.2, retornoInicial: 30, crescimentoRetorno: 1.18 };
export type Parametros = typeof PARAMETROS;

/** Quantas unidades liberam cada nível de melhoria de gerador, e o preço (× custo base do gerador). */
export const NIVEIS = [1, 10, 25, 50, 100] as const;
export const PRECO_NIVEL = [10, 50, 500, 50_000, 5_000_000] as const;
/** Preço das gerais (× custo do primeiro gerador da era), na ordem em que aparecem na era. */
export const PRECO_GERAL = [20, 40, 80, 160] as const;
/** Sinergia: preço (× custo do alvo) e quantas unidades de cada lado pedem. */
export const PRECO_SINERGIA = 100;
export const REQUER_SINERGIA = 15;

export type Gerador = { id: number; era: number; nome: string; custo: number; renda: number };
export type Melhoria =
  | { id: number; tipo: 'gerador'; nome: string; frase: string; preco: number; gerador: number; nivel: number; requer: number }
  | { id: number; tipo: 'geral'; nome: string; frase: string; preco: number; mult: number; requerEra: number }
  | {
      id: number; tipo: 'sinergia'; nome: string; frase: string; preco: number;
      fonte: number; alvo: number; porUnidade: number; requerFonte: number; requerAlvo: number;
    };
export type Estrategia = {
  era: number; opcao: number; nome: string; frase: string; ativa: boolean; requer: 'contratos' | 'propriedades' | null;
  genDe: number | null; genAte: number | null; genMult: number; prodMult: number; custoMult: number;
  oppBonusMult: number; oppExtra: number; oppSegundos: number; porGeradorDistinto: number;
  sociais: Record<string, number>;
};
export type Catalogo = { geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[] };

export function montarCatalogo(p: Parametros = PARAMETROS): Catalogo {
  const geradores: Gerador[] = GERADORES.map((nome, i) => {
    const custo = p.custoInicial * p.crescimentoCusto ** i;
    return { id: i + 1, era: Math.floor(i / 6) + 1, nome, custo, renda: custo / (p.retornoInicial * p.crescimentoRetorno ** i) };
  });
  const melhorias: Melhoria[] = [];
  geradores.forEach((g) =>
    MELHORIAS_GERADOR[g.id - 1].forEach((nome, k) =>
      melhorias.push({
        id: g.id * 10 + k + 1, tipo: 'gerador', nome, frase: `Dobra o que "${g.nome}" rende.`,
        preco: g.custo * PRECO_NIVEL[k], gerador: g.id, nivel: k + 1, requer: NIVEIS[k],
      }),
    ),
  );
  GERAIS.forEach((x, i) => {
    const primeiro = geradores[(x.era - 1) * 6];
    const ordem = GERAIS.slice(0, i).filter((y) => y.era === x.era).length;
    melhorias.push({
      id: 1001 + i, tipo: 'geral', nome: x.nome, frase: `${x.frase} Produção +${Math.round((x.mult - 1) * 100)}%.`,
      preco: primeiro.custo * PRECO_GERAL[ordem], mult: x.mult, requerEra: x.era,
    });
  });
  SINERGIAS.forEach((x, i) => {
    const especial = x.fonte === 1 && x.alvo === 30;
    melhorias.push({
      id: 2001 + i, tipo: 'sinergia', nome: x.nome,
      frase: `Cada "${geradores[x.fonte - 1].nome}" dá +${x.porUnidade * 100}% em "${geradores[x.alvo - 1].nome}".`,
      preco: geradores[x.alvo - 1].custo * PRECO_SINERGIA, fonte: x.fonte, alvo: x.alvo, porUnidade: x.porUnidade,
      requerFonte: especial ? 100 : REQUER_SINERGIA, requerAlvo: especial ? 1 : REQUER_SINERGIA,
    });
  });
  const estrategias: Estrategia[] = ESTRATEGIAS.map((e) => ({
    era: e.era, opcao: e.opcao, nome: e.nome, frase: e.frase, ativa: e.ativa ?? true, requer: e.requer ?? null,
    genDe: e.genDe ?? null, genAte: e.genAte ?? null, genMult: e.genMult ?? 1, prodMult: e.prodMult ?? 1,
    custoMult: e.custoMult ?? 1, oppBonusMult: e.oppBonusMult ?? 1, oppExtra: e.oppExtra ?? 0,
    oppSegundos: e.oppSegundos ?? 10, porGeradorDistinto: e.porGeradorDistinto ?? 0, sociais: e.sociais ?? {},
  }));
  return { geradores, melhorias, estrategias };
}

export const catalogo = montarCatalogo();
