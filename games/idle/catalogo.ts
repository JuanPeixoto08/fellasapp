// Catálogo da Fellas Inc. montado a partir dos textos (nomes.ts) e dos parâmetros de balanceamento.
// É a fonte única: o banco recebe uma cópia gerada (0033, ver catalogoSql) e um teste trava os dois iguais.
import {
  ARVORE, CARGOS, CONQUISTAS, CONQUISTAS_GERADOR, ESTRATEGIAS, GERADORES, GERAIS, LEGADO, MELHORIAS_GERADOR, SINERGIAS, type TipoConquista,
  type TipoNo,
} from './nomes';

export type { TipoConquista, TipoNo } from './nomes';

/** Balanceamento (ajustado pela simulação, Task 2). custo_g = custoInicial·crescimentoCusto^(g-1);
 *  renda_g = custo_g / (retornoInicial·crescimentoRetorno^(g-1)) (segundos pra se pagar).
 *  Valores finais da simulação (simulacao.test.ts): 15 / 2,6 / 30 / 1,58 passaram (era 2 em 875 s, era 3 em 0,5 d,
 *  era 4 em 1 d, era 5 em 3,5 d, gerador 30 fora da semana, 484 compras na 1ª hora). */
export const PARAMETROS = { custoInicial: 15, crescimentoCusto: 2.6, retornoInicial: 30, crescimentoRetorno: 1.58 };
export type Parametros = typeof PARAMETROS;
/** O 2º trecho da curva (eras 6+, 15/10): do gerador `aPartirDe` em diante, custo_g = custoInicial·crescimentoCusto^k e
 *  renda_g = custo_g / (retornoInicial·crescimentoRetorno^k), com k = g − aPartirDe. Os geradores antes dele usam
 *  PARAMETROS e não mudam nunca (preço em produção). Calibrado na simulação (simulacao.test.ts, "ritmo das eras 6 e 7"):
 *  era 6 em 10,5 dias e era 7 em 16 dias. */
export const PARAMETROS_ESPACO = { aPartirDe: 31, custoInicial: 6e14, crescimentoCusto: 1.6, retornoInicial: 2.5e6, crescimentoRetorno: 1.45 };
export type ParametrosEspaco = typeof PARAMETROS_ESPACO;

/** Quantas unidades liberam cada nível de melhoria de gerador, e o preço (× custo base do gerador). 150/200/300 desde
 *  14/10 (eras 1–5); os preços dos três novos saíram da simulação (simulacao.test.ts). */
export const NIVEIS = [1, 10, 25, 50, 100, 150, 200, 300] as const;
export const PRECO_NIVEL = [10, 50, 500, 50_000, 5_000_000, 5e9, 5e12, 5e18] as const;
/** Preço das gerais (× custo do primeiro gerador da era), na ordem em que aparecem na era. */
export const PRECO_GERAL = [20, 40, 80, 160] as const;
/** Preço do legado (× custo do primeiro gerador da era alvo), pela era fonte (1 a 6): o mesmo dobro das gerais. */
export const PRECO_LEGADO = [20, 40, 80, 160, 320, 640] as const;
/** Sinergia: preço (× custo do alvo) e quantas unidades de cada lado pedem. */
export const PRECO_SINERGIA = 100;
export const REQUER_SINERGIA = 15;
/** Árvore de habilidades: custo em pontos de prestígio por posição no ramo (1 a 5); a raiz custa 1. */
export const CUSTO_NO = [2, 4, 8, 15, 30] as const;
export const CUSTO_RAIZ = 1;
export const RAIZ = 1;

export type Gerador = { id: number; era: number; nome: string; custo: number; renda: number };
export type Melhoria =
  | { id: number; tipo: 'gerador'; nome: string; frase: string; preco: number; gerador: number; nivel: number; requer: number }
  | { id: number; tipo: 'geral'; nome: string; frase: string; preco: number; mult: number; requerEra: number }
  | {
      id: number; tipo: 'sinergia'; nome: string; frase: string; preco: number;
      fonte: number; alvo: number; porUnidade: number; requerFonte: number; requerAlvo: number;
    }
  | {
      id: number; tipo: 'legado'; nome: string; frase: string; preco: number;
      fonteEra: number; alvoEra: number; porUnidade: number; requerEra: number;
    };
export type Estrategia = {
  era: number; opcao: number; nome: string; frase: string; ativa: boolean; requer: 'contratos' | 'lugares' | null;
  genDe: number | null; genAte: number | null; genMult: number; prodMult: number; custoMult: number;
  oppBonusMult: number; oppExtra: number; oppSegundos: number; porGeradorDistinto: number;
  sociais: Record<string, number>;
};
export type Conquista = {
  id: number; nome: string; frase: string; condicao: string; tipo: TipoConquista;
  alvo: number | null; valor: number | null; escondida: boolean;
};
/** Nó da árvore. requer = o nó anterior do ramo (a raiz, para o 1º; null na raiz). */
export type No = {
  id: number; ramo: number; posicao: number; nome: string; efeito: string; custo: number; tipo: TipoNo; valor: number;
  requer: number | null;
};
export type Catalogo = {
  geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[]; cargos: string[]; conquistas: Conquista[]; arvore: No[];
};

/** O id da conquista "ter 100" do gerador g: 1–30 = o próprio g; do 31 em diante, 140 + (g − 31) (os ids 31+ já eram das
 *  outras conquistas). */
export const idConquistaGerador = (g: number) => (g <= 30 ? g : 109 + g);

export function montarCatalogo(p: Parametros = PARAMETROS, q: ParametrosEspaco = PARAMETROS_ESPACO): Catalogo {
  const corte = q.aPartirDe - 1; // índice do 1º gerador do 2º trecho
  const geradores: Gerador[] = GERADORES.map((nome, i) => {
    if (i < corte) {
      // os de sempre: a mesma conta de antes, byte a byte (catalogo.test.ts compara com a 0075)
      const custo = p.custoInicial * p.crescimentoCusto ** i;
      return { id: i + 1, era: Math.floor(i / 6) + 1, nome, custo, renda: custo / (p.retornoInicial * p.crescimentoRetorno ** i) };
    }
    const k = i - corte;
    const custo = q.custoInicial * q.crescimentoCusto ** k;
    return { id: i + 1, era: Math.floor(i / 6) + 1, nome, custo, renda: custo / (q.retornoInicial * q.crescimentoRetorno ** k) };
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
  LEGADO.forEach((x, i) => {
    const primeiro = geradores[(x.alvoEra - 1) * 6];
    melhorias.push({
      id: 3001 + i, tipo: 'legado', nome: x.nome,
      frase: `Cada gerador da era ${x.fonteEra} que você tem dá +${(x.porUnidade * 100).toLocaleString('pt-BR')}% nos geradores da era ${x.alvoEra}.`,
      preco: primeiro.custo * PRECO_LEGADO[x.fonteEra - 1], fonteEra: x.fonteEra, alvoEra: x.alvoEra, porUnidade: x.porUnidade,
      requerEra: x.alvoEra,
    });
  });
  const estrategias: Estrategia[] = ESTRATEGIAS.map((e) => ({
    era: e.era, opcao: e.opcao, nome: e.nome, frase: e.frase, ativa: e.ativa ?? true, requer: e.requer ?? null,
    genDe: e.genDe ?? null, genAte: e.genAte ?? null, genMult: e.genMult ?? 1, prodMult: e.prodMult ?? 1,
    custoMult: e.custoMult ?? 1, oppBonusMult: e.oppBonusMult ?? 1, oppExtra: e.oppExtra ?? 0,
    oppSegundos: e.oppSegundos ?? 10, porGeradorDistinto: e.porGeradorDistinto ?? 0, sociais: e.sociais ?? {},
  }));
  const conquistas: Conquista[] = [
    ...CONQUISTAS_GERADOR.map(([nome, frase], i): Conquista => ({
      id: idConquistaGerador(i + 1), nome, frase, condicao: `Ter 100 "${geradores[i].nome}"`, tipo: 'gerador', alvo: i + 1, valor: 100,
      escondida: false,
    })),
    ...CONQUISTAS.map((c): Conquista => ({
      id: c.id, nome: c.nome, frase: c.frase, condicao: c.condicao, tipo: c.tipo, alvo: c.alvo ?? null,
      valor: c.valor ?? null, escondida: c.escondida ?? false,
    })),
  ];
  const arvore: No[] = ARVORE.map((n) => ({
    id: n.ramo * 10 + n.posicao, ramo: n.ramo, posicao: n.posicao, nome: n.nome, efeito: n.efeito,
    custo: n.ramo === 0 ? CUSTO_RAIZ : CUSTO_NO[n.posicao - 1], tipo: n.tipo, valor: n.valor,
    requer: n.ramo === 0 ? null : n.posicao === 1 ? RAIZ : n.ramo * 10 + n.posicao - 1,
  }));
  return { geradores, melhorias, estrategias, cargos: [...CARGOS], conquistas, arvore };
}

export const catalogo = montarCatalogo();

const txt = (s: string) => `'${s.replace(/'/g, "''")}'`;
const num = (n: number | null) => (n === null ? 'null' : String(n));

/** A migração de catálogo inteira (a 0033 e as seguintes). Catálogo mudou: migração NOVA (ver o cabeçalho gerado). */
export function catalogoSql(cat: Catalogo = catalogo): string {
  const gen = cat.geradores.map((g) => `  (${g.id}, ${g.era}, ${txt(g.nome)}, ${num(g.custo)}, ${num(g.renda)})`);
  const upg = cat.melhorias.map((m) => {
    const c = (k: string) => num(((m as Record<string, unknown>)[k] as number | undefined) ?? null);
    return `  (${m.id}, ${txt(m.tipo)}, ${txt(m.nome)}, ${txt(m.frase)}, ${num(m.preco)}, ${c('gerador')}, ${c('nivel')}, ${c('requer')}, ${c('mult')}, ${c('requerEra')}, ${c('fonte')}, ${c('alvo')}, ${c('porUnidade')}, ${c('requerFonte')}, ${c('requerAlvo')}, ${c('fonteEra')}, ${c('alvoEra')})`;
  });
  const est = cat.estrategias.map(
    (e) =>
      `  (${e.era}, ${e.opcao}, ${txt(e.nome)}, ${txt(e.frase)}, ${e.ativa}, ${e.requer ? txt(e.requer) : 'null'}, ${num(e.genDe)}, ${num(e.genAte)}, ${num(e.genMult)}, ${num(e.prodMult)}, ${num(e.custoMult)}, ${num(e.oppBonusMult)}, ${num(e.oppExtra)}, ${num(e.oppSegundos)}, ${num(e.porGeradorDistinto)}, ${txt(JSON.stringify(e.sociais))}::jsonb)`,
  );
  const car = cat.cargos.map((nome, i) => `  (${i + 1}, ${txt(nome)})`);
  const con = cat.conquistas.map(
    (c) =>
      `  (${c.id}, ${txt(c.nome)}, ${txt(c.frase)}, ${txt(c.condicao)}, ${txt(c.tipo)}, ${num(c.alvo)}, ${num(c.valor)}, ${c.escondida})`,
  );
  const nos = cat.arvore.map(
    (n) =>
      `  (${n.id}, ${n.ramo}, ${n.posicao}, ${txt(n.nome)}, ${txt(n.efeito)}, ${n.custo}, ${txt(n.tipo)}, ${num(n.valor)}, ${num(n.requer)})`,
  );
  const lista = (linhas: string[]) => (linhas.length ? `${linhas.join(',\n')};\n` : '');
  return `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias, estratégias, cargos, conquistas e a árvore. Idempotente.
-- GERADO por games/idle/catalogo.ts: não edite à mão. Mudou o catálogo? Crie uma migração NOVA NNNN_fellas_inc_catalogo_<nome>.sql com ATUALIZAR_CATALOGO=NNNN_fellas_inc_catalogo_<nome>.sql npx vitest run idle/catalogo.test.ts (em games/) e acrescente o arquivo em games/test/db.ts e games/dev/mockDb.ts.

create table if not exists public.idle_cat_gen (
  id int primary key, era int not null, nome text not null, custo double precision not null, renda double precision not null
);
create table if not exists public.idle_cat_upg (
  id int primary key, tipo text not null check (tipo in ('gerador', 'geral', 'sinergia', 'legado')), nome text not null, frase text not null,
  preco double precision not null, gerador int, nivel int, requer int, mult double precision, requer_era int,
  fonte int, alvo int, por_unidade double precision, requer_fonte int, requer_alvo int, fonte_era int, alvo_era int
);
create table if not exists public.idle_cat_est (
  era int not null, opcao int not null, nome text not null, frase text not null, ativa boolean not null, requer text,
  gen_de int, gen_ate int, gen_mult double precision not null, prod_mult double precision not null,
  custo_mult double precision not null, opp_bonus_mult double precision not null, opp_extra int not null,
  opp_segundos int not null, por_gerador_distinto double precision not null, sociais jsonb not null,
  primary key (era, opcao)
);
create table if not exists public.idle_cat_cargo (id int primary key, nome text not null);
create table if not exists public.idle_cat_conquista (
  id int primary key, nome text not null, frase text not null, condicao text not null, tipo text not null,
  alvo int, valor double precision, escondida boolean not null
);
create table if not exists public.idle_cat_no (
  id int primary key, ramo int not null, posicao int not null, nome text not null, efeito text not null, custo int not null,
  tipo text not null, valor double precision not null, requer int
);
-- legado (0077): banco que já tinha a tabela ganha as colunas e o tipo novo (o create acima não roda de novo)
alter table public.idle_cat_upg add column if not exists fonte_era int, add column if not exists alvo_era int;
alter table public.idle_cat_upg drop constraint if exists idle_cat_upg_tipo_check;
alter table public.idle_cat_upg add constraint idle_cat_upg_tipo_check check (tipo in ('gerador', 'geral', 'sinergia', 'legado'));

alter table public.idle_cat_gen enable row level security;
alter table public.idle_cat_upg enable row level security;
alter table public.idle_cat_est enable row level security;
alter table public.idle_cat_cargo enable row level security;
alter table public.idle_cat_conquista enable row level security;
alter table public.idle_cat_no enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo, public.idle_cat_conquista, public.idle_cat_no from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo, public.idle_cat_conquista, public.idle_cat_no to authenticated;
drop policy if exists "idle_cat_gen_select_members" on public.idle_cat_gen;
create policy "idle_cat_gen_select_members" on public.idle_cat_gen for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_upg_select_members" on public.idle_cat_upg;
create policy "idle_cat_upg_select_members" on public.idle_cat_upg for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_est_select_members" on public.idle_cat_est;
create policy "idle_cat_est_select_members" on public.idle_cat_est for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_cargo_select_members" on public.idle_cat_cargo;
create policy "idle_cat_cargo_select_members" on public.idle_cat_cargo for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_conquista_select_members" on public.idle_cat_conquista;
create policy "idle_cat_conquista_select_members" on public.idle_cat_conquista for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_no_select_members" on public.idle_cat_no;
create policy "idle_cat_no_select_members" on public.idle_cat_no for select to authenticated using (public.is_member());

delete from public.idle_cat_gen where true;
delete from public.idle_cat_upg where true;
delete from public.idle_cat_est where true;
delete from public.idle_cat_cargo where true;
delete from public.idle_cat_conquista where true;
delete from public.idle_cat_no where true;

insert into public.idle_cat_gen (id, era, nome, custo, renda) values
${lista(gen)}
insert into public.idle_cat_upg (id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade, requer_fonte, requer_alvo, fonte_era, alvo_era) values
${lista(upg)}
insert into public.idle_cat_est (era, opcao, nome, frase, ativa, requer, gen_de, gen_ate, gen_mult, prod_mult, custo_mult, opp_bonus_mult, opp_extra, opp_segundos, por_gerador_distinto, sociais) values
${lista(est)}
insert into public.idle_cat_cargo (id, nome) values
${lista(car)}
insert into public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, escondida) values
${lista(con)}
insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer) values
${lista(nos)}`;
}
