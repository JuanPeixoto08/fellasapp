# Stories — design

Data: 2026-10-04 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Stories como no Instagram: cada fella posta foto ou vídeo curto que aparece numa faixa no topo do feed
e **some sozinho em 1 dia**, inclusive do armazenamento, para não acumular dados nem custo.

**Sucesso:** postar um story em poucos toques (celular ou computador), assistir os dos fellas em tela
cheia passando sozinho, e no dia seguinte não sobrar nada — nem arquivo, nem linha no banco.

### Decisões tomadas na conversa
- **Foto ou vídeo**; foto aparece **5 s**, vídeo até **15 s**.
- **Arquivos no Cloudflare R2** (download grátis, 10 GB grátis, apagar em 1 dia é regra do próprio R2);
  no Supabase ficam só as listas (quem postou, quem viu, reações).
- **Link secreto**: endereço aleatório impossível de adivinhar, sem login para abrir, só aparece dentro
  do app e some em 1 dia.
- **Dono vê quem viu** ("Visto por 4" → lista).
- **Reagir com emoji** (mesma barra de reações do feed); o dono recebe notificação.
- **Faixa de bolinhas no topo do feed** (celular e computador).

### Premissas (não contestadas)
- Sem cortar vídeo dentro do app: no app nativo a galeria já limita a 15 s; no site, vídeo maior é
  recusado com aviso.
- Todo membro vê todos os stories (sem "melhores amigos").
- Fora: responder com texto, texto/figurinha por cima, destaques no perfil, story de várias fotos numa
  postagem só (cada foto/vídeo é um story).

## 1. Cloudflare (conta do dono)

**Passo do dono (único):** ativar o R2 no painel da Cloudflare e cadastrar um cartão (exigência da
Cloudflare mesmo no plano grátis; nada é cobrado dentro de 10 GB de armazenamento, e o download é grátis).

Depois, pelo `wrangler` (já logado):
- **Bucket R2 `fellas-stories`** com regra de ciclo de vida: **apagar objetos com mais de 1 dia**.
- **Worker `fellas-stories`** (`workers/stories/`, `wrangler.toml` com o bucket ligado como `BUCKET` e as
  variáveis públicas `SUPABASE_URL` e `SUPABASE_ANON_KEY`):
  - `POST /upload` — corpo = o arquivo; cabeçalhos `Authorization: Bearer <token do Supabase>` e
    `Content-Type`.
    1. Confere o login e se é membro chamando `POST {SUPABASE_URL}/rest/v1/rpc/is_member` com o token
       da pessoa (401 sem token/inválido; 403 se não for membro).
    2. Tipos aceitos: `image/jpeg`, `image/png`, `image/webp`, `image/gif`, `video/mp4`,
       `video/quicktime`, `video/webm` (415 se outro).
    3. Tamanho máximo: foto 5 MB, vídeo 50 MB (413 se passar; confere `Content-Length` e o que chegou).
    4. Nome: dois UUIDs aleatórios + extensão do tipo (ex.: `3f…c1a9…e7.mp4`).
    5. `BUCKET.put` com o `Content-Type`; responde `{ "url": "https://…/m/<nome>" }`.
  - `GET /m/<nome>` — entrega o arquivo do R2 com o tipo certo, `Cache-Control: public, max-age=86400`
    e **suporte a `Range`** (206 + `Content-Range`; Safari/iPhone só tocam vídeo assim). 404 se não existe.
  - CORS: `https://fellasapp.pages.dev` e `http://localhost:*` (desenvolvimento); `OPTIONS` respondido.
- O endereço do Worker entra no app por `EXPO_PUBLIC_STORIES_URL` (com o endereço publicado como padrão).

## 2. Supabase (migração `0011_stories.sql`)

- `stories`: `id uuid pk`, `author_id uuid → profiles` (cascade), `kind text check in ('photo','video')`,
  `media_url text not null` (endereço do Worker), `duration_ms integer not null` (foto 5000; vídeo a duração
  real, `check (duration_ms between 1 and 15000)`), `created_at timestamptz default now()`.
  Índice em `created_at`.
- `story_views`: `story_id → stories` (cascade), `viewer_id → profiles` (cascade), `viewed_at`, pk
  `(story_id, viewer_id)`.
- `story_reactions`: `story_id → stories` (cascade), `user_id → profiles` (cascade), `emoji text`
  (mesma validação das reações de post), `created_at`, pk `(story_id, user_id)`.
- **RLS**: membros leem tudo das três tabelas; `stories` — insere/apaga só o próprio (`author_id = auth.uid()`);
  `story_views` e `story_reactions` — insere/atualiza/apaga só a própria linha. Ninguém lê story com mais
  de 24 h (a política de leitura de `stories` exige `created_at > now() - interval '24 hours'`).
- **Limpeza**: `pg_cron` de hora em hora: `delete from stories where created_at < now() - interval '24 hours'`
  (visualizações e reações vão junto).
- **Tempo real**: `stories` e `story_reactions` na publicação `supabase_realtime`.
- **Notificação** `story_reaction` em `notifications_feed` (recriada a partir da 0010): reações de outras
  pessoas nos **meus stories ainda ativos**, agrupadas por story ("Ana e Pedro reagiram 😂 🔥 ao seu
  story"); some quando o story some.

## 3. App

- `lib/api/stories.ts`: `uploadStoryMedia(uri, kind)` (manda para o Worker com o token da sessão),
  `createStory(...)`, `listActiveStories()` (stories das últimas 24 h + autor + se eu vi + minha reação),
  `markStoryViewed(id)`, `listStoryViewers(id)` (só do dono), `reactToStory(id, emoji | null)`,
  `deleteStory(id)`.
- Foto: reduzida exatamente como no feed (`shrinkForUpload` de `lib/imageUpload`: lado maior 2048, JPEG 0.8), antes de enviar.
- Vídeo: tocado com `expo-video` (web e nativo). Duração: no nativo vem da galeria
  (`videoMaxDuration: 15`); na web, lida dos metadados do arquivo antes de enviar — acima de 15 s mostra
  "Esse vídeo passa de 15 s. Escolhe um menor.".
- `lib/storyPlayer.ts` (regra pura, testável): ordem das pessoas (não vistas primeiro, depois por mais
  recente; eu primeiro na faixa), avanço automático, voltar/avançar entre stories e pessoas, pausa.
- **Faixa** `components/stories/StoriesBar.tsx` no topo do feed: minha bolinha com "+" (posta) — se tenho
  story ativo, tocar abre o meu e o "+" do canto posta outro; depois os fellas com story ativo; anel
  `brand` = tem não visto, anel `border` = já vi tudo; nome embaixo.
- **Postar** `components/stories/StoryComposer.tsx`: escolhe foto/vídeo (no computador também Ctrl+V de
  imagem), prévia em tela cheia, "Postar story" / "Cancelar", "Enviando…", erro "Não rolou postar. Tenta
  de novo.".
- **Assistir** `components/stories/StoryViewer.tsx` (tela cheia, fundo `viewerBg`), aberto por um
  `StoryViewerHost` na raiz (mesmo padrão do seletor de emojis, para abrir de qualquer lugar, inclusive
  da notificação):
  - barrinhas de progresso por story da pessoa, avatar, nome e `postTime`;
  - toque direita/esquerda avança/volta; segurar pausa; ✕, Esc ou deslizar para baixo fecha; setas do
    teclado na web;
  - vídeo começa com som; se o navegador bloquear, começa mudo com botão de som;
  - story dos outros: barra de reações (emoji desenhado); o meu: "Visto por N" → lista (avatar, nome,
    horário, emoji se reagiu) e "Apagar" com confirmação;
  - abrir conta como visto.
- **Tempo real**: post de story novo atualiza a faixa; reação nova no meu story atualiza a bolinha de
  notificações (já existe o caminho).
- Tokens e componentes de `components/ui`; texto pt-BR; sem emoji no texto do sistema.

## 4. Testes

- Worker: regras puras (tipos aceitos, limites, nome aleatório, leitura do `Range`) em
  `workers/stories/src/rules.ts`, testadas no Jest do projeto.
- `storyPlayer`: ordem, avanço automático, fim da pessoa → próxima, voltar no primeiro, pausa.
- API: envio com token, tratamento de 401/403/413/415 em mensagens pt-BR, listagem/visto/reação/apagar.
- Componentes: faixa (minha bolinha, anéis visto/não visto, abrir), composer (vídeo > 15 s recusado,
  enviando/erro), viewer (progresso, avançar/voltar, "Visto por", apagar com confirmação, reagir).
- Depois do deploy: conferência real (postar foto e vídeo, assistir em outra conta, reagir, ver a
  notificação, e no dia seguinte conferir que sumiu do R2 e do banco).

## Fora do escopo
Responder com texto, editar (texto/figurinha), cortar vídeo, destaques, story privado/lista de amigos,
várias fotos num story só, encaminhar.
