# Fellas Games + Blackjack — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Créditos semanais (saldo, fiado, placar, reset de segunda, troféu do campeão) e o Blackjack 3D jogável no celular e no PC, com toda a regra no banco.

**Architecture:** Duas migrações (0027 créditos, 0028 blackjack) com funções `security definer`: o aparelho só
chama `games_wallet`, `games_fiado`, `bj_deal`, `bj_act`, `bj_current`; o baralho mora em `bj_secrets`, que
ninguém lê. A mesa é um projeto Vite + Three.js em `games/`, publicado em `/games/blackjack/` na mesma origem do
app (sessão do Supabase compartilhada). No app, a 5ª aba "Games" (`app/(tabs)/games.tsx`) mostra saldo, placar
e campeão e abre a mesa.

**Tech Stack:** Postgres/Supabase (PL/pgSQL, pg_cron), Vite 8.3.4, three 0.186.1, TypeScript ~6.0.3,
vitest 5.0.3, @electric-sql/pglite 0.5.8 (testes do banco), Expo Router / RN (+ web), Jest + RNTL.

**Spec:** `docs/superpowers/specs/2026-10-08-fellas-games-blackjack-design.md`

**Visual de referência (copiar CSS e medidas daqui):** `.superpowers/brainstorm/2028-1791463603/content/`
— `fichas.html` (mesa no celular: cena, plaquinhas, painel, fichas de cassino, botões moeda — fonte da verdade),
`pc-layout.html` (mesa no PC e aba Fellas Games larga), `blackjack-visual.html` (selo de troféu, SVG).
Essa pasta está no `.gitignore`: ela existe na máquina do Juan; não apagar.

## Global Constraints
- Texto da interface em pt-BR, na voz do `PRODUCT.md` ("Bora de novo", "Pegar fiado (+100)"); botões dizem a ação.
- No app: só tokens de `lib/theme.ts` e primitivos de `components/ui`; tema claro/escuro via `useTheme()`.
  A mesa (`games/`) tem visual próprio (feltro), com as cores dos mockups em variáveis CSS num só arquivo.
- `npx tsc --noEmit` e `npm test` verdes na raiz a cada tarefa; em `games/`, `npm test --prefix games` e
  `npx tsc --noEmit -p games`.
- Créditos: início/reset 1.000; aposta 10–500; fiado +100, 1×/dia (dia de `America/Sao_Paulo`), só com saldo 0
  e sem mão aberta; reset segunda 00:00 Brasília = cron `0 3 * * 1` (UTC).
- Funções do app: `security definer`, `set search_path = public`, `revoke all ... from public, anon`,
  `grant execute ... to authenticated`, checam `is_member()` (erro `not_member`, errcode `42501`).
  Funções internas: `revoke all ... from public, anon, authenticated` (o Supabase dá execute a anon/authenticated
  por padrão em funções novas do `public`; revogar de `public` sozinho não basta).
- Tabelas novas: RLS ligado, `revoke all ... from anon, authenticated`, depois só `grant select` onde há leitura.
- Erros do banco: `raise exception '<codigo>' using errcode = 'P0001'` (códigos da spec, seção 1).
- Sem dependência nova no app (raiz). `three`, `vite`, `vitest`, `pglite` só em `games/package.json`.
- Git: branch `feature/fellas-games`; commits por tarefa; merge local na main + push só nos dois pontos de
  publicação (Tarefas 11 e 13), e o push 1 só depois de o Juan aplicar a migração e as colunas serem conferidas.

## Review Focus
- **Toque duplo / duas abas** mandando Pedir ao mesmo tempo → a segunda espera a primeira (`for update`) e é
  conferida contra o estado novo; na mesa, botões travados enquanto há pedido em voo. (Tarefa 4: `hit` depois de
  a mão fechar dá `round_done`; Tarefa 8: `machine` ignora ação com `busy`.)
- **Saldo mudou em outra aba** (fichas acesas com saldo velho) → `insufficient_credits` vira "Saldo não cobre
  essa aposta" e o saldo é recarregado. (Tarefa 8.)
- **A semana virou com a mesa aberta** → a próxima ação dá `round_done`; a mesa recarrega a carteira, vê
  `week_start` novo e mostra "A semana virou! …". (Tarefa 8.)
- **Sessão expirada / saiu do app** com a mesa aberta → erro de auth vira "Entra no fellas pra jogar", não
  "erro desconhecido". (Tarefa 8: `toGameError` com status 401 e `not_member`.)
- **Primeira semana** (sem `game_weeks`, ninguém jogou, eu sem carteira) → aba sem a seção do campeão, placar
  vazio com convite, saldo 1.000 criado no primeiro acesso. (Tarefa 2 e Tarefa 12.)

---

### Task 1: Projeto `games/`, raiz isolada e banco de teste (PGlite)

**Files:**
- Create: `games/package.json`, `games/tsconfig.json`, `games/vite.config.ts`, `games/vitest.config.ts`,
  `games/env.d.ts`, `games/test/db.ts`, `games/test/db.test.ts`, `games/.gitignore`
- Modify: `tsconfig.json` (raiz), `jest.config.js`

**Interfaces:**
- Produces: `freshDb(): Promise<TestDb>`; `TestDb = { db: PGlite; as(uid: string | null): Promise<void>;
  rpc<T>(fn: string, args?: Record<string, unknown>): Promise<T>; asRole<T>(role: 'authenticated' | 'anon',
  sql: string): Promise<T[]>; member(uid: string, opts?: { username?: string; isMember?: boolean }): Promise<void> }`.
  Migrações carregadas pela lista `MIGRATIONS` em `db.ts` (a Tarefa 2 adiciona a 0027, a 3 a 0028).

- [ ] **Step 1: Isolar a raiz.** `tsconfig.json`: acrescentar `"exclude": ["games", "dist", "node_modules"]`.
  `jest.config.js`: `testPathIgnorePatterns: ['/node_modules/', '/dist/', '/games/']`.
- [ ] **Step 2: `games/package.json`**

```json
{
  "name": "fellas-games",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "test": "vitest run"
  },
  "dependencies": {
    "@supabase/supabase-js": "2.117.3",
    "three": "0.186.1"
  },
  "devDependencies": {
    "@electric-sql/pglite": "0.5.8",
    "@types/three": "0.186.0",
    "typescript": "~6.0.3",
    "vite": "8.3.4",
    "vitest": "5.0.3"
  }
}
```

  `games/.gitignore`: `node_modules/`. `games/tsconfig.json`: `{"compilerOptions": {"target": "ES2022",
  "module": "ESNext", "moduleResolution": "bundler", "strict": true, "lib": ["ES2022", "DOM", "DOM.Iterable"],
  "types": ["vite/client", "node"], "noEmit": true, "skipLibCheck": true}, "include": ["**/*.ts"],
  "exclude": ["node_modules"]}` (instalar `@types/node` se o `tsc` pedir, mesma versão major do Node 22).
  `games/env.d.ts`: `interface ImportMetaEnv { readonly EXPO_PUBLIC_SUPABASE_URL: string; readonly
  EXPO_PUBLIC_SUPABASE_ANON_KEY: string }`.
- [ ] **Step 3: `vite.config.ts` e `vitest.config.ts`**

```ts
// games/vite.config.ts — páginas dos jogos, publicadas em /games/<jogo>/ junto com o app (dist/).
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

export default defineConfig({
  base: '/games/',
  envPrefix: 'EXPO_PUBLIC_', // mesmos segredos do build do app
  envDir: resolve(__dirname, '..'), // lê o .env da raiz no dev
  build: {
    outDir: resolve(__dirname, '../dist/games'),
    emptyOutDir: false, // o dist/ é do Expo: nunca apagar
    rollupOptions: { input: { blackjack: resolve(__dirname, 'blackjack/index.html') } },
  },
});
```

```ts
// games/vitest.config.ts
import { defineConfig } from 'vitest/config';
export default defineConfig({ test: { include: ['**/*.test.ts'], exclude: ['node_modules/**'], testTimeout: 20000 } });
```

- [ ] **Step 4: Teste do esqueleto (falha: `db.ts` não existe)** — `games/test/db.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { freshDb } from './db';

describe('banco de teste', () => {
  it('auth.uid() segue o usuário escolhido e is_member() lê o perfil', async () => {
    const t = await freshDb();
    await t.member('00000000-0000-0000-0000-000000000001');
    await t.as('00000000-0000-0000-0000-000000000001');
    const [{ ok }] = (await t.db.query<{ ok: boolean }>('select public.is_member() as ok')).rows;
    expect(ok).toBe(true);
    await t.as(null);
    expect((await t.db.query<{ ok: boolean }>('select public.is_member() as ok')).rows[0].ok).toBe(false);
  });

  it('troca de papel funciona (RLS testável)', async () => {
    const t = await freshDb();
    const rows = await t.asRole<{ r: string }>('authenticated', 'select current_user::text as r');
    expect(rows[0].r).toBe('authenticated');
  });
});
```

  Run: `npm install --prefix games` e `npm test --prefix games` → FAIL (módulo `./db` não existe).
- [ ] **Step 5: `games/test/db.ts`**

```ts
// Postgres de verdade (PGlite) com o mínimo do Supabase que as migrações dos jogos usam.
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const MIGRATIONS: string[] = []; // Tarefa 2: '0027_fellas_games.sql'; Tarefa 3: '0028_blackjack.sql'

const SKELETON = `
create role anon nologin; create role authenticated nologin;
grant usage on schema public to anon, authenticated;
create schema auth; grant usage on schema auth to anon, authenticated;
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('test.uid', true), '')::uuid $$;
grant execute on function auth.uid() to anon, authenticated;
create table public.profiles (
  id uuid primary key, username text, display_name text, is_member boolean not null default true,
  badges text[] not null default '{}', featured_badge text);
alter table public.profiles enable row level security;
create policy profiles_select on public.profiles for select to authenticated using (true);
grant select on public.profiles to authenticated;
create function public.is_member() returns boolean language sql stable security definer set search_path = public as
  $$ select coalesce((select is_member from public.profiles where id = auth.uid()), false) $$;
grant execute on function public.is_member() to anon, authenticated;
create schema cron;
create table cron.jobs (name text primary key, schedule text, command text);
create function cron.schedule(n text, s text, c text) returns bigint language sql as
  $$ insert into cron.jobs values (n, s, c) on conflict (name) do update set schedule = s, command = c; select 1::bigint $$;
`;

export type TestDb = Awaited<ReturnType<typeof freshDb>>;

export async function freshDb() {
  const db = new PGlite();
  await db.exec(SKELETON);
  for (const name of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8'));
  }
  const t = {
    db,
    async as(uid: string | null) {
      await db.query(`select set_config('test.uid', $1, false)`, [uid ?? '']);
    },
    async member(uid: string, opts: { username?: string; isMember?: boolean } = {}) {
      await db.query(
        `insert into public.profiles (id, username, display_name, is_member) values ($1, $2, $2, $3)`,
        [uid, opts.username ?? uid.slice(-4), opts.isMember ?? true],
      );
    },
    /** Chama a função como `authenticated` (o papel do app), devolvendo o jsonb/escalar. */
    async rpc<T>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
      const names = Object.keys(args);
      const call = `select public.${fn}(${names.map((n, i) => `${n} => $${i + 1}`).join(', ')}) as v`;
      const rows = await t.asRole<{ v: T }>('authenticated', call, Object.values(args));
      return rows[0].v;
    },
    async asRole<T>(role: 'authenticated' | 'anon', sql: string, params: unknown[] = []): Promise<T[]> {
      await db.exec(`set role ${role}`);
      try {
        return (await db.query<T>(sql, params)).rows;
      } finally {
        await db.exec('reset role');
      }
    },
  };
  return t;
}
export { MIGRATIONS };
```

  Run: `npm test --prefix games` → PASS. **Se `set role` falhar no PGlite** (risco da spec): trocar `asRole`
  para só rodar a consulta (sem papel) e marcar, nas tarefas 2–4, os testes de permissão com `it.skip` + um
  teste de texto equivalente na raiz (`__tests__/fellasGamesMigration.test.ts`); anotar no commit.
- [ ] **Step 6: Raiz continua verde** — `npx tsc --noEmit` e `npm test` na raiz (nada de `games/` entra).
- [ ] **Step 7: Commit** — `git checkout -b feature/fellas-games`; `git add games tsconfig.json jest.config.js`;
  `git commit -m "Fellas Games: projeto games/ (Vite) isolado da raiz e banco de teste com PGlite"`.

---

### Task 2: Migração 0027 — créditos, fiado, placar e reset

**Files:**
- Create: `supabase/migrations/0027_fellas_games.sql`, `games/test/credits.test.ts`,
  `__tests__/fellasGamesMigration.test.ts`
- Modify: `games/test/db.ts` (`MIGRATIONS = ['0027_fellas_games.sql']`)

**Interfaces:**
- Produces (SQL): `games_week_start(timestamptz default now()) returns date`; `games_today() returns date`;
  tabelas `game_wallets`, `game_ledger`, `game_weeks`; app: `games_wallet() returns jsonb`,
  `games_fiado() returns jsonb` → `{balance:int, fiado_count:int, can_fiado:bool, open_round_id:uuid|null,
  week_start:date}`; internas: `games_ensure_wallet(uuid) returns game_wallets` (cria + trava `for update`),
  `games_move(p_user uuid, p_delta int, p_reason text, p_round uuid default null) returns int` (novo saldo;
  `insufficient_credits` se ficaria negativo), `games_wallet_json(game_wallets) returns jsonb`, ganchos
  `games_open_round(uuid) returns uuid` e `games_close_open_rounds() returns void`,
  `games_weekly_reset() returns void`; job de cron `fellas-games-reset`.

- [ ] **Step 1: Testes que falham** — `games/test/credits.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const OUT = '00000000-0000-0000-0000-0000000000ff';
type Wallet = { balance: number; fiado_count: number; can_fiado: boolean; open_round_id: string | null; week_start: string };

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const setBalance = (uid: string, b: number) => q('update public.game_wallets set balance = $2 where user_id = $1', [uid, b]);
const played = (uid: string, at = 'now()') => q(`update public.game_wallets set last_played_at = ${at} where user_id = $1`, [uid]);
const ageWeek = () => q(`update public.game_wallets set week_start = week_start - 7`);

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B, C]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

describe('games_wallet', () => {
  it('primeira vez cria com 1.000 (extrato "start") e devolve o formato', async () => {
    const w = await t.rpc<Wallet>('games_wallet');
    expect(w).toMatchObject({ balance: 1000, fiado_count: 0, can_fiado: false, open_round_id: null });
    expect(await q('select delta, reason from public.game_ledger')).toEqual([{ delta: 1000, reason: 'start' }]);
    await t.rpc('games_wallet');
    expect(await q('select count(*)::int as n from public.game_ledger')).toEqual([{ n: 1 }]);
  });
  it('não membro é barrado', async () => {
    await t.as(OUT);
    await expect(t.rpc('games_wallet')).rejects.toThrow(/not_member/);
  });
});

describe('games_fiado', () => {
  it('só com saldo 0, +100 uma vez por dia', async () => {
    await t.rpc('games_wallet');
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_not_broke/);
    await setBalance(A, 0);
    expect((await t.rpc<Wallet>('games_wallet')).can_fiado).toBe(true);
    const w = await t.rpc<Wallet>('games_fiado');
    expect(w).toMatchObject({ balance: 100, fiado_count: 1, can_fiado: false });
    await setBalance(A, 0);
    await expect(t.rpc('games_fiado')).rejects.toThrow(/fiado_today/);
    await q(`update public.game_wallets set last_fiado_on = last_fiado_on - 1`);
    expect((await t.rpc<Wallet>('games_fiado')).fiado_count).toBe(2);
  });
});

describe('games_move', () => {
  it('nunca deixa negativo', async () => {
    await t.rpc('games_wallet');
    await expect(q(`select public.games_move($1, -1001, 'bet')`, [A])).rejects.toThrow(/insufficient_credits/);
    expect(await q(`select public.games_move($1, -1000, 'bet') as b`, [A])).toEqual([{ b: 0 }]);
  });
});

describe('games_weekly_reset', () => {
  async function threePlayers() {
    for (const u of [A, B, C]) { await t.as(u); await t.rpc('games_wallet'); }
    await setBalance(A, 2000); await played(A, `now() - interval '1 hour'`);
    await setBalance(B, 2000); await played(B, `now() - interval '2 hours'`);
    await q('update public.game_wallets set fiado_count = 1 where user_id = $1', [B]);
    await setBalance(C, 500); // C não jogou: fica fora do pódio
  }

  it('mesma semana: não faz nada', async () => {
    await threePlayers();
    await q('select public.games_weekly_reset()');
    expect(await q('select count(*)::int as n from public.game_weeks')).toEqual([{ n: 0 }]);
  });

  it('semana virou: pódio com desempate, troféu passa, todo mundo 1.000; rodar de novo não muda nada', async () => {
    await threePlayers();
    await q(`update public.profiles set badges = '{weekly_champion}' where id = $1`, [C]); // campeão anterior
    await ageWeek();
    await q('select public.games_weekly_reset()');
    const [week] = await q<{ champion_id: string; podium: { user_id: string }[] }>('select * from public.game_weeks');
    expect(week.champion_id).toBe(A); // empate em 2.000: A pegou menos fiado
    expect(week.podium.map((p) => p.user_id)).toEqual([A, B]);
    expect(await q('select id, badges from public.profiles where id in ($1, $2) order by id', [A, C]))
      .toEqual([{ id: A, badges: ['weekly_champion'] }, { id: C, badges: [] }]);
    expect(await q('select distinct balance, fiado_count, last_played_at from public.game_wallets'))
      .toEqual([{ balance: 1000, fiado_count: 0, last_played_at: null }]);
    await q('select public.games_weekly_reset()');
    expect(await q('select count(*)::int as n from public.game_weeks')).toEqual([{ n: 1 }]);
  });

  it('ninguém jogou: semana registrada sem campeão, ninguém ganha selo', async () => {
    await t.rpc('games_wallet');
    await ageWeek();
    await q('select public.games_weekly_reset()');
    expect(await q('select champion_id from public.game_weeks')).toEqual([{ champion_id: null }]);
  });

  it('cron agendado segunda 03:00 UTC', async () => {
    expect(await q('select schedule from cron.jobs where name = $1', ['fellas-games-reset'])).toEqual([{ schedule: '0 3 * * 1' }]);
  });
});

describe('permissões', () => {
  it('app lê o placar mas não escreve; extrato só o próprio; reset proibido', async () => {
    await t.rpc('games_wallet'); await t.as(B); await t.rpc('games_wallet');
    expect(await t.asRole('authenticated', 'select user_id from public.game_wallets')).toHaveLength(2);
    expect(await t.asRole('authenticated', 'select user_id from public.game_ledger')).toEqual([{ user_id: B }]);
    await expect(t.asRole('authenticated', 'update public.game_wallets set balance = 9999')).rejects.toThrow();
    await expect(t.asRole('authenticated', `insert into public.game_ledger (user_id, delta, reason) values ('${B}', 1, 'win')`)).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select public.games_weekly_reset()')).rejects.toThrow();
    await expect(t.asRole('authenticated', `select public.games_move('${B}', 500, 'win')`)).rejects.toThrow();
    await expect(t.asRole('anon', 'select * from public.game_wallets')).rejects.toThrow();
  });
});
```

  Também adicionar `'0027_fellas_games.sql'` a `MIGRATIONS`. Run `npm test --prefix games` → FAIL (arquivo não existe).
- [ ] **Step 2: Migração** — `supabase/migrations/0027_fellas_games.sql`:

```sql
-- fellasapp: Fellas Games — créditos semanais (de mentira), fiado, placar e troféu do campeão. Idempotente.
-- Todo mundo começa a semana com 1.000; segunda 00:00 de Brasília o cron grava o pódio, passa o selo
-- weekly_champion para o campeão e volta todo mundo para 1.000. O app só lê; quem escreve são as funções.
-- Os jogos (0028 em diante) estendem os ganchos games_open_round / games_close_open_rounds.

create or replace function public.games_week_start(ts timestamptz default now())
returns date language sql stable as $$ select date_trunc('week', ts at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.games_today()
returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create table if not exists public.game_wallets (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  balance        int not null check (balance >= 0),
  week_start     date not null,
  fiado_count    int not null default 0,
  last_fiado_on  date,
  last_played_at timestamptz,
  updated_at     timestamptz not null default now()
);

create table if not exists public.game_ledger (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  delta      int not null,
  reason     text not null check (reason in ('start', 'bet', 'win', 'push', 'fiado', 'reset')),
  round_id   uuid,
  created_at timestamptz not null default now()
);
create index if not exists game_ledger_user_idx on public.game_ledger (user_id, created_at desc);

create table if not exists public.game_weeks (
  week_start  date primary key,
  champion_id uuid references public.profiles (id) on delete set null,
  podium      jsonb not null default '[]',
  closed_at   timestamptz not null default now()
);

alter table public.game_wallets enable row level security;
alter table public.game_ledger  enable row level security;
alter table public.game_weeks   enable row level security;
revoke all on public.game_wallets, public.game_ledger, public.game_weeks from anon, authenticated;
grant select on public.game_wallets, public.game_ledger, public.game_weeks to authenticated;

drop policy if exists "game_wallets_select_members" on public.game_wallets;
create policy "game_wallets_select_members" on public.game_wallets
  for select to authenticated using (public.is_member());
drop policy if exists "game_ledger_select_own" on public.game_ledger;
create policy "game_ledger_select_own" on public.game_ledger
  for select to authenticated using (user_id = auth.uid() and public.is_member());
drop policy if exists "game_weeks_select_members" on public.game_weeks;
create policy "game_weeks_select_members" on public.game_weeks
  for select to authenticated using (public.is_member());

-- ganchos dos jogos: a 0028 (blackjack) substitui
create or replace function public.games_open_round(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$ select null::uuid $$;
create or replace function public.games_close_open_rounds()
returns void language plpgsql security definer set search_path = public as $$ begin end $$;

-- cria a carteira (1.000, extrato "start") se não existe e devolve travada
create or replace function public.games_ensure_wallet(p_user uuid)
returns public.game_wallets language plpgsql security definer set search_path = public as $$
declare w public.game_wallets;
begin
  insert into public.game_wallets (user_id, balance, week_start)
  values (p_user, 1000, public.games_week_start())
  on conflict (user_id) do nothing;
  if found then
    insert into public.game_ledger (user_id, delta, reason) values (p_user, 1000, 'start');
  end if;
  select * into w from public.game_wallets where user_id = p_user for update;
  return w;
end;
$$;

-- mexe no saldo com extrato; nunca deixa negativo
create or replace function public.games_move(p_user uuid, p_delta int, p_reason text, p_round uuid default null)
returns int language plpgsql security definer set search_path = public as $$
declare v_balance int;
begin
  update public.game_wallets set balance = balance + p_delta, updated_at = now()
   where user_id = p_user and balance + p_delta >= 0
  returning balance into v_balance;
  if not found then
    raise exception 'insufficient_credits' using errcode = 'P0001';
  end if;
  insert into public.game_ledger (user_id, delta, reason, round_id) values (p_user, p_delta, p_reason, p_round);
  return v_balance;
end;
$$;

create or replace function public.games_wallet_json(w public.game_wallets)
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_open uuid := public.games_open_round(w.user_id);
begin
  return jsonb_build_object(
    'balance', w.balance,
    'fiado_count', w.fiado_count,
    'can_fiado', w.balance = 0 and v_open is null and w.last_fiado_on is distinct from public.games_today(),
    'open_round_id', v_open,
    'week_start', w.week_start);
end;
$$;

create or replace function public.games_wallet()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.games_wallet_json(public.games_ensure_wallet(auth.uid()));
end;
$$;

create or replace function public.games_fiado()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare w public.game_wallets;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  w := public.games_ensure_wallet(auth.uid());
  if w.balance > 0 then
    raise exception 'fiado_not_broke' using errcode = 'P0001';
  end if;
  if public.games_open_round(w.user_id) is not null then
    raise exception 'fiado_open_round' using errcode = 'P0001';
  end if;
  if w.last_fiado_on = public.games_today() then
    raise exception 'fiado_today' using errcode = 'P0001';
  end if;
  perform public.games_move(w.user_id, 100, 'fiado');
  update public.game_wallets
     set fiado_count = fiado_count + 1, last_fiado_on = public.games_today()
   where user_id = w.user_id
  returning * into w;
  return public.games_wallet_json(w);
end;
$$;

-- segunda 00:00 (Brasília): fecha mãos, grava pódio, passa o troféu, volta todo mundo pra 1.000
create or replace function public.games_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date;
  v_podium jsonb;
  v_champ  uuid;
begin
  select max(week_start) into v_old from public.game_wallets;
  if v_old is null or v_old >= v_new then
    return;
  end if;

  perform public.games_close_open_rounds();

  select coalesce(jsonb_agg(jsonb_build_object('user_id', user_id, 'balance', balance, 'fiado_count', fiado_count)
                            order by balance desc, fiado_count asc, last_played_at asc), '[]')
    into v_podium
    from (select * from public.game_wallets
           where last_played_at is not null
           order by balance desc, fiado_count asc, last_played_at asc
           limit 3) top;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;

  insert into public.game_weeks (week_start, champion_id, podium)
  values (v_old, v_champ, v_podium)
  on conflict (week_start) do nothing;

  update public.profiles set badges = array_remove(badges, 'weekly_champion') where 'weekly_champion' = any (badges);
  if v_champ is not null then
    update public.profiles set badges = array_append(badges, 'weekly_champion') where id = v_champ;
  end if;

  insert into public.game_ledger (user_id, delta, reason)
  select user_id, 1000 - balance, 'reset' from public.game_wallets where balance <> 1000;
  update public.game_wallets
     set balance = 1000, week_start = v_new, fiado_count = 0, last_fiado_on = null,
         last_played_at = null, updated_at = now();
end;
$$;

revoke all on function public.games_open_round(uuid) from public, anon, authenticated;
revoke all on function public.games_close_open_rounds() from public, anon, authenticated;
revoke all on function public.games_ensure_wallet(uuid) from public, anon, authenticated;
revoke all on function public.games_move(uuid, int, text, uuid) from public, anon, authenticated;
revoke all on function public.games_wallet_json(public.game_wallets) from public, anon, authenticated;
revoke all on function public.games_weekly_reset() from public, anon, authenticated;
revoke all on function public.games_wallet() from public, anon;
revoke all on function public.games_fiado() from public, anon;
grant execute on function public.games_wallet() to authenticated;
grant execute on function public.games_fiado() to authenticated;

select cron.schedule('fellas-games-reset', '0 3 * * 1', $$select public.games_weekly_reset()$$);
```

- [ ] **Step 3: Rodar** `npm test --prefix games` → PASS (ajustar só a migração até passar; não afrouxar teste).
- [ ] **Step 4: Teste de texto na raiz** — `__tests__/fellasGamesMigration.test.ts`, no padrão de
  `commentImagesMigration.test.ts`: lê a 0027 e confere `revoke all on function public.games_weekly_reset() from
  public, anon, authenticated`, `cron.schedule('fellas-games-reset', '0 3 * * 1'`, `check (balance >= 0)`,
  `revoke all on public.game_wallets, public.game_ledger, public.game_weeks from anon, authenticated`.
  Run: `npx jest __tests__/fellasGamesMigration.test.ts` → PASS.
- [ ] **Step 5: Commit** — `git add supabase/migrations/0027_fellas_games.sql games/test __tests__/fellasGamesMigration.test.ts`;
  `git commit -m "Fellas Games: créditos semanais, fiado, pódio e troféu no banco (0027)"`.

---

### Task 3: Migração 0028 (parte 1) — cartas, mesa, `bj_deal`, acerto e retomada

**Files:**
- Create: `supabase/migrations/0028_blackjack.sql`, `games/test/cards.ts`, `games/test/blackjack.test.ts`
- Modify: `games/test/db.ts` (`MIGRATIONS = ['0027_fellas_games.sql', '0028_blackjack.sql']`)

**Interfaces:**
- Consumes: `games_ensure_wallet`, `games_move`, `games_wallet_json`, ganchos (Tarefa 2).
- Produces (SQL): cartas `smallint` 0–51 (`rank = c % 13`: 0 Ás, 1–9 = 2–10, 10 J, 11 Q, 12 K;
  `suit = c / 13`: 0 ♠, 1 ♥, 2 ♦, 3 ♣); `bj_card_value(smallint) returns int` (Ás 1, figuras 10);
  `bj_hand_total(smallint[]) returns int` (Ás vira 11 quando cabe); `bj_is_soft(smallint[]) returns boolean`;
  `bj_shuffle() returns smallint[]` (312 cartas; os testes a substituem); `bj_cards(jsonb) returns smallint[]`;
  `bj_new_hand(smallint[], int, boolean) returns jsonb`; tabelas `bj_rounds`, `bj_secrets`;
  `bj_state(bj_rounds) returns jsonb` → `{id, status, bet, hands, active, dealer, dealer_total, payout, balance}`;
  `bj_finish(uuid) returns bj_rounds` (interna: revela, banca joga, acerta, paga, fecha);
  app: `bj_deal(p_bet int) returns jsonb`, `bj_current() returns jsonb` (null sem mão aberta);
  ganchos substituídos: `games_open_round` lê `bj_rounds`.
- Ordem do sapato: `[jogador, banca aberta, jogador, banca virada, compras…]`.

- [ ] **Step 1: Ajudante de baralho** — `games/test/cards.ts`:

```ts
// 'As' = Ás de espadas, '10h', 'Kc'… → número da carta no banco; rig() faz o bj_shuffle devolver esse sapato.
import type { TestDb } from './db';
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const SUITS = ['s', 'h', 'd', 'c'];
export function card(code: string): number {
  const suit = SUITS.indexOf(code.slice(-1));
  const rank = RANKS.indexOf(code.slice(0, -1));
  if (suit < 0 || rank < 0) throw new Error(`carta inválida: ${code}`);
  return suit * 13 + rank;
}
/** O sapato começa com essas cartas (ordem de distribuição) e completa com cartas baixas que ninguém usa. */
export async function rig(t: TestDb, codes: string[]) {
  const head = codes.map(card).join(',');
  await t.db.exec(`create or replace function public.bj_shuffle() returns smallint[] language sql volatile as
    $$ select array[${head}]::smallint[] || array_fill(1::smallint, array[300]) $$`);
}
```

  (O enchimento `1` = "2♠": nos testes que compram além do combinado, a carta é um 2.)
- [ ] **Step 2: Testes que falham** — `games/test/blackjack.test.ts` (parte 1; a Tarefa 4 acrescenta):

```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { freshDb, type TestDb } from './db';
import { card, rig } from './cards';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
type Hand = { cards: number[]; bet: number; doubled: boolean; from_split_aces: boolean; done: boolean; result: string | null };
type State = { id: string; status: 'playing' | 'done'; bet: number; hands: Hand[]; active: number; dealer: number[]; dealer_total: number; payout: number; balance: number };

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const deal = (bet: number) => t.rpc<State>('bj_deal', { p_bet: bet });

beforeEach(async () => {
  t = await freshDb();
  await t.member(A); await t.member(B);
  await t.as(A);
});

describe('bj_deal', () => {
  it('aposta fora de 10–500 é recusada e não cobra', async () => {
    await expect(deal(5)).rejects.toThrow(/bet_out_of_range/);
    await expect(deal(510)).rejects.toThrow(/bet_out_of_range/);
    expect((await t.rpc<{ balance: number }>('games_wallet')).balance).toBe(1000);
  });

  it('distribui, cobra e esconde a carta virada', async () => {
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    const s = await deal(100);
    expect(s).toMatchObject({ status: 'playing', bet: 100, active: 0, balance: 900, dealer: [card('Ks')], dealer_total: 10 });
    expect(s.hands[0].cards).toEqual([card('9h'), card('8c')]);
    expect(s.dealer).toHaveLength(1); // a virada não vem no estado
  });

  it('uma mão aberta por vez; saldo insuficiente recusa', async () => {
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    await deal(100);
    await expect(deal(100)).rejects.toThrow(/round_open/);
    await t.as(B);
    await t.rpc('games_wallet');
    await q('update public.game_wallets set balance = 50 where user_id = $1', [B]);
    await expect(deal(100)).rejects.toThrow(/insufficient_credits/);
  });

  it('natural do jogador paga 3:2 na hora', async () => {
    await rig(t, ['As', '9h', 'Kd', '7c']);
    const s = await deal(100);
    expect(s).toMatchObject({ status: 'done', payout: 250, balance: 1150 });
    expect(s.hands[0].result).toBe('blackjack');
    expect(s.dealer).toEqual([card('9h'), card('7c')]); // revelada no fim
  });

  it('banca com natural: jogador perde; os dois com natural: empate', async () => {
    await rig(t, ['9h', 'As', '8c', 'Kd']);
    expect(await deal(100)).toMatchObject({ status: 'done', payout: 0, balance: 900 });
    await rig(t, ['Ah', 'As', 'Kc', 'Kd']);
    const s = await deal(100);
    expect(s.hands[0].result).toBe('push');
    expect(s.balance).toBe(900); // 900 - 100 + 100
  });

  it('bj_current devolve a mão aberta, ou null', async () => {
    expect(await t.rpc('bj_current')).toBeNull();
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    const s = await deal(100);
    expect((await t.rpc<State>('bj_current')).id).toBe(s.id);
    expect((await t.rpc<{ open_round_id: string }>('games_wallet')).open_round_id).toBe(s.id);
  });

  it('valor de mão: Ás macio e duro', async () => {
    const total = async (codes: string[]) =>
      (await q<{ v: number }>(`select public.bj_hand_total($1::smallint[]) as v`, [codes.map(card)]))[0].v;
    expect(await total(['As', '6h'])).toBe(17);
    expect(await total(['As', '6h', '9c'])).toBe(16);
    expect(await total(['As', 'Ad', '9c'])).toBe(21);
    expect(await total(['Ks', 'Qh'])).toBe(20);
  });
});

describe('permissões do blackjack', () => {
  it('ninguém lê o sapato; mão de outro é invisível; escrita direta negada', async () => {
    await rig(t, ['9h', 'Ks', '8c', '7d']);
    await deal(100);
    await expect(t.asRole('authenticated', 'select * from public.bj_secrets')).rejects.toThrow();
    expect(await t.asRole('authenticated', 'select id from public.bj_rounds')).toHaveLength(1);
    await t.as(B);
    expect(await t.asRole('authenticated', 'select id from public.bj_rounds')).toHaveLength(0);
    await expect(t.asRole('authenticated', `update public.bj_rounds set payout = 9999`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `select public.bj_finish(gen_random_uuid())`)).rejects.toThrow();
  });
});
```

  Run → FAIL (0028 não existe).
- [ ] **Step 3: Migração, parte 1** — `supabase/migrations/0028_blackjack.sql` (a Tarefa 4 acrescenta `bj_act`,
  `bj_force_finish` e o gancho de fechar):

```sql
-- fellasapp: Blackjack dos Fellas Games. Idempotente. Depende da 0027 (carteira e ganchos).
-- Regras: 6 baralhos embaralhados a cada mão; banca para em 17 (inclusive macio); natural paga 3:2; dobrar só
-- com 2 cartas; dividir par de mesmo valor uma vez (ases: uma carta cada); sem seguro nem desistir.
-- O sapato e a carta virada da banca ficam em bj_secrets, que ninguém lê: só as funções.
-- Cartas: smallint 0–51; rank = c % 13 (0 Ás, 1–9 = 2–10, 10 J, 11 Q, 12 K); naipe = c / 13 (♠ ♥ ♦ ♣).

create or replace function public.bj_card_value(c smallint)
returns int language sql immutable as $$
  select case when c % 13 = 0 then 1 when c % 13 >= 9 then 10 else c % 13 + 1 end
$$;

create or replace function public.bj_is_soft(cards smallint[])
returns boolean language sql immutable as $$
  select coalesce(bool_or(c % 13 = 0), false) and coalesce(sum(public.bj_card_value(c)), 0) + 10 <= 21
    from unnest(cards) c
$$;

create or replace function public.bj_hand_total(cards smallint[])
returns int language sql immutable as $$
  select (coalesce(sum(public.bj_card_value(c)), 0) + case when public.bj_is_soft(cards) then 10 else 0 end)::int
    from unnest(cards) c
$$;

create or replace function public.bj_shuffle()
returns smallint[] language sql volatile as $$
  select array_agg((g % 52)::smallint order by gen_random_uuid()) from generate_series(0, 311) g
$$;

create or replace function public.bj_cards(j jsonb)
returns smallint[] language sql immutable as $$
  select coalesce(array_agg(x::smallint order by o), '{}') from jsonb_array_elements_text(j) with ordinality e(x, o)
$$;

create or replace function public.bj_new_hand(cards smallint[], bet int, from_split_aces boolean)
returns jsonb language sql immutable as $$
  select jsonb_build_object('cards', to_jsonb(cards), 'bet', bet, 'doubled', false,
    'from_split_aces', from_split_aces, 'done', from_split_aces or public.bj_hand_total(cards) = 21, 'result', null)
$$;

create table if not exists public.bj_rounds (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  week_start  date not null,
  status      text not null check (status in ('playing', 'done')),
  bet         int not null check (bet between 10 and 500),
  hands       jsonb not null,
  active      smallint not null default 0,
  dealer      smallint[] not null,
  payout      int not null default 0,
  created_at  timestamptz not null default now(),
  finished_at timestamptz
);
create unique index if not exists bj_rounds_one_open on public.bj_rounds (user_id) where status = 'playing';

create table if not exists public.bj_secrets (
  round_id uuid primary key references public.bj_rounds (id) on delete cascade,
  shoe     smallint[] not null,
  hole     smallint not null
);

alter table public.bj_rounds  enable row level security;
alter table public.bj_secrets enable row level security; -- sem política: ninguém lê
revoke all on public.bj_rounds, public.bj_secrets from anon, authenticated;
grant select on public.bj_rounds to authenticated;
drop policy if exists "bj_rounds_select_own" on public.bj_rounds;
create policy "bj_rounds_select_own" on public.bj_rounds
  for select to authenticated using (user_id = auth.uid() and public.is_member());

create or replace function public.bj_state(r public.bj_rounds)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object('id', r.id, 'status', r.status, 'bet', r.bet, 'hands', r.hands, 'active', r.active,
    'dealer', to_jsonb(r.dealer), 'dealer_total', public.bj_hand_total(r.dealer), 'payout', r.payout,
    'balance', (select balance from public.game_wallets where user_id = r.user_id))
$$;

-- revela, banca joga (se precisa), acerta cada mão, paga e fecha
create or replace function public.bj_finish(p_round uuid)
returns public.bj_rounds language plpgsql security definer set search_path = public as $$
declare
  r        public.bj_rounds;
  s        public.bj_secrets;
  v_hands  jsonb := '[]';
  h        jsonb;
  v_cards  smallint[];
  v_pt     int;
  v_dt     int;
  v_res    text;
  v_pay    int := 0;
  v_hpay   int;
  p_nat    boolean;
  d_nat    boolean;
  any_live boolean;
begin
  select * into r from public.bj_rounds where id = p_round for update;
  select * into s from public.bj_secrets where round_id = p_round for update;
  r.dealer := r.dealer || s.hole;
  d_nat := public.bj_hand_total(r.dealer) = 21;
  p_nat := jsonb_array_length(r.hands) = 1
           and jsonb_array_length(r.hands -> 0 -> 'cards') = 2
           and public.bj_hand_total(public.bj_cards(r.hands -> 0 -> 'cards')) = 21;
  select bool_or(public.bj_hand_total(public.bj_cards(x -> 'cards')) <= 21) into any_live
    from jsonb_array_elements(r.hands) x;

  if not d_nat and not p_nat and any_live then
    while public.bj_hand_total(r.dealer) < 17 loop
      r.dealer := r.dealer || s.shoe[1];
      s.shoe := s.shoe[2:];
    end loop;
  end if;
  v_dt := public.bj_hand_total(r.dealer);

  for h in select x from jsonb_array_elements(r.hands) x loop
    v_cards := public.bj_cards(h -> 'cards');
    v_pt := public.bj_hand_total(v_cards);
    v_hpay := 0;
    if v_pt > 21 then v_res := 'bust';
    elsif p_nat and d_nat then v_res := 'push';
    elsif p_nat then v_res := 'blackjack';
    elsif d_nat then v_res := 'lose';
    elsif v_dt > 21 or v_pt > v_dt then v_res := 'win';
    elsif v_pt = v_dt then v_res := 'push';
    else v_res := 'lose';
    end if;
    v_hpay := case v_res
      when 'blackjack' then (h ->> 'bet')::int + (h ->> 'bet')::int * 3 / 2
      when 'win' then (h ->> 'bet')::int * 2
      when 'push' then (h ->> 'bet')::int
      else 0 end;
    v_pay := v_pay + v_hpay;
    v_hands := v_hands || jsonb_build_array(h || jsonb_build_object('done', true, 'result', v_res));
  end loop;

  if v_pay > 0 then
    perform public.games_move(r.user_id, v_pay,
      case when v_hands @> '[{"result":"win"}]' or v_hands @> '[{"result":"blackjack"}]' then 'win' else 'push' end,
      r.id);
  end if;
  update public.game_wallets set last_played_at = now() where user_id = r.user_id;
  update public.bj_secrets set shoe = s.shoe where round_id = r.id;
  update public.bj_rounds
     set status = 'done', hands = v_hands, dealer = r.dealer, payout = v_pay, finished_at = now()
   where id = r.id
  returning * into r;
  return r;
end;
$$;

create or replace function public.bj_deal(p_bet int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  w      public.game_wallets;
  r      public.bj_rounds;
  v_shoe smallint[];
  v_p    smallint[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_bet is null or p_bet < 10 or p_bet > 500 then
    raise exception 'bet_out_of_range' using errcode = 'P0001';
  end if;
  w := public.games_ensure_wallet(auth.uid());
  if public.games_open_round(w.user_id) is not null then
    raise exception 'round_open' using errcode = 'P0001';
  end if;

  v_shoe := public.bj_shuffle();
  v_p := array[v_shoe[1], v_shoe[3]];
  insert into public.bj_rounds (user_id, week_start, status, bet, hands, active, dealer)
  values (w.user_id, w.week_start, 'playing', p_bet, jsonb_build_array(public.bj_new_hand(v_p, p_bet, false)), 0,
          array[v_shoe[2]])
  returning * into r;
  insert into public.bj_secrets (round_id, shoe, hole) values (r.id, v_shoe[5:], v_shoe[4]);
  perform public.games_move(w.user_id, -p_bet, 'bet', r.id); -- sem saldo: erro e tudo volta

  if public.bj_hand_total(array[v_shoe[2], v_shoe[4]]) = 21 or public.bj_hand_total(v_p) = 21 then
    r := public.bj_finish(r.id);
  end if;
  return public.bj_state(r);
end;
$$;

create or replace function public.bj_current()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare r public.bj_rounds;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into r from public.bj_rounds where user_id = auth.uid() and status = 'playing';
  if not found then
    return null;
  end if;
  return public.bj_state(r);
end;
$$;

-- gancho da 0027: a mão aberta de blackjack conta como "mão aberta" (fiado, carteira)
create or replace function public.games_open_round(p_user uuid)
returns uuid language sql stable security definer set search_path = public as $$
  select id from public.bj_rounds where user_id = p_user and status = 'playing'
$$;

revoke all on function public.bj_shuffle() from public, anon, authenticated;
revoke all on function public.bj_state(public.bj_rounds) from public, anon, authenticated;
revoke all on function public.bj_finish(uuid) from public, anon, authenticated;
revoke all on function public.games_open_round(uuid) from public, anon, authenticated;
revoke all on function public.bj_deal(int) from public, anon;
revoke all on function public.bj_current() from public, anon;
grant execute on function public.bj_deal(int) to authenticated;
grant execute on function public.bj_current() to authenticated;
```

  Atenção: `bj_shuffle` precisa ficar `volatile`; o teste a substitui com `create or replace` (dono = o mesmo).
- [ ] **Step 4: Rodar** `npm test --prefix games` → PASS.
- [ ] **Step 5: Commit** — `git commit -m "Blackjack no banco: distribuir, naturais, acerto e retomada (0028, parte 1)"`.

---

### Task 4: Migração 0028 (parte 2) — `bj_act`, fechar mão no reset

**Files:**
- Modify: `supabase/migrations/0028_blackjack.sql` (acrescentar no fim), `games/test/blackjack.test.ts`,
  `__tests__/fellasGamesMigration.test.ts`

**Interfaces:**
- Consumes: `bj_finish`, `bj_new_hand`, `bj_cards`, `bj_state`, `games_move` (Tarefas 2–3).
- Produces: `bj_act(p_round uuid, p_action text) returns jsonb` (`hit | stand | double | split`; erros
  `invalid_action`, `round_not_found`, `round_done`, `insufficient_credits`); `bj_force_finish(uuid) returns
  bj_rounds` (interna); gancho `games_close_open_rounds()` substituído (fecha todas as mãos abertas).

- [ ] **Step 1: Testes que falham** — acrescentar a `games/test/blackjack.test.ts`:

```ts
const act = (id: string, a: string) => t.rpc<State>('bj_act', { p_round: id, p_action: a });

describe('bj_act', () => {
  it('pedir até estourar fecha a mão sem a banca comprar', async () => {
    await rig(t, ['10h', '9s', '6c', '7d', 'Kd']);
    const s = await deal(100);
    const e = await act(s.id, 'hit');
    expect(e).toMatchObject({ status: 'done', payout: 0, balance: 900 });
    expect(e.hands[0].result).toBe('bust');
    expect(e.dealer).toEqual([card('9s'), card('7d')]); // só revelou
  });

  it('parar: banca compra até 17 e para no 17 macio', async () => {
    await rig(t, ['10h', 'As', '9c', '5d', 'Ac']); // banca A+5 = 16 macio → +A = 17 macio, para
    const e = await act((await deal(100)).id, 'stand');
    expect(e.dealer_total).toBe(17);
    expect(e.hands[0].result).toBe('win'); // 19 x 17
    expect(e.balance).toBe(1100);
  });

  it('pedir fazendo 21 fecha a mão sozinho', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']); // 11 + K = 21; banca 17
    const e = await act((await deal(100)).id, 'hit');
    expect(e.status).toBe('done');
    expect(e.hands[0].result).toBe('win');
  });

  it('empate devolve a aposta', async () => {
    await rig(t, ['10h', '10s', '8c', '8d']);
    const e = await act((await deal(100)).id, 'stand');
    expect(e).toMatchObject({ payout: 100, balance: 1000 });
    expect(e.hands[0].result).toBe('push');
  });

  it('dobrar: só com 2 cartas, cobra de novo, recebe exatamente 1 carta', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']);
    const e = await act((await deal(100)).id, 'double');
    expect(e.hands[0]).toMatchObject({ bet: 200, doubled: true, result: 'win' });
    expect(e.hands[0].cards).toHaveLength(3);
    expect(e.balance).toBe(1200);
    await rig(t, ['2h', '9s', '3c', '8d', '4d', 'Kd']);
    const s = await deal(100);
    await act(s.id, 'hit');
    await expect(act(s.id, 'double')).rejects.toThrow(/invalid_action/);
  });

  it('dividir: par de mesmo valor (10 e K), uma vez, duas mãos', async () => {
    await rig(t, ['10h', '9s', 'Kc', '8d', '9h', '9c']);
    const s = await deal(100);
    const d = await act(s.id, 'split');
    expect(d.hands.map((h) => h.cards)).toEqual([[card('10h'), card('9h')], [card('Kc'), card('9c')]]);
    expect(d.balance).toBe(800);
    await expect(act(s.id, 'split')).rejects.toThrow(/invalid_action/);
    await act(s.id, 'stand');
    const e = await act(s.id, 'stand');
    expect(e.hands.map((h) => h.result)).toEqual(['win', 'win']); // 19 e 19 x 17
    expect(e.balance).toBe(1200);
  });

  it('dividir sem par é recusado; ases divididos recebem 1 carta e fecham; 21 depois de dividir paga 1:1', async () => {
    await rig(t, ['10h', '9s', '9c', '8d']);
    await expect(act((await deal(100)).id, 'split')).rejects.toThrow(/invalid_action/);
    await t.as(B);
    await rig(t, ['As', '9s', 'Ah', '8d', 'Kc', '5c']);
    const e = await act((await deal(100)).id, 'split');
    // mãos A+K = 21 e A+5 = 16; ases divididos fecham sozinhos; banca 9+8 = 17
    expect(e.status).toBe('done');
    expect(e.hands.map((h) => h.result)).toEqual(['win', 'lose']);
    expect(e.payout).toBe(200); // 21 depois de dividir paga 1:1, não 3:2
    expect(e.balance).toBe(1000);
  });

  it('mão fechada e mão de outro', async () => {
    await rig(t, ['10h', '10s', '8c', '8d']);
    const s = await deal(100);
    await act(s.id, 'stand');
    await expect(act(s.id, 'hit')).rejects.toThrow(/round_done/); // toque duplo / segunda aba
    await rig(t, ['10h', '10s', '8c', '8d']);
    const mine = await deal(100);
    await t.as(B);
    await expect(act(mine.id, 'stand')).rejects.toThrow(/round_not_found/);
    await expect(act(mine.id, 'fold')).rejects.toThrow(/invalid_action/);
  });

  it('extrato fecha com o saldo', async () => {
    await rig(t, ['5h', '9s', '6c', '8d', 'Kd']);
    await act((await deal(100)).id, 'double');
    const [{ s }] = await q<{ s: number }>('select sum(delta)::int as s from public.game_ledger where user_id = $1', [A]);
    expect(s).toBe((await t.rpc<{ balance: number }>('games_wallet')).balance);
  });
});

describe('reset com mão aberta', () => {
  it('Parar automático, paga, e depois zera', async () => {
    await rig(t, ['10h', '10s', '9c', '7d']);
    await deal(100);
    await q('update public.game_wallets set week_start = week_start - 7');
    await q('select public.games_weekly_reset()');
    expect(await q(`select status from public.bj_rounds`)).toEqual([{ status: 'done' }]);
    expect(await q<{ champion_id: string }>('select champion_id from public.game_weeks')).toEqual([{ champion_id: A }]);
    expect((await t.rpc<{ balance: number }>('games_wallet')).balance).toBe(1000);
  });
});
```

  Run → FAIL (`bj_act` não existe).
- [ ] **Step 2: Acrescentar à 0028**

```sql
create or replace function public.bj_act(p_round uuid, p_action text)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  r       public.bj_rounds;
  s       public.bj_secrets;
  h       jsonb;
  v_cards smallint[];
  v_bet   int;
  v_aces  boolean;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_action is null or p_action not in ('hit', 'stand', 'double', 'split') then
    raise exception 'invalid_action' using errcode = 'P0001';
  end if;
  select * into r from public.bj_rounds where id = p_round and user_id = auth.uid() for update;
  if not found then
    raise exception 'round_not_found' using errcode = 'P0001';
  end if;
  if r.status <> 'playing' then
    raise exception 'round_done' using errcode = 'P0001';
  end if;
  perform 1 from public.game_wallets where user_id = r.user_id for update;
  select * into s from public.bj_secrets where round_id = r.id for update;

  h := r.hands -> r.active;
  v_cards := public.bj_cards(h -> 'cards');
  v_bet := (h ->> 'bet')::int;

  if p_action = 'hit' then
    v_cards := v_cards || s.shoe[1];
    s.shoe := s.shoe[2:];
    h := h || jsonb_build_object('cards', to_jsonb(v_cards), 'done', public.bj_hand_total(v_cards) >= 21);
    r.hands := jsonb_set(r.hands, array[r.active::text], h);
  elsif p_action = 'stand' then
    r.hands := jsonb_set(r.hands, array[r.active::text], h || '{"done": true}');
  elsif p_action = 'double' then
    if array_length(v_cards, 1) <> 2 or (h ->> 'from_split_aces')::boolean then
      raise exception 'invalid_action' using errcode = 'P0001';
    end if;
    perform public.games_move(r.user_id, -v_bet, 'bet', r.id);
    v_cards := v_cards || s.shoe[1];
    s.shoe := s.shoe[2:];
    h := h || jsonb_build_object('cards', to_jsonb(v_cards), 'bet', v_bet * 2, 'doubled', true, 'done', true);
    r.hands := jsonb_set(r.hands, array[r.active::text], h);
  else -- split
    if jsonb_array_length(r.hands) <> 1 or array_length(v_cards, 1) <> 2
       or public.bj_card_value(v_cards[1]) <> public.bj_card_value(v_cards[2]) then
      raise exception 'invalid_action' using errcode = 'P0001';
    end if;
    perform public.games_move(r.user_id, -v_bet, 'bet', r.id);
    v_aces := v_cards[1] % 13 = 0;
    r.hands := jsonb_build_array(
      public.bj_new_hand(array[v_cards[1], s.shoe[1]], v_bet, v_aces),
      public.bj_new_hand(array[v_cards[2], s.shoe[2]], v_bet, v_aces));
    s.shoe := s.shoe[3:];
  end if;

  -- próxima mão não pronta; nenhuma → banca joga e acerta
  select min(o - 1) into r.active
    from jsonb_array_elements(r.hands) with ordinality e(x, o)
   where not (x ->> 'done')::boolean;
  update public.bj_secrets set shoe = s.shoe where round_id = r.id;
  update public.bj_rounds set hands = r.hands, active = coalesce(r.active, active) where id = r.id
  returning * into r;
  if not exists (select 1 from jsonb_array_elements(r.hands) x where not (x ->> 'done')::boolean) then
    r := public.bj_finish(r.id);
  end if;
  return public.bj_state(r);
end;
$$;

-- reset/encerramento: todas as mãos abertas param, banca joga e acerta
create or replace function public.bj_force_finish(p_round uuid)
returns public.bj_rounds language plpgsql security definer set search_path = public as $$
begin
  update public.bj_rounds
     set hands = (select jsonb_agg(x || '{"done": true}' order by o) from jsonb_array_elements(hands) with ordinality e(x, o))
   where id = p_round and status = 'playing';
  return public.bj_finish(p_round);
end;
$$;

create or replace function public.games_close_open_rounds()
returns void language plpgsql security definer set search_path = public as $$
declare v_id uuid;
begin
  for v_id in select id from public.bj_rounds where status = 'playing' loop
    perform public.bj_force_finish(v_id);
  end loop;
end;
$$;

revoke all on function public.bj_force_finish(uuid) from public, anon, authenticated;
revoke all on function public.games_close_open_rounds() from public, anon, authenticated;
revoke all on function public.bj_act(uuid, text) from public, anon;
grant execute on function public.bj_act(uuid, text) to authenticated;
```

- [ ] **Step 3: Rodar** `npm test --prefix games` → PASS. Acrescentar em `__tests__/fellasGamesMigration.test.ts`
  a leitura da 0028 com: `alter table public.bj_secrets enable row level security`, ausência de `create policy`
  para `bj_secrets` (`expect(sql).not.toMatch(/create policy[^;]*bj_secrets/)`) e
  `grant execute on function public.bj_act(uuid, text) to authenticated`. `npm test` na raiz → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Blackjack no banco: pedir, parar, dobrar, dividir e fechar mão no reset (0028)"`.

---

### Task 5: App — tipos, README do banco e `lib/api/games.ts`

**Files:**
- Modify: `types/database.ts` (tabelas `game_wallets`, `game_weeks`; funções `games_wallet`, `games_fiado`),
  `supabase/README.md` (linhas da 0027 e 0028 na tabela, no formato das outras)
- Create: `lib/api/games.ts`, `__tests__/gamesApi.test.ts`

**Interfaces:**
- Consumes: `getMemberDirectory()` (`lib/memberDirectory.ts`: `{id, username, name, avatarUrl}`), `supabase`.
- Produces:

```ts
export type Wallet = { balance: number; fiadoCount: number; canFiado: boolean; openRoundId: string | null; weekStart: string };
export type LeaderRow = { userId: string; name: string; username: string; avatarUrl: string | null; balance: number; fiadoCount: number };
export type Champion = { userId: string; name: string; username: string; avatarUrl: string | null; balance: number; weekStart: string };
export const GAMES_ERRORS: { load: string; fiado: string; fiadoToday: string };
export function getWallet(): Promise<Wallet>;
export function takeFiado(): Promise<Wallet>;
export function getLeaderboard(): Promise<LeaderRow[]>;   // ordem: saldo ↓, fiado ↑, quem chegou primeiro
export function getLastChampion(): Promise<Champion | null>;
export function gamesErrorMessage(e: unknown): string;     // 'fiado_today' → GAMES_ERRORS.fiadoToday; resto → load/fiado
```

- [ ] **Step 1: Teste que falha** — `__tests__/gamesApi.test.ts`, mock do supabase no molde de
  `__tests__/ideasApi.test.ts` (`rpc` e `from(...).select(...).not(...).order(...).order(...).order(...)`,
  `from('game_weeks').select(...).order(...).limit(1).maybeSingle()`). Casos:
  - `getWallet` chama `rpc('games_wallet')` e converte `{balance:1000, fiado_count:0, can_fiado:false,
    open_round_id:null, week_start:'2026-10-05'}` para camelCase.
  - `takeFiado` chama `rpc('games_fiado')`; erro `{message:'fiado_today'}` → lança; `gamesErrorMessage` dele =
    "Fiado de hoje já foi. Volta amanhã."
  - `getLeaderboard` filtra `last_played_at` não nulo (`.not('last_played_at', 'is', null)`), ordena
    `balance desc, fiado_count asc, last_played_at asc` e junta nome/foto do diretório; quem saiu do diretório vira
    `name: 'Alguém'`.
  - `getLastChampion`: sem semana → `null`; semana sem `champion_id` → `null`; com campeão → nome do diretório +
    `balance` de `podium[0].balance`.
  Run: `npx jest __tests__/gamesApi.test.ts` → FAIL.
- [ ] **Step 2: Implementar `lib/api/games.ts`**

```ts
import { getMemberDirectory } from '../memberDirectory';
import { supabase } from '../supabase';

export const GAMES_ERRORS = {
  load: 'Não deu pra carregar o placar. Tenta de novo.',
  fiado: 'Não deu pra pegar o fiado. Tenta de novo.',
  fiadoToday: 'Fiado de hoje já foi. Volta amanhã.',
};

type WalletRow = { balance: number; fiado_count: number; can_fiado: boolean; open_round_id: string | null; week_start: string };
const toWallet = (w: WalletRow): Wallet => ({
  balance: w.balance, fiadoCount: w.fiado_count, canFiado: w.can_fiado, openRoundId: w.open_round_id, weekStart: w.week_start,
});

function who(id: string) {
  const m = getMemberDirectory().find((x) => x.id === id);
  // saiu do grupo, ou o diretório ainda não carregou: a linha continua aparecendo
  return { name: m?.name ?? 'Alguém', username: m?.username ?? '', avatarUrl: m?.avatarUrl ?? null };
}

export async function getWallet(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('games_wallet');
  if (error) throw error;
  return toWallet(data as WalletRow);
}

export async function takeFiado(): Promise<Wallet> {
  const { data, error } = await supabase.rpc('games_fiado');
  if (error) throw error;
  return toWallet(data as WalletRow);
}

export async function getLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase
    .from('game_wallets')
    .select('user_id, balance, fiado_count')
    .not('last_played_at', 'is', null)
    .order('balance', { ascending: false })
    .order('fiado_count', { ascending: true })
    .order('last_played_at', { ascending: true });
  if (error) throw error;
  return (data ?? []).map((r) => ({ userId: r.user_id, balance: r.balance, fiadoCount: r.fiado_count, ...who(r.user_id) }));
}

export async function getLastChampion(): Promise<Champion | null> {
  const { data, error } = await supabase
    .from('game_weeks')
    .select('week_start, champion_id, podium')
    .order('week_start', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  if (!data?.champion_id) return null;
  const podium = data.podium as { balance: number }[];
  return { userId: data.champion_id, weekStart: data.week_start, balance: podium[0]?.balance ?? 0, ...who(data.champion_id) };
}

export function gamesErrorMessage(e: unknown): string {
  const msg = (e as { message?: string } | null)?.message ?? '';
  if (msg.includes('fiado_today')) return GAMES_ERRORS.fiadoToday;
  if (msg.includes('fiado')) return GAMES_ERRORS.fiado;
  return GAMES_ERRORS.load;
}
```

  (Declarar os tipos `Wallet`, `LeaderRow`, `Champion` da seção Interfaces no topo do arquivo; tipar as linhas
  pelo `Database` como em `lib/api/ideas.ts` depois de atualizar `types/database.ts`.)
- [ ] **Step 3:** `npx jest __tests__/gamesApi.test.ts` → PASS; `npx tsc --noEmit` → PASS.
- [ ] **Step 4: README** — `supabase/README.md`, duas linhas na tabela de migrações:
  `0027_fellas_games.sql` | créditos dos Fellas Games: `game_wallets`, `game_ledger`, `game_weeks`, `games_wallet`,
  `games_fiado`, reset semanal (cron `fellas-games-reset`, segunda 03:00 UTC) com pódio e selo `weekly_champion` |
  aba Games não carrega; e `0028_blackjack.sql` | blackjack: `bj_rounds`, `bj_secrets` (ninguém lê), `bj_deal`,
  `bj_act`, `bj_current`; o reset fecha mãos abertas | a mesa não distribui.
- [ ] **Step 5: Commit** — `git commit -m "Fellas Games no app: API de saldo, fiado, placar e campeão"`.

---

### Task 6: Selo `weekly_champion` (troféu com "1")

**Files:**
- Create: `components/ui/TrophyBadge.tsx`
- Modify: `lib/badges.ts`, `components/ui/UserBadge.tsx`, `components/ui/index.ts`, `__tests__/badges.test.tsx`

**Interfaces:**
- Produces: `Badge = 'verified' | 'weekly_champion'`; `BADGE_LABELS.weekly_champion = 'Campeão da semana'`;
  `TrophyBadge({ size }: { size?: IconSize })` (exportado em `components/ui`).

- [ ] **Step 1: Teste que falha** — em `__tests__/badges.test.tsx` acrescentar:
  `ownBadges(['weekly_champion','verified'])` → `['weekly_champion','verified']`;
  `shownBadge(['verified','weekly_champion'], 'weekly_champion')` → `'weekly_champion'`;
  `shownBadge(['verified'], 'weekly_champion')` → `'verified'` (perdeu o título: volta pro que tem);
  render de `<UserBadge badge="weekly_champion" />` tem `accessibilityLabel` "Campeão da semana".
  Run: `npx jest __tests__/badges.test.tsx` → FAIL.
- [ ] **Step 2: Implementar.** `lib/badges.ts`: `export type Badge = 'verified' | 'weekly_champion';`,
  `const BADGES: readonly Badge[] = ['verified', 'weekly_champion'];`,
  `BADGE_LABELS = { verified: 'Verificado', weekly_champion: 'Campeão da semana' }`.
  `components/ui/TrophyBadge.tsx` (mesmo desenho do mockup `blackjack-visual.html`, cor `brand`, "1" em `onBrand`):

```tsx
import Svg, { Path, Text as SvgText } from 'react-native-svg';

import { iconSizes, useTheme, type IconSize } from '../../lib/theme';

/** Selo do campeão da semana: troféu com o 1 dentro, na cor da marca. É marca, não controle. */
export function TrophyBadge({ size = 'sm' }: { size?: IconSize }) {
  const t = useTheme();
  const px = iconSizes[size];
  const c = t.colors.brand;
  return (
    <Svg width={px} height={px} viewBox="0 0 24 24" accessibilityRole="image" accessibilityLabel="Campeão da semana">
      <Path d="M7 3h10v5a5 5 0 0 1-10 0V3z" fill={c} />
      <Path d="M7 5H4v1.5A3.5 3.5 0 0 0 7.5 10M17 5h3v1.5A3.5 3.5 0 0 1 16.5 10" fill="none" stroke={c} strokeWidth={1.8} />
      <Path d="M12 13v4M9.5 17h5v4h-5z" fill={c} stroke={c} strokeWidth={1.5} />
      <SvgText x={12} y={9.6} textAnchor="middle" fontSize={7.5} fontWeight="700" fill={t.colors.onBrand}>1</SvgText>
    </Svg>
  );
}
```

  (`iconSizes` e `colors.onBrand` existem em `lib/theme.ts`; seguir o padrão de import de `VerifiedBadge.tsx`.)
  `UserBadge`: `case 'weekly_champion': return <TrophyBadge size={size} />;`. Exportar em `components/ui/index.ts`.
- [ ] **Step 3:** `npx jest __tests__/badges.test.tsx` → PASS; `npx tsc --noEmit` → PASS (o `switch` exaustivo
  pega qualquer lugar que falte). Conferir que o "Selo do lado do nome" do Editar perfil lista o troféu sem
  mudança (usa `ownBadges`).
- [ ] **Step 4: Commit** — `git commit -m "Selo de campeão da semana (troféu com 1)"`.

---

### Task 7: Lógica da mesa (sem 3D) — cliente, erros, regras para a tela e máquina de estados

**Files:**
- Create: `games/shared/supabase.ts`, `games/shared/devLogin.ts`, `games/shared/api.ts`,
  `games/blackjack/rules.ts`, `games/blackjack/machine.ts`,
  `games/blackjack/rules.test.ts`, `games/blackjack/machine.test.ts`, `games/shared/api.test.ts`

**Interfaces:**
- Produces (`games/shared/api.ts`):

```ts
export type Card = number;
export type HandResult = 'blackjack' | 'win' | 'push' | 'lose' | 'bust';
export type Hand = { cards: Card[]; bet: number; doubled: boolean; from_split_aces: boolean; done: boolean; result: HandResult | null };
export type RoundState = { id: string; status: 'playing' | 'done'; bet: number; hands: Hand[]; active: number; dealer: Card[]; dealer_total: number; payout: number; balance: number };
export type Wallet = { balance: number; fiado_count: number; can_fiado: boolean; open_round_id: string | null; week_start: string };
export type Action = 'hit' | 'stand' | 'double' | 'split';
export type GameErrorCode = 'no_session' | 'offline' | 'insufficient_credits' | 'bet_out_of_range' | 'round_open'
  | 'round_done' | 'round_not_found' | 'fiado_today' | 'fiado_not_broke' | 'fiado_open_round' | 'unknown';
export class GameError extends Error { readonly code: GameErrorCode }
export const ERROR_TEXT: Record<GameErrorCode, string>;
export function toGameError(e: unknown): GameError;
export function gamesWallet(): Promise<Wallet>;
export function gamesFiado(): Promise<Wallet>;
export function bjDeal(bet: number): Promise<RoundState>;
export function bjAct(id: string, action: Action): Promise<RoundState>;
export function bjCurrent(): Promise<RoundState | null>;
export function weekBoard(): Promise<{ userId: string; name: string; balance: number }[]>; // painel do PC
```

- Produces (`games/blackjack/rules.ts`): `RANKS`, `SUITS`, `rankLabel(c)`, `suitSymbol(c)`, `isRed(c)`,
  `handTotal(cards): { total: number; soft: boolean }`, `canDouble(round, balance)`, `canSplit(round, balance)`,
  `resultLabel(hand): string` ("Blackjack! +150", "Ganhou +200", "Empate, volta 100", "Estourou", "Banca ganhou"),
  `CHIPS = [10, 50, 100, 500] as const`, `chipEnabled(value, bet, balance)`.
- Produces (`games/blackjack/machine.ts`): reducer puro

```ts
export type Phase = 'loading' | 'no_session' | 'betting' | 'busy' | 'playing' | 'done';
export type MachineState = { phase: Phase; wallet: Wallet | null; round: RoundState | null; bet: number;
  lastBet: number; notice: string | null; weekStart: string | null };
export type MachineEvent =
  | { type: 'loaded'; wallet: Wallet; round: RoundState | null }
  | { type: 'chip'; value: number } | { type: 'clear' }
  | { type: 'request' }                                  // vira 'busy'
  | { type: 'round'; round: RoundState }                 // resposta de deal/act
  | { type: 'wallet'; wallet: Wallet }                   // depois de fiado ou recarga
  | { type: 'again' }                                    // "Bora de novo" → betting com lastBet (se couber)
  | { type: 'failed'; error: GameError };
export const initial: MachineState;
export function reduce(s: MachineState, e: MachineEvent): MachineState;
export function canAct(s: MachineState): boolean;        // false em 'busy' (toque duplo)
```

- [ ] **Step 1: Testes que falham.**
  `rules.test.ts`: `handTotal([0, 5])` (A♠ 6♠) = `{total:17, soft:true}`; `handTotal([0,5,8])` = 16 duro;
  `handTotal([0,13,8])` (A♠ A♥ 9♠) = 21; `rankLabel(9)` = '10', `rankLabel(12)` = 'K'; `isRed(13)` true;
  `canSplit` true para 10 e K com saldo ≥ aposta, false com 2 mãos ou saldo curto; `canDouble` false com 3 cartas
  ou `from_split_aces`; `chipEnabled(500, 100, 450)` false (passa do saldo) e `chipEnabled(100, 450, 1000)` false
  (passa de 500); `resultLabel` de cada resultado com os textos acima (payout por mão: blackjack = bet×1,5).
  `machine.test.ts`:
  - `loaded` sem mão → `betting`, `weekStart` guardado; com mão aberta → `playing`.
  - `chip` soma; não passa de 500 nem do saldo; `clear` zera.
  - `request` → `busy`; `canAct` false; outro `request` em `busy` não muda nada.
  - `round` com `status:'done'` → `done`, `wallet.balance` = `round.balance`, `lastBet` = aposta.
  - `failed` `insufficient_credits` → volta para a fase anterior a `busy` com `notice` "Saldo não cobre essa
    aposta" (e o `main.ts` recarrega a carteira).
  - `failed` `no_session` → `no_session`.
  - `wallet` com `week_start` diferente do guardado → `notice` "A semana virou! Sua mão foi encerrada e todo mundo
    voltou pra 1.000." e `betting`.
  - `again` com saldo menor que `lastBet` → aposta = 0.
  `api.test.ts` (mock de `./supabase`): `toGameError({ message: 'insufficient_credits' })` → código certo;
  `{ status: 401 }`, `{ message: 'JWT expired' }`, `{ code: '42501', message: 'not_member' }` → `no_session`;
  `TypeError('Failed to fetch')` → `offline`; resto → `unknown`.
  Run: `npm test --prefix games` → FAIL.
- [ ] **Step 2: Implementar.**
  `games/shared/supabase.ts`:

```ts
// Mesma origem do app (fellasapp.pages.dev): o storage padrão (localStorage) já tem a sessão que o app gravou.
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(import.meta.env.EXPO_PUBLIC_SUPABASE_URL, import.meta.env.EXPO_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
});
```

  **Conferir a chave da sessão (risco da spec):** abrir o app em produção, DevTools → Application →
  Local Storage, e ver o nome da chave da sessão. Se não for `sb-<ref>-auth-token`, passar `storageKey` igual
  aqui. Registrar o resultado no commit.
  `games/shared/devLogin.ts`: só em `import.meta.env.DEV` (porta 5173 não é a origem do app): formulário
  e-mail/senha que chama `supabase.auth.signInWithPassword` e recarrega; em produção nunca é importado
  (`if (import.meta.env.DEV) await import('./devLogin')`).
  `ERROR_TEXT`: `no_session` "Entra no fellas pra jogar" · `offline` "Sem conexão. Sua mão tá salva." ·
  `insufficient_credits` "Saldo não cobre essa aposta" · `bet_out_of_range` "Aposta vai de 10 a 500" ·
  `round_open` "Você já tem uma mão aberta" · `round_done` "Essa mão já acabou" · `round_not_found` "Essa mão não
  é sua" · `fiado_today` "Fiado de hoje já foi. Volta amanhã." · `fiado_not_broke` "Fiado é só pra quem zerou" ·
  `fiado_open_round` "Termina a mão antes do fiado" · `unknown` "Deu ruim aqui. Tenta de novo."
  `weekBoard()`: `from('game_wallets').select('user_id, balance, profiles(display_name)')` com o mesmo filtro e
  ordem da Tarefa 5, `limit(6)`; nome = `display_name`.
- [ ] **Step 3:** `npm test --prefix games` → PASS; `npx tsc --noEmit -p games` → PASS.
- [ ] **Step 4: Commit** — `git commit -m "Mesa do blackjack: cliente, erros, regras da tela e máquina de estados"`.

---

### Task 8: Cena 3D (Three.js) — mesa, cartas, fichas, desenho só quando mexe

**Files:**
- Create: `games/shared/table3d/loop.ts`, `games/shared/table3d/tween.ts`, `games/shared/table3d/layout.ts`,
  `games/shared/table3d/textures.ts`, `games/shared/table3d/scene.ts`, `games/shared/table3d/loop.test.ts`,
  `games/shared/table3d/layout.test.ts`

**Interfaces:**
- Produces:

```ts
// loop.ts — redesenha só enquanto há animação ou depois de invalidate()
export function createLoop(render: () => void, raf?: (cb: FrameRequestCallback) => number): {
  invalidate(): void; track(isBusy: () => boolean): void; frames(): number };
// tween.ts
export function tween(ms: number, step: (k: number) => void, ease?: (k: number) => number): { done: Promise<void>; busy(): boolean };
// layout.ts — posições na mesa (unidades do mundo) por orientação
export type Orientation = 'portrait' | 'landscape';
export function orientationOf(w: number, h: number): Orientation; // landscape se w >= 700 e w > h
export function cardSlot(o: Orientation, who: 'dealer' | 'player', hand: number, hands: number, i: number): { x: number; z: number };
export const SHOE: { x: number; z: number }; export const POT: { x: number; z: number };
export function camera(o: Orientation): { fov: number; pos: [number, number, number]; look: [number, number, number] };
// textures.ts — desenho em canvas (sem arquivos de imagem)
export function cardFace(c: number): HTMLCanvasElement; // índice só no canto de cima + naipe grande embaixo à direita
export function cardBack(): HTMLCanvasElement;          // listras vinho com borda branca (mockup)
export function chipFace(value: 10 | 50 | 100 | 500): HTMLCanvasElement;
export function feltTexture(): HTMLCanvasElement;       // gradiente radial verde do mockup
// scene.ts
export type Table = {
  resize(w: number, h: number): void;
  dealCard(who: 'dealer' | 'player', hand: number, hands: number, i: number, card: number | null): Promise<void>; // null = virada
  reveal(i: number, card: number): Promise<void>;   // vira a carta da banca
  layoutHands(round: RoundState): Promise<void>;    // depois de dividir: reposiciona
  setPot(amount: number): void; clear(): Promise<void>;
  anchor(who: 'dealer' | 'player', hand: number): { x: number; y: number }; // ponto na tela p/ a plaquinha
  reducedMotion: boolean;
};
export function createTable(canvas: HTMLCanvasElement): Table | null; // null = sem WebGL
```

- [ ] **Step 1: Testes que falham.** `loop.test.ts` com `raf` falso (fila manual): sem animação, `invalidate()`
  gera 1 quadro e para; com `track(() => k < 3)` roda enquanto ocupado e para depois (contagem por `frames()`);
  vários `invalidate()` no mesmo quadro = 1 quadro. `layout.test.ts`: `orientationOf(390, 844)` = portrait,
  `(1280, 720)` = landscape, `(800, 1000)` = portrait; em portrait, `cardSlot` do jogador fica com `z` maior
  (mais perto da câmera) que o da banca; cartas da mesma mão se deslocam em `x` (leque) por um passo fixo; com
  2 mãos, as mãos ficam à esquerda/direita do centro sem se encostar.
  Run → FAIL.
- [ ] **Step 2: Implementar `loop.ts`, `tween.ts`, `layout.ts`.**

```ts
// loop.ts
export function createLoop(render: () => void, raf: (cb: FrameRequestCallback) => number = requestAnimationFrame) {
  let queued = false;
  let count = 0;
  const busy: (() => boolean)[] = [];
  const frame = () => {
    queued = false;
    count++;
    render();
    for (let i = busy.length - 1; i >= 0; i--) if (!busy[i]()) busy.splice(i, 1);
    if (busy.length) schedule();
  };
  const schedule = () => {
    if (queued || document.hidden) return; // aba escondida: nada de desenhar
    queued = true;
    raf(frame);
  };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) schedule(); });
  return { invalidate: schedule, track(isBusy: () => boolean) { busy.push(isBusy); schedule(); }, frames: () => count };
}
```

  (No teste, `document` vem do ambiente `happy-dom` ou `jsdom` do vitest: acrescentar
  `environment: 'happy-dom'` só para esses arquivos via `// @vitest-environment happy-dom` e
  `happy-dom` em devDependencies, versão fixa atual.)
  `tween.ts`: `ease` padrão = saída exponencial (`1 - 2^(-10k)`), mesma curva do DESIGN.md; usa `performance.now()`.
  `layout.ts`: valores de mundo com a mesa de raio 5 centrada na origem; portrait: banca em `z = -2.2`,
  jogador em `z = 1.6`, pote em `z = -0.2`, sapato em `(3.2, -2.6)`; landscape: banca `z = -1.8`, jogador
  `z = 1.4`; passo do leque `0.55` (carta de largura `0.9`: sobra o índice do canto de cima); duas mãos em
  `x = ±1.6`. Câmeras: portrait `fov 50, pos [0, 9.5, 6.5], look [0, 0, -0.2]`; landscape
  `fov 40, pos [0, 7.5, 7.5], look [0, 0, 0]`. Ajustar no navegador (Step 4) e atualizar o teste se mudar.
- [ ] **Step 3: Implementar `textures.ts` e `scene.ts`.** Texturas em canvas 256×356 (carta) com a fonte
  Golos Text (já carregada pela página): índice `rankLabel` + `suitSymbol` no canto de cima à esquerda, naipe
  grande no canto de baixo à direita, vermelho `#C81E3A` / preto `#121212`, raio 14. Cena: `WebGLRenderer`
  com `antialias`, `setPixelRatio(Math.min(devicePixelRatio, 2))`; luz ambiente + uma direcional (sem sombras
  em tempo real: a sombra da carta é um plano escuro translúcido embaixo dela); mesa = `ShapeGeometry` (topo
  arredondado como o mockup) com `feltTexture`, borda = `ExtrudeGeometry` marrom `#5a3a1e`; arco dourado
  "BANCA PARA EM 17 · BLACKJACK PAGA 3:2" como textura de canvas deitada na mesa; carta = `BoxGeometry(0.9,
  0.012, 1.26)` com face/verso por material; ficha = `CylinderGeometry` com `chipFace` no topo e pilha no pote.
  `dealCard`: sai do `SHOE`, voa até o slot em 320 ms; virada fica com o verso; `reveal` gira 180° em 260 ms.
  Com `reducedMotion` (`matchMedia('(prefers-reduced-motion: reduce)')`), tudo aparece no lugar sem voar.
  Toda animação passa por `tween` + `loop.track`. `createTable` devolve `null` se `WebGLRenderer` lançar ou
  `canvas.getContext('webgl2') ?? getContext('webgl')` for nulo. `anchor` projeta o centro da mão
  (`Vector3.project(camera)`) para pixels da tela.
- [ ] **Step 4: Ver no navegador.** Página de rascunho `games/blackjack/index.html` mínima (só o canvas em tela
  cheia + `createTable`) e `npm run dev --prefix games`; com o Chrome (skill claude-in-chrome) abrir
  `http://localhost:5173/games/blackjack/`, chamar no console uma sequência `dealCard` + `reveal` e comparar com
  `fichas.html` no celular (390×844) e `pc-layout.html` no PC (1280×720): mesa inclinada, carta legível,
  nenhuma carta abaixo da área do painel (o canvas termina onde o painel começa: ver Tarefa 9). Conferir no
  painel Performance que, parada, a página não desenha quadros.
- [ ] **Step 5:** `npm test --prefix games` e `npx tsc --noEmit -p games` → PASS.
- [ ] **Step 6: Commit** — `git commit -m "Mesa 3D: feltro, cartas e fichas desenhadas em canvas, desenho só quando mexe"`.

---

### Task 9: Tela do Blackjack — HUD, fluxo, estados, PC e atalhos

**Files:**
- Create/Modify: `games/blackjack/index.html`, `games/blackjack/main.ts`, `games/shared/hud/hud.css`,
  `games/shared/hud/hud.ts`, `games/blackjack/view.ts`, `games/blackjack/view.test.ts`

**Interfaces:**
- Consumes: `api.ts`, `rules.ts`, `machine.ts` (Tarefa 7), `createTable` (Tarefa 8).
- Produces (`hud.ts`, DOM puro, sem framework): `creditsPill(el)`, `tag(el)` (plaquinha; variante dourada),
  `coinButton({ action, label, color, icon, key })`, `betChip(value)`, `panel()`, `notice(text, retry?)`,
  `countUp(el, from, to, ms)`; `view.ts`: `render(state: MachineState, root: HTMLElement, table: Table)` que só
  troca o que mudou (fase, saldo, aposta, botões acesos, plaquinhas).

- [ ] **Step 1: Testes que falham** (`// @vitest-environment happy-dom`) — `view.test.ts`, com uma `Table`
  falsa: em `betting` aparecem as 4 fichas, "Limpar" e "Dar as cartas" (desabilitado com aposta 0); fichas que
  não cabem ficam `aria-disabled="true"`; em `playing` aparecem Pedir/Parar sempre e Dobrar/Dividir só quando
  `canDouble`/`canSplit`; em `busy` todos os botões `disabled`; em `done` a plaquinha tem a classe dourada quando
  `payout > bet` e o texto de `resultLabel`, e aparece "Bora de novo"; a plaquinha de resultado tem
  `aria-live="polite"`; em `no_session` aparece "Entra no fellas pra jogar" com link para `/`.
  Run → FAIL.
- [ ] **Step 2: HUD.** `hud.css` copia as classes dos mockups (`fichas.html`: `.pill`, `.tag`, `.panel`,
  `.betrow`, `.chips`/`.k` fichas de cassino com `.sel` e `.off`, `.a`/`.b`/`.l` botões moeda e as cores
  `.g .r .v .y`, `.cta`/`.btn`; `pc-layout.html`: `.side` placar, `.betbox`, `kbd`), com as cores em variáveis
  no `:root` (`--felt-1: #1d8a58` etc.) e a fonte Golos Text pelo Google Fonts. Ícones dos botões = os SVG de
  traço dos mockups. Botões são `<button>` com `aria-label` ("Pedir carta", "Parar", "Dobrar a aposta",
  "Dividir o par"), alvo ≥ 56 px. Painel com fundo próprio: o canvas ocupa só a área acima dele
  (`grid-template-rows: auto 1fr auto`), então carta nenhuma fica atrás dos botões.
- [ ] **Step 3: `main.ts` (efeitos).**
  1. `if (import.meta.env.DEV) await import('../shared/devLogin')`; sem sessão
     (`supabase.auth.getSession()`) → evento `failed` `no_session`.
  2. `createTable(canvas)`; `null` → aviso "Esse navegador não roda a mesa 3D. Tenta pelo Chrome ou Safari
     atualizado." e para.
  3. `gamesWallet()` + `bjCurrent()` → `loaded`; com mão aberta, desenha as cartas no lugar (sem voar).
  4. Ficha → `chip`; "Dar as cartas" → `request` + `bjDeal(bet)` → anima 4 cartas na ordem (jogador, banca,
     jogador, banca virada) → `round`.
  5. Ação → `request`; a carta já sai do sapato no toque e a face aparece quando chega a resposta; depois
     `round`. Fim: `reveal` da virada, compras da banca uma a uma (220 ms entre elas), plaquinha, `countUp` do
     saldo.
  6. `failed`: `insufficient_credits`/`round_done` → recarrega `gamesWallet()` (+ `bjCurrent()`) → `wallet`
     (o reducer detecta semana nova); `offline` → `notice` com "Tentar de novo" que refaz o último pedido.
  7. "Pegar fiado" (saldo 0 e `can_fiado`) → `gamesFiado()` → `wallet`.
  8. "← Voltar" → `location.assign('/games')`.
  9. PC (`orientationOf` = landscape): painel `.side` com `weekBoard()` (recarrega ao fim de cada mão),
     `.betbox` à esquerda, atalhos `1` Pedir · `2` Parar · `3` Dobrar · `4` Dividir · `Enter` Dar as cartas /
     Bora de novo; só valem com `canAct`.
  10. `resize`/`orientationchange` → `table.resize` e troca de layout.
- [ ] **Step 4: Rodar** `npm test --prefix games` → PASS; `npx tsc --noEmit -p games` → PASS.
- [ ] **Step 5: Conferir no navegador** (claude-in-chrome; banco de produção só depois da Tarefa 10, então aqui
  com o `.env` apontando para o Supabase e as migrações já aplicadas — se ainda não aplicadas, pular para a
  conferência da Tarefa 10): celular 390×844 em pé e 844×390 deitado, PC 1280×720; fazer uma mão de cada
  resultado (forçar não dá em produção: jogar até ver ganhar, perder, empatar, estourar), dobrar, dividir, sair no
  meio e voltar (retoma), modo avião (aviso + Tentar de novo), reduzir movimento ligado. Comparar com os mockups.
- [ ] **Step 6: Commit** — `git commit -m "Tela do blackjack: fichas, botões moeda, plaquinhas, PC com placar e atalhos"`.

---

### Task 10: Build e publicação da mesa (push 1)

**Files:**
- Modify: `.github/workflows/deploy-web.yml`, `README.md` (seção de deploy: "Fellas Games")

- [ ] **Step 1: Workflow** — depois do passo `npm run build:web` (com o mesmo `env`):

```yaml
      # mesas dos Fellas Games (Vite + Three.js) em dist/games/<jogo>/, mesmo deploy do app
      - run: npm ci --prefix games
      - run: npm test --prefix games
      - run: npm run build --prefix games
        env:
          EXPO_PUBLIC_SUPABASE_URL: ${{ secrets.EXPO_PUBLIC_SUPABASE_URL }}
          EXPO_PUBLIC_SUPABASE_ANON_KEY: ${{ secrets.EXPO_PUBLIC_SUPABASE_ANON_KEY }}
```

  e `cache-dependency-path: |\n  package-lock.json\n  games/package-lock.json` no `setup-node`.
- [ ] **Step 2: Build local igual ao CI** — `npm run build:web && npm ci --prefix games && npm run build --prefix games`;
  conferir que existem `dist/index.html` **e** `dist/games/blackjack/index.html`, que nenhuma pasta
  `node_modules` foi parar em `dist/games` e que o `dist/_expo` continua lá (o `emptyOutDir: false` funcionou).
- [ ] **Step 3: README** — parágrafo em "Deploy web": a mesa é um projeto à parte em `games/`
  (`npm run dev --prefix games`, login de teste só no dev), publicada em `/games/blackjack/` pelo mesmo workflow.
- [ ] **Step 4: Commit** — `git commit -m "Deploy: mesas dos Fellas Games buildadas junto com o app"`.
- [ ] **Step 5: Migração pelo Juan.** Parar e entregar ao Juan: primeiro `npx supabase migration list` (conferir
  que só 0027 e 0028 estão pendentes), depois o `db push` (comando do jeito que ele já usa, com `!` no prompt).
  Conferir pela REST com a chave anon + login de um membro (ou pelo app logado no Chrome): `game_wallets` e
  `game_weeks` respondem 200; `rpc/games_wallet` devolve 1.000; `bj_secrets` volta erro/vazio; e no SQL editor
  `select name, schedule from cron.job where jobname = 'fellas-games-reset'`.
- [ ] **Step 6: Push 1.** `npm test`, `npx tsc --noEmit`, `npm test --prefix games` no resultado do merge;
  `git checkout main && git merge --no-ff feature/fellas-games && git push`. Esperar o workflow; abrir
  `https://fellasapp.pages.dev/games/blackjack/` logado no Chrome do PC, no PWA do iPhone e no APK: a sessão é
  reconhecida sem novo login; recarregar a página da mesa abre a mesa (não o app); `/members` e o feed continuam
  abrindo. Voltar para `feature/fellas-games` para as próximas tarefas.

---

### Task 11: App — 5ª aba, lateral, rota larga e a tela Fellas Games

**Files:**
- Create: `app/(tabs)/games.tsx`, `components/games/WalletCard.tsx`, `components/games/Leaderboard.tsx`,
  `components/games/ChampionRow.tsx`, `components/games/GameCard.tsx`, `components/games/TableArt.tsx`,
  `__tests__/gamesScreen.test.tsx`
- Modify: `app/(tabs)/_layout.tsx`, `components/shell/Sidebar.tsx`, `components/shell/AppShell.tsx`,
  `lib/theme.ts` (`layout.wideCenterWidth: 960`), `__tests__/tabsLayout.test.tsx`, `__tests__/appShell.test.tsx`

**Interfaces:**
- Consumes: `getWallet`, `takeFiado`, `getLeaderboard`, `getLastChampion`, `gamesErrorMessage` (Tarefa 5);
  `TrophyBadge`/`NameWithBadge` (Tarefa 6); `useSession()` (meu id).
- Produces: `NavKey` ganha `'games'`; `activeNavItem('/games') === 'games'`; `isWideRoute(first?: string): boolean`
  em `AppShell` (true para `'(tabs)'` + segmento `games`; conferir com `useSegments()` o formato real).

- [ ] **Step 1: Testes que falham.**
  `tabsLayout.test.tsx`: mock de `Tabs.Screen` que registra `name`; a ordem é
  `['feed', 'new', 'games', 'notifications', 'profile']` e a aba `games` tem
  `tabBarAccessibilityLabel: 'Fellas Games'`.
  `appShell.test.tsx` (ou teste do `Sidebar`): `activeNavItem('/games')` = `'games'`; o item "Fellas Games" é o
  último da lista; em `/games` com tier expanded não há `RightRail` e a coluna do meio usa `wideCenterWidth`.
  `gamesScreen.test.tsx` (mock de `lib/api/games`): carregando mostra as linhas fantasma; erro mostra
  "Não deu pra carregar o placar. Tenta de novo." e o botão "Tentar de novo" recarrega; placar vazio mostra
  "Ninguém jogou essa semana ainda. Abre os trabalhos."; sem campeão anterior a seção some; minha linha tem o
  fundo `brandSoft`; "· 1 fiado" aparece; saldo 0 com `canFiado` mostra "Pegar fiado (+100)" e, tocando,
  chama `takeFiado` e atualiza o saldo; `fiado_today` mostra "Fiado de hoje já foi. Volta amanhã.";
  `openRoundId` troca "Jogar" por "Continuar mão"; Poker aparece com "Em breve" e não é tocável.
  Run: `npx jest __tests__/gamesScreen.test.tsx __tests__/tabsLayout.test.tsx __tests__/appShell.test.tsx` → FAIL.
- [ ] **Step 2: Navegação.** `_layout.tsx`: nova `Tabs.Screen name="games"` entre `new` e `notifications`,
  `options={{ title: 'Fellas Games', tabBarAccessibilityLabel: 'Fellas Games', tabBarIcon:
  tabIcon('game-controller', 'game-controller-outline') }}`. `Sidebar.tsx`: `NavKey` + `'games'`; item
  `{ key: 'games', label: 'Fellas Games', href: '/games', icon: 'game-controller-outline', iconActive:
  'game-controller' }` no fim de `ITEMS` (incluir `'/games'` no tipo de `href`); `activeNavItem`:
  `if (pathname === '/games') return 'games';`.
- [ ] **Step 3: Rota larga.** `lib/theme.ts` `layout.wideCenterWidth: 960` (comentário: "Coluna do meio das
  rotas largas (Fellas Games), sem a coluna da direita"). `AppShell`: `const wide = framed && isWideRoute(...)`;
  largura da coluna = `wide ? t.layout.wideCenterWidth : t.layout.centerWidth`; `RightRail` só se `!wide`;
  `contentWidth` do contexto acompanha.
- [ ] **Step 4: Tela.** `app/(tabs)/games.tsx` com `Screen`, `Heading` "Fellas Games", texto `textMuted`
  "Todo mundo começa a semana com 1.000. Zera segunda à meia-noite."; carrega os quatro dados em paralelo ao
  ganhar foco (`useFocusEffect`); em `useContentWidth() >= 700` duas colunas (esquerda: `ChampionRow` +
  `Leaderboard`; direita: `WalletCard` + `GameCard`s), senão uma coluna na ordem: créditos, jogos, campeão,
  placar. `Leaderboard`: linhas com `Divider` (posição, `Avatar sm`, nome em negrito, "· N fiado(s)" em
  `textMuted`, saldo em negrito à direita); minha linha com fundo `brandSoft` e raio `md`; fantasma = 5 linhas
  `surfaceSunken`. `ChampionRow`: rótulo `caption` "CAMPEÃO DA SEMANA PASSADA", `Avatar md`, nome +
  `TrophyBadge`, "fechou com 4.870". `WalletCard`: rótulo "SEUS CRÉDITOS", saldo `headline`, "4º lugar";
  `Button` "Pegar fiado (+100)" quando `canFiado`. `GameCard`: arte (`TableArt`: feltro em gradiente com duas
  cartas, o único lugar do app com as cores da mesa — exceção registrada no DESIGN.md), nome, "Você contra a
  banca · 10 a 500", `Button` primário "Jogar"/"Continuar mão" que faz
  `Linking.openURL('/games/blackjack/')` na web (`window.location.assign`); Poker com "Texas Hold'em · 2 a 6
  fellas" e `Button` secundário desabilitado "Em breve". Valores numéricos formatados com
  `toLocaleString('pt-BR')`. Todos os tamanhos, cores e raios por token.
- [ ] **Step 5:** os três testes → PASS; `npm test` e `npx tsc --noEmit` → PASS.
- [ ] **Step 6: Ver no navegador** (`npx expo start --web` + claude-in-chrome): celular 390×844 (5 ícones
  embaixo, Games no meio-direita), PC 1280 (lateral com "Fellas Games", centro largo, sem coluna direita), tema
  claro e escuro; "Jogar" abre a mesa; "← Voltar" da mesa volta para a aba (em produção; no dev a mesa roda em
  outra porta).
- [ ] **Step 7: Commit** — `git commit -m "Aba Fellas Games: saldo, fiado, placar, campeão e jogos; 5ª aba e lateral"`.

---

### Task 12: DESIGN.md, revisão final e publicação (push 2)

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: DESIGN.md.** Em "Layout por largura": barra de baixo **Feed · Novo post · Games ·
  Notificações · Perfil**; lateral com "Fellas Games" no fim; rota larga `/games` (`wideCenterWidth` 960, sem
  coluna direita). Nova seção "Fellas Games": a aba (créditos, fiado, campeão com troféu, placar com a minha
  linha `brandSoft`, cards dos jogos; `TableArt` é a única exceção de cor do app) e a mesa (página própria em
  `/games/<jogo>/`: feltro 3D, carta com índice só no canto de cima, plaquinhas escuras com borda dourada —
  dourada cheia quando ganha —, painel escuro próprio, botões moeda verde/vermelho/violeta/laranja com aro
  dourado, fichas de cassino 10/50/100/500, PC em tela inteira com placar à direita e atalhos 1–4, reduzir
  movimento = sem voo). Em "Ícones": selo `TrophyBadge` (troféu com "1", `brand`) é marca, como o verificado.
- [ ] **Step 2: Verificação completa** (superpowers:verification-before-completion): `npm test`,
  `npx tsc --noEmit`, `npm test --prefix games`, `npx tsc --noEmit -p games`, build local igual ao CI (Tarefa 10,
  Step 2). Colar a saída.
- [ ] **Step 3: Revisão** (superpowers:requesting-code-review) da branch inteira contra a spec; corrigir o que vier.
- [ ] **Step 4: Commit + push 2** — `git commit -m "DESIGN.md: Fellas Games, mesa do blackjack e selo de troféu"`;
  merge local na main + `git push`; apagar a branch. Conferir em produção: 5ª aba no celular e no APK, item na
  lateral do PC, a aba carrega o placar, "Jogar" → mesa → "← Voltar" → aba, e o troféu aparece no "Selo do lado
  do nome" de quem tem (pode testar dando o selo a si mesmo pelo SQL editor e tirando depois).
- [ ] **Step 5: Primeira segunda-feira.** Na terça, conferir no SQL editor `select * from game_weeks` (uma
  linha, campeão certo) e `select badges from profiles where 'weekly_champion' = any(badges)`.
