# Fellas Inc.: dourados novos e oportunidades novas na Caixinha (entrega 5) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Quatro dourados novos (Trend do TikTok, Bombou no LinkedIn, Pix errado, Tigrinho), o Combo e os dourados garantidos; cinco tipos novos na Caixinha (Chamar um dourado, Cupom de primeira compra, Adubo de farmácia, Cashback, Informação privilegiada) com o "Espiar" da Bolsa; as conquistas 132–139; arte, som, caixinha de informação, `?mock` e patch notes.

**Architecture:** O mesmo desenho das entregas 3 e 4. A sorte é uma conta com semente (id + segundo, id + janela) igual na página (`dourados.ts`, `oportunidades.ts`) e no banco (0076, parte A), com teste de paridade. O banco confere e paga (`idle_dourado_pegar`, `idle_dourado_chamar`, `idle_claim_opportunity`, `idle_bolsa_espiar`). Os efeitos com tempo (LinkedIn, Combo, Cashback) e os estoques (cupons, chamados, créditos, garantidos) são colunas novas de `idle_state` que entram no fechamento da conta e na compra, nos dois lados. A tela só mostra e anima.

**Tech Stack:** TypeScript (Vite, sem framework), Vitest + PGlite (banco de teste), Postgres/Supabase (plpgsql), Web Audio (sons sintetizados).

**Spec:** `docs/superpowers/specs/2026-10-15-fellas-inc-dourados-caixinha-design.md`

## Decisões do plano

O que o plano decidiu onde a spec contradiz o código, é impossível ou não fecha a conta. A spec não foi mudada.

1. **Tigrinho paga 30 min e come 15 min** (a spec diz 1 h e 30 min). Com 1 h o ganho médio por dourado sobe 27% (16,1 → 20,5 min de produção, modelo da Task 2); com 30/15 sobe 12% (→ 18,06). A spec manda ajustar o Tigrinho até passar dos 15%. Ficam as 3 grátis por dia, os "3 em cada 10" e a razão 2:1 (perde metade do que ganha). Pix (30 min) e LinkedIn (×30) ficam como a spec.
2. **O Combo fica fora da média do dourado.** É o prêmio de quem pega 3 seguidos olhando a tela; contado (+2 min por dourado), nenhum ajuste dos três números que a spec deixa mexer passa dos 15% sem zerar o Tigrinho.
3. **Média da oportunidade:** com Horta e Bolsa sobe 11% (7,17 → 7,95 min). Sem Horta nem Bolsa sobe 36% (→ 9,75), porque o Adubo e a Informação viram 15 min, como a spec pede. A simulação da semana (que é desse jogador) roda com esse valor, uns 20,4 min por oportunidade, e os ritmos têm que continuar passando (Task 8). Se não passarem: cupons de 10 pra 5 (+10 com a Xepa), e avisar o Juan.
4. **OPP_CORTE:** a spec diz "a janela do dia do deploy", mas uma janela que já passou na hora do deploy trocaria o tipo do que está na caixinha de alguém (o que a spec quer evitar). O corte é a janela da **meia-noite de Brasília depois do `db push`**. O plano usa 2_987_010 (17/10/2026 0h) e o passo de publicar (Task 8) troca pelo valor certo, no TS e no SQL; um teste confere que os dois lados têm o mesmo número.
5. **Meia-preço + cupom:** a spec diz que o desconto de compra nunca passa de 50% (com a Promoção o cupom fica guardado). Pelo mesmo motivo, uma compra que usa a meia-preço (de 1, sem Promoção) também guarda o cupom. Senão ela sairia por 37,5% do preço.
6. **Pix:** a escolha "Ficar / Devolver" fica aberta até a janela do ícone + 8 s (a mesma folga da chuva do Trend), sem relógio na tela; o banco aceita o Pix até a janela + 8 + 3 s. A escolha vai em `p_lado`, mas a linha de `idle_dourados_pegos` do Pix é sempre o lado 0. Senão dava pra ficar E devolver o mesmo Pix.
7. **Viralizou em dobro** (garantido do Pix devolvido) = dois fins seguidos em `viral_ate` (o 2º começa quando o 1º acaba). `idle_settle` e `produzido` já tratam cada fim como uma janela de 1 min × Hype, então a conta não muda. Os selos e a caixinha passam a contar só os Viralizou que já começaram (senão mostrariam ×100).
8. **Combo, "um dourado perdido no meio":** um segundo entre o último pego e o atual que tem dourado da sorte (não Tigrinho), não foi pego e já passou da janela. Um dourado que ainda está na tela quando você pega outro mais novo não quebra (pegar fora de ordem não é castigo). A dupla conta uma vez: o 2º lado do mesmo segundo não soma nem quebra.
9. **Garantido do tipo dupla:** fica na lista até os dois lados serem pegos (ou a janela passar).
10. **"A moedinha reusa a moeda do jogo":** o jogo não tem arte de moeda. O plano desenha uma moedinha 12×12 em pixel (dourada, com F$) em `douradoTela.ts`.
11. **`horta_crescendo` no `idle_json`:** a caixinha precisa saber se há planta crescendo pra mostrar "Adubo de farmácia → sem planta crescendo: 15 min de produção". O estado ganha esse número (plantas crescendo nos canteiros abertos).
12. **`idle_json` passaria de 100 argumentos** num `jsonb_build_object` (limite do Postgres). Os campos novos vão num segundo `jsonb_build_object` concatenado com `||`.
13. **Chamar:** o garantido vai pro segundo seguinte, como a spec. Se a resposta do banco chega depois desse segundo, a página mostra o garantido mesmo assim (o passo de 1 s olha a lista de garantidos à parte).
14. **Insider (shh) é comum por janela:** a simulação da Bolsa (rodada ao planejar, 20 sementes × 30 dias) dá 100% de lucro em 2 h em 16% das janelas (37% nas malucas PRMO e MEME, 0,05% na IRMA). A raridade vem da cadeia: Informação privilegiada (9% das oportunidades, só com Bolsa), espiar, comprar e vender em 2 h. O limite de 100% fica o da spec; o teste confere "possível e abaixo de 25% por janela".
15. **Nome repetido:** a conquista 139 se chama "Insider (shh)", o mesmo nome do 5º nível do Corretor da Bolsa. Mantido, como a spec.
16. **A chuva do Trend trava a tela atrás dela por 8 s** (como o Jogo do Brasil depois do 1º gol, bc911161): clique que erra a moedinha não compra gerador sem querer.
17. **Arte:** um script de dev (`games/dev/iconesDourados.mjs`, Node puro, sem dependência) gera os 8 ícones de conquista (16×16) e os 5 desenhos de oportunidade (96×24, 4 quadros) a partir das grades 12×12 deste plano. O Juan julga e pode trocar.

## Global Constraints

- Trabalhar no worktree `C:\Users\juan\Documents\PROJETOSLLM\fellasapp-dourados` (branch `dourados-caixinha`). Nunca mexer na pasta principal `C:\Users\juan\Documents\PROJETOSLLM\fellasapp`. O `.env` e o `supabase/.temp` já estão no worktree. `npm ci` de verdade (não junction) na raiz e em `games/`: passo 0 da Task 1 (a main até 11cbd37d já foi trazida pro branch em e4baf0c9).
- **Repaginação visual em paralelo:** outra sessão está refazendo o visual do jogo direto na `main` (já entraram dd74453c e bc911161, mexendo em `tela.ts`, `idle.css`, `escala.ts`, `eventoEraTela.ts`, `novidades.ts`). Antes das Tasks 6 e 7 e antes da verificação final (Task 8), rodar `git merge main` no worktree e resolver conflito preservando o visual novo da main (reponha por cima só as linhas deste plano). O código de tela novo fica em arquivos próprios (`douradoTela.ts`, `combo.ts`, `selosTela.ts`, `bolsaTela.ts`, `dourados.css`, `caixinha.css`), com o mínimo de edição em `tela.ts` e `main.ts` e nenhuma em `idle.css`; use as cores, fontes e componentes que estiverem na main na hora (não copie estilos de planos antigos). As Tasks 1–5 e 8 (lógica, banco, api) não mexem em `tela.ts`, `idle.css` nem `main.ts` e rodam sem esperar a repaginação. Em `novidades.ts`, a entrada nova vai no começo da lista como ela estiver na main na hora do merge.
- **Layout atual da main (15/10, 11cbd37d, já no branch):** placar do dinheiro em cima da cena, Caixinha em pé do lado, portas sozinhas embaixo (PC), menos roxo. As Tasks 6 e 7 encaixam o que é novo nesse layout (os selos novos e o "Chamar" ficam junto do placar; as oportunidades novas na Caixinha do lado), lendo `tela.ts`/`idle.css` como estiverem.
- **Taste Engine (pedido do Juan, vale pras Tasks 6 e 7 e qualquer tela mexida):** antes de fechar cada tela, descrever as escolhas de design no `mcp__taste-engine__lookup_slop` (de graça; ex.: "botão roxo cheio em fundo escuro", "coluna com metade vazia", "5 blocos iguais com ícone e título") e corrigir o que ele marcar como cara de IA, sempre dentro do visual do jogo (pixel, Jersey 10, cantos de pixel). A régua é de site: ignorar o que não faz sentido em tela de jogo (ex.: "borda colorida de um lado só"). Regras fixas: **roxo cheio só em botão de ação**; **aba ativa e chave ligada acesas com traço lilás**. O relatório da task lista cada consulta e o que mudou por causa dela.
- Texto da interface em pt-BR, no tom do jogo. Humor ácido pode, sem fato falso sobre pessoa real. O easter egg do Sillas (`segredo.ts`) nunca aparece em texto (nem em `novidades.ts`).
- Migrações novas: `0075_fellas_inc_catalogo_dourados.sql` (gerada com `ATUALIZAR_CATALOGO`, nunca à mão) e `0076_fellas_inc_dourados_caixinha.sql` (à mão, em quatro partes: A sorte, B estado/conta/compra, C pegar, D Caixinha e Bolsa). Nunca editar migração antiga (0074 pra trás). Toda migração nova entra em `games/test/db.ts` (array `MIGRATIONS`) e em `games/dev/mockDb.ts` (import `?raw` + array do `for`).
- Bases das redefinições (copiar a função INTEIRA da migração indicada, mudar só o que o plano mostra, manter os `revoke`/`grant` dela): `idle_dourado_tipo` (0051), `idle_conv_faixa` (0051), `idle_opp_kind` (0049), `idle_rate_at` (0066), `idle_settle` (0074), `idle_save` (0074), `idle_json` (0074), `idle_prestige` (0074), `idle_buy` (0074), `idle_dourado_pegar` (0061; a nova é reescrita inteira no plano), `idle_claim_opportunity` (0063), `idle_bolsa_estado` (0051), `idle_bolsa_negociar_em` (0051). Não precisa redefinir `idle_dourado` (0051): ela chama `idle_dourado_tipo` na hora.
- `idle_dourado_pegar(p_seg bigint, p_lado int, p_moedas int default 0)` substitui a de 2 argumentos: `drop function if exists public.idle_dourado_pegar(bigint, int);` antes.
- `DELETE`/`UPDATE` no SQL sempre com `WHERE` (safeupdate do Supabase).
- Um `jsonb_build_object` tem no máximo 100 argumentos: os campos novos de `idle_json` vão num segundo objeto (`|| jsonb_build_object(...)`).
- Números (da spec, com as decisões acima): roda dos dourados `r = h3 % 100`: dupla 0–1, Viralizou 2–14, Promoção 15–32, Investidor 33–57, Trend 58–69, LinkedIn 70–81, Pix 82–91, Tigrinho 92–99. Roda da Caixinha a partir de `OPP_CORTE` (`% 100`): 0–17, 18–33, 34–49, 50–59, 60–71, 72–80, 81–90, 91–99; antes, `% 3`. Trend: 0 a 20 moedinhas, 1 min de produção cada, chuva de 8 s, janela do banco = tela + 8 + 3 s. LinkedIn: um dos 5 que mais rendem (>0), `linkedin_mult = 1 + 29·f`, 1 min × Hype × dobro, o novo substitui. Pix: ficar 30 min; devolver = garantido em `S + 20 + h % 101`, dobro. Tigrinho: 3 grátis por dia (`tigre_dia`/`tigre_n`), depois `mod(mistura(h3 + 4242), 100) < 30` paga; paga 30 min, come 15 min (nunca abaixo de zero). Combo: 3 seguidos, ×7 por 1 min × Hype, zera se o último pego tem mais de 30 min. Caixinha (com a Xepa, `v_n = 2`, o dobro): Chamar 1 (2), máximo 3; Cupom +10 (+20), ×0,75 no gerador; Adubo 1 planta (2); Cashback 30% por 2 min (4), soma no fim; Informação +1 crédito (2). Sem Horta (ou sem planta crescendo) o Adubo, e sem Bolsa a Informação, pagam os 15 min do tipo 0.
- Caixinha de informação (`dica.ts` monta o texto, `dicaTela.ts` mostra; mouse no PC, foco no teclado; nada no celular) em toda coisa nova com número ou efeito: os 4 dourados novos na tela, os selos novos (LinkedIn, Combo, bolinhas do combo, Cupom, Cashback, Chamar), as 5 oportunidades novas e o "Espiar". Não entra no texto que sobe ao pegar.
- Entrada nova no começo de `games/idle/novidades.ts`, sem as conquistas escondidas (138 e 139).
- CSS do jogo: cores em hex literal (convenção do `idle.css`); a fonte é `var(--i-pixel)`. O CSS novo vai em `games/idle/dourados.css` (Task 6) e `games/idle/caixinha.css` (Task 7), importados no `main.ts` depois do `idle.css`.
- Testes dos jogos: `cd games && npx vitest run --maxWorkers=4 <arquivo>`. No fim: `npx tsc --noEmit` na raiz e em `games/`, `npm test` na raiz. Depois de rodar o vite de teste, matar de verdade o processo da porta 5199 e conferir que não sobrou node.
- Navegador: antes de testar, mutar música e efeitos (`localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')`).
- Commits sem `Co-Authored-By` nem marca de IA.

## Review Focus

- **Pix pego duas vezes** (ficar e depois devolver, ou o contrário, ou dois cliques rápidos): a 2ª chamada dá `idle_dourado_pego` e não paga nada. Teste na Task 4 ("Pix: ficar paga 30 min…").
- **Viralizou em dobro no selo:** com dois fins encadeados, o selo mostra ×10 (não ×100) e o tempo do que está valendo. Teste na Task 3 (`selosBonus` com `[em(30), em(90)]`) e na Task 4 (os dois fins no banco).
- **Resposta sem os campos novos** (página nova antes do `db push`, ou estado antigo): `linkedin_*`, `combo_*`, `cupons`, `cashback_ate`, `garantidos`, `chamados` ausentes contam como "sem", sem quebrar a conta, os preços, os selos nem a caixinha. Teste na Task 3 (`fatoresTempo({})`, `cupomVale`, `cashbackAtivo`).
- **A janela de corte:** janelas antes de `OPP_CORTE` continuam com os 3 tipos (o que está na caixinha de alguém não troca); a partir dela, a roda de 8; o número é o mesmo no TS e no SQL. Testes na Task 2; os testes antigos que pegam "um de cada tipo" param o relógio antes do corte.
- **Tigrinho com F$ quase zero e venda da startup:** a perda nunca deixa F$ negativo; vender não devolve as jogadas grátis do dia. Teste na Task 4.

---

## File Structure

| Arquivo | O que faz |
|---|---|
| `games/idle/nomes.ts` (mod) | tipos de conquista novos; conquistas 132–139 |
| `games/dev/iconesDourados.mjs` (novo) | gera os PNG dos ícones das conquistas e dos desenhos das oportunidades (só dev) |
| `games/idle/dourados.ts` (mod) | a roda de 8, os sorteios dos dourados novos (garantido, Pix, Tigrinho, LinkedIn), as constantes, os selos novos e os textos |
| `games/idle/oportunidades.ts` (mod) | `OPP_CORTE`, a roda de 8 da Caixinha, os textos, cupom/cashback valendo, o "no lugar" sem Horta/Bolsa, o gancho do `?mock` |
| `games/idle/valorMedio.ts` (novo) | o modelo do ganho médio por dourado e por oportunidade (trava os números) |
| `games/idle/economia.ts` (mod) | `rendasGeradores`; `produzido`/`acumular`/`acumularTrechos` com LinkedIn e Combo |
| `games/idle/store.ts` (mod) | `fatoresTempo`; `valuationAgora` com LinkedIn e Combo |
| `games/idle/convidados.ts` (mod) | faixa do MC V.V sem Tigrinho; `eventoDaSorte`; `eventoEm` com os garantidos |
| `games/idle/combo.ts` (novo) | o combo em andamento na página (quebrou ou não) |
| `games/idle/dica.ts` (mod) | `dicaDourado`, `dicaEspiar`, `dicaOportunidade` 3–7, cashback nas caixinhas de compra, LinkedIn/Combo na produção |
| `games/idle/douradoTela.ts` (mod) | ícones novos, chuva do Trend, escolha do Pix, rolo do Tigrinho, selo "2×" |
| `games/idle/selosTela.ts` (novo) | desenha um selo (span com caixinha, ou o botão do Chamar; o nome das bolinhas) |
| `games/idle/dourados.css`, `games/idle/caixinha.css` (novos) | o CSS do que é novo (o `idle.css` não muda) |
| `games/idle/bolsaTela.ts` (mod) | botão "Espiar", humor espiado com "muda em" |
| `games/idle/tela.ts` (mod, o mínimo) | as ligações (dourados, selos, Bolsa, caixinha) e os preços dos geradores com cupom |
| `games/idle/main.ts` (mod, o mínimo) | os CSS novos, pegar com moedinhas/escolha/rolo, garantidos, Chamar, Espiar, re-render do cashback, sons |
| `games/idle/bolsaMotor.test.ts` (mod) | a Insider na simulação de 30 dias |
| `games/idle/audio/efeitos.ts` (mod) | `trend`, `linkedin`, `pix`, `tigreGira`, `tigrePaga`, `tigreCome`, `combo` |
| `games/idle/simulacao.ts` (mod) | `simular(..., minutosOpp)` |
| `games/idle/novidades.ts` (mod) | entrada nova |
| `games/shared/types.ts`, `games/shared/api.ts`, `games/shared/errors.ts`, `games/idle/bolsa.ts`, `games/dev/mockIdle.ts` (mod) | campos e tipos novos, `idleDouradoPegar(seg, lado, moedas)`, `idleDouradoChamar`, `idleBolsaEspiar`, erros novos, painel do mock |
| `supabase/migrations/0075_…` (gerada), `0076_…` (nova) | catálogo; tudo do banco |
| `games/test/idleDouradosCaixinha.test.ts` (novo) | paridade e regras do banco |
| `games/test/db.ts` (mod) | 0075, 0076, `quartaAntesDoCorte` |

---

### Task 1: Preparo, as conquistas 132–139, os ícones e a 0075

**Files:**
- Modify: `games/idle/nomes.ts:157-175` (`TipoConquista`), `:296` (depois da 130) e o fim de `CONQUISTAS` (depois da 131)
- Modify: `games/idle/catalogo.test.ts:57-89`
- Create: `games/dev/iconesDourados.mjs`
- Create: `games/idle/assets/conquistas/conquista-132.png` … `conquista-139.png` (gerados)
- Create: `supabase/migrations/0075_fellas_inc_catalogo_dourados.sql` (gerada)
- Modify: `games/test/db.ts:49`, `games/dev/mockDb.ts:46,60`

**Interfaces:**
- Produces: tipos de conquista `'trend_max' | 'pix_dev' | 'tigre_perdeu' | 'combos' | 'cupons' | 'cashback' | 'tigre_seq' | 'insider'` (o banco usa esses nomes em `idle_ganhar` nas Tasks 4 e 5); `node games/dev/iconesDourados.mjs conquistas | oportunidades` (a Task 7 usa o modo `oportunidades`).

- [ ] **Step 0: Preparar o worktree**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-dourados
git merge main          # traz a bc911161 (Jogo do Brasil trava a tela); sem conflito esperado
npm ci                  # raiz (Expo + jest): install de verdade, não junction
cd games && npm ci      # jogos (vite, vitest, PGlite)
cd .. && npx tsc --noEmit
cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle test/idleDourado.test.ts test/idleEventosEra.test.ts
```

Expected: tudo PASS (é a linha de base; se algo falhar aqui, pare e avise antes de mexer).

- [ ] **Step 1: Os testes do catálogo (falham)**

Em `games/idle/catalogo.test.ts`, no teste das conquistas troque "104 visíveis e 15 escondidas" por "110 visíveis e 17 escondidas" no título, `toHaveLength(104)` → `toHaveLength(110)` e `toHaveLength(15)` → `toHaveLength(17)`. Na lista das escondidas (teste seguinte), acrescente no fim do array esperado: `'O tigre tá pagando', 'Insider (shh)'`. Depois do teste "as conquistas das eras 1–5 (116–131)", acrescente:

```ts
  it('as conquistas dos dourados e da Caixinha (132–139): visíveis antes das escondidas', () => {
    const c = catalogo.conquistas;
    expect(c.find((x) => x.id === 132)).toMatchObject({ tipo: 'trend_max', valor: 20, nome: 'Dancinha do TikTok', escondida: false });
    expect(c.find((x) => x.id === 135)).toMatchObject({ tipo: 'combos', valor: 10, nome: 'C-C-C-Combo!', escondida: false });
    expect(c.find((x) => x.id === 137)).toMatchObject({ tipo: 'cashback', valor: 1e12, nome: 'Volta pra conta', escondida: false });
    expect(c.find((x) => x.id === 138)).toMatchObject({ tipo: 'tigre_seq', valor: 3, nome: 'O tigre tá pagando', escondida: true });
    expect(c.find((x) => x.id === 139)).toMatchObject({ tipo: 'insider', valor: 1, nome: 'Insider (shh)', escondida: true });
    const ids = c.map((x) => x.id);
    expect(ids.indexOf(137)).toBeLessThan(ids.indexOf(101));
    expect(ids.slice(-2)).toEqual([138, 139]);
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: FAIL (contagens 104/15 e as conquistas 132–139 não existem).

- [ ] **Step 3: Tipos e textos em `nomes.ts`**

Em `TipoConquista`, troque a última linha (175) por:

```ts
  | 'evt_mae' | 'evt_shopee' | 'evt_call' | 'evt_tela' | 'evt_gols' | 'era_300' | 'era_melhorias'
  // dourados e Caixinha (0076), todas de evento (idle_ganhar com o contador de dourados_cont): maior Trend, Pix devolvidos,
  // derrotas e vitórias seguidas no Tigrinho, combos, cupons pegos, F$ de cashback; Insider na venda da Bolsa
  | 'trend_max' | 'pix_dev' | 'tigre_perdeu' | 'combos' | 'cupons' | 'cashback' | 'tigre_seq' | 'insider';
```

Em `CONQUISTAS`, logo depois da 130 (linha 296, antes da 101):

```ts
  // dourados e Caixinha (0075): as de evento saem de idle_ganhar com o contador (0076)
  { id: 132, tipo: 'trend_max', valor: 20, nome: 'Dancinha do TikTok', frase: 'Vinte moedas em oito segundos. Seu polegar tem mais seguidor que você.', condicao: 'Pegar as 20 moedinhas de um Trend' },
  { id: 133, tipo: 'pix_dev', valor: 10, nome: 'Cidadão de bem', frase: 'Devolveu dez Pix. O banco nunca te devolveu nada.', condicao: 'Devolver 10 Pix errados' },
  { id: 134, tipo: 'tigre_perdeu', valor: 10, nome: 'Só mais uma', frase: 'Dez derrotas. Amanhã você recupera, com certeza.', condicao: 'Perder 10 vezes no Tigrinho' },
  { id: 135, tipo: 'combos', valor: 10, nome: 'C-C-C-Combo!', frase: 'Dez combos seguidos. O narrador ficou rouco.', condicao: 'Fazer 10 Combos' },
  { id: 136, tipo: 'cupons', valor: 25, nome: 'Primeira compra (de novo)', frase: 'Vinte e cinco primeiras compras, todas no mesmo CPF.', condicao: 'Pegar 25 Cupons de primeira compra' },
  { id: 137, tipo: 'cashback', valor: 1e12, nome: 'Volta pra conta', frase: 'Um trilhão de volta. O que você gastou pra isso, melhor nem somar.', condicao: 'Receber F$ 1 tri de cashback' },
```

E no fim do array (depois da 131):

```ts
  { id: 138, escondida: true, tipo: 'tigre_seq', valor: 3, nome: 'O tigre tá pagando', frase: 'Ele deixou você ganhar. É assim que começa.', condicao: 'Ganhar 3 seguidas no Tigrinho depois das 3 grátis' },
  { id: 139, escondida: true, tipo: 'insider', valor: 1, nome: 'Insider (shh)', frase: 'A CVM quer saber a sua localização.', condicao: 'Vender com 100% de lucro uma ação de empresa espiada nas últimas 2 h' },
```

- [ ] **Step 4: O script dos ícones**

Crie `games/dev/iconesDourados.mjs` (as grades já foram conferidas: 12 linhas de 12 letras, só letras da paleta):

```js
// Só no dev (entrega 5): gera os ícones das conquistas 132–139 (16×16) e os desenhos das oportunidades 3–7 (96×24, 4
// quadros de 24×24) a partir de grades 12×12 (uma letra por pixel, '.' = vazio). PNG escrito à mão com o zlib do Node:
// sem dependência. Uso: node games/dev/iconesDourados.mjs conquistas | oportunidades
import { writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateSync } from 'node:zlib';

const ASSETS = resolve(dirname(fileURLToPath(import.meta.url)), '../idle/assets');
const PALETA = {
  K: '#1E1B2E', W: '#F4F1EA', Y: '#F2D27A', D: '#5A3A1E', G: '#5FD38D', V: '#2E9E5B', A: '#2A5BD7', C: '#5AA9E6',
  H: '#FF5A7A', O: '#F07A2A', R: '#E0454B',
};
const GRADES = {
  nota: [
    '............', '......HKKK..', '......KWWKC.', '......KWKWKC', '......KWK.KC', '......KWK...',
    '..HKKKKWK...', '.HKWWWWWKC..', '.HKWWWWWKC..', '..KWWWWK.C..', '...KKKKCC...', '............',
  ],
  losango: [
    '.....GG.....', '....GGGG....', '...GGVVGG...', '..GGVWWVGG..', '.GGVWWWWVGG.', 'GGVWWVVWWVGG',
    'GGVWWVVWWVGG', '.GGVWWWWVGG.', '..GGVWWVGG..', '...GGVVGG...', '....GGGG....', '.....GG.....',
  ],
  tigre: [
    '.OO......OO.', '.OKO....OKO.', '.OOOOOOOOOO.', 'OOKOOOOOOKOO', 'OWWKOOOOKWWO', 'OWKWOOOOWKWO',
    'OOOOOKKOOOOO', 'OKOOOKKOOOKO', '.OKOWWWWOKO.', '..OWWKKWWO..', '...OWWWWO...', '....OOOO....',
  ],
  combo: [
    '............', '............', '............', '.YY..YY..KK.', 'YYYYYYYYKKKK', 'YYYYYYYYKKKK',
    '.YY..YY..KK.', '............', '.K.K.KKKKK..', '..K.....K...', '.K.K...K....', '.......K....',
  ],
  cupom: [
    '............', '............', 'RRRRRRRRRRRR', 'RWWWWWWWWWWR', '.RWKKWWWKWR.', '..RKKWWKWR..',
    '..RWWWKWWR..', '.RWWWKWKKWR.', 'RWWWKWWKKWWR', 'RRRRRRRRRRRR', '............', '............',
  ],
  cashback: [
    '....YYYY....', '..YYDDDDYY..', '.YDYYYYYYDY.', '.YDYYKKYYDY.', 'YDYYKYYYYYDY', 'YDYYYKKYYYDY',
    'G.GYYYYKYYDY', 'GGGYKKKYYYDY', 'GGGGYKYYYDY.', '.YDYYYYYYDY.', '..YYDDDDYY..', '....YYYY....',
  ],
  olho: [
    '............', '............', '....KKKK....', '..KKWWWWKK..', '.KWWWAAWWWK.', 'KWWWAKKAWWWK',
    'KWWWAKKAWWWK', '.KWWWAAWWWK.', '..KKWWWWKK..', '....KKKK....', '............', '............',
  ],
  megafone: [
    '............', '.........K..', '.......KKY..', '.....KKYYY.H', '.KKKKYYYYY..', '.KWWKYYYYY.H',
    '.KWWKYYYYY..', '.KKKKYYYYY.H', '..K..KKYYY..', '..K....KKY..', '..KK.....K..', '............',
  ],
  frasco: [
    '....WWWW....', '....KKKK....', '.....WW.....', '....KWWK....', '...KGGGGK...', '..KGGGGGGK..',
    '..KGWWWWGK..', '..KGWGGWGK..', '..KGWWWWGK..', '..KGGGGGGK..', '..KGGGGGGK..', '...KKKKKK...',
  ],
};
// conquista: [grade, cor da moldura de 1 px]
const CONQUISTAS = {
  132: ['nota', 'H'], 133: ['losango', 'G'], 134: ['tigre', 'R'], 135: ['combo', 'Y'], 136: ['cupom', 'R'], 137: ['cashback', 'G'],
  138: ['tigre', 'Y'], 139: ['olho', 'A'],
};
const OPORTUNIDADES = { 3: 'megafone', 4: 'cupom', 5: 'frasco', 6: 'cashback', 7: 'olho' };

const TABELA = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = TABELA[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function bloco(tipo, dados) {
  const t = Buffer.from(tipo, 'ascii');
  const tam = Buffer.alloc(4);
  tam.writeUInt32BE(dados.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, dados])));
  return Buffer.concat([tam, t, dados, crc]);
}
/** PNG RGBA w×h; cor(x, y) devolve [r, g, b, a]. */
function png(w, h, cor) {
  const passo = 1 + 4 * w;
  const linhas = Buffer.alloc(h * passo); // filtro 0 em cada linha (o 1º byte já é 0)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [r, g, b, a] = cor(x, y);
      const i = y * passo + 1 + 4 * x;
      linhas[i] = r;
      linhas[i + 1] = g;
      linhas[i + 2] = b;
      linhas[i + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // 8 bits por canal
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    bloco('IHDR', ihdr), bloco('IDAT', deflateSync(linhas)), bloco('IEND', Buffer.alloc(0)),
  ]);
}
const rgba = (letra) => {
  if (!letra || letra === '.') return [0, 0, 0, 0];
  const h = PALETA[letra];
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
};
const pixel = (g, x, y) => (y >= 0 && y < 12 && x >= 0 && x < 12 ? g[y][x] : '.');

const modo = process.argv[2];
if (modo === 'conquistas') {
  // a grade no meio de 16×16 (2 px de folga), com a moldura de 1 px na cor da conquista
  for (const [id, [nome, moldura]] of Object.entries(CONQUISTAS)) {
    const g = GRADES[nome];
    const arq = resolve(ASSETS, 'conquistas', `conquista-${id}.png`);
    writeFileSync(arq, png(16, 16, (x, y) => (x === 0 || y === 0 || x === 15 || y === 15 ? rgba(moldura) : rgba(pixel(g, x - 2, y - 2)))));
    console.log(arq);
  }
} else if (modo === 'oportunidades') {
  // a grade em 2× (24×24) em 4 quadros que sobem e descem 1 px (a .boneco anima com steps(4))
  const SOBE = [0, -1, 0, 1];
  for (const [k, nome] of Object.entries(OPORTUNIDADES)) {
    const g = GRADES[nome];
    const arq = resolve(ASSETS, 'oportunidades', `oportunidade-${k}.png`);
    writeFileSync(arq, png(96, 24, (x, y) => rgba(pixel(g, Math.floor((x % 24) / 2), Math.floor((y - SOBE[Math.floor(x / 24)]) / 2)))));
    console.log(arq);
  }
} else {
  console.error('uso: node games/dev/iconesDourados.mjs conquistas | oportunidades');
  process.exit(1);
}
```

Run (na raiz do worktree): `node games/dev/iconesDourados.mjs conquistas`
Expected: 8 caminhos impressos, `games/idle/assets/conquistas/conquista-132.png` … `-139.png`. Abra dois deles no Read (imagem) pra ver se saíram.

- [ ] **Step 5: Gerar a 0075 e listar nos dois bancos**

Acrescente `'0075_fellas_inc_catalogo_dourados.sql',` no fim de `MIGRATIONS` em `games/test/db.ts` (depois da linha 49). Em `games/dev/mockDb.ts`, depois da linha 46: `import m75 from '../../supabase/migrations/0075_fellas_inc_catalogo_dourados.sql?raw';`, e `m75` no fim do array do `for` (linha 60, depois de `m74`).

Run: `cd games && ATUALIZAR_CATALOGO=0075_fellas_inc_catalogo_dourados.sql npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: cria `supabase/migrations/0075_fellas_inc_catalogo_dourados.sql` e PASS.

- [ ] **Step 6: Ícones, textos no banco e a grade do Legado**

Run: `cd games && npx vitest run --maxWorkers=4 idle/catalogo.test.ts idle/ativos.test.ts idle/legado.test.ts test/idleConquistas.test.ts`
Expected: PASS ("toda conquista … tem ícone 16x16" pega os 8 novos; "os textos das conquistas no jogo (nomes.ts) são os do banco" pega a 0075).

- [ ] **Step 7: Commit**

```bash
git add games/idle/nomes.ts games/idle/catalogo.test.ts games/dev/iconesDourados.mjs games/idle/assets/conquistas supabase/migrations/0075_fellas_inc_catalogo_dourados.sql games/test/db.ts games/dev/mockDb.ts
git commit -m "Fellas Inc.: conquistas dos dourados e da Caixinha (132–139), com ícone (0075)"
```

---

### Task 2: A sorte (TS + banco, paridade) e o modelo do ganho médio

A Task 2 também traz o modelo do ganho médio (`valorMedio.ts`), que a sugestão deixava pra Task 8: os números que ele decide (Tigrinho 30/15 min) entram no SQL da Task 4, então medir antes evita reescrever o banco. A simulação da semana e a da Bolsa continuam na Task 8.

**Files:**
- Modify: `games/idle/dourados.ts:8-27` (tipos, a roda, os sorteios, as constantes)
- Modify: `games/idle/convidados.ts:117-127` (`faixaEm`)
- Modify: `games/idle/oportunidades.ts:30-40` (`tipo`, `TEXTO_TIPO`, constantes)
- Modify: `games/idle/economia.ts` (`rendasGeradores`, depois de `taxaPorUnidade`)
- Modify: `games/idle/ativos.ts:37`, `games/idle/dica.ts:150`, `games/idle/douradoTela.ts:85` (só alargar os tipos)
- Create: `games/idle/valorMedio.ts`, `games/idle/valorMedio.test.ts`
- Modify: `games/idle/dourados.test.ts:21-56`, `games/idle/convidados.test.ts`, `games/idle/oportunidades.test.ts`
- Create: `supabase/migrations/0076_fellas_inc_dourados_caixinha.sql` (parte A)
- Modify: `games/test/db.ts` (0076, `quartaAntesDoCorte`), `games/dev/mockDb.ts` (m76)
- Modify: `games/test/idle.test.ts:181`, `games/test/idleArvore.test.ts:139` (relógio antes do corte)
- Create: `games/test/idleDouradosCaixinha.test.ts`

**Interfaces:**
- Produces (TS, `dourados.ts`): `TIPOS_DOURADO` (8 nomes); `type TipoDourado = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7`; `tipoDourado(uid, s): TipoDourado`; `SAL = { tigre: 4242, linkedin: 5151, pix: 6161, frase: 7373 }`; `sorteioDourado(uid: string, s: number, sal: number, n: number): number`; `tipoGarantido(uid, s): TipoDourado` (nunca 6 nem 7); `segundoPix(uid, s): number`; `tigrePaga(uid, s): boolean`; `escolhaLinkedin(uid: string, s: number, rendas: readonly number[]): { gen: number; f: number } | null`; constantes `TREND_MAX = 20`, `CHUVA_S = 8`, `MOEDINHA_S = 60`, `PIX_FICAR_S = 1800`, `TIGRE_GRATIS = 3`, `TIGRE_CHANCE = 30`, `TIGRE_PAGA_S = 1800`, `TIGRE_COME_S = 900`, `LINKEDIN_MULT = 30`, `LINKEDIN_TOP = 5`, `COMBO_MULT = 7`, `COMBO_PRECISA = 3`, `COMBO_JANELA_S = 1800`.
- Produces (TS, `oportunidades.ts`): `type TipoOportunidade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7`; `OPP_CORTE = 2_987_010`; `tipo(uid, w): TipoOportunidade`; `TEXTO_TIPO: Record<TipoOportunidade, string>`; `CUPONS_POR_OPP = 10`, `CUPOM_FATOR = 0.75`, `CASHBACK = 0.3`, `CASHBACK_S = 120`, `CHAMADOS_MAX = 3`.
- Produces (TS): `rendasGeradores(cat: Catalogo, s: Estado): number[]` (`economia.ts`); `HIPOTESES`, `RODA_DOURADO_HOJE`, `RODA_DOURADO_NOVA`, `RODA_OPP_HOJE`, `RODA_OPP_NOVA`, `garantido(d: number): number`, `mediaDourado(roda): number`, `mediaOportunidade(roda, tem: { horta: boolean; bolsa: boolean }): number` (`valorMedio.ts`); `quartaAntesDoCorte(): Date` (`games/test/db.ts`).
- Produces (SQL): `idle_dourado_h3(u uuid, s bigint) numeric`; `idle_dourado_tipo(u, s) int` (roda nova); `idle_dourado_sorteio(u uuid, s bigint, sal int, n int) int`; `idle_dourado_tipo_garantido(u, s) int`; `idle_dourado_pix_seg(u, s) bigint`; `idle_dourado_tigre_paga(u, s) boolean`; `idle_conv_faixa(s, seg)` (sem 7); `idle_opp_kind(u, w)` (com o corte); `idle_gen_rendas(s idle_state, t timestamptz) table (gen int, renda double precision)`; `idle_rate_at` (soma de `idle_gen_rendas`); `idle_linkedin(s idle_state, seg bigint) table (gen int, f double precision)`.

- [ ] **Step 1: Testes TS da sorte (falham)**

Em `games/idle/dourados.test.ts`, troque o import da linha 3 por:

```ts
import {
  COMBO_MULT, COMBO_PRECISA, CHUVA_S, douradoEm, douradosEntre, escolhaLinkedin, ganhoInvestidor, JANELA_S, janelaS, LINKEDIN_MULT, MOEDINHA_S,
  PIX_FICAR_S, posicao, promoAtiva, segundoPix, selosBonus, TIGRE_CHANCE, TIGRE_COME_S, TIGRE_GRATIS, TIGRE_PAGA_S, tigrePaga, TIPOS_DOURADO,
  tipoDourado, tipoGarantido, TREND_MAX, textoPegou,
} from './dourados';
```

Troque o teste "as chances: Investidor ~45%, …" (linhas 21-43) por:

```ts
  it('as chances da roda nova: 25 · 18 · 13 · 2 · 12 · 12 · 10 · 8 (%)', () => {
    const conta = Array(8).fill(0);
    let n = 0;
    for (const u of [U, '098d04dc-bba1-433a-9ef8-0e9dd863e4ed', 'bf30208e-c18c-4efc-ae6d-d1331de03916']) {
      for (let s = 1_760_000_000; s < 1_760_000_000 + 200_000; s++) {
        conta[tipoDourado(u, s)]++;
        n++;
      }
    }
    [0.25, 0.18, 0.13, 0.02, 0.12, 0.12, 0.1, 0.08].forEach((p, t) => expect(Math.abs(conta[t] / n - p), `tipo ${t}`).toBeLessThan(0.01));
  });
```

Na linha 54: `expect(TIPOS_DOURADO).toEqual(['investidor', 'promocao', 'viralizou', 'dupla', 'trend', 'linkedin', 'pix', 'tigrinho']);`. No fim do arquivo:

```ts
describe('os sorteios dos dourados novos (iguais ao banco: idle_dourado_sorteio)', () => {
  it('garantido: a roda sem Pix nem Tigrinho (os dois viram Investidor)', () => {
    for (let s = 1_760_000_000; s < 1_760_000_000 + 20_000; s++) {
      const t = tipoDourado(U, s);
      expect(tipoGarantido(U, s)).toBe(t >= 6 ? 0 : t);
    }
  });
  it('Pix devolvido: o garantido cai de 20 a 120 s depois', () => {
    const vistos = new Set<number>();
    for (let s = 1_760_000_000; s < 1_760_000_000 + 5_000; s++) {
      const d = segundoPix(U, s) - s;
      expect(d).toBeGreaterThanOrEqual(20);
      expect(d).toBeLessThanOrEqual(120);
      vistos.add(d);
    }
    expect(vistos.size).toBeGreaterThan(90);
  });
  it('Tigrinho: a casa paga 3 em cada 10', () => {
    let n = 0;
    for (let s = 1_760_000_000; s < 1_760_000_000 + 20_000; s++) if (tigrePaga(U, s)) n++;
    expect(n / 20_000).toBeCloseTo(0.3, 1);
  });
  it('LinkedIn: um dos 5 que mais rendem; f = a parte dele na soma; sem renda nenhuma, null', () => {
    const rendas = [0, 10, 40, 5, 0, 20, 1, 2, 30, ...Array(21).fill(0)]; // rendem os geradores 2, 3, 4, 6, 7, 8 e 9
    const top = new Set([3, 9, 6, 2, 4]); // 40, 30, 20, 10, 5
    const vistos = new Set<number>();
    for (let s = 1_760_000_000; s < 1_760_000_000 + 500; s++) {
      const e = escolhaLinkedin(U, s, rendas)!;
      expect(top.has(e.gen)).toBe(true);
      expect(e.f).toBeCloseTo(rendas[e.gen - 1] / 108, 12);
      vistos.add(e.gen);
    }
    expect(vistos.size).toBe(5);
    expect(escolhaLinkedin(U, 1, Array(30).fill(0))).toBeNull();
    expect(escolhaLinkedin(U, 1, [7, ...Array(29).fill(0)])).toEqual({ gen: 1, f: 1 });
  });
  it('as constantes da spec (e as do plano: o Tigrinho paga 30 min e come 15)', () => {
    expect({ TREND_MAX, CHUVA_S, MOEDINHA_S, PIX_FICAR_S, TIGRE_GRATIS, TIGRE_CHANCE, TIGRE_PAGA_S, TIGRE_COME_S, LINKEDIN_MULT, COMBO_MULT, COMBO_PRECISA }).toEqual({
      TREND_MAX: 20, CHUVA_S: 8, MOEDINHA_S: 60, PIX_FICAR_S: 1800, TIGRE_GRATIS: 3, TIGRE_CHANCE: 30, TIGRE_PAGA_S: 1800, TIGRE_COME_S: 900,
      LINKEDIN_MULT: 30, COMBO_MULT: 7, COMBO_PRECISA: 3,
    });
  });
});
```

Em `games/idle/convidados.test.ts` (acrescente `derrubada, faixaEm, MCVV` ao import de `./convidados` e `tipoDourado` de `./dourados`, se ainda não estiverem):

```ts
describe('a faixa do MC V.V com a roda nova (0076)', () => {
  it('nunca dá Tigrinho: o 7 vira Investidor (0)', () => {
    const uid = '4a681416-b4ee-4976-8cdd-540cc816f28c';
    let seg = 1_760_000_000;
    while (tipoDourado(uid, seg) !== 7 || derrubada(uid, seg - 7200, 1)) seg++;
    const c = { cadeira: [MCVV, null, null], desde: [new Date((seg - 7200) * 1000).toISOString(), null, null], trocas: 3, trocas_t: null };
    expect(faixaEm(uid, c, 1, seg)).toBe(0);
  });
});
```

Em `games/idle/oportunidades.test.ts` (acrescente `OPP_CORTE, TEXTO_TIPO` ao import de `./oportunidades`):

```ts
describe('a roda da Caixinha com o corte (0076)', () => {
  it('antes de OPP_CORTE, só 0, 1 e 2 (o que já está guardado não troca de tipo)', () => {
    for (let w = OPP_CORTE - 3000; w < OPP_CORTE; w++) expect(tipo(V, w)).toBeLessThanOrEqual(2);
  });
  it('a partir do corte: 18 · 16 · 16 · 10 · 12 · 9 · 10 · 9 (%)', () => {
    const conta = Array(8).fill(0);
    const N = 60_000;
    for (let w = OPP_CORTE; w < OPP_CORTE + N; w++) conta[tipo(V, w)]++;
    [0.18, 0.16, 0.16, 0.1, 0.12, 0.09, 0.1, 0.09].forEach((p, k) => expect(Math.abs(conta[k] / N - p), `tipo ${k}`).toBeLessThan(0.01));
  });
  it('os textos dos 8 tipos', () => {
    expect(TEXTO_TIPO).toEqual({
      0: '15 minutos de produção na hora', 1: 'Produção ×5 por 1 minuto', 2: 'Próxima compra pela metade', 3: 'Chamar um dourado',
      4: 'Cupom de primeira compra', 5: 'Adubo de farmácia', 6: 'Cashback', 7: 'Informação privilegiada',
    });
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/dourados.test.ts idle/convidados.test.ts idle/oportunidades.test.ts`
Expected: FAIL (as funções e constantes novas não existem; a roda é a velha).

- [ ] **Step 2: A sorte em `dourados.ts`, `convidados.ts` e `oportunidades.ts`**

Em `games/idle/dourados.ts`, troque as linhas 8-27 (de `TIPOS_DOURADO` até o fim de `tipoDourado`) por:

```ts
export const TIPOS_DOURADO = ['investidor', 'promocao', 'viralizou', 'dupla', 'trend', 'linkedin', 'pix', 'tigrinho'] as const;
/** 0 Investidor apressado · 1 Promoção relâmpago · 2 Viralizou · 3 dupla de Viralizou · 4 Trend do TikTok · 5 Bombou no
 *  LinkedIn · 6 Pix errado · 7 Tigrinho (os quatro últimos desde 15/10, 0076). */
export type TipoDourado = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** Quanto tempo o evento fica na tela (s); o banco aceita até 15 s (folga da rede). */
export const JANELA_S = 12;

// os números dos dourados novos (0076; o Tigrinho com os do plano: paga 30 min e come 15, ver valorMedio.ts)
export const TREND_MAX = 20; // moedinhas que contam num Trend
export const CHUVA_S = 8; // a chuva do Trend (e quanto a escolha do Pix fica aberta depois da janela)
export const MOEDINHA_S = 60; // cada moedinha: 1 min de produção
export const PIX_FICAR_S = 1800; // ficar com o Pix: 30 min de produção
export const TIGRE_GRATIS = 3; // jogadas do dia que sempre pagam
export const TIGRE_CHANCE = 30; // depois, paga 30 em cada 100
export const TIGRE_PAGA_S = 1800;
export const TIGRE_COME_S = 900;
export const LINKEDIN_MULT = 30; // o gerador sorteado rende ×30
export const LINKEDIN_TOP = 5; // sorteado entre os 5 que mais rendem
export const COMBO_MULT = 7;
export const COMBO_PRECISA = 3; // pegos seguidos
export const COMBO_JANELA_S = 1800; // o último pego tem mais de 30 min: o combo zera

const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;

function h1(uid: string, s: number): bigint {
  const b = BigInt(s);
  return (b * b * 48271n + b * 16807n + BigInt(semente(uid)) * 69621n + 12345n) % P;
}
/** A 3ª mistura do segundo (igual a idle_dourado_h3): o tipo sai dela (r = h3 % 100), e os sorteios dos novos também. */
const h3 = (uid: string, s: number) => mistura(mistura(h1(uid, s)));

/** Faixas de r (0–99), na ordem da spec: dupla 0–1, Viralizou 2–14, Promoção 15–32, Investidor 33–57, Trend 58–69,
 *  LinkedIn 70–81, Pix 82–91, Tigrinho 92–99. */
const RODA: readonly (readonly [number, TipoDourado])[] = [[2, 3], [15, 2], [33, 1], [58, 0], [70, 4], [82, 5], [92, 6], [100, 7]];

/** O tipo sorteado pro segundo `s` (vale pros eventos da sorte e pras faixas do MC V.V). */
export function tipoDourado(uid: string, s: number): TipoDourado {
  const r = Number(h3(uid, s) % 100n);
  return RODA.find(([lim]) => r < lim)![1];
}

/** O "sal" de cada sorteio dos dourados novos (o mesmo no banco). */
export const SAL = { tigre: 4242, linkedin: 5151, pix: 6161, frase: 7373 } as const;
/** Um sorteio de 0 a n − 1 do segundo `s` (igual a idle_dourado_sorteio). */
export const sorteioDourado = (uid: string, s: number, sal: number, n: number) => Number(mistura(h3(uid, s) + BigInt(sal)) % BigInt(n));
/** O tipo de um dourado garantido (Pix devolvido, Chamar) no segundo `s`: a roda sem Pix e sem Tigrinho (viram Investidor). */
export function tipoGarantido(uid: string, s: number): TipoDourado {
  const t = tipoDourado(uid, s);
  return t >= 6 ? 0 : t;
}
/** Pix devolvido no segundo `s`: o segundo do garantido em dobro, de 20 a 120 s depois. */
export const segundoPix = (uid: string, s: number) => s + 20 + sorteioDourado(uid, s, SAL.pix, 101);
/** Tigrinho depois das 3 grátis do dia: paga? (3 em cada 10) */
export const tigrePaga = (uid: string, s: number) => sorteioDourado(uid, s, SAL.tigre, 100) < TIGRE_CHANCE;
/** Bombou no LinkedIn: o gerador sorteado entre os 5 que mais rendem (empate: o de id menor primeiro) e a parte dele na
 *  soma (`rendas[i]` = o gerador i + 1). Sem renda nenhuma: null. Igual a idle_linkedin. */
export function escolhaLinkedin(uid: string, s: number, rendas: readonly number[]): { gen: number; f: number } | null {
  const soma = rendas.reduce((a, x) => a + (x > 0 ? x : 0), 0);
  const top = rendas.map((renda, i) => ({ gen: i + 1, renda })).filter((x) => x.renda > 0)
    .sort((a, b) => b.renda - a.renda || a.gen - b.gen).slice(0, LINKEDIN_TOP);
  if (!top.length) return null;
  const e = top[sorteioDourado(uid, s, SAL.linkedin, top.length)];
  return { gen: e.gen, f: e.renda / soma };
}
```

(As linhas 14-21 de antes, `P`/`K`/`mistura`/`h1`, entram aqui; não duplique. `posicao` continua usando `mistura(mistura(mistura(h1(uid, s))))`.)

Em `games/idle/convidados.ts`, a última linha de `faixaEm` (126) vira:

```ts
  const t = tipoDourado(uid, seg);
  return t === 7 ? 0 : t; // a faixa nunca é Tigrinho (0076)
```

Em `games/idle/oportunidades.ts`, troque `tipo` e `TEXTO_TIPO` (linhas 30-40) por:

```ts
/** 0 15 min de produção · 1 ×5 por 1 min · 2 próxima compra pela metade · 3 Chamar um dourado · 4 Cupom de primeira compra ·
 *  5 Adubo de farmácia · 6 Cashback · 7 Informação privilegiada (de 3 a 7 desde a 0076). */
export type TipoOportunidade = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;
/** A janela de corte (0076): as de antes continuam com 3 tipos (% 3), pra nada que já está na caixinha de alguém trocar
 *  de tipo; a partir dela, a roda de 8 (% 100). É a janela da meia-noite de Brasília depois do db push (o passo de
 *  publicar acerta o número, aqui e em idle_opp_kind). */
export const OPP_CORTE = 2_987_010;
/** Limites (exclusivos) de r = h % 100 de cada tipo, de 0 a 7: 0–17, 18–33, 34–49, 50–59, 60–71, 72–80, 81–90, 91–99. */
const RODA_OPP: readonly number[] = [18, 34, 50, 60, 72, 81, 91, 100];

/** O tipo da janela w, sorteado (igual a idle_opp_kind). */
export const tipo = (uid: string, w: number): TipoOportunidade => {
  const s = sorte(uid, w);
  if (s === null) return 0;
  const h = mistura(s);
  if (w < OPP_CORTE) return Number(h % 3n) as TipoOportunidade;
  const r = Number(h % 100n);
  return RODA_OPP.findIndex((lim) => r < lim) as TipoOportunidade;
};

export const TEXTO_TIPO: Record<TipoOportunidade, string> = {
  0: '15 minutos de produção na hora',
  1: 'Produção ×5 por 1 minuto',
  2: 'Próxima compra pela metade',
  3: 'Chamar um dourado',
  4: 'Cupom de primeira compra',
  5: 'Adubo de farmácia',
  6: 'Cashback',
  7: 'Informação privilegiada',
};

// os números das oportunidades novas (0076); com "rendem o dobro" (Xepa / Viralizar) cada um vale 2×
export const CUPONS_POR_OPP = 10;
export const CUPOM_FATOR = 0.75; // compra de gerador 25% mais barata
export const CASHBACK = 0.3; // devolve 30% do preço
export const CASHBACK_S = 120; // por 2 min (soma no fim do que já tem)
export const CHAMADOS_MAX = 3;
```

Alargue os tipos que ainda esperam 3 oportunidades ou 4 dourados (a tela dos novos vem nas Tasks 6 e 7):
- `games/idle/ativos.ts:37`: `oportunidade: (k: number) => oportunidades[\`oportunidade-${k}\`],`
- `games/idle/dica.ts:150`: `export function dicaOportunidade(s: IdleState, tipo: TipoOportunidade, agoraMs: number): Dica | null {` com `if (tipo === 0 || tipo > 2) return null;` na 1ª linha (a Task 7 preenche 3–7) e `import type { TipoOportunidade } from './oportunidades';` no topo.
- `games/idle/douradoTela.ts:85`: `const tipo = (e.tipo === 3 ? 2 : e.tipo > 3 ? 0 : e.tipo) as 0 | 1 | 2; // os novos ganham ícone na Task 6`

Run: `cd games && npx vitest run --maxWorkers=4 idle/dourados.test.ts idle/convidados.test.ts idle/oportunidades.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: `rendasGeradores` e o modelo do ganho médio (testes primeiro)**

Crie `games/idle/valorMedio.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { garantido, mediaDourado, mediaOportunidade, RODA_DOURADO_HOJE, RODA_DOURADO_NOVA, RODA_OPP_HOJE, RODA_OPP_NOVA } from './valorMedio';

// Spec (Testes): o ganho médio por dourado e por oportunidade não sobe mais de 15% sobre o de hoje. Em minutos da sua produção.
describe('ganho médio: a entrega 5 não sobe mais de 15%', () => {
  it('dourado: hoje 16,1 min; com os novos 18,06 (+12%, com o Tigrinho de 30 min; com o de 1 h seria +27%)', () => {
    expect(mediaDourado(RODA_DOURADO_HOJE)).toBeCloseTo(16.1, 6);
    expect(mediaDourado(RODA_DOURADO_NOVA)).toBeCloseTo(18.0552, 3);
    expect(mediaDourado(RODA_DOURADO_NOVA) / mediaDourado(RODA_DOURADO_HOJE)).toBeLessThanOrEqual(1.15);
  });
  it('o garantido: 16,05 min; em dobro 32,09 (devolver o Pix vale um pouco mais que ficar com 30)', () => {
    expect(garantido(1)).toBeCloseTo(16.046, 3);
    expect(garantido(2)).toBeCloseTo(32.092, 3);
  });
  it('oportunidade com Horta e Bolsa: hoje 7,17 min; com os novos 7,95 (+11%)', () => {
    const tem = { horta: true, bolsa: true };
    expect(mediaOportunidade(RODA_OPP_HOJE, tem)).toBeCloseTo(7.1667, 3);
    expect(mediaOportunidade(RODA_OPP_NOVA, tem)).toBeCloseTo(7.9546, 3);
    expect(mediaOportunidade(RODA_OPP_NOVA, tem) / mediaOportunidade(RODA_OPP_HOJE, tem)).toBeLessThanOrEqual(1.15);
  });
  it('sem Horta nem Bolsa (o Adubo e a Informação viram 15 min): +36%; a simulação da semana roda com isso (Task 8)', () => {
    const sem = { horta: false, bolsa: false };
    expect(mediaOportunidade(RODA_OPP_NOVA, sem) / mediaOportunidade(RODA_OPP_HOJE, sem)).toBeCloseTo(1.3611, 3);
  });
});
```

Em `games/idle/economia.test.ts` (acrescente `rendasGeradores` ao import de `./economia`):

```ts
describe('rendasGeradores (o sorteio do LinkedIn)', () => {
  it('cada gerador: unidades × quanto cada uma rende; a soma é a taxa', () => {
    const s = { generators: [10, 5, ...Array(28).fill(0)], upgrades: [11], strategies: [-1, -1, -1, -1] };
    const r = rendasGeradores(catalogo, s);
    expect(r).toHaveLength(30);
    expect(r[0]).toBeCloseTo(10 * taxaPorUnidade(catalogo, s, 1), 9);
    expect(r[1]).toBeCloseTo(5 * taxaPorUnidade(catalogo, s, 2), 9);
    expect(r.slice(2).every((x) => x === 0)).toBe(true);
    expect(r[0] + r[1]).toBeCloseTo(taxa(catalogo, s), 9);
  });
});
```

(Se `catalogo`, `taxa` ou `taxaPorUnidade` ainda não estiverem importados no arquivo, acrescente.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/valorMedio.test.ts idle/economia.test.ts`
Expected: FAIL (`valorMedio.ts` e `rendasGeradores` não existem).

- [ ] **Step 4: `rendasGeradores` e `valorMedio.ts`**

Em `games/idle/economia.ts`, depois de `taxaPorUnidade`:

```ts
/** Quanto cada gerador rende no total agora (unidades × cada uma, com o multiplicador global; `[i]` = o gerador i + 1).
 *  O sorteio do LinkedIn usa (igual a idle_gen_rendas: os bônus que o banco põe por cima multiplicam todos igual). */
export function rendasGeradores(cat: Catalogo, s: Estado): number[] {
  const f = fatores(cat, s);
  return f.porGerador.map((x, i) => x * s.generators[i] * f.global);
}
```

Crie `games/idle/valorMedio.ts`:

```ts
// Quanto vale, em média, um dourado e uma oportunidade da Caixinha, em minutos da sua produção: hoje (antes da entrega 5)
// e com os tipos novos. É o modelo que trava o ritmo (spec, seção Testes: o ganho médio não sobe mais de 15%). Jogador que
// pega tudo o que aparece, sem árvore nem Xepa. As hipóteses estão em HIPOTESES; mexer nelas muda a conta. O Combo fica
// fora (é o prêmio de quem pega 3 seguidos olhando a tela; ver as decisões do plano da entrega 5).
import { LINKEDIN_MULT, PIX_FICAR_S, TIGRE_PAGA_S, TREND_MAX } from './dourados';
import { CASHBACK, CASHBACK_S, CUPOM_FATOR, CUPONS_POR_OPP } from './oportunidades';

export const HIPOTESES = {
  promocao: 10, // 30 s de tudo pela metade ≈ 10 min de produção economizados
  compra: 5, // uma compra típica de gerador ≈ 5 min de produção
  saldo: 5, // o que a pessoa tem na mão quando o cashback liga
  moedinhas: 15, // moedinhas pegas num Trend (caem ~25)
  fatiaLinkedin: 0.2, // a parte média do gerador sorteado (entre os 5 que mais produzem)
  adubo: 5, // amadurecer na hora a planta mais perto ≈ 5 min de produção
  info: 5, // espiar o humor de uma empresa ≈ 5 min de produção
} as const;

/** Pesos de cada tipo (índice = tipo). */
export const RODA_DOURADO_HOJE = [45, 35, 18, 2] as const;
export const RODA_DOURADO_NOVA = [25, 18, 13, 2, 12, 12, 10, 8] as const;
export const RODA_OPP_HOJE = [1, 1, 1] as const;
export const RODA_OPP_NOVA = [18, 16, 16, 10, 12, 9, 10, 9] as const;

const H = HIPOTESES;
const media = (pesos: readonly number[], valor: (t: number) => number) =>
  pesos.reduce((a, p, t) => a + p * valor(t), 0) / pesos.reduce((a, p) => a + p, 0);

/** Um dourado do tipo `t`, em minutos de produção; `d` = 2 no dobro do Pix devolvido. */
function dourado(t: number, d: number): number {
  switch (t) {
    case 0: return 20 * d; // Investidor
    case 1: return H.promocao * d;
    case 2: return 9 * d; // ×10 por 1 min = 9 min a mais
    case 3: return 99 * d; // os dois lados: ×100 por 1 min
    case 4: return Math.min(H.moedinhas, TREND_MAX) * d;
    case 5: return (LINKEDIN_MULT - 1) * H.fatiaLinkedin * d;
    case 6: return Math.max(PIX_FICAR_S / 60, garantido(2)); // fica ou devolve, o que valer mais
    default: return TIGRE_PAGA_S / 60; // quase ninguém passa das 3 grátis do dia
  }
}

/** O dourado garantido (Pix devolvido com d = 2, Chamar com d = 1): a roda nova sem Pix nem Tigrinho (viram Investidor). */
export function garantido(d: number): number {
  const p = [...RODA_DOURADO_NOVA];
  p[0] += p[6] + p[7];
  p[6] = 0;
  p[7] = 0;
  return media(p, (t) => (t >= 6 ? 0 : dourado(t, d)));
}

export const mediaDourado = (roda: readonly number[]) => media(roda, (t) => dourado(t, 1));

/** Uma oportunidade (sem a Xepa); `tem` = se a pessoa tem Horta (com planta crescendo) e Bolsa. */
export function mediaOportunidade(roda: readonly number[], tem: { horta: boolean; bolsa: boolean }): number {
  return media(roda, (t) => {
    switch (t) {
      case 0: return 15;
      case 1: return 4; // ×5 por 1 min
      case 2: return H.compra / 2; // a próxima compra pela metade
      case 3: return garantido(1);
      case 4: return CUPONS_POR_OPP * (1 - CUPOM_FATOR) * H.compra;
      case 5: return tem.horta ? H.adubo : 15;
      case 6: return CASHBACK * (H.saldo + CASHBACK_S / 60);
      default: return tem.bolsa ? H.info : 15;
    }
  });
}
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/valorMedio.test.ts idle/economia.test.ts`
Expected: PASS. Se a razão do dourado passar de 1,15 (alguém mudou uma hipótese), NÃO mexa nas hipóteses: avise.

- [ ] **Step 5: Paridade com o banco (falha)**

Em `games/test/db.ts`: acrescente `'0076_fellas_inc_dourados_caixinha.sql',` no fim de `MIGRATIONS`, `import { OPP_CORTE } from '../idle/oportunidades';` no topo e, depois de `quartaATarde`:

```ts
/** Uma quarta à tarde duas semanas antes do OPP_CORTE (a Caixinha ainda com os 3 tipos de antes): os testes que pegam um
 *  de cada tipo antigo param o relógio aqui (0076). 144 janelas de 10 min por dia. */
export const quartaAntesDoCorte = () => quartaATarde((OPP_CORTE - 14 * 144) * 600_000);
```

Em `games/dev/mockDb.ts`: `import m76 from '../../supabase/migrations/0076_fellas_inc_dourados_caixinha.sql?raw';` e `m76` no array do `for`.

Em `games/test/idle.test.ts:181` troque `quartaATarde()` por `quartaAntesDoCorte()` (e o import de `./db`); em `games/test/idleArvore.test.ts:139` troque `vi.setSystemTime(quartaATarde())` por `vi.setSystemTime(quartaAntesDoCorte())` (e o import). Os dois procuram oportunidades dos tipos 0, 1 e 2: depois do corte a roda tem 8 e eles quebrariam conforme o dia em que rodam.

Crie `games/test/idleDouradosCaixinha.test.ts`:

```ts
// Dourados novos e oportunidades novas na Caixinha (0076): a sorte do banco é a da página, e a conta, a compra, o pegar,
// a Caixinha e a Bolsa.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from '../idle/catalogo';
import { derrubada } from '../idle/convidados';
import { escolhaLinkedin, segundoPix, sorteioDourado, tigrePaga, tipoDourado, tipoGarantido } from '../idle/dourados';
import { rendasGeradores } from '../idle/economia';
import { OPP_CORTE, tipo } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type J = IdleState & { dourados_cont: Record<string, number> };
const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
/** Fecha a conta no futuro: nada rende entre ler e agir (as contas ficam exatas). */
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
/** A, membro, empresa aberta com F$ de sobra, 50 do gerador 1 e 20 do 2; B não é membro. */
const abrir = async () => {
  await t.member(A);
  await t.member(B, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
  await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  await parar();
};

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

// a idle_rate_at da 0066, com outro nome: a nova (soma de idle_gen_rendas) tem que dar o mesmo
const RATE_0066 = `
create or replace function public.idle_rate_at_0066(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
       * public.idle_social_mult(s, t)
       * public.idle_bonus_mult(s)
       * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
       * public.idle_conv_prod(s, t)
       * public.idle_place_mult(s)
$$;`;

describe('a sorte (paridade com dourados.ts e oportunidades.ts)', () => {
  it('a roda nova dos dourados: o mesmo tipo em 20 mil segundos, dois jogadores', async () => {
    const ini = 1_760_000_000;
    for (const u of [A, B]) {
      const sql = await q<{ t: number }>(
        'select public.idle_dourado_tipo($1::uuid, s) as t from generate_series($2::bigint, $3::bigint) s order by s', [u, ini, ini + 19_999]);
      expect(sql.map((x) => x.t)).toEqual(Array.from({ length: 20_000 }, (_, i) => tipoDourado(u, ini + i)));
    }
  });
  it('o garantido, o segundo do Pix, a sorte do Tigrinho e o sorteio do LinkedIn são os mesmos', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ g: number; p: string; tg: boolean; l: number }>(
      `select public.idle_dourado_tipo_garantido($1::uuid, s) as g, public.idle_dourado_pix_seg($1::uuid, s)::text as p,
              public.idle_dourado_tigre_paga($1::uuid, s) as tg, public.idle_dourado_sorteio($1::uuid, s, 5151, 5) as l
         from generate_series($2::bigint, $3::bigint) s order by s`, [A, ini, ini + 4999]);
    expect(sql).toEqual(Array.from({ length: 5000 }, (_, i) => ({
      g: tipoGarantido(A, ini + i), p: String(segundoPix(A, ini + i)), tg: tigrePaga(A, ini + i), l: sorteioDourado(A, ini + i, 5151, 5),
    })));
  });
  it('a roda da Caixinha com o corte: o mesmo tipo em 4 mil janelas em volta de OPP_CORTE, dois jogadores', async () => {
    for (const u of [A, B]) {
      const sql = await q<{ k: number }>(
        'select public.idle_opp_kind($1::uuid, w) as k from generate_series($2::bigint, $3::bigint) w order by w', [u, OPP_CORTE - 2000, OPP_CORTE + 1999]);
      expect(sql.map((x) => x.k)).toEqual(Array.from({ length: 4000 }, (_, i) => tipo(u, OPP_CORTE - 2000 + i)));
    }
  });
  it('o corte é o mesmo número no TS e no SQL', () => {
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0076_fellas_inc_dourados_caixinha.sql'), 'utf8');
    expect(sql).toContain(`when w < ${OPP_CORTE} then`);
  });
  it('a faixa do MC V.V nunca dá Tigrinho no banco também', async () => {
    let seg = 1_760_000_000;
    while (tipoDourado(A, seg) !== 7 || derrubada(A, seg - 7200, 1)) seg++;
    await abrir();
    await q(`update public.idle_state set generators[13] = 1, conv_cadeira = '{9,null,null}',
               conv_desde = array[to_timestamp($2::double precision), null, null]::timestamptz[] where user_id = $1`, [A, seg - 7200]);
    const [{ f }] = await q<{ f: number }>('select public.idle_conv_faixa(s, $2) as f from public.idle_state s where user_id = $1', [A, seg]);
    expect(f).toBe(0);
  });
  it('idle_rate_at soma idle_gen_rendas e dá o mesmo que a conta da 0066', async () => {
    await t.db.exec(RATE_0066);
    await abrir();
    for (const set of [
      'generators[1] = 10',
      `generators[1:6] = '{50,40,30,20,10,5}', upgrades = '{11,12,21,1001}'`,
      `generators[1:12] = '{200,150,120,90,80,60,50,40,30,20,10,5}', strategies = '{0,1,-1,-1}', upgrades = '{11,12,13,21,22,31,1001,1002}'`,
    ]) {
      await q(`update public.idle_state set ${set} where user_id = $1`, [A]);
      const [r] = await q<{ novo: number; velho: number; soma: number }>(
        `select public.idle_rate_at(s, now()) as novo, public.idle_rate_at_0066(s, now()) as velho,
                (select sum(x.renda) from public.idle_gen_rendas(s, now()) x) as soma
           from public.idle_state s where user_id = $1`, [A]);
      expect(r.novo).toBe(r.soma);
      expect(Math.abs(r.novo / r.velho - 1)).toBeLessThan(1e-12);
    }
  });
  it('LinkedIn: o mesmo gerador e o mesmo f (idle_linkedin × escolhaLinkedin com as rendas do banco); a página ordena igual', async () => {
    await abrir();
    await q(`update public.idle_state set generators[1:8] = '{120,80,60,40,30,20,10,5}', upgrades = '{11,12,21,31}' where user_id = $1`, [A]);
    const [{ r }] = await q<{ r: number[] }>(
      'select array(select x.renda from public.idle_gen_rendas(s, now()) x order by x.gen) as r from public.idle_state s where user_id = $1', [A]);
    const ini = 1_760_000_000;
    const sql = await q<{ gen: number; f: number }>(
      `select l.gen, l.f from generate_series($2::bigint, $3::bigint) seg cross join public.idle_state s
         cross join lateral public.idle_linkedin(s, seg) l where s.user_id = $1 order by seg`, [A, ini, ini + 299]);
    expect(sql).toHaveLength(300);
    sql.forEach((x, i) => {
      const e = escolhaLinkedin(A, ini + i, r)!;
      expect(x.gen).toBe(e.gen);
      expect(x.f).toBeCloseTo(e.f, 12);
    });
    const s = await t.rpc<IdleState>('idle_open');
    const ts = rendasGeradores(catalogo, s);
    const soma = (v: number[]) => v.reduce((a, x) => a + x, 0);
    ts.forEach((x, i) => expect(x / soma(ts)).toBeCloseTo(r[i] / soma(r), 12));
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts`
Expected: FAIL (o arquivo 0076 não existe).

- [ ] **Step 6: 0076, parte A (a sorte)**

Crie `supabase/migrations/0076_fellas_inc_dourados_caixinha.sql`:

```sql
-- fellasapp: Fellas Inc., dourados novos e oportunidades novas na Caixinha (15/10, entrega 5 do plano das eras 6–12).
-- Quatro dourados novos (Trend do TikTok, Bombou no LinkedIn, Pix errado, Tigrinho), o Combo e os dourados garantidos;
-- cinco tipos novos na Caixinha (Chamar um dourado, Cupom de primeira compra, Adubo de farmácia, Cashback, Informação
-- privilegiada) e o Espiar da Bolsa. A sorte é a de dourados.ts e oportunidades.ts (semente id + segundo/janela); o banco
-- confere e paga. Spec: docs/superpowers/specs/2026-10-15-fellas-inc-dourados-caixinha-design.md. Idempotente.

-- ===== parte A: a sorte =====
-- a 3ª mistura do segundo s (igual a dourados.ts h3): o tipo e os sorteios dos dourados novos saem dela
create or replace function public.idle_dourado_h3(u uuid, s bigint)
returns numeric language plpgsql immutable set search_path = public as $$
declare
  p constant numeric := 2147483647;
  k constant numeric := 1013904223;
  h numeric;
begin
  h := mod(s::numeric * s * 48271 + s::numeric * 16807 + public.idle_opp_seed(u)::numeric * 69621 + 12345, p);
  h := mod(h * h + k, p);
  return mod(h * h + k, p);
end;
$$;
revoke all on function public.idle_dourado_h3(uuid, bigint) from public, anon, authenticated;

-- o tipo do segundo s (o da 0051) com a roda de 8 (igual a tipoDourado): dupla 0–1, Viralizou 2–14, Promoção 15–32,
-- Investidor 33–57, Trend 58–69, LinkedIn 70–81, Pix 82–91, Tigrinho 92–99
create or replace function public.idle_dourado_tipo(u uuid, s bigint)
returns int language sql immutable set search_path = public as $$
  select case when x.r < 2 then 3 when x.r < 15 then 2 when x.r < 33 then 1 when x.r < 58 then 0
              when x.r < 70 then 4 when x.r < 82 then 5 when x.r < 92 then 6 else 7 end
    from (select mod(public.idle_dourado_h3(u, s), 100)::int as r) x
$$;
revoke all on function public.idle_dourado_tipo(uuid, bigint) from public, anon, authenticated;

-- um sorteio de 0 a n − 1 do segundo s com o "sal" de cada uso (igual a sorteioDourado): 4242 Tigrinho, 5151 LinkedIn,
-- 6161 Pix (7373, a frase do LinkedIn, é só da página)
create or replace function public.idle_dourado_sorteio(u uuid, s bigint, sal int, n int)
returns int language sql immutable set search_path = public as $$
  select mod(mod((x.h + sal) * (x.h + sal) + 1013904223, 2147483647), n)::int from (select public.idle_dourado_h3(u, s) as h) x
$$;
revoke all on function public.idle_dourado_sorteio(uuid, bigint, int, int) from public, anon, authenticated;

-- o tipo de um dourado garantido (Pix devolvido, Chamar): a roda sem Pix e sem Tigrinho (sobrando 6 ou 7: Investidor)
create or replace function public.idle_dourado_tipo_garantido(u uuid, s bigint)
returns int language sql immutable set search_path = public as $$
  select case when x.t >= 6 then 0 else x.t end from (select public.idle_dourado_tipo(u, s) as t) x
$$;
revoke all on function public.idle_dourado_tipo_garantido(uuid, bigint) from public, anon, authenticated;

-- Pix devolvido no segundo s: o segundo do garantido em dobro, de 20 a 120 s depois (igual a segundoPix)
create or replace function public.idle_dourado_pix_seg(u uuid, s bigint)
returns bigint language sql immutable set search_path = public as $$
  select s + 20 + public.idle_dourado_sorteio(u, s, 6161, 101)
$$;
revoke all on function public.idle_dourado_pix_seg(uuid, bigint) from public, anon, authenticated;

-- Tigrinho depois das 3 grátis do dia: paga 3 em cada 10 (igual a tigrePaga)
create or replace function public.idle_dourado_tigre_paga(u uuid, s bigint)
returns boolean language sql immutable set search_path = public as $$
  select public.idle_dourado_sorteio(u, s, 4242, 100) < 30
$$;
revoke all on function public.idle_dourado_tigre_paga(uuid, bigint) from public, anon, authenticated;

-- a faixa do MC V.V no segundo seg (a da 0051): nunca Tigrinho (o 7 vira Investidor)
create or replace function public.idle_conv_faixa(s public.idle_state, seg bigint)
returns int language plpgsql immutable set search_path = public as $$
declare
  p     double precision := public.idle_conv_peso(s, 9);
  d     timestamptz := public.idle_conv_desde(s, 9);
  ds    bigint;
  passo bigint;
  t     int;
begin
  if p <= 0 or d is null then
    return null;
  end if;
  ds := floor(extract(epoch from d))::bigint;
  passo := round(7200 / p)::bigint;
  if seg - ds < passo or mod(seg - ds, passo) <> 0
     or public.idle_horta_sorte(s.user_id, 50, ds + (seg - ds) / passo, 9) < 0.25 then
    return null;
  end if;
  t := public.idle_dourado_tipo(s.user_id, seg);
  return case when t = 7 then 0 else t end;
end;
$$;
revoke all on function public.idle_conv_faixa(public.idle_state, bigint) from public, anon, authenticated;

-- o tipo da janela w (o da 0049): antes do corte (2987010 = 17/10/2026 0h de Brasília; igual a OPP_CORTE, acertado no
-- dia do db push) os 3 de sempre (% 3); depois, a roda de 8 (% 100): 0–17 · 18–33 · 34–49 · 50–59 · 60–71 · 72–80 ·
-- 81–90 · 91–99
create or replace function public.idle_opp_kind(u uuid, w bigint)
returns int language sql immutable set search_path = public as $$
  select case when w < 2987010 then mod(x.h2, 3)::int
              else (case when mod(x.h2, 100) < 18 then 0 when mod(x.h2, 100) < 34 then 1 when mod(x.h2, 100) < 50 then 2
                         when mod(x.h2, 100) < 60 then 3 when mod(x.h2, 100) < 72 then 4 when mod(x.h2, 100) < 81 then 5
                         when mod(x.h2, 100) < 91 then 6 else 7 end) end
    from (select mod(z.v * z.v + 1013904223, 2147483647) as h2 from (select public.idle_opp_sorte(u, w) as v) z) x
$$;
revoke all on function public.idle_opp_kind(uuid, bigint) from public, anon, authenticated;

-- quanto cada gerador rende em t, com todos os multiplicadores da produção (a conta da idle_rate_at da 0066, gerador por
-- gerador): a soma é a produção; o LinkedIn sorteia entre os que mais rendem
create or replace function public.idle_gen_rendas(s public.idle_state, t timestamptz)
returns table (gen int, renda double precision) language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), glob as (
    select coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
         * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
         * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
              * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
         * public.idle_social_mult(s, t)
         * public.idle_bonus_mult(s)
         * (1 + (select b.producao from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), t) b))
         * public.idle_conv_prod(s, t)
         * public.idle_place_mult(s) as g
  )
  select c.id,
         c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1)
         * case when c.id = 11 then public.idle_conv_food(s, t) else 1 end
         * glob.g
    from public.idle_cat_gen c cross join glob
$$;
revoke all on function public.idle_gen_rendas(public.idle_state, timestamptz) from public, anon, authenticated;

-- produção em t (a da 0066): a soma de idle_gen_rendas (o mesmo número)
create or replace function public.idle_rate_at(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  select coalesce(sum(r.renda), 0) from public.idle_gen_rendas(s, t) r
$$;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;

-- Bombou no LinkedIn no segundo seg: o gerador sorteado entre os até 5 que mais rendem agora (>0; empate: o de id menor)
-- e a parte dele na soma (igual a escolhaLinkedin). Sem renda nenhuma: nenhuma linha.
create or replace function public.idle_linkedin(s public.idle_state, seg bigint)
returns table (gen int, f double precision) language sql stable set search_path = public as $$
  with r as (select x.gen, x.renda from public.idle_gen_rendas(s, now()) x where x.renda > 0),
       tot as (select sum(r.renda) as soma from r),
       top as (select r.gen, r.renda, (row_number() over (order by r.renda desc, r.gen) - 1)::int as i from r),
       n as (select count(*)::int as n from top where top.i < 5)
  select top.gen, top.renda / tot.soma from top, tot, n
   where n.n > 0 and top.i = public.idle_dourado_sorteio(s.user_id, seg, 5151, n.n)
$$;
revoke all on function public.idle_linkedin(public.idle_state, bigint) from public, anon, authenticated;
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts test/idleDourado.test.ts test/idleConvidados.test.ts test/idleOportunidadesSorte.test.ts test/idleParidade.test.ts test/idle.test.ts test/idleArvore.test.ts`
Expected: PASS.

- [ ] **Step 7: O resto dos testes do idle**

Run: `cd games && npx vitest run --maxWorkers=4 idle && npx tsc --noEmit`
Expected: PASS. (O `tela.test.ts` procura oportunidades a partir da janela 50, bem antes do corte: continua com os 3 tipos.)

- [ ] **Step 8: Commit**

```bash
git add games/idle/dourados.ts games/idle/dourados.test.ts games/idle/convidados.ts games/idle/convidados.test.ts games/idle/oportunidades.ts games/idle/oportunidades.test.ts games/idle/economia.ts games/idle/economia.test.ts games/idle/valorMedio.ts games/idle/valorMedio.test.ts games/idle/ativos.ts games/idle/dica.ts games/idle/douradoTela.ts supabase/migrations/0076_fellas_inc_dourados_caixinha.sql games/test/db.ts games/dev/mockDb.ts games/test/idle.test.ts games/test/idleArvore.test.ts games/test/idleDouradosCaixinha.test.ts
git commit -m "Fellas Inc.: a sorte dos dourados novos e da Caixinha nova (página e banco iguais) e o ganho médio"
```

---

### Task 3: Estado, conta e compra (banco + as contas puras da página)

Só lógica: nada aqui mexe em `tela.ts`, `idle.css` nem `main.ts` (os preços com cupom e o re-render do cashback na tela vêm na Task 7).

**Files:**
- Modify: `supabase/migrations/0076_fellas_inc_dourados_caixinha.sql` (parte B)
- Modify: `games/shared/types.ts` (`IdleState`, tipos `Garantido` e `DouradoPago`)
- Modify: `games/idle/economia.ts:227-282` (`produzido`, `acumular`, `acumularTrechos`)
- Modify: `games/idle/store.ts:24-31` (`fatoresTempo`, `valuationAgora`)
- Modify: `games/idle/oportunidades.ts` (`cupomVale`, `cashbackAtivo`)
- Modify: `games/idle/dourados.ts:73-74` (`viraisAtivos` só com os que começaram) e `selosBonus` (repassa `viralMs`)
- Modify: `games/idle/dica.ts` (`dicaGerador`/`dicaMelhoria` com o cashback; `dicaProducao` com LinkedIn, Combo e os Viralizou que começaram)
- Test: `games/idle/economia.test.ts`, `games/idle/store.test.ts`, `games/idle/oportunidades.test.ts`, `games/idle/dourados.test.ts`, `games/idle/dica.test.ts`, `games/test/idleDouradosCaixinha.test.ts`

**Interfaces:**
- Consumes: Task 2 (`COMBO_MULT`, `CUPOM_FATOR`, `CASHBACK`).
- Produces (TS): em `types.ts`: `export type Garantido = { seg: number; tipo: number; dobro: boolean }`; `export type DouradoPago = { tipo: number; lado: number; ganho: number; dobro: boolean; moedas: number; gen: number | null; mult: number | null; garantido_seg: number | null; tigre: { pagou: boolean; gratis: boolean; perdeu: number; n: number } | null; combo: boolean }`; `IdleState` ganha, todos opcionais: `linkedin_ate?: string | null; linkedin_gen?: number | null; linkedin_mult?: number | null; combo_ate?: string | null; combo_n?: number; combo_seg?: number | null; garantidos?: Garantido[]; tigre_n?: number; chamados?: number; cupons?: number; cashback_ate?: string | null; info_creditos?: number; dourados_cont?: Record<string, number>; horta_crescendo?: number; dourado?: DouradoPago`. `export type FatorTempo = { ateMs: number; mult: number }` e `produzido(r, a, b, boostAteMs, virais = [], viralMs = VIRAL_MS, marmitaAteMs = null, outros: readonly FatorTempo[] = [])` (o mesmo `outros` no fim de `acumular` e `acumularTrechos`) em `economia.ts`. `fatoresTempo(s): FatorTempo[]` em `store.ts`. `cupomVale(s: { cupons?: number; promo_ate: string | null }, agoraMs): boolean` e `cashbackAtivo(s: { cashback_ate?: string | null }, agoraMs): boolean` em `oportunidades.ts`. `viraisAtivos(s, agoraMs, viralMs = VIRAL_MS)`; `selosBonus(s, agoraMs, o: { viralMs?: number } = {})` (a Task 6 acrescenta mais opções). `dicaGerador(s, gid, precoProximo, cashback = 0)`, `dicaMelhoria(s, m, preco, cashback = 0)` (`cashback` = a fração que volta, 0,3 com o Cashback valendo).
- Produces (SQL): as colunas novas de `idle_state` (spec, seção 3); `idle_cont_mais(c jsonb, k text, n double precision) jsonb`; `idle_settle` com LinkedIn e Combo; `idle_save`/`idle_json`/`idle_prestige` com os campos novos (`idle_json` também devolve `horta_crescendo`); `idle_buy` com cupom e cashback.

- [ ] **Step 1: Testes TS (falham)**

Em `games/idle/economia.test.ts`:

```ts
describe('LinkedIn e Combo no produzido (0076)', () => {
  it('cada fator multiplica tudo até o fim dele, por cima do resto', () => {
    // r = 1/s, de 0 a 100 s; Combo ×7 até 30 s: 30·7 + 70 = 280
    expect(produzido(1, 0, 100_000, null, [], VIRAL_MS, null, [{ ateMs: 30_000, mult: 7 }])).toBeCloseTo(280, 6);
    // LinkedIn ×4,5 até 40 s e Combo ×7 até 30 s: 30·31,5 + 10·4,5 + 60 = 1050
    expect(produzido(1, 0, 100_000, null, [], VIRAL_MS, null, [{ ateMs: 40_000, mult: 4.5 }, { ateMs: 30_000, mult: 7 }])).toBeCloseTo(1050, 6);
    // ×5 até 20 s, Viralizou até 60 s, Marmita até 50 s e Combo até 30 s:
    // 20·(5·10·3·7) + 10·(10·3·7) + 20·(10·3) + 10·10 + 40·1 = 21000 + 2100 + 600 + 100 + 40 = 23840
    expect(produzido(1, 0, 100_000, [20_000], [60_000], VIRAL_MS, 50_000, [{ ateMs: 30_000, mult: 7 }])).toBeCloseTo(23_840, 6);
  });
  it('fator que já acabou (ou lista vazia) é a conta de antes', () => {
    expect(produzido(2, 50_000, 60_000, null, [], VIRAL_MS, null, [{ ateMs: 40_000, mult: 7 }])).toBeCloseTo(20, 6);
    expect(acumular(5, 2, 0, 10_000, null, [], VIRAL_MS, null, [])).toBeCloseTo(25, 6);
  });
});
```

Em `games/idle/store.test.ts` (import `fatoresTempo` de `./store` e `type IdleState`):

```ts
describe('fatoresTempo (0076)', () => {
  it('LinkedIn com o mult do banco e Combo ×7; ausentes (página nova, banco velho) não contam', () => {
    const s = { linkedin_ate: '2026-10-15T12:01:00Z', linkedin_mult: 4.5, combo_ate: '2026-10-15T12:00:30Z' } as IdleState;
    expect(fatoresTempo(s)).toEqual([
      { ateMs: Date.parse('2026-10-15T12:01:00Z'), mult: 4.5 }, { ateMs: Date.parse('2026-10-15T12:00:30Z'), mult: 7 },
    ]);
    expect(fatoresTempo({} as IdleState)).toEqual([]);
    expect(fatoresTempo({ linkedin_ate: null, linkedin_mult: null, combo_ate: null } as IdleState)).toEqual([]);
  });
});
```

Em `games/idle/oportunidades.test.ts` (import `cashbackAtivo, cupomVale`):

```ts
describe('cupom e cashback valendo (0076)', () => {
  const agora = Date.parse('2026-10-15T12:00:00Z');
  it('cupom: com cupons e sem Promoção; campo ausente = sem', () => {
    expect(cupomVale({ cupons: 3, promo_ate: null }, agora)).toBe(true);
    expect(cupomVale({ cupons: 3, promo_ate: '2026-10-15T12:00:10Z' }, agora)).toBe(false);
    expect(cupomVale({ cupons: 0, promo_ate: null }, agora)).toBe(false);
    expect(cupomVale({ promo_ate: null }, agora)).toBe(false);
  });
  it('cashback: até o fim; ausente ou null = sem', () => {
    expect(cashbackAtivo({ cashback_ate: '2026-10-15T12:01:00Z' }, agora)).toBe(true);
    expect(cashbackAtivo({ cashback_ate: '2026-10-15T11:59:00Z' }, agora)).toBe(false);
    expect(cashbackAtivo({}, agora)).toBe(false);
  });
});
```

Em `games/idle/dourados.test.ts`, no `describe('selos e textos')`:

```ts
  it('Viralizou em dobro (dois fins encadeados): só o que já começou conta no selo', () => {
    expect(selosBonus({ promo_ate: null, viral: [em(30), em(90)] }, T)).toEqual([{ texto: '×10 · 0:30', ouro: false }]);
    expect(selosBonus({ promo_ate: null, viral: [em(30), em(90)] }, T + 31_000)).toEqual([{ texto: '×10 · 0:59', ouro: false }]);
  });
```

Em `games/idle/dica.test.ts`:

```ts
describe('cashback e os bônus novos nas caixinhas (0076)', () => {
  it('com o Cashback valendo, a caixinha do gerador e a da melhoria dizem quanto volta', () => {
    const s = comTaxa({ generators: gens({ 1: 10 }) });
    expect(textos(dicaGerador(s, 1, 1000, 0.3))).toContain(`Cashback: volta ${formatarValor(300)}`);
    expect(textos(dicaGerador(s, 1, 1000)).some((t) => t.startsWith('Cashback'))).toBe(false);
    const m = catalogo.melhorias.find((x) => x.id === 11)!;
    expect(textos(dicaMelhoria(s, m, 2000, 0.3))).toContain(`Cashback: volta ${formatarValor(600)}`);
  });
  it('a produção mostra o LinkedIn e o Combo valendo; o Viralizou que ainda não começou não conta', () => {
    const agora = Date.parse('2026-10-12T12:00:00.000Z');
    const em = (s: number) => new Date(agora + s * 1000).toISOString();
    const t = textos(dicaProducao(comTaxa({ generators: gens({ 1: 10 }), linkedin_ate: em(30), linkedin_mult: 4.5, combo_ate: em(20), viral: [em(30), em(90)] }), agora));
    expect(t).toContain('Agora: ×4,5 do LinkedIn');
    expect(t).toContain('Agora: ×7 do Combo');
    expect(t).toContain('Agora: ×10 do Viralizou');
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/store.test.ts idle/oportunidades.test.ts idle/dourados.test.ts idle/dica.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implementar no TS**

`games/shared/types.ts`, no `IdleState`, depois de `evento?: EventoPago;`:

```ts
  /** Dourados novos e Caixinha nova (0076). Ausentes (banco de antes da 0076) = nada valendo. LinkedIn: até quando, o
   *  gerador e o multiplicador da produção toda (1 + 29·f, congelado no clique). */
  linkedin_ate?: string | null; linkedin_gen?: number | null; linkedin_mult?: number | null;
  /** Combo ×7 até aqui; quantos pegos seguidos já tem e o segundo do último. */
  combo_ate?: string | null; combo_n?: number; combo_seg?: number | null;
  /** Dourados garantidos (Pix devolvido, Chamar) ainda por aparecer ou na tela. */
  garantidos?: Garantido[];
  /** Jogadas no Tigrinho hoje (0 se a última foi outro dia). */
  tigre_n?: number;
  /** O que a Caixinha guardou: dourados pra chamar (até 3), cupons, créditos de Espiar; o Cashback até quando. */
  chamados?: number; cupons?: number; info_creditos?: number; cashback_ate?: string | null;
  /** Contadores das conquistas (trend_max, pix_dev, tigre_perdeu, tigre_seq, combos, cupons, cashback); não zeram na venda. */
  dourados_cont?: Record<string, number>;
  /** Plantas crescendo nos canteiros abertos (o Adubo de farmácia precisa de uma). */
  horta_crescendo?: number;
  /** Só na resposta de idle_dourado_pegar: o que saiu. */
  dourado?: DouradoPago;
```

e, no mesmo arquivo, junto de `EventoPago`:

```ts
/** Um dourado garantido (0076): o segundo em que aparece, o tipo e se rende o dobro (o do Pix devolvido). */
export type Garantido = { seg: number; tipo: number; dobro: boolean };
/** O que o banco pagou ao pegar um dourado (0076). `lado` é a escolha no Pix (0 ficar, 1 devolver); `gen`/`mult` o
 *  LinkedIn; `garantido_seg` o segundo do garantido do Pix devolvido; `tigre` a jogada; `combo` = fechou um Combo agora. */
export type DouradoPago = {
  tipo: number; lado: number; ganho: number; dobro: boolean; moedas: number; gen: number | null; mult: number | null;
  garantido_seg: number | null; tigre: { pagou: boolean; gratis: boolean; perdeu: number; n: number } | null; combo: boolean;
};
```

`games/idle/economia.ts`, troque `produzido`, `acumular` e `acumularTrechos` por:

```ts
/** Um bônus com tempo que multiplica a produção toda até `ateMs` (LinkedIn, Combo; 0076). Começou antes de `a` (pegar
 *  fecha a conta), então só o fim importa. */
export type FatorTempo = { ateMs: number; mult: number };

/**
 * r × Σ(multiplicador × tempo) entre `a` e `b` (ms): os ×5 das oportunidades no ar SOMAM entre si (dois = ×10, três =
 * ×15) e o total multiplica com os Viralizou (×10 cada, dois = ×100), sem teto; a Marmita (×3) e os `outros` (LinkedIn,
 * Combo) multiplicam por cima. Divide nos pontos em que um começa ou acaba. Igual a idle_settle na 0076.
 */
export function produzido(
  r: number, a: number, b: number, boostAteMs: Boosts, virais: readonly number[] = [], viralMs = VIRAL_MS,
  marmitaAteMs: number | null = null, outros: readonly FatorTempo[] = [],
): number {
  if (b <= a) return 0;
  const boosts = listaBoosts(boostAteMs);
  const pontos = [a, b];
  for (const f of boosts) if (f > a && f < b) pontos.push(f);
  for (const f of virais) for (const x of [f - viralMs, f]) if (x > a && x < b) pontos.push(x);
  if (marmitaAteMs !== null && marmitaAteMs > a && marmitaAteMs < b) pontos.push(marmitaAteMs);
  for (const o of outros) if (o.ateMs > a && o.ateMs < b) pontos.push(o.ateMs);
  pontos.sort((x, y) => x - y);
  let total = 0;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const p = pontos[i];
    const q = pontos[i + 1];
    if (q <= p) continue;
    const meio = (p + q) / 2;
    const k = virais.filter((f) => f - viralMs <= meio && f > meio).length;
    const kb = boosts.filter((f) => f > meio).length;
    const m = (kb ? 5 * kb : 1) * 10 ** k * (marmitaAteMs !== null && marmitaAteMs > meio ? 3 : 1)
      * outros.reduce((x, o) => (o.ateMs > meio ? x * o.mult : x), 1);
    total += (r * m * (q - p)) / 1000;
  }
  return total;
}

/** Valuation depois de render de `desdeMs` até `ateMs`, sem limite (desde 13/10 o jogo fechado rende tudo). */
export function acumular(
  v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: Boosts, virais: readonly number[] = [], viralMs = VIRAL_MS,
  marmitaAteMs: number | null = null, outros: readonly FatorTempo[] = [],
): number {
  return v + produzido(r, desdeMs, Math.max(ateMs, desdeMs), boostAteMs, virais, viralMs, marmitaAteMs, outros);
}

/**
 * Como `acumular`, mas a taxa troca no meio (um contrato vencendo): `trechos` = [{ desdeMs, r }] em ordem, o primeiro
 * começando em `desdeMs`. Igual a idle_settle: os bônus em cada trecho.
 */
export function acumularTrechos(
  v: number, trechos: { desdeMs: number; r: number }[], desdeMs: number, ateMs: number, boostAteMs: Boosts,
  virais: readonly number[] = [], viralMs = VIRAL_MS, marmitaAteMs: number | null = null, outros: readonly FatorTempo[] = [],
): number {
  for (let i = 0; i < trechos.length; i++) {
    const a = Math.max(trechos[i].desdeMs, desdeMs);
    const b = Math.min(i + 1 < trechos.length ? trechos[i + 1].desdeMs : ateMs, ateMs);
    v += produzido(trechos[i].r, a, b, boostAteMs, virais, viralMs, marmitaAteMs, outros);
  }
  return v;
}
```

`games/idle/store.ts` (import `COMBO_MULT` de `./dourados` e `type FatorTempo` de `./economia`):

```ts
/** Os bônus com tempo do estado que multiplicam a produção toda (0076): LinkedIn (o mult que o banco congelou) e Combo. */
export function fatoresTempo(s: Pick<IdleState, 'linkedin_ate' | 'linkedin_mult' | 'combo_ate'>): FatorTempo[] {
  const out: FatorTempo[] = [];
  if (s.linkedin_ate && s.linkedin_mult) out.push({ ateMs: Date.parse(s.linkedin_ate), mult: s.linkedin_mult });
  if (s.combo_ate) out.push({ ateMs: Date.parse(s.combo_ate), mult: COMBO_MULT });
  return out;
}
```

e, em `valuationAgora`, a chamada passa `fatoresTempo(a.estado)` como último argumento de `acumular`.

`games/idle/oportunidades.ts`, depois das constantes da Task 2:

```ts
/** Cupom valendo na compra de gerador: tem cupom e a Promoção não está ligada (com ela o cupom fica guardado). */
export const cupomVale = (s: { cupons?: number; promo_ate: string | null }, agoraMs: number) =>
  (s.cupons ?? 0) > 0 && !(s.promo_ate !== null && Date.parse(s.promo_ate) > agoraMs);
/** Cashback valendo (toda compra devolve 30%). */
export const cashbackAtivo = (s: { cashback_ate?: string | null }, agoraMs: number) => !!s.cashback_ate && Date.parse(s.cashback_ate) > agoraMs;
```

`games/idle/dourados.ts`: import `VIRAL_MS` de `./economia`;

```ts
/** Os fins dos Viralizou que estão valendo (ms), em ordem. Cada um vale [fim − viralMs, fim): o Viralizou em dobro são
 *  dois fins encadeados e o 2º só conta quando o 1º acaba (0076). */
export const viraisAtivos = (s: ComBonus, agoraMs: number, viralMs = VIRAL_MS) =>
  (s.viral ?? []).map(Date.parse).filter((f) => f > agoraMs && f - viralMs <= agoraMs).sort((a, b) => a - b);
```

e `selosBonus` ganha o 3º parâmetro `o: { viralMs?: number } = {}` com `const v = viraisAtivos(s, agoraMs, o.viralMs);`.

`games/idle/dica.ts`: `dicaGerador(s, gid, precoProximo, cashback = 0)` acrescenta, depois da linha "O próximo custa": `if (cashback > 0) linhas.push({ texto: \`Cashback: volta ${formatarValor(precoProximo * cashback)}\`, tom: 'bom' });`. `dicaMelhoria(s, m, preco, cashback = 0)` acrescenta a mesma linha (com `preco`) depois de "Custa", só quando `preco !== null`. Em `dicaProducao` (import `COMBO_MULT` de `./dourados`, `efeitosDe` e `VIRAL_MS` de `./economia`), troque a conta dos virais e acrescente as duas linhas depois da Marmita:

```ts
  const vMs = VIRAL_MS * efeitosDe(catalogo, s).douradoDuracao;
  const virais = s.viral.filter((t) => { const f = Date.parse(t); return f > agoraMs && f - vMs <= agoraMs; }).length;
  ...
  if (s.linkedin_ate && Date.parse(s.linkedin_ate) > agoraMs) linhas.push({ texto: `Agora: ×${num(s.linkedin_mult ?? 1)} do LinkedIn`, tom: 'bom' });
  if (s.combo_ate && Date.parse(s.combo_ate) > agoraMs) linhas.push({ texto: `Agora: ×${COMBO_MULT} do Combo`, tom: 'bom' });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/store.test.ts idle/oportunidades.test.ts idle/dourados.test.ts idle/dica.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Testes do banco (falham)**

Em `games/test/idleDouradosCaixinha.test.ts`, acrescente `import { produzido, VIRAL_MS } from '../idle/economia';` (junto do `rendasGeradores`) e:

```ts
describe('o estado, a conta e a compra (0076, parte B)', () => {
  beforeEach(abrir);
  const comprar = async (kind: string, id: number, qtd = 1) => {
    const antes = await valor();
    const s = await t.rpc<J>('idle_buy', { p_kind: kind, p_id: id, p_qty: qtd });
    return { gasto: antes - s.valuation, s };
  };
  /** Preço de k do gerador 2 agora, com o custo × fator (0,75 = cupom, 0,5 = Promoção). */
  const precoGen = async (k: number, fator = 1) => (await q<{ p: number }>(
    `select public.idle_price(c.custo, s.generators[2], $2, public.idle_cost_mult(s) * $3) as p
       from public.idle_cat_gen c, public.idle_state s where c.id = 2 and s.user_id = $1`, [A, k, fator]))[0].p;

  it('fechar a conta com LinkedIn e Combo é igual a produzido (sozinhos e com ×5, Viralizou e Marmita)', async () => {
    const casos: (number | null)[][] = [
      [40, null, null, null, null], [null, 30, null, null, null], [40, 30, 20, null, null], [40, 30, null, 60, null], [40, 30, null, null, 50],
    ];
    for (const [li, co, boost, viral, marmita] of casos) {
      await q(`update public.idle_state set settled_at = now(),
                 linkedin_ate = case when $2::int is null then null else now() + make_interval(secs => $2) end, linkedin_mult = 4.5,
                 combo_ate = case when $3::int is null then null else now() + make_interval(secs => $3) end,
                 boost_ate = case when $4::int is null then '{}' else array[now() + make_interval(secs => $4)] end,
                 viral_ate = case when $5::int is null then '{}' else array[now() + make_interval(secs => $5)] end,
                 marmita_ate = case when $6::int is null then null else now() + make_interval(secs => $6) end
               where user_id = $1`, [A, li, co, boost, viral, marmita]);
      const r = await taxa();
      const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
        `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
           from public.idle_state s where user_id = $1`, [A]);
      const outros = [...(li === null ? [] : [{ ateMs: li * 1000, mult: 4.5 }]), ...(co === null ? [] : [{ ateMs: co * 1000, mult: 7 }])];
      const esperado = produzido(r, 0, 100_000, boost === null ? null : [boost * 1000], viral === null ? [] : [viral * 1000], VIRAL_MS,
        marmita === null ? null : marmita * 1000, outros);
      expect(v1 - v0).toBeCloseTo(esperado, 0);
    }
  });
  it('cupom: gerador 25% mais barato no 1 e no 10, gasta 1 por compra; melhoria não gasta', async () => {
    await q('update public.idle_state set cupons = 2 where user_id = $1', [A]);
    let p = await precoGen(1, 0.75);
    let r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(p, 3);
    expect(r.s.cupons).toBe(1);
    p = await precoGen(10, 0.75);
    r = await comprar('gerador', 2, 10);
    expect(r.gasto).toBeCloseTo(p, 3);
    expect(r.s.cupons).toBe(0);
    p = await precoGen(1);
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(p, 3);
    await q('update public.idle_state set cupons = 1 where user_id = $1', [A]);
    r = await comprar('melhoria', 11);
    expect(r.s.cupons).toBe(1);
  });
  it('Máx com cupom: compra o que dá com o preço do cupom', async () => {
    const tres = await precoGen(3, 0.75);
    await q('update public.idle_state set cupons = 1, valuation = $2 where user_id = $1', [A, tres * 1.0000001]);
    const r = await comprar('gerador', 2, 0);
    expect(r.s.generators[1]).toBe(23);
    expect(r.s.cupons).toBe(0);
  });
  it('com Promoção o cupom fica guardado; com meia-preço a compra de 1 usa a meia e o cupom também fica (até 50%)', async () => {
    await q(`update public.idle_state set cupons = 3, promo_ate = now() + interval '30 seconds' where user_id = $1`, [A]);
    const meio = await precoGen(1, 0.5);
    let r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(meio, 3);
    expect(r.s.cupons).toBe(3);
    await q('update public.idle_state set promo_ate = null, meias = 1 where user_id = $1', [A]);
    const metade = (await precoGen(1)) / 2;
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(metade, 3);
    expect(r.s.cupons).toBe(3);
    expect(r.s.meias).toBe(0);
  });
  it('cashback: devolve 30% (gerador e melhoria) e soma no contador; com Promoção paga 35%; acabou há 0,5 s ainda vale', async () => {
    await q(`update public.idle_state set cashback_ate = now() + interval '60 seconds' where user_id = $1`, [A]);
    const cheio = await precoGen(1);
    let r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(cheio * 0.7, 3);
    const [{ upg }] = await q<{ upg: number }>('select preco as upg from public.idle_cat_upg where id = 11');
    r = await comprar('melhoria', 11);
    expect(r.gasto).toBeCloseTo(upg * 0.7, 3);
    expect(r.s.dourados_cont.cashback).toBeCloseTo(0.3 * (cheio + upg), 3);
    await q(`update public.idle_state set promo_ate = now() + interval '30 seconds' where user_id = $1`, [A]);
    const meio = await precoGen(1, 0.5);
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(meio * 0.7, 3); // 35% do cheio
    await q(`update public.idle_state set promo_ate = null, cashback_ate = now() - interval '500 milliseconds' where user_id = $1`, [A]);
    const deNovo = await precoGen(1);
    r = await comprar('gerador', 2);
    expect(r.gasto).toBeCloseTo(deNovo * 0.7, 3);
  });
  it('o JSON traz os campos novos e esconde o que já passou (Combo, garantido velho, jogadas de ontem)', async () => {
    const agora = await agoraSeg();
    await q(`update public.idle_state set linkedin_ate = now() + interval '1 minute', linkedin_gen = 2, linkedin_mult = 4.5,
               combo_ate = now() - interval '1 second', combo_n = 2, combo_seg = $2, cashback_ate = now() + interval '1 minute',
               garantidos = jsonb_build_array(jsonb_build_object('seg', $2 - 100, 'tipo', 0, 'dobro', true),
                                              jsonb_build_object('seg', $2 + 5, 'tipo', 2, 'dobro', false)),
               tigre_dia = public.games_today() - 1, tigre_n = 3, chamados = 2, cupons = 7, info_creditos = 1,
               dourados_cont = '{"pix_dev": 4}' where user_id = $1`, [A, agora]);
    const s = await t.rpc<J>('idle_open');
    expect(s).toMatchObject({ linkedin_gen: 2, linkedin_mult: 4.5, combo_ate: null, combo_n: 2, combo_seg: agora, tigre_n: 0,
      chamados: 2, cupons: 7, info_creditos: 1, dourados_cont: { pix_dev: 4 }, horta_crescendo: 0 });
    expect(s.linkedin_ate).not.toBeNull();
    expect(s.cashback_ate).not.toBeNull();
    expect(s.garantidos).toEqual([{ seg: agora + 5, tipo: 2, dobro: false }]);
  });
  it('vender a startup zera os bônus e os estoques novos; os contadores e o Tigrinho do dia ficam', async () => {
    await q(`update public.idle_state set linkedin_ate = now() + interval '1 minute', linkedin_gen = 2, linkedin_mult = 4.5,
               combo_ate = now() + interval '1 minute', combo_n = 2, combo_seg = 1, garantidos = '[{"seg": 1, "tipo": 0, "dobro": true}]',
               tigre_dia = public.games_today(), tigre_n = 3, chamados = 2, cupons = 7, cashback_ate = now() + interval '1 minute',
               info_creditos = 2, espiadas = jsonb_build_object('1', jsonb_build_object('ate_tick', 1, 'em', now())),
               dourados_cont = '{"pix_dev": 4}', prestige_earned = 0, valuation = 1e30, generators[20] = 50 where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const [l] = await q<Record<string, unknown>>(
      `select linkedin_ate, linkedin_gen, linkedin_mult, combo_ate, combo_n, combo_seg, garantidos, chamados, cupons, cashback_ate,
              info_creditos, espiadas, dourados_cont, tigre_n, tigre_dia = public.games_today() as tigre_hoje
         from public.idle_state where user_id = $1`, [A]);
    expect(l).toEqual({ linkedin_ate: null, linkedin_gen: null, linkedin_mult: null, combo_ate: null, combo_n: 0, combo_seg: null,
      garantidos: [], chamados: 0, cupons: 0, cashback_ate: null, info_creditos: 0, espiadas: {}, dourados_cont: { pix_dev: 4 },
      tigre_n: 3, tigre_hoje: true });
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts`
Expected: FAIL (as colunas não existem).

- [ ] **Step 4: 0076, parte B**

Acrescente à `0076_fellas_inc_dourados_caixinha.sql`:

```sql
-- ===== parte B: o estado, a conta e a compra =====
alter table public.idle_state
  add column if not exists linkedin_ate  timestamptz,
  add column if not exists linkedin_gen  int,
  add column if not exists linkedin_mult double precision,
  add column if not exists combo_ate     timestamptz,
  add column if not exists combo_n       int not null default 0,
  add column if not exists combo_seg     bigint,
  add column if not exists garantidos    jsonb not null default '[]',
  add column if not exists tigre_dia     date,
  add column if not exists tigre_n       int not null default 0,
  add column if not exists chamados      int not null default 0,
  add column if not exists cupons        int not null default 0,
  add column if not exists cashback_ate  timestamptz,
  add column if not exists info_creditos int not null default 0,
  add column if not exists espiadas      jsonb not null default '{}',
  add column if not exists dourados_cont jsonb not null default '{}';

-- soma n no contador k (trend_max, pix_dev, tigre_perdeu, tigre_seq, combos, cupons, cashback)
create or replace function public.idle_cont_mais(c jsonb, k text, n double precision)
returns jsonb language sql immutable set search_path = public as $$
  select coalesce(c, '{}'::jsonb) || jsonb_build_object(k, coalesce((c ->> k)::double precision, 0) + n)
$$;
revoke all on function public.idle_cont_mais(jsonb, text, double precision) from public, anon, authenticated;
```

Depois, **copie inteiras** as definições da 0074 e mude só o indicado:

1. `idle_settle` (0074). Comentário do topo: `-- fechar a conta (a da 0074) com o LinkedIn (1 + 29·f) e o Combo (×7)`. No `for v_q in select x from (...)`, antes de `union select v_b`:
   ```sql
                     union select s.linkedin_ate where s.linkedin_ate > v_a and s.linkedin_ate < v_b
                     union select s.combo_ate where s.combo_ate > v_a and s.combo_ate < v_b
   ```
   e o `v_mult` vira:
   ```sql
      v_mult := (case when v_kb > 0 then 5 * v_kb else 1 end) * 10 ^ v_k
                * (case when s.marmita_ate > v_meio then 3 else 1 end)
                -- LinkedIn e Combo (0076): começaram antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.linkedin_ate > v_meio then coalesce(s.linkedin_mult, 1) else 1 end)
                * (case when s.combo_ate > v_meio then 7 else 1 end);
   ```
2. `idle_save` (0074). Depois da linha `marmita_ate = s.marmita_ate, upg_desc_ate = …, eventos_era = …,`:
   ```sql
         linkedin_ate = s.linkedin_ate, linkedin_gen = s.linkedin_gen, linkedin_mult = s.linkedin_mult,
         combo_ate = s.combo_ate, combo_n = coalesce(s.combo_n, 0), combo_seg = s.combo_seg,
         -- os garantidos saem 60 s depois do segundo deles (a janela mais longa: 24 + 8 + 3 s)
         garantidos = coalesce((select jsonb_agg(g order by (g ->> 'seg')::bigint) from jsonb_array_elements(coalesce(s.garantidos, '[]'::jsonb)) g
                                 where (g ->> 'seg')::bigint + 60 > extract(epoch from now())), '[]'::jsonb),
         tigre_dia = s.tigre_dia, tigre_n = coalesce(s.tigre_n, 0),
         chamados = least(3, greatest(coalesce(s.chamados, 0), 0)), cupons = greatest(coalesce(s.cupons, 0), 0),
         cashback_ate = s.cashback_ate, info_creditos = greatest(coalesce(s.info_creditos, 0), 0),
         -- as espiadas valem 2 h (a conquista Insider olha esse tempo; o humor muda em até 120 min)
         espiadas = coalesce((select jsonb_object_agg(e.k, e.v) from jsonb_each(coalesce(s.espiadas, '{}'::jsonb)) e(k, v)
                               where (e.v ->> 'em')::timestamptz > now() - interval '2 hours'), '{}'::jsonb),
         dourados_cont = coalesce(s.dourados_cont, '{}'::jsonb),
   ```
3. `idle_prestige` (0074). Depois de `s.upg_desc_ate := null;`:
   ```sql
  -- 0076: os bônus e os estoques dos dourados e da Caixinha zeram; os contadores e o Tigrinho do dia (tigre_dia/tigre_n)
  -- ficam (vender não dá 3 jogadas grátis de novo)
  s.linkedin_ate := null;
  s.linkedin_gen := null;
  s.linkedin_mult := null;
  s.combo_ate := null;
  s.combo_n := 0;
  s.combo_seg := null;
  s.garantidos := '[]';
  s.chamados := 0;
  s.cupons := 0;
  s.cashback_ate := null;
  s.info_creditos := 0;
  s.espiadas := '{}';
   ```
4. `idle_json` (0074). O `return jsonb_build_object(…);` termina em `'descobertas', … k.escondida) d), '[]'::jsonb));`: troque o último `);` por `) || jsonb_build_object(` + o bloco abaixo + `);`:
   ```sql
    -- 0076 (num 2º objeto: o 1º já está perto do limite de 100 argumentos de função)
    'linkedin_ate', case when s.linkedin_ate > now() then s.linkedin_ate end,
    'linkedin_gen', case when s.linkedin_ate > now() then s.linkedin_gen end,
    'linkedin_mult', case when s.linkedin_ate > now() then s.linkedin_mult end,
    'combo_ate', case when s.combo_ate > now() then s.combo_ate end,
    'combo_n', coalesce(s.combo_n, 0),
    'combo_seg', s.combo_seg,
    'garantidos', coalesce((select jsonb_agg(g order by (g ->> 'seg')::bigint) from jsonb_array_elements(coalesce(s.garantidos, '[]'::jsonb)) g
                             where (g ->> 'seg')::bigint + 60 > extract(epoch from now())), '[]'::jsonb),
    'tigre_n', case when s.tigre_dia = public.games_today() then coalesce(s.tigre_n, 0) else 0 end,
    'chamados', coalesce(s.chamados, 0),
    'cupons', coalesce(s.cupons, 0),
    'cashback_ate', case when s.cashback_ate > now() then s.cashback_ate end,
    'info_creditos', coalesce(s.info_creditos, 0),
    'dourados_cont', coalesce(s.dourados_cont, '{}'::jsonb),
    'horta_crescendo', (select count(*) from public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie
                         where p.user_id = s.user_id and p.fim is null and p.inicio <= now()
                           and p.canteiro / 6 < public.idle_horta_lado(coalesce(s.generators[11], 0))
                           and p.canteiro % 6 < public.idle_horta_lado(coalesce(s.generators[11], 0))
                           and p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s)) > now())
   ```
5. `idle_buy` (0074). Comentário do topo: `-- comprar (o da 0074) com o Cupom de primeira compra e o Cashback`. No `declare`, acrescente `v_cupom boolean := false;`, `v_cmc double precision;` e `v_cash double precision := 0;`. Depois da linha do `v_cmg := …` (Gabe Newell):
   ```sql
  -- Cupom de primeira compra (0076): gerador 25% mais barato (no 1, no 10 e no Máx), sem Promoção (desconto de compra
  -- até 50%); a meia-preço também guarda o cupom (abaixo)
  v_cupom := coalesce(s.cupons, 0) > 0 and not v_promo;
  v_cmc := v_cmg * (case when v_cupom then 0.75 else 1 end);
   ```
   No ramo `gerador`, troque `v_cmg` por `v_cmc` no `idle_max_qty` e no `idle_price`, e o bloco da meia por:
   ```sql
    if s.meias > 0 and v_k = 1 and not v_promo then -- desconto máximo 50%: com a Promoção a meia-preço fica guardada
      v_preco := public.idle_price(g.custo, v_n, 1, v_cmg) / 2; -- a meia sem o cupom; o cupom fica guardado (0076)
      v_meia := true;
      v_cupom := false;
    end if;
   ```
   No começo do ramo `melhoria` (antes do `select * into u`): `v_cupom := false; -- melhoria não gasta cupom`. Depois do `end if;` dos ramos e antes do `if v_meia then`:
   ```sql
  if v_cupom then
    s.cupons := s.cupons - 1;
  end if;
  -- Cashback (0076): devolve 30% do preço final na hora; é devolução, passa do teto dos descontos (com Promoção: paga 35%).
  -- 1 s de folga, como a Promoção
  if s.cashback_ate > now() - interval '1 second' then
    v_cash := 0.3 * v_preco;
    s.valuation := s.valuation + v_cash;
    s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'cashback', v_cash);
    perform public.idle_ganhar(s.user_id, 'cashback', (s.dourados_cont ->> 'cashback')::double precision);
  end if;
   ```

Mantenha os `revoke`/`grant` que vêm depois de cada função na 0074.

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts test/idleEventosEra.test.ts test/idleEmpilha.test.ts test/idleDourado.test.ts test/idle.test.ts test/idlePrestigio.test.ts test/idleParidade.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/0076_fellas_inc_dourados_caixinha.sql games/shared/types.ts games/idle/economia.ts games/idle/economia.test.ts games/idle/store.ts games/idle/store.test.ts games/idle/oportunidades.ts games/idle/oportunidades.test.ts games/idle/dourados.ts games/idle/dourados.test.ts games/idle/dica.ts games/idle/dica.test.ts games/test/idleDouradosCaixinha.test.ts
git commit -m "Fellas Inc.: LinkedIn e Combo na conta, cupom e cashback na compra, o estado novo (0076)"
```

---

### Task 4: Pegar os dourados novos, o Combo e o Chamar (banco + api)

Só lógica (banco, `api.ts`, o mock da api e os erros). A tela e o `main.ts` vêm na Task 6.

**Files:**
- Modify: `supabase/migrations/0076_fellas_inc_dourados_caixinha.sql` (parte C)
- Modify: `games/shared/api.ts:65`, `games/dev/mockIdle.ts:46` (só as funções da api; o painel é da Task 6)
- Modify: `games/shared/errors.ts` (`idle_chamar_vazio`)
- Test: `games/test/idleDouradosCaixinha.test.ts`

**Interfaces:**
- Consumes: Task 2 (`idle_dourado_sorteio`, `idle_dourado_tipo_garantido`, `idle_dourado_pix_seg`, `idle_dourado_tigre_paga`, `idle_linkedin`); Task 3 (colunas, `idle_cont_mais`, `DouradoPago`); Task 1 (tipos de conquista).
- Produces (SQL): `idle_combo_quebrou(s idle_state, de bigint, ate bigint, peso double precision, tela double precision) boolean`; `idle_dourado_pegar(p_seg bigint, p_lado int, p_moedas int default 0) returns jsonb` = `idle_json(s) || {"dourado": DouradoPago}` (erros `idle_dourado_gone`, `idle_dourado_pego`, `idle_bad_choice`); `idle_dourado_chamar() returns jsonb` (erro `idle_chamar_vazio`).
- Produces (TS): `api.idleDouradoPegar(seg: number, lado: number, moedas = 0): Promise<IdleState>`; `api.idleDouradoChamar(): Promise<IdleState>` (os mesmos no `mockIdle.ts`); `GameErrorCode` `'idle_chamar_vazio'`.

- [ ] **Step 1: Testes do banco (falham)**

Em `games/test/idleDouradosCaixinha.test.ts`:

```ts
describe('pegar os dourados novos (0076, parte C)', () => {
  type JP = J & { dourado: NonNullable<IdleState['dourado']> };
  const dourado = (seg: number, tipo: number) =>
    q('insert into public.teste_dourado values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
  const sorteio = (seg: number, sal: number, r: number) =>
    q('insert into public.teste_sorteio values ($1, $2, $3) on conflict (s, sal) do update set r = excluded.r', [seg, sal, r]);
  const pegar = (seg: number, lado = 0, moedas?: number) =>
    t.rpc<JP>('idle_dourado_pegar', moedas === undefined ? { p_seg: seg, p_lado: lado } : { p_seg: seg, p_lado: lado, p_moedas: moedas });
  const garantir = (seg: number, tipo: number, dobro = true) => q(
    `update public.idle_state set garantidos = garantidos || jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', $3::int, 'dobro', $4::boolean))
      where user_id = $1`, [A, seg, tipo, dobro]);
  const combo = (n: number, de: number) => q('update public.idle_state set combo_n = $2, combo_seg = $3 where user_id = $1', [A, n, de]);

  beforeEach(async () => {
    // a sorte vem de tabelas: teste_dourado (o tipo de cada segundo) e teste_sorteio (cada sorteio; sem linha = 0)
    await t.db.exec(`
      create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';
      create table public.teste_sorteio (s bigint, sal int, r int, primary key (s, sal));
      create or replace function public.idle_dourado_sorteio(u uuid, s bigint, sal int, n int) returns int language sql stable as
        'select coalesce((select r from public.teste_sorteio x where x.s = idle_dourado_sorteio.s and x.sal = idle_dourado_sorteio.sal), 0)';`);
    await abrir();
  });

  it('Trend: 1 min de produção por moedinha, no máximo 20 (25 vira 20, negativo vira 0); vale até a janela + 8 + 3 s', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    await dourado(seg - 20, 4); // 12 + 8 + 3 = 23 s
    const antes = await valor();
    const s = await pegar(seg - 20, 0, 25);
    expect(s.valuation - antes).toBeCloseTo(r * 60 * 20, 2);
    expect(s.dourado).toMatchObject({ tipo: 4, moedas: 20 });
    expect(s.dourados_cont.trend_max).toBe(20);
    await dourado(seg - 1, 4);
    const antes2 = await valor();
    expect((await pegar(seg - 1, 0, -3)).valuation - antes2).toBeCloseTo(0, 6);
    await dourado(seg - 19, 0); // o Investidor não tem os 8 s: 12 + 3 = 15
    await expect(pegar(seg - 19)).rejects.toThrow(/idle_dourado_gone/);
  });
  it('Pix: ficar paga 30 min; devolver põe um garantido em dobro de 20 a 120 s depois; o mesmo Pix paga uma vez só', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    await dourado(seg, 6);
    const antes = await valor();
    const s = await pegar(seg, 0);
    expect(s.valuation - antes).toBeCloseTo(r * 1800, 2);
    await expect(pegar(seg, 1)).rejects.toThrow(/idle_dourado_pego/); // ficou: não dá pra devolver o mesmo Pix
    await dourado(seg - 1, 6);
    await sorteio(seg - 1, 6161, 37);
    const d = await pegar(seg - 1, 1);
    expect(d.garantidos).toEqual([{ seg: seg + 56, tipo: tipoGarantido(A, seg + 56), dobro: true }]);
    expect(d.dourados_cont.pix_dev).toBe(1);
    expect(d.dourado).toMatchObject({ tipo: 6, lado: 1, garantido_seg: seg + 56 });
    await expect(pegar(seg - 1, 0)).rejects.toThrow(/idle_dourado_pego/);
  });
  it('garantido em dobro: Investidor 2×, Viralizou em dois fins, Promoção 1 min, LinkedIn 2 min, Trend 2 min por moedinha; sai da lista', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    await garantir(seg, 0);
    const antes = await valor();
    let s = await pegar(seg);
    expect(s.valuation - antes).toBeCloseTo(r * 1200 * 2, 2);
    expect(s.garantidos).toEqual([]);
    await garantir(seg - 1, 2);
    s = await pegar(seg - 1);
    expect(s.viral).toHaveLength(2);
    expect(Date.parse(s.viral[1]) - Date.parse(s.viral[0])).toBeCloseTo(60_000, -3);
    await garantir(seg - 2, 1);
    s = await pegar(seg - 2);
    expect(Date.parse(s.promo_ate!) - Date.parse(s.server_now)).toBeCloseTo(60_000, -3);
    await garantir(seg - 3, 5);
    s = await pegar(seg - 3);
    expect(Date.parse(s.linkedin_ate!) - Date.parse(s.server_now)).toBeCloseTo(120_000, -3);
    await garantir(seg - 4, 4);
    const antes2 = await valor();
    s = await pegar(seg - 4, 0, 10);
    expect(s.valuation - antes2).toBeCloseTo(r * 60 * 10 * 2, 2);
    expect(s.dourado.dobro).toBe(true);
  });
  it('garantido que passou da janela não paga e sai da lista', async () => {
    const seg = await agoraSeg();
    await garantir(seg - 20, 0);
    await expect(pegar(seg - 20)).rejects.toThrow(/idle_dourado_gone/);
    await q(`update public.idle_state set garantidos = jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', 0, 'dobro', true)) where user_id = $1`, [A, seg - 61]);
    expect((await t.rpc<J>('idle_open')).garantidos).toEqual([]);
  });
  it('Tigrinho: as 3 primeiras do dia pagam 30 min (mesmo com a sorte ruim); depois a sorte: paga 30 min ou come 15', async () => {
    const seg = await agoraSeg();
    const r = await taxa();
    for (let i = 0; i < 4; i++) {
      await dourado(seg - i, 7);
      await sorteio(seg - i, 4242, 50);
    }
    for (let i = 0; i < 3; i++) {
      const antes = await valor();
      const s = await pegar(seg - i);
      expect(s.valuation - antes).toBeCloseTo(r * 1800, 2);
      expect(s.dourado.tigre).toMatchObject({ pagou: true, gratis: true, n: i + 1 });
    }
    const antes = await valor();
    const s = await pegar(seg - 3);
    expect(antes - s.valuation).toBeCloseTo(r * 900, 2);
    expect(s.dourado.tigre).toMatchObject({ pagou: false, gratis: false, n: 4 });
    expect(s.dourados_cont.tigre_perdeu).toBe(1);
    await dourado(seg - 4, 7);
    await sorteio(seg - 4, 4242, 29);
    const s2 = await pegar(seg - 4);
    expect(s2.dourado.tigre).toMatchObject({ pagou: true, gratis: false });
    expect(s2.dourados_cont.tigre_seq).toBe(1);
  });
  it('Tigrinho: perder com pouco F$ nunca deixa negativo; outro dia volta a ter 3 grátis; vender a startup não devolve as grátis', async () => {
    const seg = await agoraSeg();
    await q('update public.idle_state set tigre_dia = public.games_today(), tigre_n = 3, valuation = 1 where user_id = $1', [A]);
    await dourado(seg, 7);
    await sorteio(seg, 4242, 99);
    const s = await pegar(seg);
    expect(s.valuation).toBe(0);
    expect(s.dourado.tigre!.perdeu).toBe(1);
    await q('update public.idle_state set tigre_dia = public.games_today() - 1, valuation = 1e12 where user_id = $1', [A]);
    await dourado(seg - 1, 7);
    await sorteio(seg - 1, 4242, 99);
    expect((await pegar(seg - 1)).dourado.tigre).toMatchObject({ pagou: true, gratis: true, n: 1 });
    await q('update public.idle_state set tigre_n = 3, prestige_earned = 0, valuation = 1e30, generators[20] = 50 where user_id = $1', [A]);
    await t.rpc('idle_prestige');
    expect((await q<{ n: number }>('select tigre_n as n from public.idle_state where user_id = $1', [A]))[0].n).toBe(3);
  });
  it('LinkedIn: o gerador sorteado entre os que mais rendem fica ×30 por 1 min (mult = 1 + 29·f); outro substitui', async () => {
    const seg = await agoraSeg();
    const [{ r }] = await q<{ r: number[] }>(
      'select array(select x.renda from public.idle_gen_rendas(s, now()) x order by x.gen) as r from public.idle_state s where user_id = $1', [A]);
    const soma = r.reduce((a, x) => a + x, 0);
    const top = r.indexOf(Math.max(...r)) + 1;
    await dourado(seg, 5);
    const s = await pegar(seg); // sorteio 0 = o que mais rende
    expect(s.linkedin_gen).toBe(top);
    expect(s.linkedin_mult).toBeCloseTo(1 + 29 * (r[top - 1] / soma), 9);
    expect(Date.parse(s.linkedin_ate!) - Date.parse(s.server_now)).toBeCloseTo(60_000, -3);
    await dourado(seg - 1, 5);
    await sorteio(seg - 1, 5151, 1);
    const s2 = await pegar(seg - 1);
    expect(s2.linkedin_gen).not.toBe(top);
    expect(s2.dourado).toMatchObject({ tipo: 5, gen: s2.linkedin_gen });
  });
  it('Combo: 3 pegos seguidos = ×7 por 1 min; o 2º lado da dupla não soma', async () => {
    const seg = await agoraSeg();
    await dourado(seg - 10, 0);
    await dourado(seg - 7, 3);
    await dourado(seg - 5, 0);
    await pegar(seg - 10);
    await pegar(seg - 7, 0);
    let s = await pegar(seg - 7, 1);
    expect(s.combo_n).toBe(2);
    s = await pegar(seg - 5);
    expect(s.dourado.combo).toBe(true);
    expect(s.combo_n).toBe(0);
    expect(Date.parse(s.combo_ate!) - Date.parse(s.server_now)).toBeCloseTo(60_000, -3);
    expect(s.dourados_cont.combos).toBe(1);
  });
  it('Combo quebra com um dourado perdido no meio; não quebra com Tigrinho ignorado nem com garantido perdido; zera depois de 30 min', async () => {
    const seg = await agoraSeg();
    await dourado(seg - 40, 0); // ninguém pegou e a janela já passou
    await dourado(seg, 0);
    await combo(2, seg - 50);
    expect((await pegar(seg)).combo_n).toBe(1);
    await dourado(seg - 30, 7); // Tigrinho ignorado
    await dourado(seg - 1, 0);
    await combo(2, seg - 35);
    expect((await pegar(seg - 1)).dourado.combo).toBe(true);
    await q(`update public.idle_state set garantidos = jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', 0, 'dobro', false)) where user_id = $1`, [A, seg - 25]);
    await dourado(seg - 2, 0);
    await combo(2, seg - 28);
    expect((await pegar(seg - 2)).dourado.combo).toBe(true);
    await dourado(seg - 3, 0);
    await combo(2, seg - 2000);
    expect((await pegar(seg - 3)).combo_n).toBe(1);
  });
  it('Chamar: sem guardado, idle_chamar_vazio; com 2, gasta 1 e põe um garantido no segundo seguinte (sem dobro, sem Pix nem Tigrinho)', async () => {
    await expect(t.rpc('idle_dourado_chamar')).rejects.toThrow(/idle_chamar_vazio/);
    await q('update public.idle_state set chamados = 2 where user_id = $1', [A]);
    const seg = await agoraSeg();
    const s = await t.rpc<J>('idle_dourado_chamar');
    expect(s.chamados).toBe(1);
    const g = s.garantidos![0];
    expect(g.seg - seg).toBeGreaterThanOrEqual(1);
    expect(g.seg - seg).toBeLessThanOrEqual(2);
    expect(g).toEqual({ seg: g.seg, tipo: tipoGarantido(A, g.seg), dobro: false });
    const s2 = await t.rpc<J>('idle_dourado_chamar');
    expect(s2.chamados).toBe(0);
    expect(new Set(s2.garantidos!.map((x) => x.seg)).size).toBe(2);
  });
  it('quem não é membro não pega nem chama', async () => {
    const seg = await agoraSeg();
    await t.as(B);
    await expect(pegar(seg)).rejects.toThrow(/not_member/);
    await expect(t.rpc('idle_dourado_chamar')).rejects.toThrow(/not_member/);
  });
});

describe('conquistas dos dourados (132–135, 138)', () => {
  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas
    await t.db.exec(`
      create table public.teste_dourado (s bigint primary key, tipo int);
      create or replace function public.idle_dourado(u uuid, s bigint, gema double precision default 0) returns int language sql stable as
        'select tipo from public.teste_dourado where teste_dourado.s = idle_dourado.s';
      create table public.teste_sorteio (s bigint, sal int, r int, primary key (s, sal));
      create or replace function public.idle_dourado_sorteio(u uuid, s bigint, sal int, n int) returns int language sql stable as
        'select coalesce((select r from public.teste_sorteio x where x.s = idle_dourado_sorteio.s and x.sal = idle_dourado_sorteio.sal), 0)';`);
    await abrir();
  });
  const tem = async (id: number) =>
    (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;

  it('Combo 10, Trend com 20, Pix devolvido 10, 3 seguidas pagas depois das grátis e 10 derrotas no Tigrinho', async () => {
    const seg = await agoraSeg();
    await q(`update public.idle_state set dourados_cont = '{"pix_dev": 9, "tigre_perdeu": 9, "combos": 9, "tigre_seq": 2}',
               tigre_dia = public.games_today(), tigre_n = 3, combo_n = 2, combo_seg = $2 where user_id = $1`, [A, seg - 11]);
    const vez = async (x: number, tipo: number, lado = 0, moedas?: number, sorte?: number) => {
      await q('insert into public.teste_dourado values ($1, $2)', [x, tipo]);
      if (sorte !== undefined) await q('insert into public.teste_sorteio values ($1, 4242, $2)', [x, sorte]);
      await t.rpc('idle_dourado_pegar', moedas === undefined ? { p_seg: x, p_lado: lado } : { p_seg: x, p_lado: lado, p_moedas: moedas });
    };
    await vez(seg - 10, 4, 0, 19); // o 3º seguido: Combo nº 10
    expect(await tem(135)).toBe(true);
    expect(await tem(132)).toBe(false);
    await vez(seg - 9, 4, 0, 20);
    expect(await tem(132)).toBe(true);
    await vez(seg - 8, 6, 1);
    expect(await tem(133)).toBe(true);
    await vez(seg - 7, 7, 0, undefined, 0); // 4ª do dia, a sorte paga: 3 seguidas
    expect(await tem(138)).toBe(true);
    await vez(seg - 6, 7, 0, undefined, 99); // perde: a 10ª derrota
    expect(await tem(134)).toBe(true);
  });
});
```

Acrescente `tipoGarantido` ao import de `../idle/dourados` se ainda não estiver (já está desde a Task 2).

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts`
Expected: FAIL (`idle_dourado_pegar` não aceita `p_moedas`; `idle_dourado_chamar` não existe).

- [ ] **Step 2: 0076, parte C**

Acrescente à `0076_fellas_inc_dourados_caixinha.sql`:

```sql
-- ===== parte C: pegar o dourado, o Combo e o Chamar =====
-- o Combo quebrou entre o último pego (de) e o atual (ate)? Um segundo no meio com dourado da sorte (não Tigrinho), não
-- pego e com a janela já passada (igual a combo.ts comboAgora). `peso` = Gemaplys + a frequência da árvore − 1; `tela` =
-- quanto fica na tela (s). Os garantidos não estão na sorte: perder um não quebra.
create or replace function public.idle_combo_quebrou(s public.idle_state, de bigint, ate bigint, peso double precision, tela double precision)
returns boolean language sql stable set search_path = public as $$
  select exists (
    select 1
      from generate_series(de + 1, ate - 1) x
      cross join lateral (select coalesce(public.idle_dourado(s.user_id, x, peso), public.idle_conv_faixa(s, x)) as tipo) d
     where d.tipo is not null and d.tipo <> 7
       and now() > to_timestamp(x) + make_interval(secs => tela + case when d.tipo in (4, 6) then 8 else 0 end + 3)
       and not exists (select 1 from public.idle_dourados_pegos p where p.user_id = s.user_id and p.seg = x))
$$;
revoke all on function public.idle_combo_quebrou(public.idle_state, bigint, bigint, double precision, double precision) from public, anon, authenticated;

drop function if exists public.idle_dourado_pegar(bigint, int);
-- pegar o dourado do segundo p_seg (o da 0061) com os quatro novos, os garantidos e o Combo. p_lado: o lado da dupla, ou a
-- escolha do Pix (0 ficar, 1 devolver); p_moedas: as moedinhas do Trend (a página conta; o banco aceita 0 a 20).
-- Devolve o estado + "dourado": {tipo, lado, ganho, dobro, moedas, gen, mult, garantido_seg, tigre, combo}.
create or replace function public.idle_dourado_pegar(p_seg bigint, p_lado int, p_moedas int default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s        public.idle_state;
  v_me     uuid := auth.uid();
  v_tipo   int;
  v_ini    timestamptz;
  v_freq   double precision := public.idle_arv(auth.uid(), 'dourado_freq', 'max', 1);    -- Pé de coelho / Dia de sorte
  v_tela   double precision := public.idle_arv(auth.uid(), 'dourado_tela', 'max', 12);   -- Olho de lince: 24 s
  v_dur    double precision := public.idle_arv(auth.uid(), 'dourado_duracao', 'max', 1); -- Hype: o dobro
  v_gema   double precision;
  v_g      jsonb;
  v_dobro  boolean := false;
  v_d      double precision;
  v_rate   double precision;
  v_ganho  double precision := 0;
  v_moedas int := 0;
  v_gen    int;
  v_f      double precision;
  v_gseg   bigint;
  v_tigre  jsonb;
  v_gratis boolean;
  v_pagou  boolean;
  v_perdeu double precision := 0;
  v_combo  boolean := false;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  -- segundo longe de agora (ou nulo) nem chega no to_timestamp (um valor absurdo daria erro de data)
  if p_seg is null or abs(p_seg - extract(epoch from now())) > 60 then
    raise exception 'idle_dourado_gone' using errcode = 'P0001';
  end if;
  v_gema := public.idle_conv_peso(s, 3);
  -- garantido (Pix devolvido, Chamar) primeiro: o tipo e o dobro vêm da lista; senão a sorte e a faixa do MC V.V
  select g into v_g from jsonb_array_elements(coalesce(s.garantidos, '[]'::jsonb)) g where (g ->> 'seg')::bigint = p_seg limit 1;
  if v_g is not null then
    v_tipo := (v_g ->> 'tipo')::int;
    v_dobro := coalesce((v_g ->> 'dobro')::boolean, false);
  else
    -- a frequência da árvore entra como peso a mais no extra do Gemaplys (igual a convidados.ts eventoDaSorte)
    v_tipo := coalesce(public.idle_dourado(v_me, p_seg, v_gema + v_freq - 1), public.idle_conv_faixa(s, p_seg));
  end if;
  v_d := case when v_dobro then 2 else 1 end;
  v_ini := to_timestamp(p_seg);
  -- na tela: base × (1 − gema/2); o Trend (a chuva) e o Pix (a escolha) têm 8 s a mais; o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => v_tela * (1 - v_gema / 2) + case when v_tipo in (4, 6) then 8 else 0 end + 3) then
    raise exception 'idle_dourado_gone' using errcode = 'P0001';
  end if;
  if p_lado is null or p_lado not in (0, 1) or (p_lado = 1 and v_tipo not in (3, 6)) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  delete from public.idle_dourados_pegos where user_id = v_me and pegou_em < now() - interval '1 hour';
  -- o Pix grava sempre o lado 0: ficar e devolver são o mesmo Pix (paga uma vez)
  insert into public.idle_dourados_pegos (user_id, seg, lado)
  values (v_me, p_seg, case when v_tipo = 6 then 0 else p_lado end) on conflict do nothing;
  if not found then
    raise exception 'idle_dourado_pego' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  case v_tipo
    when 0 then -- Investidor apressado: 20 min (× Investidor anjo × horta; 2× no dobro)
      v_ganho := v_rate * 1200 * v_d * public.idle_arv(v_me, 'dourado_investidor', 'mult', 1)
                 * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    when 1 then -- Promoção relâmpago: 30 s × Hype (o dobro dura 2×)
      s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + make_interval(secs => 30 * v_dur * v_d));
    when 2, 3 then -- Viralizou (e cada lado da dupla); no dobro, um 2º fim logo depois do 1º (×10 por 2 min)
      s.viral_ate := array(select v from unnest(s.viral_ate) v where v > now()) || (now() + make_interval(secs => 60 * v_dur))
                     || case when v_dobro then array[now() + make_interval(secs => 120 * v_dur)] else '{}'::timestamptz[] end;
    when 4 then -- Trend do TikTok: 1 min de produção por moedinha (2 no dobro), até 20
      v_moedas := least(20, greatest(0, coalesce(p_moedas, 0)));
      v_ganho := v_rate * 60 * v_moedas * v_d;
      s.dourados_cont := coalesce(s.dourados_cont, '{}'::jsonb)
                         || jsonb_build_object('trend_max', greatest(coalesce((s.dourados_cont ->> 'trend_max')::int, 0), v_moedas));
      perform public.idle_ganhar(v_me, 'trend_max', v_moedas);
    when 5 then -- Bombou no LinkedIn: um dos 5 que mais produzem ×30 por 1 min (× Hype × dobro), congelado agora; o novo substitui
      select l.gen, l.f into v_gen, v_f from public.idle_linkedin(s, p_seg) l;
      s.linkedin_gen := v_gen;
      s.linkedin_mult := 1 + 29 * coalesce(v_f, 0);
      s.linkedin_ate := now() + make_interval(secs => 60 * v_dur * v_d);
    when 6 then -- Pix errado: ficar (30 min) ou devolver (um garantido em dobro de 20 a 120 s depois)
      if p_lado = 0 then
        v_ganho := v_rate * 1800;
      else
        v_gseg := public.idle_dourado_pix_seg(v_me, p_seg);
        s.garantidos := coalesce(s.garantidos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
          'seg', v_gseg, 'tipo', public.idle_dourado_tipo_garantido(v_me, v_gseg), 'dobro', true));
        s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'pix_dev', 1);
        perform public.idle_ganhar(v_me, 'pix_dev', (s.dourados_cont ->> 'pix_dev')::double precision);
      end if;
    else -- Tigrinho: as 3 primeiras do dia pagam; depois a casa paga 3 em cada 10 (30 min) e come 15 min (nunca abaixo de zero)
      if s.tigre_dia is distinct from public.games_today() then
        s.tigre_dia := public.games_today();
        s.tigre_n := 0;
      end if;
      s.tigre_n := coalesce(s.tigre_n, 0) + 1;
      v_gratis := s.tigre_n <= 3;
      v_pagou := v_gratis or public.idle_dourado_tigre_paga(v_me, p_seg);
      if v_pagou then
        v_ganho := v_rate * 1800;
        if not v_gratis then -- O tigre tá pagando: vitórias seguidas depois das grátis
          s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'tigre_seq', 1);
          perform public.idle_ganhar(v_me, 'tigre_seq', (s.dourados_cont ->> 'tigre_seq')::double precision);
        end if;
      else
        v_perdeu := least(greatest(s.valuation, 0), v_rate * 900);
        s.valuation := s.valuation - v_perdeu;
        s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'tigre_perdeu', 1) || jsonb_build_object('tigre_seq', 0);
        perform public.idle_ganhar(v_me, 'tigre_perdeu', (s.dourados_cont ->> 'tigre_perdeu')::double precision);
      end if;
      v_tigre := jsonb_build_object('pagou', v_pagou, 'gratis', v_gratis, 'perdeu', v_perdeu, 'n', s.tigre_n);
  end case;
  s.valuation := s.valuation + v_ganho;
  -- o garantido sai da lista quando pego (a dupla, depois dos dois lados)
  if v_g is not null
     and (v_tipo <> 3 or (select count(*) from public.idle_dourados_pegos p where p.user_id = v_me and p.seg = p_seg) >= 2) then
    s.garantidos := coalesce((select jsonb_agg(g) from jsonb_array_elements(s.garantidos) g where (g ->> 'seg')::bigint <> p_seg), '[]'::jsonb);
  end if;
  -- Combo: 3 pegos seguidos sem nenhum sumir no meio = ×7 por 1 min (× Hype). O 2º lado da dupla não soma nem quebra;
  -- o último pego de mais de 30 min atrás (ou nenhum) zera
  if p_seg is distinct from s.combo_seg then
    if s.combo_seg is null or s.combo_seg < p_seg - 1800
       or (p_seg > s.combo_seg and public.idle_combo_quebrou(s, s.combo_seg, p_seg, v_gema + v_freq - 1, v_tela * (1 - v_gema / 2))) then
      s.combo_n := 0;
    end if;
    s.combo_n := coalesce(s.combo_n, 0) + 1;
    s.combo_seg := greatest(coalesce(s.combo_seg, p_seg), p_seg);
    if s.combo_n >= 3 then
      s.combo_ate := greatest(coalesce(s.combo_ate, now()), now()) + make_interval(secs => 60 * v_dur);
      s.combo_n := 0;
      v_combo := true;
      s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'combos', 1);
      perform public.idle_ganhar(v_me, 'combos', (s.dourados_cont ->> 'combos')::double precision);
    end if;
  end if;
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('dourado', jsonb_build_object(
    'tipo', v_tipo, 'lado', p_lado, 'ganho', v_ganho, 'dobro', v_dobro, 'moedas', v_moedas, 'gen', v_gen,
    'mult', case when v_tipo = 5 then s.linkedin_mult end, 'garantido_seg', v_gseg, 'tigre', v_tigre, 'combo', v_combo));
end;
$$;
revoke all on function public.idle_dourado_pegar(bigint, int, int) from public, anon;
grant execute on function public.idle_dourado_pegar(bigint, int, int) to authenticated;

-- Chamar um dourado (guardado pela Caixinha): gasta 1 e põe um garantido no segundo seguinte (a roda sem Pix nem
-- Tigrinho, sem dobro); dois no mesmo segundo: o 2º vai pro seguinte
create or replace function public.idle_dourado_chamar()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s     public.idle_state;
  v_me  uuid := auth.uid();
  v_seg bigint := floor(extract(epoch from now()))::bigint + 1;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(v_me);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.chamados, 0) < 1 then
    raise exception 'idle_chamar_vazio' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  while exists (select 1 from jsonb_array_elements(coalesce(s.garantidos, '[]'::jsonb)) g where (g ->> 'seg')::bigint = v_seg) loop
    v_seg := v_seg + 1;
  end loop;
  s.chamados := s.chamados - 1;
  s.garantidos := coalesce(s.garantidos, '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
    'seg', v_seg, 'tipo', public.idle_dourado_tipo_garantido(v_me, v_seg), 'dobro', false));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_dourado_chamar() from public, anon;
grant execute on function public.idle_dourado_chamar() to authenticated;
```

- [ ] **Step 3: api, mock da api e o erro novo**

`games/shared/api.ts`, troque a linha 65 por:

```ts
export const idleDouradoPegar = (seg: number, lado: number, moedas = 0) =>
  rpc<IdleState>('idle_dourado_pegar', { p_seg: seg, p_lado: lado, p_moedas: moedas });
export const idleDouradoChamar = () => rpc<IdleState>('idle_dourado_chamar');
```

`games/dev/mockIdle.ts`, troque a linha 46 por:

```ts
export const idleDouradoPegar = (seg: number, lado: number, moedas = 0) =>
  call<IdleState>('select public.idle_dourado_pegar($1, $2, $3) as v', [seg, lado, moedas]);
export const idleDouradoChamar = () => call<IdleState>('select public.idle_dourado_chamar() as v');
```

`games/shared/errors.ts`: `| 'idle_chamar_vazio'` no tipo (junto de `'idle_dourado_gone' | 'idle_dourado_pego'`), `idle_chamar_vazio: 'Você não tem dourado guardado pra chamar',` em `ERROR_TEXT` e `'idle_chamar_vazio'` em `FROM_DB` (junto dos dois de dourado).

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts test/idleDourado.test.ts test/idleConquistas.test.ts shared && npx tsc --noEmit`
Expected: PASS (os testes antigos de `idleDourado.test.ts` chamam com `p_seg`/`p_lado`: o `p_moedas` tem padrão).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0076_fellas_inc_dourados_caixinha.sql games/shared/api.ts games/shared/errors.ts games/dev/mockIdle.ts games/test/idleDouradosCaixinha.test.ts
git commit -m "Fellas Inc.: pegar Trend, LinkedIn, Pix e Tigrinho, os garantidos, o Combo e o Chamar no banco (0076)"
```

---

### Task 5: A Caixinha nova e o Espiar da Bolsa no banco (+ api)

Só lógica (banco, api, tipos, erros, `bolsa.ts`). A tela vem na Task 7.

**Files:**
- Modify: `supabase/migrations/0076_fellas_inc_dourados_caixinha.sql` (parte D)
- Modify: `games/shared/types.ts:190,199-202` (`BolsaEmpresa`, `BolsaEstado`)
- Modify: `games/shared/api.ts:84-86`, `games/dev/mockIdle.ts:72-74` (só as funções da api), `games/shared/errors.ts`, `games/idle/bolsa.ts:83` (`RECARREGA_BOLSA`)
- Test: `games/test/idleDouradosCaixinha.test.ts`, `games/idle/bolsaMain.test.ts`

**Interfaces:**
- Consumes: Task 2 (`idle_opp_kind`); Task 3 (colunas, `idle_cont_mais`); Task 1 (tipos `cupons`, `insider`).
- Produces (SQL): `idle_claim_opportunity(p_window bigint)` com os tipos 3–7 e a troca pelos 15 min; `idle_bolsa_espiada(s idle_state, m idle_bolsa_mercado, p_agora bigint) boolean`; `idle_bolsa_espiar_em(p_user uuid, p_empresa int, p_agora bigint) jsonb` e `idle_bolsa_espiar(p_empresa int) jsonb` (= `idle_json || {"bolsa": …}`; erros `idle_info_sem_credito`, `idle_info_ja`, `idle_bolsa_rj`, `idle_bolsa_fechada`); `idle_bolsa_estado` com `info_creditos` e, por empresa, `espiada` e `muda_em` (minutos; null se não espiada); `idle_bolsa_negociar_em` dá a "Insider (shh)".
- Produces (TS): `BolsaEmpresa` ganha `espiada?: boolean; muda_em?: number | null`; `BolsaEstado` ganha `info_creditos?: number`; `api.idleBolsaEspiar(empresa: number): Promise<IdleState & { bolsa: BolsaEstado }>` (o mesmo no `mockIdle.ts`); `GameErrorCode` `'idle_info_sem_credito' | 'idle_info_ja'`.

- [ ] **Step 1: Testes do banco (falham)**

Em `games/test/idleDouradosCaixinha.test.ts`, acrescente `afterEach, vi` ao import do vitest, `pendentes` ao de `../idle/oportunidades`, `quartaATarde` ao de `./db`, e:

```ts
describe('as oportunidades novas (0076, parte D)', () => {
  beforeEach(async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); // numa quarta à tarde: a caixinha sempre tem guardadas
    vi.setSystemTime(quartaATarde());
    // o tipo de toda janela vem de teste_opp (o que o teste forçar)
    await t.db.exec(`
      create table public.teste_opp (k int);
      create or replace function public.idle_opp_kind(u uuid, w bigint) returns int language sql stable as
        'select coalesce((select k from public.teste_opp limit 1), 0)';`);
    await abrir();
  });
  afterEach(() => vi.useRealTimers());
  /** Pega a próxima guardada como o tipo k (zera as já pegas, pra sempre ter uma). */
  const pegarOpp = async (k: number) => {
    await q('delete from public.teste_opp where true');
    await q('insert into public.teste_opp values ($1)', [k]);
    await q(`update public.idle_state set opp_claimed = '{}', opp_count = 0 where user_id = $1`, [A]);
    const s = await t.rpc<J>('idle_open');
    const [w] = pendentes(A, Date.parse(s.server_now), [], Date.parse(s.week_start + 'T00:00:00-03:00'));
    return t.rpc<J>('idle_claim_opportunity', { p_window: w });
  };
  const xepa = async () => {
    const [{ id }] = await q<{ id: number }>(`select id from public.idle_cat_no where tipo = 'opp_bonus'`);
    await q('insert into public.idle_arvore (user_id, no_id) values ($1, $2)', [A, id]);
  };

  it('Chamar: guarda 1 (2 com a Xepa), no máximo 3 (o que passa se perde)', async () => {
    expect((await pegarOpp(3)).chamados).toBe(1);
    await xepa();
    expect((await pegarOpp(3)).chamados).toBe(3);
    expect((await pegarOpp(3)).chamados).toBe(3);
  });
  it('Cupom: +10 (+20 com a Xepa) e conta 1 pega', async () => {
    let s = await pegarOpp(4);
    expect(s.cupons).toBe(10);
    expect(s.dourados_cont.cupons).toBe(1);
    await xepa();
    s = await pegarOpp(4);
    expect(s.cupons).toBe(30);
    expect(s.dourados_cont.cupons).toBe(2);
  });
  it('Cashback: 2 min (4 com a Xepa), soma no fim do que já tem', async () => {
    let s = await pegarOpp(6);
    expect(Date.parse(s.cashback_ate!) - Date.parse(s.server_now)).toBeCloseTo(120_000, -3);
    s = await pegarOpp(6);
    expect(Date.parse(s.cashback_ate!) - Date.parse(s.server_now)).toBeCloseTo(240_000, -3);
    await q('update public.idle_state set cashback_ate = null where user_id = $1', [A]);
    await xepa();
    s = await pegarOpp(6);
    expect(Date.parse(s.cashback_ate!) - Date.parse(s.server_now)).toBeCloseTo(240_000, -3);
  });
  it('Informação: +1 crédito (2 com a Xepa) com Bolsa; sem Bolsa, 15 min de produção', async () => {
    const r = await taxa();
    const antes = await valor();
    let s = await pegarOpp(7);
    expect(s.valuation - antes).toBeCloseTo(r * 900, 2);
    expect(s.info_creditos).toBe(0);
    await q('update public.idle_state set generators[19] = 1 where user_id = $1', [A]);
    s = await pegarOpp(7);
    expect(s.info_creditos).toBe(1);
    await xepa();
    s = await pegarOpp(7);
    expect(s.info_creditos).toBe(3);
  });
  it('Adubo: a planta crescendo mais perto de amadurecer fica madura agora; sem planta crescendo (ou sem Horta), 15 min', async () => {
    const r0 = await taxa();
    const antes = await valor();
    let s = await pegarOpp(5);
    expect(s.valuation - antes).toBeCloseTo(r0 * 900, 2); // sem Horta
    await q('update public.idle_state set generators[11] = 1 where user_id = $1', [A]); // lado 2: canteiros 0, 1, 6, 7
    await t.rpc('idle_horta_plantar', { p_canteiro: 0, p_especie: 1 });
    await t.rpc('idle_horta_plantar', { p_canteiro: 1, p_especie: 1 });
    await q(`update public.idle_horta_plantas set inicio = now() - interval '10 minutes' where user_id = $1 and canteiro = 0`, [A]);
    await q(`update public.idle_horta_plantas set inicio = now() - interval '50 minutes' where user_id = $1 and canteiro = 1`, [A]);
    expect((await t.rpc<J>('idle_open')).horta_crescendo).toBe(2);
    s = await pegarOpp(5);
    const amad = async (c: number) => (await q<{ a: number }>(
      'select amadurece_s as a from public.idle_horta_plantas where user_id = $1 and canteiro = $2', [A, c]))[0].a;
    expect(await amad(1)).toBeCloseTo(3000, -1); // a de 50 min (faltavam 10): madura agora
    expect(await amad(0)).toBeCloseTo(3600, 6); // a outra continua
    expect(s.horta_crescendo).toBe(1);
  });
});

describe('o Espiar da Bolsa (0076, parte D)', () => {
  type Bolsa = { info_creditos: number; empresas: { id: number; humor: number | null; espiada: boolean; muda_em: number | null }[] };
  const T = 5000;
  const espiar = (empresa: number, agora = T) =>
    q<{ v: J & { bolsa: Bolsa } }>('select public.idle_bolsa_espiar_em($1, $2, $3) as v', [A, empresa, agora]).then((r) => r[0].v);
  const estado = (agora = T) => q<{ v: Bolsa }>('select public.idle_bolsa_estado($1, $2) as v', [A, agora]).then((r) => r[0].v);
  beforeEach(async () => {
    await abrir();
    await q('update public.idle_state set generators[19] = 2, generators[11] = 20 where user_id = $1', [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
    await q('update public.idle_bolsa_mercado set humor = 3, humor_ate = $1 where empresa = 1', [T + 7]);
  });

  it('sem crédito: idle_info_sem_credito; com 2: gasta 1 e mostra o humor e em quantos minutos ele muda', async () => {
    await expect(espiar(1)).rejects.toThrow(/idle_info_sem_credito/);
    await q('update public.idle_state set info_creditos = 2 where user_id = $1', [A]);
    const r = await espiar(1);
    expect(r.info_creditos).toBe(1);
    expect(r.bolsa.info_creditos).toBe(1);
    expect(r.bolsa.empresas[0]).toMatchObject({ id: 1, humor: 3, espiada: true, muda_em: 7 });
    expect(r.bolsa.empresas[1]).toMatchObject({ humor: null, espiada: false, muda_em: null });
  });
  it('a mesma empresa de novo: idle_info_ja (não gasta); o humor virou: some', async () => {
    await q('update public.idle_state set info_creditos = 2 where user_id = $1', [A]);
    await espiar(1);
    await expect(espiar(1)).rejects.toThrow(/idle_info_ja/);
    expect((await t.rpc<J>('idle_open')).info_creditos).toBe(1);
    await q('update public.idle_bolsa_mercado set humor = 4, humor_ate = $1 where empresa = 1', [T + 30]);
    expect((await estado()).empresas[0]).toMatchObject({ humor: null, espiada: false, muda_em: null });
  });
  it('com o VSauce sentado o humor já aparece (sem o "muda em"); espiar acrescenta o "muda em"', async () => {
    await q(`update public.idle_state set generators[13] = 1, conv_cadeira = '{11,null,null}',
               conv_desde = array[now(), null, null]::timestamptz[], info_creditos = 1 where user_id = $1`, [A]);
    expect((await estado()).empresas[0]).toMatchObject({ humor: 3, espiada: false, muda_em: null });
    expect((await espiar(1)).bolsa.empresas[0]).toMatchObject({ humor: 3, espiada: true, muda_em: 7 });
  });
  it('empresa quebrada (RJ): não espia', async () => {
    await q('update public.idle_state set info_creditos = 1 where user_id = $1', [A]);
    await q('update public.idle_bolsa_mercado set rj_ate = $1 where empresa = 2', [T + 5]);
    await expect(espiar(2)).rejects.toThrow(/idle_bolsa_rj/);
  });
});

describe('conquistas da Caixinha e da Bolsa (136, 137, 139)', () => {
  const T = 5000;
  const negociar = (empresa: number, lado: string, qtd: number) =>
    q('select public.idle_bolsa_negociar_em($1, $2, $3, $4, $5, $6) as v', [A, empresa, lado, qtd, T, T]);
  const tem = async (id: number) =>
    (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;
  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas
    await abrir();
  });

  it('o 25º cupom pego = Primeira compra (de novo); F$ 1 tri de cashback = Volta pra conta', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(quartaATarde());
    try {
      await t.db.exec(`create or replace function public.idle_opp_kind(u uuid, w bigint) returns int language sql stable as 'select 4';`);
      await q(`update public.idle_state set dourados_cont = '{"cupons": 24}' where user_id = $1`, [A]);
      const s = await t.rpc<J>('idle_open');
      const [w] = pendentes(A, Date.parse(s.server_now), [], Date.parse(s.week_start + 'T00:00:00-03:00'));
      await t.rpc('idle_claim_opportunity', { p_window: w });
      expect(await tem(136)).toBe(true);
      await q(`update public.idle_state set cashback_ate = now() + interval '1 minute' where user_id = $1`, [A]);
      await t.rpc('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 1 }); // volta 30% de um gerador: longe de F$ 1 tri
      expect(await tem(137)).toBe(false);
      await q(`update public.idle_state set dourados_cont = dourados_cont || '{"cashback": 999999999999}' where user_id = $1`, [A]);
      await t.rpc('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 1 }); // mais que F$ 1 de volta: passa de 1 tri
      expect(await tem(137)).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });
  it('Insider (shh): vender com 100% de lucro uma ação espiada nas últimas 2 h; sem espiar, ou espiada há mais de 2 h, não', async () => {
    await q('update public.idle_state set generators[19] = 2, generators[11] = 20, info_creditos = 1 where user_id = $1', [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
    await q('update public.idle_bolsa_mercado set humor = 3, humor_ate = $1 where empresa in (1, 2)', [T + 50]);
    await q('select public.idle_bolsa_espiar_em($1, 1, $2)', [A, T]);
    await negociar(2, 'comprar', 1); // a 2 não foi espiada
    await q('update public.idle_bolsa_mercado set valor = valor * 3 where empresa = 2');
    await negociar(2, 'vender', 1);
    expect(await tem(139)).toBe(false);
    await negociar(1, 'comprar', 1);
    await q(`update public.idle_state set espiadas = jsonb_set(espiadas, '{1,em}', to_jsonb(now() - interval '3 hours')) where user_id = $1`, [A]);
    await q('update public.idle_bolsa_mercado set valor = valor * 3 where empresa = 1');
    await negociar(1, 'vender', 1);
    expect(await tem(139)).toBe(false);
    await negociar(1, 'comprar', 1);
    // a espiada velha saiu no idle_save da venda (mais de 2 h): espiada de novo, agora
    await q(`update public.idle_state set espiadas = jsonb_build_object('1', jsonb_build_object('ate_tick', $2::bigint, 'em', now())) where user_id = $1`, [A, T + 50]);
    await q('update public.idle_bolsa_mercado set valor = valor * 3 where empresa = 1');
    await negociar(1, 'vender', 1);
    expect(await tem(139)).toBe(true);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts`
Expected: FAIL (os tipos novos caem no `else` da meia; `idle_bolsa_espiar_em` não existe).

- [ ] **Step 2: 0076, parte D**

Acrescente à `0076_fellas_inc_dourados_caixinha.sql`, **copiando inteira** `idle_claim_opportunity` da 0063 e mudando só o indicado:

1. No `declare`, acrescente `v_tipo int;` e `v_lado int;`.
2. Troque o bloco `case public.idle_opp_kind(s.user_id, p_window) … end case;` por:

```sql
  v_tipo := public.idle_opp_kind(s.user_id, p_window);
  v_lado := public.idle_horta_lado(coalesce(s.generators[11], 0));
  -- quem ainda não tem: o Adubo sem Horta (ou sem planta crescendo) e a Informação sem Bolsa pagam os 15 min (o tipo 0) no
  -- lugar; quem decide é a hora do clique
  if (v_tipo = 5 and not exists (
        select 1 from public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie
         where p.user_id = s.user_id and p.fim is null and p.inicio <= now()
           and p.canteiro / 6 < v_lado and p.canteiro % 6 < v_lado
           and p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s)) > now()))
     or (v_tipo = 7 and coalesce(s.generators[19], 0) < 1) then
    v_tipo := 0;
  end if;
  case v_tipo
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, v_lado, now()) b));
    -- cada ×5 conta sozinho e dura 1 minuto; com "rendem o dobro" entram v_n de uma vez (2: ×25)
    when 1 then s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now())
                               || array_fill(now() + interval '1 minute', array[v_n]);
    when 2 then s.meias := s.meias + v_n; -- cada uma guardada vale uma compra; com o dobro, guarda duas
    when 3 then s.chamados := least(3, coalesce(s.chamados, 0) + v_n); -- Chamar um dourado: no máximo 3 (o que passa se perde)
    when 4 then -- Cupom de primeira compra: 10 compras de gerador 25% mais baratas (20 no dobro)
      s.cupons := coalesce(s.cupons, 0) + 10 * v_n;
      s.dourados_cont := public.idle_cont_mais(s.dourados_cont, 'cupons', 1);
      perform public.idle_ganhar(s.user_id, 'cupons', (s.dourados_cont ->> 'cupons')::double precision);
    when 5 then -- Adubo de farmácia: as v_n plantas crescendo mais perto de ficar maduras amadurecem agora (a conta já fechou)
      update public.idle_horta_plantas p set amadurece_s = extract(epoch from now() - p.inicio)
       where p.id in (select p2.id from public.idle_horta_plantas p2 join public.idle_cat_horta k on k.id = p2.especie
                       where p2.user_id = s.user_id and p2.fim is null and p2.inicio <= now()
                         and p2.canteiro / 6 < v_lado and p2.canteiro % 6 < v_lado
                         and p2.inicio + make_interval(secs => coalesce(p2.amadurece_s, k.amadurece_s)) > now()
                       order by p2.inicio + make_interval(secs => coalesce(p2.amadurece_s, k.amadurece_s)), p2.id
                       limit v_n);
    when 6 then -- Cashback: 30% de volta em toda compra por 2 min (4 no dobro), somando no fim do que já tem
      s.cashback_ate := greatest(coalesce(s.cashback_ate, now()), now()) + make_interval(secs => 120 * v_n);
    else -- Informação privilegiada: créditos de Espiar na Bolsa
      s.info_creditos := coalesce(s.info_creditos, 0) + v_n;
  end case;
```

Comentário do topo: `-- pegar oportunidade (a da 0063) com os 5 tipos novos (0076)`.

Depois, ainda na parte D:

```sql
-- a empresa m está espiada agora? (o humor espiado vale até ele virar: o mesmo humor_ate de quando espiou, sem RJ)
create or replace function public.idle_bolsa_espiada(s public.idle_state, m public.idle_bolsa_mercado, p_agora bigint)
returns boolean language sql immutable set search_path = public as $$
  select coalesce(m.rj_ate is null and m.humor_ate > p_agora
                  and (s.espiadas -> m.empresa::text ->> 'ate_tick')::bigint = m.humor_ate, false)
$$;
revoke all on function public.idle_bolsa_espiada(public.idle_state, public.idle_bolsa_mercado, bigint) from public, anon, authenticated;

-- Espiar (Informação privilegiada): gasta 1 crédito e mostra o humor da empresa e em quantos minutos ele muda, até virar
create or replace function public.idle_bolsa_espiar_em(p_user uuid, p_empresa int, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  m public.idle_bolsa_mercado;
begin
  s := public.idle_lock(p_user);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.generators[19], 0) < 1 then
    raise exception 'idle_bolsa_fechada' using errcode = 'P0001';
  end if;
  select * into m from public.idle_bolsa_mercado where empresa = p_empresa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if m.rj_ate is not null then
    raise exception 'idle_bolsa_rj' using errcode = 'P0001';
  end if;
  if public.idle_bolsa_espiada(s, m, p_agora) then
    raise exception 'idle_info_ja' using errcode = 'P0001';
  end if;
  if coalesce(s.info_creditos, 0) < 1 then
    raise exception 'idle_info_sem_credito' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  s.info_creditos := s.info_creditos - 1;
  s.espiadas := coalesce(s.espiadas, '{}'::jsonb)
                || jsonb_build_object(p_empresa::text, jsonb_build_object('ate_tick', m.humor_ate, 'em', now()));
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;
revoke all on function public.idle_bolsa_espiar_em(uuid, int, bigint) from public, anon, authenticated;

create or replace function public.idle_bolsa_espiar(p_empresa int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.idle_bolsa_espiar_em(auth.uid(), p_empresa, public.idle_bolsa_avancar());
end;
$$;
revoke all on function public.idle_bolsa_espiar(int) from public, anon;
grant execute on function public.idle_bolsa_espiar(int) to authenticated;
```

Depois, **copie inteira** `idle_bolsa_estado` (0051) e mude só:
- comentário do topo: `-- o que a Bolsa mostra (o da 0051) + os créditos de Espiar e o humor espiado (com "muda em", 0076)`;
- no objeto das empresas, a linha do `'humor'` vira:
  ```sql
        'humor', case when v_vs or public.idle_bolsa_espiada(s, m, p_agora) then m.humor end, -- VSauce sentado ou espiada
        'espiada', public.idle_bolsa_espiada(s, m, p_agora),
        'muda_em', case when public.idle_bolsa_espiada(s, m, p_agora) then greatest(1, m.humor_ate - p_agora) end,
  ```
- depois de `'corretagem', …,`: `'info_creditos', coalesce(s.info_creditos, 0),`.

E **copie inteira** `idle_bolsa_negociar_em` (0051, a de 7 argumentos) e mude só: comentário `-- negociar (o da 0051) + a Insider (shh) na venda (0076)` e, no ramo `else` (vender), depois do `end if;` do `if v_lote = 1 … else … end if;` e antes do `update public.idle_bolsa_carteira`:

```sql
    -- Insider (shh), escondida (0076): vendeu com 100% de lucro (o preço da venda, por ação, no mínimo o dobro do que pagou
    -- com a corretagem) uma ação de empresa espiada nas últimas 2 h
    if (case when v_lote = 1 then m.valor else v_por end) >= 2 * (v_custo / v_tem)
       and (s.espiadas -> p_empresa::text ->> 'em')::timestamptz >= now() - interval '2 hours' then
      perform public.idle_ganhar(p_user, 'insider', 1);
    end if;
```

Mantenha os `revoke`/`grant` delas (os da 0051: `revoke all on function public.idle_bolsa_negociar_em(uuid, int, text, int, bigint, bigint, double precision) from public, anon, authenticated;`; o `idle_bolsa_estado` tem o `revoke` da 0043: `revoke all on function public.idle_bolsa_estado(uuid, bigint) from public, anon, authenticated;`).

- [ ] **Step 3: Tipos, api, mock da api, erros e `RECARREGA_BOLSA`**

`games/shared/types.ts`: em `BolsaEmpresa`, depois de `humor?: number | null`: `/** espiada com a Informação privilegiada (0076): o humor vale até mudar, em `muda_em` minutos */ espiada?: boolean; muda_em?: number | null`. Em `BolsaEstado`, depois de `corretagem: number;`: `/** créditos de Espiar (Informação privilegiada, 0076) */ info_creditos?: number;`.

`games/shared/api.ts`, depois de `idleBolsaNegociar`:

```ts
export const idleBolsaEspiar = (empresa: number) => rpc<IdleState & { bolsa: BolsaEstado }>('idle_bolsa_espiar', { p_empresa: empresa });
```

`games/dev/mockIdle.ts`, depois de `idleBolsaNegociar`:

```ts
export const idleBolsaEspiar = (empresa: number) => call<IdleState & { bolsa: BolsaEstado }>('select public.idle_bolsa_espiar($1) as v', [empresa]);
```

`games/shared/errors.ts`: `| 'idle_info_sem_credito' | 'idle_info_ja'` no tipo (junto dos de Bolsa), em `ERROR_TEXT` `idle_info_sem_credito: 'Sem Informação privilegiada. Ela vem na Caixinha',` e `idle_info_ja: 'Você já está de olho nessa empresa',`, e os dois em `FROM_DB`.

`games/idle/bolsa.ts:83`: acrescente `'idle_info_sem_credito', 'idle_info_ja'` em `RECARREGA_BOLSA`. Em `games/idle/bolsaMain.test.ts`, depois da linha 23: `expect(RECARREGA_BOLSA).toContain('idle_info_ja');`.

Run: `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts test/idleBolsa.test.ts test/idle.test.ts test/idleConquistas.test.ts test/idleHorta.test.ts idle/bolsaMain.test.ts shared && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0076_fellas_inc_dourados_caixinha.sql games/shared/types.ts games/shared/api.ts games/shared/errors.ts games/dev/mockIdle.ts games/idle/bolsa.ts games/idle/bolsaMain.test.ts games/test/idleDouradosCaixinha.test.ts
git commit -m "Fellas Inc.: Chamar, Cupom, Adubo, Cashback e Informação na Caixinha; o Espiar e a Insider na Bolsa (0076)"
```

---

### Task 6: Os dourados novos na tela (ícones, chuva, Pix, rolo, Combo, selos, Chamar, caixinhas, sons, `?mock`)

Antes de começar: `git merge main` no worktree (Global Constraints). O código de tela novo fica em arquivos próprios (`douradoTela.ts`, `combo.ts`, `selosTela.ts`, `dourados.css`); `tela.ts` e `main.ts` só ganham as ligações, e `idle.css` não muda. Use as cores e a fonte que estiverem no `idle.css` da main na hora (os hex abaixo são os da paleta dos ícones de hoje; se a repaginação trocou a paleta do `.dourado`/`.selo-bonus`, siga a nova).

**Files:**
- Modify: `games/idle/convidados.ts:129-151` (`eventoDaSorte`, `eventoEm` com os garantidos)
- Create: `games/idle/combo.ts`, `games/idle/combo.test.ts`
- Modify: `games/idle/dourados.ts` (`selosBonus` com os selos novos, `Selo`, `FRASES_LINKEDIN`, `fraseLinkedin`, `textoDourado`)
- Modify: `games/idle/dica.ts` (`dicaDourado`)
- Modify: `games/idle/douradoTela.ts` (reescrito: ícones 4–7 e a moedinha, chuva, escolha do Pix, rolo, selo "2×", caixinha)
- Create: `games/idle/selosTela.ts`, `games/idle/dourados.css`
- Modify: `games/idle/tela.ts` (`Acoes`, `criarDouradoTela`, `relogioBonus`), `games/idle/main.ts` (import do CSS, `Api`, `pegarDourado`, `chamarDourado`, garantidos, `RECARREGA`)
- Modify: `games/idle/audio/efeitos.ts`, `games/idle/audio/efeitos.test.ts:16`
- Modify: `games/dev/mockIdle.ts` (painel: os 4 dourados, Combo, Chamar, garantido em dobro)
- Test: `games/idle/convidados.test.ts`, `games/idle/dourados.test.ts`, `games/idle/dica.test.ts`, `games/idle/douradoTela.test.ts`, `games/idle/tela.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 (`tipoDourado`, `sorteioDourado`, `SAL`, as constantes, `escolhaLinkedin`, `rendasGeradores`, `IdleState` novo, `DouradoPago`, `Garantido`, `api.idleDouradoPegar(seg, lado, moedas)`, `api.idleDouradoChamar()`).
- Produces: `type EventoDourado = { tipo: TipoDourado; janelaS: number; dobro: boolean }`, `eventoDaSorte(s, seg): EventoDourado | null`, `eventoEm(s, seg): EventoDourado | null` (`convidados.ts`); `comboAgora(s, agoraMs): number` (`combo.ts`); `type Selo = { texto: string; ouro: boolean; dica?: Dica; acao?: 'chamar'; classe?: string }`, `selosBonus(s, agoraMs, o: { viralMs?: number; combo?: number; duracao?: number } = {}): Selo[]`, `FRASES_LINKEDIN`, `fraseLinkedin(uid, seg): string`, `textoDourado(d: DouradoPago, o: { viral: number; duracao: number; frase: string }): string` (`dourados.ts`); `dicaDourado(tipo: TipoDourado, s: IdleState, o: { seg: number; dobro?: boolean }): Dica | null` (`dica.ts`); `criarDouradoTela(raiz, aoPegar: (seg: number, lado: number, moedas?: number) => void, o: OpcoesDourado = {})` devolvendo `{ mostrar, tick, subirTexto, pararTigre(seg: number, pagou: boolean | null, aoParar?: () => void) }`, `EventoNaTela` ganha `dobro?: boolean`, `MOEDINHAS = 25` (`douradoTela.ts`); `desenharSelo(x: Selo, chamar: () => void): HTMLElement` e `rotuloCombo(texto: string): string` (`selosTela.ts`); `Acoes.pegarDourado(seg: number, lado: number, moedas?: number): void` e `Acoes.chamarDourado(): void` (`tela.ts`); efeitos `'trend' | 'linkedin' | 'pix' | 'tigreGira' | 'tigrePaga' | 'tigreCome' | 'combo'`.

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-dourados && git merge main
```

Conflito: fique com o visual da main e reponha por cima só as linhas das Tasks 1–5. Depois: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle` → PASS.

- [ ] **Step 1: Testes da lógica da tela (falham)**

Em `games/idle/convidados.test.ts` (import `eventoDaSorte, eventoEm` de `./convidados`):

```ts
describe('eventos com os garantidos (0076)', () => {
  const U = '4a681416-b4ee-4976-8cdd-540cc816f28c';
  const base = { user_id: U, generators: Array(30).fill(0) };
  it('o garantido vem primeiro, com o tipo e o dobro dele; sem garantido, a sorte', () => {
    let x = 1_760_000_000;
    while (eventoDaSorte(base, x) !== null) x++; // um segundo sem dourado da sorte
    expect(eventoEm(base, x)).toBeNull();
    expect(eventoEm({ ...base, garantidos: [{ seg: x, tipo: 2, dobro: true }] }, x)).toEqual({ tipo: 2, janelaS: 12, dobro: true });
    let y = x;
    while (eventoDaSorte(base, y) === null) y++;
    expect(eventoEm(base, y)).toEqual({ ...eventoDaSorte(base, y)!, dobro: false });
  });
});
```

Crie `games/idle/combo.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { comboAgora } from './combo';
import { eventoDaSorte } from './convidados';

const U = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const base = { user_id: U, generators: Array(30).fill(0) };
/** O 1º segundo depois de `de` com um dourado da sorte que passa no filtro. */
const proximo = (de: number, ok: (t: number) => boolean) => {
  for (let x = de + 1; ; x++) {
    const e = eventoDaSorte(base, x);
    if (e && ok(e.tipo)) return x;
  }
};

describe('o Combo em andamento na página (a mesma regra de idle_combo_quebrou)', () => {
  it('sem combo: 0', () => {
    expect(comboAgora({ ...base, combo_n: 0, combo_seg: null }, Date.now())).toBe(0);
    expect(comboAgora(base, Date.now())).toBe(0);
  });
  it('2 pegos e nenhum dourado perdido depois: 2', () => {
    const de = 1_760_000_000;
    const x = proximo(de, () => true);
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: de }, (x - 1) * 1000)).toBe(2);
  });
  it('um dourado (não Tigrinho) passou da janela sem ser pego: quebrou; ainda na tela, não', () => {
    const de = 1_761_000_000;
    const x = proximo(de, (t) => t !== 7 && t !== 4 && t !== 6);
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: de }, (x + 12) * 1000)).toBe(2); // 12 s na tela + 3 de folga
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: de }, (x + 16) * 1000)).toBe(0);
  });
  it('Tigrinho ignorado não quebra', () => {
    let x = 1_762_000_000;
    for (;;) {
      x = proximo(x, (t) => t === 7);
      if (proximo(x, () => true) > x + 30) break; // o próximo dourado vem bem depois
    }
    expect(comboAgora({ ...base, combo_n: 1, combo_seg: x - 1 }, (x + 25) * 1000)).toBe(1);
  });
  it('o último pego há mais de 30 min: 0', () => {
    expect(comboAgora({ ...base, combo_n: 2, combo_seg: 1_763_000_000 }, (1_763_000_000 + 1801) * 1000)).toBe(0);
  });
});
```

Em `games/idle/dourados.test.ts` (acrescente `FRASES_LINKEDIN, fraseLinkedin, textoDourado` ao import, e `import { catalogo } from './catalogo';`):

```ts
describe('selos dos dourados novos e da Caixinha (0076)', () => {
  const T = Date.parse('2026-10-15T12:00:00Z');
  const em = (s: number) => new Date(T + s * 1000).toISOString();
  it('LinkedIn com o nome do gerador, Combo dourado, as bolinhas, Cupom, Cashback e o Chamar (botão), cada um com caixinha', () => {
    const l = selosBonus({ promo_ate: null, linkedin_ate: em(42), linkedin_gen: 2, linkedin_mult: 4.5, combo_ate: em(51), cupons: 7,
      cashback_ate: em(100), chamados: 2 }, T, { combo: 2 });
    expect(l.map((x) => x.texto)).toEqual([
      `${catalogo.geradores[1].nome} ×30 · 0:42`, 'Combo ×7 · 0:51', '●●○', 'Cupom · 7 restantes', 'Cashback 30% · 1:40', 'Chamar dourado (2)',
    ]);
    expect(l[1].ouro).toBe(true);
    expect(l[2]).toMatchObject({ classe: 'combo-bolinhas', dica: { titulo: 'Combo em andamento' } });
    expect(l[2].dica!.linhas[0].texto).toBe('Pegue mais 1 sem deixar nenhum sumir: produção ×7 por 1 min');
    expect(l[5]).toMatchObject({ acao: 'chamar', ouro: true });
    expect(l.every((x) => x.dica)).toBe(true);
  });
  it('1 cupom: "1 restante"; combo 0 ou já feito: sem bolinhas; com o Hype as bolinhas dizem 2 min', () => {
    expect(selosBonus({ promo_ate: null, cupons: 1 }, T).map((x) => x.texto)).toEqual(['Cupom · 1 restante']);
    expect(selosBonus({ promo_ate: null }, T, { combo: 0 })).toEqual([]);
    expect(selosBonus({ promo_ate: null }, T, { combo: 3 })).toEqual([]);
    expect(selosBonus({ promo_ate: null }, T, { combo: 1, duracao: 2 })[0].dica!.linhas[0].texto)
      .toBe('Pegue mais 2 sem deixar nenhum sumir: produção ×7 por 2 min');
  });
});

describe('o texto que sobe com os dourados novos', () => {
  const base = { lado: 0, ganho: 0, dobro: false, moedas: 0, gen: null, mult: null, garantido_seg: null, tigre: null, combo: false };
  const o = { viral: 1, duracao: 1, frase: FRASES_LINKEDIN[1] };
  it('Trend, LinkedIn, Pix, Tigrinho e o dobro', () => {
    expect(textoDourado({ ...base, tipo: 4, moedas: 14, ganho: 1_200_000 }, o)).toBe('14 moedinhas! +F$ 1,2 mi');
    expect(textoDourado({ ...base, tipo: 4, moedas: 1, ganho: 60 }, o)).toBe('1 moedinha! +F$ 60');
    expect(textoDourado({ ...base, tipo: 5 }, o)).toBe('Fui demitido. Melhor coisa que me aconteceu. #gratidão');
    expect(textoDourado({ ...base, tipo: 6, lado: 1 }, o)).toBe('Devolveu! Deus te pague (em até 2 min)');
    expect(textoDourado({ ...base, tipo: 6, ganho: 1_200_000 }, o)).toBe('+F$ 1,2 mi (ninguém viu)');
    expect(textoDourado({ ...base, tipo: 7, ganho: 2_000_000, tigre: { pagou: true, gratis: true, perdeu: 0, n: 1 } }, o)).toBe('Pagou! +F$ 2 mi');
    expect(textoDourado({ ...base, tipo: 7, tigre: { pagou: false, gratis: false, perdeu: 980_000, n: 5 } }, o)).toBe('O tigre comeu F$ 980 mil. Só mais uma?');
    expect(textoDourado({ ...base, tipo: 2, dobro: true }, o)).toBe('Viralizou! ×10 por 2 min');
    expect(textoDourado({ ...base, tipo: 0, ganho: 1_234_567 }, o)).toBe('+F$ 1,23 mi');
  });
  it('a frase do LinkedIn sai do segundo (uma das quatro, todas aparecem)', () => {
    const vistas = new Set<string>();
    for (let s = 1_760_000_000; s < 1_760_000_200; s++) vistas.add(fraseLinkedin(U, s));
    expect([...vistas].sort()).toEqual([...FRASES_LINKEDIN].sort());
  });
});
```

(Confira o formato de `formatarValor` em `formatar.test.ts`; se ele escrever "F$ 2 mi"/"F$ 980 mil"/"F$ 60" diferente, ajuste as strings esperadas, não o formatador.)

Em `games/idle/dica.test.ts` (import `dicaDourado`):

```ts
describe('a caixinha dos dourados novos na tela (0076)', () => {
  const U = '4a681416-b4ee-4976-8cdd-540cc816f28c';
  it('Trend: até 20 min de produção, quanto vale cada moedinha (no dobro, 40 min)', () => {
    const s = estado({ user_id: U, rate: 1000 });
    expect(textos(dicaDourado(4, s, { seg: 1 })!)[0]).toBe(`Até 20 min de produção: ${formatarValor(60_000)} por moedinha`);
    expect(textos(dicaDourado(4, s, { seg: 1, dobro: true })!)[0]).toBe(`Até 40 min de produção: ${formatarValor(120_000)} por moedinha`);
  });
  it('LinkedIn: o gerador que sai e quanto a produção sobe', () => {
    const s = comTaxa({ user_id: U, generators: gens({ 1: 10 }) }); // um gerador só: f = 1
    expect(textos(dicaDourado(5, s, { seg: 1_760_000_000 })!)).toEqual([`${catalogo.geradores[0].nome} ×30 por 1 min: produção +2.900%`]);
  });
  it('Pix: ficar agora × devolver', () => {
    expect(textos(dicaDourado(6, estado({ user_id: U, rate: 1000 }), { seg: 1 })!)).toEqual([`Ficar: ${formatarValor(1_800_000)} agora · Devolver: um dourado em dobro`]);
  });
  it('Tigrinho: as jogadas grátis de hoje; depois, a chance e quanto ganha ou perde', () => {
    expect(textos(dicaDourado(7, estado({ user_id: U, rate: 1000, tigre_n: 1 }), { seg: 1 })!)).toEqual(['Jogadas grátis hoje: 2 de 3', `Paga ${formatarValor(1_800_000)}`]);
    expect(textos(dicaDourado(7, estado({ user_id: U, rate: 1000, tigre_n: 3 }), { seg: 1 })!)).toEqual([
      'A casa paga 3 em cada 10', `Ganha ${formatarValor(1_800_000)} · perde ${formatarValor(900_000)}`]);
  });
  it('os de antes não têm caixinha', () => expect(dicaDourado(0, estado({ user_id: U }), { seg: 1 })).toBeNull());
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/convidados.test.ts idle/combo.test.ts idle/dourados.test.ts idle/dica.test.ts`
Expected: FAIL.

- [ ] **Step 2: A lógica da tela**

`games/idle/convidados.ts`: import `type Garantido` de `../shared/types`; `ComCadeiras` ganha `garantidos?: readonly Garantido[]`; troque `eventoEm` (linhas 134-142) por:

```ts
export type EventoDourado = { tipo: TipoDourado; janelaS: number; dobro: boolean };
/** O evento da sorte do segundo `seg` (a sorte com o Gemaplys e o ramo Dourados, ou a faixa do MC V.V), sem os garantidos,
 *  e quanto fica na tela. A frequência da árvore entra como peso a mais no extra do Gemaplys (igual a idle_dourado_pegar). */
export function eventoDaSorte(s: ComCadeiras, seg: number): EventoDourado | null {
  const { c, ppp } = ctx(s);
  const gema = peso(c, ppp, GEMAPLYS);
  const ef = efeitosArvore(catalogo, s.bonus?.arvore ?? []);
  const tipo = douradoEm(s.user_id, seg, gema + ef.douradoFreq - 1) ?? faixaEm(s.user_id, c, ppp, seg);
  return tipo === null ? null : { tipo, janelaS: janelaS(gema, ef.douradoTela), dobro: false };
}
/** O evento do segundo `seg`: um garantido (Pix devolvido, Chamar; 0076) primeiro, com o tipo e o dobro dele; senão a sorte. */
export function eventoEm(s: ComCadeiras, seg: number): EventoDourado | null {
  const g = s.garantidos?.find((x) => x.seg === seg);
  if (!g) return eventoDaSorte(s, seg);
  const { c, ppp } = ctx(s);
  const ef = efeitosArvore(catalogo, s.bonus?.arvore ?? []);
  return { tipo: g.tipo as TipoDourado, janelaS: janelaS(peso(c, ppp, GEMAPLYS), ef.douradoTela), dobro: g.dobro };
}
```

Crie `games/idle/combo.ts`:

```ts
// Combo (0076): pegar 3 dourados seguidos sem nenhum sumir no meio dá ×7 por 1 min. Quem conta é o banco (combo_n,
// combo_seg); a página só descobre se o combo em andamento já quebrou: um dourado da sorte (não Tigrinho) depois do último
// pego, que passou da janela sem ser pego. A mesma regra de idle_combo_quebrou. Olha cada segundo uma vez só (guarda até
// onde já olhou, por jogador e combo_seg).
import { eventoDaSorte } from './convidados';
import { CHUVA_S, COMBO_JANELA_S } from './dourados';

type ComCombo = Parameters<typeof eventoDaSorte>[0] & { combo_n?: number; combo_seg?: number | null };
const vistos = new Map<string, { ate: number; quebrou: boolean }>();

/** Quantos dourados o combo em andamento já tem agora (0 = nenhum ou quebrou). */
export function comboAgora(s: ComCombo, agoraMs: number): number {
  const n = s.combo_n ?? 0;
  const de = s.combo_seg ?? null;
  if (n <= 0 || de === null) return 0;
  const agoraS = agoraMs / 1000;
  if (de < Math.floor(agoraS) - COMBO_JANELA_S) return 0;
  const chave = `${s.user_id}:${de}`;
  if (vistos.size > 50 && !vistos.has(chave)) vistos.clear();
  const v = vistos.get(chave) ?? { ate: de, quebrou: false };
  for (let x = v.ate + 1; !v.quebrou && x < agoraS; x++) {
    const e = eventoDaSorte(s, x);
    // um segundo com dourado só fica decidido quando a janela dele passa (a da tela + os 8 s do Trend/Pix + 3 s de folga)
    if (e && agoraS <= x + e.janelaS + (e.tipo === 4 || e.tipo === 6 ? CHUVA_S : 0) + 3) break;
    if (e && e.tipo !== 7) v.quebrou = true;
    v.ate = x;
  }
  vistos.set(chave, v);
  return v.quebrou ? 0 : n;
}
```

`games/idle/dourados.ts` (import `{ catalogo } from './catalogo'`, `CHAMADOS_MAX` de `./oportunidades`, `type DouradoPago` de `../shared/types`). `ComBonus` ganha `linkedin_ate?: string | null; linkedin_gen?: number | null; linkedin_mult?: number | null; combo_ate?: string | null; cupons?: number; cashback_ate?: string | null; chamados?: number;`. Antes de `selosBonus`:

```ts
/** Um selo ao lado do F$: o texto, se é dourado, a caixinha, se é botão (o Chamar) e uma classe a mais (as bolinhas). */
export type Selo = { texto: string; ouro: boolean; dica?: Dica; acao?: 'chamar'; classe?: string };
const dois = (x: number) => (Math.round(x * 100) / 100).toLocaleString('pt-BR');
```

A assinatura vira `export function selosBonus(s: ComBonus, agoraMs: number, o: { viralMs?: number; combo?: number; duracao?: number } = {}): Selo[]` (com `const out: Selo[] = [];`) e, depois do selo da Atualização (antes do `return out;`):

```ts
  // dourados novos e Caixinha (0076): LinkedIn, Combo (e as bolinhas do que está em andamento), Cupom, Cashback e o Chamar
  if (s.linkedin_ate && s.linkedin_gen && Date.parse(s.linkedin_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.linkedin_ate) - agoraMs);
    const nome = catalogo.geradores[s.linkedin_gen - 1]?.nome ?? 'Gerador';
    out.push({ texto: `${nome} ×${LINKEDIN_MULT} · ${falta}`, ouro: false, dica: { titulo: 'Bombou no LinkedIn', linhas: [
      { texto: `${nome} rende ×${LINKEDIN_MULT}` }, { texto: `Produção ×${dois(s.linkedin_mult ?? 1)} no total` },
      { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  if (s.combo_ate && Date.parse(s.combo_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.combo_ate) - agoraMs);
    out.push({ texto: `Combo ×${COMBO_MULT} · ${falta}`, ouro: true, dica: { titulo: 'Combo', linhas: [
      { texto: `Produção ×${COMBO_MULT}, por cima de todo o resto` }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  const n = o.combo ?? 0;
  if (n > 0 && n < COMBO_PRECISA) {
    const resta = COMBO_PRECISA - n;
    const dur = o.duracao ?? 1;
    out.push({ texto: '●'.repeat(n) + '○'.repeat(resta), ouro: false, classe: 'combo-bolinhas', dica: { titulo: 'Combo em andamento', linhas: [
      { texto: `Pegue mais ${resta} sem deixar nenhum sumir: produção ×${COMBO_MULT} por ${dois(dur)} min` }] } });
  }
  const cupons = s.cupons ?? 0;
  if (cupons > 0) {
    out.push({ texto: `Cupom · ${cupons} ${cupons === 1 ? 'restante' : 'restantes'}`, ouro: false, dica: { titulo: 'Cupom de primeira compra', linhas: [
      { texto: 'Cada compra de gerador (1, 10 ou Máx) sai 25% mais barata' },
      { texto: `Faltam ${cupons} ${cupons === 1 ? 'compra' : 'compras'}` },
      { texto: 'Com Promoção ou meia-preço o cupom fica guardado', tom: 'fraco' }] } });
  }
  if (s.cashback_ate && Date.parse(s.cashback_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.cashback_ate) - agoraMs);
    out.push({ texto: `Cashback 30% · ${falta}`, ouro: false, dica: { titulo: 'Cashback', linhas: [
      { texto: 'Toda compra devolve 30% do preço na hora' }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  const chamados = s.chamados ?? 0;
  if (chamados > 0) {
    out.push({ texto: `Chamar dourado (${chamados})`, ouro: true, acao: 'chamar', dica: { titulo: 'Chamar um dourado', linhas: [
      { texto: 'Clique: um dourado aparece no segundo seguinte (sem Pix nem Tigrinho)' },
      { texto: `Você tem ${chamados} de ${CHAMADOS_MAX}`, tom: 'fraco' }] } });
  }
```

E no fim de `dourados.ts`:

```ts
/** As frases do post de coach que sobem com o LinkedIn (uma por sorteio). */
export const FRASES_LINKEDIN = [
  'O Estagiário me ensinou mais sobre liderança do que meu MBA',
  'Fui demitido. Melhor coisa que me aconteceu. #gratidão',
  'Acordo às 4h. Meu concorrente ainda está dormindo',
  'Recusei uma oferta do Google pra seguir meu propósito',
] as const;
export const fraseLinkedin = (uid: string, seg: number): string => FRASES_LINKEDIN[sorteioDourado(uid, seg, SAL.frase, FRASES_LINKEDIN.length)];

/** O texto que sobe quando pega (com o que o banco pagou). `viral` = os Viralizou valendo depois; `duracao` = o Hype. */
export function textoDourado(d: DouradoPago, o: { viral: number; duracao: number; frase: string }): string {
  if (d.tipo <= 3) return textoPegou(d.tipo as TipoDourado, { ganho: d.ganho, viral: o.viral, duracao: o.duracao * (d.dobro ? 2 : 1) });
  if (d.tipo === 4) return `${d.moedas} ${d.moedas === 1 ? 'moedinha' : 'moedinhas'}! +${formatarValor(d.ganho)}`;
  if (d.tipo === 5) return o.frase;
  if (d.tipo === 6) return d.lado === 1 ? 'Devolveu! Deus te pague (em até 2 min)' : `+${formatarValor(d.ganho)} (ninguém viu)`;
  return d.tigre?.pagou ? `Pagou! +${formatarValor(d.ganho)}` : `O tigre comeu ${formatarValor(d.tigre?.perdeu ?? 0)}. Só mais uma?`;
}
```

`games/idle/dica.ts` (import `{ CHUVA_S, escolhaLinkedin, LINKEDIN_MULT, MOEDINHA_S, PIX_FICAR_S, TIGRE_CHANCE, TIGRE_COME_S, TIGRE_GRATIS, TIGRE_PAGA_S, TREND_MAX, type TipoDourado }` de `./dourados`, `efeitosDe, rendasGeradores` de `./economia`), no fim:

```ts
/** A caixinha dos dourados novos na tela (Trend, LinkedIn, Pix, Tigrinho; 0076): o que dá agora, nos números da pessoa.
 *  Os de antes (Investidor, Promoção, Viralizou) não têm. `dobro` = o garantido do Pix devolvido. */
export function dicaDourado(tipo: TipoDourado, s: IdleState, o: { seg: number; dobro?: boolean }): Dica | null {
  const d = o.dobro ? 2 : 1;
  if (tipo === 4) {
    return { titulo: 'Trend do TikTok', linhas: [
      { texto: `Até ${TREND_MAX * d} min de produção: ${formatarValor(s.rate * MOEDINHA_S * d)} por moedinha` },
      { texto: `Chovem moedinhas por ${CHUVA_S} s: clique nelas`, tom: 'fraco' }] };
  }
  if (tipo === 5) {
    const e = escolhaLinkedin(s.user_id, o.seg, rendasGeradores(catalogo, s));
    if (!e) return null;
    const min = efeitosDe(catalogo, s).douradoDuracao * d;
    return { titulo: 'Bombou no LinkedIn', linhas: [
      { texto: `${catalogo.geradores[e.gen - 1].nome} ×${LINKEDIN_MULT} por ${num(min)} min: produção +${num((LINKEDIN_MULT - 1) * e.f * 100, 0)}%` }] };
  }
  if (tipo === 6) {
    return { titulo: 'Pix errado', linhas: [{ texto: `Ficar: ${formatarValor(s.rate * PIX_FICAR_S)} agora · Devolver: um dourado em dobro` }] };
  }
  if (tipo === 7) {
    const gratis = Math.max(0, TIGRE_GRATIS - (s.tigre_n ?? 0));
    const ganha = formatarValor(s.rate * TIGRE_PAGA_S);
    return { titulo: 'Tigrinho', linhas: gratis > 0
      ? [{ texto: `Jogadas grátis hoje: ${gratis} de ${TIGRE_GRATIS}` }, { texto: `Paga ${ganha}`, tom: 'bom' }]
      : [{ texto: `A casa paga ${TIGRE_CHANCE / 10} em cada 10` }, { texto: `Ganha ${ganha} · perde ${formatarValor(s.rate * TIGRE_COME_S)}`, tom: 'ruim' }] };
  }
  return null;
}
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/convidados.test.ts idle/combo.test.ts idle/dourados.test.ts idle/dica.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Testes de `douradoTela` (falham)**

Em `games/idle/douradoTela.test.ts`, acrescente no fim:

```ts
describe('os dourados novos na tela (0076)', () => {
  it('cada um com o seu ícone e o nome pro leitor de tela; o garantido em dobro mostra "2×"', () => {
    for (const [tipo, nome] of [[4, 'Trend do TikTok'], [5, 'Bombou no LinkedIn'], [6, 'Pix errado'], [7, 'Tigrinho']] as const) {
      d.mostrar(ev({ seg: T / 1000 + tipo, tipo }));
      const b = raiz.querySelector<HTMLElement>(`.dourado-${tipo}`)!;
      expect(b.getAttribute('aria-label')).toBe(`Pegar: ${nome}`);
      expect(b.querySelector('svg.icone-dourado')).not.toBeNull();
    }
    d.mostrar(ev({ seg: T / 1000 + 20, dobro: true }));
    const dobro = raiz.querySelector<HTMLElement>('.dourado.dobro')!;
    expect(dobro.querySelector('.dobro-selo')!.textContent).toBe('2×');
    expect(dobro.getAttribute('aria-label')).toBe('Pegar: Investidor apressado (em dobro)');
  });
  it('a caixinha só nos novos (o 3º parâmetro liga)', () => {
    const dica = vi.fn();
    d = criarDouradoTela(raiz, pegar, { dica });
    d.mostrar(ev());
    d.mostrar(ev({ seg: T / 1000 + 1, tipo: 5 }));
    expect(dica).toHaveBeenCalledTimes(1);
    expect(dica).toHaveBeenCalledWith(expect.any(HTMLElement), `dourado-${T / 1000 + 1}`, 5, T / 1000 + 1, false);
  });
  it('Trend: o clique abre a chuva de 25 moedinhas; cada clique conta; em 8 s manda quantas pegou', () => {
    let relogio = 0;
    const som = vi.fn();
    d = criarDouradoTela(raiz, pegar, { agora: () => relogio, som });
    d.mostrar(ev({ tipo: 4 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-4')!.click();
    expect(pegar).not.toHaveBeenCalled();
    const moedas = [...raiz.querySelectorAll<HTMLButtonElement>('.chuva .moedinha')];
    expect(moedas).toHaveLength(25);
    moedas.slice(0, 3).forEach((m) => m.click());
    expect(raiz.querySelector('.chuva-placar')!.textContent).toBe('3 moedinhas');
    expect(som).toHaveBeenCalledTimes(3);
    relogio = 7_900;
    d.tick(T + 7_900);
    expect(pegar).not.toHaveBeenCalled();
    relogio = 8_000;
    d.tick(T + 8_000);
    expect(pegar.mock.calls).toEqual([[T / 1000, 0, 3]]);
    expect(raiz.querySelector('.chuva')).toBeNull();
  });
  it('Pix: o clique abre Ficar / Devolver (sem relógio); a escolha vai no lado; some sozinha na janela + 8 s', () => {
    d.mostrar(ev({ tipo: 6 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-6')!.click();
    expect(pegar).not.toHaveBeenCalled();
    const bts = [...raiz.querySelectorAll<HTMLButtonElement>('.pix-escolha button')];
    expect(bts.map((b) => b.textContent)).toEqual(['Ficar', 'Devolver']);
    bts[1].click();
    bts[0].click();
    expect(pegar.mock.calls).toEqual([[T / 1000, 1]]);
    const seg2 = T / 1000 + 30;
    d.mostrar(ev({ seg: seg2, tipo: 6, agoraMs: T + 30_000 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-6')!.click();
    d.tick(seg2 * 1000 + 19_900);
    expect(raiz.querySelector('.pix-escolha')).not.toBeNull();
    d.tick(seg2 * 1000 + 20_000); // 12 s + 8 s
    expect(raiz.querySelector('.pix-escolha')).toBeNull();
    expect(pegar).toHaveBeenCalledTimes(1);
  });
  it('Tigrinho: o clique pega na hora e gira o rolo; para no resultado do banco no mínimo 1,5 s depois do clique', () => {
    vi.useFakeTimers();
    let relogio = 0;
    const som = vi.fn();
    d = criarDouradoTela(raiz, pegar, { agora: () => relogio, som });
    d.mostrar(ev({ tipo: 7 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-7')!.click();
    expect(pegar.mock.calls).toEqual([[T / 1000, 0]]);
    expect(raiz.querySelector('.tigre-rolo.girando')).not.toBeNull();
    expect(som).toHaveBeenCalledWith('tigreGira');
    const parou = vi.fn();
    relogio = 400;
    d.pararTigre(T / 1000, false, parou);
    expect(parou).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1100);
    expect(parou).toHaveBeenCalledTimes(1);
    expect(raiz.querySelector('.tigre-rolo')!.textContent).toBe('COMEU');
    vi.advanceTimersByTime(1300);
    expect(raiz.querySelector('.tigre-rolo')).toBeNull();
  });
  it('Tigrinho: erro no banco (pagou = null) só tira o rolo', () => {
    d.mostrar(ev({ tipo: 7 }));
    raiz.querySelector<HTMLButtonElement>('.dourado-7')!.click();
    d.pararTigre(T / 1000, null);
    expect(raiz.querySelector('.tigre-rolo')).toBeNull();
  });
});
```

(`ev` monta um evento com `tipo: 0 as const`; se o TypeScript reclamar de `tipo: 4` etc., troque o tipo do campo no `ev` por `TipoDourado` importado de `./dourados`.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/douradoTela.test.ts`
Expected: FAIL.

- [ ] **Step 4: `douradoTela.ts` (reescrito)**

Substitua `games/idle/douradoTela.ts` inteiro por:

```ts
// Eventos na tela (tipo cookie dourado): o ícone de pixel num ponto sorteado, com brilho, balançando, e um anel que
// esvazia na janela (pisca nos 3 últimos s). Clicar chama `aoPegar` (o banco confere). Os novos (0076) fazem algo antes:
// o Trend abre a chuva de moedinhas (8 s; manda quantas pegou), o Pix abre a escolha (Ficar / Devolver; vai no lado) e
// o Tigrinho gira o rolo (pega na hora; o resultado vem do banco em `pararTigre`). Também o texto que sobe quando pega.
import { CHUVA_S, JANELA_S, type TipoDourado } from './dourados';

export const NOME_DOURADO: Record<TipoDourado, string> = {
  0: 'Investidor apressado', 1: 'Promoção relâmpago', 2: 'Viralizou', 3: 'Viralizou', 4: 'Trend do TikTok', 5: 'Bombou no LinkedIn',
  6: 'Pix errado', 7: 'Tigrinho',
};
/** Moedinhas que caem num Trend (o banco conta até 20). */
export const MOEDINHAS = 25;
/** O rolo do Tigrinho gira pelo menos isto (ms) antes de parar no resultado. */
const ROLO_MS = 1500;

// ícones 12 × 12, uma letra por pixel (cor na paleta; '.' = vazio)
const PALETA: Record<string, string> = {
  D: '#5A3A1E', B: '#8B5A2B', Y: '#F2D27A', G: '#5FD38D', R: '#E0454B', K: '#1E1B2E', C: '#5AA9E6', H: '#FF5A7A', W: '#F4F1EA',
  A: '#2A5BD7', O: '#F07A2A', V: '#2E9E5B',
};
type Icone = 0 | 1 | 2 | 4 | 5 | 6 | 7 | 'moeda';
const ICONES: Record<Icone, readonly string[]> = {
  // maleta com as notas escapando
  0: [
    '....DDDD....', '....D..D....', '..GG.DD.GG..', '.GGBBBBBBGG.', '.BBBBBBBBBB.', '.BBBBYYBBBB.',
    '.DDDDYYDDDD.', '.BBBBBBBBBB.', '.BBBBBBBBBB.', '.BBBBBBBBBB.', '.DDDDDDDDDD.', '............',
  ],
  // relâmpago amarelo no selo vermelho
  1: [
    '....RRRR....', '..RRRRRRRR..', '.RRRRRYYRRR.', '.RRRRYYRRRR.', 'RRRRYYRRRRRR', 'RRRYYYYYYRRR',
    'RRRRRRYYRRRR', 'RRRRRYYRRRRR', '.RRRYYRRRRR.', '.RRRYRRRRRR.', '..RRRRRRRR..', '....RRRR....',
  ],
  // celular com corações saindo
  2: [
    '...KKKKKK...', '...KCCCCK..H', '...KCHHCK.HH', '..HKHHHHK...', '..HKCHHCK...', '...KCCCCK...',
    '...KCCCCK.H.', '...KCCCCKHHH', '...KCCCCK.H.', '...KCCCCK...', '...KKWKKK...', '............',
  ],
  // Trend do TikTok: a nota musical com a sombra rosa e azul
  4: [
    '............', '......HKKK..', '......KWWKC.', '......KWKWKC', '......KWK.KC', '......KWK...',
    '..HKKKKWK...', '.HKWWWWWKC..', '.HKWWWWWKC..', '..KWWWWK.C..', '...KKKKCC...', '............',
  ],
  // Bombou no LinkedIn: a maleta azul
  5: [
    '............', '....AAAA....', '....A..A....', '.AAAAAAAAAA.', '.ACCCCCCCCA.', '.ACCCCCCCCA.',
    '.AAAAWWAAAA.', '.ACCCWWCCCA.', '.ACCCCCCCCA.', '.ACCCCCCCCA.', '.AAAAAAAAAA.', '............',
  ],
  // Pix errado: o losango verde (sem o logo do Pix)
  6: [
    '.....GG.....', '....GGGG....', '...GGVVGG...', '..GGVWWVGG..', '.GGVWWWWVGG.', 'GGVWWVVWWVGG',
    'GGVWWVVWWVGG', '.GGVWWWWVGG.', '..GGVWWVGG..', '...GGVVGG...', '....GGGG....', '.....GG.....',
  ],
  // Tigrinho: a cabeça do tigre
  7: [
    '.OO......OO.', '.OKO....OKO.', '.OOOOOOOOOO.', 'OOKOOOOOOKOO', 'OWWKOOOOKWWO', 'OWKWOOOOWKWO',
    'OOOOOKKOOOOO', 'OKOOOKKOOOKO', '.OKOWWWWOKO.', '..OWWKKWWO..', '...OWWWWO...', '....OOOO....',
  ],
  // a moedinha do Trend (o jogo não tinha moeda: decisão do plano)
  moeda: [
    '....YYYY....', '..YYDDDDYY..', '.YDYYYYYYDY.', '.YDYYKKYYDY.', 'YDYYKYYYYYDY', 'YDYYYKKYYYDY',
    'YDYYYYYKYYDY', 'YDYYKKKYYYDY', '.YDYYKYYYDY.', '.YDYYYYYYDY.', '..YYDDDDYY..', '....YYYY....',
  ],
};

const NS = 'http://www.w3.org/2000/svg';
function icone(tipo: Icone): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', 'icone-dourado');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  const porCor = new Map<string, string>();
  ICONES[tipo].forEach((linha, y) =>
    [...linha].forEach((c, x) => {
      if (c !== '.') porCor.set(c, `${porCor.get(c) ?? ''}M${x} ${y}h1v1h-1z`);
    }),
  );
  for (const [c, d] of porCor) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', PALETA[c]);
    svg.append(p);
  }
  return svg;
}
function anel(): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 64 64');
  svg.setAttribute('class', 'anel');
  svg.setAttribute('aria-hidden', 'true');
  const c = document.createElementNS(NS, 'circle');
  c.setAttribute('cx', '32');
  c.setAttribute('cy', '32');
  c.setAttribute('r', '29');
  c.setAttribute('pathLength', '100');
  svg.append(c);
  return svg;
}

export type EventoNaTela = {
  seg: number; lado: number; tipo: TipoDourado; x: number; y: number; agoraMs: number;
  /** s na tela (Gemaplys encurta) */ janelaS?: number; /** garantido do Pix devolvido: rende o dobro */ dobro?: boolean;
};
export type OpcoesDourado = {
  /** liga a caixinha de informação (mouse/teclado) nos dourados novos */
  dica?(alvo: HTMLElement, chave: string, tipo: TipoDourado, seg: number, dobro: boolean): void;
  /** a moedinha pega e o rolo girando (os outros sons são do main, com a resposta do banco) */
  som?(id: 'trend' | 'tigreGira'): void;
  /** relógio local (ms) da chuva e do rolo; os testes trocam */
  agora?(): number;
};

export function criarDouradoTela(raiz: HTMLElement, aoPegar: (seg: number, lado: number, moedas?: number) => void, o: OpcoesDourado = {}) {
  const agora = o.agora ?? (() => Date.now());
  const camada = document.createElement('div');
  camada.className = 'dourados';
  raiz.append(camada);
  const ativos = new Map<string, { botao: HTMLButtonElement; ateMs: number }>();
  const encerrados = new Set<string>(); // pegos ou passados: não voltam
  // o que vem depois do clique: a chuva do Trend (uma por vez), a escolha do Pix e o rolo do Tigrinho
  let chuva: { seg: number; el: HTMLElement; ate: number; moedas: number } | null = null;
  const escolhas = new Map<number, { el: HTMLElement; ateMs: number }>();
  const rolos = new Map<number, { el: HTMLElement; desde: number }>();

  function tirar(chave: string) {
    ativos.get(chave)?.botao.remove();
    ativos.delete(chave);
    encerrados.add(chave);
  }
  /** Um elemento no ponto do evento (o CSS prende dentro da tela, como o .dourado). */
  function noPonto(el: HTMLElement, e: EventoNaTela) {
    el.style.setProperty('--x', `${Math.round(e.x * 100)}%`);
    el.style.top = `${Math.round(e.y * 100)}%`;
  }

  function fecharChuva() {
    if (!chuva) return;
    const c = chuva;
    chuva = null;
    c.el.remove();
    aoPegar(c.seg, 0, c.moedas);
  }
  function abrirChuva(seg: number) {
    fecharChuva(); // uma por vez: a anterior manda o que tinha
    const el = document.createElement('div');
    el.className = 'chuva'; // trava a tela atrás por 8 s: clique que erra a moedinha não compra nada
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', 'Chuva de moedinhas: clique nelas');
    const placar = document.createElement('div');
    placar.className = 'chuva-placar';
    placar.setAttribute('role', 'status');
    placar.textContent = '0 moedinhas';
    el.append(placar);
    const c = { seg, el, ate: agora() + CHUVA_S * 1000, moedas: 0 };
    for (let i = 0; i < MOEDINHAS; i++) {
      const m = document.createElement('button');
      m.type = 'button';
      m.className = 'moedinha';
      m.setAttribute('aria-label', 'Pegar moedinha');
      // espalhadas na largura (o segundo é a semente) e caindo uma atrás da outra; sem animação, paradas em --y
      m.style.left = `${6 + (((seg * 37 + i * 53) % 89) / 89) * 88}%`;
      m.style.setProperty('--y', `${12 + ((i * 37) % 76)}%`);
      m.style.animationDelay = `${((i * (CHUVA_S - 2.4)) / MOEDINHAS).toFixed(2)}s`;
      m.append(icone('moeda'));
      m.addEventListener('click', () => {
        if (chuva !== c) return;
        c.moedas++;
        placar.textContent = `${c.moedas} ${c.moedas === 1 ? 'moedinha' : 'moedinhas'}`;
        m.remove();
        o.som?.('trend');
      });
      el.append(m);
    }
    camada.append(el);
    chuva = c;
  }
  function abrirEscolha(e: EventoNaTela, ateMs: number) {
    const el = document.createElement('div');
    el.className = 'pix-escolha';
    el.setAttribute('role', 'group');
    el.setAttribute('aria-label', 'Pix errado: ficar ou devolver');
    noPonto(el, e);
    const texto = document.createElement('p');
    texto.textContent = 'Caiu um Pix errado na sua conta';
    const escolher = (lado: number) => {
      if (!escolhas.has(e.seg)) return;
      escolhas.get(e.seg)!.el.remove();
      escolhas.delete(e.seg);
      aoPegar(e.seg, lado);
    };
    const botoes = (['Ficar', 'Devolver'] as const).map((rot, lado) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn';
      b.textContent = rot;
      b.addEventListener('click', () => escolher(lado));
      return b;
    });
    el.append(texto, ...botoes);
    camada.append(el);
    escolhas.set(e.seg, { el, ateMs });
  }
  function girarRolo(e: EventoNaTela) {
    const el = document.createElement('div');
    el.className = 'tigre-rolo girando';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-label', 'Tigrinho girando');
    noPonto(el, e);
    const faixa = document.createElement('span');
    faixa.className = 'rolo-faixa';
    faixa.textContent = 'F$ 7 ★ F$ 7 ★';
    el.append(faixa);
    camada.append(el);
    rolos.set(e.seg, { el, desde: agora() });
    o.som?.('tigreGira');
  }

  return {
    /** Mostra o evento (se ainda dá tempo e não apareceu antes). A dupla chama duas vezes, lado 0 e 1. */
    mostrar(e: EventoNaTela) {
      const chave = `${e.seg}:${e.lado}`;
      const janela = e.janelaS ?? JANELA_S;
      const ateMs = e.seg * 1000 + janela * 1000;
      if (ativos.has(chave) || encerrados.has(chave) || e.agoraMs >= ateMs) return;
      const t = e.tipo;
      const ic: Icone = t === 3 ? 2 : t;
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `dourado dourado-${ic}${e.dobro ? ' dobro' : ''}`;
      b.setAttribute('aria-label', `Pegar: ${NOME_DOURADO[t]}${e.dobro ? ' (em dobro)' : ''}`);
      // a dupla lado a lado, o segundo pro lado que tem espaço; o CSS prende dentro da tela (clamp)
      const pct = Math.round(e.x * 100);
      b.style.setProperty('--x', e.lado !== 1 ? `${pct}%` : `calc(${pct}% ${e.x > 0.5 ? '-' : '+'} 84px)`);
      b.style.top = `${Math.round(e.y * 100)}%`;
      if (e.janelaS !== undefined) b.style.setProperty('--janela', `${e.janelaS}s`);
      b.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      b.append(anel(), icone(ic));
      if (e.dobro) {
        const selo = document.createElement('span');
        selo.className = 'dobro-selo';
        selo.setAttribute('aria-hidden', 'true');
        selo.textContent = '2×';
        b.append(selo);
      }
      b.addEventListener('click', () => {
        if (!ativos.has(chave)) return;
        tirar(chave);
        if (t === 4) abrirChuva(e.seg);
        else if (t === 6) abrirEscolha(e, (e.seg + janela + CHUVA_S) * 1000);
        else {
          if (t === 7) girarRolo(e);
          aoPegar(e.seg, e.lado);
        }
      });
      camada.append(b);
      ativos.set(chave, { botao: b, ateMs });
      if (t >= 4) o.dica?.(b, `dourado-${e.seg}`, t, e.seg, !!e.dobro);
    },
    /** A cada passo da página: tira o que passou do tempo (ícones, escolhas do Pix) e fecha a chuva no fim dos 8 s. */
    tick(agoraMs: number) {
      for (const [chave, a] of ativos) if (agoraMs >= a.ateMs) tirar(chave);
      for (const [seg, x] of escolhas) {
        if (agoraMs >= x.ateMs) {
          x.el.remove();
          escolhas.delete(seg);
        }
      }
      if (chuva && agora() >= chuva.ate) fecharChuva();
    },
    /** O texto que sobe quando pega ("+F$ 1,2 mi", "×100!"), no ponto do evento. */
    subirTexto(texto: string, x: number, y: number) {
      const t = document.createElement('div');
      t.className = 'dourado-texto';
      t.setAttribute('role', 'status');
      t.textContent = texto;
      t.style.left = `${Math.round(x * 100)}%`;
      t.style.top = `${Math.round(y * 100)}%`;
      camada.append(t);
      setTimeout(() => t.remove(), 1600);
    },
    /** O banco respondeu o Tigrinho: o rolo para no resultado (no mínimo 1,5 s depois do clique), chama `aoParar` e some
     *  1,2 s depois. `pagou` null = deu erro: o rolo só some. */
    pararTigre(seg: number, pagou: boolean | null, aoParar?: () => void) {
      const r = rolos.get(seg);
      if (!r) return;
      if (pagou === null) {
        rolos.delete(seg);
        r.el.remove();
        return;
      }
      const parar = () => {
        rolos.delete(seg);
        r.el.classList.remove('girando');
        r.el.classList.add(pagou ? 'pagou' : 'comeu');
        r.el.setAttribute('aria-label', pagou ? 'Tigrinho pagou' : 'Tigrinho comeu');
        r.el.replaceChildren(document.createTextNode(pagou ? 'PAGOU' : 'COMEU'));
        aoParar?.();
        setTimeout(() => r.el.remove(), 1200);
      };
      const falta = r.desde + ROLO_MS - agora();
      if (falta > 0) setTimeout(parar, falta);
      else parar();
    },
  };
}
```

Crie `games/idle/dourados.css` (carregado pelo `main.ts`; tudo dos dourados novos e dos selos novos fica aqui, fora do `idle.css`):

```css
/* Dourados novos e selos novos (entrega 5, 0076). As peças ficam na camada .dourados (fixa, por cima de tudo); a posição
   usa o mesmo --x/top do .dourado e o clamp que o prende dentro da tela. */
.idle .dourado .dobro-selo { position: absolute; right: 2px; top: 2px; padding: 0 4px; font: 400 16px var(--i-pixel); color: #1E1B2E;
  background: #F2D27A; box-shadow: 0 0 0 2px #1E1B2E; }
/* Trend: a chuva cobre a tela (trava os cliques de trás por 8 s) e as moedinhas caem uma atrás da outra */
.idle .chuva { position: absolute; inset: 0; pointer-events: auto; background: rgba(30, 27, 46, 0.18); }
.idle .chuva-placar { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); padding: 2px 10px; font: 400 22px var(--i-pixel);
  color: #F2D27A; background: #1E1B2E; box-shadow: 0 0 0 2px #F2D27A; }
.idle .moedinha { position: absolute; top: -10%; width: 40px; height: 40px; margin-left: -20px; padding: 0; border: 0; background: none;
  cursor: pointer; animation: moedinha-cai 2.4s linear forwards; }
.idle .moedinha .icone-dourado { width: 40px; height: 40px; image-rendering: pixelated; filter: drop-shadow(0 0 4px rgba(242, 210, 122, 0.8)); }
.idle .moedinha:focus-visible { outline: 2px solid #F2D27A; outline-offset: 2px; }
@keyframes moedinha-cai { from { top: -10%; } to { top: 110%; } }
/* Pix: a escolha no ponto do ícone */
.idle .pix-escolha { position: absolute; left: clamp(120px, var(--x, 50%), calc(100% - 120px)); transform: translate(-50%, -50%);
  display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 10px; pointer-events: auto; background: #1E1B2E;
  box-shadow: 0 0 0 2px #5FD38D; font: 400 18px var(--i-pixel); color: #F4F1EA; }
.idle .pix-escolha p { grid-column: 1 / -1; margin: 0; text-align: center; }
/* Tigrinho: o rolo gira e para em PAGOU / COMEU */
.idle .tigre-rolo { position: absolute; left: clamp(70px, var(--x, 50%), calc(100% - 70px)); transform: translate(-50%, -50%);
  width: 120px; height: 44px; overflow: hidden; display: grid; place-items: center; background: #1E1B2E; box-shadow: 0 0 0 2px #F07A2A;
  font: 400 26px var(--i-pixel); color: #F2D27A; pointer-events: none; }
.idle .tigre-rolo .rolo-faixa { display: block; white-space: nowrap; }
.idle .tigre-rolo.girando .rolo-faixa { animation: rolo-gira 0.18s steps(3) infinite; }
.idle .tigre-rolo.pagou { color: #F2D27A; box-shadow: 0 0 0 2px #F2D27A, 0 0 18px rgba(242, 210, 122, 0.6); }
.idle .tigre-rolo.comeu { color: #E0454B; box-shadow: 0 0 0 2px #E0454B; }
@keyframes rolo-gira { from { transform: translateX(0); } to { transform: translateX(-50%); } }
/* selos novos: o Chamar é botão; as bolinhas do combo */
.idle button.selo-bonus.selo-acao { border: 0; cursor: pointer; }
.idle button.selo-bonus.selo-acao:focus-visible { outline: 2px solid #F4F1EA; outline-offset: 2px; }
.idle .selo-bonus.combo-bolinhas { letter-spacing: 2px; }
@media (prefers-reduced-motion: reduce) {
  .idle .moedinha { animation: none; top: var(--y, 50%); }
  .idle .tigre-rolo.girando .rolo-faixa { animation: none; }
}
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/douradoTela.test.ts`
Expected: PASS (os testes antigos de `douradoTela.test.ts` continuam: `aoPegar(seg, lado)` com 2 argumentos nos de antes).

- [ ] **Step 5: Sons**

Em `games/idle/audio/efeitos.ts`, acrescente `'trend', 'linkedin', 'pix', 'tigreGira', 'tigrePaga', 'tigreCome', 'combo'` no fim de `IDS_EFEITOS`, `'combo'` em `GRANDES` e, no fim de `RECEITAS` (depois de `douradoPego`):

```ts
  // dourados novos (0076), afinados em Fá
  trend: (c, d, t) => { // moedinha curta, uma por clique
    moeda(c, d, t, 89, 0.08, 0.6);
    return 0.15;
  },
  linkedin: (c, d, t) => { // plim de notificação
    sininho(c, d, t, 84, 0.12, 0.7);
    sininho(c, d, t + 0.09, 89, 0.3, 0.7);
    return 0.5;
  },
  pix: (c, d, t) => { // caixa registradora: o trinco e as moedas
    caixa(c, d, t, 0, 0.06, 0.5);
    moeda(c, d, t + 0.06, 96, 0.2, 0.8);
    moeda(c, d, t + 0.13, 101, 0.3, 0.7);
    return 0.5;
  },
  tigreGira: (c, d, t) => { // o rolo: notinhas subindo e voltando
    [77, 81, 84, 89, 84, 81, 77, 81, 84, 89].forEach((m, i) => moeda(c, d, t + i * 0.13, m, 0.06, 0.35));
    return 1.4;
  },
  tigrePaga: (c, d, t) => {
    acorde(c, d, t, [77, 81, 84], 0.4, 0.8);
    [89, 93, 96, 101].forEach((m, i) => sininho(c, d, t + 0.1 + i * 0.06, m, 0.25, 0.6));
    return 1.0;
  },
  tigreCome: (c, d, t) => { // trombone descendo
    metais(c, d, t, 70, 0.22, 0.6);
    metais(c, d, t + 0.24, 65, 0.5, 0.6);
    return 0.8;
  },
  combo: (c, d, t) => { // fanfarra curta: Fá, Si bemol, Dó, Fá
    acorde(c, d, t, [65, 69, 72], 0.1, 0.8);
    acorde(c, d, t + 0.12, [70, 74, 77], 0.1, 0.8);
    acorde(c, d, t + 0.24, [72, 76, 79], 0.1, 0.85);
    acorde(c, d, t + 0.38, [77, 81, 84], 0.7, 1);
    sininho(c, d, t + 0.38, 96, 0.5, 0.6);
    return 1.2;
  },
```

Em `games/idle/audio/efeitos.test.ts:16`, acrescente `'trend', 'linkedin', 'pix', 'tigreGira', 'tigrePaga', 'tigreCome', 'combo'` na lista esperada. (A página de audição lista `IDS_EFEITOS` sozinha.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/audio`
Expected: PASS.

- [ ] **Step 6: Ligar na tela (o mínimo em `tela.ts`) e no `main.ts`**

Crie `games/idle/selosTela.ts`:

```ts
// Um selo ao lado do F$ (dourados.ts selosBonus): span com caixinha (foco no teclado) ou, no Chamar, botão. As bolinhas
// do combo têm um nome pro leitor de tela ("Combo: 2 de 3").
import { button, el } from '../shared/hud/hud';
import type { Selo } from './dourados';

export const rotuloCombo = (texto: string) => `Combo: ${[...texto].filter((c) => c === '●').length} de ${[...texto].length}`;

export function desenharSelo(x: Selo, chamar: () => void): HTMLElement {
  const cls = `selo-bonus${x.ouro ? ' ouro' : ''}${x.classe ? ` ${x.classe}` : ''}`;
  if (x.acao === 'chamar') return button(x.texto, `${cls} selo-acao`, chamar);
  const e = el('span', cls, x.texto);
  if (x.classe === 'combo-bolinhas') e.setAttribute('aria-label', rotuloCombo(x.texto));
  if (x.dica) e.tabIndex = 0; // caixinha também no foco do teclado
  return e;
}
```

Em `games/idle/tela.ts` (sem mexer em layout nem classes do visual):
- Imports: `import { comboAgora } from './combo';`, `import { desenharSelo, rotuloCombo } from './selosTela';`, `dicaDourado` no import de `./dica`, `VIRAL_MS` no import de `./economia`.
- `Acoes`: troque `pegarDourado(seg: number, lado: number): void;` por `pegarDourado(seg: number, lado: number, moedas?: number): void; chamarDourado(): void;`.
- A criação dos dourados vira:

```ts
  const dourados = criarDouradoTela(app, (seg, lado, moedas) => {
    dicas.conferir(); // o ícone saiu: a caixinha dele fecha
    if (moedas === undefined) a.pegarDourado(seg, lado);
    else a.pegarDourado(seg, lado, moedas);
  }, {
    dica: (alvo, chave, tipo, seg, dobro) => dicas.ligar(alvo, chave, () => (ultimo?.estado ? dicaDourado(tipo, ultimo.estado, { seg, dobro }) : null)),
    som: (id) => a.efeito(id),
  });
```

- Em `relogioBonus`, a 1ª linha vira:

```ts
    const dur = s ? efeitosDe(catalogo, s).douradoDuracao : 1;
    const lista = s ? selosBonus(s, agoraMs, { viralMs: VIRAL_MS * dur, combo: comboAgora(s, agoraMs), duracao: dur }) : [];
```

  a conta de `mesmos` compara também `x.acao === antes[i].acao && x.classe === antes[i].classe`; na troca de texto no lugar, depois de `selos.children[i].textContent = x.texto;`, acrescente `if (x.classe === 'combo-bolinhas') selos.children[i].setAttribute('aria-label', rotuloCombo(x.texto));`; e o `selos.replaceChildren(...)` vira:

```ts
    selos.replaceChildren(...lista.map((x, i) => {
      const e = desenharSelo(x, () => a.chamarDourado());
      if (x.dica) dicas.ligar(e, `selo-${i}`, () => selosAgora[i]?.dica ?? null);
      return e;
    }));
```

Em `games/idle/tela.test.ts`, no objeto `acoes` (linha 40), acrescente `chamarDourado: vi.fn<Acoes['chamarDourado']>(),` e o teste:

```ts
  it('selos novos: o Chamar é um botão (chamarDourado); Cupom e Cashback com o tempo', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const T = Date.parse('2026-10-12T12:00:00.000Z');
    const em = (s: number) => new Date(T + s * 1000).toISOString();
    tela.relogioBonus(estado({ chamados: 2, cupons: 7, cashback_ate: em(100) }), T);
    expect([...root.querySelectorAll('.selo-bonus')].map((x) => x.textContent)).toEqual(['Cupom · 7 restantes', 'Cashback 30% · 1:40', 'Chamar dourado (2)']);
    root.querySelector<HTMLButtonElement>('button.selo-acao')!.click();
    expect(acoes.chamarDourado).toHaveBeenCalledTimes(1);
  });
```

Em `games/idle/main.ts`:
- Depois de `import './idle.css';`: `import './dourados.css';`.
- `Api`: acrescente `'idleDouradoChamar'`.
- Imports: troque `ganhoInvestidor, JANELA_S, posicao, promoAtiva, textoPegou, type TipoDourado` por `COMBO_MULT, fraseLinkedin, JANELA_S, posicao, promoAtiva, textoDourado, viraisAtivos, type TipoDourado` (de `./dourados`) e acrescente `import { VIRAL_MS } from './economia';`.
- `RECARREGA`: acrescente `'idle_chamar_vazio'`.
- `mostrarDourado(seg, tipo, agoraMs, janelaS = JANELA_S, dobro = false)` repassa `dobro` em `tela.dourados.mostrar({ seg, lado, tipo, x: p.x, y: p.y, agoraMs, janelaS, dobro })`.
- A ação `pegarDourado` vira:

```ts
  // fora do guard: pegar não espera outra compra terminar (o evento some em 12 s)
  pegarDourado: (seg, lado, moedas = 0) => void (async () => {
    const s0 = ancora?.estado;
    if (!s0 || !mostrados.has(seg)) return;
    const p = posicao(s0.user_id, seg, lado);
    try {
      const s = await api.idleDouradoPegar(seg, lado, moedas);
      aplicar(s);
      const d = s.dourado;
      const ef = efeitos(s0); // Investidor anjo e Hype mudam o que o texto diz
      const texto = d ? textoDourado(d, { viral: viraisAtivos(s, Date.parse(s.server_now), VIRAL_MS * ef.douradoDuracao).length,
        duracao: ef.douradoDuracao, frase: fraseLinkedin(s0.user_id, seg) }) : null;
      const subir = () => { if (chaves.avisos && texto) tela.dourados.subirTexto(texto, p.x, p.y); };
      if (d?.tipo === 7) {
        // o rolo para no resultado: só aí toca e sobe o texto
        tela.dourados.pararTigre(seg, !!d.tigre?.pagou, () => {
          audio.tocar(d.tigre?.pagou ? 'tigrePaga' : 'tigreCome');
          subir();
        });
      } else {
        audio.tocar(d?.tipo === 5 ? 'linkedin' : d?.tipo === 6 ? 'pix' : 'douradoPego');
        subir();
      }
      if (d?.combo) {
        audio.tocar('combo');
        const min = ef.douradoDuracao === 1 ? '1 min' : `${ef.douradoDuracao.toLocaleString('pt-BR')} min`;
        if (chaves.avisos) tela.dourados.subirTexto(`C-C-C-Combo! ×${COMBO_MULT} por ${min}`, p.x, Math.min(0.85, p.y + 0.08));
      }
    } catch (e) {
      tela.dourados.pararTigre(seg, null);
      const err = toGameError(e);
      if (err.code === 'no_session') fase = 'sem_sessao';
      else if (err.code !== 'idle_dourado_pego') {
        audio.tocar('erro');
        aviso = err.message;
      }
      await recarregar().catch(() => undefined);
      render();
    }
  })(),
  chamarDourado: () => void guard(async () => {
    aplicar(await api.idleDouradoChamar());
    audio.tocar('pegar');
  }),
```

- No passo de 1 s, o `for` dos dourados passa o dobro (`if (e) mostrarDourado(x, e.tipo, agoraMs, e.janelaS, e.dobro);`) e, logo depois dele:

```ts
    // garantidos (Pix devolvido, Chamar) que chegaram depois do segundo deles: aparecem mesmo assim, até a janela passar
    for (const g of ancora.estado.garantidos ?? []) {
      if (g.seg > seg || mostrados.has(g.seg)) continue;
      const e = eventoEm(ancora.estado, g.seg);
      if (e) mostrarDourado(g.seg, e.tipo, agoraMs, e.janelaS, e.dobro);
    }
```

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`
Expected: PASS.

- [ ] **Step 7: `?mock`**

Em `games/dev/mockIdle.ts`: o comentário do `__dourado` passa a listar `0 Investidor, 1 Promoção, 2 Viralizou, 3 dupla, 4 Trend, 5 LinkedIn, 6 Pix, 7 Tigrinho`; no painel, `const nomes = ['Investidor', 'Promoção', 'Viralizou', 'Dupla ×100', 'Trend', 'LinkedIn', 'Pix', 'Tigrinho'];`; e, depois do `forEach` dos dourados:

```ts
  // Combo (o próximo pego fecha), 3 dourados pra chamar e um garantido em dobro no segundo seguinte
  const extras: [string, () => Promise<void>][] = [
    ['Combo: falta 1', () => dono('update public.idle_state set combo_n = 2, combo_seg = $2 where user_id = $1', [ME, Math.floor(Date.now() / 1000) - 1]).then(avisar)],
    ['Chamar ×3', () => dono('update public.idle_state set chamados = 3 where user_id = $1', [ME]).then(avisar)],
    ['Garantido em dobro', () => dono(`update public.idle_state set garantidos = garantidos || jsonb_build_array(jsonb_build_object('seg', $2::bigint, 'tipo', 0, 'dobro', true)) where user_id = $1`,
      [ME, Math.floor(Date.now() / 1000) + 2]).then(avisar)],
  ];
  for (const [nome, f] of extras) {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#5B3FD9;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void f());
    painel.append(b);
  }
```

(`avisar` já existe mais abaixo no arquivo, no bloco dos convidados: mova a declaração `const avisar = () => document.dispatchEvent(new Event('visibilitychange'));` pra antes do painel, se o TypeScript reclamar do uso antes da declaração.)

Run: `cd games && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Conferir no navegador**

Suba o vite dos jogos (`cd games && npx vite --port 5199 --strictPort`, em segundo plano) e abra `http://localhost:5199/games/idle/?mock`. Antes de tudo, mute: `localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')` e recarregue. Pelo painel "mock ▸", force cada dourado novo e confira em 1280×720, 2000×961 e num iframe de 390 px (uma aba com `data:text/html,<iframe src="http://localhost:5199/games/idle/?mock" width="390" height="844"></iframe>`): o ícone e o anel; a caixinha no mouse e no Tab (no celular, nenhuma); o Trend (25 moedinhas caindo, o placar contando, a tela de trás travada, o texto no fim); o Pix (Ficar e Devolver; devolver faz um dourado "2×" aparecer de 20 a 120 s depois); o Tigrinho (o rolo gira e para em PAGOU/COMEU com o texto); o LinkedIn (o selo com o nome do gerador e a frase); "Combo: falta 1" + pegar um dourado (fanfarra, "C-C-C-Combo!", selo dourado; e as bolinhas ●●○ antes); "Chamar ×3" (o selo-botão e o dourado no segundo seguinte). Nada sai da tela na direita nem embaixo. Mate o vite da 5199 no fim (PowerShell: `Get-NetTCPConnection -LocalPort 5199 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`) e confira que não sobrou node.

- [ ] **Step 9: Commit**

```bash
git add games/idle/convidados.ts games/idle/convidados.test.ts games/idle/combo.ts games/idle/combo.test.ts games/idle/dourados.ts games/idle/dourados.test.ts games/idle/dica.ts games/idle/dica.test.ts games/idle/douradoTela.ts games/idle/douradoTela.test.ts games/idle/dourados.css games/idle/selosTela.ts games/idle/tela.ts games/idle/tela.test.ts games/idle/main.ts games/idle/audio games/dev/mockIdle.ts
git commit -m "Fellas Inc.: os dourados novos na tela (chuva, Pix, rolo), o Combo, os selos novos, o Chamar e os sons"
```

---

### Task 7: A Caixinha e a Bolsa na tela (textos, desenhos, caixinhas, Espiar, preços com cupom, cashback)

Antes de começar: `git merge main` no worktree (Global Constraints). Como na Task 6: o novo fica em arquivos próprios (`oportunidades.ts`, `dica.ts`, `bolsaTela.ts`, `caixinha.css`); em `tela.ts` só as ligações e os preços dos geradores; `idle.css` não muda.

**Files:**
- Modify: `games/idle/oportunidades.ts` (`textoOportunidade`, `temPlantaCrescendo`, `temBolsa`, `mockOportunidade`)
- Modify: `games/idle/dica.ts` (`dicaOportunidade` 3–7, `dicaEspiar`)
- Modify: `games/idle/bolsaTela.ts` (Espiar, humor espiado, caixinha)
- Create: `games/idle/assets/oportunidades/oportunidade-3.png` … `-7.png` (gerados), `games/idle/caixinha.css`
- Modify: `games/idle/tela.ts` (`Acoes.espiar`, `linhaGerador`, `itensCaixinha`, `criarBolsaTela`, a melhoria com cashback), `games/idle/main.ts` (CSS, `Api`, `espiar`, re-render do cashback)
- Modify: `games/dev/mockIdle.ts` (`__oportunidade`, painel)
- Test: `games/idle/oportunidades.test.ts`, `games/idle/dica.test.ts`, `games/idle/bolsaTela.test.ts`, `games/idle/ativos.test.ts`, `games/idle/tela.test.ts`

**Interfaces:**
- Consumes: Tasks 2, 3 e 5 (`TipoOportunidade`, `TEXTO_TIPO`, as constantes, `cupomVale`, `cashbackAtivo`, `IdleState.horta_crescendo/chamados/cupons/info_creditos/cashback_ate`, `BolsaEmpresa.espiada/muda_em`, `BolsaEstado.info_creditos`, `api.idleBolsaEspiar`); Task 1 (`node games/dev/iconesDourados.mjs oportunidades`).
- Produces: `textoOportunidade(k: TipoOportunidade, s: { generators: number[]; horta_crescendo?: number }): string`, `temPlantaCrescendo(s)`, `temBolsa(s)`, `mockOportunidade: { tipo: TipoOportunidade | null }` (`oportunidades.ts`); `dicaEspiar(nome: string, creditos: number): Dica` (`dica.ts`); `criarBolsaTela(a: { …; espiar?(empresa: number): void }, dica?: (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void)` e `renderizar(b, valuation, ocupado, alavanca = 1, vsauce = false)`; `Acoes.espiar(empresa: number): void`.

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-dourados && git merge main
```

Conflito: fique com o visual da main e reponha por cima só as linhas das Tasks 1–6. Depois: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle` → PASS.

- [ ] **Step 1: Testes (falham)**

Em `games/idle/oportunidades.test.ts` (import `mockOportunidade, textoOportunidade`):

```ts
describe('a linha da Caixinha (0076)', () => {
  const g = (x: Record<number, number>) => Array.from({ length: 30 }, (_, i) => x[i + 1] ?? 0);
  it('o nome do tipo; o Adubo sem Horta (ou sem planta crescendo) e a Informação sem Bolsa dizem o que pagam no lugar', () => {
    expect(textoOportunidade(4, { generators: g({}) })).toBe('Cupom de primeira compra');
    expect(textoOportunidade(5, { generators: g({}) })).toBe('Adubo de farmácia → sem planta crescendo: 15 min de produção');
    expect(textoOportunidade(5, { generators: g({ 11: 3 }), horta_crescendo: 0 })).toBe('Adubo de farmácia → sem planta crescendo: 15 min de produção');
    expect(textoOportunidade(5, { generators: g({ 11: 3 }), horta_crescendo: 2 })).toBe('Adubo de farmácia');
    expect(textoOportunidade(7, { generators: g({}) })).toBe('Informação privilegiada → sem Bolsa: 15 min de produção');
    expect(textoOportunidade(7, { generators: g({ 19: 1 }) })).toBe('Informação privilegiada');
  });
  it('?mock: o tipo forçado vale pra toda janela (e null volta à sorte)', () => {
    const antes = tipo(V, 2_980_000);
    mockOportunidade.tipo = 6;
    expect(tipo(V, 2_980_000)).toBe(6);
    mockOportunidade.tipo = null;
    expect(tipo(V, 2_980_000)).toBe(antes);
  });
});
```

Em `games/idle/dica.test.ts` (import `dicaEspiar`):

```ts
describe('a caixinha das oportunidades novas (0076)', () => {
  const comBolsa = (x: Partial<IdleState> = {}) => estado({ rate: 1000, generators: gens({ 19: 1, 11: 1 }), horta_crescendo: 1, ...x });
  it('Chamar: guarda 1 (no máximo 3); avisa quando já tem 3', () => {
    expect(textos(dicaOportunidade(comBolsa(), 3, 0)!)).toEqual(['Guarda 1 dourado pra chamar quando quiser (no máximo 3)']);
    expect(textos(dicaOportunidade(comBolsa({ chamados: 3 }), 3, 0)!)).toContain('Você já tem 3: este se perde');
  });
  it('Cupom: +10 cupons e o que já tem', () => {
    expect(textos(dicaOportunidade(comBolsa({ cupons: 4 }), 4, 0)!)).toEqual(['+10 cupons: cada compra de gerador sai 25% mais barata', 'Você tem 4']);
  });
  it('Adubo: a planta mais perto; sem planta crescendo, os 15 min em F$', () => {
    expect(textos(dicaOportunidade(comBolsa(), 5, 0)!)[0]).toBe('A planta mais perto de amadurecer fica madura na hora');
    expect(textos(dicaOportunidade(comBolsa({ horta_crescendo: 0 }), 5, 0)!)).toEqual([`Sem planta crescendo: ${formatarValor(900_000)} (15 min de produção) no lugar`]);
  });
  it('Cashback: 30% por 2 min', () => {
    expect(textos(dicaOportunidade(comBolsa(), 6, 0)!)[0]).toBe('Toda compra devolve 30% do preço por 2 min');
  });
  it('Informação: +1 crédito de Espiar; sem Bolsa, os 15 min em F$', () => {
    expect(textos(dicaOportunidade(comBolsa(), 7, 0)!)[0]).toBe('+1 crédito de Espiar: o humor de uma empresa da Bolsa até ele mudar');
    expect(textos(dicaOportunidade(estado({ rate: 1000 }), 7, 0)!)).toEqual([`Sem Bolsa: ${formatarValor(900_000)} (15 min de produção) no lugar`]);
  });
  it('Espiar', () => {
    expect(dicaEspiar('Pastelaria', 2)).toEqual({ titulo: 'Espiar', linhas: [
      { texto: 'Mostra o humor de Pastelaria até ele mudar · 1 crédito' }, { texto: 'Você tem 2', tom: 'fraco' }] });
  });
});
```

Em `games/idle/bolsaTela.test.ts`:

```ts
describe('o Espiar (0076)', () => {
  const espiada = { id: 1, valor: 33, limite: 120, risco: false, rj_ate: null, historico: [33], humor: 3, espiada: true, muda_em: 7 };
  it('com crédito, a empresa escolhida ganha "Espiar (n)" com caixinha; espiada, mostra o humor e em quantos min muda', () => {
    const espiar = vi.fn();
    const dica = vi.fn();
    document.body.innerHTML = '';
    tela = criarBolsaTela({ negociar, melhorar, espiar }, dica);
    document.body.append(tela.elemento);
    tela.renderizar(B({ info_creditos: 2 }), 1e9, false);
    const bt = [...document.querySelectorAll<HTMLButtonElement>('.bolsa-detalhe button')].find((b) => b.textContent === 'Espiar (2)')!;
    bt.click();
    expect(espiar).toHaveBeenCalledWith(1);
    expect(dica).toHaveBeenCalledWith(bt, 'espiar-1', expect.any(Function));
    expect(dica.mock.calls[0][2]()).toMatchObject({ titulo: 'Espiar' });
    tela.renderizar(B({ info_creditos: 1, empresas: [espiada] }), 1e9, false);
    expect(document.querySelector('.humor-vsauce')!.textContent).toBe('Espiado: subindo forte agora · muda em 7 min');
    expect([...document.querySelectorAll('.bolsa-detalhe button')].some((b) => b.textContent?.startsWith('Espiar'))).toBe(false);
    tela.renderizar(B({ info_creditos: 0, empresas: [espiada] }), 1e9, false, 1, true);
    expect(document.querySelector('.humor-vsauce')!.textContent).toBe('VSauce: subindo forte agora. Ou não? · muda em 7 min');
  });
  it('sem crédito ou sem a ação ligada, sem botão', () => {
    tela.renderizar(B({ info_creditos: 0 }), 1e9, false);
    expect([...document.querySelectorAll('.bolsa-detalhe button')].some((b) => b.textContent?.startsWith('Espiar'))).toBe(false);
    tela.renderizar(B({ info_creditos: 3 }), 1e9, false); // a tela do beforeEach não tem `espiar`
    expect([...document.querySelectorAll('.bolsa-detalhe button')].some((b) => b.textContent?.startsWith('Espiar'))).toBe(false);
  });
});
```

Em `games/idle/ativos.test.ts`, troque o teste "resolve as 3 oportunidades" por:

```ts
  it('resolve as 8 oportunidades, cada uma com 4 quadros de 24 px', () => {
    for (let k = 0; k <= 7; k++) {
      expect(naoVazia(ativos.oportunidade(k)), `oportunidade ${k}`).toBe(true);
      expect(dim(`oportunidades/oportunidade-${k}.png`)).toEqual([96, 24]);
    }
  });
```

Em `games/idle/tela.test.ts`: no objeto `acoes`, `espiar: vi.fn<Acoes['espiar']>(),`; e (import `OPP_CORTE, textoOportunidade, tipo` de `./oportunidades` se faltar; `preco` de `./economia` e `formatarValor` de `./formatar` se faltarem):

```ts
  it('caixinha: os tipos novos com o texto e o "no lugar" de quem não tem Horta', () => {
    const uid = '00000000-0000-0000-0000-00000000000a';
    let w = OPP_CORTE;
    while (tipo(uid, w) !== 5) w++;
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [w], estado: estado({ user_id: uid }) }));
    expect(root.querySelector('.modal-caixa .escolha strong')!.textContent).toBe('Adubo de farmácia → sem planta crescendo: 15 min de produção');
  });
  it('Cupom: os geradores saem 25% mais baratos (1, 10 e Máx); com meia-preço o "1" usa a meia e o cupom fica', () => {
    const tela = criarTela(root, acoes);
    const agora = Date.parse('2026-10-12T12:00:00.000Z');
    const s = estado({ generators: [5, ...Array(29).fill(0)], valuation: 1e6, cupons: 3 });
    const um = () => root.querySelector<HTMLButtonElement>('.gerador button[data-qtd="1"]')!.textContent;
    const cheio = preco(catalogo.geradores[0].custo, 5, 1, 1);
    tela.renderizar(modelo({ estado: s, agora }));
    expect(um()).toBe(formatarValor(cheio * 0.75));
    tela.renderizar(modelo({ estado: { ...s, meias: 1, half_price: true }, agora }));
    expect(um()).toBe(formatarValor(cheio * 0.5));
    tela.renderizar(modelo({ estado: { ...s, cupons: 0 }, agora }));
    expect(um()).toBe(formatarValor(cheio));
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/oportunidades.test.ts idle/dica.test.ts idle/bolsaTela.test.ts idle/ativos.test.ts idle/tela.test.ts`
Expected: FAIL.

- [ ] **Step 2: Textos e caixinhas**

`games/idle/oportunidades.ts`: no começo de `tipo`, `if (mockOportunidade.tipo !== null) return mockOportunidade.tipo;`, e:

```ts
/** Só o ?mock mexe: força o tipo de toda janela (dev/mockIdle.ts __oportunidade). */
export const mockOportunidade: { tipo: TipoOportunidade | null } = { tipo: null };

type ComGeradores = { generators: number[]; horta_crescendo?: number };
/** Tem Horta (Food truck) com planta crescendo: o Adubo tem o que amadurecer. */
export const temPlantaCrescendo = (s: ComGeradores) => (s.generators[10] ?? 0) >= 1 && (s.horta_crescendo ?? 0) > 0;
/** Tem Bolsa (Grupo de trader): a Informação vira crédito de Espiar. */
export const temBolsa = (s: ComGeradores) => (s.generators[18] ?? 0) >= 1;
/** A linha da Caixinha: o nome do tipo, ou o que ele paga no lugar pra quem ainda não tem Horta/Bolsa (igual ao banco). */
export function textoOportunidade(k: TipoOportunidade, s: ComGeradores): string {
  if (k === 5 && !temPlantaCrescendo(s)) return 'Adubo de farmácia → sem planta crescendo: 15 min de produção';
  if (k === 7 && !temBolsa(s)) return 'Informação privilegiada → sem Bolsa: 15 min de produção';
  return TEXTO_TIPO[k];
}
```

(Declare `mockOportunidade` antes de `tipo` no arquivo.)

`games/idle/dica.ts` (import `CASHBACK_S, CHAMADOS_MAX, CUPONS_POR_OPP, cashbackAtivo, temBolsa, temPlantaCrescendo` de `./oportunidades`): em `dicaOportunidade`, troque a 1ª linha (`if (tipo === 0 || tipo > 2) return null;`) por `if (tipo === 0) return null;` e, depois de `const rende = …`, antes do `if (tipo === 1)`:

```ts
  // 0076: os cinco novos, com a Xepa (c = 2) e o "no lugar" de quem não tem Horta/Bolsa
  const quinze = formatarValor(s.rate * 900 * c * (1 + (s.horta_bonus?.oportunidades ?? 0)));
  if (tipo === 3) {
    const tem = s.chamados ?? 0;
    const linhas: LinhaDica[] = [{ texto: c > 1 ? `${rende(c)}: guarda ${c} dourados pra chamar quando quiser (no máximo ${CHAMADOS_MAX})`
      : `Guarda 1 dourado pra chamar quando quiser (no máximo ${CHAMADOS_MAX})` }];
    if (tem >= CHAMADOS_MAX) linhas.push({ texto: `Você já tem ${CHAMADOS_MAX}: este se perde`, tom: 'ruim' });
    else if (tem + c > CHAMADOS_MAX) linhas.push({ texto: `Você já tem ${tem}: só ${CHAMADOS_MAX - tem} ${CHAMADOS_MAX - tem === 1 ? 'cabe' : 'cabem'}`, tom: 'ruim' });
    else if (tem) linhas.push({ texto: `Você tem ${tem}`, tom: 'fraco' });
    return { titulo: 'Chamar um dourado', linhas };
  }
  if (tipo === 4) {
    const linhas: LinhaDica[] = [{ texto: `+${CUPONS_POR_OPP * c} cupons: cada compra de gerador sai 25% mais barata` }];
    if (s.cupons) linhas.push({ texto: `Você tem ${s.cupons}`, tom: 'fraco' });
    return { titulo: 'Cupom de primeira compra', linhas };
  }
  if (tipo === 5) {
    if (!temPlantaCrescendo(s)) return { titulo: 'Adubo de farmácia', linhas: [{ texto: `Sem planta crescendo: ${quinze} (15 min de produção) no lugar`, tom: 'fraco' }] };
    return { titulo: 'Adubo de farmácia', linhas: [
      { texto: c > 1 ? `As ${c} plantas mais perto de amadurecer ficam maduras na hora` : 'A planta mais perto de amadurecer fica madura na hora' },
      { texto: `Crescendo agora: ${s.horta_crescendo}`, tom: 'fraco' }] };
  }
  if (tipo === 6) {
    const linhas: LinhaDica[] = [{ texto: `Toda compra devolve 30% do preço por ${(CASHBACK_S / 60) * c} min` }];
    if (cashbackAtivo(s, agoraMs)) linhas.push({ texto: 'Soma no fim do que já está valendo', tom: 'fraco' });
    return { titulo: 'Cashback', linhas };
  }
  if (tipo === 7) {
    if (!temBolsa(s)) return { titulo: 'Informação privilegiada', linhas: [{ texto: `Sem Bolsa: ${quinze} (15 min de produção) no lugar`, tom: 'fraco' }] };
    const linhas: LinhaDica[] = [{ texto: `+${c} ${c === 1 ? 'crédito' : 'créditos'} de Espiar: o humor de uma empresa da Bolsa até ele mudar` }];
    if (s.info_creditos) linhas.push({ texto: `Você tem ${s.info_creditos}`, tom: 'fraco' });
    return { titulo: 'Informação privilegiada', linhas };
  }
```

e no fim de `dica.ts`:

```ts
/** A caixinha do "Espiar" da Bolsa (0076). */
export function dicaEspiar(nome: string, creditos: number): Dica {
  return { titulo: 'Espiar', linhas: [{ texto: `Mostra o humor de ${nome} até ele mudar · 1 crédito` }, { texto: `Você tem ${creditos}`, tom: 'fraco' }] };
}
```

`games/idle/bolsaTela.ts` (import `type Dica, dicaEspiar` de `./dica`):
- assinatura: `export function criarBolsaTela(a: { negociar(...): void; melhorar(...): void; espiar?(empresa: number): void }, dica?: (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void)`;
- `renderizar(b, valuation, ocupado, alavanca = 1, vsauce = false)` (e o `ultimo` guarda os 5 valores);
- no detalhe, troque a linha do `humor-vsauce` (linha 180) por:

```ts
      // o humor: o VSauce sentado mostra ("Ou não?"); espiado (Informação privilegiada, 0076) diz também quando muda
      if (m.humor !== undefined && m.humor !== null) {
        const humor = (HUMOR[m.humor] ?? '').toLowerCase();
        const muda = m.espiada && m.muda_em ? ` · muda em ${m.muda_em} min` : '';
        linhaPreco.append(el('span', 'humor-vsauce', m.espiada && !vsauce ? `Espiado: ${humor} agora${muda}` : `VSauce: ${humor} agora. Ou não?${muda}`));
      }
      const creditos = b.info_creditos ?? 0;
      if (a.espiar && creditos > 0 && !m.espiada) {
        const esp = button(`Espiar (${creditos})`, 'btn espiar', () => a.espiar!(m.id));
        esp.disabled = ocupado;
        dica?.(esp, `espiar-${m.id}`, () => dicaEspiar(e.nome, creditos));
        linhaPreco.append(esp);
      }
```

- [ ] **Step 3: Os desenhos das oportunidades novas**

Run (na raiz do worktree): `node games/dev/iconesDourados.mjs oportunidades`
Expected: 5 caminhos, `games/idle/assets/oportunidades/oportunidade-3.png` … `-7.png` (96×24). Abra dois no Read pra ver se saíram.

- [ ] **Step 4: Ligar na tela e no `main.ts`**

Crie `games/idle/caixinha.css`:

```css
/* Caixinha nova e Espiar (entrega 5, 0076) */
.idle .bolsa .espiar { margin-left: 8px; }
```

Em `games/idle/tela.ts` (o mínimo; import `CASHBACK, cashbackAtivo, CUPOM_FATOR, cupomVale, textoOportunidade` de `./oportunidades` e `VSAUCE` de `./convidados`):
- `Acoes`: `espiar(empresa: number): void;` (junto de `negociar`).
- Depois de `const meiaAgora = …` (linha 454):

```ts
  // Cupom de primeira compra (0076): geradores 25% mais baratos (1, 10 e Máx), sem Promoção; a meia-preço guarda o cupom
  const cupomAgora = (s: IdleState) => (cupomVale(s, agoraTela) ? CUPOM_FATOR : 1);
  // Cashback (0076): a caixinha do botão de comprar diz quanto volta
  const cashAgora = (s: IdleState) => (cashbackAtivo(s, agoraTela) ? CASHBACK : 0);
```

- Em `linhaGerador`, troque o bloco dos preços (de `const cm = custoGerador(s);` até o `precos.push(...)`) por:

```ts
    const cm = custoGerador(s);
    const cmc = cm * cupomAgora(s);
    // a compra de 1 com meia-preço usa a meia, sem o cupom (o desconto de compra não passa de 50%; o banco faz igual)
    const precoUm = meiaAgora(s) < 1 ? preco(g.custo, n, 1, cm) * 0.5 : preco(g.custo, n, 1, cmc);
    const botoes = el('div', 'compra');
    const um = button(formatarValor(precoUm), 'btn', () => a.comprar('gerador', gid, 1));
    um.dataset.qtd = '1';
    const dez = button('10', 'btn', () => a.comprar('gerador', gid, 10));
    dez.dataset.qtd = '10';
    const max = button('Máx', 'btn', () => a.comprar('gerador', gid, 0));
    max.dataset.qtd = '0';
    precos.push(
      { botao: um, preco: precoUm },
      { botao: dez, preco: preco(g.custo, n, 10, cmc) },
      { botao: max, preco: preco(g.custo, n, 1, cmc), maximo: { custo: g.custo, n, cm: cmc } },
    );
```

  e a caixinha da linha: `dicas.ligar(linha, \`g${gid}\`, () => dicaGerador(s, gid, precoUm, cashAgora(s)));`. Na melhoria à venda: `dicas.ligar(item, \`m${x.id}\`, () => dicaMelhoria(s, x, p, cashAgora(s)));`.
- Em `itensCaixinha`: `texto.append(el('strong', undefined, textoOportunidade(k, s)), quando);`.
- `criarBolsaTela({ negociar: …, melhorar: …, espiar: (e) => a.espiar(e) }, dicas.ligar)`, e no `bolsaTela.renderizar(...)` acrescente o 5º argumento `peso(s.convidados ?? SEM_CADEIRAS, s.generators[12] ?? 0, VSAUCE) > 0`.

Em `games/idle/main.ts`:
- `import './caixinha.css';` depois de `import './dourados.css';`.
- `Api`: `'idleBolsaEspiar'`.
- Import `cashbackAtivo` de `./oportunidades`.
- Ações, junto de `negociar`:

```ts
  espiar: (empresa) => void guard(async () => {
    const r = await api.idleBolsaEspiar(empresa);
    receberBolsa(r.bolsa);
    aplicar(r);
    audio.tocar('pegar');
  }),
```

- Junto de `let descValia = false;`: `let cashValia = false; // Cashback valendo no último passo (liga e desliga: as caixinhas de compra mudam)`; e no passo de 100 ms, depois do bloco do `desc`:

```ts
  const cash = cashbackAtivo(ancora.estado, agoraMs);
  if (cash !== cashValia) {
    cashValia = cash;
    render();
  }
```

  (O cupom acabar vem numa resposta do banco, e `aplicar` já redesenha.)

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`
Expected: PASS.

- [ ] **Step 5: `?mock` das oportunidades**

Em `games/dev/mockIdle.ts` (import `mockOportunidade, type TipoOportunidade` de `../idle/oportunidades`; no tipo de `w`, `__oportunidade: (k: number | null) => Promise<void>;`):

```ts
// __oportunidade(5) faz toda janela da Caixinha ser do tipo k (no banco e na página); null volta à sorte
w.__oportunidade = async (k) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  const ja = await db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'idle_opp_kind_sorte'");
  if (!ja.rows[0].n) {
    await db.exec(`alter function public.idle_opp_kind(uuid, bigint) rename to idle_opp_kind_sorte;
      create table public.mock_opp (k int);
      create function public.idle_opp_kind(u uuid, w bigint) returns int language sql stable as
        'select coalesce((select k from public.mock_opp limit 1), public.idle_opp_kind_sorte(u, w))';`);
  }
  await db.query('delete from public.mock_opp where true');
  if (k !== null) await db.query('insert into public.mock_opp values ($1)', [k]);
  mockOportunidade.tipo = k as TipoOportunidade | null;
  document.dispatchEvent(new Event('visibilitychange'));
};
```

e no painel, depois dos botões dos dourados:

```ts
  // a Caixinha: força o tipo de toda janela (0 a 7) ou volta à sorte; créditos de Espiar
  const caixinha: [string, () => Promise<void>][] = [
    ...['15 min', '×5', 'Metade', 'Chamar', 'Cupom', 'Adubo', 'Cashback', 'Informação'].map((nome, k): [string, () => Promise<void>] => [`Caixinha: ${nome}`, () => w.__oportunidade(k)]),
    ['Caixinha: sorte', () => w.__oportunidade(null)],
    ['Bolsa +2 créditos', () => dono('update public.idle_state set info_creditos = info_creditos + 2 where user_id = $1', [ME]).then(() => document.dispatchEvent(new Event('visibilitychange')))],
  ];
  for (const [nome, f] of caixinha) {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#B8501A;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void f());
    painel.append(b);
  }
```

Run: `cd games && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 6: Conferir no navegador**

Vite na 5199, `?mock`, som mutado (os dois `localStorage` das Global Constraints). Pelo painel, force cada tipo da Caixinha e confira em 1280×720, 2000×961 e no iframe de 390 px: o desenho animado de cada um (3–7) na gaveta e na folha da Caixinha; o texto (e o "→ sem planta crescendo / sem Bolsa" sem Horta/Bolsa); a caixinha no mouse e no Tab (nada no celular); pegar Chamar (o selo "Chamar dourado (n)"), Cupom (os preços dos geradores caem 25%; com "Metade" pega e o "1" mostra a metade), Cashback (a caixinha do gerador diz "Cashback: volta F$ X" e some quando acaba), Adubo (com "+25 Food trucks" e uma planta crescendo, ela amadurece na Horta), Informação (com `__trader(3)`, "Espiar (n)" na empresa escolhida, o humor e o "muda em"). Mate o vite da 5199 e confira que não sobrou node.

- [ ] **Step 7: Commit**

```bash
git add games/idle/oportunidades.ts games/idle/oportunidades.test.ts games/idle/dica.ts games/idle/dica.test.ts games/idle/bolsaTela.ts games/idle/bolsaTela.test.ts games/idle/assets/oportunidades games/idle/ativos.test.ts games/idle/caixinha.css games/idle/tela.ts games/idle/tela.test.ts games/idle/main.ts games/dev/mockIdle.ts
git commit -m "Fellas Inc.: as oportunidades novas na Caixinha (textos, desenhos, caixinhas), o Espiar da Bolsa e os preços com cupom"
```

---

### Task 8: Simulação, patch notes, verificação final e publicação

**Files:**
- Modify: `games/idle/simulacao.ts:30,88` (`minutosOpp`), `games/idle/simulacao.test.ts`
- Modify: `games/idle/bolsaMotor.test.ts` (a Insider na simulação de 30 dias)
- Modify: `games/idle/novidades.ts` (entrada nova no começo), `games/idle/novidades.test.ts`
- Modify (só na publicação): `games/idle/oportunidades.ts` e `supabase/migrations/0076_fellas_inc_dourados_caixinha.sql` (`OPP_CORTE`)

**Interfaces:**
- Consumes: `mediaOportunidade`, `RODA_OPP_HOJE`, `RODA_OPP_NOVA` (Task 2).
- Produces: `simular(cat = padrao, dias = 7, bonus = SEM_BONUS, gerais = [], minutosOpp = 15)`.

- [ ] **Step 1: A simulação da semana com as oportunidades novas (teste primeiro)**

Em `games/idle/simulacao.test.ts` (import `SEM_BONUS` de `./economia` e `mediaOportunidade, RODA_OPP_HOJE, RODA_OPP_NOVA` de `./valorMedio`):

```ts
// Entrega 5 (0076): no modelo de valorMedio.ts a oportunidade média do jogador da simulação (sem Horta nem Bolsa na
// 1ª semana) sobe 36% (o Adubo e a Informação viram 15 min). Os ritmos têm que continuar valendo com isso. Se algum
// sair do alvo: cupons de 10 pra 5 (CUPONS_POR_OPP e a 0076), rode de novo e avise o Juan; NÃO mexa em PARAMETROS.
describe('ritmo com as oportunidades novas (entrega 5)', () => {
  const sem = { horta: false, bolsa: false };
  const minutos = 15 * (mediaOportunidade(RODA_OPP_NOVA, sem) / mediaOportunidade(RODA_OPP_HOJE, sem));
  const m = simular(catalogo, 14, SEM_BONUS, [], minutos);
  it('uns 20 min por oportunidade (eram 15)', () => expect(minutos).toBeCloseTo(20.42, 1));
  it('era 5 no dia 4 ou 5', () => {
    expect(m.era[5]!).toBeGreaterThanOrEqual(3 * DIA);
    expect(m.era[5]!).toBeLessThan(5 * DIA);
  });
  it('gerador 30 não sai na 1ª semana', () => expect(m.gerador30 === null || m.gerador30 >= 7 * DIA).toBe(true));
  it('a 1ª semana rende uns 17 pontos (16 a 18)', () => {
    const p = pontosTotais(m.amostras.find((a) => a.t >= 7 * DIA)!.taxa);
    expect(p).toBeGreaterThanOrEqual(16);
    expect(p).toBeLessThanOrEqual(18);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts`
Expected: o `npx tsc --noEmit` em `games/` falha ("Expected 0-4 arguments, but got 5"); o vitest não checa tipo e roda o bloco novo com 15 min, então ele pode passar por acaso. O que vale é o passo seguinte.

Em `games/idle/simulacao.ts`: a assinatura vira `export function simular(cat: Catalogo = padrao, dias = 7, bonus: Bonus = SEM_BONUS, gerais: number[] = [], minutosOpp = 15): Marcos {` (comentário: `/** … `minutosOpp`: quanto vale cada oportunidade pega (15 min de produção até a entrega 5; ver valorMedio.ts). */`) e a linha 88 vira `for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 60 * minutosOpp * ef.oppBonus;`.

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts idle/valorMedio.test.ts`
Expected: PASS (os ritmos de antes, com 15 min, também). Se o bloco novo falhar, siga o comentário do teste (cupons 10 → 5: `CUPONS_POR_OPP`, o `10 * v_n` da 0076, os testes da Task 5 e o `valorMedio.test.ts`) e avise o Juan.

- [ ] **Step 2: A Insider na simulação da Bolsa**

Em `games/idle/bolsaMotor.test.ts`, dentro do `describe('simulação de 30 dias (calibra o catálogo)')`:

```ts
  // Insider (shh), entrega 5: 100% de lucro (contando a corretagem) vendendo em até 2 h depois de comprar. Medido ao
  // planejar: 16% das janelas (37% nas malucas PRMO e MEME, 0,05% na IRMA). A raridade da conquista vem da cadeia
  // (Informação privilegiada, espiar, comprar e vender em 2 h), não da Bolsa.
  it('Insider (shh): 100% de lucro em 2 h é possível, mas não é a regra', () => {
    let janelas = 0;
    let deu = 0;
    for (const r of runs) {
      r.series.forEach((serie, i) => {
        for (let t = 0; t + 120 < serie.length; t += 10) {
          if (r.rj[i][t]) continue;
          janelas++;
          const custo = serie[t] * (1 + BOLSA.corretagem);
          for (let k = t + 1; k <= t + 120; k++) {
            if (r.rj[i][k]) break;
            if (serie[k] >= 2 * custo) {
              deu++;
              break;
            }
          }
        }
      });
    }
    expect(deu / janelas).toBeGreaterThan(0.01);
    expect(deu / janelas).toBeLessThan(0.25);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/bolsaMotor.test.ts`
Expected: PASS (~0,16).

- [ ] **Step 3: Patch notes**

Antes: `git merge main` (Global Constraints) — a entrada nova vai no começo de `NOVIDADES` como estiver na main nessa hora (a repaginação também mexe em `novidades.ts`).

Em `games/idle/novidades.ts`, no começo de `NOVIDADES`:

```ts
  {
    id: '2026-10-15-dourados-caixinha',
    titulo: 'Dourados novos e uma Caixinha mais cheia',
    data: '2026-10-15',
    itens: [
      'Trend do TikTok: chovem moedinhas por 8 segundos. Cada uma que você pega é 1 minuto de produção, até 20.',
      'Bombou no LinkedIn: um dos seus 5 geradores que mais produzem rende ×30 por 1 minuto. O post de coach vem de brinde.',
      'Pix errado: fica com 30 minutos de produção ou devolve e ganha um dourado em dobro em até 2 minutos. Ninguém viu.',
      'Tigrinho: as 3 primeiras jogadas do dia sempre pagam. Depois, a casa paga 3 em cada 10. Só mais uma.',
      'Combo: pegue 3 dourados seguidos sem deixar nenhum sumir e a produção fica ×7 por 1 minuto.',
      'Cinco oportunidades novas na Caixinha: Chamar um dourado (guarda até 3 pra chamar quando quiser), Cupom de primeira compra (10 compras de gerador 25% mais baratas), Adubo de farmácia (a planta mais perto de amadurecer fica madura na hora), Cashback (toda compra devolve 30% por 2 minutos) e Informação privilegiada (espia o humor de uma empresa da Bolsa até ele mudar).',
      'Sem Horta ou sem Bolsa, o Adubo e a Informação viram 15 minutos de produção.',
      '6 conquistas novas: Dancinha do TikTok, Cidadão de bem, Só mais uma, C-C-C-Combo!, Primeira compra (de novo) e Volta pra conta.',
    ],
  },
```

Em `games/idle/novidades.test.ts`, o teste "a mais nova é …" passa a esperar `NOVIDADES[0]` = `{ id: '2026-10-15-dourados-caixinha', titulo: 'Dourados novos e uma Caixinha mais cheia' }` e as de antes uma posição pra baixo (a que era a `[0]` vira a `[1]`, e assim por diante; ajuste o `slice` na mesma conta e o título do teste). Acrescente:

```ts
  it('a nota da entrega 5 não conta as conquistas escondidas nem o segredo', () => {
    const texto = NOVIDADES[0].itens.join(' ');
    for (const nome of ['O tigre tá pagando', 'Insider', 'Sillas']) expect(texto).not.toContain(nome);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/novidades.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add games/idle/simulacao.ts games/idle/simulacao.test.ts games/idle/bolsaMotor.test.ts games/idle/novidades.ts games/idle/novidades.test.ts
git commit -m "Fellas Inc.: simulação com as oportunidades novas, a Insider na Bolsa e os patch notes da entrega 5"
```

- [ ] **Step 5: Verificação completa**

Antes: `git merge main` uma última vez (conflito: o visual da main fica; o resto das Tasks 1–8 por cima). Rode e confira que tudo passa (cole a saída no relatório):

- `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4`
- na raiz: `npx tsc --noEmit && npm test`
- `git grep -n "Sillas" -- games/idle/novidades.ts` → nada.
- Navegador (vite na 5199, `?mock`, som mutado pelos dois `localStorage`): uma passada rápida pelos passos de conferência das Tasks 6 e 7 em 1280×720, 2000×961 e no iframe de 390 px, agora com o visual da main por cima.
- Mate o vite da 5199 (`Get-NetTCPConnection -LocalPort 5199 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }`) e confira que não sobrou vitest/vite/node.

- [ ] **Step 6: Publicar (com o Juan)**

1. Conferir que ninguém usou 0075/0076: `git fetch && git log origin/main --name-only --oneline -20 -- supabase/migrations` e o worktree `fellasapp-mapa`. Se sim, renumere as duas (arquivo, `db.ts`, `mockDb.ts`, o teste do corte que lê o nome da 0076) e regere o catálogo com `ATUALIZAR_CATALOGO`.
2. `OPP_CORTE`: a janela da meia-noite de Brasília depois do `db push`. Com a data D do push (dia seguinte, 0h de Brasília = 3h UTC): `node -e "console.log(Date.parse('AAAA-MM-DDT03:00:00Z') / 600000)"` (troque AAAA-MM-DD pela data do dia seguinte ao push). Troque o número em `OPP_CORTE` (`oportunidades.ts`) e o `when w < 2987010 then` (e o comentário com a data) da `idle_opp_kind` na 0076. Rode `cd games && npx vitest run --maxWorkers=4 test/idleDouradosCaixinha.test.ts idle/oportunidades.test.ts test/idle.test.ts test/idleArvore.test.ts` e commite (`Fellas Inc.: a Caixinha nova começa na meia-noite depois do deploy`).
3. Pedir pro Juan rodar (caminho absoluto): `! npx supabase db push --workdir C:\Users\juan\Documents\PROJETOSLLM\fellasapp-dourados`
4. Conferir no banco de produção (só SELECT, pelo pooler, como na memória "Consulta no banco de produção"): `idle_state` tem `linkedin_ate`, `combo_n`, `garantidos`, `cupons`, `cashback_ate`, `info_creditos`, `espiadas`, `dourados_cont`; `idle_cat_conquista` tem 132–139; `idle_dourado_pegar` tem 3 argumentos.
5. Merge local na `main` e push (fluxo do projeto, sem PR), com a pasta principal limpa; depois `gh run list` até o deploy passar.
