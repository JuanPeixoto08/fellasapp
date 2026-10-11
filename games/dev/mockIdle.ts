// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa, têm personagem (dá pra contratar), pontos de prestígio, nós da
// árvore e conquistas (uma escondida, pra aba Legado mostrar o "???"). Nunca entra no build.
import {
  linhaPlacar, type BolsaEstado, type IdleBoardRow, type IdleState, type IdleVisual, type LadoBolsa, type LinhaPlacar, type MelhoriaBolsa,
} from '../shared/types';
import { call, dono, FRIENDS, ME } from './mockDb';

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

// prestígio dos bots: [pontos ganhos na vida, nós da árvore, conquistas]. Oliveira já vendeu e tem a 6-7 (escondida)
const LEGADO: [number, number[], number[]][] = [[12, [1, 11, 21, 41], [1, 31, 39, 47, 51, 101]], [3, [1], [31, 47]], [0, [], []]];

const bots = (async () => {
  for (const [i, [id]] of FRIENDS.entries()) {
    await call('select public.idle_start() as v', [], id).catch(() => undefined);
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
    const [ganhos, nos, conquistas] = LEGADO[i % LEGADO.length];
    const gastos = nos.reduce((a, n) => a + (n === 1 ? 1 : 2), 0); // a raiz custa 1; o 1º de cada ramo, 2
    await dono('update public.idle_state set prestige_earned = $2, prestige_spent = $3, prestige_count = $4 where user_id = $1',
      [id, ganhos, gastos, ganhos ? 1 : 0]);
    for (const n of nos) await dono('insert into public.idle_arvore (user_id, no_id) values ($1, $2) on conflict do nothing', [id, n]);
    for (const c of conquistas) {
      await dono('insert into public.idle_conquistas (user_id, conquista_id) values ($1, $2) on conflict do nothing', [id, c]);
    }
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
export const idlePrestige = () => call<IdleState>('select public.idle_prestige() as v');
export const idleBuyNode = (no: number) => call<IdleState>('select public.idle_buy_node($1) as v', [no]);
export const idleBolsa = () => call<BolsaEstado>('select public.idle_bolsa() as v');
export const idleBolsaNegociar = (empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number) =>
  call<IdleState & { bolsa: BolsaEstado }>('select public.idle_bolsa_negociar($1, $2, $3, $4) as v', [empresa, lado, qtd, tick]);
export const idleBolsaMelhorar = (tipo: MelhoriaBolsa, nivel: number) =>
  call<IdleState & { bolsa: BolsaEstado }>('select public.idle_bolsa_melhorar($1, $2) as v', [tipo, nivel]);
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

// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar;
// __vendavel() deixa sua empresa valendo uns 7 pontos de prestígio (150 foguetes, estratégias escolhidas); __pontos(10) põe 10 pontos de prestígio livres; __trader(3) abre a Bolsa (3 traders e F$ de sobra)
const w = window as unknown as {
  __rico: (v: number) => Promise<void>; __meContrata: () => Promise<void>; __vendavel: (foguetes?: number) => Promise<void>; __pontos: (n: number) => Promise<void>; __trader: (n?: number) => Promise<void>;
};
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
w.__vendavel = async (foguetes = 150) => {
  await dono(`update public.idle_state set generators[30] = $2, strategies = '{0,0,0,0}' where user_id = $1`, [ME, foguetes]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
w.__pontos = async (n) => {
  await dono('update public.idle_state set prestige_earned = prestige_spent + $2 where user_id = $1', [ME, n]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
w.__trader = async (n = 3) => {
  // os traders e um pouco de cada gerador ligado às empresas (o limite de cada uma cresce com ele)
  await dono(`update public.idle_state set generators[19] = $2, generators[18] = greatest(generators[18], 1),
    generators[11] = greatest(generators[11], 20), generators[16] = greatest(generators[16], 5), valuation = 1e15 where user_id = $1`, [ME, n]);
  document.dispatchEvent(new Event('visibilitychange'));
};
