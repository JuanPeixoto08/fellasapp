# Fellas Inc.: eventos na tela e oportunidades só na Caixinha — Implementation Plan

> Execução nativa (o Juan pediu pra fazer e mostrar no servidor de teste antes de produção). Plano enxuto: tarefas,
> interfaces e testes; o código vai direto nos arquivos com TDD.

**Goal:** Eventos tipo cookie dourado (Investidor, Promoção, Viralizou, dupla ×100) validados pelo banco, e a oportunidade só na Caixinha.

**Spec:** `docs/superpowers/specs/2026-10-11-fellas-inc-dourados-design.md`

## Global Constraints

- Migração nova `supabase/migrations/0045_fellas_inc_dourados.sql`; entra em `games/test/db.ts` e `games/dev/mockDb.ts`.
- safeupdate: todo UPDATE/DELETE com WHERE. security definer com `search_path = public`. RPC só pra `authenticated`.
- Paridade: a sorte (`idle_dourado` × `dourados.ts`) e a conta (`idle_settle` × `acumularTrechos`) idênticas.
- Testes dos jogos com `--maxWorkers=4`; matar o vite da 5199 de verdade.
- Mostrar no servidor de teste (`?mock`, `__dourado`) ANTES de merge/db push.

## Review Focus

- Clicar no último instante (12 s + atraso de rede): aceito até 15 s; depois "Esse já foi embora".
- Dois cliques rápidos no mesmo evento (ou duas abas): paga uma vez só.
- Viralizou atravessando a virada de um contrato (trecho de taxa diferente): a conta divide certo.
- Promoção + Máx: o Máx da página e o do banco batem (os dois com o custo pela metade).
- Vender a startup no meio do ×10: a empresa nova não herda o bônus.

## Tasks

1. **A sorte** — `games/idle/dourados.ts` (`douradoEm(uid, seg): TipoDourado | null`, `posicao(uid, seg)`, `TIPOS`,
   `JANELA_S = 12`) + `idle_dourado` na 0045 + `games/test/idleDourado.test.ts` (paridade em ~3000 segundos espalhados;
   frequência e proporções numa amostra de 600 mil segundos no TS).
2. **O banco** — colunas, tabela de pegos, `idle_dourado_pegar`, `idle_settle` (multiplicadores), `idle_buy`
   (Promoção), `idle_save`/`idle_json` (campos novos), `idle_prestige` (zera) + testes no PGlite (regras do pegar,
   efeitos, ×100, Promoção × meia-preço × Máx, venda, recorde).
3. **A conta na página** — `acumularTrechos`/`valuationAgora` com Viralizou; `custoMult` com Promoção (tela); tipos
   (`IdleState.promo_ate`, `viral`); api/mock `idleDouradoPegar`; erros novos.
4. **A tela** — `douradoTela.ts` (ícones, anel, texto que sobe), selo do bônus, sem o `vivo` na cena; `main.ts` (olhar
   a cada segundo, pegar, sons, textos); `__dourado` no mock; patch note "Sorte na tela".
5. **Conferência** — suítes, servidor de teste pro Juan ver os bônus, revisão final, só então merge + db push.
