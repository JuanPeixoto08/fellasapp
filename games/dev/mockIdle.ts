// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa para o placar ter gente. Nunca entra no build.
import type { IdleBoardRow, IdleState } from '../shared/types';
import { call, FRIENDS, ME } from './mockDb';

const bots = (async () => {
  for (const [id] of FRIENDS) await call('select public.idle_start() as v', [], id).catch(() => undefined);
})();

export const idleOpen = () => call<IdleState>('select public.idle_open() as v');
export const idleStart = () => call<IdleState>('select public.idle_start() as v');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  call<IdleState>('select public.idle_buy($1, $2, $3) as v', [kind, id, qty]);
export const idlePickStrategy = (era: number, opcao: number) => call<IdleState>('select public.idle_pick_strategy($1, $2) as v', [era, opcao]);
export const idleClaim = (window: number) => call<IdleState>('select public.idle_claim_opportunity($1) as v', [window]);
export const hasSession = async () => true;
export const myId = async () => ME;

export async function idleBoard(): Promise<IdleBoardRow[]> {
  await bots;
  const rows = await call<{ user_id: string; valuation: number; rate: number; era: number; strategies: number[] }[]>('select public.idle_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows.map((r) => ({ userId: r.user_id, valuation: r.valuation, rate: r.rate, era: r.era, strategies: r.strategies, name: names.find((n) => n.id === r.user_id)?.name ?? 'Alguém' }));
}

// console do dev: __rico(1e12) põe valuation na sua empresa para testar o resto do jogo
(window as unknown as { __rico: (v: number) => Promise<void> }).__rico = async (v) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await db.query('update public.idle_state set valuation = $2 where user_id = $1', [ME, v]);
};
