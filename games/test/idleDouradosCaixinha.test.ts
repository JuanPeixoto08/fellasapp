// Dourados novos e oportunidades novas na Caixinha (0076): a sorte do banco é a da página, e a conta, a compra, o pegar,
// a Caixinha e a Bolsa.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from '../idle/catalogo';
import { derrubada } from '../idle/convidados';
import { escolhaLinkedin, segundoPix, sorteioDourado, tigrePaga, tipoDourado, tipoGarantido } from '../idle/dourados';
import { rendasGeradores } from '../idle/economia';
import { OPP_CORTE, tipo } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type J = IdleState & { dourados_cont: Record<string, number> };
const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
/** Fecha a conta no futuro: nada rende entre ler e agir (as contas ficam exatas). */
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
/** A, membro, empresa aberta com F$ de sobra, 50 do gerador 1 e 20 do 2; B não é membro. */
const abrir = async () => {
  await t.member(A);
  await t.member(B, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
  await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  await parar();
};

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

// a idle_rate_at da 0066, com outro nome: a nova (soma de idle_gen_rendas) tem que dar o mesmo
const RATE_0066 = `
create or replace function public.idle_rate_at_0066(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
       * public.idle_social_mult(s, t)
       * public.idle_bonus_mult(s)
       * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
       * public.idle_conv_prod(s, t)
       * public.idle_place_mult(s)
$$;`;

describe('a sorte (paridade com dourados.ts e oportunidades.ts)', () => {
  it('a roda nova dos dourados: o mesmo tipo em 20 mil segundos, dois jogadores', async () => {
    const ini = 1_760_000_000;
    for (const u of [A, B]) {
      const sql = await q<{ t: number }>(
        'select public.idle_dourado_tipo($1::uuid, s) as t from generate_series($2::bigint, $3::bigint) s order by s', [u, ini, ini + 19_999]);
      expect(sql.map((x) => x.t)).toEqual(Array.from({ length: 20_000 }, (_, i) => tipoDourado(u, ini + i)));
    }
  });
  it('o garantido, o segundo do Pix, a sorte do Tigrinho e o sorteio do LinkedIn são os mesmos', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ g: number; p: string; tg: boolean; l: number }>(
      `select public.idle_dourado_tipo_garantido($1::uuid, s) as g, public.idle_dourado_pix_seg($1::uuid, s)::text as p,
              public.idle_dourado_tigre_paga($1::uuid, s) as tg, public.idle_dourado_sorteio($1::uuid, s, 5151, 5) as l
         from generate_series($2::bigint, $3::bigint) s order by s`, [A, ini, ini + 4999]);
    expect(sql).toEqual(Array.from({ length: 5000 }, (_, i) => ({
      g: tipoGarantido(A, ini + i), p: String(segundoPix(A, ini + i)), tg: tigrePaga(A, ini + i), l: sorteioDourado(A, ini + i, 5151, 5),
    })));
  });
  it('a roda da Caixinha com o corte: o mesmo tipo em 4 mil janelas em volta de OPP_CORTE, dois jogadores', async () => {
    for (const u of [A, B]) {
      const sql = await q<{ k: number }>(
        'select public.idle_opp_kind($1::uuid, w) as k from generate_series($2::bigint, $3::bigint) w order by w', [u, OPP_CORTE - 2000, OPP_CORTE + 1999]);
      expect(sql.map((x) => x.k)).toEqual(Array.from({ length: 4000 }, (_, i) => tipo(u, OPP_CORTE - 2000 + i)));
    }
  });
  it('o corte é o mesmo número no TS e no SQL', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0076_fellas_inc_dourados_caixinha.sql'), 'utf8');
    expect(sql).toContain(`when w < ${OPP_CORTE} then`);
  });
  it('a faixa do MC V.V nunca dá Tigrinho no banco também', async () => {
    let seg = 1_760_000_000;
    while (tipoDourado(A, seg) !== 7 || derrubada(A, seg - 7200, 1)) seg++;
    await abrir();
    await q(`update public.idle_state set generators[13] = 1, conv_cadeira = '{9,null,null}',
               conv_desde = array[to_timestamp($2::double precision), null, null]::timestamptz[] where user_id = $1`, [A, seg - 7200]);
    const [{ f }] = await q<{ f: number }>('select public.idle_conv_faixa(s, $2) as f from public.idle_state s where user_id = $1', [A, seg]);
    expect(f).toBe(0);
  });
  it('idle_rate_at soma idle_gen_rendas e dá o mesmo que a conta da 0066', async () => {
    await t.db.exec(RATE_0066);
    await abrir();
    for (const set of [
      'generators[1] = 10',
      `generators[1:6] = '{50,40,30,20,10,5}', upgrades = '{11,12,21,1001}'`,
      `generators[1:12] = '{200,150,120,90,80,60,50,40,30,20,10,5}', strategies = '{0,1,-1,-1}', upgrades = '{11,12,13,21,22,31,1001,1002}'`,
    ]) {
      await q(`update public.idle_state set ${set} where user_id = $1`, [A]);
      const [r] = await q<{ novo: number; velho: number; soma: number }>(
        `select public.idle_rate_at(s, now()) as novo, public.idle_rate_at_0066(s, now()) as velho,
                (select sum(x.renda) from public.idle_gen_rendas(s, now()) x) as soma
           from public.idle_state s where user_id = $1`, [A]);
      expect(r.novo).toBe(r.soma);
      expect(Math.abs(r.novo / r.velho - 1)).toBeLessThan(1e-12);
    }
  });
  it('LinkedIn: o mesmo gerador e o mesmo f (idle_linkedin × escolhaLinkedin com as rendas do banco); a página ordena igual', async () => {
    await abrir();
    await q(`update public.idle_state set generators[1:8] = '{120,80,60,40,30,20,10,5}', upgrades = '{11,12,21,31}' where user_id = $1`, [A]);
    const [{ r }] = await q<{ r: number[] }>(
      'select array(select x.renda from public.idle_gen_rendas(s, now()) x order by x.gen) as r from public.idle_state s where user_id = $1', [A]);
    const ini = 1_760_000_000;
    const sql = await q<{ gen: number; f: number }>(
      `select l.gen, l.f from generate_series($2::bigint, $3::bigint) seg cross join public.idle_state s
         cross join lateral public.idle_linkedin(s, seg) l where s.user_id = $1 order by seg`, [A, ini, ini + 299]);
    expect(sql).toHaveLength(300);
    sql.forEach((x, i) => {
      const e = escolhaLinkedin(A, ini + i, r)!;
      expect(x.gen).toBe(e.gen);
      expect(x.f).toBeCloseTo(e.f, 12);
    });
    const s = await t.rpc<IdleState>('idle_open');
    const ts = rendasGeradores(catalogo, s);
    const soma = (v: number[]) => v.reduce((a, x) => a + x, 0);
    ts.forEach((x, i) => expect(x / soma(ts)).toBeCloseTo(r[i] / soma(r), 12));
  });
});
