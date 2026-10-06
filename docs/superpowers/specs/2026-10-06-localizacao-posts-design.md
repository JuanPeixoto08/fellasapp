# Localização em posts — design

Data: 2026-10-06 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Ao postar, o fella diz onde está ("Bar do Zé", "casa do Pedro") e os outros tocam no local para ver todos
os posts feitos lá.

**Sucesso:** no compositor, o botão de local abre um campo que sugere os locais que o grupo já usou; o local
escolhido aparece no post numa linha abaixo do nome; tocar abre a página do local com os posts dele, no
formato do feed.

### O que o Juan decidiu
- Local é **texto livre com sugestões dos locais já usados** pelos fellas. Sem GPS, sem API de lugares.
- **Tocar no local abre os posts daquele local** (página como a da #tag).
- No compositor, **campo dentro do próprio compositor** (não folha/janela separada), com sugestões embaixo.
- No post, **linha logo abaixo do nome** (não ao lado do horário, não perto das ações).
- Abordagem de dados **1**: coluna `posts.location` + chave normalizada `posts.place_key` preenchida pelo banco
  (gatilho), não tabela `places` separada nem comparação de texto exato.

### Fora do escopo (depois, se fizer falta)
Tela/aba com todos os locais; editar o local de post publicado (posts não são editáveis no app); local em
comentários; GPS, mapa ou busca em serviço de lugares; notificação por local.

## 1. O que aparece e onde

### Local no post (`PostCard`)
- Quando o post tem local, uma linha entre a linha do nome e o texto: `Icon location-outline` `sm` `muted` +
  `Text caption muted`, uma linha só, cortado com "…" (`numberOfLines={1}`).
- Fica na metade de baixo da altura do avatar `md` (a linha do nome já tem `minHeight` de meio avatar): nome e
  local alinham com a foto.
- Tocável (papel `link`, rótulo "Ver posts em <local>") → `/place/<placeKey>`. Alvo de toque de 44 via
  `hitSlop`, sem aumentar a linha. Na web, hover com `interactiveStyle` como os outros clicáveis.
- Sem local, a linha não existe e o post fica como hoje.
- Na própria página do local, o link fica desligado (como `linkAuthor` no perfil da pessoa).

### Compositor (`components/feed/Composer`)
- Barra de baixo: `IconButton` `location-outline` ghost ("Adicionar local"; com local já escolhido,
  "Trocar local") logo depois do texto "0/4 fotos".
- Tocar abre, abaixo do texto e acima das fotos, uma linha com `Icon location-outline` + campo
  (placeholder "Onde você tá?", foco automático, até 60 caracteres) + `IconButton` ✕ "Fechar local".
- Embaixo do campo, `PlaceSuggestions` (mesmo visual da `TagSuggestions`: caixa `surface`, fio `border`,
  raio `md`, linhas de 44): até 5 locais existentes cuja chave começa com o digitado, com o número de posts
  ("Bar do Zé · 12 posts"). Com o campo vazio, mostra os 5 mais usados.
- Se o texto digitado (limpo) não tem a mesma chave de nenhuma sugestão, a última linha é
  `Usar "<texto>"`.
- Tocar numa sugestão, tocar em "Usar…" ou dar Enter no campo confirma: o campo fecha e vira um chip
  embaixo das fotos: `⌖ Bar do Zé ✕` (altura `chipHeight`, contorno `hairline`, raio `pill`, texto `small`).
  Tocar no texto do chip reabre o campo com o local; o ✕ ("Tirar local") remove.
- Enter/confirmar com campo vazio, ou o ✕ do campo, fecha sem local.
- O local entra no rascunho compartilhado (`lib/composerDraft`: `Draft` ganha `location: string | null`),
  então página, topo do feed e janela mostram o mesmo. `clearDraft` limpa junto.
- Local sozinho não habilita "Postar" (continua precisando de texto ou foto); mas conta como rascunho para
  o aviso de descartar.

### Página do local (`app/place/[key].tsx`)
- Igual à página da tag (`app/tag/[name].tsx`): cabeçalho com o nome do local, contagem ("12 posts") e a
  lista no formato do feed, com rolagem, puxar para atualizar e posts novos ao vivo.
- Título: a grafia do local do primeiro post carregado; antes de carregar, o parâmetro `name` que o link
  passa junto (`/place/<key>?name=<local>`); sem nenhum dos dois, "Local".
- Vazio: "Ninguém postou daqui ainda." / "Posta algo marcando esse lugar." Erro: "Não deu pra carregar esse
  local" + "Tentar de novo".
- Registrada em `app/_layout.tsx` como a da tag (`headerShown`, título "Local").

## 2. Dados (Supabase)

Migration `supabase/migrations/0020_post_location.sql`, idempotente:

- `create extension if not exists unaccent with schema extensions;`
- `public.place_key(text) returns text`, `immutable`: `lower` + sem acento
  (`extensions.unaccent('extensions.unaccent'::regdictionary, …)`, forma de 2 argumentos para não depender do
  `search_path`) + espaços das pontas tirados e espaços repetidos viram um. Vazio → `null`.
- `posts.location text null` com check `char_length(location) between 1 and 60`.
- `posts.place_key text null` + índice `posts_place_key_idx`.
- Gatilho `posts_set_place_key` (before insert or update, em qualquer update, como o das tags): limpa
  `location` (pontas e espaços repetidos; vazio → `null`) e grava `place_key := place_key(location)`.
  Ninguém grava `place_key` direto pela API.
- `public.place_suggestions(p_prefix text, p_limit integer default 5)
  returns table (key text, name text, posts integer)`, `stable`, `security invoker` (a RLS de posts vale):
  agrupa posts com `place_key like place_key(p_prefix) || '%'` (prefixo vazio = todos), `name` = a grafia
  mais usada da chave (empate: a mais recente), ordem: mais posts, depois chave; limite entre 1 e 20.
  `grant execute` só para `authenticated`.
- `types/database.ts` atualizado (colunas e função).

## 3. App

- `lib/places.ts`:
  - `PLACE_MAX = 60`.
  - `cleanPlace(raw): string | null`: pontas, espaços repetidos, vazio → `null` (igual ao gatilho).
  - `placeKey(raw): string`: mesma regra do banco (`NFD` + tira marcas, minúsculas, espaços) — só para o
    compositor saber se o digitado já é uma sugestão (decide a linha "Usar…").
- `lib/api/places.ts`: `suggestPlaces(prefix, limit = 5)` (rpc `place_suggestions`) e
  `countPlacePosts(key)`.
- `lib/api/posts.ts`:
  - `FeedPost` ganha `location: string | null` e `placeKey: string | null` (do `*` que já vem no select).
  - `createPost({ body, imageUris, location })` manda `location: cleanPlace(location)`; post só com local
    continua rejeitado ("Escreva algo ou escolha uma imagem").
  - `FeedFilter` ganha `place?: string` → `.eq('place_key', place)`.
- `lib/usePostList.ts`: opção `place`, repassada ao `listFeed`; ao vivo, `belongsHere` confere
  `row.place_key === place`.
- `components/PlaceSuggestions.tsx`: como `TagSuggestions` (espera 200 ms antes de perguntar; erro = sem
  sugestões) + a linha "Usar…".
- `components/PostCard.tsx`: linha do local (seção 1); prop `linkPlace` (padrão `true`).
- Tudo com tokens de `lib/theme.ts` e primitivos de `components/ui`; nada de valor solto.

## 4. Erros e bordas

- Sugestões falharam: o campo segue funcionando, só sem lista ("Usar…" continua aparecendo com texto).
- Texto com mais de 60: o campo não deixa (`maxLength`); o banco também recusa.
- "Bar do Zé" e "bar do ze": mesma chave, mesma página; cada post mostra a grafia que a pessoa escreveu.
- App antigo aberto (sem o campo): posts saem sem local, nada quebra. App novo antes da migration: o insert
  com `location` falharia, então a migration sobe antes do app.
- Post apagado some da página do local como some do feed (mesma `usePostList`).

## 5. Testes

- `lib/places`: `cleanPlace` (pontas, espaços repetidos, vazio → null) e `placeKey` (acento, maiúscula,
  espaços).
- `PlaceSuggestions`: mostra sugestões com contagem; "Usar…" aparece só quando o digitado não bate com
  nenhuma chave; tocar chama `onPick` com o nome.
- `PostCard`: com local mostra a linha e o rótulo "Ver posts em …"; sem local não mostra; `linkPlace={false}`
  não navega.
- `Composer`: escolher local vira chip; ✕ tira; "Postar" manda `location` ao `createPost`; rascunho limpo
  depois de postar.
- `npx tsc --noEmit` e `npm test` passam.

## 6. Atualizar depois

- `DESIGN.md`: seção do Post (linha do local) e do compositor (botão, campo, chip).
