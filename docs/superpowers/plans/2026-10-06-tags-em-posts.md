# Tags (#) em posts — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `#tags` escritas no texto do post viram link para uma página com os posts daquela tag, com sugestão de tags existentes ao digitar `#` no compositor.

**Architecture:** O banco tira as tags do texto (função `extract_tags` + gatilho) e guarda em `posts.tags` (com índice GIN); `tag_suggestions(prefixo)` sugere as existentes. No app, a regra da tag mora em `lib/tags.ts` (mesma do banco), o separador de texto das menções passa a reconhecer tags, o compositor mostra `TagSuggestions` e a página `/tag/[name]` usa `usePostList({ tag })`.

**Tech Stack:** Expo SDK 57, expo-router (Stack), React Native / react-native-web, TypeScript, jest-expo + @testing-library/react-native v14 (`await render`, `await fireEvent.*`), Supabase (Postgres + RLS).

**Spec:** `docs/superpowers/specs/2026-10-06-tags-em-posts-design.md`

## Global Constraints

- Texto da interface em pt-BR, tom do `PRODUCT.md`; nunca emoji como ícone.
- Telas usam tokens de `lib/theme.ts` e primitivos de `components/ui` (CLAUDE.md); UI segue Impeccable (modo Operate).
- Tag: `#` + 2 a 30 caracteres de letras (com acento), números e `_`; não pode vir colada depois de letra/número/`_`/`#`/`/`; não pode continuar colada; minúsculas; sem repetir. Mesma regra no app (`\p{L}\p{N}_`) e no banco (`[[:alnum:]_]`, banco `ctype en_US.UTF-8`).
- Tag vira link **só em posts**; comentários continuam texto.
- Sugestões: até 5, mais usadas primeiro; prefixo vazio = mais usadas.
- Página da tag: mais novo primeiro; vazio "Ninguém usou #tag ainda." / "Posta algo com ela."; erro "Não deu pra carregar essa tag" + "Tentar de novo".
- Migration `supabase/migrations/0016_post_tags.sql`, idempotente. Branch `feat/tags`.
- `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa; um commit por tarefa.

## Review Focus

1. **Tag com acento ou maiúscula** (`#Ação`): o link vai para a tag em minúsculas e codificada na URL, e a página normaliza o nome de volta → acha os posts. → testes nas Tasks 3 e 7.
2. **Link com âncora** (`https://site.com/#praia`) não pode virar tag. → teste na Task 2 (e `/` na regra do banco, Task 1).
3. **Pontuação/emoji colados depois** (`#praia!`, `#praia🏖️`): a tag é só `praia`. → teste na Task 2.
4. **Resposta atrasada de sugestão** (digitou `#ar` e depois `#art` rápido): a lista não pode ser sobrescrita pela resposta antiga. → teste na Task 5.
5. **Post novo ao vivo sem a tag** na página da tag: não conta como "post novo" daquela tag. → teste na Task 6.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0016_post_tags.sql` (novo) | `extract_tags`, `posts.tags` + gatilho + backfill + índice, `tag_suggestions` |
| `types/database.ts` | `posts.tags`, função `tag_suggestions` |
| `supabase/README.md` | linha da 0016 |
| `lib/tags.ts` (novo) | regra da tag: `extractTags`, `normalizeTag`, `activeTag`, `insertTag`, `TAG_RE` |
| `lib/mentions.ts` | `splitMentions(text, byUsername, { tags })` também separa tags |
| `components/MentionText.tsx` | prop `tags`: tag vira link para `/tag/<tag>` |
| `components/PostCard.tsx` | corpo do post com `tags` |
| `lib/api/tags.ts` (novo) | `suggestTags`, `countTagPosts` |
| `lib/api/posts.ts` | `FeedFilter.tag` em `listFeed` |
| `components/TagSuggestions.tsx` (novo) | caixinha de sugestões de tag |
| `components/feed/Composer.tsx` | `#` ativo → `TagSuggestions` |
| `lib/usePostList.ts` | opção `tag` (busca e tempo real) |
| `app/tag/[name].tsx` (novo) + `app/_layout.tsx` | página da tag |

---

### Task 1: Banco — `extract_tags`, `posts.tags`, `tag_suggestions`

**Files:**
- Create: `supabase/migrations/0016_post_tags.sql`
- Modify: `types/database.ts` (bloco `posts` e bloco `Functions`)
- Modify: `supabase/README.md`

**Interfaces:**
- Produces: coluna `posts.tags text[]`; função `tag_suggestions(p_prefix text, p_limit integer default 5) → (tag text, posts integer)`; tipos `posts.Row.tags: string[]`, `Functions.tag_suggestions`.

- [ ] **Step 1: Migration**

`supabase/migrations/0016_post_tags.sql`:

```sql
-- fellasapp: #tags em posts. Idempotente.
-- A tag mora no texto do post; o banco tira as tags dele (extract_tags) e guarda em posts.tags (gatilho),
-- com índice para a página da tag. tag_suggestions(prefixo) sugere as que já existem no compositor.
-- Regra (igual à de lib/tags.ts): '#' no começo ou depois de algo que não é letra/número/_/#//,
-- 2 a 30 de [[:alnum:]_] (com acento), sem continuar colado; minúsculas e sem repetir.

create or replace function public.extract_tags(p_body text)
returns text[]
language sql
immutable
as $$
  select coalesce(array_agg(distinct lower(m[1])), '{}')
    from regexp_matches(
           coalesce(p_body, ''),
           '(?:^|[^[:alnum:]_#/])#([[:alnum:]_]{2,30})(?![[:alnum:]_])',
           'g'
         ) as m;
$$;

alter table public.posts add column if not exists tags text[] not null default '{}';

create or replace function public.set_post_tags()
returns trigger
language plpgsql
as $$
begin
  new.tags := public.extract_tags(new.body);
  return new;
end;
$$;

drop trigger if exists posts_set_tags on public.posts;
create trigger posts_set_tags
  before insert or update of body on public.posts
  for each row execute function public.set_post_tags();

-- posts que já existiam
update public.posts
   set tags = public.extract_tags(body)
 where tags is distinct from public.extract_tags(body);

create index if not exists posts_tags_idx on public.posts using gin (tags);

-- security invoker: a RLS de posts (só membros) vale aqui também.
create or replace function public.tag_suggestions(p_prefix text, p_limit integer default 5)
returns table (tag text, posts integer)
language sql
stable
security invoker
set search_path = public
as $$
  select t, count(*)::integer
    from public.posts p, unnest(p.tags) as t
   where t like lower(coalesce(p_prefix, '')) || '%'
   group by t
   order by count(*) desc, t
   limit least(greatest(coalesce(p_limit, 5), 1), 20);
$$;

revoke all on function public.tag_suggestions(text, integer) from public;
grant execute on function public.tag_suggestions(text, integer) to authenticated;
```

- [ ] **Step 2: Tipos**

Em `types/database.ts`, no bloco `posts`: em `Row`, depois de `images: string[];`, acrescentar `tags: string[];`; em `Insert` e em `Update`, depois de `images?: string[];`, acrescentar `tags?: string[];`.

No bloco `Functions`, antes de `ideas_feed: {`:

```ts
      tag_suggestions: {
        Args: { p_prefix: string; p_limit?: number };
        Returns: { tag: string; posts: number }[];
      };
```

- [ ] **Step 3: README**

Em `supabase/README.md`, abaixo da linha da `0015_profile_banner.sql`:

```markdown
| `0016_post_tags.sql` | #tags em posts: `posts.tags` (gatilho tira do texto), `tag_suggestions` | página da tag e sugestões de # falham |
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && echo tsc ok`
Expected: `tsc ok`

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0016_post_tags.sql types/database.ts supabase/README.md
git commit -m "Tags: posts.tags tirado do texto pelo banco e tag_suggestions (0016)"
```

---

### Task 2: Regra da tag (`lib/tags.ts`)

**Files:**
- Create: `lib/tags.ts`
- Test: `__tests__/tags.test.ts`

**Interfaces:**
- Produces:
  - `TAG_MIN = 2`, `TAG_MAX = 30`
  - `TAG_RE: RegExp` (global, unicode; grupo 1 = o que vem antes, grupo 2 = a tag sem `#`)
  - `normalizeTag(raw: string): string` (tira `#` do começo, NFC, minúsculas)
  - `extractTags(text: string): string[]`
  - `type ActiveTag = { start: number; query: string }`
  - `activeTag(text: string, cursor: number): ActiveTag | null`
  - `insertTag(text: string, active: ActiveTag, tag: string): string`

- [ ] **Step 1: Teste que falha**

`__tests__/tags.test.ts`:

```ts
import { activeTag, extractTags, insertTag, normalizeTag } from '../lib/tags';

describe('extractTags', () => {
  it('pega tags com acento, número e _, em minúsculas e sem repetir', () => {
    expect(extractTags('#artes_avantajadas e #Ação #ação #2026')).toEqual(['artes_avantajadas', 'ação', '2026']);
  });

  it('tamanho: 1 caractere não é tag; 30 é; 31 não', () => {
    expect(extractTags('#a')).toEqual([]);
    expect(extractTags(`#${'a'.repeat(30)}`)).toEqual(['a'.repeat(30)]);
    expect(extractTags(`#${'a'.repeat(31)}`)).toEqual([]);
  });

  it('# colado em palavra, ## e âncora de link não contam', () => {
    expect(extractTags('ab#cd')).toEqual([]);
    expect(extractTags('##praia')).toEqual([]);
    expect(extractTags('olha https://site.com/#praia')).toEqual([]);
  });

  it('pontuação e emoji colados depois não entram na tag', () => {
    expect(extractTags('#praia! (#sol) #mar🏖️')).toEqual(['praia', 'sol', 'mar']);
  });

  it('tag no começo e no meio', () => {
    expect(extractTags('#bom dia #fellas')).toEqual(['bom', 'fellas']);
  });
});

describe('normalizeTag', () => {
  it('tira o # e põe em minúsculas', () => {
    expect(normalizeTag('#Artes_Avantajadas')).toBe('artes_avantajadas');
    expect(normalizeTag('AÇÃO')).toBe('ação');
  });
});

describe('activeTag / insertTag', () => {
  it('tag sendo digitada antes do cursor', () => {
    expect(activeTag('olha #ar', 8)).toEqual({ start: 5, query: 'ar' });
    expect(activeTag('olha #', 6)).toEqual({ start: 5, query: '' });
  });

  it('depois de espaço ou colada em palavra não está ativa', () => {
    expect(activeTag('olha #arte legal', 16)).toBeNull();
    expect(activeTag('ab#cd', 5)).toBeNull();
  });

  it('completar troca o pedaço e põe espaço', () => {
    const text = 'olha #ar';
    expect(insertTag(text, { start: 5, query: 'ar' }, 'artes_avantajadas')).toBe('olha #artes_avantajadas ');
    expect(insertTag('#ar já', { start: 0, query: 'ar' }, 'arte')).toBe('#arte já');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/tags.test.ts`
Expected: FAIL, "Cannot find module '../lib/tags'".

- [ ] **Step 3: Implementar**

`lib/tags.ts`:

```ts
/**
 * Regra das #tags (igual à do banco, 0016_post_tags.sql): '#' no começo ou depois de algo que não é
 * letra/número/_/#//, 2 a 30 letras (com acento), números ou _, sem continuar colado. Minúsculas.
 */
export const TAG_MIN = 2;
export const TAG_MAX = 30;

export const TAG_RE = /(^|[^\p{L}\p{N}_#/])#([\p{L}\p{N}_]{2,30})(?![\p{L}\p{N}_])/gu;
const TAG_CHARS = /^[\p{L}\p{N}_]*$/u;
const GLUE = /[\p{L}\p{N}_#/]/u;

export function normalizeTag(raw: string): string {
  return raw.replace(/^#/, '').normalize('NFC').toLowerCase();
}

/** Tags do texto, na ordem em que aparecem, sem repetir. */
export function extractTags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.normalize('NFC').matchAll(TAG_RE)) seen.add(normalizeTag(match[2]));
  return [...seen];
}

/** # que está sendo digitado: posição do # e o que veio depois dele até o cursor. */
export type ActiveTag = { start: number; query: string };

/** A # antes do cursor, se a pessoa está no meio de uma tag ("olha #ar|"). */
export function activeTag(text: string, cursor: number): ActiveTag | null {
  const before = text.slice(0, cursor);
  const hash = before.lastIndexOf('#');
  if (hash < 0) return null;
  const query = before.slice(hash + 1);
  if (query.length > TAG_MAX || !TAG_CHARS.test(query)) return null;
  if (hash > 0 && GLUE.test(before[hash - 1])) return null;
  return { start: hash, query };
}

/** Troca o #parcial pela tag escolhida; põe um espaço depois se não houver. */
export function insertTag(text: string, active: ActiveTag, tag: string): string {
  const end = active.start + 1 + active.query.length;
  const rest = text.slice(end);
  return `${text.slice(0, active.start)}#${tag}${rest.startsWith(' ') ? '' : ' '}${rest}`;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/tags.test.ts && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/tags.ts __tests__/tags.test.ts
git commit -m "Tags: regra da #tag no app (igual à do banco)"
```

---

### Task 3: Tag vira link no post

**Files:**
- Modify: `lib/mentions.ts` (`MentionPart`, `splitMentions`)
- Modify: `components/MentionText.tsx` (prop `tags`)
- Modify: `components/PostCard.tsx` (`<MentionText text={post.body} tags />`)
- Test: `__tests__/mentions.test.ts` (acrescentar), `__tests__/mentionUi.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `TAG_RE`, `normalizeTag` (Task 2).
- Produces: `MentionPart<M> = { text: string; member?: M; tag?: string }`; `splitMentions(text, byUsername, opts?: { tags?: boolean })`; `MentionText` prop `tags?: boolean`.

- [ ] **Step 1: Testes que falham**

Em `__tests__/mentions.test.ts`, no fim:

```ts
describe('splitMentions com tags', () => {
  const byUsername = new Map([['ana', { id: 'u1' }]]);

  it('@ e # no mesmo texto', () => {
    expect(splitMentions('oi @ana olha #Arte!', byUsername, { tags: true })).toEqual([
      { text: 'oi ' },
      { text: '@ana', member: { id: 'u1' } },
      { text: ' olha ' },
      { text: '#Arte', tag: 'arte' },
      { text: '!' },
    ]);
  });

  it('sem { tags: true } a # fica texto', () => {
    expect(splitMentions('olha #arte', byUsername)).toEqual([{ text: 'olha #arte' }]);
  });
});
```

(Se o import do topo de `__tests__/mentions.test.ts` não trouxer `splitMentions`, acrescentar ao import de `'../lib/mentions'`.)

Em `__tests__/mentionUi.test.tsx`, dentro de `describe('MentionText', …)`:

```tsx
  it('com tags, #tag vira link para a página da tag (minúsculas, codificada)', async () => {
    await render(<MentionText text="olha #Ação e #arte" tags />);
    await fireEvent.press(screen.getByLabelText('Ver posts com #ação'));
    expect(mockPush).toHaveBeenCalledWith(`/tag/${encodeURIComponent('ação')}`);
    await fireEvent.press(screen.getByLabelText('Ver posts com #arte'));
    expect(mockPush).toHaveBeenCalledWith('/tag/arte');
  });

  it('sem tags (comentário) a # não é link', async () => {
    await render(<MentionText text="olha #arte" />);
    expect(screen.queryByLabelText('Ver posts com #arte')).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/mentions.test.ts __tests__/mentionUi.test.tsx`
Expected: FAIL nos testes novos (tag não separada / sem link).

- [ ] **Step 3: Implementar**

Em `lib/mentions.ts`, acrescentar no topo `import { normalizeTag, TAG_RE } from './tags';` e trocar `MentionPart` + `splitMentions` por:

```ts
export type MentionPart<M> = { text: string; member?: M; tag?: string };

/**
 * Divide o texto em pedaços; @usuario de quem existe vira menção e, com `tags`, #tag vira tag
 * (o resto fica texto comum).
 */
export function splitMentions<M>(
  text: string,
  byUsername: Map<string, M>,
  { tags = false }: { tags?: boolean } = {},
): MentionPart<M>[] {
  const hits: { at: number; length: number; part: MentionPart<M> }[] = [];
  for (const match of text.matchAll(MENTION)) {
    const member = byUsername.get(match[2].toLowerCase());
    if (!member) continue;
    const at = (match.index ?? 0) + match[1].length;
    hits.push({ at, length: 1 + match[2].length, part: { text: `@${match[2]}`, member } });
  }
  if (tags) {
    for (const match of text.matchAll(TAG_RE)) {
      const at = (match.index ?? 0) + match[1].length;
      hits.push({ at, length: 1 + match[2].length, part: { text: `#${match[2]}`, tag: normalizeTag(match[2]) } });
    }
  }
  hits.sort((a, b) => a.at - b.at);
  const parts: MentionPart<M>[] = [];
  let last = 0;
  for (const hit of hits) {
    if (hit.at < last) continue;
    if (hit.at > last) parts.push({ text: text.slice(last, hit.at) });
    parts.push(hit.part);
    last = hit.at + hit.length;
  }
  if (last < text.length) parts.push({ text: text.slice(last) });
  return parts;
}
```

Em `components/MentionText.tsx`:

```tsx
type Props = Omit<TextProps, 'children'> & {
  text: string;
  /** #tag vira link para a página da tag (só em posts). */
  tags?: boolean;
};

/** Texto de post/comentário com @usuario de fella (e, em posts, #tag) destacado em `brand` e tocável. */
export function MentionText({ text, tags = false, ...rest }: Props) {
  const t = useTheme();
  const byUsername = useMembersByUsername();
  return (
    <Text {...rest}>
      {splitMentions(text, byUsername, { tags }).map((part, i) =>
        part.member ? (
          <Text
            key={i}
            {...rest}
            bold
            accessibilityRole="link"
            accessibilityLabel={`Ver perfil de ${part.member.name}`}
            suppressHighlighting
            onPress={() => router.push(`/user/${part.member!.id}`)}
            style={{ color: t.colors.brand }}
          >
            {part.text}
          </Text>
        ) : part.tag ? (
          <Text
            key={i}
            {...rest}
            bold
            accessibilityRole="link"
            accessibilityLabel={`Ver posts com #${part.tag}`}
            suppressHighlighting
            onPress={() => router.push(`/tag/${encodeURIComponent(part.tag!)}`)}
            style={{ color: t.colors.brand }}
          >
            {part.text}
          </Text>
        ) : (
          part.text
        ),
      )}
    </Text>
  );
}
```

Em `components/PostCard.tsx`, trocar `<MentionText text={post.body} />` por `<MentionText text={post.body} tags />`.

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/mentions.test.ts __tests__/mentionUi.test.tsx __tests__/PostCard.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/mentions.ts components/MentionText.tsx components/PostCard.tsx __tests__/mentions.test.ts __tests__/mentionUi.test.tsx
git commit -m "Tags: #tag no post vira link para a página da tag"
```

---

### Task 4: API — sugestões, contagem e filtro por tag

**Files:**
- Create: `lib/api/tags.ts`
- Modify: `lib/api/posts.ts` (`FeedFilter`, `listFeed`)
- Test: `__tests__/tagsApi.test.ts` (novo), `__tests__/posts.test.ts` (acrescentar)

**Interfaces:**
- Consumes: `normalizeTag` (Task 2); função `tag_suggestions` (Task 1).
- Produces:
  - `type TagSuggestion = { tag: string; posts: number }`
  - `suggestTags(prefix: string, limit?: number): Promise<TagSuggestion[]>`
  - `countTagPosts(tag: string): Promise<number>`
  - `FeedFilter.tag?: string` → `listFeed({ tag })` filtra com `contains('tags', [tag])`

- [ ] **Step 1: Testes que falham**

`__tests__/tagsApi.test.ts`:

```ts
const mockRpc = jest.fn();
const mockContains = jest.fn();
let mockCount: { count: number | null; error: unknown } = { count: 3, error: null };
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: () => ({
      select: () => ({
        contains: (...args: unknown[]) => {
          mockContains(...args);
          return Promise.resolve(mockCount);
        },
      }),
    }),
  },
}));

import { countTagPosts, suggestTags } from '../lib/api/tags';

beforeEach(() => {
  jest.clearAllMocks();
  mockCount = { count: 3, error: null };
});

describe('suggestTags', () => {
  it('chama a função com o prefixo normalizado', async () => {
    mockRpc.mockResolvedValue({ data: [{ tag: 'artes', posts: 12 }], error: null });
    await expect(suggestTags('#Ar')).resolves.toEqual([{ tag: 'artes', posts: 12 }]);
    expect(mockRpc).toHaveBeenCalledWith('tag_suggestions', { p_prefix: 'ar', p_limit: 5 });
  });

  it('erro sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'x' } });
    await expect(suggestTags('ar')).rejects.toMatchObject({ message: 'x' });
  });
});

describe('countTagPosts', () => {
  it('conta posts que têm a tag', async () => {
    await expect(countTagPosts('artes')).resolves.toBe(3);
    expect(mockContains).toHaveBeenCalledWith('tags', ['artes']);
  });

  it('sem contagem vira 0', async () => {
    mockCount = { count: null, error: null };
    await expect(countTagPosts('artes')).resolves.toBe(0);
  });
});
```

Em `__tests__/posts.test.ts`: no mock do supabase, na lista de métodos do builder
`['select', 'insert', 'upsert', 'delete', 'eq', 'in', 'lt', 'not', 'order', 'limit']`, acrescentar `'contains'`. E no fim do arquivo:

```ts
describe('listFeed por tag', () => {
  it('filtra os posts que têm a tag', async () => {
    mockResults['posts.select'] = { data: [], error: null };
    await listFeed({ tag: 'artes' });
    expect(mockCalls).toContainEqual({ table: 'posts', op: 'contains', args: ['tags', ['artes']] });
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/tagsApi.test.ts __tests__/posts.test.ts`
Expected: FAIL ("Cannot find module '../lib/api/tags'" e o filtro ausente).

- [ ] **Step 3: Implementar**

`lib/api/tags.ts`:

```ts
import type { Database } from '../../types/database';
import { supabase } from '../supabase';
import { normalizeTag } from '../tags';

export type TagSuggestion = Database['public']['Functions']['tag_suggestions']['Returns'][number];

/** Tags que já existem começando com o que foi digitado (mais usadas primeiro). */
export async function suggestTags(prefix: string, limit = 5): Promise<TagSuggestion[]> {
  const { data, error } = await supabase.rpc('tag_suggestions', { p_prefix: normalizeTag(prefix), p_limit: limit });
  if (error) throw error;
  return (data ?? []) as TagSuggestion[];
}

/** Quantos posts têm a tag (cabeçalho da página da tag). */
export async function countTagPosts(tag: string): Promise<number> {
  const { count, error } = await supabase
    .from('posts')
    .select('id', { count: 'exact', head: true })
    .contains('tags', [tag]);
  if (error) throw error;
  return count ?? 0;
}
```

Em `lib/api/posts.ts`, no tipo `FeedFilter`, acrescentar:

```ts
  /** Só posts com esta #tag (página da tag), já em minúsculas. */
  tag?: string;
```

E em `listFeed`, trocar a assinatura e acrescentar o filtro:

```ts
export async function listFeed(
  { cursor, authorId, photosOnly, tag }: { cursor?: string | null } & FeedFilter = {},
): Promise<FeedPage> {
```

logo depois de `if (photosOnly) query = query.not('image_url', 'is', null);`:

```ts
  if (tag) query = query.contains('tags', [tag]);
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/tagsApi.test.ts __tests__/posts.test.ts && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/api/tags.ts lib/api/posts.ts __tests__/tagsApi.test.ts __tests__/posts.test.ts
git commit -m "Tags: sugestões, contagem e feed filtrado por tag"
```

---

### Task 5: Sugestões de tag no compositor

Antes da UI: skill `impeccable` (contexto já carregado nesta sessão; ler `reference/craft-floor.md` se ainda não leu nesta sessão).

**Files:**
- Create: `components/TagSuggestions.tsx`
- Modify: `components/feed/Composer.tsx`
- Test: `__tests__/tagSuggestions.test.tsx` (novo), `__tests__/composer.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `suggestTags`, `TagSuggestion` (Task 4); `activeTag`, `insertTag` (Task 2).
- Produces: `TagSuggestions({ query: string; onPick: (tag: string) => void })`; `TAG_SUGGEST_DEBOUNCE_MS = 200` exportado de `components/TagSuggestions.tsx`.

- [ ] **Step 1: Testes que falham**

`__tests__/tagSuggestions.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSuggest = jest.fn();
jest.mock('../lib/api/tags', () => ({ suggestTags: (q: string) => mockSuggest(q) }));

import { TagSuggestions } from '../components/TagSuggestions';

beforeEach(() => mockSuggest.mockReset());

describe('TagSuggestions', () => {
  it('mostra as tags com o número de posts e escolher devolve a tag', async () => {
    mockSuggest.mockResolvedValue([
      { tag: 'artes_avantajadas', posts: 12 },
      { tag: 'arte', posts: 1 },
    ]);
    const onPick = jest.fn();
    await render(<TagSuggestions query="ar" onPick={onPick} />);
    expect(await screen.findByText('#artes_avantajadas')).toBeTruthy();
    expect(screen.getByText('12 posts')).toBeTruthy();
    expect(screen.getByText('1 post')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Usar #arte'));
    expect(onPick).toHaveBeenCalledWith('arte');
  });

  it('nada encontrado ou erro: não mostra nada', async () => {
    mockSuggest.mockRejectedValue(new Error('caiu'));
    await render(<TagSuggestions query="zz" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalled());
    expect(screen.queryByLabelText('Tags pra usar')).toBeNull();
  });

  it('resposta atrasada da busca antiga não sobrescreve a nova', async () => {
    let slow: (v: unknown) => void = () => {};
    mockSuggest.mockImplementationOnce(() => new Promise((r) => (slow = r)));
    mockSuggest.mockResolvedValueOnce([{ tag: 'arte', posts: 2 }]);
    const view = await render(<TagSuggestions query="ar" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith('ar'));
    await view.rerender(<TagSuggestions query="art" onPick={() => {}} />);
    expect(await screen.findByText('#arte')).toBeTruthy();
    slow([{ tag: 'velha', posts: 9 }]);
    await waitFor(() => expect(screen.queryByText('#velha')).toBeNull());
    expect(screen.getByText('#arte')).toBeTruthy();
  });
});
```

Em `__tests__/composer.test.tsx`: no topo, depois do mock de `../lib/api/posts`:

```ts
const mockSuggestTags = jest.fn();
jest.mock('../lib/api/tags', () => ({ suggestTags: (q: string) => mockSuggestTags(q) }));
```

e dentro de `describe('Composer', …)`:

```tsx
  it('#: sugere tags enquanto digita e escolher completa a tag', async () => {
    mockSuggestTags.mockResolvedValue([{ tag: 'artes_avantajadas', posts: 3 }]);
    await render(<Composer variant="inline" />);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'olha #ar');
    await fireEvent.press(await screen.findByLabelText('Usar #artes_avantajadas'));
    expect(screen.getByDisplayValue('olha #artes_avantajadas ')).toBeTruthy();
    expect(mockSuggestTags).toHaveBeenCalledWith('ar');
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/tagSuggestions.test.tsx __tests__/composer.test.tsx`
Expected: FAIL ("Cannot find module '../components/TagSuggestions'"; no compositor, nenhuma sugestão aparece).

- [ ] **Step 3: Implementar `TagSuggestions`**

`components/TagSuggestions.tsx`:

```tsx
import { useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';

import { suggestTags, type TagSuggestion } from '../lib/api/tags';
import { useTheme } from '../lib/theme';
import { interactiveStyle, Text } from './ui';

/** Espera a pessoa parar de digitar um instante antes de perguntar ao banco. */
export const TAG_SUGGEST_DEBOUNCE_MS = 200;

type Props = { query: string; onPick: (tag: string) => void };

/** Tags que já existem para completar enquanto a pessoa digita "#ar…" (até 5), com quantos posts têm. */
export function TagSuggestions({ query, onPick }: Props) {
  const t = useTheme();
  const [options, setOptions] = useState<TagSuggestion[]>([]);

  useEffect(() => {
    let alive = true;
    const timer = setTimeout(() => {
      suggestTags(query)
        .then((list) => alive && setOptions(list))
        .catch(() => alive && setOptions([]));
    }, TAG_SUGGEST_DEBOUNCE_MS);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [query]);

  if (options.length === 0) return null;
  return (
    <View
      accessibilityLabel="Tags pra usar"
      style={{
        borderWidth: t.borders.hairline,
        borderColor: t.colors.border,
        borderRadius: t.radii.md,
        backgroundColor: t.colors.surface,
        overflow: 'hidden',
      }}
    >
      {options.map((o) => (
        <Pressable
          key={o.tag}
          accessibilityRole="button"
          accessibilityLabel={`Usar #${o.tag}`}
          onPress={() => onPick(o.tag)}
          style={(state) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.md,
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.md,
            ...interactiveStyle(t, state),
          })}
        >
          <Text variant="small" bold numberOfLines={1} style={{ flexShrink: 1 }}>
            #{o.tag}
          </Text>
          <Text variant="small" tone="muted" numberOfLines={1}>
            {o.posts === 1 ? '1 post' : `${o.posts} posts`}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}
```

- [ ] **Step 4: Ligar no compositor**

Em `components/feed/Composer.tsx`:
- imports: `import { activeTag, insertTag } from '../../lib/tags';` e `import { TagSuggestions } from '../TagSuggestions';`
- depois de `const mention = activeMention(body, Math.min(cursor ?? body.length, body.length));`:

```ts
  const tag = mention ? null : activeTag(body, Math.min(cursor ?? body.length, body.length));
```

- trocar o bloco `{mention ? ( <MentionSuggestions … /> ) : null}` por:

```tsx
        {mention ? (
          <MentionSuggestions
            query={mention.query}
            onPick={(username) => {
              setDraft((d) => ({ ...d, body: insertMention(d.body, mention, username) }));
              setCursor(null);
              input.current?.focus();
            }}
          />
        ) : tag ? (
          <TagSuggestions
            query={tag.query}
            onPick={(name) => {
              setDraft((d) => ({ ...d, body: insertTag(d.body, tag, name) }));
              setCursor(null);
              input.current?.focus();
            }}
          />
        ) : null}
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest __tests__/tagSuggestions.test.tsx __tests__/composer.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 6: Commit**

```bash
git add components/TagSuggestions.tsx components/feed/Composer.tsx __tests__/tagSuggestions.test.tsx __tests__/composer.test.tsx
git commit -m "Tags: sugestões de #tag no compositor"
```

---

### Task 6: `usePostList({ tag })`

**Files:**
- Modify: `lib/usePostList.ts`
- Test: `__tests__/usePostListLive.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `FeedFilter.tag` (Task 4); `extractTags` (Task 2).
- Produces: `usePostList({ tag })` — busca com `listFeed({ …, tag })`; ao vivo, post novo só entra em `newPosts` se `extractTags(row.body)` contém a tag.

- [ ] **Step 1: Teste que falha**

No fim de `__tests__/usePostListLive.test.tsx`:

```tsx
describe('usePostList por tag', () => {
  it('busca filtrando pela tag', async () => {
    await feed({ tag: 'artes' });
    expect(mockListFeed).toHaveBeenCalledWith(expect.objectContaining({ tag: 'artes' }));
  });

  it('post novo ao vivo só conta se tiver a tag', async () => {
    const { result } = await feed({ tag: 'artes' });
    await act(async () => {
      change('posts', 'INSERT', { id: 'p8', author_id: 'bia', body: 'sem tag nenhuma' });
      change('posts', 'INSERT', { id: 'p9', author_id: 'bia', body: 'olha #Artes' });
    });
    expect(result.current.newPosts).toBe(1);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/usePostListLive.test.tsx`
Expected: FAIL (a tag não é repassada; os dois posts contam).

- [ ] **Step 3: Implementar**

Em `lib/usePostList.ts`:
- import: `import { extractTags } from './tags';`
- assinatura: `export function usePostList({ authorId, photosOnly, enabled = true, pinnedId, tag }: Options = {}) {`
- em `load`: trocar `listFeed({ cursor: reset ? null : from, authorId, photosOnly })` por `listFeed({ cursor: reset ? null : from, authorId, photosOnly, tag })` e acrescentar `tag` às dependências do `useCallback` de `load` (`[authorId, photosOnly, pinnedId, tag]`).
- no efeito ao vivo: em `belongsHere`, acrescentar a condição

```ts
      (!tag || extractTags(String(row.body ?? '')).includes(tag)) &&
```

  (antes da condição de `photosOnly`); em `resync`, trocar `listFeed({ cursor: null, authorId, photosOnly })` por `listFeed({ cursor: null, authorId, photosOnly, tag })`; e acrescentar `tag` às dependências do efeito (`[enabled, loaded, authorId, photosOnly, tag, refetch]`).

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/usePostListLive.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/usePostList.ts __tests__/usePostListLive.test.tsx
git commit -m "Tags: lista de posts filtrada por tag (busca e tempo real)"
```

---

### Task 7: Página da tag

**Files:**
- Create: `app/tag/[name].tsx`
- Modify: `app/_layout.tsx`
- Test: `__tests__/tagScreen.test.tsx` (novo)

**Interfaces:**
- Consumes: `usePostList({ tag })` (Task 6); `countTagPosts` (Task 4); `normalizeTag` (Task 2); `PostCard`, `removePost`, `stackHeader`, `useSession`.
- Produces: rota `/tag/[name]`.

- [ ] **Step 1: Teste que falha**

`__tests__/tagScreen.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPush = jest.fn();
let mockName = 'Artes';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
  useLocalSearchParams: () => ({ name: mockName }),
  Stack: { Screen: () => null },
  router: { push: jest.fn() },
}));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
const mockCount = jest.fn();
jest.mock('../lib/api/tags', () => ({ countTagPosts: (tag: string) => mockCount(tag) }));
const mockUsePostList = jest.fn();
jest.mock('../lib/usePostList', () => ({
  usePostList: (opts: unknown) => mockUsePostList(opts),
  removePost: jest.fn(),
}));

import TagScreen from '../app/tag/[name]';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TagScreen />
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
  body: 'olha #artes',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-06T12:00:00Z',
  author: { id: 'u2', username: 'bia', display_name: 'Bia', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockName = 'Artes';
  mockCount.mockResolvedValue(2);
  mockUsePostList.mockReturnValue(list({ posts: [post] }));
});

describe('Página da tag', () => {
  it('normaliza o nome, lista os posts e mostra a contagem', async () => {
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ tag: 'artes' });
    expect(mockCount).toHaveBeenCalledWith('artes');
    expect(await screen.findByText('2 posts')).toBeTruthy();
    expect(screen.getByText('Bia')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Abrir post de Bia'));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
  });

  it('nome com acento vindo da URL', async () => {
    mockName = 'AÇÃO';
    await open();
    expect(mockUsePostList).toHaveBeenCalledWith({ tag: 'ação' });
  });

  it('vazio convida a usar a tag', async () => {
    mockUsePostList.mockReturnValue(list());
    mockCount.mockResolvedValue(0);
    await open();
    expect(screen.getByText('Ninguém usou #artes ainda.')).toBeTruthy();
  });

  it('erro oferece tentar de novo', async () => {
    const failed = list({ error: 'caiu' });
    mockUsePostList.mockReturnValue(failed);
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(failed.reload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/tagScreen.test.tsx`
Expected: FAIL, "Cannot find module '../app/tag/[name]'".

- [ ] **Step 3: Implementar**

`app/tag/[name].tsx`:

```tsx
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList } from 'react-native';

import { PostCard } from '../../components/PostCard';
import { stackHeader } from '../../components/profile/headerOptions';
import { Divider, EmptyState, Screen, Text } from '../../components/ui';
import { countTagPosts } from '../../lib/api/tags';
import { useSession } from '../../lib/auth/SessionProvider';
import { normalizeTag } from '../../lib/tags';
import { useTheme } from '../../lib/theme';
import { removePost, usePostList } from '../../lib/usePostList';

/** Posts com uma #tag, no formato do feed (mais novo primeiro). */
export default function TagScreen() {
  const t = useTheme();
  const router = useRouter();
  const { name } = useLocalSearchParams<{ name: string }>();
  const tag = normalizeTag(String(name ?? ''));
  const me = useSession().session?.user.id;
  const { posts, loading, refreshing, error, refresh, reload, loadMore, like, react } = usePostList({ tag });
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    setCount(null);
    // a contagem é extra: falhou, o cabeçalho fica sem ela
    countTagPosts(tag)
      .then((n) => alive && setCount(n))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tag]);

  return (
    <>
      <Stack.Screen options={stackHeader(t, `#${tag}`)} />
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
          ListEmptyComponent={
            loading ? (
              <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando posts" />
            ) : error ? (
              <EmptyState
                title="Não deu pra carregar essa tag"
                message="Deu ruim na conexão. Confere a internet e tenta de novo."
                actionLabel="Tentar de novo"
                onAction={reload}
              />
            ) : (
              <EmptyState title={`Ninguém usou #${tag} ainda.`} message="Posta algo com ela." />
            )
          }
        />
      </Screen>
    </>
  );
}
```

Em `app/_layout.tsx`, depois da linha da rota `user/[id]`:

```tsx
            <Stack.Screen name="tag/[name]" options={{ headerShown: true, title: 'Tag' }} />
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/tagScreen.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add "app/tag/[name].tsx" app/_layout.tsx __tests__/tagScreen.test.tsx
git commit -m "Tags: página da tag"
```

---

### Task 8: Verificação final

- [ ] **Step 1: Suíte inteira**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem saída; todas as suítes passam.

- [ ] **Step 2: Passada visual (Impeccable, uma rodada)**

Com `EXPO_PUBLIC_DEV_FAKE_LOGIN=1 npx expo start --web --port 8099`, abrir `/tag/artes` (celular via moldura de 390px e computador): cabeçalho `#artes`, estado vazio/erro (sem banco no login falso, espere erro), e no compositor do feed digitar `olha #ar` para ver que a caixinha não quebra o layout (sem banco, ela não aparece — conferir que nada pisca). Depois: parar o servidor e `git checkout -- tsconfig.json` se o Expo mexer nele.

- [ ] **Step 3: Avisar o Juan**

A migration `0016_post_tags.sql` precisa ser aplicada pelo Juan:
`! export $(grep '^SUPABASE_ACCESS_TOKEN=' .env | xargs) && npx supabase db query --linked -f supabase/migrations/0016_post_tags.sql`
