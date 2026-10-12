# Fellas Inc.: Mapa do rolê, parte 2 (lugar 3, a camisetaria) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mecânica do lugar 3 (a camisetaria): montar uma coleção (tema, estilo, peça, cor, foco, lote, nome), 4
influencers dão nota no estilo Game Dev Tycoon, a procura em % vai pro pódio, a venda roda sozinha 12 h e rende cupom,
caderninho, relatório, desafios da semana, 3 conquistas e a arte com cara de rua.

**Architecture:** Encaixa na moldura da parte 1 (branch `mapa-do-role`): troca só os stubs `idle_tee_*` e preenche
`MECANICAS[3]`. Os resultados de uma coleção são calculados **no lançamento** (determinísticos, guardados na linha) e
**mostrados** quando ela fica pronta; o que dá conquista/pódio/caderninho/desafio roda num gancho novo da moldura,
`idle_place_depois`, que roda **depois** de fechar a conta e salvar. Contas puras em `games/idle/camisetaria.ts` com
paridade exata com o SQL (`0058`).

**Tech Stack:** Postgres/Supabase (plpgsql), PGlite, TypeScript + DOM, vitest (happy-dom), Node (gerador de arte fora do repo).

**Spec:** `docs/superpowers/specs/2026-10-12-fellas-inc-mapa-do-role-design.md` §4 (camisetaria), §3 (moldura), §7, §9.
O contrato da moldura está no topo de `games/idle/mecanicas.ts` e no bloco "o contrato das partes 2 a 4" da 0057.

## Global Constraints

- Tudo no worktree `../fellasapp-mapa`, branch `mapa-do-role`. **Sem merge, push ou `db push`** (o Juan testa o lote
  antes de publicar).
- Privacidade: nada de nome real de lugar. Os nomes dos influencers abaixo são do Juan e podem ir pro repo.
- Migrações: a 0056 (catálogo) e a 0057 (moldura) **ainda não foram aplicadas**: a 0056 é **regerada no mesmo nome** com
  as conquistas novas (`ATUALIZAR_CATALOGO=0056_fellas_inc_catalogo_mapa.sql`) e a 0057 recebe o gancho `idle_place_depois`
  no lugar. A lógica da camisetaria vai numa nova `0058_fellas_inc_camisetaria.sql` (em `db.ts` e `mockDb.ts` depois da 0057).
- Inteiros onde dá: a nota é calculada em décimos inteiros (`total10`) e arredondada com `floor((total10 + 5) / 10)` nos
  dois lados; paridade TS × SQL exata para notas e rótulos; procura/% com erro relativo < 1e-9.
- Uma coleção por vez (em produção ou à venda). Produção 1 h / 2 h / 4 h (lote pequeno/médio/grande). Venda 12 h a partir
  de pronta. Sexta e sábado das 18h às 2h (America/Sao_Paulo, UTC−3 fixo) a venda pesa 2×.
- Marcos e conquistas nunca dentro de `idle_tee_avancar`; só no `idle_tee_depois` (depois de salvar).
- Caixinha de informação (mouse/teclado, nunca no celular): em cada tema/estilo/peça/cor (o que o caderninho já sabe;
  nunca testado = "Ainda não testou"), no foco (o ideal se tem relatório), no lote (peças, custo, tempo), no relatório.
  Não entra no resultado nem no pódio.
- Texto no tom do `PRODUCT.md` (humor ácido permitido, sem fato falso sobre pessoa real). Commits sem coautoria.
- Suíte dos jogos `npx vitest run --maxWorkers=4`; `npx tsc --noEmit` (games e raiz); `npm test` na raiz.

## Review Focus

1. Coleção lançada e a pessoa some 3 dias: a venda termina sozinha em 12 h, o cupom entra uma vez só, os fãs do excesso
   entram uma vez só, a revelação/pódio/caderninho acontecem na próxima visita com `criado_em` = hora em que ficou pronta.
2. Venda atravessando sexta 18h e sábado 2h: o total vendido no fim é exatamente `min(procura, estoque)` e o meio da venda
   segue o peso 2× (paridade TS × SQL de `vendidoAte`).
3. Encerrar antes: para a venda na hora, devolve 50% do custo do estoque que sobrou, e não entra mais nada depois.
4. Opção trancada pelo nível, foco que não soma 10, lote fora de 0..2, nome inválido, sem cupom, coleção ativa: cada um com
   o erro certo e nada gravado.
5. Repetição: mesmo tema e estilo de uma das 3 últimas derruba 2; só o tema ou só o estilo da última, 1.

---

### Task 1: `camisetaria.ts` (catálogo e regras puras)

**Files:** Create `games/idle/camisetaria.ts`, `games/idle/camisetaria.test.ts`

**Produces:**

```ts
export type Vibe = 'zoeira' | 'raiz' | 'fofo' | 'sombrio' | 'retro' | 'esporte' | 'nerd' | 'praia' | 'chique' | 'bruto' | 'urbano' | 'grana';
export type Tema = { id: number; nome: string; vibes: readonly Vibe[]; nivel: number };
export type Estilo = { id: number; nome: string; vibes: readonly Vibe[]; foco: readonly [number, number, number]; nivel: number };
export type Peca = { id: number; nome: string; custo: number; mult: number; gosta: readonly Vibe[]; odeia: readonly Vibe[]; nivel: number };
export type Cor = { id: number; nome: string; hex: string; forte: boolean; nivel: number };
export type Influencer = { id: number; nome: string; gosto: string };
export const TEMAS: readonly Tema[]; export const ESTILOS: readonly Estilo[]; export const PECAS: readonly Peca[];
export const CORES: readonly Cor[]; export const INFLUENCERS: readonly Influencer[];
export const CONFLITOS: readonly (readonly [Vibe, Vibe])[];
export const LIBERA: Readonly<Record<number, readonly string[]>>; // nível 2..25 → ['tema:7', 'estilo:4'] (o que libera ao chegar)
export type Rotulo = 0 | 1 | 2 | 3 | 4; // péssima, ruim, ok, boa, ótima
export const NOME_ROTULO: readonly string[]; // ['Combinação péssima', 'Combinação ruim', 'Combinação ok', 'Combinação boa', 'Combinação ótima!']
export function liberado(tipo: 'tema' | 'estilo' | 'peca' | 'cor', id: number, nivel: number): boolean;
export function rotulo(tema: number, estilo: number): Rotulo;
export function pecaTema(peca: number, tema: number): -1 | 0 | 1;
export function distanciaFoco(estilo: number, foco: readonly [number, number, number]): number; // (|Δa|+|Δt|+|Δd|)/2, inteiro
export type Lancamento = { id: number; tema: number; estilo: number; peca: number; cor: number; foco: readonly [number, number, number]; lote: 0 | 1 | 2; nivel: number; fas: number; tendencia: number; ultimas: readonly { tema: number; estilo: number }[] };
export function notas(l: Lancamento): [number, number, number, number]; // inteiras 1..10, ordem dos INFLUENCERS
export function pecasLote(nivel: number, lote: 0 | 1 | 2): number;
export function publico(nivel: number): number;
export function procura(l: Lancamento, ns: readonly number[]): number;
export function pctProcura(l: Lancamento, ns: readonly number[]): number; // procura ÷ pecasLote(nivel, 1) × 100
export function custoLote(peca: number, nivel: number, lote: 0 | 1 | 2): number; // custo × peças
export function precoPeca(peca: number): number; // custo × PRECO_MULT
export function producaoMs(lote: 0 | 1 | 2): number; // 1 h, 2 h, 4 h
export const VENDA_MS: number; // 12 h
export function pesoVenda(aMs: number, bMs: number): number; // integral do peso (1, ou 2 nas janelas de show) em ms
export function vendidoAte(total: number, prontaMs: number, tMs: number): number; // total × peso(pronta, t)/peso(pronta, pronta+12h), t limitado
export function tendencia(semana: string): number; // id do tema em alta: 1 + semanaIdx(3, 1, 30, semana)
export function nomeSugerido(tema: number, estilo: number, n: number): string; // ≤ 30 caracteres
export function precoRelatorio(nivel: number): number; // 50 × 1,55^(nivel−1)
export const PUBLICO_BASE: number; export const CRESCE: number; export const PRECO_MULT: number; // ajustados na Task 2
```

Conteúdo (copiar exatamente; nível = nível do lugar em que libera):

Temas (id, nome, vibes): 1 Meme [zoeira, nerd] · 2 Praia [praia, raiz] · 3 Futebol de várzea [esporte, raiz, bruto] ·
4 Forró [raiz, retro] · 5 Gato [fofo, zoeira] · 6 Café [chique, urbano] · 7 Signo [chique, fofo] · 8 Anime [nerd, fofo] ·
9 Crise financeira [grana, zoeira, sombrio] · 10 Cuscuz [raiz, zoeira] · 11 Cachorro caramelo [fofo, raiz] ·
12 Carro rebaixado [bruto, urbano, zoeira] · 13 Boleto [grana, sombrio] · 14 Academia [esporte, bruto] ·
15 Caveira [sombrio, bruto] · 16 Skate [urbano, esporte] · 17 Jacaré [praia, bruto] · 18 Coach quântico [grana, zoeira] ·
19 Pix [grana, urbano] · 20 Ressaca [zoeira, sombrio] · 21 Game [nerd, retro] · 22 Tubarão [praia, sombrio] ·
23 Caju [raiz, praia] · 24 Astronauta [nerd, retro] · 25 Dinossauro [retro, fofo] · 26 Pagode [raiz, zoeira] ·
27 Flor [fofo, chique] · 28 Jampa raiz [raiz, praia, urbano] · 29 Crush [fofo, zoeira] · 30 Rock [sombrio, retro, bruto].

Estilos (id, nome, vibes, foco ideal [arte, tecido, divulgação]): 1 Minimalista [chique, urbano] [3,5,2] ·
2 Rabisco de caneta [zoeira, nerd] [6,1,3] · 3 Pixel [nerd, retro] [6,2,2] · 4 Grafite [urbano, bruto] [5,2,3] ·
5 Vintage desbotado [retro, raiz] [3,5,2] · 6 Estêncil [urbano, sombrio] [5,3,2] · 7 Tie-dye [praia, fofo] [2,6,2] ·
8 Xilogravura de cordel [raiz, retro, zoeira] [6,3,1] · 9 Neon [urbano, zoeira] [4,1,5] · 10 Bordado [fofo, raiz, chique] [2,7,1] ·
11 Pop art [zoeira, retro] [5,1,4] · 12 Colagem [zoeira, urbano] [4,2,4] · 13 Aquarela [fofo, praia, chique] [6,3,1] ·
14 Gótico [sombrio, bruto] [4,4,2] · 15 Y2K [retro, fofo, zoeira] [3,2,5].

Peças (id, nome, custo, mult, gosta, odeia): 1 Camiseta 3, 1.0, [zoeira], [] · 2 Ecobag 2, 0.8, [fofo, chique, raiz],
[bruto, esporte] · 3 Regata 3, 0.9, [praia, esporte], [chique, sombrio] · 4 Boné 4, 0.7, [esporte, urbano, raiz], [fofo] ·
5 Cropped 3, 0.8, [fofo, chique, zoeira], [bruto, esporte] · 6 Moletom 6, 0.5, [sombrio, nerd], [todas as outras 10 vibes].

Cores (id, nome, hex, forte): 1 Preto #1B1B1F · 2 Branco #F4F1EA · 3 Amarelo #F2C230 forte · 4 Cinza mescla #8D8F93 ·
5 Off-white #E8E0CC · 6 Vermelho #D23A3A forte · 7 Verde-bandeira #1F8A4C · 8 Azul-marinho #23315A · 9 Rosa #E98BB3 forte ·
10 Laranja #EE7A2D forte · 11 Roxo #7A4FC4 forte · 12 Verde-limão #A6D93A forte.

Influencers (ordem das notas): 1 `@hojetemjp` (página de moda: +1 se o tema é a tendência da semana) · 2 `@SuperMauro64`
(+1 se o estilo é Vintage desbotado ou Bordado **ou** a cor é forte; no máximo +1) · 3 `@mcresenha` (só usa camisa de time:
+2 no Futebol de várzea, −1 no resto) · 4 `@luisviton` (o crítico chato: −1 sempre; +1 no total quando a combinação é ótima
**e** a distância do foco ≤ 1).

Conflitos: [fofo, sombrio], [fofo, bruto], [chique, bruto], [chique, zoeira], [nerd, esporte], [praia, sombrio].

Começo (nível 1): temas 1–6, estilos 1–3, peças 1–2, cores 1–4. `LIBERA` (nível → o que chega):
2 tema 7, estilo 4 · 3 tema 8, cor 5 · 4 tema 9, peça 3 · 5 tema 10, estilo 5 · 6 tema 11, cor 6 · 7 tema 12, estilo 6 ·
8 tema 13, peça 4 · 9 tema 14, cor 7 · 10 tema 15, estilo 7 · 11 tema 16, estilo 8 · 12 tema 17, cor 8 · 13 tema 18, peça 5 ·
14 tema 19, estilo 9 · 15 tema 20, cor 9 · 16 tema 21, estilo 10 · 17 tema 22, cor 10 · 18 tema 23, estilo 11 ·
19 tema 24, peça 6 · 20 tema 25, estilo 12 · 21 tema 26, cor 11 · 22 tema 27, estilo 13 · 23 tema 28, cor 12 ·
24 tema 29, estilo 14 · 25 tema 30, estilo 15. (O `nivel` de cada item sai daqui.)

Regras:
- `rotulo(t, e)`: `s = 2·|vibes em comum| − 2·|pares de conflito entre as vibes do tema e as do estilo| + v`, com
  `v = ((t·31 + e·17) mod 3) − 1`. ótima (4) se `s ≥ 3`; boa (3) se `s = 2`; ok (2) se `s ∈ {0, 1}`; ruim (1) se
  `s ∈ {−2, −1}`; péssima (0) se `s ≤ −3`.
- `pecaTema(p, t)`: +1 se alguma vibe do tema está em `gosta`; senão −1 se alguma está em `odeia`; senão 0.
- `notas(l)`, em décimos inteiros: `base10 = [25, 40, 60, 75, 90][rotulo] + 10·pecaTema − 3·distanciaFoco + rep10 + (tema = tendência ? 10 : 0)`;
  `rep10 = −20` se (tema, estilo) igual a uma das 3 últimas; senão `−10` se o tema **ou** o estilo for igual ao da última;
  senão 0. Para cada influencer i (1..4): `total10 = base10 + 10·gosto_i + sorte10_i`, `sorte10_i = ((l.id·7919 + i·104729) mod 11) − 5`;
  `nota_i = min(10, max(1, floor((total10 + 5) / 10)))`.
- `pecasLote(n, lote) = round(12 · CRESCE^(n−1)) · [1, 3, 7][lote]`; `publico(n) = PUBLICO_BASE · CRESCE^(n−1)`.
- `procura = publico(nivel) · (média/10)² · (1 + √fas / 30) · peça.mult`, média = soma/4.
- `pesoVenda`: peso 2 em [sexta 18h, sábado 2h) e [sábado 18h, domingo 2h) de Brasília (UTC−3), 1 no resto.
- `nomeSugerido(t, e, n)`: `${PREFIXO[k1]} ${tema.nome}${SUFIXO[k2]}` com `PREFIXO = ['Drop', 'Coleção', 'Linha', 'Edição']`,
  `SUFIXO = ['', ' Vol. 2', ' Raiz', ' do Caos', ' Premium', ' que Ninguém Pediu']`, `k1 = (t + n) mod 4`,
  `k2 = (e + 2n) mod 6`; se passar de 30, cai pro sem sufixo; se ainda passar, só o tema.

- [ ] Testes (escrever antes): contagens (30/15/6/12/4); `LIBERA` cobre 48 itens sem repetir, cada id fora do começo
  aparece uma vez; `rotulo(15, 14)` = 4 (Caveira + Gótico), `rotulo(5, 14)` = 0 (Gato + Gótico), `rotulo(10, 8)` = 4
  (Cuscuz + Xilogravura); `pecaTema(6, 15)` = 1 (moletom de caveira), `pecaTema(6, 2)` = −1; `distanciaFoco(1, [3,5,2])` = 0,
  `(1, [10,0,0])` = 7; um `notas` com valores calculados à mão (escrever o caso no teste com a conta no comentário);
  repetição −2/−1; tendência +1; `@luisviton` +1 só com ótima e foco ≤ 1; `vendidoAte` em 0, metade e fim = total, e uma
  venda que atravessa sexta 18h vende mais na janela; `nomeSugerido` ≤ 30 sempre (todos os temas × estilos × n de 0 a 5).
- [ ] Implementar; passar; commit `Fellas Inc.: camisetaria.ts (temas, estilos, peças, cores e as contas da camisetaria)`.

### Task 2: balanceamento (simulação)

**Files:** Create `games/idle/camisetariaSim.test.ts`; Modify `games/idle/camisetaria.ts` (só as constantes).

Simulação pura (sem banco): uma pessoa que visita 3× por dia (9h, 14h, 21h de Brasília), lança assim que a anterior
acabou, sobe de nível sempre que dá, guarda cupom pro próximo lote médio. Duas estratégias: **no chute** (combinação
aleatória entre as liberadas, foco 4/3/3) e **com caderninho** (lembra os rótulos e focos que viu; repete a melhor
combinação conhecida sem repetir as 3 últimas; compra relatório quando sobra).

Metas (spec §9), ajustando `PUBLICO_BASE`, `CRESCE` e `PRECO_MULT` (começar em 75, 1.55 e 2.5):
- nível 10 entre 5 e 9 dias; nível 25 entre 35 e 49 dias (com caderninho);
- nota média no chute entre 5 e 6; com caderninho ≥ 8 depois de 14 dias.

- [ ] Escrever a simulação com sementes fixas e as metas como `expect`; ajustar só as 3 constantes até passar; anotar os
  valores escolhidos no comentário das constantes; commit `Fellas Inc.: camisetaria balanceada (simulação)`.

### Task 3: gancho `idle_place_depois` na 0057 e conquistas na 0056

**Files:** Modify `supabase/migrations/0057_fellas_inc_mapa.sql`, `games/idle/mecanicas.ts` (comentário do contrato),
`games/test/idleMapa.test.ts`; Modify `games/idle/nomes.ts`; regerar `supabase/migrations/0056_fellas_inc_catalogo_mapa.sql`;
ícones `games/idle/assets/conquistas/conquista-087.png`, `-088.png`, `-114.png` (provisórios: cópias de um existente,
trocados na Task 6).

0057 (no lugar, ainda não aplicada):
- stubs `idle_tee_depois(s idle_state) returns idle_state`, `idle_cup_depois`, `idle_din_depois` (devolvem `s`);
- `idle_place_depois(s) returns idle_state`: para cada lugar aberto de `s.user_id` chama o stub dele;
- `idle_place_responder(s idle_state, p_lugar int) returns jsonb` (para as RPCs das mecânicas): `s := idle_place_depois(s);
  perform idle_save(s); v := idle_place_marcos_todos(s.user_id); return idle_json(s) || {'lugar': idle_lugar_json(s, p_lugar), 'marcos_novos': v}`;
- `idle_lugar` e `idle_mapa` (caminho com empresa): depois do `idle_save(s)`: `s := idle_place_depois(s); perform idle_save(s);`
  e só então `idle_place_marcos_todos`;
- revogar tudo de `public, anon, authenticated`; atualizar o bloco do contrato (0057 e `mecanicas.ts`): "o que precisa da
  conta fechada (registrar, caderninho, desafio, conquistas) vai no `idle_<x>_depois`, que devolve o `s` (o prêmio de desafio
  mexe no valuation)".

Conquistas (em `nomes.ts`, regerar a 0056 no mesmo nome):
`{ id: 87, tipo: 'tee_pct', valor: 200, nome: 'Esgotou', frase: 'Esgotou. O fornecedor já subiu o preço.', condicao: 'Coleção com 200% de procura' }`,
`{ id: 88, tipo: 'tee_quatro_dez', nome: 'Quatro dez', frase: 'Até o @luisviton deu dez. Print e emoldura.', condicao: 'Coleção com nota 10 dos 4 influencers' }`,
`{ id: 114, escondida: true, tipo: 'tee_encalhe', nome: 'Coleção encalhada', frase: 'Vai virar pano de chão de luxo.', condicao: 'Coleção com menos de 20% de procura' }`.

- [ ] Testes: `idle_place_depois` chama o stub só de lugar aberto (trocar o stub num teste por um que grava algo);
  `idle_lugar` roda o depois e salva o `s` que ele devolve; catálogo/paridade de conquistas passam; commit
  `Fellas Inc.: gancho depois da conta (idle_place_depois) e as conquistas da camisetaria`.

### Task 4: 0058, parte A (catálogo, coleções, lançar, json)

**Files:** Create `supabase/migrations/0058_fellas_inc_camisetaria.sql`, `games/test/idleCamisetaria.test.ts`; Modify
`games/test/db.ts`, `games/dev/mockDb.ts`, `games/shared/errors.ts`, `games/idle/main.ts` (`RECARREGA_MAPA`).

- Catálogo escondido (revogado de `authenticated`; paridade com `camisetaria.ts` no teste): `idle_tee_cat_tema(id, nome, vibes text[], nivel)`,
  `idle_tee_cat_estilo(id, nome, vibes text[], foco int[], nivel)`, `idle_tee_cat_peca(id, nome, custo, mult, gosta text[], odeia text[], nivel)`,
  `idle_tee_cat_cor(id, nome, hex, forte, nivel)`, `idle_tee_cat_conflito(a text, b text)`, `idle_tee_const(publico_base, cresce, preco_mult)` (1 linha).
- Desafios do lugar 3 em `idle_cat_place_desafio` (ids 301–312):
  301 `tee_nota` 8 "Lança uma coleção com nota média 8 ou mais" horas 2 · 302 `tee_pct` 150 "Coleção com 150% de procura" horas 3 ·
  303 `tee_esgotou_grande` 1 "Esgota uma coleção de lote grande" legado 2 · 304 `tee_tendencia` 7 "Coleção com o tema da semana e nota 7 ou mais" horas 2 ·
  305 `tee_quatro` 8 "Os 4 influencers dão 8 ou mais" legado 3 · 306 `tee_luis` 9 "Arranca 9 ou mais do @luisviton" investidor 1 ·
  307 `tee_resenha` 10 "Faz o @mcresenha dar 10" horas 2 · 308 `tee_mauro` 10 "Faz o @SuperMauro64 dar 10" horas 2 ·
  309 `tee_otima` 1 "Acha uma combinação ótima nova" legado 2 · 310 `tee_moletom` 7 "Moletom com nota 7 ou mais (boa sorte)" legado 3 ·
  311 `tee_colecoes` 3 "Lança 3 coleções na semana" horas 3 · 312 `tee_pct` 250 "Coleção com 250% de procura" investidor 1.
- `idle_tee_colecoes(id bigint identity, user_id → idle_state, nome, tema, estilo, peca, cor, arte, tecido, div, lote smallint,
  nivel int, pecas int, custo double, tendencia int, rotulo int, peca_tema int, notas int[], media double, procura double,
  pct double, criada_em, pronta_em, fim_em, encerrada_em, vendido double default 0, fas_excesso_pago bool default false,
  revelada bool default false)`, índice (user_id, criada_em desc).
- Funções SQL espelho (mesmos nomes do TS em snake_case): `idle_tee_rotulo`, `idle_tee_peca_tema`, `idle_tee_distancia`,
  `idle_tee_notas(...) → int[]`, `idle_tee_pecas_lote`, `idle_tee_publico`, `idle_tee_procura`, `idle_tee_peso(a, b)`,
  `idle_tee_vendido_ate`, `idle_tee_tendencia(semana)`, `idle_tee_liberado(tipo, id, nivel)`.
- `idle_tee_lancar(p_tema, p_estilo, p_peca, p_cor, p_arte, p_tecido, p_div, p_lote, p_nome) → jsonb`: membro; trava + fecha +
  salva; lugar 3 aberto (`idle_lugar_fechado`); nenhuma coleção com `encerrada_em is null and now() < fim_em`
  (`idle_tee_ocupada`); tudo liberado no nível (`idle_tee_trancado`); foco 0..10 e soma 10 (`idle_tee_foco`); lote 0..2
  (`idle_bad_choice`); nome (`idle_place_nome`); cupom ≥ custo (`idle_lugar_moeda`); calcula e grava **tudo** (notas, média,
  procura, pct, rótulo, peça×tema, tendência da semana, pronta/fim); desconta o cupom; `return idle_place_responder(s, 3)`.
- `idle_tee_json(s)` (estável): `{ tendencia, lotes: [p,m,g], precos: {relatorio}, ativa: coleção ou null (notas/média/pct
  só se `now() >= pronta_em`), historico: últimas 10 reveladas {id, nome, tema, estilo, peca, cor, notas, pct}, semana: lançadas na semana }`.
- Erros novos em `errors.ts` (FROM_DB + ERROR_TEXT) e `RECARREGA_MAPA`: `idle_tee_ocupada` 'Já tem uma coleção rodando',
  `idle_tee_trancado` 'Isso ainda não liberou na camisetaria', `idle_tee_foco` 'O foco precisa somar 10', `idle_tee_sem_lancar`
  'Lança uma coleção com esse estilo antes'.

- [ ] Testes: paridade do catálogo; paridade de `notas`/`rotulo`/`pecaTema`/`procura`/`vendidoAte`/`tendencia` TS × SQL em
  200 casos com semente fixa (notas e rótulos exatos, procura com erro < 1e-9); `lancar` grava, desconta e recusa (Review
  Focus 4); json esconde as notas antes de ficar pronta. Commit `Fellas Inc.: 0058 parte A (camisetaria: catálogo, lançar)`.

### Task 5: 0058, parte B (venda, depois, encerrar, relatório)

**Files:** Modify `0058`, `idleCamisetaria.test.ts`.

- `idle_tee_avancar(s)` (troca o stub; sem marcos/conquistas): para a coleção que está à venda (pronta, não encerrada):
  `vendido_novo = vendidoAte(min(procura, pecas), pronta, min(now, fim, encerrada))`; soma `(vendido_novo − vendido) · precoPeca`
  na `moeda` do lugar 3 e grava `vendido`. Quando `now ≥ fim` e ainda não pagou o excesso: `fas += 0,5 · max(0, procura − pecas)`
  e marca `fas_excesso_pago`.
- `idle_tee_depois(s)` (troca o stub): para cada coleção pronta e não revelada, em ordem: `revelada = true`;
  `idle_place_registrar(user, 3, nome, [tema, estilo, peca, cor], pct, pronta_em, 0)`; caderninho
  `idle_place_nota(user, 3, 'combo', tema, estilo, rotulo)` e `('peca', peca, tema, peca_tema + 1)`; `volume += 1`;
  `fas += média ≥ 7 ? round(publico(nivel) · 0,1 · (média − 6)) : 0`; `lendario = true` se as 4 notas = 10;
  conquistas `idle_ganhar(user, 'tee_pct', pct)`, `'tee_quatro_dez'` (4 notas 10), `'tee_encalhe'` (pct < 20);
  desafio: chamar `idle_place_desafio(s, 3, tipo, valor)` para cada tipo com o valor da coleção (`tee_nota` média,
  `tee_pct` pct, `tee_esgotou_grande` 1 se lote 2 e procura ≥ pecas, `tee_tendencia` média se tema = tendência,
  `tee_quatro` menor nota, `tee_luis` nota 4, `tee_resenha` nota 3, `tee_mauro` nota 2, `tee_otima` 1 se rótulo 4 e a
  combinação era nova no caderninho, `tee_moletom` média se peça 6, `tee_colecoes` lançadas na semana). Devolve `s`.
- `idle_tee_encerrar() → jsonb`: trava/fecha/salva; coleção à venda; anda a venda até agora; `encerrada_em = now()`;
  devolve `0,5 · custo/pecas · (pecas − vendido)` em cupom; `idle_place_responder(s, 3)`.
- `idle_tee_relatorio(p_estilo) → jsonb`: trava/fecha/salva; já lançou esse estilo (`idle_tee_sem_lancar`); cupom ≥
  `precoRelatorio(nivel)`; `idle_place_nota(user, 3, 'foco', estilo, 0, arte·100 + tecido·10 + div)`; responder.
- Grants: as 3 RPCs (`idle_tee_lancar`, `idle_tee_encerrar`, `idle_tee_relatorio`) só para `authenticated`; o resto revogado.

- [ ] Testes (relógio parado com `vi.setSystemTime` / `now()` do PGlite como nos outros testes): Review Focus 1, 2, 3, 5;
  marcos de volume/fãs/lendário saem depois (não no avancar); conquistas 87, 88, 114; desafio pago uma vez na semana;
  relatório grava a nota de foco e cobra. Suíte inteira. Commit `Fellas Inc.: 0058 parte B (venda, revelação, caderninho, relatório)`.

### Task 6: a arte da camisetaria (estilo de rua)

**Files:** Create (fora do repo) `../fellas-inc-esbocos/camisetaria/arte.js` + prévias; Create `games/idle/camisetariaArte.json`
(pixels gerados), `games/idle/camisetariaArte.ts` (+ teste); troca os ícones 087, 088, 114.

- Estilo: contorno preto de 2 px por fora (adesivo/lambe-lambe), cores chapadas, respingo pontilhado de spray, nas cores
  da paleta do tema 3 (`temasLugar.ts`).
- 30 estampas 16×16 (uma por tema, legíveis a 3×), 6 peças 24×24 com a área da cor marcada (trocada na hora),
  4 avatares 16×16 dos influencers (inventados, sem rosto de ninguém real), fundo da bancada (parede de tijolo com grafite
  genérico), 3 ícones de conquista.
- `camisetariaArte.ts`: `estampa(tema, estilo): ImageData` aplicando o estilo por código (minimalista = 2 cores; rabisco =
  contorno tremido; pixel = mantém; grafite = contorno grosso + respingo; vintage = desbota e falha; estêncil = 1 cor com
  pontes; tie-dye = fundo em espiral; xilogravura = preto chapado com hachura; neon = brilho; bordado = pontilhado em X;
  pop art = retícula; colagem = recortes deslocados; aquarela = bordas manchadas; gótico = preto + contorno branco;
  Y2K = cromado/rosa), `pecaComCor(peca, hex)`, `foto(partes)` 48×48 = peça na cor + estampa no estilo.
- Prévia com as 30 estampas × 4 estilos e as 6 peças × 12 cores, revisada pelo menos 3 vezes olhando a imagem.
- [ ] Teste: `foto([1,1,1,1])` é um canvas 48×48 não vazio; cada estilo muda a estampa; commit
  `Fellas Inc.: arte da camisetaria (estampas, peças, estilos, influencers)`.

### Task 7: a tela da camisetaria

**Files:** Create `games/idle/camisetariaTela.ts` + teste; Modify `games/idle/mecanicas.ts` (registra `MECANICAS[3]`),
`games/idle/idle.css`, `games/idle/dica.ts` (+ teste), `games/dev/mockIdle.ts` (as 3 RPCs no mock).

- Usar a skill Impeccable (CLAUDE.md). Tudo no tema do lugar 3.
- **Bancada** (sem coleção ativa): grades de tema/estilo/peça/cor (trancados com cadeado e "Nível N"), foco com 3 contadores
  que somam 10, lote (P/M/G com peças, custo e tempo), nome com sugestão (`nomeSugerido`) e botão de sortear, prévia ao vivo
  da camiseta (`foto`), "Lançar por N cupons".
- **Produção**: contagem até ficar pronta.
- **Revelação** (uma vez por coleção): os 4 posts entrando um por um (avatar, @, nota, comentário curto pela nota e pelo
  gosto), depois "% de procura" subindo até o número e "Combinação ótima!" etc.
- **Venda**: barra vendido/estoque, cupons entrando, "Encerrar (saldão)" com confirmação dentro da tela (sem `confirm()`).
- **Caderninho** (`Mecanica.caderninho`): tabela tema × estilo com o rótulo das testadas (cores do rótulo), focos
  descobertos, e "Relatório" por estilo já lançado.
- `libera(n)`: textos de `LIBERA[n]` ("Tema: Praia", "Estilo: Grafite").
- Caixinhas conforme Global Constraints.
- Cabe sem rolar em 1280×720 e 2000×961 (o miolo do lugar); celular rola. Conferir no navegador com a música mutada.

- [ ] Testes happy-dom de cada estado; tsc; suíte; navegador; commit `Fellas Inc.: tela da camisetaria`.

### Task 8: fechamento da parte 2

- [ ] Suítes e tsc; `git log -p` sem nome real; revisão do branch; sem merge/push. Mostrar ao Juan as prévias da arte e as
  frases das 3 conquistas para aprovação (antes da publicação do lote).
