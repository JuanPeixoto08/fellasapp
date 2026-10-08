# O que aparece no perfil (selos e "ouvindo agora" no feed) — design

Data: 2026-10-07 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

O Editar perfil ganha uma seção **"O que aparece no perfil"** com chaves liga/desliga: uma para cada selo
que a pessoa ganhou e uma para mostrar o que ela está ouvindo. E o "ouvindo agora" passa a aparecer também
**nos posts**, ao lado do nome, ao vivo.

**Sucesso:** um fella com Last.fm conectado posta; no feed, ao lado do nome e do selo dele, aparece
"ouvindo **Música**" enquanto ele estiver ouvindo algo. Ele desliga a chave no Editar perfil e a música some
dos posts e do perfil. Quem tem selo pode escondê-lo, e ele some de todo lugar.

### O que o Juan decidiu
- **Selos: escolher quais aparecem.** Cada selo que a pessoa tem vira uma chave. Dar ou tirar selo continua
  só pelo banco (SQL), como hoje. Hoje só existe o `verified`.
- **Música nos posts, igual ao print:** logo depois do nome e do selo, na mesma linha do cabeçalho do post.
- **Ao vivo:** mostra o que o autor ouve **agora**, em todos os posts dele (inclusive os antigos). Muda quando
  a música muda e some quando para. Nada de música fica salvo no post.
- **A chave "Mostrar o que estou ouvindo" desligada esconde** a música nos posts **e** a linha do cabeçalho
  do perfil. A aba Música (histórico e tops) continua.
- **Armazenamento: uma coluna por opção** (abordagem A). Opções futuras entram como novas linhas da seção e
  novas colunas.

### Fora do escopo
Novos tipos de selo; dar selo pelo app; música em comentários; música salva no post; esconder a aba Música.

## 1. Banco (migração `0023_profile_display.sql`)

```sql
alter table public.profiles
  add column if not exists show_now_playing boolean not null default true,
  add column if not exists hidden_badges text[] not null default '{}';
grant update (show_now_playing, hidden_badges) on public.profiles to authenticated;
```

- `hidden_badges` guarda os selos **escondidos**, não os mostrados: selo novo dado pelo banco já aparece sem a
  pessoa fazer nada.
- Sem check contra `badges`: se o banco tirar um selo, um `hidden_badges` antigo com ele não quebra nada (a
  conta é sempre `badges − hidden_badges`).
- RLS não muda: a política de update já é só da própria linha; o grant por coluna libera só esses dois campos.
- `types/database.ts` ganha as duas colunas (e o perfil falso de `lib/auth/devFakeLogin.ts`).

## 2. Selos visíveis

- `lib/badges.ts` ganha `visibleBadges(badges, hidden)` → `badges` sem os de `hidden` (os dois podem faltar).
  Também ganha `BADGE_LABELS: Record<Badge, string>` (`verified` → "Selo de verificado") para a seção do
  Editar perfil; selo sem rótulo conhecido não vira chave.
- O `Author` dos posts/comentários passa a trazer `hidden_badges`, `lastfm_user` e `show_now_playing`
  (`AUTHOR_COLUMNS` em `lib/api/posts.ts`). Listas de membros já leem `*`.
- Quem desenha o selo usa `visibleBadges`: `NameWithBadge` recebe `hiddenBadges` e os chamadores
  (`PostCard`, `CommentItem`, `MemberRow`, `RightRail`) passam o campo; `ProfileHeader` usa
  `visibleBadges(profile.badges, profile.hidden_badges)`.

## 3. Editar perfil: seção "O que aparece no perfil"

- Fica depois do campo do Last.fm e antes do Aniversário. Título de seção + linhas.
- Cada linha: rótulo, uma linha de ajuda e uma chave (`Switch`, primitivo novo em `components/ui`, com tokens
  do tema, `accessibilityRole="switch"` e o rótulo como nome acessível).
- **"Mostrar o que estou ouvindo"** — ajuda "Aparece do lado do seu nome nos posts e no seu perfil."
  Sem usuário do Last.fm no campo acima: chave desabilitada e ajuda "Conecte o Last.fm acima pra usar."
  (o valor salvo não muda).
- **Uma linha por selo que a pessoa tem** (ex.: "Selo de verificado", ajuda "Aparece do lado do seu nome.").
  Sem selos, essas linhas não aparecem.
- As chaves entram no mesmo Salvar: `updateMyProfile` aceita `show_now_playing` e `hidden_badges`
  (o app só manda selos que a pessoa tem). Sair sem salvar não muda nada, como os outros campos.

## 4. "Ouvindo agora" nos posts

- Componente novo `components/music/PostNowPlaying.tsx`, no cabeçalho do `PostCard`, na mesma linha, logo
  depois do `NameWithBadge` (antes do horário).
- Visual compacto: as barrinhas do equalizador (as mesmas do `NowPlayingLine`, em tamanho pequeno) +
  "ouvindo **Música**" em texto pequeno e cor secundária, numa linha só. A música encurta com "…"; o nome
  tem prioridade de espaço (a música encolhe primeiro).
- Aparece só se: o autor tem `lastfm_user`, `show_now_playing` é true, a chave de API do Last.fm existe e há
  algo tocando. Senão, não ocupa espaço.
- Tocar abre a aba **Música** do perfil do autor (`/@usuario?aba=musica`). Em posts dentro do perfil da
  própria pessoa (onde o nome já não é link), não é tocável.
- Acessível: rótulo "Ouvindo Música, de Artista".

### Abrir o perfil na aba Música
- `openProfile(username, { tab: 'music' })` empurra `/@usuario?aba=musica`. A tela `[handle]` e a aba
  Perfil (`/profile`, para o meu @) repassam `aba` como `initialTab` ao `ProfileView`. Valor desconhecido →
  Posts. A regra que já existe (sem Last.fm, Música volta para Posts) continua valendo.

## 5. Cache compartilhado do "ouvindo agora"

- `lib/lastfm/nowPlayingStore.ts`: um cache por usuário do Last.fm com assinantes. Enquanto houver pelo menos
  um assinante para um usuário, pergunta ao Last.fm a cada `NOW_PLAYING_MS` (60 s); sem assinantes, para.
  Dez posts do mesmo autor = uma chamada por minuto.
- Hook `useNowPlaying(user)` passa a usar o cache (mesma assinatura de hoje), mantendo "só com a tela
  focada": assina no foco, cancela ao sair. Assim o `NowPlayingLine` do perfil e os posts dividem o mesmo
  dado.
- A lista do feed já é virtualizada: só os posts montados assinam.
- Erro ou falta de chave → `null` (nada aparece), sem mensagem.
- `ProfileHeader` só mostra o `NowPlayingLine` se `show_now_playing` for true.

## 6. Testes

- `visibleBadges`: sem escondidos, com escondido, campos faltando.
- `nowPlayingStore`: uma chamada para vários assinantes do mesmo usuário; para de perguntar sem assinantes;
  erro vira null.
- `Switch`: liga/desliga, desabilitado não muda, papel e rótulo acessíveis.
- Editar perfil: as chaves aparecem (selo só para quem tem; música desabilitada sem Last.fm) e o Salvar manda
  `show_now_playing` e `hidden_badges`.
- `PostCard`: com música tocando mostra "ouvindo …"; sem Last.fm, com chave desligada ou sem nada tocando,
  não mostra; selo escondido não aparece.
- `ProfileHeader`: chave desligada esconde a linha; selo escondido some.
- Rota: `/@usuario?aba=musica` abre na aba Música.
