# Notificações — design

Data: 2026-10-04 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Uma tela de **Notificações** dentro do app (site e app nativo) que mostra o que aconteceu ao redor de
cada fella: curtidas, reações, comentários, conversas em que ele entrou, aniversários do dia e fellas
novos. Uma bolinha com o número de não lidas avisa que tem coisa nova.

**Sucesso:** abrir o app, ver a bolinha no sino (celular) ou na lateral (computador), tocar e entender
em segundos quem fez o quê, com um toque levando ao post ou ao perfil certo.

### Decisões tomadas na conversa
- **Só dentro do app.** Sem push (celular/navegador apitando). Push fica para depois, se quiserem.
- **Eventos:** curtida, comentário e reação (em post e em comentário) no que é meu; aniversário de fella;
  **resposta na conversa** (comentaram num post que eu comentei); **fella novo** entrou.
- **Agrupado:** curtidas e reações viram uma linha por post/comentário ("Ana, Pedro e mais 3…");
  comentários ficam um por linha.
- **Lugar:** no celular, **sino no canto superior direito do topo do feed** (como o Instagram), abrindo
  a tela por cima; a tab bar não muda. No computador, **item "Notificações" na lateral**, seguindo o
  padrão dos outros itens.
- **Abordagem A:** nada de tabela de notificações. Uma função no banco calcula a lista na hora a partir
  das tabelas que já existem; "lido" é o horário da última visita à tela.

### Premissas (não contestadas)
- Janela de **30 dias**, no máximo **50 linhas**.
- Abrir a tela marca **tudo** como lido (não existe lido por item).
- Sem atualização em tempo real: o número atualiza ao abrir o app, ao voltar para ele e a cada 1 minuto.
- Horário de referência para "hoje" (aniversário): **America/Sao_Paulo**.

## 1. Tipos de notificação

| `kind` | Texto (nomes em negrito) | Agrupa | Quem recebe | Toque abre |
|---|---|---|---|---|
| `like` | **Ana**, **Pedro** e mais 3 curtiram seu post | por post | autor do post | post |
| `post_reaction` | **Ana** e **Pedro** reagiram 😂 🙏 ao seu post | por post | autor do post | post |
| `comment_reaction` | **Ana** reagiu 😂 ao seu comentário | por comentário | autor do comentário | post do comentário |
| `comment` | **Ana** comentou: "haha que isso" | não | autor do post | post |
| `thread_reply` | **Ana** também comentou num post que você comentou: "kkk" | não | quem comentou antes no post | post |
| `birthday` | Hoje é aniversário de **Juan** | — | todos os membros, menos o aniversariante | perfil |
| `new_member` | **Pedro** entrou no fellas | — | todos os membros, menos o novo | perfil |

Regras:
- **Minhas próprias ações nunca viram notificação** (curtir meu próprio post, comentar no meu post etc.).
- `thread_reply` só vale para posts **de outra pessoa**, para comentários **de outra pessoa**, feitos
  **depois** do meu primeiro comentário naquele post. No meu próprio post o caso já é `comment`.
- **Nomes:** `display_name` ou, se vazio, `username`.
- **Agrupamento do texto:** 1 pessoa → "Ana"; 2 → "Ana e Pedro"; 3 → "Ana, Pedro e Bia";
  4 ou mais → "Ana, Pedro e mais N" (N = total − 2). Verbo no singular para 1 pessoa, plural para 2+.
- **Reações:** mostram até 3 emojis diferentes, do mais recente para o mais antigo.
- **Trecho de comentário:** até 80 caracteres, com "…" se cortar, entre aspas.
- **Sem emoji no texto do sistema** (regra do PRODUCT.md): aniversário usa ícone de presente, não 🎂.
  Os emojis de reação aparecem porque são o conteúdo escolhido pelos fellas.
- **Desfazer some sozinho:** descurtir, apagar comentário ou tirar reação muda o resultado da função na
  próxima busca (não há nada guardado).
- **Aniversário:** dia/mês do `birthday` igual ao de hoje em São Paulo; quem nasceu em 29/02 aparece em
  28/02 nos anos não bissextos (mesma regra de `lib/birthdays.ts`). Vale o dia todo.
- **Lista vazia:** título "Nada por aqui ainda." e texto "Quando alguém curtir, comentar ou reagir,
  aparece aqui."
- **Erro:** "Não deu pra carregar as notificações." com botão "Tentar de novo".

## 2. Linha da lista

`components/notifications/NotificationRow.tsx`, no padrão "sem caixa" do feed (DESIGN.md: direto no
papel, `Divider` entre linhas):
- **Avatar** `md` de quem agiu por último (aniversário/fella novo: a própria pessoa), com um **ícone
  pequeno do tipo** encostado no canto: coração (`like`, cor `like`), balão (`comment`, `thread_reply`),
  carinha (`post_reaction`, `comment_reaction`), presente (`birthday`), pessoa com + (`new_member`).
- **Texto** com nomes em negrito e, abaixo, a data no formato do feed (`shortDate`), em `textMuted`.
- **Miniatura** à direita (quadrada, raio `md`) quando a notificação é de post e o post tem foto.
- **Não lida:** fundo `surfaceSunken` e um ponto `brand` à esquerda do avatar, só durante a visita
  em que ela chegou como nova.
- Linha inteira é um botão com `accessibilityLabel` = texto completo + data.

## 3. Navegação e bolinha

- **Rota:** `app/notifications.tsx` na Stack raiz, com cabeçalho "Notificações" (mesmo padrão de
  "Membros"). No computador ela aparece dentro da moldura (lateral + coluna central + coluna direita).
- **Celular (`compact`):** o topo do feed ganha, à direita da marca FELLAS, um `IconButton` com o sino
  (`notifications-outline`) e a bolinha. Toque → `router.push('/notifications')`.
- **Computador (`medium`/`expanded`):** item **Notificações** na `Sidebar` entre Feed e Perfil
  (`notifications-outline` / `notifications` ativo), com a bolinha; ativo quando a rota é
  `/notifications`. Na lateral estreita, só o ícone com a bolinha.
- **Bolinha** — primitivo novo `components/ui/Badge.tsx`:
  - mostra o número; 0 não renderiza nada; acima de 9 mostra "9+";
  - fundo `brand`, texto `onBrand` (token novo: `#FFFFFF` no claro, `#121212` no escuro; contraste
    ≥ 4.5:1 testado), fonte `caption` em negrito, formato pílula;
  - acessibilidade: o controle que a contém diz "Notificações, 3 novas" (sem número: "Notificações").

## 4. Lido e atualização

- **Abrir a tela:** busca a lista (cada linha já vem com `unread`), mostra, e então chama
  `mark_notifications_seen()`; o número global vai para 0 na hora.
- **Puxar para atualizar** (celular) e voltar para a tela: busca de novo e marca de novo.
- **Número da bolinha** (`lib/notifications.ts`), um estado compartilhado (padrão `useSyncExternalStore`
  já usado em `composerDraft`/`passwordReset`):
  - busca `unread_notifications_count()` ao entrar logado como membro, **a cada 60 s** enquanto o app
    está em primeiro plano, quando o app volta para o primeiro plano (`AppState` no nativo,
    `visibilitychange` na web) e logo depois de marcar como visto;
  - para de buscar ao sair da conta; volta a 0 quando a sessão muda;
  - erro de rede mantém o último número (sem mensagem; a tela tem o próprio erro).

## 5. Banco (migração `0008_notifications.sql`)

Idempotente, no estilo das anteriores.

- `profiles.notifications_seen_at timestamptz not null default now()` — começa em "agora" para
  ninguém ganhar 30 dias de bolinha no primeiro dia.
- `public.notifications_feed(p_limit int default 50)` — `language sql stable security invoker`
  (as políticas de leitura de membros já cobrem likes, comments, reactions, posts e profiles), usando
  `auth.uid()`. Retorna, ordenado por `latest_at desc`:

  | coluna | tipo | conteúdo |
  |---|---|---|
  | `kind` | text | um dos 7 tipos |
  | `post_id` | uuid null | post da notificação (todos menos `birthday`/`new_member`) |
  | `comment_id` | uuid null | comentário (`comment`, `thread_reply`, `comment_reaction`) |
  | `actor_ids` | uuid[] | até 3 pessoas, a mais recente primeiro (aniversário/novo: a pessoa) |
  | `actor_count` | int | total de pessoas distintas no grupo |
  | `emojis` | text[] | até 3 emojis distintos (reações), mais recente primeiro |
  | `body` | text null | texto do comentário (`comment`, `thread_reply`) |
  | `latest_at` | timestamptz | momento do evento mais recente; aniversário = 00:00 de hoje em SP |
  | `unread` | boolean | `latest_at > notifications_seen_at` do usuário |

  Só eventos dos últimos 30 dias (aniversário: só o de hoje). Retorna vazio para quem não é membro.
- `public.unread_notifications_count()` → `int`: quantas linhas de `notifications_feed(50)` têm
  `unread`.
- `public.mark_notifications_seen()` → `void`: `security definer` com `search_path` fixo, atualiza só
  `profiles.notifications_seen_at = now()` onde `id = auth.uid()` (relógio do servidor).
- `grant execute` das três funções para `authenticated`.
- `types/database.ts`: coluna nova e as três funções em `Functions`.

**Ordem de entrada:** a migração é aplicada (pelo dono do projeto, `supabase db push`) **antes** de
publicar o app. Se o app for antes: a busca do número falha em silêncio (sem bolinha) e a tela mostra o
estado de erro; nada trava.

## 6. App

- `lib/api/notifications.ts`
  - `fetchNotifications()`: chama `notifications_feed`, busca os perfis de todos os `actor_ids` numa
    consulta, busca os posts referenciados (primeira foto: `images[0]` ou `image_url`) e assina as
    miniaturas com `signPaths`; devolve `AppNotification[]`.
  - `fetchUnreadCount()`, `markNotificationsSeen()`.
- `lib/notifications.ts`
  - `describeNotification(n)`: devolve o texto como partes `{ text, bold }[]` (testável sem tela).
  - estado do número + `useUnreadNotifications()` + `refreshUnreadNotifications()` + o ciclo de
    atualização (montado uma vez, no `AppShell`/raiz, só com sessão de membro).
- `app/notifications.tsx`: `FlatList` de `NotificationRow`, `Divider` entre linhas, puxar para
  atualizar, estados vazio/erro/carregando.
- `components/notifications/NotificationRow.tsx`, `components/ui/Badge.tsx` (+ export no `index.ts`).
- `app/(tabs)/feed.tsx`: sino com bolinha no topo (só `compact`).
- `components/shell/Sidebar.tsx`: item novo com bolinha.
- `lib/theme.ts`: token `onBrand`. `app/_layout.tsx`: `Stack.Screen name="notifications"`.
- `DESIGN.md`: seção curta sobre a tela, o sino e o `Badge`.

## 7. Testes

- `describeNotification`: os 7 tipos; 1/2/3/4+ pessoas; singular/plural; emojis; corte em 80.
- `fetchNotifications`: junta perfis, ignora ator sem perfil, monta miniatura só de post com foto.
- Número: busca inicial, intervalo de 60 s (timers falsos), volta ao primeiro plano, zera ao marcar,
  "9+" no `Badge`, 0 não renderiza.
- Tela: marca como visto depois de carregar; linha `unread` destacada e as outras não; vazio; erro com
  "Tentar de novo"; toque leva a `/post/[id]` ou `/user/[id]`.
- Sino no feed (só `compact`) e item na lateral, ambos com o número e o rótulo acessível.
- Contraste `onBrand` × `brand` nos dois temas.
- **SQL:** sem Postgres local, a função não tem teste automatizado. Depois do `db push`, conferir no
  site com ações reais (curtir, reagir, comentar, responder) entre duas contas e corrigir na hora se
  algo não aparecer.

## Fora do escopo
- Push (celular/navegador), e-mail.
- Lido por item, apagar notificação, preferências do que notificar.
- Tempo real.
- Menções (@fulano).
