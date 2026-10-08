# Fellas Games: créditos semanais + Blackjack — design

Data: 2026-10-08 · Status: aprovado em conversa (mockups do companheiro visual em
`.superpowers/brainstorm/2028-1791463603/content/`, fora do git; arquitetura vinda do conselho web do mesmo dia)

## Objetivo

Jogos de cartas com créditos de mentira para o grupo apostar e zoar no placar. Este é o **projeto 1**: a
economia de créditos (saldo, fiado, placar semanal, reset, troféu do campeão) e o **Blackjack**. O **Poker**
(Texas Hold'em, mínimo 2 na mesa) é o projeto 2 e reaproveita tudo daqui.

**Sucesso:** na 5ª aba (Games) o fella vê o saldo, o placar da semana e o campeão anterior; toca em Jogar,
abre a mesa 3D, aposta com fichas, joga a mão contra a banca e volta com o saldo atualizado no placar. Toda
segunda à meia-noite (Brasília) o campeão ganha o troféu e todo mundo volta para 1.000. Funciona no celular
(PWA, APK) e no PC.

### O que o Juan decidiu
- **Créditos de mentira:** não se compram, não viram dinheiro, não se transferem entre fellas.
- **Reset:** 1.000 créditos para todo mundo, **segunda 00:00 de Brasília** (cron).
- **Placar:** só quem jogou pelo menos uma mão na semana. Ordem: saldo; empate → menos fiado; depois quem
  chegou primeiro.
- **Fiado:** com saldo 0 (e sem mão aberta), +100 **uma vez por dia** (dia de Brasília); o número de fiados
  aparece no placar.
- **Campeão:** o banco guarda o pódio (top 3) de cada semana; o 1º ganha o selo **`weekly_champion`** (troféu
  com "1" dentro), **título em disputa**: no reset seguinte o selo sai dele e vai para o novo campeão. Ele pode
  escolher o selo para aparecer do lado do nome (sistema de selos e `featured_badge` que já existem).
- **Aposta:** 10 a 500 por mão.
- **Regras do blackjack:** 6 baralhos embaralhados de novo a cada mão; banca para em 17 (inclusive macio);
  natural paga 3:2; vitória 1:1; empate devolve; dobrar só nas 2 primeiras cartas (recebe 1 carta); dividir
  com par, **uma vez** (2 mãos), ases divididos recebem 1 carta cada, 21 depois de dividir não é blackjack;
  **sem seguro e sem desistir**. Saiu no meio: a mão fica salva. Mão aberta no reset: Parar automático.
- **Visual:** mesa de **feltro verde em 3D** (Three.js), câmera inclinada, borda de madeira; cartas com índice
  só no canto de cima (sem sobreposição); totais em **plaquinhas escuras com borda dourada** presas a cada mão;
  controles num **painel escuro próprio** (a mesa nunca fica atrás dos botões); **botões "moeda"** redondos com
  aro dourado e plaquinha com o nome (verde Pedir · vermelho Parar · violeta Dobrar · laranja Dividir);
  **fichas de cassino** (borda listrada, anel tracejado, aro dourado) que somam na aposta.
- **Navegação:** 5ª aba no celular, ordem **Feed · Novo post · Games · Notificações · Perfil** (só ícone,
  `game-controller-outline` / `game-controller`, rótulo acessível "Fellas Games"); no PC, item
  **"Fellas Games"** na lateral (último, depois de Ideias).
- **Nome:** Fellas Games.
- **PC:** a mesa é página própria em **tela inteira** (mesa deitada, placar da semana num painel à direita,
  atalhos 1 Pedir · 2 Parar · 3 Dobrar · 4 Dividir); a aba Fellas Games no app fica **larga** (sem a coluna
  da direita, centro até 960).
- **Lógica no banco** (funções SQL), não em Edge Function nem no aparelho.

### Fora do escopo (v1)
Poker (projeto 2); som; chat na mesa; histórico de mãos na tela; notificação de campeão; post automático de
resultado; seguro/desistir; selo permanente ou contador de vitórias.

## 1. Banco

Padrão da casa (0014, 0025): idempotente, RLS ligado em tudo, `revoke all ... from anon`, nenhum
insert/update/delete para o app; funções `security definer`, `set search_path = public`,
`revoke all on function ... from public`, `grant execute ... to authenticated`, todas checando
`is_member()` (erro `not_member`, errcode 42501). Semana = segunda a domingo no fuso
`America/Sao_Paulo`: `public.games_week_start(ts)` =
`date_trunc('week', ts at time zone 'America/Sao_Paulo')::date`.

### Migração `0027_fellas_games.sql` (créditos)

**`game_wallets`** — uma linha por fella.
- `user_id uuid primary key references profiles(id) on delete cascade`
- `balance int not null check (balance >= 0)`
- `week_start date not null`
- `fiado_count int not null default 0`, `last_fiado_on date`
- `last_played_at timestamptz` — fim da última mão **nesta semana** (null = não jogou; fora do placar)
- `updated_at timestamptz not null default now()`
- RLS: **select para membros** (o placar é de todos). Sem escrita para o app.

**`game_ledger`** — extrato.
- `id bigint generated always as identity primary key`, `user_id` (→ profiles, cascade), `delta int not null`,
  `reason text check (reason in ('start','bet','win','push','fiado','reset'))`, `round_id uuid`,
  `created_at timestamptz default now()`.
- RLS: **select só do próprio** (`user_id = auth.uid()`).

**`game_weeks`** — histórico.
- `week_start date primary key`, `champion_id uuid references profiles(id) on delete set null`,
  `podium jsonb not null default '[]'` (até 3 `{user_id, balance, fiado_count}`), `closed_at timestamptz`.
- RLS: select para membros.

**Funções do app**
- `games_wallet() returns jsonb` — cria a carteira com 1.000 (ledger `start`) se não existe; devolve
  `{balance, fiado_count, can_fiado, open_round_id, week_start}`. `can_fiado` = saldo 0, sem mão aberta,
  `last_fiado_on` diferente de hoje (Brasília).
- `games_fiado() returns jsonb` — +100, `fiado_count + 1`, `last_fiado_on = hoje`, ledger `fiado`; devolve o
  mesmo formato de `games_wallet()`. Erros: `fiado_not_broke`, `fiado_open_round`, `fiado_today`.
- Placar: o app lê `game_wallets` (filtro `last_played_at is not null`, ordem `balance desc,
  fiado_count asc, last_played_at asc`) com o perfil embutido (`profiles`: nome, @, avatar, `badges`,
  `featured_badge`) pela FK. Campeão anterior: `game_weeks` mais recente com o perfil do `champion_id`.

**Reset semanal** — `games_weekly_reset() returns void` (security definer, **sem** `grant` para
`authenticated`/`anon`; só o cron/dono chama).
1. `semana_nova = games_week_start(now())`; `semana_que_fecha = max(week_start)` das carteiras. Se não há
   carteira ou `semana_que_fecha >= semana_nova`, sai (idempotente: rodar duas vezes não faz nada).
2. Fecha as mãos abertas chamando o gancho `games_close_open_rounds()` (Parar automático, banca joga, paga).
   Ganchos da 0027, sem grant: `games_open_round(user) returns uuid` e `games_close_open_rounds()` — na 0027
   não fazem nada (null / nada); a 0028 faz `create or replace` deles olhando `bj_rounds` (cada migração
   funciona sozinha, e o poker depois estende os mesmos ganchos com as mesas dele).
3. Pódio: top 3 de quem tem `last_played_at` não nulo, na ordem do placar; grava em `game_weeks`
   (`on conflict do nothing`).
4. Selo: `badges = array_remove(badges, 'weekly_champion')` em quem tem; se houve campeão,
   `array_append` nele.
5. Todas as carteiras: `balance = 1000`, `week_start = semana_nova`, `fiado_count = 0`,
   `last_fiado_on = null`, `last_played_at = null`; ledger `reset` com o delta de cada um.
- Cron: `cron.schedule('fellas-games-reset', '0 3 * * 1', $$select public.games_weekly_reset()$$)`
  (03:00 UTC = 00:00 Brasília; o Brasil não tem horário de verão desde 2019).

### Migração `0028_blackjack.sql`

**Cartas:** inteiros 0–51. `rank = n % 13` (0 = Ás, 1–9 = 2–10, 10 = J, 11 = Q, 12 = K),
`suit = n / 13` (0 ♠, 1 ♥, 2 ♦, 3 ♣). Valor: Ás 1 ou 11, figuras 10.
- `bj_shuffle() returns smallint[]` — sapato de 6 baralhos (312 cartas) em ordem aleatória forte
  (`order by gen_random_uuid()`). Função separada para os testes trocarem por um baralho combinado.
- `bj_hand_value(smallint[]) returns int` e `bj_is_soft(smallint[])` — imutáveis.

**`bj_rounds`** — a mão (só o dono lê: RLS `user_id = auth.uid()` e membro).
- `id uuid pk default gen_random_uuid()`, `user_id` (→ profiles, cascade), `week_start date not null`,
  `status text check (status in ('playing','done'))`, `bet int not null check (bet between 10 and 500)`,
  `hands jsonb not null` — lista de `{cards: int[], bet: int, doubled: bool, from_split_aces: bool,
  done: bool, result: null|'blackjack'|'win'|'push'|'lose'|'bust'}`,
  `active smallint not null default 0`, `dealer smallint[] not null` (só as cartas **visíveis**: a de cima
  durante o jogo; todas no fim), `payout int not null default 0`, `created_at`, `finished_at`.
- `create unique index ... on bj_rounds (user_id) where status = 'playing'` — uma mão aberta por pessoa.

**`bj_secrets`** — `round_id uuid pk references bj_rounds on delete cascade`, `shoe smallint[]`
(o que sobrou), `hole smallint` (a carta virada da banca). **RLS ligado e nenhuma política**;
`revoke all ... from anon, authenticated`. Só as funções leem.

**Estado público** (devolvido por `bj_deal`/`bj_act`, montado por `bj_state(round)`):
`{id, status, bet, hands, active, dealer, dealer_total, payout, balance}` — `dealer_total` só das cartas
visíveis; `balance` = saldo da carteira depois da ação.

**`bj_deal(p_bet int) returns jsonb`**
- Membro; `p_bet` entre 10 e 500 (`bet_out_of_range`); sem mão aberta (`round_open`); carteira (criada se
  preciso) com saldo ≥ aposta (`insufficient_credits`). Carteira travada (`for update`).
- Debita (ledger `bet`), embaralha, distribui jogador, banca (aberta), jogador, banca (virada).
- **Espiada da banca:** se a aberta é Ás ou vale 10 e a banca tem 21 → revela; jogador com natural =
  `push`, senão `lose`; mão termina. Senão, jogador com natural → `blackjack`, paga `bet + bet*3/2` e termina
  (aposta sempre múltiplo de 10, conta inteira).
- Mão que termina: `status = 'done'`, `finished_at`, crédito (ledger `win` ou `push`),
  `last_played_at = now()`.

**`bj_act(p_round uuid, p_action text) returns jsonb`** — `p_action` em `hit | stand | double | split`
(`invalid_action`). Mão travada (`for update`), do dono (`round_not_found`), aberta (`round_done`).
- `hit`: uma carta na mão ativa; passou de 21 → `bust`, mão pronta; fez 21 → mão pronta.
- `stand`: mão pronta.
- `double`: só com 2 cartas e mão que não veio de ases divididos; saldo ≥ aposta da mão
  (`insufficient_credits`); debita (ledger `bet`), dobra a aposta da mão, 1 carta, mão pronta.
- `split`: só com 1 mão, 2 cartas **de mesmo valor** (10, J, Q e K valem como par) e saldo ≥ aposta;
  debita; vira 2 mãos com 1 carta nova cada. Ases divididos: cada mão recebe 1 carta e fica pronta.
- Mão pronta → passa para a próxima não pronta. Nenhuma sobrando → **banca joga** (se alguma mão não
  estourou): revela a virada e compra enquanto o total < 17 (17 macio para). Acerto por mão: estourou →
  `bust`; banca estourou → `win`; maior → `win`; igual → `push`; menor → `lose`. 21 com 2 cartas depois de
  dividir conta como 21 comum (`win` 1:1). Paga `2 × aposta` em `win`, `1 ×` em `push`; ledger; fecha a mão.

**`bj_current() returns jsonb`** — o estado da minha mão aberta (ou null), para a mesa retomar.

**`bj_force_finish(p_round uuid)`** (interno, sem grant) — todas as mãos abertas viram `stand`, banca joga,
acerta e paga. Usada pelo reset.

## 2. Projeto `games/` (Vite + Three.js)

```
games/
  package.json            three, vite, typescript, vitest, @electric-sql/pglite (só dev)
  vite.config.ts          multi-página; base '/games/'; outDir '../dist/games'; emptyOutDir false;
                          envPrefix 'EXPO_PUBLIC_' (mesmos segredos do workflow)
  tsconfig.json           próprio ("types": ["vite/client"])
  shared/
    supabase.ts           createClient com a mesma URL/chave e o mesmo storage do app (localStorage da
                          mesma origem): a sessão do app vale aqui, sem token na URL
    api.ts                gamesWallet(), bjDeal(bet), bjAct(id, action); erros do banco → frases
    table3d/              cena: renderer, câmera fixa inclinada, mesa de feltro com borda de madeira,
                          carta (textura desenhada em canvas, índice no canto de cima), ficha, sapato;
                          loop de desenho só enquanto há animação; pausa com a aba escondida
    hud/                  HTML/CSS por cima da cena: pílula de créditos, plaquinha de total, botão
                          moeda, ficha de aposta, painel de controle, aviso/erro
  blackjack/
    index.html, main.ts   tela do jogo
    machine.ts            estados da tela: carregando → aposta → distribuindo → jogando → fim
    rules.ts              valor da mão (só para mostrar; quem decide é o banco)
  test/
    db.ts                 PGlite + esqueleto (auth.uid() por variável de sessão, profiles,
                          is_member(), papéis anon/authenticated, schema cron falso) + 0027 e 0028
    credits.test.ts, blackjack.test.ts, rules.test.ts
```

- **Build:** no `deploy-web.yml`, depois de `npm run build:web`: `npm ci --prefix games`,
  `npm test --prefix games`, `npm run build --prefix games`. O `wrangler pages deploy dist` já sobe
  `dist/games/blackjack/`. O Pages serve o arquivo estático antes do `_redirects`; nada muda nele.
- **Raiz isolada:** `tsconfig.json` ganha `"exclude": ["games"]`; `jest.config.js` ganha `'/games/'` no
  `testPathIgnorePatterns` — no mesmo commit que cria o primeiro arquivo em `games/`.
- **Layout:** celular em pé = mockup do celular (cena em cima, painel embaixo, totais em plaquinhas). Deitado,
  tablet e PC (largura ≥ 700 e paisagem) = mockup do PC (mesa larga, placar da semana à direita lido de
  `game_wallets`, aposta à esquerda, botões embaixo com atalhos 1–4).
- **Fluxo:** ver seção 4. "← Voltar" faz `location.assign('/games')` (volta para a aba do app).

## 3. App (Expo)

- **`app/(tabs)/games.tsx`** — tela "Fellas Games" com tokens de `lib/theme.ts` e `components/ui`:
  título + "Todo mundo começa a semana com 1.000. Zera segunda à meia-noite."; **Seus créditos** (saldo,
  posição; **Pegar fiado (+100)** quando `can_fiado`); **Campeão da semana passada** (avatar, nome com o
  troféu, saldo final); **Placar da semana** (linhas com `Divider`: posição, avatar, nome, "· N fiado(s)" em
  `textMuted`, saldo; a minha linha com fundo `brandSoft`); cards dos jogos (arte da mesa, nome, "Você contra a
  banca · 10 a 500", botão **Jogar** ou **Continuar mão** quando há mão aberta; Poker com "Em breve"). No PC as
  duas colunas lado a lado (placar | créditos + jogos); no celular, uma coluna.
- **Rota larga:** `AppShell` trata `/games` como rota larga: sem `RightRail`, coluna do meio com o novo token
  `layout.wideCenterWidth` (960).
- **`app/(tabs)/_layout.tsx`** — 5ª `Tabs.Screen name="games"` entre `new` e `notifications`; ícone
  `game-controller`/`game-controller-outline`, `tabBarAccessibilityLabel: 'Fellas Games'`.
- **`components/shell/Sidebar.tsx`** — item `games`, "Fellas Games", href `/games`, último da lista;
  `activeNavItem('/games') = 'games'`.
- **Jogar:** `Linking`/`window.location.assign('/games/blackjack/')` (página fora do roteador do app).
- **`lib/api/games.ts`** — `getWallet()`, `takeFiado()`, `getLeaderboard()`, `getLastChampion()`.
- **Selo:** `lib/badges.ts` ganha `weekly_champion` ("Campeão da semana"); `components/ui/UserBadge`
  desenha o troféu (react-native-svg) com "1" dentro, cor `brand`; aparece no "Selo do lado do nome" do Editar
  perfil como os outros.
- **DESIGN.md:** barra de baixo com 5 abas; a aba Fellas Games; a mesa do Blackjack (feltro 3D, plaquinhas,
  botões moeda, fichas); o selo de troféu; rota larga.

## 4. Estados e erros

**Aba Fellas Games:** carregando = linhas fantasma; erro = "Não deu pra carregar o placar. Tenta de novo." +
**Tentar de novo**; placar vazio = "Ninguém jogou essa semana ainda. Abre os trabalhos."; fiado de hoje usado
= "Fiado de hoje já foi. Volta amanhã."; recarrega ao abrir e ao voltar para a aba.

**Mesa:**
- Sem sessão: "Entra no fellas pra jogar" + botão para o login (`/`). Sem WebGL: "Esse navegador não roda a
  mesa 3D. Tenta pelo Chrome ou Safari atualizado."
- Ao abrir: `games_wallet()`; com `open_round_id`, retoma a mão.
- Aposta: fichas somam (10/50/100/500), fichas que passam do saldo ou do máximo ficam apagadas;
  **Limpar**; **Dar as cartas** (só com aposta ≥ 10). Saldo 0: **Pegar fiado** se der, senão o aviso do fiado.
- Jogando: a animação começa no toque (carta saindo do sapato) e a face aparece com a resposta; botões
  travados até a resposta. Dobrar/Dividir só acesos quando valem (e com saldo).
- Fim: banca revela, plaquinha com o resultado ("Blackjack! +225", "Ganhou +200", "Empate, volta 100",
  "Estourou", "Banca ganhou"), dourada quando ganha; saldo conta até o novo valor; **Bora de novo**.
- Erros: sem rede = "Sem conexão. Sua mão tá salva." + **Tentar de novo**; `insufficient_credits` =
  "Saldo não cobre essa aposta"; `bet_out_of_range` = "Aposta vai de 10 a 500"; `round_done` = "Essa mão já
  acabou" (recarrega o estado); mão fechada pelo reset = "A semana virou! Sua mão foi encerrada e todo mundo
  voltou pra 1.000."
- Reduzir movimento: cartas aparecem sem voar. Botões com rótulo acessível ("Pedir carta"…); a plaquinha de
  resultado é `aria-live`. Alvos ≥ 44.

## 5. Testes

- **`games/test` (vitest + PGlite, sem Docker):** roda a 0027 e a 0028 de verdade sobre o esqueleto e chama
  as funções como `authenticated`, com `bj_shuffle()` trocada por baralhos combinados:
  regras (natural 3:2, espiada da banca, 17 macio para, estouro, empate, dobrar = 1 carta, dividir só com par
  de mesmo valor e uma vez, ases divididos, 21 depois de dividir = 1:1); economia (saldo nunca negativo,
  10–500, fiado só com 0 e uma vez por dia, ledger soma o saldo); reset (fecha mão aberta, pódio na ordem certa
  com desempate, selo sai do antigo e vai pro novo, ninguém leva sem jogo, todo mundo 1.000, segunda chamada
  não faz nada); segurança (não membro barrado, `bj_secrets` ilegível, mão de outro ilegível, insert/update
  direto negado, `games_weekly_reset` sem execute para `authenticated`).
  Se o PGlite não suportar troca de papel para checar RLS, essas checagens viram teste de texto da migração +
  a conferência pela REST no passo 1 de "Como sobe".
- **`games/test/rules.test.ts`:** valor da mão para a tela.
- **App (jest):** `lib/api/games.ts`; tela `games.tsx` (carregando, erro, vazio, fiado, minha linha, Continuar
  mão); `tabsLayout.test.tsx` (5 abas, ordem); `badges.test.tsx` (`weekly_champion`); `Sidebar`
  (`activeNavItem`); teste de texto das migrações (padrão de `__tests__/*Migration.test.ts`).
- **Manual:** mesa no Chrome do PC, no PWA do iPhone e no APK (sessão reconhecida sem novo login, jogar uma
  mão de cada resultado, dividir, dobrar, sair no meio e voltar, sem rede).

## 6. Como sobe

1. **Banco:** branch com tudo pronto e testado. O Juan confere `supabase migration list` e roda o `db push`
   só da 0027 e 0028. Conferência pela REST: `game_wallets`/`game_weeks` respondem 200, `bj_secrets` não
   devolve nada, `games_wallet` responde, e o job `fellas-games-reset` existe.
2. **Push 1 (mesa sem link):** merge na main com o workflow novo e `games/`, sem a aba. Teste direto em
   `fellasapp.pages.dev/games/blackjack/` no celular e no APK.
3. **Push 2 (aba e resto):** 5ª aba, item da lateral, tela Fellas Games, rota larga, selo, DESIGN.md. Antes
   da primeira segunda-feira (o app velho ignora selo que não conhece, então atraso não quebra nada).

**Clientes antigos:** PWA e APK recarregam sozinhos (`AppUpdater`); o app velho não usa nada novo.

## Riscos a conferir na implementação
- **Chave da sessão:** confirmar que o AsyncStorage do app na web grava a sessão no `localStorage` com a
  chave padrão do supabase-js (`sb-<ref>-auth-token`); senão, `storageKey` igual no cliente do jogo.
- **`/games` x `/games/blackjack/`:** a rota do app `/games` não tem arquivo estático (não existe
  `dist/games/index.html`), então cai no `_redirects` e abre o app; conferir no passo 2 que `/games` abre a aba
  e `/games/blackjack/` abre a mesa, inclusive recarregando a página.
- **Desempenho no celular fraco:** pixel ratio limitado a 2, sombras baratas, cena parada sem desenhar.
- **PGlite e papéis** (ver Testes).
