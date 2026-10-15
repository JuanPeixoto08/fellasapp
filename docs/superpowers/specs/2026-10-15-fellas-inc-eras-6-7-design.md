# Fellas Inc.: eras 6 (Em órbita) e 7 (Lua) (entrega 1 do plano das eras 6–12)

Decidido com o Juan em 15/10. Plano geral em memória (`fellas-inc-eras-6-12`): 12 eras, arco espacial, Interestelar nas
eras 9–10. Esta entrega traz as eras 6 e 7 inteiras, a régua de ritmo das 12 eras e os nomes dos números gigantes.

## O que entra

1. Geradores 31–42 (6 por era), cada um com as 8 melhorias de sempre, desenho e lugar na cena.
2. Estratégias das eras 6 e 7 (duas opções cada, como nas eras 2–5).
3. Melhorias gerais (4 por era) e melhorias de legado (as eras antigas ajudam a nova).
4. Conquistas 140–159 (18 visíveis, 2 escondidas).
5. Eventos de era: Lixo espacial (6) e "Houston, temos um problema" (7).
6. Sons: fanfarra de *Assim Falou Zaratustra* ao entrar na era 6, valsa ao comprar o "Danúbio Azul", sons dos
   eventos; músicas das eras 6 e 7.
7. Nomes dos números até o centilhão, com o googol.
8. Cena da Lua (nova), vagas dos geradores na cena de órbita, monolito, ícones; patch notes; caixinhas de informação.

## 1. Eras e geradores

- Era = `floor((id − 1) / 6) + 1`, como hoje: era 6 = geradores 31–36, era 7 = 37–42. A era começa ao comprar o
  primeiro gerador dela (`idle_era`, sem mudança).
- **Quem só tem o Foguete (gerador 30)** continua vendo "Era 6 · Em órbita" e a cena de órbita (`rotuloEra` com
  `orbita`), como hoje. Com o gerador 31, a era 6 passa a ser a de verdade (estratégia, conquistas, música).
- Preço e renda dos geradores 31–42 seguem a fórmula do catálogo (`custoInicial × crescimentoCusto^i`, renda por
  `retornoInicial × crescimentoRetorno^i`). **Os geradores 1–30 não mudam** (nem preço nem renda): os parâmetros que a
  simulação ajustar valem só a partir do 31 (se a fórmula não permitir isso, um segundo trecho de curva a partir do 31).
- Os nomes (ids e textos em `nomes.ts`):

| id | Era | Gerador | Referência |
|---|---|---|---|
| 31 | 6 | Constelação de satélites | internet de bilionário |
| 32 | 6 | Voo de 11 minutos com famoso | turismo espacial de verdade |
| 33 | 6 | Hotel em órbita | *2001: Uma Odisseia no Espaço* |
| 34 | 6 | HAL 9000 gerenciando a estação | *2001* |
| 35 | 6 | Ferro-velho orbital | *Gravidade* |
| 36 | 6 | Equipe de perfuração do Armageddon | *Armageddon* |
| 37 | 7 | Posto de gasolina lunar | Apollo 11 |
| 38 | 7 | Estúdio da teoria da conspiração | a teoria de que a ida à Lua foi gravada |
| 39 | 7 | Fazenda de queijo lunar | *Wallace & Gromit* |
| 40 | 7 | Mina de hélio-3 com clone | *Lunar* (*Moon*) |
| 41 | 7 | Raio encolhedor do Gru | *Meu Malvado Favorito* |
| 42 | 7 | Base no lado escuro da Lua | *Dark Side of the Moon*, *Transformers* |

- Frase de cada um (caixinha e Loja): 34 = "Desculpe, Dave. Receio que não posso cancelar sua assinatura."; as outras
  no tom do jogo, escritas no plano. Sem fato falso sobre pessoa real (o 38 fala da teoria, não acusa ninguém).

### As 8 melhorias de cada gerador (níveis 1, 10, 25, 50, 100, 150, 200, 300; cada uma dobra o gerador)

| id | Melhorias |
|---|---|
| 31 | Primeiro lançamento · Trenzinho de luzes no céu · Antena de pizza · Plano família interplanetário · Astrônomo reclamando · Mil satélites por mês · Internet no avião · Céu com mais satélite que estrela |
| 32 | Macacão com logo · Cantora pop a bordo · Vídeo flutuando com a água · Champanhe sem gravidade · Lista de espera de bilionário · Capitão de série de TV a bordo · Podcast gravado em órbita · Ingresso mais caro que um apartamento |
| 33 | Valsa do Danúbio Azul na acoplagem · Airbnb na estação espacial · Café da manhã em tubinho · Vista pra Terra (taxa extra) · Videofone de 1,70 o minuto · Spa de microgravidade · Suíte com janela redonda · Hilton da Odisseia |
| 34 | Olho vermelho na parede · Osso jogado pro alto · Leitura labial · Xadrez imbatível · "Desculpe, Dave" · Porta da cápsula trancada · Módulo de memória extra · Daisy, Daisy |
| 35 | Rede de pegar destroço · Parafuso perdido de 1965 · Luva de astronauta achada · Satélite soviético de segunda mão · Braço robótico · Guindaste orbital · Ferro-velho com selo ISO · Reciclagem de estação inteira |
| 36 | Sonda de petróleo · Briefing de regata na agência espacial · Bomba nuclear de brinde · Rock farofa no rádio · Biscoito de bichinho · Broca nova (a velha travou) · Despedida no asteroide · Asteroide partido ao meio |
| 37 | Pegada na poeira · Bandeira que não balança · Conveniência 24 h (o dia lunar dura 14) · Gasolina de hélio · Pão de queijo liofilizado · Calibrador de pneu de jipe lunar · Frentista de traje · Posto com bandeira própria |
| 38 | Holofote que faz sombra errada · Cenário de areia cinza · Bandeira com ventilador · Fio de pendurar astronauta · Diretor perfeccionista contratado · Documentário no YouTube · Fórum de terraplanista · Pôster "Foi tudo gravado aqui" |
| 39 | Faca de queijo espacial · Bolacha de água e sal · Queijo da cratera · Cachorro no comando · Foguete de garagem · Curado no vácuo · Meia-cura de 4 bilhões de anos · Exportação pra Minas |
| 40 | Contrato de 3 anos · Robô com carinha na tela · Mensagem gravada da família · Clone de reserva · Clone que descobriu · Antena de interferência · Gaveta com 50 clones · Fusão nuclear limpa |
| 41 | Minion de capacete · Banana espacial · Foguete roubado · Lua no bolso · Vilão concorrente · Empréstimo do Banco do Mal · Três meninas adotadas · Lua de volta (com juros) |
| 42 | Prisma na entrada · Vinil da banda · Robô gigante escondido · Sinal sem resposta · Lado escuro (que nem é escuro) · Hangar de nave secreta · Laser apontado pra Terra · Eclipse particular |

Ids das melhorias: `gerador × 10 + nível` (311–428), como hoje.

## 2. Estratégias

Mesma estrutura de `ESTRATEGIAS`/`idle_cat_est` (era, opção 0/1). Entrar na era pede a escolha antes da próxima compra
(`idle_strategy_pending`), como nas eras 2–5.

| Era | Opção | Nome | Efeito |
|---|---|---|---|
| 6 | 0 | Turismo espacial | Geradores 31–36 ×2 (`gen_mult`) |
| 6 | 1 | Satélites de internet | Oportunidades rendem 50% mais (`opp_bonus_mult` 1,5) e +2 por dia (`opp_extra`) |
| 7 | 0 | Mineração lunar | Geradores 37–42 ×2 |
| 7 | 1 | Hotel na Lua | Compras 25% mais baratas (`custo_mult` 0,75: vale pra geradores e melhorias, como o campo faz hoje) |

- `idle_state.strategies` passa de 4 pra 6 posições: a migração completa com `-1` quem tem menos de 6 (UPDATE com
  WHERE), e o default vira `{-1,-1,-1,-1,-1,-1}`. `idle_pick_strategy` aceita as eras 6 e 7.
- Números finais podem mudar pela simulação (seção 7); o plano registra.

## 3. Melhorias gerais e de legado

- **Gerais:** 4 por era, no padrão de `GERAIS` (produção +X%, preço pelo primeiro gerador da era):
  - Era 6: Lançamento transmitido ao vivo · Foguete que pousa de ré · Contagem regressiva com patrocínio · Selfie do espaço
  - Era 7: Pequeno passo · Telescópio apontado pra você · Trem-bala lunar · Lua cheia de clientes
  - Multiplicadores no padrão das eras anteriores (era 5: 1,25 · 1,25 · 1,3 · 1,3); a simulação ajusta.
- **Legado** (tipo novo de melhoria, `legado`): "cada unidade de gerador da era F que você tem dá +p% nos geradores da
  era A". Liberada ao chegar na era A (`requerEra = A`). `p` começa em 0,05% (a simulação ajusta). Preço no padrão das
  gerais da era A.
  - Era 6 (F = 1…5): O notebook da faculdade foi pro espaço · A garagem virou hangar · Escritório com gravidade zero ·
    O andar inteiro em órbita · A sede virou base de lançamento
  - Era 7 (F = 1…6): Wi-Fi da biblioteca chega na Lua · Food truck lunar · Podcast gravado na cratera · Trader que opera
    da Lua · IPO na Bolsa Lunar · Satélite de retransmissão
  - No banco: colunas `fonte_era`, `alvo_era` (e `por_unidade`, que já existe) em `idle_cat_upg`; o termo entra em
    `idle_gen_rendas` (multiplica a renda dos geradores da era A por `1 + Σ p × unidades da era F`), e o mesmo na
    página (`economia.ts`), com teste de paridade.
  - Caixinha de informação: quanto dá agora ("Seus 1.240 geradores da era 1 dão +62% na era 6").

## 4. Conquistas (140–159)

As "ter 100" dos geradores 1–30 usam os ids 1–30; os ids 31+ já são das outras conquistas. As dos geradores 31–42
ficam em 140–151 (o catálogo precisa dessa exceção). Textos em `nomes.ts`, catálogo gerado.

| id | Nome | Condição | Frase |
|---|---|---|---|
| 140 | Céu poluído | Ter 100 "Constelação de satélites" | Cem satélites. Os astrônomos te odeiam. |
| 141 | Turista de luxo | Ter 100 "Voo de 11 minutos com famoso" | Cem voos de 11 minutos. Ninguém saiu direito da atmosfera. |
| 142 | Cinco estrelas (de verdade) | Ter 100 "Hotel em órbita" | Cem hotéis em órbita. O check-out é às 11 h, mas de qual fuso? |
| 143 | Abra a porta, HAL | Ter 100 "HAL 9000 gerenciando a estação" | Cem HALs. Nenhum abre a porta. |
| 144 | Catador de estrelas | Ter 100 "Ferro-velho orbital" | Cem ferros-velhos. O lixo espacial agora tem dono. |
| 145 | Missão cumprida, Harry | Ter 100 "Equipe de perfuração do Armageddon" | Cem equipes de perfuração. O asteroide nem viu. |
| 146 | Abastece aí | Ter 100 "Posto de gasolina lunar" | Cem postos na Lua. O jipe agradece. |
| 147 | Foi tudo gravado | Ter 100 "Estúdio da teoria da conspiração" | Cem estúdios. Agora tem prova de que nada aconteceu. |
| 148 | Queijo suíço espacial | Ter 100 "Fazenda de queijo lunar" | Cem fazendas. A Lua está cada vez mais esburacada. |
| 149 | Sou eu mesmo? | Ter 100 "Mina de hélio-3 com clone" | Cem minas, e cem de você trabalhando nelas. |
| 150 | Lua no bolso | Ter 100 "Raio encolhedor do Gru" | Cem raios encolhedores. A maré nunca mais foi a mesma. |
| 151 | Do lado de lá | Ter 100 "Base no lado escuro da Lua" | Cem bases no lado escuro, que de escuro não tem nada. |
| 152 | Órbita lotada | Ter 300 de cada gerador da era 6 | Trezentos de cada. O céu virou estacionamento. |
| 153 | Condomínio lunar | Ter 300 de cada gerador da era 7 | A Lua tem síndico agora. É você. |
| 154 | Estação completa | Comprar todas as melhorias da era 6 | Tudo comprado. Até o banheiro funciona sem gravidade. |
| 155 | Lua de luxo | Comprar todas as melhorias da era 7 | Cada cratera com hidromassagem. |
| 156 | Desviou de tudo | Desviar os 3 destroços de um Lixo espacial | Nenhum arranhão. Nem no satélite do vizinho. |
| 157 | Silver tape resolve | Consertar 10 "Houston, temos um problema" | Dez problemas, um rolo de fita. |
| 158 | Meu Deus, está cheio de estrelas | Escondida: ter pelo menos 1 de cada gerador da era 7 (o monolito aparece) | Alguém deixou isso aqui há 4 milhões de anos. |
| 159 | Daisy, Daisy | Escondida: comprar "Daisy, Daisy", a última melhoria do HAL | Ele cantou até a voz acabar. |

- Tipos: 140–151 `gerador` (alvo = id do gerador, valor 100); 152–153 `era_300`; 154–155 `era_melhorias` (todas as
  8 × 6 de geradores + as 4 gerais + as de legado da era); 156 evento `evt_lixo` (3); 157 evento `evt_houston` (10);
  158 tipo novo `monolito` (estado, em `idle_check_conquistas`); 159 `melhoria` com alvo 348 (a "Daisy, Daisy").
- Cada uma vale +1% de produção. Ícones próprios (`conquista-140.png` … `-159.png`).

## 5. Eventos de era

Mesma roda da entrega 4 (`idle_evento_era`: só com o jogo aberto, 1/1800 por segundo, peso 3 pra era atual e 1 pras
antigas). Entram os tipos 6 e 7.

| Era | Evento | Na tela | Janela | Efeito |
|---|---|---|---|---|
| 6 | Lixo espacial | 3 destroços atravessam a cena (um de cada vez, em 10 s); cada clique num é um desvio | 10 s | 10 min de produção por destroço desviado; a página manda o total no fim e o banco aceita 0 a 3 (como os gols) |
| 7 | "Houston, temos um problema" | A cena pisca em vermelho, alarme, botão "Consertar com silver tape" | 8 s | Produção ×4 por 2 min (selo "Silver tape ×4 · 1:52") |

- Houston: coluna `silver_ate timestamptz`; pegar outro com um valendo soma 2 min; fator e ponto de corte em
  `idle_settle` e `economia.ts produzido` (como a Marmita); zera na venda da startup.
- Contadores em `eventos_era` (`lixo`, `houston`) e conquistas 156/157 via `idle_ganhar`.
- **Pendência da entrega 4 resolvida aqui:** hoje o banco recalcula o tipo do evento com a era do clique; se a pessoa
  mudou de era entre o evento aparecer e o clique, dá `idle_evento_gone`. O banco passa a aceitar o evento se ele sai
  com a era atual **ou** com a anterior. Os três arrays de `idle_evento_pegar` (janelas, chaves, tipos de conquista)
  ganham as eras 6 e 7.
- Caixinha de informação no evento (o que dá agora, em F$) e no selo do Houston.

## 6. Sons e música

- **Zaratustra:** ao entrar na era 6 de verdade (comprar o gerador 31), toca a fanfarra sintetizada (as três notas
  subindo e o acorde, no estilo dos efeitos de hoje; a obra é de domínio público). Nas outras eras continua o efeito
  `era`.
- **Valsa:** comprar a melhoria 331 (Valsa do Danúbio Azul) toca um trechinho de valsa (3 compassos) no lugar do som de
  compra.
- **Eventos:** `lixo` (um "tum" por destroço desviado), `houston` (bipe de alarme ao aparecer), `conserto` (ao
  consertar).
- **Músicas:** `eraMusica` vai até 7, com tema da órbita (lento, espacial) e da Lua (mais vazio e grave), no mesmo
  sintetizador. O Juan julga na página de audição.
- Sem som em teste no Chrome do Juan (mutar música e efeitos antes).

## 7. Ritmo das 12 eras

- A simulação (`simulacao.ts`) é o jogador típico que entra todo dia; não é regra do jogo (quem acelera chega antes).
- Alvo pra calibrar os geradores 31–42: **era 6 por volta do dia 10, era 7 por volta do dia 16**. Esboço pras próximas
  entregas (fica registrado no código da simulação, sem catálogo): ~8–9 dias por era, era 12 começando por volta do
  dia 52 e terminando por volta do dia 60.
- Os ritmos que já valem continuam passando (era 5 no dia 3–5, gerador 30 fora da 1ª semana, ~16–18 pontos na 1ª
  semana).
- Ajustar: os parâmetros da curva a partir do gerador 31, os `p` do legado, os multiplicadores das gerais e das
  estratégias novas.

## 8. Números gigantes

- `formatar.ts`: a lista de nomes segue depois de "deci" com as abreviações no mesmo estilo (undeci, duodeci, tredeci,
  quatordeci, quindeci, sexdeci, septendeci, octodeci, novendeci, viginti, …) até o centilhão (10³⁰³), geradas por
  regra num lugar só (prefixo + dezena), com teste da sequência.
- De 10¹⁰⁰ até 10¹⁰³ aparece "googol" (ex.: "F$ 2,5 googol"), em homenagem a quem deu o nome ao Google.
- Acima do centilhão: notação científica curta ("F$ 1,2 × 10³⁰⁶").
- O banco não muda (os números são `double precision`; o limite é ~10³⁰⁸ e o plano confere que a era 12 não chega
  perto).

## 9. Arte

- Pixel no estilo do jogo, mesmo kit das cenas e ícones atuais; o Juan aprova antes de publicar.
- **Cena 7 (Lua):** fundo, frente e `cena-7-vagas.json` com 6 vagas (os geradores 37–42 aparecem conforme compra).
- **Cena 6 (órbita):** já existe; ganha (ou confere) as 6 vagas dos geradores 31–36.
- **Monolito:** sprite preto alto na cena da Lua, só com a conquista 158.
- Ícones dos geradores 31–42 (`gerador-31.png` … `-42.png`), das conquistas 140–159, dos destroços e do alarme.
- Telas novas passam pelo Taste Engine (`lookup_slop`) e seguem a regra do roxo (cheio só em botão de ação).

## 10. Patch notes

Entrada nova no começo de `novidades.ts`: as eras 6 e 7, os 12 geradores, as estratégias, as melhorias de legado, os
eventos e as conquistas visíveis. Sem as escondidas (158, 159).

## Migrações

- `0077_fellas_inc_catalogo_eras_6_7.sql`: catálogo gerado (`ATUALIZAR_CATALOGO`): geradores 31–42, melhorias,
  gerais, legado, estratégias, conquistas 140–159.
- `0078_fellas_inc_eras_6_7.sql`: colunas (`silver_ate`; `fonte_era`/`alvo_era` em `idle_cat_upg`; `strategies` com 6
  posições), `idle_gen_rendas` com o legado, `idle_settle` com o Houston, `idle_pick_strategy`, `idle_evento_era` e
  `idle_evento_pegar` (eras 6–7 e a era anterior), `idle_check_conquistas` (monolito), `idle_save`/`idle_json`/
  `idle_prestige` e o que mais a 0076 tiver redefinido por último. Cada uma a partir da definição mais recente.
- As duas em `games/test/db.ts` e `games/dev/mockDb.ts`. Conferir antes do push se nenhuma outra sessão pegou esses
  números.

## Testes

- Catálogo: 42 geradores, contagens de melhorias e conquistas, a 0077 igual ao `catalogoSql()`, os geradores 1–30
  idênticos aos de hoje (preço e renda).
- Paridade TS × banco: renda com o legado, conta fechada com o Silver tape (sozinho e junto dos outros fatores), a roda
  dos eventos com as eras 6–7, a estratégia das eras 6–7.
- Banco: estratégias com 6 posições (quem tinha 4 fica com 6; era 6 pede escolha), Lixo com 4 desvios vira 3, Houston
  soma tempo, evento aceito com a era anterior, monolito e Daisy, contadores.
- Números: a sequência de nomes, o googol, a notação científica acima do centilhão, truncamento (nunca mostra mais do
  que tem).
- Simulação: era 6 ~dia 10, era 7 ~dia 16, ritmos antigos passando.
- Tela: cena 7 com as vagas, monolito só com a conquista, selo e caixinhas novas, rótulo da era.
- `npx tsc --noEmit` e `npm test` passando; jogos com `--maxWorkers=4`. Conferir no navegador em PC e celular (390 px),
  com o som todo mutado.
