# Ingresso no post: review do Letterboxd e música — design

Data: 2026-10-08 · Status: aprovado em conversa (conselho web + mockup "Card de Review Fellas", direção B com contorno)

## Objetivo

Anexar a um post, como a enquete, um **ingresso**: a sua review do Letterboxd (pôster, título, ano, estrelas,
coração, data em que viu, revi, review com "mais", spoiler escondido quando marcado) ou a música que você ouve
(capa, música, artista). Visual no clima do fellas: canhoto de cinema colado num zine.

**Sucesso:** no compositor, um toque em 🎬 lista as suas reviews recentes (ou você cola o link de uma review
sua) e um toque em ♪ pega o que está tocando (ou uma das últimas); o post mostra o ingresso; tocar abre o
Letterboxd / Last.fm.

### O que o Juan decidiu
- **Só as próprias reviews**: o perfil ganha "Usuário no Letterboxd"; escolher da lista ou colar o link de uma
  review sua.
- **Visual B (Ingresso) com contorno**, sem mais mudanças: ingresso com pôster no canhoto, picote e recortes
  redondos; do outro lado "Sessão · 30 dez 2025", título grande, ano (· revi), estrelas e coração; embaixo a
  review (4 linhas + "mais") e "Abrir no Letterboxd"; um contorno fino junta tudo (como a caixa da enquete).
- **Spoiler só quando a review está marcada no Letterboxd**: aí o texto fica escondido até tocar em
  "Pode ter spoiler · toque pra ler"; as outras aparecem normais.
- **Música junto**, no mesmo estilo de ingresso.

### Do conselho (mantido)
- Snapshot congelado no post; validação no banco (hosts permitidos, chaves fixas, tamanho, trava depois de
  postar), igual às enquetes. Nada de prévia genérica de qualquer link (Open Graph).
- Links `https` no texto do post viram tocáveis (passo separado).
- Post com música anexada esconde a linha ao vivo "ouvindo …" do cabeçalho (senão aparecem duas músicas).

### Fatos conferidos (2026-10-08)
- Letterboxd: sem API aberta; RSS público `https://letterboxd.com/<usuario>/rss/` (até ~100 itens, até ~50
  reviews). Review = `guid` `letterboxd-review-…` (diário sem review = `letterboxd-watch-…`). Campos:
  `letterboxd:filmTitle`, `filmYear`, `memberRating` (0.5–5), `memberLike` (Yes/No), `rewatch` (Yes/No),
  `watchedDate`, `link`, pôster `<img src="https://a.ltrbxd.com/resized/...">` e o texto inteiro da review
  em `<p>` no `description`. Spoiler: título termina com "(contains spoilers)" e o texto começa com
  `<p><em>This review may contain spoilers.</em></p>`. Usuário inexistente → 404. **Sem CORS**: precisa de
  servidor.
- Last.fm: CORS liberado (o app já chama). Capas em `https://lastfm-img.freetls.fastly.net/i/u/...`; páginas em
  `https://www.last.fm/music/...`.

### Fora do escopo
Reviews de outras pessoas; reviews mais antigas que as ~50 do feed; prévia de link genérico; editar o anexo
depois de postar; notificação.

## 1. Banco (migração `0026_post_media.sql`)

- `profiles.letterboxd_user text` — check `^[A-Za-z0-9_]{2,15}$` (ou null); `grant update (letterboxd_user)`.
- `posts.media jsonb` (null = sem anexo). Função imutável `post_media_ok(jsonb)` num check:
  - `kind = 'track'`: chaves exatamente `kind,title,artist,album,image,url,live`; `title`/`artist` 1–200;
    `album` null ou ≤200; `url ~* '^https://(www\.)?last\.fm/'`; `image` null ou
    `~* '^https://lastfm-img\.freetls\.fastly\.net/'`; `live` boolean.
  - `kind = 'review'`: chaves exatamente `kind,title,year,rating,liked,rewatch,watched,poster,url,text,spoiler`;
    `title` 1–200; `year` null ou 1870–2100; `rating` null ou 0.5–5 em passos de 0.5; `liked`, `rewatch`,
    `spoiler` boolean; `watched` null ou data `AAAA-MM-DD`; `poster` null ou
    `~* '^https://a\.ltrbxd\.com/'`; `url ~* '^https://letterboxd\.com/[A-Za-z0-9_]+/film/'`; `text` ≤ 6000.
  - Tamanho total `pg_column_size(media) <= 8192`.
- `posts_body_or_image` passa a aceitar `media is not null` (post só com o ingresso vale).
- `media` e enquete não juntos (check `poll_options is null or media is null`); fotos e local podem.
- Gatilho `posts_media_lock` (before update): `media` não muda depois de postar.

## 2. Edge Function `letterboxd-reviews`

Modelo do `stories-media`: confere o login (bearer) e se é membro; lê o `letterboxd_user` **de quem chama**
(sem parâmetro de usuário: nada de URL vinda do cliente); busca o RSS com host fixo, sem seguir redirect,
timeout 8 s, até 1 MB; devolve só as reviews, já como os campos do anexo (texto em parágrafos, sem a linha
"This review may contain spoilers", `spoiler` marcado). Erros: `no_user` (perfil sem Letterboxd),
`not_found` (404), `unavailable` (rede/5xx). Publicada pelo Juan (`supabase functions deploy`).

## 3. App

- **Editar perfil**: campo "Usuário no Letterboxd" (como o do Last.fm), abaixo dele.
- **Compositor**: dois botões novos na barra, depois do local: `film-outline` (review) e
  `musical-notes-outline` (música). Anexo é um só por post; com enquete os dois ficam desabilitados (e vice-versa).
  - Review: folha com as reviews recentes (pôster, título, ano, estrelas) e um campo "Colar link da review";
    o link precisa ser do seu usuário (`letterboxd.com/<seu usuário>/film/...`) e estar entre as recentes.
  - Música: tocando agora no topo ("Tocando agora") + as 5 últimas; um toque anexa.
  - Estados: carregando; sem conta ("Coloca seu usuário do Letterboxd/Last.fm em Editar perfil", com botão);
    usuário não existe; sem reviews; erro com "Tentar de novo"; link de outra pessoa ou antigo demais.
  - Anexado: o ingresso aparece no compositor com ✕ para tirar.
- **Post**: `PostTicket` depois do texto (antes das fotos): contorno `border` raio `lg`; dentro, o ingresso
  (`surface`, canhoto com a imagem, picote tracejado, recortes redondos), e para review o texto (4 linhas +
  "mais"; spoiler: borrado + botão "Pode ter spoiler · toque pra ler") e "Abrir no Letterboxd". Música:
  canhoto quadrado com a capa, "Tocando agora" ou "Ouvi", música, artista e "Abrir no Last.fm". Estrelas na cor
  do texto, coração no vermelho do curtido. Imagem que falha → canhoto liso com ícone.
- **Links no texto**: `https://…` em post/comentário vira link tocável (abre fora).

## 4. Ordem de publicação

1. Links tocáveis → push.
2. Migração 0026 + função escritas e testadas → Juan roda `supabase db push` e `supabase functions deploy
   letterboxd-reviews` → conferir REST (200 nas colunas; 400 para anexo inválido) → push do app.

## 5. Testes

Puros: `post_media` (montar e validar anexos, hosts), parser do RSS (fixture real, spoiler, sem review, 404),
links no texto. Componentes: `PostTicket` (review, spoiler, "mais", música, imagem que falha), seletores com
todos os estados, compositor (anexar, tirar, exclusão com enquete, envio), Editar perfil (campo). API:
`createPost` manda `media` só quando tem; mapeamento.
