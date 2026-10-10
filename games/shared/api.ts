// Chamadas ao banco da mesa. Toda falha sai como GameError (código + frase).
import { toGameError } from './errors';
import { supabase } from './supabase';
import type {
  Action,
  BoardRow,
  Fella,
  IdleBoardRow,
  IdleState,
  PokerAction,
  PokerCards,
  PokerHistoryRow,
  PokerState,
  RoundState,
  Wallet,
} from './types';

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

export const pokerState = () => rpc<PokerState>('poker_state');
export const pokerSit = (seat: number, buyin: number) => rpc<PokerState>('poker_sit', { p_seat: seat, p_buyin: buyin });
export const pokerAct = (hand: string, actionNo: number, action: PokerAction, amount?: number) =>
  rpc<PokerState>('poker_act', { p_hand: hand, p_action_no: actionNo, p_action: action, p_amount: amount ?? null });
export const pokerRebuy = (amount: number) => rpc<PokerState>('poker_rebuy', { p_amount: amount });
export const pokerLeave = () => rpc<PokerState>('poker_leave');
export const pokerBack = () => rpc<PokerState>('poker_back');
export const pokerShow = () => rpc<PokerState>('poker_show');
export const pokerMyCards = () => rpc<PokerCards>('poker_my_cards');
export const pokerTick = () => rpc<PokerState | null>('poker_tick');
export const pokerHistory = () => rpc<PokerHistoryRow[]>('poker_history');

export const idleOpen = () => rpc<IdleState>('idle_open');
export const idleStart = () => rpc<IdleState>('idle_start');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  rpc<IdleState>('idle_buy', { p_kind: kind, p_id: id, p_qty: qty });
export const idlePickStrategy = (era: number, opcao: number) => rpc<IdleState>('idle_pick_strategy', { p_era: era, p_opcao: opcao });
export const idleClaim = (window: number) => rpc<IdleState>('idle_claim_opportunity', { p_window: window });

const isUrl = (p: string) => /^https?:\/\//.test(p);

/** Nome e foto dos fellas. Avatar no bucket privado: link assinado por 1 h (como o app faz). */
export async function fellas(ids: string[]): Promise<Fella[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ids);
  if (error) throw toGameError(error);
  type Row = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
  const rows = (data ?? []) as Row[];
  const paths = rows.map((r) => r.avatar_url).filter((p): p is string => !!p && !isUrl(p));
  const signed = new Map<string, string>();
  if (paths.length) {
    const { data: urls } = await supabase.storage.from('post-images').createSignedUrls(paths, 3600);
    for (const u of urls ?? []) if (u.path && u.signedUrl) signed.set(u.path, u.signedUrl);
  }
  return rows.map((r) => ({
    id: r.id,
    name: r.display_name || r.username || 'Alguém',
    avatarUrl: !r.avatar_url ? null : isUrl(r.avatar_url) ? r.avatar_url : (signed.get(r.avatar_url) ?? null),
  }));
}

/** Placar da semana para o painel do PC: carteira + fichas na mesa (games_board), na ordem do placar. */
export async function weekBoard(): Promise<BoardRow[]> {
  const rows = (await rpc<{ user_id: string; balance: number }[]>('games_board')).slice(0, 6);
  const names = await fellas(rows.map((r) => r.user_id)).catch(() => [] as Fella[]);
  return rows.map((r) => ({
    userId: r.user_id,
    balance: r.balance,
    name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém',
  }));
}

export async function idleBoard(): Promise<IdleBoardRow[]> {
  const rows = await rpc<{ user_id: string; valuation: number; era: number; strategies: number[] }[]>('idle_board');
  const quem = await fellas(rows.map((r) => r.user_id));
  return rows.map((r) => ({
    userId: r.user_id, valuation: r.valuation, era: r.era, strategies: r.strategies,
    name: quem.find((f) => f.id === r.user_id)?.name ?? 'Alguém',
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
