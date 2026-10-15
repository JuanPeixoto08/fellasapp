# Fellas Inc.: eras 1–5 (melhorias 150/200/300, eventos de era, conquistas) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Os 30 geradores ganham melhorias com 150/200/300 unidades, entra uma roda de "eventos de era" (5 eventos, um por era, com efeitos guardados no banco), 16 conquistas novas e o easter egg do Sillas.

**Architecture:** Catálogo (nomes.ts → catalogo.ts → migração gerada 0073) como hoje. Os eventos de era copiam o desenho dos dourados: a sorte é uma conta com semente (id + segundo) igual em TS (`eventosEra.ts`) e no banco (`idle_evento_era`), e o banco confere e paga (`idle_evento_pegar`, migração 0074). Os dois efeitos com tempo (Marmita ×3, melhorias −25%) são colunas novas em `idle_state` que entram no fechamento da conta e na compra, nos dois lados.

**Tech Stack:** TypeScript (Vite, sem framework), Vitest + PGlite (banco de teste), Postgres/Supabase (plpgsql).

**Spec:** `docs/superpowers/specs/2026-10-14-fellas-inc-eras-1-5-design.md`

## Global Constraints

- Trabalhar no worktree `C:\Users\juan\Documents\PROJETOSLLM\fellasapp-eras` (branch `eras-1-5`). `games/` precisa de `npm ci` de verdade (não junction); copiar `.env` e `supabase/.temp` da pasta principal.
- Texto da interface em pt-BR, no tom do jogo. Sem fato falso sobre pessoa real.
- Migrações novas: `0073_fellas_inc_catalogo_eras_1_5.sql` (gerada, nunca à mão) e `0074_fellas_inc_eventos_era.sql`. Nunca editar migração antiga. Toda migração nova entra em `games/test/db.ts` (array `MIGRATIONS`) e em `games/dev/mockDb.ts` (import `?raw` + array do `for`). O `mockDb.ts` está sem a 0071 e a 0072: pôr junto.
- `DELETE`/`UPDATE` no SQL sempre com `WHERE` (safeupdate do Supabase).
- Funções redefinidas partem da definição MAIS RECENTE: `idle_settle` (0064), `idle_buy`/`idle_save`/`idle_prestige` (0062), `idle_json` (0066), `idle_check_conquistas` (0055), `idle_dourado_pegar` (0061, só como modelo).
- Caixinha de informação (mouse no PC, foco no teclado; nada no celular) em toda coisa nova com número ou efeito.
- O easter egg do Sillas NÃO aparece em `novidades.ts` nem em nenhum texto do jogo.
- Testes dos jogos: `cd games && npx vitest run --maxWorkers=4 <arquivo>`. No fim: `npx tsc --noEmit` na raiz e em `games/`, e `npm test` na raiz. Depois de rodar o vite de teste, matar o processo da porta 5199 de verdade.
- Commits sem Co-Authored-By nem marca de IA.

## Review Focus

- A era muda entre o evento aparecer e o clique (comprou o 1º gerador da era seguinte): o banco recalcula com a era nova e pode dar outro tipo ou nenhum. Esperado: `idle_evento_gone`, que a página engole sem bonk nem aviso. Teste na Task 4.
- Aba escondida e volta: um evento cuja janela já passou não pode aparecer. Esperado: `mostrar` ignora com `agoraMs >= seg + janela`. Teste na Task 5.
- Vender a startup com Marmita ou Atualização valendo: as duas zeram, os contadores `eventos_era` não. Teste na Task 4.
- Atualização que acabou há menos de 1 s ainda vale na compra (a tela mostrava −25%, igual à Promoção). Teste na Task 3.
- Resposta do banco sem os campos novos (página nova antes da 0074 ou estado antigo): `marmita_ate`/`upg_desc_ate` ausentes contam como sem bônus, sem quebrar a conta. Teste na Task 3.

---

## File Structure

| Arquivo | O que faz |
|---|---|
| `games/idle/nomes.ts` (mod) | 8 melhorias por gerador; tipos de conquista novos; conquistas 116–131 |
| `games/idle/catalogo.ts` (mod) | `NIVEIS` e `PRECO_NIVEL` com 8 posições |
| `games/idle/eventosEra.ts` (novo) | A sorte dos eventos de era, o prêmio da Shopee, janelas, ganhos, textos e o que está valendo (puro) |
| `games/idle/eventoEraTela.ts` (novo) | Desenha os eventos na tela, a bola do Jogo do Brasil e chama `aoPegar` |
| `games/idle/segredo.ts` (novo) | Contador de 3 cliques (puro) |
| `games/idle/economia.ts` (mod) | `produzido`/`acumular`/`acumularTrechos` com a Marmita |
| `games/idle/store.ts` (mod) | `valuationAgora` passa a Marmita |
| `games/idle/dourados.ts` (mod) | `selosBonus` com os selos novos (e a dica de cada selo) |
| `games/idle/dica.ts` (mod) | `dicaEventoEra` |
| `games/idle/tela.ts` (mod) | ícones dos níveis novos, preço da melhoria com −25%, selos com dica, camada dos eventos, easter egg |
| `games/idle/main.ts` (mod) | roda dos eventos no passo de 1 s, pegar, re-render quando o −25% liga/desliga |
| `games/idle/idle.css` (mod) | ícones `rubi`/`esmeralda`/`cosmo`, eventos, overlay do Sillas |
| `games/idle/audio/efeitos.ts` (mod) | sons `mae`, `shopee`, `call`, `telaAzul`, `gol` |
| `games/idle/novidades.ts` (mod) | entrada nova |
| `games/shared/types.ts`, `games/shared/api.ts`, `games/dev/mockIdle.ts` (mod) | campos novos, `idleEventoPegar`, `__eventoEra` |
| `supabase/migrations/0073_…`, `0074_…` (novos) | catálogo; eventos e efeitos |
| `games/test/idleEventosEra.test.ts` (novo) | paridade e regras do banco |

---

### Task 1: Catálogo: níveis 150/200/300, os 90 nomes, as conquistas 116–131 e a 0073

**Files:**
- Modify: `games/idle/nomes.ts` (MELHORIAS_GERADOR l.17-48, TipoConquista l.157-173, CONQUISTAS l.218-306)
- Modify: `games/idle/catalogo.ts:18-19`
- Modify: `games/idle/tela.ts:114`, `games/idle/idle.css:146-147`
- Modify: `games/idle/catalogo.test.ts:20-62`
- Create: `supabase/migrations/0073_fellas_inc_catalogo_eras_1_5.sql` (gerada)
- Modify: `games/test/db.ts:14-47`, `games/dev/mockDb.ts:32-56`

**Interfaces:**
- Produces: melhorias `g·10+6..8` (`nivel` 6..8, `requer` 150/200/300); tipos de conquista `'evt_mae' | 'evt_shopee' | 'evt_call' | 'evt_tela' | 'evt_gols' | 'era_300' | 'era_melhorias'` (usados pela Task 4).

- [ ] **Step 1: Atualizar os testes do catálogo (falham)**

Em `games/idle/catalogo.test.ts`, no teste das melhorias:

```ts
  it('melhorias: 240 de gerador, 20 gerais, 30 sinergias, ids únicos', () => {
    const m = catalogo.melhorias;
    expect(m.filter((x) => x.tipo === 'gerador')).toHaveLength(240);
    expect(m.filter((x) => x.tipo === 'geral')).toHaveLength(20);
    expect(m.filter((x) => x.tipo === 'sinergia')).toHaveLength(30);
    expect(new Set(m.map((x) => x.id)).size).toBe(290);
    expect(m.find((x) => x.id === 71)).toMatchObject({ tipo: 'gerador', gerador: 7, nivel: 1, requer: 1, nome: 'Crachá com foto' });
    expect(m.find((x) => x.id === 305)).toMatchObject({ gerador: 30, nivel: 5, requer: 100 });
    expect(m.find((x) => x.id === 16)).toMatchObject({ gerador: 1, nivel: 6, requer: 150, nome: 'ChatGPT fazendo o TCC' });
    expect(m.find((x) => x.id === 138)).toMatchObject({ gerador: 13, nivel: 8, requer: 300, nome: 'Mensagem subliminar no episódio' });
    expect(m.find((x) => x.id === 308)).toMatchObject({ gerador: 30, nivel: 8, requer: 300, nome: 'Passagem só de ida' });
    // cada nível novo custa mais que o anterior do mesmo gerador
    for (let g = 1; g <= 30; g++) {
      const precos = [1, 2, 3, 4, 5, 6, 7, 8].map((k) => m.find((x) => x.id === g * 10 + k)!.preco);
      for (let k = 1; k < 8; k++) expect(precos[k]).toBeGreaterThan(precos[k - 1]);
    }
  });
```

No teste das conquistas: `toHaveLength(89)` → `toHaveLength(104)` e `toHaveLength(14)` → `toHaveLength(15)` (troque também "89 visíveis e 14 escondidas" no título). Na lista das escondidas (teste seguinte), acrescente `'Embaixo do lago prateado'` no fim do array esperado. Acrescente:

```ts
  it('as conquistas das eras 1–5 (116–131)', () => {
    const c = catalogo.conquistas;
    expect(c.find((x) => x.id === 120)).toMatchObject({ tipo: 'evt_gols', valor: 7, nome: '7 a 1 (pra nós)', escondida: false });
    for (let e = 1; e <= 5; e++) {
      expect(c.find((x) => x.id === 120 + e)).toMatchObject({ tipo: 'era_300', alvo: e });
      expect(c.find((x) => x.id === 125 + e)).toMatchObject({ tipo: 'era_melhorias', alvo: e });
    }
    expect(c.find((x) => x.id === 131)).toMatchObject({ tipo: 'melhoria', alvo: 138, escondida: true });
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd games && npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: FAIL (240 ≠ 150 e as contagens das conquistas).

- [ ] **Step 3: Nomes, níveis e conquistas**

Em `nomes.ts`, troque o tipo de `MELHORIAS_GERADOR` pra tupla de 8 e acrescente os 3 nomes no fim de cada linha, na ordem (150, 200, 300), exatamente os da tabela da spec (seção 1). Exemplo das duas primeiras linhas:

```ts
/** As 8 melhorias de cada gerador (níveis 1, 10, 25, 50, 100, 150, 200 e 300 unidades); cada uma dobra o gerador. */
export const MELHORIAS_GERADOR: readonly (readonly [string, string, string, string, string, string, string, string])[] = [
  ['Carregador original', 'Wi-Fi da biblioteca', 'Segundo monitor', 'Café de máquina', 'Noite virada', 'ChatGPT fazendo o TCC', 'Starlink no quarto', 'Aviso de despejo em 5 dias'],
  ['Foto de terno', 'Textão com emoji', 'Selo de "open to work"', 'Post às 7h da manhã', 'Viralizou no feed', 'Carrossel de 10 slides', 'Selfie chorando depois do layoff', 'Selo de Top Voice'],
  // … as outras 28 linhas com os nomes da tabela da spec, na mesma ordem dos geradores
];
```

(Os 90 nomes estão todos na tabela da spec; copie linha por linha.)

Em `TipoConquista`, acrescente antes do `;` final:

```ts
  // eras 1–5 (0074): eventos de era (evento) e "a era inteira" (estado)
  | 'evt_mae' | 'evt_shopee' | 'evt_call' | 'evt_tela' | 'evt_gols' | 'era_300' | 'era_melhorias'
```

Em `CONQUISTAS`, logo depois da 89 (antes da 101, pra ficarem na grade antes das escondidas):

```ts
  // eras 1–5 (0073): eventos de era, 300 de cada gerador da era, todas as melhorias da era
  { id: 116, tipo: 'evt_mae', valor: 10, nome: 'Já vou, mãe!', frase: 'Disse "já vou" dez vezes. Ela sabe que é mentira.', condicao: 'Atender a mãe 10 vezes' },
  { id: 117, tipo: 'evt_shopee', valor: 10, nome: 'Taxa das blusinhas', frase: 'Pagou imposto em dez pacotes de coisa que você nem lembra que comprou.', condicao: 'Abrir 10 pacotes da Shopee' },
  { id: 118, tipo: 'evt_call', valor: 25, nome: 'Podia ser um e-mail', frase: 'Fugiu de vinte e cinco reuniões. Ninguém percebeu, nem quando você estava nelas.', condicao: 'Sair de 25 reuniões' },
  { id: 119, tipo: 'evt_tela', valor: 10, nome: 'Já tentou desligar e ligar?', frase: 'Dez telas azuis. O TI mandou abrir chamado.', condicao: 'Reiniciar 10 telas azuis' },
  { id: 120, tipo: 'evt_gols', valor: 7, nome: '7 a 1 (pra nós)', frase: 'Agora sim. Ninguém do grupo lembra de 2014.', condicao: 'Fazer os 7 gols num Jogo do Brasil' },
  { id: 121, tipo: 'era_300', alvo: 1, nome: 'Quarto lotado', frase: 'Trezentos de cada coisa e a cama ainda é um colchão no chão.', condicao: 'Ter 300 de cada gerador da era 1' },
  { id: 122, tipo: 'era_300', alvo: 2, nome: 'A garagem não fecha mais', frase: 'O carro do seu pai dorme na rua há dois anos.', condicao: 'Ter 300 de cada gerador da era 2' },
  { id: 123, tipo: 'era_300', alvo: 3, nome: 'Open space', frase: 'Sem parede, sem privacidade, sem saída.', condicao: 'Ter 300 de cada gerador da era 3' },
  { id: 124, tipo: 'era_300', alvo: 4, nome: 'A Faria Lima é minha', frase: 'Cada colete da avenida tem o seu logo.', condicao: 'Ter 300 de cada gerador da era 4' },
  { id: 125, tipo: 'era_300', alvo: 5, nome: 'Holding das holdings', frase: 'Uma empresa dona da outra, e nenhuma paga imposto.', condicao: 'Ter 300 de cada gerador da era 5' },
  { id: 126, tipo: 'era_melhorias', alvo: 1, nome: 'Setup completo', frase: 'Tudo comprado. Agora só falta sair do quarto.', condicao: 'Comprar todas as melhorias da era 1' },
  { id: 127, tipo: 'era_melhorias', alvo: 2, nome: 'Garagem tunada', frase: 'Melhoria de sobra e o portão ainda é manual.', condicao: 'Comprar todas as melhorias da era 2' },
  { id: 128, tipo: 'era_melhorias', alvo: 3, nome: 'Escritório premium', frase: 'Até a cadeira da reunião faz massagem. A reunião continua inútil.', condicao: 'Comprar todas as melhorias da era 3' },
  { id: 129, tipo: 'era_melhorias', alvo: 4, nome: 'Andar de luxo', frase: 'Banheiro novo pra estagiário chorar com conforto.', condicao: 'Comprar todas as melhorias da era 4' },
  { id: 130, tipo: 'era_melhorias', alvo: 5, nome: 'Sede cinco estrelas', frase: 'Heliponto, academia e um RH que não responde.', condicao: 'Comprar todas as melhorias da era 5' },
```

E no fim do array (depois da 115):

```ts
  { id: 131, escondida: true, tipo: 'melhoria', alvo: 138, nome: 'Embaixo do lago prateado', frase: 'Toda música tem uma mensagem escondida. Essa também.', condicao: 'Comprar "Mensagem subliminar no episódio"' },
```

Em `catalogo.ts`:

```ts
/** Quantas unidades liberam cada nível de melhoria de gerador, e o preço (× custo base do gerador). 150/200/300 desde
 *  14/10 (eras 1–5); os preços dos três novos saíram da simulação (simulacao.test.ts). */
export const NIVEIS = [1, 10, 25, 50, 100, 150, 200, 300] as const;
export const PRECO_NIVEL = [10, 50, 500, 50_000, 5_000_000, 5e9, 5e12, 5e18] as const;
```

Em `tela.ts:114`: `const NIVEL = ['bronze', 'prata', 'ouro', 'roxo', 'diamante', 'rubi', 'esmeralda', 'cosmo'];`

Em `idle.css`, depois da linha 147:

```css
.idle .icone.rubi { border-color: #E0454B; } .idle .icone.esmeralda { border-color: #5FD38D; }
.idle .icone.cosmo { border-color: #F2D27A; box-shadow: 0 0 0 1px #B8A2FF; }
```

- [ ] **Step 4: Gerar a 0073 e listar nos dois bancos**

Acrescente `'0073_fellas_inc_catalogo_eras_1_5.sql',` no fim de `MIGRATIONS` em `games/test/db.ts`. Em `games/dev/mockDb.ts`, acrescente os imports que faltam junto dos outros (`import m71 from '../../supabase/migrations/0071_fellas_inc_bolsa_melhoria_preco.sql?raw';`, `m72` com `0072_fellas_inc_copao_uma_prova.sql`, `m73` com `0073_fellas_inc_catalogo_eras_1_5.sql`) e `m71, m72, m73` no fim do array do `for`.

Run: `cd games && ATUALIZAR_CATALOGO=0073_fellas_inc_catalogo_eras_1_5.sql npx vitest run --maxWorkers=4 idle/catalogo.test.ts`
Expected: cria `supabase/migrations/0073_fellas_inc_catalogo_eras_1_5.sql` e PASS.

- [ ] **Step 5: Simulação (o ritmo não pode mudar)**

Run: `cd games && npx vitest run --maxWorkers=4 idle/simulacao.test.ts`
Expected: PASS. Se algum ritmo quebrar (era 5 antes do dia 4, pontos da 1ª semana acima da faixa), multiplique por 10 o `PRECO_NIVEL` do nível mais barato que a simulação compra (5e9 → 5e10, depois 5e12 → 5e13…), regere a 0073 (Step 4) e rode de novo até passar. Anote os valores finais no comentário de `PRECO_NIVEL`.

- [ ] **Step 6: Paridade dos textos e o resto dos testes do idle**

Run: `cd games && npx vitest run --maxWorkers=4 idle test/idleConquistas.test.ts`
Expected: PASS (o teste "os textos das conquistas no jogo (nomes.ts) são os do banco" pega a 0073).

- [ ] **Step 7: Commit**

```bash
git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts games/idle/tela.ts games/idle/idle.css supabase/migrations/0073_fellas_inc_catalogo_eras_1_5.sql games/test/db.ts games/dev/mockDb.ts
git commit -m "Fellas Inc.: melhorias 150/200/300 nos 30 geradores e as conquistas das eras 1–5 (0073)"
```

---

### Task 2: A sorte dos eventos de era (TS + banco, paridade)

**Files:**
- Create: `games/idle/eventosEra.ts`, `games/idle/eventosEra.test.ts`
- Create: `supabase/migrations/0074_fellas_inc_eventos_era.sql` (parte A)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (0074)
- Create: `games/test/idleEventosEra.test.ts`

**Interfaces:**
- Consumes: `semente` de `./oportunidades`.
- Produces (TS): `type TipoEventoEra = 1 | 2 | 3 | 4 | 5`; `ULTIMA_ERA_COM_EVENTO = 5`; `JANELA_EVENTO_S: Record<TipoEventoEra, number>`; `NOME_EVENTO_ERA: Record<TipoEventoEra, string>`; `MAX_GOLS = 7`; `eventoEraEm(uid: string, s: number, era: number): TipoEventoEra | null`; `premioShopee(uid: string, s: number): 0 | 1 | 2`; `posicaoEvento(uid: string, s: number, i?: number): { x: number; y: number }`.
- Produces (SQL): `public.idle_evento_era(u uuid, s bigint, era int) returns int`; `public.idle_evento_shopee(u uuid, s bigint) returns int`.

- [ ] **Step 1: Teste TS (falha)**

`games/idle/eventosEra.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { eventoEraEm, JANELA_EVENTO_S, MAX_GOLS, premioShopee } from './eventosEra';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const ini = 1_760_000_000;

describe('eventos de era: a sorte', () => {
  it('uns 1/1800 por segundo', () => {
    let n = 0;
    for (let s = ini; s < ini + 360_000; s++) if (eventoEraEm(A, s, 5) !== null) n++;
    expect(n).toBeGreaterThan(150);
    expect(n).toBeLessThan(260);
  });
  it('só os das eras até a sua; o da sua era sai ~3× mais que cada antigo', () => {
    const conta = [0, 0, 0, 0, 0, 0];
    for (let s = ini; s < ini + 2_000_000; s++) {
      const t = eventoEraEm(A, s, 3);
      if (t !== null) conta[t]++;
    }
    expect(conta[4] + conta[5]).toBe(0);
    expect(conta[3] / conta[1]).toBeGreaterThan(2);
    expect(conta[3] / conta[1]).toBeLessThan(4.5);
  });
  it('era 1: só a mãe; era acima de 5 conta como 5', () => {
    for (let s = ini; s < ini + 200_000; s++) {
      const t = eventoEraEm(A, s, 1);
      if (t !== null) expect(t).toBe(1);
    }
    for (let s = ini; s < ini + 50_000; s++) expect(eventoEraEm(A, s, 7)).toBe(eventoEraEm(A, s, 5));
  });
  it('o prêmio da Shopee: ~50% F$, ~35% Promoção, ~15% ×5', () => {
    const c = [0, 0, 0];
    for (let s = ini; s < ini + 20_000; s++) c[premioShopee(A, s)]++;
    expect(c[0] / 20_000).toBeCloseTo(0.5, 1);
    expect(c[1] / 20_000).toBeCloseTo(0.35, 1);
    expect(c[2] / 20_000).toBeCloseTo(0.15, 1);
  });
  it('janelas e gols', () => {
    expect(JANELA_EVENTO_S).toEqual({ 1: 8, 2: 12, 3: 12, 4: 5, 5: 30 });
    expect(MAX_GOLS).toBe(7);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/eventosEra.test.ts` → FAIL (módulo não existe).

- [ ] **Step 2: `eventosEra.ts` (a parte da sorte)**

```ts
// Eventos de era (14/10): um por era, separados dos dourados. Sorte com semente (id do jogador + segundo), igual ao banco
// (idle_evento_era na 0074), que confere o clique e paga. O evento de uma era entra na roda quando você chega nela e
// continua depois; o da sua era atual pesa 3, os antigos 1. BigInt: os quadrados passam de 2^53.
import { semente } from './oportunidades';

export type TipoEventoEra = 1 | 2 | 3 | 4 | 5;
/** A última era que tem evento (as eras 6+ trazem os delas nas entregas seguintes). */
export const ULTIMA_ERA_COM_EVENTO = 5;
export const CHANCE_EVENTO = 1800; // 1 em 1800 por segundo
export const NOME_EVENTO_ERA: Record<TipoEventoEra, string> = {
  1: 'Desce pra almoçar!', 2: 'Pacote da Shopee', 3: 'Reunião que podia ser um e-mail', 4: 'Tela azul', 5: 'Jogo do Brasil',
};
/** Quanto tempo cada um fica na tela (s); o banco aceita 3 s a mais (rede). */
export const JANELA_EVENTO_S: Record<TipoEventoEra, number> = { 1: 8, 2: 12, 3: 12, 4: 5, 5: 30 };
export const MAX_GOLS = 7;

const P = 2147483647n;
const K = 1013904223n;
const mistura = (x: bigint) => (x * x + K) % P;

function h2(uid: string, s: number): bigint {
  const b = BigInt(s);
  return mistura((b * b * 16807n + b * 69621n + BigInt(semente(uid)) * 48271n + 4242n) % P);
}

/** O evento de era do segundo `s` pra quem está na era `era`, ou null. */
export function eventoEraEm(uid: string, s: number, era: number): TipoEventoEra | null {
  const h = h2(uid, s);
  if (h % BigInt(CHANCE_EVENTO) !== 0n) return null;
  const ate = Math.max(1, Math.min(era, ULTIMA_ERA_COM_EVENTO));
  const total = ate - 1 + 3; // os antigos pesam 1, o da sua era 3
  let r = Number(mistura(h) % BigInt(total));
  for (let e = 1; e <= ate; e++) {
    r -= e === ate ? 3 : 1;
    if (r < 0) return e as TipoEventoEra;
  }
  return ate as TipoEventoEra;
}

/** O que sai na caixa da Shopee: 0 = 1 h de produção menos 20%, 1 = Promoção por 1 min, 2 = ×5 por 2 min. */
export function premioShopee(uid: string, s: number): 0 | 1 | 2 {
  const r = Number(mistura(h2(uid, s) + 31337n) % 100n);
  return r < 50 ? 0 : r < 85 ? 1 : 2;
}

/** Onde aparece (fração da tela, longe das bordas); `i` = o pulo da bola no Jogo do Brasil. Só da página. */
export function posicaoEvento(uid: string, s: number, i = 0): { x: number; y: number } {
  const h = Number(mistura(mistura(h2(uid, s) + BigInt(i * 7919 + 1))));
  return { x: 0.1 + ((h % 1000) / 1000) * 0.7, y: 0.18 + ((Math.floor(h / 1000) % 1000) / 1000) * 0.6 };
}
```

Run: `npx vitest run --maxWorkers=4 idle/eventosEra.test.ts` → PASS.

- [ ] **Step 3: Teste de paridade com o banco (falha)**

`games/test/idleEventosEra.test.ts`:

```ts
// Eventos de era (0074): a sorte do banco é a da página, e as regras e efeitos do pegar.
import { beforeEach, describe, expect, it } from 'vitest';

import { eventoEraEm, premioShopee } from '../idle/eventosEra';
import { freshDb, type TestDb } from './db';

const A = '4a681416-b4ee-4976-8cdd-540cc816f28c';
const B = '098d04dc-bba1-433a-9ef8-0e9dd863e4ed';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

beforeEach(async () => {
  t = await freshDb({ conquistas: false });
});

describe('a sorte (paridade com eventosEra.ts)', () => {
  it('os mesmos segundos e tipos em 200 mil segundos, eras 1, 3 e 5, dois jogadores', async () => {
    const ini = 1_760_000_000;
    for (const u of [A, B]) for (const era of [1, 3, 5]) {
      const sql = await q<{ s: string; e: number }>(
        `select s::text, public.idle_evento_era($1::uuid, s, $4) as e from generate_series($2::bigint, $3::bigint) s
          where public.idle_evento_era($1::uuid, s, $4) is not null order by s`, [u, ini, ini + 200_000 - 1, era]);
      const ts: { s: string; e: number }[] = [];
      for (let s = ini; s < ini + 200_000; s++) {
        const e = eventoEraEm(u, s, era);
        if (e !== null) ts.push({ s: String(s), e });
      }
      expect(ts.length).toBeGreaterThan(60);
      expect(sql).toEqual(ts);
    }
  });
  it('o prêmio da Shopee é o mesmo', async () => {
    const ini = 1_760_000_000;
    const sql = await q<{ p: number }>(
      'select public.idle_evento_shopee($1::uuid, s) as p from generate_series($2::bigint, $3::bigint) s order by s', [A, ini, ini + 2999]);
    expect(sql.map((x) => x.p)).toEqual(Array.from({ length: 3000 }, (_, i) => premioShopee(A, ini + i)));
  });
});
```

Acrescente `'0074_fellas_inc_eventos_era.sql',` em `MIGRATIONS` (`games/test/db.ts`) e `m74` (import + array) em `games/dev/mockDb.ts`.

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEventosEra.test.ts` → FAIL (arquivo 0074 não existe / função não existe).

- [ ] **Step 4: 0074, parte A (a sorte)**

Crie `supabase/migrations/0074_fellas_inc_eventos_era.sql`:

```sql
-- fellasapp: Fellas Inc., eventos de era (14/10, entrega 4 do plano das eras 6–12). Um evento por era, numa roda
-- separada dos dourados: a sorte é a de eventosEra.ts (semente id + segundo), o banco confere o clique e paga. A Marmita
-- da mãe (produção ×3 por 3 min) e a Atualização instalada (melhorias −25% por 2 min) ficam guardadas no estado e valem
-- no fechamento da conta e na compra. Idempotente.

-- ===== parte A: a sorte =====
-- o evento do segundo s pra quem está na era `era` (1 a 5; acima de 5 conta como 5), ou null. O da era atual pesa 3, os
-- antigos 1 (igual a eventoEraEm)
create or replace function public.idle_evento_era(u uuid, s bigint, era int)
returns int language plpgsql immutable set search_path = public as $$
declare
  p   constant numeric := 2147483647;
  k   constant numeric := 1013904223;
  h   numeric;
  v_ate int := greatest(1, least(era, 5));
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

-- o que sai na caixa da Shopee: 0 = 1 h de produção menos 20%, 1 = Promoção por 1 min, 2 = ×5 por 2 min (igual a premioShopee)
create or replace function public.idle_evento_shopee(u uuid, s bigint)
returns int language plpgsql immutable set search_path = public as $$
declare
  p constant numeric := 2147483647;
  k constant numeric := 1013904223;
  h numeric;
  r int;
begin
  h := mod(s::numeric * s * 16807 + s::numeric * 69621 + public.idle_opp_seed(u)::numeric * 48271 + 4242, p);
  h := mod(h * h + k, p);
  r := mod(mod((h + 31337) * (h + 31337) + k, p), 100)::int;
  return case when r < 50 then 0 when r < 85 then 1 else 2 end;
end;
$$;
revoke all on function public.idle_evento_shopee(uuid, bigint) from public, anon, authenticated;
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEventosEra.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add games/idle/eventosEra.ts games/idle/eventosEra.test.ts games/test/idleEventosEra.test.ts supabase/migrations/0074_fellas_inc_eventos_era.sql games/test/db.ts games/dev/mockDb.ts
git commit -m "Fellas Inc.: a sorte dos eventos de era (página e banco iguais)"
```

---

### Task 3: Marmita e Atualização no estado, na conta e na compra (TS + banco)

**Files:**
- Modify: `supabase/migrations/0074_fellas_inc_eventos_era.sql` (parte B)
- Modify: `games/shared/types.ts` (IdleState, perto de `promo_ate`)
- Modify: `games/idle/economia.ts:227-275` (`produzido`, `acumular`, `acumularTrechos`)
- Modify: `games/idle/store.ts:24-29`
- Modify: `games/idle/eventosEra.ts` (o que está valendo)
- Modify: `games/idle/tela.ts:443-447`, `games/idle/main.ts:687-691`
- Test: `games/idle/economia.test.ts`, `games/idle/eventosEra.test.ts`, `games/test/idleEventosEra.test.ts`

**Interfaces:**
- Produces (TS): em `IdleState`: `marmita_ate?: string | null; upg_desc_ate?: string | null; eventos_era?: Record<string, number>; evento?: EventoPago` com `export type EventoPago = { tipo: number; premio: number | null; ganho: number; gols: number }`. `produzido(r, a, b, boostAteMs, virais = [], viralMs = VIRAL_MS, marmitaAteMs: number | null = null)` (o mesmo parâmetro no fim de `acumular` e `acumularTrechos`). Em `eventosEra.ts`: `MARMITA_MULT = 3`, `DESCONTO_MELHORIA = 0.75`, `marmitaAtiva(s: { marmita_ate?: string | null }, agoraMs: number): boolean`, `descontoAtivo(s: { upg_desc_ate?: string | null }, agoraMs: number): boolean`.
- Produces (SQL): colunas `idle_state.marmita_ate timestamptz`, `idle_state.upg_desc_ate timestamptz`, `idle_state.eventos_era jsonb not null default '{}'`; `idle_json` devolve `marmita_ate`, `upg_desc_ate` (só se no futuro) e `eventos_era`.

- [ ] **Step 1: Testes TS (falham)**

Em `games/idle/economia.test.ts`:

```ts
describe('Marmita da mãe (×3) no produzido', () => {
  it('×3 até o fim da marmita, multiplicando com ×5 e Viralizou', () => {
    // r = 1/s, de 0 a 100 s, marmita até 40 s: 40·3 + 60 = 180
    expect(produzido(1, 0, 100_000, null, [], VIRAL_MS, 40_000)).toBeCloseTo(180, 6);
    // com um ×5 até 20 s: 20·15 + 20·3 + 60 = 420
    expect(produzido(1, 0, 100_000, [20_000], [], VIRAL_MS, 40_000)).toBeCloseTo(420, 6);
    // com um Viralizou de 0 a 60 s (fim 60 s): 40·30 + 20·10 + 40 = 1440
    expect(produzido(1, 0, 100_000, null, [60_000], VIRAL_MS, 40_000)).toBeCloseTo(1440, 6);
  });
  it('sem marmita (null ou já passou) é a conta de antes', () => {
    expect(produzido(2, 0, 10_000, null, [], VIRAL_MS, null)).toBeCloseTo(20, 6);
    expect(produzido(2, 50_000, 60_000, null, [], VIRAL_MS, 40_000)).toBeCloseTo(20, 6);
  });
});
```

Em `games/idle/eventosEra.test.ts`:

```ts
import { descontoAtivo, marmitaAtiva } from './eventosEra';
describe('o que está valendo', () => {
  it('marmita e desconto pelo fim; campo ausente ou null = nada', () => {
    const agora = Date.parse('2026-10-14T12:00:00Z');
    expect(marmitaAtiva({ marmita_ate: '2026-10-14T12:01:00Z' }, agora)).toBe(true);
    expect(marmitaAtiva({ marmita_ate: '2026-10-14T11:59:00Z' }, agora)).toBe(false);
    expect(marmitaAtiva({}, agora)).toBe(false);
    expect(descontoAtivo({ upg_desc_ate: null }, agora)).toBe(false);
    expect(descontoAtivo({ upg_desc_ate: '2026-10-14T12:00:30Z' }, agora)).toBe(true);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/eventosEra.test.ts` → FAIL.

- [ ] **Step 2: Implementar no TS**

`games/shared/types.ts`, no `IdleState` (junto de `promo_ate`):

```ts
  /** Marmita da mãe (evento de era 1): produção ×3 até aqui. Ausente/null = sem (0074). */
  marmita_ate?: string | null;
  /** Atualização instalada (evento de era 4): melhorias 25% mais baratas até aqui. */
  upg_desc_ate?: string | null;
  /** Quantas vezes pegou cada evento de era ({"mae": 3, "shopee": 1, ...}); não zera na venda. */
  eventos_era?: Record<string, number>;
  /** Só na resposta de idle_evento_pegar: o que saiu. */
  evento?: EventoPago;
```

e no mesmo arquivo: `export type EventoPago = { tipo: number; premio: number | null; ganho: number; gols: number };`

`economia.ts` — `produzido` ganha o parâmetro e o ponto de corte:

```ts
export function produzido(
  r: number, a: number, b: number, boostAteMs: Boosts, virais: readonly number[] = [], viralMs = VIRAL_MS,
  marmitaAteMs: number | null = null,
): number {
  if (b <= a) return 0;
  const boosts = listaBoosts(boostAteMs);
  const pontos = [a, b];
  for (const f of boosts) if (f > a && f < b) pontos.push(f);
  for (const f of virais) for (const x of [f - viralMs, f]) if (x > a && x < b) pontos.push(x);
  if (marmitaAteMs !== null && marmitaAteMs > a && marmitaAteMs < b) pontos.push(marmitaAteMs);
  pontos.sort((x, y) => x - y);
  let total = 0;
  for (let i = 0; i + 1 < pontos.length; i++) {
    const p = pontos[i];
    const q = pontos[i + 1];
    if (q <= p) continue;
    const meio = (p + q) / 2;
    const k = virais.filter((f) => f - viralMs <= meio && f > meio).length;
    const kb = boosts.filter((f) => f > meio).length;
    // ×5 somam (×10, ×15); Viralizou multiplica (×100, ×1000); a Marmita (×3) multiplica por cima. A marmita começou
    // antes de `a` (pegar fecha a conta), então só o fim importa.
    const m = (kb ? 5 * kb : 1) * 10 ** k * (marmitaAteMs !== null && marmitaAteMs > meio ? 3 : 1);
    total += (r * m * (q - p)) / 1000;
  }
  return total;
}
```

Atualize o comentário de cima ("Igual a idle_settle na 0074"). Em `acumular` e `acumularTrechos`, acrescente `marmitaAteMs: number | null = null` no fim da assinatura e repasse pra cada chamada de `produzido`.

`store.ts` `valuationAgora`:

```ts
  const marmita = a.estado.marmita_ate ? Date.parse(a.estado.marmita_ate) : null; // Marmita da mãe: ×3 (0074)
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost, virais,
    VIRAL_MS * efeitos(a.estado).douradoDuracao, marmita);
```

`eventosEra.ts`, no fim:

```ts
// ---------- o que está valendo ----------
export const MARMITA_MULT = 3;
export const DESCONTO_MELHORIA = 0.75;
const vale = (iso: string | null | undefined, agoraMs: number) => !!iso && Date.parse(iso) > agoraMs;
/** Marmita da mãe valendo (produção ×3). */
export const marmitaAtiva = (s: { marmita_ate?: string | null }, agoraMs: number) => vale(s.marmita_ate, agoraMs);
/** Atualização instalada valendo (melhorias −25%). */
export const descontoAtivo = (s: { upg_desc_ate?: string | null }, agoraMs: number) => vale(s.upg_desc_ate, agoraMs);
```

`tela.ts:445`:

```ts
  const custoMelhoria = (s: IdleState) => custoAgora(s) * (1 - (s.horta_bonus?.melhorias ?? 0)) * custosConv(s).melhorias
    * (descontoAtivo(s, agoraTela) ? DESCONTO_MELHORIA : 1); // Atualização instalada (o banco aplica igual)
```

(import `descontoAtivo, DESCONTO_MELHORIA` de `./eventosEra`). Em `main.ts`, junto do `promoValia` (l.687-691):

```ts
  const desc = descontoAtivo(ancora.estado, agoraMs);
  if (desc !== descValia) {
    descValia = desc;
    render();
  }
```

com `let descValia = false;` declarado ao lado de `let promoValia`.

Run: `cd games && npx vitest run --maxWorkers=4 idle/economia.test.ts idle/eventosEra.test.ts idle/store.test.ts` → PASS.

- [ ] **Step 3: Testes do banco (falham)**

Em `games/test/idleEventosEra.test.ts`, acrescente:

```ts
import { produzido, VIRAL_MS } from '../idle/economia';

const taxa = async () => (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;

describe('Marmita e Atualização no banco', () => {
  beforeEach(async () => {
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
  });

  it('fechar a conta com a Marmita é igual a produzido (sozinha, com ×5 e com Viralizou)', async () => {
    for (const [boost, viral] of [[null, null], [20, null], [null, 60]] as const) {
      await q(`update public.idle_state set settled_at = now(), marmita_ate = now() + interval '40 seconds',
                 boost_ate = case when $2::int is null then '{}' else array[now() + make_interval(secs => $2)] end,
                 viral_ate = case when $3::int is null then '{}' else array[now() + make_interval(secs => $3)] end
               where user_id = $1`, [A, boost, viral]);
      const r = await taxa();
      const [{ v0, v1 }] = await q<{ v0: number; v1: number }>(
        `select s.valuation as v0, (public.idle_settle(s, s.settled_at + interval '100 seconds')).valuation as v1
           from public.idle_state s where user_id = $1`, [A]);
      const esperado = produzido(r, 0, 100_000, boost === null ? null : [boost * 1000], viral === null ? [] : [viral * 1000], VIRAL_MS, 40_000);
      expect(v1 - v0).toBeCloseTo(esperado, 0);
    }
  });

  it('Atualização: a melhoria custa 75%; com Promoção, 37,5%; acabou há 0,5 s ainda vale', async () => {
    const preco = async () => (await q<{ p: number }>('select preco as p from public.idle_cat_upg where id = 11'))[0].p;
    const comprar = async () => {
      const antes = (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;
      await q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
      const s = await t.rpc<{ valuation: number }>('idle_buy', { p_kind: 'melhoria', p_id: 11, p_qty: 1 });
      await q('update public.idle_state set upgrades = array_remove(upgrades, 11) where user_id = $1', [A]);
      return antes - s.valuation;
    };
    const cheio = await preco();
    await q(`update public.idle_state set upg_desc_ate = now() + interval '60 seconds' where user_id = $1`, [A]);
    expect(await comprar()).toBeCloseTo(cheio * 0.75, 3);
    await q(`update public.idle_state set promo_ate = now() + interval '30 seconds' where user_id = $1`, [A]);
    expect(await comprar()).toBeCloseTo(cheio * 0.375, 3);
    await q(`update public.idle_state set promo_ate = null, upg_desc_ate = now() - interval '500 milliseconds' where user_id = $1`, [A]);
    expect(await comprar()).toBeCloseTo(cheio * 0.75, 3);
  });

  it('o JSON traz os campos novos e esconde os que já passaram', async () => {
    await q(`update public.idle_state set marmita_ate = now() + interval '1 minute', upg_desc_ate = now() - interval '1 minute',
               eventos_era = '{"mae": 2}' where user_id = $1`, [A]);
    const s = await t.rpc<{ marmita_ate: string | null; upg_desc_ate: string | null; eventos_era: Record<string, number> }>('idle_open');
    expect(s.marmita_ate).not.toBeNull();
    expect(s.upg_desc_ate).toBeNull();
    expect(s.eventos_era).toEqual({ mae: 2 });
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEventosEra.test.ts` → FAIL (colunas não existem).

- [ ] **Step 4: 0074, parte B**

Acrescente à `0074_fellas_inc_eventos_era.sql`:

```sql
-- ===== parte B: o estado, a conta e a compra =====
alter table public.idle_state
  add column if not exists marmita_ate  timestamptz,
  add column if not exists upg_desc_ate timestamptz,
  add column if not exists eventos_era  jsonb not null default '{}';
```

Depois, **copie inteiras** as definições mais recentes e mude só o indicado:

1. `idle_settle` (da 0064, inteira). No `for v_q in select x from (...)`, acrescente antes de `union select v_b`:
   ```sql
                     union select s.marmita_ate where s.marmita_ate > v_a and s.marmita_ate < v_b
   ```
   e troque a linha do `v_mult` por:
   ```sql
      -- a Marmita da mãe (×3, 0074) multiplica por cima; começou antes de settled_at (pegar fecha a conta), só o fim importa
      v_mult := (case when v_kb > 0 then 5 * v_kb else 1 end) * 10 ^ v_k
                * (case when s.marmita_ate > v_meio then 3 else 1 end);
   ```
   Comentário do topo: `-- fechar a conta (a da 0064) com a Marmita da mãe`.
2. `idle_buy` (da 0062, inteira). Na linha do `v_preco := u.preco * v_cm * ...` do ramo `melhoria`, acrescente no fim (antes do `;`):
   ```sql
               * (case when s.upg_desc_ate > now() - interval '1 second' then 0.75 else 1 end) -- Atualização instalada (0074)
   ```
3. `idle_save` (da 0062, inteira). No `set`, depois de `promo_ate = s.promo_ate,` acrescente:
   ```sql
         marmita_ate = s.marmita_ate, upg_desc_ate = s.upg_desc_ate, eventos_era = coalesce(s.eventos_era, '{}'),
   ```
4. `idle_prestige` (da 0062, inteira). Depois de `s.viral_ate := '{}';` acrescente:
   ```sql
  s.marmita_ate := null;  -- os bônus de tempo dos eventos de era zeram; os contadores (eventos_era) ficam
  s.upg_desc_ate := null;
   ```
5. `idle_json` (da 0066, inteira). Depois da linha do `'viral', ...` acrescente:
   ```sql
    'marmita_ate', case when s.marmita_ate > now() then s.marmita_ate end,
    'upg_desc_ate', case when s.upg_desc_ate > now() then s.upg_desc_ate end,
    'eventos_era', coalesce(s.eventos_era, '{}'::jsonb),
   ```

Mantenha os `revoke`/`grant` que vêm depois de cada função na migração de origem.

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEventosEra.test.ts test/idleDourado.test.ts test/idleParidade.test.ts test/idleEmpilha.test.ts` → PASS.

- [ ] **Step 5: Commit**

```bash
git add games/shared/types.ts games/idle/economia.ts games/idle/economia.test.ts games/idle/store.ts games/idle/eventosEra.ts games/idle/eventosEra.test.ts games/idle/tela.ts games/idle/main.ts games/test/idleEventosEra.test.ts supabase/migrations/0074_fellas_inc_eventos_era.sql
git commit -m "Fellas Inc.: Marmita (×3) e Atualização (melhorias −25%) no estado, na conta e na compra"
```

---

### Task 4: Pegar o evento de era, os contadores e as conquistas (banco + api)

**Files:**
- Modify: `supabase/migrations/0074_fellas_inc_eventos_era.sql` (parte C)
- Modify: `games/shared/api.ts:65`, `games/dev/mockIdle.ts:46`, `games/idle/main.ts:33`
- Test: `games/test/idleEventosEra.test.ts`

**Interfaces:**
- Consumes: `idle_evento_era`, `idle_evento_shopee` (Task 2); colunas da Task 3; tipos de conquista da Task 1.
- Produces (SQL): `public.idle_evento_pegar(p_seg bigint, p_gols int default 0) returns jsonb` = `idle_json(s) || {"evento": {"tipo", "premio", "ganho", "gols"}}`; erros `idle_evento_gone`, `idle_evento_pego`. Tabela `idle_eventos_pegos (user_id, seg)`.
- Produces (TS): `api.idleEventoPegar(seg: number, gols: number): Promise<IdleState>`.

- [ ] **Step 1: Testes do banco (falham)**

Em `games/test/idleEventosEra.test.ts`:

```ts
describe('pegar um evento de era', () => {
  type J = { valuation: number; rate: number; promo_ate: string | null; boosts: string[]; marmita_ate: string | null;
    upg_desc_ate: string | null; eventos_era: Record<string, number>; evento: { tipo: number; premio: number | null; ganho: number; gols: number } };
  const agoraSeg = async () => Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
  const evento = (seg: number, tipo: number) =>
    q('insert into public.teste_evento values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
  const shopee = (seg: number, p: number) =>
    q('insert into public.teste_shopee values ($1, $2) on conflict (s) do update set p = excluded.p', [seg, p]);
  const pegar = (seg: number, gols = 0) => t.rpc<J>('idle_evento_pegar', { p_seg: seg, p_gols: gols });
  const parar = () => q(`update public.idle_state set settled_at = now() + interval '1 day' where user_id = $1`, [A]);
  const valor = async () => (await q<{ v: number }>('select valuation as v from public.idle_state where user_id = $1', [A]))[0].v;

  beforeEach(async () => {
    await t.db.exec(`
      create table public.teste_evento (s bigint primary key, tipo int);
      create table public.teste_shopee (s bigint primary key, p int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select tipo from public.teste_evento where teste_evento.s = idle_evento_era.s';
      create or replace function public.idle_evento_shopee(u uuid, s bigint) returns int language sql stable as
        'select coalesce((select p from public.teste_shopee where teste_shopee.s = idle_evento_shopee.s), 0)';`);
    await t.member(A);
    await t.member(B, { isMember: false });
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e12, generators[1] = 50, generators[2] = 20 where user_id = $1', [A]);
    await parar();
  });

  it('mãe: Marmita de 3 min; pegar outra soma 3 min no fim', async () => {
    const seg = await agoraSeg();
    await evento(seg, 1);
    const s = await pegar(seg);
    const agora = Date.parse((await q<{ n: string }>('select now()::text as n'))[0].n);
    expect(Date.parse(s.marmita_ate!) - agora).toBeCloseTo(180_000, -3);
    expect(s.eventos_era).toEqual({ mae: 1 });
    await evento(seg + 1, 1);
    const s2 = await pegar(seg + 1);
    expect(Date.parse(s2.marmita_ate!) - agora).toBeCloseTo(360_000, -3);
  });
  it('Shopee: os três prêmios', async () => {
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const seg = await agoraSeg();
    await evento(seg, 2); await shopee(seg, 0);
    const antes = await valor();
    const s0 = await pegar(seg);
    expect(s0.valuation - antes).toBeCloseTo(r * 3600 * 0.8, 2);
    expect(s0.evento).toMatchObject({ tipo: 2, premio: 0 });
    await evento(seg - 1, 2); await shopee(seg - 1, 1);
    const s1 = await pegar(seg - 1);
    expect(s1.promo_ate).not.toBeNull();
    await evento(seg - 2, 2); await shopee(seg - 2, 2);
    const s2 = await pegar(seg - 2);
    expect(s2.boosts).toHaveLength(1);
    expect(s2.eventos_era).toEqual({ shopee: 3 });
  });
  it('call: 30 min de produção; tela azul: −25% por 2 min', async () => {
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const seg = await agoraSeg();
    await evento(seg, 3);
    const antes = await valor();
    expect((await pegar(seg)).valuation - antes).toBeCloseTo(r * 1800, 2);
    await evento(seg - 1, 4);
    expect((await pegar(seg - 1)).upg_desc_ate).not.toBeNull();
  });
  it('Jogo do Brasil: 5 min por gol, no máximo 7; negativo vira 0', async () => {
    const r = (await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]))[0].r;
    const seg = await agoraSeg();
    await evento(seg - 25, 5);
    const antes = await valor();
    const s = await pegar(seg - 25, 9);
    expect(s.valuation - antes).toBeCloseTo(r * 300 * 7, 2);
    expect(s.evento).toMatchObject({ tipo: 5, gols: 7 });
    await evento(seg - 20, 5);
    const antes2 = await valor();
    expect((await pegar(seg - 20, -3)).valuation - antes2).toBeCloseTo(0, 6);
  });
  it('janela de cada tipo (+3 s), segundo sem evento, longe de agora e duas vezes', async () => {
    const seg = await agoraSeg();
    await evento(seg - 12, 1); // mãe: 8 + 3 = 11 s
    await expect(pegar(seg - 12)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg - 10, 1);
    await expect(pegar(seg - 10)).resolves.toBeTruthy();
    await expect(pegar(seg - 10)).rejects.toThrow(/idle_evento_pego/);
    await expect(pegar(seg - 5)).rejects.toThrow(/idle_evento_gone/);
    await evento(seg + 30, 3);
    await expect(pegar(seg + 30)).rejects.toThrow(/idle_evento_gone/);
    await expect(pegar(9_000_000_000_000_000)).rejects.toThrow(/idle_evento_gone/);
  });
  it('quem não é membro não pega', async () => {
    await t.as(B);
    await expect(pegar(await agoraSeg())).rejects.toThrow(/not_member/);
  });
  it('vender a startup zera Marmita e Atualização, não os contadores', async () => {
    const seg = await agoraSeg();
    await evento(seg, 1);
    await pegar(seg);
    await q(`update public.idle_state set upg_desc_ate = now() + interval '1 minute', prestige_earned = 0 where user_id = $1`, [A]);
    await q('update public.idle_state set valuation = 1e30, generators[20] = 50 where user_id = $1', [A]);
    await t.rpc('idle_prestige');
    const [l] = await q<{ m: string | null; d: string | null; e: Record<string, number> }>(
      'select marmita_ate::text as m, upg_desc_ate::text as d, eventos_era as e from public.idle_state where user_id = $1', [A]);
    expect(l).toEqual({ m: null, d: null, e: { mae: 1 } });
  });
});

describe('conquistas das eras 1–5', () => {
  beforeEach(async () => {
    t = await freshDb(); // com o catálogo das conquistas
    await t.db.exec(`
      create table public.teste_evento (s bigint primary key, tipo int);
      create or replace function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select tipo from public.teste_evento where teste_evento.s = idle_evento_era.s';`);
    await t.member(A);
    await t.as(A);
    await t.rpc('idle_start');
    await q('update public.idle_state set valuation = 1e40 where user_id = $1', [A]);
  });
  const tem = async (id: number) =>
    (await q('select 1 from public.idle_conquistas where user_id = $1 and conquista_id = $2', [A, id])).length > 0;

  it('mãe 10 vezes = "Já vou, mãe!"; 7 gols = "7 a 1 (pra nós)"', async () => {
    const seg = Number((await q<{ s: string }>('select floor(extract(epoch from now()))::bigint::text as s'))[0].s);
    await q(`update public.idle_state set eventos_era = '{"mae": 9}' where user_id = $1`, [A]);
    await q('insert into public.teste_evento values ($1, 1), ($2, 5)', [seg, seg - 1]);
    await t.rpc('idle_evento_pegar', { p_seg: seg, p_gols: 0 });
    expect(await tem(116)).toBe(true);
    await t.rpc('idle_evento_pegar', { p_seg: seg - 1, p_gols: 6 });
    expect(await tem(120)).toBe(false);
    await q('insert into public.teste_evento values ($1, 5)', [seg - 2]);
    await t.rpc('idle_evento_pegar', { p_seg: seg - 2, p_gols: 7 });
    expect(await tem(120)).toBe(true);
  });
  it('300 de cada gerador da era 1 e todas as melhorias da era 1', async () => {
    await q('update public.idle_state set generators[1:6] = array[300,300,300,300,300,299] where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(121)).toBe(false);
    await q('update public.idle_state set generators[6] = 300 where user_id = $1', [A]);
    await t.rpc('idle_open');
    expect(await tem(121)).toBe(true);
    const todas = (await q<{ id: number }>(
      `select u.id from public.idle_cat_upg u left join public.idle_cat_gen g on g.id = u.gerador
        where (u.tipo = 'gerador' and g.era = 1) or (u.tipo = 'geral' and u.requer_era = 1)`)).map((x) => x.id);
    expect(todas).toHaveLength(52);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas.slice(1)]);
    await t.rpc('idle_open');
    expect(await tem(126)).toBe(false);
    await q('update public.idle_state set upgrades = $2 where user_id = $1', [A, todas]);
    await t.rpc('idle_open');
    expect(await tem(126)).toBe(true);
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEventosEra.test.ts` → FAIL (`idle_evento_pegar` não existe).

- [ ] **Step 2: 0074, parte C**

Acrescente à `0074_fellas_inc_eventos_era.sql`:

```sql
-- ===== parte C: pegar =====
create table if not exists public.idle_eventos_pegos (
  user_id  uuid not null references public.idle_state (user_id) on delete cascade,
  seg      bigint not null,
  pegou_em timestamptz not null default now(),
  primary key (user_id, seg)
);
alter table public.idle_eventos_pegos enable row level security;
revoke all on public.idle_eventos_pegos from anon, authenticated;

-- pegar o evento de era do segundo p_seg. p_gols só vale no Jogo do Brasil (a página conta; o banco aceita 0 a 7).
-- Devolve o estado + "evento": {tipo, premio (Shopee: 0 F$, 1 Promoção, 2 ×5), ganho (F$ que entrou), gols}.
create or replace function public.idle_evento_pegar(p_seg bigint, p_gols int default 0)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  v_me    uuid := auth.uid();
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
  v_tipo := public.idle_evento_era(v_me, p_seg, public.idle_era(s.generators));
  v_ini := to_timestamp(p_seg);
  -- na tela: 8 / 12 / 12 / 5 / 30 s (igual a JANELA_EVENTO_S); o banco aceita 3 s a mais (rede)
  if v_tipo is null or now() < v_ini - interval '2 seconds'
     or now() > v_ini + make_interval(secs => (array[8, 12, 12, 5, 30])[v_tipo] + 3) then
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
    else -- Jogo do Brasil: 5 min de produção por gol, até 7
      v_gols := least(greatest(coalesce(p_gols, 0), 0), 7);
      v_ganho := v_rate * 300 * v_gols;
  end case;
  s.valuation := s.valuation + v_ganho;
  v_chave := (array['mae', 'shopee', 'call', 'tela', 'jogos'])[v_tipo];
  v_n := coalesce((s.eventos_era ->> v_chave)::int, 0) + 1;
  s.eventos_era := coalesce(s.eventos_era, '{}'::jsonb) || jsonb_build_object(v_chave, v_n);
  perform public.idle_ganhar(v_me, (array['evt_mae', 'evt_shopee', 'evt_call', 'evt_tela', 'evt_gols'])[v_tipo],
                             case when v_tipo = 5 then v_gols else v_n end);
  perform public.idle_save(s);
  return public.idle_json(s) || jsonb_build_object('evento', jsonb_build_object(
    'tipo', v_tipo, 'premio', v_premio, 'ganho', v_ganho, 'gols', v_gols));
end;
$$;
revoke all on function public.idle_evento_pegar(bigint, int) from public, anon;
grant execute on function public.idle_evento_pegar(bigint, int) to authenticated;
```

Depois, **copie inteira** `idle_check_conquistas` da 0055 e acrescente antes do `else false`:

```sql
             -- eras 1–5 (0074): 300 de cada gerador da era; todas as melhorias da era (as dos geradores dela + as gerais dela)
             when c.tipo = 'era_300' then not exists (
               select 1 from public.idle_cat_gen g where g.era = c.alvo and coalesce(s.generators[g.id], 0) < 300)
             when c.tipo = 'era_melhorias' then not exists (
               select 1 from public.idle_cat_upg u left join public.idle_cat_gen g on g.id = u.gerador
                where ((u.tipo = 'gerador' and g.era = c.alvo) or (u.tipo = 'geral' and u.requer_era = c.alvo))
                  and not (u.id = any (s.upgrades)))
```

(sem o `delete` do "Fez o L" que vem depois na 0055).

Atenção: a Shopee usa `v_premio` nulo nos outros tipos; o JSON manda `null`.

- [ ] **Step 3: api e mock**

`games/shared/api.ts`, depois da linha 65:

```ts
export const idleEventoPegar = (seg: number, gols: number) => rpc<IdleState>('idle_evento_pegar', { p_seg: seg, p_gols: gols });
```

`games/dev/mockIdle.ts`, depois da linha 46:

```ts
export const idleEventoPegar = (seg: number, gols: number) => call<IdleState>('select public.idle_evento_pegar($1, $2) as v', [seg, gols]);
```

Em `games/idle/main.ts:33`, acrescente `'idleEventoPegar'` na lista do tipo da api (logo depois de `'idleDouradoPegar'`).

Run: `cd games && npx vitest run --maxWorkers=4 test/idleEventosEra.test.ts test/idleConquistas.test.ts test/idleDourado.test.ts && npx tsc --noEmit` → PASS.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/0074_fellas_inc_eventos_era.sql games/shared/api.ts games/dev/mockIdle.ts games/idle/main.ts games/test/idleEventosEra.test.ts
git commit -m "Fellas Inc.: pegar os eventos de era no banco, contadores e conquistas das eras 1–5 (0074)"
```

---

### Task 5: Os eventos na tela, os selos, as caixinhas e os sons

**Files:**
- Modify: `games/idle/eventosEra.ts` (ganhos e textos)
- Create: `games/idle/eventoEraTela.ts`, `games/idle/eventoEraTela.test.ts`
- Modify: `games/idle/dourados.ts:57-88` (`selosBonus`), `games/idle/dica.ts`, `games/idle/tela.ts:1047-1051`, `games/idle/main.ts` (passo de 1 s, pegar), `games/idle/idle.css`, `games/idle/audio/efeitos.ts`, `games/idle/audio/efeitos.test.ts:16`, `games/dev/mockIdle.ts`
- Test: `games/idle/dourados.test.ts`, `games/idle/eventosEra.test.ts`, `games/idle/dica.test.ts`

**Interfaces:**
- Consumes: Tasks 2–4 (`eventoEraEm`, `posicaoEvento`, `JANELA_EVENTO_S`, `MAX_GOLS`, `marmitaAtiva`, `descontoAtivo`, `api.idleEventoPegar`, `IdleState.evento`).
- Produces: `textoEventoPegou(e: EventoPago): string`; `ganhoEventoAgora(tipo: TipoEventoEra, rate: number): number` (F$ de 1 gol/1 call/a Shopee em F$); `dicaEventoEra(tipo: TipoEventoEra, rate: number): Dica`; `criarEventoEraTela(raiz: HTMLElement, o: { aoPegar(seg: number, gols: number): void; dica(el: HTMLElement, chave: string, tipo: TipoEventoEra): void; posicao(seg: number, i: number): { x: number; y: number } })` com `mostrar(e: { seg: number; tipo: TipoEventoEra; agoraMs: number }): void`, `tick(agoraMs: number): void`, `ativo(): boolean`. `selosBonus` passa a devolver `{ texto: string; ouro: boolean; dica?: Dica }[]`.

- [ ] **Step 1: Testes (falham)**

Em `games/idle/eventosEra.test.ts`:

```ts
import { ganhoEventoAgora, textoEventoPegou } from './eventosEra';
describe('textos e ganhos', () => {
  it('o que sobe quando pega', () => {
    expect(textoEventoPegou({ tipo: 1, premio: null, ganho: 0, gols: 0 })).toBe('Marmita da mãe! ×3 por 3 min');
    expect(textoEventoPegou({ tipo: 2, premio: 0, ganho: 980_000, gols: 0 })).toBe('+F$ 980 mil (Taxa das blusinhas: −20%)');
    expect(textoEventoPegou({ tipo: 2, premio: 1, ganho: 0, gols: 0 })).toBe('Promoção! Tudo pela metade por 1 min');
    expect(textoEventoPegou({ tipo: 2, premio: 2, ganho: 0, gols: 0 })).toBe('×5 por 2 min');
    expect(textoEventoPegou({ tipo: 3, premio: null, ganho: 1_200_000, gols: 0 })).toBe('Fugiu da call! +F$ 1,2 mi');
    expect(textoEventoPegou({ tipo: 4, premio: null, ganho: 0, gols: 0 })).toBe('Atualização instalada! Melhorias −25%');
    expect(textoEventoPegou({ tipo: 5, premio: null, ganho: 3_100_000, gols: 4 })).toBe('4 gols! +F$ 3,1 mi');
    expect(textoEventoPegou({ tipo: 5, premio: null, ganho: 1, gols: 1 })).toBe('1 gol! +F$ 1');
  });
  it('ganho agora: Shopee 1 h × 0,8; call 30 min; gol 5 min', () => {
    expect(ganhoEventoAgora(2, 10)).toBeCloseTo(28_800, 6);
    expect(ganhoEventoAgora(3, 10)).toBeCloseTo(18_000, 6);
    expect(ganhoEventoAgora(5, 10)).toBeCloseTo(3_000, 6);
    expect(ganhoEventoAgora(1, 10)).toBe(0);
  });
});
```

(Confira o formato exato de `formatarValor` em `formatar.test.ts` e ajuste as strings esperadas se ele escrever "F$ 980 mil" diferente.)

Em `games/idle/dourados.test.ts`:

```ts
it('selos da Marmita e da Atualização, com caixinha', () => {
  const agora = Date.parse('2026-10-14T12:00:00Z');
  const l = selosBonus({ promo_ate: null, marmita_ate: '2026-10-14T12:02:41Z', upg_desc_ate: '2026-10-14T12:01:40Z' }, agora);
  expect(l.map((x) => x.texto)).toEqual(['Marmita ×3 · 2:41', 'Melhorias −25% · 1:40']);
  expect(l[0].dica?.titulo).toBe('Marmita da mãe');
  expect(l[1].dica?.titulo).toBe('Atualização instalada');
});
```

Em `games/idle/dica.test.ts`:

```ts
it('dicaEventoEra diz o que dá agora, em números', () => {
  expect(dicaEventoEra(3, 1000).linhas[0].texto).toBe(`Dá ${formatarValor(1_800_000)} agora`);
  expect(dicaEventoEra(5, 1000).linhas[0].texto).toBe(`Cada gol: ${formatarValor(300_000)} (até 7)`);
  expect(dicaEventoEra(1, 1000).linhas[0].texto).toBe('Produção ×3 por 3 min');
});
```

`games/idle/eventoEraTela.test.ts` (ambiente jsdom, como `douradoTela.test.ts`; copie o cabeçalho `// @vitest-environment jsdom` de lá se houver):

```ts
// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { criarEventoEraTela } from './eventoEraTela';

const opcoes = (aoPegar = vi.fn()) => ({ aoPegar, dica: vi.fn(), posicao: () => ({ x: 0.5, y: 0.5 }) });

describe('eventos de era na tela', () => {
  it('mãe: o botão "Já vou!" pega uma vez; some depois da janela', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 1, agoraMs: 100_000 });
    const b = raiz.querySelector<HTMLButtonElement>('.evento-era button')!;
    expect(b.textContent).toBe('Já vou!');
    b.click(); b.click();
    expect(o.aoPegar).toHaveBeenCalledTimes(1);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 0);
    t.mostrar({ seg: 200, tipo: 1, agoraMs: 200_000 });
    t.tick(208_001);
    expect(raiz.querySelector('.evento-era')).toBeNull();
  });
  it('não mostra o que já passou da janela (aba que voltou) nem dois de uma vez', () => {
    const raiz = document.createElement('div');
    const t = criarEventoEraTela(raiz, opcoes());
    t.mostrar({ seg: 100, tipo: 4, agoraMs: 105_000 }); // tela azul: 5 s
    expect(raiz.querySelector('.evento-era')).toBeNull();
    t.mostrar({ seg: 100, tipo: 3, agoraMs: 100_000 });
    t.mostrar({ seg: 101, tipo: 2, agoraMs: 101_000 });
    expect(raiz.querySelectorAll('.evento-era')).toHaveLength(1);
    expect(t.ativo()).toBe(true);
  });
  it('Jogo do Brasil: cada clique na bola é gol; no 7º manda na hora; no fim da janela manda o que tiver', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    const bola = () => raiz.querySelector<HTMLButtonElement>('.evento-bola')!;
    for (let i = 0; i < 3; i++) bola().click();
    expect(raiz.querySelector('.evento-placar')!.textContent).toBe('3 de 7');
    t.tick(130_000);
    expect(o.aoPegar).toHaveBeenCalledWith(100, 3);
    t.mostrar({ seg: 200, tipo: 5, agoraMs: 200_000 });
    for (let i = 0; i < 7; i++) bola().click();
    expect(o.aoPegar).toHaveBeenLastCalledWith(200, 7);
  });
  it('Jogo do Brasil sem gol não chama o banco', () => {
    const raiz = document.createElement('div');
    const o = opcoes();
    const t = criarEventoEraTela(raiz, o);
    t.mostrar({ seg: 100, tipo: 5, agoraMs: 100_000 });
    t.tick(130_000);
    expect(o.aoPegar).not.toHaveBeenCalled();
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/eventosEra.test.ts idle/dourados.test.ts idle/dica.test.ts idle/eventoEraTela.test.ts` → FAIL.

- [ ] **Step 2: Textos, ganhos, selos e dica**

`eventosEra.ts`, no fim:

```ts
// ---------- textos ----------
import { formatarValor } from './formatar'; // (mova este import pro topo do arquivo)
import type { EventoPago } from '../shared/types'; // (idem)

/** Quanto entra em F$ na hora, com a produção `rate` de agora: Shopee (se sair F$), a call e 1 gol. */
export function ganhoEventoAgora(tipo: TipoEventoEra, rate: number): number {
  return tipo === 2 ? rate * 3600 * 0.8 : tipo === 3 ? rate * 1800 : tipo === 5 ? rate * 300 : 0;
}

/** O texto que sobe quando pega (com o que o banco mandou em `evento`). */
export function textoEventoPegou(e: EventoPago): string {
  if (e.tipo === 1) return 'Marmita da mãe! ×3 por 3 min';
  if (e.tipo === 2) {
    if (e.premio === 1) return 'Promoção! Tudo pela metade por 1 min';
    if (e.premio === 2) return '×5 por 2 min';
    return `+${formatarValor(e.ganho)} (Taxa das blusinhas: −20%)`;
  }
  if (e.tipo === 3) return `Fugiu da call! +${formatarValor(e.ganho)}`;
  if (e.tipo === 4) return 'Atualização instalada! Melhorias −25%';
  return `${e.gols} ${e.gols === 1 ? 'gol' : 'gols'}! +${formatarValor(e.ganho)}`;
}
```

`dourados.ts`: o tipo `ComBonus` ganha `marmita_ate?: string | null; upg_desc_ate?: string | null;`, a função devolve `{ texto: string; ouro: boolean; dica?: Dica }[]` (import `type Dica` de `./dica`) e, depois do selo da Promoção:

```ts
  // eventos de era (0074): a Marmita (×3) e a Atualização (melhorias −25%), cada um com a sua caixinha
  if (s.marmita_ate && Date.parse(s.marmita_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.marmita_ate) - agoraMs);
    out.push({ texto: `Marmita ×3 · ${falta}`, ouro: false, dica: { titulo: 'Marmita da mãe', linhas: [
      { texto: 'Produção ×3, por cima de todo o resto' }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
  if (s.upg_desc_ate && Date.parse(s.upg_desc_ate) > agoraMs) {
    const falta = mmss(Date.parse(s.upg_desc_ate) - agoraMs);
    out.push({ texto: `Melhorias −25% · ${falta}`, ouro: false, dica: { titulo: 'Atualização instalada', linhas: [
      { texto: 'Melhorias 25% mais baratas (junta com Promoção e Horta)' }, { texto: `Acaba em ${falta}`, tom: 'fraco' }] } });
  }
```

`dica.ts`, no fim:

```ts
/** A caixinha do evento de era na tela: o que ele dá agora, nos números da pessoa. */
export function dicaEventoEra(tipo: TipoEventoEra, rate: number): Dica {
  const g = ganhoEventoAgora(tipo, rate);
  const linhas: LinhaDica[] =
    tipo === 1 ? [{ texto: 'Produção ×3 por 3 min' }]
    : tipo === 2 ? [{ texto: `Sorteio: ${formatarValor(g)} (1 h, menos a Taxa das blusinhas), Promoção por 1 min ou ×5 por 2 min` }]
    : tipo === 3 ? [{ texto: `Dá ${formatarValor(g)} agora` }, { texto: '30 min da sua produção', tom: 'fraco' }]
    : tipo === 4 ? [{ texto: 'Melhorias 25% mais baratas por 2 min' }]
    : [{ texto: `Cada gol: ${formatarValor(g)} (até 7)` }, { texto: '5 min da sua produção por gol', tom: 'fraco' }];
  return { titulo: NOME_EVENTO_ERA[tipo], linhas };
}
```

(import `ganhoEventoAgora, NOME_EVENTO_ERA, type TipoEventoEra` de `./eventosEra`.)

`tela.ts` `relogioBonus`:

```ts
  function relogioBonus(s: IdleState | null, agoraMs: number) {
    const lista = s ? selosBonus(s, agoraMs) : [];
    selos.replaceChildren(...lista.map((x, i) => {
      const e = el('span', `selo-bonus${x.ouro ? ' ouro' : ''}`, x.texto);
      if (x.dica) {
        e.tabIndex = 0; // caixinha também no foco do teclado
        const d = x.dica;
        dicas.ligar(e, `selo-${i}`, () => d);
      }
      return e;
    }));
  }
```

- [ ] **Step 3: `eventoEraTela.ts`**

```ts
// Eventos de era na tela (14/10): o desenho de pixel de cada um com o botão dele, um por vez. Clicar chama `aoPegar`
// (o banco confere). O Jogo do Brasil é diferente: a bola pula de ponto em ponto e cada clique é gol; manda os gols no
// 7º ou quando a janela acaba (sem gol, não manda nada).
import { JANELA_EVENTO_S, MAX_GOLS, NOME_EVENTO_ERA, type TipoEventoEra } from './eventosEra';

const PALETA: Record<string, string> = {
  K: '#1E1B2E', B: '#5A3A1E', S: '#D9A066', H: '#FF5A7A', R: '#E0454B', W: '#F4F1EA', O: '#F07A2A', Q: '#B8501A',
  C: '#5AA9E6', A: '#2A5BD7', N: '#8A8796',
};
// 12 × 12, uma letra por pixel ('.' = vazio). A bola não tem desenho aqui: é o .evento-bola (CSS).
const ICONES: Record<1 | 2 | 3 | 4, readonly string[]> = {
  // a mãe de avental
  1: ['....BBBB....', '...BBBBBB...', '..BBSSSSBB..', '..BSKSSKSB..', '..BSSSSSSB..', '...SSHHSS...',
      '....SSSS....', '...RRRRRR...', '..RRWWWWRR..', '..RRWWWWRR..', '..RRWWWWRR..', '...RR..RR...'],
  // a caixa laranja com a fita
  2: ['....W..W....', '.....WW.....', '.OOOOWWOOOO.', '.QQQQWWQQQQ.', '.OOOOWWOOOO.', '.OOOOWWOOOO.',
      '.OOOWWWWOOO.', '.OOOOWWOOOO.', '.OOOOWWOOOO.', '.OOOOWWOOOO.', '.QQQQQQQQQQ.', '............'],
  // a call com 6 quadradinhos e o botão vermelho
  3: ['KKKKKKKKKKKK', 'KCCCKCCCKCCK', 'KCSCKCSCKSCK', 'KCCCKCCCKCCK', 'KKKKKKKKKKKK', 'KCCCKCCCKCCK',
      'KCSCKCSCKSCK', 'KCCCKCCCKCCK', 'KKKKKKKKKKKK', 'KRRRRWWRRRRK', 'KKKKKKKKKKKK', '............'],
  // o monitor com a tela azul e a carinha triste
  4: ['KKKKKKKKKKKK', 'KAAAAAAAAAAK', 'KAWAAWWWAAAK', 'KAAAWAAAAAAK', 'KAWAWAAAAAAK', 'KAAAAWWWAAAK',
      'KAAAAAAAAAAK', 'KAWWWWWWWAAK', 'KAAAAAAAAAAK', 'KKKKKKKKKKKK', '....KKKK....', '..KKKKKKKK..'],
};
const BOTAO: Record<1 | 2 | 3 | 4, string> = { 1: 'Já vou!', 2: 'Abrir pacote', 3: 'Sair da call', 4: 'Reiniciar' };
const BALAO: Record<1 | 2 | 3 | 4, string> = {
  1: 'Desce pra almoçar!', 2: 'Seu pacote chegou', 3: 'Reunião: alinhamento do alinhamento', 4: 'Seu PC encontrou um problema',
};

const NS = 'http://www.w3.org/2000/svg';
function icone(tipo: 1 | 2 | 3 | 4): SVGSVGElement {
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 12 12');
  svg.setAttribute('class', 'icone-evento');
  svg.setAttribute('shape-rendering', 'crispEdges');
  svg.setAttribute('aria-hidden', 'true');
  const porCor = new Map<string, string>();
  ICONES[tipo].forEach((linha, y) => [...linha].forEach((c, x) => {
    if (c !== '.') porCor.set(c, `${porCor.get(c) ?? ''}M${x} ${y}h1v1h-1z`);
  }));
  for (const [c, d] of porCor) {
    const p = document.createElementNS(NS, 'path');
    p.setAttribute('d', d);
    p.setAttribute('fill', PALETA[c]);
    svg.append(p);
  }
  return svg;
}

export type OpcoesEventoEra = {
  aoPegar(seg: number, gols: number): void;
  /** liga a caixinha de informação (mouse/teclado) no elemento */
  dica(el: HTMLElement, chave: string, tipo: TipoEventoEra): void;
  /** onde fica (fração da tela); `i` = o pulo da bola */
  posicao(seg: number, i: number): { x: number; y: number };
};

export function criarEventoEraTela(raiz: HTMLElement, o: OpcoesEventoEra) {
  const camada = document.createElement('div');
  camada.className = 'eventos-era';
  raiz.append(camada);
  let atual: { seg: number; tipo: TipoEventoEra; ateMs: number; caixa: HTMLElement; gols: number; pulo: number } | null = null;
  const encerrados = new Set<number>();

  function encerrar(enviar: boolean) {
    if (!atual) return;
    const a = atual;
    atual = null;
    a.caixa.remove();
    encerrados.add(a.seg);
    if (enviar && (a.tipo !== 5 || a.gols > 0)) o.aoPegar(a.seg, a.tipo === 5 ? a.gols : 0);
  }
  function posicionar(el: HTMLElement, p: { x: number; y: number }) {
    el.style.left = `${Math.round(p.x * 100)}%`;
    el.style.top = `${Math.round(p.y * 100)}%`;
  }

  return {
    mostrar(e: { seg: number; tipo: TipoEventoEra; agoraMs: number }) {
      const ateMs = (e.seg + JANELA_EVENTO_S[e.tipo]) * 1000;
      if (atual || encerrados.has(e.seg) || e.agoraMs >= ateMs) return;
      const caixa = document.createElement('div');
      caixa.className = `evento-era evento-era-${e.tipo}`;
      caixa.style.setProperty('--janela', `${JANELA_EVENTO_S[e.tipo]}s`);
      caixa.style.setProperty('--ja', `-${Math.max(0, Math.round((e.agoraMs - e.seg * 1000) / 1000))}s`);
      atual = { seg: e.seg, tipo: e.tipo, ateMs, caixa, gols: 0, pulo: 0 };
      if (e.tipo === 5) {
        const placar = document.createElement('div');
        placar.className = 'evento-placar';
        placar.textContent = `0 de ${MAX_GOLS}`;
        const bola = document.createElement('button');
        bola.type = 'button';
        bola.className = 'evento-bola';
        bola.setAttribute('aria-label', 'Chutar pro gol');
        posicionar(bola, o.posicao(e.seg, 0));
        bola.addEventListener('click', () => {
          if (!atual || atual.seg !== e.seg) return;
          atual.gols++;
          placar.textContent = `${atual.gols} de ${MAX_GOLS}`;
          posicionar(bola, o.posicao(e.seg, ++atual.pulo));
          if (atual.gols >= MAX_GOLS) encerrar(true);
        });
        caixa.append(placar, bola);
        o.dica(bola, `evento-${e.seg}`, e.tipo);
      } else {
        const t = e.tipo;
        const balao = document.createElement('div');
        balao.className = 'evento-balao';
        balao.textContent = BALAO[t];
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'btn';
        b.textContent = BOTAO[t];
        b.setAttribute('aria-label', `${BOTAO[t]} (${NOME_EVENTO_ERA[t]})`);
        b.addEventListener('click', () => {
          if (atual?.seg === e.seg) encerrar(true);
        });
        caixa.append(icone(t), balao, b);
        posicionar(caixa, o.posicao(e.seg, 0));
        o.dica(caixa, `evento-${e.seg}`, t);
      }
      camada.append(caixa);
    },
    /** A cada passo da página: a bola pula a cada 1,5 s; passou da janela, encerra (o Jogo do Brasil manda os gols). */
    tick(agoraMs: number) {
      if (!atual) return;
      if (agoraMs >= atual.ateMs) {
        encerrar(atual.tipo === 5);
        return;
      }
      if (atual.tipo === 5) {
        const pulo = Math.floor((agoraMs - atual.seg * 1000) / 1500);
        if (pulo > atual.pulo) {
          atual.pulo = pulo;
          const bola = atual.caixa.querySelector<HTMLElement>('.evento-bola');
          if (bola) posicionar(bola, o.posicao(atual.seg, pulo));
        }
      }
    },
    ativo: () => atual !== null,
  };
}
```

CSS em `idle.css` (depois do bloco `.dourado`; siga o padrão de lá pro anel/pisca e pro `z-index`):

```css
.idle .eventos-era { position: absolute; inset: 0; pointer-events: none; z-index: 41; }
.idle .evento-era { position: absolute; pointer-events: auto; display: grid; justify-items: center; gap: 4px;
  transform: translate(-50%, -50%); animation: dourado-balanca 1.2s ease-in-out infinite; }
.idle .evento-era .icone-evento { width: 48px; height: 48px; image-rendering: pixelated; }
.idle .evento-balao { background: #F4F1EA; color: #1E1B2E; padding: 2px 6px; font-size: 16px; white-space: nowrap;
  box-shadow: 0 0 0 2px #1E1B2E; }
.idle .evento-era-4 { left: 50% !important; width: 100%; background: #2A5BD7; color: #F4F1EA; padding: 10px 0; }
.idle .evento-era-4 .evento-balao { background: transparent; color: #F4F1EA; box-shadow: none; }
.idle .evento-era-5 { inset: 0; transform: none; animation: none; pointer-events: none; }
.idle .evento-placar { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); background: #1E1B2E;
  color: #5FD38D; padding: 2px 8px; font-size: 20px; }
.idle .evento-bola { position: absolute; width: 36px; height: 36px; transform: translate(-50%, -50%); pointer-events: auto;
  border-radius: 50%; background: radial-gradient(circle at 50% 50%, #1E1B2E 0 22%, #F4F1EA 23% 100%);
  box-shadow: 0 0 0 2px #1E1B2E; transition: left 0.25s, top 0.25s; cursor: pointer; }
```

(Se `dourado-balanca` tiver outro nome no CSS, use o da animação dos dourados.)

Run: `cd games && npx vitest run --maxWorkers=4 idle/eventoEraTela.test.ts idle/eventosEra.test.ts idle/dourados.test.ts idle/dica.test.ts` → PASS.

- [ ] **Step 4: Sons**

Em `audio/efeitos.ts`, acrescente `'mae', 'shopee', 'call', 'telaAzul', 'gol'` em `IDS_EFEITOS` e as receitas (no objeto das receitas, junto de `dourado`):

```ts
  mae: (c, d, t) => { // campainha de porta: dim-dom
    sininho(c, d, t, 84, 0.35, 0.8);
    sininho(c, d, t + 0.3, 79, 0.5, 0.8);
    return 0.9;
  },
  shopee: (c, d, t) => { // caixa caindo e abrindo
    bumbo(c, d, t, 0, 0.12, 0.5);
    ruidoFiltrado(c, d, t + 0.1, 'bandpass', 1800, 500, 0.15, 0.1);
    return 0.4;
  },
  call: (c, d, t) => { // "tutum" de sair da call
    sininho(c, d, t, 72, 0.12, 0.6);
    sininho(c, d, t + 0.14, 67, 0.2, 0.6);
    return 0.4;
  },
  telaAzul: (c, d, t) => { // bipe de erro do PC
    [70, 70, 70].forEach((m, i) => sininho(c, d, t + i * 0.18, m, 0.12, 0.5));
    return 0.6;
  },
  gol: (c, d, t) => { // apito + a torcida
    [96, 96].forEach((m, i) => sininho(c, d, t + i * 0.12, m, 0.08, 0.6));
    ruidoFiltrado(c, d, t + 0.25, 'bandpass', 900, 700, 0.6, 0.12);
    return 0.9;
  },
```

Em `audio/efeitos.test.ts:16`, acrescente os 5 ids na lista esperada (ela é ordenada: `.sort()` cuida). Acrescente também os 5 na página de audição se ela listar os ids à mão (conferir `audio/ouvir.html`/o script dela).

Run: `cd games && npx vitest run --maxWorkers=4 idle/audio` → PASS.

- [ ] **Step 5: Ligar no `main.ts` e na `tela.ts`**

Em `tela.ts`, junto de `const dourados = criarDouradoTela(...)`:

```ts
  const eventosEra = criarEventoEraTela(app, {
    aoPegar: (seg, gols) => a.pegarEventoEra(seg, gols),
    dica: (alvo, chave, tipo) => dicas.ligar(alvo, chave, () => (ultimoEstado ? dicaEventoEra(tipo, ultimoEstado.rate) : null)),
    posicao: (seg, i) => posicaoEvento(ultimoEstado?.user_id ?? '', seg, i),
  });
```

(`ultimoEstado` = o estado do último `renderizar`; se a tela já guarda um, use o mesmo nome; senão declare `let ultimoEstado: IdleState | null = null;` e atribua no começo de `renderizar`.) Acrescente `eventosEra` no objeto devolvido pela tela (l.1063) e `pegarEventoEra(seg: number, gols: number): void;` no tipo das ações (l.81-84).

Em `main.ts`, nas ações (junto de `pegarDourado`):

```ts
  pegarEventoEra: (seg, gols) => void (async () => {
    if (!ancora) return;
    const p = posicaoEvento(ancora.estado.user_id, seg, 0);
    try {
      const s = await api.idleEventoPegar(seg, gols);
      aplicar(s);
      audio.tocar('douradoPego');
      if (chaves.avisos && s.evento) tela.dourados.subirTexto(textoEventoPegou(s.evento), p.x, p.y);
    } catch (e) {
      const err = toGameError(e);
      if (err.code === 'no_session') fase = 'sem_sessao';
      else if (err.code !== 'idle_evento_pego' && err.code !== 'idle_evento_gone') { // era mudou ou já foi: sem bonk
        audio.tocar('erro');
        aviso = err.message;
      }
      await recarregar().catch(() => undefined);
      render();
    }
  })(),
```

No passo de 1 s, logo depois do `for` dos dourados (antes de `segVisto = seg;`):

```ts
    // eventos de era: olha 30 s pra trás (a janela mais longa); um por vez, e não no segundo de um dourado
    for (let x = Math.max(segVistoEra + 1, seg - 29); x <= seg; x++) {
      const t = eventoEraEm(ancora.estado.user_id, x, ancora.estado.era);
      if (t !== null && !eventoEm(ancora.estado, x) && !tela.eventosEra.ativo()) {
        tela.eventosEra.mostrar({ seg: x, tipo: t, agoraMs });
        if (tela.eventosEra.ativo()) audio.tocar(({ 1: 'mae', 2: 'shopee', 3: 'call', 4: 'telaAzul', 5: 'gol' } as const)[t]);
      }
    }
    segVistoEra = seg;
```

e, fora do `if` (sempre que tem âncora), `tela.eventosEra.tick(agoraMs);` junto de `tela.dourados.tick(agoraMs);`. Declare `let segVistoEra = Math.floor(Date.now() / 1000);` junto de `segVisto` (com o mesmo valor inicial que `segVisto` usa). Imports: `eventoEraEm, posicaoEvento, textoEventoPegou` de `./eventosEra`.

- [ ] **Step 6: `?mock` força os eventos**

Em `dev/mockIdle.ts`, depois do `w.__dourado`:

```ts
// __eventoEra(5) põe um evento de era na tela agora (1 mãe, 2 Shopee, 3 call, 4 tela azul, 5 Jogo do Brasil)
w.__eventoEra = async (tipo = 1) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  const seg = Math.floor(Date.now() / 1000);
  const ja = await db.query<{ n: number }>("select count(*)::int as n from pg_proc where proname = 'idle_evento_era_sorte'");
  if (!ja.rows[0].n) {
    await db.exec(`alter function public.idle_evento_era(uuid, bigint, int) rename to idle_evento_era_sorte;
      create table public.mock_evento (s bigint primary key, tipo int);
      create function public.idle_evento_era(u uuid, s bigint, era int) returns int language sql stable as
        'select coalesce((select tipo from public.mock_evento m where m.s = idle_evento_era.s), public.idle_evento_era_sorte(u, s, era))';`);
  }
  await db.query('insert into public.mock_evento values ($1, $2) on conflict (s) do update set tipo = excluded.tipo', [seg, tipo]);
  (window as unknown as { __mostrarEventoEra?: (seg: number, tipo: number) => void }).__mostrarEventoEra?.(seg, tipo);
};
```

Em `main.ts`, junto do `__mostrarDourado`:

```ts
(window as unknown as { __mostrarEventoEra: (seg: number, tipo: TipoEventoEra) => void }).__mostrarEventoEra = (seg, tipo) =>
  tela.eventosEra.mostrar({ seg, tipo, agoraMs: agoraSrv() });
```

Se o painel do mock (“mock ▸”) tiver botões pros dourados, acrescente uma linha com os 5 eventos chamando `__eventoEra(n)`.

- [ ] **Step 7: Conferir no navegador**

Run: `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4 idle`
Depois abra o `?mock` (vite dos jogos), mute a música, force os 5 eventos (`__eventoEra(1..5)`) e confira em 1280×720, 2000×961 e num iframe de 390 px: o desenho, o balão, o botão, a caixinha no mouse (não no celular), o texto que sobe, os selos "Marmita ×3" e "Melhorias −25%" com caixinha, o preço das melhorias caindo 25% e voltando, e a bola do Jogo do Brasil pulando e contando gols. Mate o vite da 5199 no fim.

- [ ] **Step 8: Commit**

```bash
git add games/idle/eventosEra.ts games/idle/eventosEra.test.ts games/idle/eventoEraTela.ts games/idle/eventoEraTela.test.ts games/idle/dourados.ts games/idle/dourados.test.ts games/idle/dica.ts games/idle/dica.test.ts games/idle/tela.ts games/idle/main.ts games/idle/idle.css games/idle/audio games/dev/mockIdle.ts
git commit -m "Fellas Inc.: os eventos de era na tela, os selos novos, as caixinhas e os sons"
```

---

### Task 6: Easter egg do Sillas

**Files:**
- Create: `games/idle/segredo.ts`, `games/idle/segredo.test.ts`
- Modify: `games/idle/tela.ts` (`linhaGerador`, l.448-480), `games/idle/idle.css`

**Interfaces:**
- Produces: `contadorCliques(n = 3, ms = 600): (agoraMs: number) => boolean` (true no n-ésimo clique dentro de `ms`, e recomeça).

- [ ] **Step 1: Teste (falha)**

```ts
import { describe, expect, it } from 'vitest';
import { contadorCliques } from './segredo';

describe('três cliques', () => {
  it('três em até 600 ms disparam; dois não; devagar não', () => {
    const c = contadorCliques();
    expect([c(0), c(200), c(400)]).toEqual([false, false, true]);
    expect([c(1000), c(1200)]).toEqual([false, false]);
    expect(c(2000)).toBe(false); // o par de antes passou de 600 ms
    const d = contadorCliques();
    expect([d(0), d(500), d(900), d(1000)]).toEqual([false, false, false, true]); // conta os 3 últimos
  });
});
```

Run: `cd games && npx vitest run --maxWorkers=4 idle/segredo.test.ts` → FAIL.

- [ ] **Step 2: `segredo.ts`**

```ts
// Só página. Três cliques seguidos (em até 600 ms) disparam; depois recomeça do zero.
export function contadorCliques(n = 3, ms = 600) {
  let marcas: number[] = [];
  return (agoraMs: number): boolean => {
    marcas = [...marcas.filter((m) => agoraMs - m <= ms), agoraMs].slice(-n);
    if (marcas.length >= n && agoraMs - marcas[0] <= ms) {
      marcas = [];
      return true;
    }
    return false;
  };
}
```

Run: PASS.

- [ ] **Step 3: Ligar na Loja**

Em `tela.ts`, dentro de `criarTela` (fora de `linhaGerador`, pra sobreviver aos re-renders):

```ts
  const tresCliques = contadorCliques();
  function segredo() {
    const camada = el('div', 'segredo', 'Sillas Gabriel Coelho Sena');
    camada.setAttribute('role', 'dialog');
    camada.setAttribute('aria-label', 'Sillas Gabriel Coelho Sena');
    camada.tabIndex = -1;
    const fechar = () => { camada.remove(); document.removeEventListener('keydown', esc); clearTimeout(timer); };
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar(); };
    const timer = setTimeout(fechar, 4000);
    camada.addEventListener('click', fechar);
    document.addEventListener('keydown', esc);
    app.append(camada);
    camada.focus();
  }
```

E em `linhaGerador`, depois de `linha.append(sprite, meio, botoes);`:

```ts
    if (gid === 1) {
      for (const alvo of [sprite, meio]) alvo.addEventListener('click', () => { if (tresCliques(Date.now())) segredo(); });
    }
```

(Os botões de comprar ficam em `botoes`, fora de `sprite` e `meio`: não contam.)

CSS:

```css
.idle .segredo { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; text-align: center;
  padding: 16px; background: #1E1B2E; color: #F2D27A; font-size: clamp(32px, 7vw, 96px); line-height: 1.05; cursor: pointer; }
```

- [ ] **Step 4: Conferir no navegador**

No `?mock`: três cliques rápidos no desenho/nome do 1º gerador mostram o nome na tela inteira (PC e iframe de 390 px); dois cliques não; clicar nos botões de comprar não conta; some com clique, Esc ou 4 s. Mate o vite da 5199 no fim.

- [ ] **Step 5: Commit**

```bash
git add games/idle/segredo.ts games/idle/segredo.test.ts games/idle/tela.ts games/idle/idle.css
git commit -m "Fellas Inc.: três cliques no primeiro gerador"
```

(Mensagem de commit sem o nome, de propósito.)

---

### Task 7: Patch notes, verificação final e publicação

**Files:**
- Modify: `games/idle/novidades.ts:5`

- [ ] **Step 1: Entrada nova no começo de `NOVIDADES`**

```ts
  {
    id: '2026-10-14-eras-1-5',
    titulo: 'As eras 1 a 5 ganharam vida',
    data: '2026-10-14',
    itens: [
      'Cada gerador ganhou mais 3 melhorias, com 150, 200 e 300 unidades. Cada uma dobra o gerador.',
      'Eventos de era: de vez em quando a sua era apronta alguma. A mãe chama pro almoço, chega pacote da Shopee, cai uma reunião que podia ser um e-mail, o PC dá tela azul e tem Jogo do Brasil. O de cada era aparece quando você chega nela e continua depois.',
      'Marmita da mãe: produção ×3 por 3 minutos. Atualização instalada: melhorias 25% mais baratas por 2 minutos.',
      '15 conquistas novas: dos eventos, de ter 300 de cada gerador da era e de comprar todas as melhorias da era.',
    ],
  },
```

(Sem o Sillas e sem a conquista escondida. Rode `npx vitest run --maxWorkers=4 idle/novidades.test.ts`.)

- [ ] **Step 2: Verificação completa**

Run, e confira que tudo passa (colar a saída):
- `cd games && npx tsc --noEmit && npx vitest run --maxWorkers=4`
- na raiz: `npx tsc --noEmit && npm test`
- `git grep -n "Sillas" -- games/idle/novidades.ts` → nada.
- Conferir o node no fim (nenhum vitest/vite sobrando; porta 5199 livre).

- [ ] **Step 3: Commit**

```bash
git add games/idle/novidades.ts
git commit -m "Fellas Inc.: patch notes das eras 1–5"
```

- [ ] **Step 4: Publicar (com o Juan)**

1. Conferir que ninguém usou 0073/0074: `git fetch && git log origin/main --name-only --oneline -20 -- supabase/migrations` e o worktree `fellasapp-mapa`. Se sim, renumerar as duas e regerar a 0073 com `ATUALIZAR_CATALOGO`.
2. Pedir pro Juan rodar (caminho absoluto): `! npx supabase db push --workdir C:\Users\juan\Documents\PROJETOSLLM\fellasapp-eras`
3. Conferir no banco de produção (só SELECT, pelo pooler) que `idle_state` tem `marmita_ate`, `upg_desc_ate`, `eventos_era` e que `idle_cat_upg` tem 290 linhas.
4. Merge local na `main` e push (fluxo do projeto, sem PR), com a pasta principal limpa; depois `gh run list` até o deploy passar.
