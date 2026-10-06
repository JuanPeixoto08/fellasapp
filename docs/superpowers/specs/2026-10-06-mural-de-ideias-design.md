# Mural de ideias — design

Data: 2026-10-06 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Um lugar no app para os fellas darem ideias de features. Todo mundo vê as ideias de todo mundo e
vota a favor ou contra, como no Reddit; as mais pedidas sobem e as ruins afundam. O Juan (admin,
quem desenvolve o app) usa o mural para saber o que priorizar.

**Sucesso:** um fella manda uma ideia em segundos, vê as dos outros e vota com um toque; a aba Top
mostra de cara o que o grupo mais quer.

### O que o Juan decidiu
- **Mural** (todos veem e votam), não caixa de sugestões privada.
- Voto **↑ e ↓, estilo Reddit**: pontuação = soma dos votos, pode ficar negativa.
- Ideia é **só texto curto** (até 280) + votos. Sem comentários, título ou status por enquanto.
- Abas **Top** e **Novas**.
- Entrada: item **"Ideias"** na barra lateral (computador) e **lâmpada ao lado do sino no topo do
  feed** (celular).
- Abordagem de dados **1**: tabelas `ideas` + `idea_votes`, pontuação calculada no banco por uma
  função.

### Premissas
- Depende do `is_admin` da migration `0012_invites.sql` (PR #1, ainda não na `main`). O branch
  `feat/ideias` sai do `feat/convites`; se o PR #1 entrar antes, rebase na `main` sem conflito
  esperado.
- Numeração: `0013_ideas.sql` (a 0011 está reservada para os stories, branch `feat/stories`).

### Fora do escopo (depois, se fizer falta)
Comentários em ideia; status ("na fila", "fazendo", "saiu"); notificação de ideia nova; editar
ideia (para corrigir: apaga e manda de novo).

## 1. O que aparece e onde

### Entrada
- **Computador** (`medium`/`expanded`): item **"Ideias"** na `Sidebar`, depois de Membros, ícone
  `bulb-outline` (ativo: `bulb`). Ativo quando a rota é `/ideas`.
- **Celular** (`compact`): `IconButton` ghost `bulb-outline`, rótulo "Ideias", no topo do feed
  ao lado do `NotificationsBell`. Some nas faixas com barra lateral (lá a entrada é a lateral).

### Tela `/ideas` (título "Ideias")
- Cabeçalho de pilha como Membros/Notificações (`stackHeader`). Fica com a moldura normal
  (barra lateral + coluna direita no computador).
- Topo: `TextField` multilinha "Manda sua ideia" (placeholder "Que tal se o app…"), contador
  quando passar de 240 ("12 restantes"), botão **"Mandar"** (desabilitado com texto vazio).
  Mandou: limpa o campo, a ideia aparece na lista (na aba Novas no topo; na Top, na posição
  dela).
- `Tabs`: **Top** (pontuação desc, depois mais nova) · **Novas** (mais nova primeiro).
- Lista no padrão "sem caixa" do feed, `Divider` entre ideias. Cada linha (`IdeaRow`):
  - Esquerda, `VoteColumn`: ▲ (`chevron-up-outline`), pontuação, ▼ (`chevron-down-outline`).
    Com meu voto, a seta escolhida e o número ficam em `brand` (número em negrito); sem voto, setas
    `textMuted` e número `text`. Cada seta é alvo de 44.
  - Direita: texto da ideia (body), embaixo avatar `sm` + nome (bold small) + `postTime` (muted).
  - Lixeira (`trash-outline`, ghost) na ideia minha e, para admin, em todas → `ConfirmDialog`
    ("Apagar essa ideia?", botão danger "Apagar", cancelar "Deixa quieto", erro dentro do
    diálogo).
- Pontuação negativa aparece normalmente ("−3").
- Vazio: `EmptyState` "Ninguém deu ideia ainda." / "Solta a primeira aí em cima."
- Carregando: "Juntando as ideias…". Erro ao carregar: `EmptyState` com "Tentar de novo".

### Votar
- Toque em ▲ sem voto → +1. Em ▲ com meu +1 → tira. Em ▲ com meu −1 → vira +1 (pontuação +2).
  Simétrico para ▼.
- Otimista: seta e número mudam no toque; se o banco recusar, volta ao estado anterior e mostra
  aviso curto ("Não deu pra votar. Tenta de novo.").
- A lista **não** reordena no meio de uma sequência de votos (evita a linha fugir do dedo); a ordem
  da aba Top se ajusta no próximo carregamento (troca de aba, volta para a tela, atualização ao
  vivo de outra pessoa).

## 2. Banco (`supabase/migrations/0013_ideas.sql`, idempotente)

```sql
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
```
Índices: `ideas (created_at desc)`, `idea_votes (user_id)`.

### RLS
- `ideas`: select para membros (`is_member()`); insert com `author_id = auth.uid() and is_member()`;
  delete com `author_id = auth.uid() or is_admin()`. Sem update.
- `idea_votes`: select para membros; insert/update/delete só da própria linha
  (`user_id = auth.uid()` e `is_member()`). Update só da coluna `value`.
- Pode votar na própria ideia; ideia nasce sem voto.

### `ideas_feed(p_sort text default 'top')`
`security invoker` (as políticas acima valem). Devolve até 100 linhas:
`id, author_id, body, created_at, score integer, my_vote smallint` (`my_vote` = 1, −1 ou null).
Ordem: `top` → `score desc, created_at desc`; `new` → `created_at desc`. `p_sort` diferente de
`new` cai em `top`. Não-membro recebe lista vazia.

### Tempo real
`ideas` e `idea_votes` entram na publicação `supabase_realtime` (mesmo bloco da 0009). Em
`lib/realtime.ts`, `LIVE_TABLES` ganha as duas.

## 3. Código do app

| Unidade | Faz | Depende de |
|---|---|---|
| `lib/ideas.ts` | Tipos (`Idea`, `Vote = 1 \| -1 \| null`), `IDEA_MAX = 280`, `applyVote(idea, tapped)` → `{ myVote, score }`, `validateIdea(texto)` | nada |
| `lib/api/ideas.ts` | `fetchIdeas(sort)` (rpc `ideas_feed` + nome/foto do autor via diretório de membros), `createIdea(texto)`, `voteIdea(id, vote)` (upsert ou delete em `idea_votes`), `deleteIdea(id)`, `ideaErrorMessage(e)` | `supabase`, `memberDirectory` |
| `lib/useIdeas.ts` | Estado da tela: aba atual, lista, carregando/erro; `vote` otimista com rollback; `create`; `remove`; recarrega em mudança ao vivo de `ideas`/`idea_votes` feita por outra pessoa | `lib/api/ideas`, `lib/ideas`, `lib/realtime` |
| `components/ideas/VoteColumn.tsx` | ▲ número ▼, estados de voto, rótulos acessíveis ("Votar a favor", "Votar contra", "7 pontos, seu voto: a favor") | `components/ui` |
| `components/ideas/IdeaRow.tsx` | Uma ideia: `VoteColumn` + texto + autor + horário + lixeira | `VoteColumn`, `components/ui` |
| `app/ideas.tsx` | Tela: compositor, `Tabs`, lista, diálogo de apagar | `useIdeas`, `IdeaRow`, `useSession` (admin/eu) |

Mudanças em arquivos existentes:
- `components/shell/Sidebar.tsx`: item "Ideias"; `NavKey` + `activeNavItem` ganham `ideas`.
- `app/(tabs)/feed.tsx`: lâmpada ao lado do sino, só em `compact`.
- `app/_layout.tsx`: `<Stack.Screen name="ideas" … title: 'Ideias' />`.
- `lib/realtime.ts`: `LIVE_TABLES` + tratamento das duas tabelas novas.
- `types/database.ts`: tabelas e função novas.
- `supabase/README.md`: linha da 0013 na tabela de migrations.

UI: Impeccable (modo Operate), tokens de `lib/theme.ts` e primitivos de `components/ui`; falta
primitivo → entra em `components/ui`. Copy no tom do `PRODUCT.md`.

## 4. Erros

| Situação | O que a pessoa vê |
|---|---|
| Texto vazio | Botão "Mandar" desabilitado |
| Mais de 280 | Campo trava em 280 (`maxLength`); contador mostra "0 restantes" |
| Falha ao mandar | Erro no campo, texto fica: "Não deu pra mandar a ideia. Tenta de novo." |
| Falha ao votar | Voto volta ao que era + aviso curto |
| Falha ao apagar | Erro dentro do `ConfirmDialog`, ideia fica |
| Falha ao carregar | `EmptyState` com "Tentar de novo" |
| Sem conexão | "Sem conexão. Confere a internet e tenta de novo." |

## 5. Testes

- `lib/ideas`: `applyVote` em todas as transições (nada→↑, ↑→nada, ↑→↓, ↓→↑, nada→↓, ↓→nada);
  `validateIdea` (vazio, só espaços, 280, 281).
- `lib/api/ideas`: `fetchIdeas` chama `ideas_feed` com o sort e junta autor; `voteIdea` faz upsert
  com +1/−1 e delete com null; `createIdea`/`deleteIdea`; tradução de erros.
- `useIdeas`: voto otimista aplicado na hora; rollback quando a API falha; troca de aba recarrega
  com o sort certo; mudança ao vivo de outra pessoa recarrega, a minha não.
- Tela: mandar ideia limpa o campo e mostra a ideia; votar muda seta e número; lixeira só na minha
  e em todas para admin; estado vazio.
- `Sidebar`: item "Ideias" e ativo em `/ideas`. Feed: lâmpada só em `compact`.
- `npx tsc --noEmit` e `npm test` passam.
