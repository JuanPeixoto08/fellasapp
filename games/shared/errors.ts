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
  | 'idle_not_started'
  | 'idle_started'
  | 'idle_strategy_pending'
  | 'idle_cant_afford'
  | 'idle_locked'
  | 'idle_owned'
  | 'idle_strategy_set'
  | 'idle_bad_choice'
  | 'idle_opp_gone'
  | 'idle_opp_cap'
  | 'idle_hire_self' | 'idle_hire_twice' | 'idle_hire_not_open' | 'idle_bad_avatar'
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
  idle_not_started: 'Abre o CNPJ primeiro',
  idle_started: 'Sua empresa já tá aberta',
  idle_strategy_pending: 'Escolhe a estratégia da era antes',
  idle_cant_afford: 'Valuation não cobre essa compra',
  idle_locked: 'Isso ainda não liberou',
  idle_owned: 'Você já tem essa melhoria',
  idle_strategy_set: 'Essa estratégia já foi escolhida',
  idle_bad_choice: 'Essa opção não existe',
  idle_opp_gone: 'Essa oportunidade já passou',
  idle_opp_cap: 'Chega de oportunidade por hoje',
  idle_hire_self: 'Não dá pra se contratar',
  idle_hire_twice: 'Essa pessoa já trabalha pra você',
  idle_hire_not_open: 'Essa pessoa ainda não abriu a empresa',
  idle_bad_avatar: 'Esse visual não existe',
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
  'idle_not_started',
  'idle_started',
  'idle_strategy_pending',
  'idle_cant_afford',
  'idle_locked',
  'idle_owned',
  'idle_strategy_set',
  'idle_bad_choice',
  'idle_opp_gone',
  'idle_opp_cap',
  'idle_hire_self', 'idle_hire_twice', 'idle_hire_not_open', 'idle_bad_avatar',
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
