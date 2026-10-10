# Fellas Inc., entrega 3 (prestígio e conquistas): plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

> **Pendente do Juan antes de executar (alvo 2 da seção 1.4 da spec):** "depois de vender com 10 pontos, voltar à era
> em que estava leva menos da metade do tempo da primeira vez" **não é alcançável com +1% por ponto**. Medido na
> simulação ao planejar: a venda chega a 10 pontos com 5,5 dias (sai com 11, na era 5) e, recomeçando com 11 pontos, a
> era 5 chega nos mesmos 3,0 dias da primeira vez (com 20 a 30 conquistas a mais, 2,7 dias). Para chegar à metade a
> produção teria de ser ×5 desde o começo (uns +40% por ponto). Este plano segue a decisão "+1% por ponto" e trava o
> que é verdade hoje ("voltar não fica mais lento"). Se o Juan quiser outro efeito por ponto, muda `POR_PONTO`
> (`economia.ts`) e o `0.01` de `idle_bonus_mult` (0041) juntos, e o teste do alvo 2 volta a ser o da spec.

**Objetivo:** "Vender a startup" troca a empresa por pontos de prestígio (+1% de produção cada, pra sempre) e 73
conquistas (62 visíveis e 11 escondidas, de zoeira) dão +1% cada, pra sempre; aba Conquistas com o card de prestígio, a grade e
o aviso de conquista na cena; pontos no placar.

**Arquitetura:** o banco continua a autoridade. A **0040** é o catálogo gerado de novo por `catalogoSql()` (conquistas +
a melhoria 283 renomeada para "Filial em Portugal"). A **0041** acrescenta colunas permanentes em `idle_state`
(pontos, vendas, recorde, contadores), a tabela `idle_conquistas`, o multiplicador `idle_bonus_mult` dentro de
`idle_rate_at` (paridade com `economia.ts`), a conferência das conquistas dentro de `idle_save` (o último passo de toda
função que muda o jogo, sempre depois de fechar a conta) e `idle_prestige()`. A página ganha a aba Conquistas, a folha
de venda e o aviso de 3 s; os ícones são arte por código fora do repositório e a página funciona sem eles.

**Tecnologias:** Postgres/Supabase (plpgsql, RLS), Vite + TypeScript + Vitest + PGlite (`games/`), Jest (travas das
migrações no app), Node (script da arte em `../fellas-inc-esbocos`).

**Spec:** `docs/superpowers/specs/2026-10-10-fellas-inc-prestigio-conquistas-design.md` (aprovada 10/10), sobre a base
`docs/superpowers/specs/2026-10-10-fellas-inc-design.md`. Plano anterior: `docs/superpowers/plans/2026-10-10-fellas-inc-gente.md`.

**Ajustes de implementação em relação à spec** (decisões tomadas; o comportamento pedido não muda):
- **Numeração:** `0040_fellas_inc_catalogo_conquistas.sql` (catálogo GERADO, Task 1) vem antes da lógica
  `0041_fellas_inc_prestigio.sql` (Tasks 3–5), porque as funções `language sql` da lógica citam `idle_cat_conquista` e o
  Postgres confere a tabela ao criar a função (mesma ordem da 0037/0038). 0033–0039 não se editam.
- **K = 1 milhão** (medido na simulação; Task 2): `pontos_totais(r) = floor(cbrt(r / 1e6))`. Os dois lados acertam o
  inteiro com `n³ ≤ x < (n+1)³` depois do `cbrt`, para o banco e a página nunca discordarem perto de um cubo (um ulp de
  diferença no `cbrt` viraria 1 ponto de diferença).
- **Onde as conquistas são conferidas:** `idle_check_conquistas(uid)` roda dentro de `idle_save` (troca da 0036). Toda
  RPC que muda o jogo termina em `idle_save` depois de `idle_settle`, então a conquista nova só vale dali pra frente
  (nada retroativo) e quem é contratado também é conferido (o `idle_save` dele roda no `idle_hire`). As "novas" que a
  tela avisa são as gravadas nesta transação (`ganhou_em = now()`). Conquistas de evento (venda de 1 ponto, venda sem
  nunca ter contratado, contratar o limaumdoc, Máx ≥ 100, abrir às 3h, unicórnio da foto) são dadas por
  `idle_ganhar(uid, tipo, valor, texto)` na função que vê o evento, também depois de fechar a conta.
- **Sem chave estrangeira de `idle_conquistas` para o catálogo:** a migração de catálogo faz `delete from
  public.idle_cat_conquista where true` e regrava; uma FK bloquearia isso (ou, com cascade, apagaria conquistas).
- **Contadores pra sempre** (não zeram na venda): `upg_total` (melhorias compradas), `opp_total` (oportunidades pegas),
  `hire_total` (contratos que fez), `hired_total` (vezes que foi contratado), `est_usadas` (estratégias já usadas, código
  era·10+opção), `opp_recent` (hora das 3 últimas pegas, para o "Brainrot"). As conquistas "10, 50, 150 melhorias" e "1,
  25, 100, 500 oportunidades" contam a vida toda, somando todas as empresas. A 0041 preenche o que dá para saber do
  passado (melhorias de agora, contratos, estratégias de agora, quem já foi unicórnio); oportunidades começam do zero.
- **Venda:** `started = false` (a tela volta para a cena "antes" e o "Abrir CNPJ"); quem vendeu sai do placar até abrir
  de novo (o placar é de quem tem empresa aberta, regra da 0036). O recorde de R$/s é guardado em todo `idle_save`.
  Vencer os contratos feitos = `ends_at = now()` só nos ativos com `created_at < now()` (o check da tabela exige
  `ends_at > created_at`).
- **"Farmou aura":** 1º estrito em R$/s entre quem tem empresa aberta, com mais alguém com empresa aberta (sozinho ou
  empatado não conta). "Indeciso profissional": as 3 opções de uma era (eras com opção desligada, 3 e 4, só contam
  quando a entrega 4 ligar a opção). "Conhece todos os caminhos": todas as opções ligadas.
- **Contagem "N/total"** conta todas as conquistas do catálogo, escondidas inclusive (73 hoje). Na grade, a bloqueada
  aparece apagada com o nome; a condição aparece ao tocar (no mesmo lugar onde a ganha mostra a frase e a data), para a
  grade caber no celular.
- **Testes antigos:** `freshDb({ conquistas: false })` esvazia o catálogo das conquistas para `idle.test.ts` e
  `idleGente.test.ts`, que conferem a conta exata sem o +1% das conquistas que as ações vão ganhando.
- **Frase do limaumdoc** ("a combinar com o grupo" na spec): provisória "Contratou o limaumdoc. Agora é com ele."; trocar
  é só texto (`nomes.ts`) + migração nova de catálogo.
- A conquista do "Vitor" fica para depois (migração nova de catálogo quando o Juan explicar a piada).

## Restrições globais

- **Sem reset:** nada apaga estado, contratos, pontos ou conquistas (`delete from public.idle_state`,
  `delete from public.idle_contracts` e `delete from public.idle_conquistas` não aparecem na 0041) e nada filtra o jogo ou
  o placar pela semana. A semana só existe na foto de segunda (que só tira foto) e no limite diário de oportunidades. A
  venda é escolha do jogador e só zera a empresa dele.
- Fellas Inc. **não toca nos créditos do cassino**: nada de `game_wallets`, `game_ledger`, `games_move`, Blackjack,
  Poker, fiado ou `weekly_champion` no código novo.
- Migrações novas: `0040_fellas_inc_catalogo_conquistas.sql` (gerada por `catalogoSql()`, regra do cabeçalho da 0033:
  `ATUALIZAR_CATALOGO=<arquivo>.sql npx vitest run idle/catalogo.test.ts` em `games/`) e `0041_fellas_inc_prestigio.sql`.
  As duas listadas em `games/test/db.ts` e `games/dev/mockDb.ts`. **0033 a 0039 não se editam.** Todo arquivo em UTF-8
  sem BOM (`games/test/migracoesUtf8.test.ts`).
- Função que já existe muda com `create or replace` mantendo a assinatura, copiada da versão mais nova (0034 para
  `idle_open`, `idle_buy`, `idle_claim_opportunity`; 0036 para `idle_save`; 0038 para `idle_rate_at`, `idle_json`,
  `idle_hire`, `idle_board`, `idle_weekly_reset`).
- Toda tabela com RLS e leitura para membros (`public.is_member()`); escrita só por funções `security definer
  set search_path = public`; funções internas com `revoke all ... from public, anon, authenticated`; RPCs com
  `revoke all ... from public, anon` + `grant execute ... to authenticated`. Erros de usuário `raise exception '<codigo>'
  using errcode = 'P0001'` (código novo: `idle_prestige_low`); não membro `not_member` com `42501`. Todo
  `update public.`/`delete from public.` com `where` (`__tests__/safeUpdateMigrations.test.ts`). Migrações idempotentes.
- Paridade: toda conta de produção, agora com `× (1 + 0,01·pontos) × (1 + 0,01·conquistas)`, é igual em SQL e em
  `games/idle/economia.ts`, com erro relativo < 1e-9 em `games/test/idleParidade.test.ts`, inclusive atravessando
  vencimento de contrato e o teto de 8h.
- Página do jogo: pt-BR no tom do `PRODUCT.md` (informal, "você", botão diz a ação, sem emoji como ícone; "★" é
  caractere de texto); CSS em `games/idle/idle.css` com as cores que ele já usa; alvo de toque ≥ 44px; foco visível;
  texto vindo do banco por `textContent`. Edições pontuais em `tela.ts` e `main.ts`: o que já existe fica (aba Melhorias
  "À venda | Compradas", placar "+R$ X/s" com "Era N · nome", folhas, `vigiarVersao`, editor de personagem, aba Contratar).
  Frontend usa a skill `impeccable` (modo Operate), lendo `PRODUCT.md` e `DESIGN.md` antes.
- Arte feita por código fora do repositório (`C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`, padrão do
  `BRIEF-SPRITES.md` e do `gerais.js`) e copiada para `games/idle/assets/conquistas/`. Sem o ícone, a célula mostra só
  a moldura.
- `?mock`: bots com pontos e conquistas de exemplo (uma escondida); `__vendavel()` no console deixa a sua empresa
  vendável.
- Commits sem `Co-Authored-By` nem qualquer marca de IA. Branch `fellas-inc-prestigio`; no fim, merge local na `main` e
  push (sem PR), só depois de o Juan aplicar as migrações e as colunas serem conferidas.
- Windows + Git Bash: `cd <dir> && ...` em cada comando. Na raiz: `npx tsc --noEmit` e `npm test`. Em `games/`:
  `npx tsc --noEmit`, `npx vitest run` e `npm run build`. O CI roda Node 24.

## Foco da revisão

1. **Toque duplo em "Vender"** (ou dois aparelhos): a segunda chamada espera a trava da linha e encontra a empresa já
   vendida: `idle_not_started`, pontos e vendas contados uma vez só. Teste no banco (Task 5).
2. **Venda com contratados que não abrem o jogo há horas**, com contrato ativo ou já vencido sem a conta fechada: eles
   fecham a conta com o triplo da Cultura de startup antes de as estratégias de quem vendeu zerarem. Testes no banco
   (Task 5); a ordem das travas (`idle_lock_all`, por `user_id`) fica para a revisão de código.
3. **Conquista não vale pra trás**: quem ganha numa ação já teve a conta fechada; o "Pai tá on", dado pela foto de
   segunda sem ação do jogador, fecha a conta do unicórnio antes. Testes no banco (Tasks 4 e 5).
4. **Página velha depois da venda** (outra aba, outro aparelho): a compra volta `idle_not_started` e a página recarrega
   (já está em `RECARREGA`); a folha "Vender a startup?" some quando a venda deixou de compensar (`idle_prestige_low`
   recarrega). Teste da tela para a folha (Task 8); o resto na conferência real com dois aparelhos (Task 11; no `?mock`
   cada aba tem o seu banco).
5. **Celular estreito**: as 5 abas rolam de lado e o aviso de conquista não tapa nenhum toque (`pointer-events: none`).
   Teste das 5 abas (Task 8); a rolagem e o aviso entram na conferência no `?mock` a 360 px (Task 8).

---

## Estrutura de arquivos

```
supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql   GERADO por catalogo.ts: + conquistas; 283 = "Filial em Portugal"
supabase/migrations/0041_fellas_inc_prestigio.sql             colunas, idle_conquistas, conta com bônus, conquistas, venda,
                                                              placar, foto de segunda, o que já aconteceu
games/idle/
  nomes.ts             + TipoConquista, CONQUISTAS_GERADOR, ConquistaTexto, CONQUISTAS; 283 renomeada
  catalogo.ts          + Conquista, catalogo.conquistas, idle_cat_conquista no SQL gerado
  economia.ts          + Bonus, SEM_BONUS, POR_PONTO, POR_CONQUISTA, K_PRESTIGIO, multBonus, pontosTotais
  simulacao.ts         + amostras, bonus, primeiraVenda, volta
  conquistas.ts        (novo) grade, avisos, textos da venda, fila de avisos
  ativos.ts            + conquista(id)
  tela.ts, idle.css    aba Conquistas, folha de venda, aviso na cena, ★ no placar, abas roláveis (edições pontuais)
  main.ts              vender, fila de avisos (edições pontuais)
  assets/conquistas/   (Task 10) conquista-001.png … conquista-062.png, conquista-101.png … conquista-111.png
games/shared/types.ts, api.ts, errors.ts      IdleState/IdleBoardRow novos, idlePrestige, idle_prestige_low
games/dev/mockIdle.ts, mockDb.ts             bots com pontos e conquistas, idlePrestige, __vendavel, dono(); 0040 e 0041
games/test/db.ts                             0040 e 0041; freshDb({ conquistas: false })
games/test/idleConquistas.test.ts            (novo) banco: conquistas
games/test/idlePrestigio.test.ts             (novo) banco: venda, placar, a migração contando o passado
games/test/idle.test.ts, idleGente.test.ts   freshDb({ conquistas: false })
games/test/idleParidade.test.ts              paridade com pontos e conquistas; pontos totais
__tests__/fellasIncMigration.test.ts         travas da 0040/0041
../fellas-inc-esbocos/ (fora do repo)        BRIEF-CONQUISTAS.md e conquistas.js
```

**Ordem:** Tasks 1–8 em sequência. A Task 9 (arte, fora do repositório) pode correr em paralelo com o código. Task 10
depois de 8 e 9. Task 11 por último.

---

## Contrato de formato da arte (vale para o código e para a arte)

- Um PNG por conquista: `games/idle/assets/conquistas/conquista-NNN.png`, NNN = id com 3 dígitos (`conquista-001.png`
  … `conquista-062.png`, `conquista-101.png` … `conquista-111.png`; 73 arquivos). O jogo acha o arquivo por
  `ativos.conquista(id)`; arquivo de id que não existe no catálogo é erro (teste da Task 10).
- **16×16**, fundo transparente, **1 quadro** (estático), pixel duro (sem semitransparência), contorno preto de 1px de
  `cv.contornar()` com 1px de margem, 2 a 4 cores mais o contorno, como os ícones das melhorias gerais (`gerais.js`).
- Na tela aparece a 48×48 (3×, `image-rendering: pixelated`) num quadradinho escuro (`#1B1A22`). Bloqueada, a tela
  aplica `grayscale(1)` e opacidade 0,35: a silhueta tem de ler sem cor.
- Sem o arquivo, a célula mostra só a moldura (`.icone-conquista.sem-arte`); nada quebra.

---

### Task 1: Catálogo das conquistas e a "Filial em Portugal" (0040)

**Files:**
- Modify: `games/idle/nomes.ts`, `games/idle/catalogo.ts`, `games/idle/catalogo.test.ts`, `games/test/db.ts`,
  `games/dev/mockDb.ts`
- Create (gerado): `supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql`

**Interfaces:**
- Produz: `TipoConquista` (re-exportado de `catalogo.ts`), `Conquista = { id, nome, frase, condicao, tipo, alvo: number |
  null, valor: number | null, texto: string | null, escondida }`, `catalogo.conquistas` (ids 1–62 visíveis, 101–111
  escondidas), `Catalogo.conquistas`; a tabela `public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor,
  texto, escondida)`.

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
```

No `describe('catálogo no banco (migração mais recente)', ...)`, troque a linha do teste das aspas

```ts
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [] }))
```

por

```ts
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [], conquistas: [] }))
```

e, antes de `it('frase da sinergia 2006 usa vírgula decimal (pt-BR)', ...)`, acrescente:

```ts
  it('conquistas entram no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, texto, escondida) values');
    expect(catalogoSql()).toContain("(101, '6-7', 'Seis sete. Ninguém sabe por quê.', 'Ter exatamente 67 de algum gerador', 'gerador_exato', null, 67, null, true)");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/catalogo.test.ts`
Expected: FAIL (`catalogo.conquistas` não existe; a 283 ainda é "Visto de negócios").

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
  { id: 32, tipo: 'taxa', valor: 100, nome: 'Cem por segundo', frase: 'Já paga o iFood.', condicao: 'Produzir R$ 100 por segundo' },
  { id: 33, tipo: 'taxa', valor: 1e4, nome: 'Dez mil por segundo', frase: 'O contador começou a te ligar.', condicao: 'Produzir R$ 10 mil por segundo' },
  { id: 34, tipo: 'taxa', valor: 1e6, nome: 'Milhão por segundo', frase: 'Um prêmio da Mega a cada segundo.', condicao: 'Produzir R$ 1 mi por segundo' },
  { id: 35, tipo: 'taxa', valor: 1e9, nome: 'Bilhão por segundo', frase: 'A Forbes mandou e-mail.', condicao: 'Produzir R$ 1 bi por segundo' },
  { id: 36, tipo: 'taxa', valor: 1e12, nome: 'Trilhão por segundo', frase: 'Maior que o PIB, menor que o ego.', condicao: 'Produzir R$ 1 tri por segundo' },
  { id: 37, tipo: 'taxa', valor: 1e15, nome: 'Quatrilhão por segundo', frase: 'Ninguém sabe escrever esse número.', condicao: 'Produzir R$ 1 quatri por segundo' },
  { id: 38, tipo: 'taxa', valor: 1e18, nome: 'Quintilhão por segundo', frase: 'O dinheiro do mundo acabou. Você imprimiu mais.', condicao: 'Produzir R$ 1 quinti por segundo' },
  { id: 39, tipo: 'era', valor: 2, nome: 'Saiu do quarto', frase: 'A garagem é o novo quarto.', condicao: 'Chegar na era 2 (Garagem)' },
  { id: 40, tipo: 'era', valor: 3, nome: 'Escritório de verdade', frase: 'Tem até catraca.', condicao: 'Chegar na era 3 (Escritório)' },
  { id: 41, tipo: 'era', valor: 4, nome: 'Andar inteiro', frase: 'O elevador para só pra você.', condicao: 'Chegar na era 4 (Andar inteiro)' },
  { id: 42, tipo: 'era', valor: 5, nome: 'Sede própria', frase: 'O prédio tem o seu logo.', condicao: 'Chegar na era 5 (Sede)' },
  { id: 43, tipo: 'gerador', alvo: 30, valor: 1, nome: 'Rumo a Marte', frase: 'Do quarto pra Marte.', condicao: 'Ter 1 "Foguete pra Marte"' },
  { id: 44, tipo: 'melhorias', valor: 10, nome: 'Upgrade', frase: 'Dez melhorias e o notebook ainda esquenta.', condicao: 'Comprar 10 melhorias' },
  { id: 45, tipo: 'melhorias', valor: 50, nome: 'Otimizador', frase: 'Cinquenta melhorias, zero reuniões.', condicao: 'Comprar 50 melhorias' },
  { id: 46, tipo: 'melhorias', valor: 150, nome: 'Tudo turbinado', frase: 'Não tem mais o que melhorar. Ou tem.', condicao: 'Comprar 150 melhorias' },
  { id: 47, tipo: 'oportunidades', valor: 1, nome: 'Olho vivo', frase: 'Pegou a primeira.', condicao: 'Pegar 1 oportunidade' },
  { id: 48, tipo: 'oportunidades', valor: 25, nome: 'Caçador de oportunidade', frase: 'Vê promoção de longe.', condicao: 'Pegar 25 oportunidades' },
  { id: 49, tipo: 'oportunidades', valor: 100, nome: 'Oportunista', frase: 'No bom sentido.', condicao: 'Pegar 100 oportunidades' },
  { id: 50, tipo: 'oportunidades', valor: 500, nome: 'Não deixa passar nada', frase: 'Quinhentas. Você dorme?', condicao: 'Pegar 500 oportunidades' },
  { id: 51, tipo: 'vendas', valor: 1, nome: 'Exit', frase: 'Vendeu a primeira startup.', condicao: 'Vender a startup 1 vez' },
  { id: 52, tipo: 'vendas', valor: 5, nome: 'Empreendedor serial', frase: 'Abre, cresce, vende, repete.', condicao: 'Vender a startup 5 vezes' },
  { id: 53, tipo: 'vendas', valor: 10, nome: 'Fábrica de startup', frase: 'Dez exits no currículo.', condicao: 'Vender a startup 10 vezes' },
  { id: 54, tipo: 'vendas', valor: 25, nome: 'Lenda do Vale', frase: 'Vinte e cinco vendas. Já vira palestra.', condicao: 'Vender a startup 25 vezes' },
  { id: 55, tipo: 'contratei', valor: 1, nome: 'Primeira contratação', frase: 'Agora você é chefe.', condicao: 'Contratar 1 vez' },
  { id: 56, tipo: 'contratei', valor: 10, nome: 'O RH sou eu', frase: 'Dez contratos assinados.', condicao: 'Contratar 10 vezes' },
  { id: 57, tipo: 'contratei', valor: 50, nome: 'Headhunter', frase: 'Cinquenta contratações e nenhuma entrevista.', condicao: 'Contratar 50 vezes' },
  { id: 58, tipo: 'contratado', valor: 1, nome: 'Primeiro emprego', frase: 'Carteira assinada (de mentira).', condicao: 'Ser contratado 1 vez' },
  { id: 59, tipo: 'contratado', valor: 10, nome: 'Disputado', frase: 'Dez empresas te quiseram.', condicao: 'Ser contratado 10 vezes' },
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
```

- [ ] **Step 4: Catálogo (`games/idle/catalogo.ts`)**

Troque a linha do import de `./nomes` por:

```ts
import { CARGOS, CONQUISTAS, CONQUISTAS_GERADOR, ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS, type TipoConquista } from './nomes';

export type { TipoConquista } from './nomes';
```

Troque `export type Catalogo = { geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[]; cargos: string[] };` por:

```ts
export type Conquista = {
  id: number; nome: string; frase: string; condicao: string; tipo: TipoConquista;
  alvo: number | null; valor: number | null; texto: string | null; escondida: boolean;
};
export type Catalogo = { geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[]; cargos: string[]; conquistas: Conquista[] };
```

Em `montarCatalogo`, troque `  return { geradores, melhorias, estrategias, cargos: [...CARGOS] };` por:

```ts
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
  return { geradores, melhorias, estrategias, cargos: [...CARGOS], conquistas };
```

Em `catalogoSql`, logo depois da linha que monta `car` (`const car = cat.cargos.map(...)`), acrescente:

```ts
  const con = cat.conquistas.map(
    (c) =>
      `  (${c.id}, ${txt(c.nome)}, ${txt(c.frase)}, ${txt(c.condicao)}, ${txt(c.tipo)}, ${num(c.alvo)}, ${num(c.valor)}, ${c.texto === null ? 'null' : txt(c.texto)}, ${c.escondida})`,
  );
```

E, dentro do texto devolvido por `catalogoSql` (o template string), faça cinco trocas:

1. Primeira linha: `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias, estratégias e cargos. Idempotente.` vira
   `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias, estratégias, cargos e conquistas. Idempotente.`
2. Depois de `create table if not exists public.idle_cat_cargo (id int primary key, nome text not null);` acrescente:

```sql
create table if not exists public.idle_cat_conquista (
  id int primary key, nome text not null, frase text not null, condicao text not null, tipo text not null,
  alvo int, valor double precision, texto text, escondida boolean not null
);
```

3. As três linhas de RLS/permissão do catálogo ficam:

```sql
alter table public.idle_cat_cargo enable row level security;
alter table public.idle_cat_conquista enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo, public.idle_cat_conquista from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo, public.idle_cat_conquista to authenticated;
```

   e depois do `create policy "idle_cat_cargo_select_members" ...;` acrescente:

```sql
drop policy if exists "idle_cat_conquista_select_members" on public.idle_cat_conquista;
create policy "idle_cat_conquista_select_members" on public.idle_cat_conquista for select to authenticated using (public.is_member());
```

4. Depois de `delete from public.idle_cat_cargo where true;` acrescente `delete from public.idle_cat_conquista where true;`.
5. O fim do template fica:

```ts
insert into public.idle_cat_cargo (id, nome) values
${lista(car)}
insert into public.idle_cat_conquista (id, nome, frase, condicao, tipo, alvo, valor, texto, escondida) values
${lista(con)}`;
```

- [ ] **Step 5: Gerar a migração nova e listar nos dois bancos de teste**

Em `games/test/db.ts`, na lista `MIGRATIONS`, depois de `'0038_fellas_inc_gente.sql',` acrescente
`'0040_fellas_inc_catalogo_conquistas.sql',`. Em `games/dev/mockDb.ts`, depois do import `m38`, acrescente
`import m40 from '../../supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql?raw';` e troque o laço por
`for (const m of [m27, m28, m29, m30, m31, m33, m34, m35, m36, m37, m38, m40]) await db.exec(m);`.

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && ATUALIZAR_CATALOGO=0040_fellas_inc_catalogo_conquistas.sql npx vitest run idle/catalogo.test.ts`
Expected: PASS, e o arquivo `supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql` criado (confira que tem
`(283, 'gerador', 'Filial em Portugal'` e `insert into public.idle_cat_conquista`).

- [ ] **Step 6: Tudo verde**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run`
Expected: PASS (a 0040 só cria e enche o catálogo; ninguém usa ainda).

- [ ] **Step 7: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts games/test/db.ts games/dev/mockDb.ts supabase/migrations/0040_fellas_inc_catalogo_conquistas.sql && git commit -m "Fellas Inc.: catálogo das conquistas e a Filial em Portugal (0040)"
```

---

### Task 2: A conta com prestígio e conquistas em `economia.ts`, e o K pela simulação

**Files:**
- Modify: `games/idle/economia.ts`, `games/idle/economia.test.ts`, `games/idle/simulacao.ts`, `games/idle/simulacao.test.ts`

**Interfaces:**
- Produz (`economia.ts`): `Bonus = { pontos: number; conquistas: number }`, `SEM_BONUS`, `Estado.bonus?: Bonus`,
  `POR_PONTO = 0.01`, `POR_CONQUISTA = 0.01`, `K_PRESTIGIO = 1e6`, `multBonus(s: Estado): number`,
  `pontosTotais(r: number): number`; `fatores`/`taxa`/`taxaPorUnidade` passam a multiplicar por `multBonus`.
- Produz (`simulacao.ts`): `Amostra = { t: number; taxa: number; era: number }`, `Marcos.amostras: Amostra[]`,
  `simular(cat?, dias?, bonus?: Bonus)`, `primeiraVenda(m: Marcos, minimo: number): Amostra | null`,
  `volta(cat?, pontos?, dias?): { era: number; primeira: number; segunda: number } | null`.

- [ ] **Step 1: Testes**

Em `games/idle/economia.test.ts`, troque o import de `./economia` por:

```ts
import {
  acumular, acumularTrechos, custoMult, era, liberada, maxCompra, multBonus, multContratos, podeComprarGerador, pontosTotais, preco, taxa,
  taxaPorUnidade, type Estado,
} from './economia';
```

e acrescente no fim do arquivo:

```ts

describe('prestígio e conquistas', () => {
  it('cada ponto e cada conquista: +1% na produção toda', () => {
    const s = com([[1, 2]]);
    expect(multBonus(s)).toBe(1);
    expect(taxa(cat, { ...s, bonus: { pontos: 10, conquistas: 0 } })).toBeCloseTo(1 * PISO * 1.1, 10);
    expect(taxa(cat, { ...s, bonus: { pontos: 10, conquistas: 5 } })).toBeCloseTo(1 * PISO * 1.1 * 1.05, 10);
    expect(taxaPorUnidade(cat, { ...s, bonus: { pontos: 0, conquistas: 3 } }, 1)).toBeCloseTo(0.5 * PISO * 1.03, 10);
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
import { primeiraVenda, simular, volta } from './simulacao';
```

e acrescente no fim do arquivo:

```ts

// Prestígio (spec da entrega 3, seção 1.4). Medido ao planejar, com K = 1 milhão: a venda vale 1 ponto já no dia 1
// (0,7 d, era 3), 5 pontos com 2,7 d (era 4), 10 pontos com 5,5 d (11 pontos, era 5) e 15 pontos no fim da semana.
// Voltar à era 5 depois de vender com 11 pontos leva os mesmos 3,0 d (+11% não adianta uma sessão sequer: o ritmo é o
// das 3 aberturas por dia). Se algum número sair do alvo, NÃO mexa em PARAMETROS nem em K: pare e avise.
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
  it('depois de vender com 10 pontos, voltar à era em que estava não fica mais lento', () => {
    const r = volta(catalogo, 10)!;
    expect(r).not.toBeNull();
    expect(r.era).toBe(5);
    expect(r.segunda).toBeLessThanOrEqual(r.primeira);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/economia.test.ts idle/simulacao.test.ts`
Expected: FAIL (`multBonus`, `pontosTotais`, `K_PRESTIGIO`, `primeiraVenda`, `volta` não existem).

- [ ] **Step 3: `games/idle/economia.ts`**

Na primeira linha do comentário do topo, troque `Iguais às do banco (0034)` por `Iguais às do banco (0034, 0038, 0041)`.
Troque `export type Estado = { generators: number[]; upgrades: number[]; strategies: number[]; social?: Social };` por:

```ts
/** Prestígio e conquistas (entrega 3): quantos pontos de prestígio e quantas conquistas você tem; cada um vale +1% de
 *  produção, pra sempre. Sem isso (simulação, testes) = nenhum. */
export type Bonus = { pontos: number; conquistas: number };
export const SEM_BONUS: Bonus = { pontos: 0, conquistas: 0 };
export type Estado = { generators: number[]; upgrades: number[]; strategies: number[]; social?: Social; bonus?: Bonus };
```

Antes de `export const CRESCIMENTO = 1.15;` acrescente:

```ts
export const POR_PONTO = 0.01;
export const POR_CONQUISTA = 0.01;
/** K do prestígio (medido em simulacao.test.ts): pontos totais = floor(cbrt(R$/s ÷ K)). Igual a idle_prestige_total. */
export const K_PRESTIGIO = 1e6;

```

Antes de `const porId = new WeakMap<Catalogo, Map<number, Melhoria>>();` acrescente:

```ts
/** Multiplicador do prestígio e das conquistas (igual a idle_bonus_mult na 0041): (1 + 1%·pontos) × (1 + 1%·conquistas). */
export function multBonus(s: Estado): number {
  const b = s.bonus ?? SEM_BONUS;
  return (1 + POR_PONTO * b.pontos) * (1 + POR_CONQUISTA * b.conquistas);
}

/** Quantos pontos de prestígio um R$/s vale: floor(cbrt(r ÷ K)), exato nos cubos (igual a idle_prestige_total). */
export function pontosTotais(r: number): number {
  const x = Number.isFinite(r) && r > 0 ? r / K_PRESTIGIO : 0;
  let n = Math.floor(Math.cbrt(x));
  while (n > 0 && n ** 3 > x) n--;
  while ((n + 1) ** 3 <= x) n++;
  return n;
}

```

Em `fatores`, troque `  global *= multContratos(cat, s);` por:

```ts
  global *= multContratos(cat, s);
  global *= multBonus(s);
```

- [ ] **Step 4: `games/idle/simulacao.ts`**

Troque o import de `./economia` e o tipo `Marcos` por:

```ts
import {
  acumular, custoMult, era, liberada, podeComprarGerador, pontosTotais, preco, SEM_BONUS, SOLO, taxa, taxaPorUnidade,
  type Bonus, type Estado,
} from './economia';

/** R$/s e era no fim de cada sessão (t em segundos de jogo). */
export type Amostra = { t: number; taxa: number; era: number };
export type Marcos = {
  segundaNotebook: number | null; era: Record<number, number | null>; compras1h: number; gerador30: number | null;
  amostras: Amostra[];
};
```

Troque o começo de `simular`:

```ts
export function simular(cat: Catalogo = padrao, dias = 7): Marcos {
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1], social: SOLO };
```

por:

```ts
/** `bonus`: pontos de prestígio e conquistas com que a empresa começa (o jogador que já vendeu). */
export function simular(cat: Catalogo = padrao, dias = 7, bonus: Bonus = SEM_BONUS): Marcos {
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1], social: SOLO, bonus };
```

Na criação de `marcos`, troque `compras1h: 0, gerador30: null };` por `compras1h: 0, gerador30: null, amostras: [] };`.
Troque o fim do arquivo:

```ts
    for (let t = ini; t < fim; t += PASSO) {
      avancar(t);
      comprar();
    }
  }
  return marcos;
}
```

por:

```ts
    for (let t = ini; t < fim; t += PASSO) {
      avancar(t);
      comprar();
    }
    marcos.amostras.push({ t: fim, taxa: taxa(cat, s), era: era(cat, s.generators) });
  }
  return marcos;
}

/** A primeira vez (fim de sessão) em que vender a startup rende pelo menos `minimo` pontos. */
export function primeiraVenda(m: Marcos, minimo: number): Amostra | null {
  return m.amostras.find((a) => pontosTotais(a.taxa) >= minimo) ?? null;
}

/** O jogador que vende: joga até a venda valer `pontos`, vende e recomeça com os pontos que ganhou (sem contar as
 *  conquistas, que só ajudariam). Quanto tempo levou pra chegar na era em que estava da primeira vez e depois de vender
 *  (Infinity = não chegou em `dias`). null = a venda nunca chegou a `pontos`. */
export function volta(cat: Catalogo = padrao, pontos = 10, dias = 14): { era: number; primeira: number; segunda: number } | null {
  const m1 = simular(cat, dias);
  const venda = primeiraVenda(m1, pontos);
  if (!venda || venda.era < 2) return null;
  const m2 = simular(cat, dias, { pontos: pontosTotais(venda.taxa), conquistas: 0 });
  return { era: venda.era, primeira: m1.era[venda.era]!, segunda: m2.era[venda.era] ?? Infinity };
}
```

- [ ] **Step 5: Rodar e ver passar (os marcos antigos não mudam: sem bônus, `multBonus` é 1)**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run idle/`
Expected: PASS. Se "ritmo da semana" ou "ritmo do prestígio" falhar, NÃO mexa em `PARAMETROS` nem em `K_PRESTIGIO`:
pare e avise.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/economia.ts games/idle/economia.test.ts games/idle/simulacao.ts games/idle/simulacao.test.ts && git commit -m "Fellas Inc.: prestígio e conquistas na conta (economia.ts) e o K pela simulação"
```

---

### Task 3: A conta com prestígio e conquistas no banco (0041, parte 1)

**Files:**
- Create: `supabase/migrations/0041_fellas_inc_prestigio.sql` (começo; as Tasks 4 e 5 acrescentam no fim)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts`, `games/test/idleParidade.test.ts`

**Interfaces:**
- Consome: `Bonus`, `taxa`, `pontosTotais` (Task 2); `idle_social_mult` (0038); `idle_cat_conquista` (Task 1).
- Produz: colunas novas de `idle_state` (`prestige_points int`, `prestige_count int`, `best_rate double precision`,
  `upg_total int`, `opp_total int`, `hire_total int`, `hired_total int`, `est_usadas int[]`, `opp_recent timestamptz[]`,
  todas `not null` com default); tabela `idle_conquistas (user_id, conquista_id, ganhou_em)`; funções internas
  `idle_est_codigos(smallint[]) → int[]`, `idle_bonus_mult(idle_state) → double precision`,
  `idle_rate_at(idle_state, timestamptz)` (a da 0038 × `idle_bonus_mult`), `idle_prestige_total(double precision) → int`.

- [ ] **Step 1: Testes de paridade (`games/test/idleParidade.test.ts`)**

No import de `../idle/economia`, acrescente `pontosTotais` (fica
`import { acumular, acumularTrechos, custoMult, maxCompra, pontosTotais, preco, taxa, type Estado } from '../idle/economia';`).
Logo depois de `const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;`, acrescente:

```ts
/** A fica com exatamente n conquistas (ids 1..n; a conta só olha quantas). */
async function conquistas(n: number) {
  await q('delete from public.idle_conquistas where true');
  if (n) await q('insert into public.idle_conquistas (user_id, conquista_id) select $1, g from generate_series(1, $2) g', [A, n]);
}
```

No fim do `describe('paridade', ...)` (antes do `});` final), acrescente:

```ts
  it('taxa com prestígio e conquistas', async () => {
    const r = rng(5);
    for (const s of estados(20)) {
      const bonus = { pontos: Math.floor(r() * 300), conquistas: Math.floor(r() * 60) };
      await preparar(s, 'prestige_points', [bonus.pontos]);
      await conquistas(bonus.conquistas);
      const [db] = await q<{ r: number }>('select public.idle_rate(s) as r from public.idle_state s where user_id = $1', [A]);
      expect(rel(db.r, taxa(catalogo, { ...s, bonus }))).toBeLessThan(1e-9);
    }
    await conquistas(0);
  });
  it('fechar a conta com prestígio e conquistas, atravessando vencimento e teto de 8h', async () => {
    const T0 = Date.parse('2026-10-12T10:00:00Z');
    const iso = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;
    const s = estados(4)[3];
    const bonus = { pontos: 17, conquistas: 9 };
    await preparar(s, 'valuation, settled_at, boost_until, prestige_points',
      [1000, new Date(T0).toISOString(), new Date(T0 + 200_000).toISOString(), bonus.pontos]);
    await conquistas(bonus.conquistas);
    await contrato(C, A, iso(T0 - 86400_000), iso(T0 + 300_000)); // C (Cultura) contratou A: vence 300 s depois
    const trechos = [
      { desdeMs: T0, r: taxa(catalogo, { ...s, bonus, social: { contratei: 0, empregos: [3] } }) },
      { desdeMs: T0 + 300_000, r: taxa(catalogo, { ...s, bonus, social: { contratei: 0, empregos: [] } }) },
    ];
    for (const ate of [T0 + 50_000, T0 + 1000_000, T0 + 10 * 3600_000]) {
      const [db] = await q<{ v: number }>(
        `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
        [A, new Date(ate).toISOString()],
      );
      expect(rel(db.v, acumularTrechos(1000, trechos, T0, ate, T0 + 200_000))).toBeLessThan(1e-9);
    }
    await q('delete from public.idle_contracts where true');
    await conquistas(0);
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
-- prestígio (+1% de produção cada, pra sempre) e as conquistas dão +1% cada, pra sempre. A Fellas Inc. continua sem
-- reset (0036): só o jogador zera a própria empresa, vendendo; nada aqui apaga estado, contrato, ponto ou conquista.
-- As funções que mudam são trocadas com create or replace a partir da versão mais nova (0034, 0036 ou 0038, já em
-- produção). As contas existem iguais em games/idle/economia.ts (teste de paridade). Depende da 0040 (catálogo das
-- conquistas). Não toca nos créditos do cassino. Idempotente.

-- ===== o que fica pra sempre (a venda não zera) =====

alter table public.idle_state
  add column if not exists prestige_points int not null default 0 check (prestige_points >= 0),
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

-- ===== a conta com prestígio e conquistas =====

-- as estratégias escolhidas agora, como códigos era·10 + opção (a 2 da era 4 = 42)
create or replace function public.idle_est_codigos(p smallint[])
returns int[] language sql immutable as $$
  select coalesce(array_agg((k + 1) * 10 + p[k] order by k), '{}') from generate_subscripts(p, 1) k where p[k] >= 0
$$;

-- +1% por ponto de prestígio e +1% por conquista (igual a economia.ts multBonus)
create or replace function public.idle_bonus_mult(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select (1 + 0.01::double precision * s.prestige_points)
       * (1 + 0.01::double precision * (select count(*) from public.idle_conquistas c where c.user_id = s.user_id))
$$;

-- produção por segundo em t (a da 0038 × prestígio e conquistas; igual a economia.ts taxa)
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

revoke all on function public.idle_est_codigos(smallint[]) from public, anon, authenticated;
revoke all on function public.idle_bonus_mult(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_prestige_total(double precision) from public, anon, authenticated;
```

- [ ] **Step 4: Rodar e ver passar; nada antigo muda (ninguém tem ponto nem conquista ainda: o bônus é 1)**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run test/ && npx tsc --noEmit`
Expected: PASS (paridade nova e todos os testes de banco de antes).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add supabase/migrations/0041_fellas_inc_prestigio.sql games/test/db.ts games/dev/mockDb.ts games/test/idleParidade.test.ts && git commit -m "Fellas Inc.: pontos e conquistas na conta do banco (0041, parte 1)"
```

---

### Task 4: Conquistas no banco: conferir, gravar e devolver (0041, parte 2)

**Files:**
- Modify: `supabase/migrations/0041_fellas_inc_prestigio.sql` (acrescentar no fim), `games/test/db.ts`,
  `games/test/idle.test.ts`, `games/test/idleGente.test.ts`, `games/test/idleParidade.test.ts`
- Create: `games/test/idleConquistas.test.ts`

**Interfaces:**
- Consome: Task 3; `pendentes` (`games/idle/oportunidades.ts`); `catalogo.conquistas` (Task 1).
- Produz: `idle_ganhar(p_user uuid, p_tipo text, p_valor double precision default null, p_texto text default null)`,
  `idle_madrugada(ts timestamptz default now()) → boolean`, `idle_check_conquistas(p_user uuid) → int[]` (as gravadas
  agora), `idle_save` que confere as conquistas e guarda o recorde, e o estado de toda RPC com os campos novos:
  `bonus: { pontos, conquistas }`, `vendas`, `recorde`, `pontos_venda`, `conquistas: [{ id, em }]` (da mais antiga à mais
  nova), `novas: int[]` (as desta chamada), `descobertas: int[]` (escondidas que alguém tem). `idle_open` (3h06),
  `idle_buy` (`upg_total`, jaula), `idle_claim_opportunity` (`opp_total`, `opp_recent`), `idle_hire` (`hire_total`,
  `hired_total`, limaumdoc). `freshDb({ conquistas: false })`.

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
  bonus: { pontos: number; conquistas: number }; conquistas: { id: number; em: string }[]; novas: number[]; descobertas: number[];
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
    expect(s.bonus).toEqual({ pontos: 0, conquistas: 2 });
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
    const bonus = { pontos: 23, conquistas: 7 };
    await preparar(s, 'prestige_points', [bonus.pontos]);
    await conquistas(bonus.conquistas);
    const [db] = await q<{ r: number; b: { pontos: number; conquistas: number } }>(
      `select (public.idle_json(s) ->> 'rate')::double precision as r, public.idle_json(s) -> 'bonus' as b
         from public.idle_state s where user_id = $1`,
      [A],
    );
    expect(db.b).toEqual(bonus);
    expect(rel(db.r, taxa(catalogo, { ...s, bonus }))).toBeLessThan(1e-9);
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
-- recorde de R$/s. Toda função que muda o jogo termina aqui, depois de fechar a conta.
create or replace function public.idle_save(s public.idle_state)
returns void language plpgsql volatile set search_path = public as $$
begin
  update public.idle_state
     set started = s.started, valuation = s.valuation, generators = s.generators, upgrades = s.upgrades,
         strategies = s.strategies, boost_until = s.boost_until, half_price = s.half_price,
         opp_claimed = array(select w from unnest(s.opp_claimed) w
                              where w >= floor(extract(epoch from now()) / 600)::bigint - 30),
         opp_day = s.opp_day, opp_count = s.opp_count,
         settled_at = s.settled_at, updated_at = now(),
         prestige_points = s.prestige_points, prestige_count = s.prestige_count,
         upg_total = s.upg_total, opp_total = s.opp_total, hire_total = s.hire_total, hired_total = s.hired_total,
         est_usadas = array(select distinct x from unnest(s.est_usadas || public.idle_est_codigos(s.strategies)) x order by x),
         opp_recent = s.opp_recent
   where user_id = s.user_id;
  perform public.idle_check_conquistas(s.user_id);
  -- o recorde depois das conquistas novas (o R$/s que a tela mostra já conta com elas)
  update public.idle_state set best_rate = greatest(best_rate, s.best_rate, public.idle_rate(s)) where user_id = s.user_id;
end;
$$;

-- o estado que toda função do jogo devolve: o da 0038 + bônus (pontos e quantas conquistas), vendas, recorde de R$/s,
-- quantos pontos a venda daria agora, suas conquistas, as ganhas nesta chamada (a tela avisa) e as escondidas que
-- alguém do grupo já tem (a tela mostra "???").
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
      'pontos', s.prestige_points,
      'conquistas', (select count(*) from public.idle_conquistas c where c.user_id = s.user_id)),
    'vendas', s.prestige_count,
    'recorde', greatest(s.best_rate, v_rate),
    'pontos_venda', case when s.started then greatest(0, public.idle_prestige_total(v_rate) - s.prestige_points) else 0 end,
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

-- pegar oportunidade (a da 0034) + conta as pegas e guarda a hora das 3 últimas ("Brainrot")
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
  v_mult := coalesce((select exp(sum(ln(e.opp_bonus_mult))) from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]), 1);
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

-- contratar (a da 0038) + conta os contratos dos dois lados e o "limaumdoc" (pelo nome de usuário)
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
  values (v_me, p_user, coalesce(v_cargo, 'freela'), now(), now() + interval '7 days');
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

### Task 5: Vender a startup, placar com pontos e a foto de segunda (0041, parte 3)

**Files:**
- Modify: `supabase/migrations/0041_fellas_inc_prestigio.sql` (acrescentar no fim), `games/test/idleConquistas.test.ts`,
  `__tests__/fellasIncMigration.test.ts`
- Create: `games/test/idlePrestigio.test.ts`

**Interfaces:**
- Consome: Tasks 3 e 4; `idle_lock_all`, `idle_most_hired`, `idle_employee_mult` (0038).
- Produz: RPC `idle_prestige() → jsonb` (o estado, já vendido; erros `idle_not_started`, `idle_prestige_low`,
  `not_member`); linhas de `idle_board` com `pontos` e `conquistas` (quantas); `idle_weekly_reset` dando o "Pai tá on"
  ao unicórnio (com a conta dele fechada antes); a parte da 0041 que conta o que já aconteceu (idempotente).

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
  bonus: { pontos: number; conquistas: number }; vendas: number; recorde: number; pontos_venda: number;
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
  it('quem já tem os pontos que o R$/s vale não ganha nada; com menos, ganha só a diferença', async () => {
    await abrir(A);
    await enriquecer(A);
    const total = pontosTotais((await t.rpc<Estado>('idle_open')).rate);
    await q('update public.idle_state set prestige_points = $2 where user_id = $1', [A, total + 50]);
    expect((await t.rpc<Estado>('idle_open')).pontos_venda).toBe(0);
    await expect(vender()).rejects.toThrow(/idle_prestige_low/);
    await q('update public.idle_state set prestige_points = 2 where user_id = $1', [A]);
    const antes = await t.rpc<Estado>('idle_open');
    expect(antes.pontos_venda).toBe(pontosTotais(antes.rate) - 2);
    expect((await vender()).bonus.pontos).toBe(pontosTotais(antes.rate));
  });
  it('toque duplo em Vender: a segunda recebe idle_not_started e os pontos entram uma vez só', async () => {
    // em produção a segunda chamada espera a trava da linha (idle_lock_all) e já encontra a empresa vendida
    await abrir(A);
    await enriquecer(A);
    const s = await vender();
    await expect(vender()).rejects.toThrow(/idle_not_started/);
    expect(await q('select prestige_points, prestige_count from public.idle_state where user_id = $1', [A]))
      .toEqual([{ prestige_points: s.bonus.pontos, prestige_count: 1 }]);
  });
  it('sem empresa aberta: idle_not_started; não membro é barrado', async () => {
    await expect(vender()).rejects.toThrow(/idle_not_started/);
    await t.as(OUT);
    await expect(vender()).rejects.toThrow(/not_member/);
  });
});

describe('vender a startup', () => {
  it('zera a empresa e volta pro Abrir CNPJ; ficam pontos, vendas, conquistas, personagem, a cota do dia e o recorde', async () => {
    await abrir(A);
    await t.rpc('idle_set_avatar', {
      p_pele: V.pele, p_cabelo: V.cabelo, p_cor_cabelo: V.cor_cabelo, p_roupa: V.roupa, p_cor_roupa: V.cor_roupa,
      p_acessorio: V.acessorio, p_cor_acessorio: V.cor_acessorio,
    });
    await enriquecer(A);
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
    expect(s.bonus.pontos).toBe(P);
    expect(s.recorde).toBeCloseTo(antes.rate, 6);
    expect(s.opp_left).toBe(6); // 10 por dia sem estratégia, 4 já pegas hoje: a cota não reabre
    expect(s.conquistas.map((c) => c.id)).toEqual(expect.arrayContaining(antes.conquistas.map((c) => c.id)));
    expect(s.novas).toEqual(expect.arrayContaining([51, 109])); // Exit; Modo sigma (nunca contratou)
    // Abrir CNPJ de novo: R$ 10, 1 notebook e o bônus valendo
    const r = await t.rpc<Estado>('idle_start');
    expect(r).toMatchObject({ started: true, valuation: 10, vendas: 1 });
    expect(r.generators[0]).toBe(1);
    expect(r.rate).toBeCloseTo(0.5 * 1.02 * (1 + 0.01 * P) * (1 + 0.01 * r.bonus.conquistas), 10);
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
  it('ninguém escreve nos pontos nem nas conquistas (nem nos próprios); as funções internas estão fechadas', async () => {
    await abrir(A);
    await expect(t.asRole('authenticated', `update public.idle_state set prestige_points = 99 where user_id = '${A}'`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `insert into public.idle_conquistas (user_id, conquista_id) values ('${A}', 1)`)).rejects.toThrow();
    await expect(t.asRole('authenticated', `delete from public.idle_conquistas where user_id = '${A}'`)).rejects.toThrow();
    await expect(t.rpc('idle_ganhar', { p_user: B, p_tipo: 'unicornio' })).rejects.toThrow();
    await expect(t.rpc('idle_check_conquistas', { p_user: B })).rejects.toThrow();
    await expect(t.asRole('anon', 'select public.idle_prestige()')).rejects.toThrow();
  });
  it('placar: pontos e quantas conquistas cada um tem', async () => {
    await abrir(A, B);
    await q('update public.idle_state set prestige_points = 12 where user_id = $1', [B]);
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
    for (const proibido of ['delete from public.idle_state', 'delete from public.idle_contracts', 'delete from public.idle_conquistas'])
      expect(prestigioSemComentarios).not.toContain(proibido);
    expect(prestigioSemComentarios).not.toContain('games_week_start() and');
  });
  it('funções internas fechadas; as do jogo só para quem está logado', () => {
    for (const f of [
      'idle_est_codigos(smallint[])', 'idle_bonus_mult(public.idle_state)', 'idle_rate_at(public.idle_state, timestamptz)',
      'idle_prestige_total(double precision)', 'idle_ganhar(uuid, text, double precision, text)', 'idle_madrugada(timestamptz)',
      'idle_check_conquistas(uuid)', 'idle_save(public.idle_state)', 'idle_json(public.idle_state)', 'idle_weekly_reset()',
    ])
      expect(prestigio).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    for (const f of ['idle_open()', 'idle_buy(text, int, int)', 'idle_claim_opportunity(bigint)', 'idle_hire(uuid)', 'idle_prestige()', 'idle_board()'])
      expect(prestigio).toContain(`grant execute on function public.${f} to authenticated;`);
  });
  it('conquistas com RLS e leitura só para membros; sem chave estrangeira pro catálogo (que é regravado)', () => {
    expect(prestigio).toContain('alter table public.idle_conquistas enable row level security;');
    expect(prestigio).toContain('create policy "idle_conquistas_select_members" on public.idle_conquistas for select to authenticated using (public.is_member());');
    expect(prestigioSemComentarios).not.toMatch(/references public\.idle_cat_conquista/);
  });
  it('o catálogo novo é o gerado, com as conquistas e a Filial em Portugal', () => {
    const cat = ler('0040_fellas_inc_catalogo_conquistas.sql');
    expect(cat).toContain('GERADO por games/idle/catalogo.ts');
    expect(cat).toContain('insert into public.idle_cat_conquista');
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

-- troca a empresa por pontos: ganha a diferença entre os pontos que o R$/s de agora vale e os que você já tem (pelo
-- menos 1, senão idle_prestige_low). Fecha a conta; quem você contratou fecha a conta antes (o que você paga a eles
-- muda: suas estratégias zeram) e os contratos que você fez vencem agora (quem te contratou continua). Zera
-- valuation, geradores, melhorias, estratégias, boost e meia-preço e volta pro "Abrir CNPJ". Ficam pontos, vendas,
-- conquistas, personagem, contadores, o limite de oportunidades do dia e o recorde de R$/s.
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
  v_ganho := v_total - s.prestige_points;
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
  s.prestige_points := v_total;
  s.prestige_count := s.prestige_count + 1;
  s.started := false;
  s.valuation := 0;
  s.generators := array_fill(0, array[30]);
  s.upgrades := '{}';
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

-- placar (o da 0038) + pontos de prestígio e quantas conquistas cada um tem
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
                   public.idle_era(s.generators) as era, s.strategies, s.prestige_points as pontos,
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
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add supabase/migrations/0041_fellas_inc_prestigio.sql games/test/idlePrestigio.test.ts games/test/idleConquistas.test.ts __tests__/fellasIncMigration.test.ts && git commit -m "Fellas Inc.: vender a startup, pontos no placar e Pai tá on na foto (0041, parte 3)"
```

---

### Task 6: Chamadas, formatos, erros e o `?mock`

**Files:**
- Modify: `games/shared/types.ts`, `games/shared/api.ts`, `games/shared/errors.ts`, `games/shared/types.test.ts`,
  `games/shared/errors.test.ts`, `games/dev/mockDb.ts`, `games/dev/mockIdle.ts`, `games/idle/store.test.ts`,
  `games/idle/tela.test.ts` (só a fixture `estado`)

**Interfaces:**
- Consome: o formato do estado e do placar das Tasks 4 e 5.
- Produz: `IdleState` + `bonus: { pontos: number; conquistas: number }`, `vendas: number`, `recorde: number`,
  `pontos_venda: number`, `conquistas: IdleConquista[]`, `novas: number[]`, `descobertas: number[]`;
  `IdleConquista = { id: number; em: string }`; `IdleBoardRow`/`LinhaPlacar` + `pontos: number; conquistas: number`;
  `idlePrestige(): Promise<IdleState>` (em `shared/api.ts` e em `dev/mockIdle.ts`); erro `idle_prestige_low` ("Ainda não
  compensa vender"); `dono(sql, params)` em `dev/mockDb.ts`; `__vendavel(foguetes = 150)` no console do `?mock`.

- [ ] **Step 1: Testes**

Em `games/shared/types.test.ts`, a linha do banco ganha `pontos: 12, conquistas: 7` e a esperada também:

```ts
        { user_id: 'b', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hired_count: 3, by_me: true, most_hired: true, pontos: 12, conquistas: 7 },
```

```ts
    ).toEqual({ userId: 'b', name: 'Bia', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hiredCount: 3, byMe: true, mostHired: true, pontos: 12, conquistas: 7 });
```

Em `games/shared/errors.test.ts`, no `it.each` de `'erros da Fellas Inc.'`, depois de
`['idle_bad_avatar', 'Esse visual não existe'],` acrescente `['idle_prestige_low', 'Ainda não compensa vender'],`.

Em `games/idle/store.test.ts` (fixture `base`) e em `games/idle/tela.test.ts` (fixture `estado`), depois da linha
`  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,` acrescente:

```ts
  bonus: { pontos: 0, conquistas: 0 }, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [], descobertas: [],
```

Em `games/idle/tela.test.ts`, as duas linhas de placar montadas à mão ganham os campos novos: no teste
`'placar mostra o R$/s de cada um, não o valuation'`, troque
`avatar: null, hiredCount: 0, byMe: false, mostHired: false }] }));` por
`avatar: null, hiredCount: 0, byMe: false, mostHired: false, pontos: 0, conquistas: 0 }] }));`; e na fábrica `linha`, troque
`  avatar: null, hiredCount: 0, byMe: false, mostHired: false, ...x,` por
`  avatar: null, hiredCount: 0, byMe: false, mostHired: false, pontos: 0, conquistas: 0, ...x,`.

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run shared/ && npx tsc --noEmit`
Expected: FAIL (`linhaPlacar` não copia `pontos`; `idle_prestige_low` vira `unknown`; o `tsc` reclama dos campos que o
tipo ainda não tem).

- [ ] **Step 3: `games/shared/types.ts`**

Troque o fim do tipo `IdleState`:

```ts
  social: { contratei: number; empregos: number[] }; hire_price: number; muda_em: string | null;
};
```

por:

```ts
  social: { contratei: number; empregos: number[] }; hire_price: number; muda_em: string | null;
  /** Entrega 3 (0041): pontos de prestígio e quantas conquistas você tem (cada um +1% de produção), quantas vezes vendeu,
   *  o recorde de R$/s, quantos pontos vender agora daria, suas conquistas, as ganhas nesta chamada (a tela avisa) e as
   *  escondidas que alguém do grupo já tem. */
  bonus: { pontos: number; conquistas: number }; vendas: number; recorde: number; pontos_venda: number;
  conquistas: IdleConquista[]; novas: number[]; descobertas: number[];
};
export type IdleConquista = { id: number; em: string };
```

E troque o fim de `IdleBoardRow`, o `LinhaPlacar` e o `linhaPlacar`:

```ts
  avatar: IdleVisual | null; hiredCount: number; byMe: boolean; mostHired: boolean;
};
/** Linha de idle_board como o banco devolve. */
export type LinhaPlacar = {
  user_id: string; valuation: number; rate: number; era: number; strategies: number[];
  avatar: IdleVisual | null; hired_count: number; by_me: boolean; most_hired: boolean;
};
export const linhaPlacar = (r: LinhaPlacar, name: string): IdleBoardRow => ({
  userId: r.user_id, name, valuation: r.valuation, rate: r.rate, era: r.era, strategies: r.strategies,
  avatar: r.avatar, hiredCount: r.hired_count, byMe: r.by_me, mostHired: r.most_hired,
});
```

por:

```ts
  avatar: IdleVisual | null; hiredCount: number; byMe: boolean; mostHired: boolean;
  /** Pontos de prestígio e quantas conquistas (0041). */
  pontos: number; conquistas: number;
};
/** Linha de idle_board como o banco devolve. */
export type LinhaPlacar = {
  user_id: string; valuation: number; rate: number; era: number; strategies: number[];
  avatar: IdleVisual | null; hired_count: number; by_me: boolean; most_hired: boolean; pontos: number; conquistas: number;
};
export const linhaPlacar = (r: LinhaPlacar, name: string): IdleBoardRow => ({
  userId: r.user_id, name, valuation: r.valuation, rate: r.rate, era: r.era, strategies: r.strategies,
  avatar: r.avatar, hiredCount: r.hired_count, byMe: r.by_me, mostHired: r.most_hired, pontos: r.pontos, conquistas: r.conquistas,
});
```

- [ ] **Step 4: `games/shared/api.ts` e `games/shared/errors.ts`**

Em `api.ts`, depois de `export const idleHire = ...`, acrescente:

```ts
export const idlePrestige = () => rpc<IdleState>('idle_prestige');
```

Em `errors.ts`: no tipo `GameErrorCode`, depois da linha `  | 'idle_hire_self' | 'idle_hire_twice' | 'idle_hire_not_open' | 'idle_bad_avatar'`
acrescente `  | 'idle_prestige_low'`; em `ERROR_TEXT`, depois de `idle_bad_avatar: 'Esse visual não existe',` acrescente
`  idle_prestige_low: 'Ainda não compensa vender',`; em `FROM_DB`, depois de
`  'idle_hire_self', 'idle_hire_twice', 'idle_hire_not_open', 'idle_bad_avatar',` acrescente `  'idle_prestige_low',`.

- [ ] **Step 5: `?mock` (`games/dev/mockDb.ts` e `games/dev/mockIdle.ts`)**

Em `mockDb.ts`, logo antes de `export function call<T>(...)` (e do comentário dele), acrescente:

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

```

Em `mockIdle.ts`:

1. As duas primeiras linhas do comentário do topo ficam:

```ts
// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa, têm personagem (dá pra contratar), pontos de prestígio e
// conquistas (uma escondida, pra aba Conquistas mostrar o "???"). Nunca entra no build.
```

2. `import { call, FRIENDS, ME } from './mockDb';` vira `import { call, dono, FRIENDS, ME } from './mockDb';`.
3. O bloco `const bots = ...` vira:

```ts
// pontos de prestígio e conquistas dos bots: Oliveira já vendeu e tem a 6-7 (escondida)
const BONUS: [number, number[]][] = [[12, [1, 31, 39, 47, 51, 101]], [3, [31, 47]], [0, []]];

const bots = (async () => {
  for (const [i, [id]] of FRIENDS.entries()) {
    await call('select public.idle_start() as v', [], id).catch(() => undefined);
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
    const [pontos, conquistas] = BONUS[i % BONUS.length];
    await dono('update public.idle_state set prestige_points = $2, prestige_count = $3 where user_id = $1', [id, pontos, pontos ? 1 : 0]);
    for (const c of conquistas) {
      await dono('insert into public.idle_conquistas (user_id, conquista_id) values ($1, $2) on conflict do nothing', [id, c]);
    }
  }
})();
```

4. Depois de `export const idleSetAvatar = (v: IdleVisual) => avatar(v);` acrescente:

```ts
export const idlePrestige = () => call<IdleState>('select public.idle_prestige() as v');
```

5. O comentário e o tipo do `window` dos atalhos ficam:

```ts
// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar;
// __vendavel() deixa sua empresa valendo uns 7 pontos de prestígio (150 foguetes, estratégias escolhidas)
const w = window as unknown as {
  __rico: (v: number) => Promise<void>; __meContrata: () => Promise<void>; __vendavel: (foguetes?: number) => Promise<void>;
};
```

6. No fim do arquivo, acrescente:

```ts
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
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/shared games/dev games/idle/store.test.ts games/idle/tela.test.ts && git commit -m "Fellas Inc.: formatos, idlePrestige, erro de venda e o ?mock com pontos e conquistas"
```

---

### Task 7: O que a aba Conquistas mostra (`conquistas.ts`) e o ícone em `ativos.ts`

**Files:**
- Create: `games/idle/conquistas.ts`, `games/idle/conquistas.test.ts`
- Modify: `games/idle/ativos.ts`, `games/idle/ativos.test.ts`

**Interfaces:**
- Consome: `IdleState` (Task 6), `catalogo.conquistas`, `Conquista` (Task 1).
- Produz: `Celula = { conquista: Conquista; ganhou: boolean; nome: string; texto: string; em: string | null }`,
  `TOTAL_CONQUISTAS`, `grade(estado): Celula[]`, `ganhouEm(iso): string`, `avisos(ids: number[]): string[]`,
  `pontos(n): string`, `textoVenda(n): string`, `criarFilaAvisos(mostrar: (t: string | null) => void, ms = 3000):
  { adicionar(textos: string[]): void }`; `ativos.conquista(id): string | null`.

- [ ] **Step 1: Testes**

Crie `games/idle/conquistas.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { IdleState } from '../shared/types';
import { catalogo } from './catalogo';
import { avisos, criarFilaAvisos, ganhouEm, grade, pontos, textoVenda, TOTAL_CONQUISTAS } from './conquistas';

const estado = (x: Partial<IdleState> = {}): IdleState => ({
  user_id: 'u', week_start: '2026-10-12', started: true, valuation: 0, rate: 0.5, generators: [1, ...Array(29).fill(0)],
  upgrades: [], strategies: [-1, -1, -1, -1], era: 1, boost_until: null, half_price: false, opp_claimed: [], opp_left: 10,
  server_now: '2026-10-12T12:00:00.000Z',
  avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,
  bonus: { pontos: 0, conquistas: 0 }, vendas: 0, recorde: 0, pontos_venda: 0, conquistas: [], novas: [], descobertas: [],
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
    expect(textoVenda(1)).toBe('Você ganha 1 ponto (+1% pra sempre) e recomeça do zero.');
    expect(textoVenda(12)).toBe('Você ganha 12 pontos (+12% pra sempre) e recomeça do zero.');
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
    fila.adicionar(['Conquista: Olho vivo']);
    vi.advanceTimersByTime(2999);
    expect(vistos).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(vistos.at(-1)).toBe('Conquista: Exit');
    vi.advanceTimersByTime(3000);
    expect(vistos.at(-1)).toBe('Conquista: Olho vivo');
    vi.advanceTimersByTime(3000);
    expect(vistos.at(-1)).toBeNull();
    fila.adicionar([]);
    expect(vistos.at(-1)).toBeNull();
  });
});
```

Em `games/idle/ativos.test.ts`, no `describe('ativos da Fellas Inc.', ...)`, acrescente:

```ts
  it('ícone de conquista que não existe: null (a célula mostra só a moldura)', () => {
    expect(ativos.conquista(999)).toBeNull();
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/conquistas.test.ts idle/ativos.test.ts`
Expected: FAIL (`./conquistas` não existe; `ativos.conquista` não existe).

- [ ] **Step 3: Criar `games/idle/conquistas.ts`**

```ts
// Aba Conquistas e o aviso de conquista da Fellas Inc. (puro: a tela só desenha o que sai daqui). Quem ganhou o quê
// é o banco que decide; aqui só se decide o que cada quadradinho mostra.
import type { IdleState } from '../shared/types';
import { catalogo, type Conquista } from './catalogo';

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
export const textoVenda = (n: number): string => `Você ganha ${pontos(n)} (+${n}% pra sempre) e recomeça do zero.`;

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
```

- [ ] **Step 4: `games/idle/ativos.ts`**

Depois da linha `const gerais = pegar(...)`, acrescente:

```ts
const conquistas = pegar(import.meta.glob('./assets/conquistas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
```

E no objeto `ativos`, depois de `geral: ...`, acrescente:

```ts
  /** Ícone 16x16 da conquista (null = a arte ainda não chegou). */
  conquista: (id: number): string | null => conquistas[`conquista-${String(id).padStart(3, '0')}`] ?? null,
```

- [ ] **Step 5: Rodar e ver passar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run idle/`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/conquistas.ts games/idle/conquistas.test.ts games/idle/ativos.ts games/idle/ativos.test.ts && git commit -m "Fellas Inc.: grade de conquistas, textos da venda e fila de avisos"
```

---

### Task 8: A página: aba Conquistas, vender a startup, aviso na cena e ★ no placar

**REQUIRED:** skill `impeccable` (modo Operate, plataforma adaptive); leia `PRODUCT.md` e `DESIGN.md` antes. O código
abaixo é a base aprovada no plano; ajustes de apresentação que a skill pedir não mudam texto, dado nem comportamento
testado.

**Files:**
- Modify: `games/idle/tela.ts`, `games/idle/idle.css`, `games/idle/main.ts` (edições pontuais: o que já está na `main`
  fica, inclusive Compradas, o placar "+R$ X/s" com "Era N · nome", folhas, `vigiarVersao`, editor e aba Contratar)
- Test: `games/idle/tela.test.ts`

**Interfaces:**
- Consome: `grade`, `ganhouEm`, `pontos`, `textoVenda`, `TOTAL_CONQUISTAS`, `Celula`, `avisos`, `criarFilaAvisos`,
  `ativos.conquista` (Task 7); `idlePrestige`, `IdleState` novo, `IdleBoardRow.pontos` (Task 6).
- Produz: `Aba` + `'conquistas'`; `Modelo.vendaAberta: boolean`, `Modelo.conquistaAviso: string | null`;
  `Acoes.vender(acao: 'abrir' | 'fechar' | 'confirmar')`.

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
`    vender: vi.fn<Acoes['vender']>(),`.

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
describe('conquistas e prestígio', () => {
  const EM = '2026-10-12T15:00:00.000Z';
  it('card: pontos, bônus e recorde; sem ponto a ganhar, o botão fica apagado com "Ainda não compensa"', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'conquistas', estado: estado({ bonus: { pontos: 12, conquistas: 3 }, vendas: 2, recorde: 1234.5 }) }));
    const card = root.querySelector('.prestigio')!;
    expect(card.textContent).toContain('★ 12 pontos · +12% de produção');
    expect(card.textContent).toContain('Recorde: +R$ 1,23 mil/s · vendeu 2 vezes');
    const b = card.querySelector('button')!;
    expect(b.textContent).toBe('Ainda não compensa');
    expect(b.disabled).toBe(true);
  });
  it('vender: o botão diz quantos pontos e abre a folha; a folha confirma ou fecha', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'conquistas', estado: estado({ pontos_venda: 5 }) }));
    const b = root.querySelector<HTMLButtonElement>('.prestigio button')!;
    expect(b.textContent).toBe('Vender a startup · +5 pontos');
    b.click();
    expect(acoes.vender).toHaveBeenCalledWith('abrir');
    expect(root.querySelector('.modal-venda')!.hasAttribute('hidden')).toBe(true);
    tela.renderizar(modelo({ aba: 'conquistas', estado: estado({ pontos_venda: 5 }), vendaAberta: true }));
    const folha = root.querySelector('.modal-venda')!;
    expect(folha.hasAttribute('hidden')).toBe(false);
    expect(folha.textContent).toContain('Vender a startup?');
    expect(folha.textContent).toContain('Você ganha 5 pontos (+5% pra sempre) e recomeça do zero.');
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Vender')!.click();
    [...folha.querySelectorAll('button')].find((x) => x.textContent === 'Deixa quieto')!.click();
    expect(acoes.vender.mock.calls.map((c) => c[0])).toEqual(['abrir', 'confirmar', 'fechar']);
    tela.renderizar(modelo({ aba: 'conquistas', estado: estado({ pontos_venda: 5 }), vendaAberta: true, ocupado: true }));
    expect([...root.querySelectorAll<HTMLButtonElement>('.modal-venda button')].find((x) => x.textContent === 'Vender')!.disabled).toBe(true);
    // não compensa mais (o banco recusou e a tela recarregou): a folha some
    tela.renderizar(modelo({ aba: 'conquistas', estado: estado({ pontos_venda: 0 }), vendaAberta: true }));
    expect(root.querySelector('.modal-venda')!.hasAttribute('hidden')).toBe(true);
  });
  it('grade: N/total; tocar mostra a condição (bloqueada) ou a frase e a data (ganha); escondida só quando alguém conseguiu', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      aba: 'conquistas',
      estado: estado({ conquistas: [{ id: 7, em: EM }], descobertas: [102], bonus: { pontos: 0, conquistas: 1 } }),
    }));
    const lista = root.querySelector('.lista-conquistas')!;
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
  it('sem a arte do ícone, a célula mostra só a moldura', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'conquistas' }));
    const icone = root.querySelector<HTMLElement>('.conquista .icone-conquista')!;
    expect(icone.classList.contains('sem-arte') || icone.style.backgroundImage.includes('url(')).toBe(true);
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
  it('placar: ★ N ao lado do R$/s de quem tem pontos', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [linha({ pontos: 12 }), linha({ userId: 'c', name: 'Teteu' })] }));
    const itens = root.querySelectorAll('.lista-placar li');
    expect(itens[0].querySelector('.pontos')!.textContent).toBe('★ 12');
    expect(itens[1].querySelector('.pontos')).toBeNull();
    expect(itens[0].querySelector('.v')!.textContent).toContain('/s');
  });
  it('cinco abas, Conquistas por último', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo());
    expect([...root.querySelectorAll('.abas .aba')].map((b) => b.textContent)).toEqual(['Geradores', 'Melhorias', 'Contratar', 'Placar', 'Conquistas']);
    porTexto('Conquistas').click();
    expect(acoes.trocarAba).toHaveBeenCalledWith('conquistas');
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/tela.test.ts`
Expected: FAIL (sem aba Conquistas, sem `.modal-venda`, sem aviso, sem `★`).

- [ ] **Step 3: `games/idle/tela.ts` (troque cada trecho, na ordem)**

1. Trecho:

```ts
import { catalogo, type Melhoria } from './catalogo';
```

   vira:

```ts
import { catalogo, type Melhoria } from './catalogo';
import { ganhouEm, grade, pontos, textoVenda, TOTAL_CONQUISTAS, type Celula } from './conquistas';
```

2. Trecho:

```ts
export type Aba = 'geradores' | 'melhorias' | 'contratar' | 'placar';
```

   vira:

```ts
export type Aba = 'geradores' | 'melhorias' | 'contratar' | 'placar' | 'conquistas';
```

3. Trecho:

```ts
  /** Rascunho do editor de personagem (null = fechado). */
  editor: IdleVisual | null;
};
```

   vira:

```ts
  /** Rascunho do editor de personagem (null = fechado). */
  editor: IdleVisual | null;
  /** Folha "Vender a startup?" aberta. */
  vendaAberta: boolean;
  /** O aviso de conquista na cena agora ("Conquista: 6-7"); null = nenhum. */
  conquistaAviso: string | null;
};
```

4. Trecho:

```ts
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
};
```

   vira:

```ts
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
  vender(acao: 'abrir' | 'fechar' | 'confirmar'): void;
};
```

5. Trecho:

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

6. Trecho:

```ts
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.contratar, botoesAba.placar);
```

   vira:

```ts
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
    conquistas: button('Conquistas', 'aba', () => a.trocarAba('conquistas')),
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.contratar, botoesAba.placar, botoesAba.conquistas);
```

7. Trecho:

```ts
  const listaP = el('ol', 'lista lista-placar');
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaC, listaP);
```

   vira:

```ts
  const listaP = el('ol', 'lista lista-placar');
  const listaQ = el('div', 'lista lista-conquistas');
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaC, listaP, listaQ);
```

8. Trecho:

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

9. Trecho:

```ts
  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC, modalV);
```

   vira:

```ts
  app.append(topo, palco, placa, painel, notice, overlay, modalE, modalC, modalV, modalP);
```

10. Trecho:

```ts
  let verCompradas = false;
  let ultimo: Modelo | null = null;
```

   vira:

```ts
  let verCompradas = false;
  // aba Conquistas: o quadradinho tocado (mostra a frase e a data); só apresentação
  let conquistaAberta: number | null = null;
  let ultimo: Modelo | null = null;
```

11. Trecho:

```ts
  function renderizar(m: Modelo) {
```

   vira:

```ts
  function iconeConquista(c: Celula) {
    const box = el('div', 'icone-conquista');
    const url = ativos.conquista(c.conquista.id);
    if (url) box.style.backgroundImage = `url(${url})`;
    else box.classList.add('sem-arte'); // a arte ainda não chegou: só a moldura
    return box;
  }

  /** Aba Conquistas: o card de prestígio e a grade (tocar mostra a frase e a data). */
  function conquistas(s: IdleState, ocupado: boolean) {
    const card = el('div', 'prestigio');
    const meio = el('div', 'meio');
    const vezes = s.vendas === 1 ? 'vendeu 1 vez' : `vendeu ${s.vendas} vezes`;
    meio.append(
      el('strong', undefined, `★ ${pontos(s.bonus.pontos)} · +${s.bonus.pontos}% de produção`),
      el('span', 'sub', s.vendas ? `Recorde: ${formatarTaxa(s.recorde)} · ${vezes}` : `Recorde: ${formatarTaxa(s.recorde)}`),
    );
    const vender = button(
      s.pontos_venda >= 1 ? `Vender a startup · +${pontos(s.pontos_venda)}` : 'Ainda não compensa',
      'btn main', () => a.vender('abrir'),
    );
    vender.disabled = s.pontos_venda < 1 || ocupado;
    card.append(meio, vender);
    const celulas = grade(s);
    const topoQ = el('p', 'conquistas-topo', `Conquistas ${s.conquistas.length}/${TOTAL_CONQUISTAS} · +${s.bonus.conquistas}% de produção`);
    const grid = el('div', 'grade-conquistas');
    for (const c of celulas) {
      const b = button('', c.ganhou ? 'conquista ganha' : 'conquista', () => {
        conquistaAberta = conquistaAberta === c.conquista.id ? null : c.conquista.id;
        if (ultimo) renderizar(ultimo);
      });
      b.setAttribute('aria-pressed', String(conquistaAberta === c.conquista.id));
      b.append(iconeConquista(c), el('span', 'conquista-nome', c.nome));
      grid.append(b);
    }
    listaQ.append(card, topoQ);
    const aberta = celulas.find((c) => c.conquista.id === conquistaAberta);
    if (aberta) {
      const det = el('div', 'conquista-detalhe');
      det.append(el('strong', undefined, aberta.nome), el('span', 'sub', aberta.texto));
      if (aberta.em) det.append(el('span', 'sub', ganhouEm(aberta.em)));
      listaQ.append(det);
    }
    listaQ.append(grid);
  }

  function renderizar(m: Modelo) {
```

12. Trecho:

```ts
    mostrar(listaP, jogando && m.aba === 'placar');
```

   vira:

```ts
    mostrar(listaP, jogando && m.aba === 'placar');
    mostrar(listaQ, jogando && m.aba === 'conquistas');
```

13. Trecho:

```ts
    listaP.replaceChildren();
    if (!m.placar)
```

   vira:

```ts
    listaQ.replaceChildren();
    if (s && jogando && m.aba === 'conquistas') conquistas(s, m.ocupado);

    listaP.replaceChildren();
    if (!m.placar)
```

14. Trecho:

```ts
        if (r.mostHired) li.append(el('span', 'disputado', 'Mais disputado da semana'));
```

   vira:

```ts
        if (r.pontos > 0) li.append(el('span', 'pontos', `★ ${r.pontos}`));
        if (r.mostHired) li.append(el('span', 'disputado', 'Mais disputado da semana'));
```

15. Trecho:

```ts
    noticeTxt.textContent = m.aviso ?? '';
```

   vira:

```ts
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

    noticeTxt.textContent = m.aviso ?? '';
```

- [ ] **Step 4: `games/idle/idle.css`** — acrescente no fim:

```css
/* entrega 3: no celular as 5 abas rolam de lado (cada uma do tamanho do texto) */
@media (max-width: 599px) {
  .idle .abas { overflow-x: auto; scrollbar-width: none; overscroll-behavior-x: contain; }
  .idle .abas::-webkit-scrollbar { display: none; }
  .idle .aba { flex: 1 0 auto; padding: 0 14px; }
}
/* aba Conquistas: card de prestígio, grade e o detalhe do quadradinho tocado */
.idle .prestigio { display: flex; flex-wrap: wrap; align-items: center; gap: 12px; padding: 12px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: var(--paper); }
.idle .prestigio .btn { flex: 1 1 100%; min-height: 44px; height: auto; white-space: nowrap; }
@media (min-width: 600px) { .idle .prestigio .btn { flex: none; padding: 0 16px; } }
.idle .conquistas-topo { margin: 8px 0 0; font-weight: 700; color: var(--paper); }
.idle .grade-conquistas { display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 8px; }
.idle .conquista { display: grid; justify-items: center; align-content: start; gap: 6px; min-height: 44px; padding: 8px 4px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: #A8A398; font: 600 12px/1.25 var(--font); text-align: center; cursor: pointer; }
.idle .conquista.ganha { color: var(--paper); border-color: #5B3FD9; }
.idle .conquista:not(.ganha) .icone-conquista { opacity: 0.35; filter: grayscale(1); }
.idle .conquista[aria-pressed='true'], .idle .conquista:focus-visible { outline: 2px solid #B8A2FF; outline-offset: 2px; }
.idle .icone-conquista { width: 48px; height: 48px; background: no-repeat 0 0 / 48px 48px; image-rendering: pixelated; }
.idle .icone-conquista.sem-arte { border-radius: 6px; border: 3px solid #6B6874; }
.idle .conquista-detalhe { display: grid; gap: 2px; padding: 10px 12px; border-radius: 8px; background: #262431; color: var(--paper); }
/* aviso de conquista: pílula por cima da cena, 3 s (main.ts) */
.idle .conquista-aviso { position: absolute; top: 16px; left: 50%; transform: translateX(-50%); z-index: 2; max-width: calc(100% - 32px); padding: 8px 14px; border-radius: 999px; border: 1px solid #B8A2FF; background: #3A2A66; color: #DDD2FF; font-size: 14px; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; pointer-events: none; animation: conquista-entra 0.25s ease-out; }
@keyframes conquista-entra { from { opacity: 0; transform: translate(-50%, -8px); } to { opacity: 1; transform: translate(-50%, 0); } }
@media (prefers-reduced-motion: reduce) { .idle .conquista-aviso { animation: none; } }
.idle .lista-placar .pontos { grid-row: 2; grid-column: 4; justify-self: end; color: var(--gold); font-size: 13px; font-weight: 700; }
```

- [ ] **Step 5: `games/idle/main.ts` (edições pontuais)**

1. Depois de `import { ativos } from './ativos';` acrescente `import { avisos, criarFilaAvisos } from './conquistas';`.
2. No tipo `Api`, acrescente `'idlePrestige'` (fica
   `type Api = Pick<typeof realApi, 'idleOpen' | 'idleStart' | 'idleBuy' | 'idlePickStrategy' | 'idleClaim' | 'idleBoard' | 'idleHire' | 'idleSetAvatar' | 'idlePrestige' | 'hasSession'>;`).
3. Em `RECARREGA`, a segunda linha fica `  'idle_not_started', 'idle_started', 'idle_hire_twice', 'idle_hire_not_open', 'idle_prestige_low',`.
4. Depois de `let vencimentoPedido: string | null = null;` acrescente:

```ts
// folha "Vender a startup?" aberta; aviso de conquista na cena (um de cada vez, 3 s cada)
let vendaAberta = false;
let conquistaAviso: string | null = null;
const filaAvisos = criarFilaAvisos((texto) => {
  conquistaAviso = texto;
  render();
});
```

5. Nas ações passadas a `criarTela`, depois de `mudarVisual: (campo, valor) => { ... },` acrescente:

```ts
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
```

6. Em `render()`, troque a chamada `tela.renderizar({ fase, estado: s, aba, ... aoVivo: vivoAtual });` por:

```ts
  tela.renderizar({
    fase, estado: s, aba, placar, aviso, ocupado, caixaAberta, editor: rascunho, placarFalhou,
    pendentes: s ? lista.slice(0, Math.max(0, s.opp_left)) : [], aoVivo: vivoAtual, vendaAberta, conquistaAviso,
  });
```

7. No fim de `aplicar(estado)`, depois do `render();`, acrescente `  filaAvisos.adicionar(avisos(estado.novas));`.

- [ ] **Step 6: Rodar e ver passar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx tsc --noEmit && npx vitest run && npm run build`
Expected: PASS e build sem erro.

- [ ] **Step 7: Conferência no `?mock`** (`cd games && npm run dev`, abrir `/games/idle/?mock` no endereço que o Vite mostrar; no DevTools,
  celular de 360 px e depois PC):
  - as 5 abas cabem rolando de lado no celular; no PC, lado a lado; a aba ativa fica marcada;
  - aba Conquistas: card "★ 0 pontos · +0% de produção", "Recorde: …", botão apagado "Ainda não compensa"; grade com
    "N/73"; o "???" da 6-7 (o bot Oliveira tem); tocar numa ganha mostra frase e data, numa bloqueada a condição;
  - abrir o jogo já dá conquistas (ex.: "Conquista: Primeiro real" aparece por 3 s em cima da cena, um aviso de cada
    vez, sem tapar a oportunidade que passa);
  - placar: "★ 12" ao lado do R$/s do Oliveira, "★ 3" da Bia, nada no Teteu;
  - console: `__vendavel()`; a página bate o ponto e o botão vira "Vender a startup · +7 pontos" (o número exato
    depende das conquistas); tocar abre a folha "Vender a startup?" com "Você ganha N pontos (+N% pra sempre) e
    recomeça do zero."; "Deixa quieto" fecha; "Vender" volta pra cena "antes" com "Abrir CNPJ"; reabrir mostra a produção
    com o bônus e o card com os pontos; o placar some com você até reabrir.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/tela.ts games/idle/tela.test.ts games/idle/idle.css games/idle/main.ts && git commit -m "Fellas Inc.: aba Conquistas, vender a startup, aviso de conquista e pontos no placar"
```

---

### Task 9: Arte: os 73 ícones das conquistas (fora do repositório)

**Files (em `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`; sem commit):**
- Create: `BRIEF-CONQUISTAS.md`, `conquistas.js`
- Produz: `png/conquista-NNN.png` (73 arquivos), `sprites/conquista-NNN-8x.png`, `conferencia/conquista-NNN-quadros.png`
  (o que `salvarSprite` gera) e `conferencia/conquistas-folha.png`

**Interfaces:**
- Produz: os arquivos do "Contrato de formato da arte". A Task 10 copia e trava o formato.

- [ ] **Step 1: Salvar o brief** como `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/BRIEF-CONQUISTAS.md`:

```markdown
# Brief: ícones das conquistas da Fellas Inc. (entrega 3)

Leia antes `BRIEF-SPRITES.md` (estilo, contorno, paleta, processo) e veja com Read `conferencia/gerais-folha.png` (os
20 ícones das melhorias gerais): estes são da mesma família. Copie de `gerais.js` a função `mapa` (mapa de texto 16x16,
cada letra = cor e objeto) e o fim do arquivo (desenha, salva e monta a folha). Não edite nenhum arquivo existente:
crie só `conquistas.js` e o que ele gera. Pasta: `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`.

## Formato (o jogo depende disto exatamente)
- Um ícone por conquista, nome `conquista-NNN` (NNN = id com 3 dígitos), salvo com `salvarSprite(nome, [cv], 15, 8)`:
  `png/conquista-NNN.png` 16x16, transparente, 1 quadro, pixel duro, 1px de margem (o contorno de `cv.contornar()`).
- 2 a 4 cores mais o contorno. No jogo aparece a 48x48 (3x) num quadradinho escuro; bloqueada, o jogo pinta de cinza
  e apaga (35%): a silhueta tem que ler sem cor. Nada de texto além de números grandes (só onde dito).
- Grupos com marca comum: os 30 de gerador levam uma estrela dourada 4x4 no canto de cima à direita; os de R$/s sobem
  em "riqueza" do 31 ao 38; os de melhorias, gente e vendas vão de bronze (1º) a prata (2º) e ouro (3º e 4º).

## Os ícones
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
R$/s: 031 uma moeda · 032 três moedas · 033 pilha de moedas · 034 saco de dinheiro · 035 cofre · 036 barras de ouro ·
037 diamante · 038 planeta dourado.
Eras: 039 porta de garagem · 040 catraca com crachá · 041 elevador com seta pra cima · 042 torre com a coroa roxa (a
sede) · 043 Marte com bandeirinha.
Melhorias (10, 50, 150): 044 chave inglesa bronze · 045 prata · 046 ouro.
Oportunidades (1, 25, 100, 500): 047 olho · 048 binóculo · 049 lupa com cifrão · 050 radar.
Vendas (1, 5, 10, 25): 051 etiqueta de "vendido" · 052 etiqueta com seta circular · 053 fábrica com etiqueta ·
054 troféu dourado.
Gente: 055–057 crachá roxo de contratado com 1, 2 e 3 estrelas (bronze, prata, ouro) · 058–060 carteira de trabalho
azul com 1, 2 e 3 estrelas.
Estratégias: 061 três setas saindo do mesmo ponto · 062 bússola.
Escondidas (zoeira do grupo; podem ser mais caprichadas):
101 "67" em números grandes dourados (pode usar a área toda) · 102 boneco (silhueta) com brilho roxo em volta (aura) ·
103 nuvem cinza com chuva · 104 um limão ao lado de um documento · 105 jaula aberta com um braço musculoso saindo ·
106 caravela com vela verde e amarela · 107 mão fazendo "L" com o boné vermelho do estagiário · 108 relógio marcando
3h06 com uma lua · 109 lobo uivando · 110 unicórnio (cabeça, chifre dourado, crina roxa; como o `selo-unicornio`) ·
111 tambor de madeira com duas baquetas (o "tung tung").

## Processo
`node conquistas.js`; veja `conferencia/conquistas-folha.png` (todos em 1x, 2x e 6x, nos temas escuro `#121212` e claro
`#F4F1EA`) e `sprites/conquista-NNN-8x.png` com Read. Pelo menos 2 rodadas de revisão por ícone; confira cada um
também em cinza (bloqueado). No fim, um relatório curto: o que tem em cada grupo e o que ficou fraco.
```

- [ ] **Step 2: Fazer a arte** — despachar um agente de arte com o brief (ou seguir o brief à mão). O script
  `conquistas.js` segue o `gerais.js`: `const ICONES = {}`, um `ICONES['conquista-001'] = (cv) => mapa(cv, [...16
  linhas...], {legenda}, '001')` por ícone, e no fim o mesmo laço `telaComObjetos(16, 16)` → `desenha(cv)` →
  `cv.contornar()` → `salvarSprite(nome, [cv], 15, 8)` e a folha `conferencia/conquistas-folha.png` (fileiras de 10).

- [ ] **Step 3: Conferir o formato antes de passar para a Task 10**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos && node -e "const fs=require('fs');const ids=[...Array(62)].map((_,i)=>i+1).concat([...Array(11)].map((_,i)=>101+i));let ok=0;for(const id of ids){const f='png/conquista-'+String(id).padStart(3,'0')+'.png';const b=fs.readFileSync(f);if(b.readUInt32BE(16)!==16||b.readUInt32BE(20)!==16)throw new Error(f);ok++}console.log('ok',ok)"`
Expected: `ok 73`.

- [ ] **Step 4: Mostrar a folha ao Juan** (`conferencia/conquistas-folha.png`) e ajustar o que ele pedir antes da Task 10.

---

### Task 10: Copiar os ícones para `games/idle/assets/conquistas/` e travar o formato

**Files:**
- Create: `games/idle/assets/conquistas/conquista-NNN.png` (73)
- Modify: `games/idle/ativos.test.ts`

**Interfaces:**
- Consome: a arte da Task 9; `catalogo.conquistas` (Task 1); `ativos.conquista` (Task 7).

- [ ] **Step 1: Teste do formato (acrescentar no fim de `games/idle/ativos.test.ts`)**

No topo, acrescente o import `import { catalogo } from './catalogo';` (os de `node:fs` e `node:path` já existem). No fim:

```ts

describe('arte da entrega 3 (ícones das conquistas)', () => {
  const arquivo = (id: number) => `conquista-${String(id).padStart(3, '0')}.png`;
  it('toda conquista do catálogo tem ícone 16x16', () => {
    for (const c of catalogo.conquistas) {
      expect(dim(`conquistas/${arquivo(c.id)}`), arquivo(c.id)).toEqual([16, 16]);
      expect(ativos.conquista(c.id), arquivo(c.id)).not.toBeNull();
    }
  });
  it('nenhum ícone sobrando (de id que não existe no catálogo)', () => {
    const nomes = new Set(catalogo.conquistas.map((c) => arquivo(c.id)));
    expect(readdirSync(resolve(pasta, 'conquistas')).filter((f) => !nomes.has(f))).toEqual([]);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/ativos.test.ts`
Expected: FAIL (a pasta `assets/conquistas` não existe).

- [ ] **Step 3: Copiar**

```bash
mkdir -p C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games/idle/assets/conquistas && cp C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/png/conquista-*.png C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games/idle/assets/conquistas/
```

- [ ] **Step 4: Rodar e ver passar; conferir no `?mock`** que a grade mostra os ícones (ganhos coloridos, bloqueados em
  cinza) a 48 px sem borrar.

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio/games && npx vitest run idle/ && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && git add games/idle/assets/conquistas games/idle/ativos.test.ts && git commit -m "Fellas Inc.: ícones das conquistas"
```

---

### Task 11: Conferência final, banco e publicação

- [ ] **Step 1: Tudo verde no branch**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp-prestigio && npx tsc --noEmit && npm test && cd games && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: tudo passa.

- [ ] **Step 2: Merge local na `main` (ainda sem push)** — o repositório principal é o que tem o projeto do Supabase
  ligado (`supabase/.temp`); o worktree não tem.

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git checkout main && git pull --ff-only && git merge --no-ff fellas-inc-prestigio -m "Merge da entrega 3 da Fellas Inc. (prestígio e conquistas)" && npx tsc --noEmit && npm test && npm test --prefix games
```

- [ ] **Step 3: Banco de produção (o Juan roda)** — pedir ao Juan, no terminal dele, em
  `C:/Users/juan/Documents/PROJETOSLLM/fellasapp`: `! npx supabase migration list` (pendentes só 0040 e 0041; se
  aparecer outra, parar e conversar) e depois `! npx supabase db push`.

- [ ] **Step 4: Conferir pela REST que entrou e só então publicar** (o deploy roda os testes e builda `dist/games/idle/`):

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && set -a && . ./.env && set +a && for q in "idle_state?select=prestige_points,prestige_count,best_rate,upg_total,opp_total,hire_total,hired_total,est_usadas,opp_recent" "idle_conquistas?select=ganhou_em" "idle_cat_conquista?select=escondida" "idle_cat_upg?select=nome&id=eq.283"; do curl -s -o /dev/null -w "$q %{http_code}
" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/$q&limit=1" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"; done
```

Expected: 200 ou 401 (existe; anônimo não tem permissão) em todos; 400 ("column ... does not exist") ou 404 = a
migração não entrou: NÃO dar push; parar e avisar o Juan (o merge local pode ser desfeito com
`git reset --hard ORIG_HEAD`, que só mexe na `main` local). Tudo certo:

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git push origin main
```

- [ ] **Step 5: Conferência real (com o Juan e mais um fella)** — `https://fellasapp.pages.dev/games` no celular:
  abrir a Fellas Inc. (aparece "Conquista: …" por 3 s para as que a pessoa já cumpria; o R$/s sobe 1% por conquista);
  aba Conquistas com o card, a grade "N/73" e as escondidas que alguém do grupo já tem como "???"; placar com "★ N" de
  quem tem pontos; quem tiver R$/s ≥ 1 mi vê "Vender a startup · +N pontos": vender (folha, "Vender"), ver a cena voltar
  para o "Abrir CNPJ", reabrir e conferir a produção com o bônus; quem tinha contratado alguém: o contratado continua com
  o que já rendeu e perde o bônus dali pra frente; quem te contratou continua; com o jogo aberto em dois aparelhos,
  vender num e tocar em comprar no outro: recarrega e mostra o "Abrir CNPJ". Na segunda seguinte, conferir que o
  unicórnio ganhou o "Pai tá on" e que nada sumiu.

---

## Autorrevisão

- **Cobertura da spec (entrega 3):** 1.1 pontos (`floor(cbrt(r/K))`, diferença, "não compensa") → Tasks 2, 3, 5, 8;
  1.2 venda (zera, volta pro Abrir CNPJ com R$ 10, contratos feitos vencem com a conta dos contratados fechada antes,
  quem te contratou continua, ficam pontos/vendas/conquistas/personagem/cota do dia/recorde, confirmação) → Tasks 5, 8;
  1.3 efeito e paridade → Tasks 2, 3; 1.4 ritmo → Task 2 (alvo 1 com K = 1e6; alvo 2 pendente do Juan, ver o topo);
  2 bônus juntos (a foto usa a taxa da meia-noite) → Task 3 (`idle_rate_at`); 3.1 regras (catálogo com id, nome, frase,
  ícone, condição, escondida; banco confere em toda ação e ao abrir; ganhou não perde; +1%) → Tasks 1, 4, 5, 9, 10;
  3.2 lista visível (30 geradores, 8 R$/s, 5 eras, 3 melhorias, 4 oportunidades, 4 vendas, 6 gente, 2 estratégias = 62)
  → Task 1; 3.3 escondidas (11, sem a do Vitor; limaumdoc pelo `username`; Guiana = comprar a 283 renomeada) → Tasks 1,
  4, 5; 4 telas (aba Conquistas, card, grade com "???", contagem, abas roláveis, aviso de 3 s, "★ N" no placar) → Tasks
  7, 8; 5 dados (colunas, `idle_cat_conquista` gerado em migração nova, `idle_conquistas` com PK dupla e RLS,
  `idle_prestige`, `idle_check_conquistas`, `idle_json`/`idle_board`, contadores em colunas, nada apaga) → Tasks 1, 3–5;
  6 testes (pontos, recorde, não compensa, o que zera e o que fica, contratos sem retroativo, cada tipo de conquista,
  horário, nome de usuário, conquista não some, ninguém escreve nos dos outros, paridade, simulação, tela) → Tasks 2–8.
- **Nomes conferidos entre tasks:** `TipoConquista`, `Conquista`, `catalogo.conquistas`, `CONQUISTAS_GERADOR`,
  `CONQUISTAS`; `Bonus`, `SEM_BONUS`, `POR_PONTO`, `POR_CONQUISTA`, `K_PRESTIGIO`, `multBonus`, `pontosTotais`;
  `Amostra`, `Marcos.amostras`, `primeiraVenda`, `volta`; `idle_est_codigos`, `idle_bonus_mult`, `idle_rate_at`,
  `idle_prestige_total`, `idle_ganhar`, `idle_madrugada`, `idle_check_conquistas`, `idle_save`, `idle_json`,
  `idle_prestige`, `idle_board`, `idle_weekly_reset`; colunas `prestige_points`, `prestige_count`, `best_rate`,
  `upg_total`, `opp_total`, `hire_total`, `hired_total`, `est_usadas`, `opp_recent`; campos `bonus`, `vendas`, `recorde`,
  `pontos_venda`, `conquistas`, `novas`, `descobertas`, placar `pontos`/`conquistas`; `IdleConquista`, `idlePrestige`,
  `idle_prestige_low`, `dono`, `__vendavel`; `Celula`, `grade`, `ganhouEm`, `avisos`, `pontos`, `textoVenda`,
  `TOTAL_CONQUISTAS`, `criarFilaAvisos`, `ativos.conquista`; `Aba 'conquistas'`, `Modelo.vendaAberta`,
  `Modelo.conquistaAviso`, `Acoes.vender`.
- **Conferido ao escrever o plano (10/10), num worktree descartado:** com as migrações reais 0027–0038 + a 0040 gerada
  + a 0041 deste plano no PGlite, passaram os testes de banco das Tasks 3–5 (inclusive a 0041 rodando duas vezes), a
  paridade (bônus, vencimento no meio e teto de 8h, pontos em cima dos cubos), todos os testes de antes (`idle`/`idleGente`
  com `conquistas: false`), a simulação com K = 1e6, os testes da tela e de `conquistas.ts`, `tsc` e `build` em `games/`
  e, na raiz, `tsc` e `npm test` (com as travas novas e a do safeupdate). Os estados intermediários da 0041 (só a parte 1;
  partes 1+2) também foram rodados: só falham os testes das tasks seguintes.
- **Foco da revisão:** itens 1 a 3 têm teste no banco (Tasks 4 e 5); o 4 tem teste da tela para a folha e conferência
  real com dois aparelhos (Task 11); o 5 tem o teste das 5 abas e conferência no `?mock` a 360 px (Task 8).
