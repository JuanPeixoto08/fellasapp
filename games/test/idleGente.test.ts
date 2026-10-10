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
