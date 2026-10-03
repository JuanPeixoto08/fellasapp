# DESIGN — fellasapp

Mundo visual: **"Zine de amigos"** — escolhido pelo Juan numa página de comparação aberta no Chrome (5 opções claro/escuro). Papel de jornal off-white, tinta preta, marca-texto amarelo. Editorial e debochado: serifa grande nos títulos, interface sóbria, personalidade na voz e no marca-texto. Tokens em `lib/theme.ts`; primitivos em `components/ui/`. Telas não usam valores soltos.

## Cor
Neutros quentes de papel/tinta, nunca cinza puro. A "cor" do app é o amarelo marca-texto; ação principal é tinta (preto no claro, papel no escuro).

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
| accent (marca-texto) | `#FFE14D` | `#FFE14D` |
| onAccent | `#121212` | `#121212` |
| danger | `#B3261E` | `#FF8A80` |
| success | `#2E7D4F` | `#7BD9A0` |

Accent só como marca-texto (`<Text highlight>`), badge "novo" ou destaque pontual; sempre com `onAccent` por cima. Avatares sem foto usam tons de papel/pastel com tinta.

## Tipografia
- **Display: Instrument Serif** (regular + itálico) — títulos grandes, editoriais. Só existe em peso 400: hierarquia vem do tamanho, não de negrito.
- **Corpo/UI: Inter** (Regular/Medium/Bold).
- Escala (pt): caption 12 · small 14 · body 16 · lead 18 · title 28 · headline 36 · display 48. Respeita escala de fonte do sistema.
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
Screen · Text/Heading · Button (primary, secondary, ghost, danger; loading/disabled) · TextField (label, erro, ajuda) · Avatar (foto ou iniciais em cor determinística) · Card · EmptyState · Divider. Todos com estados disabled/erro/loading onde fizer sentido, `accessibilityRole` e labels.

## Ícones
Biblioteca de ícones desenhados (adicionar em task de telas, ex. @expo/vector-icons); sem emoji/glifos como ícone.

## Não fazer
Negrito sintético na serifa display; cartão dentro de cartão; eyebrow acima de título; texto em gradiente; borda lateral colorida; cinza puro; fonte de sistema como display.
