// Chamadas ao banco da mesa. Toda falha sai como GameError (código + frase).
import { toGameError } from './errors';
import { assinarFotos } from './fotos';
import { supabase } from './supabase';
import { linhaPlacar } from './types';
import type {
  Action,
  BoardRow,
  BolsaEstado,
  HortaEstado,
  Fella,
  IdleBoardRow,
  IdleState,
  IdleVisual,
  LadoBolsa,
  LinhaPlacar,
  LugarEstado,
  MapaEstado,
  MelhoriaBolsa,
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
export const idleDouradoPegar = (seg: number, lado: number, moedas = 0) =>
  rpc<IdleState>('idle_dourado_pegar', moedas > 0 ? { p_seg: seg, p_lado: lado, p_moedas: moedas } : { p_seg: seg, p_lado: lado }); // sem p_moedas quando é 0: banco velho (sem o parâmetro) ainda atende
export const idleDouradoChamar = () => rpc<IdleState>('idle_dourado_chamar');
export const idleEventoPegar = (seg: number, gols: number) => rpc<IdleState>('idle_evento_pegar', { p_seg: seg, p_gols: gols });
type ComHorta = IdleState & { horta: HortaEstado; descobriu?: number | null };
export const idleHorta = () => rpc<HortaEstado>('idle_horta');
export const idleHortaPlantar = (canteiro: number, especie: number) => rpc<ComHorta>('idle_horta_plantar', { p_canteiro: canteiro, p_especie: especie });
export const idleHortaColher = (canteiro: number) => rpc<ComHorta>('idle_horta_colher', { p_canteiro: canteiro });
export const idleHortaArrancar = (canteiro: number) => rpc<ComHorta>('idle_horta_arrancar', { p_canteiro: canteiro });
export const idleMapa = () => rpc<MapaEstado>('idle_mapa');
export const idleLugar = (lugar: number) => rpc<LugarEstado>('idle_lugar', { p_lugar: lugar });
export const idleLugarAbrir = (lugar: number) => rpc<IdleState & { mapa: MapaEstado }>('idle_place_abrir', { p_lugar: lugar });
export const idleLugarNivel = (lugar: number) => rpc<IdleState & { lugar: LugarEstado; marcos_novos: number[] }>('idle_place_nivel', { p_lugar: lugar });
/** Ação de uma mecânica de lugar (partes 2 a 4): só funções idle_tee_*, idle_cup_* e idle_din_*. */
export const idleLugarAcao = (fn: string, args: Record<string, unknown>) => {
  if (!/^idle_(tee|cup|din)_[a-z_]+$/.test(fn)) throw new Error(`ação de lugar desconhecida: ${fn}`);
  return rpc<IdleState & { lugar: LugarEstado; marcos_novos?: number[] }>(fn, args);
};
export const idleHire = (userId: string) => rpc<IdleState>('idle_hire', { p_user: userId });
export const idlePrestige = () => rpc<IdleState>('idle_prestige');
export const idleBuyNode = (no: number) => rpc<IdleState>('idle_buy_node', { p_no: no });
export const idleBolsa = () => rpc<BolsaEstado>('idle_bolsa');
export const idleBolsaNegociar = (empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number, lote = 1) =>
  rpc<IdleState & { bolsa: BolsaEstado }>('idle_bolsa_negociar', { p_empresa: empresa, p_lado: lado, p_qtd: qtd, p_tick: tick, p_lote: lote });
export const idleBolsaEspiar = (empresa: number) => rpc<IdleState & { bolsa: BolsaEstado }>('idle_bolsa_espiar', { p_empresa: empresa });
export const idleConvSentar = (cadeira: number, convidado: number) =>
  rpc<IdleState & { mesma_pessoa?: boolean }>('idle_conv_sentar', { p_cadeira: cadeira, p_convidado: convidado });
export const idleConvTirar = (cadeira: number) => rpc<IdleState>('idle_conv_tirar', { p_cadeira: cadeira });
export const idleBolsaMelhorar = (tipo: MelhoriaBolsa, nivel: number) =>
  rpc<IdleState & { bolsa: BolsaEstado }>('idle_bolsa_melhorar', { p_tipo: tipo, p_nivel: nivel });
export const idleSetAvatar = (v: IdleVisual) =>
  rpc<IdleState>('idle_set_avatar', {
    p_pele: v.pele, p_cabelo: v.cabelo, p_cor_cabelo: v.cor_cabelo, p_roupa: v.roupa, p_cor_roupa: v.cor_roupa,
    p_acessorio: v.acessorio, p_cor_acessorio: v.cor_acessorio,
  });

const isUrl = (p: string) => /^https?:\/\//.test(p);

/** Nome e foto dos fellas. Avatar no bucket privado: link assinado guardado no aparelho por dias (shared/fotos.ts). */
export async function fellas(ids: string[]): Promise<Fella[]> {
  if (!ids.length) return [];
  const { data, error } = await supabase.from('profiles').select('id, display_name, username, avatar_url').in('id', ids);
  if (error) throw toGameError(error);
  type Row = { id: string; display_name: string | null; username: string | null; avatar_url: string | null };
  const rows = (data ?? []) as Row[];
  const paths = rows.map((r) => r.avatar_url).filter((p): p is string => !!p && !isUrl(p));
  const signed = await assinarFotos(paths, async (faltam, ttl) =>
    (await supabase.storage.from('post-images').createSignedUrls(faltam, ttl)).data ?? []);
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
  const rows = await rpc<LinhaPlacar[]>('idle_board');
  const quem = await fellas(rows.map((r) => r.user_id));
  return rows.map((r) => linhaPlacar(r, quem.find((f) => f.id === r.user_id)?.name ?? 'Alguém'));
}

export async function hasSession(): Promise<boolean> {
  const { data } = await supabase.auth.getSession();
  return !!data.session;
}

export async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}
