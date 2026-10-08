// Chamadas ao banco da mesa. Toda falha sai como GameError (código + frase).
import { toGameError } from './errors';
import { supabase } from './supabase';
import type { Action, BoardRow, RoundState, Wallet } from './types';

export * from './errors';
export * from './types';

async function rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T> {
  try {
    const { data, error } = await supabase.rpc(fn, args);
    if (error) throw error;
    return data as T;
  } catch (e) {
    throw toGameError(e);
  }
}

export const gamesWallet = () => rpc<Wallet>('games_wallet');
export const gamesFiado = () => rpc<Wallet>('games_fiado');
export const bjDeal = (bet: number) => rpc<RoundState>('bj_deal', { p_bet: bet });
export const bjAct = (id: string, action: Action) => rpc<RoundState>('bj_act', { p_round: id, p_action: action });
export const bjCurrent = () => rpc<RoundState | null>('bj_current');

/** Placar da semana para o painel do PC (só quem jogou, na ordem do placar). */
export async function weekBoard(): Promise<BoardRow[]> {
  const { data, error } = await supabase
    .from('game_wallets')
    .select('user_id, balance, profiles(display_name, username)')
    .not('last_played_at', 'is', null)
    .order('balance', { ascending: false })
    .order('fiado_count', { ascending: true })
    .order('last_played_at', { ascending: true })
    .limit(6);
  if (error) throw toGameError(error);
  type Row = { user_id: string; balance: number; profiles: { display_name: string | null; username: string } | null };
  return ((data ?? []) as unknown as Row[]).map((r) => ({
    userId: r.user_id,
    balance: r.balance,
    name: r.profiles?.display_name || r.profiles?.username || 'Alguém',
  }));
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
