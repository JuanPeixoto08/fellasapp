# Fellas Inc.: a Bolsa (minigame 1) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Bolsa da Faria Lima: 8 empresas com preço que muda a cada minuto (o mesmo para o grupo), comprar e vender com F$, quebra de empresa, na gaveta Bolsa da bancada (PC) e em tela cheia no celular.

**Architecture:** O motor de preço é uma função pura de um tick (`tick(mercado, empresa, t, u[7])`) escrita igual em TS (`games/idle/bolsaMotor.ts`, usada na simulação de 30 dias que calibra os números) e em SQL (`idle_bolsa_tick`, usada pelo servidor com `random()`); um teste de paridade garante que são iguais. O servidor gera os minutos sob demanda (`idle_bolsa_avancar`), guarda o estado, o histórico de 7 dias e as carteiras, e negocia (`idle_bolsa_negociar`). A página mostra lista + detalhe (`bolsaTela.ts`) dentro da bancada; no celular a bancada vira tela cheia.

**Tech Stack:** Postgres (plpgsql) no Supabase, PGlite nos testes, TypeScript, Vitest + happy-dom, DOM puro, CSS.

**Spec:** `docs/superpowers/specs/2026-10-11-fellas-inc-bolsa-design.md`

## Global Constraints

- Nova migração `supabase/migrations/0042_fellas_inc_bolsa.sql`; 0033–0041 nunca são editadas. Idempotente (`create table if not exists`, `create or replace`, `on conflict`), UTF-8 sem BOM (o teste `games/test/migracoesUtf8.test.ts` pega).
- RLS em toda tabela nova; o catálogo `idle_cat_bolsa` é lido por `authenticated` com `public.is_member()`; mercado, preços e carteira sem acesso direto (só pelas funções). Funções que mexem em dados: `security definer set search_path = public`. Internas: `revoke all ... from public, anon, authenticated`. RPCs: `revoke all ... from public, anon` + `grant execute ... to authenticated`.
- Erros: `raise exception '<codigo>' using errcode = 'P0001'`; não membro: `raise exception 'not_member' using errcode = '42501'`. Códigos novos: `idle_bolsa_preco_mudou`, `idle_bolsa_rj`, `idle_bolsa_limite`, `idle_bolsa_fechada`, `idle_bolsa_sem_acoes`. Sem F$: `idle_cant_afford` (já existe).
- Todo `update public.`/`delete from public.` com `where` (safeupdate).
- Fellas Inc. não toca nos créditos do cassino. Grupo de trader = `generators[19]`.
- Preço em segundos de produção; em F$ = `valor × r`, `r = public.idle_rate(s)` (sem o ×5).
- Constantes: piso `0,05 × repouso`; zona de risco `< 0,15 × repouso`; recuperação judicial 10 ticks; humor dura 10 a 120 ticks; corretagem 5% na compra; limite `100 + 10 × generators[19]`; histórico 60 ticks; guarda 10080 ticks; atraso máximo 1440 ticks.
- Texto de usuário por `textContent`; pt-BR; "F$"; sem emoji como ícone; números em `Jersey 10` (`var(--i-pixel)`).
- Commits sem `Co-Authored-By`/marca de IA. Não fazer push nem `supabase db push` (o Juan roda o db push; a main só sobe depois das tabelas conferidas).
- Windows + Git Bash: `cd <dir> && ...` em cada comando. Suítes: `cd games && npx tsc --noEmit && npx vitest run`; raiz: `npx tsc --noEmit && npx jest`.

## Review Focus

- Duas chamadas ao mesmo tempo avançando o mercado não geram o mesmo minuto duas vezes nem pulam minuto (trava). Teste na Task 3 (avançar duas vezes no mesmo tick não muda nada).
- Comprar com o F$ exato do preço (corretagem incluída) passa; um centavo a menos é `idle_cant_afford`. Teste na Task 4.
- Ações de uma geração antiga (empresa quebrou) nunca entram na conta da venda nem do limite. Teste na Task 4.
- Página aberta na virada do minuto: o pedido com o tick velho é recusado e a tela recarrega o mercado. Teste na Task 7 (main recarrega a bolsa em `idle_bolsa_preco_mudou`).
- Sem Grupo de trader (empresa nova depois de vender a startup): a gaveta fica apagada e nada busca o mercado. Teste na Task 6.

---

## File Structure

- Create `games/idle/bolsaMotor.ts` (+ `bolsaMotor.test.ts`): catálogo das empresas, constantes, `normal`, `escolherHumor`, `tick`, `inicial`, e a simulação usada só no teste.
- Create `supabase/migrations/0042_fellas_inc_bolsa.sql`: tabelas, catálogo, funções puras, avançar, estado, negociar, RPCs.
- Create `games/test/idleBolsa.test.ts`: paridade SQL × TS, avançar, negociar, RPCs.
- Modify `games/test/db.ts`, `games/dev/mockDb.ts`: carregar a 0042.
- Modify `games/shared/types.ts` (tipos `BolsaEstado` etc.), `games/shared/api.ts` (`idleBolsa`, `idleBolsaNegociar`), `games/shared/errors.ts` (códigos novos), `games/dev/mockIdle.ts` (as duas chamadas no `?mock`, `__trader()`).
- Create `games/idle/bolsa.ts` (+ `bolsa.test.ts`): contas e textos da tela.
- Create `games/idle/bolsaTela.ts` (+ `bolsaTela.test.ts`): lista + detalhe.
- Modify `games/idle/tela.ts` (+ `tela.test.ts`): gaveta Bolsa, bancada em tela cheia no celular, modelo novo.
- Modify `games/idle/main.ts`: buscar o mercado enquanto aberto, negociar, avisos de "viraram pó".
- Modify `games/idle/idle.css`: estilos da Bolsa.

---

### Task 1: Motor de preço em TS e a simulação de 30 dias

**Files:**
- Create: `games/idle/bolsaMotor.ts`
- Test: `games/idle/bolsaMotor.test.ts`

**Interfaces:**
- Produces:
  - `type EmpresaBolsa = { id: number; codigo: string; nome: string; repouso: number; vol: number; pesos: readonly number[]; quebra: number }`
  - `EMPRESAS_BOLSA: readonly EmpresaBolsa[]` (ids 1..8 na ordem da spec)
  - `BOLSA = { piso: 0.05, zonaRisco: 0.15, rj: 10, durMin: 10, durMax: 120, corretagem: 0.05, limiteBase: 100, limitePorTrader: 10, historico: 60, retencao: 10080, maxAtraso: 1440 } as const`
  - `type Mercado = { valor: number; delta: number; humor: number; humorAte: number; geracao: number; rjAte: number | null }`
  - `normal(a: number, b: number): number` (Box-Muller com `1 − a`)
  - `escolherHumor(pesos: readonly number[], u: number): number`
  - `inicial(e: EmpresaBolsa, t: number): Mercado`
  - `tick(m: Mercado, e: EmpresaBolsa, t: number, u: readonly number[]): Mercado` (u com 7 uniformes em [0,1))
  - `simular(semente: number, ticks: number): { quebras: number[]; series: number[][]; rj: boolean[][] }` (só para teste)

- [ ] **Step 1: Write the failing tests**

`games/idle/bolsaMotor.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { BOLSA, EMPRESAS_BOLSA, escolherHumor, inicial, normal, simular, tick } from './bolsaMotor';

const e = (codigo: string) => EMPRESAS_BOLSA.find((x) => x.codigo === codigo)!;
const U = [0.3, 0.6, 0.4, 0.2, 0.5, 0.5, 0.99];

describe('catálogo', () => {
  it('8 empresas na ordem da spec, pesos de 6 humores', () => {
    expect(EMPRESAS_BOLSA.map((x) => x.codigo)).toEqual(['PSTL', 'ACAI', 'COCH', 'PRMO', 'JEGU', 'MEME', 'IRMA', 'SIMA']);
    expect(EMPRESAS_BOLSA.map((x) => x.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    for (const x of EMPRESAS_BOLSA) expect(x.pesos).toHaveLength(6);
    expect(e('IRMA').nome).toBe('Funerária 1 Irmão');
    expect(e('SIMA').nome).toBe('Mecânica Simas');
  });
});

describe('peças do sorteio', () => {
  it('normal: Box-Muller com 1 − a (nunca ln(0))', () => {
    expect(normal(0, 0)).toBeCloseTo(0, 12); // sqrt(-2 ln 1) = 0
    expect(Number.isFinite(normal(0.999999, 0.25))).toBe(true);
    expect(normal(1 - Math.exp(-0.5), 0)).toBeCloseTo(1, 12);
  });
  it('humor: escolhe pelo peso', () => {
    const p = [10, 0, 0, 0, 0, 30];
    expect(escolherHumor(p, 0)).toBe(0);
    expect(escolherHumor(p, 0.24)).toBe(0);
    expect(escolherHumor(p, 0.26)).toBe(5);
    expect(escolherHumor(p, 0.999)).toBe(5);
  });
});

describe('tick', () => {
  it('começa no repouso, sorteia o humor no primeiro tick e dura de 10 a 120', () => {
    const m = tick(inicial(e('PSTL'), 100), e('PSTL'), 101, [...U.slice(0, 4), 0.0, 0.0, 0.99]);
    expect(m.humor).toBe(0);
    expect(m.humorAte).toBe(101 + 10);
    const m2 = tick(inicial(e('PSTL'), 100), e('PSTL'), 101, [...U.slice(0, 4), 0.0, 0.999999, 0.99]);
    expect(m2.humorAte).toBe(101 + 120);
  });
  it('nunca cai abaixo de 5% do repouso', () => {
    let m = { ...inicial(e('MEME'), 0), valor: 0.3, delta: -0.08, humor: 4, humorAte: 10_000 };
    for (let t = 1; t < 200; t++) m = tick(m, { ...e('MEME'), quebra: 0 }, t, [0.99, 0.5, 0.5, 0.5, 0.5, 0.5, 0.99]);
    expect(m.valor).toBeGreaterThanOrEqual(BOLSA.piso * e('MEME').repouso - 1e-12);
  });
  it('na zona de risco quebra com a chance da empresa: geração +1, 10 ticks de recuperação no repouso, depois volta', () => {
    const base = { ...inicial(e('PRMO'), 0), valor: 1.5, delta: -0.05, humor: 4, humorAte: 10_000 };
    const salva = tick(base, e('PRMO'), 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.06]); // 0.06 >= 5%: não quebra
    expect(salva.geracao).toBe(0);
    const quebrou = tick(base, e('PRMO'), 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0.01]);
    expect(quebrou).toMatchObject({ geracao: 1, rjAte: 11, valor: e('PRMO').repouso, delta: 0, humor: 0 });
    const parada = tick(quebrou, e('PRMO'), 5, U);
    expect(parada).toMatchObject({ rjAte: 11, valor: e('PRMO').repouso });
    const volta = tick(parada, e('PRMO'), 11, U);
    expect(volta).toMatchObject({ rjAte: null, valor: e('PRMO').repouso, humorAte: 11 });
  });
  it('fora da zona de risco não quebra nem com sorteio 0', () => {
    const m = tick({ ...inicial(e('PRMO'), 0), humorAte: 10_000 }, e('PRMO'), 1, [0.5, 0.5, 0.5, 0.5, 0.5, 0.5, 0]);
    expect(m.geracao).toBe(0);
  });
});

describe('simulação de 30 dias (calibra o catálogo)', () => {
  const DIAS = 30 * 24 * 60;
  const SEMENTES = Array.from({ length: 20 }, (_, i) => i + 1);
  const runs = SEMENTES.map((s) => simular(s, DIAS));
  const idx = (c: string) => EMPRESAS_BOLSA.findIndex((x) => x.codigo === c);

  it('firmes quebram no máximo 1 vez por mês (em média); malucas de 3 a 30', () => {
    const media = (c: string) => runs.reduce((a, r) => a + r.quebras[idx(c)], 0) / runs.length;
    for (const c of ['PSTL', 'ACAI', 'IRMA']) expect(media(c), c).toBeLessThanOrEqual(1);
    for (const c of ['PRMO', 'MEME']) {
      expect(media(c), c).toBeGreaterThanOrEqual(3);
      expect(media(c), c).toBeLessThanOrEqual(30);
    }
  });
  it('preço sempre finito e no piso ou acima', () => {
    for (const r of runs) {
      r.series.forEach((serie, i) => {
        const piso = BOLSA.piso * EMPRESAS_BOLSA[i].repouso;
        for (const v of serie) {
          expect(Number.isFinite(v)).toBe(true);
          expect(v).toBeGreaterThanOrEqual(piso - 1e-9);
        }
      });
    }
  });

  /** Lucro médio por ação (em segundos) de uma estratégia "compra quando entra(v), vende quando sai(v)". */
  function estrategia(c: string, entra: (v: number, rep: number) => boolean, sai: (v: number, rep: number) => boolean) {
    const i = idx(c);
    const rep = EMPRESAS_BOLSA[i].repouso;
    let total = 0;
    for (const r of runs) {
      let custo: number | null = null;
      r.series[i].forEach((v, t) => {
        if (r.rj[i][t]) {
          if (custo !== null) total -= custo; // quebrou com a ação na mão
          custo = null;
          return;
        }
        if (custo === null && entra(v, rep)) custo = v * (1 + BOLSA.corretagem);
        else if (custo !== null && sai(v, rep)) {
          total += v - custo;
          custo = null;
        }
      });
    }
    return total / runs.length;
  }

  it('comprar no fundo das malucas não é lucro garantido (média <= 0)', () => {
    for (const c of ['PRMO', 'MEME']) {
      expect(estrategia(c, (v, rep) => v < BOLSA.zonaRisco * rep, (v, rep) => v >= 0.5 * rep), c).toBeLessThanOrEqual(0);
    }
  });
  it('paciência nas firmes dá lucro (compra abaixo de 70%, vende acima de 105%)', () => {
    for (const c of ['PSTL', 'ACAI', 'IRMA']) {
      expect(estrategia(c, (v, rep) => v < 0.7 * rep, (v, rep) => v > 1.05 * rep), c).toBeGreaterThan(0);
    }
  });
});
```

- [ ] **Step 2: Run to see it fail**

Run: `cd games && npx vitest run idle/bolsaMotor.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Step 3: Implement `games/idle/bolsaMotor.ts`**

```ts
// Motor de preço da Bolsa da Fellas Inc. Um tick (1 minuto) de uma empresa é uma função pura dos sorteios (7 uniformes
// em [0,1)): o servidor (0042 idle_bolsa_tick, com random()) e esta cópia fazem a mesma conta (games/test/idleBolsa.test.ts
// confere). Esta cópia só serve à simulação que calibra o catálogo e aos testes; quem sorteia de verdade é o servidor.
// Preço em segundos de produção. Spec: docs/superpowers/specs/2026-10-11-fellas-inc-bolsa-design.md.

export type EmpresaBolsa = {
  id: number; codigo: string; nome: string; repouso: number; vol: number; pesos: readonly number[]; quebra: number;
};

/** Pesos dos humores: 0 parada · 1 sobe devagar · 2 cai devagar · 3 sobe forte · 4 despenca · 5 maluca. Mudou aqui:
 *  mude também o insert da 0042 (o teste de paridade compara). */
export const EMPRESAS_BOLSA: readonly EmpresaBolsa[] = [
  { id: 1, codigo: 'PSTL', nome: 'Pastel do Zé', repouso: 30, vol: 0.6, pesos: [30, 30, 15, 10, 5, 10], quebra: 0.01 },
  { id: 2, codigo: 'ACAI', nome: 'Açaí Gourmet', repouso: 120, vol: 0.5, pesos: [35, 30, 15, 8, 4, 8], quebra: 0.01 },
  { id: 3, codigo: 'COCH', nome: 'Coach Quântico', repouso: 50, vol: 1.2, pesos: [10, 15, 10, 30, 25, 10], quebra: 0.05 },
  { id: 4, codigo: 'PRMO', nome: 'Cripto do Primo', repouso: 20, vol: 1.6, pesos: [5, 10, 10, 15, 15, 45], quebra: 0.05 },
  { id: 5, codigo: 'JEGU', nome: 'Uber de Jegue', repouso: 8, vol: 1.2, pesos: [15, 15, 20, 10, 15, 25], quebra: 0.05 },
  { id: 6, codigo: 'MEME', nome: 'NFT de Meme', repouso: 5, vol: 1.6, pesos: [5, 10, 10, 15, 15, 45], quebra: 0.05 },
  { id: 7, codigo: 'IRMA', nome: 'Funerária 1 Irmão', repouso: 80, vol: 0.3, pesos: [70, 10, 10, 4, 3, 3], quebra: 0.01 },
  { id: 8, codigo: 'SIMA', nome: 'Mecânica Simas', repouso: 40, vol: 1.0, pesos: [20, 20, 20, 15, 15, 10], quebra: 0.02 },
];

export const BOLSA = {
  piso: 0.05, zonaRisco: 0.15, rj: 10, durMin: 10, durMax: 120, corretagem: 0.05, limiteBase: 100, limitePorTrader: 10,
  historico: 60, retencao: 10080, maxAtraso: 1440,
} as const;

export type Mercado = { valor: number; delta: number; humor: number; humorAte: number; geracao: number; rjAte: number | null };

/** Normal(0, 1) por Box-Muller; `1 − a` porque o sorteio é [0,1) e ln(0) não existe. */
export const normal = (a: number, b: number) => Math.sqrt(-2 * Math.log(1 - a)) * Math.cos(2 * Math.PI * b);

/** O humor sorteado pelos pesos (u em [0,1)). */
export function escolherHumor(pesos: readonly number[], u: number): number {
  const total = pesos.reduce((a, p) => a + p, 0);
  let x = u * total;
  for (let i = 0; i < pesos.length; i++) {
    if (x < pesos[i]) return i;
    x -= pesos[i];
  }
  return pesos.length - 1;
}

/** Empresa nova no mercado: no repouso, humor vencido (sorteia no primeiro tick). */
export const inicial = (e: EmpresaBolsa, t: number): Mercado => ({ valor: e.repouso, delta: 0, humor: 0, humorAte: t, geracao: 0, rjAte: null });

const EMPURRAO = [0, 0.004, -0.004, 0.02, -0.02];

/**
 * Um minuto. u: [n1a, n1b, n2a, n2b, humor, duração, quebra]. Em recuperação judicial: preço parado no repouso; no tick
 * da volta, sai da recuperação (humor vencido). Igual a 0042 idle_bolsa_tick.
 */
export function tick(m: Mercado, e: EmpresaBolsa, t: number, u: readonly number[]): Mercado {
  if (m.rjAte !== null) {
    if (t >= m.rjAte) return { ...m, valor: e.repouso, delta: 0, humor: 0, humorAte: t, rjAte: null };
    return { ...m, valor: e.repouso, delta: 0, humor: 0 };
  }
  let humor = m.humor;
  let humorAte = m.humorAte;
  if (t >= humorAte) {
    humor = escolherHumor(e.pesos, u[4]);
    humorAte = t + BOLSA.durMin + Math.floor(u[5] * (BOLSA.durMax - BOLSA.durMin + 1));
  }
  const n1 = normal(u[0], u[1]);
  const n2 = normal(u[2], u[3]);
  const empurrao = humor === 5 ? n2 * 0.06 : EMPURRAO[humor];
  const delta = Math.max(-0.08, Math.min(0.08, m.delta * 0.97 + empurrao * e.vol + n1 * 0.01 * e.vol));
  const valor = Math.max(m.valor * (1 + delta) + (e.repouso - m.valor) * 0.01, BOLSA.piso * e.repouso);
  if (valor < BOLSA.zonaRisco * e.repouso && u[6] < e.quebra) {
    return { valor: e.repouso, delta: 0, humor: 0, humorAte: t + BOLSA.rj, geracao: m.geracao + 1, rjAte: t + BOLSA.rj };
  }
  return { valor, delta, humor, humorAte, geracao: m.geracao, rjAte: null };
}

/** Sorteio com semente (mulberry32), só para a simulação. */
function rng(semente: number) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let r = Math.imul(a ^ (a >>> 15), 1 | a);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/** `ticks` minutos de mercado com semente: quebras por empresa, a série de preços e se estava em recuperação. */
export function simular(semente: number, ticks: number) {
  const r = rng(semente);
  const quebras = EMPRESAS_BOLSA.map(() => 0);
  const series = EMPRESAS_BOLSA.map(() => [] as number[]);
  const rj = EMPRESAS_BOLSA.map(() => [] as boolean[]);
  const m = EMPRESAS_BOLSA.map((e) => inicial(e, 0));
  for (let t = 1; t <= ticks; t++) {
    EMPRESAS_BOLSA.forEach((e, i) => {
      const antes = m[i].geracao;
      m[i] = tick(m[i], e, t, [r(), r(), r(), r(), r(), r(), r()]);
      if (m[i].geracao > antes) quebras[i]++;
      series[i].push(m[i].valor);
      rj[i].push(m[i].rjAte !== null);
    });
  }
  return { quebras, series, rj };
}
```

- [ ] **Step 4: Run and calibrate**

Run: `cd games && npx vitest run idle/bolsaMotor.test.ts`
Expected: PASS. Se um alvo da simulação falhar, ajuste **só** `vol`, `pesos` ou `quebra` da empresa que falhou (repouso e as regras ficam), rode de novo, e registre no ledger `Task 1: Ruling: <empresa> <campo> <de> → <para> — <alvo que falhou>`. Os mesmos valores vão para a 0042 na Task 2.

- [ ] **Step 5: Commit**

```bash
cd games && npx tsc --noEmit && npx vitest run
git add idle/bolsaMotor.ts idle/bolsaMotor.test.ts
git commit -m "Fellas Inc.: motor de preço da Bolsa e a simulação de 30 dias que calibra as empresas"
```

---

### Task 2: Migração 0042, parte 1 — catálogo e o tick em SQL (paridade)

**Files:**
- Create: `supabase/migrations/0042_fellas_inc_bolsa.sql`
- Modify: `games/test/db.ts` (lista `MIGRATIONS`), `games/dev/mockDb.ts` (import + lista)
- Test: `games/test/idleBolsa.test.ts`

**Interfaces:**
- Consumes (Task 1): `EMPRESAS_BOLSA`, `inicial`, `tick`, `normal`, `escolherHumor`.
- Produces (SQL): tabelas `idle_cat_bolsa(id, codigo, nome, repouso, vol, pesos double precision[], quebra)` e `idle_bolsa_mercado(empresa, tick, valor, delta, humor, humor_ate, geracao, rj_ate)`; funções imutáveis `idle_bolsa_normal(a, b)`, `idle_bolsa_humor(p double precision[], u)`, `idle_bolsa_tick(m idle_bolsa_mercado, c idle_cat_bolsa, t bigint, u double precision[]) returns idle_bolsa_mercado`.

- [ ] **Step 1: Write the failing tests**

`games/test/idleBolsa.test.ts`:

```ts
// Banco da Bolsa (minigame 1): migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { EMPRESAS_BOLSA, escolherHumor, inicial, normal, tick, type Mercado } from '../idle/bolsaMotor';
import { freshDb, type TestDb } from './db';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb();
});

type Linha = { valor: number; delta: number; humor: number; humor_ate: string; geracao: number; rj_ate: string | null };
const paraTs = (l: Linha): Mercado => ({
  valor: l.valor, delta: l.delta, humor: l.humor, humorAte: Number(l.humor_ate), geracao: l.geracao,
  rjAte: l.rj_ate === null ? null : Number(l.rj_ate),
});

/** Roda o tick em SQL com o estado m (como linha de idle_bolsa_mercado). */
async function tickSql(m: Mercado, empresa: number, tt: number, u: number[]): Promise<Mercado> {
  const [r] = await q<Linha>(
    `select (x).valor, (x).delta, (x).humor, (x).humor_ate::text, (x).geracao, (x).rj_ate::text from (
       select public.idle_bolsa_tick(row($1::int, $2::bigint, $3::float8, $4::float8, $5::int, $6::bigint, $7::int, $8::bigint)::public.idle_bolsa_mercado, c, $9::bigint, $10::double precision[]) as x
       from public.idle_cat_bolsa c where c.id = $1) s`,
    [empresa, tt - 1, m.valor, m.delta, m.humor, m.humorAte, m.geracao, m.rjAte, tt, u],
  );
  return paraTs(r);
}

describe('catálogo e tick (paridade SQL × TS)', () => {
  it('o catálogo do banco é o mesmo da página', async () => {
    const rows = await q<{ id: number; codigo: string; nome: string; repouso: number; vol: number; pesos: number[]; quebra: number }>(
      'select id, codigo, nome, repouso, vol, pesos, quebra from public.idle_cat_bolsa order by id');
    expect(rows).toEqual(EMPRESAS_BOLSA.map((e) => ({ ...e, pesos: [...e.pesos] })));
  });
  it('normal e humor iguais', async () => {
    for (const [a, b] of [[0, 0], [0.3, 0.6], [0.999, 0.25], [0.5, 0.9]]) {
      const [r] = await q<{ n: number }>('select public.idle_bolsa_normal($1, $2) as n', [a, b]);
      expect(Math.abs(r.n - normal(a, b))).toBeLessThan(1e-9);
    }
    for (const u of [0, 0.1, 0.33, 0.5, 0.77, 0.999]) {
      const [r] = await q<{ h: number }>('select public.idle_bolsa_humor($1::double precision[], $2) as h', [EMPRESAS_BOLSA[3].pesos, u]);
      expect(r.h).toBe(escolherHumor(EMPRESAS_BOLSA[3].pesos, u));
    }
  });
  it('200 ticks de cada empresa com os mesmos sorteios dão o mesmo mercado (< 1e-9)', async () => {
    let s = 7;
    const u = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (const e of EMPRESAS_BOLSA) {
      let ts = inicial(e, 0);
      let sql = inicial(e, 0);
      for (let tt = 1; tt <= 200; tt++) {
        const sorteio = [u(), u(), u(), u(), u(), u(), u()];
        // força a zona de risco de vez em quando, pra exercitar a quebra
        if (tt % 50 === 0) { ts = { ...ts, valor: e.repouso * 0.1 }; sql = { ...sql, valor: e.repouso * 0.1 }; sorteio[6] = 0; }
        ts = tick(ts, e, tt, sorteio);
        sql = await tickSql(sql, e.id, tt, sorteio);
        expect(Math.abs(sql.valor - ts.valor), `${e.codigo} t${tt}`).toBeLessThan(1e-9 * Math.max(1, ts.valor));
        expect(Math.abs(sql.delta - ts.delta)).toBeLessThan(1e-9);
        expect({ ...sql, valor: 0, delta: 0 }).toEqual({ ...ts, valor: 0, delta: 0 });
      }
    }
  });
  it('catálogo: membro lê, anônimo não', async () => {
    await t.member('00000000-0000-0000-0000-00000000000a');
    await t.as('00000000-0000-0000-0000-00000000000a');
    expect(await t.asRole('authenticated', 'select id from public.idle_cat_bolsa')).toHaveLength(8);
    await expect(t.asRole('anon', 'select id from public.idle_cat_bolsa')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_bolsa_mercado')).rejects.toThrow();
  });
});
```

Em `games/test/db.ts`, acrescente `'0042_fellas_inc_bolsa.sql',` depois de `'0041_fellas_inc_prestigio.sql',`. Em `games/dev/mockDb.ts`, acrescente `import m42 from '../../supabase/migrations/0042_fellas_inc_bolsa.sql?raw';` depois do `m41` e `m42` no fim da lista do `for (const m of [...])`.

Run: `cd games && npx vitest run test/idleBolsa.test.ts`
Expected: FAIL (arquivo da migração não existe).

- [ ] **Step 2: Write `supabase/migrations/0042_fellas_inc_bolsa.sql` (parte 1)**

```sql
-- Fellas Inc.: a Bolsa da Faria Lima (minigame 1). Spec: docs/superpowers/specs/2026-10-11-fellas-inc-bolsa-design.md.
-- Preço em segundos de produção (em F$ = valor × idle_rate). Um tick = 1 minuto, o mesmo mercado para o grupo todo.

-- ---------- catálogo (igual a games/idle/bolsaMotor.ts EMPRESAS_BOLSA; o teste compara) ----------
create table if not exists public.idle_cat_bolsa (
  id      int primary key,
  codigo  text not null,
  nome    text not null,
  repouso double precision not null,
  vol     double precision not null,
  pesos   double precision[] not null,
  quebra  double precision not null
);
alter table public.idle_cat_bolsa enable row level security;
revoke all on public.idle_cat_bolsa from anon, authenticated;
grant select on public.idle_cat_bolsa to authenticated;
drop policy if exists "idle_cat_bolsa_select_members" on public.idle_cat_bolsa;
create policy "idle_cat_bolsa_select_members" on public.idle_cat_bolsa for select to authenticated using (public.is_member());

insert into public.idle_cat_bolsa (id, codigo, nome, repouso, vol, pesos, quebra) values
  (1, 'PSTL', 'Pastel do Zé', 30, 0.6, '{30,30,15,10,5,10}', 0.01),
  (2, 'ACAI', 'Açaí Gourmet', 120, 0.5, '{35,30,15,8,4,8}', 0.01),
  (3, 'COCH', 'Coach Quântico', 50, 1.2, '{10,15,10,30,25,10}', 0.05),
  (4, 'PRMO', 'Cripto do Primo', 20, 1.6, '{5,10,10,15,15,45}', 0.05),
  (5, 'JEGU', 'Uber de Jegue', 8, 1.2, '{15,15,20,10,15,25}', 0.05),
  (6, 'MEME', 'NFT de Meme', 5, 1.6, '{5,10,10,15,15,45}', 0.05),
  (7, 'IRMA', 'Funerária 1 Irmão', 80, 0.3, '{70,10,10,4,3,3}', 0.01),
  (8, 'SIMA', 'Mecânica Simas', 40, 1.0, '{20,20,20,15,15,10}', 0.02)
on conflict (id) do update set codigo = excluded.codigo, nome = excluded.nome, repouso = excluded.repouso, vol = excluded.vol,
  pesos = excluded.pesos, quebra = excluded.quebra;

-- ---------- estado do mercado (uma linha por empresa) ----------
create table if not exists public.idle_bolsa_mercado (
  empresa   int primary key references public.idle_cat_bolsa (id),
  tick      bigint not null,
  valor     double precision not null,
  delta     double precision not null,
  humor     int not null,
  humor_ate bigint not null,
  geracao   int not null default 0,
  rj_ate    bigint
);
alter table public.idle_bolsa_mercado enable row level security;
revoke all on public.idle_bolsa_mercado from anon, authenticated;

-- ---------- o passo (puro: os sorteios entram como argumento; igual a bolsaMotor.ts) ----------
create or replace function public.idle_bolsa_normal(a double precision, b double precision)
returns double precision language sql immutable set search_path = public as $$
  select sqrt(-2 * ln(1 - a)) * cos(2 * pi() * b)
$$;

create or replace function public.idle_bolsa_humor(p double precision[], u double precision)
returns int language plpgsql immutable set search_path = public as $$
declare
  v_total double precision := 0;
  v_x     double precision;
  i       int;
begin
  for i in 1 .. array_length(p, 1) loop
    v_total := v_total + p[i];
  end loop;
  v_x := u * v_total;
  for i in 1 .. array_length(p, 1) loop
    if v_x < p[i] then
      return i - 1;
    end if;
    v_x := v_x - p[i];
  end loop;
  return array_length(p, 1) - 1;
end;
$$;

-- u: [n1a, n1b, n2a, n2b, humor, duração, quebra], uniformes em [0,1)
create or replace function public.idle_bolsa_tick(m public.idle_bolsa_mercado, c public.idle_cat_bolsa, t bigint, u double precision[])
returns public.idle_bolsa_mercado language plpgsql immutable set search_path = public as $$
declare
  v_humor int := m.humor;
  v_ate   bigint := m.humor_ate;
  v_emp   double precision;
  v_d     double precision;
  v_v     double precision;
  v_n1    double precision;
  v_n2    double precision;
begin
  m.tick := t;
  if m.rj_ate is not null then
    m.valor := c.repouso;
    m.delta := 0;
    m.humor := 0;
    if t >= m.rj_ate then
      m.rj_ate := null;
      m.humor_ate := t;
    end if;
    return m;
  end if;
  if t >= v_ate then
    v_humor := public.idle_bolsa_humor(c.pesos, u[5]);
    v_ate := t + 10 + floor(u[6] * 111)::bigint;
  end if;
  v_n1 := public.idle_bolsa_normal(u[1], u[2]);
  v_n2 := public.idle_bolsa_normal(u[3], u[4]);
  v_emp := case v_humor when 0 then 0 when 1 then 0.004 when 2 then -0.004 when 3 then 0.02 when 4 then -0.02 else v_n2 * 0.06 end;
  v_d := greatest(-0.08, least(0.08, m.delta * 0.97 + v_emp * c.vol + v_n1 * 0.01 * c.vol));
  v_v := greatest(m.valor * (1 + v_d) + (c.repouso - m.valor) * 0.01, 0.05 * c.repouso);
  if v_v < 0.15 * c.repouso and u[7] < c.quebra then
    m.valor := c.repouso;
    m.delta := 0;
    m.humor := 0;
    m.humor_ate := t + 10;
    m.geracao := m.geracao + 1;
    m.rj_ate := t + 10;
    return m;
  end if;
  m.valor := v_v;
  m.delta := v_d;
  m.humor := v_humor;
  m.humor_ate := v_ate;
  return m;
end;
$$;

revoke all on function public.idle_bolsa_normal(double precision, double precision) from public, anon, authenticated;
revoke all on function public.idle_bolsa_humor(double precision[], double precision) from public, anon, authenticated;
revoke all on function public.idle_bolsa_tick(public.idle_bolsa_mercado, public.idle_cat_bolsa, bigint, double precision[]) from public, anon, authenticated;
```

Se a Task 1 mudou algum `vol`, `pesos` ou `quebra`, use os valores dela no insert.

- [ ] **Step 3: Run tests**

Run: `cd games && npx vitest run test/idleBolsa.test.ts test/migracoesUtf8.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd games && npx tsc --noEmit && npx vitest run
git add ../supabase/migrations/0042_fellas_inc_bolsa.sql test/idleBolsa.test.ts test/db.ts dev/mockDb.ts
git commit -m "Fellas Inc.: Bolsa no banco, parte 1: catálogo das empresas e o tick em SQL (paridade com a página)"
```

---

### Task 3: Migração 0042, parte 2 — avançar o mercado e o histórico

**Files:**
- Modify: `supabase/migrations/0042_fellas_inc_bolsa.sql` (acrescentar no fim)
- Test: `games/test/idleBolsa.test.ts`

**Interfaces:**
- Consumes (Task 2): `idle_bolsa_tick`, tabelas.
- Produces: tabela `idle_bolsa_precos(tick, empresa, valor)`; `idle_bolsa_avancar_ate(p_agora bigint) returns void` (interna, testável sem relógio); `idle_bolsa_agora() returns bigint` (= `floor(epoch(now())/60)`); `idle_bolsa_avancar() returns bigint` (avança até agora, devolve o tick).

- [ ] **Step 1: Write the failing tests**

Acrescente em `games/test/idleBolsa.test.ts`:

```ts
describe('avançar o mercado', () => {
  const precos = (empresa: number) =>
    q<{ tick: string; valor: number }>('select tick::text, valor from public.idle_bolsa_precos where empresa = $1 order by tick', [empresa]);
  const mercado = (empresa: number) => q<Linha & { tick: string }>('select *, tick::text, humor_ate::text, rj_ate::text from public.idle_bolsa_mercado where empresa = $1', [empresa]);

  it('primeira vez: cria as 8 no repouso, no tick de agora', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    const rows = await q<{ n: number }>('select count(*)::int as n from public.idle_bolsa_mercado');
    expect(rows[0].n).toBe(8);
    expect(await precos(1)).toEqual([{ tick: '1000', valor: 30 }]);
  });
  it('gera os minutos que faltam, um preço por minuto por empresa; mesmo tick de novo não muda nada', async () => {
    await q('select setseed(0.42)');
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('select public.idle_bolsa_avancar_ate(1005)');
    expect((await precos(3)).map((p) => p.tick)).toEqual(['1000', '1001', '1002', '1003', '1004', '1005']);
    const antes = await mercado(3);
    await q('select public.idle_bolsa_avancar_ate(1005)');
    expect(await mercado(3)).toEqual(antes);
    expect(await precos(3)).toHaveLength(6);
  });
  it('mais de 1 dia parado: gera só o último dia', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('select public.idle_bolsa_avancar_ate(1000 + 5000)');
    const p = await precos(1);
    expect(p).toHaveLength(1 + 1440);
    expect(p[1].tick).toBe(String(1000 + 5000 - 1440 + 1));
  });
  it('apaga o histórico de mais de 7 dias', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('insert into public.idle_bolsa_precos (tick, empresa, valor) values (10, 1, 1)');
    await q('select public.idle_bolsa_avancar_ate(1001)');
    expect((await precos(1)).map((p) => p.tick)).toEqual(['1000', '1001']);
  });
  it('quebra no banco: empresa na zona de risco com chance 1 quebra, fica 10 minutos parada e volta', async () => {
    await q('select public.idle_bolsa_avancar_ate(1000)');
    await q('update public.idle_cat_bolsa set quebra = 1 where id = 4');
    await q('update public.idle_bolsa_mercado set valor = 1, humor = 4, humor_ate = 99999 where empresa = 4');
    await q('select public.idle_bolsa_avancar_ate(1001)');
    let [m] = await mercado(4);
    expect(m.geracao).toBe(1);
    expect(m.rj_ate).toBe('1011');
    await q('select public.idle_bolsa_avancar_ate(1011)');
    [m] = await mercado(4);
    expect(m.rj_ate).toBeNull();
    expect(m.valor).toBe(20);
  });
  it('avançar de verdade usa o relógio: tick = minutos desde 1970', async () => {
    const [{ agora }] = await q<{ agora: string }>('select public.idle_bolsa_agora()::text as agora');
    expect(Math.abs(Number(agora) - Math.floor(Date.now() / 60000))).toBeLessThanOrEqual(1);
    const [{ v }] = await q<{ v: string }>('select public.idle_bolsa_avancar()::text as v');
    expect(Math.abs(Number(v) - Number(agora))).toBeLessThanOrEqual(1);
  });
});
```

Run: `cd games && npx vitest run test/idleBolsa.test.ts`
Expected: FAIL (`idle_bolsa_avancar_ate` não existe).

- [ ] **Step 2: Append to the migration**

```sql
-- ---------- histórico (7 dias) ----------
create table if not exists public.idle_bolsa_precos (
  tick    bigint not null,
  empresa int not null references public.idle_cat_bolsa (id),
  valor   double precision not null,
  primary key (tick, empresa)
);
alter table public.idle_bolsa_precos enable row level security;
revoke all on public.idle_bolsa_precos from anon, authenticated;

create or replace function public.idle_bolsa_agora()
returns bigint language sql stable set search_path = public as $$
  select floor(extract(epoch from now()) / 60)::bigint
$$;

-- gera os minutos que faltam até p_agora (no máximo 1 dia), com trava: duas chamadas juntas não geram o mesmo minuto
create or replace function public.idle_bolsa_avancar_ate(p_agora bigint)
returns void language plpgsql volatile security definer set search_path = public as $$
declare
  c   public.idle_cat_bolsa;
  m   public.idle_bolsa_mercado;
  v_t bigint;
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-bolsa'));
  for c in select * from public.idle_cat_bolsa order by id loop
    select * into m from public.idle_bolsa_mercado where empresa = c.id;
    if not found then
      insert into public.idle_bolsa_mercado (empresa, tick, valor, delta, humor, humor_ate, geracao, rj_ate)
      values (c.id, p_agora, c.repouso, 0, 0, p_agora, 0, null);
      insert into public.idle_bolsa_precos (tick, empresa, valor) values (p_agora, c.id, c.repouso)
      on conflict (tick, empresa) do nothing;
      continue;
    end if;
    v_t := greatest(m.tick, p_agora - 1440);
    while v_t < p_agora loop
      v_t := v_t + 1;
      m := public.idle_bolsa_tick(m, c, v_t, array[random(), random(), random(), random(), random(), random(), random()]);
      insert into public.idle_bolsa_precos (tick, empresa, valor) values (v_t, c.id, m.valor)
      on conflict (tick, empresa) do update set valor = excluded.valor;
    end loop;
    update public.idle_bolsa_mercado
       set tick = greatest(m.tick, tick), valor = m.valor, delta = m.delta, humor = m.humor, humor_ate = m.humor_ate,
           geracao = m.geracao, rj_ate = m.rj_ate
     where empresa = c.id;
  end loop;
  delete from public.idle_bolsa_precos where tick < p_agora - 10080;
end;
$$;

create or replace function public.idle_bolsa_avancar()
returns bigint language plpgsql volatile security definer set search_path = public as $$
declare
  v_agora bigint := public.idle_bolsa_agora();
begin
  perform public.idle_bolsa_avancar_ate(v_agora);
  return v_agora;
end;
$$;

revoke all on function public.idle_bolsa_agora() from public, anon, authenticated;
revoke all on function public.idle_bolsa_avancar_ate(bigint) from public, anon, authenticated;
revoke all on function public.idle_bolsa_avancar() from public, anon, authenticated;
```

- [ ] **Step 3: Run tests**

Run: `cd games && npx vitest run test/idleBolsa.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd games && npx vitest run
git add ../supabase/migrations/0042_fellas_inc_bolsa.sql test/idleBolsa.test.ts
git commit -m "Fellas Inc.: Bolsa no banco, parte 2: o mercado anda sozinho (minutos sob demanda, quebra, histórico de 7 dias)"
```

---

### Task 4: Migração 0042, parte 3 — carteira, estado da Bolsa e negociar

**Files:**
- Modify: `supabase/migrations/0042_fellas_inc_bolsa.sql` (acrescentar no fim)
- Test: `games/test/idleBolsa.test.ts`

**Interfaces:**
- Consumes: `idle_lock(uuid)`, `idle_settle(idle_state)`, `idle_save(idle_state)`, `idle_json(idle_state)`, `idle_rate(idle_state)` (0034–0041), `is_member()`.
- Produces:
  - tabela `idle_bolsa_carteira(user_id, empresa, qtd, custo, geracao)`;
  - `idle_bolsa_estado(p_user uuid, p_agora bigint) returns jsonb` (interna): `{ tick, vira_em_ms, r, limite, aberta, empresas: [{ id, valor, risco, rj_ate, historico }], carteira: [{ empresa, qtd, custo }], viraram_po: [{ empresa, qtd }] }` — apaga as posições de geração antiga e as devolve uma vez em `viraram_po`;
  - `idle_bolsa_negociar_em(p_user, p_empresa int, p_lado text, p_qtd int, p_tick bigint, p_agora bigint) returns jsonb` (interna): devolve `idle_json(s) || { bolsa: idle_bolsa_estado(...) }`;
  - RPCs `idle_bolsa() returns jsonb` e `idle_bolsa_negociar(p_empresa int, p_lado text, p_qtd int, p_tick bigint) returns jsonb`.

- [ ] **Step 1: Write the failing tests**

Acrescente em `games/test/idleBolsa.test.ts`:

```ts
describe('carteira e negociar', () => {
  const A = '00000000-0000-0000-0000-00000000000a';
  const OUT = '00000000-0000-0000-0000-0000000000ff';
  type Bolsa = {
    tick: number; vira_em_ms: number; r: number; limite: number; aberta: boolean;
    empresas: { id: number; valor: number; risco: boolean; rj_ate: number | null; historico: number[] }[];
    carteira: { empresa: number; qtd: number; custo: number }[]; viraram_po: { empresa: number; qtd: number }[];
  };
  type Resp = { valuation: number; bolsa: Bolsa };
  const T = 5000;
  const negociar = (empresa: number, lado: string, qtd: number, tick = T, agora = T) =>
    q<{ v: Resp }>('select public.idle_bolsa_negociar_em($1, $2, $3, $4, $5, $6) as v', [A, empresa, lado, qtd, tick, agora]).then((r) => r[0].v);
  const estado = (agora = T) => q<{ v: Bolsa }>('select public.idle_bolsa_estado($1, $2) as v', [A, agora]).then((r) => r[0].v);
  const r = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
  const valuation = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;

  beforeEach(async () => {
    await t.member(A);
    await t.member(OUT, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    // 2 Grupos de trader e F$ de sobra; mercado criado no tick T, Pastel (1) a 30 s
    await q(`update public.idle_state set generators[19] = 2, generators[1] = 10, valuation = 1e12 where user_id = $1`, [A]);
    await q('select public.idle_bolsa_avancar_ate($1)', [T]);
  });

  it('estado: aberta com trader, limite 100 + 10 por trader, preços e histórico', async () => {
    const b = await estado();
    expect(b.aberta).toBe(true);
    expect(b.limite).toBe(120);
    expect(b.tick).toBe(T);
    expect(b.r).toBeCloseTo(await r(), 9);
    expect(b.empresas).toHaveLength(8);
    expect(b.empresas[0]).toMatchObject({ id: 1, valor: 30, risco: false, rj_ate: null, historico: [30] });
    expect(b.carteira).toEqual([]);
  });
  it('comprar 10: paga 10 × valor × r × 1,05 e guarda o custo em segundos', async () => {
    const rr = await r();
    const antes = await valuation();
    const resp = await negociar(1, 'comprar', 10);
    expect(antes - resp.valuation).toBeCloseTo(10 * 30 * rr * 1.05, 3);
    expect(resp.bolsa.carteira).toEqual([{ empresa: 1, qtd: 10, custo: 10 * 30 * 1.05 }]);
  });
  it('vender: recebe qtd × valor × r sem taxa e tira o custo na proporção; Tudo (0) vende o resto', async () => {
    await negociar(1, 'comprar', 10);
    const rr = await r();
    const antes = await valuation();
    const resp = await negociar(1, 'vender', 1);
    expect(resp.valuation - antes).toBeCloseTo(30 * rr, 3);
    expect(resp.bolsa.carteira[0].qtd).toBe(9);
    expect(resp.bolsa.carteira[0].custo).toBeCloseTo(9 * 30 * 1.05, 9);
    const fim = await negociar(1, 'vender', 0);
    expect(fim.bolsa.carteira).toEqual([]);
  });
  it('Máx: compra o que o F$ e o limite deixam; F$ exato passa, um centavo a menos não', async () => {
    const rr = await r();
    const um = 30 * rr * 1.05;
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, um * 3]);
    const resp = await negociar(1, 'comprar', 0);
    expect(resp.bolsa.carteira[0].qtd).toBe(3);
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, um - 0.01]);
    await expect(negociar(1, 'comprar', 1)).rejects.toThrow('idle_cant_afford');
  });
  it('limite: 120 com 2 traders; acima disso idle_bolsa_limite', async () => {
    await negociar(1, 'comprar', 0);
    expect((await estado()).carteira[0].qtd).toBe(120);
    await expect(negociar(1, 'comprar', 1)).rejects.toThrow('idle_bolsa_limite');
  });
  it('recusas: preço mudou, sem trader, recuperação judicial, sem ações, opção inválida', async () => {
    await expect(negociar(1, 'comprar', 1, T - 1)).rejects.toThrow('idle_bolsa_preco_mudou');
    await expect(negociar(1, 'vender', 1)).rejects.toThrow('idle_bolsa_sem_acoes');
    await expect(negociar(1, 'comprar', 5)).rejects.toThrow('idle_bad_choice');
    await expect(negociar(99, 'comprar', 1)).rejects.toThrow('idle_bad_choice');
    await q('update public.idle_bolsa_mercado set rj_ate = $1 where empresa = 4', [T + 5]);
    await expect(negociar(4, 'comprar', 1)).rejects.toThrow('idle_bolsa_rj');
    await q(`update public.idle_state set generators[19] = 0 where user_id = $1`, [A]);
    await expect(negociar(1, 'comprar', 1)).rejects.toThrow('idle_bolsa_fechada');
  });
  it('quebrou: as ações da geração velha viram pó uma vez e não entram em venda nem limite', async () => {
    await negociar(4, 'comprar', 10);
    await q('update public.idle_bolsa_mercado set geracao = geracao + 1 where empresa = 4');
    await expect(negociar(4, 'vender', 1)).rejects.toThrow('idle_bolsa_sem_acoes');
    const b = await estado();
    expect(b.viraram_po).toEqual([{ empresa: 4, qtd: 10 }]);
    expect(b.carteira).toEqual([]);
    expect((await estado()).viraram_po).toEqual([]);
    const resp = await negociar(4, 'comprar', 0);
    expect(resp.bolsa.carteira[0].qtd).toBe(120);
  });
  it('a carteira atravessa a venda da startup', async () => {
    await negociar(1, 'comprar', 10);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    await t.rpc('idle_prestige');
    const b = await estado();
    expect(b.aberta).toBe(false);
    expect(b.carteira).toEqual([{ empresa: 1, qtd: 10, custo: 10 * 30 * 1.05 }]);
  });
  it('RPCs: membro chama idle_bolsa e negocia pelo relógio; não membro é recusado', async () => {
    // o mercado foi criado no tick 5000: sem isto o relógio de verdade faria gerar 1 dia inteiro (lento no PGlite)
    await q('update public.idle_bolsa_mercado set tick = public.idle_bolsa_agora() - 1 where true');
    const b = await t.rpc<Bolsa>('idle_bolsa');
    expect(b.empresas).toHaveLength(8);
    const resp = await t.rpc<Resp>('idle_bolsa_negociar', { p_empresa: 1, p_lado: 'comprar', p_qtd: 1, p_tick: b.tick });
    expect(resp.bolsa.carteira[0].qtd).toBe(1);
    await t.as(OUT);
    await expect(t.rpc('idle_bolsa')).rejects.toThrow('not_member');
    await expect(t.asRole('authenticated', 'select public.idle_bolsa_estado($1, 1)', [A])).rejects.toThrow();
  });
});
```

Run: `cd games && npx vitest run test/idleBolsa.test.ts`
Expected: FAIL (`idle_bolsa_negociar_em` não existe).

- [ ] **Step 2: Append to the migration**

```sql
-- ---------- carteira ----------
create table if not exists public.idle_bolsa_carteira (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  empresa int not null references public.idle_cat_bolsa (id),
  qtd     int not null check (qtd >= 0),
  custo   double precision not null check (custo >= 0),
  geracao int not null,
  primary key (user_id, empresa)
);
alter table public.idle_bolsa_carteira enable row level security;
revoke all on public.idle_bolsa_carteira from anon, authenticated;

-- o que a página precisa: mercado, histórico da hora, carteira; ações de geração antiga (empresa quebrou) saem da
-- carteira e voltam uma vez em viraram_po
create or replace function public.idle_bolsa_estado(p_user uuid, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s     public.idle_state;
  v_po  jsonb;
  v_tr  int := 0;
begin
  select * into s from public.idle_state where user_id = p_user;
  if found then
    v_tr := coalesce(s.generators[19], 0);
  end if;
  with po as (
    delete from public.idle_bolsa_carteira k
     using public.idle_bolsa_mercado m
     where k.user_id = p_user and m.empresa = k.empresa and k.geracao < m.geracao
    returning k.empresa, k.qtd
  )
  select coalesce(jsonb_agg(jsonb_build_object('empresa', empresa, 'qtd', qtd) order by empresa) filter (where qtd > 0), '[]'::jsonb)
    into v_po from po;
  return jsonb_build_object(
    'tick', p_agora,
    'vira_em_ms', greatest(0, (p_agora + 1) * 60000 - floor(extract(epoch from now()) * 1000)::bigint),
    'r', case when s.user_id is null then 0 else public.idle_rate(s) end,
    'limite', 100 + 10 * v_tr,
    'aberta', v_tr >= 1 and coalesce(s.started, false),
    'empresas', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.empresa, 'valor', m.valor,
        'risco', m.rj_ate is null and m.valor < 0.15 * c.repouso,
        'rj_ate', m.rj_ate,
        'historico', (select coalesce(jsonb_agg(p.valor order by p.tick), '[]'::jsonb) from public.idle_bolsa_precos p
                       where p.empresa = m.empresa and p.tick > p_agora - 60 and p.tick <= p_agora)
      ) order by m.empresa), '[]'::jsonb)
      from public.idle_bolsa_mercado m join public.idle_cat_bolsa c on c.id = m.empresa),
    'carteira', (
      select coalesce(jsonb_agg(jsonb_build_object('empresa', k.empresa, 'qtd', k.qtd, 'custo', k.custo) order by k.empresa), '[]'::jsonb)
        from public.idle_bolsa_carteira k where k.user_id = p_user and k.qtd > 0),
    'viraram_po', v_po);
end;
$$;

create or replace function public.idle_bolsa_negociar_em(
  p_user uuid, p_empresa int, p_lado text, p_qtd int, p_tick bigint, p_agora bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s        public.idle_state;
  c        public.idle_cat_bolsa;
  m        public.idle_bolsa_mercado;
  k        public.idle_bolsa_carteira;
  v_tem    int := 0;
  v_custo  double precision := 0;
  v_r      double precision;
  v_preco  double precision;
  v_cabe   int;
  v_n      int;
begin
  if p_tick is distinct from p_agora then
    raise exception 'idle_bolsa_preco_mudou' using errcode = 'P0001';
  end if;
  if p_lado not in ('comprar', 'vender') or p_qtd not in (0, 1, 10) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  select * into c from public.idle_cat_bolsa where id = p_empresa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_lock(p_user);
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if coalesce(s.generators[19], 0) < 1 then
    raise exception 'idle_bolsa_fechada' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  select * into m from public.idle_bolsa_mercado where empresa = p_empresa;
  if m.rj_ate is not null then
    raise exception 'idle_bolsa_rj' using errcode = 'P0001';
  end if;
  select * into k from public.idle_bolsa_carteira where user_id = p_user and empresa = p_empresa for update;
  if found and k.geracao = m.geracao then
    v_tem := k.qtd;
    v_custo := k.custo;
  end if;
  v_r := public.idle_rate(s);
  v_preco := m.valor * v_r;

  if p_lado = 'comprar' then
    v_cabe := 100 + 10 * s.generators[19] - v_tem;
    if v_cabe <= 0 or (p_qtd > 0 and p_qtd > v_cabe) then
      raise exception 'idle_bolsa_limite' using errcode = 'P0001';
    end if;
    if p_qtd = 0 then
      v_n := least(v_cabe, floor(s.valuation / (v_preco * 1.05))::int);
    else
      v_n := p_qtd;
    end if;
    if v_preco <= 0 or v_n < 1 or v_n * v_preco * 1.05 > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := greatest(s.valuation - v_n * v_preco * 1.05, 0);
    insert into public.idle_bolsa_carteira (user_id, empresa, qtd, custo, geracao)
    values (p_user, p_empresa, v_tem + v_n, v_custo + v_n * m.valor * 1.05, m.geracao)
    on conflict (user_id, empresa) do update set qtd = excluded.qtd, custo = excluded.custo, geracao = excluded.geracao;
  else
    if v_tem < 1 then
      raise exception 'idle_bolsa_sem_acoes' using errcode = 'P0001';
    end if;
    v_n := case when p_qtd = 0 then v_tem else least(p_qtd, v_tem) end;
    s.valuation := s.valuation + v_n * v_preco;
    update public.idle_bolsa_carteira
       set qtd = v_tem - v_n, custo = v_custo * (v_tem - v_n) / v_tem, geracao = m.geracao
     where user_id = p_user and empresa = p_empresa;
  end if;

  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('bolsa', public.idle_bolsa_estado(p_user, p_agora));
end;
$$;

create or replace function public.idle_bolsa()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.idle_bolsa_estado(auth.uid(), public.idle_bolsa_avancar());
end;
$$;

create or replace function public.idle_bolsa_negociar(p_empresa int, p_lado text, p_qtd int, p_tick bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  return public.idle_bolsa_negociar_em(auth.uid(), p_empresa, p_lado, p_qtd, p_tick, public.idle_bolsa_avancar());
end;
$$;

revoke all on function public.idle_bolsa_estado(uuid, bigint) from public, anon, authenticated;
revoke all on function public.idle_bolsa_negociar_em(uuid, int, text, int, bigint, bigint) from public, anon, authenticated;
revoke all on function public.idle_bolsa() from public, anon;
grant execute on function public.idle_bolsa() to authenticated;
revoke all on function public.idle_bolsa_negociar(int, text, int, bigint) from public, anon;
grant execute on function public.idle_bolsa_negociar(int, text, int, bigint) to authenticated;
```

- [ ] **Step 3: Run tests**

Run: `cd games && npx vitest run test/idleBolsa.test.ts test/migracoesUtf8.test.ts`
Expected: PASS. Se `idle_rate(s)` for 0 com 10 notebooks e 2 traders (não deve: o trader rende), aumente o `generators[1]` no `beforeEach` e registre.

- [ ] **Step 4: Commit**

```bash
cd games && npx tsc --noEmit && npx vitest run
git add ../supabase/migrations/0042_fellas_inc_bolsa.sql test/idleBolsa.test.ts
git commit -m "Fellas Inc.: Bolsa no banco, parte 3: carteira, estado da Bolsa e comprar/vender"
```

---

### Task 5: Página — tipos, API, erros, mock e as contas da tela

**Files:**
- Modify: `games/shared/types.ts`, `games/shared/api.ts`, `games/shared/errors.ts`, `games/dev/mockIdle.ts`
- Create: `games/idle/bolsa.ts`
- Test: `games/idle/bolsa.test.ts`, `games/shared/errors.test.ts` (se existir; senão o teste dos erros fica em `bolsa.test.ts`)

**Interfaces:**
- Consumes (Task 1): `EMPRESAS_BOLSA`, `BOLSA`.
- Produces:
  - em `types.ts`: `BolsaEmpresa = { id: number; valor: number; risco: boolean; rj_ate: number | null; historico: number[] }`, `BolsaPosicao = { empresa: number; qtd: number; custo: number }`, `BolsaEstado = { tick: number; vira_em_ms: number; r: number; limite: number; aberta: boolean; empresas: BolsaEmpresa[]; carteira: BolsaPosicao[]; viraram_po: { empresa: number; qtd: number }[] }`, `LadoBolsa = 'comprar' | 'vender'`;
  - em `api.ts`: `idleBolsa(): Promise<BolsaEstado>`, `idleBolsaNegociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number): Promise<IdleState & { bolsa: BolsaEstado }>`;
  - em `bolsa.ts`: `pct(x: number): string`, `variacao(historico: number[]): { minuto: number; hora: number }`, `lucro(valor: number, p: BolsaPosicao): number`, `maxCompra(valuation: number, valor: number, r: number, limite: number, tem: number): number`, `acoes(n: number): string`, `textoQuebra(rjAte: number, tick: number): string`, `avisosPo(po: { empresa: number; qtd: number }[]): string[]`, `empresa(id: number): EmpresaBolsa`.

- [ ] **Step 1: Write the failing tests**

`games/idle/bolsa.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { GameError, toGameError } from '../shared/errors';
import { acoes, avisosPo, empresa, lucro, maxCompra, pct, textoQuebra, variacao } from './bolsa';

describe('contas e textos da Bolsa', () => {
  it('porcentagem com sinal, uma casa, menos de verdade', () => {
    expect(pct(0.042)).toBe('+4,2%');
    expect(pct(-0.031)).toBe('−3,1%');
    expect(pct(0)).toBe('0%');
    expect(pct(0.31)).toBe('+31%');
  });
  it('variação no minuto e na hora pelo histórico', () => {
    expect(variacao([10, 12, 11])).toEqual({ minuto: 11 / 12 - 1, hora: 11 / 10 - 1 });
    expect(variacao([10])).toEqual({ minuto: 0, hora: 0 });
    expect(variacao([])).toEqual({ minuto: 0, hora: 0 });
  });
  it('lucro sobre o preço médio (em segundos, não muda com a produção)', () => {
    expect(lucro(33, { empresa: 1, qtd: 10, custo: 300 })).toBeCloseTo(0.1, 12);
  });
  it('Máx: o que o F$ (com a corretagem) e o limite deixam, nunca negativo', () => {
    expect(maxCompra(1000, 10, 2, 120, 0)).toBe(Math.floor(1000 / (10 * 2 * 1.05)));
    expect(maxCompra(1e12, 10, 2, 120, 100)).toBe(20);
    expect(maxCompra(1e12, 10, 2, 120, 130)).toBe(0);
    expect(maxCompra(0, 10, 2, 120, 0)).toBe(0);
  });
  it('textos', () => {
    expect(acoes(1)).toBe('1 ação');
    expect(acoes(12)).toBe('12 ações');
    expect(textoQuebra(1007, 1000)).toBe('Quebrou · volta em 7 min');
    expect(textoQuebra(1001, 1000)).toBe('Quebrou · volta em 1 min');
    expect(empresa(4).nome).toBe('Cripto do Primo');
    expect(avisosPo([{ empresa: 4, qtd: 120 }, { empresa: 6, qtd: 1 }])).toEqual([
      'Suas 120 ações da Cripto do Primo viraram pó.', 'Sua 1 ação do NFT de Meme virou pó.',
    ]);
  });
  it('erros novos do banco viram frase', () => {
    const casos: [string, string][] = [
      ['idle_bolsa_preco_mudou', 'O preço mudou, confere de novo'],
      ['idle_bolsa_rj', 'Essa empresa quebrou. Volta em alguns minutos'],
      ['idle_bolsa_limite', 'Chegou no limite de ações dessa empresa'],
      ['idle_bolsa_fechada', 'Compra 1 Grupo de trader pra abrir a Bolsa'],
      ['idle_bolsa_sem_acoes', 'Você não tem ações dessa empresa'],
    ];
    for (const [code, texto] of casos) {
      const e = toGameError({ message: code });
      expect(e).toBeInstanceOf(GameError);
      expect(e.code).toBe(code);
      expect(e.message).toBe(texto);
    }
  });
});
```

Run: `cd games && npx vitest run idle/bolsa.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement**

`games/idle/bolsa.ts`:

```ts
// Contas e textos da tela da Bolsa (puro). Quem decide preço, compra e venda é o banco (0042); aqui só se mostra.
import { BOLSA, EMPRESAS_BOLSA, type EmpresaBolsa } from './bolsaMotor';
import type { BolsaPosicao } from '../shared/types';

export const empresa = (id: number): EmpresaBolsa => EMPRESAS_BOLSA.find((e) => e.id === id)!;

/** "+4,2%", "−3,1%" (sinal de menos de verdade), "+31%" (10% ou mais sem casa), "0%". */
export function pct(x: number): string {
  if (Math.abs(x) < 0.0005) return '0%';
  const v = Math.abs(x) * 100;
  const n = (v >= 10 ? Math.round(v) : Math.round(v * 10) / 10).toLocaleString('pt-BR');
  return `${x > 0 ? '+' : '−'}${n}%`;
}

/** Variação desde o minuto anterior e desde o começo da hora (o histórico vem do mais velho pro mais novo). */
export function variacao(h: number[]): { minuto: number; hora: number } {
  if (h.length < 2) return { minuto: 0, hora: 0 };
  const ult = h[h.length - 1];
  return { minuto: ult / h[h.length - 2] - 1, hora: ult / h[0] - 1 };
}

/** Lucro em % sobre o preço médio pago (com a corretagem), em segundos de produção. */
export const lucro = (valor: number, p: BolsaPosicao): number => valor / (p.custo / p.qtd) - 1;

/** Quantas dá pra comprar agora: o F$ (com a corretagem) e o espaço no limite. */
export function maxCompra(valuation: number, valor: number, r: number, limite: number, tem: number): number {
  const unidade = valor * r * (1 + BOLSA.corretagem);
  if (unidade <= 0) return 0;
  return Math.max(0, Math.min(limite - tem, Math.floor(valuation / unidade)));
}

export const acoes = (n: number) => (n === 1 ? '1 ação' : `${n} ações`);

export const textoQuebra = (rjAte: number, tick: number) => `Quebrou · volta em ${Math.max(1, rjAte - tick)} min`;

/** "Suas 120 ações da Cripto do Primo viraram pó." (artigo do nome: "do" para NFT/Uber/Pastel/Açaí, "da" para o resto). */
const DO = new Set(['MEME', 'JEGU', 'PSTL', 'ACAI', 'COCH']);
export const avisosPo = (po: { empresa: number; qtd: number }[]): string[] =>
  po.map(({ empresa: id, qtd }) => {
    const e = empresa(id);
    const de = DO.has(e.codigo) ? 'do' : 'da';
    return qtd === 1 ? `Sua 1 ação ${de} ${e.nome} virou pó.` : `Suas ${qtd} ações ${de} ${e.nome} viraram pó.`;
  });
```

`games/shared/types.ts` — acrescente no fim:

```ts
/** Bolsa da Fellas Inc. (0042 idle_bolsa_estado). Preços em segundos de produção; em F$ = valor × r. */
export type BolsaEmpresa = { id: number; valor: number; risco: boolean; rj_ate: number | null; historico: number[] };
export type BolsaPosicao = { empresa: number; qtd: number; custo: number };
export type BolsaEstado = {
  tick: number; vira_em_ms: number; r: number; limite: number; aberta: boolean;
  empresas: BolsaEmpresa[]; carteira: BolsaPosicao[]; viraram_po: { empresa: number; qtd: number }[];
};
export type LadoBolsa = 'comprar' | 'vender';
```

`games/shared/api.ts` — acrescente `BolsaEstado` e `LadoBolsa` ao `import type {...} from './types'` e, depois de `idleBuyNode`:

```ts
export const idleBolsa = () => rpc<BolsaEstado>('idle_bolsa');
export const idleBolsaNegociar = (empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number) =>
  rpc<IdleState & { bolsa: BolsaEstado }>('idle_bolsa_negociar', { p_empresa: empresa, p_lado: lado, p_qtd: qtd, p_tick: tick });
```

`games/shared/errors.ts`: no tipo `GameErrorCode` acrescente `| 'idle_bolsa_preco_mudou' | 'idle_bolsa_rj' | 'idle_bolsa_limite' | 'idle_bolsa_fechada' | 'idle_bolsa_sem_acoes'`; em `ERROR_TEXT` acrescente:

```ts
  idle_bolsa_preco_mudou: 'O preço mudou, confere de novo',
  idle_bolsa_rj: 'Essa empresa quebrou. Volta em alguns minutos',
  idle_bolsa_limite: 'Chegou no limite de ações dessa empresa',
  idle_bolsa_fechada: 'Compra 1 Grupo de trader pra abrir a Bolsa',
  idle_bolsa_sem_acoes: 'Você não tem ações dessa empresa',
```

e na lista `FROM_DB` acrescente os cinco códigos. **Atenção à ordem:** `toGameError` acha o primeiro código contido na mensagem; nenhum código existente é prefixo destes (conferir com `grep "'idle_bolsa" shared/errors.ts`).

`games/dev/mockIdle.ts` — depois de `idleBuyNode`:

```ts
export const idleBolsa = () => call<BolsaEstado>('select public.idle_bolsa() as v');
export const idleBolsaNegociar = (empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number) =>
  call<IdleState & { bolsa: BolsaEstado }>('select public.idle_bolsa_negociar($1, $2, $3, $4) as v', [empresa, lado, qtd, tick]);
```

(acrescente `BolsaEstado`, `LadoBolsa` ao import de `../shared/types`), e a ajuda do console `__trader(n = 3)` (põe `n` Grupos de trader e F$ 1e15):

```ts
w.__trader = async (n = 3) => {
  await dono(`update public.idle_state set generators[19] = $2, generators[18] = greatest(generators[18], 1), valuation = 1e15 where user_id = $1`, [ME, n]);
  document.dispatchEvent(new Event('visibilitychange'));
};
```

(e `__trader: (n?: number) => Promise<void>;` no tipo de `w`, com a linha no comentário do console).

- [ ] **Step 3: Run tests**

Run: `cd games && npx tsc --noEmit && npx vitest run idle/bolsa.test.ts shared`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
cd games && npx vitest run
git add idle/bolsa.ts idle/bolsa.test.ts shared/types.ts shared/api.ts shared/errors.ts dev/mockIdle.ts
git commit -m "Fellas Inc.: Bolsa na página: tipos, chamadas, erros, mock e as contas da tela"
```

---

### Task 6: A tela da Bolsa e a gaveta na bancada

**Files:**
- Create: `games/idle/bolsaTela.ts`
- Test: `games/idle/bolsaTela.test.ts`
- Modify: `games/idle/tela.ts` (+ `games/idle/tela.test.ts`)

**Interfaces:**
- Consumes (Task 5): tipos, `bolsa.ts`; `formatarValor` de `./formatar`; `iconeFechar` de `./icones`.
- Produces:
  - `criarBolsaTela(a: { negociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number): void }): { elemento: HTMLElement; renderizar(b: BolsaEstado | null, valuation: number, ocupado: boolean): Precos[] }` onde `Precos = { botao: HTMLButtonElement; preco: number }` (os botões de compra, para o `atualizarValor` apagar sem F$).
  - DOM: `.bolsa` > `.bolsa-topo` (`.bolsa-titulo`, `.carteira`) + `.bolsa-miolo` > `.bolsa-lista` (`button.acao[data-empresa]`, classes `escolhida`, `quebrada`; `.etq.risco` / `.etq.rj`; `svg.mini`) + `.bolsa-detalhe` (só com uma escolhida).
  - Em `tela.ts`: `Modelo` ganha `bolsa: BolsaEstado | null` e `bolsaAberta: boolean`; `Acoes` ganha `bolsa(acao: 'abrir' | 'fechar'): void` e `negociar(empresa, lado, qtd, tick): void`. Gaveta `button.gaveta.gaveta-bolsa` (com `.trancada` sem trader). A `section.bancada` ganha a classe `com-bolsa` quando `m.bolsaAberta` (no PC o corpo mostra a Bolsa; no celular o CSS vira tela cheia) e um `.bancada-topo` (✕ "Bolsa" + valor) que só aparece no celular.

- [ ] **Step 1: Write the failing tests**

`games/idle/bolsaTela.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { BolsaEstado } from '../shared/types';
import { criarBolsaTela } from './bolsaTela';

const B = (x: Partial<BolsaEstado> = {}): BolsaEstado => ({
  tick: 1000, vira_em_ms: 42_000, r: 2, limite: 120, aberta: true,
  empresas: [
    { id: 1, valor: 33, risco: false, rj_ate: null, historico: [30, 32, 33] },
    { id: 4, valor: 2, risco: true, rj_ate: null, historico: [20, 2] },
    { id: 6, valor: 5, risco: false, rj_ate: 1007, historico: [5] },
  ],
  carteira: [{ empresa: 1, qtd: 10, custo: 300 }],
  viraram_po: [],
  ...x,
});
const negociar = vi.fn();
let tela: ReturnType<typeof criarBolsaTela>;
beforeEach(() => {
  document.body.innerHTML = '';
  negociar.mockClear();
  tela = criarBolsaTela({ negociar });
  document.body.append(tela.elemento);
});
const linha = (id: number) => document.querySelector<HTMLButtonElement>(`.acao[data-empresa="${id}"]`)!;

describe('tela da Bolsa', () => {
  it('lista: código, nome, preço em F$ (valor × r), variação na hora, ações e lucro', () => {
    tela.renderizar(B(), 1e9, false);
    const l = linha(1);
    expect(l.textContent).toContain('PSTL');
    expect(l.textContent).toContain('Pastel do Zé');
    expect(l.textContent).toContain('F$ 66');
    expect(l.textContent).toContain('+10% na hora');
    expect(l.textContent).toContain('10 ações');
    expect(l.textContent).toContain('+10% de lucro');
    expect(l.querySelector('svg.mini')).not.toBeNull();
    expect(linha(4).querySelector('.etq.risco')!.textContent).toBe('Pode quebrar');
    expect(linha(6).classList.contains('quebrada')).toBe(true);
    expect(linha(6).querySelector('.etq.rj')!.textContent).toBe('Quebrou · volta em 7 min');
  });
  it('topo: carteira e lucro em F$', () => {
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.carteira')!.textContent).toContain('F$ 660'); // 10 × 33 × 2
    expect(document.querySelector('.carteira')!.textContent).toContain('+F$ 60'); // (330 − 300) × 2
  });
  it('tocar abre o detalhe; comprar 1/10/Máx e vender 1/10/Tudo mandam o tick visto', () => {
    tela.renderizar(B(), 1e9, false);
    expect(document.querySelector('.bolsa-detalhe')).toBeNull();
    linha(1).click();
    const d = document.querySelector('.bolsa-detalhe')!;
    expect(d.textContent).toContain('preço novo em 0:42');
    expect(d.textContent).toContain('Você tem 10 de 120');
    const bts = [...d.querySelectorAll<HTMLButtonElement>('button')].map((b) => b.textContent);
    expect(bts).toEqual(['1', '10', 'Máx', '1', '10', 'Tudo']);
    [...d.querySelectorAll<HTMLButtonElement>('.comprar button')][2].click();
    [...d.querySelectorAll<HTMLButtonElement>('.vender button')][0].click();
    expect(negociar.mock.calls).toEqual([[1, 'comprar', 0, 1000], [1, 'vender', 1, 1000]]);
    linha(1).click();
    expect(document.querySelector('.bolsa-detalhe')).toBeNull();
  });
  it('apagados: ocupado, sem F$, no limite, sem ações, empresa quebrada', () => {
    tela.renderizar(B({ carteira: [{ empresa: 1, qtd: 120, custo: 3600 }] }), 1e9, false);
    linha(1).click();
    const comprar = () => [...document.querySelectorAll<HTMLButtonElement>('.comprar button')];
    expect(comprar().every((b) => b.disabled)).toBe(true); // no limite
    tela.renderizar(B(), 1e9, true);
    expect(comprar().every((b) => b.disabled)).toBe(true); // ocupado
    tela.renderizar(B({ carteira: [] }), 1e9, false);
    expect([...document.querySelectorAll<HTMLButtonElement>('.vender button')].every((b) => b.disabled)).toBe(true);
    linha(6).click();
    expect(document.querySelector('.bolsa-detalhe')!.textContent).toContain('Quebrou · volta em 7 min');
    expect(document.querySelectorAll('.bolsa-detalhe button')).toHaveLength(0);
  });
  it('devolve os preços dos botões de compra para apagar sem F$', () => {
    tela.renderizar(B(), 1e9, false);
    linha(1).click();
    const precos = tela.renderizar(B(), 1e9, false);
    expect(precos.map((p) => p.preco)).toEqual([33 * 2 * 1.05, 10 * 33 * 2 * 1.05, 33 * 2 * 1.05]);
  });
  it('sem trader: só o aviso pra abrir', () => {
    tela.renderizar(B({ aberta: false }), 1e9, false);
    expect(document.querySelector('.bolsa')!.textContent).toContain('Compra 1 Grupo de trader pra abrir a Bolsa');
    expect(document.querySelectorAll('.acao')).toHaveLength(0);
  });
  it('carregando: avisa', () => {
    tela.renderizar(null, 1e9, false);
    expect(document.querySelector('.bolsa')!.textContent).toContain('Carregando a Bolsa…');
  });
});
```

Em `games/idle/tela.test.ts`: acrescente `bolsa: null, bolsaAberta: false,` no `modelo()` e `bolsa: vi.fn<Acoes['bolsa']>(), negociar: vi.fn<Acoes['negociar']>(),` no `acoes`. Acrescente no `describe('empresa, resumo e bancada')`:

```ts
  it('gaveta Bolsa: apagada sem Grupo de trader; com trader abre a Bolsa', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const g = root.querySelector<HTMLButtonElement>('.gaveta-bolsa')!;
    expect(g.classList.contains('trancada')).toBe(true);
    expect(g.getAttribute('aria-label')).toBe('Bolsa: compra 1 Grupo de trader pra abrir');
    g.click();
    expect(acoes.bolsa).toHaveBeenCalledWith('abrir');
    const gens = [...Array(18).fill(1), 1, ...Array(11).fill(0)];
    tela.renderizar(modelo({ estado: estado({ generators: gens }) }));
    expect(root.querySelector('.gaveta-bolsa')!.classList.contains('trancada')).toBe(false);
  });
  it('Bolsa aberta: bancada com-bolsa, corpo mostra a Bolsa; ✕ fecha; Caixinha volta pra Caixinha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ bolsaAberta: true, bolsa: null }));
    const banc = root.querySelector('.bancada')!;
    expect(banc.classList.contains('com-bolsa')).toBe(true);
    expect(root.querySelector('.gaveta-corpo .bolsa')).not.toBeNull();
    expect(root.querySelector('.gaveta-bolsa')!.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.gaveta:not(.gaveta-bolsa)')!.getAttribute('aria-pressed')).toBe('false');
    root.querySelector<HTMLButtonElement>('.bancada-topo .fechar')!.click();
    expect(acoes.bolsa).toHaveBeenCalledWith('fechar');
    vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    root.querySelector<HTMLButtonElement>('.gaveta:not(.gaveta-bolsa)')!.click();
    expect(acoes.bolsa).toHaveBeenCalledWith('fechar');
    vi.restoreAllMocks();
  });
```

Run: `cd games && npx vitest run idle/bolsaTela.test.ts idle/tela.test.ts`
Expected: FAIL.

- [ ] **Step 2: Implement `games/idle/bolsaTela.ts`**

```ts
// Tela da Bolsa (lista + detalhe), em DOM puro. No PC fica no corpo da gaveta Bolsa; no celular a bancada inteira vira
// tela cheia (CSS). O detalhe aparece com uma empresa escolhida (tocar de novo fecha). Texto sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { BolsaEstado, BolsaPosicao, LadoBolsa } from '../shared/types';
import { acoes, empresa, lucro, maxCompra, pct, textoQuebra, variacao } from './bolsa';
import { BOLSA } from './bolsaMotor';
import { formatarValor } from './formatar';

const NS = 'http://www.w3.org/2000/svg';
type Precos = { botao: HTMLButtonElement; preco: number };

/** Barras da última hora; a última verde se subiu, vermelha se caiu. */
function grafico(cls: string, h: number[]) {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('class', cls);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('viewBox', `0 0 ${Math.max(1, h.length) * 2} 100`);
  svg.setAttribute('preserveAspectRatio', 'none');
  svg.setAttribute('shape-rendering', 'crispEdges');
  const max = Math.max(...h, 1e-9);
  const min = Math.min(...h, max);
  const sobe = h.length > 1 && h[h.length - 1] >= h[h.length - 2];
  h.forEach((v, i) => {
    const alt = 8 + ((v - min) / Math.max(max - min, 1e-9)) * 92;
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(i * 2));
    r.setAttribute('y', String(100 - alt));
    r.setAttribute('width', '1.6');
    r.setAttribute('height', String(alt));
    r.setAttribute('class', i === h.length - 1 ? (sobe ? 'barra sobe' : 'barra cai') : 'barra');
    svg.append(r);
  });
  return svg;
}

const classeVar = (x: number) => (x > 0.0005 ? 'sobe' : x < -0.0005 ? 'cai' : '');

export function criarBolsaTela(a: { negociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number): void }) {
  const raiz = el('div', 'bolsa');
  let escolhida: number | null = null;
  let ultimo: [BolsaEstado | null, number, boolean] | null = null;

  function renderizar(b: BolsaEstado | null, valuation: number, ocupado: boolean): Precos[] {
    ultimo = [b, valuation, ocupado];
    raiz.replaceChildren();
    if (!b) {
      raiz.append(el('p', 'vazio', 'Carregando a Bolsa…'));
      return [];
    }
    if (!b.aberta) {
      raiz.append(el('p', 'vazio', 'Compra 1 Grupo de trader pra abrir a Bolsa.'));
      return [];
    }
    const pos = (id: number): BolsaPosicao | undefined => b.carteira.find((p) => p.empresa === id);

    const topo = el('div', 'bolsa-topo');
    const valorTotal = b.carteira.reduce((s, p) => s + p.qtd * (b.empresas.find((e) => e.id === p.empresa)?.valor ?? 0), 0) * b.r;
    const lucroTotal = valorTotal - b.carteira.reduce((s, p) => s + p.custo, 0) * b.r;
    const cart = el('div', 'carteira');
    const c1 = el('span');
    c1.append('Carteira ', el('b', undefined, formatarValor(valorTotal)));
    const c2 = el('span');
    c2.append('Lucro ', el('b', classeVar(lucroTotal), `${lucroTotal >= 0 ? '+' : '−'}${formatarValor(Math.abs(lucroTotal))}`));
    cart.append(c1, c2);
    topo.append(el('h3', 'bolsa-titulo', 'Bolsa da Faria Lima'), cart);

    const lista = el('div', 'bolsa-lista');
    for (const m of b.empresas) {
      const e = empresa(m.id);
      const p = pos(m.id);
      const li = button('', `acao${escolhida === m.id ? ' escolhida' : ''}${m.rj_ate !== null ? ' quebrada' : ''}`, () => {
        escolhida = escolhida === m.id ? null : m.id;
        if (ultimo) renderizar(...ultimo);
      });
      li.dataset.empresa = String(m.id);
      li.setAttribute('aria-pressed', String(escolhida === m.id));
      const nome = el('span', 'tk', e.codigo);
      nome.append(el('small', undefined, e.nome));
      if (m.rj_ate !== null) nome.append(el('span', 'etq rj', textoQuebra(m.rj_ate, b.tick)));
      else if (m.risco) nome.append(el('span', 'etq risco', 'Pode quebrar'));
      const preco = el('span', 'preco', m.rj_ate !== null ? '—' : formatarValor(m.valor * b.r));
      const v = variacao(m.historico);
      if (m.rj_ate === null) preco.append(el('small', classeVar(v.hora), `${pct(v.hora)} na hora`));
      const tem = el('span', 'tem');
      if (p) {
        const l = lucro(m.valor, p);
        tem.append(el('b', undefined, acoes(p.qtd)), el('span', classeVar(l), `${pct(l)} de lucro`));
      } else tem.textContent = m.rj_ate !== null ? '' : 'você não tem';
      li.append(nome, m.rj_ate !== null ? el('span') : grafico('mini', m.historico.slice(-30)), preco, tem);
      lista.append(li);
    }
    const miolo = el('div', 'bolsa-miolo');
    miolo.append(lista);
    raiz.append(topo, miolo);

    const precos: Precos[] = [];
    const m = b.empresas.find((x) => x.id === escolhida);
    if (m) {
      const e = empresa(m.id);
      const p = pos(m.id);
      const tem = p?.qtd ?? 0;
      const d = el('div', 'bolsa-detalhe');
      d.setAttribute('aria-live', 'polite');
      const cab = el('div', 'cab');
      const nome = el('span', 'tk', e.codigo);
      nome.append(el('small', undefined, e.nome));
      const s = Math.ceil(b.vira_em_ms / 1000);
      cab.append(nome, el('span', 'sub', `preço novo em ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`));
      d.append(cab);
      if (m.rj_ate !== null) {
        d.append(el('p', 'sub', textoQuebra(m.rj_ate, b.tick)));
      } else {
        const v = variacao(m.historico);
        const linhaPreco = el('div', 'preco-grande');
        linhaPreco.append(el('b', undefined, formatarValor(m.valor * b.r)), el('span', classeVar(v.minuto), ` ${pct(v.minuto)} no minuto · ${pct(v.hora)} na hora`));
        d.append(linhaPreco, grafico('graf', m.historico));
        const info = el('div', 'linha2');
        const i1 = el('span');
        i1.append('Você tem ', el('b', undefined, `${tem} de ${b.limite}`));
        info.append(i1);
        if (p) {
          const i2 = el('span');
          i2.append('Pagou em média ', el('b', undefined, formatarValor((p.custo / p.qtd) * b.r)));
          info.append(i2);
        }
        d.append(info);
        if (p) {
          const l2 = el('div', 'linha2');
          const i3 = el('span');
          i3.append('Vale agora ', el('b', undefined, formatarValor(p.qtd * m.valor * b.r)));
          const l = lucro(m.valor, p);
          l2.append(i3, el('span', classeVar(l), `${pct(l)} de lucro`));
          d.append(l2);
        }
        const unidade = m.valor * b.r * (1 + BOLSA.corretagem);
        const cabe = b.limite - tem;
        const comprar = el('div', 'bts comprar');
        comprar.append(el('div', 'rot2', `Comprar (+${Math.round(BOLSA.corretagem * 100)}% de corretagem)`));
        for (const [q, n] of [[1, 1], [10, 10], [0, 1]] as const) {
          const bt = button(q === 0 ? 'Máx' : String(q), 'btn main', () => a.negociar(m.id, 'comprar', q, b.tick));
          bt.disabled = ocupado || cabe < n || maxCompra(valuation, m.valor, b.r, b.limite, tem) < n;
          precos.push({ botao: bt, preco: n * unidade });
          comprar.append(bt);
        }
        const vender = el('div', 'bts vender');
        vender.append(el('div', 'rot2', 'Vender'));
        for (const q of [1, 10, 0] as const) {
          const bt = button(q === 0 ? 'Tudo' : String(q), 'btn', () => a.negociar(m.id, 'vender', q, b.tick));
          bt.disabled = ocupado || tem < (q === 10 ? 10 : 1);
          vender.append(bt);
        }
        d.append(comprar, vender, el('p', 'aviso', 'Preço em segundos da sua produção: quando ela cresce, o F$ sobe junto.'));
      }
      miolo.append(d);
    }
    // botões apagados por F$ não entram no atualizarValor (ficariam acesos sozinhos)
    return precos.filter((x) => !x.botao.disabled || x.preco <= valuation);
  }

  return { elemento: raiz, renderizar };
}
```

**Nota sobre o retorno:** o teste "devolve os preços" espera os 3 preços de compra com F$ de sobra. O `filter` final devolve os botões apagados só por falta de F$ (para o `atualizarValor` acender quando o dinheiro chegar) e deixa de fora os apagados por limite/ocupado — se isso complicar, devolva todos e faça o `atualizarValor` respeitar `ocupado`/limite (registre a escolha no ledger).

- [ ] **Step 3: Wire into `tela.ts`**

1. Imports: `import type { BolsaEstado, LadoBolsa } from '../shared/types';` (junto do import de tipos existente) e `import { criarBolsaTela } from './bolsaTela';`.
2. `Modelo`: acrescente `/** Estado da Bolsa (null = ainda não buscou). */ bolsa: BolsaEstado | null;` e `/** Gaveta Bolsa aberta (PC: no corpo da bancada; celular: tela cheia). */ bolsaAberta: boolean;`.
3. `Acoes`: acrescente `bolsa(acao: 'abrir' | 'fechar'): void; negociar(empresa: number, lado: LadoBolsa, qtd: 0 | 1 | 10, tick: number): void;`.
4. Em `criarTela`, depois da gaveta Caixinha:

```ts
  // gaveta Bolsa (minigame 1): sem Grupo de trader fica apagada; tocar abre (o main busca o mercado)
  const gavetaBolsa = button('', 'gaveta gaveta-bolsa', () => a.bolsa('abrir'));
  const bolsaCaixa = el('span', 'gaveta-caixa');
  const iconeBolsa = el('span', 'gaveta-icone gaveta-icone-gerador');
  iconeBolsa.style.backgroundImage = `url(${ativos.gerador(19)})`;
  bolsaCaixa.append(iconeBolsa);
  gavetaBolsa.append(bolsaCaixa, el('span', 'gaveta-nome', 'Bolsa'));
  gavetas.append(gavetaBolsa);
  const bolsaTela = criarBolsaTela({ negociar: (e, l, q, t) => a.negociar(e, l, q, t) });
  // topo da Bolsa em tela cheia (só no celular, pelo CSS)
  const bancadaTopo = el('div', 'bancada-topo');
  const fecharBolsa = button('', 'fechar', () => a.bolsa('fechar'));
  fecharBolsa.setAttribute('aria-label', 'Fechar a Bolsa');
  fecharBolsa.append(iconeFechar());
  const valorBolsa = el('span', 'chip-valor');
  bancadaTopo.append(fecharBolsa, el('h2', undefined, 'Bolsa'), valorBolsa);
```

e troque `bancada.append(gavetas, corpoBancada);` por `bancada.append(bancadaTopo, gavetas, corpoBancada);`. Troque o clique da gaveta Caixinha para também fechar a Bolsa:

```ts
  const gavetaCaixa = button('', 'gaveta', () => {
    a.bolsa('fechar');
    if (!larga()) a.caixa(true); // no PC a lista já está aberta na bancada
  });
```

(remova `gavetaCaixa.setAttribute('aria-pressed', 'true');` — o `renderizar` cuida.)

5. Em `renderizar`, troque `corpoBancada.replaceChildren(...(s && jogando ? itensCaixinha(s, m) : []));` por:

```ts
    const trader = (s?.generators[18] ?? 0) >= 1; // generators[19] no banco = índice 18 aqui
    gavetaBolsa.classList.toggle('trancada', !trader);
    gavetaBolsa.setAttribute('aria-label', trader ? 'Bolsa' : 'Bolsa: compra 1 Grupo de trader pra abrir');
    gavetaBolsa.setAttribute('aria-pressed', String(m.bolsaAberta));
    gavetaCaixa.setAttribute('aria-pressed', String(!m.bolsaAberta));
    bancada.classList.toggle('com-bolsa', m.bolsaAberta && jogando);
    if (m.bolsaAberta && jogando && s) {
      const precosBolsa = bolsaTela.renderizar(trader ? m.bolsa : { ...(m.bolsa ?? VAZIA), aberta: false }, s.valuation, m.ocupado);
      precos.push(...precosBolsa);
      corpoBancada.replaceChildren(bolsaTela.elemento);
    } else {
      corpoBancada.replaceChildren(...(s && jogando ? itensCaixinha(s, m) : []));
    }
```

com, no topo do arquivo, `const VAZIA: BolsaEstado = { tick: 0, vira_em_ms: 0, r: 0, limite: 0, aberta: false, empresas: [], carteira: [], viraram_po: [] };`. E em `atualizarValor`, `valorBolsa.textContent = formatarValor(valor);` (o chip do topo da Bolsa no celular).

- [ ] **Step 4: Run tests**

Run: `cd games && npx tsc --noEmit && npx vitest run idle/bolsaTela.test.ts idle/tela.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd games && npx vitest run
git add idle/bolsaTela.ts idle/bolsaTela.test.ts idle/tela.ts idle/tela.test.ts
git commit -m "Fellas Inc.: tela da Bolsa (lista e detalhe) e a gaveta Bolsa na bancada"
```

---

### Task 7: Ligar no main (buscar, negociar, avisos), visual e conferência

**Files:**
- Modify: `games/idle/main.ts`, `games/idle/idle.css`
- Test: `games/idle/bolsaMain.test.ts` (só a lógica pura que o main usa)

**Interfaces:**
- Consumes: `api.idleBolsa`, `api.idleBolsaNegociar`, `avisosPo`, `Modelo.bolsa`/`bolsaAberta`, `Acoes.bolsa`/`negociar`.
- Produces: em `games/idle/bolsa.ts`, `proximaBusca(viraEmMs: number): number` (ms até buscar de novo: `viraEmMs + 300`, no mínimo 1000) e `RECARREGA_BOLSA = ['idle_bolsa_preco_mudou', 'idle_bolsa_rj', 'idle_bolsa_limite', 'idle_bolsa_sem_acoes', 'idle_bolsa_fechada']`.

- [ ] **Step 1: Failing test**

`games/idle/bolsaMain.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { proximaBusca, RECARREGA_BOLSA } from './bolsa';

describe('o main e a Bolsa', () => {
  it('busca de novo logo depois da virada do minuto', () => {
    expect(proximaBusca(42_000)).toBe(42_300);
    expect(proximaBusca(0)).toBe(1000);
  });
  it('recusas que pedem o mercado de novo', () => {
    expect(RECARREGA_BOLSA).toContain('idle_bolsa_preco_mudou');
    expect(RECARREGA_BOLSA).toContain('idle_bolsa_rj');
  });
});
```

Run: `cd games && npx vitest run idle/bolsaMain.test.ts` → FAIL.

- [ ] **Step 2: Implement in `bolsa.ts`**

```ts
/** Quando buscar o mercado de novo: logo depois da virada do minuto (nunca antes de 1 s). */
export const proximaBusca = (viraEmMs: number) => Math.max(1000, viraEmMs + 300);
/** Recusas da Bolsa que querem o mercado (e a carteira) de novo. */
export const RECARREGA_BOLSA = ['idle_bolsa_preco_mudou', 'idle_bolsa_rj', 'idle_bolsa_limite', 'idle_bolsa_sem_acoes', 'idle_bolsa_fechada'];
```

- [ ] **Step 3: Wire `main.ts`**

1. Acrescente `'idleBolsa' | 'idleBolsaNegociar'` ao `Pick` do `type Api`; importe `avisosPo, proximaBusca, RECARREGA_BOLSA` de `./bolsa` e `type BolsaEstado` de `../shared/types`.
2. Estado:

```ts
// Bolsa: gaveta aberta e o último mercado buscado; um temporizador busca de novo na virada do minuto enquanto aberta
let bolsaAberta = false;
let bolsa: BolsaEstado | null = null;
let timerBolsa: ReturnType<typeof setTimeout> | null = null;

async function carregarBolsa() {
  if (timerBolsa !== null) clearTimeout(timerBolsa);
  timerBolsa = null;
  const s = ancora?.estado;
  if (!bolsaAberta || !s || (s.generators[18] ?? 0) < 1) return;
  try {
    bolsa = await api.idleBolsa();
    filaAvisos.adicionar(avisosPo(bolsa.viraram_po));
    render();
  } catch {
    // sem rede: tenta de novo na próxima virada
  }
  if (bolsaAberta && !document.hidden) timerBolsa = setTimeout(() => void carregarBolsa(), proximaBusca(bolsa?.vira_em_ms ?? 60_000));
}
```

3. Ações (no objeto passado a `criarTela`):

```ts
  bolsa: (acao) => {
    bolsaAberta = acao === 'abrir';
    if (!bolsaAberta && timerBolsa !== null) clearTimeout(timerBolsa);
    render();
    if (bolsaAberta) void carregarBolsa();
  },
  negociar: (empresa, lado, qtd, tick) => void guard(async () => {
    const r = await api.idleBolsaNegociar(empresa, lado, qtd, tick);
    bolsa = r.bolsa;
    aplicar(r);
  }),
```

4. No `guard`, depois de `if (RECARREGA_PLACAR.includes(err.code)) await carregarPlacar();`: `if (RECARREGA_BOLSA.includes(err.code)) await carregarBolsa();`.
5. No `render()`, passe `bolsa, bolsaAberta` no objeto do `tela.renderizar`.
6. No listener de `visibilitychange`, quando a aba volta a ficar visível: `if (bolsaAberta) void carregarBolsa();`.
7. Depois da venda da startup (ação `vender` confirmada): `bolsaAberta = false;`.

- [ ] **Step 4: CSS (`games/idle/idle.css`)**

Acrescente antes do bloco `/* PC: ... */`:

```css
/* Bolsa (minigame 1): lista + detalhe; no celular a bancada com-bolsa vira tela cheia */
.idle .gaveta-icone-gerador { background-size: 128px 32px; }
.idle .bancada-topo { display: none; }
.idle .bancada.com-bolsa {
  position: fixed; inset: 0; z-index: 8; display: flex; flex-direction: column; padding: 0 12px 12px; background: #121212; box-shadow: none;
}
.idle .bancada.com-bolsa .bancada-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: max(8px, env(safe-area-inset-top)) 0 8px; }
.idle .bancada.com-bolsa .bancada-topo h2 { margin: 0; font: 400 24px var(--i-pixel); }
.idle .bancada.com-bolsa .gavetas { display: none; }
.idle .bancada.com-bolsa .gaveta-corpo { display: block; flex: 1; min-height: 0; overflow: auto; }
.idle .chip-valor { padding: 4px 8px; font: 400 18px var(--i-pixel); color: var(--gold); background: var(--i-painel); box-shadow: 0 0 0 2px var(--i-borda2); }
.idle .gaveta.trancada .gaveta-icone { filter: grayscale(1) brightness(0.6); }
.idle .gaveta.trancada { opacity: 0.55; }
.idle .bolsa { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
.idle .bolsa-topo { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.idle .bolsa-titulo { margin: 0; font: 400 23px var(--i-pixel); }
.idle .carteira { display: flex; gap: 14px; font-size: 13px; color: var(--i-mudo); }
.idle .carteira b { font: 400 18px var(--i-pixel); color: var(--paper); }
.idle .bolsa-miolo { display: grid; gap: 12px; min-height: 0; }
.idle .bolsa-lista { display: flex; flex-direction: column; gap: 6px; }
.idle .acao { display: grid; grid-template-columns: 104px 56px minmax(0, 1fr) auto; align-items: center; gap: 8px; padding: 6px 10px; border: 0; text-align: left; color: var(--paper); background: var(--i-linha); cursor: pointer; --c: #2A2833;
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
.idle .acao.escolhida { --c: var(--i-lilas); background: var(--i-ativo); }
.idle .acao.quebrada { opacity: 0.55; }
.idle .acao .tk, .idle .bolsa-detalhe .tk { font: 400 20px var(--i-pixel); line-height: 1; }
.idle .tk small { display: block; margin-top: 2px; font: 500 12px var(--font); color: var(--i-mudo); }
.idle .acao .preco { font: 400 20px var(--i-pixel); text-align: right; }
.idle .acao .preco small { display: block; font: 400 15px var(--i-pixel); }
.idle .acao .tem { min-width: 76px; text-align: right; font-size: 12px; color: var(--i-mudo); }
.idle .acao .tem b { display: block; font: 400 16px var(--i-pixel); color: var(--paper); }
.idle .sobe { color: var(--mint); } .idle .cai { color: #FF8F8F; }
.idle .etq { display: inline-block; margin-top: 4px; padding: 1px 6px; font: 400 14px var(--i-pixel); }
.idle .etq.risco { background: #4A1620; color: #FFB3B3; box-shadow: 0 0 0 1px #FF6B6B; }
.idle .etq.rj { background: #2C2940; color: var(--i-lilas); }
.idle svg.mini { width: 56px; height: 28px; display: block; }
.idle svg.graf { width: 100%; height: 96px; flex: none; display: block; background: var(--i-fundo2); }
.idle .barra { fill: #3B3654; } .idle .barra.sobe { fill: var(--mint); } .idle .barra.cai { fill: #FF8F8F; }
.idle .bolsa-detalhe { display: flex; flex-direction: column; gap: 10px; padding: 12px; background: var(--i-painel); --c: var(--i-borda2);
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
.idle .bolsa-detalhe .cab { display: flex; justify-content: space-between; align-items: baseline; }
.idle .bolsa-detalhe .tk { font-size: 26px; }
.idle .preco-grande b { font: 400 30px var(--i-pixel); }
.idle .linha2 { display: flex; justify-content: space-between; gap: 8px; font-size: 13px; color: var(--i-mudo); }
.idle .linha2 b { color: var(--paper); font-weight: 600; }
.idle .bts { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
.idle .bts .rot2 { grid-column: 1 / -1; margin-bottom: -4px; font: 400 16px var(--i-pixel); color: var(--i-mudo); }
.idle .bts .btn { flex: none; }
.idle .bolsa-detalhe .aviso { margin: 0; font-size: 12px; color: var(--i-mudo); }
/* celular: o detalhe sobe como cartão por cima da lista */
.idle .bancada.com-bolsa .bolsa-detalhe { position: sticky; bottom: 0; box-shadow: 0 -2px 0 0 var(--i-borda2), 0 -12px 30px rgba(0, 0, 0, 0.5); }
```

E dentro do bloco `@media (min-width: 1100px)`:

```css
  .idle .bancada.com-bolsa { position: static; z-index: auto; padding: 0; background: var(--i-painel); --c: var(--i-borda); box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
  .idle .bancada.com-bolsa .bancada-topo { display: none; }
  .idle .bancada.com-bolsa .gavetas { display: flex; }
  .idle .bancada.com-bolsa .gaveta-corpo { padding: 10px 14px 14px; overflow: hidden; }
  .idle .bolsa { height: 100%; }
  .idle .bolsa-miolo { grid-template-columns: minmax(0, 1fr) 300px; flex: 1; min-height: 0; }
  .idle .bolsa-lista { overflow: auto; min-height: 0; padding: 2px; }
  .idle .bolsa-detalhe { overflow: auto; position: static; }
```

- [ ] **Step 5: Run everything**

Run: `cd games && npx tsc --noEmit && npx vitest run && npx vite build` e na raiz `npx tsc --noEmit && npx jest`.
Expected: tudo verde.

- [ ] **Step 6: Commit**

```bash
git add games/idle/main.ts games/idle/bolsa.ts games/idle/bolsaMain.test.ts games/idle/idle.css
git commit -m "Fellas Inc.: Bolsa ligada no jogo (buscar na virada do minuto, comprar/vender, avisos) e o visual"
```

- [ ] **Step 7: Conferência visual (controlador)**

`cd games && npx vite --port 5199` e `http://localhost:5199/games/idle/?mock`. No console: abrir o CNPJ, `__trader(3)`. Conferir em 390 × 844, 844 × 390 e 1280 × 800:
- gaveta Bolsa (apagada antes do `__trader`, acesa depois);
- lista com as 8, minigráfico, etiquetas (forçar no console: `update public.idle_bolsa_mercado set valor = 1 where empresa = 4` via `dono`);
- detalhe: comprar 1, 10, Máx; vender 1, Tudo; lucro mudando; "preço novo em" contando;
- virada do minuto: os preços mudam sozinhos;
- celular: tela cheia, ✕ fecha, detalhe como cartão.
Corrigir num commit `Fellas Inc.: ajustes da conferência visual da Bolsa`.

## Publicação (fora do plano de tarefas)

Merge local na main; o Juan roda `npx supabase db push` (0042); eu confiro pela leitura (`idle_cat_bolsa` com 8, `idle_bolsa()` e `idle_bolsa_negociar` respondendo 401 sem login, não 404) e só então `git push`.
