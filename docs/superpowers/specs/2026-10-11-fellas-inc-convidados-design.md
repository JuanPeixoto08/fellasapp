# Fellas Inc.: Convidados no PPP Podcast (minigame 3)

Data: 2026-10-11. Terceiro minigame da bancada (ordem do Juan: Bolsa, Horta, Convidados, Lives). Estilo Templo do
Cookie Clicker: 3 cadeiras de forças diferentes, 11 convidados, cada um com um bônus e um defeito; trocar custa e
recarrega. Decisões do Juan nesta conversa. Textos com humor ácido (pedido do Juan), sem inventar fato sobre ninguém.

## Cadeiras e trocas

- Gaveta **Convidados** na bancada; sem PPP Podcast (gerador 13) fica apagada com "Compra 1 PPP Podcast pra abrir o
  estúdio".
- Cadeiras pelos PPP Podcasts: **frente** abre com 1 e vale **100%**; **meio** abre com 25 e vale **50%**; **canto**
  abre com 50 e vale **25%**. O peso (`p` = 1 · 0,5 · 0,25) escala o bônus **e** o defeito.
- **Trocas:** 3 guardadas. Sentar alguém (em cadeira vazia ou no lugar de outro) gasta 1; cada troca gasta volta em
  1 h, uma por vez (a recarga anda enquanto falta troca). Tirar alguém e deixar vazia é de graça.
- Um convidado só pode estar numa cadeira por vez (mudar de cadeira = tirar + sentar, gasta 1).
- **Gemaplys e MC V.V não sentam juntos:** o banco recusa com `idle_conv_mesma_pessoa`; a tela mostra "São a mesma
  pessoa?". A primeira tentativa dá a conquista escondida.
- Cadeira trancada (menos PPP Podcasts, por exemplo depois de vender a startup): o convidado continua sentado, sem
  efeito nenhum, até ela reabrir. Não dá pra sentar em cadeira trancada; tirar dá.
- **Vender a startup não mexe** nas cadeiras, nas trocas nem nos tempos (como a Horta).
- `sentado_em` de cada cadeira guarda quando o convidado sentou (Kojima e MC V.V contam dele).

## Os 11 convidados

Valores da cadeira da frente (`p` = 1); no meio e no canto, multiplicados por `p`. Na tela, os descontos e aumentos são
escritos por extenso ("geradores 10% mais baratos", "melhorias 10% mais caras"), nunca "−10%".

| id | Convidado | Bordão (tela) | Bônus | Defeito |
|---|---|---|---|---|
| 1 | Cristiano Ronaldo | "SIUUU. Já falei hoje que eu sou o melhor da história?" | produção +15% | melhorias 10% mais caras |
| 2 | Daniel Vorcaro | "Rende 140% do CDI. Confia." | ações compradas com ele sentado: o ganho conta (1 + p)× na venda | a perda também conta (1 + p)× (na frente, caiu pela metade = pó) |
| 3 | Gemaplys | "O único canal de jogo que o jogo pede pra parar." | eventos dourados aparecem (1 + p)× mais | ficam na tela 12 × (1 − p/2) s |
| 4 | Luva de Pedreiro | "Receba!" | limite de oportunidades do dia + ⌈5p⌉ | produção −5% |
| 5 | Hideo Kojima | "Um podcast de Hideo Kojima. Uma cadeira de Hideo Kojima." | produção começa em −10% e sobe +50%/24 a cada hora sentado, até +40% em 24 h | trocar ou tirar zera |
| 6 | Gabe Newell | "Ele sabe contar até 2." | geradores 10% mais baratos | limite de oportunidades do dia − ⌈3p⌉ |
| 7 | Terry Crews | "POWER! O peitoral dele tem CNPJ próprio." | plantas que entram com ele sentado amadurecem 30% mais rápido | e vivem 20% menos |
| 8 | Viniccius13 | "Já fez uma réplica do estúdio no Minecraft. Ficou melhor." | chance de cruzamento da Horta (1 + p)× | sementes 50% mais caras |
| 9 | MC V.V | "Lançou o BONDA. O YouTube derrubou o BONDA." | a cada 2 h / p sentado solta uma faixa = evento dourado garantido na tela | cada faixa tem 25% de chance de ser derrubada por copyright: em vez do dourado, produção −10% por 30 min |
| 10 | Ana Mary B | "Maquiagem básica pro dia a dia." | das 6h ao meio-dia (Brasília) o Food truck (gerador 11) rende ×(1 + p) | o resto do dia, produção −5% |
| 11 | VSauce | "Hey, VSauce, Michael aqui. Ou não?" | a Bolsa mostra o humor atual de cada empresa (seta) | produção −5% |

Detalhes:

- **Percentuais com p:** produção ×(1 + b·p), custo ×(1 + d·p). Cristiano no meio: produção +7,5%, melhorias 5% mais
  caras. Os descontos e aumentos dos convidados **multiplicam** com os da Horta, a Promoção e a meia-preço (como a
  Horta).
- **Vorcaro (alavancagem):** na compra com o Vorcaro sentado na cadeira de peso p, as ações entram num **lote
  alavancado** com `alavanca = 1 + p` e o preço pago (em segundos de produção; compras novas no mesmo lote fazem preço
  médio ponderado; lotes de alavancas diferentes ficam separados). Na venda de um lote alavancado recebe
  `qtd × max(0, compra + alavanca × (preço − compra)) × r`, sem taxa. O lote fica alavancado até vender, mesmo que o
  Vorcaro saia. Os lotes contam no limite da empresa, atravessam a venda da startup e viram pó com a empresa como as
  ações normais. Na tela, o detalhe da empresa mostra as ações normais e cada lote ("Alavancadas ×2 · pagou 100")
  com os próprios botões Vender 1 · 10 · Tudo.
- **Gemaplys:** a chance do dourado por segundo vai de 1/600 para (1 + p)/600 (mesma semente, `dourados.ts` e banco);
  o tempo na tela vai de 12 s para 12 × (1 − p/2) s, e a folga do banco encolhe junto.
- **Luva e Gabe:** mexem em `idle_opp_cap` (frente +5 / −3, meio +3 / −2, canto +2 / −1). O limite nunca fica abaixo
  de 1.
- **Kojima:** degraus de hora em hora desde `sentado_em`: produção ×(1 + p × (−0,10 + 0,50 × min(24, h) / 24)), com
  h = horas inteiras. A conta (`idle_settle`) vira em cada degrau.
- **Terry:** a planta guarda o próprio `amadurece_s` e `vida_s` quando entra (plantada ou brotada): ×(1 − 0,30p) e
  ×(1 − 0,20p). Plantas antigas não mudam; tirar o Terry não muda as que já entraram. `horta.ts` passa a usar os
  tempos da planta (vêm no JSON da horta).
- **Viniccius13:** o cruzamento por passo vai de 5% para 5% × (1 + p); o Morango não muda. Semente ×(1 + 0,5p).
- **MC V.V:** faixa k sai em `sentado_em + k × (2 h / p)` (k = 1, 2, …). Sorte com semente (jogador, k): 25% derrubada
  → produção ×(1 − 0,10p) por 30 min; senão um dourado aparece na tela naquele instante (tipo sorteado como os outros,
  mesmas regras de pegar). Faixas antes de a pessoa abrir o jogo também valem (a derrubada já passou; o dourado só
  existe nos 12 s dele, como os outros).
- **Ana Mary B:** a janela é 06:00–12:00 em America/Sao_Paulo. A conta vira às 6h e ao meio-dia.
- **VSauce:** o humor atual (0 parada · 1 sobe devagar · 2 cai devagar · 3 sobe forte · 4 despenca · 5 maluca) vai no
  JSON da Bolsa só para quem tem o VSauce numa cadeira destrancada; a tela mostra uma seta e o nome do humor.

## Conquistas (+1% de produção cada, como as outras; ícones gerados dos retratos)

| Nome | Frase | Como ganha | Tipo |
|---|---|---|---|
| Tá gravando? | "Episódio 1: 40 minutos arrumando o microfone." | sentar o primeiro convidado | evento conv_sentou |
| Mesacast | "Três convidados, um microfone funcionando e zero pauta." | ter as 3 cadeiras ocupadas | evento conv_mesa |
| Todo mundo já sentou aqui | "Até o Kojima chegou no horário." | sentar os 11 ao menos uma vez | conv_vistos 11 |
| Água! | "Afastou duas Coca-Colas e a marca perdeu 4 bilhões. Respeita." | sentar o Cristiano na cadeira da frente | evento conv_cr |
| O FGC não cobre | "Rendia 140% do CDI. Rendia." | um lote alavancado virar pó (vendido por 0 ou empresa quebrou) | evento conv_fgc |
| Que geometria | "Ficou 24 h no estúdio e entregou uma encomenda." | Kojima 24 h sentado (degrau máximo) | conv_kojima |
| Half-Life 3 confirmado | "Ele finalmente contou até 3." | sentar o Gabe na 3ª cadeira (canto) | evento conv_hl3 |
| Sample não liberado | "Lost media brasileira." | uma faixa do MC V.V derrubada | conv_derrubadas 1 |
| Cozinheira matutina | "Acordou às 5h, fez a maquiagem básica e saiu 11h50." | estar com a Ana sentada às 6h | conv_ana |
| Receba! | "Obrigado meu Deus, obrigado meu pai." | pegar 15 oportunidades num dia | opp_dia 15 |
| São a mesma pessoa? (escondida) | "Nunca foram vistos juntos." | tentar sentar o Gemaplys e o MC V.V juntos | evento conv_mesma |

Ids pelo gerador do catálogo (`ATUALIZAR_CATALOGO`), como na Horta. A escondida vai junto das outras escondidas.

## Banco

- `0049_fellas_inc_catalogo_convidados.sql`: catálogo gerado com as 11 conquistas.
- `0050_fellas_inc_convidados.sql`:
  - `idle_cat_conv` (os 11, lido por membros; paridade com `convidados.ts`).
  - `idle_state` + `conv_cadeira int[3]` (id do convidado ou null), `conv_desde timestamptz[3]`, `conv_trocas int`
    (guardadas), `conv_recarga timestamptz` (quando a próxima volta), `conv_vistos int[]`, `conv_derrubadas int`.
  - Lotes do Vorcaro: tabela `idle_bolsa_lotes` (user_id, empresa, alavanca, qtd, compra).
  - Plantas: `idle_horta_plantas` + `amadurece_s`, `vida_s` (preenchidos com os do catálogo nas antigas).
  - Funções com os convidados: `idle_rate_at` (produção, Kojima, Ana, derrubada), `idle_settle` / `idle_next_change`
    (viradas: degraus do Kojima, 6h/12h da Ana, início e fim de derrubada), `idle_buy` (geradores do Gabe, melhorias do
    Cristiano), `idle_opp_cap`, dourados (Gemaplys, faixas do MC V.V), Bolsa (lotes, humor pro VSauce), Horta (Terry,
    Viniccius13), `idle_json`, `idle_check_conquistas`.
  - RPCs `idle_conv_sentar(p_cadeira, p_convidado)` e `idle_conv_tirar(p_cadeira)`; erros `idle_conv_trancada`,
    `idle_conv_sem_troca`, `idle_conv_ja_sentado`, `idle_conv_mesma_pessoa`, `idle_conv_fechado`.
  - Como todas as ações, rodam em `idle_lock` e fecham a conta antes de mudar a cadeira.
- Tráfego: o estado dos convidados vai no JSON que o jogo já recebe; nada novo no Storage; nenhuma consulta periódica
  nova (o egress do Supabase segue sem risco).

## Página

- `convidados.ts` (catálogo, pesos, efeitos, tempos, textos), `convidadosTela.ts` (estúdio com as 3 cadeiras: retrato,
  nome, bônus em verde, defeito em vermelho, efeito na cadeira; lista dos 11 ao tocar numa cadeira, com quem já está
  sentado marcado; contador "Trocas: 2/3 · próxima em 43 min"; ao vivo: Kojima com a % subindo, MC V.V com "próxima
  faixa em …" e o selo "Derrubada por copyright", Ana com "Cozinhando (até 12h)" ou "Se maquiando").
- Retratos 32 × 32 aprovados pelo Juan (folha v3c, 12/10): estilo da imagem do Gemaplys (sem contorno, cores chapadas,
  cabeça grande). Gemaplys = a imagem dele; Viniccius13 = a skin de Minecraft dele, de frente, sem o fone; os outros
  desenhados olhando fotos. Gerador em `../fellas-inc-esbocos/conferencia/retratos3.py` (+ `vini.py`); as fotos de
  referência não vão pro repositório. Falta a referência do Luva de Pedreiro (o Juan manda).
- Cena: o convidado da cadeira da frente aparece no lugar do `ppp-convidado` (de costas: cabelo, pele e roupa dele).
- Bolsa: lotes do Vorcaro marcados; setas do VSauce.
- Textos da Horta passam a dizer "geradores 1% mais baratos" / "melhorias 3% mais baratas" (pedido do Juan).
- Sons: reaproveitar os existentes (sentar = plim; derrubada = bonk).
- `?mock`: painel com +25 PPP Podcasts, trocas cheias, avançar o Kojima 1 h / 24 h, soltar faixa do MC V.V
  (normal / derrubada), forçar a hora da Ana.
- Patch notes: "Convidados no PPP Podcast". Mostrar ao Juan no servidor de teste antes do db push.

## Fora do escopo

Notificação no app (o Juan não quer), Lives (minigame 4), propriedades.
