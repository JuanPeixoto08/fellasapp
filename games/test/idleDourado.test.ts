// Eventos na tela (0045): a sorte do banco é a da página, e as regras e efeitos do pegar.
import { beforeEach, describe, expect, it } from 'vitest';

import { douradoEm } from '../idle/dourados';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

describe('a sorte (paridade com dourados.ts)', () => {
  it('os mesmos segundos e os mesmos tipos num trecho de 60 mil segundos, pra dois jogadores', async () => {
    for (const u of [A, B]) {
      const ini = 1_760_000_000;
      const fim = ini + 60_000;
      const sql = await q<{ s: string; d: number }>(
        `select s::text, public.idle_dourado($1::uuid, s) as d from generate_series($2::bigint, $3::bigint) s
          where public.idle_dourado($1::uuid, s) is not null order by s`, [u, ini, fim - 1]);
      const ts: { s: string; d: number }[] = [];
      for (let s = ini; s < fim; s++) {
        const d = douradoEm(u, s);
        if (d !== null) ts.push({ s: String(s), d });
      }
      expect(ts.length).toBeGreaterThan(50);
      expect(sql).toEqual(ts);
    }
  });
  it('com a árvore (freq 2) e o Gemaplys (0,5): os mesmos segundos que douradoEm(u, s, gema + freq − 1)', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ s: string }>(
      `select s::text from generate_series($2::bigint, $3::bigint) s where public.idle_dourado($1::uuid, s, 1.5) is not null order by s`,
      [A, ini, ini + 30_000 - 1]);
    const ts: string[] = [];
    for (let s = ini; s < ini + 30_000; s++) if (douradoEm(A, s, 1.5) !== null) ts.push(String(s));
    expect(ts.length).toBeGreaterThan(90); // ~2,5/600 × 30 000 = 125
    expect(sql.map((x) => x.s)).toEqual(ts);
  });
});

// ---------- pegar e os efeitos (a sorte do teste vem de uma tabela) ----------
type Linha = { valuation: number; promo_ate: string | null; viral_ate: string[]; half_price: boolean; generators: number[] };
type Json = { valuation: number; rate: number; recorde: number; promo_ate: string | null; viral: string[]; half_price: boolean; generators: number[] };
const linha = async () =>
  (await q<Linha>('select valuation, promo_ate::text, viral_ate::text[] as viral_ate, half_price, generators from public.idle_state where user_id = $1', [A]))[0];
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
const evento = (seg: number, tipo: number) =>
  q('insert into public.teste_dourado values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
const pegar = (seg: number, lado = 0) => t.rpc<Json>('idle_dourado_pegar', { p_seg: seg, p_lado: lado });
/** Fecha a conta no futuro: o settle não soma produção entre ler e pegar (a conta fica exata). */
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
const custo2 = async (div = 1) =>
  (await q<{ p: number; k: number }>(
    `select public.idle_price(c.custo, s.generators[2], 1, public.idle_cost_mult(s) / $2) as p,
            public.idle_max_qty(c.custo, s.generators[2], s.valuation, public.idle_cost_mult(s) / $2) as k
       from public.idle_cat_gen c, public.idle_state s where c.id = 2 and s.user_id = $1`, [A, div]))[0];

describe('pegar um evento', () => {
  beforeEach(async () => {
    await t.db.exec(`
      create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';`);
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
    await parar();
  });

  it('Investidor apressado: 20 minutos da produção (sem bônus de tempo) na hora', async () => {
    const seg = await agoraSeg();
    await evento(seg, 0);
    const r = await taxa();
    const antes = (await linha()).valuation;
    const s = await pegar(seg);
    expect(s.valuation - antes).toBeCloseTo(r * 1200, 3);
  });
  it('fora do tempo, segundo sem evento ou lado que não existe', async () => {
    const seg = await agoraSeg();
    await evento(seg - 20, 0);
    await expect(pegar(seg - 20)).rejects.toThrow(/idle_dourado_gone/);
    await expect(pegar(seg - 3)).rejects.toThrow(/idle_dourado_gone/); // sem evento
    await evento(seg + 30, 0);
    await expect(pegar(seg + 30)).rejects.toThrow(/idle_dourado_gone/); // ainda nem apareceu
    await evento(seg, 0);
    await expect(pegar(seg, 1)).rejects.toThrow(/idle_bad_choice/);
  });
  it('segundo absurdo (bem longe de agora) é "já foi embora", não erro de data', async () => {
    await expect(pegar(9_000_000_000_000_000)).rejects.toThrow(/idle_dourado_gone/);
    await expect(pegar(-5)).rejects.toThrow(/idle_dourado_gone/);
  });
  it('Promoção que acabou há menos de 1 s ainda vale na compra (o botão mostrava metade)', async () => {
    await q(`update public.idle_state set promo_ate = now() - interval '500 milliseconds' where user_id = $1`, [A]);
    await parar();
    const antes = await linha();
    const cheio = (await custo2()).p;
    const depois = await t.rpc<Json>('idle_buy', { p_kind: 'gerador', p_id: 2, p_qty: 1 });
    expect(antes.valuation - depois.valuation).toBeCloseTo(cheio / 2, 3);
  });
  it('até 15 s depois de aparecer ainda vale (12 s na tela + a folga da rede)', async () => {
    const seg = await agoraSeg();
    await evento(seg - 14, 1);
    await expect(pegar(seg - 14)).resolves.toBeTruthy();
  });
  it('o mesmo evento paga uma vez só', async () => {
    const seg = await agoraSeg();
    await evento(seg, 0);
    await pegar(seg);
    await expect(pegar(seg)).rejects.toThrow(/idle_dourado_pego/);
  });
  it('Promoção: 30 s de compras pela metade; a meia-preço da Caixinha fica guardada', async () => {
    const seg = await agoraSeg();
    await evento(seg, 1);
    await q('update public.idle_state set half_price = true where user_id = $1', [A]);
    const s = await pegar(seg);
    const dur = Date.parse(s.promo_ate!) - Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(dur).toBeGreaterThan(25_000);
    expect(dur).toBeLessThan(35_000);
    await parar();
    const antes = await linha();
    const cheio = (await custo2()).p;
    const depois = await t.rpc<Json>('idle_buy', { p_kind: 'gerador', p_id: 2, p_qty: 1 });
    expect(antes.valuation - depois.valuation).toBeCloseTo(cheio / 2, 3);
    expect(depois.half_price).toBe(true);
  });
  it('Promoção + Máx: compra o que o F$ dá com o custo pela metade', async () => {
    await q('update public.idle_state set valuation = 1e7 where user_id = $1', [A]);
    const sem = (await custo2()).k;
    const com = (await custo2(2)).k;
    expect(com).toBeGreaterThan(sem);
    const seg = await agoraSeg();
    await evento(seg, 1);
    await pegar(seg);
    await parar();
    const antes = await linha();
    const depois = await t.rpc<Json>('idle_buy', { p_kind: 'gerador', p_id: 2, p_qty: 0 });
    expect(depois.generators[1] - antes.generators[1]).toBe(com);
  });
  it('Viralizou: a dupla tem dois lados, cada um paga uma vez; o recorde não conta o ×100', async () => {
    const seg = await agoraSeg();
    await evento(seg, 3);
    const um = await pegar(seg, 0);
    expect(um.viral).toHaveLength(1);
    const dois = await pegar(seg, 1);
    expect(dois.viral).toHaveLength(2);
    await expect(pegar(seg, 1)).rejects.toThrow(/idle_dourado_pego/);
    expect(dois.recorde).toBeCloseTo(dois.rate, 6);
  });
  it('a conta: ×10 por Viralizou ativo, sem teto (três = ×1000); ×50 com o ×5 da oportunidade', async () => {
    const r = await taxa();
    const ganho = async (viral: string, boost = 'null') => {
      await q(`update public.idle_state set settled_at = now() - interval '100 seconds', viral_ate = ${viral}, boost_until = ${boost} where user_id = $1`, [A]);
      return (await q<{ v: number }>('select (public.idle_settle(s, now())).valuation - s.valuation as v from public.idle_state s where user_id = $1', [A]))[0].v / r;
    };
    const perto = (v: number, alvo: number) => expect(Math.abs(v - alvo)).toBeLessThan(1);
    const dez = "now() - interval '10 seconds'";
    perto(await ganho("'{}'"), 100);
    perto(await ganho(`array[${dez}]`), 100 + 9 * 60);
    perto(await ganho(`array[${dez}, ${dez}]`), 100 + 99 * 60);
    perto(await ganho(`array[${dez}, ${dez}, ${dez}]`), 100 + 999 * 60);
    // ×5 de 100 a 40 s atrás + ×10 de 70 a 10 s atrás: 30 s a ×5, 30 s a ×50, 30 s a ×10, 10 s a ×1 = 1960
    perto(await ganho(`array[${dez}]`, "now() - interval '40 seconds'"), 100 + 4 * 60 + 9 * 60 + 36 * 30);
  });
  it('vender a startup zera Promoção e Viralizou', async () => {
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', promo_ate = now() + interval '20 seconds',
             viral_ate = array[now() + interval '40 seconds'] where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const l = await linha();
    expect(l.promo_ate).toBeNull();
    expect(l.viral_ate).toEqual([]);
  });
  it('o estado devolve só os Viralizou ativos', async () => {
    await q(`update public.idle_state set viral_ate = array[now() - interval '5 seconds', now() + interval '30 seconds'] where user_id = $1`, [A]);
    const s = await t.rpc<Json>('idle_open');
    expect(s.viral).toHaveLength(1);
  });
  // ---------- ramo Dourados da árvore (0061) ----------
  const ter = (nos: number[]) => q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [A, nos]);
  const agoraMs = async () => Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
  it('Investidor anjo: 40 minutos da produção', async () => {
    await ter([1, 41, 42, 43]);
    const seg = await agoraSeg();
    await evento(seg, 0);
    const r = await taxa();
    const antes = (await linha()).valuation;
    expect((await pegar(seg)).valuation - antes).toBeCloseTo(r * 2400, 3);
  });
  it('Olho de lince: pega aos 20 s; sem ele, aos 20 s já foi', async () => {
    const seg = await agoraSeg();
    await evento(seg - 20, 1);
    await expect(pegar(seg - 20)).rejects.toThrow(/idle_dourado_gone/);
    await ter([1, 41, 42]);
    await expect(pegar(seg - 20)).resolves.toBeTruthy();
    await evento(seg - 28, 1);
    await expect(pegar(seg - 28)).rejects.toThrow(/idle_dourado_gone/); // 24 s + 3 de folga
  });
  it('Hype: Promoção de 60 s e Viralizou de 120 s', async () => {
    await ter([1, 41, 42, 43, 44]);
    const seg = await agoraSeg();
    await evento(seg, 1);
    const p = await pegar(seg);
    const promo = Date.parse(p.promo_ate!) - (await agoraMs());
    expect(promo).toBeGreaterThan(55_000);
    expect(promo).toBeLessThan(65_000);
    await evento(seg + 1, 2);
    const v = await pegar(seg + 1);
    const viral = Date.parse(v.viral.at(-1)!) - (await agoraMs());
    expect(viral).toBeGreaterThan(115_000);
    expect(viral).toBeLessThan(125_000);
  });
  it('Hype comprado com um Viralizou no ar não estica o que já foi pego nem refaz a conta pra trás', async () => {
    const seg = await agoraSeg();
    await evento(seg, 2);
    await pegar(seg); // acaba em 60 s
    await q('update public.idle_state set settled_at = now() where user_id = $1', [A]); // a conta fechada na hora de pegar
    await ter([1, 41, 42, 43, 44]);
    const r = await taxa();
    const [{ v }] = await q<{ v: number }>(
      `select (public.idle_settle(s, s.settled_at + interval '90 seconds')).valuation - s.valuation as v from public.idle_state s where user_id = $1`, [A]);
    expect(Math.abs(v / r - (10 * 60 + 30))).toBeLessThan(2); // ×10 até o fim de antes (60 s), ×1 depois
  });
  it('só membro com sessão pega', async () => {
    const seg = await agoraSeg();
    await evento(seg, 0);
    await expect(t.asRole('anon', 'select public.idle_dourado_pegar(1, 0)')).rejects.toThrow();
    await t.as(B);
    await expect(pegar(seg)).rejects.toThrow(/not_member/);
  });
});
