# Mural de ideias — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os fellas mandam ideias de feature num mural, todo mundo vê e vota ↑/↓ como no Reddit, com abas Top e Novas.

**Architecture:** Duas tabelas (`ideas`, `idea_votes`) e uma função `ideas_feed(sort)` que devolve cada ideia já com pontuação e meu voto. No app, regras puras em `lib/ideas.ts`, chamadas ao banco em `lib/api/ideas.ts`, estado da tela (voto otimista, rollback, tempo real) em `lib/useIdeas.ts`, e a UI em `components/ideas/*` + `app/ideas.tsx`. Entradas: item na `Sidebar` (computador) e lâmpada no topo do feed (celular).

**Tech Stack:** Expo SDK 57, expo-router (Stack), React Native / react-native-web, TypeScript, jest-expo + @testing-library/react-native v14 (render/fireEvent/renderHook são `await`ados), Supabase (Postgres + RLS + Realtime).

**Spec:** `docs/superpowers/specs/2026-10-06-mural-de-ideias-design.md`

## Global Constraints

- Texto da interface em pt-BR, no tom do `PRODUCT.md`; nunca emoji como ícone (só `Icon`/Ionicons, variante `-outline` fora da tab bar).
- Telas usam tokens de `lib/theme.ts` e primitivos de `components/ui`; sem cor, tamanho, raio ou fonte solta (CLAUDE.md). Frontend segue a skill Impeccable (modo Operate).
- Ideia: 1 a **280** caracteres depois de `trim`; contador aparece quando o texto passa de **240** ("N restantes").
- Voto: **+1, −1 ou nenhum**, um por pessoa por ideia. Pontuação = soma; pode ser negativa e aparece como "−3".
- `ideas_feed` devolve até **100** ideias; `top` = pontuação desc, depois mais nova; `new` = mais nova primeiro.
- Apagar: autor apaga a própria ideia; admin (`is_admin()` da 0012) apaga qualquer uma.
- Migration: `supabase/migrations/0013_ideas.sql`, idempotente. Branch `feat/ideias` (sai do `feat/convites`).
- `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa. Um commit por tarefa.
- Em testes do RNTL v14: `await render(...)`, `await fireEvent.*(...)`, `await renderHook(...)`.

## Review Focus

1. **Toques rápidos seguidos na mesma seta** (duplo toque, dedo nervoso): enquanto o voto de uma ideia está indo pro servidor, novos toques nela são ignorados; o estado final bate com o que foi enviado. → teste na Task 5.
2. **Trocar de aba enquanto a anterior ainda carrega**: a resposta atrasada da aba antiga não pode sobrescrever a lista da aba nova. → teste na Task 5.
3. **Autor fora do diretório de membros** (saiu do grupo, ou o diretório ainda não carregou): a ideia aparece com o nome "Alguém" e iniciais, sem quebrar. → teste na Task 3.
4. **Meu próprio voto chegando pelo tempo real** não pode recarregar e desfazer o estado otimista; voto de outra pessoa recarrega. → teste na Task 5.
5. **Apagar barrado pelo banco** (ideia de outra pessoa sem ser admin, ou já apagada) devolve 0 linhas sem erro do Supabase: tem que virar erro visível no diálogo, não "sucesso" silencioso. → teste na Task 3.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0013_ideas.sql` (novo) | Tabelas, RLS, `ideas_feed`, publicação do Realtime |
| `types/database.ts` | Tipos das tabelas e da função |
| `supabase/README.md` | Linha da 0013 |
| `lib/ideas.ts` (novo) | Tipos e regras puras: `applyVote`, `validateIdea`, `formatScore`, `remainingLabel` |
| `lib/api/ideas.ts` (novo) | `fetchIdeas`, `createIdea`, `voteIdea`, `deleteIdea`, `ideaErrorMessage` |
| `lib/realtime.ts` | `LIVE_TABLES` + `ideas`/`idea_votes`; `actorOf`; `affectsNotifications` ignora ideias |
| `lib/useIdeas.ts` (novo) | Estado da tela: aba, lista, voto otimista, tempo real |
| `components/ideas/VoteColumn.tsx` (novo) | ▲ número ▼ |
| `components/ideas/IdeaRow.tsx` (novo) | Uma ideia |
| `components/ideas/IdeasButton.tsx` (novo) | Lâmpada do topo do feed |
| `app/ideas.tsx` (novo) | Tela do mural |
| `app/_layout.tsx` | Rota `ideas` |
| `components/shell/Sidebar.tsx` | Item "Ideias" |
| `app/(tabs)/feed.tsx` | Lâmpada ao lado do sino (só existe no cabeçalho `compact`) |

---

### Task 1: Banco — tabelas, regras, `ideas_feed`, tempo real

**Files:**
- Create: `supabase/migrations/0013_ideas.sql`
- Modify: `types/database.ts` (bloco `Tables` e bloco `Functions`)
- Modify: `supabase/README.md` (tabela de migrations)

**Interfaces:**
- Consumes: `public.is_member()` (0001), `public.is_admin()` (0012).
- Produces: tabelas `ideas(id, author_id, body, created_at)`, `idea_votes(idea_id, user_id, value, created_at)`; função `ideas_feed(p_sort text) → (id uuid, author_id uuid, body text, created_at timestamptz, score integer, my_vote smallint)`; tipos `Tables<'ideas'>`, `Tables<'idea_votes'>`, `Database['public']['Functions']['ideas_feed']`.

- [ ] **Step 1: Escrever a migration**

`supabase/migrations/0013_ideas.sql`:

```sql
-- fellasapp: mural de ideias (voto ↑/↓ estilo Reddit). Idempotente. Depende da 0012 (is_admin).
-- ideas: texto curto de um fella. idea_votes: um voto por pessoa por ideia (+1 ou -1); trocar o voto
-- atualiza a linha, tirar apaga. ideas_feed(sort) devolve as ideias já com pontuação e o meu voto.

create table if not exists public.ideas (
  id         uuid primary key default gen_random_uuid(),
  author_id  uuid not null references public.profiles (id) on delete cascade,
  body       text not null check (char_length(btrim(body)) between 1 and 280),
  created_at timestamptz not null default now()
);

create table if not exists public.idea_votes (
  idea_id    uuid not null references public.ideas (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  value      smallint not null check (value in (-1, 1)),
  created_at timestamptz not null default now(),
  primary key (idea_id, user_id)
);

create index if not exists ideas_created_at_idx   on public.ideas (created_at desc);
create index if not exists idea_votes_user_id_idx on public.idea_votes (user_id);

alter table public.ideas      enable row level security;
alter table public.idea_votes enable row level security;

-- ideas: membros leem; cada um manda em nome próprio; autor ou admin apaga; ninguém edita.
drop policy if exists "ideas_select_members" on public.ideas;
create policy "ideas_select_members" on public.ideas
  for select to authenticated using (public.is_member());

drop policy if exists "ideas_insert_own" on public.ideas;
create policy "ideas_insert_own" on public.ideas
  for insert to authenticated
  with check (author_id = auth.uid() and public.is_member());

drop policy if exists "ideas_delete_own_or_admin" on public.ideas;
create policy "ideas_delete_own_or_admin" on public.ideas
  for delete to authenticated
  using (author_id = auth.uid() or public.is_admin());

revoke update on public.ideas from anon, authenticated;

-- idea_votes: membros leem; cada um só mexe no próprio voto (insert/upsert, update, delete).
drop policy if exists "idea_votes_select_members" on public.idea_votes;
create policy "idea_votes_select_members" on public.idea_votes
  for select to authenticated using (public.is_member());

drop policy if exists "idea_votes_insert_own" on public.idea_votes;
create policy "idea_votes_insert_own" on public.idea_votes
  for insert to authenticated
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists "idea_votes_update_own" on public.idea_votes;
create policy "idea_votes_update_own" on public.idea_votes
  for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid() and public.is_member());

drop policy if exists "idea_votes_delete_own" on public.idea_votes;
create policy "idea_votes_delete_own" on public.idea_votes
  for delete to authenticated
  using (user_id = auth.uid());

-- security invoker: as políticas acima valem (não-membro recebe lista vazia).
-- p_sort diferente de 'new' cai em 'top'.
create or replace function public.ideas_feed(p_sort text default 'top')
returns table (
  id         uuid,
  author_id  uuid,
  body       text,
  created_at timestamptz,
  score      integer,
  my_vote    smallint
)
language sql
stable
security invoker
set search_path = public
as $$
  select i.id,
         i.author_id,
         i.body,
         i.created_at,
         coalesce(sum(v.value), 0)::integer as score,
         max(case when v.user_id = auth.uid() then v.value end)::smallint as my_vote
    from public.ideas i
    left join public.idea_votes v on v.idea_id = i.id
   group by i.id
   order by case when p_sort = 'new' then null else coalesce(sum(v.value), 0) end desc nulls last,
            i.created_at desc
   limit 100;
$$;

revoke all on function public.ideas_feed(text) from public;
grant execute on function public.ideas_feed(text) to authenticated;

-- tempo real: mesma publicação da 0009
do $$
declare
  t text;
begin
  foreach t in array array['ideas', 'idea_votes'] loop
    if not exists (
      select 1
        from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end
$$;
```

- [ ] **Step 2: Tipos**

Em `types/database.ts`, dentro de `Tables`, antes de `invite_links: {`, inserir:

```ts
      ideas: {
        Row: {
          id: string;
          author_id: string;
          body: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          author_id: string;
          body: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          author_id?: string;
          body?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      idea_votes: {
        Row: {
          idea_id: string;
          user_id: string;
          value: number;
          created_at: string;
        };
        Insert: {
          idea_id: string;
          user_id: string;
          value: number;
          created_at?: string;
        };
        Update: {
          idea_id?: string;
          user_id?: string;
          value?: number;
          created_at?: string;
        };
        Relationships: [];
      };
```

E dentro de `Functions`, depois de `redeem_invite: { … };`:

```ts
      ideas_feed: {
        Args: { p_sort?: string };
        Returns: {
          id: string;
          author_id: string;
          body: string;
          created_at: string;
          score: number;
          my_vote: number | null;
        }[];
      };
```

- [ ] **Step 3: README**

Em `supabase/README.md`, na tabela de migrations, logo abaixo da linha da `0012_invites.sql`:

```markdown
| `0013_ideas.sql` | mural de ideias: `ideas`, `idea_votes` (+1/−1), `ideas_feed(sort)` e tempo real | a tela Ideias não carrega nem vota |
```

- [ ] **Step 4: Verificar tipos**

Run: `npx tsc --noEmit`
Expected: sem saída (passa).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0013_ideas.sql types/database.ts supabase/README.md
git commit -m "Ideias: tabelas, regras, ideas_feed e tempo real (0013)"
```

---

### Task 2: Regras puras (`lib/ideas.ts`)

**Files:**
- Create: `lib/ideas.ts`
- Test: `__tests__/ideas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `IDEA_MAX = 280`, `IDEA_COUNTER_FROM = 240`
  - `type Vote = 1 | -1 | null`, `type IdeaSort = 'top' | 'new'`
  - `type IdeaAuthor = { id: string; name: string; avatarUrl: string | null }`
  - `type Idea = { id: string; body: string; createdAt: string; author: IdeaAuthor; score: number; myVote: Vote }`
  - `applyVote(idea: { score: number; myVote: Vote }, tapped: 1 | -1): { score: number; myVote: Vote }`
  - `validateIdea(text: string): string | null` (texto aparado, ou `null` se inválido)
  - `formatScore(score: number): string`
  - `remainingLabel(text: string): string | null`

- [ ] **Step 1: Teste que falha**

`__tests__/ideas.test.ts`:

```ts
import { applyVote, formatScore, IDEA_MAX, remainingLabel, validateIdea } from '../lib/ideas';

describe('applyVote', () => {
  it.each([
    // [meu voto antes, seta tocada, meu voto depois, variação da pontuação]
    [null, 1, 1, +1],
    [1, 1, null, -1],
    [-1, 1, 1, +2],
    [null, -1, -1, -1],
    [-1, -1, null, +1],
    [1, -1, -1, -2],
  ] as const)('voto %s, toca %s → %s (%s)', (before, tapped, after, delta) => {
    expect(applyVote({ score: 5, myVote: before }, tapped)).toEqual({ myVote: after, score: 5 + delta });
  });
});

describe('validateIdea', () => {
  it('apara e aceita de 1 a 280', () => {
    expect(validateIdea('  bora ter modo escuro  ')).toBe('bora ter modo escuro');
    expect(validateIdea('a'.repeat(IDEA_MAX))).toBe('a'.repeat(IDEA_MAX));
  });
  it('recusa vazio, só espaço/quebra de linha e mais de 280', () => {
    expect(validateIdea('')).toBeNull();
    expect(validateIdea(' \n\t ')).toBeNull();
    expect(validateIdea('a'.repeat(IDEA_MAX + 1))).toBeNull();
  });
});

describe('formatScore', () => {
  it('negativo com sinal de menos de verdade', () => {
    expect(formatScore(7)).toBe('7');
    expect(formatScore(0)).toBe('0');
    expect(formatScore(-3)).toBe('−3');
  });
});

describe('remainingLabel', () => {
  it('só aparece passando de 240', () => {
    expect(remainingLabel('a'.repeat(240))).toBeNull();
    expect(remainingLabel('a'.repeat(241))).toBe('39 restantes');
    expect(remainingLabel('a'.repeat(280))).toBe('0 restantes');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/ideas.test.ts`
Expected: FAIL, "Cannot find module '../lib/ideas'".

- [ ] **Step 3: Implementar**

`lib/ideas.ts`:

```ts
/** Mural de ideias: tipos e regras sem rede (voto estilo Reddit, limite do texto). */

export const IDEA_MAX = 280;
/** O contador de caracteres só aparece daqui pra cima. */
export const IDEA_COUNTER_FROM = 240;

export type Vote = 1 | -1 | null;
export type IdeaSort = 'top' | 'new';
export type IdeaAuthor = { id: string; name: string; avatarUrl: string | null };
export type Idea = {
  id: string;
  body: string;
  createdAt: string;
  author: IdeaAuthor;
  score: number;
  myVote: Vote;
};

/** Toque numa seta: a mesma seta tira o voto; a outra troca (e a pontuação anda 2). */
export function applyVote(idea: { score: number; myVote: Vote }, tapped: 1 | -1): { score: number; myVote: Vote } {
  const myVote: Vote = idea.myVote === tapped ? null : tapped;
  return { myVote, score: idea.score - (idea.myVote ?? 0) + (myVote ?? 0) };
}

/** Texto aparado pronto pra mandar, ou null se vazio/longo demais. */
export function validateIdea(text: string): string | null {
  const body = text.trim();
  return body.length >= 1 && body.length <= IDEA_MAX ? body : null;
}

/** "−3" com o sinal de menos tipográfico (o hífen fica curto ao lado do número). */
export function formatScore(score: number): string {
  return score < 0 ? `−${Math.abs(score)}` : String(score);
}

export function remainingLabel(text: string): string | null {
  return text.length > IDEA_COUNTER_FROM ? `${IDEA_MAX - text.length} restantes` : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/ideas.test.ts`
Expected: PASS (todos).

- [ ] **Step 5: Commit**

```bash
git add lib/ideas.ts __tests__/ideas.test.ts
git commit -m "Ideias: regras do voto e do texto"
```

---

### Task 3: API (`lib/api/ideas.ts`)

**Files:**
- Create: `lib/api/ideas.ts`
- Test: `__tests__/ideasApi.test.ts`

**Interfaces:**
- Consumes: `Idea`, `IdeaSort`, `Vote`, `validateIdea` (Task 2); `getMemberDirectory(): MentionMember[]` de `lib/memberDirectory` (`MentionMember = { id, username, name, avatarUrl }`); `friendlyError(error, fallback)` de `lib/errors`; tipo `ideas_feed` (Task 1).
- Produces:
  - `fetchIdeas(sort: IdeaSort): Promise<Idea[]>`
  - `createIdea(text: string, authorId: string): Promise<void>`
  - `voteIdea(ideaId: string, userId: string, vote: Vote): Promise<void>`
  - `deleteIdea(ideaId: string): Promise<void>`
  - `type IdeaAction = 'load' | 'create' | 'vote' | 'remove'`
  - `ideaErrorMessage(error: unknown, action: IdeaAction): string`
  - `IDEA_ERRORS: Record<IdeaAction, string>`

- [ ] **Step 1: Teste que falha**

`__tests__/ideasApi.test.ts`:

```ts
const mockRpc = jest.fn();
const mockInsert = jest.fn();
const mockUpsert = jest.fn();
const mockDeleteEq = jest.fn();
let mockDeleteResult: { data: unknown; error: unknown } = { data: [{ id: 'i1' }], error: null };

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      insert: (row: unknown) => mockInsert(table, row),
      upsert: (row: unknown, opts: unknown) => mockUpsert(table, row, opts),
      delete: () => {
        // .eq(...).eq(...) para voto; .eq(...).select(...) para ideia
        const chain = {
          eq: (col: string, val: string) => {
            mockDeleteEq(table, col, val);
            return chain;
          },
          select: () => Promise.resolve(mockDeleteResult),
          then: (resolve: (v: unknown) => unknown) => resolve({ error: null }),
        };
        return chain;
      },
    }),
  },
}));

import { createIdea, deleteIdea, fetchIdeas, ideaErrorMessage, voteIdea } from '../lib/api/ideas';
import { setMemberDirectory } from '../lib/memberDirectory';

beforeEach(() => {
  jest.clearAllMocks();
  mockInsert.mockResolvedValue({ error: null });
  mockUpsert.mockResolvedValue({ error: null });
  mockDeleteResult = { data: [{ id: 'i1' }], error: null };
  setMemberDirectory([{ id: 'u1', username: 'bia', name: 'Bia', avatarUrl: 'https://signed/a.jpg' }]);
});

describe('fetchIdeas', () => {
  it('chama ideas_feed com a aba e junta o autor do diretório', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'i1', author_id: 'u1', body: 'modo escuro', created_at: '2026-10-06T12:00:00Z', score: -2, my_vote: -1 }],
      error: null,
    });
    await expect(fetchIdeas('new')).resolves.toEqual([
      {
        id: 'i1',
        body: 'modo escuro',
        createdAt: '2026-10-06T12:00:00Z',
        score: -2,
        myVote: -1,
        author: { id: 'u1', name: 'Bia', avatarUrl: 'https://signed/a.jpg' },
      },
    ]);
    expect(mockRpc).toHaveBeenCalledWith('ideas_feed', { p_sort: 'new' });
  });

  it('autor fora do diretório vira "Alguém"; my_vote estranho vira null', async () => {
    mockRpc.mockResolvedValue({
      data: [{ id: 'i2', author_id: 'sumiu', body: 'x', created_at: '2026-10-06T12:00:00Z', score: 0, my_vote: null }],
      error: null,
    });
    const [idea] = await fetchIdeas('top');
    expect(idea.author).toEqual({ id: 'sumiu', name: 'Alguém', avatarUrl: null });
    expect(idea.myVote).toBeNull();
  });
});

describe('createIdea', () => {
  it('manda o texto aparado em nome de quem escreveu', async () => {
    await createIdea('  bora  ', 'u1');
    expect(mockInsert).toHaveBeenCalledWith('ideas', { body: 'bora', author_id: 'u1' });
  });

  it('texto vazio nem chega no banco', async () => {
    await expect(createIdea('   ', 'u1')).rejects.toThrow();
    expect(mockInsert).not.toHaveBeenCalled();
  });
});

describe('voteIdea', () => {
  it('+1/−1 viram upsert; null apaga o meu voto', async () => {
    await voteIdea('i1', 'u1', 1);
    expect(mockUpsert).toHaveBeenCalledWith(
      'idea_votes',
      { idea_id: 'i1', user_id: 'u1', value: 1 },
      { onConflict: 'idea_id,user_id' },
    );
    await voteIdea('i1', 'u1', -1);
    expect(mockUpsert).toHaveBeenLastCalledWith(
      'idea_votes',
      { idea_id: 'i1', user_id: 'u1', value: -1 },
      { onConflict: 'idea_id,user_id' },
    );
    await voteIdea('i1', 'u1', null);
    expect(mockDeleteEq).toHaveBeenCalledWith('idea_votes', 'idea_id', 'i1');
    expect(mockDeleteEq).toHaveBeenCalledWith('idea_votes', 'user_id', 'u1');
  });
});

describe('deleteIdea', () => {
  it('apaga pelo id', async () => {
    await deleteIdea('i1');
    expect(mockDeleteEq).toHaveBeenCalledWith('ideas', 'id', 'i1');
  });

  it('banco barrou (0 linhas, sem erro) vira erro', async () => {
    mockDeleteResult = { data: [], error: null };
    await expect(deleteIdea('i1')).rejects.toThrow();
  });
});

describe('ideaErrorMessage', () => {
  it('mensagem por ação; rede tem a dela', () => {
    expect(ideaErrorMessage(new Error('boom'), 'create')).toBe('Não deu pra mandar a ideia. Tenta de novo.');
    expect(ideaErrorMessage(new Error('boom'), 'vote')).toBe('Não deu pra votar. Tenta de novo.');
    expect(ideaErrorMessage(new TypeError('Network request failed'), 'vote')).toBe(
      'Sem conexão. Confere a internet e tenta de novo.',
    );
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/ideasApi.test.ts`
Expected: FAIL, "Cannot find module '../lib/api/ideas'".

- [ ] **Step 3: Implementar**

`lib/api/ideas.ts`:

```ts
import type { Database } from '../../types/database';
import { friendlyError } from '../errors';
import { validateIdea, type Idea, type IdeaSort, type Vote } from '../ideas';
import { getMemberDirectory } from '../memberDirectory';
import { supabase } from '../supabase';

// o cliente do Supabase não é tipado pelo Database: as linhas da função vêm daqui
type FeedRow = Database['public']['Functions']['ideas_feed']['Returns'][number];

export type IdeaAction = 'load' | 'create' | 'vote' | 'remove';

export const IDEA_ERRORS: Record<IdeaAction, string> = {
  load: 'Pode ter sido a conexão. Tenta de novo daqui a pouco.',
  create: 'Não deu pra mandar a ideia. Tenta de novo.',
  vote: 'Não deu pra votar. Tenta de novo.',
  remove: 'Não deu pra apagar a ideia. Tenta de novo.',
};

const toVote = (v: number | null): Vote => (v === 1 || v === -1 ? v : null);

/** O banco já ordena e soma os votos; aqui entram nome e foto do autor (diretório de membros). */
export async function fetchIdeas(sort: IdeaSort): Promise<Idea[]> {
  const { data, error } = await supabase.rpc('ideas_feed', { p_sort: sort });
  if (error) throw error;
  const byId = new Map(getMemberDirectory().map((m) => [m.id, m]));
  return ((data ?? []) as FeedRow[]).map((r) => {
    const member = byId.get(r.author_id);
    return {
      id: r.id,
      body: r.body,
      createdAt: r.created_at,
      score: r.score,
      myVote: toVote(r.my_vote),
      // saiu do grupo, ou o diretório ainda não carregou: a ideia continua aparecendo
      author: { id: r.author_id, name: member?.name ?? 'Alguém', avatarUrl: member?.avatarUrl ?? null },
    };
  });
}

export async function createIdea(text: string, authorId: string): Promise<void> {
  const body = validateIdea(text);
  if (!body) throw new Error('Ideia vazia ou longa demais');
  const { error } = await supabase.from('ideas').insert({ body, author_id: authorId });
  if (error) throw error;
}

/** +1/−1 grava (ou troca) o meu voto; null tira. */
export async function voteIdea(ideaId: string, userId: string, vote: Vote): Promise<void> {
  const { error } =
    vote === null
      ? await supabase.from('idea_votes').delete().eq('idea_id', ideaId).eq('user_id', userId)
      : await supabase
          .from('idea_votes')
          .upsert({ idea_id: ideaId, user_id: userId, value: vote }, { onConflict: 'idea_id,user_id' });
  if (error) throw error;
}

/** O banco só deixa o autor ou o admin; barrado, o delete volta vazio sem erro, então conferimos. */
export async function deleteIdea(ideaId: string): Promise<void> {
  const { data, error } = await supabase.from('ideas').delete().eq('id', ideaId).select('id');
  if (error) throw error;
  if (!data || data.length === 0) throw new Error('Ideia não encontrada ou não é sua');
}

export function ideaErrorMessage(error: unknown, action: IdeaAction): string {
  return friendlyError(error, IDEA_ERRORS[action]);
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/ideasApi.test.ts && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 5: Commit**

```bash
git add lib/api/ideas.ts __tests__/ideasApi.test.ts
git commit -m "Ideias: chamadas ao banco"
```

---

### Task 4: Tempo real conhece as tabelas novas

**Files:**
- Modify: `lib/realtime.ts` (`LIVE_TABLES`, `actorOf`, `affectsNotifications`)
- Test: `__tests__/realtime.test.tsx` (acrescentar no `describe('affectsNotifications')` e um `describe('actorOf')`)

**Interfaces:**
- Consumes: nada novo.
- Produces: `LiveTable` passa a incluir `'ideas' | 'idea_votes'`; `actorOf('ideas', row)` = `row.author_id`; `affectsNotifications` devolve `false` para essas duas tabelas.

- [ ] **Step 1: Teste que falha**

Em `__tests__/realtime.test.tsx`, trocar o import de `../lib/realtime` para incluir `actorOf`:

```ts
import { actorOf, affectsNotifications, debounce, LIVE_TABLES, onLive, postIdOf, type LiveEvent } from '../lib/realtime';
```

E dentro de `describe('affectsNotifications', …)`, acrescentar:

```ts
  it('ideia e voto em ideia não viram notificação', () => {
    expect(affectsNotifications({ kind: 'change', table: 'ideas', type: 'INSERT', row: {}, mine: false })).toBe(false);
    expect(affectsNotifications({ kind: 'change', table: 'idea_votes', type: 'INSERT', row: {}, mine: false })).toBe(false);
  });
```

E no fim do arquivo:

```ts
describe('actorOf', () => {
  it('ideia: o autor; voto em ideia: quem votou', () => {
    expect(actorOf('ideas', { author_id: 'u1' })).toBe('u1');
    expect(actorOf('idea_votes', { user_id: 'u2' })).toBe('u2');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/realtime.test.tsx`
Expected: FAIL (erro de tipo do ts-jest/babel não barra, mas `affectsNotifications` devolve `true` e `actorOf('ideas')` devolve `null`).

- [ ] **Step 3: Implementar**

Em `lib/realtime.ts`:

```ts
export const LIVE_TABLES = [
  'posts',
  'likes',
  'comments',
  'post_reactions',
  'comment_reactions',
  'profiles',
  'ideas',
  'idea_votes',
] as const;
```

Em `actorOf`, trocar o `case` de autor:

```ts
    case 'posts':
    case 'comments':
    case 'ideas':
      return str(row.author_id);
```

Em `affectsNotifications`, logo depois de `if (event.mine) return false;`:

```ts
  // mural de ideias não gera notificação
  if (event.table === 'ideas' || event.table === 'idea_votes') return false;
```

E atualizar o comentário de `actorOf` para: `/** Quem fez a mudança: autor do post/comentário/ideia, dono da curtida/reação/voto, o próprio perfil. */`

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/realtime.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída. (Se algum teste existente comparar `LIVE_TABLES` com a lista antiga, atualizar a lista esperada no teste com as duas tabelas novas no fim.)

- [ ] **Step 5: Commit**

```bash
git add lib/realtime.ts __tests__/realtime.test.tsx
git commit -m "Tempo real: ideias e votos (sem virar notificação)"
```

---

### Task 5: Estado da tela (`lib/useIdeas.ts`)

**Files:**
- Create: `lib/useIdeas.ts`
- Test: `__tests__/useIdeas.test.tsx`

**Interfaces:**
- Consumes: `fetchIdeas`, `createIdea`, `voteIdea`, `deleteIdea`, `ideaErrorMessage` (Task 3); `applyVote`, `Idea`, `IdeaSort` (Task 2); `onLive`, `debounce`, `LIVE_DEBOUNCE_MS` de `lib/realtime` (Task 4).
- Produces:
  ```ts
  useIdeas(userId: string | undefined): {
    sort: IdeaSort;
    setSort: (s: IdeaSort) => void;
    ideas: Idea[];
    loading: boolean;
    error: string | null;      // falha ao carregar (lista)
    voteError: string | null;  // último voto recusado
    reload: () => void;
    vote: (ideaId: string, tapped: 1 | -1) => void;
    create: (text: string) => Promise<void>;   // lança: a tela mostra o erro no campo
    remove: (ideaId: string) => Promise<void>; // lança: o ConfirmDialog mostra o erro
  }
  ```

- [ ] **Step 1: Teste que falha**

`__tests__/useIdeas.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { Idea } from '../lib/ideas';

const mockFetch = jest.fn();
const mockVote = jest.fn();
const mockCreate = jest.fn();
const mockDelete = jest.fn();
jest.mock('../lib/api/ideas', () => ({
  fetchIdeas: (sort: string) => mockFetch(sort),
  voteIdea: (...args: unknown[]) => mockVote(...args),
  createIdea: (...args: unknown[]) => mockCreate(...args),
  deleteIdea: (id: string) => mockDelete(id),
  ideaErrorMessage: (_e: unknown, action: string) => `erro:${action}`,
}));

import { emitLive, LIVE_DEBOUNCE_MS } from '../lib/realtime';
import { useIdeas } from '../lib/useIdeas';

const idea = (over: Partial<Idea> = {}): Idea => ({
  id: 'i1',
  body: 'modo escuro',
  createdAt: '2026-10-06T12:00:00Z',
  author: { id: 'u2', name: 'Bia', avatarUrl: null },
  score: 3,
  myVote: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockFetch.mockResolvedValue([idea()]);
  mockVote.mockResolvedValue(undefined);
  mockCreate.mockResolvedValue(undefined);
  mockDelete.mockResolvedValue(undefined);
});

async function loaded() {
  const view = await renderHook(() => useIdeas('me'));
  await waitFor(() => expect(view.result.current.loading).toBe(false));
  return view;
}

describe('useIdeas', () => {
  it('começa na aba Top e troca de aba recarrega com o sort certo', async () => {
    const { result } = await loaded();
    expect(mockFetch).toHaveBeenLastCalledWith('top');
    await act(async () => result.current.setSort('new'));
    await waitFor(() => expect(mockFetch).toHaveBeenLastCalledWith('new'));
    expect(result.current.sort).toBe('new');
  });

  it('voto aparece na hora e vai pro banco', async () => {
    const { result } = await loaded();
    await act(async () => result.current.vote('i1', 1));
    expect(result.current.ideas[0]).toMatchObject({ myVote: 1, score: 4 });
    expect(mockVote).toHaveBeenCalledWith('i1', 'me', 1);
  });

  it('voto recusado volta ao que era e avisa', async () => {
    mockVote.mockRejectedValue(new Error('boom'));
    const { result } = await loaded();
    await act(async () => result.current.vote('i1', -1));
    await waitFor(() => expect(result.current.ideas[0]).toMatchObject({ myVote: null, score: 3 }));
    expect(result.current.voteError).toBe('erro:vote');
  });

  it('toques seguidos na mesma ideia enquanto o voto está indo são ignorados', async () => {
    let finish: () => void = () => {};
    mockVote.mockImplementation(() => new Promise<void>((r) => (finish = r)));
    const { result } = await loaded();
    await act(async () => {
      result.current.vote('i1', 1);
      result.current.vote('i1', 1);
      result.current.vote('i1', -1);
    });
    expect(mockVote).toHaveBeenCalledTimes(1);
    expect(result.current.ideas[0]).toMatchObject({ myVote: 1, score: 4 });
    await act(async () => finish());
    await act(async () => result.current.vote('i1', 1));
    expect(mockVote).toHaveBeenCalledTimes(2);
    expect(result.current.ideas[0]).toMatchObject({ myVote: null, score: 3 });
  });

  it('resposta atrasada da aba antiga não sobrescreve a aba nova', async () => {
    const { result } = await loaded();
    let slowTop: (v: Idea[]) => void = () => {};
    mockFetch.mockImplementationOnce(() => new Promise<Idea[]>((r) => (slowTop = r)));
    await act(async () => result.current.reload());
    mockFetch.mockResolvedValueOnce([idea({ id: 'nova', body: 'da aba Novas' })]);
    await act(async () => result.current.setSort('new'));
    await waitFor(() => expect(result.current.ideas[0].id).toBe('nova'));
    await act(async () => slowTop([idea({ id: 'velha' })]));
    expect(result.current.ideas[0].id).toBe('nova');
  });

  it('mudança ao vivo de outra pessoa recarrega; a minha não', async () => {
    jest.useFakeTimers();
    try {
      await loaded();
      mockFetch.mockClear();
      await act(async () => {
        emitLive({ kind: 'change', table: 'idea_votes', type: 'INSERT', row: { user_id: 'me' }, mine: true });
        jest.advanceTimersByTime(LIVE_DEBOUNCE_MS + 10);
      });
      expect(mockFetch).not.toHaveBeenCalled();
      await act(async () => {
        emitLive({ kind: 'change', table: 'ideas', type: 'INSERT', row: { author_id: 'u2' }, mine: false });
        jest.advanceTimersByTime(LIVE_DEBOUNCE_MS + 10);
      });
      expect(mockFetch).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });

  it('mandar ideia recarrega; apagar tira da lista', async () => {
    const { result } = await loaded();
    mockFetch.mockClear();
    await act(async () => result.current.create('bora'));
    expect(mockCreate).toHaveBeenCalledWith('bora', 'me');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledTimes(1));
    await act(async () => result.current.remove('i1'));
    expect(result.current.ideas).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/useIdeas.test.tsx`
Expected: FAIL, "Cannot find module '../lib/useIdeas'".

- [ ] **Step 3: Implementar**

`lib/useIdeas.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

import { createIdea, deleteIdea, fetchIdeas, ideaErrorMessage, voteIdea } from './api/ideas';
import { applyVote, type Idea, type IdeaSort } from './ideas';
import { debounce, LIVE_DEBOUNCE_MS, onLive } from './realtime';

/**
 * Estado do mural de ideias. Voto é otimista (muda na hora, volta se o banco recusar) e não reordena
 * a lista: a ordem da aba Top se ajusta no próximo carregamento, para a linha não fugir do dedo.
 */
export function useIdeas(userId: string | undefined) {
  const [sort, setSort] = useState<IdeaSort>('top');
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);

  const ideasRef = useRef(ideas);
  ideasRef.current = ideas;
  const sortRef = useRef(sort);
  sortRef.current = sort;
  /** Só a resposta da busca mais recente vale (troca de aba no meio de um carregamento). */
  const requestId = useRef(0);
  /** Ideias com voto indo pro servidor: toques nelas esperam a resposta. */
  const pending = useRef(new Set<string>());

  /** `silent`: atualização ao vivo/depois de mandar, sem piscar o carregando nem trocar a lista por erro. */
  const load = useCallback((silent: boolean) => {
    const id = ++requestId.current;
    if (!silent) {
      setLoading(true);
      setError(null);
    }
    fetchIdeas(sortRef.current)
      .then((list) => {
        if (id === requestId.current) setIdeas(list);
      })
      .catch((e) => {
        if (id === requestId.current && !silent) setError(ideaErrorMessage(e, 'load'));
      })
      .finally(() => {
        if (id === requestId.current && !silent) setLoading(false);
      });
  }, []);

  const reload = useCallback(() => load(false), [load]);

  useEffect(() => {
    load(false);
  }, [sort, load]);

  // ao vivo: ideia nova/apagada ou voto de outra pessoa (o meu a tela já mostrou)
  useEffect(() => {
    const live = debounce(() => load(true), LIVE_DEBOUNCE_MS);
    const off = onLive((event) => {
      if (event.kind === 'resync') return live();
      if ((event.table === 'ideas' || event.table === 'idea_votes') && !event.mine) live();
    });
    return () => {
      off();
      live.cancel();
    };
  }, [load]);

  const vote = useCallback(
    (ideaId: string, tapped: 1 | -1) => {
      if (!userId || pending.current.has(ideaId)) return;
      const before = ideasRef.current.find((i) => i.id === ideaId);
      if (!before) return;
      const next = applyVote(before, tapped);
      const patch = (values: Pick<Idea, 'score' | 'myVote'>) =>
        setIdeas((list) => list.map((i) => (i.id === ideaId ? { ...i, ...values } : i)));
      patch(next);
      setVoteError(null);
      pending.current.add(ideaId);
      voteIdea(ideaId, userId, next.myVote)
        .catch((e) => {
          patch({ score: before.score, myVote: before.myVote });
          setVoteError(ideaErrorMessage(e, 'vote'));
        })
        .finally(() => pending.current.delete(ideaId));
    },
    [userId],
  );

  const create = useCallback(
    async (text: string) => {
      if (!userId) return;
      await createIdea(text, userId);
      load(true);
    },
    [userId, load],
  );

  const remove = useCallback(async (ideaId: string) => {
    await deleteIdea(ideaId);
    setIdeas((list) => list.filter((i) => i.id !== ideaId));
  }, []);

  return { sort, setSort, ideas, loading, error, voteError, reload, vote, create, remove };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/useIdeas.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 5: Commit**

```bash
git add lib/useIdeas.ts __tests__/useIdeas.test.tsx
git commit -m "Ideias: estado da tela com voto otimista e tempo real"
```

---

### Task 6: Componentes `VoteColumn` e `IdeaRow`

Antes de escrever UI: carregar a skill `impeccable` (modo Operate) e rodar o `context` dela com `--target components/ideas/IdeaRow.tsx`; ler `reference/craft-floor.md` antes de editar.

**Files:**
- Create: `components/ideas/VoteColumn.tsx`
- Create: `components/ideas/IdeaRow.tsx`
- Test: `__tests__/ideasUi.test.tsx`

**Interfaces:**
- Consumes: `Idea`, `Vote`, `formatScore` (Task 2); `postTime` de `lib/format`; `Avatar`, `Icon`, `IconButton`, `Text`, `interactiveStyle` de `components/ui`; tokens `t.avatarSizes.sm`, `t.layout.minTouch`, `t.colors.brand`, `t.colors.textMuted`.
- Produces:
  - `VoteColumn({ score: number; myVote: Vote; onVote: (tapped: 1 | -1) => void })`
  - `IdeaRow({ idea: Idea; canDelete: boolean; onVote: (tapped: 1 | -1) => void; onDelete: () => void })`

- [ ] **Step 1: Teste que falha**

`__tests__/ideasUi.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { IdeaRow } from '../components/ideas/IdeaRow';
import { VoteColumn } from '../components/ideas/VoteColumn';
import type { Idea } from '../lib/ideas';

const idea: Idea = {
  id: 'i1',
  body: 'Modo escuro automático',
  createdAt: new Date().toISOString(),
  author: { id: 'u2', name: 'Bia', avatarUrl: null },
  score: -3,
  myVote: -1,
};

describe('VoteColumn', () => {
  it('mostra a pontuação e manda a seta tocada', async () => {
    const onVote = jest.fn();
    await render(<VoteColumn score={7} myVote={1} onVote={onVote} />);
    expect(screen.getByLabelText('7 pontos, seu voto: a favor')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Votar a favor' }).props.accessibilityState).toMatchObject({
      selected: true,
    });
    expect(screen.getByRole('button', { name: 'Votar contra' }).props.accessibilityState).toMatchObject({
      selected: false,
    });
    await fireEvent.press(screen.getByRole('button', { name: 'Votar contra' }));
    expect(onVote).toHaveBeenCalledWith(-1);
  });

  it('sem voto e pontuação negativa', async () => {
    await render(<VoteColumn score={-3} myVote={null} onVote={() => {}} />);
    expect(screen.getByText('−3')).toBeTruthy();
    expect(screen.getByLabelText('−3 pontos')).toBeTruthy();
  });
});

describe('IdeaRow', () => {
  it('texto, autor e lixeira quando pode apagar', async () => {
    const onDelete = jest.fn();
    await render(<IdeaRow idea={idea} canDelete onVote={() => {}} onDelete={onDelete} />);
    expect(screen.getByText('Modo escuro automático')).toBeTruthy();
    expect(screen.getByText('Bia')).toBeTruthy();
    expect(screen.getByLabelText('−3 pontos, seu voto: contra')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar ideia' }));
    expect(onDelete).toHaveBeenCalled();
  });

  it('sem lixeira quando não pode apagar', async () => {
    await render(<IdeaRow idea={idea} canDelete={false} onVote={() => {}} onDelete={() => {}} />);
    expect(screen.queryByRole('button', { name: 'Apagar ideia' })).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/ideasUi.test.tsx`
Expected: FAIL, "Cannot find module '../components/ideas/IdeaRow'".

- [ ] **Step 3: Implementar `VoteColumn`**

`components/ideas/VoteColumn.tsx`:

```tsx
import { Pressable, View } from 'react-native';

import { formatScore, type Vote } from '../../lib/ideas';
import { useTheme } from '../../lib/theme';
import { Icon, interactiveStyle, Text } from '../ui';

type Props = { score: number; myVote: Vote; onVote: (tapped: 1 | -1) => void };

/** ▲ pontuação ▼ do mural de ideias. Meu voto: seta e número em `brand`. */
export function VoteColumn({ score, myVote, onVote }: Props) {
  const t = useTheme();
  const arrow = (dir: 1 | -1) => {
    const on = myVote === dir;
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={dir === 1 ? 'Votar a favor' : 'Votar contra'}
        accessibilityState={{ selected: on }}
        onPress={() => onVote(dir)}
        style={(state) => ({
          width: t.layout.minTouch,
          height: t.layout.minTouch,
          borderRadius: t.radii.pill,
          alignItems: 'center',
          justifyContent: 'center',
          ...interactiveStyle(t, state),
        })}
      >
        <Icon
          name={dir === 1 ? 'chevron-up-outline' : 'chevron-down-outline'}
          size="lg"
          color={on ? t.colors.brand : t.colors.textMuted}
        />
      </Pressable>
    );
  };
  const mine = myVote === 1 ? ', seu voto: a favor' : myVote === -1 ? ', seu voto: contra' : '';
  const label = `${formatScore(score)} pontos${mine}`;
  return (
    <View style={{ alignItems: 'center' }}>
      {arrow(1)}
      <Text
        accessibilityLabel={label}
        bold={myVote !== null}
        style={myVote !== null ? { color: t.colors.brand } : undefined}
      >
        {formatScore(score)}
      </Text>
      {arrow(-1)}
    </View>
  );
}
```

- [ ] **Step 4: Implementar `IdeaRow`**

`components/ideas/IdeaRow.tsx`:

```tsx
import { View } from 'react-native';

import { postTime } from '../../lib/format';
import type { Idea } from '../../lib/ideas';
import { useTheme } from '../../lib/theme';
import { Avatar, IconButton, Text } from '../ui';
import { VoteColumn } from './VoteColumn';

type Props = { idea: Idea; canDelete: boolean; onVote: (tapped: 1 | -1) => void; onDelete: () => void };

/** Uma ideia no padrão "sem caixa" do feed: votos à esquerda, texto e autor à direita. */
export function IdeaRow({ idea, canDelete, onVote, onDelete }: Props) {
  const t = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: t.spacing.sm, paddingVertical: t.spacing.sm }}>
      <VoteColumn score={idea.score} myVote={idea.myVote} onVote={onVote} />
      <View style={{ flex: 1, gap: t.spacing.sm, paddingTop: t.spacing.md }}>
        <Text>{idea.body}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm }}>
          <Avatar name={idea.author.name} uri={idea.author.avatarUrl} size={t.avatarSizes.sm} />
          <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            {idea.author.name}
          </Text>
          <Text variant="small" tone="muted">
            {postTime(idea.createdAt)}
          </Text>
          <View style={{ flex: 1 }} />
          {canDelete ? (
            <IconButton icon="trash-outline" variant="ghost" tone="muted" accessibilityLabel="Apagar ideia" onPress={onDelete} />
          ) : null}
        </View>
      </View>
    </View>
  );
}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest __tests__/ideasUi.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 6: Commit**

```bash
git add components/ideas/VoteColumn.tsx components/ideas/IdeaRow.tsx __tests__/ideasUi.test.tsx
git commit -m "Ideias: coluna de voto e linha da ideia"
```

---

### Task 7: Tela `/ideas`

**Files:**
- Create: `app/ideas.tsx`
- Modify: `app/_layout.tsx` (rota)
- Test: `__tests__/ideasScreen.test.tsx`

**Interfaces:**
- Consumes: `useIdeas` (Task 5); `IdeaRow` (Task 6); `IDEA_MAX`, `remainingLabel`, `validateIdea` (Task 2); `ideaErrorMessage`, `IDEA_ERRORS` (Task 3); `useSession()` → `{ session, profile }` (`profile.is_admin`); `stackHeader(t, title)` de `components/profile/headerOptions`; `Button`, `ConfirmDialog`, `Divider`, `EmptyState`, `Screen`, `Tabs`, `Text`, `TextField` de `components/ui`.
- Produces: rota `/ideas` (default export `IdeasScreen`).

- [ ] **Step 1: Teste que falha**

`__tests__/ideasScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Idea } from '../lib/ideas';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
let mockProfile = { is_member: true, is_admin: false };
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, profile: mockProfile }),
}));

const mockHook = {
  sort: 'top' as const,
  setSort: jest.fn(),
  ideas: [] as Idea[],
  loading: false,
  error: null as string | null,
  voteError: null as string | null,
  reload: jest.fn(),
  vote: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};
jest.mock('../lib/useIdeas', () => ({ useIdeas: () => mockHook }));

import IdeasScreen from '../app/ideas';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <IdeasScreen />
    </SafeAreaProvider>,
  );
const idea = (over: Partial<Idea>): Idea => ({
  id: 'i1',
  body: 'Modo escuro',
  createdAt: new Date().toISOString(),
  author: { id: 'u2', name: 'Bia', avatarUrl: null },
  score: 2,
  myVote: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { is_member: true, is_admin: false };
  Object.assign(mockHook, { ideas: [], loading: false, error: null, voteError: null, sort: 'top' });
  mockHook.create.mockResolvedValue(undefined);
  mockHook.remove.mockResolvedValue(undefined);
});

describe('Tela Ideias', () => {
  it('vazio convida a mandar a primeira', async () => {
    await open();
    expect(screen.getByText('Ninguém deu ideia ainda.')).toBeTruthy();
  });

  it('mandar fica desabilitado vazio; mandar limpa o campo', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Mandar' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Manda sua ideia'), 'bora ter enquete');
    await fireEvent.press(screen.getByRole('button', { name: 'Mandar' }));
    expect(mockHook.create).toHaveBeenCalledWith('bora ter enquete');
    await waitFor(() => expect(screen.getByLabelText('Manda sua ideia').props.value).toBe(''));
  });

  it('erro ao mandar fica no campo e o texto fica', async () => {
    mockHook.create.mockRejectedValue(new Error('boom'));
    await open();
    await fireEvent.changeText(screen.getByLabelText('Manda sua ideia'), 'bora');
    await fireEvent.press(screen.getByRole('button', { name: 'Mandar' }));
    expect(await screen.findByText('Não deu pra mandar a ideia. Tenta de novo.')).toBeTruthy();
    expect(screen.getByLabelText('Manda sua ideia').props.value).toBe('bora');
  });

  it('abas Top/Novas', async () => {
    await open();
    await fireEvent.press(screen.getByRole('tab', { name: 'Novas' }));
    expect(mockHook.setSort).toHaveBeenCalledWith('new');
  });

  it('votar chama o hook; lixeira só na minha (não admin)', async () => {
    mockHook.ideas = [idea({ id: 'minha', author: { id: 'me', name: 'Eu', avatarUrl: null } }), idea({ id: 'dela' })];
    await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Votar a favor' })[1]);
    expect(mockHook.vote).toHaveBeenCalledWith('dela', 1);
    expect(screen.getAllByRole('button', { name: 'Apagar ideia' })).toHaveLength(1);
  });

  it('admin vê lixeira em todas e apaga confirmando', async () => {
    mockProfile = { is_member: true, is_admin: true };
    mockHook.ideas = [idea({ id: 'a' }), idea({ id: 'b' })];
    await open();
    const trash = screen.getAllByRole('button', { name: 'Apagar ideia' });
    expect(trash).toHaveLength(2);
    await fireEvent.press(trash[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(mockHook.remove).toHaveBeenCalledWith('a'));
  });

  it('voto recusado aparece como aviso', async () => {
    mockHook.voteError = 'Não deu pra votar. Tenta de novo.';
    await open();
    expect(screen.getByText('Não deu pra votar. Tenta de novo.')).toBeTruthy();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    mockHook.error = 'Pode ter sido a conexão. Tenta de novo daqui a pouco.';
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(mockHook.reload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/ideasScreen.test.tsx`
Expected: FAIL, "Cannot find module '../app/ideas'".

- [ ] **Step 3: Implementar a tela**

`app/ideas.tsx`:

```tsx
import { Stack } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { IdeaRow } from '../components/ideas/IdeaRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Button, ConfirmDialog, Divider, EmptyState, Screen, Tabs, Text, TextField } from '../components/ui';
import { IDEA_ERRORS, ideaErrorMessage } from '../lib/api/ideas';
import { useSession } from '../lib/auth/SessionProvider';
import { IDEA_MAX, remainingLabel, validateIdea, type IdeaSort } from '../lib/ideas';
import { useTheme } from '../lib/theme';
import { useIdeas } from '../lib/useIdeas';

const TABS: { key: IdeaSort; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'new', label: 'Novas' },
];

export default function IdeasScreen() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const { session, profile } = useSession();
  const me = session?.user.id;
  const isAdmin = !!profile?.is_admin;
  const { sort, setSort, ideas, loading, error, voteError, reload, vote, create, remove } = useIdeas(me);

  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | undefined>();
  const [toDelete, setToDelete] = useState<string | null>(null);

  async function send() {
    if (sending || !validateIdea(text)) return;
    setSending(true);
    setSendError(undefined);
    try {
      await create(text);
      setText('');
    } catch (e) {
      setSendError(ideaErrorMessage(e, 'create'));
    } finally {
      setSending(false);
    }
  }

  const header = (
    <View style={{ gap: t.spacing.lg, paddingTop: t.spacing.lg }}>
      <View style={{ gap: t.spacing.md }}>
        <TextField
          label="Manda sua ideia"
          placeholder="Que tal se o app…"
          multiline
          maxLength={IDEA_MAX}
          value={text}
          onChangeText={(v) => {
            setText(v);
            if (sendError) setSendError(undefined);
          }}
          error={sendError}
          help={remainingLabel(text) ?? undefined}
          editable={!sending}
        />
        <Button title="Mandar" onPress={() => void send()} loading={sending} disabled={!validateIdea(text)} />
      </View>
      <Tabs items={TABS} value={sort} onChange={setSort} />
      {voteError ? (
        <Text variant="small" tone="danger" accessibilityRole="alert">
          {voteError}
        </Text>
      ) : null}
    </View>
  );

  let empty;
  if (loading) {
    empty = (
      <View style={{ alignItems: 'center', gap: t.spacing.md, paddingVertical: t.spacing.xl }}>
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Juntando as ideias…</Text>
      </View>
    );
  } else if (error) {
    empty = <EmptyState title="Não deu pra carregar as ideias" message={error} actionLabel="Tentar de novo" onAction={reload} />;
  } else {
    empty = <EmptyState title="Ninguém deu ideia ainda." message="Solta a primeira aí em cima." />;
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Ideias')} />
      <Screen header>
        <FlatList
          data={loading || error ? [] : ideas}
          keyExtractor={(i) => i.id}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ItemSeparatorComponent={Divider}
          contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
          renderItem={({ item }) => (
            <IdeaRow
              idea={item}
              canDelete={item.author.id === me || isAdmin}
              onVote={(dir) => vote(item.id, dir)}
              onDelete={() => setToDelete(item.id)}
            />
          )}
        />
      </Screen>
      <ConfirmDialog
        visible={toDelete !== null}
        title="Apagar essa ideia?"
        message="Os votos dela somem junto."
        confirmLabel="Apagar"
        errorMessage={IDEA_ERRORS.remove}
        onConfirm={async () => {
          if (!toDelete) return;
          await remove(toDelete);
          setToDelete(null);
        }}
        onClose={() => setToDelete(null)}
      />
    </>
  );
}
```

- [ ] **Step 4: Registrar a rota**

Em `app/_layout.tsx`, logo depois da linha da rota `invites`:

```tsx
            <Stack.Screen name="ideas" options={{ headerShown: true, title: 'Ideias' }} />
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest __tests__/ideasScreen.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída. (Se o botão de confirmar do `ConfirmDialog` tiver outro papel/rótulo, ajustar o seletor do teste ao que `components/ui/ConfirmDialog.tsx` renderiza para `confirmLabel`.)

- [ ] **Step 6: Commit**

```bash
git add app/ideas.tsx app/_layout.tsx __tests__/ideasScreen.test.tsx
git commit -m "Ideias: tela do mural"
```

---

### Task 8: Entradas — barra lateral e lâmpada do feed

**Files:**
- Modify: `components/shell/Sidebar.tsx` (`NavKey`, `ITEMS`, `activeNavItem`, comentário)
- Create: `components/ideas/IdeasButton.tsx`
- Modify: `app/(tabs)/feed.tsx` (cabeçalho `compact`)
- Test: `__tests__/sidebar.test.tsx` (acrescentar), `__tests__/ideasUi.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: rota `/ideas` (Task 7).
- Produces: `NavKey` inclui `'ideas'`; `activeNavItem('/ideas') === 'ideas'`; `IdeasButton()` (sem props).

- [ ] **Step 1: Testes que falham**

Em `__tests__/sidebar.test.tsx`, no `it.each` de `activeNavItem`, acrescentar a linha:

```ts
    ['/ideas', 'ideas'],
```

E dentro de `describe('Sidebar', …)`:

```ts
  it('Ideias depois de Membros e navega', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    const labels = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
    expect(labels.indexOf('Ideias')).toBe(labels.indexOf('Membros') + 1);
    await fireEvent.press(screen.getByLabelText('Ideias'));
    expect(mockNavigate).toHaveBeenCalledWith('/ideas');
  });
```

Em `__tests__/ideasUi.test.tsx`, no topo (antes dos imports dos componentes):

```tsx
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
```

E o import + teste:

```tsx
import { IdeasButton } from '../components/ideas/IdeasButton';

describe('IdeasButton', () => {
  it('abre o mural', async () => {
    await render(<IdeasButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Ideias' }));
    expect(mockPush).toHaveBeenCalledWith('/ideas');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/sidebar.test.tsx __tests__/ideasUi.test.tsx`
Expected: FAIL (`activeNavItem('/ideas')` é `null`; sem link "Ideias"; módulo `IdeasButton` não existe).

- [ ] **Step 3: Barra lateral**

Em `components/shell/Sidebar.tsx`:

```ts
export type NavKey = 'feed' | 'notifications' | 'profile' | 'members' | 'ideas';

const ITEMS: {
  key: NavKey;
  label: string;
  href: '/feed' | '/notifications' | '/profile' | '/members' | '/ideas';
  icon: IconName;
  iconActive: IconName;
}[] = [
  { key: 'feed', label: 'Feed', href: '/feed', icon: 'newspaper-outline', iconActive: 'newspaper' },
  { key: 'notifications', label: 'Notificações', href: '/notifications', icon: 'notifications-outline', iconActive: 'notifications' },
  { key: 'profile', label: 'Perfil', href: '/profile', icon: 'person-outline', iconActive: 'person' },
  { key: 'members', label: 'Membros', href: '/members', icon: 'people-outline', iconActive: 'people' },
  { key: 'ideas', label: 'Ideias', href: '/ideas', icon: 'bulb-outline', iconActive: 'bulb' },
];
```

Em `activeNavItem`, antes do `return null`:

```ts
  if (pathname === '/ideas') return 'ideas';
```

E o comentário do componente: `/** Barra lateral do desktop: logo, Feed/Notificações/Perfil/Membros/Ideias, Postar e eu no pé. */`

- [ ] **Step 4: Lâmpada**

`components/ideas/IdeasButton.tsx`:

```tsx
import { useRouter } from 'expo-router';

import { IconButton } from '../ui';

/** Lâmpada do topo do feed no celular (no computador a entrada é a barra lateral). */
export function IdeasButton() {
  const router = useRouter();
  return <IconButton icon="bulb-outline" variant="ghost" size="lg" accessibilityLabel="Ideias" onPress={() => router.push('/ideas')} />;
}
```

Em `app/(tabs)/feed.tsx`, importar `import { IdeasButton } from '../../components/ideas/IdeasButton';` e, no cabeçalho `compact`, trocar `<NotificationsBell />` por:

```tsx
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <IdeasButton />
                  <NotificationsBell />
                </View>
```

(Esse cabeçalho só existe em `compact`; no computador a coluna começa pelo compositor, então a lâmpada não aparece lá.)

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest __tests__/sidebar.test.tsx __tests__/ideasUi.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 6: Commit**

```bash
git add components/shell/Sidebar.tsx components/ideas/IdeasButton.tsx "app/(tabs)/feed.tsx" __tests__/sidebar.test.tsx __tests__/ideasUi.test.tsx
git commit -m "Ideias: item na barra lateral e lâmpada no topo do feed"
```

---

### Task 9: Verificação final

**Files:** nenhum novo (só correções que a verificação apontar).

- [ ] **Step 1: Suíte inteira**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem saída; todas as suítes passam (as 47 de antes + `ideas`, `ideasApi`, `useIdeas`, `ideasUi`, `ideasScreen`).

- [ ] **Step 2: Passada visual (Impeccable, uma rodada)**

Com `EXPO_PUBLIC_DEV_FAKE_LOGIN=1 npx expo start --web`, abrir `/ideas` no navegador em largura de celular e de computador, tema claro e escuro. Conferir: alinhamento das setas com a primeira linha do texto, número negativo, seta/número em `brand` com meu voto, lixeira, contador perto de 280, estado vazio e de erro. (Com login falso o banco não responde: espere o estado de erro da lista; o resto da tela continua verificável.) Depois: `git checkout -- tsconfig.json` se o Expo mexer nele.

- [ ] **Step 3: Commit das correções (se houver)**

```bash
git add -A
git commit -m "Ideias: ajustes da revisão visual"
```

- [ ] **Step 4: Avisar o Juan**

A migration `0013_ideas.sql` precisa ser aplicada no Supabase pelo Juan (mesmo caminho da 0012: `npx supabase db query --linked -f supabase/migrations/0013_ideas.sql` com o token no `.env`, ou SQL Editor).
