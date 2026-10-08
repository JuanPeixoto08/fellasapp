/**
 * Regras das enquetes (mesmos limites da migração 0025): 2 a 4 opções de até 25 caracteres, prazo de
 * 5 minutos a 7 dias escolhido em Dias / Horas / Minutos, como no Twitter.
 */
export const POLL_LIMITS = { minOptions: 2, maxOptions: 4, optionLength: 25, maxDays: 7, minMinutes: 5 } as const;

export type PollDuration = { days: number; hours: number; minutes: number };

export const DEFAULT_POLL_DURATION: PollDuration = { days: 1, hours: 0, minutes: 0 };

const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, Math.round(v)));
const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, i) => from + i);

/** Prazo válido: 7 dias zera horas e minutos; menos de 5 minutos sobe para 5. */
export function normalizeDuration(d: PollDuration): PollDuration {
  const days = clamp(d.days, 0, POLL_LIMITS.maxDays);
  if (days === POLL_LIMITS.maxDays) return { days, hours: 0, minutes: 0 };
  const hours = clamp(d.hours, 0, 23);
  const minutes = clamp(d.minutes, 0, 59);
  if (days === 0 && hours === 0 && minutes < POLL_LIMITS.minMinutes) return { days, hours, minutes: POLL_LIMITS.minMinutes };
  return { days, hours, minutes };
}

export const dayOptions = (): number[] => range(0, POLL_LIMITS.maxDays);

export function hourOptions(d: PollDuration): number[] {
  return d.days === POLL_LIMITS.maxDays ? [0] : range(0, 23);
}

export function minuteOptions(d: PollDuration): number[] {
  if (d.days === POLL_LIMITS.maxDays) return [0];
  return d.days === 0 && d.hours === 0 ? range(POLL_LIMITS.minMinutes, 59) : range(0, 59);
}

export function durationMinutes(d: PollDuration): number {
  return d.days * 24 * 60 + d.hours * 60 + d.minutes;
}

/** Opções que vão para o post: sem espaços nas pontas e sem as vazias. */
export function cleanOptions(options: readonly string[]): string[] {
  return options.map((o) => o.trim()).filter(Boolean);
}

/** Dá pra postar a enquete: tem a pergunta e pelo menos 2 opções preenchidas. */
export function pollReady(body: string, options: readonly string[]): boolean {
  return body.trim().length > 0 && cleanOptions(options).length >= POLL_LIMITS.minOptions;
}

/** Porcentagem de cada opção (arredondada); sem votos, 0% em todas. */
export function pollPercents(counts: readonly number[]): number[] {
  const total = counts.reduce((a, b) => a + b, 0);
  return counts.map((c) => (total ? Math.round((c * 100) / total) : 0));
}

/** Índices das mais votadas (empate vale todas); sem votos, nenhuma. */
export function pollWinners(counts: readonly number[]): number[] {
  const max = Math.max(0, ...counts);
  return max ? counts.flatMap((c, i) => (c === max ? [i] : [])) : [];
}

export function votesLabel(total: number): string {
  return `${total} ${total === 1 ? 'voto' : 'votos'}`;
}

const plural = (n: number, unit: string, units = unit) => `${n === 1 ? 'falta' : 'faltam'} ${n} ${n === 1 ? unit : units}`;

/** "faltam 2 dias", "falta 1 h", "faltam 12 min", "menos de 1 min"; null quando acabou. */
export function pollTimeLeft(endsAt: string, now: number = Date.now()): string | null {
  const ms = Date.parse(endsAt) - now;
  if (!(ms > 0)) return null;
  const minutes = Math.floor(ms / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  if (days >= 1) return plural(days, 'dia', 'dias');
  if (hours >= 1) return plural(hours, 'h');
  if (minutes >= 1) return plural(minutes, 'min');
  return 'menos de 1 min';
}
