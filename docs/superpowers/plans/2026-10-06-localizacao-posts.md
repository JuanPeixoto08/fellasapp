# Localização em posts — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao postar, o fella marca onde está (texto livre com sugestões dos locais já usados); o local aparece numa linha abaixo do nome do post e tocar nele abre a página com todos os posts daquele local.

**Architecture:** Coluna `posts.location` (texto que a pessoa escreveu) + `posts.place_key` (minúsculas, sem acento, preenchida por gatilho), no mesmo molde das #tags (`0016_post_tags.sql`). `place_suggestions(prefixo)` sugere os locais no compositor; `listFeed`/`usePostList` ganham o filtro `place`; a página `app/place/[key].tsx` copia a da tag. UI nova em `components/places/` (`PlaceLink`, `PlaceSuggestions`, `PlaceField`, `PlaceChip`).

**Tech Stack:** Expo SDK 57, expo-router, React Native / react-native-web, TypeScript, jest-expo + @testing-library/react-native v14 (`await render`, `await fireEvent.*`, `await renderHook`), Supabase (Postgres, RLS).

**Spec:** `docs/superpowers/specs/2026-10-06-localizacao-posts-design.md`

## Global Constraints

- Texto em pt-BR, tom do `PRODUCT.md`; tokens de `lib/theme.ts` e primitivos de `components/ui`, nada de cor/tamanho/raio/fonte solto (CLAUDE.md); Impeccable (modo Operate).
- Local: até **60** caracteres (`PLACE_MAX`, check `posts_location_len`); limpo = pontas tiradas, espaços repetidos viram um, vazio → `null`.
- Chave: `lower` + tabela fixa de acentos `áàâãäåāéèêëēíìîïīóòôõöōúùûüūçñý` → `aaaaaaaeeeeeiiiiioooooouuuuucny`, **idêntica** em `lib/places.ts` e no SQL (teste confere).
- Ícone do local: `location-outline` (Ionicons via `<Icon>`), nunca emoji.
- Textos: botão "Adicionar local" / "Trocar local"; campo "Local" com placeholder "Onde você tá?"; fechar campo "Fechar local"; chip "Trocar local (<local>)" e "Tirar local"; sugestão "Usar <local>" e "Usar "<digitado>""; link do post "Ver posts em <local>"; página vazia "Ninguém postou daqui ainda." / "Posta algo marcando esse lugar."; erro "Não deu pra carregar esse local".
- Local sozinho **não** libera "Postar"; conta como rascunho para o aviso de descartar.
- Migration `supabase/migrations/0020_post_location.sql`, idempotente; branch `feat/localizacao`. `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa; um commit por tarefa.

## Review Focus

1. **Grafias diferentes do mesmo lugar** ("Bar do Zé", "bar do ze", "BAR  DO ZÉ"): mesma chave, mesma página, e o compositor não oferece "Usar…" para algo que já é sugestão. → testes nas Tasks 1 e 5.
2. **`%` ou `_` digitados no local** ("100% bar", "bar_do_ze"): a busca de sugestões não pode tratar como curinga e sugerir tudo. → SQL escapa e o teste da migration confere (Task 1).
3. **App novo antes da migration subir**: post sem local tem que continuar saindo (a coluna `location` só vai no insert quando há local). → teste na Task 2.
4. **Busca de sugestões fora do ar**: o campo continua usável e "Usar "<digitado>"" aparece. → teste na Task 5.
5. **URL da página do local digitada/colada com maiúscula ou acento** (`/place/Bar%20do%20Z%C3%A9`): normaliza para a chave e acha os posts. → teste na Task 4.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0020_post_location.sql` (novo) | colunas, gatilho, `place_suggestions` |
| `supabase/README.md` | linha da 0020 |
| `types/database.ts` | colunas e função |
| `lib/places.ts` (novo) | `PLACE_MAX`, `cleanPlace`, `placeKey`, tabela de acentos |
| `lib/api/places.ts` (novo) | `suggestPlaces`, `countPlacePosts` |
| `lib/api/posts.ts` | `FeedPost.location/placeKey`, `createPost({ location })`, filtro `place` |
| `lib/usePostList.ts` | opção `place` (busca e ao vivo) |
| `components/places/PlaceLink.tsx` (novo) | linha do local no post |
| `components/PostCard.tsx` | mostra `PlaceLink`; prop `linkPlace` |
| `app/place/[key].tsx` (novo), `app/_layout.tsx` | página do local |
| `components/places/PlaceSuggestions.tsx`, `PlaceField.tsx`, `PlaceChip.tsx` (novos) | escolher local no compositor |
| `lib/composerDraft.ts`, `components/feed/Composer.tsx` | local no rascunho e no post |
| `DESIGN.md` | registrar o desenho |

---

### Task 1: Banco, tipos e regras do local

**Files:**
- Create: `supabase/migrations/0020_post_location.sql`
- Create: `lib/places.ts`
- Modify: `types/database.ts` (bloco `posts` ~158-196; `Functions` perto de `tag_suggestions` ~364)
- Modify: `supabase/README.md` (tabela de migrations, depois da linha da 0019)
- Test: `__tests__/places.test.ts`, `__tests__/postLocationMigration.test.ts`

**Interfaces:**
- Produces: `PLACE_MAX = 60`; `ACCENTS_FROM`, `ACCENTS_TO: string`; `cleanPlace(raw: string | null | undefined): string | null`; `placeKey(raw: string | null | undefined): string` (vazio → `''`). Tipos `Tables<'posts'>` com `location: string | null; place_key: string | null`; `Database['public']['Functions']['place_suggestions']` com `Args: { p_prefix: string; p_limit?: number }` e `Returns: { key: string; name: string; posts: number }[]`.

- [ ] **Step 0: Branch**

```bash
git checkout -b feat/localizacao
```

- [ ] **Step 1: Testes que falham**

`__tests__/places.test.ts`:

```ts
import { ACCENTS_FROM, ACCENTS_TO, cleanPlace, placeKey, PLACE_MAX } from '../lib/places';

describe('cleanPlace', () => {
  it('tira espaços das pontas e junta os repetidos', () => {
    expect(cleanPlace('  Bar   do\tZé \n')).toBe('Bar do Zé');
  });

  it('vazio, só espaços ou nada vira null', () => {
    expect(cleanPlace('')).toBeNull();
    expect(cleanPlace('   ')).toBeNull();
    expect(cleanPlace(null)).toBeNull();
    expect(cleanPlace(undefined)).toBeNull();
  });
});

describe('placeKey', () => {
  it('mesma chave para grafias diferentes do mesmo lugar', () => {
    expect(placeKey('Bar do Zé')).toBe('bar do ze');
    expect(placeKey('  BAR  DO ZÉ ')).toBe('bar do ze');
    expect(placeKey('bar do ze')).toBe('bar do ze');
  });

  it('tira acento de vogais, ç e ñ', () => {
    expect(placeKey('Açaí da Conceição')).toBe('acai da conceicao');
    expect(placeKey('Peñarol')).toBe('penarol');
  });

  it('acento decomposto (NFD) também', () => {
    expect(placeKey('Ze\u0301')).toBe('ze');
  });

  it('vazio vira chave vazia', () => {
    expect(placeKey('  ')).toBe('');
    expect(placeKey(null)).toBe('');
  });
});

describe('tabela de acentos', () => {
  it('cada letra com acento tem a sua sem acento', () => {
    expect(Array.from(ACCENTS_FROM)).toHaveLength(Array.from(ACCENTS_TO).length);
  });

  it('limite do local', () => {
    expect(PLACE_MAX).toBe(60);
  });
});
```

`__tests__/postLocationMigration.test.ts`:

```ts
// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

import { ACCENTS_FROM, ACCENTS_TO, PLACE_MAX } from '../lib/places';

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0020_post_location.sql`, 'utf8');

describe('0020_post_location.sql', () => {
  it('a chave é recalculada em qualquer insert/update (ninguém grava place_key na mão)', () => {
    expect(sql).toMatch(/before insert or update on public\.posts/);
    expect(sql).not.toMatch(/update of location/);
  });

  it('tabela de acentos igual à do app', () => {
    expect(sql).toContain(`translate(lower(public.clean_place(p)), '${ACCENTS_FROM}', '${ACCENTS_TO}')`);
  });

  it('mesmo limite de tamanho do app', () => {
    expect(sql).toContain(`char_length(location) between 1 and ${PLACE_MAX}`);
  });

  it('sugestões: % e _ digitados não viram curinga; só membros chamam', () => {
    expect(sql).toMatch(/replace\(replace\(replace\(/);
    expect(sql).toMatch(/'%', '\\%'\), '_', '\\_'\)/);
    expect(sql).toMatch(/security invoker/);
    expect(sql).toMatch(/grant execute on function public\.place_suggestions\(text, integer\) to authenticated/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/places.test.ts __tests__/postLocationMigration.test.ts`
Expected: FAIL (`Cannot find module '../lib/places'`).

- [ ] **Step 3: `lib/places.ts`**

```ts
/** Tamanho máximo do local (mesmo check posts_location_len, 0020). */
export const PLACE_MAX = 60;

/**
 * Letras com acento e a versão sem, na mesma ordem. É a mesma tabela do translate de
 * public.place_key (0020_post_location.sql): app e banco chegam na mesma chave.
 */
export const ACCENTS_FROM = 'áàâãäåāéèêëēíìîïīóòôõöōúùûüūçñý';
export const ACCENTS_TO = 'aaaaaaaeeeeeiiiiioooooouuuuucny';

const STRIP = new Map(Array.from(ACCENTS_FROM, (c, i) => [c, Array.from(ACCENTS_TO)[i]] as const));

/** Local como vai pro banco: sem espaços nas pontas nem repetidos; vazio vira null (igual ao gatilho). */
export function cleanPlace(raw: string | null | undefined): string | null {
  const text = (raw ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  return text || null;
}

/** Chave do local (igual a public.place_key): "Bar do Zé" e "bar do ze" viram "bar do ze". */
export function placeKey(raw: string | null | undefined): string {
  const text = cleanPlace(raw);
  if (!text) return '';
  return Array.from(text.toLowerCase(), (c) => STRIP.get(c) ?? c).join('');
}
```

- [ ] **Step 4: `supabase/migrations/0020_post_location.sql`**

```sql
-- fellasapp: local nos posts. Idempotente.
-- O local é texto livre (posts.location). O banco limpa (pontas e espaços repetidos) e grava a chave
-- posts.place_key (minúsculas, sem acento) por gatilho: "Bar do Zé" e "bar do ze" são o mesmo lugar.
-- Regras iguais às de lib/places.ts (a tabela de acentos do translate também; um teste confere).
-- place_suggestions(prefixo) sugere no compositor os locais já usados.

create or replace function public.clean_place(p text)
returns text
language sql
immutable
as $$
  select nullif(btrim(regexp_replace(coalesce(p, ''), '\s+', ' ', 'g')), '');
$$;

create or replace function public.place_key(p text)
returns text
language sql
immutable
as $$
  select translate(lower(public.clean_place(p)), 'áàâãäåāéèêëēíìîïīóòôõöōúùûüūçñý', 'aaaaaaaeeeeeiiiiioooooouuuuucny');
$$;

alter table public.posts add column if not exists location text;
alter table public.posts add column if not exists place_key text;

alter table public.posts drop constraint if exists posts_location_len;
alter table public.posts add constraint posts_location_len
  check (location is null or char_length(location) between 1 and 60);

create or replace function public.set_post_place()
returns trigger
language plpgsql
as $$
begin
  new.location := public.clean_place(new.location);
  new.place_key := public.place_key(new.location);
  return new;
end;
$$;

-- em qualquer update (não só do local): assim ninguém grava posts.place_key direto pela API
drop trigger if exists posts_set_place on public.posts;
create trigger posts_set_place
  before insert or update on public.posts
  for each row execute function public.set_post_place();

create index if not exists posts_place_key_idx on public.posts (place_key) where place_key is not null;

-- security invoker: a RLS de posts (só membros) vale aqui também.
-- name = a grafia mais usada da chave (empate: a mais recente). % e _ digitados não são curinga.
create or replace function public.place_suggestions(p_prefix text, p_limit integer default 5)
returns table (key text, name text, posts integer)
language sql
stable
security invoker
set search_path = public
as $$
  with spellings as (
    select p.place_key as k, p.location as n, count(*) as c, max(p.created_at) as last_at
      from public.posts p
     where p.place_key is not null
       and p.place_key like replace(replace(replace(coalesce(public.place_key(p_prefix), ''),
             '\', '\\'), '%', '\%'), '_', '\_') || '%'
     group by p.place_key, p.location
  )
  select k, (array_agg(n order by c desc, last_at desc))[1], sum(c)::integer
    from spellings
   group by k
   order by sum(c) desc, k
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.place_suggestions(text, integer) from public;
grant execute on function public.place_suggestions(text, integer) to authenticated;
```

- [ ] **Step 5: Tipos (`types/database.ts`)**

No bloco `posts`: em `Row`, depois de `tags: string[];`:

```ts
          /** Local escrito por quem postou (até 60), ou null. */
          location: string | null;
          /** Chave do local (minúsculas, sem acento); o gatilho preenche. */
          place_key: string | null;
```

Em `Insert` e em `Update`, depois de `tags?: string[];`:

```ts
          location?: string | null;
          place_key?: string | null;
```

Em `Functions`, depois de `tag_suggestions`:

```ts
      place_suggestions: {
        Args: { p_prefix: string; p_limit?: number };
        Returns: { key: string; name: string; posts: number }[];
      };
```

- [ ] **Step 6: README**

Em `supabase/README.md`, depois da linha da `0019_lastfm_user.sql`:

```markdown
| `0020_post_location.sql` | local nos posts: `posts.location` + `place_key` (gatilho), `place_suggestions` | postar com local, sugestões de local e página do local falham (post sem local funciona) |
```

- [ ] **Step 7: Rodar e ver passar**

Run: `npx jest __tests__/places.test.ts __tests__/postLocationMigration.test.ts && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 8: Commit**

```bash
git add supabase/migrations/0020_post_location.sql supabase/README.md types/database.ts lib/places.ts __tests__/places.test.ts __tests__/postLocationMigration.test.ts
git commit -m "Local nos posts: migration 0020, tipos e regras (cleanPlace, placeKey)"
```

---

### Task 2: API e lista de posts

**Files:**
- Create: `lib/api/places.ts`
- Modify: `lib/api/posts.ts` (`FeedPost` ~23-37, `mapPosts` ~85-104, `FeedFilter` ~122-130, `listFeed` ~132-145, `createPost` ~198-235)
- Modify: `lib/usePostList.ts` (assinatura ~36, `listFeed` ~105 e ~190, deps ~127 e ~210, `belongsHere` ~166-169)
- Test: `__tests__/placesApi.test.ts` (novo), `__tests__/posts.test.ts`, `__tests__/usePostListLive.test.tsx`

**Interfaces:**
- Consumes: `cleanPlace` (Task 1); tipo `place_suggestions` (Task 1).
- Produces: `type PlaceSuggestion = { key: string; name: string; posts: number }`; `suggestPlaces(prefix: string, limit = 5): Promise<PlaceSuggestion[]>`; `countPlacePosts(key: string): Promise<number>`; `FeedPost.location?: string | null`, `FeedPost.placeKey?: string | null`; `createPost({ body, imageUris?, location? })`; `FeedFilter.place?: string`; `usePostList({ place })`.

- [ ] **Step 1: Testes que falham**

`__tests__/placesApi.test.ts`:

```ts
const mockRpc = jest.fn();
const mockEq = jest.fn();
let mockCount: { count: number | null; error: unknown } = { count: 3, error: null };
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        eq: (...args: unknown[]) => {
          mockEq(...args);
          return Promise.resolve(mockCount);
        },
      }),
    }),
  },
}));

import { countPlacePosts, suggestPlaces } from '../lib/api/places';

beforeEach(() => {
  jest.clearAllMocks();
  mockCount = { count: 3, error: null };
});

describe('suggestPlaces', () => {
  it('chama a função com o digitado (o banco normaliza)', async () => {
    mockRpc.mockResolvedValue({ data: [{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }], error: null });
    await expect(suggestPlaces('Bar')).resolves.toEqual([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    expect(mockRpc).toHaveBeenCalledWith('place_suggestions', { p_prefix: 'Bar', p_limit: 5 });
  });

  it('erro sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(suggestPlaces('bar')).rejects.toMatchObject({ message: 'x' });
  });
});

describe('countPlacePosts', () => {
  it('conta posts com a chave do local', async () => {
    await expect(countPlacePosts('bar do ze')).resolves.toBe(3);
    expect(mockEq).toHaveBeenCalledWith('place_key', 'bar do ze');
  });

  it('erro sobe', async () => {
    mockCount = { count: null, error: { message: 'y' } };
    await expect(countPlacePosts('bar do ze')).rejects.toMatchObject({ message: 'y' });
  });
});
```

No fim de `__tests__/posts.test.ts`:

```ts
describe('local no post', () => {
  it('createPost manda o local limpo', async () => {
    mockResults['posts.insert'] = { data: { id: 'n' }, error: null };
    await createPost({ body: 'oi', location: '  Bar   do Zé ' });
    const row = mockCalls.find((c) => c.table === 'posts' && c.op === 'insert')?.args[0] as Record<string, unknown>;
    expect(row.location).toBe('Bar do Zé');
  });

  it('sem local (ou só espaços) não manda a coluna: funciona mesmo sem a migration 0020', async () => {
    mockResults['posts.insert'] = { data: { id: 'n' }, error: null };
    await createPost({ body: 'oi', location: '   ' });
    const row = mockCalls.find((c) => c.table === 'posts' && c.op === 'insert')?.args[0] as Record<string, unknown>;
    expect(row).not.toHaveProperty('location');
  });

  it('post só com local é recusado', async () => {
    await expect(createPost({ body: '', location: 'Bar do Zé' })).rejects.toThrow('Escreva algo ou escolha uma imagem');
  });

  it('listFeed traz o local e a chave', async () => {
    mockResults['posts.select'] = {
      data: [
        {
          id: 'p1',
          author_id: 'u1',
          body: 'oi',
          image_url: null,
          images: [],
          created_at: '2026-10-06T12:00:00Z',
          location: 'Bar do Zé',
          place_key: 'bar do ze',
          author: null,
          likes: [],
          comments: [],
        },
      ],
      error: null,
    };
    const { posts } = await listFeed();
    expect(posts[0]).toMatchObject({ location: 'Bar do Zé', placeKey: 'bar do ze' });
  });

  it('listFeed por local filtra pela chave', async () => {
    mockResults['posts.select'] = { data: [], error: null };
    await listFeed({ place: 'bar do ze' });
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'eq', args: ['place_key', 'bar do ze'] });
  });
});
```

No fim de `__tests__/usePostListLive.test.tsx`:

```ts
describe('usePostList por local', () => {
  it('busca filtrando pelo local', async () => {
    await feed({ place: 'bar do ze' });
    expect(mockListFeed).toHaveBeenCalledWith(expect.objectContaining({ place: 'bar do ze' }));
  });

  it('post novo ao vivo só conta se for do local', async () => {
    const { result } = await feed({ place: 'bar do ze' });
    await act(async () => {
      change('posts', 'INSERT', { id: 'p8', author_id: 'bia', place_key: null });
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia', place_key: 'bar do ze' });
    });
    expect(result.current.newPosts).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/placesApi.test.ts __tests__/posts.test.ts __tests__/usePostListLive.test.tsx`
Expected: FAIL (`Cannot find module '../lib/api/places'`; `location` ausente no insert; `place` ignorado).

- [ ] **Step 3: `lib/api/places.ts`**

```ts
import type { Database } from '../../types/database';
import { supabase } from '../supabase';

export type PlaceSuggestion = Database['public']['Functions']['place_suggestions']['Returns'][number];

/** Locais já usados cuja chave começa com o digitado (mais usados primeiro); vazio = os mais usados. */
export async function suggestPlaces(prefix: string, limit = 5): Promise<PlaceSuggestion[]> {
  const { data, error } = await supabase.rpc('place_suggestions', { p_prefix: prefix, p_limit: limit });
  if (error) throw error;
  return (data ?? []) as PlaceSuggestion[];
}

/** Quantos posts foram feitos no local (cabeçalho da página do local). */
export async function countPlacePosts(key: string): Promise<number> {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .eq('place_key', key);
  if (error) throw error;
  return count ?? 0;
}
```

- [ ] **Step 4: `lib/api/posts.ts`**

Import, junto dos outros:

```ts
import { cleanPlace } from '../places';
```

Em `FeedPost`, depois de `createdAt: string;`:

```ts
  /** Local escrito por quem postou ("Bar do Zé"), ou null. Falta em dados antigos/de teste. */
  location?: string | null;
  /** Chave do local (minúsculas, sem acento): leva à página do local. */
  placeKey?: string | null;
```

Em `mapPosts`, no objeto devolvido, depois de `createdAt: row.created_at,`:

```ts
      location: row.location ?? null,
      placeKey: row.place_key ?? null,
```

Em `FeedFilter`, depois de `tag?: string;`:

```ts
  /** Só posts deste local (página do local): a chave, já normalizada. */
  place?: string;
```

Em `listFeed`, trocar a desestruturação e somar o filtro:

```ts
export async function listFeed(
  { cursor, authorId, photosOnly, tag, place }: { cursor?: string | null } & FeedFilter = {},
): Promise<FeedPage> {
```

e depois de `if (tag) query = query.contains('tags', [tag]);`:

```ts
  if (place) query = query.eq('place_key', place);
```

Em `createPost`, assinatura:

```ts
export async function createPost({
  body,
  imageUris = [],
  location = null,
}: {
  body: string;
  /** Fotos locais (até 4), na ordem de exibição. */
  imageUris?: string[];
  /** Local escrito por quem posta; limpo aqui (pontas, espaços repetidos). */
  location?: string | null;
}): Promise<Tables<'posts'>> {
```

logo depois de `const userId = await currentUserId();`:

```ts
  const place = cleanPlace(location);
```

e no `row`, depois da linha de `images`:

```ts
    // só com local: sem ele o insert é o mesmo de antes (funciona mesmo sem a migration 0020)
    ...(place ? { location: place } : {}),
```

- [ ] **Step 5: `lib/usePostList.ts`**

Assinatura:

```ts
export function usePostList({ authorId, photosOnly, enabled = true, pinnedId, tag, place }: Options = {}) {
```

As duas chamadas `listFeed({ cursor: …, authorId, photosOnly, tag })` passam a mandar `place` também:

```ts
          listFeed({ cursor: reset ? null : from, authorId, photosOnly, tag, place }),
```

```ts
      listFeed({ cursor: null, authorId, photosOnly, tag, place })
```

Deps do `load` (`[authorId, photosOnly, pinnedId, tag]`) → `[authorId, photosOnly, pinnedId, tag, place]`; deps do efeito ao vivo (`[enabled, loaded, authorId, photosOnly, tag, refetch]`) → `[enabled, loaded, authorId, photosOnly, tag, place, refetch]`.

Em `belongsHere`, depois da linha da `tag`:

```ts
      (!place || row.place_key === place) &&
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest __tests__/placesApi.test.ts __tests__/posts.test.ts __tests__/usePostListLive.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 7: Commit**

```bash
git add lib/api/places.ts lib/api/posts.ts lib/usePostList.ts __tests__/placesApi.test.ts __tests__/posts.test.ts __tests__/usePostListLive.test.tsx
git commit -m "Local nos posts: API (sugestões, contagem, createPost, filtro por local)"
```

---

### Task 3: Linha do local no post

**Files:**
- Create: `components/places/PlaceLink.tsx`
- Modify: `components/PostCard.tsx` (props ~16-31 e ~37-47; linha do nome ~100-135)
- Test: `__tests__/postLocation.test.tsx` (novo)

**Interfaces:**
- Consumes: `FeedPost.location`, `FeedPost.placeKey` (Task 2).
- Produces: `PlaceLink({ location: string; placeKey: string | null | undefined; enabled?: boolean })`; `PostCard` prop `linkPlace?: boolean` (padrão `true`). Rota aberta: `/place/<encodeURIComponent(placeKey)>?name=<encodeURIComponent(location)>`.

- [ ] **Step 1: Teste que falha**

`__tests__/postLocation.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  router: { push: (...args: unknown[]) => mockPush(...args) },
  useRouter: () => ({ push: mockPush }),
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { PostCard } from '../components/PostCard';
import type { FeedPost } from '../lib/api/posts';

const post: FeedPost = {
  id: 'p1',
  body: 'saindo pro rolê',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  location: 'Bar do Zé',
  placeKey: 'bar do ze',
  author: { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};

beforeEach(() => mockPush.mockClear());

describe('local no post', () => {
  it('mostra o local abaixo do nome e o toque abre a página do local', async () => {
    await render(<PostCard post={post} />);
    expect(screen.getByText('Bar do Zé')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver posts em Bar do Zé'));
    expect(mockPush).toHaveBeenCalledWith('/place/bar%20do%20ze?name=Bar%20do%20Z%C3%A9');
  });

  it('sem local não tem a linha', async () => {
    await render(<PostCard post={{ ...post, location: null, placeKey: null }} />);
    expect(screen.queryByLabelText(/Ver posts em/)).toBeNull();
  });

  it('na página do próprio local (linkPlace false) mostra sem ser link', async () => {
    await render(<PostCard post={post} linkPlace={false} />);
    expect(screen.getByText('Bar do Zé')).toBeTruthy();
    expect(screen.queryByLabelText('Ver posts em Bar do Zé')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/postLocation.test.tsx`
Expected: FAIL (texto "Bar do Zé" não encontrado).

- [ ] **Step 3: `components/places/PlaceLink.tsx`**

```tsx
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon, Text } from '../ui';

type Props = {
  location: string;
  placeKey: string | null | undefined;
  /** false: só mostra (na página do próprio local, para não empilhar a mesma página). */
  enabled?: boolean;
};

/** Local do post, discreto abaixo do nome: ícone + nome numa linha; toque abre os posts do local. */
export function PlaceLink({ location, placeKey, enabled = true }: Props) {
  const t = useTheme();
  const row = {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.xs,
    alignSelf: 'flex-start' as const,
    maxWidth: '100%' as const,
  };
  const content = (
    <>
      <Icon name="location-outline" size="sm" tone="muted" />
      <Text variant="caption" tone="muted" numberOfLines={1} style={{ flexShrink: 1 }}>
        {location}
      </Text>
    </>
  );
  if (!enabled || !placeKey) return <View style={row}>{content}</View>;
  // a linha é baixa: o hitSlop completa o alvo de toque de 44
  const slop = (t.layout.minTouch - t.typography.caption.lineHeight) / 2;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={`Ver posts em ${location}`}
      onPress={() => router.push(`/place/${encodeURIComponent(placeKey)}?name=${encodeURIComponent(location)}`)}
      hitSlop={{ top: slop, bottom: slop, left: t.spacing.xs, right: t.spacing.xs }}
      // como o AuthorLink: o hover surfaceSunken sumiria sobre a linha do post, que já acende
      style={({ pressed }) => [row, { cursor: 'pointer' as const, opacity: pressed ? 0.7 : 1 }]}
    >
      {content}
    </Pressable>
  );
}
```

- [ ] **Step 4: `components/PostCard.tsx`**

Import:

```tsx
import { PlaceLink } from './places/PlaceLink';
```

Em `Props`, depois de `linkAuthor?: boolean;`:

```tsx
  /** O local abre a página dele (padrão). Desligado na própria página do local. */
  linkPlace?: boolean;
```

Na desestruturação, depois de `linkAuthor = true,`: `linkPlace = true,`.

Envolver a linha do nome (o `<View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: t.avatarSizes.md / 2 }}>` … `</View>`) num `<View>` sem `gap` e pôr o local logo depois dela, dentro do mesmo `<View>` — assim nome + local cabem na altura do avatar, sem o `gap` de 8 da coluna entre eles:

```tsx
          {/* nome e local juntos, na altura do avatar (sem o espaço da coluna entre eles) */}
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.sm, minHeight: t.avatarSizes.md / 2 }}>
              {/* …conteúdo atual da linha do nome, sem mudança… */}
            </View>
            {post.location ? (
              <PlaceLink location={post.location} placeKey={post.placeKey} enabled={linkPlace} />
            ) : null}
          </View>
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest __tests__/postLocation.test.tsx __tests__/PostCard.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 6: Commit**

```bash
git add components/places/PlaceLink.tsx components/PostCard.tsx __tests__/postLocation.test.tsx
git commit -m "Post: linha do local abaixo do nome, toque abre os posts do local"
```

---

### Task 4: Página do local

**Files:**
- Create: `app/place/[key].tsx`
- Modify: `app/_layout.tsx` (depois de `<Stack.Screen name="tag/[name]" … />`, ~56)
- Test: `__tests__/placeScreen.test.tsx` (novo)

**Interfaces:**
- Consumes: `countPlacePosts` (Task 2), `usePostList({ place })` (Task 2), `placeKey` (Task 1), `PostCard` `linkPlace` (Task 3).
- Produces: rota `/place/[key]` com parâmetro opcional `name`.

- [ ] **Step 1: Teste que falha**

`__tests__/placeScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPush = jest.fn();
let mockParams: Record<string, string | undefined> = { key: 'bar do ze', name: 'Bar do Zé' };
const mockScreenOptions = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => mockParams,
  Stack: { Screen: (props: { options: unknown }) => (mockScreenOptions(props.options), null) },
  router: { push: jest.fn() },
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
const mockCount = jest.fn();
jest.mock('../lib/api/places', () => ({ countPlacePosts: (key: string) => mockCount(key) }));
const mockUsePostList = jest.fn();
jest.mock('../lib/usePostList', () => ({
  usePostList: (opts: unknown) => mockUsePostList(opts),
  removePost: jest.fn(),
}));

import PlaceScreen from '../app/place/[key]';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PlaceScreen />
    </SafeAreaProvider>,
  );
const list = (over: Record<string, unknown> = {}) => ({
  posts: [],
  loading: false,
  refreshing: false,
  error: null,
  refresh: jest.fn(),
  reload: jest.fn(),
  loadMore: jest.fn(),
  like: jest.fn(),
  react: jest.fn(),
  ...over,
});
const post = {
  id: 'p1',
  body: 'chegamos',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  location: 'Bar do Zé',
  placeKey: 'bar do ze',
  author: { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};
const lastTitle = () => {
  const options = mockScreenOptions.mock.calls.at(-1)?.[0] as { title?: string };
  return options?.title;
};

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = { key: 'bar do ze', name: 'Bar do Zé' };
  mockCount.mockResolvedValue(2);
  mockUsePostList.mockReturnValue(list({ posts: [post] }));
});

describe('Página do local', () => {
  it('lista os posts do local com a contagem; o local nos posts não é link', async () => {
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ place: 'bar do ze' });
    expect(mockCount).toHaveBeenCalledWith('bar do ze');
    expect(await screen.findByText('2 posts')).toBeTruthy();
    expect(screen.queryByLabelText('Ver posts em Bar do Zé')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Abrir post de Bia'));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
  });

  it('título: a grafia de quem postou', async () => {
    mockParams = { key: 'bar do ze', name: 'bar do ze' };
    await open();
    expect(lastTitle()).toBe('Bar do Zé');
  });

  it('título antes de carregar: o nome que veio no link', async () => {
    mockUsePostList.mockReturnValue(list({ loading: true }));
    mockParams = { key: 'praia', name: 'Praia' };
    await open();
    expect(lastTitle()).toBe('Praia');
  });

  it('título sem post nem nome: "Local"', async () => {
    mockUsePostList.mockReturnValue(list({ loading: true }));
    mockParams = { key: 'praia' };
    await open();
    expect(lastTitle()).toBe('Local');
  });

  it('URL com maiúscula e acento acha a chave', async () => {
    mockParams = { key: 'Bar do Zé' };
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ place: 'bar do ze' });
  });

  it('vazio convida a postar de lá', async () => {
    mockUsePostList.mockReturnValue(list());
    mockCount.mockResolvedValue(0);
    await open();
    expect(screen.getByText('Ninguém postou daqui ainda.')).toBeTruthy();
    expect(screen.getByText('Posta algo marcando esse lugar.')).toBeTruthy();
  });

  it('erro oferece tentar de novo', async () => {
    const failed = list({ error: 'caiu' });
    mockUsePostList.mockReturnValue(failed);
    await open();
    expect(screen.getByText('Não deu pra carregar esse local')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(failed.reload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/placeScreen.test.tsx`
Expected: FAIL (`Cannot find module '../app/place/[key]'`).

- [ ] **Step 3: Conferir o título do `stackHeader`**

Run: `grep -n "export function stackHeader" -A12 components/profile/headerOptions.ts`
Expected: a função devolve um objeto com `title`. Se a chave do título tiver outro nome, ajustar `lastTitle()` no teste para lê-la.

- [ ] **Step 4: `app/place/[key].tsx`**

```tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';

import { PostCard } from '../../components/PostCard';
import { stackHeader } from '../../components/profile/headerOptions';
import { Button, Divider, EmptyState, Screen, Text } from '../../components/ui';
import { countPlacePosts } from '../../lib/api/places';
import { useSession } from '../../lib/auth/SessionProvider';
import { placeKey } from '../../lib/places';
import { useTheme } from '../../lib/theme';
import { removePost, usePostList } from '../../lib/usePostList';

/** Posts feitos num local, no formato do feed (mais novo primeiro). */
export default function PlaceScreen() {
  const t = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ key: string; name?: string }>();
  const key = placeKey(String(params.key ?? ''));
  const me = useSession().session?.user.id;
  const { posts, loading, refreshing, error, refresh, reload, loadMore, like, react } = usePostList({ place: key });
  const [count, setCount] = useState<number | null>(null);
  // a grafia de quem postou; antes de carregar, a do post que foi tocado
  const title = posts[0]?.location || (params.name ? String(params.name) : '') || 'Local';

  useEffect(() => {
    let alive = true;
    setCount(null);
    // a contagem é extra: falhou, o cabeçalho fica sem ela
    countPlacePosts(key)
      .then((n) => alive && setCount(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]);

  return (
    <>
      <Stack.Screen options={stackHeader(t, title)} />
      <Screen flush header>
        <FlatList
          data={posts}
          keyExtractor={(p) => p.id}
          ItemSeparatorComponent={Divider}
          contentContainerStyle={{ paddingBottom: t.spacing.xl }}
          ListHeaderComponent={
            count !== null && count > 0 ? (
              <Text
                variant="small"
                tone="muted"
                style={{ paddingHorizontal: t.layout.gutter, paddingVertical: t.spacing.sm }}
              >
                {count === 1 ? '1 post' : `${count} posts`}
              </Text>
            ) : null
          }
          renderItem={({ item }) => (
            <PostCard
              post={item}
              linkPlace={false}
              onToggleLike={like}
              onReact={react}
              onPress={(p) => router.push(`/post/${p.id}`)}
              onDelete={item.author.id === me ? (p) => removePost(p.id) : undefined}
            />
          )}
          refreshing={refreshing}
          onRefresh={refresh}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          ListFooterComponent={
            error && posts.length > 0 ? (
              <View style={{ alignItems: 'center', padding: t.spacing.lg, gap: t.spacing.sm }}>
                <Text tone="muted" align="center" accessibilityRole="alert">
                  Não deu pra carregar mais posts.
                </Text>
                <Button variant="secondary" title="Tentar de novo" onPress={loadMore} />
              </View>
            ) : loading && posts.length > 0 && !refreshing ? (
              <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
            ) : null
          }
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
            ) : error ? (
              <EmptyState
                title="Não deu pra carregar esse local"
                message="Deu ruim na conexão. Confere a internet e tenta de novo."
                actionLabel="Tentar de novo"
                onAction={reload}
              />
            ) : (
              <EmptyState title="Ninguém postou daqui ainda." message="Posta algo marcando esse lugar." />
            )
          }
        />
      </Screen>
    </>
  );
}
```

- [ ] **Step 5: Rota em `app/_layout.tsx`**

Depois de `<Stack.Screen name="tag/[name]" options={{ headerShown: true, title: 'Tag' }} />`:

```tsx
            <Stack.Screen name="place/[key]" options={{ headerShown: true, title: 'Local' }} />
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest __tests__/placeScreen.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 7: Commit**

```bash
git add "app/place/[key].tsx" app/_layout.tsx __tests__/placeScreen.test.tsx
git commit -m "Página do local: posts feitos lá, no formato do feed"
```

---

### Task 5: Escolher o local no compositor

**Files:**
- Create: `components/places/PlaceSuggestions.tsx`, `components/places/PlaceField.tsx`, `components/places/PlaceChip.tsx`
- Modify: `lib/composerDraft.ts` (tipo `Draft` e `EMPTY`, linhas 3-5)
- Modify: `components/feed/Composer.tsx` (rascunho ~42, `hasDraft` ~61, `publish` ~94-108, `cancel` ~110, editor ~173-218, toolbar ~241-250, cabeçalho ~303)
- Test: `__tests__/placeSuggestions.test.tsx` (novo), `__tests__/composer.test.tsx`, `__tests__/composerDraft.test.ts`

**Interfaces:**
- Consumes: `suggestPlaces`, `PlaceSuggestion` (Task 2); `cleanPlace`, `placeKey`, `PLACE_MAX` (Task 1); `createPost({ location })` (Task 2).
- Produces: `PLACE_SUGGEST_DEBOUNCE_MS = 200`; `PlaceSuggestions({ query: string; onPick: (name: string) => void })`; `PlaceField({ initial: string; disabled?: boolean; onDone: (location: string | null) => void })`; `PlaceChip({ location: string; disabled?: boolean; onEdit: () => void; onRemove: () => void })`; `Draft = { body: string; imageUris: string[]; location: string | null }`.

- [ ] **Step 1: Testes que falham**

`__tests__/placeSuggestions.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSuggest = jest.fn();
jest.mock('../lib/api/places', () => ({ suggestPlaces: (q: string) => mockSuggest(q) }));

import { PlaceSuggestions } from '../components/places/PlaceSuggestions';

beforeEach(() => mockSuggest.mockReset());

describe('PlaceSuggestions', () => {
  it('mostra os locais com o número de posts; escolher devolve a grafia do local', async () => {
    mockSuggest.mockResolvedValue([
      { key: 'bar do ze', name: 'Bar do Zé', posts: 12 },
      { key: 'bar da ana', name: 'Bar da Ana', posts: 1 },
    ]);
    const onPick = jest.fn();
    await render(<PlaceSuggestions query="bar" onPick={onPick} />);
    expect(await screen.findByText('Bar do Zé')).toBeTruthy();
    expect(screen.getByText('12 posts')).toBeTruthy();
    expect(screen.getByText('1 post')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Usar Bar da Ana'));
    expect(onPick).toHaveBeenCalledWith('Bar da Ana');
  });

  it('digitado ainda não é um local: oferece usar como está (limpo)', async () => {
    mockSuggest.mockResolvedValue([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    const onPick = jest.fn();
    await render(<PlaceSuggestions query="  bar " onPick={onPick} />);
    await fireEvent.press(await screen.findByLabelText('Usar "bar"'));
    expect(onPick).toHaveBeenCalledWith('bar');
  });

  it('digitado igual a um local (outra grafia) não oferece "Usar…"', async () => {
    mockSuggest.mockResolvedValue([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    await render(<PlaceSuggestions query="BAR DO ZE" onPick={() => {}} />);
    expect(await screen.findByText('Bar do Zé')).toBeTruthy();
    expect(screen.queryByLabelText('Usar "BAR DO ZE"')).toBeNull();
  });

  it('busca falhou: ainda dá pra usar o digitado', async () => {
    mockSuggest.mockRejectedValue(new Error('caiu'));
    await render(<PlaceSuggestions query="praia" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalled());
    expect(screen.getByLabelText('Usar "praia"')).toBeTruthy();
  });

  it('campo vazio e nenhum local: não mostra nada', async () => {
    mockSuggest.mockResolvedValue([]);
    await render(<PlaceSuggestions query="" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith(''));
    expect(screen.queryByLabelText('Locais pra usar')).toBeNull();
  });
});
```

Em `__tests__/composer.test.tsx`, junto dos outros `jest.mock`:

```tsx
const mockSuggestPlaces = jest.fn();
jest.mock('../lib/api/places', () => ({ suggestPlaces: (q: string) => mockSuggestPlaces(q) }));
```

no `beforeEach`, depois de `createPostMock.mockClear();`:

```tsx
  mockSuggestPlaces.mockReset();
  mockSuggestPlaces.mockResolvedValue([]);
```

no teste `'inline: sem Cancelar, posta e limpa sem navegar'`, a expectativa vira:

```tsx
    await waitFor(() => expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [], location: null }));
```

e, dentro do `describe('Composer', …)`, os testes novos:

```tsx
  it('local: escolher uma sugestão vira chip e vai junto no post', async () => {
    mockSuggestPlaces.mockResolvedValue([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'bar');
    await fireEvent.press(await screen.findByLabelText('Usar Bar do Zé'));
    expect(screen.queryByLabelText('Local')).toBeNull();
    expect(screen.getByLabelText('Trocar local (Bar do Zé)')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [], location: 'Bar do Zé' }),
    );
    await waitFor(() => expect(screen.queryByLabelText('Trocar local (Bar do Zé)')).toBeNull());
  });

  it('local: Enter usa o digitado (limpo); tocar no chip edita; ✕ tira', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), '  casa do   Pedro ');
    await fireEvent(screen.getByLabelText('Local'), 'submitEditing');
    await fireEvent.press(screen.getByLabelText('Trocar local (casa do Pedro)'));
    expect(screen.getByDisplayValue('casa do Pedro')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Local'), 'submitEditing');
    await fireEvent.press(screen.getByLabelText('Tirar local'));
    expect(screen.queryByLabelText(/^Trocar local \(/)).toBeNull();
    expect(screen.getByLabelText('Adicionar local')).toBeTruthy();
  });

  it('local: ✕ do campo fecha sem local', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'praia');
    await fireEvent.press(screen.getByLabelText('Fechar local'));
    expect(screen.queryByLabelText('Local')).toBeNull();
    expect(screen.queryByLabelText(/^Trocar local \(/)).toBeNull();
  });

  it('local sozinho não posta, mas conta como rascunho para descartar', async () => {
    const onCancel = jest.fn();
    await render(<Composer variant="dialog" onCancel={onCancel} />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'Bar');
    await fireEvent(screen.getByLabelText('Local'), 'submitEditing');
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(createPostMock).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.getByText('Descartar o rascunho?')).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
  });
```

Em `__tests__/composerDraft.test.ts`, o primeiro `setDraft` ganha um local (prova que o logout limpa o local também) e os outros dois ganham `location: null`:

```ts
    setDraft({ body: 'segredo da Ana', imageUris: ['file://a.jpg'], location: 'Bar do Zé' });
```

```ts
    setDraft({ body: 'da Ana', imageUris: [], location: null });
```

```ts
    setDraft({ body: 'continua', imageUris: [], location: null });
```

e a expectativa do primeiro teste vira:

```ts
    expect(result.current).toEqual({ body: '', imageUris: [], location: null });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/placeSuggestions.test.tsx __tests__/composer.test.tsx __tests__/composerDraft.test.ts`
Expected: FAIL (`Cannot find module '../components/places/PlaceSuggestions'`; "Adicionar local" não encontrado; `location` ausente).

- [ ] **Step 3: `components/places/PlaceSuggestions.tsx`**

```tsx
import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';

import { suggestPlaces, type PlaceSuggestion } from '../../lib/api/places';
import { cleanPlace, placeKey } from '../../lib/places';
import { useTheme } from '../../lib/theme';
import { interactiveStyle, Text } from '../ui';

/** Espera a pessoa parar de digitar um instante antes de perguntar ao banco. */
export const PLACE_SUGGEST_DEBOUNCE_MS = 200;

type Props = { query: string; onPick: (name: string) => void };

/**
 * Locais que o grupo já usou enquanto a pessoa digita (até 5, mais usados primeiro), com quantos posts
 * têm. Se o digitado ainda não é um deles, a última linha oferece usar como está.
 */
export function PlaceSuggestions({ query, onPick }: Props) {
  const t = useTheme();
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      suggestPlaces(query)
        .then((list) => alive && setOptions(list))
        .catch(() => alive && setOptions([]));
    }, PLACE_SUGGEST_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  const typed = cleanPlace(query);
  const typedKey = placeKey(query);
  const offerTyped = !!typed && !options.some((o) => o.key === typedKey);
  if (options.length === 0 && !offerTyped) return null;

  const option = (key: string, label: string, onPress: () => void, children: ReactNode) => (
    <Pressable
      key={key}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch,
        paddingHorizontal: t.spacing.md,
        ...interactiveStyle(t, state),
      })}
    >
      {children}
    </Pressable>
  );

  return (
    <View
      accessibilityLabel="Locais pra usar"
      style={{
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
      }}
    >
      {options.map((o) =>
        option(
          o.key,
          `Usar ${o.name}`,
          () => onPick(o.name),
          <>
            <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
              {o.name}
            </Text>
            <Text variant="small" tone="muted" numberOfLines={1}>
              {o.posts === 1 ? '1 post' : `${o.posts} posts`}
            </Text>
          </>,
        ),
      )}
      {offerTyped && typed
        ? option(
            '__typed',
            `Usar "${typed}"`,
            () => onPick(typed),
            <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
              Usar "{typed}"
            </Text>,
          )
        : null}
    </View>
  );
}
```

- [ ] **Step 4: `components/places/PlaceField.tsx`**

```tsx
import { useState } from 'react';
import { TextInput, View } from 'react-native';

import { cleanPlace, PLACE_MAX } from '../../lib/places';
import { useTheme } from '../../lib/theme';
import { Icon, IconButton } from '../ui';
import { PlaceSuggestions } from './PlaceSuggestions';

type Props = {
  /** Local já escolhido (editar) ou '' (novo). */
  initial: string;
  disabled?: boolean;
  /** Confirmou (sugestão, "Usar…" ou Enter): o local limpo, ou null (vazio ou ✕). */
  onDone: (location: string | null) => void;
};

/** Campo do local no compositor: ícone, texto e fechar, com as sugestões embaixo. */
export function PlaceField({ initial, disabled, onDone }: Props) {
  const t = useTheme();
  const [text, setText] = useState(initial);
  return (
    <View style={{ gap: t.spacing.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: t.spacing.sm,
          paddingLeft: t.spacing.md,
          borderWidth: t.borders.hairline,
          borderColor: t.colors.border,
          borderRadius: t.radii.md,
          backgroundColor: t.colors.surface,
        }}
      >
        <Icon name="location-outline" size="sm" tone="muted" />
        <TextInput
          autoFocus
          accessibilityLabel="Local"
          placeholder="Onde você tá?"
          placeholderTextColor={t.colors.textMuted}
          selectionColor={t.colors.primary}
          value={text}
          onChangeText={setText}
          maxLength={PLACE_MAX}
          editable={!disabled}
          returnKeyType="done"
          onSubmitEditing={() => onDone(cleanPlace(text))}
          style={[t.typography.body, { flex: 1, minHeight: t.layout.minTouch, color: t.colors.text }]}
        />
        <IconButton
          icon="close"
          accessibilityLabel="Fechar local"
          variant="ghost"
          tone="muted"
          size="sm"
          disabled={disabled}
          onPress={() => onDone(null)}
        />
      </View>
      <PlaceSuggestions query={text} onPick={(name) => onDone(cleanPlace(name))} />
    </View>
  );
}
```

- [ ] **Step 5: `components/places/PlaceChip.tsx`**

```tsx
import { Pressable, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Icon, Text } from '../ui';

type Props = {
  location: string;
  disabled?: boolean;
  onEdit: () => void;
  onRemove: () => void;
};

/** Local escolhido no compositor: chip com o nome (toque edita) e ✕ (tira). */
export function PlaceChip({ location, disabled, onEdit, onRemove }: Props) {
  const t = useTheme();
  // o chip é mais baixo que 44: o hitSlop completa o alvo de toque
  const slop = (t.layout.minTouch - t.layout.chipHeight) / 2;
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        maxWidth: '100%',
        height: t.layout.chipHeight,
        paddingLeft: t.spacing.sm,
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.pill,
      }}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Trocar local (${location})`}
        onPress={onEdit}
        disabled={disabled}
        hitSlop={{ top: slop, bottom: slop }}
        style={{ flexDirection: 'row', alignItems: 'center', gap: t.spacing.xs, flexShrink: 1, cursor: 'pointer' }}
      >
        <Icon name="location-outline" size="sm" />
        <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
          {location}
        </Text>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Tirar local"
        onPress={onRemove}
        disabled={disabled}
        hitSlop={{ top: slop, bottom: slop, right: t.spacing.xs }}
        style={{
          width: t.layout.chipHeight,
          height: t.layout.chipHeight,
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      >
        <Icon name="close" size="sm" tone="muted" />
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 6: `lib/composerDraft.ts`**

```ts
export type Draft = { body: string; imageUris: string[]; location: string | null };

const EMPTY: Draft = { body: '', imageUris: [], location: null };
```

E o comentário de `useDraft` passa a citar o local: `…mostram o mesmo texto, fotos e local, então…`.

- [ ] **Step 7: `components/feed/Composer.tsx`**

Imports:

```tsx
import { PlaceChip } from '../places/PlaceChip';
import { PlaceField } from '../places/PlaceField';
```

Rascunho e estado (no lugar de `const { body, imageUris } = useDraft();`):

```tsx
  const { body, imageUris, location } = useDraft();
```

e, junto dos outros `useState`:

```tsx
  // campo do local aberto (abaixo do texto); fechado, o local escolhido aparece como chip
  const [placeOpen, setPlaceOpen] = useState(false);
```

Depois de `const hasDraft = …;`:

```tsx
  // local sozinho não dá post, mas é rascunho: descartar pergunta antes
  const hasAnything = hasDraft || !!location;
```

Em `publish`, a chamada e a limpeza:

```tsx
      await createPost({ body, imageUris, location });
      emitPostCreated();
      clearDraft();
      setPlaceOpen(false);
```

`cancel`:

```tsx
  const cancel = () => (hasAnything ? setDiscarding(true) : onCancel?.());
```

No `onConfirm` do `discardDialog`, depois de `clearDraft();`: `setPlaceOpen(false);`.

No `header`, o "Cancelar" da página: `disabled={!hasAnything || saving}`.

No `editor`, logo depois do bloco `{!hasDraft && variant !== 'inline' ? (…) : null}` e antes das fotos:

```tsx
        {placeOpen ? (
          <PlaceField
            initial={location ?? ''}
            disabled={saving}
            onDone={(next) => {
              setDraft((d) => ({ ...d, location: next }));
              setPlaceOpen(false);
            }}
          />
        ) : null}
```

e logo depois do bloco das fotos (`{imageUris.length > 0 ? (…) : null}`), antes do erro:

```tsx
        {location && !placeOpen ? (
          <PlaceChip
            location={location}
            disabled={saving}
            onEdit={() => setPlaceOpen(true)}
            onRemove={() => setDraft((d) => ({ ...d, location: null }))}
          />
        ) : null}
```

Na `toolbar`, logo depois do `<Text variant="small" tone="muted">{imageUris.length}/{MAX_IMAGES} fotos</Text>`:

```tsx
      <IconButton
        icon="location-outline"
        accessibilityLabel={location ? 'Trocar local' : 'Adicionar local'}
        variant="ghost"
        onPress={() => setPlaceOpen(true)}
        disabled={saving}
      />
```

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest __tests__/placeSuggestions.test.tsx __tests__/composer.test.tsx __tests__/composerDraft.test.ts __tests__/newPost.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída. (`newPost.test.tsx` também renderiza o `Composer`; o `PlaceSuggestions` só monta depois do toque em "Adicionar local", então ele não deve mudar.)

- [ ] **Step 9: Commit**

```bash
git add components/places/PlaceSuggestions.tsx components/places/PlaceField.tsx components/places/PlaceChip.tsx lib/composerDraft.ts components/feed/Composer.tsx __tests__/placeSuggestions.test.tsx __tests__/composer.test.tsx __tests__/composerDraft.test.ts
git commit -m "Compositor: escolher o local (campo com sugestões, chip, vai junto no post)"
```

---

### Task 6: DESIGN.md e verificação final

**Files:**
- Modify: `DESIGN.md` (seção "### Post (feed, perfil, tela do post)"; "## Layout por largura" no item do Compositor)

- [ ] **Step 1: `DESIGN.md`**

Na seção do Post, depois de "…nome (bold) + data à direita,", inserir: "local (quando tem) logo abaixo do nome — `location-outline` `sm` + `caption` `textMuted`, uma linha, toque abre `/place/<chave>` com os posts do local (página no molde da tag) —". No item do Compositor em "Layout por largura", acrescentar: "Local: botão `location-outline` na barra (depois de "0/4 fotos") abre campo abaixo do texto ("Onde você tá?", até 60) com `PlaceSuggestions` (caixa igual à das tags; última linha "Usar "…"" quando o digitado é novo); escolhido vira chip `chipHeight` com contorno `hairline`, raio `pill`, toque edita e ✕ tira. Mesmo lugar com grafias diferentes = mesma chave (minúsculas, sem acento)."

- [ ] **Step 2: Suíte inteira**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem saída; todas as suítes passam.

- [ ] **Step 3: Passada visual (Impeccable, uma rodada)**

`EXPO_PUBLIC_DEV_FAKE_LOGIN=1 npx expo start --web --port 8099`. Conferir no celular (moldura 390px) e no computador, claro e escuro: botão de local na barra do compositor, campo aberto com sugestões, chip (nome longo cortado com "…"), linha do local num post (nome + local alinhados com o avatar), página do local. Sem banco de verdade, forçar um post com `location` no dado falso marcando `TEMP-PREVIEW` e desfazer tudo que tiver `TEMP-PREVIEW` no fim.

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md
git commit -m "DESIGN: local nos posts e no compositor"
```

- [ ] **Step 5: Avisar o Juan**

1. Aplicar a migration **antes** do push (o push na main publica o site): `! export $(grep '^SUPABASE_ACCESS_TOKEN=' .env | xargs) && npx supabase db query --linked -f supabase/migrations/0020_post_location.sql`
2. Depois, fechar a branch com superpowers:finishing-a-development-branch (fluxo do projeto: merge local na main + push).
