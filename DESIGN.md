# DESIGN — fellasapp

Mundo visual: **"Zine de amigos"** — escolhido pelo Juan numa página de comparação aberta no Chrome (5 opções claro/escuro). Papel de jornal off-white e tinta preta, monocromático: a cor vem das fotos dos fellas, do coração curtido e do `brand` na navegação. Interface sóbria, personalidade na voz. (O marca-texto amarelo original saiu em out/2026: o Juan achou brega.) Tokens em `lib/theme.ts`; primitivos em `components/ui/`. Telas não usam valores soltos.

## Cor
Neutros quentes de papel/tinta, nunca cinza puro. O acento é um neutro aquecido que inverte com o tema; ação principal é tinta (preto no claro, papel no escuro).

| Papel | Claro | Escuro |
|---|---|---|
| bg | `#F4F1EA` | `#121212` |
| surface | `#FFFFFF` | `#1D1D1D` |
| surfaceSunken | `#EAE5D8` | `#0B0B0B` |
| text | `#121212` | `#F4F1EA` |
| textMuted | `#5E5A52` | `#A8A398` |
| border | `#DAD5C8` | `#333333` |
| primary (tinta) | `#121212` | `#F4F1EA` |
| onPrimary | `#F4F1EA` | `#121212` |
| accent (neutro) | `#2E2B26` | `#E0DCD3` |
| onAccent | `#F4F1EA` | `#121212` |
| like (coração) | `#C81E3A` | `#FF5A6E` |
| danger | `#B3261E` | `#FF8A80` |
| success | `#2E7D4F` | `#7BD9A0` |

Accent aparece sempre **invertido** (preenchimento `accent` + texto `onAccent`): minha reação, emoji escolhido no seletor, grifo `<Text highlight>`. Sem amarelo em lugar nenhum. `like` só no coração curtido e no número dele; `verified` (mesmo vermelho) só no selo de verificado; vermelho de erro continua `danger`. Avatares sem foto usam tons de papel/pastel com tinta.

### Brand
`brand` (violeta `#5B3FD9` claro / `#B8A2FF` escuro) é o tint ativo da tab bar e destaques de UI sobre papel, com contraste ≥ 4.5:1 no `bg`. `brandSoft` (`#E6DFFB` claro / `#2B2347` escuro) é o fundo roxo suave do chip da minha reação.

## Tipografia
- **Marca: "FELLAS" na Galaxia** (Mocha Frappuccino). Só a palavra, como desenho vetorial em `components/ui/Logo.tsx` (topo do feed, login, carregamento). A licença da fonte é pessoal: o arquivo da fonte **nunca** entra no projeto, só o contorno já desenhado. Cor = tinta do tema.
- **Todo o resto: Golos Text** (Regular/Medium/SemiBold/Bold), licença aberta (OFL). Substituiu Inter + Instrument Serif em out/2026 (a TT Interphases Pro, preferida, é paga).
- Títulos em sans: hierarquia por tamanho + peso e tracking levemente negativo. display 48/700 · headline 32/700 · title 24/600.
- Escala (pt): caption 12 · small 14 · body 16 · lead 18 · title 24 · headline 32 · display 48. Respeita escala de fonte do sistema.
- Carregadas via `expo-font` em `app/_layout.tsx`.

## Espaçamento e forma
- Grade de 4: 4 · 8 · 12 · 16 · 24 · 32 · 48. Mais espaço acima de títulos que abaixo; grupos internos apertados (8), seções soltas (24+).
- Raios: sm 4 · md 8 · lg 12 · pill 999. Avatares circulares; botões e campos md; cartões lg.
- Gutter de tela 16; conteúdo web limitado a 640 de largura, centralizado.
- Alvo de toque mínimo 44.

## Profundidade
Pouca sombra: cartão usa borda 1px + sombra suave com offset (0,2) e blur 8, opacidade baixa. Nada de sombras duras ou halos. No escuro, profundidade vem de superfície mais clara, não de sombra.

## Motion
Um momento autoral: o botão "afunda" (escala 0.97) ao toque, com retorno rápido ease-out (≈120ms). Entradas de lista 180ms ease-out exponencial. Respeita reduzir movimento. Nada de bounce decorativo.

## Componentes (components/ui)
Screen · Text/Heading · Button (primary, secondary, ghost, danger; loading/disabled) · Select (lista suspensa como no Twitter: campo com contorno `border`, raio `md`, rótulo `caption` `textMuted` em cima, valor embaixo e `chevron-down`; tocar abre a lista presa ao campo — embaixo, ou em cima sem espaço —, `surface` com fio, raio `md`, sombra `raised`, até 6 linhas de `ChoiceRow` rolando) · ChoiceRow (escolha única em lista de configuração: papel radio, altura 44, fundo `surfaceSunken` no toque/hover, ✓ `brand` e nome em negrito na escolhida) · Switch/SwitchRow (chave do sistema — iOS, Android e web — com trilho `brand` ligada, `border` desligada e bolinha `switchThumb`; a linha tem rótulo, ajuda `small` `textMuted` e a chave à direita, altura mínima 44; desabilitada fica a 0.5 e o rótulo em `textMuted`) · TextField (label, erro, ajuda) · Avatar (foto ou iniciais em cor determinística; tamanhos `avatarSizes` sm 32 · md 40 · lg 56 · xl 88) · Card · EmptyState · Divider · Icon · IconButton (só ícone, 44pt, outline ou ghost, rótulo acessível obrigatório) · Tabs (abas de seção com traço `brand` sob a ativa) · ConfirmDialog (confirmação de ação destrutiva; botão `danger`, cancelar "Deixa quieto", erro dentro do diálogo).

### Post (feed, perfil, tela do post)
Sem caixa: nada de cartão com borda/sombra. O post fica direto no papel e as listas separam com `Divider` de ponta a ponta. Avatar `md` numa coluna; na outra, nome (bold) + selo + "ouvindo **Música**" (`PostNowPlaying`: barrinhas do equalizador em `brand` + `caption` `textMuted` com a música em negrito na cor do texto, uma linha, encolhe antes do nome; ao vivo, só com música tocando e a chave do autor ligada; toque abre `/@usuario?aba=musica`) + data à direita, local (quando tem) logo abaixo do nome — `location-outline` `sm` + `caption` `textMuted`, uma linha, toque abre `/place/<chave>` com os posts do local (página no molde da tag) —, texto, ingresso (`PostTicket`: a sua review do Letterboxd ou a música, congelada no post — contorno `border` raio `lg` juntando tudo; dentro, um canhoto de cinema em `surface` desenhado em SVG com os dois recortes redondos de verdade e picote tracejado `border` (medidas `layout.ticket`): pôster 2:3 no canhoto (sem imagem: ícone `film-outline`), rótulo do bilhete em `caption` maiúsculo ("Sessão · 30 dez 2025"), título `lead` negrito, ano · revi em `textMuted`, estrelas na cor do texto (meia estrela) e coração em `like`; embaixo a review em 4 linhas + "mais" e "Abrir no Letterboxd"; review marcada com spoiler no Letterboxd fica borrada com o botão "Pode ter spoiler · toque pra ler". Música não é ingresso, é vinil: a capa quadrada (raio `sm`) com o disco saindo dela pela direita — disco `vinyl` com sulcos `vinylGroove`, o selo do meio é a própria capa redonda, medidas `layout.vinyl`, sombra `card` —; o disco gira sempre (uma volta em `spinMs`, parado só com "reduzir movimento"); tocando agora, o rótulo leva as barrinhas do equalizador ("Tocando agora"; anexada depois, "Ouvi"); ao lado, música `lead` negrito em 2 linhas, artista `small` `textMuted`, álbum `caption`; sem capa: capa `surfaceSunken` com `musical-notes-outline` e selo `brand`; embaixo "Abrir no Last.fm"; com música anexada, a linha ao vivo do cabeçalho some), enquete (`PostPoll`: uma linha de 44 por opção com a barra da porcentagem atrás — `surfaceSunken`, a minha `brandSoft` com ✓ `brand` e negrito —, porcentagem à direita, sempre visível; dá pra votar = contorno `border` e toque vota na hora, definitivo; embaixo "N votos · faltam 2 dias" ou "Resultado final", com as mais votadas em negrito), fotos (`PostImages`: 1 na proporção original limitada por `mediaAspect`, 2–4 em grade como no Twitter, raio `lg`), chips de reação e a fila de ações: ♡ e 💬 como ícone + número (zero não aparece), carinha de reagir isolada à direita — vira o meu emoji quando já reagi. Chips de reação mínimos (altura `chipHeight`, contorno fino; o meu com fundo `brandSoft`, borda `brand` e número em negrito na cor do texto — o creme invertido de antes apagava os emojis amarelos no escuro). Comentários seguem o mesmo desenho, com a carinha ao lado do texto. Comentário leva até 4 imagens (foto ou GIF), abaixo do texto em `PostImages` limitado a `commentMediaWidth`; toque abre o `PhotoViewer`. No campo de comentar: botão `image-outline` (ghost) antes do enviar, Ctrl+V cola na web, e as escolhidas aparecem acima do campo em `ImageThumbs` (lado `commentThumb`, ✕ no canto com toque de 44 — o mesmo primitivo das fotos do compositor). Só imagem, sem texto, já pode enviar.

### Reações e fotos
- Emojis de reação são desenhados pelo app (`<Emoji>`, Twemoji; tamanhos `emojiSizes` sm 16 chip · md 20 botão · lg 28 barra/seletor), iguais em qualquer aparelho; sem imagem, cai no emoji do aparelho. Emoji dentro do texto escrito continua o do aparelho.
- Barra rápida (pílula com os 6 de `QUICK_REACTIONS` + "+"), presa ao botão de reagir (acima; sem espaço, embaixo; `placePopover`), sem escurecer a tela: se a minha reação não é um dos 6, ela entra primeiro, invertida, para dar pra remover. O "+" abre o `EmojiPicker`: no celular, folha que sobe de baixo (`sheetHeightRatio`); no computador, painel de 400 × `emojiPanelHeight` preso ao botão, conteúdo rolando por dentro; busca em pt (dados `emojibase-data` carregados só ao abrir), Recentes (no aparelho) e categorias com ícones desenhados (nunca emoji como ícone).
- Até 4 fotos por post. Em qualquer lista (feed, perfil, tag, local) e no post, toque na foto abre o `PhotoViewer`; o resto da linha (texto, vãos, 💬) é que abre o post (fundo `viewerBg`, "1/3", ✕; setas só na web). Controles sobre foto usam `overlay` + `onOverlay`. Na aba Fotos, um quadradinho por post, com ícone de "várias" quando tem mais de uma.

### Perfil
Cabeçalho estilo Twitter (out/2026, substitui o compacto): banner 3:1 (`layout.bannerAspect`) de ponta a ponta no topo; sem banner, faixa lisa `surfaceSunken` do mesmo tamanho (o layout não pula). Avatar `xl` com anel `borders.selected` na cor `bg`, metade sobre a borda de baixo do banner; ações como IconButton à direita, na base do avatar (só no meu perfil). Nome (title) e @usuário logo abaixo. O "ouvindo agora" do cabeçalho e o dos posts dividem o mesmo dado (`lib/lastfm/nowPlayingStore`, uma pergunta por minuto por fella) e somem com a chave desligada. Status num chip neutro (`surfaceSunken` + texto). Sem cor por fella: a "cor de perfil" (paleta + seletor) saiu em out/2026 porque não encaixava no zine. Tocar na foto ou no banner abre a imagem maior (`PhotoViewer`). O endereço do perfil é `/@usuario` (`/user/<id>` antigo redireciona). GIF na foto de perfil pula o ajuste e sobe como está (até 5 MB, `lib/profileImage`). Foto de perfil passa pelo "Ajustar foto" (`components/profile/AvatarCropper`): palco `viewerBg`, círculo com fio `onOverlay` e o resto escurecido com `overlay`, arrastar + zoom 1–4x (pinça, roda, botões − / +); tela cheia no celular, janela `maxDialogWidth` no computador; sai 512×512 JPEG. O banner usa a mesma tela com retângulo 3:1 ("Ajustar banner") e sai 1500×500 JPEG; em Editar perfil fica no topo, prévia com raio `md`, "Escolher/Trocar banner" e "Tirar banner". Ainda no Editar perfil, depois do Last.fm, a seção "O que aparece no perfil" (`Heading` 3 + `SwitchRow`s): "Mostrar o que estou ouvindo" (desabilitada sem Last.fm) e, para quem tem selo, "Selo do lado do nome": uma `ChoiceRow` por selo (o desenho do selo, o nome, ✓ `brand` no escolhido). Selo não se esconde, se escolhe (`featured_badge`; sem escolha, o primeiro que a pessoa tem). Opções novas entram como mais uma linha. Números entre fios finos (sem bloco de cor). Abas Posts (cards iguais ao feed, um embaixo do outro) e Fotos (grade de 3, toque abre o post). Sem arco-íris na grade. Todos com estados disabled/erro/loading onde fizer sentido, `accessibilityRole` e labels.

### Stories
- Faixa no topo do feed (`StoriesBar`): bolinhas de `Avatar` `lg` com anel `borders.selected` — `brand` = tem story não visto, `border` = já vi tudo —, nome embaixo em uma linha, rolagem horizontal com gutter. A minha vem primeiro; "+" num círculo `brand` (`onBrand`, fio `bg`) posta outro, e sem story ativo a bolinha inteira posta.
- Story aberto (`StoryViewer`): fundo `viewerBg`; barrinhas de progresso por story no topo (trilho `overlay`, preenchimento `onOverlay`), depois avatar, nome e `postTime`, pausar (⏸/▶, fica pausado até tocar de novo), som e ✕ (`onOverlay`). Foto fica 5 s, vídeo até 15 s; toque nas laterais passa/volta, segurar pausa só enquanto segura, deslizar para baixo fecha. Mídia que não é em pé ganha atrás a mesma imagem desfocada (`storyBackdropBlur`) com `overlay`. Na web, `data-no-select`: segurar não seleciona nem abre o menu de copiar/salvar. No computador, passar o mouse (ou o foco do teclado) no 🔊 abre ao lado a barra de volume (`Slider` `onOverlay`, medidas `slider`, toque de 44; setas do teclado andam 10%): tocar no 🔊 continua ligando/desligando o som, arrastar até o 0 é o mudo (religar volta no volume de antes do arraste) e o volume fica guardado no aparelho. No celular não tem barra: vale o volume do aparelho.
- Celular: tela cheia. Computador (`carouselLayout`): o story num quadro 9:16 (`storyAspect`) sempre no meio, altura da janela menos margem, raio `lg`; as outras pessoas em cartões (`StoryCarouselCard`, altura `storySideScale` do quadro, gap `xxxl`) com miniatura escurecida (`overlay`), foto com anel, nome e horário — antes à esquerda, depois à direita, quantos couberem (no primeiro da fila a esquerda fica vazia); setas ‹ › em círculo `overlay` ao lado do quadro e ✕ no canto da janela. Sem campo de resposta (não há DM).
- Dos outros: reagir com a barra rápida do feed (`<Emoji>` desenhado). Meu story: "Visto por N" abre a lista (avatar, nome) numa folha `surface`, e tem apagar.
- Arquivos no Cloudinary (versão reduzida: vídeo lado maior 1280, foto 1920); somem em 24 h.

## Ícones
Ionicons (`@expo/vector-icons`) via `<Icon>` de `components/ui`, sempre na variante `-outline` fora da tab bar. Exceção: o selo de verificado (`VerifiedBadge`, `checkmark-circle` cheio em `verified`, ao lado do nome via `NameWithBadge`) é marca, não controle. Selos vêm de `profiles.badges` (só o banco dá); do lado do nome vai um só, o escolhido (`UserBadge` desenha cada tipo). Tamanhos por token `iconSizes`: sm 16 (junto de texto small) · md 20 · lg 24. Cor por `tone` (default/muted) ou `color` explícita. Ícone é decorativo: o rótulo acessível fica no controle. Sem emoji/glifos como ícone.

## Bordas
Token `borders`: `hairline` 1 (contornos de chip, cartão, divisória) · `selected` 3 (opção escolhida).

## Layout por largura
Faixas (`useLayoutTier`, tokens `layout.breakpoints`): **compact** < 700 (celular em pé: tab bar, como sempre) · **medium** 700–1099 (lateral só com ícones) · **expanded** ≥ 1100 (lateral com nomes + coluna direita).
- `AppShell` envolve a pilha de telas: `[Sidebar][coluna central 600 (layout.centerWidth), fios dos dois lados][RightRail 350]`, centralizado. Login, "sem convite" e carregamento ficam fora.
- Sidebar: logo (→ feed), Feed/Notificações/Perfil/Membros (Notificações com `Badge`; ativo = ícone cheio + `brand` + negrito), botão Postar (abre a janela do compositor), eu no pé.
- RightRail: "Os fellas" (até 4 + Ver todos) e "Aniversários" (próximos 4; Hoje/Amanhã/12 out; ícone `gift-outline`).
- Ingresso no compositor: botões `film-outline` ("Anexar review do Letterboxd") e `musical-notes-outline` ("Anexar música") depois da enquete; abrem abaixo do texto a caixa `MediaPicker` (fio `border`, raio `lg`): as suas reviews recentes (miniatura, título, ano, estrelas; "spoiler" quando marcada) com campo "Cola o link de uma review sua", ou o que você ouve (tocando agora + as últimas). Sem conta: explica e leva ao Editar perfil. Um anexo por post: ingresso ou enquete. Escolhido, o ingresso aparece com ✕.
- Enquete no compositor: botão `stats-chart-outline` na barra, depois do local (enquete ou fotos, nunca os dois: um desabilita o outro). Abre abaixo do texto a caixa `PollEditor` (fio `border`, raio `lg`): "Opção 1…4" (até 25), "+" ao lado da última, ✕ nas que passam de 2; "Duração da enquete" com três `Select` (Dias 0–7, Horas, Minutos; 5 min a 7 dias, padrão 1 dia); um fio e "Remover enquete" em `danger`. O texto vira "Faz uma pergunta…"; "Postar" só com a pergunta e 2 opções.
- Compositor (`components/feed/Composer`): página no celular, topo do feed e janela no desktop, um rascunho só (limpo quando o usuário logado muda). Janela (`ComposeDialog`): compacta, presa perto do topo (`spacing.xxxl`), altura acompanhando o conteúdo até `sheetHeightRatio` da tela; só o ✕ (ícone `lg`), solto no canto de cima à direita, sem linha própria — o texto começa no topo; foto, local e "Postar" juntos na barra de baixo (igual ao topo do feed); abre com o cursor no texto. Local: botão `location-outline` na barra (depois de "0/4 fotos") abre campo abaixo do texto ("Onde você tá?", até 60) com `PlaceSuggestions` (caixa igual à das tags; última linha "Usar "…"" quando o digitado é novo); escolhido vira chip `chipHeight` com contorno `hairline`, raio `pill`, toque edita e ✕ tira. Mesmo lugar com grafias diferentes = mesma chave (minúsculas, sem acento).
- Tamanhos que dependem da largura usam `useContentWidth()` (coluna), nunca a janela. Seletor de emojis vira painel de 400 preso ao botão de reagir no desktop.
- Web/desktop: hover `surfaceSunken` + cursor de mão em clicáveis (`interactiveStyle`); ← → Esc no visualizador.
- Rolagem no computador: só o meio rola, mas a roda e o clique na rodinha funcionam em qualquer lugar da página (`wheelForward`, `autoScroll`; ícone `swap-vertical-outline` num círculo `surface` onde clicou). Não se metem sobre algo do lado que rola sozinho nem com janela aberta.

## Notificações
Tela `/notifications` no padrão "sem caixa" (linhas com `Divider`). Linha: ponto `brand` de não lida + fundo `surfaceSunken` só na visita em que chegou; avatar `md` com o ícone do tipo num círculo `bg` encostado no canto (coração `like`, balão, carinha, presente, pessoa+); texto com nomes em negrito e horário `postTime` em `textMuted` (aniversário sem horário: o texto já diz "hoje"); miniatura quadrada `avatarSizes.md` raio `md` quando o post tem foto. Entrada: no celular, sino (`IconButton` ghost) à direita da marca no topo do feed; no computador, item da lateral. `Badge` (components/ui): pílula `brand` + texto `onBrand` caption bold, altura `layout.badgeSize`, "9+" acima de 9, 0 não aparece. Sem emoji no texto do sistema; os emojis de reação são conteúdo.

## Menções e horário
@usuario de fella em post/comentário: negrito na cor `brand`, toque abre o perfil (`MentionText`). Ao digitar @ no compositor ou no comentário aparece `MentionSuggestions` (até 5 fellas: avatar `sm`, nome em negrito, @usuario em `textMuted`, caixa `surface` com fio `border` e raio `md`). Horário de post/comentário/notificação: "agora", "há 5 min", "há 3 h", "ontem 14:32", "3 out 14:32" (`postTime`).

## Não fazer
Embutir o arquivo .otf da Galaxia; usar a Galaxia em outro texto que não a marca; cartão dentro de cartão; eyebrow acima de título; texto em gradiente; borda lateral colorida; cinza puro; fonte de sistema como display.
