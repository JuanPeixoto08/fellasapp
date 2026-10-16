# Fellas Inc.: a árvore grande (entrega 6, antecipada)

Data: 15/10/2026. Worktree `fellasapp-arvore`, branch `arvore-grande` (da main 56614bbc).

## 1. Por quê

As eras 6 e 7 saíram em 15/10 e os veteranos passaram por elas em horas. Medido no banco de produção na mesma noite
(só leitura):

| Jogador | Era | Pontos ganhos na vida | Nós (de 31) | A venda agora daria |
|---|---|---|---|---|
| 1 | 7 | 442 | 31 | 1.551 |
| 2 | 7 | 355 | 31 | 6.895 |
| 3 | 7 | 232 | 25 | 4.019 |
| 4 | 7 | 56 | 14 | 138 |

Os três maiores têm de 50 a 100 de cada gerador 31–42, umas 300 melhorias e produzem ~10¹⁸ F$/s. A árvore de hoje
custa 355 pontos no total. Os pontos crescem ~×74 por era nova (raiz cúbica do F$/s), então uma venda na era 12 daria
milhões.

Objetivo: **a árvore cresce muito e vira o lugar onde os pontos valem**, com portões e preços calibrados pelos veteranos
(a parte fixa leva umas 2–3 semanas pra eles) e nós infinitos que absorvem qualquer quantidade de pontos até a era 12.

Decisões do Juan (15/10):
- Escala: **nós fixos + nós infinitos**.
- Força: **acelera, mas com freio** — os nós de produção novos somam entre si; a árvore cheia (sem infinitos) deixa a
  produção ~10–20× maior que hoje; infinitos dão pouco por nível.
- Ramos novos abrem **junto com o recurso**.
- Dificuldade: **portões na árvore** (esta entrega) e **eras 8–9 íngremes** (entrega 2, calibrada pelos veteranos com a
  árvore cheia). Desafios de venda ficam pra depois.
- Ajustes de balanceamento aprovados: Dourados com frequência máxima 2,5× (o nó 10 vira Investidor 90 min e o infinito
  mexe no Investidor); Gente com contratado no máximo 20% (o nó 10 vira contratos de 21 dias e o infinito barateia o
  contrato); o infinito do Recomeço multiplica o F$ inicial (nada que gere ponto).
- Taste Engine na tela nova (consultas já feitas no desenho, seção 7) e de novo na execução.

Os 31 nós de hoje **não mudam** (ninguém perde o que comprou; ids, efeitos e preços iguais).

## 2. Estrutura

- **10 ramos.** Os 6 de hoje (1 Produção, 2 Recomeço, 3 Oportunidades, 4 Dourados, 5 Gente, 6 Horta) ganham os nós 6–10
  e um infinito. Entram 7 Bolsa, 8 PPP Podcast, 9 Mapa do rolê e 10 Espaço, com 10 nós e um infinito cada.
- **9 pontes** entre ramos vizinhos (seção 5).
- Total: 31 de hoje + 30 (nós 6–10) + 40 (ramos novos) + 10 infinitos + 9 pontes = **120 nós** (89 novos com ícone).
- **Ordem na copa** (da esquerda pra direita): Horta · Mapa · Gente · PPP · Recomeço | Produção · Espaço · Oportunidades
  · Bolsa · Dourados. A raiz no meio, embaixo.

### Ids (o esquema `ramo·10 + posição` não passa de 9 nós por ramo)
- Os 31 de hoje mantêm o id (1, 11–15 … 61–65).
- Nós novos: `ramo·100 + posição` → 106–110 … 606–610 (nós 6–10 dos ramos de hoje), 701–710 (Bolsa), 801–810 (PPP),
  901–910 (Mapa), 1001–1010 (Espaço).
- Pontes: 2001–2009. Infinitos: `3000 + ramo` (3001–3010).

### Pré-requisitos
- Nó `p` pede o `p−1` do mesmo ramo (o 106 pede o 15). O nó 1 dos ramos novos pede a raiz.
- Ponte pede o nó 5 dos dois ramos vizinhos: coluna nova `requer2` em `idle_cat_no` (nula nos outros).
- Infinito pede o nó 10 do ramo.

### Portões (além dos pontos)
Colunas novas em `idle_cat_no`: `req_vendas int`, `req_era int` (nulas = sem portão).

| Nós | Portão |
|---|---|
| 6 e 7 dos ramos de hoje | 3 vendas |
| 8 a 10 dos ramos de hoje | ter chegado na era 7 alguma vez |
| Bolsa, PPP, Mapa (todos) | o recurso aberto: a era em que o recurso abre hoje (a Bolsa abre com o gerador 19 → era 4; o plano confere Convidados e Mapa no código) |
| Espaço 1–5 / 6–10 | era 6 / era 7 alcançada |
| Pontes | 5 vendas |
| Infinitos | 10 vendas |

- **Maior era alcançada:** coluna nova `idle_state.era_max int` (não zera na venda), atualizada sempre que o estado é
  gravado (`greatest(era_max, idle_era(generators))`). Backfill: a era atual de cada linha.
- O banco recusa a compra com erro próprio (`idle_gate`); a tela mostra o motivo: "Falta: chegar na era 7 (você chegou
  na 6)", "Falta: 3 vendas (você tem 1)", "Abre com a Bolsa".

### Infinitos
- Coluna nova `idle_arvore.nivel int not null default 1` (os 31 de hoje e os fixos ficam com 1).
- Comprar um infinito que já tem: `nivel + 1`. Preço do nível `n` (o próximo): `1000 · 1,6^(n−1)` (nível 1 = 1.000,
  10 ≈ 68,7 mil, 20 ≈ 7,9 mi), conta em `bigint`; o banco recusa se passar dos pontos livres. Pontos são `int` com teto
  de 1e9 (`idle_prestige_total`), então o nível máximo prático é ~29. Teste de borda: nível 30 não estoura.
- `idle_json`: `bonus.arvore` continua a lista de ids; entra `bonus.niveis` = `{ "<id>": nivel }` só dos infinitos.

## 3. Preços

| Faixa | Preços (posição 1 → 10) |
|---|---|
| Nós 6–10 dos ramos de hoje | 60, 120, 250, 500, 1.000 |
| Bolsa, PPP, Mapa | 30, 60, 120, 250, 500, 800, 1.200, 2.000, 3.000, 5.000 |
| Espaço | 500, 800, 1.200, 2.000, 3.500, 6.000, 10.000, 16.000, 25.000, 50.000 |
| Pontes | na tabela da seção 5 (2.000 a 20.000) |
| Infinitos | 1.000 · 1,6^(n−1) |

Ponto de partida; a calibração (seção 8) pode mexer só nestas tabelas e nos valores dos efeitos marcados como
"calibrável", nunca nos 31 nós de hoje.

## 4. Conteúdo dos ramos

Formato: nó · nome · efeito. "Soma" = entra na soma de produção (seção 6). Tipos novos entre crases (o plano dá o nome
final).

### 1 · Produção (soma)
| Nó | Nome | Efeito |
|---|---|---|
| 6 | Coach quântico | +20% |
| 7 | Planilha com macro | +30% |
| 8 | Reunião cancelada (podia ser um e-mail) | +50% |
| 9 | Home office na praia | +75% |
| 10 | Faria Limer | +100% |
| ∞ | Hora extra infinita | +5% por nível |

### 2 · Recomeço
| Nó | Nome | Efeito |
|---|---|---|
| 6 | Poupança da vó | O Abrir CNPJ começa com F$ 1 bi |
| 7 | Kit primeiro emprego | Começa com 1 de cada gerador das eras 1 e 2 (`inicio_eras` = 2) |
| 8 | Clube de investimento do grupo | Começa com F$ 1 tri |
| 9 | Mochilão na Europa | 1 de cada gerador das eras 1 a 3 |
| 10 | Nepo baby | 1 de cada gerador das eras 1 a 4 |
| ∞ | Abrir outra startup | O F$ inicial ×10 por nível |

### 3 · Oportunidades
| Nó | Nome | Efeito |
|---|---|---|
| 6 | Cofrinho de porquinho | A Caixinha guarda 6 |
| 7 | Notificação fixada | Oportunidades ficam 45 s na cena |
| 8 | Black Friday de verdade | +3 por dia (com o 3.3, +6) |
| 9 | Cupom empilhado | Oportunidades rendem ×1,5 (com o 3.4, ×3) |
| 10 | Gaveta das sacolinhas | A Caixinha guarda 8 |
| ∞ | Cliente fiel | Oportunidades em F$ +2% por nível |

### 4 · Dourados
| Nó | Nome | Efeito |
|---|---|---|
| 6 | Óculos novo | Eventos ficam 36 s na tela |
| 7 | Tubarão do Shark Tank | Investidor rende 60 min (era 40) |
| 8 | Trevo de quatro folhas | Eventos aparecem 2,5× mais (teto do ramo) |
| 9 | Trend do TikTok | Viralizou e Promoção duram 3× |
| 10 | Gato da sorte da loja chinesa | Investidor rende 90 min |
| ∞ | Sorte de principiante | Investidor +2% por nível |

### 5 · Gente
| Nó | Nome | Efeito |
|---|---|---|
| 6 | Vale-refeição de verdade | Contratados rendem 20% (teto) |
| 7 | CLT premium | Contratos duram 14 dias |
| 8 | Passe do Neymar | Quem te contrata rende 3× pra você |
| 9 | Estágio "pela experiência" | Contratar custa 70% menos |
| 10 | Day off no aniversário | Contratos duram 21 dias |
| ∞ | Happy hour da firma | Contratar −2% por nível (o preço nunca fica abaixo de 10% do preço cheio) |

### 6 · Horta
| Nó | Nome | Efeito |
|---|---|---|
| 6 | Fertilizante do vizinho | Amadurece 40% mais rápido |
| 7 | Estufa | Plantas vivem 2× depois de maduras |
| 8 | Abelha rainha | Cruzamento 3× mais fácil |
| 9 | Transgênico gourmet | Bônus das plantas ×2 (descontos seguem até 50%) |
| 10 | Festival do Morango do Amor | Morango com Pescoço 10× mais |
| ∞ | Adubo orgânico premium | Bônus das plantas +5% por nível |

### 7 · Bolsa (abre com a Bolsa)
| Nó | Nome | Efeito |
|---|---|---|
| 1 | Corretora "sem taxa" | Corretagem −20% |
| 2 | Conta no exterior | +50 no limite de ações |
| 3 | Grupo de sinais no Telegram | +1 espiada grátis por dia |
| 4 | Home broker no celular | +100 no limite |
| 5 | Tio do Bitcoin | Corretagem pela metade |
| 6 | Escritório na Faria Lima | Bônus do escritório ×1,5 |
| 7 | Analista do YouTube | +1 espiada grátis por dia (2) |
| 8 | Fundo exclusivo | +200 no limite |
| 9 | Corretagem zero (dessa vez é verdade) | Corretagem ×0,25 |
| 10 | Lobo de Wall Street | Limite de ações ×2 |
| ∞ | Fundo de índice | Limite +5% por nível |

Espiada grátis por dia: um crédito de espiar que volta todo dia (o plano escolhe o corte, coerente com a Caixinha).
Corretagem: o menor fator comprado vale (0,8 → 0,5 → 0,25).

### 8 · PPP Podcast (abre com os Convidados)
| Nó | Nome | Efeito |
|---|---|---|
| 1 | Microfone de lapela | Trocas recarregam 25% mais rápido |
| 2 | Mesa de som | +1 troca (4) |
| 3 | Cadeira gamer | A 2ª cadeira vale 75% (era 50%) |
| 4 | Corte pro TikTok | O convidado cai 15% das vezes (era 25%) |
| 5 | Patrocínio de casa de aposta | Efeito dos convidados +10% |
| 6 | Produtor que não dorme | Trocas recarregam 2× mais rápido |
| 7 | Sofá do estúdio | A 3ª cadeira vale 50% (era 25%) |
| 8 | Pauta roubada do concorrente | +1 troca (5) |
| 9 | 10 milhões de views | Efeito dos convidados +25% (com o 5, +35%) |
| 10 | Virou programa de TV | O convidado cai 5% das vezes |
| ∞ | Corte viral | Efeito dos convidados +2% por nível |

"Efeito dos convidados": multiplica a parte positiva do bônus de cada convidado sentado (o plano define a conta exata,
igual na página e no banco).

### 9 · Mapa do rolê (abre com o Mapa)
| Nó | Nome | Efeito |
|---|---|---|
| 1 | Rolê de quinta | Abrir lugar custa 25% menos |
| 2 | Vaquinha dos parças | Subir nível custa 20% menos |
| 3 | Check-in no Instagram | Bônus dos marcos ×1,25 |
| 4 | Influencer de bairro | Camisetaria: público +15% |
| 5 | Open bar até meia-noite | Copão rende ×1,25 |
| 6 | Promoter que conhece o dono | Abrir lugar custa 50% menos |
| 7 | Nome na lista | Subir nível custa 40% menos |
| 8 | Rolê que virou lenda | Bônus dos marcos ×1,5 |
| 9 | Drop esgotado | Camisetaria vende em metade do tempo |
| 10 | After até o sol nascer | Copão rende ×1,5 |
| ∞ | Rolê infinito | Marcos +3% por nível |

### 10 · Espaço (abre na era 6; 6–10 pedem a era 7)
| Nó | Nome | Efeito |
|---|---|---|
| 1 | Treino na NASA | Cada destroço do Lixo espacial vale 15 min (era 10) |
| 2 | Rolo extra de silver tape | Silver tape dura 3 min |
| 3 | Antena voltada pra Terra | Legado ×1,25 |
| 4 | Combustível de foguete | Geradores das eras 6+ +25% |
| 5 | TARS, honestidade 90% | Eventos de era aparecem 1,5× mais |
| 6 | Fita prateada industrial | Silver tape vira ×5 |
| 7 | Mensagem de casa | Legado ×1,5 |
| 8 | Motor de dobra | Geradores das eras 6+ +50% |
| 9 | Ancoragem manual | Eventos de era ficam 2× mais tempo na tela |
| 10 | Endurance | Geradores das eras 6+ +100% |
| ∞ | Buraco de minhoca | Geradores das eras 6+ +5% por nível |

Os "+%" dos geradores das eras 6+ somam entre si num fator próprio (só nesses geradores). Legado: o maior fator comprado
multiplica o `p` de todos os legados. As janelas dos eventos de era dobram também no banco (a regra de aceitar 3 s a mais
continua).

## 5. Pontes (soma na produção)

| Id | Nome | Entre | Efeito | Preço |
|---|---|---|---|---|
| 2001 | Feira orgânica no rolê | Horta e Mapa | +15% | 2.000 |
| 2002 | A firma fechou o bar | Mapa e Gente | +15% | 2.500 |
| 2003 | Estagiário virou convidado | Gente e PPP | +20% | 3.000 |
| 2004 | Podcast da startup que faliu | PPP e Recomeço | +20% | 4.000 |
| 2005 | Pivotou | Recomeço e Produção | +25% | 6.000 |
| 2006 | Fábrica em órbita | Produção e Espaço | +25% | 20.000 |
| 2007 | Frete grátis pra Lua | Espaço e Oportunidades | +25% | 15.000 |
| 2008 | Promoção relâmpago no home broker | Oportunidades e Bolsa | +20% | 5.000 |
| 2009 | Dica quente do investidor anjo | Bolsa e Dourados | +25% | 8.000 |

## 6. A conta

- **Soma de produção (fator novo):** `1 + Σ` de todos os "soma" comprados (Produção 6–10, pontes, infinito da Produção
  × nível). Multiplica por cima do `producao` de hoje (os 31 nós continuam multiplicando como sempre). Com tudo fixo:
  1 + 2,75 + 1,90 = ×5,65.
- **Eras 6+:** `1 + Σ` dos nós do Espaço (+1,75 fixo, + 0,05 por nível do infinito), só nos geradores 31+.
- Veterano com a árvore fixa cheia: ~×5,65 × ~×2,75 ≈ ×15 na produção (alvo 10–20×). Infinitos: +5% por nível na soma.
- Tudo igual na página (`economia.ts`/`efeitosArvore`) e no banco (`idle_gen_rendas`, mantendo os CTEs `materialized`
  da 0079), com o teste de paridade que já existe (`idleParidade`: cada nó sozinho + 30 conjuntos ao acaso, agora com
  níveis de infinitos).
- Efeitos fora da produção: cada um no lugar que já aplica o tipo parecido hoje (o levantamento de 15/10 lista onde),
  com paridade quando o banco também usa.
- Teto de 50% dos descontos da Horta continua. Frequência dos Dourados tem teto 2,5× (nó 4.8).

## 7. Tela (Taste Engine)

Consultas ao `lookup_slop` feitas no desenho (15/10) e o que mudou por causa delas:

1. *"120 ícones iguais em leque, mesma moldura"* → **hierarquia por tamanho e forma**, não só por cor: nó comum 1×;
   nó 10 de cada ramo 1,5× com moldura dupla; infinito com moldura própria (losango de pixel) e o nível escrito embaixo;
   ponte com moldura própria, entre os dois ramos. O caminho comprado de cada ramo fica com a linha acesa e mais grossa.
2. *"Estado só pela cor da borda"* (daltonismo, brilho sem sistema) → o estado também tem **forma**: comprado = moldura
   cheia + ícone aceso; dá pra comprar = traço lilás (a regra do jogo pra "ativo") + o preço numa moedinha embaixo;
   falta ponto = preço apagado; portão = cadeado + o motivo no cartão; trancado = silhueta escura.
3. *"Mapa enorme no celular, procurar o que comprar"* → **foco e visão geral**: o Abrir centraliza no nó mais barato que
   dá pra comprar; uma fileira de botões de ramo (os 10 ícones de ramo) pula pro ramo; zoom (pinça e botões +/−) com a
   copa inteira legível no zoom mínimo; a raiz e os rótulos dos ramos sempre à vista ao arrastar.
4. *"Painel de resumo = 3 linhas e um botão roxo"* (cara de molde) → o quadro do Legado mostra **a silhueta da copa
   feita de 10 barrinhas de progresso** (uma por ramo, na ordem da copa) + pontos livres; o botão de ação (roxo, a única
   coisa roxa) traz o próximo nó dentro dele: ícone + "Coach quântico · 60".
5. *"Cartão de detalhe"* → hierarquia por tipografia (nome em Jersey 10 grande, efeito, preço, portão), **sem borda
   colorida num lado só**; no infinito: "nível 7 → 8" e o preço do próximo.

Regras fixas: pixel, Jersey 10, cantos de pixel; roxo cheio só no botão de comprar/abrir; ativo = traço lilás; nada de
rótulo com fundo dourado cheio. CSS novo fora do `idle.css` (arquivo próprio), tokens do `idle.css`. Caixinha de
informação nos nós novos (mouse/teclado, nada no celular) dizendo o que o nó dá **agora** em números da pessoa. Na
execução, cada escolha nova passa de novo no Taste Engine. O Juan vê rodando local (PC e celular) antes de publicar.

Ícones: 89 novos de 16×16 (`assets/arvore/no-<id>.png`), mesmo processo das outras artes; o Juan aprova a folha.

## 8. Calibração e verificação

- **Simulação de quem começa do zero** (a de sempre): os ritmos de hoje continuam (era 5 no dia 3, gerador 30 no dia 8,
  eras 6–7 nos dias 10 e 16) com a árvore nova no `gastar` (efeitos que a simulação não modela entram em `NAO_ACELERA`).
- **Simulação do veterano:** um retrato do estado do jogador mais avançado, copiado do banco só com leitura e sem
  identificação (geradores, melhorias, estratégias, nós, pontos, vendas, era_max), vira fixture. Mede: em quantos dias de
  jogo ativo com vendas ele fecha a parte fixa da árvore (**alvo 14–21 dias**) e quanto a produção dele sobe. Se sair do
  alvo: mexer só nas tabelas de preço da seção 3 e nos valores "calibrável".
- Paridade página × banco em todos os tipos novos; teste dos portões (cada motivo de recusa); teste dos infinitos
  (nível sobe, preço, borda de `bigint`/teto de pontos); `era_max` não zera na venda e o backfill.
- Banco: catálogo gerado (0080) + migração à mão (0081: colunas, `idle_buy_node`, `idle_json`, conta). Conferir antes do
  push que os números estão livres. db push → conferir colunas e contagens → merge e push.
- Patch notes no começo de `novidades.ts`.

## 9. Fora desta entrega

- Desafios de venda (recomeçar com regra difícil por recompensa grande).
- Eras 8–9 (entrega 2): curva bem mais íngreme e ritmo medido a partir dos veteranos com a árvore cheia.
- Mudar a fórmula dos pontos ou os 31 nós de hoje.
