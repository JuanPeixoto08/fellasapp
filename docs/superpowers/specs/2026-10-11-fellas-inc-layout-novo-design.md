# Fellas Inc.: layout novo, árvore em tela cheia e conquistas em grade

Data: 11/10/2026. Aprovado pelo Juan nos mockups do visual companion (`.superpowers/brainstorm/2158-1791723853/content/`:
`layout-v2.html` para o celular e a árvore, `layout-minigames.html` para o PC com a bancada).

## Objetivo

O Juan não gostou da aba Legado (pílulas douradas grandes, árvore em colunas de cartões, conquistas lá embaixo) e quer o
jogo com cara de jogo pixel art e organizado. Esta entrega refaz só a apresentação da Fellas Inc. (`games/idle`):

- celular com 4 abas (Loja, Gente, Placar, Legado) e a cena em cima;
- PC em dois lados: a empresa e a bancada à esquerda, o painel de abas à direita;
- árvore de habilidades em tela cheia, em forma de copa, ícones ligados por linhas;
- conquistas em grade de ícones dentro do Legado;
- botões sem pílula dourada; fonte pixel nos títulos, números, abas e botões.

A bancada nasce só com a gaveta **Caixinha** (as oportunidades guardadas). Os minigames (Bolsa, Horta, Convidados,
Lives) entram depois, um por entrega, cada um com a sua spec; esta entrega só deixa o lugar pronto.

## Fora do escopo

- Nenhuma regra, conta, RPC ou tabela muda. Sem migração, sem `db push`.
- Minigames e propriedades (entregas futuras).
- Os jogos de cartas (`blackjack`, `poker`) e o `shared/hud/hud.css` continuam iguais: tudo novo fica em `idle.css`,
  dentro de `.idle`.

## Visual

- Cores de hoje do jogo: fundo `#121212`, painel `#1B1A22`, borda `#34323F`, ativo `#262431`, roxo `#5B3FD9`
  (claro `#7D64F0`, escuro `#3D27A8`), lilás `#B8A2FF`, dourado `#F2D27A`, menta no "por segundo". Viram variáveis
  CSS em `.idle` (`--idle-painel`, `--idle-borda`...), sem valor solto repetido.
- **Fonte pixel:** Jersey 10 (SIL OFL; trocada pela Pixelify em 11/10 porque os números da Pixelify confundiam 3, 8 e 9), carregada pelo Google Fonts no `idle/index.html`, igual à Golos hoje, só o peso regular (sem negrito falso);
  tamanhos ×1,3 dos da Pixelify. Vale nos títulos, números (dinheiro, por segundo, preços, pontos), abas, botões e rótulos dos
  ramos. Texto corrido (nomes de gerador, frases, efeitos) continua na Golos.
- **Cantos de pixel:** painéis e botões usam contorno por `box-shadow` nos 4 lados (2 px; 3 px nos nós da árvore), o
  que deixa os cantos "mordidos" como pixel art. Sem `border-radius` nesses elementos.
- **Botões:** comum = fundo `#22202B`, contorno `#4A4660`, chanfro (sombra interna clara em cima, escura embaixo),
  contorno lilás no hover; principal = roxo com contorno `#8C75FF` e chanfro roxo. Desabilitado a 0,42. O `.btn.main`
  dourado deixa de aparecer na Fellas Inc. (Abrir CNPJ, Bora do editor, Escolher estratégia, Vender, Pegar, Entrar):
  vira o principal roxo por regra em `.idle`. Alvo de toque ≥ 44 px no celular (40 px no PC).
- **Abas:** texto pixel; a ativa com fundo roxo e contorno de pixel.
- Ícones pixel sempre ampliados por inteiro (2×, 3×), `image-rendering: pixelated`.
- Barras de rolagem finas, na cor da borda.

## Celular (largura < 1100)

Coluna única, centralizada até 560 px de largura.

1. **Topo:** ← Voltar · Fellas Inc. · Mudar visual (abre o editor; sai o botão "Oportunidades" do topo).
2. **Empresa:** painel com a cena (2×, 320 × 192) e, embaixo dela numa linha só, o dinheiro (pixel 28) e o por
   segundo (menta). A linha de bônus temporário (×5, meia-preço) fica logo abaixo quando houver.
3. **Bancada:** fileira de gavetas (botões quadrados de 52 px com ícone e rótulo embaixo). Por enquanto só a
   **Caixinha**, com o número de oportunidades guardadas num selinho dourado; tocar abre a folha das oportunidades
   que existe hoje (`modal-caixa`), sem mudança de conteúdo.
4. **Abas:** Loja · Gente · Placar · Legado.
   - **Loja:** seletor Geradores | Melhorias. Geradores: as linhas de hoje (boneco 56 px, nome, "×N · +F$ X/s cada")
     com os botões preço · 10 · Máx numa segunda linha, ocupando a largura. Melhorias: o seletor À venda | Compradas
     de hoje, dentro.
   - **Gente:** o Contratar de hoje (cartão "você" + cartas dos fellas).
   - **Placar:** o de hoje.
   - **Legado:** pontos ("★ 3 pontos", "12 na vida · vendeu 2 vezes") com o botão **Vender · +N ★** (comum, apagado
     com "Ainda não compensa" quando não dá ponto); o **quadro da árvore** (copa em miniatura, "Árvore de
     habilidades", "N de 26 comprados · K dá pra comprar agora", botão principal **Abrir**); **Conquistas** "N/72 ·
     +N% de produção" com a grade de ícones e o cartão de detalhe.

## PC (largura ≥ 1100)

Topo de 64 px (← Voltar · Fellas Inc. · Mudar visual). Corpo em duas colunas: `minmax(0, 1fr)` e painel de 500 px,
espaço de 32 entre elas, margens de 32. Grade de 8 em todos os espaços.

- **Esquerda (o que está acontecendo):**
  - cena em 3× (480 × 288) com sombra roxa suave embaixo;
  - **resumo** do lado da cena: dinheiro (pixel 36, sem quebrar), por segundo (menta), bônus temporário quando houver,
    e em letra menor: "Era 3 · Escritório", "2 contratados", "+12% das conquistas" (some se 0);
  - **bancada** embaixo, ocupando a largura: fileira de gavetas no topo (ícone 32 + nome + selinho), a gaveta ativa
    com fundo `#262431` e traço lilás embaixo; o corpo mostra a gaveta aberta. A **Caixinha** aberta lista as
    oportunidades guardadas com ícone, o que dá, "some em …" e **Pegar** (as mesmas regras da folha: meia-preço
    repetida apagada com "Usa a que você já tem primeiro", sem pega do dia apagado), e a linha "Hoje ainda dá pra pegar
    N." / "Já pegou todas de hoje. Amanhã tem mais."; vazia: "Nada guardado agora. Volta mais tarde."
- **Direita (o que você compra e gerencia):** painel com as 4 abas do celular, rolando por dentro. Na Loja as linhas
  ficam com os botões na mesma linha do nome (preço ≥ 112 px, 10 = 44, Máx = 76).
- A oportunidade ao vivo continua atravessando a cena.

## Antes do Abrir CNPJ (fase "antes")

- Celular: como hoje (cena, "3h06. Bora fundar uma empresa?", Abrir CNPJ, Mudar visual) e o Legado embaixo para
  quem tem pontos na vida.
- PC: no lugar do resumo, o bloco do Abrir CNPJ; o painel da direita mostra só o Legado (sem abas) para quem tem pontos
  na vida, e some para quem nunca vendeu.

## Árvore em tela cheia

Abre pelo botão **Abrir** do quadro da árvore, por cima de tudo (`role="dialog"`, `aria-modal`, título "Árvore de
habilidades"). Fundo de céu da madrugada (degradê escuro, poucas estrelas de 1–2 px, brilho roxo embaixo).

- **Topo:** ✕ (fecha) · "Árvore de habilidades" · "★ N" (pontos livres).
- **Copa:** mundo de 400 × 540; posições fixas por id (centro do nó). Raiz embaixo; cada ramo sobe abrindo:

  | id | x, y | id | x, y | id | x, y | id | x, y | id | x, y |
  |---|---|---|---|---|---|---|---|---|---|
  | 1 | 200, 510 | | | | | | | | |
  | 11 | 80, 450 | 21 | 134, 406 | 31 | 200, 378 | 41 | 266, 406 | 51 | 320, 450 |
  | 12 | 52, 372 | 22 | 120, 324 | 32 | 200, 302 | 42 | 280, 324 | 52 | 348, 372 |
  | 13 | 44, 288 | 23 | 116, 242 | 33 | 200, 222 | 43 | 284, 242 | 53 | 356, 288 |
  | 14 | 48, 204 | 24 | 122, 160 | 34 | 200, 142 | 44 | 278, 160 | 54 | 352, 204 |
  | 15 | 64, 122 | 25 | 136, 80 | 35 | 200, 56 | 45 | 264, 80 | 55 | 336, 122 |

  O nome do ramo fica 44 unidades acima do 5º nó. Linhas retas entre cada nó e o seu `requer`.
- **Escala:** `s = min(largura/400, altura/540)`, presa entre 0,85 e 1,4. Os nós têm tamanho fixo (52 px, ícone 48 =
  16 × 3); só as posições e as linhas escalam. Se o mundo escalado não couber (celular deitado), arrasta com o dedo ou
  o mouse para ver o resto (limitado às bordas); um arraste de mais de 6 px não conta como toque no nó.
- **Situação de cada nó** (de `situacao()` + pontos livres):
  - comprado: contorno dourado, fundo `#2A2414`, linha até ele dourada (4 px);
  - dá pra comprar agora (liberado e pontos ≥ custo): contorno lilás com brilho (pulso lento; parado com "reduzir
    movimento"), linha lilás;
  - falta ponto (liberado, pontos < custo): contorno `#8F86B8`, linha lilás;
  - trancado: ícone apagado (cinza escuro), contorno `#26232F`, linha tracejada escura.
  - O custo ("4 ★", pixel 12, dourado) aparece embaixo dos que não estão comprados nem trancados.
- **Cartão do nó escolhido** (embaixo no celular; à direita, alinhado embaixo, no PC, com a legenda das 4 situações em
  cima): ícone, nome, "Produção · 2 de 5" (ramo e posição; a raiz diz "Raiz"), efeito, e o botão:
  - liberado com pontos: principal **Comprar · N ★** → `comprarNo(id)`;
  - liberado sem pontos: apagado **Faltam N ★**;
  - trancado: texto "Libera com <nome do anterior>", sem botão;
  - comprado: texto "Comprado".
  Botão apagado também enquanto `ocupado`.
- **Nó escolhido ao abrir:** o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz. O escolhido
  tem um anel branco de pixel. Tocar noutro troca o cartão. A escolha e o arraste vivem só na tela (não vão pro
  modelo).
- **Teclado e foco:** os nós são `button` com `aria-label` ("Turno dobrado, falta 5 ★") e `aria-pressed` no escolhido;
  ao abrir, o foco vai pro ✕; Esc fecha; ao fechar, o foco volta pro Abrir.
- Comprar com a árvore aberta atualiza tudo no lugar (o nó acende, o caminho vira dourado, os pontos do topo baixam).

## Conquistas em grade

- Grade de quadrados de 40 px (38 no celular) com o ícone 16 × 2 = 32; preenche a largura (`auto-fill`).
- Ganha: ícone colorido. Não ganha: ícone cinza escuro. Escondida que alguém do grupo tem e você não: "?" no lugar do
  ícone. Escondida que ninguém tem: não aparece (regra de `grade()` de hoje).
- Tocar mostra o **cartão de detalhe** embaixo da grade: ícone 48, nome (ou "???"), a frase (ganha) ou a condição (não
  ganha) ou "Alguém do grupo conseguiu", e "Ganhou em 10/10/2026" quando ganha. Tocar de novo fecha. O escolhido tem
  contorno lilás.
- Os botões da grade têm `aria-label` com o nome e "ganha"/"não ganha".

## Código

- `games/idle/legado.ts` ganha `POSICOES_ARVORE` (a tabela acima), `MUNDO_ARVORE = { largura: 400, altura: 540 }`,
  `escalaArvore(largura, altura)` e `noInicial(arvore, pontos)`. Puras e testadas.
- `games/idle/tela.ts`: `Aba` vira `'loja' | 'gente' | 'placar' | 'legado'`; Geradores | Melhorias vira estado só da
  tela (como o À venda | Compradas). A tela da árvore é um elemento criado uma vez e redesenhado em `renderizar`; o
  arraste e a escala ficam na tela (um `ResizeObserver` no palco da árvore recalcula a escala). Se o arquivo passar de
  ~800 linhas, a árvore e a bancada vão para `arvoreTela.ts` e `bancada.ts`.
- `games/idle/main.ts`: aba inicial `'loja'`; depois da venda volta pra `'loja'`; o placar carrega com `'placar'` ou
  `'gente'` (no lugar de `'contratar'`).
- `games/idle/idle.css`: reescrito nas partes de layout, abas, botões, Loja, Legado; regras novas da árvore, conquistas
  e bancada. Uma media query de 1100 px separa celular e PC.
- `games/dev/mockIdle.ts`: ajuda de console `__pontos(n)` para pôr pontos livres no `?mock` (conferência da árvore).

## Testes

- `legado.test.ts`: todas as 26 posições existem e ficam dentro do mundo com folga de 26; distância entre quaisquer dois
  centros ≥ 64; os nomes dos ramos não saem do mundo; `escalaArvore` respeita 0,85 e 1,4; `noInicial` escolhe o mais
  barato comprável, depois o mais barato liberado, depois a raiz.
- `tela.test.ts` (atualizado):
  - 4 abas na ordem Loja, Gente, Placar, Legado; trocar chama `trocarAba` com o nome novo;
  - Loja: o seletor Geradores | Melhorias troca a lista; os botões de compra continuam chamando `comprar`;
  - bancada: a gaveta Caixinha mostra o número de guardadas e abre a folha; a Caixinha da bancada lista as pendentes
    com Pegar (mesmas regras de apagado da folha);
  - Legado: pontos e Vender (texto e apagado); quadro da árvore com "N de 26 comprados"; Abrir mostra a árvore;
  - árvore: 26 nós; situações nas classes; nó inicial escolhido; tocar num nó troca o cartão; Comprar chama
    `comprarNo(id)`; sem pontos "Faltam N ★" apagado; trancado "Libera com …" sem botão; Esc e ✕ fecham e devolvem o
    foco ao Abrir; ícone sem arte mostra a moldura;
  - conquistas: grade com ganha/não ganha/"?"; tocar mostra frase e data; tocar de novo fecha;
  - fase "antes": Legado aparece para quem tem pontos na vida e a raiz dá pra comprar pela árvore.
- Suítes: `games` (`tsc` + `vitest`) e a raiz (`tsc` + `jest`) passando; `vite build` ok.
- Conferência visual no `?mock`, celular (390 × 844) e PC (1280 × 800 e 1920 × 1080): Loja, Gente, Placar, Legado,
  árvore aberta (comprar um nó), bancada, fase "antes".

## Publicação

Sem migração: depois de pronto e conferido, merge local na main e push (o deploy publica). O jogo recarrega sozinho nas
abas abertas (`vigiarVersao`).
