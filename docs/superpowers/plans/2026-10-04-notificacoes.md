# Notificações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tela de Notificações dentro do app (curtida, reação, comentário, resposta na conversa, aniversário, fella novo), com bolinha de não lidas no sino do topo do feed (celular) e na lateral (computador).

**Architecture:** Sem tabela de notificações: uma função SQL (`notifications_feed`) calcula a lista agrupada na hora a partir de likes/comments/reactions/profiles; "lido" é `profiles.notifications_seen_at`. No app, `lib/api/notifications.ts` chama as funções e junta perfis/miniaturas; um store em memória (`useSyncExternalStore`) guarda o número da bolinha, atualizado por `NotificationsSync` (ao entrar, a cada 60 s, ao voltar para o app).

**Tech Stack:** Supabase (Postgres, RPC), Expo Router, React Native 0.86 / react-native-web, jest-expo + RNTL 14.

**Spec:** `docs/superpowers/specs/2026-10-04-notificacoes-design.md`

## Global Constraints

- Telas usam tokens de `lib/theme.ts` e componentes de `components/ui`. Sem cores, tamanhos, raios ou fontes soltos. Primitivo faltando → adicionar em `components/ui` com tokens.
- Texto da interface em pt-BR, tom do `PRODUCT.md`; **sem emoji no texto do sistema** (só os emojis de reação escolhidos pelos fellas).
- `npx tsc --noEmit` e `npm test` (= `npx jest`) devem passar ao fim de cada task.
- Janela de 30 dias, no máximo 50 linhas; "hoje" em `America/Sao_Paulo`.
- Arquivos usam CRLF: para editar trechos de várias linhas prefira a ferramenta Edit; scripts devem normalizar `\r\n`.
- O servidor de desenvolvimento do usuário na porta 8081 não deve ser tocado. Se rodar `expo start`, use outra porta e depois `git checkout -- tsconfig.json`.
- A migração **não** é aplicada pelo executor (o dono roda `supabase db push`). Não publicar (push na `main`) antes de a migração estar aplicada.

## Review Focus

1. Pessoa sem sessão ou que não é membro: `NotificationsSync` não pode chamar a API e a bolinha fica 0 → teste na Task 5.
2. Troca de conta no mesmo aparelho: o número da conta anterior não pode aparecer → teste na Task 5 (zera ao mudar `userId`).
3. Ator sem perfil legível (conta apagada): a linha aparece com "Alguém" em vez de quebrar → testes nas Tasks 3 e 4.
4. Post apagado entre a função e a busca dos posts: linha sem miniatura, sem erro → teste na Task 4.
5. Falha de rede ao abrir a tela: estado de erro com "Tentar de novo" e a bolinha **não** é zerada (não marcou como visto) → teste na Task 6.

---

### Task 1: Migração 0008 e tipos do banco

**Files:**
- Create: `supabase/migrations/0008_notifications.sql`
- Modify: `types/database.ts` (profiles Row/Insert/Update; `Functions`)
- Modify: `lib/auth/devFakeLogin.ts` (`fakeProfile` ganha `notifications_seen_at`)

**Interfaces:**
- Produces (SQL): `public.notifications_feed(p_limit integer default 50)` → linhas `{ kind text, post_id uuid, comment_id uuid, actor_ids uuid[], actor_count integer, emojis text[], body text, latest_at timestamptz, unread boolean }`; `public.unread_notifications_count()` → `integer`; `public.mark_notifications_seen()` → `void`; coluna `profiles.notifications_seen_at`.
- Produces (TS): `Database['public']['Functions']['notifications_feed'|'unread_notifications_count'|'mark_notifications_seen']`.

- [ ] **Step 1: Escrever a migração**

`supabase/migrations/0008_notifications.sql`:

```sql
-- fellasapp: notificações calculadas na hora (sem tabela). Idempotente.
-- "Lido" = profiles.notifications_seen_at (última visita à tela de notificações).
-- Tipos: like, post_reaction, comment_reaction, comment, thread_reply, birthday, new_member.
-- Janela de 30 dias; "hoje" (aniversário) em America/Sao_Paulo.

alter table public.profiles
  add column if not exists notifications_seen_at timestamptz not null default now();

create or replace function public.notifications_feed(p_limit integer default 50)
returns table (
  kind        text,
  post_id     uuid,
  comment_id  uuid,
  actor_ids   uuid[],
  actor_count integer,
  emojis      text[],
  body        text,
  latest_at   timestamptz,
  unread      boolean
)
language sql
stable
security invoker
set search_path = public
as $$
  with me as (
    select p.id as uid,
           p.notifications_seen_at as seen_at,
           now() - interval '30 days' as since,
           (now() at time zone 'America/Sao_Paulo')::date as today
      from public.profiles p
     where p.id = auth.uid() and p.is_member
  ),
  like_ev as (
    select l.post_id, l.user_id, l.created_at
      from public.likes l
      join public.posts po on po.id = l.post_id
      cross join me
     where po.author_id = me.uid and l.user_id <> me.uid and l.created_at >= me.since
  ),
  post_reaction_ev as (
    select r.post_id, r.user_id, r.emoji, r.created_at
      from public.post_reactions r
      join public.posts po on po.id = r.post_id
      cross join me
     where po.author_id = me.uid and r.user_id <> me.uid and r.created_at >= me.since
  ),
  comment_reaction_ev as (
    select c.post_id, r.comment_id, r.user_id, r.emoji, r.created_at
      from public.comment_reactions r
      join public.comments c on c.id = r.comment_id
      cross join me
     where c.author_id = me.uid and r.user_id <> me.uid and r.created_at >= me.since
  ),
  feed as (
    -- curtidas no meu post, agrupadas por post
    select 'like'::text as kind,
           e.post_id,
           null::uuid as comment_id,
           (array_agg(e.user_id order by e.created_at desc))[1:3] as actor_ids,
           count(*)::integer as actor_count,
           '{}'::text[] as emojis,
           null::text as body,
           max(e.created_at) as latest_at
      from like_ev e
     group by e.post_id

    union all
    -- reações no meu post, agrupadas por post; até 3 emojis distintos, o mais recente primeiro
    select 'post_reaction',
           e.post_id,
           null::uuid,
           (array_agg(e.user_id order by e.created_at desc))[1:3],
           count(*)::integer,
           (select (array_agg(x.emoji order by x.at desc))[1:3]
              from (select e2.emoji, max(e2.created_at) as at
                      from post_reaction_ev e2
                     where e2.post_id = e.post_id
                     group by e2.emoji) x),
           null::text,
           max(e.created_at)
      from post_reaction_ev e
     group by e.post_id

    union all
    -- reações no meu comentário, agrupadas por comentário
    select 'comment_reaction',
           e.post_id,
           e.comment_id,
           (array_agg(e.user_id order by e.created_at desc))[1:3],
           count(*)::integer,
           (select (array_agg(x.emoji order by x.at desc))[1:3]
              from (select e2.emoji, max(e2.created_at) as at
                      from comment_reaction_ev e2
                     where e2.comment_id = e.comment_id
                     group by e2.emoji) x),
           null::text,
           max(e.created_at)
      from comment_reaction_ev e
     group by e.post_id, e.comment_id

    union all
    -- comentário de outra pessoa no meu post (um por linha)
    select 'comment',
           c.post_id,
           c.id,
           array[c.author_id],
           1,
           '{}'::text[],
           c.body,
           c.created_at
      from public.comments c
      join public.posts po on po.id = c.post_id
      cross join me
     where po.author_id = me.uid and c.author_id <> me.uid and c.created_at >= me.since

    union all
    -- resposta na conversa: post de outra pessoa em que eu comentei antes
    select 'thread_reply',
           c.post_id,
           c.id,
           array[c.author_id],
           1,
           '{}'::text[],
           c.body,
           c.created_at
      from public.comments c
      join public.posts po on po.id = c.post_id
      cross join me
     where po.author_id <> me.uid
       and c.author_id <> me.uid
       and c.created_at >= me.since
       and exists (
             select 1
               from public.comments mine
              where mine.post_id = c.post_id
                and mine.author_id = me.uid
                and mine.created_at < c.created_at
           )

    union all
    -- aniversário de hoje (29/02 aparece em 28/02 nos anos não bissextos)
    select 'birthday',
           null::uuid,
           null::uuid,
           array[b.id],
           1,
           '{}'::text[],
           null::text,
           (me.today::timestamp at time zone 'America/Sao_Paulo')
      from public.profiles b
      cross join me
     where b.is_member
       and b.id <> me.uid
       and b.birthday is not null
       and (
             to_char(b.birthday, 'MM-DD') = to_char(me.today, 'MM-DD')
             or (
                  to_char(b.birthday, 'MM-DD') = '02-29'
                  and to_char(me.today, 'MM-DD') = '02-28'
                  and extract(day from (make_date(extract(year from me.today)::integer, 3, 1) - 1)) = 28
                )
           )

    union all
    -- fella novo
    select 'new_member',
           null::uuid,
           null::uuid,
           array[n.id],
           1,
           '{}'::text[],
           null::text,
           n.created_at
      from public.profiles n
      cross join me
     where n.is_member and n.id <> me.uid and n.created_at >= me.since
  )
  select f.kind, f.post_id, f.comment_id, f.actor_ids, f.actor_count, f.emojis, f.body, f.latest_at,
         f.latest_at > me.seen_at as unread
    from feed f
    cross join me
   order by f.latest_at desc
   limit greatest(p_limit, 0);
$$;

create or replace function public.unread_notifications_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(*)::integer from public.notifications_feed(50) f where f.unread;
$$;

-- relógio do servidor; só mexe na própria linha
create or replace function public.mark_notifications_seen()
returns void
language sql
security definer
set search_path = public
as $$
  update public.profiles set notifications_seen_at = now() where id = auth.uid();
$$;

revoke all on function public.notifications_feed(integer) from public;
revoke all on function public.unread_notifications_count() from public;
revoke all on function public.mark_notifications_seen() from public;
grant execute on function public.notifications_feed(integer) to authenticated;
grant execute on function public.unread_notifications_count() to authenticated;
grant execute on function public.mark_notifications_seen() to authenticated;
```

- [ ] **Step 2: Atualizar `types/database.ts`**

Em `profiles`: `Row` ganha `notifications_seen_at: string;`; `Insert` e `Update` ganham `notifications_seen_at?: string;` (logo depois de `created_at` em cada um). Em `Functions`, depois de `is_member`:

```ts
      notifications_feed: {
        Args: { p_limit?: number };
        Returns: {
          kind: string;
          post_id: string | null;
          comment_id: string | null;
          actor_ids: string[];
          actor_count: number;
          emojis: string[];
          body: string | null;
          latest_at: string;
          unread: boolean;
        }[];
      };
      unread_notifications_count: {
        Args: Record<PropertyKey, never>;
        Returns: number;
      };
      mark_notifications_seen: {
        Args: Record<PropertyKey, never>;
        Returns: undefined;
      };
```

- [ ] **Step 3: `lib/auth/devFakeLogin.ts`** — em `fakeProfile`, depois de `created_at`:

```ts
  notifications_seen_at: new Date(0).toISOString(),
```

- [ ] **Step 4: Verificar**

Run: `npx tsc --noEmit` → Expected: exit 0. Run: `npx jest` → Expected: todos passam (nenhum comportamento mudou).

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0008_notifications.sql types/database.ts lib/auth/devFakeLogin.ts
git commit -m "Notificações: migração 0008 (notifications_feed, contagem, marcar visto) e tipos"
```

---

### Task 2: Token `onBrand`, `badgeSize` e primitivo `Badge`

**Files:**
- Modify: `lib/theme.ts` (tipo `Colors` + `colors.light/dark.onBrand`; `layout.badgeSize`)
- Create: `components/ui/Badge.tsx`; Modify: `components/ui/index.ts`
- Test: `__tests__/theme.test.ts`, `__tests__/badge.test.tsx`

**Interfaces:**
- Produces: `colors[scheme].onBrand: string`; `layout.badgeSize: 18`; `Badge({ count }: { count: number })` (exportado de `components/ui`).

- [ ] **Step 1: Testes que falham**

Em `__tests__/theme.test.ts`, dentro de `describe('cores do tema', …)`, depois do teste do `brand`:

```ts
  it('onBrand tem contraste AA sobre brand (bolinha de notificações)', () => {
    expect(contrast(colors.light.onBrand, colors.light.brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dark.onBrand, colors.dark.brand)).toBeGreaterThanOrEqual(4.5);
  });
```

`__tests__/badge.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react-native';

import { Badge } from '../components/ui';

describe('Badge', () => {
  it('mostra o número', async () => {
    await render(<Badge count={3} />);
    expect(screen.getByText('3')).toBeTruthy();
  });

  it('acima de 9 vira 9+', async () => {
    await render(<Badge count={12} />);
    expect(screen.getByText('9+')).toBeTruthy();
  });

  it('zero não renderiza nada', async () => {
    await render(<Badge count={0} />);
    expect(screen.queryByTestId('badge')).toBeNull();
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/theme.test.ts __tests__/badge.test.tsx` → Expected: FAIL (`onBrand` undefined; `Badge` não exportado).

- [ ] **Step 3: Implementar**

`lib/theme.ts`: no tipo `Colors`, depois de `brand: string;` adicionar
```ts
  /** Texto sobre `brand` (bolinha de notificações). */
  onBrand: string;
```
Em `colors.light`, depois de `brand: '#5B3FD9',` → `onBrand: '#FFFFFF',`. Em `colors.dark`, depois de `brand: '#B8A2FF',` → `onBrand: '#121212',`.
Em `layout`, depois de `chipHeight: 28,`:
```ts
  /** Altura (e largura mínima) da bolinha de contagem. */
  badgeSize: 18,
```

`components/ui/Badge.tsx`:

```tsx
import { View } from 'react-native';

import { useTheme } from '../../lib/theme';
import { Text } from './Text';

export type BadgeProps = { count: number };

/**
 * Bolinha com número (ex.: notificações não lidas). 0 não aparece; acima de 9 vira "9+".
 * Decorativa: quem a contém diz o número no rótulo acessível.
 */
export function Badge({ count }: BadgeProps) {
  const t = useTheme();
  if (count <= 0) return null;
  return (
    <View
      testID="badge"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        minWidth: t.layout.badgeSize,
        height: t.layout.badgeSize,
        paddingHorizontal: t.spacing.xs,
        borderRadius: t.radii.pill,
        backgroundColor: t.colors.brand,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text variant="caption" style={{ color: t.colors.onBrand, fontFamily: t.fonts.bodyBold }}>
        {count > 9 ? '9+' : String(count)}
      </Text>
    </View>
  );
}
```

`components/ui/index.ts`: depois da linha do `Avatar`:
```ts
export { Badge, type BadgeProps } from './Badge';
```

- [ ] **Step 4: Rodar** `npx jest __tests__/theme.test.ts __tests__/badge.test.tsx` → Expected: PASS. `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/theme.ts components/ui/Badge.tsx components/ui/index.ts __tests__/theme.test.ts __tests__/badge.test.tsx
git commit -m "UI: Badge (bolinha de contagem) e token onBrand"
```

---

### Task 3: Tipos e textos das notificações (`lib/notifications.ts`)

**Files:**
- Create: `lib/notifications.ts`
- Test: `__tests__/notifications.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type NotificationKind = 'like' | 'post_reaction' | 'comment_reaction' | 'comment' | 'thread_reply' | 'birthday' | 'new_member';
  export type NotificationPerson = { id: string; name: string; avatarUrl: string | null };
  export type AppNotification = {
    key: string; kind: NotificationKind; postId: string | null; commentId: string | null;
    actors: NotificationPerson[]; actorCount: number; emojis: string[]; body: string | null;
    latestAt: string; unread: boolean; thumbUrl: string | null;
  };
  export type TextPart = { text: string; bold?: boolean };
  export function describeNotification(n: AppNotification): TextPart[];
  export function notificationText(n: AppNotification): string;
  export function notificationsLabel(count: number): string;
  export function snippet(text: string | null): string;
  ```

- [ ] **Step 1: Testes que falham** — `__tests__/notifications.test.ts`:

```ts
import {
  describeNotification,
  notificationsLabel,
  notificationText,
  snippet,
  type AppNotification,
} from '../lib/notifications';

const p = (name: string) => ({ id: name.toLowerCase(), name, avatarUrl: null });
const base: AppNotification = {
  key: 'k',
  kind: 'like',
  postId: 'p1',
  commentId: null,
  actors: [p('Ana')],
  actorCount: 1,
  emojis: [],
  body: null,
  latestAt: '2026-10-04T12:00:00Z',
  unread: false,
  thumbUrl: null,
};
const n = (over: Partial<AppNotification>): AppNotification => ({ ...base, ...over });

describe('describeNotification', () => {
  it('curtida: 1, 2, 3 e 4+ pessoas, singular/plural', () => {
    expect(notificationText(n({}))).toBe('Ana curtiu seu post');
    expect(notificationText(n({ actors: [p('Ana'), p('Pedro')], actorCount: 2 }))).toBe('Ana e Pedro curtiram seu post');
    expect(notificationText(n({ actors: [p('Ana'), p('Pedro'), p('Bia')], actorCount: 3 }))).toBe(
      'Ana, Pedro e Bia curtiram seu post',
    );
    expect(notificationText(n({ actors: [p('Ana'), p('Pedro'), p('Bia')], actorCount: 5 }))).toBe(
      'Ana, Pedro e mais 3 curtiram seu post',
    );
  });

  it('nomes em negrito, o resto normal', () => {
    expect(describeNotification(n({ actors: [p('Ana'), p('Pedro')], actorCount: 2 }))).toEqual([
      { text: 'Ana', bold: true },
      { text: ' e ' },
      { text: 'Pedro', bold: true },
      { text: ' curtiram seu post' },
    ]);
  });

  it('reações em post e comentário mostram os emojis', () => {
    expect(notificationText(n({ kind: 'post_reaction', emojis: ['😂'] }))).toBe('Ana reagiu 😂 ao seu post');
    expect(
      notificationText(n({ kind: 'post_reaction', actors: [p('Ana'), p('Pedro')], actorCount: 2, emojis: ['😂', '🙏'] })),
    ).toBe('Ana e Pedro reagiram 😂 🙏 ao seu post');
    expect(notificationText(n({ kind: 'comment_reaction', commentId: 'c1', emojis: ['👍'] }))).toBe(
      'Ana reagiu 👍 ao seu comentário',
    );
  });

  it('comentário e resposta na conversa trazem o trecho', () => {
    expect(notificationText(n({ kind: 'comment', commentId: 'c1', body: 'haha que isso' }))).toBe(
      'Ana comentou: “haha que isso”',
    );
    expect(notificationText(n({ kind: 'thread_reply', commentId: 'c2', body: 'kkk' }))).toBe(
      'Ana também comentou num post que você comentou: “kkk”',
    );
  });

  it('aniversário e fella novo', () => {
    expect(notificationText(n({ kind: 'birthday', postId: null, actors: [p('Juan')] }))).toBe(
      'Hoje é aniversário de Juan',
    );
    expect(notificationText(n({ kind: 'new_member', postId: null, actors: [p('Pedro')] }))).toBe('Pedro entrou no fellas');
  });

  it('sem perfil do ator vira "Alguém"', () => {
    expect(notificationText(n({ actors: [] }))).toBe('Alguém curtiu seu post');
    expect(notificationText(n({ actors: [], actorCount: 3 }))).toBe('Alguém e mais 2 curtiram seu post');
  });
});

describe('snippet', () => {
  it('corta em 80 com reticências e junta espaços', () => {
    expect(snippet('  oi\n  fellas ')).toBe('oi fellas');
    const long = 'a'.repeat(100);
    expect(snippet(long)).toHaveLength(80);
    expect(snippet(long).endsWith('…')).toBe(true);
    expect(snippet(null)).toBe('');
  });
});

describe('notificationsLabel', () => {
  it('diz quantas são novas', () => {
    expect(notificationsLabel(0)).toBe('Notificações');
    expect(notificationsLabel(1)).toBe('Notificações, 1 nova');
    expect(notificationsLabel(3)).toBe('Notificações, 3 novas');
    expect(notificationsLabel(15)).toBe('Notificações, mais de 9 novas');
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/notifications.test.ts` → Expected: FAIL "Cannot find module '../lib/notifications'".

- [ ] **Step 3: Implementar** — `lib/notifications.ts`:

```ts
export type NotificationKind =
  | 'like'
  | 'post_reaction'
  | 'comment_reaction'
  | 'comment'
  | 'thread_reply'
  | 'birthday'
  | 'new_member';

export type NotificationPerson = { id: string; name: string; avatarUrl: string | null };

/** Uma linha da tela de notificações (já com pessoas e miniatura resolvidas). */
export type AppNotification = {
  key: string;
  kind: NotificationKind;
  postId: string | null;
  commentId: string | null;
  /** Até 3 pessoas, a mais recente primeiro. */
  actors: NotificationPerson[];
  /** Total de pessoas no grupo (curtidas/reações agrupadas). */
  actorCount: number;
  emojis: string[];
  body: string | null;
  latestAt: string;
  unread: boolean;
  thumbUrl: string | null;
};

export type TextPart = { text: string; bold?: boolean };

const SNIPPET_MAX = 80;

/** Trecho de comentário: espaços juntados, até 80 caracteres com "…". */
export function snippet(text: string | null): string {
  const clean = (text ?? '').replace(/\s+/g, ' ').trim();
  return clean.length > SNIPPET_MAX ? `${clean.slice(0, SNIPPET_MAX - 1).trimEnd()}…` : clean;
}

/** "Ana" · "Ana e Pedro" · "Ana, Pedro e Bia" · "Ana, Pedro e mais 3" (nomes em negrito). */
function peopleParts(actors: NotificationPerson[], count: number): TextPart[] {
  const total = Math.max(count, actors.length, 1);
  const shown = actors.slice(0, total > 3 ? 2 : 3).map((a) => a.name);
  if (shown.length === 0) shown.push('Alguém');
  const extra = total - shown.length;
  const parts: TextPart[] = [];
  shown.forEach((name, i) => {
    if (i > 0) parts.push({ text: extra === 0 && i === shown.length - 1 ? ' e ' : ', ' });
    parts.push({ text: name, bold: true });
  });
  if (extra > 0) parts.push({ text: ` e mais ${extra}` });
  return parts;
}

export function describeNotification(n: AppNotification): TextPart[] {
  const plural = Math.max(n.actorCount, n.actors.length) > 1;
  const who = peopleParts(n.actors, n.actorCount);
  const emojis = n.emojis.join(' ');
  switch (n.kind) {
    case 'like':
      return [...who, { text: plural ? ' curtiram seu post' : ' curtiu seu post' }];
    case 'post_reaction':
      return [...who, { text: `${plural ? ' reagiram' : ' reagiu'} ${emojis} ao seu post` }];
    case 'comment_reaction':
      return [...who, { text: `${plural ? ' reagiram' : ' reagiu'} ${emojis} ao seu comentário` }];
    case 'comment':
      return [...who, { text: ` comentou: “${snippet(n.body)}”` }];
    case 'thread_reply':
      return [...who, { text: ` também comentou num post que você comentou: “${snippet(n.body)}”` }];
    case 'birthday':
      return [{ text: 'Hoje é aniversário de ' }, ...who];
    case 'new_member':
      return [...who, { text: ' entrou no fellas' }];
  }
}

export function notificationText(n: AppNotification): string {
  return describeNotification(n)
    .map((part) => part.text)
    .join('');
}

/** Rótulo acessível do sino / item da lateral. */
export function notificationsLabel(count: number): string {
  if (count <= 0) return 'Notificações';
  if (count > 9) return 'Notificações, mais de 9 novas';
  return `Notificações, ${count} ${count === 1 ? 'nova' : 'novas'}`;
}
```

- [ ] **Step 4: Rodar** `npx jest __tests__/notifications.test.ts` → Expected: PASS. `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts __tests__/notifications.test.ts
git commit -m "Notificações: tipos e textos (describeNotification, rótulo do sino)"
```

---

### Task 4: API (`lib/api/notifications.ts`)

**Files:**
- Create: `lib/api/notifications.ts`
- Test: `__tests__/notificationsApi.test.ts`

**Interfaces:**
- Consumes: `AppNotification`, `NotificationKind` (Task 3); `signPaths`, `resolveUrl` (`lib/api/storage.ts`); RPCs da Task 1.
- Produces: `fetchNotifications(): Promise<AppNotification[]>`, `fetchUnreadCount(): Promise<number>`, `markNotificationsSeen(): Promise<void>`.

- [ ] **Step 1: Testes que falham** — `__tests__/notificationsApi.test.ts`:

```ts
const mockRpc = jest.fn();
const mockIn = jest.fn();
let mockTables: Record<string, unknown[]> = {};

jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      select: () => ({
        in: (col: string, ids: string[]) => {
          mockIn(table, col, ids);
          return Promise.resolve({ data: mockTables[table] ?? [], error: null });
        },
      }),
    }),
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => ({
          data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}` })),
          error: null,
        }),
      }),
    },
  },
}));

import { fetchNotifications, fetchUnreadCount, markNotificationsSeen } from '../lib/api/notifications';

const row = (over: Record<string, unknown>) => ({
  kind: 'like',
  post_id: 'p1',
  comment_id: null,
  actor_ids: ['u2'],
  actor_count: 1,
  emojis: [],
  body: null,
  latest_at: '2026-10-04T12:00:00Z',
  unread: true,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockTables = {
    profiles: [
      { id: 'u2', username: 'ana', display_name: 'Ana', avatar_url: 'u2/a.jpg' },
      { id: 'u3', username: 'pedro', display_name: null, avatar_url: null },
    ],
    posts: [
      { id: 'p1', image_url: 'u1/1.jpg', images: ['u1/1.jpg', 'u1/2.jpg'] },
      { id: 'p2', image_url: null, images: [] },
    ],
  };
});

describe('fetchNotifications', () => {
  it('junta pessoas, miniatura do post e marca de não lida', async () => {
    mockRpc.mockResolvedValue({
      data: [row({}), row({ kind: 'comment', post_id: 'p2', comment_id: 'c1', actor_ids: ['u3'], body: 'oi', unread: false })],
      error: null,
    });
    const list = await fetchNotifications();
    expect(mockRpc).toHaveBeenCalledWith('notifications_feed', { p_limit: 50 });
    expect(list[0]).toMatchObject({
      kind: 'like',
      postId: 'p1',
      actors: [{ id: 'u2', name: 'Ana', avatarUrl: 'https://signed/u2/a.jpg' }],
      thumbUrl: 'https://signed/u1/1.jpg',
      unread: true,
    });
    // sem display_name usa o username; post sem foto não tem miniatura
    expect(list[1]).toMatchObject({ actors: [{ id: 'u3', name: 'pedro', avatarUrl: null }], thumbUrl: null, body: 'oi' });
    expect(new Set(list.map((n) => n.key)).size).toBe(2);
  });

  it('ator sem perfil e post apagado não quebram a linha', async () => {
    mockRpc.mockResolvedValue({ data: [row({ post_id: 'sumiu', actor_ids: ['fantasma'] })], error: null });
    const [only] = await fetchNotifications();
    expect(only.actors).toEqual([]);
    expect(only.thumbUrl).toBeNull();
  });

  it('lista vazia não busca perfis nem posts', async () => {
    mockRpc.mockResolvedValue({ data: [], error: null });
    expect(await fetchNotifications()).toEqual([]);
    expect(mockIn).not.toHaveBeenCalled();
  });

  it('erro da função sobe', async () => {
    mockRpc.mockResolvedValue({ data: null, error: new Error('falhou') });
    await expect(fetchNotifications()).rejects.toThrow('falhou');
  });
});

describe('contagem e marcar visto', () => {
  it('fetchUnreadCount devolve o número', async () => {
    mockRpc.mockResolvedValue({ data: 4, error: null });
    await expect(fetchUnreadCount()).resolves.toBe(4);
    expect(mockRpc).toHaveBeenCalledWith('unread_notifications_count');
  });

  it('markNotificationsSeen chama a função', async () => {
    mockRpc.mockResolvedValue({ data: null, error: null });
    await markNotificationsSeen();
    expect(mockRpc).toHaveBeenCalledWith('mark_notifications_seen');
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/notificationsApi.test.ts` → Expected: FAIL "Cannot find module '../lib/api/notifications'".

- [ ] **Step 3: Implementar** — `lib/api/notifications.ts`:

```ts
import type { AppNotification, NotificationKind, NotificationPerson } from '../notifications';
import { supabase } from '../supabase';
import { resolveUrl, signPaths } from './storage';

const FEED_LIMIT = 50;

type PersonRow = { id: string; username: string; display_name: string | null; avatar_url: string | null };
type PostRow = { id: string; image_url: string | null; images: string[] | null };

/** Lista da tela: a função do banco já agrupa e ordena; aqui entram nomes, fotos e miniaturas. */
export async function fetchNotifications(): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('notifications_feed', { p_limit: FEED_LIMIT });
  if (error) throw error;
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const personIds = [...new Set(rows.flatMap((r) => r.actor_ids ?? []))];
  const postIds = [...new Set(rows.map((r) => r.post_id).filter((id): id is string => !!id))];
  const [people, posts] = await Promise.all([
    personIds.length
      ? supabase.from('profiles').select('id, username, display_name, avatar_url').in('id', personIds)
      : Promise.resolve({ data: [] as PersonRow[], error: null }),
    postIds.length
      ? supabase.from('posts').select('id, image_url, images').in('id', postIds)
      : Promise.resolve({ data: [] as PostRow[], error: null }),
  ]);
  if (people.error) throw people.error;
  if (posts.error) throw posts.error;

  const personRows = (people.data ?? []) as PersonRow[];
  const firstPhoto = new Map(
    ((posts.data ?? []) as PostRow[]).map((p) => [p.id, p.images?.[0] ?? p.image_url ?? null]),
  );
  const signed = await signPaths([...personRows.map((p) => p.avatar_url), ...firstPhoto.values()]).catch(
    () => new Map<string, string>(),
  );
  const byId = new Map<string, NotificationPerson>(
    personRows.map((p) => [
      p.id,
      { id: p.id, name: p.display_name || p.username, avatarUrl: resolveUrl(p.avatar_url, signed) },
    ]),
  );

  return rows.map((r) => {
    const actorIds = r.actor_ids ?? [];
    return {
      key: [r.kind, r.post_id ?? '', r.comment_id ?? '', actorIds[0] ?? ''].join(':'),
      kind: r.kind as NotificationKind,
      postId: r.post_id,
      commentId: r.comment_id,
      actors: actorIds.map((id) => byId.get(id)).filter((p): p is NotificationPerson => !!p),
      actorCount: r.actor_count,
      emojis: r.emojis ?? [],
      body: r.body,
      latestAt: r.latest_at,
      unread: r.unread,
      thumbUrl: r.post_id ? resolveUrl(firstPhoto.get(r.post_id), signed) : null,
    };
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const { data, error } = await supabase.rpc('unread_notifications_count');
  if (error) throw error;
  return data ?? 0;
}

export async function markNotificationsSeen(): Promise<void> {
  const { error } = await supabase.rpc('mark_notifications_seen');
  if (error) throw error;
}
```

- [ ] **Step 4: Rodar** `npx jest __tests__/notificationsApi.test.ts` → Expected: PASS (6). `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/api/notifications.ts __tests__/notificationsApi.test.ts
git commit -m "Notificações: API (lista com pessoas e miniaturas, contagem, marcar visto)"
```

---

### Task 5: Número da bolinha (store + sincronização)

**Files:**
- Create: `lib/notificationsStore.ts`
- Create: `components/notifications/NotificationsSync.tsx`
- Modify: `app/_layout.tsx` (monta `<NotificationsSync />` dentro do `SessionProvider`)
- Test: `__tests__/notificationsSync.test.tsx`

**Interfaces:**
- Consumes: `fetchUnreadCount` (Task 4); `useSession()` de `lib/auth/SessionProvider` (`session?.user.id`, `profile?.is_member`).
- Produces: `useUnreadNotifications(): number`, `getUnreadNotifications(): number`, `setUnreadNotifications(n: number): void`, `UNREAD_POLL_MS = 60_000` (em `lib/notificationsStore.ts`, **sem** importar API, para Sidebar/sino não puxarem o cliente Supabase); `NotificationsSync(): null`.

- [ ] **Step 1: Testes que falham** — `__tests__/notificationsSync.test.tsx`:

```tsx
import { act, render } from '@testing-library/react-native';
import { AppState } from 'react-native';

const mockFetchUnread = jest.fn();
let mockSession: { session: { user: { id: string } } | null; profile: { is_member: boolean } | null } = {
  session: null,
  profile: null,
};
jest.mock('../lib/api/notifications', () => ({ fetchUnreadCount: () => mockFetchUnread() }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => mockSession }));

import { NotificationsSync } from '../components/notifications/NotificationsSync';
import { getUnreadNotifications, setUnreadNotifications, UNREAD_POLL_MS } from '../lib/notificationsStore';

const member = (id: string) => ({ session: { user: { id } }, profile: { is_member: true } });
let appStateHandler: ((s: string) => void) | null = null;

beforeEach(() => {
  jest.useFakeTimers();
  jest.clearAllMocks();
  mockSession = { session: null, profile: null };
  setUnreadNotifications(0);
  mockFetchUnread.mockResolvedValue(3);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
    appStateHandler = handler as (s: string) => void;
    return { remove: jest.fn() } as never;
  });
});
afterEach(() => jest.useRealTimers());

/** Deixa as promessas pendentes (busca do número) terminarem. */
async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('NotificationsSync', () => {
  it('sem sessão ou sem ser membro não chama a API e a bolinha fica 0', async () => {
    await render(<NotificationsSync />);
    mockSession = { session: { user: { id: 'u1' } }, profile: { is_member: false } };
    await render(<NotificationsSync />);
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS * 2);
    });
    expect(mockFetchUnread).not.toHaveBeenCalled();
    expect(getUnreadNotifications()).toBe(0);
  });

  it('membro: busca ao entrar, a cada minuto e ao voltar para o app', async () => {
    mockSession = member('u1');
    await render(<NotificationsSync />);
    await flush();
    expect(mockFetchUnread).toHaveBeenCalledTimes(1);
    expect(getUnreadNotifications()).toBe(3);
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS);
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(2);
    await act(async () => {
      appStateHandler?.('active');
    });
    expect(mockFetchUnread).toHaveBeenCalledTimes(3);
  });

  it('trocar de conta zera o número antes de chegar o da conta nova', async () => {
    mockSession = member('u1');
    const view = await render(<NotificationsSync />);
    await flush();
    expect(getUnreadNotifications()).toBe(3);
    let resolveNext: (n: number) => void = () => {};
    mockFetchUnread.mockReturnValue(new Promise<number>((r) => (resolveNext = r)));
    mockSession = member('u2');
    await view.rerender(<NotificationsSync />);
    expect(getUnreadNotifications()).toBe(0);
    await act(async () => {
      resolveNext(7);
    });
    await flush();
    expect(getUnreadNotifications()).toBe(7);
  });

  it('erro de rede mantém o último número', async () => {
    mockSession = member('u1');
    await render(<NotificationsSync />);
    await flush();
    mockFetchUnread.mockRejectedValue(new Error('offline'));
    await act(async () => {
      jest.advanceTimersByTime(UNREAD_POLL_MS);
    });
    await flush();
    expect(getUnreadNotifications()).toBe(3);
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/notificationsSync.test.tsx` → Expected: FAIL "Cannot find module '../components/notifications/NotificationsSync'".

- [ ] **Step 3: Implementar**

`lib/notificationsStore.ts`:

```ts
import { useSyncExternalStore } from 'react';

/** Intervalo da busca do número de não lidas enquanto o app está aberto. */
export const UNREAD_POLL_MS = 60_000;

let unread = 0;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Número de notificações não lidas (bolinha do sino e da lateral). */
export function useUnreadNotifications(): number {
  return useSyncExternalStore(subscribe, () => unread, () => unread);
}

export function getUnreadNotifications(): number {
  return unread;
}

export function setUnreadNotifications(next: number): void {
  if (next === unread) return;
  unread = next;
  for (const listener of listeners) listener();
}
```

`components/notifications/NotificationsSync.tsx`:

```tsx
import { useEffect } from 'react';
import { AppState } from 'react-native';

import { fetchUnreadCount } from '../../lib/api/notifications';
import { useSession } from '../../lib/auth/SessionProvider';
import { setUnreadNotifications, UNREAD_POLL_MS } from '../../lib/notificationsStore';

/**
 * Mantém a bolinha de não lidas: busca ao entrar como membro, a cada minuto e quando o app volta
 * para o primeiro plano. Trocar de conta zera antes de buscar (o número não vaza entre contas).
 */
export function NotificationsSync(): null {
  const { session, profile } = useSession();
  const userId = profile?.is_member ? session?.user.id : undefined;

  useEffect(() => {
    setUnreadNotifications(0);
    if (!userId) return;
    let alive = true;
    const refresh = () => {
      fetchUnreadCount()
        .then((n) => {
          if (alive) setUnreadNotifications(n);
        })
        .catch(() => {});
    };
    refresh();
    const timer = setInterval(refresh, UNREAD_POLL_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      alive = false;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId]);

  return null;
}
```

Nota: os testes leem o valor real com `getUnreadNotifications()` (nada de espionar exports do módulo).

`app/_layout.tsx`: importar `import { NotificationsSync } from '../components/notifications/NotificationsSync';` (junto dos imports de `components`) e, logo depois de `<StatusBar style="auto" />`, adicionar `<NotificationsSync />`.

- [ ] **Step 4: Rodar** `npx jest __tests__/notificationsSync.test.tsx` → Expected: PASS (4). `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add lib/notificationsStore.ts components/notifications/NotificationsSync.tsx app/_layout.tsx __tests__/notificationsSync.test.tsx
git commit -m "Notificações: número de não lidas (store + busca a cada minuto e ao voltar)"
```

---

### Task 6: Linha e tela de Notificações

**Files:**
- Create: `components/notifications/NotificationRow.tsx`
- Create: `app/notifications.tsx`
- Modify: `app/_layout.tsx` (`<Stack.Screen name="notifications" />` depois de `members`)
- Test: `__tests__/notificationsScreen.test.tsx`

**Interfaces:**
- Consumes: `AppNotification`, `describeNotification`, `notificationText` (Task 3); `fetchNotifications`, `markNotificationsSeen` (Task 4); `setUnreadNotifications` (Task 5); `stackHeader` (`components/profile/headerOptions`); `shortDate` (`lib/format`).
- Produces: `NotificationRow({ item, onPress }: { item: AppNotification; onPress: (n: AppNotification) => void })`; rota `/notifications`.

- [ ] **Step 1: Testes que falham** — `__tests__/notificationsScreen.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { AppNotification } from '../lib/notifications';

const mockPush = jest.fn();
jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
    Stack: { Screen: () => null },
  };
});
const mockFetch = jest.fn();
const mockMarkSeen = jest.fn();
jest.mock('../lib/api/notifications', () => ({
  fetchNotifications: () => mockFetch(),
  markNotificationsSeen: () => mockMarkSeen(),
}));
const mockSetUnread = jest.fn();
jest.mock('../lib/notificationsStore', () => ({ setUnreadNotifications: (n: number) => mockSetUnread(n) }));

import NotificationsScreen from '../app/notifications';

const ana = { id: 'u2', name: 'Ana', avatarUrl: null };
const item = (over: Partial<AppNotification>): AppNotification => ({
  key: over.kind ?? 'like',
  kind: 'like',
  postId: 'p1',
  commentId: null,
  actors: [ana],
  actorCount: 1,
  emojis: [],
  body: null,
  latestAt: '2026-10-04T12:00:00Z',
  unread: false,
  thumbUrl: null,
  ...over,
});
const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function open() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <NotificationsScreen />
    </SafeAreaProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockMarkSeen.mockResolvedValue(undefined);
});

describe('Tela de notificações', () => {
  it('mostra as linhas, marca como visto depois de carregar e zera a bolinha', async () => {
    mockFetch.mockResolvedValue([item({ unread: true }), item({ kind: 'new_member', postId: null, actors: [{ ...ana, name: 'Pedro', id: 'u3' }] })]);
    await open();
    expect(await screen.findByLabelText(/Ana curtiu seu post/)).toBeTruthy();
    expect(screen.getByLabelText(/Pedro entrou no fellas/)).toBeTruthy();
    await waitFor(() => expect(mockMarkSeen).toHaveBeenCalledTimes(1));
    expect(mockSetUnread).toHaveBeenCalledWith(0);
  });

  it('só a linha nova tem o ponto de não lida', async () => {
    mockFetch.mockResolvedValue([item({ unread: true }), item({ kind: 'comment', commentId: 'c1', body: 'oi' })]);
    await open();
    await screen.findByLabelText(/Ana curtiu seu post/);
    expect(screen.getAllByTestId('unread-dot')).toHaveLength(1);
  });

  it('toque leva ao post ou ao perfil', async () => {
    mockFetch.mockResolvedValue([item({}), item({ kind: 'birthday', postId: null })]);
    await open();
    await fireEvent.press(await screen.findByLabelText(/Ana curtiu seu post/));
    expect(mockPush).toHaveBeenCalledWith('/post/p1');
    await fireEvent.press(screen.getByLabelText(/Hoje é aniversário de Ana/));
    expect(mockPush).toHaveBeenCalledWith('/user/u2');
  });

  it('lista vazia convida', async () => {
    mockFetch.mockResolvedValue([]);
    await open();
    expect(await screen.findByText('Nada por aqui ainda.')).toBeTruthy();
  });

  it('erro mostra "Tentar de novo" e não marca como visto', async () => {
    mockFetch.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce([item({})]);
    await open();
    expect(await screen.findByText('Não deu pra carregar as notificações.')).toBeTruthy();
    expect(mockMarkSeen).not.toHaveBeenCalled();
    expect(mockSetUnread).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Tentar de novo'));
    expect(await screen.findByLabelText(/Ana curtiu seu post/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/notificationsScreen.test.tsx` → Expected: FAIL "Cannot find module '../app/notifications'".

- [ ] **Step 3: Implementar**

`components/notifications/NotificationRow.tsx`:

```tsx
import { Image, Pressable, View } from 'react-native';

import { shortDate } from '../../lib/format';
import { describeNotification, notificationText, type AppNotification, type NotificationKind } from '../../lib/notifications';
import { useTheme, type Theme } from '../../lib/theme';
import { Avatar, Icon, interactiveStyle, Text, type IconName } from '../ui';

function kindIcon(t: Theme, kind: NotificationKind): { name: IconName; color?: string } {
  switch (kind) {
    case 'like':
      return { name: 'heart', color: t.colors.like };
    case 'comment':
    case 'thread_reply':
      return { name: 'chatbubble-outline' };
    case 'post_reaction':
    case 'comment_reaction':
      return { name: 'happy-outline' };
    case 'birthday':
      return { name: 'gift-outline' };
    case 'new_member':
      return { name: 'person-add-outline' };
  }
}

type Props = { item: AppNotification; onPress: (n: AppNotification) => void };

/** Linha da tela de notificações: avatar com o ícone do tipo, texto com nomes em negrito, data e miniatura. */
export function NotificationRow({ item, onPress }: Props) {
  const t = useTheme();
  const who = item.actors[0];
  const icon = kindIcon(t, item.kind);
  const date = shortDate(item.latestAt);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${notificationText(item)}. ${date}`}
      onPress={() => onPress(item)}
      style={(state) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: t.spacing.md,
        paddingHorizontal: t.layout.gutter,
        paddingVertical: t.spacing.md,
        ...interactiveStyle(t, state, item.unread ? t.colors.surfaceSunken : 'transparent'),
      })}
    >
      <View
        testID={item.unread ? 'unread-dot' : undefined}
        style={{
          width: t.spacing.sm,
          height: t.spacing.sm,
          borderRadius: t.radii.pill,
          backgroundColor: item.unread ? t.colors.brand : 'transparent',
        }}
      />
      <View>
        <Avatar name={who?.name ?? 'Alguém'} uri={who?.avatarUrl} size={t.avatarSizes.md} />
        <View
          style={{
            position: 'absolute',
            right: -t.spacing.xs,
            bottom: -t.spacing.xs,
            width: t.iconSizes.md,
            height: t.iconSizes.md,
            borderRadius: t.radii.pill,
            backgroundColor: t.colors.bg,
            borderWidth: t.borders.hairline,
            borderColor: t.colors.border,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Icon name={icon.name} size="sm" color={icon.color} />
        </View>
      </View>
      <View style={{ flex: 1, gap: t.spacing.xs }}>
        <Text numberOfLines={3}>
          {describeNotification(item).map((part, i) => (
            <Text key={i} bold={part.bold}>
              {part.text}
            </Text>
          ))}
        </Text>
        <Text variant="small" tone="muted">
          {date}
        </Text>
      </View>
      {item.thumbUrl ? (
        <Image
          source={{ uri: item.thumbUrl }}
          style={{ width: t.avatarSizes.md, height: t.avatarSizes.md, borderRadius: t.radii.md }}
        />
      ) : null}
    </Pressable>
  );
}
```

Confira que `Theme` é exportado por `lib/theme.ts` (é: `export type Theme`). Se `interactiveStyle` não aceitar o terceiro argumento, use a assinatura existente `interactiveStyle(t, state, base)` (aceita).

`app/notifications.tsx`:

```tsx
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { NotificationRow } from '../components/notifications/NotificationRow';
import { stackHeader } from '../components/profile/headerOptions';
import { Divider, EmptyState, Screen } from '../components/ui';
import { fetchNotifications, markNotificationsSeen } from '../lib/api/notifications';
import type { AppNotification } from '../lib/notifications';
import { setUnreadNotifications } from '../lib/notificationsStore';
import { useTheme } from '../lib/theme';

export default function NotificationsScreen() {
  const t = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);

  /** Busca, mostra (as novas já vêm marcadas) e só então marca tudo como visto. */
  const load = useCallback(async (pull = false) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const list = await fetchNotifications();
      setItems(list);
      setError(false);
      await markNotificationsSeen().catch(() => {});
      setUnreadNotifications(0);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const open = (n: AppNotification) => {
    if (n.postId) router.push(`/post/${n.postId}`);
    else if (n.actors[0]) router.push(`/user/${n.actors[0].id}`);
  };

  let body;
  if (loading && items.length === 0) {
    body = (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={t.colors.primary} accessibilityLabel="Carregando notificações" />
      </View>
    );
  } else if (error && items.length === 0) {
    body = (
      <EmptyState
        title="Não deu pra carregar as notificações."
        message="Confere a internet e tenta de novo."
        actionLabel="Tentar de novo"
        onAction={() => void load()}
      />
    );
  } else {
    body = (
      <FlatList
        data={items}
        keyExtractor={(n) => n.key}
        ItemSeparatorComponent={Divider}
        contentContainerStyle={{ paddingBottom: t.spacing.lg + insets.bottom }}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        ListEmptyComponent={
          <EmptyState
            title="Nada por aqui ainda."
            message="Quando alguém curtir, comentar ou reagir, aparece aqui."
          />
        }
        renderItem={({ item }) => <NotificationRow item={item} onPress={open} />}
      />
    );
  }

  return (
    <>
      <Stack.Screen options={stackHeader(t, 'Notificações')} />
      <Screen header>{body}</Screen>
    </>
  );
}
```

`app/_layout.tsx`: depois de `<Stack.Screen name="members" … />` adicionar
```tsx
            <Stack.Screen name="notifications" options={{ headerShown: true, title: 'Notificações' }} />
```

- [ ] **Step 4: Rodar** `npx jest __tests__/notificationsScreen.test.tsx` → Expected: PASS (5). `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/notifications/NotificationRow.tsx app/notifications.tsx app/_layout.tsx __tests__/notificationsScreen.test.tsx
git commit -m "Notificações: tela com linhas agrupadas, lido ao abrir, vazio e erro"
```

---

### Task 7: Sino no topo do feed (celular)

**Files:**
- Create: `components/notifications/NotificationsBell.tsx`
- Modify: `app/(tabs)/feed.tsx` (cabeçalho `compact`)
- Test: `__tests__/notificationsBell.test.tsx`

**Interfaces:**
- Consumes: `useUnreadNotifications` (Task 5); `notificationsLabel` (Task 3); `Badge`, `IconButton` (`components/ui`).
- Produces: `NotificationsBell(): JSX.Element`.

- [ ] **Step 1: Teste que falha** — `__tests__/notificationsBell.test.tsx`:

```tsx
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockCount = 0;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../lib/notificationsStore', () => ({ useUnreadNotifications: () => mockCount }));

import { NotificationsBell } from '../components/notifications/NotificationsBell';

beforeEach(() => {
  jest.clearAllMocks();
  mockCount = 0;
});

describe('NotificationsBell', () => {
  it('sem novas: só o sino, abre a tela', async () => {
    await render(<NotificationsBell />);
    expect(screen.queryByTestId('badge')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Notificações'));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('com novas: bolinha e rótulo com o número', async () => {
    mockCount = 3;
    await render(<NotificationsBell />);
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByLabelText('Notificações, 3 novas')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Rodar** `npx jest __tests__/notificationsBell.test.tsx` → Expected: FAIL "Cannot find module".

- [ ] **Step 3: Implementar**

`components/notifications/NotificationsBell.tsx`:

```tsx
import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { notificationsLabel } from '../../lib/notifications';
import { useUnreadNotifications } from '../../lib/notificationsStore';
import { Badge, IconButton } from '../ui';

/** Sino do topo do feed no celular (como o coração do Instagram), com a bolinha de não lidas. */
export function NotificationsBell() {
  const router = useRouter();
  const count = useUnreadNotifications();
  return (
    <View>
      <IconButton
        icon="notifications-outline"
        variant="ghost"
        size="lg"
        accessibilityLabel={notificationsLabel(count)}
        onPress={() => router.push('/notifications')}
      />
      <View pointerEvents="none" style={{ position: 'absolute', top: 0, right: 0 }}>
        <Badge count={count} />
      </View>
    </View>
  );
}
```

`app/(tabs)/feed.tsx`: importar `import { NotificationsBell } from '../../components/notifications/NotificationsBell';` e, no cabeçalho `compact`, trocar

```tsx
              <View accessibilityRole="header">
                <Logo height={t.layout.logoHeight.sm} />
              </View>
```

por

```tsx
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                <View accessibilityRole="header">
                  <Logo height={t.layout.logoHeight.sm} />
                </View>
                <NotificationsBell />
              </View>
```

Se o `paddingBottom: t.spacing.sm` + `paddingTop: t.spacing.lg` do cabeçalho deixar o topo alto demais com o botão de 44, reduza `paddingTop` para `t.spacing.sm` (mantendo tokens) e confira visualmente no passo final.

- [ ] **Step 4: Rodar** `npx jest __tests__/notificationsBell.test.tsx` → Expected: PASS (2). `npx jest` inteiro → passam todos (o feed não tem teste próprio; `tabsLayout`/`composer` continuam verdes). `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/notifications/NotificationsBell.tsx "app/(tabs)/feed.tsx" __tests__/notificationsBell.test.tsx
git commit -m "Notificações: sino com bolinha no topo do feed (celular)"
```

---

### Task 8: Item na lateral (computador) e DESIGN.md

**Files:**
- Modify: `components/shell/Sidebar.tsx`
- Modify: `__tests__/sidebar.test.tsx`
- Modify: `DESIGN.md`

**Interfaces:**
- Consumes: `useUnreadNotifications` (Task 5), `notificationsLabel` (Task 3), `Badge` (Task 2).
- Produces: `NavKey` inclui `'notifications'`; `activeNavItem('/notifications') === 'notifications'`.

- [ ] **Step 1: Testes que falham** — em `__tests__/sidebar.test.tsx`:

Adicionar o mock (perto dos outros `jest.mock`):
```tsx
let mockUnread = 0;
jest.mock('../lib/notificationsStore', () => ({ useUnreadNotifications: () => mockUnread }));
```
No `it.each` de `activeNavItem`, adicionar a linha `['/notifications', 'notifications'],`. No `beforeEach` do `describe('Sidebar')`, adicionar `mockUnread = 0;`. E o teste:

```tsx
  it('Notificações entre Feed e Perfil, com bolinha e rótulo', async () => {
    mockUnread = 2;
    mockPath = '/notifications';
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    const item = screen.getByLabelText('Notificações, 2 novas');
    expect(item.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('2')).toBeTruthy();
    const labels = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
    expect(labels.indexOf('Notificações, 2 novas')).toBe(labels.indexOf('Feed') + 1);
    await fireEvent.press(item);
    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });
```

- [ ] **Step 2: Rodar** `npx jest __tests__/sidebar.test.tsx` → Expected: FAIL (sem item "Notificações").

- [ ] **Step 3: Implementar** em `components/shell/Sidebar.tsx`:

- Imports: `import { notificationsLabel } from '../../lib/notifications';`, `import { useUnreadNotifications } from '../../lib/notificationsStore';` e `Badge` no import de `'../ui'`.
- `export type NavKey = 'feed' | 'notifications' | 'profile' | 'members';`
- `ITEMS`: tipo de `href` vira `'/feed' | '/notifications' | '/profile' | '/members'` e, entre Feed e Perfil:
  ```ts
  { key: 'notifications', label: 'Notificações', href: '/notifications', icon: 'notifications-outline', iconActive: 'notifications' },
  ```
- `activeNavItem`: antes do `return null`, `if (pathname === '/notifications') return 'notifications';`
- No componente: `const unread = useUnreadNotifications();`
- No `.map` dos itens:
  - `accessibilityLabel={item.key === 'notifications' ? notificationsLabel(unread) : item.label}`
  - trocar o `<Icon … />` por
    ```tsx
            <View>
              <Icon name={on ? item.iconActive : item.icon} size="lg" color={on ? t.colors.brand : undefined} />
              {item.key === 'notifications' ? (
                <View pointerEvents="none" style={{ position: 'absolute', top: -t.spacing.xs, right: -t.spacing.sm }}>
                  <Badge count={unread} />
                </View>
              ) : null}
            </View>
    ```
- Atualizar o comentário do componente: "logo, Feed/Notificações/Perfil/Membros, Postar e eu no pé".

`DESIGN.md`: na seção "Layout por largura", na linha da Sidebar, trocar "Feed/Perfil/Membros" por "Feed/Notificações/Perfil/Membros (Notificações com `Badge`)". E adicionar, ao fim da seção de telas, um parágrafo:

```markdown
## Notificações
Tela `/notifications` no padrão "sem caixa" (linhas com `Divider`). Linha: ponto `brand` de não lida + fundo `surfaceSunken` só na visita em que chegou; avatar `md` com o ícone do tipo num círculo `bg` encostado no canto (coração `like`, balão, carinha, presente, pessoa+); texto com nomes em negrito e data `shortDate` em `textMuted`; miniatura quadrada `avatarSizes.md` raio `md` quando o post tem foto. Entrada: no celular, sino (`IconButton` ghost) à direita da marca no topo do feed; no computador, item da lateral. `Badge` (components/ui): pílula `brand` + texto `onBrand` caption bold, altura `layout.badgeSize`, "9+" acima de 9, 0 não aparece. Sem emoji no texto do sistema; os emojis de reação são conteúdo.
```

- [ ] **Step 4: Rodar** `npx jest __tests__/sidebar.test.tsx` → Expected: PASS. `npx jest` → todos passam. `npx tsc --noEmit` → exit 0.

- [ ] **Step 5: Commit**

```bash
git add components/shell/Sidebar.tsx __tests__/sidebar.test.tsx DESIGN.md
git commit -m "Notificações: item na lateral com bolinha + DESIGN.md"
```

---

### Task 9: Entrada no ar e conferência real

Sem código novo: ordem de publicação e verificação ponta a ponta.

- [ ] **Step 1:** Pedir ao dono para aplicar a migração (o executor não aplica):

```
! set -a && . ./.env && set +a && REF=$(echo "$EXPO_PUBLIC_SUPABASE_URL" | sed -E 's#https://([^.]+)\..*#\1#') && echo y | npx --yes supabase db push --db-url "postgresql://postgres.${REF}:${SUPABASE_DB_PASSWORD}@aws-0-sa-east-1.pooler.supabase.com:5432/postgres" --yes 2>&1 | sed "s/${SUPABASE_DB_PASSWORD}/***/g" | tail -15
```

Expected: "Applying migration 0008_notifications.sql..." e "Finished supabase db push." Se der erro de SQL, corrigir o arquivo, commitar e pedir para rodar de novo.

- [ ] **Step 2:** Rodar `npx tsc --noEmit` e `npx jest` (todos verdes), `git push origin main` e acompanhar o deploy (`gh run watch`) até `success`.

- [ ] **Step 3:** Conferência com o dono, no site, entre duas contas: curtir, reagir, comentar e responder num post; verificar a bolinha subir em até 1 minuto (ou ao voltar para a aba), a linha agrupada, o toque abrindo o post e a bolinha zerando ao abrir a tela. Registrar o que não bater e corrigir com teste antes de fechar.
