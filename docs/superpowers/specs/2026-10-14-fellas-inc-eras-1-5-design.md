# Fellas Inc.: eras 1–5 ganham melhorias, conquistas e eventos de era (entrega 4 do plano das eras 6–12)

Data: 14/10/2026. Primeira das 6 entregas do plano das eras 6–12 (ordem decidida pelo Juan: esta → dourados e caixinha
→ eras 6–7 → eras 8–9 → eras 10–12 → árvore). Aqui entra o que todo mundo sente já, porque a turma ainda está nas eras 4–5.

## O que entra

1. **Três níveis novos de melhoria** em cada um dos 30 geradores (150, 200 e 300 unidades). Cada uma dobra o gerador.
2. **Eventos de era**: uma roda nova, separada dos dourados, com um evento por era. O evento de uma era entra na roda quando
   você chega nela e continua depois; o da era em que você está sai mais.
3. **16 conquistas**: uma por evento, "300 de cada gerador da era", "todas as melhorias da era" e uma escondida do
   *Under the Silver Lake*.
4. **Easter egg do Sillas**: três cliques seguidos no primeiro gerador da Loja mostram "Sillas Gabriel Coelho Sena" na tela
   inteira. **Não entra nos patch notes** nem em nenhum texto do jogo.

Fica pra entregas seguintes: as melhorias de era (multiplicam os geradores de uma era antiga e liberam numa era nova,
então chegam junto de cada era nova), dourados e caixinha novos, eras 6–12 e a árvore. A árvore não mexe nos eventos de
era nesta entrega (o ramo Espaço, na entrega da árvore, pode mexer).

## 1. Níveis 150, 200 e 300

- `NIVEIS = [1, 10, 25, 50, 100, 150, 200, 300]`. `PRECO_NIVEL` ganha 3 valores com a mesma forma das de hoje (a de 100
  custa uns 4× o preço da 100ª unidade): ponto de partida `5e9`, `5e12`, `5e18`. A simulação decide os valores finais
  (ver Testes).
- ids `g·10 + 6..8` (não batem com gerais 1001+ nem sinergias 2001+). O SQL já é genérico (`2^count` em `idle_rate_at`,
  `idle_upg_unlocked` olha `requer`): só muda o catálogo.
- `nomes.ts`: `MELHORIAS_GERADOR` vira tupla de 8. Frase gerada igual às de hoje ("Dobra o que X rende.").
- Ícone: `tela.ts` `NIVEL` ganha `rubi`, `esmeralda` e `cosmo` (cores novas no CSS das melhorias, tokens do jogo).
- Caixinha de informação: a de melhoria que já existe (`dicaMelhoria`) serve; conferir que mostra o nível certo.

### Os 90 nomes (150 · 200 · 300)

| # | Gerador | 150 | 200 | 300 |
|---|---|---|---|---|
| 1 | Você, no notebook da faculdade | ChatGPT fazendo o TCC | Starlink no quarto | Aviso de despejo em 5 dias |
| 2 | Post motivacional no LinkedIn | Carrossel de 10 slides | Selfie chorando depois do layoff | Selo de Top Voice |
| 3 | Planilha no Excel | PROCX | Copilot na planilha | Planilha que roda Doom |
| 4 | Vendendo pra tia no grupo da família | Encaminhada com frequência | Corrente com link de pagamento | Ceia de Natal com maquininha |
| 5 | Freela no Fiverr | Cliente que paga em "visibilidade" | Logo de 5 dólares em 24 h | Contrato em dólar |
| 6 | Live na Twitch | Emote próprio | Doação com voz de robô | Subathon de 30 dias |
| 7 | Estagiário | Vale-refeição de F$ 12 | Mesa perto da janela | Estagiário do ano (sem vínculo) |
| 8 | Impressora 3D | Imprimiu a peça que quebrou | Action figure do chefe | Imprimiu uma casa |
| 9 | Grupo de vendas no zap | Comunidade com 50 grupos | Canal com selo verde | Bot que manda bom dia |
| 10 | Dropshipping | Remessa Conforme | Fornecedor da Temu | Galpão no Paraguai |
| 11 | Food truck | Smash burger | Fila por causa do TikTok | Ponto fixo no estádio |
| 12 | Loja no Mercado Livre | Anúncio patrocinado | Chega amanhã | Avião de carga próprio |
| 13 | PPP Podcast | Corte com legenda amarela | Mesa com 7 microfones | Mensagem subliminar no episódio |
| 14 | Influencer parceiro | Publi de bet | Recebido de carro | Depoimento na CPI |
| 15 | App na App Store | Pop-up pedindo 5 estrelas | Assinatura sem botão de cancelar | Termos de uso de 90 páginas |
| 16 | Curso online | Método com nome em inglês | Imersão num resort | Mentoria de F$ 50 mil |
| 17 | Agência de marketing | Trend da dancinha | Briefing em áudio de 7 min | Comercial no intervalo do BBB |
| 18 | Coworking próprio | Kombucha na torneira | Cabine de ligação | Endereço na Faria Lima |
| 19 | Grupo de trader | Tigrinho no intervalo | Print de lucro editado | Corretora nas Bahamas |
| 20 | Investidor anjo | Term sheet no guardanapo | Anjo do Shark Tank | Anjo com jatinho |
| 21 | Fazenda de servidores | GPU com fila de espera | Servidor na Islândia | Data center no fundo do mar |
| 22 | Rodada série A | Down round disfarçado | Valuation de unicórnio | Cheque do SoftBank |
| 23 | Laboratório de inovação | Óculos de realidade virtual | Metaverso (abandonado) | IA que faz os slides |
| 24 | Fusão com a concorrência | Aprovado pelo Cade | Demissão em massa por vídeo | Nome novo de três letras |
| 25 | Rolê patrocinado | Copão de 2 litros | Água a F$ 25 | Festival que vira documentário |
| 26 | Comprar um time do Brasileirão | Bet na camisa | Craque de volta aos 36 | Libertadores |
| 27 | Ilha particular | Gerador a diesel | Bunker embaixo da piscina | Bunker pra ascender |
| 28 | Filial em Dubai | Chocolate de Dubai | Lamborghini da polícia | Apartamento na Palm |
| 29 | IPO na bolsa | Circuit breaker | Ação meme | Recompra de ações |
| 30 | Foguete pra Marte | Foguete pego com hashi | Carro esportivo em órbita | Passagem só de ida |

*Under the Silver Lake*: "Aviso de despejo em 5 dias" (o Sam), "Mensagem subliminar no episódio" (as mensagens escondidas
nas músicas) e "Bunker pra ascender" (o milionário enterrado no bunker). Interestelar fica pras eras 9, 10 e 12.

## 2. Eventos de era

### A roda

- Igual aos dourados (só pra quem está com o jogo aberto; semente id + segundo; o banco refaz a conta e confere o
  clique), com outra mistura e outra chance: **1/1800 por segundo** (~1 a cada 30 min de jogo aberto).
- Quais podem sair: os das eras 1 até a sua era atual (`idle_era`). Peso 3 pro da era atual e 1 pros antigos.
- Não sai junto de um dourado no mesmo segundo (o dourado ganha); um evento de era por vez na tela.
- Cada evento paga uma vez (tabela `idle_eventos_pegos`, chave usuário + segundo, como `idle_dourados_pegos`).
- Funções novas no banco: `idle_evento_era(u, s, era)` (o tipo do segundo, ou null) e `idle_evento_pegar(seg, gols)`
  (pega com `idle_lock`, recusa segundo a mais de 60 s de agora, confere a janela do tipo + 3 s de folga, `idle_settle`,
  aplica o efeito, conta, dá conquista, `idle_save`). Em TS: `eventosEra.ts` com a mesma conta (teste de paridade) e
  `eventoEraTela.ts` desenhando.

### Os 5 eventos

| Era | Evento | Na tela | Janela | Efeito (no banco) |
|---|---|---|---|---|
| 1 | **"Desce pra almoçar!"** | A mãe aparece na porta da cena com o balão; botão "Já vou!" | 8 s | **Marmita da mãe**: produção ×3 por 3 min |
| 2 | **Pacote da Shopee** | Uma caixa cai na cena; clicar abre | 12 s | Sorteio pela semente: 50% = 1 h de produção menos 20% ("Taxa das blusinhas: −20%"); 35% = Promoção por 1 min; 15% = ×5 por 2 min |
| 3 | **Reunião que podia ser um e-mail** | Janela de call com 6 quadradinhos; botão "Sair da call" | 12 s | 30 min de produção na hora ("o tempo que você ia perder") |
| 4 | **Tela azul** | Faixa azul sobre a cena ("Seu PC encontrou um problema"); botão "Reiniciar" | 5 s | **Atualização instalada**: melhorias 25% mais baratas por 2 min |
| 5 | **Jogo do Brasil** | Uma bola pula de ponto em ponto da cena por 30 s; cada clique nela é gol | 30 s | Cada gol = 5 min de produção, até 7. A página manda os gols no fim; o banco aceita 0 a 7 |

- "Produção" nos pagamentos na hora = `idle_rate` (a mesma base do Investidor apressado, sem os bônus de tempo).
- **Marmita**: coluna `marmita_ate timestamptz`. Pegar outra com uma valendo soma 3 min no fim. Multiplica com tudo
  (×5 das oportunidades e ×10 do Viralizou): entra como fator ×3 e um ponto de corte a mais em `idle_settle` e em
  `economia.ts produzido`.
- **Atualização instalada**: coluna `upg_desc_ate timestamptz`. Multiplica com Promoção, Horta e meia-preço (como a
  Horta faz hoje): ×0,75 no ramo `melhoria` de `idle_buy` e em `custoMelhoria` na `tela.ts`; a tela re-renderiza quando
  ela liga e desliga (igual à Promoção em `main.ts`).
- Shopee "Promoção por 1 min" usa o `promo_ate` que já existe; "×5 por 2 min" põe um fim de 2 min em `boost_ate`.
- Colunas novas entram em `idle_save`, `idle_json` e `IdleState`. A venda da startup (`idle_prestige`) zera as duas.
- Contadores: coluna `eventos_era jsonb` (`{"mae": n, "shopee": n, "call": n, "tela": n}`), que **não** zera na venda.

### Selos e caixinha de informação

- Selos ao lado do F$, como os de hoje: "Marmita ×3 · 2:41" e "Melhorias −25% · 1:40".
- Caixinha (mouse no PC, foco no teclado): no evento na tela (o que ele dá agora, em números da pessoa: "Dá F$ 1,2 mi
  agora" / "Produção ×3 por 3 min") e nos dois selos novos (quanto falta e o que está valendo). No celular não tem.
- Texto que sobe quando pega, como `textoPegou`: "Marmita da mãe! ×3 por 3 min", "+F$ 980 mil (Taxa das blusinhas:
  −20%)", "Fugiu da call! +F$ 1,2 mi", "Atualização instalada! Melhorias −25%", "4 gols! +F$ 3,1 mi".

### Arte e som

- Desenhos em pixel no estilo da cena (contorno escuro, as cores do kit): a mãe na porta (com balão), a caixa da
  Shopee laranja, a janela da call, a faixa azul (sem logo nem texto de marca real) e a bola. Ficam em
  `games/idle/assets/eventos/`. A mãe e a bola animam em 2 quadros.
- Sons sintetizados em `games/idle/audio/` (sem arquivo): campainha da porta, caixa abrindo, "tutum" de sair da call,
  bipe de erro do PC e apito + torcida no gol. O Juan julga na página de audição.
- `?mock`: o painel ganha os 5 eventos pra forçar.

## 3. Conquistas

Textos em `nomes.ts`, catálogo gerado (migração nova). Visíveis ficam na grade antes das escondidas.

| id | Nome | Condição | Frase | Tipo |
|---|---|---|---|---|
| 116 | Já vou, mãe! | Atender a mãe 10 vezes | Disse "já vou" dez vezes. Ela sabe que é mentira. | evento `evt_mae`, 10 |
| 117 | Taxa das blusinhas | Abrir 10 pacotes da Shopee | Pagou imposto em dez pacotes de coisa que você nem lembra que comprou. | evento `evt_shopee`, 10 |
| 118 | Podia ser um e-mail | Sair de 25 reuniões | Fugiu de vinte e cinco reuniões. Ninguém percebeu, nem quando você estava nelas. | evento `evt_call`, 25 |
| 119 | Já tentou desligar e ligar? | Reiniciar 10 telas azuis | Dez telas azuis. O TI mandou abrir chamado. | evento `evt_tela`, 10 |
| 120 | 7 a 1 (pra nós) | Fazer os 7 gols num Jogo do Brasil | Agora sim. Ninguém do grupo lembra de 2014. | evento `evt_gols`, 7 |
| 121 | Quarto lotado | Ter 300 de cada gerador da era 1 | Trezentos de cada coisa e a cama ainda é um colchão no chão. | estado `era_300`, alvo 1 |
| 122 | A garagem não fecha mais | Ter 300 de cada gerador da era 2 | O carro do seu pai dorme na rua há dois anos. | estado `era_300`, alvo 2 |
| 123 | Open space | Ter 300 de cada gerador da era 3 | Sem parede, sem privacidade, sem saída. | estado `era_300`, alvo 3 |
| 124 | A Faria Lima é minha | Ter 300 de cada gerador da era 4 | Cada colete da avenida tem o seu logo. | estado `era_300`, alvo 4 |
| 125 | Holding das holdings | Ter 300 de cada gerador da era 5 | Uma empresa dona da outra, e nenhuma paga imposto. | estado `era_300`, alvo 5 |
| 126 | Setup completo | Comprar todas as melhorias da era 1 | Tudo comprado. Agora só falta sair do quarto. | estado `era_melhorias`, alvo 1 |
| 127 | Garagem tunada | Comprar todas as melhorias da era 2 | Melhoria de sobra e o portão ainda é manual. | estado `era_melhorias`, alvo 2 |
| 128 | Escritório premium | Comprar todas as melhorias da era 3 | Até a cadeira da reunião faz massagem. A reunião continua inútil. | estado `era_melhorias`, alvo 3 |
| 129 | Andar de luxo | Comprar todas as melhorias da era 4 | Banheiro novo pra estagiário chorar com conforto. | estado `era_melhorias`, alvo 4 |
| 130 | Sede cinco estrelas | Comprar todas as melhorias da era 5 | Heliponto, academia e um RH que não responde. | estado `era_melhorias`, alvo 5 |
| 131 | Embaixo do lago prateado | Comprar "Mensagem subliminar no episódio" | Toda música tem uma mensagem escondida. Essa também. | escondida, `melhoria`, alvo 138 |

- "Todas as melhorias da era" = as 8 de cada um dos 6 geradores da era + as 4 gerais dela.
- `era_300` e `era_melhorias` entram em `idle_check_conquistas` (redefinida a partir da 0055). As de evento saem de
  `idle_ganhar` dentro de `idle_evento_pegar` com o contador (`evt_gols` com o número de gols do jogo).
- Cada conquista vale +1% de produção, como as outras.

## 4. Easter egg do Sillas

- Três cliques (ou toques) em até 600 ms no desenho ou no nome do gerador 1 na Loja (não nos botões de comprar) abrem
  uma camada por cima de tudo com "Sillas Gabriel Coelho Sena" grande, na fonte do jogo, centralizado. Some com clique,
  Esc ou depois de 4 s.
- Só página: nada no banco, nenhum som novo, nada em `novidades.ts`, sem conquista.

## 5. Patch notes

Entrada nova no começo de `novidades.ts`, no tom do jogo: as melhorias novas dos 30 geradores, os 5 eventos de era e as
conquistas. Sem o Sillas e sem a conquista escondida.

## Migrações

- `0073_fellas_inc_catalogo_eras_1_5.sql`: catálogo gerado (melhorias novas e conquistas 116–131) com
  `ATUALIZAR_CATALOGO`.
- `0074_fellas_inc_eventos_era.sql`: colunas novas em `idle_state`, `idle_eventos_pegos`, `idle_evento_era`,
  `idle_evento_pegar`, e as redefinições de `idle_settle`, `idle_buy`, `idle_save`, `idle_json`, `idle_prestige` e
  `idle_check_conquistas`. Feita a partir da definição mais recente de cada uma.
- As duas entram em `games/test/db.ts` e `games/dev/mockDb.ts` (o `mockDb.ts` também está sem a 0071 e a 0072: pôr
  junto). Conferir antes do push se nenhuma outra sessão pegou esses números.

## Testes

- `catalogo.test.ts`: contagens novas (240 melhorias de gerador, conquistas 104 visíveis e 15 escondidas) e a 0073 igual
  ao `catalogoSql()`.
- Simulação: os níveis novos não podem quebrar os ritmos que já valem (era 5 no dia 4–5, gerador 30 fora da 1ª semana,
  ~17 pontos na 1ª semana). Ajustar `PRECO_NIVEL` até passar.
- Paridade TS × banco: a roda dos eventos de era (tipo por segundo e pesos por era), o fechamento da conta com a
  Marmita (sozinha, com ×5 e com Viralizou) e o preço das melhorias com a Atualização (sozinha e com Promoção, Horta e
  meia-preço).
- Banco: cada evento paga uma vez; recusa fora da janela; Jogo do Brasil com 8 gols vira 7; Shopee sorteia igual ao TS;
  contadores não zeram na venda; marmita e desconto zeram; conquistas de evento e de estado.
- Tela: o selo novo, a caixinha do evento e dos selos, o easter egg (3 cliques abre, 2 não, clique no botão de comprar
  não conta).
- `npx tsc --noEmit` e `npm test` passando; jogos com `--maxWorkers=4`. Conferir em 1280×720, 2000×961 e no celular
  (iframe de 390 px).
