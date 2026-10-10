// Catálogo da Fellas Inc. montado a partir dos textos (nomes.ts) e dos parâmetros de balanceamento.
// É a fonte única: o banco recebe uma cópia gerada (0033, ver catalogoSql) e um teste trava os dois iguais.
import { ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS } from './nomes';

/** Balanceamento (ajustado pela simulação, Task 2). custo_g = custoInicial·crescimentoCusto^(g-1);
 *  renda_g = custo_g / (retornoInicial·crescimentoRetorno^(g-1)) (segundos pra se pagar).
 *  Valores finais da simulação (simulacao.test.ts): 15 / 2,6 / 30 / 1,58 passaram (era 2 em 875 s, era 3 em 0,5 d,
 *  era 4 em 1 d, era 5 em 3,5 d, gerador 30 fora da semana, 484 compras na 1ª hora). */
export const PARAMETROS = { custoInicial: 15, crescimentoCusto: 2.6, retornoInicial: 30, crescimentoRetorno: 1.58 };
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
      frase: `Cada "${geradores[x.fonte - 1].nome}" dá +${(x.porUnidade * 100).toLocaleString('pt-BR')}% em "${geradores[x.alvo - 1].nome}".`,
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

const txt = (s: string) => `'${s.replace(/'/g, "''")}'`;
const num = (n: number | null) => (n === null ? 'null' : String(n));

/** A migração 0033 inteira. Regerar: ATUALIZAR_CATALOGO=1 npx vitest run idle/catalogo.test.ts (em games/). */
export function catalogoSql(cat: Catalogo = catalogo): string {
  const gen = cat.geradores.map((g) => `  (${g.id}, ${g.era}, ${txt(g.nome)}, ${num(g.custo)}, ${num(g.renda)})`);
  const upg = cat.melhorias.map((m) => {
    const c = (k: string) => num(((m as Record<string, unknown>)[k] as number | undefined) ?? null);
    return `  (${m.id}, ${txt(m.tipo)}, ${txt(m.nome)}, ${txt(m.frase)}, ${num(m.preco)}, ${c('gerador')}, ${c('nivel')}, ${c('requer')}, ${c('mult')}, ${c('requerEra')}, ${c('fonte')}, ${c('alvo')}, ${c('porUnidade')}, ${c('requerFonte')}, ${c('requerAlvo')})`;
  });
  const est = cat.estrategias.map(
    (e) =>
      `  (${e.era}, ${e.opcao}, ${txt(e.nome)}, ${txt(e.frase)}, ${e.ativa}, ${e.requer ? txt(e.requer) : 'null'}, ${num(e.genDe)}, ${num(e.genAte)}, ${num(e.genMult)}, ${num(e.prodMult)}, ${num(e.custoMult)}, ${num(e.oppBonusMult)}, ${num(e.oppExtra)}, ${num(e.oppSegundos)}, ${num(e.porGeradorDistinto)}, ${txt(JSON.stringify(e.sociais))}::jsonb)`,
  );
  const lista = (linhas: string[]) => (linhas.length ? `${linhas.join(',\n')};\n` : '');
  return `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias e estratégias. Idempotente.
-- GERADO por games/idle/catalogo.ts: não edite à mão. Regerar: ATUALIZAR_CATALOGO=1 npx vitest run idle/catalogo.test.ts (em games/).

create table if not exists public.idle_cat_gen (
  id int primary key, era int not null, nome text not null, custo double precision not null, renda double precision not null
);
create table if not exists public.idle_cat_upg (
  id int primary key, tipo text not null check (tipo in ('gerador', 'geral', 'sinergia')), nome text not null, frase text not null,
  preco double precision not null, gerador int, nivel int, requer int, mult double precision, requer_era int,
  fonte int, alvo int, por_unidade double precision, requer_fonte int, requer_alvo int
);
create table if not exists public.idle_cat_est (
  era int not null, opcao int not null, nome text not null, frase text not null, ativa boolean not null, requer text,
  gen_de int, gen_ate int, gen_mult double precision not null, prod_mult double precision not null,
  custo_mult double precision not null, opp_bonus_mult double precision not null, opp_extra int not null,
  opp_segundos int not null, por_gerador_distinto double precision not null, sociais jsonb not null,
  primary key (era, opcao)
);

alter table public.idle_cat_gen enable row level security;
alter table public.idle_cat_upg enable row level security;
alter table public.idle_cat_est enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est to authenticated;
drop policy if exists "idle_cat_gen_select_members" on public.idle_cat_gen;
create policy "idle_cat_gen_select_members" on public.idle_cat_gen for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_upg_select_members" on public.idle_cat_upg;
create policy "idle_cat_upg_select_members" on public.idle_cat_upg for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_est_select_members" on public.idle_cat_est;
create policy "idle_cat_est_select_members" on public.idle_cat_est for select to authenticated using (public.is_member());

delete from public.idle_cat_gen where true;
delete from public.idle_cat_upg where true;
delete from public.idle_cat_est where true;

insert into public.idle_cat_gen (id, era, nome, custo, renda) values
${lista(gen)}
insert into public.idle_cat_upg (id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade, requer_fonte, requer_alvo) values
${lista(upg)}
insert into public.idle_cat_est (era, opcao, nome, frase, ativa, requer, gen_de, gen_ate, gen_mult, prod_mult, custo_mult, opp_bonus_mult, opp_extra, opp_segundos, por_gerador_distinto, sociais) values
${lista(est)}`;
}
