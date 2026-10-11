// Banco da Bolsa (minigame 1): migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPRESAS_BOLSA, escolherHumor, inicial, normal, tick, type Mercado } from '../idle/bolsaMotor';
import { freshDb, type TestDb } from './db';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
});

type Linha = { valor: number; delta: number; humor: number; humor_ate: string; geracao: number; rj_ate: string | null };
const paraTs = (l: Linha): Mercado => ({
  valor: l.valor, delta: l.delta, humor: l.humor, humorAte: Number(l.humor_ate), geracao: l.geracao,
  rjAte: l.rj_ate === null ? null : Number(l.rj_ate),
});

/** Roda o tick em SQL com o estado m (como linha de idle_bolsa_mercado). */
async function tickSql(m: Mercado, empresa: number, tt: number, u: number[]): Promise<Mercado> {
  const [r] = await q<Linha>(
    `select (x).valor, (x).delta, (x).humor, (x).humor_ate::text, (x).geracao, (x).rj_ate::text from (
       select public.idle_bolsa_tick(row($1::int, $2::bigint, $3::float8, $4::float8, $5::int, $6::bigint, $7::int, $8::bigint)::public.idle_bolsa_mercado, c, $9::bigint, $10::double precision[]) as x
       from public.idle_cat_bolsa c where c.id = $1) s`,
    [empresa, tt - 1, m.valor, m.delta, m.humor, m.humorAte, m.geracao, m.rjAte, tt, u],
  );
  return paraTs(r);
}

describe('catálogo e tick (paridade SQL × TS)', () => {
  it('o catálogo do banco é o mesmo da página', async () => {
    const rows = await q<{ id: number; codigo: string; nome: string; gerador: number; repouso: number; vol: number; pesos: number[]; quebra: number }>(
      'select id, codigo, nome, gerador, repouso, vol, pesos, quebra from public.idle_cat_bolsa order by id');
    expect(rows).toEqual(EMPRESAS_BOLSA.map((e) => ({ ...e, pesos: [...e.pesos] })));
  });
  it('normal e humor iguais', async () => {
    for (const [a, b] of [[0, 0], [0.3, 0.6], [0.999, 0.25], [0.5, 0.9]]) {
      const [r] = await q<{ n: number }>('select public.idle_bolsa_normal($1, $2) as n', [a, b]);
      expect(Math.abs(r.n - normal(a, b))).toBeLessThan(1e-9);
    }
    for (const u of [0, 0.1, 0.33, 0.5, 0.77, 0.999]) {
      const [r] = await q<{ h: number }>('select public.idle_bolsa_humor($1::double precision[], $2) as h', [EMPRESAS_BOLSA[3].pesos, u]);
      expect(r.h).toBe(escolherHumor(EMPRESAS_BOLSA[3].pesos, u));
    }
  });
  it('200 ticks de cada empresa com os mesmos sorteios dão o mesmo mercado (< 1e-9)', async () => {
    let s = 7;
    const u = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (const e of EMPRESAS_BOLSA) {
      let ts = inicial(e, 0);
      let sql = inicial(e, 0);
      for (let tt = 1; tt <= 200; tt++) {
        const sorteio = [u(), u(), u(), u(), u(), u(), u()];
        // força a zona de risco de vez em quando, pra exercitar a quebra
        if (tt % 50 === 0) { ts = { ...ts, valor: e.repouso * 0.1 }; sql = { ...sql, valor: e.repouso * 0.1 }; sorteio[6] = 0; }
        ts = tick(ts, e, tt, sorteio);
        sql = await tickSql(sql, e.id, tt, sorteio);
        expect(Math.abs(sql.valor - ts.valor), `${e.codigo} t${tt}`).toBeLessThan(1e-9 * Math.max(1, ts.valor));
        expect(Math.abs(sql.delta - ts.delta)).toBeLessThan(1e-9);
        expect({ ...sql, valor: 0, delta: 0 }).toEqual({ ...ts, valor: 0, delta: 0 });
      }
    }
  });
  it('catálogo: membro lê, anônimo não', async () => {
    await t.member('00000000-0000-0000-0000-00000000000a');
    await t.as('00000000-0000-0000-0000-00000000000a');
    expect(await t.asRole('authenticated', 'select id from public.idle_cat_bolsa')).toHaveLength(8);
    await expect(t.asRole('anon', 'select id from public.idle_cat_bolsa')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_bolsa_mercado')).rejects.toThrow();
  });
});

describe('avançar o mercado', () => {
  const precos = (empresa: number) =>
    q<{ tick: string; valor: number }>('select tick::text, valor from public.idle_bolsa_precos where empresa = $1 order by tick', [empresa]);
  const mercado = (empresa: number) => q<Linha & { tick: string }>('select *, tick::text, humor_ate::text, rj_ate::text from public.idle_bolsa_mercado where empresa = $1', [empresa]);

  it('primeira vez: cria as 8 no repouso, no tick de agora', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    const rows = await q<{ n: number }>('select count(*)::int as n from public.idle_bolsa_mercado');
    expect(rows[0].n).toBe(8);
    expect(await precos(1)).toEqual([{ tick: '1000', valor: 30 }]);
  });
  it('gera os minutos que faltam, um preço por minuto por empresa; mesmo tick de novo não muda nada', async () => {
    await q('select setseed(0.42)');
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('select public.idle_bolsa_avancar_ate(1005)');
    expect((await precos(3)).map((p) => p.tick)).toEqual(['1000', '1001', '1002', '1003', '1004', '1005']);
    const antes = await mercado(3);
    await q('select public.idle_bolsa_avancar_ate(1005)');
    expect(await mercado(3)).toEqual(antes);
    expect(await precos(3)).toHaveLength(6);
  });
  it('mais de 1 dia parado: gera só o último dia', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('select public.idle_bolsa_avancar_ate(1000 + 5000)');
    const p = await precos(1);
    expect(p).toHaveLength(1 + 1440);
    expect(p[1].tick).toBe(String(1000 + 5000 - 1440 + 1));
  });
  it('apaga o histórico de mais de 7 dias', async () => {
    await q('select public.idle_bolsa_avancar_ate(20000)');
    // 20001 − 10080 = 9921: o 9920 já passou de 7 dias, o 9921 ainda não
    await q('insert into public.idle_bolsa_precos (tick, empresa, valor) values (9920, 1, 1), (9921, 1, 1)');
    await q('select public.idle_bolsa_avancar_ate(20001)');
    expect((await precos(1)).map((p) => p.tick)).toEqual(['9921', '20000', '20001']);
  });
  it('quebra no banco: empresa na zona de risco com chance 1 quebra, fica 10 minutos parada e volta', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('update public.idle_cat_bolsa set quebra = 1 where id = 4');
    await q('update public.idle_bolsa_mercado set valor = 1, humor = 4, humor_ate = 99999 where empresa = 4');
    await q('select public.idle_bolsa_avancar_ate(1001)');
    let [m] = await mercado(4);
    expect(m.geracao).toBe(1);
    expect(m.rj_ate).toBe('1011');
    await q('select public.idle_bolsa_avancar_ate(1011)');
    [m] = await mercado(4);
    expect(m.rj_ate).toBeNull();
    expect(m.valor).toBe(20);
  });
  it('avançar de verdade usa o relógio: tick = minutos desde 1970', async () => {
    const [{ agora }] = await q<{ agora: string }>('select public.idle_bolsa_agora()::text as agora');
    expect(Math.abs(Number(agora) - Math.floor(Date.now() / 60000))).toBeLessThanOrEqual(1);
    const [{ v }] = await q<{ v: string }>('select public.idle_bolsa_avancar()::text as v');
    expect(Math.abs(Number(v) - Number(agora))).toBeLessThanOrEqual(1);
  });
});
