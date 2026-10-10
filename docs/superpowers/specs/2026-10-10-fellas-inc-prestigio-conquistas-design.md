# Fellas Inc., entrega 3: prestígio e conquistas

Data: 10/10/2026. Status: aprovada pelo Juan (10/10).
Base: `docs/superpowers/specs/2026-10-10-fellas-inc-design.md` (o jogo, sem reset) e a entrega 2 (contratos de 7 dias,
personagem). Esta spec só acrescenta; o que não está aqui segue a base.

## Resumo

A Fellas Inc. não zera sozinha. Recomeçar passa a ser escolha: **"Vender a startup"** troca a empresa inteira por
**pontos de prestígio**, calculados pelo seu F$/s na lógica do Cookie Clicker. Os pontos são moeda: você gasta numa
**árvore de habilidades** (5 ramos, ~25 nós) e são os nós comprados que dão os efeitos, para sempre. **Conquistas** (umas 75, algumas escondidas, de zoeira) dão +1% cada, também para sempre. As duas coisas são o
jogo de longo prazo de quem já chegou longe, sem tirar a graça de quem começa agora.

## Decisões já tomadas (Juan, 10/10)

- Prestígio é escolha do jogador, a qualquer hora; os pontos dependem do F$/s, na lógica do Cookie Clicker.
- No prestígio fica **só** o que é permanente: pontos de prestígio, nós da árvore, conquistas e personagem.
- Pontos de prestígio NÃO aumentam a produção sozinhos: servem para comprar nós de uma árvore de habilidades (Juan,
  10/10, depois de ler o plano). Ponto guardado não faz nada.
- Conquistas de contagem (melhorias compradas, oportunidades pegas…) contam a vida toda, somando todas as empresas.
- Conquistas dão um pouquinho de produção (+1% cada). As escondidas de zoeira são combinadas com o Juan (seção 3.3).
- Os contratos que você FEZ acabam quando você vende; quem te contratou continua com você até o contrato vencer.
- Entra como entrega 3; as propriedades passam a ser a entrega 4.
- Continua valendo: o banco é a autoridade; nada de créditos do cassino; sem reset semanal (só a foto de segunda).

## 1. Prestígio ("Vender a startup")

### 1.1 Pontos

- `pontos_totais(r) = floor(cbrt(r / K))`, em que `r` é o F$/s no momento da venda (sem o ×5 das oportunidades) e `K`
  sai da simulação (1.4).
- Ao vender, você ganha `max(0, pontos_totais(r) − pontos_já_ganhos_na_vida)` (gastos na árvore ou não). Vender de novo no mesmo ritmo não rende
  nada: para ganhar mais, precisa bater o próprio recorde. É a regra do Cookie Clicker (lá pelo total produzido; aqui,
  pedido do dono, pelo F$/s).
- Só dá para vender se isso render pelo menos 1 ponto (senão o botão fica apagado com "Ainda não compensa").

### 1.2 O que acontece na venda

- Zera: valuation, geradores, melhorias, estratégias das eras, boost e "próxima compra pela metade".
- A empresa volta para "Abrir CNPJ" (cena "antes"); o "Abrir CNPJ" dá o F$ 10 e o notebook de sempre.
- Os contratos que você fez vencem na hora (`ends_at = agora`), com a conta dos contratados fechada antes (nada
  retroativo, como na entrega 2). Quem te contratou continua.
- Ficam: pontos (ganhos e não gastos), nós da árvore, número de vendas, conquistas, personagem, o limite diário de
  oportunidades (não reabre a cota do dia) e o recorde de F$/s.
- Os nós do ramo Recomeço valem na hora do novo "Abrir CNPJ" (dinheiro inicial, notebooks, melhorias gerais mantidas…).
- Confirmação antes: folha com "Vender a startup? Você ganha N pontos pra gastar na árvore e recomeça do zero." e os
  botões "Vender" / "Deixa quieto".

### 1.3 Árvore de habilidades

Um nó raiz e 5 ramos de 5 nós. Cada nó custa pontos e exige o nó anterior do ramo (e a raiz). Comprado, fica pra sempre
(nem a venda tira). Custos por posição no ramo: 2 · 4 · 8 · 15 · 30 (a raiz custa 1). Valores finais saem da simulação;
ponto de partida:

| Ramo | Nós (na ordem) |
|---|---|
| Raiz | **Fundador** (1): abre a árvore; +5% de produção |
| Produção | +10% · +25% · +50% · +100% · ×2 em tudo (multiplicam entre si) |
| Recomeço | começa com F$ 1 mil · começa com 10 notebooks · a venda mantém as 20 melhorias gerais · começa com F$ 1 mi · começa com 1 de cada gerador da era 1 |
| Oportunidades | caixinha guarda 4 · validade 6h · +3 por dia · bônus ×2 · caixinha guarda 5 |
| Tempo | teto do offline 12h · 16h · 24h · 36h · 48h |
| Gente | contratar 25% mais barato · seus contratados rendem 15% (no lugar de 10%) · contrato dura 10 dias · quem te contrata rende o dobro pra você · contratar 50% mais barato |

- Tudo que mexe na produção, no teto ou nos contratos existe igual no banco e em `economia.ts` (paridade).
- A primeira semana rende uns 15 pontos; completar a árvore leva meses (de propósito).
- O placar mostra os pontos ganhos na vida ("★ 37").

### 1.4 Ritmo (simulação)

A simulação ganha um jogador que vende e gasta na árvore (sempre o nó mais barato que acelera). Alvos:
- Primeira venda que vale a pena (≥ 5 pontos) por volta do dia 3 ou 4 de jogo (era 4/5).
- Depois de vender e gastar ~10 pontos, voltar à era em que estava é mais rápido que da primeira vez (medir e travar).
- `K` e os alvos viram asserções, como os marcos de hoje.

## 2. Bônus juntos

`taxa = base × melhorias × estratégias × contratos × nós de produção da árvore × (1 + 0,01 × conquistas)`. A taxa do
placar (F$/s) já inclui tudo. A foto de segunda continua usando a taxa da meia-noite.

## 3. Conquistas

### 3.1 Regras

- Cada conquista: id, nome, frase de piada, ícone (16x16, por código, como os das melhorias), condição e se é escondida.
- O banco confere as condições a cada ação que pode mudar alguma (comprar, pegar oportunidade, escolher estratégia,
  contratar, ser contratado, vender, abrir o jogo) e grava as novas com a data. O jogo só mostra.
- Ganhou, não perde (mesmo depois de vender a startup).
- +1% de produção cada, para sempre.

### 3.2 Lista visível (~65)

| Grupo | Conquistas |
|---|---|
| Geradores (30) | ter 100 de cada gerador, cada uma com nome próprio (ex.: 100 estagiários = "Estágio não remunerado em escala") |
| F$/s (8) | 1 · 100 · 10 mil · 1 mi · 1 bi · 1 tri · 1 quatri · 1 quinti |
| Eras (5) | chegar nas eras 2, 3, 4, 5 e ter o gerador 30 |
| Melhorias (3) | 10, 50 e 150 compradas |
| Oportunidades (4) | 1, 25, 100, 500 pegas |
| Prestígio (4) | vender 1, 5, 10 e 25 vezes |
| Gente (6) | contratar 1, 10, 50; ser contratado 1, 10, 50 |
| Estratégias (2) | já ter usado as 3 opções de uma era; ter usado todas as opções ligadas |

Nomes com referência, no estilo do Cookie Clicker (revisados em 10/10; os de gerador ficam como o plano escreveu):
Pix caindo (100/s, "Já paga o iFood.") · O leão acordou (10 mil/s, "O contador começou a te ligar.") · Acumulou!
(1 mi/s, "Uma Mega da Virada a cada segundo.") · Bilionário de LinkedIn (1 bi/s, "A Forbes mandou e-mail.") · Casa da
Moeda (1 quinti/s, "O dinheiro do mundo acabou. Você imprimiu mais.") · Saiu da casa dos pais (era 2, "A garagem é o
novo quarto.") · Tem até catraca (era 3, "E crachá com foto ruim.") · Ao infinito e além (gerador 30, "Do quarto pra
Marte.") · Placa de vídeo nova (10 melhorias) · Coach de produtividade (50) · Tudo pela família (150, "Não tem mais o que
melhorar. Ou tem.") · Black Friday (1ª oportunidade) · Caça-promoção (25, "Vê desconto de longe.") · Sniper (500,
"Quinhentas. Você dorme?") · Unicórnio em série (10 vendas, "Dez exits no currículo.") · Virou jurado do Shark Tank
(25 vendas) · Passe valorizado (contratado 10 vezes, "Dez empresas te quiseram."). Os demais, como o plano escreveu.

### 3.3 Escondidas (zoeira; só aparecem quando alguém consegue)

Ideias do Juan e da pesquisa (outubro de 2026), aprovadas. A do "Vitor" (boneco do jogo BBB) entra depois, quando o Juan explicar a piada (migração nova de catálogo):

| Nome | Condição | Frase |
|---|---|---|
| **6-7** | ter exatamente 67 unidades de algum gerador | "Seis sete. Ninguém sabe por quê." |
| **Farmou aura** | ficar em 1º no placar (F$/s) | "+1000 de aura." |
| **Aura negativa** | vender a startup e ganhar só 1 ponto | "Vendeu por um real e um abraço." |
| **limaumdoc** | contratar o limaumdoc (pelo nome de usuário) | a combinar com o grupo |
| **Tá saindo da jaula** | comprar "Máx" de um gerador e levar 100+ unidades de uma vez | "Birl! O monstro tá saindo da jaula." |
| **Guiana Brasileira** | comprar a melhoria "Filial em Portugal" (a de 25 unidades da "Filial em Dubai", que hoje se chama "Visto de negócios" e muda de nome nesta entrega, por migração nova de catálogo) | "Fala galera! A Guiana Brasileira agora tem sede." |
| **Fez o L** | ter 50 estagiários (o do Luis) | "L de Luis, que fique claro." |
| **3h06** | abrir a Fellas Inc. entre 3h e 4h da manhã (Brasília) | "Bora fundar uma empresa?" |
| **Modo sigma** | vender a startup sem nunca ter contratado ninguém | "Lobo solitário do empreendedorismo." |
| **Pai tá on** | ser o unicórnio da semana | "O pai tá on." |
| **Brainrot** | pegar 3 oportunidades em menos de 1 minuto | "Tung tung tung empreendedor." |

Nomes de membros (limaumdoc) e do Luis aparecem no código público: aprovado pelo Juan (10/10).

## 4. Telas (`games/idle/`)

- Aba nova **Legado**, com três partes:
  1. Card de prestígio: pontos para gastar, pontos ganhos na vida, recorde de F$/s, "Vender a startup · +N pontos".
  2. Árvore: a raiz e os 5 ramos (ícone, nome, efeito, custo); nó comprado aceso, nó disponível com "Comprar · N ★",
     nó trancado apagado com o que falta. No celular os ramos empilham; no PC ficam lado a lado.
  3. Conquistas: grade (ícone, nome; tocar mostra a frase e a data). Bloqueadas aparecem apagadas com a condição;
     escondidas não aparecem até alguém conseguir (aí mostram "??? · alguém do grupo conseguiu"). Contagem "42/75".
- Com 5 abas, a fileira de abas rola na horizontal no celular.
- Ganhou conquista: aviso rápido por cima da cena ("Conquista: 6-7") por 3 s.
- Placar: os pontos ganhos na vida ao lado do F$/s (ex.: "★ 12").

## 5. Dados e funções

- `idle_state`: + `prestige_earned int` (ganhos na vida), `prestige_spent int`, `prestige_count int`,
  `best_rate double precision` (recorde de F$/s).
- Árvore: catálogo `idle_cat_no` (gerado por `catalogoSql()`, com ramo, posição, custo e efeito) e `idle_arvore`
  (`user_id`, `no_id`, `comprado_em`); RPC `idle_buy_node(p_no)` (confere pontos livres e o nó anterior; fecha a conta
  antes, porque o nó pode mudar a taxa).
- `idle_cat_conquista` (catálogo, gerado por `catalogoSql()` numa migração NOVA, regra da 0033) e `idle_conquistas`
  (`user_id`, `conquista_id`, `ganhou_em`; PK nos dois). RLS de membro; escrita só por funções definer.
- `idle_prestige()` (RPC): fecha a conta, calcula os pontos, vence os contratos feitos (fechando a conta dos
  contratados), zera e devolve o estado.
- `idle_check_conquistas(uid)` (interna), chamada no fim das RPCs que mudam estado; devolve as novas para a tela avisar.
- `idle_json` e `idle_board` ganham pontos, conquistas e o que for preciso para a tela; contadores de oportunidades
  pegas, contratos e melhorias que as condições usam ficam em colunas de contagem (não se recalculam do histórico).
- Nada apaga conquistas nem pontos; a foto de segunda continua só foto.

## 6. Testes

- Banco: pontos (fórmula, recorde, "não compensa"), árvore (custo, nó anterior, pontos livres, efeito de cada nó), o que zera e o que fica na venda, contratos vencendo na venda sem
  retroativo, cada tipo de conquista (inclusive a escondida por horário e a por nome de usuário), conquista não some
  depois de vender, ninguém escreve nos pontos ou conquistas dos outros.
- Paridade: a taxa com prestígio e conquistas.
- Simulação: os alvos de 1.4.
- Tela: aba Conquistas, venda com confirmação, aviso de conquista.

## Pendências

- A conquista do "Vitor" (o Juan explica a piada).
- Ícones das conquistas (arte por código, fora do repositório).
