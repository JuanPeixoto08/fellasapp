# Fellas Inc. (jogo idle do Fellas Games)

Data: 10/10/2026. Status: design aprovado em conversa; esta spec aguarda revisão.

## Resumo

Fellas Inc. é o terceiro jogo do Fellas Games: um idle em que cada fella toca a própria startup fellada. O número que
sobe é o **valuation**. Cada um compra geradores e melhorias, escolhe estratégias, contrata amigos e disputa propriedades
(lugares reais que o grupo frequenta). A empresa nunca zera sozinha (o reset é só dos jogos que valem crédito).
Toda segunda 00:00 o 1º do placar em R$/s leva o selo **"unicórnio da semana"** e fica numa placa, sem ninguém perder
nada. Recomeçar será o prestígio, por escolha do jogador (entrega futura).

O jogo é grande de propósito (30 geradores, ~200 melhorias), mas as decisões pesam mais que o tempo de tela: quem abre o
jogo umas 3 vezes por dia fica competitivo.

## Decisões já tomadas

- **Não participa dos créditos do cassino.** Nada do idle gasta, gera ou mexe em `game_wallets`, `game_ledger`,
  `games_move`, no Blackjack, no Poker, no fiado ou no troféu do campeão. A moeda do idle é só o valuation.
- **Não pesa no banco nem no Cloudflare.** Nada roda a cada segundo: a produção é uma conta feita pelo banco só quando o
  jogador age. Sem Realtime. Cloudflare só serve os arquivos estáticos.
- **O banco é a autoridade**, como no cassino: o app manda intenções ("comprar gerador 7"), nunca valores; o relógio é o
  `now()` do Postgres.
- **Decisões > tempo de tela**: oportunidades guardadas com limite diário, estratégias sem volta a cada era, placar
  mostrando o caminho de cada um.
- **Personagem personalizado só na Fellas Inc.** (não é avatar do app inteiro), visível nas suas cenas, no placar, nas
  cartas de contratar e na empresa de quem te contratou.
- **Pixel art feita por código** (pasta `../fellas-inc-esbocos`, fora do repositório), estilo aprovado: 160x96 por cena,
  contorno preto de 1px, linha única entre objetos colados, paleta do app.

## Fora do escopo

- Avatar do personagem fora da Fellas Inc. (Poker, perfil).
- Itens de personagem ganhos jogando (coroa do unicórnio etc.): podem vir depois em cima do kit.
- Conquistas, prestígio, push notification de "cofre cheio".
- Qualquer ligação com créditos do cassino.

## 1. Economia

### 1.1 Valuation e produção

- Valuation em "R$" de mentira, `double precision` no banco (passa de trilhões).
- Cada gerador `g` tem custo base `c_g`, rendimento base `r_g` (R$/s) e quantidade `n_g`. O preço da próxima unidade é
  `c_g · 1,15^n_g`. "Comprar 10" e "comprar máx" somam a série geométrica numa compra só.
- Produção por segundo: `R = Σ (n_g · r_g · M_g) · M_global`, em que `M_g` junta as melhorias e estratégias que atingem o
  gerador e `M_global` junta melhorias gerais, estratégias, contratos e propriedades.
- **Teto de 8 horas:** a produção acumula no máximo 8h depois do último "bater o ponto" (`idle_open`) ou da última ação.
- **Sem clique** para ganhar valuation.
- Números exibidos resumidos em pt-BR: `R$ 999`, `R$ 12,3 mil`, `R$ 3,4 mi`, `bi`, `tri`, `quatri`, `quinti`, `sexti`,
  `septi`, `octi`.

### 1.2 Os 30 geradores em 5 eras

A cena muda quando o jogador compra a **primeira unidade do primeiro gerador da era**.

| Era / cena | Geradores |
|---|---|
| 1 · quarto | 1 Você, no notebook da faculdade · 2 Post motivacional no LinkedIn · 3 Planilha no Excel · 4 Vendendo pra tia no grupo da família · 5 Freela no Fiverr · 6 Live na Twitch |
| 2 · garagem | 7 Estagiário · 8 Impressora 3D · 9 Grupo de vendas no zap · 10 Dropshipping · 11 Food truck · 12 Loja no Mercado Livre |
| 3 · escritório | 13 PPP Podcast · 14 Influencer parceiro · 15 App na App Store · 16 Curso online · 17 Agência de marketing · 18 Coworking próprio |
| 4 · andar inteiro | 19 Grupo de trader · 20 Investidor anjo · 21 Fazenda de servidores · 22 Rodada série A · 23 Laboratório de inovação · 24 Fusão com a concorrência |
| 5 · sede | 25 Rolê patrocinado · 26 Comprar um time do Brasileirão · 27 Ilha particular · 28 Filial em Dubai · 29 IPO na bolsa · 30 Foguete pra Marte |

Comprar o gerador 30 mostra a **cena 6, "em órbita"** (bônus de exibição, sem efeito no jogo).

Ao apertar "Abrir CNPJ" o jogador começa com 1 unidade do gerador 1 e R$ 10. Os nomes podem mudar sem mexer na lógica
(ficam no catálogo).

### 1.3 Ritmo (alvo da simulação)

Os valores de `c_g` e `r_g` saem de uma simulação (seção 9) que precisa cumprir, para um jogador que abre o jogo 3 vezes
por dia e compra sempre o que se paga mais rápido:

| Marco | Alvo |
|---|---|
| 2ª unidade do gerador 1 | ~10 s após "Abrir CNPJ" |
| Primeira hora | uma compra possível a cada 20–60 s; 60 a 100 compras no total |
| Era 2 | 10 a 15 min |
| Era 3 | dia 1 |
| Era 4 | dia 2 ou 3 |
| Era 5 | dia 4 ou 5 |
| Gerador 30 | não alcançável sem oportunidades e estratégias bem escolhidas (raro de propósito) |

## 2. Melhorias (~200, compra única)

- **De gerador (150):** ao ter 1, 10, 25, 50 e 100 unidades de um gerador, abre uma melhoria que **dobra** aquele gerador.
  Cada uma tem nome e frase de piada (ex.: Estagiário → "Crachá com foto", "Vale-transporte", "Efetivação (talvez)";
  Brasileirão → "Virar SAF", "Contratar técnico português"). Preço = `c_g · fator_do_nível`.
- **Gerais (20):** +% em toda a produção (ex.: "Café coado na hora", "Wi-Fi do vizinho", "Cadeira gamer").
- **Sinergias (30):** um gerador fortalece outro da mesma era ou de era vizinha (ex.: "Estagiário edita o PPP": +1% no
  gerador 13 por estagiário).
- A tela mostra uma fileira de ícones do que está à venda agora; tocar mostra nome, frase e preço.

## 3. Oportunidades ("cookie dourado")

- Cada jogador tem uma janela de oportunidade a cada 10 minutos de relógio. Dentro dela, a oportunidade "aparece" num
  segundo sorteado por `hash(user_id, índice_da_janela)` e dura 10 s na cena (investidor no elevador, post viralizando,
  cliente gringo).
- **Guardadas:** oportunidades que passaram com o jogo fechado vão para a caixinha, até 3, cada uma vence 4h depois de
  aparecer.
- **Limite:** 10 pegas por dia (dia de Brasília).
- **Bônus** (sorteado pelo mesmo hash): 15 min de produção na hora, ou produção ×5 por 60 s, ou a próxima compra pela
  metade do preço.
- Nada é gravado até alguém pegar: `idle_claim_opportunity` recalcula a janela, confere o horário, a validade, se já foi
  pega e o limite do dia.

## 4. Estratégias da empresa

Ao entrar nas eras 2, 3, 4 e 5 o jogador escolhe **1 de 3** estratégias, que valem até o reset. A escolha é obrigatória
para continuar comprando naquela era e não tem volta. Valores finais saem da simulação; ponto de partida:

| Era | Opções |
|---|---|
| 2 | **Bootstrapping**: geradores 1–12 +50% · **Queimar caixa**: tudo custa +25%, produção +60% · **Networking**: efeito de contratos e propriedades ×2 |
| 3 | **Viralizar**: bônus de oportunidade ×2 e limite diário +3 · **Foco no produto**: geradores 13–18 +100% · **Marca forte**: +5% de produção por propriedade possuída |
| 4 | **Abrir capital**: produção +30%, contratos custam ×2 · **Monopólio**: benefício das suas propriedades ×2, tomar custa ×1,5 pra você · **Cultura de startup**: +15% por contratado (no lugar de 10%) e seus contratados ganham ×3 |
| 5 | **Expansão global**: geradores 25–30 +100% · **Holding**: +3% por gerador diferente que você tem · **Rolê eterno**: oportunidades duram 30 s e limite diário +5 |

O placar mostra as estratégias de cada um e é ordenado pelo R$/s (mostra "+R$ X/s", sem o boost das oportunidades); o unicórnio da semana continua sendo o maior valuation.

## 5. Contratar amigos

- Pode ser contratado quem já abriu a Fellas Inc. na temporada.
- Preço: 30 min da sua produção atual × `1,5^(contratos que você já fez na semana)`.
- Quem contrata: +10% de produção por contratado. Quem é contratado: +2% por empresa em que trabalha.
- **Piso de freela:** quem não foi contratado por ninguém na semana recebe o bônus de 1 contrato.
- Um par por temporada; sem limite de quantidade; sem demissão; tudo acaba no reset.
- Cargo sorteado de uma lista de piada (estagiário, sócio de fachada, coach de produtividade, CEO de nada…).
- Notificação nova: "Fulano te contratou como [cargo]".
- O placar mostra o "mais disputado do mercado" (quem mais foi contratado), só pela glória.

## 6. Propriedades (lugares reais do grupo)

- 8 a 12 lugares públicos que o grupo frequenta; nada de casa ou endereço de ninguém.
- **Privacidade:** o repositório e o site são públicos (arquivos de `games/idle/assets/` podem ser baixados sem login),
  então nada que identifique os lugares vai para o código ou para o site:
  - nomes, frases, posições no mapa, **ícones (PNG 32x32) e o mapa (PNG 160x96)** ficam só no banco, em `idle_places` e
    `idle_map`, legíveis apenas por membros logados (RLS com `is_member()`);
  - o mapa segue o traçado real do bairro, simplificado e girado (praia embaixo), sem nome de rua, bairro ou texto; só
    é aceitável porque fica no banco, visível apenas para membros;
  - a arte é gerada fora do repositório e as fotos de referência não são guardadas;
  - o modo `?mock` (desenvolvimento, prints, vídeo) usa lugares de mentira.
- Abre a partir da era 2. Aba "Mapa do rolê": mapa 160x96 com os pontos (posições aproximadas); cada ponto mostra o
  mini-personagem do dono.
- Tudo medido em tempo e %: preço em **horas da produção de quem compra**, benefício em **+% de produção**.

| Faixa | Preço base | Benefício |
|---|---|---|
| Barata | 1h | +5% |
| Média | 3h | +10% |
| Cara | 8h | +20% |

- **Tomar** custa 1,5× as horas que o dono anterior pagou; o dono antigo recebe essas horas convertidas na produção dele.
- Proteção de 2h depois de cada compra. Notificação: "Fulano tomou o [lugar] de você".
- No reset, tudo volta ao mercado com preço base.

## 7. Personagem

### 7.1 Kit

- **Poses** (as de perfil espelham): 1 sentado de costas (16x22), 2 em pé de costas (14x26), 3 em pé de perfil (12x24),
  4 sentado de perfil (14x20), 5 de frente (9x13), 6 deitado (só cabeça e ombro, para o "antes"). Cada pose com 2 a 4
  quadros.
- **Peças por pose:** corpo (pele), cabelo (6 estilos: curto, raspado, cacheado, black power, comprido, de lado), roupa
  (4: moletom, camiseta, camisa social, jaqueta), acessório de cabeça (6: nenhum, boné, fone, óculos, gorro, bandana).
- **Cores:** pele 6, cabelo 8 (preto, castanho, loiro, ruivo, grisalho, roxo, azul, rosa), roupa 10, acessório nas
  mesmas 10. As peças são desenhadas com 3 tons-marcador por canal (sombra, meio, luz), trocados na hora pelos 3 tons da
  cor escolhida. Contorno preto vem desenhado na peça.
- **Padrões:** sem personagem salvo = o fundador de hoje (moletom preto, cabelo preto, fone roxo). Freelas genéricos
  usam combinações fixas por vaga. A vaga do estagiário usa o **estagiário oficial** (um fella de fora da rede, desenhado a
  partir de foto, com consentimento dele), que também é o desenho do gerador 7.

### 7.2 Editor

- Aparece na primeira vez que a pessoa abre a Fellas Inc., antes do "Abrir CNPJ"; depois pelo botão "Mudar visual", de
  graça, quantas vezes quiser.
- Prévia: o boneco de frente ampliado e o personagem sentado de costas na cadeira.
- Linhas: Pele, Cabelo, Cor, Roupa, Cor, Na cabeça, Cor (some com "nenhum"). Botões "Sortear" e "Bora".
- Fechar sem salvar = visual padrão; o editor volta na próxima abertura até o primeiro "Bora".

### 7.3 Vagas nas cenas

Cada cena passa a ser exportada como `fundo` (cena sem gente, animada), `frente` (transparente, o que fica na frente das
pessoas) e `vagas` (JSON: posição, pose, espelhada, papel `dono` ou `contratado`).

| Cena | Você | Vagas de contratados |
|---|---|---|
| Antes / Abrindo | deitado, depois na cadeira | 0 |
| 1 · quarto | sentado de costas | 0 |
| 2 · garagem | sentado de costas | 1 (estagiário com café) |
| 3 · escritório | sentado de costas | 3 (apresentador e convidado do PPP, mesa do estagiário) |
| 4 · andar | em pé, apontando | 5 (trader, duas mesas, dois no pingue-pongue) |
| 5 · sede | de frente, braços abertos | 4 (dois dançarinos, DJ, tapete vermelho) |
| 6 · órbita | a definir no desenho | a definir no desenho |

- Vagas preenchidas pelos contratados do mais recente ao mais antigo; vaga sobrando mostra o freela da vaga.
- Montagem no navegador: fundo → pessoas → frente, por quadro, guardada em memória; remonta só quando muda contrato,
  visual ou cena.
- Cada vaga é posicionada para a borda do personagem cair sobre a borda do objeto em que ele encosta (linha única).
- Poses de 2 ou 4 quadros se repetem dentro do loop de 8 (ou 12) quadros da cena.

## 8. Temporada, telas e app

### 8.1 Foto da semana (segunda 00:00 de Brasília), sem reset

`idle_weekly_reset()` roda 2 minutos depois do `games_weekly_reset` (entrada própria no `pg_cron`, `2 3 * * 1`) para os dois não disputarem as linhas de `profiles`. Não apaga nada: é só uma foto do placar. Se o cron não rodou, o primeiro `idle_lock` da semana nova tira a foto:

1. Grava a placa da semana que acabou em `idle_weeks`: unicórnio (1º em R$/s, desempate pelo valuation até a meia-noite
   de Brasília), top 3 e estratégias e era de cada um. Só entra quem já jogava antes da semana nova; sem ninguém, sem placa.
2. Passa o selo `weekly_unicorn` para o 1º (independente do `weekly_champion` do cassino) e o tira de quem tinha. Rodar de
   novo na mesma semana não grava outra placa nem troca o selo.
3. Estado, geradores, melhorias e valuation ficam como estão. Nada é zerado.

### 8.2 Telas (`games/idle/`)

1. Editor de personagem (7.2).
2. Principal (pensada para celular):
   - Topo: cena animada (2x), com você, contratados, oportunidades passando e o ícone da caixinha com o número de
     oportunidades guardadas.
   - Valuation e R$/s.
   - Abas: **Geradores** · **Melhorias** · **Contratar** · **Mapa do rolê** (era 2+) · **Placar**.
   - Escolha de estratégia ao entrar numa era nova, antes de continuar.
3. PC: mesma estrutura, cena 3x ou 4x e abas na lateral.

Visual dos outros jogos de `games/` (HUD do Blackjack/Poker), fonte pixelada, textos em pt-BR no tom do `PRODUCT.md`.
Erro de rede ou compra recusada: aviso curto e o número volta ao valor do banco; nunca mostra compra não aceita.

### 8.3 No app

- Aba Games: linha "Fellas Inc." com o ícone da torre e o unicórnio da semana passada.
- Selo novo `weekly_unicorn` em `lib/badges.ts` e `components/ui/UserBadge` (sprite `selo-unicornio`, 16x16).
- Notificações novas: `idle_hired` ("te contratou como…") e `idle_place_taken` ("tomou o … de você"), integradas ao
  sistema de notificações existente.

## 9. Dados e funções

Migração `0033_fellas_inc.sql` (idempotente, RLS em toda tabela, leitura para membros via `is_member()`, escrita só por
funções `security definer`; todo `UPDATE`/`DELETE` com `WHERE`, por causa do `pg_safeupdate`).

### 9.1 Tabelas

- `idle_catalog_generators`, `idle_catalog_upgrades`, `idle_catalog_strategies`: o catálogo, preenchido pela migração.
- `idle_state` (`user_id`, `week_start`, `valuation double precision`, `generators int[30]`, `upgrades int[]`, `strategies
  smallint[]`, `era`, `opp_claimed int[]` (janelas pegas), `opp_day`, `opp_count`, `boost_until`, `next_half_price`,
  `settled_at timestamptz`, `opened_at`).
- `idle_contracts` (`week_start`, `employer_id`, `employee_id`, `cargo`, `created_at`; único por semana + par).
- `idle_places` (`id`, `nome`, `faixa`, `frase`, `mapa_x`, `mapa_y`, `icone bytea` com o PNG 32x32) e `idle_map`
  (uma linha, `imagem bytea` com o PNG 160x96): preenchidas pelo dono com um script local, fora do repositório; só
  membros leem.
- `idle_place_owner` (`place_id`, `week_start`, `owner_id`, `paid_hours`, `protected_until`).
- `idle_avatar` (`user_id`, `pele`, `cabelo`, `cor_cabelo`, `roupa`, `cor_roupa`, `acessorio`, `cor_acessorio`,
  `updated_at`) com `check` de faixa em cada coluna.
- `idle_weeks` (`week_start`, `unicorn_id`, `podium jsonb`, `most_hired_id`, `closed_at`).

### 9.2 Funções

- `idle_open()`: cria o estado da semana se preciso, fecha a conta até agora (teto de 8h), devolve estado e
  oportunidades guardadas.
- `idle_buy(kind, id, qty)`: gerador (1, 10 ou máx) ou melhoria; fecha a conta, confere preço e estratégia da era.
- `idle_pick_strategy(era, option)`, `idle_claim_opportunity(window)`, `idle_hire(user_id)`, `idle_take_place(place_id)`,
  `idle_set_avatar(...)`, `idle_board()` (placar com valuation estimado na hora da leitura).
- `idle_weekly_reset()` (só o cron).
- A conta da produção existe igual em SQL (autoridade) e em TypeScript (animação); um teste de paridade compara as duas
  em vários estados de exemplo.

### 9.3 Custo

Uma escrita ao abrir, uma por compra, contrato, propriedade, oportunidade ou mudança de visual: algumas centenas por
jogador ativo por dia, poucos milhares no grupo. Sem Realtime, sem cron por minuto.

## 10. Arte

Feita por código em `../fellas-inc-esbocos` (fora do repositório), com `cena-util.js` (`telaComObjetos`, `contornar`,
`salvarCena`, `salvarSprite`). Prontas: cenas 1–5, "antes" e "abrindo", geradores 1, 7, 13, 19, 25 (hoje nomeados
`gerador-1` a `gerador-5`), crachás, ícones, selo, placa e ícone do jogo. A fazer:

- 25 geradores novos (32x32, animados).
- Molduras de nível das melhorias (bronze, prata, ouro, roxo, diamante) com o mini-ícone do gerador; ~50 ícones próprios
  (gerais e sinergias).
- Sprites das oportunidades e ícones das estratégias.
- Cena 6 "em órbita".
- Kit de personagem (6 poses × peças) e as cenas reexportadas como fundo/frente/vagas.
- Ícones dos lugares (32x32), desenhados a partir de fotos dos lugares que o dono vai mandar, e o mapa do rolê
  (160x96). As fotos são só referência: não ficam salvas no projeto.

Os arquivos finais são copiados para `games/idle/assets/`, **menos os dos lugares e o mapa**, que vão direto para o banco
(seção 6).

## 11. Testes

- **Banco (Vitest + PGlite, migrações reais):** cada função, regras de acesso (ninguém escreve no estado ou no personagem
  dos outros), faixas inválidas recusadas, teto de 8h, oportunidades (janela, validade, limite, repetida), contratos (par
  único, preço crescente), propriedades (proteção, tomar, compensação), reset e placa.
- **Jogo:** paridade da conta, formatação dos números, troca de cores, montagem das camadas, ordem das vagas.
- **Simulação de ritmo:** os marcos da seção 1.3 viram asserções; o teste falha se o balanceamento sair do alvo.
- `npx tsc --noEmit`, `npm test` e os testes de `games/` passam.

## 12. Entregas

1. **Núcleo:** geradores, melhorias, oportunidades, estratégias, temporada, placar, selo, cenas com o fundador padrão.
2. **Gente:** contratar amigos, editor de personagem, cenas com vagas, estagiário oficial, notificação de contrato.
3. **Propriedades:** mapa do rolê, tomar/compensar, notificação; depende da lista de lugares.

Cada entrega tem plano próprio; o jogo é jogável a partir da entrega 1.

## Pendências

- Lista de lugares reais (nome, faixa, frase opcional) e uma foto de cada um, para o ícone.
- Nomes finais dos geradores, melhorias e estratégias (podem mudar sem mexer na lógica).
- Consentimento do estagiário oficial para aparecer no repositório público.
