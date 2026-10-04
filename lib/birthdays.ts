import { MONTHS } from './format';

export type BirthdayEntry<M> = { member: M; daysUntil: number; label: string };

const DAY_MS = 86_400_000;

/**
 * "AAAA-MM-DD" → mês (0–11) e dia. Sem `new Date(string)`: em UTC-3 ela devolve o dia anterior.
 */
export function parseMonthDay(iso: string | null | undefined): { month: number; day: number } | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { month, day };
}

/** Aniversário no ano dado; 29/02 em ano não bissexto vira 28/02. */
function occurrence(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function birthdayLabel(daysUntil: number, date: Date): string {
  if (daysUntil === 0) return 'Hoje';
  if (daysUntil === 1) return 'Amanhã';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Próximos aniversários a partir de hoje (inclusive), em ordem; quem não preencheu fica de fora. */
export function nextBirthdays<M extends { birthday: string | null }>(
  members: M[],
  today: Date,
  limit = 3,
): BirthdayEntry<M>[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entries: BirthdayEntry<M>[] = [];
  for (const member of members) {
    const md = parseMonthDay(member.birthday);
    if (!md) continue;
    let next = occurrence(start.getFullYear(), md.month, md.day);
    if (next < start) next = occurrence(start.getFullYear() + 1, md.month, md.day);
    // round: dias com 23/25h (horário de verão) não viram 0,96 dia
    const daysUntil = Math.round((next.getTime() - start.getTime()) / DAY_MS);
    entries.push({ member, daysUntil, label: birthdayLabel(daysUntil, next) });
  }
  return entries.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);
}
