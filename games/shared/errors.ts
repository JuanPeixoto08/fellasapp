// Erros do banco e da rede viram um código e uma frase na voz do app.
export type GameErrorCode =
  | 'no_session'
  | 'offline'
  | 'insufficient_credits'
  | 'bet_out_of_range'
  | 'round_open'
  | 'round_done'
  | 'round_not_found'
  | 'fiado_today'
  | 'fiado_not_broke'
  | 'fiado_open_round'
  | 'unknown';

export const ERROR_TEXT: Record<GameErrorCode, string> = {
  no_session: 'Entra no fellas pra jogar',
  offline: 'Sem conexão. Sua mão tá salva.',
  insufficient_credits: 'Saldo não cobre essa aposta',
  bet_out_of_range: 'Aposta vai de 10 a 500',
  round_open: 'Você já tem uma mão aberta',
  round_done: 'Essa mão já acabou',
  round_not_found: 'Essa mão não é sua',
  fiado_today: 'Fiado de hoje já foi. Volta amanhã.',
  fiado_not_broke: 'Fiado é só pra quem zerou',
  fiado_open_round: 'Termina a mão antes do fiado',
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
  'fiado_today',
  'fiado_not_broke',
  'fiado_open_round',
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
