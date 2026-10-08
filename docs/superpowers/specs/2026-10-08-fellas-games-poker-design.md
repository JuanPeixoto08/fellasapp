# Fellas Games: Poker (Texas Hold'em ao vivo) — design

Data: 2026-10-08 · Status: aprovado em conversa (mockups em `.superpowers/brainstorm/20068-1791484731/content/`,
fora do git; regras de mesa revisadas por um agente no papel de gerente de sala de poker)

## Objetivo

O **projeto 2** do Fellas Games: uma mesa de **No-Limit Texas Hold'em ao vivo** para o grupo, usando a
economia de créditos do projeto 1 (`docs/superpowers/specs/2026-10-08-fellas-games-blackjack-design.md`).
Junto vêm os dois pendentes da revisão do projeto 1: **M1** (semana virando na aposta esconde a mão aberta) e
**M2** (reset não trava as carteiras).

**Sucesso:** alguém manda "bora um poker?", os fellas abrem a aba Games, veem "2 na mesa", tocam em Jogar,
sentam com 200 a 500 créditos e jogam mãos de verdade juntos no celular ou no PC, com relógio de 30 s, potes
paralelos e showdown animado. Quem some não trava a mesa. O placar da semana conta carteira + fichas na mesa,
e o reset de segunda acerta tudo sem perder ou criar crédito.

### O que o Juan decidiu
- **Ao vivo:** todos jogando ao mesmo tempo; 30 s por jogada.
- **Uma mesa só**, sempre aberta, **6 lugares** ("a mesa dos fellas"). Mão começa com 2+ prontos.
- **Entrada 200 a 500** (de 10 em 10): sai da carteira e vira fichas na mesa; o resto da carteira fica livre
  (Blackjack continua). Levantar devolve as fichas à carteira. **Cegas 5/10**, No-Limit.
- **Completar** entre mãos, até 500 na mesa.
- **Relógio:** estourou → mesa se pode, senão corre. Estourou em **2 mãos seguidas** → **ausente** (sentado,
  sem receber cartas, sem pagar cegas; volta com "Voltar pra mesa"). Ausente há **10 min** → levantado,
  fichas para a carteira.
- **Tudo no banco** (funções SQL, como no Blackjack), estado público da mesa pelo **Supabase Realtime**.
- **Visual:** mesa **em pé vista de cima** no celular (mockup A), deitada no PC; mesmo feltro 3D, cartas,
  fichas e botões moeda do Blackjack.
- **Regras de mesa do parecer do gerente de sala** (todas aceitas): esperar a cega grande para entrar ou voltar;
  anti-rathole de 30 min; levantar no meio da mão = sai ao fim da mão; nenhuma mão nova depois de domingo 23:55;
  número de sequência nas jogadas; todo mundo mostra no showdown; histórico das últimas 20 mãos; botão
  "Mostrar" opcional.

### Fora do escopo (v1)
Mais de uma mesa; pré-jogadas ("Mesa/Corro", "Pago qualquer"); run it twice; chat ou emoji na mesa; som;
notificação push de "sua vez" com o app fechado; convite/aviso "fulano sentou"; torneio; limites diferentes de
cegas; estatísticas por jogador.

## 1. Regras do jogo

### Quem recebe cartas
- **Pronto** = sentado, `status = 'playing'`, fichas > 0, sem `wait_bb`, sem `leaving`.
- Sentou ou voltou do ausente → `wait_bb = true`: entra quando a cega grande cair no lugar dele.
  **Exceção (mesa parada):** se no começo da mão houver menos de 2 prontos, todos os `wait_bb` viram prontos.
- Fichas 0 no fim da mão: não recebe cartas; tem até o começo da mão seguinte para completar; senão é
  levantado (sem fichas, nada volta).
- **Mesa fechada para o reset:** nenhuma mão começa entre **domingo 23:55** e a virada da semana
  (`poker_closed(ts)`: dia da semana domingo e hora ≥ 23:55 em `America/Sao_Paulo`). Mão já em andamento segue.

### Botão e cegas (botão móvel simplificado)
- A **cega grande avança** sempre para o próximo lugar elegível depois da última cega grande
  (`poker_tables.last_bb_seat`), contando prontos e `wait_bb` (quem está esperando e cai na cega grande vira
  pronto e paga). Assim ninguém paga a cega grande duas vezes seguidas e ninguém pula a sua.
- **Cega pequena** = pronto anterior à cega grande; **botão** = pronto anterior à cega pequena.
  Quem está em `wait_bb` entre o botão e a cega grande não recebe cartas nessa mão.
- **Heads-up (2 recebendo cartas):** botão = cega pequena; ele fala primeiro antes do flop e por último depois.
- Cega maior que as fichas: paga o que tem e fica all-in.

### Apostas
- Antes do flop começa o primeiro à esquerda da cega grande; do flop em diante, o primeiro à esquerda do
  botão (ainda na mão e não all-in).
- **Correr** (fold) sempre; **Mesa** (check) só sem nada a pagar; **Pagar** (call) = completa a aposta da
  rodada ou o que tem (all-in).
- **Aumentar para X:** X múltiplo de 5; X ≥ aposta atual + último aumento completo (primeira aposta da
  rodada ≥ 10); X ≤ fichas + o que já pôs na rodada. X igual a tudo = all-in.
- **All-in curto** (aumento menor que um aumento completo) não reabre a ação para quem já agiu e igualou a
  aposta anterior: esses só pagam ou correm. Quem ainda não agiu pode aumentar normalmente.
- Rodada fecha quando todos que podem agir agiram desde o último aumento completo e igualaram (ou estão
  all-in). **Aposta não paga volta** a quem apostou antes de montar os potes.
- Flop 3 cartas, turn 1, river 1 (sem queimar carta; o baralho já é embaralhado no servidor).

### Fim da mão
- **Todos correram menos um:** ele leva o pote, sem mostrar.
- **Showdown:** todos que chegaram ao fim mostram, automaticamente. Ganha a melhor combinação de 5 entre as 7.
  Ranking: carta alta < par < dois pares < trinca < sequência (A-2-3-4-5 é a menor; sem volta Q-K-A-2-3) <
  flush < full house < quadra < straight flush (royal é a maior straight flush).
- **Potes paralelos:** um por nível de contribuição (de quem chegou ao fim ou foi all-in); quem correu
  contribui mas não concorre. Cada pote é disputado só entre quem pôs até aquele nível. Distribuição do último
  paralelo para o principal.
- **Empate:** divide; a **ficha que sobra** vai para o primeiro vencedor à esquerda do botão, pote a pote.
- **Todos all-in (ou só 1 pode agir e já igualou):** o banco abre o resto da mesa e fecha a mão na hora; a
  tela vira todas as cartas e solta turn e river com ~1,5 s de pausa.
- **Mostrar:** quem correu ou ganhou sem showdown pode mostrar as 2 cartas até a próxima mão começar
  (`poker_show`).
- **Próxima mão:** `next_hand_at` = fim + **5 s** (fim com mesa revelada no all-in: + **8 s**).

### Relógio, ausência e saída
- `deadline` = início da vez + **30 s**. `poker_tick()` age se `now() > deadline`: mesa se pode, senão corre;
  incrementa `timeouts` do lugar (uma vez por mão). `timeouts` chega a **2** → `status = 'away'`, `away_since =
  now()`. Qualquer jogada própria zera `timeouts`.
- Ausente não recebe cartas nem paga cegas. `poker_back()` → `status = 'playing'`, `wait_bb = true`.
- Ausente há 10 min → levantado pelo `poker_tick()` (fichas para a carteira, como `poker_leave`).
- **Levantar no meio da mão:** marca `leaving = true`; quando a vez chega, corre; all-in fica até o fim. No fim
  da mão o lugar é liberado e as fichas voltam. Fora de mão: levanta na hora.
- **Anti-rathole:** ao levantar, grava `poker_leaves(user_id, stack, left_at)`. Sentar de novo em menos de
  30 min exige entrada ≥ `stack` de saída (pode passar de 500; nunca abaixo de 200).

### Sequência
`poker_tables.seq` sobe a cada mudança. `poker_act`, `poker_rebuy`, `poker_show` recebem o `seq` que a tela
viu; diferente do atual → `stale_seq` ("A mesa mudou"). `poker_tick` não recebe seq (age só por prazo). Toda
função trava a linha de `poker_tables` (`for update`) antes de qualquer coisa.

## 2. Banco — migração `0030_poker.sql`

Padrão da casa (0027–0029): idempotente; RLS em tudo; `revoke all ... from anon`; nenhum insert/update/delete
para o app; funções `security definer`, `set search_path = public`, só membros (`not_member`, 42501), erros
`raise exception '<código>' using errcode = 'P0001'`; internas sem execute para `authenticated`.

### Tabelas
- **`poker_tables`** (uma linha, `id smallint = 1`): `small_blind 5`, `big_blind 10`, `min_buyin 200`,
  `max_buyin 500`, `seq bigint`, `hand_no int`, `last_bb_seat smallint`, `next_hand_at timestamptz`,
  `state jsonb` (retrato público, abaixo), `updated_at`. Select para membros; **na publicação
  `supabase_realtime`** (bloco `do` idempotente como na 0021).
- **`poker_seats`** (`table_id`, `seat 0..5`, pk dos dois; `user_id unique`, `stack int >= 0`,
  `status 'playing'|'away'`, `wait_bb bool`, `leaving bool`, `timeouts smallint`, `away_since`, `sat_at`).
  Select para membros (é público na mesa).
- **`poker_hands`** (`id uuid`, `table_id`, `hand_no`, `status 'betting'|'done'|'void'`,
  `street 'preflop'|'flop'|'turn'|'river'|'showdown'`, `button`, `sb_seat`, `bb_seat`, `board smallint[]`
  (só as abertas), `players jsonb` (por lugar: user_id, aposta na rodada, total na mão, correu, all-in,
  agiu), `current_bet`, `last_raise`, `to_act smallint`, `deadline`, `results jsonb` (potes, vencedores,
  mãos mostradas com nome da mão), `shown jsonb` (lugar → cartas, por showdown ou `poker_show`),
  `started_at`, `ended_at`). Select para membros (não tem carta escondida). Índice único de mão aberta por mesa.
- **`poker_secrets`** (`hand_id` pk, `deck smallint[]`, `holes jsonb` lugar → 2 cartas). RLS ligado, **sem
  política**. Apagado quando a mão acaba (o que precisa ficar público já está em `shown`).
- **`poker_leaves`** (`user_id` pk, `stack`, `left_at`). Sem acesso do app.
- **`game_ledger.reason`** ganha `'buyin'` e `'cashout'` (troca do check).

### Retrato público (`poker_tables.state`)
Refeito por `poker_snapshot()` no fim de toda função que muda a mesa (mesma transação):
`{ seq, server_now, closed, next_hand_at, blinds, buyin: [200, 500],
   seats: [{ seat, user_id, stack, status, wait_bb, leaving, in_hand, folded, all_in, bet, last_action }],
   hand: { id, no, street, board, pots, current_bet, min_raise_to, to_act, deadline, button, sb, bb,
           results, shown } | null }`.
Nunca contém carta de `poker_secrets` além do que está em `shown`. Cartas são 0–51 como no Blackjack.

### Funções para o app
| Função | Faz | Erros |
|---|---|---|
| `poker_state()` | devolve `state` (carga inicial e reconexão) | |
| `poker_sit(p_seat, p_buyin)` | trava carteira; confere lugar, entrada, anti-rathole; `games_move(-buyin,'buyin')`; senta com `wait_bb`; se a mesa estava parada, `poker_maybe_start()` | `seat_taken`, `already_seated`, `buyin_out_of_range`, `rathole_min`, `insufficient_credits` |
| `poker_act(p_seq, p_action, p_amount)` | `fold`/`check`/`call`/`raise`/`allin` na sua vez; avança rodada, abre cartas, fecha a mão | `stale_seq`, `not_your_turn`, `invalid_action`, `raise_too_small`, `raise_too_big`, `not_seated` |
| `poker_rebuy(p_seq, p_amount)` | entre mãos (ou sem estar na mão), mesa ≤ 500 | `rebuy_in_hand`, `rebuy_out_of_range`, `insufficient_credits` |
| `poker_leave()` | levanta agora ou marca `leaving` | `not_seated` |
| `poker_back()` | ausente → playing + `wait_bb` | `not_seated` |
| `poker_show(p_seq)` | mostra as suas 2 cartas da última mão (sem showdown) até a próxima começar | `nothing_to_show` |
| `poker_my_cards()` | suas 2 cartas na mão aberta (ou null) | |
| `poker_tick()` | relógio: vez vencida, próxima mão (`next_hand_at` vencido, mesa aberta, 2+ elegíveis), ausente de 10 min, sem fichas | |
| `poker_history()` | últimas 20 mãos `done`: no, vencedores, potes, board, `shown`, nomes das mãos | |
| `games_board()` | placar: membros com `last_played_at` não nulo, `balance + stack na mesa`, fiado, ordem do placar | |

Internas (sem execute para o app): `poker_shuffle()`, `poker_maybe_start()`, `poker_advance(hand)`,
`poker_finish(hand)`, `poker_pots(hand)`, `poker_rank(smallint[]) returns int[]` (melhor de 5 entre até 7;
array comparável: categoria, desempates), `poker_rank_name(int[])`, `poker_snapshot()`, `poker_closed(ts)`,
`poker_stand(seat)`.

`poker_tick()` também roda pelo **pg_cron a cada minuto** (`fellas-poker-tick`, `* * * * *`); sem mesa ativa
não faz nada. O app chama `poker_tick()` quando o relógio local (com a diferença para `server_now`) passa de
`deadline` ou `next_hand_at` + 1 s.

### Créditos e semana (0027 ajustada pela 0030)
- **Fiado:** `games_fiado` recusa quem está sentado (`fiado_seated`); `games_wallet_json.can_fiado` também
  exige não estar sentado; a carteira ganha `seated_stack` (fichas na mesa ou null).
- **`last_played_at`** é atualizado quando o fella recebe cartas numa mão.
- **Placar:** `games_board()` soma as fichas da mesa; app e jogos passam a usá-la.
- **Reset (M2):** `games_weekly_reset` passa a: (1) travar a linha de `poker_tables` e depois **todas as
  carteiras** `for update` (ordem fixa das travas em todo lugar: mesa → carteiras → rodadas); (2)
  `games_close_open_rounds()`, que agora também **anula a mão de poker aberta** (`status 'void'`, cada um
  recebe de volta o total que pôs na mão) e **levanta todo mundo** (cashout para a carteira, sem anti-rathole)
  e fecha o Blackjack aberto; (3) pódio, selo e 1.000 como hoje. Aposta à meia-noite fica inteira numa semana.
- **Ordem das travas:** funções de poker travam `poker_tables` antes de qualquer carteira; Blackjack só trava
  carteira → rodada; o reset segue mesa → carteiras → rodadas. Sem ciclo, sem deadlock.

## 3. Projeto `games/`

```
games/
  poker/
    index.html, main.ts   tela: liga machine, view, mesa 3D, api e o canal de tempo real
    machine.ts            estados: carregando → olhando (sem lugar) → sentado (esperando / na mão / sua vez /
                          showdown / ausente) ; erros e avisos
    rules.ts              o que a tela pode oferecer: pode mesa/pagar quanto, mínimo e máximo do aumento,
                          atalhos ½ pote e pote (quem decide é o banco)
    hands.ts              avaliador de mãos (rótulo "Par de K" na tela) — mesmo resultado que poker_rank
    view.ts               HUD: lugares (foto, nome, fichas, ação, anel do relógio), régua do aumento, folha de
                          sentar, histórico, avisos
  shared/
    table3d/              + layout de 6 lugares (em pé e deitado, com o meu lugar sempre embaixo), cartas da
                          mesa, cartas viradas dos outros, fichas por lugar, botão do dealer, pote indo para o
                          vencedor
    hud/                  + estilos de lugar, anel do relógio, régua, folha (sheet)
    api.ts                + poker_*; games_board no placar
    realtime.ts           canal Supabase na linha de poker_tables; reconecta e recarrega poker_state()
  test/
    poker.test.ts         regras no banco (baralho armado)
    pokerSim.test.ts      200 mãos aleatórias, conservação de fichas
    hands.test.ts         casos de mão contra poker_rank (SQL) e hands.ts (TS)
    fixtures/hands.json   ~60 casos
  dev/
    mockApi.ts            + poker com bots no PGlite (?mock); troca de jogador (?as=2)
    frames.html           + duas telas de jogadores diferentes lado a lado
```

- Vite ganha a página `poker/index.html` (multi-página, como o Blackjack). `deploy-web.yml` não muda.
- **Layout:** celular em pé = mesa oval em pé, 5 outros em volta, eu embaixo com as 2 cartas grandes e o
  rótulo da mão, painel com os botões. Deitado/PC (≥ 700 e paisagem) = mesa deitada, painel à direita com
  abas **Mãos | Placar**, "Você na mesa" à esquerda, atalhos **1 Correr · 2 Mesa/Pagar · 3 Aumentar · 4 All-in**.
- **Botões moeda:** Correr (vermelho ✕), Mesa ou Pagar X (verde), Aumentar (violeta; abre a régua: Mín,
  ½ pote, Pote, − / + de 10, "Aumentar p/ X"), All-in (laranja). Fora da vez: "Vez do Igor · 18 s".
- **No alto:** ← Voltar, título com as cegas, Levantar, Completar (entre mãos), pílula da carteira, Histórico
  (celular).
- **Folha de sentar:** régua de 200 até min(500, carteira) (ou a partir do mínimo do anti-rathole),
  "Sentar com X", "Agora não". Carteira < mínimo: diz quanto falta e lembra do fiado (só quando liberado).
- **Fotos:** perfis dos sentados lidos de `profiles` (membros leem perfis).
- **Vibrar** (`navigator.vibrate`, onde existir) quando a vez chega em mim.
- **Showdown:** cartas viram, plaquinha com o nome da mão em cada lugar, fichas do pote voam para quem ganhou;
  plaquinha dourada para mim quando ganho ("Você levou 240").
- **Tempo real:** um canal `postgres_changes` em `poker_tables` (id = 1); o payload já é o `state`. Ao abrir,
  ao reconectar e ao voltar para a aba: `poker_state()` + `poker_my_cards()`. `poker_my_cards()` também quando
  `hand.id` muda.
- **Relógio na tela** com a diferença para `server_now`.

### M1 (Blackjack)
`blackjack/machine.ts`: quando a semana virou (`turned`) e o banco devolve uma mão `playing`, a tela mostra a
mão (fase `playing`) com o aviso da semana, em vez de zerar a rodada.

## 4. App (Expo)
- **Card do Poker** (`components/games/GameRows.tsx`): sai "Em breve"; "Texas Hold'em · 2 a 6 fellas ·
  entrada 200 a 500"; "N na mesa" (de `poker_tables.state`, atualizado pelo tempo real com debounce); botão
  **Jogar** ou **Voltar pra mesa** quando estou sentado; abre `/games/poker/`.
- **Placar:** `lib/api/games.ts` `getLeaderboard()` passa a chamar `games_board()`.
- **Carteira:** com `seated_stack`, a linha mostra "+ X na mesa de poker"; fiado bloqueado com a nota
  "Levanta da mesa de poker pra pegar fiado".
- **`lib/realtime.ts`:** `poker_tables` em `LIVE_TABLES`; `affectsNotifications` ignora.
- Tokens de `lib/theme.ts` e `components/ui`; Impeccable; `DESIGN.md` ganha a mesa de poker.

## 5. Estados e erros (mesa)
- **Sem sessão / sem WebGL:** iguais ao Blackjack.
- **Olhando (sem lugar):** lugares vazios "+ Sentar"; mesa cheia: "Mesa cheia (6/6). Fica de olho que já
  libera."
- **Esperando jogadores:** "Esperando mais 1 fella pra começar".
- **Esperando a cega grande:** "Você entra quando a cega grande chegar em você".
- **Ausente:** faixa "Você ficou ausente: as mãos seguem sem você." + **Voltar pra mesa** / **Levantar (X
  voltam pra carteira)**.
- **Levantando:** "Você sai no fim dessa mão".
- **Sem fichas:** "Acabaram suas fichas. Completa até a próxima mão ou você levanta."
- **Fechada:** "A mesa fecha pro reset. Volta 00:00." · **Semana virou:** "A semana virou! Todo mundo foi
  levantado e as fichas voltaram pra carteira."
- **Sem rede:** "Reconectando…" (botões travados); ao voltar, recarrega.
- **Erros:** `stale_seq` = "A mesa mudou" (recarrega); `seat_taken` = "Alguém sentou aí primeiro";
  `buyin_out_of_range` = "Entrada vai de 200 a 500"; `rathole_min` = "Você saiu com X há pouco: volta com
  pelo menos X"; `insufficient_credits` = "Carteira não cobre"; `raise_too_small` = "Aumento mínimo é X";
  `not_your_turn` = "Ainda não é sua vez"; `rebuy_in_hand` = "Completa quando a mão acabar";
  `fiado_seated` = "Levanta da mesa de poker pra pegar fiado".
- Acessibilidade: botões com rótulo ("Correr", "Pagar 40"); vez e resultado em `aria-live`; alvos ≥ 44;
  reduzir movimento = sem voo de cartas e fichas.

## 6. Testes
- **`games/test` (vitest + PGlite, 0027–0030):**
  - Mesa: sentar/levantar, entrada 200–500 e de 10 em 10, carteira insuficiente, lugar ocupado, já sentado,
    anti-rathole (antes e depois de 30 min), completar só entre mãos e até 500, fichas 0.
  - Cegas: cega grande avançando com gente entrando e saindo, ninguém paga cega grande 2× seguidas, `wait_bb`,
    mesa parada, heads-up (botão = cega pequena, ordem pré e pós-flop), cega maior que as fichas.
  - Apostas: mesa/pagar/aumentar, aumento mínimo, valor fora de 5, all-in curto não reabre, aposta não paga
    devolvida, rodada fechando certo, fora da vez, `stale_seq`.
  - Fim: todos correm, showdown, 3 all-ins diferentes (potes paralelos), empate com ficha sobrando, all-in com
    mesa revelada, `shown` só com quem chegou ao fim, `poker_show`.
  - Relógio: nada antes do prazo; mesa/corre automático; ausente na 2ª mão; ausente 10 min levantado;
    `leaving` corre na vez e all-in fica; `poker_closed` (domingo 23:54 / 23:55 / segunda 00:00).
  - Segurança: `poker_secrets` e `poker_leaves` ilegíveis; `poker_my_cards` só as minhas; insert/update direto
    negado; não membro barrado; internas sem execute.
  - Semana: reset anula a mão e devolve, levanta todo mundo, pódio com fichas da mesa, segunda chamada não faz
    nada; fiado bloqueado sentado; `games_board` soma a mesa.
  - Tempo nos testes: prazos movidos para o passado com update direto (superusuário); `poker_closed` testada com
    o argumento.
- **`hands.test.ts`:** ~60 casos (todas as categorias, desempates por kicker, A-2-3-4-5, flush vs sequência,
  dois pares com kicker, full house entre trincas, mão melhor no board) contra `poker_rank` e `hands.ts`.
- **`pokerSim.test.ts`:** 6 jogadores, 200 mãos com ações válidas aleatórias (semente fixa), entradas,
  saídas e relógio; a cada passo: carteiras + fichas + potes = constante; ninguém negativo; ledger bate.
- **Tela:** `poker/machine` e `poker/rules` (vitest), `poker/view` (happy-dom); M1 no `blackjack/machine`.
- **App (jest):** card do Poker (N na mesa, Jogar/Voltar pra mesa), placar via `games_board`, nota de fiado
  sentado, `affectsNotifications` ignora `poker_tables`, teste de texto da 0030.
- **Manual:** `?mock` com bots e `frames.html` com dois jogadores; depois Juan + 1 fella em dois celulares
  (all-in, relógio estourando, ausente, levantar no meio).

## 7. Como sobe
1. **Banco:** branch pronta e testada; o Juan confere `supabase migration list` e roda o `db push` só da
   0030. Conferência: `poker_tables` responde com `state`, `poker_secrets` não devolve nada, `poker_state()` e
   `games_board()` respondem, `poker_tables` está em `supabase_realtime`, job `fellas-poker-tick` ativo.
2. **Push:** merge na main e push (jogo + app + DESIGN.md).
3. **Teste real** com dois celulares.

**Clientes antigos:** PWA/APK em cache mostram Poker "Em breve" e o placar sem as fichas da mesa até
atualizar (`AppUpdater`); nada quebra. A 0030 não muda a forma de `game_wallets`.

## Riscos a conferir na implementação
- **Realtime com RLS:** confirmar que o `postgres_changes` entrega a linha de `poker_tables` para membros e
  que o payload com `state` cabe (alguns KB).
- **Corrida no relógio:** vários celulares chamando `poker_tick()` juntos — a trava da mesa serializa; só o
  primeiro age.
- **Desempenho do `poker_rank` em PL/pgSQL:** 21 combinações × até 6 jogadores por showdown; medir no PGlite.
- **Câmera de cima no celular fraco:** mesmos cuidados do Blackjack (pixel ratio ≤ 2, cena parada sem desenhar).
