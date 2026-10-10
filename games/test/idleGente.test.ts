// Banco da entrega 2 da Fellas Inc. (personagem, contratos de 7 dias, placar, foto de segunda), com as migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { CAMPOS, FAIXAS, PADRAO } from '../idle/personagem';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Visual = Record<string, number | null>;
type Estado = {
  user_id: string; started: boolean; valuation: number; rate: number; era: number; strategies: number[];
  avatar: Visual | null; equipe: { user_id: string; cargo: string; avatar: Visual | null; ate: string }[];
  chefes: { user_id: string; cargo: string; mult: number; ate: string }[]; social: { contratei: number; empregos: number[] };
  hire_price: number; muda_em: string | null; server_now: string;
};

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B, C]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

/** Abre a empresa de cada um (como ele) e volta a ser A. */
const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const dar = (u: string, v: number) => q('update public.idle_state set valuation = $2 where user_id = $1', [u, v]);
/** Para o relógio de u: a conta não depende dos milissegundos entre as chamadas. */
const parar = (u: string) => q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [u]);
const recuar = (u: string, s: number) =>
  q('update public.idle_state set settled_at = settled_at - make_interval(secs => $2) where user_id = $1', [u, s]);
const salvar = (v: Visual) =>
  t.rpc<Estado>('idle_set_avatar', {
    p_pele: v.pele, p_cabelo: v.cabelo, p_cor_cabelo: v.cor_cabelo, p_roupa: v.roupa, p_cor_roupa: v.cor_roupa,
    p_acessorio: v.acessorio, p_cor_acessorio: v.cor_acessorio,
  });
const V: Visual = { pele: 1, cabelo: 2, cor_cabelo: 3, roupa: 1, cor_roupa: 4, acessorio: 3, cor_acessorio: 5 };

describe('personagem', () => {
  it('sem visual salvo: avatar nulo', async () => {
    expect((await t.rpc<Estado>('idle_open')).avatar).toBeNull();
  });
  it('salva o próprio visual, antes do Abrir CNPJ também, e ele volta no estado', async () => {
    const s = await salvar(V);
    expect(s.avatar).toEqual(V);
    expect(s.started).toBe(false);
    expect((await salvar({ ...V, pele: 5 })).avatar).toEqual({ ...V, pele: 5 });
    expect((await t.rpc<Estado>('idle_open')).avatar).toEqual({ ...V, pele: 5 });
  });
  it('as faixas são as do personagem.ts: o último vale; o seguinte, negativo ou nulo é idle_bad_avatar', async () => {
    for (const c of CAMPOS) {
      await salvar({ ...PADRAO, [c]: FAIXAS[c] - 1 });
      await expect(salvar({ ...PADRAO, [c]: FAIXAS[c] }), c).rejects.toThrow(/idle_bad_avatar/);
      await expect(salvar({ ...PADRAO, [c]: -1 }), c).rejects.toThrow(/idle_bad_avatar/);
      await expect(salvar({ ...PADRAO, [c]: null }), c).rejects.toThrow(/idle_bad_avatar/);
    }
  });
  it('a tabela também recusa fora da faixa (check)', async () => {
    await expect(
      q(`insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
         values ($1, 6, 0, 0, 0, 0, 0, 0)`, [B]),
    ).rejects.toThrow();
  });
  it('ninguém escreve direto na tabela (nem no próprio)', async () => {
    await salvar(V);
    await expect(t.asRole('authenticated', `update public.idle_avatar set pele = 0 where user_id = '${A}'`)).rejects.toThrow();
    await expect(
      t.asRole('authenticated', `insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
                                 values ('${B}', 0, 0, 0, 0, 0, 0, 0)`),
    ).rejects.toThrow();
  });
  it('membro lê o visual dos outros; anônimo não; não membro é barrado', async () => {
    await salvar(V);
    await t.as(B);
    expect(await t.asRole('authenticated', 'select pele from public.idle_avatar')).toEqual([{ pele: 1 }]);
    await expect(t.asRole('anon', 'select * from public.idle_avatar')).rejects.toThrow();
    await t.as(OUT);
    await expect(salvar(V)).rejects.toThrow(/not_member/);
  });
  it('salvar o visual fecha a conta (o número não volta no tempo)', async () => {
    await t.rpc('idle_start');
    await recuar(A, 100);
    const s = await salvar(V);
    expect(s.valuation).toBeCloseTo(10 + s.rate * 100, 0);
  });
});

const contratar = (u: string | null) => t.rpc<Estado>('idle_hire', { p_user: u });
const valuationDe = async (u: string) =>
  (await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [u]))[0].valuation;
/** Joga os contratos pro passado: criados há `dias` dias + `horas` horas (vencem 7 dias depois de criados). */
const envelhecerContratos = (dias: number, horas = 0) =>
  q(`update public.idle_contracts
        set created_at = created_at - make_interval(days => $1, hours => $2),
            ends_at = ends_at - make_interval(days => $1, hours => $2)
      where true`, [dias, horas]);

describe('contratar', () => {
  beforeEach(async () => {
    await abrir(A, B);
  });

  it('paga 30 min da própria produção; quem contrata ganha +10%, o contratado troca o piso por um emprego', async () => {
    await dar(A, 10_000);
    await parar(A);
    const antes = await t.rpc<Estado>('idle_open');
    expect(antes.rate).toBeCloseTo(0.5 * 1.02, 10);
    expect(antes.hire_price).toBeCloseTo(antes.rate * 1800, 6);
    expect(antes.muda_em).toBeNull();
    const s = await contratar(B);
    expect(s.valuation).toBeCloseTo(10_000 - antes.rate * 1800, 6);
    expect(s.rate).toBeCloseTo(0.5 * (1 + 0.1 + 0.02), 10);
    expect(s.equipe).toHaveLength(1);
    expect(s.equipe[0]).toMatchObject({ user_id: B, avatar: null });
    expect(catalogo.cargos).toContain(s.equipe[0].cargo);
    // vence em 7 dias, e é esse o próximo momento em que a taxa muda sozinha
    expect(Date.parse(s.equipe[0].ate) - Date.parse(s.server_now)).toBeCloseTo(7 * 86400_000, -4);
    expect(s.muda_em).toBe(s.equipe[0].ate);
    await t.as(B);
    const b = await t.rpc<Estado>('idle_open');
    expect(b.chefes).toEqual([{ user_id: A, cargo: s.equipe[0].cargo, mult: 1, ate: s.equipe[0].ate }]);
    expect(b.muda_em).toBe(s.equipe[0].ate);
    expect(b.rate).toBeCloseTo(0.5 * 1.02, 10);
  });
  it('cada contrato ativo deixa o próximo 1,5× mais caro (sobre a produção da hora)', async () => {
    await abrir(C);
    await dar(A, 1e6);
    await parar(A);
    const s1 = await contratar(B);
    expect(s1.hire_price).toBeCloseTo(s1.rate * 1800 * 1.5, 6);
    const s2 = await contratar(C);
    expect(s2.valuation).toBeCloseTo(s1.valuation - s1.hire_price, 6);
    expect(s2.hire_price).toBeCloseTo(s2.rate * 1800 * 1.5 ** 2, 6);
  });
  it('Abrir capital: contratar custa o dobro', async () => {
    await q(`update public.idle_state set generators[13] = 1, generators[19] = 1, strategies = '{0,0,0,-1}' where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.hire_price).toBeCloseTo(s.rate * 1800 * 2, 6);
  });
  it('toque duplo: a segunda vez é idle_hire_twice e cobra uma vez só', async () => {
    // em produção a serialização vem da trava de linha do idle_lock/idle_lock_all: a segunda chamada espera a primeira
    await dar(A, 1e6);
    await parar(A);
    const s = await contratar(B);
    await expect(contratar(B)).rejects.toThrow(/idle_hire_twice/);
    expect(await valuationDe(A)).toBeCloseTo(s.valuation, 6);
    expect(await q('select employee_id from public.idle_contracts')).toEqual([{ employee_id: B }]);
  });
  it('contrato vence em 7 dias: sai da conta, o preço volta e dá pra contratar de novo', async () => {
    await dar(A, 1e6);
    await contratar(B);
    await envelhecerContratos(7);
    const s = await t.rpc<Estado>('idle_open');
    expect(s).toMatchObject({ equipe: [], social: { contratei: 0, empregos: [] }, muda_em: null });
    expect(s.rate).toBeCloseTo(0.5 * 1.02, 10);
    expect(s.hire_price).toBeCloseTo(s.rate * 1800, 6);
    expect((await contratar(B)).equipe.map((e) => e.user_id)).toEqual([B]);
    expect(await q('select count(*)::int as n from public.idle_contracts')).toEqual([{ n: 2 }]); // o vencido fica
  });
  it('vencimento com o jogo fechado: até ele rende com o bônus, depois sem (quem contratou)', async () => {
    await dar(A, 1e6);
    await contratar(B);
    // criado há 7 dias e 2 horas: venceu há 2 horas; A ficou 3 horas sem abrir
    await envelhecerContratos(7, 2);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '3 hours' where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation).toBeCloseTo(0.5 * 1.12 * 3600 + 0.5 * 1.02 * 7200, 0);
  });
  it('vencimento com o jogo fechado: o contratado também (chefe com Cultura de startup paga o triplo até vencer)', async () => {
    await q(`update public.idle_state set generators[13] = 1, generators[19] = 1, strategies = '{0,0,2,-1}', valuation = 1e12 where user_id = $1`, [A]);
    await contratar(B);
    await envelhecerContratos(7, 2);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '3 hours' where user_id = $1`, [B]);
    await t.as(B);
    const b = await t.rpc<Estado>('idle_open');
    expect(b.valuation).toBeCloseTo(0.5 * 1.06 * 3600 + 0.5 * 1.02 * 7200, 0);
    expect(b.chefes).toEqual([]);
  });
  it('não contrata a si mesmo, quem não abriu a empresa, quem não é membro nem ninguém', async () => {
    await dar(A, 1e6);
    await expect(contratar(A)).rejects.toThrow(/idle_hire_self/);
    await expect(contratar(C)).rejects.toThrow(/idle_hire_not_open/);
    await expect(contratar(OUT)).rejects.toThrow(/idle_hire_not_open/);
    await expect(contratar('00000000-0000-0000-0000-000000000123')).rejects.toThrow(/idle_hire_not_open/);
    await expect(contratar(null)).rejects.toThrow(/idle_hire_not_open/);
    expect(await q('select * from public.idle_contracts')).toEqual([]);
  });
  it('sem a própria empresa aberta, sem valuation ou com estratégia pendente: não contrata', async () => {
    await t.as(C);
    await expect(contratar(B)).rejects.toThrow(/idle_not_started/);
    await t.as(A);
    await dar(A, 0);
    await parar(A);
    await expect(contratar(B)).rejects.toThrow(/idle_cant_afford/);
    await q('update public.idle_state set generators[7] = 1, valuation = 1e9 where user_id = $1', [A]);
    await expect(contratar(B)).rejects.toThrow(/idle_strategy_pending/);
    expect(await q('select * from public.idle_contracts')).toEqual([]);
  });
  it('contratar de volta vale (A→B e depois B→A)', async () => {
    await dar(A, 1e6);
    await dar(B, 1e6);
    await contratar(B);
    await t.as(B);
    const b = await contratar(A);
    expect(b.equipe.map((e) => e.user_id)).toEqual([A]);
    expect(b.chefes.map((c) => c.user_id)).toEqual([A]);
    expect(b.social).toEqual({ contratei: 1, empregos: [1] });
  });
  it('ninguém escreve direto nos contratos', async () => {
    await expect(
      t.asRole('authenticated', `insert into public.idle_contracts (employer_id, employee_id, cargo) values ('${A}', '${B}', 'x')`),
    ).rejects.toThrow();
  });
  it('equipe do contrato mais recente pro mais antigo; chefes com o que pagam; social', async () => {
    await abrir(C);
    await dar(A, 1e6);
    await contratar(B);
    expect((await contratar(C)).equipe.map((e) => e.user_id)).toEqual([C, B]);
    await t.as(C);
    await dar(C, 1e6);
    await contratar(A);
    await t.as(A);
    const a = await t.rpc<Estado>('idle_open');
    expect(a.chefes.map((c) => [c.user_id, c.mult])).toEqual([[C, 1]]);
    expect(a.social).toEqual({ contratei: 2, empregos: [1] });
    expect(a.rate).toBeCloseTo(0.5 * (1 + 0.1 * 2 + 0.02), 10);
  });
  it('contratado: o tempo parado até o contrato rende com a regra antiga', async () => {
    // A na era 4 com Cultura de startup: quem A contrata ganha o triplo (+6%)
    await q(`update public.idle_state set generators[13] = 1, generators[19] = 1, strategies = '{0,0,2,-1}', valuation = 1e12 where user_id = $1`, [A]);
    await recuar(B, 1000);
    await contratar(B);
    expect(await valuationDe(B)).toBeCloseTo(10 + 0.5 * 1.02 * 1000, 0);
    await t.as(B);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.06, 10);
  });
  it('Cultura de startup escolhida depois: os contratados fecham a conta antes de ganhar o triplo', async () => {
    await q(`update public.idle_state set generators[13] = 1, strategies = '{0,0,-1,-1}', valuation = 1e12 where user_id = $1`, [A]);
    await contratar(B);
    await q('update public.idle_state set generators[19] = 1 where user_id = $1', [A]);
    await recuar(B, 1000);
    const antes = await valuationDe(B);
    await t.rpc('idle_pick_strategy', { p_era: 4, p_opcao: 2 });
    expect(await valuationDe(B)).toBeCloseTo(antes + 0.5 * 1.02 * 1000, 0);
    await t.as(B);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.06, 10);
  });
});
