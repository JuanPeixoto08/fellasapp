// Horta do Food truck (0048): migrações reais no PGlite. A sorte dos cruzamentos é trocada nos testes que precisam.
import { beforeEach, describe, expect, it } from 'vitest';

import { ESPECIES } from '../idle/horta';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Planta = { canteiro: number; especie: number; inicio: string; origem: string };
type Horta = { lado: number; food_trucks: number; plantas: Planta[]; descobertas: number[]; bonus: { producao: number; geradores: number; melhorias: number; oportunidades: number } };
type Estado = { valuation: number; rate: number; recorde: number; generators: number[]; muda_em: string | null; horta_bonus: Horta['bonus']; conquistas: { id: number }[]; horta?: Horta; descobriu?: number | null };

const horta = () => t.rpc<Horta>('idle_horta');
const plantar = (c: number, e: number) => t.rpc<Estado>('idle_horta_plantar', { p_canteiro: c, p_especie: e });
const colher = (c: number) => t.rpc<Estado>('idle_horta_colher', { p_canteiro: c });
const arrancar = (c: number) => t.rpc<Estado>('idle_horta_arrancar', { p_canteiro: c });
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
/** Fecha a conta no futuro: nenhuma produção entra entre ler e agir (a conta fica exata). */
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
const valuation = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
/** Põe uma planta direto no banco, com `idadeS` de idade. */
const por = (c: number, e: number, idadeS: number) =>
  q(`insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio) values ($1, $2, $3, now() - make_interval(secs => $4))`, [A, c, e, idadeS]);
const conquistas = async () => (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1 order by 1', [A])).map((x) => x.id);

beforeEach(async () => {
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.member(B);
  await t.member(OUT, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
  // 3 × 3; 25 Food trucks já são era 2: as estratégias escolhidas pra poder comprar
  await q(`update public.idle_state set valuation = 1e12, generators[1] = 50, generators[11] = 25, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
  await parar();
});

describe('catálogo', () => {
  it('o banco tem as mesmas plantas de horta.ts', async () => {
    const rows = await q<Record<string, unknown>>('select * from public.idle_cat_horta order by id');
    expect(rows.map((r) => ({
      id: r.id, nome: r.nome, custoS: r.custo_s, amadureceS: r.amadurece_s, vidaS: r.vida_s, producao: r.producao, geradores: r.geradores,
      melhorias: r.melhorias, oportunidades: r.oportunidades, pais: r.pai_a === null ? null : [r.pai_a, r.pai_b], rara: r.rara,
    }))).toEqual(ESPECIES.map((e) => ({ ...e, pais: e.pais ? [...e.pais] : null })));
  });
});

describe('plantar, colher, arrancar', () => {
  it('plantar paga a semente (minutos da produção), conta e dá a do Pé de Pix', async () => {
    const r = await taxa();
    const antes = await valuation();
    const s = await plantar(0, 1);
    expect(antes - s.valuation).toBeCloseTo(600 * r, 3);
    expect(s.horta!.plantas).toMatchObject([{ canteiro: 0, especie: 1, origem: 'plantada' }]);
    expect(await conquistas()).toContain(63);
    expect((await q<{ n: number }>('select horta_plantou as n from public.idle_state where user_id = $1', [A]))[0].n).toBe(1);
  });
  it('recusas: canteiro trancado, ocupado, semente não descoberta, espécie que não existe', async () => {
    await expect(plantar(3, 1)).rejects.toThrow(/idle_horta_trancado/); // coluna 3 no 3 × 3
    await expect(plantar(18, 1)).rejects.toThrow(/idle_horta_trancado/); // linha 3
    await expect(plantar(-1, 1)).rejects.toThrow(/idle_horta_trancado/);
    await plantar(0, 2);
    await expect(plantar(0, 1)).rejects.toThrow(/idle_horta_ocupado/);
    await expect(plantar(1, 3)).rejects.toThrow(/idle_horta_semente/);
    await expect(plantar(1, 99)).rejects.toThrow(/idle_bad_choice/);
  });
  it('sem Food truck não tem horta', async () => {
    await q('update public.idle_state set generators[11] = 0 where user_id = $1', [A]);
    expect((await horta()).lado).toBe(0);
    await expect(plantar(0, 1)).rejects.toThrow(/idle_horta_trancado/);
  });
  it('colher: só madura; libera a semente da espécie nova (e dá as conquistas dela); conta', async () => {
    await por(0, 3, 600); // Mandioca de 10 min: verde
    await expect(colher(0)).rejects.toThrow(/idle_horta_verde/);
    await q(`update public.idle_horta_plantas set inicio = now() - interval '4 hours' where user_id = $1`, [A]);
    const s = await colher(0);
    expect(s.descobriu).toBe(3);
    expect(s.horta!.descobertas).toEqual([1, 2, 3]);
    expect(s.horta!.plantas).toEqual([]);
    expect(await conquistas()).toContain(66);
    await por(1, 5, 2 * 3600); // Coentro maduro
    await colher(1);
    expect(await conquistas()).toContain(67);
    expect((await q<{ n: number }>('select horta_colheu as n from public.idle_state where user_id = $1', [A]))[0].n).toBe(2);
    await expect(colher(2)).rejects.toThrow(/idle_horta_vazio/);
  });
  it('arrancar esvazia sem devolver nada', async () => {
    await plantar(2, 1);
    const antes = await valuation();
    const s = await arrancar(2);
    expect(s.horta!.plantas).toEqual([]);
    expect(await valuation()).toBe(antes);
    await expect(arrancar(2)).rejects.toThrow(/idle_horta_vazio/);
  });
});

describe('o tempo passa sozinho', () => {
  const sorte = (sql: string) =>
    t.db.exec(`create or replace function public.idle_horta_sorte(u uuid, c int, t bigint, k int) returns double precision language sql immutable as '${sql}'`);
  it('cruzamento: duas Pix maduras vizinhas brotam uma Mandioca no canteiro vazio do lado', async () => {
    await sorte('select 0::double precision');
    await por(0, 1, 2 * 3600);
    await por(1, 1, 2 * 3600);
    await q(`update public.idle_state set horta_passo = floor(extract(epoch from now()) / 300)::bigint - 3 where user_id = $1`, [A]);
    const h = await horta();
    const novas = h.plantas.filter((p) => p.origem === 'cruzou');
    expect(novas.length).toBeGreaterThan(0);
    expect(novas.every((p) => p.especie === 3)).toBe(true);
  });
  it('sem sorte, nada brota', async () => {
    await sorte('select 0.99::double precision');
    await por(0, 1, 2 * 3600);
    await por(1, 1, 2 * 3600);
    await q(`update public.idle_state set horta_passo = floor(extract(epoch from now()) / 300)::bigint - 3 where user_id = $1`, [A]);
    expect((await horta()).plantas).toHaveLength(2);
  });
  it('Morango com Pescoço: onde uma planta morreu de velha há pouco; conta a morte e dá a escondida', async () => {
    await sorte("select case when k = 3 then 0 else 0.99 end::double precision");
    await por(7, 1, 9 * 3600 + 600); // Pix morreu há 10 min (linha 1, coluna 1)
    await q(`update public.idle_state set horta_passo = floor(extract(epoch from now()) / 300)::bigint - 3, horta_visto = now() - interval '20 minutes' where user_id = $1`, [A]);
    const h = await horta();
    expect(h.plantas).toMatchObject([{ canteiro: 7, especie: 8, origem: 'morango' }]);
    // a escondida só entra depois da conta fechada (o +1% dela não vale pro tempo de antes)
    expect(await conquistas()).not.toContain(112);
    await t.rpc('idle_open');
    expect(await conquistas()).toContain(112);
    expect((await q<{ n: number }>('select horta_morreu as n from public.idle_state where user_id = $1', [A]))[0].n).toBe(1);
  });
  it('anda no máximo 7 dias pra trás e marca o passo de agora', async () => {
    await q(`update public.idle_state set horta_passo = 1 where user_id = $1`, [A]);
    await horta();
    const [{ ok }] = await q<{ ok: boolean }>(`select horta_passo = floor(extract(epoch from now()) / 300)::bigint as ok from public.idle_state where user_id = $1`, [A]);
    expect(ok).toBe(true);
  });
});

describe('os bônus', () => {
  it('produção: duas Pix maduras = +2% na taxa (e no recorde)', async () => {
    const antes = await taxa();
    await por(0, 1, 2 * 3600);
    await por(1, 1, 2 * 3600);
    expect((await taxa()) / antes).toBeCloseTo(1.02, 9);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.horta_bonus.producao).toBeCloseTo(0.02, 9);
  });
  it('a conta vira quando a planta amadurece', async () => {
    const r = await taxa();
    // Pix que amadureceu há 50 s; conta aberta há 100 s
    await por(0, 1, 3600 + 50);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '100 seconds' where user_id = $1`, [A]);
    const [{ v }] = await q<{ v: number }>('select (public.idle_settle(s, now())).valuation as v from public.idle_state s where user_id = $1', [A]);
    expect(v / r).toBeGreaterThan(100 + 0.01 * 49);
    expect(v / r).toBeLessThan(100 + 0.01 * 51 + 0.01);
  });
  it('desconto nos geradores (Couve) e nas melhorias (Coentro); teto de 50%', async () => {
    const preco2 = async () => (await q<{ p: number }>(`select public.idle_price(c.custo, s.generators[2], 1, public.idle_cost_mult(s)) as p from public.idle_cat_gen c, public.idle_state s where c.id = 2 and s.user_id = $1`, [A]))[0].p;
    const cheio = await preco2();
    await por(0, 2, 2 * 3600);
    await por(1, 2, 2 * 3600);
    const antes = await valuation();
    const s = await t.rpc<Estado>('idle_buy', { p_kind: 'gerador', p_id: 2, p_qty: 1 });
    expect(antes - s.valuation).toBeCloseTo(cheio * 0.98, 3);
    await q('update public.idle_state set generators[11] = 200 where user_id = $1', [A]);
    for (let c = 0; c < 36; c++) await por(c, 7, 7 * 3600);
    expect((await t.rpc<Estado>('idle_open')).horta_bonus.geradores).toBe(0.5);
  });
  it('Coentro barateia a melhoria; Inhame faz o Investidor render +5%', async () => {
    const [{ id, preco }] = await q<{ id: number; preco: number }>(
      `select u.id, u.preco * public.idle_cost_mult(s) as preco from public.idle_cat_upg u, public.idle_state s
        where s.user_id = $1 and public.idle_upg_unlocked(u, s.generators) and not u.id = any (s.upgrades) order by u.preco limit 1`, [A]);
    await por(0, 5, 2 * 3600);
    let antes = await valuation();
    let s = await t.rpc<Estado>('idle_buy', { p_kind: 'melhoria', p_id: id, p_qty: 1 });
    expect(antes - s.valuation).toBeCloseTo(preco * 0.97, 3);
    await q('delete from public.idle_horta_plantas where user_id = $1', [A]);
    await por(0, 4, 3 * 3600); // Inhame maduro
    await t.db.exec(`create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';`);
    const [{ seg }] = await q<{ seg: number }>('select floor(extract(epoch from now()))::int as seg');
    await q('insert into public.teste_dourado values ($1, 0)', [seg]);
    await parar();
    const r = await taxa();
    antes = await valuation();
    s = await t.rpc<Estado>('idle_dourado_pegar', { p_seg: seg, p_lado: 0 });
    expect(s.valuation - antes).toBeCloseTo(r * 1200 * 1.05, 2);
  });
  it('canteiro trancado (Food trucks caíram): a planta fica, mas não conta nem dá pra mexer', async () => {
    await por(8, 1, 2 * 3600); // linha 1, coluna 2: aberta no 3 × 3
    const com = await taxa();
    await q('update public.idle_state set generators[11] = 1 where user_id = $1', [A]); // 2 × 2
    expect(await taxa()).toBeLessThan(com);
    await expect(colher(8)).rejects.toThrow(/idle_horta_trancado/);
  });
  it('a próxima mudança inclui a planta amadurecendo (a página recarrega nessa hora)', async () => {
    await por(0, 1, 3600 - 1800); // amadurece em 30 min
    const s = await t.rpc<Estado>('idle_open');
    const falta = Date.parse(s.muda_em!) - Date.now();
    expect(falta).toBeGreaterThan(25 * 60_000);
    expect(falta).toBeLessThan(31 * 60_000);
  });
});

describe('conquistas de estado e a venda', () => {
  it('Agro é pop (100 plantadas), Planta de plástico (10 mortas), Temos que plantar (as 8)', async () => {
    await q(`update public.idle_state set horta_plantou = 99, horta_morreu = 10 where user_id = $1`, [A]);
    await q(`insert into public.idle_horta_descobertas (user_id, especie) select $1, x from generate_series(3, 8) x`, [A]);
    await plantar(0, 1);
    const cs = await conquistas();
    expect(cs).toEqual(expect.arrayContaining([64, 70, 71]));
  });
  it('vender a startup não mexe na horta', async () => {
    await por(0, 1, 2 * 3600);
    await q(`insert into public.idle_horta_descobertas (user_id, especie) values ($1, 3)`, [A]);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', settled_at = now() where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const h = await horta();
    expect(h.plantas).toHaveLength(1);
    expect(h.descobertas).toEqual([1, 2, 3]);
  });
});

describe('segurança', () => {
  it('só membro com sessão; nada direto nas tabelas', async () => {
    await expect(t.asRole('anon', 'select public.idle_horta()')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_horta_plantas')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select public.idle_horta_avancar(s) from public.idle_state s')).rejects.toThrow();
    await t.as(OUT);
    await expect(horta()).rejects.toThrow(/not_member/);
  });
});
