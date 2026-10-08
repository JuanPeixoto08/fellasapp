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
};
export type Wallet = {
  balance: number;
  fiado_count: number;
  can_fiado: boolean;
  open_round_id: string | null;
  week_start: string;
};
export type Action = 'hit' | 'stand' | 'double' | 'split';
export type BoardRow = { userId: string; name: string; balance: number };
