# Fellas Inc., entrega 3 (prestígio, árvore de habilidades e conquistas): plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

> **Revisão de 10/10 (depois de o Juan ler a 1ª versão):** pontos de prestígio não mexem mais na produção: são moeda
> de uma **árvore de habilidades** (raiz + 5 ramos de 5 nós), e os nós comprados é que dão os efeitos, pra sempre. A
> venda rende `floor(cbrt(r/K)) − pontos ganhos na vida`; a aba nova é **Legado** (card + árvore + conquistas); 17
> conquistas mudaram de nome. O alvo "metade do tempo" saiu da spec: agora é "voltar é mais rápido que da 1ª vez".

**Objetivo:** "Vender a startup" troca a empresa por pontos de prestígio, que se gastam numa árvore de habilidades
(26 nós: produção, recomeço, oportunidades, teto do offline e contratos); 73 conquistas (62 visíveis e 11 escondidas, de
zoeira) dão +1% cada, pra sempre; aba Legado com o card de prestígio, a árvore e a grade de conquistas; aviso de
conquista na cena; pontos ganhos na vida no placar.

**Arquitetura:** o banco continua a autoridade. A **0040** é o catálogo gerado de novo por `catalogoSql()`
(conquistas, a árvore em `idle_cat_no` e a melhoria 283 renomeada para "Filial em Portugal"). A **0041** acrescenta
colunas permanentes em `idle_state` (pontos ganhos e gastos, vendas, recorde, contadores), as tabelas `idle_conquistas`
e `idle_arvore`, os efeitos da árvore (`idle_arv`/`idle_arvore_efeitos`) dentro de cada conta que eles mexem (taxa,
contratos, teto do offline, caixinha, limite e bônus das oportunidades, preço e duração do contrato, "Abrir CNPJ"), a
conferência das conquistas dentro de `idle_save` (o último passo de toda função que muda o jogo, sempre depois de fechar
a conta), `idle_buy_node` e `idle_prestige`. Cada efeito existe igual em `economia.ts`/`oportunidades.ts`
(`efeitosArvore`, paridade). A página ganha a aba Legado, a folha de venda e o aviso de 3 s; os ícones (conquistas e
nós) são arte por código fora do repositório e a página funciona sem eles.

**Tecnologias:** Postgres/Supabase (plpgsql, RLS), Vite + TypeScript + Vitest + PGlite (`games/`), Jest (travas das
migrações no app), Node (script da arte em `../fellas-inc-esbocos`).

**Spec:** `docs/superpowers/specs/2026-10-10-fellas-inc-prestigio-conquistas-design.md` (aprovada e revista em 10/10),
sobre a base `docs/superpowers/specs/2026-10-10-fellas-inc-design.md`. Plano anterior:
`docs/superpowers/plans/2026-10-10-fellas-inc-gente.md`.

**Ajustes de implementação em relação à spec** (decisões tomadas; o comportamento pedido não muda):
- **Numeração:** `0040_fellas_inc_catalogo_conquistas.sql` (catálogo GERADO: conquistas + árvore, Task 1) vem antes da
  lógica `0041_fellas_inc_prestigio.sql` (Tasks 3–6), porque as funções `language sql` da lógica citam
  `idle_cat_conquista`/`idle_cat_no` e o Postgres confere a tabela ao criar a função (mesma ordem da 0037/0038).
- **K = 1 milhão** (medido; Task 2): `pontos_totais(r) = floor(cbrt(r / 1e6))`. Os dois lados acertam o inteiro com
  `n³ ≤ x < (n+1)³` depois do `cbrt`, para o banco e a página nunca discordarem perto de um cubo.
- **Pontos:** `prestige_earned` (ganhos na vida) e `prestige_spent` (gastos na árvore); livres = ganhos − gastos. A venda
  rende `pontos_totais(r) − prestige_earned` (mínimo 1) e põe `prestige_earned = pontos_totais(r)`.
- **Árvore:** ids `ramo·10 + posição` (a raiz é 1; Produção 11–15, Recomeço 21–25, Oportunidades 31–35, Tempo 41–45,
  Gente 51–55); custos 1 (raiz) e 2 · 4 · 8 · 15 · 30 (296 pontos a árvore toda); cada nó exige o anterior do ramo (o 1º
  exige a raiz). Valores da spec 1.3, com estas leituras: Produção multiplica (×1,05 × 1,1 × 1,25 × 1,5 × 2 × 2);
  "contratar 50% mais barato" substitui o de 25% (vale o menor preço, não 0,75 × 0,5); "rendem 15%" é o mesmo 15% da
  Cultura de startup (não soma); "quem te contrata rende o dobro" dobra o 2% × o que cada empresa paga, não o piso de
  freela; "contrato dura 10 dias" vale para os contratos que a pessoa com o nó faz; "a venda mantém as melhorias gerais"
  mantém as gerais que você tinha (não dá as 20); nó comprado com a empresa fechada vale no próximo "Abrir CNPJ".
  Nomes dos nós escritos aqui (`nomes.ts`), revisáveis como texto.
- **Onde as conquistas são conferidas:** `idle_check_conquistas(uid)` roda dentro de `idle_save` (troca da 0036). Toda
  RPC que muda o jogo termina em `idle_save` depois de `idle_settle`, então a conquista nova só vale dali pra frente e
  quem é contratado também é conferido. As "novas" que a tela avisa são as gravadas nesta transação (`ganhou_em =
  now()`). Conquistas de evento (venda de 1 ponto, venda sem nunca ter contratado, contratar o limaumdoc, Máx ≥ 100,
  abrir às 3h, unicórnio da foto) são dadas por `idle_ganhar` na função que vê o evento, também depois de fechar a conta.
- **Sem chave estrangeira** de `idle_conquistas`/`idle_arvore` para o catálogo: a migração de catálogo apaga e regrava
  os catálogos; uma FK bloquearia isso (ou, com cascade, apagaria conquistas e nós).
- **Contadores pra sempre** (spec: contam a vida toda): `upg_total`, `opp_total`, `hire_total`, `hired_total`,
  `est_usadas` (código era·10+opção), `opp_recent` (hora das 3 últimas pegas, para o "Brainrot"). A 0041 preenche o que
  dá para saber do passado (melhorias de agora, contratos, estratégias de agora, quem já foi unicórnio); oportunidades
  começam do zero. `idle_save` guarda as janelas de oportunidade pegas das últimas 10h (eram 5h; a validade vai a 6h).
- **Venda:** `started = false` (a tela volta para a cena "antes" e o "Abrir CNPJ"); quem vendeu sai do placar até
  abrir de novo (o placar é de quem tem empresa aberta, regra da 0036). O recorde de R$/s é guardado em todo `idle_save`.
  Vencer os contratos feitos = `ends_at = now()` só nos ativos com `created_at < now()` (o check da tabela exige
  `ends_at > created_at`).
- **"Farmou aura":** 1º estrito em R$/s entre quem tem empresa aberta, com mais alguém com empresa aberta. "Indeciso
  profissional": as 3 opções de uma era (eras com opção desligada só contam quando a entrega 4 ligar). "Conhece todos os
  caminhos": todas as opções ligadas.
- **Contagem "N/total"** conta todas as conquistas, escondidas inclusive (73). Na grade, a bloqueada aparece apagada com
  o nome; a condição aparece ao tocar (no mesmo lugar onde a ganha mostra a frase e a data), para caber no celular.
- **Simulação:** o jogador que vende gasta "o nó mais barato já liberado que acelera" (o ramo Gente e a validade das
  oportunidades não aceleram quem joga sozinho e pega na hora).
- **Testes antigos:** `freshDb({ conquistas: false })` esvazia o catálogo das conquistas para `idle.test.ts`,
  `idleGente.test.ts` e o teste da árvore, que conferem a conta exata sem o +1% das conquistas que as ações vão ganhando.
- **Frase do limaumdoc** ("a combinar com o grupo"): provisória "Contratou o limaumdoc. Agora é com ele.".
- A conquista do "Vitor" fica para depois (migração nova de catálogo quando o Juan explicar a piada).

## Restrições globais

- **Sem reset:** nada apaga estado, contratos, pontos, nós ou conquistas (`delete from public.idle_state`,
  `idle_contracts`, `idle_conquistas` e `idle_arvore` não aparecem na 0041) e nada filtra o jogo ou o placar pela
  semana. A semana só existe na foto de segunda (que só tira foto) e no limite diário de oportunidades. A venda é
  escolha do jogador e só zera a empresa dele.
- Fellas Inc. **não toca nos créditos do cassino**: nada de `game_wallets`, `game_ledger`, `games_move`, Blackjack,
  Poker, fiado ou `weekly_champion` no código novo.
- Migrações novas: `0040_fellas_inc_catalogo_conquistas.sql` (gerada por `catalogoSql()`, regra do cabeçalho da 0033:
  `ATUALIZAR_CATALOGO=<arquivo>.sql npx vitest run idle/catalogo.test.ts` em `games/`) e `0041_fellas_inc_prestigio.sql`.
  As duas listadas em `games/test/db.ts` e `games/dev/mockDb.ts`. **0033 a 0039 não se editam.** Todo arquivo em UTF-8
  sem BOM (`games/test/migracoesUtf8.test.ts`).
- Função que já existe muda com `create or replace` mantendo a assinatura, copiada da versão mais nova (0034 para
  `idle_open`, `idle_start`, `idle_buy`, `idle_claim_opportunity`, `idle_opp_list`, `idle_opp_cap`; 0036 para
  `idle_save`; 0038 para `idle_rate_at`, `idle_social_mult`, `idle_settle`, `idle_hire_price`, `idle_json`, `idle_hire`,
  `idle_board`, `idle_weekly_reset`).
- Toda tabela com RLS e leitura para membros (`public.is_member()`); escrita só por funções `security definer
  set search_path = public`; funções internas com `revoke all ... from public, anon, authenticated`; RPCs com
  `revoke all ... from public, anon` + `grant execute ... to authenticated`. Erros de usuário `raise exception '<codigo>'
  using errcode = 'P0001'` (códigos novos: `idle_prestige_low`, `idle_points_low`, `idle_node_owned`); não membro
  `not_member` com `42501`. Todo `update public.`/`delete from public.` com `where`
  (`__tests__/safeUpdateMigrations.test.ts`). Migrações idempotentes.
- Paridade: tudo que a árvore e as conquistas mexem (taxa `× nós de produção × (1 + 0,01·conquistas)`, contratos,
  teto do offline, caixinha/validade/limite/bônus das oportunidades, preço e duração do contrato, "Abrir CNPJ") existe
  igual em SQL e em `games/idle/economia.ts`/`oportunidades.ts`; `games/test/idleParidade.test.ts` exige erro relativo
  < 1e-9, inclusive atravessando vencimento de contrato e o teto do offline.
- Página do jogo: pt-BR no tom do `PRODUCT.md` (informal, "você", botão diz a ação, sem emoji como ícone; "★" é
  caractere de texto); CSS em `games/idle/idle.css` com as cores que ele já usa; alvo de toque ≥ 44px; foco visível;
  texto vindo do banco por `textContent`. Edições pontuais em `tela.ts` e `main.ts`: o que já existe fica (aba Melhorias
  "À venda | Compradas", placar "+R$ X/s" com "Era N · nome", folhas, `vigiarVersao`, editor de personagem, aba Contratar).
  Frontend usa a skill `impeccable` (modo Operate), lendo `PRODUCT.md` e `DESIGN.md` antes.
- Arte feita por código fora do repositório (`C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`, padrão do
  `BRIEF-SPRITES.md` e do `gerais.js`) e copiada para `games/idle/assets/`. Sem o ícone, a célula mostra só a moldura.
- `?mock`: bots com pontos, nós e conquistas de exemplo (uma escondida); `__vendavel()` no console deixa a sua empresa
  vendável.
- Commits sem `Co-Authored-By` nem qualquer marca de IA. Branch `fellas-inc-prestigio`; no fim, merge local na `main` e
  push (sem PR), só depois de o Juan aplicar as migrações e as colunas serem conferidas.
- Windows + Git Bash: `cd <dir> && ...` em cada comando. Na raiz: `npx tsc --noEmit` e `npm test`. Em `games/`:
  `npx tsc --noEmit`, `npx vitest run` e `npm run build`. O CI roda Node 24.

## Foco da revisão

1. **Toque duplo em "Vender"** (ou dois aparelhos): a segunda chamada espera a trava da linha e encontra a empresa já
   vendida: `idle_not_started`, pontos e vendas contados uma vez só. Toque duplo em "Comprar" um nó: a segunda vira
   `idle_node_owned` e o custo sai uma vez só (a trava é a mesma `idle_lock`). Testes no banco (Tasks 5 e 6).
2. **Venda com contratados que não abrem o jogo há horas**, com contrato ativo ou já vencido sem a conta fechada: eles
   fecham a conta com o triplo da Cultura de startup antes de as estratégias de quem vendeu zerarem. Testes no banco
   (Task 6); a ordem das travas (`idle_lock_all`, por `user_id`) fica para a revisão de código.
3. **Nada vale pra trás**: conquista nova e nó novo (produção, teto do offline) só valem depois de fechar a conta; o
   "Pai tá on", dado pela foto de segunda sem ação do jogador, fecha a conta do unicórnio antes. Testes no banco (Tasks
   4, 5 e 6) e de paridade com o teto atravessando vencimento (Task 3).
4. **Página velha depois da venda ou de comprar nó** (outra aba, outro aparelho): o banco recusa com `idle_not_started`,
   `idle_points_low` ou `idle_node_owned` e a página recarrega (`RECARREGA`); a folha de venda some quando a venda deixou
   de compensar. Teste da tela para a folha (Task 9); o resto na conferência real com dois aparelhos (Task 12).
5. **Celular estreito**: 5 abas rolando de lado, ramos empilhados, aviso de conquista sem tapar toque
   (`pointer-events: none`). Teste das 5 abas e dos ramos (Task 9); a rolagem e o aviso na conferência no `?mock` a
   360 px (Task 9).

---

## Estrutura de arquivos

```
supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql   GERADO por catalogo.ts: + conquistas, + árvore (idle_cat_no), 283 renomeada
supabase/migrations/0041_fellas_inc_prestigio.sql             colunas, tabelas, efeitos da árvore nas contas, conquistas, idle_buy_node,
                                                              Abrir CNPJ, venda, placar, foto de segunda, o que já aconteceu
games/idle/
  nomes.ts             + TipoConquista, CONQUISTAS_GERADOR, CONQUISTAS, RAMOS, TipoNo, ARVORE; 283 renomeada
  catalogo.ts          + Conquista, No, CUSTO_NO, RAIZ; catalogo.conquistas e catalogo.arvore no SQL gerado
  economia.ts          + Bonus, EfeitosArvore, efeitosArvore, efeitosDe, multBonus, pontosTotais, abertura, precoContrato,
                       teto em acumular/acumularTrechos, árvore em multContratos
  oportunidades.ts     + Caixa, CAIXA_PADRAO; pendentes com a caixinha da árvore
  simulacao.ts         + amostras, bonus/gerais, primeiraVenda, gastar, volta
  store.ts             + efeitos, caixa; valuationAgora com o teto da árvore
  legado.ts            (novo) grade de conquistas, situação dos nós, textos, fila de avisos
  ativos.ts            + conquista(id), no(id)
  tela.ts, idle.css    aba Legado, folha de venda, aviso na cena, ★ no placar, abas roláveis (edições pontuais)
  main.ts              vender, comprar nó, caixinha da árvore, fila de avisos (edições pontuais)
  assets/conquistas/   (Task 11) conquista-001.png … conquista-062.png, conquista-101.png … conquista-111.png
  assets/arvore/       (Task 11) no-01.png, no-11.png … no-55.png
games/shared/types.ts, api.ts, errors.ts      IdleState/IdleBoardRow novos, idlePrestige, idleBuyNode, erros novos
games/dev/mockIdle.ts, mockDb.ts             bots com pontos, nós e conquistas, __vendavel, dono(); 0040 e 0041
games/test/db.ts                             0040 e 0041; freshDb({ conquistas: false })
games/test/idleConquistas.test.ts            (novo) banco: conquistas
games/test/idleArvore.test.ts                (novo) banco: comprar nós e o efeito de cada ramo
games/test/idlePrestigio.test.ts             (novo) banco: venda, placar, a migração contando o passado
games/test/idle.test.ts, idleGente.test.ts   freshDb({ conquistas: false })
games/test/idleParidade.test.ts              paridade com a árvore e as conquistas; pontos totais
__tests__/fellasIncMigration.test.ts         travas da 0040/0041
../fellas-inc-esbocos/ (fora do repo)        BRIEF-LEGADO.md e legado-icones.js
```

**Ordem:** Tasks 1–9 em sequência. A Task 10 (arte, fora do repositório) pode correr em paralelo com o código. Task 11
depois de 9 e 10. Task 12 por último.

---

## Contrato de formato da arte (vale para o código e para a arte)

- Conquistas: `games/idle/assets/conquistas/conquista-NNN.png`, NNN = id com 3 dígitos (001 … 062, 101 … 111; 73
  arquivos), achados por `ativos.conquista(id)`.
- Nós da árvore: `games/idle/assets/arvore/no-NN.png`, NN = id com 2 dígitos (`no-01.png` a raiz, `no-11.png` …
  `no-55.png`; 26 arquivos), achados por `ativos.no(id)`.
- Todos: **16×16**, fundo transparente, **1 quadro** (estático), pixel duro (sem semitransparência), contorno preto de
  1px de `cv.contornar()` com 1px de margem, 2 a 4 cores mais o contorno, como os ícones das melhorias gerais
  (`gerais.js`). Na tela aparecem a 48×48 (3×, `image-rendering: pixelated`) num quadradinho escuro (`#1B1A22`).
  Bloqueado (conquista não ganha, nó trancado), a tela aplica `grayscale(1)` e opacidade 0,35: a silhueta tem de ler
  sem cor. Arquivo de id que não existe no catálogo é erro (teste da Task 11).
- Sem o arquivo, a célula mostra só a moldura (`.icone-legado.sem-arte`); nada quebra.

---

### Task 1: Catálogo: conquistas, a árvore e a "Filial em Portugal" (0040)

**Files:**
- Modify: `games/idle/nomes.ts`, `games/idle/catalogo.ts`, `games/idle/catalogo.test.ts`, `games/test/db.ts`,
  `games/dev/mockDb.ts`
- Create (gerado): `supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql`

**Interfaces:**
- Produz: `TipoConquista`, `TipoNo` (re-exportados de `catalogo.ts`); `Conquista = { id, nome, frase, condicao, tipo,
  alvo: number | null, valor: number | null, texto: string | null, escondida }`; `No = { id, ramo, posicao, nome,
  efeito, custo, tipo: TipoNo, valor: number, requer: number | null }`; `CUSTO_NO = [2, 4, 8, 15, 30]`, `CUSTO_RAIZ = 1`,
  `RAIZ = 1`; `RAMOS` (nomes, índice = ramo); `catalogo.conquistas` (1–62 visíveis, 101–111 escondidas),
  `catalogo.arvore` (26 nós); tabelas `public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, texto,
  escondida)` e `public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer)`.

- [ ] **Step 1: Testes (`games/idle/catalogo.test.ts`)**

No `describe('catálogo', ...)`, antes de `it('montarCatalogo usa os parâmetros', ...)`, acrescente:

```ts
  it('conquistas: 62 visíveis e 11 escondidas, ids únicos, uma de 100 pra cada gerador, textos curtos', () => {
    const c = catalogo.conquistas;
    expect(c.filter((x) => !x.escondida)).toHaveLength(62);
    expect(c.filter((x) => x.escondida)).toHaveLength(11);
    expect(new Set(c.map((x) => x.id)).size).toBe(c.length);
    for (let g = 1; g <= 30; g++) expect(c.find((x) => x.id === g)).toMatchObject({ tipo: 'gerador', alvo: g, valor: 100, escondida: false });
    expect(c.find((x) => x.id === 7)!.nome).toBe('Estágio não remunerado em escala');
    for (const x of c) {
      expect(x.nome.length, x.nome).toBeGreaterThan(0);
      expect(x.nome.length, x.nome).toBeLessThanOrEqual(34);
      expect(x.frase.length, x.nome).toBeGreaterThan(0);
      expect(x.condicao.length, x.nome).toBeGreaterThan(0);
    }
  });
  it('escondidas: as da spec; a Guiana Brasileira é a Filial em Portugal (a melhoria 283, que mudou de nome)', () => {
    expect(catalogo.conquistas.filter((x) => x.escondida).map((x) => x.nome)).toEqual([
      '6-7', 'Farmou aura', 'Aura negativa', 'limaumdoc', 'Tá saindo da jaula', 'Guiana Brasileira', 'Fez o L', '3h06',
      'Modo sigma', 'Pai tá on', 'Brainrot',
    ]);
    expect(catalogo.melhorias.find((m) => m.id === 283)).toMatchObject({ nome: 'Filial em Portugal', gerador: 28, requer: 25 });
    expect(catalogo.conquistas.find((x) => x.nome === 'Guiana Brasileira')).toMatchObject({ tipo: 'melhoria', alvo: 283 });
    expect(catalogo.conquistas.find((x) => x.tipo === 'contratar_usuario')!.texto).toBe('limaumdoc');
  });
  it('árvore: a raiz e 5 ramos de 5 nós; custos 1 · 2 · 4 · 8 · 15 · 30; cada nó exige o anterior (o 1º, a raiz)', () => {
    const a = catalogo.arvore;
    expect(a).toHaveLength(26);
    expect(a[0]).toMatchObject({ id: 1, ramo: 0, nome: 'Fundador', custo: 1, requer: null, tipo: 'producao', valor: 1.05 });
    for (let r = 1; r <= 5; r++) {
      const ramo = a.filter((n) => n.ramo === r);
      expect(ramo.map((n) => n.id)).toEqual([1, 2, 3, 4, 5].map((p) => r * 10 + p));
      expect(ramo.map((n) => n.custo)).toEqual([2, 4, 8, 15, 30]);
      expect(ramo.map((n) => n.requer)).toEqual([1, r * 10 + 1, r * 10 + 2, r * 10 + 3, r * 10 + 4]);
    }
    expect(a.reduce((t, n) => t + n.custo, 0)).toBe(296);
    expect(a.filter((n) => n.ramo === 4).map((n) => n.valor)).toEqual([12, 16, 24, 36, 48]);
    for (const n of a) expect(n.nome.length, n.nome).toBeLessThanOrEqual(26);
  });
```

No `describe('catálogo no banco (migração mais recente)', ...)`, troque a linha do teste das aspas

```ts
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [] }))
```

por

```ts
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [], conquistas: [], arvore: [] }))
```

e, antes de `it('frase da sinergia 2006 usa vírgula decimal (pt-BR)', ...)`, acrescente:

```ts
  it('conquistas entram no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, texto, escondida) values');
    expect(catalogoSql()).toContain("(101, '6-7', 'Seis sete. Ninguém sabe por quê.', 'Ter exatamente 67 de algum gerador', 'gerador_exato', null, 67, null, true)");
  });
  it('a árvore entra no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer) values');
    expect(catalogoSql()).toContain("(41, 4, 1, 'Soneca longa', 'A empresa rende até 12h com o jogo fechado.', 2, 'teto', 12, 1)");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/catalogo.test.ts`
Expected: FAIL (`catalogo.conquistas`/`catalogo.arvore` não existem; a 283 ainda é "Visto de negócios").

- [ ] **Step 3: Textos (`games/idle/nomes.ts`)**

Na lista `MELHORIAS_GERADOR`, na linha do gerador 28, troque `'Visto de negócios'` por `'Filial em Portugal'`:

```ts
  ['Escritório no arranha-céu', 'Carro de luxo da firma', 'Filial em Portugal', 'Parceiro xeique', 'Torre própria'],
```

No fim do arquivo, acrescente:

```ts
/** Tipos de condição das conquistas. As "de estado" o banco confere em idle_check_conquistas (no idle_save, o último
 *  passo de toda função que muda o jogo); as "de evento" (aura_negativa, sigma, contratar_usuario, jaula, madrugada,
 *  unicornio) quem vê o evento dá na hora (idle_ganhar). */
export type TipoConquista =
  | 'gerador' | 'gerador_exato' | 'taxa' | 'era' | 'melhoria' | 'melhorias' | 'oportunidades' | 'vendas'
  | 'contratei' | 'contratado' | 'estrategia_era' | 'estrategia_todas' | 'aura' | 'brainrot'
  | 'aura_negativa' | 'sigma' | 'contratar_usuario' | 'jaula' | 'madrugada' | 'unicornio';

/** Conquista "ter 100" de cada gerador (ids 1 a 30, na ordem dos geradores): [nome, frase]. */
export const CONQUISTAS_GERADOR: readonly (readonly [string, string])[] = [
  ['Cem abas abertas', 'O notebook pede arrego.'],
  ['Guru do LinkedIn', 'Concorda? Comenta "sim".'],
  ['Excel avançado (de verdade)', 'PROCV até no sonho.'],
  ['A família toda comprou', 'Até o tio do pavê.'],
  ['Freela vira firma', 'Cem clientes e nenhum contrato.'],
  ['Streamer em tempo integral', 'Live de 100 horas, quem nunca.'],
  ['Estágio não remunerado em escala', 'Cem estagiários, uma cafeteira.'],
  ['Fábrica de chaveiro', 'O cheiro de plástico é o do sucesso.'],
  ['Rei do zap', 'Cem grupos e nenhum silenciado.'],
  ['Chega em 40 dias', 'O cliente ainda tá esperando.'],
  ['Frota de food truck', 'Engarrafamento de molho da casa.'],
  ['MercadoLíder Platinum', 'Frete grátis acima de tudo.'],
  ['Cem episódios', 'Ninguém lembra o que falou no 37.'],
  ['Agência de influencer', 'Todo mundo com o seu cupom.'],
  ['Tem um app pra isso', 'E todos pedem cinco estrelas.'],
  ['Infoprodutor', 'Curso de como vender curso.'],
  ['Agência das agências', 'Cem reels por semana.'],
  ['Dono da Faria Lima', 'Café liberado em cem andares.'],
  ['Day trade em escala', 'Stop é pra quem tem medo.'],
  ['Céu de anjos', 'Cem cheques e nenhum conselho útil.'],
  ['Nuvem própria', 'A conta de luz tem mais dígitos que o valuation.'],
  ['Série Z', 'Acabou o alfabeto e ainda tem rodada.'],
  ['Inovação em escala industrial', 'Cem post-its por metro quadrado.'],
  ['Não sobrou concorrente', 'O CADE quer conversar.'],
  ['Rolê todo dia', 'O fígado pediu férias.'],
  ['Liga própria', 'Cem times e ninguém cai.'],
  ['Arquipélago', 'Já dá pra fundar um país.'],
  ['Dono de Dubai', 'O xeique pede conselho pra você.'],
  ['A bolsa é sua', 'Quem toca o sino é você.'],
  ['Frota interplanetária', 'Marte já tem fila de embarque.'],
];

export type ConquistaTexto = {
  id: number; nome: string; frase: string; condicao: string; tipo: TipoConquista;
  alvo?: number; valor?: number; texto?: string; escondida?: boolean;
};

/** As outras conquistas: visíveis (31 a 62) e escondidas (101 em diante; só aparecem quando alguém do grupo
 *  consegue). Conquista nova = id novo e migração nova do catálogo; id nunca muda nem é reaproveitado (o banco guarda
 *  quem ganhou pelo id). */
export const CONQUISTAS: readonly ConquistaTexto[] = [
  { id: 31, tipo: 'taxa', valor: 1, nome: 'Primeiro real', frase: 'R$ 1 por segundo. Já dá um chiclete.', condicao: 'Produzir R$ 1 por segundo' },
  { id: 32, tipo: 'taxa', valor: 100, nome: 'Pix caindo', frase: 'Já paga o iFood.', condicao: 'Produzir R$ 100 por segundo' },
  { id: 33, tipo: 'taxa', valor: 1e4, nome: 'O leão acordou', frase: 'O contador começou a te ligar.', condicao: 'Produzir R$ 10 mil por segundo' },
  { id: 34, tipo: 'taxa', valor: 1e6, nome: 'Acumulou!', frase: 'Uma Mega da Virada a cada segundo.', condicao: 'Produzir R$ 1 mi por segundo' },
  { id: 35, tipo: 'taxa', valor: 1e9, nome: 'Bilionário de LinkedIn', frase: 'A Forbes mandou e-mail.', condicao: 'Produzir R$ 1 bi por segundo' },
  { id: 36, tipo: 'taxa', valor: 1e12, nome: 'Trilhão por segundo', frase: 'Maior que o PIB, menor que o ego.', condicao: 'Produzir R$ 1 tri por segundo' },
  { id: 37, tipo: 'taxa', valor: 1e15, nome: 'Quatrilhão por segundo', frase: 'Ninguém sabe escrever esse número.', condicao: 'Produzir R$ 1 quatri por segundo' },
  { id: 38, tipo: 'taxa', valor: 1e18, nome: 'Casa da Moeda', frase: 'O dinheiro do mundo acabou. Você imprimiu mais.', condicao: 'Produzir R$ 1 quinti por segundo' },
  { id: 39, tipo: 'era', valor: 2, nome: 'Saiu da casa dos pais', frase: 'A garagem é o novo quarto.', condicao: 'Chegar na era 2 (Garagem)' },
  { id: 40, tipo: 'era', valor: 3, nome: 'Tem até catraca', frase: 'E crachá com foto ruim.', condicao: 'Chegar na era 3 (Escritório)' },
  { id: 41, tipo: 'era', valor: 4, nome: 'Andar inteiro', frase: 'O elevador para só pra você.', condicao: 'Chegar na era 4 (Andar inteiro)' },
  { id: 42, tipo: 'era', valor: 5, nome: 'Sede própria', frase: 'O prédio tem o seu logo.', condicao: 'Chegar na era 5 (Sede)' },
  { id: 43, tipo: 'gerador', alvo: 30, valor: 1, nome: 'Ao infinito e além', frase: 'Do quarto pra Marte.', condicao: 'Ter 1 "Foguete pra Marte"' },
  { id: 44, tipo: 'melhorias', valor: 10, nome: 'Placa de vídeo nova', frase: 'Dez melhorias e o notebook ainda esquenta.', condicao: 'Comprar 10 melhorias' },
  { id: 45, tipo: 'melhorias', valor: 50, nome: 'Coach de produtividade', frase: 'Cinquenta melhorias, zero reuniões.', condicao: 'Comprar 50 melhorias' },
  { id: 46, tipo: 'melhorias', valor: 150, nome: 'Tudo pela família', frase: 'Não tem mais o que melhorar. Ou tem.', condicao: 'Comprar 150 melhorias' },
  { id: 47, tipo: 'oportunidades', valor: 1, nome: 'Black Friday', frase: 'Pegou a primeira.', condicao: 'Pegar 1 oportunidade' },
  { id: 48, tipo: 'oportunidades', valor: 25, nome: 'Caça-promoção', frase: 'Vê desconto de longe.', condicao: 'Pegar 25 oportunidades' },
  { id: 49, tipo: 'oportunidades', valor: 100, nome: 'Oportunista', frase: 'No bom sentido.', condicao: 'Pegar 100 oportunidades' },
  { id: 50, tipo: 'oportunidades', valor: 500, nome: 'Sniper', frase: 'Quinhentas. Você dorme?', condicao: 'Pegar 500 oportunidades' },
  { id: 51, tipo: 'vendas', valor: 1, nome: 'Exit', frase: 'Vendeu a primeira startup.', condicao: 'Vender a startup 1 vez' },
  { id: 52, tipo: 'vendas', valor: 5, nome: 'Empreendedor serial', frase: 'Abre, cresce, vende, repete.', condicao: 'Vender a startup 5 vezes' },
  { id: 53, tipo: 'vendas', valor: 10, nome: 'Unicórnio em série', frase: 'Dez exits no currículo.', condicao: 'Vender a startup 10 vezes' },
  { id: 54, tipo: 'vendas', valor: 25, nome: 'Virou jurado do Shark Tank', frase: 'Vinte e cinco vendas. Já vira palestra.', condicao: 'Vender a startup 25 vezes' },
  { id: 55, tipo: 'contratei', valor: 1, nome: 'Primeira contratação', frase: 'Agora você é chefe.', condicao: 'Contratar 1 vez' },
  { id: 56, tipo: 'contratei', valor: 10, nome: 'O RH sou eu', frase: 'Dez contratos assinados.', condicao: 'Contratar 10 vezes' },
  { id: 57, tipo: 'contratei', valor: 50, nome: 'Headhunter', frase: 'Cinquenta contratações e nenhuma entrevista.', condicao: 'Contratar 50 vezes' },
  { id: 58, tipo: 'contratado', valor: 1, nome: 'Primeiro emprego', frase: 'Carteira assinada (de mentira).', condicao: 'Ser contratado 1 vez' },
  { id: 59, tipo: 'contratado', valor: 10, nome: 'Passe valorizado', frase: 'Dez empresas te quiseram.', condicao: 'Ser contratado 10 vezes' },
  { id: 60, tipo: 'contratado', valor: 50, nome: 'Funcionário do mês, todo mês', frase: 'Cinquenta contratos. Você trabalha?', condicao: 'Ser contratado 50 vezes' },
  { id: 61, tipo: 'estrategia_era', nome: 'Indeciso profissional', frase: 'Já foi de tudo um pouco.', condicao: 'Usar as 3 estratégias de uma era (uma em cada empresa)' },
  { id: 62, tipo: 'estrategia_todas', nome: 'Conhece todos os caminhos', frase: 'Não tem estratégia que você não testou.', condicao: 'Usar todas as estratégias liberadas' },
  { id: 101, escondida: true, tipo: 'gerador_exato', valor: 67, nome: '6-7', frase: 'Seis sete. Ninguém sabe por quê.', condicao: 'Ter exatamente 67 de algum gerador' },
  { id: 102, escondida: true, tipo: 'aura', nome: 'Farmou aura', frase: '+1000 de aura.', condicao: 'Ficar em 1º no placar' },
  { id: 103, escondida: true, tipo: 'aura_negativa', nome: 'Aura negativa', frase: 'Vendeu por um real e um abraço.', condicao: 'Vender a startup e ganhar só 1 ponto' },
  { id: 104, escondida: true, tipo: 'contratar_usuario', texto: 'limaumdoc', nome: 'limaumdoc', frase: 'Contratou o limaumdoc. Agora é com ele.', condicao: 'Contratar o limaumdoc' },
  { id: 105, escondida: true, tipo: 'jaula', valor: 100, nome: 'Tá saindo da jaula', frase: 'Birl! O monstro tá saindo da jaula.', condicao: 'Levar 100 ou mais de uma vez no Máx' },
  { id: 106, escondida: true, tipo: 'melhoria', alvo: 283, nome: 'Guiana Brasileira', frase: 'Fala galera! A Guiana Brasileira agora tem sede.', condicao: 'Comprar "Filial em Portugal"' },
  { id: 107, escondida: true, tipo: 'gerador', alvo: 7, valor: 50, nome: 'Fez o L', frase: 'L de Luis, que fique claro.', condicao: 'Ter 50 "Estagiário"' },
  { id: 108, escondida: true, tipo: 'madrugada', nome: '3h06', frase: 'Bora fundar uma empresa?', condicao: 'Abrir a Fellas Inc. entre 3h e 4h da manhã' },
  { id: 109, escondida: true, tipo: 'sigma', nome: 'Modo sigma', frase: 'Lobo solitário do empreendedorismo.', condicao: 'Vender a startup sem nunca ter contratado ninguém' },
  { id: 110, escondida: true, tipo: 'unicornio', nome: 'Pai tá on', frase: 'O pai tá on.', condicao: 'Ser o unicórnio da semana' },
  { id: 111, escondida: true, tipo: 'brainrot', valor: 60, nome: 'Brainrot', frase: 'Tung tung tung empreendedor.', condicao: 'Pegar 3 oportunidades em menos de 1 minuto' },
];

/** Ramos da árvore de habilidades: 0 é a raiz; 1 a 5 são os ramos. */
export const RAMOS: readonly string[] = ['Fundador', 'Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente'];

/** O que cada nó faz. Valor: multiplicador (producao, opp_bonus, contrato_preco, emprego_mult), horas (teto, validade),
 *  quantidade (caixinha, opp_extra, inicio_notebooks, contrato_dias), reais (inicio_valuation), fração (por_contratado)
 *  ou 1 (inicio_era1, manter_gerais: só ter o nó). */
export type TipoNo =
  | 'producao' | 'inicio_valuation' | 'inicio_notebooks' | 'manter_gerais' | 'inicio_era1'
  | 'caixinha' | 'validade' | 'opp_extra' | 'opp_bonus' | 'teto'
  | 'contrato_preco' | 'por_contratado' | 'contrato_dias' | 'emprego_mult';

export type NoTexto = { ramo: number; posicao: number; nome: string; efeito: string; tipo: TipoNo; valor: number };

/** A árvore de habilidades, na ordem: a raiz e os 5 ramos de 5 nós. id = ramo·10 + posição (a raiz é 1). Nó novo ou
 *  efeito mudado = migração nova do catálogo; id nunca muda (o banco guarda quem comprou pelo id). */
export const ARVORE: readonly NoTexto[] = [
  { ramo: 0, posicao: 1, tipo: 'producao', valor: 1.05, nome: 'Fundador', efeito: 'Abre a árvore. Produção +5%.' },
  { ramo: 1, posicao: 1, tipo: 'producao', valor: 1.1, nome: 'Café sem açúcar', efeito: 'Produção +10%.' },
  { ramo: 1, posicao: 2, tipo: 'producao', valor: 1.25, nome: 'Planilha de metas', efeito: 'Produção +25%.' },
  { ramo: 1, posicao: 3, tipo: 'producao', valor: 1.5, nome: 'Alta performance', efeito: 'Produção +50%.' },
  { ramo: 1, posicao: 4, tipo: 'producao', valor: 2, nome: 'Escala', efeito: 'Produção +100%.' },
  { ramo: 1, posicao: 5, tipo: 'producao', valor: 2, nome: 'Modo turbo', efeito: 'Produção ×2 em tudo.' },
  { ramo: 2, posicao: 1, tipo: 'inicio_valuation', valor: 1000, nome: 'Pé-de-meia', efeito: 'O Abrir CNPJ começa com R$ 1 mil.' },
  { ramo: 2, posicao: 2, tipo: 'inicio_notebooks', valor: 10, nome: 'Notebooks usados', efeito: 'O Abrir CNPJ começa com 10 notebooks.' },
  { ramo: 2, posicao: 3, tipo: 'manter_gerais', valor: 1, nome: 'Leva a cultura junto', efeito: 'Vender a startup mantém as melhorias gerais.' },
  { ramo: 2, posicao: 4, tipo: 'inicio_valuation', valor: 1e6, nome: 'Herança', efeito: 'O Abrir CNPJ começa com R$ 1 mi.' },
  { ramo: 2, posicao: 5, tipo: 'inicio_era1', valor: 1, nome: 'Kit startup', efeito: 'O Abrir CNPJ começa com 1 de cada gerador da era 1.' },
  { ramo: 3, posicao: 1, tipo: 'caixinha', valor: 4, nome: 'Caixinha maior', efeito: 'A caixinha guarda 4 oportunidades.' },
  { ramo: 3, posicao: 2, tipo: 'validade', valor: 6, nome: 'Lembrete no celular', efeito: 'Oportunidade guardada dura 6h.' },
  { ramo: 3, posicao: 3, tipo: 'opp_extra', valor: 3, nome: 'Faro de negócio', efeito: '+3 oportunidades por dia.' },
  { ramo: 3, posicao: 4, tipo: 'opp_bonus', valor: 2, nome: 'Negociador', efeito: 'Oportunidades rendem o dobro.' },
  { ramo: 3, posicao: 5, tipo: 'caixinha', valor: 5, nome: 'Caixinha gigante', efeito: 'A caixinha guarda 5 oportunidades.' },
  { ramo: 4, posicao: 1, tipo: 'teto', valor: 12, nome: 'Soneca longa', efeito: 'A empresa rende até 12h com o jogo fechado.' },
  { ramo: 4, posicao: 2, tipo: 'teto', valor: 16, nome: 'Gerente da madrugada', efeito: 'Rende até 16h com o jogo fechado.' },
  { ramo: 4, posicao: 3, tipo: 'teto', valor: 24, nome: 'Piloto automático', efeito: 'Rende até 24h com o jogo fechado.' },
  { ramo: 4, posicao: 4, tipo: 'teto', valor: 36, nome: 'Empresa que anda sozinha', efeito: 'Rende até 36h com o jogo fechado.' },
  { ramo: 4, posicao: 5, tipo: 'teto', valor: 48, nome: 'Fim de semana prolongado', efeito: 'Rende até 48h com o jogo fechado.' },
  { ramo: 5, posicao: 1, tipo: 'contrato_preco', valor: 0.75, nome: 'Vaga no LinkedIn', efeito: 'Contratar custa 25% menos.' },
  { ramo: 5, posicao: 2, tipo: 'por_contratado', valor: 0.15, nome: 'Treinamento', efeito: 'Seus contratados rendem 15% (no lugar de 10%).' },
  { ramo: 5, posicao: 3, tipo: 'contrato_dias', valor: 10, nome: 'Contrato longo', efeito: 'Os contratos que você faz duram 10 dias.' },
  { ramo: 5, posicao: 4, tipo: 'emprego_mult', valor: 2, nome: 'Passe em alta', efeito: 'Quem te contrata rende o dobro pra você.' },
  { ramo: 5, posicao: 5, tipo: 'contrato_preco', valor: 0.5, nome: 'RH terceirizado', efeito: 'Contratar custa 50% menos.' },
];
```

- [ ] **Step 4: Catálogo (`games/idle/catalogo.ts`)** — troque cada trecho, na ordem:

1. Trecho:

```ts
// É a fonte única: o banco recebe uma cópia gerada (0033, ver catalogoSql) e um teste trava os dois iguais.
import { CARGOS, ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS } from './nomes';
```

   vira:

```ts
// É a fonte única: o banco recebe uma cópia gerada (0033, ver catalogoSql) e um teste trava os dois iguais.
import {
  ARVORE, CARGOS, CONQUISTAS, CONQUISTAS_GERADOR, ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS, type TipoConquista,
  type TipoNo,
} from './nomes';

export type { TipoConquista, TipoNo } from './nomes';
```

2. Trecho:

```ts
export const REQUER_SINERGIA = 15;
```

   vira:

```ts
export const REQUER_SINERGIA = 15;
/** Árvore de habilidades: custo em pontos de prestígio por posição no ramo (1 a 5); a raiz custa 1. */
export const CUSTO_NO = [2, 4, 8, 15, 30] as const;
export const CUSTO_RAIZ = 1;
export const RAIZ = 1;
```

3. Trecho:

```ts
};
export type Catalogo = { geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[]; cargos: string[] };
```

   vira:

```ts
};
export type Conquista = {
  id: number; nome: string; frase: string; condicao: string; tipo: TipoConquista;
  alvo: number | null; valor: number | null; texto: string | null; escondida: boolean;
};
/** Nó da árvore. requer = o nó anterior do ramo (a raiz, para o 1º; null na raiz). */
export type No = {
  id: number; ramo: number; posicao: number; nome: string; efeito: string; custo: number; tipo: TipoNo; valor: number;
  requer: number | null;
};
export type Catalogo = {
  geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[]; cargos: string[]; conquistas: Conquista[]; arvore: No[];
};
```

4. Trecho:

```ts
  }));
  return { geradores, melhorias, estrategias, cargos: [...CARGOS] };
```

   vira:

```ts
  }));
  const conquistas: Conquista[] = [
    ...CONQUISTAS_GERADOR.map(([nome, frase], i): Conquista => ({
      id: i + 1, nome, frase, condicao: `Ter 100 "${geradores[i].nome}"`, tipo: 'gerador', alvo: i + 1, valor: 100,
      texto: null, escondida: false,
    })),
    ...CONQUISTAS.map((c): Conquista => ({
      id: c.id, nome: c.nome, frase: c.frase, condicao: c.condicao, tipo: c.tipo, alvo: c.alvo ?? null,
      valor: c.valor ?? null, texto: c.texto ?? null, escondida: c.escondida ?? false,
    })),
  ];
  const arvore: No[] = ARVORE.map((n) => ({
    id: n.ramo * 10 + n.posicao, ramo: n.ramo, posicao: n.posicao, nome: n.nome, efeito: n.efeito,
    custo: n.ramo === 0 ? CUSTO_RAIZ : CUSTO_NO[n.posicao - 1], tipo: n.tipo, valor: n.valor,
    requer: n.ramo === 0 ? null : n.posicao === 1 ? RAIZ : n.ramo * 10 + n.posicao - 1,
  }));
  return { geradores, melhorias, estrategias, cargos: [...CARGOS], conquistas, arvore };
```

5. Trecho:

```ts
  const car = cat.cargos.map((nome, i) => `  (${i + 1}, ${txt(nome)})`);
```

   vira:

```ts
  const car = cat.cargos.map((nome, i) => `  (${i + 1}, ${txt(nome)})`);
  const con = cat.conquistas.map(
    (c) =>
      `  (${c.id}, ${txt(c.nome)}, ${txt(c.frase)}, ${txt(c.condicao)}, ${txt(c.tipo)}, ${num(c.alvo)}, ${num(c.valor)}, ${c.texto === null ? 'null' : txt(c.texto)}, ${c.escondida})`,
  );
  const nos = cat.arvore.map(
    (n) =>
      `  (${n.id}, ${n.ramo}, ${n.posicao}, ${txt(n.nome)}, ${txt(n.efeito)}, ${n.custo}, ${txt(n.tipo)}, ${num(n.valor)}, ${num(n.requer)})`,
  );
```

6. Trecho:

```ts
  const lista = (linhas: string[]) => (linhas.length ? `${linhas.join(',\n')};\n` : '');
  return `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias, estratégias e cargos. Idempotente.
```

   vira:

```ts
  const lista = (linhas: string[]) => (linhas.length ? `${linhas.join(',\n')};\n` : '');
  return `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias, estratégias, cargos, conquistas e a árvore. Idempotente.
```

7. Trecho:

```ts
create table if not exists public.idle_cat_cargo (id int primary key, nome text not null);
```

   vira:

```ts
create table if not exists public.idle_cat_cargo (id int primary key, nome text not null);
create table if not exists public.idle_cat_conquista (
  id int primary key, nome text not null, frase text not null, condicao text not null, tipo text not null,
  alvo int, valor double precision, texto text, escondida boolean not null
);
create table if not exists public.idle_cat_no (
  id int primary key, ramo int not null, posicao int not null, nome text not null, efeito text not null, custo int not null,
  tipo text not null, valor double precision not null, requer int
);
```

8. Trecho:

```ts
alter table public.idle_cat_cargo enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo to authenticated;
```

   vira:

```ts
alter table public.idle_cat_cargo enable row level security;
alter table public.idle_cat_conquista enable row level security;
alter table public.idle_cat_no enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo, public.idle_cat_conquista, public.idle_cat_no from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo, public.idle_cat_conquista, public.idle_cat_no to authenticated;
```

9. Trecho:

```ts
create policy "idle_cat_cargo_select_members" on public.idle_cat_cargo for select to authenticated using (public.is_member());
```

   vira:

```ts
create policy "idle_cat_cargo_select_members" on public.idle_cat_cargo for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_conquista_select_members" on public.idle_cat_conquista;
create policy "idle_cat_conquista_select_members" on public.idle_cat_conquista for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_no_select_members" on public.idle_cat_no;
create policy "idle_cat_no_select_members" on public.idle_cat_no for select to authenticated using (public.is_member());
```

10. Trecho:

```ts
delete from public.idle_cat_cargo where true;
```

   vira:

```ts
delete from public.idle_cat_cargo where true;
delete from public.idle_cat_conquista where true;
delete from public.idle_cat_no where true;
```

11. Trecho:

```ts
insert into public.idle_cat_cargo (id, nome) values
${lista(car)}`;
```

   vira:

```ts
insert into public.idle_cat_cargo (id, nome) values
${lista(car)}
insert into public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, texto, escondida) values
${lista(con)}
insert into public.idle_cat_no (id, ramo, posicao, nome, efeito, custo, tipo, valor, requer) values
${lista(nos)}`;
```

- [ ] **Step 5: Gerar a migração nova e listar nos dois bancos de teste**

Em `games/test/db.ts`, na lista `MIGRATIONS`, depois de `'0038_fellas_inc_gente.sql',` acrescente
`'0040_fellas_inc_catalogo_conquistas.sql',`. Em `games/dev/mockDb.ts`, depois do import `m38`, acrescente
`import m40 from '../../supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql?raw';` e troque o laço por
`for (const m of [m27, m28, m29, m30, m31, m33, m34, m35, m36, m37, m38, m40]) await db.exec(m);`.

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && ATUALIZAR_CATALOGO=0040_fellas_inc_catalogo_conquistas.sql npx vitest run idle/catalogo.test.ts`
Expected: PASS, e o arquivo `supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql` criado (confira que tem
`(283, 'gerador', 'Filial em Portugal'`, `insert into public.idle_cat_conquista` e `insert into public.idle_cat_no`).

- [ ] **Step 6: Tudo verde**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run`
Expected: PASS (a 0040 só cria e enche os catálogos; ninguém usa ainda).

- [ ] **Step 7: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts games/test/db.ts games/dev/mockDb.ts supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql && git commit -m "Fellas Inc.: catálogo das conquistas, a árvore e a Filial em Portugal (0040)"
```

---

### Task 2: A árvore e as conquistas em `economia.ts`/`oportunidades.ts`, e o K pela simulação

**Files:**
- Modify: `games/idle/economia.ts`, `games/idle/economia.test.ts`, `games/idle/oportunidades.ts`,
  `games/idle/simulacao.ts`, `games/idle/simulacao.test.ts`

**Interfaces:**
- Consome: `catalogo.arvore`, `No` (Task 1).
- Produz (`economia.ts`): `Bonus = { arvore: number[]; conquistas: number }`, `SEM_BONUS`, `Estado.bonus?: Bonus`,
  `POR_CONQUISTA = 0.01`, `K_PRESTIGIO = 1e6`, `EfeitosArvore = { producao, tetoS, caixinha, validadeS, oppExtra,
  oppBonus, contratoPreco, porContratado, contratoDias, empregoMult, inicioValuation, inicioNotebooks: number;
  inicioEra1, manterGerais: boolean }`, `efeitosArvore(cat, nos: readonly number[]): EfeitosArvore`,
  `efeitosDe(cat, s: Estado)`, `multBonus(cat, s): number`, `pontosTotais(r): number`,
  `abertura(cat, ef, gerais?) → { valuation, generators, upgrades }`, `precoContrato(cat, s, ativos): number`,
  `acumular(..., tetoS = TETO_SEGUNDOS)`, `acumularTrechos(..., tetoS = TETO_SEGUNDOS)`; `multContratos` e `fatores`
  passam a contar a árvore e as conquistas.
- Produz (`oportunidades.ts`): `Caixa = { tamanho: number; validadeS: number }`, `CAIXA_PADRAO`,
  `pendentes(uid, agoraMs, pegas, inicioSemanaMs = 0, caixa = CAIXA_PADRAO)`.
- Produz (`simulacao.ts`): `Amostra = { t, taxa, era, gerais: number[] }`, `Marcos.amostras`,
  `simular(cat?, dias?, bonus?: Bonus, gerais?: number[])`, `primeiraVenda(m, minimo): Amostra | null`,
  `gastar(cat, pontos, ja?) → { arvore: number[]; sobra: number }`,
  `volta(cat?, pontos?, dias?) → { era, primeira, segunda, arvore, gastos } | null`.

- [ ] **Step 1: Testes**

Em `games/idle/economia.test.ts`, troque o import de `./economia` por:

```ts
import {
  abertura, acumular, acumularTrechos, custoMult, efeitosArvore, era, liberada, maxCompra, multBonus, multContratos, podeComprarGerador,
  pontosTotais, precoContrato, preco, taxa, taxaPorUnidade, type Estado,
} from './economia';
```

e acrescente no fim do arquivo:

```ts
describe('árvore de habilidades e conquistas', () => {
  const comArvore = (s: Estado, arvore: number[], conquistas = 0): Estado => ({ ...s, bonus: { arvore, conquistas } });
  it('sem nó: o jogo de sempre', () => {
    expect(efeitosArvore(cat, [])).toEqual({
      producao: 1, tetoS: 8 * 3600, caixinha: 3, validadeS: 4 * 3600, oppExtra: 0, oppBonus: 1, contratoPreco: 1,
      porContratado: 0.1, contratoDias: 7, empregoMult: 1, inicioValuation: 10, inicioNotebooks: 1, inicioEra1: false,
      manterGerais: false,
    });
  });
  it('nós do mesmo tipo: produção multiplica, teto e caixinha ficam o maior, +por dia soma, preço do contrato fica o menor', () => {
    const e = efeitosArvore(cat, [1, 11, 12, 13, 14, 15, 31, 33, 35, 41, 43, 51, 55]);
    expect(e.producao).toBeCloseTo(1.05 * 1.1 * 1.25 * 1.5 * 2 * 2, 12);
    expect(e).toMatchObject({ tetoS: 24 * 3600, caixinha: 5, oppExtra: 3, contratoPreco: 0.5 });
    expect(efeitosArvore(cat, [999]).producao).toBe(1); // nó que a página não conhece não faz nada
  });
  it('produção: nós de produção × (1 + 1% por conquista); ponto guardado não conta', () => {
    const s = com([[1, 2]]);
    expect(multBonus(cat, s)).toBe(1);
    expect(taxa(cat, comArvore(s, [1, 11]))).toBeCloseTo(1 * PISO * 1.05 * 1.1, 10);
    expect(taxa(cat, comArvore(s, [1, 11], 5))).toBeCloseTo(1 * PISO * 1.05 * 1.1 * 1.05, 10);
    expect(taxaPorUnidade(cat, comArvore(s, [], 3), 1)).toBeCloseTo(0.5 * PISO * 1.03, 10);
  });
  it('Gente: Treinamento paga 15% por contratado (sem somar com a Cultura); Passe em alta dobra cada emprego, não o piso', () => {
    const s = com([[1, 1]]);
    expect(multContratos(cat, { ...comArvore(s, [1, 51, 52]), social: { contratei: 2, empregos: [] } })).toBeCloseTo(1 + 0.15 * 2 + 0.02, 12);
    expect(multContratos(cat, { ...comArvore(s, [1, 51, 52, 53, 54]), social: { contratei: 0, empregos: [1, 3] } })).toBeCloseTo(1 + 0.02 * 2 * 4, 12);
    expect(multContratos(cat, { ...comArvore(s, [1, 51, 52, 53, 54]), social: { contratei: 0, empregos: [] } })).toBeCloseTo(1.02, 12);
  });
  it('preço do contrato: 30 min de produção × 1,5 por contrato ativo × o desconto da árvore', () => {
    const s = { ...comArvore(com([[1, 2]]), [1, 51]), social: { contratei: 1, empregos: [] } };
    expect(precoContrato(cat, s, 1)).toBeCloseTo(taxa(cat, s) * 1800 * 1.5 * 0.75, 6);
  });
  it('Abrir CNPJ com o Recomeço: dinheiro, notebooks, a era 1 inteira e as gerais mantidas', () => {
    expect(abertura(cat, efeitosArvore(cat, []))).toEqual({ valuation: 10, generators: [1, ...Array(29).fill(0)], upgrades: [] });
    const a = abertura(cat, efeitosArvore(cat, [1, 21, 22, 23, 24, 25]), [1001, 1003]);
    expect(a.valuation).toBe(1e6);
    expect(a.generators.slice(0, 7)).toEqual([10, 1, 1, 1, 1, 1, 0]);
    expect(a.upgrades).toEqual([1001, 1003]);
    expect(abertura(cat, efeitosArvore(cat, [1, 21]), [1001]).upgrades).toEqual([]);
  });
  it('teto do offline: 8h, ou o que o ramo Tempo der', () => {
    expect(acumular(0, 1, 0, 30 * 3600_000, null, 12 * 3600)).toBeCloseTo(12 * 3600, 6);
    expect(acumularTrechos(0, [{ desdeMs: 0, r: 1 }], 0, 30 * 3600_000, null, 24 * 3600)).toBeCloseTo(24 * 3600, 6);
  });
  it('pontos totais: floor(cbrt(R$/s ÷ 1 milhão)), sem errar nos cubos', () => {
    for (const [r, n] of [[0, 0], [-1, 0], [NaN, 0], [999_999, 0], [1e6, 1], [7_999_999, 1], [8e6, 2], [1e9, 10], [1e12, 100]]) {
      expect(pontosTotais(r), String(r)).toBe(n);
    }
    for (let n = 1; n <= 1000; n++) {
      expect(pontosTotais(n ** 3 * 1e6)).toBe(n);
      expect(pontosTotais(n ** 3 * 1e6 * (1 - 1e-12))).toBe(n - 1);
    }
  });
});
```

Em `games/idle/simulacao.test.ts`, troque `import { simular } from './simulacao';` por:

```ts
import { catalogo } from './catalogo';
import { K_PRESTIGIO, pontosTotais } from './economia';
import { gastar, primeiraVenda, simular, volta } from './simulacao';
```

e acrescente no fim do arquivo:

```ts
// Prestígio (spec da entrega 3, seção 1.4). Medido ao planejar, com K = 1 milhão: a venda vale 1 ponto já no dia 1
// (0,7 d, era 3), 5 pontos com 2,7 d (era 4), 10 pontos com 5,5 d (11 pontos, era 5) e 15 no fim da semana.
// Vendendo com 11 e gastando 9 na árvore (Fundador, Café sem açúcar, Pé-de-meia, Caixinha maior, Soneca longa), a era 5
// chega com 2,7 d (era 3,0 d) e a era 2 com 520 s (era 895 s). Se algum número sair do alvo, NÃO mexa em PARAMETROS
// nem em K: pare e avise.
describe('ritmo do prestígio', () => {
  const m = simular(catalogo, 14);
  it('K é 1 milhão (o mesmo de idle_prestige_total na 0041)', () => expect(K_PRESTIGIO).toBe(1e6));
  it('a primeira venda que vale a pena (5 pontos) sai no dia 3 ou 4, na era 4 ou 5', () => {
    const v = primeiraVenda(m, 5);
    expect(v).not.toBeNull();
    expect(v!.t).toBeGreaterThanOrEqual(2 * DIA);
    expect(v!.t).toBeLessThan(4 * DIA);
    expect([4, 5]).toContain(v!.era);
  });
  it('5 pontos não saem antes do dia 3 (a primeira venda não compensa cedo demais)', () => {
    expect(pontosTotais(m.amostras.filter((a) => a.t < 2 * DIA).at(-1)!.taxa)).toBeLessThan(5);
  });
  it('a primeira semana rende uns 15 pontos', () => {
    expect(pontosTotais(m.amostras.find((a) => a.t >= 7 * DIA)!.taxa)).toBe(15);
  });
  it('quem gasta compra o mais barato que acelera: com 11 pontos, a raiz e o 1º de quatro ramos', () => {
    expect(gastar(catalogo, 11)).toEqual({ arvore: [1, 11, 21, 31, 41], sobra: 2 });
  });
  it('depois de vender e gastar ~10 pontos, voltar à era em que estava é mais rápido que da primeira vez', () => {
    const r = volta(catalogo, 10)!;
    expect(r).toMatchObject({ era: 5, gastos: 9 });
    expect(r.segunda).toBeLessThan(r.primeira);
    expect(r.segunda / r.primeira).toBeLessThan(0.91); // 234000 / 259200 = 0,90
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/economia.test.ts idle/simulacao.test.ts`
Expected: FAIL (`efeitosArvore`, `multBonus`, `pontosTotais`, `abertura`, `gastar`, `volta`… não existem).

- [ ] **Step 3: `games/idle/economia.ts`** — troque cada trecho, na ordem:

1. Trecho:

```ts
// Fórmulas da Fellas Inc. Iguais às do banco (0034): o banco decide, a tela só anima. Um teste de paridade
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
```

   vira:

```ts
// Fórmulas da Fellas Inc. Iguais às do banco (0034, 0038, 0041): o banco decide, a tela só anima. Um teste de paridade
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
```

2. Trecho:

```ts
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
import type { Catalogo, Estrategia, Melhoria } from './catalogo';
```

   vira:

```ts
// (games/test/idleParidade.test.ts) compara as duas com estados de exemplo.
import type { Catalogo, Estrategia, Melhoria, No } from './catalogo';
```

3. Trecho:

```ts
export const SOLO: Social = { contratei: 0, empregos: [] };
export type Estado = { generators: number[]; upgrades: number[]; strategies: number[]; social?: Social };
```

   vira:

```ts
export const SOLO: Social = { contratei: 0, empregos: [] };
/** O que é pra sempre (entrega 3): os nós da árvore que você comprou e quantas conquistas você tem (+1% cada). Sem
 *  isso (simulação, testes) = nenhum. */
export type Bonus = { arvore: number[]; conquistas: number };
export const SEM_BONUS: Bonus = { arvore: [], conquistas: 0 };
export type Estado = { generators: number[]; upgrades: number[]; strategies: number[]; social?: Social; bonus?: Bonus };
```

4. Trecho:

```ts
export const POR_EMPREGO = 0.02;
```

   vira:

```ts
export const POR_EMPREGO = 0.02;

export const POR_CONQUISTA = 0.01;
/** K do prestígio (medido em simulacao.test.ts): pontos totais = floor(cbrt(R$/s ÷ K)). Igual a idle_prestige_total. */
export const K_PRESTIGIO = 1e6;
```

5. Trecho:

```ts
  return e;
}

```

   vira:

```ts
  return e;
}

/** O que os nós comprados fazem (igual a idle_arvore_efeitos na 0041). Sem nó: o jogo de sempre. Juntando nós do
 *  mesmo tipo: produção e bônus das oportunidades multiplicam, +por dia soma, preço do contrato fica o menor e o resto
 *  fica o maior. */
export type EfeitosArvore = {
  producao: number; tetoS: number; caixinha: number; validadeS: number; oppExtra: number; oppBonus: number;
  contratoPreco: number; porContratado: number; contratoDias: number; empregoMult: number;
  inicioValuation: number; inicioNotebooks: number; inicioEra1: boolean; manterGerais: boolean;
};
const porNo = new WeakMap<Catalogo, Map<number, No>>();
export function efeitosArvore(cat: Catalogo, nos: readonly number[]): EfeitosArvore {
  let mapa = porNo.get(cat);
  if (!mapa) porNo.set(cat, (mapa = new Map(cat.arvore.map((n) => [n.id, n]))));
  const valores = (tipo: No['tipo']) => nos.map((id) => mapa.get(id)).filter((n): n is No => n?.tipo === tipo).map((n) => n.valor);
  const mult = (tipo: No['tipo']) => valores(tipo).reduce((a, v) => a * v, 1);
  const max = (tipo: No['tipo'], padrao: number) => Math.max(padrao, ...valores(tipo));
  return {
    producao: mult('producao'),
    tetoS: 3600 * max('teto', 8),
    caixinha: max('caixinha', 3),
    validadeS: 3600 * max('validade', 4),
    oppExtra: valores('opp_extra').reduce((a, v) => a + v, 0),
    oppBonus: mult('opp_bonus'),
    contratoPreco: Math.min(1, ...valores('contrato_preco')),
    porContratado: max('por_contratado', POR_CONTRATADO),
    contratoDias: max('contrato_dias', 7),
    empregoMult: max('emprego_mult', 1),
    inicioValuation: max('inicio_valuation', 10),
    inicioNotebooks: max('inicio_notebooks', 1),
    inicioEra1: valores('inicio_era1').length > 0,
    manterGerais: valores('manter_gerais').length > 0,
  };
}
export const efeitosDe = (cat: Catalogo, s: Estado) => efeitosArvore(cat, s.bonus?.arvore ?? []);

/** Árvore e conquistas (igual a idle_bonus_mult na 0041): nós de produção × (1 + 1% por conquista). */
export function multBonus(cat: Catalogo, s: Estado): number {
  return efeitosDe(cat, s).producao * (1 + POR_CONQUISTA * (s.bonus?.conquistas ?? 0));
}

/** Quantos pontos de prestígio um R$/s vale: floor(cbrt(r ÷ K)), exato nos cubos (igual a idle_prestige_total). */
export function pontosTotais(r: number): number {
  const x = Number.isFinite(r) && r > 0 ? r / K_PRESTIGIO : 0;
  let n = Math.floor(Math.cbrt(x));
  while (n > 0 && n ** 3 > x) n--;
  while ((n + 1) ** 3 <= x) n++;
  return n;
}

/** A empresa do "Abrir CNPJ" com os nós do Recomeço (igual a idle_start na 0041). `gerais`: as melhorias gerais que a
 *  venda manteve (só com "Leva a cultura junto"). */
export function abertura(cat: Catalogo, ef: EfeitosArvore, gerais: readonly number[] = []): { valuation: number; generators: number[]; upgrades: number[] } {
  const generators = Array(30).fill(0);
  generators[0] = ef.inicioNotebooks;
  if (ef.inicioEra1) for (const g of cat.geradores) if (g.era === 1) generators[g.id - 1] = Math.max(generators[g.id - 1], 1);
  return { valuation: ef.inicioValuation, generators, upgrades: ef.manterGerais ? [...gerais] : [] };
}

/** Preço do próximo contrato (igual a idle_hire_price): 30 min da produção × 1,5^(contratos ativos que você fez) × 2 com
 *  Abrir capital × o desconto da árvore. */
export function precoContrato(cat: Catalogo, s: Estado, ativos: number): number {
  const custo = estrategiasAtivas(cat, s).reduce((a, e) => a * (e.sociais.contratoCustoMult ?? 1), 1);
  return taxa(cat, s) * 1800 * 1.5 ** ativos * custo * efeitosDe(cat, s).contratoPreco;
}

```

6. Trecho:

```ts
/**
 * Multiplicador dos contratos ativos (igual a idle_social_mult na 0038):
 * 1 + efeito × (porContratado × contratei + Σ 2% × o que cada empresa paga). Ninguém te contratou = piso de freela
 * (2%, como 1 contrato). efeito = ×2 com Networking; porContratado = 10% (15% com Cultura de startup).
```

   vira:

```ts
/**
 * Multiplicador dos contratos ativos (igual a idle_social_mult na 0041):
 * 1 + efeito × (porContratado × contratei + Σ 2% × o que cada empresa paga × emprego). Ninguém te contratou = piso de
 * freela (2%, como 1 contrato). efeito = ×2 com Networking; porContratado = 10% (15% com Cultura de startup ou com o nó
 * Treinamento); emprego = ×2 com o nó Passe em alta.
```

7. Trecho:

```ts
  const soc = s.social ?? SOLO;
```

   vira:

```ts
  const soc = s.social ?? SOLO;
  const ef = efeitosDe(cat, s);
```

8. Trecho:

```ts
  const pors = est.map((e) => e.sociais.porContratado).filter((x) => x !== undefined);
  const por = pors.length ? Math.max(...pors) : POR_CONTRATADO;
```

   vira:

```ts
  const pors = est.map((e) => e.sociais.porContratado).filter((x) => x !== undefined);
  const por = Math.max(pors.length ? Math.max(...pors) : POR_CONTRATADO, ef.porContratado);
```

9. Trecho:

```ts
  const efeito = est.reduce((a, e) => a * (e.sociais.contratoEfeitoMult ?? 1), 1);
  const empregos = soc.empregos.length ? soc.empregos.reduce((a, m) => a + POR_EMPREGO * m, 0) : POR_EMPREGO;
```

   vira:

```ts
  const efeito = est.reduce((a, e) => a * (e.sociais.contratoEfeitoMult ?? 1), 1);
  const empregos = soc.empregos.length ? soc.empregos.reduce((a, m) => a + POR_EMPREGO * m * ef.empregoMult, 0) : POR_EMPREGO;
```

10. Trecho:

```ts
  global *= multContratos(cat, s);
```

   vira:

```ts
  global *= multContratos(cat, s);
  global *= multBonus(cat, s);
```

11. Trecho:

```ts

/** Valuation depois de render de `desdeMs` até `ateMs` (teto de 8h; ×5 dentro do bônus que vai até `boostAteMs`). */
export function acumular(v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: number | null): number {
  const dt = Math.min(Math.max((ateMs - desdeMs) / 1000, 0), TETO_SEGUNDOS);
```

   vira:

```ts

/** Valuation depois de render de `desdeMs` até `ateMs` (teto de `tetoS`, 8h sem a árvore; ×5 dentro do bônus que vai
 *  até `boostAteMs`). */
export function acumular(
  v: number, r: number, desdeMs: number, ateMs: number, boostAteMs: number | null, tetoS = TETO_SEGUNDOS,
): number {
  const dt = Math.min(Math.max((ateMs - desdeMs) / 1000, 0), tetoS);
```

12. Trecho:

```ts
 * Como `acumular`, mas a taxa troca no meio (um contrato vencendo): `trechos` = [{ desdeMs, r }] em ordem, o primeiro
 * começando em `desdeMs`. Igual a idle_settle na 0038: teto de 8h contado de `desdeMs`, ×5 dentro do bônus.
```

   vira:

```ts
 * Como `acumular`, mas a taxa troca no meio (um contrato vencendo): `trechos` = [{ desdeMs, r }] em ordem, o primeiro
 * começando em `desdeMs`. Igual a idle_settle na 0041: teto de `tetoS` contado de `desdeMs`, ×5 dentro do bônus.
```

13. Trecho:

```ts
  v: number, trechos: { desdeMs: number; r: number }[], desdeMs: number, ateMs: number, boostAteMs: number | null,
```

   vira:

```ts
  v: number, trechos: { desdeMs: number; r: number }[], desdeMs: number, ateMs: number, boostAteMs: number | null,
  tetoS = TETO_SEGUNDOS,
```

14. Trecho:

```ts
): number {
  const fim = Math.min(ateMs, desdeMs + TETO_SEGUNDOS * 1000);
```

   vira:

```ts
): number {
  const fim = Math.min(ateMs, desdeMs + tetoS * 1000);
```

- [ ] **Step 4: `games/idle/oportunidades.ts`** — troque o comentário e o começo de `pendentes`:

1. Trecho:

```ts
};

```

   vira:

```ts
};

/** Quantas a caixinha guarda e quanto tempo (s) uma guardada dura: 3 e 4h sem a árvore (ramo Oportunidades). */
export type Caixa = { tamanho: number; validadeS: number };
export const CAIXA_PADRAO: Caixa = { tamanho: 3, validadeS: VALIDADE_S };

```

2. Trecho:

```ts
/**
 * Caixinha (igual a idle_opp_list): as 3 mais recentes que já apareceram, têm menos de 4h e não são de antes do
 * início da semana; só depois tira as pegas. Pegar uma não puxa outra mais velha.
```

   vira:

```ts
/**
 * Caixinha (igual a idle_opp_list na 0041): as `tamanho` mais recentes que já apareceram, têm menos de `validadeS` e
 * não são de antes do início da semana; só depois tira as pegas. Pegar uma não puxa outra mais velha.
```

3. Trecho:

```ts
 */
export function pendentes(uid: string, agoraMs: number, pegas: number[], inicioSemanaMs = 0): number[] {
```

   vira:

```ts
 */
export function pendentes(uid: string, agoraMs: number, pegas: number[], inicioSemanaMs = 0, caixa: Caixa = CAIXA_PADRAO): number[] {
```

4. Trecho:

```ts
  const ate = Math.floor(agoraMs / 1000 / JANELA_S);
  const de = Math.floor((agoraMs / 1000 - VALIDADE_S) / JANELA_S);
```

   vira:

```ts
  const ate = Math.floor(agoraMs / 1000 / JANELA_S);
  const de = Math.floor((agoraMs / 1000 - caixa.validadeS) / JANELA_S);
```

5. Trecho:

```ts
  const recentes: number[] = [];
  for (let w = ate; w >= de && recentes.length < 3; w--) {
```

   vira:

```ts
  const recentes: number[] = [];
  for (let w = ate; w >= de && recentes.length < caixa.tamanho; w--) {
```

6. Trecho:

```ts
    const t = instante(uid, w);
    if (t <= agoraMs && t >= agoraMs - VALIDADE_S * 1000 && t >= inicioSemanaMs) recentes.push(w);
```

   vira:

```ts
    const t = instante(uid, w);
    if (t <= agoraMs && t >= agoraMs - caixa.validadeS * 1000 && t >= inicioSemanaMs) recentes.push(w);
```

- [ ] **Step 5: `games/idle/simulacao.ts`** — troque cada trecho, na ordem:

1. Trecho:

```ts
// sempre o que tem o melhor ganho de taxa por real.
import { catalogo as padrao, type Catalogo } from './catalogo';
import { acumular, custoMult, era, liberada, podeComprarGerador, preco, SOLO, taxa, taxaPorUnidade, type Estado } from './economia';
```

   vira:

```ts
// sempre o que tem o melhor ganho de taxa por real.
import { catalogo as padrao, type Catalogo, type No } from './catalogo';
import {
  abertura, acumular, custoMult, efeitosArvore, era, liberada, podeComprarGerador, pontosTotais, preco, SEM_BONUS, SOLO, taxa,
  taxaPorUnidade, type Bonus, type Estado,
} from './economia';
```

2. Trecho:

```ts

export type Marcos = { segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null };
```

   vira:

```ts

/** No fim de cada sessão (t em segundos de jogo): R$/s, era e as melhorias gerais que a empresa tem. */
export type Amostra = { t: number; taxa: number; era: number; gerais: number[] };
export type Marcos = {
  segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null;
  amostras: Amostra[];
};
```

3. Trecho:

```ts

export function simular(cat: Catalogo = padrao, dias = 7): Marcos {
```

   vira:

```ts

/** `bonus`: os nós da árvore e as conquistas de quem já vendeu; `gerais`: as melhorias gerais que a venda manteve. */
export function simular(cat: Catalogo = padrao, dias = 7, bonus: Bonus = SEM_BONUS, gerais: number[] = []): Marcos {
  const ef = efeitosArvore(cat, bonus.arvore);
  const ini = abertura(cat, ef, gerais);
```

4. Trecho:

```ts
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1], social: SOLO };
  s.generators[0] = 1;
  let v = 10;
```

   vira:

```ts
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: ini.generators, upgrades: ini.upgrades, strategies: [-1, -1, -1, -1], social: SOLO, bonus };
  let v = ini.valuation;
```

5. Trecho:

```ts
  let relogio = 0;
  const marcos: Marcos = { segundaNotebook: null, era: { 2: null, 3: null, 4: null, 5: null }, compras1h: 0, gerador30: null };
```

   vira:

```ts
  let relogio = 0;
  const marcos: Marcos = { segundaNotebook: null, era: { 2: null, 3: null, 4: null, 5: null }, compras1h: 0, gerador30: null, amostras: [] };
```

6. Trecho:

```ts
  const avancar = (ate: number) => {
    v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null);
```

   vira:

```ts
  const avancar = (ate: number) => {
    v = acumular(v, taxa(cat, s), relogio * 1000, ate * 1000, null, ef.tetoS);
```

7. Trecho:

```ts
    if (ini > 0) {
      const pegar = Math.min(3, 10 - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 900;
```

   vira:

```ts
    if (ini > 0) {
      const pegar = Math.min(ef.caixinha, 10 + ef.oppExtra - oppHoje);
      for (let i = 0; i < pegar; i++) v += taxa(cat, s) * 900 * ef.oppBonus;
```

8. Trecho:

```ts
      comprar();
    }
```

   vira:

```ts
      comprar();
    }
    const gerais = s.upgrades.filter((id) => cat.melhorias.find((m) => m.id === id)?.tipo === 'geral');
    marcos.amostras.push({ t: fim, taxa: taxa(cat, s), era: era(cat, s.generators), gerais });
```

9. Trecho:

```ts
  return marcos;
}

```

   vira:

```ts
  return marcos;
}

/** A primeira vez (fim de sessão) em que vender a startup rende pelo menos `minimo` pontos. */
export function primeiraVenda(m: Marcos, minimo: number): Amostra | null {
  return m.amostras.find((a) => pontosTotais(a.taxa) >= minimo) ?? null;
}

// o que não acelera o jogador sozinho da simulação: o ramo Gente e a validade das oportunidades (ele pega na hora)
const NAO_ACELERA: readonly No['tipo'][] = ['contrato_preco', 'por_contratado', 'contrato_dias', 'emprego_mult', 'validade'];

/** O jogador gasta os pontos na árvore: sempre o nó mais barato já liberado que acelera (empate: o de id menor). */
export function gastar(cat: Catalogo, pontos: number, ja: readonly number[] = []): { arvore: number[]; sobra: number } {
  const arvore = [...ja];
  let sobra = pontos;
  for (;;) {
    const opcoes = cat.arvore.filter(
      (n) => !arvore.includes(n.id) && (n.requer === null || arvore.includes(n.requer)) && !NAO_ACELERA.includes(n.tipo) && n.custo <= sobra,
    );
    if (!opcoes.length) return { arvore, sobra };
    const n = opcoes.reduce((a, b) => (b.custo < a.custo || (b.custo === a.custo && b.id < a.id) ? b : a));
    arvore.push(n.id);
    sobra -= n.custo;
  }
}

/** O jogador que vende: joga até a venda valer `pontos`, vende, gasta tudo na árvore (`gastar`) e recomeça (sem contar
 *  as conquistas, que só ajudariam). Quanto tempo levou pra chegar na era em que estava da primeira vez e depois de
 *  vender (Infinity = não chegou em `dias`). null = a venda nunca chegou a `pontos`. */
export function volta(
  cat: Catalogo = padrao, pontos = 10, dias = 14,
): { era: number; primeira: number; segunda: number; arvore: number[]; gastos: number } | null {
  const m1 = simular(cat, dias);
  const venda = primeiraVenda(m1, pontos);
  if (!venda || venda.era < 2) return null;
  const ganhos = pontosTotais(venda.taxa);
  const { arvore, sobra } = gastar(cat, ganhos);
  const m2 = simular(cat, dias, { arvore, conquistas: 0 }, venda.gerais);
  return { era: venda.era, primeira: m1.era[venda.era]!, segunda: m2.era[venda.era] ?? Infinity, arvore, gastos: ganhos - sobra };
}

```

- [ ] **Step 6: Rodar e ver passar (os marcos antigos não mudam: sem nó, os efeitos são os de sempre)**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run idle/`
Expected: PASS. Se "ritmo da semana" ou "ritmo do prestígio" falhar, NÃO mexa em `PARAMETROS` nem em `K_PRESTIGIO`:
pare e avise.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/economia.ts games/idle/economia.test.ts games/idle/oportunidades.ts games/idle/simulacao.ts games/idle/simulacao.test.ts && git commit -m "Fellas Inc.: árvore e conquistas na conta (economia.ts) e o K pela simulação"
```

---

### Task 3: A árvore e as conquistas nas contas do banco (0041, parte 1)

**Files:**
- Create: `supabase/migrations/0041_fellas_inc_prestigio.sql` (começo; as Tasks 4, 5 e 6 acrescentam no fim)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts`, `games/test/idleParidade.test.ts`

**Interfaces:**
- Consome: `efeitosArvore`, `taxa`, `acumularTrechos`, `precoContrato`, `pontosTotais` (Task 2); `pendentes` com `Caixa`
  (Task 2); `idle_employee_mult` (0038); `idle_cat_no` (Task 1).
- Produz: colunas novas de `idle_state` (`prestige_earned int`, `prestige_spent int`, `prestige_count int`,
  `best_rate double precision`, `upg_total int`, `opp_total int`, `hire_total int`, `hired_total int`,
  `est_usadas int[]`, `opp_recent timestamptz[]`, todas `not null` com default); tabelas `idle_conquistas (user_id,
  conquista_id, ganhou_em)` e `idle_arvore (user_id, no_id, comprado_em)`; funções internas
  `idle_est_codigos(smallint[]) → int[]`, `idle_arv(uuid, text, text, double precision) → double precision` (valor dos
  nós de um tipo: `'mult'`, `'max'`, `'min'` ou `'soma'`, com padrão), `idle_arvore_efeitos(uuid) → jsonb` (as chaves de
  `EfeitosArvore`), `idle_bonus_mult(idle_state)`, `idle_prestige_total(double precision) → int`; trocadas:
  `idle_rate_at`, `idle_social_mult`, `idle_settle` (teto da árvore), `idle_opp_list` (caixinha e validade),
  `idle_opp_cap` (+ por dia), `idle_hire_price` (desconto).

- [ ] **Step 1: Testes de paridade (`games/test/idleParidade.test.ts`)**

Troque o import de `../idle/economia` por:

```ts
import {
  acumular, acumularTrechos, custoMult, efeitosArvore, maxCompra, pontosTotais, precoContrato, preco, taxa, type Estado,
} from '../idle/economia';
import { pendentes } from '../idle/oportunidades';
```

Logo depois de `const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;`, acrescente:

```ts
/** A fica com exatamente n conquistas (ids 1..n; a conta só olha quantas). */
async function conquistas(n: number) {
  await q('delete from public.idle_conquistas where true');
  if (n) await q('insert into public.idle_conquistas (user_id, conquista_id) select $1, g from generate_series(1, $2) g', [A, n]);
}
/** A fica com exatamente esses nós da árvore (a conta não confere a ordem dos ramos: isso é do idle_buy_node). */
async function arvore(nos: number[]) {
  await q('delete from public.idle_arvore where true');
  for (const n of nos) await q('insert into public.idle_arvore (user_id, no_id) values ($1, $2)', [A, n]);
}
/** Um pedaço sorteado da árvore. */
const nosAoAcaso = (r: () => number) => catalogo.arvore.filter(() => r() < 0.4).map((n) => n.id);
```

No fim do `describe('paridade', ...)` (antes do `});` final), acrescente:

```ts
  it('o que a árvore faz é igual no banco e em economia.ts (cada nó sozinho e pedaços sorteados)', async () => {
    const r = rng(3);
    const casos = [[], ...catalogo.arvore.map((n) => [n.id]), ...Array.from({ length: 30 }, () => nosAoAcaso(r))];
    for (const nos of casos) {
      await arvore(nos);
      const [{ e }] = await q<{ e: Record<string, number | boolean> }>('select public.idle_arvore_efeitos($1) as e', [A]);
      const ts = efeitosArvore(catalogo, nos);
      expect(Object.keys(e).sort(), String(nos)).toEqual(Object.keys(ts).sort());
      for (const [k, v] of Object.entries(ts)) {
        if (typeof v === 'boolean') expect(e[k], `${nos} ${k}`).toBe(v);
        else expect(rel(e[k] as number, v), `${nos} ${k}`).toBeLessThan(1e-12);
      }
    }
    await arvore([]);
  });
  it('taxa com a árvore, as conquistas e os contratos (Treinamento e Passe em alta)', async () => {
    const r = rng(5);
    for (const s of estados(30)) {
      const bonus = { arvore: nosAoAcaso(r), conquistas: Math.floor(r() * 60) };
      await preparar(s);
      await arvore(bonus.arvore);
      await conquistas(bonus.conquistas);
      const contratei = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      const chefes = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      for (const u of contratei) await contrato(A, u);
      for (const u of chefes) await contrato(u, A);
      const social = { contratei: contratei.length, empregos: chefes.map((u) => (u === C ? 3 : 1)) };
      const [db] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
      expect(rel(db.r, taxa(catalogo, { ...s, bonus, social }))).toBeLessThan(1e-9);
    }
    await arvore([]);
    await conquistas(0);
  });
  it('fechar a conta com a árvore: teto do ramo Tempo, vencimento no meio e bônus', async () => {
    const T0 = Date.parse('2026-10-12T10:00:00Z');
    const iso = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;
    const s = estados(4)[3];
    for (const nos of [[], [1, 41], [1, 41, 42, 43], [1, 11, 41, 42, 43, 44, 45]]) {
      const bonus = { arvore: nos, conquistas: 9 };
      const tetoS = efeitosArvore(catalogo, nos).tetoS;
      await preparar(s, 'valuation, settled_at, boost_until', [1000, new Date(T0).toISOString(), new Date(T0 + 200_000).toISOString()]);
      await arvore(nos);
      await conquistas(bonus.conquistas);
      await contrato(C, A, iso(T0 - 86400_000), iso(T0 + 300_000)); // C (Cultura) contratou A: vence 300 s depois
      const trechos = [
        { desdeMs: T0, r: taxa(catalogo, { ...s, bonus, social: { contratei: 0, empregos: [3] } }) },
        { desdeMs: T0 + 300_000, r: taxa(catalogo, { ...s, bonus, social: { contratei: 0, empregos: [] } }) },
      ];
      for (const ate of [T0 + 50_000, T0 + 1000_000, T0 + 10 * 3600_000, T0 + 30 * 3600_000, T0 + 60 * 3600_000]) {
        const [db] = await q<{ v: number }>(
          `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
          [A, new Date(ate).toISOString()],
        );
        expect(rel(db.v, acumularTrechos(1000, trechos, T0, ate, T0 + 200_000, tetoS)), `${nos} ${ate}`).toBeLessThan(1e-9);
      }
    }
    await q('delete from public.idle_contracts where true');
    await arvore([]);
    await conquistas(0);
  });
  it('caixinha e validade com a árvore: banco e oportunidades.ts concordam', async () => {
    const s = estados(1)[0];
    await preparar(s);
    const [{ agora, semana }] = await q<{ agora: string; semana: string }>(
      `select now()::text as agora, (public.games_week_start()::timestamp at time zone 'America/Sao_Paulo')::text as semana`,
    );
    for (const nos of [[], [1, 31], [1, 31, 32], [1, 31, 32, 33, 34, 35]]) {
      await arvore(nos);
      const ef = efeitosArvore(catalogo, nos);
      for (const horas of [0, 3, 5, 7]) {
        const ts = Date.parse(agora) + horas * 3600_000;
        const [db] = await q<{ l: string[] }>(
          'select public.idle_opp_list(s, $2::timestamptz) as l from public.idle_state s where user_id = $1',
          [A, new Date(ts).toISOString()],
        );
        expect(db.l.map(Number), `${nos} +${horas}h`).toEqual(
          pendentes(A, ts, [], Date.parse(semana), { tamanho: ef.caixinha, validadeS: ef.validadeS }),
        );
      }
    }
    await arvore([]);
  });
  it('preço do contrato com a árvore (e Abrir capital)', async () => {
    const r = rng(8);
    for (const s of estados(10)) {
      const nos = nosAoAcaso(r);
      await preparar(s);
      await arvore(nos);
      const contratei = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      for (const u of contratei) await contrato(A, u);
      const [db] = await q<{ p: number }>('select public.idle_hire_price(s) as p from public.idle_state s where user_id = $1', [A]);
      const est = { ...s, bonus: { arvore: nos, conquistas: 0 }, social: { contratei: contratei.length, empregos: [] } };
      expect(rel(db.p, precoContrato(catalogo, est, contratei.length))).toBeLessThan(1e-9);
    }
    await arvore([]);
  });
  it('pontos de prestígio iguais no banco e em economia.ts, inclusive em cima dos cubos', async () => {
    const r = rng(11);
    const valores = [0, -1, 1, 999_999, 1e6, 8e6, 27e6, 1e9, 1e12];
    for (let i = 0; i < 150; i++) valores.push(10 ** (r() * 16));
    for (let n = 1; n <= 150; n++) {
      const cubo = n ** 3 * 1e6;
      valores.push(cubo, cubo * (1 - 2 ** -52), cubo * (1 + 2 ** -52));
    }
    for (const v of valores) {
      const [db] = await q<{ n: number }>('select public.idle_prestige_total($1) as n', [v]);
      expect(db.n, String(v)).toBe(pontosTotais(v));
    }
  });
```

Em `games/test/db.ts`, na lista `MIGRATIONS`, depois de `'0040_fellas_inc_catalogo_conquistas.sql',` acrescente
`'0041_fellas_inc_prestigio.sql',`. Em `games/dev/mockDb.ts`, depois do import `m40`, acrescente
`import m41 from '../../supabase/migrations/0041_fellas_inc_prestigio.sql?raw';` e troque o laço por
`for (const m of [m27, m28, m29, m30, m31, m33, m34, m35, m36, m37, m38, m40, m41]) await db.exec(m);`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/idleParidade.test.ts`
Expected: FAIL (o arquivo `0041_fellas_inc_prestigio.sql` não existe).

- [ ] **Step 3: Criar `supabase/migrations/0041_fellas_inc_prestigio.sql`** com exatamente:

```sql
-- fellasapp: Fellas Inc., entrega 3 (prestígio e conquistas). "Vender a startup" troca a empresa por pontos de
-- prestígio, que se gastam numa árvore de habilidades (os nós comprados é que dão efeito, pra sempre); as conquistas
-- dão +1% cada, pra sempre. A Fellas Inc. continua sem reset (0036): só o jogador zera a própria empresa, vendendo;
-- nada aqui apaga estado, contrato, ponto, nó ou conquista. As funções que mudam são trocadas com create or replace a
-- partir da versão mais nova (0034, 0036 ou 0038, já em produção). As contas existem iguais em games/idle/economia.ts
-- e oportunidades.ts (teste de paridade). Depende da 0040 (catálogo das conquistas e da árvore). Não toca nos créditos
-- do cassino. Idempotente.

-- ===== o que fica pra sempre (a venda não zera) =====

alter table public.idle_state
  add column if not exists prestige_earned int not null default 0 check (prestige_earned >= 0),
  add column if not exists prestige_spent  int not null default 0 check (prestige_spent >= 0),
  add column if not exists prestige_count  int not null default 0,
  add column if not exists best_rate       double precision not null default 0,
  add column if not exists upg_total       int not null default 0,
  add column if not exists opp_total       int not null default 0,
  add column if not exists hire_total      int not null default 0,
  add column if not exists hired_total     int not null default 0,
  add column if not exists est_usadas      int[] not null default '{}',
  add column if not exists opp_recent      timestamptz[] not null default '{}';

-- sem chave estrangeira pro catálogo: a migração do catálogo apaga e regrava idle_cat_conquista
create table if not exists public.idle_conquistas (
  user_id      uuid not null references public.profiles (id) on delete cascade,
  conquista_id int not null,
  ganhou_em    timestamptz not null default now(),
  primary key (user_id, conquista_id)
);

alter table public.idle_conquistas enable row level security;
revoke all on public.idle_conquistas from anon, authenticated;
grant select on public.idle_conquistas to authenticated;
drop policy if exists "idle_conquistas_select_members" on public.idle_conquistas;
create policy "idle_conquistas_select_members" on public.idle_conquistas for select to authenticated using (public.is_member());

-- os nós da árvore que cada um comprou (sem chave estrangeira pro catálogo, pelo mesmo motivo)
create table if not exists public.idle_arvore (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  no_id       int not null,
  comprado_em timestamptz not null default now(),
  primary key (user_id, no_id)
);

alter table public.idle_arvore enable row level security;
revoke all on public.idle_arvore from anon, authenticated;
grant select on public.idle_arvore to authenticated;
drop policy if exists "idle_arvore_select_members" on public.idle_arvore;
create policy "idle_arvore_select_members" on public.idle_arvore for select to authenticated using (public.is_member());

-- ===== a conta com a árvore e as conquistas =====

-- as estratégias escolhidas agora, como códigos era·10 + opção (a 2 da era 4 = 42)
create or replace function public.idle_est_codigos(p smallint[])
returns int[] language sql immutable as $$
  select coalesce(array_agg((k + 1) * 10 + p[k] order by k), '{}') from generate_subscripts(p, 1) k where p[k] >= 0
$$;

-- o valor dos nós de um tipo que alguém comprou, juntados por p_agg ('mult', 'max', 'min' ou 'soma'); sem nó desse
-- tipo, p_padrao (igual a economia.ts efeitosArvore)
create or replace function public.idle_arv(u uuid, p_tipo text, p_agg text, p_padrao double precision)
returns double precision language sql stable set search_path = public as $$
  select coalesce(case p_agg
                    when 'mult' then exp(sum(ln(c.valor)))
                    when 'max' then max(c.valor)
                    when 'min' then min(c.valor)
                    else sum(c.valor)
                  end, p_padrao)
    from public.idle_arvore a
    join public.idle_cat_no c on c.id = a.no_id
   where a.user_id = u and c.tipo = p_tipo
$$;

-- tudo que a árvore de alguém faz, com os nomes de economia.ts efeitosArvore (teste de paridade)
create or replace function public.idle_arvore_efeitos(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'producao', public.idle_arv(u, 'producao', 'mult', 1),
    'tetoS', 3600 * public.idle_arv(u, 'teto', 'max', 8),
    'caixinha', public.idle_arv(u, 'caixinha', 'max', 3),
    'validadeS', 3600 * public.idle_arv(u, 'validade', 'max', 4),
    'oppExtra', public.idle_arv(u, 'opp_extra', 'soma', 0),
    'oppBonus', public.idle_arv(u, 'opp_bonus', 'mult', 1),
    'contratoPreco', least(1, public.idle_arv(u, 'contrato_preco', 'min', 1)),
    'porContratado', greatest(0.1, public.idle_arv(u, 'por_contratado', 'max', 0.1)),
    'contratoDias', greatest(7, public.idle_arv(u, 'contrato_dias', 'max', 7)),
    'empregoMult', greatest(1, public.idle_arv(u, 'emprego_mult', 'max', 1)),
    'inicioValuation', greatest(10, public.idle_arv(u, 'inicio_valuation', 'max', 10)),
    'inicioNotebooks', greatest(1, public.idle_arv(u, 'inicio_notebooks', 'max', 1)),
    'inicioEra1', public.idle_arv(u, 'inicio_era1', 'max', 0) > 0,
    'manterGerais', public.idle_arv(u, 'manter_gerais', 'max', 0) > 0)
$$;

-- nós de produção da árvore × (1 + 1% por conquista) (igual a economia.ts multBonus)
create or replace function public.idle_bonus_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_arv(s.user_id, 'producao', 'mult', 1)
       * (1 + 0.01::double precision * (select count(*) from public.idle_conquistas c where c.user_id = s.user_id))
$$;

-- produção por segundo em t (a da 0038 × árvore e conquistas; igual a economia.ts taxa)
create or replace function public.idle_rate_at(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.* from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  ), gen as (
    select c.renda * s.generators[c.id]
         * power(2::double precision, (select count(*) from public.idle_cat_upg u
                                        where u.tipo = 'gerador' and u.gerador = c.id and u.id = any (s.upgrades)))
         * (1 + coalesce((select sum(u.por_unidade * s.generators[u.fonte]) from public.idle_cat_upg u
                           where u.tipo = 'sinergia' and u.alvo = c.id and u.id = any (s.upgrades)), 0))
         * coalesce((select exp(sum(ln(e.gen_mult))) from est e where c.id between e.gen_de and e.gen_ate), 1) as v
      from public.idle_cat_gen c
  )
  select coalesce((select sum(v) from gen), 0)
       * coalesce((select exp(sum(ln(u.mult))) from public.idle_cat_upg u where u.tipo = 'geral' and u.id = any (s.upgrades)), 1)
       * coalesce((select exp(sum(ln(e.prod_mult))) from est e), 1)
       * (1 + coalesce((select sum(e.por_gerador_distinto) from est e), 0)
            * (select count(*) from public.idle_cat_gen c where s.generators[c.id] > 0))
       * public.idle_social_mult(s, t)
       * public.idle_bonus_mult(s)
$$;

-- pontos de prestígio que um R$/s vale: floor(cbrt(r / K)), K = 1e6 (games/idle/simulacao.test.ts). Inteiro exato
-- nos cubos (sem erro de arredondamento do cbrt), igual a economia.ts pontosTotais.
create or replace function public.idle_prestige_total(r double precision)
returns int language plpgsql immutable as $$
declare
  x double precision := case when r > 0 then r / 1e6 else 0 end;
  n int;
begin
  n := floor(cbrt(x))::int;
  while n > 0 and n::double precision ^ 3 > x loop
    n := n - 1;
  end loop;
  while (n + 1)::double precision ^ 3 <= x loop
    n := n + 1;
  end loop;
  return n;
end;
$$;

-- multiplicador dos contratos ativos em t (o da 0038 + a árvore: o nó Treinamento paga 15% por contratado, como a
-- Cultura de startup, sem somar; o nó Passe em alta dobra o que cada empresa que te contratou rende pra você; o piso
-- de freela não muda). Igual a economia.ts multContratos.
create or replace function public.idle_social_mult(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.sociais from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  )
  select 1 + coalesce((select exp(sum(ln((x.sociais ->> 'contratoEfeitoMult')::double precision))) from est x
                        where (x.sociais ->> 'contratoEfeitoMult') is not null), 1)
           * (greatest(coalesce((select max((x.sociais ->> 'porContratado')::double precision) from est x
                                  where (x.sociais ->> 'porContratado') is not null), 0.1),
                       public.idle_arv(s.user_id, 'por_contratado', 'max', 0.1))
                * (select count(*) from public.idle_contracts c
                    where c.employer_id = s.user_id and c.created_at <= t and c.ends_at > t)
              + coalesce((select sum(0.02 * public.idle_employee_mult(c.employer_id)
                                     * public.idle_arv(s.user_id, 'emprego_mult', 'max', 1))
                            from public.idle_contracts c
                           where c.employee_id = s.user_id and c.created_at <= t and c.ends_at > t), 0.02))
$$;

-- fecha a conta até ts (a da 0038), com o teto do offline da árvore (8h sem o ramo Tempo; igual a economia.ts
-- acumularTrechos)
create or replace function public.idle_settle(s public.idle_state, ts timestamptz default now())
returns public.idle_state language plpgsql stable set search_path = public as $$
declare
  v_fim   timestamptz;
  v_a     timestamptz;
  v_b     timestamptz;
  v_rate  double precision;
  v_boost double precision;
begin
  if not s.started or ts <= s.settled_at then
    s.settled_at := greatest(s.settled_at, ts);
    return s;
  end if;
  v_fim := least(ts, s.settled_at + make_interval(secs => 3600 * public.idle_arv(s.user_id, 'teto', 'max', 8)));
  v_a := s.settled_at;
  for v_b in
    select x from (select c.ends_at as x from public.idle_contracts c
                    where (c.employer_id = s.user_id or c.employee_id = s.user_id)
                      and c.ends_at > s.settled_at and c.ends_at < v_fim
                   union
                   select v_fim) y
     order by x
  loop
    v_rate := public.idle_rate_at(s, v_a);
    v_boost := 0;
    if s.boost_until is not null and s.boost_until > v_a then
      v_boost := greatest(0, extract(epoch from least(v_b, s.boost_until) - v_a));
    end if;
    s.valuation := s.valuation + v_rate * extract(epoch from v_b - v_a) + v_rate * 4 * v_boost;
    v_a := v_b;
  end loop;
  s.settled_at := ts;
  return s;
end;
$$;

-- caixinha (a da 0034) com a árvore: guarda as `caixinha` mais recentes (3 sem o ramo Oportunidades) que têm menos
-- de `validade` (4h) e são desta semana; só depois tira as pegas (igual a oportunidades.ts pendentes)
create or replace function public.idle_opp_list(s public.idle_state, ts timestamptz default now())
returns bigint[] language sql stable set search_path = public as $$
  with v as (
    select make_interval(secs => 3600 * public.idle_arv(s.user_id, 'validade', 'max', 4)) as validade
  )
  select coalesce(array_agg(w order by w desc), '{}') from (
    select w
      from v, generate_series(floor(extract(epoch from ts - v.validade) / 600)::bigint,
                              floor(extract(epoch from ts) / 600)::bigint) w
     where public.idle_opp_at(s.user_id, w) <= ts
       and public.idle_opp_at(s.user_id, w) >= ts - v.validade
       and public.idle_opp_at(s.user_id, w) >= (s.week_start::timestamp at time zone 'America/Sao_Paulo')
     order by w desc
     limit public.idle_arv(s.user_id, 'caixinha', 'max', 3)::int
  ) x
  where not coalesce(w = any (s.opp_claimed), false)
$$;

-- limite de oportunidades por dia (o da 0034) + o nó Faro de negócio
create or replace function public.idle_opp_cap(s public.idle_state)
returns int language sql stable set search_path = public as $$
  select 10 + coalesce((select sum(e.opp_extra)::int from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 0)
            + public.idle_arv(s.user_id, 'opp_extra', 'soma', 0)::int
$$;

-- preço do próximo contrato (o da 0038) × o desconto da árvore (igual a economia.ts precoContrato)
create or replace function public.idle_hire_price(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate(s) * 1800
       * power(1.5::double precision, (select count(*) from public.idle_contracts c
                                        where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()))
       * coalesce((select exp(sum(ln((e.sociais ->> 'contratoCustoMult')::double precision)))
                     from public.idle_cat_est e
                    where e.opcao = s.strategies[e.era - 1] and (e.sociais ->> 'contratoCustoMult') is not null), 1)
       * least(1, public.idle_arv(s.user_id, 'contrato_preco', 'min', 1))
$$;

revoke all on function public.idle_est_codigos(smallint[]) from public, anon, authenticated;
revoke all on function public.idle_arv(uuid, text, text, double precision) from public, anon, authenticated;
revoke all on function public.idle_arvore_efeitos(uuid) from public, anon, authenticated;
revoke all on function public.idle_bonus_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_social_mult(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_list(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_opp_cap(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_hire_price(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_prestige_total(double precision) from public, anon, authenticated;
```

- [ ] **Step 4: Rodar e ver passar; nada antigo muda (ninguém tem nó nem conquista ainda: tudo fica no padrão)**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/ && npx tsc --noEmit`
Expected: PASS (paridade nova e todos os testes de banco de antes).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add supabase/migrations/0041_fellas_inc_prestigio.sql games/test/db.ts games/dev/mockDb.ts games/test/idleParidade.test.ts && git commit -m "Fellas Inc.: árvore e conquistas nas contas do banco (0041, parte 1)"
```

---

### Task 4: Conquistas no banco: conferir, gravar e devolver (0041, parte 2)

**Files:**
- Modify: `supabase/migrations/0041_fellas_inc_prestigio.sql` (acrescentar no fim), `games/test/db.ts`,
  `games/test/idle.test.ts`, `games/test/idleGente.test.ts`, `games/test/idleParidade.test.ts`
- Create: `games/test/idleConquistas.test.ts`

**Interfaces:**
- Consome: Task 3; `pendentes` (`oportunidades.ts`); `catalogo.conquistas` (Task 1).
- Produz: `idle_ganhar(p_user uuid, p_tipo text, p_valor double precision default null, p_texto text default null)`,
  `idle_madrugada(ts timestamptz default now()) → boolean`, `idle_check_conquistas(p_user uuid) → int[]`, `idle_save`
  que confere as conquistas e guarda o recorde, e o estado de toda RPC com os campos novos: `bonus: { arvore: int[],
  conquistas }`, `pontos` (livres), `pontos_vida`, `vendas`, `recorde`, `pontos_venda`, `conquistas: [{ id, em }]`,
  `novas: int[]`, `descobertas: int[]`. `idle_open` (3h06), `idle_buy` (`upg_total`, jaula), `idle_claim_opportunity`
  (bônus da árvore, `opp_total`, `opp_recent`), `idle_hire` (10 dias com o nó, `hire_total`, `hired_total`,
  limaumdoc). `freshDb({ conquistas: false })`.

- [ ] **Step 1: Testes**

Crie `games/test/idleConquistas.test.ts`:

```ts
// Banco da entrega 3 da Fellas Inc.: conquistas (de estado, de evento e as escondidas), com as migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { pendentes } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const D = '00000000-0000-0000-0000-00000000000d';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Estado = {
  user_id: string; week_start: string; valuation: number; rate: number; server_now: string;
  bonus: { arvore: number[]; conquistas: number }; conquistas: { id: number; em: string }[]; novas: number[]; descobertas: number[];
};

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B]) await t.member(u);
  await t.member(D, { username: 'LimaUmDoc' });
  await t.as(A);
});

const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const abrirJogo = () => t.rpc<Estado>('idle_open');
const mudar = (u: string, set: string, p: unknown[] = []) => q(`update public.idle_state set ${set} where user_id = $1`, [u, ...p]);
const ids = (s: Estado) => s.conquistas.map((c) => c.id);
const pegar = (w: number) => t.rpc<Estado>('idle_claim_opportunity', { p_window: w });
const inicioSemana = (s: Estado) => Date.parse(s.week_start + 'T00:00:00-03:00');

describe('conquistas de estado', () => {
  it('100 de um gerador e R$ 1/s: grava na hora, volta em novas uma vez só e o +1% vale dali pra frente', async () => {
    await abrir(A);
    await mudar(A, 'generators[1] = 100, settled_at = settled_at - interval \'1000 seconds\'');
    const base = 0.5 * 100 * 1.02;
    const s = await abrirJogo();
    expect(s.novas).toEqual([1, 31]);
    expect(ids(s)).toEqual([1, 31]);
    expect(s.bonus).toEqual({ arvore: [], conquistas: 2 });
    expect(s.rate).toBeCloseTo(base * 1.02, 9);
    expect((s.valuation - 10) / (base * 1000)).toBeCloseTo(1, 3); // as 1000 s de antes rendem sem o bônus
    const outra = await abrirJogo();
    expect(outra.novas).toEqual([]);
    expect(ids(outra)).toEqual([1, 31]);
  });
  it('contadores: 10 melhorias, a 1ª oportunidade, contratar e ser contratado', async () => {
    await abrir(A, B);
    await mudar(A, 'upg_total = 9, valuation = 1e6');
    expect((await t.rpc<Estado>('idle_buy', { p_kind: 'melhoria', p_id: 11, p_qty: 1 })).novas).toContain(44);
    const s = await abrirJogo();
    const w = pendentes(A, Date.parse(s.server_now), [], inicioSemana(s))[0];
    expect((await pegar(w)).novas).toContain(47);
    expect((await t.rpc<Estado>('idle_hire', { p_user: B })).novas).toContain(55);
    await t.as(B);
    expect(ids(await abrirJogo())).toContain(58);
  });
  it('6-7 (exatamente 67), Fez o L (50 estagiários) e Guiana Brasileira (a Filial em Portugal)', async () => {
    await abrir(A);
    await mudar(A, 'generators[2] = 66');
    expect(ids(await abrirJogo())).not.toContain(101);
    await mudar(A, 'generators[2] = 67, generators[7] = 50, upgrades = \'{283}\'');
    expect((await abrirJogo()).novas).toEqual(expect.arrayContaining([101, 106, 107]));
  });
  it('estratégias: as 3 de uma era (uma por empresa) e todas as ligadas', async () => {
    await abrir(A);
    await mudar(A, 'generators[7] = 1, est_usadas = \'{20,21}\'');
    expect((await t.rpc<Estado>('idle_pick_strategy', { p_era: 2, p_opcao: 2 })).novas).toContain(61);
    const ligadas = catalogo.estrategias.filter((e) => e.ativa).map((e) => e.era * 10 + e.opcao);
    await mudar(A, 'generators[25] = 1, strategies = \'{0,0,0,-1}\', est_usadas = $2', [ligadas.filter((c) => c !== 52)]);
    expect(ids(await abrirJogo())).not.toContain(62);
    expect((await t.rpc<Estado>('idle_pick_strategy', { p_era: 5, p_opcao: 2 })).novas).toContain(62);
  });
  it('Farmou aura: 1º no placar em R$/s; sozinho ou empatado não conta', async () => {
    await abrir(A);
    expect(ids(await abrirJogo())).not.toContain(102); // sozinho
    await abrir(B);
    expect(ids(await abrirJogo())).not.toContain(102); // empatado com B
    await mudar(A, 'generators[2] = 5');
    expect((await abrirJogo()).novas).toContain(102);
    await t.as(B);
    expect(ids(await abrirJogo())).not.toContain(102);
  });
  it('Brainrot: 3 oportunidades em menos de 1 minuto; espaçadas não', async () => {
    await abrir(A);
    const s = await abrirJogo();
    const ws = pendentes(A, Date.parse(s.server_now), [], inicioSemana(s));
    expect(ws).toHaveLength(3);
    await mudar(A, `opp_recent = array[now() - interval '5 minutes', now() - interval '4 minutes']`);
    expect((await pegar(ws[0])).novas).not.toContain(111);
    await pegar(ws[1]);
    expect((await pegar(ws[2])).novas).toContain(111);
  });
});

describe('conquistas de evento', () => {
  it('Tá saindo da jaula: Máx que leva 100 ou mais; 10 de uma vez ou Máx menor não', async () => {
    await abrir(A);
    await mudar(A, 'valuation = 1e6');
    await t.rpc('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 10 });
    expect((await t.rpc<Estado>('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 0 })).novas).not.toContain(105); // ~54
    await mudar(A, 'valuation = 1e14');
    expect((await t.rpc<Estado>('idle_buy', { p_kind: 'gerador', p_id: 1, p_qty: 0 })).novas).toContain(105);
  });
  it('3h06: só entre 3h e 4h de Brasília', async () => {
    const hora = async (ts: string) => (await q<{ v: boolean }>('select public.idle_madrugada($1::timestamptz) as v', [ts]))[0].v;
    expect(await hora('2026-10-12 06:00:00+00')).toBe(true); // 03:00 em Brasília
    expect(await hora('2026-10-12 06:59:59+00')).toBe(true);
    expect(await hora('2026-10-12 07:00:00+00')).toBe(false);
    expect(await hora('2026-10-12 05:59:59+00')).toBe(false);
    expect(ids(await abrirJogo())).not.toContain(108);
    // agora é 3h da manhã
    await t.db.exec(`create or replace function public.idle_madrugada(ts timestamptz default now())
                     returns boolean language sql stable as $$ select true $$`);
    expect((await abrirJogo()).novas).toContain(108); // vale até antes do Abrir CNPJ
  });
  it('limaumdoc: contratar pelo nome de usuário (maiúscula não importa); outro nome não', async () => {
    await abrir(A, B, D);
    await mudar(A, 'valuation = 1e9');
    expect((await t.rpc<Estado>('idle_hire', { p_user: B })).novas).not.toContain(104);
    expect((await t.rpc<Estado>('idle_hire', { p_user: D })).novas).toContain(104);
  });
});

describe('escondidas e leitura', () => {
  it('escondida que alguém tem aparece em descobertas pra todo mundo', async () => {
    await abrir(A, B);
    await mudar(A, 'generators[2] = 67');
    await abrirJogo();
    await t.as(B);
    const b = await abrirJogo();
    expect(b.descobertas).toContain(101);
    expect(ids(b)).not.toContain(101);
    expect(b.descobertas).not.toContain(103); // ninguém tem
    expect(b.descobertas).not.toContain(1); // só as escondidas
  });
  it('membro lê as conquistas dos outros; anônimo não', async () => {
    await abrir(A);
    await mudar(A, 'generators[1] = 100');
    await abrirJogo();
    await t.as(B);
    expect(await t.asRole('authenticated', 'select conquista_id from public.idle_conquistas order by 1')).toEqual([{ conquista_id: 1 }, { conquista_id: 31 }]);
    await expect(t.asRole('anon', 'select * from public.idle_conquistas')).rejects.toThrow();
    expect((await t.asRole<{ n: number }>('authenticated', 'select count(*)::int as n from public.idle_cat_conquista'))[0].n).toBe(catalogo.conquistas.length);
    expect(await q('select nome from public.idle_cat_upg where id = 283')).toEqual([{ nome: 'Filial em Portugal' }]);
  });
});
```

Em `games/test/idleParidade.test.ts`, no fim do `describe('paridade', ...)`, acrescente:

```ts
  it('o estado devolve o bônus que a conta usa', async () => {
    const s = estados(5)[4];
    const bonus = { arvore: [1, 11, 12, 41], conquistas: 7 };
    await preparar(s);
    await arvore(bonus.arvore);
    await conquistas(bonus.conquistas);
    const [db] = await q<{ r: number; b: { arvore: number[]; conquistas: number } }>(
      `select (public.idle_json(s) ->> 'rate')::double precision as r, public.idle_json(s) -> 'bonus' as b
         from public.idle_state s where user_id = $1`,
      [A],
    );
    expect(db.b).toEqual(bonus);
    expect(rel(db.r, taxa(catalogo, { ...s, bonus }))).toBeLessThan(1e-9);
    await arvore([]);
    await conquistas(0);
  });
```

Em `games/test/db.ts`, troque `export async function freshDb() {` e o laço das migrações por:

```ts
/** `conquistas: false` esvazia o catálogo das conquistas: os testes das entregas 1 e 2 conferem a conta exata, sem o
 *  +1% de cada conquista que as ações vão ganhando. */
export async function freshDb(opcoes: { conquistas?: boolean } = {}) {
  const db = new PGlite();
  await db.exec(SKELETON);
  for (const name of MIGRATIONS) {
    await db.exec(readFileSync(resolve(__dirname, '../../supabase/migrations', name), 'utf8'));
  }
  if (opcoes.conquistas === false) await db.exec('delete from public.idle_cat_conquista where true');
```

Em `games/test/idle.test.ts` e em `games/test/idleGente.test.ts`, no `beforeEach` do topo, troque
`t = await freshDb();` por `t = await freshDb({ conquistas: false });`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/idleConquistas.test.ts test/idleParidade.test.ts`
Expected: FAIL (o estado não tem `novas`, `bonus`, `conquistas`; `idle_madrugada` não existe).

- [ ] **Step 3: Acrescentar no fim de `supabase/migrations/0041_fellas_inc_prestigio.sql`** (uma linha em branco antes):

```sql
-- ===== conquistas =====

-- conquistas de evento: quem viu o evento ganha as do tipo (com valor até p_valor e o mesmo texto, quando houver)
create or replace function public.idle_ganhar(p_user uuid, p_tipo text, p_valor double precision default null,
                                              p_texto text default null)
returns void language sql volatile set search_path = public as $$
  insert into public.idle_conquistas (user_id, conquista_id)
  select p_user, c.id
    from public.idle_cat_conquista c
   where c.tipo = p_tipo
     and (c.valor is null or c.valor <= p_valor)
     and (c.texto is null or c.texto = lower(p_texto))
  on conflict do nothing
$$;

-- 3h da manhã em Brasília (conquista "3h06")
create or replace function public.idle_madrugada(ts timestamptz default now())
returns boolean language sql stable as $$
  select extract(hour from ts at time zone 'America/Sao_Paulo') = 3
$$;

-- confere as conquistas "de estado" de alguém e grava as novas (com a hora desta transação). Roda no idle_save, o
-- último passo de toda função que muda o jogo, sempre depois de fechar a conta: a conquista nova só vale dali pra
-- frente. Devolve as que ganhou agora.
create or replace function public.idle_check_conquistas(p_user uuid)
returns int[] language plpgsql volatile set search_path = public as $$
declare
  s       public.idle_state;
  v_rate  double precision;
  v_era   int;
  v_novas int[];
  n       int;
begin
  select * into s from public.idle_state where user_id = p_user;
  if not found then
    return '{}';
  end if;
  v_rate := public.idle_rate(s);
  v_era := public.idle_era(s.generators);
  n := cardinality(s.opp_recent);
  with novas as (
    insert into public.idle_conquistas (user_id, conquista_id)
    select p_user, c.id
      from public.idle_cat_conquista c
     where case
             when exists (select 1 from public.idle_conquistas x where x.user_id = p_user and x.conquista_id = c.id) then false
             when c.tipo = 'gerador' then s.generators[c.alvo] >= c.valor
             when c.tipo = 'gerador_exato' then c.valor::int = any (s.generators)
             when c.tipo = 'taxa' then v_rate >= c.valor
             when c.tipo = 'era' then v_era >= c.valor
             when c.tipo = 'melhoria' then c.alvo = any (s.upgrades)
             when c.tipo = 'melhorias' then s.upg_total >= c.valor
             when c.tipo = 'oportunidades' then s.opp_total >= c.valor
             when c.tipo = 'vendas' then s.prestige_count >= c.valor
             when c.tipo = 'contratei' then s.hire_total >= c.valor
             when c.tipo = 'contratado' then s.hired_total >= c.valor
             -- as 3 opções de alguma era (era com opção desligada não conta)
             when c.tipo = 'estrategia_era' then exists (
               select 1 from public.idle_cat_est e group by e.era
               having count(*) = count(*) filter (where e.era * 10 + e.opcao = any (s.est_usadas)))
             -- todas as ligadas
             when c.tipo = 'estrategia_todas' then not exists (
               select 1 from public.idle_cat_est e where e.ativa and not (e.era * 10 + e.opcao = any (s.est_usadas)))
             -- 3 oportunidades em menos de c.valor segundos
             when c.tipo = 'brainrot' then n >= 3 and s.opp_recent[n] - s.opp_recent[n - 2] < make_interval(secs => c.valor)
             -- 1º no placar (R$/s), com mais alguém com empresa aberta e ninguém com mais
             when c.tipo = 'aura' then s.started and v_rate > 0
               and exists (select 1 from public.idle_state o where o.started and o.user_id <> p_user)
               and not exists (select 1 from public.idle_state o
                                where o.started and o.user_id <> p_user and public.idle_rate(o) >= v_rate)
             else false
           end
    on conflict do nothing
    returning conquista_id
  )
  select coalesce(array_agg(conquista_id order by conquista_id), '{}') into v_novas from novas;
  return v_novas;
end;
$$;

-- gravar o estado (o da 0036 + o que é permanente e as estratégias já usadas), conferir as conquistas e guardar o
-- recorde de R$/s. Toda função que muda o jogo termina aqui, depois de fechar a conta. As janelas de oportunidade já
-- pegas valem até 6h com a árvore: guarda as das últimas 10h.
create or replace function public.idle_save(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
         opp_claimed = array(select w from unnest(s.opp_claimed) w
                              where w >= floor(extract(epoch from now()) / 600)::bigint - 60),
         opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now(),
         prestige_earned = s.prestige_earned, prestige_spent = s.prestige_spent, prestige_count = s.prestige_count,
         upg_total = s.upg_total, opp_total = s.opp_total, hire_total = s.hire_total, hired_total = s.hired_total,
         est_usadas = array(select distinct x from unnest(s.est_usadas || public.idle_est_codigos(s.strategies)) x order by x),
         opp_recent = s.opp_recent
   where user_id = s.user_id;
  perform public.idle_check_conquistas(s.user_id);
  -- o recorde depois das conquistas novas (o R$/s que a tela mostra já conta com elas)
  update public.idle_state set best_rate = greatest(best_rate, s.best_rate, public.idle_rate(s)) where user_id = s.user_id;
end;
$$;

-- o estado que toda função do jogo devolve: o da 0038 + bônus (os nós comprados e quantas conquistas), pontos livres
-- e ganhos na vida, vendas, recorde de R$/s, quantos pontos a venda daria agora, suas conquistas, as ganhas nesta
-- chamada (a tela avisa) e as escondidas que alguém do grupo já tem (a tela mostra "???").
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
declare v_rate double precision := public.idle_rate(s);
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', v_rate, 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now(),
    'avatar', public.idle_avatar_json(s.user_id),
    'equipe', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.employee_id, 'cargo', c.cargo,
                                                            'avatar', public.idle_avatar_json(c.employee_id), 'ate', c.ends_at)
                                         order by c.created_at desc, c.id desc)
                          from public.idle_contracts c
                         where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'chefes', coalesce((select jsonb_agg(jsonb_build_object('user_id', c.employer_id, 'cargo', c.cargo,
                                                            'mult', public.idle_employee_mult(c.employer_id), 'ate', c.ends_at)
                                         order by c.created_at desc, c.id desc)
                          from public.idle_contracts c
                         where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb),
    'social', jsonb_build_object(
      'contratei', (select count(*) from public.idle_contracts c
                     where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()),
      'empregos', coalesce((select jsonb_agg(public.idle_employee_mult(c.employer_id) order by c.created_at desc, c.id desc)
                              from public.idle_contracts c
                             where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now()), '[]'::jsonb)),
    'hire_price', public.idle_hire_price(s),
    'muda_em', public.idle_next_change(s),
    'bonus', jsonb_build_object(
      'arvore', coalesce((select jsonb_agg(a.no_id order by a.no_id) from public.idle_arvore a where a.user_id = s.user_id), '[]'::jsonb),
      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)),
    'pontos', s.prestige_earned - s.prestige_spent,
    'pontos_vida', s.prestige_earned,
    'vendas', s.prestige_count,
    'recorde', greatest(s.best_rate, v_rate),
    'pontos_venda', case when s.started then greatest(0, public.idle_prestige_total(v_rate) - s.prestige_earned) else 0 end,
    'conquistas', coalesce((select jsonb_agg(jsonb_build_object('id', c.conquista_id, 'em', c.ganhou_em)
                                             order by c.ganhou_em, c.conquista_id)
                              from public.idle_conquistas c where c.user_id = s.user_id), '[]'::jsonb),
    'novas', coalesce((select jsonb_agg(c.conquista_id order by c.conquista_id)
                         from public.idle_conquistas c where c.user_id = s.user_id and c.ganhou_em = now()), '[]'::jsonb),
    'descobertas', coalesce((select jsonb_agg(d.id order by d.id)
                               from (select distinct c.conquista_id as id
                                       from public.idle_conquistas c
                                       join public.idle_cat_conquista k on k.id = c.conquista_id
                                      where k.escondida) d), '[]'::jsonb));
end;
$$;

revoke all on function public.idle_ganhar(uuid, text, double precision, text) from public, anon, authenticated;
revoke all on function public.idle_madrugada(timestamptz) from public, anon, authenticated;
revoke all on function public.idle_check_conquistas(uuid) from public, anon, authenticated;
revoke all on function public.idle_save(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;

-- ===== as funções que contam o que as conquistas pedem =====

-- abrir o jogo (a da 0034) + "3h06"
create or replace function public.idle_open()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_settle(public.idle_lock(auth.uid()));
  if public.idle_madrugada() then
    perform public.idle_ganhar(s.user_id, 'madrugada');
  end if;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- comprar (a da 0034) + conta as melhorias compradas e o "Tá saindo da jaula" (Máx com 100 ou mais)
create or replace function public.idle_buy(p_kind text, p_id int, p_qty int default 1)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  g      public.idle_cat_gen;
  u      public.idle_cat_upg;
  v_era  int;
  v_cm   double precision;
  v_n    int;
  v_k    int;
  v_preco double precision;
  v_meia boolean := false;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_era := public.idle_era(s.generators);
  if v_era >= 2 and s.strategies[v_era - 1] < 0 then
    raise exception 'idle_strategy_pending' using errcode = 'P0001';
  end if;
  v_cm := public.idle_cost_mult(s);

  if p_kind = 'gerador' then
    select * into g from public.idle_cat_gen where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id > 1 and s.generators[p_id - 1] < 1 then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_n := s.generators[p_id];
    if p_qty = 0 then
      v_k := public.idle_max_qty(g.custo, v_n, s.valuation, v_cm);
      if v_k < 1 then
        raise exception 'idle_cant_afford' using errcode = 'P0001';
      end if;
    elsif p_qty in (1, 10) then
      v_k := p_qty;
    else
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    v_preco := public.idle_price(g.custo, v_n, v_k, v_cm);
    if s.half_price and v_k = 1 then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.generators[p_id] := v_n + v_k;
    if p_qty = 0 then
      perform public.idle_ganhar(s.user_id, 'jaula', v_k);
    end if;
  elsif p_kind = 'melhoria' then
    select * into u from public.idle_cat_upg where id = p_id;
    if not found then
      raise exception 'idle_bad_choice' using errcode = 'P0001';
    end if;
    if p_id = any (s.upgrades) then
      raise exception 'idle_owned' using errcode = 'P0001';
    end if;
    if not public.idle_upg_unlocked(u, s.generators) then
      raise exception 'idle_locked' using errcode = 'P0001';
    end if;
    v_preco := u.preco * v_cm;
    if s.half_price then
      v_preco := v_preco / 2;
      v_meia := true;
    end if;
    if v_preco > s.valuation then
      raise exception 'idle_cant_afford' using errcode = 'P0001';
    end if;
    s.valuation := s.valuation - v_preco;
    s.upgrades := array_append(s.upgrades, p_id);
    s.upg_total := s.upg_total + 1;
  else
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;

  if v_meia then
    s.half_price := false;
  end if;
  s.valuation := greatest(s.valuation, 0);
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- pegar oportunidade (a da 0034) + o bônus da árvore (Negociador) + conta as pegas e guarda a hora das 3 últimas
-- ("Brainrot")
create or replace function public.idle_claim_opportunity(p_window bigint)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  v_mult double precision;
  v_rate double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_window is null or not (p_window = any (public.idle_opp_list(s))) then
    raise exception 'idle_opp_gone' using errcode = 'P0001';
  end if;
  if s.opp_day is distinct from public.games_today() then
    s.opp_day := public.games_today();
    s.opp_count := 0;
  end if;
  if s.opp_count >= public.idle_opp_cap(s) then
    raise exception 'idle_opp_cap' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_mult := coalesce((select exp(sum(ln(e.opp_bonus_mult))) from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 1)
            * public.idle_arv(s.user_id, 'opp_bonus', 'mult', 1);
  v_rate := public.idle_rate(s);
  case public.idle_opp_kind(s.user_id, p_window)
    when 0 then s.valuation := s.valuation + v_rate * 900 * v_mult;
    when 1 then s.boost_until := greatest(now(), coalesce(s.boost_until, now())) + make_interval(secs => 60 * v_mult);
    else s.half_price := true;
  end case;
  s.opp_claimed := array_append(s.opp_claimed, p_window);
  s.opp_count := s.opp_count + 1;
  s.opp_total := s.opp_total + 1;
  s.opp_recent := array_append(s.opp_recent, now());
  s.opp_recent := s.opp_recent[greatest(1, cardinality(s.opp_recent) - 2):];
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- contratar (a da 0038) + o contrato dura 10 dias com o nó Contrato longo de quem contrata + conta os contratos dos
-- dois lados e o "limaumdoc" (pelo nome de usuário)
create or replace function public.idle_hire(p_user uuid)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  v_me    uuid := auth.uid();
  s       public.idle_state;
  o       public.idle_state;
  v_era   int;
  v_preco double precision;
  v_cargo text;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_user = v_me then
    raise exception 'idle_hire_self' using errcode = 'P0001';
  end if;
  if p_user is null or not exists (select 1 from public.profiles where id = p_user and is_member) then
    raise exception 'idle_hire_not_open' using errcode = 'P0001';
  end if;
  perform public.idle_lock_all(array[v_me, p_user]);
  select * into s from public.idle_state where user_id = v_me;
  select * into o from public.idle_state where user_id = p_user;
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if not o.started then
    raise exception 'idle_hire_not_open' using errcode = 'P0001';
  end if;
  v_era := public.idle_era(s.generators);
  if v_era >= 2 and s.strategies[v_era - 1] < 0 then
    raise exception 'idle_strategy_pending' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_contracts c
              where c.employer_id = v_me and c.employee_id = p_user and c.ends_at > now()) then
    raise exception 'idle_hire_twice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_preco := public.idle_hire_price(s);
  if v_preco > s.valuation then
    raise exception 'idle_cant_afford' using errcode = 'P0001';
  end if;
  s.valuation := greatest(s.valuation - v_preco, 0);
  o := public.idle_settle(o); -- o contratado rende até agora com a regra antiga
  o.hired_total := o.hired_total + 1;
  perform public.idle_save(o);
  select k.nome into v_cargo from public.idle_cat_cargo k order by random() limit 1;
  insert into public.idle_contracts (employer_id, employee_id, cargo, created_at, ends_at)
  values (v_me, p_user, coalesce(v_cargo, 'freela'), now(),
          now() + make_interval(days => greatest(7, public.idle_arv(v_me, 'contrato_dias', 'max', 7))::int));
  s.hire_total := s.hire_total + 1;
  perform public.idle_ganhar(v_me, 'contratar_usuario', null, (select p.username from public.profiles p where p.id = p_user));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_open() from public, anon;
grant execute on function public.idle_open() to authenticated;
revoke all on function public.idle_buy(text, int, int) from public, anon;
grant execute on function public.idle_buy(text, int, int) to authenticated;
revoke all on function public.idle_claim_opportunity(bigint) from public, anon;
grant execute on function public.idle_claim_opportunity(bigint) to authenticated;
revoke all on function public.idle_hire(uuid) from public, anon;
grant execute on function public.idle_hire(uuid) to authenticated;
```

Nota para a revisão: a "Farmou aura" calcula o R$/s de quem tem empresa aberta a cada `idle_save` de quem ainda não a
tem (o `case` confere "já tem" antes). Com o grupo (~20 pessoas) é o mesmo custo de uma leitura do placar.

- [ ] **Step 4: Rodar e ver passar; os testes antigos continuam verdes**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/ && npx tsc --noEmit`
Expected: PASS em tudo (`idleConquistas`, paridade, e `idle`/`idleGente` com o catálogo de conquistas vazio).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add supabase/migrations/0041_fellas_inc_prestigio.sql games/test/db.ts games/test/idle.test.ts games/test/idleGente.test.ts games/test/idleParidade.test.ts games/test/idleConquistas.test.ts && git commit -m "Fellas Inc.: conquistas conferidas e devolvidas pelo banco (0041, parte 2)"
```

---

### Task 5: Comprar nós da árvore e o "Abrir CNPJ" com o Recomeço (0041, parte 3)

**Files:**
- Modify: `supabase/migrations/0041_fellas_inc_prestigio.sql` (acrescentar no fim)
- Create: `games/test/idleArvore.test.ts`

**Interfaces:**
- Consome: Tasks 3 e 4; `catalogo.arvore`, `pendentes`, `tipo` (oportunidades.ts).
- Produz: RPC `idle_buy_node(p_no int) → jsonb` (o estado; erros `idle_bad_choice`, `idle_node_owned`, `idle_locked`,
  `idle_points_low`, `not_member`); `idle_start()` com o ramo Recomeço.

- [ ] **Step 1: Testes** — crie `games/test/idleArvore.test.ts`:

```ts
// Banco da entrega 3 da Fellas Inc.: a árvore de habilidades (comprar nós e o que cada ramo faz), com as migrações
// reais no PGlite. A conta da produção, do teto, da caixinha e do preço do contrato com a árvore está na paridade.
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { pendentes, tipo } from '../idle/oportunidades';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Estado = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number; generators: number[];
  upgrades: number[]; server_now: string; opp_left: number; boost_until: string | null;
  bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number;
  equipe: { user_id: string; ate: string }[];
};

// sem o catálogo das conquistas: a conta exata não muda com o +1% de cada uma
beforeEach(async () => {
  t = await freshDb({ conquistas: false });
  for (const u of [A, B]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const comprar = (no: number) => t.rpc<Estado>('idle_buy_node', { p_no: no });
const pontos = (u: string, ganhos: number, gastos = 0) =>
  q('update public.idle_state set prestige_earned = $2, prestige_spent = $3 where user_id = $1', [u, ganhos, gastos]);
/** Põe os nós direto (sem pagar), para testar o efeito. */
const ter = (u: string, nos: number[]) =>
  q('insert into public.idle_arvore (user_id, no_id) select $1, unnest($2::int[])', [u, nos]);

describe('comprar nós', () => {
  it('a raiz primeiro; cada nó exige o anterior do ramo; paga com os pontos livres e fica com o nó', async () => {
    await abrir(A);
    await pontos(A, 10);
    await expect(comprar(11)).rejects.toThrow(/idle_locked/);
    expect(await comprar(1)).toMatchObject({ pontos: 9, pontos_vida: 10, bonus: { arvore: [1] } });
    await expect(comprar(12)).rejects.toThrow(/idle_locked/);
    const s = await comprar(11);
    expect(s).toMatchObject({ pontos: 7, bonus: { arvore: [1, 11] } });
    expect(await q('select prestige_earned, prestige_spent from public.idle_state where user_id = $1', [A]))
      .toEqual([{ prestige_earned: 10, prestige_spent: 3 }]);
  });
  it('sem pontos livres que cubram o custo: idle_points_low; de novo: idle_node_owned; nó que não existe: idle_bad_choice', async () => {
    await abrir(A);
    await pontos(A, 2);
    await comprar(1);
    await expect(comprar(11)).rejects.toThrow(/idle_points_low/); // custa 2, sobrou 1
    await pontos(A, 10, 1);
    await expect(comprar(1)).rejects.toThrow(/idle_node_owned/);
    await expect(comprar(99)).rejects.toThrow(/idle_bad_choice/);
    await expect(comprar(null as unknown as number)).rejects.toThrow(/idle_bad_choice/);
  });
  it('fecha a conta antes: o tempo parado rende sem o nó novo, e dali pra frente com ele', async () => {
    await abrir(A);
    await pontos(A, 1);
    await q(`update public.idle_state set settled_at = settled_at - interval '1000 seconds' where user_id = $1`, [A]);
    const s = await comprar(1);
    expect((s.valuation - 10) / (0.5 * 1.02 * 1000)).toBeCloseTo(1, 3);
    expect(s.rate).toBeCloseTo(0.5 * 1.02 * 1.05, 12);
  });
  it('dá pra comprar com a empresa fechada (entre a venda e o Abrir CNPJ)', async () => {
    await t.rpc('idle_open');
    await pontos(A, 1);
    expect(await comprar(1)).toMatchObject({ started: false, bonus: { arvore: [1] } });
  });
  it('não membro é barrado; ninguém escreve direto na árvore; membro lê a dos outros', async () => {
    await abrir(A);
    await pontos(A, 1);
    await comprar(1);
    await expect(t.asRole('authenticated', `insert into public.idle_arvore (user_id, no_id) values ('${B}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `delete from public.idle_arvore where user_id = '${A}'`)).rejects.toThrow();
    await t.as(B);
    expect(await t.asRole('authenticated', 'select no_id from public.idle_arvore')).toEqual([{ no_id: 1 }]);
    await expect(t.asRole('anon', 'select * from public.idle_arvore')).rejects.toThrow();
    await t.as(OUT);
    await expect(comprar(1)).rejects.toThrow(/not_member/);
  });
});

describe('o que cada ramo faz', () => {
  it('Produção: os nós multiplicam entre si (raiz ×1,05, depois ×1,1 ×1,25 ×1,5 ×2 ×2)', async () => {
    await abrir(A);
    await ter(A, [1, 11, 12, 13, 14, 15]);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.02 * 1.05 * 1.1 * 1.25 * 1.5 * 2 * 2, 10);
  });
  it('Recomeço: o Abrir CNPJ começa com R$ 1 mil, 10 notebooks, 1 de cada gerador da era 1 e depois R$ 1 mi', async () => {
    await ter(A, [1, 21, 22]);
    let s = await t.rpc<Estado>('idle_start');
    expect(s.valuation).toBe(1000);
    expect(s.generators.slice(0, 7)).toEqual([10, 0, 0, 0, 0, 0, 0]);
    await q('update public.idle_state set started = false where user_id = $1', [A]);
    await ter(A, [23, 24, 25]);
    s = await t.rpc<Estado>('idle_start');
    expect(s.valuation).toBe(1e6);
    expect(s.generators.slice(0, 7)).toEqual([10, 1, 1, 1, 1, 1, 0]);
  });
  it('Oportunidades: caixinha de 4 (e 5), validade de 6h, +3 por dia e bônus em dobro', async () => {
    await abrir(A);
    const sem = await t.rpc<Estado>('idle_open');
    const agora = Date.parse(sem.server_now);
    const semana = Date.parse(sem.week_start + 'T00:00:00-03:00');
    await ter(A, [1, 31, 32, 33, 34]);
    const com = await t.rpc<Estado>('idle_open');
    expect(com.opp_left).toBe(sem.opp_left + 3);
    const lista = pendentes(A, agora, [], semana, { tamanho: 4, validadeS: 6 * 3600 });
    expect(lista).toHaveLength(4);
    const [{ l }] = await q<{ l: string[] }>('select public.idle_opp_list(s, $2::timestamptz) as l from public.idle_state s where user_id = $1', [A, sem.server_now]);
    expect(l.map(Number)).toEqual(lista);
    // bônus em dobro: a de 15 minutos de produção rende 30
    await q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [A]);
    const w = lista.find((x) => tipo(A, x) === 0)!;
    const depois = await t.rpc<Estado>('idle_claim_opportunity', { p_window: w });
    expect((depois.valuation - com.valuation) / (com.rate * 1800)).toBeCloseTo(1, 6);
  });
  it('Tempo: com o jogo fechado a empresa rende até 12h (e não 8h)', async () => {
    await abrir(A);
    await ter(A, [1, 41]);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '20 hours' where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation).toBeCloseTo(0.5 * 1.02 * 1.05 * 12 * 3600, 3);
  });
  it('Gente: contratar 25% (e 50%) mais barato, contrato de 10 dias pra quem contrata', async () => {
    await abrir(A, B);
    await q('update public.idle_state set valuation = 1e6 where user_id = $1', [A]);
    const sem = await t.rpc<Estado & { hire_price: number }>('idle_open');
    await ter(A, [1, 51, 52, 53]);
    const com = await t.rpc<Estado & { hire_price: number }>('idle_open');
    expect(com.hire_price / (com.rate * 1800)).toBeCloseTo(0.75, 12);
    expect(com.hire_price).toBeLessThan(sem.hire_price);
    const s = await t.rpc<Estado>('idle_hire', { p_user: B });
    expect(Date.parse(s.equipe[0].ate) - Date.parse(s.server_now)).toBeCloseTo(10 * 86400_000, -4);
    await ter(A, [54, 55]);
    const mais = await t.rpc<Estado & { hire_price: number }>('idle_open');
    expect(mais.hire_price / (mais.rate * 1800 * 1.5)).toBeCloseTo(0.5, 12);
  });
  it('Gente: Treinamento paga 15% por contratado; Passe em alta dobra o que quem te contratou rende pra você', async () => {
    await abrir(A, B);
    await q('update public.idle_state set valuation = 1e6 where user_id = $1', [A]);
    await ter(A, [1, 51, 52]);
    expect((await t.rpc<Estado>('idle_hire', { p_user: B })).rate).toBeCloseTo(0.5 * 1.05 * (1 + 0.15 + 0.02), 10);
    await t.as(B);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.02, 10);
    await ter(B, [1, 51, 52, 53, 54]);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.05 * 1.04, 10);
  });
  it('o catálogo no banco é o da página', async () => {
    const nos = await q<{ id: number; custo: number; requer: number | null; tipo: string; valor: number }>(
      'select id, custo, requer, tipo, valor from public.idle_cat_no order by id',
    );
    expect(nos).toEqual(catalogo.arvore.map((n) => ({ id: n.id, custo: n.custo, requer: n.requer, tipo: n.tipo, valor: n.valor })));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/idleArvore.test.ts`
Expected: FAIL (`idle_buy_node` não existe; o "Abrir CNPJ" ainda dá R$ 10 e 1 notebook).

- [ ] **Step 3: Acrescentar no fim de `supabase/migrations/0041_fellas_inc_prestigio.sql`** (uma linha em branco antes):

```sql
-- ===== a árvore e o "Abrir CNPJ" =====

-- comprar um nó: com pontos livres (ganhos na vida − gastos), o anterior do ramo comprado (o 1º de cada ramo pede a
-- raiz) e sem repetir. Fecha a conta antes (o nó pode mudar a taxa, o teto e a caixinha dali pra frente). Dá pra
-- comprar com a empresa fechada (entre a venda e o novo "Abrir CNPJ").
create or replace function public.idle_buy_node(p_no int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  n public.idle_cat_no;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  select * into n from public.idle_cat_no where id = p_no;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = p_no) then
    raise exception 'idle_node_owned' using errcode = 'P0001';
  end if;
  if n.requer is not null
     and not exists (select 1 from public.idle_arvore a where a.user_id = s.user_id and a.no_id = n.requer) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if s.prestige_earned - s.prestige_spent < n.custo then
    raise exception 'idle_points_low' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende sem o nó
  insert into public.idle_arvore (user_id, no_id) values (s.user_id, p_no);
  s.prestige_spent := s.prestige_spent + n.custo;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- "Abrir CNPJ" (o da 0034) com o ramo Recomeço: R$ 10 (R$ 1 mil, R$ 1 mi), 1 notebook (10), 1 de cada gerador da
-- era 1 (Kit startup). As melhorias gerais mantidas pela venda já estão no estado. Igual a economia.ts abertura.
create or replace function public.idle_start()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s public.idle_state;
  g int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  s := public.idle_lock(auth.uid());
  if s.started then
    raise exception 'idle_started' using errcode = 'P0001';
  end if;
  s.started := true;
  s.valuation := greatest(10, public.idle_arv(s.user_id, 'inicio_valuation', 'max', 10));
  s.generators[1] := greatest(1, public.idle_arv(s.user_id, 'inicio_notebooks', 'max', 1))::int;
  if public.idle_arv(s.user_id, 'inicio_era1', 'max', 0) > 0 then
    for g in select c.id from public.idle_cat_gen c where c.era = 1 loop
      s.generators[g] := greatest(s.generators[g], 1);
    end loop;
  end if;
  s.settled_at := now();
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_buy_node(int) from public, anon;
grant execute on function public.idle_buy_node(int) to authenticated;
revoke all on function public.idle_start() from public, anon;
grant execute on function public.idle_start() to authenticated;
```

- [ ] **Step 4: Rodar e ver passar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/idleArvore.test.ts test/idle.test.ts && npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add supabase/migrations/0041_fellas_inc_prestigio.sql games/test/idleArvore.test.ts && git commit -m "Fellas Inc.: comprar nós da árvore e o Abrir CNPJ com o Recomeço (0041, parte 3)"
```

---

### Task 6: Vender a startup, placar com pontos e a foto de segunda (0041, parte 4)

**Files:**
- Modify: `supabase/migrations/0041_fellas_inc_prestigio.sql` (acrescentar no fim), `games/test/idleConquistas.test.ts`,
  `__tests__/fellasIncMigration.test.ts`
- Create: `games/test/idlePrestigio.test.ts`

**Interfaces:**
- Consome: Tasks 3–5; `idle_lock_all`, `idle_most_hired`, `idle_employee_mult` (0038).
- Produz: RPC `idle_prestige() → jsonb` (o estado, já vendido; erros `idle_not_started`, `idle_prestige_low`,
  `not_member`); linhas de `idle_board` com `pontos` (ganhos na vida) e `conquistas` (quantas); `idle_weekly_reset` dando
  o "Pai tá on" ao unicórnio (com a conta dele fechada antes); a parte da 0041 que conta o que já aconteceu
  (idempotente).

- [ ] **Step 1: Testes**

Crie `games/test/idlePrestigio.test.ts`:

```ts
// Banco da entrega 3 da Fellas Inc.: vender a startup (prestígio), com as migrações reais no PGlite.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { beforeEach, describe, expect, it } from 'vitest';

import { pontosTotais } from '../idle/economia';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Estado = {
  user_id: string; started: boolean; valuation: number; rate: number; era: number; generators: number[]; upgrades: number[];
  strategies: number[]; boost_until: string | null; half_price: boolean; opp_left: number; server_now: string;
  avatar: Record<string, number> | null; equipe: { user_id: string }[]; chefes: { user_id: string; ate: string }[];
  bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number; vendas: number; recorde: number;
  pontos_venda: number;
  conquistas: { id: number; em: string }[]; novas: number[]; descobertas: number[];
};

beforeEach(async () => {
  t = await freshDb();
  for (const u of [A, B, C]) await t.member(u);
  await t.member(OUT, { isMember: false });
  await t.as(A);
});

/** Abre a empresa de cada um (como ele) e volta a ser A. */
const abrir = async (...us: string[]) => {
  for (const u of us) {
    await t.as(u);
    await t.rpc('idle_start');
  }
  await t.as(A);
};
const vender = () => t.rpc<Estado>('idle_prestige');
/** 150 foguetes e as estratégias escolhidas: a venda vale uns 7 pontos. */
const enriquecer = (u: string) =>
  q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}' where user_id = $1`, [u]);
const V = { pele: 1, cabelo: 2, cor_cabelo: 3, roupa: 1, cor_roupa: 4, acessorio: 3, cor_acessorio: 5 };

describe('pontos de prestígio', () => {
  it('pontos totais = floor(cbrt(R$/s ÷ 1 milhão)), exatos nos cubos', async () => {
    const casos: [number, number][] = [
      [0, 0], [-5, 0], [999_999, 0], [1e6, 1], [7_999_999, 1], [8e6, 2], [124_999_999, 4], [125e6, 5], [1e9, 10], [1e12, 100],
    ];
    for (const [r, n] of casos) {
      expect((await q<{ n: number }>('select public.idle_prestige_total($1) as n', [r]))[0].n, String(r)).toBe(n);
    }
  });
  it('não compensa: menos de 1 ponto é idle_prestige_low e nada muda', async () => {
    await abrir(A);
    expect((await t.rpc<Estado>('idle_open')).pontos_venda).toBe(0);
    await expect(vender()).rejects.toThrow(/idle_prestige_low/);
    expect(await q('select started, generators[1] as g, prestige_count from public.idle_state where user_id = $1', [A]))
      .toEqual([{ started: true, g: 1, prestige_count: 0 }]);
  });
  it('conta os ganhos na vida (gastos ou não): no mesmo ritmo não rende; com menos, ganha só a diferença', async () => {
    await abrir(A);
    await enriquecer(A);
    const total = pontosTotais((await t.rpc<Estado>('idle_open')).rate);
    // já ganhou tudo isso na vida e gastou tudo: vender no mesmo ritmo não rende nada
    await q('update public.idle_state set prestige_earned = $2, prestige_spent = $2 where user_id = $1', [A, total]);
    expect((await t.rpc<Estado>('idle_open')).pontos_venda).toBe(0);
    await expect(vender()).rejects.toThrow(/idle_prestige_low/);
    // ganhou 2 na vida e gastou 1: ganha o resto e os livres somam
    await q('update public.idle_state set prestige_earned = 2, prestige_spent = 1 where user_id = $1', [A]);
    const antes = await t.rpc<Estado>('idle_open');
    expect(antes).toMatchObject({ pontos: 1, pontos_vida: 2, pontos_venda: total - 2 });
    expect(await vender()).toMatchObject({ pontos: total - 1, pontos_vida: total });
  });
  it('pontos não mexem na produção: só os nós comprados', async () => {
    await abrir(A);
    const antes = await t.rpc<Estado>('idle_open');
    await q('update public.idle_state set prestige_earned = 50 where user_id = $1', [A]);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(antes.rate, 12);
  });
  it('toque duplo em Vender: a segunda recebe idle_not_started e os pontos entram uma vez só', async () => {
    // em produção a segunda chamada espera a trava da linha (idle_lock_all) e já encontra a empresa vendida
    await abrir(A);
    await enriquecer(A);
    const s = await vender();
    await expect(vender()).rejects.toThrow(/idle_not_started/);
    expect(await q('select prestige_earned, prestige_count from public.idle_state where user_id = $1', [A]))
      .toEqual([{ prestige_earned: s.pontos_vida, prestige_count: 1 }]);
  });
  it('sem empresa aberta: idle_not_started; não membro é barrado', async () => {
    await expect(vender()).rejects.toThrow(/idle_not_started/);
    await t.as(OUT);
    await expect(vender()).rejects.toThrow(/not_member/);
  });
});

describe('vender a startup', () => {
  it('zera a empresa e volta pro Abrir CNPJ; ficam pontos, nós, vendas, conquistas, personagem, a cota do dia e o recorde', async () => {
    await abrir(A);
    await t.rpc('idle_set_avatar', {
      p_pele: V.pele, p_cabelo: V.cabelo, p_cor_cabelo: V.cor_cabelo, p_roupa: V.roupa, p_cor_roupa: V.cor_roupa,
      p_acessorio: V.acessorio, p_cor_acessorio: V.cor_acessorio,
    });
    await enriquecer(A);
    await q('insert into public.idle_arvore (user_id, no_id) values ($1, 1), ($1, 11)', [A]); // Fundador e Café sem açúcar
    await q(
      `update public.idle_state
          set valuation = 5e9, upgrades = '{11,1001}', boost_until = now() + interval '1 hour', half_price = true,
              opp_day = public.games_today(), opp_count = 4
        where user_id = $1`,
      [A],
    );
    const antes = await t.rpc<Estado>('idle_open');
    const P = pontosTotais(antes.rate);
    expect(P).toBeGreaterThanOrEqual(5);
    expect(antes.pontos_venda).toBe(P);
    expect(antes.opp_left).toBe(9); // Viralizar: 13 por dia
    const s = await vender();
    expect(s).toMatchObject({
      started: false, valuation: 0, upgrades: [], strategies: [-1, -1, -1, -1], boost_until: null, half_price: false,
      era: 1, vendas: 1, pontos_venda: 0, avatar: V,
    });
    expect(s.generators).toEqual(Array(30).fill(0));
    expect(s).toMatchObject({ pontos: P, pontos_vida: P, bonus: { arvore: [1, 11] } });
    expect(s.recorde).toBeCloseTo(antes.rate, 6);
    expect(s.opp_left).toBe(6); // 10 por dia sem estratégia, 4 já pegas hoje: a cota não reabre
    expect(s.conquistas.map((c) => c.id)).toEqual(expect.arrayContaining(antes.conquistas.map((c) => c.id)));
    expect(s.novas).toEqual(expect.arrayContaining([51, 109])); // Exit; Modo sigma (nunca contratou)
    // Abrir CNPJ de novo: R$ 10, 1 notebook e o bônus valendo
    const r = await t.rpc<Estado>('idle_start');
    expect(r).toMatchObject({ started: true, valuation: 10, vendas: 1 });
    expect(r.generators[0]).toBe(1);
    expect(r.rate).toBeCloseTo(0.5 * 1.02 * 1.05 * 1.1 * (1 + 0.01 * r.bonus.conquistas), 10); // os nós continuam valendo
  });
  it('os contratos que você fez vencem na hora, com a conta dos contratados fechada antes; quem te contratou continua', async () => {
    await abrir(A, B, C);
    // A com Cultura de startup (era 4, opção 2): quem A contrata ganha o triplo
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,2,0}', valuation = 1e15 where user_id = $1`, [A]);
    await t.rpc('idle_hire', { p_user: B });
    await t.as(C);
    await q('update public.idle_state set valuation = 1e15 where user_id = $1', [C]);
    await t.rpc('idle_hire', { p_user: A });
    await t.as(A);
    // contratos de ontem; B não abre o jogo há 1000 s
    await q(`update public.idle_contracts set created_at = created_at - interval '1 day', ends_at = ends_at - interval '1 day' where true`);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '1000 seconds' where user_id = $1`, [B]);
    const [{ r: rB }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [B]);
    const s = await vender();
    expect(s.equipe).toEqual([]);
    expect(s.chefes.map((c) => c.user_id)).toEqual([C]);
    // B rendeu as 1000 s com o triplo de Cultura de startup (a regra de antes da venda)
    const [{ valuation }] = await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [B]);
    expect(valuation / (rB * 1000)).toBeCloseTo(1, 3);
    expect(await q('select employer_id, ends_at <= now() as vencido from public.idle_contracts order by employer_id'))
      .toEqual([{ employer_id: A, vencido: true }, { employer_id: C, vencido: false }]);
    await t.as(B);
    const b = await t.rpc<Estado>('idle_open');
    expect(b.chefes).toEqual([]);
    expect(b.rate).toBeLessThan(rB); // voltou pro piso de freela
  });
  it('contrato que já venceu, com o contratado sem fechar a conta desde antes: fecha antes também (o triplo não some pra trás)', async () => {
    await abrir(A, B);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,2,0}', valuation = 1e15 where user_id = $1`, [A]);
    await t.rpc('idle_hire', { p_user: B });
    // venceu há 1 hora; B não fecha a conta desde 3 horas atrás
    await q(`update public.idle_contracts set created_at = created_at - interval '7 days 1 hour', ends_at = ends_at - interval '7 days 1 hour' where true`);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '3 hours' where user_id = $1`, [B]);
    const [{ v: esperado }] = await q<{ v: number }>('select (public.idle_settle(s)).valuation as v from public.idle_state s where user_id = $1', [B]);
    await vender();
    const [{ valuation }] = await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [B]);
    expect(valuation / esperado).toBeCloseTo(1, 4);
  });
  it('Recomeço: com Leva a cultura junto a venda mantém as melhorias gerais (e só elas)', async () => {
    await abrir(A);
    await q('insert into public.idle_arvore (user_id, no_id) values ($1, 1), ($1, 21), ($1, 22), ($1, 23)', [A]);
    await q(`update public.idle_state set generators[30] = 150, strategies = '{0,0,0,0}', upgrades = '{11,1001,1002,2001}' where user_id = $1`, [A]);
    const s = await vender();
    expect(s.upgrades.map(Number).sort()).toEqual([1001, 1002]);
  });
  it('ninguém escreve nos pontos nem nas conquistas (nem nos próprios); as funções internas estão fechadas', async () => {
    await abrir(A);
    await expect(t.asRole('authenticated', `update public.idle_state set prestige_earned = 99 where user_id = '${A}'`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `insert into public.idle_arvore (user_id, no_id) values ('${A}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `insert into public.idle_conquistas (user_id, conquista_id) values ('${A}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `delete from public.idle_conquistas where user_id = '${A}'`)).rejects.toThrow();
    await expect(t.rpc('idle_ganhar', { p_user: B, p_tipo: 'unicornio' })).rejects.toThrow();
    await expect(t.rpc('idle_check_conquistas', { p_user: B })).rejects.toThrow();
    await expect(t.asRole('anon', 'select public.idle_prestige()')).rejects.toThrow();
  });
  it('placar: pontos ganhos na vida (gastos ou não) e quantas conquistas cada um tem', async () => {
    await abrir(A, B);
    await q('update public.idle_state set prestige_earned = 12, prestige_spent = 9 where user_id = $1', [B]);
    await q('insert into public.idle_conquistas (user_id, conquista_id) values ($1, 1), ($1, 2)', [B]);
    const rows = await t.rpc<{ user_id: string; pontos: number; conquistas: number }[]>('idle_board');
    expect(rows.find((r) => r.user_id === B)).toMatchObject({ pontos: 12, conquistas: 2 });
    expect(rows.find((r) => r.user_id === A)).toMatchObject({ pontos: 0, conquistas: 0 });
  });
});

describe('a migração 0041 conta o que já aconteceu', () => {
  it('melhorias, contratos, estratégias e unicórnio de antes; rodar de novo não muda nada', async () => {
    await abrir(A, B);
    await q('update public.idle_state set valuation = 1e9 where true');
    await t.rpc('idle_hire', { p_user: B });
    // como se a 0041 ainda não tivesse rodado
    await q(`update public.idle_state set upg_total = 0, hire_total = 0, hired_total = 0, est_usadas = '{}', upgrades = '{11,12}', strategies = '{1,-1,-1,-1}' where true`);
    await q('delete from public.idle_conquistas where true');
    await q('insert into public.idle_weeks (week_start, unicorn_id) values (public.games_week_start() - 7, $1)', [A]);
    const sql = readFileSync(resolve(__dirname, '../../supabase/migrations/0041_fellas_inc_prestigio.sql'), 'utf8');
    const contar = () => q('select user_id, upg_total, hire_total, hired_total, est_usadas from public.idle_state order by user_id');
    await t.db.exec(sql);
    const depois = await contar();
    expect(depois).toEqual([
      { user_id: A, upg_total: 2, hire_total: 1, hired_total: 0, est_usadas: [21] },
      { user_id: B, upg_total: 2, hire_total: 0, hired_total: 1, est_usadas: [21] },
    ]);
    expect(await q('select user_id from public.idle_conquistas where conquista_id = 110')).toEqual([{ user_id: A }]);
    const conquistas = await q('select user_id, conquista_id from public.idle_conquistas order by 1, 2');
    await t.db.exec(sql);
    expect(await contar()).toEqual(depois);
    expect(await q('select user_id, conquista_id from public.idle_conquistas order by 1, 2')).toEqual(conquistas);
  });
});
```

No fim de `games/test/idleConquistas.test.ts`, acrescente:

```ts

describe('conquistas da venda e da foto de segunda', () => {
  it('Aura negativa (venda de 1 ponto) e Modo sigma (sem nunca ter contratado); quem contratou não é sigma', async () => {
    await abrir(A, B);
    await t.as(B);
    await mudar(B, 'valuation = 1e9');
    await t.rpc('idle_hire', { p_user: A }); // B já contratou; A nunca
    await t.as(A);
    await mudar(A, 'generators[30] = 1, strategies = \'{0,0,0,0}\'');
    expect((await abrirJogo()).novas).not.toContain(103);
    expect((await t.rpc<Estado>('idle_prestige')).novas).toEqual(expect.arrayContaining([51, 103, 109]));
    await t.as(B);
    await mudar(B, 'generators[30] = 150, strategies = \'{0,0,0,0}\'');
    const b = await t.rpc<Estado>('idle_prestige');
    expect(b.novas).toContain(51);
    expect(b.novas).not.toContain(103);
    expect(b.novas).not.toContain(109);
  });
  it('Pai tá on: o unicórnio da foto de segunda ganha, com a conta fechada antes (sem o +1% pra trás)', async () => {
    await abrir(A, B);
    await mudar(A, 'generators[2] = 5');
    await abrirJogo();
    await q('update public.idle_state set week_start = public.games_week_start() - 7 where true');
    await mudar(A, 'valuation = 0, settled_at = now() - interval \'1 hour\'');
    const [{ r }] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
    await q('select public.idle_weekly_reset()');
    expect(await q('select user_id from public.idle_conquistas where conquista_id = 110')).toEqual([{ user_id: A }]);
    const [{ valuation }] = await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [A]);
    expect(valuation / (r * 3600)).toBeCloseTo(1, 3);
  });
});
```

No fim de `__tests__/fellasIncMigration.test.ts`, acrescente:

```ts
const prestigio = ler('0041_fellas_inc_prestigio.sql');
const prestigioSemComentarios = prestigio.split(/\r?\n/).map((l: string) => l.replace(/--.*$/, '')).join('\n');

describe('Fellas Inc., entrega 3 (0040–0041)', () => {
  it('não toca nos créditos do cassino', () => {
    for (const proibido of ['game_wallets', 'game_ledger', 'games_move', 'weekly_champion']) expect(prestigioSemComentarios).not.toContain(proibido);
  });
  it('sem reset: nada apaga estado, contrato ou conquista', () => {
    for (const proibido of ['delete from public.idle_state', 'delete from public.idle_contracts', 'delete from public.idle_conquistas', 'delete from public.idle_arvore'])
      expect(prestigioSemComentarios).not.toContain(proibido);
    expect(prestigioSemComentarios).not.toContain('games_week_start() and');
  });
  it('funções internas fechadas; as do jogo só para quem está logado', () => {
    for (const f of [
      'idle_est_codigos(smallint[])', 'idle_arv(uuid, text, text, double precision)', 'idle_arvore_efeitos(uuid)',
      'idle_bonus_mult(public.idle_state)', 'idle_rate_at(public.idle_state, timestamptz)', 'idle_social_mult(public.idle_state, timestamptz)',
      'idle_settle(public.idle_state, timestamptz)', 'idle_opp_list(public.idle_state, timestamptz)', 'idle_opp_cap(public.idle_state)',
      'idle_hire_price(public.idle_state)',
      'idle_prestige_total(double precision)', 'idle_ganhar(uuid, text, double precision, text)', 'idle_madrugada(timestamptz)',
      'idle_check_conquistas(uuid)', 'idle_save(public.idle_state)', 'idle_json(public.idle_state)', 'idle_weekly_reset()',
    ])
      expect(prestigio).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    for (const f of ['idle_open()', 'idle_start()', 'idle_buy(text, int, int)', 'idle_claim_opportunity(bigint)', 'idle_hire(uuid)', 'idle_buy_node(int)', 'idle_prestige()', 'idle_board()'])
      expect(prestigio).toContain(`grant execute on function public.${f} to authenticated;`);
  });
  it('conquistas e árvore com RLS e leitura só para membros; sem chave estrangeira pro catálogo (que é regravado)', () => {
    for (const t of ['idle_conquistas', 'idle_arvore']) {
      expect(prestigio).toContain(`alter table public.${t} enable row level security;`);
      expect(prestigio).toContain(`create policy "${t}_select_members" on public.${t} for select to authenticated using (public.is_member());`);
    }
    expect(prestigioSemComentarios).not.toMatch(/references public\.idle_cat_(conquista|no)/);
  });
  it('o catálogo novo é o gerado, com as conquistas, a árvore e a Filial em Portugal', () => {
    const cat = ler('0040_fellas_inc_catalogo_conquistas.sql');
    expect(cat).toContain('GERADO por games/idle/catalogo.ts');
    expect(cat).toContain('insert into public.idle_cat_conquista');
    expect(cat).toContain('insert into public.idle_cat_no');
    expect(cat).toContain("(283, 'gerador', 'Filial em Portugal'");
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/idlePrestigio.test.ts test/idleConquistas.test.ts`
Expected: FAIL (`idle_prestige` não existe; o placar não tem `pontos`; a foto não dá o "Pai tá on").

- [ ] **Step 3: Acrescentar no fim de `supabase/migrations/0041_fellas_inc_prestigio.sql`** (uma linha em branco antes):

```sql
-- ===== vender a startup =====

-- troca a empresa por pontos: ganha a diferença entre os pontos que o R$/s de agora vale e os que você já ganhou na
-- vida (gastos ou não; pelo menos 1, senão idle_prestige_low). Fecha a conta; quem você contratou fecha a conta antes
-- (o que você paga a eles muda: suas estratégias zeram) e os contratos que você fez vencem agora (quem te contratou
-- continua). Zera valuation, geradores, melhorias (as gerais ficam com o nó Leva a cultura junto), estratégias, boost
-- e meia-preço e volta pro "Abrir CNPJ". Ficam pontos, nós, vendas, conquistas, personagem, contadores, o limite de
-- oportunidades do dia e o recorde de R$/s.
-- Trava você e os contratados na ordem de user_id (como idle_pick_strategy).
create or replace function public.idle_prestige()
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s       public.idle_state;
  x       public.idle_state;
  v_me    uuid := auth.uid();
  v_team  uuid[];
  v_rate  double precision;
  v_total int;
  v_ganho int;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  select coalesce(array_agg(distinct c.employee_id), '{}'::uuid[]) into v_team
    from public.idle_contracts c
    join public.idle_state es on es.user_id = c.employee_id
   where c.employer_id = v_me and c.ends_at > es.settled_at;
  perform public.idle_lock_all(array[v_me] || v_team);
  select * into s from public.idle_state where user_id = v_me;
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s);
  v_rate := public.idle_rate(s);
  v_total := public.idle_prestige_total(v_rate);
  v_ganho := v_total - s.prestige_earned;
  if v_ganho < 1 then
    raise exception 'idle_prestige_low' using errcode = 'P0001';
  end if;
  for x in select es.* from public.idle_state es where es.user_id = any (v_team) loop
    perform public.idle_save(public.idle_settle(x));
  end loop;
  -- created_at < now(): um contrato criado neste mesmo instante não pode vencer antes de começar (check da tabela)
  update public.idle_contracts set ends_at = now()
   where employer_id = v_me and ends_at > now() and created_at < now();
  if v_ganho = 1 then
    perform public.idle_ganhar(v_me, 'aura_negativa');
  end if;
  if s.hire_total = 0 then
    perform public.idle_ganhar(v_me, 'sigma');
  end if;
  s.best_rate := greatest(s.best_rate, v_rate);
  s.prestige_earned := v_total;
  s.prestige_count := s.prestige_count + 1;
  s.started := false;
  s.valuation := 0;
  s.generators := array_fill(0, array[30]);
  s.upgrades := case when public.idle_arv(v_me, 'manter_gerais', 'max', 0) > 0
                     then array(select u from unnest(s.upgrades) u
                                 where u in (select g.id from public.idle_cat_upg g where g.tipo = 'geral'))
                     else '{}' end;
  s.strategies := '{-1,-1,-1,-1}';
  s.boost_until := null;
  s.half_price := false;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_prestige() from public, anon;
grant execute on function public.idle_prestige() to authenticated;

-- ===== placar e foto de segunda =====

-- placar (o da 0038) + pontos de prestígio ganhos na vida ("★ N") e quantas conquistas cada um tem
create or replace function public.idle_board()
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare v_mais uuid;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  v_mais := public.idle_most_hired(public.games_week_start());
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era, 'strategies', to_jsonb(x.strategies),
             'avatar', public.idle_avatar_json(x.user_id), 'hired_count', x.n, 'by_me', x.by_me,
             'most_hired', coalesce(x.user_id = v_mais, false), 'pontos', x.pontos, 'conquistas', x.nc)
             order by x.rate desc, x.v desc, x.user_id), '[]'::jsonb)
      from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_rate(s) as rate,
                   public.idle_era(s.generators) as era, s.strategies, s.prestige_earned as pontos,
                   (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)::int as nc,
                   (select count(*) from public.idle_contracts c
                     where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now())::int as n,
                   exists (select 1 from public.idle_contracts c
                            where c.employer_id = auth.uid() and c.employee_id = s.user_id
                              and c.created_at <= now() and c.ends_at > now()) as by_me
              from public.idle_state s
             where s.started) x);
end;
$$;

-- foto da semana que acabou (a da 0038) + "Pai tá on" pro unicórnio: a conta dele fecha antes (a conquista só vale
-- dali pra frente)
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date := public.games_week_start() - 7;
  v_podium jsonb;
  v_champ  uuid;
  v_gravou date;
  v_campeao public.idle_state;
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-semana')); -- uma foto por vez
  if exists (select 1 from public.idle_weeks where week_start = v_old) then
    return;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era,
                                               'strategies', to_jsonb(x.strategies)) order by x.rate desc, x.v desc, x.user_id), '[]')
    into v_podium
    from (select s.user_id,
                 (public.idle_settle(s, greatest(s.settled_at, v_new::timestamp at time zone 'America/Sao_Paulo'))).valuation as v,
                 -- a taxa da meia-noite usa os geradores e estratégias de agora (só os contratos são os de 00:00)
                 public.idle_rate_at(s, v_new::timestamp at time zone 'America/Sao_Paulo') as rate,
                 public.idle_era(s.generators) as era, s.strategies
            from public.idle_state s
           where s.started and s.week_start < v_new
           order by 3 desc, 2 desc, 1
           limit 3) x;
  if jsonb_array_length(v_podium) = 0 then
    return; -- ninguém jogava antes desta semana: sem placa
  end if;
  v_champ := (v_podium -> 0 ->> 'user_id')::uuid;
  insert into public.idle_weeks (week_start, unicorn_id, podium, most_hired_id)
  values (v_old, v_champ, v_podium, public.idle_most_hired(v_old))
  on conflict (week_start) do nothing
  returning week_start into v_gravou;
  if v_gravou is not null then
    update public.profiles set badges = array_remove(badges, 'weekly_unicorn') where 'weekly_unicorn' = any (badges);
    if v_champ is not null then
      update public.profiles set badges = array_append(badges, 'weekly_unicorn') where id = v_champ;
      if exists (select 1 from public.idle_cat_conquista k
                  where k.tipo = 'unicornio'
                    and not exists (select 1 from public.idle_conquistas c where c.user_id = v_champ and c.conquista_id = k.id)) then
        select * into v_campeao from public.idle_state where user_id = v_champ for update;
        perform public.idle_save(public.idle_settle(v_campeao));
        perform public.idle_ganhar(v_champ, 'unicornio');
      end if;
    end if;
  end if;
end;
$$;

revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;
revoke all on function public.idle_weekly_reset() from public, anon, authenticated;

-- ===== o que já aconteceu antes desta migração (rodar de novo não muda nada) =====

update public.idle_state set upg_total = cardinality(upgrades) where upg_total < cardinality(upgrades);
update public.idle_state s set hire_total = x.n
  from (select c.employer_id, count(*)::int as n from public.idle_contracts c group by c.employer_id) x
 where x.employer_id = s.user_id and s.hire_total < x.n;
update public.idle_state s set hired_total = x.n
  from (select c.employee_id, count(*)::int as n from public.idle_contracts c group by c.employee_id) x
 where x.employee_id = s.user_id and s.hired_total < x.n;
update public.idle_state set est_usadas = public.idle_est_codigos(strategies)
 where est_usadas = '{}' and cardinality(public.idle_est_codigos(strategies)) > 0;
-- quem já foi unicórnio ganha o "Pai tá on" (conta fechada antes, como na foto)
do $$
declare s public.idle_state;
begin
  for s in select st.* from public.idle_state st
            where exists (select 1 from public.idle_weeks w where w.unicorn_id = st.user_id)
              and exists (select 1 from public.idle_cat_conquista k
                           where k.tipo = 'unicornio'
                             and not exists (select 1 from public.idle_conquistas c
                                              where c.user_id = st.user_id and c.conquista_id = k.id))
            order by st.user_id
            for update loop
    perform public.idle_save(public.idle_settle(s));
    perform public.idle_ganhar(s.user_id, 'unicornio');
  end loop;
end;
$$;
```

- [ ] **Step 4: Rodar e ver passar (banco e as travas do app)**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run && npx tsc --noEmit && cd .. && npx jest __tests__/fellasIncMigration.test.ts __tests__/safeUpdateMigrations.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add supabase/migrations/0041_fellas_inc_prestigio.sql games/test/idlePrestigio.test.ts games/test/idleConquistas.test.ts __tests__/fellasIncMigration.test.ts && git commit -m "Fellas Inc.: vender a startup, pontos no placar e Pai tá on na foto (0041, parte 4)"
```

---

### Task 7: Chamadas, formatos, erros e o `?mock`

**Files:**
- Modify: `games/shared/types.ts`, `games/shared/api.ts`, `games/shared/errors.ts`, `games/shared/types.test.ts`,
  `games/shared/errors.test.ts`, `games/dev/mockDb.ts`, `games/dev/mockIdle.ts`, `games/idle/store.test.ts` e
  `games/idle/tela.test.ts` (só as fixtures)

**Interfaces:**
- Consome: o formato do estado e do placar das Tasks 4–6.
- Produz: `IdleState` + `bonus: { arvore: number[]; conquistas: number }`, `pontos`, `pontos_vida`, `vendas`,
  `recorde`, `pontos_venda: number`, `conquistas: IdleConquista[]`, `novas: number[]`, `descobertas: number[]`;
  `IdleConquista = { id: number; em: string }`; `IdleBoardRow`/`LinhaPlacar` + `pontos: number; conquistas: number`;
  `idlePrestige(): Promise<IdleState>` e `idleBuyNode(no: number): Promise<IdleState>` (em `shared/api.ts` e em
  `dev/mockIdle.ts`); erros `idle_prestige_low` ("Ainda não compensa vender"), `idle_points_low` ("Faltam pontos de
  prestígio pra esse nó"), `idle_node_owned` ("Você já tem esse nó"); `dono(sql, params)` em `dev/mockDb.ts`;
  `__vendavel(foguetes = 150)` no console do `?mock`.

- [ ] **Step 1: Testes**

Em `games/shared/types.test.ts`, a linha do banco ganha `pontos: 12, conquistas: 7` e a esperada também:

```ts
        { user_id: 'b', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hired_count: 3, by_me: true, most_hired: true, pontos: 12, conquistas: 7 },
```

```ts
    ).toEqual({ userId: 'b', name: 'Bia', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hiredCount: 3, byMe: true, mostHired: true, pontos: 12, conquistas: 7 });
```

Em `games/shared/errors.test.ts`, no `it.each` de `'erros da Fellas Inc.'`, depois de
`['idle_bad_avatar', 'Esse visual não existe'],` acrescente:

```ts
    ['idle_prestige_low', 'Ainda não compensa vender'],
    ['idle_points_low', 'Faltam pontos de prestígio pra esse nó'],
    ['idle_node_owned', 'Você já tem esse nó'],
```

Em `games/idle/store.test.ts` (fixture `base`) e em `games/idle/tela.test.ts` (fixture `estado`), depois da linha
`  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,` acrescente:

```ts
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
```

Em `games/idle/tela.test.ts`, as duas linhas de placar montadas à mão ganham os campos novos: no teste
`'placar mostra o R$/s de cada um, não o valuation'`, troque
`avatar: null, hiredCount: 0, byMe: false, mostHired: false }] }));` por
`avatar: null, hiredCount: 0, byMe: false, mostHired: false, pontos: 0, conquistas: 0 }] }));`; e na fábrica `linha`, troque
`  avatar: null, hiredCount: 0, byMe: false, mostHired: false, ...x,` por
`  avatar: null, hiredCount: 0, byMe: false, mostHired: false, pontos: 0, conquistas: 0, ...x,`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run shared/ && npx tsc --noEmit`
Expected: FAIL (`linhaPlacar` não copia `pontos`; os erros novos viram `unknown`; o `tsc` reclama dos campos que o tipo
ainda não tem).

- [ ] **Step 3: `games/shared/types.ts`** — troque cada trecho, na ordem:

1. Trecho:

```ts
  social: { contratei: number; empregos: number[] }; hire_price: number; muda_em: string | null;
```

   vira:

```ts
  social: { contratei: number; empregos: number[] }; hire_price: number; muda_em: string | null;
  /** Entrega 3 (0041): os nós da árvore que você comprou e quantas conquistas você tem (o que entra na conta), pontos de
   *  prestígio livres e ganhos na vida, quantas vezes vendeu, o recorde de R$/s, quantos pontos vender agora daria, suas
   *  conquistas, as ganhas nesta chamada (a tela avisa) e as escondidas que alguém do grupo já tem. */
  bonus: { arvore: number[]; conquistas: number }; pontos: number; pontos_vida: number; vendas: number; recorde: number;
  pontos_venda: number;
  conquistas: IdleConquista[]; novas: number[]; descobertas: number[];
```

2. Trecho:

```ts
  conquistas: IdleConquista[]; novas: number[]; descobertas: number[];
};
```

   vira:

```ts
  conquistas: IdleConquista[]; novas: number[]; descobertas: number[];
};
export type IdleConquista = { id: number; em: string };
```

3. Trecho:

```ts
  avatar: IdleVisual | null; hiredCount: number; byMe: boolean; mostHired: boolean;
```

   vira:

```ts
  avatar: IdleVisual | null; hiredCount: number; byMe: boolean; mostHired: boolean;
  /** Pontos de prestígio ganhos na vida e quantas conquistas (0041). */
  pontos: number; conquistas: number;
```

4. Trecho:

```ts
  user_id: string; valuation: number; rate: number; era: number; strategies: number[];
  avatar: IdleVisual | null; hired_count: number; by_me: boolean; most_hired: boolean;
```

   vira:

```ts
  user_id: string; valuation: number; rate: number; era: number; strategies: number[];
  avatar: IdleVisual | null; hired_count: number; by_me: boolean; most_hired: boolean; pontos: number; conquistas: number;
```

5. Trecho:

```ts
  userId: r.user_id, name, valuation: r.valuation, rate: r.rate, era: r.era, strategies: r.strategies,
  avatar: r.avatar, hiredCount: r.hired_count, byMe: r.by_me, mostHired: r.most_hired,
```

   vira:

```ts
  userId: r.user_id, name, valuation: r.valuation, rate: r.rate, era: r.era, strategies: r.strategies,
  avatar: r.avatar, hiredCount: r.hired_count, byMe: r.by_me, mostHired: r.most_hired, pontos: r.pontos, conquistas: r.conquistas,
```

- [ ] **Step 4: `games/shared/api.ts` e `games/shared/errors.ts`**

1. Trecho:

```ts
export const idleHire = (userId: string) => rpc<IdleState>('idle_hire', { p_user: userId });
```

   vira:

```ts
export const idleHire = (userId: string) => rpc<IdleState>('idle_hire', { p_user: userId });
export const idlePrestige = () => rpc<IdleState>('idle_prestige');
export const idleBuyNode = (no: number) => rpc<IdleState>('idle_buy_node', { p_no: no });
```

1. Trecho:

```ts
  | 'idle_hire_self' | 'idle_hire_twice' | 'idle_hire_not_open' | 'idle_bad_avatar'
```

   vira:

```ts
  | 'idle_hire_self' | 'idle_hire_twice' | 'idle_hire_not_open' | 'idle_bad_avatar'
  | 'idle_prestige_low' | 'idle_points_low' | 'idle_node_owned'
```

2. Trecho:

```ts
  idle_bad_avatar: 'Esse visual não existe',
```

   vira:

```ts
  idle_bad_avatar: 'Esse visual não existe',
  idle_prestige_low: 'Ainda não compensa vender',
  idle_points_low: 'Faltam pontos de prestígio pra esse nó',
  idle_node_owned: 'Você já tem esse nó',
```

3. Trecho:

```ts
  'idle_hire_self', 'idle_hire_twice', 'idle_hire_not_open', 'idle_bad_avatar',
```

   vira:

```ts
  'idle_hire_self', 'idle_hire_twice', 'idle_hire_not_open', 'idle_bad_avatar',
  'idle_prestige_low', 'idle_points_low', 'idle_node_owned',
```

- [ ] **Step 5: `?mock`**

Em `games/dev/mockDb.ts`, logo antes do comentário de `export function call<T>(...)` (`/** Roda ... como authenticated ... */`), acrescente:

```ts
/** Roda `sql` como dono do banco (bots e atalhos do dev), na mesma fila das chamadas. */
export function dono(sql: string, params: unknown[] = []): Promise<void> {
  const run = queue.then(async () => {
    const db = await ready;
    await db.query(sql, params);
  });
  queue = run.catch(() => undefined);
  return run;
}

/** Roda `sql` (que devolve uma coluna `v`) como `authenticated`, no papel de `as`. */
```

Em `games/dev/mockIdle.ts`, troque cada trecho, na ordem:

1. Trecho:

```ts
// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa e têm personagem (dá pra contratar). Nunca entra no build.
```

   vira:

```ts
// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa, têm personagem (dá pra contratar), pontos de prestígio, nós da
// árvore e conquistas (uma escondida, pra aba Legado mostrar o "???"). Nunca entra no build.
```

2. Trecho:

```ts
import { linhaPlacar, type IdleBoardRow, type IdleState, type IdleVisual, type LinhaPlacar } from '../shared/types';
import { call, FRIENDS, ME } from './mockDb';
```

   vira:

```ts
import { linhaPlacar, type IdleBoardRow, type IdleState, type IdleVisual, type LinhaPlacar } from '../shared/types';
import { call, dono, FRIENDS, ME } from './mockDb';
```

3. Trecho:

```ts
    as,
  );

```

   vira:

```ts
    as,
  );

// prestígio dos bots: [pontos ganhos na vida, nós da árvore, conquistas]. Oliveira já vendeu e tem a 6-7 (escondida)
const LEGADO: [number, number[], number[]][] = [[12, [1, 11, 21, 41], [1, 31, 39, 47, 51, 101]], [3, [1], [31, 47]], [0, [], []]];

```

4. Trecho:

```ts
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
```

   vira:

```ts
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
    const [ganhos, nos, conquistas] = LEGADO[i % LEGADO.length];
    const gastos = nos.reduce((a, n) => a + (n === 1 ? 1 : 2), 0); // a raiz custa 1; o 1º de cada ramo, 2
    await dono('update public.idle_state set prestige_earned = $2, prestige_spent = $3, prestige_count = $4 where user_id = $1',
      [id, ganhos, gastos, ganhos ? 1 : 0]);
    for (const n of nos) await dono('insert into public.idle_arvore (user_id, no_id) values ($1, $2) on conflict do nothing', [id, n]);
    for (const c of conquistas) {
      await dono('insert into public.idle_conquistas (user_id, conquista_id) values ($1, $2) on conflict do nothing', [id, c]);
    }
```

5. Trecho:

```ts
export const idleSetAvatar = (v: IdleVisual) => avatar(v);
```

   vira:

```ts
export const idleSetAvatar = (v: IdleVisual) => avatar(v);
export const idlePrestige = () => call<IdleState>('select public.idle_prestige() as v');
export const idleBuyNode = (no: number) => call<IdleState>('select public.idle_buy_node($1) as v', [no]);
```

6. Trecho:

```ts

// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar
const w = window as unknown as { __rico: (v: number) => Promise<void>; __meContrata: () => Promise<void> };
```

   vira:

```ts

// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar;
// __vendavel() deixa sua empresa valendo uns 7 pontos de prestígio (150 foguetes, estratégias escolhidas)
const w = window as unknown as {
  __rico: (v: number) => Promise<void>; __meContrata: () => Promise<void>; __vendavel: (foguetes?: number) => Promise<void>;
};
```

7. Trecho:

```ts
  await call('select public.idle_hire($1) as v', [ME], bot);
};
```

   vira:

```ts
  await call('select public.idle_hire($1) as v', [ME], bot);
};
w.__vendavel = async (foguetes = 150) => {
  await dono(`update public.idle_state set generators[30] = $2, strategies = '{0,0,0,0}' where user_id = $1`, [ME, foguetes]);
  document.dispatchEvent(new Event('visibilitychange')); // a página bate o ponto e mostra
};
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run shared/ idle/`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/shared games/dev games/idle/store.test.ts games/idle/tela.test.ts && git commit -m "Fellas Inc.: formatos, idlePrestige, idleBuyNode, erros novos e o ?mock com o legado"
```

---

### Task 8: O que a aba Legado mostra (`legado.ts`), o teto e a caixinha na página (`store.ts`) e os ícones (`ativos.ts`)

**Files:**
- Create: `games/idle/legado.ts`, `games/idle/legado.test.ts`
- Modify: `games/idle/store.ts`, `games/idle/store.test.ts`, `games/idle/ativos.ts`, `games/idle/ativos.test.ts`

**Interfaces:**
- Consome: `IdleState` (Task 7); `catalogo.conquistas`, `catalogo.arvore`, `No`, `Conquista`, `RAMOS` (Task 1);
  `efeitosDe`, `acumular(..., tetoS)` (Task 2); `Caixa` (Task 2).
- Produz (`legado.ts`): `Celula = { conquista, ganhou, nome, texto, em }`, `TOTAL_CONQUISTAS`, `grade(estado)`,
  `ganhouEm(iso)`, `avisos(ids)`, `pontos(n)`, `textoVenda(n)`, `criarFilaAvisos(mostrar, ms = 3000)`,
  `SituacaoNo = 'comprado' | 'disponivel' | 'trancado'`, `situacao(no, arvore)`, `RAMOS_ARVORE: { ramo, nome, nos }[]`,
  `falta(no)`.
- Produz (`store.ts`): `efeitos(estado): EfeitosArvore`, `caixa(estado): Caixa`; `valuationAgora` com o teto da árvore.
- Produz (`ativos.ts`): `ativos.conquista(id): string | null`, `ativos.no(id): string | null`.

- [ ] **Step 1: Testes**

Crie `games/idle/legado.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { avisos, criarFilaAvisos, falta, ganhouEm, grade, pontos, RAMOS_ARVORE, situacao, textoVenda, TOTAL_CONQUISTAS } from './legado';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { arvore: [], conquistas: 0 }, pontos: 0, pontos_vida: 0, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [],
  descobertas: [],
  ...x,
});
const EM = '2026-10-12T15:00:00.000Z';

describe('grade de conquistas', () => {
  it('sem nenhuma: só as visíveis, bloqueadas, com a condição', () => {
    const g = grade(estado());
    expect(g).toHaveLength(catalogo.conquistas.filter((c) => !c.escondida).length);
    expect(g.every((c) => !c.ganhou && !c.conquista.escondida)).toBe(true);
    expect(g[6]).toMatchObject({ nome: 'Estágio não remunerado em escala', texto: 'Ter 100 "Estagiário"', em: null });
  });
  it('ganha: a frase e a data; escondida que você tem aparece com o nome', () => {
    const g = grade(estado({ conquistas: [{ id: 7, em: EM }, { id: 101, em: EM }], descobertas: [101] }));
    expect(g.find((c) => c.conquista.id === 7)).toMatchObject({ ganhou: true, texto: 'Cem estagiários, uma cafeteira.', em: EM });
    expect(g.find((c) => c.conquista.id === 101)).toMatchObject({ ganhou: true, nome: '6-7', texto: 'Seis sete. Ninguém sabe por quê.' });
  });
  it('escondida que alguém do grupo tem e você não: ???; que ninguém tem: não aparece', () => {
    const g = grade(estado({ descobertas: [102] }));
    expect(g.find((c) => c.conquista.id === 102)).toMatchObject({ ganhou: false, nome: '???', texto: 'Alguém do grupo conseguiu' });
    expect(g.find((c) => c.conquista.id === 103)).toBeUndefined();
  });
  it('conquista que a página não conhece (o banco é mais novo) fica de fora', () => {
    expect(grade(estado({ conquistas: [{ id: 999, em: EM }] })).some((c) => c.conquista.id === 999)).toBe(false);
  });
  it('total = todas as do catálogo, escondidas inclusive', () => {
    expect(TOTAL_CONQUISTAS).toBe(catalogo.conquistas.length);
  });
});

describe('textos', () => {
  it('aviso por conquista nova; id desconhecido some', () => {
    expect(avisos([101, 999, 1])).toEqual(['Conquista: 6-7', 'Conquista: Cem abas abertas']);
  });
  it('venda e pontos no singular e no plural', () => {
    expect(pontos(1)).toBe('1 ponto');
    expect(pontos(5)).toBe('5 pontos');
    expect(textoVenda(1)).toBe('Você ganha 1 ponto pra gastar na árvore e recomeça do zero.');
    expect(textoVenda(12)).toBe('Você ganha 12 pontos pra gastar na árvore e recomeça do zero.');
  });
  it('data no dia de Brasília', () => {
    expect(ganhouEm('2026-10-13T02:30:00.000Z')).toBe('Ganhou em 12/10/2026');
  });
});

describe('fila de avisos', () => {
  afterEach(() => vi.useRealTimers());
  it('um de cada vez, 3 s cada, e depois some', () => {
    vi.useFakeTimers();
    const vistos: (string | null)[] = [];
    const fila = criarFilaAvisos((t) => vistos.push(t));
    fila.adicionar(['Conquista: 6-7', 'Conquista: Exit']);
    expect(vistos).toEqual(['Conquista: 6-7']);
    fila.adicionar(['Conquista: Black Friday']);
    vi.advanceTimersByTime(2999);
    expect(vistos).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(vistos.at(-1)).toBe('Conquista: Exit');
    vi.advanceTimersByTime(3000);
    expect(vistos.at(-1)).toBe('Conquista: Black Friday');
    vi.advanceTimersByTime(3000);
    expect(vistos.at(-1)).toBeNull();
    fila.adicionar([]);
    expect(vistos.at(-1)).toBeNull();
  });
});

describe('árvore', () => {
  it('a raiz e os 5 ramos, na ordem, com 5 nós cada', () => {
    expect(RAMOS_ARVORE.map((r) => [r.nome, r.nos.length])).toEqual([
      ['Fundador', 1], ['Produção', 5], ['Recomeço', 5], ['Oportunidades', 5], ['Tempo', 5], ['Gente', 5],
    ]);
  });
  it('comprado, disponível (o anterior é seu) ou trancado (falta o anterior)', () => {
    const no = (id: number) => catalogo.arvore.find((n) => n.id === id)!;
    expect(situacao(no(1), [])).toBe('disponivel');
    expect(situacao(no(11), [])).toBe('trancado');
    expect(situacao(no(11), [1])).toBe('disponivel');
    expect(situacao(no(12), [1])).toBe('trancado');
    expect(situacao(no(11), [1, 11])).toBe('comprado');
    expect(falta(no(12))).toBe('Precisa de Café sem açúcar');
    expect(falta(no(11))).toBe('Precisa de Fundador');
    expect(falta(no(1))).toBe('');
  });
});
```

Em `games/idle/store.test.ts`, no import de `./store`, acrescente `caixa` (logo depois de `ancorar,`) e, no
`describe('âncora no relógio do banco', ...)`, antes de `it('início da semana: segunda 00:00 de Brasília', ...)`, acrescente:

```ts
  it('teto do offline: 8h, ou o do ramo Tempo da árvore', () => {
    expect(valuationAgora(ancorar(base(), 0), 20 * 3600_000)).toBeCloseTo(100 + 2 * 8 * 3600, 6);
    expect(valuationAgora(ancorar(base({ bonus: { arvore: [1, 41], conquistas: 0 } }), 0), 20 * 3600_000)).toBeCloseTo(100 + 2 * 12 * 3600, 6);
  });
  it('caixinha: 3 por 4h, ou o que o ramo Oportunidades der', () => {
    expect(caixa(base())).toEqual({ tamanho: 3, validadeS: 4 * 3600 });
    expect(caixa(base({ bonus: { arvore: [1, 31, 32], conquistas: 0 } }))).toEqual({ tamanho: 4, validadeS: 6 * 3600 });
  });
```

Em `games/idle/ativos.test.ts`, no `describe('ativos da Fellas Inc.', ...)`, acrescente:

```ts
  it('ícone de conquista ou de nó que não existe: null (a célula mostra só a moldura)', () => {
    expect(ativos.conquista(999)).toBeNull();
    expect(ativos.no(99)).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/legado.test.ts idle/store.test.ts idle/ativos.test.ts`
Expected: FAIL (`./legado` não existe; `caixa`, `ativos.conquista`, `ativos.no` não existem; o teto é sempre 8h).

- [ ] **Step 3: Criar `games/idle/legado.ts`**

```ts
// Aba Legado da Fellas Inc. (a árvore de habilidades e as conquistas) e o aviso de conquista. Puro: a tela só desenha
// o que sai daqui. Quem comprou ou ganhou o quê é o banco que decide; aqui só se decide o que cada quadradinho mostra.
import type { IdleState } from '../shared/types';
import { catalogo, type Conquista, type No } from './catalogo';
import { RAMOS } from './nomes';

/** Um quadradinho da grade. `texto` = a frase (ganhou), a condição (bloqueada) ou "Alguém do grupo conseguiu". */
export type Celula = { conquista: Conquista; ganhou: boolean; nome: string; texto: string; em: string | null };

export const TOTAL_CONQUISTAS = catalogo.conquistas.length;

/** A grade, na ordem do catálogo. Escondida que ninguém do grupo tem não aparece; escondida que alguém tem e você não:
 *  "???". Conquista que o catálogo da página ainda não conhece (página velha) fica de fora. */
export function grade(estado: IdleState): Celula[] {
  const minhas = new Map(estado.conquistas.map((c) => [c.id, c.em]));
  const descobertas = new Set(estado.descobertas);
  const out: Celula[] = [];
  for (const c of catalogo.conquistas) {
    const em = minhas.get(c.id) ?? null;
    if (em) out.push({ conquista: c, ganhou: true, nome: c.nome, texto: c.frase, em });
    else if (!c.escondida) out.push({ conquista: c, ganhou: false, nome: c.nome, texto: c.condicao, em: null });
    else if (descobertas.has(c.id)) out.push({ conquista: c, ganhou: false, nome: '???', texto: 'Alguém do grupo conseguiu', em: null });
  }
  return out;
}

/** "Ganhou em 10/10/2026" (dia de Brasília). */
export const ganhouEm = (iso: string): string =>
  `Ganhou em ${new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

/** "Conquista: 6-7", uma por id novo, na ordem que o banco mandou. */
export function avisos(ids: number[]): string[] {
  const out: string[] = [];
  for (const id of ids) {
    const c = catalogo.conquistas.find((x) => x.id === id);
    if (c) out.push(`Conquista: ${c.nome}`);
  }
  return out;
}

/** "1 ponto" / "5 pontos". */
export const pontos = (n: number): string => `${n} ${n === 1 ? 'ponto' : 'pontos'}`;

/** O texto da folha de confirmação da venda. */
export const textoVenda = (n: number): string => `Você ganha ${pontos(n)} pra gastar na árvore e recomeça do zero.`;

/** Fila dos avisos de conquista: um de cada vez, `ms` cada. `mostrar(null)` = nenhum na tela. */
export function criarFilaAvisos(mostrar: (texto: string | null) => void, ms = 3000) {
  const fila: string[] = [];
  let ativo = false;
  const proximo = () => {
    const t = fila.shift();
    ativo = t !== undefined;
    mostrar(t ?? null);
    if (t !== undefined) setTimeout(proximo, ms);
  };
  return {
    adicionar(textos: string[]) {
      fila.push(...textos);
      if (!ativo && fila.length) proximo();
    },
  };
}

/** Como um nó aparece: comprado (aceso), disponível (o anterior do ramo já é seu) ou trancado (falta o anterior). */
export type SituacaoNo = 'comprado' | 'disponivel' | 'trancado';
export function situacao(no: No, arvore: readonly number[]): SituacaoNo {
  if (arvore.includes(no.id)) return 'comprado';
  return no.requer === null || arvore.includes(no.requer) ? 'disponivel' : 'trancado';
}

/** A raiz e os 5 ramos, na ordem, cada um com os seus nós. */
export const RAMOS_ARVORE: { ramo: number; nome: string; nos: No[] }[] = RAMOS.map((nome, ramo) => ({
  ramo, nome, nos: catalogo.arvore.filter((n) => n.ramo === ramo),
}));

/** O que falta pra um nó trancado: "Precisa de Café sem açúcar". */
export function falta(no: No): string {
  const antes = catalogo.arvore.find((n) => n.id === no.requer);
  return antes ? `Precisa de ${antes.nome}` : '';
}
```

- [ ] **Step 4: `games/idle/store.ts` e `games/idle/ativos.ts`** — troque cada trecho, na ordem:

1. Trecho:

```ts
import { catalogo } from './catalogo';
import { acumular, estrategiasAtivas } from './economia';
```

   vira:

```ts
import { catalogo } from './catalogo';
import { acumular, efeitosDe, estrategiasAtivas } from './economia';
import type { Caixa } from './oportunidades';
```

2. Trecho:

```ts
export const inicioSemana = (estado: IdleState): number => Date.parse(estado.week_start + 'T00:00:00-03:00');

```

   vira:

```ts
export const inicioSemana = (estado: IdleState): number => Date.parse(estado.week_start + 'T00:00:00-03:00');

/** O que a árvore do estado faz (teto do offline, caixinha, validade…): a mesma conta do banco. */
export const efeitos = (estado: IdleState) => efeitosDe(catalogo, estado);
export function caixa(estado: IdleState): Caixa {
  const e = efeitos(estado);
  return { tamanho: e.caixinha, validadeS: e.validadeS };
}

```

3. Trecho:

```ts
  const boost = a.estado.boost_until ? Date.parse(a.estado.boost_until) : null;
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost);
```

   vira:

```ts
  const boost = a.estado.boost_until ? Date.parse(a.estado.boost_until) : null;
  return acumular(a.estado.valuation, a.estado.rate, a.servidorMs, agoraServidor(a, clienteMs), boost, efeitos(a.estado).tetoS);
```

1. Trecho:

```ts
const gerais = pegar(import.meta.glob('./assets/gerais/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
```

   vira:

```ts
const gerais = pegar(import.meta.glob('./assets/gerais/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const conquistas = pegar(import.meta.glob('./assets/conquistas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const arvore = pegar(import.meta.glob('./assets/arvore/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
```

2. Trecho:

```ts
  geral: (id: number): string | null => gerais[`geral-${id}`] ?? null,
```

   vira:

```ts
  geral: (id: number): string | null => gerais[`geral-${id}`] ?? null,
  /** Ícone 16x16 da conquista (null = a arte ainda não chegou). */
  conquista: (id: number): string | null => conquistas[`conquista-${String(id).padStart(3, '0')}`] ?? null,
  /** Ícone 16x16 do nó da árvore (null = a arte ainda não chegou). */
  no: (id: number): string | null => arvore[`no-${String(id).padStart(2, '0')}`] ?? null,
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run idle/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/legado.ts games/idle/legado.test.ts games/idle/store.ts games/idle/store.test.ts games/idle/ativos.ts games/idle/ativos.test.ts && git commit -m "Fellas Inc.: grade de conquistas, situação dos nós, teto e caixinha da árvore na página"
```

---

### Task 9: A página: aba Legado, vender a startup, comprar nós, aviso na cena e ★ no placar

**REQUIRED:** skill `impeccable` (modo Operate, plataforma adaptive); leia `PRODUCT.md` e `DESIGN.md` antes. O código
abaixo é a base aprovada no plano; ajustes de apresentação que a skill pedir não mudam texto, dado nem comportamento
testado.

**Files:**
- Modify: `games/idle/tela.ts`, `games/idle/idle.css`, `games/idle/main.ts` (edições pontuais: o que já está na `main`
  fica, inclusive Compradas, o placar "+R$ X/s" com "Era N · nome", folhas, `vigiarVersao`, editor e aba Contratar)
- Test: `games/idle/tela.test.ts`

**Interfaces:**
- Consome: `legado.ts` e `caixa` (Task 8); `idlePrestige`, `idleBuyNode`, `IdleState` novo, `IdleBoardRow.pontos`
  (Task 7); `pendentes(..., caixa)` (Task 2).
- Produz: `Aba` + `'legado'`; `Modelo.vendaAberta: boolean`, `Modelo.conquistaAviso: string | null`;
  `Acoes.vender(acao: 'abrir' | 'fechar' | 'confirmar')`, `Acoes.comprarNo(id: number)`.
  O Legado aparece na aba e também embaixo do "Abrir CNPJ" de quem já vendeu (`pontos_vida > 0`), para gastar os
  pontos (Recomeço inclusive) antes de reabrir.

- [ ] **Step 1: Testes (`games/idle/tela.test.ts`)**

Troque `import { PADRAO } from './personagem';` por:

```ts
import { catalogo } from './catalogo';
import { PADRAO } from './personagem';
```

Na fábrica `modelo`, troque `pendentes: [], aoVivo: null, caixaAberta: false, editor: null, placarFalhou: false, ...x,` por:

```ts
pendentes: [], aoVivo: null, caixaAberta: false, editor: null, placarFalhou: false,
  vendaAberta: false, conquistaAviso: null, ...x,
```

No `beforeEach`, o objeto `acoes` ganha, depois de `mudarVisual: vi.fn<Acoes['mudarVisual']>(),`, a linha
`    vender: vi.fn<Acoes['vender']>(), comprarNo: vi.fn<Acoes['comprarNo']>(),`.

No teste `'modais com aria-modal e título'`, troque o `renderizar` e a lista de seletores por:

```ts
    tela.renderizar(modelo({
      estado: estado({ era: 2, generators: [1, 1, 1, 1, 1, 1, 1, ...Array(23).fill(0)], pontos_venda: 1 }),
      caixaAberta: true, editor: { ...PADRAO }, vendaAberta: true,
    }));
    for (const sel of ['.modal-estrategia', '.modal-caixa', '.modal-visual', '.modal-venda']) {
```

No fim do arquivo, acrescente:

```ts
describe('legado: prestígio, árvore e conquistas', () => {
  const EM = '2026-10-12T15:00:00.000Z';
  it('card: pontos pra gastar, ganhos na vida e recorde; sem ponto a ganhar, "Ainda não compensa" apagado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos: 3, pontos_vida: 12, vendas: 2, recorde: 1234.5 }) }));
    const card = root.querySelector('.prestigio')!;
    expect(card.textContent).toContain('★ 3 pontos pra gastar');
    expect(card.textContent).toContain('12 ganhos na vida · recorde +R$ 1,23 mil/s · vendeu 2 vezes');
    const b = card.querySelector('button')!;
    expect(b.textContent).toBe('Ainda não compensa');
    expect(b.disabled).toBe(true);
  });
  it('vender: o botão diz quantos pontos e abre a folha; a folha confirma ou fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }) }));
    const b = root.querySelector<HTMLButtonElement>('.prestigio button')!;
    expect(b.textContent).toBe('Vender a startup · +5 pontos');
    b.click();
    expect(acoes.vender).toHaveBeenCalledWith('abrir');
    expect(root.querySelector('.modal-venda')!.hasAttribute('hidden')).toBe(true);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }), vendaAberta: true }));
    const folha = root.querySelector('.modal-venda')!;
    expect(folha.hasAttribute('hidden')).toBe(false);
    expect(folha.textContent).toContain('Vender a startup?');
    expect(folha.textContent).toContain('Você ganha 5 pontos pra gastar na árvore e recomeça do zero.');
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Vender')!.click();
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Deixa quieto')!.click();
    expect(acoes.vender.mock.calls.map((c) => c[0])).toEqual(['abrir', 'confirmar', 'fechar']);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 5 }), vendaAberta: true, ocupado: true }));
    expect([...root.querySelectorAll<HTMLButtonElement>('.modal-venda button')].find((x) => x.textContent === 'Vender')!.disabled).toBe(true);
    // não compensa mais (o banco recusou e a tela recarregou): a folha some
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos_venda: 0 }), vendaAberta: true }));
    expect(root.querySelector('.modal-venda')!.hasAttribute('hidden')).toBe(true);
  });
  it('árvore: raiz e 5 ramos; comprado aceso, disponível com "Comprar · N ★" (apagado sem pontos), trancado com o que falta', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado', estado: estado({ pontos: 3, bonus: { arvore: [1, 11], conquistas: 0 } }) }));
    expect([...root.querySelectorAll('.ramo .ramo-nome')].map((h) => h.textContent)).toEqual(
      ['Fundador', 'Produção', 'Recomeço', 'Oportunidades', 'Tempo', 'Gente'],
    );
    const no = (nome: string) => [...root.querySelectorAll<HTMLElement>('.no')].find((x) => x.querySelector('strong')!.textContent === nome)!;
    expect(no('Café sem açúcar').classList.contains('comprado')).toBe(true);
    expect(no('Café sem açúcar').textContent).toContain('Comprado');
    expect(no('Planilha de metas').querySelector('button')!.textContent).toBe('Comprar · 4 ★');
    expect(no('Planilha de metas').querySelector('button')!.disabled).toBe(true); // custa 4, tem 3
    const pe = no('Pé-de-meia').querySelector('button')!;
    expect(pe.disabled).toBe(false);
    pe.click();
    expect(acoes.comprarNo).toHaveBeenCalledWith(21);
    expect(no('Alta performance').classList.contains('trancado')).toBe(true);
    expect(no('Alta performance').textContent).toContain('Precisa de Planilha de metas');
    expect(no('Alta performance').querySelector('button')).toBeNull();
  });
  it('conquistas: N/total; tocar mostra a condição ou a frase e a data; escondida só quando alguém conseguiu', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      aba: 'legado',
      estado: estado({ conquistas: [{ id: 7, em: EM }], descobertas: [102], bonus: { arvore: [], conquistas: 1 } }),
    }));
    const lista = root.querySelector('.lista-legado')!;
    expect(lista.hasAttribute('hidden')).toBe(false);
    expect(lista.textContent).toContain(`Conquistas 1/${catalogo.conquistas.length} · +1% de produção`);
    const celulas = [...lista.querySelectorAll<HTMLButtonElement>('.conquista')];
    expect(celulas.map((c) => c.textContent)).toContain('???');
    expect(celulas.map((c) => c.textContent)).not.toContain('Aura negativa');
    celulas.find((c) => c.textContent === 'Estágio não remunerado em escala')!.click();
    let det = root.querySelector('.conquista-detalhe')!;
    expect(det.textContent).toContain('Cem estagiários, uma cafeteira.');
    expect(det.textContent).toContain('Ganhou em 12/10/2026');
    [...root.querySelectorAll<HTMLButtonElement>('.conquista')].find((c) => c.textContent === 'Cem abas abertas')!.click();
    det = root.querySelector('.conquista-detalhe')!;
    expect(det.textContent).toContain('Ter 100 "Você, no notebook da faculdade"');
    expect(det.textContent).not.toContain('Ganhou em');
  });
  it('sem a arte dos ícones, nó e conquista mostram só a moldura', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'legado' }));
    for (const sel of ['.no .icone-legado', '.conquista .icone-legado']) {
      const icone = root.querySelector<HTMLElement>(sel)!;
      expect(icone.classList.contains('sem-arte') || icone.style.backgroundImage.includes('url('), sel).toBe(true);
    }
  });
  it('aviso de conquista por cima da cena', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ conquistaAviso: 'Conquista: 6-7' }));
    const aviso = root.querySelector('.palco .conquista-aviso')!;
    expect(aviso.hasAttribute('hidden')).toBe(false);
    expect(aviso.textContent).toBe('Conquista: 6-7');
    tela.renderizar(modelo());
    expect(root.querySelector('.palco .conquista-aviso')!.hasAttribute('hidden')).toBe(true);
  });
  it('placar: ★ N (ganhos na vida) ao lado do R$/s de quem tem', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [linha({ pontos: 12 }), linha({ userId: 'c', name: 'Teteu' })] }));
    const itens = root.querySelectorAll('.lista-placar li');
    expect(itens[0].querySelector('.pontos')!.textContent).toBe('★ 12');
    expect(itens[1].querySelector('.pontos')).toBeNull();
    expect(itens[0].querySelector('.v')!.textContent).toContain('/s');
  });
  it('depois de vender, antes do Abrir CNPJ: o Legado aparece embaixo pra gastar os pontos', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.lista-legado')!.hasAttribute('hidden')).toBe(true); // nunca vendeu
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false, pontos: 5, pontos_vida: 5 }) }));
    expect(root.querySelector('.lista-legado')!.hasAttribute('hidden')).toBe(false);
    const fundador = [...root.querySelectorAll<HTMLElement>('.no')].find((x) => x.querySelector('strong')!.textContent === 'Fundador')!;
    fundador.querySelector('button')!.click();
    expect(acoes.comprarNo).toHaveBeenCalledWith(1);
  });
  it('cinco abas, Legado por último', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    expect([...root.querySelectorAll('.abas .aba')].map((b) => b.textContent)).toEqual(['Geradores', 'Melhorias', 'Contratar', 'Placar', 'Legado']);
    porTexto('Legado').click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('legado');
  });
  it('caixinha: o prazo usa a validade da árvore (6h com Lembrete no celular)', () => {
    vi.useFakeTimers();
    const uid = '00000000-0000-0000-0000-00000000000a';
    vi.setSystemTime(instante(uid, 50) + 60 * 60 * 1000);
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ caixaAberta: true, pendentes: [50], estado: estado({ user_id: uid, bonus: { arvore: [1, 31, 32], conquistas: 0 } }) }));
    expect(root.querySelector('.modal-caixa .prazo')!.textContent).toBe('some em 5h00');
    vi.useRealTimers();
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/tela.test.ts`
Expected: FAIL (sem aba Legado, sem árvore, sem `.modal-venda`, sem aviso, sem `★`).

- [ ] **Step 3: `games/idle/tela.ts`** — troque cada trecho, na ordem:

1. Trecho:

```ts
import { catalogo, type Melhoria } from './catalogo';
```

   vira:

```ts
import { catalogo, type Melhoria } from './catalogo';
import { falta, ganhouEm, grade, pontos, RAMOS_ARVORE, situacao, textoVenda, TOTAL_CONQUISTAS, type Celula } from './legado';
```

2. Trecho:

```ts
import { ERAS, VISUAL_NOMES } from './nomes';
import { instante, TEXTO_TIPO, tipo as tipoOportunidade, VALIDADE_S } from './oportunidades';
```

   vira:

```ts
import { ERAS, VISUAL_NOMES } from './nomes';
import { instante, TEXTO_TIPO, tipo as tipoOportunidade } from './oportunidades';
```

3. Trecho:

```ts
import { CORES, CORES_CABELO, PADRAO, PELES, type Campo, type Tons } from './personagem';
import { estrategiaPendente, segundosOportunidade, type Fase } from './store';
```

   vira:

```ts
import { CORES, CORES_CABELO, PADRAO, PELES, type Campo, type Tons } from './personagem';
import { caixa, estrategiaPendente, segundosOportunidade, type Fase } from './store';
```

4. Trecho:

```ts

export type Aba = 'geradores' | 'melhorias' | 'contratar' | 'placar';
```

   vira:

```ts

export type Aba = 'geradores' | 'melhorias' | 'contratar' | 'placar' | 'legado';
```

5. Trecho:

```ts
  editor: IdleVisual | null;
```

   vira:

```ts
  editor: IdleVisual | null;
  /** Folha "Vender a startup?" aberta. */
  vendaAberta: boolean;
  /** O aviso de conquista na cena agora ("Conquista: 6-7"); null = nenhum. */
  conquistaAviso: string | null;
```

6. Trecho:

```ts
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
```

   vira:

```ts
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
  vender(acao: 'abrir' | 'fechar' | 'confirmar'): void; comprarNo(id: number): void;
```

7. Trecho:

```ts
  const vivo = button('', 'vivo', () => undefined);
  palco.append(canvas, vivo);
```

   vira:

```ts
  const vivo = button('', 'vivo', () => undefined);
  const avisoConquista = el('div', 'conquista-aviso');
  avisoConquista.setAttribute('role', 'status');
  palco.append(canvas, vivo, avisoConquista);
```

8. Trecho:

```ts
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
```

   vira:

```ts
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
    legado: button('Legado', 'aba', () => a.trocarAba('legado')),
```

9. Trecho:

```ts
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.contratar, botoesAba.placar);
```

   vira:

```ts
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.contratar, botoesAba.placar, botoesAba.legado);
```

10. Trecho:

```ts
  const listaP = el('ol', 'lista lista-placar');
```

   vira:

```ts
  const listaP = el('ol', 'lista lista-placar');
  const listaL = el('div', 'lista lista-legado');
```

11. Trecho:

```ts
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaC, listaP);
```

   vira:

```ts
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaC, listaP, listaL);
```

12. Trecho:

```ts
  const modalV = el('div', 'modal modal-visual');
  for (const [modal, titulo] of [[modalE, 'idle-titulo-estrategia'], [modalC, 'idle-titulo-caixa'], [modalV, 'idle-titulo-visual']] as const) {
```

   vira:

```ts
  const modalV = el('div', 'modal modal-visual');
  const modalP = el('div', 'modal modal-venda');
  for (const [modal, titulo] of [
    [modalE, 'idle-titulo-estrategia'], [modalC, 'idle-titulo-caixa'], [modalV, 'idle-titulo-visual'], [modalP, 'idle-titulo-venda'],
  ] as const) {
```

13. Trecho:

```ts

  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC, modalV);
```

   vira:

```ts

  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC, modalV, modalP);
```

14. Trecho:

```ts
  let verCompradas = false;
```

   vira:

```ts
  let verCompradas = false;
  // aba Legado: a conquista tocada (mostra a frase e a data); só apresentação
  let conquistaAberta: number | null = null;
```

15. Trecho:

```ts
    return box;
  }

```

   vira:

```ts
    return box;
  }

  /** Ícone 16x16 ampliado; sem a arte, só a moldura. */
  function iconeLegado(url: string | null) {
    const box = el('div', 'icone-legado');
    if (url) box.style.backgroundImage = `url(${url})`;
    else box.classList.add('sem-arte');
    return box;
  }

  /** Aba Legado: o card de prestígio, a árvore (raiz e 5 ramos) e a grade de conquistas (tocar mostra a frase e a data). */
  function legado(s: IdleState, ocupado: boolean) {
    const card = el('div', 'prestigio');
    const meio = el('div', 'meio');
    const vezes = s.vendas === 1 ? 'vendeu 1 vez' : `vendeu ${s.vendas} vezes`;
    meio.append(
      el('strong', undefined, `★ ${pontos(s.pontos)} pra gastar`),
      el('span', 'sub', `${s.pontos_vida} ganhos na vida · recorde ${formatarTaxa(s.recorde)}${s.vendas ? ` · ${vezes}` : ''}`),
    );
    const vender = button(
      s.pontos_venda >= 1 ? `Vender a startup · +${pontos(s.pontos_venda)}` : 'Ainda não compensa',
      'btn main', () => a.vender('abrir'),
    );
    vender.disabled = s.pontos_venda < 1 || ocupado;
    card.append(meio, vender);

    const arvore = el('div', 'arvore');
    for (const r of RAMOS_ARVORE) {
      const ramo = el('section', r.ramo === 0 ? 'ramo raiz' : 'ramo');
      ramo.append(el('h3', 'ramo-nome', r.nome));
      for (const n of r.nos) {
        const sit = situacao(n, s.bonus.arvore);
        const no = el('div', `no ${sit}`);
        const texto = el('div', 'meio');
        texto.append(el('strong', undefined, n.nome), el('span', 'sub', n.efeito));
        no.append(iconeLegado(ativos.no(n.id)), texto);
        if (sit === 'comprado') no.append(el('span', 'no-status', 'Comprado'));
        else if (sit === 'trancado') no.append(el('span', 'no-status', falta(n)));
        else {
          const b = button(`Comprar · ${n.custo} ★`, 'btn compacto', () => a.comprarNo(n.id));
          b.disabled = ocupado || s.pontos < n.custo;
          no.append(b);
        }
        ramo.append(no);
      }
      arvore.append(ramo);
    }

    const celulas = grade(s);
    const topoQ = el('h3', 'legado-titulo', `Conquistas ${s.conquistas.length}/${TOTAL_CONQUISTAS} · +${s.bonus.conquistas}% de produção`);
    const grid = el('div', 'grade-conquistas');
    for (const c of celulas) {
      const b = button('', c.ganhou ? 'conquista ganha' : 'conquista', () => {
        conquistaAberta = conquistaAberta === c.conquista.id ? null : c.conquista.id;
        if (ultimo) renderizar(ultimo);
      });
      b.setAttribute('aria-pressed', String(conquistaAberta === c.conquista.id));
      b.append(iconeLegado(ativos.conquista(c.conquista.id)), el('span', 'conquista-nome', c.nome));
      grid.append(b);
    }
    listaL.append(card, el('h3', 'legado-titulo', 'Árvore de habilidades'), arvore, topoQ);
    const aberta = celulas.find((c: Celula) => c.conquista.id === conquistaAberta);
    if (aberta) {
      const det = el('div', 'conquista-detalhe');
      det.append(el('strong', undefined, aberta.nome), el('span', 'sub', aberta.texto));
      if (aberta.em) det.append(el('span', 'sub', ganhouEm(aberta.em)));
      listaL.append(det);
    }
    listaL.append(grid);
  }

```

16. Trecho:

```ts
    mostrar(listaP, jogando && m.aba === 'placar');
```

   vira:

```ts
    mostrar(listaP, jogando && m.aba === 'placar');
    // Legado: na aba, ou embaixo do "Abrir CNPJ" de quem já vendeu (dá pra gastar os pontos antes de reabrir)
    const verLegado = !!s && ((jogando && m.aba === 'legado') || (m.fase === 'antes' && s.pontos_vida > 0));
    mostrar(listaL, verLegado);
```

17. Trecho:

```ts
        }
      }
    }

```

   vira:

```ts
        }
      }
    }

    listaL.replaceChildren();
    if (s && verLegado) legado(s, m.ocupado);

```

18. Trecho:

```ts
        );
```

   vira:

```ts
        );
        if (r.pontos > 0) li.append(el('span', 'pontos', `★ ${r.pontos}`));
```

19. Trecho:

```ts
        texto.append(el('strong', undefined, TEXTO_TIPO[k]), quando);
        prazos.push({ texto: quando, fim: instante(s.user_id, w) + VALIDADE_S * 1000 });
```

   vira:

```ts
        texto.append(el('strong', undefined, TEXTO_TIPO[k]), quando);
        prazos.push({ texto: quando, fim: instante(s.user_id, w) + caixa(s).validadeS * 1000 });
```

20. Trecho:

```ts
      modalV.append(folha);
    }

```

   vira:

```ts
      modalV.append(folha);
    }

    // vender a startup: confirmação (só com pelo menos 1 ponto a ganhar)
    modalP.replaceChildren();
    const ganho = s && m.vendaAberta && jogando ? s.pontos_venda : 0;
    mostrar(modalP, ganho >= 1);
    if (ganho >= 1) {
      const folha = el('div', 'folha');
      const topoP = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.vender('fechar'));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      topoP.append(titulo('idle-titulo-venda', 'Vender a startup?'), fechar);
      const fim = el('div', 'editor-fim');
      const sim = button('Vender', 'btn main', () => a.vender('confirmar'));
      sim.disabled = m.ocupado;
      fim.append(button('Deixa quieto', 'btn', () => a.vender('fechar')), sim);
      folha.append(topoP, el('p', 'sub', textoVenda(ganho)), fim);
      modalP.append(folha);
    }

    avisoConquista.textContent = m.conquistaAviso ?? '';
    mostrar(avisoConquista, m.conquistaAviso !== null);

```

- [ ] **Step 4: `games/idle/idle.css`** — acrescente no fim:

```css
/* entrega 3: no celular as 5 abas rolam de lado (cada uma do tamanho do texto) */
@media (max-width: 599px) {
  .idle .abas { overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
  .idle .abas::-webkit-scrollbar { display: none; }
  .idle .aba { flex: 1 0 auto; padding: 0 14px; }
}
/* aba Legado: card de prestígio, árvore (ramos empilhados no celular, lado a lado no tablet e no PC) e conquistas */
.idle .prestigio { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: var(--paper); }
.idle .prestigio .btn { flex: 1 1 100%; min-height: 44px; height: auto; white-space: nowrap; }
@media (min-width: 600px) { .idle .prestigio .btn { flex: none; padding: 0 16px; } }
.idle .legado-titulo { margin: 12px 0 0; font: 700 15px var(--font); color: var(--paper); }
.idle .arvore { display: grid; gap: 12px; }
.idle .ramo { display: grid; gap: 6px; align-content: start; }
.idle .ramo-nome { margin: 0; font: 700 13px var(--font); color: #A8A398; }
.idle .no { display: flex; align-items: center; gap: 10px; padding: 8px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: var(--paper); }
.idle .no.comprado { border-color: #5B3FD9; background: #262431; }
.idle .no.trancado { opacity: 0.5; }
.idle .no .btn { flex: none; min-height: 44px; }
.idle .no-status { flex: none; max-width: 40%; text-align: right; font-size: 12px; color: #A8A398; }
.idle .no.comprado .no-status { color: var(--mint); }
@media (min-width: 700px) {
  .idle .arvore { grid-template-columns: repeat(5, minmax(0, 1fr)); }
  .idle .ramo.raiz { grid-column: 1 / -1; justify-self: center; width: min(100%, 320px); }
  .idle .ramo:not(.raiz) .no { flex-direction: column; text-align: center; }
  .idle .ramo:not(.raiz) .no .btn { width: 100%; padding: 0 6px; white-space: normal; }
  .idle .ramo:not(.raiz) .no-status { max-width: none; text-align: center; }
}
.idle .grade-conquistas { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; }
.idle .conquista { display: grid; justify-items: center; align-content: start; gap: 6px; min-height: 44px; padding: 8px 4px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: #A8A398; font: 600 12px/1.25 var(--font); text-align: center; cursor: pointer; }
.idle .conquista.ganha { color: var(--paper); border-color: #5B3FD9; }
.idle .conquista:not(.ganha) .icone-legado, .idle .no.trancado .icone-legado { opacity: 0.35; filter: grayscale(1); }
.idle .conquista[aria-pressed='true'], .idle .conquista:focus-visible { outline: 2px solid #B8A2FF; outline-offset: 2px; }
.idle .icone-legado { flex: none; width: 48px; height: 48px; background: no-repeat 0 0 / 48px 48px; image-rendering: pixelated; }
.idle .icone-legado.sem-arte { border-radius: 6px; border: 3px solid #6B6874; }
.idle .conquista-detalhe { display: grid; gap: 2px; padding: 10px 12px; border-radius: 8px; background: #262431; color: var(--paper); }
/* aviso de conquista: pílula por cima da cena, 3 s (main.ts) */
.idle .conquista-aviso { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2; max-width: calc(100% - 32px); padding: 8px 14px; border-radius: 999px; border: 1px solid #B8A2FF; background: #3A2A66; color: #DDD2FF; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; animation: conquista-entra 0.25s ease-out; }
@keyframes conquista-entra { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) { .idle .conquista-aviso { animation: none; } }
.idle .lista-placar .pontos { grid-row: 2; grid-column: 4; justify-self: end; color: var(--gold); font-size: 13px; font-weight: 700; }
```

- [ ] **Step 5: `games/idle/main.ts`** — troque cada trecho, na ordem:

1. Trecho:

```ts
import { ativos } from './ativos';
```

   vira:

```ts
import { ativos } from './ativos';
import { avisos, criarFilaAvisos } from './legado';
```

2. Trecho:

```ts
import {
  agoraServidor, ancorar, cenaDoEstado, faseDoEstado, inicioSemana, deveAbrirEditor, segundosOportunidade, valuationAgora, vencido, type Ancora, type Fase,
```

   vira:

```ts
import {
  agoraServidor, ancorar, caixa, cenaDoEstado, faseDoEstado, inicioSemana, deveAbrirEditor, segundosOportunidade, valuationAgora, vencido, type Ancora, type Fase,
```

3. Trecho:

```ts

type Api = Pick<typeof realApi, 'idleOpen' | 'idleStart' | 'idleBuy' | 'idlePickStrategy' | 'idleClaim' | 'idleBoard' | 'idleHire' | 'idleSetAvatar' | 'hasSession'>;
```

   vira:

```ts

type Api = Pick<
  typeof realApi,
  'idleOpen' | 'idleStart' | 'idleBuy' | 'idlePickStrategy' | 'idleClaim' | 'idleBoard' | 'idleHire' | 'idleSetAvatar' | 'idlePrestige' | 'idleBuyNode' | 'hasSession'
>;
```

4. Trecho:

```ts
  'idle_cant_afford', 'idle_locked', 'idle_owned', 'idle_strategy_set', 'idle_strategy_pending', 'idle_opp_gone', 'idle_opp_cap',
  'idle_not_started', 'idle_started', 'idle_hire_twice', 'idle_hire_not_open',
```

   vira:

```ts
  'idle_cant_afford', 'idle_locked', 'idle_owned', 'idle_strategy_set', 'idle_strategy_pending', 'idle_opp_gone', 'idle_opp_cap',
  'idle_not_started', 'idle_started', 'idle_hire_twice', 'idle_hire_not_open', 'idle_prestige_low', 'idle_points_low',
  'idle_node_owned',
```

5. Trecho:

```ts
let vencimentoPedido: string | null = null;
```

   vira:

```ts
let vencimentoPedido: string | null = null;
// folha "Vender a startup?" aberta; aviso de conquista na cena (um de cada vez, 3 s cada)
let vendaAberta = false;
let conquistaAviso: string | null = null;
const filaAvisos = criarFilaAvisos((texto) => {
  conquistaAviso = texto;
  render();
});
```

6. Trecho:

```ts
    rascunho = { ...rascunho, [campo]: valor };
    render();
  },
```

   vira:

```ts
    rascunho = { ...rascunho, [campo]: valor };
    render();
  },
  vender: (acao) => {
    if (acao === 'confirmar') {
      vendaAberta = false; // fecha já: deu certo, a cena volta pro "antes"; deu errado, o aviso diz por quê
      void guard(async () => {
        aplicar(await api.idlePrestige());
        aba = 'geradores'; // quando reabrir a empresa, começa comprando
        await carregarPlacar();
      });
      return;
    }
    vendaAberta = acao === 'abrir';
    render();
  },
  comprarNo: (id) => void guard(async () => aplicar(await api.idleBuyNode(id))),
```

7. Trecho:

```ts
  const agora = agoraSrv();
  const lista = s ? pendentes(s.user_id, agora, s.opp_claimed.map(Number), inicioSemana(s)) : [];
```

   vira:

```ts
  const agora = agoraSrv();
  const lista = s ? pendentes(s.user_id, agora, s.opp_claimed.map(Number), inicioSemana(s), caixa(s)) : [];
```

8. Trecho:

```ts
  vivoAtual = s ? vivoAgora(s, agora) : null;
  tela.renderizar({ fase, estado: s, aba, placar, aviso, ocupado, caixaAberta, editor: rascunho, placarFalhou, pendentes: s ? lista.slice(0, Math.max(0, s.opp_left)) : [], aoVivo: vivoAtual });
```

   vira:

```ts
  vivoAtual = s ? vivoAgora(s, agora) : null;
  tela.renderizar({
    fase, estado: s, aba, placar, aviso, ocupado, caixaAberta, editor: rascunho, placarFalhou,
    pendentes: s ? lista.slice(0, Math.max(0, s.opp_left)) : [], aoVivo: vivoAtual, vendaAberta, conquistaAviso,
  });
```

9. Trecho:

```ts
  if (fase !== 'abrindo') palco.tocar(cenaDoEstado(estado, fase));
  render();
```

   vira:

```ts
  if (fase !== 'abrindo') palco.tocar(cenaDoEstado(estado, fase));
  render();
  filaAvisos.adicionar(avisos(estado.novas));
```

- [ ] **Step 6: Rodar e ver passar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run && npm run build`
Expected: PASS e build sem erro.

- [ ] **Step 7: Conferência no `?mock`** (`cd games && npm run dev`, abrir `/games/idle/?mock` no endereço que o Vite
  mostrar; no DevTools, celular de 360 px, depois tablet e PC):
  - as 5 abas cabem rolando de lado no celular; a aba ativa fica marcada;
  - aba Legado: card "★ 0 pontos pra gastar", "0 ganhos na vida · recorde …", botão apagado "Ainda não compensa";
    árvore com a raiz e os 5 ramos (empilhados no celular, lado a lado a partir do tablet), Fundador com "Comprar · 1 ★"
    apagado, o resto trancado com "Precisa de …"; conquistas "N/73" com o "???" da 6-7 (o bot Oliveira tem); tocar numa
    ganha mostra frase e data, numa bloqueada a condição;
  - abrir o jogo já dá conquistas ("Conquista: Primeiro real" por 3 s em cima da cena, um aviso de cada vez, sem tapar a
    oportunidade que passa);
  - placar: "★ 12" ao lado do R$/s do Oliveira, "★ 3" da Bia, nada no Teteu;
  - console: `__vendavel()`; a página bate o ponto e o botão vira "Vender a startup · +N pontos"; tocar abre a folha
    "Vender a startup?" com "Você ganha N pontos pra gastar na árvore e recomeça do zero."; "Deixa quieto" fecha;
    "Vender" volta pra cena "antes" com "Abrir CNPJ" e o Legado embaixo; comprar Fundador, Pé-de-meia e Soneca longa ali
    mesmo; "Abrir CNPJ": começa com R$ 1 mil e a produção com os +5%; o placar some com você até reabrir.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/tela.ts games/idle/tela.test.ts games/idle/idle.css games/idle/main.ts && git commit -m "Fellas Inc.: aba Legado (prestígio, árvore e conquistas), venda, aviso de conquista e pontos no placar"
```

---

### Task 10: Arte: os 73 ícones das conquistas e os 26 da árvore (fora do repositório)

**Files (em `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`; sem commit):**
- Create: `BRIEF-LEGADO.md`, `legado-icones.js`
- Produz: `png/conquista-NNN.png` (73), `png/no-NN.png` (26), as prévias de `salvarSprite`
  (`sprites/<nome>-8x.png`, `conferencia/<nome>-quadros.png`) e `conferencia/legado-folha.png`

**Interfaces:**
- Produz: os arquivos do "Contrato de formato da arte". A Task 11 copia e trava o formato.

- [ ] **Step 1: Salvar o brief** como `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/BRIEF-LEGADO.md`:

```markdown
# Brief: ícones do Legado da Fellas Inc. (conquistas e árvore de habilidades, entrega 3)

Leia antes `BRIEF-SPRITES.md` (estilo, contorno, paleta, processo) e veja com Read `conferencia/gerais-folha.png` (os
20 ícones das melhorias gerais): estes são da mesma família. Copie de `gerais.js` a função `mapa` (mapa de texto 16x16,
cada letra = cor e objeto) e o fim do arquivo (desenha, salva e monta a folha). Não edite nenhum arquivo existente:
crie só `legado-icones.js` e o que ele gera. Pasta: `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`.

## Formato (o jogo depende disto exatamente)
- Conquistas: `conquista-NNN` (NNN = id com 3 dígitos); árvore: `no-NN` (NN = id com 2 dígitos). Cada um salvo com
  `salvarSprite(nome, [cv], 15, 8)`: `png/<nome>.png` 16x16, transparente, 1 quadro, pixel duro, 1px de margem (o
  contorno de `cv.contornar()`).
- 2 a 4 cores mais o contorno. No jogo aparece a 48x48 (3x) num quadradinho escuro; bloqueado (conquista não ganha,
  nó trancado), o jogo pinta de cinza e apaga (35%): a silhueta tem que ler sem cor. Nada de texto além de números
  grandes (só onde dito).
- Grupos com marca comum: os 30 de gerador levam uma estrela dourada 4x4 no canto de cima à direita; os de R$/s sobem
  em "riqueza" do 31 ao 38; os de melhorias, gente e vendas vão de bronze (1º) a prata (2º) e ouro (3º e 4º); os nós de
  cada ramo da árvore dividem uma cor de fundo (Produção verde, Recomeço dourado, Oportunidades roxo, Tempo azul, Gente
  laranja) e o Fundador é roxo da marca.

## Conquistas
Geradores (ter 100; o objeto do gerador, simplificado do `gerador-NN` de 32x32, + a estrela dourada):
001 notebook com adesivos · 002 balão de post azul com joinha · 003 planilha verde com grade · 004 celular com balão
de áudio · 005 notebook com estrela de avaliação · 006 webcam roxa com o ponto vermelho de "ao vivo" · 007 boné
vermelho do estagiário com o crachá roxo · 008 impressora 3D com peça roxa · 009 balão verde do zap · 010 caixa de
papelão com etiqueta · 011 food truck · 012 sacola amarela com caixinha · 013 microfone com espuma roxa · 014 celular
com coração · 015 ícone de app (quadradinho arredondado) · 016 tela com o botão de play · 017 megafone · 018 prédio de
vidro com pufe colorido na porta · 019 gráfico de velas verdes subindo · 020 asa de anjo com cifrão · 021 rack de
servidor com LEDs · 022 cheque gigante com "A" · 023 lâmpada com post-it · 024 dois prédios unidos por uma ponte ·
025 globo de festa · 026 bola de futebol na frente de um escudo · 027 ilha com coqueiro · 028 arranha-céu de Dubai ·
029 sino da bolsa · 030 foguete.
R$/s: 031 uma moeda · 032 celular com o símbolo do Pix (Pix caindo) · 033 juba de leão (O leão acordou) · 034 bilhete
de loteria (Acumulou!) · 035 cartão de visita com gravata (Bilionário de LinkedIn) · 036 barras de ouro · 037 diamante
· 038 prensa de moedas (Casa da Moeda).
Eras: 039 porta de garagem com uma mochila (Saiu da casa dos pais) · 040 catraca com crachá · 041 elevador com seta pra
cima · 042 torre com a coroa roxa (a sede) · 043 foguete rumo a uma estrela (Ao infinito e além).
Melhorias (10, 50, 150): 044 placa de vídeo · 045 apito de coach · 046 casinha com coração (Tudo pela família).
Oportunidades (1, 25, 100, 500): 047 etiqueta "%" de Black Friday · 048 tesoura cortando cupom · 049 lupa com cifrão ·
050 mira de sniper.
Vendas (1, 5, 10, 25): 051 etiqueta de "vendido" · 052 etiqueta com seta circular · 053 unicórnio pequeno com cifrão ·
054 barbatana de tubarão (Shark Tank).
Gente: 055–057 crachá roxo de contratado com 1, 2 e 3 estrelas (bronze, prata, ouro) · 058 carteira de trabalho azul ·
059 seta pra cima sobre uma camisa de time (Passe valorizado) · 060 carteira de trabalho com 3 estrelas douradas.
Estratégias: 061 três setas saindo do mesmo ponto · 062 bússola.
Escondidas (zoeira do grupo; podem ser mais caprichadas):
101 "67" em números grandes dourados (pode usar a área toda) · 102 boneco (silhueta) com brilho roxo em volta (aura) ·
103 nuvem cinza com chuva · 104 um limão ao lado de um documento · 105 jaula aberta com um braço musculoso saindo ·
106 caravela com vela verde e amarela · 107 mão fazendo "L" com o boné vermelho do estagiário · 108 relógio marcando
3h06 com uma lua · 109 lobo uivando · 110 unicórnio (cabeça, chifre dourado, crina roxa; como o `selo-unicornio`) ·
111 tambor de madeira com duas baquetas (o "tung tung").

## Árvore de habilidades
no-01 Fundador: broto de duas folhas num vasinho roxo.
Produção (verde): no-11 xícara de café · no-12 alvo com seta (metas) · no-13 raio · no-14 seta grossa pra cima ·
no-15 turbina com chama ("turbo").
Recomeço (dourado): no-21 cofrinho · no-22 pilha de notebooks · no-23 mala com o logo roxo (leva a cultura junto) ·
no-24 saco de dinheiro grande (herança) · no-25 caixa aberta com peças (kit startup).
Oportunidades (roxo): no-31 caixinha de presente · no-32 celular com despertador · no-33 nariz farejando um cifrão ·
no-34 aperto de mão com "×2" pequeno · no-35 baú aberto.
Tempo (azul): no-41 travesseiro com "z" · no-42 lua com coruja · no-43 volante (piloto automático) · no-44 relógio com
engrenagem · no-45 rede de praia entre dois coqueiros.
Gente (laranja): no-51 placa de "VAGA" · no-52 lousa com gráfico (treinamento) · no-53 pergaminho comprido com selo ·
no-54 bola dourada (passe em alta) · no-55 headset de atendimento (RH terceirizado).

## Processo
`node legado-icones.js`; veja `conferencia/legado-folha.png` (todos em 1x, 2x e 6x, nos temas escuro `#121212` e claro
`#F4F1EA`) e `sprites/<nome>-8x.png` com Read. Pelo menos 2 rodadas de revisão por ícone; confira cada um também em
cinza (bloqueado). No fim, um relatório curto: o que tem em cada grupo e o que ficou fraco.
```

- [ ] **Step 2: Fazer a arte** — despachar um agente de arte com o brief (ou seguir o brief à mão). O script
  `legado-icones.js` segue o `gerais.js`: `const ICONES = {}`, um `ICONES['conquista-001'] = (cv) => mapa(cv, [...16
  linhas...], {legenda}, '001')` por ícone (e `ICONES['no-11'] = ...` para a árvore), e no fim o mesmo laço
  `telaComObjetos(16, 16)` → `desenha(cv)` → `cv.contornar()` → `salvarSprite(nome, [cv], 15, 8)` e a folha
  `conferencia/legado-folha.png` (fileiras de 10).

- [ ] **Step 3: Conferir o formato antes de passar para a Task 11**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos && node -e "const fs=require('fs');const c=[...Array(62)].map((_,i)=>i+1).concat([...Array(11)].map((_,i)=>101+i)).map(i=>'conquista-'+String(i).padStart(3,'0'));const n=[1].concat([1,2,3,4,5].flatMap(r=>[1,2,3,4,5].map(p=>r*10+p))).map(i=>'no-'+String(i).padStart(2,'0'));let ok=0;for(const x of c.concat(n)){const b=fs.readFileSync('png/'+x+'.png');if(b.readUInt32BE(16)!==16||b.readUInt32BE(20)!==16)throw new Error(x);ok++}console.log('ok',ok)"`
Expected: `ok 99`.

- [ ] **Step 4: Mostrar a folha ao Juan** (`conferencia/legado-folha.png`) e ajustar o que ele pedir antes da Task 11.

---

### Task 11: Copiar os ícones para `games/idle/assets/` e travar o formato

**Files:**
- Create: `games/idle/assets/conquistas/conquista-NNN.png` (73), `games/idle/assets/arvore/no-NN.png` (26)
- Modify: `games/idle/ativos.test.ts`

**Interfaces:**
- Consome: a arte da Task 10; `catalogo.conquistas`, `catalogo.arvore` (Task 1); `ativos.conquista`, `ativos.no` (Task 8).

- [ ] **Step 1: Teste do formato (acrescentar em `games/idle/ativos.test.ts`)**

No topo, acrescente o import `import { catalogo } from './catalogo';` (os de `node:fs` e `node:path` já existem). No fim:

```ts

describe('arte da entrega 3 (ícones das conquistas e da árvore)', () => {
  const conquista = (id: number) => `conquista-${String(id).padStart(3, '0')}.png`;
  const no = (id: number) => `no-${String(id).padStart(2, '0')}.png`;
  it('toda conquista e todo nó do catálogo têm ícone 16x16', () => {
    for (const c of catalogo.conquistas) {
      expect(dim(`conquistas/${conquista(c.id)}`), conquista(c.id)).toEqual([16, 16]);
      expect(ativos.conquista(c.id), conquista(c.id)).not.toBeNull();
    }
    for (const n of catalogo.arvore) {
      expect(dim(`arvore/${no(n.id)}`), no(n.id)).toEqual([16, 16]);
      expect(ativos.no(n.id), no(n.id)).not.toBeNull();
    }
  });
  it('nenhum ícone sobrando (de id que não existe no catálogo)', () => {
    const conquistas = new Set(catalogo.conquistas.map((c) => conquista(c.id)));
    const nos = new Set(catalogo.arvore.map((n) => no(n.id)));
    expect(readdirSync(resolve(pasta, 'conquistas')).filter((f) => !conquistas.has(f))).toEqual([]);
    expect(readdirSync(resolve(pasta, 'arvore')).filter((f) => !nos.has(f))).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/ativos.test.ts`
Expected: FAIL (as pastas `assets/conquistas` e `assets/arvore` não existem).

- [ ] **Step 3: Copiar**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games/idle/assets && mkdir -p conquistas arvore && cp C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/png/conquista-*.png conquistas/ && cp C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/png/no-*.png arvore/
```

- [ ] **Step 4: Rodar e ver passar; conferir no `?mock`** que a árvore e a grade mostram os ícones (comprados e ganhos
  coloridos, trancados e bloqueados em cinza) a 48 px sem borrar.

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/ && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/assets/conquistas games/idle/assets/arvore games/idle/ativos.test.ts && git commit -m "Fellas Inc.: ícones das conquistas e da árvore"
```

---

### Task 12: Conferência final, banco e publicação

- [ ] **Step 1: Tudo verde no branch**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && npx tsc --noEmit && npm test && cd games && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: tudo passa.

- [ ] **Step 2: Merge local na `main` (ainda sem push)** — o repositório principal é o que tem o projeto do Supabase
  ligado (`supabase/.temp`); o worktree não tem.

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git checkout main && git pull --ff-only && git merge --no-ff fellas-inc-prestigio -m "Merge da entrega 3 da Fellas Inc. (prestígio, árvore e conquistas)" && npx tsc --noEmit && npm test && npm test --prefix games
```

- [ ] **Step 3: Banco de produção (o Juan roda)** — pedir ao Juan, no terminal dele, em
  `C:/Users/juan/Documents/PROJETOSLLM/fellasapp`: `! npx supabase migration list` (pendentes só 0040 e 0041; se
  aparecer outra, parar e conversar) e depois `! npx supabase db push`.

- [ ] **Step 4: Conferir pela REST que entrou e só então publicar** (o deploy roda os testes e builda `dist/games/idle/`):

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && set -a && . ./.env && set +a && for q in "idle_state?select=prestige_earned,prestige_spent,prestige_count,best_rate,upg_total,opp_total,hire_total,hired_total,est_usadas,opp_recent" "idle_conquistas?select=ganhou_em" "idle_arvore?select=comprado_em" "idle_cat_conquista?select=escondida" "idle_cat_no?select=requer" "idle_cat_upg?select=nome&id=eq.283"; do curl -s -o /dev/null -w "$q %{http_code}\n" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/$q&limit=1" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"; done
```

Expected: 200 ou 401 (existe; anônimo não tem permissão) em todos; 400 ("column ... does not exist") ou 404 = a
migração não entrou: NÃO dar push; parar e avisar o Juan (o merge local pode ser desfeito com
`git reset --hard ORIG_HEAD`, que só mexe na `main` local). Tudo certo:

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git push origin main
```

- [ ] **Step 5: Conferência real (com o Juan e mais um fella)** — `https://fellasapp.pages.dev/games` no celular:
  abrir a Fellas Inc. (aparece "Conquista: …" por 3 s para as que a pessoa já cumpria; o R$/s sobe 1% por conquista);
  aba Legado com o card, a árvore (ramos empilhados no celular) e a grade "N/73" com as escondidas que alguém do grupo
  já tem como "???"; placar com "★ N" de quem já vendeu; quem tiver R$/s ≥ 1 mi vê "Vender a startup · +N pontos":
  vender (folha, "Vender"), ver a cena voltar para o "Abrir CNPJ" com o Legado embaixo, comprar o Fundador e um nó de
  Recomeço, reabrir e conferir o dinheiro inicial e a produção com os +5%; quem tinha contratado alguém: o contratado
  continua com o que já rendeu e perde o bônus dali pra frente; quem te contratou continua; com o jogo aberto em dois
  aparelhos, vender num e tocar em comprar no outro: recarrega e mostra o "Abrir CNPJ". Na segunda seguinte, conferir
  que o unicórnio ganhou o "Pai tá on" e que nada sumiu.

---

## Autorrevisão

- **Cobertura da spec (entrega 3, revista):** 1.1 pontos (`floor(cbrt(r/K)) − ganhos na vida`, "não compensa") →
  Tasks 2, 3, 6, 9; 1.2 venda (zera, volta pro Abrir CNPJ, contratos feitos vencem com a conta dos contratados fechada
  antes, quem te contratou continua, ficam pontos/nós/vendas/conquistas/personagem/cota do dia/recorde, Recomeço no
  novo Abrir CNPJ, confirmação com o texto novo) → Tasks 5, 6, 9; 1.3 árvore (raiz + 5 ramos, custos, nó anterior,
  comprado pra sempre, efeitos de cada ramo, paridade, "★ N" = ganhos na vida) → Tasks 1, 2, 3, 5, 9; 1.4 ritmo (K,
  primeira venda no dia 3/4, quem gasta ~10 pontos volta mais rápido) → Task 2; 2 bônus juntos (a foto usa a taxa da
  meia-noite) → Task 3; 3 conquistas (catálogo, banco confere em toda ação e ao abrir, ganhou não perde, +1%, 62
  visíveis com os nomes revistos, 11 escondidas) → Tasks 1, 4, 6, 10, 11; 4 telas (aba Legado: card, árvore empilhada
  no celular e lado a lado maior, grade com "???" e "N/73"; abas roláveis; aviso de 3 s; placar) → Tasks 8, 9; 5 dados
  (`prestige_earned/spent/count`, `best_rate`, `idle_cat_no`, `idle_arvore`, `idle_buy_node` fechando a conta antes,
  `idle_cat_conquista` na migração nova, `idle_conquistas`, `idle_prestige`, `idle_check_conquistas`, `idle_json`/
  `idle_board`, contadores em colunas, nada apaga) → Tasks 1, 3–6; 6 testes (pontos, árvore e cada efeito, o que zera
  e o que fica, contratos sem retroativo, cada tipo de conquista, horário, nome de usuário, conquista não some, ninguém
  escreve nos dos outros, paridade, simulação, tela) → Tasks 2–9.
- **Nomes conferidos entre tasks:** `TipoConquista`, `TipoNo`, `Conquista`, `No`, `CUSTO_NO`, `RAIZ`, `RAMOS`,
  `catalogo.conquistas`, `catalogo.arvore`; `Bonus`, `SEM_BONUS`, `EfeitosArvore`, `efeitosArvore`, `efeitosDe`,
  `multBonus`, `pontosTotais`, `abertura`, `precoContrato`, `K_PRESTIGIO`; `Caixa`, `CAIXA_PADRAO`; `Amostra`,
  `primeiraVenda`, `gastar`, `volta`; `idle_arv`, `idle_arvore_efeitos`, `idle_bonus_mult`, `idle_prestige_total`,
  `idle_ganhar`, `idle_madrugada`, `idle_check_conquistas`, `idle_buy_node`, `idle_prestige`; colunas `prestige_earned`,
  `prestige_spent`, `prestige_count`, `best_rate`, `upg_total`, `opp_total`, `hire_total`, `hired_total`, `est_usadas`,
  `opp_recent`; campos `bonus.arvore`, `bonus.conquistas`, `pontos`, `pontos_vida`, `vendas`, `recorde`,
  `pontos_venda`, `conquistas`, `novas`, `descobertas`, placar `pontos`/`conquistas`; `IdleConquista`, `idlePrestige`,
  `idleBuyNode`, `idle_prestige_low`, `idle_points_low`, `idle_node_owned`, `dono`, `__vendavel`; `legado.ts` (`grade`,
  `situacao`, `RAMOS_ARVORE`, `falta`, `textoVenda`, `criarFilaAvisos`…), `efeitos`/`caixa` (store), `ativos.conquista`,
  `ativos.no`; `Aba 'legado'`, `Modelo.vendaAberta`, `Modelo.conquistaAviso`, `Acoes.vender`, `Acoes.comprarNo`.
- **Conferido ao escrever o plano (10/10), num rascunho descartado:** com as migrações reais 0027–0038 + a 0040 gerada
  + a 0041 deste plano no PGlite, passaram os testes de banco das Tasks 3–6 (inclusive a 0041 rodando duas vezes), a
  paridade (efeitos de cada nó e de pedaços sorteados da árvore, taxa com contratos, teto de 8 a 48h atravessando
  vencimento, caixinha e validade, preço do contrato, pontos em cima dos cubos), todos os testes de antes, a simulação
  com K = 1e6, os testes da tela e de `legado.ts`, `tsc` e `build` em `games/` e, na raiz, `tsc` e `npm test` (com as
  travas novas e a do safeupdate). Os estados intermediários da 0041 (parte 1; 1+2; 1+2+3) também rodaram: só falham os
  testes das tasks seguintes. Os trechos "troque/vira" deste plano foram reaplicados por script nos arquivos da `main` e
  dão exatamente os arquivos testados.
- **Foco da revisão:** itens 1 a 3 têm teste no banco (Tasks 3–6); o 4 tem teste da tela para a folha e conferência
  real com dois aparelhos (Task 12); o 5 tem os testes das 5 abas e da árvore e conferência no `?mock` a 360 px (Task 9).
