# Fellas Inc.: a árvore grande (entrega 6, antecipada) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A árvore de habilidades passa de 31 pra 120 nós (os 31 de hoje iguais, 30 nós 6–10 nos ramos de hoje, 4 ramos novos de 10, 9 pontes e 10 infinitos), com portões (vendas e maior era alcançada), níveis infinitos, a soma de produção, os efeitos nos minigames, a copa gerada com zoom e a tela nova, calibrada pelo veterano do banco.

**Architecture:** O mesmo desenho das entregas de antes. O catálogo nasce de `nomes.ts` → `catalogo.ts` → migração gerada (0081); a conta da página (`economia.ts efeitosArvore`/`fatores`) e a do banco (`idle_arv`, `idle_arvore_efeitos`, `idle_gen_rendas` com CTEs `materialized`) andam juntas com teste de paridade em PGlite. A 0082 (à mão) guarda `era_max` e o nível dos infinitos, confere portões e `requer2` na compra e põe cada tipo novo na função do banco que já aplica o efeito parecido; o banco manda os números prontos (limite da Bolsa, trocas, preços do Mapa) e a página só mostra. A tela da árvore é reescrita (copa gerada, zoom, fileira de ramos, cartão, caixinha) e o quadro do Legado vira a silhueta de 10 barrinhas.

**Tech Stack:** TypeScript (Vite, sem framework), Vitest + PGlite (banco de teste), Postgres/Supabase (plpgsql), Node puro pros scripts de arte (`../fellas-inc-esbocos`).

**Spec:** `docs/superpowers/specs/2026-10-15-fellas-inc-arvore-grande-design.md`

## Decisões do plano

O que o plano decidiu onde a spec deixa a escolha, contradiz o código ou não fecha a conta. A spec não foi mudada; os preços mudaram só nas tabelas da §3 (o que a spec permite).

1. **Migrações 0081 (catálogo, gerada) e 0082 (à mão).** A 0080 é de um conserto urgente (cupom/meia no Máx) que sai antes da árvore (aviso do coordenador, 16/10). Conferido em 15/10: nenhum branch nem worktree tem 008x. **Antes de copiar qualquer função**, confira se a 0080 (quando chegar na `main`) redefine alguma das funções que este plano copia (`git show main:supabase/migrations/0080_*.sql | grep "function public"`): se sim, a base da cópia é a da 0080, não a da tabela de bases.
2. **Calibração feita ao planejar; os preços da §3 mudaram (ficaram ~0,28× os da spec).** Retrato do jogador mais avançado (só leitura, sem identificação, 15/10 à noite): era 7, F$/s 6,6e18, 232 pontos na vida, 3 vendas, 25 nós, 85 conquistas (fixture na Task 6). A venda de agora dá 18.753 pontos no total. Com os preços da spec (parte fixa nova = 230.960 pontos) o veterano **nunca** fecha a parte fixa: a era 7 tem um teto (a empresa do modelo para de crescer em ~13 dias e a venda trava em ~70 mil pontos no total; medido: 49 mil pontos no dia 47 e trava). A conta mostra que a parte fixa tem que caber abaixo desse teto. Medido com estes preços (parte fixa nova = 65.454): **fecha a parte fixa no dia 12,2** (passo de 30 s, o do teste) — 12,8 com passo de 5 s, 14,1 com 10 s — em 10–11 vendas. É pouco abaixo do alvo (14–21) e não dá pra empurrar: com a parte fixa em ~69,7 mil (×0,30) ele já não fecha nunca até as eras 8–9. Preços novos (a Task 1 usa estes):

   | Faixa | Spec | Plano |
   |---|---|---|
   | Nós 6–10 dos ramos de hoje | 60, 120, 250, 500, 1.000 | **15, 35, 70, 150, 300** |
   | Bolsa, PPP, Mapa (1 → 10) | 30 … 5.000 | **8, 15, 35, 70, 150, 200, 350, 550, 850, 1.500** |
   | Espaço (1 → 10) | 500 … 50.000 | **150, 200, 350, 550, 1.000, 1.500, 3.000, 4.500, 7.000, 15.000** |
   | Pontes 2001 → 2009 | 2.000 … 20.000 | **550, 700, 850, 1.000, 1.500, 5.500, 4.000, 1.500, 2.000** |
   | Infinitos | 1.000 · 1,6^(n−1) | igual |

   O modelo: a simulação de sempre (3 aberturas de 10 min por dia, compra o melhor F$/s por F$) com a árvore nova, oportunidades de ~16,6 min (com Horta e Bolsa) e um fator fixo de ×17,2 = F$/s real ÷ F$/s do modelo no retrato (contratos, convidados, Mapa e Horta que a simulação não modela). Política de venda: vende no fim da abertura em que a venda dá +30% de pontos ou paga o próximo nó fixo liberado (o que vier antes); gasta no nó fixo mais barato liberado (todos os tipos, os 31 de hoje primeiro na conta).
3. **A árvore cheia (sem infinitos) deixa o veterano ×26,9, acima do alvo de 10–20× (avisar o Juan).** ×5,65 da soma × ×2,75 do Espaço já dão ~×15,5 (a conta da §6); o resto é o Legado ×2 do Espaço (o legado das eras 6–7 do veterano passa de +250% pra +500%). A spec não marca nenhum efeito como "calibrável", então o plano mantém os valores; se o Juan quiser 10–20×, o caminho é o Espaço 3/7 em ×1,25/×1,5 (dá ~×20). Fica no relatório final.
4. **Infinito do Dourados ("Investidor +2% por nível") é o tipo `dourado_investidor` com valor 1,02 por nível (composto: 1,02^n)**, igual aos nós 4.3, 4.7 e 4.10 (×2, ×1,5, ×1,5: 20 → 40 → 60 → 90 min). Assim o banco não muda nada nos dourados (`idle_arv` já multiplica, agora com o nível). Os outros "+X% por nível" somam (`valor × nível`).
5. **"Efeito dos convidados" (PPP 5, 9 e ∞) = os bônus de produção dos convidados**: o +15% do Cristiano, a subida do Kojima (os +50%/24 h, não o −10% do começo) e o +2%/h do Toby, todos × (1 + soma). Os descontos, oportunidades, Bolsa e Horta dos convidados não mudam (eles estão espalhados em 8 funções do banco; mexer em todas era risco grande pra pouco). **O Juan confirma.**
6. **"O convidado cai 15%/5% das vezes" é a derrubada da faixa do MC V.V** (o único sorteio de 25% dos convidados; ninguém "cai" da cadeira no código). O texto do nó diz isso.
7. **Espiada grátis por dia (Bolsa 3 e 7):** o dia é o de Brasília (`games_today()`, o mesmo corte da Caixinha e do Tigrinho). Espiar usa primeiro a grátis do dia; sem grátis, um crédito. Colunas novas `info_gratis_dia date`, `info_gratis_n int`; a venda não zera (como o Tigrinho do dia: vender não devolve as espiadas).
8. **Formato dos nós novos:** pontes no ramo 11 (posição 1–9); infinitos na posição 11 do próprio ramo; coluna `cresce` (1,6) só nos infinitos. Preço do próximo nível = `round(custo · cresce^nível)` dos dois lados (com 1,6 nunca dá ,5, então o arredondamento é o mesmo em JS e em Postgres; a conta é em `double precision` e só vira inteiro depois de conferir os pontos livres, então nível 100 não estoura `bigint`).
9. **Portão dos recursos = `req_era` com a era em que o recurso abre:** Mapa 2 (`portas.ts:55`, era 2), Convidados 3 (gerador 13, o 1º da era 3), Bolsa 4 (gerador 19, o 1º da era 4). O texto do portão diz "Abre com a Bolsa" / "Abre com os Convidados" / "Abre com o Mapa do rolê".
10. **Backfill de `era_max`:** a maior entre a era atual e a das conquistas de era que a pessoa tem (39–42 = eras 2–5; 43, o 1º Foguete, = 5). É a "era atual" da spec mais o que o banco já sabe de quem vendeu; nunca fica menor.
11. **"A raiz e os rótulos dos ramos sempre à vista ao arrastar"** = a fileira fixa (Raiz + os 10 ramos, com o ícone do nó 1 de cada), fora do mundo que arrasta. Os rótulos dentro da copa somem abaixo de zoom 0,8 (o texto não encolhe: abaixo disso, encostaria).
12. **Nome de nó até 40 caracteres** (a spec tem "Reunião cancelada (podia ser um e-mail)" e "Corretagem zero (dessa vez é verdade)"); o nome só aparece no cartão e na caixinha.
13. **Eventos de era 1,5× (Espaço 5):** um sorteio extra no mesmo número (`mod(h, 1800) <> 0` ganha uma 2ª chance de 1 em 3600), como o extra do Pé de coelho nos dourados. `idle_evento_era` continua com 3 argumentos (os testes trocam a função por um stub de 3 argumentos) e lê a árvore dentro (vira `stable`).
14. **Janela dobrada (Espaço 9):** o Jogo do Brasil vira 60 s; o banco aceita o segundo do evento até 120 s de agora (era 60). A página olha pra trás `30 × janela − 1` segundos.
15. **Caixinha nos nós:** todos os 120 ganham (é a mesma função: o que o efeito está agora → com o nó, e quanto de F$/s nos de produção). Nada no celular (regra).
16. **Limite da Bolsa:** `floor((100 + gerador + escritório × mult do escritório + soma dos nós) × ×2 do Lobo × (1 + 5% × nível))`. O banco manda o total (`limite`) e o gerador (`limite_gen`) pra frase "de onde vem".
17. **Contratar −2% por nível:** multiplica o desconto da Gente (`contrato_preco × (1 − 0,02 n)`), com piso 10%.
18. **Mapa, Camisetaria e Copão** são do banco: abrir/subir nível com desconto (`idle_mapa_json`, `idle_place_abrir`, `idle_place_nivel`, `idle_lugar_json`), marcos (`idle_place_mult`), procura gravada no lançamento ×público e fim da venda ×tempo (`idle_tee_lancar`), fichas da noite ×Copão (`idle_cup_noite_andar`, em `v_f`: não mexe nas vendas nem nos marcos de volume). `idle_mapa_json` manda `horas` já com o desconto (a caixinha do pino diz "N h da sua produção"); `idle_lugar_json` manda `venda_min` e `copao_mult` pras frases.
19. **Ordem e tamanho:** 11 tasks. A copa gerada (Task 2) vem logo depois do catálogo, pra a tela não quebrar com os 120 nós; a simulação (Task 6) vem depois da conta da produção e do Recomeço (Tasks 4 e 5), que ela usa, e trava a calibração (os números já saíram calibrados: Decisão 2); a arte (Task 9) vem antes da tela (Task 10).

## Global Constraints

- Worktree `C:\Users\juan\Documents\PROJETOSLLM\fellasapp-arvore` (branch `arvore-grande`, da main 56614bbc). **Nunca mexer em `C:\Users\juan\Documents\PROJETOSLLM\fellasapp`** (outra sessão trabalha direto lá). O `.env` e o `supabase/.temp` já estão no worktree; `games/node_modules` foi instalado ao planejar (`npm ci`): na Task 1, `npm ci` de verdade na raiz e em `games/` de novo.
- `git merge main` no começo das Tasks 1, 10 e 11 (e antes de qualquer outra, se a main andou), resolvendo conflito **a favor da main** (reponha por cima só as linhas deste plano). Se a main trouxe a 0080 (Decisão 1), confira as funções dela antes de copiar.
- Migrações novas: `0081_fellas_inc_catalogo_arvore_grande.sql` (gerada com `ATUALIZAR_CATALOGO`, nunca à mão) e `0082_fellas_inc_arvore_grande.sql` (à mão; as Tasks 3, 4, 5, 7 e 8 escrevem as partes A a E, em ordem). Conferir de novo antes do push que os números estão livres (`git ls-tree --name-only main supabase/migrations/ | tail -3`). Nunca editar migração antiga. As duas entram em `games/test/db.ts` (array `MIGRATIONS`) e em `games/dev/mockDb.ts` (import `?raw` + array do `for`).
- **Base de cada redefinição** (copiar a função INTEIRA da linha indicada até o `$$;` dela, mudar só o que o plano mostra, manter `revoke`/`grant` da linha indicada): `idle_arv` (0041 l. 66–77, revoke 256), `idle_bonus_mult` (0041 l. 102–106, revoke 258), `idle_hire_price` (0041 l. 244–253, revoke 263), `idle_start` (0041 l. 694–719, revoke/grant 723–724), `idle_arvore_efeitos` (0061 l. 5–31; reescrita inteira no plano), `idle_horta_bonus` (0061 l. 147–160), `idle_gen_rendas` (**0079** l. 7–41; nunca a da 0076/0078), `idle_save` (0078 l. 254–287), `idle_json` (0078 l. 361–442), `idle_settle` (0078 l. 445–516), `idle_evento_era` (0078 l. 521–546), `idle_evento_pegar` (0078 l. 548–639), `idle_claim_opportunity` (0076 l. 807–882), `idle_bolsa_estado` (0076 l. 946–1006), `idle_bolsa_negociar_em` (0076 l. 1008–1119), `idle_bolsa_espiar_em` (0076 l. 892–932), `idle_conv_peso` / `idle_conv_trocas` / `idle_conv_derrubada_ate` (0051 l. 35–42, 51–55, 65–89), `idle_conv_derrubadas` (0051 l. 163–181), `idle_conv_json` (0051 l. 195–205), `idle_conv_sentar` (0051 l. 207–281, revoke/grant 308–309), `idle_conv_prod` / `idle_conv_mudancas` (**0052** l. 14–34, 44–79), `idle_conv_faixa` (0076 l. 63–85), `idle_mapa_json` (0066 l. 103–123, revoke 198), `idle_place_abrir` (0066 l. 160–196, revoke/grant 201–202), `idle_place_mult` (0066 **l. 207–221**, a 2ª da 0066; revoke 392), `idle_place_nivel` (0066 l. 271–301, revoke/grant 398–399), `idle_lugar_json` (0066 **l. 614–642**, a 2ª da 0066; revoke 795), `idle_tee_lancar` (0069 l. 38–126, revoke/grant 162–163), `idle_cup_noite_andar` (0068 l. 785–847, revoke 982), `idle_buy_node` (0041 l. 660–689; reescrita inteira no plano, grant 721–722). Não mudam: `idle_prestige` (não toca em `era_max`), `idle_rate`, `idle_rate_at`, `idle_dourado_pegar` (Decisão 4), `idle_opp_cap`, `idle_opp_list`, `idle_hire`, `idle_social_mult`, `idle_horta_plantar`, `idle_horta_avancar`.
- Manter os CTEs de `idle_gen_rendas` **`materialized`** (0079; `test/idleDesempenho.test.ts` confere `est`, `glob`, `leg` e, depois da Task 3, `arv`).
- `DELETE`/`UPDATE` no SQL sempre com `WHERE` (safeupdate do Supabase). Um `jsonb_build_object` tem no máximo 100 argumentos: `idle_arvore_efeitos` (54 chaves) vai em dois objetos; o campo novo de `idle_json` (`era_max`) vai no 2º objeto; `niveis` vai dentro do `bonus` (objeto próprio).
- Função que passa a ler a árvore (`idle_arv`, que lê tabela) sai de `immutable` pra `stable` (as da Bolsa/Convidados/eventos listadas nas tasks).
- Números (Decisão 2): `CUSTO_NO` (1–5) e `CUSTO_RAIZ` **não mudam**; `CUSTO_NOVOS_HOJE = [15, 35, 70, 150, 300]`, `CUSTO_RECURSO = [8, 15, 35, 70, 150, 200, 350, 550, 850, 1500]`, `CUSTO_ESPACO = [150, 200, 350, 550, 1000, 1500, 3000, 4500, 7000, 15000]`, preços das pontes `[550, 700, 850, 1000, 1500, 5500, 4000, 1500, 2000]`, `CUSTO_INFINITO = 1000`, `CRESCE_INFINITO = 1.6`. Ids: hoje `ramo·10 + pos`; novos `ramo·100 + pos`; pontes 2001–2009; infinitos `3000 + ramo`. Portões: 6–7 dos ramos de hoje 3 vendas; 8–10 era 7; Bolsa era 4, PPP era 3, Mapa era 2; Espaço 1–5 era 6, 6–10 era 7; pontes 5 vendas; infinitos 10 vendas.
- Caixinha de informação (`dica.ts` monta, `dicaTela.ts` mostra; mouse no PC, foco no teclado, nada no celular) em todo nó (Decisão 15); o quadro do Legado e a fileira de ramos não ganham (mostram tudo no próprio texto).
- **Taste Engine nas telas (Task 10):** carregar `mcp__taste-engine__lookup_slop` com `ToolSearch` (`select:mcp__taste-engine__lookup_slop`), descrever cada escolha de design (uma consulta por escolha), corrigir o que ele marcar como cara de IA **dentro do visual do jogo** (pixel, Jersey 10, cantos de pixel), ignorar regra que só vale pra site e registrar cada consulta e o que mudou no relatório da task. Regras fixas: **roxo cheio só no botão de comprar/abrir**; ativo/dá pra comprar = traço lilás; **nenhum rótulo com fundo dourado cheio**; sem borda colorida num lado só. CSS novo em `games/idle/arvore.css` (importado no `main.ts` depois do `eras67.css`), tokens do `idle.css` (`--i-*`, `--paper`, `--gold`, `var(--i-pixel)`), cantos de pixel (o `--c` + 4 sombras sem desfoque). Nenhuma linha nova em `idle.css`.
- Texto da interface em pt-BR, no tom do jogo; humor ácido pode, **sem fato falso sobre pessoa real**. O easter egg do Sillas e as conquistas escondidas nunca aparecem em texto novo.
- Entrada nova no começo de `games/idle/novidades.ts` (Task 11).
- Testes dos jogos: `cd games && npx vitest run --maxWorkers=4 <arquivo>`. No fim: `npx tsc --noEmit` na raiz e em `games/`, `npm test` na raiz. Depois de rodar o vite, matar de verdade o da porta 5199 (`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*vite*--port 5199*' } | % { Stop-Process -Id $_.ProcessId -Force }`) e conferir que não sobrou node (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).
- Navegador: antes de testar, mutar música e efeitos (`localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')`) e recarregar.
- Arte: scripts **novos** em `C:\Users\juan\Documents\PROJETOSLLM\fellas-inc-esbocos`; nunca editar arquivo existente de lá; nunca rodar os scripts `cena1`–`cena6`/`camadas-cena*`. O Juan aprova a folha antes de publicar.
- **Este plano não publica** (sem `db push`, sem merge na main, sem push). Commits sem `Co-Authored-By` nem marca de IA.

## Review Focus

- **Infinito com toque duplo ou nível alto:** dois cliques seguidos sobem 2 níveis e cobram os 2 preços (nunca 2 níveis por 1 preço, nunca um nível sem cobrar); com 1e9 pontos o nível 30 compra e o 31 recusa com `idle_points_low` sem estourar; nível 100 no cálculo do preço não dá erro de `bigint`. Testes na Task 3.
- **Página nova antes do `db push` (resposta sem `niveis`, sem `era_max`, sem `limite_gen`/`trocas_max`/`venda_min`):** a página trata o que falta como nível 1, `era_max = era`, os padrões de hoje; sem `NaN` na caixinha, no cartão nem nas frases dos minigames. Testes nas Tasks 3 (efeitos sem `niveis`), 7 (convidados e Bolsa com o JSON velho) e 2 (contexto sem `era_max`).
- **Vender a startup depois de passar de era:** `era_max` não zera, as vendas sobem 1 e o nó com portão de era 7 compra com a empresa nova na era 1 (e com a empresa fechada). Teste na Task 3.
- **Nó de minigame com o minigame fechado ou vazio** (Bolsa sem trader, PPP sem convidado, Mapa sem lugar): o banco não dá erro, a conta não muda e a tela não mostra número inventado; o efeito vale quando abre. Testes nas Tasks 7 e 8.
- **Celular: arrastar, pinçar e tocar na copa de 120 nós:** o toque escolhe; o fim de um arraste ou de uma pinça não escolhe nem compra; o zoom mínimo mostra a copa inteira; o Abrir centraliza no nó escolhido; o botão de comprar nunca dispara sem um toque nele. Testes na Task 10.

---
## File Structure

| Arquivo | O que faz |
|---|---|
| `games/idle/nomes.ts` (mod) | `RAMOS` com 10 ramos, `TipoNo` com os 32 tipos novos, os 79 nós novos em `ARVORE`, `PONTES` |
| `games/idle/catalogo.ts` (mod) | custos novos, `idNo`, `ORDEM_RAMOS`, `ERA_RECURSO`, `No` com `requer2`/`reqVendas`/`reqEra`/`cresce`, SQL com as colunas novas |
| `games/idle/legado.ts` (mod) | a copa gerada (`POSICOES_ARVORE`), `ContextoArvore`, nível, preço, portão, situação (com `portao`), nó inicial, textos, barrinhas por ramo |
| `games/idle/economia.ts` (mod) | `efeitosArvore` com nível e os campos novos; soma de produção, eras 6+, legado; abertura com eras e ×F$; preço do contrato com o desconto por nível |
| `games/idle/simulacao.ts` (mod) | `gastar` com portões e `requer2`, `NAO_ACELERA` novos, `veterano()` |
| `games/idle/convidados.ts`, `bolsa.ts`, `bolsaTela.ts`, `eventosEra.ts`, `eventoEraTela.ts`, `store.ts`, `mapa.ts`, `camisetariaTela.ts`, `copaoTela.ts`, `main.ts`, `tela.ts` (mod) | os números que o banco manda (trocas, pesos, queda, limite, espiadas, janelas, tempos) e as frases |
| `games/idle/dica.ts` (mod) | `dicaNo` (todos os nós), frases dos eventos/Mapa/Camisetaria/Copão com a árvore |
| `games/idle/arvoreTela.ts` (reescrito) | copa gerada, molduras por tamanho/forma, estados com forma, zoom (pinça e +/−), fileira de ramos, cartão, caixinha; `copaBarras` no lugar da miniatura |
| `games/idle/arvore.css` (novo) | tudo da tela nova e do quadro do Legado |
| `games/shared/types.ts`, `games/dev/mockIdle.ts`, `games/dev/mockDb.ts`, `games/test/db.ts` (mod) | `era_max`, `bonus.niveis`, campos novos dos minigames, `__arvore`, migrações |
| `supabase/migrations/0081_fellas_inc_catalogo_arvore_grande.sql` (gerada), `0082_fellas_inc_arvore_grande.sql` (nova, partes A–E) | catálogo; banco |
| `games/test/idleArvoreGrande.test.ts` (novo) | compra (portões, `requer2`, infinitos), `era_max`, paridade com níveis, minigames com a árvore |
| `games/test/fixtures/veterano-2026-10-15.json` (novo) | o retrato do veterano (sem identificação) |
| `games/idle/assets/arvore/no-*.png` (89 novos) | ícones 16×16 |
| `../fellas-inc-esbocos/arvore-grande.js` (novo, fora do repo) | os 89 ícones e a folha de conferência |
| `games/idle/novidades.ts` (mod) | entrada nova |

---
### Task 1: Catálogo dos 120 nós e a 0081

**Files:**
- Modify: `games/idle/nomes.ts` (`RAMOS` l. 420–421; `TipoNo` l. 423–433; `ARVORE` l. 437–471, acrescentar no fim; `PONTES` novo depois)
- Modify: `games/idle/catalogo.ts` (custos l. 34–37; tipo `No` l. 61–65; `montarCatalogo` l. 137–141; `catalogoSql` l. 166–169, 194–197, 241–242)
- Modify: `games/idle/catalogo.test.ts` (o teste da árvore, l. 159–177; o do SQL da árvore, l. 214–218), `games/test/idleArvore.test.ts:190-195`
- Create: `supabase/migrations/0081_fellas_inc_catalogo_arvore_grande.sql` (gerada)
- Modify: `games/test/db.ts` (`MIGRATIONS`), `games/dev/mockDb.ts` (import + `for`)

**Interfaces:**
- Produces: em `nomes.ts`: `RAMOS` (índices 0–10), `TipoNo` com `'producao_soma' | 'inicio_eras' | 'inicio_mult' | 'opp_fs' | 'contrato_desconto' | 'horta_soma' | 'bolsa_corretagem' | 'bolsa_limite' | 'bolsa_limite_mult' | 'bolsa_limite_soma' | 'bolsa_espiadas' | 'bolsa_escritorio' | 'conv_recarga' | 'conv_trocas' | 'conv_cadeira2' | 'conv_cadeira3' | 'conv_queda' | 'conv_efeito' | 'mapa_abrir' | 'mapa_nivel' | 'marcos_mult' | 'marcos_soma' | 'tee_publico' | 'tee_tempo' | 'copao_mult' | 'lixo_min' | 'silver_min' | 'silver_mult' | 'legado_mult' | 'espaco_soma' | 'era_freq' | 'era_janela'`, `PONTES: readonly { entre: readonly [number, number]; nome; efeito; valor }[]`, `NOME_PONTE = 'Ponte'`. Em `catalogo.ts`: `CUSTO_NOVOS_HOJE`, `CUSTO_RECURSO`, `CUSTO_ESPACO`, `CUSTO_PONTE`, `CUSTO_INFINITO = 1000`, `CRESCE_INFINITO = 1.6`, `ORDEM_RAMOS = [6, 9, 5, 8, 2, 1, 10, 3, 7, 4]`, `ERA_RECURSO = { 7: 4, 8: 3, 9: 2 }`, `RAMO_PONTE = 11`, `idNo(ramo, posicao): number`, `No = { id; ramo; posicao; nome; efeito; custo; tipo; valor; requer: number | null; requer2: number | null; reqVendas: number | null; reqEra: number | null; cresce: number | null }`. A 0081 cria as colunas `requer2`, `req_vendas`, `req_era`, `cresce` em `idle_cat_no` (a 0082 usa).

- [ ] **Step 0: Preparar o worktree**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-arvore
git merge main          # traz o que a outra sessão publicou (a favor da main); veja a Decisão 1 sobre a 0080
npm ci                  # raiz (Expo + jest)
cd games && npm ci      # jogos (vite, vitest, PGlite)
cd .. && npx tsc --noEmit
cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle test/idleParidade.test.ts test/idleArvore.test.ts
```

Expected: tudo PASS (linha de base; se algo falhar aqui, pare e avise antes de mexer).

- [ ] **Step 1: Os testes do catálogo (falham)**

Em `games/idle/catalogo.test.ts`, troque o import de `./catalogo` por:

```ts
import {
  catalogo, catalogoSql, CUSTO_ESPACO, CUSTO_NOVOS_HOJE, CUSTO_PONTE, CUSTO_RECURSO, idConquistaGerador, idNo, montarCatalogo,
  ORDEM_RAMOS, PARAMETROS, PARAMETROS_ESPACO,
} from './catalogo';
```

Troque o teste `'árvore: a raiz e 6 ramos de 5 nós; …'` inteiro (l. 159–177) por:

```ts
  it('árvore: 120 nós (a raiz, 10 ramos de 10, 10 infinitos e 9 pontes); os 31 de hoje iguais', () => {
    const a = catalogo.arvore;
    expect(a).toHaveLength(120);
    expect(new Set(a.map((n) => n.id)).size).toBe(120);
    expect(a[0]).toMatchObject({
      id: 1, ramo: 0, nome: 'Virou MEI', custo: 1, requer: null, tipo: 'producao', valor: 1.05, requer2: null, reqVendas: null, reqEra: null, cresce: null,
    });
    for (let r = 1; r <= 6; r++) {
      const hoje = a.filter((n) => n.ramo === r && n.posicao <= 5);
      expect(hoje.map((n) => n.id)).toEqual([1, 2, 3, 4, 5].map((p) => r * 10 + p));
      expect(hoje.map((n) => n.custo)).toEqual([2, 4, 8, 15, 30]);
      expect(hoje.map((n) => n.requer)).toEqual([1, r * 10 + 1, r * 10 + 2, r * 10 + 3, r * 10 + 4]);
      for (const n of hoje) expect(n, String(n.id)).toMatchObject({ requer2: null, reqVendas: null, reqEra: null, cresce: null });
    }
    expect(a.filter((n) => n.id <= 65).reduce((t, n) => t + n.custo, 0)).toBe(355);
    expect(a.filter((n) => n.ramo === 4 && n.posicao <= 5).map((n) => [n.tipo, n.valor])).toEqual([
      ['dourado_freq', 1.5], ['dourado_tela', 24], ['dourado_investidor', 2], ['dourado_duracao', 2], ['dourado_freq', 2]]);
    expect(a.filter((n) => n.ramo === 6 && n.posicao <= 5).map((n) => [n.tipo, n.valor])).toEqual([
      ['horta_amadurece', 0.75], ['horta_vida', 1.5], ['horta_cruza', 2], ['horta_mult', 1.5], ['morango_chance', 5]]);
    expect(a.some((n) => (n.tipo as string) === 'teto')).toBe(false);
    for (const n of a) expect(n.nome.length, n.nome).toBeLessThanOrEqual(40);
  });
  it('os 31 nós de hoje são os da 0077, byte a byte (com as 4 colunas novas nulas no fim)', () => {
    const antiga = readFileSync(resolve(MIGRACOES, '0077_fellas_inc_catalogo_eras_6_7.sql'), 'utf8').replace(/\r\n/g, '\n');
    const bloco = (sql: string) => sql.split('insert into public.idle_cat_no ')[1].split('\n').slice(1).map((l) => l.replace(/[,;]$/, '')).filter(Boolean);
    const antes = bloco(antiga);
    expect(antes).toHaveLength(31);
    const nova = new Set(bloco(catalogoSql()));
    for (const l of antes) expect(nova.has(l.replace(/\)$/, ', null, null, null, null)')), l).toBe(true);
  });
  it('nós novos: ids, custos, quem pede quem e os portões', () => {
    const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
    expect([idNo(0, 1), idNo(1, 5), idNo(1, 6), idNo(6, 10), idNo(7, 1), idNo(10, 10), idNo(4, 11)]).toEqual([1, 15, 106, 610, 701, 1010, 3004]);
    expect(CUSTO_NOVOS_HOJE).toEqual([15, 35, 70, 150, 300]);
    expect(CUSTO_RECURSO).toEqual([8, 15, 35, 70, 150, 200, 350, 550, 850, 1500]);
    expect(CUSTO_ESPACO).toEqual([150, 200, 350, 550, 1000, 1500, 3000, 4500, 7000, 15000]);
    expect(CUSTO_PONTE).toEqual([550, 700, 850, 1000, 1500, 5500, 4000, 1500, 2000]);
    expect(no(106)).toMatchObject({ ramo: 1, posicao: 6, nome: 'Coach quântico', tipo: 'producao_soma', valor: 0.2, custo: 15, requer: 15, reqVendas: 3, reqEra: null });
    expect(no(107)).toMatchObject({ requer: 106, reqVendas: 3, reqEra: null, custo: 35 });
    expect(no(108)).toMatchObject({ requer: 107, reqVendas: null, reqEra: 7, custo: 70, nome: 'Reunião cancelada (podia ser um e-mail)' });
    expect(no(610)).toMatchObject({ tipo: 'morango_chance', valor: 10, custo: 300, reqEra: 7 });
    expect(no(701)).toMatchObject({ ramo: 7, nome: 'Corretora "sem taxa"', tipo: 'bolsa_corretagem', valor: 0.8, custo: 8, requer: 1, reqEra: 4, reqVendas: null });
    expect(no(801)).toMatchObject({ tipo: 'conv_recarga', valor: 1.25, requer: 1, reqEra: 3 });
    expect(no(901)).toMatchObject({ tipo: 'mapa_abrir', valor: 0.75, requer: 1, reqEra: 2 });
    expect(no(1001)).toMatchObject({ tipo: 'lixo_min', valor: 15, custo: 150, requer: 1, reqEra: 6 });
    expect(no(1006)).toMatchObject({ tipo: 'silver_mult', valor: 5, reqEra: 7, requer: 1005 });
    expect(no(1010)).toMatchObject({ tipo: 'espaco_soma', valor: 1, custo: 15000, reqEra: 7 });
    for (let r = 1; r <= 10; r++) {
      expect(no(3000 + r), `infinito ${r}`).toMatchObject({ ramo: r, posicao: 11, custo: 1000, cresce: 1.6, reqVendas: 10, reqEra: null, requer: idNo(r, 10), requer2: null });
    }
    expect(no(3002)).toMatchObject({ tipo: 'inicio_mult', valor: 10 });
    expect(no(3004)).toMatchObject({ tipo: 'dourado_investidor', valor: 1.02 });
    // pontes: entre os vizinhos na ordem da copa, cada uma pede o nó 5 dos dois
    expect(ORDEM_RAMOS).toEqual([6, 9, 5, 8, 2, 1, 10, 3, 7, 4]);
    const pontes = catalogo.arvore.filter((n) => n.ramo === 11);
    expect(pontes.map((n) => n.id)).toEqual([2001, 2002, 2003, 2004, 2005, 2006, 2007, 2008, 2009]);
    pontes.forEach((n, i) => {
      expect(n).toMatchObject({ posicao: i + 1, tipo: 'producao_soma', custo: CUSTO_PONTE[i], reqVendas: 5, reqEra: null, cresce: null });
      expect([n.requer, n.requer2]).toEqual([idNo(ORDEM_RAMOS[i], 5), idNo(ORDEM_RAMOS[i + 1], 5)]);
    });
    expect(no(2001)).toMatchObject({ nome: 'Feira orgânica no rolê', requer: 65, requer2: 905, valor: 0.15 });
    expect(no(2006)).toMatchObject({ nome: 'Fábrica em órbita', requer: 15, requer2: 1005, valor: 0.25 });
    // a conta da §6: soma da Produção 2,75, das pontes 1,9, do Espaço fixo 1,75
    const soma = (f: (n: (typeof catalogo.arvore)[number]) => boolean) => catalogo.arvore.filter(f).reduce((t, n) => t + n.valor, 0);
    expect(soma((n) => n.ramo === 1 && n.posicao >= 6 && n.posicao <= 10)).toBeCloseTo(2.75, 12);
    expect(soma((n) => n.ramo === 11)).toBeCloseTo(1.9, 12);
    expect(soma((n) => n.ramo === 10 && n.posicao <= 10 && n.tipo === 'espaco_soma')).toBeCloseTo(1.75, 12);
    // a parte fixa nova custa 65.454 (Decisão 2)
    expect(catalogo.arvore.filter((n) => n.id > 65 && n.cresce === null).reduce((t, n) => t + n.custo, 0)).toBe(65454);
  });
```

No `describe('catálogo no banco …')`, troque o teste `'a árvore entra no SQL gerado'` (l. 214–218) por:

```ts
  it('a árvore entra no SQL gerado, com as colunas novas (banco que já tinha a tabela ganha as colunas antes do insert)', () => {
    const sql = catalogoSql();
    expect(sql).toContain('insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer, requer2, req_vendas, req_era, cresce) values');
    expect(sql).toContain("(41, 4, 1, 'Pé de coelho', 'Eventos aparecem 50% mais vezes.', 2, 'dourado_freq', 1.5, 1, null, null, null, null)");
    expect(sql).toContain(`(51, 5, 1, 'Placa de "Precisa-se"', 'Contratar custa 25% menos.', 2, 'contrato_preco', 0.75, 1, null, null, null, null)`);
    expect(sql).toContain("(106, 1, 6, 'Coach quântico', 'Produção +20%, somando com os outros nós de soma.', 15, 'producao_soma', 0.2, 15, null, 3, null, null)");
    expect(sql).toContain("(2001, 11, 1, 'Feira orgânica no rolê', 'Produção +15%, somando com os outros nós de soma.', 550, 'producao_soma', 0.15, 65, 905, 5, null, null)");
    expect(sql).toContain("(3001, 1, 11, 'Hora extra infinita', 'Produção +5% por nível, somando com os outros nós de soma.', 1000, 'producao_soma', 0.05, 110, null, 10, null, 1.6)");
    expect(sql).toContain('alter table public.idle_cat_no add column if not exists requer2 int, add column if not exists req_vendas int, add column if not exists req_era int, add column if not exists cresce double precision;');
    expect(sql.indexOf('alter table public.idle_cat_no add column')).toBeLessThan(sql.indexOf('insert into public.idle_cat_no'));
  });
```

Em `games/test/idleArvore.test.ts`, troque o teste `'o catálogo no banco é o da página'` (l. 190–195) por:

```ts
  it('o catálogo no banco é o da página (com quem pede quem, os portões e o crescimento dos infinitos)', async () => {
    const nos = await q<{ id: number; custo: number; requer: number | null; requer2: number | null; req_vendas: number | null; req_era: number | null; cresce: number | null; tipo: string; valor: number }>(
      'select id, custo, requer, requer2, req_vendas, req_era, cresce, tipo, valor from public.idle_cat_no order by id',
    );
    expect(nos).toEqual([...catalogo.arvore].sort((a, b) => a.id - b.id).map((n) => ({
      id: n.id, custo: n.custo, requer: n.requer, requer2: n.requer2, req_vendas: n.reqVendas, req_era: n.reqEra, cresce: n.cresce, tipo: n.tipo, valor: n.valor,
    })));
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: FAIL (imports inexistentes, 31 nós).

- [ ] **Step 3: Os textos em `nomes.ts`**

Troque `RAMOS` (l. 420–421) por:

```ts
/** Ramos da árvore de habilidades: 0 é a raiz; 1 a 6 são os de hoje (o Tempo virou Dourados e a Horta entrou em 13/10);
 *  7 a 10 entraram com a árvore grande (16/10). As pontes ficam no ramo 11 (catalogo.ts RAMO_PONTE). */
export const RAMOS: readonly string[] = [
  'Raiz', 'Produção', 'Recomeço', 'Oportunidades', 'Dourados', 'Gente', 'Horta', 'Bolsa', 'PPP Podcast', 'Mapa do rolê', 'Espaço',
];
/** O nome de quem fica entre dois ramos (o ramo 11). */
export const NOME_PONTE = 'Ponte';
```

Troque o comentário e o tipo `TipoNo` (l. 423–433) por:

```ts
/** O que cada nó faz. Valor: multiplicador (producao, opp_bonus, contrato_preco, emprego_mult, dourado_freq,
 *  dourado_investidor, dourado_duracao, horta_amadurece, horta_vida, horta_cruza, horta_mult, morango_chance), segundos
 *  (segundos: quanto a oportunidade fica na cena; dourado_tela: quanto o evento fica na tela), quantidade (caixinha,
 *  opp_extra, inicio_notebooks, contrato_dias), reais (inicio_valuation), fração (por_contratado) ou 1 (inicio_era1,
 *  manter_gerais: só ter o nó). Árvore grande (16/10, 0081/0082): os de "soma" entram como 1 + Σ valor × nível
 *  (producao_soma, opp_fs, horta_soma, bolsa_limite_soma, marcos_soma, espaco_soma) ou somam direto (contrato_desconto,
 *  bolsa_limite, bolsa_espiadas, conv_trocas, conv_efeito); inicio_mult multiplica (valor^nível); inicio_eras, lixo_min,
 *  silver_min, silver_mult, legado_mult, era_freq, era_janela, bolsa_limite_mult, bolsa_escritorio, conv_recarga,
 *  conv_cadeira2/3, marcos_mult, tee_publico, copao_mult ficam o maior; bolsa_corretagem, conv_queda, mapa_abrir,
 *  mapa_nivel, tee_tempo ficam o menor (economia.ts efeitosArvore e idle_arvore_efeitos na 0082). */
export type TipoNo =
  | 'producao' | 'inicio_valuation' | 'inicio_notebooks' | 'manter_gerais' | 'inicio_era1'
  | 'caixinha' | 'segundos' | 'opp_extra' | 'opp_bonus'
  | 'contrato_preco' | 'por_contratado' | 'contrato_dias' | 'emprego_mult'
  | 'dourado_freq' | 'dourado_tela' | 'dourado_investidor' | 'dourado_duracao'
  | 'horta_amadurece' | 'horta_vida' | 'horta_cruza' | 'horta_mult' | 'morango_chance'
  // árvore grande (16/10)
  | 'producao_soma' | 'inicio_eras' | 'inicio_mult' | 'opp_fs' | 'contrato_desconto' | 'horta_soma'
  | 'bolsa_corretagem' | 'bolsa_limite' | 'bolsa_limite_mult' | 'bolsa_limite_soma' | 'bolsa_espiadas' | 'bolsa_escritorio'
  | 'conv_recarga' | 'conv_trocas' | 'conv_cadeira2' | 'conv_cadeira3' | 'conv_queda' | 'conv_efeito'
  | 'mapa_abrir' | 'mapa_nivel' | 'marcos_mult' | 'marcos_soma' | 'tee_publico' | 'tee_tempo' | 'copao_mult'
  | 'lixo_min' | 'silver_min' | 'silver_mult' | 'legado_mult' | 'espaco_soma' | 'era_freq' | 'era_janela';
```

Troque o comentário de `ARVORE` (l. 437–438) por `/** A árvore de habilidades, na ordem: a raiz, os 6 ramos de hoje (posições 1–5), e o que entrou com a árvore grande: as posições 6–10 e o infinito (posição 11) de cada ramo de hoje, e os ramos 7–10 com 10 nós e um infinito. O id sai de catalogo.ts idNo. Nó novo ou efeito mudado = migração nova do catálogo; id nunca muda (o banco guarda quem comprou pelo id). */`. Depois da linha do nó `ramo: 6, posicao: 5` (o Morango do amor) e antes do `];`, acrescente:

```ts
  // ===== árvore grande (16/10, 0081): os nós 6–10 e o infinito (posição 11) dos ramos de hoje =====
  { ramo: 1, posicao: 6, tipo: 'producao_soma', valor: 0.2, nome: 'Coach quântico', efeito: 'Produção +20%, somando com os outros nós de soma.' },
  { ramo: 1, posicao: 7, tipo: 'producao_soma', valor: 0.3, nome: 'Planilha com macro', efeito: 'Produção +30%, somando com os outros nós de soma.' },
  { ramo: 1, posicao: 8, tipo: 'producao_soma', valor: 0.5, nome: 'Reunião cancelada (podia ser um e-mail)', efeito: 'Produção +50%, somando com os outros nós de soma.' },
  { ramo: 1, posicao: 9, tipo: 'producao_soma', valor: 0.75, nome: 'Home office na praia', efeito: 'Produção +75%, somando com os outros nós de soma.' },
  { ramo: 1, posicao: 10, tipo: 'producao_soma', valor: 1, nome: 'Faria Limer', efeito: 'Produção +100%, somando com os outros nós de soma.' },
  { ramo: 1, posicao: 11, tipo: 'producao_soma', valor: 0.05, nome: 'Hora extra infinita', efeito: 'Produção +5% por nível, somando com os outros nós de soma.' },
  { ramo: 2, posicao: 6, tipo: 'inicio_valuation', valor: 1e9, nome: 'Poupança da vó', efeito: 'O Abrir CNPJ começa com F$ 1 bi.' },
  { ramo: 2, posicao: 7, tipo: 'inicio_eras', valor: 2, nome: 'Kit primeiro emprego', efeito: 'O Abrir CNPJ começa com 1 de cada gerador das eras 1 e 2.' },
  { ramo: 2, posicao: 8, tipo: 'inicio_valuation', valor: 1e12, nome: 'Clube de investimento do grupo', efeito: 'O Abrir CNPJ começa com F$ 1 tri.' },
  { ramo: 2, posicao: 9, tipo: 'inicio_eras', valor: 3, nome: 'Mochilão na Europa', efeito: 'O Abrir CNPJ começa com 1 de cada gerador das eras 1 a 3.' },
  { ramo: 2, posicao: 10, tipo: 'inicio_eras', valor: 4, nome: 'Nepo baby', efeito: 'O Abrir CNPJ começa com 1 de cada gerador das eras 1 a 4.' },
  { ramo: 2, posicao: 11, tipo: 'inicio_mult', valor: 10, nome: 'Abrir outra startup', efeito: 'O F$ com que o Abrir CNPJ começa ×10 por nível.' },
  { ramo: 3, posicao: 6, tipo: 'caixinha', valor: 6, nome: 'Cofrinho de porquinho', efeito: 'A caixinha guarda 6 oportunidades.' },
  { ramo: 3, posicao: 7, tipo: 'segundos', valor: 45, nome: 'Notificação fixada', efeito: 'Oportunidades passam 45 s na cena.' },
  { ramo: 3, posicao: 8, tipo: 'opp_extra', valor: 3, nome: 'Black Friday de verdade', efeito: '+3 oportunidades por dia (com o Relâmpago da Shopee, +6).' },
  { ramo: 3, posicao: 9, tipo: 'opp_bonus', valor: 1.5, nome: 'Cupom empilhado', efeito: 'Oportunidades rendem ×1,5 (com a Xepa da feira, ×3).' },
  { ramo: 3, posicao: 10, tipo: 'caixinha', valor: 8, nome: 'Gaveta das sacolinhas', efeito: 'A caixinha guarda 8 oportunidades.' },
  { ramo: 3, posicao: 11, tipo: 'opp_fs', valor: 0.02, nome: 'Cliente fiel', efeito: 'Oportunidades em F$ rendem +2% por nível.' },
  { ramo: 4, posicao: 6, tipo: 'dourado_tela', valor: 36, nome: 'Óculos novo', efeito: 'Eventos ficam 36 s na tela.' },
  { ramo: 4, posicao: 7, tipo: 'dourado_investidor', valor: 1.5, nome: 'Tubarão do Shark Tank', efeito: 'Investidor apressado rende 60 min de produção (no lugar de 40).' },
  { ramo: 4, posicao: 8, tipo: 'dourado_freq', valor: 2.5, nome: 'Trevo de quatro folhas', efeito: 'Eventos aparecem 2,5× mais vezes (o máximo do ramo).' },
  { ramo: 4, posicao: 9, tipo: 'dourado_duracao', valor: 3, nome: 'Trend do TikTok', efeito: 'Viralizou e Promoção duram o triplo.' },
  { ramo: 4, posicao: 10, tipo: 'dourado_investidor', valor: 1.5, nome: 'Gato da sorte da loja chinesa', efeito: 'Investidor apressado rende 90 min de produção.' },
  { ramo: 4, posicao: 11, tipo: 'dourado_investidor', valor: 1.02, nome: 'Sorte de principiante', efeito: 'Investidor apressado rende +2% por nível.' },
  { ramo: 5, posicao: 6, tipo: 'por_contratado', valor: 0.2, nome: 'Vale-refeição de verdade', efeito: 'Seus contratados rendem 20% (o máximo).' },
  { ramo: 5, posicao: 7, tipo: 'contrato_dias', valor: 14, nome: 'CLT premium', efeito: 'Os contratos que você faz duram 14 dias.' },
  { ramo: 5, posicao: 8, tipo: 'emprego_mult', valor: 3, nome: 'Passe do Neymar', efeito: 'Quem te contrata rende o triplo pra você.' },
  { ramo: 5, posicao: 9, tipo: 'contrato_preco', valor: 0.3, nome: 'Estágio "pela experiência"', efeito: 'Contratar custa 70% menos.' },
  { ramo: 5, posicao: 10, tipo: 'contrato_dias', valor: 21, nome: 'Day off no aniversário', efeito: 'Os contratos que você faz duram 21 dias.' },
  { ramo: 5, posicao: 11, tipo: 'contrato_desconto', valor: 0.02, nome: 'Happy hour da firma', efeito: 'Contratar custa 2% menos por nível (nunca menos de 10% do preço cheio).' },
  { ramo: 6, posicao: 6, tipo: 'horta_amadurece', valor: 0.6, nome: 'Fertilizante do vizinho', efeito: 'Plantas novas amadurecem 40% mais rápido.' },
  { ramo: 6, posicao: 7, tipo: 'horta_vida', valor: 2, nome: 'Estufa', efeito: 'Plantas novas vivem o dobro depois de maduras.' },
  { ramo: 6, posicao: 8, tipo: 'horta_cruza', valor: 3, nome: 'Abelha rainha', efeito: 'Cruzamento da Horta 3× mais fácil.' },
  { ramo: 6, posicao: 9, tipo: 'horta_mult', valor: 2, nome: 'Transgênico gourmet', efeito: 'Bônus das plantas ×2 (descontos seguem até 50%).' },
  { ramo: 6, posicao: 10, tipo: 'morango_chance', valor: 10, nome: 'Festival do Morango do Amor', efeito: 'Morango com Pescoço brota 10× mais.' },
  { ramo: 6, posicao: 11, tipo: 'horta_soma', valor: 0.05, nome: 'Adubo orgânico premium', efeito: 'Bônus das plantas +5% por nível (descontos seguem até 50%).' },
  // ===== os ramos novos (abrem junto com o recurso) =====
  { ramo: 7, posicao: 1, tipo: 'bolsa_corretagem', valor: 0.8, nome: 'Corretora "sem taxa"', efeito: 'A corretagem da Bolsa cai 20%.' },
  { ramo: 7, posicao: 2, tipo: 'bolsa_limite', valor: 50, nome: 'Conta no exterior', efeito: '+50 no limite de ações de cada empresa.' },
  { ramo: 7, posicao: 3, tipo: 'bolsa_espiadas', valor: 1, nome: 'Grupo de sinais no Telegram', efeito: '1 espiada grátis por dia na Bolsa.' },
  { ramo: 7, posicao: 4, tipo: 'bolsa_limite', valor: 100, nome: 'Home broker no celular', efeito: '+100 no limite de ações de cada empresa.' },
  { ramo: 7, posicao: 5, tipo: 'bolsa_corretagem', valor: 0.5, nome: 'Tio do Bitcoin', efeito: 'Corretagem pela metade.' },
  { ramo: 7, posicao: 6, tipo: 'bolsa_escritorio', valor: 1.5, nome: 'Escritório na Faria Lima', efeito: 'O bônus do Escritório vale ×1,5.' },
  { ramo: 7, posicao: 7, tipo: 'bolsa_espiadas', valor: 1, nome: 'Analista do YouTube', efeito: '+1 espiada grátis por dia (2 no total).' },
  { ramo: 7, posicao: 8, tipo: 'bolsa_limite', valor: 200, nome: 'Fundo exclusivo', efeito: '+200 no limite de ações de cada empresa.' },
  { ramo: 7, posicao: 9, tipo: 'bolsa_corretagem', valor: 0.25, nome: 'Corretagem zero (dessa vez é verdade)', efeito: 'Corretagem ×0,25.' },
  { ramo: 7, posicao: 10, tipo: 'bolsa_limite_mult', valor: 2, nome: 'Lobo de Wall Street', efeito: 'Limite de ações ×2.' },
  { ramo: 7, posicao: 11, tipo: 'bolsa_limite_soma', valor: 0.05, nome: 'Fundo de índice', efeito: 'Limite de ações +5% por nível.' },
  { ramo: 8, posicao: 1, tipo: 'conv_recarga', valor: 1.25, nome: 'Microfone de lapela', efeito: 'As trocas de convidado voltam 25% mais rápido.' },
  { ramo: 8, posicao: 2, tipo: 'conv_trocas', valor: 1, nome: 'Mesa de som', efeito: '+1 troca guardada (4).' },
  { ramo: 8, posicao: 3, tipo: 'conv_cadeira2', valor: 0.75, nome: 'Cadeira gamer', efeito: 'A cadeira do meio vale 75% (no lugar de 50%).' },
  { ramo: 8, posicao: 4, tipo: 'conv_queda', valor: 0.15, nome: 'Corte pro TikTok', efeito: 'A faixa do MC V.V é derrubada 15% das vezes (no lugar de 25%).' },
  { ramo: 8, posicao: 5, tipo: 'conv_efeito', valor: 0.1, nome: 'Patrocínio de casa de aposta', efeito: 'O bônus de produção dos convidados +10%.' },
  { ramo: 8, posicao: 6, tipo: 'conv_recarga', valor: 2, nome: 'Produtor que não dorme', efeito: 'As trocas de convidado voltam 2× mais rápido.' },
  { ramo: 8, posicao: 7, tipo: 'conv_cadeira3', valor: 0.5, nome: 'Sofá do estúdio', efeito: 'A cadeira do canto vale 50% (no lugar de 25%).' },
  { ramo: 8, posicao: 8, tipo: 'conv_trocas', valor: 1, nome: 'Pauta roubada do concorrente', efeito: '+1 troca guardada (5).' },
  { ramo: 8, posicao: 9, tipo: 'conv_efeito', valor: 0.25, nome: '10 milhões de views', efeito: 'O bônus de produção dos convidados +25% (com o Patrocínio, +35%).' },
  { ramo: 8, posicao: 10, tipo: 'conv_queda', valor: 0.05, nome: 'Virou programa de TV', efeito: 'A faixa do MC V.V é derrubada só 5% das vezes.' },
  { ramo: 8, posicao: 11, tipo: 'conv_efeito', valor: 0.02, nome: 'Corte viral', efeito: 'O bônus de produção dos convidados +2% por nível.' },
  { ramo: 9, posicao: 1, tipo: 'mapa_abrir', valor: 0.75, nome: 'Rolê de quinta', efeito: 'Abrir lugar no Mapa custa 25% menos.' },
  { ramo: 9, posicao: 2, tipo: 'mapa_nivel', valor: 0.8, nome: 'Vaquinha dos parças', efeito: 'Subir nível de lugar custa 20% menos.' },
  { ramo: 9, posicao: 3, tipo: 'marcos_mult', valor: 1.25, nome: 'Check-in no Instagram', efeito: 'Os marcos dos lugares valem ×1,25.' },
  { ramo: 9, posicao: 4, tipo: 'tee_publico', valor: 1.15, nome: 'Influencer de bairro', efeito: 'Camisetaria: público +15% (a procura das coleções novas).' },
  { ramo: 9, posicao: 5, tipo: 'copao_mult', valor: 1.25, nome: 'Open bar até meia-noite', efeito: 'O Copão rende ×1,25 de fichas.' },
  { ramo: 9, posicao: 6, tipo: 'mapa_abrir', valor: 0.5, nome: 'Promoter que conhece o dono', efeito: 'Abrir lugar no Mapa custa 50% menos.' },
  { ramo: 9, posicao: 7, tipo: 'mapa_nivel', valor: 0.6, nome: 'Nome na lista', efeito: 'Subir nível de lugar custa 40% menos.' },
  { ramo: 9, posicao: 8, tipo: 'marcos_mult', valor: 1.5, nome: 'Rolê que virou lenda', efeito: 'Os marcos dos lugares valem ×1,5.' },
  { ramo: 9, posicao: 9, tipo: 'tee_tempo', valor: 0.5, nome: 'Drop esgotado', efeito: 'A Camisetaria vende a coleção na metade do tempo.' },
  { ramo: 9, posicao: 10, tipo: 'copao_mult', valor: 1.5, nome: 'After até o sol nascer', efeito: 'O Copão rende ×1,5 de fichas.' },
  { ramo: 9, posicao: 11, tipo: 'marcos_soma', valor: 0.03, nome: 'Rolê infinito', efeito: 'Os marcos dos lugares valem +3% por nível.' },
  { ramo: 10, posicao: 1, tipo: 'lixo_min', valor: 15, nome: 'Treino na NASA', efeito: 'Cada destroço desviado do Lixo espacial vale 15 min de produção (no lugar de 10).' },
  { ramo: 10, posicao: 2, tipo: 'silver_min', valor: 3, nome: 'Rolo extra de silver tape', efeito: 'O Silver tape do Houston dura 3 min.' },
  { ramo: 10, posicao: 3, tipo: 'legado_mult', valor: 1.5, nome: 'Antena voltada pra Terra', efeito: 'As melhorias de legado valem ×1,5.' },
  { ramo: 10, posicao: 4, tipo: 'espaco_soma', valor: 0.25, nome: 'Combustível de foguete', efeito: 'Geradores das eras 6 em diante +25% (somando com os outros do Espaço).' },
  { ramo: 10, posicao: 5, tipo: 'era_freq', valor: 1.5, nome: 'TARS, honestidade 90%', efeito: 'Eventos de era aparecem 1,5× mais.' },
  { ramo: 10, posicao: 6, tipo: 'silver_mult', valor: 5, nome: 'Fita prateada industrial', efeito: 'O Silver tape vira ×5.' },
  { ramo: 10, posicao: 7, tipo: 'legado_mult', valor: 2, nome: 'Mensagem de casa', efeito: 'As melhorias de legado valem ×2.' },
  { ramo: 10, posicao: 8, tipo: 'espaco_soma', valor: 0.5, nome: 'Motor de dobra', efeito: 'Geradores das eras 6 em diante +50% (somando com os outros do Espaço).' },
  { ramo: 10, posicao: 9, tipo: 'era_janela', valor: 2, nome: 'Ancoragem manual', efeito: 'Eventos de era ficam o dobro do tempo na tela.' },
  { ramo: 10, posicao: 10, tipo: 'espaco_soma', valor: 1, nome: 'Endurance', efeito: 'Geradores das eras 6 em diante +100% (somando com os outros do Espaço).' },
  { ramo: 10, posicao: 11, tipo: 'espaco_soma', valor: 0.05, nome: 'Buraco de minhoca', efeito: 'Geradores das eras 6 em diante +5% por nível.' },
```

Logo depois do `];` de `ARVORE`, acrescente:

```ts

/** As 9 pontes (ramo 11): uma entre cada par de ramos vizinhos na copa (catalogo.ts ORDEM_RAMOS), pedindo o nó 5 dos
 *  dois. Todas somam na produção (tipo producao_soma). Ids 2001 em diante, na ordem. */
export const PONTES: readonly { entre: readonly [number, number]; nome: string; efeito: string; valor: number }[] = [
  { entre: [6, 9], valor: 0.15, nome: 'Feira orgânica no rolê', efeito: 'Produção +15%, somando com os outros nós de soma.' },
  { entre: [9, 5], valor: 0.15, nome: 'A firma fechou o bar', efeito: 'Produção +15%, somando com os outros nós de soma.' },
  { entre: [5, 8], valor: 0.2, nome: 'Estagiário virou convidado', efeito: 'Produção +20%, somando com os outros nós de soma.' },
  { entre: [8, 2], valor: 0.2, nome: 'Podcast da startup que faliu', efeito: 'Produção +20%, somando com os outros nós de soma.' },
  { entre: [2, 1], valor: 0.25, nome: 'Pivotou', efeito: 'Produção +25%, somando com os outros nós de soma.' },
  { entre: [1, 10], valor: 0.25, nome: 'Fábrica em órbita', efeito: 'Produção +25%, somando com os outros nós de soma.' },
  { entre: [10, 3], valor: 0.25, nome: 'Frete grátis pra Lua', efeito: 'Produção +25%, somando com os outros nós de soma.' },
  { entre: [3, 7], valor: 0.2, nome: 'Promoção relâmpago no home broker', efeito: 'Produção +20%, somando com os outros nós de soma.' },
  { entre: [7, 4], valor: 0.25, nome: 'Dica quente do investidor anjo', efeito: 'Produção +25%, somando com os outros nós de soma.' },
];
```

- [ ] **Step 4: O catálogo (`catalogo.ts`)**

1. No import de `./nomes`, acrescente `PONTES` (em ordem: `…, MELHORIAS_GERADOR, PONTES, SINERGIAS, …`).
2. Troque o bloco `/** Árvore de habilidades: custo …` + `CUSTO_NO` + `CUSTO_RAIZ` + `RAIZ` (l. 34–37) por:

```ts
/** Árvore de habilidades: custo em pontos de prestígio por posição no ramo (1 a 5); a raiz custa 1. Preço em produção:
 *  não muda nunca. */
export const CUSTO_NO = [2, 4, 8, 15, 30] as const;
export const CUSTO_RAIZ = 1;
export const RAIZ = 1;
/** Árvore grande (16/10, entrega 6). Custos das posições 6–10 dos ramos de hoje, dos ramos dos recursos (7 Bolsa, 8 PPP,
 *  9 Mapa, posições 1–10), do Espaço (10) e das pontes (2001–2009), e dos infinitos: o próximo nível n custa
 *  round(CUSTO_INFINITO · CRESCE_INFINITO^(n − 1)). Calibrados na simulação do veterano (simulacao.test.ts, "o veterano":
 *  a parte fixa fecha no dia ~12; ×0,28 os da spec, que nunca fechavam abaixo do teto da era 7). */
export const CUSTO_NOVOS_HOJE = [15, 35, 70, 150, 300] as const;
export const CUSTO_RECURSO = [8, 15, 35, 70, 150, 200, 350, 550, 850, 1500] as const;
export const CUSTO_ESPACO = [150, 200, 350, 550, 1000, 1500, 3000, 4500, 7000, 15000] as const;
export const CUSTO_PONTE = [550, 700, 850, 1000, 1500, 5500, 4000, 1500, 2000] as const;
export const CUSTO_INFINITO = 1000;
export const CRESCE_INFINITO = 1.6;
/** A ordem dos ramos na copa, da esquerda pra direita (a raiz no meio, embaixo, entre o Recomeço e a Produção). */
export const ORDEM_RAMOS = [6, 9, 5, 8, 2, 1, 10, 3, 7, 4] as const;
/** Os ramos dos recursos abrem com o recurso: a era em que ele abre hoje (Mapa na era 2; Convidados com o gerador 13, o
 *  1º da era 3; Bolsa com o gerador 19, o 1º da era 4). */
export const ERA_RECURSO: Readonly<Record<number, number>> = { 7: 4, 8: 3, 9: 2 };
/** Portões: 3 vendas (posições 6–7 dos ramos de hoje), era 7 alcançada (8–10), 5 vendas (pontes), 10 vendas (infinitos). */
export const VENDAS_67 = 3;
export const ERA_8A10 = 7;
export const VENDAS_PONTE = 5;
export const VENDAS_INFINITO = 10;
/** As pontes ficam no ramo 11. */
export const RAMO_PONTE = 11;
/** O id de um nó: a raiz é 1; os 31 de hoje, ramo·10 + posição; os novos, ramo·100 + posição; o infinito (posição 11),
 *  3000 + ramo. As pontes são 2001–2009 (montarCatalogo). */
export function idNo(ramo: number, posicao: number): number {
  if (ramo === 0) return RAIZ;
  if (posicao === 11) return 3000 + ramo;
  return ramo <= 6 && posicao <= 5 ? ramo * 10 + posicao : ramo * 100 + posicao;
}
```

3. Troque o tipo `No` (l. 61–65) por:

```ts
/** Nó da árvore. requer = o nó anterior do ramo (a raiz, para o 1º; o nó 10, para o infinito; null na raiz); requer2 =
 *  o 2º que a ponte pede (null nos outros). Portões além dos pontos (null = sem): reqVendas (vendas da startup) e reqEra
 *  (maior era alcançada). cresce: só nos infinitos (o preço do próximo nível = round(custo · cresce^nível)). */
export type No = {
  id: number; ramo: number; posicao: number; nome: string; efeito: string; custo: number; tipo: TipoNo; valor: number;
  requer: number | null; requer2: number | null; reqVendas: number | null; reqEra: number | null; cresce: number | null;
};
```

4. Em `montarCatalogo`, troque o `const arvore: No[] = ARVORE.map(…);` inteiro (l. 137–141) por:

```ts
  const arvore: No[] = ARVORE.map((n) => {
    const infinito = n.posicao === 11;
    const custo = n.ramo === 0 ? CUSTO_RAIZ
      : infinito ? CUSTO_INFINITO
      : n.ramo <= 6 ? (n.posicao <= 5 ? CUSTO_NO[n.posicao - 1] : CUSTO_NOVOS_HOJE[n.posicao - 6])
      : n.ramo === 10 ? CUSTO_ESPACO[n.posicao - 1]
      : CUSTO_RECURSO[n.posicao - 1];
    const requer = n.ramo === 0 ? null : infinito ? idNo(n.ramo, 10) : n.posicao === 1 ? RAIZ : idNo(n.ramo, n.posicao - 1);
    const reqVendas = infinito ? VENDAS_INFINITO : n.ramo >= 1 && n.ramo <= 6 && (n.posicao === 6 || n.posicao === 7) ? VENDAS_67 : null;
    const reqEra = infinito || n.ramo === 0 ? null
      : n.ramo <= 6 ? (n.posicao >= 8 ? ERA_8A10 : null)
      : n.ramo === 10 ? (n.posicao <= 5 ? 6 : 7)
      : ERA_RECURSO[n.ramo];
    return {
      id: idNo(n.ramo, n.posicao), ramo: n.ramo, posicao: n.posicao, nome: n.nome, efeito: n.efeito, custo, tipo: n.tipo, valor: n.valor,
      requer, requer2: null, reqVendas, reqEra, cresce: infinito ? CRESCE_INFINITO : null,
    };
  });
  PONTES.forEach((p, i) => arvore.push({
    id: 2001 + i, ramo: RAMO_PONTE, posicao: i + 1, nome: p.nome, efeito: p.efeito, custo: CUSTO_PONTE[i], tipo: 'producao_soma',
    valor: p.valor, requer: idNo(p.entre[0], 5), requer2: idNo(p.entre[1], 5), reqVendas: VENDAS_PONTE, reqEra: null, cresce: null,
  }));
```

5. Em `catalogoSql`, troque o `const nos = cat.arvore.map(…)` (l. 166–169) por:

```ts
  const nos = cat.arvore.map(
    (n) =>
      `  (${n.id}, ${n.ramo}, ${n.posicao}, ${txt(n.nome)}, ${txt(n.efeito)}, ${n.custo}, ${txt(n.tipo)}, ${num(n.valor)}, ${num(n.requer)}, ${num(n.requer2)}, ${num(n.reqVendas)}, ${num(n.reqEra)}, ${num(n.cresce)})`,
  );
```

6. No texto do SQL, troque o `create table if not exists public.idle_cat_no (…);` (l. 194–197) por:

```sql
create table if not exists public.idle_cat_no (
  id int primary key, ramo int not null, posicao int not null, nome text not null, efeito text not null, custo int not null,
  tipo text not null, valor double precision not null, requer int, requer2 int, req_vendas int, req_era int, cresce double precision
);
```

   e, logo depois das 3 linhas `alter table public.idle_cat_upg …` do legado (antes da linha em branco que vem antes de `alter table public.idle_cat_gen enable row level security;`), acrescente:

```sql
-- árvore grande (0081): a ponte pede 2 nós; portões de vendas e de era; o crescimento do preço dos infinitos
alter table public.idle_cat_no add column if not exists requer2 int, add column if not exists req_vendas int, add column if not exists req_era int, add column if not exists cresce double precision;
```

7. Troque a linha `insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer) values` por `insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer, requer2, req_vendas, req_era, cresce) values`.

- [ ] **Step 5: Gerar a 0081 e listar nos dois bancos**

Acrescente `'0081_fellas_inc_catalogo_arvore_grande.sql',` no fim de `MIGRATIONS` em `games/test/db.ts` (depois da 0080, se a main já trouxe; senão depois da 0079). Em `games/dev/mockDb.ts`: `import m81 from '../../supabase/migrations/0081_fellas_inc_catalogo_arvore_grande.sql?raw';` depois do último import de migração, e `m81` no fim do array do `for`.

Run: `cd games && ATUALIZAR_CATALOGO=0081_fellas_inc_catalogo_arvore_grande.sql npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: cria `supabase/migrations/0081_fellas_inc_catalogo_arvore_grande.sql` e PASS.

- [ ] **Step 6: Rodar o que encosta no catálogo**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/catalogo.test.ts idle/economia.test.ts idle/simulacao.test.ts test/idleArvore.test.ts test/idleParidade.test.ts test/idle.test.ts`
Expected: PASS. Os tipos novos ainda não fazem nada na página nem no banco (as duas contas ignoram tipo que não conhecem: a paridade "cada nó sozinho" continua igual). **Ficam vermelhos até a Task 2**: `idle/legado.test.ts`, `idle/arvoreTela.test.ts` e o `describe('legado: …')` de `idle/tela.test.ts` (a copa de hoje só tem posição pros 31); e `idle/ativos.test.ts` ("todo nó tem ícone 16x16") até a Task 9. Anote no relatório; nenhum outro pode falhar.

- [ ] **Step 7: Commit**

```bash
git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts games/test/idleArvore.test.ts supabase/migrations/0081_fellas_inc_catalogo_arvore_grande.sql games/test/db.ts games/dev/mockDb.ts
git commit -m "Fellas Inc.: catálogo da árvore grande (120 nós: 6–10 dos ramos de hoje, Bolsa, PPP, Mapa, Espaço, pontes e infinitos) (0081)"
```

---
### Task 2: A copa gerada e o que a página sabe de cada nó (nível, preço, portão, situação)

**Files:**
- Modify: `games/idle/legado.ts` (l. 1–6 imports; troca tudo de l. 106 ao fim)
- Modify: `games/shared/types.ts` (`IdleState`, l. 173)
- Modify: `games/idle/arvoreTela.ts` (o mínimo pra usar o contexto, a 2ª ligação da ponte e o portão; a tela nova é a Task 10)
- Modify: `games/idle/tela.ts:20` (import) e `:597` (`podem`)
- Modify: `games/idle/legado.test.ts` (imports; `describe('árvore')` e `describe('árvore em tela cheia: a copa')`), `games/idle/arvoreTela.test.ts`

**Interfaces:**
- Consumes: `catalogo.arvore` com `requer2`/`reqVendas`/`reqEra`/`cresce`, `ORDEM_RAMOS`, `RAMO_PONTE`, `RAMOS`, `NOME_PONTE` (Task 1).
- Produces: em `shared/types.ts`: `IdleState.era_max?: number` e `bonus: { arvore: number[]; conquistas: number; niveis?: Record<string, number> }`. Em `legado.ts`: `type ContextoArvore = { arvore: readonly number[]; niveis: Readonly<Record<string, number>>; pontos: number; vendas: number; eraMax: number }`, `contextoArvore(s): ContextoArvore`, `nivelNo(no, c): number`, `precoNo(no, c): number`, `liberadoNo(no, arvore): boolean`, `portao(no, c): string | null`, `type SituacaoTela = 'comprado' | 'pode' | 'falta' | 'portao' | 'trancado'`, `situacaoTela(no, c)`, `noInicial(c): number`, `falta(no)`, `ondeNo(no)`, `descricaoNo(no, sit, c)`, `ramoDoNo(no): number` (o da ponte = o do 1º pedido), `RAMOS_ARVORE` (0–10), `MUNDO_ARVORE = { largura: 1348, altura: 1200 }`, `POSICOES_ARVORE` (120), `ROTULOS_ARVORE` (10, na ordem da copa, com `ramo`), `escalaArvore(largura, altura)`.

- [ ] **Step 1: Testes (falham)**

Em `games/idle/legado.test.ts`, troque o import de `./legado` por:

```ts
import {
  avisos, contextoArvore, criarFilaAvisos, descricaoNo, detectarNovas, dicaConquista, escalaArvore, falta, faltam, ganhouEm, grade, liberadoNo,
  MUNDO_ARVORE, nivelNo, noInicial, ondeNo, pontos, portao, POSICOES_ARVORE, precoNo, RAMOS_ARVORE, ROTULOS_ARVORE, situacao, situacaoTela,
  textoVenda, TOTAL_CONQUISTAS, type ContextoArvore,
} from './legado';
```

Troque os dois `describe` da árvore (`describe('árvore', …)` e `describe('árvore em tela cheia: a copa', …)`, da l. 138 ao fim do arquivo) por:

```ts
describe('árvore', () => {
  it('a raiz e os 10 ramos, na ordem do catálogo, com 10 nós e o infinito cada', () => {
    expect(RAMOS_ARVORE.map((r) => [r.nome, r.nos.length])).toEqual([
      ['Raiz', 1], ['Produção', 11], ['Recomeço', 11], ['Oportunidades', 11], ['Dourados', 11], ['Gente', 11], ['Horta', 11],
      ['Bolsa', 11], ['PPP Podcast', 11], ['Mapa do rolê', 11], ['Espaço', 11],
    ]);
    for (const r of RAMOS_ARVORE.slice(1)) expect(r.nos.map((n) => n.posicao)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
  });
  it('comprado, disponível (tem o que o nó pede; a ponte pede os dois nós 5) ou trancado', () => {
    const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
    expect(situacao(no(1), [])).toBe('disponivel');
    expect(situacao(no(11), [])).toBe('trancado');
    expect(situacao(no(11), [1])).toBe('disponivel');
    expect(situacao(no(12), [1])).toBe('trancado');
    expect(situacao(no(11), [1, 11])).toBe('comprado');
    expect(liberadoNo(no(2005), [25])).toBe(false);
    expect(liberadoNo(no(2005), [25, 15])).toBe(true);
    expect(falta(no(12))).toBe('Libera com Cafezinho de garrafa térmica');
    expect(falta(no(11))).toBe('Libera com Virou MEI');
    expect(falta(no(2005))).toBe('Libera com Material escolar completo e O hexa vem');
    expect(falta(no(1))).toBe('');
  });
});

const noDe = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
const ctx = (x: Partial<ContextoArvore> = {}): ContextoArvore => ({ arvore: [], niveis: {}, pontos: 0, vendas: 0, eraMax: 1, ...x });

describe('nível, preço e portão', () => {
  it('nível: 0 sem o nó; 1 no fixo; o do banco no infinito (resposta velha, sem niveis: 1)', () => {
    expect(nivelNo(noDe(11), ctx())).toBe(0);
    expect(nivelNo(noDe(11), ctx({ arvore: [1, 11] }))).toBe(1);
    expect(nivelNo(noDe(3001), ctx({ arvore: [3001], niveis: { 3001: 7 } }))).toBe(7);
    expect(nivelNo(noDe(3001), ctx({ arvore: [3001] }))).toBe(1);
  });
  it('preço: o custo; no infinito, round(1000 · 1,6^nível de agora)', () => {
    expect(precoNo(noDe(106), ctx())).toBe(15);
    expect(precoNo(noDe(3001), ctx())).toBe(1000);
    expect(precoNo(noDe(3001), ctx({ arvore: [3001] }))).toBe(1600);
    expect(precoNo(noDe(3001), ctx({ arvore: [3001], niveis: { 3001: 9 } }))).toBe(68719);
    expect(precoNo(noDe(3001), ctx({ arvore: [3001], niveis: { 3001: 19 } }))).toBe(7922816);
  });
  it('portão: vendas, era alcançada ou o recurso; null quando passou', () => {
    expect(portao(noDe(106), ctx({ vendas: 1 }))).toBe('Falta: 3 vendas (você tem 1)');
    expect(portao(noDe(106), ctx({ vendas: 3 }))).toBeNull();
    expect(portao(noDe(108), ctx({ eraMax: 6 }))).toBe('Falta: chegar na era 7 (você chegou na 6)');
    expect(portao(noDe(1001), ctx({ eraMax: 5 }))).toBe('Falta: chegar na era 6 (você chegou na 5)');
    expect(portao(noDe(701), ctx({ eraMax: 3 }))).toBe('Abre com a Bolsa');
    expect(portao(noDe(801), ctx({ eraMax: 2 }))).toBe('Abre com os Convidados');
    expect(portao(noDe(901), ctx({ eraMax: 1 }))).toBe('Abre com o Mapa do rolê');
    expect(portao(noDe(901), ctx({ eraMax: 2 }))).toBeNull();
    expect(portao(noDe(2001), ctx({ vendas: 4 }))).toBe('Falta: 5 vendas (você tem 4)');
    expect(portao(noDe(3003), ctx({ vendas: 9 }))).toBe('Falta: 10 vendas (você tem 9)');
  });
  it('o contexto do estado: era_max que falta (resposta velha) é a era de agora; niveis que falta é vazio', () => {
    const c = contextoArvore(estado({ era: 4, vendas: 2, pontos: 9, bonus: { arvore: [1], conquistas: 0 } }));
    expect(c).toEqual({ arvore: [1], niveis: {}, pontos: 9, vendas: 2, eraMax: 4 });
    expect(contextoArvore(estado({ era: 1, era_max: 7 })).eraMax).toBe(7);
  });
});

describe('árvore em tela cheia: a copa', () => {
  it('as 120 posições existem e cabem no mundo com folga de 26', () => {
    const ids = Object.keys(POSICOES_ARVORE).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(catalogo.arvore.map((n) => n.id).sort((a, b) => a - b));
    expect(MUNDO_ARVORE).toEqual({ largura: 1348, altura: 1200 });
    for (const [x, y] of Object.values(POSICOES_ARVORE)) {
      expect(x).toBeGreaterThanOrEqual(26);
      expect(x).toBeLessThanOrEqual(MUNDO_ARVORE.largura - 26);
      expect(y).toBeGreaterThanOrEqual(26);
      expect(y).toBeLessThanOrEqual(MUNDO_ARVORE.altura - 26);
    }
  });
  it('nenhum nó encosta no outro: centros a 64 ou mais; o nó 10 e o infinito (maiores) a 84 ou mais', () => {
    const grande = (id: number) => { const n = noDe(id); return n.posicao >= 10 && n.ramo !== 11; };
    const ids = Object.keys(POSICOES_ARVORE).map(Number);
    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const [a, b] = [POSICOES_ARVORE[ids[i]], POSICOES_ARVORE[ids[j]]];
        const d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        expect(d, `${ids[i]} × ${ids[j]}`).toBeGreaterThanOrEqual(grande(ids[i]) || grande(ids[j]) ? 84 : 64);
      }
    }
  });
  it('a raiz embaixo de tudo; cada nó acima do que ele pede (a ponte, acima dos dois)', () => {
    const yRaiz = POSICOES_ARVORE[1][1];
    for (const n of catalogo.arvore) {
      if (n.id !== 1) expect(POSICOES_ARVORE[n.id][1]).toBeLessThan(yRaiz);
      for (const r of [n.requer, n.requer2]) {
        if (r !== null && r !== 1) expect(POSICOES_ARVORE[n.id][1], `${n.id} × ${r}`).toBeLessThan(POSICOES_ARVORE[r][1]);
      }
    }
  });
  it('as colunas na ordem da copa (Horta à esquerda, Dourados à direita) e a raiz no meio, entre o Recomeço e a Produção', () => {
    const x = (ramo: number) => POSICOES_ARVORE[catalogo.arvore.find((n) => n.ramo === ramo && n.posicao === 1)!.id][0];
    const ordem = [6, 9, 5, 8, 2, 1, 10, 3, 7, 4];
    for (let k = 1; k < ordem.length; k++) expect(x(ordem[k]) - x(ordem[k - 1])).toBe(132);
    expect(POSICOES_ARVORE[1][0]).toBe(MUNDO_ARVORE.largura / 2);
    expect(POSICOES_ARVORE[1][0]).toBeGreaterThan(x(2));
    expect(POSICOES_ARVORE[1][0]).toBeLessThan(x(1));
    // as pontes no meio das duas colunas
    for (const p of catalogo.arvore.filter((n) => n.ramo === 11)) {
      expect(POSICOES_ARVORE[p.id][0]).toBe((POSICOES_ARVORE[p.requer!][0] + POSICOES_ARVORE[p.requer2!][0]) / 2);
    }
  });
  it('o nome de cada ramo fica 64 acima do infinito, na ordem da copa, dentro do mundo; os da mesma altura a 100 ou mais', () => {
    expect(ROTULOS_ARVORE.map((r) => r.nome)).toEqual(['Horta', 'Mapa do rolê', 'Gente', 'PPP Podcast', 'Recomeço', 'Produção', 'Espaço', 'Oportunidades', 'Bolsa', 'Dourados']);
    for (const r of ROTULOS_ARVORE) {
      expect(r.y).toBe(POSICOES_ARVORE[3000 + r.ramo][1] - 64);
      expect(r.x).toBe(POSICOES_ARVORE[3000 + r.ramo][0]);
      expect(r.y).toBeGreaterThanOrEqual(8);
      for (const o of ROTULOS_ARVORE) {
        if (o !== r && Math.abs(o.y - r.y) < 20) expect(Math.abs(o.x - r.x), `${r.nome} × ${o.nome}`).toBeGreaterThanOrEqual(100);
      }
    }
  });
  it('escala: cabe no lado mais apertado, presa entre 0,8 e 1,4', () => {
    expect(escalaArvore(1348, 1200)).toBe(1);
    expect(escalaArvore(4000, 4000)).toBe(1.4);
    expect(escalaArvore(300, 800)).toBe(0.8);
  });
  it('situação na tela: comprado, dá pra comprar, falta ponto, portão, trancado; o infinito comprado segue comprável', () => {
    expect(situacaoTela(noDe(1), ctx({ arvore: [1] }))).toBe('comprado');
    expect(situacaoTela(noDe(11), ctx({ arvore: [1], pontos: 2 }))).toBe('pode');
    expect(situacaoTela(noDe(11), ctx({ arvore: [1], pontos: 1 }))).toBe('falta');
    expect(situacaoTela(noDe(12), ctx({ arvore: [1], pontos: 99 }))).toBe('trancado');
    expect(situacaoTela(noDe(1), ctx())).toBe('falta');
    expect(situacaoTela(noDe(106), ctx({ arvore: [1, 11, 12, 13, 14, 15], pontos: 99, vendas: 2 }))).toBe('portao');
    expect(situacaoTela(noDe(106), ctx({ arvore: [1, 11, 12, 13, 14, 15], pontos: 99, vendas: 3 }))).toBe('pode');
    const cheio = ctx({ arvore: [3001], niveis: { 3001: 2 }, vendas: 10 });
    expect(situacaoTela(noDe(3001), { ...cheio, pontos: 2560 })).toBe('pode');
    expect(situacaoTela(noDe(3001), { ...cheio, pontos: 2559 })).toBe('falta');
  });
  it('nó inicial: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz', () => {
    expect(noInicial(ctx({ pontos: 5 }))).toBe(1);
    expect(noInicial(ctx())).toBe(1);
    expect(noInicial(ctx({ arvore: [1], pontos: 3 }))).toBe(11);
    expect(noInicial(ctx({ arvore: [1, 11], pontos: 3 }))).toBe(21);
    expect(noInicial(ctx({ arvore: [1, 11], pontos: 1 }))).toBe(21);
    expect(noInicial(ctx({ arvore: [1], pontos: 9, eraMax: 4 }))).toBe(11); // a Bolsa 1 custa 8: o 11 (2) vem antes
    // tudo comprado: sobram os infinitos (1.600 o próximo nível), o de menor id
    expect(noInicial(ctx({ arvore: catalogo.arvore.map((n) => n.id), pontos: 99, vendas: 99, eraMax: 7 }))).toBe(3001);
  });
  it('textos: onde fica, quanto falta e a descrição pro leitor de tela', () => {
    expect(ondeNo(noDe(1))).toBe('Raiz');
    expect(ondeNo(noDe(12))).toBe('Produção · 2 de 10');
    expect(ondeNo(noDe(707))).toBe('Bolsa · 7 de 10');
    expect(ondeNo(noDe(3008))).toBe('PPP Podcast · infinito');
    expect(ondeNo(noDe(2003))).toBe('Ponte · Gente e PPP Podcast');
    expect(faltam(1)).toBe('Falta 1 ★');
    expect(faltam(5)).toBe('Faltam 5 ★');
    const c = ctx({ pontos: 3, vendas: 1 });
    expect(descricaoNo(noDe(11), 'comprado', c)).toBe('Cafezinho de garrafa térmica, comprado');
    expect(descricaoNo(noDe(21), 'pode', c)).toBe('Porquinho quebrado, dá pra comprar por 2 ★');
    expect(descricaoNo(noDe(13), 'falta', c)).toBe('Turno dobrado, faltam 5 ★');
    expect(descricaoNo(noDe(14), 'trancado', c)).toBe('Tema da Vitória, trancado');
    expect(descricaoNo(noDe(106), 'portao', c)).toBe('Coach quântico, falta: 3 vendas (você tem 1)');
    expect(descricaoNo(noDe(3001), 'falta', ctx({ arvore: [3001], niveis: { 3001: 4 }, pontos: 6000 }))).toBe('Hora extra infinita, nível 4, faltam 554 ★');
  });
});
```

Em `games/idle/arvoreTela.test.ts`, no 1º teste: `toHaveLength(31)` → `toHaveLength(120)`; `expect(document.querySelectorAll('.ligacao')).toHaveLength(30);` → `toHaveLength(128); // 119 do nó pro anterior + a 2ª linha das 9 pontes`; a lista dos rótulos → `['Horta', 'Mapa do rolê', 'Gente', 'PPP Podcast', 'Recomeço', 'Produção', 'Espaço', 'Oportunidades', 'Bolsa', 'Dourados']`. No 2º: `'Recomeço · 1 de 5'` → `'Recomeço · 1 de 10'`. No teste `'legenda com as 4 situações'`: título `'legenda com as 5 situações'` e a lista `['Comprado', 'Dá pra comprar', 'Falta ponto', 'Tem portão', 'Trancado']`. No da miniatura: título `'miniatura: 120 quadradinhos e 128 linhas, decorativa'`, `toHaveLength(31)` → `toHaveLength(120)`, `toHaveLength(30)` → `toHaveLength(128)`. Acrescente no fim do `describe`:

```ts
  it('nó com portão: o cartão diz o que falta, sem botão', () => {
    abrir(estado({ pontos: 99, vendas: 1, bonus: { arvore: [1, 11, 12, 13, 14, 15], conquistas: 0 } }));
    no(106).click();
    expect(no(106).classList.contains('portao')).toBe(true);
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().textContent).toContain('Falta: 3 vendas (você tem 1)');
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/legado.test.ts idle/arvoreTela.test.ts`
Expected: FAIL (imports, posições, situações).

- [ ] **Step 2: Os tipos (`shared/types.ts`)**

Em `IdleState`, troque `bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number; vendas: number; recorde: number;` por:

```ts
  bonus: { arvore: number[]; conquistas: number; /** nível dos infinitos ({"3001": 4}; 0082). Ausente = nível 1. */ niveis?: Record<string, number> };
  pontos: number; pontos_vida: number; vendas: number; recorde: number;
  /** A maior era que a empresa já alcançou, vendendo ou não (0082). Ausente = a era de agora. */
  era_max?: number;
```

- [ ] **Step 3: `legado.ts`**

Troque os imports do topo (l. 3–6) por:

```ts
import type { IdleState } from '../shared/types';
import { catalogo, ORDEM_RAMOS, RAMO_PONTE, type Conquista, type No } from './catalogo';
import type { Dica } from './dica';
import { NOME_PONTE, RAMOS } from './nomes';
```

Troque tudo da l. 106 (`/** Como um nó aparece: …`) até o fim do arquivo por:

```ts
/** Como um nó aparece no texto: comprado, disponível (tem o que ele pede) ou trancado. */
export type SituacaoNo = 'comprado' | 'disponivel' | 'trancado';
/** Tem o que o nó pede: o anterior do ramo e, na ponte, o nó 5 do outro ramo. */
export const liberadoNo = (no: No, arvore: readonly number[]): boolean =>
  (no.requer === null || arvore.includes(no.requer)) && (no.requer2 === null || arvore.includes(no.requer2));
export function situacao(no: No, arvore: readonly number[]): SituacaoNo {
  if (arvore.includes(no.id)) return 'comprado';
  return liberadoNo(no, arvore) ? 'disponivel' : 'trancado';
}

/** O que a página sabe da sua árvore pra decidir cada nó: os nós e o nível dos infinitos, os pontos livres, quantas
 *  vezes vendeu e a maior era alcançada (os portões). */
export type ContextoArvore = {
  arvore: readonly number[]; niveis: Readonly<Record<string, number>>; pontos: number; vendas: number; eraMax: number;
};
/** Do estado: resposta de antes da 0082 (sem niveis nem era_max) vale nível 1 e a era de agora. */
export const contextoArvore = (s: Pick<IdleState, 'bonus' | 'pontos' | 'vendas' | 'era' | 'era_max'>): ContextoArvore => ({
  arvore: s.bonus.arvore, niveis: s.bonus.niveis ?? {}, pontos: s.pontos, vendas: s.vendas, eraMax: Math.max(s.era, s.era_max ?? 1),
});

/** O nível do nó: 0 sem ele; 1 nos fixos; nos infinitos, o do banco (1 se a resposta não trouxe). */
export function nivelNo(no: No, c: Pick<ContextoArvore, 'arvore' | 'niveis'>): number {
  if (!c.arvore.includes(no.id)) return 0;
  return no.cresce === null ? 1 : Math.max(1, c.niveis[String(no.id)] ?? 1);
}
/** Quanto custa comprar o nó (o próximo nível, no infinito): round(custo · cresce^nível de agora), igual a idle_buy_node. */
export const precoNo = (no: No, c: Pick<ContextoArvore, 'arvore' | 'niveis'>): number =>
  (no.cresce === null ? no.custo : Math.round(no.custo * no.cresce ** nivelNo(no, c)));

/** Quem abre cada ramo dos recursos (o portão dele é a era em que o recurso abre). */
const QUEM_ABRE: Readonly<Record<number, string>> = { 7: 'Abre com a Bolsa', 8: 'Abre com os Convidados', 9: 'Abre com o Mapa do rolê' };
/** O portão que falta além dos pontos (o mesmo motivo do idle_gate do banco), ou null. */
export function portao(no: No, c: Pick<ContextoArvore, 'vendas' | 'eraMax'>): string | null {
  if (no.reqVendas !== null && c.vendas < no.reqVendas) return `Falta: ${no.reqVendas} vendas (você tem ${c.vendas})`;
  if (no.reqEra !== null && c.eraMax < no.reqEra) return QUEM_ABRE[no.ramo] ?? `Falta: chegar na era ${no.reqEra} (você chegou na ${c.eraMax})`;
  return null;
}

/** O ramo de um nó na copa (a ponte fica com o do 1º nó que ela pede). */
export function ramoDoNo(no: No): number {
  if (no.ramo !== RAMO_PONTE) return no.ramo;
  return catalogo.arvore.find((n) => n.id === no.requer)!.ramo;
}

/** A raiz e os 10 ramos, na ordem do catálogo, cada um com os seus nós (1 a 10 e o infinito; as pontes ficam de fora). */
export const RAMOS_ARVORE: { ramo: number; nome: string; nos: No[] }[] = RAMOS.map((nome, ramo) => ({
  ramo, nome, nos: catalogo.arvore.filter((n) => n.ramo === ramo).sort((a, b) => a.posicao - b.posicao),
}));

const nomeDe = (id: number | null) => catalogo.arvore.find((n) => n.id === id)?.nome;
/** O que falta pra um nó trancado: "Libera com Cafezinho de garrafa térmica" (a ponte: "… com A e B"). */
export function falta(no: No): string {
  const nomes = [nomeDe(no.requer), nomeDe(no.requer2)].filter((x): x is string => !!x);
  return nomes.length ? `Libera com ${nomes.join(' e ')}` : '';
}

/** Árvore em tela cheia: o mundo (em unidades) e o centro de cada nó, gerados (16/10). A raiz embaixo, no meio; os 10
 *  ramos sobem em colunas na ordem da copa (ORDEM_RAMOS, a Horta à esquerda), as do meio mais altas (o arco); o nó 10 e
 *  o infinito com folga a mais (são maiores); cada ponte no meio das duas colunas, meio passo acima dos nós 5 delas.
 *  Mudar aqui = conferir os testes de distância (legado.test.ts). */
const COLUNA = 132;
const PASSO = 76;
const MARGEM_X = 80;
const ARCO = 120;
const BASE = 190;
export const MUNDO_ARVORE = { largura: 2 * MARGEM_X + 9 * COLUNA, altura: 1200 } as const;
const colunaDe = (ramo: number) => (ORDEM_RAMOS as readonly number[]).indexOf(ramo);
const xColuna = (k: number) => MARGEM_X + k * COLUNA;
function yNo(k: number, posicao: number): number {
  const arco = Math.round(ARCO * (1 - ((k - 4.5) / 4.5) ** 2));
  return MUNDO_ARVORE.altura - BASE - arco - (posicao - 1) * PASSO - (posicao >= 10 ? 12 : 0) - (posicao === 11 ? 24 : 0);
}
function gerarPosicoes(): Readonly<Record<number, readonly [number, number]>> {
  const pos: Record<number, readonly [number, number]> = {};
  for (const n of catalogo.arvore) {
    if (n.ramo === 0) pos[n.id] = [MUNDO_ARVORE.largura / 2, MUNDO_ARVORE.altura - 60];
    else if (n.ramo === RAMO_PONTE) {
      const a = colunaDe(catalogo.arvore.find((x) => x.id === n.requer)!.ramo);
      const b = colunaDe(catalogo.arvore.find((x) => x.id === n.requer2)!.ramo);
      pos[n.id] = [(xColuna(a) + xColuna(b)) / 2, Math.round((yNo(a, 5) + yNo(b, 5)) / 2 - PASSO / 2)];
    } else pos[n.id] = [xColuna(colunaDe(n.ramo)), yNo(colunaDe(n.ramo), n.posicao)];
  }
  return pos;
}
export const POSICOES_ARVORE = gerarPosicoes();

/** O nome de cada ramo, 64 unidades acima do infinito dele, na ordem da copa. */
export const ROTULOS_ARVORE: readonly { ramo: number; nome: string; x: number; y: number }[] = (ORDEM_RAMOS as readonly number[]).map((ramo) => {
  const [x, y] = POSICOES_ARVORE[3000 + ramo];
  return { ramo, nome: RAMOS[ramo], x, y: y - 64 };
});

/** Quanto a copa cresce na tela: cabe no lado mais apertado, entre 0,8 (abaixo disso arrasta) e 1,4. A Task 10 troca
 *  pelo zoom. */
export function escalaArvore(largura: number, altura: number): number {
  const s = Math.min(largura / MUNDO_ARVORE.largura, altura / MUNDO_ARVORE.altura);
  return Math.min(1.4, Math.max(0.8, s));
}

/** A situação de um nó na tela. O infinito que você já tem segue comprável (o próximo nível). */
export type SituacaoTela = 'comprado' | 'pode' | 'falta' | 'portao' | 'trancado';
export function situacaoTela(no: No, c: ContextoArvore): SituacaoTela {
  const tem = c.arvore.includes(no.id);
  if (tem && no.cresce === null) return 'comprado';
  if (!tem) {
    if (!liberadoNo(no, c.arvore)) return 'trancado';
    if (portao(no, c) !== null) return 'portao';
  }
  return c.pontos >= precoNo(no, c) ? 'pode' : 'falta';
}

/** O nó escolhido ao abrir a árvore: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz.
 *  Empate no preço: o menor id. */
export function noInicial(c: ContextoArvore): number {
  const porPreco = [...catalogo.arvore].sort((a, b) => precoNo(a, c) - precoNo(b, c) || a.id - b.id);
  const achar = (sit: SituacaoTela) => porPreco.find((n) => situacaoTela(n, c) === sit);
  return (achar('pode') ?? achar('falta') ?? catalogo.arvore.find((n) => n.ramo === 0)!).id;
}

/** "Produção · 2 de 10", "Bolsa · infinito", "Ponte · Gente e PPP Podcast"; a raiz diz "Raiz". */
export function ondeNo(no: No): string {
  if (no.ramo === 0) return 'Raiz';
  if (no.ramo === RAMO_PONTE) {
    const r = (id: number | null) => RAMOS[catalogo.arvore.find((n) => n.id === id)!.ramo];
    return `${NOME_PONTE} · ${r(no.requer)} e ${r(no.requer2)}`;
  }
  return no.posicao === 11 ? `${RAMOS[no.ramo]} · infinito` : `${RAMOS[no.ramo]} · ${no.posicao} de 10`;
}

/** "Falta 1 ★" / "Faltam 5 ★". */
export const faltam = (n: number): string => (n === 1 ? 'Falta 1 ★' : `Faltam ${n} ★`);

/** O rótulo do nó pro leitor de tela: "Turno dobrado, faltam 5 ★"; "Hora extra infinita, nível 4, faltam 554 ★". */
export function descricaoNo(no: No, sit: SituacaoTela, c: ContextoArvore): string {
  if (sit === 'comprado') return `${no.nome}, comprado`;
  if (sit === 'trancado') return `${no.nome}, trancado`;
  if (sit === 'portao') return `${no.nome}, ${(portao(no, c) ?? '').toLowerCase()}`;
  const nivel = no.cresce !== null && c.arvore.includes(no.id) ? `, nível ${nivelNo(no, c)}` : '';
  const preco = precoNo(no, c);
  return sit === 'pode' ? `${no.nome}${nivel}, dá pra comprar por ${preco} ★` : `${no.nome}${nivel}, ${faltam(preco - c.pontos).toLowerCase()}`;
}
```

(`precoNo(3001)` com nível 4 = round(1000 · 1,6⁴) = 6554; com 6000 pontos faltam 554.)

- [ ] **Step 4: A tela usa o contexto (o mínimo; a tela nova é a Task 10)**

Em `arvoreTela.ts`:
1. No import de `./legado`, troque `descricaoNo, escalaArvore, falta, faltam, MUNDO_ARVORE, noInicial, ondeNo, pontos, POSICOES_ARVORE, ROTULOS_ARVORE, situacaoTela, type SituacaoTela,` por `contextoArvore, descricaoNo, escalaArvore, falta, faltam, MUNDO_ARVORE, noInicial, ondeNo, pontos, portao, POSICOES_ARVORE, precoNo, ROTULOS_ARVORE, situacaoTela, type SituacaoTela,`.
2. `LEGENDA`: troque `['comprado', 'Comprado'], ['pode', 'Dá pra comprar'], ['falta', 'Falta ponto'], ['trancado', 'Trancado'],` por `['comprado', 'Comprado'], ['pode', 'Dá pra comprar'], ['falta', 'Falta ponto'], ['portao', 'Tem portão'], ['trancado', 'Trancado'],`.
3. `situacoes`: troque `new Map(catalogo.arvore.map((n) => [n.id, situacaoTela(n, s.bonus.arvore, s.pontos)] as const));` por `new Map(catalogo.arvore.map((n) => [n.id, situacaoTela(n, contextoArvore(s))] as const));`.
4. Em `ligacoes`, troque o corpo do `for` por:

```ts
  for (const n of catalogo.arvore) {
    for (const r of [n.requer, n.requer2]) {
      if (r === null) continue;
      const [x1, y1] = POSICOES_ARVORE[r];
      const [x2, y2] = POSICOES_ARVORE[n.id];
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', String(x1 * k));
      l.setAttribute('y1', String(y1 * k));
      l.setAttribute('x2', String(x2 * k));
      l.setAttribute('y2', String(y2 * k));
      l.setAttribute('class', `ligacao ${sits.get(n.id)}`);
      svg.append(l);
    }
  }
```

5. Em `desenharCartao`, troque o bloco `if (sit === 'comprado') … else { const b = button(…); … }` por:

```ts
    const c = contextoArvore(s);
    if (sit === 'comprado') acao.append(el('span', 'no-feito', 'Comprado'));
    else if (sit === 'trancado') acao.append(el('span', 'sub', falta(n)));
    else if (sit === 'portao') acao.append(el('span', 'sub', portao(n, c) ?? ''));
    else {
      const preco = precoNo(n, c);
      const b = button(sit === 'pode' ? `Comprar · ${preco} ★` : faltam(preco - s.pontos), 'btn main', () => comprar(n.id));
      b.disabled = sit !== 'pode' || ocupado;
      acao.append(b);
    }
```

6. Em `desenhar`, troque `b.setAttribute('aria-label', descricaoNo(n, sit, s.pontos));` por `b.setAttribute('aria-label', descricaoNo(n, sit, contextoArvore(s)));` e `if (sit === 'pode' || sit === 'falta') b.append(el('span', 'no-custo', \`${n.custo} ★\`));` por `if (sit === 'pode' || sit === 'falta') b.append(el('span', 'no-custo', \`${precoNo(n, contextoArvore(s))} ★\`));`.
7. Em `abrir`, troque `escolhido = noInicial(s.bonus.arvore, s.pontos);` por `escolhido = noInicial(contextoArvore(s));`.

Em `tela.ts`: no import de `./legado` (l. 20), acrescente `contextoArvore`; troque a l. 597 por `const podem = catalogo.arvore.filter((n) => situacaoTela(n, contextoArvore(s)) === 'pode').length;`.

- [ ] **Step 5: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/legado.test.ts idle/arvoreTela.test.ts idle/tela.test.ts`
Expected: PASS (o quadro do Legado da `tela.test.ts` diz "2 de 120 comprados · 5 dá pra comprar agora": a Bolsa 1, o PPP 1 e o Mapa 1 têm portão de era).

- [ ] **Step 6: Commit**

```bash
git add games/idle/legado.ts games/idle/legado.test.ts games/shared/types.ts games/idle/arvoreTela.ts games/idle/arvoreTela.test.ts games/idle/tela.ts
git commit -m "Fellas Inc.: a copa gerada com os 120 nós e o que a página sabe de cada um (nível, preço, portão)"
```

---
### Task 3: O banco da árvore grande: maior era, níveis, a compra com portões e os efeitos (0082, parte A)

**Files:**
- Create: `supabase/migrations/0082_fellas_inc_arvore_grande.sql` (cabeçalho + parte A)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (0082)
- Modify: `games/idle/economia.ts` (`Bonus` l. 12–13, `EfeitosArvore`/`efeitosArvore`/`efeitosDe` l. 53–96), `games/idle/economia.test.ts`
- Modify: `games/shared/errors.ts` (`idle_gate`), `games/idle/main.ts:44-47` (`RECARREGA`)
- Create: `games/test/idleArvoreGrande.test.ts`
- Modify: `games/test/idleParidade.test.ts` (`arvore()` l. 40–43, `nosAoAcaso` l. 45, o teste da l. 169–183, o da l. 294–309)

**Interfaces:**
- Consumes: catálogo com `requer2`/`req_vendas`/`req_era`/`cresce` (0081, Task 1); `IdleState.era_max`/`bonus.niveis` (Task 2).
- Produces: `idle_state.era_max int not null default 1` (sobe em todo `idle_save`, nunca desce), `idle_state.info_gratis_dia date` / `info_gratis_n int` (usados na Task 7), `idle_arvore.nivel int not null default 1`; `idle_arv` conta o nível (`mult`: `exp(Σ nível·ln valor)`, `soma`: `Σ valor·nível`); `idle_buy_node` com `requer2`, portões (`idle_gate`) e infinitos (sobe o nível, preço `round(custo · cresce^nível)`); `idle_json` com `bonus.niveis` (`{"3001": 4}`, só infinitos) e `era_max`; `idle_arvore_efeitos` com as 54 chaves. Em `economia.ts`: `Bonus.niveis?`, `efeitosArvore(cat, nos, niveis = {})` com os 32 campos novos (nomes abaixo), `efeitosDe` passando `s.bonus?.niveis`.

- [ ] **Step 1: Testes da página (falham)**

Em `games/idle/economia.test.ts`, no fim do arquivo:

```ts
describe('efeitos da árvore grande (nível e campos novos; igual a idle_arvore_efeitos na 0082)', () => {
  it('sem nó: o jogo de sempre nos campos novos', () => {
    expect(efeitosArvore(cat, [])).toMatchObject({
      producaoSoma: 1, inicioEras: 0, inicioMult: 1, oppFs: 1, contratoDesconto: 0, hortaSoma: 1, bolsaCorretagem: 1, bolsaLimite: 0,
      bolsaLimiteMult: 1, bolsaLimiteSoma: 1, bolsaEspiadas: 0, bolsaEscritorio: 1, convRecarga: 1, convTrocas: 0, convCadeira2: 0.5,
      convCadeira3: 0.25, convQueda: 0.25, convEfeito: 0, mapaAbrir: 1, mapaNivel: 1, marcosMult: 1, marcosSoma: 1, teePublico: 1,
      teeTempo: 1, copaoMult: 1, lixoMin: 10, silverMin: 2, silverMult: 4, legadoMult: 1, espaco: 1, eraFreq: 1, eraJanela: 1,
    });
  });
  it('soma, maior, menor e o nível do infinito (valor × nível; no mult, valor^nível)', () => {
    const e = efeitosArvore(cat, [106, 107, 2001, 3001, 3002, 3004, 701, 705, 1004, 1008], { 3001: 4, 3002: 2, 3004: 10 });
    expect(e.producaoSoma).toBeCloseTo(1 + 0.2 + 0.3 + 0.15 + 0.05 * 4, 12);
    expect(e.inicioMult).toBeCloseTo(100, 9);
    expect(e.douradoInvestidor).toBeCloseTo(1.02 ** 10, 12);
    expect(e.bolsaCorretagem).toBe(0.5);
    expect(e.espaco).toBeCloseTo(1.75, 12);
  });
  it('resposta velha (sem niveis): infinito no nível 1; nível 0 ou lixo vira 1', () => {
    expect(efeitosArvore(cat, [3001]).producaoSoma).toBeCloseTo(1.05, 12);
    expect(efeitosArvore(cat, [3001], { 3001: 0 }).producaoSoma).toBeCloseTo(1.05, 12);
    expect(efeitosDe(cat, { generators: [], upgrades: [], strategies: [], bonus: { arvore: [3001], conquistas: 0, niveis: { 3001: 3 } } }).producaoSoma)
      .toBeCloseTo(1.15, 12);
  });
});
```

(Acrescente `efeitosDe` no import de `./economia` se faltar.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts`
Expected: FAIL (campos novos não existem).

- [ ] **Step 2: A conta da página (`economia.ts`)**

Troque `export type Bonus = { arvore: number[]; conquistas: number };` por:

```ts
export type Bonus = { arvore: number[]; conquistas: number; /** nível dos infinitos (0082); ausente = 1 */ niveis?: Readonly<Record<string, number>> };
```

Troque o comentário, o tipo `EfeitosArvore`, `porNo`, `efeitosArvore` e `efeitosDe` (l. 53–96) por:

```ts
/** O que os nós comprados fazem (igual a idle_arvore_efeitos na 0082). Sem nó: o jogo de sempre. Juntando nós do mesmo
 *  tipo: produção, Investidor, bônus das oportunidades e o ×F$ do Recomeço multiplicam (o infinito conta valor^nível);
 *  os de soma somam valor × nível (os "1 + Σ" e os que somam direto, ver nomes.ts TipoNo); preço do contrato,
 *  amadurecer, corretagem, derrubada, abrir/subir lugar e tempo da Camisetaria ficam o menor; o resto fica o maior. */
export type EfeitosArvore = {
  producao: number; caixinha: number; oppSegundos: number; oppExtra: number; oppBonus: number;
  contratoPreco: number; porContratado: number; contratoDias: number; empregoMult: number;
  inicioValuation: number; inicioNotebooks: number; inicioEra1: boolean; manterGerais: boolean;
  douradoFreq: number; douradoTela: number; douradoInvestidor: number; douradoDuracao: number;
  hortaAmadurece: number; hortaVida: number; hortaCruza: number; hortaMult: number; morangoChance: number;
  // árvore grande (16/10, 0082)
  producaoSoma: number; inicioEras: number; inicioMult: number; oppFs: number; contratoDesconto: number; hortaSoma: number;
  bolsaCorretagem: number; bolsaLimite: number; bolsaLimiteMult: number; bolsaLimiteSoma: number; bolsaEspiadas: number; bolsaEscritorio: number;
  convRecarga: number; convTrocas: number; convCadeira2: number; convCadeira3: number; convQueda: number; convEfeito: number;
  mapaAbrir: number; mapaNivel: number; marcosMult: number; marcosSoma: number; teePublico: number; teeTempo: number; copaoMult: number;
  lixoMin: number; silverMin: number; silverMult: number; legadoMult: number; espaco: number; eraFreq: number; eraJanela: number;
};
const porNo = new WeakMap<Catalogo, Map<number, No>>();
export function efeitosArvore(cat: Catalogo, nos: readonly number[], niveis: Readonly<Record<string, number>> = {}): EfeitosArvore {
  let mapa = porNo.get(cat);
  if (!mapa) porNo.set(cat, (mapa = new Map(cat.arvore.map((n) => [n.id, n]))));
  // uma passada só, agrupando por tipo (a simulação chama isto em toda conta de taxa); nó repetido não conta duas vezes
  const porTipo = new Map<No['tipo'], No[]>();
  for (const id of new Set(nos)) {
    const n = mapa.get(id);
    if (!n) continue;
    const l = porTipo.get(n.tipo);
    if (l) l.push(n);
    else porTipo.set(n.tipo, [n]);
  }
  const comprados = (tipo: No['tipo']): readonly No[] => porTipo.get(tipo) ?? [];
  // o nível conta só no infinito; o que faltar (resposta velha) ou vier abaixo de 1 vale 1, como no banco
  const nivel = (n: No) => (n.cresce === null ? 1 : Math.max(1, niveis[String(n.id)] ?? 1));
  const valores = (tipo: No['tipo']) => comprados(tipo).map((n) => n.valor);
  const mult = (tipo: No['tipo']) => comprados(tipo).reduce((a, n) => a * n.valor ** nivel(n), 1);
  const soma = (tipo: No['tipo']) => comprados(tipo).reduce((a, n) => a + n.valor * nivel(n), 0);
  const max = (tipo: No['tipo'], padrao: number) => Math.max(padrao, ...valores(tipo));
  const min = (tipo: No['tipo'], padrao: number) => Math.min(padrao, ...valores(tipo));
  return {
    producao: mult('producao'),
    caixinha: max('caixinha', CAIXA_PADRAO.tamanho),
    oppSegundos: max('segundos', OPP_SEGUNDOS_PADRAO),
    oppExtra: soma('opp_extra'),
    oppBonus: mult('opp_bonus'),
    contratoPreco: min('contrato_preco', 1),
    porContratado: max('por_contratado', POR_CONTRATADO),
    contratoDias: max('contrato_dias', 7),
    empregoMult: max('emprego_mult', 1),
    inicioValuation: max('inicio_valuation', VALUATION_INICIAL),
    inicioNotebooks: max('inicio_notebooks', 1),
    inicioEra1: valores('inicio_era1').length > 0,
    manterGerais: valores('manter_gerais').length > 0,
    douradoFreq: max('dourado_freq', 1),
    douradoTela: max('dourado_tela', JANELA_DOURADO_S),
    douradoInvestidor: mult('dourado_investidor'),
    douradoDuracao: max('dourado_duracao', 1),
    hortaAmadurece: min('horta_amadurece', 1),
    hortaVida: max('horta_vida', 1),
    hortaCruza: max('horta_cruza', 1),
    hortaMult: max('horta_mult', 1),
    morangoChance: max('morango_chance', 1),
    producaoSoma: 1 + soma('producao_soma'),
    inicioEras: max('inicio_eras', 0),
    inicioMult: mult('inicio_mult'),
    oppFs: 1 + soma('opp_fs'),
    contratoDesconto: soma('contrato_desconto'),
    hortaSoma: 1 + soma('horta_soma'),
    bolsaCorretagem: min('bolsa_corretagem', 1),
    bolsaLimite: soma('bolsa_limite'),
    bolsaLimiteMult: max('bolsa_limite_mult', 1),
    bolsaLimiteSoma: 1 + soma('bolsa_limite_soma'),
    bolsaEspiadas: soma('bolsa_espiadas'),
    bolsaEscritorio: max('bolsa_escritorio', 1),
    convRecarga: max('conv_recarga', 1),
    convTrocas: soma('conv_trocas'),
    convCadeira2: max('conv_cadeira2', 0.5),
    convCadeira3: max('conv_cadeira3', 0.25),
    convQueda: min('conv_queda', 0.25),
    convEfeito: soma('conv_efeito'),
    mapaAbrir: min('mapa_abrir', 1),
    mapaNivel: min('mapa_nivel', 1),
    marcosMult: max('marcos_mult', 1),
    marcosSoma: 1 + soma('marcos_soma'),
    teePublico: max('tee_publico', 1),
    teeTempo: min('tee_tempo', 1),
    copaoMult: max('copao_mult', 1),
    lixoMin: max('lixo_min', 10),
    silverMin: max('silver_min', 2),
    silverMult: max('silver_mult', 4),
    legadoMult: max('legado_mult', 1),
    espaco: 1 + soma('espaco_soma'),
    eraFreq: max('era_freq', 1),
    eraJanela: max('era_janela', 1),
  };
}
export const efeitosDe = (cat: Catalogo, s: Estado) => efeitosArvore(cat, s.bonus?.arvore ?? [], s.bonus?.niveis);
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts`
Expected: PASS.

- [ ] **Step 3: Testes do banco (falham)**

Crie `games/test/idleArvoreGrande.test.ts`:

```ts
// Árvore grande (0082): a compra (ponte com dois pedidos, portões, infinitos), a maior era e a paridade dos efeitos
// com o nível; as partes B–E (produção e minigames) acrescentam os describes delas no fim.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { efeitosArvore } from '../idle/economia';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const M0082 = readFileSync(resolve(__dirname, '../../supabase/migrations/0082_fellas_inc_arvore_grande.sql'), 'utf8');
type J = {
  valuation: number; rate: number; generators: number[]; pontos: number; pontos_vida: number; vendas: number; era: number; era_max?: number;
  bonus: { arvore: number[]; conquistas: number; niveis?: Record<string, number> };
};
const comprar = (no: number) => t.rpc<J>('idle_buy_node', { p_no: no });
/** pontos ganhos na vida, gastos e vendas de A */
const pontos = (ganhos: number, gastos = 0, vendas = 0) =>
  q('update public.idle_state set prestige_earned = $2, prestige_spent = $3, prestige_count = $4 where user_id = $1', [A, ganhos, gastos, vendas]);
/** Põe os nós direto (sem pagar); `niveis` = o nível de algum infinito. */
async function ter(nos: number[], niveis: Record<number, number> = {}) {
  for (const n of nos) {
    await q('insert into public.idle_arvore (user_id, no_id, nivel) values ($1, $2, $3) on conflict (user_id, no_id) do update set nivel = excluded.nivel',
      [A, n, niveis[n] ?? 1]);
  }
}
const gasto = async () => (await q<{ g: number }>('select prestige_spent as g from public.idle_state where user_id = $1', [A]))[0].g;
const PRODUCAO_1_5 = [1, 11, 12, 13, 14, 15];

describe('comprar nós da árvore grande (0082 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
  });
  it('a ponte pede o nó 5 dos dois ramos: com um só, idle_locked; com os dois, compra', async () => {
    await pontos(1e6, 0, 5);
    await ter([1, 11, 12, 13, 14, 21, 22, 23, 24, 25]);
    await expect(comprar(2005)).rejects.toThrow(/idle_locked/); // falta o 15
    await ter([15]);
    const s = await comprar(2005);
    expect(s.bonus.arvore).toContain(2005);
    expect(await gasto()).toBe(1500);
  });
  it('portões: cada motivo recusa com idle_gate sem gastar nada; passou, compra', async () => {
    await pontos(1e6, 0, 2);
    await ter(PRODUCAO_1_5);
    await expect(comprar(106)).rejects.toThrow(/idle_gate/); // 3 vendas
    expect(await gasto()).toBe(0);
    await pontos(1e6, 0, 3);
    await comprar(106);
    await comprar(107);
    await q('update public.idle_state set era_max = 6 where user_id = $1', [A]);
    await expect(comprar(108)).rejects.toThrow(/idle_gate/); // era 7
    await q('update public.idle_state set era_max = 7 where user_id = $1', [A]);
    expect((await comprar(108)).bonus.arvore).toContain(108);
    await q('update public.idle_state set era_max = 3 where user_id = $1', [A]);
    await expect(comprar(701)).rejects.toThrow(/idle_gate/); // a Bolsa abre na era 4
    await expect(comprar(1001)).rejects.toThrow(/idle_gate/); // o Espaço, na 6
    expect((await comprar(801)).bonus.arvore).toContain(801); // o PPP abre na era 3
  });
  it('a era de agora conta mesmo antes de gravar a maior (comprou o gerador 37 e já vai no nó)', async () => {
    await pontos(1e6, 0, 3);
    await ter([...PRODUCAO_1_5, 106, 107]);
    await q('update public.idle_state set era_max = 1, generators[37] = 1 where user_id = $1', [A]);
    expect((await comprar(108)).bonus.arvore).toContain(108);
  });
  it('infinito: nível 1 por 1.000, o 2 por 1.600, o 3 por 2.560; os níveis no JSON; o fixo comprado de novo é idle_node_owned', async () => {
    await pontos(10_000, 0, 10);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109, 110]);
    let s = await comprar(3001);
    expect(s.pontos).toBe(9000);
    expect(s.bonus.niveis).toEqual({ 3001: 1 });
    s = await comprar(3001);
    expect(s.pontos).toBe(7400);
    s = await comprar(3001);
    expect(s.pontos).toBe(4840);
    expect(s.bonus.niveis).toEqual({ 3001: 3 });
    expect(s.bonus.arvore.filter((x) => x === 3001)).toHaveLength(1);
    await expect(comprar(110)).rejects.toThrow(/idle_node_owned/);
  });
  it('infinito sem ponto pro próximo nível: idle_points_low e o nível fica', async () => {
    await pontos(2000, 0, 10);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109, 110]);
    await comprar(3001);
    await expect(comprar(3001)).rejects.toThrow(/idle_points_low/); // 1.600 com 1.000 livres
    expect((await q<{ n: number }>('select nivel as n from public.idle_arvore where user_id = $1 and no_id = 3001', [A]))[0].n).toBe(1);
  });
  it('nível alto: com 1e9 pontos o nível 30 compra e o 31 recusa; nível 100 recusa sem estourar', async () => {
    await pontos(1e9, 0, 10);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109, 110, 3001], { 3001: 29 });
    const preco30 = Math.round(1000 * 1.6 ** 29);
    expect((await comprar(3001)).pontos).toBe(1e9 - preco30);
    await expect(comprar(3001)).rejects.toThrow(/idle_points_low/);
    await ter([3001], { 3001: 100 });
    await expect(comprar(3001)).rejects.toThrow(/idle_points_low/);
  });
  it('o infinito pede 10 vendas e o nó 10 do ramo', async () => {
    await pontos(1e6, 0, 9);
    await ter([...PRODUCAO_1_5, 106, 107, 108, 109]);
    await expect(comprar(3001)).rejects.toThrow(/idle_locked/);
    await ter([110]);
    await expect(comprar(3001)).rejects.toThrow(/idle_gate/);
  });
});

describe('a maior era (0082 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
  });
  it('toda gravação guarda a maior era; vender não zera; o nó de era 7 compra com a empresa nova', async () => {
    await q(`update public.idle_state set generators[1:37] = array_fill(1, array[37]), strategies = '{0,0,0,0,0,0}', valuation = 0
              where user_id = $1`, [A]);
    expect((await t.rpc<J>('idle_open')).era_max).toBe(7);
    const v = await t.rpc<J>('idle_prestige');
    expect(v).toMatchObject({ era_max: 7, vendas: 1 });
    const [l] = await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]);
    expect(l.e).toBe(7);
    await pontos(1e6, 0, 3);
    await ter([...PRODUCAO_1_5, 106, 107]);
    expect((await comprar(108)).bonus.arvore).toContain(108); // empresa fechada, era de agora 1
    await t.rpc('idle_start');
    expect((await t.rpc<J>('idle_open')).era_max).toBe(7);
  });
  it('o backfill da 0082: a era de agora, ou a das conquistas de era de quem já vendeu (rodar de novo não baixa)', async () => {
    await q('update public.idle_state set era_max = 1, generators = array_fill(0, array[42]) where user_id = $1', [A]);
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 41)', [A]); // "Andar inteiro" = era 4
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(4);
    await q('update public.idle_state set generators[31] = 1 where user_id = $1', [A]); // era 6 sem gravar
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(6);
    await q('update public.idle_state set generators = array_fill(0, array[42]) where user_id = $1', [A]);
    await t.db.exec(M0082);
    expect((await q<{ e: number }>('select era_max as e from public.idle_state where user_id = $1', [A]))[0].e).toBe(6);
  });
});

// gerador pseudoaleatório fixo: os mesmos casos toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
const rel = (a: number, b: number) => Math.abs(a - b) / Math.max(1, Math.abs(b));

describe('paridade dos efeitos com níveis (0082 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('cada nó sozinho (o infinito no nível 1 e no 7) e 30 pedaços ao acaso com níveis: banco = economia.ts', async () => {
    const r = rng(16);
    const casos: [number[], Record<number, number>][] = [[[], {}]];
    for (const n of catalogo.arvore) {
      casos.push([[n.id], {}]);
      if (n.cresce !== null) casos.push([[n.id], { [n.id]: 7 }]);
    }
    for (let i = 0; i < 30; i++) {
      const nos = catalogo.arvore.filter(() => r() < 0.4).map((n) => n.id);
      const niveis = Object.fromEntries(nos.filter((id) => id > 3000).map((id) => [id, 1 + Math.floor(r() * 25)]));
      casos.push([nos, niveis]);
    }
    for (const [nos, niveis] of casos) {
      await q('delete from public.idle_arvore where user_id = $1', [A]);
      await ter(nos, niveis);
      const [{ e }] = await q<{ e: Record<string, number | boolean> }>('select public.idle_arvore_efeitos($1) as e', [A]);
      const ts = efeitosArvore(catalogo, nos, niveis);
      expect(Object.keys(e).sort(), String(nos)).toEqual(Object.keys(ts).sort());
      for (const [k, v] of Object.entries(ts)) {
        if (typeof v === 'boolean') expect(e[k], `${nos} ${k}`).toBe(v);
        else expect(rel(e[k] as number, v), `${nos} ${JSON.stringify(niveis)} ${k}`).toBeLessThan(1e-12);
      }
    }
  });
});
```

Em `games/test/idleParidade.test.ts`, troque a l. 296–306 do teste `'o estado devolve o bônus que a conta usa'`: `expect(db.b).toEqual(bonus);` → `expect(db.b).toEqual({ ...bonus, niveis: {} }); // só os infinitos têm nível no JSON (0082)`.

Em `games/test/db.ts`, acrescente `'0082_fellas_inc_arvore_grande.sql',` depois da 0081; em `games/dev/mockDb.ts`, `import m82 from '../../supabase/migrations/0082_fellas_inc_arvore_grande.sql?raw';` e `m82` no fim do `for`. Crie `supabase/migrations/0082_fellas_inc_arvore_grande.sql` vazio (o Step 4 escreve).

Run: `cd games && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleParidade.test.ts`
Expected: FAIL (`era_max`, `nivel`, `idle_gate`, chaves novas).

- [ ] **Step 4: 0082, parte A**

Escreva em `supabase/migrations/0082_fellas_inc_arvore_grande.sql`:

```sql
-- fellasapp: Fellas Inc., a árvore grande (16/10, entrega 6 antecipada). A árvore passa de 31 pra 120 nós (catálogo na
-- 0081, gerada): os nós 6–10 dos ramos de hoje, Bolsa, PPP, Mapa e Espaço, 9 pontes e 10 infinitos. Aqui: a maior era
-- alcançada (não zera na venda), o nível dos infinitos, a compra com portões e a ponte de dois pedidos (parte A); a soma
-- de produção, o Espaço e o legado na conta (parte B); Recomeço, Oportunidades, Gente e Horta (parte C); Bolsa e PPP
-- (parte D); Mapa, Camisetaria, Copão e os eventos do Espaço (parte E). As contas são as de games/idle/economia.ts e
-- dos minigames (paridade em games/test/idleArvoreGrande.test.ts). Spec:
-- docs/superpowers/specs/2026-10-15-fellas-inc-arvore-grande-design.md. Idempotente.

-- ===== parte A: a maior era, o nível dos infinitos, a compra e os efeitos =====
alter table public.idle_state add column if not exists era_max int not null default 1;
-- espiada grátis da Bolsa (parte D): o dia de Brasília e quantas já usou nele (a venda não zera, como o Tigrinho do dia)
alter table public.idle_state add column if not exists info_gratis_dia date, add column if not exists info_gratis_n int not null default 0;
alter table public.idle_arvore add column if not exists nivel int not null default 1;
alter table public.idle_arvore drop constraint if exists idle_arvore_nivel_check;
alter table public.idle_arvore add constraint idle_arvore_nivel_check check (nivel >= 1);

-- backfill: a era de agora, ou a das conquistas de era de quem já vendeu (39–42 = eras 2–5; 43, o 1º Foguete = 5);
-- nunca baixa
with alvo as (
  select s.user_id,
         greatest(public.idle_era(s.generators),
                  coalesce(max(case c.conquista_id when 39 then 2 when 40 then 3 when 41 then 4 else 5 end), 1)) as e
    from public.idle_state s
    left join public.idle_conquistas c on c.user_id = s.user_id and c.conquista_id in (39, 40, 41, 42, 43)
   group by s.user_id, s.generators
)
update public.idle_state s set era_max = a.e from alvo a where a.user_id = s.user_id and s.era_max < a.e;

-- o valor dos nós de um tipo (a da 0041) contando o nível: no 'mult', valor^nível; na soma, valor × nível; 'max' e
-- 'min' não olham o nível (os infinitos são de mult ou de soma). Igual a economia.ts efeitosArvore.
create or replace function public.idle_arv(u uuid, p_tipo text, p_agg text, p_padrao double precision)
returns double precision language sql stable set search_path = public as $$
  select case p_agg
           when 'mult' then coalesce(exp(sum(a.nivel * ln(c.valor))), p_padrao)
           when 'max' then greatest(p_padrao, max(c.valor))
           when 'min' then least(p_padrao, min(c.valor))
           else coalesce(sum(c.valor * a.nivel), p_padrao)
         end
    from public.idle_arvore a
    join public.idle_cat_no c on c.id = a.no_id
   where a.user_id = u and c.tipo = p_tipo
$$;
revoke all on function public.idle_arv(uuid, text, text, double precision) from public, anon, authenticated;

-- tudo que a árvore de alguém faz (a da 0061 + os tipos da árvore grande), com os nomes de economia.ts efeitosArvore
-- (paridade). Dois objetos: um jsonb_build_object aceita no máximo 100 argumentos.
create or replace function public.idle_arvore_efeitos(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'producao', public.idle_arv(u, 'producao', 'mult', 1),
    'caixinha', public.idle_arv(u, 'caixinha', 'max', 3),
    'oppSegundos', public.idle_arv(u, 'segundos', 'max', 10),
    'oppExtra', public.idle_arv(u, 'opp_extra', 'soma', 0),
    'oppBonus', public.idle_arv(u, 'opp_bonus', 'mult', 1),
    'contratoPreco', public.idle_arv(u, 'contrato_preco', 'min', 1),
    'porContratado', public.idle_arv(u, 'por_contratado', 'max', 0.1),
    'contratoDias', public.idle_arv(u, 'contrato_dias', 'max', 7),
    'empregoMult', public.idle_arv(u, 'emprego_mult', 'max', 1),
    'inicioValuation', public.idle_arv(u, 'inicio_valuation', 'max', 10),
    'inicioNotebooks', public.idle_arv(u, 'inicio_notebooks', 'max', 1),
    'inicioEra1', public.idle_arv(u, 'inicio_era1', 'max', 0) > 0,
    'manterGerais', public.idle_arv(u, 'manter_gerais', 'max', 0) > 0,
    'douradoFreq', public.idle_arv(u, 'dourado_freq', 'max', 1),
    'douradoTela', public.idle_arv(u, 'dourado_tela', 'max', 12),
    'douradoInvestidor', public.idle_arv(u, 'dourado_investidor', 'mult', 1),
    'douradoDuracao', public.idle_arv(u, 'dourado_duracao', 'max', 1),
    'hortaAmadurece', public.idle_arv(u, 'horta_amadurece', 'min', 1),
    'hortaVida', public.idle_arv(u, 'horta_vida', 'max', 1),
    'hortaCruza', public.idle_arv(u, 'horta_cruza', 'max', 1),
    'hortaMult', public.idle_arv(u, 'horta_mult', 'max', 1),
    'morangoChance', public.idle_arv(u, 'morango_chance', 'max', 1))
  || jsonb_build_object(
    'producaoSoma', 1 + public.idle_arv(u, 'producao_soma', 'soma', 0),
    'inicioEras', public.idle_arv(u, 'inicio_eras', 'max', 0),
    'inicioMult', public.idle_arv(u, 'inicio_mult', 'mult', 1),
    'oppFs', 1 + public.idle_arv(u, 'opp_fs', 'soma', 0),
    'contratoDesconto', public.idle_arv(u, 'contrato_desconto', 'soma', 0),
    'hortaSoma', 1 + public.idle_arv(u, 'horta_soma', 'soma', 0),
    'bolsaCorretagem', public.idle_arv(u, 'bolsa_corretagem', 'min', 1),
    'bolsaLimite', public.idle_arv(u, 'bolsa_limite', 'soma', 0),
    'bolsaLimiteMult', public.idle_arv(u, 'bolsa_limite_mult', 'max', 1),
    'bolsaLimiteSoma', 1 + public.idle_arv(u, 'bolsa_limite_soma', 'soma', 0),
    'bolsaEspiadas', public.idle_arv(u, 'bolsa_espiadas', 'soma', 0),
    'bolsaEscritorio', public.idle_arv(u, 'bolsa_escritorio', 'max', 1),
    'convRecarga', public.idle_arv(u, 'conv_recarga', 'max', 1),
    'convTrocas', public.idle_arv(u, 'conv_trocas', 'soma', 0),
    'convCadeira2', public.idle_arv(u, 'conv_cadeira2', 'max', 0.5),
    'convCadeira3', public.idle_arv(u, 'conv_cadeira3', 'max', 0.25),
    'convQueda', public.idle_arv(u, 'conv_queda', 'min', 0.25),
    'convEfeito', public.idle_arv(u, 'conv_efeito', 'soma', 0),
    'mapaAbrir', public.idle_arv(u, 'mapa_abrir', 'min', 1),
    'mapaNivel', public.idle_arv(u, 'mapa_nivel', 'min', 1),
    'marcosMult', public.idle_arv(u, 'marcos_mult', 'max', 1),
    'marcosSoma', 1 + public.idle_arv(u, 'marcos_soma', 'soma', 0),
    'teePublico', public.idle_arv(u, 'tee_publico', 'max', 1),
    'teeTempo', public.idle_arv(u, 'tee_tempo', 'min', 1),
    'copaoMult', public.idle_arv(u, 'copao_mult', 'max', 1),
    'lixoMin', public.idle_arv(u, 'lixo_min', 'max', 10),
    'silverMin', public.idle_arv(u, 'silver_min', 'max', 2),
    'silverMult', public.idle_arv(u, 'silver_mult', 'max', 4),
    'legadoMult', public.idle_arv(u, 'legado_mult', 'max', 1),
    'espaco', 1 + public.idle_arv(u, 'espaco_soma', 'soma', 0),
    'eraFreq', public.idle_arv(u, 'era_freq', 'max', 1),
    'eraJanela', public.idle_arv(u, 'era_janela', 'max', 1))
$$;
revoke all on function public.idle_arvore_efeitos(uuid) from public, anon, authenticated;

-- comprar um nó (o da 0041) com a árvore grande: o que ele pede (o anterior do ramo e, na ponte, o 2º nó 5), os
-- portões (idle_gate: vendas da startup e a maior era alcançada, a de agora contando), os pontos livres e sem repetir;
-- o infinito que você já tem sobe um nível pelo preço round(custo · cresce^nível de agora) (a conta é em double e só
-- vira inteiro depois de caber nos pontos: nível 100 não estoura). Fecha a conta antes. Dá pra comprar com a empresa
-- fechada.
create or replace function public.idle_buy_node(p_no int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  n       public.idle_cat_no;
  v_nivel int;
  v_preco double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  select * into n from public.idle_cat_no where id = p_no;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  select a.nivel into v_nivel from public.idle_arvore a where a.user_id = s.user_id and a.no_id = p_no;
  if v_nivel is not null and n.cresce is null then
    raise exception 'idle_node_owned' using errcode = 'P0001';
  end if;
  if (n.requer is not null
      and not exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = n.requer))
     or (n.requer2 is not null
      and not exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = n.requer2)) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if (n.req_vendas is not null and s.prestige_count < n.req_vendas)
     or (n.req_era is not null and greatest(s.era_max, public.idle_era(s.generators)) < n.req_era) then
    raise exception 'idle_gate' using errcode = 'P0001';
  end if;
  v_preco := case when n.cresce is null then n.custo
                  else round(n.custo * power(n.cresce, coalesce(v_nivel, 0)::double precision)) end;
  if v_preco > s.prestige_earned - s.prestige_spent then
    raise exception 'idle_points_low' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende sem o nó
  insert into public.idle_arvore (user_id, no_id) values (s.user_id, p_no)
  on conflict (user_id, no_id) do update set nivel = public.idle_arvore.nivel + 1, comprado_em = now();
  s.prestige_spent := s.prestige_spent + v_preco::int;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;
revoke all on function public.idle_buy_node(int) from public, anon;
grant execute on function public.idle_buy_node(int) to authenticated;
```

Depois, copie `idle_save` da 0078 (l. 254–287, o comentário, a função e o `revoke`) e mude:
- o comentário: `-- gravar o estado (o da 0078) com a maior era (nunca baixa) e a espiada grátis do dia (0082)`
- a linha `         settled_at = s.settled_at, updated_at = now(),` vira:

```sql
         era_max = greatest(era_max, coalesce(s.era_max, 1), public.idle_era(s.generators)),
         info_gratis_dia = s.info_gratis_dia, info_gratis_n = greatest(coalesce(s.info_gratis_n, 0), 0),
         settled_at = s.settled_at, updated_at = now(),
```

Copie `idle_json` da 0078 (l. 361–442) e mude:
- o comentário: `-- o estado que toda função devolve (o da 0078) + o nível dos infinitos (no bonus) e a maior era (no 2º objeto) (0082)`
- a linha `      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)),` (a do `bonus`) vira:

```sql
      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id),
      'niveis', coalesce((select jsonb_object_agg(a.no_id::text, a.nivel)
                            from public.idle_arvore a join public.idle_cat_no c on c.id = a.no_id
                           where a.user_id = s.user_id and c.cresce is not null), '{}'::jsonb)),
```

- a última linha `    'silver_ate', case when s.silver_ate > now() then s.silver_ate end);` vira:

```sql
    'silver_ate', case when s.silver_ate > now() then s.silver_ate end,
    'era_max', greatest(s.era_max, public.idle_era(s.generators)));
```

- [ ] **Step 5: O erro novo na página**

Em `games/shared/errors.ts`: no tipo, troque `| 'idle_prestige_low' | 'idle_points_low' | 'idle_node_owned'` por `| 'idle_prestige_low' | 'idle_points_low' | 'idle_node_owned' | 'idle_gate'`; nas mensagens, depois de `idle_node_owned: 'Você já tem esse nó',` acrescente `idle_gate: 'Esse nó ainda tem portão: o cartão diz o que falta',`; na lista, troque `'idle_prestige_low', 'idle_points_low', 'idle_node_owned',` por `'idle_prestige_low', 'idle_points_low', 'idle_node_owned', 'idle_gate',`. Em `games/idle/main.ts`, `RECARREGA`: troque `'idle_node_owned', 'idle_dourado_pego', 'idle_chamar_vazio',` por `'idle_node_owned', 'idle_gate', 'idle_dourado_pego', 'idle_chamar_vazio',`.

- [ ] **Step 6: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleArvore.test.ts test/idleParidade.test.ts test/idlePrestigio.test.ts test/idle.test.ts test/idleEras67.test.ts test/idleDesempenho.test.ts idle/economia.test.ts`
Expected: PASS. Se algum teste antigo comparar o `idle_json` inteiro com `toEqual` e reclamar de `era_max` ou `niveis`, acrescente o campo no esperado (é dado novo, não mudança de conta).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0082_fellas_inc_arvore_grande.sql games/test/db.ts games/dev/mockDb.ts games/test/idleArvoreGrande.test.ts games/test/idleParidade.test.ts games/idle/economia.ts games/idle/economia.test.ts games/shared/errors.ts games/idle/main.ts
git commit -m "Fellas Inc.: árvore grande no banco: maior era, níveis dos infinitos, portões e a ponte na compra, efeitos com nível (0082, parte A)"
```

---
### Task 4: A conta da produção: a soma, o Espaço nas eras 6+ e o legado (0082, parte B)

**Files:**
- Modify: `games/idle/economia.ts` (`multLegado` l. 41–48, `multBonus` l. 98–101, `fatores` l. 170–196), `games/idle/economia.test.ts`
- Modify: `supabase/migrations/0082_fellas_inc_arvore_grande.sql` (parte B, no fim)
- Modify: `games/test/idleArvoreGrande.test.ts` (describe novo no fim), `games/test/idleDesempenho.test.ts:18`

**Interfaces:**
- Consumes: `efeitosArvore`/`efeitosDe` com `producaoSoma`, `espaco`, `legadoMult` (Task 3).
- Produces: `taxa`, `taxaPorUnidade`, `rendasGeradores`, `fatores`, `multBonus`, `multLegado` com a árvore grande (mesmas assinaturas); `idle_bonus_mult` com a soma; `idle_gen_rendas` com o CTE `arv` (materialized) e o Espaço/legado. A Task 5 (simulação) e a 10 (caixinha) usam essas contas.

- [ ] **Step 1: Testes da página (falham)**

No fim de `games/idle/economia.test.ts`:

```ts
describe('a árvore grande na produção (igual a idle_gen_rendas e idle_bonus_mult na 0082)', () => {
  const base = () => com([[1, 50], [7, 20], [30, 3], [31, 2], [37, 1]], { strategies: [0, 0, 0, 0, 0, 0] });
  const comNos = (arvore: number[], niveis: Record<number, number> = {}) => ({ ...base(), bonus: { arvore, conquistas: 0, niveis } });
  it('os nós de soma somam entre si e multiplicam por cima dos de hoje (×1,1 do Cafezinho × (1 + 0,2 + 0,15))', () => {
    const r = taxa(cat, comNos([1, 11, 106, 2001])) / taxa(cat, comNos([1, 11]));
    expect(r).toBeCloseTo(1.35, 12);
    expect(multBonus(cat, comNos([1, 106]))).toBeCloseTo(1.05 * 1.2, 12);
  });
  it('o infinito da Produção soma 5% por nível', () => {
    expect(taxa(cat, comNos([3001], { 3001: 6 })) / taxa(cat, comNos([]))).toBeCloseTo(1.3, 12);
  });
  it('o Espaço vale só nos geradores 31 em diante (eras 6+), somando os nós dele', () => {
    const sem = comNos([]);
    const com_ = comNos([1004, 1008]); // +25% +50%
    expect(taxaPorUnidade(cat, com_, 31) / taxaPorUnidade(cat, sem, 31)).toBeCloseTo(1.75, 12);
    expect(taxaPorUnidade(cat, com_, 37) / taxaPorUnidade(cat, sem, 37)).toBeCloseTo(1.75, 12);
    expect(taxaPorUnidade(cat, com_, 30)).toBeCloseTo(taxaPorUnidade(cat, sem, 30), 12);
  });
  it('o legado ×2 dobra o p de todos os legados (o maior comprado vale)', () => {
    const s = { ...base(), upgrades: [3001, 3006] };
    const leg = (arvore: number[]) => multLegado(cat, { ...s, bonus: { arvore, conquistas: 0 } }, 6) - 1;
    expect(leg([1003, 1007])).toBeCloseTo(2 * leg([]), 12);
    expect(leg([1003])).toBeCloseTo(1.5 * leg([]), 12);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts`
Expected: FAIL nas 4 novas.

- [ ] **Step 2: A conta da página (`economia.ts`)**

Troque `multLegado` (l. 41–48) por:

```ts
/** O legado na era `alvo` (igual a idle_gen_rendas na 0082): 1 + Σ p × (×legado da árvore) × unidades da era fonte de
 *  cada legado comprado. */
export function multLegado(cat: Catalogo, s: Estado, alvo: number): number {
  return legadoCom(cat, s, alvo, efeitosDe(cat, s).legadoMult);
}
/** multLegado com o ×legado já calculado (fatores calcula os efeitos uma vez só por conta). */
function legadoCom(cat: Catalogo, s: Estado, alvo: number, leg: number): number {
  let m = 1;
  for (const id of s.upgrades) {
    const u = melhoria(cat, id);
    if (u?.tipo === 'legado' && u.alvoEra === alvo) m += u.porUnidade * leg * unidadesDaEra(cat, s.generators, u.fonteEra);
  }
  return m;
}
```

(`efeitosDe` e `melhoria` são `const`/funções declaradas mais abaixo no arquivo; elas só rodam depois do módulo carregar, então pode usar.)

Troque `multBonus` (l. 98–101) por:

```ts
/** Árvore e conquistas (igual a idle_bonus_mult na 0082): nós de produção de hoje × a soma da árvore grande (1 + Σ) ×
 *  (1 + 1% por conquista). */
export function multBonus(cat: Catalogo, s: Estado): number {
  const ef = efeitosDe(cat, s);
  return ef.producao * ef.producaoSoma * (1 + POR_CONQUISTA * (s.bonus?.conquistas ?? 0));
}
```

Em `fatores`, os efeitos da árvore saem uma vez só por conta (a simulação do veterano chama `taxa` milhões de vezes). Logo depois de `const est = estrategiasAtivas(cat, s);` acrescente `const ef = efeitosDe(cat, s);`; troque a linha `  global *= multBonus(cat, s);` por `  global *= ef.producao * ef.producaoSoma * (1 + POR_CONQUISTA * (s.bonus?.conquistas ?? 0)); // = multBonus`; e troque o bloco `const legado = new Map<number, number>(); …` até o `});` do `porGerador` por:

```ts
  const legado = new Map<number, number>(); // por era alvo
  const espaco = ef.espaco; // árvore grande: só nos geradores das eras 6+
  const porGerador = cat.geradores.map((g) => {
    if (!legado.has(g.era)) legado.set(g.era, legadoCom(cat, s, g.era, ef.legadoMult));
    let mult = 1;
    for (const e of est) if (e.genDe !== null && e.genAte !== null && g.id >= e.genDe && g.id <= e.genAte) mult *= e.genMult;
    return g.renda * 2 ** dobras[g.id - 1] * sinergia[g.id - 1] * legado.get(g.era)! * mult * (g.era >= 6 ? espaco : 1);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/dica.test.ts idle/simulacao.test.ts`
Expected: PASS (os ritmos de quem começa do zero não mudam: ninguém tem nó novo ainda).

- [ ] **Step 3: Testes do banco (falham)**

No fim de `games/test/idleArvoreGrande.test.ts`, acrescente `taxa, type Estado` no import de `../idle/economia` e:

```ts
describe('paridade da produção com a árvore grande (0082 parte B)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('taxa com a soma, o Espaço, o legado e os infinitos (níveis ao acaso) é a de economia.ts', async () => {
    const r = rng(82);
    const producao = catalogo.arvore.filter((n) => ['producao', 'producao_soma', 'espaco_soma', 'legado_mult'].includes(n.tipo)).map((n) => n.id);
    for (let i = 0; i < 30; i++) {
      const generators = Array.from({ length: 42 }, (_, g) => (r() < 0.75 - g * 0.012 ? Math.floor(r() * 150) : 0));
      const upgrades = catalogo.melhorias.filter((m) => r() < (m.tipo === 'legado' ? 0.6 : 0.25)).map((m) => m.id);
      const strategies = [0, 1, 2, 3, 4, 5].map((k) => {
        const ops = catalogo.estrategias.filter((e) => e.era === k + 2 && e.ativa).map((e) => e.opcao);
        return r() < 0.8 ? ops[Math.floor(r() * ops.length)] : -1;
      });
      const nos = producao.filter(() => r() < 0.5);
      const niveis = Object.fromEntries(nos.filter((id) => id > 3000).map((id) => [id, 1 + Math.floor(r() * 25)]));
      await q('delete from public.idle_state where true');
      await q('delete from public.idle_arvore where true');
      await q(`insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies)
               values ($1, public.games_week_start(), true, $2, $3, $4)`, [A, generators, upgrades, strategies]);
      await ter(nos, niveis);
      const s: Estado = { generators, upgrades, strategies, bonus: { arvore: nos, conquistas: 0, niveis } };
      const [{ v }] = await q<{ v: number }>('select public.idle_rate(s) as v from public.idle_state s where user_id = $1', [A]);
      expect(rel(v, taxa(catalogo, s)), `${nos} ${JSON.stringify(niveis)}`).toBeLessThan(1e-9);
    }
  });
});
```

Em `games/test/idleDesempenho.test.ts:18`, troque `for (const cte of ['est', 'glob', 'leg'])` por `for (const cte of ['est', 'glob', 'arv', 'leg'])` e o título do teste por `'os CTEs de fora da linha do gerador rodam uma vez só (materialized; o arv é da 0082)'`.

Run: `cd games && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleDesempenho.test.ts`
Expected: FAIL (o banco não conhece a soma nem o Espaço; não tem o CTE `arv`).

- [ ] **Step 4: 0082, parte B**

No fim da 0082, acrescente:

```sql

-- ===== parte B: a soma de produção, o Espaço (eras 6+) e o legado na conta =====
-- nós de produção de hoje × a soma da árvore grande (1 + Σ valor × nível) × (1 + 1% por conquista) (a da 0041 + 0082;
-- igual a economia.ts multBonus)
create or replace function public.idle_bonus_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(s.user_id, 'producao', 'mult', 1)
       * (1 + public.idle_arv(s.user_id, 'producao_soma', 'soma', 0))
       * (1 + 0.01::double precision * (select count(*) from public.idle_conquistas c where c.user_id = s.user_id))
$$;
revoke all on function public.idle_bonus_mult(public.idle_state) from public, anon, authenticated;
```

Depois, copie `idle_gen_rendas` da **0079** (l. 6–41: o comentário, a função e o `revoke`) e mude:
- o comentário de cima: `-- quanto cada gerador rende em t (a da 0079, CTEs materializados) com a árvore grande (0082): o Espaço multiplica os`
  `-- geradores das eras 6+ (1 + Σ valor × nível) e o ×legado (o maior comprado) multiplica o p de todos os legados. Igual a`
  `-- economia.ts fatores/multLegado.`
- a linha `  ), leg as materialized (` vira:

```sql
  ), arv as materialized (
    -- árvore grande (0082): o Espaço (só nos geradores das eras 6+) e o ×legado
    select 1 + public.idle_arv(s.user_id, 'espaco_soma', 'soma', 0) as espaco,
           public.idle_arv(s.user_id, 'legado_mult', 'max', 1) as leg
  ), leg as materialized (
```

- a linha `           1 + sum(u.por_unidade * (select coalesce(sum(coalesce(s.generators[g.id], 0)), 0)` vira `           1 + (select a.leg from arv a) * sum(u.por_unidade * (select coalesce(sum(coalesce(s.generators[g.id], 0)), 0)`
- depois da linha `         * coalesce((select leg.m from leg where leg.era = c.era), 1)`, acrescente a linha `         * case when c.era >= 6 then (select a.espaco from arv a) else 1 end`

- [ ] **Step 5: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleDesempenho.test.ts test/idleParidade.test.ts test/idleEras67.test.ts test/idleArvore.test.ts test/idleConvidados.test.ts test/idleMapa.test.ts test/idleDouradosCaixinha.test.ts idle/economia.test.ts idle/dica.test.ts`
Expected: PASS. (Se `idleDouradosCaixinha.test.ts:65` reescreve o `glob` da `idle_gen_rendas` no próprio teste, ele continua valendo: o `glob` não mudou.)

- [ ] **Step 6: Commit**

```bash
git add games/idle/economia.ts games/idle/economia.test.ts supabase/migrations/0082_fellas_inc_arvore_grande.sql games/test/idleArvoreGrande.test.ts games/test/idleDesempenho.test.ts
git commit -m "Fellas Inc.: a soma de produção, o Espaço nas eras 6+ e o ×legado na conta (0082, parte B)"
```

---
### Task 5: Recomeço, Oportunidades, Gente e Horta com a árvore grande (0082, parte C)

**Files:**
- Modify: `games/idle/economia.ts` (`abertura` l. 113–120, `precoContrato` l. 122–127), `games/idle/economia.test.ts`
- Modify: `games/idle/dica.ts` (`dicaOportunidade`, a linha do `quinze`), `games/idle/tela.ts:772` (o ×Horta)
- Modify: `supabase/migrations/0082_fellas_inc_arvore_grande.sql` (parte C)
- Modify: `games/test/idleArvoreGrande.test.ts`, `games/test/idleHorta.test.ts` (um teste no `describe` da árvore na horta)

**Interfaces:**
- Consumes: `inicioEras`, `inicioMult`, `oppFs`, `contratoDesconto`, `hortaSoma` (Task 3).
- Produces: `abertura` com 1 de cada gerador das eras 1 a `max(inicioEra1 ? 1 : 0, inicioEras)` e F$ `inicioValuation × inicioMult`; `precoContrato` com `max(0.1, contratoPreco × (1 − contratoDesconto))`; `idle_start`, `idle_claim_opportunity` (×(1 + opp_fs) na de F$), `idle_hire_price`, `idle_horta_bonus` (×(1 + horta_soma)) iguais. Os Dourados não mudam no banco (Decisão 4: o infinito é `dourado_investidor` e os nós 6–10 usam tipos de hoje).

- [ ] **Step 1: Testes da página (falham)**

No fim de `games/idle/economia.test.ts`:

```ts
describe('Recomeço e Gente da árvore grande (igual a idle_start e idle_hire_price na 0082)', () => {
  it('abertura: F$ 1 bi / 1 tri, 1 de cada gerador das eras 1 a N, e o ×10 por nível do Abrir outra startup', () => {
    const ab = (nos: number[], niveis: Record<number, number> = {}) => abertura(cat, efeitosArvore(cat, nos, niveis));
    expect(ab([206]).valuation).toBe(1e9);
    expect(ab([206, 208]).valuation).toBe(1e12);
    const g = ab([207]).generators;
    expect(g.slice(0, 13)).toEqual([1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 0]);
    const g4 = ab([22, 25, 210]).generators;
    expect(g4.slice(0, 25)).toEqual([10, ...Array(23).fill(1), 0]);
    expect(ab([208, 3002], { 3002: 3 }).valuation).toBeCloseTo(1e15, 0);
  });
  it('contratar: o desconto da Gente × (1 − 2% por nível), nunca abaixo de 10%', () => {
    const s = com([[1, 100]], { strategies: [-1, -1, -1, -1, -1, -1] });
    const preco = (arvore: number[], niveis: Record<number, number> = {}) => precoContrato(cat, { ...s, bonus: { arvore, conquistas: 0, niveis } }, 0);
    const cheio = precoContrato(cat, s, 0);
    expect(preco([509]) / cheio).toBeCloseTo(0.3, 12);
    expect(preco([509, 3005], { 3005: 10 }) / cheio).toBeCloseTo(0.3 * 0.8, 12);
    expect(preco([509, 3005], { 3005: 40 }) / cheio).toBeCloseTo(0.1, 12);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts`
Expected: FAIL.

(Razões contra o preço sem nó: os nós 509 e 3005 não mexem na taxa.)

- [ ] **Step 2: A página**

Em `economia.ts`, troque o corpo de `abertura` por:

```ts
  const generators = Array(cat.geradores.length).fill(0);
  generators[0] = ef.inicioNotebooks;
  // 1 de cada gerador das eras 1 a N: o Material escolar (era 1) e o Kit primeiro emprego / Mochilão / Nepo baby (2, 3, 4)
  const eras = Math.max(ef.inicioEra1 ? 1 : 0, ef.inicioEras);
  for (const g of cat.geradores) if (g.era <= eras) generators[g.id - 1] = Math.max(generators[g.id - 1], 1);
  return { valuation: ef.inicioValuation * ef.inicioMult, generators, upgrades: ef.manterGerais ? [...gerais] : [] };
```

e troque o comentário dela por `/** A empresa do "Abrir CNPJ" com os nós do Recomeço (igual a idle_start na 0082): F$ inicial × o Abrir outra startup, os notebooks e 1 de cada gerador das eras 1 a N. \`gerais\`: as melhorias gerais que a venda manteve (só com "Leva o crachá"). */`.

Troque `precoContrato` por:

```ts
/** Preço do próximo contrato (igual a idle_hire_price na 0082): 30 min da produção × 1,5^(contratos ativos que você fez) ×
 *  2 com Abrir capital × o desconto da árvore (o menor da Gente × (1 − 2% por nível do Happy hour), nunca abaixo de 10%). */
export function precoContrato(cat: Catalogo, s: Estado, ativos: number): number {
  const custo = estrategiasAtivas(cat, s).reduce((a, e) => a * (e.sociais.contratoCustoMult ?? 1), 1);
  const ef = efeitosDe(cat, s);
  return taxa(cat, s) * 1800 * 1.5 ** ativos * custo * Math.max(0.1, ef.contratoPreco * (1 - ef.contratoDesconto));
}
```

Em `dica.ts`, `dicaOportunidade`: troque `const quinze = formatarValor(s.rate * 900 * c * (1 + (s.horta_bonus?.oportunidades ?? 0)));` por `const quinze = formatarValor(s.rate * 900 * c * (1 + (s.horta_bonus?.oportunidades ?? 0)) * efeitosDe(catalogo, s).oppFs); // o Cliente fiel (0082) vale nas de F$`.

Em `tela.ts:772`, troque `efeitosDe(catalogo, s).hortaMult);` por `efeitosDe(catalogo, s).hortaMult * efeitosDe(catalogo, s).hortaSoma); // o Adubo orgânico premium (0082) por cima`.

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/dica.test.ts idle/tela.test.ts`
Expected: PASS.

- [ ] **Step 3: Testes do banco (falham)**

No fim de `games/test/idleArvoreGrande.test.ts`, acrescente `abertura, precoContrato` no import de `../idle/economia`, `import { CAIXA_PADRAO, pendentes } from '../idle/oportunidades';`, `afterEach, vi` no import do vitest, `quartaAntesDoCorte` no import de `./db`, e:

```ts
describe('Recomeço, Oportunidades e Gente com a árvore grande (0082 parte C)', () => {
  afterEach(() => vi.useRealTimers());
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
  });
  const RECOMECO = [1, 21, 22, 23, 24, 25];
  it.each([
    ['F$ 1 bi', [...RECOMECO, 206], {}],
    ['eras 1 e 2', [...RECOMECO, 206, 207], {}],
    ['F$ 1 tri, eras 1 a 4', [...RECOMECO, 206, 207, 208, 209, 210], {}],
    ['×10 por nível (3)', [...RECOMECO, 206, 207, 208, 209, 210, 3002], { 3002: 3 }],
  ] as [string, number[], Record<number, number>][])('abertura: %s (idle_start = economia.ts abertura)', async (_n, nos, niveis) => {
    await ter(nos, niveis);
    const esperado = abertura(catalogo, efeitosArvore(catalogo, nos, niveis));
    const s = await t.rpc<J>('idle_start');
    expect(rel(s.valuation, esperado.valuation)).toBeLessThan(1e-12);
    expect(s.generators).toEqual(esperado.generators);
  });
  it('contratar: Estágio "pela experiência" (×0,3) e o Happy hour (−2% por nível, piso 10%), igual a precoContrato', async () => {
    await t.rpc('idle_start');
    for (const [nos, niveis] of [[[509], {}], [[509, 3005], { 3005: 10 }], [[509, 3005], { 3005: 40 }]] as [number[], Record<number, number>][]) {
      await q('delete from public.idle_arvore where user_id = $1', [A]);
      await ter(nos, niveis);
      const [{ p, g, u, st }] = await q<{ p: number; g: number[]; u: number[]; st: number[] }>(
        'select public.idle_hire_price(s) as p, s.generators as g, s.upgrades as u, s.strategies as st from public.idle_state s where user_id = $1', [A]);
      const est = { generators: g, upgrades: u, strategies: st, bonus: { arvore: nos, conquistas: 0, niveis }, social: { contratei: 0, empregos: [] } };
      expect(rel(p, precoContrato(catalogo, est, 0)), `${nos} ${JSON.stringify(niveis)}`).toBeLessThan(1e-9);
    }
  });
  it('Cliente fiel: a oportunidade de F$ rende +2% por nível (com a Xepa e o Cupom empilhado: ×3 × 1,1)', async () => {
    vi.useFakeTimers({ toFake: ['Date'] }); // numa quarta à tarde, não na virada do dia
    vi.setSystemTime(quartaAntesDoCorte());
    await t.rpc('idle_start');
    await q('update public.idle_state set week_start = public.games_week_start() - 7 where user_id = $1', [A]);
    const nos = [1, 31, 32, 33, 34, 35, 306, 307, 308, 309, 310, 3003];
    await ter(nos, { 3003: 5 });
    const com = await t.rpc<J & { server_now: string; week_start: string }>('idle_open');
    const agora = Date.parse(com.server_now);
    const semana = Date.parse(com.week_start + 'T00:00:00-03:00');
    const lista = pendentes(A, agora, [], semana, { tamanho: efeitosArvore(catalogo, nos).caixinha, validadeS: CAIXA_PADRAO.validadeS });
    await q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [A]);
    // a de F$ em qualquer janela: troca o sorteio do tipo por um que dá sempre 0 (a conta do valor é a que importa aqui)
    await t.db.exec('create or replace function public.idle_opp_kind(u uuid, w bigint) returns int language sql immutable as $$ select 0 $$;');
    const w = lista[0];
    expect(w).toBeDefined();
    const depois = await t.rpc<J>('idle_claim_opportunity', { p_window: w });
    expect((depois.valuation - com.valuation) / (com.rate * 900)).toBeCloseTo(3 * 1.1, 6);
  });
});
```

Em `games/test/idleHorta.test.ts`, logo depois do teste `'Agrotóxico liberado: …'`, acrescente:

```ts
  it('Transgênico gourmet (×2) e o Adubo orgânico premium (+5% por nível, 0082): bônus ×2 × 1,25 no nível 5; descontos seguem até 50%', async () => {
    await por(0, 1, 2 * 3600);
    await ter([1, 61, 62, 63, 64, 65, 606, 607, 608, 609, 610, 3006]);
    await q('update public.idle_arvore set nivel = 5 where user_id = $1 and no_id = 3006', [A]);
    expect((await t.rpc<Estado>('idle_open')).horta_bonus.producao).toBeCloseTo(0.01 * 2 * 1.25, 9);
    await q('update public.idle_state set generators[11] = 200 where user_id = $1', [A]);
    await q('delete from public.idle_horta_plantas where user_id = $1', [A]);
    for (let c = 0; c < 36; c++) await por(c, 7, 7 * 3600);
    expect((await t.rpc<Estado>('idle_open')).horta_bonus.geradores).toBe(0.5);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleHorta.test.ts`
Expected: FAIL (o banco ainda não conhece os tipos novos do Recomeço, do Cliente fiel, do Happy hour nem do Adubo).

- [ ] **Step 4: 0082, parte C**

No fim da 0082, acrescente o cabeçalho:

```sql

-- ===== parte C: Recomeço, Oportunidades, Gente e Horta =====
```

Copie `idle_start` da 0041 (l. 692–724: o comentário, a função e o `revoke`/`grant` das l. 723–724; **não** copie as linhas do `idle_buy_node` que ficam no meio) e mude:
- o comentário: `-- "Abrir CNPJ" (o da 0041) com a árvore grande (0082): F$ inicial × o Abrir outra startup (10^nível) e 1 de cada gerador`
  `-- das eras 1 a N (Material escolar = 1; Kit primeiro emprego / Mochilão / Nepo baby = 2, 3, 4). Igual a economia.ts abertura.`
- no `declare`, depois de `  g int;`, acrescente `  v_eras int;`
- `  s.valuation := greatest(10, public.idle_arv(s.user_id, 'inicio_valuation', 'max', 10));` vira `  s.valuation := greatest(10, public.idle_arv(s.user_id, 'inicio_valuation', 'max', 10)) * public.idle_arv(s.user_id, 'inicio_mult', 'mult', 1);`
- o bloco `  if public.idle_arv(s.user_id, 'inicio_era1', 'max', 0) > 0 then` … `  end if;` vira:

```sql
  v_eras := greatest(case when public.idle_arv(s.user_id, 'inicio_era1', 'max', 0) > 0 then 1 else 0 end,
                     public.idle_arv(s.user_id, 'inicio_eras', 'max', 0)::int);
  for g in select c.id from public.idle_cat_gen c where c.era <= v_eras loop
    s.generators[g] := greatest(coalesce(s.generators[g], 0), 1);
  end loop;
```

Copie `idle_hire_price` da 0041 (l. 242–253 e o `revoke` da l. 263) e mude o comentário pra `-- preço do próximo contrato (o da 0041) com o Happy hour da firma (0082): o desconto da Gente × (1 − 2% por nível), nunca abaixo de 10% (igual a economia.ts precoContrato)` e a linha `       * public.idle_arv(s.user_id, 'contrato_preco', 'min', 1)` por:

```sql
       * greatest(0.1, public.idle_arv(s.user_id, 'contrato_preco', 'min', 1)
                       * (1 - public.idle_arv(s.user_id, 'contrato_desconto', 'soma', 0)))
```

Copie `idle_claim_opportunity` da 0076 (l. 806–882: o comentário, a função e o `revoke`/`grant`) e mude o comentário (acrescente no fim `; o Cliente fiel (0082) faz a de F$ render +2% por nível`) e a linha `    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, v_lado, now()) b));` por:

```sql
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, v_lado, now()) b))
                               * (1 + public.idle_arv(s.user_id, 'opp_fs', 'soma', 0));
```

Copie `idle_horta_bonus` da 0061 (l. 146–160: o comentário, a função e o `revoke`) e mude o comentário (acrescente `; × (1 + 5% por nível do Adubo orgânico premium, 0082)`) e a linha `  with m as (select public.idle_arv(u, 'horta_mult', 'max', 1) as m)` por `  with m as (select public.idle_arv(u, 'horta_mult', 'max', 1) * (1 + public.idle_arv(u, 'horta_soma', 'soma', 0)) as m)`.

- [ ] **Step 5: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleHorta.test.ts test/idleArvore.test.ts test/idleParidade.test.ts test/idleGente.test.ts test/idleDouradosCaixinha.test.ts test/idleOportunidadesSorte.test.ts idle/economia.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add games/idle/economia.ts games/idle/economia.test.ts games/idle/dica.ts games/idle/tela.ts supabase/migrations/0082_fellas_inc_arvore_grande.sql games/test/idleArvoreGrande.test.ts games/test/idleHorta.test.ts
git commit -m "Fellas Inc.: Recomeço, Oportunidades, Gente e Horta da árvore grande (0082, parte C)"
```

---
### Task 6: A simulação: quem começa do zero continua no ritmo, e o veterano fecha a parte fixa (trava a calibração)

**Files:**
- Modify: `games/idle/simulacao.ts` (`NAO_ACELERA` e `gastar`, l. 105–126; `veterano` novo no fim)
- Modify: `games/idle/simulacao.test.ts` (imports; o teste do `gastar`; dois `describe` novos no fim)
- Create: `games/test/fixtures/veterano-2026-10-15.json`

**Interfaces:**
- Consumes: as contas com a árvore grande (Tasks 3–5): `taxa`, `taxaPorUnidade`, `abertura`, `efeitosArvore`.
- Produces: `type Portoes = { vendas: number; eraMax: number }`; `gastar(cat, pontos, ja = [], portoes = { vendas: 0, eraMax: 1 }, todos = false): { arvore: number[]; sobra: number }` (nunca compra infinito; `todos` compra também os que não aceleram); `type FixtureVeterano`; `veterano(fix, cat, opts): { dia: number | null; vendas: number; multCheio: number; extra: number; log: string[] }`.

- [ ] **Step 1: O retrato do veterano (fixture)**

Crie `games/test/fixtures/veterano-2026-10-15.json` (copiado do banco de produção em 15/10 à noite, só leitura, o jogador de maior F$/s; sem id nem nome) com exatamente:

```json
{"rate":6594977612082640000,"era":7,"era_max":7,"generators":[305,300,300,300,300,300,277,216,246,227,222,219,208,205,191,187,84,78,68,60,60,71,79,100,100,105,100,102,100,106,100,101,100,91,100,77,66,53,50,50,52,53],"upgrades":[1001,1002,1003,1004,1005,1008,1007,1006,1009,1010,1011,1012,1013,1014,1015,1016,1018,1017,1019,1020,11,21,12,31,22,41,2001,32,51,13,2002,42,61,23,2003,52,71,33,2004,62,43,2005,72,53,2006,14,63,81,91,82,101,2007,92,24,111,73,2008,102,34,121,83,2009,112,44,131,93,2010,122,54,141,103,2011,132,15,64,151,113,142,74,2012,25,161,123,2013,152,35,84,171,133,2014,162,94,181,143,2015,172,55,104,191,153,45,2016,182,114,201,163,2017,192,75,124,211,173,2018,202,134,221,183,2019,212,144,231,222,241,2030,301,291,281,252,271,261,242,115,232,251,262,272,85,16,95,193,2020,203,213,2023,2024,243,253,282,174,2025,302,263,292,244,2026,273,303,2027,2028,283,2029,293,17,274,284,254,264,304,294,65,26,105,154,36,2021,164,46,2022,125,56,223,135,184,66,233,145,194,76,155,204,214,224,234,245,1021,1022,1023,311,321,3001,331,3002,341,312,351,1027,1028,1026,1024,1025,322,3003,361,3004,371,381,332,3005,352,3006,391,313,362,3007,401,342,323,372,411,255,333,382,3008,421,343,392,3009,353,402,3010,412,422,3011,363,373,383,393,403,314,413,324,423,334,344,354,86,27,37,47,57,67,77,87,364,374,116,117,165,96,106,126,136,146,156,166,97,107,127,137,147,18,28,38,265,275,285,295,384,394,305,404],"strategies":[2,0,2,1,0,0],"prestige_earned":232,"prestige_spent":227,"prestige_count":3,"nos":[1,11,12,13,14,15,21,22,23,31,32,33,34,41,42,43,44,45,51,52,53,54,55,61,62],"conquistas":85}
```

(Os números de melhoria 3001–3011 aqui são melhorias de **legado**, não nós da árvore; os nós estão em `nos`.)

- [ ] **Step 2: Os testes (falham)**

Em `games/idle/simulacao.test.ts`, troque os imports do topo por:

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

import { catalogo, PARAMETROS_ESPACO, PRECO_NIVEL } from './catalogo';
import { K_PRESTIGIO, pontosTotais, SEM_BONUS } from './economia';
import { FIM_ERA_12, gastar, primeiraVenda, RITMO_ERAS, simular, veterano, volta, type FixtureVeterano } from './simulacao';
import { mediaOportunidade, RODA_OPP_HOJE, RODA_OPP_NOVA } from './valorMedio';
```

Depois do teste `'quem gasta compra o mais barato que acelera: com 11 pontos, …'`, acrescente:

```ts
  it('quem nunca vendeu não passa dos portões: com 1.000 pontos só compra entre os 31 de hoje', () => {
    const { arvore } = gastar(catalogo, 1000);
    expect(arvore.every((id) => id <= 65)).toBe(true);
  });
  it('com 3 vendas e a era 7, o 106 entra; nunca um infinito; `todos` compra também os que não aceleram', () => {
    const p = { vendas: 3, eraMax: 7 };
    expect(gastar(catalogo, 1000, [], p).arvore).toContain(106);
    expect(gastar(catalogo, 1e6, [], { vendas: 99, eraMax: 7 }).arvore.some((id) => id > 3000)).toBe(false);
    expect(gastar(catalogo, 1000, [], p).arvore).not.toContain(41); // Dourados não acelera a simulação
    expect(gastar(catalogo, 1000, [], p, true).arvore).toContain(41);
  });
```

No fim do arquivo, acrescente:

```ts
// Árvore grande (16/10): o veterano do retrato (games/test/fixtures, o maior F$/s de 15/10) vende, gasta na parte fixa
// e recomeça até fechar. Medido ao planejar: fecha no dia 12,2 (passo 30 s; 12,8 com 5 s), em ~11 vendas; a árvore
// cheia deixa a produção dele ×26,9; o modelo × 17,2 dá o F$/s real (contratos, convidados, Mapa, Horta). A parte fixa
// não pode passar de ~67 mil pontos: acima disso a era 7 trava e ele não fecha até as eras 8–9 (Decisão 2 do plano).
// Se sair da faixa: ajuste SÓ os custos novos de catalogo.ts (CUSTO_NOVOS_HOJE, CUSTO_RECURSO, CUSTO_ESPACO,
// CUSTO_PONTE), regere a 0081 (ainda não publicada) e avise o Juan.
describe('o veterano (árvore grande)', () => {
  const fix = JSON.parse(readFileSync(resolve(__dirname, '../test/fixtures/veterano-2026-10-15.json'), 'utf8')) as FixtureVeterano;
  const tem = { horta: true, bolsa: true };
  const minutos = 15 * (mediaOportunidade(RODA_OPP_NOVA, tem) / mediaOportunidade(RODA_OPP_HOJE, tem));
  const v = veterano(fix, catalogo, { minutosOpp: minutos });
  it('o retrato: era 7, a venda de agora daria 18.753 pontos no total; o fator de fora do modelo fica perto de 17', () => {
    expect(fix).toMatchObject({ era: 7, prestige_earned: 232, prestige_count: 3 });
    expect(pontosTotais(fix.rate)).toBe(18753);
    expect(v.extra).toBeGreaterThan(14);
    expect(v.extra).toBeLessThan(21);
  });
  it('fecha a parte fixa da árvore entre os dias 10 e 16 (medido ao planejar: 12,2)', () => {
    expect(v.dia, v.log.join('\n')).not.toBeNull();
    expect(v.dia!).toBeGreaterThanOrEqual(10);
    expect(v.dia!).toBeLessThan(16);
  });
  it('a árvore fixa cheia deixa a produção dele entre ×20 e ×30 (medido: ×26,9; a spec queria 10–20, ver a Decisão 3)', () => {
    expect(v.multCheio).toBeGreaterThan(20);
    expect(v.multCheio).toBeLessThan(30);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts`
Expected: FAIL (`veterano`/`FixtureVeterano` não existem; o `gastar` não confere portão).

- [ ] **Step 3: A simulação (`simulacao.ts`)**

Os imports de hoje (`./catalogo`: `catalogo as padrao, type Catalogo, type No`; `./economia`: `abertura, acumular, custoMult, efeitosArvore, era, liberada, podeComprarGerador, pontosTotais, preco, SEM_BONUS, SOLO, taxa, taxaPorUnidade, type Bonus, type Estado`; `./oportunidades`: `LIMITE_DIA`) já cobrem tudo o que vem abaixo.

Troque `NAO_ACELERA` e `gastar` (l. 105–126) por:

```ts
// o que não acelera o jogador sozinho da simulação: o ramo Gente (ninguém o contrata) e o tempo das oportunidades na cena
// (é só o tempo na tela: o limite dele é a caixinha). A simulação ESCOLHE a Viralizar
// na era 3, mas a conta em TS não aplica oppExtra/oppBonusMult de estratégia (só os dos nós da árvore); o banco aplica.
// a simulação não tem eventos dourados nem horta: os ramos Dourados e Horta não aceleram aqui; nem os minigames e os
// eventos de era da árvore grande (Bolsa, PPP, Mapa, Lixo, Silver tape)
const NAO_ACELERA: readonly No['tipo'][] = [
  'contrato_preco', 'por_contratado', 'contrato_dias', 'emprego_mult', 'segundos',
  'dourado_freq', 'dourado_tela', 'dourado_investidor', 'dourado_duracao',
  'horta_amadurece', 'horta_vida', 'horta_cruza', 'horta_mult', 'morango_chance',
  'opp_fs', 'contrato_desconto', 'horta_soma',
  'bolsa_corretagem', 'bolsa_limite', 'bolsa_limite_mult', 'bolsa_limite_soma', 'bolsa_espiadas', 'bolsa_escritorio',
  'conv_recarga', 'conv_trocas', 'conv_cadeira2', 'conv_cadeira3', 'conv_queda', 'conv_efeito',
  'mapa_abrir', 'mapa_nivel', 'marcos_mult', 'marcos_soma', 'tee_publico', 'tee_tempo', 'copao_mult',
  'lixo_min', 'silver_min', 'silver_mult', 'era_freq', 'era_janela',
];

/** Os portões que o jogador da simulação passa: quantas vezes vendeu e a maior era alcançada. */
export type Portoes = { vendas: number; eraMax: number };

/** O jogador gasta os pontos na árvore: sempre o nó fixo mais barato que ele pode comprar (o que pede comprado, portões
 *  passados) e que acelera (com `todos`, qualquer um); empate: o de id menor. Nunca um infinito. */
export function gastar(
  cat: Catalogo, pontos: number, ja: readonly number[] = [], portoes: Portoes = { vendas: 0, eraMax: 1 }, todos = false,
): { arvore: number[]; sobra: number } {
  const arvore = [...ja];
  let sobra = pontos;
  for (;;) {
    const opcoes = cat.arvore.filter(
      (n) => !arvore.includes(n.id) && n.cresce === null
        && (n.requer === null || arvore.includes(n.requer)) && (n.requer2 === null || arvore.includes(n.requer2))
        && (n.reqVendas === null || portoes.vendas >= n.reqVendas) && (n.reqEra === null || portoes.eraMax >= n.reqEra)
        && (todos || !NAO_ACELERA.includes(n.tipo)) && n.custo <= sobra,
    );
    if (!opcoes.length) return { arvore, sobra };
    const n = opcoes.reduce((a, b) => (b.custo < a.custo || (b.custo === a.custo && b.id < a.id) ? b : a));
    arvore.push(n.id);
    sobra -= n.custo;
  }
}
```

No fim do arquivo, acrescente:

```ts

/** O retrato de um jogador copiado do banco (só leitura, sem identificação; games/test/fixtures). */
export type FixtureVeterano = {
  rate: number; era: number; era_max: number; generators: number[]; upgrades: number[]; strategies: number[];
  prestige_earned: number; prestige_spent: number; prestige_count: number; nos: number[]; conquistas: number;
};
export type OpcoesVeterano = {
  /** quanto vale cada oportunidade (min de produção; com Horta e Bolsa, ver valorMedio.ts) */ minutosOpp: number;
  /** passo das compras (s): 30 deixa o teste em ~1 min; 5 é o da simulação de quem começa */ passo?: number;
  /** vende quando a venda dá esta fração a mais de pontos (ou paga o próximo nó fixo, o que vier antes) */ frac?: number;
  /** quantos dias cada empresa joga, no máximo, antes de vender do jeito que está */ maxDiasEmpresa?: number;
  /** até quando olhar (dias) */ dias?: number;
};

/** Uma empresa do zero com a árvore `bonus` (3 aberturas de 10 min por dia depois da 1ª hora, como simular), até
 *  `parar(taxa × extra)` no fim de uma abertura ou `maxDias`. Escolhe a 1ª estratégia ativa de cada era que chega (a
 *  abertura com as eras 1 a 4 já pede três). Devolve quando parou, a taxa × extra, a era e as gerais. */
function empresaAte(
  cat: Catalogo, bonus: Bonus, gerais: number[], extra: number, o: Required<OpcoesVeterano>, parar: (taxaReal: number) => boolean,
): { t: number; taxa: number; era: number; gerais: number[] } {
  const ef = efeitosArvore(cat, bonus.arvore, bonus.niveis);
  const ini = abertura(cat, ef, gerais);
  const s: Estado = { generators: ini.generators, upgrades: ini.upgrades, strategies: [-1, -1, -1, -1, -1, -1], social: SOLO, bonus };
  let v = ini.valuation;
  let relogio = 0;
  let oppHoje = 0;
  let dia = 0;
  const avancar = (ate: number) => {
    v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null);
    relogio = ate;
  };
  const comprar = () => {
    for (let i = 0; i < 60; i++) {
      const e = era(cat, s.generators);
      for (let k = 2; k <= e; k++) {
        if (s.strategies[k - 2] < 0) s.strategies[k - 2] = cat.estrategias.find((x) => x.era === k && x.ativa)!.opcao;
      }
      const cm = custoMult(cat, s);
      const base = taxa(cat, s);
      let melhor: { score: number; preco: number; aplicar: () => void } | null = null;
      for (const g of cat.geradores) {
        if (!podeComprarGerador(s, g.id)) continue;
        const p = preco(g.custo, s.generators[g.id - 1], 1, cm);
        if (p > v) continue;
        const score = taxaPorUnidade(cat, s, g.id) / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.generators[g.id - 1]++ };
      }
      for (const m of cat.melhorias) {
        if (s.upgrades.includes(m.id) || !liberada(cat, m, s)) continue;
        const p = m.preco * cm;
        if (p > v) continue;
        s.upgrades.push(m.id);
        const ganho = taxa(cat, s) - base;
        s.upgrades.pop();
        const score = ganho / p;
        if (!melhor || score > melhor.score) melhor = { score, preco: p, aplicar: () => s.upgrades.push(m.id) };
      }
      if (!melhor) return;
      v -= melhor.preco;
      melhor.aplicar();
    }
  };
  const fimDe = () => ({
    taxa: taxa(cat, s) * extra, era: era(cat, s.generators),
    gerais: s.upgrades.filter((id) => cat.melhorias.find((m) => m.id === id)?.tipo === 'geral'),
  });
  const ses = sessoes(o.maxDiasEmpresa);
  for (const [ini0, fim] of ses) {
    avancar(ini0);
    const d = Math.floor(ini0 / DIA);
    if (d !== dia) { dia = d; oppHoje = 0; }
    if (ini0 > 0) {
      const pegar = Math.min(ef.caixinha, LIMITE_DIA + ef.oppExtra - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 60 * o.minutosOpp * ef.oppBonus;
      oppHoje += pegar;
    }
    for (let t = ini0; t < fim; t += o.passo) {
      avancar(t);
      comprar();
    }
    if (parar(taxa(cat, s) * extra)) return { t: fim, ...fimDe() };
  }
  return { t: ses[ses.length - 1][1], ...fimDe() };
}

/**
 * O veterano da árvore grande: vende agora (o F$/s do retrato), gasta no nó fixo mais barato que pode (todos os tipos;
 * gastar com `todos`), recomeça e vende de novo no fim da abertura em que a venda dá `frac` a mais de pontos ou paga o
 * próximo nó fixo liberado (o que vier antes; se a empresa não chega em `maxDiasEmpresa`, vende do jeito que está). A
 * taxa do modelo × `extra` (= F$/s real ÷ F$/s do modelo no retrato: contratos, convidados, Mapa, Horta) é o que vale
 * nos pontos. `dia` = quando a parte fixa fechou (null = não fechou em `dias`); `multCheio` = quanto a árvore fixa
 * cheia multiplica a produção do retrato (contra a árvore de hoje cheia).
 */
export function veterano(fix: FixtureVeterano, cat: Catalogo = padrao, opcoes: OpcoesVeterano): {
  dia: number | null; vendas: number; multCheio: number; extra: number; log: string[];
} {
  const o: Required<OpcoesVeterano> = { passo: 30, frac: 0.3, maxDiasEmpresa: 15, dias: 60, ...opcoes };
  const retrato = (arvore: number[]): Estado => ({
    generators: fix.generators, upgrades: fix.upgrades, strategies: fix.strategies, social: SOLO, bonus: { arvore, conquistas: fix.conquistas },
  });
  const extra = fix.rate / taxa(cat, retrato(fix.nos));
  const hoje = cat.arvore.filter((n) => n.id <= 65).map((n) => n.id);
  const fixos = cat.arvore.filter((n) => n.cresce === null).map((n) => n.id);
  const multCheio = taxa(cat, retrato(fixos)) / taxa(cat, retrato(hoje));
  let ganhos = pontosTotais(fix.rate);
  let gastos = fix.prestige_spent;
  let vendas = fix.prestige_count + 1;
  let eraMax = fix.era_max;
  let arvore = [...fix.nos];
  let gerais: number[] = [];
  let t = 0;
  const log = [`dia 0: vende, total ${ganhos}`];
  for (let volta = 0; volta < 60 && t < o.dias * DIA; volta++) {
    const g = gastar(cat, ganhos - gastos, arvore, { vendas, eraMax }, true);
    gastos += ganhos - gastos - g.sobra;
    arvore = g.arvore;
    const faltam = cat.arvore.filter((n) => n.cresce === null && !arvore.includes(n.id));
    log.push(`dia ${(t / DIA).toFixed(1)}: vendas ${vendas}, ganhos ${ganhos}, livres ${ganhos - gastos}, faltam ${faltam.length}`);
    if (!faltam.length) return { dia: t / DIA, vendas, multCheio, extra, log };
    const liberados = faltam.filter((n) => (n.requer === null || arvore.includes(n.requer)) && (n.requer2 === null || arvore.includes(n.requer2))
      && (n.reqVendas === null || vendas >= n.reqVendas) && (n.reqEra === null || eraMax >= n.reqEra));
    const precisa = liberados.length ? Math.min(...liberados.map((n) => n.custo)) - (ganhos - gastos) : Infinity;
    const meta = Math.max(ganhos + 1, Math.min(ganhos * (1 + o.frac), ganhos + precisa));
    const r = empresaAte(cat, { arvore, conquistas: fix.conquistas }, gerais, extra, o, (x) => pontosTotais(x) >= meta);
    if (pontosTotais(r.taxa) <= ganhos) {
      log.push('travou: a venda não dá ponto');
      return { dia: null, vendas, multCheio, extra, log };
    }
    t += r.t;
    eraMax = Math.max(eraMax, r.era);
    ganhos = pontosTotais(r.taxa);
    vendas++;
    gerais = r.gerais;
  }
  return { dia: null, vendas, multCheio, extra, log };
}
```


- [ ] **Step 4: Rodar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts`
Expected: PASS; o `describe('o veterano')` leva ~1 min (o arquivo inteiro uns 2–3 min). Os ritmos de antes não mudam (ninguém do zero tem nó novo; quem vende com ~10 pontos não passa dos portões). Se o veterano sair da faixa: ajuste só os custos novos (ver o comentário do `describe`), regere a 0081 (`ATUALIZAR_CATALOGO=0081_fellas_inc_catalogo_arvore_grande.sql npx vitest run --maxWorkers=4 idle/catalogo.test.ts`), rode de novo e escreva o dia novo no comentário e no relatório. Se o `describe` passar de 3 min, troque o `passo` por 60 nas opções do teste e anote o dia que deu.

- [ ] **Step 5: Commit**

```bash
git add games/idle/simulacao.ts games/idle/simulacao.test.ts games/test/fixtures/veterano-2026-10-15.json
git commit -m "Fellas Inc.: simulação da árvore grande (portões no gastar; o veterano do banco fecha a parte fixa no dia ~12)"
```

---
### Task 7: Bolsa e PPP Podcast com a árvore grande (0082, parte D)

**Files:**
- Modify: `supabase/migrations/0082_fellas_inc_arvore_grande.sql` (parte D)
- Modify: `games/shared/types.ts` (`IdleConvidados`, `BolsaEstado`, `BolsaEmpresa`)
- Modify: `games/idle/convidados.ts` (l. 29–62, 65–74, 86–97, 101–111, 118–128, 133, 195–215), `games/idle/convidadosTela.ts` (l. 8–9, 37–41, 83, 86, 131, 141–142, 154, 187, 194), `games/idle/portas.ts:5,42-44`
- Modify: `games/idle/bolsa.ts` (`contaLimite`, l. 35–40), `games/idle/bolsaTela.ts:193,202,239`, `games/idle/dica.ts` (`dicaEspiar`)
- Modify: `games/idle/convidados.test.ts`, `games/idle/bolsa.test.ts`, `games/test/idleArvoreGrande.test.ts`

**Interfaces:**
- Consumes: `idle_arv` com nível (Task 3); colunas `info_gratis_dia`/`info_gratis_n` e `idle_save` que grava as duas (Task 3).
- Produces: banco: `idle_bolsa_taxa(u, p_corr)`, `idle_bolsa_limite(s, p_gerador, p_esc) returns int`, `idle_bolsa_gratis(s) returns int`, `idle_conv_trocas_max(u) returns int`, `idle_conv_recarga_s(u)`, `idle_conv_queda(u)`, `idle_conv_efeito(u)`; `idle_bolsa_estado` manda `corretagem` (com a árvore), `info_gratis`, e por empresa `limite` (com a árvore) e `limite_gen`; `idle_conv_json` manda `trocas_max`, `recarga_s`, `pesos` (3), `queda`, `efeito`. Página: `Cadeiras` com esses campos opcionais; `pesosDe(c)`, `trocasMax(c)`, `recargaS(c)`; `derrubada(uid, desdeS, k, chance = 0.25)`; `derrubadaAte(uid, p, desdeMs, tMs, chance = 0.25)`; `kojimaMult(p, desdeMs, tMs, efeito = 0)`; `tobyMult(p, desdeMs, tMs, efeito = 0)`; `aoVivo(id, p, desdeMs, uid, agoraMs, c?)`; `contaLimite(id, limite, escritorio, gen?)`; `dicaEspiar(nome, creditos, gratis = 0)`.

- [ ] **Step 1: Testes da página (falham)**

No fim de `games/idle/convidados.test.ts` (acrescente no import de `./convidados` o que faltar de `derrubada, kojimaMult, multProducao, peso, pesosDe, recargaS, tobyMult, trocasAgora, trocasMax`):

```ts
describe('PPP Podcast com a árvore grande (o banco manda os números; 0082)', () => {
  const T = Date.parse('2026-10-16T12:00:00Z');
  it('trocas: o máximo e a recarga que o banco mandou (sem eles, 3 e 1 h)', () => {
    const c = { trocas: 2, trocas_t: new Date(T - 45 * 60_000).toISOString(), trocas_max: 5, recarga_s: 1800 };
    expect(trocasAgora(c, T)).toEqual({ trocas: 3, proximaMs: T + 15 * 60_000 });
    expect(trocasMax(c)).toBe(5);
    expect(recargaS(c)).toBe(1800);
    expect(trocasAgora({ trocas: 5, trocas_t: null, trocas_max: 5 }, T)).toEqual({ trocas: 5, proximaMs: null });
    expect(trocasAgora({ trocas: 2, trocas_t: new Date(T - 45 * 60_000).toISOString() }, T)).toEqual({ trocas: 2, proximaMs: T + 15 * 60_000 });
  });
  it('a força das cadeiras que o banco mandou (Cadeira gamer, Sofá); sem elas, 1 / 0,5 / 0,25', () => {
    const c = { cadeira: [null, 1, 3], desde: [null, null, null], trocas: 3, trocas_t: null, pesos: [1, 0.75, 0.5] };
    expect(peso(c, 50, 1)).toBe(0.75);
    expect(peso(c, 50, 3)).toBe(0.5);
    expect(pesosDe({ cadeira: [null, null, null], desde: [null, null, null], trocas: 3, trocas_t: null })).toEqual([1, 0.5, 0.25]);
  });
  it('derrubada com a chance da árvore (5%): é um subconjunto das de 25%', () => {
    let n5 = 0;
    for (let k = 1; k <= 400; k++) {
      if (derrubada('u', 1_700_000_000, k, 0.05)) {
        n5++;
        expect(derrubada('u', 1_700_000_000, k)).toBe(true);
      }
    }
    expect(n5).toBeGreaterThan(5);
    expect(n5).toBeLessThan(40);
  });
  it('o efeito dos convidados multiplica só os bônus de produção (Cristiano, a subida do Kojima, o Toby)', () => {
    const desde = new Date(T - 30 * 3_600_000).toISOString();
    const c = { cadeira: [1, 5, 10], desde: [desde, desde, desde], trocas: 3, trocas_t: null, pesos: [1, 0.5, 0.25], efeito: 0.35 };
    const m = multProducao({ c, ppp: 50, uid: 'u' }, T);
    expect(m).toBeCloseTo((1 + 0.15 * 1.35) * kojimaMult(0.5, T - 30 * 3_600_000, T, 0.35) * tobyMult(0.25, T - 30 * 3_600_000, T, 0.35), 12);
    expect(kojimaMult(0.5, T, T, 0.35)).toBeCloseTo(1 - 0.05, 12); // o −10% do começo não muda
    expect(kojimaMult(0.5, T - 24 * 3_600_000, T, 0.35)).toBeCloseTo(1 + 0.5 * (-0.1 + 0.5 * 1.35), 12);
    expect(tobyMult(1, T - 20 * 3_600_000, T, 0.35)).toBeCloseTo(1 + 0.4 * 1.35, 12);
  });
});
```

No fim de `games/idle/bolsa.test.ts` (acrescente `contaLimite` no import se faltar):

```ts
describe('limite com a árvore grande', () => {
  it('o banco manda o gerador (limite_gen): sem árvore, a frase de sempre; com árvore, o total e de onde vem', () => {
    const id = EMPRESAS_BOLSA[0].id;
    expect(contaLimite(id, 130, 1, 5)).toBe(`Limite: 100 + 5 ${GERADORES[EMPRESAS_BOLSA[0].gerador - 1]} + 25 do Escritório`);
    expect(contaLimite(id, 760, 1, 5)).toBe(`Limite: 760 (100 + 5 ${GERADORES[EMPRESAS_BOLSA[0].gerador - 1]} + 25 do Escritório, com a árvore)`);
    expect(contaLimite(id, 130, 1)).toBe(`Limite: 100 + 5 ${GERADORES[EMPRESAS_BOLSA[0].gerador - 1]} + 25 do Escritório`); // resposta velha
  });
});
```

(`EMPRESAS_BOLSA` vem de `./bolsaMotor` e `GERADORES` de `./nomes`; acrescente os imports se o arquivo não tiver.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/convidados.test.ts idle/bolsa.test.ts`
Expected: FAIL.

- [ ] **Step 2: A página**

`games/shared/types.ts`:
- `IdleConvidados`: troque `cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null; ppp: number; derrubada_ate: string | null;` por:

```ts
  cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null; ppp: number; derrubada_ate: string | null;
  /** Com a árvore grande (0082): quantas trocas cabem, quanto cada uma leva pra voltar (s), a força das 3 cadeiras, a
   *  chance de a faixa do MC V.V ser derrubada e o +% dos bônus de produção. Ausentes (antes do push): 3, 3600, 1/0,5/0,25, 0,25, 0. */
  trocas_max?: number; recarga_s?: number; pesos?: number[]; queda?: number; efeito?: number;
```

- `BolsaEstado`: troque `/** créditos de Espiar (Informação privilegiada, 0076) */ info_creditos?: number;` por `/** créditos de Espiar (Informação privilegiada, 0076) e as grátis que ainda tem hoje (árvore grande, 0082) */ info_creditos?: number; info_gratis?: number;`.
- `BolsaEmpresa`: depois de `limite: number;` acrescente `/** quantos do gerador ligado você tem (0082: o limite tem a árvore por cima) */ limite_gen?: number;`.

`games/idle/convidados.ts`:
1. Troque `export type Cadeiras = { cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null };` por:

```ts
export type Cadeiras = {
  cadeira: (number | null)[]; desde: (string | null)[]; trocas: number; trocas_t: string | null;
  /** o que a árvore grande muda (idle_conv_json na 0082); ausente = o de sempre */
  trocas_max?: number; recarga_s?: number; pesos?: readonly number[]; queda?: number; efeito?: number;
};
/** A força das 3 cadeiras, quantas trocas cabem e quanto cada uma leva pra voltar (s): o que o banco mandou, ou o de sempre. */
export const pesosDe = (c: Pick<Cadeiras, 'pesos'>): readonly number[] => c.pesos ?? PESOS;
export const trocasMax = (c: Pick<Cadeiras, 'trocas_max'>): number => c.trocas_max ?? MAX_TROCAS;
export const recargaS = (c: Pick<Cadeiras, 'recarga_s'>): number => c.recarga_s ?? RECARGA_S;
```

2. Em `peso`, troque `return i >= 0 && destrancada(i, ppp) ? PESOS[i] : 0;` por `return i >= 0 && destrancada(i, ppp) ? pesosDe(c)[i] : 0;`.
3. Troque `trocasAgora` inteira por:

```ts
/** Trocas agora e quando volta a próxima (null = cheio). Cada troca gasta volta em `recargaS` (1 h sem a árvore), uma por vez. */
export function trocasAgora(c: Pick<Cadeiras, 'trocas' | 'trocas_t' | 'trocas_max' | 'recarga_s'>, agoraMs: number): { trocas: number; proximaMs: number | null } {
  const max = trocasMax(c);
  const passo = recargaS(c) * 1000;
  if (c.trocas >= max || !c.trocas_t) return { trocas: max, proximaMs: null };
  const t = Date.parse(c.trocas_t);
  const k = Math.max(0, Math.floor((agoraMs - t) / passo));
  const n = Math.min(max, c.trocas + k);
  return n >= max ? { trocas: max, proximaMs: null } : { trocas: n, proximaMs: t + (k + 1) * passo };
}
```

4. Troque `kojimaMult` e `tobyMult` por:

```ts
/** Kojima: −10% ao sentar, +50%/24 a cada hora inteira, até +40% em 24 h (× o peso); a subida × (1 + efeito da árvore). */
export function kojimaMult(p: number, desdeMs: number, tMs: number, efeito = 0): number {
  const h = Math.max(0, Math.floor((tMs - desdeMs) / H));
  return 1 + p * (-0.1 + ((0.5 * Math.min(24, h)) / 24) * (1 + efeito));
}

/** Toby Fox ("já já sai o Chapter 6"): +2% a cada hora inteira sentado, até +40% em 20 h (× o peso × (1 + efeito)). */
export function tobyMult(p: number, desdeMs: number, tMs: number, efeito = 0): number {
  const h = Math.max(0, Math.floor((tMs - desdeMs) / H));
  return 1 + p * 0.02 * Math.min(20, h) * (1 + efeito);
}
```

5. Troque `derrubada` e `derrubadaAte` por:

```ts
/** A faixa k (1, 2, …) de quem sentou em `desdeS` foi derrubada? (25%; a árvore baixa pra 15% ou 5%: o banco manda) */
export const derrubada = (uid: string, desdeS: number, k: number, chance = 0.25) => sorte(uid, 50, desdeS + k, 9) < chance;

/** Se o instante t está numa derrubada do MC V.V: o fim dela (ms); senão null. */
export function derrubadaAte(uid: string, p: number, desdeMs: number, tMs: number, chance = 0.25): number | null {
  if (p <= 0) return null;
  const passo = faixaS(p) * 1000;
  const k = Math.floor((tMs - desdeMs) / passo);
  if (k < 1) return null;
  const ini = desdeMs + k * passo;
  return tMs < ini + DERRUBADA_S * 1000 && derrubada(uid, Math.floor(desdeMs / 1000), k, chance) ? ini + DERRUBADA_S * 1000 : null;
}
```

6. Em `multProducao`, troque o corpo por:

```ts
  const e = c.efeito ?? 0; // a árvore grande (PPP 5, 9, ∞): só os bônus de produção
  let m = (1 + 0.15 * peso(c, ppp, CR) * (1 + e)) * (1 - 0.05 * peso(c, ppp, LUVA)) * (1 - 0.05 * peso(c, ppp, VSAUCE));
  const pk = peso(c, ppp, KOJIMA);
  if (pk) m *= kojimaMult(pk, sentadoDesde(c, KOJIMA)!, tMs, e);
  const pt = peso(c, ppp, TOBY);
  if (pt) m *= tobyMult(pt, sentadoDesde(c, TOBY)!, tMs, e);
  const pm = peso(c, ppp, MCVV);
  if (pm && derrubadaAte(uid, pm, sentadoDesde(c, MCVV)!, tMs, c.queda) !== null) m *= 1 - 0.1 * pm;
  return m;
```

7. Em `faixaEm`, troque `if (k < 1 || !Number.isInteger(k) || derrubada(uid, dS, k)) return null;` por `if (k < 1 || !Number.isInteger(k) || derrubada(uid, dS, k, c.queda)) return null;`.
8. Em `aoVivo`, troque a assinatura por `export function aoVivo(id: number, p: number, desdeMs: number, uid: string, agoraMs: number, c: Pick<Cadeiras, 'queda' | 'efeito'> = {}): string | null {` e, dentro: `kojimaMult(p, desdeMs, agoraMs)` → `kojimaMult(p, desdeMs, agoraMs, c.efeito)`, `derrubadaAte(uid, p, desdeMs, agoraMs)` → `derrubadaAte(uid, p, desdeMs, agoraMs, c.queda)`, `tobyMult(p, desdeMs, agoraMs)` → `tobyMult(p, desdeMs, agoraMs, c.efeito)`.

`games/idle/convidadosTela.ts`: no import de `./convidados`, troque `MAX_TROCAS, NOME_CADEIRA, PESOS,` por `NOME_CADEIRA, PESOS, pesosDe, trocasMax,`. Em `dicaConvidado`, troque `pct(PESOS[cadeira])` por `pct(p)` (o peso que veio é o da cadeira). No `renderizar` (o `c` é o `s.convidados ?? SEM` da l. 68): `${tr.trocas}/${MAX_TROCAS}` → `${tr.trocas}/${trocasMax(c)}`; `for (let k = 0; k < MAX_TROCAS; k++)` → `for (let k = 0; k < trocasMax(c); k++)`; `pct(PESOS[i])` → `pct(pesosDe(c)[i])`; `aoVivo(id, PESOS[i], desde, s.user_id, agoraMs)` → `aoVivo(id, pesosDe(c)[i], desde, s.user_id, agoraMs, c)`; `efeitosTexto(id, PESOS[i])` → `efeitosTexto(id, pesosDe(c)[i])`; `dicaConvidado(id, PESOS[i], i, viva)` → `dicaConvidado(id, pesosDe(c)[i], i, viva)`; `dicaConvidado(cv.id, PESOS[ch], ch, null)` → `dicaConvidado(cv.id, pesosDe(c)[ch], ch, null)`; `efeitosTexto(foco, PESOS[ch])` → `efeitosTexto(foco, pesosDe(c)[ch])`. A constante `SEM` (l. 14) continua com `MAX_TROCAS`: troque o `MAX_TROCAS` dela por `3`.

`games/idle/portas.ts`: no import, `destrancada, MAX_TROCAS, trocasAgora` → `destrancada, MAX_TROCAS, trocasAgora, trocasMax`; troque `trocas ${tr}/${MAX_TROCAS}` por `trocas ${tr}/${c ? trocasMax(c) : MAX_TROCAS}`.

`games/idle/bolsa.ts`: troque `contaLimite` por:

```ts
/** De onde vem o limite: "Limite: 100 + 5 Curso online + 25 do Escritório"; com a árvore grande (0082) por cima, "Limite: 760
 *  (100 + 5 Curso online + 25 do Escritório, com a árvore)". `gen` = quantos do gerador ligado (o banco manda; sem ele, a
 *  resposta é de antes da árvore e a conta sai do total). */
export function contaLimite(id: number, limite: number, escritorio: number, gen?: number): string {
  const bonus = MELHORIAS_BOLSA.escritorio.bonus[escritorio];
  const gerador = GERADORES[empresa(id).gerador - 1];
  const n = gen ?? limite - 100 - bonus;
  const conta = `100 + ${n} ${gerador}${bonus ? ` + ${bonus} do Escritório` : ''}`;
  return limite === 100 + n + bonus ? `Limite: ${conta}` : `Limite: ${limite} (${conta}, com a árvore)`;
}
```

`games/idle/bolsaTela.ts`: l. 193 `const creditos = b.info_creditos ?? 0;` → `const gratis = b.info_gratis ?? 0; // a espiada grátis do dia (árvore grande)` + `const creditos = (b.info_creditos ?? 0) + gratis;`; l. 202 `dicaEspiar(e.nome, creditos)` → `dicaEspiar(e.nome, creditos - gratis, gratis)`; l. 239 `contaLimite(m.id, m.limite, b.escritorio)` → `contaLimite(m.id, m.limite, b.escritorio, m.limite_gen)`.

`games/idle/dica.ts`: troque `dicaEspiar` por:

```ts
/** A caixinha do "Espiar" da Bolsa (0076); com a árvore grande (0082), a grátis do dia vai primeiro. */
export function dicaEspiar(nome: string, creditos: number, gratis = 0): Dica {
  const custo = gratis > 0 ? 'grátis hoje' : '1 crédito';
  const linhas: LinhaDica[] = [{ texto: `Mostra o humor de ${nome} até ele mudar · ${custo}` }, { texto: `Você tem ${creditos}`, tom: 'fraco' }];
  if (gratis > 0) linhas.push({ texto: `${gratis === 1 ? '1 grátis' : `${gratis} grátis`} hoje, da árvore`, tom: 'fraco' });
  return { titulo: 'Espiar', linhas };
}
```

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/convidados.test.ts idle/convidadosTela.test.ts idle/bolsa.test.ts idle/bolsaTela.test.ts idle/dica.test.ts idle/portas.test.ts`
Expected: PASS (se um teste antigo de `dicaEspiar` conferir as linhas inteiras com `toEqual`, ele continua igual sem grátis).

- [ ] **Step 3: Testes do banco (falham)**

No fim de `games/test/idleArvoreGrande.test.ts` (acrescente `import { derrubada, kojimaMult, multProducao, trocasAgora } from '../idle/convidados';` e `import type { BolsaEstado } from '../shared/types';`):

```ts
describe('Bolsa e PPP com a árvore grande (0082 parte D)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    // era 4 com 3 traders e F$ de sobra (a Bolsa aberta); 50 PPP Podcasts (as 3 cadeiras)
    await q(`update public.idle_state set generators[1:19] = array_fill(1, array[19]), generators[13] = 50, generators[19] = 3,
               strategies = '{0,0,0,-1,-1,-1}', valuation = 1e30 where user_id = $1`, [A]);
  });
  const bolsa = () => t.rpc<BolsaEstado>('idle_bolsa');
  const BOLSA = [1, 701, 702, 703, 704, 705, 706, 707, 708, 709, 710];
  it('limite: (100 + gerador + Escritório × 1,5 + 350) × 2 × (1 + 5% por nível); corretagem × 0,25; o banco manda o gerador', async () => {
    await q('insert into public.idle_bolsa_nivel (user_id, corretor, escritorio) values ($1, 0, 1) on conflict (user_id) do update set escritorio = 1', [A]);
    await ter([...BOLSA, 3007], { 3007: 4 });
    const b = await bolsa();
    expect(b.corretagem).toBeCloseTo(0.05 * 0.25, 12);
    for (const m of b.empresas) {
      const gen = m.limite_gen!;
      expect(m.limite, String(m.id)).toBe(Math.floor((100 + gen + 25 * 1.5 + 350) * 2 * 1.2));
    }
  });
  it('limite sem a árvore e com a Bolsa fechada (sem trader): o de sempre, sem erro', async () => {
    let b = await bolsa();
    for (const m of b.empresas) expect(m.limite).toBe(100 + m.limite_gen!);
    await q('update public.idle_state set generators[19] = 0 where user_id = $1', [A]);
    await ter(BOLSA);
    b = await bolsa();
    expect(b.aberta).toBe(false);
    expect(b.empresas.every((m) => m.limite > 100)).toBe(true);
  });
  it('espiada grátis: 2 por dia (Telegram + YouTube) antes dos créditos; a 3ª gasta o crédito; sem nada, idle_info_sem_credito', async () => {
    await ter([1, 701, 702, 703, 704, 705, 706, 707]);
    await q('update public.idle_state set info_creditos = 1 where user_id = $1', [A]);
    expect((await bolsa()).info_gratis).toBe(2); // a 1ª chamada também cria o mercado
    // o humor de todas muda daqui a bastante tempo (não "vira" agora): idle_info_vira não atrapalha
    await q('update public.idle_bolsa_mercado set humor_ate = humor_ate + 100, rj_ate = null where true');
    const empresas = (await bolsa()).empresas.map((m) => m.id);
    const espiar = (e: number) => t.rpc<{ info_creditos: number; bolsa: BolsaEstado }>('idle_bolsa_espiar', { p_empresa: e });
    let r = await espiar(empresas[0]);
    expect(r.bolsa.info_gratis).toBe(1);
    expect(r.bolsa.info_creditos).toBe(1);
    r = await espiar(empresas[1]);
    expect(r.bolsa.info_gratis).toBe(0);
    r = await espiar(empresas[2]);
    expect(r.bolsa.info_creditos).toBe(0);
    await expect(espiar(empresas[3])).rejects.toThrow(/idle_info_sem_credito/);
    // outro dia: as grátis voltam
    await q(`update public.idle_state set info_gratis_dia = public.games_today() - 1 where user_id = $1`, [A]);
    expect((await bolsa()).info_gratis).toBe(2);
  });
  it('PPP: o banco manda trocas 5 com recarga de 30 min, cadeiras 1/0,75/0,5, derrubada 5% e efeito +35%; as contas batem com convidados.ts', async () => {
    await ter([1, 801, 802, 803, 804, 805, 806, 807, 808, 809, 810]);
    const desde = Math.floor(Date.now() / 1000) - 30 * 3600;
    await q(`update public.idle_state set conv_cadeira = '{1,5,10}', conv_desde = array_fill(to_timestamp($2), array[3]),
               conv_trocas = 1, conv_trocas_t = now() - interval '45 minutes' where user_id = $1`, [A, desde]);
    const s = await t.rpc<J & { convidados: { trocas: number; trocas_t: string; trocas_max: number; recarga_s: number; pesos: number[]; queda: number; efeito: number; cadeira: (number | null)[]; desde: (string | null)[] } }>('idle_open');
    const c = s.convidados;
    expect(c).toMatchObject({ trocas_max: 5, recarga_s: 1800, pesos: [1, 0.75, 0.5], queda: 0.05 });
    expect(c.efeito).toBeCloseTo(0.35, 12);
    const agora = Date.parse((s as unknown as { server_now: string }).server_now);
    const [{ n }] = await q<{ n: number }>('select public.idle_conv_trocas(s, now()) as n from public.idle_state s where user_id = $1', [A]);
    expect(n).toBe(trocasAgora(c, agora).trocas);
    const [{ m }] = await q<{ m: number }>('select public.idle_conv_prod(s, $2::timestamptz) as m from public.idle_state s where user_id = $1',
      [A, new Date(agora).toISOString()]);
    expect(rel(m, multProducao({ c, ppp: 50, uid: A }, agora))).toBeLessThan(1e-12);
    expect(kojimaMult(0.75, desde * 1000, agora, 0.35)).toBeGreaterThan(kojimaMult(0.75, desde * 1000, agora));
    for (let k = 1; k <= 200; k++) {
      const [{ d }] = await q<{ d: boolean }>(
        'select public.idle_horta_sorte($1, 50, $2::bigint + $3, 9) < public.idle_conv_queda($1) as d', [A, desde, k]);
      expect(d, `faixa ${k}`).toBe(derrubada(A, desde, k, 0.05));
    }
  });
  it('sentar com 5 trocas cheias gasta 1 (fica 4) e marca a recarga', async () => {
    await ter([1, 801, 802, 803, 804, 805, 806, 807, 808]);
    await q(`update public.idle_state set conv_trocas = 5, conv_trocas_t = null where user_id = $1`, [A]);
    const s = await t.rpc<{ convidados: { trocas: number; trocas_t: string | null } }>('idle_conv_sentar', { p_cadeira: 1, p_convidado: 1 });
    expect(s.convidados.trocas).toBe(4);
    expect(s.convidados.trocas_t).not.toBeNull();
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts`
Expected: FAIL (limite de sempre, sem `info_gratis`/`limite_gen`, convidados sem os campos novos).

- [ ] **Step 4: 0082, parte D**

No fim da 0082, acrescente:

```sql

-- ===== parte D: Bolsa e PPP Podcast =====
-- a corretagem da Bolsa com a árvore: a do Corretor × o menor fator comprado (0,8 → 0,5 → 0,25)
create or replace function public.idle_bolsa_taxa(u uuid, p_corr int)
returns double precision language sql stable set search_path = public as $$
  select public.idle_bolsa_corretagem(p_corr) * public.idle_arv(u, 'bolsa_corretagem', 'min', 1)
$$;
revoke all on function public.idle_bolsa_taxa(uuid, int) from public, anon, authenticated;

-- o limite de ações de uma empresa (o da 0076 com a árvore): (100 + o gerador dela + o Escritório × o da árvore + os
-- "+N" dos nós) × o Lobo de Wall Street × (1 + 5% por nível do Fundo de índice), pra baixo
create or replace function public.idle_bolsa_limite(s public.idle_state, p_gerador int, p_esc int)
returns int language sql stable set search_path = public as $$
  select floor((100 + coalesce(s.generators[p_gerador], 0)
                + public.idle_bolsa_escritorio(p_esc) * public.idle_arv(s.user_id, 'bolsa_escritorio', 'max', 1)
                + public.idle_arv(s.user_id, 'bolsa_limite', 'soma', 0))
               * public.idle_arv(s.user_id, 'bolsa_limite_mult', 'max', 1)
               * (1 + public.idle_arv(s.user_id, 'bolsa_limite_soma', 'soma', 0)))::int
$$;
revoke all on function public.idle_bolsa_limite(public.idle_state, int, int) from public, anon, authenticated;

-- quantas espiadas grátis ainda tem hoje (dia de Brasília, o corte da Caixinha): as da árvore − as usadas hoje
create or replace function public.idle_bolsa_gratis(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select greatest(0, public.idle_arv(s.user_id, 'bolsa_espiadas', 'soma', 0)::int
                     - case when s.info_gratis_dia = public.games_today() then coalesce(s.info_gratis_n, 0) else 0 end)
$$;
revoke all on function public.idle_bolsa_gratis(public.idle_state) from public, anon, authenticated;
```

Copie `idle_bolsa_estado` da 0076 (l. 946–1006) e mude o comentário pra `-- o que a Bolsa mostra (o da 0076) com a árvore grande (0082): corretagem e limite com os nós, o gerador de cada limite e as espiadas grátis de hoje` e:
- `    'corretagem', public.idle_bolsa_corretagem(v_corr),` → `    'corretagem', public.idle_bolsa_taxa(p_user, v_corr),`
- `    'info_creditos', coalesce(s.info_creditos, 0),` →

```sql
    'info_creditos', coalesce(s.info_creditos, 0),
    'info_gratis', case when s.user_id is null then 0 else public.idle_bolsa_gratis(s) end,
```

- `        'limite', 100 + coalesce(s.generators[c.gerador], 0) + public.idle_bolsa_escritorio(v_esc),` →

```sql
        'limite', public.idle_bolsa_limite(s, c.gerador, v_esc),
        'limite_gen', coalesce(s.generators[c.gerador], 0),
```

Copie `idle_bolsa_negociar_em` da 0076 (l. 1008–1119) e mude o comentário (acrescente `; corretagem e limite com a árvore (0082)`) e:
- `  v_fee := 1 + public.idle_bolsa_corretagem(v_corr);` → `  v_fee := 1 + public.idle_bolsa_taxa(p_user, v_corr);`
- `    v_cabe := 100 + coalesce(s.generators[c.gerador], 0) + public.idle_bolsa_escritorio(v_esc) - v_total;` → `    v_cabe := public.idle_bolsa_limite(s, c.gerador, v_esc) - v_total;`

Copie `idle_bolsa_espiar_em` da 0076 (l. 892–932) e mude o comentário pra `-- Espiar (o da 0076): a grátis do dia (árvore grande, 0082) vai antes do crédito` e:
- no `declare`, depois de `  m public.idle_bolsa_mercado;`, acrescente `  v_gratis int;`
- o bloco `  if coalesce(s.info_creditos, 0) < 1 then` … `  end if;` (o do `idle_info_sem_credito`) vira:

```sql
  v_gratis := public.idle_bolsa_gratis(s);
  if v_gratis < 1 and coalesce(s.info_creditos, 0) < 1 then
    raise exception 'idle_info_sem_credito' using errcode = 'P0001';
  end if;
```

- `  s.info_creditos := s.info_creditos - 1;` vira:

```sql
  if v_gratis >= 1 then -- a grátis do dia primeiro (Grupo de sinais no Telegram, Analista do YouTube)
    if s.info_gratis_dia is distinct from public.games_today() then
      s.info_gratis_dia := public.games_today();
      s.info_gratis_n := 0;
    end if;
    s.info_gratis_n := coalesce(s.info_gratis_n, 0) + 1;
  else
    s.info_creditos := s.info_creditos - 1;
  end if;
```

Depois, o PPP (acrescente no fim):

```sql
-- PPP Podcast com a árvore: quantas trocas cabem (3 + Mesa de som + Pauta roubada), quanto cada uma leva pra voltar (1 h ÷
-- o Microfone de lapela/o Produtor), a chance de a faixa do MC V.V cair (25% → 15% → 5%) e o +% dos bônus de produção
create or replace function public.idle_conv_trocas_max(u uuid)
returns int language sql stable set search_path = public as $$
  select 3 + public.idle_arv(u, 'conv_trocas', 'soma', 0)::int
$$;
create or replace function public.idle_conv_recarga_s(u uuid)
returns double precision language sql stable set search_path = public as $$
  select 3600 / public.idle_arv(u, 'conv_recarga', 'max', 1)
$$;
create or replace function public.idle_conv_queda(u uuid)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(u, 'conv_queda', 'min', 0.25)
$$;
create or replace function public.idle_conv_efeito(u uuid)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(u, 'conv_efeito', 'soma', 0)
$$;
revoke all on function public.idle_conv_trocas_max(uuid) from public, anon, authenticated;
revoke all on function public.idle_conv_recarga_s(uuid) from public, anon, authenticated;
revoke all on function public.idle_conv_queda(uuid) from public, anon, authenticated;
revoke all on function public.idle_conv_efeito(uuid) from public, anon, authenticated;

-- peso do convidado c (o da 0051) com a Cadeira gamer (meio 0,75) e o Sofá (canto 0,5); lê a árvore: stable
create or replace function public.idle_conv_peso(s public.idle_state, c int)
returns double precision language sql stable set search_path = public as $$
  select coalesce((select case when i = 1 and coalesce(s.generators[13], 0) >= 1 then 1.0
                               when i = 2 and coalesce(s.generators[13], 0) >= 25 then public.idle_arv(s.user_id, 'conv_cadeira2', 'max', 0.5)
                               when i = 3 and coalesce(s.generators[13], 0) >= 50 then public.idle_arv(s.user_id, 'conv_cadeira3', 'max', 0.25)
                               else 0 end
                     from generate_subscripts(s.conv_cadeira, 1) i where s.conv_cadeira[i] = c limit 1), 0)
$$;

-- trocas em t (o da 0051) com a árvore: as gastas voltam uma a cada idle_conv_recarga_s, até idle_conv_trocas_max
create or replace function public.idle_conv_trocas(s public.idle_state, t timestamptz)
returns int language sql stable set search_path = public as $$
  with k as (select public.idle_conv_trocas_max(s.user_id) as mx, public.idle_conv_recarga_s(s.user_id) as rs)
  select case when s.conv_trocas >= k.mx or s.conv_trocas_t is null then k.mx
              else least(k.mx, s.conv_trocas + greatest(0, floor(extract(epoch from t - s.conv_trocas_t) / k.rs))::int) end
    from k
$$;

-- multiplicador da produção em t (o da 0052) com o efeito da árvore nos bônus de produção (o +15% do Cristiano, a subida
-- do Kojima, o +2%/h do Toby); os de baixa (Luva, VSauce, o −10% do Kojima, a derrubada) não mudam. Igual a
-- convidados.ts multProducao
create or replace function public.idle_conv_prod(s public.idle_state, t timestamptz)
returns double precision language plpgsql stable set search_path = public as $$
declare
  pk double precision := public.idle_conv_peso(s, 5);
  pt double precision := public.idle_conv_peso(s, 10);
  pm double precision := public.idle_conv_peso(s, 9);
  e  double precision := public.idle_conv_efeito(s.user_id);
  m  double precision;
begin
  m := (1 + 0.15 * public.idle_conv_peso(s, 1) * (1 + e)) * (1 - 0.05 * public.idle_conv_peso(s, 4)) * (1 - 0.05 * public.idle_conv_peso(s, 11));
  if pk > 0 then
    m := m * (1 + pk * (-0.10 + 0.50 * least(24, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 5)) / 3600))) / 24 * (1 + e)));
  end if;
  if pt > 0 then
    m := m * (1 + pt * 0.02 * least(20, greatest(0, floor(extract(epoch from t - public.idle_conv_desde(s, 10)) / 3600))) * (1 + e));
  end if;
  if pm > 0 and public.idle_conv_derrubada_ate(s, t) is not null then
    m := m * (1 - 0.10 * pm);
  end if;
  return m;
end;
$$;

-- os efeitos agora (o da 0051) + o que a árvore muda nas cadeiras e nas trocas (a página só mostra)
create or replace function public.idle_conv_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'cadeira', to_jsonb(s.conv_cadeira),
    'desde', to_jsonb(s.conv_desde),
    'trocas', s.conv_trocas,
    'trocas_t', s.conv_trocas_t,
    'ppp', coalesce(s.generators[13], 0),
    'derrubada_ate', public.idle_conv_derrubada_ate(s, now()),
    'trocas_max', public.idle_conv_trocas_max(s.user_id),
    'recarga_s', public.idle_conv_recarga_s(s.user_id),
    'pesos', jsonb_build_array(1, public.idle_arv(s.user_id, 'conv_cadeira2', 'max', 0.5), public.idle_arv(s.user_id, 'conv_cadeira3', 'max', 0.25)),
    'queda', public.idle_conv_queda(s.user_id),
    'efeito', public.idle_conv_efeito(s.user_id))
$$;
```

Copie `idle_conv_derrubada_ate` (0051 l. 63–89), `idle_conv_derrubadas` (0051 l. 162–181), `idle_conv_mudancas` (**0052** l. 42–79) e `idle_conv_faixa` (0076 l. 62–85, com o `revoke` da l. 85) e, em cada uma: troque `immutable` por `stable` na linha do `returns`; troque o `< 0.25` do sorteio da derrubada por `< public.idle_conv_queda(s.user_id)`; acrescente no fim do comentário de cima `(0082: a chance da árvore)`.

Copie `idle_conv_sentar` da 0051 (l. 207–281 e o `revoke`/`grant` das l. 308–309) e mude:
- no `declare`, acrescente `  v_rs   double precision;`
- `  v_n := public.idle_conv_trocas(s, now());` →

```sql
  v_n := public.idle_conv_trocas(s, now());
  v_rs := public.idle_conv_recarga_s(v_me); -- 0082: a recarga da árvore
```

- `  if v_n >= 3 then` / `    s.conv_trocas := 2;` → `  if v_n >= public.idle_conv_trocas_max(v_me) then` / `    s.conv_trocas := v_n - 1;`
- `    v_k := greatest(0, floor(extract(epoch from now() - s.conv_trocas_t) / 3600))::int;` → `    v_k := greatest(0, floor(extract(epoch from now() - s.conv_trocas_t) / v_rs))::int;`
- `    s.conv_trocas_t := s.conv_trocas_t + make_interval(hours => v_k);` → `    s.conv_trocas_t := s.conv_trocas_t + make_interval(secs => v_k * v_rs);`


- [ ] **Step 5: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleConvidados.test.ts test/idleBolsa.test.ts test/idleDouradosCaixinha.test.ts test/idleParidade.test.ts test/idleDesempenho.test.ts idle/convidados.test.ts idle/bolsa.test.ts idle/convidadosTela.test.ts idle/bolsaTela.test.ts`
Expected: PASS (sem nó, todas as contas dos convidados e da Bolsa são as de sempre).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0082_fellas_inc_arvore_grande.sql games/shared/types.ts games/idle/convidados.ts games/idle/convidadosTela.ts games/idle/portas.ts games/idle/bolsa.ts games/idle/bolsaTela.ts games/idle/dica.ts games/idle/convidados.test.ts games/idle/bolsa.test.ts games/test/idleArvoreGrande.test.ts
git commit -m "Fellas Inc.: Bolsa e PPP Podcast com a árvore grande (limite, corretagem, espiada grátis, trocas, cadeiras, derrubada, efeito) (0082, parte D)"
```

---
### Task 8: Mapa, Camisetaria, Copão e os eventos do Espaço com a árvore grande (0082, parte E)

**Files:**
- Modify: `supabase/migrations/0082_fellas_inc_arvore_grande.sql` (parte E)
- Modify: `games/shared/types.ts` (`LugarEstado`, l. ~246)
- Modify: `games/idle/mapa.ts` (`multMapa`, l. 54–56), `games/idle/camisetariaTela.ts` (l. 427 e 526), `games/idle/copaoTela.ts` (l. 729 e 844), `games/idle/dica.ts` (`dicaTeeLote`, `dicaCupPreco`, `dicaEventoEra`, a linha do Silver em `dicaProducao`)
- Modify: `games/idle/eventosEra.ts` (l. 17–25, 35–47, 74–96), `games/idle/eventoEraTela.ts` (l. 89–90, 110, 185–186, 204–214, 286), `games/idle/store.ts` (`fatoresTempo`, `valuationAgora`), `games/idle/main.ts` (l. ~328, ~620, ~745–761), `games/idle/tela.ts:1140`
- Modify: `games/idle/eventosEra.test.ts`, `games/idle/eventoEraTela.test.ts`, `games/test/idleArvoreGrande.test.ts`, `games/test/idleMapa.test.ts`, `games/test/idleCamisetaria.test.ts`, `games/test/idleCopao.test.ts`

**Interfaces:**
- Consumes: `idle_arv` com nível (Task 3); efeitos `mapaAbrir`, `mapaNivel`, `marcosMult`, `marcosSoma`, `teePublico`, `teeTempo`, `copaoMult`, `lixoMin`, `silverMin`, `silverMult`, `eraFreq`, `eraJanela` (Task 3).
- Produces: banco: `idle_mapa_json` (preço e `horas` com o desconto), `idle_place_abrir`, `idle_place_nivel`, `idle_lugar_json` (`preco_nivel` com desconto, `venda_min`, `copao_mult`), `idle_place_mult` (marcos × árvore), `idle_tee_lancar` (procura × público, fim × tempo), `idle_cup_noite_andar` (fichas × Copão), `idle_evento_era` (stable, a 2ª chance do TARS), `idle_evento_pegar` (Lixo, Silver, janela × 2, aceita até 120 s), `idle_settle` (Silver × o da árvore). Página: `eventoEraEm(uid, s, era, freq = 1)`; `type EventoArvore = { lixoMin: number; silverMin: number; silverMult: number }`, `EVENTO_PADRAO`; `ganhoEventoAgora(tipo, rate, ev = EVENTO_PADRAO)`; `textoEventoPegou(e, ev = EVENTO_PADRAO)`; `dicaEventoEra(tipo, rate, ev = EVENTO_PADRAO)`; `fatoresTempo(s, silverMult = SILVER_MULT)`; `eventosEra.mostrar({ seg, tipo, agoraMs, janelaS? })`; `multMapa(bonus, abertos, est, arvore = 1)`; `dicaTeeLote(peca, nivel, lote, vendaMs = VENDA_MS)`; `dicaCupPreco(c, mult = 1)`; `LugarEstado.venda_min?`/`copao_mult?`.

- [ ] **Step 1: Testes da página (falham)**

No fim de `games/idle/eventosEra.test.ts` (acrescente no import de `./eventosEra` o que faltar de `EVENTO_PADRAO, eventoEraEm, ganhoEventoAgora, textoEventoPegou`):

```ts
describe('eventos de era com a árvore grande (Espaço; igual a idle_evento_era/idle_evento_pegar na 0082)', () => {
  it('TARS (1,5×): os segundos de sempre continuam, com ~50% a mais, os mesmos tipos nos de sempre', () => {
    let base = 0;
    let mais = 0;
    for (let s = 1_760_000_000; s < 1_760_000_000 + 400_000; s++) {
      const a = eventoEraEm('u', s, 7);
      const b = eventoEraEm('u', s, 7, 1.5);
      if (a !== null) {
        base++;
        expect(b).toBe(a);
      }
      if (b !== null) mais++;
    }
    expect(mais / base).toBeGreaterThan(1.3);
    expect(mais / base).toBeLessThan(1.7);
  });
  it('Lixo 15 min por destroço; Silver 3 min ×5: o que dá agora e o texto', () => {
    const ev = { lixoMin: 15, silverMin: 3, silverMult: 5 };
    expect(ganhoEventoAgora(6, 10, ev)).toBe(10 * 900);
    expect(ganhoEventoAgora(7, 10, ev)).toBe(10 * 180 * 4);
    expect(ganhoEventoAgora(6, 10)).toBe(10 * 600);
    expect(EVENTO_PADRAO).toEqual({ lixoMin: 10, silverMin: 2, silverMult: 4 });
    expect(textoEventoPegou({ tipo: 7, premio: null, ganho: 0, gols: 0 }, ev)).toBe('Consertado com silver tape! ×5 por 3 min');
    expect(textoEventoPegou({ tipo: 7, premio: null, ganho: 0, gols: 0 })).toBe('Consertado com silver tape! ×4 por 2 min');
  });
});
```


No fim do `describe('eventos de era na tela')` de `games/idle/eventoEraTela.test.ts` (o `opcoes()` é o do arquivo):

```ts
  it('janela da árvore (Ancoragem manual): o evento fica o dobro e o destroço anda na metade da velocidade', () => {
    const raiz = document.createElement('div');
    const t = criarEventoEraTela(raiz, opcoes());
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000, janelaS: 20 });
    const caixa = raiz.querySelector<HTMLElement>('.evento-era')!;
    expect(caixa.style.getPropertyValue('--janela')).toBe('20s');
    expect(raiz.querySelector<HTMLElement>('.evento-destroco')!.style.getPropertyValue('--passo')).toBe(`${Math.round(20_000 / 3)}ms`);
    t.tick(115_000);
    expect(raiz.querySelector('.evento-era')).not.toBeNull(); // sem a árvore já teria saído (10 s)
    t.tick(120_001);
    expect(raiz.querySelector('.evento-era')).toBeNull();
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/eventosEra.test.ts idle/eventoEraTela.test.ts`
Expected: FAIL.

- [ ] **Step 2: A página dos eventos**

`eventosEra.ts`:
1. Depois de `export const SILVER_S = 120;`, acrescente:

```ts
/** O que a árvore grande muda nos eventos (o Espaço): minutos por destroço, minutos e × do Silver tape. Os campos têm os
 *  nomes de EfeitosArvore: dá pra passar os efeitos direto. */
export type EventoArvore = { lixoMin: number; silverMin: number; silverMult: number };
export const EVENTO_PADRAO: EventoArvore = { lixoMin: DESVIO_S / 60, silverMin: SILVER_S / 60, silverMult: SILVER_MULT };
```

2. Troque `eventoEraEm` inteira por:

```ts
/** O evento de era do segundo `s` pra quem está na era `era`, ou null. `freq` (o TARS da árvore, 1,5): uma 2ª chance de
 *  1 em 3600 a cada 0,5 a mais no mesmo número (igual a idle_evento_era na 0082). */
export function eventoEraEm(uid: string, s: number, era: number, freq = 1): TipoEventoEra | null {
  const h = h2(uid, s);
  if (h % BigInt(CHANCE_EVENTO) !== 0n && !(freq > 1 && Number(mistura(h + 777n) % 3600n) < Math.round(2 * (freq - 1)))) return null;
  const ate = Math.max(1, Math.min(era, ULTIMA_ERA_COM_EVENTO));
  const total = ate - 1 + 3; // os antigos pesam 1, o da sua era 3
  let r = Number(mistura(h) % BigInt(total));
  for (let e = 1; e <= ate; e++) {
    r -= e === ate ? 3 : 1;
    if (r < 0) return e as TipoEventoEra;
  }
  return ate as TipoEventoEra;
}
```

3. Troque `ganhoEventoAgora` por:

```ts
/** Quanto entra em F$ na hora, com a produção `rate` de agora: Shopee (se sair F$), a call, 1 gol, 1 destroço desviado; no
 *  Houston, o que o Silver tape dá a mais enquanto dura. `ev`: o que a árvore muda (o Espaço). */
export function ganhoEventoAgora(tipo: TipoEventoEra, rate: number, ev: EventoArvore = EVENTO_PADRAO): number {
  if (tipo === 2) return rate * 3600 * 0.8;
  if (tipo === 3) return rate * 1800;
  if (tipo === 5) return rate * 300;
  if (tipo === 6) return rate * 60 * ev.lixoMin;
  if (tipo === 7) return rate * 60 * ev.silverMin * (ev.silverMult - 1);
  return 0;
}
```

4. Em `textoEventoPegou`, troque a assinatura por `export function textoEventoPegou(e: EventoPago, ev: EventoArvore = EVENTO_PADRAO): string {` e a linha do tipo 7 por `  if (e.tipo === 7) return \`Consertado com silver tape! ×${num(ev.silverMult)} por ${num(ev.silverMin)} min\`;`, com `const num = (x: number) => x.toLocaleString('pt-BR');` logo acima da função.

`eventoEraTela.ts`:
1. Troque `export const PASSO_DESTROCO_MS = (JANELA_EVENTO_S[6] * 1000) / MAX_DESVIOS;` e a linha do `destrocoDe` por:

```ts
/** Lixo espacial: cada destroço atravessa em um terço da janela, um depois do outro (a janela pode vir dobrada da árvore). */
export const PASSO_DESTROCO_MS = (JANELA_EVENTO_S[6] * 1000) / MAX_DESVIOS;
const destrocoDe = (seg: number, agoraMs: number, passoMs: number) => Math.max(0, Math.floor((agoraMs - seg * 1000) / passoMs));
```

2. No tipo do `atual` (l. 110), acrescente `passoMs: number;` (depois de `passo: number;`).
3. `lancarDestroco` (l. 172) ganha o parâmetro `passoMs: number` no fim (`function lancarDestroco(caixa: HTMLElement, seg: number, i: number, agoraMs: number, passoMs: number) {`) e usa ele no lugar de `PASSO_DESTROCO_MS` (as duas vezes); as chamadas viram `lancarDestroco(caixa, e.seg, passo, e.agoraMs, passoMs);` (l. 244, no `mostrar`) e `lancarDestroco(atual.caixa, atual.seg, i, agoraMs, atual.passoMs);` (l. 289, no `tick`).
4. Em `mostrar`, troque a assinatura por `mostrar(e: { seg: number; tipo: TipoEventoEra; agoraMs: number; janelaS?: number }) {` e as primeiras linhas por:

```ts
      const janela = e.janelaS ?? JANELA_EVENTO_S[e.tipo]; // a Ancoragem manual (0082) dobra
      const ateMs = (e.seg + janela) * 1000;
      if (atual || encerrados.has(e.seg) || e.agoraMs >= ateMs) return;
      const caixa = document.createElement('div');
      caixa.className = `evento-era evento-era-${e.tipo}`;
      caixa.style.setProperty('--janela', `${janela}s`);
      caixa.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      const passoMs = (janela * 1000) / MAX_DESVIOS;
      const passo = e.tipo === 5 ? passoDe(e.seg, e.agoraMs) : e.tipo === 6 ? destrocoDe(e.seg, e.agoraMs, passoMs) : 0;
```

   e, na linha `atual = { seg: e.seg, tipo: e.tipo, ateMs, caixa, gols: 0, passo, pos: … };`, acrescente `passoMs` depois de `passo`.
5. No `tick` (l. ~286), troque `const i = destrocoDe(atual.seg, agoraMs);` por `const i = destrocoDe(atual.seg, agoraMs, atual.passoMs);`.

`store.ts`: troque a assinatura de `fatoresTempo` por `export function fatoresTempo(s: Pick<IdleState, 'linkedin_ate' | 'linkedin_mult' | 'combo_ate' | 'silver_ate'>, silverMult = SILVER_MULT): FatorTempo[] {` e a linha do Silver por `  if (s.silver_ate) out.push({ ateMs: Date.parse(s.silver_ate), mult: silverMult }); // ×5 com a Fita prateada (0082)`; em `valuationAgora`, troque `fatoresTempo(a.estado)` por `fatoresTempo(a.estado, efeitos(a.estado).silverMult)`.

`main.ts`:
- l. ~328: `textoEventoPegou(s.evento)` → `textoEventoPegou(s.evento, efeitos(s))`.
- l. ~620 (o `__mostrarEventoEra` do dev): `tela.eventosEra.mostrar({ seg, tipo, agoraMs: agoraSrv() });` → `tela.eventosEra.mostrar({ seg, tipo, agoraMs: agoraSrv(), janelaS: JANELA_EVENTO_S[tipo] * (ancora ? efeitos(ancora.estado).eraJanela : 1) });`
- no laço dos eventos de era (l. ~757–761), troque:

```ts
    // eventos de era: olha 30 s pra trás (a janela mais longa); um por vez, e não no segundo de um dourado
    for (let x = Math.max(segVistoEra + 1, seg - 29); x <= seg; x++) {
      const t = eventoEraEm(ancora.estado.user_id, x, ancora.estado.era);
      if (t !== null && !eventoEm(ancora.estado, x) && !tela.eventosEra.ativo()) {
        tela.eventosEra.mostrar({ seg: x, tipo: t, agoraMs });
```

   por:

```ts
    // eventos de era: olha pra trás a janela mais longa (30 s; 60 com a Ancoragem manual); um por vez, e não no segundo de
    // um dourado; o TARS (0082) põe mais segundos na roda
    const efe = efeitos(ancora.estado);
    for (let x = Math.max(segVistoEra + 1, seg - (30 * efe.eraJanela - 1)); x <= seg; x++) {
      const t = eventoEraEm(ancora.estado.user_id, x, ancora.estado.era, efe.eraFreq);
      if (t !== null && !eventoEm(ancora.estado, x) && !tela.eventosEra.ativo()) {
        tela.eventosEra.mostrar({ seg: x, tipo: t, agoraMs, janelaS: JANELA_EVENTO_S[t] * efe.eraJanela });
```

- no import de `./eventosEra`, acrescente `JANELA_EVENTO_S`.

`tela.ts:1140`: `dicaEventoEra(tipo, ultimo.estado.rate)` → `dicaEventoEra(tipo, ultimo.estado.rate, efeitosDe(catalogo, ultimo.estado))`.

`dica.ts`:
- no import de `./eventosEra`, acrescente `EVENTO_PADRAO, type EventoArvore`;
- troque `dicaEventoEra` inteira por:

```ts
/** A caixinha do evento de era na tela: o que ele dá agora, nos números da pessoa (com o que a árvore muda no Espaço). */
export function dicaEventoEra(tipo: TipoEventoEra, rate: number, ev: EventoArvore = EVENTO_PADRAO): Dica {
  const g = ganhoEventoAgora(tipo, rate, ev);
  const linhas: LinhaDica[] =
    tipo === 1 ? [{ texto: 'Produção ×3 por 3 min' }]
    : tipo === 2 ? [{ texto: `Sorteio: ${formatarValor(g)} (1 h, menos a Taxa das blusinhas), Promoção por 1 min ou ×5 por 2 min` }]
    : tipo === 3 ? [{ texto: `Dá ${formatarValor(g)} agora` }, { texto: '30 min da sua produção', tom: 'fraco' }]
    : tipo === 4 ? [{ texto: 'Melhorias 25% mais baratas por 2 min' }]
    : tipo === 5 ? [{ texto: `Cada gol: ${formatarValor(g)} (até 7)` }, { texto: '5 min da sua produção por gol', tom: 'fraco' }]
    : tipo === 6 ? [{ texto: `Cada destroço desviado: ${formatarValor(g)} (até ${MAX_DESVIOS})` }, { texto: `${num(ev.lixoMin)} min da sua produção por destroço`, tom: 'fraco' }]
    : [{ texto: `Produção ×${num(ev.silverMult)} por ${num(ev.silverMin)} min: +${formatarValor(g)} a mais` }, { texto: `Pegar outro com um valendo soma ${num(ev.silverMin)} min`, tom: 'fraco' }];
  return { titulo: NOME_EVENTO_ERA[tipo], linhas };
}
```

- em `dicaProducao`, troque `` `Agora: ×${SILVER_MULT} do Silver tape` `` por `` `Agora: ×${num(efeitosDe(catalogo, s).silverMult)} do Silver tape` `` (se `SILVER_MULT` ficar sem uso no arquivo, tire do import).

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/eventosEra.test.ts idle/eventoEraTela.test.ts idle/store.test.ts idle/dica.test.ts idle/tela.test.ts`
Expected: PASS.

- [ ] **Step 3: A página do Mapa, da Camisetaria e do Copão**

`games/shared/types.ts`, `LugarEstado`: troque `marcos: number[]; preco_nivel: number | null;` por `marcos: number[]; preco_nivel: number | null; /** árvore grande (0082): quanto a Camisetaria leva pra vender (min) e o × das fichas do Copão */ venda_min?: number; copao_mult?: number;`.

`games/idle/mapa.ts`: troque `multMapa` por:

```ts
/** O multiplicador dos lugares (igual a idle_place_mult na 0082): 1 + Σ marcos × Monopólio × a árvore (Check-in, Rolê que
 *  virou lenda, Rolê infinito) + Marca forte por lugar aberto. */
export function multMapa(bonusMarcos: number, abertos: number, est: { marcosMult: number; porLugar: number }, arvore = 1): number {
  return 1 + bonusMarcos * est.marcosMult * arvore + abertos * est.porLugar;
}
```

`games/idle/camisetariaTela.ts`: logo depois de `const nivelAtual = () => ultimo?.l.nivel ?? 1;` (l. 259), acrescente `const vendaMs = () => (ultimo?.l.venda_min ? ultimo.l.venda_min * 60_000 : VENDA_MS); // o Drop esgotado (0082) corta pela metade`; na l. 427, `dicaTeeLote(sel.peca, nivelAtual(), k)` → `dicaTeeLote(sel.peca, nivelAtual(), k, vendaMs())`; na l. 526, `duracao(VENDA_MS)` → `duracao(vendaMs())`.

`games/idle/copaoTela.ts`: l. 844 `const lucro = lucroVenda(sel);` → `const lucro = lucroVenda(sel) * (ultimo?.l.copao_mult ?? 1); // o Open bar / o After (0082) nas fichas`; l. 729 `dicaCupPreco(sel)` → `dicaCupPreco(sel, ultimo?.l.copao_mult ?? 1)`.

`games/idle/dica.ts`: em `dicaTeeLote`, troque a assinatura por `export function dicaTeeLote(peca: number, nivel: number, lote: 0 | 1 | 2, vendaMs = VENDA_MS): string {` e `vende em ${duracao(VENDA_MS)}` por `vende em ${duracao(vendaMs)}`; em `dicaCupPreco`, troque a assinatura por `export function dicaCupPreco(c: { base: number; tamanho: number; forca: number; preco: number }, mult = 1): string {` e `const lucro = lucroVendaCup(c);` por `const lucro = lucroVendaCup(c) * mult;`.

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/mapa.test.ts idle/camisetariaTela.test.ts idle/copaoTela.test.ts idle/dica.test.ts`
Expected: PASS.

- [ ] **Step 4: Testes do banco (falham)**

No fim de `games/test/idleArvoreGrande.test.ts` (acrescente `import { eventoEraEm } from '../idle/eventosEra';`):

```ts
describe('os eventos do Espaço com a árvore grande (0082 parte E)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('TARS (1,5×): os mesmos segundos e tipos que eventoEraEm(…, 1,5) em 60 mil segundos', async () => {
    await ter([1, 1001, 1002, 1003, 1004, 1005]);
    const ini = 1_760_000_000;
    // 60 mil segundos (cada segundo sem sorte consulta a árvore: 200 mil deixaria o teste lento)
    const sql = await q<{ s: string; e: number }>(
      `select s::text, e from (select s, public.idle_evento_era($1::uuid, s, 7) as e from generate_series($2::bigint, $3::bigint) s) x
        where e is not null order by s`, [A, ini, ini + 60_000 - 1]);
    const ts: { s: string; e: number }[] = [];
    for (let s = ini; s < ini + 60_000; s++) {
      const e = eventoEraEm(A, s, 7, 1.5);
      if (e !== null) ts.push({ s: String(s), e });
    }
    expect(ts.length).toBeGreaterThan(40);
    expect(sql).toEqual(ts);
  });
});

describe('pegar os eventos do Espaço com a árvore grande (0082 parte E)', () => {
  type JE = J & { silver_ate: string | null; evento: { tipo: number; ganho: number; gols: number } };
  const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
  const evento = (seg: number, tipo: number) => q('insert into public.teste_evento_arv values ($1, $2)', [seg, tipo]);
  const pegar = (seg: number, gols = 0) => t.rpc<JE>('idle_evento_pegar', { p_seg: seg, p_gols: gols, p_tipo: null });
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
  const taxaA = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
  const ESPACO = [1, 1001, 1002, 1003, 1004, 1005, 1006, 1007, 1008, 1009];

  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.db.exec(`
      create table public.teste_evento_arv (s bigint, tipo int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select x.tipo from public.teste_evento_arv x where x.s = idle_evento_era.s limit 1';`);
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e12, generators[1:42] = array_fill(1, array[42]), strategies = '{0,0,0,0,0,0}',
               settled_at = now() + interval '1 day' where user_id = $1`, [A]);
    await ter(ESPACO);
  });
  it('Lixo: 15 min de produção por destroço com o Treino na NASA', async () => {
    const seg = await agoraSeg();
    await evento(seg, 6);
    const r = await taxaA();
    const antes = await valor();
    expect((await pegar(seg, 2)).valuation - antes).toBeCloseTo(r * 900 * 2, 0);
  });
  it('Houston: o Silver tape dura 3 min e outro soma 3 min no fim', async () => {
    const seg = await agoraSeg();
    await evento(seg, 7);
    const s = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(s.silver_ate!) - agora).toBeCloseTo(180_000, -3);
    await evento(seg - 1, 7);
    expect(Date.parse((await pegar(seg - 1)).silver_ate!) - agora).toBeCloseTo(360_000, -3);
  });
  it('Fita prateada industrial: fechar a conta com o Silver tape vale ×5', async () => {
    await q(`update public.idle_state set settled_at = now(), silver_ate = now() + interval '40 seconds' where user_id = $1`, [A]);
    const r = await taxaA();
    const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
      `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
         from public.idle_state s where user_id = $1`, [A]);
    expect(v1 - v0).toBeCloseTo(r * (40 * 5 + 60), 0);
  });
  it('Ancoragem manual: a janela dobra (Lixo 20 + 3 s; Jogo do Brasil 60 + 3 s, aceito até 120 s de agora)', async () => {
    const seg = await agoraSeg();
    await evento(seg - 21, 6); // 21 s < 23 s
    await expect(pegar(seg - 21, 1)).resolves.toBeTruthy();
    await evento(seg - 25, 6);
    await expect(pegar(seg - 25, 1)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 61, 5); // o Jogo do Brasil: 61 s < 63 s
    await expect(pegar(seg - 61, 1)).resolves.toBeTruthy();
  });
});

describe('Mapa do rolê com a árvore grande (0082 parte E)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e30, generators[1:13] = array_fill(1, array[13]), strategies = '{0,0,-1,-1,-1,-1}'
              where user_id = $1`, [A]);
  });
  it('abrir lugar 50% mais barato (e as horas da caixinha); subir nível 40% mais barato; venda em 15 min; Copão ×1,5', async () => {
    await ter([1, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910]);
    const [{ j, r }] = await q<{ j: { lugares: { id: number; preco: number; horas: number }[] }; r: number }>(
      'select public.idle_mapa_json(s) as j, public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
    const tee = j.lugares.find((l) => l.id === 3)!;
    expect(rel(tee.preco, 2 * 3600 * r * 0.5)).toBeLessThan(1e-12);
    expect(tee.horas).toBeCloseTo(1, 12);
    const s = await t.rpc<J & { mapa: unknown }>('idle_place_abrir', { p_lugar: 3 });
    expect(s.valuation).toBeLessThan(1e30);
    await q('update public.idle_place_state set nivel = 2 where user_id = $1 and lugar = 3', [A]);
    const [{ l }] = await q<{ l: { preco_nivel: number; venda_min: number; copao_mult: number } }>(
      'select public.idle_lugar_json(s, 3) as l from public.idle_state s where user_id = $1', [A]);
    expect(rel(l.preco_nivel, 450 * 1.55 * 0.6)).toBeLessThan(1e-12);
    expect(l.venda_min).toBeCloseTo(15, 12);
    expect(l.copao_mult).toBe(1.5);
  });
});
```

Em `games/test/idleMapa.test.ts`, depois do teste `'paridade do mult com mapa.ts: …'` (l. 186–197), acrescente:

```ts
  it('paridade do mult com a árvore grande: marcos × 1,5 (Rolê que virou lenda) × (1 + 3% por nível do Rolê infinito)', async () => {
    await lancarJantar();
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    await q(`update public.idle_place_state set marcos = '{31,32,41}' where user_id = $1 and lugar in (3, 4)`, [A]);
    await q(`update public.idle_state set strategies = '{0,2,1,0}' where user_id = $1`, [A]);
    await q('insert into public.idle_arvore (user_id, no_id, nivel) select $1, unnest($2::int[]), 1', [A, [1, 901, 902, 903, 904, 905, 906, 907, 908]]);
    await q('insert into public.idle_arvore (user_id, no_id, nivel) values ($1, 3009, 5)', [A]);
    const [{ m }] = await q<{ m: number }>('select public.idle_place_mult(s) as m from public.idle_state s where user_id = $1', [A]);
    expect(m).toBeCloseTo(multMapa(0.12, 3, { marcosMult: 2, porLugar: 0.05 }, 1.5 * 1.15));
  });
```

Em `games/test/idleCamisetaria.test.ts`, depois do teste `'lote pequeno 2 min, grande 10 min; …'`, acrescente:

```ts
  it('árvore grande (0082): o Influencer de bairro põe +15% na procura gravada; o Drop esgotado vende em 15 min', async () => {
    await camisetaria(1e6, 4);
    await q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [A, [1, 901, 902, 903, 904, 905, 906, 907, 908, 909]]);
    await lancar({ lote: 2, peca: 3, tema: 9 });
    const [c] = await colecoes();
    expect(c.fim_em.getTime() - c.pronta_em.getTime()).toBe(15 * MIN);
    const [{ f }] = await q<{ f: number }>('select fas as f from public.idle_place_state where user_id = $1 and lugar = 3', [A]);
    const l: Lancamento = { id: c.id, tema: 9, estilo: 1, peca: 3, cor: 1, foco: [3, 5, 2], lote: 2, nivel: 4, fas: f, tendencia: c.tendencia, ultimas: [] };
    expect(rel(c.procura, procura(l, notas(l)) * 1.15)).toBeLessThan(1e-9);
  });
```

Em `games/test/idleCopao.test.ts`, no `describe('as noites do bar (avancar)')`, depois do 1º teste:

```ts
  it('árvore grande (0082): o After até o sol nascer (×1,5) multiplica as fichas da noite, não as vendas', async () => {
    await bar();
    await por({ nome: 'Um' });
    await setFas(50);
    await q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [A, [1, 901, 902, 903, 904, 905, 906, 907, 908, 909, 910]]);
    const cs = await copoes();
    const ini = inicioNoite(iso(agora).slice(0, 10));
    ir(ini + 4 * H);
    await lugar();
    const tot = totaisTs(cs, { nivel: 1, galera: 50, sexta: false, dj: null });
    const ks = await noiteCopoes(ini);
    juntos(ks.map((k) => k.vendidos), tot.map((x) => vendidoNaNoite(x, ini, agora)));
    juntos(ks.map((k) => k.fichas), tot.map((x, i) => vendidoNaNoite(x, ini, agora) * lucroVenda(cs[i]) * 1.5));
  });
```

(Os helpers `camisetaria`, `lancar`, `colecoes`, `Lancamento`, `procura`, `notas`, `MIN`, `rel` e `bar`, `por`, `setFas`, `copoes`, `inicioNoite`, `iso`, `agora`, `ir`, `lugar`, `totaisTs`, `noiteCopoes`, `juntos`, `vendidoNaNoite`, `lucroVenda` são os desses arquivos. Se o Mapa abrir por um caminho de era que o arquivo monta diferente, siga o que o teste vizinho faz.)

Run: `cd games && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleMapa.test.ts test/idleCamisetaria.test.ts test/idleCopao.test.ts`
Expected: FAIL.

- [ ] **Step 5: 0082, parte E**

No fim da 0082, acrescente o cabeçalho:

```sql

-- ===== parte E: Mapa do rolê, Camisetaria, Copão e os eventos do Espaço =====
```

Mapa, Camisetaria e Copão (copiar a função inteira, mudar só isto; acrescente `(0082: a árvore grande)` no fim do comentário de cada uma):
- `idle_mapa_json` (0066 l. 102–123 e o `revoke` da l. 198): `'horas', c.horas,` → `'horas', c.horas * public.idle_arv(s.user_id, 'mapa_abrir', 'min', 1),`; `'preco', case when s.started then c.horas * 3600 * public.idle_rate(s) else 0 end,` → `'preco', case when s.started then c.horas * 3600 * public.idle_rate(s) * public.idle_arv(s.user_id, 'mapa_abrir', 'min', 1) else 0 end,`
- `idle_place_abrir` (0066 l. 160–196 e o `revoke`/`grant` das l. 201–202): `  v_preco := c.horas * 3600 * public.idle_rate(s);` → `  v_preco := c.horas * 3600 * public.idle_rate(s) * public.idle_arv(s.user_id, 'mapa_abrir', 'min', 1);`
- `idle_place_mult` (0066 **l. 207–221**, a 2ª da 0066, e o `revoke` da l. 392): depois das duas linhas do `marcosMult` (`         * coalesce((select max((x.sociais ->> 'marcosMult')::double precision) from est x` / `                      where (x.sociais ->> 'marcosMult') is not null), 1)`), acrescente a linha `         * public.idle_arv(s.user_id, 'marcos_mult', 'max', 1) * (1 + public.idle_arv(s.user_id, 'marcos_soma', 'soma', 0))`
- `idle_place_nivel` (0066 l. 271–301 e o `revoke`/`grant` das l. 398–399): `  v_custo := c.custo_base * power(1.55, st.nivel - 1);` → `  v_custo := c.custo_base * power(1.55, st.nivel - 1) * public.idle_arv(s.user_id, 'mapa_nivel', 'min', 1);`
- `idle_lugar_json` (0066 **l. 613–642**, a 2ª da 0066, e o `revoke` da l. 795): `    'preco_nivel', case when st.nivel < 25 then c.custo_base * power(1.55, st.nivel - 1) end,` → `    'preco_nivel', case when st.nivel < 25 then c.custo_base * power(1.55, st.nivel - 1) * public.idle_arv(s.user_id, 'mapa_nivel', 'min', 1) end,`; e `    'server_now', now())` →

```sql
    'venda_min', 30 * public.idle_arv(s.user_id, 'tee_tempo', 'min', 1),
    'copao_mult', public.idle_arv(s.user_id, 'copao_mult', 'max', 1),
    'server_now', now())
```

- `idle_tee_lancar` (0069 l. 38–126 e o `revoke`/`grant` das l. 162–163): `          public.idle_tee_procura(st.nivel, p_peca, st.fas, v_notas), public.idle_tee_pct_procura(st.nivel, p_peca, st.fas, v_notas),` → `          public.idle_tee_procura(st.nivel, p_peca, st.fas, v_notas) * public.idle_arv(s.user_id, 'tee_publico', 'max', 1), public.idle_tee_pct_procura(st.nivel, p_peca, st.fas, v_notas),`; `          now(), v_pronta, v_pronta + interval '30 minutes', v_fiado);` → `          now(), v_pronta, v_pronta + make_interval(secs => 1800 * public.idle_arv(s.user_id, 'tee_tempo', 'min', 1)), v_fiado);`
- `idle_cup_noite_andar` (0068 l. 785–847 e o `revoke` da l. 982): no `declare`, depois de `  v_g     double precision;`, acrescente `  v_cm    double precision := public.idle_arv(p_user, 'copao_mult', 'max', 1); -- Open bar / After (0082): as fichas`; `      v_f := v_v * x.lucro;` → `      v_f := v_v * x.lucro * v_cm;`

Os eventos do Espaço. Copie `idle_evento_era` da 0078 (l. 518–546) e mude:
- o comentário: acrescente a linha `-- 0082: o TARS (Espaço 5) dá uma 2ª chance de 1 em 3600 por 0,5 de frequência a mais no mesmo número (igual a eventoEraEm).`
- `returns int language plpgsql immutable set search_path = public as $$` → `returns int language plpgsql stable set search_path = public as $$`
- no `declare`, depois de `  r   int;`, acrescente `  v_f double precision;`
- o bloco `  if mod(h, 1800) <> 0 then` / `    return null;` / `  end if;` vira:

```sql
  if mod(h, 1800) <> 0 then
    v_f := public.idle_arv(u, 'era_freq', 'max', 1);
    if v_f <= 1 or mod(mod((h + 777) * (h + 777) + k, p), 3600) >= round(2 * (v_f - 1)) then
      return null;
    end if;
  end if;
```

Copie `idle_evento_pegar` da 0078 (l. 548–639: o comentário, o `drop function if exists`, a função e o `revoke`/`grant`) e mude:
- o comentário: acrescente a linha `-- 0082 (árvore grande): o Lixo vale lixo_min de produção por destroço, o Silver dura silver_min, e as janelas × era_janela (o segundo pode estar até 120 s longe).`
- `  if p_seg is null or abs(p_seg - extract(epoch from now())) > 60 then` → `  if p_seg is null or abs(p_seg - extract(epoch from now())) > 120 then`
- `     or now() > v_ini + make_interval(secs => (array[8, 12, 12, 5, 30, 10, 8])[v_tipo] + 3) then` → `     or now() > v_ini + make_interval(secs => (array[8, 12, 12, 5, 30, 10, 8])[v_tipo] * public.idle_arv(v_me, 'era_janela', 'max', 1) + 3) then`
- `      v_ganho := v_rate * 600 * v_gols;` → `      v_ganho := v_rate * 60 * public.idle_arv(v_me, 'lixo_min', 'max', 10) * v_gols;`
- `      s.silver_ate := greatest(coalesce(s.silver_ate, now()), now()) + interval '2 minutes';` → `      s.silver_ate := greatest(coalesce(s.silver_ate, now()), now()) + make_interval(secs => 60 * public.idle_arv(v_me, 'silver_min', 'max', 2));`

Copie `idle_settle` da 0078 (l. 445–516) e mude:
- o comentário: acrescente `; o Silver tape × o da árvore (Fita prateada ×5, 0082)`
- no `declare`, depois da linha do `v_dur`, acrescente `  v_silver double precision := public.idle_arv(s.user_id, 'silver_mult', 'max', 4);`
- `                * (case when s.silver_ate > v_meio then 4 else 1 end);` → `                * (case when s.silver_ate > v_meio then v_silver else 1 end);`

- [ ] **Step 6: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleArvoreGrande.test.ts test/idleMapa.test.ts test/idleCamisetaria.test.ts test/idleCopao.test.ts test/idleEventosEra.test.ts test/idleEras67.test.ts test/idleParidade.test.ts idle`
Expected: PASS (os eventos de era sem nó são os mesmos segundos de antes; `idleEras67`/`idleEventosEra` trocam `idle_evento_era` por um stub de 3 argumentos e continuam valendo).

- [ ] **Step 7: Commit**

```bash
git add supabase/migrations/0082_fellas_inc_arvore_grande.sql games/shared/types.ts games/idle/mapa.ts games/idle/camisetariaTela.ts games/idle/copaoTela.ts games/idle/dica.ts games/idle/eventosEra.ts games/idle/eventoEraTela.ts games/idle/store.ts games/idle/main.ts games/idle/tela.ts games/idle/eventosEra.test.ts games/idle/eventoEraTela.test.ts games/test/idleArvoreGrande.test.ts games/test/idleMapa.test.ts games/test/idleCamisetaria.test.ts games/test/idleCopao.test.ts
git commit -m "Fellas Inc.: Mapa, Camisetaria, Copão e os eventos do Espaço com a árvore grande (0082, parte E)"
```

---
### Task 9: A arte: os 89 ícones dos nós novos (o Juan aprova antes de publicar)

**Files (fora do repo, novo, em `C:\Users\juan\Documents\PROJETOSLLM\fellas-inc-esbocos`):**
- Create: `arvore-grande.js`

**Files (no repo):**
- Create: `games/idle/assets/arvore/no-106.png` … `no-110.png`, `no-206` … `no-210`, `no-306` … `no-310`, `no-406` … `no-410`, `no-506` … `no-510`, `no-606` … `no-610`, `no-701` … `no-710`, `no-801` … `no-810`, `no-901` … `no-910`, `no-1001` … `no-1010`, `no-2001` … `no-2009`, `no-3001` … `no-3010` (89, todos 16×16)

**Interfaces:**
- Consumes: os ids da Task 1 (`ativos.no(id)` procura `assets/arvore/no-<id>.png`; ids de 3 e 4 dígitos já saem sem zero na frente).
- Produces: os 89 PNG; `idle/ativos.test.ts` ("todo nó tem ícone 16x16" e "nenhum ícone sobrando"), vermelho desde a Task 1, fica verde.

**Como (o processo da entrega 3):** leia antes `BRIEF-SPRITES.md` e `BRIEF-LEGADO.md` e o modelo `legado-arvore.js` (os 31 de hoje) na pasta de esboços, e olhe com o Read `conferencia/legado-arvore-folha.png`: os novos são da mesma família. Copie de `legado-arvore.js` pro arquivo novo as funções `placa`, `mapa`, o laço que desenha/salva (`salvarSprite(nome, [cv], 15, 8)`) e o código da folha (cinza e trancado 35%); não dá pra `require` o modelo (ele roda ao carregar). **Não edite nenhum arquivo existente da pasta e não rode nenhum script de cena.** Regras de lá valem: paleta `P` (cor nova só se nenhuma serve, declarada no topo), contorno preto de 1 px (`telaComObjetos` + `cv.objeto(...)` + `cv.contornar()`), pixel duro, 1 px de margem, estático, 2 a 4 cores mais o contorno, legível a 48 px (3×) e trancado em cinza a 35% (a silhueta tem que ler sem cor), sem texto além de números grandes onde dito. Rode `cd C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos && node arvore-grande.js` (com um nome, `node arvore-grande.js no-106`, refaz só aquele), olhe `sprites/no-NNN-8x.png` e a folha com o Read e faça pelo menos 3 rodadas de revisão por grupo.

Placas (atrás do objeto, como os de hoje): os ramos 1–6 usam a `PLACA` de `legado-arvore.js` (copie as 7 entradas); entram `7` Bolsa `['#4FC2B0', '#2A8A7C', '#175A52']`, `8` PPP `['#F08CA8', '#C45478', '#86304E']`, `9` Mapa `['#EE7A5E', '#B84A33', '#7A2A1C']`, `10` Espaço `['#C8D0DC', '#8A94A6', '#565F70']`. **Ponte:** a placa dividida na diagonal (de cima à direita pra baixo à esquerda), metade na cor de cada um dos dois ramos que ela liga (`placaPonte(cv, ramoA, ramoB)`), na ordem da copa. **Infinito:** a placa do ramo e um "∞" branco de 5×3 px no canto de baixo à direita (x 9–13, y 11–13), por cima do objeto e com contorno (o objeto deixa esse canto livre).

| Nó | Desenho (16×16) |
|---|---|
| 106 Coach quântico | cabeça de perfil com uma órbita de átomo (elipse + 2 pontos) em volta |
| 107 Planilha com macro | planilha verde com uma engrenagem cinza no canto |
| 108 Reunião cancelada | calendário com um X vermelho grande |
| 109 Home office na praia | notebook aberto embaixo de um guarda-sol listrado |
| 110 Faria Limer | colete puffer azul-marinho com um crachá |
| 206 Poupança da vó | pote de vidro com moedas e tampa de crochê |
| 207 Kit primeiro emprego | carteira de trabalho azul com uma gravata em cima |
| 208 Clube de investimento do grupo | três moedas empilhadas e um balão verde do zap |
| 209 Mochilão na Europa | mochila com a Torre Eiffel atrás |
| 210 Nepo baby | chupeta dourada com uma coroinha |
| 306 Cofrinho de porquinho | porquinho rosa inteiro com a fenda em cima (o 21 é o quebrado) |
| 307 Notificação fixada | sino amarelo com uma tachinha vermelha |
| 308 Black Friday de verdade | etiqueta preta com "%" e um raio |
| 309 Cupom empilhado | três cupons tracejados em leque |
| 310 Gaveta das sacolinhas | gaveta aberta com sacolas plásticas saindo |
| 406 Óculos novo | óculos redondos com um brilho na lente |
| 407 Tubarão do Shark Tank | tubarão de gravata (a barbatana é a conquista 054: o tubarão inteiro aqui) |
| 408 Trevo de quatro folhas | trevo verde de quatro folhas |
| 409 Trend do TikTok | nota musical com sombra ciano e rosa |
| 410 Gato da sorte da loja chinesa | maneki-neko branco com a patinha pra cima |
| 506 Vale-refeição de verdade | cartão verde com um garfo e uma faca |
| 507 CLT premium | carteira de trabalho azul com uma estrela dourada |
| 508 Passe do Neymar | chuteira dourada |
| 509 Estágio "pela experiência" | crachá roxo de estagiário com uma moeda riscada |
| 510 Day off no aniversário | fatia de bolo com uma vela |
| 606 Fertilizante do vizinho | saco de adubo com uma seta verde pra cima |
| 607 Estufa | estufinha de vidro com uma planta dentro |
| 608 Abelha rainha | abelha com uma coroinha dourada |
| 609 Transgênico gourmet | tomate com uma hélice de DNA do lado |
| 610 Festival do Morango do Amor | morango do amor no palito com uma bandeirinha |
| 701 Corretora "sem taxa" | etiqueta de preço com o número riscado |
| 702 Conta no exterior | globo com um cifrão |
| 703 Grupo de sinais no Telegram | aviãozinho de papel azul |
| 704 Home broker no celular | celular com velas verdes subindo |
| 705 Tio do Bitcoin | moeda laranja com o "B" cortado |
| 706 Escritório na Faria Lima | prédio espelhado azul |
| 707 Analista do YouTube | botão de play vermelho com uma seta verde pra cima |
| 708 Fundo exclusivo | cofre cinza com um cadeado dourado |
| 709 Corretagem zero | "0%" grande (pode usar a área toda) |
| 710 Lobo de Wall Street | cabeça de lobo cinza de gravata vermelha |
| 801 Microfone de lapela | microfone pequenininho com o prendedor |
| 802 Mesa de som | mesa com 4 faders em alturas diferentes |
| 803 Cadeira gamer | cadeira gamer roxa e preta |
| 804 Corte pro TikTok | tesoura cortando uma tira de filme |
| 805 Patrocínio de casa de aposta | ficha de cassino com uma estrela |
| 806 Produtor que não dorme | lata de energético com olhos arregalados |
| 807 Sofá do estúdio | sofazinho com uma almofada |
| 808 Pauta roubada do concorrente | prancheta com uma mão pegando a folha |
| 809 10 milhões de views | olho grande com um play no lugar da pupila |
| 810 Virou programa de TV | TV de tubo com antena |
| 901 Rolê de quinta | caneca de chope com espuma |
| 902 Vaquinha dos parças | vaquinha malhada com uma moeda |
| 903 Check-in no Instagram | pino de localização com um coração |
| 904 Influencer de bairro | celular com uma estrela de seguidor |
| 905 Open bar até meia-noite | taça com um reloginho marcando 12 |
| 906 Promoter que conhece o dono | pulseira VIP dourada |
| 907 Nome na lista | prancheta com um ✓ verde |
| 908 Rolê que virou lenda | troféu com uma estrela |
| 909 Drop esgotado | camiseta com uma faixa vermelha atravessada |
| 910 After até o sol nascer | sol nascendo atrás de um copão |
| 1001 Treino na NASA | capacete de astronauta branco com o visor refletindo |
| 1002 Rolo extra de silver tape | rolo prateado com um "+" |
| 1003 Antena voltada pra Terra | antena parabólica com a Terra azul pequenininha |
| 1004 Combustível de foguete | galão com uma chama laranja |
| 1005 TARS, honestidade 90% | o robô TARS: bloco retangular cinza em 4 segmentos |
| 1006 Fita prateada industrial | rolo grande de fita com um brilho |
| 1007 Mensagem de casa | envelope com a Terra no selo |
| 1008 Motor de dobra | anel de energia azul com um núcleo branco |
| 1009 Ancoragem manual | dois módulos se encaixando (a acoplagem) |
| 1010 Endurance | a estação em anel com os módulos em volta |
| 2001 Feira orgânica no rolê | caixote de feira com uma bandeirinha de festa |
| 2002 A firma fechou o bar | balcão com a plaquinha de "fechado" |
| 2003 Estagiário virou convidado | o boné vermelho do estagiário com um microfone |
| 2004 Podcast da startup que faliu | microfone com um gráfico caindo atrás |
| 2005 Pivotou | seta fazendo uma curva de 90° |
| 2006 Fábrica em órbita | fábrica com o anel de um planeta |
| 2007 Frete grátis pra Lua | caixa de papelão com a Lua |
| 2008 Promoção relâmpago no home broker | raio amarelo sobre velas verdes |
| 2009 Dica quente do investidor anjo | asa de anjo com uma pimenta |
| 3001 Hora extra infinita | relógio (o ∞ da marca dos infinitos no canto) |
| 3002 Abrir outra startup | foguetinho saindo de uma caixa |
| 3003 Cliente fiel | coração com uma sacolinha |
| 3004 Sorte de principiante | dado com uma estrela na face |
| 3005 Happy hour da firma | dois copos brindando |
| 3006 Adubo orgânico premium | saco de adubo com uma folha dourada |
| 3007 Fundo de índice | gráfico de pizza |
| 3008 Corte viral | tesoura com fogo |
| 3009 Rolê infinito | globo de festa |
| 3010 Buraco de minhoca | espiral escura com estrelas |

- [ ] **Step 1: O teste de formato (já está vermelho desde a Task 1)**

Run: `cd games && npx vitest run --maxWorkers=4 idle/ativos.test.ts`
Expected: FAIL só em "todo nó tem ícone 16x16" (os 89 que faltam).

- [ ] **Step 2: O script**

Crie `arvore-grande.js` (cabeçalho: `// Ícones dos nós novos da árvore grande da Fellas Inc. (entrega 6, 16/10): no-106 … no-3010, 16x16, estáticos.` + o uso e as saídas, como no topo de `legado-arvore.js`), com: as cores novas e a `PLACA` (1–10), `placa`, `placaPonte`, `marcaInfinito` (o ∞), `mapa`, um `NOS['no-<id>'] = [ramo, linhas, legenda]` por ícone da tabela (as pontes com `[[ramoA, ramoB], …]`), a `ORDEM` dos 89 na ordem da tabela, o laço que desenha e salva (`png/no-<id>.png`, `sprites/no-<id>-8x.png`) e a folha `conferencia/arvore-grande-folha.png` (as 4 faixas da folha do modelo: 1×, 2×, 3× num quadradinho escuro, 6×, e as duas trancadas, nos dois temas), 13 por linha.

- [ ] **Step 3: Desenhar, revisar e copiar**

Rode o script, revise na folha (mínimo 3 rodadas por grupo de ramo; os de um ramo têm que se distinguir entre si e dos 5 de hoje do mesmo ramo; os infinitos têm que ler como "o ramo, sem fim"). Depois de bom, copie: `for f in png/no-1[0-9][0-9].png png/no-[2-9][0-9][0-9].png png/no-[123]0[0-9][0-9].png; do cp "$f" /c/Users/juan/Documents/PROJETOSLLM/fellasapp-arvore/games/idle/assets/arvore/; done` (só os 89 novos: **não** sobrescreva os 31 de hoje; confira com `ls games/idle/assets/arvore | wc -l` = 120).

- [ ] **Step 4: Rodar os testes de formato**

Run: `cd games && npx vitest run --maxWorkers=4 idle/ativos.test.ts`
Expected: PASS (inclui "nenhum ícone sobrando").

- [ ] **Step 5: Conferência do Juan**

No relatório da task, liste pro controlador mostrar ao Juan: `C:\Users\juan\Documents\PROJETOSLLM\fellas-inc-esbocos\conferencia\arvore-grande-folha.png` e, se quiser, alguns `sprites/no-<id>-8x.png`. **O Juan aprova antes de publicar**; o que ele pedir volta pra esta task (o código não depende dos pixels). Se a arte ficar pendente, as tasks seguintes continuam com o que tem (a tela mostra a moldura "sem arte").

- [ ] **Step 6: Commit**

```bash
git add games/idle/assets/arvore
git commit -m "Fellas Inc.: os 89 ícones dos nós novos da árvore grande"
```

---
### Task 10: A tela da árvore grande e o quadro do Legado, com a caixinha dos nós (Taste Engine)

**Files:**
- Modify: `games/idle/legado.ts` (troca `escalaArvore` por `escalaMinima`/`limitarZoom`; `progressoRamo`, `alturaBarra`)
- Rewrite: `games/idle/arvoreTela.ts`
- Create: `games/idle/arvore.css`
- Modify: `games/idle/main.ts` (import do CSS), `games/idle/tela.ts` (l. 19–20 imports, l. 171 `CLIQUE`, l. 421 criação, l. 594–607 quadro do Legado)
- Modify: `games/idle/dica.ts` (`dicaNo` novo), `games/idle/dica.test.ts`
- Modify: `games/idle/legado.test.ts` (o teste da escala), `games/idle/arvoreTela.test.ts`, `games/idle/tela.test.ts` (o quadro, l. 683–705)
- Modify: `games/dev/mockIdle.ts` (`__arvore`)

**Interfaces:**
- Consumes: `contextoArvore`, `situacaoTela`, `precoNo`, `nivelNo`, `portao`, `falta`, `ondeNo`, `descricaoNo`, `noInicial`, `ramoDoNo`, `RAMOS_ARVORE`, `POSICOES_ARVORE`, `ROTULOS_ARVORE`, `MUNDO_ARVORE` (Task 2); `efeitosArvore` com os campos novos (Task 3); `rendasGeradores` com o Espaço (Task 4); os ícones (Task 9).
- Produces: `escalaMinima(largura, altura)`, `ZOOM_MIN = 0.25`, `ZOOM_MAX = 1.4`, `limitarZoom(z, minimo)`, `progressoRamo(ramo, c): { comprados; total }`, `alturaBarra(k)` em `legado.ts`; `criarArvoreTela(comprar, ligarDica?)` com `abrir(s, ocupado, volta, no?)`; `copaBarras(s)` e `iconeNo(n)` em `arvoreTela.ts` (a `miniArvore` sai); `dicaNo(s, no): Dica` em `dica.ts`; `__arvore(pontos, vendas, era)` no `?mock`.

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-arvore && git merge main
```

Resolver a favor da main. Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`. Expected: PASS. Leia `tela.ts`, `idle.css` (o bloco da árvore, l. 232–302 e as mídias l. 586–600, 636–645, 665–673) e `main.ts` como estão agora: as linhas abaixo se encaixam no que existir.

- [ ] **Step 1: Testes (falham)**

Em `games/idle/legado.test.ts`: no import, troque `escalaArvore` por `alturaBarra, escalaMinima, limitarZoom, progressoRamo, ZOOM_MAX`; troque o teste `'escala: cabe no lado mais apertado, presa entre 0,8 e 1,4'` por:

```ts
  it('zoom: o mínimo faz a copa inteira caber no palco (nunca abaixo de 0,25 nem acima de 1); o zoom fica entre o mínimo e 1,4', () => {
    expect(escalaMinima(1348, 1200)).toBe(1);
    expect(escalaMinima(390, 560)).toBeCloseTo(390 / 1348, 12); // o celular: a copa inteira na largura
    expect(MUNDO_ARVORE.largura * escalaMinima(390, 560)).toBeLessThanOrEqual(390);
    expect(escalaMinima(100, 100)).toBe(0.25);
    expect(escalaMinima(4000, 4000)).toBe(1);
    expect(limitarZoom(3, 0.3)).toBe(ZOOM_MAX);
    expect(limitarZoom(0.1, 0.3)).toBe(0.3);
    expect(limitarZoom(0.8, 0.3)).toBe(0.8);
  });
  it('barrinhas do quadro: os 10 nós fixos de cada ramo; as do meio mais altas', () => {
    expect(progressoRamo(1, ctx({ arvore: [1, 11, 12, 106, 3001] }))).toEqual({ comprados: 3, total: 10 });
    expect(alturaBarra(0)).toBeCloseTo(0.55, 12);
    expect(alturaBarra(4)).toBeGreaterThan(alturaBarra(1));
    expect(alturaBarra(4)).toBeCloseTo(alturaBarra(5), 12);
  });
```

Troque `games/idle/arvoreTela.test.ts` inteiro por:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { copaBarras, criarArvoreTela } from './arvoreTela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(41).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10, promo_ate: null, viral: [],
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});

let comprar: ReturnType<typeof vi.fn<(id: number) => void>>;
let ligar: ReturnType<typeof vi.fn>;
let volta: HTMLButtonElement;
beforeEach(() => {
  document.body.innerHTML = '<button id="volta">Abrir</button>';
  volta = document.getElementById('volta') as HTMLButtonElement;
  comprar = vi.fn<(id: number) => void>();
  ligar = vi.fn();
});
const abrir = (s: IdleState, ocupado = false, no?: number) => {
  const t = criarArvoreTela(comprar, ligar);
  document.body.append(t.elemento);
  t.abrir(s, ocupado, () => volta, no);
  return t;
};
const no = (id: number) => document.querySelector<HTMLButtonElement>(`.no-arvore[data-no="${id}"]`)!;
const cartao = () => document.querySelector('.arvore-cartao')!;
const translate = () => {
  const m = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(document.querySelector<HTMLElement>('.arvore-mundo')!.style.transform)!;
  return { x: Number(m[1]), y: Number(m[2]) };
};

describe('árvore grande em tela cheia', () => {
  it('fechada até abrir; abre com os 120 nós, situação e forma nas classes, e os pontos no topo', () => {
    const t = criarArvoreTela(comprar, ligar);
    document.body.append(t.elemento);
    expect(t.aberta()).toBe(false);
    t.abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }), false, () => volta);
    expect(t.aberta()).toBe(true);
    expect(document.querySelectorAll('.no-arvore')).toHaveLength(120);
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(no(21).classList.contains('pode')).toBe(true);
    expect(no(12).classList.contains('falta')).toBe(true);
    expect(no(13).classList.contains('trancado')).toBe(true);
    expect(no(701).classList.contains('portao')).toBe(true);
    expect(no(701).querySelector('.no-cadeado')).not.toBeNull();
    expect(no(110).classList.contains('grande')).toBe(true);
    expect(no(3001).classList.contains('infinito')).toBe(true);
    expect(no(2005).classList.contains('ponte')).toBe(true);
    expect(no(12).querySelector('.no-custo')!.textContent).toBe('4 ★');
    expect(no(11).querySelector('.no-custo')).toBeNull();
    expect(document.querySelectorAll('.ligacao')).toHaveLength(128);
    expect(document.querySelectorAll('.ligacao.acesa')).toHaveLength(1); // 1 → 11: o caminho comprado
    expect(document.querySelector('.arvore-pontos')!.textContent).toBe('★ 3');
    expect(ligar).toHaveBeenCalledWith(no(106), 'no-106', expect.any(Function)); // a caixinha (mouse/teclado)
  });
  it('a fileira: a Raiz no meio e os 10 ramos na ordem da copa; tocar num ramo escolhe o próximo dele', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    const fileira = [...document.querySelectorAll<HTMLButtonElement>('.arvore-fileira .ramo-botao')];
    expect(fileira.map((b) => b.textContent)).toEqual(['Horta', 'Mapa do rolê', 'Gente', 'PPP Podcast', 'Recomeço', 'Raiz', 'Produção', 'Espaço', 'Oportunidades', 'Bolsa', 'Dourados']);
    fileira[6].click(); // Produção: o 11 é seu, o próximo é o 12
    expect(no(12).getAttribute('aria-pressed')).toBe('true');
    // a fileira é refeita a cada desenho: procura de novo
    expect(document.querySelectorAll<HTMLButtonElement>('.arvore-fileira .ramo-botao')[6].getAttribute('aria-pressed')).toBe('true');
    expect(cartao().textContent).toContain('Ô loco, bicho!');
  });
  it('abre com o nó mais barato que dá pra comprar (ou o pedido) escolhido; Comprar chama comprar(id)', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    expect(no(21).getAttribute('aria-pressed')).toBe('true');
    expect(cartao().textContent).toContain('Porquinho quebrado');
    expect(cartao().textContent).toContain('Recomeço · 1 de 10');
    const b = cartao().querySelector('button')!;
    expect(b.textContent).toBe('Comprar · 2 ★');
    b.click();
    expect(comprar).toHaveBeenCalledWith(21);
    document.body.innerHTML = '';
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }), false, 12);
    expect(no(12).getAttribute('aria-pressed')).toBe('true');
  });
  it('cartão: falta ponto, trancado, portão (com o motivo), comprado; infinito com o nível e o próximo preço', () => {
    abrir(estado({ pontos: 3, vendas: 1, bonus: { arvore: [1, 11, 12, 13, 14, 15], conquistas: 0 } }));
    no(21).click();
    expect(cartao().querySelector('button')!.textContent).toBe('Comprar · 2 ★');
    no(106).click();
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().textContent).toContain('Falta: 3 vendas (você tem 1)');
    no(107).click();
    expect(cartao().textContent).toContain('Libera com Coach quântico');
    no(11).click();
    expect(cartao().textContent).toContain('Comprado');
    document.body.innerHTML = '';
    abrir(estado({ pontos: 5000, vendas: 10, bonus: { arvore: [3001], conquistas: 0, niveis: { 3001: 7 } } }), false, 3001);
    expect(cartao().textContent).toContain('Nível 7 → 8');
    expect(cartao().textContent).toContain(`${Math.round(1000 * 1.6 ** 7)} ★`);
    expect(no(3001).querySelector('.no-nivel')!.textContent).toBe('nv 7');
    expect(no(3001).classList.contains('nivelado')).toBe(true);
  });
  it('ocupado: Comprar apagado', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }), true);
    expect(cartao().querySelector<HTMLButtonElement>('button')!.disabled).toBe(true);
  });
  it('renderizar de novo (comprou) mantém o escolhido e acende o nó', () => {
    const t = abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    expect(no(11).getAttribute('aria-pressed')).toBe('true');
    t.renderizar(estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }), false);
    expect(no(11).getAttribute('aria-pressed')).toBe('true');
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(cartao().textContent).toContain('Comprado');
    expect(document.querySelector('.arvore-pontos')!.textContent).toBe('★ 1');
  });
  it('foco no ✕ ao abrir; Esc e ✕ fecham e devolvem o foco', () => {
    const t = abrir(estado());
    expect(document.activeElement).toBe(document.querySelector('.arvore-topo .fechar'));
    t.elemento.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(t.aberta()).toBe(false);
    expect(document.activeElement).toBe(volta);
    t.abrir(estado(), false, () => volta);
    document.querySelector<HTMLButtonElement>('.arvore-topo .fechar')!.click();
    expect(t.aberta()).toBe(false);
    expect(document.activeElement).toBe(volta);
  });
  it('arrastar e soltar em cima de um nó não escolhe o nó; um toque de verdade escolhe', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('false');
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 10, clientY: 10, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 11, clientY: 10, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('true');
  });
  it('pinça (dois dedos): aproxima e não escolhe nem compra no fim', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    const antes = document.querySelector<HTMLElement>('.arvore-mundo')!.style.width;
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 2, clientX: 200, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 2, clientX: 220, clientY: 100, bubbles: true })); // 100 → 120
    expect(document.querySelector<HTMLElement>('.arvore-mundo')!.style.width).not.toBe(antes);
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 2, clientX: 220, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('false');
    cartao().querySelector<HTMLButtonElement>('button')?.click();
    expect(comprar).toHaveBeenCalledTimes(1); // só o clique de verdade no botão (o 11, escolhido ao abrir)
  });
  it('botões de zoom: + aproxima até 1,4 (apaga), − afasta até o mínimo (apaga)', () => {
    abrir(estado());
    const mais = document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-mais')!;
    const menos = document.querySelector<HTMLButtonElement>('.arvore-zoom .zoom-menos')!;
    for (let i = 0; i < 5; i++) mais.click();
    expect(mais.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('.arvore-mundo')!.style.width).toBe(`${1348 * 1.4}px`);
    for (let i = 0; i < 12; i++) menos.click();
    expect(menos.disabled).toBe(true);
    expect(document.querySelector<HTMLElement>('.arvore-mundo')!.style.width).toBe(`${1348 * 0.25}px`);
    expect(document.querySelector('.arvore-mundo')!.classList.contains('sem-rotulos')).toBe(true);
  });
  it('com a página ampliada (zoom do PC), o mundo anda junto com o mouse, não mais rápido', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    for (const k of ['clientWidth', 'clientHeight', 'offsetWidth']) Object.defineProperty(palco, k, { configurable: true, value: 200 });
    palco.getBoundingClientRect = () => ({ width: 400, height: 400 }) as DOMRect; // zoom 2: 200 de layout viram 400 na tela
    const t0 = translate();
    palco.dispatchEvent(new PointerEvent('pointerdown', { pointerId: 1, clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { pointerId: 1, clientX: 140, clientY: 120, bubbles: true }));
    const t1 = translate();
    expect(t1.x - t0.x).toBeCloseTo(20, 6);
    expect(t1.y - t0.y).toBeCloseTo(10, 6);
  });
  it('ícone sem a arte: só a moldura', () => {
    const sem = vi.spyOn(ativos, 'no').mockReturnValue(null);
    try {
      abrir(estado());
      expect(no(1).querySelector('.icone-legado')!.classList.contains('sem-arte')).toBe(true);
    } finally {
      sem.mockRestore();
    }
  });
  it('legenda com as 5 situações', () => {
    abrir(estado());
    expect([...document.querySelectorAll('.arvore-legenda li')].map((x) => x.textContent))
      .toEqual(['Comprado', 'Dá pra comprar', 'Falta ponto', 'Tem portão', 'Trancado']);
  });
  it('as barrinhas do quadro: 10, na ordem da copa, cheias na proporção, decorativas', () => {
    const b = copaBarras(estado({ bonus: { arvore: [1, 11, 12, 13, 14, 15, 106, 107, 108, 109, 110], conquistas: 0 } }));
    expect(b.getAttribute('aria-hidden')).toBe('true');
    const barras = [...b.querySelectorAll<HTMLElement>('.barra')];
    expect(barras).toHaveLength(10);
    expect(barras[5].style.getPropertyValue('--cheio')).toBe('100%'); // a Produção é a 6ª da copa
    expect(barras[5].classList.contains('cheia')).toBe(true);
    expect(barras[0].style.getPropertyValue('--cheio')).toBe('0%');
  });
});
```

Em `games/idle/tela.test.ts`, no teste do quadro (l. 683–691), troque `expect(quadro.querySelector('svg.arvore-mini')).not.toBeNull();` por:

```ts
    expect(quadro.querySelectorAll('.copa-barras .barra')).toHaveLength(10);
    expect(quadro.querySelector('.arvore-abrir')!.textContent).toBe('Porquinho quebrado · 2 ★'); // o próximo nó dentro do botão
```

e mantenha o resto (o `toContain` do "2 de 120 comprados · 5 dá pra comprar agora", o abrir e o Comprar do 21).

No fim de `games/idle/dica.test.ts` (acrescente `dicaNo` no import de `./dica` e `import { formatarTaxa } from './formatar';` se faltar):

```ts
describe('caixinha dos nós da árvore (o que está agora → com o nó)', () => {
  const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
  it('nó de soma: a soma antes e depois e quanto de F$/s dá agora', () => {
    const s = estado({ rate: 1000, vendas: 3, bonus: { arvore: [1, 11, 12, 13, 14, 15], conquistas: 0 } });
    const t = textos(dicaNo(s, no(106)));
    expect(t[0]).toBe('Produção +20%, somando com os outros nós de soma.');
    expect(t).toContain('Soma de produção: +0% → +20%');
    expect(t).toContain(`${formatarTaxa(1000 * (1.2 / 1 - 1))} na sua produção agora`); // +20% de 1.000/s
  });
  it('infinito: o nível e o efeito do próximo', () => {
    const s = estado({ rate: 1000, vendas: 10, bonus: { arvore: [3001], conquistas: 0, niveis: { 3001: 4 } } });
    const t = textos(dicaNo(s, no(3001)));
    expect(t).toContain('Soma de produção: +20% → +25%');
    expect(t).toContain('Nível 4 → 5');
  });
  it('portão: o que falta; minigame: o número de antes e de depois', () => {
    expect(textos(dicaNo(estado({ vendas: 1, bonus: { arvore: [15], conquistas: 0 } }), no(106)))).toContain('Falta: 3 vendas (você tem 1)');
    expect(textos(dicaNo(estado({ era: 4 }), no(701)))).toContain('Corretagem: ×1 → ×0,8');
    expect(textos(dicaNo(estado({ era: 6 }), no(1001)))).toContain('Cada destroço vale: 10 min de produção → 15 min de produção');
  });
  it('fixo que já é seu: diz que é seu e o efeito agora; nada de NaN com resposta velha', () => {
    const t = textos(dicaNo(estado({ bonus: { arvore: [1, 31, 32, 33, 34, 35, 306], conquistas: 0 } }), no(306)));
    expect(t).toContain('Já é seu · A caixinha guarda: 6');
    for (const n of [1, 106, 701, 3001, 2005, 1010]) expect(textos(dicaNo(estado(), no(n))).join(' ')).not.toContain('NaN');
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/legado.test.ts idle/arvoreTela.test.ts idle/tela.test.ts idle/dica.test.ts`
Expected: FAIL.

- [ ] **Step 2: `legado.ts` (zoom e barrinhas)**

Troque `escalaArvore` inteira por:

```ts
/** O zoom: o mínimo faz a copa inteira caber no palco (nunca abaixo de ZOOM_MIN, onde os nós viram quadradinhos que ainda
 *  dão pra ler, nem acima de 1); o máximo é ZOOM_MAX. */
export const ZOOM_MIN = 0.25;
export const ZOOM_MAX = 1.4;
export function escalaMinima(largura: number, altura: number): number {
  return Math.min(1, Math.max(ZOOM_MIN, Math.min(largura / MUNDO_ARVORE.largura, altura / MUNDO_ARVORE.altura)));
}
export const limitarZoom = (z: number, minimo: number): number => Math.min(ZOOM_MAX, Math.max(minimo, z));

/** Quantos dos 10 nós fixos de um ramo você tem (as barrinhas do quadro do Legado). */
export function progressoRamo(ramo: number, c: Pick<ContextoArvore, 'arvore'>): { comprados: number; total: number } {
  const nos = catalogo.arvore.filter((n) => n.ramo === ramo && n.posicao <= 10);
  return { comprados: nos.filter((n) => c.arvore.includes(n.id)).length, total: nos.length };
}
/** A altura de cada barrinha (fração), pela coluna da copa: o mesmo arco da copa, as do meio mais altas. */
export const alturaBarra = (k: number): number => 0.55 + 0.45 * (1 - ((k - 4.5) / 4.5) ** 2);
```

(`progressoRamo` e o resto usam `ContextoArvore`, declarado antes no arquivo.)

- [ ] **Step 3: `dicaNo` (`dica.ts`)**

No topo de `dica.ts`: no import de `./catalogo`, acrescente `type No`; no de `./economia`, `efeitosArvore, type EfeitosArvore` (e `rendasGeradores`, que já está); acrescente `import { contextoArvore, nivelNo, portao } from './legado';` e, no de `./nomes`, `type TipoNo`. No fim do arquivo:

```ts
// ---------- a árvore (árvore grande, 16/10) ----------
const mais = (x: number) => `+${num(x * 100, 1)}%`;
/** O que cada tipo de nó mexe nos efeitos e como mostrar (a caixinha do nó diz o que está agora → com ele). */
const CAMPO_NO: Partial<Record<TipoNo, { campo: keyof EfeitosArvore; nome: string; fmt: (x: number) => string }>> = {
  producao: { campo: 'producao', nome: 'Produção da árvore', fmt: vezes },
  producao_soma: { campo: 'producaoSoma', nome: 'Soma de produção', fmt: (x) => mais(x - 1) },
  inicio_valuation: { campo: 'inicioValuation', nome: 'O Abrir CNPJ começa com', fmt: formatarValor },
  inicio_notebooks: { campo: 'inicioNotebooks', nome: 'Notebooks no começo', fmt: (x) => num(x, 0) },
  inicio_eras: { campo: 'inicioEras', nome: 'Começa com 1 de cada gerador das eras', fmt: (x) => (x ? `1 a ${num(x, 0)}` : 'nenhuma') },
  inicio_mult: { campo: 'inicioMult', nome: 'F$ do começo', fmt: vezes },
  caixinha: { campo: 'caixinha', nome: 'A caixinha guarda', fmt: (x) => num(x, 0) },
  segundos: { campo: 'oppSegundos', nome: 'Oportunidade na cena', fmt: (x) => `${num(x, 0)} s` },
  opp_extra: { campo: 'oppExtra', nome: 'Oportunidades a mais por dia', fmt: (x) => `+${num(x, 0)}` },
  opp_bonus: { campo: 'oppBonus', nome: 'Oportunidades rendem', fmt: vezes },
  opp_fs: { campo: 'oppFs', nome: 'Oportunidades em F$', fmt: (x) => mais(x - 1) },
  contrato_preco: { campo: 'contratoPreco', nome: 'Contratar custa', fmt: pct },
  contrato_desconto: { campo: 'contratoDesconto', nome: 'Desconto do Happy hour', fmt: (x) => `−${num(x * 100, 1)}%` },
  por_contratado: { campo: 'porContratado', nome: 'Cada contratado rende', fmt: pct },
  contrato_dias: { campo: 'contratoDias', nome: 'Os contratos duram', fmt: (x) => `${num(x, 0)} dias` },
  emprego_mult: { campo: 'empregoMult', nome: 'Quem te contrata rende', fmt: vezes },
  dourado_freq: { campo: 'douradoFreq', nome: 'Eventos aparecem', fmt: vezes },
  dourado_tela: { campo: 'douradoTela', nome: 'Eventos ficam na tela', fmt: (x) => `${num(x, 0)} s` },
  dourado_investidor: { campo: 'douradoInvestidor', nome: 'Investidor apressado', fmt: (x) => `${num(20 * x, 1)} min de produção` },
  dourado_duracao: { campo: 'douradoDuracao', nome: 'Viralizou e Promoção duram', fmt: vezes },
  horta_amadurece: { campo: 'hortaAmadurece', nome: 'Plantas amadurecem no tempo de', fmt: pct },
  horta_vida: { campo: 'hortaVida', nome: 'Vida das plantas maduras', fmt: vezes },
  horta_cruza: { campo: 'hortaCruza', nome: 'Cruzamento', fmt: vezes },
  horta_mult: { campo: 'hortaMult', nome: 'Bônus das plantas', fmt: vezes },
  horta_soma: { campo: 'hortaSoma', nome: 'Bônus das plantas (Adubo)', fmt: (x) => mais(x - 1) },
  morango_chance: { campo: 'morangoChance', nome: 'Morango com Pescoço', fmt: vezes },
  bolsa_corretagem: { campo: 'bolsaCorretagem', nome: 'Corretagem', fmt: vezes },
  bolsa_limite: { campo: 'bolsaLimite', nome: 'Limite de ações a mais', fmt: (x) => `+${num(x, 0)}` },
  bolsa_limite_mult: { campo: 'bolsaLimiteMult', nome: 'Limite de ações', fmt: vezes },
  bolsa_limite_soma: { campo: 'bolsaLimiteSoma', nome: 'Limite de ações (Fundo de índice)', fmt: (x) => mais(x - 1) },
  bolsa_espiadas: { campo: 'bolsaEspiadas', nome: 'Espiadas grátis por dia', fmt: (x) => num(x, 0) },
  bolsa_escritorio: { campo: 'bolsaEscritorio', nome: 'Bônus do Escritório', fmt: vezes },
  conv_recarga: { campo: 'convRecarga', nome: 'Cada troca volta em', fmt: (x) => `${num(60 / x, 0)} min` },
  conv_trocas: { campo: 'convTrocas', nome: 'Trocas guardadas', fmt: (x) => num(3 + x, 0) },
  conv_cadeira2: { campo: 'convCadeira2', nome: 'A cadeira do meio vale', fmt: pct },
  conv_cadeira3: { campo: 'convCadeira3', nome: 'A cadeira do canto vale', fmt: pct },
  conv_queda: { campo: 'convQueda', nome: 'A faixa do MC V.V cai', fmt: pct },
  conv_efeito: { campo: 'convEfeito', nome: 'Bônus de produção dos convidados', fmt: mais },
  mapa_abrir: { campo: 'mapaAbrir', nome: 'Abrir lugar custa', fmt: pct },
  mapa_nivel: { campo: 'mapaNivel', nome: 'Subir nível custa', fmt: pct },
  marcos_mult: { campo: 'marcosMult', nome: 'Marcos dos lugares', fmt: vezes },
  marcos_soma: { campo: 'marcosSoma', nome: 'Marcos (Rolê infinito)', fmt: (x) => mais(x - 1) },
  tee_publico: { campo: 'teePublico', nome: 'Público da Camisetaria', fmt: vezes },
  tee_tempo: { campo: 'teeTempo', nome: 'A coleção vende em', fmt: (x) => `${num(30 * x, 0)} min` },
  copao_mult: { campo: 'copaoMult', nome: 'Fichas do Copão', fmt: vezes },
  lixo_min: { campo: 'lixoMin', nome: 'Cada destroço vale', fmt: (x) => `${num(x, 0)} min de produção` },
  silver_min: { campo: 'silverMin', nome: 'O Silver tape dura', fmt: (x) => `${num(x, 0)} min` },
  silver_mult: { campo: 'silverMult', nome: 'O Silver tape vale', fmt: vezes },
  legado_mult: { campo: 'legadoMult', nome: 'Melhorias de legado', fmt: vezes },
  espaco_soma: { campo: 'espaco', nome: 'Geradores das eras 6+', fmt: (x) => mais(x - 1) },
  era_freq: { campo: 'eraFreq', nome: 'Eventos de era aparecem', fmt: vezes },
  era_janela: { campo: 'eraJanela', nome: 'Eventos de era na tela', fmt: vezes },
};

/** Quanto o nó soma de F$/s agora (só os de produção; os outros: 0). A conta da página na proporção da taxa do banco. */
function ganhoNo(s: IdleState, no: No, antes: EfeitosArvore, depois: EfeitosArvore): number {
  if (no.tipo === 'producao') return s.rate * (depois.producao / antes.producao - 1);
  if (no.tipo === 'producao_soma') return s.rate * (depois.producaoSoma / antes.producaoSoma - 1);
  if (no.tipo === 'espaco_soma') {
    const r = rendasGeradores(catalogo, s);
    const total = r.reduce((a, x) => a + x, 0);
    const espaco = r.reduce((a, x, i) => (catalogo.geradores[i].era >= 6 ? a + x : a), 0);
    return total > 0 ? s.rate * (espaco / total) * (depois.espaco / antes.espaco - 1) : 0;
  }
  return 0;
}

/** A caixinha de um nó da árvore (mouse no PC, foco no teclado): o efeito, o que muda nos seus números (agora → com o
 *  nó, ou o próximo nível no infinito), quanto de F$/s dá agora e o portão que falta. */
export function dicaNo(s: IdleState, no: No): Dica {
  const c = contextoArvore(s);
  const tem = c.arvore.includes(no.id);
  const infinito = no.cresce !== null;
  const nivel = nivelNo(no, c);
  const antes = efeitosArvore(catalogo, c.arvore, c.niveis);
  const linhas: LinhaDica[] = [{ texto: no.efeito }];
  const k = CAMPO_NO[no.tipo];
  if (tem && !infinito) {
    if (k) linhas.push({ texto: `Já é seu · ${k.nome}: ${k.fmt(antes[k.campo] as number)}`, tom: 'bom' });
    else linhas.push({ texto: 'Já é seu', tom: 'bom' });
    return { titulo: no.nome, linhas };
  }
  const depois = efeitosArvore(catalogo, tem ? c.arvore : [...c.arvore, no.id], infinito ? { ...c.niveis, [no.id]: nivel + 1 } : c.niveis);
  if (k) linhas.push({ texto: `${k.nome}: ${k.fmt(antes[k.campo] as number)} → ${k.fmt(depois[k.campo] as number)}` });
  const ganho = ganhoNo(s, no, antes, depois);
  if (ganho > 0) linhas.push({ texto: `${formatarTaxa(ganho)} na sua produção agora`, tom: 'bom' });
  if (infinito) linhas.push({ texto: `Nível ${nivel} → ${nivel + 1}`, tom: 'fraco' });
  const p = tem ? null : portao(no, c);
  if (p) linhas.push({ texto: p, tom: 'ruim' });
  return { titulo: no.nome, linhas };
}
```

(`vezes`, `pct` e `num` já existem no topo do arquivo: `×1,5`, `20%`, `1,5`. Os nós que não estão em `CAMPO_NO` (`inicio_era1`, `manter_gerais`) mostram só o efeito.)

- [ ] **Step 4: `arvoreTela.ts` (reescrito)**

Troque o arquivo inteiro por:

```ts
// Árvore de habilidades em tela cheia (a copa gerada da árvore grande, 120 nós) e as barrinhas do quadro do Legado. Só
// desenha: quem compra é o banco (comprar(id)). O nó escolhido, o zoom e o arraste vivem aqui, fora do modelo. Texto
// sempre por textContent. Hierarquia por tamanho e forma (o nó 10 maior com moldura dupla; o infinito em losango com o
// nível; a ponte com moldura própria) e o estado com forma além da cor (comprado cheio; dá pra comprar com traço lilás e o
// preço numa moedinha; falta ponto com o preço apagado; portão com cadeado; trancado em silhueta) — spec §7.
import { button, el } from '../shared/hud/hud';
import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, ORDEM_RAMOS, RAMO_PONTE, type No } from './catalogo';
import { dicaNo, type Dica } from './dica';
import { iconeFechar } from './icones';
import {
  alturaBarra, contextoArvore, descricaoNo, escalaMinima, falta, faltam, limitarZoom, MUNDO_ARVORE, nivelNo, noInicial, ondeNo, pontos,
  portao, POSICOES_ARVORE, precoNo, progressoRamo, RAMOS_ARVORE, ramoDoNo, ROTULOS_ARVORE, situacaoTela, ZOOM_MAX,
  type ContextoArvore, type SituacaoTela,
} from './legado';
import { RAMOS } from './nomes';

const NS = 'http://www.w3.org/2000/svg';
/** Mexeu mais que isso com o dedo/mouse apertado: é arraste, não toque. */
const ARRASTE_PX = 6;
/** Os rótulos dentro da copa só a partir deste zoom (o texto não encolhe: abaixo, encostariam). A fileira mostra sempre. */
const ZOOM_ROTULOS = 0.8;
const PASSO_ZOOM = 1.25;
const LEGENDA: readonly [SituacaoTela, string][] = [
  ['comprado', 'Comprado'], ['pode', 'Dá pra comprar'], ['falta', 'Falta ponto'], ['portao', 'Tem portão'], ['trancado', 'Trancado'],
];
/** A fileira de ramos: a Raiz no meio, os ramos na ordem da copa (ela fica parada enquanto a copa arrasta). */
const FILEIRA: readonly number[] = [...ORDEM_RAMOS.slice(0, 5), 0, ...ORDEM_RAMOS.slice(5)];

export type LigarDica = (alvo: HTMLElement, chave: string, conteudo: () => Dica | null) => void;
export type ArvoreTela = {
  elemento: HTMLElement;
  aberta(): boolean;
  /** `volta` devolve o botão que recebe o foco ao fechar (o Abrir é recriado a cada renderização); `no` = o nó que abre
   *  escolhido (sem ele, o mais barato que dá pra comprar). */
  abrir(s: IdleState, ocupado: boolean, volta: () => HTMLElement | null, no?: number): void;
  fechar(): void;
  renderizar(s: IdleState, ocupado: boolean): void;
};

const situacoes = (c: ContextoArvore) => new Map(catalogo.arvore.map((n) => [n.id, situacaoTela(n, c)] as const));
/** A forma do nó: comum, o 10 de cada ramo (maior), o infinito (losango) ou a ponte. */
const formaDe = (n: No) => (n.ramo === RAMO_PONTE ? 'ponte' : n.posicao === 11 ? 'infinito' : n.posicao === 10 ? 'grande' : 'comum');

/** As linhas entre cada nó e o que ele pede (a ponte tem duas), num svg (k = px por unidade do mundo). Entre dois que você
 *  tem, a linha acende (o caminho comprado). */
function ligacoes(svg: SVGSVGElement, sits: Map<number, SituacaoTela>, c: ContextoArvore, k: number) {
  for (const n of catalogo.arvore) {
    for (const r of [n.requer, n.requer2]) {
      if (r === null) continue;
      const [x1, y1] = POSICOES_ARVORE[r];
      const [x2, y2] = POSICOES_ARVORE[n.id];
      const l = document.createElementNS(NS, 'line');
      l.setAttribute('x1', String(x1 * k));
      l.setAttribute('y1', String(y1 * k));
      l.setAttribute('x2', String(x2 * k));
      l.setAttribute('y2', String(y2 * k));
      const acesa = c.arvore.includes(n.id) && c.arvore.includes(r);
      l.setAttribute('class', `ligacao ${acesa ? 'acesa' : sits.get(n.id)}`);
      svg.append(l);
    }
  }
}

/** Ícone 16x16 ampliado; sem a arte, só a moldura. */
export function iconeNo(n: No) {
  const box = el('span', 'icone-legado');
  const url = ativos.no(n.id);
  if (url) box.style.backgroundImage = `url(${url})`;
  else box.classList.add('sem-arte');
  return box;
}

/** A silhueta da copa no quadro do Legado: 10 barrinhas (uma por ramo, na ordem da copa, as do meio mais altas) cheias na
 *  proporção dos 10 nós fixos que você tem. Decorativa: o texto do lado diz quantos. */
export function copaBarras(s: IdleState): HTMLElement {
  const c = contextoArvore(s);
  const box = el('div', 'copa-barras');
  box.setAttribute('aria-hidden', 'true');
  ORDEM_RAMOS.forEach((ramo, k) => {
    const { comprados, total } = progressoRamo(ramo, c);
    const b = el('span', 'barra');
    b.style.setProperty('--alto', alturaBarra(k).toFixed(3));
    b.style.setProperty('--cheio', `${Math.round((comprados / total) * 100)}%`);
    if (comprados === total) b.classList.add('cheia');
    box.append(b);
  });
  return box;
}

export function criarArvoreTela(comprar: (id: number) => void, ligarDica: LigarDica = () => {}): ArvoreTela {
  const tela = el('div', 'arvore-tela');
  tela.setAttribute('role', 'dialog');
  tela.setAttribute('aria-modal', 'true');
  tela.setAttribute('aria-labelledby', 'idle-titulo-arvore');
  tela.setAttribute('hidden', '');
  const topo = el('div', 'arvore-topo');
  const fecharB = button('', 'fechar', () => fechar());
  fecharB.setAttribute('aria-label', 'Fechar');
  fecharB.append(iconeFechar());
  const titulo = el('h2', undefined, 'Árvore de habilidades');
  titulo.id = 'idle-titulo-arvore';
  const zoomMenos = button('−', 'btn compacto zoom-menos', () => mudarZoom(1 / PASSO_ZOOM));
  zoomMenos.setAttribute('aria-label', 'Afastar');
  const zoomMais = button('+', 'btn compacto zoom-mais', () => mudarZoom(PASSO_ZOOM));
  zoomMais.setAttribute('aria-label', 'Aproximar');
  const zooms = el('div', 'arvore-zoom');
  zooms.append(zoomMenos, zoomMais);
  const pontosTopo = el('span', 'arvore-pontos');
  topo.append(fecharB, titulo, zooms, pontosTopo);
  const fileira = el('div', 'arvore-fileira');
  fileira.setAttribute('role', 'toolbar');
  fileira.setAttribute('aria-label', 'Ramos');
  const palco = el('div', 'arvore-palco');
  const mundo = el('div', 'arvore-mundo');
  palco.append(mundo);
  const legenda = el('ul', 'arvore-legenda');
  for (const [sit, texto] of LEGENDA) {
    const li = el('li', sit);
    li.append(el('i'), document.createTextNode(texto));
    legenda.append(li);
  }
  const cartao = el('div', 'arvore-cartao');
  cartao.setAttribute('aria-live', 'polite');
  const lado = el('div', 'arvore-lado');
  lado.append(legenda, cartao);
  const corpo = el('div', 'arvore-corpo');
  corpo.append(palco, lado);
  tela.append(topo, fileira, corpo);

  let estado: IdleState | null = null;
  let ocupado = false;
  let escolhido: number | null = null;
  let volta: () => HTMLElement | null = () => null;
  let desloc = { x: 0, y: 0 };
  let zoom = 1;
  let arraste: { x: number; y: number; dx: number; dy: number; moveu: boolean } | null = null;
  let pinca: { d0: number; z0: number; dx: number; dy: number } | null = null;
  const toques = new Map<number, { x: number; y: number }>();
  let engolirClique = false;

  const aberta = () => !tela.hasAttribute('hidden');
  // sem tamanho (escondida ou nos testes): o mínimo é o ZOOM_MIN
  const minimo = () => (palco.clientWidth && palco.clientHeight ? escalaMinima(palco.clientWidth, palco.clientHeight) : 0.25);
  const k = () => limitarZoom(zoom, minimo());

  /** Prende o arraste às bordas: só dá pra arrastar o que passa do palco. */
  function posicionar() {
    const kk = k();
    const lx = Math.max(0, (MUNDO_ARVORE.largura * kk - palco.clientWidth) / 2);
    const ly = Math.max(0, (MUNDO_ARVORE.altura * kk - palco.clientHeight) / 2);
    desloc = { x: Math.max(-lx, Math.min(lx, desloc.x)), y: Math.max(-ly, Math.min(ly, desloc.y)) };
    mundo.style.transform = `translate(${desloc.x}px, ${desloc.y}px)`;
  }
  /** Põe o nó no meio do palco (o que der: a borda da copa segura). */
  function centrar(id: number) {
    const [x, y] = POSICOES_ARVORE[id];
    const kk = k();
    desloc = { x: (MUNDO_ARVORE.largura / 2 - x) * kk, y: (MUNDO_ARVORE.altura / 2 - y) * kk };
  }
  /** Aproxima/afasta em volta do meio do palco. */
  function mudarZoom(f: number) {
    const antes = k();
    zoom = limitarZoom(antes * f, minimo());
    const depois = k();
    desloc = { x: (desloc.x * depois) / antes, y: (desloc.y * depois) / antes };
    desenhar();
  }

  palco.addEventListener('pointerdown', (e) => {
    engolirClique = false;
    toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (toques.size === 2) {
      const [a, b] = [...toques.values()];
      pinca = { d0: Math.hypot(a.x - b.x, a.y - b.y) || 1, z0: k(), dx: desloc.x, dy: desloc.y };
      arraste = null;
      return;
    }
    arraste = { x: e.clientX, y: e.clientY, dx: desloc.x, dy: desloc.y, moveu: false };
  });
  palco.addEventListener('pointermove', (e) => {
    if (toques.has(e.pointerId)) toques.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pinca && toques.size >= 2) {
      const [a, b] = [...toques.values()];
      const novo = limitarZoom((pinca.z0 * Math.hypot(a.x - b.x, a.y - b.y)) / pinca.d0, minimo());
      zoom = novo;
      desloc = { x: (pinca.dx * novo) / pinca.z0, y: (pinca.dy * novo) / pinca.z0 };
      engolirClique = true; // o fim da pinça não escolhe nem compra
      desenhar();
      return;
    }
    if (!arraste) return;
    const dx = e.clientX - arraste.x;
    const dy = e.clientY - arraste.y;
    if (!arraste.moveu && Math.hypot(dx, dy) <= ARRASTE_PX) return;
    arraste.moveu = true;
    // o mouse anda em px da tela; o mundo, em px da página (que no PC pode estar ampliada pelo zoom)
    const z = palco.offsetWidth ? palco.getBoundingClientRect().width / palco.offsetWidth || 1 : 1;
    desloc = { x: arraste.dx + dx / z, y: arraste.dy + dy / z };
    posicionar();
  });
  const soltar = (e: PointerEvent) => {
    toques.delete(e.pointerId);
    if (toques.size < 2) pinca = null;
    if (arraste?.moveu) engolirClique = true;
    arraste = null;
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointerleave', soltar);
  palco.addEventListener('pointercancel', (e) => {
    toques.delete(e.pointerId);
    pinca = null;
    arraste = null;
  });
  // o clique que vem no fim de um arraste ou de uma pinça não escolhe nó
  palco.addEventListener('click', (e) => {
    if (!engolirClique) return;
    engolirClique = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  // a rodinha do mouse aproxima e afasta (no PC)
  palco.addEventListener('wheel', (e) => {
    if (!aberta()) return;
    e.preventDefault();
    mudarZoom(e.deltaY < 0 ? PASSO_ZOOM : 1 / PASSO_ZOOM);
  }, { passive: false });
  // no documento: o foco pode ter saído da árvore (o Comprar virou "Comprado", clicou no céu) e o Esc ainda fecha
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !aberta()) return;
    e.preventDefault();
    fechar();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (aberta()) desenhar(); }).observe(palco);

  /** O próximo de um ramo: o 1º que não é seu (o infinito que você tem segue sendo o próximo); a Raiz é a raiz. */
  function irPraRamo(ramo: number) {
    if (!estado) return;
    const c = contextoArvore(estado);
    const nos = RAMOS_ARVORE[ramo].nos;
    const alvo = nos.find((n) => situacaoTela(n, c) !== 'comprado') ?? nos[nos.length - 1];
    escolhido = alvo.id;
    centrar(alvo.id);
    desenhar();
  }

  function desenharFileira() {
    const n = catalogo.arvore.find((x) => x.id === escolhido);
    const atual = n ? ramoDoNo(n) : null;
    fileira.replaceChildren(...FILEIRA.map((ramo) => {
      const b = button('', `ramo-botao${atual === ramo ? ' ativo' : ''}`, () => irPraRamo(ramo));
      b.setAttribute('aria-pressed', String(atual === ramo));
      b.append(iconeNo(RAMOS_ARVORE[ramo].nos[0]), el('span', 'nome', RAMOS[ramo]));
      return b;
    }));
  }

  function desenharCartao(s: IdleState, c: ContextoArvore, sits: Map<number, SituacaoTela>) {
    cartao.replaceChildren();
    const n = catalogo.arvore.find((x) => x.id === escolhido);
    if (!n) return;
    const sit = sits.get(n.id)!;
    const ic = iconeNo(n);
    ic.classList.add(sit, formaDe(n));
    const texto = el('div', 'meio');
    texto.append(el('strong', undefined, n.nome), el('span', 'onde', ondeNo(n)), el('p', undefined, n.efeito));
    if (n.cresce !== null) {
      const nv = nivelNo(n, c);
      texto.append(el('span', 'nivel', `Nível ${nv} → ${nv + 1} · ${precoNo(n, c)} ★`));
    }
    const acao = el('div', 'arvore-acao');
    if (sit === 'comprado') acao.append(el('span', 'no-feito', 'Comprado'));
    else if (sit === 'trancado') acao.append(el('span', 'sub', falta(n)));
    else if (sit === 'portao') {
      const motivo = el('span', 'portao-motivo');
      motivo.append(el('i', 'cadeado'), document.createTextNode(portao(n, c) ?? ''));
      acao.append(motivo);
    } else {
      const preco = precoNo(n, c);
      const b = button(sit === 'pode' ? `Comprar · ${preco} ★` : faltam(preco - s.pontos), 'btn main', () => comprar(n.id));
      b.disabled = sit !== 'pode' || ocupado;
      acao.append(b);
    }
    cartao.append(ic, texto, acao);
  }

  function desenhar() {
    if (!estado) return;
    const s = estado;
    const c = contextoArvore(s);
    const sits = situacoes(c);
    const kk = k();
    const W = MUNDO_ARVORE.largura * kk;
    const H = MUNDO_ARVORE.altura * kk;
    mundo.style.width = `${W}px`;
    mundo.style.height = `${H}px`;
    mundo.style.marginLeft = `${-W / 2}px`;
    mundo.style.marginTop = `${-H / 2}px`;
    mundo.style.setProperty('--z', String(Math.min(1, kk)));
    mundo.classList.toggle('sem-rotulos', kk < ZOOM_ROTULOS);
    // o foco fica no mesmo nó depois de redesenhar
    const focado = (document.activeElement as HTMLElement | null)?.dataset?.no;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('aria-hidden', 'true');
    ligacoes(svg, sits, c, kk);
    const filhos: Element[] = [svg];
    for (const r of ROTULOS_ARVORE) {
      const t = el('span', 'arvore-ramo', r.nome);
      t.style.left = `${r.x * kk}px`;
      t.style.top = `${r.y * kk}px`;
      filhos.push(t);
    }
    for (const n of catalogo.arvore) {
      const sit = sits.get(n.id)!;
      const [x, y] = POSICOES_ARVORE[n.id];
      const tem = c.arvore.includes(n.id);
      const nivelado = n.cresce !== null && tem;
      const b = button('', `no-arvore ${sit} ${formaDe(n)}${nivelado ? ' nivelado' : ''}${escolhido === n.id ? ' escolhido' : ''}`, () => {
        escolhido = n.id;
        desenhar();
      });
      b.dataset.no = String(n.id);
      b.style.left = `${x * kk}px`;
      b.style.top = `${y * kk}px`;
      b.setAttribute('aria-label', descricaoNo(n, sit, c));
      b.setAttribute('aria-pressed', String(escolhido === n.id));
      b.append(iconeNo(n));
      if (sit === 'pode' || sit === 'falta') b.append(el('span', 'no-custo', `${precoNo(n, c)} ★`));
      if (sit === 'portao') b.append(el('span', 'no-cadeado'));
      if (nivelado) b.append(el('span', 'no-nivel', `nv ${nivelNo(n, c)}`));
      ligarDica(b, `no-${n.id}`, () => (estado ? dicaNo(estado, n) : null));
      filhos.push(b);
    }
    mundo.replaceChildren(...filhos);
    if (focado) mundo.querySelector<HTMLElement>(`[data-no="${focado}"]`)?.focus();
    posicionar();
    pontosTopo.textContent = `★ ${s.pontos}`;
    pontosTopo.setAttribute('aria-label', `${pontos(s.pontos)} pra gastar`);
    zoomMenos.disabled = kk <= minimo() + 1e-9;
    zoomMais.disabled = kk >= ZOOM_MAX - 1e-9;
    desenharFileira();
    desenharCartao(s, c, sits);
  }

  function fechar() {
    if (!aberta()) return;
    tela.setAttribute('hidden', '');
    volta()?.focus();
  }

  return {
    elemento: tela,
    aberta,
    abrir(s, ocup, v, no) {
      estado = s;
      ocupado = ocup;
      volta = v;
      escolhido = no ?? noInicial(contextoArvore(s));
      zoom = 1;
      tela.removeAttribute('hidden');
      centrar(escolhido);
      desenhar();
      fecharB.focus();
    },
    fechar,
    renderizar(s, ocup) {
      estado = s;
      ocupado = ocup;
      if (aberta()) desenhar();
    },
  };
}
```

- [ ] **Step 5: O quadro do Legado (`tela.ts`) e o `?mock`**

`tela.ts`:
1. Troque `import { criarArvoreTela, miniArvore } from './arvoreTela';` por `import { copaBarras, criarArvoreTela, iconeNo } from './arvoreTela';` e, no import de `./legado`, acrescente `noInicial, precoNo`.
2. Em `CLIQUE` (l. 171), acrescente `, .ramo-botao, .arvore-zoom .btn` no fim da string.
3. Troque `const arvore = criarArvoreTela((id) => a.comprarNo(id));` por `const arvore = criarArvoreTela((id) => a.comprarNo(id), dicas.ligar); // a caixinha dos nós (mouse/teclado)`.
4. No `legado(s, ocupado)`, troque do `const comprados = s.bonus.arvore.length;` até `quadro.append(miniArvore(s), textoQ);` por:

```ts
    const c = contextoArvore(s);
    const comprados = s.bonus.arvore.length;
    const podem = catalogo.arvore.filter((n) => situacaoTela(n, c) === 'pode').length;
    const quadro = el('div', 'arvore-quadro');
    const textoQ = el('div', 'meio');
    // o botão de ação traz o próximo nó (o mais barato que dá pra comprar; senão o mais barato liberado) e abre nele
    const prox = catalogo.arvore.find((n) => n.id === noInicial(c))!;
    const abrirB = button('', 'btn main arvore-abrir', () =>
      arvore.abrir(s, ocupado, () => listaL.querySelector<HTMLElement>('.arvore-abrir'), prox.id));
    abrirB.append(iconeNo(prox), el('span', undefined, `${prox.nome} · ${precoNo(prox, c)} ★`));
    abrirB.setAttribute('aria-label', `Abrir a árvore em ${prox.nome}, ${precoNo(prox, c)} ★`);
    textoQ.append(
      el('strong', undefined, 'Árvore de habilidades'),
      el('span', 'sub', `★ ${s.pontos} livres · ${comprados} de ${catalogo.arvore.length} comprados${podem ? ` · ${podem} dá pra comprar agora` : ''}`),
      abrirB,
    );
    quadro.append(copaBarras(s), textoQ);
```

`main.ts`: depois de `import './eras67.css';`, acrescente `import './arvore.css';`.

`games/dev/mockIdle.ts`: no tipo de `w`, acrescente `__arvore: (pontos?: number, vendas?: number, era?: number) => Promise<void>;` e, depois de `w.__pontos = …;`:

```ts
// __arvore(50000, 10, 7) deixa a árvore grande toda à vista: pontos livres, vendas e a maior era (os portões)
w.__arvore = async (pontos = 50_000, vendas = 10, era = 7) => {
  await dono('update public.idle_state set prestige_earned = prestige_spent + $2, prestige_count = $3, era_max = $4 where user_id = $1',
    [ME, pontos, vendas, era]);
  document.dispatchEvent(new Event('visibilitychange'));
};
```

e no painel do mock, junto dos outros botões, um `Árvore cheia de pontos` que chama `w.__arvore()` (mesmo estilo dos botões das eras).

- [ ] **Step 6: `arvore.css`**

Crie `games/idle/arvore.css`:

```css
/* Árvore grande (16/10, entrega 6): a copa de 120 nós, a fileira de ramos, o zoom, o cartão e o quadro do Legado. Fora do
   idle.css; usa os tokens dele (--i-*, --paper, --gold, var(--i-pixel)) e os cantos de pixel (o --c + 4 sombras sem
   desfoque). Hierarquia por tamanho e forma; o estado tem forma além da cor (spec §7). Roxo cheio só no botão de ação. */

.idle .arvore-tela { grid-template-rows: auto auto minmax(0, 1fr); }

/* topo: o zoom entre o título e os pontos */
.idle .arvore-zoom { display: flex; gap: 6px; margin-left: auto; }
.idle .arvore-zoom .btn { min-width: 40px; min-height: 40px; padding: 0; font-size: 24px; }

/* a fileira de ramos: parada enquanto a copa arrasta; rola na horizontal no celular; o ativo com traço lilás embaixo */
.idle .arvore-fileira { display: flex; gap: 6px; padding: 0 12px 8px; overflow-x: auto; scroll-snap-type: x proximity; scrollbar-width: none; }
.idle .arvore-fileira::-webkit-scrollbar { display: none; }
.idle .ramo-botao { flex: none; display: grid; justify-items: center; gap: 2px; min-width: 64px; min-height: 52px; padding: 4px 6px; border: 0;
  background: var(--i-painel); color: var(--i-mudo); font: 400 15px var(--i-pixel); cursor: pointer; scroll-snap-align: center; --c: var(--i-borda);
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
.idle .ramo-botao .icone-legado { width: 24px; height: 24px; }
.idle .ramo-botao.ativo { color: var(--paper); --c: var(--i-borda2); box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c), inset 0 -3px 0 var(--i-lilas); }
.idle .ramo-botao:hover { color: var(--paper); }
.idle .ramo-botao:focus-visible { outline: 2px solid var(--i-lilas); outline-offset: 2px; }

/* o tamanho segue o zoom até 1 (--z vem do arvoreTela.ts): longe, os nós viram quadradinhos que ainda dão pra ler */
.idle .arvore-mundo { --z: 1; }
.idle .arvore-mundo .no-arvore { --lado: calc(52px * var(--z)); width: var(--lado); height: var(--lado); margin: calc(var(--lado) / -2) 0 0 calc(var(--lado) / -2); }
.idle .arvore-mundo .no-arvore .icone-legado { width: calc(48px * var(--z)); height: calc(48px * var(--z)); }
.idle .arvore-mundo.sem-rotulos .arvore-ramo { display: none; }
.idle .arvore-mundo.sem-rotulos .no-custo, .idle .arvore-mundo.sem-rotulos .no-nivel { display: none; }

/* forma: o nó 10 é 1,5× com moldura dupla */
.idle .no-arvore.grande { --lado: calc(78px * var(--z)); }
.idle .no-arvore.grande .icone-legado { width: calc(64px * var(--z)); height: calc(64px * var(--z)); }
.idle .no-arvore.grande { box-shadow: 0 -3px 0 0 var(--c), 0 3px 0 0 var(--c), -3px 0 0 0 var(--c), 3px 0 0 0 var(--c),
  0 -7px 0 0 #0C0B17, 0 7px 0 0 #0C0B17, -7px 0 0 0 #0C0B17, 7px 0 0 0 #0C0B17,
  0 -9px 0 0 var(--c), 0 9px 0 0 var(--c), -9px 0 0 0 var(--c), 9px 0 0 0 var(--c); }
/* o infinito: um losango de pixel (o quadrado girado), o ícone de pé dentro, o nível embaixo */
.idle .no-arvore.infinito { --lado: calc(60px * var(--z)); transform: rotate(45deg); }
.idle .no-arvore.infinito > * { transform: rotate(-45deg); }
.idle .no-arvore.infinito .icone-legado { width: calc(40px * var(--z)); height: calc(40px * var(--z)); }
.idle .no-nivel { position: absolute; top: 100%; left: 50%; translate: -50% 10px; font: 400 16px var(--i-pixel); color: var(--paper); white-space: nowrap;
  text-shadow: 1px 1px 0 #000; pointer-events: none; }
/* a ponte: moldura de "trilho" (traços em cima e embaixo), menor que o comum */
.idle .no-arvore.ponte { --lado: calc(46px * var(--z)); box-shadow: 0 -3px 0 0 var(--c), 0 3px 0 0 var(--c), -3px 0 0 0 var(--c), 3px 0 0 0 var(--c),
  0 -6px 0 0 #0C0B17, 0 6px 0 0 #0C0B17, 0 -8px 0 0 var(--c), 0 8px 0 0 var(--c); }
.idle .no-arvore.ponte .icone-legado { width: calc(40px * var(--z)); height: calc(40px * var(--z)); }

/* estado com forma: comprado cheio (fundo e ícone acesos, sem o preço); dá pra comprar com traço lilás e o preço na moedinha;
   falta ponto com o preço apagado; portão com cadeado; trancado em silhueta escura */
.idle .no-arvore.comprado { --c: var(--gold); background: #2A2414; }
.idle .no-arvore.portao { --c: #5C5677; background: #13121B; }
.idle .no-arvore.portao .icone-legado { filter: grayscale(0.7) brightness(0.6); }
.idle .no-arvore.trancado .icone-legado { filter: brightness(0) opacity(0.55); }
.idle .no-custo { padding: 0 5px 0 15px; background: #15131F no-repeat 3px 50% / 9px 9px;
  background-image: radial-gradient(circle at 50% 50%, var(--gold) 0 3px, #8A6A1E 3px 4.5px, transparent 4.5px); }
.idle .no-arvore.falta .no-custo { color: #8F86B8; background-image: radial-gradient(circle at 50% 50%, #5C5677 0 3px, #34314A 3px 4.5px, transparent 4.5px); }
.idle .no-cadeado { position: absolute; right: -6px; bottom: -6px; width: 12px; height: 12px; pointer-events: none;
  background: linear-gradient(#C9C2E8 0 0) 2px 5px / 8px 7px no-repeat, linear-gradient(transparent 0 0);
  box-shadow: inset 0 0 0 0 transparent; }
.idle .no-cadeado::before { content: ''; position: absolute; left: 3px; top: 0; width: 6px; height: 6px; box-shadow: inset 0 0 0 2px #C9C2E8; }
.idle .no-arvore.infinito .no-cadeado { right: auto; bottom: auto; }
/* o caminho comprado de cada ramo acende e engrossa */
.idle .ligacao.acesa { stroke: var(--gold); stroke-width: 5; }
.idle .ligacao.portao { stroke: #4A4560; stroke-dasharray: 2 4; }

/* a legenda com as mesmas formas */
.idle .arvore-legenda .portao i { --c: #5C5677; }

/* o cartão: hierarquia por tipografia (nome grande, efeito, preço, portão), sem borda colorida num lado só */
.idle .arvore-cartao strong { font-size: 26px; line-height: 1; }
.idle .arvore-cartao > .icone-legado.grande { box-shadow: 0 0 0 3px var(--gold); }
.idle .arvore-cartao .nivel { display: block; margin-top: 6px; font: 400 18px var(--i-pixel); color: var(--paper); }
.idle .portao-motivo { display: flex; align-items: center; gap: 8px; font-size: 15px; color: var(--paper); }
.idle .portao-motivo .cadeado { position: relative; flex: none; width: 12px; height: 12px;
  background: linear-gradient(#C9C2E8 0 0) 2px 5px / 8px 7px no-repeat; }
.idle .portao-motivo .cadeado::before { content: ''; position: absolute; left: 3px; top: 0; width: 6px; height: 6px; box-shadow: inset 0 0 0 2px #C9C2E8; }

/* o quadro do Legado: a silhueta de 10 barrinhas e o botão com o próximo nó dentro */
.idle .copa-barras { display: flex; align-items: flex-end; gap: 4px; height: 84px; padding: 6px 4px 0; }
.idle .copa-barras .barra { flex: 1; height: calc(var(--alto) * 100%); background: #1E1C2A;
  background-image: linear-gradient(to top, var(--gold) var(--cheio), transparent var(--cheio)); --c: #3A3654;
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
.idle .copa-barras .barra.cheia { --c: var(--gold); }
.idle .arvore-quadro .arvore-abrir { display: flex; align-items: center; justify-content: center; gap: 8px; }
.idle .arvore-quadro .arvore-abrir .icone-legado { width: 32px; height: 32px; }

@media (prefers-reduced-motion: reduce) {
  .idle .arvore-fileira { scroll-behavior: auto; }
}
```

(As cores com hex são as do jogo que o `idle.css` já usa pra árvore: `#15131F`, `#2A2414`, `#3A3654`, `#5C5677`, `#8F86B8`, `#0C0B17`; o lilás e o dourado vêm dos tokens. O cadeado é pixel: arco de 2 px e corpo de 8×7.)

- [ ] **Step 7: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`
Expected: PASS.

- [ ] **Step 8: Navegador e Taste Engine**

Suba o vite (`cd games && npx vite --port 5199`, em segundo plano) e abra `http://localhost:5199/games/idle/?mock` no Chrome do Juan. **Antes de tudo**, no console: `localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')` e recarregue. Rode `__era(7)` e `__arvore()`; abra o Legado: as 10 barrinhas e o botão com o próximo nó; abra a árvore. Confira: a copa inteira no zoom mínimo, o +/−, a rodinha, a fileira (toque num ramo centraliza o próximo), as formas (nó 10 com moldura dupla, infinito em losango com o nível, ponte), os 5 estados com forma (cadeado no portão; moedinha no preço; silhueta no trancado), o cartão (nome grande, efeito, nível → próximo, motivo do portão), a caixinha no mouse e no Tab (nada no toque), comprar um nó de cada tipo (fixo, ponte, infinito duas vezes). Em 1280×720, em 2000×961 e no celular (iframe de 390 px na mesma origem: pinça, arraste, toque; a fileira rola; o botão de comprar só no toque nele).

Taste Engine: `ToolSearch` com `select:mcp__taste-engine__lookup_slop` e descreva cada escolha (uma consulta por escolha). No mínimo: (1) "árvore de 120 ícones de pixel em colunas que sobem de uma raiz, com tamanhos diferentes: nó comum, nó maior com moldura dupla, losango pros infinitos, moldura de trilho pras pontes"; (2) "estado do nó por forma e cor: moldura dourada cheia comprado, traço lilás com preço numa moedinha dá pra comprar, preço apagado falta ponto, cadeado pixel com portão, silhueta escura trancado"; (3) "fileira fixa de 11 botões de ramo com ícone e nome, rolando na horizontal no celular, o ativo com traço lilás embaixo, e botões + e − de zoom no topo"; (4) "quadro de resumo com a silhueta da copa feita de 10 barrinhas de progresso e um botão roxo com o ícone e o nome do próximo nó"; (5) "cartão de detalhe com o nome grande em fonte pixel, o efeito, 'nível 7 → 8' e o preço, e o motivo do portão com cadeado, sem borda colorida num lado só"; (6) "caixinha de informação do nó com 'antes → depois' do efeito e o ganho em F$/s". Corrija o que ele marcar como cara de IA **dentro do visual do jogo** (pixel, Jersey 10, cantos de pixel); ignore regra de site. Regras fixas: roxo cheio só no botão de ação; ativo = traço lilás; nada de rótulo com fundo dourado cheio (a moedinha é um ícone, o texto do preço fica em fundo escuro). No relatório: cada consulta, o veredito e o que mudou. Mostre ao Juan rodando local (PC e celular) antes de qualquer publicação.

Feche o vite de verdade (`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*vite*--port 5199*' } | % { Stop-Process -Id $_.ProcessId -Force }`) e confira que não sobrou node.

- [ ] **Step 9: Commit**

```bash
git add games/idle/legado.ts games/idle/legado.test.ts games/idle/arvoreTela.ts games/idle/arvoreTela.test.ts games/idle/arvore.css games/idle/main.ts games/idle/tela.ts games/idle/tela.test.ts games/idle/dica.ts games/idle/dica.test.ts games/dev/mockIdle.ts
git commit -m "Fellas Inc.: a tela da árvore grande (copa gerada, zoom, fileira de ramos, formas e estados, cartão, caixinha) e o quadro do Legado"
```

---
### Task 11: Patch notes e verificação final (sem publicar)

**Files:**
- Modify: `games/idle/novidades.ts` (entrada nova no começo), `games/idle/novidades.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–10.
- Produces: o branch `arvore-grande` pronto pro controlador publicar com o Juan (db push 0081 + 0082, merge na main, push). **Esta task não publica.**

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-arvore && git merge main
```

Resolver a favor da main. Se a main trouxe migração nova além da 0080, confira que `0081`/`0082` continuam livres (`git ls-tree --name-only main supabase/migrations/ | tail -3`); se não, renumere as duas (arquivos, `db.ts`, `mockDb.ts`, o `ATUALIZAR_CATALOGO`, os comentários que citam o número) e rode tudo de novo. Se a 0080 redefiniu alguma função que a 0082 copia (Decisão 1), a cópia da 0082 tem que partir da 0080: confira com `git show main:supabase/migrations/0080_*.sql | grep "function public"`.

- [ ] **Step 1: Patch notes (teste primeiro)**

Em `games/idle/novidades.test.ts`, no teste `'a mais nova é a das eras 6 e 7; …'` (ou o que estiver no lugar dele depois do merge), troque o título por `'a mais nova é a da árvore grande; depois, as de antes na mesma ordem'`, acrescente na 1ª linha `expect(NOVIDADES[0]).toMatchObject({ id: '2026-10-16-arvore-grande', titulo: 'A árvore grande' });` e some 1 em todo índice que ele confere (`NOVIDADES[0]` → `NOVIDADES[1]`, …, `slice(9, 17)` → `slice(10, 18)`). Acrescente:

```ts
  it('a nota da árvore grande não conta as escondidas nem o segredo, e dá os números certos', () => {
    const texto = NOVIDADES.find((n) => n.id === '2026-10-16-arvore-grande')!.itens.join(' ');
    for (const nome of ['Sillas', 'escondida', '6-7', 'Daisy', 'monolito']) expect(texto).not.toContain(nome);
    expect(texto).toContain('120 nós');
    expect(texto).toContain('3 vendas');
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/novidades.test.ts`. Expected: FAIL.

Em `games/idle/novidades.ts`, no começo de `NOVIDADES` (data do dia da publicação; se não for 16/10, troque o `id` e a `data` aqui e no teste):

```ts
  {
    id: '2026-10-16-arvore-grande',
    titulo: 'A árvore grande',
    data: '2026-10-16',
    itens: [
      'A árvore de habilidades cresceu de 31 pra 120 nós. Os 31 de antes continuam iguais: ninguém perde o que comprou.',
      'Cada ramo de antes ganhou os nós 6 a 10 (os 6 e 7 pedem 3 vendas; do 8 em diante, ter chegado na era 7 alguma vez).',
      'Quatro ramos novos, que abrem junto com o recurso: Bolsa, PPP Podcast, Mapa do rolê e Espaço. Corretagem menor, espiada grátis por dia, mais trocas de convidado, cadeiras mais fortes, lugares mais baratos, Silver tape ×5 e geradores das eras 6 e 7 rendendo o dobro.',
      'Os nós novos de produção somam entre si: o Coach quântico, a Planilha com macro, o Faria Limer e as 9 pontes entre os ramos vizinhos.',
      'Cada ramo tem um nó infinito no fim: compra quantas vezes quiser, cada nível um pouco mais caro (pede 10 vendas).',
      'A tela da árvore é nova: dá pra aproximar e afastar (pinça ou + e −), pular de ramo pela fileira de cima, e o quadro do Legado mostra quanto de cada ramo você já tem.',
      'No PC, passar o mouse num nó mostra o que ele muda nos seus números agora.',
    ],
  },
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/novidades.test.ts`. Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add games/idle/novidades.ts games/idle/novidades.test.ts
git commit -m "Fellas Inc.: patch notes da árvore grande"
```

- [ ] **Step 3: Verificação completa**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-arvore
npx tsc --noEmit
npm test
cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4
```

Expected: tudo PASS (a suíte inteira dos jogos, uns 3–4 min com o veterano). Depois, `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`: nenhum node sobrando desta sessão.

- [ ] **Step 4: Conferência no navegador (mudo)**

Vite em segundo plano (`cd games && npx vite --port 5199`), `http://localhost:5199/games/idle/?mock`, mutar antes (`localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')`, recarregar). Caminho: `__era(7)` e `__arvore()` → Legado (barrinhas, o botão com o próximo nó) → a árvore (zoom mínimo com a copa inteira, fileira, comprar um nó de cada forma, infinito duas vezes, portão com o motivo) → a Bolsa (limite com "com a árvore", espiada grátis), o PPP (trocas e a força das cadeiras), o Mapa (preço com desconto), um evento do Espaço pelo painel (janela dobrada, Silver ×5). Em 1280×720, 2000×961 e no iframe de 390 px. Mate o vite de verdade e confira que não sobrou node.

- [ ] **Step 5: Relatório pro controlador (sem publicar)**

Liste: commits do branch; os preços finais (Decisão 2) e o dia em que o veterano fecha a parte fixa na simulação; o **×26,9 da árvore cheia** (Decisão 3) e o **efeito dos convidados** (Decisão 5) pro Juan decidir; a arte pra aprovação (Task 9, Step 5); as consultas do Taste Engine (Task 10). A publicação é do controlador com o Juan: conferir `supabase migration list` e os números 0081/0082 livres, o Juan roda o `db push` só dessas duas, conferir as colunas novas pela REST (`idle_state.era_max`, `idle_state.info_gratis_n`, `idle_arvore.nivel`, `idle_cat_no.requer2`/`req_vendas`/`req_era`/`cresce`) e as contagens (`idle_cat_no` = 120; `idle_state` com `era_max` ≥ a era de agora em todas as linhas), merge na main e push, conferir o `gh run list`.
