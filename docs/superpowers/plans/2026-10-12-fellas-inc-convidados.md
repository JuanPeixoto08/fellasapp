# Fellas Inc.: Convidados no PPP Podcast — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O minigame 3: 3 cadeiras no PPP Podcast, 11 convidados com bônus e defeito, trocas que recarregam, conquistas, retratos.

**Architecture:** Quem decide é o banco (0050 catálogo das conquistas gerado, 0051 lógica): estado das cadeiras em
`idle_state`, efeitos entram nas funções que já existem (taxa, conta, compra, oportunidades, dourados, Bolsa, Horta).
A página espelha as contas puras em `games/idle/convidados.ts` (teste de paridade) e mostra a gaveta em
`convidadosTela.ts`. Mesmo padrão da Horta (0047/0048) e da Bolsa (0043).

**Tech Stack:** Postgres/Supabase (plpgsql), PGlite nos testes, TypeScript + DOM puro, vitest (happy-dom), Python/PIL
pros retratos.

**Spec:** `docs/superpowers/specs/2026-10-11-fellas-inc-convidados-design.md`

## Global Constraints

- Migrações: `0050_fellas_inc_catalogo_convidados.sql` (gerada, `ATUALIZAR_CATALOGO`) e `0051_fellas_inc_convidados.sql`
  (a 0049 já é de outra entrega). Ambas entram em `games/test/db.ts` e `games/dev/mockDb.ts`.
- Pesos das cadeiras: frente 1 (abre com 1 PPP Podcast, gerador 13), meio 0,5 (25), canto 0,25 (50).
- Trocas: 3 guardadas; sentar gasta 1; cada uma volta em 1 h, uma por vez; tirar é de graça.
- Gemaplys (3) e MC V.V (9) não sentam juntos.
- Vender a startup não mexe nas cadeiras, trocas nem tempos.
- Textos na tela por extenso: "geradores 10% mais baratos", "melhorias 10% mais caras" (nunca "−10%"); a Horta passa a
  escrever igual.
- Caixinha de informação (CLAUDE.md): cada cadeira e cada convidado da lista ganham caixinha com o efeito **agora**.
- Patch note nova no começo de `novidades.ts`. Sem notificação no app. Supabase safeupdate: UPDATE/DELETE sempre com WHERE.
- Fotos de referência nunca entram no repo; os retratos (PNG 32×32 gerados) entram em `games/idle/assets/convidados/`.
- Commits sem coautoria. O Juan roda o `db push`; conferir as colunas pela REST antes do push na main.

## Review Focus

1. Cadeira que tranca (venda zera PPP Podcasts) com o convidado sentado: efeito some, nada quebra; reabre e volta.
2. Trocas no limite: 0 trocas → `idle_conv_sem_troca`; a recarga não passa de 3 nem perde a fração da hora.
3. Lote alavancado do Vorcaro que vira pó (empresa quebrou) e venda com resultado negativo (recebe 0, não negativo).
4. A conta (`idle_settle`) atravessando degraus do Kojima, 6h/12h da Ana e uma derrubada do MC V.V num trecho longo
   (jogo fechado por horas): o total bate com a soma por trechos.
5. Tentar Gemaplys + MC V.V: nada muda, a conquista escondida sai (sem exceção, senão o rollback apaga a conquista).

---

### Task 1: `convidados.ts` (catálogo e contas puras)

**Files:** Create `games/idle/convidados.ts`, `games/idle/convidados.test.ts`

**Produces:**
```ts
export type Convidado = { id: number; nome: string; bordao: string; bonus: string; defeito: string };
export const CONVIDADOS: readonly Convidado[]; // ids 1..11, na ordem da spec
export const PESOS = [1, 0.5, 0.25] as const;
export const ABRE_COM = [1, 25, 50] as const; // PPP Podcasts (gerador 13)
export const MAX_TROCAS = 3; export const RECARGA_S = 3600;
export type Cadeiras = { cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null };
export function destrancada(cadeira: 0|1|2, ppp: number): boolean;
export function peso(c: Cadeiras, ppp: number, convidado: number): number; // 0 se não está sentado ou cadeira trancada
export function trocasAgora(c: Cadeiras, agoraMs: number): { trocas: number; proximaMs: number | null };
export function kojimaMult(p: number, desdeMs: number, tMs: number): number; // 1 + p(−0,10 + 0,50·min(24,h)/24)
export function manhaBrasilia(tMs: number): boolean; // 06:00 ≤ hora < 12:00 em America/Sao_Paulo (UTC−3 fixo)
export function faixaS(p: number): number; // 7200 / p
export function derrubada(uid: string, desdeS: number, k: number): boolean; // sorte < 0,25 (mesma conta do banco)
export function multProducao(c: Cadeiras, ppp: number, uid: string, tMs: number): number; // CR, Luva, VSauce, Kojima, Ana fora da manhã, derrubada
export function multFoodTruck(c: Cadeiras, ppp: number, tMs: number): number; // Ana de manhã: 1 + p
export function custoGeradores(c, ppp): number; // 1 − 0,10·pGabe
export function custoMelhorias(c, ppp): number; // 1 + 0,10·pCR
export function deltaOportunidades(c, ppp): number; // ⌈5·pLuva⌉ − ⌈3·pGabe⌉
```
Sorte de `derrubada`: a mesma fórmula de `idle_horta_sorte`/`dourados.ts` (`h = (s²·48271 + s·16807 + seed·69621 + k·7919 + 12345) mod p`, depois `(h² + 1013904223) mod p / p`), com `s = desdeS` e `k` a faixa; numeric/BigInt.

- [ ] Testes (vitest): catálogo com 11 nomes e ids; `destrancada(1, 24)` false, `(1, 25)` true; `peso` 0 em cadeira trancada; `trocasAgora` com 1 troca e 90 min desde `trocas_t` → 2 e próxima em 30 min; cheio → `proximaMs` null; `kojimaMult(1, 0, 0)` 0,9, `(1, 0, 24h)` 1,4, `(0,5, 0, 12h)` 1 + 0,5·0,15; `manhaBrasilia` 09:00Z false (06:00 BRT? 09:00Z = 06:00 BRT → true), 15:00Z true(12:00 BRT → false); `multProducao` com CR na frente = 1,15, no meio 1,075; `deltaOportunidades` Luva frente +5, meio +3, canto +2, Gabe −3/−2/−1.
- [ ] Rodar (falha), implementar, rodar (passa), commit.

### Task 2: as conquistas no catálogo (0050) e os nomes

**Files:** Modify `games/idle/nomes.ts` (tipos + 11 conquistas ids 113–123), `games/idle/catalogo.ts`/teste se precisar;
Create `supabase/migrations/0050_fellas_inc_catalogo_convidados.sql` (gerado); Modify `games/test/db.ts`, `games/dev/mockDb.ts`.

Tipos novos: `conv_sentou`, `conv_mesa`, `conv_vistos` (valor 11), `conv_cr`, `conv_fgc`, `conv_kojima`, `conv_hl3`,
`conv_derrubada`, `conv_ana`, `opp_dia` (valor 15), `conv_mesma` (escondida). Nomes e frases exatamente os da spec.

- [ ] Acrescentar as conquistas; `ATUALIZAR_CATALOGO=0050_fellas_inc_catalogo_convidados.sql npx vitest run idle/catalogo.test.ts` (em games/); conferir que o arquivo novo tem só o catálogo; testes do catálogo passam; commit.

### Task 3: 0051 — estado, sentar/tirar, trocas, JSON

**Files:** Create `supabase/migrations/0051_fellas_inc_convidados.sql`; Create `games/test/idleConvidados.test.ts`.

SQL:
- `idle_cat_conv(id, nome)` (11 linhas, lido por membros).
- `idle_state`: `conv_cadeira int[] not null default '{null,null,null}'`, `conv_desde timestamptz[] not null default '{null,null,null}'`, `conv_trocas int not null default 3`, `conv_trocas_t timestamptz`, `conv_vistos int[] not null default '{}'`, `conv_derrubadas int not null default 0`.
- `idle_conv_peso(s, convidado) → double` (peso da cadeira destrancada ou 0); `idle_conv_trocas(s, t) → record(trocas int, t timestamptz)` (recarga).
- `idle_conv_sentar(p_cadeira int, p_convidado int) → jsonb`: membro; lock; cadeira 0..2 destrancada (`idle_conv_trancada`); convidado 1..11 (`idle_bad_choice`); já em outra cadeira ou nesta (`idle_conv_ja_sentado`); Gemaplys×MC V.V → `idle_ganhar(conv_mesma)` e devolve `idle_json(s) || {mesma_pessoa: true}` sem mudar nada; trocas < 1 → `idle_conv_sem_troca`; settle; gasta 1 troca; grava cadeira/desde=now(); `conv_vistos` sem repetir; eventos: `conv_sentou`, `conv_mesa` (3 ocupadas), `conv_cr` (CR na 0), `conv_hl3` (Gabe na 2); save; json.
- `idle_conv_tirar(p_cadeira)`: settle; esvazia (grátis); save.
- `idle_json`: + `'convidados', {cadeira, desde, trocas, proxima_troca, efeitos: {producao, food_truck, geradores, melhorias, opp_delta, gema, mcvv_proxima, derrubada_ate}}`.
- [ ] Testes PGlite: sentar gasta troca e grava; 4ª troca seguida → `idle_conv_sem_troca`; depois de 1 h (relógio falso) volta 1; tirar não gasta; cadeira do meio com 24 PPP → trancada, com 25 abre; mesmo convidado em duas → `idle_conv_ja_sentado`; Gemaplys + MC V.V → `mesma_pessoa`, nada muda, conquista 123 ganha; conquistas 113/114/116/119 nos eventos; vender a startup mantém cadeiras.

### Task 4: 0051 — produção, conta, compras e oportunidades

`idle_conv_prod(s, t)` (produção sem a Ana de manhã), `idle_conv_food(s, t)`; `idle_rate_at` (cópia da 0048) × prod, e
o termo do gerador 11 × food; `idle_conv_mudancas(s, de, ate)` (degraus do Kojima, 6h/12h BRT, início/fim de derrubada)
entra em `idle_settle` e `idle_next_change`; `idle_buy`: geradores × `1 − 0,10·pGabe`, melhorias × `1 + 0,10·pCR`;
`idle_opp_cap` + ⌈5·pLuva⌉ − ⌈3·pGabe⌉ (mín. 1); `idle_claim_opportunity`: `idle_ganhar('opp_dia', opp_count)`;
`idle_check_conquistas`: `conv_vistos`, `conv_kojima` (h ≥ 24), `conv_derrubada` (≥ 1 derrubada desde que sentou), `conv_ana` (sentada desde antes das 6h de hoje e agora ≥ 6h).
- [ ] Testes PGlite: taxa com CR na frente = 1,15× sem ele; Kojima: settle de 30 h em uma chamada = soma dos degraus; Ana: rate às 07h BRT com Food trucks maior que às 13h; Gabe: preço do gerador 10% menor; Luva: opp_left 15; paridade `kojimaMult`/`derrubada`/`manhaBrasilia` com o banco.

### Task 5: 0051 — dourados (Gemaplys e as faixas do MC V.V)

`idle_dourado(u, s, gema double default 0)`: o segundo também vale se `mod(h3, 2400) < 4·gema` (h3 = mais uma volta do hash), tipo pelo mesmo `r`; `idle_conv_faixa(s, seg) → int` (tipo, se `seg` é faixa não derrubada); `idle_dourado_pegar` aceita qualquer dos dois e a janela vai a `15 − 6·gema` s; `dourados.ts` igual (paridade).
- [ ] Testes: paridade TS×SQL de 2000 segundos com gema 0, 0,5 e 1; faixa pega; faixa derrubada não; tempo na tela.

### Task 6: 0051 — Bolsa (Vorcaro e VSauce)

`idle_bolsa_carteira` + `alavanca double precision not null default 1`, PK (user_id, empresa, alavanca); comprar com
Vorcaro sentado (peso p) grava no lote `1 + p`; vender recebe `p_lote` (default 1) e paga `qtd·max(0, compra + L·(valor − compra))·r`
com `compra = custo/qtd`; limite soma os lotes; viraram pó com lote > 1 → `conv_fgc`; `idle_bolsa_estado` manda
`carteira[].alavanca` e, com VSauce sentado, `humor` por empresa. RPC `idle_bolsa_negociar(p_empresa, p_lado, p_qtd, p_tick, p_lote default 1)` (drop da de 4 argumentos).
- [ ] Testes: lote 2× ganha o dobro da diferença; perda dobrada, piso 0; lote separado das normais; sem Vorcaro tudo igual; humor só com VSauce.

### Task 7: 0051 — Horta (Terry e Viniccius13)

`idle_horta_plantas` + `amadurece_s`, `vida_s` (preenche as antigas com o catálogo); plantar e brotar gravam
`catálogo × (1 − 0,30·pTerry)` e `× (1 − 0,20·pTerry)`; todas as funções que usavam `k.amadurece_s`/`k.vida_s` passam
a usar os da planta; cruzamento `0,05·(1 + pVini)`; semente × `1 + 0,5·pVini`; `idle_horta_json` manda os tempos da planta;
`horta.ts` usa os tempos da planta.
- [ ] Testes: plantar com Terry: amadurece 30% antes; plantas antigas iguais; Vini dobra a chance (paridade com a sorte); semente 50% mais cara.

### Task 8: retratos e ícones

`scripts/` não: gerador fica em `../fellas-inc-esbocos/conferencia/retratos3.py`. Gerar `games/idle/assets/convidados/1.png`..`11.png` (32×32) e os ícones 16×16 das conquistas 113–123 em `games/idle/assets/conquistas/` (do retrato), registrar em `ativos.ts`.
- [ ] Teste: `ativos.convidado(id)` existe pros 11; ícones das 11 conquistas.

### Task 9: a tela (gaveta, Bolsa, Horta, caixinhas, cena, mock, patch note)

`convidadosTela.ts` (estúdio com 3 cadeiras, lista dos 11, trocas, ao vivo Kojima/MC V.V/Ana), gaveta na bancada
(apagada sem PPP Podcast), `main.ts`/`api.ts`/`types.ts`, preços na página com os efeitos, `bolsaTela.ts` (lotes e setas),
`hortaTela.ts` (tempos e textos "mais baratos"), caixinhas (`dica.ts`), cena do PPP com o convidado da frente, painel do
`?mock`, patch note "Convidados no PPP Podcast".
- [ ] Testes happy-dom de cada peça; conferência no navegador (PC e celular, música mutada).

### Task 10: revisão, db push, publicar

Revisão do branch inteiro (subagente), correções com teste, o Juan roda `supabase db push`, conferir pela REST, merge e push.
