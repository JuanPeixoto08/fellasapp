# Fellas Inc.: Mapa do rolê, lote 1 (moldura + camisetaria, copão e jantar)

Data: 2026-10-12. Decisões do Juan nesta conversa. **Substitui a seção 6 (Propriedades) de
`2026-10-10-fellas-inc-design.md`**: não existe mais tomar lugar de ninguém. Os lugares do rolê viram filiais, no espírito
dos planetas do Adventure Capitalist, mas cada lugar com uma mecânica própria (para não ser a mesma empresa com outro
nome). São 9 lugares, lançados de 3 em 3; este documento cobre a moldura comum e o lote 1.

## 1. Privacidade (vale para tudo abaixo)

O repositório e o site são públicos. Os lugares são reais e o grupo frequenta, então:

- **Nome, frase, ícone (PNG 32×32), mapa (PNG 160×96) e posição dos pinos ficam só no banco**, nas tabelas
  `idle_places` e `idle_map`, legíveis só por membros logados (RLS com `is_member()`). Nenhum nome real no código, nos
  testes, nas migrações, nos commits ou nesta spec.
- Os dados entram por um SQL **fora do repositório** (`../fellas-inc-esbocos/lugares/carregar.sql`, gerado a partir de
  `lugares/png/` e `mapa-pontos.json`), que o Juan roda no banco depois da migração. A migração só cria as tabelas.
- No repositório os lugares são só números (1 a 9) e apelidos genéricos: 1 o samba, 2 o casarão, 3 a camisetaria,
  4 o copão, 5 a loja 24h, 6 a sinuca, 7 o jantar, 8 a massa-mãe, 9 o corredor.
- Toda arte e todo texto das mecânicas (estampas, bebidas, pratos, influencers, DJs) são genéricos e moram no repositório
  como os outros minigames.
- O modo `?mock` usa lugares de mentira ("Lugar 1" ... "Lugar 9", ícones e mapa de mentira).

## 2. Os 9 lugares e os lotes

| id | Apelido | Faixa | Lote | Mecânica | Número do pódio |
|---|---|---|---|---|---|
| 1 | o samba | barato | 2 | preparar a roda pro sábado real | a definir no lote 2 |
| 2 | o casarão | barato | 2 | restaurar o casarão cômodo a cômodo | a definir no lote 2 |
| 3 | a camisetaria | barato | **1** | drop de camiseta (Game Dev Tycoon) | % de procura |
| 4 | o copão | médio | **1** | montar o copão (Game Dev Tycoon) | nota 0 a 999 |
| 5 | a loja 24h | médio | 2 | promoção por faixa do relógio | a definir no lote 2 |
| 6 | a sinuca | médio | 3 | rei da mesa | popularidade |
| 7 | o jantar | caro | **1** | primeiro encontro + crítico (Game Dev Tycoon) | estrelas 0,0 a 5,0 |
| 8 | a massa-mãe | caro | 3 | cuidar da massa-mãe | a definir no lote 3 |
| 9 | o corredor | caro | 3 | planejar o corredor do shopping | a definir no lote 3 |

Os lotes 2 e 3 ganham cada um a sua spec. Lugar de lote ainda não lançado aparece no mapa como "Em breve".

## 3. A moldura (comum aos 9)

### 3.1 Abrir

- Preço em **horas da produção atual** da empresa (segundos × F$/s, como as sementes da Horta): barato 2 h (era 2+),
  médio 6 h (era 3+), caro 16 h (era 4+). Sem desconto de meia-preço, Promoção ou Horta.
- Aberto é para sempre. **Vender a startup não mexe nos lugares** (nem fecha, nem zera).

### 3.2 Dentro de cada lugar

- **Moeda própria**: camisetaria = cupom, copão = ficha, jantar = gorjeta. Sai da mecânica; não troca por F$.
- **Nível** (1 a 25), comprado com a moeda do lugar. Cada nível sobe o rendimento do lugar e **libera conteúdo**
  (as listas de cada lugar dizem o quê). Preço do nível n: `custo_base × 1,55^(n−1)`, `custo_base` por lugar.
- **Sem você, o lugar rende no máximo um ciclo**: a coleção que já está à venda vende até o fim; o bar e o restaurante só
  abrem a noite se você abriu a Fellas Inc. desde a noite anterior (senão: "ninguém abriu o bar ontem"). Não existe o teto
  de 8 h aqui; o ciclo é o teto.
- **Avanço preguiçoso**, como a Horta: cada chamada anda o lugar do último ponto até agora (no máximo 7 dias), com sorte
  por semente (jogador, lugar, passo): reabrir dá o mesmo resultado. Roda dentro de `idle_lock`.
- **Fãs** (camisetaria: fãs; copão: galera; jantar: reputação): sobem com bons resultados e puxam o próximo. Não decaem
  sozinhos.
- **Caderninho**: tudo que você descobriu (combinações, gostos) fica anotado por pessoa e por lugar.

### 3.3 Marcos (bônus na empresa principal)

- Cada lugar tem 8 marcos. Cada marco ganho soma um bônus de produção na empresa principal:
  `mult_mapa = 1 + Σ bônus dos marcos ganhos` (aditivo entre todos os lugares), entra em `idle_rate_at`.
- Soma dos marcos de um lugar: 22%. Os 9 lugares juntos: ~+200%.
- Marcos do lote 1 (iguais nos três, com o número de cada lugar):

| Marco | Bônus |
|---|---|
| Nível 5 | +2% |
| Nível 10 | +2% |
| Nível 15 | +3% |
| Nível 20 | +3% |
| Nível 25 | +4% |
| 1º resultado "lendário" (camisetaria: 4 notas 10; copão: nota 900+; jantar: 4,5 estrelas+) | +3% |
| Fãs: camisetaria 100 mil fãs (ajustado pela simulação); copão 5 mil de galera; jantar 2 mil de reputação | +3% |
| Volume: camisetaria 50 coleções; copão 30 copões; jantar 100 casais formados | +2% |

### 3.4 Desafio da semana

- Um por lugar, **o mesmo para todo mundo**, sorteado pela semana (`games_week_start`) de um catálogo de ~12 por lugar.
- Exemplos: camisetaria "lance uma coleção de tema praia com nota média 8+"; copão "copão com nota 700+ sem PT na
  noite"; jantar "forme 3 casais numa noite só".
- Prêmio (um por desafio, do catálogo): F$ de **N horas da produção** (2 a 6 h), **1 a 3 pontos do Legado**, ou o
  **Investidor na hora** (o mesmo efeito do dourado Investidor: 20 min de produção). Uma vez por semana por lugar.

### 3.5 Placar da semana e dono do pedaço

- Cada lugar tem placar da semana pelo número do pódio dele (melhor resultado lançado na semana; desempate: quem chegou
  primeiro). Na segunda 00:02, a mesma função da foto semanal (`idle_lock`/cron) guarda o 1º de cada lugar em
  `idle_place_weeks`.
- O 1º da semana passada é o **dono do pedaço**: o boneco dele aparece no pino do lugar no mapa durante a semana. Só
  honra; ninguém perde nada.

### 3.6 Pódio de sempre

- Em cada lugar, um pódio com os **3 melhores de todos os tempos do grupo**, ordenados pelo número do lugar.
- **Cada pessoa aparece no máximo uma vez por pódio** (a melhor produção dela). Empate: quem chegou primeiro.
- Cada posição mostra a **foto da produção, o nome que a pessoa deu, o número e o boneco de quem fez**.
- A foto não é imagem guardada: a produção guarda as peças escolhidas (`partes int[]`) e a tela monta o desenho.
- Toda produção tem nome (1 a 30 caracteres, sem quebra de linha). Se a pessoa deixar em branco, o jogo sugere um nome
  zoeira a partir das peças.

### 3.7 Estratégias que esperavam as propriedades

- **Networking** (era 2): o texto passa a "Contratos valem o dobro." (já era só isso na prática).
- **Marca forte** (era 3, hoje desligada): liga como "+5% de produção por lugar aberto".
- **Monopólio** (era 4, hoje desligada): liga como "Os marcos dos seus lugares valem o dobro.".

### 3.8 Tela

- A porta "Mapa do rolê" (hoje "Em breve") abre em tela cheia (`.minigame-tela`) com o mapa noturno 160×96 em escala
  inteira e os 9 pinos nos lotes do mapa.
- Pino: fechado (cadeado + preço em F$, era exigida se ainda não chegou), aberto (ícone + nível + dono do pedaço) ou
  "Em breve" (lote não lançado).
- Tocar num lugar aberto abre a tela dele, também em tela cheia, com: cabeçalho (ícone, nome, moeda, nível, fãs),
  a área da mecânica, e uma faixa com pódio, desafio da semana, marcos e caderninho.
- Tudo cabe sem rolar no PC (conferir em 1280×720 e 2000×961) e o celular rola inteiro (iframe de 390 px).
- **Caixinha de informação** (mouse e teclado; no celular não): em cada opção (tema, estilo, peça, cor, base, mistura,
  extra, tamanho, DJ, prato, mesa, toque) mostrando só o que a pessoa já sabe (o caderninho; combinação nunca testada
  mostra "Ainda não testou"), nos marcos (bônus e falta quanto), no desafio (prêmio) e no preço do nível. **Não entra**
  no pódio nem no resultado (já mostram tudo).
- Entrada nova no começo de `novidades.ts`.

## 4. Lugar 3: a camisetaria (drop de camiseta)

### 4.1 Montar uma coleção

| Escolha | No começo | No total (nível 25) |
|---|---|---|
| Tema da estampa | 6 | 30 |
| Estilo | 3 | 15 |
| Peça | 2 (camiseta, ecobag) | 6 (+ regata, boné, cropped, moletom) |
| Cor da peça | 4 | 12 |

- **Foco**: 10 pontos repartidos entre Arte, Tecido e Divulgação (cada um de 0 a 10).
- **Lote**: pequeno, médio ou grande (peças por lote crescem com o nível), pago em cupom pelo custo da peça × peças.
- **Nome** da coleção.
- Exemplos de tema: meme, praia, futebol, forró, anime, signo, crise financeira, Jampa raiz, gato, carro rebaixado.
  Exemplos de estilo: minimalista, vintage desbotado, grafite, pixel, tie-dye, bordado. A lista completa sai no plano,
  com o Juan aprovando os textos.

### 4.2 Lançar e a nota

- A produção leva 1 h (pequeno), 2 h (médio) ou 4 h (grande). Uma coleção por vez em produção ou à venda; dá para
  encerrar a venda antes (o estoque que sobra vira saldão a 50% do custo).
- Ao ficar pronta, **4 influencers** dão nota de 1 a 10 (inteira): @hojetemjp (a página de moda), @SuperMauro64
  (bordado, vintage e cor forte), @mcresenha (só usa camisa de time) e @luisviton (o crítico chato), nomes do Juan. Nota de cada um = base + gosto dele + sorte (±0,5), entre 1 e 10.
- Base (escondida, 0 a 10):
  - combinação tema × estilo (tabela escondida): ótima 9 · boa 7,5 · ok 6 · ruim 4 · péssima 2,5;
  - peça × tema: combina +1 · neutro 0 · não combina −1 (ex.: moletom −1 em quase tudo);
  - foco: distância entre o foco escolhido e o ideal escondido do estilo, até −3;
  - repetição: mesmo tema e estilo de uma das 3 últimas coleções −2; só o tema ou só o estilo da última −1;
  - tendência da semana (um tema em alta, igual para todos, sorteado pela semana): +1.
- Gostos: a página de moda +1 na tendência; a tia +1 em bordado/vintage e cores fortes; o primo +2 em futebol e −1 no
  resto; o crítico chato −1 sempre e +2 só em combinação ótima com foco certeiro.
- **Procura** (pessoas que querem a peça) = público do nível × (nota média / 10)² × (1 + √(fãs) / 30) × peça.
- **% de procura** = procura ÷ peças do **lote médio** do seu nível × 100. É o número do pódio e do placar. Medido
  contra o lote médio (e não o lote escolhido) para que lote pequeno não infle o pódio.
- A venda dura 12 h, sai em ritmo constante e rende `vendas × preço da peça` em cupom. Vendas = mínimo entre procura e
  estoque. **Sexta e sábado das 18h às 2h** (horário de Brasília) as vendas dobram.
- Procura que sobra depois de esgotar vira fã (metade). Toda coleção também dá fãs pela nota (nota média ≥ 7).
- Ao revelar, o caderninho anota a combinação tema × estilo com o rótulo dela ("Combinação ótima!") e peça × tema.
- **Relatório** (custa cupom): revela o foco ideal de um estilo que você já lançou.

### 4.3 Resultado e arte

- Tela de resultado: os 4 posts dos influencers (avatar, nota, comentário curto que depende da nota e do gosto), a % de
  procura e "esgotou" ou o encalhe.
- Arte (repositório): 30 estampas 16×16 (uma por tema), os 15 estilos como tratamento por código (contorno, pixelizar,
  desbotar, spray, bordado com pontilhado...), 6 peças 24×24 com a cor trocada na hora, 4 avatares de influencer.
  A foto do pódio é a peça na cor com a estampa no estilo.

### 4.4 Ajustes da implementação (parte 2)

- O lugar abre com **108 cupons** (o lote médio de camiseta no nível 1); cada lugar tem `moeda_inicial` no catálogo.
- **"O fornecedor fia"**: sem coleção ativa e sem cupom pro lote pequeno da peça, o lote pequeno sai de graça, no máximo
  1 vez a cada 24 h (o lote fiado não devolve nada no saldão).
- Fãs: a procura usa `1 + min(√fãs/30, 3)` (no máximo ×4) e os fãs do excesso de uma coleção têm teto de 20% do público
  do nível; fãs pela nota = `round(público × 0,1 × (média − 6))` com média ≥ 7. Constantes: público 75, cresce 1,35,
  preço da peça = custo × 6,5; relatório = 50 × 1,35^(nível−1).
- Desafios de procura: 300% e 600% (150%/250% ficavam automáticos).
- Tela: o caderninho completo (tabela 30 × 15, focos, relatório) abre no miolo do lugar; a faixa mostra o resumo.
  Trancados aparecem como um chip "nív. N +N" por grupo. Nenhuma barra de rolagem no PC (pedido do Juan).
- O tema Pagode virou um cavaquinho na estampa (o pandeiro não se lia em 16×16): conferir com o Juan.

## 5. Lugar 4: o copão (montar o copão)

### 5.1 Montar

| Escolha | No começo | No total |
|---|---|---|
| Base | 3 | 12 (vodka, cachaça, gin, catuaba, "whisky de posto"...) |
| Mistura | 4 | 15 (energético de vários sabores, suco, refri, xarope...) |
| Extra | 3 | 12 (limão, maracujá, morango, bala, gelo de coco...) |
| Tamanho | 2 (copo, copão) | 3 (+ balde) |
| DJ da sexta | 2 | 10 (piseiro, funk, brega-funk, eletrônica, sertanejo...) |
| Vagas no cardápio | 3 | 5 |

- Mais: **força** (1 a 10, a proporção base × mistura), **preço** (em fichas, entre 50% e 200% do preço de referência
  do tamanho) e **nome**.

### 5.2 A noite e a nota

- **O bar abre toda noite das 18h às 2h** (horário de Brasília), se você abriu a Fellas Inc. desde a noite anterior.
  Rende fichas pelas vendas.
- Na primeira noite de cada copão sai a **nota de 0 a 999** (fixa dali em diante):
  - sabor, 0 a 400: tabela escondida base × mistura, base × extra e mistura × extra;
  - custo-benefício, 0 a 250: preço contra volume e força;
  - moda, 0 a 150: o "copão da moda" da semana (uma base ou mistura em alta, igual para todos);
  - aguenta, 0 a 199: perto do ponto escondido de força da base é o máximo; até 1 acima do ponto ainda sobe; longe cai.
- **PT**: força acima do ponto da base dá chance de PT por noite = (força − ponto) × 10%. Noite com PT: a galera cai 15%
  e o chat mostra o PT. A nota não muda.
- **Movimento** = galera × atração do cardápio. Venda repartida entre os copões pela nota × novidade. A novidade cai 10%
  por noite (mínimo 30%). Dois copões com a mesma base e a mesma mistura perdem 30% cada.
- **Sexta**: movimento ×2, e o DJ escolhido dá +20% nos copões das bases que combinam com o estilo dele.
- Galera: sobe com nota ≥ 600, desce com nota < 300 e com PT.

### 5.3 Resultado e arte

- Tela de resultado: **chat da galera ao vivo** (mensagens curtas zoeira geradas pela nota, pelas partes e pelo PT:
  "isso aí é só energético", "balde a esse preço é assalto", "DEU PT NO MEU PRIMO") e a nota subindo até o número final.
- Arte: 3 recipientes (copo, copão, balde) com o líquido na mistura das cores da base e da mistura, 12 extras, gelo,
  10 DJs (feitos com o kit de personagem). A foto do pódio é o recipiente montado.

## 6. Lugar 7: o jantar (primeiro encontro + crítico)

### 6.1 O menu da semana

- Menu de 3 tempos: entrada (10 no total, 3 no começo), principal (12, 4 no começo) e sobremesa (10, 3 no começo).
  Pratos franceses com toque daqui (escargot de sururu, ratatouille de macaxeira, bourguignon de carne de sol, crème
  brûlée de cocada...). Pode trocar o menu quando quiser; cada noite usa o menu daquela noite. **Nome** do menu.
- Cada prato tem atributos: doce/salgado, clássico/ousado, francês/regional, e se serve vegano e sem lactose.
- Tabela escondida de harmonia entre os tempos (entrada × principal, principal × sobremesa).

### 6.2 As noites (gorjeta)

- **Toda noite das 19h às 23h** (horário de Brasília), se você abriu a Fellas Inc. desde a noite anterior.
- Chegam de 2 a 8 casais (cresce com a reputação). O **livro de reservas** mostra a noite seguinte: cada pessoa tem 4
  traços escondidos (paladar, ousadia, origem, restrição) e o perfil público revela 1 de cada pessoa, com texto zoeira
  ("ela é vegana?", "ele é do agro", "match do Tinder").
- Para cada casal você escolhe a **mesa** (vista: cidade; praia no nível 5; pôr do sol no nível 12) e **um toque do chef**
  (mais ousado, mais clássico, mais regional, mais leve; 2 no começo, 4 no total). Casal sem escolha vai pra mesa da
  cidade sem toque.
- Encontro (0 a 100) = quanto o menu agrada os traços dos dois + toque + vista preferida do casal + sorte.
  ≥ 70 **casal formado** (gorjeta cheia), 40 a 69 **encontro morno** (metade), < 40 **desastre** (nada).
- Toda noite, para cada casal, a **cozinha aberta solta uma pista** que revela um traço escondido ("ele pediu sal",
  "ela olhou o prato do vizinho a noite toda"). As pistas vão pro caderninho por tipo de perfil.
- 10% dos casais formados voltam depois (2 a 6 semanas) para o **aniversário de namoro**, com os traços já conhecidos e
  gorjeta ×3.

### 6.3 O crítico (pódio)

- Uma noite por semana, sorteada por pessoa e escondida até acontecer, vem o crítico. Nota do menu daquela noite em
  **estrelas de 0,0 a 5,0 (uma casa decimal)**:
  - harmonia dos tempos: 0 a 2,0;
  - assinatura (ousadia e toque regional do menu): 0 a 1,0;
  - nível da cozinha (o nível do lugar): 0 a 1,0;
  - casais felizes da semana até ali (% de formados): 0 a 1,0.
- Resultado numa **cartinha do crítico** cheia de frescura (texto montado pelas notas de cada parte).
- Estrelas sobem a reputação (mais casais e casais que pagam mais). **O pódio mostra o menu (3 pratos + nome) com as
  estrelas.** Placar da semana: estrelas da semana (desempate: casais formados na semana).

### 6.4 Arte

- 32 pratos 16×16 no prato branco, toalha, 3 fundos de vista, retrato do crítico, casais feitos com o kit de personagem.
  A foto do pódio: os 3 pratos lado a lado na toalha com a vista ao fundo.

## 7. Conquistas do lote 1

12 conquistas novas no catálogo (textos em `nomes.ts`, catálogo gerado com `ATUALIZAR_CATALOGO`, paridade com o banco
no teste de conquistas), ícones 16×16 no estilo das outras:

| Nome | Condição |
|---|---|
| Rolê marcado | Abrir o primeiro lugar |
| Conhece a cidade | Abrir os 3 lugares do lote 1 |
| Dono do pedaço | Ser o 1º da semana em algum lugar |
| Tá no pódio | Entrar no pódio de algum lugar |
| Esgotou | Coleção com 200% de procura |
| Coleção encalhada | Coleção com menos de 20% de procura (escondida) |
| Quatro dez | Coleção com nota 10 dos 4 influencers |
| Nota mil (quase) | Copão com nota 900+ |
| Deu PT | Ter PT numa noite (escondida) |
| Cupido | 10 casais formados |
| Aniversário de namoro | Receber um casal de volta |
| Cinco estrelas | 5,0 estrelas do crítico |

As frases saem no plano, no tom das conquistas novas (humor ácido), para o Juan aprovar.

## 8. Banco (resumo técnico)

- Migrações novas a partir da 0056: catálogo do mapa e do lote 1 (gerado pelo `catalogo.test.ts`, nunca editando as
  antigas) e uma por parte (moldura, camisetaria, copão, jantar). Cada uma entra também em `games/test/db.ts` e
  `games/dev/mockDb.ts`.
- Tabelas privadas: `idle_places` (id, nome, frase, ícone, x, y) e `idle_map` (png), só `select` para membros, vazias
  depois da migração até o Juan rodar o `carregar.sql`.
- Tabelas da moldura: `idle_place_state` (jogador × lugar: aberto, moeda, nível, fãs, marcos, avançado até),
  `idle_place_prod` (produções: jogador, lugar, nome, partes, número, quando), `idle_place_notes` (caderninho),
  `idle_place_challenges` (desafio feito na semana), `idle_place_weeks` (foto da semana por lugar).
- Catálogo público (sem nome real): `idle_cat_place` (id, faixa, horas, era, lote, custo_base), marcos, desafios e o
  conteúdo de cada mecânica (temas, estilos, peças, cores, bases, misturas, extras, DJs, pratos, toques e as tabelas
  escondidas). As tabelas escondidas ficam fora do `select` dos membros (só as funções leem), senão o caderninho perde
  a graça.
- Funções `idle_place_*` (abrir, estado em json, subir nível, pódio, desafio) e `idle_tee_*`, `idle_cup_*`,
  `idle_din_*` para cada mecânica, todas `security definer` com a trava `idle_lock`.
- `idle_rate_at` ganha `* public.idle_place_mult(s)` (marcos, Monopólio, Marca forte).
- Contas espelhadas em TypeScript (`mapa.ts`, `camisetaria.ts`, `copao.ts`, `jantar.ts`) com teste de paridade TS × SQL,
  como a Horta e os Convidados.

## 9. Testes e metas de balanceamento

- Banco (PGlite): abrir (preço, era, sem dinheiro), avanço determinístico, ciclo como teto, nota de cada mecânica,
  PT, crítico, pódio (uma vez por pessoa, empate), placar e foto da semana, desafio uma vez por semana, marcos no
  `idle_rate_at`, RLS das tabelas privadas e escondidas.
- Simulação (como `simulacao.test.ts`), jogando 3 vezes por dia com escolhas medianas:
  - nível 10 em cerca de 1 semana e nível 25 em cerca de 6 semanas em cada lugar;
  - nota média de quem joga "no chute" entre 4,5 e 5,5 (era 5–6; os gostos fixos dos influencers puxam pra baixo); de quem usa o caderninho, 8+ em 2 semanas;
  - nenhum lugar rende mais de 3× outro do mesmo nível em marcos por semana.
- Telas (jsdom): mapa com os 3 estados de pino, cada lugar, pódio, caixinhas, celular sem caixinha.

## 10. Fora deste lote

Lotes 2 e 3 (6 lugares), notificação no app (o Juan não quer), trocar moeda de lugar por F$, pódio da semana separado
(só o de sempre), qualquer forma de tomar ou atrapalhar o lugar de outra pessoa.
