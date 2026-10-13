// Oportunidades que empilham (0062): cada ×5 da Caixinha conta sozinho (dois = ×25, e com o Viralizou multiplica de novo)
// e cada "próxima compra pela metade" guardada vale uma compra (duas = as próximas 2 compras pela metade).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Estado = { valuation: number; rate: number; boosts: string[]; boost_until: string | null; meias: number; half_price: boolean; generators: number[] };
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const buy = (kind: string, id: number, qty = 1) => t.rpc<Estado>('idle_buy', { p_kind: kind, p_id: id, p_qty: qty });

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
  await t.member(A);
  await t.as(A);
  await t.rpc('idle_start');
  await q('update public.idle_state set generators[1] = 20 where user_id = $1', [A]);
});

describe('o ×5 da oportunidade empilha', () => {
  /** Quanto rende (em segundos da taxa) fechar a conta de 100 s atrás até agora com esses bônus. */
  const ganho = async (boosts: string, virais = "'{}'") => {
    await q(`update public.idle_state set settled_at = now() - interval '100 seconds', boost_ate = ${boosts}, viral_ate = ${virais} where user_id = $1`, [A]);
    const [{ v }] = await q<{ v: number }>('select (public.idle_settle(s, now())).valuation - s.valuation as v from public.idle_state s where user_id = $1', [A]);
    return v / (await taxa());
  };
  const perto = (v: number, alvo: number) => expect(Math.abs(v - alvo)).toBeLessThan(1);
  const dez = "now() - interval '10 seconds'";
  it('um = ×5; dois = ×25; três = ×125 (cada um até o seu fim)', async () => {
    perto(await ganho(`array[${dez}]::timestamptz[]`), 90 * 5 + 10);
    perto(await ganho(`array[${dez}, ${dez}]::timestamptz[]`), 90 * 25 + 10);
    perto(await ganho(`array[${dez}, ${dez}, ${dez}]::timestamptz[]`), 90 * 125 + 10);
    // um acaba 40 s atrás e o outro 10 s atrás: 60 s a ×25, 30 s a ×5, 10 s a ×1
    perto(await ganho(`array[now() - interval '40 seconds', ${dez}]::timestamptz[]`), 60 * 25 + 30 * 5 + 10);
  });
  it('com o Viralizou multiplica: ×5 e ×10 = ×50; dois de cada = ×2.500', async () => {
    perto(await ganho(`array[${dez}]::timestamptz[]`, `array[${dez}]::timestamptz[]`), 60 * 50 + 30 * 5 + 10);
    perto(await ganho(`array[${dez}, ${dez}]::timestamptz[]`, `array[${dez}, ${dez}]::timestamptz[]`), 60 * 2500 + 30 * 25 + 10);
  });
  it('o estado devolve os ×5 no ar (e o boost_until = o último fim, pra página velha)', async () => {
    await q(`update public.idle_state set boost_ate = array[now() - interval '5 seconds', now() + interval '20 seconds', now() + interval '50 seconds'] where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.boosts).toHaveLength(2);
    expect(Date.parse(s.boost_until!)).toBe(Date.parse(s.boosts[1]));
  });
});

describe('a meia-preço empilha', () => {
  it('duas guardadas: as próximas 2 compras unitárias pela metade; a 3ª paga cheio', async () => {
    await q('update public.idle_state set valuation = 1e6, meias = 2, settled_at = now() + interval \'1 day\' where user_id = $1', [A]);
    const preco = async () => (await q<{ p: number }>(`select public.idle_price(c.custo, s.generators[1], 1, public.idle_cost_mult(s)) as p from public.idle_cat_gen c, public.idle_state s where c.id = 1 and s.user_id = $1`, [A]))[0].p;
    for (const [meiasDepois, fator] of [[1, 0.5], [0, 0.5], [0, 1]] as const) {
      const cheio = await preco();
      const antes = (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
      const s = await buy('gerador', 1);
      expect(antes - s.valuation).toBeCloseTo(cheio * fator, 3);
      expect(s.meias).toBe(meiasDepois);
      expect(s.half_price).toBe(meiasDepois > 0);
    }
  });
});

describe('o placar diz quem está em órbita (gerador 30: a cena 6, "Era 6 · Em órbita")', () => {
  it('orbita = tem o gerador 30; a era continua 5 no jogo', async () => {
    await q(`update public.idle_state set generators[25] = 1 where user_id = $1`, [A]);
    let [r] = await t.rpc<{ era: number; orbita: boolean }[]>('idle_board');
    expect(r).toMatchObject({ era: 5, orbita: false });
    await q(`update public.idle_state set generators[30] = 1 where user_id = $1`, [A]);
    [r] = await t.rpc<{ era: number; orbita: boolean }[]>('idle_board');
    expect(r).toMatchObject({ era: 5, orbita: true });
  });
});

describe('a venda e a migração', () => {
  it('vender a startup zera os ×5 e as meias guardadas', async () => {
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', boost_ate = array[now() + interval '1 minute'], meias = 3 where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    expect(await q('select boost_ate, meias from public.idle_state where user_id = $1', [A])).toEqual([{ boost_ate: [], meias: 0 }]);
  });
  it('a 0062 leva o ×5 no ar e a meia guardada de antes; rodar de novo não duplica', async () => {
    await q(`update public.idle_state set boost_ate = '{}', meias = 0, boost_until = now() + interval '30 seconds', half_price = true where user_id = $1`, [A]);
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0062_fellas_inc_oportunidades_empilham.sql'), 'utf8');
    await t.db.exec(sql);
    const ler = () => q<{ n: number; meias: number }>('select cardinality(boost_ate) as n, meias from public.idle_state where user_id = $1', [A]);
    expect(await ler()).toEqual([{ n: 1, meias: 1 }]);
    await t.db.exec(sql);
    expect(await ler()).toEqual([{ n: 1, meias: 1 }]);
  });
});
