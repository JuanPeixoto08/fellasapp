export const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez'];

/** "7 fev" (mesmo ano) ou "7 fev 2025"; vazio se a data for inválida. */
export function shortDate(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const base = `${d.getDate()} ${MONTHS[d.getMonth()]}`;
  return d.getFullYear() === now.getFullYear() ? base : `${base} ${d.getFullYear()}`;
}

/** "membro desde jan 2026"; null se a data for inválida. */
export function memberSince(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return `membro desde ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Horário de post/comentário: "agora", "há 5 min", "há 3 h"; passado um dia, "ontem 14:32",
 * "3 out 14:32" ou "25 dez 2025 14:32". Data no futuro (relógio adiantado) vira "agora".
 */
export function postTime(iso: string, now: Date = new Date()): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const minutes = Math.floor((now.getTime() - d.getTime()) / 60_000);
  if (minutes < 1) return 'agora';
  if (minutes < 60) return `há ${minutes} min`;
  if (minutes < 24 * 60) return `há ${Math.floor(minutes / 60)} h`;
  const hour = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  if (sameDay(d, yesterday)) return `ontem ${hour}`;
  return `${shortDate(iso, now)} ${hour}`;
}
