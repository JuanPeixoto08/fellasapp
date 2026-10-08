# Enquetes nos posts — design

Data: 2026-10-07 · Status: aprovado em conversa (referência: print do compositor de enquete do Twitter)

## Objetivo

Postar uma pergunta com 2 a 4 opções e um prazo; os fellas votam tocando numa opção e veem as porcentagens.

**Sucesso:** no compositor, o botão de enquete (depois do local) abre a caixa de opções e duração; o post
mostra as opções com barras de porcentagem; um toque vota; quando o prazo acaba aparece "Resultado final".

### O que o Juan decidiu
- **Igual ao Twitter, com o nosso desenho.** Botão na barra do compositor, depois do local.
- **Opções só de texto**, até 25 caracteres, de 2 a 4.
- **Duração em três listas, como no Twitter:** Dias (0–7), Horas (0–23), Minutos (0–59). Padrão 1 dia.
  Mínimo 5 minutos, máximo 7 dias (com 7 dias, horas e minutos ficam em 0).
- **Votos anônimos:** ninguém vê quem votou em quê, só porcentagens e total.
- **Resultado sempre visível**, antes e depois de votar.
- **Voto é definitivo:** não troca nem tira.
- **Enquete ou fotos**, nunca os dois. Texto (a pergunta) e local continuam valendo.

### Fora do escopo
Foto por opção; notificação de enquete encerrada; ver quem votou; editar a enquete depois de postar.

## 1. Banco (migração `0025_polls.sql`)

**Em `posts`** (a enquete é do post: sai junto quando o post é apagado e chega pelo mesmo tempo real):
- `poll_options text[]` — null = sem enquete.
- `poll_ends_at timestamptz`.
- `poll_counts int[]` — votos por opção, na mesma ordem; quem mantém é o banco.

Regras:
- check: sem enquete → os três null; com enquete → `poll_ends_at` não null, 2 a 4 opções, cada uma com 1 a
  25 caracteres depois de `btrim` (função imutável `poll_options_ok(text[])`).
- check: enquete sem fotos (`image_url is null and cardinality(images) = 0`) e com pergunta
  (`char_length(btrim(body)) > 0`).
- gatilho `before insert`: com enquete, `poll_ends_at` precisa estar entre agora + 5 min e agora + 7 dias
  (2 min de folga para o relógio do aparelho); zera `poll_counts` (`array_fill(0, …)`) — o app não escolhe os
  números.
- gatilho `before update`: `poll_options` e `poll_ends_at` não mudam; `poll_counts` só muda pelo gatilho dos
  votos (marca de sessão `fellas.poll_vote`).

**Tabela `poll_votes`:** `post_id` (→ posts, cascade), `user_id` (→ profiles, cascade), `option smallint`
(0–3), `created_at`; chave `(post_id, user_id)` = um voto por pessoa.
- RLS: **ler só o próprio voto** (anônimo); inserir o próprio voto sendo membro. Sem política de update nem
  delete: voto definitivo.
- gatilho `before insert` (security definer): o post tem enquete, ela está aberta (`poll_ends_at > now()`) e a
  opção existe. Senão erro `poll_closed` / `poll_invalid_option`.
- gatilho `after insert` (security definer): soma 1 em `posts.poll_counts[option + 1]`. Isso gera um UPDATE em
  `posts`, que o tempo real já entrega: os números mudam ao vivo para todo mundo.

## 2. App

### Dados (`lib/api/posts.ts`, `lib/polls.ts`)
- `FeedPost.poll?: { options: string[]; counts: number[]; endsAt: string; myVote: number | null }`.
- Ao listar posts, uma consulta a mais em `poll_votes` (só os meus, só dos posts com enquete) para `myVote`.
- `createPost` aceita `poll?: { options: string[]; minutes: number }` e grava `poll_options` (sem as vazias,
  com `trim`) e `poll_ends_at = agora + minutos`.
- `votePoll(postId, option)`: insere o voto.
- `lib/polls.ts` (puro, testável): limites, `normalizeDuration`, opções das listas conforme os dias/horas,
  `durationMinutes`, `pollPercents` (arredonda, total 0 → 0%), `pollTimeLeft` ("faltam 2 dias", "falta 1 h",
  "faltam 12 min", "menos de 1 min" / null quando acabou), `pollReady` (pergunta + 2 opções preenchidas).

### Primitivo `Select` (`components/ui`)
Campo com contorno como o `TextField`: rótulo pequeno em cima ("Dias"), valor embaixo e `chevron-down` à
direita. Tocar abre a lista presa ao campo (abaixo; sem espaço, acima), superfície `surface`, fio `border`,
raio `md`, sombra `raised`, até ~6 linhas com rolagem; cada linha é uma `ChoiceRow`. Tocar fora fecha.
Acessível: botão "Dias: 1" que abre a lista.

### Compositor
- Rascunho ganha `poll: { options: string[]; days; hours; minutes } | null`.
- Barra: depois do local, `IconButton` `stats-chart-outline` "Adicionar enquete". Com fotos, fica
  desabilitado; com enquete aberta, o de fotos fica desabilitado (e o "0/4 fotos" continua).
- Com enquete: o texto vira "Faz uma pergunta…" e a dica some; abaixo do texto, a caixa `PollEditor`
  (fio `border`, raio `lg`): campos "Opção 1"…"Opção 4" (até 25, contador "0/25"), "+" ao lado do último
  enquanto houver menos de 4, ✕ nas opções 3 e 4; "Duração da enquete" com os três `Select`; um fio e
  "Remover enquete" (texto `danger`).
- "Postar" só acende com a pergunta e 2 opções preenchidas. Descartar o rascunho leva a enquete junto.

### No post (`components/feed/PostPoll.tsx`, depois do texto)
- Uma linha por opção (altura de toque 44): barra de fundo proporcional à porcentagem (`surfaceSunken`; a
  minha em `brandSoft`), texto da opção e porcentagem à direita; a minha com ✓ `brand` e negrito.
- Embaixo: "N votos · faltam 2 dias" ou "N votos · Resultado final". Encerrada, a(s) mais votada(s) em negrito.
- Aberta e sem meu voto: tocar numa opção vota na hora (otimista: soma 1 e marca); erro desfaz e avisa
  ("A enquete já acabou." / "Não rolou votar. Tenta de novo."). Já votei ou acabou: só mostra.
- A linha do tempo restante se atualiza sozinha a cada minuto enquanto a enquete estiver aberta.
- Acessível: antes de votar, botão "Votar em X"; depois, "X, 40%, 4 votos".

## 3. Testes
- `lib/polls`: duração (normalizar, listas, mínimo e máximo), porcentagens, tempo restante, pronto para postar.
- `Select`: abre, escolhe, fecha.
- Compositor: botão de enquete abre a caixa; "+" até 4; remover; fotos × enquete se desabilitam; "Postar"
  só com pergunta e 2 opções; manda `poll` com os minutos certos.
- `PostPoll`: porcentagens, votar chama a API e marca, erro desfaz, encerrada não vota, "Resultado final".
- `createPost`/mapeamento: grava as colunas certas e lê `poll` + `myVote`.
