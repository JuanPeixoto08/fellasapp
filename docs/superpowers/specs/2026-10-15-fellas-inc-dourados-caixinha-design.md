# Fellas Inc.: dourados novos e oportunidades novas na caixinha (entrega 5 do plano das eras 6–12)

Decidido com o Juan em 15/10. Vale pra todas as eras (os eventos de era são outra coisa e já saíram na entrega 4).
A frequência não muda: ~1 dourado a cada 10 min de jogo aberto e 1 oportunidade por janela de 10 min (até 10 por
dia). Os tipos novos dividem a roda com os antigos, e o ganho médio de cada sorteio fica parecido com o de hoje, pra
não mexer no ritmo de ~2 meses até a era 12.

## O que entra

1. Quatro dourados novos (Trend do TikTok, Bombou no LinkedIn, Pix errado, Tigrinho) e o Combo.
2. Cinco tipos novos na caixinha (Chamar um dourado, Cupom de primeira compra, Adubo de farmácia, Cashback,
   Informação privilegiada).
3. Conquistas 132–139 (6 visíveis, 2 escondidas), com ícone.
4. Arte, som, caixinha de informação, `?mock` e patch notes.

## 1. Dourados

### A roda

O tipo continua saindo de `idle_dourado_tipo(u, s)` (`tipoDourado` em `dourados.ts`): `r = h3 % 100`, com a mesma
mistura de hoje. Só a tabela muda:

| Tipo | Nome | Hoje | Novo | Faixa de `r` |
|---|---|---|---|---|
| 3 | Dupla de Viralizou | 2 | 2 | 0–1 |
| 2 | Viralizou | 18 | 13 | 2–14 |
| 1 | Promoção relâmpago | 35 | 18 | 15–32 |
| 0 | Investidor apressado | 45 | 25 | 33–57 |
| 4 | Trend do TikTok | — | 12 | 58–69 |
| 5 | Bombou no LinkedIn | — | 12 | 70–81 |
| 6 | Pix errado | — | 10 | 82–91 |
| 7 | Tigrinho | — | 8 | 92–99 |

- `TIPOS_DOURADO` e `TipoDourado` ganham os 4 (0 a 7). Sem janela de corte: um dourado que estiver na tela na hora do
  deploy pode trocar de tipo ao recarregar, e tudo bem.
- A faixa do MC V.V (`idle_conv_faixa` / `faixaEm`) nunca dá Tigrinho: se sair 7, vira 0 (Investidor). Os dourados
  garantidos (Pix devolvido e Chamar) também não, e nem Pix (ver abaixo).
- O que já vale pra todos continua valendo pros novos: Olho de lince (24 s na tela), Pé de coelho e Dia de sorte
  (frequência), Gemaplys (2× mais, metade do tempo).
- O Hype de lançamento (`dourado_duracao`) dobra também o LinkedIn e o Combo. O Investidor anjo continua só no
  Investidor.
- "Produção" nos pagamentos na hora = `idle_rate` (a mesma base do Investidor apressado, sem os bônus de tempo).

### Os quatro novos

| Tipo | Na tela | Depois do clique | Efeito (no banco) |
|---|---|---|---|
| 4 Trend do TikTok | Ícone de nota musical | Chovem moedinhas na cena por 8 s (umas 25 caem; dá pra pegar ~15); cada clique numa é uma | Cada moedinha = 1 min de produção. A página manda o total no fim; o banco aceita 0 a 20 |
| 5 Bombou no LinkedIn | Ícone de maleta azul | Sobe a frase do post de coach | Um dos 5 geradores que mais produzem (sorteado pela semente) rende ×30 por 1 min |
| 6 Pix errado | Ícone de losango verde | Abre a escolha "Ficar" / "Devolver" (sem tempo: a escolha é o clique) | Ficar: 30 min de produção. Devolver: um dourado garantido que rende o dobro, em 20 a 120 s |
| 7 Tigrinho | Ícone do tigre | Um rolo gira 1,5 s e para no resultado | As 3 primeiras jogadas do dia sempre pagam 1 h de produção. Depois: 30% paga 1 h; 70% come 30 min de produção do F$ (nunca abaixo de zero) |

**Trend.** Como os gols do Jogo do Brasil: a página conta e manda `p_moedas` no fim; o banco faz `least(20,
greatest(0, p_moedas))`. A janela que o banco aceita pro Trend é a da tela + 8 s da chuva + 3 s de folga. Conta
`trend_max` (o maior número num Trend só) pra conquista.

**LinkedIn.** A conta da produção por gerador sai de `idle_rate_at` pra uma função `idle_gen_rendas(s, t)` (id e
quanto rende), e `idle_rate_at` passa a somar dela (mesmo resultado; teste de paridade). Ao pegar: pega os até 5
geradores com mais renda (>0), sorteia um pela semente do segundo, calcula `f` = a parte dele na soma e grava
`linkedin_ate = now() + 1 min × Hype`, `linkedin_gen` e `linkedin_mult = 1 + 29·f`. Na conta fechada (`idle_settle`) e
em `economia.ts produzido`, `linkedin_mult` multiplica tudo até `linkedin_ate` (é o mesmo que ×30 naquele gerador,
congelado no clique). Pegar outro com um valendo: o novo substitui o antigo. Frases que sobem (uma por sorteio):
"O Estagiário me ensinou mais sobre liderança do que meu MBA", "Fui demitido. Melhor coisa que me aconteceu.
#gratidão", "Acordo às 4h. Meu concorrente ainda está dormindo", "Recusei uma oferta do Google pra seguir meu
propósito". Selo "<nome do gerador> ×30 · 0:42".

**Pix errado.** `idle_dourado_pegar` ganha a escolha em `p_lado` (0 = ficar, 1 = devolver; hoje `p_lado` só serve à
dupla). Devolver grava um dourado garantido em `garantidos` (abaixo) no segundo `S + 20 + h % 101`, com o tipo sorteado
pela roda sem Tigrinho e sem Pix (sobrando 6 ou 7 → 0) e `dobro = true`. Conta `pix_dev`. Texto: "Devolveu! Deus te
pague (em até 2 min)" / "+F$ 1,2 mi (ninguém viu)".

**O dobro** (do Pix devolvido): Investidor paga 2×; Promoção, Viralizou, dupla e LinkedIn duram 2×; no Trend cada
moedinha vale 2 min. Junta com o Hype (Viralizou garantido com Hype = 4 min).

**Tigrinho.** Colunas `tigre_dia date` e `tigre_n int` (jogadas do dia, zeram na virada como `opp_day`). Sorte da
jogada: `mod(mistura(h3 + 4242), 100) < 30` (paga). Ganhou: +1 h de produção; perdeu: `valuation −= least(valuation,
idle_rate × 1800)`. Contadores `tigre_perdeu` (total) e `tigre_seq` (vitórias seguidas depois das 3 grátis; zera na
derrota). Clicar é opcional; o tigre se reconhece de longe. Textos: "Pagou! +F$ 2 mi" / "O tigre comeu F$ 980 mil. Só
mais uma?". Na caixinha de informação: "Jogadas grátis hoje: 2 de 3" ou "A casa paga 3 em cada 10".

### Combo

- Pegar 3 dourados seguidos, sem nenhum sumir no meio, dá **Combo ×7 por 1 min** (× Hype). Selo "Combo ×7 · 0:51".
- Colunas `combo_n int` e `combo_seg bigint` (o segundo do último pego). Ao pegar o dourado do segundo `S`: se
  `combo_seg` é nulo ou de mais de 30 min atrás, zera; senão o banco olha os segundos entre `combo_seg` e `S` e, se
  algum tinha dourado (a mesma conta de `idle_dourado` com o peso do estado + a faixa do MC V.V) que não seja Tigrinho,
  zera. Depois soma 1. Chegou a 3: `combo_ate = greatest(combo_ate, now()) + 1 min × Hype`, `combo_n = 0`, conta
  `combos`.
- Ignorar o Tigrinho não quebra (e jogar nele conta como pego). Os garantidos contam quando pegos, mas perder um não
  quebra. Fechar o jogo quebra: os dourados que passaram com ele fechado contam como perdidos.
- O ×7 multiplica tudo (como a Marmita): fator e ponto de corte a mais em `idle_settle` e `economia.ts produzido`.
- Na página: três bolinhas ao lado dos selos mostram o combo em andamento (●●○), com caixinha de informação ("Pegue mais
  1 sem deixar nenhum sumir: produção ×7 por 1 min").

### Dourados garantidos

- Coluna `garantidos jsonb` (lista de `{seg, tipo, dobro}`), lida pela página no `idle_json`. Saem da lista quando
  pegos ou quando a janela passa (limpeza no `idle_save`).
- `idle_dourado_pegar` aceita o segundo se ele está em `garantidos` (aí o tipo e o dobro vêm de lá), além da sorte e da
  faixa de hoje. Mesma janela na tela e mesma folga.
- `douradosEntre`/`eventoEm` na página juntam os garantidos pra agendar e desenhar.

### Banco

- `idle_dourado_pegar(p_seg bigint, p_lado int, p_moedas int default 0)`: substitui a de 2 argumentos (`drop` da antiga
  pra não ficar ambíguo no PostgREST). Feita a partir da 0061: trava, settle, confere a janela, `idle_dourados_pegos`
  (paga uma vez), aplica o efeito, combo, contadores, `idle_ganhar`, `idle_save`.
- `idle_dourado_chamar()` (abaixo, na caixinha).
- Contadores numa coluna `dourados_cont jsonb` (`trend_max`, `pix_dev`, `tigre_perdeu`, `tigre_seq`, `combos`,
  `cupons`, `cashback`), que **não** zera na venda da startup.

## 2. Caixinha

### A roda

`idle_opp_kind(u, w)` (`tipo` em `oportunidades.ts`) passa de `% 3` pra `% 100` com a tabela abaixo, só pras janelas a
partir de uma **janela de corte** fixa (`OPP_CORTE`, a janela do dia do deploy, a mesma constante no TS e no SQL). As
de antes continuam `% 3`, pra nada que já está na caixinha de alguém trocar de tipo.

| Tipo | Oportunidade | Hoje | Novo | Faixa |
|---|---|---|---|---|
| 0 | 15 min de produção na hora | 33 | 18 | 0–17 |
| 1 | Produção ×5 por 1 min | 33 | 16 | 18–33 |
| 2 | Próxima compra pela metade | 33 | 16 | 34–49 |
| 3 | Chamar um dourado | — | 10 | 50–59 |
| 4 | Cupom de primeira compra | — | 12 | 60–71 |
| 5 | Adubo de farmácia | — | 9 | 72–80 |
| 6 | Cashback | — | 10 | 81–90 |
| 7 | Informação privilegiada | — | 9 | 91–99 |

`TEXTO_TIPO` ganha os 5. Cada tipo novo ganha desenho em `assets/oportunidades/oportunidade-3.png` … `-7.png`.

### Os cinco novos

O "rendem o dobro" (Xepa da feira, `v_n = 2`) vale pra todos, como já vale pro ×5 e pra meia.

| Tipo | Efeito | Com a Xepa |
|---|---|---|
| 3 Chamar um dourado | Guarda 1 em `chamados int` (no máximo 3; o que passa se perde, e a caixinha avisa "Você já tem 3"). Um selo "Chamar dourado (2)" no topo, clicável: `idle_dourado_chamar()` gasta 1 e põe um garantido no segundo seguinte, sorteado pela roda sem Tigrinho e sem Pix, sem dobro | Guarda 2 |
| 4 Cupom de primeira compra | `cupons += 10`. Cada compra de gerador (1, 10 ou Máx) sai 25% mais barata e gasta 1. Com a Promoção ligada o cupom fica guardado (igual à meia-preço: o desconto de compra nunca passa de 50%). O Máx calcula com o cupom. Selo "Cupom · 7 restantes". Conta `cupons` (pegos) | +20 |
| 5 Adubo de farmácia | As plantas da Horta que ainda não estão maduras e estão mais perto de ficar amadurecem na hora (`amadurece_s` = o tempo que já passou). Fecha a conta antes (a horta muda a produção) | 2 plantas |
| 6 Cashback | `cashback_ate = greatest(cashback_ate, now()) + 2 min`. Toda compra (gerador ou melhoria) devolve 30% do preço na hora, depois dos descontos. Por ser devolução, passa do teto: com a Promoção, paga 35%. Selo "Cashback 30% · 1:40". Conta `cashback` (F$ devolvido, somado) | 4 min |
| 7 Informação privilegiada | `info_creditos += 1`. Na Bolsa, cada empresa ganha "Espiar" enquanto tiver crédito: `idle_bolsa_espiar(p_empresa)` gasta 1 e mostra o humor dela ("sobe forte", "despenca"…) e em quantos minutos ele muda, até o humor virar. Guarda em `espiadas jsonb` (`{empresa: {ate_tick, em}}`) | 2 créditos |

- **Quem ainda não tem**: o Adubo de quem não tem Horta (`generators[11] = 0`) ou não tem planta crescendo, e a
  Informação de quem não tem Bolsa (`generators[19] = 0`), pagam 15 min de produção (o tipo 0) no lugar. A caixinha
  já mostra assim ("Adubo de farmácia → sem planta crescendo: 15 min de produção"). Quem decide é a hora do clique.
- `idle_claim_opportunity` é redefinida a partir da 0063 com os 5 casos novos (e `idle_opp_kind` com o corte).
- O humor espiado aparece também com o VSauce sentado (que já mostra o humor, sem o "muda em"); espiar com ele sentado
  acrescenta o "muda em X min".

### Compras (`idle_buy`, a partir da 0074)

- Gerador: com `cupons > 0` e sem Promoção, `v_cmg × 0,75` (no preço e no Máx) e `cupons − 1`.
- Depois do preço final (gerador ou melhoria), com `cashback_ate > now() − 1 s`: `valuation += 0,3 × preço` e soma em
  `dourados_cont.cashback`.
- Na página, `tela.ts` usa os mesmos fatores (preço com cupom; a linha "volta F$ X" do cashback na caixinha de
  informação do botão de comprar) e re-renderiza quando o cupom acaba e quando o cashback liga e desliga.

## 3. Colunas novas em `idle_state`

`linkedin_ate timestamptz`, `linkedin_gen int`, `linkedin_mult double precision`, `combo_ate timestamptz`,
`combo_n int`, `combo_seg bigint`, `garantidos jsonb`, `tigre_dia date`, `tigre_n int`, `chamados int`, `cupons int`,
`cashback_ate timestamptz`, `info_creditos int`, `espiadas jsonb`, `dourados_cont jsonb`.

- Entram em `idle_save`, `idle_json` e `IdleState`.
- A venda da startup (`idle_prestige`) zera tudo menos `dourados_cont` e o Tigrinho do dia (`tigre_dia`/`tigre_n`, pra
  vender não dar 3 jogadas grátis de novo).

## 4. Selos e caixinha de informação

- Selos novos ao lado do F$, como os de hoje: LinkedIn, Combo (e as bolinhas), Cupom, Cashback, Chamar dourado.
- Caixinha (mouse no PC, foco no teclado; no celular não tem), dizendo o que vale **agora** em números da pessoa:
  - em cada dourado novo na tela (Trend: "Até 20 min de produção: F$ X por moedinha"; LinkedIn: "<gerador> ×30 por
    1 min: produção +N%"; Pix: "Ficar: F$ X agora · Devolver: um dourado em dobro"; Tigrinho: jogadas grátis ou a
    chance, e quanto ganha/perde em F$);
  - em cada selo novo (o que vale e quanto falta);
  - nas oportunidades novas da caixinha (o efeito com a Xepa, ou o "no lugar" de quem não tem Horta/Bolsa);
  - no "Espiar" da Bolsa ("Mostra o humor de <empresa> até ele mudar · 1 crédito").
- Não entra no texto que sobe ao pegar (ele já diz tudo).

## 5. Arte e som

- Ícones de dourado em pixel 12×12, inline como os de hoje (`douradoTela.ts icone`): nota musical, maleta azul,
  losango verde (sem o logo do Pix), cabeça de tigre. A moedinha do Trend reusa a moeda do jogo. O rolo do Tigrinho e a
  escolha do Pix são HTML/CSS na fonte do jogo, no estilo da cena.
- Desenhos das oportunidades 3–7 no estilo das 0–2 (`assets/oportunidades/`).
- Sons sintetizados em `audio/efeitos.ts` (sem arquivo), afinados em Fá como os outros: `trend` (moedinha curta, uma
  por clique), `linkedin` (plim de notificação), `pix` (caixa registradora), `tigreGira` / `tigrePaga` / `tigreCome`,
  `combo` (fanfarra curta, momento grande). Cupom, Cashback e Chamar usam o `pegar` de hoje. O Juan julga na página de
  audição.
- `?mock`: o painel ganha os 4 dourados, o combo e os 5 tipos de oportunidade pra forçar.

## 6. Conquistas

Textos em `nomes.ts`, catálogo gerado (migração nova). Cada uma vale +1% de produção. Ícones próprios em
`assets/conquistas/conquista-132.png` … `-139.png`.

| id | Nome | Condição | Frase | Tipo |
|---|---|---|---|---|
| 132 | Dancinha do TikTok | Pegar as 20 moedinhas de um Trend | Vinte moedas em oito segundos. Seu polegar tem mais seguidor que você. | evento `trend_max`, 20 |
| 133 | Cidadão de bem | Devolver 10 Pix errados | Devolveu dez Pix. O banco nunca te devolveu nada. | evento `pix_dev`, 10 |
| 134 | Só mais uma | Perder 10 vezes no Tigrinho | Dez derrotas. Amanhã você recupera, com certeza. | evento `tigre_perdeu`, 10 |
| 135 | C-C-C-Combo! | Fazer 10 Combos | Dez combos seguidos. O narrador ficou rouco. | evento `combos`, 10 |
| 136 | Primeira compra (de novo) | Pegar 25 Cupons de primeira compra | Vinte e cinco primeiras compras, todas no mesmo CPF. | evento `cupons`, 25 |
| 137 | Volta pra conta | Receber F$ 1 tri de cashback | Um trilhão de volta. O que você gastou pra isso, melhor nem somar. | evento `cashback`, 1e12 |
| 138 | O tigre tá pagando | Ganhar 3 seguidas no Tigrinho depois das 3 grátis | Ele deixou você ganhar. É assim que começa. | escondida, evento `tigre_seq`, 3 |
| 139 | Insider (shh) | Vender com 100% de lucro uma ação de empresa espiada nas últimas 2 h | A CVM quer saber a sua localização. | escondida, evento `insider`, 1 |

- As de evento saem de `idle_ganhar` com o contador: no `idle_dourado_pegar` (132–135, 138), no
  `idle_claim_opportunity` (136), no `idle_buy` (137) e na venda da Bolsa (`idle_bolsa_negociar_em`, 139: lucro ≥ 100%
  e a empresa em `espiadas` com `em` de até 2 h atrás).
- Visíveis ficam na grade antes das escondidas.

## 7. Patch notes

Entrada nova no começo de `novidades.ts`, no tom do jogo: os 4 dourados novos e o Combo, os 5 tipos da caixinha e as
conquistas visíveis. Sem as escondidas.

## Migrações

- `0075_fellas_inc_catalogo_dourados.sql`: catálogo gerado (conquistas 132–139) com `ATUALIZAR_CATALOGO`.
- `0076_fellas_inc_dourados_caixinha.sql`: colunas novas, `idle_gen_rendas`, `idle_dourado_chamar`,
  `idle_bolsa_espiar`, e as redefinições de `idle_dourado_tipo`, `idle_conv_faixa`, `idle_dourado_pegar`,
  `idle_opp_kind`, `idle_claim_opportunity`, `idle_rate_at`, `idle_settle`, `idle_buy`, `idle_save`, `idle_json`,
  `idle_prestige`, `idle_bolsa_estado` e `idle_bolsa_negociar_em`. Cada uma a partir da definição mais recente.
- As duas entram em `games/test/db.ts` e `games/dev/mockDb.ts`. Conferir antes do push se nenhuma outra sessão pegou
  esses números (inclusive o worktree `fellasapp-mapa`).

## Testes

- Paridade TS × banco: a roda nova dos dourados (as 8 faixas), a faixa do MC V.V sem Tigrinho, a roda da caixinha com o
  corte (antes `% 3`, depois `% 100`), o sorteio do LinkedIn (qual gerador e o `f`), o segundo e o tipo do garantido do
  Pix, a sorte do Tigrinho, `idle_gen_rendas` somando igual ao `idle_rate_at` de antes, e o fechamento da conta com
  LinkedIn e Combo (sozinhos e com ×5, Viralizou e Marmita).
- Banco: cada dourado paga uma vez; Trend com 25 moedinhas vira 20; Pix ficar × devolver; garantido aparece, paga em
  dobro e some depois da janela; Tigrinho grátis 3 vezes, depois a sorte, perda nunca deixa F$ negativo, vender não dá
  jogadas grátis; Combo monta com 3, quebra com um perdido, não quebra com Tigrinho ignorado; cupom gasta 1 por compra,
  fica guardado com Promoção, Máx usa o desconto; cashback devolve 30% (e passa do teto com Promoção); Adubo amadurece a
  mais perto, e sem Horta/planta paga 15 min; Informação sem Bolsa paga 15 min; espiar gasta crédito e devolve humor +
  "muda em"; Chamar respeita o máximo de 3; contadores não zeram na venda, o resto zera; as 8 conquistas.
- Simulação: o ganho médio por dourado e por oportunidade não pode subir mais que 15% sobre o de hoje, e os ritmos que já
  valem (era 5 no dia 4–5, gerador 30 fora da 1ª semana, ~17 pontos na 1ª semana) continuam passando. Ajustar os números
  (Pix ficar, Tigrinho, ×30 do LinkedIn) até passar. A simulação da Bolsa confere que os 100% da "Insider (shh)" são
  raros mas possíveis numa janela de 2 h.
- Tela: os ícones novos, a chuva do Trend contando cliques, a escolha do Pix, o rolo do Tigrinho, as bolinhas do combo,
  os selos novos e o "Chamar", o "Espiar" na Bolsa, e as caixinhas de informação.
- `npx tsc --noEmit` e `npm test` passando; jogos com `--maxWorkers=4`. Conferir em 1280×720, 2000×961 e no celular
  (iframe de 390 px), com o som todo mutado.
