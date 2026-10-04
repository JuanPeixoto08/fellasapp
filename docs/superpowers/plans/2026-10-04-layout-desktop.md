# Layout de desktop estilo X/Twitter — plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Em tela larga o fellasapp ganha barra lateral, coluna central de 600px e coluna "Os fellas + Aniversários"; no celular em pé nada muda.

**Architecture:** Uma moldura (`AppShell`) em volta da `Stack` raiz decide a faixa pela largura da janela (`useLayoutTier`). Em `compact` ela só repassa os filhos; em `medium`/`expanded` desenha `[Sidebar][coluna central][RightRail]`, sempre com os filhos na mesma posição da árvore (redimensionar não remonta a navegação). O compositor vira um componente com três formatos que compartilham o mesmo rascunho.

**Tech Stack:** Expo SDK 57, expo-router 57 (Stack + Tabs), React Native 0.86 / react-native-web 0.21, TypeScript 6, jest-expo + @testing-library/react-native, Supabase (só leitura de membros já existente).

**Spec:** `docs/superpowers/specs/2026-10-04-layout-desktop-design.md`

## Global Constraints

- Texto da interface em pt-BR, no tom do `PRODUCT.md`; nunca emoji como ícone (ícones `Icon`/Ionicons).
- Telas usam tokens de `lib/theme.ts` e primitivos de `components/ui`; sem cor, tamanho, raio ou fonte solta (CLAUDE.md).
- Não mudar lógica/dados de features; nenhuma migration, nenhuma dependência nova.
- `npx tsc --noEmit` e `npm test` passam ao fim de cada tarefa.
- Faixas: `compact` < 700 · `medium` 700–1099 · `expanded` ≥ 1100.
- Tokens: `layout.breakpoints = { medium: 700, expanded: 1100 }`, `layout.centerWidth = 600`, `layout.sidebarWidth = { medium: 72, expanded: 260 }`, `layout.railWidth = 350`.
- `compact` visualmente idêntico ao app atual (tab bar embaixo, topo do feed com o logo).
- Itens da lateral: Feed (`newspaper`), Perfil (`person`), Membros (`people`); ativo = ícone preenchido + `colors.brand` + negrito.
- Coluna direita: até 8 membros + "Ver todos"; próximos 3 aniversários com "Hoje"/"Amanhã"/"12 out" e ícone `gift-outline`.
- Commits pequenos, um por tarefa, na branch `feat/layout-desktop`.

## Review Focus

1. **Aniversário salvo como `AAAA-MM-DD` não pode "voltar um dia"** em fuso negativo (Brasil, UTC-3): `new Date('1999-05-20')` vira 19/05 local. → teste em Task 5 (`parseMonthDay` sem `Date(string)`).
2. **Aniversário em 29/02 num ano não bissexto** aparece em **28 fev**, e não some nem pula para março. → teste em Task 5.
3. **Redimensionar a janela com rascunho no compositor** (topo do feed ↔ página `/new` ↔ janela) não perde o texto nem as fotos: o rascunho é um só. → teste em Task 7.
4. **Item ativo da lateral em rotas filhas**: `/profile/edit`, `/user/<meu id>` e `/post/x` não marcam nada; só `/feed` (e `/`), `/profile` e `/members` marcam. → teste em Task 4.
5. **Login, "sem convite" e carregamento nunca mostram a moldura**, mesmo em tela larga (nada de lateral piscando antes do guard redirecionar). → teste em Task 8 (`shellVisible`).

---

## Estrutura de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `lib/theme.ts` (mod.) | tokens de layout novos |
| `lib/layout.ts` (novo) | `LayoutTier`, `tierForWidth`, `useLayoutTier` |
| `components/ui/interactive.ts` (novo) | `interactiveStyle`: fundo de hover/press + cursor |
| `lib/webStyles.ts` (mod.) | CSS global: `100dvh` + foco |
| `components/shell/ShellContext.tsx` (novo) | contexto da moldura: `useContentWidth`, `useOpenCompose` |
| `components/shell/Sidebar.tsx` (novo) | barra lateral + `activeNavItem` |
| `lib/birthdays.ts` (novo) | `parseMonthDay`, `nextBirthdays`, `birthdayLabel` |
| `lib/useMembers.ts` (novo) | membros + avatares assinados (usado por Membros e RightRail) |
| `components/shell/RightRail.tsx` (novo) | coluna "Os fellas" + "Aniversários" |
| `lib/composerDraft.ts` (novo) | rascunho único compartilhado pelos compositores |
| `components/feed/Composer.tsx` (novo) | compositor `page`/`inline`/`dialog` |
| `components/shell/ComposeDialog.tsx` (novo) | janela do compositor |
| `components/shell/AppShell.tsx` (novo) | moldura + `shellVisible` |
| `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/feed.tsx`, `app/(tabs)/new.tsx`, `app/members.tsx` (mod.) | ligar a moldura, esconder tab bar, compositor no topo, casca da página |
| `components/ProfileView.tsx`, `components/reactions/EmojiPicker.tsx`, `components/feed/PhotoViewer.tsx` (mod.) | largura da coluna, painel de emojis, teclado |
| `components/feed/ActionButton.tsx`, `components/ui/IconButton.tsx`, `components/profile/MemberRow.tsx`, `components/PostCard.tsx` (mod.) | hover |
| `DESIGN.md` (mod.) | seção "Layout por largura" |

---

### Task 1: Tokens de layout e faixas de largura

**Files:**
- Modify: `lib/theme.ts` (objeto `layout`)
- Create: `lib/layout.ts`
- Test: `__tests__/layout.test.ts`

**Interfaces:**
- Produces: `type LayoutTier = 'compact' | 'medium' | 'expanded'`; `tierForWidth(width: number): LayoutTier`; `useLayoutTier(): LayoutTier`; tokens `layout.breakpoints`, `layout.centerWidth`, `layout.sidebarWidth`, `layout.railWidth`, `layout.logoHeight.xs`.

- [ ] **Step 1: Write the failing test** — `__tests__/layout.test.ts`

```ts
import { tierForWidth } from '../lib/layout';
import { layout } from '../lib/theme';

describe('tierForWidth', () => {
  it.each([
    [320, 'compact'],
    [699, 'compact'],
    [700, 'medium'],
    [1099, 'medium'],
    [1100, 'expanded'],
    [2560, 'expanded'],
  ] as const)('%i px → %s', (width, tier) => {
    expect(tierForWidth(width)).toBe(tier);
  });

  it('usa os tokens do tema', () => {
    expect(layout.breakpoints).toEqual({ medium: 700, expanded: 1100 });
    expect(layout.centerWidth).toBe(600);
    expect(layout.sidebarWidth).toEqual({ medium: 72, expanded: 260 });
    expect(layout.railWidth).toBe(350);
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/layout.test.ts`
Expected: FAIL — `Cannot find module '../lib/layout'`.

- [ ] **Step 3: Implement**

Em `lib/theme.ts`, dentro de `export const layout = { ... }`, logo depois de `maxContentWidth: 640,`:

```ts
  /** Faixas de largura (px): abaixo de `medium` é celular em pé (tab bar). */
  breakpoints: { medium: 700, expanded: 1100 },
  /** Coluna central nas faixas medium/expanded. */
  centerWidth: 600,
  /** Barra lateral: só ícones (medium) ou ícone + nome (expanded). */
  sidebarWidth: { medium: 72, expanded: 260 },
  /** Coluna da direita (só expanded). */
  railWidth: 350,
```

e troque a linha `logoHeight: { sm: 24, lg: 44 },` por:

```ts
  /** Altura da marca FELLAS: lateral estreita (xs), topo do feed (sm), login/carregamento (lg). */
  logoHeight: { xs: 10, sm: 24, lg: 44 },
```

Crie `lib/layout.ts`:

```ts
import { useWindowDimensions } from 'react-native';

import { layout } from './theme';

export type LayoutTier = 'compact' | 'medium' | 'expanded';

/** compact < 700 (celular em pé) · medium 700–1099 (lateral só ícones) · expanded ≥ 1100 (3 colunas). */
export function tierForWidth(width: number): LayoutTier {
  if (width >= layout.breakpoints.expanded) return 'expanded';
  if (width >= layout.breakpoints.medium) return 'medium';
  return 'compact';
}

/** Faixa atual pela largura da janela; muda na hora ao redimensionar. */
export function useLayoutTier(): LayoutTier {
  return tierForWidth(useWindowDimensions().width);
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/layout.test.ts && npx tsc --noEmit`
Expected: PASS; tsc sem erros.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts lib/layout.ts __tests__/layout.test.ts
git commit -m "layout: tokens de faixas e useLayoutTier"
```

---

### Task 2: Interação de desktop (hover/cursor) e altura da tela na web

**Files:**
- Create: `components/ui/interactive.ts`
- Modify: `components/ui/index.ts`, `components/feed/ActionButton.tsx:29-39`, `components/ui/IconButton.tsx:41-51`, `components/profile/MemberRow.tsx:17-24`, `components/PostCard.tsx:42-50`, `lib/webStyles.ts`
- Test: `__tests__/interactive.test.ts`

**Interfaces:**
- Produces: `interactiveStyle(t: Theme, state: PressableStateCallbackType, base?: string): { backgroundColor: string; cursor: 'pointer' }` (exportado de `components/ui`).

- [ ] **Step 1: Write the failing test** — `__tests__/interactive.test.ts`

```ts
import { interactiveStyle } from '../components/ui/interactive';
import { getTheme } from '../lib/theme';

const t = getTheme('light');

describe('interactiveStyle', () => {
  it('fica no fundo base sem interação', () => {
    expect(interactiveStyle(t, { pressed: false })).toEqual({ backgroundColor: 'transparent', cursor: 'pointer' });
    expect(interactiveStyle(t, { pressed: false }, t.colors.bg).backgroundColor).toBe(t.colors.bg);
  });

  it('pressionado ou com mouse em cima (web) usa surfaceSunken', () => {
    expect(interactiveStyle(t, { pressed: true }).backgroundColor).toBe(t.colors.surfaceSunken);
    expect(interactiveStyle(t, { pressed: false, hovered: true } as never).backgroundColor).toBe(t.colors.surfaceSunken);
  });
});

describe('CSS global da web', () => {
  it('inclui a altura 100dvh (tab bar e colunas na altura certa)', () => {
    const { WEB_CSS } = require('../lib/webStyles');
    expect(WEB_CSS).toContain('#root { height: 100dvh; }');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/interactive.test.ts`
Expected: FAIL — módulo `interactive` não existe e `WEB_CSS` não é exportado.

- [ ] **Step 3: Implement**

`components/ui/interactive.ts`:

```ts
import type { PressableStateCallbackType } from 'react-native';

import type { Theme } from '../../lib/theme';

/**
 * Fundo de item clicável: pressionado (toque) ou com o mouse em cima (web/iPad com cursor) ganha
 * `surfaceSunken`; cursor de mão no desktop. O react-native-web entrega `hovered` no estado do
 * Pressable, mas os tipos do RN não declaram — por isso o cast.
 */
export function interactiveStyle(
  t: Theme,
  state: PressableStateCallbackType,
  base: string = 'transparent',
): { backgroundColor: string; cursor: 'pointer' } {
  const hovered = (state as PressableStateCallbackType & { hovered?: boolean }).hovered;
  return { backgroundColor: state.pressed || hovered ? t.colors.surfaceSunken : base, cursor: 'pointer' };
}
```

Em `components/ui/index.ts`, acrescente:

```ts
export { interactiveStyle } from './interactive';
```

`components/feed/ActionButton.tsx` — troque o `style={({ pressed }) => ({ ... backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent', })}` por:

```tsx
      style={(state) => ({
        minHeight: t.layout.minTouch,
        minWidth: t.layout.minTouch,
        paddingHorizontal: t.spacing.sm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: t.spacing.xs,
        borderRadius: t.radii.pill,
        ...interactiveStyle(t, state),
      })}
```
e mude o import para `import { interactiveStyle, Text } from '../ui';`.

`components/ui/IconButton.tsx` — no `style`, troque `({ pressed }) =>` por `(state) =>` e a linha `backgroundColor: solid ? ... : 'transparent',` por:

```tsx
        ...(solid ? { backgroundColor: t.colors.primary, cursor: 'pointer' as const } : interactiveStyle(t, state)),
        opacity: disabled ? 0.4 : state.pressed && solid ? 0.85 : 1,
```
(remova a linha `opacity` antiga) e importe `import { interactiveStyle } from './interactive';`.

`components/profile/MemberRow.tsx` — troque `({ pressed }) => ({ ... backgroundColor: pressed ? t.colors.surfaceSunken : 'transparent', })` por `(state) => ({ ...demais props..., ...interactiveStyle(t, state) })` e importe `interactiveStyle` de `'../ui'`.

`components/PostCard.tsx` — hover na linha inteira do post (sem virar botão, para não aninhar botões na web):
- import: `import { useState } from 'react';` já existe; adicione no corpo `const [hovered, setHovered] = useState(false);`
- na `View` raiz acrescente as props e o fundo:

```tsx
    <View
      onPointerEnter={() => setHovered(true)}
      onPointerLeave={() => setHovered(false)}
      style={{
        flexDirection: 'row',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingTop: t.spacing.md,
        paddingBottom: t.spacing.xs,
        backgroundColor: hovered ? t.colors.surfaceSunken : 'transparent',
      }}
    >
```

`lib/webStyles.ts` — exporte o CSS e inclua a altura:

```ts
/** Exportado para teste. */
export const WEB_CSS = `
html, body { height: 100%; }
#root { height: 100dvh; }
input:focus, input:focus-visible, textarea:focus, textarea:focus-visible { outline: none; }
`;
```
e em `injectWebStyles` use `el.textContent = WEB_CSS;` (apague a constante `CSS` antiga e atualize o comentário do topo: "- `#root` em 100dvh: a altura acompanha a barra do navegador móvel e as colunas do desktop ocupam a tela.").

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: todos PASS (os testes existentes de PostCard/IconButton/MemberRow continuam verdes).

- [ ] **Step 5: Commit**

```bash
git add components/ui/interactive.ts components/ui/index.ts components/feed/ActionButton.tsx components/ui/IconButton.tsx components/profile/MemberRow.tsx components/PostCard.tsx lib/webStyles.ts __tests__/interactive.test.ts
git commit -m "web: hover/cursor nos clicáveis e #root em 100dvh"
```

---

### Task 3: Contexto da moldura (largura da coluna e abrir compositor)

**Files:**
- Create: `components/shell/ShellContext.tsx`
- Test: `__tests__/shellContext.test.tsx`

**Interfaces:**
- Produces: `ShellContext` (React context, valor `{ contentWidth: number; openCompose: (() => void) | null } | null`); `useContentWidth(): number` (sem provider: `min(largura da janela, layout.maxContentWidth)`); `useOpenCompose(): (() => void) | null`.

- [ ] **Step 1: Write the failing test** — `__tests__/shellContext.test.tsx`

```tsx
import { render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ShellContext, useContentWidth, useOpenCompose } from '../components/shell/ShellContext';

function Probe() {
  const width = useContentWidth();
  const open = useOpenCompose();
  return <Text>{`${width}|${open ? 'pode' : 'nao'}`}</Text>;
}

describe('ShellContext', () => {
  it('sem moldura: largura da janela limitada a 640, sem compositor', async () => {
    await render(<Probe />); // janela do jest: 750px
    expect(screen.getByText('640|nao')).toBeTruthy();
  });

  it('com moldura: usa a largura e o compositor dela', async () => {
    await render(
      <ShellContext.Provider value={{ contentWidth: 600, openCompose: () => {} }}>
        <Probe />
      </ShellContext.Provider>,
    );
    expect(screen.getByText('600|pode')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/shellContext.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement** — `components/shell/ShellContext.tsx`

```tsx
import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

import { useTheme } from '../../lib/theme';

export type ShellValue = {
  /** Largura útil da coluna de conteúdo (600 no desktop). */
  contentWidth: number;
  /** Abre a janela do compositor; null quando não há moldura (celular). */
  openCompose: (() => void) | null;
};

export const ShellContext = createContext<ShellValue | null>(null);

/**
 * Largura da coluna de conteúdo. Telas que calculam tamanhos (grade de fotos, miniaturas) usam
 * isto e não a largura da janela: no desktop a janela tem 1440 e a coluna, 600.
 */
export function useContentWidth(): number {
  const shell = useContext(ShellContext);
  const { width } = useWindowDimensions();
  const t = useTheme();
  return shell?.contentWidth ?? Math.min(width, t.layout.maxContentWidth);
}

export function useOpenCompose(): (() => void) | null {
  return useContext(ShellContext)?.openCompose ?? null;
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/shellContext.test.tsx && npx tsc --noEmit`
Expected: PASS (a janela padrão do jest-expo tem 750 × 1334, então sem moldura dá `min(750, 640) = 640`).

- [ ] **Step 5: Commit**

```bash
git add components/shell/ShellContext.tsx __tests__/shellContext.test.tsx
git commit -m "shell: contexto com largura da coluna e abrir compositor"
```

---

### Task 4: Barra lateral

**Files:**
- Create: `components/shell/Sidebar.tsx`
- Test: `__tests__/sidebar.test.tsx`

**Interfaces:**
- Consumes: `LayoutTier` (Task 1), `interactiveStyle` (Task 2), `useMyAvatar()` → `{ name: string; uri: string | null }`, `useSession()` → `{ profile }`, `Logo`, `Icon`, `IconButton`, `Button`, `Avatar`, `Text`.
- Produces: `type NavKey = 'feed' | 'profile' | 'members'`; `activeNavItem(pathname: string): NavKey | null`; `Sidebar({ tier, onCompose }: { tier: Exclude<LayoutTier, 'compact'>; onCompose: () => void })`.

- [ ] **Step 1: Write the failing test** — `__tests__/sidebar.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { activeNavItem, Sidebar } from '../components/shell/Sidebar';

const mockNavigate = jest.fn();
let mockPath = '/feed';
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }),
  usePathname: () => mockPath,
}));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan Peixoto', uri: null }) }));
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ profile: { username: 'juanzin' } }),
}));

describe('activeNavItem', () => {
  it.each([
    ['/', 'feed'],
    ['/feed', 'feed'],
    ['/profile', 'profile'],
    ['/members', 'members'],
    ['/profile/edit', null],
    ['/user/abc', null],
    ['/post/123', null],
    ['/new', null],
  ] as const)('%s → %s', (path, key) => {
    expect(activeNavItem(path)).toBe(key);
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPath = '/feed';
  });

  it('expanded: nomes visíveis, item ativo marcado, navega', async () => {
    mockPath = '/members';
    await render(<Sidebar tier="expanded" onCompose={() => {}} />);
    expect(screen.getByText('Feed')).toBeTruthy();
    expect(screen.getByLabelText('Membros').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Feed').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByLabelText('Perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
    expect(screen.getByText('@juanzin')).toBeTruthy();
  });

  it('medium: só ícones (sem nomes) e Postar redondo', async () => {
    const onCompose = jest.fn();
    await render(<Sidebar tier="medium" onCompose={onCompose} />);
    expect(screen.queryByText('Feed')).toBeNull();
    expect(screen.queryByText('@juanzin')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(onCompose).toHaveBeenCalled();
  });

  it('logo leva ao feed', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Ir para o feed'));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/sidebar.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement** — `components/shell/Sidebar.tsx`

```tsx
import { usePathname, useRouter } from 'expo-router';
import { Pressable, View } from 'react-native';

import { useSession } from '../../lib/auth/SessionProvider';
import type { LayoutTier } from '../../lib/layout';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';
import { Avatar, Button, Icon, IconButton, interactiveStyle, Logo, Text, type IconName } from '../ui';

export type NavKey = 'feed' | 'profile' | 'members';

const ITEMS: { key: NavKey; label: string; href: '/feed' | '/profile' | '/members'; icon: IconName; iconActive: IconName }[] = [
  { key: 'feed', label: 'Feed', href: '/feed', icon: 'newspaper-outline', iconActive: 'newspaper' },
  { key: 'profile', label: 'Perfil', href: '/profile', icon: 'person-outline', iconActive: 'person' },
  { key: 'members', label: 'Membros', href: '/members', icon: 'people-outline', iconActive: 'people' },
];

/** Item ativo pela rota exata; rotas filhas (post, perfil de outro, editar) não marcam nada. */
export function activeNavItem(pathname: string): NavKey | null {
  if (pathname === '/' || pathname === '/feed') return 'feed';
  if (pathname === '/profile') return 'profile';
  if (pathname === '/members') return 'members';
  return null;
}

type Props = { tier: Exclude<LayoutTier, 'compact'>; onCompose: () => void };

/** Barra lateral do desktop: logo, Feed/Perfil/Membros, Postar e eu no pé. */
export function Sidebar({ tier, onCompose }: Props) {
  const t = useTheme();
  const router = useRouter();
  const active = activeNavItem(usePathname());
  const me = useMyAvatar();
  const { profile } = useSession();
  const expanded = tier === 'expanded';

  return (
    <View
      role="navigation"
      accessibilityLabel="Navegação"
      style={{
        width: t.layout.sidebarWidth[tier],
        paddingHorizontal: expanded ? t.spacing.md : t.spacing.sm,
        paddingVertical: t.spacing.lg,
        gap: t.spacing.xs,
        alignItems: expanded ? 'stretch' : 'center',
      }}
    >
      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Ir para o feed"
        onPress={() => router.navigate('/feed')}
        style={(state) => ({
          minHeight: t.layout.minTouch,
          justifyContent: 'center',
          paddingHorizontal: expanded ? t.spacing.md : t.spacing.xs,
          borderRadius: t.radii.pill,
          marginBottom: t.spacing.sm,
          ...interactiveStyle(t, state),
        })}
      >
        <Logo height={expanded ? t.layout.logoHeight.sm : t.layout.logoHeight.xs} />
      </Pressable>

      {ITEMS.map((item) => {
        const on = active === item.key;
        return (
          <Pressable
            key={item.key}
            accessibilityRole="link"
            accessibilityLabel={item.label}
            accessibilityState={{ selected: on }}
            onPress={() => router.navigate(item.href)}
            style={(state) => ({
              minHeight: t.layout.minTouch,
              minWidth: t.layout.minTouch,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: expanded ? 'flex-start' : 'center',
              gap: t.spacing.md,
              paddingHorizontal: expanded ? t.spacing.md : 0,
              borderRadius: t.radii.pill,
              ...interactiveStyle(t, state),
            })}
          >
            <Icon name={on ? item.iconActive : item.icon} size="lg" color={on ? t.colors.brand : undefined} />
            {expanded ? (
              <Text variant="lead" bold={on} style={on ? { color: t.colors.brand } : undefined}>
                {item.label}
              </Text>
            ) : null}
          </Pressable>
        );
      })}

      <View style={{ marginTop: t.spacing.md }}>
        {expanded ? (
          <Button title="Postar" onPress={onCompose} fullWidth />
        ) : (
          <IconButton icon="add" variant="solid" accessibilityLabel="Postar" onPress={onCompose} />
        )}
      </View>

      <View style={{ flex: 1 }} />

      <Pressable
        accessibilityRole="link"
        accessibilityLabel="Meu perfil"
        onPress={() => router.navigate('/profile')}
        style={(state) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-start' : 'center',
          gap: t.spacing.md,
          padding: t.spacing.sm,
          borderRadius: t.radii.pill,
          ...interactiveStyle(t, state),
        })}
      >
        <Avatar name={me.name} uri={me.uri} size={t.avatarSizes.md} />
        {expanded ? (
          <View style={{ flex: 1 }}>
            <Text bold numberOfLines={1}>
              {me.name}
            </Text>
            {profile?.username ? (
              <Text variant="small" tone="muted" numberOfLines={1}>
                @{profile.username}
              </Text>
            ) : null}
          </View>
        ) : null}
      </Pressable>
    </View>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/sidebar.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/shell/Sidebar.tsx __tests__/sidebar.test.tsx
git commit -m "shell: barra lateral (ícones/nomes, item ativo, Postar, meu perfil)"
```

---

### Task 5: Aniversários e lista de membros compartilhada

**Files:**
- Create: `lib/birthdays.ts`, `lib/useMembers.ts`
- Modify: `app/members.tsx` (usa `useMembers`)
- Test: `__tests__/birthdays.test.ts`

**Interfaces:**
- Consumes: `listMembers(): Promise<Profile[]>` e `Profile` de `lib/api/profiles`; `signPaths`; `friendlyError`; `MONTHS` de `lib/format`.
- Produces: `parseMonthDay(iso: string | null | undefined): { month: number; day: number } | null`; `nextBirthdays<M extends { birthday: string | null }>(members: M[], today: Date, limit?: number): BirthdayEntry<M>[]` com `BirthdayEntry<M> = { member: M; daysUntil: number; label: string }`; `birthdayLabel(daysUntil: number, date: Date): string`; `useMembers(): { members: Profile[]; avatars: Map<string, string>; loading: boolean; error: string | null; reload: () => void }`.

- [ ] **Step 1: Write the failing test** — `__tests__/birthdays.test.ts`

```ts
import { birthdayLabel, nextBirthdays, parseMonthDay } from '../lib/birthdays';

const m = (id: string, birthday: string | null) => ({ id, birthday });

describe('parseMonthDay', () => {
  it('lê AAAA-MM-DD sem passar por Date (não volta um dia em fuso negativo)', () => {
    expect(parseMonthDay('1999-05-20')).toEqual({ month: 4, day: 20 });
    expect(parseMonthDay('2000-01-01')).toEqual({ month: 0, day: 1 });
  });
  it.each([null, undefined, '', '20/05/1999', '1999-13-01', '1999-00-10'])('inválido %p → null', (v) => {
    expect(parseMonthDay(v)).toBeNull();
  });
});

describe('nextBirthdays', () => {
  const today = new Date(2026, 9, 4); // 4 out 2026

  it('ordena pela próxima data, com Hoje e Amanhã, e ignora quem não preencheu', () => {
    const list = nextBirthdays(
      [m('a', '1999-12-25'), m('b', '2001-10-04'), m('c', null), m('d', '1998-10-05'), m('e', '2000-11-02')],
      today,
    );
    expect(list.map((e) => [e.member.id, e.label])).toEqual([
      ['b', 'Hoje'],
      ['d', 'Amanhã'],
      ['e', '2 nov'],
    ]);
  });

  it('vira o ano: quem já fez aniversário aparece no ano que vem', () => {
    const [first] = nextBirthdays([m('a', '1999-01-10')], today);
    expect(first.label).toBe('10 jan');
    expect(first.daysUntil).toBe(98);
  });

  it('29/02 em ano não bissexto comemora em 28 fev', () => {
    const [first] = nextBirthdays([m('a', '2000-02-29')], new Date(2027, 1, 1));
    expect(first.label).toBe('28 fev');
  });

  it('limita a quantidade', () => {
    const many = ['2000-10-10', '2000-10-11', '2000-10-12', '2000-10-13'].map((b, i) => m(String(i), b));
    expect(nextBirthdays(many, today, 3)).toHaveLength(3);
  });
});

describe('birthdayLabel', () => {
  it('data curta em pt-BR', () => {
    expect(birthdayLabel(10, new Date(2026, 9, 14))).toBe('14 out');
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/birthdays.test.ts`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement**

`lib/birthdays.ts`:

```ts
import { MONTHS } from './format';

export type BirthdayEntry<M> = { member: M; daysUntil: number; label: string };

const DAY_MS = 86_400_000;

/**
 * "AAAA-MM-DD" → mês (0–11) e dia. Sem `new Date(string)`: em UTC-3 ela devolve o dia anterior.
 */
export function parseMonthDay(iso: string | null | undefined): { month: number; day: number } | null {
  const m = iso ? /^(\d{4})-(\d{2})-(\d{2})/.exec(iso) : null;
  if (!m) return null;
  const month = Number(m[2]) - 1;
  const day = Number(m[3]);
  if (month < 0 || month > 11 || day < 1 || day > 31) return null;
  return { month, day };
}

/** Aniversário no ano dado; 29/02 em ano não bissexto vira 28/02. */
function occurrence(year: number, month: number, day: number): Date {
  const lastDay = new Date(year, month + 1, 0).getDate();
  return new Date(year, month, Math.min(day, lastDay));
}

export function birthdayLabel(daysUntil: number, date: Date): string {
  if (daysUntil === 0) return 'Hoje';
  if (daysUntil === 1) return 'Amanhã';
  return `${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** Próximos aniversários a partir de hoje (inclusive), em ordem; quem não preencheu fica de fora. */
export function nextBirthdays<M extends { birthday: string | null }>(
  members: M[],
  today: Date,
  limit = 3,
): BirthdayEntry<M>[] {
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const entries: BirthdayEntry<M>[] = [];
  for (const member of members) {
    const md = parseMonthDay(member.birthday);
    if (!md) continue;
    let next = occurrence(start.getFullYear(), md.month, md.day);
    if (next < start) next = occurrence(start.getFullYear() + 1, md.month, md.day);
    // round: dias com 23/25h (horário de verão) não viram 0,96 dia
    const daysUntil = Math.round((next.getTime() - start.getTime()) / DAY_MS);
    entries.push({ member, daysUntil, label: birthdayLabel(daysUntil, next) });
  }
  return entries.sort((a, b) => a.daysUntil - b.daysUntil).slice(0, limit);
}
```

`lib/useMembers.ts` (lógica movida de `app/members.tsx`, sem mudar o comportamento):

```ts
import { useCallback, useEffect, useState } from 'react';

import { listMembers, type Profile } from './api/profiles';
import { signPaths } from './api/storage';
import { friendlyError } from './errors';

/** Membros do grupo + avatares assinados numa chamada só. Usado pela tela Membros e pela coluna direita. */
export function useMembers() {
  const [members, setMembers] = useState<Profile[]>([]);
  const [avatars, setAvatars] = useState<Map<string, string>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    setError(null);
    listMembers()
      .then(async (list) => {
        // sem as fotos a lista ainda serve (iniciais), então falha na assinatura não derruba nada
        setAvatars(await signPaths(list.map((m) => m.avatar_url)).catch(() => new Map()));
        setMembers(list);
      })
      .catch((e) => setError(friendlyError(e, 'Pode ter sido a conexão. Tenta de novo daqui a pouco.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(reload, [reload]);

  return { members, avatars, loading, error, reload };
}
```

`app/members.tsx`: apague os `useState`/`useCallback`/`useEffect` de carregamento e os imports `listMembers`, `signPaths`, `friendlyError`, `useCallback`, `useEffect`, `useState`, `type Profile`; no lugar:

```tsx
import { useMembers } from '../lib/useMembers';
// ...
  const { members, avatars, loading, error, reload } = useMembers();
```
e troque `onAction={load}` por `onAction={reload}` (o resto da tela fica igual; `resolveUrl` continua importado).

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS (inclusive os testes de perfis/membros já existentes).

- [ ] **Step 5: Commit**

```bash
git add lib/birthdays.ts lib/useMembers.ts app/members.tsx __tests__/birthdays.test.ts
git commit -m "membros: useMembers compartilhado e próximos aniversários"
```

---

### Task 6: Coluna da direita (Os fellas + Aniversários)

**Files:**
- Create: `components/shell/RightRail.tsx`
- Test: `__tests__/rightRail.test.tsx`

**Interfaces:**
- Consumes: `useMembers()` (Task 5), `nextBirthdays` (Task 5), `interactiveStyle` (Task 2), `useSession()` → `{ session }`, `resolveUrl`.
- Produces: `RightRail(): JSX.Element` (sem props).

- [ ] **Step 1: Write the failing test** — `__tests__/rightRail.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

import { RightRail } from '../components/shell/RightRail';

const mockPush = jest.fn();
const mockReload = jest.fn();
let mockState: Record<string, unknown> = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn() }) }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../lib/useMembers', () => ({ useMembers: () => mockState }));

const member = (id: string, name: string, birthday: string | null = null) => ({
  id,
  username: name.toLowerCase(),
  display_name: name,
  avatar_url: null,
  birthday,
});

beforeEach(() => {
  mockPush.mockClear();
  mockReload.mockClear();
  mockState = { members: [], avatars: new Map(), loading: false, error: null, reload: mockReload };
});

describe('RightRail', () => {
  it('lista até 8 fellas, abre perfil (o meu vai para /profile) e tem "Ver todos"', async () => {
    mockState.members = [member('me', 'Juan'), ...Array.from({ length: 9 }, (_, i) => member(`u${i}`, `Fella${i}`))];
    await render(<RightRail />);
    expect(screen.getAllByLabelText(/^Ver perfil de /)).toHaveLength(8);
    await fireEvent.press(screen.getByLabelText('Ver perfil de Juan'));
    expect(mockPush).toHaveBeenLastCalledWith('/profile');
    await fireEvent.press(screen.getByLabelText('Ver perfil de Fella0'));
    expect(mockPush).toHaveBeenLastCalledWith('/user/u0');
    await fireEvent.press(screen.getByLabelText('Ver todos os membros'));
    expect(mockPush).toHaveBeenLastCalledWith('/members');
  });

  it('mostra próximos aniversários ou o convite quando ninguém preencheu', async () => {
    mockState.members = [member('a', 'Bia')];
    await render(<RightRail />);
    expect(screen.getByText(/Ninguém pôs o aniversário ainda/)).toBeTruthy();
  });

  it('com aniversário preenchido mostra o nome e a data', async () => {
    const d = new Date();
    const iso = `2000-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    mockState.members = [member('a', 'Bia', iso)];
    await render(<RightRail />);
    expect(screen.getByLabelText('Aniversário de Bia: Hoje')).toBeTruthy();
  });

  it('erro: avisa e deixa tentar de novo', async () => {
    mockState.error = 'x';
    await render(<RightRail />);
    expect(screen.getByText('Não deu pra carregar os fellas.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(mockReload).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/rightRail.test.tsx`
Expected: FAIL — módulo não existe.

- [ ] **Step 3: Implement** — `components/shell/RightRail.tsx`

```tsx
import { useRouter } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, View } from 'react-native';

import { resolveUrl } from '../../lib/api/storage';
import { useSession } from '../../lib/auth/SessionProvider';
import { nextBirthdays } from '../../lib/birthdays';
import { useTheme } from '../../lib/theme';
import { useMembers } from '../../lib/useMembers';
import { Avatar, Button, Heading, Icon, interactiveStyle, Text } from '../ui';

const MAX_MEMBERS = 8;
const MAX_BIRTHDAYS = 3;

/** Coluna da direita (desktop largo): gente do grupo antes de qualquer métrica. */
export function RightRail() {
  const t = useTheme();
  const router = useRouter();
  const myId = useSession().session?.user.id;
  const { members, avatars, loading, error, reload } = useMembers();
  const birthdays = useMemo(() => nextBirthdays(members, new Date(), MAX_BIRTHDAYS), [members]);
  const open = (id: string) => router.push(id === myId ? '/profile' : `/user/${id}`);

  const row = (state: Parameters<typeof interactiveStyle>[1]) => ({
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: t.spacing.md,
    minHeight: t.layout.minTouch,
    paddingHorizontal: t.spacing.sm,
    borderRadius: t.radii.md,
    ...interactiveStyle(t, state),
  });

  return (
    <ScrollView
      style={{ width: t.layout.railWidth, flexGrow: 0 }}
      contentContainerStyle={{ padding: t.spacing.lg, gap: t.spacing.xl }}
    >
      <View style={{ gap: t.spacing.xs }}>
        <Heading level={3}>Os fellas</Heading>
        {loading ? (
          <ActivityIndicator color={t.colors.primary} accessibilityLabel="Carregando os fellas" />
        ) : error ? (
          <View style={{ gap: t.spacing.xs, alignItems: 'flex-start' }}>
            <Text variant="small" tone="muted" accessibilityRole="alert">
              Não deu pra carregar os fellas.
            </Text>
            <Button title="Tentar de novo" variant="ghost" onPress={reload} />
          </View>
        ) : (
          <>
            {members.slice(0, MAX_MEMBERS).map((m) => {
              const name = m.display_name || m.username;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="link"
                  accessibilityLabel={`Ver perfil de ${name}`}
                  onPress={() => open(m.id)}
                  style={row}
                >
                  <Avatar name={name} uri={resolveUrl(m.avatar_url, avatars)} size={t.avatarSizes.sm} />
                  <View style={{ flex: 1 }}>
                    <Text variant="small" bold numberOfLines={1}>
                      {name}
                    </Text>
                    <Text variant="caption" tone="muted" numberOfLines={1}>
                      @{m.username}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable
              accessibilityRole="link"
              accessibilityLabel="Ver todos os membros"
              onPress={() => router.push('/members')}
              style={row}
            >
              <Text variant="small" style={{ color: t.colors.brand }}>
                Ver todos
              </Text>
            </Pressable>
          </>
        )}
      </View>

      {!loading && !error ? (
        <View style={{ gap: t.spacing.xs }}>
          <Heading level={3}>Aniversários</Heading>
          {birthdays.length === 0 ? (
            <Text variant="small" tone="muted">
              Ninguém pôs o aniversário ainda. Põe o seu em Editar perfil.
            </Text>
          ) : (
            birthdays.map(({ member: m, label }) => {
              const name = m.display_name || m.username;
              return (
                <Pressable
                  key={m.id}
                  accessibilityRole="link"
                  accessibilityLabel={`Aniversário de ${name}: ${label}`}
                  onPress={() => open(m.id)}
                  style={row}
                >
                  <Icon name="gift-outline" size="sm" tone="muted" />
                  <Text variant="small" bold numberOfLines={1} style={{ flex: 1 }}>
                    {name}
                  </Text>
                  <Text variant="small" tone="muted">
                    {label}
                  </Text>
                </Pressable>
              );
            })
          )}
        </View>
      ) : null}
    </ScrollView>
  );
}
```

- [ ] **Step 4: Run tests**

Run: `npx jest __tests__/rightRail.test.tsx && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/shell/RightRail.tsx __tests__/rightRail.test.tsx
git commit -m "shell: coluna direita com Os fellas e Aniversários"
```

---

### Task 7: Rascunho único e compositor em três formatos

**Files:**
- Create: `lib/composerDraft.ts`, `components/feed/Composer.tsx`
- Modify: `app/(tabs)/new.tsx` (vira casca), `__tests__/newPost.test.tsx` (limpar rascunho entre testes)
- Test: `__tests__/composer.test.tsx`

**Interfaces:**
- Consumes: `useContentWidth()` (Task 3), `createPost({ body, imageUris })`, `MAX_IMAGES`, `emitPostCreated()`, `friendlyError`, `useMyAvatar()`, `useAutoGrow`, `ConfirmDialog`, `IconButton`, `Button`, `Icon`, `Avatar`, `Text`.
- Produces: `type Draft = { body: string; imageUris: string[] }`; `useDraft(): Draft`; `setDraft(next: Draft | ((d: Draft) => Draft)): void`; `clearDraft(): void`; `type ComposerVariant = 'page' | 'inline' | 'dialog'`; `Composer({ variant, onPosted, onCancel }: { variant: ComposerVariant; onPosted?: () => void; onCancel?: () => void })`.

- [ ] **Step 1: Write the failing test** — `__tests__/composer.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { Composer } from '../components/feed/Composer';
import { createPost } from '../lib/api/posts';
import { clearDraft } from '../lib/composerDraft';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));
jest.mock('../lib/api/posts', () => ({ MAX_IMAGES: 4, createPost: jest.fn().mockResolvedValue({ id: 'n' }) }));

const createPostMock = createPost as jest.Mock;

beforeEach(() => {
  clearDraft();
  createPostMock.mockClear();
});

describe('Composer', () => {
  it('inline: sem Cancelar, posta e limpa sem navegar', async () => {
    const onPosted = jest.fn();
    await render(<Composer variant="inline" onPosted={onPosted} />);
    expect(screen.queryByText('Cancelar')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() => expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [] }));
    await waitFor(() => expect(onPosted).toHaveBeenCalled());
    expect(screen.queryByDisplayValue('bora')).toBeNull();
  });

  it('dialog: fechar sem rascunho fecha direto; com rascunho pede confirmação', async () => {
    const onCancel = jest.fn();
    await render(<Composer variant="dialog" onCancel={onCancel} />);
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'rascunho');
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.getByText('Descartar o rascunho?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Descartar'));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2));
  });

  it('o rascunho é um só: sobrevive à troca de formato (redimensionar a janela)', async () => {
    const first = await render(<Composer variant="inline" />);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'meio escrito');
    first.unmount();
    await render(<Composer variant="page" />);
    expect(screen.getByDisplayValue('meio escrito')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/composer.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implement**

`lib/composerDraft.ts`:

```ts
import { useSyncExternalStore } from 'react';

export type Draft = { body: string; imageUris: string[] };

const EMPTY: Draft = { body: '', imageUris: [] };
let draft: Draft = EMPTY;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Rascunho único do post: página /new, topo do feed e janela mostram o mesmo texto e fotos, então
 * redimensionar a janela (que troca o formato) não perde nada.
 */
export function useDraft(): Draft {
  return useSyncExternalStore(subscribe, () => draft, () => draft);
}

export function setDraft(next: Draft | ((d: Draft) => Draft)): void {
  draft = typeof next === 'function' ? next(draft) : next;
  for (const listener of listeners) listener();
}

export function clearDraft(): void {
  setDraft(EMPTY);
}
```

`components/feed/Composer.tsx` (conteúdo do compositor atual de `app/(tabs)/new.tsx`, agora com formatos):

```tsx
import * as ImagePicker from 'expo-image-picker';
import { useRef, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, TextInput, View } from 'react-native';

import { createPost, MAX_IMAGES } from '../../lib/api/posts';
import { clearDraft, setDraft, useDraft } from '../../lib/composerDraft';
import { friendlyError } from '../../lib/errors';
import { emitPostCreated } from '../../lib/postEvents';
import { useTheme } from '../../lib/theme';
import { useMyAvatar } from '../../lib/useMyAvatar';
import { useContentWidth } from '../shell/ShellContext';
import { Avatar, Button, ConfirmDialog, Icon, IconButton, Text, useAutoGrow } from '../ui';

/** Mesmo limite do check posts_body_check (0001). */
const MAX_BODY = 2000;
/** O contador só aparece perto do limite, para não virar ruído. */
const COUNTER_FROM = MAX_BODY - 200;

export type ComposerVariant = 'page' | 'inline' | 'dialog';

type Props = {
  variant: ComposerVariant;
  /** Depois de postar (página: ir pro feed; janela: fechar). */
  onPosted?: () => void;
  /** Cancelar/fechar (página e janela). Com rascunho, confirma o descarte antes. */
  onCancel?: () => void;
};

/**
 * Compositor estilo Twitter em três formatos: página (/new no celular), topo do feed (desktop) e
 * janela (botão Postar da lateral). O rascunho é compartilhado entre eles.
 */
export function Composer({ variant, onPosted, onCancel }: Props) {
  const t = useTheme();
  const me = useMyAvatar();
  const contentWidth = useContentWidth();
  const { body, imageUris } = useDraft();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [discarding, setDiscarding] = useState(false);
  const input = useRef<TextInput>(null);
  const grow = useAutoGrow({
    value: body,
    textStyle: t.typography.lead,
    inset: 0,
    extra: t.spacing.sm,
    min: t.typography.lead.lineHeight + t.spacing.sm,
  });

  const room = MAX_IMAGES - imageUris.length;
  const hasDraft = body.trim().length > 0 || imageUris.length > 0;
  // coluna de conteúdo - margens - avatar - espaço entre avatar e conteúdo
  const column = contentWidth - t.layout.gutter * 2 - t.avatarSizes.md - t.spacing.md;
  const thumb = Math.floor((column - t.spacing.sm * (MAX_IMAGES - 1)) / MAX_IMAGES);

  const pickImages = async () => {
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.7,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
      });
      if (!result.canceled) {
        const picked = result.assets.map((a) => a.uri);
        if (imageUris.length + picked.length > MAX_IMAGES) {
          setError(`Cabem ${MAX_IMAGES} fotos por post. Fiquei com as primeiras.`);
        }
        setDraft((d) => ({ ...d, imageUris: [...d.imageUris, ...picked].slice(0, MAX_IMAGES) }));
      }
    } catch {
      setError('Não consegui abrir suas fotos. Confere a permissão do app e tenta de novo.');
    }
  };

  const publish = async () => {
    setSaving(true);
    setError(null);
    try {
      await createPost({ body, imageUris });
      emitPostCreated();
      clearDraft();
      onPosted?.();
    } catch (e) {
      setError(friendlyError(e, 'Não rolou postar. Tenta de novo.'));
    } finally {
      setSaving(false);
    }
  };

  const cancel = () => (hasDraft ? setDiscarding(true) : onCancel?.());

  const editor = (
    <View
      style={{
        flexDirection: 'row',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingVertical: t.spacing.md,
      }}
    >
      <Avatar name={me.name} uri={me.uri} size={t.avatarSizes.md} />
      {/* a coluna inteira foca o campo, como no Twitter: tocar no vazio abre o teclado */}
      <Pressable
        onPress={() => input.current?.focus()}
        accessible={false}
        style={{
          flex: 1,
          gap: t.spacing.sm,
          minHeight: variant === 'inline' ? t.layout.minTouch : t.layout.minTouch * 3,
        }}
      >
        <View>
          {grow.mirror}
          <TextInput
            ref={input}
            numberOfLines={1}
            accessibilityLabel="O que rolou?"
            placeholder="O que rolou, fella?"
            placeholderTextColor={t.colors.textMuted}
            selectionColor={t.colors.primary}
            multiline
            maxLength={MAX_BODY}
            value={body}
            onChangeText={(text) => setDraft((d) => ({ ...d, body: text }))}
            editable={!saving}
            textAlignVertical="top"
            style={[t.typography.lead, { color: t.colors.text, paddingTop: t.spacing.sm, height: grow.height }]}
          />
        </View>
        {!hasDraft && variant !== 'inline' ? (
          <Text variant="small" tone="muted">
            Uma frase, até {MAX_IMAGES} fotos, ou os dois. Só os fellas veem.
          </Text>
        ) : null}
        {imageUris.length > 0 ? (
          <View style={{ flexDirection: 'row', gap: t.spacing.sm }}>
            {imageUris.map((uri, i) => (
              <View key={uri} style={{ width: thumb, height: thumb }}>
                <Image
                  source={{ uri }}
                  accessibilityLabel={`Foto ${i + 1} de ${imageUris.length}`}
                  style={{ width: '100%', height: '100%', borderRadius: t.radii.md, backgroundColor: t.colors.surfaceSunken }}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Remover foto ${i + 1}`}
                  disabled={saving}
                  onPress={() => setDraft((d) => ({ ...d, imageUris: d.imageUris.filter((_, j) => j !== i) }))}
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: t.layout.minTouch,
                    height: t.layout.minTouch,
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <View
                    style={{
                      width: t.layout.chipHeight,
                      height: t.layout.chipHeight,
                      borderRadius: t.radii.pill,
                      backgroundColor: t.colors.overlay,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon name="close" size="sm" color={t.colors.onOverlay} />
                  </View>
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        {error ? (
          <Text variant="small" tone="danger" accessibilityRole="alert">
            {error}
          </Text>
        ) : null}
      </Pressable>
    </View>
  );

  const toolbar = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.xs,
        paddingHorizontal: t.spacing.sm,
        paddingVertical: variant === 'inline' ? t.spacing.xs : 0,
        borderTopWidth: variant === 'inline' ? 0 : t.borders.hairline,
        borderColor: t.colors.border,
        backgroundColor: t.colors.bg,
      }}
    >
      <IconButton
        icon="image-outline"
        accessibilityLabel={room > 0 ? 'Adicionar fotos' : `Já tem ${MAX_IMAGES} fotos`}
        variant="ghost"
        onPress={pickImages}
        disabled={room === 0 || saving}
      />
      <Text variant="small" tone="muted">
        {imageUris.length}/{MAX_IMAGES} fotos
      </Text>
      <View style={{ flex: 1 }} />
      {body.length >= COUNTER_FROM ? (
        <Text
          variant="small"
          tone={body.length >= MAX_BODY ? 'danger' : 'muted'}
          accessibilityLabel={`${MAX_BODY - body.length} caracteres restantes`}
          style={{ paddingHorizontal: t.spacing.sm }}
        >
          {MAX_BODY - body.length}
        </Text>
      ) : null}
      {variant === 'inline' ? (
        <Button title="Postar" loading={saving} disabled={!hasDraft} onPress={publish} />
      ) : null}
    </View>
  );

  const discardDialog = (
    <ConfirmDialog
      visible={discarding}
      title="Descartar o rascunho?"
      message="O texto e as fotos escolhidas somem."
      confirmLabel="Descartar"
      cancelLabel="Continuar escrevendo"
      onConfirm={() => {
        clearDraft();
        setError(null);
        setDiscarding(false);
        onCancel?.();
      }}
      onClose={() => setDiscarding(false)}
    />
  );

  if (variant === 'inline') {
    return (
      <View>
        {editor}
        {toolbar}
      </View>
    );
  }

  const header = (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: variant === 'dialog' ? t.spacing.sm : t.layout.gutter,
        paddingVertical: t.spacing.sm,
      }}
    >
      {variant === 'page' ? (
        <Button title="Cancelar" variant="ghost" disabled={!hasDraft || saving} onPress={cancel} />
      ) : (
        <IconButton icon="close" accessibilityLabel="Fechar" variant="ghost" onPress={cancel} disabled={saving} />
      )}
      <Button title="Postar" loading={saving} disabled={!hasDraft} onPress={publish} />
    </View>
  );

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {header}
      <ScrollView
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ width: '100%', maxWidth: t.layout.maxContentWidth, alignSelf: 'center' }}
      >
        {editor}
      </ScrollView>
      {toolbar}
      {discardDialog}
    </KeyboardAvoidingView>
  );
}
```

Observação: no formato `inline` o `discardDialog` não é renderizado (não há Cancelar).

`app/(tabs)/new.tsx` vira:

```tsx
import { useRouter } from 'expo-router';

import { Composer } from '../../components/feed/Composer';
import { Screen } from '../../components/ui';

/** Novo post no celular: o compositor em página inteira. */
export default function NewPostScreen() {
  const router = useRouter();
  const toFeed = () => router.navigate('/feed');
  return (
    <Screen flush>
      <Composer variant="page" onPosted={toFeed} onCancel={toFeed} />
    </Screen>
  );
}
```

`__tests__/newPost.test.tsx`: importe `import { clearDraft } from '../lib/composerDraft';` e acrescente `clearDraft();` como primeira linha do `beforeEach` (o rascunho agora é global e vazaria entre testes).

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS — `composer.test.tsx` novo e os 5 testes de `newPost.test.tsx` (comportamento da página igual ao de antes).

- [ ] **Step 5: Commit**

```bash
git add lib/composerDraft.ts components/feed/Composer.tsx "app/(tabs)/new.tsx" __tests__/composer.test.tsx __tests__/newPost.test.tsx
git commit -m "compositor: componente com formatos página/topo/janela e rascunho único"
```

---

### Task 8: Moldura, janela do compositor e ligação no app

**Files:**
- Create: `components/shell/ComposeDialog.tsx`, `components/shell/AppShell.tsx`
- Modify: `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/feed.tsx`
- Test: `__tests__/appShell.test.tsx`

**Interfaces:**
- Consumes: `useLayoutTier` (Task 1), `ShellContext` (Task 3), `Sidebar` (Task 4), `RightRail` (Task 6), `Composer` (Task 7), `useSession()` → `{ session, profile, loading }`, `useSegments()`.
- Produces: `shellVisible(s: { loading: boolean; hasSession: boolean; isMember: boolean; first: string | undefined }): boolean`; `AppShell({ children }: { children: ReactNode })`; `ComposeDialog({ visible, onClose }: { visible: boolean; onClose: () => void })`.

- [ ] **Step 1: Write the failing test** — `__tests__/appShell.test.tsx`

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';

import { AppShell, shellVisible } from '../components/shell/AppShell';

let mockTier = 'expanded';
let mockSegments = ['(tabs)', 'feed'];
let mockSession: Record<string, unknown> = {};
jest.mock('../lib/layout', () => ({ useLayoutTier: () => mockTier }));
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  usePathname: () => '/feed',
  useRouter: () => ({ navigate: jest.fn(), push: jest.fn() }),
}));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => mockSession }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));
jest.mock('../components/shell/RightRail', () => {
  const { Text: RNText } = require('react-native');
  return { RightRail: () => <RNText>coluna-direita</RNText> };
});
jest.mock('../components/shell/ComposeDialog', () => {
  const { Text: RNText } = require('react-native');
  return { ComposeDialog: ({ visible }: { visible: boolean }) => (visible ? <RNText>janela-aberta</RNText> : null) };
});

const member = { session: { user: { id: 'me' } }, profile: { is_member: true, username: 'juan' }, loading: false };

beforeEach(() => {
  mockTier = 'expanded';
  mockSegments = ['(tabs)', 'feed'];
  mockSession = member;
});

const renderShell = () =>
  render(
    <AppShell>
      <Text>conteudo</Text>
    </AppShell>,
  );

describe('shellVisible', () => {
  const base = { loading: false, hasSession: true, isMember: true, first: '(tabs)' };
  it('só para membro logado fora de login/sem convite', () => {
    expect(shellVisible(base)).toBe(true);
    expect(shellVisible({ ...base, loading: true })).toBe(false);
    expect(shellVisible({ ...base, hasSession: false })).toBe(false);
    expect(shellVisible({ ...base, isMember: false })).toBe(false);
    expect(shellVisible({ ...base, first: '(auth)' })).toBe(false);
    expect(shellVisible({ ...base, first: 'not-invited' })).toBe(false);
  });
});

describe('AppShell', () => {
  it('compact: só o conteúdo (celular igual a hoje)', async () => {
    mockTier = 'compact';
    await renderShell();
    expect(screen.getByText('conteudo')).toBeTruthy();
    expect(screen.queryByLabelText('Navegação')).toBeNull();
    expect(screen.queryByText('coluna-direita')).toBeNull();
  });

  it('medium: lateral sem coluna direita', async () => {
    mockTier = 'medium';
    await renderShell();
    expect(screen.getByLabelText('Navegação')).toBeTruthy();
    expect(screen.queryByText('coluna-direita')).toBeNull();
  });

  it('expanded: lateral + coluna direita; Postar abre a janela', async () => {
    await renderShell();
    expect(screen.getByLabelText('Navegação')).toBeTruthy();
    expect(screen.getByText('coluna-direita')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(screen.getByText('janela-aberta')).toBeTruthy();
  });

  it('login em tela larga: sem moldura', async () => {
    mockSegments = ['(auth)', 'login'];
    mockSession = { session: null, profile: null, loading: false };
    await renderShell();
    expect(screen.queryByLabelText('Navegação')).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/appShell.test.tsx`
Expected: FAIL — módulos não existem.

- [ ] **Step 3: Implement**

`components/shell/ComposeDialog.tsx`:

```tsx
import { Modal, useWindowDimensions, View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Composer } from '../feed/Composer';

type Props = { visible: boolean; onClose: () => void };

/** Janela do compositor (botão Postar da lateral), centralizada por cima de qualquer tela. */
export function ComposeDialog({ visible, onClose }: Props) {
  const t = useTheme();
  const { height } = useWindowDimensions();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View
        style={{
          flex: 1,
          backgroundColor: t.colors.overlay,
          alignItems: 'center',
          justifyContent: 'center',
          padding: t.layout.gutter,
        }}
      >
        <View
          accessibilityViewIsModal
          style={[
            {
              width: '100%',
              maxWidth: t.layout.centerWidth,
              height: height * t.layout.sheetHeightRatio,
              backgroundColor: t.colors.bg,
              borderRadius: t.radii.lg,
              borderWidth: t.borders.hairline,
              borderColor: t.colors.border,
              overflow: 'hidden',
            },
            t.shadows.raised,
          ]}
        >
          {visible ? <Composer variant="dialog" onPosted={onClose} onCancel={onClose} /> : null}
        </View>
      </View>
    </Modal>
  );
}
```

`components/shell/AppShell.tsx`:

```tsx
import { useSegments } from 'expo-router';
import { useMemo, useState, type ReactNode } from 'react';
import { useWindowDimensions, View } from 'react-native';

import { useSession } from '../../lib/auth/SessionProvider';
import { useLayoutTier } from '../../lib/layout';
import { useTheme } from '../../lib/theme';
import { ComposeDialog } from './ComposeDialog';
import { RightRail } from './RightRail';
import { ShellContext } from './ShellContext';
import { Sidebar } from './Sidebar';

/** A moldura só existe para membro logado, fora do login e do "sem convite". */
export function shellVisible(s: { loading: boolean; hasSession: boolean; isMember: boolean; first: string | undefined }) {
  return !s.loading && s.hasSession && s.isMember && s.first !== '(auth)' && s.first !== 'not-invited';
}

/**
 * Layout por largura: em compact só repassa os filhos (celular igual a hoje); em medium/expanded
 * desenha [lateral][coluna central 600][coluna direita]. Os filhos ficam sempre na mesma posição da
 * árvore (os lados entram como null), então trocar de faixa não remonta a navegação.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const t = useTheme();
  const tier = useLayoutTier();
  const { width } = useWindowDimensions();
  const { session, profile, loading } = useSession();
  const first = useSegments()[0] as string | undefined;
  const [composing, setComposing] = useState(false);

  const framed =
    tier !== 'compact' && shellVisible({ loading, hasSession: !!session, isMember: !!profile?.is_member, first });
  const contentWidth = framed ? t.layout.centerWidth : Math.min(width, t.layout.maxContentWidth);
  const value = useMemo(
    () => ({ contentWidth, openCompose: framed ? () => setComposing(true) : null }),
    [contentWidth, framed],
  );

  return (
    <ShellContext.Provider value={value}>
      <View style={{ flex: 1, flexDirection: 'row', justifyContent: 'center', backgroundColor: t.colors.bg }}>
        {framed && tier !== 'compact' ? <Sidebar tier={tier} onCompose={() => setComposing(true)} /> : null}
        <View
          style={
            framed
              ? {
                  width: t.layout.centerWidth,
                  borderLeftWidth: t.borders.hairline,
                  borderRightWidth: t.borders.hairline,
                  borderColor: t.colors.border,
                }
              : { flex: 1 }
          }
        >
          {children}
        </View>
        {framed && tier === 'expanded' ? <RightRail /> : null}
      </View>
      {framed ? <ComposeDialog visible={composing} onClose={() => setComposing(false)} /> : null}
    </ShellContext.Provider>
  );
}
```

`app/_layout.tsx` — importe `import { AppShell } from '../components/shell/AppShell';` e troque o bloco `<AuthGuard>...</AuthGuard>` por:

```tsx
      <AuthGuard>
        <AppShell>
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="(auth)/login" />
            <Stack.Screen name="not-invited" />
            <Stack.Screen name="profile/edit" options={{ headerShown: true, title: 'Editar perfil' }} />
            <Stack.Screen name="user/[id]" options={{ headerShown: true, title: 'Perfil' }} />
            <Stack.Screen name="members" options={{ headerShown: true, title: 'Membros' }} />
          </Stack>
        </AppShell>
      </AuthGuard>
```

`app/(tabs)/_layout.tsx` — importe `import { useLayoutTier } from '../../lib/layout';`, no corpo `const tier = useLayoutTier();` e troque a linha `tabBarStyle: getTabBarStyle(t, insets),` por:

```tsx
        // no desktop a navegação é a barra lateral da moldura
        tabBarStyle: tier === 'compact' ? getTabBarStyle(t, insets) : { display: 'none' },
```

`app/(tabs)/feed.tsx` — importe `import { Composer } from '../../components/feed/Composer';` e `import { useLayoutTier } from '../../lib/layout';`, no corpo `const tier = useLayoutTier();` e troque o `ListHeaderComponent` por:

```tsx
        ListHeaderComponent={
          tier === 'compact' ? (
            <View
              style={{
                paddingHorizontal: t.layout.gutter,
                paddingTop: t.spacing.lg,
                paddingBottom: t.spacing.sm,
                borderBottomWidth: t.borders.hairline,
                borderColor: t.colors.border,
              }}
            >
              <View accessibilityRole="header">
                <Logo height={t.layout.logoHeight.sm} />
              </View>
            </View>
          ) : (
            // desktop: o logo está na lateral; a coluna começa pelo compositor
            <View style={{ borderBottomWidth: t.borders.hairline, borderColor: t.colors.border }}>
              <Composer variant="inline" />
            </View>
          )
        }
```

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS — `appShell.test.tsx` novo e todos os anteriores. Atenção: a janela padrão do jest-expo tem 750px, que é a faixa `medium`; todo teste que dependa da faixa simula `../lib/layout` (como este arquivo faz), em vez de confiar no tamanho da janela.

- [ ] **Step 5: Commit**

```bash
git add components/shell/ComposeDialog.tsx components/shell/AppShell.tsx app/_layout.tsx "app/(tabs)/_layout.tsx" "app/(tabs)/feed.tsx" __tests__/appShell.test.tsx
git commit -m "shell: moldura por largura, janela do compositor e compositor no topo do feed"
```

---

### Task 9: Largura da coluna no perfil e emojis em painel no desktop

**Files:**
- Modify: `components/ProfileView.tsx:183-188`, `components/reactions/EmojiPicker.tsx:52-57,78-80,134-151`
- Test: `__tests__/emojiPanel.test.tsx` (novo), `__tests__/profiles.test.tsx` (acrescentar)

**Interfaces:**
- Consumes: `useContentWidth()` (Task 3), `useLayoutTier()` (Task 1).

- [ ] **Step 1: Write the failing tests**

`__tests__/emojiPanel.test.tsx` (arquivo próprio para poder simular a faixa no topo):

```tsx
import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { EmojiPicker } from '../components/reactions/EmojiPicker';

let mockTier = 'compact';
jest.mock('../lib/layout', () => ({ useLayoutTier: () => mockTier }));

const renderPicker = () =>
  render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 750, height: 1334 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
    >
      <EmojiPicker visible selected={null} onSelect={() => {}} onClose={() => {}} />
    </SafeAreaProvider>,
  );

describe('EmojiPicker por faixa', () => {
  it('celular: folha de baixo na largura da tela, só cantos de cima arredondados', async () => {
    mockTier = 'compact';
    await renderPicker();
    const style = StyleSheet.flatten(screen.getByTestId('emoji-sheet').props.style);
    expect(style).toMatchObject({ width: '100%', borderTopLeftRadius: 12, borderTopRightRadius: 12 });
    expect(style.borderRadius).toBeUndefined();
  });

  it('desktop: painel centralizado de 400 com os quatro cantos arredondados', async () => {
    mockTier = 'expanded';
    await renderPicker();
    const style = StyleSheet.flatten(screen.getByTestId('emoji-sheet').props.style);
    expect(style).toMatchObject({ width: 400, borderRadius: 12 });
  });
});
```

No `describe('ProfileView', ...)` de `__tests__/profiles.test.tsx` (acrescente `StyleSheet` ao import de `react-native` do arquivo, ou `import { StyleSheet } from 'react-native';` se não houver):

```tsx
  it('grade de fotos usa a largura da coluna (moldura), não a da janela', async () => {
    const { ShellContext } = require('../components/shell/ShellContext');
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 1440, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <ShellContext.Provider value={{ contentWidth: 600, openCompose: null }}>
          <ProfileView userId="u1" />
        </ShellContext.Provider>
      </SafeAreaProvider>,
    );
    await fireEvent.press(await screen.findByText('Fotos'));
    // (600 - 2*16 - 2*4) / 3 = 186
    const style = StyleSheet.flatten(screen.getByTestId('post-tile').props.style);
    expect(style).toMatchObject({ width: 186, height: 186 });
  });
```

- [ ] **Step 2: Run them to see them fail**

Run: `npx jest __tests__/emojiPanel.test.tsx __tests__/profiles.test.tsx`
Expected: FAIL — `emoji-sheet` não existe; tile calculado pela janela (750 → 640 → 200).

- [ ] **Step 3: Implement**

`components/ProfileView.tsx` (em `ProfileContent`): remova `const { width } = useWindowDimensions();` (e o import de `useWindowDimensions`), importe `import { useContentWidth } from './shell/ShellContext';` e troque a linha do `content` por:

```tsx
  const content = useContentWidth() - t.layout.gutter * 2;
```

`components/reactions/EmojiPicker.tsx`:
- importe `import { useLayoutTier } from '../../lib/layout';` e, depois de `const { width, height } = useWindowDimensions();`, acrescente `const panel = useLayoutTier() !== 'compact';`
- troque `const sheetWidth = Math.min(width, t.layout.maxContentWidth);` por:

```tsx
  // celular: folha de baixo na largura da tela; desktop: painel centralizado de 400
  const sheetWidth = panel
    ? Math.min(width - t.layout.gutter * 2, t.layout.maxDialogWidth)
    : Math.min(width, t.layout.maxContentWidth);
```
- no fundo do `Modal`, troque `justifyContent: 'flex-end'` por `justifyContent: panel ? 'center' : 'flex-end'`;
- troque o `style` da folha (`<View accessibilityViewIsModal style={{ width: '100%', ... paddingBottom: insets.bottom }}>`) por:

```tsx
        <View
          testID="emoji-sheet"
          accessibilityViewIsModal
          style={{
            width: panel ? sheetWidth : '100%',
            maxWidth: t.layout.maxContentWidth,
            alignSelf: 'center',
            height: height * t.layout.sheetHeightRatio,
            backgroundColor: t.colors.surface,
            ...(panel
              ? { borderRadius: t.radii.lg }
              : { borderTopLeftRadius: t.radii.lg, borderTopRightRadius: t.radii.lg }),
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            paddingBottom: panel ? 0 : insets.bottom,
          }}
        >
```
- atualize o comentário do componente: "Sobe de baixo no celular; no desktop abre como painel centralizado."

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/ProfileView.tsx components/reactions/EmojiPicker.tsx __tests__/emojiPanel.test.tsx __tests__/profiles.test.tsx
git commit -m "desktop: grade do perfil pela coluna e seletor de emojis em painel"
```

---

### Task 10: Teclado no visualizador de fotos (web)

**Files:**
- Modify: `components/feed/PhotoViewer.tsx`
- Test: `__tests__/photoViewer.test.ts`

**Interfaces:**
- Produces: `viewerKeyAction(key: string, current: number, count: number): { type: 'go'; to: number } | { type: 'close' } | null`.

- [ ] **Step 1: Write the failing test** — `__tests__/photoViewer.test.ts`

```ts
import { viewerKeyAction } from '../components/feed/PhotoViewer';

describe('viewerKeyAction', () => {
  it('setas trocam de foto dentro dos limites', () => {
    expect(viewerKeyAction('ArrowRight', 0, 3)).toEqual({ type: 'go', to: 1 });
    expect(viewerKeyAction('ArrowLeft', 2, 3)).toEqual({ type: 'go', to: 1 });
    expect(viewerKeyAction('ArrowRight', 2, 3)).toBeNull();
    expect(viewerKeyAction('ArrowLeft', 0, 3)).toBeNull();
  });
  it('Esc fecha; outras teclas não fazem nada', () => {
    expect(viewerKeyAction('Escape', 1, 3)).toEqual({ type: 'close' });
    expect(viewerKeyAction('a', 1, 3)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to see it fail**

Run: `npx jest __tests__/photoViewer.test.ts`
Expected: FAIL — `viewerKeyAction` não é exportado.

- [ ] **Step 3: Implement** — em `components/feed/PhotoViewer.tsx`, acima do componente:

```tsx
/** Tecla → ação no visualizador (web): ← → trocam de foto, Esc fecha. */
export function viewerKeyAction(
  key: string,
  current: number,
  count: number,
): { type: 'go'; to: number } | { type: 'close' } | null {
  if (key === 'Escape') return { type: 'close' };
  if (key === 'ArrowRight' && current < count - 1) return { type: 'go', to: current + 1 };
  if (key === 'ArrowLeft' && current > 0) return { type: 'go', to: current - 1 };
  return null;
}
```

e dentro do componente, depois da função `go`:

```tsx
  // teclado só na web e só com o visualizador aberto
  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      const action = viewerKeyAction(e.key, current, uris.length);
      if (!action) return;
      e.preventDefault();
      if (action.type === 'close') onClose();
      else go(action.to);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });
```
(sem array de dependências de propósito: o listener é refeito a cada render e lê `current` atualizado.)

- [ ] **Step 4: Run tests**

Run: `npx jest && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add components/feed/PhotoViewer.tsx __tests__/photoViewer.test.ts
git commit -m "fotos: setas e Esc no visualizador (web)"
```

---

### Task 11: DESIGN.md e conferência visual

**Files:**
- Modify: `DESIGN.md`

- [ ] **Step 1: Documentar** — acrescente ao `DESIGN.md`, antes de "## Não fazer":

```markdown
## Layout por largura
Faixas (`useLayoutTier`, tokens `layout.breakpoints`): **compact** < 700 (celular em pé: tab bar, como sempre) · **medium** 700–1099 (lateral só com ícones) · **expanded** ≥ 1100 (lateral com nomes + coluna direita).
- `AppShell` envolve a pilha de telas: `[Sidebar][coluna central 600 (layout.centerWidth), fios dos dois lados][RightRail 350]`, centralizado. Login, "sem convite" e carregamento ficam fora.
- Sidebar: logo (→ feed), Feed/Perfil/Membros (ativo = ícone cheio + `brand` + negrito), botão Postar (abre a janela do compositor), eu no pé.
- RightRail: "Os fellas" (até 8 + Ver todos) e "Aniversários" (próximos 3; Hoje/Amanhã/12 out; ícone `gift-outline`).
- Compositor (`components/feed/Composer`): página no celular, topo do feed e janela no desktop, um rascunho só.
- Tamanhos que dependem da largura usam `useContentWidth()` (coluna), nunca a janela. Seletor de emojis vira painel de 400 no desktop.
- Web/desktop: hover `surfaceSunken` + cursor de mão em clicáveis (`interactiveStyle`); ← → Esc no visualizador.
```

- [ ] **Step 2: Conferência visual** (sem commit de arquivos temporários)

1. `EXPO_PUBLIC_DEV_FAKE_LOGIN=1 npx expo start --web --port 8099` (em segundo plano).
2. No Chrome, uma página com 3 `iframe` de `http://localhost:8099/feed` com larguras 390, 900 e 1440 (altura 844), tema escuro do sistema; repetir no claro.
3. Conferir: 390 = igual ao app de hoje (tab bar, logo no topo); 900 = lateral de ícones, sem coluna direita, compositor no topo do feed; 1440 = lateral com nomes, coluna direita (com login falso ela mostra "Não deu pra carregar os fellas" — esperado sem Supabase), botão Postar abre a janela; redimensionar a janela com texto no compositor mantém o texto.
4. Parar o servidor e rodar `git checkout -- tsconfig.json` (o Expo reescreve esse arquivo ao subir).

- [ ] **Step 3: Verificação final**

Run: `npx tsc --noEmit && npm test && npm run build:web`
Expected: tsc sem erros; todos os testes PASS; build `Exported: dist` + `fix-web-export`.

- [ ] **Step 4: Commit**

```bash
git add DESIGN.md
git commit -m "docs: layout por largura no DESIGN.md"
```
