import { beforeEach, describe, expect, it } from 'vitest';

import { card } from './cards';
import { freshDb, type TestDb } from './db';
import { act, members, nextHand, P, rigDeck, sit, stacks, startHand, state, type State } from './poker';

let t: TestDb;

beforeEach(async () => {
  t = await freshDb();
  await members(t);
});

describe('cegas e ordem', () => {
  it('heads-up: o botão é a cega pequena e fala primeiro antes do flop', async () => {
    const s = await startHand(t, { 0: 300, 1: 300 }, 0);
    expect(s.hand).toMatchObject({ button: 1, sb: 1, bb: 0, to_act: 1, current_bet: 10, min_raise_to: 20, street: 'preflop', pot: 15 });
    expect(s.hand!.players['1']).toMatchObject({ bet: 5, last: 'sb' });
    expect(s.hand!.players['0']).toMatchObject({ bet: 10, last: 'bb' });
    expect(await stacks(t)).toEqual({ 0: 290, 1: 295 });
  });

  it('a cega grande tem a opção; depois do flop fala quem não é o botão', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'call');
    expect((await state(t)).hand!.to_act).toBe(0);
    await expect(act(t, 0, 'call')).rejects.toThrow(/invalid_action/);
    const s = await act(t, 0, 'check');
    expect(s.hand).toMatchObject({ street: 'flop', to_act: 0, current_bet: 0, pot: 20 });
    expect(s.hand!.board).toHaveLength(3);
  });

  it('3 na mesa: botão, cega pequena e cega grande em sequência; fala o botão primeiro', async () => {
    const s = await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    expect(s.hand).toMatchObject({ button: 0, sb: 1, bb: 2, to_act: 0 });
  });

  it('cega maior que as fichas: paga o que tem e fica all-in', async () => {
    const s = await startHand(t, { 0: 5, 1: 300 }, 0);
    expect(s.hand!.players['0']).toMatchObject({ bet: 5, all_in: true });
    const end = await act(t, 1, 'call');
    expect(end.hand).toMatchObject({ status: 'done', street: 'showdown' });
    expect(end.hand!.board).toHaveLength(5);
  });
});

describe('apostas', () => {
  it('aumento mínimo, de 5 em 5 e no máximo tudo', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await expect(act(t, 0, 'raise', 15)).rejects.toThrow(/raise_too_small/);
    await expect(act(t, 0, 'raise', 33)).rejects.toThrow(/invalid_action/);
    await expect(act(t, 0, 'raise', 400)).rejects.toThrow(/raise_too_big/);
    let s = await act(t, 0, 'raise', 30);
    expect(s.hand).toMatchObject({ current_bet: 30, min_raise_to: 50, to_act: 1 });
    await expect(act(t, 1, 'raise', 45)).rejects.toThrow(/raise_too_small/);
    s = await act(t, 1, 'raise', 50);
    expect(s.hand).toMatchObject({ current_bet: 50, min_raise_to: 70, to_act: 2 });
  });

  it('aumento mínimo quebrado (fichas fora do passo de 5, depois de empate com ficha sobrando) vale', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 33 }, 2);
    await act(t, 0, 'call');
    await act(t, 1, 'call');
    let s = await act(t, 2, 'allin'); // vai a 33: aumento completo de 23
    expect(s.hand).toMatchObject({ current_bet: 33, min_raise_to: 56, to_act: 0 });
    await expect(act(t, 0, 'raise', 57)).rejects.toThrow(/invalid_action/); // fora do passo e não é o mínimo
    s = await act(t, 0, 'raise', 56);
    expect(s.hand).toMatchObject({ current_bet: 56 });
  });

  it('all-in curto não reabre a ação para quem já falou', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 60 }, 2);
    await act(t, 0, 'raise', 40);
    await act(t, 1, 'call');
    let s = await act(t, 2, 'allin'); // vai a 60: +20, menos que o aumento de 30
    expect(s.hand).toMatchObject({ current_bet: 60, min_raise_to: 90, to_act: 0 });
    expect(s.hand!.players['0']).toMatchObject({ capped: true, acted: false });
    await expect(act(t, 0, 'raise', 100)).rejects.toThrow(/invalid_action/);
    await expect(act(t, 0, 'allin')).rejects.toThrow(/invalid_action/);
    await act(t, 0, 'call');
    s = await act(t, 1, 'call');
    expect(s.hand).toMatchObject({ street: 'flop', pot: 180, to_act: 1 });
  });

  it('jogada fora da vez, número velho e quem não está sentado', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await expect(act(t, 0, 'check')).rejects.toThrow(/not_your_turn/);
    const h = (await state(t)).hand!;
    await t.as(P[1]);
    await expect(
      t.rpc('poker_act', { p_hand: h.id, p_action_no: h.action_no - 1, p_action: 'call', p_amount: null }),
    ).rejects.toThrow(/stale_seq/);
    await t.as(P[3]);
    await expect(
      t.rpc('poker_act', { p_hand: h.id, p_action_no: h.action_no, p_action: 'call', p_amount: null }),
    ).rejects.toThrow(/not_seated/);
  });

  it('completar no meio da mão só para quem já correu', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await t.as(P[1]);
    await expect(t.rpc('poker_rebuy', { p_amount: 100 })).rejects.toThrow(/rebuy_in_hand/);
    await act(t, 0, 'fold');
    await t.as(P[0]);
    expect((await t.rpc<State>('poker_rebuy', { p_amount: 100 })).seats.find((x) => x.seat === 0)!.stack).toBe(400);
  });
});

describe('fim da mão', () => {
  it('todos correm: leva sem mostrar e a aposta que ninguém pagou volta', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    const s = await act(t, 1, 'fold');
    expect(s.hand).toMatchObject({ status: 'done', to_act: null, shown: {} });
    expect(s.hand!.results).toMatchObject({ showdown: false, payouts: { '0': 10 }, pots: [{ amount: 10, winners: [0], name: null }] });
    expect(await stacks(t)).toEqual({ 0: 305, 1: 295 });
    expect(s.next_hand_at).not.toBeNull();
  });

  it('potes paralelos com 3 all-ins diferentes', async () => {
    // ordem: 1 (cega pequena), 2 (cega grande), 0 (botão), depois a mesa
    await rigDeck(t, ['Kh', 'Kd', '7c', '2d', 'Ah', 'Ad', '9s', '8c', '4h', '3d', 'Js']);
    await startHand(t, { 0: 100, 1: 200, 2: 300 }, 2);
    await act(t, 0, 'allin');
    await act(t, 1, 'allin');
    const s = await act(t, 2, 'allin'); // os 100 de cima ninguém pagou: voltam
    expect(s.hand).toMatchObject({ status: 'done', runout: true, street: 'showdown' });
    expect(s.hand!.board).toHaveLength(5);
    expect(s.hand!.results!.pots).toEqual([
      { amount: 300, winners: [0], name: 'Par de A' },
      { amount: 200, winners: [1], name: 'Par de K' },
    ]);
    expect(await stacks(t)).toEqual({ 0: 300, 1: 200, 2: 100 });
    expect(Object.keys(s.hand!.shown).sort()).toEqual(['0', '1', '2']);
  });

  it('empate divide; a ficha que sobra vai para o primeiro vencedor à esquerda do botão', async () => {
    await rigDeck(t, ['2c', '3c', '4d', '5d', '6h', '7h', 'As', 'Ks', 'Qs', 'Js', '10s']);
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await act(t, 0, 'call');
    await act(t, 1, 'fold');
    await act(t, 2, 'check');
    for (let i = 0; i < 3; i++) {
      await act(t, 2, 'check');
      await act(t, 0, 'check');
    }
    const s = await state(t);
    expect(s.hand!.results).toMatchObject({
      showdown: true,
      payouts: { '2': 13, '0': 12 },
      hands: { '0': 'Royal flush', '2': 'Royal flush' },
    });
    expect(Object.keys(s.hand!.shown).sort()).toEqual(['0', '2']); // quem correu não mostra
  });
});

describe('cartas, mostrar e histórico', () => {
  it('poker_my_cards devolve só as minhas', async () => {
    await rigDeck(t, ['Ah', 'Kh', '2c', '3c']); // ordem heads-up: 0 (cega grande), 1
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await t.as(P[0]);
    expect(await t.rpc('poker_my_cards')).toMatchObject({ cards: [card('Ah'), card('Kh')] });
    await t.as(P[1]);
    expect(await t.rpc('poker_my_cards')).toMatchObject({ cards: [card('2c'), card('3c')] });
    await t.as(P[2]);
    expect(await t.rpc('poker_my_cards')).toBeNull();
  });

  it('Mostrar vale até a próxima mão começar', async () => {
    await rigDeck(t, ['Ah', 'Kh', '2c', '3c']);
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'fold');
    await t.as(P[1]);
    expect((await t.rpc<State>('poker_show')).hand!.shown).toEqual({ '1': [card('2c'), card('3c')] });
    await expect(t.rpc('poker_show')).rejects.toThrow(/nothing_to_show/);
    await t.as(P[2]);
    await expect(t.rpc('poker_show')).rejects.toThrow(/nothing_to_show/);
    await nextHand(t);
    await t.as(P[1]);
    await expect(t.rpc('poker_show')).rejects.toThrow(/nothing_to_show/);
    expect((await t.db.query<{ n: number }>('select count(*)::int as n from public.poker_secrets')).rows).toEqual([{ n: 1 }]);
  });

  it('histórico traz as mãos que acabaram, mais nova primeiro', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await act(t, 1, 'fold');
    await t.as(P[0]);
    const rows = await t.rpc<{ no: number; players: Record<string, string>; results: { payouts: Record<string, number> } }[]>('poker_history');
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ no: 1, players: { '0': P[0], '1': P[1] }, results: { payouts: { '0': 10 } } });
  });
});

describe('quem entra e quem sai', () => {
  it('quem senta no meio espera a cega grande chegar nele', async () => {
    await startHand(t, { 0: 300, 1: 300 }, 0);
    await sit(t, 2, 300);
    expect((await state(t)).seats.find((x) => x.seat === 2)).toMatchObject({ wait_bb: true });
    await act(t, 1, 'fold');
    let s = await nextHand(t);
    expect(s.hand).toMatchObject({ bb: 1 });
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1']);
    await act(t, 0, 'fold');
    s = await nextHand(t);
    expect(s.hand).toMatchObject({ bb: 2, sb: 1, button: 0 });
    expect(Object.keys(s.hand!.players).sort()).toEqual(['0', '1', '2']);
  });

  it('dois sentam com a mesa parada: a mão começa na hora', async () => {
    await sit(t, 0, 300);
    const s = await sit(t, 3, 300);
    expect(s.hand).toMatchObject({ status: 'betting', no: 1 });
    expect(s.seats.every((x) => !x.wait_bb)).toBe(true);
  });

  it('ninguém paga a cega grande duas vezes seguidas quando alguém sai', async () => {
    await startHand(t, { 0: 300, 1: 300, 2: 300 }, 2);
    await act(t, 0, 'fold');
    await act(t, 1, 'fold');
    await t.as(P[0]);
    await t.rpc('poker_leave');
    const s = await nextHand(t);
    expect(s.hand).toMatchObject({ bb: 1, sb: 2, button: 2 });
  });
});
