# Árvore sem Tempo, com Dourados e Horta: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Três mudanças na Fellas Inc.:
- tirar o limite de 8h com o jogo fechado;
- trocar o ramo Tempo (41–45) por um ramo Dourados;
- somar o ramo 6, Horta (61–65), à direita do Gente.

**Architecture:**
- O catálogo (`nomes.ts`) muda e gera a migração 0060.
- A regra vai na 0061, que recria só as funções que mudam.
- A página repete as contas em `economia.ts`, `dourados.ts`/`convidados.ts` e `horta.ts`, com testes de paridade no PGlite.
- A copa da árvore passa a ter 6 ramos num mundo de 480×540.

**Tech Stack:** TypeScript, Vitest (jsdom e PGlite), PL/pgSQL (Supabase), Vite (`games/`).

**Spec:** `docs/superpowers/specs/2026-10-13-fellas-inc-arvore-dourados-horta-design.md`

## Global Constraints

- **Ambiente e comandos**
  - Trabalhar no worktree `../fellasapp-arvore`, branch `arvore-dourados-horta`.
  - O `games/` do worktree precisa de `npm ci` de verdade; junction não serve.
  - Testes do jogo: `cd games && npx vitest run --maxWorkers=4 <arquivos>`.
  - Antes de publicar: `npx tsc --noEmit` e `npm test` na raiz, e `npx vitest run --maxWorkers=4` em `games/`.
- **Regras do repositório**
  - Os ids dos nós nunca mudam.
  - Mudou o catálogo? Migração NOVA gerada pelo `catalogo.test.ts`. Nunca editar migração antiga.
  - Migração com DELETE/UPDATE sempre com WHERE.
  - Funções internas novas ou recriadas: `revoke all ... from public, anon, authenticated`.
  - Commits sem Co-Authored-By nem marca de IA.
- **Tipos de nó novos** (nomes exatos):
  - `dourado_freq` (maior, padrão 1);
  - `dourado_tela` (maior, padrão 12);
  - `dourado_investidor` (mult, padrão 1);
  - `dourado_duracao` (maior, padrão 1);
  - `horta_amadurece` (menor, padrão 1);
  - `horta_vida` (maior, padrão 1);
  - `horta_cruza` (maior, padrão 1);
  - `horta_mult` (maior, padrão 1);
  - `morango_chance` (maior, padrão 1).
  - O tipo `teto` sai.
- **Campos de `EfeitosArvore` e de `idle_arvore_efeitos`** (iguais nos dois): `douradoFreq`, `douradoTela`, `douradoInvestidor`, `douradoDuracao`, `hortaAmadurece`, `hortaVida`, `hortaCruza`, `hortaMult`, `morangoChance`. O campo `tetoS` sai.
- **Frequência dos eventos:** entra como peso a mais no extra do Gemaplys. A chamada é `douradoEm(uid, s, gema + freq − 1)` e `idle_dourado(u, s, gema + freq − 1)`; a assinatura não muda.
- **Desvio da spec (combinado aqui):** a 0061 lê o multiplicador da horta dentro de `idle_horta_bonus`, com `idle_arv(u,'horta_mult','max',1)`, em vez de virar parâmetro. Assim nenhum dos 6 chamadores muda.
- Texto da interface em pt-BR, no tom do jogo.

## Review Focus

1. **Quem estava fora há mais de 8h quando a 0061 entra.** A primeira abertura paga o tempo inteiro, sem estourar e sem dar NaN.
   - Teste na Task 3: `settled_at` 3 dias atrás.
2. **Nó do Hype comprado com um Viralizou ativo.** Não refaz conta pra trás nem dobra o que já foi pago.
   - Teste na Task 4: pega o Viralizou, fecha a conta, compra o 44 e fecha de novo; o valor bate com a conta à mão.
3. **Planta que já estava no chão quando o 61/62 é comprado.** Mantém os tempos dela.
   - Teste na Task 5.
4. **Agrotóxico com descontos já perto do teto.** Geradores e melhorias continuam travados em 50%.
   - Teste na Task 5.
5. **Copa no celular (390 de largura).**
   - A escala mínima vira 0,8: 480 × 0,8 = 384 cabe sem arrastar.
   - Teste da escala na Task 6, mais a conferência no navegador na Task 8.

---

### Task 1: Catálogo com Dourados e Horta (0060)

**Files:**
- Modify: `games/idle/nomes.ts:282-321` (RAMOS, TipoNo, ARVORE)
- Modify: `games/idle/catalogo.test.ts:70-82,124`
- Create (gerado): `supabase/migrations/0060_fellas_inc_catalogo_arvore.sql`
- Modify: `games/test/db.ts:34`, `games/dev/mockDb.ts:31,45`

**Interfaces:**
- Produz: `RAMOS` com 7 nomes; `TipoNo` com os 9 tipos novos e sem `teto`; nós 41–45 e 61–65 em `catalogo.arvore`.

- [ ] **Step 1: Teste que falha.** Em `catalogo.test.ts`, trocar o teste da árvore:

```ts
  it('árvore: a raiz e 6 ramos de 5 nós; custos 1 · 2 · 4 · 8 · 15 · 30; cada nó exige o anterior (o 1º, a raiz)', () => {
    const a = catalogo.arvore;
    expect(a).toHaveLength(31);
    expect(a[0]).toMatchObject({ id: 1, ramo: 0, nome: 'Virou MEI', custo: 1, requer: null, tipo: 'producao', valor: 1.05 });
    for (let r = 1; r <= 6; r++) {
      const ramo = a.filter((n) => n.ramo === r);
      expect(ramo.map((n) => n.id)).toEqual([1, 2, 3, 4, 5].map((p) => r * 10 + p));
      expect(ramo.map((n) => n.custo)).toEqual([2, 4, 8, 15, 30]);
      expect(ramo.map((n) => n.requer)).toEqual([1, r * 10 + 1, r * 10 + 2, r * 10 + 3, r * 10 + 4]);
    }
    expect(a.reduce((t, n) => t + n.custo, 0)).toBe(355);
    expect(a.filter((n) => n.ramo === 4).map((n) => [n.tipo, n.valor])).toEqual([
      ['dourado_freq', 1.5], ['dourado_tela', 24], ['dourado_investidor', 2], ['dourado_duracao', 2], ['dourado_freq', 2]]);
    expect(a.filter((n) => n.ramo === 6).map((n) => [n.tipo, n.valor])).toEqual([
      ['horta_amadurece', 0.75], ['horta_vida', 1.5], ['horta_cruza', 2], ['horta_mult', 1.5], ['morango_chance', 5]]);
    expect(a.some((n) => (n.tipo as string) === 'teto')).toBe(false);
    for (const n of a) expect(n.nome.length, n.nome).toBeLessThanOrEqual(30);
  });
```

  - Na linha 124, trocar a expectativa do 41 por:
    `"(41, 4, 1, 'Pé de coelho', 'Eventos aparecem 50% mais vezes.', 2, 'dourado_freq', 1.5, 1)"`.

- [ ] **Step 2: Rodar o teste e ver falhar.** Comando: `cd games && npx vitest run idle/catalogo.test.ts`. Esperado: FAIL (26 ≠ 31).

- [ ] **Step 3: Mudar `nomes.ts`.**

```ts
export const RAMOS: readonly string[] = ['Raiz', 'Produção', 'Recomeço', 'Oportunidades', 'Dourados', 'Gente', 'Horta'];

/** O que cada nó faz. Valor: multiplicador (producao, opp_bonus, contrato_preco, emprego_mult, dourado_freq,
 *  dourado_investidor, dourado_duracao, horta_amadurece, horta_vida, horta_cruza, horta_mult, morango_chance),
 *  segundos (segundos: quanto a oportunidade fica na cena; dourado_tela: quanto o evento fica na tela), quantidade
 *  (caixinha, opp_extra, inicio_notebooks, contrato_dias), reais (inicio_valuation), fração (por_contratado) ou 1
 *  (inicio_era1, manter_gerais: só ter o nó). */
export type TipoNo =
  | 'producao' | 'inicio_valuation' | 'inicio_notebooks' | 'manter_gerais' | 'inicio_era1'
  | 'caixinha' | 'segundos' | 'opp_extra' | 'opp_bonus'
  | 'contrato_preco' | 'por_contratado' | 'contrato_dias' | 'emprego_mult'
  | 'dourado_freq' | 'dourado_tela' | 'dourado_investidor' | 'dourado_duracao'
  | 'horta_amadurece' | 'horta_vida' | 'horta_cruza' | 'horta_mult' | 'morango_chance';
```

  - Ajustar o comentário do `ARVORE` para "a raiz e os 6 ramos de 5 nós".
  - Trocar as 5 linhas do ramo 4 e acrescentar as do ramo 6 depois do ramo 5:

```ts
  { ramo: 4, posicao: 1, tipo: 'dourado_freq', valor: 1.5, nome: 'Pé de coelho', efeito: 'Eventos aparecem 50% mais vezes.' },
  { ramo: 4, posicao: 2, tipo: 'dourado_tela', valor: 24, nome: 'Olho de lince', efeito: 'Eventos ficam 24 s na tela (no lugar de 12).' },
  { ramo: 4, posicao: 3, tipo: 'dourado_investidor', valor: 2, nome: 'Investidor anjo', efeito: 'Investidor apressado rende 40 min de produção (no lugar de 20).' },
  { ramo: 4, posicao: 4, tipo: 'dourado_duracao', valor: 2, nome: 'Hype de lançamento', efeito: 'Viralizou e Promoção duram o dobro.' },
  { ramo: 4, posicao: 5, tipo: 'dourado_freq', valor: 2, nome: 'Dia de sorte', efeito: 'Eventos aparecem 2× mais vezes.' },
  ...ramo 5 igual...
  { ramo: 6, posicao: 1, tipo: 'horta_amadurece', valor: 0.75, nome: 'Borra de café no adubo', efeito: 'Plantas novas amadurecem 25% mais rápido.' },
  { ramo: 6, posicao: 2, tipo: 'horta_vida', valor: 1.5, nome: 'Regador automático', efeito: 'Plantas novas vivem 50% a mais depois de maduras.' },
  { ramo: 6, posicao: 3, tipo: 'horta_cruza', valor: 2, nome: 'Abelha influencer', efeito: 'Cruzamento da Horta 2× mais fácil.' },
  { ramo: 6, posicao: 4, tipo: 'horta_mult', valor: 1.5, nome: 'Agrotóxico liberado', efeito: 'Bônus das plantas ×1,5 (descontos seguem até 50%).' },
  { ramo: 6, posicao: 5, tipo: 'morango_chance', valor: 5, nome: 'Morango do amor', efeito: 'Morango com Pescoço brota 5× mais.' },
```

  - O `tsc` vai acusar `'teto'` em `economia.ts:54`. Isso se resolve na Task 2; aqui basta o vitest do catálogo.

- [ ] **Step 4: Gerar a migração.** Comando: `cd games && ATUALIZAR_CATALOGO=0060_fellas_inc_catalogo_arvore.sql npx vitest run idle/catalogo.test.ts`.
  - Esperado: cria `supabase/migrations/0060_fellas_inc_catalogo_arvore.sql` e o teste passa.
  - Conferir com `grep -c "teto" ../supabase/migrations/0060*.sql`: deve dar 0.

- [ ] **Step 5: Registrar a 0060.**
  - `games/test/db.ts`: acrescentar `'0060_fellas_inc_catalogo_arvore.sql',` depois da 0055.
  - `games/dev/mockDb.ts`: `import m60 from '../../supabase/migrations/0060_fellas_inc_catalogo_arvore.sql?raw';` e `m60` no fim da lista do `for`.

- [ ] **Step 6: Commit.** `git add -A games/idle/nomes.ts games/idle/catalogo.test.ts supabase/migrations/0060_fellas_inc_catalogo_arvore.sql games/test/db.ts games/dev/mockDb.ts && git commit -m "Fellas Inc.: catálogo da árvore com Dourados e Horta (0060)"`

### Task 2: Contas da página (economia.ts) sem teto e com os efeitos novos

**Files:**
- Modify: `games/idle/economia.ts:20-60,201-255`
- Modify: `games/idle/store.ts:18-27`, `games/idle/simulacao.ts:41-43`
- Test: `games/idle/economia.test.ts:5,70-100,140-170`

**Interfaces:**
- Consome: os tipos da Task 1.
- Produz:
  - `EfeitosArvore` com os 9 campos novos, sem `tetoS`.
  - `produzido(r, a, b, boostAteMs, virais = [], viralMs = VIRAL_MS)`.
  - `acumular(v, r, desdeMs, ateMs, boostAteMs, virais = [], viralMs = VIRAL_MS)`.
  - `acumularTrechos(v, trechos, desdeMs, ateMs, boostAteMs, virais = [], viralMs = VIRAL_MS)`.
  - `VIRAL_MS` continua sendo 60 000. A duração com a árvore é `VIRAL_MS * ef.douradoDuracao`.

- [ ] **Step 1: Testes que falham.** Em `economia.test.ts`:
  - Tirar `TETO_SEGUNDOS` do import.
  - Nas chamadas com `TETO_SEGUNDOS` como 6º argumento, tirar esse argumento (as `virais` sobem uma posição).
  - Trocar os testes do teto:

```ts
  it('soma taxa × tempo sem limite: 3 dias fechado rendem os 3 dias', () => {
    expect(acumular(0, 1, 0, 3 * 86400_000, null)).toBeCloseTo(3 * 86400, 6);
  });
  it('Viralizou com duração dobrada (Hype): ×10 por 120 s', () => {
    expect(acumular(0, 1, 0, 200_000, null, [150_000], 120_000)).toBeCloseTo(200 + 9 * 120, 9);
  });
```

  - No teste "vencimento depois do teto de 8h não conta", trocar por um que diz que conta inteiro:
    `acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 9 * 3600_000, r: 2 }], 0, 10 * 3600_000, null)` ≈ `9 * 3600 + 2 * 3600`.
  - No "sem nó: o jogo de sempre", trocar `tetoS: 8 * 3600` por:
    `douradoFreq: 1, douradoTela: 12, douradoInvestidor: 1, douradoDuracao: 1, hortaAmadurece: 1, hortaVida: 1, hortaCruza: 1, hortaMult: 1, morangoChance: 1`.
  - No "nós do mesmo tipo", trocar `tetoS: 24 * 3600` por `douradoFreq: 1.5`, e acrescentar:

```ts
    expect(efeitosArvore(cat, [1, 41, 42, 43, 44, 45])).toMatchObject({ douradoFreq: 2, douradoTela: 24, douradoInvestidor: 2, douradoDuracao: 2 });
    expect(efeitosArvore(cat, [1, 61, 62, 63, 64, 65])).toMatchObject({ hortaAmadurece: 0.75, hortaVida: 1.5, hortaCruza: 2, hortaMult: 1.5, morangoChance: 5 });
```

- [ ] **Step 2: Rodar e ver falhar.** Comando: `cd games && npx vitest run idle/economia.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar em `economia.ts`.**
  - Apagar `TETO_SEGUNDOS`.
  - No tipo, trocar `tetoS: number;` por `douradoFreq: number; douradoTela: number; douradoInvestidor: number; douradoDuracao: number; hortaAmadurece: number; hortaVida: number; hortaCruza: number; hortaMult: number; morangoChance: number;`.
  - Em `efeitosArvore`, sai o `tetoS: ...` e entra:

```ts
    douradoFreq: max('dourado_freq', 1),
    douradoTela: max('dourado_tela', JANELA_DOURADO_S),
    douradoInvestidor: mult('dourado_investidor'),
    douradoDuracao: max('dourado_duracao', 1),
    hortaAmadurece: Math.min(1, ...valores('horta_amadurece')),
    hortaVida: max('horta_vida', 1),
    hortaCruza: max('horta_cruza', 1),
    hortaMult: max('horta_mult', 1),
    morangoChance: max('morango_chance', 1),
```

  - `JANELA_DOURADO_S = 12` é uma constante local de `economia.ts`, com comentário "igual a dourados.ts JANELA_S", pra evitar import circular com `dourados.ts`.
  - Atualizar o comentário do tipo: "produção, investidor e bônus das oportunidades multiplicam; +por dia soma; preço do contrato e amadurecer ficam o menor; o resto fica o maior".
  - `produzido` ganha `viralMs = VIRAL_MS` e troca `VIRAL_MS` por `viralMs` no corpo.
  - `acumular` e `acumularTrechos`:

```ts
/** Valuation depois de render de `desdeMs` até `ateMs`, sem limite (desde 13/10 o jogo fechado rende tudo); ×5 dentro
 *  do bônus que vai até `boostAteMs`; ×10 por Viralizou ativo (`virais` = os fins, cada um dura `viralMs`). */
export function acumular(
  v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: number | null, virais: readonly number[] = [], viralMs = VIRAL_MS,
): number {
  return v + produzido(r, desdeMs, Math.max(ateMs, desdeMs), boostAteMs, virais, viralMs);
}

/** Como `acumular`, mas a taxa troca no meio (um contrato vencendo): `trechos` = [{ desdeMs, r }] em ordem, o primeiro
 *  começando em `desdeMs`. Igual a idle_settle: ×5 e ×10 em cada trecho. */
export function acumularTrechos(
  v: number, trechos: { desdeMs: number; r: number }[], desdeMs: number, ateMs: number, boostAteMs: number | null,
  virais: readonly number[] = [], viralMs = VIRAL_MS,
): number {
  for (let i = 0; i < trechos.length; i++) {
    const a = Math.max(trechos[i].desdeMs, desdeMs);
    const b = Math.min(i + 1 < trechos.length ? trechos[i + 1].desdeMs : ateMs, ateMs);
    v += produzido(trechos[i].r, a, b, boostAteMs, virais, viralMs);
  }
  return v;
}
```

  - `store.ts valuationAgora`:

```ts
  const ef = efeitos(a.estado);
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost, virais, VIRAL_MS * ef.douradoDuracao);
```

    Importar `VIRAL_MS` de `./economia` e mudar o comentário de `efeitos` para "(caixinha, eventos, horta…)".
  - `simulacao.ts:42`: `v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null);`

- [ ] **Step 4: Rodar.**
  - `cd games && npx vitest run idle/economia.test.ts idle/simulacao.test.ts idle/store.test.ts`: PASS.
  - `npx tsc --noEmit -p .`: os erros que sobrarem vêm só de testes do banco (`test/idleParidade.test.ts`), que são da Task 3.

- [ ] **Step 5: Commit.** `git commit -am "Fellas Inc.: a página rende sem teto e conhece os efeitos de Dourados e Horta"`

### Task 3: Banco sem teto e efeitos da árvore (0061, parte 1)

**Files:**
- Create: `supabase/migrations/0061_fellas_inc_arvore_dourados_horta.sql`
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (registrar a 0061)
- Test:
  - `games/test/idle.test.ts:70-74`;
  - `games/test/idleArvore.test.ts:158-215`;
  - `games/test/idleParidade.test.ts:105-230,294`.

**Interfaces:**
- Consome: a 0060 e `acumular`/`acumularTrechos` da Task 2.
- Produz:
  - `idle_settle` sem teto e com o Viralizou durando `60 · idle_arv(u,'dourado_duracao','max',1)` s.
  - `idle_arvore_efeitos` com os campos de `EfeitosArvore`.

- [ ] **Step 1: Testes que falham.**
  - `idle.test.ts`, teste 'teto de 8 horas', vira:

```ts
  it('sem teto: 3 dias fechado rendem os 3 dias', async () => {
    // (mesma preparação do teste antigo, com settled_at 3 dias atrás no lugar de 10h)
    expect((await t.rpc<Estado>('idle_open')).valuation).toBeCloseTo(10 + 0.51 * 3 * 86400, -1);
  });
```

    Copiar a preparação das linhas 70–72; só o intervalo muda pra `interval '3 days'`.
  - `idleArvore.test.ts`: apagar os testes 'Tempo: ... 12h' e 'comprar o Carnaval ...' (158–215) e pôr:

```ts
  it('o ramo Tempo saiu: o nó 41 é o Pé de coelho e fechar a conta não para em 8h nem em 48h', async () => {
    await abrir(A);
    await ter(A, [1, 41]);
    expect((await q<{ tipo: string }>('select tipo from public.idle_cat_no where id = 41'))[0].tipo).toBe('dourado_freq');
    await q(`update public.idle_state set settled_at = now() - interval '60 hours', valuation = 0 where user_id = $1`, [A]);
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation / (r * 60 * 3600)).toBeCloseTo(1, 3);
  });
```

  - `idleParidade.test.ts`:
    - Nos testes 'fechar a conta (com teto e bônus)' e 'atravessando vencimentos (... teto de 8h)', tirar o argumento `tetoS`/`TETO_SEGUNDOS` das chamadas de `acumular`/`acumularTrechos` e renomear tirando "teto".
    - O teste da linha 202 vira 'fechar a conta com a árvore: sem teto, vencimento no meio e bônus', com `nos` em `[[], [1, 41], [1, 41, 42, 43, 44, 45], [1, 11, 41, 44, 54, 61, 64]]`. Sem `tetoS`; quando `nos` inclui o 44, passa `viralMs = 120_000`.
    - No teste da linha 174 (paridade de `idle_arvore_efeitos`), a lista de árvores inclui `[1, 41, 42, 43, 44, 45]` e `[1, 61, 62, 63, 64, 65]`.

- [ ] **Step 2: Rodar e ver falhar.** Comando: `cd games && npx vitest run --maxWorkers=4 test/idle.test.ts test/idleArvore.test.ts test/idleParidade.test.ts`. Esperado: FAIL (para em 8h; `tetoS` sobrando no JSON).

- [ ] **Step 3: Escrever a 0061, parte 1.** Cabeçalho e as duas funções.
  - `idle_settle` é a da 0051 (linhas 354–407) com duas mudanças:
    - `v_fim := ts;`
    - os dois `interval '60 seconds'` passam a ser `v_dur`, com `v_dur interval := make_interval(secs => 60 * public.idle_arv(s.user_id, 'dourado_duracao', 'max', 1));` no `declare`.

```sql
-- Fellas Inc.: a árvore sem o ramo Tempo (13/10). O jogo fechado rende sem limite; o ramo 4 virou Dourados e o 6 é a
-- Horta (catálogo na 0060). Aqui só as funções que mudam, a partir das versões da 0051/0052.

-- tudo que a árvore de alguém faz (igual a economia.ts efeitosArvore; teste de paridade). Sem tetoS desde a 0061.
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
$$;
revoke all on function public.idle_arvore_efeitos(uuid) from public, anon, authenticated;
```

  - Depois de `idle_settle`: `revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;`. Conferir na 0034 se ela já tinha esse revoke; se não tinha, manter igual à de lá.
  - Registrar `0061_fellas_inc_arvore_dourados_horta.sql` em `test/db.ts` e `m61` em `dev/mockDb.ts`.

- [ ] **Step 4: Rodar.** Os mesmos três arquivos da Step 2: PASS.

- [ ] **Step 5: Commit.** `git add -A supabase/migrations/0061_fellas_inc_arvore_dourados_horta.sql games/test games/dev && git commit -m "Fellas Inc.: o banco rende sem teto e diz os efeitos novos da árvore (0061)"`

### Task 4: Ramo Dourados (banco e página)

**Files:**
- Modify: `supabase/migrations/0061_fellas_inc_arvore_dourados_horta.sql` (acrescentar `idle_dourado_pegar`)
- Modify:
  - `games/idle/dourados.ts` (`janelaS`, `textoPegou`);
  - `games/idle/convidados.ts:133-138,162` (`eventoEm`, texto do Gemaplys);
  - `games/idle/main.ts:204` (ganho do Investidor).
- Test: `games/test/idleDourado.test.ts`, `games/idle/dourados.test.ts`, `games/idle/convidados.test.ts`

**Interfaces:**
- Consome: `efeitosDe(catalogo, estado)` da Task 2, com `douradoFreq`, `douradoTela`, `douradoInvestidor` e `douradoDuracao`.
- Produz:
  - `janelaS(gema = 0, base = JANELA_S)`.
  - `textoPegou(tipo, { ganho, viral, duracao = 1 })`, em que `duracao` multiplica os 30 s e o 1 min.
  - `eventoEm(s, seg)` passa a usar a árvore do estado (`s.bonus?.arvore`), então `ComCadeiras` ganha `bonus?: { arvore: number[] }`.

- [ ] **Step 1: Testes que falham.**
  - **`idleDourado.test.ts`**, dentro de 'pegar um evento'. Acrescentar, usando `ter` igual ao de `idleArvore.test.ts`:
    `const ter = (nos: number[]) => q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [A, nos]);`

```ts
  it('Investidor anjo: 40 minutos da produção', async () => {
    await ter([1, 41, 42, 43]);
    const seg = await agoraSeg();
    await evento(seg, 0);
    const r = await taxa();
    const antes = (await linha()).valuation;
    expect((await pegar(seg)).valuation - antes).toBeCloseTo(r * 2400, 3);
  });
  it('Olho de lince: pega aos 20 s; sem ele, aos 20 s já foi', async () => {
    const seg = await agoraSeg();
    await evento(seg - 20, 0);
    await expect(pegar(seg - 20)).rejects.toThrow(/idle_dourado_gone/);
    await ter([1, 41, 42]);
    await expect(pegar(seg - 20)).resolves.toBeTruthy();
  });
  it('Hype: Promoção de 60 s e Viralizou que acaba em 120 s', async () => {
    await ter([1, 41, 42, 43, 44]);
    const seg = await agoraSeg();
    await evento(seg, 1);
    const p = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(p.promo_ate!) - agora).toBe(60_000);
    await evento(seg + 1, 2);
    const v = await pegar(seg + 1);
    expect(Date.parse(v.viral.at(-1)!) - agora).toBe(120_000);
  });
  it('Hype comprado com um Viralizou no ar não refaz a conta pra trás', async () => {
    const seg = await agoraSeg();
    await evento(seg, 2);
    await pegar(seg);
    await q(`update public.idle_state set settled_at = now() where user_id = $1`, [A]);
    const antes = (await linha()).valuation;
    await ter([1, 41, 42, 43, 44]);
    await q(`update public.idle_state set settled_at = now() - interval '30 seconds' where user_id = $1`, [A]); // 30 s dentro do Viralizou
    const r = await taxa();
    const s = await t.rpc<Json>('idle_open');
    expect(s.valuation - antes).toBeCloseTo(r * 10 * 30, 0);
  });
```

    - O `now()` do PGlite é fixo na transação de cada `rpc`? Conferir como os testes atuais medem `promo_ate`. Se o pegar roda numa transação própria, comparar com o `now()` lido logo depois, com tolerância de 1 s: `toBeGreaterThan(59_000)` / `toBeLessThanOrEqual(60_000)`.
    - Seguir o padrão dos testes vizinhos (linhas 80–140).
  - **Paridade da frequência** (`describe('a sorte ...')`), com outro `it`:

```ts
  it('com a árvore (freq 2) e o Gemaplys (0,5): mesmos segundos que douradoEm(u, s, gema + freq − 1)', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ s: string }>(
      `select s::text from generate_series($2::bigint, $3::bigint) s where public.idle_dourado($1::uuid, s, 1.5) is not null order by s`,
      [A, ini, ini + 30_000 - 1]);
    const ts: string[] = [];
    for (let s = ini; s < ini + 30_000; s++) if (douradoEm(A, s, 1.5) !== null) ts.push(String(s));
    expect(ts.length).toBeGreaterThan(130); // ~2,5/600 × 30 000 = 125
    expect(sql.map((x) => x.s)).toEqual(ts);
  });
```

  - **`convidados.test.ts`:** `eventoEm` com `bonus: { arvore: [1, 41, 42, 45] }`:
    - `janelaS` é 24;
    - a contagem num trecho de 60 000 s é ~2× a sem árvore (entre 1,7× e 2,3×);
    - com o Gemaplys de peso 1, `janelaS` é 12.
  - **`dourados.test.ts`:**

```ts
  it('textoPegou com a duração dobrada', () => {
    expect(textoPegou(1, { ganho: 0, viral: 1, duracao: 2 })).toBe('Promoção! Tudo pela metade por 1 min');
    expect(textoPegou(2, { ganho: 0, viral: 1, duracao: 2 })).toBe('Viralizou! ×10 por 2 min');
    expect(textoPegou(2, { ganho: 0, viral: 1 })).toBe('Viralizou! ×10 por 1 min');
    expect(janelaS(0, 24)).toBe(24);
    expect(janelaS(1, 24)).toBe(12);
  });
```

- [ ] **Step 2: Rodar e ver falhar.** Comando: `cd games && npx vitest run --maxWorkers=4 test/idleDourado.test.ts idle/dourados.test.ts idle/convidados.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar.**
  - **0061, `idle_dourado_pegar`:** é o da 0051 (linhas 786–831) com estas mudanças:

```sql
  v_freq double precision := 1;
  v_tela double precision := 12;
  v_dur  double precision := 1;
  ...
  s := public.idle_lock(v_me);
  ...
  v_freq := public.idle_arv(v_me, 'dourado_freq', 'max', 1);
  v_tela := public.idle_arv(v_me, 'dourado_tela', 'max', 12);
  v_dur := public.idle_arv(v_me, 'dourado_duracao', 'max', 1);
  v_tipo := coalesce(public.idle_dourado(v_me, p_seg, public.idle_conv_peso(s, 3) + v_freq - 1), public.idle_conv_faixa(s, p_seg));
  v_ini := to_timestamp(p_seg);
  -- na tela: base × (1 − gema/2); o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => v_tela * (1 - public.idle_conv_peso(s, 3) / 2) + 3) then
  ...
  case v_tipo
    when 0 then s.valuation := s.valuation + public.idle_rate(s) * 1200 * public.idle_arv(v_me, 'dourado_investidor', 'mult', 1)
                * (1 + (select b.oportunidades from public.idle_horta_bonus(s.user_id, public.idle_horta_lado(coalesce(s.generators[11], 0)), now()) b));
    when 1 then s.promo_ate := greatest(coalesce(s.promo_ate, now()), now() + make_interval(secs => 30 * v_dur));
    else s.viral_ate := array(select v from unnest(s.viral_ate) v where v > now()) || (now() + make_interval(secs => 60 * v_dur));
  end case;
```

    Com gema = 0 e `v_tela` = 12, a janela continua 15 s, como antes.
  - **`dourados.ts`:**

```ts
/** Quanto tempo o evento fica na tela: `base` (12 s, 24 com o Olho de lince) e metade com o Gemaplys na frente. */
export const janelaS = (gema = 0, base = JANELA_S) => base * (1 - gema / 2);

export function textoPegou(tipo: TipoDourado, o: { ganho: number; viral: number; duracao?: number }): string {
  const d = o.duracao ?? 1;
  if (tipo === 0) return `+${formatarValor(o.ganho)}`;
  if (tipo === 1) return `Promoção! Tudo pela metade por ${d === 1 ? '30 s' : `${d / 2} min`}`;
  return o.viral >= 2 ? `×${vezes(o.viral)}!` : `Viralizou! ×10 por ${d} min`;
}
```

    Atualizar o comentário do topo: "com chance 1/600 por segundo (mais com o ramo Dourados ou o Gemaplys)".
  - **`convidados.ts`:**

```ts
type ComCadeiras = { user_id: string; generators: number[]; convidados?: Cadeiras; bonus?: { arvore: number[] } };
export function eventoEm(s: ComCadeiras, seg: number): { tipo: TipoDourado; janelaS: number } | null {
  const { c, ppp } = ctx(s);
  const gema = peso(c, ppp, GEMAPLYS);
  const ef = efeitosArvore(catalogo, s.bonus?.arvore ?? []);
  const tipo = douradoEm(s.user_id, seg, gema + ef.douradoFreq - 1) ?? faixaEm(s.user_id, c, ppp, seg);
  return tipo === null ? null : { tipo, janelaS: janelaS(gema, ef.douradoTela) };
}
```

    - Imports: `efeitosArvore` de `./economia` e `catalogo` de `./catalogo`. Conferir antes que `economia.ts` não importa `convidados.ts`, pra não fazer ciclo; se fizer, mover `eventoEm` pra `main.ts`.
    - `efeitosArvore` tem cache por catálogo; chamar por segundo é barato.
    - Texto do Gemaplys (linha 162): `` `ficam ${janelaS(p).toLocaleString('pt-BR')} s na tela (eram 12)` `` vira "a metade do tempo na tela", que vale com ou sem árvore: `` `ficam ${pct(p / 2)} menos tempo na tela` ``.
    - Ajustar a expectativa do texto do Gemaplys em `convidados.test.ts`.
  - **`main.ts:204`:**

```ts
      const ef = efeitosDe(catalogo, s0);
      if (chaves.avisos) tela.dourados.subirTexto(textoPegou(tipo, { ganho: s0.rate * 1200 * ef.douradoInvestidor, viral: s.viral.length, duracao: ef.douradoDuracao }), p.x, p.y);
```

    Usar o import de `efeitos` que `main.ts` já tiver (`store.ts efeitos(estado)`).
  - **Som com a aba escondida:** `douradosEntre` em `dourados.ts` (o som agendado no fundo) usa `douradoEm(uid, s)` sem a árvore.
    - Conferir em `main.ts` `agendarDouradosNoFundo`. Se usar `douradosEntre`, trocar por `eventosEntre(ancora.estado, ...)` de `convidados.ts`, que já passa por `eventoEm`.
    - Se já usa `eventosEntre`, não mexer.

- [ ] **Step 4: Rodar.** Os mesmos três arquivos da Step 2, mais `test/idleConvidados.test.ts`: PASS.

- [ ] **Step 5: Commit.** `git commit -am "Fellas Inc.: ramo Dourados (mais eventos, mais tempo na tela, Investidor anjo, Hype)"`

### Task 5: Ramo Horta (banco e página)

**Files:**
- Modify: `supabase/migrations/0061_fellas_inc_arvore_dourados_horta.sql` (acrescentar `idle_horta_bonus`, `idle_horta_plantar` e `idle_horta_avancar`)
- Modify: `games/idle/horta.ts:67-80` (`bonusHorta` com `mult`)
- Test: `games/test/idleHorta.test.ts`, `games/idle/horta.test.ts`

**Interfaces:**
- Consome: os nós 61–65 (Task 1).
- Produz:
  - `bonusHorta(plantas, lado, agoraMs, mult = 1)`.
  - No banco, `idle_horta_bonus(u, lado, t)` com a mesma assinatura, já multiplicado pela árvore.

- [ ] **Step 1: Testes que falham.**
  - **`horta.test.ts`:**

```ts
  it('bonusHorta ×1,5 (Agrotóxico): tudo cresce e os descontos seguem travados em 50%', () => {
    const t0 = 0;
    const agora = 10 * 3600_000;
    const plantas = [ { canteiro: 0, especie: 1, inicioMs: t0 }, { canteiro: 1, especie: 5, inicioMs: t0 } ];
    expect(bonusHorta(plantas, 2, agora, 1.5)).toEqual({ producao: (0.01 - 0.01) * 1.5, geradores: 0, melhorias: 0.045, oportunidades: 0 });
    const muitas = Array.from({ length: 36 }, (_, c) => ({ canteiro: c, especie: 7, inicioMs: t0 }));
    expect(bonusHorta(muitas, 6, agora, 1.5).geradores).toBe(0.5);
  });
```

    Conferir as fases: o Coentro amadurece em 1h e vive 6h, então às 10h está morto. Escolher `agora` = 2h (Pé de Pix e Coentro maduros). Quiabo amadurece em 6h, então pra ele usar `agora` = 7h num `it` separado.
  - **`idleHorta.test.ts`**, seguindo os helpers do arquivo (plantar, forçar sorte, avançar relógio). Ler as primeiras 80 linhas do arquivo pra usar os nomes certos.
    1. Plantar Pé de Pix com `[1, 61, 62]`: a planta grava `amadurece_s = 3600 · 0,75 = 2700` e `vida_s = 28800 · 1,5 = 43200`.
    2. Plantar sem nó, depois ganhar `[1, 61, 62]`: a planta antiga continua com 3600/28800. Esse é o item 3 do Review Focus.
    3. Cruzamento com `[1, 61, 62, 63]`: use o mesmo jeito do teste atual de cruzamento (ele força `idle_horta_sorte`). Com sorte 0,07, não cruza sem o nó e cruza com o nó (0,07 < 0,10).
    4. Morango com `[1, ..., 65]`: sorte 0,003 dá Morango com o nó e nada sem ele (0,003 < 0,005).
    5. Bônus ×1,5 no banco: `idle_horta_bonus` com Pé de Pix maduro dá `producao` 0,015 com `[1, 61, 62, 63, 64]`.
    6. Quiabos enchendo a 6×6: `geradores` = 0,5. Esse é o item 4 do Review Focus.

- [ ] **Step 2: Rodar e ver falhar.** Comando: `cd games && npx vitest run --maxWorkers=4 test/idleHorta.test.ts idle/horta.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar.**
  - **0061, `idle_horta_bonus`:** é o da 0051 com o multiplicador lido dentro. O teto de 50% vem depois de multiplicar.

```sql
-- bônus das plantas maduras (o da 0051) × o Agrotóxico liberado (horta_mult): os descontos seguem até 50%
create or replace function public.idle_horta_bonus(u uuid, lado int, t timestamptz)
returns table (producao double precision, geradores double precision, melhorias double precision, oportunidades double precision)
language sql stable set search_path = public as $$
  with m as (select public.idle_arv(u, 'horta_mult', 'max', 1) as m)
  select coalesce(sum(k.producao), 0) * m.m, least(0.5, coalesce(sum(k.geradores), 0) * m.m),
         least(0.5, coalesce(sum(k.melhorias), 0) * m.m), coalesce(sum(k.oportunidades), 0) * m.m
    from m left join (public.idle_horta_plantas p join public.idle_cat_horta k on k.id = p.especie)
      on p.user_id = u and p.canteiro / 6 < lado and p.canteiro % 6 < lado
     and p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s)) <= t
     and t < least(coalesce(p.fim, 'infinity'), p.inicio + make_interval(secs => coalesce(p.amadurece_s, k.amadurece_s) + coalesce(p.vida_s, k.vida_s)))
   group by m.m
$$;
```

    Conferir que sem planta nenhuma sai uma linha de zeros, como antes; o `left join` com o `group by m.m` garante.
  - **0061, `idle_horta_plantar`:** é o da 0051 (linhas 1248–1291), trocando o `insert`:

```sql
  insert into public.idle_horta_plantas (user_id, canteiro, especie, inicio, amadurece_s, vida_s)
  values (v_me, p_canteiro, p_especie, now(),
          k.amadurece_s * (1 - 0.30 * public.idle_conv_peso(s, 7)) * public.idle_arv(v_me, 'horta_amadurece', 'min', 1),
          k.vida_s * (1 - 0.20 * public.idle_conv_peso(s, 7)) * public.idle_arv(v_me, 'horta_vida', 'max', 1));
```

  - **0061, `idle_horta_avancar`:** é o da 0051 (linhas 1104–1246) com:

```sql
  v_ta     double precision := (1 - 0.30 * public.idle_conv_peso(s, 7)) * public.idle_arv(s.user_id, 'horta_amadurece', 'min', 1);
  v_tv     double precision := (1 - 0.20 * public.idle_conv_peso(s, 7)) * public.idle_arv(s.user_id, 'horta_vida', 'max', 1);
  v_cruza  double precision := public.idle_arv(s.user_id, 'horta_cruza', 'max', 1);
  v_moran  double precision := public.idle_arv(s.user_id, 'morango_chance', 'max', 1);
  ...
        if cardinality(cand) > 0 and public.idle_horta_sorte(s.user_id, c, t, 1) < 0.05 * (1 + public.idle_conv_peso(s, 8)) * v_cruza then
  ...
        elsif morta[c + 1] and public.idle_horta_sorte(s.user_id, c, t, 3) < 0.001 * v_moran then
```

  - Repetir os `revoke`/`grant` que a 0051 fazia pra essas três funções: `idle_horta_plantar` é RPC do app e tem `grant execute ... to authenticated`. Copiar exatamente as linhas da 0051 (grep `idle_horta_plantar` no fim da 0051 e na 0048).
  - **`horta.ts`:**

```ts
/** Soma dos bônus das plantas maduras destrancadas × `mult` (Agrotóxico liberado: 1,5), descontos com teto de 50%.
 *  Igual a idle_horta_bonus. */
export function bonusHorta(plantas: readonly PlantaNaTela[], lado: number, agoraMs: number, mult = 1): BonusHorta {
  ...
  return { producao: b.producao * mult, geradores: Math.min(0.5, b.geradores * mult), melhorias: Math.min(0.5, b.melhorias * mult), oportunidades: b.oportunidades * mult };
}
```

  - A tela da Horta mostra o `bonus` que vem do banco (`idle_horta_json`), então já sai multiplicado.
  - As dicas de espécie em `dica.ts`/`hortaTela.ts` que citam "+1%" por planta: conferir com `grep -n "producao\|oportunidades" games/idle/hortaTela.ts games/idle/dica.ts`.
    - Se a caixinha da planta mostra o bônus da espécie, multiplicar por `efeitos(estado).hortaMult`, pra continuar dizendo o número da pessoa (regra do CLAUDE.md).
    - Se não mostra número de bônus, não mexer.

- [ ] **Step 4: Rodar.** Os arquivos da Step 2, mais `test/idleConvidados.test.ts` e `test/idleParidade.test.ts`: PASS.

- [ ] **Step 5: Commit.** `git commit -am "Fellas Inc.: ramo Horta (amadurece, vive, cruza, bônus e Morango)"`

### Task 6: A copa com 6 ramos

**Files:**
- Modify: `games/idle/legado.ts:113-146`
- Test: `games/idle/legado.test.ts:139-200`, `games/idle/arvoreTela.test.ts:53,121-131`

**Interfaces:**
- Produz: `MUNDO_ARVORE = { largura: 480, altura: 540 }`, `POSICOES_ARVORE` com 31 ids e `escalaArvore` presa entre 0,8 e 1,4.

- [ ] **Step 1: Testes que falham.**
  - `legado.test.ts`:
    - Ramos: `['Raiz', 1], ['Produção', 5], ['Recomeço', 5], ['Oportunidades', 5], ['Dourados', 5], ['Gente', 5], ['Horta', 5]`.
    - Rótulos: `['Produção', 'Recomeço', 'Oportunidades', 'Dourados', 'Gente', 'Horta']`.
    - Trocar 'as 26 posições' por 'as 31 posições'.
    - Escala: `escalaArvore(480, 540)` = 1; `escalaArvore(2000, 2000)` = 1,4; `escalaArvore(300, 800)` = 0,8; `escalaArvore(390, 900)` ≈ 0,8125; o teste `(380, 900)` sai.
    - Novo: 'a Horta é o ramo mais à direita': o x do 61 é maior que o de todos os outros primeiros nós.
  - `arvoreTela.test.ts:53`: `['Produção', 'Recomeço', 'Oportunidades', 'Dourados', 'Gente', 'Horta']`. Os testes com `no(41)` continuam (o id existe).

- [ ] **Step 2: Rodar e ver falhar.** Comando: `cd games && npx vitest run idle/legado.test.ts idle/arvoreTela.test.ts`. Esperado: FAIL.

- [ ] **Step 3: Implementar em `legado.ts`.** As posições saíram do script de conferência; a distância mínima é 65,3.

```ts
/** Árvore em tela cheia: o mundo (em unidades) e o centro de cada nó. A raiz embaixo; os 6 ramos sobem abrindo, 3 de
 *  cada lado, como a copa de uma árvore (a Horta, de 13/10, é a da ponta direita). Mudar aqui = conferir o teste de distância. */
export const MUNDO_ARVORE = { largura: 480, altura: 540 } as const;
export const POSICOES_ARVORE: Readonly<Record<number, readonly [number, number]>> = {
  1: [240, 510],
  11: [92, 462], 12: [62, 388], 13: [48, 308], 14: [50, 226], 15: [62, 144],
  21: [150, 432], 22: [128, 352], 23: [118, 270], 24: [118, 188], 25: [126, 106],
  31: [206, 396], 32: [196, 316], 33: [190, 234], 34: [190, 152], 35: [196, 70],
  41: [274, 396], 42: [284, 316], 43: [290, 234], 44: [290, 152], 45: [284, 70],
  51: [330, 432], 52: [352, 352], 53: [362, 270], 54: [362, 188], 55: [354, 106],
  61: [388, 462], 62: [418, 388], 63: [432, 308], 64: [430, 226], 65: [418, 144],
};
```

  - `escalaArvore`: `return Math.min(1.4, Math.max(0.8, s));`, com o comentário "entre 0,8 (abaixo disso arrasta; 480 × 0,8 cabe nos 390 do celular) e 1,4".
  - Comentário do `RAMOS_ARVORE`: "A raiz e os 6 ramos".
  - `arvoreTela.ts`: procurar números fixos de 400 ou 5 ramos com `grep -n "400\|540\|5 ramos\|ramo <= 5" games/idle/arvoreTela.ts games/idle/idle.css`. As linhas que ligam os nós vêm de `POSICOES_ARVORE`/`requer`. Se o CSS tiver `400`, trocar por `var(--mundo-w)` ou 480.

- [ ] **Step 4: Rodar.** Os dois arquivos da Step 2, mais `idle/ativos.test.ts`: PASS. O teste de ícones pode falhar por falta de `no-61..65.png`; isso é da Task 7.

- [ ] **Step 5: Commit.** `git commit -am "Fellas Inc.: a copa da árvore com 6 ramos (Horta à direita)"`

### Task 7: Ícones 41–45 e 61–65

**Files:**
- Modify: `../fellas-inc-esbocos/legado-arvore.js` (fora do repositório; sem git)
- Create/overwrite: `games/idle/assets/arvore/no-41.png` … `no-45.png`, `no-61.png` … `no-65.png`

- [ ] **Step 1: Backup do gerador.**
  - `cp ../fellas-inc-esbocos/legado-arvore.js ../fellas-inc-esbocos/legado-arvore.antes-2026-10-13.js`.
  - Com o mesmo cuidado, copiar também os PNGs antigos 41–45 de `png/`.

- [ ] **Step 2: Desenhar.**
  - No ramo 4, a placa continua azul (`PLACA[4]`), agora Dourados. Trocar a placa por dourado-ouro? Não: o ramo 2 já é dourado. Deixar azul.
  - Acrescentar `PLACA[6]` verde-folha diferente do verde da Produção: `[N.fo2, N.fo1, N.fo0]`, com `fo0: '#2E5A1E', fo1: '#4C8A2E', fo2: '#7DBA4A'`.
  - Mapas 16×16 no formato dos outros (`NOS['no-41'] = [4, [16 linhas de 16], legenda]`, pixel nunca na margem):
    - 41: pé de coelho com fitinha;
    - 42: olho arregalado com brilho;
    - 43: maleta de dinheiro com auréola;
    - 44: megafone com estrelinhas;
    - 45: dado mostrando 6;
    - 61: grão/xícara de café sobre terra;
    - 62: regador soltando gotas;
    - 63: abelha de óculos escuros;
    - 64: galão com caveira (rótulo verde);
    - 65: morango com pescoço comprido.
  - Apagar o `calendario`/`legCal` e o travesseiro do 41, se ficarem sem uso.
  - Atualizar o cabeçalho (ramos 4 Dourados, 6 Horta) e o `ORDEM` com `'no-61'..'no-65'`.
  - Na folha: `linhasFaixa` usa 2 linhas fixas de 13; trocar o `2 *` por `Math.ceil(n / POR) *` nas quatro faixas que dependem do número de linhas.

- [ ] **Step 3: Gerar e olhar.**
  - `cd ../fellas-inc-esbocos && node legado-arvore.js`. Esperado: `ok: 31 nós`.
  - Abrir `conferencia/legado-arvore-folha.png` com Read e conferir: legível a 3×, contorno ok, versão trancada ok.

- [ ] **Step 4: Copiar pro jogo.**
  - `cp png/no-4[1-5].png png/no-6[1-5].png ../fellasapp-arvore/games/idle/assets/arvore/`.
  - `cd games && npx vitest run idle/ativos.test.ts`: PASS.

- [ ] **Step 5: Commit.** `git add games/idle/assets/arvore && git commit -m "Fellas Inc.: ícones dos ramos Dourados e Horta"`

### Task 8: Novidade, conferência no navegador e suíte inteira

**Files:**
- Modify: `games/idle/novidades.ts:5` (entrada nova no começo), `games/idle/novidades.test.ts` (se fixar o id mais novo)

- [ ] **Step 1: Novidade.**

```ts
  {
    id: '2026-10-13-arvore',
    titulo: 'Árvore nova: Dourados e Horta',
    data: '2026-10-13',
    itens: [
      'Fechou o jogo? A empresa rende o tempo todo, sem limite de 8h. Pode sumir uma semana que o dinheiro tá lá.',
      'Por isso o ramo Tempo saiu e virou Dourados: eventos mais frequentes, mais tempo na tela, Investidor pagando o dobro e Viralizou durando mais.',
      'Quem já tinha nó do Tempo ficou com o nó do Dourados no mesmo lugar. Ninguém perdeu ponto.',
      'Ramo novo na ponta direita: Horta. Planta crescendo mais rápido, vivendo mais, cruzando mais, e o Morango com Pescoço aparecendo mais (ele tem pescoço sim).',
    ],
  },
```

  - `cd games && npx vitest run idle/novidades.test.ts`: PASS. Se o teste fixa o id mais novo, atualizar.

- [ ] **Step 2: Suíte inteira.**
  - `npx tsc --noEmit` na raiz e em `games/`, se ele tiver tsconfig próprio.
  - `npm test` na raiz.
  - `cd games && npx vitest run --maxWorkers=4`.
  - Tudo PASS.

- [ ] **Step 3: Navegador** (Chrome do Juan, música mutada).
  - `cd games && npx vite --port 5199 --strictPort` no worktree.
  - Abrir `http://localhost:5199/games/idle/index.html?mock`.
  - Conferir:
    - **Legado → árvore:** 6 ramos; rótulos sem encostar ("Oportunidades" e "Dourados" lado a lado); Horta na ponta direita; ícones novos; painel do nó com o texto novo.
    - **Celular** (`dev/frames.html?game=idle`, 390×844): a copa cabe na largura sem arrastar.
    - **Eventos:** pelo painel do `?mock`, forçar um evento com os nós 41–45 comprados (mock: dar pontos e comprar). Ele fica 24 s; o texto ao pegar Promoção diz "por 1 min".
  - Matar o vite da 5199, fechar a aba e conferir que não sobrou node meu.

- [ ] **Step 4: Commit.** `git commit -am "Fellas Inc.: novidade da árvore nova"`

### Task 9: Publicar

- [ ] **Step 1: Ordem com o Mapa do rolê.**
  - Ver `git -C ../fellasapp-mapa log --oneline -3`, `git log main --oneline -5` e `npx supabase migration list` (o Juan roda se eu for bloqueado).
  - **Se a 0056–0058 do Mapa já estiverem aplicadas e na main:**
    - fazer rebase deste branch na main;
    - regerar o catálogo com `ATUALIZAR_CATALOGO` num número acima do último aplicado;
    - renumerar a 0061 se for preciso;
    - rodar a suíte de novo.
  - **Se não estiverem:** avisar o Juan. Esta entrega usa 0060/0061, e quando o Mapa for publicar, aquela sessão precisa regerar o catálogo acima da 0061 (com os nós novos) e renumerar as migrações dela. Perguntar se pode seguir.

- [ ] **Step 2: Migração.**
  - Entregar ao Juan o comando: `! npx supabase db push --workdir ../fellasapp-arvore`.
  - Antes, conferir com `migration list` que só a 0060 e a 0061 vão subir.

- [ ] **Step 3: Conferir no banco.** Com o `q.mjs`, se o token tiver sido renovado; senão, pela REST:
  - `select id, tipo, valor from idle_cat_no where id in (41,45,61,65)`;
  - `select prosrc like '%dourado_duracao%' from pg_proc where proname = 'idle_settle'`;
  - nada de `execute` pra anon nas funções internas.

- [ ] **Step 4: Main.**
  - `git -C ../fellasapp merge --no-ff arvore-dourados-horta` (com a pasta principal limpa), depois `git push`.
  - `gh run list --limit 3` e `gh run watch` até o deploy passar.
  - Conferir o site logado: a árvore abre.

- [ ] **Step 5: Limpar.**
  - Apagar a junction do `node_modules` com `(Get-Item ...).Delete()`.
  - `git worktree remove --force ../fellasapp-arvore` e `git branch -d arvore-dourados-horta`.
  - Atualizar a memória `fellas-inc.md`.
