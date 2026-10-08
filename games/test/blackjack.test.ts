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

const act = (id: string, a: string) => t.rpc<State>('bj_act', { p_round: id, p_action: a });

describe('bj_act', () => {
  it('pedir até estourar fecha a mão sem a banca comprar', async () => {
    await rig(t, ['10h', '9s', '6c', '7d', 'Kd']);
    const s = await deal(100);
    const e = await act(s.id, 'hit');
    expect(e).toMatchObject({ status: 'done', payout: 0, balance: 900 });
    expect(e.hands[0].result).toBe('bust');
    expect(e.dealer).toEqual([card('9s'), card('7d')]); // só revelou
  });

  it('parar: banca compra até 17 e para no 17 macio', async () => {
    await rig(t, ['10h', 'As', '9c', '5d', 'Ac']); // banca A+5 = 16 macio → +A = 17 macio, para
    const e = await act((await deal(100)).id, 'stand');
    expect(e.dealer_total).toBe(17);
    expect(e.dealer).toHaveLength(3);
    expect(e.hands[0].result).toBe('win'); // 19 x 17
    expect(e.balance).toBe(1100);
  });

  it('pedir fazendo 21 fecha a mão sozinho', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']); // 11 + K = 21; banca 17
    const e = await act((await deal(100)).id, 'hit');
    expect(e.status).toBe('done');
    expect(e.hands[0].result).toBe('win');
  });

  it('empate devolve a aposta', async () => {
    await rig(t, ['10h', '10s', '8c', '8d']);
    const e = await act((await deal(100)).id, 'stand');
    expect(e).toMatchObject({ payout: 100, balance: 1000 });
    expect(e.hands[0].result).toBe('push');
  });

  it('banca estoura: quem não estourou ganha', async () => {
    await rig(t, ['10h', '10s', '2c', '6d', 'Kd']); // jogador 12; banca 16 + K = 26
    const e = await act((await deal(100)).id, 'stand');
    expect(e.dealer_total).toBe(26);
    expect(e.hands[0].result).toBe('win');
  });

  it('dobrar: só com 2 cartas, cobra de novo, recebe exatamente 1 carta', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']);
    const e = await act((await deal(100)).id, 'double');
    expect(e.hands[0]).toMatchObject({ bet: 200, doubled: true, result: 'win' });
    expect(e.hands[0].cards).toHaveLength(3);
    expect(e.balance).toBe(1200);
    await rig(t, ['2h', '9s', '3c', '8d', '4d', 'Kd']);
    const s = await deal(100);
    await act(s.id, 'hit');
    await expect(act(s.id, 'double')).rejects.toThrow(/invalid_action/);
  });

  it('dobrar sem saldo é recusado e não mexe na mão', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']);
    await t.rpc('games_wallet');
    await q('update public.game_wallets set balance = 100 where user_id = $1', [A]);
    const s = await deal(100);
    await expect(act(s.id, 'double')).rejects.toThrow(/insufficient_credits/);
    expect((await t.rpc<State>('bj_current')).hands[0].cards).toHaveLength(2);
  });

  it('dividir: par de mesmo valor (10 e K), uma vez, duas mãos', async () => {
    await rig(t, ['10h', '9s', 'Kc', '8d', '9h', '9c']);
    const s = await deal(100);
    const d = await act(s.id, 'split');
    expect(d.hands.map((h) => h.cards)).toEqual([
      [card('10h'), card('9h')],
      [card('Kc'), card('9c')],
    ]);
    expect(d.balance).toBe(800);
    await expect(act(s.id, 'split')).rejects.toThrow(/invalid_action/);
    expect((await act(s.id, 'stand')).active).toBe(1);
    const e = await act(s.id, 'stand');
    expect(e.hands.map((h) => h.result)).toEqual(['win', 'win']); // 19 e 19 x 17
    expect(e.balance).toBe(1200);
  });

  it('dividir sem par é recusado; ases divididos recebem 1 carta e fecham; 21 depois de dividir paga 1:1', async () => {
    await rig(t, ['10h', '9s', '9c', '8d']);
    await expect(act((await deal(100)).id, 'split')).rejects.toThrow(/invalid_action/);
    await t.as(B);
    await rig(t, ['As', '9s', 'Ah', '8d', 'Kc', '5c']);
    const e = await act((await deal(100)).id, 'split');
    // mãos A+K = 21 e A+5 = 16; ases divididos fecham sozinhos; banca 9+8 = 17
    expect(e.status).toBe('done');
    expect(e.hands.map((h) => h.result)).toEqual(['win', 'lose']);
    expect(e.payout).toBe(200); // 21 depois de dividir paga 1:1, não 3:2
    expect(e.balance).toBe(1000);
  });

  it('mão fechada e mão de outro', async () => {
    await rig(t, ['10h', '10s', '8c', '8d']);
    const s = await deal(100);
    await act(s.id, 'stand');
    await expect(act(s.id, 'hit')).rejects.toThrow(/round_done/); // toque duplo / segunda aba
    await rig(t, ['10h', '10s', '8c', '8d']);
    const mine = await deal(100);
    await t.as(B);
    await expect(act(mine.id, 'stand')).rejects.toThrow(/round_not_found/);
    await expect(act(mine.id, 'fold')).rejects.toThrow(/invalid_action/);
  });

  it('extrato fecha com o saldo', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']);
    await act((await deal(100)).id, 'double');
    const [{ s }] = await q<{ s: number }>('select sum(delta)::int as s from public.game_ledger where user_id = $1', [A]);
    expect(s).toBe((await t.rpc<{ balance: number }>('games_wallet')).balance);
  });

  it('fiado não sai com mão aberta', async () => {
    await rig(t, ['10h', '10s', '8c', '8d']);
    await t.rpc('games_wallet');
    await q('update public.game_wallets set balance = 100 where user_id = $1', [A]);
    await deal(100);
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_open_round/);
  });
});

describe('reset com mão aberta', () => {
  it('Parar automático, paga, e depois zera', async () => {
    await rig(t, ['10h', '10s', '9c', '7d']);
    await deal(100);
    await q('update public.game_wallets set week_start = week_start - 7');
    await q('select public.games_weekly_reset()');
    expect(await q(`select status from public.bj_rounds`)).toEqual([{ status: 'done' }]);
    expect(await q<{ champion_id: string }>('select champion_id from public.game_weeks')).toEqual([{ champion_id: A }]);
    expect((await t.rpc<{ balance: number }>('games_wallet')).balance).toBe(1000);
  });
});
