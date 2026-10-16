// Banco da entrega 3 da Fellas Inc.: conquistas (de estado, de evento e as escondidas), com as migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { pendentes } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';

let t: TestDb;
let madrugadaReal = '';
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Estado = {
  user_id: string; week_start: string; valuation: number; rate: number; server_now: string;
  bonus: { arvore: number[]; conquistas: number }; conquistas: { id: number; em: string }[]; novas: number[]; descobertas: number[];
};

/** Troca o relógio da "3h06": os testes não dependem da hora em que rodam. */
const horaDeBrasilia = (madrugada: boolean) =>
  t.db.exec(`create or replace function public.idle_madrugada(ts timestamptz default now())
              returns boolean language sql stable as $$ select ${madrugada} $$`);

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B]) await t.member(u);
  await t.as(A);
  [{ def: madrugadaReal }] = await q<{ def: string }>(`select pg_get_functiondef('public.idle_madrugada(timestamptz)'::regprocedure) as def`);
  await horaDeBrasilia(false); // nunca é madrugada, a não ser no teste que pede
});

const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const abrirJogo = () => t.rpc<Estado>('idle_open');
const mudar = (u: string, set: string, p: unknown[] = []) => q(`update public.idle_state set ${set} where user_id = $1`, [u, ...p]);
const ids = (s: Estado) => s.conquistas.map((c) => c.id);
const pegar = (w: number) => t.rpc<Estado>('idle_claim_opportunity', { p_window: w });
const inicioSemana = (s: Estado) => Date.parse(s.week_start + 'T00:00:00-03:00');
/** A semana de A começou há 7 dias: a caixinha tem as 3 janelas mesmo na primeira meia hora de segunda. */
const semanaAnterior = (u: string) => mudar(u, 'week_start = public.games_week_start() - 7');

describe('conquistas de estado', () => {
  it('100 de um gerador e F$ 1/s: grava na hora, volta em novas uma vez só e o +1% vale dali pra frente', async () => {
    await abrir(A);
    await mudar(A, 'generators[1] = 100, settled_at = settled_at - interval \'20000 seconds\'');
    const base = 0.5 * 100 * 1.02;
    const s = await abrirJogo();
    expect(s.novas).toEqual([1, 31]);
    expect(ids(s)).toEqual([1, 31]);
    expect(s.bonus).toEqual({ arvore: [], conquistas: 2, niveis: {} });
    expect(s.rate).toBeCloseTo(base * 1.02, 9);
    expect((s.valuation - 10) / (base * 20000)).toBeCloseTo(1, 2); // as 20000 s de antes rendem sem o bônus
    const outra = await abrirJogo();
    expect(outra.novas).toEqual([]);
    expect(ids(outra)).toEqual([1, 31]);
  });
  it('contadores: 10 melhorias, a 1ª oportunidade, contratar e ser contratado', async () => {
    await abrir(A, B);
    await semanaAnterior(A);
    await mudar(A, 'upg_total = 9, valuation = 1e6');
    expect((await t.rpc<Estado>('idle_buy', { p_kind: 'melhoria', p_id: 11, p_qty: 1 })).novas).toContain(44);
    const s = await abrirJogo();
    const w = pendentes(A, Date.parse(s.server_now), [], inicioSemana(s))[0];
    expect((await pegar(w)).novas).toContain(47);
    expect((await t.rpc<Estado>('idle_hire', { p_user: B })).novas).toContain(55);
    await t.as(B);
    expect(ids(await abrirJogo())).toContain(58);
  });
  it('6-7 (exatamente 67) e Guiana Brasileira (a Filial em Portugal)', async () => {
    await abrir(A);
    await mudar(A, 'generators[2] = 66');
    expect(ids(await abrirJogo())).not.toContain(101);
    await mudar(A, 'generators[2] = 67, generators[7] = 50, upgrades = \'{283}\'');
    const s = await abrirJogo();
    expect(s.novas).toEqual(expect.arrayContaining([101, 106]));
    expect(ids(s)).not.toContain(107); // 50 estagiários não é mais o Fez o L
  });
  it('Fez o L: F$ 13 bi na mão e 130 estagiários ao mesmo tempo', async () => {
    await abrir(A);
    await mudar(A, 'generators[7] = 130, valuation = 12e9');
    expect(ids(await abrirJogo())).not.toContain(107);
    await mudar(A, 'generators[7] = 129, valuation = 13e9');
    expect(ids(await abrirJogo())).not.toContain(107);
    await mudar(A, 'generators[7] = 130, valuation = 13e9');
    expect((await abrirJogo()).novas).toContain(107);
  });
  it('a migração do Fez o L tira de quem não tem os F$ 13 bi e os 130 estagiários', async () => {
    await abrir(A, B);
    await mudar(A, 'generators[7] = 50, valuation = 1e6');
    await mudar(B, 'generators[7] = 130, valuation = 2e10');
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 107), ($2, 107)', [A, B]);
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    await t.db.exec(readFileSync(resolve(__dirname, '../../supabase/migrations/0055_fellas_inc_fez_o_l.sql'), 'utf8'));
    const donos = await q<{ u: string }>('select user_id as u from public.idle_conquistas where conquista_id = 107');
    expect(donos.map((x) => x.u)).toEqual([B]);
  });
  it('estratégias: as 3 de uma era (uma por empresa) e todas as ligadas', async () => {
    await abrir(A);
    await mudar(A, 'generators[7] = 1, est_usadas = \'{20,21}\'');
    expect((await t.rpc<Estado>('idle_pick_strategy', { p_era: 2, p_opcao: 2 })).novas).toContain(61);
    const ligadas = catalogo.estrategias.filter((e) => e.ativa).map((e) => e.era * 10 + e.opcao);
    await mudar(A, 'generators[25] = 1, strategies = \'{0,0,0,-1}\', est_usadas = $2', [ligadas.filter((c) => c !== 52)]);
    expect(ids(await abrirJogo())).not.toContain(62);
    expect((await t.rpc<Estado>('idle_pick_strategy', { p_era: 5, p_opcao: 2 })).novas).toContain(62);
  });
  it('Farmou aura: 1º no placar em F$/s; sozinho ou empatado não conta', async () => {
    await abrir(A);
    expect(ids(await abrirJogo())).not.toContain(102); // sozinho
    await abrir(B);
    expect(ids(await abrirJogo())).not.toContain(102); // empatado com B
    await mudar(A, 'generators[2] = 5');
    expect((await abrirJogo()).novas).toContain(102);
    await t.as(B);
    expect(ids(await abrirJogo())).not.toContain(102);
  });
  it('Brainrot: 3 oportunidades em menos de 1 minuto; espaçadas não', async () => {
    await abrir(A);
    await semanaAnterior(A);
    const s = await abrirJogo();
    const ws = pendentes(A, Date.parse(s.server_now), [], inicioSemana(s));
    expect(ws).toHaveLength(3);
    await mudar(A, `opp_recent = array[now() - interval '5 minutes', now() - interval '4 minutes']`);
    expect((await pegar(ws[0])).novas).not.toContain(111);
    await pegar(ws[1]);
    expect((await pegar(ws[2])).novas).toContain(111);
  });
});

describe('nada retroativo', () => {
  it('ser contratado fecha a conta do contratado antes de gravar a conquista: o passado rende sem o +1%', async () => {
    await abrir(A, B);
    await mudar(A, 'valuation = 1e9');
    await mudar(B, "settled_at = settled_at - interval '20000 seconds'");
    const [{ r }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [B]);
    await t.rpc('idle_hire', { p_user: B });
    await t.as(B);
    const s = await abrirJogo();
    expect(ids(s)).toContain(58);
    expect(s.bonus.conquistas).toBeGreaterThanOrEqual(1);
    expect((s.valuation - 10) / (r * 20000)).toBeCloseTo(1, 2);
  });
});

describe('conquistas de evento', () => {
  it('Tá saindo da jaula: Máx que leva 100 ou mais; Máx menor (54) não', async () => {
    await abrir(A);
    await mudar(A, 'valuation = 1e6');
    await t.rpc('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 10 });
    expect((await t.rpc<Estado>('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 0 })).novas).not.toContain(105); // ~54
    await mudar(A, 'valuation = 1e14');
    expect((await t.rpc<Estado>('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 0 })).novas).toContain(105);
  });
  it('3h06: só entre 3h e 4h de Brasília', async () => {
    await t.db.exec(madrugadaReal); // a função de verdade
    const hora = async (ts: string) => (await q<{ v: boolean }>('select public.idle_madrugada($1::timestamptz) as v', [ts]))[0].v;
    expect(await hora('2026-10-12 06:00:00+00')).toBe(true); // 03:00 em Brasília
    expect(await hora('2026-10-12 06:59:59+00')).toBe(true);
    expect(await hora('2026-10-12 07:00:00+00')).toBe(false);
    expect(await hora('2026-10-12 05:59:59+00')).toBe(false);
    await horaDeBrasilia(false);
    await abrir(A);
    const antes = await abrirJogo();
    expect(ids(antes)).not.toContain(108); // fora da madrugada
    // nada retroativo: ganhar a 3h06 não muda o que o trecho parado rendeu
    await mudar(A, `settled_at = settled_at - interval '20000 seconds'`);
    await horaDeBrasilia(true); // agora é 3h da manhã
    const depois = await abrirJogo();
    expect(depois.novas).toContain(108); // vale até antes do Abrir CNPJ
    expect((depois.valuation - antes.valuation) / (antes.rate * 20000)).toBeCloseTo(1, 2);
  });
});

describe('escondidas e leitura', () => {
  it('escondida que alguém tem aparece em descobertas pra todo mundo', async () => {
    await abrir(A, B);
    await mudar(A, 'generators[2] = 67');
    await abrirJogo();
    await t.as(B);
    const b = await abrirJogo();
    expect(b.descobertas).toContain(101);
    expect(ids(b)).not.toContain(101);
    expect(b.descobertas).not.toContain(103); // ninguém tem
    expect(b.descobertas).not.toContain(1); // só as escondidas
  });
  it('os textos das conquistas no jogo (nomes.ts) são os do banco depois de todas as migrações', async () => {
    type Linha = { id: number; nome: string; frase: string; condicao: string; tipo: string };
    const banco = await q<Linha>('select id, nome, frase, condicao, tipo from public.idle_cat_conquista order by id');
    const jogo = [...catalogo.conquistas].sort((x, y) => x.id - y.id).map(({ id, nome, frase, condicao, tipo }) => ({ id, nome, frase, condicao, tipo }));
    expect(jogo).toEqual(banco);
  });
  it('membro lê as conquistas dos outros; anônimo não', async () => {
    await abrir(A);
    await mudar(A, 'generators[1] = 100');
    await abrirJogo();
    await t.as(B);
    expect(await t.asRole('authenticated', 'select conquista_id from public.idle_conquistas order by 1')).toEqual([{ conquista_id: 1 }, { conquista_id: 31 }]);
    await expect(t.asRole('anon', 'select * from public.idle_conquistas')).rejects.toThrow();
    expect((await t.asRole<{ n: number }>('authenticated', 'select count(*)::int as n from public.idle_cat_conquista'))[0].n).toBe(catalogo.conquistas.length);
    expect(await q('select nome from public.idle_cat_upg where id = 283')).toEqual([{ nome: 'Filial em Portugal' }]);
  });
});

describe('conquistas da venda e da foto de segunda', () => {
  it('Aura negativa (venda de 1 ponto) e Modo sigma (sem nunca ter contratado); quem contratou não é sigma', async () => {
    await abrir(A, B);
    await t.as(B);
    await mudar(B, 'valuation = 1e9');
    await t.rpc('idle_hire', { p_user: A }); // B já contratou; A nunca
    await t.as(A);
    await mudar(A, 'generators[30] = 1, strategies = \'{0,0,0,0}\'');
    expect((await abrirJogo()).novas).not.toContain(103);
    expect((await t.rpc<Estado>('idle_prestige')).novas).toEqual(expect.arrayContaining([51, 103, 109]));
    await t.as(B);
    await mudar(B, 'generators[30] = 150, strategies = \'{0,0,0,0}\'');
    const b = await t.rpc<Estado>('idle_prestige');
    expect(b.novas).toContain(51);
    expect(b.novas).not.toContain(103);
    expect(b.novas).not.toContain(109);
  });
  it('Pai tá on: o unicórnio da foto de segunda ganha, com a conta fechada antes (sem o +1% pra trás)', async () => {
    await abrir(A, B);
    await mudar(A, 'generators[2] = 5');
    await abrirJogo();
    await q('update public.idle_state set week_start = public.games_week_start() - 7 where true');
    await mudar(A, 'valuation = 0, settled_at = now() - interval \'1 hour\'');
    const [{ r }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
    await q('select public.idle_weekly_reset()');
    expect(await q('select user_id from public.idle_conquistas where conquista_id = 110')).toEqual([{ user_id: A }]);
    const [{ valuation }] = await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [A]);
    expect(valuation / (r * 3600)).toBeCloseTo(1, 3);
  });
});
