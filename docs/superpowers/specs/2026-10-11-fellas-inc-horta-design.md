# Fellas Inc.: Horta do Food truck (minigame 2)

Data: 2026-10-11. Segundo minigame da bancada (ordem do Juan: Bolsa, Horta, Convidados, Lives). Estilo jardim do
Cookie Clicker: plantas crescem em tempo real, maduras dão bônus, morrem de velhas; vizinhas cruzam e brotam espécies
novas (coleção). Decisões do Juan nesta conversa.

## Plantas

| id | Planta | Como consegue | Bônus madura | Amadurece | Vive madura | Semente |
|---|---|---|---|---|---|---|
| 1 | Pé de Pix | loja (desde o início) | produção +1% | 1 h | 8 h | 10 min |
| 2 | Couve do Coach | loja (desde o início) | geradores −1% | 1 h | 8 h | 10 min |
| 3 | Mandioca Turbo | Pix + Pix | produção +3% | 3 h | 12 h | 30 min |
| 4 | Inhame do Primo Rico | Pix + Couve | oportunidades e Investidor +5% | 2 h | 10 h | 30 min |
| 5 | Coentro | Couve + Couve | melhorias −3%, produção −1% | 1 h | 6 h | 30 min |
| 6 | Abacate Proteico | Mandioca + Inhame | produção +2%, geradores −2% | 4 h | 12 h | 30 min |
| 7 | Quiabo Escorregadio | Abacate + Couve | geradores −4% | 6 h | 16 h | 30 min |
| 8 | Morango com Pescoço | rara: onde uma planta morreu de velha | produção +8% | 8 h | 24 h | 30 min |

"Semente" = minutos da produção atual (preço = segundos × F$/s). Vida total = amadurece + vive madura.

## Mecânica

- Canteiros pela quantidade de Food truck (gerador 11): 1 → 2×2, 25 → 3×3, 50 → 4×4, 100 → 5×5, 200 → 6×6. Índice
  do canteiro = linha × 6 + coluna (a grade é sempre lida numa 6×6; os fora do tamanho atual estão trancados). Com
  menos Food trucks, canteiros com planta ficam trancados (a planta continua, mas não dá pra mexer nem conta bônus).
- Plantar: canteiro destrancado e vazio, semente descoberta (Pix e Couve desde o início), paga o preço.
- Fases: muda (primeiro terço do amadurecer), crescendo, madura (dá bônus), murchando (última hora madura, ainda dá
  bônus), morta (some; o canteiro fica vazio).
- Colher (só madura): libera a semente da espécie (descoberta) se nova; esvazia. Arrancar: esvazia, nada volta.
- Cruzamento: a cada passo de 5 min, canteiro destrancado vazio com duas vizinhas (8 ao redor, destrancadas) maduras
  do par de alguma receita → 5% de chance de brotar uma muda dessa espécie (se mais de uma receita serve, sorteia).
  Par igual (Pix + Pix) precisa de duas vizinhas Pix.
- Morango com Pescoço: canteiro vazio onde uma planta morreu de velha nas últimas 6 h (e nada nasceu depois): 1% por
  passo. Só sai assim (a semente libera ao colher).
- Avanço preguiçoso: a cada chamada o banco anda a horta do último passo até agora, no máximo 7 dias (2016 passos).
  Sorte com semente (jogador, canteiro, passo): reabrir dá o mesmo resultado.
- Bônus somam por planta madura destrancada: produção (mult = 1 + soma), geradores e melhorias (desconto = soma, teto
  50%), oportunidades/Investidor (+soma).
- Produção da horta entra na taxa (`idle_rate_at`, igual pra recorde, placar, pontos da venda). A conta (`idle_settle`)
  vira nos instantes em que uma planta amadurece ou morre; `idle_next_change` inclui o próximo desses instantes e o
  próximo passo em que algo pode brotar (a página recarrega nessa hora).
- Vender a startup não mexe na horta nem nas descobertas.

## Conquistas (+1% de produção cada, ícones gerados dos desenhos das plantas)

| id | Nome | Condição | Frase | Tipo |
|---|---|---|---|---|
| 63 | Dinheiro dá em árvore sim | plantar o 1º Pé de Pix | "Seu pai mentiu pra você." | evento horta_pix |
| 64 | Agro é pop | plantar 100 plantas | "Agro é tech, agro é pop, agro é tudo." | horta_plantou 100 |
| 65 | Colheita Feliz | colher 50 plantas | "Saudades de roubar ovo do vizinho no Orkut." | horta_colheu 50 |
| 66 | Saudando a mandioca | descobrir a Mandioca Turbo | "Uma das maiores conquistas do Brasil." | evento horta_mandioca |
| 67 | Coentro é bom sim | colher um Coentro | "Alguém tinha que defender." | evento horta_coentro |
| 68 | Pai rico, pai pobre | descobrir o Inhame do Primo Rico | "Já leu o livro? Ele leu a capa." | evento horta_inhame |
| 69 | Shape inexplicável | colher um Abacate Proteico | "Treino, dieta e abacate." | evento horta_abacate |
| 70 | Planta de plástico era melhor | 10 plantas morrerem de velhas | "Pelo menos ela não julga." | horta_morreu 10 |
| 71 | Temos que plantar | descobrir as 8 | "Ash Ketchum da roça." | horta_colecao 8 |
| 72 | Fazendinha do Facebook | ter 200 Food trucks (horta 6×6) | "Convida os amigos pra regar." | gerador 11 = 200 |
| 112 | Ele tem pescoço sim (escondida) | ver um Morango com Pescoço brotar | "Você viu com seus próprios olhos." | evento horta_morango |

## Banco

- `0047_fellas_inc_catalogo_horta.sql`: o catálogo gerado (`ATUALIZAR_CATALOGO`) com as 11 conquistas novas.
- `0048_fellas_inc_horta.sql`: `idle_cat_horta` (o catálogo das plantas, lido por membros; paridade com `horta.ts`);
  `idle_horta_plantas` (id, user_id, canteiro, especie, inicio, fim: colhida/arrancada; a morte natural é calculada;
  fica o histórico até a conta passar dele); `idle_horta_descobertas`; `idle_state` + `horta_passo`, `horta_plantou`,
  `horta_colheu`, `horta_morreu`. Funções: avanço, bônus em t, `idle_rate_at`/`idle_settle`/`idle_next_change`/
  `idle_buy`/`idle_claim_opportunity`/`idle_dourado_pegar`/`idle_json`/`idle_check_conquistas` com a horta. RPCs
  `idle_horta()`, `idle_horta_plantar(p_canteiro, p_especie)`, `idle_horta_colher(p_canteiro)`,
  `idle_horta_arrancar(p_canteiro)`; erros `idle_horta_ocupado`, `idle_horta_vazio`, `idle_horta_trancado`,
  `idle_horta_semente`, `idle_horta_verde`.

## Página

- `horta.ts` (fases, tempos, resumo, grade, dicas), `hortaTela.ts` (grade de terra, cartão do canteiro, coleção),
  ícones de pixel das 8 + muda + murcha. Gaveta Horta na bancada (celular: tela cheia; PC: na bancada, sem a cena),
  apagada até 1 Food truck. Sons: ploc (plantar), tchiling (colher), fanfarrinha (espécie nova).
- `?mock`: painel com dar Food trucks, avançar a horta 1 h / 8 h e forçar cruzamento.
- Patch notes: "Horta do Food truck". Mostrar ao Juan no servidor de teste antes do db push.
