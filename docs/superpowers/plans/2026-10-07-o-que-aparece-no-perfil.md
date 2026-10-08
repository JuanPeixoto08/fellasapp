# O que aparece no perfil — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Chaves no Editar perfil para esconder selos e o "ouvindo agora", e o "ouvindo agora" ao vivo ao lado do nome nos posts.

**Architecture:** Duas colunas novas em `profiles` (`show_now_playing`, `hidden_badges`) com grant por coluna. Um cache compartilhado por usuário do Last.fm (`nowPlayingStore`) alimenta o `useNowPlaying`, usado pela linha do perfil e pelo componente novo dos posts. Um helper `visibleBadges` decide os selos em todo lugar.

**Tech Stack:** Expo Router / React Native (+ web), Supabase, Jest + @testing-library/react-native.

**Spec:** `docs/superpowers/specs/2026-10-07-o-que-aparece-no-perfil-design.md`

## Global Constraints

- Texto da interface em pt-BR, no tom do `PRODUCT.md`.
- Telas usam tokens de `lib/theme.ts` e componentes de `components/ui`; primitivo novo (`Switch`) entra em `components/ui` com tokens.
- `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa.
- Migração idempotente, numerada `0023_profile_display.sql`.
- Fluxo git: commits na `main`, push no fim.

## Review Focus

- Autor sem `show_now_playing` no dado (posts de teste/antigos, campo ausente) → trata como ligado (`!== false`), não quebra.
- `hidden_badges` com selo que a pessoa não tem mais → ignorado (a conta é `badges − hidden`).
- Rolar o feed monta/desmonta posts → o cache não pergunta de novo ao Last.fm se a resposta tem menos de 60 s.
- Tocar na minha própria música no feed → `/@eu?aba=musica` redireciona para `/profile?aba=musica` e abre a aba Música (mesmo com a aba Perfil já montada).
- Chave de música com Last.fm vazio no campo → desabilitada, mas o valor salvo continua o mesmo.

---

### Task 1: Banco, tipos e `visibleBadges`

**Files:**
- Create: `supabase/migrations/0023_profile_display.sql`
- Modify: `types/database.ts` (Row/Insert/Update de `profiles`), `lib/auth/devFakeLogin.ts`, `lib/badges.ts`
- Test: `__tests__/badges.test.ts`

**Interfaces:**
- Produces: `visibleBadges(badges?: readonly string[] | null, hidden?: readonly string[] | null): string[]`; `BADGE_LABELS: Record<Badge, string>`; `badgeLabel(b: string): string | null`.

- [ ] Teste:

```ts
import { badgeLabel, visibleBadges } from '../lib/badges';

describe('visibleBadges', () => {
  it('tira os escondidos', () => expect(visibleBadges(['verified'], ['verified'])).toEqual([]));
  it('sem escondidos mostra todos', () => expect(visibleBadges(['verified'], [])).toEqual(['verified']));
  it('campos faltando', () => {
    expect(visibleBadges(undefined, undefined)).toEqual([]);
    expect(visibleBadges(['verified'], null)).toEqual(['verified']);
  });
  it('escondido que a pessoa não tem mais é ignorado', () => expect(visibleBadges([], ['verified'])).toEqual([]));
});
describe('badgeLabel', () => {
  it('rótulo conhecido ou null', () => {
    expect(badgeLabel('verified')).toBe('Selo de verificado');
    expect(badgeLabel('xyz')).toBeNull();
  });
});
```

- [ ] Implementar em `lib/badges.ts`:

```ts
export const BADGE_LABELS: Record<Badge, string> = { verified: 'Selo de verificado' };
export function badgeLabel(badge: string): string | null {
  return (BADGE_LABELS as Record<string, string>)[badge] ?? null;
}
export function visibleBadges(badges?: readonly string[] | null, hidden?: readonly string[] | null): string[] {
  return (badges ?? []).filter((b) => !hidden?.includes(b));
}
```

- [ ] Migração:

```sql
-- fellasapp: o que cada um mostra no perfil. Idempotente.
-- show_now_playing: "ouvindo agora" nos posts e no perfil. hidden_badges: selos que a pessoa escondeu
-- (guarda os escondidos: selo novo dado pelo banco já aparece).
alter table public.profiles
  add column if not exists show_now_playing boolean not null default true,
  add column if not exists hidden_badges text[] not null default '{}';

grant update (show_now_playing, hidden_badges) on public.profiles to authenticated;
```

- [ ] Tipos: `show_now_playing: boolean; hidden_badges: string[];` no Row, opcionais em Insert/Update; `fakeProfile` com `show_now_playing: true, hidden_badges: []`.
- [ ] `npx tsc --noEmit && npx jest badges` → passa. Commit.

### Task 2: Selos escondidos somem de todo lugar

**Files:**
- Modify: `lib/api/posts.ts` (`Author`, `AUTHOR_COLUMNS`), `components/ui/NameWithBadge.tsx`, `components/PostCard.tsx`, `components/feed/CommentItem.tsx`, `components/profile/MemberRow.tsx`, `components/shell/RightRail.tsx`, `components/profile/ProfileHeader.tsx`
- Test: `__tests__/PostCard.test.tsx`, `__tests__/profileHeaderViewer.test.tsx`

**Interfaces:**
- Consumes: `visibleBadges`.
- Produces: `Author` ganha `hidden_badges?: string[]; lastfm_user?: string | null; show_now_playing?: boolean`. `NameWithBadge` ganha prop `hiddenBadges?: readonly string[] | null`.

- [ ] Testes:

```tsx
// PostCard.test.tsx
it('selo escondido pelo autor não aparece', async () => {
  await render(<PostCard post={{ ...post, author: { ...post.author, badges: ['verified'], hidden_badges: ['verified'] } }} />);
  expect(screen.queryByLabelText('Verificado')).toBeNull();
});
// profileHeaderViewer.test.tsx
it('selo escondido some do cabeçalho', async () => {
  await render(<SafeAreaProvider initialMetrics={metrics}><ProfileHeader profile={{ ...profile, badges: ['verified'], hidden_badges: ['verified'] } as Profile} avatarUri={null} bannerUri={null} /></SafeAreaProvider>);
  expect(screen.queryByLabelText('Verificado')).toBeNull();
});
```

- [ ] `AUTHOR_COLUMNS = 'id, username, display_name, avatar_url, badges, hidden_badges, lastfm_user, show_now_playing'`.
- [ ] `NameWithBadge`: `hasBadge(visibleBadges(badges, hiddenBadges), 'verified')`. Chamadores passam `hiddenBadges={x.hidden_badges}`. `ProfileHeader`: `hasBadge(visibleBadges(profile.badges, profile.hidden_badges), 'verified')`.
- [ ] tsc + jest passam. Commit.

### Task 3: Cache compartilhado do "ouvindo agora"

**Files:**
- Create: `lib/lastfm/nowPlayingStore.ts`
- Modify: `lib/lastfm/useNowPlaying.ts`
- Test: `__tests__/nowPlayingStore.test.ts`, `__tests__/lastfmHooks.test.tsx` (continua passando)

**Interfaces:**
- Produces: `subscribeNowPlaying(user: string, listener: (t: LastfmTrack | null) => void): () => void`; `resetNowPlayingStore(): void` (testes). `useNowPlaying(user)` mantém a assinatura.

- [ ] Testes (fake timers): vários assinantes do mesmo usuário → 1 chamada; a cada `NOW_PLAYING_MS` mais uma; sem assinantes para; reassinar em menos de 60 s não chama de novo e entrega o último valor; erro → `null`.
- [ ] Implementar: `Map<user, { track, fetchedAt, listeners: Set, timer, inflight }>`. No 1º assinante liga o intervalo; ao assinar, entrega o valor guardado e só busca se `Date.now() - fetchedAt >= NOW_PLAYING_MS`. Último assinante sai → para o intervalo (mantém valor e horário). `NOW_PLAYING_MS` passa a morar no store e o hook reexporta.
- [ ] `useNowPlaying`: `useFocusEffect(useCallback(() => { if (!user) { setTrack(null); return; } return subscribeNowPlaying(user, setTrack); }, [user]))`.
- [ ] tsc + jest passam. Commit.

### Task 4: Primitivo `Switch`

**Files:**
- Create: `components/ui/Switch.tsx`
- Modify: `components/ui/index.ts`, `lib/theme.ts` (`layout.switch: { width: 44, height: 26, thumb: 20 }`)
- Test: `__tests__/ui.test.tsx`

**Interfaces:**
- Produces: `Switch({ value, onChange, accessibilityLabel, disabled? })`.

- [ ] Testes: tocar chama `onChange(!value)`; `accessibilityRole="switch"`, `accessibilityState.checked` = value; desabilitado não chama.
- [ ] Implementar: `Pressable` com altura `minTouch`, trilho pill (`brand` ligado, `border` desligado), bolinha `surface` com `shadows.card`, posição pela margem; desabilitado opacidade 0.5 (mesmo do `Button`).
- [ ] tsc + jest passam. Commit.

### Task 5: Seção "O que aparece no perfil" no Editar perfil

**Files:**
- Modify: `lib/api/profiles.ts` (`UpdateProfileInput.showNowPlaying?`, `hiddenBadges?`), `app/profile/edit.tsx`
- Test: `__tests__/editProfile.test.tsx`

**Interfaces:**
- Consumes: `Switch`, `badgeLabel`.
- Produces: `updateMyProfile` grava `show_now_playing` e `hidden_badges` quando definidos.

- [ ] Testes:
  - sem Last.fm: chave "Mostrar o que estou ouvindo" desabilitada e ajuda "Conecte o Last.fm acima pra usar.";
  - com Last.fm: desligar e salvar manda `showNowPlaying: false`;
  - com selo: linha "Selo de verificado"; desligar e salvar manda `hiddenBadges: ['verified']`;
  - sem selo: não há linha de selo.
- [ ] Implementar a seção (título `Heading level={3}` "O que aparece no perfil", linhas com rótulo + ajuda + `Switch`) entre Last.fm e Aniversário; `save()` manda `showNowPlaying` e `hiddenBadges` (só selos que a pessoa tem).
- [ ] tsc + jest passam. Commit.

### Task 6: "Ouvindo agora" nos posts e na rota do perfil

**Files:**
- Create: `components/music/PostNowPlaying.tsx`, `lib/profileTab.ts`
- Modify: `components/PostCard.tsx`, `components/profile/ProfileHeader.tsx`, `components/ProfileView.tsx` (`initialTab`), `lib/openProfile.ts`, `app/[handle].tsx`, `app/(tabs)/profile.tsx`, `components/music/EqualizerBars.tsx` (prop `size`)
- Test: `__tests__/PostCard.test.tsx`, `__tests__/profileHeaderViewer.test.tsx`, `__tests__/profileTab.test.ts`

**Interfaces:**
- Consumes: `useNowPlaying`, `Author.lastfm_user/show_now_playing`.
- Produces: `parseProfileTab(v?: string | string[]): ProfileTab | undefined` (`'musica'` → `'music'`, `'fotos'` → `'photos'`); `openProfile(username, opts?: { tab?: 'music' })`; `ProfileView` prop `initialTab?: ProfileTab`.

- [ ] Testes:
  - `PostCard` com autor `lastfm_user: 'anafm'` e Last.fm respondendo música → "ouvindo" + nome da música; `show_now_playing: false` → nada; sem `lastfm_user` → nada.
  - `ProfileHeader` com `show_now_playing: false` e `onOpenMusic` → sem linha "Ouvindo agora".
  - `parseProfileTab`.
- [ ] `PostNowPlaying({ user, onPress })`: equalizador pequeno + `Text variant="caption" tone="muted"` "ouvindo " + nome em negrito, uma linha, encolhe primeiro; `onPress` ausente → não é botão. PostCard só monta quando `lastfm_user && show_now_playing !== false`.
- [ ] `openProfile(u, { tab: 'music' })` → `router.push(`/@${u}?aba=musica`)`. `[handle]` lê `aba`, passa `initialTab` e, no meu @, redireciona para `/profile?aba=musica`. Aba Perfil lê `aba`. `ProfileView` aplica `initialTab` ao mudar.
- [ ] tsc + jest passam. Commit. Atualizar `DESIGN.md` (Post e Perfil). Push.
