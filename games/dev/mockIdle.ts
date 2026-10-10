// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa e têm personagem (dá pra contratar). Nunca entra no build.
import { linhaPlacar, type IdleBoardRow, type IdleState, type IdleVisual, type LinhaPlacar } from '../shared/types';
import { call, FRIENDS, ME } from './mockDb';

// visuais dos bots (ninguém real): Oliveira, Bia, Teteu
const VISUAIS: IdleVisual[] = [
  { pele: 1, cabelo: 3, cor_cabelo: 0, roupa: 1, cor_roupa: 6, acessorio: 1, cor_acessorio: 3 },
  { pele: 4, cabelo: 4, cor_cabelo: 7, roupa: 3, cor_roupa: 8, acessorio: 3, cor_acessorio: 0 },
  { pele: 2, cabelo: 1, cor_cabelo: 1, roupa: 2, cor_roupa: 1, acessorio: 0, cor_acessorio: 0 },
];
const avatar = (v: IdleVisual, as?: string) =>
  call<IdleState>(
    'select public.idle_set_avatar($1, $2, $3, $4, $5, $6, $7) as v',
    [v.pele, v.cabelo, v.cor_cabelo, v.roupa, v.cor_roupa, v.acessorio, v.cor_acessorio],
    as,
  );

const bots = (async () => {
  for (const [i, [id]] of FRIENDS.entries()) {
    await call('select public.idle_start() as v', [], id).catch(() => undefined);
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
  }
})();

export const idleOpen = () => call<IdleState>('select public.idle_open() as v');
export const idleStart = () => call<IdleState>('select public.idle_start() as v');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  call<IdleState>('select public.idle_buy($1, $2, $3) as v', [kind, id, qty]);
export const idlePickStrategy = (era: number, opcao: number) => call<IdleState>('select public.idle_pick_strategy($1, $2) as v', [era, opcao]);
export const idleClaim = (window: number) => call<IdleState>('select public.idle_claim_opportunity($1) as v', [window]);
export const idleHire = (userId: string) => call<IdleState>('select public.idle_hire($1) as v', [userId]);
export const idleSetAvatar = (v: IdleVisual) => avatar(v);
export const hasSession = async () => true;
export const myId = async () => ME;

export async function idleBoard(): Promise<IdleBoardRow[]> {
  await bots;
  const rows = await call<LinhaPlacar[]>('select public.idle_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows.map((r) => linhaPlacar(r, names.find((n) => n.id === r.user_id)?.name ?? 'Alguém'));
}

// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar
const w = window as unknown as { __rico: (v: number) => Promise<void>; __meContrata: () => Promise<void> };
w.__rico = async (v) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await db.query('update public.idle_state set valuation = $2 where user_id = $1', [ME, v]);
};
w.__meContrata = async () => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await bots;
  const [bot] = FRIENDS[0];
  await db.query('update public.idle_state set valuation = 1e15 where user_id = $1', [bot]);
  await call('select public.idle_hire($1) as v', [ME], bot);
};
