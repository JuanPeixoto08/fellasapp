# Fellas Inc.: a Bolsa (minigame 1)

Data: 11/10/2026. Combinado com o Juan no chat; mockup aprovado em
`.superpowers/brainstorm/2158-1791723853/content/bolsa.html` (e a bancada em `layout-minigames.html`).

## Objetivo

Primeiro dos 4 minigames da bancada (ordem: Bolsa, Horta, Convidados, Lives). Uma bolsa de valores zoeira, no estilo do
mercado de ações do Cookie Clicker: 8 empresas com preço que muda a cada minuto, o mesmo para o grupo todo. Quem presta
atenção compra barato e vende caro; quem aposta no fundo do poço pode ver a empresa quebrar e as ações virarem pó.

## Decisões do Juan

- Mercado **o mesmo para todos** do grupo.
- Libera com **1 Grupo de trader** (gerador 19).
- **Cada empresa ligada a um gerador** (como os prédios do Cookie): o limite daquela empresa cresce com quantos desse
  gerador você tem. Pastel do Zé ↔ Food truck (11) · Açaí Gourmet ↔ Influencer parceiro (14) · Coach Quântico ↔ Curso
  online (16) · Cripto do Primo ↔ Grupo de trader (19) · Uber de Jegue ↔ App na App Store (15) · NFT de Meme ↔ Live na
  Twitch (6) · Funerária 1 Irmão ↔ Investidor anjo (20) · Mecânica Simas ↔ Impressora 3D (8).
- **Melhorias da Bolsa** compradas com F$ na própria Bolsa (preço em horas de produção), que ficam na venda da startup:
  Corretor (menos corretagem) e Escritório (mais ações em todas).
- As ações **atravessam a venda da startup** (prestígio). Não quebra o jogo porque o preço é em segundos de produção.
- Risco: a empresa **pode quebrar** quando o preço cai muito.
- Empresas (código · nome · jeito): PSTL Pastel do Zé (firme, sobe devagar) · ACAI Açaí Gourmet (firme e cara) · COCH
  Coach Quântico (sobe na hype e despenca) · PRMO Cripto do Primo (maluca) · JEGU Uber de Jegue (barata e instável) · MEME
  NFT de Meme (maluca e barata) · IRMA Funerária 1 Irmão (parada) · SIMA Mecânica Simas (média, oscila bastante).

## Fora do escopo

Conquistas da Bolsa, notícias/manchetes do mercado, notificação no app (o Juan não quer), placar de traders. Nada muda
nos créditos do cassino.

## Regras

### Unidade do preço

O preço de uma ação é guardado em **segundos de produção** (`valor`). Em F$, para uma pessoa, vale `valor × r`, com
`r = idle_rate(s)`: o F$/s sem o ×5 das oportunidades (o mesmo `r` da venda da startup). Quando a produção cresce, todos os
preços em F$ crescem juntos; a variação em % e o gráfico não mudam. Comprar barato numa empresa pequena e vender numa
empresa grande dá ganho limitado pelo limite de ações (até ~limite × repouso segundos de produção) — é o mesmo do
Cookie e fica aceito.

### Abrir e limite

- A gaveta **Bolsa** aparece sempre; sem Grupo de trader fica apagada com "Compra 1 Grupo de trader pra abrir a Bolsa".
- Com `generators[19] ≥ 1`: abre. Limite da empresa = `100 + generators[gerador ligado] + bônus do Escritório`. Acima do limite (depois de vender a
  startup, por exemplo) só dá pra vender.

### Comprar e vender

- Botões Comprar 1 · 10 · Máx e Vender 1 · 10 · Tudo, no detalhe da empresa.
- Compra: paga `qtd × valor × r × (1 + corretagem)`; corretagem 5% sem Corretor (ver Melhorias). Máx = o máximo que o F$ e o limite permitem.
- Venda: recebe `qtd × valor × r`, sem taxa.
- O pedido leva o minuto do preço que a pessoa viu (`tick`). Se o minuto já virou, o servidor recusa com
  `idle_bolsa_preco_mudou` ("O preço mudou, confere de novo") e a tela mostra o preço novo.
- Empresa em recuperação judicial não negocia (`idle_bolsa_rj`).
- Sem F$ para 1 ação: `idle_cant_afford` (o erro que a Loja já usa, "Valuation não cobre essa compra"). Sem espaço no limite: `idle_bolsa_limite`. Bolsa fechada
  (sem trader): `idle_bolsa_fechada`. Vender sem ter: `idle_bolsa_sem_acoes`.
- Antes de mexer no F$, o servidor fecha a conta da produção (`idle_settle`), como a Loja.

### Carteira e lucro

- Por empresa: quantas ações e o **custo** total pago em segundos (com a corretagem). Preço médio = custo / qtd.
- Lucro % = `valor / preço médio − 1`, em segundos (não muda quando a produção cresce).
- Vender reduz o custo na proporção (vender metade tira metade do custo).
- Topo da Bolsa: "Carteira F$ X" (soma de `qtd × valor × r`) e "Lucro +F$ Y" (soma de `qtd × valor × r − custo × r`).

### Venda da startup

A carteira não muda. A gaveta fica apagada até o primeiro Grupo de trader da empresa nova; aí as ações estão lá, valendo
segundos da produção nova.

### Melhorias da Bolsa

Duas linhas de 5 níveis, compradas em ordem no topo da tela da Bolsa. O preço é em segundos de produção (em F$ = segundos
× `r` na hora da compra). Ficam na venda da startup (como a carteira), guardadas em `idle_bolsa_nivel`.

| nível | Corretor (corretagem) | custo | Escritório (+ações em cada empresa) | custo |
|---|---|---|---|---|
| 0 | — (5%) | — | — (+0) | — |
| 1 | Primo que entende de ação (4%) | 1800 s (30 min) | Mesa na sala (+25) | 3600 s (1 h) |
| 2 | Assessor do banco (3%) | 3600 s | Salinha comercial (+50) | 7200 s |
| 3 | Mesa de operações (2%) | 7200 s | Andar na Faria Lima (+100) | 14400 s |
| 4 | Robô de trade (1%) | 14400 s | Prédio espelhado (+200) | 28800 s |
| 5 | Insider (shh) (0,5%) | 28800 s | Torre na Berrini (+400) | 57600 s |

O bônus do Escritório é o do nível atual (não soma os anteriores). Comprar pede o nível seguinte
(`idle_bolsa_melhorar(p_tipo, p_nivel)`); nível errado (toque duplo, já comprado, passou do 5) é `idle_bolsa_nivel`; sem
F$ é `idle_cant_afford`; sem trader é `idle_bolsa_fechada`.

## Como o preço anda

Um minuto = um `tick` = `floor(epoch(now) / 60)`. Para cada empresa, a cada tick:

- **Humor** (escondido): 0 parada · 1 sobe devagar · 2 cai devagar · 3 sobe forte · 4 despenca · 5 maluca. Dura de 10 a
  120 ticks (sorteado). Ao acabar, sorteia o próximo com os pesos da empresa.
- **Passo** (função pura, com os sorteios como argumentos, igual em SQL e TS):
  - `delta = clamp(delta × 0,97 + empurrão(humor) × vol + ruído1 × 0,01 × vol, −0,08, 0,08)`, com empurrão: parada 0 ·
    sobe devagar +0,004 · cai devagar −0,004 · sobe forte +0,02 · despenca −0,02 · maluca `ruído2 × 0,06`;
  - `valor = valor × (1 + delta) + (repouso − valor) × 0,01`, depois `valor = max(valor, 0,05 × repouso)`;
  - ruídos ~ normal(0, 1) (Box-Muller a partir de `random()` no SQL).
- **Zona de risco**: `valor < 0,15 × repouso`. A cada tick na zona, a empresa quebra com a chance dela.
- **Quebra**: a empresa ganha `geracao + 1`, fica 10 ticks em recuperação judicial (sem negociar; o preço fica em
  `repouso`, humor parada) e volta a negociar em `repouso` com `delta = 0`.

Catálogo inicial (o teste de simulação pode ajustar `vol`, os pesos e as chances; o resto é fixo):

| id | código | repouso (s) | vol | pesos de humor (0..5) | quebra/tick na zona |
|---|---|---|---|---|---|
| 1 | PSTL | 30 | 0,6 | 30 · 30 · 15 · 10 · 5 · 10 | 1% |
| 2 | ACAI | 120 | 0,5 | 35 · 30 · 15 · 8 · 4 · 8 | 1% |
| 3 | COCH | 50 | 1,2 | 10 · 15 · 10 · 30 · 25 · 10 | 5% |
| 4 | PRMO | 20 | 1,6 | 5 · 10 · 10 · 15 · 15 · 45 | 5% |
| 5 | JEGU | 8 | 1,2 | 15 · 15 · 20 · 10 · 15 · 25 | 5% |
| 6 | MEME | 5 | 1,6 | 5 · 10 · 10 · 15 · 15 · 45 | 5% |
| 7 | IRMA | 80 | 0,3 | 70 · 10 · 10 · 4 · 3 · 3 | 1% |
| 8 | SIMA | 40 | 1,0 | 20 · 20 · 20 · 15 · 15 · 10 | 2% |

### Gerar os minutos

O servidor sorteia (com `random()`, sem semente pública: ninguém prevê o próximo minuto). Os minutos são gerados sob
demanda: toda chamada da Bolsa avança o mercado até o tick atual, com trava (`pg_advisory_xact_lock`) para duas chamadas
não gerarem o mesmo minuto. Se o último minuto guardado tiver mais de 1440 ticks (1 dia), gera só o último dia a partir
do último estado. Guarda 7 dias (10080 ticks) e apaga o resto na mesma chamada.

## Banco (migração `0043_fellas_inc_bolsa.sql`)

- `idle_cat_bolsa` (catálogo: id, código, nome, gerador, repouso, vol, pesos `double precision[6]`, quebra) — lido pela página
  (select para `authenticated` com `is_member()`).
- `idle_bolsa_mercado` (uma linha por empresa: `empresa`, `tick`, `valor`, `delta`, `humor`, `humor_ate`, `geracao`,
  `rj_ate`) — o estado atual.
- `idle_bolsa_precos` (`tick`, `empresa`, `valor`; pk `(tick, empresa)`) — o histórico de 7 dias.
- `idle_bolsa_carteira` (`user_id`, `empresa`, `qtd`, `custo`, `geracao`; pk `(user_id, empresa)`).
- Sem select direto para o app em mercado, preços e carteira: tudo pelas RPCs.
- Funções:
  - `idle_bolsa_passo(...)` (imutável, pura): o passo de um tick com os sorteios como argumentos.
  - `idle_bolsa_avancar()` (interna): gera os ticks que faltam, quebras, poda.
  - `idle_bolsa_nivel` (`user_id`, `corretor`, `escritorio`) — os níveis das melhorias.
  - `idle_bolsa_melhorar(p_tipo text, p_nivel int)` (RPC): compra o próximo nível.
  - `idle_bolsa()` (RPC): avança e devolve `{ tick, vira_em_ms, r, aberta, corretor, escritorio, corretagem, empresas: [{ id, valor, limite, risco, rj_ate,
    historico (60 últimos valores) }], carteira: [{ empresa, qtd, custo }], viraram_po: [{ empresa, qtd }] }`. Ações de
    uma geração antiga entram uma vez em `viraram_po` e são apagadas da carteira na mesma chamada.
  - `idle_bolsa_negociar(p_empresa int, p_lado text, p_qtd int, p_tick bigint)` (RPC): `p_lado` 'comprar'|'vender',
    `p_qtd` 1, 10 ou 0 (Máx/Tudo). Devolve o `idle_json` de sempre mais o `idle_bolsa()`.
- RLS em tudo; internas revogadas de public/anon/authenticated; RPCs só para `authenticated`; erros `P0001` com código
  `idle_*`; não membro `42501`; `update`/`delete` sempre com `where`; idempotente; UTF-8.
- `games/test/db.ts` e `games/dev/mockDb.ts` carregam a 0043.

## Página

- `games/idle/bolsa.ts` (puro): F$ de um valor, lucro %, variação no minuto e na hora, Máx de compra, textos ("Pode
  quebrar", "Quebrou · volta em N min", "N ações", "você não tem").
- `games/idle/bolsaTela.ts` (DOM): lista + detalhe, como no mockup. No PC dentro da gaveta Bolsa da bancada (lista à
  esquerda, detalhe à direita); no celular a gaveta abre a Bolsa em tela cheia e o detalhe sobe como cartão (padrão da
  árvore: `role="dialog"`, Esc fecha, foco volta).
- Lista: código + nome, minigráfico da última hora, preço em F$ e variação na hora, "N ações" + lucro % ou "você não tem";
  etiqueta vermelha "Pode quebrar" na zona de risco; apagada com "Quebrou · volta em N min" na recuperação.
- Detalhe: código + nome, "preço novo em 0:42", preço grande + variação no minuto e na hora, gráfico de 60 barras (a última
  verde se subiu, vermelha se caiu), "Você tem N de L", "Pagou em média F$ X", "Vale agora F$ Y", lucro, Comprar 1 · 10 ·
  Máx (roxo, "+N% de corretagem") e Vender 1 · 10 · Tudo.
- Melhorias: uma faixa no topo da Bolsa com Corretor e Escritório (nível atual, efeito, o próximo com o preço em F$ e
  Comprar; no nível 5, "No máximo").
- Atualiza ao abrir a gaveta/tela e a cada virada de minuto enquanto aberta (um `idle_bolsa()` por minuto). Fechada, não
  busca.
- "Suas N ações da Cripto do Primo viraram pó." entra na fila de avisos da cena (a mesma das conquistas).
- Botões apagados com `ocupado`, sem F$, no limite, na recuperação.

## Testes

- `games/idle/bolsa.test.ts`: formatação, lucro, variações, Máx, textos.
- `games/idle/bolsaMotor.ts` + teste: o passo em TS e uma simulação de 30 dias (43200 ticks) com semente, conferindo os
  alvos:
  - firmes (PSTL, ACAI, IRMA) quebram no máximo 1 vez em 30 dias; malucas (PRMO, MEME) quebram de 3 a 30 vezes;
  - "compra o Máx quando entra na zona de risco e vende ao voltar a 50% do repouso" nas malucas não dá lucro esperado
    (média ≤ 0 em 20 sementes);
  - "compra abaixo de 70% do repouso e vende acima de 105%" nas firmes dá lucro médio positivo;
  - o preço nunca fica abaixo de 5% do repouso nem vira NaN/Infinity.
- Paridade SQL × TS do passo (mesmos sorteios → mesmo resultado, < 1e-9).
- SQL (PGlite): avançar gera os ticks que faltam e não duplica; 1 dia no máximo; poda de 7 dias; quebra muda a geração,
  recuperação de 10 ticks e volta no repouso; negociar compra/vende com corretagem, fecha a conta antes, respeita limite,
  F$, recuperação, preço mudou, sem trader; carteira atravessa a venda da startup; ações antigas viram pó uma vez.
- Melhorias (PGlite): compra em ordem, custo em segundos × r, nível errado recusado, corretagem e limite mudam, ficam
  na venda da startup; limite da empresa cresce com o gerador ligado.
- Tela (happy-dom): gaveta apagada sem trader; lista, etiquetas, detalhe, botões chamando `negociar` com o tick visto;
  aviso de "viraram pó".
- Suítes da raiz e dos jogos verdes; conferência visual no `?mock` (celular, deitado, PC 1280 e 1920).

## Publicação

Com migração: o Juan roda `npx supabase db push`, eu confiro as tabelas e as RPCs (401, não 404) e só então faço o push
da main.
