// Formatos que as funções do banco devolvem (0027 e 0028). Carta = número 0–51, igual ao banco.
export type Card = number;
export type HandResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';
export type Hand = {
  cards: Card[];
  bet: number;
  doubled: boolean;
  from_split_aces: boolean;
  done: boolean;
  result: HandResult | null;
};
export type RoundState = {
  id: string;
  status: 'playing' | 'done';
  bet: number;
  hands: Hand[];
  active: number;
  /** Só as cartas visíveis: a de cima durante o jogo; todas no fim. */
  dealer: Card[];
  dealer_total: number;
  payout: number;
  /** Saldo da carteira depois da jogada. */
  balance: number;
  /** Dá pra pegar fiado agora (quebrou na mesa: a tela não precisa perguntar de novo). */
  can_fiado: boolean;
};
export type Wallet = {
  balance: number;
  fiado_count: number;
  can_fiado: boolean;
  open_round_id: string | null;
  week_start: string;
  /** Fichas na mesa de poker (0030); null = não está sentado. */
  seated_stack?: number | null;
};
export type Action = 'hit' | 'stand' | 'double' | 'split';
export type BoardRow = { userId: string; name: string; balance: number };

// Poker (0030): o retrato público da mesa (poker_tables.state) e o que só eu vejo.
export type PokerLast = 'sb' | 'bb' | 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerPlayer = {
  user_id: string;
  /** Aposta nesta rodada. */
  bet: number;
  /** Tudo que pôs na mão. */
  total: number;
  folded: boolean;
  all_in: boolean;
  acted: boolean;
  /** Depois de um all-in curto: só paga ou corre. */
  capped: boolean;
  last: PokerLast | null;
  timed_out: boolean;
};
export type PokerSeat = {
  seat: number;
  user_id: string;
  stack: number;
  status: 'playing' | 'away';
  wait_bb: boolean;
  leaving: boolean;
  busted: boolean;
};
export type PokerPot = { amount: number; winners: number[]; name: string | null };
export type PokerResults = {
  showdown: boolean;
  pots: PokerPot[];
  payouts: Record<string, number>;
  hands: Record<string, string>;
};
export type PokerHand = {
  id: string;
  no: number;
  status: 'betting' | 'done' | 'void';
  street: 'preflop' | 'flop' | 'turn' | 'river' | 'showdown';
  board: Card[];
  /** Por lugar ("0".."5"). */
  players: Record<string, PokerPlayer>;
  pot: number;
  current_bet: number;
  min_raise_to: number;
  to_act: number | null;
  action_no: number;
  deadline: string | null;
  button: number;
  sb: number;
  bb: number;
  runout: boolean;
  results: PokerResults | null;
  shown: Record<string, Card[]>;
};
export type PokerState = {
  seq: number;
  server_now: string;
  closed: boolean;
  next_hand_at: string | null;
  blinds: [number, number];
  buyin: [number, number];
  seats: PokerSeat[];
  hand: PokerHand | null;
  /** Só na resposta das funções (não no tempo real). */
  me?: { rathole_min: number | null };
};
export type PokerCards = { hand_id: string; cards: Card[] } | null;
export type PokerAction = 'fold' | 'check' | 'call' | 'raise' | 'allin';
export type PokerHistoryRow = {
  id: string;
  no: number;
  board: Card[];
  results: PokerResults;
  shown: Record<string, Card[]>;
  players: Record<string, string>;
  ended_at: string;
};
export type Fella = { id: string; name: string; avatarUrl: string | null };

// Fellas Inc. (0034): o estado que toda função do idle devolve
export type IdleState = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number;
  generators: number[]; upgrades: number[]; strategies: number[]; era: number;
  boost_until: string | null; half_price: boolean; opp_claimed: number[]; opp_left: number; server_now: string;
};
export type IdleBoardRow = { userId: string; name: string; valuation: number; rate: number; era: number; strategies: number[] };

// Fellas Inc., entrega 2 (0038): o visual do personagem como o banco guarda (índices das opções do editor)
export type IdleVisual = {
  pele: number; cabelo: number; cor_cabelo: number; roupa: number; cor_roupa: number; acessorio: number; cor_acessorio: number;
};
