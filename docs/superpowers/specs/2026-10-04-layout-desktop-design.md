# Layout de desktop estilo X/Twitter — design

Data: 2026-10-04 · Status: aprovado em conversa, aguardando revisão do spec escrito

## Objetivo

Em tela larga (PC no navegador, iPad, janela larga), o fellasapp deve ter cara de app de desktop, no
modelo do X/Twitter: navegação numa barra lateral à esquerda, conteúdo numa coluna central e uma
coluna à direita com gente do grupo. No celular em pé, **nada muda**: tab bar embaixo, como hoje.

**Sucesso:** abrir no PC e parecer um app de desktop (sem o feed perdido numa faixa estreita no
meio de uma tela vazia); celular em pé idêntico ao atual.

### O que o Juan decidiu
- Coluna da direita: **Os fellas + Aniversários**.
- Postar no desktop: **compositor no topo do feed + botão "Postar" na lateral que abre uma janela**.
- Vale para **qualquer tela larga** (decidido pela largura da janela, em qualquer plataforma).
- Abordagem **A**: uma moldura em volta da navegação existente (não mexer na estrutura de rotas).

### Premissas (não contestadas)
- Nenhuma funcionalidade nova de dados; é arranjo de telas. Sem migration.
- Faixa intermediária (tablet, celular deitado, janela pela metade): barra lateral só com ícones,
  sem coluna da direita.

## 1. Faixas de largura

| Faixa | Largura da janela | Navegação | Coluna direita |
|---|---|---|---|
| `compact` | < 700 | tab bar embaixo (como hoje) | — |
| `medium` | 700–1099 | barra lateral só com ícones; logo pequeno; "Postar" redondo (+) | — |
| `expanded` | ≥ 1100 | barra lateral com ícone + nome; botão "Postar" grande | Os fellas + Aniversários |

- Em `medium` e `expanded`: coluna central com **600px**; o conjunto de colunas fica centralizado
  na janela; a tab bar some; "Novo post" deixa de ser item de navegação (a rota `/new` continua
  existindo).
- Redimensionar a janela troca a faixa na hora, sem recarregar e sem perder a tela atual.
- Tokens em `lib/theme.ts`: `layout.breakpoints = { medium: 700, expanded: 1100 }`,
  `layout.centerWidth = 600`, `layout.sidebarWidth = { medium: 72, expanded: 260 }`,
  `layout.railWidth = 350`. Hook `useLayoutTier(): 'compact' | 'medium' | 'expanded'`
  (em `lib/layout.ts`, a partir de `useWindowDimensions`). Nenhuma tela compara largura por conta
  própria.

## 2. Moldura e barra lateral

```
 ┌────────────┬──────────────────────────┬───────────────────┐
 │ FELLAS     │  (cabeçalho da tela)     │  Os fellas        │
 │ ■ Feed     │                          │  (av) Bia …       │
 │ ○ Perfil   │   coluna central 600px   │                   │
 │ ○ Membros  │   (pilha de telas atual) │  Aniversários     │
 │ [ Postar ] │                          │  Bia · 12 out     │
 │ (av) Juan  │                          │                   │
 └────────────┴──────────────────────────┴───────────────────┘
```

- **`components/shell/AppShell.tsx`**, no `app/_layout.tsx`, envolve a `Stack` raiz.
  - `compact`: renderiza só os filhos (celular idêntico).
  - `medium`/`expanded`: linha `[Sidebar] [coluna central] [RightRail (só expanded)]`, centralizada;
    coluna central com 600px e fio fino (`borders.hairline`, `colors.border`) dos dois lados.
  - **Fora da moldura** (tela toda, como hoje): login, "sem convite" e a tela de carregamento do
    `AuthGuard`. A moldura só aparece para membro logado (mesma regra do guard).
- **Coluna central:** a `Stack` raiz atual. Post, perfil de outro fella, membros e editar perfil abrem
  nela com o cabeçalho/voltar de hoje; lateral e coluna direita ficam paradas.
- **`components/shell/Sidebar.tsx`**:
  - topo: `Logo` (tocar → `/feed`); em `medium` o logo em altura menor;
  - itens **Feed** (`newspaper`), **Perfil** (`person`), **Membros** (`people`): ícone preenchido +
    `brand` + negrito quando ativo (mesma linguagem da aba ativa de hoje);
  - item ativo derivado do `usePathname()`: `/feed` → Feed, `/profile` → Perfil, `/members` → Membros;
    qualquer outra rota (post, perfil de outro fella, editar perfil, `/new`) → nenhum ativo;
  - botão **Postar**: `expanded` = botão primário largo; `medium` = `IconButton` solid com `add`;
    abre a janela do compositor (Parte 4);
  - pé: meu avatar + nome + @ (`expanded`) ou só avatar (`medium`) → `/profile`. "Sair" continua em
    Editar perfil;
  - acessibilidade: a região usa `role="navigation"` (web; o RN não tem papel de navegação), itens com
    `accessibilityRole="link"`, alvo ≥ 44 e item ativo com `accessibilityState.selected`.
- **`app/(tabs)/_layout.tsx`**: em `medium`/`expanded`, a tab bar fica escondida
  (`tabBarStyle: { display: 'none' }`). As abas continuam montadas (cada uma mantém histórico e
  rolagem).

## 3. Coluna da direita (só `expanded`)

- **`components/shell/RightRail.tsx`**, 350px. Cada coluna rola sozinha: a lista do centro rola sem
  arrastar a lateral nem a coluna direita (que tem sua própria rolagem, se o conteúdo passar da
  altura). Estilo do redesenho: sem caixas, títulos de seção, listas e fios.
- **"Os fellas":** até 8 membros (avatar `sm`, nome, @). Tocar → `/user/[id]`, ou `/profile` se for
  eu. Rodapé "Ver todos" → `/members`.
- **"Aniversários":** os próximos 3 aniversários (só quem preencheu), ordenados pela próxima
  ocorrência a partir de hoje, com virada de ano. Rótulo "Hoje", "Amanhã" ou data curta ("12 out").
  Ícone `gift-outline` (nunca emoji como ícone). Ninguém preencheu → "Ninguém pôs o aniversário
  ainda. Põe o seu em Editar perfil."
- **Dados:** hook **`useMembers()`** (lista de membros + avatares assinados numa chamada só),
  extraído de `app/members.tsx`, que passa a usá-lo também. Função pura
  **`nextBirthdays(members, today, limit)`** em `lib/birthdays.ts`.
- **Falha:** "Não deu pra carregar os fellas" + "Tentar de novo"; o centro não é afetado.

## 4. Compositor em três formatos

- **`components/feed/Composer.tsx`** extraído de `app/(tabs)/new.tsx`, com a lógica atual (texto que
  cresce com `useAutoGrow`, até 4 fotos com ✕, "x/4 fotos", contador a partir de 1800, dica, erros
  pt-BR, `createPost` + `emitPostCreated`). Prop `variant`:
  - **`page`** (`/new`, celular): igual a hoje (Cancelar + Postar no topo, barra embaixo).
  - **`inline`** (topo do feed em `medium`/`expanded`): avatar + "O que rolou, fella?"; linha embaixo
    com foto, "x/4", contador e "Postar" à direita; sem Cancelar e sem dica; limpa ao postar.
  - **`dialog`** (botão Postar da lateral): janela centralizada de 600px, ✕ à esquerda e Postar à
    direita; fecha ao postar; fechar com rascunho pede confirmação ("Descartar o rascunho?").
- A janela é estado do `AppShell` (abre/fecha), sem rota própria; renderizada por
  `components/shell/ComposeDialog.tsx` usando `Composer variant="dialog"`.
- **Topo do feed:** `compact` mantém o logo FELLAS; `medium`/`expanded` começam direto pelo
  `Composer variant="inline"`, com fio antes do primeiro post (o logo já está na lateral).
- `app/(tabs)/new.tsx` vira uma casca fina: `<Composer variant="page" />`.

## 5. Ajustes por tela

- **Largura de conteúdo:** `useContentWidth()` (contexto do `AppShell`) devolve a largura útil da
  coluna central (600 em `medium`/`expanded`; janela limitada a `maxContentWidth` em `compact`).
  Passam a usá-lo: grade de fotos do perfil (`ProfileView`), miniaturas do `Composer`. Continuam
  com a janela inteira: `PhotoViewer`, `ConfirmDialog`, `ReactionPicker`.
- **Seletor de emojis:** `compact` = folha de baixo (como hoje); `medium`/`expanded` = painel
  centralizado de 400px (`layout.maxDialogWidth`).
- **Visualizador de fotos (web):** ← e → trocam de foto, Esc fecha.
- **Mouse (web):** fundo `surfaceSunken` ao passar o mouse em itens da lateral, membros da coluna
  direita, botões de ação e na linha do post; cursor de mão nos clicáveis.
- **Altura na web:** a regra `#root { height: 100dvh }` (t14, hoje inativa porque `+html.tsx` não é
  usado com `web.output: "single"`) passa para `lib/webStyles.ts`.
- **DESIGN.md:** nova seção "Layout por largura" (faixas, moldura, lateral, coluna direita).

## Testes

- `useLayoutTier`: limites 699/700/1099/1100.
- `Sidebar`: item ativo por endereço (`/feed`, `/profile`, `/members`, `/post/x`, `/user/x`).
- `nextBirthdays`: ordem, virada de ano, "Hoje"/"Amanhã", quem não preencheu fica de fora, limite.
- `Composer`: os três formatos (página com Cancelar; inline sem Cancelar e limpando ao postar; dialog
  fechando ao postar e confirmando descarte). Os testes atuais de `newPost.test.tsx` migram para o
  `Composer`.
- `AppShell`: por faixa (larguras simuladas): compact sem lateral; medium com lateral sem coluna
  direita; expanded com as duas; fora da moldura no login.
- `RightRail`: lista, "Ver todos", estado vazio de aniversários, erro com "Tentar de novo".
- Conferência visual na web em 390, 900 e 1440px, temas claro e escuro.

## Fora de escopo

Busca; notificações; atalhos de teclado além do visualizador; visualizador com comentários ao lado
(como o X no desktop); teste em iPad físico/simulador (não disponível neste ambiente — avisar).
