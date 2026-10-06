# Stories com Cloudinary — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Trazer os stories da branch `feat/stories` para a `main` atual trocando o Cloudflare R2 + Worker pelo Cloudinary (plano grátis), com uma Edge Function do Supabase que assina o envio, apaga o arquivo do dono e limpa de hora em hora o que passou de 24 h.

**Architecture:** Merge da `feat/stories` numa branch nova a partir da `main` (só 3 conflitos). Depois: regras puras + handler da Edge Function `stories-media` (testados no Jest com dependências injetadas, como o Worker era), migração `0021_stories.sql` adaptada da `0011` (coluna `media_id` + `pg_cron`/`pg_net` chamando a limpeza), e o app passa a enviar em duas etapas (assinar → Cloudinary) e a montar os endereços de entrega em `lib/cloudinary.ts`. Sai o Worker.

**Tech Stack:** Expo SDK 57, expo-router, expo-video, React Native / react-native-web, TypeScript, jest-expo + @testing-library/react-native v14 (`await render`, `await fireEvent.*`), Supabase (Postgres, RLS, pg_cron, pg_net, Vault, Edge Functions em Deno), Cloudinary (Upload API assinada, Admin API).

**Spec:** `docs/superpowers/specs/2026-10-06-stories-cloudinary-design.md` (e, para telas e regras que não mudam, `docs/superpowers/specs/2026-10-04-stories-design.md`).

## Global Constraints

- Texto em pt-BR no tom do `PRODUCT.md`; tokens de `lib/theme.ts` e primitivos de `components/ui` (CLAUDE.md); Impeccable (modo Operate).
- Cloudinary: cloud name `slxposvw` (padrão de `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`), API key `968516645973728`; **a API secret nunca entra em arquivo, commit ou chat** — só nos segredos da função, gravada pelo Juan.
- `media_id` = `stories/` + 64 hex (`^stories/[0-9a-f]{64}$`).
- Versão reduzida: vídeo `c_limit,w_1280,h_1280,q_auto,f_mp4`; foto `c_limit,w_1920,h_1920,q_auto,f_jpg` — **iguais** na função (`eager`) e no app (entrega); um teste confere.
- Foto 5000 ms; vídeo 1–15000 ms; tudo some em 24 h.
- Mensagens: 401 "Sua sessão expirou. Entra de novo."; 403 "Só fellas podem postar story."; sem rede "Sem conexão. Confere a internet e tenta de novo."; cota "Os stories bateram o limite do mês. Volta dia 1."; resto "Não rolou enviar. Tenta de novo.".
- Segredo do cron: gerado por comando e guardado no Vault (`stories_cron_secret`) e nos segredos da função (`STORIES_CRON_SECRET`); nunca na migração.
- Branch `feat/stories-cloudinary` (a partir da `main`). `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa; um commit por tarefa (a Task 1 é um commit de merge).

## Review Focus

1. **Cloudinary recusando o envio por cota/limite**: a pessoa vê "Os stories bateram o limite do mês. Volta dia 1." e o resto do app segue. → teste na Task 5.
2. **Assinatura vencida** (Cloudinary responde "Stale request"): pede outra assinatura e tenta uma vez, sem mostrar erro. → teste na Task 5.
3. **Versão reduzida do vídeo ainda processando** (erro ao tocar): toca o original, sem travar o relógio do story. → teste na Task 6.
4. **Chamada da limpeza sem o segredo certo**, ou com o segredo vazio na função: 401 e nada apagado. → teste na Task 3.
5. **Apagar story de outra pessoa** pela função: 403 e o arquivo dela continua no Cloudinary. → teste na Task 3.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| (merge da `feat/stories`) | telas, player, faixa, API, migração 0011, testes — base do trabalho |
| `lib/realtime.ts`, `__tests__/realtime.test.tsx`, `app/(tabs)/feed.tsx` | conflitos do merge |
| `supabase/functions/stories-media/rules.ts` (novo) | regras puras: nome, assinatura, transformações, endereços da API, 24 h, CORS |
| `supabase/functions/stories-media/handler.ts` (novo) | `/sign`, `/delete`, `/cleanup` com dependências injetadas |
| `supabase/functions/stories-media/index.ts` (novo) | `Deno.serve` ligando o handler ao ambiente |
| `supabase/migrations/0021_stories.sql` (a 0011 renomeada e adaptada) | tabelas, RLS, notificação, `media_id`, dois `cron` |
| `types/database.ts` | `stories.media_id` |
| `lib/cloudinary.ts` (novo) | endereços de entrega (reduzida e original) |
| `lib/storiesConfig.ts` | endereço da função (no lugar do Worker) |
| `lib/api/stories.ts`, `components/stories/StoryComposer.tsx` | envio em duas etapas, `mediaId`, apagar pela função |
| `components/stories/StoryVideo.tsx`, `components/stories/StoryViewer.tsx` | volta para o original quando a reduzida falha |
| `workers/stories/**`, `__tests__/storiesWorker*.test.ts` | removidos |
| `DESIGN.md`, `supabase/README.md`, `.env.example` | registro |

---

### Task 1: Trazer a `feat/stories` para a `main` atual

**Files:**
- Merge: `feat/stories` → `feat/stories-cloudinary`
- Modify (conflitos): `lib/realtime.ts`, `__tests__/realtime.test.tsx`, `app/(tabs)/feed.tsx`
- Rename: `supabase/migrations/0011_stories.sql` → `supabase/migrations/0021_stories.sql`

**Interfaces:**
- Produces: tudo da branch na `main` atual (componentes `components/stories/*`, `lib/api/stories.ts`, `lib/storyPlayer.ts`, `lib/storyViewerStore.ts`, `lib/useStories.ts`, `lib/videoDuration.ts`, `lib/storiesConfig.ts`, `workers/stories/*`, testes), ainda com o Worker.

- [ ] **Step 1: Branch e merge**

```bash
git checkout -b feat/stories-cloudinary main
git merge --no-ff feat/stories
```
Expected: `CONFLICT (content)` em `__tests__/realtime.test.tsx`, `app/(tabs)/feed.tsx`, `lib/realtime.ts` (e nada mais).

- [ ] **Step 2: Resolver `lib/realtime.ts`** — os dois lados somam:

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
  'stories',
  'story_reactions',
] as const;
```

Em `actorOf`, o primeiro grupo de `case` fica:

```ts
    case 'posts':
    case 'comments':
    case 'ideas':
    case 'stories':
      return str(row.author_id);
```

Em `affectsNotifications`, as duas regras ficam, nesta ordem:

```ts
  // mural de ideias não gera notificação
  if (event.table === 'ideas' || event.table === 'idea_votes') return false;
  if (event.table === 'stories') return false; // story novo aparece na faixa, não vira notificação
```

O comentário de `actorOf` fica o da `main` ("…autor do post/comentário/ideia, dono da curtida/reação/voto…") acrescentando "story" depois de "ideia".

- [ ] **Step 3: Resolver `__tests__/realtime.test.tsx`** — manter o import da `main` (com `actorOf`) e, dentro de `describe('affectsNotifications', …)`, os dois testes (o das ideias da `main` e o `'story novo não é notificação; reação de outra pessoa no story é'` da branch), seguidos do `describe('actorOf', …)` da `main`, acrescentando nele:

```ts
  it('story: o autor', () => {
    expect(actorOf('stories', { author_id: 'u3' })).toBe('u3');
  });
```

- [ ] **Step 4: Resolver `app/(tabs)/feed.tsx`** — manter a versão da `main` e acrescentar a faixa como a branch fazia:
  - import: `import { StoriesBar } from '../../components/stories/StoriesBar';` (junto dos outros de `components/`);
  - celular (bloco `tier === 'compact'`): logo depois do `<View style={{ flexDirection: 'row', … justifyContent: 'space-between' }}>…</View>` do logo/botões, ainda dentro do bloco com `paddingHorizontal: t.layout.gutter`:

```tsx
                <View style={{ marginHorizontal: -t.layout.gutter }}>
                  <StoriesBar />
                </View>
```
  - computador (bloco do `else`): antes de `<Composer variant="inline" />`:

```tsx
                <StoriesBar />
                <Divider />
```

- [ ] **Step 5: Renomear a migração** (a 0011 nunca foi aplicada; as da `main` já vão até a 0020)

```bash
git mv supabase/migrations/0011_stories.sql supabase/migrations/0021_stories.sql
```

- [ ] **Step 6: Dependências e verificação**

Run: `npm install && npx tsc --noEmit && npm test`
Expected: `npm install` instala o `expo-video` que a branch acrescentou; tsc sem saída; todas as suítes passam (as da branch inclusive). Se algo da `main` posterior quebrar um componente da branch (token renomeado, prop nova), ajustar o componente da branch ao que a `main` tem hoje e registrar a decisão.

- [ ] **Step 7: Commit do merge**

```bash
git add -A
git commit --no-edit
```

---

### Task 2: Regras puras da Edge Function

**Files:**
- Create: `supabase/functions/stories-media/rules.ts`
- Test: `__tests__/storiesMediaRules.test.ts`

**Interfaces:**
- Produces (`supabase/functions/stories-media/rules.ts`):
  - `type Kind = 'photo' | 'video'`; `type ResourceType = 'image' | 'video'`
  - `MEDIA_ID_RE: RegExp`; `TTL_MS = 86_400_000`
  - `TRANSFORMATIONS: Record<Kind, string>` (`video: 'c_limit,w_1280,h_1280,q_auto,f_mp4'`, `photo: 'c_limit,w_1920,h_1920,q_auto,f_jpg'`)
  - `resourceType(kind: Kind): ResourceType`
  - `randomMediaId(uuid: () => string): string`
  - `stringToSign(params: Record<string, string>): string`
  - `isExpired(createdAt: string, now: Date): boolean`
  - `uploadUrl(cloud: string, kind: Kind): string`; `listUrl(cloud: string, type: ResourceType, cursor?: string): string`; `deleteUrl(cloud: string, type: ResourceType, ids: string[]): string`
  - `basicAuth(key: string, secret: string): string`
  - `allowedOrigin(origin: string | null): string | null`

- [ ] **Step 1: Teste que falha** — `__tests__/storiesMediaRules.test.ts`:

```ts
import {
  allowedOrigin,
  basicAuth,
  deleteUrl,
  isExpired,
  listUrl,
  MEDIA_ID_RE,
  randomMediaId,
  resourceType,
  stringToSign,
  TRANSFORMATIONS,
  uploadUrl,
} from '../supabase/functions/stories-media/rules';

describe('regras dos stories (Cloudinary)', () => {
  it('nome aleatório: stories/ + 64 hex', () => {
    const id = randomMediaId(() => '11111111-2222-3333-4444-555555555555');
    expect(id).toBe(`stories/${'11111111222233334444555555555555'.repeat(2)}`);
    expect(MEDIA_ID_RE.test(id)).toBe(true);
    expect(MEDIA_ID_RE.test('stories/abc')).toBe(false);
    expect(MEDIA_ID_RE.test(`outra/${'a'.repeat(64)}`)).toBe(false);
  });

  it('texto assinado igual ao exemplo da documentação do Cloudinary (ordem alfabética, sem api_key/file)', () => {
    const params = {
      timestamp: '1315060510',
      public_id: 'sample_image',
      eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop',
      api_key: '123',
      file: 'x',
    };
    expect(stringToSign(params)).toBe('eager=w_400,h_300,c_pad|w_260,h_200,c_crop&public_id=sample_image&timestamp=1315060510');
  });

  it('transformações e tipo por kind', () => {
    expect(TRANSFORMATIONS.video).toBe('c_limit,w_1280,h_1280,q_auto,f_mp4');
    expect(TRANSFORMATIONS.photo).toBe('c_limit,w_1920,h_1920,q_auto,f_jpg');
    expect(resourceType('video')).toBe('video');
    expect(resourceType('photo')).toBe('image');
  });

  it('passou de 24 h', () => {
    const now = new Date('2026-10-06T12:00:00Z');
    expect(isExpired('2026-10-05T11:59:00Z', now)).toBe(true);
    expect(isExpired('2026-10-05T12:01:00Z', now)).toBe(false);
  });

  it('endereços da API', () => {
    expect(uploadUrl('slxposvw', 'video')).toBe('https://api.cloudinary.com/v1_1/slxposvw/video/upload');
    expect(uploadUrl('slxposvw', 'photo')).toBe('https://api.cloudinary.com/v1_1/slxposvw/image/upload');
    expect(listUrl('c', 'image')).toBe('https://api.cloudinary.com/v1_1/c/resources/image/upload?prefix=stories%2F&max_results=500');
    expect(listUrl('c', 'video', 'abc=')).toBe(
      'https://api.cloudinary.com/v1_1/c/resources/video/upload?prefix=stories%2F&max_results=500&next_cursor=abc%3D',
    );
    expect(deleteUrl('c', 'image', ['stories/a', 'stories/b'])).toBe(
      'https://api.cloudinary.com/v1_1/c/resources/image/upload?public_ids%5B%5D=stories%2Fa&public_ids%5B%5D=stories%2Fb',
    );
    expect(basicAuth('k', 's')).toBe(`Basic ${btoa('k:s')}`);
  });

  it('CORS: o site e o localhost', () => {
    expect(allowedOrigin('https://fellasapp.pages.dev')).toBe('https://fellasapp.pages.dev');
    expect(allowedOrigin('http://localhost:8099')).toBe('http://localhost:8099');
    expect(allowedOrigin('https://outro.site')).toBeNull();
    expect(allowedOrigin(null)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/storiesMediaRules.test.ts`
Expected: FAIL (`Cannot find module '../supabase/functions/stories-media/rules'`).

- [ ] **Step 3: `supabase/functions/stories-media/rules.ts`**

```ts
/**
 * Regras puras da função dos stories (Cloudinary). Sem Deno nem rede: o handler (Deno) e o Jest do app
 * usam o mesmo arquivo.
 */
export type Kind = 'photo' | 'video';
export type ResourceType = 'image' | 'video';

/** Nome do arquivo no Cloudinary: pasta stories/ + 64 hex aleatórios (o endereço não se adivinha). */
export const MEDIA_ID_RE = /^stories\/[0-9a-f]{64}$/;
export const TTL_MS = 24 * 60 * 60 * 1000;

/** Versão reduzida pedida no envio (eager) e usada na entrega (lib/cloudinary.ts tem a mesma). */
export const TRANSFORMATIONS: Record<Kind, string> = {
  video: 'c_limit,w_1280,h_1280,q_auto,f_mp4',
  photo: 'c_limit,w_1920,h_1920,q_auto,f_jpg',
};

const API = 'https://api.cloudinary.com/v1_1';
/** Parâmetros que o Cloudinary não inclui na assinatura. */
const UNSIGNED = new Set(['file', 'cloud_name', 'resource_type', 'api_key']);

export const resourceType = (kind: Kind): ResourceType => (kind === 'video' ? 'video' : 'image');

export function randomMediaId(uuid: () => string): string {
  return `stories/${(uuid() + uuid()).replace(/-/g, '')}`;
}

/** O que vai para o SHA-1 (antes da secret): parâmetros em ordem alfabética, "a=1&b=2". */
export function stringToSign(params: Record<string, string>): string {
  return Object.keys(params)
    .filter((k) => !UNSIGNED.has(k) && params[k] !== '')
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
}

export function isExpired(createdAt: string, now: Date): boolean {
  return now.getTime() - new Date(createdAt).getTime() > TTL_MS;
}

export const uploadUrl = (cloud: string, kind: Kind) => `${API}/${cloud}/${resourceType(kind)}/upload`;

export function listUrl(cloud: string, type: ResourceType, cursor?: string): string {
  const next = cursor ? `&next_cursor=${encodeURIComponent(cursor)}` : '';
  return `${API}/${cloud}/resources/${type}/upload?prefix=stories%2F&max_results=500${next}`;
}

export function deleteUrl(cloud: string, type: ResourceType, ids: string[]): string {
  const query = ids.map((id) => `public_ids%5B%5D=${encodeURIComponent(id)}`).join('&');
  return `${API}/${cloud}/resources/${type}/upload?${query}`;
}

export const basicAuth = (key: string, secret: string) => `Basic ${btoa(`${key}:${secret}`)}`;

export function allowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (origin === 'https://fellasapp.pages.dev') return origin;
  return /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/storiesMediaRules.test.ts && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 5: Commit**

```bash
git add supabase/functions/stories-media/rules.ts __tests__/storiesMediaRules.test.ts
git commit -m "Stories: regras da função do Cloudinary (nome, assinatura, transformações, 24 h)"
```

---

### Task 3: Edge Function `stories-media` (assinar, apagar, limpar)

**Files:**
- Create: `supabase/functions/stories-media/handler.ts`, `supabase/functions/stories-media/index.ts`
- Test: `__tests__/storiesMediaHandler.test.ts`

**Interfaces:**
- Consumes: tudo de `rules.ts` (Task 2).
- Produces:
  - `type Env = { SUPABASE_URL: string; SUPABASE_ANON_KEY: string; CLOUDINARY_CLOUD_NAME: string; CLOUDINARY_API_KEY: string; CLOUDINARY_API_SECRET: string; STORIES_CRON_SECRET: string }`
  - `type Deps = { fetch: typeof fetch; uuid: () => string; sha1Hex: (text: string) => Promise<string>; now: () => Date }`
  - `handle(req: Request, env: Env, deps?: Deps): Promise<Response>`
  - Rotas (sufixo do caminho): `POST …/sign` `{ kind }` → 200 `{ uploadUrl, fields: { api_key, timestamp, signature, public_id, eager, eager_async } }`; `POST …/delete` `{ storyId }` → 200 `{ ok: true }`; `POST …/cleanup` (cabeçalho `x-cron-secret`) → 200 `{ deleted: number }`.

- [ ] **Step 1: Teste que falha** — `__tests__/storiesMediaHandler.test.ts`:

```ts
// o tsconfig não carrega os tipos do Node (só jest): declara o pouco que o teste usa
declare const require: (id: string) => {
  createHash: (alg: string) => { update: (s: string) => { digest: (enc: string) => string } };
};
const { createHash } = require('crypto');

import { handle, type Deps, type Env } from '../supabase/functions/stories-media/handler';

const env: Env = {
  SUPABASE_URL: 'https://sb.test',
  SUPABASE_ANON_KEY: 'anon',
  CLOUDINARY_CLOUD_NAME: 'cloud',
  CLOUDINARY_API_KEY: 'key',
  CLOUDINARY_API_SECRET: 'secret',
  STORIES_CRON_SECRET: 'cron',
};
const sha1Hex = async (s: string) => createHash('sha1').update(s).digest('hex');
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });
const deps = (fetch: jest.Mock): Deps => ({
  fetch: fetch as unknown as typeof globalThis.fetch,
  uuid: () => '11111111-2222-3333-4444-555555555555',
  sha1Hex,
  now: () => new Date('2026-10-06T12:00:00Z'),
});
const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
  new Request(`https://sb.test/functions/v1/stories-media/${path}`, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { Origin: 'https://fellasapp.pages.dev', 'Content-Type': 'application/json', ...headers },
  });
const MEDIA = `stories/${'1'.repeat(64)}`;

describe('POST /sign', () => {
  it('membro: devolve a assinatura do envio com nome aleatório e versão reduzida', async () => {
    const fetch = jest.fn(async () => json(true));
    const res = await handle(post('sign', { kind: 'video' }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(200);
    const out = await res.json();
    expect(out.uploadUrl).toBe('https://api.cloudinary.com/v1_1/cloud/video/upload');
    expect(out.fields).toMatchObject({
      api_key: 'key',
      timestamp: String(Date.parse('2026-10-06T12:00:00Z') / 1000),
      public_id: `stories/${'11111111222233334444555555555555'.repeat(2)}`,
      eager: 'c_limit,w_1280,h_1280,q_auto,f_mp4',
      eager_async: 'true',
    });
    const { api_key, signature, ...signed } = out.fields;
    const expected = await sha1Hex(
      Object.keys(signed).sort().map((k) => `${k}=${signed[k]}`).join('&') + 'secret',
    );
    expect(signature).toBe(expected);
    expect(fetch.mock.calls[0][0]).toBe('https://sb.test/rest/v1/rpc/is_member');
    expect(fetch.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('https://fellasapp.pages.dev');
  });

  it('sem login 401, login inválido 401, não membro 403, kind errado 400', async () => {
    expect((await handle(post('sign', { kind: 'photo' }), env, deps(jest.fn()))).status).toBe(401);
    const bad = jest.fn(async () => json({}, 401));
    expect((await handle(post('sign', { kind: 'photo' }, { Authorization: 'Bearer t' }), env, deps(bad))).status).toBe(401);
    const no = jest.fn(async () => json(false));
    expect((await handle(post('sign', { kind: 'photo' }, { Authorization: 'Bearer t' }), env, deps(no))).status).toBe(403);
    const yes = jest.fn(async () => json(true));
    expect((await handle(post('sign', { kind: 'gif' }, { Authorization: 'Bearer t' }), env, deps(yes))).status).toBe(400);
  });
});

describe('POST /delete', () => {
  const id = '9b2f6a1e-0000-4000-8000-000000000001';

  it('dono: apaga a linha (RLS) e o arquivo no Cloudinary', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([{ id, kind: 'video', media_id: MEDIA }]))
      .mockResolvedValueOnce(json({ deleted: { [MEDIA]: 'deleted' } }));
    const res = await handle(post('delete', { storyId: id }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(200);
    expect(fetch.mock.calls[0][0]).toBe(`https://sb.test/rest/v1/stories?id=eq.${id}&select=id,kind,media_id`);
    expect(fetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
    expect(fetch.mock.calls[0][1].headers).toMatchObject({ Authorization: 'Bearer tok', Prefer: 'return=representation' });
    expect(fetch.mock.calls[1][0]).toBe(
      `https://api.cloudinary.com/v1_1/cloud/resources/video/upload?public_ids%5B%5D=${encodeURIComponent(MEDIA)}`,
    );
    expect(fetch.mock.calls[1][1]).toMatchObject({ method: 'DELETE', headers: { Authorization: `Basic ${btoa('key:secret')}` } });
  });

  it('story de outra pessoa: 403 e não mexe no Cloudinary', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([])) // RLS não deixou apagar
      .mockResolvedValueOnce(json([{ id }])); // mas o story existe
    const res = await handle(post('delete', { storyId: id }, { Authorization: 'Bearer tok' }), env, deps(fetch));
    expect(res.status).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(String(fetch.mock.calls[1][0])).toContain('/rest/v1/stories?id=eq.');
  });

  it('não existe: 404; sem login: 401; id inválido: 400', async () => {
    const fetch = jest.fn().mockResolvedValueOnce(json([])).mockResolvedValueOnce(json([]));
    expect((await handle(post('delete', { storyId: id }, { Authorization: 'Bearer t' }), env, deps(fetch))).status).toBe(404);
    expect((await handle(post('delete', { storyId: id }), env, deps(jest.fn()))).status).toBe(401);
    expect((await handle(post('delete', { storyId: 'x' }, { Authorization: 'Bearer t' }), env, deps(jest.fn()))).status).toBe(400);
  });

  it('Cloudinary falhou: a linha já saiu, responde 200 (a limpeza pega o arquivo)', async () => {
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json([{ id, kind: 'photo', media_id: MEDIA }]))
      .mockRejectedValueOnce(new TypeError('rede'));
    expect((await handle(post('delete', { storyId: id }, { Authorization: 'Bearer t' }), env, deps(fetch))).status).toBe(200);
  });
});

describe('POST /cleanup', () => {
  it('apaga das duas pastas só o que passou de 24 h, paginando', async () => {
    const old = '2026-10-05T10:00:00Z';
    const fresh = '2026-10-06T10:00:00Z';
    const fetch = jest
      .fn()
      .mockResolvedValueOnce(json({ resources: [{ public_id: 'stories/a', created_at: old }], next_cursor: 'p2' }))
      .mockResolvedValueOnce(json({ resources: [{ public_id: 'stories/b', created_at: fresh }] }))
      .mockResolvedValueOnce(json({ deleted: {} })) // apaga imagens
      .mockResolvedValueOnce(json({ resources: [{ public_id: 'stories/v', created_at: old }] }))
      .mockResolvedValueOnce(json({ deleted: {} })); // apaga vídeos
    const res = await handle(post('cleanup', {}, { 'x-cron-secret': 'cron' }), env, deps(fetch));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ deleted: 2 });
    expect(fetch.mock.calls[1][0]).toContain('next_cursor=p2');
    expect(fetch.mock.calls[2][0]).toContain(`public_ids%5B%5D=${encodeURIComponent('stories/a')}`);
    expect(fetch.mock.calls[2][0]).not.toContain('stories%2Fb');
    expect(fetch.mock.calls[4][0]).toContain('/resources/video/upload?public_ids');
  });

  it('segredo errado, ausente ou vazio na função: 401 sem chamar o Cloudinary', async () => {
    const fetch = jest.fn();
    expect((await handle(post('cleanup', {}, { 'x-cron-secret': 'outro' }), env, deps(fetch))).status).toBe(401);
    expect((await handle(post('cleanup', {}), env, deps(fetch))).status).toBe(401);
    const empty = { ...env, STORIES_CRON_SECRET: '' };
    expect((await handle(post('cleanup', {}, { 'x-cron-secret': '' }), empty, deps(fetch))).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('rotas', () => {
  it('OPTIONS responde o CORS; caminho desconhecido 404', async () => {
    const opt = new Request('https://sb.test/functions/v1/stories-media/sign', {
      method: 'OPTIONS',
      headers: { Origin: 'http://localhost:8099' },
    });
    const res = await handle(opt, env, deps(jest.fn()));
    expect(res.status).toBe(204);
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('http://localhost:8099');
    expect((await handle(post('outra', {}), env, deps(jest.fn()))).status).toBe(404);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/storiesMediaHandler.test.ts`
Expected: FAIL (`Cannot find module '../supabase/functions/stories-media/handler'`).

- [ ] **Step 3: `supabase/functions/stories-media/handler.ts`**

```ts
import {
  allowedOrigin,
  basicAuth,
  deleteUrl,
  isExpired,
  listUrl,
  randomMediaId,
  resourceType,
  stringToSign,
  TRANSFORMATIONS,
  uploadUrl,
  type Kind,
  type ResourceType,
} from './rules.ts';

export type Env = {
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  CLOUDINARY_CLOUD_NAME: string;
  CLOUDINARY_API_KEY: string;
  CLOUDINARY_API_SECRET: string;
  STORIES_CRON_SECRET: string;
};
export type Deps = {
  fetch: typeof fetch;
  uuid: () => string;
  sha1Hex: (text: string) => Promise<string>;
  now: () => Date;
};

async function sha1Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

const defaults: Deps = {
  fetch: (...a) => fetch(...a),
  uuid: () => crypto.randomUUID(),
  sha1Hex,
  now: () => new Date(),
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Lote máximo do delete_resources da Admin API. */
const DELETE_BATCH = 100;

function cors(req: Request): Record<string, string> {
  const origin = allowedOrigin(req.headers.get('Origin'));
  return origin
    ? {
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'authorization, content-type, apikey, x-client-info',
        Vary: 'Origin',
      }
    : {};
}

const reply = (req: Request, status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors(req), 'Content-Type': 'application/json' } });

const bearer = (req: Request) => /^Bearer (.+)$/.exec(req.headers.get('Authorization') ?? '')?.[1] ?? null;

async function body(req: Request): Promise<Record<string, unknown>> {
  try {
    const parsed = await req.json();
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
  } catch {
    return {};
  }
}

const restHeaders = (env: Env, token: string, extra: Record<string, string> = {}) => ({
  apikey: env.SUPABASE_ANON_KEY,
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  ...extra,
});

async function isMember(env: Env, token: string, deps: Deps): Promise<boolean | 'unauthorized'> {
  const res = await deps.fetch(`${env.SUPABASE_URL}/rest/v1/rpc/is_member`, {
    method: 'POST',
    headers: restHeaders(env, token),
    body: '{}',
  });
  if (res.status === 401) return 'unauthorized';
  if (!res.ok) return false;
  return (await res.json()) === true;
}

async function sign(req: Request, env: Env, deps: Deps): Promise<Response> {
  const token = bearer(req);
  if (!token) return reply(req, 401, { error: 'sem login' });
  const member = await isMember(env, token, deps);
  if (member === 'unauthorized') return reply(req, 401, { error: 'login inválido' });
  if (!member) return reply(req, 403, { error: 'só membros' });
  const { kind } = await body(req);
  if (kind !== 'photo' && kind !== 'video') return reply(req, 400, { error: 'kind inválido' });
  const params = {
    eager: TRANSFORMATIONS[kind as Kind],
    eager_async: 'true',
    public_id: randomMediaId(deps.uuid),
    timestamp: String(Math.floor(deps.now().getTime() / 1000)),
  };
  const signature = await deps.sha1Hex(stringToSign(params) + env.CLOUDINARY_API_SECRET);
  return reply(req, 200, {
    uploadUrl: uploadUrl(env.CLOUDINARY_CLOUD_NAME, kind as Kind),
    fields: { ...params, api_key: env.CLOUDINARY_API_KEY, signature },
  });
}

async function remove(req: Request, env: Env, deps: Deps): Promise<Response> {
  const token = bearer(req);
  if (!token) return reply(req, 401, { error: 'sem login' });
  const { storyId } = await body(req);
  if (typeof storyId !== 'string' || !UUID_RE.test(storyId)) return reply(req, 400, { error: 'storyId inválido' });
  const url = `${env.SUPABASE_URL}/rest/v1/stories?id=eq.${storyId}`;
  // a RLS só deixa o dono apagar: a linha volta só se era dele
  const del = await deps.fetch(`${url}&select=id,kind,media_id`, {
    method: 'DELETE',
    headers: restHeaders(env, token, { Prefer: 'return=representation' }),
  });
  if (del.status === 401) return reply(req, 401, { error: 'login inválido' });
  if (!del.ok) return reply(req, 500, { error: 'não apagou' });
  const [row] = (await del.json()) as { kind: Kind; media_id: string }[];
  if (!row) {
    const look = await deps.fetch(`${url}&select=id`, { headers: restHeaders(env, token) });
    const found = look.ok ? ((await look.json()) as unknown[]).length > 0 : false;
    return reply(req, found ? 403 : 404, { error: found ? 'não é seu' : 'não existe' });
  }
  // o arquivo: falhou, segue (a limpeza das 24 h pega)
  await deps
    .fetch(deleteUrl(env.CLOUDINARY_CLOUD_NAME, resourceType(row.kind), [row.media_id]), {
      method: 'DELETE',
      headers: { Authorization: basicAuth(env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET) },
    })
    .catch(() => null);
  return reply(req, 200, { ok: true });
}

async function cleanup(req: Request, env: Env, deps: Deps): Promise<Response> {
  const secret = req.headers.get('x-cron-secret');
  if (!env.STORIES_CRON_SECRET || secret !== env.STORIES_CRON_SECRET) return reply(req, 401, { error: 'segredo' });
  const auth = { Authorization: basicAuth(env.CLOUDINARY_API_KEY, env.CLOUDINARY_API_SECRET) };
  const now = deps.now();
  let deleted = 0;
  for (const type of ['image', 'video'] as ResourceType[]) {
    const expired: string[] = [];
    let cursor: string | undefined;
    do {
      const res = await deps.fetch(listUrl(env.CLOUDINARY_CLOUD_NAME, type, cursor), { headers: auth });
      if (!res.ok) return reply(req, 502, { error: `listar ${type}`, deleted });
      const page = (await res.json()) as { resources?: { public_id: string; created_at: string }[]; next_cursor?: string };
      for (const r of page.resources ?? []) if (isExpired(r.created_at, now)) expired.push(r.public_id);
      cursor = page.next_cursor;
    } while (cursor);
    for (let i = 0; i < expired.length; i += DELETE_BATCH) {
      const ids = expired.slice(i, i + DELETE_BATCH);
      const res = await deps.fetch(deleteUrl(env.CLOUDINARY_CLOUD_NAME, type, ids), { method: 'DELETE', headers: auth });
      if (!res.ok) return reply(req, 502, { error: `apagar ${type}`, deleted });
      deleted += ids.length;
    }
  }
  return reply(req, 200, { deleted });
}

/** Rotas pelo fim do caminho (o Supabase entrega /stories-media/<rota>). */
export async function handle(req: Request, env: Env, deps: Deps = defaults): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors(req) });
  const { pathname } = new URL(req.url);
  if (req.method === 'POST' && pathname.endsWith('/sign')) return sign(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/delete')) return remove(req, env, deps);
  if (req.method === 'POST' && pathname.endsWith('/cleanup')) return cleanup(req, env, deps);
  return reply(req, 404, { error: 'não existe' });
}
```

- [ ] **Step 4: `supabase/functions/stories-media/index.ts` e imports com extensão**

O Deno exige a extensão nos imports locais. No `handler.ts`, o import é `from './rules.ts'` (não `'./rules'`); o Jest resolve igual. Para o tsc do app aceitar, em `tsconfig.json` acrescentar em `compilerOptions` (a base do Expo já tem `noEmit`, que é o que a opção exige):

```json
    "allowImportingTsExtensions": true,
```

`supabase/functions/stories-media/index.ts`:

```ts
import { handle, type Env } from './handler.ts';

// Deno (Edge Function do Supabase); o tsc do app não conhece o Deno
declare const Deno: {
  serve: (handler: (req: Request) => Promise<Response>) => void;
  env: { toObject: () => Record<string, string> };
};

Deno.serve((req) => handle(req, Deno.env.toObject() as unknown as Env));
```

- [ ] **Step 5: Rodar e ver passar**

Run: `npx jest __tests__/storiesMediaHandler.test.ts __tests__/storiesMediaRules.test.ts && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 6: Commit**

```bash
git add supabase/functions/stories-media __tests__/storiesMediaHandler.test.ts tsconfig.json
git commit -m "Stories: Edge Function stories-media (assinar envio, apagar do dono, limpeza de 24 h)"
```

---

### Task 4: Migração `0021_stories.sql` com `media_id` e limpeza dos arquivos

**Files:**
- Modify: `supabase/migrations/0021_stories.sql` (cabeçalho ~1-3, `media_url` ~10, depois do `cron.schedule` ~90)
- Modify: `types/database.ts` (bloco `stories` vindo do merge)
- Modify: `supabase/README.md` (linha da 0021)
- Test: `__tests__/storiesMigration.test.ts` (novo)

**Interfaces:**
- Produces: `stories.media_id text` (check `^stories/[0-9a-f]{64}$`); `Tables<'stories'>['Row']` com `media_id: string` (sem `media_url`); job `fellas-stories-arquivos` chamando `…/functions/v1/stories-media/cleanup`.

- [ ] **Step 1: Teste que falha** — `__tests__/storiesMigration.test.ts`:

```ts
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0021_stories.sql`, 'utf8');

describe('0021_stories.sql', () => {
  it('guarda o nome do arquivo no Cloudinary, não um endereço', () => {
    expect(sql).toContain("media_id    text not null check (media_id ~ '^stories/[0-9a-f]{64}$')");
    expect(sql).not.toMatch(/media_url/);
    expect(sql).not.toMatch(/R2|Worker/);
  });

  it('duas limpezas de hora em hora: linhas e arquivos (pela função)', () => {
    expect(sql).toMatch(/cron\.schedule\('fellas-stories-limpeza'/);
    expect(sql).toMatch(/cron\.schedule\('fellas-stories-arquivos'/);
    expect(sql).toContain('https://xygtrrdliqhwibxalvap.supabase.co/functions/v1/stories-media/cleanup');
    expect(sql).toMatch(/create extension if not exists pg_net/);
  });

  it('o segredo do cron vem do Vault, nunca escrito na migração', () => {
    expect(sql).toContain("from vault.decrypted_secrets where name = 'stories_cron_secret'");
    expect(sql).not.toMatch(/x-cron-secret',\s*'[^']/);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/storiesMigration.test.ts`
Expected: FAIL (ainda tem `media_url`, sem o segundo cron).

- [ ] **Step 3: Editar a migração**

Cabeçalho (as 3 primeiras linhas de comentário) vira:

```sql
-- fellasapp: stories (foto 5 s / vídeo até 15 s) que somem em 1 dia. Idempotente.
-- Arquivos ficam no Cloudinary (plano grátis), enviados direto do app com assinatura da Edge Function
-- stories-media; aqui só as listas e o nome do arquivo (media_id). Story com mais de 24 h não é lido nem
-- antes da limpeza (política de leitura). Arquivos com mais de 24 h somem pela limpeza da função (cron).
```

A coluna:

```sql
  media_id    text not null check (media_id ~ '^stories/[0-9a-f]{64}$'),
```

Logo depois da linha `select cron.schedule('fellas-stories-limpeza', …);`:

```sql

-- arquivos no Cloudinary: a função stories-media apaga os com mais de 24 h. O segredo fica no Vault
-- (criado por comando, fora do git): select vault.create_secret('<segredo>', 'stories_cron_secret');
create extension if not exists pg_net;
select cron.schedule('fellas-stories-arquivos', '17 * * * *', $$
  select net.http_post(
    url := 'https://xygtrrdliqhwibxalvap.supabase.co/functions/v1/stories-media/cleanup',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'stories_cron_secret')
    ),
    body := '{}'::jsonb
  );
$$);
```

- [ ] **Step 4: Tipos** — em `types/database.ts`, no bloco `stories` (do merge), trocar `media_url` por `media_id` nas três linhas:

```ts
      stories: {
        Row: { id: string; author_id: string; kind: string; media_id: string; duration_ms: number; created_at: string };
        Insert: { id?: string; author_id: string; kind: string; media_id: string; duration_ms: number; created_at?: string };
        Update: { id?: string; author_id?: string; kind?: string; media_id?: string; duration_ms?: number; created_at?: string };
        Relationships: [];
      };
```

- [ ] **Step 5: README** — em `supabase/README.md`, depois da linha da 0020:

```markdown
| `0021_stories.sql` | stories: `stories`, `story_views`, `story_reactions`, notificação `story_reaction`, limpeza de 24 h (linhas e, via função `stories-media`, arquivos no Cloudinary) | faixa e postar story falham. Antes: segredo `stories_cron_secret` no Vault e a função publicada |
```

- [ ] **Step 6: Rodar** (o `npx tsc` deve apontar os usos de `media_url` em `lib/api/stories.ts`; eles são trocados na Task 5)

Run: `npx jest __tests__/storiesMigration.test.ts`
Expected: PASS.
Run: `npx tsc --noEmit`
Expected: erros só em `lib/api/stories.ts` (`media_url`). **Não commitar com o tsc vermelho**: seguir para a Task 5 e commitar as duas juntas no fim dela (registrar a decisão).

---

### Task 5: App envia em duas etapas e monta os endereços do Cloudinary

**Files:**
- Create: `lib/cloudinary.ts`
- Modify: `lib/storiesConfig.ts`, `lib/api/stories.ts`, `components/stories/StoryComposer.tsx` (função `post`, ~145-160)
- Delete: `workers/stories/` (pasta inteira), `__tests__/storiesWorker.test.ts`, `__tests__/storiesWorkerRules.test.ts`
- Test: `__tests__/cloudinary.test.ts` (novo), `__tests__/storiesApi.test.ts`, `__tests__/storyComposer.test.tsx`

**Interfaces:**
- Consumes: `TRANSFORMATIONS` (Task 2) só no teste de igualdade; `stories.media_id` (Task 4).
- Produces:
  - `lib/cloudinary.ts`: `CLOUDINARY_CLOUD_NAME: string`; `STORY_TRANSFORMATIONS: Record<StoryKind, string>`; `storyMediaUrl(mediaId: string, kind: StoryKind): string`; `storyOriginalUrl(mediaId: string, kind: StoryKind): string`
  - `lib/storiesConfig.ts`: `STORIES_FUNCTION_URL: string`
  - `lib/api/stories.ts`: `Story` ganha `originalUrl?: string` (mantém `mediaUrl`); `uploadStoryMedia(uri: string, kind: StoryKind): Promise<{ mediaId: string; durationMs: number }>`; `createStory(input: { kind: StoryKind; mediaId: string; durationMs: number })`; `deleteStory(storyId: string)` via função; mensagens exportadas `STORY_LIMIT_MESSAGE`.

- [ ] **Step 1: Testes que falham**

`__tests__/cloudinary.test.ts`:

```ts
import { STORY_TRANSFORMATIONS, storyMediaUrl, storyOriginalUrl } from '../lib/cloudinary';
import { TRANSFORMATIONS } from '../supabase/functions/stories-media/rules';

const ID = `stories/${'a'.repeat(64)}`;

describe('endereços do Cloudinary', () => {
  it('versão reduzida e original por tipo', () => {
    expect(storyMediaUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/c_limit,w_1280,h_1280,q_auto,f_mp4/${ID}`);
    expect(storyMediaUrl(ID, 'photo')).toBe(`https://res.cloudinary.com/slxposvw/image/upload/c_limit,w_1920,h_1920,q_auto,f_jpg/${ID}`);
    expect(storyOriginalUrl(ID, 'video')).toBe(`https://res.cloudinary.com/slxposvw/video/upload/${ID}`);
  });

  it('a entrega pede a mesma transformação que o envio gerou (senão gasta crédito à toa)', () => {
    expect(STORY_TRANSFORMATIONS).toEqual(TRANSFORMATIONS);
  });
});
```

`__tests__/storiesApi.test.ts`: trocar o `jest.mock('../lib/storiesConfig', …)` por

```ts
jest.mock('../lib/storiesConfig', () => ({ STORIES_FUNCTION_URL: 'https://sb.test/functions/v1/stories-media' }));
```

e, no import, acrescentar `deleteStory, STORY_LIMIT_MESSAGE`. Substituir os dois `describe` de `uploadStoryMedia` por:

```ts
const SIGNED = {
  uploadUrl: 'https://api.cloudinary.com/v1_1/slxposvw/video/upload',
  fields: { api_key: 'k', timestamp: '1', signature: 'sig', public_id: `stories/${'a'.repeat(64)}`, eager: 'e', eager_async: 'true' },
};
const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body });
const fail = (status: number, body: unknown = {}) => ({ ok: false, status, json: async () => body });

describe('uploadStoryMedia', () => {
  it('assina na função, envia ao Cloudinary com os campos e devolve o nome e a duração do vídeo', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: SIGNED.fields.public_id, duration: 9.42 }));
    globalThis.fetch = fetchMock as never;
    await expect(uploadStoryMedia('file://v.mp4', 'video')).resolves.toEqual({
      mediaId: SIGNED.fields.public_id,
      durationMs: 9420,
    });
    expect(fetchMock.mock.calls[0][0]).toBe('https://sb.test/functions/v1/stories-media/sign');
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer tok');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ kind: 'video' });
    expect(fetchMock.mock.calls[1][0]).toBe(SIGNED.uploadUrl);
    const form = fetchMock.mock.calls[1][1].body as FormData;
    expect(form.get('signature')).toBe('sig');
    expect(form.get('public_id')).toBe(SIGNED.fields.public_id);
    expect(form.get('api_key')).toBe('k');
    expect(form.has('file')).toBe(true);
  });

  it('foto: 5000 ms; vídeo com duração acima de 15 s grava 15000', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: 'p' })) as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).resolves.toEqual({ mediaId: 'p', durationMs: 5000 });
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: 'p', duration: 15.3 })) as never;
    await expect(uploadStoryMedia('file://v.mp4', 'video')).resolves.toEqual({ mediaId: 'p', durationMs: 15000 });
  });

  it.each([
    [401, 'Sua sessão expirou. Entra de novo.'],
    [403, 'Só fellas podem postar story.'],
    [500, 'Não rolou enviar. Tenta de novo.'],
  ])('assinatura recusada %i vira mensagem pt-BR', async (status, message) => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(fail(status)) as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).rejects.toThrow(message);
  });

  it('Cloudinary sem cota: avisa do limite do mês', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(fail(420, { error: { message: 'Rate Limit Exceeded' } })) as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).rejects.toThrow(STORY_LIMIT_MESSAGE);
    expect(STORY_LIMIT_MESSAGE).toBe('Os stories bateram o limite do mês. Volta dia 1.');
  });

  it('assinatura vencida: pede outra e tenta de novo uma vez', async () => {
    const fetchMock = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(fail(401, { error: { message: 'Stale request - reported time is 2026-10-06 which is more than 1 hour ago' } }))
      .mockResolvedValueOnce(ok(SIGNED))
      .mockResolvedValueOnce(ok({ public_id: 'p' }));
    globalThis.fetch = fetchMock as never;
    await expect(uploadStoryMedia('file://a.jpg', 'photo')).resolves.toEqual({ mediaId: 'p', durationMs: 5000 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('sem rede: mensagem pt-BR (StoryUploadError)', async () => {
    globalThis.fetch = jest
      .fn()
      .mockResolvedValueOnce(ok(SIGNED))
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) as never;
    const err = await uploadStoryMedia('file://a.jpg', 'photo').catch((e) => e);
    expect(err).toBeInstanceOf(StoryUploadError);
    expect(err.message).toBe('Sem conexão. Confere a internet e tenta de novo.');
  });
});

describe('deleteStory', () => {
  it('apaga pela função (arquivo e linha)', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce(ok({ ok: true }));
    globalThis.fetch = fetchMock as never;
    await deleteStory('s1');
    expect(fetchMock.mock.calls[0][0]).toBe('https://sb.test/functions/v1/stories-media/delete');
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ storyId: 's1' });
  });

  it('falhou: erro', async () => {
    globalThis.fetch = jest.fn().mockResolvedValueOnce(fail(403)) as never;
    await expect(deleteStory('s1')).rejects.toThrow();
  });
});
```

No `describe('listActiveStories')`, as linhas de `stories.select` passam a ter `media_id: \`stories/${'1'.repeat(64)}\`` (e `'2'…`, `'3'…`) no lugar de `media_url`, e acrescentar ao fim do teste:

```ts
    expect(ana.stories[1].mediaUrl).toBe(`https://res.cloudinary.com/slxposvw/video/upload/c_limit,w_1280,h_1280,q_auto,f_mp4/stories/${'2'.repeat(64)}`);
    expect(ana.stories[1].originalUrl).toBe(`https://res.cloudinary.com/slxposvw/video/upload/stories/${'2'.repeat(64)}`);
```

No `describe('createStory e reactToStory')`, o primeiro teste vira:

```ts
  it('cria em meu nome', async () => {
    await createStory({ kind: 'photo', mediaId: `stories/${'1'.repeat(64)}`, durationMs: 5000 });
    expect(mockCalls.find((c) => c.table === 'stories' && c.op === 'insert')?.args[0]).toEqual({
      author_id: 'me', kind: 'photo', media_id: `stories/${'1'.repeat(64)}`, duration_ms: 5000,
    });
  });
```

`__tests__/storyComposer.test.tsx`:
- o mock: `uploadStoryMedia: (u: string, k: string) => mockUpload(u, k),`
- constante no topo (depois dos mocks): `const MEDIA = \`stories/${'a'.repeat(64)}\`;`
- no `beforeEach`, no lugar de `mockUpload.mockResolvedValue({ url: … })`:

```ts
  mockUpload.mockImplementation(async (_u: string, kind: string) => ({ mediaId: MEDIA, durationMs: kind === 'video' ? 9000 : 5000 }));
```
- em todas as expectativas de `mockCreate`, `mediaUrl: 'https://w/m/x'` vira `mediaId: MEDIA`;
- `expect(mockUpload).toHaveBeenCalledWith('file://a.jpg#reduzida')` vira `expect(mockUpload).toHaveBeenCalledWith('file://a.jpg#reduzida', 'photo')`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/cloudinary.test.ts __tests__/storiesApi.test.ts __tests__/storyComposer.test.tsx`
Expected: FAIL (`Cannot find module '../lib/cloudinary'`; upload ainda manda ao Worker; `mediaId` ausente).

- [ ] **Step 3: `lib/cloudinary.ts`**

```ts
import type { StoryKind } from './api/stories';

/** Conta do Cloudinary dos stories (não é segredo: aparece em todo endereço de entrega). */
export const CLOUDINARY_CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME || 'slxposvw';

/** Mesma transformação que a função pede no envio (eager): a entrega acha a versão pronta. */
export const STORY_TRANSFORMATIONS: Record<StoryKind, string> = {
  video: 'c_limit,w_1280,h_1280,q_auto,f_mp4',
  photo: 'c_limit,w_1920,h_1920,q_auto,f_jpg',
};

const base = (kind: StoryKind) =>
  `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/${kind === 'video' ? 'video' : 'image'}/upload`;

/** Versão reduzida (a que o app mostra). */
export const storyMediaUrl = (mediaId: string, kind: StoryKind) => `${base(kind)}/${STORY_TRANSFORMATIONS[kind]}/${mediaId}`;
/** O arquivo como foi enviado (vídeo: enquanto a reduzida ainda processa). */
export const storyOriginalUrl = (mediaId: string, kind: StoryKind) => `${base(kind)}/${mediaId}`;
```

- [ ] **Step 4: `lib/storiesConfig.ts`** (arquivo inteiro)

```ts
/** Edge Function dos stories (supabase/functions/stories-media): assina o envio e apaga. */
export const STORIES_FUNCTION_URL = `${process.env.EXPO_PUBLIC_SUPABASE_URL ?? ''}/functions/v1/stories-media`;
```

- [ ] **Step 5: `lib/api/stories.ts`**

Imports: trocar `import { STORIES_URL } from '../storiesConfig';` por

```ts
import { Platform } from 'react-native';

import { storyMediaUrl, storyOriginalUrl } from '../cloudinary';
import { STORIES_FUNCTION_URL } from '../storiesConfig';
```

Tipo `Story`: acrescentar `originalUrl?: string;` depois de `mediaUrl: string;` (com o comentário `/** Original: toca enquanto a versão reduzida do vídeo ainda processa. */`).

Trocar `UPLOAD_ERRORS` e `uploadStoryMedia` inteiros por:

```ts
const SIGN_ERRORS: Record<number, string> = {
  401: 'Sua sessão expirou. Entra de novo.',
  403: 'Só fellas podem postar story.',
};
const OFFLINE = 'Sem conexão. Confere a internet e tenta de novo.';
const GENERIC = 'Não rolou enviar. Tenta de novo.';
export const STORY_LIMIT_MESSAGE = 'Os stories bateram o limite do mês. Volta dia 1.';

type Signed = { uploadUrl: string; fields: Record<string, string> };
type Uploaded = { public_id: string; duration?: number };

async function sessionToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new StoryUploadError(SIGN_ERRORS[401]);
  return token;
}

/** Chama a função dos stories com o login; rede caída vira mensagem pt-BR. */
async function callFunction(route: 'sign' | 'delete', token: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${STORIES_FUNCTION_URL}/${route}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch {
    throw new StoryUploadError(OFFLINE);
  }
}

async function signUpload(token: string, kind: StoryKind): Promise<Signed> {
  const res = await callFunction('sign', token, { kind });
  if (!res.ok) throw new StoryUploadError(SIGN_ERRORS[res.status] ?? GENERIC);
  return (await res.json()) as Signed;
}

/** O arquivo no formulário: na web um Blob; no celular o RN lê do disco pelo uri. */
async function filePart(uri: string, kind: StoryKind): Promise<Blob> {
  if (Platform.OS === 'web') return (await fetch(uri)).blob();
  const name = kind === 'video' ? 'story.mp4' : 'story.jpg';
  return { uri, name, type: kind === 'video' ? 'video/mp4' : 'image/jpeg' } as unknown as Blob;
}

/**
 * Envia o arquivo ao Cloudinary em duas etapas: a função assina (só membro) e o app manda direto.
 * Devolve o nome do arquivo e a duração (vídeo: a que o Cloudinary mediu, até 15 s).
 */
export async function uploadStoryMedia(uri: string, kind: StoryKind): Promise<{ mediaId: string; durationMs: number }> {
  const token = await sessionToken();
  for (let attempt = 0; ; attempt++) {
    const signed = await signUpload(token, kind);
    const form = new FormData();
    for (const [k, v] of Object.entries(signed.fields)) form.append(k, v);
    form.append('file', await filePart(uri, kind));
    let res: Response;
    try {
      res = await fetch(signed.uploadUrl, { method: 'POST', body: form });
    } catch {
      throw new StoryUploadError(OFFLINE);
    }
    const out = (await res.json().catch(() => ({}))) as Uploaded & { error?: { message?: string } };
    if (res.ok) {
      const durationMs =
        kind === 'photo' ? STORY_PHOTO_MS : Math.min(MAX_VIDEO_MS, Math.max(1, Math.round((out.duration ?? 0) * 1000)));
      return { mediaId: out.public_id, durationMs };
    }
    const message = out.error?.message ?? '';
    // assinatura vale 1 h: se venceu no caminho, pede outra uma vez
    if (/stale request/i.test(message) && attempt === 0) continue;
    throw new StoryUploadError(/limit|quota/i.test(message) ? STORY_LIMIT_MESSAGE : GENERIC);
  }
}
```

`createStory`:

```ts
export async function createStory(input: { kind: StoryKind; mediaId: string; durationMs: number }): Promise<void> {
  const me = await getCurrentUserId();
  const { error } = await supabase
    .from('stories')
    .insert({ author_id: me, kind: input.kind, media_id: input.mediaId, duration_ms: input.durationMs });
  if (error) throw error;
}
```

Em `type Row`, `media_url: string` vira `media_id: string`; no `.select(…)` de `listActiveStories`, `media_url` vira `media_id`; e o objeto `story`:

```ts
    const story: Story = {
      id: r.id, authorId: r.author_id, kind: r.kind,
      mediaUrl: storyMediaUrl(r.media_id, r.kind), originalUrl: storyOriginalUrl(r.media_id, r.kind),
      durationMs: r.duration_ms, createdAt: r.created_at, seen: seen.has(r.id), myReaction: mine.get(r.id) ?? null,
    };
```

`deleteStory`:

```ts
/** Apaga pela função: o arquivo some do Cloudinary na hora e a linha do banco junto. */
export async function deleteStory(storyId: string): Promise<void> {
  const res = await callFunction('delete', await sessionToken(), { storyId });
  if (!res.ok) throw new StoryUploadError('Não rolou apagar. Tenta de novo.');
}
```

- [ ] **Step 6: `components/stories/StoryComposer.tsx`** — na função `post`, as duas linhas de envio viram:

```tsx
      const { mediaId, durationMs } = await uploadStoryMedia(source, picked.kind);
      await createStory({ kind: picked.kind, mediaId, durationMs });
```

- [ ] **Step 7: Tirar o Worker**

```bash
git rm -r workers/stories __tests__/storiesWorker.test.ts __tests__/storiesWorkerRules.test.ts
```

Run: `git grep -n "STORIES_URL\|workers/stories\|media_url" -- . ':!docs'`
Expected: nenhuma linha.

- [ ] **Step 8: Rodar e ver passar**

Run: `npx jest __tests__/cloudinary.test.ts __tests__/storiesApi.test.ts __tests__/storyComposer.test.tsx __tests__/storiesMigration.test.ts && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 9: Commit (Tasks 4 e 5 juntas)**

```bash
git add -A supabase/migrations/0021_stories.sql supabase/README.md types/database.ts lib/cloudinary.ts lib/storiesConfig.ts lib/api/stories.ts components/stories/StoryComposer.tsx workers __tests__
git commit -m "Stories: migração 0021 com media_id e limpeza pelo Cloudinary; app envia em duas etapas; sai o Worker"
```

---

### Task 6: Vídeo volta para o original enquanto a versão reduzida processa

**Files:**
- Modify: `components/stories/StoryVideo.tsx`, `components/stories/StoryViewer.tsx` (onde renderiza `<StoryVideo`)
- Test: `__tests__/storyVideo.test.tsx` (novo)

**Interfaces:**
- Consumes: `Story.originalUrl` (Task 5).
- Produces: `StoryVideo` aceita `fallbackUri?: string`.

- [ ] **Step 1: Conferir a API do expo-video**

Run: `grep -n "replaceAsync\|  replace(" node_modules/expo-video/build/VideoPlayer.types.d.ts`
Expected: aparece `replaceAsync(source…)` (SDK 57). Se só existir `replace(source)`, usar `replace` no Step 3 e no teste.

- [ ] **Step 2: Teste que falha** — `__tests__/storyVideo.test.tsx`:

```tsx
import { act, render } from '@testing-library/react-native';

const mockStatus: ((e: { status: string }) => void)[] = [];
const mockPlayer = {
  play: jest.fn(),
  pause: jest.fn(),
  replaceAsync: jest.fn().mockResolvedValue(undefined),
  muted: false,
  loop: false,
  playing: true,
  status: 'loading',
  addListener: (event: string, fn: (e: { status: string }) => void) => {
    if (event === 'statusChange') mockStatus.push(fn);
    return { remove: () => {} };
  },
};
jest.mock('expo-video', () => {
  const { View } = require('react-native');
  return { useVideoPlayer: () => mockPlayer, VideoView: (props: object) => <View {...props} /> };
});

import { StoryVideo } from '../components/stories/StoryVideo';

const emit = (status: string) => act(() => mockStatus.forEach((fn) => fn({ status })));

beforeEach(() => {
  mockStatus.length = 0;
  jest.clearAllMocks();
});

describe('StoryVideo', () => {
  it('reduzida falhou: troca para o original uma vez e só então libera o relógio', async () => {
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" fallbackUri="https://r/orig" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    await emit('error');
    expect(mockPlayer.replaceAsync).toHaveBeenCalledWith('https://r/orig');
    expect(onReady).not.toHaveBeenCalled();
    await emit('readyToPlay');
    expect(onReady).toHaveBeenCalled();
  });

  it('original também falhou: libera o relógio (o story passa)', async () => {
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" fallbackUri="https://r/orig" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    await emit('error');
    await emit('error');
    expect(mockPlayer.replaceAsync).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalled();
  });

  it('sem original: erro libera o relógio direto', async () => {
    const onReady = jest.fn();
    await render(<StoryVideo uri="https://r/red" paused={false} muted={false} onReady={onReady} onBlocked={() => {}} />);
    await emit('error');
    expect(mockPlayer.replaceAsync).not.toHaveBeenCalled();
    expect(onReady).toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Rodar e ver falhar**

Run: `npx jest __tests__/storyVideo.test.tsx`
Expected: FAIL (`replaceAsync` não chamado; `onReady` chamado no primeiro erro).

- [ ] **Step 4: `components/stories/StoryVideo.tsx`**

Em `Props`, depois de `uri: string;`:

```tsx
  /** Toca este se o `uri` falhar (versão reduzida do Cloudinary ainda processando). */
  fallbackUri?: string;
```

Assinatura: `export function StoryVideo({ uri, fallbackUri, paused, muted, onReady, onBlocked }: Props) {`

Trocar o primeiro `useEffect` (o do `statusChange`) por:

```tsx
  // a versão reduzida pode ainda não estar pronta: tenta o original uma vez antes de desistir
  const fellBack = useRef(false);
  useEffect(() => {
    const onStatus = (status: string) => {
      if (status === 'error' && fallbackUri && !fellBack.current) {
        fellBack.current = true;
        void player.replaceAsync(fallbackUri);
        return;
      }
      if (status === 'readyToPlay' || status === 'error') ready.current();
    };
    onStatus(player.status);
    const sub = player.addListener('statusChange', ({ status }) => onStatus(status));
    return () => sub.remove();
  }, [player, fallbackUri]);
```

- [ ] **Step 5: `components/stories/StoryViewer.tsx`** — no `<StoryVideo`, depois de `uri={story.mediaUrl}`:

```tsx
              fallbackUri={story.originalUrl}
```

- [ ] **Step 6: Rodar e ver passar**

Run: `npx jest __tests__/storyVideo.test.tsx __tests__/storyViewer.test.tsx && npx tsc --noEmit`
Expected: PASS; tsc sem saída.

- [ ] **Step 7: Commit**

```bash
git add components/stories/StoryVideo.tsx components/stories/StoryViewer.tsx __tests__/storyVideo.test.tsx
git commit -m "Stories: vídeo toca o original enquanto a versão reduzida do Cloudinary processa"
```

---

### Task 7: Registro, verificação e publicação

**Files:**
- Modify: `DESIGN.md` (seção nova "### Stories" depois de "### Reações e fotos"), `.env.example`

- [ ] **Step 1: `.env.example`** — acrescentar:

```
# Cloudinary dos stories (não é segredo; o padrão no código já é slxposvw)
EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME=slxposvw
```

- [ ] **Step 2: `DESIGN.md`** — seção "### Stories" resumindo o que a spec antiga define de visual (faixa de bolinhas com anel `brand` = não visto e `border` = visto, tela cheia em `viewerBg`, barrinhas de progresso, reações com a barra do feed, "Visto por N"), com uma linha: "Arquivos no Cloudinary (versão reduzida: vídeo lado maior 1280, foto 1920); somem em 24 h."

- [ ] **Step 3: Suíte inteira**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem saída; todas as suítes passam.

- [ ] **Step 4: Passada visual (Impeccable, uma rodada)** — `EXPO_PUBLIC_DEV_FAKE_LOGIN=1 npx expo start --web --port 8099 --clear` (o Metro nesta máquina às vezes não percebe arquivos mudados: sempre `--clear`). Com dados falsos marcados `TEMP-PREVIEW` em `listActiveStories` (2–3 grupos usando endereços de exemplo do Cloudinary `https://res.cloudinary.com/demo/image/upload/sample.jpg` e `https://res.cloudinary.com/demo/video/upload/dog.mp4`), conferir no computador e, se a janela redimensionar, no celular: faixa no topo do feed (dos dois jeitos), abrir a tela cheia, passar, pausar, reagir, "Visto por". Desfazer todo `TEMP-PREVIEW` e `git checkout -- tsconfig.json`.

- [ ] **Step 5: Commit**

```bash
git add DESIGN.md .env.example
git commit -m "DESIGN: stories (Cloudinary)"
```

- [ ] **Step 6: Publicar a função e o banco (com o Juan, nesta ordem)**

1. **Juan** grava a secret (ela não passa pelo chat):
   `! export $(grep '^SUPABASE_ACCESS_TOKEN=' .env | xargs) && npx supabase secrets set CLOUDINARY_API_SECRET=<a secret do painel do Cloudinary>`
2. Segredos públicos e o do cron (gerado aqui, sem imprimir):

```bash
export $(grep '^SUPABASE_ACCESS_TOKEN=' .env | xargs)
CRON=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
npx supabase secrets set CLOUDINARY_CLOUD_NAME=slxposvw CLOUDINARY_API_KEY=968516645973728 STORIES_CRON_SECRET=$CRON
npx supabase db query --linked "select vault.create_secret('$CRON', 'stories_cron_secret')" > /dev/null
```
   Expected: sem erro. (Se o segredo já existir no Vault: `select vault.update_secret(id, '$CRON') from vault.secrets where name = 'stories_cron_secret'`.)
3. `npx supabase functions deploy stories-media --no-verify-jwt` (a função confere o login ela mesma; a limpeza vem do cron sem login).
4. `npx supabase db query --linked -f supabase/migrations/0021_stories.sql`
5. Fumaça: `curl -s -o /dev/null -w "%{http_code}" -X POST https://xygtrrdliqhwibxalvap.supabase.co/functions/v1/stories-media/sign` → `401`; e
   `npx supabase db query --linked "select jobname, schedule from cron.job where jobname like 'fellas-stories%'"` → os dois jobs.

- [ ] **Step 7: Integrar** — superpowers:finishing-a-development-branch (fluxo do projeto: merge local na `main` + push, **depois** do Step 6). Depois de publicado, conferência real com o Juan (postar foto e vídeo, assistir de outra conta, reagir, apagar um) e, no dia seguinte, conferir que sumiu do Cloudinary (painel Media Library, pasta `stories`) e do banco. Com tudo na `main`, oferecer apagar a branch `feat/stories`.
