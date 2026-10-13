# Fellas Inc.: Mapa do rolê, parte 1 (moldura) — Implementation Plan

> **Renumeração (13/10):** as migrações deste plano viraram 0065 (catálogo, era 0056), 0066 (moldura, era 0057), 0067 (camisetaria, era 0058) e 0068 (copão, era 0059), depois da 0060–0064 da main. O texto abaixo é histórico e segue com os números antigos.

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A base comum dos 9 lugares do Mapa do rolê: abrir lugar com F$, moeda/nível/fãs por lugar, marcos que somam
produção na empresa, desafio da semana, placar da semana com dono do pedaço, pódio de sempre, caderninho, a tela do mapa
e a moldura da tela de cada lugar, com espaço para a mecânica que as partes 2 a 4 encaixam.

**Architecture:** O banco decide tudo (0056 catálogo gerado com as estratégias e 4 conquistas novas; 0057 a moldura).
Os dados de verdade dos lugares (nome, frase, ícone, mapa) ficam em tabelas privadas carregadas por um SQL fora do
repositório. As contas puras ficam em `games/idle/mapa.ts` (paridade com o banco); a tela em `mapaTela.ts` (o mapa) e
`lugarTela.ts` (a moldura de um lugar), com um registro `MECANICAS` que as partes 2 a 4 preenchem. Mesmo padrão da
Horta (0047/0048) e dos Convidados (0050/0051).

**Tech Stack:** Postgres/Supabase (plpgsql), PGlite nos testes, TypeScript + DOM puro, vitest (happy-dom), Node (gerador do
SQL privado, fora do repo).

**Spec:** `docs/superpowers/specs/2026-10-12-fellas-inc-mapa-do-role-design.md` (seções 1, 2, 3, 7 e 8). As partes 2
(camisetaria), 3 (copão) e 4 (jantar) têm planos próprios e usam o que este produz.

## Global Constraints

- **Privacidade:** nenhum nome real de lugar em código, teste, migração, commit, comentário ou plano. No repo os lugares
  são `1..9` e os apelidos: 1 o samba, 2 o casarão, 3 a camisetaria, 4 o copão, 5 a loja 24h, 6 a sinuca, 7 o jantar,
  8 a massa-mãe, 9 o corredor. Nome/frase/ícone/mapa/posição só nas tabelas `idle_places` e `idle_map` (select só para
  membros), carregadas por `../fellas-inc-esbocos/lugares/carregar.sql` (fora do repo).
- **Branch:** tudo num worktree `../fellasapp-mapa` no branch `mapa-do-role`. **Não fazer merge nem push na main neste
  plano**: o lote 1 é publicado junto, no fim da parte 4 (push na main publica o site).
- Migrações: `0056_fellas_inc_catalogo_mapa.sql` (gerada com `ATUALIZAR_CATALOGO`) e `0057_fellas_inc_mapa.sql`. Ambas
  entram em `games/test/db.ts` e `games/dev/mockDb.ts`, nessa ordem, depois da 0055.
- Faixas: barato 2 h de produção (era 2+), médio 6 h (era 3+), caro 16 h (era 4+). Preço = `horas × 3600 × F$/s atual`,
  sem meia-preço, Promoção, Horta nem convidados.
- Nível 1 a 25; subir do nível n para n+1 custa `custo_base × 1,55^(n−1)` na moeda do lugar.
- Marcos (8 por lugar com mecânica): nível 5 +2%, 10 +2%, 15 +3%, 20 +3%, 25 +4%, lendário +3%, fãs +3%, volume +2%.
  `mult_mapa = 1 + (Σ bônus) × (2 com Monopólio, senão 1) + 0,05 × lugares abertos (só com Marca forte)`.
- Desafio da semana: um por lugar, o mesmo para todos; prêmio `horas` (F$ de N h de produção), `legado` (N pontos do
  Legado) ou `investidor` (20 min de produção). Uma vez por semana por lugar.
- Pódio: 3 melhores de sempre do grupo por lugar, **uma vez por pessoa** (a melhor dela), empate = quem chegou primeiro.
- Nome de produção: 1 a 30 caracteres depois do `trim`, sem quebra de linha.
- Vender a startup não mexe em nada do mapa.
- "Sem você, no máximo um ciclo": a moldura guarda `idle_state.visto_em` (a última chamada que passou por `idle_lock`);
  as mecânicas leem o valor **antes** de ele ser atualizado.
- Texto na tela no tom do `PRODUCT.md`, pt-BR; tokens/fonte do jogo (`idle.css`), Jersey 10, cantos de pixel.
- Caixinha de informação (`dica.ts` monta, `dicaTela.ts` mostra; mouse e teclado, no celular não): pino fechado,
  marcos, desafio, botão de nível. Não entra no pódio.
- Supabase safeupdate: todo UPDATE/DELETE com WHERE. Commits sem coautoria. O Juan roda o `db push`.
- Suíte dos jogos: `npx vitest run --maxWorkers=4` (em `games/`). Raiz: `npx tsc --noEmit` e `npm test`.

## Review Focus

1. Pessoa que nunca abriu a Fellas Inc. (sem linha em `idle_state`) chamando `idle_mapa`/`idle_lugar`: responde com
   tudo fechado, sem erro e sem criar linha errada.
2. Tabelas privadas vazias (o Juan ainda não rodou o `carregar.sql`) ou o `?mock`: a tela mostra "Lugar N", pino
   genérico e o mapa de mentira, sem quebrar.
3. Pódio com a mesma pessoa em 1º e 2º pelo valor: só a melhor dela aparece e o 4º sobe; empate exato fica com quem fez
   antes.
4. Abrir lugar com valuation exatamente igual ao preço (passa); sem empresa aberta (`idle_not_started`); com F$/s
   zero o preço seria 0 e recusa com `idle_cant_afford` (lugar de graça não existe).
5. Virada da semana: a foto do dono do pedaço sai uma vez só por lugar mesmo com o cron e o `idle_lock` disputando; um
   lugar sem produção na semana não grava dono.

---

### Task 0: worktree e branch

**Files:** nenhum no repo.

- [ ] **Step 1:** Na pasta principal, conferir `git status` (mudança que não é sua = outra sessão: não mexer).
- [ ] **Step 2:** Criar o worktree e preparar:

```powershell
git worktree add ../fellasapp-mapa -b mapa-do-role
Copy-Item .env ../fellasapp-mapa/.env
Copy-Item -Recurse supabase/.temp ../fellasapp-mapa/supabase/.temp
New-Item -ItemType Junction -Path ../fellasapp-mapa/node_modules -Target (Resolve-Path node_modules)
cd ../fellasapp-mapa/games; npm ci
```

- [ ] **Step 3:** `npx vitest run --maxWorkers=4` em `../fellasapp-mapa/games` passa antes de mudar nada.

Daqui em diante, todo caminho é relativo a `../fellasapp-mapa`.

---

### Task 1: `mapa.ts` (catálogo dos lugares e contas puras)

**Files:**
- Create: `games/idle/mapa.ts`
- Test: `games/idle/mapa.test.ts`

**Interfaces — Produces:**

```ts
export type Faixa = 'barato' | 'medio' | 'caro';
export type TipoMarco = 'nivel' | 'lendario' | 'fas' | 'volume';
export type Marco = { id: number; lugar: number; tipo: TipoMarco; valor: number | null; bonus: number };
export type Lugar = {
  id: number; apelido: string; faixa: Faixa; horas: number; era: number; lote: number;
  custoBase: number; moeda: string | null; /** como o número do pódio aparece */ numero: 'pct' | 'nota' | 'estrelas' | null;
};
export const LOTE_ATUAL = 1;
export const NIVEL_MAX = 25;
export const LUGARES: readonly Lugar[];          // ids 1..9, na ordem da spec
export const MARCOS: readonly Marco[];           // 8 por lugar do lote 1 (3, 4, 7); id = lugar*10 + k (k 1..8)
export const lancado: (l: Lugar) => boolean;     // l.lote <= LOTE_ATUAL
export function precoAbrir(l: Lugar, taxa: number): number;          // l.horas * 3600 * taxa
export function custoNivel(l: Lugar, nivel: number): number | null;  // de nivel para nivel+1; null no 25
export function multMapa(bonusMarcos: number, abertos: number, est: { marcosMult: number; porLugar: number }): number;
export function semanaIdx(lugar: number, sal: number, n: number, semana: string): number; // semana = 'YYYY-MM-DD' (segunda)
export function nomeValido(nome: string): string | null;             // trim; null se inválido
export function formatarNumero(l: Lugar, n: number): string;          // '230%' | '742' | '4,4'
/** Posição genérica do pino quando o banco não tem a de verdade (mock, ou antes do carregar.sql): grade 3×3. */
export function posicaoGenerica(id: number): { x: number; y: number };
```

Valores do catálogo (copiar exatamente):

```ts
export const LUGARES: readonly Lugar[] = [
  { id: 1, apelido: 'o samba', faixa: 'barato', horas: 2, era: 2, lote: 2, custoBase: 100, moeda: null, numero: null },
  { id: 2, apelido: 'o casarão', faixa: 'barato', horas: 2, era: 2, lote: 2, custoBase: 100, moeda: null, numero: null },
  { id: 3, apelido: 'a camisetaria', faixa: 'barato', horas: 2, era: 2, lote: 1, custoBase: 100, moeda: 'cupom', numero: 'pct' },
  { id: 4, apelido: 'o copão', faixa: 'medio', horas: 6, era: 3, lote: 1, custoBase: 150, moeda: 'ficha', numero: 'nota' },
  { id: 5, apelido: 'a loja 24h', faixa: 'medio', horas: 6, era: 3, lote: 2, custoBase: 150, moeda: null, numero: null },
  { id: 6, apelido: 'a sinuca', faixa: 'medio', horas: 6, era: 3, lote: 3, custoBase: 150, moeda: null, numero: null },
  { id: 7, apelido: 'o jantar', faixa: 'caro', horas: 16, era: 4, lote: 1, custoBase: 250, moeda: 'gorjeta', numero: 'estrelas' },
  { id: 8, apelido: 'a massa-mãe', faixa: 'caro', horas: 16, era: 4, lote: 3, custoBase: 250, moeda: null, numero: null },
  { id: 9, apelido: 'o corredor', faixa: 'caro', horas: 16, era: 4, lote: 3, custoBase: 250, moeda: null, numero: null },
];
const BONUS = [0.02, 0.02, 0.03, 0.03, 0.04, 0.03, 0.03, 0.02];
const LIMIARES: Record<number, { fas: number; volume: number }> = { 3: { fas: 10_000, volume: 50 }, 4: { fas: 5_000, volume: 30 }, 7: { fas: 2_000, volume: 100 } };
export const MARCOS: readonly Marco[] = Object.entries(LIMIARES).flatMap(([lugarTxt, lim]) => {
  const lugar = Number(lugarTxt);
  const tipos: [TipoMarco, number | null][] = [['nivel', 5], ['nivel', 10], ['nivel', 15], ['nivel', 20], ['nivel', 25], ['lendario', null], ['fas', lim.fas], ['volume', lim.volume]];
  return tipos.map(([tipo, valor], k) => ({ id: lugar * 10 + k + 1, lugar, tipo, valor, bonus: BONUS[k] }));
});
```

`semanaIdx`: `w = (dias entre '2026-01-05' e semana) / 7` (inteiro); `h = (w*2654435761 + lugar*40503 + sal*97) mod 4294967296`;
devolve `h mod n` (n ≥ 1). Usar `Number` (cabe em 2^53) e `Date.UTC` para os dias.

`posicaoGenerica(id)`: `{ x: 30 + ((id - 1) % 3) * 50, y: 18 + Math.floor((id - 1) / 3) * 30 }`.

`formatarNumero`: `pct` → `${Math.round(n)}%`; `nota` → `String(Math.round(n))`; `estrelas` → uma casa com vírgula
(`n.toFixed(1).replace('.', ',')`); `null` → `String(n)`.

- [ ] **Step 1: Write the failing test** (`games/idle/mapa.test.ts`):

```ts
import { describe, expect, it } from 'vitest';
import { LUGARES, MARCOS, custoNivel, formatarNumero, lancado, multMapa, nomeValido, posicaoGenerica, precoAbrir, semanaIdx } from './mapa';

describe('lugares', () => {
  it('9 lugares, 3 lançados no lote 1 (camisetaria, copão, jantar)', () => {
    expect(LUGARES.map((l) => l.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
    expect(LUGARES.filter(lancado).map((l) => l.id)).toEqual([3, 4, 7]);
  });
  it('faixas: barato 2 h era 2, médio 6 h era 3, caro 16 h era 4', () => {
    for (const l of LUGARES) expect([l.horas, l.era]).toEqual({ barato: [2, 2], medio: [6, 3], caro: [16, 4] }[l.faixa]);
  });
  it('preço de abrir = horas da produção', () => {
    expect(precoAbrir(LUGARES[2], 10)).toBe(72_000);
    expect(precoAbrir(LUGARES[6], 1)).toBe(57_600);
  });
});

describe('nível e marcos', () => {
  it('custo do nível sobe 55% e para no 25', () => {
    expect(custoNivel(LUGARES[2], 1)).toBe(100);
    expect(custoNivel(LUGARES[2], 2)).toBeCloseTo(155);
    expect(custoNivel(LUGARES[2], 24)).toBeCloseTo(100 * 1.55 ** 23);
    expect(custoNivel(LUGARES[2], 25)).toBeNull();
  });
  it('8 marcos por lugar do lote 1, somando 22%', () => {
    for (const id of [3, 4, 7]) {
      const ms = MARCOS.filter((m) => m.lugar === id);
      expect(ms.map((m) => m.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8].map((k) => id * 10 + k));
      expect(ms.reduce((a, m) => a + m.bonus, 0)).toBeCloseTo(0.22);
    }
  });
  it('mult do mapa: marcos, Monopólio dobra, Marca forte +5% por lugar', () => {
    expect(multMapa(0.07, 2, { marcosMult: 1, porLugar: 0 })).toBeCloseTo(1.07);
    expect(multMapa(0.07, 2, { marcosMult: 2, porLugar: 0 })).toBeCloseTo(1.14);
    expect(multMapa(0.07, 2, { marcosMult: 1, porLugar: 0.05 })).toBeCloseTo(1.17);
    expect(multMapa(0, 0, { marcosMult: 2, porLugar: 0.05 })).toBe(1);
  });
});

describe('semana, nome, número', () => {
  it('semanaIdx é estável, fica em [0, n) e muda com a semana', () => {
    const a = semanaIdx(3, 0, 12, '2026-10-12');
    expect(a).toBe(semanaIdx(3, 0, 12, '2026-10-12'));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThan(12);
    const semanas = ['2026-10-12', '2026-10-19', '2026-10-26', '2026-11-02', '2026-11-09'].map((s) => semanaIdx(3, 0, 12, s));
    expect(new Set(semanas).size).toBeGreaterThan(1);
  });
  it('nome: trim, 1 a 30, sem quebra de linha', () => {
    expect(nomeValido('  Camisa do Luis  ')).toBe('Camisa do Luis');
    expect(nomeValido('   ')).toBeNull();
    expect(nomeValido('a'.repeat(31))).toBeNull();
    expect(nomeValido('a'.repeat(30))).toBe('a'.repeat(30));
    expect(nomeValido('duas\nlinhas')).toBeNull();
  });
  it('número do pódio de cada lugar', () => {
    expect(formatarNumero(LUGARES[2], 230.4)).toBe('230%');
    expect(formatarNumero(LUGARES[3], 741.6)).toBe('742');
    expect(formatarNumero(LUGARES[6], 4.4)).toBe('4,4');
  });
  it('posição genérica fica dentro do mapa 160×96', () => {
    for (const l of LUGARES) {
      const p = posicaoGenerica(l.id);
      expect(p.x).toBeGreaterThan(5); expect(p.x).toBeLessThan(155);
      expect(p.y).toBeGreaterThan(5); expect(p.y).toBeLessThan(91);
    }
  });
});
```

- [ ] **Step 2:** `npx vitest run idle/mapa.test.ts` (em `games/`) → FAIL (módulo não existe).
- [ ] **Step 3:** Implementar `mapa.ts` com o catálogo e as funções acima (comentário de cabeçalho no estilo de
      `horta.ts`: o que é e que o banco decide; sem nome real de lugar).
- [ ] **Step 4:** O teste passa.
- [ ] **Step 5:** `git commit -m "Fellas Inc.: mapa.ts (os 9 lugares, marcos e contas do Mapa do rolê)"`

---

### Task 2: catálogo 0056 (estratégias e as 4 conquistas da moldura)

**Files:**
- Modify: `games/idle/nomes.ts` (estratégias 2·2, 3·2, 4·1; tipo `TipoConquista`; 4 conquistas), `games/idle/catalogo.ts`
  (tipo de `requer`)
- Create: `supabase/migrations/0056_fellas_inc_catalogo_mapa.sql` (gerada)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts`, `games/test/idleConquistas.test.ts` (se ele lista ids/tipos)

**Interfaces — Produces:** tipos de conquista `'mapa_abriu' | 'mapa_dono' | 'mapa_podio'`; sociais das estratégias
`{ porLugar: 0.05 }` (Marca forte) e `{ marcosMult: 2 }` (Monopólio); `requer: 'contratos' | 'lugares' | null`.

Mudanças em `nomes.ts` (estratégias):

```ts
{ era: 2, opcao: 2, nome: 'Networking', frase: 'Contratos valem o dobro.', requer: 'contratos', sociais: { contratoEfeitoMult: 2 } },
{ era: 3, opcao: 2, nome: 'Marca forte', frase: '+5% de produção por lugar aberto no Mapa do rolê.', requer: 'lugares', sociais: { porLugar: 0.05 } },
{ era: 4, opcao: 1, nome: 'Monopólio', frase: 'Os marcos dos seus lugares valem o dobro.', requer: 'lugares', sociais: { marcosMult: 2 } },
```

(As duas últimas perdem o `ativa: false`. Conferir que nada mais lê `propriedadeEfeitoMult`, `porPropriedade`,
`propriedadeBeneficioMult` ou `tomarCustoMult`: `grep -rn` em `games/` e `supabase/migrations/0056*`; o SQL antigo não
lê.)

Conquistas novas (ids visíveis livres a partir de 83):

```ts
{ id: 83, tipo: 'mapa_abriu', valor: 1, nome: 'Rolê marcado', frase: 'Saiu de casa. Pelo jogo, mas saiu.', condicao: 'Abrir o primeiro lugar do Mapa do rolê' },
{ id: 84, tipo: 'mapa_abriu', valor: 3, nome: 'Conhece a cidade', frase: 'Três lugares e nenhum convite pro aniversário.', condicao: 'Abrir 3 lugares do Mapa do rolê' },
{ id: 85, tipo: 'mapa_dono', nome: 'Dono do pedaço', frase: 'Uma semana mandando no pedaço. Ninguém respeitou.', condicao: 'Ser o 1º da semana em algum lugar' },
{ id: 86, tipo: 'mapa_podio', nome: 'Tá no pódio', frase: 'Foto na parede. Ninguém olha, mas tá lá.', condicao: 'Entrar no pódio de algum lugar' },
```

(As frases ficam assim até o Juan revisar no fim do lote; o teste de paridade de `idleConquistas.test.ts` compara com o banco.)

- [ ] **Step 1:** Aplicar as mudanças em `nomes.ts` e o tipo de `requer` em `catalogo.ts`.
- [ ] **Step 2:** Gerar: em `games/`, `$env:ATUALIZAR_CATALOGO='0056_fellas_inc_catalogo_mapa.sql'; npx vitest run idle/catalogo.test.ts; Remove-Item Env:ATUALIZAR_CATALOGO`.
- [ ] **Step 3:** Acrescentar `'0056_fellas_inc_catalogo_mapa.sql'` em `MIGRATIONS` (`games/test/db.ts`) e o import
      `m56` na lista de `games/dev/mockDb.ts`.
- [ ] **Step 4:** `npx vitest run idle/catalogo.test.ts test/idleConquistas.test.ts test/idleParidade.test.ts` passa
      (conferir que `estrategia_todas` agora pede as duas ligadas: ajustar o teste que contava as ligadas, se houver).
- [ ] **Step 5:** `git commit -m "Fellas Inc.: catálogo 0056 (Marca forte e Monopólio pelos lugares, 4 conquistas do Mapa do rolê)"`

---

### Task 3: 0057, parte A (tabelas, catálogo do mapa, abrir, `idle_mapa`)

**Files:**
- Create: `supabase/migrations/0057_fellas_inc_mapa.sql`
- Create: `games/test/idleMapa.test.ts`
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (0057 depois da 0056)

**Interfaces — Produces (SQL):**
- Tabelas: `idle_cat_place`, `idle_cat_place_marco`, `idle_cat_place_desafio` (vazia nesta parte), `idle_places`,
  `idle_map`, `idle_place_state`, `idle_place_prod`, `idle_place_notes`, `idle_place_challenges`, `idle_place_weeks`;
  coluna `idle_state.visto_em`.
- `idle_place_abrir(p_lugar int) → jsonb` (o `idle_json` + `'mapa', idle_mapa_json(s)`).
- `idle_mapa() → jsonb` e a interna `idle_mapa_json(s idle_state) → jsonb`.
- Erros novos: `idle_lugar_aberto`, `idle_lugar_fechado`, `idle_lugar_nome`, `idle_lugar_moeda`, `idle_lugar_nivel_max`.
  Reaproveita `idle_locked` (era/lote), `idle_cant_afford`, `idle_bad_choice`, `idle_not_started`.

SQL (começo do arquivo; as partes B e C acrescentam no fim):

```sql
-- fellasapp: Fellas Inc., Mapa do rolê, a moldura (spec 2026-10-12-fellas-inc-mapa-do-role-design.md).
-- Os lugares de verdade (nome, frase, ícone, mapa, posição) NÃO estão aqui: entram por um SQL fora do repositório.
-- Depende da 0056 (estratégias Marca forte/Monopólio e as conquistas mapa_*).

-- ===== catálogo (igual a games/idle/mapa.ts; teste de paridade em idleMapa.test.ts) =====
create table if not exists public.idle_cat_place (
  id int primary key, faixa text not null, horas double precision not null, era int not null, lote int not null,
  lancado boolean not null, custo_base double precision not null, moeda text, numero text
);
create table if not exists public.idle_cat_place_marco (
  id int primary key, lugar int not null, tipo text not null check (tipo in ('nivel', 'lendario', 'fas', 'volume')),
  valor double precision, bonus double precision not null
);
create table if not exists public.idle_cat_place_desafio (
  id int primary key, lugar int not null, tipo text not null, valor double precision, texto text not null,
  premio text not null check (premio in ('horas', 'legado', 'investidor')), premio_valor double precision not null
);
alter table public.idle_cat_place enable row level security;
alter table public.idle_cat_place_marco enable row level security;
alter table public.idle_cat_place_desafio enable row level security;
revoke all on public.idle_cat_place, public.idle_cat_place_marco, public.idle_cat_place_desafio from anon, authenticated;
delete from public.idle_cat_place where true;
delete from public.idle_cat_place_marco where true;
insert into public.idle_cat_place (id, faixa, horas, era, lote, lancado, custo_base, moeda, numero) values
  (1, 'barato', 2, 2, 2, false, 100, null, null),
  (2, 'barato', 2, 2, 2, false, 100, null, null),
  (3, 'barato', 2, 2, 1, true, 100, 'cupom', 'pct'),
  (4, 'medio', 6, 3, 1, true, 150, 'ficha', 'nota'),
  (5, 'medio', 6, 3, 2, false, 150, null, null),
  (6, 'medio', 6, 3, 3, false, 150, null, null),
  (7, 'caro', 16, 4, 1, true, 250, 'gorjeta', 'estrelas'),
  (8, 'caro', 16, 4, 3, false, 250, null, null),
  (9, 'caro', 16, 4, 3, false, 250, null, null);
insert into public.idle_cat_place_marco (id, lugar, tipo, valor, bonus) values
  (31, 3, 'nivel', 5, 0.02), (32, 3, 'nivel', 10, 0.02), (33, 3, 'nivel', 15, 0.03), (34, 3, 'nivel', 20, 0.03),
  (35, 3, 'nivel', 25, 0.04), (36, 3, 'lendario', null, 0.03), (37, 3, 'fas', 10000, 0.03), (38, 3, 'volume', 50, 0.02),
  (41, 4, 'nivel', 5, 0.02), (42, 4, 'nivel', 10, 0.02), (43, 4, 'nivel', 15, 0.03), (44, 4, 'nivel', 20, 0.03),
  (45, 4, 'nivel', 25, 0.04), (46, 4, 'lendario', null, 0.03), (47, 4, 'fas', 5000, 0.03), (48, 4, 'volume', 30, 0.02),
  (71, 7, 'nivel', 5, 0.02), (72, 7, 'nivel', 10, 0.02), (73, 7, 'nivel', 15, 0.03), (74, 7, 'nivel', 20, 0.03),
  (75, 7, 'nivel', 25, 0.04), (76, 7, 'lendario', null, 0.03), (77, 7, 'fas', 2000, 0.03), (78, 7, 'volume', 100, 0.02);

-- ===== privados (só membros; carregados fora do repositório) =====
create table if not exists public.idle_places (
  id int primary key check (id between 1 and 9), nome text not null, frase text not null default '',
  icone text, x int not null, y int not null
);
create table if not exists public.idle_map (id int primary key default 1 check (id = 1), png text not null);
alter table public.idle_places enable row level security;
alter table public.idle_map enable row level security;
revoke all on public.idle_places, public.idle_map from anon, authenticated;
grant select on public.idle_places, public.idle_map to authenticated;
drop policy if exists "idle_places_select_members" on public.idle_places;
create policy "idle_places_select_members" on public.idle_places for select to authenticated using (public.is_member());
drop policy if exists "idle_map_select_members" on public.idle_map;
create policy "idle_map_select_members" on public.idle_map for select to authenticated using (public.is_member());

-- ===== estado (só pelas funções) =====
create table if not exists public.idle_place_state (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, aberto_em timestamptz not null default now(),
  moeda double precision not null default 0, nivel int not null default 1 check (nivel between 1 and 25),
  fas double precision not null default 0, volume int not null default 0, lendario boolean not null default false,
  marcos int[] not null default '{}', avancado_em timestamptz not null default now(),
  primary key (user_id, lugar)
);
create table if not exists public.idle_place_prod (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, nome text not null, partes int[] not null, numero double precision not null,
  criado_em timestamptz not null default now()
);
create index if not exists idle_place_prod_rank on public.idle_place_prod (lugar, numero desc, criado_em, id);
create table if not exists public.idle_place_notes (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, tipo text not null, a int not null, b int not null default 0, rotulo int not null,
  primary key (user_id, lugar, tipo, a, b)
);
create table if not exists public.idle_place_challenges (
  user_id uuid not null references public.idle_state (user_id) on delete cascade,
  lugar int not null, week_start date not null, desafio int not null, primary key (user_id, lugar, week_start)
);
create table if not exists public.idle_place_weeks (
  week_start date not null, lugar int not null, dono_id uuid, numero double precision, primary key (week_start, lugar)
);
alter table public.idle_place_state enable row level security;
alter table public.idle_place_prod enable row level security;
alter table public.idle_place_notes enable row level security;
alter table public.idle_place_challenges enable row level security;
alter table public.idle_place_weeks enable row level security;
revoke all on public.idle_place_state, public.idle_place_prod, public.idle_place_notes, public.idle_place_challenges,
  public.idle_place_weeks from anon, authenticated;
alter table public.idle_state add column if not exists visto_em timestamptz;
```

Funções desta parte:

```sql
-- quantos lugares abertos e o JSON do mapa (pinos). Sem linha em idle_state: tudo fechado.
create or replace function public.idle_mapa_json(s public.idle_state)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'mapa', (select m.png from public.idle_map m where m.id = 1),
    'lugares', (select jsonb_agg(jsonb_build_object(
        'id', c.id, 'faixa', c.faixa, 'lote', c.lote, 'lancado', c.lancado, 'horas', c.horas, 'era', c.era,
        'moeda', c.moeda, 'numero', c.numero,
        'preco', c.horas * 3600 * coalesce(public.idle_rate(s), 0),
        'nome', p.nome, 'frase', p.frase, 'icone', p.icone, 'x', p.x, 'y', p.y,
        'aberto', st.lugar is not null, 'nivel', st.nivel, 'moeda_qtd', st.moeda, 'fas', st.fas,
        'dono', (select jsonb_build_object('user_id', w.dono_id, 'avatar', public.idle_avatar_json(w.dono_id))
                   from public.idle_place_weeks w
                  where w.lugar = c.id and w.week_start = public.games_week_start() - 7 and w.dono_id is not null))
        order by c.id)
      from public.idle_cat_place c
      left join public.idle_places p on p.id = c.id
      left join public.idle_place_state st on st.user_id = s.user_id and st.lugar = c.id),
    'mult', public.idle_place_mult(s))
$$;
```

(`idle_place_mult` nasce na parte B; nesta parte criar uma versão provisória `returns double precision ... select 1::double precision`
com o mesmo nome e assinatura `(s public.idle_state)`, que a parte B substitui. **Ela vem antes de `idle_mapa_json` no
arquivo**: função `language sql` é conferida ao ser criada e falha se a que ela chama ainda não existe. A mesma regra vale
na parte C para `idle_lugar_json`, que vem depois de `idle_place_podio`, `idle_place_semana`,
`idle_place_desafio_da_semana` e `idle_place_mecanica_json`.)

```sql
create or replace function public.idle_mapa()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into s from public.idle_state where user_id = auth.uid();
  if not found or not s.started then
    s.user_id := auth.uid(); -- sem empresa: pinos fechados, preço 0
    return public.idle_mapa_json(s);
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_mapa_json(s);
end;
$$;

create or replace function public.idle_place_abrir(p_lugar int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  c       public.idle_cat_place;
  v_preco double precision;
  v_n     int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select * into c from public.idle_cat_place where id = p_lugar;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if not c.lancado or public.idle_era(s.generators) < c.era then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_place_state where user_id = s.user_id and lugar = p_lugar) then
    raise exception 'idle_lugar_aberto' using errcode = 'P0001';
  end if;
  v_preco := c.horas * 3600 * public.idle_rate(s);
  if v_preco <= 0 or s.valuation < v_preco then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := s.valuation - v_preco;
  perform public.idle_save(s);
  insert into public.idle_place_state (user_id, lugar) values (s.user_id, p_lugar);
  select count(*) into v_n from public.idle_place_state where user_id = s.user_id;
  perform public.idle_ganhar(s.user_id, 'mapa_abriu', v_n);
  return public.idle_json(s) || jsonb_build_object('mapa', public.idle_mapa_json(s));
end;
$$;

revoke all on function public.idle_mapa_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_mapa() from public, anon;
grant execute on function public.idle_mapa() to authenticated;
revoke all on function public.idle_place_abrir(int) from public, anon;
grant execute on function public.idle_place_abrir(int) to authenticated;
```

Nota: `idle_place_state` referencia `idle_state`, que precisa existir; `idle_lock` cria a linha. A ordem acima
(settle → save → insert → ganhar) segue a regra dos Convidados: conquista depois da conta.

- [ ] **Step 1: Write the failing test** (`games/test/idleMapa.test.ts`, começo do arquivo; as partes B e C acrescentam
      `describe`s):

```ts
// Mapa do rolê, a moldura (0057): migrações reais no PGlite. Lugares de verdade não entram aqui: os testes põem
// lugares de mentira em idle_places quando precisam.
import { beforeEach, describe, expect, it } from 'vitest';

import { LUGARES, MARCOS } from '../idle/mapa';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;
type Pino = { id: number; lancado: boolean; preco: number; aberto: boolean; nivel: number | null; nome: string | null; x: number | null; dono: { user_id: string } | null };
type Mapa = { mapa: string | null; lugares: Pino[]; mult: number };
const mapa = () => t.rpc<Mapa>('idle_mapa');
const abrir = (l: number) => t.rpc<{ valuation: number; mapa: Mapa; conquistas: { id: number }[] }>('idle_place_abrir', { p_lugar: l });
const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
/** A com a empresa na era `era` (geradores 1 e o primeiro da era), estratégias escolhidas e F$ `v`. */
async function empresa(era: number, v = 1e15) {
  const primeiro = [1, 7, 13, 19, 25][era - 1];
  await q(`update public.idle_state set valuation = $2, generators[1] = 50, generators[$3] = 1, strategies = '{0,0,0,0}' where user_id = $1`, [A, v, primeiro]);
  await parar();
}

beforeEach(async () => {
  t = await freshDb({ conquistas: true });
  await t.member(A);
  await t.member(B);
  await t.member(OUT, { isMember: false });
  await t.as(A);
  await t.rpc('idle_start');
});

describe('catálogo', () => {
  it('o banco tem os mesmos lugares e marcos de mapa.ts', async () => {
    const ls = await q<Record<string, unknown>>('select * from public.idle_cat_place order by id');
    expect(ls.map((r) => ({ id: r.id, faixa: r.faixa, horas: r.horas, era: r.era, lote: r.lote, custoBase: r.custo_base, moeda: r.moeda, numero: r.numero })))
      .toEqual(LUGARES.map(({ id, faixa, horas, era, lote, custoBase, moeda, numero }) => ({ id, faixa, horas, era, lote, custoBase, moeda, numero })));
    const ms = await q<Record<string, unknown>>('select * from public.idle_cat_place_marco order by id');
    expect(ms.map((r) => ({ id: r.id, lugar: r.lugar, tipo: r.tipo, valor: r.valor, bonus: r.bonus }))).toEqual(MARCOS.map((m) => ({ ...m })));
  });
});

describe('privacidade', () => {
  it('idle_places e idle_map: membro lê, não membro e anônimo não', async () => {
    await q(`insert into public.idle_places (id, nome, x, y) values (3, 'Lugar de teste', 10, 10)`);
    expect(await t.asRole('authenticated', 'select nome from public.idle_places')).toHaveLength(1);
    await t.as(OUT);
    expect(await t.asRole('authenticated', 'select nome from public.idle_places')).toHaveLength(0);
    await expect(t.asRole('anon', 'select nome from public.idle_places')).rejects.toThrow();
  });
  it('estado dos lugares não é lido direto por ninguém', async () => {
    await expect(t.asRole('authenticated', 'select * from public.idle_place_state')).rejects.toThrow();
    await expect(t.asRole('authenticated', 'select * from public.idle_place_prod')).rejects.toThrow();
  });
});

describe('abrir', () => {
  it('idle_mapa sem empresa aberta: tudo fechado, preço 0, sem erro', async () => {
    await t.as(B);
    const m = await mapa();
    expect(m.lugares).toHaveLength(9);
    expect(m.lugares.every((l) => !l.aberto && l.preco === 0)).toBe(true);
  });
  it('não membro não vê o mapa', async () => {
    await t.as(OUT);
    await expect(mapa()).rejects.toThrow(/not_member/);
  });
  it('abre a camisetaria na era 2 pagando 2 h de produção, e ganha "Rolê marcado"', async () => {
    await empresa(2);
    const r = await taxa();
    const antes = (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
    const s = await abrir(3);
    expect(antes - s.valuation).toBeCloseTo(2 * 3600 * r, 0);
    expect(s.mapa.lugares.find((l) => l.id === 3)).toMatchObject({ aberto: true, nivel: 1 });
    expect(s.conquistas.map((c) => c.id)).toContain(83);
  });
  it('recusas: era baixa, lote não lançado, já aberto, sem dinheiro, lugar que não existe', async () => {
    await empresa(2);
    await expect(abrir(4)).rejects.toThrow(/idle_locked/); // médio pede era 3
    await expect(abrir(1)).rejects.toThrow(/idle_locked/); // lote 2
    await abrir(3);
    await expect(abrir(3)).rejects.toThrow(/idle_lugar_aberto/);
    await expect(abrir(99)).rejects.toThrow(/idle_bad_choice/);
    await empresa(4, 0);
    await expect(abrir(7)).rejects.toThrow(/idle_cant_afford/);
  });
  it('sem empresa aberta: idle_not_started', async () => {
    await t.as(B);
    await expect(abrir(3)).rejects.toThrow(/idle_not_started/);
  });
  it('valuation exatamente igual ao preço abre', async () => {
    await empresa(2);
    const preco = 2 * 3600 * (await taxa());
    await q('update public.idle_state set valuation = $2 where user_id = $1', [A, preco]);
    await parar();
    await expect(abrir(3)).resolves.toBeTruthy();
  });
  it('três abertos dão "Conhece a cidade"; vender a startup não fecha nada', async () => {
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [A])).map((x) => x.id);
    expect(ids).toEqual(expect.arrayContaining([83, 84]));
    await q(`update public.idle_state set prestige_earned = 0, best_rate = 1e30 where user_id = $1`, [A]);
    await t.rpc('idle_prestige').catch(() => undefined); // pode recusar por pontos; o que importa é a tabela
    expect((await q('select lugar from public.idle_place_state where user_id = $1', [A]))).toHaveLength(3);
  });
  it('nome, ícone e posição vêm de idle_places quando existem', async () => {
    await q(`insert into public.idle_places (id, nome, frase, x, y) values (3, 'Lugar de teste', 'frase', 40, 50)`);
    const l = (await mapa()).lugares.find((x) => x.id === 3)!;
    expect(l).toMatchObject({ nome: 'Lugar de teste', x: 40 });
    expect((await mapa()).lugares.find((x) => x.id === 4)!.nome).toBeNull();
  });
});
```

- [ ] **Step 2:** Acrescentar a 0057 em `db.ts`/`mockDb.ts` com o arquivo ainda vazio; `npx vitest run test/idleMapa.test.ts` → FAIL.
- [ ] **Step 3:** Escrever a parte A da 0057 (SQL acima).
- [ ] **Step 4:** `npx vitest run test/idleMapa.test.ts` passa. (O caso de `idle_prestige` só confere a tabela; se o
      `idle_prestige` recusar, o teste continua valendo.)
- [ ] **Step 5:** `git commit -m "Fellas Inc.: 0057 parte A (tabelas do Mapa do rolê, privadas só pra membros, abrir lugar)"`

---

### Task 4: 0057, parte B (nível, marcos, produção da empresa, estratégias)

**Files:** Modify `supabase/migrations/0057_fellas_inc_mapa.sql` (acrescentar no fim; trocar a `idle_place_mult`
provisória), `games/test/idleMapa.test.ts`.

**Interfaces — Produces (SQL):**
- `idle_place_mult(s idle_state) → double precision` (definitiva).
- `idle_place_marcos(p_user uuid, p_lugar int) → int[]` (interna: grava os marcos novos e devolve os ids novos).
- `idle_place_nivel(p_lugar int) → jsonb` (RPC: sobe um nível; devolve `idle_json(s) || {'lugar': idle_lugar_json(s, p_lugar), 'marcos_novos': [...]}`).
- `idle_rate_at` redefinida: a da 0051 vezes `public.idle_place_mult(s)`.

`idle_lugar_json` nasce na parte C; nesta parte, criar uma provisória `idle_lugar_json(s public.idle_state, p_lugar int)
returns jsonb` que devolve `jsonb_build_object('id', p_lugar, 'nivel', ..., 'moeda', ..., 'marcos', ...)` lendo
`idle_place_state`; a parte C substitui pela completa.

```sql
create or replace function public.idle_place_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.sociais from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  )
  select 1
       + coalesce((select sum(m.bonus) from public.idle_place_state st
                     join public.idle_cat_place_marco m on m.id = any (st.marcos)
                    where st.user_id = s.user_id), 0)
         * coalesce((select max((x.sociais ->> 'marcosMult')::double precision) from est x
                      where (x.sociais ->> 'marcosMult') is not null), 1)
       + coalesce((select sum((x.sociais ->> 'porLugar')::double precision) from est x
                    where (x.sociais ->> 'porLugar') is not null), 0)
         * (select count(*) from public.idle_place_state st where st.user_id = s.user_id)
$$;

create or replace function public.idle_place_marcos(p_user uuid, p_lugar int)
returns int[] language plpgsql volatile set search_path = public as $$
declare
  st      public.idle_place_state;
  v_novos int[];
begin
  select * into st from public.idle_place_state where user_id = p_user and lugar = p_lugar for update;
  if not found then
    return '{}';
  end if;
  select coalesce(array_agg(m.id order by m.id), '{}') into v_novos
    from public.idle_cat_place_marco m
   where m.lugar = p_lugar and not (m.id = any (st.marcos))
     and case m.tipo
           when 'nivel' then st.nivel >= m.valor
           when 'lendario' then st.lendario
           when 'fas' then st.fas >= m.valor
           when 'volume' then st.volume >= m.valor
           else false
         end;
  if cardinality(v_novos) > 0 then
    update public.idle_place_state set marcos = marcos || v_novos where user_id = p_user and lugar = p_lugar;
  end if;
  return v_novos;
end;
$$;
```

**Regra de quem chama `idle_place_marcos`:** sempre depois de `idle_save(s)` com a conta fechada em `now()` (o bônus vale
dali pra frente, como as conquistas).

```sql
create or replace function public.idle_place_nivel(p_lugar int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  st      public.idle_place_state;
  c       public.idle_cat_place;
  v_custo double precision;
  v_novos int[];
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  select * into st from public.idle_place_state where user_id = s.user_id and lugar = p_lugar for update;
  if not found then
    raise exception 'idle_lugar_fechado' using errcode = 'P0001';
  end if;
  if st.nivel >= 25 then
    raise exception 'idle_lugar_nivel_max' using errcode = 'P0001';
  end if;
  select * into c from public.idle_cat_place where id = p_lugar;
  v_custo := c.custo_base * power(1.55, st.nivel - 1);
  if st.moeda < v_custo then
    raise exception 'idle_lugar_moeda' using errcode = 'P0001';
  end if;
  perform public.idle_save(s);
  update public.idle_place_state set moeda = moeda - v_custo, nivel = nivel + 1 where user_id = s.user_id and lugar = p_lugar;
  v_novos := public.idle_place_marcos(s.user_id, p_lugar);
  return public.idle_json(s) || jsonb_build_object('lugar', public.idle_lugar_json(s, p_lugar), 'marcos_novos', to_jsonb(v_novos));
end;
$$;
```

`idle_rate_at`: copiar **exatamente** a definição da `0051_fellas_inc_convidados.sql` (linhas 328–351) e acrescentar
`* public.idle_place_mult(s)` como último fator. Conferir com `grep -n "function public.idle_rate_at" supabase/migrations/*.sql`
que a 0051 é a última que a define antes da 0057.

Permissões: `revoke all ... from public, anon, authenticated` em `idle_place_mult` e `idle_place_marcos`;
`idle_place_nivel` com `revoke ... from public, anon` e `grant execute ... to authenticated`.

- [ ] **Step 1: Write the failing tests** (acrescentar em `idleMapa.test.ts`):

```ts
import { custoNivel, multMapa } from '../idle/mapa'; // junto do import de cima

const nivel = (l: number) => t.rpc<{ lugar: { nivel: number }; marcos_novos: number[] }>('idle_place_nivel', { p_lugar: l });
const moeda = (l: number, v: number) => q('update public.idle_place_state set moeda = $3 where user_id = $1 and lugar = $2', [A, l, v]);

describe('nível e marcos', () => {
  it('sobe pagando custo_base × 1,55^(n−1) da moeda do lugar', async () => {
    await empresa(2);
    await abrir(3);
    await moeda(3, 1000);
    const r = await nivel(3);
    expect(r.lugar.nivel).toBe(2);
    const sobra = (await q<{ m: number }>('select moeda as m from public.idle_place_state where user_id = $1 and lugar = 3', [A]))[0].m;
    expect(sobra).toBeCloseTo(1000 - custoNivel(LUGARES[2], 1)!);
  });
  it('recusas: fechado, sem moeda, nível 25', async () => {
    await empresa(2);
    await expect(nivel(3)).rejects.toThrow(/idle_lugar_fechado/);
    await abrir(3);
    await expect(nivel(3)).rejects.toThrow(/idle_lugar_moeda/);
    await q('update public.idle_place_state set nivel = 25, moeda = 1e30 where user_id = $1 and lugar = 3', [A]);
    await expect(nivel(3)).rejects.toThrow(/idle_lugar_nivel_max/);
  });
  it('nível 5 ganha o marco 31 e a produção da empresa sobe 2%', async () => {
    await empresa(2);
    await abrir(3);
    const antes = await taxa();
    await q('update public.idle_place_state set nivel = 4, moeda = 1e9 where user_id = $1 and lugar = 3', [A]);
    const r = await nivel(3);
    expect(r.marcos_novos).toEqual([31]);
    expect(await taxa()).toBeCloseTo(antes * 1.02, 6);
  });
  it('marcos de fãs, volume e lendário', async () => {
    await empresa(2);
    await abrir(3);
    await q('update public.idle_place_state set fas = 10000, volume = 50, lendario = true where user_id = $1 and lugar = 3', [A]);
    expect(await q<{ m: number[] }>('select public.idle_place_marcos($1, 3) as m', [A])).toEqual([{ m: [36, 37, 38] }]);
    expect(await q<{ m: number[] }>('select public.idle_place_marcos($1, 3) as m', [A])).toEqual([{ m: [] }]);
  });
  it('paridade do mult com mapa.ts: Monopólio dobra, Marca forte soma por lugar', async () => {
    await empresa(4);
    for (const l of [3, 4, 7]) await abrir(l);
    await q(`update public.idle_place_state set marcos = '{31,32,41}' where user_id = $1 and lugar in (3, 4)`, [A]);
    const bonus = 0.02 + 0.02 + 0.02 + 0.02 + 0.02 + 0.02; // os dois lugares com {31,32,41}: 6 marcos de 2%
    const mult = async () => (await q<{ m: number }>('select public.idle_place_mult(s) as m from public.idle_state s where user_id = $1', [A]))[0].m;
    // estratégias: era 3 opção 2 = Marca forte; era 4 opção 1 = Monopólio (strategies[era-1] = opcao)
    await q(`update public.idle_state set strategies = '{0,0,0,0}' where user_id = $1`, [A]);
    expect(await mult()).toBeCloseTo(multMapa(bonus, 3, { marcosMult: 1, porLugar: 0 }));
    await q(`update public.idle_state set strategies = '{0,2,1,0}' where user_id = $1`, [A]);
    expect(await mult()).toBeCloseTo(multMapa(bonus, 3, { marcosMult: 2, porLugar: 0.05 }));
  });
});
```

(Conferir no `idle_cat_est` o índice: `strategies[e.era - 1] = e.opcao`. Se a Marca forte for `era 3, opcao 2`, ela fica
em `strategies[2]`; o array `'{0,2,1,0}'` = era 2 opção 0, era 3 opção 2, era 4 opção 1, era 5 opção 0. Ajustar se o
catálogo usar outra base.)

- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar a parte B.
- [ ] **Step 4:** `npx vitest run test/idleMapa.test.ts test/idleParidade.test.ts test/idleConvidados.test.ts test/idleHorta.test.ts`
      passa (a `idle_rate_at` nova não muda nada para quem não tem lugar: mult 1).
- [ ] **Step 5:** `git commit -m "Fellas Inc.: 0057 parte B (nível, marcos que somam na produção, Marca forte e Monopólio)"`

---

### Task 5: 0057, parte C (produções, pódio, placar da semana, desafio, foto de segunda, `idle_lugar`)

**Files:** Modify `supabase/migrations/0057_fellas_inc_mapa.sql`, `games/test/idleMapa.test.ts`.

**Interfaces — Produces (SQL), usadas pelas partes 2 a 4:**
- `idle_place_nome(p_nome text) → text` (trim + valida; `idle_lugar_nome` se inválido).
- `idle_place_registrar(p_user uuid, p_lugar int, p_nome text, p_partes int[], p_numero double precision) → bigint`
  (grava a produção; se entrou no pódio, `idle_ganhar(p_user, 'mapa_podio')`; devolve o id).
- `idle_place_podio(p_lugar int) → jsonb` (até 3: `{id, user_id, nome, partes, numero, criado_em, avatar}`).
- `idle_place_semana(p_lugar int, p_semana date default games_week_start()) → jsonb` (até 3 da semana, uma vez por pessoa).
- `idle_place_semana_idx(p_lugar int, p_sal int, p_n int, p_semana date default games_week_start()) → int` (igual a `semanaIdx`).
- `idle_place_desafio_da_semana(p_lugar int) → public.idle_cat_place_desafio` (null se o lugar não tem desafios).
- `idle_place_desafio(s idle_state, p_lugar int, p_tipo text, p_valor double precision) → idle_state` (paga o prêmio se
  o desafio da semana do lugar é desse tipo, `valor` do desafio ≤ `p_valor` (ou nulo) e ainda não foi feito; devolve `s`
  com o prêmio aplicado; **não** salva: quem chama salva).
- `idle_place_nota(p_user uuid, p_lugar int, p_tipo text, p_a int, p_b int, p_rotulo int) → void` (caderninho; upsert).
- `idle_place_avancar(s idle_state) → void` (despachante: anda cada lugar aberto até agora; nesta parte não faz nada
  além de `avancado_em = now()`; as partes 2 a 4 o substituem acrescentando o `when` do lugar delas).
- `idle_place_mecanica_json(s idle_state, p_lugar int) → jsonb` (despachante; nesta parte devolve `null`).
- `idle_lugar_json(s idle_state, p_lugar int) → jsonb` (completa, substitui a provisória).
- `idle_lugar(p_lugar int) → jsonb` (RPC).
- `idle_lock` redefinida: depois do `idle_horta_avancar(s)`, `perform public.idle_place_avancar(s);` e depois
  `update public.idle_state set visto_em = now() where user_id = p_user;` (o `s` devolvido mantém o `visto_em` antigo,
  que é o que as mecânicas usam para saber se a pessoa passou desde o último ciclo).
- `idle_weekly_reset` redefinida: a da 0041 inteira + a foto de cada lugar (abaixo).

Pódio (uma vez por pessoa, empate = quem chegou antes; a ordem de desempate é `criado_em, id`):

```sql
create or replace function public.idle_place_podio(p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', x.id, 'user_id', x.user_id, 'nome', x.nome, 'partes', to_jsonb(x.partes),
                                               'numero', x.numero, 'criado_em', x.criado_em,
                                               'avatar', public.idle_avatar_json(x.user_id))
                            order by x.numero desc, x.criado_em, x.id), '[]'::jsonb)
    from (select * from (select distinct on (p.user_id) p.*
                           from public.idle_place_prod p where p.lugar = p_lugar
                          order by p.user_id, p.numero desc, p.criado_em, p.id) melhor
           order by melhor.numero desc, melhor.criado_em, melhor.id
           limit 3) x
$$;
```

`idle_place_semana` igual, filtrando `p.criado_em >= (p_semana::timestamp at time zone 'America/Sao_Paulo')` e
`< ((p_semana + 7)::timestamp at time zone 'America/Sao_Paulo')`, devolvendo `{user_id, numero, avatar}`.

Registrar:

```sql
create or replace function public.idle_place_nome(p_nome text)
returns text language plpgsql immutable set search_path = public as $$
declare v text := btrim(coalesce(p_nome, ''));
begin
  if char_length(v) < 1 or char_length(v) > 30 or v ~ '[\r\n]' then
    raise exception 'idle_lugar_nome' using errcode = 'P0001';
  end if;
  return v;
end;
$$;

create or replace function public.idle_place_registrar(p_user uuid, p_lugar int, p_nome text, p_partes int[], p_numero double precision)
returns bigint language plpgsql volatile set search_path = public as $$
declare v_id bigint;
begin
  insert into public.idle_place_prod (user_id, lugar, nome, partes, numero)
  values (p_user, p_lugar, public.idle_place_nome(p_nome), p_partes, p_numero)
  returning id into v_id;
  if exists (select 1 from jsonb_array_elements(public.idle_place_podio(p_lugar)) e where (e ->> 'id')::bigint = v_id) then
    perform public.idle_ganhar(p_user, 'mapa_podio');
  end if;
  return v_id;
end;
$$;
```

Sorteio da semana e desafio:

```sql
create or replace function public.idle_place_semana_idx(p_lugar int, p_sal int, p_n int, p_semana date default public.games_week_start())
returns int language sql immutable set search_path = public as $$
  select (((((p_semana - date '2026-01-05') / 7)::bigint * 2654435761 + p_lugar::bigint * 40503 + p_sal::bigint * 97)
           % 4294967296) % greatest(p_n, 1))::int
$$;

create or replace function public.idle_place_desafio_da_semana(p_lugar int)
returns public.idle_cat_place_desafio language sql stable set search_path = public as $$
  select d.* from public.idle_cat_place_desafio d
   where d.lugar = p_lugar
   order by d.id
  offset public.idle_place_semana_idx(p_lugar, 0, (select count(*)::int from public.idle_cat_place_desafio x where x.lugar = p_lugar))
   limit 1
$$;

create or replace function public.idle_place_desafio(s public.idle_state, p_lugar int, p_tipo text, p_valor double precision)
returns public.idle_state language plpgsql volatile set search_path = public as $$
declare d public.idle_cat_place_desafio;
begin
  d := public.idle_place_desafio_da_semana(p_lugar);
  if d.id is null or d.tipo <> p_tipo or (d.valor is not null and coalesce(p_valor, -1e308) < d.valor) then
    return s;
  end if;
  insert into public.idle_place_challenges (user_id, lugar, week_start, desafio)
  values (s.user_id, p_lugar, public.games_week_start(), d.id)
  on conflict do nothing;
  if not found then
    return s; -- já fez nesta semana
  end if;
  if d.premio = 'horas' then
    s.valuation := s.valuation + d.premio_valor * 3600 * public.idle_rate(s);
  elsif d.premio = 'investidor' then
    s.valuation := s.valuation + 1200 * public.idle_rate(s);
  else -- legado: pontos pra gastar na árvore, sem mexer no que a próxima venda rende
    s.prestige_spent := s.prestige_spent - d.premio_valor::int;
  end if;
  return s;
end;
$$;
```

(O `if not found` depois de `insert ... on conflict do nothing` é verdadeiro quando nada entrou. Conferir no PGlite; se não
for, trocar por `get diagnostics v_n = row_count`.)

Caderninho, despachantes, `idle_lugar_json` e o RPC:

```sql
create or replace function public.idle_place_nota(p_user uuid, p_lugar int, p_tipo text, p_a int, p_b int, p_rotulo int)
returns void language sql volatile set search_path = public as $$
  insert into public.idle_place_notes (user_id, lugar, tipo, a, b, rotulo) values (p_user, p_lugar, p_tipo, p_a, p_b, p_rotulo)
  on conflict (user_id, lugar, tipo, a, b) do update set rotulo = excluded.rotulo
$$;

-- anda os lugares abertos até agora (as partes 2 a 4 acrescentam o "when" de cada lugar)
create or replace function public.idle_place_avancar(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_place_state set avancado_em = now() where user_id = s.user_id and avancado_em < now();
end;
$$;

create or replace function public.idle_place_mecanica_json(s public.idle_state, p_lugar int)
returns jsonb language sql stable set search_path = public as $$ select null::jsonb $$;

create or replace function public.idle_lugar_json(s public.idle_state, p_lugar int)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id', c.id, 'moeda_nome', c.moeda, 'numero', c.numero, 'lancado', c.lancado,
    'nome', p.nome, 'frase', p.frase, 'icone', p.icone,
    'aberto', st.lugar is not null, 'nivel', st.nivel, 'moeda', st.moeda, 'fas', st.fas, 'volume', st.volume,
    'lendario', st.lendario, 'marcos', to_jsonb(coalesce(st.marcos, '{}')),
    'preco_nivel', case when st.nivel < 25 then c.custo_base * power(1.55, st.nivel - 1) end,
    'desafio', (select jsonb_build_object('id', d.id, 'texto', d.texto, 'premio', d.premio, 'premio_valor', d.premio_valor,
                                          'feito', exists (select 1 from public.idle_place_challenges ch
                                                            where ch.user_id = s.user_id and ch.lugar = c.id
                                                              and ch.week_start = public.games_week_start()))
                  from public.idle_place_desafio_da_semana(c.id) d where d.id is not null),
    'podio', public.idle_place_podio(c.id),
    'semana', public.idle_place_semana(c.id),
    'dono', (select jsonb_build_object('user_id', w.dono_id, 'numero', w.numero, 'avatar', public.idle_avatar_json(w.dono_id))
               from public.idle_place_weeks w
              where w.lugar = c.id and w.week_start = public.games_week_start() - 7 and w.dono_id is not null),
    'caderninho', coalesce((select jsonb_agg(jsonb_build_object('tipo', n.tipo, 'a', n.a, 'b', n.b, 'rotulo', n.rotulo)
                                             order by n.tipo, n.a, n.b)
                              from public.idle_place_notes n where n.user_id = s.user_id and n.lugar = c.id), '[]'::jsonb),
    'mecanica', public.idle_place_mecanica_json(s, c.id),
    'server_now', now())
  from public.idle_cat_place c
  left join public.idle_places p on p.id = c.id
  left join public.idle_place_state st on st.user_id = s.user_id and st.lugar = c.id
  where c.id = p_lugar
$$;

create or replace function public.idle_lugar(p_lugar int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if not exists (select 1 from public.idle_cat_place where id = p_lugar) then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_lugar_json(s, p_lugar);
end;
$$;
```

Foto de segunda: copiar **inteira** a `idle_weekly_reset` da `0041_fellas_inc_prestigio.sql` (linhas 861–904) e, logo
antes do `if jsonb_array_length(v_podium) = 0 then return;`, acrescentar (a foto dos lugares não depende de alguém ter
jogado a empresa):

```sql
  -- Mapa do rolê: o 1º da semana em cada lugar vira o dono do pedaço da semana seguinte (0057)
  insert into public.idle_place_weeks (week_start, lugar, dono_id, numero)
  select v_old, c.id, (x -> 0 ->> 'user_id')::uuid, (x -> 0 ->> 'numero')::double precision
    from public.idle_cat_place c
    cross join lateral (select public.idle_place_semana(c.id, v_old) as x) sem
   where jsonb_array_length(sem.x) > 0
  on conflict (week_start, lugar) do nothing;
  for v_dono in select distinct w.dono_id from public.idle_place_weeks w
                 where w.week_start = v_old and w.dono_id is not null order by 1 loop
    perform public.idle_fechar_e_ganhar(v_dono, 'mapa_dono');
  end loop;
```

(Declarar `v_dono uuid;`. Atenção: `x` dentro do `select` é a coluna do lateral: escrever `sem.x` nas duas
referências. O `return` cedo da 0041 vem **antes** (quando a placa da empresa já existe): a foto dos lugares fica dentro
da mesma trava `fellas-inc-semana`, então não duplica.)

`idle_lock`: copiar a da `0048_fellas_inc_horta.sql` e acrescentar as duas linhas descritas acima depois do
`perform public.idle_horta_avancar(s);`.

Permissões: todas as internas com `revoke all ... from public, anon, authenticated`; `idle_lugar(int)` com
`revoke ... from public, anon` + `grant execute ... to authenticated`.

- [ ] **Step 1: Write the failing tests** (acrescentar):

```ts
const registrar = (u: string, l: number, nome: string, numero: number, quando = 'now()') =>
  q<{ id: number }>(`select public.idle_place_registrar($1, $2, $3, '{1,2}', $4) as id`, [u, l, nome, numero])
    .then(async (r) => { if (quando !== 'now()') await q(`update public.idle_place_prod set criado_em = ${quando} where id = $1`, [r[0].id]); return r[0].id; });
type Lugar = { podio: { user_id: string; nome: string; numero: number }[]; semana: { user_id: string; numero: number }[]; desafio: unknown; dono: unknown; mecanica: unknown; caderninho: unknown[] };
const lugar = (l: number) => t.rpc<Lugar>('idle_lugar', { p_lugar: l });
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';
async function outros() {
  for (const u of [B, C, D]) {
    if (u !== B) await t.member(u);
    await t.as(u); await t.rpc('idle_start'); await t.as(A);
  }
}

describe('produções e pódio', () => {
  it('nome inválido é recusado', async () => {
    await expect(q(`select public.idle_place_nome('   ')`)).rejects.toThrow(/idle_lugar_nome/);
    await expect(q(`select public.idle_place_nome($1)`, ['x'.repeat(31)])).rejects.toThrow(/idle_lugar_nome/);
    expect(await q(`select public.idle_place_nome('  oi ') as v`)).toEqual([{ v: 'oi' }]);
  });
  it('pódio: 3 melhores, uma vez por pessoa, empate fica com quem fez antes', async () => {
    await outros();
    await registrar(A, 3, 'A1', 300, `now() - interval '3 days'`);
    await registrar(A, 3, 'A2', 290);           // a 2ª da A não entra: só a melhor dela
    await registrar(B, 3, 'B1', 250, `now() - interval '2 days'`);
    await registrar(C, 3, 'C1', 250, `now() - interval '1 day'`); // empate com B: B fez antes
    await registrar(D, 3, 'D1', 100);
    const p = (await lugar(3)).podio;
    expect(p.map((x) => x.nome)).toEqual(['A1', 'B1', 'C1']);
  });
  it('entrar no pódio dá "Tá no pódio"', async () => {
    await registrar(A, 3, 'Primeira', 10);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [A])).map((x) => x.id);
    expect(ids).toContain(86);
  });
  it('placar da semana só conta a semana', async () => {
    await outros();
    await registrar(A, 4, 'velho', 900, `now() - interval '14 days'`);
    await registrar(B, 4, 'novo', 500);
    expect((await lugar(4)).semana.map((x) => x.numero)).toEqual([500]);
  });
});

describe('desafio da semana', () => {
  beforeEach(async () => {
    await q(`insert into public.idle_cat_place_desafio (id, lugar, tipo, valor, texto, premio, premio_valor) values
             (9001, 3, 'teste', 5, 'desafio de teste', 'horas', 2)`);
    await empresa(2);
    await abrir(3);
  });
  it('paga uma vez por semana: 2 h de produção', async () => {
    const r = await taxa();
    const v = async () => (await q<{ v: number }>(
      `select (public.idle_place_desafio(s, 3, 'teste', 6)).valuation - s.valuation as v from public.idle_state s where user_id = $1`, [A]))[0].v;
    expect(await v()).toBeCloseTo(2 * 3600 * r, 0);
    expect(await v()).toBe(0);
  });
  it('não paga com valor abaixo nem com outro tipo', async () => {
    const dif = async (tipo: string, valor: number) => (await q<{ v: number }>(
      `select (public.idle_place_desafio(s, 3, $2, $3)).valuation - s.valuation as v from public.idle_state s where user_id = $1`, [A, tipo, valor]))[0].v;
    expect(await dif('teste', 4)).toBe(0);
    expect(await dif('outro', 99)).toBe(0);
  });
  it('legado soma pontos pra gastar sem mexer nos ganhos', async () => {
    await q(`update public.idle_cat_place_desafio set premio = 'legado', premio_valor = 3 where id = 9001`);
    // a função roda uma vez só (no CTE); depois compara com o antes
    const r = await q<{ ganhou: number; gasto: number }>(
      `with x as (select public.idle_place_desafio(s, 3, 'teste', 9) as n, s.prestige_earned as e0, s.prestige_spent as g0
                    from public.idle_state s where user_id = $1)
       select (n).prestige_earned - e0 as ganhou, (n).prestige_spent - g0 as gasto from x`, [A]);
    expect(r[0]).toEqual({ ganhou: 0, gasto: -3 });
  });
  it('o idle_lugar mostra o desafio e se já foi feito', async () => {
    expect((await lugar(3)).desafio).toMatchObject({ id: 9001, feito: false });
  });
});

describe('semana e presença', () => {
  it('idle_lock marca visto_em', async () => {
    await q(`update public.idle_state set visto_em = null where user_id = $1`, [A]);
    await mapa();
    expect((await q<{ v: string | null }>('select visto_em as v from public.idle_state where user_id = $1', [A]))[0].v).not.toBeNull();
  });
  it('a foto de segunda guarda o dono de cada lugar uma vez e dá "Dono do pedaço"', async () => {
    await outros();
    await registrar(B, 3, 'da B', 400, `public.games_week_start()::timestamp at time zone 'America/Sao_Paulo' - interval '2 days'`);
    await registrar(A, 3, 'da A', 100, `public.games_week_start()::timestamp at time zone 'America/Sao_Paulo' - interval '2 days'`);
    // semana passada com empresa aberta (a foto da empresa precisa de alguém jogando antes desta semana)
    await q(`update public.idle_state set week_start = public.games_week_start() - 7, started = true where true`);
    await q(`select public.idle_weekly_reset()`);
    await q(`select public.idle_weekly_reset()`);
    const w = await q<{ dono_id: string; lugar: number }>('select dono_id, lugar from public.idle_place_weeks');
    expect(w).toEqual([{ dono_id: B, lugar: 3 }]);
    const ids = (await q<{ id: number }>('select conquista_id as id from public.idle_conquistas where user_id = $1', [B])).map((x) => x.id);
    expect(ids).toContain(85);
    expect((await lugar(3)).dono).toMatchObject({ user_id: B });
  });
  it('idle_lugar de lugar fechado responde sem erro; de lugar que não existe, idle_bad_choice', async () => {
    expect(await lugar(3)).toMatchObject({ aberto: false, mecanica: null });
    await expect(lugar(42)).rejects.toThrow(/idle_bad_choice/);
  });
  it('quem nunca abriu a empresa também vê o lugar (fechado)', async () => {
    await t.as(B);
    expect(await lugar(3)).toMatchObject({ aberto: false, nivel: null });
  });
  it('paridade do sorteio da semana com mapa.ts', async () => {
    const { semanaIdx } = await import('../idle/mapa');
    for (const semana of ['2026-10-12', '2026-10-19', '2027-03-01']) {
      for (const l of [3, 4, 7]) {
        const r = await q<{ i: number }>('select public.idle_place_semana_idx($1, 0, 12, $2::date) as i', [l, semana]);
        expect(r[0].i).toBe(semanaIdx(l, 0, 12, semana));
      }
    }
  });
});
```

(Os testes do placar e da foto usam a semana do relógio de verdade; se o vitest usar relógio falso em outro `describe`,
este arquivo não usa.)

- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar a parte C.
- [ ] **Step 4:** `npx vitest run --maxWorkers=4` (a suíte inteira dos jogos: `idle_lock` e `idle_weekly_reset` mudaram).
- [ ] **Step 5:** `git commit -m "Fellas Inc.: 0057 parte C (pódio de sempre, placar e dono do pedaço, desafio da semana, caderninho)"`

---

### Task 6: API, tipos, erros e a ligação no `main.ts`

**Files:**
- Modify: `games/shared/types.ts`, `games/shared/api.ts`, `games/shared/errors.ts`, `games/idle/main.ts`,
  `games/idle/tela.ts` (só os tipos `Modelo`/`Acoes`)
- Test: `games/shared/types.test.ts` (se ele confere listas de erros), `games/idle/tela.test.ts` (ajuste dos modelos de teste)

**Interfaces — Produces (TS):**

```ts
// types.ts
export type PinoMapa = {
  id: number; faixa: 'barato' | 'medio' | 'caro'; lote: number; lancado: boolean; horas: number; era: number;
  moeda: string | null; numero: 'pct' | 'nota' | 'estrelas' | null; preco: number;
  nome: string | null; frase: string | null; icone: string | null; x: number | null; y: number | null;
  aberto: boolean; nivel: number | null; moeda_qtd: number | null; fas: number | null;
  dono: { user_id: string; avatar: IdleVisual | null } | null;
};
export type MapaEstado = { mapa: string | null; lugares: PinoMapa[]; mult: number };
export type ProducaoLugar = { id: number; user_id: string; nome: string; partes: number[]; numero: number; criado_em: string; avatar: IdleVisual | null };
export type NotaCaderninho = { tipo: string; a: number; b: number; rotulo: number };
export type LugarEstado = {
  id: number; moeda_nome: string | null; numero: 'pct' | 'nota' | 'estrelas' | null; lancado: boolean;
  nome: string | null; frase: string | null; icone: string | null;
  aberto: boolean; nivel: number | null; moeda: number | null; fas: number | null; volume: number | null; lendario: boolean | null;
  marcos: number[]; preco_nivel: number | null;
  desafio: { id: number; texto: string; premio: 'horas' | 'legado' | 'investidor'; premio_valor: number; feito: boolean } | null;
  podio: ProducaoLugar[]; semana: { user_id: string; numero: number; avatar: IdleVisual | null }[];
  dono: { user_id: string; numero: number; avatar: IdleVisual | null } | null;
  caderninho: NotaCaderninho[]; mecanica: unknown; server_now: string;
};
```

(`IdleVisual` é o tipo que `idle_avatar_json` já devolve no placar; usar o mesmo.)

```ts
// api.ts
export const idleMapa = () => rpc<MapaEstado>('idle_mapa');
export const idleLugar = (lugar: number) => rpc<LugarEstado>('idle_lugar', { p_lugar: lugar });
export const idleLugarAbrir = (lugar: number) => rpc<IdleState & { mapa: MapaEstado }>('idle_place_abrir', { p_lugar: lugar });
export const idleLugarNivel = (lugar: number) => rpc<IdleState & { lugar: LugarEstado; marcos_novos: number[] }>('idle_place_nivel', { p_lugar: lugar });
/** Ação de uma mecânica de lugar (partes 2 a 4): só funções idle_tee_*, idle_cup_* e idle_din_*. */
export const idleLugarAcao = (fn: string, args: Record<string, unknown>) => {
  if (!/^idle_(tee|cup|din)_[a-z_]+$/.test(fn)) throw new Error(`ação de lugar desconhecida: ${fn}`);
  return rpc<IdleState & { lugar: LugarEstado }>(fn, args);
};
```

Erros (`errors.ts`, código + frase):

```ts
idle_lugar_aberto: 'Esse lugar já é seu',
idle_lugar_fechado: 'Abre esse lugar primeiro',
idle_lugar_nome: 'O nome precisa ter de 1 a 30 letras',
idle_lugar_moeda: 'Não dá pra pagar isso ainda',
idle_lugar_nivel_max: 'Esse lugar já tá no nível máximo',
```

`main.ts`: estado novo `mapaAberto: boolean`, `mapa: MapaEstado | null`, `lugarAberto: number | null`,
`lugar: LugarEstado | null`, `marcosNovos: number[]`; ações novas em `Acoes` (tela.ts):

```ts
mapa(acao: 'abrir' | 'fechar'): void;            // abre/fecha a tela cheia do mapa (fecha Bolsa/Horta/Convidados)
lugar(id: number | null): void;                   // entra num lugar aberto (null = volta pro mapa)
abrirLugar(id: number): void;                     // compra (idle_place_abrir)
subirNivel(id: number): void;                     // idle_place_nivel
lugarAcao(fn: string, args: Record<string, unknown>): void; // mecânica (partes 2 a 4)
```

Comportamento (copiar o padrão da Horta em `main.ts`, linhas 106–120 e 300–330):
- `mapa('abrir')`: fecha as outras gavetas, busca `api.idleMapa()`; com um lugar aberto, `api.idleLugar(id)`.
- Temporizador de 60 s enquanto o mapa ou um lugar está aberto (não com a aba escondida) que busca de novo o que está
  na tela (o lugar anda sozinho).
- `abrirLugar`, `subirNivel`, `lugarAcao`: `ocupado` durante a chamada; a resposta traz `IdleState` (atualiza a âncora como
  as outras ações) e `mapa`/`lugar`; `marcos_novos` vira aviso curto "Marco: +2% de produção" (usa o aviso que já existe).
- Erro `idle_lugar_*`/`idle_locked`: aviso com a frase e busca de novo o mapa/lugar.
- `Modelo` ganha `mapaAberto`, `mapa`, `lugarAberto`, `lugar`.

- [ ] **Step 1:** Ajustar o `tela.test.ts`/`main` de teste para o `Modelo` novo (os campos novos com `false`/`null`);
      teste novo em `games/shared/api.test.ts` (criar se não existir) que `idleLugarAcao('idle_bolsa', {})` lança
      (a trava do prefixo).
- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar tipos, api, erros e a ligação no `main.ts`.
- [ ] **Step 4:** `npx vitest run --maxWorkers=4` e `npx tsc --noEmit -p games` passam.
- [ ] **Step 5:** `git commit -m "Fellas Inc.: Mapa do rolê na API e no main (abrir, nível, ações de lugar)"`

---

### Task 7: a tela (mapa, moldura do lugar, registro das mecânicas, caixinhas, mock)

**Files:**
- Create: `games/idle/mapaTela.ts`, `games/idle/mapaTela.test.ts`, `games/idle/lugarTela.ts`, `games/idle/lugarTela.test.ts`,
  `games/idle/mecanicas.ts`
- Modify: `games/idle/tela.ts` (porta do Mapa ligada; `gavetaAberta` ganha `'mapa'`), `games/idle/portas.ts` (resumo da
  porta), `games/idle/dica.ts` + `dica.test.ts`, `games/idle/idle.css`, `games/dev/mockDb.ts` (lugares de mentira)

**Interfaces — Produces (usado pelas partes 2 a 4):**

```ts
// mecanicas.ts
import type { LugarEstado, NotaCaderninho } from '../shared/types';
export type AcoesMecanica = { acao(fn: string, args: Record<string, unknown>): void };
export type Dicas = { ligar(alvo: HTMLElement, texto: () => string | null): void }; // o mesmo `dicas.ligar` de tela.ts
export type TelaMecanica = { elemento: HTMLElement; renderizar(l: LugarEstado, ocupado: boolean, agoraMs: number): void };
export type Mecanica = {
  criar(a: AcoesMecanica, dicas: Dicas): TelaMecanica;
  /** A foto da produção montada das peças (canvas 48×48, pixel art, escala por CSS). */
  foto(partes: readonly number[]): HTMLCanvasElement;
  /** O caderninho do lugar (o que a pessoa descobriu). */
  caderninho(itens: readonly NotaCaderninho[]): HTMLElement;
  /** O que o próximo nível libera ("Tema: praia", "Peça: regata"); vazio = só rende mais. */
  libera(nivel: number): string[];
};
/** Preenchido pelas partes 2 a 4 (camisetaria = 3, copão = 4, jantar = 7). */
export const MECANICAS: Partial<Record<number, Mecanica>> = {};
```

`mapaTela.ts`:

```ts
export function criarMapaTela(a: { entrar(id: number): void; abrir(id: number): void }, dicas: Dicas): {
  elemento: HTMLElement;
  renderizar(m: MapaEstado | null, valuation: number, era: number, ocupado: boolean): void;
};
```
- Mapa: `<img>` do `m.mapa` (data URL) com `image-rendering: pixelated`, em escala inteira (a maior que cabe; mesma regra
  da cena, `escala.ts`). Sem `m.mapa`: um fundo `div.mapa-generico` (gradiente de tokens: noite em cima, mar embaixo).
- Pinos: `button.pino` posicionado em `% ` de 160×96 (`x/160`, `y/96`; sem `x`/`y`, `posicaoGenerica(id)`), com o ícone
  (`m.icone` ou o ícone da porta do mapa) e um selo: fechado = cadeado + preço formatado (`formatarValor`), aberto =
  nível, "Em breve" = apagado. Dono do pedaço: mini boneco (o mesmo desenho de avatar do placar) no canto do pino.
- Rótulo do pino: `nome` ou `Lugar ${id}`.
- Fechado e lançado: clicar chama `a.abrir(id)` (botão desabilitado com valuation < preço ou era < era); aberto:
  `a.entrar(id)`; "Em breve": desabilitado.
- Caixinha no pino fechado: `dicaPino(p, valuation, era)` (abaixo).

`lugarTela.ts`:

```ts
export function criarLugarTela(a: { voltar(): void; nivel(id: number): void; acao(fn: string, args: Record<string, unknown>): void }, dicas: Dicas): {
  elemento: HTMLElement;
  renderizar(l: LugarEstado | null, ocupado: boolean, agoraMs: number, nomes: Map<string, string>): void;
};
```
- Cabeçalho: ícone, nome (ou `Lugar N`), moeda (`formatarValor` + nome da moeda), nível, fãs, botão "Subir nível"
  (`preco_nivel`, desabilitado sem moeda; caixinha `dicaNivel`).
- Corpo: `MECANICAS[l.id]?.criar(...)` (criado uma vez por lugar e guardado); sem mecânica: `p.vazio` "Em breve".
- Faixa: **Pódio** (3 posições: foto `MECANICAS[l.id]?.foto(partes)` ou quadrado vazio, nome da produção, número com
  `formatarNumero`, boneco + nome de quem fez vindo de `nomes`), **Semana** (top 3 + "Dono do pedaço: Fulano"),
  **Desafio** (texto, prêmio por extenso, "✓ Feito"; caixinha `dicaDesafio`), **Marcos** (8 quadradinhos, ganhos
  acesos; caixinha `dicaMarco`), **Caderninho** (`MECANICAS[l.id]?.caderninho(l.caderninho)`).
- `nomes`: o `main.ts` busca com `api.fellas(ids)` os nomes de quem está no pódio/semana/dono e guarda num `Map` (mesmo
  padrão do placar).

`dica.ts` (textos, com testes):

```ts
export function dicaPino(p: PinoMapa, valuation: number, era: number): string;
// "Abre por F$ 12,3 mi (2 h da sua produção)." + " Precisa da era 2." se era < p.era + " Falta F$ X." se valuation < preço
export function dicaMarco(m: Marco, l: LugarEstado): string;
// "+2% de produção na empresa. Nível 5 (você está no 3)." | "...Já ganhou." | lendário: texto do lugar via MECANICAS? não: "Um resultado lendário neste lugar."
export function dicaDesafio(d: NonNullable<LugarEstado['desafio']>): string;
// "Prêmio: 2 h da sua produção em F$." | "Prêmio: 3 pontos do Legado." | "Prêmio: um Investidor na hora (20 min de produção)." + " Já fez esta semana." se feito
export function dicaNivel(l: LugarEstado, libera: string[]): string;
// "Nível 4 → 5 por 240 cupons. Rende mais e libera: Tema praia, Peça regata." | sem libera: "Rende mais."
```

Porta: em `tela.ts`, `porta('porta-mapa', 'Mapa do rolê', ativos.mapa(), () => a.mapa('abrir'))`; resumo em `portas.ts`
`portaMapa(s, m.mapa)` → `st`: "N lugares abertos" / "Abre na era 2" (era < 2) / "Os lugares do rolê" (sem estado
ainda); badge: desafio da semana por fazer? Não (custaria buscar todos os lugares): sem badge.
`NOMES_MINI` ganha `mapa: ['Mapa do rolê', …]` com o ícone `ativos.mapa()`; dentro de um lugar o título vira o nome do
lugar e o "← Voltar" volta pro mapa (não fecha a tela cheia).

Mock (`games/dev/mockDb.ts`, depois das migrações): lugares de mentira para o `?mock` não ficar vazio:

```ts
await db.exec(`insert into public.idle_places (id, nome, frase, x, y)
  select g, 'Lugar ' || g, 'Um lugar de mentira pro ?mock.', 30 + ((g - 1) % 3) * 50, 18 + ((g - 1) / 3) * 30
    from generate_series(1, 9) g on conflict (id) do nothing`);
```

CSS (`idle.css`): `.mapa-tela`, `.mapa-generico`, `.pino` (+ `.fechado`, `.breve`, `.aberto`), `.lugar-tela`,
`.lugar-cab`, `.lugar-corpo`, `.lugar-faixa`, `.podio`, `.marcos`, só com as variáveis de cor/tamanho que o `idle.css`
já usa (cantos de pixel, Jersey 10). No PC tudo cabe sem rolar em 1280×720 e 2000×961 (faixa à direita do corpo);
no celular (≤ 700 px) a faixa vai pra baixo e a tela rola inteira.

- [ ] **Step 1: Write the failing tests** (`mapaTela.test.ts`, `lugarTela.test.ts`, `dica.test.ts`), no estilo de
      `hortaTela.test.ts`:

```ts
// mapaTela.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { MapaEstado, PinoMapa } from '../shared/types';
import { criarMapaTela } from './mapaTela';

const pino = (id: number, extra: Partial<PinoMapa> = {}): PinoMapa => ({
  id, faixa: 'barato', lote: id === 3 ? 1 : 2, lancado: id === 3, horas: 2, era: 2, moeda: null, numero: null, preco: 1000,
  nome: null, frase: null, icone: null, x: null, y: null, aberto: false, nivel: null, moeda_qtd: null, fas: null, dono: null, ...extra,
});
const estado = (ps: PinoMapa[]): MapaEstado => ({ mapa: null, lugares: ps, mult: 1 });
const dicas = { ligar: vi.fn() };

describe('mapa', () => {
  it('9 pinos: lançado fechado com preço, aberto com nível, os outros "Em breve"', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([1, 2, 3, 4, 5, 6, 7, 8, 9].map((id) => pino(id, id === 7 ? { lancado: true, aberto: true, nivel: 4 } : {}))), 1e6, 4, false);
    const pinos = [...t.elemento.querySelectorAll<HTMLButtonElement>('.pino')];
    expect(pinos).toHaveLength(9);
    expect(pinos[2].classList.contains('fechado')).toBe(true);
    expect(pinos[2].textContent).toContain('F$');
    expect(pinos[6].textContent).toContain('4');
    expect(pinos[0].disabled).toBe(true);
    expect(pinos[0].textContent).toContain('Em breve');
  });
  it('sem nome no banco mostra "Lugar N"; com nome mostra o nome', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([pino(3), pino(4, { nome: 'Outro' })]), 0, 1, false);
    expect(t.elemento.textContent).toContain('Lugar 3');
    expect(t.elemento.textContent).toContain('Outro');
  });
  it('clicar no fechado com dinheiro e era compra; no aberto entra', () => {
    const a = { entrar: vi.fn(), abrir: vi.fn() };
    const t = criarMapaTela(a, dicas);
    t.renderizar(estado([pino(3), pino(7, { lancado: true, aberto: true, nivel: 1 })]), 1e6, 4, false);
    const [p3, p7] = t.elemento.querySelectorAll<HTMLButtonElement>('.pino');
    p3.click(); p7.click();
    expect(a.abrir).toHaveBeenCalledWith(3);
    expect(a.entrar).toHaveBeenCalledWith(7);
  });
  it('sem dinheiro ou sem era o fechado fica desabilitado', () => {
    const t = criarMapaTela({ entrar: vi.fn(), abrir: vi.fn() }, dicas);
    t.renderizar(estado([pino(3)]), 10, 4, false);
    expect(t.elemento.querySelector<HTMLButtonElement>('.pino')!.disabled).toBe(true);
    t.renderizar(estado([pino(3)]), 1e9, 1, false);
    expect(t.elemento.querySelector<HTMLButtonElement>('.pino')!.disabled).toBe(true);
  });
});
```

```ts
// lugarTela.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { LugarEstado } from '../shared/types';
import { criarLugarTela } from './lugarTela';
import { MECANICAS } from './mecanicas';

const lugar = (extra: Partial<LugarEstado> = {}): LugarEstado => ({
  id: 3, moeda_nome: 'cupom', numero: 'pct', lancado: true, nome: null, frase: null, icone: null,
  aberto: true, nivel: 3, moeda: 50, fas: 10, volume: 0, lendario: false, marcos: [], preco_nivel: 240,
  desafio: { id: 1, texto: 'Faz um negócio', premio: 'horas', premio_valor: 2, feito: false },
  podio: [{ id: 1, user_id: 'u1', nome: 'Camisa boa', partes: [1], numero: 230, criado_em: '2026-10-12T00:00:00Z', avatar: null }],
  semana: [], dono: null, caderninho: [], mecanica: null, server_now: '2026-10-12T12:00:00Z', ...extra,
});
const dicas = { ligar: vi.fn() };

describe('moldura do lugar', () => {
  it('cabeçalho, pódio com número formatado e nome de quem fez', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar(), false, 0, new Map([['u1', 'Juan']]));
    expect(t.elemento.textContent).toContain('Lugar 3');
    expect(t.elemento.textContent).toContain('Camisa boa');
    expect(t.elemento.textContent).toContain('230%');
    expect(t.elemento.textContent).toContain('Juan');
  });
  it('subir nível: desabilitado sem moeda, chama com moeda', () => {
    const a = { voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() };
    const t = criarLugarTela(a, dicas);
    t.renderizar(lugar(), false, 0, new Map());
    const b = t.elemento.querySelector<HTMLButtonElement>('.subir-nivel')!;
    expect(b.disabled).toBe(true);
    t.renderizar(lugar({ moeda: 1000 }), false, 0, new Map());
    t.elemento.querySelector<HTMLButtonElement>('.subir-nivel')!.click();
    expect(a.nivel).toHaveBeenCalledWith(3);
  });
  it('sem mecânica registrada o corpo diz "Em breve"; com mecânica, desenha a dela', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar(), false, 0, new Map());
    expect(t.elemento.querySelector('.lugar-corpo')!.textContent).toContain('Em breve');
    MECANICAS[3] = {
      criar: () => { const e = document.createElement('div'); e.textContent = 'mecânica de teste'; return { elemento: e, renderizar: () => undefined }; },
      foto: () => document.createElement('canvas'), caderninho: () => document.createElement('div'), libera: () => [],
    };
    const t2 = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t2.renderizar(lugar(), false, 0, new Map());
    expect(t2.elemento.querySelector('.lugar-corpo')!.textContent).toContain('mecânica de teste');
    delete MECANICAS[3];
  });
  it('marcos: 8 quadradinhos, os ganhos acesos', () => {
    const t = criarLugarTela({ voltar: vi.fn(), nivel: vi.fn(), acao: vi.fn() }, dicas);
    t.renderizar(lugar({ marcos: [31, 32] }), false, 0, new Map());
    const ms = t.elemento.querySelectorAll('.marco');
    expect(ms).toHaveLength(8);
    expect(t.elemento.querySelectorAll('.marco.ganho')).toHaveLength(2);
  });
});
```

```ts
// dica.test.ts (acrescentar)
it('dica do pino fechado: preço, horas e o que falta', () => {
  const p = { id: 3, faixa: 'barato', lote: 1, lancado: true, horas: 2, era: 2, moeda: 'cupom', numero: 'pct', preco: 12_300_000,
    nome: null, frase: null, icone: null, x: null, y: null, aberto: false, nivel: null, moeda_qtd: null, fas: null, dono: null } as const;
  expect(dicaPino(p, 20_000_000, 2)).toBe('Abre por F$ 12,3 mi (2 h da sua produção).');
  expect(dicaPino(p, 1_000_000, 1)).toContain('Precisa da era 2.');
  expect(dicaPino(p, 1_000_000, 2)).toContain('Falta F$ 11,3 mi.');
});
it('dica do desafio por prêmio', () => {
  expect(dicaDesafio({ id: 1, texto: 'x', premio: 'horas', premio_valor: 2, feito: false })).toBe('Prêmio: 2 h da sua produção em F$.');
  expect(dicaDesafio({ id: 1, texto: 'x', premio: 'legado', premio_valor: 3, feito: true })).toBe('Prêmio: 3 pontos do Legado. Já fez esta semana.');
  expect(dicaDesafio({ id: 1, texto: 'x', premio: 'investidor', premio_valor: 1, feito: false })).toBe('Prêmio: um Investidor na hora (20 min de produção).');
});
```

(Conferir o formato exato de `formatarValor` em `formatar.ts` e escrever as frases com ele; se `12,3 mi` não for o formato,
ajustar o teste ao que `formatarValor(12_300_000)` devolve.)

- [ ] **Step 2:** Rodar → FAIL.
- [ ] **Step 3:** Implementar `mecanicas.ts`, `mapaTela.ts`, `lugarTela.ts`, as dicas, a porta, o CSS e o mock.
- [ ] **Step 4:** `npx vitest run --maxWorkers=4` e `npx tsc --noEmit -p games` passam.
- [ ] **Step 5: Conferência no navegador** (`npm run dev --prefix games`, `?mock`, música mutada pelo localStorage como
      em [[testar-sem-musica]]): porta do Mapa abre; 9 pinos; abrir a camisetaria com o painel do mock (dar F$ e era 2);
      entrar; subir nível; pódio vazio sem quebrar. Conferir 1280×720, 2000×961 e celular num iframe de 390 px.
      Matar o vite da 5199 no fim (comando em [[memoria-node]]).
- [ ] **Step 6:** `git commit -m "Fellas Inc.: tela do Mapa do rolê (pinos, moldura do lugar, pódio, marcos, desafio, caixinhas)"`

---

### Task 8: o SQL privado e os ícones das conquistas (fora do repo + assets)

**Files:**
- Create (FORA do repo): `../fellas-inc-esbocos/lugares/gerar-carregar.js`, `../fellas-inc-esbocos/lugares/textos.json`,
  saída `../fellas-inc-esbocos/lugares/carregar.sql`
- Create (no repo): `games/idle/assets/conquistas/conquista-083.png` … `conquista-086.png` (16×16)

`textos.json` (fora do repo): `{ "1": { "nome": "...", "frase": "..." }, ... "9": {...} }`. **Os ids seguem a ordem da
tabela "Os lugares" do `BRIEF-LUGARES.md` (1ª linha = 1, ..., 9ª = 9)**, que é a mesma ordem dos apelidos. Nomes = coluna
"Lugar"; frases: uma linha curta no tom do jogo para cada lugar, escritas e mostradas ao Juan antes de rodar.

`gerar-carregar.js` (Node, sem dependência): lê `png/lugar-*.png` (o nome do arquivo → id pela mesma tabela do brief,
escrita só dentro deste script), `png/mapa-do-role.png` e `mapa-pontos.json`; escreve `carregar.sql`:

```sql
begin;
insert into public.idle_places (id, nome, frase, icone, x, y) values
  (1, '<nome>', '<frase>', 'data:image/png;base64,<...>', <x>, <y>), ...
on conflict (id) do update set nome = excluded.nome, frase = excluded.frase, icone = excluded.icone, x = excluded.x, y = excluded.y;
insert into public.idle_map (id, png) values (1, 'data:image/png;base64,<...>')
on conflict (id) do update set png = excluded.png;
commit;
```

(Aspas simples escapadas dobrando; o ícone animado (a tira) não entra: usar o estático.)

Ícones 83–86: no estilo dos outros ícones de conquista (16×16, contorno preto), feitos com o kit de `../fellas-inc-esbocos`
(pino do mapa; mapa dobrado; coroa sobre pino; pódio). Genéricos: nada de lugar de verdade.

- [ ] **Step 1:** Escrever `textos.json` e mostrar os 9 nomes/frases ao Juan; esperar o ok nas frases.
- [ ] **Step 2:** Escrever e rodar `node gerar-carregar.js` (em `../fellas-inc-esbocos/lugares/`); conferir que
      `carregar.sql` roda num PGlite com as migrações (script de conferência local, fora do repo) e que
      `select count(*) from idle_places` = 9.
- [ ] **Step 3:** Gerar os 4 ícones e copiar para `games/idle/assets/conquistas/`; teste em `ativos` (se houver lista
      de ícones esperados, acrescentar 83–86).
- [ ] **Step 4:** `git commit -m "Fellas Inc.: ícones das conquistas do Mapa do rolê"` (só os PNGs genéricos).

---

### Task 9: fechamento da parte 1

- [ ] **Step 1:** No worktree: `npx vitest run --maxWorkers=4` (em `games/`), `npx tsc --noEmit`, `npm test` (raiz).
- [ ] **Step 2:** `git grep -n -i -E "<cada nome real da coluna Lugar do brief>"` no branch inteiro: zero resultados
      (rodar com os nomes digitados no terminal, sem salvar em arquivo do repo).
- [ ] **Step 3:** Revisão do branch (superpowers:requesting-code-review) focada na Review Focus acima.
- [ ] **Step 4:** Conferir que não sobrou node (`Get-CimInstance Win32_Process -Filter "Name='node.exe'"`).
- [ ] **Step 5:** **Não** fazer merge nem push. A parte 2 (camisetaria) continua no mesmo branch. A patch note
      (`novidades.ts`) e o `db push` das migrações ficam para o fechamento da parte 4, com o lote inteiro.
