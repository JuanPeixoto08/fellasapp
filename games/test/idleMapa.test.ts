// Mapa do rolê, a moldura (0057): migrações reais no PGlite. Lugares de verdade não entram aqui: os testes põem
// lugares de mentira em idle_places quando precisam.
import { beforeEach, describe, expect, it } from 'vitest';

import { LUGARES, MARCOS } from '../idle/mapa';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Pino = { id: number; lancado: boolean; preco: number; aberto: boolean; nivel: number | null; nome: string | null; x: number | null; dono: { user_id: string } | null };
type Mapa = { mapa: string | null; lugares: Pino[]; mult: number };
const mapa = () => t.rpc<Mapa>('idle_mapa');
const abrir = (l: number) => t.rpc<{ valuation: number; mapa: Mapa; conquistas: { id: number }[] }>('idle_place_abrir', { p_lugar: l });
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
/** A com a empresa na era `era` (geradores 1 e o primeiro da era), estratégias escolhidas e F$ `v`. */
async function empresa(era: number, v = 1e15) {
  const primeiro = [1, 7, 13, 19, 25][era - 1];
  await q(`update public.idle_state set valuation = $2, generators[1] = 50, generators[$3] = 1, strategies = '{0,0,0,0}' where user_id = $1`, [A, v, primeiro]);
  await parar();
}

beforeEach(async () => {
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.member(B);
  await t.member(OUT, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
});

describe('catálogo', () => {
  it('o banco tem os mesmos lugares e marcos de mapa.ts', async () => {
    const ls = await q<Record<string, unknown>>('select * from public.idle_cat_place order by id');
    expect(ls.map((r) => ({ id: r.id, faixa: r.faixa, horas: r.horas, era: r.era, lote: r.lote, custoBase: r.custo_base, moeda: r.moeda, numero: r.numero })))
      .toEqual(LUGARES.map(({ id, faixa, horas, era, lote, custoBase, moeda, numero }) => ({ id, faixa, horas, era, lote, custoBase, moeda, numero })));
    const ms = await q<Record<string, unknown>>('select * from public.idle_cat_place_marco order by id');
    expect(ms.map((r) => ({ id: r.id, lugar: r.lugar, tipo: r.tipo, valor: r.valor, bonus: r.bonus }))).toEqual(MARCOS.map((m) => ({ ...m })));
  });
});

describe('privacidade', () => {
  it('idle_places e idle_map: membro lê, não membro e anônimo não', async () => {
    await q(`insert into public.idle_places (id, nome, x, y) values (3, 'Lugar de teste', 10, 10)`);
    expect(await t.asRole('authenticated', 'select nome from public.idle_places')).toHaveLength(1);
    await t.as(OUT);
    expect(await t.asRole('authenticated', 'select nome from public.idle_places')).toHaveLength(0);
    await expect(t.asRole('anon', 'select nome from public.idle_places')).rejects.toThrow();
  });
  it('estado dos lugares não é lido direto por ninguém', async () => {
    await expect(t.asRole('authenticated', 'select * from public.idle_place_state')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_place_prod')).rejects.toThrow();
  });
});

describe('abrir', () => {
  it('idle_mapa sem empresa aberta: tudo fechado, preço 0, sem erro', async () => {
    await t.as(B);
    const m = await mapa();
    expect(m.lugares).toHaveLength(9);
    expect(m.lugares.every((l) => !l.aberto && l.preco === 0)).toBe(true);
  });
  it('não membro não vê o mapa', async () => {
    await t.as(OUT);
    await expect(mapa()).rejects.toThrow(/not_member/);
  });
  it('abre a camisetaria na era 2 pagando 2 h de produção, e ganha "Rolê marcado"', async () => {
    await empresa(2);
    const r = await taxa();
    const antes = (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
    const s = await abrir(3);
    expect(antes - s.valuation).toBeCloseTo(2 * 3600 * r, 0);
    expect(s.mapa.lugares.find((l) => l.id === 3)).toMatchObject({ aberto: true, nivel: 1 });
    expect(s.conquistas.map((c) => c.id)).toContain(83);
  });
  it('recusas: era baixa, lote não lançado, já aberto, sem dinheiro, lugar que não existe', async () => {
    await empresa(2);
    await expect(abrir(4)).rejects.toThrow(/idle_locked/); // médio pede era 3
    await expect(abrir(1)).rejects.toThrow(/idle_locked/); // lote 2
    await abrir(3);
    await expect(abrir(3)).rejects.toThrow(/idle_lugar_aberto/);
    await expect(abrir(99)).rejects.toThrow(/idle_bad_choice/);
    await empresa(4, 0);
    await expect(abrir(7)).rejects.toThrow(/idle_cant_afford/);
  });
  it('sem empresa aberta: idle_not_started', async () => {
    await t.as(B);
    await expect(abrir(3)).rejects.toThrow(/idle_not_started/);
  });
  it('valuation exatamente igual ao preço abre', async () => {
    await empresa(2);
    const preco = 2 * 3600 * (await taxa());
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, preco]);
    await parar();
    await expect(abrir(3)).resolves.toBeTruthy();
  });
  it('três abertos dão "Conhece a cidade"; vender a startup não fecha nada', async () => {
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [A])).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([83, 84]));
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', prestige_earned = 0, settled_at = now() where user_id = $1`, [A]);
    await t.rpc('idle_prestige'); // vende de verdade (sem engolir erro)
    expect((await q<{ s: boolean }>('select started as s from public.idle_state where user_id = $1', [A]))[0].s).toBe(false);
    expect((await q('select lugar from public.idle_place_state where user_id = $1', [A]))).toHaveLength(3);
  });
  it('nome, ícone e posição vêm de idle_places quando existem', async () => {
    await q(`insert into public.idle_places (id, nome, frase, x, y) values (3, 'Lugar de teste', 'frase', 40, 50)`);
    const l = (await mapa()).lugares.find((x) => x.id === 3)!;
    expect(l).toMatchObject({ nome: 'Lugar de teste', x: 40 });
    expect((await mapa()).lugares.find((x) => x.id === 4)!.nome).toBeNull();
  });
});
