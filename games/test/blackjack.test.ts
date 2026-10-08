import { beforeEach, describe, expect, it } from 'vitest';

import { card, rig } from './cards';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
type Hand = { cards: number[]; bet: number; doubled: boolean; from_split_aces: boolean; done: boolean; result: string | null };
type State = {
  id: string;
  status: 'playing' | 'done';
  bet: number;
  hands: Hand[];
  active: number;
  dealer: number[];
  dealer_total: number;
  payout: number;
  balance: number;
};

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const deal = (bet: number) => t.rpc<State>('bj_deal', { p_bet: bet });

beforeEach(async () => {
  t = await freshDb();
  await t.member(A);
  await t.member(B);
  await t.as(A);
});

describe('bj_deal', () => {
  it('aposta fora de 10–500 é recusada e não cobra', async () => {
    await expect(deal(5)).rejects.toThrow(/bet_out_of_range/);
    await expect(deal(510)).rejects.toThrow(/bet_out_of_range/);
    expect((await t.rpc<{ balance: number }>('games_wallet')).balance).toBe(1000);
  });

  it('distribui, cobra e esconde a carta virada', async () => {
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    const s = await deal(100);
    expect(s).toMatchObject({ status: 'playing', bet: 100, active: 0, balance: 900, dealer: [card('Ks')], dealer_total: 10 });
    expect(s.hands[0].cards).toEqual([card('9h'), card('8c')]);
    expect(s.dealer).toHaveLength(1); // a virada não vem no estado
  });

  it('uma mão aberta por vez; saldo insuficiente recusa', async () => {
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    await deal(100);
    await expect(deal(100)).rejects.toThrow(/round_open/);
    await t.as(B);
    await t.rpc('games_wallet');
    await q('update public.game_wallets set balance = 50 where user_id = $1', [B]);
    await expect(deal(100)).rejects.toThrow(/insufficient_credits/);
    expect(await q('select count(*)::int as n from public.bj_rounds where user_id = $1', [B])).toEqual([{ n: 0 }]);
  });

  it('natural do jogador paga 3:2 na hora', async () => {
    await rig(t, ['As', '9h', 'Kd', '7c']);
    const s = await deal(100);
    expect(s).toMatchObject({ status: 'done', payout: 250, balance: 1150 });
    expect(s.hands[0].result).toBe('blackjack');
    expect(s.dealer).toEqual([card('9h'), card('7c')]); // revelada no fim
  });

  it('banca com natural: jogador perde; os dois com natural: empate', async () => {
    await rig(t, ['9h', 'As', '8c', 'Kd']);
    expect(await deal(100)).toMatchObject({ status: 'done', payout: 0, balance: 900 });
    await rig(t, ['Ah', 'As', 'Kc', 'Kd']);
    const s = await deal(100);
    expect(s.hands[0].result).toBe('push');
    expect(s.balance).toBe(900); // 900 - 100 + 100
  });

  it('bj_current devolve a mão aberta, ou null', async () => {
    expect(await t.rpc('bj_current')).toBeNull();
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    const s = await deal(100);
    expect((await t.rpc<State>('bj_current')).id).toBe(s.id);
    expect((await t.rpc<{ open_round_id: string }>('games_wallet')).open_round_id).toBe(s.id);
  });

  it('valor de mão: Ás macio e duro', async () => {
    const total = async (codes: string[]) =>
      (await q<{ v: number }>(`select public.bj_hand_total($1::smallint[]) as v`, [codes.map(card)]))[0].v;
    expect(await total(['As', '6h'])).toBe(17);
    expect(await total(['As', '6h', '9c'])).toBe(16);
    expect(await total(['As', 'Ad', '9c'])).toBe(21);
    expect(await total(['Ks', 'Qh'])).toBe(20);
  });

  it('o embaralhar de verdade dá 6 baralhos completos', async () => {
    await t.db.exec(`drop function public.bj_shuffle()`);
    const sql = (await import('node:fs')).readFileSync(
      (await import('node:path')).resolve(__dirname, '../../supabase/migrations/0028_blackjack.sql'),
      'utf8',
    );
    const fn = sql.match(/create or replace function public\.bj_shuffle\(\)[\s\S]*?\$\$;/)![0];
    await t.db.exec(fn);
    const [{ n, distinct, each }] = await q<{ n: number; distinct: number; each: number }>(
      `select cardinality(s) as n, (select count(distinct c)::int from unnest(s) c) as distinct,
              (select max(k)::int from (select count(*) k from unnest(s) c group by c) x) as each
         from (select public.bj_shuffle() s) z`,
    );
    expect({ n, distinct, each }).toEqual({ n: 312, distinct: 52, each: 6 });
  });
});

describe('permissões do blackjack', () => {
  it('ninguém lê o sapato; mão de outro é invisível; escrita direta negada', async () => {
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    await deal(100);
    await expect(t.asRole('authenticated', 'select * from public.bj_secrets')).rejects.toThrow();
    expect(await t.asRole('authenticated', 'select id from public.bj_rounds')).toHaveLength(1);
    await t.as(B);
    expect(await t.asRole('authenticated', 'select id from public.bj_rounds')).toHaveLength(0);
    await expect(t.asRole('authenticated', `update public.bj_rounds set payout = 9999`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `select public.bj_finish(gen_random_uuid())`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `select public.bj_shuffle()`)).rejects.toThrow();
  });
});
