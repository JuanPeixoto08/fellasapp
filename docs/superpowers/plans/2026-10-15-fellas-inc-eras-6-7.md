# Fellas Inc.: eras 6 (Em órbita) e 7 (Lua) (entrega 1 das eras 6–12) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os geradores 31–42 (eras 6 e 7) com melhorias, estratégias, gerais, legado, conquistas 140–159, os eventos Lixo espacial e Houston, a cena da Lua com o monolito, as músicas e os sons das eras 6 e 7, os nomes dos números até o centilhão e a régua de ritmo das 12 eras.

**Architecture:** O mesmo desenho das entregas 4 e 5. O catálogo nasce de `nomes.ts` → `catalogo.ts` → migração gerada (0077); a conta da página (`economia.ts`) e a do banco (`idle_gen_rendas`, `idle_settle`) andam juntas com teste de paridade em PGlite. O banco confere e paga (0078: estado com 42 geradores e 6 estratégias, legado, Silver tape, eventos 6–7 aceitos com a era anterior, conquistas). A cena ganha "peças" (desenhos que aparecem quando você tem o gerador ou a conquista) e a música das eras 6–7 é um módulo à parte com órgão aditivo, sala de convolução e humanização com semente.

**Tech Stack:** TypeScript (Vite, sem framework), Vitest + PGlite (banco de teste), Postgres/Supabase (plpgsql), Web Audio (sintetizado, sem arquivo), Node puro pros scripts de arte (`../fellas-inc-esbocos`).

**Spec:** `docs/superpowers/specs/2026-10-15-fellas-inc-eras-6-7-design.md`

## Decisões do plano

O que o plano decidiu onde a spec contradiz o código, é impossível ou não fecha a conta. A spec não foi mudada.

1. **Calibração feita ao planejar (os números da Task 1 são os finais).** Só os fatores de crescimento a partir do gerador 30 não chegam no alvo: com qualquer `crescimentoCusto` de 1,8 a 2,6 a era 6 cai no dia 11–12 e a era 7 não sai em 20 dias (o jogador da simulação não guarda dinheiro: compra o melhor F$/s por F$). Por isso o 2º trecho tem custo e retorno próprios: `PARAMETROS_ESPACO = { aPartirDe: 31, custoInicial: 6e14, crescimentoCusto: 1.6, retornoInicial: 2.5e6, crescimentoRetorno: 1.45 }` (gerador 31: F$ 600 tri, rende F$ 240 mi/s por unidade). Medido ao planejar (simulação de 20 dias, com gerais 1,3/1,3/1,35/1,35 e 1,35/1,35/1,4/1,4, legado `p` = 0,05% e estratégias ×2): **era 6 em 10,5 dias, era 7 em 16,0 dias** (oportunidades de ~20,4 min, o jogo de hoje) e 10,5 / 16,7 com as de 15 min. Os ritmos antigos continuam (era 5 no dia 3, gerador 30 no dia 8, 17–18 pontos na 1ª semana, volta com razão 0,90). A Task 2 trava esses números; se algum sair do alvo na execução, ajuste só `PARAMETROS_ESPACO`, `LEGADO_P`, `GERAL_6`, `GERAL_7` e `EST_6_GEN`/`EST_7_GEN`, regere a **mesma** 0077 (ainda não publicada) e avise.
2. **Inflação dos pontos de prestígio (avisar o Juan).** Pra era 7 sair no dia 16 o F$/s precisa crescer ~×400.000 entre os dias 10 e 20 (de ~1,7e10 pra ~6,5e15, medido). Com a fórmula de hoje (`cbrt(F$/s ÷ 1e6)`), vender no dia 14 dá ~150 pontos e no dia 20 ~1.900 (a árvore inteira custa 355). A spec não fala de prestígio e a entrega 6 (árvore) é quem resolve; o plano não mexe, só registra no relatório final.
3. **As colunas `fonte_era`/`alvo_era` e o tipo `legado` em `idle_cat_upg` nascem na 0077 (gerada), não na 0078.** A 0077 insere as linhas do legado e roda antes da 0078; sem a coluna e sem o tipo no `check` o insert falha. O SQL gerado ganha `alter table … add column if not exists` e troca o `check` (`drop constraint if exists idle_cat_upg_tipo_check` + `add constraint`), idempotente.
4. **"Vagas dos geradores" não existem no código.** Hoje o `cena-N-vagas.json` só tem lugares de **pessoas** (dono e contratados). O plano cria **peças de cena**: uma lista `pecas` (`{ id, x, y }`) no mesmo JSON e uma tira `cena-N-peca-<id>.png` (os quadros da cena lado a lado). A peça `g31`…`g42` aparece quando você tem 1 do gerador; `monolito` aparece com a conquista 158. A cena 6 mantém as 4 vagas de gente e ganha 6 peças; a cena 7 ganha vagas de gente (você + 3 contratados, como a 6), 6 peças e o monolito.
5. **Aceitar o evento da era anterior exige saber o que a página mostrou.** O banco não tem como escolher sozinho quando os dois sorteios dão tipos diferentes. `idle_evento_pegar` ganha `p_tipo int default null` (a de 2 argumentos sai com `drop function if exists`): vale se `p_tipo` sai com a era de agora ou com a anterior; outro tipo dá `idle_evento_gone`; sem `p_tipo` (página velha) é o comportamento da 0074.
6. **Estado com 42 geradores.** Além das 6 estratégias, a 0078 completa `generators` com zeros até 42 (default novo) e a compra, a melhoria e as estratégias tratam posição faltando como 0/-1 (`coalesce`). Sem isso, `generators[31] := null + 1` dava nulo e uma estratégia nula passava pelo "estratégia pendente".
7. **Satélites de internet (1,5):** desde a 0063 os tipos contados da Caixinha (×5, metade, cupons, Chamar, Adubo, Cashback, Informação) usam `round(mult)`, e `round(1,5) = 2`: eles vêm em dobro; só as de F$ rendem 50% a mais. A frase da estratégia diz isso.
8. **Frase de gerador** existe só pros 31–42 (`FRASES_GERADOR` em `nomes.ts`, só da página; o banco não precisa). Aparece na caixinha e numa linha da Loja (que também vale no celular, onde não tem caixinha).
9. **Ícones:** a melhoria de legado não ganha arte (mostra o 1º gerador da era fonte e o da era alvo, como a sinergia). As 8 gerais novas (1021–1028) ganham ícone 16×16, como todas as gerais de hoje (a spec não listou).
10. **Houston na conta da página** entra pela lista `outros: FatorTempo[]` de `produzido` (o mesmo caminho do LinkedIn e do Combo; a conta é a da Marmita: multiplica por cima, só o fim importa). `fatoresTempo` (store.ts) põe o ×4.
11. **Lixo espacial** usa o `p_gols`/`evento.gols` pra levar os desvios (a spec: "como os gols").
12. **Música das eras 6–7:** módulo próprio (`audio/musicaEspaco.ts`), 16 compassos de 4/4: Órbita 66 bpm (Fá maior com a quarta aumentada), Lua 60 bpm (Ré menor). O reverb de convolução é um **envio** (o seco continua igual): molhado 0 nas eras 0–5 (o swing não muda), 0,45 nas 6–7. O órgão é uma `PeriodicWave` (parciais somadas) em duas camadas desafinadas. As melodias e harmonias estão escritas no plano (originais). A fanfarra usa o motivo de *Assim Falou Zaratustra* (R. Strauss, 1896) e a valsa o do *Danúbio Azul* (J. Strauss II, 1867): domínio público.
13. **A fanfarra dura 6 s** (o teste dos efeitos pede menos de 3 s): exceção só pra ela.
14. **Arte:** desenhada por scripts novos em `../fellas-inc-esbocos` (o processo das entregas 2–4: `cena-util.js`, contorno preto, conferência). O plano fixa tamanho, motivo, paleta, animação, posição e os testes de formato; os pixels saem na execução, com as folhas de conferência, e o Juan aprova antes de publicar.
15. **Conquista "estratégia_era"** (as opções de uma era) fica mais fácil nas eras 6–7 (2 opções). Mantido: a spec quer 2 opções.
16. **Números:** "googol" de 10¹⁰⁰ até antes de 10¹⁰³ (1 a 999 googol); o centilhão vai até "999 centi" (< 10³⁰⁶); a notação científica começa em 10³⁰⁶.
17. **Esboço das 12 eras:** "8–9 dias por era" e "era 12 no dia 52" não cabem juntos (da era 7 no dia 16 até o dia 52 são ~7,2 dias por era). Fica registrado `RITMO_ERAS = { 6: 10, 7: 16, 8: 24, 9: 31, 10: 38, 11: 45, 12: 52 }` e `FIM_ERA_12 = 60` (a era 12 dura 8).
18. **Ordem e tamanho:** 11 tasks (a sugestão era 9). A simulação vem logo depois do catálogo porque os números já saíram calibrados (Decisão 1); a arte (Task 7) vem antes das telas porque a Loja e a cena usam os ícones e as peças; as telas viram duas tasks (Loja/Legado e eventos), cada uma com o Taste Engine. `git merge main` também no começo das Tasks 1 e 6 (mexem pouco em `tela.ts`/`main.ts`), além das telas e da final.
19. **Estratégias das eras 6–7 sem caixinha:** o cartão já mostra o efeito inteiro (regra do CLAUDE.md: não entra onde o item já mostra tudo).

## Global Constraints

- Worktree `C:\Users\juan\Documents\PROJETOSLLM\fellasapp-eras67` (branch `eras-6-7`). **Nunca mexer em `C:\Users\juan\Documents\PROJETOSLLM\fellasapp`** (outra sessão faz o redesenho visual direto na `main`). O `.env` e o `supabase/.temp` já estão no worktree. Passo 0 da Task 1: `npm ci` de verdade (não junction) na raiz e em `games/`.
- `git merge main` no começo das Tasks 1, 6, 8, 9 e 11, resolvendo conflito **a favor do visual da main** (reponha por cima só as linhas deste plano). Telas: o mínimo em `tela.ts`, `main.ts` e nenhuma linha em `idle.css`; CSS novo em `games/idle/eras67.css` (importado no `main.ts` depois do `caixinha.css`), com os tokens do `idle.css` (`--i-*`, `--paper`, `var(--i-pixel)`) e cantos de pixel (contorno por 4 sombras sem desfoque). Hex só nos ícones de pixel e no vermelho do alarme.
- **Taste Engine nas telas (Tasks 8 e 9):** carregar `mcp__taste-engine__lookup_slop` com `ToolSearch` (`select:mcp__taste-engine__lookup_slop`), descrever cada escolha de design, corrigir o que ele marcar como cara de IA dentro do visual do jogo (pixel, Jersey 10, cantos de pixel), ignorar regra que só vale pra site e registrar cada consulta e o que mudou no relatório da task. Regras fixas: **roxo cheio só em botão de ação**; aba ativa e chave ligada = traço lilás; **nenhum rótulo com fundo dourado/amarelo cheio**.
- Texto da interface em pt-BR, no tom do jogo; humor ácido pode, **sem fato falso sobre pessoa real** (o gerador 38 fala da teoria, não acusa ninguém). O easter egg do Sillas nunca aparece em texto.
- Migrações novas: `0077_fellas_inc_catalogo_eras_6_7.sql` (gerada com `ATUALIZAR_CATALOGO`, nunca à mão) e `0078_fellas_inc_eras_6_7.sql` (à mão: parte A estado/conta/compra, parte B Houston, parte C eventos/conquistas). Números conferidos livres em todos os branches em 15/10; conferir de novo antes do push. Nunca editar migração antiga (0076 pra trás). As duas entram em `games/test/db.ts` (array `MIGRATIONS`) e em `games/dev/mockDb.ts` (import `?raw` + array do `for`).
- **Base de cada redefinição** (copiar a função INTEIRA da linha indicada até o `$$;` dela, mudar só o que o plano mostra, manter `revoke`/`grant`): `idle_upg_unlocked` (0034, l. 279–286), `idle_pick_strategy` (0038, l. 310–353), `idle_gen_rendas` (0076, l. 102–127), `idle_buy` (0076, l. 313–438), `idle_settle` (0076, l. 208–274), `idle_save` (0076, l. 278–309), `idle_prestige` (0076, l. 443–509), `idle_json` (0076, l. 514–593), `idle_evento_era` (0074, l. 9–33), `idle_evento_pegar` (0074, l. 398–467; reescrita inteira no plano), `idle_check_conquistas` (0074, l. 472–547). Não mudam: `idle_rate`/`idle_rate_at` (somam `idle_gen_rendas`), `idle_era`, `idle_cost_mult`, `idle_opp_cap`, `idle_claim_opportunity`, `idle_board`, `idle_start`.
- `DELETE`/`UPDATE` no SQL sempre com `WHERE` (safeupdate do Supabase). Um `jsonb_build_object` tem no máximo 100 argumentos (o campo novo de `idle_json` vai no 2º objeto).
- Números (Decisão 1): `PARAMETROS` (1–30) **não muda**; `PARAMETROS_ESPACO = { aPartirDe: 31, custoInicial: 6e14, crescimentoCusto: 1.6, retornoInicial: 2.5e6, crescimentoRetorno: 1.45 }`; gerais era 6 `1.3, 1.3, 1.35, 1.35`, era 7 `1.35, 1.35, 1.4, 1.4`; legado `p = 0.0005`, preço = custo do 1º gerador da era alvo × `[20, 40, 80, 160, 320, 640][fonte − 1]`; ids gerais 1021–1028, legado 3001–3011, conquistas de gerador 31–42 = 140–151. Lixo: 3 destroços em 10 s, 10 min de produção cada, banco aceita 0–3. Houston: 8 s na tela, ×4 por 2 min (soma 2 min). Janelas `[8, 12, 12, 5, 30, 10, 8]` s (+3 s no banco).
- Caixinha de informação (`dica.ts` monta, `dicaTela.ts` mostra; mouse no PC, foco no teclado, nada no celular) em toda coisa nova com número ou efeito: geradores 31–42, gerais e legado, os dois eventos (o que dá agora em F$), o selo do Silver tape e as conquistas (a caixinha que já existe). Não entra no cartão de estratégia (Decisão 19).
- Entrada nova no começo de `games/idle/novidades.ts`, **sem as conquistas escondidas (158 e 159)**.
- Testes dos jogos: `cd games && npx vitest run --maxWorkers=4 <arquivo>`. No fim: `npx tsc --noEmit` na raiz e em `games/`, `npm test` na raiz. Depois de rodar o vite, matar de verdade o da porta 5199 (`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*vite*--port 5199*' } | % { Stop-Process -Id $_.ProcessId -Force }`) e conferir que não sobrou node (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).
- Navegador: antes de testar, mutar música e efeitos (`localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')`). Quem julga a música é o Juan, na página `/games/idle/audio/ouvir.html`; o agente só roda o "Medir" (render offline, não toca nada).
- Música: melodias originais "no estilo Hans Zimmer", nada copiado de tema dele; qualidade da spec §6 (órgão aditivo com camadas desafinadas, ataque e soltura lentos, vibrato leve, reverb de convolução gerado no código, humanização com semente de força e tempo, filtros que abrem devagar, ar de ruído filtrado baixinho).
- Commits sem `Co-Authored-By` nem marca de IA.

## Review Focus

- **A era muda com um evento na tela** (comprou o gerador 31 ou o 37 com a Mãe ou o Jogo do Brasil aparecendo): o banco aceita o tipo que a página mostrou se ele sai com a era anterior; tipo que não sai em nenhuma das duas dá `idle_evento_gone`, que a página engole sem bonk. Teste na Task 5 ("a era mudou entre aparecer e clicar").
- **Resposta antiga ou estado curto** (página nova antes do `db push`, ou linha com 30 geradores e 4 estratégias): a página conta o que falta como 0/-1, sem `NaN` na taxa, nas caixinhas e na Loja; a era 6 continua pedindo a estratégia; o banco não deixa uma escolha nula passar e não grava `null` no gerador 31. Testes nas Tasks 1 (`economia`, `dica` com 30 geradores), 2 (`estrategiaPendente` com 4 posições) e 4 (lista curta no banco).
- **Vender a startup na era 7 com o Silver tape valendo**: zera o Silver, volta pra 42 geradores zerados e 6 estratégias `-1`; os contadores (`eventos_era`) e as conquistas (monolito) ficam. Teste na Task 5.
- **Lixo espacial com clique rápido ou fora do destroço**: cada destroço conta uma vez, o 3º manda na hora, e depois do 1º desvio a tela atrás trava (clique errado não compra gerador). Teste na Task 9.
- **Silver tape junto dos outros bônus** (×5, Viralizou, Marmita, LinkedIn, Combo) e dois Houston seguidos: a conta fechada do banco é a mesma da página e o 2º soma 2 min no fim. Teste na Task 5.

---

## File Structure

| Arquivo | O que faz |
|---|---|
| `games/idle/nomes.ts` (mod) | geradores 31–42, melhorias, frases, gerais, legado, estratégias, eras, conquistas 140–159, tipos novos |
| `games/idle/catalogo.ts` (mod) | 2º trecho da curva, legado, `idConquistaGerador`, SQL com as colunas novas |
| `games/idle/economia.ts` (mod) | 42 geradores, `unidadesDaEra`, `multLegado`, `liberada` do legado |
| `games/idle/simulacao.ts` (mod) | 6 estratégias, marcos das eras 6–7, `RITMO_ERAS` |
| `games/idle/store.ts` (mod) | `estrategiaPendente`, `rotuloEra`, `cenaDoEstado` (cena 7), `pecasVisiveis`, Silver em `fatoresTempo` |
| `games/idle/formatar.ts` (mod) | nomes por regra até o centilhão, googol, científica |
| `games/idle/eventosEra.ts` (mod) | tipos 6 e 7, `MAX_DESVIOS`, `SILVER_MULT`, `silverAtivo`, ganhos e textos |
| `games/idle/eventoEraTela.ts` (mod) | ícones do destroço e do alarme, o Lixo (3 destroços), o Houston (alarme na cena), `tipo` no `aoPegar` |
| `games/idle/dourados.ts` (mod) | selo "Silver tape ×4" |
| `games/idle/dica.ts` (mod) | legado (melhoria e gerador), frase do gerador, eventos 6–7, Silver na produção |
| `games/idle/montagem.ts`, `palco.ts`, `ativos.ts` (mod) | peças de cena; cena 7 |
| `games/idle/tela.ts`, `main.ts` (mod, o mínimo) | Loja até 42 com a frase, ícone do legado, eventos 6–7, peças, sons |
| `games/idle/eras67.css` (novo) | Lixo, alarme, selo prata, frase da Loja |
| `games/idle/audio/sorte.ts` (novo) | `aleatorio` (semente), usado pelas duas partituras |
| `games/idle/audio/sala.ts` (novo) | resposta ao impulso gerada e o envio de reverb |
| `games/idle/audio/musicaEspaco.ts` (novo) | partituras da Órbita e da Lua, humanização |
| `games/idle/audio/musica.ts`, `instrumentos.ts`, `sequenciador.ts`, `efeitos.ts`, `eventos.ts`, `falso.ts`, `ouvir.ts` (mod) | eras 6–7, instrumentos novos, sala, sons novos |
| `games/idle/novidades.ts` (mod) | entrada nova |
| `games/shared/types.ts`, `games/shared/api.ts`, `games/dev/mockIdle.ts`, `games/dev/mockDb.ts`, `games/test/db.ts` (mod) | `silver_ate`, `p_tipo`, `__era`, painel, migrações |
| `supabase/migrations/0077_…` (gerada), `0078_…` (nova) | catálogo; banco |
| `games/test/idleEras67.test.ts` (novo) | paridade e regras do banco das eras 6–7 |
| `games/idle/assets/…` (novos) | `gerador-31..42.png`, `geral-1021..1028.png`, `conquista-140..159.png`, `cena-7-*`, `cena-6-peca-*`, `cena-7-peca-*` |
| `../fellas-inc-esbocos/*.js` (novos, fora do repo) | scripts de arte |

---
### Task 1: Catálogo das eras 6 e 7, o legado na conta da página e a 0077

**Files:**
- Modify: `games/idle/nomes.ts` (topo; `GERADORES` l. 5–14; `MELHORIAS_GERADOR` fim l. 48; `GERAIS` fim l. 72; `ESTRATEGIAS` fim l. 130; `ERAS` l. 133; `TipoConquista` l. 176–178; `CONQUISTAS_GERADOR` fim l. 212; `CONQUISTAS` depois da 137 e no fim)
- Modify: `games/idle/catalogo.ts`, `games/idle/catalogo.test.ts`
- Modify: `games/idle/economia.ts` (`fatores` l. 154–178, `taxa` l. 180–185, `rendasGeradores` l. 194–197, `liberada` l. 221–225), `games/idle/economia.test.ts`
- Modify: `games/idle/dica.ts` (`partesGerador` l. 51–63, `dicaGerador` l. 72–94, `dicaMelhoria` l. 96–121, `dicaProducao` l. 125), `games/idle/dica.test.ts`
- Modify: `games/idle/tela.ts` (`iconeMelhoria`, l. 543–562)
- Create: `supabase/migrations/0077_fellas_inc_catalogo_eras_6_7.sql` (gerada)
- Modify: `games/test/db.ts` (`MIGRATIONS`), `games/dev/mockDb.ts` (import + `for`), `games/test/idle.test.ts:25-30` (contagens do catálogo)

**Interfaces:**
- Produces: em `nomes.ts`: `FRASES_GERADOR: Readonly<Record<number, string>>` (31–42), `LEGADO: readonly { nome; fonteEra; alvoEra; porUnidade }[]`, `ERAS` com 7 nomes, `TipoConquista` com `'evt_lixo' | 'evt_houston' | 'monolito'`. Em `catalogo.ts`: `PARAMETROS_ESPACO`, `type ParametrosEspaco`, `PRECO_LEGADO`, `idConquistaGerador(g: number): number`, `montarCatalogo(p?, q?)`, a variante `{ tipo: 'legado'; fonteEra; alvoEra; porUnidade; requerEra }` de `Melhoria` (ids 3001–3011). Em `economia.ts`: `unidadesDaEra(cat, gens, era): number`, `multLegado(cat, s, alvoEra): number`. A 0077 cria `idle_cat_upg.fonte_era`/`alvo_era` e o tipo `legado` (a 0078 usa).

- [ ] **Step 0: Preparar o worktree**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67
git merge main          # traz o que a outra sessão publicou (resolver a favor do visual da main)
npm ci                  # raiz (Expo + jest): install de verdade, não junction
cd games && npm ci      # jogos (vite, vitest, PGlite)
cd .. && npx tsc --noEmit
cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle test/idleParidade.test.ts test/idleConquistas.test.ts
```

Expected: tudo PASS (linha de base; se algo falhar aqui, pare e avise antes de mexer).

- [ ] **Step 1: Os testes do catálogo (falham)**

Em `games/idle/catalogo.test.ts`:

1. Troque o import por:

```ts
import { catalogo, catalogoSql, idConquistaGerador, montarCatalogo, PARAMETROS, PARAMETROS_ESPACO } from './catalogo';
import { ERAS, FRASES_GERADOR } from './nomes';
```

2. Troque o teste `'30 geradores em 5 eras de 6, custo e renda crescentes'` inteiro por:

```ts
  it('42 geradores em 7 eras de 6, custo e renda crescentes; do 31 em diante, o 2º trecho da curva', () => {
    const g = catalogo.geradores;
    expect(g).toHaveLength(42);
    expect(g.map((x) => x.era)).toEqual(Array.from({ length: 42 }, (_, i) => Math.floor(i / 6) + 1));
    expect(g[0]).toMatchObject({ id: 1, custo: 15, renda: 0.5 });
    expect(PARAMETROS_ESPACO).toEqual({ aPartirDe: 31, custoInicial: 6e14, crescimentoCusto: 1.6, retornoInicial: 2.5e6, crescimentoRetorno: 1.45 });
    expect(g[30]).toMatchObject({ id: 31, era: 6, nome: 'Constelação de satélites', custo: 6e14, renda: 2.4e8 });
    expect(g[41]).toMatchObject({ id: 42, era: 7, nome: 'Base no lado escuro da Lua' });
    expect(g[41].custo).toBeCloseTo(6e14 * 1.6 ** 11, -3);
    for (let i = 1; i < 42; i++) {
      expect(g[i].custo).toBeGreaterThan(g[i - 1].custo);
      expect(g[i].renda).toBeGreaterThan(g[i - 1].renda);
    }
  });
  it('os geradores 1–30 e as melhorias de antes são os da 0075, byte a byte (preço em produção)', () => {
    const antiga = readFileSync(resolve(MIGRACOES, '0075_fellas_inc_catalogo_dourados.sql'), 'utf8').replace(/\r\n/g, '\n');
    const nova = catalogoSql();
    const bloco = (sql: string, tabela: string) =>
      sql.split(`insert into public.${tabela} `)[1].split(';\n')[0].split('\n').slice(1).map((l) => l.replace(/,$/, ''));
    const gAntes = bloco(antiga, 'idle_cat_gen');
    expect(gAntes).toHaveLength(30);
    expect(bloco(nova, 'idle_cat_gen').slice(0, 30)).toEqual(gAntes);
    // a linha das melhorias ganhou fonte_era e alvo_era no fim (null fora do legado)
    const uNova = new Set(bloco(nova, 'idle_cat_upg'));
    for (const l of bloco(antiga, 'idle_cat_upg')) expect(uNova.has(l.replace(/\)$/, ', null, null)'), l).toBe(true);
  });
  it('nomes das eras e as frases dos geradores 31–42', () => {
    expect(ERAS).toEqual(['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede', 'Em órbita', 'Lua']);
    for (let g = 31; g <= 42; g++) expect(FRASES_GERADOR[g]?.length, `frase ${g}`).toBeGreaterThan(10);
    expect(FRASES_GERADOR[34]).toBe('Desculpe, Dave. Receio que não posso cancelar sua assinatura.');
    expect(FRASES_GERADOR[30]).toBeUndefined();
  });
```

3. No teste `'melhorias: 240 de gerador, 20 gerais, 30 sinergias, ids únicos'`: título `'melhorias: 336 de gerador, 28 gerais, 30 sinergias, 11 de legado, ids únicos'`; `toHaveLength(240)` → `toHaveLength(336)`; `toHaveLength(20)` → `toHaveLength(28)`; depois da linha das sinergias acrescente `expect(m.filter((x) => x.tipo === 'legado')).toHaveLength(11);`; `toBe(290)` → `toBe(405)`; no laço do preço `g <= 30` → `g <= 42`. Antes do laço, acrescente:

```ts
    expect(m.find((x) => x.id === 331)).toMatchObject({ gerador: 33, nivel: 1, requer: 1, nome: 'Valsa do Danúbio Azul na acoplagem' });
    expect(m.find((x) => x.id === 348)).toMatchObject({ gerador: 34, nivel: 8, requer: 300, nome: 'Daisy, Daisy' });
    expect(m.find((x) => x.id === 428)).toMatchObject({ gerador: 42, nivel: 8, nome: 'Eclipse particular' });
    expect(m.find((x) => x.id === 1021)).toMatchObject({ tipo: 'geral', requerEra: 6, mult: 1.3, nome: 'Lançamento transmitido ao vivo', preco: 6e14 * 20 });
    expect(m.find((x) => x.id === 1028)).toMatchObject({ tipo: 'geral', requerEra: 7, mult: 1.4, nome: 'Lua cheia de clientes' });
    expect(m.find((x) => x.id === 3001)).toMatchObject({
      tipo: 'legado', fonteEra: 1, alvoEra: 6, porUnidade: 0.0005, requerEra: 6, preco: 6e14 * 20,
      nome: 'O notebook da faculdade foi pro espaço', frase: 'Cada gerador da era 1 que você tem dá +0,05% nos geradores da era 6.',
    });
    expect(m.find((x) => x.id === 3005)).toMatchObject({ fonteEra: 5, alvoEra: 6, preco: 6e14 * 320 });
    expect(m.find((x) => x.id === 3011)).toMatchObject({ fonteEra: 6, alvoEra: 7, nome: 'Satélite de retransmissão', preco: catalogo.geradores[36].custo * 640 });
```

4. Troque o teste `'12 estratégias; …'`: título `'16 estratégias; todas ligadas (Marca forte e Monopólio dependem dos lugares)'`, `toHaveLength(12)` → `toHaveLength(16)` e acrescente no fim do teste:

```ts
    expect(e.find((x) => x.nome === 'Turismo espacial')).toMatchObject({ era: 6, opcao: 0, genDe: 31, genAte: 36, genMult: 2 });
    expect(e.find((x) => x.nome === 'Satélites de internet')).toMatchObject({ era: 6, opcao: 1, oppBonusMult: 1.5, oppExtra: 2 });
    expect(e.find((x) => x.nome === 'Mineração lunar')).toMatchObject({ era: 7, opcao: 0, genDe: 37, genAte: 42, genMult: 2 });
    expect(e.find((x) => x.nome === 'Hotel na Lua')).toMatchObject({ era: 7, opcao: 1, custoMult: 0.75 });
```

5. No teste das conquistas (`'conquistas: 110 visíveis e 17 escondidas …'`): título `'conquistas: 128 visíveis e 19 escondidas, ids únicos, uma de 100 pra cada gerador (31–42 nos ids 140–151), textos curtos'`; `toHaveLength(110)` → `toHaveLength(128)`; `toHaveLength(17)` → `toHaveLength(19)`; troque a linha do laço `for (let g = 1; g <= 30; g++) …` por:

```ts
    expect([idConquistaGerador(1), idConquistaGerador(30), idConquistaGerador(31), idConquistaGerador(42)]).toEqual([1, 30, 140, 151]);
    for (let g = 1; g <= 42; g++) {
      expect(c.find((x) => x.id === idConquistaGerador(g)), `gerador ${g}`).toMatchObject({ tipo: 'gerador', alvo: g, valor: 100, escondida: false });
    }
```

6. No teste `'as conquistas dos dourados e da Caixinha (132–139) …'` troque `expect(ids.slice(-2)).toEqual([138, 139]);` por `expect(ids.slice(-4)).toEqual([138, 139, 158, 159]);`. Depois dele, acrescente:

```ts
  it('as conquistas das eras 6 e 7 (140–159): as de gerador, a era inteira, os eventos e as duas escondidas no fim', () => {
    const c = catalogo.conquistas;
    expect(c.find((x) => x.id === 140)).toMatchObject({ nome: 'Céu poluído', condicao: 'Ter 100 "Constelação de satélites"', alvo: 31 });
    expect(c.find((x) => x.id === 143)).toMatchObject({ nome: 'Abra a porta, HAL', alvo: 34 });
    expect(c.find((x) => x.id === 151)).toMatchObject({ nome: 'Do lado de lá', alvo: 42 });
    for (const e of [6, 7]) {
      expect(c.find((x) => x.id === 146 + e)).toMatchObject({ tipo: 'era_300', alvo: e, escondida: false });
      expect(c.find((x) => x.id === 148 + e)).toMatchObject({ tipo: 'era_melhorias', alvo: e, escondida: false });
    }
    expect(c.find((x) => x.id === 156)).toMatchObject({ tipo: 'evt_lixo', valor: 3, nome: 'Desviou de tudo' });
    expect(c.find((x) => x.id === 157)).toMatchObject({ tipo: 'evt_houston', valor: 10, nome: 'Silver tape resolve' });
    expect(c.find((x) => x.id === 158)).toMatchObject({ tipo: 'monolito', escondida: true, nome: 'Meu Deus, está cheio de estrelas' });
    expect(c.find((x) => x.id === 159)).toMatchObject({ tipo: 'melhoria', alvo: 348, escondida: true, nome: 'Daisy, Daisy' });
    const ids = c.map((x) => x.id);
    expect(ids.indexOf(157)).toBeLessThan(ids.indexOf(101)); // as visíveis antes das escondidas
  });
```

7. Na lista do teste `'escondidas: as da spec; …'`, depois de `'Insider (shh)'` acrescente `'Meu Deus, está cheio de estrelas', 'Daisy, Daisy'`.

8. No bloco `describe('catálogo no banco …')`, acrescente:

```ts
  it('o SQL gerado cria as colunas do legado e troca o check do tipo (banco que já tinha a tabela)', () => {
    const sql = catalogoSql();
    expect(sql).toContain('alter table public.idle_cat_upg add column if not exists fonte_era int, add column if not exists alvo_era int;');
    expect(sql).toContain("alter table public.idle_cat_upg add constraint idle_cat_upg_tipo_check check (tipo in ('gerador', 'geral', 'sinergia', 'legado'));");
    expect(sql.indexOf('add constraint idle_cat_upg_tipo_check')).toBeLessThan(sql.indexOf('insert into public.idle_cat_upg'));
    expect(sql).toContain("(3001, 'legado', 'O notebook da faculdade foi pro espaço', 'Cada gerador da era 1 que você tem dá +0,05% nos geradores da era 6.', 12000000000000000, null, null, null, null, 6, null, null, 0.0005, null, null, 1, 6)");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: FAIL (import de `idConquistaGerador`/`PARAMETROS_ESPACO`/`FRASES_GERADOR` inexistentes, 30 geradores).

- [ ] **Step 3: Os textos em `nomes.ts`**

No topo de `games/idle/nomes.ts`, troque o comentário `/** Os 30 geradores, na ordem. A cada 6 começa uma era (e uma cena). */` por:

```ts
/** Balanceamento das eras 6–7 que a simulação ajustou (simulacao.test.ts, "ritmo das eras 6 e 7"): os multiplicadores
 *  das gerais, o p do legado e o ×N das estratégias de gerador. */
const GERAL_6 = [1.3, 1.3, 1.35, 1.35] as const;
const GERAL_7 = [1.35, 1.35, 1.4, 1.4] as const;
const LEGADO_P = 0.0005;
const EST_6_GEN = 2;
const EST_7_GEN = 2;

/** Os geradores, na ordem. A cada 6 começa uma era (e uma cena). */
```

Em `GERADORES`, troque a última linha `  'Foguete pra Marte',` + `];` por:

```ts
  'Foguete pra Marte',
  // era 6 · Em órbita (entrega 1 das eras 6–12)
  'Constelação de satélites', 'Voo de 11 minutos com famoso', 'Hotel em órbita', 'HAL 9000 gerenciando a estação',
  'Ferro-velho orbital', 'Equipe de perfuração do Armageddon',
  // era 7 · Lua
  'Posto de gasolina lunar', 'Estúdio da teoria da conspiração', 'Fazenda de queijo lunar', 'Mina de hélio-3 com clone',
  'Raio encolhedor do Gru', 'Base no lado escuro da Lua',
];
```

Em `MELHORIAS_GERADOR`, depois da linha do gerador 30 (`['Motor reutilizável', …, 'Passagem só de ida'],`) e antes do `];`, acrescente:

```ts
  ['Primeiro lançamento', 'Trenzinho de luzes no céu', 'Antena de pizza', 'Plano família interplanetário', 'Astrônomo reclamando', 'Mil satélites por mês', 'Internet no avião', 'Céu com mais satélite que estrela'],
  ['Macacão com logo', 'Cantora pop a bordo', 'Vídeo flutuando com a água', 'Champanhe sem gravidade', 'Lista de espera de bilionário', 'Capitão de série de TV a bordo', 'Podcast gravado em órbita', 'Ingresso mais caro que um apartamento'],
  ['Valsa do Danúbio Azul na acoplagem', 'Airbnb na estação espacial', 'Café da manhã em tubinho', 'Vista pra Terra (taxa extra)', 'Videofone de 1,70 o minuto', 'Spa de microgravidade', 'Suíte com janela redonda', 'Hilton da Odisseia'],
  ['Olho vermelho na parede', 'Osso jogado pro alto', 'Leitura labial', 'Xadrez imbatível', '"Desculpe, Dave"', 'Porta da cápsula trancada', 'Módulo de memória extra', 'Daisy, Daisy'],
  ['Rede de pegar destroço', 'Parafuso perdido de 1965', 'Luva de astronauta achada', 'Satélite soviético de segunda mão', 'Braço robótico', 'Guindaste orbital', 'Ferro-velho com selo ISO', 'Reciclagem de estação inteira'],
  ['Sonda de petróleo', 'Briefing de regata na agência espacial', 'Bomba nuclear de brinde', 'Rock farofa no rádio', 'Biscoito de bichinho', 'Broca nova (a velha travou)', 'Despedida no asteroide', 'Asteroide partido ao meio'],
  ['Pegada na poeira', 'Bandeira que não balança', 'Conveniência 24 h (o dia lunar dura 14)', 'Gasolina de hélio', 'Pão de queijo liofilizado', 'Calibrador de pneu de jipe lunar', 'Frentista de traje', 'Posto com bandeira própria'],
  ['Holofote que faz sombra errada', 'Cenário de areia cinza', 'Bandeira com ventilador', 'Fio de pendurar astronauta', 'Diretor perfeccionista contratado', 'Documentário no YouTube', 'Fórum de terraplanista', 'Pôster "Foi tudo gravado aqui"'],
  ['Faca de queijo espacial', 'Bolacha de água e sal', 'Queijo da cratera', 'Cachorro no comando', 'Foguete de garagem', 'Curado no vácuo', 'Meia-cura de 4 bilhões de anos', 'Exportação pra Minas'],
  ['Contrato de 3 anos', 'Robô com carinha na tela', 'Mensagem gravada da família', 'Clone de reserva', 'Clone que descobriu', 'Antena de interferência', 'Gaveta com 50 clones', 'Fusão nuclear limpa'],
  ['Minion de capacete', 'Banana espacial', 'Foguete roubado', 'Lua no bolso', 'Vilão concorrente', 'Empréstimo do Banco do Mal', 'Três meninas adotadas', 'Lua de volta (com juros)'],
  ['Prisma na entrada', 'Vinil da banda', 'Robô gigante escondido', 'Sinal sem resposta', 'Lado escuro (que nem é escuro)', 'Hangar de nave secreta', 'Laser apontado pra Terra', 'Eclipse particular'],
```

Logo depois do `];` de `MELHORIAS_GERADOR`, acrescente:

```ts

/** A frase de cada gerador que tem uma (os das eras 6 em diante): aparece na caixinha e na Loja. Só da página. */
export const FRASES_GERADOR: Readonly<Record<number, string>> = {
  31: 'Internet no meio do nada, e nenhuma estrela visível no céu.',
  32: 'Onze minutos de voo e três horas de vídeo sobre como mudou a sua vida.',
  33: 'Diária em dólar, vista de graça, gravidade cobrada à parte.',
  34: 'Desculpe, Dave. Receio que não posso cancelar sua assinatura.',
  35: 'Tudo que a humanidade jogou pra cima, agora com nota fiscal.',
  36: 'Treinar astronauta pra furar dava mais trabalho. Ninguém perguntou.',
  37: 'Aceita cartão, Pix e pedra lunar. Calibragem grátis.',
  38: 'Dizem que foi tudo gravado aqui. A gente só aluga o estúdio.',
  39: 'Todo mundo sabia que a Lua era de queijo. Faltava alguém vender.',
  40: 'Contrato de três anos. Você vai renovar. Você sempre renova.',
  41: 'Roubar a Lua deu trabalho. Alugar ela de volta dá lucro.',
  42: 'Escuro só no nome. O aluguel é bem iluminado.',
};
```

Em `GERAIS`, depois da linha `{ era: 5, mult: 1.3, nome: 'Lenda do mercado', … },` e antes do `];`, acrescente:

```ts
  { era: 6, mult: GERAL_6[0], nome: 'Lançamento transmitido ao vivo', frase: 'Dez milhões assistindo a contagem.' },
  { era: 6, mult: GERAL_6[1], nome: 'Foguete que pousa de ré', frase: 'Reutilizável, e ainda estaciona sozinho.' },
  { era: 6, mult: GERAL_6[2], nome: 'Contagem regressiva com patrocínio', frase: 'Dez, nove, oferecimento…' },
  { era: 6, mult: GERAL_6[3], nome: 'Selfie do espaço', frase: 'A Terra inteira no fundo e você no meio.' },
  { era: 7, mult: GERAL_7[0], nome: 'Pequeno passo', frase: 'Um salto gigante pro faturamento.' },
  { era: 7, mult: GERAL_7[1], nome: 'Telescópio apontado pra você', frase: 'Lá de baixo dá pra ver o seu logo.' },
  { era: 7, mult: GERAL_7[2], nome: 'Trem-bala lunar', frase: 'Do Mar da Tranquilidade ao escritório em 4 min.' },
  { era: 7, mult: GERAL_7[3], nome: 'Lua cheia de clientes', frase: 'Toda lua cheia é Black Friday.' },
```

Logo depois do `];` de `GERAIS`, acrescente:

```ts

/** Legado (eras 6+): cada unidade de gerador da era `fonteEra` que você tem dá +porUnidade nos geradores da era
 *  `alvoEra`. Liberado ao chegar na era alvo. Ids 3001 em diante, na ordem. */
export const LEGADO: readonly { nome: string; fonteEra: number; alvoEra: number; porUnidade: number }[] = [
  { alvoEra: 6, fonteEra: 1, porUnidade: LEGADO_P, nome: 'O notebook da faculdade foi pro espaço' },
  { alvoEra: 6, fonteEra: 2, porUnidade: LEGADO_P, nome: 'A garagem virou hangar' },
  { alvoEra: 6, fonteEra: 3, porUnidade: LEGADO_P, nome: 'Escritório com gravidade zero' },
  { alvoEra: 6, fonteEra: 4, porUnidade: LEGADO_P, nome: 'O andar inteiro em órbita' },
  { alvoEra: 6, fonteEra: 5, porUnidade: LEGADO_P, nome: 'A sede virou base de lançamento' },
  { alvoEra: 7, fonteEra: 1, porUnidade: LEGADO_P, nome: 'Wi-Fi da biblioteca chega na Lua' },
  { alvoEra: 7, fonteEra: 2, porUnidade: LEGADO_P, nome: 'Food truck lunar' },
  { alvoEra: 7, fonteEra: 3, porUnidade: LEGADO_P, nome: 'Podcast gravado na cratera' },
  { alvoEra: 7, fonteEra: 4, porUnidade: LEGADO_P, nome: 'Trader que opera da Lua' },
  { alvoEra: 7, fonteEra: 5, porUnidade: LEGADO_P, nome: 'IPO na Bolsa Lunar' },
  { alvoEra: 7, fonteEra: 6, porUnidade: LEGADO_P, nome: 'Satélite de retransmissão' },
];
```

Em `ESTRATEGIAS`, troque o comentário `/** Estratégias: 3 por era (2 a 5). …` por `/** Estratégias: 3 por era (2 a 5) e 2 nas eras 6 e 7. \`ativa: false\` = depende de algo que ainda não chegou. */` e, depois da linha `{ era: 5, opcao: 2, nome: 'Rolê eterno', … },` e antes do `];`, acrescente:

```ts
  { era: 6, opcao: 0, nome: 'Turismo espacial', frase: 'Os geradores do 31 ao 36 rendem o dobro.', genDe: 31, genAte: 36, genMult: EST_6_GEN },
  { era: 6, opcao: 1, nome: 'Satélites de internet', frase: 'Oportunidades em F$ rendem 50% a mais, as outras valem em dobro, e o limite do dia sobe 2.', oppBonusMult: 1.5, oppExtra: 2 },
  { era: 7, opcao: 0, nome: 'Mineração lunar', frase: 'Os geradores do 37 ao 42 rendem o dobro.', genDe: 37, genAte: 42, genMult: EST_7_GEN },
  { era: 7, opcao: 1, nome: 'Hotel na Lua', frase: 'Geradores e melhorias custam 25% menos.', custoMult: 0.75 },
```

Troque `export const ERAS: readonly string[] = ['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede'];` por:

```ts
export const ERAS: readonly string[] = ['Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede', 'Em órbita', 'Lua'];
```

Em `TipoConquista`, troque a última linha `  | 'trend_max' | 'pix_dev' | 'tigre_perdeu' | 'combos' | 'cupons' | 'cashback' | 'tigre_seq' | 'insider';` por:

```ts
  | 'trend_max' | 'pix_dev' | 'tigre_perdeu' | 'combos' | 'cupons' | 'cashback' | 'tigre_seq' | 'insider'
  // eras 6–7 (0078): Lixo espacial e Houston (de evento); o monolito, 1 de cada gerador da era 7 (de estado)
  | 'evt_lixo' | 'evt_houston' | 'monolito';
```

Troque o comentário de `CONQUISTAS_GERADOR` por `/** Conquista "ter 100" de cada gerador, na ordem dos geradores: [nome, frase]. Ids 1–30 e, do gerador 31 em diante, 140 + (g − 31) (idConquistaGerador em catalogo.ts). */` e, depois da linha `['Frota interplanetária', …],` e antes do `];`, acrescente:

```ts
  // geradores 31–42: ids 140–151 (os ids 31+ já eram das outras conquistas)
  ['Céu poluído', 'Cem satélites. Os astrônomos te odeiam.'],
  ['Turista de luxo', 'Cem voos de 11 minutos. Ninguém saiu direito da atmosfera.'],
  ['Cinco estrelas (de verdade)', 'Cem hotéis em órbita. O check-out é às 11 h, mas de qual fuso?'],
  ['Abra a porta, HAL', 'Cem HALs. Nenhum abre a porta.'],
  ['Catador de estrelas', 'Cem ferros-velhos. O lixo espacial agora tem dono.'],
  ['Missão cumprida, Harry', 'Cem equipes de perfuração. O asteroide nem viu.'],
  ['Abastece aí', 'Cem postos na Lua. O jipe agradece.'],
  ['Foi tudo gravado', 'Cem estúdios. Agora tem prova de que nada aconteceu.'],
  ['Queijo suíço espacial', 'Cem fazendas. A Lua está cada vez mais esburacada.'],
  ['Sou eu mesmo?', 'Cem minas, e cem de você trabalhando nelas.'],
  ['Lua no bolso', 'Cem raios encolhedores. A maré nunca mais foi a mesma.'],
  ['Do lado de lá', 'Cem bases no lado escuro, que de escuro não tem nada.'],
```

Em `CONQUISTAS`, logo depois da linha `{ id: 137, tipo: 'cashback', … },`, acrescente:

```ts
  // eras 6–7 (0077/0078); as "ter 100" dos geradores 31–42 (140–151) estão em CONQUISTAS_GERADOR
  { id: 152, tipo: 'era_300', alvo: 6, nome: 'Órbita lotada', frase: 'Trezentos de cada. O céu virou estacionamento.', condicao: 'Ter 300 de cada gerador da era 6' },
  { id: 153, tipo: 'era_300', alvo: 7, nome: 'Condomínio lunar', frase: 'A Lua tem síndico agora. É você.', condicao: 'Ter 300 de cada gerador da era 7' },
  { id: 154, tipo: 'era_melhorias', alvo: 6, nome: 'Estação completa', frase: 'Tudo comprado. Até o banheiro funciona sem gravidade.', condicao: 'Comprar todas as melhorias da era 6' },
  { id: 155, tipo: 'era_melhorias', alvo: 7, nome: 'Lua de luxo', frase: 'Cada cratera com hidromassagem.', condicao: 'Comprar todas as melhorias da era 7' },
  { id: 156, tipo: 'evt_lixo', valor: 3, nome: 'Desviou de tudo', frase: 'Nenhum arranhão. Nem no satélite do vizinho.', condicao: 'Desviar os 3 destroços de um Lixo espacial' },
  { id: 157, tipo: 'evt_houston', valor: 10, nome: 'Silver tape resolve', frase: 'Dez problemas, um rolo de fita.', condicao: 'Consertar 10 "Houston, temos um problema"' },
```

E no fim de `CONQUISTAS`, depois da linha `{ id: 139, escondida: true, tipo: 'insider', … },` e antes do `];`:

```ts
  { id: 158, escondida: true, tipo: 'monolito', nome: 'Meu Deus, está cheio de estrelas', frase: 'Alguém deixou isso aqui há 4 milhões de anos.', condicao: 'Ter pelo menos 1 de cada gerador da era 7' },
  { id: 159, escondida: true, tipo: 'melhoria', alvo: 348, nome: 'Daisy, Daisy', frase: 'Ele cantou até a voz acabar.', condicao: 'Comprar "Daisy, Daisy"' },
```

- [ ] **Step 4: O catálogo (`catalogo.ts`)**

1. No import de `./nomes`, acrescente `LEGADO` (em ordem: `…, GERAIS, LEGADO, MELHORIAS_GERADOR, …`).
2. Depois de `export type Parametros = typeof PARAMETROS;`, acrescente:

```ts
/** O 2º trecho da curva (eras 6+, 15/10): do gerador `aPartirDe` em diante, custo_g = custoInicial·crescimentoCusto^k e
 *  renda_g = custo_g / (retornoInicial·crescimentoRetorno^k), com k = g − aPartirDe. Os geradores antes dele usam
 *  PARAMETROS e não mudam nunca (preço em produção). Calibrado na simulação (simulacao.test.ts, "ritmo das eras 6 e 7"):
 *  era 6 em 10,5 dias e era 7 em 16 dias. */
export const PARAMETROS_ESPACO = { aPartirDe: 31, custoInicial: 6e14, crescimentoCusto: 1.6, retornoInicial: 2.5e6, crescimentoRetorno: 1.45 };
export type ParametrosEspaco = typeof PARAMETROS_ESPACO;
```

3. Depois de `export const PRECO_GERAL = [20, 40, 80, 160] as const;`, acrescente:

```ts
/** Preço do legado (× custo do primeiro gerador da era alvo), pela era fonte (1 a 6): o mesmo dobro das gerais. */
export const PRECO_LEGADO = [20, 40, 80, 160, 320, 640] as const;
```

4. No tipo `Melhoria`, troque a última variante (a da sinergia, terminando em `requerAlvo: number;\n    };`) por:

```ts
  | {
      id: number; tipo: 'sinergia'; nome: string; frase: string; preco: number;
      fonte: number; alvo: number; porUnidade: number; requerFonte: number; requerAlvo: number;
    }
  | {
      id: number; tipo: 'legado'; nome: string; frase: string; preco: number;
      fonteEra: number; alvoEra: number; porUnidade: number; requerEra: number;
    };
```

5. Troque o começo de `montarCatalogo` (da assinatura até o fim do `GERADORES.map`) por:

```ts
/** O id da conquista "ter 100" do gerador g: 1–30 = o próprio g; do 31 em diante, 140 + (g − 31) (os ids 31+ já eram das
 *  outras conquistas). */
export const idConquistaGerador = (g: number) => (g <= 30 ? g : 109 + g);

export function montarCatalogo(p: Parametros = PARAMETROS, q: ParametrosEspaco = PARAMETROS_ESPACO): Catalogo {
  const corte = q.aPartirDe - 1; // índice do 1º gerador do 2º trecho
  const geradores: Gerador[] = GERADORES.map((nome, i) => {
    if (i < corte) {
      // os de sempre: a mesma conta de antes, byte a byte (catalogo.test.ts compara com a 0075)
      const custo = p.custoInicial * p.crescimentoCusto ** i;
      return { id: i + 1, era: Math.floor(i / 6) + 1, nome, custo, renda: custo / (p.retornoInicial * p.crescimentoRetorno ** i) };
    }
    const k = i - corte;
    const custo = q.custoInicial * q.crescimentoCusto ** k;
    return { id: i + 1, era: Math.floor(i / 6) + 1, nome, custo, renda: custo / (q.retornoInicial * q.crescimentoRetorno ** k) };
  });
```

6. Logo antes de `const estrategias: Estrategia[] = ESTRATEGIAS.map(`, acrescente:

```ts
  LEGADO.forEach((x, i) => {
    const primeiro = geradores[(x.alvoEra - 1) * 6];
    melhorias.push({
      id: 3001 + i, tipo: 'legado', nome: x.nome,
      frase: `Cada gerador da era ${x.fonteEra} que você tem dá +${(x.porUnidade * 100).toLocaleString('pt-BR')}% nos geradores da era ${x.alvoEra}.`,
      preco: primeiro.custo * PRECO_LEGADO[x.fonteEra - 1], fonteEra: x.fonteEra, alvoEra: x.alvoEra, porUnidade: x.porUnidade,
      requerEra: x.alvoEra,
    });
  });
```

7. Nas conquistas de gerador, troque `id: i + 1, nome, frase, condicao:` por `id: idConquistaGerador(i + 1), nome, frase, condicao:`.
8. Em `catalogoSql`, na linha do `upg`, troque o fim `${c('requerFonte')}, ${c('requerAlvo')})` por `${c('requerFonte')}, ${c('requerAlvo')}, ${c('fonteEra')}, ${c('alvoEra')})`.
9. No texto do SQL, troque o `create table if not exists public.idle_cat_upg (…);` inteiro por:

```sql
create table if not exists public.idle_cat_upg (
  id int primary key, tipo text not null check (tipo in ('gerador', 'geral', 'sinergia', 'legado')), nome text not null, frase text not null,
  preco double precision not null, gerador int, nivel int, requer int, mult double precision, requer_era int,
  fonte int, alvo int, por_unidade double precision, requer_fonte int, requer_alvo int, fonte_era int, alvo_era int
);
```

   Logo depois do `create table if not exists public.idle_cat_no (…);` (e antes da linha em branco que vem antes de `alter table public.idle_cat_gen enable row level security;`), acrescente:

```sql
-- legado (0077): banco que já tinha a tabela ganha as colunas e o tipo novo (o create acima não roda de novo)
alter table public.idle_cat_upg add column if not exists fonte_era int, add column if not exists alvo_era int;
alter table public.idle_cat_upg drop constraint if exists idle_cat_upg_tipo_check;
alter table public.idle_cat_upg add constraint idle_cat_upg_tipo_check check (tipo in ('gerador', 'geral', 'sinergia', 'legado'));
```

   E troque `insert into public.idle_cat_upg (id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade, requer_fonte, requer_alvo) values` por `insert into public.idle_cat_upg (id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade, requer_fonte, requer_alvo, fonte_era, alvo_era) values`.

- [ ] **Step 5: Testes da conta da página com o legado e o estado curto (falham)**

Em `games/idle/economia.test.ts`, acrescente `multLegado, unidadesDaEra, efeitosArvore` no import de `./economia` (o `efeitosArvore` já está; não duplique) e, no fim do arquivo:

```ts
describe('legado (eras 6+, igual a idle_gen_rendas na 0078)', () => {
  const base = () => com([[1, 400], [2, 300], [3, 200], [4, 150], [5, 100], [6, 90], [30, 1], [31, 1]], { strategies: [0, 0, 0, 0, -1, -1] });
  it('cada unidade da era fonte dá +p nos geradores da era alvo, e só neles', () => {
    const s = base();
    const comLegado = { ...s, upgrades: [3001] };
    expect(unidadesDaEra(cat, s.generators, 1)).toBe(1240);
    expect(multLegado(cat, comLegado, 6)).toBeCloseTo(1 + 0.0005 * 1240, 12);
    expect(multLegado(cat, comLegado, 7)).toBe(1);
    expect(taxaPorUnidade(cat, comLegado, 31) / taxaPorUnidade(cat, s, 31)).toBeCloseTo(1.62, 12);
    expect(taxaPorUnidade(cat, comLegado, 30)).toBeCloseTo(taxaPorUnidade(cat, s, 30), 12);
  });
  it('dois legados da mesma era alvo somam (não multiplicam)', () => {
    const s = { ...base(), upgrades: [3001, 3005] }; // era 1 (1240) e era 5 (1)
    expect(multLegado(cat, s, 6)).toBeCloseTo(1 + 0.0005 * 1240 + 0.0005 * 1, 12);
  });
  it('liberado na era alvo, não antes', () => {
    const m = cat.melhorias.find((x) => x.id === 3001)!;
    expect(liberada(cat, m, com([[30, 1]]))).toBe(false);
    expect(liberada(cat, m, com([[30, 1], [31, 1]]))).toBe(true);
  });
});

describe('estado curto (resposta de antes da 0078, com 30 geradores)', () => {
  it('os geradores que faltam contam 0: taxa e rendas sem NaN', () => {
    const s = com([[1, 3], [2, 1]]);
    expect(s.generators).toHaveLength(30);
    expect(Number.isFinite(taxa(cat, s))).toBe(true);
    expect(rendasGeradores(cat, s)).toHaveLength(42);
    expect(rendasGeradores(cat, s).every(Number.isFinite)).toBe(true);
    expect(liberada(cat, cat.melhorias.find((x) => x.id === 311)!, s)).toBe(false);
  });
});
```

Em `games/idle/dica.test.ts`, acrescente `dicaGerador, dicaMelhoria` no import de `./dica` se faltarem e, no fim:

```ts
describe('legado na caixinha (eras 6+)', () => {
  const generators = gens({ 1: 400, 2: 300, 3: 200, 4: 150, 5: 100, 6: 90, 31: 2 });
  it('a melhoria diz quanto dá agora, em números da pessoa', () => {
    const s = comTaxa({ era: 6, generators, strategies: [0, 0, 0, 0, 0, -1] });
    expect(textos(dicaMelhoria(s, melhoria((x) => x.id === 3001), 1.2e16))).toEqual(expect.arrayContaining([
      'Cada gerador da era 1 dá +0,05% nos geradores da era 6',
      'Seus 1.240 geradores da era 1 dão +62% na era 6',
    ]));
  });
  it('o gerador da era alvo mostra o legado que já tem', () => {
    const s = comTaxa({ era: 6, generators, strategies: [0, 0, 0, 0, 0, -1], upgrades: [3001] });
    expect(textos(dicaGerador(s, 31, 1e15))).toContain('Legado: +62%');
  });
  it('estado com 30 geradores: a caixinha do gerador e a da produção não viram NaN', () => {
    const s = comTaxa({ generators: gens({ 1: 3 }) });
    expect(textos(dicaGerador(s, 1, 20)).join(' ')).not.toContain('NaN');
    expect(textos(dicaProducao(s, Date.parse(s.server_now))).join(' ')).not.toContain('NaN');
  });
});
```

(`dicaProducao` também precisa estar no import.)

Os testes antigos que contam o catálogo: em `games/idle/economia.test.ts:267` (`rendasGeradores`), `expect(r).toHaveLength(30);` → `expect(r).toHaveLength(42);`; em `games/test/idle.test.ts:25-26`, `.toBe(290)` → `.toBe(405)` e `.toBe(12)` → `.toBe(16)`; em `games/test/idle.test.ts:30`, `expect(lidos[0].n).toBe(30);` → `expect(lidos[0].n).toBe(42);`.

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/dica.test.ts`
Expected: FAIL (`multLegado`/`unidadesDaEra` não existem; tipos do legado).

- [ ] **Step 6: A conta da página (`economia.ts`)**

Depois de `export function era(…)` (l. 29–33), acrescente:

```ts
/** Quantas unidades de gerador da era `e` você tem (posição que falta na lista conta 0). */
export function unidadesDaEra(cat: Catalogo, gens: readonly number[], e: number): number {
  return cat.geradores.reduce((a, g) => (g.era === e ? a + (gens[g.id - 1] ?? 0) : a), 0);
}

/** O legado na era `alvo` (igual a idle_gen_rendas na 0078): 1 + Σ p × unidades da era fonte de cada legado comprado. */
export function multLegado(cat: Catalogo, s: Estado, alvo: number): number {
  let m = 1;
  for (const id of s.upgrades) {
    const u = melhoria(cat, id);
    if (u?.tipo === 'legado' && u.alvoEra === alvo) m += u.porUnidade * unidadesDaEra(cat, s.generators, u.fonteEra);
  }
  return m;
}
```

Em `fatores`, troque as duas linhas `const dobras = Array(30).fill(0);` / `const sinergia = Array(30).fill(1);` por:

```ts
  const n = cat.geradores.length;
  const dobras = Array(n).fill(0);
  const sinergia = Array(n).fill(1);
```

troque `    else sinergia[m.alvo - 1] += m.porUnidade * s.generators[m.fonte - 1];` por:

```ts
    else if (m.tipo === 'sinergia') sinergia[m.alvo - 1] += m.porUnidade * (s.generators[m.fonte - 1] ?? 0);
```

troque `  const distintos = s.generators.filter((n) => n > 0).length;` por `  const distintos = s.generators.filter((x) => x > 0).length;` e o bloco `const porGerador = cat.geradores.map((g) => { … });` por:

```ts
  const legado = new Map<number, number>(); // por era alvo
  const porGerador = cat.geradores.map((g) => {
    if (!legado.has(g.era)) legado.set(g.era, multLegado(cat, s, g.era));
    let mult = 1;
    for (const e of est) if (e.genDe !== null && e.genAte !== null && g.id >= e.genDe && g.id <= e.genAte) mult *= e.genMult;
    return g.renda * 2 ** dobras[g.id - 1] * sinergia[g.id - 1] * legado.get(g.era)! * mult;
  });
```

Em `taxa`, troque `  for (let i = 0; i < 30; i++) soma += s.generators[i] * f.porGerador[i];` por `  for (let i = 0; i < f.porGerador.length; i++) soma += (s.generators[i] ?? 0) * f.porGerador[i];`. Em `rendasGeradores`, troque `x * s.generators[i] * f.global` por `x * (s.generators[i] ?? 0) * f.global`. Troque `liberada` inteira por:

```ts
export function liberada(cat: Catalogo, m: Melhoria, s: Estado): boolean {
  if (m.tipo === 'gerador') return (s.generators[m.gerador - 1] ?? 0) >= m.requer;
  if (m.tipo === 'geral' || m.tipo === 'legado') return era(cat, s.generators) >= m.requerEra;
  return (s.generators[m.fonte - 1] ?? 0) >= m.requerFonte && (s.generators[m.alvo - 1] ?? 0) >= m.requerAlvo;
}
```

(`abertura` continua com `Array(30)` nesta task: o banco ainda recomeça com 30 e `idlePrestigio.test.ts` compara os dois. A Task 2 muda os dois juntos.)

- [ ] **Step 7: A caixinha do legado (`dica.ts`) e o ícone (`tela.ts`)**

Em `dica.ts`, no import de `./economia` acrescente `multLegado, unidadesDaEra`. Troque `partesGerador` inteira por:

```ts
/** Quanto as melhorias de gerador dobram, quanto as sinergias somam e quanto o legado dá num gerador. */
function partesGerador(s: IdleState, gid: number) {
  let dobras = 0;
  let sinergia = 0;
  for (const id of s.upgrades) {
    const m = catalogo.melhorias.find((x) => x.id === id);
    if (m?.tipo === 'gerador' && m.gerador === gid) dobras++;
    if (m?.tipo === 'sinergia' && m.alvo === gid) sinergia += m.porUnidade * (s.generators[m.fonte - 1] ?? 0);
  }
  const est = estrategiasAtivas(catalogo, s).reduce(
    (a, e) => (e.genDe !== null && e.genAte !== null && gid >= e.genDe && gid <= e.genAte ? a * e.genMult : a), 1);
  const legado = multLegado(catalogo, s, catalogo.geradores[gid - 1].era) - 1;
  return { dobras, sinergia, est, legado };
}
```

Em `dicaGerador`, troque `  const n = s.generators[gid - 1];` por `  const n = s.generators[gid - 1] ?? 0;`, `  const soma = cada.reduce((a, x, i) => a + x * s.generators[i], 0);` por `  const soma = cada.reduce((a, x, i) => a + x * (s.generators[i] ?? 0), 0);` e, depois da linha `  if (p.sinergia) linhas.push(…);`, acrescente:

```ts
  if (p.legado > 0) linhas.push({ texto: `Legado: +${num(p.legado * 100, 0)}%`, tom: 'fraco' });
```

Em `dicaProducao`, troque `  const base = f.porGerador.reduce((a, x, i) => a + x * s.generators[i], 0);` por `  const base = f.porGerador.reduce((a, x, i) => a + x * (s.generators[i] ?? 0), 0);`.

Em `dicaMelhoria`, troque o `} else {` do ramo da sinergia (o que começa com `const nf = s.generators[m.fonte - 1];`) por `} else if (m.tipo === 'sinergia') {`, troque dentro dele `const nf = s.generators[m.fonte - 1];` por `const nf = s.generators[m.fonte - 1] ?? 0;` e, logo depois do `}` que fecha esse ramo (antes de `if (preco !== null) {`), troque o `}` por:

```ts
  } else {
    // legado (eras 6+): quanto as unidades da era fonte que você tem dão na era alvo, agora
    const n = unidadesDaEra(catalogo, s.generators, m.fonteEra);
    linhas.push({ texto: `Cada gerador da era ${m.fonteEra} dá +${num(m.porUnidade * 100)}% nos geradores da era ${m.alvoEra}` });
    linhas.push({ texto: `Seus ${inteiro(n)} geradores da era ${m.fonteEra} dão +${num(m.porUnidade * n * 100, 0)}% na era ${m.alvoEra}`, tom: 'fraco' });
    const atual = multLegado(catalogo, s, m.alvoEra);
    const daEra = catalogo.geradores.filter((g) => g.era === m.alvoEra).reduce((a, g) => a + cada[g.id - 1] * (s.generators[g.id - 1] ?? 0), 0);
    ganho = (daEra * m.porUnidade * n) / atual;
  }
```

(`inteiro` já existe mais abaixo no arquivo: `const inteiro = (n: number) => Math.floor(n).toLocaleString('pt-BR');`.)

Em `tela.ts`, `iconeMelhoria`: troque o `} else {` do ramo da sinergia por `} else if (m.tipo === 'sinergia') {` e, depois do `}` que fecha esse ramo, troque por:

```ts
    } else {
      // legado (eras 6+): o 1º gerador da era fonte e o da era alvo, como na sinergia (sem arte nova)
      box.classList.add('sinergia', 'legado');
      for (const e of [m.fonteEra, m.alvoEra]) {
        const mini = el('span', 'mini');
        mini.style.backgroundImage = `url(${ativos.gerador((e - 1) * 6 + 1)})`;
        box.append(mini);
      }
    }
```

- [ ] **Step 8: Gerar a 0077 e listar nos dois bancos**

Acrescente `'0077_fellas_inc_catalogo_eras_6_7.sql',` no fim de `MIGRATIONS` em `games/test/db.ts`. Em `games/dev/mockDb.ts`: `import m77 from '../../supabase/migrations/0077_fellas_inc_catalogo_eras_6_7.sql?raw';` depois do `m76`, e `m77` no fim do array do `for`.

Run: `cd games && ATUALIZAR_CATALOGO=0077_fellas_inc_catalogo_eras_6_7.sql npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: cria `supabase/migrations/0077_fellas_inc_catalogo_eras_6_7.sql` e PASS.

- [ ] **Step 9: Rodar tudo o que encosta no catálogo**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle test/idleParidade.test.ts test/idleConquistas.test.ts test/idle.test.ts test/idlePrestigio.test.ts`
Expected: PASS, menos `idle/ativos.test.ts` se ele já exigir ícone de conquista nova (`toda conquista … tem ícone 16x16`): esse teste fica vermelho até a Task 7 (arte). Anote no relatório. Nenhum outro pode falhar: a 0076 ignora os geradores 31–42 (posição nula na lista) e as estratégias 6–7 (escolha nula).

- [ ] **Step 10: Commit**

```bash
git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts games/idle/economia.ts games/idle/economia.test.ts games/idle/dica.ts games/idle/dica.test.ts games/idle/tela.ts supabase/migrations/0077_fellas_inc_catalogo_eras_6_7.sql games/test/db.ts games/dev/mockDb.ts games/test/idle.test.ts
git commit -m "Fellas Inc.: catálogo das eras 6 e 7 (geradores 31–42, gerais, legado, estratégias, conquistas 140–159) e o legado na conta (0077)"
```

---

### Task 2: O banco com 42 geradores, 6 estratégias e o legado (0078, parte A)

**Files:**
- Create: `supabase/migrations/0078_fellas_inc_eras_6_7.sql` (cabeçalho + parte A)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (0078)
- Modify: `games/idle/economia.ts` (`abertura`, l. 98–105), `games/idle/store.ts` (`estrategiaPendente`, l. 53–55), `games/idle/store.test.ts`
- Create: `games/test/idleEras67.test.ts`
- Modify: `games/test/idle.test.ts:46-47`, `games/test/idlePrestigio.test.ts:128,131,222,223,232`

**Interfaces:**
- Consumes: catálogo da Task 1 (0077: `idle_cat_upg.fonte_era/alvo_era`, tipo `legado`, estratégias 6–7).
- Produces: `idle_state.generators` com 42 posições, `strategies` com 6, coluna `silver_ate timestamptz`; `idle_gen_rendas` com o legado; `idle_upg_unlocked` com `legado`; `idle_pick_strategy` e `idle_buy` sem nulo; `idle_save`/`idle_json` com `silver_ate`; `idle_prestige` recomeça com 42/6 e zera o Silver. `abertura` devolve `cat.geradores.length` posições. `estrategiaPendente` conta posição faltando como `-1`.

- [ ] **Step 1: Testes do banco (falham)**

Crie `games/test/idleEras67.test.ts`:

```ts
// Eras 6 e 7 (0078): a conta do banco é a da página (legado, estratégias 6–7), o estado com 42 geradores e 6
// estratégias, a escolha e a compra sem nulo, a venda; o Silver tape, os eventos 6–7 e as conquistas (partes B e C).
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { custoMult, taxa, type Estado } from '../idle/economia';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';
let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
const M0078 = readFileSync(resolve(__dirname, '../../supabase/migrations/0078_fellas_inc_eras_6_7.sql'), 'utf8');
type J = { valuation: number; rate: number; generators: number[]; strategies: number[]; upgrades: number[]; era: number; silver_ate?: string | null };

// gerador pseudoaleatório fixo: os mesmos estados toda vez
function rng(seed: number) {
  return () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
}
/** Estados com 42 geradores (às vezes os das eras 6–7), melhorias ao acaso (com legado) e as 6 estratégias. */
function estados(n: number): Estado[] {
  const r = rng(67);
  const out: Estado[] = [];
  for (let i = 0; i < n; i++) {
    const generators = Array.from({ length: 42 }, (_, g) => (r() < 0.75 - g * 0.012 ? Math.floor(r() * 150) : 0));
    const upgrades = catalogo.melhorias.filter((m) => r() < (m.tipo === 'legado' ? 0.6 : 0.25)).map((m) => m.id);
    const strategies = [0, 1, 2, 3, 4, 5].map((k) => {
      const ops = catalogo.estrategias.filter((e) => e.era === k + 2 && e.ativa).map((e) => e.opcao);
      return r() < 0.8 ? ops[Math.floor(r() * ops.length)] : -1;
    });
    out.push({ generators, upgrades, strategies });
  }
  return out;
}
async function colocar(s: Estado) {
  await q('delete from public.idle_state where true');
  await q(`insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies)
           values ($1, public.games_week_start(), true, $2, $3, $4)`, [A, s.generators, s.upgrades, s.strategies]);
}

describe('paridade (0078 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
  });
  it('taxa com o legado e as estratégias das eras 6 e 7 é a de economia.ts', async () => {
    for (const s of estados(30)) {
      await colocar(s);
      const [{ r }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
      const esperado = taxa(catalogo, s);
      expect(Math.abs(r - esperado) / Math.max(1, esperado)).toBeLessThan(1e-9);
    }
  });
  it('o multiplicador de custo com o Hotel na Lua (0,75) é o de economia.ts', async () => {
    for (const strategies of [[0, 0, 0, 0, 0, 1], [1, 0, 0, 0, 1, 1], [0, 0, 0, 0, 0, 0]]) {
      const s: Estado = { generators: Array(42).fill(1), upgrades: [], strategies };
      await colocar(s);
      const [{ m }] = await q<{ m: number }>('select public.idle_cost_mult(s) as m from public.idle_state s where user_id = $1', [A]);
      expect(m).toBeCloseTo(custoMult(catalogo, s), 12);
    }
  });
});

describe('estado, escolha e compra (0078 parte A)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    // era 5 (1 de cada gerador até o 30) com as estratégias das eras 2–5 escolhidas
    await q(`update public.idle_state set valuation = 1e40, generators[1:30] = array_fill(1, array[30]), strategies = '{0,0,0,0,-1,-1}'
              where user_id = $1`, [A]);
  });
  const comprar = (kind: string, id: number, qty = 1) => t.rpc<J>('idle_buy', { p_kind: kind, p_id: id, p_qty: qty });

  it('o estado novo nasce com 42 geradores e 6 estratégias', async () => {
    await q('delete from public.idle_state where user_id = $1', [A]);
    const s = await t.rpc<J>('idle_open');
    expect(s.generators).toEqual(Array(42).fill(0));
    expect(s.strategies).toEqual([-1, -1, -1, -1, -1, -1]);
  });
  it('a 0078 completa quem tinha 4 estratégias e 30 geradores (e rodar de novo não muda nada)', async () => {
    await q(`update public.idle_state set strategies = '{0,1,0,1}', generators = array_fill(2, array[30]) where user_id = $1`, [A]);
    await t.db.exec(M0078);
    const [l] = await q<{ s: number[]; g: number[] }>('select strategies as s, generators as g from public.idle_state where user_id = $1', [A]);
    expect(l.s).toEqual([0, 1, 0, 1, -1, -1]);
    expect(l.g).toEqual([...Array(30).fill(2), ...Array(12).fill(0)]);
    await t.db.exec(M0078);
    const [l2] = await q<{ s: number[] }>('select strategies as s from public.idle_state where user_id = $1', [A]);
    expect(l2.s).toEqual([0, 1, 0, 1, -1, -1]);
  });
  it('entrar na era 6 pede a estratégia antes da próxima compra; as eras 6 e 7 aceitam a escolha', async () => {
    const s = await comprar('gerador', 31);
    expect(s.era).toBe(6);
    await expect(comprar('gerador', 1)).rejects.toThrow(/idle_strategy_pending/);
    const e6 = await t.rpc<J>('idle_pick_strategy', { p_era: 6, p_opcao: 1 });
    expect(e6.strategies).toEqual([0, 0, 0, 0, 1, -1]);
    await expect(t.rpc('idle_pick_strategy', { p_era: 6, p_opcao: 0 })).rejects.toThrow(/idle_strategy_set/);
    await expect(t.rpc('idle_pick_strategy', { p_era: 7, p_opcao: 0 })).rejects.toThrow(/idle_locked/);
    await q('update public.idle_state set generators[31:36] = array[1,1,1,1,1,1] where user_id = $1', [A]);
    await comprar('gerador', 37);
    const e7 = await t.rpc<J>('idle_pick_strategy', { p_era: 7, p_opcao: 1 });
    expect(e7.strategies).toEqual([0, 0, 0, 0, 1, 1]);
  });
  it('lista curta (4 estratégias, sem a migração rodar de novo): a era 6 ainda pede a escolha, e a escolha completa a lista', async () => {
    await q(`update public.idle_state set strategies = '{0,0,0,0}', generators[31] = 1 where user_id = $1`, [A]);
    await expect(comprar('gerador', 1)).rejects.toThrow(/idle_strategy_pending/);
    const s = await t.rpc<J>('idle_pick_strategy', { p_era: 6, p_opcao: 0 });
    expect(s.strategies).toEqual([0, 0, 0, 0, 0, -1]);
  });
  it('comprar o gerador 31 com a lista de geradores curta (30) não grava nulo', async () => {
    // a era 6 já escolhida (senão a compra do 33 pararia na estratégia antes de olhar o 32)
    await q(`update public.idle_state set strategies = '{0,0,0,0,0,-1}', generators = array_fill(1, array[30]) where user_id = $1`, [A]);
    const s = await comprar('gerador', 31, 10);
    expect(s.generators[30]).toBe(10);
    await expect(comprar('gerador', 33)).rejects.toThrow(/idle_locked/); // o 32 não tem
  });
  it('legado: trancado antes da era alvo; liberado nela; a melhoria do gerador 31 pede o gerador', async () => {
    await expect(comprar('melhoria', 3001)).rejects.toThrow(/idle_locked/);
    await expect(comprar('melhoria', 311)).rejects.toThrow(/idle_locked/);
    await q(`update public.idle_state set strategies = '{0,0,0,0,0,-1}', generators[31] = 1 where user_id = $1`, [A]);
    expect((await comprar('melhoria', 3001)).upgrades.map(Number)).toContain(3001);
    expect((await comprar('melhoria', 311)).upgrades.map(Number)).toContain(311);
    await expect(comprar('melhoria', 3006)).rejects.toThrow(/idle_locked/); // o legado da era 7
  });
  it('vender a startup recomeça com 42 geradores e 6 estratégias, e zera o Silver tape', async () => {
    await q(`update public.idle_state set strategies = '{0,0,0,0,0,0}', generators[30] = 150, generators[42] = 3, prestige_earned = 0,
               silver_ate = now() + interval '1 minute' where user_id = $1`, [A]);
    const s = await t.rpc<J>('idle_prestige');
    expect(s.generators).toEqual(Array(42).fill(0));
    expect(s.strategies).toEqual([-1, -1, -1, -1, -1, -1]);
    expect(s.silver_ate ?? null).toBeNull();
    const [l] = await q<{ x: string | null }>('select silver_ate::text as x from public.idle_state where user_id = $1', [A]);
    expect(l.x).toBeNull();
  });
  it('o JSON traz o Silver tape valendo e esconde o que já passou', async () => {
    await q(`update public.idle_state set silver_ate = now() + interval '90 seconds' where user_id = $1`, [A]);
    expect((await t.rpc<J>('idle_open')).silver_ate).not.toBeNull();
    await q(`update public.idle_state set silver_ate = now() - interval '1 second' where user_id = $1`, [A]);
    expect((await t.rpc<J>('idle_open')).silver_ate).toBeNull();
  });
});
```

Em `games/test/db.ts`, acrescente `'0078_fellas_inc_eras_6_7.sql',` depois da 0077; em `games/dev/mockDb.ts`, `import m78 from '../../supabase/migrations/0078_fellas_inc_eras_6_7.sql?raw';` e `m78` no fim do `for`.

Crie `supabase/migrations/0078_fellas_inc_eras_6_7.sql` vazio por enquanto (só pra o teste carregar: o Step 3 escreve o conteúdo).

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEras67.test.ts`
Expected: FAIL (estado com 30/4, `silver_ate` não existe, legado liberado errado).

- [ ] **Step 2: Os testes antigos que conferem o estado novo e a venda**

Em `games/test/idle.test.ts:46-47`: `strategies: [-1, -1, -1, -1]` → `strategies: [-1, -1, -1, -1, -1, -1]` e `Array(30).fill(0)` → `Array(42).fill(0)`. Em `games/test/idlePrestigio.test.ts`: linhas 128, 222 e 232 (`strategies: [-1, -1, -1, -1]` → `[-1, -1, -1, -1, -1, -1]`), linhas 131 e 223 (`Array(30).fill(0)` → `Array(42).fill(0)`).

- [ ] **Step 3: 0078, parte A**

Escreva em `supabase/migrations/0078_fellas_inc_eras_6_7.sql`:

```sql
-- fellasapp: Fellas Inc., eras 6 (Em órbita) e 7 (Lua) (15/10, entrega 1 do plano das eras 6–12). O estado guarda 42
-- geradores e 6 estratégias; o legado (as eras antigas ajudam a nova) entra na conta; o Houston (silver tape: produção
-- ×4 por 2 min) fica guardado; os eventos de era 6 e 7 (aceitos também com a era anterior) e as conquistas do monolito e
-- da era inteira. O catálogo (geradores 31–42, gerais, legado, estratégias, conquistas 140–159) é a 0077, gerada.
-- Spec: docs/superpowers/specs/2026-10-15-fellas-inc-eras-6-7-design.md. Idempotente.

-- ===== parte A: o estado, o legado na conta, a escolha, a compra e a venda =====
alter table public.idle_state add column if not exists silver_ate timestamptz; -- Houston (parte B)
alter table public.idle_state alter column generators set default array_fill(0, array[42]);
alter table public.idle_state alter column strategies set default '{-1,-1,-1,-1,-1,-1}';
-- quem tem menos posições ganha as que faltam: zeros nos geradores, -1 nas estratégias (e escolha nula vira -1)
update public.idle_state
   set generators = generators || array_fill(0, array[42 - cardinality(generators)])
 where cardinality(generators) < 42;
update public.idle_state
   set strategies = array(select coalesce(x, -1::smallint) from unnest(strategies) with ordinality u(x, k) order by k)
                    || array_fill(-1::smallint, array[greatest(0, 6 - cardinality(strategies))])
 where cardinality(strategies) < 6 or array_position(strategies, null) is not null;

-- melhoria liberada (a da 0034) com o legado (chega na era alvo) e sem nulo: gerador além do fim da lista conta 0
create or replace function public.idle_upg_unlocked(u public.idle_cat_upg, gens int[])
returns boolean language sql stable set search_path = public as $$
  select case u.tipo
    when 'gerador' then coalesce(gens[u.gerador], 0) >= u.requer
    when 'geral' then public.idle_era(gens) >= u.requer_era
    when 'legado' then public.idle_era(gens) >= u.requer_era
    else coalesce(gens[u.fonte], 0) >= u.requer_fonte and coalesce(gens[u.alvo], 0) >= u.requer_alvo
  end
$$;
revoke all on function public.idle_upg_unlocked(public.idle_cat_upg, int[]) from public, anon, authenticated;
```

Depois, copie `idle_gen_rendas` da 0076 (l. 100–128, o comentário, a função e o `revoke`) e mude:
- o comentário de cima por: `-- quanto cada gerador rende em t (a da 0076) com o legado: os geradores da era A rendem × (1 + Σ p × unidades da era F)`
  `-- de cada legado comprado (F → A), igual a economia.ts multLegado. Gerador além do fim da lista conta 0.`
- depois do CTE `glob as (…)` (antes de `  select c.id,`), troque `  )` + quebra + `  select c.id,` por:

```sql
  ), leg as (
    select u.alvo_era as era,
           1 + sum(u.por_unidade * (select coalesce(sum(coalesce(s.generators[g.id], 0)), 0)
                                      from public.idle_cat_gen g where g.era = u.fonte_era)) as m
      from public.idle_cat_upg u
     where u.tipo = 'legado' and u.id = any (s.upgrades)
     group by u.alvo_era
  )
  select c.id,
```

- `         c.renda * s.generators[c.id]` → `         c.renda * coalesce(s.generators[c.id], 0)`
- depois da linha da sinergia (`                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))`), acrescente a linha `         * coalesce((select leg.m from leg where leg.era = c.era), 1)`.

Copie `idle_pick_strategy` da 0038 (l. 310–353 + `revoke`/`grant` das l. 365–366) e mude:
- `  if s.strategies[p_era - 1] >= 0 then` → `  if coalesce(s.strategies[p_era - 1], -1) >= 0 then -- posição que falta (lista curta) conta como não escolhida`
- `  s.strategies[p_era - 1] := p_opcao;` →

```sql
  -- 0078: a lista tem 6 posições (eras 2 a 7); completa a curta antes de gravar
  s.strategies := s.strategies || array_fill(-1::smallint, array[greatest(0, 6 - cardinality(s.strategies))]);
  s.strategies[p_era - 1] := p_opcao;
```

Copie `idle_buy` da 0076 (l. 312–440, comentário + função + `revoke`/`grant`) e mude:
- o comentário: `-- comprar (o da 0076) sem nulo: estratégia que falta conta como pendente; gerador que falta na lista conta 0 (0078)`
- `  if v_era >= 2 and s.strategies[v_era - 1] < 0 then` → `  if v_era >= 2 and coalesce(s.strategies[v_era - 1], -1) < 0 then`
- `    if p_id > 1 and s.generators[p_id - 1] < 1 then` → `    if p_id > 1 and coalesce(s.generators[p_id - 1], 0) < 1 then`
- `    v_n := s.generators[p_id];` → `    v_n := coalesce(s.generators[p_id], 0);`

Copie `idle_save` da 0076 (l. 277–310) e mude o comentário pra `-- gravar o estado (o da 0076) com o Silver tape (0078)` e `combo_ate = s.combo_ate, combo_n = coalesce(s.combo_n, 0), combo_seg = s.combo_seg,` → `combo_ate = s.combo_ate, combo_n = coalesce(s.combo_n, 0), combo_seg = s.combo_seg, silver_ate = s.silver_ate,`.

Copie `idle_prestige` da 0076 (l. 442–511) e mude:
- o comentário: `-- vender a startup (o da 0076): recomeça com os geradores do catálogo (42) e as 6 estratégias, e zera o Silver tape (0078)`
- `  s.generators := array_fill(0, array[30]);` → `  s.generators := array_fill(0, array[(select count(*)::int from public.idle_cat_gen)]);`
- `  s.strategies := '{-1,-1,-1,-1}';` → `  s.strategies := '{-1,-1,-1,-1,-1,-1}';`
- `  s.espiadas := '{}';` →

```sql
  s.espiadas := '{}';
  s.silver_ate := null; -- o Silver tape do Houston zera (0078); o contador eventos_era fica
```

Copie `idle_json` da 0076 (l. 513–595) e mude o comentário pra `-- o estado que toda função devolve (o da 0076) + o Silver tape (0078, no 2º objeto)` e `    'horta_crescendo', public.idle_horta_crescendo(s.user_id));` →

```sql
    'horta_crescendo', public.idle_horta_crescendo(s.user_id),
    'silver_ate', case when s.silver_ate > now() then s.silver_ate end);
```

- [ ] **Step 4: A abertura e a estratégia pendente na página (testes primeiro)**

Em `games/idle/store.test.ts`, no teste `'estratégia pendente = era ≥ 2 sem escolha'`, acrescente:

```ts
    expect(estrategiaPendente(base({ era: 6, strategies: [0, 0, 0, 0] }))).toBe(6); // lista curta: a era 6 ainda não escolheu
    expect(estrategiaPendente(base({ era: 6, strategies: [0, 0, 0, 0, 1, -1] }))).toBeNull();
    expect(estrategiaPendente(base({ era: 7, strategies: [0, 0, 0, 0, 1, -1] }))).toBe(7);
```

Em `games/idle/economia.test.ts`, no `describe('estado curto …')`, acrescente:

```ts
  it('a empresa nova (abertura) nasce com os 42 geradores, como o banco', () => {
    expect(abertura(cat, efeitosArvore(cat, [])).generators).toHaveLength(42);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/store.test.ts idle/economia.test.ts`
Expected: FAIL nas três linhas novas.

Em `economia.ts`, `abertura`: `  const generators = Array(30).fill(0);` → `  const generators = Array(cat.geradores.length).fill(0);`. Em `store.ts`, troque `estrategiaPendente` por:

```ts
export function estrategiaPendente(estado: IdleState): number | null {
  // posição que falta (resposta de antes da 0078, com 4 estratégias) conta como não escolhida
  return estado.started && estado.era >= 2 && (estado.strategies[estado.era - 2] ?? -1) < 0 ? estado.era : null;
}
```

- [ ] **Step 5: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleEras67.test.ts test/idle.test.ts test/idlePrestigio.test.ts test/idleParidade.test.ts test/idleConquistas.test.ts test/idleEventosEra.test.ts test/idleDouradosCaixinha.test.ts idle/store.test.ts idle/economia.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0078_fellas_inc_eras_6_7.sql games/test/db.ts games/dev/mockDb.ts games/test/idleEras67.test.ts games/test/idle.test.ts games/test/idlePrestigio.test.ts games/idle/economia.ts games/idle/economia.test.ts games/idle/store.ts games/idle/store.test.ts
git commit -m "Fellas Inc.: o banco com 42 geradores, 6 estratégias e o legado na conta (0078, parte A)"
```

---
### Task 3: O ritmo das eras 6 e 7 na simulação (trava a calibração) e a régua das 12 eras

**Files:**
- Modify: `games/idle/simulacao.ts` (l. 36–38 e o fim do arquivo)
- Modify: `games/idle/simulacao.test.ts` (imports e dois `describe` novos no fim)

**Interfaces:**
- Consumes: `PARAMETROS_ESPACO`, `PRECO_NIVEL` (Task 1), `abertura` com 42 (Task 2).
- Produces: `RITMO_ERAS: Readonly<Record<number, number>>`, `FIM_ERA_12 = 60`; `Marcos.era` com as chaves 6 e 7.

- [ ] **Step 1: Os testes (falham)**

Em `games/idle/simulacao.test.ts`, troque os imports do topo por:

```ts
import { describe, expect, it } from 'vitest';

import { catalogo, PARAMETROS_ESPACO, PRECO_NIVEL } from './catalogo';
import { K_PRESTIGIO, pontosTotais, SEM_BONUS } from './economia';
import { FIM_ERA_12, gastar, primeiraVenda, RITMO_ERAS, simular, volta } from './simulacao';
import { mediaOportunidade, RODA_OPP_HOJE, RODA_OPP_NOVA } from './valorMedio';
```

E acrescente no fim do arquivo:

```ts
// Entrega 1 das eras 6–12 (15/10): os geradores 31–42 seguem o 2º trecho da curva (catalogo.ts PARAMETROS_ESPACO), as
// gerais e o legado (nomes.ts GERAL_6/GERAL_7/LEGADO_P) e as estratégias ×2. Medido ao planejar, 20 dias: era 6 em 10,5 d
// e era 7 em 16,0 d (oportunidades de ~20,4 min) ou 16,7 d (15 min); gerador 30 no dia 8. Se sair do alvo: ajuste SÓ
// esses números (nunca PARAMETROS, que é preço em produção), regere a 0077 com ATUALIZAR_CATALOGO e avise o Juan.
describe('ritmo das eras 6 e 7', () => {
  const sem = { horta: false, bolsa: false };
  const minutos = 15 * (mediaOportunidade(RODA_OPP_NOVA, sem) / mediaOportunidade(RODA_OPP_HOJE, sem));
  const m = simular(catalogo, 20, SEM_BONUS, [], minutos);
  const antigo = simular(catalogo, 20);
  it('era 6 por volta do dia 10 (entre 9 e 12 dias de jogo)', () => {
    expect(m.era[6]).not.toBeNull();
    expect(m.era[6]!).toBeGreaterThanOrEqual(9 * DIA);
    expect(m.era[6]!).toBeLessThan(12 * DIA);
  });
  it('era 7 por volta do dia 16 (entre 15 e 18 dias de jogo)', () => {
    expect(m.era[7]).not.toBeNull();
    expect(m.era[7]!).toBeGreaterThanOrEqual(15 * DIA);
    expect(m.era[7]!).toBeLessThan(18 * DIA);
  });
  it('com as oportunidades de antes (15 min), as mesmas faixas', () => {
    expect(antigo.era[6]!).toBeGreaterThanOrEqual(9 * DIA);
    expect(antigo.era[6]!).toBeLessThan(12 * DIA);
    expect(antigo.era[7]!).toBeGreaterThanOrEqual(15 * DIA);
    expect(antigo.era[7]!).toBeLessThan(18 * DIA);
  });
  it('a era 6 não sai antes do gerador 30 (o Foguete segue sendo a porta do espaço)', () => {
    expect(m.gerador30).not.toBeNull();
    expect(m.era[6]!).toBeGreaterThan(m.gerador30!);
  });
  it('a régua das 12 eras fica registrada (as 8+ são alvo das próximas entregas)', () => {
    expect(RITMO_ERAS).toEqual({ 6: 10, 7: 16, 8: 24, 9: 31, 10: 38, 11: 45, 12: 52 });
    expect(FIM_ERA_12).toBe(60);
  });
});

describe('os números cabem no double até a era 12', () => {
  it('a curva do 2º trecho até o gerador 72, com 300 unidades e a melhoria mais cara, fica longe de 1e308', () => {
    const q = PARAMETROS_ESPACO;
    const custo72 = q.custoInicial * q.crescimentoCusto ** (72 - q.aPartirDe);
    expect(custo72 * 1.15 ** 300 * PRECO_NIVEL[7]).toBeLessThan(1e100);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts`
Expected: FAIL (`RITMO_ERAS`/`FIM_ERA_12` não existem; `m.era[6]` sem a chave).

- [ ] **Step 2: A simulação**

Em `games/idle/simulacao.ts`, troque `strategies: [-1, -1, -1, -1]` (na criação de `s`) por `strategies: [-1, -1, -1, -1, -1, -1]` e `era: { 2: null, 3: null, 4: null, 5: null }` por `era: { 2: null, 3: null, 4: null, 5: null, 6: null, 7: null }`. No fim do arquivo, acrescente:

```ts

/** Régua das 12 eras (spec das eras 6–7, seção 7): o dia em que o jogador da simulação chega em cada era. As 6 e 7 saem
 *  do catálogo e simulacao.test.ts trava; da 8 em diante é o alvo das próximas entregas (ainda sem catálogo). A spec pede
 *  "8–9 dias por era" e "era 12 no dia 52": do dia 16 ao 52 dá ~7 por era, e a 12 dura 8 (até o dia 60). */
export const RITMO_ERAS: Readonly<Record<number, number>> = { 6: 10, 7: 16, 8: 24, 9: 31, 10: 38, 11: 45, 12: 52 };
export const FIM_ERA_12 = 60;
```

- [ ] **Step 3: Rodar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts`
Expected: PASS (os testes antigos do arquivo também: 2º notebook, eras 2–5, 17 pontos, volta 0,90). Se o ritmo novo falhar: ajuste só os números da Decisão 1, regere a 0077 (`ATUALIZAR_CATALOGO=0077_fellas_inc_catalogo_eras_6_7.sql npx vitest run --maxWorkers=4 idle/catalogo.test.ts`), rode de novo, e escreva os números novos no comentário do teste e no relatório.

- [ ] **Step 4: Commit**

```bash
git add games/idle/simulacao.ts games/idle/simulacao.test.ts
git commit -m "Fellas Inc.: ritmo das eras 6 e 7 na simulação (dia 10 e 16) e a régua das 12 eras"
```

---

### Task 4: Nomes dos números até o centilhão, o googol e a notação científica

**Files:**
- Modify: `games/idle/formatar.ts` (inteiro), `games/idle/formatar.test.ts`

**Interfaces:**
- Produces: `nomeGrupo(k: number): string` (0 = mil … 10 = deci, 11 = undeci … 100 = centi), `ULTIMO_GRUPO = 100`; `formatarValor`/`formatarTaxa` com as mesmas assinaturas.

- [ ] **Step 1: Os testes (falham)**

Em `games/idle/formatar.test.ts`, troque o import por `import { formatarTaxa, formatarValor, nomeGrupo } from './formatar';` e acrescente no fim:

```ts
describe('números gigantes (eras 6+)', () => {
  it('depois de "deci", os nomes saem por regra (prefixo + dezena) até o centilhão', () => {
    expect(Array.from({ length: 11 }, (_, i) => nomeGrupo(i))).toEqual(
      ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci']);
    expect(Array.from({ length: 10 }, (_, i) => nomeGrupo(11 + i))).toEqual(
      ['undeci', 'duodeci', 'tredeci', 'quatordeci', 'quindeci', 'sexdeci', 'septendeci', 'octodeci', 'novendeci', 'viginti']);
    expect([nomeGrupo(21), nomeGrupo(30), nomeGrupo(32), nomeGrupo(99), nomeGrupo(100)])
      .toEqual(['unviginti', 'triginti', 'duotriginti', 'novennonaginti', 'centi']);
    expect(new Set(Array.from({ length: 101 }, (_, i) => nomeGrupo(i))).size).toBe(101);
  });
  it.each([
    [1e36, 'F$ 1 undeci'], [4.5e63, 'F$ 4,5 viginti'], [1e99, 'F$ 1 duotriginti'], [2.5e100, 'F$ 2,5 googol'],
    [1e102, 'F$ 100 googol'], [9.999999999999999e102, 'F$ 999 googol'], [1e103, 'F$ 10 tretriginti'], [1e303, 'F$ 1 centi'],
    [9.99e305, 'F$ 999 centi'], [1.2e306, 'F$ 1,2 × 10³⁰⁶'], [Number.MAX_VALUE, 'F$ 1,79 × 10³⁰⁸'],
  ])('%s → %s', (n, s) => expect(formatarValor(n)).toBe(s));
  it('trunca na borda de cada faixa (nunca mostra mais do que tem)', () => {
    expect(formatarValor(9.999999999999999e98)).toBe('F$ 999 untriginti');
    expect(formatarValor(9.999999999999999e99)).toBe('F$ 9,99 duotriginti');
    expect(formatarValor(9.99999e305)).toBe('F$ 999 centi');
  });
  it('a taxa usa os mesmos nomes', () => {
    expect(formatarTaxa(2.5e100)).toBe('+F$ 2,5 googol/s');
    expect(formatarTaxa(3e306)).toBe('+F$ 3 × 10³⁰⁶/s');
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/formatar.test.ts`
Expected: FAIL (`nomeGrupo` não existe; 1e36 mostra "1.000 deci").

- [ ] **Step 2: `formatar.ts`**

Troque o arquivo inteiro por:

```ts
// Números da Fellas Inc. em pt-BR, resumidos e sempre truncados (nunca mostram mais do que a pessoa tem). Os nomes dos
// grupos de mil saem por regra (prefixo + dezena) até o centilhão (10³⁰³); de 10¹⁰⁰ até antes de 10¹⁰³ é "googol"
// (homenagem a quem deu o nome ao Google); de 10³⁰⁶ em diante, notação científica curta ("1,2 × 10³⁰⁶").
const ATE_DECI = ['mil', 'mi', 'bi', 'tri', 'quatri', 'quinti', 'sexti', 'septi', 'octi', 'noni', 'deci'] as const;
const PREFIXO = ['', 'un', 'duo', 'tre', 'quator', 'quin', 'sex', 'septen', 'octo', 'noven'] as const;
const DEZENA = ['', 'deci', 'viginti', 'triginti', 'quadraginti', 'quinquaginti', 'sexaginti', 'septuaginti', 'octoginti', 'nonaginti'] as const;
/** O último grupo com nome: centi = 10^303. */
export const ULTIMO_GRUPO = 100;
const GOOGOL = 100; // o expoente

/** O nome do grupo k (10^(3k + 3)): 0 mil, 1 mi … 10 deci, 11 undeci … 20 viginti … 99 novennonaginti, 100 centi. */
export function nomeGrupo(k: number): string {
  if (k <= 10) return ATE_DECI[k];
  if (k >= ULTIMO_GRUPO) return 'centi';
  return `${PREFIXO[k % 10]}${DEZENA[Math.floor(k / 10)]}`;
}

const SOBRESCRITO = '⁰¹²³⁴⁵⁶⁷⁸⁹';
const sobrescrito = (n: number) => [...String(n)].map((c) => SOBRESCRITO[Number(c)]).join('');

// Trunca nos dígitos decimais de n (os mesmos do literal, via toExponential), sem conta em ponto flutuante:
// dividir de mil em mil levava 1e33 a "999 noni"; x * 100 levava 1150 a "1,14 mil"; e 1e27 / 1e25 dá 99,999...
function resumir(n: number): string {
  if (n < 1000) return String(Math.floor(n));
  const [m, e] = n.toExponential().split('e');
  const exp = Number(e);
  const digitos = m.replace('.', '');
  /** Os primeiros dígitos com `inteiros` antes da vírgula (1 a 3) e casas até 3 algarismos no total. */
  const corta = (inteiros: number) => {
    const casas = inteiros >= 3 ? 0 : inteiros === 2 ? 1 : 2;
    const d = digitos.padEnd(inteiros + casas, '0').slice(0, inteiros + casas);
    return Number(`${d.slice(0, inteiros)}.${d.slice(inteiros) || '0'}`).toLocaleString('pt-BR', { maximumFractionDigits: casas });
  };
  if (exp >= 3 * ULTIMO_GRUPO + 6) return `${corta(1)} × 10${sobrescrito(exp)}`;
  if (exp >= GOOGOL && exp < GOOGOL + 3) return `${corta(exp - GOOGOL + 1)} googol`;
  const k = Math.floor(exp / 3) - 1;
  return `${corta(exp - 3 * (k + 1) + 1)} ${nomeGrupo(k)}`;
}

// Valor não finito ou negativo vira zero.
const valido = (n: number) => (Number.isFinite(n) && n > 0 ? n : 0);

export const formatarValor = (n: number) => `F$ ${resumir(valido(n))}`;

export function formatarTaxa(bruto: number): string {
  const n = valido(bruto);
  if (n < 10) return `+F$ ${(Math.floor(n * 10) / 10).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}/s`;
  return `+F$ ${resumir(n)}/s`;
}
```

- [ ] **Step 3: Rodar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/formatar.test.ts idle/dica.test.ts idle/dourados.test.ts idle/eventosEra.test.ts`
Expected: PASS (os casos antigos, inclusive `9.999999999999998e32 → 'F$ 999 noni'` e `1e33 → 'F$ 1 deci'`, continuam).

- [ ] **Step 4: Commit**

```bash
git add games/idle/formatar.ts games/idle/formatar.test.ts
git commit -m "Fellas Inc.: nomes dos números até o centilhão, o googol e a notação científica"
```

---
### Task 5: Silver tape na conta, os eventos 6 e 7 no banco (com a era anterior) e as conquistas (0078, partes B e C)

**Files:**
- Modify: `supabase/migrations/0078_fellas_inc_eras_6_7.sql` (acrescentar as partes B e C no fim)
- Modify: `games/idle/eventosEra.ts`, `games/idle/eventosEra.test.ts`, `games/idle/eventoEraTela.ts` (só os dois desenhos e uma guarda; a tela é da Task 9)
- Modify: `games/idle/store.ts` (`fatoresTempo`, l. 27–32), `games/idle/store.test.ts`
- Modify: `games/shared/types.ts` (`IdleState`, depois de `upg_desc_ate`), `games/shared/api.ts:68`, `games/dev/mockIdle.ts:50`
- Modify: `games/test/idleEras67.test.ts` (quatro `describe` novos)

**Interfaces:**
- Consumes: coluna `silver_ate` e `idle_save`/`idle_json` com ela (Task 2).
- Produces: `TipoEventoEra = 1 | … | 7`, `ULTIMA_ERA_COM_EVENTO = 7`, `MAX_DESVIOS = 3`, `DESVIO_S = 600`, `SILVER_MULT = 4`, `SILVER_S = 120`, `silverAtivo(s, agoraMs)`, `JANELA_EVENTO_S[6] = 10`, `[7] = 8`, `NOME_EVENTO_ERA[6] = 'Lixo espacial'`, `[7] = 'Houston, temos um problema'`; `fatoresTempo` com o ×4; `IdleState.silver_ate?: string | null`; `idleEventoPegar(seg, gols, tipo?)`; no banco `idle_evento_pegar(p_seg bigint, p_gols int default 0, p_tipo int default null)`, contadores `eventos_era.lixo`/`houston`, conquistas `evt_lixo`, `evt_houston`, `monolito`.

- [ ] **Step 1: Testes TS (falham)**

Em `games/idle/eventosEra.test.ts`: no import acrescente `DESVIO_S, MAX_DESVIOS, NOME_EVENTO_ERA, SILVER_MULT, silverAtivo`. No teste `'era 1: só a mãe; era acima de 5 conta como 5'`: título `'era 1: só a mãe; era acima de 7 conta como 7'` e a última linha `expect(eventoEraEm(A, s, 7)).toBe(eventoEraEm(A, s, 5))` → `expect(eventoEraEm(A, s, 9)).toBe(eventoEraEm(A, s, 7))`. No teste `'janelas e gols'`: `toEqual({ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30 })` → `toEqual({ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30, 6: 10, 7: 8 })` e acrescente `expect([MAX_DESVIOS, DESVIO_S, SILVER_MULT]).toEqual([3, 600, 4]);`. Acrescente no `describe('eventos de era: a sorte')`:

```ts
  it('eras 6 e 7: o Lixo e o Houston entram na roda; na era 7 o Houston sai ~3× mais que a mãe; na 6 não tem Houston', () => {
    const conta = [0, 0, 0, 0, 0, 0, 0, 0];
    for (let s = ini; s < ini + 2_000_000; s++) {
      const t = eventoEraEm(A, s, 7);
      if (t !== null) conta[t]++;
    }
    expect(conta[6]).toBeGreaterThan(0);
    expect(conta[7] / conta[1]).toBeGreaterThan(2);
    expect(conta[7] / conta[1]).toBeLessThan(4.5);
    for (let s = ini; s < ini + 400_000; s++) expect(eventoEraEm(A, s, 6)).not.toBe(7);
    expect([NOME_EVENTO_ERA[6], NOME_EVENTO_ERA[7]]).toEqual(['Lixo espacial', 'Houston, temos um problema']);
  });
```

No `describe('o que está valendo')`:

```ts
  it('Silver tape pelo fim; ausente ou null = nada', () => {
    const agora = Date.parse('2026-10-15T12:00:00Z');
    expect(silverAtivo({ silver_ate: '2026-10-15T12:01:52Z' }, agora)).toBe(true);
    expect(silverAtivo({ silver_ate: '2026-10-15T11:59:00Z' }, agora)).toBe(false);
    expect(silverAtivo({}, agora)).toBe(false);
    expect(silverAtivo({ silver_ate: null }, agora)).toBe(false);
  });
```

No `describe('textos e ganhos')`:

```ts
  it('Lixo e Houston: o que sobe e quanto dá agora', () => {
    expect(textoEventoPegou({ tipo: 6, premio: null, ganho: 3_600_000, gols: 3 })).toBe('3 destroços desviados! +F$ 3,6 mi');
    expect(textoEventoPegou({ tipo: 6, premio: null, ganho: 1_200_000, gols: 1 })).toBe('1 destroço desviado! +F$ 1,2 mi');
    expect(textoEventoPegou({ tipo: 7, premio: null, ganho: 0, gols: 0 })).toBe('Consertado com silver tape! ×4 por 2 min');
    expect(ganhoEventoAgora(6, 2000)).toBe(2000 * 600); // por destroço
    expect(ganhoEventoAgora(7, 2000)).toBe(2000 * 120 * 3); // o que o ×4 dá a mais em 2 min
  });
```

Em `games/idle/store.test.ts`, no `describe('fatoresTempo (0076)')`:

```ts
  it('Silver tape do Houston: ×4 até o fim (0078)', () => {
    expect(fatoresTempo({ silver_ate: '2026-10-15T12:02:00Z' } as IdleState)).toEqual([{ ateMs: Date.parse('2026-10-15T12:02:00Z'), mult: 4 }]);
    expect(fatoresTempo({ silver_ate: null } as IdleState)).toEqual([]);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/eventosEra.test.ts idle/store.test.ts`
Expected: FAIL.

- [ ] **Step 2: `eventosEra.ts`, `store.ts`, tipos e api**

Em `games/idle/eventosEra.ts`:
- `export type TipoEventoEra = 1 | 2 | 3 | 4 | 5;` → `export type TipoEventoEra = 1 | 2 | 3 | 4 | 5 | 6 | 7;`
- `/** A última era que tem evento (as eras 6+ trazem os delas nas entregas seguintes). */` + `export const ULTIMA_ERA_COM_EVENTO = 5;` → `/** A última era que tem evento (as eras 8+ trazem os delas nas entregas seguintes). */` + `export const ULTIMA_ERA_COM_EVENTO = 7;`
- `NOME_EVENTO_ERA`: depois de `5: 'Jogo do Brasil',` acrescente ` 6: 'Lixo espacial', 7: 'Houston, temos um problema',`
- `JANELA_EVENTO_S`: `{ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30 }` → `{ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30, 6: 10, 7: 8 }`
- depois de `export const MAX_GOLS = 7;`, acrescente:

```ts
/** Lixo espacial (era 6): quantos destroços passam, um de cada vez, e quanto cada desvio vale (s de produção). */
export const MAX_DESVIOS = 3;
export const DESVIO_S = 600;
/** Houston (era 7): o Silver tape multiplica a produção por 4 por 2 min (outro com um valendo soma 2 min no fim). */
export const SILVER_MULT = 4;
export const SILVER_S = 120;
```

- depois de `export const descontoAtivo = …;`, acrescente:

```ts
/** Silver tape do Houston valendo (produção ×4). */
export const silverAtivo = (s: { silver_ate?: string | null }, agoraMs: number) => vale(s.silver_ate, agoraMs);
```

- `ganhoEventoAgora` inteira por:

```ts
/** Quanto entra em F$ na hora, com a produção `rate` de agora: Shopee (se sair F$), a call, 1 gol, 1 destroço desviado; no
 *  Houston, o que o ×4 dá a mais nos 2 min. */
export function ganhoEventoAgora(tipo: TipoEventoEra, rate: number): number {
  if (tipo === 2) return rate * 3600 * 0.8;
  if (tipo === 3) return rate * 1800;
  if (tipo === 5) return rate * 300;
  if (tipo === 6) return rate * DESVIO_S;
  if (tipo === 7) return rate * SILVER_S * (SILVER_MULT - 1);
  return 0;
}
```

- em `textoEventoPegou`, antes da última linha (`return \`${e.gols} ${e.gols === 1 ? 'gol' : 'gols'}! …\``), acrescente:

```ts
  if (e.tipo === 6) return `${e.gols} ${e.gols === 1 ? 'destroço desviado' : 'destroços desviados'}! +${formatarValor(e.ganho)}`;
  if (e.tipo === 7) return `Consertado com silver tape! ×${SILVER_MULT} por 2 min`;
```

Em `games/idle/store.ts`: `import { SILVER_MULT } from './eventosEra';` e troque `fatoresTempo` por:

```ts
/** Os bônus com tempo do estado que multiplicam a produção toda: LinkedIn (o mult que o banco congelou) e Combo (0076) e o
 *  Silver tape do Houston (0078). */
export function fatoresTempo(s: Pick<IdleState, 'linkedin_ate' | 'linkedin_mult' | 'combo_ate' | 'silver_ate'>): FatorTempo[] {
  const out: FatorTempo[] = [];
  if (s.linkedin_ate && s.linkedin_mult) out.push({ ateMs: Date.parse(s.linkedin_ate), mult: s.linkedin_mult });
  if (s.combo_ate) out.push({ ateMs: Date.parse(s.combo_ate), mult: COMBO_MULT });
  if (s.silver_ate) out.push({ ateMs: Date.parse(s.silver_ate), mult: SILVER_MULT });
  return out;
}
```

Em `games/shared/types.ts`, depois da linha `upg_desc_ate?: string | null;` (e o comentário dela), acrescente:

```ts
  /** Silver tape do Houston (evento de era 7): produção ×4 até aqui. Ausente/null = sem (0078). */
  silver_ate?: string | null;
```

Em `games/shared/api.ts:68`: `export const idleEventoPegar = (seg: number, gols: number, tipo?: number) => rpc<IdleState>('idle_evento_pegar', { p_seg: seg, p_gols: gols, p_tipo: tipo ?? null });`. Em `games/dev/mockIdle.ts:50`: `export const idleEventoPegar = (seg: number, gols: number, tipo?: number) => call<IdleState>('select public.idle_evento_pegar($1, $2, $3) as v', [seg, gols, tipo ?? null]);`.

Em `games/idle/eventoEraTela.ts` (o tipo agora vai até 7 e `ICONES` é um `Record<TipoEventoEra, …>`), acrescente os dois desenhos no fim de `ICONES` (depois do `5: [...]`, a bola):

```ts
  // o destroço: pedaço de satélite com os painéis azuis, rodando (eras 6–7)
  6: ['............', '.KKKK.......', '.KCAK..K....', '.KACKKKKK...', '.KCAKNWNK...', '.KKKKNNNKKK.',
      '.....KNNKCK.', '...K.KKKKAK.', '.........KK.', '..K.........', '.......K....', '............'],
  // o alarme: a sirene vermelha com a luz saindo
  7: ['............', 'O....WW....O', '.O..KKKK..O.', '...KRRWRK...', '..KRRRHRRK..', 'OOKRRRHRRKOO',
      '..KRRRRRRK..', '.KKKKKKKKKK.', '.KNNNNNNNNK.', '.KKKKKKKKKK.', '............', '............'],
```

e, na primeira linha de `mostrar` (antes de `const ateMs = …`), a guarda até a tela deles chegar (a Task 9 tira):

```ts
      if (e.tipo === 6 || e.tipo === 7) return; // Lixo espacial e Houston: a tela deles chega com o desenho (até lá não aparecem)
```

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/eventosEra.test.ts idle/store.test.ts idle/dica.test.ts idle/eventoEraTela.test.ts`
Expected: PASS. Não mude texto de tela aqui (a caixinha e o desenho dos eventos 6–7 são da Task 9).

- [ ] **Step 3: Testes do banco (falham)**

Em `games/test/idleEras67.test.ts`, acrescente ao import de `../idle/economia` `produzido, VIRAL_MS` e o import `import { eventoEraEm } from '../idle/eventosEra';`, e no fim:

```ts
const taxaA = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const tem = async (id: number) => (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;

describe('a sorte das eras 6 e 7 (paridade com eventosEra.ts)', () => {
  beforeEach(async () => { t = await freshDb({ conquistas: false }); });
  it('os mesmos segundos e tipos em 200 mil segundos, eras 6 e 7', async () => {
    const ini = 1_760_000_000;
    for (const era of [6, 7]) {
      const sql = await q<{ s: string; e: number }>(
        `select s::text, e from (select s, public.idle_evento_era($1::uuid, s, $4) as e from generate_series($2::bigint, $3::bigint) s) x
          where e is not null order by s`, [A, ini, ini + 200_000 - 1, era]);
      const ts: { s: string; e: number }[] = [];
      for (let s = ini; s < ini + 200_000; s++) {
        const e = eventoEraEm(A, s, era);
        if (e !== null) ts.push({ s: String(s), e });
      }
      expect(ts.length).toBeGreaterThan(60);
      expect(sql).toEqual(ts);
    }
  });
});

describe('Silver tape na conta (0078 parte B)', () => {
  beforeEach(async () => {
    t = await freshDb({ conquistas: false });
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  });
  it('fechar a conta com o Silver tape é igual a produzido, sozinho e junto de ×5, Viralizou, Marmita, LinkedIn e Combo', async () => {
    const casos = [
      { boost: null, viral: null, marmita: null, linkedin: null, combo: null },
      { boost: 20, viral: 60, marmita: 30, linkedin: 50, combo: 70 },
    ];
    for (const c of casos) {
      await q(`update public.idle_state set settled_at = now(), silver_ate = now() + interval '40 seconds',
                 boost_ate = case when $2::int is null then '{}' else array[now() + make_interval(secs => $2)] end,
                 viral_ate = case when $3::int is null then '{}' else array[now() + make_interval(secs => $3)] end,
                 marmita_ate = case when $4::int is null then null else now() + make_interval(secs => $4) end,
                 linkedin_ate = case when $5::int is null then null else now() + make_interval(secs => $5) end, linkedin_mult = 2.5,
                 combo_ate = case when $6::int is null then null else now() + make_interval(secs => $6) end
               where user_id = $1`, [A, c.boost, c.viral, c.marmita, c.linkedin, c.combo]);
      const r = await taxaA();
      const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
        `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
           from public.idle_state s where user_id = $1`, [A]);
      const outros = [
        ...(c.linkedin === null ? [] : [{ ateMs: c.linkedin * 1000, mult: 2.5 }]),
        ...(c.combo === null ? [] : [{ ateMs: c.combo * 1000, mult: 7 }]),
        { ateMs: 40_000, mult: 4 },
      ];
      const esperado = produzido(r, 0, 100_000, c.boost === null ? null : [c.boost * 1000], c.viral === null ? [] : [c.viral * 1000],
        VIRAL_MS, c.marmita === null ? null : c.marmita * 1000, outros);
      expect(v1 - v0).toBeCloseTo(esperado, 0);
    }
  });
});

describe('pegar os eventos das eras 6 e 7 (0078 parte C)', () => {
  type JE = J & { eventos_era: Record<string, number>; evento: { tipo: number; ganho: number; gols: number } };
  const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
  /** O tipo do segundo `seg`; com `era`, só pra essa era (a anterior pode sortear outro tipo no mesmo segundo). */
  const evento = (seg: number, tipo: number, era: number | null = null) => q('insert into public.teste_evento67 values ($1, $2, $3)', [seg, era, tipo]);
  const pegar = (seg: number, gols = 0, tipo: number | null = null) => t.rpc<JE>('idle_evento_pegar', { p_seg: seg, p_gols: gols, p_tipo: tipo });
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;

  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas (156, 157)
    await t.db.exec(`
      create table public.teste_evento67 (s bigint, era int, tipo int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select x.tipo from public.teste_evento67 x where x.s = idle_evento_era.s and (x.era is null or x.era = idle_evento_era.era)
          order by x.era nulls last limit 1';`);
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    // era 7 (1 de cada gerador), estratégias escolhidas, e a conta parada (o settle não mexe no valuation)
    await q(`update public.idle_state set valuation = 1e12, generators[1:42] = array_fill(1, array[42]), strategies = '{0,0,0,0,0,0}',
               settled_at = now() + interval '1 day' where user_id = $1`, [A]);
  });

  it('Lixo: 10 min de produção por destroço; 4 vira 3, negativo vira 0; 2 desvios não dão a conquista, 3 dão', async () => {
    const seg = await agoraSeg();
    await evento(seg, 6);
    let r = await taxaA();
    let antes = await valor();
    const s2 = await pegar(seg, 2);
    expect(s2.valuation - antes).toBeCloseTo(r * 600 * 2, 2);
    expect(await tem(156)).toBe(false);
    await evento(seg - 1, 6);
    r = await taxaA();
    antes = await valor();
    const s = await pegar(seg - 1, 4);
    expect(s.valuation - antes).toBeCloseTo(r * 600 * 3, 2);
    expect(s.evento).toMatchObject({ tipo: 6, gols: 3 });
    expect(s.eventos_era).toMatchObject({ lixo: 2 });
    expect(await tem(156)).toBe(true);
    await evento(seg - 2, 6);
    antes = await valor();
    expect((await pegar(seg - 2, -5)).valuation - antes).toBeCloseTo(0, 6);
  });
  it('Houston: Silver tape ×4 por 2 min; outro com um valendo soma 2 min; o 10º dá "Silver tape resolve"', async () => {
    const seg = await agoraSeg();
    await q(`update public.idle_state set eventos_era = '{"houston": 8}' where user_id = $1`, [A]);
    await evento(seg, 7);
    const s = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(s.silver_ate!) - agora).toBeCloseTo(120_000, -3);
    expect(s.evento).toMatchObject({ tipo: 7, ganho: 0 });
    expect(await tem(157)).toBe(false);
    await evento(seg - 1, 7);
    const s2 = await pegar(seg - 1);
    expect(Date.parse(s2.silver_ate!) - agora).toBeCloseTo(240_000, -3);
    expect(s2.eventos_era).toMatchObject({ houston: 10 });
    expect(await tem(157)).toBe(true);
  });
  it('janelas: Lixo até 10 + 3 s, Houston até 8 + 3 s', async () => {
    const seg = await agoraSeg();
    await evento(seg - 14, 6);
    await expect(pegar(seg - 14, 1)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 11, 6); // 11 s (+ o que passou do segundo) < 13 s
    await expect(pegar(seg - 11, 1)).resolves.toBeTruthy();
    await evento(seg - 13, 7);
    await expect(pegar(seg - 13)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 9, 7);
    await expect(pegar(seg - 9)).resolves.toBeTruthy();
  });
  it('a era mudou entre aparecer e clicar: vale o tipo da era anterior que a página mostrou; outro tipo é gone; sem p_tipo, o de agora', async () => {
    const seg = await agoraSeg();
    await evento(seg, 5, 6); // com a era 6 o segundo sorteia o Jogo do Brasil…
    await evento(seg, 7, 7); // …e com a 7 (a de agora) o Houston
    const r = await taxaA();
    const antes = await valor();
    const s = await pegar(seg, 2, 5);
    expect(s.evento).toMatchObject({ tipo: 5, gols: 2 });
    expect(s.valuation - antes).toBeCloseTo(r * 300 * 2, 2);
    await evento(seg - 1, 3, 6);
    await evento(seg - 1, 7, 7);
    await expect(pegar(seg - 1, 0, 1)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 2, 5, 6);
    await evento(seg - 2, 7, 7);
    expect((await pegar(seg - 2)).evento).toMatchObject({ tipo: 7 });
  });
  it('quem não é membro não pega', async () => {
    await t.as(B);
    await expect(pegar(await agoraSeg())).rejects.toThrow(/not_member/);
  });
});

describe('conquistas das eras 6 e 7 (0078 parte C)', () => {
  beforeEach(async () => {
    t = await freshDb();
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q(`update public.idle_state set valuation = 1e40, strategies = '{0,0,0,0,0,0}', generators[1:30] = array_fill(1, array[30])
              where user_id = $1`, [A]);
  });
  it('a 100ª unidade do gerador 31 dá a 140 (não a 31)', async () => {
    await q('update public.idle_state set generators[31] = 100 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(140)).toBe(true);
  });
  it('o monolito (158) aparece com 1 de cada gerador da era 7; faltando um, não', async () => {
    await q('update public.idle_state set generators[31:42] = array[1,1,1,1,1,1,1,1,1,1,1,0] where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(158)).toBe(false);
    await q('update public.idle_state set generators[42] = 1 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(158)).toBe(true);
  });
  it('300 de cada gerador da era 6 (152); todas as 57 melhorias da era 6 (154: 48 de gerador, 4 gerais, 5 de legado)', async () => {
    await q('update public.idle_state set generators[31:36] = array[300,300,300,300,300,299] where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(152)).toBe(false);
    await q('update public.idle_state set generators[36] = 300 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(152)).toBe(true);
    const todas = (await q<{ id: number }>(
      `select u.id from public.idle_cat_upg u left join public.idle_cat_gen g on g.id = u.gerador
        where (u.tipo = 'gerador' and g.era = 6) or (u.tipo in ('geral', 'legado') and u.requer_era = 6)`)).map((x) => x.id);
    expect(todas).toHaveLength(57);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas.filter((id) => id !== 3005)]);
    await t.rpc('idle_open');
    expect(await tem(154)).toBe(false);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas]);
    await t.rpc('idle_open');
    expect(await tem(154)).toBe(true);
  });
  it('Daisy, Daisy (159): comprar a última melhoria do HAL', async () => {
    await q('update public.idle_state set generators[31:34] = array[1,1,1,300] where user_id = $1', [A]);
    await t.rpc('idle_buy', { p_kind: 'melhoria', p_id: 348, p_qty: 1 });
    expect(await tem(159)).toBe(true);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEras67.test.ts`
Expected: FAIL nos `describe` novos (a sorte das eras 6–7, o ×4 no settle, `p_tipo`, os tipos 6/7 e as conquistas novas não existem no banco).

- [ ] **Step 4: 0078, partes B e C**

Acrescente no fim de `supabase/migrations/0078_fellas_inc_eras_6_7.sql`:

```sql

-- ===== parte B: Houston, temos um problema (Silver tape: produção ×4 até silver_ate) =====
```

Copie `idle_settle` da 0076 (l. 207–275, comentário + função + `revoke`) e mude:
- o comentário: `-- fechar a conta (a da 0076) com o Silver tape do Houston (×4, 0078), como a Marmita: multiplica por cima, só o fim importa`
- depois da linha `                     union select s.combo_ate where s.combo_ate > v_a and s.combo_ate < v_b`, acrescente `                     union select s.silver_ate where s.silver_ate > v_a and s.silver_ate < v_b`
- `                * (case when s.combo_ate > v_meio then 7 else 1 end);` →

```sql
                * (case when s.combo_ate > v_meio then 7 else 1 end)
                -- Silver tape do Houston (0078): começou antes de settled_at (pegar fecha a conta), só o fim importa
                * (case when s.silver_ate > v_meio then 4 else 1 end);
```

Depois, acrescente:

```sql

-- ===== parte C: os eventos das eras 6 e 7 e as conquistas =====
-- o evento do segundo s pra quem está na era `era` (a da 0074, agora de 1 a 7; acima de 7 conta como 7), ou null. O da
-- era atual pesa 3, os antigos 1 (igual a eventoEraEm)
create or replace function public.idle_evento_era(u uuid, s bigint, era int)
returns int language plpgsql immutable set search_path = public as $$
declare
  p   constant numeric := 2147483647;
  k   constant numeric := 1013904223;
  h   numeric;
  v_ate int := greatest(1, least(era, 7));
  r   int;
  e   int;
begin
  h := mod(s::numeric * s * 16807 + s::numeric * 69621 + public.idle_opp_seed(u)::numeric * 48271 + 4242, p);
  h := mod(h * h + k, p);
  if mod(h, 1800) <> 0 then
    return null;
  end if;
  r := mod(mod(h * h + k, p), v_ate - 1 + 3)::int;
  for e in 1 .. v_ate loop
    r := r - case when e = v_ate then 3 else 1 end;
    if r < 0 then
      return e;
    end if;
  end loop;
  return v_ate;
end;
$$;
revoke all on function public.idle_evento_era(uuid, bigint, int) from public, anon, authenticated;

-- pegar o evento de era (o da 0074) com as eras 6 e 7: Lixo espacial (10 min de produção por destroço desviado; a página
-- manda quantos no fim, em p_gols, e o banco aceita 0 a 3) e "Houston, temos um problema" (Silver tape: produção ×4 por 2
-- min; outro com um valendo soma 2 min no fim). p_tipo = o tipo que a página mostrou: vale se ele sai com a era de agora
-- ou com a anterior (comprou o 1º gerador da era seguinte com o evento na tela); outro tipo é gone; sem p_tipo (página
-- velha), o da era de agora. Devolve o estado + "evento": {tipo, premio, ganho, gols (no Lixo, os desvios)}.
drop function if exists public.idle_evento_pegar(bigint, int);
create or replace function public.idle_evento_pegar(p_seg bigint, p_gols int default 0, p_tipo int default null)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
  v_era   int;
  v_tipo  int;
  v_ini   timestamptz;
  v_rate  double precision;
  v_ganho double precision := 0;
  v_premio int;
  v_gols  int := 0;
  v_chave text;
  v_n     int;
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
    raise exception 'idle_evento_gone' using errcode = 'P0001';
  end if;
  v_era := public.idle_era(s.generators);
  v_tipo := public.idle_evento_era(v_me, p_seg, v_era);
  if p_tipo is not null and p_tipo is distinct from v_tipo then
    if v_era > 1 and p_tipo = public.idle_evento_era(v_me, p_seg, v_era - 1) then
      v_tipo := p_tipo; -- a página mostrou com a era anterior
    else
      raise exception 'idle_evento_gone' using errcode = 'P0001';
    end if;
  end if;
  v_ini := to_timestamp(p_seg);
  -- na tela: 8 / 12 / 12 / 5 / 30 / 10 / 8 s (igual a JANELA_EVENTO_S); o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => (array[8, 12, 12, 5, 30, 10, 8])[v_tipo] + 3) then
    raise exception 'idle_evento_gone' using errcode = 'P0001';
  end if;
  delete from public.idle_eventos_pegos where user_id = v_me and pegou_em < now() - interval '1 hour';
  insert into public.idle_eventos_pegos (user_id, seg) values (v_me, p_seg) on conflict do nothing;
  if not found then
    raise exception 'idle_evento_pego' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  case v_tipo
    when 1 then -- Desce pra almoçar!: Marmita da mãe, ×3 por 3 min (outra soma no fim)
      s.marmita_ate := greatest(coalesce(s.marmita_ate, now()), now()) + interval '3 minutes';
    when 2 then -- Pacote da Shopee
      v_premio := public.idle_evento_shopee(v_me, p_seg);
      if v_premio = 0 then
        v_ganho := v_rate * 3600 * 0.8; -- Taxa das blusinhas: −20%
      elsif v_premio = 1 then
        s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + interval '1 minute');
      else
        s.boost_ate := array(select b from unnest(s.boost_ate) b where b > now()) || (now() + interval '2 minutes');
      end if;
    when 3 then -- Reunião que podia ser um e-mail: o tempo que você ia perder
      v_ganho := v_rate * 1800;
    when 4 then -- Tela azul: Atualização instalada, melhorias −25% por 2 min
      s.upg_desc_ate := greatest(coalesce(s.upg_desc_ate, now()), now()) + interval '2 minutes';
    when 5 then -- Jogo do Brasil: 5 min de produção por gol, até 7
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 7);
      v_ganho := v_rate * 300 * v_gols;
    when 6 then -- Lixo espacial: 10 min de produção por destroço desviado, até 3
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 3);
      v_ganho := v_rate * 600 * v_gols;
    else -- Houston, temos um problema: Silver tape, produção ×4 por 2 min (outro com um valendo soma 2 min no fim)
      s.silver_ate := greatest(coalesce(s.silver_ate, now()), now()) + interval '2 minutes';
  end case;
  s.valuation := s.valuation + v_ganho;
  v_chave := (array['mae', 'shopee', 'call', 'tela', 'jogos', 'lixo', 'houston'])[v_tipo];
  v_n := coalesce((s.eventos_era ->> v_chave)::int, 0) + 1;
  s.eventos_era := coalesce(s.eventos_era, '{}'::jsonb) || jsonb_build_object(v_chave, v_n);
  perform public.idle_ganhar(v_me, (array['evt_mae', 'evt_shopee', 'evt_call', 'evt_tela', 'evt_gols', 'evt_lixo', 'evt_houston'])[v_tipo],
                             case when v_tipo in (5, 6) then v_gols else v_n end);
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('evento', jsonb_build_object(
    'tipo', v_tipo, 'premio', v_premio, 'ganho', v_ganho, 'gols', v_gols));
end;
$$;
revoke all on function public.idle_evento_pegar(bigint, int, int) from public, anon;
grant execute on function public.idle_evento_pegar(bigint, int, int) to authenticated;
```

Copie `idle_check_conquistas` da 0074 (l. 472–547) e mude:
- um comentário em cima: `-- conquistas de estado (a da 0074) com o monolito (1 de cada gerador da era 7) e o legado em "todas as melhorias da era" (0078)`
- `                where ((u.tipo = 'gerador' and g.era = c.alvo) or (u.tipo = 'geral' and u.requer_era = c.alvo))` → `                where ((u.tipo = 'gerador' and g.era = c.alvo) or (u.tipo in ('geral', 'legado') and u.requer_era = c.alvo))`
- antes da linha `             else false`, acrescente:

```sql
             -- eras 6–7 (0078): o monolito aparece com 1 de cada gerador da era 7
             when c.tipo = 'monolito' then not exists (
               select 1 from public.idle_cat_gen g where g.era = 7 and coalesce(s.generators[g.id], 0) < 1)
```

- e depois do `$$;`: `revoke all on function public.idle_check_conquistas(uuid) from public, anon, authenticated;`

- [ ] **Step 5: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 test/idleEras67.test.ts test/idleEventosEra.test.ts test/idleConquistas.test.ts test/idleDouradosCaixinha.test.ts test/idlePrestigio.test.ts idle/eventosEra.test.ts idle/store.test.ts`
Expected: PASS (os testes da 0074 continuam: eles chamam `idle_evento_pegar` com `p_seg`/`p_gols` por nome e o stub deles ignora a era).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/0078_fellas_inc_eras_6_7.sql games/idle/eventosEra.ts games/idle/eventosEra.test.ts games/idle/eventoEraTela.ts games/idle/store.ts games/idle/store.test.ts games/shared/types.ts games/shared/api.ts games/dev/mockIdle.ts games/test/idleEras67.test.ts
git commit -m "Fellas Inc.: Silver tape na conta, Lixo espacial e Houston no banco (aceitos com a era anterior) e as conquistas das eras 6 e 7 (0078)"
```

---
### Task 6: Cena da Lua e peças de cena (o código)

**Files:**
- Modify: `games/idle/palco.ts` (`NomeCena`, `CENAS`, `Gente`, `chaveGente`, `pedir`), `games/idle/palco.test.ts`
- Modify: `games/idle/montagem.ts` (`Vagas`, `VAGAS_CONTRATADO`, `montarTira`, `validarVagas`), `games/idle/montagem.test.ts`
- Modify: `games/idle/ativos.ts` (`Camadas`, `camadas`)
- Modify: `games/idle/store.ts` (`cenaDoEstado`, `rotuloEra`, `pecasVisiveis`), `games/idle/store.test.ts`
- Modify: `games/idle/main.ts` (a linha do `palco.gente`, l. 639, e o import de `./store`)

**Interfaces:**
- Consumes: `ERAS` com 7 nomes (Task 1).
- Produces: `NomeCena` com `'cena-7'`; `type Peca = { id: string; x: number; y: number }`; `Vagas.pecas?: Peca[]`; `montarTira(c, gente, kit, pecas?: { img: Imagem; x: number; y: number }[])`; `Gente.pecas?: readonly string[]`; `Camadas.pecas: (Peca & { url: string })[]`; `pecasVisiveis(estado): string[]` (ids `g31`…`g42` e `monolito`), `CONQUISTA_MONOLITO = 158`. **Contrato de formato da arte (a Task 7 segue):** a peça `<id>` da cena `cena-N` é `games/idle/assets/cenas/cena-N-peca-<id>.png`, uma tira com os quadros da cena lado a lado (largura = quadros × w, fundo transparente, contorno preto como as cenas), listada em `pecas` de `cena-N-vagas.json` com o canto de cima à esquerda (`x`, `y`) na cena 160×96. Desenhada depois do fundo e antes das pessoas e da frente.

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67 && git merge main
```

Resolver conflito a favor do visual da main (reponha por cima só as linhas deste plano). Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`. Expected: PASS (menos o `ativos.test.ts` dos ícones novos, que espera a Task 7).

- [ ] **Step 1: Testes (falham)**

Em `games/idle/montagem.test.ts`, no `describe('montarTira')`, acrescente:

```ts
  it('peças da cena (eras 6+): por cima do fundo, por baixo das pessoas e da frente, quadro a quadro', () => {
    const vg = so([vaga('voce', 'dono', undefined, 10, 10)]);
    const peca = vazia(2 * 4, 3); // 2 quadros de 4×3
    pinta(peca, 0, 0, '#00FF00');
    pinta(peca, 1, 0, '#00FF00');
    pinta(peca, 4, 0, '#0000FF');
    const embaixo = vazia(2 * 2, 2); // debaixo da pessoa (10, 10)
    pinta(embaixo, 0, 0, '#FF0000');
    pinta(embaixo, 2, 0, '#FF0000');
    const frente = vazia(320, 96);
    pinta(frente, 160 + 51, 40, '#FFFFFF');
    const t = montarTira({ fundo: fundo(), frente, vagas: vg }, ocuparVagas(vg, V, []), kitFalso(),
      [{ img: peca, x: 50, y: 40 }, { img: embaixo, x: 10, y: 10 }]);
    expect(cor(t, 50, 40)).toBe('#00FF00'); // quadro 0: a 1ª coluna da tira da peça
    expect(cor(t, 160 + 50, 40)).toBe('#0000FF'); // quadro 1: a 2ª
    expect(cor(t, 160 + 51, 40)).toBe('#FFFFFF'); // a frente cobre a peça
    expect(cor(t, 52, 40)).toBe('#121212'); // pixel transparente da peça mostra o fundo
    expect(cor(t, 10, 10)).toBe(PELES[0][1]); // a pessoa fica por cima da peça
  });
  it('sem peça nenhuma, a tira é a de antes', () => {
    const vg = so([vaga('voce', 'dono', undefined, 10, 10)]);
    const a = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    const b = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso(), []);
    expect(b.d).toEqual(a.d);
  });
```

E no `describe` do `validarVagas` (ou no fim do arquivo, num `describe('peças no JSON das vagas')`):

```ts
describe('peças no JSON das vagas', () => {
  const base = (): Vagas => ({ quadros: 2, vagas: [vaga('voce', 'dono', undefined, 10, 10)] });
  it('id único e dentro da cena', () => {
    expect(validarVagas({ ...base(), pecas: [{ id: 'g31', x: 0, y: 0 }, { id: 'monolito', x: 159, y: 95 }] }, 2, 0)).toEqual([]);
    expect(validarVagas({ ...base(), pecas: [{ id: 'g31', x: 0, y: 0 }, { id: 'g31', x: 5, y: 5 }] }, 2, 0)).toContain('peça repetida ou sem id: g31');
    expect(validarVagas({ ...base(), pecas: [{ id: 'g32', x: 170, y: 0 }] }, 2, 0)).toContain('peça g32: fora da cena');
    expect(validarVagas({ ...base(), pecas: [{ id: 'g33', x: 1.5, y: 0 }] }, 2, 0)).toContain('peça g33: fora da cena');
  });
});
```

(`vaga(...)` e `so(...)` são os ajudantes que o arquivo já tem; se `vaga` estiver dentro de outro `describe`, suba-o pro topo do arquivo.)

Em `games/idle/palco.test.ts`, no teste `'chave da gente muda …'`, acrescente:

```ts
    expect(chaveGente({ dono: PADRAO, equipe: [], pecas: ['g31'] })).not.toBe(a);
    expect(chaveGente({ dono: PADRAO, equipe: [], pecas: ['g32', 'g31'] })).toBe(chaveGente({ dono: PADRAO, equipe: [], pecas: ['g31', 'g32'] }));
    expect(chaveGente({ dono: PADRAO, equipe: [], pecas: [] })).toBe(a);
```

e no teste `'todas as cenas têm quadros e ritmo'`: `expect(CENAS['cena-7']).toEqual({ quadros: 8, atrasoMs: 150 });`.

Em `games/idle/store.test.ts`: acrescente `pecasVisiveis` no import de `./store` e:

```ts
describe('eras 6 e 7 na cena', () => {
  it('a cena da órbita (Foguete ou era 6) e a da Lua (era 7); o rótulo segue a era', () => {
    const g = Array(42).fill(0);
    g[29] = 1;
    expect(cenaDoEstado(base({ era: 5, generators: g }), 'jogando')).toBe('cena-6');
    expect(cenaDoEstado(base({ era: 6, generators: g }), 'jogando')).toBe('cena-6');
    expect(cenaDoEstado(base({ era: 7, generators: g }), 'jogando')).toBe('cena-7');
    expect(rotuloEra(5, true)).toBe('Era 6 · Em órbita');
    expect(rotuloEra(6, true)).toBe('Era 6 · Em órbita');
    expect(rotuloEra(7, true)).toBe('Era 7 · Lua');
    expect(rotuloEra(7, true, true)).toBe('Lua');
  });
  it('peças visíveis: cada gerador das eras 6+ que você tem e o monolito com a conquista 158', () => {
    const g = Array(42).fill(0);
    g[29] = 5;
    g[30] = 2;
    g[36] = 1;
    expect(pecasVisiveis(base({ generators: g }))).toEqual(['g31', 'g37']);
    expect(pecasVisiveis(base({ generators: g, conquistas: [{ id: 158, em: '2026-10-15T12:00:00Z' }] }))).toEqual(['g31', 'g37', 'monolito']);
    expect(pecasVisiveis(base())).toEqual([]);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/montagem.test.ts idle/palco.test.ts idle/store.test.ts`
Expected: FAIL.

- [ ] **Step 2: `montagem.ts`**

Troque `export type Vagas = { quadros: number; vagas: Vaga[] };` por:

```ts
/** Uma peça da cena (eras 6+): aparece quando a pessoa tem o que ela mostra (o gerador comprado, o monolito da conquista).
 *  A imagem é `<cena>-peca-<id>.png`, os quadros da cena lado a lado; (x, y) é o canto de cima na cena. */
export type Peca = { id: string; x: number; y: number };
export type Vagas = { quadros: number; vagas: Vaga[]; pecas?: Peca[] };
```

Em `VAGAS_CONTRATADO`, troque `'cena-6': null,` por `'cena-6': null, 'cena-7': null,` e o comentário por `/** Quantas vagas de contratado cada cena tem (spec 7.3); null = a cena decide no desenho (cenas 6 e 7). */`.

Troque `montarTira` inteira por:

```ts
/** A tira pronta (quadros × 160 por 96). Sem kit (arte não carregou), só fundo, peças e frente. `pecas`: as peças que
 *  aparecem (tira com os quadros da cena), por cima do fundo e por baixo das pessoas e da frente. */
export function montarTira(
  c: { fundo: Imagem; frente: Imagem | null; vagas: Vagas }, gente: Ocupada[], kit: Kit | null,
  pecas: readonly { img: Imagem; x: number; y: number }[] = [],
): Imagem {
  const n = c.vagas.quadros;
  const tira = vazia(n * LARGURA_CENA, ALTURA_CENA);
  for (let f = 0; f < n; f++) {
    const quadro = recortar(c.fundo, f * LARGURA_CENA, 0, LARGURA_CENA, ALTURA_CENA);
    for (const p of pecas) {
      const w = p.img.w / n;
      colar(quadro, recortar(p.img, f * w, 0, w, p.img.h), p.x, p.y);
    }
    if (kit) {
      const aqui = gente
        .map((o, ordem) => ({ o, ordem, p: posicaoNoQuadro(o.vaga, f) }))
        .filter((x): x is { o: Ocupada; ordem: number; p: Posicao } => x.p !== null)
        .sort((a, b) => a.p.y + POSES[a.p.pose].h - (b.p.y + POSES[b.p.pose].h) || a.ordem - b.ordem);
      for (const { o, p } of aqui) {
        const s = sprite(kit, o.quem, p.pose, f);
        if (s) colar(quadro, s, p.x, p.y, p.espelhada);
      }
    }
    if (c.frente) colar(quadro, recortar(c.frente, f * LARGURA_CENA, 0, LARGURA_CENA, ALTURA_CENA), 0, 0);
    colar(tira, quadro, f * LARGURA_CENA, 0);
  }
  return tira;
}
```

Em `validarVagas`, antes do `return erros;` final, acrescente:

```ts
  // peças (eras 6+): id único e o canto dentro da cena (o tamanho de cada uma, ativos.test.ts confere pela imagem)
  const pecas = new Set<string>();
  for (const p of v.pecas ?? []) {
    if (typeof p.id !== 'string' || !p.id || pecas.has(p.id)) erros.push(`peça repetida ou sem id: ${p.id}`);
    pecas.add(p.id);
    if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x >= LARGURA_CENA || p.y >= ALTURA_CENA)
      erros.push(`peça ${p.id}: fora da cena`);
  }
```

- [ ] **Step 3: `palco.ts`, `ativos.ts`, `store.ts` e `main.ts`**

`palco.ts`:
- `export type NomeCena = … | 'cena-6';` → `… | 'cena-6' | 'cena-7';`
- em `CENAS`, depois de `'cena-6': { quadros: 8, atrasoMs: 150 },`: `  'cena-7': { quadros: 8, atrasoMs: 150 },`
- `Gente` e `chaveGente` por:

```ts
/** Quem aparece nas cenas: você e sua equipe (contrato mais recente primeiro); `pecas` = as peças de cena que aparecem
 *  (ids do JSON das vagas: "g31"… e "monolito"). */
export type Gente = {
  dono: Visual; equipe: Visual[]; /** vaga → visual (o convidado do PPP Podcast) */ fixos?: Record<string, Visual>;
  pecas?: readonly string[];
};
export const chaveGente = (g: Gente) => [chave(g.dono), ...g.equipe.map(chave), ...Object.entries(g.fixos ?? {}).map(([k, v]) => `${k}:${chave(v)}`),
  ...[...(g.pecas ?? [])].sort().map((p) => `peca:${p}`)].join('|');
```

- em `pedir`, troque o trecho de `const c = camadas(nome);` até `const tira = c.vagas ? … : fundo;` por:

```ts
    const c = camadas(nome);
    const quem = gente;
    const visiveis = c.pecas.filter((p) => quem.pecas?.includes(p.id));
    void (async () => {
      // o kit só é preciso quando a cena tem vagas (tira antiga, sem gente, não depende dele)
      let kitFalhou: unknown = null;
      const pedirKit = c.vagas ? (typeof kit === 'function' ? kit() : kit).catch((e) => { kitFalhou = e ?? new Error('kit'); return null; }) : null;
      const [fundo, frente, k2, pecas] = await Promise.all([
        carregarImagem(c.fundo), c.frente ? carregarImagem(c.frente) : null, pedirKit,
        Promise.all(visiveis.map(async (p) => ({ img: await carregarImagem(p.url), x: p.x, y: p.y }))),
      ]);
      const tira = c.vagas ? montarTira({ fundo, frente, vagas: c.vagas }, ocuparVagas(c.vagas, quem.dono, quem.equipe, quem.fixos), k2, pecas) : fundo;
```

(o resto do `pedir` não muda).

`ativos.ts`: `import type { Peca, Pose, Vagas } from './montagem';`; o tipo `Camadas` vira `export type Camadas = { fundo: string; frente: string | null; vagas: Vagas | null; pecas: (Peca & { url: string })[] };` e `camadas` vira:

```ts
  camadas(nome: NomeCena): Camadas {
    const fundo = cenas[`${nome}-fundo`];
    const v = vagas[nome];
    if (fundo && v) {
      // peças (eras 6+): as da lista do JSON que têm a tira (`<cena>-peca-<id>.png`, também em assets/cenas)
      const pecas = (v.pecas ?? []).flatMap((p) => {
        const url = cenas[`${nome}-peca-${p.id}`];
        return url ? [{ ...p, url }] : [];
      });
      return { fundo, frente: cenas[`${nome}-frente`] ?? null, vagas: v, pecas };
    }
    return { fundo: cenas[nome], frente: null, vagas: null, pecas: [] };
  },
```

`store.ts`: troque `cenaDoEstado` e `rotuloEra` e acrescente `pecasVisiveis`:

```ts
export function cenaDoEstado(estado: IdleState, fase: Fase): NomeCena {
  if (fase === 'antes' || !estado.started) return 'cena-0-antes';
  if (estado.era >= 7) return 'cena-7';
  if (estado.era === 6 || (estado.generators[29] ?? 0) > 0) return 'cena-6';
  return `cena-${Math.min(Math.max(estado.era, 1), 5)}` as NomeCena;
}
```

```ts
/** O nome da era: "Era 5 · Sede". Só com o gerador 30 (ainda na era 5) a cena já é a da órbita e o nome acompanha: "Era 6 ·
 *  Em órbita" (estratégias e conquistas ainda são da 5). Da era 6 em diante, o nome da era de verdade. `curto` = só o nome. */
export function rotuloEra(era: number, orbita: boolean, curto = false): string {
  const [n, nome] = orbita && era < 6 ? [6, ERAS[5]] : [era, ERAS[era - 1]];
  return curto ? nome : `Era ${n} · ${nome}`;
}

/** O monolito (conquista escondida 158) aparece na cena da Lua. */
export const CONQUISTA_MONOLITO = 158;
/** As peças de cena que aparecem (ids do JSON das vagas): "g31"… de cada gerador das eras 6+ que você tem e o monolito. */
export function pecasVisiveis(estado: IdleState): string[] {
  const out: string[] = [];
  estado.generators.forEach((n, i) => {
    if (i >= 30 && n > 0) out.push(`g${i + 1}`);
  });
  if (estado.conquistas.some((c) => c.id === CONQUISTA_MONOLITO)) out.push('monolito');
  return out;
}
```

`main.ts`: acrescente `pecasVisiveis` no import de `./store` e troque a linha do `palco.gente(…)` por:

```ts
  palco.gente({ dono: estado.avatar ?? PADRAO, equipe: estado.equipe.map((c) => c.avatar ?? PADRAO), fixos: naCena(estado), pecas: pecasVisiveis(estado) });
```

- [ ] **Step 4: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/montagem.test.ts idle/palco.test.ts idle/store.test.ts idle/tela.test.ts`
Expected: PASS. (Até a Task 7 a cena 7 não tem arte: no navegador ela não monta e avisa no console; não publique antes.)

- [ ] **Step 5: Commit**

```bash
git add games/idle/palco.ts games/idle/palco.test.ts games/idle/montagem.ts games/idle/montagem.test.ts games/idle/ativos.ts games/idle/store.ts games/idle/store.test.ts games/idle/main.ts
git commit -m "Fellas Inc.: cena da Lua e peças de cena que aparecem com o gerador (e o monolito)"
```

---

### Task 7: A arte das eras 6 e 7 (o Juan aprova antes de publicar)

**Files (fora do repo, novos, em `C:\Users\juan\Documents\PROJETOSLLM\fellas-inc-esbocos`):**
- Create: `geradores-lote6.js` (31–36), `geradores-lote7.js` (37–42), `gerais-eras67.js` (1021–1028), `conquistas-eras67.js` (140–159), `camadas-cena7.js` (cena da Lua), `pecas-cenas67.js` (peças das cenas 6 e 7 e o monolito)

**Files (no repo):**
- Create: `games/idle/assets/geradores/gerador-31.png` … `gerador-42.png` (128×32, 4 quadros)
- Create: `games/idle/assets/gerais/geral-1021.png` … `geral-1028.png` (16×16)
- Create: `games/idle/assets/conquistas/conquista-140.png` … `conquista-159.png` (16×16)
- Create: `games/idle/assets/cenas/cena-7-fundo.png`, `cena-7-frente.png` (1280×96), `cena-7-vagas.json`
- Create: `games/idle/assets/cenas/cena-6-peca-g31.png` … `g36`, `cena-7-peca-g37.png` … `g42`, `cena-7-peca-monolito.png`
- Modify: `games/idle/assets/cenas/cena-6-vagas.json` (ganha `pecas`)
- Modify: `games/idle/ativos.test.ts`

**Interfaces:**
- Consumes: o contrato de formato das peças (Task 6).
- Produces: os PNG e JSON acima; `ativos.camadas('cena-7')` com vagas e as 7 peças; `ativos.camadas('cena-6')` com as 6 peças.

**Como (o processo das entregas 2–4):** leia antes `BRIEF-SPRITES.md`, `BRIEF-CENAS.md` e `BRIEF-GENTE-CENAS.md` e os modelos `geradores-lote5.js`, `camadas-cena6.js`, `gerais.js`, `legado-conquistas.js`, `cena-util.js`, `previa-camadas.js` na pasta de esboços. Regras de lá valem aqui: paleta `P` (cor nova só se nenhuma serve, declarada no topo), contorno preto de 1 px (`telaComObjetos` + `cv.objeto(...)` + `cv.contornar()`), pixel duro sem semitransparência, 1 px de margem nos sprites, animação de 4 quadros a 20 cs nos geradores e 8 quadros a 15 cs nas cenas, loop sem emenda, mudanças de 2+ px, mascote amarelo e gato laranja escondidos na cena 7. **Não edite nenhum arquivo existente da pasta de esboços e não rode os scripts das cenas 1–6** (o `cena1-*` sobrescreve arte que o Juan editou à mão). Rode cada script com `cd C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos && node <script>.js`, olhe as prévias (`sprites/*-8x.png`, `conferencia/*-quadros.png`, as folhas) com o Read e faça pelo menos 3 rodadas de revisão por peça. Pixel art precisa de olho: o plano fixa tamanho, motivo, paleta, animação e posição; os pixels saem aqui.

- [ ] **Step 1: Os testes de formato (falham)**

Em `games/idle/ativos.test.ts`:
- `const CENAS: NomeCena[] = [..., 'cena-6'];` → acrescente `'cena-7'` no fim.
- `it('resolve os 30 geradores', …)` → `it('resolve os 42 geradores (4 quadros de 32)', () => { for (let id = 1; id <= 42; id++) { expect(naoVazia(ativos.gerador(id)), \`gerador ${id}\`).toBe(true); if (id > 30) expect(dim(\`geradores/gerador-${id}.png\`)).toEqual([128, 32]); } });`
- `it('resolve os ícones das 20 melhorias gerais', …)` → título `'resolve os ícones das 28 melhorias gerais'` e `id <= 1020` → `id <= 1028`; acrescente `if (id > 1020) expect(dim(\`gerais/geral-${id}.png\`)).toEqual([16, 16]);`.
- no `describe('arte da entrega 2 (contrato de formato)')`, acrescente:

```ts
  it('peças das cenas 6 e 7 (eras 6–7): os ids da spec, tira com os quadros da cena, dentro da cena', () => {
    const esperado: [NomeCena, string[]][] = [
      ['cena-6', ['g31', 'g32', 'g33', 'g34', 'g35', 'g36']],
      ['cena-7', ['g37', 'g38', 'g39', 'g40', 'g41', 'g42', 'monolito']],
    ];
    for (const [c, ids] of esperado) {
      const k = ativos.camadas(c);
      expect(k.pecas.map((p) => p.id).sort(), c).toEqual([...ids].sort());
      const q = RITMO[c].quadros;
      for (const p of k.pecas) {
        const [w, h] = dim(`cenas/${c}-peca-${p.id}.png`);
        expect(w % q, `${c} ${p.id}: largura múltipla dos quadros`).toBe(0);
        expect(p.x + w / q, `${c} ${p.id}`).toBeLessThanOrEqual(160);
        expect(p.y + h, `${c} ${p.id}`).toBeLessThanOrEqual(96);
      }
    }
  });
  it('a cena da Lua tem você e até 3 contratados (como a da órbita)', () => {
    const v = ativos.camadas('cena-7').vagas!;
    expect(v.vagas.filter((g) => g.papel === 'dono')).toHaveLength(1);
    expect(v.vagas.filter((g) => g.papel === 'contratado')).toHaveLength(3);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/ativos.test.ts`
Expected: FAIL (arquivos não existem).

- [ ] **Step 2: Geradores 31–42 (`geradores-lote6.js`, `geradores-lote7.js`)**

Estrutura igual à de `geradores-lote5.js`: uma função `gNN(f)` por gerador que cria `telaComObjetos(32, 32)`, desenha o quadro `f` (0–3) e termina com `return cv.contornar();`; no fim, para cada id pedido na linha de comando (ou todos), `salvarSprite(\`gerador-${id}\`, [0, 1, 2, 3].map(gNN), 20)`. Cada um é a "carta" do que se compra, com a cara da cena 6 (órbita: céu preto-azulado, branco e roxo da marca) ou da 7 (Lua: cinza do chão lunar, Terra azul ao fundo):

| id | Desenho (32×32) | Anima (4 quadros) |
|---|---|---|
| 31 | Trenzinho de 4 satélites (cubinho cinza + 2 painéis azuis) em diagonal, uma antena "de pizza" branca no canto de baixo | o trenzinho anda 2 px na diagonal; uma luz vermelha pisca |
| 32 | Cápsula branca pequena com janela redonda e um rostinho, chama curta embaixo, faixa roxa "F" | a chama muda de tamanho; a cápsula sobe e desce 1–2 px |
| 33 | Anel de estação (roda branca com raios) com a plaquinha "HOTEL" (fonte 3×5) e janelinhas amarelas | o anel gira (os raios trocam de posição) |
| 34 | Painel preto vertical com a lente vermelha redonda do HAL (miolo amarelo, brilho) | a lente pulsa (o brilho cresce e diminui) |
| 35 | Rede cheia de sucata: painel solar quebrado, parafuso, luva de astronauta | um parafuso flutua girando |
| 36 | Asteroide cinza com uma broca amarela enfiada e capacetes laranja ao lado | a broca gira e solta faísca |
| 37 | Bomba de gasolina branca com a bandeira roxa "F" e a mangueira, chão cinza com cratera | o visor troca o número; a luz do topo pisca |
| 38 | Holofote no tripé apontando pra uma bandeira fincada no "cenário" cinza, claquete no canto | o ventilador faz a bandeira balançar; o holofote pisca |
| 39 | Queijo amarelo em lua crescente, com furos de cratera e uma faca espetada | um brilho passa pelo queijo |
| 40 | Dois astronautas iguais (o clone) com picaretas e um minério azul brilhando | as picaretas sobem e descem alternadas |
| 41 | Arma de raio grande (cano listrado verde e roxo) disparando um raio numa luazinha | o raio pulsa; a luazinha encolhe 1 px |
| 42 | Domo escuro com luz roxa e um prisma pequeno na porta fazendo um arco-íris | o arco-íris cintila |

Run: `node geradores-lote6.js && node geradores-lote7.js`. Depois de aprovado por você nas prévias, copie: `for n in 31 … 42: cp png/gerador-$n-animada-tira.png <repo>/games/idle/assets/geradores/gerador-$n.png` (o arquivo do app é a tira de 4 quadros, 128×32, como os de hoje).

- [ ] **Step 3: Gerais 1021–1028 (`gerais-eras67.js`) e conquistas 140–159 (`conquistas-eras67.js`)**

Os dois copiam a infraestrutura do modelo (as funções `mapa`, a grade, `ic`, as marcas de grupo e o código que salva e monta a folha, de `gerais.js` e `legado-conquistas.js`) pro próprio arquivo (não dá pra `require` os modelos: eles rodam ao carregar). Ícones 16×16, mapa de texto com miolo 14×14, 2 a 4 cores mais o contorno, legíveis em 16 pt nos dois temas; cada script grava a folha `conferencia/gerais-eras67-folha.png` / `conferencia/conquistas-eras67-folha.png`.

| Geral | Desenho |
|---|---|
| 1021 Lançamento transmitido ao vivo | tela com um foguete subindo e o ponto vermelho de "ao vivo" |
| 1022 Foguete que pousa de ré | foguete com perninhas e chama embaixo, setinha pra baixo |
| 1023 Contagem regressiva com patrocínio | visor "10" com o logo F roxo do lado |
| 1024 Selfie do espaço | celular com a Terra azul na tela |
| 1025 Pequeno passo | pegada de bota na poeira cinza |
| 1026 Telescópio apontado pra você | telescópio no tripé |
| 1027 Trem-bala lunar | trem branco com faixa roxa |
| 1028 Lua cheia de clientes | lua cheia com uma etiqueta de preço |

| Conquista | Desenho | Marca |
|---|---|---|
| 140 Céu poluído | céu escuro com uma fila de satélites riscando, uma estrela riscada | estrela dourada (como as 1–30) |
| 141 Turista de luxo | cápsula com uma taça de champanhe | estrela |
| 142 Cinco estrelas (de verdade) | cinco estrelas em arco sobre um anel de estação | estrela |
| 143 Abra a porta, HAL | o olho vermelho do HAL e uma porta fechada | estrela |
| 144 Catador de estrelas | rede com uma estrela presa | estrela |
| 145 Missão cumprida, Harry | asteroide partido ao meio com a broca | estrela |
| 146 Abastece aí | bomba de gasolina com bandeirinha | estrela |
| 147 Foi tudo gravado | claquete com a Lua | estrela |
| 148 Queijo suíço espacial | fatia de queijo com crateras | estrela |
| 149 Sou eu mesmo? | dois capacetes iguais lado a lado | estrela |
| 150 Lua no bolso | luazinha saindo de um bolso | estrela |
| 151 Do lado de lá | meia-lua escura com o prisma e o arco-íris | estrela |
| 152 Órbita lotada | placa "P" de estacionamento cercada de satélites | a mesma das 121–125 (olhe `conquista-121.png`) |
| 153 Condomínio lunar | prédio em cima da Lua com uma chave | a das 121–125 |
| 154 Estação completa | estação com um ✓ | a das 126–130 (olhe `conquista-126.png`) |
| 155 Lua de luxo | cratera com hidromassagem (bolhas) | a das 126–130 |
| 156 Desviou de tudo | navezinha desviando de 3 pedras com a seta curva | a das 116–120 (olhe `conquista-116.png`) |
| 157 Silver tape resolve | rolo de fita prateada | a das 116–120 |
| 158 Meu Deus, está cheio de estrelas | monolito preto com estrelas em volta | a das escondidas (olhe `conquista-131.png`) |
| 159 Daisy, Daisy | margarida com o olho vermelho do HAL no miolo | a das escondidas |

Run: `node gerais-eras67.js && node conquistas-eras67.js`. Copie `png/geral-10NN.png` → `<repo>/games/idle/assets/gerais/` e `png/conquista-1NN.png` → `<repo>/games/idle/assets/conquistas/` (nomes com 3 dígitos: `conquista-140.png`).

- [ ] **Step 4: A cena da Lua (`camadas-cena7.js`)**

Como `camadas-cena6.js` (mesma estrutura, `salvarCamadas('cena-7', fundos, frentes, vagas)`, `previa('cena-7')`, `conferir('cena-7')`), 160×96, 8 quadros: chão lunar cinza com crateras nos 2/3 de baixo (perspectiva, 3–5 tons de cinza, sombras pontilhadas), céu preto estrelado, a Terra azul nascendo no horizonte à esquerda (com o pontinho das cidades acendendo), a base Fellas no fundo (domo + módulo com o F roxo) e a bandeira roxa F fincada. **Deixe livres** os lugares das peças (abaixo) e o caminho das vagas. Animação pequena: estrelas piscando, luz da base, a Terra girando (as nuvens andam 1–2 px), poeira baixa. Mascote amarelo e gato laranja escondidos (o gato pode dormir dentro de uma cratera, de capacete).

Vagas (gravidade baixa: cada um dá pulinhos de 1 a 3 px na `trilha`, fases diferentes): `voce` (dono, pose 2 ou 3, em pé perto da bandeira) e três contratados com `freela` (visuais variados da paleta, como na cena 6): `lua-posto`, `lua-cratera`, `lua-base`. Copie `png/camadas/cena-7-fundo.png`, `cena-7-frente.png` e `cena-7-vagas.json` pro repo (`games/idle/assets/cenas/`).

- [ ] **Step 5: As peças das cenas 6 e 7 e o monolito (`pecas-cenas67.js`)**

Cada peça é desenhada quadro a quadro (8 quadros, os mesmos da cena) em `telaComObjetos(w, h)` transparente com contorno, e salva como tira `png/camadas/cena-N-peca-<id>.png` (largura 8 × w). O script lê o `cena-N-vagas.json` **do repo** (`C:/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67/games/idle/assets/cenas/`), grava `pecas: [{ id, x, y }, …]` nele (mantendo `quadros` e `vagas` como estão) e monta `conferencia/cena-6-pecas-6x.png` e `conferencia/cena-7-pecas-6x.png` (o fundo do quadro 0 com todas as peças por cima, ampliado 6×) pra conferência. Posições de partida (o canto de cima e o tamanho; mova se ficar melhor, mas sem cobrir as vagas de gente nem o foguete, a Lua e a estação da cena 6):

| Cena | id | x, y | w×h | Desenho e animação |
|---|---|---|---|---|
| 6 | g31 | 100, 2 | 40×6 | fila de satélites (pontinhos com painel) cruzando o céu de cima; andam 1 px por quadro |
| 6 | g32 | 42, 26 | 12×12 | cápsula do voo de 11 minutos com a chama; a chama pisca |
| 6 | g33 | 4, 34 | 22×14 | anel do hotel em órbita embaixo da Lua; gira |
| 6 | g34 | 118, 30 | 8×8 | o olho vermelho do HAL na estação; pulsa |
| 6 | g35 | 140, 2 | 18×12 | ferro-velho preso numa rede; um parafuso gira |
| 6 | g36 | 2, 56 | 22×14 | asteroide com a equipe e a broca, acima da Terra; faísca |
| 7 | g37 | 4, 52 | 22×22 | o posto de gasolina lunar; a luz pisca |
| 7 | g38 | 28, 40 | 24×20 | o estúdio (holofote + bandeira com ventilador); a bandeira balança |
| 7 | g39 | 116, 60 | 26×16 | a fazenda de queijo (rodas de queijo na cratera); um brilho passa |
| 7 | g40 | 136, 34 | 20×22 | a mina de hélio-3 com os dois clones; as picaretas alternam |
| 7 | g41 | 90, 54 | 24×14 | o raio encolhedor apontado pro céu; o raio pulsa |
| 7 | g42 | 126, 4 | 32×14 | a base no lado escuro, no horizonte (metade na sombra, luz roxa); a luz pisca |
| 7 | monolito | 74, 30 | 6×18 | o monolito preto liso (só o contorno de luz de um lado); parado |

Run: `node camadas-cena7.js && node pecas-cenas67.js`. Copie as tiras `png/camadas/cena-6-peca-*.png` e `cena-7-peca-*.png` pro repo (`games/idle/assets/cenas/`).

- [ ] **Step 6: Rodar os testes de formato**

Run: `cd games && npx vitest run --maxWorkers=4 idle/ativos.test.ts idle/montagem.test.ts`
Expected: PASS (inclui "toda conquista … tem ícone 16x16", vermelho desde a Task 1, e "nenhum ícone sobrando").

- [ ] **Step 7: Conferência do Juan**

No relatório da task, liste os arquivos de conferência pro controlador mostrar ao Juan: `sprites/gerador-31-8x.png` … `-42-8x.png` (e os `.gif` animados), `conferencia/gerais-eras67-folha.png`, `conferencia/conquistas-eras67-folha.png`, `cena-7-montada-6x.gif` (ou o nome que `previa` gravar) e `conferencia/cena-6-pecas-6x.png`, `conferencia/cena-7-pecas-6x.png`. **O Juan aprova antes de publicar**; o que ele pedir de mudança volta pra esta task (o código não depende dos pixels). Se a arte ficar pendente, as tasks seguintes continuam com o que tem.

- [ ] **Step 8: Commit**

```bash
git add games/idle/assets/geradores games/idle/assets/gerais games/idle/assets/conquistas games/idle/assets/cenas games/idle/ativos.test.ts
git commit -m "Fellas Inc.: arte das eras 6 e 7 (geradores 31–42, gerais, conquistas 140–159, cena da Lua, peças e monolito)"
```

---
### Task 8: Loja, Legado e estratégias das eras 6 e 7 na tela (Taste Engine)

**Files:**
- Create: `games/idle/eras67.css`
- Modify: `games/idle/main.ts` (import do CSS, depois de `./caixinha.css`)
- Modify: `games/idle/tela.ts` (o laço da Loja, l. ~799; `linhaGerador`, l. ~497–535)
- Modify: `games/idle/dica.ts` (`dicaGerador`), `games/idle/dica.test.ts`, `games/idle/tela.test.ts`
- Modify: `games/dev/mockIdle.ts` (`__era` e dois botões no painel)

**Interfaces:**
- Consumes: `FRASES_GERADOR` (Task 1), `ERAS` (Task 1), ícones `gerador-31..42` (Task 7), `estrategiaPendente` (Task 2).
- Produces: a Loja até o gerador 42 com a frase; a caixinha do gerador com a frase na 1ª linha; `eras67.css` (a Task 9 acrescenta nele); `__era(6 | 7)` no `?mock`.

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67 && git merge main
```

Resolver a favor do visual da main. Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`. Expected: PASS. Leia `tela.ts`, `idle.css` e `main.ts` como estão agora (o layout pode ter mudado desde o plano): as linhas abaixo se encaixam no que existir.

- [ ] **Step 1: Testes (falham)**

Em `games/idle/tela.test.ts`, no `describe('tela da Fellas Inc.')`:

```ts
  it('Loja: com o Foguete aparecem os geradores das eras 6 e 7; a linha dos 31–42 tem a frase; vai até o 42', () => {
    const tela = criarTela(root, acoes);
    const g = Array(42).fill(1);
    g.fill(0, 31); // tem do 1 ao 31
    tela.renderizar(modelo({ estado: estado({ era: 6, generators: g, strategies: [0, 0, 0, 0, 0, -1] }) }));
    const linhas = [...root.querySelectorAll('.lista-geradores .gerador')];
    expect(linhas).toHaveLength(33); // 1 a 32 compráveis + o 33 trancado
    expect(linhas[30].querySelector('.frase')!.textContent).toBe('Internet no meio do nada, e nenhuma estrela visível no céu.');
    expect(linhas[29].querySelector('.frase')).toBeNull(); // o Foguete não tem frase
    expect(linhas[32].classList.contains('trancado')).toBe(true);
    tela.renderizar(modelo({ estado: estado({ era: 7, generators: Array(42).fill(1), strategies: [0, 0, 0, 0, 0, 0] }) }));
    expect(root.querySelectorAll('.lista-geradores .gerador')).toHaveLength(42);
  });
  it('estratégia da era 6: a folha diz "Era 6: Em órbita" e mostra as duas opções, cada uma com o Escolher', () => {
    const tela = criarTela(root, acoes);
    const g = Array(42).fill(1);
    g.fill(0, 31);
    tela.renderizar(modelo({ estado: estado({ era: 6, generators: g, strategies: [0, 0, 0, 0, -1, -1] }) }));
    const folha = root.querySelector('.modal-estrategia')!;
    expect(folha.textContent).toContain('Era 6: Em órbita');
    expect([...folha.querySelectorAll('.escolha strong')].map((e) => e.textContent)).toEqual(['Turismo espacial', 'Satélites de internet']);
    porTexto('Escolher').click();
    expect(acoes.escolher).toHaveBeenCalledWith(6, 0);
  });
  it('a faixa da cena diz a era: "Era 7 · Lua"', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ estado: estado({ era: 7, generators: Array(42).fill(1), strategies: [0, 0, 0, 0, 0, 0] }) }));
    expect(root.textContent).toContain('Era 7 · Lua');
  });
```

Em `games/idle/dica.test.ts`:

```ts
describe('frase dos geradores das eras 6+', () => {
  it('a caixinha do HAL começa com a frase; a do notebook não tem frase', () => {
    const s = comTaxa({ era: 6, generators: gens({ 30: 1, 31: 1, 32: 1, 33: 1, 34: 2 }), strategies: [0, 0, 0, 0, 0, -1] });
    expect(textos(dicaGerador(s, 34, 1e16))[0]).toBe('Desculpe, Dave. Receio que não posso cancelar sua assinatura.');
    expect(textos(dicaGerador(s, 1, 20))[0]).toMatch(/^Cada um rende/);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/tela.test.ts idle/dica.test.ts`
Expected: FAIL (a Loja para no 30; sem frase).

- [ ] **Step 2: A Loja, a frase e a caixinha**

`tela.ts`: no import de `./nomes` acrescente `FRASES_GERADOR`. No laço da Loja, `for (let gid = 1; gid <= 30; gid++) {` → `for (let gid = 1; gid <= catalogo.geradores.length; gid++) {`. Em `linhaGerador`, logo depois da linha `meio.append(el('strong', undefined, g.nome), el('span', 'sub', …));`, acrescente:

```ts
    // eras 6+: a frase do gerador (no celular, onde não tem caixinha, é o único lugar dela)
    const frase = FRASES_GERADOR[gid];
    if (frase) meio.append(el('span', 'frase', frase));
```

Em `linhaGerador`, troque também `const n = s.generators[gid - 1];` por `const n = s.generators[gid - 1] ?? 0;`.

`dica.ts`: no import de `./nomes` (crie se não houver) `import { FRASES_GERADOR } from './nomes';`. Em `dicaGerador`, troque `const linhas: LinhaDica[] = [{ texto: \`Cada um rende ${formatarTaxa(cada[gid - 1])}\` }];` por:

```ts
  const frase = FRASES_GERADOR[gid];
  const linhas: LinhaDica[] = [...(frase ? [{ texto: frase, tom: 'fraco' as const }] : []), { texto: `Cada um rende ${formatarTaxa(cada[gid - 1])}` }];
```

Crie `games/idle/eras67.css`:

```css
/* Eras 6 e 7 (entrega 1 das eras 6–12, 0077/0078). Fora do idle.css; usa os tokens dele (--i-*, --paper, var(--i-pixel)) e
   os cantos de pixel (contorno por 4 sombras sem desfoque). Hex só no vermelho do alarme (a cor do ícone dele). */

/* Loja: a frase dos geradores 31–42 embaixo do nome, como texto de apoio (cinza, menor), sem disputar com o preço */
.idle .gerador .meio .frase { display: block; color: var(--i-mudo); font-size: 13px; line-height: 1.2; }
```

`main.ts`: depois de `import './caixinha.css';`, `import './eras67.css';`.

- [ ] **Step 3: `?mock`: pular pra era 6 ou 7**

Em `games/dev/mockIdle.ts`, no tipo de `w`, acrescente `__era: (era?: number) => Promise<void>;` e, depois de `w.__vendavel = …;`:

```ts
// __era(7) leva a empresa pra era 6 ou 7 de verdade: 40 de cada gerador até o 30, 1 de cada da era até o último dela, as
// estratégias das eras de antes escolhidas (a da era fica pendente: a folha aparece) e F$ de sobra
w.__era = async (era = 6) => {
  const e = Math.min(7, Math.max(6, era));
  await dono(`update public.idle_state set
      generators = array(select case when g <= 30 then 40 when g <= $2 then 1 else 0 end from generate_series(1, 42) g),
      strategies = array(select (case when x < $3 then 0 else -1 end)::smallint from generate_series(2, 7) x), valuation = 1e22
    where user_id = $1`, [ME, e * 6, e]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
```

No painel, depois do `forEach` dos eventos de era, acrescente:

```ts
  // eras 6 e 7: pula pra lá (a estratégia da era fica pendente)
  ([['Era 6', 6], ['Era 7', 7]] as const).forEach(([nome, e]) => {
    const b = document.createElement('button');
    b.textContent = nome;
    b.style.cssText = 'padding:6px 8px;background:#3A3940;color:#fff;border:0;cursor:pointer';
    b.addEventListener('click', () => void w.__era(e));
    painel.append(b);
  });
```

- [ ] **Step 4: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/tela.test.ts idle/dica.test.ts`
Expected: PASS.

- [ ] **Step 5: Navegador e Taste Engine**

Suba o vite (`cd games && npx vite --port 5199`, em segundo plano) e abra `http://localhost:5199/games/idle/?mock` no Chrome do Juan. **Antes de tudo**, no console: `localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')` e recarregue. Rode `__era(6)`: a folha "Era 6: Em órbita" com as duas opções; escolha uma. Confira a Loja (gerador 31 com a frase, sprite animado), as melhorias do 31, as gerais 1021–1024, as de legado (ícone de duas miniaturas) e as caixinhas no mouse (gerador 31, legado "Seus N geradores da era 1 dão +X% na era 6", gerais). Rode `__era(7)`: a cena da Lua (com as peças dos geradores que tem), "Era 7 · Lua" na faixa. Confira em 1280×720, em 2000×961 e no celular (iframe de 390 px na mesma origem: a frase aparece na Loja).

Taste Engine: `ToolSearch` com `select:mcp__taste-engine__lookup_slop` e descreva cada escolha (uma consulta por escolha), por exemplo: "linha de loja de jogo em pixel: nome do item, uma linha cinza menor com uma frase de piada embaixo, preço no botão à direita"; "ícone de melhoria feito de duas miniaturas lado a lado (de uma era pra outra)"; "folha de escolha com dois cartões iguais, título, frase e um botão roxo Escolher em cada"; "rótulo 'Era 7 · Lua' na faixa de informação embaixo da cena". Corrija o que ele marcar como cara de IA **dentro do visual do jogo** (pixel, Jersey 10, cantos de pixel); ignore regra de site. Regras fixas: roxo cheio só no botão de ação; nada de rótulo com fundo dourado cheio. No relatório: cada consulta, o veredito e o que mudou.

Feche o vite de verdade (`Get-CimInstance Win32_Process | ? { $_.CommandLine -like '*vite*--port 5199*' } | % { Stop-Process -Id $_.ProcessId -Force }`) e confira que não sobrou node.

- [ ] **Step 6: Commit**

```bash
git add games/idle/eras67.css games/idle/main.ts games/idle/tela.ts games/idle/tela.test.ts games/idle/dica.ts games/idle/dica.test.ts games/dev/mockIdle.ts
git commit -m "Fellas Inc.: Loja até o gerador 42 com as frases, estratégias e legado das eras 6 e 7 na tela"
```

---

### Task 9: Lixo espacial e Houston na tela, o selo do Silver tape e os sons dos eventos (Taste Engine)

**Files:**
- Modify: `games/idle/eventoEraTela.ts`, `games/idle/eventoEraTela.test.ts`
- Modify: `games/idle/dourados.ts` (`ComBonus`, `selosBonus`), `games/idle/dourados.test.ts`
- Modify: `games/idle/dica.ts` (`dicaEventoEra`, `dicaProducao`), `games/idle/dica.test.ts`
- Modify: `games/idle/audio/efeitos.ts`, `games/idle/audio/efeitos.test.ts`
- Modify: `games/idle/tela.ts` (`Acoes.pegarEventoEra`; `criarEventoEraTela(app, …)`, l. ~1123–1135)
- Modify: `games/idle/main.ts` (`pegarEventoEra`, l. ~321; o som ao aparecer, l. ~762)
- Modify: `games/idle/eras67.css`, `games/dev/mockIdle.ts` (painel e comentário do `__eventoEra`)

**Interfaces:**
- Consumes: `NOME_EVENTO_ERA`, `JANELA_EVENTO_S`, `MAX_DESVIOS`, `DESVIO_S`, `SILVER_MULT`, `ganhoEventoAgora`, `silverAtivo` (Task 5); `idleEventoPegar(seg, gols, tipo?)` (Task 5).
- Produces: `OpcoesEventoEra.aoPegar(seg, gols, pos, tipo)`, `aoDesvio?(desvios)`, `alarmeEm?: HTMLElement`, `aoBotao?(tipo: 1 | 2 | 3 | 4 | 7)`; `PASSO_DESTROCO_MS`; efeitos `'lixo' | 'houston' | 'conserto'`; selo `{ classe: 'silver' }`.

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67 && git merge main
```

Resolver a favor do visual da main. Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`. Expected: PASS.

- [ ] **Step 1: Testes (falham)**

Em `games/idle/eventoEraTela.test.ts`, os `aoPegar` que já existem ganham o tipo como 4º argumento: l. 17 `(100, 0, { x: 0.5, y: 0.5 }, 1)`; l. 42 `(100, 3, { x: 0.5, y: 0.5 }, 5)`; l. 45 `(200, 7, { x: 0.5, y: 0.5 }, 5)`; l. 94 `(100, 0, { x: 0.2, y: 0.3 }, 3)`; l. 97 `(200, 0, { x: 0.5, y: 0.3 }, 4)`; l. 103 `(300, 2, { x: 0.2 + 3 / 10, y: 0.3 }, 5)`; l. 135 `(100, 7, { x: 0.6, y: 0.5 }, 5)`. Em `games/idle/tela.test.ts:280`, `toHaveBeenCalledWith(T / 1000, 0, expect.objectContaining({ … }))` ganha `, 3` no fim. Acrescente em `eventoEraTela.test.ts`:

```ts
describe('eventos das eras 6 e 7 na tela', () => {
  const destroco = (raiz: HTMLElement) => raiz.querySelector<HTMLButtonElement>('.evento-destroco');
  it('Lixo espacial: 3 destroços, um de cada vez (um terço da janela cada); cada clique é um desvio; no 3º manda na hora', () => {
    const raiz = document.createElement('div');
    const o = { ...opcoes(), aoDesvio: vi.fn() };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Lixo espacial · 0 de 3');
    expect(destroco(raiz)!.querySelector('svg.icone-evento')).not.toBeNull();
    destroco(raiz)!.click();
    expect(destroco(raiz)).toBeNull(); // saiu da tela: o mesmo destroço não conta duas vezes
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Lixo espacial · 1 de 3');
    t.tick(103_400); // o 2º entra
    destroco(raiz)!.click();
    t.tick(106_700); // o 3º
    destroco(raiz)!.click();
    expect(o.aoPegar).toHaveBeenCalledWith(100, 3, { x: 0.5, y: 0.5 }, 6);
    expect(o.aoDesvio).toHaveBeenCalledTimes(3);
    expect(raiz.querySelector('.evento-era-6')).toBeNull();
  });
  it('Lixo espacial: sem desviar nenhum, não manda nada; com 1, manda 1 no fim da janela', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    t.tick(103_400);
    t.tick(106_700);
    t.tick(110_000);
    expect(o.aoPegar).not.toHaveBeenCalled();
    t.mostrar({ seg: 200, tipo: 6, agoraMs: 200_000 });
    destroco(raiz)!.click();
    t.tick(210_000);
    expect(o.aoPegar).toHaveBeenCalledWith(200, 1, { x: 0.5, y: 0.5 }, 6);
  });
  it('Lixo espacial: do 1º desvio até acabar, a tela atrás trava (clique errado não compra gerador)', () => {
    const raiz = document.createElement('div');
    const t = criarEventoEraTela(raiz, opcoes());
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 100_000 });
    const caixa = () => raiz.querySelector<HTMLElement>('.evento-era-6')!;
    expect(caixa().classList.contains('travado')).toBe(false);
    destroco(raiz)!.click();
    expect(caixa().classList.contains('travado')).toBe(true);
    caixa().click();
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('Lixo espacial · 1 de 3');
  });
  it('Lixo espacial: quem volta pra aba no meio pega o destroço da vez, já andando', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 6, agoraMs: 104_000 }); // o 2º entrou há 0,67 s
    expect(destroco(raiz)!.style.getPropertyValue('--ja')).toBe('-667ms');
    destroco(raiz)!.click();
    t.tick(110_000);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 1, { x: 0.5, y: 0.5 }, 6);
  });
  it('Houston: a cena pisca (alarme) enquanto o aviso está na tela; consertar manda o tipo e apaga o alarme; passou a janela, apaga sem mandar', () => {
    const raiz = document.createElement('div');
    const palco = document.createElement('div');
    const o = { ...opcoes(), alarmeEm: palco, aoBotao: vi.fn() };
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 7, agoraMs: 100_000 });
    expect(palco.classList.contains('alarme')).toBe(true);
    expect(raiz.querySelector('.evento-balao')!.textContent).toBe('Houston, temos um problema');
    const b = raiz.querySelector<HTMLButtonElement>('.evento-era button')!;
    expect(b.textContent).toBe('Consertar com silver tape');
    b.click();
    expect(o.aoBotao).toHaveBeenCalledWith(7);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 0, { x: 0.5, y: 0.5 }, 7);
    expect(palco.classList.contains('alarme')).toBe(false);
    t.mostrar({ seg: 200, tipo: 7, agoraMs: 200_000 });
    t.tick(208_001);
    expect(palco.classList.contains('alarme')).toBe(false);
    expect(o.aoPegar).toHaveBeenCalledTimes(1);
  });
});
```

Em `games/idle/dourados.test.ts` (no fim):

```ts
describe('selo do Silver tape (0078)', () => {
  const T = Date.parse('2026-10-15T12:00:00Z');
  const em = (s: number) => new Date(T + s * 1000).toISOString();
  it('"Silver tape ×4 · 1:52", prata (nem dourado nem roxo), com caixinha; passou, some', () => {
    const [s] = selosBonus({ promo_ate: null, viral: [], silver_ate: em(112) }, T);
    expect(s).toMatchObject({ texto: 'Silver tape ×4 · 1:52', ouro: false, classe: 'silver' });
    expect(s.dica!.titulo).toBe('Houston, temos um problema');
    expect(s.dica!.linhas.map((l) => l.texto)).toEqual(['Produção ×4, por cima de todo o resto', 'Acaba em 1:52']);
    expect(selosBonus({ promo_ate: null, viral: [], silver_ate: em(-1) }, T)).toEqual([]);
  });
});
```

Em `games/idle/dica.test.ts` (com `dicaEventoEra` no import):

```ts
describe('eventos das eras 6 e 7 na caixinha', () => {
  it('Lixo: quanto vale cada destroço agora; Houston: quanto o ×4 dá a mais nos 2 min', () => {
    expect(textos(dicaEventoEra(6, 2000))).toEqual(['Cada destroço desviado: F$ 1,2 mi (até 3)', '10 min da sua produção por destroço']);
    expect(textos(dicaEventoEra(7, 2000))).toEqual(['Produção ×4 por 2 min: +F$ 720 mil a mais', 'Pegar outro com um valendo soma 2 min']);
    expect(dicaEventoEra(7, 2000).titulo).toBe('Houston, temos um problema');
  });
  it('a produção mostra o Silver tape valendo', () => {
    const s = comTaxa({ silver_ate: '2026-10-12T12:01:00.000Z' });
    expect(textos(dicaProducao(s, Date.parse(s.server_now)))).toContain('Agora: ×4 do Silver tape');
  });
});
```

Em `games/idle/audio/efeitos.test.ts`: na lista do 1º teste acrescente `'lixo', 'houston', 'conserto'`.

Run: `cd games && npx vitest run --maxWorkers=4 idle/eventoEraTela.test.ts idle/dourados.test.ts idle/dica.test.ts idle/audio/efeitos.test.ts`
Expected: FAIL.

- [ ] **Step 2: `eventoEraTela.ts`**

- Import: `import { JANELA_EVENTO_S, MAX_DESVIOS, MAX_GOLS, NOME_EVENTO_ERA, type TipoEventoEra } from './eventosEra';`
- `BOTAO` e `BALAO` passam a `Record<1 | 2 | 3 | 4 | 7, string>` com `7: 'Consertar com silver tape'` e `7: 'Houston, temos um problema'`.
- Troque o tipo `OpcoesEventoEra` por:

```ts
export type OpcoesEventoEra = {
  /** `pos` = onde a coisa estava (fração da tela; o texto sobe dali); `gols` = os gols do Jogo do Brasil ou os desvios do
   *  Lixo espacial; `tipo` = o que a página mostrou (o banco aceita o da era anterior: a era pode ter mudado no meio) */
  aoPegar(seg: number, gols: number, pos: Ponto, tipo: TipoEventoEra): void;
  /** liga a caixinha de informação (mouse/teclado) no elemento */
  dica(el: HTMLElement, chave: string, tipo: TipoEventoEra): void;
  /** onde fica (fração da tela); `i` = o pulo da bola ou o destroço */
  posicao(seg: number, i: number): Ponto;
  /** cada gol do Jogo do Brasil (o som do gol); `gols` = quantos já */
  aoGol?(gols: number): void;
  /** cada destroço desviado no Lixo espacial (o "tum"); `desvios` = quantos já */
  aoDesvio?(desvios: number): void;
  /** clicou no botão da caixa (Abrir pacote, Sair da call, Consertar…): o som da ação */
  aoBotao?(tipo: 1 | 2 | 3 | 4 | 7): void;
  /** o que pisca em vermelho enquanto o Houston está na tela (a cena) */
  alarmeEm?: HTMLElement;
};
```

- Depois de `const passoDe = …;`, acrescente:

```ts
/** Lixo espacial: cada destroço atravessa em um terço da janela, um depois do outro. */
export const PASSO_DESTROCO_MS = (JANELA_EVENTO_S[6] * 1000) / MAX_DESVIOS;
const destrocoDe = (seg: number, agoraMs: number) => Math.max(0, Math.floor((agoraMs - seg * 1000) / PASSO_DESTROCO_MS));
```

- `encerrar` inteira por:

```ts
  function encerrar(enviar: boolean) {
    if (!atual) return;
    const a = atual;
    atual = null;
    a.caixa.remove();
    encerrados.add(a.seg);
    if (a.tipo === 7) o.alarmeEm?.classList.remove('alarme');
    const conta = a.tipo === 5 || a.tipo === 6; // Jogo do Brasil e Lixo mandam quantos (sem nenhum, nada)
    if (enviar && (!conta || a.gols > 0)) o.aoPegar(a.seg, conta ? a.gols : 0, a.pos, a.tipo);
  }
```

- Depois de `pularBola()`, acrescente:

```ts
  /** "Lixo espacial · 1 de 3" */
  function contarDesvios(caixa: HTMLElement, n: number) {
    const placar = caixa.querySelector('.evento-placar');
    if (placar) placar.textContent = `${NOME_EVENTO_ERA[6]} · ${n} de ${MAX_DESVIOS}`;
  }
  /** O destroço `i` (0 a 2): entra pela esquerda numa altura sorteada e atravessa em um terço da janela (o CSS anda; o
   *  atraso negativo acerta quem voltou pra aba no meio). Cada um conta uma vez: clicou, ele sai. */
  function lancarDestroco(caixa: HTMLElement, seg: number, i: number, agoraMs: number) {
    caixa.querySelector('.evento-destroco')?.remove();
    if (i >= MAX_DESVIOS) return;
    const p = o.posicao(seg, i);
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'evento-destroco';
    b.setAttribute('aria-label', 'Desviar do destroço');
    b.style.top = `${Math.round(p.y * 100)}%`;
    b.style.setProperty('--passo', `${Math.round(PASSO_DESTROCO_MS)}ms`);
    b.style.setProperty('--ja', `-${Math.max(0, Math.round(agoraMs - seg * 1000 - i * PASSO_DESTROCO_MS))}ms`);
    b.append(icone(6));
    b.addEventListener('click', () => {
      if (!atual || atual.seg !== seg || atual.passo !== i) return;
      atual.gols++;
      atual.pos = { x: 0.5, y: p.y };
      caixa.classList.add('travado'); // do 1º desvio até acabar, a tela atrás segura os cliques
      contarDesvios(caixa, atual.gols);
      o.aoDesvio?.(atual.gols);
      b.remove();
      if (atual.gols >= MAX_DESVIOS) encerrar(true);
    });
    caixa.append(b);
    o.dica(b, `evento-${seg}-${i}`, 6);
  }
```

- Em `mostrar`: tire a guarda da Task 5 (`if (e.tipo === 6 || e.tipo === 7) return; …`); troque `const passo = e.tipo === 5 ? passoDe(e.seg, e.agoraMs) : 0;` por `const passo = e.tipo === 5 ? passoDe(e.seg, e.agoraMs) : e.tipo === 6 ? destrocoDe(e.seg, e.agoraMs) : 0;`; troque o `} else {` que vem depois do bloco do `if (e.tipo === 5) { … }` por:

```ts
      } else if (e.tipo === 6) {
        // Lixo espacial: os 3 destroços atravessam a tela um de cada vez; cada clique num é um desvio
        const placar = document.createElement('div');
        placar.className = 'evento-placar lixo-placar';
        caixa.append(placar);
        contarDesvios(caixa, 0);
        lancarDestroco(caixa, e.seg, passo, e.agoraMs);
      } else {
```

  no ramo genérico, depois de `caixa.append(icone(t), balao, b);`, acrescente `if (t === 7) o.alarmeEm?.classList.add('alarme'); // Houston: a cena pisca em vermelho`; e troque `if (e.tipo !== 4 && e.tipo !== 5) {` por `if (e.tipo !== 4 && e.tipo !== 5 && e.tipo !== 6) {`.
- Em `tick`: `encerrar(atual.tipo === 5);` → `encerrar(atual.tipo === 5 || atual.tipo === 6);` e, depois do bloco `if (atual.tipo === 5) { … }`, acrescente:

```ts
      if (atual.tipo === 6) {
        const i = destrocoDe(atual.seg, agoraMs);
        if (i > atual.passo) {
          atual.passo = i;
          lancarDestroco(atual.caixa, atual.seg, i, agoraMs);
        }
      }
```

- [ ] **Step 3: Selo, caixinhas, sons e as ligações**

`dourados.ts`: no tipo `ComBonus` acrescente `silver_ate?: string | null;`; `import { SILVER_MULT } from './eventosEra';`; em `selosBonus`, logo depois do bloco do `upg_desc_ate` (o selo "Melhorias −25%"), acrescente:

```ts
  // eras 6–7 (0078): o Silver tape do Houston (×4), prata: nem dourado nem roxo
  if (s.silver_ate && Date.parse(s.silver_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.silver_ate) - agoraMs);
    out.push({ texto: `Silver tape ×${SILVER_MULT} · ${falta}`, ouro: false, classe: 'silver', dica: { titulo: 'Houston, temos um problema', linhas: [
      { texto: `Produção ×${SILVER_MULT}, por cima de todo o resto` }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
```

`dica.ts`: no import de `./eventosEra` acrescente `MAX_DESVIOS, SILVER_MULT, silverAtivo`. Em `dicaEventoEra`, troque a última alternativa do ternário (`: [{ texto: \`Cada gol: …\` }, { texto: '5 min da sua produção por gol', tom: 'fraco' }];`) por:

```ts
    : tipo === 5 ? [{ texto: `Cada gol: ${formatarValor(g)} (até 7)` }, { texto: '5 min da sua produção por gol', tom: 'fraco' }]
    : tipo === 6 ? [{ texto: `Cada destroço desviado: ${formatarValor(g)} (até ${MAX_DESVIOS})` }, { texto: '10 min da sua produção por destroço', tom: 'fraco' }]
    : [{ texto: `Produção ×${SILVER_MULT} por 2 min: +${formatarValor(g)} a mais` }, { texto: 'Pegar outro com um valendo soma 2 min', tom: 'fraco' }];
```

Em `dicaProducao`, depois da linha da Marmita (`if (marmitaAtiva(s, agoraMs)) …`), acrescente `if (silverAtivo(s, agoraMs)) linhas.push({ texto: \`Agora: ×${SILVER_MULT} do Silver tape\`, tom: 'bom' });`.

`audio/efeitos.ts`: em `IDS_EFEITOS`, depois de `'combo',` acrescente `'lixo', 'houston', 'conserto',`. Antes de `export const RECEITAS`, acrescente:

```ts
/** Bipe quadrado de alarme (o Houston): tom fixo, corte seco. */
function sirene(ctx: BaseAudioContext, d: AudioNode, t: number, f: number, dura: number) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(0.05, t + 0.01);
  g.gain.setValueAtTime(0.05, t + dura - 0.03);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dura);
  g.connect(d);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.frequency.value = 2400;
  lp.connect(g);
  const o = ctx.createOscillator();
  o.type = 'square';
  o.frequency.setValueAtTime(f, t);
  o.connect(lp);
  o.start(t);
  o.stop(t + dura + 0.02);
}
```

e no fim de `RECEITAS` (depois de `combo`):

```ts
  // eventos das eras 6 e 7 (0078)
  lixo: (c, d, t) => { // "tum" de destroço desviado
    bumbo(c, d, t, 0, 0.2, 0.8);
    ruidoFiltrado(c, d, t, 'lowpass', 700, 200, 0.18, 0.06);
    return 0.3;
  },
  houston: (c, d, t) => { // o alarme da estação: dois tons alternando
    [81, 76, 81, 76].forEach((m, i) => sirene(c, d, t + i * 0.2, hz(m), 0.18));
    return 0.85;
  },
  conserto: (c, d, t) => { // a fita rasgando e o "pronto"
    ruidoFiltrado(c, d, t, 'highpass', 1500, 5000, 0.25, 0.07);
    sininho(c, d, t + 0.28, 84, 0.3, 0.6);
    return 0.7;
  },
```

`tela.ts`: no tipo `Acoes`, `pegarEventoEra(seg: number, gols: number, pos: { x: number; y: number }): void;` → `pegarEventoEra(seg: number, gols: number, pos: { x: number; y: number }, tipo: number): void;`. Em `criarEventoEraTela(app, { … })`: `aoPegar: (seg, gols, pos) => {` → `aoPegar: (seg, gols, pos, tipo) => {` e `a.pegarEventoEra(seg, gols, pos);` → `a.pegarEventoEra(seg, gols, pos, tipo);`; depois de `aoGol: …,` acrescente `aoDesvio: () => a.efeito('lixo'), // cada destroço desviado faz "tum"` e `alarmeEm: palco, // o Houston pisca a cena`; no `aoBotao`, depois de `else if (tipo === 3) a.efeito('call');` acrescente `else if (tipo === 7) a.efeito('conserto');`.

`main.ts`: `pegarEventoEra: (seg, gols, p) => void (async () => {` → `pegarEventoEra: (seg, gols, p, tipo) => void (async () => {` e `api.idleEventoPegar(seg, gols)` → `api.idleEventoPegar(seg, gols, tipo)`. No passo de 1 s, troque `if (tela.eventosEra.ativo() && (t === 1 || t === 4)) audio.tocar(t === 1 ? 'mae' : 'telaAzul');` por:

```ts
        // a mãe, a tela azul e o alarme do Houston soam ao aparecer; a Shopee, a call, os gols e os destroços soam na ação
        if (tela.eventosEra.ativo() && (t === 1 || t === 4 || t === 7)) audio.tocar(t === 1 ? 'mae' : t === 4 ? 'telaAzul' : 'houston');
```

`games/dev/mockIdle.ts`: o comentário do `__eventoEra` lista `6 Lixo espacial, 7 Houston`; a lista do painel vira `['Mãe', 'Shopee', 'Call', 'Tela azul', 'Jogo do Brasil', 'Lixo espacial', 'Houston']` e o comentário dela `// eventos de era (1 a 7)…`.

Acrescente no fim de `games/idle/eras67.css`:

```css
/* Lixo espacial: a camada cobre a tela (trava os cliques de trás depois do 1º desvio, como o Jogo do Brasil); o destroço
   atravessa da esquerda pra direita em um terço da janela, rodando em 4 passos */
.idle .evento-era-6 { inset: 0; transform: none; animation: none; pointer-events: none; }
.idle .evento-era-6.travado { pointer-events: auto; }
.idle .evento-placar.lixo-placar { left: 50%; top: 16px; transform: translateX(-50%); }
.idle .evento-destroco { position: absolute; left: -10%; width: 48px; height: 48px; margin-top: -24px; padding: 0; border: 0;
  background: none; pointer-events: auto; cursor: pointer;
  animation: destroco-passa var(--passo, 3333ms) linear var(--ja, 0ms) forwards; }
.idle .evento-destroco .icone-evento { display: block; width: 48px; height: 48px; image-rendering: pixelated; animation: destroco-gira 1.2s steps(4) infinite; }
.idle .evento-destroco:focus-visible { outline: 2px solid var(--i-lilas); outline-offset: 2px; }
@keyframes destroco-passa { from { left: -10%; } to { left: 110%; } }
@keyframes destroco-gira { to { transform: rotate(360deg); } }

/* Houston: a cena pisca em vermelho enquanto o alarme toca (o vermelho é o da sirene do ícone) */
.idle .palco.alarme::after { content: ''; position: absolute; inset: 0; background: #E0454B; opacity: 0; pointer-events: none;
  animation: alarme-pisca 0.5s steps(2) infinite; }
@keyframes alarme-pisca { 50% { opacity: 0.32; } }

/* Silver tape (×4): selo prata, nem dourado nem roxo */
.idle .selo-bonus.silver { color: var(--paper); background: var(--i-painel2); box-shadow: 0 0 0 2px var(--i-mudo); }

@media (prefers-reduced-motion: reduce) {
  .idle .evento-destroco .icone-evento { animation: none; } /* o destroço ainda atravessa: é o jogo */
  .idle .palco.alarme::after { animation: none; opacity: 0.22; }
}
```

- [ ] **Step 4: Rodar**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/eventoEraTela.test.ts idle/dourados.test.ts idle/dica.test.ts idle/audio/efeitos.test.ts idle/tela.test.ts idle/eventosEra.test.ts`
Expected: PASS.

- [ ] **Step 5: Navegador e Taste Engine**

Vite em segundo plano (`cd games && npx vite --port 5199`), `http://localhost:5199/games/idle/?mock`, **mutar antes** (`localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')`, recarregar). `__era(7)` e escolha a estratégia; no painel do mock: "Lixo espacial" (os 3 destroços atravessam, o placar conta, depois do 1º desvio clicar fora não compra nada, o texto "3 destroços desviados! +F$ …" sobe, a caixinha no mouse diz quanto vale cada um) e "Houston" (a cena pisca, o aviso com o botão "Consertar com silver tape", o selo prata "Silver tape ×4 · 1:59" com a caixinha, e a caixinha da produção com "Agora: ×4 do Silver tape"). Repita com um evento na tela e `__era(7)` no meio (a era muda com o evento aberto: o clique ainda vale). Confira em 1280×720, 2000×961 e no iframe de 390 px (o destroço é clicável no dedo: 48 px).

Taste Engine (`select:mcp__taste-engine__lookup_slop`), uma consulta por escolha: "a cena do jogo pisca em vermelho com um aviso de alarme e um botão de ação no meio"; "objeto que atravessa a tela da esquerda pra direita com um placar '1 de 3' no topo"; "selo cinza-prateado com multiplicador e cronômetro ao lado de outros selos coloridos"; "botão roxo cheio 'Consertar com silver tape' dentro de um balão de aviso". Corrija o que ele marcar dentro do visual do jogo; registre consultas, vereditos e mudanças no relatório. Mate o vite de verdade e confira que não sobrou node.

- [ ] **Step 6: Commit**

```bash
git add games/idle/eventoEraTela.ts games/idle/eventoEraTela.test.ts games/idle/dourados.ts games/idle/dourados.test.ts games/idle/dica.ts games/idle/dica.test.ts games/idle/audio/efeitos.ts games/idle/audio/efeitos.test.ts games/idle/tela.ts games/idle/main.ts games/idle/eras67.css games/dev/mockIdle.ts
git commit -m "Fellas Inc.: Lixo espacial e Houston na tela, selo do Silver tape, caixinhas e sons dos eventos"
```

---
### Task 10: A música das eras 6 e 7, a fanfarra de Zaratustra e a valsa

**Files:**
- Create: `games/idle/audio/sorte.ts`, `games/idle/audio/sala.ts`, `games/idle/audio/sala.test.ts`, `games/idle/audio/musicaEspaco.ts`, `games/idle/audio/musicaEspaco.test.ts`
- Modify: `games/idle/audio/falso.ts` (onda, convolver, buffer com canais)
- Modify: `games/idle/audio/instrumentos.ts`, `games/idle/audio/instrumentos.test.ts`
- Modify: `games/idle/audio/musica.ts`, `games/idle/audio/musica.test.ts`
- Modify: `games/idle/audio/sequenciador.ts`, `games/idle/audio/sequenciador.test.ts`
- Modify: `games/idle/audio/efeitos.ts`, `games/idle/audio/efeitos.test.ts`
- Modify: `games/idle/audio/eventos.ts`, `games/idle/audio/eventos.test.ts`
- Modify: `games/idle/audio/ouvir.ts`, `games/idle/main.ts` (o som da compra, l. ~240)

**Interfaces:**
- Consumes: `IdEfeito` com `'lixo' | 'houston' | 'conserto'` (Task 9).
- Produces: `aleatorio(semente)` (`sorte.ts`); `respostaSala(sr, segundos?, semente?): [Float32Array, Float32Array]`, `criarSala(ctx, destino): Sala`, `MOLHADO_ESPACO = 0.45`, `molhadoDaEra(era)` (`sala.ts`); `notasEspaco(era: 6 | 7, giro)`, `humanizar(notas, semente)`, `FORMA_ORBITA`, `FORMA_LUA`, `MELODIA_ORBITA`, `MELODIA_LUA`, `forma(era)`, `BPM_ESPACO`, `BATIDAS_ESPACO` (`musicaEspaco.ts`); `Instrumento` com `'orgao' | 'arpejo' | 'grave' | 'pad' | 'tique' | 'ar'`, `eraMusica` até 7, `batidasDoGiro(era)`; `INSTRUMENTOS` com esses e `timpano`; efeitos `'zaratustra' | 'valsa'`; `somDaCompra(tipo, id, quantas): IdEfeito`, `MELHORIA_VALSA = 331`.

Notas de composição (pro implementador e pro Juan): as duas peças são originais e "no estilo" das trilhas de ficção científica do Hans Zimmer, sem copiar tema dele: órgão sustentado, ostinato de arpejo que cresce aos poucos, pedal grave, tique-taque de relógio na Lua. Órbita: Fá maior com a quarta aumentada (Lídio: o Si natural no B♭maj7♯11 dá o "flutuando"), 66 bpm, F(9) · C/E · Dm(9) · B♭(maj7♯11) · F/A · B♭ · Gm7 · Csus → C. Lua: Ré menor, 60 bpm, Dm · B♭ · Gm/D · Asus → A · Dm · B♭ · F/C · Asus → A. O crescendo de órgão completo fica pras eras 9 e 10 (spec §6). A fanfarra é o motivo do "nascer do sol" de *Assim Falou Zaratustra* (R. Strauss, 1896) e a valsa, o começo do *Danúbio Azul* (J. Strauss II, 1867): domínio público.

- [ ] **Step 1: O falso ganha onda, convolver e buffer com canais**

Em `games/idle/audio/falso.ts`:
- em `OscFalso`, depois de `buffer: unknown = null;`: `  onda: unknown = null;` e o método `  setPeriodicWave(w: unknown) { this.onda = w; this.type = 'custom'; }`
- depois de `class FiltroFalso …`: `export class ConvolverFalso extends NoFalso { buffer: unknown = null; normalize = true; }`
- em `ContextoFalso`, troque `createBuffer(_canais: number, n: number) { … }` por:

```ts
  createBuffer(canais: number, n: number) {
    const ds = Array.from({ length: Math.max(1, canais) }, () => new Float32Array(n));
    return { length: n, numberOfChannels: canais, getChannelData: (c = 0) => ds[c] };
  }
  createConvolver() { return this.novo(new ConvolverFalso()); }
  createPeriodicWave(real: Float32Array, imag: Float32Array) { return { real, imag }; }
```

- [ ] **Step 2: Testes da sala, dos instrumentos e da partitura (falham)**

Crie `games/idle/audio/sala.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, ConvolverFalso, destinoFalso, type GanhoFalso } from './falso';
import { criarSala, MOLHADO_ESPACO, molhadoDaEra, respostaSala } from './sala';

describe('a sala (reverb de convolução das eras 6 e 7)', () => {
  it('resposta ao impulso: estéreo, do tamanho pedido, nada antes do pré-atraso, igual toda vez, cauda que cai', () => {
    const [e, d] = respostaSala(8000, 3.2);
    expect(e).toHaveLength(25600);
    expect(d).toHaveLength(25600);
    expect(Array.from(e.slice(0, 160)).every((x) => x === 0)).toBe(true); // 20 ms a 8 kHz
    expect(respostaSala(8000, 3.2)[0]).toEqual(e);
    expect(Array.from(e).every(Number.isFinite)).toBe(true);
    const energia = (a: Float32Array, de: number, ate: number) => a.slice(de, ate).reduce((s, x) => s + x * x, 0);
    expect(energia(e, 160, 2560)).toBeGreaterThan(1000 * energia(e, 23040, 25600)); // o começo e o último 0,32 s: mais de 30 dB
    expect(Array.from(e.slice(1000, 1100))).not.toEqual(Array.from(d.slice(1000, 1100))); // os dois canais diferem (espaço)
  });
  it('é um envio: a entrada vai pro reverb e o molhado vai pro destino; o molhado da era é 0 até a 5', () => {
    const c = new ContextoFalso();
    const sala = criarSala(comoContexto(c), destinoFalso(c));
    const conv = c.criados.find((n): n is ConvolverFalso => n instanceof ConvolverFalso)!;
    expect((sala.entrada as unknown as GanhoFalso).ligados).toEqual([conv]);
    expect(conv.buffer).not.toBeNull();
    const molhado = c.ganhos().find((g) => conv.ligados.includes(g))!;
    expect(molhado.ligados).toEqual([c.destination]);
    sala.molhado(0.45, 2);
    expect(molhado.gain.eventos.at(-1)).toEqual(['alvo', 0.45, 2]);
    expect([0, 1, 5, 6, 7].map(molhadoDaEra)).toEqual([0, 0, 0, MOLHADO_ESPACO, MOLHADO_ESPACO]);
    sala.desligar();
    expect((sala.entrada as unknown as GanhoFalso).ligados).toEqual([]);
  });
});
```

Em `games/idle/audio/instrumentos.test.ts`, acrescente:

```ts
describe('instrumentos das eras 6 e 7', () => {
  it('órgão: duas camadas da onda das parciais (±4 cents), a oitava de baixo, ataque lento e um vibrato leve depois do ataque', () => {
    const c = new ContextoFalso();
    INSTRUMENTOS.orgao(comoContexto(c), destinoFalso(c), 1, 60, 2, 1);
    const os = c.osciladores();
    const camadas = os.filter((o) => o.onda !== null);
    expect(camadas).toHaveLength(2);
    expect(camadas.map((o) => o.detune.eventos[0][1]).sort((a, b) => a - b)).toEqual([-4, 4]);
    expect(os.some((o) => Math.abs(o.frequency.eventos[0][1] - hz(48)) < 1e-9)).toBe(true);
    const prof = c.ganhos().find((g) => g.ligados.includes(camadas[0].detune))!;
    expect(prof.gain.eventos[0]).toEqual(['set', 0, 1]);
    expect(prof.gain.eventos[1].slice(0, 2)).toEqual(['lin', 4]); // 4 cents…
    expect(prof.gain.eventos[1][2]).toBeCloseTo(1.75, 9); // …que entram depois do ataque (0,35 s + 0,4 s)
    const env = c.ganhos().find((g) => g.ligados.includes(camadas[0]) || camadas[0].ligados.includes(g))!;
    expect(env.gain.eventos.find(([t]) => t === 'lin')![2] - 1).toBeGreaterThanOrEqual(0.3); // ataque lento
  });
  it('pad: o passa-baixa abre devagar até o fim da nota', () => {
    const c = new ContextoFalso();
    INSTRUMENTOS.pad(comoContexto(c), destinoFalso(c), 0, 60, 4, 1);
    const f = c.criados.find((n) => 'Q' in n && (n as unknown as { frequency: { eventos: unknown[] } }).frequency.eventos.length >= 2) as unknown as
      { frequency: { eventos: [string, number, number][] } };
    expect(f.frequency.eventos[0][1]).toBeLessThan(400);
    expect(f.frequency.eventos.at(-1)![1]).toBeGreaterThan(1500);
    expect(f.frequency.eventos.at(-1)![2]).toBeCloseTo(4, 6);
  });
  it('tique-taque: estalo curto (menos de 0,1 s), agudo no tique e mais grave no taque', () => {
    const tom = (altura: number) => {
      const c = new ContextoFalso();
      INSTRUMENTOS.tique(comoContexto(c), destinoFalso(c), 0, altura, 0.1, 1);
      for (const o of c.osciladores()) expect(o.fim!).toBeLessThan(0.1);
      return c.osciladores().find((o) => o.buffer === null)!.frequency.eventos[0][1];
    };
    expect(tom(1)).toBeGreaterThan(tom(0));
  });
});
```

Crie `games/idle/audio/musicaEspaco.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { batidasDoGiro, bpm, eraMusica, instrumentosDaEra, notasDoGiro, segundosDoGiro } from './musica';
import { forma, MELODIA_LUA, MELODIA_ORBITA, notasEspaco } from './musicaEspaco';

describe('músicas das eras 6 (Órbita) e 7 (Lua)', () => {
  it('16 compassos de 4 tempos; Órbita a 66 bpm e Lua a 60 (giro de 64 s); a era 9 toca a 7', () => {
    expect([batidasDoGiro(5), batidasDoGiro(6), batidasDoGiro(7)]).toEqual([128, 64, 64]);
    expect([bpm(6), bpm(7)]).toEqual([66, 60]);
    expect(segundosDoGiro(7)).toBe(64);
    expect(eraMusica(9)).toBe(7);
    expect(notasDoGiro(7, 1)).toEqual(notasEspaco(7, 1));
  });
  it('as melodias fecham 4 tempos por compasso e, nos tempos 1 e 3, são nota do acorde (o baixo ou o órgão)', () => {
    for (const [era, mel] of [[6, MELODIA_ORBITA], [7, MELODIA_LUA]] as const) {
      const f = forma(era);
      mel.forEach((frase, i) => {
        expect(frase.reduce((a, [d]) => a + d, 0)).toBe(4);
        const k = f[8 + i];
        const pcs = [k.baixo, ...k.orgao].map((n) => n % 12);
        let pos = 0;
        for (const [d, n] of frase) {
          if (n !== null && (pos === 0 || pos === 2)) expect(pcs, `era ${era}, compasso ${9 + i}`).toContain(n % 12);
          pos += d;
        }
      });
    }
  });
  it('humanizado com semente: o mesmo giro sai igual; o tempo varia no máximo 0,02 batida e a força varia; o tique-taque não sai do tempo', () => {
    for (const era of [6, 7] as const) {
      for (const giro of [0, 1]) {
        const a = notasEspaco(era, giro);
        expect(notasEspaco(era, giro)).toEqual(a);
        for (const n of a) expect(Math.abs(n.t - Math.round(n.t * 4) / 4)).toBeLessThanOrEqual(0.0201);
        expect(a.filter((n) => n.inst === 'tique').every((n) => Number.isInteger(n.t))).toBe(true);
        expect(new Set(a.map((n) => n.forca)).size).toBeGreaterThan(10);
        for (const n of a) expect(instrumentosDaEra(era)).toContain(n.inst);
      }
    }
  });
  it('a Lua marca o tempo: tique-taque em cada batida (64 por giro), agudo e grave alternando; a Órbita não tem', () => {
    const tiques = notasEspaco(7, 0).filter((n) => n.inst === 'tique');
    expect(tiques).toHaveLength(64);
    expect(tiques.slice(0, 4).map((n) => n.altura)).toEqual([1, 0, 1, 0]);
    expect(notasEspaco(6, 0).some((n) => n.inst === 'tique')).toBe(false);
  });
  it('a Órbita cresce: o giro 1 tem mais arpejo que o 0, e só ele tem a melodia (órgão acima do Lá 4)', () => {
    const arpejos = (g: number) => notasEspaco(6, g).filter((n) => n.inst === 'arpejo').length;
    expect(arpejos(1)).toBeGreaterThan(arpejos(0));
    const melodia = (g: number) => notasEspaco(6, g).filter((n) => n.inst === 'orgao' && n.altura >= 69).length;
    expect(melodia(0)).toBe(0);
    expect(melodia(1)).toBeGreaterThan(0);
  });
});
```

Em `games/idle/audio/musica.test.ts`: no import acrescente `batidasDoGiro`; em `FAIXA` acrescente `orgao: [40, 84], arpejo: [60, 96], grave: [24, 52], pad: [48, 88], tique: [0, 1]`; no teste `'as notas de cada era …'`, `for (let era = 0; era <= 5; era++)` → `era <= 7` e `expect(n.t).toBeLessThan(BATIDAS_GIRO);` → `expect(n.t).toBeLessThan(batidasDoGiro(era));`. No teste `'swing de tercina e andamento por era'`, mantenha os 6 primeiros e acrescente `expect([bpm(6), bpm(7)]).toEqual([66, 60]);`.

Run: `cd games && npx vitest run --maxWorkers=4 idle/audio`
Expected: FAIL (módulos e instrumentos não existem).

- [ ] **Step 3: `sorte.ts`, `sala.ts`, instrumentos**

Crie `games/idle/audio/sorte.ts`:

```ts
// Sorte com semente das partituras (o mesmo giro soa igual toda vez): um LCG de 32 bits.
export function aleatorio(semente: number) {
  let s = semente >>> 0 || 1;
  return () => {
    s = (Math.imul(s, 1103515245) + 12345) >>> 0;
    return s / 4294967296;
  };
}
```

Em `musica.ts`, apague a função `aleatorio` local e acrescente `import { aleatorio } from './sorte';` no topo.

Crie `games/idle/audio/sala.ts`:

```ts
// A sala da música das eras 6+ (15/10): reverb de convolução com a resposta ao impulso gerada aqui (sem arquivo), pra
// tirar o som "seco" de sintetizador. É um envio: o seco continua igual e o molhado entra por cima; nas eras 0–5 o
// molhado é 0 (o swing de sempre não muda).
import { aleatorio } from './sorte';

export const SALA_S = 3.2;
export const MOLHADO_ESPACO = 0.45;
/** Quanto de sala a música da era tem (era da música, 0 a 7). */
export const molhadoDaEra = (era: number) => (era >= 6 ? MOLHADO_ESPACO : 0);
export type Sala = { entrada: GainNode; molhado(v: number, quando: number): void; desligar(): void };

/** Resposta ao impulso de uma sala grande, em estéreo: 20 ms de pré-atraso, quatro reflexões cedo e a cauda de ruído que
 *  cai 60 dB em `segundos`, cada vez mais escura (passa-baixa de um polo que fecha com o tempo). Pura e com semente. */
export function respostaSala(sr: number, segundos = SALA_S, semente = 20261015): [Float32Array, Float32Array] {
  const n = Math.ceil(sr * segundos);
  const pre = Math.round(0.02 * sr);
  const tau = segundos / 6.91; // e^(−6,91) ≈ −60 dB
  const out: [Float32Array, Float32Array] = [new Float32Array(n), new Float32Array(n)];
  out.forEach((d, canal) => {
    const r = aleatorio(semente + canal * 7919);
    let y = 0;
    for (let i = pre; i < n; i++) {
      const t = (i - pre) / sr;
      const polo = 0.9 - 0.75 * Math.min(1, t / segundos); // 0,9 no começo (claro), 0,15 no fim (escuro)
      y += polo * (r() * 2 - 1 - y);
      d[i] = y * Math.exp(-t / tau);
    }
    for (const [ms, a] of [[11, 0.5], [17, -0.35], [23, 0.28], [31, -0.2]] as const) {
      const i = pre + Math.round(((ms + canal * 3) / 1000) * sr);
      if (i < n) d[i] += a;
    }
  });
  return out;
}

const respostas = new WeakMap<BaseAudioContext, AudioBuffer>();
function resposta(ctx: BaseAudioContext): AudioBuffer {
  let b = respostas.get(ctx);
  if (!b) {
    const [e, d] = respostaSala(ctx.sampleRate);
    b = ctx.createBuffer(2, e.length, ctx.sampleRate);
    b.getChannelData(0).set(e);
    b.getChannelData(1).set(d);
    respostas.set(ctx, b);
  }
  return b;
}

/** O envio de reverb: o que entra em `entrada` passa pela sala e sai em `destino` com o volume do molhado (começa em 0). */
export function criarSala(ctx: BaseAudioContext, destino: AudioNode): Sala {
  const entrada = ctx.createGain();
  const conv = ctx.createConvolver();
  conv.normalize = true;
  conv.buffer = resposta(ctx);
  const molhado = ctx.createGain();
  molhado.gain.value = 0;
  entrada.connect(conv);
  conv.connect(molhado);
  molhado.connect(destino);
  return {
    entrada,
    molhado(v, quando) {
      molhado.gain.setTargetAtTime(v, quando, 0.5);
    },
    desligar() {
      entrada.disconnect();
      conv.disconnect();
      molhado.disconnect();
    },
  };
}
```

Em `instrumentos.ts`, depois de `function filtro(…) { … }`, acrescente:

```ts
/** Envelope lento (órgão, pad, grave, ar): sobe em `ataque`, segura até o fim da nota e solta em `soltura`. */
function envelopeLento(ctx: BaseAudioContext, destino: AudioNode, t: number, pico: number, ataque: number, dur: number, soltura: number): GainNode {
  const fimNota = t + Math.max(ataque, dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(pico, 0.0002), t + ataque);
  g.gain.setValueAtTime(Math.max(pico, 0.0002), fimNota);
  g.gain.exponentialRampToValueAtTime(0.0001, fimNota + soltura);
  g.connect(destino);
  return g;
}

/** As parciais do órgão (índice = harmônico): 8', 4', 2 2/3', 2', 1 3/5', 1 1/3' e 1', como as barras de um órgão. */
export const PARCIAIS_ORGAO = [0, 1, 0.55, 0.32, 0.22, 0.1, 0.12, 0, 0.06] as const;
const ondas = new WeakMap<BaseAudioContext, PeriodicWave>();
function ondaOrgao(ctx: BaseAudioContext): PeriodicWave {
  let w = ondas.get(ctx);
  if (!w) {
    w = ctx.createPeriodicWave(new Float32Array(PARCIAIS_ORGAO.length), Float32Array.from(PARCIAIS_ORGAO));
    ondas.set(ctx, w);
  }
  return w;
}

/** Órgão aditivo (eras 6+): a onda das parciais somadas em duas camadas desafinadas (±4 cents, o "coro"), a oitava de
 *  baixo bem leve, ataque de 0,35 s, soltura de 1,2 s e um vibrato leve (5,2 Hz, 4 cents) que entra depois do ataque. */
const orgao: Toque = (ctx, d, t, m, dur, f) => {
  const ataque = 0.35;
  const soltura = 1.2;
  const fim = t + Math.max(ataque, dur) + soltura;
  const g = envelopeLento(ctx, d, t, 0.05 * f, ataque, dur, soltura);
  const vib = ctx.createGain(); // profundidade do vibrato, em cents
  vib.gain.setValueAtTime(0, t);
  vib.gain.linearRampToValueAtTime(4, t + ataque + 0.4);
  osc(ctx, 'sine', 5.2, vib, t, fim);
  for (const det of [-4, 4]) {
    const o = osc(ctx, 'sine', hz(m), g, t, fim);
    o.setPeriodicWave(ondaOrgao(ctx));
    o.detune.setValueAtTime(det, t);
    vib.connect(o.detune);
  }
  vib.connect(osc(ctx, 'sine', hz(m - 12), envelopeLento(ctx, d, t, 0.02 * f, ataque, dur, soltura), t, fim).detune);
};
/** Pad: dois dentes de serra desafinados (±7 cents) num passa-baixa que abre devagar ao longo da nota; ataque de 1,2 s. */
const pad: Toque = (ctx, d, t, m, dur, f) => {
  const ataque = 1.2;
  const soltura = 1.6;
  const fimNota = t + Math.max(ataque, dur);
  const g = envelopeLento(ctx, d, t, 0.03 * f, ataque, dur, soltura);
  const lp = ctx.createBiquadFilter();
  lp.type = 'lowpass';
  lp.Q.value = 0.6;
  lp.frequency.setValueAtTime(260, t);
  lp.frequency.exponentialRampToValueAtTime(1800, fimNota);
  lp.connect(g);
  for (const det of [-7, 7]) osc(ctx, 'sawtooth', hz(m), lp, t, fimNota + soltura).detune.setValueAtTime(det, t);
};
/** Arpejo: um "plim" macio (triângulo filtrado e um seno na oitava, só no ataque), cai em 0,7 s. */
const arpejo: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + Math.min(dur, 0.4) + 0.7;
  osc(ctx, 'triangle', hz(m), filtro(ctx, 'lowpass', 2200, 0.5, envelope(ctx, d, t, 0.07 * f, 0.008, fim - t)), t, fim);
  osc(ctx, 'sine', hz(m + 12), envelope(ctx, d, t, 0.015 * f, 0.005, 0.3), t, t + 0.3);
};
/** Grave longo: seno com o triângulo da oitava bem baixinho; ataque de 0,8 s e soltura de 2 s. */
const grave: Toque = (ctx, d, t, m, dur, f) => {
  const ataque = 0.8;
  const soltura = 2;
  const fim = t + Math.max(ataque, dur) + soltura;
  osc(ctx, 'sine', hz(m), envelopeLento(ctx, d, t, 0.28 * f, ataque, dur, soltura), t, fim);
  osc(ctx, 'triangle', hz(m + 12), filtro(ctx, 'lowpass', 400, 0.5, envelopeLento(ctx, d, t, 0.05 * f, ataque, dur, soltura)), t, fim);
};
/** Tique-taque de relógio: estalo seco de ruído passa-alta e um "tic" curto de seno (altura 1 = tique, agudo; 0 = taque). */
const tique: Toque = (ctx, d, t, m, _dur, f) => {
  ruidoEm(ctx, filtro(ctx, 'highpass', 5000, 0.7, envelope(ctx, d, t, 0.06 * f, 0.001, 0.025)), t, t + 0.03);
  osc(ctx, 'sine', m >= 1 ? 2400 : 1700, envelope(ctx, d, t, 0.03 * f, 0.001, 0.04), t, t + 0.04);
};
/** Ar: ruído num passa-banda de 3 kHz, bem baixinho, entra e sai devagar (a sala respirando). */
const ar: Toque = (ctx, d, t, _m, dur, f) => {
  const ataque = Math.min(2, dur / 2);
  const soltura = 2;
  const fim = t + Math.max(ataque, dur) + soltura;
  ruidoEm(ctx, filtro(ctx, 'bandpass', 3000, 0.4, envelopeLento(ctx, d, t, 0.012 * f, ataque, dur, soltura)), t, fim);
};
/** Só dos efeitos: tímpano (seno que assenta na altura, com o baque de ruído grave). */
const timpano: Toque = (ctx, d, t, m, dur, f) => {
  const fim = t + Math.max(dur, 0.3) + 0.6;
  const o = osc(ctx, 'sine', hz(m) * 1.02, envelope(ctx, d, t, 0.35 * f, 0.004, fim - t), t, fim);
  o.frequency.exponentialRampToValueAtTime(hz(m), t + 0.15);
  ruidoEm(ctx, filtro(ctx, 'lowpass', 300, 0.7, envelope(ctx, d, t, 0.08 * f, 0.002, 0.12)), t, t + 0.15);
};
```

e troque o `INSTRUMENTOS` por:

```ts
export const INSTRUMENTOS: Record<Instrumento | 'sininho' | 'moeda' | 'timpano', Toque> = {
  baixo, piano, vibrafone, metais, escovinha, conducao, bumbo, caixa, sininho, moeda,
  orgao, pad, arpejo, grave, tique, ar, timpano,
};
```

- [ ] **Step 4: A partitura (`musicaEspaco.ts` e `musica.ts`)**

Crie `games/idle/audio/musicaEspaco.ts`:

```ts
// As músicas das eras 6 (Em órbita) e 7 (Lua), no estilo das trilhas de ficção científica do Hans Zimmer (pedido do Juan,
// 15/10): órgão, ostinato de arpejo que cresce aos poucos, pedal grave, tique-taque de relógio. Harmonias e melodias são
// daqui (nada copiado de tema dele). Só dados e contas, sem áudio: 16 compassos de 4 tempos por giro; o giro 0 é mais
// vazio, o 1 cresce e traz a melodia. Tudo humanizado com semente (força e tempo variam um pouco, igual em todo giro).
import type { Instrumento, Nota } from './musica';
import { aleatorio } from './sorte';

export const COMPASSOS_ESPACO = 16;
export const BATIDAS_ESPACO = COMPASSOS_ESPACO * 4;
export const BPM_ESPACO = { 6: 66, 7: 60 } as const;
export type EraEspaco = keyof typeof BPM_ESPACO;

/** Um compasso: o baixo e o acorde do órgão (MIDI, de baixo pra cima). */
export type Compasso = { readonly baixo: number; readonly orgao: readonly number[] };
const C = (baixo: number, ...orgao: number[]): Compasso => ({ baixo, orgao });

// Órbita, em Fá maior com a quarta aumentada (Lídio), leve: F(9) · C/E · Dm(9) · B♭(maj7♯11) · F/A · B♭ · Gm7 · Csus → C
const F9 = C(41, 53, 57, 60, 67);
const C_E = C(40, 52, 55, 60, 67);
const DM9 = C(38, 50, 57, 62, 64);
const BB711 = C(34, 46, 53, 57, 64);
const F_A = C(45, 53, 57, 60, 65);
const BB = C(46, 50, 53, 58, 64);
const GM7 = C(43, 50, 53, 58, 62);
const CSUS = C(48, 53, 55, 60, 65);
const DO = C(48, 52, 55, 60, 64);
export const FORMA_ORBITA: readonly Compasso[] = [F9, F9, C_E, C_E, DM9, DM9, BB711, BB711, F_A, F_A, BB, BB, GM7, GM7, CSUS, DO];

// Lua, em Ré menor, escura: Dm · B♭ · Gm/D · Asus → A · Dm · B♭ · F/C · Asus → A
const DM = C(38, 50, 53, 57, 62);
const BBL = C(34, 46, 50, 53, 58);
const GM_D = C(38, 46, 50, 55, 58);
const ASUS = C(33, 45, 50, 52, 57);
const LA = C(33, 45, 49, 52, 57);
const F_C = C(36, 48, 53, 57, 60);
export const FORMA_LUA: readonly Compasso[] = [DM, DM, BBL, BBL, GM_D, GM_D, ASUS, LA, DM, DM, BBL, BBL, F_C, F_C, ASUS, LA];

/** As melodias do giro 1 (compassos 9 a 16): [duração em tempos, altura MIDI ou null = pausa]. */
export type Frase = readonly (readonly [number, number | null])[];
export const MELODIA_ORBITA: readonly Frase[] = [
  [[4, 72]], [[2, 69], [2, 72]], [[4, 77]], [[2, 74], [2, 76]], [[4, 74]], [[2, 70], [2, 74]], [[4, 72]], [[4, null]],
];
export const MELODIA_LUA: readonly Frase[] = [
  [[4, 69]], [[2, 65], [2, 69]], [[4, 65]], [[4, 62]], [[4, 69]], [[2, 65], [2, 60]], [[4, 62]], [[4, 61]],
];
export const forma = (era: EraEspaco) => (era === 6 ? FORMA_ORBITA : FORMA_LUA);

/** As notas do arpejo no compasso: o acorde do órgão uma oitava acima (duas, se ficaria abaixo do Dó central). */
const tonsArpejo = (k: Compasso) => k.orgao.map((n) => (n + 12 < 60 ? n + 24 : n + 12)).sort((a, b) => a - b);
const COLCHEIAS = [0, 1, 2, 3, 2, 1, 2, 3] as const;
const SEMICOLCHEIAS = [0, 1, 2, 3, 1, 2, 3, 2, 0, 1, 2, 3, 2, 3, 1, 2] as const;

/** Quantos compassos o acorde que começa em `c` fica (até o próximo diferente). */
function compassosDoAcorde(f: readonly Compasso[], c: number): number {
  let n = 1;
  while (c + n < f.length && f[c + n] === f[c]) n++;
  return n;
}

/** Humaniza com semente (o mesmo giro soa igual toda vez): força × 0,86–1 e tempo ± 0,02 batida; o tique-taque, que marca
 *  o tempo, só varia a força. */
export function humanizar(notas: readonly Nota[], semente: number): Nota[] {
  const r = aleatorio(semente);
  return notas
    .map((n) => {
      const forca = n.forca * (0.86 + 0.14 * r());
      const desvio = n.inst === 'tique' ? 0 : (r() - 0.5) * 0.04;
      return { ...n, t: Math.max(0, n.t + desvio), forca };
    })
    .sort((a, b) => a.t - b.t);
}

/** Todas as notas de um giro (0 = mais vazio, 1 = cresce e tem a melodia) da era 6 ou 7, humanizadas e ordenadas. */
export function notasEspaco(era: EraEspaco, giro: number): Nota[] {
  const f = forma(era);
  const cheio = giro === 1;
  const out: Nota[] = [];
  const nota = (inst: Instrumento, t: number, dur: number, altura: number, forca: number) => out.push({ inst, t, dur, altura, forca });
  for (let c = 0; c < COMPASSOS_ESPACO; c++) {
    const t0 = c * 4;
    const k = f[c];
    if (c === 0 || f[c - 1] !== k) {
      // o acorde: o pedal grave, o órgão segurando e (no giro 1, ou na 2ª metade da Órbita) o pad abrindo o filtro
      const dur = compassosDoAcorde(f, c) * 4;
      nota('grave', t0, dur, k.baixo, era === 7 ? 0.6 : 0.5);
      for (const n of k.orgao) nota('orgao', t0, dur, n, era === 7 ? (cheio ? 0.46 : 0.38) : cheio ? 0.5 : 0.42);
      if (cheio || (era === 6 && c >= 8)) for (const n of k.orgao.slice(1)) nota('pad', t0, dur, n + 12, 0.5);
    }
    if (c % 4 === 0) nota('ar', t0, 16, 0, 0.8);
    // o arpejo que cresce: na Órbita, semínimas → colcheias → semicolcheias; na Lua, só no fim do giro 1, bem baixo
    const tons = tonsArpejo(k);
    if (era === 6) {
      if (!cheio && c < 4) [0, 1, 2, 3].forEach((i) => nota('arpejo', t0 + i, 0.9, tons[i], 0.22));
      else if (!cheio || c < 8) COLCHEIAS.forEach((i, j) => nota('arpejo', t0 + j / 2, 0.45, tons[i], c < 8 && !cheio ? 0.26 : 0.3));
      else SEMICOLCHEIAS.forEach((i, j) => nota('arpejo', t0 + j / 4, 0.25, tons[i], 0.34));
    } else if (cheio && c >= 8) [0, 1, 2, 3].forEach((i) => nota('arpejo', t0 + i, 0.9, tons[i], 0.2));
    // a Lua marca o tempo: tique (1) e taque (0) em cada batida; no giro 1 o 1º tempo do compasso pesa mais
    if (era === 7) for (let b = 0; b < 4; b++) nota('tique', t0 + b, 0.1, b % 2 === 0 ? 1 : 0, cheio && b === 0 ? 0.62 : 0.5);
  }
  if (cheio) {
    (era === 6 ? MELODIA_ORBITA : MELODIA_LUA).forEach((frase, i) => {
      let pos = 0;
      for (const [dur, n] of frase) {
        if (n !== null) nota('orgao', (8 + i) * 4 + pos, dur, n, 0.5);
        pos += dur;
      }
    });
  }
  return humanizar(out, 20261015 + era * 10 + giro);
}
```

Em `musica.ts`:
- o comentário do topo ganha uma linha: `// As eras 6 e 7 tocam outra música (musicaEspaco.ts): órgão, arpejo e tique-taque, no estilo das trilhas do Hans Zimmer.`
- `export type Instrumento = 'baixo' | … | 'metais';` → acrescente ` | 'orgao' | 'arpejo' | 'grave' | 'pad' | 'tique' | 'ar'`
- `import { BATIDAS_ESPACO, BPM_ESPACO, notasEspaco } from './musicaEspaco';` (e o `aleatorio` de `./sorte`, Step 3)
- troque `eraMusica`, `bpm` e `segundosDoGiro` por:

```ts
export const eraMusica = (era: number) => Math.max(0, Math.min(7, Math.floor(era)));
export const bpm = (era: number): number => {
  const e = eraMusica(era);
  return e >= 6 ? BPM_ESPACO[e as 6 | 7] : BPM[e];
};
/** Quantas batidas tem o giro: 128 no swing (eras 0–5), 64 nas eras 6 e 7. */
export const batidasDoGiro = (era: number) => (eraMusica(era) >= 6 ? BATIDAS_ESPACO : BATIDAS_GIRO);
export const segundosDoGiro = (era: number) => (batidasDoGiro(era) * 60) / bpm(era);
```

- em `INSTRUMENTOS_DA_ERA`, acrescente no fim as eras 6 e 7: `  ['grave', 'orgao', 'pad', 'ar', 'arpejo'],` e `  ['grave', 'orgao', 'pad', 'ar', 'arpejo', 'tique'],`
- em `notasDoGiro`, logo depois de `const e = eraMusica(era);`: `  if (e >= 6) return notasEspaco(e as 6 | 7, giro);`

- [ ] **Step 5: O sequenciador passa pela sala**

Em `sequenciador.test.ts`, acrescente (com `ConvolverFalso` no import de `./falso` e `MOLHADO_ESPACO` de `./sala`):

```ts
describe('a sala das eras 6 e 7', () => {
  const montarSala = (era: number) => {
    const c = new ContextoFalso();
    c.state = 'running';
    const s = criarSequenciador({ ctx: () => comoContexto(c), destino: () => destinoFalso(c) }, { relogio: false });
    s.tocar(era);
    return c;
  };
  const molhados = (c: ContextoFalso) => c.ganhos().filter((g) => g.gain.eventos.some(([tipo, v]) => tipo === 'alvo' && v === MOLHADO_ESPACO));
  it('o canal vai seco pro destino e manda pra sala; na era 7 o molhado é o do espaço', () => {
    const c = montarSala(7);
    expect(c.criados.some((n) => n instanceof ConvolverFalso)).toBe(true);
    const canal = c.ganhos()[0];
    expect(canal.ligados).toContain(c.destination);
    expect(canal.ligados).toHaveLength(2);
    expect(molhados(c)).toHaveLength(1);
  });
  it('no swing (era 3) o molhado fica em 0: o som de sempre', () => {
    expect(molhados(montarSala(3))).toHaveLength(0);
  });
  it('o giro da Lua acaba em 64 batidas a 60 bpm (troca de giro em 64 s)', () => {
    const c = new ContextoFalso();
    c.state = 'running';
    const giros: [number, number][] = [];
    const s = criarSequenciador({ ctx: () => comoContexto(c), destino: () => destinoFalso(c) }, {
      relogio: false, toques: {} as Record<Instrumento, Toque>, notas: (era, giro) => { giros.push([era, giro]); return []; },
    });
    s.tocar(7);
    c.currentTime = 63.9;
    s.passo();
    expect(giros).toEqual([[7, 0]]);
    c.currentTime = 64.05;
    s.passo();
    expect(giros).toEqual([[7, 0], [7, 1]]);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/audio/sequenciador.test.ts`. Expected: FAIL. Depois, em `sequenciador.ts`:
- imports: `import { batidasDoGiro, bpm, eraMusica, notasDoGiro, type Instrumento, type Nota } from './musica';` (sai o `BATIDAS_GIRO`) e `import { criarSala, molhadoDaEra, type Sala } from './sala';`
- depois de `let canal: GainNode | null = null;`: `  let sala: Sala | null = null; // o envio de reverb da rodada (o molhado segue a era)`
- em `passo`, `const fim = inicio + BATIDAS_GIRO * spb();` → `const fim = inicio + batidasDoGiro(era) * spb();`, e depois de `era = eraNova;`: `      sala?.molhado(molhadoDaEra(era), inicio);`
- em `tocar`, troque `canal = ctx.createGain();` + `canal.connect(destino);` + `era = eraNova = eraMusica(e);` por:

```ts
      canal = ctx.createGain();
      canal.connect(destino); // o seco
      sala = criarSala(ctx, destino);
      canal.connect(sala.entrada); // e o envio pra sala
      era = eraNova = eraMusica(e);
      sala.molhado(molhadoDaEra(era), ctx.currentTime);
```

- em `parar`, depois de `canal = null;`: `      sala?.desligar();` e `      sala = null;`

- [ ] **Step 6: A fanfarra, a valsa e quando tocam**

Em `efeitos.test.ts`: na lista do 1º teste acrescente `'zaratustra', 'valsa'`; dentro do laço, troque `expect(dura, id).toBeLessThan(3);` por `expect(dura, id).toBeLessThan(id === 'zaratustra' ? 7 : 3);` e `expect(o.fim!, id).toBeLessThan(1 + 4);` por `expect(o.fim!, id).toBeLessThan(1 + (id === 'zaratustra' ? 8 : 4));`; no teste dos momentos grandes, a lista vira `['cnpj', 'combo', 'conquista', 'douradoPego', 'era', 'valsa', 'venda', 'zaratustra']`. Acrescente:

```ts
  it('Zaratustra: o pedal grave, as três notas subindo (Dó, Sol, Dó) e o acorde que vira de maior pra menor; uns 6 s', () => {
    const { c, dura } = tocar('zaratustra');
    expect(dura).toBeGreaterThan(5);
    const midi = (f: number) => Math.round(12 * Math.log2(f / 440) + 69);
    const serras = c.osciladores().filter((o) => o.type === 'sawtooth').map((o) => midi(o.frequency.eventos[0][1]));
    expect(serras).toEqual(expect.arrayContaining([60, 67, 72, 64, 63]));
  });
  it('valsa: três compassos de 3 tempos (o baixo no 1), em menos de 3 s', () => {
    const { c, dura } = tocar('valsa');
    expect(dura).toBeLessThan(3);
    expect(c.osciladores().filter((o) => o.type === 'triangle')).toHaveLength(3); // o baixo, um por compasso
  });
```

Em `eventos.test.ts`, acrescente (com `somDaCompra` no import):

```ts
  it('entrar na era 6 de verdade toca a fanfarra; as outras eras, o efeito de sempre', () => {
    const e = (era: number) => ({ user_id: 'u', era, chefes: [] }) as unknown as IdleState;
    expect(sonsDaMudanca(e(5), e(6))).toEqual(['zaratustra']);
    expect(sonsDaMudanca(e(6), e(7))).toEqual(['era']);
    expect(sonsDaMudanca(e(4), e(5))).toEqual(['era']);
  });
  it('a melhoria da Valsa do Danúbio Azul (331) toca a valsa no lugar da moeda', () => {
    expect(somDaCompra('melhoria', 331, 1)).toBe('valsa');
    expect(somDaCompra('melhoria', 332, 1)).toBe('compra');
    expect(somDaCompra('gerador', 331, 1)).toBe('compra');
    expect(somDaCompra('gerador', 5, 10)).toBe('compraMuitas');
  });
```

(`IdleState` vem de `../../shared/types`; se o arquivo já tiver um estado de exemplo, use-o.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/audio/efeitos.test.ts idle/audio/eventos.test.ts`. Expected: FAIL.

`efeitos.ts`: em `IDS_EFEITOS` acrescente `'zaratustra', 'valsa',`; `GRANDES` ganha `'zaratustra', 'valsa'`; a desestruturação vira `const { sininho, moeda, vibrafone, metais, caixa, bumbo, piano, baixo, grave, orgao, timpano } = INSTRUMENTOS;`; no fim de `RECEITAS`:

```ts
  // eras 6–7 (0078): a fanfarra de "Assim Falou Zaratustra" (R. Strauss, 1896, domínio público) ao entrar na era 6 e o
  // começo do "Danúbio Azul" (J. Strauss II, 1867, domínio público) na melhoria da valsa
  zaratustra: (c, d, t) => {
    grave(c, d, t, 36, 5, 0.9); // o Dó grave segurando tudo
    orgao(c, d, t, 48, 5, 0.6);
    metais(c, d, t + 0.6, 60, 0.9, 0.7); // Dó
    metais(c, d, t + 1.5, 67, 0.9, 0.75); // Sol
    metais(c, d, t + 2.4, 72, 0.6, 0.85); // Dó
    acorde(c, d, t + 3.0, [64, 67, 72], 0.35, 0.9); // maior…
    acorde(c, d, t + 3.4, [63, 67, 72], 1.4, 0.95); // …que vira menor
    [0, 0.3, 0.6, 0.9, 1.2, 1.5].forEach((x, i) => timpano(c, d, t + 3.4 + x, i % 2 ? 31 : 36, 0.25, 0.8));
    return 6;
  },
  valsa: (c, d, t) => {
    const b = 0.3; // um tempo
    ([[41, 0], [36, 3], [41, 6]] as const).forEach(([m, k]) => baixo(c, d, t + k * b, m, 0.25, 0.7)); // o "um"
    for (const k of [1, 2, 4, 5, 7, 8]) acorde(c, d, t + k * b, [57, 60, 65], 0.18, 0.4, piano); // o "pa-pa"
    ([[0, 65, 0.28], [1, 69, 0.28], [2, 72, 0.28], [3, 72, 0.85], [7, 84, 0.25], [8, 84, 0.3]] as const)
      .forEach(([k, m, dur]) => vibrafone(c, d, t + k * b, m, dur, 0.75));
    return 2.9;
  },
```

`eventos.ts`: em `sonsDaMudanca`, `if (depois.era > antes.era) sons.push('era');` → `if (depois.era > antes.era) sons.push(antes.era < 6 && depois.era >= 6 ? 'zaratustra' : 'era'); // a fanfarra ao sair da atmosfera (gerador 31)`. No fim do arquivo:

```ts
/** A melhoria "Valsa do Danúbio Azul na acoplagem" (gerador 33, nível 1). */
export const MELHORIA_VALSA = 331;
/** O som da compra: a valsa na melhoria dela; senão a moeda (ou a cascata, se foram várias). */
export function somDaCompra(tipo: 'gerador' | 'melhoria', id: number, quantas: number): IdEfeito {
  if (tipo === 'melhoria' && id === MELHORIA_VALSA) return 'valsa';
  return quantas > 1 ? 'compraMuitas' : 'compra';
}
```

`main.ts`: `import { quantasCompradas, somDaCompra, sonsDaMudanca } from './audio/eventos';` e, no `comprar`, `audio.tocar(n > 1 ? 'compraMuitas' : 'compra', { quantas: n });` → `audio.tocar(somDaCompra(tipo, id, n), { quantas: n });`.

- [ ] **Step 7: A página de audição**

Em `ouvir.ts`:
- `const ERAS = ['Antes do CNPJ', 'Quarto', 'Garagem', 'Escritório', 'Andar inteiro', 'Sede'];` → acrescente `'Em órbita', 'Lua'`.
- em `EFEITOS`, no fim: `['Era 6 (Zaratustra)', 'zaratustra'], ['Valsa do Danúbio', 'valsa'], ['Destroço desviado', 'lixo'], ['Houston (alarme)', 'houston'], ['Consertou com silver tape', 'conserto'],`
- imports: `import { criarSala, molhadoDaEra } from './sala';`
- em `medirTudo`, `for (let era = 0; era <= 5; era++)` → `era <= 7`, e o render das eras vira (o canal seco + o envio pra sala, como no jogo):

```ts
      const picoDb = await renderizar(segundos + 3, (ctx, s) => {
        const canal = ctx.createGain();
        canal.connect(s.musica);
        if (era >= 6) {
          const sala = criarSala(ctx, s.musica);
          sala.molhado(molhadoDaEra(era), 0);
          canal.connect(sala.entrada);
        }
        for (const n of notasDoGiro(era, giro)) INSTRUMENTOS[n.inst](ctx, canal, n.t * spb, n.altura, n.dur * spb, n.forca);
      });
```

- no laço dos efeitos, `renderizar(3.5, …)` → `renderizar(id === 'zaratustra' ? 8 : 3.5, …)`.

- [ ] **Step 8: Rodar e medir**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle/audio idle/tela.test.ts`
Expected: PASS.

Medir sem tocar nada: vite em segundo plano (`cd games && npx vite --port 5199`), abra `http://localhost:5199/games/idle/audio/ouvir.html` e rode no console `await __medir()` (render offline, não sai som): todo pico abaixo de 0 dB, inclusive "Em órbita · giro 1/2", "Lua · giro 1/2", "Era 6 (Zaratustra)" e "Valsa do Danúbio". Pico ≥ 0 dB: baixe o `pico` do instrumento culpado (órgão 0,05, pad 0,03, grave 0,28) e meça de novo. **Não aperte os botões de tocar** (quem ouve e julga é o Juan). Mate o vite e confira que não sobrou node.

- [ ] **Step 9: Commit**

```bash
git add games/idle/audio games/idle/main.ts
git commit -m "Fellas Inc.: música das eras 6 e 7 (órgão, sala, humanização), a fanfarra de Zaratustra e a valsa"
```

No relatório: "o Juan julga a música em /games/idle/audio/ouvir.html (Em órbita, Lua, Era 6, Valsa); se o sintetizador não chegar no nível que ele quer, o passo seguinte (fora desta entrega) é amostra gravada de licença livre".

---

### Task 11: Patch notes, verificação final (sem publicar)

**Files:**
- Modify: `games/idle/novidades.ts` (entrada nova no começo), `games/idle/novidades.test.ts`

**Interfaces:**
- Consumes: tudo das Tasks 1–10.
- Produces: o branch `eras-6-7` pronto pro controlador publicar com o Juan (db push 0077 + 0078, merge na main, push). **Esta task não publica.**

- [ ] **Step 0: Trazer a main**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67 && git merge main
```

Resolver a favor do visual da main. Se a main trouxe migração nova, confira que `0077`/`0078` continuam livres (`git ls-tree --name-only main supabase/migrations/ | tail`); se não, renumere as duas (arquivo, `db.ts`, `mockDb.ts`, o `ATUALIZAR_CATALOGO`, as menções no plano e nos comentários) e rode tudo de novo.

- [ ] **Step 1: Patch notes (teste primeiro)**

Em `games/idle/novidades.test.ts`: no teste `'a mais nova é a do som que não some; …'` (ou o que estiver no lugar dele depois do merge), troque o título por `'a mais nova é a das eras 6 e 7; depois, as de antes na mesma ordem'`, acrescente na 1ª linha `expect(NOVIDADES[0]).toMatchObject({ id: '2026-10-16-eras-6-7', titulo: 'Eras 6 e 7: órbita e Lua' });` e some 1 em todo índice que ele confere (`NOVIDADES[0]` → `NOVIDADES[1]`, …, `slice(8, 16)` → `slice(9, 17)`). Acrescente:

```ts
  it('a nota das eras 6 e 7 não conta as escondidas (o monolito e a Daisy) nem o segredo', () => {
    const texto = NOVIDADES.find((n) => n.id === '2026-10-16-eras-6-7')!.itens.join(' ');
    for (const nome of ['Meu Deus', 'Daisy', 'monolito', 'Monolito', 'Sillas']) expect(texto).not.toContain(nome);
  });
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/novidades.test.ts`. Expected: FAIL.

Em `games/idle/novidades.ts`, no começo de `NOVIDADES` (data do dia da publicação; se não for 16/10, troque o `id` e a `data` aqui e no teste):

```ts
  {
    id: '2026-10-16-eras-6-7',
    titulo: 'Eras 6 e 7: órbita e Lua',
    data: '2026-10-16',
    itens: [
      'Duas eras novas: Em órbita (era 6) e Lua (era 7), com 12 geradores. Do satélite que apaga as estrelas ao posto de gasolina lunar, passando por um HAL 9000 que não deixa você cancelar a assinatura.',
      'Cada gerador novo tem 8 melhorias, e cada era ganha 4 melhorias gerais.',
      'Melhorias de legado: os geradores das eras antigas ajudam a era nova. Quanto mais notebook da faculdade você tem, mais a órbita rende.',
      'Estratégias novas: Turismo espacial ou Satélites de internet na era 6; Mineração lunar ou Hotel na Lua na era 7.',
      'Eventos novos: Lixo espacial (desvie dos 3 destroços; cada um vale 10 minutos de produção) e "Houston, temos um problema" (conserte com silver tape e a produção fica ×4 por 2 minutos).',
      'Música nova nas duas eras, de órgão, e uma fanfarra conhecida na hora de sair da atmosfera.',
      'Os números agora vão até o centilhão, passando pelo googol.',
      '18 conquistas novas: uma pra cada gerador novo (ter 100), Órbita lotada, Condomínio lunar, Estação completa, Lua de luxo, Desviou de tudo e Silver tape resolve.',
    ],
  },
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/novidades.test.ts`. Expected: PASS.

- [ ] **Step 2: Commit**

```bash
git add games/idle/novidades.ts games/idle/novidades.test.ts
git commit -m "Fellas Inc.: patch notes das eras 6 e 7"
```

- [ ] **Step 3: Verificação completa**

```bash
cd /c/Users/juan/Documents/PROJETOSLLM/fellasapp-eras67
npx tsc --noEmit
npm test
cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4
```

Expected: tudo PASS (a suíte inteira dos jogos, uns 2 min). Depois, `Get-CimInstance Win32_Process -Filter "Name='node.exe'"`: nenhum node sobrando desta sessão.

- [ ] **Step 4: Conferência no navegador (mudo)**

Vite em segundo plano (`cd games && npx vite --port 5199`), `http://localhost:5199/games/idle/?mock`, mutar antes (`localStorage.setItem('fellas:idle-musica-vol', '0'); localStorage.setItem('fellas:idle-efeitos', '0')`, recarregar). Caminho: `__era(6)` → folha da estratégia → escolher → Loja do 31 ao 36 com frase e caixinha, legado e gerais, peças da órbita aparecendo conforme compra; `__era(7)` → cena da Lua com as peças, "Era 7 · Lua", estratégia da 7; os dois eventos pelo painel; o selo prata; `__rico(1e101)` e o F$ em "googol"; no Legado, as conquistas 140–157 com ícone (as 158/159 escondidas). Em 1280×720, 2000×961 e no iframe de 390 px. Mate o vite de verdade e confira que não sobrou node.

- [ ] **Step 5: Relatório pro controlador (sem publicar)**

Liste: commits do branch; os números finais (`PARAMETROS_ESPACO`, gerais, `LEGADO_P`, estratégias) e os marcos da simulação (era 6, era 7); a **inflação dos pontos de prestígio** (Decisão 2: ~150 pontos no dia 14, ~1.900 no dia 20) pra o Juan decidir; a arte pra aprovação (Task 7, Step 7) e a música pra ele ouvir (Task 10); as consultas do Taste Engine (Tasks 8 e 9). A publicação é do controlador com o Juan: conferir `supabase migration list` e os números 0077/0078 livres, o Juan roda o `db push` só dessas duas, conferir as colunas novas pela REST (`idle_state.silver_ate`, `idle_cat_upg.fonte_era`), merge na main e push, conferir o `gh run list`.
