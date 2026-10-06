# Música no perfil (Last.fm) — design

Data: 2026-10-06 · Status: aprovado em conversa (com mockups), aguardando revisão do spec escrito

## Objetivo

Quem tem Last.fm mostra no perfil o que ouve: o que está tocando agora (no cabeçalho) e uma aba
**Música** com as músicas recentes (histórico inteiro) e os mais ouvidos (artistas, álbuns, músicas).

**Sucesso:** um fella põe o usuário do Last.fm no Editar perfil e, no perfil dele, os amigos veem a música
que está tocando e navegam pelo histórico e pelos tops por período.

### O que o Juan decidiu
- **Conectar = digitar o usuário do Last.fm** no Editar perfil. Sem login no Last.fm, **sem callback**
  (o campo "Callback URL" do formulário de API fica em branco). Só dados públicos.
- **Chave de API no app** (`EXPO_PUBLIC_LASTFM_API_KEY`), chamadas direto do app ao Last.fm. O shared
  secret não entra no projeto. (Dá pra migrar para uma Edge Function depois sem mexer nas telas.)
- **"Ouvindo agora" em linha discreta** no cabeçalho do perfil (mockup B).
- **Aba Música com sub-abas** Recentes · Artistas · Álbuns · Músicas (mockup A).
- **Retroativo:** Recentes rola até o primeiro scrobble, buscando sob demanda; nada de música no nosso banco.
- **Sem recados (shoutbox)** por enquanto: a API do Last.fm não oferece mais (`user.getShouts` saiu da
  lista oficial; a página dá 404) e um mural nosso fica para outra feature.

### Verificado
- `ws.audioscrobbler.com/2.0/` responde com `access-control-allow-origin: *`: o app web pode chamar direto.
- Métodos disponíveis: `user.getInfo`, `user.getRecentTracks` (`limit` até 200, `page`, `from`/`to`),
  `user.getTopArtists`, `user.getTopAlbums`, `user.getTopTracks` (períodos `7day`, `1month`, `3month`,
  `6month`, `12month`, `overall`).

### Fora do escopo
Recados; músicas favoritas (loved); gráficos/semanas; login com Last.fm; scrobblar pelo app.

## 1. O que aparece e onde

### Editar perfil
- Campo **"Usuário no Last.fm"** (opcional), ajuda "Pra mostrar o que você ouve no seu perfil.",
  `autoCapitalize="none"`, sem autocorreção.
- Ao salvar com o campo preenchido e diferente do atual: o app chama `user.getInfo`. Não existe →
  erro no campo "Não achamos esse usuário no Last.fm." e não salva. Sem conexão / Last.fm fora →
  "Não deu pra conferir no Last.fm agora. Tenta de novo." e não salva.
- Campo vazio desconecta (grava `null`). Formato inválido (fora de 2–15 de letras/números/`_`/`-`,
  começando por letra) → "Usuário do Last.fm inválido." sem chamar a API.

### Cabeçalho do perfil — "Ouvindo agora" (linha discreta)
- Só aparece se a pessoa tem `lastfm_user` **e** a primeira música das recentes está tocando agora
  (`@attr.nowplaying`).
- Uma linha abaixo do @: capinha (22×22, raio `sm`), barrinhas animadas (3 barras `brand`), **Música** em
  negrito e "— Artista" em `textMuted`; uma linha só, encurta com "…".
- Rótulo acessível: "Ouvindo agora: Música, de Artista". Tocar abre a aba Música.
- Atualiza ao abrir o perfil e a cada **60 s** enquanto a tela está focada; para ao sair.
- Com "reduzir movimento" do aparelho, as barras ficam paradas.
- Erro/sem chave: a linha simplesmente não aparece.

### Aba Música (`ProfileTab` ganha `'music'`)
- Só existe para quem tem `lastfm_user` (Posts · Fotos · **Música**).
- Topo: resumo "**12.430** scrobbles · desde 2019" (de `user.getInfo`: `playcount`, `registered`).
- Sub-abas (chips): **Recentes · Artistas · Álbuns · Músicas**; Recentes é a inicial.
- **Recentes:** linha com capa (40×40, raio `md`), música (bold), artista (muted) e à direita o tempo
  (`postTime`) ou "● agora" em `brand` para a que está tocando (sempre no topo). 50 por página, rolagem
  infinita até a última página.
- **Artistas / Álbuns / Músicas:** seletor de período (texto: 7 dias · **1 mês** · 3 meses · 1 ano ·
  sempre → `7day`, `1month`, `3month`, `12month`, `overall`; padrão 1 mês; o ativo em `brand`
  sublinhado). Linha: posição (muted), imagem (artista: quadrado redondo; álbum/música: capa), nome
  (bold) e, em álbum/música, o artista (muted); à direita "N plays". 50 por página, rolagem infinita.
- Tocar numa linha abre a página do item no site do Last.fm (`url` da resposta) com `Linking.openURL`.
- **Imagem de artista:** o Last.fm devolve sempre a mesma estrela genérica
  (hash `2a96cbd8b46e442fc41c2b86b821562f`). Quando a URL é essa (ou vazia), mostra a **inicial** num
  quadrado com cor determinística (como o `Avatar` sem foto). Capa vazia de álbum/música: quadrado
  `surfaceSunken` com ícone `musical-notes-outline`.
- Estados: carregando (spinner + "Buscando as músicas…"); erro ("Não deu pra falar com o Last.fm" +
  "Tentar de novo"); vazio ("Nada por aqui ainda."); perfil privado no Last.fm ("O Last.fm dessa pessoa
  está privado."); usuário não existe mais ("Esse usuário do Last.fm não existe mais."); sem chave
  configurada ("Last.fm não configurado.").

## 2. Banco (`supabase/migrations/0019_lastfm_user.sql`, idempotente)

```sql
alter table public.profiles add column if not exists lastfm_user text
  check (lastfm_user is null or lastfm_user ~ '^[A-Za-z][A-Za-z0-9_-]{1,14}$');
grant update (lastfm_user) on public.profiles to authenticated;
```
(`add column if not exists … check` só cria a checagem junto da coluna; reaplicar não duplica.)

## 3. Código

| Unidade | Faz |
|---|---|
| `lib/lastfm/types.ts` | `LastfmPeriod`, `LastfmTrack` (`name, artist, album?, image, url, playedAt: string \| null, nowPlaying`), `LastfmTopItem` (`rank, name, artist?, image, url, plays`), `LastfmUser` (`name, playcount, registeredAt`), `LastfmPage<T>` (`items, page, totalPages`), `LastfmErrorKind` |
| `lib/lastfm/map.ts` | puro: `pickImage(images)` (maior não vazia; estrela genérica → `null`), `mapRecentTracks`, `mapTopArtists/Albums/Tracks`, `mapUserInfo`, `isValidLastfmUser`, `PERIODS` (rótulo ↔ valor) |
| `lib/lastfm/api.ts` | `lastfmGet(method, params)` (base, `api_key`, `format=json`; erro do Last.fm → `LastfmError` com `kind`: `not_found` (6), `private` (17), `rate_limit` (29), `network`, `no_key`, `other`); `getUserInfo`, `getRecentTracks(user, page)`, `getTopArtists/Albums/Tracks(user, period, page)` |
| `lib/lastfm/useNowPlaying.ts` | música atual (ou `null`), busca ao focar e a cada 60 s; para ao desfocar |
| `lib/lastfm/useLastfmPages.ts` | lista paginada genérica: `items, loading, error, loadMore, reload`; troca de chave (sub-aba/período) recomeça; resposta atrasada ignorada |
| `components/music/NowPlayingLine.tsx` | linha discreta + barras animadas (respeita reduzir movimento) |
| `components/music/MusicTab.tsx` | resumo, chips, seletor de período, listas e estados |
| `components/music/TrackRow.tsx`, `TopRow.tsx`, `ArtistTile.tsx` | linhas e a imagem/inicial |
| `components/profile/ProfileHeader.tsx` | `NowPlayingLine` abaixo do @ (só com `lastfm_user`) |
| `components/ProfileView.tsx` | aba `music` quando há `lastfm_user`; tocar no "ouvindo agora" troca para ela |
| `app/profile/edit.tsx` + `lib/api/profiles.ts` | campo e `lastfm_user` em `updateMyProfile` (vazio → `null`) |
| `types/database.ts`, `supabase/README.md`, `.env.example` | coluna; linha da 0019; `EXPO_PUBLIC_LASTFM_API_KEY=` |

Tokens de `lib/theme.ts` e `components/ui`; Impeccable (modo Operate); copy no tom do `PRODUCT.md`.

## 4. Erros

| Situação | O que a pessoa vê |
|---|---|
| Sem `EXPO_PUBLIC_LASTFM_API_KEY` | Aba: "Last.fm não configurado."; sem "ouvindo agora"; Editar perfil salva sem conferir |
| Usuário não existe (erro 6) | Editar: erro no campo; Aba: "Esse usuário do Last.fm não existe mais." |
| Perfil privado (erro 17) | Aba: "O Last.fm dessa pessoa está privado." |
| Limite de pedidos (29) / Last.fm fora / sem rede | Aba: erro com "Tentar de novo"; "ouvindo agora" some |
| Fim do histórico | Rolagem para (sem spinner) |

## 5. Testes
- `map`: imagem maior não vazia; estrela genérica e vazia → `null`; `nowplaying` vira `nowPlaying` sem
  data; data do scrobble (`uts`) em ISO; ranks e plays como número; `isValidLastfmUser`.
- `api`: monta URL com método, usuário, período, página, `limit=50`, `api_key`, `format=json`; erro 6/17/29
  vira `kind`; sem chave → `no_key` sem chamar.
- `useLastfmPages`: primeira página, `loadMore` até `totalPages`, troca de período recomeça e ignora a
  resposta atrasada.
- `useNowPlaying`: busca ao montar, de novo após 60 s, para ao desmontar/desfocar.
- `NowPlayingLine`: aparece tocando, some parado; rótulo acessível.
- `MusicTab`: resumo; troca de sub-aba e período chama o certo; estados (privado, não existe, erro + tentar).
- Editar perfil: usuário válido salva; inexistente mostra erro e não salva; vazio grava `null`.
- Perfil: aba Música só com `lastfm_user`.
- `npx tsc --noEmit` e `npm test` passam.
