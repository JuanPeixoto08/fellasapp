# Compartilhar post no story — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Botão no post que monta uma imagem de story 9:16 ("Recorte") e manda para o story do Instagram (planilha de compartilhar / baixar) ou para o story do Fellas, com "Ver post" no story.

**Architecture:** A imagem é desenhada num `<canvas>` 1080×1920 na web. A lógica fica em funções puras testáveis (`lib/storyCard/source.ts` transforma o post, `layout.ts` calcula posições e quebra de linha com uma `measure` injetada, `contrast.ts` escolhe cores pelo fundo); `draw.ts` só aplica o layout no canvas e `share.ts` fala com `navigator.share`. O montador (`components/share/StoryShareDialog.tsx`) mostra a imagem gerada como prévia; o story do Fellas reaproveita `uploadStoryMedia` + `createStory` com a nova coluna `stories.post_id`.

**Tech Stack:** Expo Router + React Native Web, TypeScript, Supabase (Postgres/RLS), Cloudinary (stories), Jest + @testing-library/react-native 14 (`await render`, `await fireEvent.press`).

**Spec:** `docs/superpowers/specs/2026-10-09-compartilhar-no-story-design.md`

## Global Constraints

- Texto da interface em pt-BR, no tom do `PRODUCT.md` (informal, "você", botões dizem a ação). Sem emoji como ícone.
- Telas usam tokens de `lib/theme.ts` e componentes de `components/ui`. Sem cores/tamanhos/raios/fontes soltos nas telas; primitivo que falta vai para `components/ui` com tokens.
- Cores da imagem são fixas (token `storyCard`), iguais nos dois temas.
- Imagem: 1080 × 1920; faixas do Instagram sem conteúdo: topo 250, base 340; JPEG qualidade 0,92.
- Fundos: `photo` (só post com foto; padrão quando existe), `violeta` `#5B3FD9` (padrão sem foto), `tinta` `#121212`, `vermelho` `#C81E3A`, `papel` `#EAE5D8`.
- Texto: 72 px se ≤ 80 caracteres e sem anexo; senão 54; desce de 2 em 2 até 40; ainda não cabe → corta com "…".
- O botão de compartilhar só aparece com `Platform.OS === 'web'`.
- Qualquer post pode ser compartilhado (sem conferência de autor).
- Commits em pt-BR, **sem** `Co-Authored-By` nem marca de IA.
- `npx tsc --noEmit` e `npm test` passam no fim de cada tarefa.
- O `db push` da migração quem roda é o Juan (com `!`), depois de conferir as colunas.

## Review Focus

1. **Emoji e acento no corte do texto** — o "…" nunca parte um emoji ao meio (par substituto). Teste na Tarefa 4.
2. **Post só com foto (sem texto)** — sai recorte com cabeçalho + foto, sem bloco de texto vazio. Teste na Tarefa 4.
3. **Safari do iPhone exige `navigator.share` dentro do toque** — o botão Instagram chama `shareOrDownload` na hora, com o Blob já pronto (sem `await` antes). Testes nas Tarefas 5 e 7.
4. **Nome/@usuário enormes** — cortados com "…" na largura do cabeçalho, sem invadir a borda do recorte. Teste na Tarefa 4.
5. **Fechar no meio do envio** — o ✕ fica desabilitado enquanto o story sobe (não deixa um envio órfão com o montador fechado). Teste na Tarefa 7.

---

## Mapa de arquivos

| Arquivo | Papel |
|---|---|
| `supabase/migrations/0032_story_post_link.sql` (novo) | coluna `stories.post_id` |
| `types/database.ts` | tipos de `stories` com `post_id` |
| `lib/api/stories.ts` | `Story.postId`, `createStory({ postId })`, `listActiveStories` lê `post_id` |
| `lib/theme.ts` | tokens `storyCard`, `layout.storyShare`, `motion.confirm` |
| `lib/logoPath.ts` (novo) | desenho do FELLAS (sai de `Logo.tsx`) |
| `lib/avatarLook.ts` (novo) | iniciais e cor do avatar (sai de `Avatar.tsx`) |
| `lib/storyCard/contrast.ts` (novo) | fundos, rótulos, cores por fundo |
| `lib/storyCard/source.ts` (novo) | `FeedPost` → `CardSource` |
| `lib/storyCard/layout.ts` (novo) | posições, quebra de linha, tamanho da letra, corte |
| `lib/storyCard/draw.ts` (novo) | carrega fontes/imagens, desenha no canvas, gera Blob |
| `lib/storyCard/share.ts` (novo) | planilha de compartilhar ou baixar |
| `components/ui/Button.tsx` | `icon` + variantes `overlay` / `overlayOutline` |
| `components/share/StoryShareDialog.tsx` (novo) | o montador |
| `components/feed/ShareButton.tsx` (novo) | ícone na fila de ações |
| `components/PostCard.tsx` | botão + montador |
| `components/stories/StoryViewer.tsx` | pílula "Ver post" |
| `DESIGN.md` | seção do compartilhar |

---

### Tarefa 0: Branch

- [ ] **Passo 1:** a partir da `main` limpa:

```bash
git checkout -b compartilhar-story
```

---

### Tarefa 1: Coluna `stories.post_id` + API dos stories

**Files:**
- Create: `supabase/migrations/0032_story_post_link.sql`
- Create: `__tests__/storyPostLinkMigration.test.ts`
- Modify: `types/database.ts:445-450` (bloco `stories`)
- Modify: `lib/api/stories.ts` (tipo `Story`, `createStory`, `Row`, `listActiveStories`)
- Test: `__tests__/storiesApi.test.ts`

**Interfaces:**
- Produces: `Story.postId?: string | null`; `createStory(input: { kind: StoryKind; mediaId: string; durationMs: number; postId?: string }): Promise<void>`.

- [ ] **Passo 1: teste da migração (falha)** — `__tests__/storyPostLinkMigration.test.ts`:

```ts
declare const require: (id: string) => { readFileSync: (path: string, encoding: string) => string };
declare const __dirname: string;

const { readFileSync } = require('fs');
const sql = readFileSync(`${__dirname}/../supabase/migrations/0032_story_post_link.sql`, 'utf8');

describe('0032_story_post_link.sql', () => {
  it('story ligado ao post; post apagado só tira o link (o story continua)', () => {
    expect(sql).toMatch(
      /alter table public\.stories\s+add column if not exists post_id uuid references public\.posts \(id\) on delete set null/,
    );
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/storyPostLinkMigration.test.ts` → FAIL (ENOENT, arquivo não existe).

- [ ] **Passo 3: migração** — `supabase/migrations/0032_story_post_link.sql`:

```sql
-- fellasapp: story que veio de um post ("compartilhar no story"). Idempotente.
-- Quem assiste vê "Ver post". Post apagado: o story continua (a imagem já é dele), só perde o link.
-- Sem mudança de RLS: o insert já exige o próprio author_id e ser membro, e todo membro lê qualquer post.
alter table public.stories
  add column if not exists post_id uuid references public.posts (id) on delete set null;
```

- [ ] **Passo 4:** `npx jest __tests__/storyPostLinkMigration.test.ts` → PASS.

- [ ] **Passo 5: testes da API (falham)** — em `__tests__/storiesApi.test.ts`, dentro de `describe('createStory e reactToStory', ...)`, depois do `it('cria em meu nome', ...)`:

```ts
  it('story que veio de um post grava o post_id', async () => {
    await createStory({ kind: 'photo', mediaId: `stories/${'1'.repeat(64)}`, durationMs: 5000, postId: 'p9' });
    expect(mockCalls.find((c) => c.table === 'stories' && c.op === 'insert')?.args[0]).toEqual({
      author_id: 'me', kind: 'photo', media_id: `stories/${'1'.repeat(64)}`, duration_ms: 5000, post_id: 'p9',
    });
  });
```

E dentro de `describe('listActiveStories', ...)`:

```ts
  it('lê o post de origem (null quando não veio de post)', async () => {
    mockResults['stories.select'] = {
      data: [
        { id: 's1', author_id: 'ana', kind: 'photo', media_id: `stories/${'1'.repeat(64)}`, duration_ms: 5000, created_at: '2026-10-04T08:00:00Z', post_id: 'p9', author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null } },
        { id: 's2', author_id: 'ana', kind: 'photo', media_id: `stories/${'2'.repeat(64)}`, duration_ms: 5000, created_at: '2026-10-04T09:00:00Z', post_id: null, author: { id: 'ana', username: 'ana', display_name: 'Ana', avatar_url: null } },
      ],
      error: null,
    };
    const [ana] = await listActiveStories(new Date('2026-10-04T12:00:00Z'));
    const select = mockCalls.find((c) => c.table === 'stories' && c.op === 'select')?.args[0] as string;
    expect(select).toContain('post_id');
    expect(ana.stories.map((s) => s.postId)).toEqual(['p9', null]);
  });
```

- [ ] **Passo 6:** `npx jest __tests__/storiesApi.test.ts` → FAIL (`post_id` ausente no insert; `postId` undefined).

- [ ] **Passo 7: implementação** — `types/database.ts`, troque o bloco `stories` por:

```ts
      stories: {
        Row: { id: string; author_id: string; kind: string; media_id: string; duration_ms: number; created_at: string; post_id: string | null };
        Insert: { id?: string; author_id: string; kind: string; media_id: string; duration_ms: number; created_at?: string; post_id?: string | null };
        Update: { id?: string; author_id?: string; kind?: string; media_id?: string; duration_ms?: number; created_at?: string; post_id?: string | null };
        Relationships: [];
      };
```

Em `lib/api/stories.ts`:

1. No tipo `Story`, depois de `myReaction: string | null`, acrescente: ` /** Post de onde o story veio ("compartilhar no story"): mostra "Ver post". */ postId?: string | null`.
2. Troque `createStory` por:

```ts
export async function createStory(input: { kind: StoryKind; mediaId: string; durationMs: number; postId?: string }): Promise<void> {
  const me = await getCurrentUserId();
  const { error } = await supabase.from('stories').insert({
    author_id: me,
    kind: input.kind,
    media_id: input.mediaId,
    duration_ms: input.durationMs,
    ...(input.postId ? { post_id: input.postId } : {}),
  });
  if (error) throw error;
}
```

3. No tipo `Row`, acrescente `post_id?: string | null;` depois de `created_at: string;`.
4. No `.select(...)` de `listActiveStories`, troque `'id, author_id, kind, media_id, duration_ms, created_at, author:...'` por `'id, author_id, kind, media_id, duration_ms, created_at, post_id, author:...'` (o resto da string igual).
5. No objeto `story: Story = { ... }`, acrescente `postId: r.post_id ?? null,` depois de `myReaction: mine.get(r.id) ?? null`.

- [ ] **Passo 8:** `npx jest __tests__/storiesApi.test.ts __tests__/storyPostLinkMigration.test.ts` → PASS. `npx tsc --noEmit` → sem erros.

- [ ] **Passo 9: commit**

```bash
git add supabase/migrations/0032_story_post_link.sql __tests__/storyPostLinkMigration.test.ts types/database.ts lib/api/stories.ts __tests__/storiesApi.test.ts
git commit -m "Stories: post de origem (0032) para o compartilhar no story"
```

---

### Tarefa 2: Tokens, desenho do logo e cara do avatar fora dos componentes

**Files:**
- Modify: `lib/theme.ts` (tokens novos)
- Create: `lib/logoPath.ts`, `lib/avatarLook.ts`
- Modify: `components/ui/Logo.tsx`, `components/ui/Avatar.tsx`
- Create: `lib/storyCard/contrast.ts`
- Test: `__tests__/storyCardContrast.test.ts`

**Interfaces:**
- Produces:
  - `storyCard` (const em `lib/theme.ts`, ver código), `layout.storyShare = { width: 340, dot: 30 }`, `motion.confirm = 1200`.
  - `LOGO_PATH: string`, `LOGO_VIEWBOX: { width: 4248; height: 888 }` (`lib/logoPath.ts`).
  - `initials(name: string): string`, `avatarColor(name: string): string`, `INITIALS_SCALE = 0.4` (`lib/avatarLook.ts`).
  - `type StoryBackground = 'photo' | 'violeta' | 'tinta' | 'vermelho' | 'papel'`, `BACKGROUND_ORDER: StoryBackground[]`, `BACKGROUND_LABEL: Record<StoryBackground, string>`, `luminance(hex: string): number`, `type CardPalette = { bg: string | null; mark: string; tape: string; paper: string; shadow: CardShadow }`, `type CardShadow = { color: string; blur: number; offsetY: number }`, `paletteFor(bg: StoryBackground): CardPalette` (`lib/storyCard/contrast.ts`).

- [ ] **Passo 1: teste (falha)** — `__tests__/storyCardContrast.test.ts`:

```ts
import { BACKGROUND_LABEL, BACKGROUND_ORDER, luminance, paletteFor } from '../lib/storyCard/contrast';
import { storyCard } from '../lib/theme';

describe('cores do recorte por fundo', () => {
  it('luminância relativa: branco 1, preto 0', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
  });

  it('fundo papel (claro): marca em tinta, recorte branco, fita e sombra claras', () => {
    const p = paletteFor('papel');
    expect(p.bg).toBe(storyCard.backgrounds.papel);
    expect(p.mark).toBe(storyCard.ink);
    expect(p.paper).toBe(storyCard.paperOnLight);
    expect(p.tape).toBe(storyCard.tapeOnLight);
    expect(p.shadow).toBe(storyCard.shadowOnLight);
  });

  it.each(['violeta', 'tinta', 'vermelho'] as const)('fundo %s (escuro): marca em papel', (bg) => {
    const p = paletteFor(bg);
    expect(p.bg).toBe(storyCard.backgrounds[bg]);
    expect(p.mark).toBe(storyCard.paper);
    expect(p.paper).toBe(storyCard.paper);
  });

  it('fundo da foto vai escurecido: conta como escuro e não tem cor própria', () => {
    const p = paletteFor('photo');
    expect(p.bg).toBeNull();
    expect(p.mark).toBe(storyCard.paper);
  });

  it('ordem das bolinhas e rótulos acessíveis', () => {
    expect(BACKGROUND_ORDER).toEqual(['photo', 'violeta', 'tinta', 'vermelho', 'papel']);
    expect(BACKGROUND_LABEL.violeta).toBe('Fundo violeta');
    expect(BACKGROUND_LABEL.photo).toBe('Fundo com a foto do post');
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/storyCardContrast.test.ts` → FAIL (módulo não existe).

- [ ] **Passo 3: tokens** — em `lib/theme.ts`:

No objeto `layout`, antes de `gutter: spacing.lg,`:

```ts
  /** Montador "compartilhar no story": largura da janela no computador e bolinha de fundo. */
  storyShare: { width: 340, dot: 30 },
```

Troque `export const motion = { fast: 120, base: 180 } as const;` por:

```ts
/** Durações em ms. `confirm`: quanto um "deu certo" fica à vista antes de fechar. */
export const motion = { fast: 120, base: 180, confirm: 1200 } as const;
```

Depois do bloco `gameTable`, acrescente:

```ts
/**
 * Imagem do "compartilhar no story" (1080 × 1920, desenhada no canvas): cores fixas, iguais nos dois temas
 * (a imagem é um objeto, como a mesa dos games), e medidas em px da imagem.
 */
export const storyCard = {
  width: 1080,
  height: 1920,
  /** Faixas que o Instagram cobre (perfil no topo, resposta embaixo): sem conteúdo importante. */
  safeTop: 250,
  safeBottom: 340,
  backgrounds: { violeta: '#5B3FD9', tinta: '#121212', vermelho: '#C81E3A', papel: '#EAE5D8' },
  /** Fundo "foto": reduzida a 1/20 e esticada de volta (desfoque que funciona em qualquer navegador) + escurecido. */
  photoBlurScale: 20,
  photoDim: 'rgba(18, 18, 18, 0.38)',
  paper: '#F4F1EA',
  paperOnLight: '#FFFFFF',
  ink: '#121212',
  inkMuted: 'rgba(18, 18, 18, 0.62)',
  brand: '#5B3FD9',
  brandSoft: '#E6DFFB',
  sunken: '#EAE5D8',
  like: '#C81E3A',
  tape: 'rgba(244, 241, 234, 0.62)',
  tapeOnLight: 'rgba(255, 255, 255, 0.7)',
  shadow: { color: 'rgba(0, 0, 0, 0.30)', blur: 72, offsetY: 28 },
  shadowOnLight: { color: 'rgba(18, 18, 18, 0.16)', blur: 48, offsetY: 16 },
  /** Selo "+N" sobre a foto. */
  badge: { bg: 'rgba(18, 18, 18, 0.6)', fg: '#F4F1EA', height: 80, padX: 28, size: 44, inset: 24 },
  /** Recorte: margem lateral, respiro interno, giro, quanto sobe do centro (fração da altura) e vão entre blocos. */
  clip: { margin: 104, padding: 60, rotateDeg: -2.2, lift: 0.05, gap: 36 },
  tapeSize: { width: 248, height: 68, leftDeg: -28, rightDeg: 24 },
  header: { avatar: 120, gap: 32, name: 50, meta: 42, nameLine: 60, metaLine: 55 },
  text: { big: 72, normal: 54, min: 40, step: 2, lineHeight: 1.4, bigMaxChars: 80 },
  photo: { radius: 24, minAspect: 4 / 5, maxAspect: 16 / 9, maxHeight: 600, minHeight: 240 },
  poll: { row: 132, gap: 16, radius: 16, stroke: 4, padX: 32, label: 46, footer: 40, footerLine: 56 },
  ticket: { thumb: 200, posterRatio: 1.5, gap: 32, radius: 12, title: 50, titleLine: 62, meta: 40, metaLine: 54 },
  /** Marca FELLAS: altura, distância da base e o vão mínimo até o recorte. */
  mark: { height: 48, bottom: 384, gap: 64 },
  jpegQuality: 0.92,
} as const;
```

- [ ] **Passo 4: logo e avatar fora dos componentes** — `lib/logoPath.ts`:

```ts
// "FELLAS" desenhado uma vez com a Monocraft Bold (Idrees Hassan, SIL Open Font License 1.1, uso comercial
// liberado) e convertido em contorno. O app distribui só este desenho, não o arquivo da fonte.
// Usado pelo <Logo> (SVG) e pela imagem do "compartilhar no story" (canvas).
export const LOGO_VIEWBOX = { width: 4248, height: 888 } as const;
export const LOGO_PATH =
  'M0 888V0H648V168H168V240H408V408H168V888ZM720 888V0H1368V168H888V240H1128V408H888V720H1368V888ZM1440 888V0H1608V720H2088V888ZM2160 888V0H2328V720H2808V888ZM3048 240H3360V168H3048ZM2880 888V120H3000V0H3408V120H3528V888H3360V408H3048V888ZM3720 888V768H3600V600H3768V720H4080V408H3720V288H3600V120H3720V0H4248V168H3768V240H4128V360H4248V768H4128V888Z';
```

Em `components/ui/Logo.tsx`, apague o comentário da Monocraft e as constantes `VIEWBOX`, `ASPECT`, `D` e troque por:

```ts
import { LOGO_PATH, LOGO_VIEWBOX } from '../../lib/logoPath';

const VIEWBOX = `0 0 ${LOGO_VIEWBOX.width} ${LOGO_VIEWBOX.height}`;
const ASPECT = LOGO_VIEWBOX.width / LOGO_VIEWBOX.height;
```

e no `<Path d={D} …>` use `d={LOGO_PATH}`.

`lib/avatarLook.ts`:

```ts
import { avatarPalette } from './theme';

/** Tamanho das iniciais em relação ao avatar. */
export const INITIALS_SCALE = 0.4;

/** "Caio Ramos" → "CR"; um nome só → uma letra; vazio → "?". */
export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (parts[0][0] + last).toUpperCase();
}

/** Cor de papel/pastel do avatar sem foto, sempre a mesma para o mesmo nome. */
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return avatarPalette[h % avatarPalette.length];
}
```

Em `components/ui/Avatar.tsx`: apague as funções locais `initials` e `colorFor`; troque o import do tema por `import { avatarInk, useTheme } from '../../lib/theme';`, acrescente `import { avatarColor, initials, INITIALS_SCALE } from '../../lib/avatarLook';`, use `avatarColor(name)` no lugar de `colorFor(name)` e `fontSize: Math.round(size * INITIALS_SCALE)`.

- [ ] **Passo 5: contraste** — `lib/storyCard/contrast.ts`:

```ts
import { storyCard } from '../theme';

export type StoryBackground = 'photo' | 'violeta' | 'tinta' | 'vermelho' | 'papel';

/** Ordem das bolinhas no montador (a da foto só aparece em post com foto). */
export const BACKGROUND_ORDER: StoryBackground[] = ['photo', 'violeta', 'tinta', 'vermelho', 'papel'];

export const BACKGROUND_LABEL: Record<StoryBackground, string> = {
  photo: 'Fundo com a foto do post',
  violeta: 'Fundo violeta',
  tinta: 'Fundo tinta',
  vermelho: 'Fundo vermelho',
  papel: 'Fundo papel',
};

export type CardShadow = { color: string; blur: number; offsetY: number };
export type CardPalette = { bg: string | null; mark: string; tape: string; paper: string; shadow: CardShadow };

/** Luminância relativa (WCAG) de uma cor `#RRGGBB`. */
export function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Cores que mudam com o fundo: marca FELLAS, fita, papel do recorte e sombra. Fundo claro (papel) pede
 * marca em tinta e recorte branco; o resto (e a foto, que vai escurecida) pede marca em papel.
 */
export function paletteFor(bg: StoryBackground): CardPalette {
  const color = bg === 'photo' ? null : storyCard.backgrounds[bg];
  const light = color !== null && luminance(color) > 0.5;
  return {
    bg: color,
    mark: light ? storyCard.ink : storyCard.paper,
    tape: light ? storyCard.tapeOnLight : storyCard.tape,
    paper: light ? storyCard.paperOnLight : storyCard.paper,
    shadow: light ? storyCard.shadowOnLight : storyCard.shadow,
  };
}
```

- [ ] **Passo 6:** `npx jest __tests__/storyCardContrast.test.ts __tests__/avatar* __tests__/PostCard.test.tsx` → PASS (os do avatar/logo continuam passando). `npx tsc --noEmit` → sem erros.

- [ ] **Passo 7: commit**

```bash
git add lib/theme.ts lib/logoPath.ts lib/avatarLook.ts components/ui/Logo.tsx components/ui/Avatar.tsx lib/storyCard/contrast.ts __tests__/storyCardContrast.test.ts
git commit -m "Compartilhar no story: tokens da imagem, cores por fundo; logo e avatar reaproveitáveis fora dos componentes"
```

---

### Tarefa 3: Post → conteúdo do recorte (`source.ts`)

**Files:**
- Create: `lib/storyCard/source.ts`
- Test: `__tests__/storyCardSource.test.ts`

**Interfaces:**
- Consumes: `FeedPost`, `FeedPoll` (`lib/api/posts`), `PostMedia` (`lib/postMedia`), `postTime` (`lib/format`), `splitMentions` (`lib/mentions`), `pollPercents`, `pollWinners`, `pollTimeLeft`, `votesLabel` (`lib/polls`).
- Produces:

```ts
export type Segment = { text: string; highlight: boolean };
export type PollSource = { options: string[]; percents: number[]; winners: number[]; footer: string };
export type TicketSource = { kind: 'track' | 'review'; image: string | null; title: string; lines: string[] };
export type CardSource = {
  name: string; username: string; avatarUrl: string | null; time: string; location: string | null;
  segments: Segment[]; bodyLength: number; photoUrl: string | null; extraPhotos: number;
  poll: PollSource | null; ticket: TicketSource | null;
};
export function cardSource<M>(post: FeedPost, byUsername: Map<string, M>, now?: Date): CardSource;
```

- [ ] **Passo 1: teste (falha)** — `__tests__/storyCardSource.test.ts`:

```ts
import type { FeedPost } from '../lib/api/posts';
import { cardSource } from '../lib/storyCard/source';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

const post: FeedPost = {
  id: 'p1',
  body: '  bora @juan no #rolê com o @ze  ',
  images: [],
  imageUrl: null,
  createdAt: '2026-10-09T10:00:00Z',
  author: { id: 'u1', username: 'caio', display_name: 'Caio Ramos', avatar_url: 'https://x/av.jpg' },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
};
const members = new Map([['juan', { id: 'u2', username: 'juan', name: 'Juan', avatarUrl: null }]]);
const now = new Date('2026-10-09T12:00:00Z');

describe('cardSource', () => {
  it('autor, horário do app e local', () => {
    const s = cardSource({ ...post, location: 'Padaria do Zé' }, members, now);
    expect([s.name, s.username, s.avatarUrl, s.time, s.location]).toEqual(['Caio Ramos', 'caio', 'https://x/av.jpg', 'há 2 h', 'Padaria do Zé']);
  });

  it('sem nome de exibição, usa o @usuario', () => {
    expect(cardSource({ ...post, author: { ...post.author, display_name: null } }, members, now).name).toBe('caio');
  });

  it('texto sem espaços nas pontas; menção de fella e #tag destacadas, @ de quem não existe não', () => {
    const s = cardSource(post, members, now);
    expect(s.segments.map((p) => p.text).join('')).toBe('bora @juan no #rolê com o @ze');
    expect(s.segments.filter((p) => p.highlight).map((p) => p.text)).toEqual(['@juan', '#rolê']);
    expect(s.bodyLength).toBe(Array.from('bora @juan no #rolê com o @ze').length);
  });

  it('post sem texto: sem trechos', () => {
    expect(cardSource({ ...post, body: '   ' }, members, now).segments).toEqual([]);
  });

  it('primeira foto e quantas sobram', () => {
    const s = cardSource({ ...post, images: ['https://x/a.jpg', 'https://x/b.jpg', 'https://x/c.jpg'] }, members, now);
    expect([s.photoUrl, s.extraPhotos]).toEqual(['https://x/a.jpg', 2]);
    expect(cardSource(post, members, now).photoUrl).toBeNull();
  });

  it('enquete aberta: porcentagens, mais votada e total', () => {
    const s = cardSource({ ...post, poll: { options: ['sim', 'não'], counts: [3, 1], endsAt: '2026-10-10T12:00:00Z', myVote: null } }, members, now);
    expect(s.poll).toEqual({ options: ['sim', 'não'], percents: [75, 25], winners: [0], footer: '4 votos' });
  });

  it('enquete encerrada e sem votos', () => {
    const closed = cardSource({ ...post, poll: { options: ['a', 'b'], counts: [0, 0], endsAt: '2026-10-09T11:00:00Z', myVote: null } }, members, now);
    expect(closed.poll).toEqual({ options: ['a', 'b'], percents: [0, 0], winners: [], footer: '0 votos · Resultado final' });
  });

  it('música: capa, nome, artista e álbum', () => {
    const s = cardSource({ ...post, media: { kind: 'track', title: 'Tempo Perdido', artist: 'Legião Urbana', album: 'Dois', image: null, url: 'https://www.last.fm/music/x', live: false } }, members, now);
    expect(s.ticket).toEqual({ kind: 'track', image: null, title: 'Tempo Perdido', lines: ['Legião Urbana', 'Dois'] });
  });

  it('filme: pôster, título e "ano · estrelas · ♥"', () => {
    const s = cardSource({
      ...post,
      media: { kind: 'review', title: 'Ainda Estou Aqui', year: 2024, rating: 4.5, liked: true, rewatch: false, watched: null, poster: 'https://a.ltrbxd.com/p.jpg', url: 'https://letterboxd.com/x/film/y/', text: '', spoiler: false },
    }, members, now);
    expect(s.ticket).toEqual({ kind: 'review', image: 'https://a.ltrbxd.com/p.jpg', title: 'Ainda Estou Aqui', lines: ['2024 · ★★★★½ · ♥'] });
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/storyCardSource.test.ts` → FAIL (módulo não existe).

- [ ] **Passo 3: implementação** — `lib/storyCard/source.ts`:

```ts
import type { FeedPoll, FeedPost } from '../api/posts';
import { postTime } from '../format';
import { splitMentions } from '../mentions';
import { pollPercents, pollTimeLeft, pollWinners, votesLabel } from '../polls';
import type { PostMedia } from '../postMedia';

/** Pedaço do texto do post; `highlight` = menção de fella, #tag ou link (em `brand`, como no app). */
export type Segment = { text: string; highlight: boolean };
export type PollSource = { options: string[]; percents: number[]; winners: number[]; footer: string };
/** Ingresso em versão mini: capa/pôster, título e linhas de detalhe. */
export type TicketSource = { kind: 'track' | 'review'; image: string | null; title: string; lines: string[] };

/** O que entra no recorte, já em texto pronto (sem nada de desenho). */
export type CardSource = {
  name: string;
  username: string;
  avatarUrl: string | null;
  time: string;
  location: string | null;
  segments: Segment[];
  bodyLength: number;
  photoUrl: string | null;
  extraPhotos: number;
  poll: PollSource | null;
  ticket: TicketSource | null;
};

/** O post como vai para a imagem do story. */
export function cardSource<M>(post: FeedPost, byUsername: Map<string, M>, now: Date = new Date()): CardSource {
  const body = post.body.trim();
  return {
    name: post.author.display_name || post.author.username,
    username: post.author.username,
    avatarUrl: post.author.avatar_url ?? null,
    time: postTime(post.createdAt, now),
    location: post.location ?? null,
    segments: body
      ? splitMentions(body, byUsername, { tags: true }).map((p) => ({ text: p.text, highlight: !!(p.member || p.tag || p.url) }))
      : [],
    bodyLength: Array.from(body).length,
    photoUrl: post.images[0] ?? null,
    extraPhotos: Math.max(0, post.images.length - 1),
    poll: post.poll ? pollSource(post.poll, now) : null,
    ticket: post.media ? ticketSource(post.media) : null,
  };
}

function pollSource(poll: FeedPoll, now: Date): PollSource {
  const total = poll.counts.reduce((a, b) => a + b, 0);
  const closed = pollTimeLeft(poll.endsAt, now.getTime()) === null;
  return {
    options: poll.options,
    percents: pollPercents(poll.counts),
    winners: pollWinners(poll.counts),
    footer: closed ? `${votesLabel(total)} · Resultado final` : votesLabel(total),
  };
}

/** 4,5 → "★★★★½". */
function stars(rating: number): string {
  const full = Math.floor(rating);
  return '★'.repeat(full) + (rating - full >= 0.5 ? '½' : '');
}

function ticketSource(m: PostMedia): TicketSource {
  if (m.kind === 'track') return { kind: 'track', image: m.image, title: m.title, lines: m.album ? [m.artist, m.album] : [m.artist] };
  const line = [m.year !== null ? String(m.year) : null, m.rating !== null ? stars(m.rating) : null, m.liked ? '♥' : null]
    .filter((x): x is string => x !== null)
    .join(' · ');
  return { kind: 'review', image: m.poster, title: m.title, lines: line ? [line] : [] };
}
```

- [ ] **Passo 4:** `npx jest __tests__/storyCardSource.test.ts` → PASS. Se `#rolê` não vier destacado, confira `TAG_RE` em `lib/tags.ts` (aceita letras Unicode, 2–30) antes de mexer no teste.

- [ ] **Passo 5: commit**

```bash
git add lib/storyCard/source.ts __tests__/storyCardSource.test.ts
git commit -m "Compartilhar no story: conteúdo do recorte a partir do post"
```

---

### Tarefa 4: Layout do recorte (`layout.ts`)

**Files:**
- Create: `lib/storyCard/layout.ts`
- Test: `__tests__/storyCardLayout.test.ts`

**Interfaces:**
- Consumes: `CardSource`, `Segment`, `TicketSource` (Tarefa 3); `storyCard`, `fonts` (`lib/theme`).
- Produces:

```ts
export type Measure = (text: string, font: string) => number;
export type FontWeight = 'regular' | 'semibold' | 'bold';
export function font(weight: FontWeight, size: number): string; // `54px "GolosText_400Regular"`
export type Run = { text: string; highlight: boolean };
export type Line = Run[];
export type Box = { x: number; y: number; width: number; height: number };
export type Label = { x: number; y: number; text: string };
export type PollRow = Box & { label: string; percent: number; winner: boolean };
export type CardLayout = {
  clip: Box; avatar: Box; name: Label; meta: Label; location: Label | null;
  text: { x: number; y: number; size: number; lineHeight: number; lines: Line[] } | null;
  poll: { rows: PollRow[]; footer: Label } | null;
  ticket: { thumb: Box; x: number; titleY: number; title: string[]; metaY: number; meta: string[] } | null;
  photo: (Box & { extra: number }) | null;
};
export function ellipsize(text: string, maxWidth: number, f: string, measure: Measure): string;
export function wrapSegments(segments: Segment[], maxWidth: number, size: number, measure: Measure): Line[];
export function layoutCard(src: CardSource, assets: { photoAspect: number | null }, measure: Measure): CardLayout;
```

Coordenadas em px da imagem, `y` = topo da linha/caixa; o recorte é calculado reto (o desenho gira em volta do centro dele).

- [ ] **Passo 1: teste (falha)** — `__tests__/storyCardLayout.test.ts`:

```ts
import { font, layoutCard, type Line, type Measure } from '../lib/storyCard/layout';
import type { CardSource } from '../lib/storyCard/source';
import { storyCard as S } from '../lib/theme';

const sizeOf = (f: string) => Number(/^(\d+)px/.exec(f)![1]);
/** Largura falsa: meia letra por caractere (um emoji conta como 1). */
const measure: Measure = (text, f) => Array.from(text).length * sizeOf(f) * 0.5;
const widthOf = (line: Line, size: number) =>
  line.reduce((w, r) => w + measure(r.text, font(r.highlight ? 'semibold' : 'regular', size)), 0);

const INNER = S.width - 2 * S.clip.margin - 2 * S.clip.padding;
const MAX_BOTTOM = S.height - S.mark.bottom - S.mark.height - S.mark.gap;
const HEAD_W = INNER - S.header.avatar - S.header.gap;

const base: CardSource = {
  name: 'Caio Ramos', username: 'caio', avatarUrl: null, time: 'há 2 h', location: null,
  segments: [], bodyLength: 0, photoUrl: null, extraPhotos: 0, poll: null, ticket: null,
};
const withText = (text: string, extra: Partial<CardSource> = {}): CardSource => ({
  ...base, segments: [{ text, highlight: false }], bodyLength: Array.from(text).length, ...extra,
});
const noPhoto = { photoAspect: null };
const joined = (lines: Line[]) => lines.map((l) => l.map((r) => r.text).join(''));

describe('layoutCard', () => {
  it('texto curto sem anexo vira cartaz (72) e cada linha cabe', () => {
    const L = layoutCard(withText('o padeiro pediu bis e a gente deu'), noPhoto, measure);
    expect(L.text!.size).toBe(S.text.big);
    for (const line of L.text!.lines) expect(widthOf(line, 72)).toBeLessThanOrEqual(INNER);
  });

  it('recorte centrado um pouco acima do meio, dentro das faixas', () => {
    const L = layoutCard(withText('oi'), noPhoto, measure);
    expect(L.clip.y + L.clip.height / 2).toBeLessThan(S.height / 2);
    expect(L.clip.y).toBeGreaterThanOrEqual(S.safeTop);
    expect(L.clip.x).toBe(S.clip.margin);
    expect(L.clip.width).toBe(S.width - 2 * S.clip.margin);
  });

  it('com foto, texto no normal (54) e a foto com +N na largura do recorte', () => {
    const L = layoutCard(withText('o padeiro pediu bis', { photoUrl: 'https://x/a.jpg', extraPhotos: 2 }), { photoAspect: 4 / 3 }, measure);
    expect(L.text!.size).toBe(S.text.normal);
    expect(L.photo).toMatchObject({ width: INNER, height: Math.round(INNER / (4 / 3)), extra: 2 });
  });

  it('foto em pé fica no máximo 4:5 e 600 de altura', () => {
    const L = layoutCard(withText('oi', { photoUrl: 'https://x/a.jpg' }), { photoAspect: 0.5 }, measure);
    expect(L.photo!.height).toBe(S.photo.maxHeight);
  });

  it('foto que não carregou não entra', () => {
    expect(layoutCard(withText('oi', { photoUrl: 'https://x/a.jpg' }), noPhoto, measure).photo).toBeNull();
  });

  it('post só com foto: cabeçalho + foto, sem bloco de texto', () => {
    const L = layoutCard({ ...base, photoUrl: 'https://x/a.jpg' }, { photoAspect: 1 }, measure);
    expect(L.text).toBeNull();
    expect(L.photo!.y).toBe(L.clip.y + S.clip.padding + S.header.avatar + S.clip.gap);
  });

  it('texto longo desce até 40, corta com … e o recorte não invade a marca', () => {
    const L = layoutCard(withText('palavra '.repeat(400)), noPhoto, measure);
    expect(L.text!.size).toBe(S.text.min);
    const last = L.text!.lines[L.text!.lines.length - 1];
    expect(last[last.length - 1].text.endsWith('…')).toBe(true);
    expect(L.clip.y).toBeGreaterThanOrEqual(S.safeTop);
    expect(L.clip.y + L.clip.height).toBeLessThanOrEqual(MAX_BOTTOM);
    for (const line of L.text!.lines) expect(widthOf(line, S.text.min)).toBeLessThanOrEqual(INNER);
  });

  it('palavra maior que a linha quebra por letra', () => {
    const L = layoutCard(withText('a'.repeat(100)), noPhoto, measure);
    // 100 > 80 caracteres: 54 px, 27 px por letra, 27 letras por linha
    expect(joined(L.text!.lines)).toEqual(['a'.repeat(27), 'a'.repeat(27), 'a'.repeat(27), 'a'.repeat(19)]);
  });

  it('quebra de linha do post vira linha nova', () => {
    expect(joined(layoutCard(withText('oi\ntudo bem'), noPhoto, measure).text!.lines)).toEqual(['oi', 'tudo bem']);
  });

  it('menção continua destacada depois de quebrar', () => {
    const src = { ...base, segments: [{ text: 'bora ', highlight: false }, { text: '@juan', highlight: true }, { text: ' hoje', highlight: false }], bodyLength: 15 };
    const runs = layoutCard(src, noPhoto, measure).text!.lines.flat();
    expect(runs.filter((r) => r.highlight).map((r) => r.text)).toEqual(['@juan']);
  });

  it('o corte nunca parte um emoji', () => {
    const L = layoutCard(withText('😂'.repeat(3000)), noPhoto, measure);
    const all = joined(L.text!.lines).join('');
    expect(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(all)).toBe(false);
    expect(all.endsWith('…')).toBe(true);
  });

  it('nome e @usuario compridos são cortados na largura do cabeçalho', () => {
    const L = layoutCard({ ...withText('oi'), name: 'x'.repeat(200), username: 'y'.repeat(30) }, noPhoto, measure);
    expect(L.name.text.endsWith('…')).toBe(true);
    expect(measure(L.name.text, font('bold', S.header.name))).toBeLessThanOrEqual(HEAD_W);
    expect(measure(L.meta.text, font('regular', S.header.meta))).toBeLessThanOrEqual(HEAD_W);
  });

  it('local entra numa linha a mais do cabeçalho', () => {
    const L = layoutCard(withText('oi', { location: 'Padaria do Zé' }), noPhoto, measure);
    expect(L.location).toMatchObject({ text: 'Padaria do Zé', y: L.meta.y + S.header.metaLine });
  });

  it('enquete: uma linha por opção, mais votada marcada e rodapé', () => {
    const L = layoutCard(withText('qual?', { poll: { options: ['sim', 'não', 'talvez'], percents: [50, 25, 25], winners: [0], footer: '4 votos' } }), noPhoto, measure);
    expect(L.poll!.rows.map((r) => [r.label, r.percent, r.winner])).toEqual([['sim', 50, true], ['não', 25, false], ['talvez', 25, false]]);
    expect(L.poll!.rows[1].y - L.poll!.rows[0].y).toBe(S.poll.row + S.poll.gap);
    expect(L.poll!.footer.text).toBe('4 votos');
    expect(L.text!.size).toBe(S.text.normal);
  });

  it('ingresso: pôster 2:3 no filme, capa quadrada na música, título em até 2 linhas', () => {
    const review = layoutCard(withText('vi', { ticket: { kind: 'review', image: null, title: 'um título bem comprido '.repeat(6), lines: ['2024 · ★★★★'] } }), noPhoto, measure);
    expect(review.ticket!.thumb.height).toBe(S.ticket.thumb * S.ticket.posterRatio);
    expect(review.ticket!.title.length).toBe(2);
    expect(review.ticket!.title[1].endsWith('…')).toBe(true);
    const track = layoutCard(withText('ouvi', { ticket: { kind: 'track', image: null, title: 'Tempo Perdido', lines: ['Legião Urbana'] } }), noPhoto, measure);
    expect(track.ticket!.thumb.height).toBe(S.ticket.thumb);
    expect(track.ticket!.meta).toEqual(['Legião Urbana']);
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/storyCardLayout.test.ts` → FAIL (módulo não existe).

- [ ] **Passo 3: implementação** — `lib/storyCard/layout.ts`:

```ts
import { fonts, storyCard as S } from '../theme';
import type { CardSource, Segment, TicketSource } from './source';

/** Largura de um texto numa fonte: no app, o `measureText` do canvas; nos testes, uma conta. */
export type Measure = (text: string, font: string) => number;
export type FontWeight = 'regular' | 'semibold' | 'bold';

/** Fonte no formato do canvas, com as famílias registradas pelo expo-font: `54px "GolosText_400Regular"`. */
export function font(weight: FontWeight, size: number): string {
  const family = weight === 'bold' ? fonts.bodyBold : weight === 'semibold' ? fonts.displaySemiBold : fonts.body;
  return `${size}px "${family}"`;
}

export type Run = { text: string; highlight: boolean };
export type Line = Run[];
export type Box = { x: number; y: number; width: number; height: number };
export type Label = { x: number; y: number; text: string };
export type PollRow = Box & { label: string; percent: number; winner: boolean };

/** Tudo no lugar, em px da imagem (`y` = topo). O recorte vem reto: o desenho gira em volta do centro dele. */
export type CardLayout = {
  clip: Box;
  avatar: Box;
  name: Label;
  meta: Label;
  location: Label | null;
  text: { x: number; y: number; size: number; lineHeight: number; lines: Line[] } | null;
  poll: { rows: PollRow[]; footer: Label } | null;
  ticket: { thumb: Box; x: number; titleY: number; title: string[]; metaY: number; meta: string[] } | null;
  photo: (Box & { extra: number }) | null;
};

const runFont = (r: { highlight: boolean }, size: number) => font(r.highlight ? 'semibold' : 'regular', size);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));
const lineOf = (size: number) => Math.round(size * S.text.lineHeight);

function trimEnd(line: Line): void {
  const last = line[line.length - 1];
  if (!last) return;
  last.text = last.text.replace(/ +$/, '');
  if (!last.text) line.pop();
}

/** Corta com "…" até caber (letra a letra, sem partir emoji). */
export function ellipsize(text: string, maxWidth: number, f: string, measure: Measure): string {
  if (measure(text, f) <= maxWidth) return text;
  const chars = Array.from(text);
  while (chars.length && measure(`${chars.join('').trimEnd()}…`, f) > maxWidth) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/**
 * Quebra os trechos (os destacados usam a fonte semibold) em linhas que cabem em `maxWidth`. Respeita as
 * quebras de linha do post; palavra maior que a linha quebra por letra.
 */
export function wrapSegments(segments: Segment[], maxWidth: number, size: number, measure: Measure): Line[] {
  const lines: Line[] = [];
  let line: Line = [];
  let width = 0;
  const push = (text: string, highlight: boolean) => {
    const last = line[line.length - 1];
    if (last && last.highlight === highlight) last.text += text;
    else line.push({ text, highlight });
  };
  const breakLine = () => {
    trimEnd(line);
    lines.push(line);
    line = [];
    width = 0;
  };
  for (const seg of segments) {
    const f = runFont(seg, size);
    for (const tok of seg.text.split(/(\n| +)/)) {
      if (!tok) continue;
      if (tok === '\n') {
        breakLine();
        continue;
      }
      const w = measure(tok, f);
      if (/^ +$/.test(tok)) {
        // espaço no começo da linha some
        if (line.length) {
          push(tok, seg.highlight);
          width += w;
        }
        continue;
      }
      if (width + w <= maxWidth) {
        push(tok, seg.highlight);
        width += w;
        continue;
      }
      if (line.length) breakLine();
      if (w <= maxWidth) {
        push(tok, seg.highlight);
        width = w;
        continue;
      }
      let chunk = '';
      for (const ch of Array.from(tok)) {
        if (chunk && measure(chunk + ch, f) > maxWidth) {
          push(chunk, seg.highlight);
          breakLine();
          chunk = '';
        }
        chunk += ch;
      }
      push(chunk, seg.highlight);
      width = measure(chunk, f);
    }
  }
  if (line.length) {
    trimEnd(line);
    lines.push(line);
  }
  return lines;
}

/** Fica com `max` linhas; a última termina em "…" (tira letras do fim até caber). */
function truncate(lines: Line[], max: number, maxWidth: number, size: number, measure: Measure): Line[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max).map((l) => l.map((r) => ({ ...r })));
  const last = kept[max - 1];
  const widthOf = (l: Line) => l.reduce((w, r) => w + measure(r.text, runFont(r, size)), 0);
  const dots = measure('…', font('regular', size));
  while (last.length && widthOf(last) + dots > maxWidth) {
    const r = last[last.length - 1];
    r.text = Array.from(r.text).slice(0, -1).join('');
    if (!r.text) last.pop();
  }
  trimEnd(last);
  last.push({ text: '…', highlight: false });
  return kept;
}

/** Quebra simples por palavra, até `maxLines`; o que sobra vira "…" na última. */
function wrapPlain(text: string, maxWidth: number, f: string, measure: Measure, maxLines: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w;
    if (!cur || measure(next, f) <= maxWidth) cur = next;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  if (lines.length > maxLines) {
    const kept = lines.slice(0, maxLines);
    kept[maxLines - 1] = ellipsize(`${kept[maxLines - 1]} ${lines[maxLines]}`, maxWidth, f, measure);
    return kept;
  }
  return lines.map((l) => ellipsize(l, maxWidth, f, measure));
}

function ticketBlock(t: TicketSource, inner: number, measure: Measure) {
  const T = S.ticket;
  const w = inner - T.thumb - T.gap;
  const thumbH = t.kind === 'review' ? T.thumb * T.posterRatio : T.thumb;
  const title = wrapPlain(t.title, w, font('bold', T.title), measure, 2);
  const meta = t.lines.map((l) => ellipsize(l, w, font('regular', T.meta), measure));
  return { thumbH, title, meta, height: Math.max(thumbH, title.length * T.titleLine + meta.length * T.metaLine) };
}

/**
 * Monta o recorte: cabeçalho, texto, enquete, ingresso e foto (a ordem do post). Enquete e ingresso têm
 * tamanho fixo; a foto encolhe até sobrar uma linha de texto; o texto desce de tamanho e, no mínimo, corta.
 */
export function layoutCard(src: CardSource, assets: { photoAspect: number | null }, measure: Measure): CardLayout {
  const { clip: C, header: H, poll: P, ticket: T } = S;
  const clipW = S.width - 2 * C.margin;
  const inner = clipW - 2 * C.padding;
  const x0 = C.margin + C.padding;
  const maxBottom = S.height - S.mark.bottom - S.mark.height - S.mark.gap;
  const maxClip = maxBottom - S.safeTop;

  // cabeçalho: avatar e, ao lado, nome, "@usuario · horário" e o local
  const headX = x0 + H.avatar + H.gap;
  const headW = inner - H.avatar - H.gap;
  const headTextH = H.nameLine + H.metaLine + (src.location ? H.metaLine : 0);
  const headerH = Math.max(H.avatar, headTextH);

  const pollH = src.poll ? src.poll.options.length * (P.row + P.gap) + P.footerLine : 0;
  const ticket = src.ticket ? ticketBlock(src.ticket, inner, measure) : null;
  const ticketH = ticket ? ticket.height : 0;
  const hasText = src.segments.length > 0;
  const photoAspect = src.photoUrl && assets.photoAspect && assets.photoAspect > 0 ? assets.photoAspect : null;
  const blocks = [hasText, !!src.poll, !!ticket, photoAspect !== null].filter(Boolean).length;
  const fixed = 2 * C.padding + headerH + blocks * C.gap + pollH + ticketH;

  const naturalPhoto = photoAspect
    ? Math.min(S.photo.maxHeight, inner / clamp(photoAspect, S.photo.minAspect, S.photo.maxAspect))
    : 0;
  const photoH = photoAspect
    ? Math.round(clamp(maxClip - fixed - (hasText ? lineOf(S.text.min) : 0), S.photo.minHeight, naturalPhoto))
    : 0;

  // texto: cartaz quando é curto e está sozinho; senão normal, descendo até caber
  let size: number = hasText && blocks === 1 && src.bodyLength <= S.text.bigMaxChars ? S.text.big : S.text.normal;
  let lines: Line[] = [];
  if (hasText) {
    const room = maxClip - fixed - photoH;
    lines = wrapSegments(src.segments, inner, size, measure);
    while (lines.length * lineOf(size) > room && size > S.text.min) {
      size = Math.max(S.text.min, size - S.text.step);
      lines = wrapSegments(src.segments, inner, size, measure);
    }
    lines = truncate(lines, Math.max(1, Math.floor(room / lineOf(size))), inner, size, measure);
  }
  const lineHeight = lineOf(size);
  const textH = lines.length * lineHeight;

  const clipH = fixed + photoH + textH;
  const clipY = clamp(Math.round((S.height - clipH) / 2 - C.lift * clipH), S.safeTop, Math.max(S.safeTop, maxBottom - clipH));

  let y = clipY + C.padding;
  const headY = y + (headerH - headTextH) / 2;
  const avatar = { x: x0, y: y + (headerH - H.avatar) / 2, width: H.avatar, height: H.avatar };
  const name = { x: headX, y: headY, text: ellipsize(src.name, headW, font('bold', H.name), measure) };
  const meta = { x: headX, y: headY + H.nameLine, text: ellipsize(`@${src.username} · ${src.time}`, headW, font('regular', H.meta), measure) };
  const location = src.location
    ? { x: headX, y: headY + H.nameLine + H.metaLine, text: ellipsize(src.location, headW, font('regular', H.meta), measure) }
    : null;
  y += headerH;

  let text: CardLayout['text'] = null;
  if (hasText) {
    y += C.gap;
    text = { x: x0, y, size, lineHeight, lines };
    y += textH;
  }

  let poll: CardLayout['poll'] = null;
  if (src.poll) {
    const p = src.poll;
    y += C.gap;
    const percentW = measure('100%', font('bold', P.label));
    const rows = p.options.map((option, i) => {
      const winner = p.winners.includes(i);
      return {
        x: x0,
        y: y + i * (P.row + P.gap),
        width: inner,
        height: P.row,
        label: ellipsize(option, inner - 3 * P.padX - percentW, font(winner ? 'bold' : 'regular', P.label), measure),
        percent: p.percents[i] ?? 0,
        winner,
      };
    });
    poll = { rows, footer: { x: x0, y: y + p.options.length * (P.row + P.gap), text: p.footer } };
    y += pollH;
  }

  let ticketOut: CardLayout['ticket'] = null;
  if (ticket) {
    y += C.gap;
    ticketOut = {
      thumb: { x: x0, y, width: T.thumb, height: ticket.thumbH },
      x: x0 + T.thumb + T.gap,
      titleY: y,
      title: ticket.title,
      metaY: y + ticket.title.length * T.titleLine,
      meta: ticket.meta,
    };
    y += ticketH;
  }

  let photo: CardLayout['photo'] = null;
  if (photoAspect) {
    y += C.gap;
    photo = { x: x0, y, width: inner, height: photoH, extra: src.extraPhotos };
  }

  return { clip: { x: C.margin, y: clipY, width: clipW, height: clipH }, avatar, name, meta, location, text, poll, ticket: ticketOut, photo };
}
```

- [ ] **Passo 4:** `npx jest __tests__/storyCardLayout.test.ts` → PASS. Se o teste "só com foto" falhar no `y`, confira que `headerH` sem local é `S.header.avatar` (120 ≥ 60 + 55).

- [ ] **Passo 5: commit**

```bash
git add lib/storyCard/layout.ts __tests__/storyCardLayout.test.ts
git commit -m "Compartilhar no story: layout do recorte (quebra, tamanho da letra, corte, foto, enquete, ingresso)"
```

---

### Tarefa 5: Desenho no canvas e compartilhar (`draw.ts`, `share.ts`)

**Files:**
- Create: `lib/storyCard/draw.ts`, `lib/storyCard/share.ts`
- Test: `__tests__/storyCardShare.test.ts`

**Interfaces:**
- Consumes: `layoutCard`, `font`, `CardLayout`, `Label` (Tarefa 4); `paletteFor`, `CardPalette`, `StoryBackground` (Tarefa 2); `CardSource` (Tarefa 3); `LOGO_PATH`, `LOGO_VIEWBOX`, `initials`, `avatarColor`, `INITIALS_SCALE` (Tarefa 2).
- Produces:

```ts
// draw.ts (só web: usa document/canvas na hora de chamar, nada no topo do módulo)
export type PreparedCard = { source: CardSource; layout: CardLayout; hasPhoto: boolean; avatar: HTMLImageElement | null; photo: HTMLImageElement | null; ticket: HTMLImageElement | null };
export function prepareCard(source: CardSource): Promise<PreparedCard>;
export function storyBlob(card: PreparedCard, bg: StoryBackground): Promise<Blob>;
// share.ts
export const STORY_FILE_NAME = 'fellas-story.jpg';
export function canShareFiles(): boolean;
export type ShareResult = 'shared' | 'cancelled' | 'downloaded';
export function shareOrDownload(blob: Blob): Promise<ShareResult>;
```

O desenho não tem teste automático (o Jest roda sem canvas); a conferência é visual na Tarefa 10.

- [ ] **Passo 1: teste do compartilhar (falha)** — `__tests__/storyCardShare.test.ts`:

```ts
import { canShareFiles, shareOrDownload, STORY_FILE_NAME } from '../lib/storyCard/share';

const blob = { size: 1, type: 'image/jpeg' } as unknown as Blob;
const g = globalThis as unknown as Record<string, unknown>;
const saved = { navigator: g.navigator, document: g.document, File: g.File };
let link: { href: string; download: string; click: jest.Mock; remove: jest.Mock };

function setNavigator(nav: unknown) {
  Object.defineProperty(globalThis, 'navigator', { value: nav, configurable: true, writable: true });
}

beforeEach(() => {
  g.File = class {
    constructor(public parts: unknown[], public name: string, public opts: unknown) {}
  };
  link = { href: '', download: '', click: jest.fn(), remove: jest.fn() };
  g.document = { createElement: () => link, body: { appendChild: jest.fn() } };
  URL.createObjectURL = jest.fn(() => 'blob:story');
  URL.revokeObjectURL = jest.fn();
});
afterAll(() => {
  setNavigator(saved.navigator);
  g.document = saved.document;
  g.File = saved.File;
});

describe('compartilhar a imagem', () => {
  it('com a planilha do celular: manda o arquivo jpg', async () => {
    const share = jest.fn().mockResolvedValue(undefined);
    setNavigator({ canShare: () => true, share });
    expect(canShareFiles()).toBe(true);
    await expect(shareOrDownload(blob)).resolves.toBe('shared');
    const file = share.mock.calls[0][0].files[0];
    expect(file.name).toBe(STORY_FILE_NAME);
  });

  it('a planilha é chamada na hora, sem esperar nada antes (Safari exige dentro do toque)', () => {
    const share = jest.fn(() => new Promise(() => {}));
    setNavigator({ canShare: () => true, share });
    void shareOrDownload(blob);
    expect(share).toHaveBeenCalledTimes(1);
  });

  it('fechar a planilha sem escolher não é erro', async () => {
    setNavigator({ canShare: () => true, share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })) });
    await expect(shareOrDownload(blob)).resolves.toBe('cancelled');
    expect(link.click).not.toHaveBeenCalled();
  });

  it('sem planilha de arquivos (computador): baixa', async () => {
    setNavigator({});
    expect(canShareFiles()).toBe(false);
    await expect(shareOrDownload(blob)).resolves.toBe('downloaded');
    expect(link.download).toBe(STORY_FILE_NAME);
    expect(link.click).toHaveBeenCalled();
  });

  it('planilha recusada pelo navegador (ex.: toque expirou): baixa', async () => {
    setNavigator({ canShare: () => true, share: jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'NotAllowedError' })) });
    await expect(shareOrDownload(blob)).resolves.toBe('downloaded');
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/storyCardShare.test.ts` → FAIL (módulo não existe).

- [ ] **Passo 3: `lib/storyCard/share.ts`**:

```ts
export const STORY_FILE_NAME = 'fellas-story.jpg';

export type ShareResult = 'shared' | 'cancelled' | 'downloaded';

function file(blob: Blob): File {
  return new File([blob], STORY_FILE_NAME, { type: 'image/jpeg' });
}

/** O aparelho abre a planilha de compartilhar com arquivo (celular)? No computador, em geral não. */
export function canShareFiles(): boolean {
  try {
    return typeof navigator !== 'undefined' && !!navigator.canShare?.({ files: [file(new Blob())] });
  } catch {
    return false;
  }
}

function download(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = STORY_FILE_NAME;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Planilha de compartilhar do celular (Instagram → Story) ou, sem ela, baixa o arquivo. Chame direto do
 * toque com o Blob já pronto: o Safari só abre a planilha dentro do gesto.
 */
export async function shareOrDownload(blob: Blob): Promise<ShareResult> {
  const f = file(blob);
  if (typeof navigator !== 'undefined' && navigator.canShare?.({ files: [f] })) {
    try {
      await navigator.share({ files: [f] });
      return 'shared';
    } catch (e) {
      if ((e as { name?: string })?.name === 'AbortError') return 'cancelled';
    }
  }
  download(blob);
  return 'downloaded';
}
```

- [ ] **Passo 4:** `npx jest __tests__/storyCardShare.test.ts` → PASS.

- [ ] **Passo 5: `lib/storyCard/draw.ts`**:

```ts
import { avatarColor, initials, INITIALS_SCALE } from '../avatarLook';
import { LOGO_PATH, LOGO_VIEWBOX } from '../logoPath';
import { avatarInk, fonts, storyCard as S } from '../theme';
import { paletteFor, type CardPalette, type StoryBackground } from './contrast';
import { font, layoutCard, type CardLayout, type Label } from './layout';
import type { CardSource } from './source';

type Ctx = CanvasRenderingContext2D;

/** Recorte pronto para desenhar em qualquer fundo: layout calculado e imagens carregadas (ou null). */
export type PreparedCard = {
  source: CardSource;
  layout: CardLayout;
  hasPhoto: boolean;
  avatar: HTMLImageElement | null;
  photo: HTMLImageElement | null;
  ticket: HTMLImageElement | null;
};

/** Carrega com CORS (sem ele o canvas não exporta); falhou ou não tem CORS → null. */
function loadImage(url: string | null): Promise<HTMLImageElement | null> {
  if (!url) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img.naturalWidth ? img : null);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

async function loadFonts(): Promise<void> {
  if (typeof document === 'undefined' || !document.fonts) return;
  await Promise.all(
    [fonts.body, fonts.displaySemiBold, fonts.bodyBold].map((f) => document.fonts.load(`40px "${f}"`).catch(() => [])),
  );
}

/** Espera fontes e imagens e calcula o layout com a medida de verdade do canvas. */
export async function prepareCard(source: CardSource): Promise<PreparedCard> {
  const [, avatar, photo, ticket] = await Promise.all([
    loadFonts(),
    loadImage(source.avatarUrl),
    loadImage(source.photoUrl),
    loadImage(source.ticket?.image ?? null),
  ]);
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  const measure = (text: string, f: string) => {
    ctx.font = f;
    return ctx.measureText(text).width;
  };
  const layout = layoutCard(source, { photoAspect: photo ? photo.naturalWidth / photo.naturalHeight : null }, measure);
  return { source, layout, hasPhoto: !!photo, avatar, photo, ticket };
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Preenche a caixa com a imagem, cortando o que sobra no centro (como `cover`). */
function drawCover(ctx: Ctx, img: CanvasImageSource & { naturalWidth?: number; width: number; height: number }, x: number, y: number, w: number, h: number): void {
  const iw = (img as HTMLImageElement).naturalWidth || (img.width as number);
  const ih = (img as HTMLImageElement).naturalHeight || (img.height as number);
  const s = Math.max(w / iw, h / ih);
  const sw = w / s;
  const sh = h / s;
  ctx.drawImage(img, (iw - sw) / 2, (ih - sh) / 2, sw, sh, x, y, w, h);
}

function drawBackground(ctx: Ctx, card: PreparedCard, bg: StoryBackground, pal: CardPalette): void {
  if (bg === 'photo' && card.photo) {
    // reduz e estica de volta: desfoque que funciona até no Safari (que não tem ctx.filter)
    const small = document.createElement('canvas');
    small.width = Math.round(S.width / S.photoBlurScale);
    small.height = Math.round(S.height / S.photoBlurScale);
    const sctx = small.getContext('2d');
    if (sctx) drawCover(sctx, card.photo, 0, 0, small.width, small.height);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(small, 0, 0, S.width, S.height);
    ctx.fillStyle = S.photoDim;
    ctx.fillRect(0, 0, S.width, S.height);
    return;
  }
  ctx.fillStyle = pal.bg ?? S.backgrounds.violeta;
  ctx.fillRect(0, 0, S.width, S.height);
}

function drawLabel(ctx: Ctx, l: Label, f: string, color: string, line: number, size: number): void {
  ctx.font = f;
  ctx.fillStyle = color;
  ctx.fillText(l.text, l.x, l.y + (line - size) / 2);
}

function drawAvatar(ctx: Ctx, card: PreparedCard): void {
  const a = card.layout.avatar;
  const r = a.width / 2;
  ctx.save();
  ctx.beginPath();
  ctx.arc(a.x + r, a.y + r, r, 0, Math.PI * 2);
  ctx.closePath();
  ctx.clip();
  if (card.avatar) drawCover(ctx, card.avatar, a.x, a.y, a.width, a.height);
  else {
    ctx.fillStyle = avatarColor(card.source.name);
    ctx.fillRect(a.x, a.y, a.width, a.height);
    ctx.font = font('bold', Math.round(a.width * INITIALS_SCALE));
    ctx.fillStyle = avatarInk;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(initials(card.source.name), a.x + r, a.y + r);
  }
  ctx.restore();
}

function drawText(ctx: Ctx, text: NonNullable<CardLayout['text']>): void {
  text.lines.forEach((line, i) => {
    let x = text.x;
    const y = text.y + i * text.lineHeight + (text.lineHeight - text.size) / 2;
    for (const run of line) {
      ctx.font = font(run.highlight ? 'semibold' : 'regular', text.size);
      ctx.fillStyle = run.highlight ? S.brand : S.ink;
      ctx.fillText(run.text, x, y);
      x += ctx.measureText(run.text).width;
    }
  });
}

function drawPoll(ctx: Ctx, poll: NonNullable<CardLayout['poll']>): void {
  const P = S.poll;
  for (const r of poll.rows) {
    roundRect(ctx, r.x, r.y, r.width, r.height, P.radius);
    ctx.strokeStyle = S.sunken;
    ctx.lineWidth = P.stroke;
    ctx.stroke();
    const w = (r.width * r.percent) / 100;
    if (w > 0) {
      roundRect(ctx, r.x, r.y, Math.max(w, 2 * P.radius), r.height, P.radius);
      ctx.fillStyle = r.winner ? S.brandSoft : S.sunken;
      ctx.fill();
    }
    const ty = r.y + (r.height - P.label) / 2;
    ctx.font = font(r.winner ? 'bold' : 'regular', P.label);
    ctx.fillStyle = S.ink;
    ctx.textAlign = 'left';
    ctx.fillText(r.label, r.x + P.padX, ty);
    ctx.textAlign = 'right';
    ctx.fillText(`${r.percent}%`, r.x + r.width - P.padX, ty);
    ctx.textAlign = 'left';
  }
  drawLabel(ctx, poll.footer, font('regular', P.footer), S.inkMuted, P.footerLine, P.footer);
}

function drawTicket(ctx: Ctx, t: NonNullable<CardLayout['ticket']>, img: HTMLImageElement | null): void {
  const T = S.ticket;
  const b = t.thumb;
  ctx.save();
  roundRect(ctx, b.x, b.y, b.width, b.height, T.radius);
  ctx.clip();
  if (img) drawCover(ctx, img, b.x, b.y, b.width, b.height);
  else {
    ctx.fillStyle = S.sunken;
    ctx.fillRect(b.x, b.y, b.width, b.height);
  }
  ctx.restore();
  ctx.font = font('bold', T.title);
  ctx.fillStyle = S.ink;
  t.title.forEach((line, i) => ctx.fillText(line, t.x, t.titleY + i * T.titleLine + (T.titleLine - T.title) / 2));
  ctx.font = font('regular', T.meta);
  t.meta.forEach((line, i) => {
    const y = t.metaY + i * T.metaLine + (T.metaLine - T.meta) / 2;
    const heart = line.endsWith('♥');
    const rest = heart ? line.slice(0, -1) : line;
    ctx.fillStyle = S.inkMuted;
    ctx.fillText(rest, t.x, y);
    if (heart) {
      ctx.fillStyle = S.like;
      ctx.fillText('♥', t.x + ctx.measureText(rest).width, y);
    }
  });
}

function drawPhoto(ctx: Ctx, box: NonNullable<CardLayout['photo']>, img: HTMLImageElement): void {
  ctx.save();
  roundRect(ctx, box.x, box.y, box.width, box.height, S.photo.radius);
  ctx.clip();
  drawCover(ctx, img, box.x, box.y, box.width, box.height);
  ctx.restore();
  if (box.extra <= 0) return;
  const B = S.badge;
  const label = `+${box.extra}`;
  ctx.font = font('bold', B.size);
  const w = ctx.measureText(label).width + 2 * B.padX;
  const bx = box.x + box.width - B.inset - w;
  const by = box.y + box.height - B.inset - B.height;
  roundRect(ctx, bx, by, w, B.height, B.height / 2);
  ctx.fillStyle = B.bg;
  ctx.fill();
  ctx.fillStyle = B.fg;
  ctx.textAlign = 'center';
  ctx.fillText(label, bx + w / 2, by + (B.height - B.size) / 2);
  ctx.textAlign = 'left';
}

function drawTape(ctx: Ctx, cx: number, cy: number, deg: number, color: string): void {
  const { width, height } = S.tapeSize;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((deg * Math.PI) / 180);
  ctx.fillStyle = color;
  ctx.fillRect(-width / 2, -height / 2, width, height);
  ctx.restore();
}

function drawClip(ctx: Ctx, card: PreparedCard, pal: CardPalette): void {
  const L = card.layout;
  const c = L.clip;
  const H = S.header;
  const cx = c.x + c.width / 2;
  const cy = c.y + c.height / 2;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((S.clip.rotateDeg * Math.PI) / 180);
  ctx.translate(-cx, -cy);

  ctx.save();
  ctx.shadowColor = pal.shadow.color;
  ctx.shadowBlur = pal.shadow.blur;
  ctx.shadowOffsetY = pal.shadow.offsetY;
  ctx.fillStyle = pal.paper;
  ctx.fillRect(c.x, c.y, c.width, c.height);
  ctx.restore();

  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';
  drawAvatar(ctx, card);
  drawLabel(ctx, L.name, font('bold', H.name), S.ink, H.nameLine, H.name);
  drawLabel(ctx, L.meta, font('regular', H.meta), S.inkMuted, H.metaLine, H.meta);
  if (L.location) drawLabel(ctx, L.location, font('regular', H.meta), S.inkMuted, H.metaLine, H.meta);
  if (L.text) drawText(ctx, L.text);
  if (L.poll) drawPoll(ctx, L.poll);
  if (L.ticket) drawTicket(ctx, L.ticket, card.ticket);
  if (L.photo && card.photo) drawPhoto(ctx, L.photo, card.photo);

  // fitas nos dois cantos de cima, por cima de tudo
  drawTape(ctx, c.x + S.tapeSize.width / 4, c.y, S.tapeSize.leftDeg, pal.tape);
  drawTape(ctx, c.x + c.width - S.tapeSize.width / 4, c.y + S.tapeSize.height / 8, S.tapeSize.rightDeg, pal.tape);
  ctx.restore();
}

function drawMark(ctx: Ctx, color: string): void {
  const scale = S.mark.height / LOGO_VIEWBOX.height;
  const w = LOGO_VIEWBOX.width * scale;
  ctx.save();
  ctx.translate((S.width - w) / 2, S.height - S.mark.bottom - S.mark.height);
  ctx.scale(scale, scale);
  ctx.fillStyle = color;
  ctx.fill(new Path2D(LOGO_PATH));
  ctx.restore();
}

function renderCard(card: PreparedCard, bg: StoryBackground): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = S.width;
  canvas.height = S.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas indisponível');
  const pal = paletteFor(bg);
  drawBackground(ctx, card, bg, pal);
  drawClip(ctx, card, pal);
  drawMark(ctx, pal.mark);
  return canvas;
}

/** A imagem do story (JPEG 1080 × 1920) no fundo escolhido. */
export function storyBlob(card: PreparedCard, bg: StoryBackground): Promise<Blob> {
  const canvas = renderCard(card, bg);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('falhou gerar a imagem'))), 'image/jpeg', S.jpegQuality),
  );
}
```

- [ ] **Passo 6:** `npx tsc --noEmit` → sem erros. (Se o tipo do `drawCover` reclamar, troque o parâmetro por `img: HTMLImageElement | HTMLCanvasElement` e leia `naturalWidth` só quando `img instanceof HTMLImageElement`.)

- [ ] **Passo 7: commit**

```bash
git add lib/storyCard/draw.ts lib/storyCard/share.ts __tests__/storyCardShare.test.ts
git commit -m "Compartilhar no story: desenho no canvas e planilha de compartilhar (ou baixar)"
```

---

### Tarefa 6: `Button` com ícone e variantes para o palco escuro

**Files:**
- Modify: `components/ui/Button.tsx`
- Test: `__tests__/buttonOverlay.test.tsx`

**Interfaces:**
- Produces: `ButtonProps.variant` aceita também `'overlay' | 'overlayOutline'`; `ButtonProps.icon?: IconName`.

- [ ] **Passo 1: teste (falha)** — `__tests__/buttonOverlay.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Button } from '../components/ui';
import { getTheme } from '../lib/theme';

const t = getTheme('light');
const colorOf = (text: string) => StyleSheet.flatten(screen.getByText(text).props.style).color;

describe('Button no palco escuro', () => {
  it('overlay: preenchido claro, texto escuro', async () => {
    await render(<Button title="Story do Fellas" variant="overlay" icon="add-circle-outline" />);
    expect(colorOf('Story do Fellas')).toBe(t.colors.viewerBg);
  });

  it('overlayOutline: só o fio, texto claro', async () => {
    await render(<Button title="Instagram" variant="overlayOutline" icon="logo-instagram" />);
    expect(colorOf('Instagram')).toBe(t.colors.onOverlay);
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/buttonOverlay.test.tsx` → FAIL (variante desconhecida: cor `undefined`; e erro de tipo no `icon`).

- [ ] **Passo 3: implementação** — em `components/ui/Button.tsx`:

1. Imports: acrescente `import { Icon, type IconName } from './Icon';`.
2. Em `ButtonProps`: `variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'overlay' | 'overlayOutline';` e, depois de `title`, `/** Ícone antes do texto (some enquanto carrega). */ icon?: IconName;`.
3. Desestruture `icon` nos parâmetros.
4. Nos mapas:

```ts
  const bg = {
    primary: t.colors.primary,
    danger: t.colors.danger,
    secondary: t.colors.surface,
    ghost: 'transparent',
    overlay: t.colors.onOverlay,
    overlayOutline: 'transparent',
  }[variant];
  const fg = {
    primary: t.colors.onPrimary,
    danger: t.colors.onDanger,
    secondary: t.colors.text,
    ghost: t.colors.primary,
    overlay: t.colors.viewerBg,
    overlayOutline: t.colors.onOverlay,
  }[variant];
  const outlined = variant === 'secondary' || variant === 'overlayOutline';
```

5. No estilo: `borderWidth: outlined ? t.borders.hairline : 0,` e `borderColor: variant === 'overlayOutline' ? t.colors.onOverlay : t.colors.border,`.
6. Depois de `{loading ? <ActivityIndicator color={fg} /> : null}`: `{icon && !loading ? <Icon name={icon} color={fg} /> : null}`.

- [ ] **Passo 4:** `npx jest __tests__/buttonOverlay.test.tsx` → PASS; `npm test` → tudo verde (os outros botões não mudam).

- [ ] **Passo 5: commit**

```bash
git add components/ui/Button.tsx __tests__/buttonOverlay.test.tsx
git commit -m "Button: ícone e variantes para o palco escuro (overlay, overlayOutline)"
```

---

### Tarefa 7: O montador (`StoryShareDialog`)

**Files:**
- Create: `components/share/StoryShareDialog.tsx`
- Test: `__tests__/storyShareDialog.test.tsx`

**Interfaces:**
- Consumes: `cardSource` (T3); `prepareCard`, `storyBlob`, `PreparedCard` (T5); `canShareFiles`, `shareOrDownload` (T5); `BACKGROUND_ORDER`, `BACKGROUND_LABEL`, `StoryBackground` (T2); `uploadStoryMedia`, `createStory`, `StoryUploadError` (T1); `emitStoriesChanged`; `useMembersByUsername`; `useLayoutTier`; `Button` com `overlay`/`overlayOutline`/`icon` (T6); tokens `layout.storyShare`, `motion.confirm`, `storyCard.backgrounds`.
- Produces: `StoryShareDialog({ post, visible, onClose }: { post: FeedPost; visible: boolean; onClose: () => void })`.

- [ ] **Passo 1: teste (falha)** — `__tests__/storyShareDialog.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPrepare = jest.fn();
const mockBlob = jest.fn();
const mockShare = jest.fn();
let mockCanShare = true;
jest.mock('../lib/storyCard/draw', () => ({
  prepareCard: (s: unknown) => mockPrepare(s),
  storyBlob: (c: unknown, bg: string) => mockBlob(c, bg),
}));
jest.mock('../lib/storyCard/share', () => ({
  canShareFiles: () => mockCanShare,
  shareOrDownload: (b: unknown) => mockShare(b),
}));
const mockUpload = jest.fn();
const mockCreate = jest.fn();
jest.mock('../lib/api/stories', () => {
  class StoryUploadError extends Error {}
  return {
    StoryUploadError,
    uploadStoryMedia: (u: string, k: string) => mockUpload(u, k),
    createStory: (i: unknown) => mockCreate(i),
  };
});
const mockEmit = jest.fn();
jest.mock('../lib/storyViewerStore', () => ({ emitStoriesChanged: () => mockEmit() }));
const mockMembers = new Map();
jest.mock('../lib/memberDirectory', () => ({ useMembersByUsername: () => mockMembers }));
jest.mock('../lib/supabase', () => ({ supabase: {} }));
let mockTier = 'compact';
jest.mock('../lib/layout', () => ({ ...jest.requireActual('../lib/layout'), useLayoutTier: () => mockTier }));

import { StoryShareDialog } from '../components/share/StoryShareDialog';
import type { FeedPost } from '../lib/api/posts';
import { StoryUploadError } from '../lib/api/stories';

const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const BLOB = { size: 1 } as unknown as Blob;
const post: FeedPost = {
  id: 'p1', body: 'o padeiro pediu bis', images: [], imageUrl: null, createdAt: '2026-10-09T10:00:00Z',
  author: { id: 'u1', username: 'caio', display_name: 'Caio Ramos', avatar_url: null },
  likeCount: 0, commentCount: 0, likedByMe: false, reactions: [], myReaction: null,
};
const withPhoto = { ...post, images: ['https://x/a.jpg'], imageUrl: 'https://x/a.jpg' };

async function open(p: FeedPost = post, onClose = jest.fn()) {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <StoryShareDialog post={p} visible onClose={onClose} />
    </SafeAreaProvider>,
  );
  await screen.findByTestId('story-share-preview');
  return onClose;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockCanShare = true;
  mockTier = 'compact';
  mockPrepare.mockResolvedValue({ hasPhoto: false });
  mockBlob.mockResolvedValue(BLOB);
  URL.createObjectURL = jest.fn(() => 'blob:story');
  URL.revokeObjectURL = jest.fn();
});

describe('StoryShareDialog', () => {
  it('post sem foto: abre no violeta, 4 fundos', async () => {
    await open();
    expect(mockBlob).toHaveBeenCalledWith(expect.anything(), 'violeta');
    expect(screen.getAllByRole('radio')).toHaveLength(4);
    expect(screen.queryByLabelText('Fundo com a foto do post')).toBeNull();
    expect(screen.getByLabelText('Fundo violeta').props.accessibilityState).toMatchObject({ checked: true });
  });

  it('post com foto: abre na própria foto, 5 fundos', async () => {
    mockPrepare.mockResolvedValue({ hasPhoto: true });
    await open(withPhoto);
    expect(mockBlob).toHaveBeenCalledWith(expect.anything(), 'photo');
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('trocar o fundo gera a imagem de novo', async () => {
    await open();
    await fireEvent.press(screen.getByLabelText('Fundo tinta'));
    await waitFor(() => expect(mockBlob).toHaveBeenLastCalledWith(expect.anything(), 'tinta'));
  });

  it('Instagram compartilha a imagem já pronta, na hora do toque', async () => {
    mockShare.mockReturnValue(new Promise(() => {}));
    await open();
    await fireEvent.press(screen.getByLabelText('Instagram'));
    expect(mockShare).toHaveBeenCalledWith(BLOB);
  });

  it('sem planilha de arquivos (computador): "Baixar imagem"', async () => {
    mockCanShare = false;
    mockTier = 'expanded';
    mockShare.mockResolvedValue('downloaded');
    await open();
    await fireEvent.press(screen.getByLabelText('Baixar imagem'));
    expect(mockShare).toHaveBeenCalledWith(BLOB);
  });

  it('Story do Fellas: sobe, liga ao post, avisa e fecha', async () => {
    mockUpload.mockResolvedValue({ mediaId: 'stories/x', durationMs: 5000 });
    mockCreate.mockResolvedValue(undefined);
    const onClose = await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    expect(await screen.findByText('Foi pro seu story')).toBeTruthy();
    expect(mockUpload).toHaveBeenCalledWith('blob:story', 'photo');
    expect(mockCreate).toHaveBeenCalledWith({ kind: 'photo', mediaId: 'stories/x', durationMs: 5000, postId: 'p1' });
    expect(mockEmit).toHaveBeenCalled();
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 3000 });
  });

  it('erro ao subir: mensagem e continua aberto', async () => {
    mockUpload.mockRejectedValue(new StoryUploadError('Sem conexão. Confere a internet e tenta de novo.'));
    const onClose = await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    expect(await screen.findByText('Sem conexão. Confere a internet e tenta de novo.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('enquanto sobe, o ✕ fica desabilitado', async () => {
    mockUpload.mockReturnValue(new Promise(() => {}));
    await open();
    await fireEvent.press(screen.getByLabelText('Story do Fellas'));
    expect(screen.getByLabelText('Fechar').props.accessibilityState).toMatchObject({ disabled: true });
  });

  it('não montou a imagem: avisa e deixa tentar de novo', async () => {
    mockPrepare.mockRejectedValueOnce(new Error('x'));
    await render(
      <SafeAreaProvider initialMetrics={metrics}>
        <StoryShareDialog post={post} visible onClose={jest.fn()} />
      </SafeAreaProvider>,
    );
    expect(await screen.findByText('Não rolou montar a imagem. Tenta de novo.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tentar de novo'));
    await screen.findByTestId('story-share-preview');
    expect(mockPrepare).toHaveBeenCalledTimes(2);
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/storyShareDialog.test.tsx` → FAIL (componente não existe).

- [ ] **Passo 3: implementação** — `components/share/StoryShareDialog.tsx`:

```tsx
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { createStory, StoryUploadError, uploadStoryMedia } from '../../lib/api/stories';
import type { FeedPost } from '../../lib/api/posts';
import { friendlyError } from '../../lib/errors';
import { useLayoutTier } from '../../lib/layout';
import { useMembersByUsername } from '../../lib/memberDirectory';
import { BACKGROUND_LABEL, BACKGROUND_ORDER, type StoryBackground } from '../../lib/storyCard/contrast';
import { prepareCard, storyBlob, type PreparedCard } from '../../lib/storyCard/draw';
import { canShareFiles, shareOrDownload } from '../../lib/storyCard/share';
import { cardSource } from '../../lib/storyCard/source';
import { emitStoriesChanged } from '../../lib/storyViewerStore';
import { storyCard, useTheme } from '../../lib/theme';
import { Button, IconButton, Text } from '../ui';

type Props = { post: FeedPost; visible: boolean; onClose: () => void };
/** Imagem pronta de um fundo: o Blob (para compartilhar na hora do toque) e o endereço local (prévia). */
type Preview = { bg: StoryBackground; blob: Blob; url: string };

/**
 * Montador do "compartilhar no story": prévia 9:16 (a própria imagem gerada), bolinhas de fundo e os dois
 * destinos — planilha de compartilhar do celular (Instagram → Story; no computador, baixa) e o story do
 * Fellas, ligado ao post ("Ver post"). Palco escuro, igual ao "Ajustar foto"; janela no meio no computador.
 */
export function StoryShareDialog({ post, visible, onClose }: Props) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  const desktop = useLayoutTier() !== 'compact';
  const byUsername = useMembersByUsername();
  const shareFiles = useMemo(() => canShareFiles(), []);
  const [prepared, setPrepared] = useState<PreparedCard | null>(null);
  const [bg, setBg] = useState<StoryBackground | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const urlRef = useRef<string | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const name = post.author.display_name || post.author.username;

  const forget = () => {
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = null;
  };
  useEffect(() => () => {
    forget();
    clearTimeout(closeTimer.current);
  }, []);

  // fontes, fotos e layout: uma vez por abertura (e a cada "Tentar de novo")
  useEffect(() => {
    if (!visible) return;
    let active = true;
    setFailed(false);
    setPrepared(null);
    setPreview(null);
    setError(null);
    setDone(false);
    prepareCard(cardSource(post, byUsername))
      .then((card) => {
        if (!active) return;
        setPrepared(card);
        setBg(card.hasPhoto ? 'photo' : 'violeta');
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [visible, post, byUsername, attempt]);

  // a imagem do fundo escolhido; a anterior fica na tela até a nova chegar
  useEffect(() => {
    if (!prepared || !bg) return;
    let active = true;
    storyBlob(prepared, bg)
      .then((blob) => {
        if (!active) return;
        forget();
        const url = URL.createObjectURL(blob);
        urlRef.current = url;
        setPreview({ bg, blob, url });
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [prepared, bg]);

  // sem await antes: o Safari só abre a planilha dentro do toque
  const toInstagram = () => {
    if (!preview) return;
    setError(null);
    shareOrDownload(preview.blob).catch(() => setError('Não rolou compartilhar. Tenta de novo.'));
  };

  const toFellas = async () => {
    if (!preview || sending) return;
    setSending(true);
    setError(null);
    try {
      const { mediaId, durationMs } = await uploadStoryMedia(preview.url, 'photo');
      await createStory({ kind: 'photo', mediaId, durationMs, postId: post.id });
      emitStoriesChanged();
      setDone(true);
      closeTimer.current = setTimeout(onClose, t.motion.confirm);
    } catch (e) {
      setError(e instanceof StoryUploadError ? e.message : friendlyError(e, 'Não rolou postar o story. Tenta de novo.'));
    } finally {
      setSending(false);
    }
  };

  const onOverlay = { color: t.colors.onOverlay };
  const options = BACKGROUND_ORDER.filter((b) => b !== 'photo' || prepared?.hasPhoto);

  const stage = (
    <View
      style={{
        flex: 1,
        backgroundColor: t.colors.viewerBg,
        borderRadius: desktop ? t.radii.lg : 0,
        overflow: 'hidden',
        paddingTop: desktop ? t.spacing.sm : insets.top,
        paddingBottom: (desktop ? 0 : insets.bottom) + t.spacing.lg,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: t.spacing.sm, gap: t.spacing.xs }}>
        <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" tone="onOverlay" onPress={onClose} disabled={sending} />
        <Text bold style={onOverlay}>
          Compartilhar no story
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: t.spacing.md, gap: t.spacing.lg }}>
        {failed ? (
          <>
            <Text align="center" style={onOverlay}>
              Não rolou montar a imagem. Tenta de novo.
            </Text>
            <Button title="Tentar de novo" variant="overlayOutline" onPress={() => setAttempt((a) => a + 1)} />
          </>
        ) : (
          <View
            style={{
              height: '100%',
              aspectRatio: t.layout.storyAspect,
              borderRadius: t.radii.lg,
              overflow: 'hidden',
              backgroundColor: t.colors.overlay,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {preview ? (
              <Image
                testID="story-share-preview"
                accessibilityLabel={`Prévia do story com o post de ${name}`}
                source={{ uri: preview.url }}
                style={{ width: '100%', height: '100%' }}
              />
            ) : (
              <ActivityIndicator color={t.colors.onOverlay} accessibilityLabel="Montando a imagem" />
            )}
          </View>
        )}
      </View>

      {prepared && !failed ? (
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', justifyContent: 'center', gap: t.spacing.xs, paddingBottom: t.spacing.md }}>
          {options.map((b) => (
            <BackgroundDot key={b} bg={b} photoUrl={post.images[0] ?? null} selected={b === bg} onPress={() => setBg(b)} />
          ))}
        </View>
      ) : null}

      {error ? (
        <Text accessibilityRole="alert" align="center" style={[onOverlay, { paddingHorizontal: t.layout.gutter, paddingBottom: t.spacing.sm }]}>
          {error}
        </Text>
      ) : null}

      <View style={{ flexDirection: 'row', gap: t.spacing.sm, paddingHorizontal: t.layout.gutter }}>
        <View style={{ flex: 1 }}>
          <Button
            title={shareFiles ? 'Instagram' : 'Baixar imagem'}
            icon={shareFiles ? 'logo-instagram' : 'download-outline'}
            variant="overlayOutline"
            fullWidth
            disabled={!preview || sending}
            onPress={toInstagram}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={done ? 'Foi pro seu story' : 'Story do Fellas'}
            icon={done ? 'checkmark' : 'add-circle-outline'}
            variant="overlay"
            fullWidth
            loading={sending}
            disabled={!preview || done}
            onPress={() => void toFellas()}
          />
        </View>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={sending ? () => {} : onClose}>
      {desktop ? (
        <View style={{ flex: 1, backgroundColor: t.colors.overlay, alignItems: 'center', padding: t.spacing.xxxl }}>
          <View style={{ flex: 1, width: t.layout.storyShare.width }}>{stage}</View>
        </View>
      ) : (
        stage
      )}
    </Modal>
  );
}

/** Bolinha de um fundo: anel `onOverlay` na escolhida; a da foto mostra a própria foto. */
function BackgroundDot({ bg, photoUrl, selected, onPress }: { bg: StoryBackground; photoUrl: string | null; selected: boolean; onPress: () => void }) {
  const t = useTheme();
  const d = t.layout.storyShare.dot;
  const dot = { width: d, height: d, borderRadius: d / 2, borderWidth: t.borders.hairline, borderColor: t.colors.overlay };
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={BACKGROUND_LABEL[bg]}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={{
        width: t.layout.minTouch,
        height: t.layout.minTouch,
        borderRadius: t.radii.pill,
        borderWidth: t.borders.selected,
        borderColor: selected ? t.colors.onOverlay : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {bg === 'photo' && photoUrl ? (
        <Image source={{ uri: photoUrl }} style={dot} />
      ) : (
        <View style={[dot, { backgroundColor: bg === 'photo' ? t.colors.overlay : storyCard.backgrounds[bg] }]} />
      )}
    </Pressable>
  );
}
```

- [ ] **Passo 4:** `npx jest __tests__/storyShareDialog.test.tsx` → PASS. `npx tsc --noEmit` → sem erros. Se `getAllByRole('radio')` não achar nada, confira se o RNTL 14 reconhece `accessibilityRole="radio"` (ele aceita `role`/`accessibilityRole`); não troque o teste para `getAllByLabelText` sem antes conferir.

- [ ] **Passo 5: commit**

```bash
git add components/share/StoryShareDialog.tsx __tests__/storyShareDialog.test.tsx
git commit -m "Compartilhar no story: o montador (prévia, fundos, Instagram/baixar e story do Fellas)"
```

---

### Tarefa 8: Botão no post

**Files:**
- Create: `components/feed/ShareButton.tsx`
- Modify: `components/PostCard.tsx` (imports; estado; fila de ações; montador fora da linha tocável)
- Test: `__tests__/PostCard.test.tsx`

**Interfaces:**
- Consumes: `StoryShareDialog` (T7), `ActionButton`, `Icon`.
- Produces: `ShareButton({ onPress }: { onPress: () => void })`.

- [ ] **Passo 1: teste (falha)** — em `__tests__/PostCard.test.tsx`:

No topo, junto dos imports: `import { Platform } from 'react-native';`. Depois do `jest.mock('../lib/supabase', ...)`:

```tsx
jest.mock('../components/share/StoryShareDialog', () => {
  const { Text } = require('react-native');
  return { StoryShareDialog: ({ visible }: { visible: boolean }) => (visible ? <Text>montador aberto</Text> : null) };
});
```

No fim do arquivo:

```tsx
describe('PostCard compartilhar no story', () => {
  afterEach(() => jest.restoreAllMocks());

  it('na web, o botão abre o montador sem abrir o post', async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const onPress = jest.fn();
    await render(<PostCard post={post} onPress={onPress} />);
    await fireEvent.press(screen.getByLabelText('Compartilhar no story'));
    expect(screen.getByText('montador aberto')).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('fora da web não aparece', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    await render(<PostCard post={post} />);
    expect(screen.queryByLabelText('Compartilhar no story')).toBeNull();
  });
});
```

- [ ] **Passo 2:** `npx jest __tests__/PostCard.test.tsx` → FAIL (sem o botão).

- [ ] **Passo 3: `components/feed/ShareButton.tsx`**:

```tsx
import { Icon } from '../ui';
import { ActionButton } from './ActionButton';

type Props = { onPress: () => void };

/** Compartilhar no story: abre o montador (só na web, onde dá para gerar a imagem). */
export function ShareButton({ onPress }: Props) {
  return (
    <ActionButton onPress={onPress} accessibilityLabel="Compartilhar no story">
      <Icon name="share-outline" tone="muted" />
    </ActionButton>
  );
}
```

- [ ] **Passo 4: `components/PostCard.tsx`**:

1. Imports: `import { ShareButton } from './feed/ShareButton';` e `import { StoryShareDialog } from './share/StoryShareDialog';`.
2. Junto dos outros `useState` do componente: `const [sharing, setSharing] = useState(false);`.
3. Na fila de ações, troque

```tsx
            <View style={{ flex: 1 }} />
            <View style={{ marginRight: -t.spacing.sm }}>
```

por

```tsx
            <View style={{ flex: 1 }} />
            {Platform.OS === 'web' ? <ShareButton onPress={() => setSharing(true)} /> : null}
            <View style={{ marginRight: -t.spacing.sm }}>
```

4. Logo depois do bloco `{viewing !== null ? (<PhotoViewer … />) : null}` (fora da linha tocável, pelo mesmo motivo do comentário que já está ali):

```tsx
      {sharing ? <StoryShareDialog post={post} visible onClose={() => setSharing(false)} /> : null}
```

- [ ] **Passo 5:** `npx jest __tests__/PostCard.test.tsx` → PASS; `npm test` → verde; `npx tsc --noEmit` → sem erros.

- [ ] **Passo 6: commit**

```bash
git add components/feed/ShareButton.tsx components/PostCard.tsx __tests__/PostCard.test.tsx
git commit -m "Post: botão de compartilhar no story (web)"
```

---

### Tarefa 9: "Ver post" no story

**Files:**
- Modify: `components/stories/StoryViewer.tsx`
- Test: `__tests__/storyViewer.test.tsx`

**Interfaces:**
- Consumes: `Story.postId` (T1).

- [ ] **Passo 1: teste (falha)** — em `__tests__/storyViewer.test.tsx`, junto dos outros `jest.mock` do topo:

```tsx
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ ...jest.requireActual('expo-router'), router: { push: (p: string) => mockPush(p) } }));
```

E um `describe` novo no fim:

```tsx
describe('StoryViewer: story que veio de um post', () => {
  it('"Ver post" fecha o story e abre o post', async () => {
    await open([g('ana', { ...s('a1'), postId: 'p9' })], 'ana');
    await fireEvent.press(screen.getByLabelText('Ver post'));
    expect(mockPush).toHaveBeenCalledWith('/post/p9');
    expect(screen.queryByLabelText(/Story \d de/)).toBeNull();
  });

  it('story comum não tem "Ver post"', async () => {
    await open([g('ana', s('a1'))], 'ana');
    expect(screen.queryByLabelText('Ver post')).toBeNull();
  });
});
```

(Se `g()` reclamar do tipo por causa do `postId`, troque a assinatura do helper para `g = (id: string, ...stories: (ReturnType<typeof s> & { postId?: string | null })[])`.)

- [ ] **Passo 2:** `npx jest __tests__/storyViewer.test.tsx` → FAIL (sem a pílula).

- [ ] **Passo 3: implementação** — em `components/stories/StoryViewer.tsx`:

1. Imports: `import { router } from 'expo-router';` e acrescente `Icon` no import de `'../ui'`.
2. Dentro do componente, perto de `react`/`remove`:

```tsx
  const openPost = (postId: string) => {
    onClose();
    router.push(`/post/${postId}`);
  };
```

3. Logo depois do `</View>` que fecha o rodapé (o bloco que começa com `{/* rodapé: meu story (visto por, apagar) ou reagir */}`), antes do `<ReactionPicker`:

```tsx
    {/* story que veio de um post: pílula acima do rodapé (não conta como toque de passar/voltar) */}
    {story.postId ? (
      <View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: edge.bottom + t.spacing.md + t.layout.minTouch + t.spacing.sm,
          alignItems: 'center',
        }}
      >
        <Pressable
          accessibilityRole="link"
          accessibilityLabel="Ver post"
          onPress={() => openPost(story.postId!)}
          style={{
            minHeight: t.layout.minTouch,
            paddingHorizontal: t.spacing.lg,
            borderRadius: t.radii.pill,
            backgroundColor: t.colors.overlay,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.onOverlay,
            flexDirection: 'row',
            alignItems: 'center',
            gap: t.spacing.xs,
          }}
        >
          <Icon name="arrow-forward-outline" size="sm" color={t.colors.onOverlay} />
          <Text variant="small" bold style={onOverlay}>
            Ver post
          </Text>
        </Pressable>
      </View>
    ) : null}
```

- [ ] **Passo 4:** `npx jest __tests__/storyViewer.test.tsx` → PASS (os antigos também). `npx tsc --noEmit` → sem erros.

- [ ] **Passo 5: commit**

```bash
git add components/stories/StoryViewer.tsx __tests__/storyViewer.test.tsx
git commit -m "Stories: \"Ver post\" no story que veio de um post"
```

---

### Tarefa 10: DESIGN.md, conferência visual e fechamento

**Files:**
- Modify: `DESIGN.md` (seção Stories + Componentes)
- Modify: `docs/superpowers/specs/2026-10-09-compartilhar-no-story-design.md` (só se algo mudou no caminho)

- [ ] **Passo 1: DESIGN.md** — em "### Stories", depois do último item, acrescente:

```markdown
- **Compartilhar no story** (`components/share/StoryShareDialog`, só web): ícone `share-outline` na fila de ações do post, entre o espaçador e a carinha. Abre o montador: palco `viewerBg` (tela cheia no celular; janela `layout.storyShare.width` no meio no computador), ✕ + "Compartilhar no story", prévia 9:16 que é a própria imagem gerada, bolinhas de fundo (`storyShare.dot`, toque de 44, anel `onOverlay` na escolhida) e dois `Button`s — `overlayOutline` "Instagram" (planilha de compartilhar; sem ela, "Baixar imagem") e `overlay` "Story do Fellas" ("Foi pro seu story" por `motion.confirm` e fecha). A imagem (`lib/storyCard`, canvas 1080 × 1920, token `storyCard`, cores fixas): o post como **recorte** de papel colado com duas fitas, girado −2,2°, com a marca FELLAS embaixo; fundos foto desfocada (padrão com foto) · violeta (padrão sem) · tinta · vermelho · papel; nada nas faixas do Instagram (topo 250, base 340). Texto 72 → 54 → até 40 e "…"; 1ª foto com "+N"; enquete e ingresso em versão mini.
- Story que veio de um post: pílula "Ver post" (`overlay` + fio `onOverlay`, `arrow-forward-outline`) acima do rodapé; fecha o story e abre `/post/<id>`.
```

E na lista "Componentes (components/ui)", troque `Button (primary, secondary, ghost, danger; loading/disabled)` por `Button (primary, secondary, ghost, danger, overlay e overlayOutline para o palco escuro; ícone opcional; loading/disabled)`.

- [ ] **Passo 2: verificação completa**

```bash
npx tsc --noEmit
npm test
```

Esperado: os dois sem erros. Se algo falhar, conserte antes de seguir (não marque como pronto).

- [ ] **Passo 3: conferência visual (web)** — `npx expo start --web`, entrar com uma conta de membro e, no feed, abrir o montador em: post só de texto curto, texto longo, post com 1 e com 3 fotos, enquete e ingresso. Conferir em cada um: recorte inteiro entre as faixas, texto sem vazar, marca FELLAS visível em todos os fundos (papel com marca escura), fundo foto desfocado (sem quadriculado forte), fitas nos cantos. Abrir também com a janela estreita (celular) e larga (computador). Baixar uma imagem e abrir o arquivo (1080 × 1920). Se o desfoque do fundo foto ficar quadriculado, aumentar `storyCard.photoBlurScale` não resolve — reduzir para 12 e repetir.

- [ ] **Passo 4: commit**

```bash
git add DESIGN.md docs/superpowers/specs/2026-10-09-compartilhar-no-story-design.md
git commit -m "DESIGN: compartilhar no story e \"Ver post\""
```

- [ ] **Passo 5: entrega** — usar `superpowers:finishing-a-development-branch`. Fluxo do projeto: merge local na `main` + push, sem PR. **Antes do push na `main`**, lembrar o Juan de rodar a migração (`! npx supabase db push`) e conferir a coluna `stories.post_id`; a conferência real no celular (Insta no Android, Story do Fellas com "Ver post") fica com ele.
