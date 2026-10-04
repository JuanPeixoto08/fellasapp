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

Accent aparece sempre **invertido** (preenchimento `accent` + texto `onAccent`): minha reação, emoji escolhido no seletor, grifo `<Text highlight>`. Sem amarelo em lugar nenhum. `like` só no coração curtido e no número dele; vermelho de erro continua `danger`. Avatares sem foto usam tons de papel/pastel com tinta.

### Brand
`brand` (violeta `#5B3FD9` claro / `#B8A2FF` escuro) é o tint ativo da tab bar e destaques de UI sobre papel, com contraste ≥ 4.5:1 no `bg`.

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
Screen · Text/Heading · Button (primary, secondary, ghost, danger; loading/disabled) · TextField (label, erro, ajuda) · Avatar (foto ou iniciais em cor determinística; tamanhos `avatarSizes` sm 32 · md 40 · lg 56 · xl 88) · Card · EmptyState · Divider · Icon · IconButton (só ícone, 44pt, outline ou ghost, rótulo acessível obrigatório) · Tabs (abas de seção com traço `brand` sob a ativa) · ConfirmDialog (confirmação de ação destrutiva; botão `danger`, cancelar "Deixa quieto", erro dentro do diálogo).

### Post (feed, perfil, tela do post)
Sem caixa: nada de cartão com borda/sombra. O post fica direto no papel e as listas separam com `Divider` de ponta a ponta. Avatar `md` numa coluna; na outra, nome (bold) + data à direita, texto, fotos (`PostImages`: 1 na proporção original limitada por `mediaAspect`, 2–4 em grade como no Twitter, raio `lg`), chips de reação e a fila de ações: ♡ e 💬 como ícone + número (zero não aparece), carinha de reagir isolada à direita — vira o meu emoji quando já reagi. Chips de reação mínimos (altura `chipHeight`, contorno fino; o meu invertido). Comentários seguem o mesmo desenho, com a carinha ao lado do texto.

### Reações e fotos
- Barra rápida (pílula com os 6 de `QUICK_REACTIONS` + "+"): se a minha reação não é um dos 6, ela entra primeiro, invertida, para dar pra remover. O "+" abre o `EmojiPicker`: folha que sobe de baixo (`sheetHeightRatio`), busca em pt (dados `emojibase-data` carregados só ao abrir), Recentes (no aparelho) e categorias com ícones desenhados (nunca emoji como ícone).
- Até 4 fotos por post. No post, toque abre o `PhotoViewer` (fundo `viewerBg`, "1/3", ✕; setas só na web). Controles sobre foto usam `overlay` + `onOverlay`. Na aba Fotos, um quadradinho por post, com ícone de "várias" quando tem mais de uma.

### Perfil
Cabeçalho compacto: avatar `lg`, nome (title) e @usuário, ações como IconButton à direita (só no meu perfil). Status num chip neutro (`surfaceSunken` + texto). Sem cor por fella: a "cor de perfil" (paleta + seletor) saiu em out/2026 porque não encaixava no zine. Foto de perfil passa pelo "Ajustar foto" (`components/profile/AvatarCropper`): palco `viewerBg`, círculo com fio `onOverlay` e o resto escurecido com `overlay`, arrastar + zoom 1–4x (pinça, roda, botões − / +); tela cheia no celular, janela `maxDialogWidth` no computador; sai 512×512 JPEG. Números entre fios finos (sem bloco de cor). Abas Posts (cards iguais ao feed, um embaixo do outro) e Fotos (grade de 3, toque abre o post). Sem banner, sem arco-íris na grade. Todos com estados disabled/erro/loading onde fizer sentido, `accessibilityRole` e labels.

## Ícones
Ionicons (`@expo/vector-icons`) via `<Icon>` de `components/ui`, sempre na variante `-outline` fora da tab bar. Tamanhos por token `iconSizes`: sm 16 (junto de texto small) · md 20 · lg 24. Cor por `tone` (default/muted) ou `color` explícita. Ícone é decorativo: o rótulo acessível fica no controle. Sem emoji/glifos como ícone.

## Bordas
Token `borders`: `hairline` 1 (contornos de chip, cartão, divisória) · `selected` 3 (opção escolhida).

## Layout por largura
Faixas (`useLayoutTier`, tokens `layout.breakpoints`): **compact** < 700 (celular em pé: tab bar, como sempre) · **medium** 700–1099 (lateral só com ícones) · **expanded** ≥ 1100 (lateral com nomes + coluna direita).
- `AppShell` envolve a pilha de telas: `[Sidebar][coluna central 600 (layout.centerWidth), fios dos dois lados][RightRail 350]`, centralizado. Login, "sem convite" e carregamento ficam fora.
- Sidebar: logo (→ feed), Feed/Notificações/Perfil/Membros (Notificações com `Badge`; ativo = ícone cheio + `brand` + negrito), botão Postar (abre a janela do compositor), eu no pé.
- RightRail: "Os fellas" (até 8 + Ver todos) e "Aniversários" (próximos 3; Hoje/Amanhã/12 out; ícone `gift-outline`).
- Compositor (`components/feed/Composer`): página no celular, topo do feed e janela no desktop, um rascunho só (limpo quando o usuário logado muda).
- Tamanhos que dependem da largura usam `useContentWidth()` (coluna), nunca a janela. Seletor de emojis vira painel de 400 no desktop.
- Web/desktop: hover `surfaceSunken` + cursor de mão em clicáveis (`interactiveStyle`); ← → Esc no visualizador.

## Notificações
Tela `/notifications` no padrão "sem caixa" (linhas com `Divider`). Linha: ponto `brand` de não lida + fundo `surfaceSunken` só na visita em que chegou; avatar `md` com o ícone do tipo num círculo `bg` encostado no canto (coração `like`, balão, carinha, presente, pessoa+); texto com nomes em negrito e horário `postTime` em `textMuted` (aniversário sem horário: o texto já diz "hoje"); miniatura quadrada `avatarSizes.md` raio `md` quando o post tem foto. Entrada: no celular, sino (`IconButton` ghost) à direita da marca no topo do feed; no computador, item da lateral. `Badge` (components/ui): pílula `brand` + texto `onBrand` caption bold, altura `layout.badgeSize`, "9+" acima de 9, 0 não aparece. Sem emoji no texto do sistema; os emojis de reação são conteúdo.

## Menções e horário
@usuario de fella em post/comentário: negrito na cor `brand`, toque abre o perfil (`MentionText`). Ao digitar @ no compositor ou no comentário aparece `MentionSuggestions` (até 5 fellas: avatar `sm`, nome em negrito, @usuario em `textMuted`, caixa `surface` com fio `border` e raio `md`). Horário de post/comentário/notificação: "agora", "há 5 min", "há 3 h", "ontem 14:32", "3 out 14:32" (`postTime`).

## Não fazer
Embutir o arquivo .otf da Galaxia; usar a Galaxia em outro texto que não a marca; cartão dentro de cartão; eyebrow acima de título; texto em gradiente; borda lateral colorida; cinza puro; fonte de sistema como display.
