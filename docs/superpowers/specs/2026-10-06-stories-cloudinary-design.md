# Stories com Cloudinary — design

Data: 2026-10-06 · Status: aprovado em conversa, aguardando revisão do spec escrito

Substitui a parte de armazenamento da spec `2026-10-04-stories-design.md` (Cloudflare R2 + Worker), que
o Juan descartou por exigir cartão. **Tudo o que não está aqui continua valendo daquela spec** (seções
"Decisões", "Premissas", "3. App" e "Fora do escopo"), adaptado ao visual e ao layout de computador que a
`main` tem hoje.

## Objetivo

Stories como no Instagram: foto (5 s) ou vídeo (até 15 s) numa faixa no topo do feed, tela cheia passando
sozinho, "Visto por N" para o dono, reagir com emoji (com notificação), apagar o próprio, e **some tudo em
24 h** — arquivo e linhas do banco. **Custo zero sem risco de cobrança**: nenhum serviço com cartão.

### O que o Juan decidiu
- Arquivos no **Cloudinary, plano grátis** (sem cartão; 25 créditos/mês; 1 crédito = 1 GB de banda,
  1 GB guardado ou 1.000 transformações). Estourou: o Cloudinary bloqueia só os stories até o mês virar.
- **Escopo igual ao desenho antigo** (nada a mais, nada a menos).
- Abordagem: **Edge Function assina o envio, o app manda o arquivo direto ao Cloudinary, uma limpeza
  de hora em hora apaga o que passou de 24 h.**

### Fatos do Cloudinary que moldam o desenho (verificados em 2026-10-06)
- Não há expiração automática de arquivos enviados no plano grátis: a limpeza é nossa (Admin API,
  500 chamadas/hora no grátis).
- Envio assinado exige a API secret no servidor; a assinatura vale por 1 hora e cobre os parâmetros
  enviados (`public_id`, `eager`, etc.).
- Vídeo até 100 MB por arquivo; transformação "na hora" de vídeo só até 40 MB (acima, precisa
  `eager_async`).

### Fora do escopo
O da spec antiga, mais: link de entrega assinado (o arquivo fica público no endereço aleatório, como o
"link secreto" já aprovado), contador de uso do Cloudinary no app.

## 1. Cloudinary

**Passos do Juan (uma vez):** criar a conta grátis; passar o **cloud name** e a **API key** (vão para o
app e para a função; não são segredo); rodar ele mesmo
`npx supabase secrets set CLOUDINARY_API_SECRET=<secret>` (a secret não passa por chat nem por arquivo).

- Pasta `stories/`; nome de cada arquivo `stories/<64 hex aleatórios>` (dois UUIDs sem hífen) — o
  endereço não se adivinha.
- Versão reduzida pedida no próprio envio (`eager` + `eager_async=true`):
  - vídeo: `c_limit,w_1280,h_1280,q_auto,f_mp4` (lado maior até 1280 — 720p em pé ou deitado);
  - foto: `c_limit,w_1920,h_1920,q_auto,f_jpg` (lado maior até 1920).
- Entrega: `https://res.cloudinary.com/<cloud>/<image|video>/upload/<transformação>/<media_id>`.
  Se a versão reduzida do vídeo ainda não ficou pronta (erro ao tocar), o app toca o original
  (`.../video/upload/<media_id>`), que sempre existe.

## 2. Edge Function `stories-media` (Supabase)

`supabase/functions/stories-media/index.ts` (Deno). Segredos: `CLOUDINARY_CLOUD_NAME`,
`CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`, `STORIES_CRON_SECRET`. As regras puras (nome aleatório,
parâmetros e assinatura, "passou de 24 h", transformação por tipo) ficam em
`supabase/functions/stories-media/rules.ts`, sem dependência do Deno, testadas no Jest do projeto.

- `POST /sign` `{ kind: 'photo' | 'video' }`, com o token da pessoa:
  1. 401 sem login; 403 se não for membro (`rpc is_member` com o token dela).
  2. Gera o `media_id`, o `timestamp` e a assinatura (SHA-1 dos parâmetros em ordem alfabética +
     secret, regra do Cloudinary) cobrindo `eager`, `eager_async`, `public_id`, `timestamp`.
  3. Responde `{ uploadUrl, fields: { api_key, timestamp, signature, public_id, eager, eager_async } }`
     (`uploadUrl` = `https://api.cloudinary.com/v1_1/<cloud>/<image|video>/upload`).
- `POST /delete` `{ storyId }`, com o token da pessoa: confere que o story é dela, apaga o arquivo no
  Cloudinary (`destroy` com `invalidate=true`) e depois a linha. 404 se não existe; 403 se não é dela.
  Falhou apagar no Cloudinary: apaga a linha mesmo assim (a limpeza das 24 h pega o arquivo).
- `POST /cleanup`, com o cabeçalho `x-cron-secret`: lista `stories/` (imagens e vídeos, paginando) pela
  Admin API e apaga em lote (até 100 por chamada) o que tem `created_at` com mais de 24 h. 401 sem o
  segredo certo.
- CORS: `https://fellasapp.pages.dev` e `http://localhost:*`; `OPTIONS` respondido.

## 3. Banco (migração `0021_stories.sql`)

Adaptada da `0011_stories.sql` da branch `feat/stories` (que nunca foi aplicada; o número 0011 continua
livre, mas a nova vai depois das existentes):

- Tabelas, RLS, tempo real e a notificação `story_reaction` (função `notifications_feed` recriada a
  partir da versão da `0010`, que é a atual na `main`) **como na 0011**, com uma mudança:
  `stories.media_url` vira **`media_id text not null`** com `check (media_id ~ '^stories/[0-9a-f]{64}$')`.
- `duration_ms` como antes (foto 5000; vídeo 1–15000).
- Limpeza das linhas: o mesmo `pg_cron` de hora em hora apagando stories com mais de 24 h.
- Limpeza dos arquivos: outro `pg_cron` de hora em hora chamando `POST /cleanup` com `pg_net`
  (`net.http_post`), lendo o segredo do **Vault** (`vault.decrypted_secrets`, nome
  `stories_cron_secret`). O segredo é gerado e guardado (Vault e segredos da função) por comando, fora
  da migração, para não ir para o git.

## 4. App

O que muda em relação à spec antiga (o resto é trazido da branch e ajustado à `main` atual):

- `lib/cloudinary.ts`: `CLOUDINARY_CLOUD_NAME` (de `EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME`),
  `storyMediaUrl(mediaId, kind)` (versão reduzida) e `storyOriginalUrl(mediaId, kind)`.
- `lib/api/stories.ts`:
  - `uploadStoryMedia(uri, kind)`: chama `/sign`, envia o arquivo ao `uploadUrl` com os campos
    (multipart), devolve `{ mediaId, durationMs }`. Foto: 5000. Vídeo: `duration` da resposta do
    Cloudinary em ms, arredondado e limitado a 15000 (o vídeo acima de 15 s já é recusado antes de
    enviar, como na spec antiga).
  - `deleteStory(id)` passa a chamar `/delete`.
  - Erros em pt-BR como antes (401/403 da função; falha de rede; recusa do Cloudinary).
- `StoryVideo`: em erro de carregamento, troca uma vez para o original.
- Foto reduzida no aparelho como no feed (`shrinkForUpload`) antes de enviar.
- Sai: `workers/stories/` e `EXPO_PUBLIC_STORIES_URL`.

## 5. Erros e bordas
- Cloudinary bloqueado (cota do mês): quando a resposta de erro do envio fala em limite/cota
  (`error.message` contendo "limit" ou "quota"), mostra "Os stories bateram o limite do mês. Volta dia 1.";
  outras recusas mostram o erro genérico. O resto do app segue normal.
- Assinatura vencida (envio demorou mais de 1 h): pede outra e tenta uma vez.
- Story apagado no banco mas arquivo ainda lá (falha no `/delete`): ninguém acha o endereço pelo app;
  some na limpeza.
- Limpeza falhou numa hora: a próxima pega.

## 6. Testes
- Regras da função (`rules.ts`): nome aleatório no formato, assinatura igual ao exemplo da documentação
  do Cloudinary, parâmetros por tipo, "passou de 24 h".
- `lib/cloudinary`: endereços da versão reduzida e do original por tipo.
- API: envio em duas etapas (assinar → Cloudinary) com os campos certos; duração do vídeo vinda do
  Cloudinary (limitada a 15000); erros 401/403/limite em pt-BR;
  `deleteStory` chama a função.
- Os testes de componentes e do player que vêm da branch, ajustados.
- Migração: `media_id` com o check; dois `cron.schedule`; segredo lido do Vault (não escrito na migração).
- Depois de publicar: postar foto e vídeo, assistir de outra conta, reagir, ver a notificação, apagar um,
  e no dia seguinte conferir que sumiu do Cloudinary e do banco.
