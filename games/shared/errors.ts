// Erros do banco e da rede viram um código e uma frase na voz do app.
export type GameErrorCode =
  | 'no_session'
  | 'offline'
  | 'insufficient_credits'
  | 'bet_out_of_range'
  | 'round_open'
  | 'round_done'
  | 'round_not_found'
  | 'invalid_action'
  | 'fiado_today'
  | 'fiado_not_broke'
  | 'fiado_open_round'
  | 'fiado_seated'
  | 'seat_taken'
  | 'already_seated'
  | 'buyin_out_of_range'
  | 'rathole_min'
  | 'not_seated'
  | 'not_your_turn'
  | 'stale_seq'
  | 'raise_too_small'
  | 'raise_too_big'
  | 'rebuy_in_hand'
  | 'rebuy_out_of_range'
  | 'nothing_to_show'
  | 'unknown';

export const ERROR_TEXT: Record<GameErrorCode, string> = {
  no_session: 'Entra no fellas pra jogar',
  offline: 'Sem conexão. Sua mão tá salva.',
  insufficient_credits: 'Saldo não cobre essa aposta',
  bet_out_of_range: 'Aposta vai de 10 a 500',
  round_open: 'Você já tem uma mão aberta',
  round_done: 'Essa mão já acabou',
  round_not_found: 'Essa mão não é sua',
  invalid_action: 'Essa jogada não vale mais. A mesa foi atualizada.',
  fiado_today: 'Fiado de hoje já foi. Volta amanhã.',
  fiado_not_broke: 'Fiado só sai quando não dá pra apostar',
  fiado_open_round: 'Termina a mão antes do fiado',
  fiado_seated: 'Levanta da mesa de poker pra pegar fiado',
  seat_taken: 'Alguém sentou aí primeiro',
  already_seated: 'Você já está na mesa',
  buyin_out_of_range: 'Entrada vai de 200 a 500',
  rathole_min: 'Você levantou há pouco: volta com pelo menos o que levou',
  not_seated: 'Você não está na mesa',
  not_your_turn: 'Ainda não é sua vez',
  stale_seq: 'A mesa mudou',
  raise_too_small: 'Aumento menor que o mínimo',
  raise_too_big: 'Você não tem tudo isso',
  rebuy_in_hand: 'Completa quando a mão acabar',
  rebuy_out_of_range: 'Completa de 10 em 10, até 500 na mesa',
  nothing_to_show: 'Não tem carta pra mostrar agora',
  unknown: 'Deu ruim aqui. Tenta de novo.',
};

export class GameError extends Error {
  readonly code: GameErrorCode;
  constructor(code: GameErrorCode) {
    super(ERROR_TEXT[code]);
    this.code = code;
  }
}

const FROM_DB: GameErrorCode[] = [
  'insufficient_credits',
  'bet_out_of_range',
  'round_open',
  'round_done',
  'round_not_found',
  'invalid_action',
  'fiado_today',
  'fiado_not_broke',
  'fiado_open_round',
  'fiado_seated',
  'seat_taken',
  'already_seated',
  'buyin_out_of_range',
  'rathole_min',
  'not_seated',
  'not_your_turn',
  'stale_seq',
  'raise_too_small',
  'raise_too_big',
  'rebuy_in_hand',
  'rebuy_out_of_range',
  'nothing_to_show',
];

export function toGameError(e: unknown): GameError {
  if (e instanceof GameError) return e;
  const err = (e ?? {}) as { message?: string; status?: number; code?: string; name?: string };
  const msg = err.message ?? '';
  // fetch que falhou (direto, ou embrulhado pelo supabase-js como "TypeError: Failed to fetch")
  if (/failed to fetch|networkerror|network request failed|load failed/i.test(msg)) return new GameError('offline');
  if (err.status === 401 || /jwt|not_member/i.test(msg) || err.code === '42501') return new GameError('no_session');
  const known = FROM_DB.find((c) => msg.includes(c));
  return new GameError(known ?? 'unknown');
}
