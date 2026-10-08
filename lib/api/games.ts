import type { Database } from '../../types/database';
import { getMemberDirectory } from '../memberDirectory';
import type { MentionMember } from '../mentions';
import { supabase } from '../supabase';

/**
 * Fellas Games no app: saldo da semana, fiado, placar e o campeão da semana passada (0027).
 * Quem mexe nos créditos é o banco; aqui só se lê e se pede o fiado. Nome e foto vêm do diretório de membros.
 */
export type Wallet = {
  balance: number;
  fiadoCount: number;
  canFiado: boolean;
  openRoundId: string | null;
  weekStart: string;
  /** Fichas na mesa de poker (null = não está sentado). */
  seatedStack: number | null;
};
export type PokerTable = { count: number; seated: boolean };
export type LeaderRow = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  balance: number;
  fiadoCount: number;
};
export type Champion = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  balance: number;
  weekStart: string;
};

type WalletRow = {
  balance: number;
  fiado_count: number;
  can_fiado: boolean;
  open_round_id: string | null;
  week_start: string;
  seated_stack?: number | null;
};
type BoardRow = { user_id: string; balance: number; fiado_count: number };
type WeekRow = Database['public']['Tables']['game_weeks']['Row'];

/** Aposta mínima da mesa: abaixo disso não dá pra jogar (e o fiado libera). */
export const MIN_BET = 10;

export const GAMES_ERRORS = {
  load: 'Não deu pra carregar o placar. Tenta de novo.',
  fiado: 'Não deu pra pegar o fiado. Tenta de novo.',
  fiadoToday: 'Fiado de hoje já foi. Volta amanhã.',
  fiadoSeated: 'Levanta da mesa de poker pra pegar fiado',
};

const toWallet = (w: WalletRow): Wallet => ({
  balance: w.balance,
  fiadoCount: w.fiado_count,
  canFiado: w.can_fiado,
  openRoundId: w.open_round_id,
  weekStart: w.week_start,
  seatedStack: w.seated_stack ?? null,
});

function who(id: string) {
  const m = getMemberDirectory().find((x) => x.id === id);
  // saiu do grupo, ou o diretório ainda não carregou: a linha continua aparecendo
  return { name: m?.name ?? 'Alguém', username: m?.username ?? '', avatarUrl: m?.avatarUrl ?? null };
}

/**
 * Nome e foto atuais do diretório por cima do que veio na busca. A lista de fellas carrega por conta própria
 * e pode chegar depois do placar (voltando da mesa o app reabre direto na aba): sem isso ficava "Alguém".
 */
export function withMember<T extends { userId: string; name: string; username: string; avatarUrl: string | null }>(
  row: T,
  members: MentionMember[],
): T {
  const m = members.find((x) => x.id === row.userId);
  return m ? { ...row, name: m.name, username: m.username, avatarUrl: m.avatarUrl } : row;
}

/** Minha carteira; o banco cria com 1.000 no primeiro acesso. */
export async function getWallet(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('games_wallet');
  if (error) throw error;
  return toWallet(data as WalletRow);
}

/** +100 com saldo 0, uma vez por dia; o banco confere. */
export async function takeFiado(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('games_fiado');
  if (error) throw error;
  return toWallet(data as WalletRow);
}

/** Placar da semana pelo banco: carteira + fichas na mesa de poker; só quem jogou; ordem do placar. */
export async function getLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase.rpc('games_board');
  if (error) throw error;
  return ((data ?? []) as BoardRow[]).map((r) => ({
    userId: r.user_id,
    balance: r.balance,
    fiadoCount: r.fiado_count,
    ...who(r.user_id),
  }));
}

/** Quantos estão sentados na mesa de poker agora e se eu sou um deles (retrato público da mesa, 0030). */
export async function getPokerTable(me: string | null): Promise<PokerTable> {
  const { data, error } = await supabase.from('poker_tables').select('state').eq('id', 1).maybeSingle();
  if (error) throw error;
  const seats = (data?.state as { seats?: { user_id: string }[] } | null)?.seats ?? [];
  return { count: seats.length, seated: !!me && seats.some((s) => s.user_id === me) };
}

/** Campeão da última semana fechada (null na primeira semana ou se ninguém jogou). */
export async function getLastChampion(): Promise<Champion | null> {
  const { data, error } = await supabase
    .from('game_weeks')
    .select('week_start, champion_id, podium')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  const week = data as Pick<WeekRow, 'week_start' | 'champion_id' | 'podium'> | null;
  if (!week?.champion_id) return null;
  const podium = week.podium as { balance: number }[];
  return { userId: week.champion_id, weekStart: week.week_start, balance: podium[0]?.balance ?? 0, ...who(week.champion_id) };
}

export function gamesErrorMessage(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (msg.includes('fiado_today')) return GAMES_ERRORS.fiadoToday;
  if (msg.includes('fiado_seated')) return GAMES_ERRORS.fiadoSeated;
  if (msg.includes('fiado')) return GAMES_ERRORS.fiado;
  return GAMES_ERRORS.load;
}
