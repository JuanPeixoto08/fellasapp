# Compartilhar post no story — design

Data: 2026-10-09 · Status: aprovado em conversa (mockups no companion visual: direção "Recorte", fundos e fluxo v2)

## Objetivo

Um botão no post que monta uma imagem de story 9:16 bonita a partir dele e manda para o **story do
Instagram** (pela planilha de compartilhar do celular) ou para o **story do próprio Fellas**. O Twitter não
tem isso; aqui é o "zine de amigos" levado pro story.

**Sucesso:** no feed, tocar no ícone de compartilhar abre o montador com a prévia do story; trocar o fundo
muda a prévia na hora; "Instagram" abre a planilha do celular com a imagem pronta (no PC baixa o arquivo);
"Story do Fellas" posta e quem assiste vê "Ver post", que abre o post original.

### O que o Juan decidiu
- **Qualquer post, nos dois destinos.** Dá para compartilhar post de qualquer fella, no Insta e no Fellas,
  sem aviso ao autor.
- **Direção "Recorte":** o post vira um recorte de papel colado com duas fitas, meio torto (−2,2°), sobre o
  fundo, com a marca FELLAS embaixo.
- **Montador com prévia + poucos fundos** (sem mover/aumentar o card, sem ligar/desligar partes).
- **Fundos: a própria foto, violeta, tinta, vermelho, papel.** Padrão: a foto do post (desfocada) quando ele
  tem foto; senão violeta. A retícula ficou de fora; sem cor livre.
- **Story do Fellas ligado ao post:** quem assiste vê "Ver post", que abre `/post/<id>`.
- **Palco escuro** no montador (igual ao "Ajustar foto"); no computador, janela no meio da tela.

### Fora do escopo
Cor livre / seletor de cor; mover ou redimensionar o recorte; vídeo/story animado; adesivo de link do
Instagram (a planilha de compartilhar não leva link); aviso ao autor; compartilhar comentário ou perfil;
build nativo (o botão só aparece na web/PWA/APK TWA, que é o que todo mundo usa).

## 1. Banco (migração `0032_story_post_link.sql`)

- `alter table public.stories add column if not exists post_id uuid references public.posts (id) on delete set null;`
  Post apagado: o story continua (a imagem já é dele), só perde o "Ver post".
- Sem mudança de RLS: a política de insert dos stories já exige o próprio `author_id` e ser membro; todo
  membro lê qualquer post, então não precisa conferir o post no banco.
- Idempotente, como as outras migrações. O Juan roda o `db push` (conferir colunas antes do push na main).

## 2. App

### Dados (`lib/api/stories.ts`)
- `Story.postId: string | null`; `listActiveStories` passa a ler `post_id`.
- `createStory({ kind, mediaId, durationMs, postId? })` grava `post_id` quando vem.
- Envio reaproveita `uploadStoryMedia(uri, 'photo')` com um object URL do JPEG gerado (na web ele já faz
  `fetch(uri).blob()`); duração `STORY_PHOTO_MS`. Depois `emitStoriesChanged()`, como o `StoryComposer`.

### A imagem (`lib/storyCard/`, só web)
Desenhada num `<canvas>` de **1080 × 1920**, sem dependência nova. Separada em partes puras (testáveis) e
desenho:

- `layout.ts` (puro): recebe o post e uma função `measure(text, font) → largura` e devolve o layout em
  pixels — linhas do texto já quebradas, tamanho da letra, posição de cada bloco, altura do recorte,
  "+N", corte com "…". Nada de DOM aqui.
- `contrast.ts` (puro): dado o fundo, escolhe tinta ou papel para a marca FELLAS e para a fita (luminância
  relativa; para o fundo "foto" vale o escurecido por cima, então papel).
- `draw.ts`: carrega fontes e imagens, aplica o layout no canvas e devolve `Blob` JPEG (qualidade 0,92).
- `share.ts`: `shareImage(blob)` — `navigator.canShare({ files })` → `navigator.share({ files: [File] })`;
  cancelar (`AbortError`) não é erro; sem suporte, baixa o arquivo (`fellas-story.jpg`).

**Geometria (em px da imagem):**
- Faixas reservadas do Instagram: topo 250 e base 340 ficam sem conteúdo importante.
- Recorte: margem lateral 104, centrado na vertical um pouco acima do meio (−5% da altura do recorte),
  girado −2,2°, papel `#F4F1EA`, padding 60, sombra suave (offset 0,28 · blur 72 · preto 30%). Duas fitas
  (248 × 68, papel 62%) nos cantos de cima, a −28° e +24°.
- Fundo papel: recorte branco `#FFFFFF` e sombra mais leve (é o único fundo claro).
- Marca FELLAS: o mesmo desenho de `components/ui/Logo.tsx` (o path sai para `lib/logoPath.ts` e os dois usam), altura 48, centrada, a
  384 da base, cor do `contrast.ts`.
- Cabeçalho no recorte: avatar 120 (foto em círculo, ou iniciais com as cores do `Avatar`: `avatarPalette` + `avatarInk`),
  nome Golos Bold 50, "@usuario · há 2 h" Golos Regular 42 a 62% (mesmo `postTime` do app), local (quando
  tem) em linha abaixo com o ícone de local.

**Conteúdo do recorte (nesta ordem, como no post):**
- **Texto:** Golos Regular, entrelinha 1,4. Até 80 caracteres e sem anexo: 72 px (cara de cartaz). Normal:
  54 px. Não cabe: desce de 2 em 2 até 40 px; ainda não cabe: corta na última linha que cabe com "…".
  `@menção` e `#tag` em `brand` (Golos SemiBold), mesmo reconhecimento do `MentionText`. Emoji fica o do
  aparelho (igual ao texto do app).
- **Enquete:** uma linha por opção (altura 132), barra `surfaceSunken` atrás com a porcentagem do momento
  (opção mais votada em `brandSoft`, negrito), porcentagem à direita; embaixo "N votos" ou "Resultado final".
  Sem ✓ do meu voto (a imagem é de quem compartilha, não importa o voto dele).
- **Ingresso:** versão mini dentro do recorte: música = capa quadrada 200 + nome (bold, 2 linhas) + artista;
  filme = pôster 2:3 de 200 de largura + título (bold) + ano + estrelas (e coração quando tem). Sem a review
  nem o vinil girando.
- **Fotos:** só a primeira, largura do recorte, proporção original limitada entre 4:5 e 16:9 e altura até 600
  (corta ao centro), raio 24. Mais de uma: selo "+N" (pílula `overlay` + `onOverlay`) no canto de baixo à direita. GIF
  entra parado (o quadro que o navegador tiver).
- Altura máxima do recorte: o que cabe entre as faixas reservadas (1920 − 250 − 340 − espaço da marca). O
  texto é o que encolhe/corta; foto, enquete e ingresso têm tamanho fixo.

**Fundos:**
| Fundo | Cor | Quando |
|---|---|---|
| Foto | primeira foto do post, `cover`, blur 40 + preto 38% por cima | só post com foto; padrão quando existe |
| Violeta | `#5B3FD9` (`brand` claro) | padrão sem foto |
| Tinta | `#121212` | sempre |
| Vermelho | `#C81E3A` (`like` claro) | sempre |
| Papel | `#EAE5D8` (`surfaceSunken` claro) | sempre |

As cores da imagem são fixas (não seguem o tema do aparelho): ficam num token novo `storyCard` em
`lib/theme.ts` (fundos, papel do recorte, fita, sombra, medidas acima), sem hex solto em tela.

**Fontes e imagens:** antes de desenhar, `document.fonts.load` dos pesos da Golos usados (mesmas famílias
registradas pelo `expo-font`). Imagens com `crossOrigin = 'anonymous'` (Supabase Storage e Cloudinary
liberam CORS; Last.fm/Letterboxd: imagem sem CORS nem carrega com `crossOrigin`, então a capa/pôster
sai e entra um quadrado `surfaceSunken` — sem ícone, o canvas não desenha Ionicons). Foto do post que não carrega: sai do recorte e o fundo "foto" some das bolinhas.
Avatar que não carrega: iniciais.

### Montador (`components/share/StoryShareDialog.tsx`)
- Modal: tela cheia no celular (tier compact), janela no meio no computador (largura 340, altura até a da
  janela menos margem), palco `viewerBg`, texto `onOverlay`.
- Topo: ✕ (`IconButton` ghost `onOverlay`) + "Compartilhar no story".
- Meio: a prévia é a própria imagem gerada (`<Image>` do object URL), 9:16, raio `lg`, maior que couber.
  Enquanto desenha: o quadro em `overlay` com um spinner. Trocar o fundo redesenha (o layout fica em cache;
  só o fundo e as cores da marca/fita mudam).
- Bolinhas de fundo: 30 pt de diâmetro, toque de 44, anel `brand` (escuro) na escolhida, rótulo acessível
  com o nome do fundo ("Fundo violeta"…); a da foto mostra a própria foto.
- Botões (`Button` ganha `icon` e as variantes `overlay` — fundo `onOverlay`, texto `viewerBg` — e
  `overlayOutline` — fio e texto `onOverlay` —, para o palco escuro): à esquerda `overlayOutline` "Instagram" (ícone `logo-instagram`) — vira "Baixar imagem"
  (`download-outline`) onde `navigator.canShare({ files })` é falso; à direita `overlay` "Story do Fellas"
  (`add-circle-outline`) com loading enquanto sobe.
- A imagem de cada fundo já fica pronta (Blob) quando a prévia aparece: o toque em "Instagram" chama
  `navigator.share` na hora (o Safari do iPhone só deixa compartilhar dentro do toque, sem espera antes).
- Sucesso no Fellas: o botão mostra "Foi pro seu story" por ~1,2 s e o montador fecha. Erro: texto em
  `danger` acima dos botões — `StoryUploadError` traz a mensagem pronta; o resto passa pelo `friendlyError(e,
  'Não rolou postar o story. Tenta de novo.')`. Erro ao gerar a imagem: "Não rolou montar a imagem. Tenta de
  novo." com o botão de tentar de novo no lugar da prévia.
- Esc fecha no computador; respeita "reduzir movimento" (sem animação de entrada).

### Botão no post (`components/feed/ShareButton.tsx`)
- `ActionButton` (sem número) com `Icon` `share-outline`, rótulo "Compartilhar no story", entre o espaçador e o
  reagir em `PostCard` (ícone muted, igual aos outros da fila). Só aparece com `Platform.OS === 'web'`.
- Abre o `StoryShareDialog` fora da linha tocável (como o `PhotoViewer`, para o toque não abrir o post).

### "Ver post" no story (`components/stories/StoryViewer.tsx`)
- Story com `postId`: pílula "Ver post" (`arrow-forward-outline`) centrada embaixo, altura 44, fundo
  `overlay`, fio `onOverlay` 40%, texto `onOverlay` SemiBold. Toque: fecha o viewer e `router.push('/post/<id>')`.
- A pílula não conta como toque de "passar/voltar" e segurar nela não pausa.
- No meu próprio story, convive com "Visto por N" (a pílula fica acima dele).

## 3. Testes
- `__tests__/storyCardLayout.test.ts`: com `measure` falso (largura = n.º de caracteres × k), confere quebra
  de linha, 72 px para texto curto sem anexo, descida até 40 px, corte com "…", "+N" com 2–4 fotos,
  altura do recorte dentro das faixas, menções/tags marcadas.
- `__tests__/storyCardContrast.test.ts`: tinta sobre papel, papel sobre violeta/tinta/vermelho/foto.
- `__tests__/storyPostLinkMigration.test.ts`: coluna `post_id` com `references public.posts` e
  `on delete set null`, idempotente (`if not exists`).
- `storiesApi.test.ts` (existente): `createStory` com e sem `postId`; `listActiveStories` devolve
  `postId`.
- `PostCard.test.tsx`: botão "Compartilhar no story" na web, ausente fora da web; toque abre o montador sem
  abrir o post.
- `__tests__/storyShareDialog.test.tsx`: com `draw`/`share`/`uploadStoryMedia` falsos — fundo padrão (foto vs violeta), bolinha
  da foto só com foto, "Baixar imagem" sem `canShare`, sucesso fecha, erro mostra a mensagem.
- `storyViewer.test.tsx` (existente): "Ver post" só com `postId`, toque fecha e navega.
- O desenho no canvas não tem teste automático (jsdom não desenha): conferência visual no navegador e a real
  no celular (Insta no Android) fica com o Juan.
- `npx tsc --noEmit` e `npm test` passando.

## 4. Docs
- `DESIGN.md`: seção "Compartilhar no story" (recorte, fundos, montador, "Ver post") e o token `storyCard`.
