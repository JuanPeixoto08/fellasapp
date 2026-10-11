# Fellas Inc.: layout novo, árvore em tela cheia e conquistas em grade — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refazer só a apresentação da Fellas Inc. (`games/idle`): 4 abas, empresa + bancada à esquerda no PC, árvore de habilidades em tela cheia (copa), conquistas em grade de ícones, botões pixel sem pílula dourada.

**Architecture:** DOM puro como hoje (`tela.ts` monta uma vez e `renderizar` redesenha). Lógica pura nova em `legado.ts` (posições da copa, escala, situação na tela, nó inicial, textos). A árvore em tela cheia vira um módulo próprio (`arvoreTela.ts`) que só desenha e chama `comprar(id)`. Todo o visual fica em `idle.css` dentro de `.idle`; uma media query de 1100 px separa celular e PC.

**Tech Stack:** TypeScript, Vite, Vitest + happy-dom, CSS. Sem framework.

**Spec:** `docs/superpowers/specs/2026-10-11-fellas-inc-layout-novo-design.md`

## Global Constraints

- Nenhuma regra, conta, RPC, tabela ou migração muda. Não rode `supabase db push`.
- `games/shared/hud/hud.css`, `games/blackjack`, `games/poker` não mudam. Tudo visual novo fica em `games/idle/idle.css`, dentro de `.idle`.
- Texto de usuário só por `textContent` (o `el()`/`button()` de `shared/hud/hud.ts` já fazem isso). Interface em pt-BR. Moeda "F$". Pontos com "★".
- Sem emoji como ícone; o ★ é a marca dos pontos (já usada no placar).
- Fonte pixel: Pixelify Sans (Google Fonts, pesos 500/600/700) nos títulos, números, abas, botões e rótulos dos ramos; o resto em Golos Text.
- Cores: fundo `#121212`, painel `#1B1A22`, borda `#34323F`, ativo `#262431`, roxo `#5B3FD9` (claro `#7D64F0`, escuro `#3D27A8`, contorno `#8C75FF`), lilás `#B8A2FF`, dourado `var(--gold)`, menta `var(--mint)`.
- Alvo de toque ≥ 44 px no celular.
- Commits sem `Co-Authored-By`, sem "Generated with", sem qualquer marca de IA. Não fazer push.
- Windows + Git Bash: o shell volta pro diretório original a cada comando; use `cd <dir> && ...`. Arquivos em UTF-8 sem BOM.
- Suíte dos jogos: `cd games && npx tsc --noEmit && npx vitest run`. Build: `cd games && npx vite build`.

## Review Focus

- Estado novo chegando com a árvore aberta (comprou um nó): o nó escolhido e o arraste continuam; o nó acende. Teste na Task 4 ("renderizar de novo mantém o escolhido").
- A página sai do jogo com a árvore aberta (sessão caiu, venda, `fase` mudou): a árvore fecha sozinha. Teste na Task 5.
- Arrastar a copa e soltar em cima de um nó não escolhe o nó. Teste na Task 4.
- Fechar a árvore depois de a aba Legado ter sido redesenhada (o botão Abrir é outro elemento): o foco volta pro Abrir novo. Teste na Task 5.
- Pegar na gaveta da bancada segue as mesmas regras da folha (sem pega no dia, ocupado, meia-preço repetida). Teste na Task 3.

---

## File Structure

- `games/idle/legado.ts` (modificar): + `MUNDO_ARVORE`, `POSICOES_ARVORE`, `ROTULOS_ARVORE`, `escalaArvore`, `SituacaoTela`, `situacaoTela`, `noInicial`, `ondeNo`, `faltam`, `descricaoNo`.
- `games/idle/legado.test.ts` (modificar): testes das funções novas.
- `games/idle/icones.ts` (criar): `iconeFechar()` (sai de `tela.ts`, usado por `tela.ts` e `arvoreTela.ts`).
- `games/idle/arvoreTela.ts` (criar): a árvore em tela cheia e a copa em miniatura (`criarArvoreTela`, `miniArvore`).
- `games/idle/arvoreTela.test.ts` (criar).
- `games/idle/tela.ts` (modificar): abas novas, Loja, empresa/resumo/bancada, Legado novo.
- `games/idle/tela.test.ts` (modificar).
- `games/idle/main.ts` (modificar): nomes das abas.
- `games/idle/idle.css` (reescrever).
- `games/idle/index.html` (modificar): fonte pixel.
- `games/dev/mockIdle.ts` (modificar): `__pontos(n)`.

---

### Task 1: Funções puras da árvore em tela cheia

**Files:**
- Modify: `games/idle/legado.ts`
- Test: `games/idle/legado.test.ts`

**Interfaces:**
- Consumes: `catalogo.arvore: No[]` (`No = { id, ramo, posicao, nome, efeito, custo, tipo, valor, requer: number | null }`), `situacao(no, arvore)` e `RAMOS_ARVORE` (já em `legado.ts`), `RAMOS` de `nomes.ts`.
- Produces:
  - `MUNDO_ARVORE: { largura: 400; altura: 540 }`
  - `POSICOES_ARVORE: Readonly<Record<number, readonly [number, number]>>`
  - `ROTULOS_ARVORE: readonly { nome: string; x: number; y: number }[]`
  - `escalaArvore(largura: number, altura: number): number`
  - `type SituacaoTela = 'comprado' | 'pode' | 'falta' | 'trancado'`
  - `situacaoTela(no: No, arvore: readonly number[], pontosLivres: number): SituacaoTela`
  - `noInicial(arvore: readonly number[], pontosLivres: number): number`
  - `ondeNo(no: No): string`
  - `faltam(n: number): string`
  - `descricaoNo(no: No, sit: SituacaoTela, pontosLivres: number): string`

- [ ] **Step 1: Write the failing tests**

Acrescente ao fim de `games/idle/legado.test.ts` (e acrescente os nomes novos ao `import` de `./legado` que já existe no topo do arquivo; `catalogo` já vem de `./catalogo` — se não vier, importe):

```ts
import {
  descricaoNo, escalaArvore, faltam, MUNDO_ARVORE, noInicial, ondeNo, POSICOES_ARVORE, ROTULOS_ARVORE, situacaoTela,
} from './legado';

const noDe = (id: number) => catalogo.arvore.find((n) => n.id === id)!;

describe('árvore em tela cheia: a copa', () => {
  it('as 26 posições existem e cabem no mundo com folga de 26', () => {
    const ids = Object.keys(POSICOES_ARVORE).map(Number).sort((a, b) => a - b);
    expect(ids).toEqual(catalogo.arvore.map((n) => n.id).sort((a, b) => a - b));
    for (const [x, y] of Object.values(POSICOES_ARVORE)) {
      expect(x).toBeGreaterThanOrEqual(26);
      expect(x).toBeLessThanOrEqual(MUNDO_ARVORE.largura - 26);
      expect(y).toBeGreaterThanOrEqual(26);
      expect(y).toBeLessThanOrEqual(MUNDO_ARVORE.altura - 26);
    }
  });
  it('nenhum nó encosta no outro: centros a 64 ou mais', () => {
    const pos = Object.values(POSICOES_ARVORE);
    for (let i = 0; i < pos.length; i++) {
      for (let j = i + 1; j < pos.length; j++) {
        expect(Math.hypot(pos[i][0] - pos[j][0], pos[i][1] - pos[j][1])).toBeGreaterThanOrEqual(64);
      }
    }
  });
  it('a raiz embaixo de tudo e cada ramo subindo', () => {
    const yRaiz = POSICOES_ARVORE[1][1];
    for (const n of catalogo.arvore) if (n.id !== 1) expect(POSICOES_ARVORE[n.id][1]).toBeLessThan(yRaiz);
    for (const n of catalogo.arvore) {
      if (n.requer !== null && n.requer !== 1) expect(POSICOES_ARVORE[n.id][1]).toBeLessThan(POSICOES_ARVORE[n.requer][1]);
    }
  });
  it('o nome de cada ramo fica 44 acima do 5º nó, dentro do mundo', () => {
    expect(ROTULOS_ARVORE.map((r) => r.nome)).toEqual(['Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente']);
    for (const r of ROTULOS_ARVORE) {
      const quinto = catalogo.arvore.find((n) => n.posicao === 5 && POSICOES_ARVORE[n.id][0] === r.x)!;
      expect(r.y).toBe(POSICOES_ARVORE[quinto.id][1] - 44);
      expect(r.y).toBeGreaterThanOrEqual(8);
    }
  });
  it('escala: cabe no lado mais apertado, presa entre 0,85 e 1,4', () => {
    expect(escalaArvore(400, 540)).toBe(1);
    expect(escalaArvore(2000, 2000)).toBe(1.4);
    expect(escalaArvore(300, 800)).toBe(0.85);
    expect(escalaArvore(380, 900)).toBeCloseTo(0.95, 10);
  });
  it('situação na tela: comprado, dá pra comprar, falta ponto, trancado', () => {
    expect(situacaoTela(noDe(1), [1], 0)).toBe('comprado');
    expect(situacaoTela(noDe(11), [1], 2)).toBe('pode');
    expect(situacaoTela(noDe(11), [1], 1)).toBe('falta');
    expect(situacaoTela(noDe(12), [1], 99)).toBe('trancado');
    expect(situacaoTela(noDe(1), [], 0)).toBe('falta');
  });
  it('nó inicial: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz', () => {
    expect(noInicial([], 5)).toBe(1);
    expect(noInicial([], 0)).toBe(1);
    expect(noInicial([1], 3)).toBe(11);
    expect(noInicial([1, 11], 3)).toBe(21);
    expect(noInicial([1, 11], 1)).toBe(21);
    expect(noInicial(catalogo.arvore.map((n) => n.id), 99)).toBe(1);
  });
  it('textos: onde fica, quanto falta e a descrição pro leitor de tela', () => {
    expect(ondeNo(noDe(1))).toBe('Raiz');
    expect(ondeNo(noDe(12))).toBe('Produção · 2 de 5');
    expect(faltam(1)).toBe('Falta 1 ★');
    expect(faltam(5)).toBe('Faltam 5 ★');
    expect(descricaoNo(noDe(11), 'comprado', 0)).toBe('Cafezinho de garrafa térmica, comprado');
    expect(descricaoNo(noDe(21), 'pode', 3)).toBe('Porquinho quebrado, dá pra comprar por 2 ★');
    expect(descricaoNo(noDe(13), 'falta', 3)).toBe('Turno dobrado, faltam 5 ★');
    expect(descricaoNo(noDe(14), 'trancado', 3)).toBe('Tema da Vitória, trancado');
  });
});
```

- [ ] **Step 2: Run the tests to see them fail**

Run: `cd games && npx vitest run idle/legado.test.ts`
Expected: FAIL — `POSICOES_ARVORE` (e os outros) não exportados.

- [ ] **Step 3: Implement**

Em `games/idle/legado.ts`, acrescente no fim do arquivo (depois de `falta`):

```ts
/** Árvore em tela cheia: o mundo (em unidades) e o centro de cada nó. A raiz embaixo; cada ramo sobe abrindo, como a
 *  copa de uma árvore. Aprovado no mockup (layout-v2.html). Mudar aqui = conferir o teste de distância. */
export const MUNDO_ARVORE = { largura: 400, altura: 540 } as const;
export const POSICOES_ARVORE: Readonly<Record<number, readonly [number, number]>> = {
  1: [200, 510],
  11: [80, 450], 12: [52, 372], 13: [44, 288], 14: [48, 204], 15: [64, 122],
  21: [134, 406], 22: [120, 324], 23: [116, 242], 24: [122, 160], 25: [136, 80],
  31: [200, 378], 32: [200, 302], 33: [200, 222], 34: [200, 142], 35: [200, 56],
  41: [266, 406], 42: [280, 324], 43: [284, 242], 44: [278, 160], 45: [264, 80],
  51: [320, 450], 52: [348, 372], 53: [356, 288], 54: [352, 204], 55: [336, 122],
};

/** O nome de cada ramo, 44 unidades acima do 5º nó dele. */
export const ROTULOS_ARVORE: readonly { nome: string; x: number; y: number }[] = RAMOS_ARVORE
  .filter((r) => r.ramo > 0)
  .map((r) => {
    const [x, y] = POSICOES_ARVORE[r.nos[r.nos.length - 1].id];
    return { nome: r.nome, x, y: y - 44 };
  });

/** Quanto a copa cresce na tela: cabe no lado mais apertado, entre 0,85 (abaixo disso arrasta) e 1,4. */
export function escalaArvore(largura: number, altura: number): number {
  const s = Math.min(largura / MUNDO_ARVORE.largura, altura / MUNDO_ARVORE.altura);
  return Math.min(1.4, Math.max(0.85, s));
}

/** A situação de um nó na tela cheia: o "disponível" se divide em dá pra comprar agora e falta ponto. */
export type SituacaoTela = 'comprado' | 'pode' | 'falta' | 'trancado';
export function situacaoTela(no: No, arvore: readonly number[], pontosLivres: number): SituacaoTela {
  const s = situacao(no, arvore);
  if (s !== 'disponivel') return s;
  return pontosLivres >= no.custo ? 'pode' : 'falta';
}

/** O nó escolhido ao abrir a árvore: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz.
 *  Empate no custo: o menor id. */
export function noInicial(arvore: readonly number[], pontosLivres: number): number {
  const porCusto = [...catalogo.arvore].sort((a, b) => a.custo - b.custo || a.id - b.id);
  const achar = (sit: SituacaoTela) => porCusto.find((n) => situacaoTela(n, arvore, pontosLivres) === sit);
  return (achar('pode') ?? achar('falta') ?? catalogo.arvore.find((n) => n.ramo === 0)!).id;
}

/** "Produção · 2 de 5"; a raiz diz "Raiz". */
export const ondeNo = (no: No): string => (no.ramo === 0 ? 'Raiz' : `${RAMOS[no.ramo]} · ${no.posicao} de 5`);

/** "Falta 1 ★" / "Faltam 5 ★". */
export const faltam = (n: number): string => (n === 1 ? 'Falta 1 ★' : `Faltam ${n} ★`);

/** O rótulo do nó pro leitor de tela: "Turno dobrado, faltam 5 ★". */
export function descricaoNo(no: No, sit: SituacaoTela, pontosLivres: number): string {
  if (sit === 'comprado') return `${no.nome}, comprado`;
  if (sit === 'pode') return `${no.nome}, dá pra comprar por ${no.custo} ★`;
  if (sit === 'falta') return `${no.nome}, ${faltam(no.custo - pontosLivres).toLowerCase()}`;
  return `${no.nome}, trancado`;
}
```

- [ ] **Step 4: Run the tests to see them pass**

Run: `cd games && npx vitest run idle/legado.test.ts`
Expected: PASS, saída limpa.

- [ ] **Step 5: Commit**

```bash
cd games && npx tsc --noEmit && npx vitest run
git add idle/legado.ts idle/legado.test.ts
git commit -m "Fellas Inc.: posições da copa, escala, situação e nó inicial da árvore em tela cheia"
```

---

### Task 2: Quatro abas e a Loja (Geradores | Melhorias)

**Files:**
- Modify: `games/idle/tela.ts` (tipo `Aba`, `botoesAba`, painel, `renderizar`)
- Modify: `games/idle/main.ts:40,71-73,110,202,271`
- Test: `games/idle/tela.test.ts`

**Interfaces:**
- Produces: `export type Aba = 'loja' | 'gente' | 'placar' | 'legado'`. Elemento `.seg.seg-loja` com dois botões (Geradores, Melhorias / "Melhorias (N)"). As listas mantêm as classes de hoje (`.lista-geradores`, `.lista-melhorias`, `.lista-contratar`, `.lista-placar`, `.lista-legado`).

- [ ] **Step 1: Update the tests (failing)**

Em `games/idle/tela.test.ts`:

1. No `modelo()` (linha ~20), troque `aba: 'geradores'` por `aba: 'loja'`.
2. Troque todo `aba: 'contratar'` por `aba: 'gente'` (5 lugares no `describe('contratar')` e no `describe('placar que falhou')`).
3. No teste `'melhorias: Compradas mostra ...'`: troque `modelo({ aba: 'melhorias', ...})` por `modelo({ estado: ... })` (mesmo estado), e logo depois do `tela.renderizar(...)` acrescente `porTexto(root.querySelector('.seg-loja button:last-child')!.textContent!).click();`. Troque `porTexto(root.querySelector('.seg button')!.textContent!).click();` por `porTexto(root.querySelector('.lista-melhorias .seg button')!.textContent!).click();`.
4. Substitua o teste `'cinco abas, Legado por último'` por:

```ts
  it('quatro abas: Loja, Gente, Placar, Legado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    expect([...root.querySelectorAll('.abas .aba')].map((b) => b.textContent)).toEqual(['Loja', 'Gente', 'Placar', 'Legado']);
    porTexto('Gente').click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('gente');
    porTexto('Legado').click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('legado');
  });
  it('Loja: Geradores | Melhorias troca a lista; Melhorias diz quantas estão à venda', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    const [verG, verM] = [...root.querySelectorAll<HTMLButtonElement>('.seg-loja button')];
    expect(verG.getAttribute('aria-pressed')).toBe('true');
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.lista-melhorias')!.hasAttribute('hidden')).toBe(true);
    expect(verM.textContent).toMatch(/^Melhorias \(\d+\)$/);
    verM.click();
    expect(root.querySelector('.lista-geradores')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.lista-melhorias')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.seg-loja button:last-child')!.getAttribute('aria-pressed')).toBe('true');
    // fora da Loja, o seletor some
    tela.renderizar(modelo({ aba: 'placar', placar: [] }));
    expect(root.querySelector('.seg-loja')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.lista-melhorias')!.hasAttribute('hidden')).toBe(true);
  });
```

Run: `cd games && npx vitest run idle/tela.test.ts`
Expected: FAIL (tipo `Aba` não aceita `'loja'`/`'gente'`; abas antigas).

- [ ] **Step 2: Implement in `tela.ts`**

1. Troque `export type Aba = 'geradores' | 'melhorias' | 'contratar' | 'placar' | 'legado';` por:

```ts
export type Aba = 'loja' | 'gente' | 'placar' | 'legado';
```

2. Troque o bloco `const abas = el('nav', 'abas'); ... abas.append(...)` por:

```ts
  const abas = el('nav', 'abas');
  const botoesAba: Record<Aba, HTMLButtonElement> = {
    loja: button('Loja', 'aba', () => a.trocarAba('loja')),
    gente: button('Gente', 'aba', () => a.trocarAba('gente')),
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
    legado: button('Legado', 'aba', () => a.trocarAba('legado')),
  };
  abas.append(botoesAba.loja, botoesAba.gente, botoesAba.placar, botoesAba.legado);
  // Loja: Geradores | Melhorias (só apresentação, como o À venda | Compradas)
  const segLoja = el('div', 'seg seg-loja');
  segLoja.setAttribute('role', 'group');
  segLoja.setAttribute('aria-label', 'Loja');
  const verGeradores = button('Geradores', '', () => {
    lojaVer = 'geradores';
    if (ultimo) renderizar(ultimo);
  });
  const verMelhorias = button('Melhorias', '', () => {
    lojaVer = 'melhorias';
    if (ultimo) renderizar(ultimo);
  });
  segLoja.append(verGeradores, verMelhorias);
```

3. Troque `painel.append(abrir, abas, listaG, listaM, listaC, listaP, listaL);` por `painel.append(abrir, abas, segLoja, listaG, listaM, listaC, listaP, listaL);`.

4. Junto das outras variáveis de apresentação (perto de `let verCompradas = false;`), acrescente:

```ts
  // aba Loja: Geradores ou Melhorias (só apresentação)
  let lojaVer: 'geradores' | 'melhorias' = 'geradores';
```

5. Em `renderizar`, troque as três linhas `mostrar(listaG, ...)`, `mostrar(listaM, ...)`, `mostrar(listaC, ...)` por:

```ts
    const naLoja = jogando && m.aba === 'loja';
    mostrar(segLoja, naLoja);
    for (const [b, v] of [[verGeradores, 'geradores'], [verMelhorias, 'melhorias']] as const) {
      b.classList.toggle('ativo', lojaVer === v);
      b.setAttribute('aria-pressed', String(lojaVer === v));
    }
    mostrar(listaG, naLoja && lojaVer === 'geradores');
    mostrar(listaM, naLoja && lojaVer === 'melhorias');
    mostrar(listaC, jogando && m.aba === 'gente');
```

6. Logo depois de calcular `disponiveis` (o `.filter(...).sort(...)` das melhorias), acrescente:

```ts
      verMelhorias.textContent = disponiveis.length ? `Melhorias (${disponiveis.length})` : 'Melhorias';
```

7. No bloco do contratar, troque `if (s && jogando && m.aba === 'contratar') {` por `if (s && jogando && m.aba === 'gente') {`.

- [ ] **Step 3: Implement in `main.ts`**

- Linha 40: `let aba: Aba = 'geradores';` → `let aba: Aba = 'loja';`
- Em `trocarAba`: `if (nova === 'placar' || nova === 'contratar') void carregarPlacar();` → `if (nova === 'placar' || nova === 'gente') void carregarPlacar();` e `if (nova === 'contratar') void prepararDesenhista();` → `if (nova === 'gente') void prepararDesenhista();`
- Na venda: `aba = 'geradores'; // quando reabrir a empresa, começa comprando` → `aba = 'loja'; // quando reabrir a empresa, começa comprando`
- Em `salvarVisual` e no `setInterval` de 60 s: `aba === 'contratar'` → `aba === 'gente'`.
- Procure qualquer outro `'contratar'`, `'geradores'` ou `'melhorias'` usado como aba em `main.ts` (`grep -n "'contratar'\|'geradores'\|'melhorias'" idle/main.ts`) e troque do mesmo jeito.

- [ ] **Step 4: Run tests**

Run: `cd games && npx tsc --noEmit && npx vitest run idle/tela.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd games && npx vitest run
git add idle/tela.ts idle/tela.test.ts idle/main.ts
git commit -m "Fellas Inc.: quatro abas (Loja, Gente, Placar, Legado) e a Loja com Geradores | Melhorias"
```

---

### Task 3: Empresa, resumo, bancada (Caixinha) e topo

**Files:**
- Modify: `games/idle/tela.ts` (`criarTela`: topo, cartão da empresa, bancada; `renderizar`; o miolo da caixinha vira função)
- Test: `games/idle/tela.test.ts`

**Interfaces:**
- Consumes: `Modelo`, `Acoes` de hoje; `ativos.oportunidade(0)`; `ERAS`.
- Produces (DOM): `header.top` com `.marca` e `button.topo-visual` ("Mudar visual"); `div.empresa` > `div.cartao-empresa` (> `.palco`, `.valor`, `.abrir`) + `section.bancada` (> `.gavetas` > `button.gaveta` (> `.gaveta-caixa` (> `.gaveta-icone`, `.selo`), `.gaveta-nome`), `.gaveta-corpo`). `.valor` ganha `.info`. A classe `sem-painel` no `.app` quando não há nada no painel (fase "antes" sem Legado). O botão `.caixinha` do topo deixa de existir.

- [ ] **Step 1: Write the failing tests**

Em `games/idle/tela.test.ts`, substitua o teste `'aviso aparece; caixinha mostra quantas tem'` por:

```ts
  it('aviso aparece; a gaveta Caixinha mostra quantas tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aviso: 'Valuation não cobre essa compra', pendentes: [3, 2] }));
    expect(root.querySelector('.notice')!.textContent).toContain('Valuation não cobre essa compra');
    expect(root.querySelector('.gaveta .selo')!.textContent).toBe('2');
    expect(root.querySelector('.caixinha')).toBeNull();
  });
```

E acrescente um `describe` novo no fim do arquivo:

```ts
describe('empresa, resumo e bancada', () => {
  it('topo: Mudar visual abre o editor', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    root.querySelector<HTMLButtonElement>('.top .topo-visual')!.click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
  });
  it('resumo: era, contratados e o bônus das conquistas (some o que for zero)', () => {
    const tela = criarTela(root, acoes);
    const ate = '2026-10-19T12:00:00.000Z';
    tela.renderizar(modelo({ estado: estado({
      era: 3,
      equipe: [{ user_id: 'b', cargo: 'CEO de nada', avatar: null, ate }, { user_id: 'c', cargo: 'Estagiário', avatar: null, ate }],
      bonus: { arvore: [], conquistas: 12 },
    }) }));
    expect([...root.querySelectorAll('.valor .info span')].map((x) => x.textContent))
      .toEqual(['Era 3 · Escritório', '2 contratados', '+12% das conquistas']);
    tela.renderizar(modelo());
    expect([...root.querySelectorAll('.valor .info span')].map((x) => x.textContent)).toEqual(['Era 1 · Quarto']);
  });
  it('gaveta Caixinha no celular abre a folha; sem nada guardado o selo some', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ pendentes: [3] }));
    root.querySelector<HTMLButtonElement>('.gaveta')!.click();
    expect(acoes.caixa).toHaveBeenCalledWith(true);
    tela.renderizar(modelo({ pendentes: [] }));
    expect(root.querySelector('.gaveta .selo')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.gaveta-corpo')!.textContent).toContain('Nada guardado agora. Volta mais tarde.');
  });
  it('no PC a gaveta não abre a folha (a lista já está na bancada)', () => {
    const larga = vi.spyOn(window, 'matchMedia').mockReturnValue({ matches: true } as MediaQueryList);
    try {
      const tela = criarTela(root, acoes);
      tela.renderizar(modelo({ pendentes: [3] }));
      root.querySelector<HTMLButtonElement>('.gaveta')!.click();
      expect(acoes.caixa).not.toHaveBeenCalled();
    } finally {
      larga.mockRestore();
    }
  });
  it('a gaveta aberta lista as guardadas com Pegar, com as mesmas regras da folha', () => {
    const uid = '00000000-0000-0000-0000-00000000000a';
    const janela = (k: 0 | 1 | 2) => { let w = 50; while (tipo(uid, w) !== k) w++; return w; };
    const meia = janela(2);
    const outra = janela(0);
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ pendentes: [meia, outra], estado: estado({ user_id: uid, half_price: true }) }));
    const [m1, o1] = [...root.querySelectorAll('.bancada .escolha')];
    expect(m1.querySelector('button')!.disabled).toBe(true);
    expect(m1.textContent).toContain('Usa a que você já tem primeiro');
    o1.querySelector('button')!.click();
    expect(acoes.pegar).toHaveBeenCalledWith(outra);
    tela.renderizar(modelo({ pendentes: [outra], estado: estado({ user_id: uid, opp_left: 0 }) }));
    expect(root.querySelector('.gaveta-corpo')!.textContent).toContain('Já pegou todas de hoje. Amanhã tem mais.');
    expect(root.querySelector<HTMLButtonElement>('.bancada .escolha button')!.disabled).toBe(true);
    tela.renderizar(modelo({ pendentes: [outra], estado: estado({ user_id: uid }), ocupado: true }));
    expect(root.querySelector<HTMLButtonElement>('.bancada .escolha button')!.disabled).toBe(true);
  });
  it('antes do Abrir CNPJ: sem bancada; sem Legado o painel some', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.bancada')!.hasAttribute('hidden')).toBe(true);
    expect(root.querySelector('.app')!.classList.contains('sem-painel')).toBe(true);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false, pontos: 5, pontos_vida: 5 }) }));
    expect(root.querySelector('.app')!.classList.contains('sem-painel')).toBe(false);
    tela.renderizar(modelo());
    expect(root.querySelector('.app')!.classList.contains('sem-painel')).toBe(false);
  });
});
```

Run: `cd games && npx vitest run idle/tela.test.ts`
Expected: FAIL (`.gaveta`, `.topo-visual`, `.info`, `.bancada` não existem).

- [ ] **Step 2: Implement the DOM in `criarTela`**

1. Troque o topo:

```ts
  const topo = el('header', 'top');
  const voltar = el('a', undefined, '← Voltar');
  voltar.href = '/games';
  const caixinha = button('Oportunidades (0)', 'btn caixinha', () => a.caixa(true));
  topo.append(voltar, el('span', undefined, 'Fellas Inc.'), caixinha);
```

por:

```ts
  const topo = el('header', 'top');
  const voltar = el('a', undefined, '← Voltar');
  voltar.href = '/games';
  const mudarVisual = button('Mudar visual', 'btn topo-visual', () => a.editor('abrir'));
  topo.append(voltar, el('span', 'marca', 'Fellas Inc.'), mudarVisual);
```

2. Troque `placa.append(numero, taxaTxt, bonus);` por:

```ts
  // resumo (o PC mostra do lado da cena; o celular esconde .info pelo CSS)
  const info = el('div', 'info');
  placa.append(numero, taxaTxt, bonus, info);
```

3. Logo depois do bloco `const abrir = el('div', 'abrir'); abrir.append(...);`, acrescente:

```ts
  // a empresa: cena + resumo (ou o Abrir CNPJ) num cartão, e a bancada embaixo
  const cartaoEmpresa = el('div', 'cartao-empresa');
  cartaoEmpresa.append(palco, placa, abrir);
  // bancada: uma gaveta por coisa que acontece (por enquanto só a Caixinha; os minigames entram aqui depois)
  const larga = () => window.matchMedia?.('(min-width: 1100px)').matches === true;
  const gavetaCaixa = button('', 'gaveta', () => {
    if (!larga()) a.caixa(true); // no PC a lista já está aberta na bancada
  });
  gavetaCaixa.setAttribute('aria-pressed', 'true');
  const caixaIcone = el('span', 'gaveta-caixa');
  const iconeOpp = el('span', 'gaveta-icone');
  iconeOpp.style.backgroundImage = `url(${ativos.oportunidade(0)})`;
  const selo = el('span', 'selo', '0');
  caixaIcone.append(iconeOpp, selo);
  gavetaCaixa.append(caixaIcone, el('span', 'gaveta-nome', 'Caixinha'));
  const gavetas = el('div', 'gavetas');
  gavetas.append(gavetaCaixa);
  const corpoBancada = el('div', 'gaveta-corpo');
  const bancada = el('section', 'bancada');
  bancada.setAttribute('aria-label', 'Bancada');
  bancada.append(gavetas, corpoBancada);
  const empresa = el('div', 'empresa');
  empresa.append(cartaoEmpresa, bancada);
```

4. Troque `painel.append(abrir, abas, segLoja, listaG, listaM, listaC, listaP, listaL);` por `painel.append(abas, segLoja, listaG, listaM, listaC, listaP, listaL);`.

5. Troque `app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC, modalV, modalP);` por `app.append(topo, empresa, painel, notice, overlay, modalE, modalC, modalV, modalP);`.

- [ ] **Step 3: Extract the caixinha body and render the bancada**

1. Antes de `function renderizar(m: Modelo) {`, acrescente esta função (é o miolo que hoje está dentro do bloco `// caixinha`, sem mudar regra nenhuma):

```ts
  /** O miolo da caixinha: quantas ainda dá pra pegar hoje e uma linha por guardada. Serve pra folha do celular e pra
   *  gaveta da bancada no PC (mesmas regras de botão apagado). */
  function itensCaixinha(s: IdleState, m: Modelo): HTMLElement[] {
    const out: HTMLElement[] = [el('p', 'sub', s.opp_left > 0 ? `Hoje ainda dá pra pegar ${s.opp_left}.` : 'Já pegou todas de hoje. Amanhã tem mais.')];
    if (!m.pendentes.length) {
      out.push(el('p', 'vazio', 'Nada guardado agora. Volta mais tarde.'));
      return out;
    }
    const lista = el('ul', 'escolhas');
    for (const w of m.pendentes) {
      const k = tipoOportunidade(s.user_id, w);
      const li = el('li', 'escolha');
      const bonequinho = el('div', 'boneco');
      bonequinho.style.backgroundImage = `url(${ativos.oportunidade(k)})`;
      const texto = el('div', 'escolha-texto');
      const quando = el('span', 'sub prazo', '');
      texto.append(el('strong', undefined, TEXTO_TIPO[k]), quando);
      prazos.push({ texto: quando, fim: sai(s.user_id, w, caixa(s).tamanho) });
      // meia-preço não acumula: pegar outra antes de usar a guardada só gastaria uma pega do dia
      const repetida = meiaPrecoRepetida(k, s);
      if (repetida) texto.append(el('span', 'sub', 'Usa a que você já tem primeiro'));
      const b = button('Pegar', 'btn main compacto', () => a.pegar(w));
      b.disabled = m.ocupado || s.opp_left <= 0 || repetida;
      li.append(bonequinho, texto, b);
      lista.append(li);
    }
    out.push(lista);
    return out;
  }
```

2. No bloco `// caixinha` de `renderizar`, troque tudo entre `folha.append(topo, el('p', 'sub', ...));` e `modalC.append(folha);` (o `if (!m.pendentes.length)...`, o `const lista`, o `for`, o `if (m.pendentes.length) folha.append(lista);`) por:

```ts
      folha.append(topo, ...itensCaixinha(s, m));
```

(o `const folha`, o `const topo`, o botão fechar, `modalC.append(folha);` e o `atualizarPrazos();` continuam.)

3. Em `renderizar`, troque as linhas que usam `caixinha` (`caixinha.textContent = ...` e `mostrar(caixinha, jogando);`) por:

```ts
    // bancada: a gaveta Caixinha com quantas tem; no PC o corpo mostra a lista
    selo.textContent = String(m.pendentes.length);
    mostrar(selo, m.pendentes.length > 0);
    gavetaCaixa.setAttribute('aria-label', `Caixinha: ${m.pendentes.length} ${m.pendentes.length === 1 ? 'oportunidade guardada' : 'oportunidades guardadas'}`);
    mostrar(bancada, jogando);
    corpoBancada.replaceChildren(...(s && jogando ? itensCaixinha(s, m) : []));
    mostrar(mudarVisual, jogando);
    app.classList.toggle('sem-painel', !jogando && !verLegado);
```

Atenção: essas linhas usam `verLegado`; ponha-as **depois** da linha `const verLegado = ...`.

4. Ainda em `renderizar`, onde hoje preenche `taxaTxt.textContent = formatarTaxa(s.rate);` (dentro de `if (s && jogando)`), acrescente logo abaixo:

```ts
      info.replaceChildren(el('span', undefined, `Era ${s.era} · ${ERAS[s.era - 1]}`));
      if (s.equipe.length) info.append(el('span', undefined, s.equipe.length === 1 ? '1 contratado' : `${s.equipe.length} contratados`));
      if (s.bonus.conquistas > 0) info.append(el('span', undefined, `+${s.bonus.conquistas}% das conquistas`));
```

- [ ] **Step 4: Run tests**

Run: `cd games && npx tsc --noEmit && npx vitest run idle/tela.test.ts`
Expected: PASS. (Os testes antigos da folha da caixinha continuam passando: eles olham só dentro de `.modal-caixa`.)

- [ ] **Step 5: Commit**

```bash
cd games && npx vitest run
git add idle/tela.ts idle/tela.test.ts
git commit -m "Fellas Inc.: cartão da empresa com resumo, bancada com a Caixinha e Mudar visual no topo"
```

---

### Task 4: Árvore em tela cheia (módulo próprio)

**Files:**
- Create: `games/idle/icones.ts`
- Create: `games/idle/arvoreTela.ts`
- Test: `games/idle/arvoreTela.test.ts`
- Modify: `games/idle/tela.ts` (tirar `iconeFechar` dali e importar de `./icones`)

**Interfaces:**
- Consumes (Task 1): `MUNDO_ARVORE`, `POSICOES_ARVORE`, `ROTULOS_ARVORE`, `escalaArvore`, `situacaoTela`, `SituacaoTela`, `noInicial`, `ondeNo`, `faltam`, `descricaoNo`, e `falta`, `pontos` (já existem em `legado.ts`); `ativos.no(id): string | null`; `catalogo.arvore`; `button`/`el` de `../shared/hud/hud`.
- Produces:
  - `iconeFechar(): SVGSVGElement` (em `icones.ts`)
  - `type ArvoreTela = { elemento: HTMLElement; aberta(): boolean; abrir(s: IdleState, ocupado: boolean, volta: () => HTMLElement | null): void; fechar(): void; renderizar(s: IdleState, ocupado: boolean): void }`
  - `criarArvoreTela(comprar: (id: number) => void): ArvoreTela`
  - `miniArvore(s: IdleState): SVGSVGElement` (copa em miniatura, decorativa)
  - DOM: `.arvore-tela[role=dialog]` > `.arvore-topo` (`.fechar`, `h2#idle-titulo-arvore`, `.arvore-pontos`) + `.arvore-corpo` > `.arvore-palco` > `.arvore-mundo` (svg com `line.ligacao.<sit>`, `span.arvore-ramo`, `button.no-arvore.<sit>[data-no]`) + `.arvore-lado` (`ul.arvore-legenda`, `.arvore-cartao`).

- [ ] **Step 1: Create `icones.ts` and use it in `tela.ts`**

`games/idle/icones.ts`:

```ts
// Ícones de traço desenhados (não glifo).

/** X de fechar, traço de 2px. */
export function iconeFechar() {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 20 20');
  svg.setAttribute('width', '20');
  svg.setAttribute('height', '20');
  svg.setAttribute('aria-hidden', 'true');
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', 'M5 5l10 10M15 5L5 15');
  p.setAttribute('stroke', 'currentColor');
  p.setAttribute('stroke-width', '2');
  p.setAttribute('stroke-linecap', 'round');
  svg.append(p);
  return svg;
}
```

Em `tela.ts`: apague a função `iconeFechar` (e o comentário `/** X desenhado (não glifo), traço de 2px. */` acima dela) e acrescente `import { iconeFechar } from './icones';` aos imports.

- [ ] **Step 2: Write the failing tests**

`games/idle/arvoreTela.test.ts`:

```ts
// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { criarArvoreTela, miniArvore } from './arvoreTela';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});

let comprar: ReturnType<typeof vi.fn<(id: number) => void>>;
let volta: HTMLButtonElement;
beforeEach(() => {
  document.body.innerHTML = '<button id="volta">Abrir</button>';
  volta = document.getElementById('volta') as HTMLButtonElement;
  comprar = vi.fn<(id: number) => void>();
});
const abrir = (s: IdleState, ocupado = false) => {
  const t = criarArvoreTela(comprar);
  document.body.append(t.elemento);
  t.abrir(s, ocupado, () => volta);
  return t;
};
const no = (id: number) => document.querySelector<HTMLButtonElement>(`.no-arvore[data-no="${id}"]`)!;
const cartao = () => document.querySelector('.arvore-cartao')!;

describe('árvore em tela cheia', () => {
  it('fechada até abrir; abre com os 26 nós, as situações nas classes e os pontos no topo', () => {
    const t = criarArvoreTela(comprar);
    document.body.append(t.elemento);
    expect(t.aberta()).toBe(false);
    expect(t.elemento.hasAttribute('hidden')).toBe(true);
    t.abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }), false, () => volta);
    expect(t.aberta()).toBe(true);
    expect(document.querySelectorAll('.no-arvore')).toHaveLength(26);
    expect(no(11).classList.contains('comprado')).toBe(true);
    expect(no(21).classList.contains('pode')).toBe(true);
    expect(no(12).classList.contains('falta')).toBe(true);
    expect(no(13).classList.contains('trancado')).toBe(true);
    expect(no(12).getAttribute('aria-label')).toBe('Ô loco, bicho!, falta 1 ★');
    expect(no(12).querySelector('.no-custo')!.textContent).toBe('4 ★');
    expect(no(11).querySelector('.no-custo')).toBeNull();
    expect(document.querySelectorAll('.ligacao')).toHaveLength(25);
    expect(document.querySelectorAll('.ligacao.comprado')).toHaveLength(1); // 1 → 11
    expect(document.querySelector('.arvore-pontos')!.textContent).toBe('★ 3');
    expect([...document.querySelectorAll('.arvore-ramo')].map((r) => r.textContent)).toEqual(['Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente']);
  });
  it('abre com o nó mais barato que dá pra comprar escolhido; Comprar chama comprar(id)', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    expect(no(21).getAttribute('aria-pressed')).toBe('true');
    expect(cartao().textContent).toContain('Porquinho quebrado');
    expect(cartao().textContent).toContain('Recomeço · 1 de 5');
    expect(cartao().textContent).toContain('O Abrir CNPJ começa com F$ 1 mil.');
    const b = cartao().querySelector('button')!;
    expect(b.textContent).toBe('Comprar · 2 ★');
    b.click();
    expect(comprar).toHaveBeenCalledWith(21);
  });
  it('tocar noutro nó troca o cartão: falta ponto, trancado, comprado', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    no(12).click();
    expect(no(12).getAttribute('aria-pressed')).toBe('true');
    expect(no(21).getAttribute('aria-pressed')).toBe('false');
    const b = cartao().querySelector('button')!;
    expect(b.textContent).toBe('Falta 1 ★');
    expect(b.disabled).toBe(true);
    no(13).click();
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().textContent).toContain('Libera com Ô loco, bicho!');
    no(11).click();
    expect(cartao().querySelector('button')).toBeNull();
    expect(cartao().textContent).toContain('Comprado');
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
  it('arrastar e soltar em cima de um nó não escolhe o nó', () => {
    abrir(estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }));
    const palco = document.querySelector<HTMLElement>('.arvore-palco')!;
    const alvo = no(41);
    palco.dispatchEvent(new PointerEvent('pointerdown', { clientX: 100, clientY: 100, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointermove', { clientX: 140, clientY: 120, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { clientX: 140, clientY: 120, bubbles: true }));
    alvo.click();
    expect(no(41).getAttribute('aria-pressed')).toBe('false');
    // um toque de verdade depois do arraste escolhe
    palco.dispatchEvent(new PointerEvent('pointerdown', { clientX: 10, clientY: 10, bubbles: true }));
    palco.dispatchEvent(new PointerEvent('pointerup', { clientX: 11, clientY: 10, bubbles: true }));
    no(41).click();
    expect(no(41).getAttribute('aria-pressed')).toBe('true');
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
  it('legenda com as 4 situações', () => {
    abrir(estado());
    expect([...document.querySelectorAll('.arvore-legenda li')].map((x) => x.textContent))
      .toEqual(['Comprado', 'Dá pra comprar', 'Falta ponto', 'Trancado']);
  });
  it('miniatura: 26 quadradinhos e 25 linhas, decorativa', () => {
    const svg = miniArvore(estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }));
    expect(svg.getAttribute('aria-hidden')).toBe('true');
    expect(svg.querySelectorAll('rect.mini-no')).toHaveLength(26);
    expect(svg.querySelectorAll('line.ligacao')).toHaveLength(25);
    expect(svg.querySelectorAll('rect.mini-no.comprado')).toHaveLength(2);
  });
});
```

Run: `cd games && npx vitest run idle/arvoreTela.test.ts`
Expected: FAIL — `./arvoreTela` não existe.

- [ ] **Step 3: Implement `games/idle/arvoreTela.ts`**

```ts
// Árvore de habilidades em tela cheia, em forma de copa (raiz embaixo, ramos subindo), e a copa em miniatura do quadro
// do Legado. Só desenha: quem compra é o banco (comprar(id)). O nó escolhido, a escala e o arraste vivem aqui, fora do
// modelo. Texto sempre por textContent.
import { button, el } from '../shared/hud/hud';
import type { IdleState } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, type No } from './catalogo';
import { iconeFechar } from './icones';
import {
  descricaoNo, escalaArvore, falta, faltam, MUNDO_ARVORE, noInicial, ondeNo, pontos, POSICOES_ARVORE, ROTULOS_ARVORE,
  situacaoTela, type SituacaoTela,
} from './legado';

const NS = 'http://www.w3.org/2000/svg';
/** Mexeu mais que isso com o dedo/mouse apertado: é arraste, não toque. */
const ARRASTE_PX = 6;
const LEGENDA: readonly [SituacaoTela, string][] = [
  ['comprado', 'Comprado'], ['pode', 'Dá pra comprar'], ['falta', 'Falta ponto'], ['trancado', 'Trancado'],
];

export type ArvoreTela = {
  elemento: HTMLElement;
  aberta(): boolean;
  /** `volta` devolve o botão que recebe o foco ao fechar (o Abrir é recriado a cada renderização). */
  abrir(s: IdleState, ocupado: boolean, volta: () => HTMLElement | null): void;
  fechar(): void;
  renderizar(s: IdleState, ocupado: boolean): void;
};

const situacoes = (s: IdleState) =>
  new Map(catalogo.arvore.map((n) => [n.id, situacaoTela(n, s.bonus.arvore, s.pontos)] as const));

/** As linhas entre cada nó e o anterior do ramo, num svg (k = px por unidade do mundo). */
function ligacoes(svg: SVGSVGElement, sits: Map<number, SituacaoTela>, k: number) {
  for (const n of catalogo.arvore) {
    if (n.requer === null) continue;
    const [x1, y1] = POSICOES_ARVORE[n.requer];
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

/** Ícone 16x16 ampliado; sem a arte, só a moldura. */
function icone(n: No) {
  const box = el('span', 'icone-legado');
  const url = ativos.no(n.id);
  if (url) box.style.backgroundImage = `url(${url})`;
  else box.classList.add('sem-arte');
  return box;
}

/** A copa em miniatura do quadro do Legado (decorativa: o texto do lado diz quantos comprou). */
export function miniArvore(s: IdleState): SVGSVGElement {
  const sits = situacoes(s);
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${MUNDO_ARVORE.largura} ${MUNDO_ARVORE.altura}`);
  svg.setAttribute('class', 'arvore-mini');
  svg.setAttribute('aria-hidden', 'true');
  ligacoes(svg, sits, 1);
  for (const n of catalogo.arvore) {
    const [x, y] = POSICOES_ARVORE[n.id];
    const r = document.createElementNS(NS, 'rect');
    r.setAttribute('x', String(x - 20));
    r.setAttribute('y', String(y - 20));
    r.setAttribute('width', '40');
    r.setAttribute('height', '40');
    r.setAttribute('class', `mini-no ${sits.get(n.id)}`);
    svg.append(r);
    const url = ativos.no(n.id);
    if (url) {
      const im = document.createElementNS(NS, 'image');
      im.setAttribute('href', url);
      im.setAttribute('x', String(x - 16));
      im.setAttribute('y', String(y - 16));
      im.setAttribute('width', '32');
      im.setAttribute('height', '32');
      im.setAttribute('class', `mini-icone ${sits.get(n.id)}`);
      svg.append(im);
    }
  }
  return svg;
}

export function criarArvoreTela(comprar: (id: number) => void): ArvoreTela {
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
  const pontosTopo = el('span', 'arvore-pontos');
  topo.append(fecharB, titulo, pontosTopo);
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
  tela.append(topo, corpo);

  let estado: IdleState | null = null;
  let ocupado = false;
  let escolhido: number | null = null;
  let volta: () => HTMLElement | null = () => null;
  let desloc = { x: 0, y: 0 };
  let arraste: { x: number; y: number; dx: number; dy: number; moveu: boolean } | null = null;
  let engolirClique = false;

  const aberta = () => !tela.hasAttribute('hidden');
  // sem tamanho (escondida ou nos testes): escala 1
  const escala = () => (palco.clientWidth && palco.clientHeight ? escalaArvore(palco.clientWidth, palco.clientHeight) : 1);

  /** Prende o arraste às bordas: só dá pra arrastar o que passa do palco. */
  function posicionar() {
    const k = escala();
    const lx = Math.max(0, (MUNDO_ARVORE.largura * k - palco.clientWidth) / 2);
    const ly = Math.max(0, (MUNDO_ARVORE.altura * k - palco.clientHeight) / 2);
    desloc = { x: Math.max(-lx, Math.min(lx, desloc.x)), y: Math.max(-ly, Math.min(ly, desloc.y)) };
    mundo.style.transform = `translate(${desloc.x}px, ${desloc.y}px)`;
  }

  palco.addEventListener('pointerdown', (e) => {
    engolirClique = false;
    arraste = { x: e.clientX, y: e.clientY, dx: desloc.x, dy: desloc.y, moveu: false };
  });
  palco.addEventListener('pointermove', (e) => {
    if (!arraste) return;
    const dx = e.clientX - arraste.x;
    const dy = e.clientY - arraste.y;
    if (!arraste.moveu && Math.hypot(dx, dy) <= ARRASTE_PX) return;
    arraste.moveu = true;
    desloc = { x: arraste.dx + dx, y: arraste.dy + dy };
    posicionar();
  });
  const soltar = () => {
    if (arraste?.moveu) engolirClique = true;
    arraste = null;
  };
  palco.addEventListener('pointerup', soltar);
  palco.addEventListener('pointerleave', soltar);
  palco.addEventListener('pointercancel', () => { arraste = null; });
  // o clique que vem no fim de um arraste não escolhe nó
  palco.addEventListener('click', (e) => {
    if (!engolirClique) return;
    engolirClique = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  tela.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    fechar();
  });
  if (typeof ResizeObserver !== 'undefined') new ResizeObserver(() => { if (aberta()) desenhar(); }).observe(palco);

  function desenharCartao(s: IdleState, sits: Map<number, SituacaoTela>) {
    cartao.replaceChildren();
    const n = catalogo.arvore.find((x) => x.id === escolhido);
    if (!n) return;
    const sit = sits.get(n.id)!;
    const ic = icone(n);
    ic.classList.add(sit);
    const texto = el('div', 'meio');
    texto.append(el('strong', undefined, n.nome), el('span', 'onde', ondeNo(n)), el('p', undefined, n.efeito));
    const acao = el('div', 'arvore-acao');
    if (sit === 'comprado') acao.append(el('span', 'no-feito', 'Comprado'));
    else if (sit === 'trancado') acao.append(el('span', 'sub', falta(n)));
    else {
      const b = button(sit === 'pode' ? `Comprar · ${n.custo} ★` : faltam(n.custo - s.pontos), 'btn main', () => comprar(n.id));
      b.disabled = sit !== 'pode' || ocupado;
      acao.append(b);
    }
    cartao.append(ic, texto, acao);
  }

  function desenhar() {
    if (!estado) return;
    const s = estado;
    const sits = situacoes(s);
    const k = escala();
    const W = MUNDO_ARVORE.largura * k;
    const H = MUNDO_ARVORE.altura * k;
    mundo.style.width = `${W}px`;
    mundo.style.height = `${H}px`;
    mundo.style.marginLeft = `${-W / 2}px`;
    mundo.style.marginTop = `${-H / 2}px`;
    // o foco fica no mesmo nó depois de redesenhar
    const focado = (document.activeElement as HTMLElement | null)?.dataset?.no;
    const svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('width', String(W));
    svg.setAttribute('height', String(H));
    svg.setAttribute('aria-hidden', 'true');
    ligacoes(svg, sits, k);
    const filhos: Element[] = [svg];
    for (const r of ROTULOS_ARVORE) {
      const t = el('span', 'arvore-ramo', r.nome);
      t.style.left = `${r.x * k}px`;
      t.style.top = `${r.y * k}px`;
      filhos.push(t);
    }
    for (const n of catalogo.arvore) {
      const sit = sits.get(n.id)!;
      const [x, y] = POSICOES_ARVORE[n.id];
      const b = button('', `no-arvore ${sit}${escolhido === n.id ? ' escolhido' : ''}`, () => {
        escolhido = n.id;
        desenhar();
      });
      b.dataset.no = String(n.id);
      b.style.left = `${x * k}px`;
      b.style.top = `${y * k}px`;
      b.setAttribute('aria-label', descricaoNo(n, sit, s.pontos));
      b.setAttribute('aria-pressed', String(escolhido === n.id));
      b.append(icone(n));
      if (sit === 'pode' || sit === 'falta') b.append(el('span', 'no-custo', `${n.custo} ★`));
      filhos.push(b);
    }
    mundo.replaceChildren(...filhos);
    if (focado) mundo.querySelector<HTMLElement>(`[data-no="${focado}"]`)?.focus();
    posicionar();
    pontosTopo.textContent = `★ ${s.pontos}`;
    pontosTopo.setAttribute('aria-label', `${pontos(s.pontos)} pra gastar`);
    desenharCartao(s, sits);
  }

  function fechar() {
    if (!aberta()) return;
    tela.setAttribute('hidden', '');
    volta()?.focus();
  }

  return {
    elemento: tela,
    aberta,
    abrir(s, ocup, v) {
      estado = s;
      ocupado = ocup;
      volta = v;
      escolhido = noInicial(s.bonus.arvore, s.pontos);
      desloc = { x: 0, y: 0 };
      tela.removeAttribute('hidden');
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

- [ ] **Step 4: Run tests**

Run: `cd games && npx tsc --noEmit && npx vitest run idle/arvoreTela.test.ts idle/tela.test.ts`
Expected: PASS, saída limpa. Se o happy-dom não tiver `PointerEvent` com `clientX`, troque nos testes `new PointerEvent(...)` por `new MouseEvent(...)` com o mesmo tipo (`'pointerdown'` etc.): o código só lê `clientX`/`clientY`.

- [ ] **Step 5: Commit**

```bash
cd games && npx vitest run
git add idle/icones.ts idle/arvoreTela.ts idle/arvoreTela.test.ts idle/tela.ts
git commit -m "Fellas Inc.: árvore de habilidades em tela cheia (copa) e a copa em miniatura"
```

---

### Task 5: Aba Legado nova (pontos, quadro da árvore, conquistas em grade)

**Files:**
- Modify: `games/idle/tela.ts` (`legado()` reescrita; a árvore em tela cheia no `app`; fecha a árvore quando sai do Legado)
- Test: `games/idle/tela.test.ts` (`describe('legado: ...')`)

**Interfaces:**
- Consumes (Task 4): `criarArvoreTela`, `miniArvore`, `ArvoreTela`; (Task 1) `situacaoTela`; de `legado.ts`: `grade`, `ganhouEm`, `pontos`, `TOTAL_CONQUISTAS`, `type Celula`.
- Produces (DOM): `.lista-legado` > `.legado-pontos` (`.legado-num` com `.estrela`, `.sub`, botão Vender), `.arvore-quadro` (svg `.arvore-mini`, `.meio` com `strong`, `.sub`, `button.arvore-abrir`), `.legado-cab` (`h3.legado-titulo` "Conquistas", `.sub`), `.grade-conquistas` (`button.conquista[.ganha][.oculta][aria-label][aria-pressed]`), `.conquista-detalhe` quando há uma escolhida.

- [ ] **Step 1: Rewrite the Legado tests (failing)**

Em `games/idle/tela.test.ts`, no `describe('legado: prestígio, árvore e conquistas', ...)`, substitua os testes `'card: pontos pra gastar ...'`, `'vender: o botão diz quantos pontos ...'`, `'árvore: raiz e 5 ramos ...'`, `'conquistas: N/total ...'`, `'nó e conquista mostram o ícone'`, `'sem a arte dos ícones ...'` e `'depois de vender, antes do Abrir CNPJ ...'` por:

```ts
  it('pontos: livres, na vida e recorde; sem ponto a ganhar, "Ainda não compensa" apagado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos: 3, pontos_vida: 12, vendas: 2, recorde: 1234.5 }) }));
    const topo = root.querySelector('.legado-pontos')!;
    expect(topo.querySelector('.legado-num')!.textContent).toBe('★ 3 pontos');
    expect(topo.textContent).toContain('12 na vida · recorde +F$ 1,23 mil/s · vendeu 2 vezes');
    const b = topo.querySelector('button')!;
    expect(b.textContent).toBe('Ainda não compensa');
    expect(b.disabled).toBe(true);
  });
  it('vender: o botão diz quantos pontos e abre a folha; a folha confirma ou fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }) }));
    const b = root.querySelector<HTMLButtonElement>('.legado-pontos button')!;
    expect(b.textContent).toBe('Vender · +5 ★');
    expect(b.getAttribute('aria-label')).toBe('Vender a startup e ganhar 5 pontos');
    b.click();
    expect(acoes.vender).toHaveBeenCalledWith('abrir');
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }), vendaAberta: true }));
    const folha = root.querySelector('.modal-venda')!;
    expect(folha.hasAttribute('hidden')).toBe(false);
    expect(folha.textContent).toContain('Você ganha 5 pontos pra gastar na árvore e recomeça do zero.');
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Vender')!.click();
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Deixa quieto')!.click();
    expect(acoes.vender.mock.calls.map((c) => c[0])).toEqual(['abrir', 'confirmar', 'fechar']);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 0 }), vendaAberta: true }));
    expect(root.querySelector('.modal-venda')!.hasAttribute('hidden')).toBe(true);
  });
  it('quadro da árvore: miniatura, quantos comprou e quantos dá pra comprar; Abrir mostra a árvore', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }) }));
    const quadro = root.querySelector('.arvore-quadro')!;
    expect(quadro.querySelector('svg.arvore-mini')).not.toBeNull();
    expect(quadro.textContent).toContain(`2 de ${catalogo.arvore.length} comprados · 4 dá pra comprar agora`);
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(true);
    quadro.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(false);
    root.querySelector<HTMLButtonElement>('.arvore-cartao button')!.click();
    expect(acoes.comprarNo).toHaveBeenCalledWith(21);
  });
  it('árvore aberta: redesenhar mantém aberta e o foco volta pro Abrir novo; sair do jogo fecha', () => {
    const tela = criarTela(root, acoes);
    const m = modelo({ aba: 'legado', estado: estado({ pontos: 3, bonus: { arvore: [1], conquistas: 0 } }) });
    tela.renderizar(m);
    root.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    tela.renderizar({ ...m, estado: estado({ pontos: 1, bonus: { arvore: [1, 11], conquistas: 0 } }) });
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(false);
    expect(root.querySelector('.no-arvore[data-no="11"]')!.classList.contains('comprado')).toBe(true);
    root.querySelector<HTMLButtonElement>('.arvore-topo .fechar')!.click();
    expect(document.activeElement).toBe(root.querySelector('.arvore-abrir'));
    root.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    tela.renderizar(modelo({ fase: 'sem_sessao', estado: null }));
    expect(root.querySelector('.arvore-tela')!.hasAttribute('hidden')).toBe(true);
  });
  it('conquistas: N/total; grade de ícones; tocar mostra a frase e a data, tocar de novo fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      aba: 'legado',
      estado: estado({ conquistas: [{ id: 7, em: EM }], descobertas: [102], bonus: { arvore: [], conquistas: 1 } }),
    }));
    const lista = root.querySelector('.lista-legado')!;
    expect(lista.querySelector('.legado-cab')!.textContent).toContain(`1/${catalogo.conquistas.length} · +1% de produção`);
    const cel = (inicio: string) => root.querySelector<HTMLButtonElement>(`.conquista[aria-label^="${inicio}"]`);
    expect(cel('???, não ganha')!.textContent).toBe('?');
    expect(cel('???, não ganha')!.classList.contains('oculta')).toBe(true);
    expect(cel('Aura negativa')).toBeNull();
    const ganha = cel('Estágio não remunerado em escala, ganha')!;
    expect(ganha.classList.contains('ganha')).toBe(true);
    expect(ganha.querySelector<HTMLElement>('.icone-legado')!.style.backgroundImage).not.toBe('');
    ganha.click();
    let det = root.querySelector('.conquista-detalhe')!;
    expect(det.textContent).toContain('Cem estagiários, uma cafeteira.');
    expect(det.textContent).toContain('Ganhou em 12/10/2026');
    expect(cel('Estágio não remunerado em escala, ganha')!.getAttribute('aria-pressed')).toBe('true');
    cel('Cem abas abertas, não ganha')!.click();
    det = root.querySelector('.conquista-detalhe')!;
    expect(det.textContent).toContain('Ter 100 "Você, no notebook da faculdade"');
    expect(det.textContent).not.toContain('Ganhou em');
    cel('Cem abas abertas, não ganha')!.click();
    expect(root.querySelector('.conquista-detalhe')).toBeNull();
  });
  it('sem a arte: a conquista mostra só a moldura', () => {
    const sem = vi.spyOn(ativos, 'conquista').mockReturnValue(null);
    try {
      const tela = criarTela(root, acoes);
      tela.renderizar(modelo({ aba: 'legado' }));
      expect(root.querySelector('.conquista .icone-legado')!.classList.contains('sem-arte')).toBe(true);
    } finally {
      sem.mockRestore();
    }
  });
  it('depois de vender, antes do Abrir CNPJ: o Legado aparece e a raiz dá pra comprar pela árvore', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.lista-legado')!.hasAttribute('hidden')).toBe(true); // nunca vendeu
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false, pontos: 5, pontos_vida: 5 }) }));
    expect(root.querySelector('.lista-legado')!.hasAttribute('hidden')).toBe(false);
    root.querySelector<HTMLButtonElement>('.arvore-abrir')!.click();
    const b = root.querySelector<HTMLButtonElement>('.arvore-cartao button')!;
    expect(b.textContent).toBe('Comprar · 1 ★');
    b.click();
    expect(acoes.comprarNo).toHaveBeenCalledWith(1);
  });
```

(`'aviso de conquista por cima da cena'`, `'placar: ★ N ...'` e `'caixinha: o "some em" usa o tamanho da árvore ...'` ficam como estão.)

Run: `cd games && npx vitest run idle/tela.test.ts`
Expected: FAIL (`.legado-pontos`, `.arvore-quadro` não existem).

- [ ] **Step 2: Implement in `tela.ts`**

1. Imports: troque a linha do `./legado` por

```ts
import { ganhouEm, grade, pontos, situacaoTela, textoVenda, TOTAL_CONQUISTAS, type Celula } from './legado';
```

e acrescente

```ts
import { criarArvoreTela, miniArvore } from './arvoreTela';
```

(`falta`, `RAMOS_ARVORE` e `situacao` deixam de ser usados em `tela.ts`; se o `tsc` reclamar de algum import sobrando, tire.)

2. Logo depois de `const titulo = (id: string, texto: string) => {...};`, acrescente:

```ts
  // árvore de habilidades em tela cheia (por cima de tudo, menos dos avisos)
  const arvore = criarArvoreTela((id) => a.comprarNo(id));
```

e troque `app.append(topo, empresa, painel, notice, overlay, modalE, modalC, modalV, modalP);` por `app.append(topo, empresa, painel, notice, overlay, modalE, modalC, modalV, modalP, arvore.elemento);`.

3. Substitua a função `legado(s, ocupado)` inteira por:

```ts
  /** Aba Legado: os pontos e o Vender, o quadro da árvore (Abrir leva pra tela cheia) e as conquistas em grade de
   *  ícones (tocar mostra a frase e a data). */
  function legado(s: IdleState, ocupado: boolean) {
    const topoL = el('div', 'legado-pontos');
    const meio = el('div', 'meio');
    const num = el('strong', 'legado-num');
    num.append(el('span', 'estrela', '★ '), document.createTextNode(pontos(s.pontos)));
    const vezes = s.vendas === 1 ? 'vendeu 1 vez' : `vendeu ${s.vendas} vezes`;
    meio.append(num, el('span', 'sub', `${s.pontos_vida} na vida · recorde ${formatarTaxa(s.recorde)}${s.vendas ? ` · ${vezes}` : ''}`));
    const vender = button(s.pontos_venda >= 1 ? `Vender · +${s.pontos_venda} ★` : 'Ainda não compensa', 'btn', () => a.vender('abrir'));
    if (s.pontos_venda >= 1) vender.setAttribute('aria-label', `Vender a startup e ganhar ${pontos(s.pontos_venda)}`);
    vender.disabled = s.pontos_venda < 1 || ocupado;
    topoL.append(meio, vender);

    const comprados = s.bonus.arvore.length;
    const podem = catalogo.arvore.filter((n) => situacaoTela(n, s.bonus.arvore, s.pontos) === 'pode').length;
    const quadro = el('div', 'arvore-quadro');
    const textoQ = el('div', 'meio');
    const abrirB = button('Abrir', 'btn main arvore-abrir', () =>
      arvore.abrir(s, ocupado, () => listaL.querySelector<HTMLElement>('.arvore-abrir')));
    textoQ.append(
      el('strong', undefined, 'Árvore de habilidades'),
      el('span', 'sub', `${comprados} de ${catalogo.arvore.length} comprados${podem ? ` · ${podem} dá pra comprar agora` : ''}`),
      abrirB,
    );
    quadro.append(miniArvore(s), textoQ);

    const celulas = grade(s);
    const cab = el('div', 'legado-cab');
    cab.append(el('h3', 'legado-titulo', 'Conquistas'), el('span', 'sub', `${s.conquistas.length}/${TOTAL_CONQUISTAS} · +${s.bonus.conquistas}% de produção`));
    const grid = el('div', 'grade-conquistas');
    for (const c of celulas) {
      const oculta = !c.ganhou && c.nome === '???';
      const b = button(oculta ? '?' : '', `conquista${c.ganhou ? ' ganha' : ''}${oculta ? ' oculta' : ''}`, () => {
        conquistaAberta = conquistaAberta === c.conquista.id ? null : c.conquista.id;
        if (ultimo) renderizar(ultimo);
      });
      b.setAttribute('aria-label', `${c.nome}, ${c.ganhou ? 'ganha' : 'não ganha'}`);
      b.setAttribute('aria-pressed', String(conquistaAberta === c.conquista.id));
      if (!oculta) b.append(iconeLegado(ativos.conquista(c.conquista.id)));
      grid.append(b);
    }
    listaL.append(topoL, quadro, cab, grid);
    const aberta = celulas.find((c: Celula) => c.conquista.id === conquistaAberta);
    if (aberta) {
      const det = el('div', 'conquista-detalhe');
      const texto = el('div', 'meio');
      texto.append(el('strong', undefined, aberta.nome), el('span', 'sub', aberta.texto));
      if (aberta.em) texto.append(el('span', 'sub', ganhouEm(aberta.em)));
      det.append(iconeLegado(aberta.nome === '???' ? null : ativos.conquista(aberta.conquista.id)), texto);
      listaL.append(det);
    }
  }
```

4. Em `renderizar`, logo depois de `if (s && verLegado) legado(s, m.ocupado);`, acrescente:

```ts
    // a árvore aberta acompanha o estado novo; saiu do Legado (venda, sessão caiu): fecha
    if (arvore.aberta()) {
      if (s && verLegado) arvore.renderizar(s, m.ocupado);
      else arvore.fechar();
    }
```

- [ ] **Step 3: Run tests**

Run: `cd games && npx tsc --noEmit && npx vitest run idle/tela.test.ts idle/arvoreTela.test.ts`
Expected: PASS, saída limpa.

- [ ] **Step 4: Commit**

```bash
cd games && npx vitest run
git add idle/tela.ts idle/tela.test.ts
git commit -m "Fellas Inc.: aba Legado com o quadro da árvore e as conquistas em grade de ícones"
```

---

### Task 6: Visual pixel (CSS, fonte) e ajuda do `?mock`

**Files:**
- Modify: `games/idle/index.html`
- Rewrite: `games/idle/idle.css`
- Modify: `games/dev/mockIdle.ts`

**Interfaces:**
- Consumes: as classes produzidas nas Tasks 2–5 (listas na seção "Produces" de cada uma).
- Produces: `window.__pontos(n)` no `?mock`.

- [ ] **Step 1: Fonte pixel**

Em `games/idle/index.html`, troque o `<link href="https://fonts.googleapis.com/css2?family=Golos+Text...` por:

```html
    <link href="https://fonts.googleapis.com/css2?family=Golos+Text:wght@400;500;600;700;800&family=Pixelify+Sans:wght@500;600;700&display=swap" rel="stylesheet" />
```

- [ ] **Step 2: Ajuda do `?mock`**

Em `games/dev/mockIdle.ts`: no comentário do console acrescente `__pontos(10) põe 10 pontos de prestígio livres;`, acrescente `__pontos: (n: number) => Promise<void>;` ao tipo de `w`, e no fim do arquivo:

```ts
w.__pontos = async (n) => {
  await dono('update public.idle_state set prestige_earned = prestige_spent + $2 where user_id = $1', [ME, n]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
```

- [ ] **Step 3: Reescrever `games/idle/idle.css`**

Substitua o arquivo inteiro por:

```css
/* Fellas Inc.: em cima do hud.css. Pixel art sempre ampliada por inteiro e sem borrar.
   Visual (spec 2026-10-11-fellas-inc-layout-novo): fonte pixel nos títulos, números, abas e botões; cantos de pixel
   (contorno por 4 sombras sem desfoque); botão comum com contorno, principal roxo (sem pílula dourada).
   Celular: coluna única (topo, cartão da empresa, gavetas, abas). PC (≥ 1100): empresa e bancada à esquerda, painel à
   direita. */
.idle {
  --i-painel: #1B1A22; --i-painel2: #22202B; --i-fundo2: #121118; --i-linha: #17161D; --i-borda: #34323F; --i-borda2: #4A4660;
  --i-ativo: #262431; --i-roxo: #5B3FD9; --i-roxo-c: #7D64F0; --i-roxo-e: #3D27A8; --i-roxo-borda: #8C75FF; --i-lilas: #B8A2FF;
  --i-mudo: #A8A398; --i-pixel: 'Pixelify Sans', 'Golos Text', monospace;
  background: #121212; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto auto minmax(0, 1fr);
}

/* contorno de pixel: cada elemento escolhe a cor em --c */
.idle .cartao-empresa, .idle .gaveta-caixa, .idle .gerador, .idle .melhoria, .idle .lista-placar li, .idle .contratos-topo,
.idle .carta, .idle .seg, .idle .arvore-quadro, .idle .conquista, .idle .conquista-detalhe, .idle .arvore-pontos,
.idle .arvore-cartao, .idle .bancada, .idle .painel, .idle .aba.ativa, .idle .cena {
  box-shadow: 0 -2px 0 0 var(--c, var(--i-borda)), 0 2px 0 0 var(--c, var(--i-borda)), -2px 0 0 0 var(--c, var(--i-borda)), 2px 0 0 0 var(--c, var(--i-borda));
}

/* botões: comum com contorno e chanfro; principal roxo */
.idle .btn {
  height: auto; min-height: 44px; padding: 0 14px; border: 0; border-radius: 0; background: var(--i-painel2); color: var(--paper);
  font: 600 15px var(--i-pixel); --c: var(--i-borda2);
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c), inset 0 -3px 0 #0F0E14, inset 0 2px 0 #2F2C3B;
}
.idle .btn:hover:not(:disabled) { --c: var(--i-lilas); }
.idle .btn:active:not(:disabled) { transform: translateY(1px); }
.idle .btn.main {
  background: var(--i-roxo); color: #fff; --c: var(--i-roxo-borda);
  box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c), inset 0 -3px 0 var(--i-roxo-e), inset 0 2px 0 var(--i-roxo-c);
}
.idle .btn.main:hover:not(:disabled) { --c: #fff; }
.idle .btn:disabled { opacity: 0.42; }
.idle .btn.compacto { flex: none; padding: 0 16px; font-size: 14px; }
.idle .btn:focus-visible, .idle .aba:focus-visible, .idle .fechar:focus-visible, .idle .gaveta:focus-visible, .idle .seg button:focus-visible,
.idle .conquista:focus-visible, .idle .no-arvore:focus-visible { outline: 2px solid var(--i-lilas); outline-offset: 4px; }

/* topo */
.idle .top { padding: max(10px, env(safe-area-inset-top)) 14px 6px; }
.idle .top .marca { font: 700 17px var(--i-pixel); letter-spacing: 0.02em; }
.idle .top .topo-visual { flex: none; min-height: 36px; padding: 0 12px; font-size: 14px; }

/* empresa: cena + resumo (ou o Abrir CNPJ) num cartão, e as gavetas embaixo */
.idle .empresa { display: grid; gap: 10px; width: 100%; max-width: 560px; justify-self: center; padding: 6px 14px 0; }
.idle .cartao-empresa { display: grid; justify-items: center; gap: 8px; padding: 12px 12px 10px; background: var(--i-painel); }
.idle .palco { position: relative; display: flex; justify-content: center; }
.idle .cena { width: 320px; height: 192px; image-rendering: pixelated; --c: #2B2938; }
.idle .valor { display: flex; flex-wrap: wrap; justify-content: center; align-items: baseline; column-gap: 10px; text-align: center; }
.idle .numero { font: 700 28px var(--i-pixel); color: var(--paper); text-shadow: 2px 2px 0 #000; font-variant-numeric: tabular-nums; }
.idle .taxa { font: 600 15px var(--i-pixel); color: var(--mint); }
.idle .bonus { flex-basis: 100%; color: var(--gold); font-size: 13px; }
.idle .bonus:empty { display: none; }
.idle .info { display: none; }
.idle .abrir { display: grid; justify-items: center; gap: 12px; padding: 12px 8px 4px; color: var(--paper); }
.idle .abrir p { margin: 0; font: 600 17px var(--i-pixel); }
.idle .abrir .btn { flex: none; min-width: 180px; }

/* bancada: no celular só a fileira de gavetas (a Caixinha abre a folha) */
.idle .gavetas { display: flex; gap: 8px; }
.idle .gaveta { display: grid; justify-items: center; gap: 4px; padding: 0; border: 0; background: transparent; color: var(--i-mudo); cursor: pointer; font: 500 12px var(--i-pixel); }
.idle .gaveta-caixa { position: relative; width: 52px; height: 52px; display: grid; place-items: center; background: var(--i-painel); }
.idle .gaveta-icone { width: 32px; height: 32px; background: no-repeat 0 0 / 128px 32px; image-rendering: pixelated; }
.idle .selo { position: absolute; top: -6px; right: -6px; min-width: 20px; height: 20px; padding: 0 4px; display: grid; place-items: center; font: 700 12px var(--i-pixel); color: #120F22; background: var(--gold); }
.idle .gaveta-corpo { display: none; }
.idle .bancada { box-shadow: none; }

/* oportunidade passando na cena */
.idle .vivo {
  position: absolute; top: 40%; left: 0; width: 48px; height: 48px; border: 0; padding: 0; cursor: pointer;
  background: transparent no-repeat 0 0 / 192px 48px; image-rendering: pixelated;
  animation: atravessar linear forwards, quadros4 0.6s steps(4) infinite;
}
@keyframes atravessar { from { transform: translateX(0); } to { transform: translateX(calc(100vw - 48px)); } }
@keyframes quadros4 { from { background-position-x: 0; } to { background-position-x: -192px; } }

/* painel: abas + listas (no celular rola embaixo da empresa) */
.idle .painel { overflow: auto; padding-bottom: 24px; width: 100%; max-width: 560px; justify-self: center; box-shadow: none; }
.idle .abas { display: flex; gap: 6px; padding: 12px 14px 8px; position: sticky; top: 0; z-index: 1; background: #121212; }
.idle .aba { flex: 1; min-height: 44px; padding: 0 4px; border: 0; border-radius: 0; background: transparent; color: var(--i-mudo); font: 600 15px var(--i-pixel); cursor: pointer; }
.idle .aba.ativa { color: #fff; background: var(--i-roxo); --c: var(--i-roxo-borda); }
.idle .seg-loja { margin: 4px 14px 0; }
.idle .lista { display: grid; gap: 10px; padding: 12px 14px; margin: 0; list-style: none; }

/* seletores (Geradores | Melhorias, À venda | Compradas) */
.idle .seg { display: flex; gap: 4px; padding: 3px; background: var(--i-fundo2); border: 0; border-radius: 0; }
.idle .seg button { flex: 1; min-height: 40px; border: 0; border-radius: 0; background: transparent; color: var(--i-mudo); font: 600 14px var(--i-pixel); cursor: pointer; }
.idle .seg button.ativo { background: var(--i-ativo); color: var(--paper); box-shadow: inset 0 -2px 0 var(--i-lilas); }

/* Loja */
.idle .gerador, .idle .melhoria { display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--i-linha); color: var(--paper); --c: #2A2833; }
.idle .gerador.trancado { opacity: 0.5; }
.idle .sprite { flex: none; width: 64px; height: 64px; background: no-repeat 0 0 / 256px 64px; image-rendering: pixelated; animation: quadros64 0.8s steps(4) infinite; }
@keyframes quadros64 { from { background-position-x: 0; } to { background-position-x: -256px; } }
.idle .meio { flex: 1; display: grid; gap: 2px; min-width: 0; }
.idle .meio strong { font-size: 15px; line-height: 1.25; }
.idle .sub { color: var(--i-mudo); font-size: 13px; }
/* no celular os botões de compra descem para uma linha própria; do tablet pra cima ficam ao lado do nome */
.idle .gerador { flex-wrap: wrap; }
.idle .compra { display: flex; gap: 8px; flex: 1 1 100%; }
.idle .compra .btn { flex: 1; min-width: 44px; padding: 0 10px; white-space: nowrap; }
.idle .compra .btn[data-qtd='1'] { flex: 2; }
.idle .melhoria .btn { flex: none; white-space: nowrap; }
@media (min-width: 600px) {
  .idle .gerador { flex-wrap: nowrap; }
  .idle .compra { flex: none; }
  .idle .compra .btn { flex: none; min-width: 44px; }
  .idle .compra .btn[data-qtd='1'] { min-width: 112px; }
  .idle .compra .btn[data-qtd='0'] { min-width: 76px; }
}
.idle .icone { flex: none; width: 48px; height: 48px; border: 3px solid #6B6874; background: #121212 no-repeat 0 0 / 192px 48px; image-rendering: pixelated; }
.idle .icone.geral { background-size: 42px 42px; }
.idle .icone.bronze { border-color: #C98A4B; } .idle .icone.prata { border-color: #B4B0BC; } .idle .icone.ouro { border-color: #FFD25E; }
.idle .icone.roxo { border-color: #B8A2FF; } .idle .icone.diamante { border-color: #5EC8FF; }
.idle .icone.sinergia { display: flex; }
.idle .icone .mini { flex: 1; background: no-repeat 0 0 / 84px 21px; image-rendering: pixelated; }

/* Placar */
.idle .lista-placar li { display: grid; grid-template-columns: 32px 36px 1fr auto; align-items: center; gap: 2px 8px; padding: 8px; background: var(--i-painel); color: var(--paper); }
.idle .lista-placar li.eu { --c: var(--i-lilas); }
.idle .lista-placar .pos { font: 700 15px var(--i-pixel); }
.idle .lista-placar .mini-boneco { grid-row: 1 / span 3; grid-column: 2; width: 27px; height: 39px; }
.idle .lista-placar .nome, .idle .lista-placar .sub, .idle .lista-placar .disputado { grid-column: 3; }
.idle .lista-placar .v { grid-row: 1; grid-column: 4; font: 700 15px var(--i-pixel); }
.idle .lista-placar .pontos { grid-row: 2; grid-column: 4; justify-self: end; color: var(--gold); font: 600 13px var(--i-pixel); }
.idle .vazio { color: var(--i-mudo); text-align: center; }

/* Gente (Contratar) */
.idle .mini-boneco { flex: none; width: 36px; height: 52px; image-rendering: pixelated; }
.idle .contratos-topo, .idle .carta { display: flex; align-items: center; gap: 12px; padding: 8px; background: var(--i-painel); color: var(--paper); }
.idle .contratos-topo { --c: var(--i-borda2); }
.idle .carta .btn, .idle .contratos-topo .btn { flex: none; white-space: nowrap; }
.idle .contratado { flex: none; max-width: 45%; text-align: right; font-size: 13px; color: var(--mint); }
.idle .disputado { justify-self: start; padding: 2px 8px; background: #3A2A66; color: #DDD2FF; font: 600 12px var(--i-pixel); }

/* Legado */
.idle .legado-pontos { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.idle .legado-num { font: 700 22px var(--i-pixel); }
.idle .estrela { color: var(--gold); }
.idle .legado-pontos .btn { flex: none; }
.idle .arvore-quadro { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: 14px; align-items: center; padding: 10px 14px 10px 10px; background: #15141B; --c: var(--i-borda2); }
.idle .arvore-quadro .meio strong { font: 700 17px var(--i-pixel); }
.idle .arvore-quadro .btn { flex: none; width: 100%; margin-top: 8px; }
.idle .arvore-mini { width: 150px; aspect-ratio: 400 / 540; display: block; }
.idle .arvore-mini .mini-no { fill: #15131F; stroke: #3A3654; stroke-width: 4; }
.idle .arvore-mini .mini-no.comprado { stroke: var(--gold); fill: #2A2414; }
.idle .arvore-mini .mini-no.pode { stroke: var(--i-lilas); }
.idle .arvore-mini .mini-no.falta { stroke: #8F86B8; }
.idle .arvore-mini .mini-no.trancado { stroke: #26232F; fill: #0F0E16; }
.idle .arvore-mini image { image-rendering: pixelated; }
.idle .arvore-mini .mini-icone.trancado { opacity: 0.25; }
.idle .legado-cab { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; margin-top: 4px; }
.idle .legado-titulo { margin: 0; font: 700 18px var(--i-pixel); color: var(--paper); }
.idle .grade-conquistas { display: grid; grid-template-columns: repeat(auto-fill, 38px); gap: 6px; justify-content: space-between; }
.idle .conquista { width: 38px; height: 38px; padding: 0; display: grid; place-items: center; border: 0; background: var(--i-fundo2); --c: #2A2833; color: #5B5770; font: 700 16px var(--i-pixel); cursor: pointer; }
.idle .conquista .icone-legado { width: 32px; height: 32px; background-size: 32px 32px; }
.idle .conquista:not(.ganha) .icone-legado { filter: grayscale(1) brightness(0.45); opacity: 0.6; }
.idle .conquista[aria-pressed='true'] { --c: var(--i-lilas); background: var(--i-ativo); }
.idle .conquista-detalhe { display: grid; grid-template-columns: 48px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px 12px; background: var(--i-ativo); --c: #3B3654; color: var(--paper); }
.idle .icone-legado { flex: none; width: 48px; height: 48px; background: no-repeat 0 0 / 100% 100%; image-rendering: pixelated; }
.idle .icone-legado.sem-arte { box-sizing: border-box; border: 3px solid #6B6874; }

/* árvore em tela cheia: céu da madrugada, copa no meio, cartão embaixo (do lado no PC) */
.idle .arvore-tela {
  position: fixed; inset: 0; z-index: 9; display: grid; grid-template-rows: auto minmax(0, 1fr); color: var(--paper);
  background:
    radial-gradient(1.5px 1.5px at 8% 12%, #fff 99%, transparent), radial-gradient(1.5px 1.5px at 72% 7%, #D9D0FF 99%, transparent),
    radial-gradient(1.5px 1.5px at 90% 30%, #fff 99%, transparent), radial-gradient(1.5px 1.5px at 18% 58%, #D9D0FF 99%, transparent),
    radial-gradient(1.5px 1.5px at 84% 66%, #fff 99%, transparent), radial-gradient(2px 2px at 40% 22%, #fff 99%, transparent),
    radial-gradient(ellipse 70% 45% at 50% 100%, rgba(91, 63, 217, 0.28), transparent 70%),
    linear-gradient(180deg, #0C0B17, #121022);
}
.idle .arvore-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: max(8px, env(safe-area-inset-top)) 12px 8px; }
.idle .arvore-topo h2 { margin: 0; font: 700 18px var(--i-pixel); text-align: center; }
.idle .arvore-pontos { padding: 6px 10px; font: 600 15px var(--i-pixel); color: var(--gold); background: var(--i-painel); --c: var(--i-borda2); white-space: nowrap; }
.idle .arvore-corpo { display: grid; grid-template-rows: minmax(0, 1fr) auto; min-height: 0; }
.idle .arvore-palco { position: relative; overflow: hidden; touch-action: none; cursor: grab; }
.idle .arvore-mundo { position: absolute; left: 50%; top: 50%; }
.idle .arvore-mundo svg { position: absolute; inset: 0; overflow: visible; }
.idle .ligacao { stroke: #8F86B8; stroke-width: 3; }
.idle .ligacao.comprado { stroke: var(--gold); stroke-width: 4; }
.idle .ligacao.trancado { stroke: #2C2940; stroke-dasharray: 6 5; }
.idle .arvore-mini .ligacao { stroke-width: 6; }
.idle .arvore-mini .ligacao.comprado { stroke-width: 8; }
.idle .arvore-ramo { position: absolute; transform: translate(-50%, -50%); font: 600 13px var(--i-pixel); color: #9D97B8; white-space: nowrap; pointer-events: none; }
.idle .no-arvore {
  position: absolute; width: 52px; height: 52px; margin: -26px 0 0 -26px; padding: 0; border: 0; display: grid; place-items: center;
  background: #15131F; --c: #3A3654; cursor: pointer;
  box-shadow: 0 -3px 0 0 var(--c), 0 3px 0 0 var(--c), -3px 0 0 0 var(--c), 3px 0 0 0 var(--c);
}
.idle .no-arvore .icone-legado { width: 48px; height: 48px; }
.idle .no-arvore.comprado { --c: var(--gold); background: #2A2414; }
.idle .no-arvore.pode { --c: var(--i-lilas); animation: no-pulsa 1.6s ease-in-out infinite; }
.idle .no-arvore.falta { --c: #8F86B8; }
.idle .no-arvore.trancado { --c: #26232F; background: #0F0E16; }
.idle .no-arvore.trancado .icone-legado { filter: grayscale(1) brightness(0.35); }
.idle .no-arvore.escolhido::after { content: ''; position: absolute; inset: -7px; pointer-events: none; box-shadow: 0 -2px 0 0 #fff, 0 2px 0 0 #fff, -2px 0 0 0 #fff, 2px 0 0 0 #fff; }
@keyframes no-pulsa { 50% { filter: drop-shadow(0 0 8px rgba(184, 162, 255, 0.65)); } }
.idle .no-custo { position: absolute; top: 100%; left: 50%; transform: translate(-50%, 5px); font: 600 12px var(--i-pixel); color: var(--gold); white-space: nowrap; text-shadow: 1px 1px 0 #000; pointer-events: none; }
.idle .arvore-lado { padding: 0 12px max(14px, env(safe-area-inset-bottom)); }
.idle .arvore-legenda { display: none; margin: 0; padding: 0; list-style: none; flex-wrap: wrap; gap: 8px 16px; font-size: 13px; color: #B6B0CC; }
.idle .arvore-legenda i { display: inline-block; width: 12px; height: 12px; margin-right: 6px; vertical-align: -1px; background: #15131F; box-shadow: 0 0 0 2px var(--c); }
.idle .arvore-legenda .comprado i { --c: var(--gold); } .idle .arvore-legenda .pode i { --c: var(--i-lilas); }
.idle .arvore-legenda .falta i { --c: #8F86B8; } .idle .arvore-legenda .trancado i { --c: #26232F; }
.idle .arvore-cartao { display: grid; grid-template-columns: 56px minmax(0, 1fr); gap: 6px 12px; align-items: start; min-height: 132px; padding: 14px; background: var(--i-painel); --c: var(--i-borda2); }
.idle .arvore-cartao > .icone-legado { width: 56px; height: 56px; background-size: 48px 48px; background-position: center; background-color: #15131F; }
.idle .arvore-cartao strong { font: 700 17px var(--i-pixel); }
.idle .arvore-cartao .onde { font-size: 13px; color: var(--i-lilas); }
.idle .arvore-cartao p { margin: 4px 0 0; font-size: 15px; line-height: 1.4; }
.idle .arvore-acao { grid-column: 1 / -1; }
.idle .arvore-acao .btn { width: 100%; min-height: 44px; font-size: 16px; }
.idle .no-feito { color: var(--mint); font: 600 15px var(--i-pixel); }

/* modais: folha que sobe de baixo no celular; janela no meio do PC */
.idle .modal { position: fixed; inset: 0; display: flex; align-items: flex-end; justify-content: center; background: rgba(11, 10, 14, 0.72); color: var(--paper); z-index: 10; }
.idle .folha { width: 100%; max-height: 85dvh; overflow: auto; display: grid; gap: 4px; padding: 16px 16px max(16px, env(safe-area-inset-bottom)); background: var(--i-painel); box-shadow: 0 -2px 0 0 var(--i-borda2), 0 -8px 24px rgba(0, 0, 0, 0.4); }
@media (min-width: 600px) {
  .idle .modal { align-items: center; padding: 24px; }
  .idle .folha { width: min(460px, 100%); padding: 20px; box-shadow: 0 -2px 0 0 var(--i-borda2), 0 2px 0 0 var(--i-borda2), -2px 0 0 0 var(--i-borda2), 2px 0 0 0 var(--i-borda2), 0 12px 32px rgba(0, 0, 0, 0.5); }
}
.idle .folha-topo { display: flex; align-items: center; justify-content: space-between; gap: 8px; min-height: 44px; }
.idle .folha h2 { margin: 0; font: 700 19px/1.2 var(--i-pixel); }
.idle .folha > .sub { margin: 0 0 8px; }
.idle .fechar { flex: none; width: 44px; height: 44px; margin-right: -10px; display: grid; place-items: center; border: 0; border-radius: 0; background: transparent; color: var(--paper); cursor: pointer; }
.idle .fechar:hover { background: var(--i-ativo); }
.idle .arvore-topo .fechar { margin: 0; }
.idle .escolhas { list-style: none; margin: 0; padding: 0; }
.idle .escolha { display: flex; align-items: center; gap: 12px; padding: 12px 0; border-top: 1px solid #2A2833; }
.idle .escolha.off { opacity: 0.5; }
.idle .escolha-texto { flex: 1; min-width: 0; display: grid; gap: 2px; }
.idle .escolha-texto strong { font-size: 15px; line-height: 1.3; }
.idle .prazo { font-variant-numeric: tabular-nums; }
.idle .em-breve { flex: none; max-width: 40%; text-align: right; font-size: 12px; color: var(--i-mudo); }
.idle .boneco { flex: none; width: 48px; height: 48px; background: no-repeat 0 0 / 192px 48px; image-rendering: pixelated; animation: quadros4 0.6s steps(4) infinite; }
/* o aviso fica por cima dos modais e da árvore: erro ao pegar ou comprar precisa aparecer */
.idle .notice { position: fixed; z-index: 11; }

/* editor de personagem */
.idle .previa { display: flex; justify-content: center; align-items: flex-end; gap: 24px; padding: 8px 0 12px; }
.idle .previa .mini-boneco:first-child { width: 54px; height: 78px; }
.idle .previa .mini-boneco:last-child { width: 72px; height: 90px; }
.idle .opcoes { display: grid; gap: 6px; padding: 8px 0; border-top: 1px solid #2A2833; }
.idle .opcoes-rotulo { font: 600 13px var(--i-pixel); color: var(--i-mudo); }
.idle .opcoes-botoes { display: flex; flex-wrap: wrap; gap: 8px; }
.idle .chip { min-height: 44px; padding: 0 12px; border: 0; border-radius: 0; background: var(--i-fundo2); color: var(--paper); font: 600 14px var(--i-pixel); cursor: pointer; box-shadow: 0 0 0 2px var(--i-borda); }
.idle .cor { width: 44px; height: 44px; border: 0; border-radius: 0; cursor: pointer; box-shadow: 0 0 0 2px var(--i-borda); }
.idle .chip[aria-pressed='true'] { background: #3A2A66; box-shadow: 0 0 0 2px var(--i-lilas); }
.idle .cor[aria-pressed='true'] { box-shadow: 0 0 0 2px #121212, 0 0 0 4px var(--i-lilas); }
.idle .chip:focus-visible, .idle .cor:focus-visible { outline: 2px solid var(--i-lilas); outline-offset: 4px; }
.idle .editor-fim { display: flex; gap: 12px; justify-content: flex-end; padding-top: 12px; }

/* aviso de conquista: por cima da cena, 3 s (main.ts) */
.idle .conquista-aviso { position: absolute; top: 12px; left: 50%; transform: translateX(-50%); z-index: 2; max-width: calc(100% - 24px); padding: 8px 14px; background: #3A2A66; color: #DDD2FF; font: 600 14px var(--i-pixel); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; animation: conquista-entra 0.25s ease-out; box-shadow: 0 -2px 0 0 var(--i-lilas), 0 2px 0 0 var(--i-lilas), -2px 0 0 0 var(--i-lilas), 2px 0 0 0 var(--i-lilas); }
@keyframes conquista-entra { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }

/* barras de rolagem finas e escuras */
.idle, .idle * { scrollbar-width: thin; scrollbar-color: #3A3846 transparent; }
.idle ::-webkit-scrollbar { width: 8px; height: 8px; }
.idle ::-webkit-scrollbar-track { background: transparent; }
.idle ::-webkit-scrollbar-thumb { background: #3A3846; border: 2px solid #121212; }
.idle ::-webkit-scrollbar-thumb:hover { background: #4E4B5C; }

/* PC: empresa e bancada à esquerda, painel de 500 à direita; tudo cabe numa tela de 1280 × 800 */
@media (min-width: 1100px) {
  .idle { grid-template-columns: minmax(0, 1fr) 500px; grid-template-rows: 64px minmax(0, 1fr); column-gap: 32px; padding: 0 32px 32px; }
  .idle .top { grid-column: 1 / -1; padding: 0; }
  .idle .empresa { grid-column: 1; grid-row: 2; max-width: none; padding: 24px 0 0; grid-template-rows: auto minmax(0, 1fr); gap: 20px; min-height: 0; }
  .idle .cartao-empresa { grid-template-columns: 480px minmax(0, 1fr); justify-items: stretch; gap: 24px; padding: 0; background: none; box-shadow: none; }
  .idle .cena { width: 480px; height: 288px; box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c), 0 18px 40px -12px rgba(91, 63, 217, 0.35); }
  .idle .valor { flex-direction: column; flex-wrap: nowrap; align-items: flex-start; justify-content: flex-start; gap: 6px; text-align: left; min-width: 0; }
  .idle .numero { font-size: 36px; white-space: nowrap; }
  .idle .taxa { font-size: 17px; }
  .idle .bonus { flex-basis: auto; }
  .idle .info { display: flex; flex-direction: column; gap: 4px; margin-top: auto; font-size: 14px; color: var(--i-mudo); }
  .idle .abrir { justify-items: start; align-content: center; padding: 0; }
  .idle .abrir p { font-size: 22px; }
  .idle .bancada { display: flex; flex-direction: column; min-height: 0; background: var(--i-painel); --c: var(--i-borda); box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
  .idle .gavetas { padding: 12px 12px 0; }
  .idle .gaveta { display: flex; align-items: center; gap: 8px; height: 44px; padding: 0 12px 0 6px; font: 600 15px var(--i-pixel); }
  .idle .gaveta[aria-pressed='true'] { color: #fff; background: var(--i-ativo); box-shadow: inset 0 -3px 0 var(--i-lilas); }
  .idle .gaveta-caixa { width: 32px; height: 32px; background: none; box-shadow: none; }
  .idle .gaveta .selo { position: static; order: 3; }
  .idle .gaveta-caixa .selo { display: none; }
  .idle .gaveta-corpo { display: block; flex: 1; min-height: 0; overflow: auto; padding: 4px 14px 14px; }
  .idle .painel { grid-column: 2; grid-row: 2; margin-top: 24px; max-width: none; min-height: 0; background: var(--i-painel); --c: var(--i-borda); box-shadow: 0 -2px 0 0 var(--c), 0 2px 0 0 var(--c), -2px 0 0 0 var(--c), 2px 0 0 0 var(--c); }
  .idle .abas { padding: 14px 14px 8px; background: var(--i-painel); }
  .idle .arvore-quadro { grid-template-columns: 200px minmax(0, 1fr); }
  .idle .arvore-mini { width: 200px; }
  .idle .grade-conquistas { grid-template-columns: repeat(auto-fill, 40px); gap: 8px; }
  .idle .conquista { width: 40px; height: 40px; }
  .idle.sem-painel { grid-template-columns: minmax(0, 1fr); }
  .idle.sem-painel .painel { display: none; }
  .idle.sem-painel .empresa { max-width: 1000px; justify-self: center; width: 100%; }
  .idle .arvore-corpo { grid-template-columns: minmax(0, 1fr) 360px; grid-template-rows: minmax(0, 1fr); }
  .idle .arvore-lado { align-self: end; display: grid; gap: 14px; padding: 0 24px 24px 0; }
  .idle .arvore-legenda { display: flex; }
}

@media (prefers-reduced-motion: reduce) {
  .idle .sprite, .idle .vivo, .idle .boneco, .idle .conquista-aviso { animation: none; }
  .idle .no-arvore.pode { animation: none; filter: drop-shadow(0 0 8px rgba(184, 162, 255, 0.65)); }
  .idle .btn:active:not(:disabled) { transform: none; }
}
```

Nota sobre a gaveta no PC: o selo dentro de `.gaveta-caixa` some no PC (`.gaveta-caixa .selo { display: none }`); o número continua no `aria-label` da gaveta e a lista está aberta logo embaixo.

- [ ] **Step 4: Build e suíte**

Run: `cd games && npx tsc --noEmit && npx vitest run && npx vite build`
Expected: tudo passando, build ok, sem aviso novo. Rode também a raiz: `npx tsc --noEmit` e `npm test` (na pasta do repositório).

- [ ] **Step 5: Commit**

```bash
git add games/idle/index.html games/idle/idle.css games/dev/mockIdle.ts
git commit -m "Fellas Inc.: visual pixel (fonte, cantos de pixel, botões roxos), PC em dois lados e a árvore em tela cheia"
```

- [ ] **Step 6: Conferência visual (controlador, no navegador)**

`cd games && npx vite --port 5199` e abrir `http://localhost:5199/games/idle/?mock`. No console: abrir o CNPJ, `__vendavel()`, `__pontos(10)`. Conferir em 390 × 844, 1280 × 800 e 1920 × 1080:
- Loja (Geradores e Melhorias), Gente, Placar, Legado;
- gaveta Caixinha (celular abre a folha; PC lista na bancada e Pegar funciona);
- Abrir a árvore, escolher nós, comprar um, Esc fecha; no celular deitado (844 × 390) arrastar a copa;
- conquistas: tocar mostra o detalhe;
- fase "antes" depois de vender (PC: painel só com o Legado);
- nada estourando a largura, textos sem cortar, foco visível no teclado.
Corrigir o que aparecer num commit `Fellas Inc.: ajustes da conferência visual do layout novo`.
