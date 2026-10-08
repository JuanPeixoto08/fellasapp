import { beforeEach, describe, expect, it } from 'vitest';

import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const OUT = '00000000-0000-0000-0000-0000000000ff';
type Wallet = { balance: number; fiado_count: number; can_fiado: boolean; open_round_id: string | null; week_start: string };

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const setBalance = (uid: string, b: number) => q('update public.game_wallets set balance = $2 where user_id = $1', [uid, b]);
const played = (uid: string, at = 'now()') => q(`update public.game_wallets set last_played_at = ${at} where user_id = $1`, [uid]);
const ageWeek = () => q(`update public.game_wallets set week_start = week_start - 7`);

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B, C]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

describe('games_wallet', () => {
  it('primeira vez cria com 1.000 (extrato "start") e devolve o formato', async () => {
    const w = await t.rpc<Wallet>('games_wallet');
    expect(w).toMatchObject({ balance: 1000, fiado_count: 0, can_fiado: false, open_round_id: null });
    expect(await q('select delta, reason from public.game_ledger')).toEqual([{ delta: 1000, reason: 'start' }]);
    await t.rpc('games_wallet');
    expect(await q('select count(*)::int as n from public.game_ledger')).toEqual([{ n: 1 }]);
  });

  it('não membro é barrado', async () => {
    await t.as(OUT);
    await expect(t.rpc('games_wallet')).rejects.toThrow(/not_member/);
  });
});

describe('games_fiado', () => {
  it('só com saldo 0, +100 uma vez por dia', async () => {
    await t.rpc('games_wallet');
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_not_broke/);
    await setBalance(A, 0);
    expect((await t.rpc<Wallet>('games_wallet')).can_fiado).toBe(true);
    const w = await t.rpc<Wallet>('games_fiado');
    expect(w).toMatchObject({ balance: 100, fiado_count: 1, can_fiado: false });
    await setBalance(A, 0);
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_today/);
    await q(`update public.game_wallets set last_fiado_on = last_fiado_on - 1`);
    expect((await t.rpc<Wallet>('games_fiado')).fiado_count).toBe(2);
  });
});

describe('fiado com troco', () => {
  it('saldo abaixo da aposta mínima (ex.: 5, troco de blackjack) também pega fiado', async () => {
    await t.rpc('games_wallet');
    await setBalance(A, 5);
    expect((await t.rpc<Wallet>('games_wallet')).can_fiado).toBe(true);
    expect((await t.rpc<Wallet>('games_fiado')).balance).toBe(105);
    await setBalance(A, 10);
    await q(`update public.game_wallets set last_fiado_on = null`);
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_not_broke/);
  });
});

describe('games_move', () => {
  it('nunca deixa negativo', async () => {
    await t.rpc('games_wallet');
    await expect(q(`select public.games_move($1, -1001, 'bet')`, [A])).rejects.toThrow(/insufficient_credits/);
    expect(await q(`select public.games_move($1, -1000, 'bet') as b`, [A])).toEqual([{ b: 0 }]);
  });
});

describe('games_weekly_reset', () => {
  async function threePlayers() {
    for (const u of [A, B, C]) {
      await t.as(u);
      await t.rpc('games_wallet');
    }
    await setBalance(A, 2000);
    await played(A, `now() - interval '1 hour'`);
    await setBalance(B, 2000);
    await played(B, `now() - interval '2 hours'`);
    await q('update public.game_wallets set fiado_count = 1 where user_id = $1', [B]);
    await setBalance(C, 500); // C não jogou: fica fora do pódio
  }

  it('mesma semana: não faz nada', async () => {
    await threePlayers();
    await q('select public.games_weekly_reset()');
    expect(await q('select count(*)::int as n from public.game_weeks')).toEqual([{ n: 0 }]);
  });

  it('semana virou: pódio com desempate, troféu passa, todo mundo 1.000; rodar de novo não muda nada', async () => {
    await threePlayers();
    await q(`update public.profiles set badges = '{weekly_champion}' where id = $1`, [C]); // campeão anterior
    await ageWeek();
    await q('select public.games_weekly_reset()');
    const [week] = await q<{ champion_id: string; podium: { user_id: string }[] }>('select * from public.game_weeks');
    expect(week.champion_id).toBe(A); // empate em 2.000: A pegou menos fiado
    expect(week.podium.map((p) => p.user_id)).toEqual([A, B]);
    expect(await q('select id, badges from public.profiles where id in ($1, $2) order by id', [A, C])).toEqual([
      { id: A, badges: ['weekly_champion'] },
      { id: C, badges: [] },
    ]);
    expect(await q('select distinct balance, fiado_count, last_played_at from public.game_wallets')).toEqual([
      { balance: 1000, fiado_count: 0, last_played_at: null },
    ]);
    await q('select public.games_weekly_reset()');
    expect(await q('select count(*)::int as n from public.game_weeks')).toEqual([{ n: 1 }]);
  });

  it('ninguém jogou: semana registrada sem campeão, ninguém ganha selo', async () => {
    await t.rpc('games_wallet');
    await ageWeek();
    await q('select public.games_weekly_reset()');
    expect(await q('select champion_id from public.game_weeks')).toEqual([{ champion_id: null }]);
    expect(await q(`select count(*)::int as n from public.profiles where 'weekly_champion' = any (badges)`)).toEqual([{ n: 0 }]);
  });

  it('alguém entrou na semana nova antes do cron: o reset ainda roda para quem ficou na semana velha', async () => {
    await t.rpc('games_wallet');
    await setBalance(A, 4000);
    await played(A);
    await ageWeek(); // A ficou na semana passada
    await t.as(B);
    await t.rpc('games_wallet'); // B nasceu já na semana nova, jogou e tem 1.300
    await setBalance(B, 1300);
    await q('select public.games_weekly_reset()');
    expect(await q('select champion_id from public.game_weeks')).toEqual([{ champion_id: A }]);
    expect(await q('select user_id, balance from public.game_wallets order by user_id')).toEqual([
      { user_id: A, balance: 1000 },
      { user_id: B, balance: 1300 }, // quem já está na semana nova não é zerado
    ]);
  });

  it('cron agendado segunda 03:00 UTC', async () => {
    expect(await q('select schedule from cron.jobs where name = $1', ['fellas-games-reset'])).toEqual([{ schedule: '0 3 * * 1' }]);
  });
});

describe('permissões', () => {
  it('app lê o placar mas não escreve; extrato só o próprio; reset proibido', async () => {
    await t.rpc('games_wallet');
    await t.as(B);
    await t.rpc('games_wallet');
    expect(await t.asRole('authenticated', 'select user_id from public.game_wallets')).toHaveLength(2);
    expect(await t.asRole('authenticated', 'select user_id from public.game_ledger')).toEqual([{ user_id: B }]);
    await expect(t.asRole('authenticated', 'update public.game_wallets set balance = 9999')).rejects.toThrow();
    await expect(
      t.asRole('authenticated', `insert into public.game_ledger (user_id, delta, reason) values ('${B}', 1, 'win')`),
    ).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select public.games_weekly_reset()')).rejects.toThrow();
    await expect(t.asRole('authenticated', `select public.games_move('${B}', 500, 'win')`)).rejects.toThrow();
    await expect(t.asRole('anon', 'select * from public.game_wallets')).rejects.toThrow();
  });
});
