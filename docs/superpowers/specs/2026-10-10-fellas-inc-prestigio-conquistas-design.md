# Fellas Inc., entrega 3: prestígio e conquistas

Data: 10/10/2026. Status: desenho aprovado em conversa (10/10); esta spec aguarda revisão.
Base: `docs/superpowers/specs/2026-10-10-fellas-inc-design.md` (o jogo, sem reset) e a entrega 2 (contratos de 7 dias,
personagem). Esta spec só acrescenta; o que não está aqui segue a base.

## Resumo

A Fellas Inc. não zera sozinha. Recomeçar passa a ser escolha: **"Vender a startup"** troca a empresa inteira por
**pontos de prestígio**, calculados pelo seu R$/s na lógica do Cookie Clicker, e cada ponto vale +1% de produção para
sempre. **Conquistas** (umas 75, algumas escondidas, de zoeira) dão +1% cada, também para sempre. As duas coisas são o
jogo de longo prazo de quem já chegou longe, sem tirar a graça de quem começa agora.

## Decisões já tomadas (Juan, 10/10)

- Prestígio é escolha do jogador, a qualquer hora; os pontos dependem do R$/s, na lógica do Cookie Clicker.
- No prestígio fica **só** o que é permanente: pontos de prestígio, conquistas e personagem.
- Conquistas dão um pouquinho de produção (+1% cada). As escondidas de zoeira são combinadas com o Juan (seção 3.3).
- Os contratos que você FEZ acabam quando você vende; quem te contratou continua com você até o contrato vencer.
- Entra como entrega 3; as propriedades passam a ser a entrega 4.
- Continua valendo: o banco é a autoridade; nada de créditos do cassino; sem reset semanal (só a foto de segunda).

## 1. Prestígio ("Vender a startup")

### 1.1 Pontos

- `pontos_totais(r) = floor(cbrt(r / K))`, em que `r` é o R$/s no momento da venda (sem o ×5 das oportunidades) e `K`
  sai da simulação (1.4).
- Ao vender, você ganha `max(0, pontos_totais(r) − pontos_que_você_já_tem)`. Vender de novo no mesmo ritmo não rende
  nada: para ganhar mais, precisa bater o próprio recorde. É a regra do Cookie Clicker (lá pelo total produzido; aqui,
  pedido do dono, pelo R$/s).
- Só dá para vender se isso render pelo menos 1 ponto (senão o botão fica apagado com "Ainda não compensa").

### 1.2 O que acontece na venda

- Zera: valuation, geradores, melhorias, estratégias das eras, boost e "próxima compra pela metade".
- A empresa volta para "Abrir CNPJ" (cena "antes"); o "Abrir CNPJ" dá o R$ 10 e o notebook de sempre.
- Os contratos que você fez vencem na hora (`ends_at = agora`), com a conta dos contratados fechada antes (nada
  retroativo, como na entrega 2). Quem te contratou continua.
- Ficam: pontos de prestígio, número de vendas, conquistas, personagem, o limite diário de oportunidades (não reabre a
  cota do dia) e o recorde de R$/s.
- Confirmação antes: folha com "Vender a startup? Você ganha N pontos (+N% pra sempre) e recomeça do zero." e os
  botões "Vender" / "Deixa quieto".

### 1.3 Efeito

- Produção × `(1 + 0,01 × pontos)`. Igual no banco e em `economia.ts` (paridade).
- O preço dos geradores não muda (o prestígio acelera por produção, não por desconto).

### 1.4 Ritmo (simulação)

A simulação de hoje ganha um jogador que vende. Alvos:
- Primeira venda que vale a pena (≥ 5 pontos) por volta do dia 3 ou 4 de jogo (era 4/5).
- Depois de vender com 10 pontos, voltar à era em que estava leva menos da metade do tempo da primeira vez.
- `K` e os alvos viram asserções, como os marcos de hoje.

## 2. Bônus juntos

`taxa = base × melhorias × estratégias × contratos × (1 + 0,01 × pontos) × (1 + 0,01 × conquistas)`. A taxa do placar
(R$/s) já inclui tudo. A foto de segunda continua usando a taxa da meia-noite.

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
| R$/s (8) | 1 · 100 · 10 mil · 1 mi · 1 bi · 1 tri · 1 quatri · 1 quinti |
| Eras (5) | chegar nas eras 2, 3, 4, 5 e ter o gerador 30 |
| Melhorias (3) | 10, 50 e 150 compradas |
| Oportunidades (4) | 1, 25, 100, 500 pegas |
| Prestígio (4) | vender 1, 5, 10 e 25 vezes |
| Gente (6) | contratar 1, 10, 50; ser contratado 1, 10, 50 |
| Estratégias (2) | já ter usado as 3 opções de uma era; ter usado todas as opções ligadas |

### 3.3 Escondidas (zoeira; só aparecem quando alguém consegue)

Ideias do Juan e da pesquisa (outubro de 2026). A lista final é o Juan que aprova:

| Nome | Condição | Frase |
|---|---|---|
| **6-7** | ter exatamente 67 unidades de algum gerador | "Seis sete. Ninguém sabe por quê." |
| **Farmou aura** | ficar em 1º no placar (R$/s) | "+1000 de aura." |
| **Aura negativa** | vender a startup e ganhar só 1 ponto | "Vendeu por um real e um abraço." |
| **limaumdoc** | contratar o limaumdoc (pelo nome de usuário) | a combinar com o grupo |
| **Vitor** | a combinar: o Juan explica a piada do "boneco do jogo BBB" | a combinar |
| **Tá saindo da jaula** | comprar "Máx" de um gerador e levar 100+ unidades de uma vez | "Birl! O monstro tá saindo da jaula." |
| **Guiana Brasileira** | ter a "Filial em Dubai" | "Agora a Guiana Brasileira tem sede própria." |
| **Fez o L** | ter 50 estagiários (o do Luis) | "L de Luis, que fique claro." |
| **3h06** | abrir a Fellas Inc. entre 3h e 4h da manhã (Brasília) | "Bora fundar uma empresa?" |
| **Modo sigma** | vender a startup sem nunca ter contratado ninguém | "Lobo solitário do empreendedorismo." |
| **Pai tá on** | ser o unicórnio da semana | "O pai tá on." |
| **Brainrot** | pegar 3 oportunidades em menos de 1 minuto | "Tung tung tung empreendedor." |

Nomes de membros (limaumdoc) e do Luis aparecem no código, que é público: o Juan confirma que tudo bem para cada um.

## 4. Telas (`games/idle/`)

- Aba nova **Conquistas**: no topo, o card de prestígio (pontos, % de bônus, recorde de R$/s, "Vender a startup ·
  +N pontos"); embaixo, a grade de conquistas (ícone, nome; tocar mostra a frase e a data). Bloqueadas aparecem
  apagadas com a condição; escondidas não aparecem até alguém conseguir (aí mostram "??? · alguém do grupo conseguiu").
  Contagem "42/75".
- Com 5 abas, a fileira de abas rola na horizontal no celular.
- Ganhou conquista: aviso rápido por cima da cena ("Conquista: 6-7") por 3 s.
- Placar: os pontos de prestígio ao lado do R$/s (ex.: "★ 12").

## 5. Dados e funções

- `idle_state`: + `prestige_points int`, `prestige_count int`, `best_rate double precision` (recorde de R$/s).
- `idle_cat_conquista` (catálogo, gerado por `catalogoSql()` numa migração NOVA, regra da 0033) e `idle_conquistas`
  (`user_id`, `conquista_id`, `ganhou_em`; PK nos dois). RLS de membro; escrita só por funções definer.
- `idle_prestige()` (RPC): fecha a conta, calcula os pontos, vence os contratos feitos (fechando a conta dos
  contratados), zera e devolve o estado.
- `idle_check_conquistas(uid)` (interna), chamada no fim das RPCs que mudam estado; devolve as novas para a tela avisar.
- `idle_json` e `idle_board` ganham pontos, conquistas e o que for preciso para a tela; contadores de oportunidades
  pegas, contratos e melhorias que as condições usam ficam em colunas de contagem (não se recalculam do histórico).
- Nada apaga conquistas nem pontos; a foto de segunda continua só foto.

## 6. Testes

- Banco: pontos (fórmula, recorde, "não compensa"), o que zera e o que fica na venda, contratos vencendo na venda sem
  retroativo, cada tipo de conquista (inclusive a escondida por horário e a por nome de usuário), conquista não some
  depois de vender, ninguém escreve nos pontos ou conquistas dos outros.
- Paridade: a taxa com prestígio e conquistas.
- Simulação: os alvos de 1.4.
- Tela: aba Conquistas, venda com confirmação, aviso de conquista.

## Pendências

- O Juan aprova a lista de escondidas e explica a do "Vitor"; confirma nomes de membros no código público.
- Ícones das conquistas (arte por código, fora do repositório).
