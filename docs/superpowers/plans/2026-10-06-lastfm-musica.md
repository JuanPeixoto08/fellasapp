# Música no perfil (Last.fm) — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quem põe o usuário do Last.fm no Editar perfil mostra no perfil a música que está tocando (linha discreta no cabeçalho) e uma aba Música com Recentes (histórico infinito) e tops de Artistas, Álbuns e Músicas por período.

**Architecture:** Uma coluna `profiles.lastfm_user`; nada de música no nosso banco. O app chama o Last.fm direto (CORS liberado) com `EXPO_PUBLIC_LASTFM_API_KEY`: `lib/lastfm/map.ts` (puro) converte as respostas, `lib/lastfm/api.ts` faz as chamadas e traduz erros, dois hooks cuidam de paginação e do "ouvindo agora", e os componentes em `components/music/*` montam a linha do cabeçalho e a aba.

**Tech Stack:** Expo SDK 57, expo-router, React Native / react-native-web, TypeScript, jest-expo + @testing-library/react-native v14 (`await render`, `await fireEvent.*`, `await renderHook`), Supabase, API do Last.fm (`ws.audioscrobbler.com/2.0/`).

**Spec:** `docs/superpowers/specs/2026-10-06-lastfm-musica-design.md`

## Global Constraints

- Texto em pt-BR, tom do `PRODUCT.md`; tokens de `lib/theme.ts` e primitivos de `components/ui` (CLAUDE.md); Impeccable (modo Operate).
- Usuário do Last.fm: `^[A-Za-z][A-Za-z0-9_-]{1,14}$` (app e banco).
- Chamadas: `https://ws.audioscrobbler.com/2.0/?method=…&api_key=…&format=json`; `limit=50` nas listas; a chave vem de `process.env.EXPO_PUBLIC_LASTFM_API_KEY` lida **na hora da chamada**; sem chave → erro `no_key` sem chamar a rede. O shared secret nunca entra no projeto.
- Erros do Last.fm: 6 → `not_found`, 17 → `private`, 29 → `rate_limit`; falha de rede → `network`; o resto → `other`.
- Imagem de artista "estrela genérica" (URL contém `2a96cbd8b46e442fc41c2b86b821562f`) conta como sem imagem.
- Períodos: `7day` "7 dias", `1month` "1 mês" (padrão), `3month` "3 meses", `12month` "1 ano", `overall` "sempre".
- "Ouvindo agora" atualiza a cada **60 s** só com a tela focada; barras paradas com "reduzir movimento".
- Os nomes `getTopArtists/Albums/Tracks` da spec viram uma função só, `getTop(kind, …)` (mesma chamada, menos código).
- Migration `supabase/migrations/0019_lastfm_user.sql`; branch `feat/lastfm`. `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa; um commit por tarefa.

## Review Focus

1. **Resposta com um item só**: o Last.fm devolve **objeto** em vez de lista quando há 1 música/artista. Tem que virar lista de 1, não sumir nem quebrar. → teste na Task 2.
2. **Conta sem nenhum scrobble** (`track: []`, `totalPages: "0"`): estado vazio "Nada por aqui ainda.", sem carregar para sempre nem pedir página 2. → testes nas Tasks 2 e 4.
3. **Trocar de sub-aba/período rápido**: a resposta atrasada da escolha anterior não pode aparecer na nova. → teste na Task 4.
4. **Sair do perfil**: o "ouvindo agora" para de perguntar ao Last.fm (sem ficar chamando em segundo plano). → teste na Task 4.
5. **Salvar o perfil sem mexer no Last.fm** (ou com o Last.fm fora do ar e o usuário igual ao salvo): não pode chamar o Last.fm nem travar o salvamento. → teste na Task 8.

---

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `supabase/migrations/0019_lastfm_user.sql` (novo) | coluna + grant |
| `types/database.ts`, `lib/auth/devFakeLogin.ts` | `lastfm_user` |
| `.env.example`, `.github/workflows/deploy-web.yml`, `supabase/README.md` | variável da chave; linha da 0019 |
| `lib/lastfm/types.ts` (novo) | tipos |
| `lib/lastfm/map.ts` (novo) | conversões puras, períodos, validação, números |
| `lib/lastfm/api.ts` (novo) | chamadas e erros |
| `lib/lastfm/useLastfmPages.ts` (novo) | lista paginada |
| `lib/lastfm/useNowPlaying.ts` (novo) | música atual com atualização |
| `components/music/ArtistTile.tsx`, `TrackRow.tsx`, `TopRow.tsx`, `EqualizerBars.tsx`, `NowPlayingLine.tsx`, `MusicTab.tsx` (novos) | UI |
| `components/profile/ProfileHeader.tsx`, `components/ProfileView.tsx` | linha no cabeçalho e aba |
| `lib/api/profiles.ts`, `app/profile/edit.tsx` | campo e gravação |

---

### Task 1: Banco, tipos e variável da chave

**Files:**
- Create: `supabase/migrations/0019_lastfm_user.sql`
- Modify: `types/database.ts`, `lib/auth/devFakeLogin.ts`, `.env.example`, `.github/workflows/deploy-web.yml`, `supabase/README.md`

**Interfaces:**
- Produces: `profiles.lastfm_user: string | null` (Row), `lastfm_user?: string | null` (Insert/Update).

- [ ] **Step 1: Migration**

`supabase/migrations/0019_lastfm_user.sql`:

```sql
-- fellasapp: usuário do Last.fm no perfil (aba Música e "ouvindo agora"). Idempotente.
-- Nada de música fica no banco: o app lê do Last.fm na hora. Cada um edita o próprio.

alter table public.profiles add column if not exists lastfm_user text
  check (lastfm_user is null or lastfm_user ~ '^[A-Za-z][A-Za-z0-9_-]{1,14}$');

grant update (lastfm_user) on public.profiles to authenticated;
```

- [ ] **Step 2: Tipos e perfil falso**

Em `types/database.ts`, no bloco `profiles`: em `Row`, depois de `badges: string[];`, acrescentar `lastfm_user: string | null;`; em `Insert` e `Update`, depois de `badges?: string[];`, acrescentar `lastfm_user?: string | null;`.

Em `lib/auth/devFakeLogin.ts`, no `fakeProfile`, depois de `badges: [],`: `lastfm_user: null,`.

- [ ] **Step 3: Variável da chave**

`.env.example`, linha nova no fim:

```
# Last.fm (aba Música): só a API key; o shared secret NÃO entra no projeto
EXPO_PUBLIC_LASTFM_API_KEY=
```

`.github/workflows/deploy-web.yml`: no bloco `env:` do build (onde estão `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_ANON_KEY`), acrescentar

```yaml
          EXPO_PUBLIC_LASTFM_API_KEY: ${{ secrets.EXPO_PUBLIC_LASTFM_API_KEY }}
```

e no comentário do topo, depois da linha das variáveis do Supabase:

```yaml
#   EXPO_PUBLIC_LASTFM_API_KEY   API key do Last.fm (aba Música; entra no bundle)
```

`supabase/README.md`, abaixo da linha da `0018_profile_badges.sql`:

```markdown
| `0019_lastfm_user.sql` | usuário do Last.fm no perfil (`profiles.lastfm_user`) | salvar perfil com Last.fm falha |
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit && echo tsc ok`
Expected: `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0019_lastfm_user.sql types/database.ts lib/auth/devFakeLogin.ts .env.example .github/workflows/deploy-web.yml supabase/README.md
git commit -m "Last.fm: coluna profiles.lastfm_user (0019) e variável da chave no deploy"
```

---

### Task 2: Tipos e conversões (`lib/lastfm/types.ts`, `lib/lastfm/map.ts`)

**Files:**
- Create: `lib/lastfm/types.ts`, `lib/lastfm/map.ts`
- Test: `__tests__/lastfmMap.test.ts`

**Interfaces:**
- Produces (`types.ts`):
  - `LastfmPeriod = '7day' | '1month' | '3month' | '12month' | 'overall'`
  - `LastfmTopKind = 'artists' | 'albums' | 'tracks'`
  - `LastfmTrack = { name: string; artist: string; album: string | null; image: string | null; url: string; playedAt: string | null; nowPlaying: boolean }`
  - `LastfmTopItem = { rank: number; name: string; artist: string | null; image: string | null; url: string; plays: number }`
  - `LastfmUser = { name: string; playcount: number; registeredAt: string | null }`
  - `LastfmPage<T> = { items: T[]; page: number; totalPages: number }`
  - `LastfmErrorKind = 'not_found' | 'private' | 'rate_limit' | 'network' | 'no_key' | 'other'`
- Produces (`map.ts`): `pickImage(images)`, `mapRecentTracks(json)`, `mapTop(kind, json)`, `mapUserInfo(json)`, `isValidLastfmUser(name)`, `PERIODS: { value: LastfmPeriod; label: string }[]`, `DEFAULT_PERIOD: LastfmPeriod`, `formatThousands(n)`, `sinceYear(iso)`.

- [ ] **Step 1: Teste que falha**

`__tests__/lastfmMap.test.ts`:

```ts
import {
  DEFAULT_PERIOD,
  formatThousands,
  isValidLastfmUser,
  mapRecentTracks,
  mapTop,
  mapUserInfo,
  PERIODS,
  pickImage,
  sinceYear,
} from '../lib/lastfm/map';

const STAR = 'https://lastfm.freetls.fastly.net/i/u/300x300/2a96cbd8b46e442fc41c2b86b821562f.png';
const img = (url: string) => [
  { '#text': url.replace('300x300', '34s'), size: 'small' },
  { '#text': url, size: 'extralarge' },
];

describe('pickImage', () => {
  it('a maior não vazia; estrela genérica e vazia viram null', () => {
    expect(pickImage(img('https://x/300x300/capa.png'))).toBe('https://x/300x300/capa.png');
    expect(pickImage(img(STAR))).toBeNull();
    expect(pickImage([{ '#text': '', size: 'small' }])).toBeNull();
    expect(pickImage(undefined)).toBeNull();
  });
});

describe('mapRecentTracks', () => {
  it('converte, marca "ouvindo agora" sem data e lê a paginação', () => {
    const page = mapRecentTracks({
      recenttracks: {
        track: [
          {
            name: 'Ama Sofre Chora',
            artist: { '#text': 'Pablo Vittar' },
            album: { '#text': 'Batidão Tropical' },
            image: img('https://x/300x300/a.png'),
            url: 'https://www.last.fm/music/Pablo+Vittar/_/Ama+Sofre+Chora',
            '@attr': { nowplaying: 'true' },
          },
          {
            name: '360',
            artist: { '#text': 'Charli xcx' },
            album: { '#text': '' },
            image: img('https://x/300x300/b.png'),
            url: 'https://www.last.fm/music/Charli+xcx/_/360',
            date: { uts: '1791262000', '#text': '06 Oct 2026, 12:06' },
          },
        ],
        '@attr': { page: '1', totalPages: '249' },
      },
    });
    expect(page).toEqual({
      page: 1,
      totalPages: 249,
      items: [
        {
          name: 'Ama Sofre Chora',
          artist: 'Pablo Vittar',
          album: 'Batidão Tropical',
          image: 'https://x/300x300/a.png',
          url: 'https://www.last.fm/music/Pablo+Vittar/_/Ama+Sofre+Chora',
          playedAt: null,
          nowPlaying: true,
        },
        {
          name: '360',
          artist: 'Charli xcx',
          album: null,
          image: 'https://x/300x300/b.png',
          url: 'https://www.last.fm/music/Charli+xcx/_/360',
          playedAt: new Date(1791262000 * 1000).toISOString(),
          nowPlaying: false,
        },
      ],
    });
  });

  it('um item só vem como objeto: vira lista de 1', () => {
    const page = mapRecentTracks({
      recenttracks: {
        track: { name: 'Só', artist: { '#text': 'Uma' }, url: 'u', date: { uts: '1' } },
        '@attr': { page: '1', totalPages: '1' },
      },
    });
    expect(page.items).toHaveLength(1);
    expect(page.items[0].name).toBe('Só');
  });

  it('conta sem scrobbles: lista vazia e 0 páginas', () => {
    expect(mapRecentTracks({ recenttracks: { track: [], '@attr': { page: '1', totalPages: '0' } } })).toEqual({
      items: [],
      page: 1,
      totalPages: 0,
    });
  });
});

describe('mapTop', () => {
  it('artistas: sem artista na linha; estrela genérica vira null', () => {
    const page = mapTop('artists', {
      topartists: {
        artist: [{ name: 'Pablo Vittar', playcount: '212', url: 'u1', image: img(STAR), '@attr': { rank: '1' } }],
        '@attr': { page: '1', totalPages: '3' },
      },
    });
    expect(page).toEqual({
      page: 1,
      totalPages: 3,
      items: [{ rank: 1, name: 'Pablo Vittar', artist: null, image: null, url: 'u1', plays: 212 }],
    });
  });

  it('álbuns e músicas trazem o artista; um item só vira lista', () => {
    const albums = mapTop('albums', {
      topalbums: {
        album: { name: 'Brat', playcount: '140', url: 'u2', artist: { name: 'Charli xcx' }, image: img('https://x/300x300/c.png'), '@attr': { rank: '1' } },
        '@attr': { page: '1', totalPages: '1' },
      },
    });
    expect(albums.items).toEqual([
      { rank: 1, name: 'Brat', artist: 'Charli xcx', image: 'https://x/300x300/c.png', url: 'u2', plays: 140 },
    ]);
    const tracks = mapTop('tracks', {
      toptracks: {
        track: [{ name: '360', playcount: '50', url: 'u3', artist: { name: 'Charli xcx' }, image: [], '@attr': { rank: '2' } }],
        '@attr': { page: '2', totalPages: '4' },
      },
    });
    expect(tracks).toMatchObject({ page: 2, totalPages: 4, items: [{ rank: 2, artist: 'Charli xcx', image: null, plays: 50 }] });
  });
});

describe('mapUserInfo e números', () => {
  it('resumo da conta', () => {
    expect(
      mapUserInfo({ user: { name: 'juan', playcount: '12430', registered: { unixtime: '1546300800' } } }),
    ).toEqual({ name: 'juan', playcount: 12430, registeredAt: new Date(1546300800 * 1000).toISOString() });
    expect(formatThousands(12430)).toBe('12.430');
    expect(formatThousands(999)).toBe('999');
    expect(sinceYear('2019-01-01T00:00:00.000Z')).toBe('2019');
    expect(sinceYear(null)).toBeNull();
  });
});

describe('isValidLastfmUser e períodos', () => {
  it('regra do usuário do Last.fm', () => {
    expect(isValidLastfmUser('juan_08')).toBe(true);
    expect(isValidLastfmUser('a')).toBe(false);
    expect(isValidLastfmUser('1abc')).toBe(false);
    expect(isValidLastfmUser('juan peixoto')).toBe(false);
    expect(isValidLastfmUser('abcdefghijklmnop')).toBe(false);
  });

  it('períodos na ordem, 1 mês de padrão', () => {
    expect(PERIODS.map((p) => p.label)).toEqual(['7 dias', '1 mês', '3 meses', '1 ano', 'sempre']);
    expect(PERIODS.map((p) => p.value)).toEqual(['7day', '1month', '3month', '12month', 'overall']);
    expect(DEFAULT_PERIOD).toBe('1month');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/lastfmMap.test.ts`
Expected: FAIL, "Cannot find module '../lib/lastfm/map'".

- [ ] **Step 3: Implementar**

`lib/lastfm/types.ts`:

```ts
/** Tipos da aba Música (dados do Last.fm já convertidos para o app). */
export type LastfmPeriod = '7day' | '1month' | '3month' | '12month' | 'overall';
export type LastfmTopKind = 'artists' | 'albums' | 'tracks';

export type LastfmTrack = {
  name: string;
  artist: string;
  album: string | null;
  image: string | null;
  url: string;
  /** ISO; null na música que está tocando agora. */
  playedAt: string | null;
  nowPlaying: boolean;
};

export type LastfmTopItem = {
  rank: number;
  name: string;
  /** Em álbuns e músicas; null em artistas. */
  artist: string | null;
  image: string | null;
  url: string;
  plays: number;
};

export type LastfmUser = { name: string; playcount: number; registeredAt: string | null };

export type LastfmPage<T> = { items: T[]; page: number; totalPages: number };

export type LastfmErrorKind = 'not_found' | 'private' | 'rate_limit' | 'network' | 'no_key' | 'other';
```

`lib/lastfm/map.ts`:

```ts
import type { LastfmPage, LastfmPeriod, LastfmTopItem, LastfmTopKind, LastfmTrack, LastfmUser } from './types';

/* eslint-disable @typescript-eslint/no-explicit-any -- respostas do Last.fm chegam sem tipo */

/** O Last.fm não fornece mais foto de artista: devolve sempre esta estrela. */
const GENERIC_STAR = '2a96cbd8b46e442fc41c2b86b821562f';

type Img = { '#text'?: string; size?: string };

/** Maior imagem não vazia (o Last.fm manda da menor para a maior); a estrela genérica conta como nada. */
export function pickImage(images: Img[] | undefined): string | null {
  const urls = (images ?? []).map((i) => i?.['#text'] ?? '').filter(Boolean);
  const url = urls[urls.length - 1] ?? null;
  return url && !url.includes(GENERIC_STAR) ? url : null;
}

/** Com um item só, o Last.fm manda objeto em vez de lista. */
const list = <T>(value: T | T[] | undefined | null): T[] => (value == null ? [] : Array.isArray(value) ? value : [value]);
const num = (value: unknown): number => {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};
const isoFromUnix = (value: unknown): string | null => {
  const n = num(value);
  return n > 0 ? new Date(n * 1000).toISOString() : null;
};
const pageOf = (attr: any) => ({ page: num(attr?.page) || 1, totalPages: num(attr?.totalPages) });

export function mapRecentTracks(json: any): LastfmPage<LastfmTrack> {
  const root = json?.recenttracks ?? {};
  const items = list<any>(root.track).map((t) => ({
    name: String(t?.name ?? ''),
    artist: String(t?.artist?.['#text'] ?? t?.artist?.name ?? ''),
    album: t?.album?.['#text'] ? String(t.album['#text']) : null,
    image: pickImage(t?.image),
    url: String(t?.url ?? ''),
    playedAt: isoFromUnix(t?.date?.uts),
    nowPlaying: t?.['@attr']?.nowplaying === 'true',
  }));
  return { items, ...pageOf(root['@attr']) };
}

const TOP_KEYS: Record<LastfmTopKind, { root: string; item: string }> = {
  artists: { root: 'topartists', item: 'artist' },
  albums: { root: 'topalbums', item: 'album' },
  tracks: { root: 'toptracks', item: 'track' },
};

export function mapTop(kind: LastfmTopKind, json: any): LastfmPage<LastfmTopItem> {
  const keys = TOP_KEYS[kind];
  const root = json?.[keys.root] ?? {};
  const items = list<any>(root[keys.item]).map((x) => ({
    rank: num(x?.['@attr']?.rank),
    name: String(x?.name ?? ''),
    artist: kind === 'artists' ? null : String(x?.artist?.name ?? x?.artist?.['#text'] ?? '') || null,
    image: pickImage(x?.image),
    url: String(x?.url ?? ''),
    plays: num(x?.playcount),
  }));
  return { items, ...pageOf(root['@attr']) };
}

export function mapUserInfo(json: any): LastfmUser {
  const u = json?.user ?? {};
  return { name: String(u.name ?? ''), playcount: num(u.playcount), registeredAt: isoFromUnix(u.registered?.unixtime) };
}

/** Regra de usuário do Last.fm (igual à checagem do banco, 0019). */
export function isValidLastfmUser(name: string): boolean {
  return /^[A-Za-z][A-Za-z0-9_-]{1,14}$/.test(name);
}

export const PERIODS: { value: LastfmPeriod; label: string }[] = [
  { value: '7day', label: '7 dias' },
  { value: '1month', label: '1 mês' },
  { value: '3month', label: '3 meses' },
  { value: '12month', label: '1 ano' },
  { value: 'overall', label: 'sempre' },
];
export const DEFAULT_PERIOD: LastfmPeriod = '1month';

/** 12430 → "12.430" (sem depender de Intl no aparelho). */
export function formatThousands(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function sinceYear(iso: string | null): string | null {
  return iso ? String(new Date(iso).getUTCFullYear()) : null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/lastfmMap.test.ts && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`. (Se o projeto não usa ESLint, o comentário `eslint-disable` é inofensivo; remover se o `tsc`/testes reclamarem de algo.)

- [ ] **Step 5: Commit**

```bash
git add lib/lastfm/types.ts lib/lastfm/map.ts __tests__/lastfmMap.test.ts
git commit -m "Last.fm: tipos e conversões das respostas"
```

---

### Task 3: Chamadas (`lib/lastfm/api.ts`)

**Files:**
- Create: `lib/lastfm/api.ts`
- Test: `__tests__/lastfmApi.test.ts`

**Interfaces:**
- Consumes: `mapRecentTracks`, `mapTop`, `mapUserInfo` (Task 2); tipos (Task 2).
- Produces:
  - `class LastfmError extends Error { kind: LastfmErrorKind }`
  - `LASTFM_PAGE = 50`
  - `hasLastfmKey(): boolean`
  - `getUserInfo(user: string): Promise<LastfmUser>`
  - `getRecentTracks(user: string, page: number): Promise<LastfmPage<LastfmTrack>>`
  - `getTop(kind: LastfmTopKind, user: string, period: LastfmPeriod, page: number): Promise<LastfmPage<LastfmTopItem>>`
  - `getNowPlaying(user: string): Promise<LastfmTrack | null>`

- [ ] **Step 1: Teste que falha**

`__tests__/lastfmApi.test.ts`:

```ts
import { getNowPlaying, getRecentTracks, getTop, getUserInfo, hasLastfmKey, LastfmError } from '../lib/lastfm/api';

const mockFetch = jest.fn();
const ORIGINAL_KEY = process.env.EXPO_PUBLIC_LASTFM_API_KEY;

beforeEach(() => {
  mockFetch.mockReset();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
  process.env.EXPO_PUBLIC_LASTFM_API_KEY = 'k123';
});
afterAll(() => {
  process.env.EXPO_PUBLIC_LASTFM_API_KEY = ORIGINAL_KEY;
});

const ok = (json: unknown) => mockFetch.mockResolvedValue({ ok: true, json: async () => json });
const query = () => new URL(mockFetch.mock.calls[0][0] as string).searchParams;

describe('api do Last.fm', () => {
  it('recentes: método, usuário, página, 50 por vez, chave e json', async () => {
    ok({ recenttracks: { track: [], '@attr': { page: '2', totalPages: '9' } } });
    await expect(getRecentTracks('juan', 2)).resolves.toEqual({ items: [], page: 2, totalPages: 9 });
    const q = query();
    expect(q.get('method')).toBe('user.getrecenttracks');
    expect(q.get('user')).toBe('juan');
    expect(q.get('page')).toBe('2');
    expect(q.get('limit')).toBe('50');
    expect(q.get('api_key')).toBe('k123');
    expect(q.get('format')).toBe('json');
    expect((mockFetch.mock.calls[0][0] as string).startsWith('https://ws.audioscrobbler.com/2.0/?')).toBe(true);
  });

  it('tops: método por tipo e período', async () => {
    ok({ topalbums: { album: [], '@attr': { page: '1', totalPages: '0' } } });
    await getTop('albums', 'juan', '7day', 1);
    expect(query().get('method')).toBe('user.gettopalbums');
    expect(query().get('period')).toBe('7day');
  });

  it('resumo da conta', async () => {
    ok({ user: { name: 'juan', playcount: '10', registered: { unixtime: '1546300800' } } });
    await expect(getUserInfo('juan')).resolves.toMatchObject({ name: 'juan', playcount: 10 });
    expect(query().get('method')).toBe('user.getinfo');
  });

  it('ouvindo agora: a música marcada, ou null', async () => {
    ok({
      recenttracks: {
        track: [{ name: 'Agora', artist: { '#text': 'A' }, url: 'u', '@attr': { nowplaying: 'true' } }],
        '@attr': { page: '1', totalPages: '1' },
      },
    });
    await expect(getNowPlaying('juan')).resolves.toMatchObject({ name: 'Agora', nowPlaying: true });
    expect(query().get('limit')).toBe('1');
    ok({ recenttracks: { track: [{ name: 'Antes', artist: { '#text': 'A' }, url: 'u', date: { uts: '1' } }] } });
    await expect(getNowPlaying('juan')).resolves.toBeNull();
  });

  it.each([
    [6, 'not_found'],
    [17, 'private'],
    [29, 'rate_limit'],
    [8, 'other'],
  ])('erro %s do Last.fm vira %s', async (code, kind) => {
    mockFetch.mockResolvedValue({ ok: false, json: async () => ({ error: code, message: 'x' }) });
    const error = await getUserInfo('juan').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(LastfmError);
    expect((error as LastfmError).kind).toBe(kind);
  });

  it('sem rede vira network', async () => {
    mockFetch.mockRejectedValue(new TypeError('Network request failed'));
    await expect(getUserInfo('juan')).rejects.toMatchObject({ kind: 'network' });
  });

  it('sem chave: no_key e nem chama a rede', async () => {
    process.env.EXPO_PUBLIC_LASTFM_API_KEY = '';
    expect(hasLastfmKey()).toBe(false);
    await expect(getUserInfo('juan')).rejects.toMatchObject({ kind: 'no_key' });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/lastfmApi.test.ts`
Expected: FAIL, "Cannot find module '../lib/lastfm/api'".

- [ ] **Step 3: Implementar**

`lib/lastfm/api.ts`:

```ts
import { mapRecentTracks, mapTop, mapUserInfo } from './map';
import type {
  LastfmErrorKind,
  LastfmPage,
  LastfmPeriod,
  LastfmTopItem,
  LastfmTopKind,
  LastfmTrack,
  LastfmUser,
} from './types';

/**
 * Chamadas ao Last.fm direto do app (a API libera CORS). Só leitura de dados públicos com a API key;
 * o shared secret nunca entra no projeto.
 */
const BASE = 'https://ws.audioscrobbler.com/2.0/';
export const LASTFM_PAGE = 50;

const ERROR_KINDS: Record<number, LastfmErrorKind> = { 6: 'not_found', 17: 'private', 29: 'rate_limit' };

export class LastfmError extends Error {
  constructor(
    readonly kind: LastfmErrorKind,
    message: string = kind,
  ) {
    super(message);
  }
}

/** Lida na hora (não no carregamento do módulo): sem chave, a aba avisa em vez de quebrar. */
const apiKey = () => process.env.EXPO_PUBLIC_LASTFM_API_KEY ?? '';

export function hasLastfmKey(): boolean {
  return apiKey().length > 0;
}

async function lastfmGet(method: string, params: Record<string, string | number>): Promise<unknown> {
  const key = apiKey();
  if (!key) throw new LastfmError('no_key');
  const query = Object.entries({ method, ...params, api_key: key, format: 'json' })
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
    .join('&');
  let res: Response;
  try {
    res = await fetch(`${BASE}?${query}`);
  } catch {
    throw new LastfmError('network');
  }
  let json: { error?: number; message?: string } | null = null;
  try {
    json = await res.json();
  } catch {
    throw new LastfmError('other');
  }
  if (json?.error) throw new LastfmError(ERROR_KINDS[json.error] ?? 'other', json.message);
  if (!res.ok) throw new LastfmError('other');
  return json;
}

export async function getUserInfo(user: string): Promise<LastfmUser> {
  return mapUserInfo(await lastfmGet('user.getinfo', { user }));
}

export async function getRecentTracks(user: string, page: number): Promise<LastfmPage<LastfmTrack>> {
  return mapRecentTracks(await lastfmGet('user.getrecenttracks', { user, page, limit: LASTFM_PAGE }));
}

export async function getTop(
  kind: LastfmTopKind,
  user: string,
  period: LastfmPeriod,
  page: number,
): Promise<LastfmPage<LastfmTopItem>> {
  return mapTop(kind, await lastfmGet(`user.gettop${kind}`, { user, period, page, limit: LASTFM_PAGE }));
}

/** A música tocando agora (vem marcada no topo das recentes), ou null. */
export async function getNowPlaying(user: string): Promise<LastfmTrack | null> {
  const page = mapRecentTracks(await lastfmGet('user.getrecenttracks', { user, limit: 1 }));
  return page.items.find((t) => t.nowPlaying) ?? null;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/lastfmApi.test.ts && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`. (Se o `new URL(...)` do teste não existir no ambiente jest do RN, trocar o helper `query()` do teste por um parse manual da query string — ruling no ledger.)

- [ ] **Step 5: Commit**

```bash
git add lib/lastfm/api.ts __tests__/lastfmApi.test.ts
git commit -m "Last.fm: chamadas e tradução de erros"
```

---

### Task 4: Hooks (`useLastfmPages`, `useNowPlaying`)

**Files:**
- Create: `lib/lastfm/useLastfmPages.ts`, `lib/lastfm/useNowPlaying.ts`
- Test: `__tests__/lastfmHooks.test.tsx`

**Interfaces:**
- Consumes: `LastfmError`, `getNowPlaying` (Task 3); `LastfmPage`, `LastfmTrack` (Task 2).
- Produces:
  - `useLastfmPages<T>(key: string | null, fetchPage: (page: number) => Promise<LastfmPage<T>>): { items: T[]; loading: boolean; error: LastfmError | null; loadMore: () => void; reload: () => void }`
  - `NOW_PLAYING_MS = 60_000`
  - `useNowPlaying(user: string | null): LastfmTrack | null` (usa `useFocusEffect` do expo-router)

- [ ] **Step 1: Teste que falha**

`__tests__/lastfmHooks.test.tsx`:

```tsx
import { act, renderHook, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return { useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]) };
});
const mockNowPlaying = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getNowPlaying: (user: string) => mockNowPlaying(user),
}));

import { LastfmError } from '../lib/lastfm/api';
import type { LastfmPage } from '../lib/lastfm/types';
import { useLastfmPages } from '../lib/lastfm/useLastfmPages';
import { NOW_PLAYING_MS, useNowPlaying } from '../lib/lastfm/useNowPlaying';

const page = (items: string[], n: number, total: number): LastfmPage<string> => ({ items, page: n, totalPages: total });

describe('useLastfmPages', () => {
  it('carrega a primeira página e as próximas até a última', async () => {
    const fetchPage = jest.fn((n: number) => Promise.resolve(page([`p${n}`], n, 2)));
    const { result } = await renderHook(() => useLastfmPages('k', fetchPage));
    await waitFor(() => expect(result.current.items).toEqual(['p1']));
    await act(async () => result.current.loadMore());
    await waitFor(() => expect(result.current.items).toEqual(['p1', 'p2']));
    await act(async () => result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(2);
  });

  it('conta vazia (0 páginas): não pede a página 2', async () => {
    const fetchPage = jest.fn(() => Promise.resolve(page([], 1, 0)));
    const { result } = await renderHook(() => useLastfmPages('k', fetchPage));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => result.current.loadMore());
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([]);
  });

  it('trocar a chave recomeça e ignora a resposta atrasada da anterior', async () => {
    let slow: (v: LastfmPage<string>) => void = () => {};
    const fetchA = jest.fn(() => new Promise<LastfmPage<string>>((r) => (slow = r)));
    const fetchB = jest.fn(() => Promise.resolve(page(['b1'], 1, 1)));
    const view = await renderHook(({ k, f }) => useLastfmPages(k, f), { initialProps: { k: 'a', f: fetchA } });
    await view.rerender({ k: 'b', f: fetchB });
    await waitFor(() => expect(view.result.current.items).toEqual(['b1']));
    await act(async () => slow(page(['a1'], 1, 1)));
    expect(view.result.current.items).toEqual(['b1']);
  });

  it('erro fica disponível e reload tenta de novo', async () => {
    const fetchPage = jest
      .fn()
      .mockRejectedValueOnce(new LastfmError('private'))
      .mockResolvedValueOnce(page(['ok'], 1, 1));
    const { result } = await renderHook(() => useLastfmPages('k', fetchPage));
    await waitFor(() => expect(result.current.error?.kind).toBe('private'));
    await act(async () => result.current.reload());
    await waitFor(() => expect(result.current.items).toEqual(['ok']));
    expect(result.current.error).toBeNull();
  });

  it('sem chave (sem usuário): não busca nada', async () => {
    const fetchPage = jest.fn();
    await renderHook(() => useLastfmPages(null, fetchPage));
    expect(fetchPage).not.toHaveBeenCalled();
  });
});

describe('useNowPlaying', () => {
  afterEach(() => jest.useRealTimers());

  it('busca ao abrir, de novo a cada 60 s, e para ao sair', async () => {
    jest.useFakeTimers();
    mockNowPlaying.mockResolvedValue({ name: 'Agora', artist: 'A', album: null, image: null, url: 'u', playedAt: null, nowPlaying: true });
    const view = await renderHook(() => useNowPlaying('juan'));
    await act(async () => {
      await Promise.resolve();
    });
    expect(view.result.current?.name).toBe('Agora');
    expect(mockNowPlaying).toHaveBeenCalledTimes(1);
    await act(async () => {
      jest.advanceTimersByTime(NOW_PLAYING_MS);
    });
    expect(mockNowPlaying).toHaveBeenCalledTimes(2);
    await view.unmount();
    await act(async () => {
      jest.advanceTimersByTime(NOW_PLAYING_MS * 3);
    });
    expect(mockNowPlaying).toHaveBeenCalledTimes(2);
  });

  it('sem usuário: null e nenhuma chamada', async () => {
    mockNowPlaying.mockClear();
    const { result } = await renderHook(() => useNowPlaying(null));
    expect(result.current).toBeNull();
    expect(mockNowPlaying).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/lastfmHooks.test.tsx`
Expected: FAIL, "Cannot find module '../lib/lastfm/useLastfmPages'".

- [ ] **Step 3: Implementar**

`lib/lastfm/useLastfmPages.ts`:

```ts
import { useCallback, useEffect, useRef, useState } from 'react';

import { LastfmError } from './api';
import type { LastfmPage } from './types';

/**
 * Lista do Last.fm em páginas (rolagem infinita). `key` identifica a lista (usuário + sub-aba +
 * período): trocou, recomeça do zero e a resposta atrasada da anterior é ignorada. null = não busca.
 */
export function useLastfmPages<T>(key: string | null, fetchPage: (page: number) => Promise<LastfmPage<T>>) {
  const [items, setItems] = useState<T[]>([]);
  const [page, setPage] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<LastfmError | null>(null);
  const requestId = useRef(0);
  const busy = useRef(false);
  const fetchRef = useRef(fetchPage);
  fetchRef.current = fetchPage;

  const load = useCallback((next: number, reset: boolean) => {
    const id = ++requestId.current;
    busy.current = true;
    setLoading(true);
    if (reset) setError(null);
    fetchRef
      .current(next)
      .then((p) => {
        if (id !== requestId.current) return;
        setItems((prev) => (reset ? p.items : [...prev, ...p.items]));
        setPage(p.page);
        setTotalPages(p.totalPages);
        setError(null);
      })
      .catch((e) => {
        if (id === requestId.current) setError(e instanceof LastfmError ? e : new LastfmError('other'));
      })
      .finally(() => {
        if (id === requestId.current) {
          busy.current = false;
          setLoading(false);
        }
      });
  }, []);

  useEffect(() => {
    setItems([]);
    setPage(0);
    setTotalPages(0);
    setError(null);
    if (key) load(1, true);
    else {
      requestId.current += 1;
      busy.current = false;
      setLoading(false);
    }
  }, [key, load]);

  const loadMore = useCallback(() => {
    if (!key || busy.current || error || page === 0 || page >= totalPages) return;
    load(page + 1, false);
  }, [key, error, page, totalPages, load]);

  const reload = useCallback(() => {
    if (key) load(1, true);
  }, [key, load]);

  return { items, loading, error, loadMore, reload };
}
```

`lib/lastfm/useNowPlaying.ts`:

```ts
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { getNowPlaying } from './api';
import type { LastfmTrack } from './types';

/** De quanto em quanto tempo o "ouvindo agora" pergunta de novo, com a tela à vista. */
export const NOW_PLAYING_MS = 60_000;

/** Música que a pessoa está ouvindo agora (ou null). Só pergunta com a tela focada. */
export function useNowPlaying(user: string | null): LastfmTrack | null {
  const [track, setTrack] = useState<LastfmTrack | null>(null);
  useFocusEffect(
    useCallback(() => {
      if (!user) {
        setTrack(null);
        return;
      }
      let alive = true;
      const check = () => {
        getNowPlaying(user)
          .then((t) => alive && setTrack(t))
          .catch(() => alive && setTrack(null));
      };
      check();
      const timer = setInterval(check, NOW_PLAYING_MS);
      return () => {
        alive = false;
        clearInterval(timer);
      };
    }, [user]),
  );
  return track;
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/lastfmHooks.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/lastfm/useLastfmPages.ts lib/lastfm/useNowPlaying.ts __tests__/lastfmHooks.test.tsx
git commit -m "Last.fm: lista paginada e ouvindo agora"
```

---

### Task 5: Peças visuais (`ArtistTile`, `TrackRow`, `TopRow`, `EqualizerBars`, `NowPlayingLine`)

Antes da UI: skill `impeccable` (contexto já carregado nesta sessão; ler `reference/craft-floor.md` se ainda não leu).

**Files:**
- Create: `components/music/ArtistTile.tsx`, `components/music/TrackRow.tsx`, `components/music/TopRow.tsx`, `components/music/EqualizerBars.tsx`, `components/music/NowPlayingLine.tsx`
- Test: `__tests__/musicUi.test.tsx`

**Interfaces:**
- Consumes: `LastfmTrack`, `LastfmTopItem`, `LastfmTopKind` (Task 2); `formatThousands` (Task 2); `useNowPlaying` (Task 4); `postTime` (`lib/format`); `Avatar`, `Icon`, `Text`, `interactiveStyle` (`components/ui`).
- Produces:
  - `ArtistTile({ name, uri, size, round }: { name: string; uri: string | null; size: number; round?: boolean })`
  - `TrackRow({ track, onPress }: { track: LastfmTrack; onPress: () => void })`
  - `TopRow({ item, kind, onPress }: { item: LastfmTopItem; kind: LastfmTopKind; onPress: () => void })`
  - `EqualizerBars()`
  - `NowPlayingLine({ user, onPress }: { user: string; onPress: () => void })`

- [ ] **Step 1: Teste que falha**

`__tests__/musicUi.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockUseNowPlaying = jest.fn();
jest.mock('../lib/lastfm/useNowPlaying', () => ({ useNowPlaying: (u: string) => mockUseNowPlaying(u) }));

import { ArtistTile } from '../components/music/ArtistTile';
import { NowPlayingLine } from '../components/music/NowPlayingLine';
import { TopRow } from '../components/music/TopRow';
import { TrackRow } from '../components/music/TrackRow';
import type { LastfmTrack } from '../lib/lastfm/types';

const track = (over: Partial<LastfmTrack> = {}): LastfmTrack => ({
  name: '360',
  artist: 'Charli xcx',
  album: 'Brat',
  image: 'https://x/c.png',
  url: 'u',
  playedAt: new Date(Date.now() - 4 * 60_000).toISOString(),
  nowPlaying: false,
  ...over,
});

describe('ArtistTile', () => {
  it('com imagem mostra a foto; artista sem foto mostra a inicial; capa vazia mostra a nota', async () => {
    const view = await render(<ArtistTile name="Pablo Vittar" uri="https://x/p.png" size={40} round />);
    expect(screen.getByLabelText('Imagem de Pablo Vittar')).toBeTruthy();
    await view.rerender(<ArtistTile name="Pablo Vittar" uri={null} size={40} round />);
    expect(screen.getByText('PV')).toBeTruthy();
    await view.rerender(<ArtistTile name="Brat" uri={null} size={40} />);
    expect(screen.getByTestId('cover-empty')).toBeTruthy();
  });
});

describe('TrackRow', () => {
  it('música, artista e há quanto tempo; tocando agora mostra "agora"', async () => {
    const onPress = jest.fn();
    const view = await render(<TrackRow track={track()} onPress={onPress} />);
    expect(screen.getByText('360')).toBeTruthy();
    expect(screen.getByText('Charli xcx')).toBeTruthy();
    expect(screen.getByText('há 4 min')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('360, de Charli xcx'));
    expect(onPress).toHaveBeenCalled();
    await view.rerender(<TrackRow track={track({ nowPlaying: true, playedAt: null })} onPress={onPress} />);
    expect(screen.getByText('● agora')).toBeTruthy();
    expect(screen.getByLabelText('360, de Charli xcx, ouvindo agora')).toBeTruthy();
  });
});

describe('TopRow', () => {
  it('posição, nome, artista e plays com milhar', async () => {
    const onPress = jest.fn();
    await render(
      <TopRow
        kind="albums"
        item={{ rank: 2, name: 'Brat', artist: 'Charli xcx', image: null, url: 'u', plays: 1240 }}
        onPress={onPress}
      />,
    );
    expect(screen.getByText('2')).toBeTruthy();
    expect(screen.getByText('1.240 plays')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('2º Brat, de Charli xcx, 1.240 plays'));
    expect(onPress).toHaveBeenCalled();
  });

  it('1 play no singular; artista sem linha de artista', async () => {
    await render(
      <TopRow kind="artists" item={{ rank: 1, name: 'Matuê', artist: null, image: null, url: 'u', plays: 1 }} onPress={() => {}} />,
    );
    expect(screen.getByText('1 play')).toBeTruthy();
    expect(screen.getByLabelText('1º Matuê, 1 play')).toBeTruthy();
  });
});

describe('NowPlayingLine', () => {
  it('aparece tocando, com rótulo, e abre a aba Música', async () => {
    mockUseNowPlaying.mockReturnValue(track({ name: 'Ama Sofre Chora', artist: 'Pablo Vittar', nowPlaying: true, playedAt: null }));
    const onPress = jest.fn();
    await render(<NowPlayingLine user="juan" onPress={onPress} />);
    expect(mockUseNowPlaying).toHaveBeenCalledWith('juan');
    await fireEvent.press(screen.getByLabelText('Ouvindo agora: Ama Sofre Chora, de Pablo Vittar'));
    expect(onPress).toHaveBeenCalled();
  });

  it('nada tocando: não aparece', async () => {
    mockUseNowPlaying.mockReturnValue(null);
    await render(<NowPlayingLine user="juan" onPress={() => {}} />);
    expect(screen.queryByLabelText(/Ouvindo agora/)).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/musicUi.test.tsx`
Expected: FAIL, "Cannot find module '../components/music/ArtistTile'".

- [ ] **Step 3: Implementar**

`components/music/ArtistTile.tsx`:

```tsx
import { Image, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Avatar, Icon } from '../ui';

type Props = { name: string; uri: string | null; size: number; round?: boolean };

/**
 * Capa de álbum/música ou imagem de artista. Artista sem foto (o Last.fm não fornece mais) vira a
 * inicial, como o Avatar sem foto; capa vazia vira um quadrado com nota musical.
 */
export function ArtistTile({ name, uri, size, round = false }: Props) {
  const t = useTheme();
  const radius = round ? size / 2 : size <= t.layout.minTouch / 2 ? t.radii.sm : t.radii.md;
  if (uri) {
    return (
      <Image
        accessibilityLabel={`Imagem de ${name}`}
        source={{ uri }}
        style={{ width: size, height: size, borderRadius: radius, backgroundColor: t.colors.surfaceSunken }}
      />
    );
  }
  if (round) return <Avatar name={name} uri={null} size={size} />;
  return (
    <View
      testID="cover-empty"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: t.colors.surfaceSunken,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Icon name="musical-notes-outline" size="sm" tone="muted" />
    </View>
  );
}
```

`components/music/TrackRow.tsx`:

```tsx
import { Pressable, View } from 'react-native';

import { postTime } from '../../lib/format';
import type { LastfmTrack } from '../../lib/lastfm/types';
import { useTheme } from '../../lib/theme';
import { interactiveStyle, Text } from '../ui';
import { ArtistTile } from './ArtistTile';

type Props = { track: LastfmTrack; onPress: () => void };

/** Uma música das recentes: capa, nome, artista e há quanto tempo (ou "● agora"). */
export function TrackRow({ track, onPress }: Props) {
  const t = useTheme();
  const label = `${track.name}, de ${track.artist}${track.nowPlaying ? ', ouvindo agora' : ''}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch + t.spacing.sm,
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.layout.gutter,
        ...interactiveStyle(t, state),
      })}
    >
      <ArtistTile name={track.album ?? track.name} uri={track.image} size={t.avatarSizes.md} />
      <View style={{ flex: 1 }}>
        <Text bold numberOfLines={1}>
          {track.name}
        </Text>
        <Text variant="small" tone="muted" numberOfLines={1}>
          {track.artist}
        </Text>
      </View>
      {track.nowPlaying ? (
        <Text variant="caption" bold style={{ color: t.colors.brand }}>
          ● agora
        </Text>
      ) : track.playedAt ? (
        <Text variant="caption" tone="muted">
          {postTime(track.playedAt)}
        </Text>
      ) : null}
    </Pressable>
  );
}
```

`components/music/TopRow.tsx`:

```tsx
import { Pressable, View } from 'react-native';

import { formatThousands } from '../../lib/lastfm/map';
import type { LastfmTopItem, LastfmTopKind } from '../../lib/lastfm/types';
import { useTheme } from '../../lib/theme';
import { interactiveStyle, Text } from '../ui';
import { ArtistTile } from './ArtistTile';

type Props = { item: LastfmTopItem; kind: LastfmTopKind; onPress: () => void };

/** Uma linha do ranking: posição, imagem, nome (e artista em álbuns/músicas) e plays. */
export function TopRow({ item, kind, onPress }: Props) {
  const t = useTheme();
  const plays = `${formatThousands(item.plays)} ${item.plays === 1 ? 'play' : 'plays'}`;
  const label = `${item.rank}º ${item.name}${item.artist ? `, de ${item.artist}` : ''}, ${plays}`;
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      onPress={onPress}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        minHeight: t.layout.minTouch + t.spacing.sm,
        paddingVertical: t.spacing.sm,
        paddingHorizontal: t.layout.gutter,
        ...interactiveStyle(t, state),
      })}
    >
      <Text variant="small" tone="muted" style={{ minWidth: t.spacing.xl, textAlign: 'right' }}>
        {String(item.rank)}
      </Text>
      <ArtistTile name={item.name} uri={item.image} size={t.avatarSizes.md} round={kind === 'artists'} />
      <View style={{ flex: 1 }}>
        <Text bold numberOfLines={1}>
          {item.name}
        </Text>
        {item.artist ? (
          <Text variant="small" tone="muted" numberOfLines={1}>
            {item.artist}
          </Text>
        ) : null}
      </View>
      <Text variant="caption" tone="muted">
        {plays}
      </Text>
    </Pressable>
  );
}
```

`components/music/EqualizerBars.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, View } from 'react-native';

import { useTheme } from '../../lib/theme';

const BARS = 3;

/** Três barrinhas subindo e descendo ("tocando agora"). Com "reduzir movimento", ficam paradas. */
export function EqualizerBars() {
  const t = useTheme();
  const height = t.iconSizes.sm * 0.6;
  const values = useRef(Array.from({ length: BARS }, () => new Animated.Value(0.4))).current;
  const [still, setStill] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then((reduce) => !cancelled && setStill(!!reduce))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (still) return;
    const loops = values.map((v, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.timing(v, { toValue: 1, duration: 300 + i * 120, easing: Easing.out(Easing.quad), useNativeDriver: true }),
          Animated.timing(v, { toValue: 0.3, duration: 300 + i * 120, easing: Easing.in(Easing.quad), useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [still, values]);

  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ flexDirection: 'row', alignItems: 'flex-end', gap: t.borders.hairline * 2, height }}
    >
      {values.map((v, i) => (
        <Animated.View
          key={i}
          style={{
            width: t.borders.hairline * 2,
            height,
            backgroundColor: t.colors.brand,
            transform: [{ scaleY: still ? 0.7 : v }],
          }}
        />
      ))}
    </View>
  );
}
```

`components/music/NowPlayingLine.tsx`:

```tsx
import { Pressable } from 'react-native';

import { useNowPlaying } from '../../lib/lastfm/useNowPlaying';
import { useTheme } from '../../lib/theme';
import { Text } from '../ui';
import { ArtistTile } from './ArtistTile';
import { EqualizerBars } from './EqualizerBars';

type Props = { user: string; onPress: () => void };

/** "Ouvindo agora" discreto no cabeçalho do perfil: só aparece com música tocando. */
export function NowPlayingLine({ user, onPress }: Props) {
  const t = useTheme();
  const track = useNowPlaying(user);
  if (!track) return null;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ouvindo agora: ${track.name}, de ${track.artist}`}
      onPress={onPress}
      hitSlop={t.spacing.xs}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.sm,
        alignSelf: 'flex-start',
        maxWidth: '100%',
        opacity: pressed ? 0.7 : 1,
        cursor: 'pointer' as const,
      })}
    >
      <ArtistTile name={track.album ?? track.name} uri={track.image} size={t.iconSizes.lg} />
      <EqualizerBars />
      <Text variant="small" numberOfLines={1} style={{ flexShrink: 1 }}>
        <Text variant="small" bold>
          {track.name}
        </Text>
        <Text variant="small" tone="muted">{` — ${track.artist}`}</Text>
      </Text>
    </Pressable>
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/musicUi.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`. Conferir também que o teste não deixa aviso de `act` nem processo aberto por causa das animações (`npx jest __tests__/musicUi.test.tsx 2>&1 | grep -c "not wrapped in act"` → 0).

- [ ] **Step 6: Commit**

```bash
git add components/music __tests__/musicUi.test.tsx
git commit -m "Last.fm: capa/inicial, linhas de música e ranking, barrinhas e ouvindo agora"
```

---

### Task 6: Aba Música (`MusicTab`)

**Files:**
- Create: `components/music/MusicTab.tsx`
- Test: `__tests__/musicTab.test.tsx`

**Interfaces:**
- Consumes: `getUserInfo`, `getRecentTracks`, `getTop`, `LastfmError` (Task 3); `useLastfmPages` (Task 4); `PERIODS`, `DEFAULT_PERIOD`, `formatThousands`, `sinceYear` (Task 2); `TrackRow`, `TopRow` (Task 5); `EmptyState`, `Divider`, `Text`, `interactiveStyle` (`components/ui`).
- Produces: `MusicTab({ user, top }: { user: string; top: ReactNode })` — uma `FlatList` cujo cabeçalho começa por `top` (o topo do perfil).

- [ ] **Step 1: Teste que falha**

`__tests__/musicTab.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Linking, Text } from 'react-native';

const mockInfo = jest.fn();
const mockRecent = jest.fn();
const mockTop = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  getUserInfo: (u: string) => mockInfo(u),
  getRecentTracks: (u: string, p: number) => mockRecent(u, p),
  getTop: (k: string, u: string, per: string, p: number) => mockTop(k, u, per, p),
}));

import { MusicTab } from '../components/music/MusicTab';
import { LastfmError } from '../lib/lastfm/api';

const recentPage = {
  items: [{ name: '360', artist: 'Charli xcx', album: 'Brat', image: null, url: 'https://last.fm/360', playedAt: new Date().toISOString(), nowPlaying: false }],
  page: 1,
  totalPages: 1,
};
const open = () => render(<MusicTab user="juan" top={<Text>topo do perfil</Text>} />);

beforeEach(() => {
  jest.clearAllMocks();
  mockInfo.mockResolvedValue({ name: 'juan', playcount: 12430, registeredAt: '2019-03-01T00:00:00.000Z' });
  mockRecent.mockResolvedValue(recentPage);
  mockTop.mockResolvedValue({ items: [{ rank: 1, name: 'Pablo Vittar', artist: null, image: null, url: 'u', plays: 212 }], page: 1, totalPages: 1 });
});

describe('MusicTab', () => {
  it('topo do perfil, resumo e Recentes de início', async () => {
    await open();
    expect(screen.getByText('topo do perfil')).toBeTruthy();
    expect(await screen.findByText('12.430 scrobbles · desde 2019')).toBeTruthy();
    expect(await screen.findByText('360')).toBeTruthy();
    expect(mockRecent).toHaveBeenCalledWith('juan', 1);
  });

  it('sub-aba Artistas usa 1 mês; trocar período busca de novo', async () => {
    await open();
    await fireEvent.press(screen.getByRole('tab', { name: 'Artistas' }));
    await waitFor(() => expect(mockTop).toHaveBeenCalledWith('artists', 'juan', '1month', 1));
    expect(await screen.findByText('Pablo Vittar')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: '7 dias' }));
    await waitFor(() => expect(mockTop).toHaveBeenLastCalledWith('artists', 'juan', '7day', 1));
  });

  it('Recentes não mostra seletor de período', async () => {
    await open();
    await screen.findByText('360');
    expect(screen.queryByRole('button', { name: '7 dias' })).toBeNull();
  });

  it('tocar numa música abre no Last.fm', async () => {
    const spy = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
    await open();
    await fireEvent.press(await screen.findByLabelText('360, de Charli xcx'));
    expect(spy).toHaveBeenCalledWith('https://last.fm/360');
  });

  it.each([
    ['private', 'O Last.fm dessa pessoa está privado.'],
    ['not_found', 'Esse usuário do Last.fm não existe mais.'],
    ['no_key', 'Last.fm não configurado.'],
  ])('erro %s mostra o aviso certo', async (kind, text) => {
    mockRecent.mockRejectedValue(new LastfmError(kind as never));
    await open();
    expect(await screen.findByText(text)).toBeTruthy();
  });

  it('falha de rede: tentar de novo', async () => {
    mockRecent.mockRejectedValueOnce(new LastfmError('network')).mockResolvedValueOnce(recentPage);
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('360')).toBeTruthy();
  });

  it('sem nada: "Nada por aqui ainda."', async () => {
    mockRecent.mockResolvedValue({ items: [], page: 1, totalPages: 0 });
    await open();
    expect(await screen.findByText('Nada por aqui ainda.')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/musicTab.test.tsx`
Expected: FAIL, "Cannot find module '../components/music/MusicTab'".

- [ ] **Step 3: Implementar**

`components/music/MusicTab.tsx`:

```tsx
import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, FlatList, Linking, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getRecentTracks, getTop, getUserInfo } from '../../lib/lastfm/api';
import { DEFAULT_PERIOD, formatThousands, PERIODS, sinceYear } from '../../lib/lastfm/map';
import type { LastfmPeriod, LastfmTopItem, LastfmTopKind, LastfmTrack, LastfmUser } from '../../lib/lastfm/types';
import { useLastfmPages } from '../../lib/lastfm/useLastfmPages';
import { useTheme } from '../../lib/theme';
import { Divider, EmptyState, Text } from '../ui';
import { TopRow } from './TopRow';
import { TrackRow } from './TrackRow';

type Section = 'recent' | LastfmTopKind;
const SECTIONS: { key: Section; label: string }[] = [
  { key: 'recent', label: 'Recentes' },
  { key: 'artists', label: 'Artistas' },
  { key: 'albums', label: 'Álbuns' },
  { key: 'tracks', label: 'Músicas' },
];

const ERROR_TEXT: Record<string, string> = {
  private: 'O Last.fm dessa pessoa está privado.',
  not_found: 'Esse usuário do Last.fm não existe mais.',
  no_key: 'Last.fm não configurado.',
};

const openUrl = (url: string) => {
  if (url) Linking.openURL(url).catch(() => {});
};

type Props = { user: string; top: ReactNode };

/** Aba Música do perfil: resumo, sub-abas (Recentes, Artistas, Álbuns, Músicas) e listas infinitas. */
export function MusicTab({ user, top }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const [section, setSection] = useState<Section>('recent');
  const [period, setPeriod] = useState<LastfmPeriod>(DEFAULT_PERIOD);
  const [info, setInfo] = useState<LastfmUser | null>(null);

  useEffect(() => {
    let alive = true;
    setInfo(null);
    // o resumo é extra: falhou, a aba segue sem ele
    getUserInfo(user)
      .then((u) => alive && setInfo(u))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [user]);

  const key = section === 'recent' ? `${user}:recent` : `${user}:${section}:${period}`;
  const fetchPage = useCallback(
    (page: number) => (section === 'recent' ? getRecentTracks(user, page) : getTop(section, user, period, page)),
    [user, section, period],
  );
  const { items, loading, error, loadMore, reload } = useLastfmPages<LastfmTrack | LastfmTopItem>(key, fetchPage);

  const since = sinceYear(info?.registeredAt ?? null);
  const header = (
    <View>
      {top}
      <View style={{ gap: t.spacing.sm, paddingHorizontal: t.layout.gutter, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm }}>
        {info ? (
          <Text variant="small" tone="muted">
            {`${formatThousands(info.playcount)} scrobbles${since ? ` · desde ${since}` : ''}`}
          </Text>
        ) : null}
        <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: t.spacing.sm }}>
          {SECTIONS.map((s) => {
            const on = s.key === section;
            return (
              <Pressable
                key={s.key}
                accessibilityRole="tab"
                accessibilityState={{ selected: on }}
                onPress={() => setSection(s.key)}
                style={{
                  minHeight: t.layout.minTouch * 0.75,
                  justifyContent: 'center',
                  paddingHorizontal: t.spacing.md,
                  borderRadius: t.radii.pill,
                  borderWidth: t.borders.hairline,
                  borderColor: on ? t.colors.primary : t.colors.border,
                  backgroundColor: on ? t.colors.primary : 'transparent',
                }}
              >
                <Text variant="small" bold={on} style={{ color: on ? t.colors.onPrimary : t.colors.textMuted }}>
                  {s.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
        {section !== 'recent' ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: t.spacing.md }}>
            {PERIODS.map((p) => {
              const on = p.value === period;
              return (
                <Pressable
                  key={p.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: on }}
                  accessibilityLabel={p.label}
                  onPress={() => setPeriod(p.value)}
                  hitSlop={t.spacing.sm}
                  style={{ paddingVertical: t.spacing.xs }}
                >
                  <Text
                    variant="small"
                    bold={on}
                    style={{ color: on ? t.colors.brand : t.colors.textMuted, textDecorationLine: on ? 'underline' : 'none' }}
                  >
                    {p.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </View>
    </View>
  );

  let empty;
  if (loading) {
    empty = (
      <View style={{ alignItems: 'center', gap: t.spacing.md, padding: t.spacing.xl }}>
        <ActivityIndicator color={t.colors.primary} />
        <Text tone="muted">Buscando as músicas…</Text>
      </View>
    );
  } else if (error && ERROR_TEXT[error.kind]) {
    empty = <EmptyState title={ERROR_TEXT[error.kind]} />;
  } else if (error) {
    empty = (
      <EmptyState
        title="Não deu pra falar com o Last.fm"
        message="Confere a internet e tenta de novo daqui a pouco."
        actionLabel="Tentar de novo"
        onAction={reload}
      />
    );
  } else {
    empty = <EmptyState title="Nada por aqui ainda." />;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(_, i) => `${key}:${i}`}
      ListHeaderComponent={header}
      ItemSeparatorComponent={Divider}
      ListEmptyComponent={empty}
      ListFooterComponent={
        loading && items.length > 0 ? (
          <ActivityIndicator style={{ padding: t.spacing.xl }} color={t.colors.primary} accessibilityLabel="Carregando mais" />
        ) : null
      }
      onEndReached={loadMore}
      onEndReachedThreshold={0.5}
      contentContainerStyle={{
        width: '100%',
        maxWidth: t.layout.maxContentWidth,
        alignSelf: 'center',
        paddingBottom: t.spacing.xxl + insets.bottom,
      }}
      renderItem={({ item }) =>
        section === 'recent' ? (
          <TrackRow track={item as LastfmTrack} onPress={() => openUrl(item.url)} />
        ) : (
          <TopRow item={item as LastfmTopItem} kind={section} onPress={() => openUrl(item.url)} />
        )
      }
    />
  );
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/musicTab.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add components/music/MusicTab.tsx __tests__/musicTab.test.tsx
git commit -m "Last.fm: aba Música com sub-abas, período e estados"
```

---

### Task 7: Perfil — linha no cabeçalho e aba Música

**Files:**
- Modify: `components/profile/ProfileHeader.tsx` (prop `onOpenMusic`, `NowPlayingLine`)
- Modify: `components/ProfileView.tsx` (`ProfileTab` + `'music'`, aba só com `lastfm_user`, `MusicTab` no lugar da lista)
- Test: `__tests__/profiles.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `NowPlayingLine` (Task 5), `MusicTab` (Task 6).
- Produces: `ProfileTab = 'posts' | 'photos' | 'music'`; `ProfileHeader` prop `onOpenMusic?: () => void`; `ProfileContent` prop `lastfmUser?: string | null`.

- [ ] **Step 1: Teste que falha**

Em `__tests__/profiles.test.tsx`, no topo (junto dos outros `jest.mock`):

```tsx
jest.mock('../components/music/MusicTab', () => {
  const { Text } = require('react-native');
  return { MusicTab: ({ user, top }: { user: string; top: unknown }) => <>{top}<Text>{`aba música de ${user}`}</Text></> };
});
jest.mock('../components/music/NowPlayingLine', () => {
  const { Pressable, Text } = require('react-native');
  return {
    NowPlayingLine: ({ user, onPress }: { user: string; onPress: () => void }) => (
      <Pressable accessibilityLabel={`ouvindo agora de ${user}`} onPress={onPress}>
        <Text>tocando</Text>
      </Pressable>
    ),
  };
});
```

e dentro de `describe('ProfileView', …)`:

```tsx
  it('com Last.fm: aba Música e ouvindo agora; tocar no ouvindo agora abre a aba', async () => {
    (profileRow as Record<string, unknown>).lastfm_user = 'juanfm';
    try {
      await renderProfile();
      expect(await screen.findByRole('tab', { name: 'Música' })).toBeTruthy();
      await fireEvent.press(screen.getByLabelText('ouvindo agora de juanfm'));
      expect(await screen.findByText('aba música de juanfm')).toBeTruthy();
      expect(screen.getByText('@ana_01')).toBeTruthy();
    } finally {
      delete (profileRow as Record<string, unknown>).lastfm_user;
    }
  });

  it('sem Last.fm: sem aba Música nem ouvindo agora', async () => {
    await renderProfile();
    await screen.findByText('@ana_01');
    expect(screen.queryByRole('tab', { name: 'Música' })).toBeNull();
    expect(screen.queryByLabelText(/ouvindo agora/)).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/profiles.test.tsx`
Expected: FAIL no teste "com Last.fm" (sem aba Música).

- [ ] **Step 3: Implementar**

Em `components/profile/ProfileHeader.tsx`:
- import: `import { NowPlayingLine } from '../music/NowPlayingLine';`
- `Props` ganha:

```ts
  /** Abre a aba Música (toque no "ouvindo agora"); sem isso a linha não aparece. */
  onOpenMusic?: () => void;
```

- assinatura: `export function ProfileHeader({ profile, avatarUri, bannerUri, actions, onOpenMusic }: Props) {`
- logo depois do bloco `<View>` que tem o nome e o `@{profile.username}`:

```tsx
        {profile.lastfm_user && onOpenMusic ? <NowPlayingLine user={profile.lastfm_user} onPress={onOpenMusic} /> : null}
```

Em `components/ProfileView.tsx`:
- `export type ProfileTab = 'posts' | 'photos' | 'music';`
- import: `import { MusicTab } from './music/MusicTab';`
- em `ProfileView`, no `<ProfileContent …>`: acrescentar `lastfmUser={profile.lastfm_user}`.
- em `ContentProps`: `lastfmUser?: string | null;` e na desestruturação de `ProfileContent`: `lastfmUser,`.
- em `ProfileContent`, trocar o `ListHeaderComponent` inline por uma variável `top` (o mesmo JSX: cabeçalho, números, abas), com duas mudanças: o `ProfileHeader` recebe `onOpenMusic={lastfmUser ? () => onTabChange('music') : undefined}` e o `Tabs` recebe os itens

```tsx
              items={[
                { key: 'posts', label: 'Posts' },
                { key: 'photos', label: 'Fotos' },
                ...(lastfmUser ? [{ key: 'music' as const, label: 'Música' }] : []),
              ]}
```

- antes do `return` atual, acrescentar:

```tsx
  if (tab === 'music' && lastfmUser) {
    return (
      <SafeAreaView edges={header ? ['left', 'right'] : ['top', 'left', 'right']} style={{ flex: 1, backgroundColor: t.colors.bg }}>
        <MusicTab user={lastfmUser} top={top} />
      </SafeAreaView>
    );
  }
```

- e no `FlatList` de posts/fotos usar `ListHeaderComponent={top}`.
- Em `ProfileView`, se o perfil carregar sem `lastfm_user` e a aba for `'music'` (ex.: a pessoa tirou o Last.fm), voltar para `'posts'`:

```tsx
  useEffect(() => {
    if (tab === 'music' && profile && !profile.lastfm_user) setTab('posts');
  }, [tab, profile]);
```

(`current` continua `tab === 'posts' ? posts : photos`; na aba Música ele não é usado.)

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/profiles.test.tsx __tests__/badges.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add components/profile/ProfileHeader.tsx components/ProfileView.tsx __tests__/profiles.test.tsx
git commit -m "Last.fm: ouvindo agora no cabeçalho e aba Música no perfil"
```

---

### Task 8: Editar perfil — usuário do Last.fm

**Files:**
- Modify: `lib/api/profiles.ts` (`UpdateProfileInput.lastfmUser`, gravação)
- Modify: `app/profile/edit.tsx` (campo, validação, conferência no Last.fm)
- Test: `__tests__/profiles.test.tsx` (`updateMyProfile`), `__tests__/editProfile.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `isValidLastfmUser` (Task 2); `getUserInfo`, `hasLastfmKey`, `LastfmError` (Task 3).
- Produces: `UpdateProfileInput.lastfmUser?: string | null` → `fields.lastfm_user`.

- [ ] **Step 1: Testes que falham**

Em `__tests__/profiles.test.tsx`, dentro de `describe('updateMyProfile', …)`:

```tsx
  it('usuário do Last.fm: grava aparado; vazio vira null', async () => {
    await updateMyProfile({ display_name: 'Ana', username: 'ana_01', bio: '', lastfmUser: ' juanfm ' });
    expect(mockUpdate.mock.calls[0][0].lastfm_user).toBe('juanfm');
    mockUpdate.mockClear();
    await updateMyProfile({ display_name: 'Ana', username: 'ana_01', bio: '', lastfmUser: '' });
    expect(mockUpdate.mock.calls[0][0].lastfm_user).toBeNull();
  });
```

Em `__tests__/editProfile.test.tsx`, no topo (junto dos mocks):

```tsx
const mockGetUserInfo = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  hasLastfmKey: () => true,
  getUserInfo: (u: string) => mockGetUserInfo(u),
}));
```

e no fim do arquivo:

```tsx
describe('Editar perfil: Last.fm', () => {
  const { LastfmError } = jest.requireActual('../lib/lastfm/api');
  beforeEach(() => {
    (updateMyProfile as jest.Mock).mockClear();
    mockGetUserInfo.mockReset().mockResolvedValue({ name: 'juanfm', playcount: 1, registeredAt: null });
  });

  it('usuário que existe: confere no Last.fm e salva', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), 'juanfm');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(mockGetUserInfo).toHaveBeenCalledWith('juanfm');
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ lastfmUser: 'juanfm' }));
  });

  it('usuário que não existe: erro no campo e não salva', async () => {
    mockGetUserInfo.mockRejectedValue(new LastfmError('not_found'));
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), 'naoexiste');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(await screen.findByText('Não achamos esse usuário no Last.fm.')).toBeTruthy();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('formato inválido: nem pergunta ao Last.fm', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), 'juan peixoto');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(await screen.findByText('Usuário do Last.fm inválido.')).toBeTruthy();
    expect(mockGetUserInfo).not.toHaveBeenCalled();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('usuário igual ao salvo (mesmo com o Last.fm fora): não pergunta e salva', async () => {
    mockGetUserInfo.mockRejectedValue(new LastfmError('network'));
    (getProfile as jest.Mock).mockResolvedValueOnce({ id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null, lastfm_user: 'juanfm' });
    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Usuário no Last.fm').props.value).toBe('juanfm'));
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(mockGetUserInfo).not.toHaveBeenCalled();
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ lastfmUser: 'juanfm' }));
  });

  it('apagar o campo desconecta', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce({ id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null, lastfm_user: 'juanfm' });
    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Usuário no Last.fm').props.value).toBe('juanfm'));
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), '');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ lastfmUser: '' }));
  });
});
```

(Se `waitFor` não estiver no import do topo do `editProfile.test.tsx`, acrescentar.)

- [ ] **Step 2: Rodar e ver falhar**

Run: `npx jest __tests__/profiles.test.tsx __tests__/editProfile.test.tsx`
Expected: FAIL nos testes novos (sem campo / sem gravação).

- [ ] **Step 3: Implementar**

Em `lib/api/profiles.ts`, em `UpdateProfileInput`, depois de `removeBanner?: boolean;`:

```ts
  /** Usuário do Last.fm; vazio desconecta (null); undefined não altera. */
  lastfmUser?: string | null;
```

e depois de `if (input.birthday !== undefined) fields.birthday = emptyToNull(input.birthday);`:

```ts
  if (input.lastfmUser !== undefined) fields.lastfm_user = emptyToNull(input.lastfmUser);
```

Em `app/profile/edit.tsx`:
- imports: `import { getUserInfo, hasLastfmKey, LastfmError } from '../../lib/lastfm/api';` e `import { isValidLastfmUser } from '../../lib/lastfm/map';`
- estados (junto dos outros):

```tsx
  const [lastfm, setLastfm] = useState('');
  /** O que está salvo: igual a isso, não pergunta de novo ao Last.fm. */
  const [savedLastfm, setSavedLastfm] = useState('');
  const [lastfmError, setLastfmError] = useState<string | undefined>();
```

- no `.then((p) => { … })` do carregamento, junto dos outros `set…`:

```tsx
        setLastfm(p.lastfm_user ?? '');
        setSavedLastfm(p.lastfm_user ?? '');
```

- em `save()`, logo depois de `setUsernameError(undefined);`:

```tsx
    setLastfmError(undefined);
    const lastfmUser = lastfm.trim();
    if (lastfmUser && lastfmUser !== savedLastfm) {
      if (!isValidLastfmUser(lastfmUser)) {
        setSaving(false);
        return setLastfmError('Usuário do Last.fm inválido.');
      }
      if (hasLastfmKey()) {
        try {
          await getUserInfo(lastfmUser);
        } catch (e) {
          setSaving(false);
          return setLastfmError(
            e instanceof LastfmError && e.kind === 'not_found'
              ? 'Não achamos esse usuário no Last.fm.'
              : 'Não deu pra conferir no Last.fm agora. Tenta de novo.',
          );
        }
      }
    }
```

  e no objeto passado a `updateMyProfile`, acrescentar `lastfmUser,`.
- no formulário, depois do campo "Cidade":

```tsx
        <TextField
          label="Usuário no Last.fm"
          placeholder="seu_usuario"
          help="Pra mostrar o que você ouve no seu perfil."
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={15}
          value={lastfm}
          onChangeText={(v) => {
            setLastfm(v);
            if (lastfmError) setLastfmError(undefined);
          }}
          error={lastfmError}
        />
```

- [ ] **Step 4: Rodar e ver passar**

Run: `npx jest __tests__/profiles.test.tsx __tests__/editProfile.test.tsx && npx tsc --noEmit && echo tsc ok`
Expected: PASS; `tsc ok`.

- [ ] **Step 5: Commit**

```bash
git add lib/api/profiles.ts app/profile/edit.tsx __tests__/profiles.test.tsx __tests__/editProfile.test.tsx
git commit -m "Last.fm: usuário no Editar perfil, conferido no Last.fm ao salvar"
```

---

### Task 9: Verificação final

- [ ] **Step 1: Suíte inteira**

Run: `npx tsc --noEmit && npm test`
Expected: tsc sem saída; todas as suítes passam.

- [ ] **Step 2: Passada visual (Impeccable, uma rodada)**

Com a chave no `.env` e `EXPO_PUBLIC_DEV_FAKE_LOGIN=1 npx expo start --web --port 8099`: deixar o `fakeProfile` temporariamente com `lastfm_user` de uma conta pública do Last.fm (marcar `TEMP-PREVIEW`) e o `ProfileView` carregando o `fakeProfile` no login falso (como já foi feito antes, `TEMP-PREVIEW`). Conferir no celular (moldura 390px) e no computador: linha "ouvindo agora" (se a conta estiver tocando), aba Música, troca de sub-aba e período, capas, inicial de artista, rolagem infinita. Desfazer todo `TEMP-PREVIEW` e `git checkout -- tsconfig.json`.

- [ ] **Step 3: Avisar o Juan**

1. Aplicar a migration: `! export $(grep '^SUPABASE_ACCESS_TOKEN=' .env | xargs) && npx supabase db query --linked -f supabase/migrations/0019_lastfm_user.sql`
2. Criar o secret `EXPO_PUBLIC_LASTFM_API_KEY` no GitHub (Settings → Secrets and variables → Actions → New repository secret) com a API key — sem isso o site publicado mostra "Last.fm não configurado".
