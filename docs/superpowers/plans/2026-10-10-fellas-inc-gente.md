# Fellas Inc., entrega 2 (gente): plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans para executar este plano tarefa por tarefa. Os passos usam checkbox (`- [ ]`).

> **Revisão de 10/10 (Fellas Inc. sem reset):** a empresa nunca zera sozinha. A segunda 00:00 só tira a foto da semana
> (placa + selo), contratos duram 7 dias e nada apaga contratos. Migrações renumeradas: 0036 é a sem-reset (fora deste
> plano), 0037 o catálogo (Task 1, já feita), **0038 a lógica** e **0039 a notificação**.

**Objetivo:** pôr gente na Fellas Inc.: contratar amigos por 7 dias (preço em tempo de produção, bônus para os dois
lados, piso de freela, cargo de piada, "mais disputado do mercado"), editor de personagem, cenas montadas com você,
seus contratados e freelas nas vagas (o estagiário oficial incluso), as estratégias Networking e Cultura de startup
ligadas, e a notificação "Fulano te contratou como [cargo]" no app.

**Arquitetura:** o banco continua a autoridade. A 0038 cria `idle_avatar` e `idle_contracts` e troca, com `create or
replace`, as funções que mudam (taxa, fechar a conta, estado devolvido, escolha de estratégia, placar, foto de segunda),
sempre partindo da versão mais recente delas (0034, 0035 ou 0036). A conta dos contratos existe igual em `economia.ts`
(teste de paridade, inclusive o fechamento de conta que atravessa um vencimento). A 0037 é o catálogo gerado de novo
(cargos + estratégias ligadas). A página monta cada cena em memória (fundo → pessoas → frente) a partir de um kit de
peças com tons-marcador trocados pelas cores do visual, uma vez por (cena, gente). A arte é feita por código fora do
repositório seguindo o "Contrato de formato" abaixo; até ela chegar, o palco toca as tiras antigas e o resto funciona.

**Tecnologias:** Postgres/Supabase (plpgsql, RLS), Vite + TypeScript + Vitest + PGlite (`games/`), Expo/React Native +
Jest (app), Node (scripts de arte em `../fellas-inc-esbocos`).

**Spec:** `docs/superpowers/specs/2026-10-10-fellas-inc-design.md` (seções 5, 7, 8, 9, 10, 11 e 12, entrega 2), com as
decisões do Juan de 10/10 (sem reset, contratos de 7 dias). Plano anterior: `docs/superpowers/plans/2026-10-10-fellas-inc-nucleo.md`.

**Ajustes de implementação em relação à spec** (decisões tomadas; o comportamento pedido não muda):
- Migrações: `0037_fellas_inc_catalogo_gente.sql` (catálogo GERADO, Task 1), `0038_fellas_inc_gente.sql` (lógica) e
  `0039_notificacao_contrato.sql` (a função de notificações do app; fica fora do PGlite dos jogos porque cita as tabelas
  de posts e stories). Pré-requisitos já na `main`: 0035 (placar por R$/s) e **0036 (sem reset)**.
- **Contrato dura 7 dias** (`ends_at = created_at + 7 dias`). "Ativo em t" = `created_at <= t < ends_at`. Só contratos
  ativos contam no bônus, no preço e no "não pode contratar de novo"; depois de vencer, dá para contratar a mesma pessoa
  outra vez. Par ordenado: A→B ativo impede outro A→B, não impede B→A. Nada apaga contratos (a notificação fica).
- **Vencimento sem retroativo:** a taxa de alguém só muda sem ação dele em três casos: ser contratado (`idle_hire` fecha
  a conta do contratado antes), o chefe escolher Cultura de startup (`idle_pick_strategy` fecha a conta dos contratados
  antes) e um contrato vencer. Para o terceiro, `idle_settle` divide o intervalo `[settled_at, min(agora, settled_at +
  8h)]` nos vencimentos dos contratos da pessoa (dos dois lados) e cada trecho usa a taxa com os contratos ativos no
  começo dele (`idle_rate_at(s, t)`). Nada de cron. O mesmo fechamento existe em `economia.ts` (`acumularTrechos`) com
  teste de paridade na borda do vencimento. A tela recebe `muda_em` (o próximo vencimento que mexe na sua taxa) e bate
  o ponto de novo quando o relógio do servidor passa dele.
- Piso de freela = +2% (o bônus de quem é contratado por 1 empresa). Conta dos contratos ativos:
  `1 + efeito × (porContratado × contratei + Σ 2% × mult de cada empresa que te contratou)`; sem emprego, o Σ vale 2%.
  `efeito` = ×2 com Networking (vale para tudo, inclusive o piso); `porContratado` = 10% (15% com Cultura de startup);
  `mult` = 3 se aquela empresa escolheu Cultura de startup.
- Preço do contrato = taxa atual × 1800 s × 1,5^(contratos ATIVOS que você fez) × 2 com Abrir capital
  (`sociais.contratoCustoMult`). Não usa o +25% de Queimar caixa nem a "próxima compra pela metade" (confirmado pelo
  Juan). Exige a estratégia da era escolhida, como comprar. Pode ser contratado quem já abriu a empresa.
- "Mais disputado": quem recebeu mais contratos **criados** na semana (de segunda 00:00 de Brasília); empate = quem
  chegou primeiro ao número. No placar ao vivo, a semana corrente; na placa de segunda (`idle_weeks.most_hired_id`), a
  semana que acabou, como foto.
- Kit: pose 6 (deitado) tem 16x10; toda folha tem 4 colunas de quadros (pose de 2 quadros repete 0,1,0,1).
- `idle_json` vira `plpgsql` (mesma saída + campos novos), para a ordem das funções dentro da 0038 não importar.
- Notificação: "Ana te contratou como CEO de nada na Fellas Inc." (texto confirmado); tocar abre o jogo.
- Fica para a entrega 3 (prestígio e conquistas): **no prestígio, os contratos que a pessoa FEZ acabam** (os que ela
  recebeu seguem até vencer). Nada disso entra aqui.

## Restrições globais

- Fellas Inc. **não toca nos créditos do cassino**: nada de `game_wallets`, `game_ledger`, `games_move`, Blackjack, Poker,
  fiado ou `weekly_champion` no código novo.
- **Sem reset:** nenhuma função nova apaga estado, contrato ou personagem (`delete from public.idle_state` e
  `delete from public.idle_contracts` não aparecem na 0038), e nada filtra o jogo por `week_start = games_week_start()`.
  A semana só existe na foto de segunda (placa, selo, "mais disputado") e no limite diário de oportunidades.
- Toda tabela com RLS; leitura para membros (`public.is_member()`); escrita só por funções `security definer
  set search_path = public`; funções internas com `revoke all ... from public, anon, authenticated`; RPCs do jogo com
  `revoke all ... from public, anon` + `grant execute ... to authenticated`.
- Erros de usuário: `raise exception '<codigo>' using errcode = 'P0001'`; não membro: `raise exception 'not_member'
  using errcode = '42501'`. Códigos novos: `idle_hire_self`, `idle_hire_twice`, `idle_hire_not_open`, `idle_bad_avatar`.
- Todo `update public.`/`delete from public.` com `where` (o `pg_safeupdate` do Supabase barra sem; o teste
  `__tests__/safeUpdateMigrations.test.ts` confere toda migração a partir da 0030).
- Migrações idempotentes (`if not exists`, `create or replace`, `drop policy if exists`). **0033 a 0037 não se editam.**
  Função que já existe muda com `create or replace` na 0038, copiada da versão mais nova (0036 para `idle_weekly_reset`,
  `idle_lock`, `idle_save`, `idle_board`; 0034 para o resto). Catálogo muda só por migração NOVA gerada por
  `catalogoSql()`, listada em `games/test/db.ts` e `games/dev/mockDb.ts`.
- Paridade: toda conta de produção existe igual em SQL (autoridade) e em `games/idle/economia.ts`; o teste
  `games/test/idleParidade.test.ts` exige erro relativo < 1e-9.
- Interface em pt-BR no tom do `PRODUCT.md` (informal, "você", botão diz a ação, vazio convida, sem emoji como ícone),
  sem falar em semana/temporada onde o jogo não zera. Texto de usuário (nomes, cargos) sempre por `textContent`.
- Página do jogo: CSS em `games/idle/idle.css`, com as cores que ele já usa; alvo de toque ≥ 44px; foco visível. Telas
  do app: tokens de `lib/theme.ts` e componentes de `components/ui`; ícones Ionicons `-outline`.
- Arte feita por código fora do repositório (`C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`) e copiada para
  `games/idle/assets/`. Nenhuma pessoa real desenhada além do estagiário oficial (o Luis, o do gerador 7; ele topou
  aparecer nas cenas). Nada de lugares nesta entrega.
- Falha ao carregar arte (kit, tiras, cadeira) não some em silêncio: `console.warn` com o arquivo e nova tentativa
  depois (não fica marcada como falha para sempre).
- `?mock`: os bots têm personagem e podem ser contratados; o mock lê 0036, 0037 e 0038.
- Commits sem `Co-Authored-By` nem qualquer marca de IA. Branch `fellas-inc-gente`; no fim, merge local na `main` e
  push, só depois de o Juan aplicar as migrações e as colunas serem conferidas.
- Windows + Git Bash: `cd <dir> && ...` em cada comando. Na raiz: `npx tsc --noEmit` e `npm test`. Em `games/`:
  `npx tsc --noEmit` e `npx vitest run` (e `npm run build` antes do merge). O CI roda Node 24.

## Foco da revisão

1. **Contrato vence com o jogo fechado**: o tempo até o vencimento rende com o bônus, o depois sem, nos dois lados; e
   quem está com a página aberta vê a taxa mudar na hora (`muda_em`). Testes no banco e de paridade na borda (Task 3),
   teste de `store.ts` (Task 5).
2. **Toque duplo em "Contratar"**: o segundo pedido recebe `idle_hire_twice` e o valuation é cobrado uma vez só (as
   duas chamadas passam por `idle_lock_all`, que trava as linhas com o `insert ... on conflict do update` do
   `idle_lock`, então a segunda espera a primeira). Teste no banco (Task 3).
3. **Dois fellas se contratando ao mesmo tempo** (A→B e B→A): as linhas são travadas sempre em ordem de `user_id`, então
   ninguém espera ninguém em círculo; contratar de volta é permitido. Teste do contrato mútuo (Task 3); a ordem das
   travas fica para a revisão de código.
4. **Segunda 00:00 com contratos**: a foto grava o mais disputado da semana que acabou, ninguém perde contrato, empresa
   ou personagem, e a foto tirada por quem joga antes do cron é a mesma. Testes no banco (Task 4).
5. **Visual inválido, editor fechado sem salvar, arte faltando**: faixa errada ou nula é `idle_bad_avatar` (e o `check`
   da tabela segura); sem a arte do kit a página funciona sem gente (Tasks 2 e 6). "Fechar sem salvar mostra o padrão e
   o editor volta na próxima abertura" mora no `main.ts`, sem teste automático: entra na conferência no `?mock` (Task 7).

---

## Estrutura de arquivos

```
supabase/migrations/0037_fellas_inc_catalogo_gente.sql   GERADO por catalogo.ts: + cargos; Networking e Cultura ligadas (feita)
supabase/migrations/0038_fellas_inc_gente.sql            personagem, contratos de 7 dias, conta com contratos, placar, foto
supabase/migrations/0039_notificacao_contrato.sql        notifications_feed (a da 0021) + idle_hired
games/idle/
  nomes.ts             + CARGOS (feito), VISUAL_NOMES
  catalogo.ts          + cargos no catálogo e no SQL gerado (feito)
  economia.ts          + Social, SOLO, multContratos (piso de freela) na taxa; acumularTrechos (vencimentos)
  simulacao.ts         jogador solo com o piso
  store.ts             + vencido (bater o ponto quando um contrato vence)
  imagem.ts            (novo) bytes RGBA: vazia, recortar, colar
  personagem.ts        (novo) faixas, PADRAO, paletas, marcadores, trocarCores, sortear, chave
  montagem.ts          (novo) POSES, folha do kit, boneco, ocuparVagas, montarTira, validarVagas, naCadeira
  navegador.ts         (novo) carregarImagem, pintar, carregarKit, criarDesenhista (só roda no navegador)
  ativos.ts            camadas por cena (fundo/frente/vagas), com volta para a tira antiga; kit
  palco.ts             monta e guarda a tira com gente
  tela.ts, idle.css    aba Contratar, editor, placar com boneco e "mais disputado" (edições pontuais)
  main.ts              editor, contratar, gente no palco, vencimento (edições pontuais)
  assets/pessoas/      (Task 11) pose-1..6.png, estagiario-pose-3.png, estagiario-pose-4.png, cadeira.png
  assets/cenas/        (Task 11) <cena>-fundo.png, <cena>-frente.png, <cena>-vagas.json (as tiras antigas saem)
games/shared/types.ts, api.ts, errors.ts     formatos novos, idleHire, idleSetAvatar, erros novos
games/dev/mockIdle.ts, mockDb.ts             bots com personagem; 0036, 0037 e 0038
games/test/db.ts                             0036, 0037 e 0038
games/test/idleGente.test.ts                 (novo) banco: personagem, contratos, vencimento, placar, foto
games/test/idle.test.ts, idleParidade.test.ts   ajustes do piso; paridade com contratos e vencimentos
lib/notifications.ts, components/notifications/NotificationRow.tsx, app/(tabs)/notifications.tsx   idle_hired
types/database.ts                            idle_weeks.most_hired_id
__tests__/fellasIncMigration.test.ts, notifications.test.ts, notificationsScreen.test.tsx
../fellas-inc-esbocos/ (fora do repo)        BRIEF-GENTE-KIT.md, BRIEF-GENTE-CENAS.md e os scripts da arte
```

**Ordem:** Tasks 1–8 (código) em sequência. Tasks 9 e 10 (arte, fora do repositório) podem correr em paralelo com o
código, a 10 depois da 9. Task 11 depois de 6, 7, 9 e 10. Task 12 por último.

---

## Contrato de formato da arte (vale para o código e para a arte)

### Kit de personagem (`games/idle/assets/pessoas/`)

- `pose-N.png` (N = 1..6), fundo transparente. Caixa de cada pose (largura × altura):

  | Pose | Caixa | Para quê |
  |---|---|---|
  | 1 sentado de costas | 16×22 | você na cadeira (cenas 1, 2, 3), prévia do editor |
  | 2 em pé de costas | 14×26 | você apontando para a TV (cena 4) |
  | 3 em pé de perfil | 12×24 | estagiário com café (cena 2), pingue-pongue, tapete vermelho |
  | 4 sentado de perfil | 14×20 | mesas, PPP, trader |
  | 5 de frente | 9×13 | cobertura da cena 5, cartas de contratar, placar, prévia do editor |
  | 6 deitado (só cabeça e ombro) | 16×10 | "antes" e começo do "abrindo" |

- Folha = 4 colunas (quadros 0–3) × 16 linhas (peças); cada célula tem o tamanho da caixa da pose. Tamanho da folha:
  `4·w × 16·h`. Pose com só 2 quadros desenhados repete: colunas 0, 1, 0, 1.
- Linhas: **0** corpo (pele, olhos, boca); **1–6** cabelo (curto, raspado, cacheado, black power, comprido, de lado);
  **7–10** roupa (moletom, camiseta, camisa social, jaqueta); **11–15** acessório de cabeça (boné, fone, óculos, gorro,
  bandana). Acessório "nenhum" não tem linha. Peça que não aparece numa pose (ex.: óculos de costas) pode ter a célula
  vazia.
- Montagem do boneco: corpo → roupa → cabelo → acessório (cada um por cima do anterior), depois a troca de cores. Cada
  célula traz o próprio contorno preto (`#0B0A0E`). A caixa já tem espaço para o maior cabelo e para o boné.
- Tons-marcador (RGB exato, alfa 255; nada mais na arte usa estas cores), na ordem sombra, meio, luz:
  pele `#640000` `#A00000` `#DC0000` · cabelo `#006400` `#00A000` `#00DC00` · roupa `#000064` `#0000A0` `#0000DC` ·
  acessório `#640064` `#A000A0` `#DC00DC`. O jogo troca cada um pelo tom correspondente da cor escolhida (tabelas em
  `games/idle/personagem.ts`, Task 2). Qualquer outra cor (contorno, branco do olho, boca) fica como está.
- Quadro da pose = quadro da cena % 4.
- `estagiario-pose-N.png`: o estagiário oficial (igual ao gerador 7: boné vermelho, camiseta clara, cordão roxo, crachá
  com "L"), já colorido (sem marcadores), 4 colunas × 1 linha (`4·w × h`). Uma folha por pose que alguma vaga com
  `"freela": "estagiario"` usa: poses 3 (cena 2) e 4 (cena 3).
- `cadeira.png` 24×30, transparente: cadeira de escritório vista de trás, para a prévia do editor. O editor desenha a
  pose 1 em (4, 2) e a cadeira por cima.

### Cenas em camadas (`games/idle/assets/cenas/`)

Para cada cena `<nome>`: `cena-0-antes` (8 quadros), `cena-0-abrindo` (12, toca uma vez), `cena-1` a `cena-4` (8),
`cena-5` (12), `cena-6` (8):

- `<nome>-fundo.png`: tira `quadros·160 × 96`, todo pixel opaco: a cena sem as pessoas das vagas. Gente que não é vaga
  (silhuetas ao fundo, o estagiário servindo café na cena 4) pode ficar.
- `<nome>-frente.png`: tira do mesmo tamanho, transparente fora do que fica na frente das pessoas (encosto, beira de
  mesa, copo na mão). Obrigatória, mesmo toda transparente.
- `<nome>-vagas.json`:

  ```json
  { "quadros": 8, "vagas": [
    { "id": "voce", "papel": "dono", "pose": 1, "x": 61, "y": 48, "espelhada": false },
    { "id": "estagiario", "papel": "contratado", "pose": 3, "x": 20, "y": 50, "espelhada": true, "freela": "estagiario" },
    { "id": "ppp-convidado", "papel": "contratado", "pose": 4, "x": 100, "y": 52, "espelhada": false,
      "freela": { "pele": 1, "cabelo": 2, "cor_cabelo": 1, "roupa": 1, "cor_roupa": 6, "acessorio": 0, "cor_acessorio": 0 } }
  ] }
  ```

  - `x`, `y`: canto de cima à esquerda da caixa da pose, em pixels da cena (inteiros; a caixa inteira dentro de
    160×96). `espelhada: true` = desenhada virada (as poses de perfil olham para a direita sem espelhar).
  - Exatamente 1 vaga `dono` (você). Vaga `contratado` tem `freela` obrigatório: um visual fixo (os 7 campos, dentro
    das faixas) ou `"estagiario"`.
  - Ordem do JSON = ordem de ocupação: a 1ª vaga de contratado recebe o contrato mais recente, a 2ª o anterior, e assim
    por diante; vaga sobrando mostra o freela dela. A ordem de desenho é outra: quem tem o pé mais alto na tela
    (`y + altura` menor) é desenhado antes, atrás; empate segue o JSON.
  - `trilha` (opcional): uma entrada por quadro da cena; cada uma muda `x`, `y`, `pose` e/ou `espelhada` naquele quadro,
    ou é `null` (a pessoa some naquele quadro). Serve para o "abrindo" (deitado → cadeira) e para gente que anda.
  - Vagas de contratado por cena: antes 0 · abrindo 0 · 1 = 0 · 2 = 1 · 3 = 3 · 4 = 5 · 5 = 4 · 6 = livre (até 5).
- A borda de quem está na vaga cai sobre a borda do objeto em que encosta (linha única), como nas cenas de hoje.
- Montagem no jogo (Task 6): fundo → pessoas → frente, quadro a quadro, uma vez por (cena, gente).

---

### Task 1: Catálogo da entrega 2 (cargos; Networking e Cultura de startup ligadas)

> **Feita** (commit c7f80069, revisada e aprovada). Fica como registro. Na época a lógica ainda não tinha número; ela é a
> 0038 (Task 2) e a 0036 é a sem-reset, que vem da `main`.

**Files:**
- Modify: `games/idle/nomes.ts`, `games/idle/catalogo.ts`, `games/idle/catalogo.test.ts`
- Create (gerado, não editar à mão): `supabase/migrations/0037_fellas_inc_catalogo_gente.sql`
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts`, `games/test/idle.test.ts`, `games/idle/tela.test.ts`

**Interfaces:**
- Consome: `ESTRATEGIAS`, `catalogoSql()`, `montarCatalogo()` (núcleo).
- Produz: `CARGOS: readonly string[]` (nomes.ts); `Catalogo.cargos: string[]`; tabela `public.idle_cat_cargo (id int
  primary key, nome text not null)` com RLS de membro; estratégias (2, 2) Networking e (4, 2) Cultura de startup com
  `ativa = true` (os `sociais` não mudam: `{contratoEfeitoMult: 2, propriedadeEfeitoMult: 2}` e
  `{porContratado: 0.15, empregadoMult: 3}`; Abrir capital já tem `{contratoCustoMult: 2}`).

- [ ] **Step 0: Branch**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git checkout main && git pull --ff-only && git checkout -b fellas-inc-gente && ls supabase/migrations | tail -2
```

Expected: a última migração é `0035_fellas_inc_placar_taxa.sql`. Se não for, pare e avise (pré-requisito).

- [ ] **Step 1: Testes do catálogo (`games/idle/catalogo.test.ts`)**

Troque o teste `'12 estratégias; as que dependem de contratos/propriedades vêm desligadas'` inteiro por estes dois:

```ts
  it('12 estratégias; só as que dependem de propriedades vêm desligadas', () => {
    const e = catalogo.estrategias;
    expect(e).toHaveLength(12);
    expect(e.filter((x) => !x.ativa).map((x) => x.nome)).toEqual(['Marca forte', 'Monopólio']);
    expect(e.find((x) => x.nome === 'Queimar caixa')).toMatchObject({ custoMult: 1.25, prodMult: 1.6, genMult: 1 });
    expect(e.find((x) => x.nome === 'Networking')).toMatchObject({ ativa: true, sociais: { contratoEfeitoMult: 2, propriedadeEfeitoMult: 2 } });
    expect(e.find((x) => x.nome === 'Cultura de startup')).toMatchObject({ ativa: true, sociais: { porContratado: 0.15, empregadoMult: 3 } });
    expect(e.find((x) => x.nome === 'Abrir capital')).toMatchObject({ prodMult: 1.3, sociais: { contratoCustoMult: 2 } });
  });

  it('cargos: lista de piada, sem repetir, curtos', () => {
    expect(catalogo.cargos.length).toBeGreaterThanOrEqual(12);
    expect(new Set(catalogo.cargos).size).toBe(catalogo.cargos.length);
    for (const c of catalogo.cargos) expect(c.length).toBeLessThanOrEqual(40);
    expect(catalogo.cargos).toContain('CEO de nada');
  });
```

No `describe('catálogo no banco (migração mais recente)')`, troque a chamada `catalogoSql({ geradores: [...] ... })` do
teste de aspas para incluir `cargos: []`:

```ts
    expect(catalogoSql({ geradores: [{ id: 1, era: 1, nome: "Pão d'água", custo: 1, renda: 1 }], melhorias: [], estrategias: [], cargos: [] }))
      .toContain("'Pão d''água'");
```

e acrescente, no mesmo `describe`:

```ts
  it('cargos entram no SQL gerado', () => {
    expect(catalogoSql()).toContain('insert into public.idle_cat_cargo (id, nome) values');
    expect(catalogoSql()).toContain("(1, 'estagiário')");
  });
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/catalogo.test.ts`
Expected: FAIL (`catalogo.cargos` é `undefined`; Networking ainda desligada).

- [ ] **Step 3: Textos (`games/idle/nomes.ts`)**

Em `ESTRATEGIAS`, tire `ativa: false` (mantenha `requer`) das linhas de Networking e Cultura de startup:

```ts
  { era: 2, opcao: 2, nome: 'Networking', frase: 'Contratos e propriedades valem o dobro.', requer: 'contratos', sociais: { contratoEfeitoMult: 2, propriedadeEfeitoMult: 2 } },
```

```ts
  { era: 4, opcao: 2, nome: 'Cultura de startup', frase: '+15% por contratado, e seus contratados ganham o triplo.', requer: 'contratos', sociais: { porContratado: 0.15, empregadoMult: 3 } },
```

E acrescente no fim do arquivo:

```ts
/** Cargos sorteados ao contratar (o banco guarda o texto no contrato). Minúsculo: entra no meio da frase
 *  ("te contratou como sócio de fachada"). */
export const CARGOS: readonly string[] = [
  'estagiário', 'sócio de fachada', 'coach de produtividade', 'CEO de nada', 'head de vibes', 'diretor de memes',
  'analista de café', 'gerente do grupo do zap', 'consultor de LinkedIn', 'growth hacker', 'especialista em PowerPoint',
  'VP de happy hour', 'embaixador da marca', 'trainee eterno', 'estrategista de rolê', 'assessor de assuntos aleatórios',
];
```

- [ ] **Step 4: Catálogo (`games/idle/catalogo.ts`)**

Import: `import { CARGOS, ESTRATEGIAS, GERADORES, GERAIS, MELHORIAS_GERADOR, SINERGIAS } from './nomes';`

Tipo: `export type Catalogo = { geradores: Gerador[]; melhorias: Melhoria[]; estrategias: Estrategia[]; cargos: string[] };`

No fim de `montarCatalogo`: `return { geradores, melhorias, estrategias, cargos: [...CARGOS] };`

Troque a função `catalogoSql` inteira por:

```ts
/** A migração de catálogo inteira (a 0033 e as seguintes). Catálogo mudou: migração NOVA (ver o cabeçalho gerado). */
export function catalogoSql(cat: Catalogo = catalogo): string {
  const gen = cat.geradores.map((g) => `  (${g.id}, ${g.era}, ${txt(g.nome)}, ${num(g.custo)}, ${num(g.renda)})`);
  const upg = cat.melhorias.map((m) => {
    const c = (k: string) => num(((m as Record<string, unknown>)[k] as number | undefined) ?? null);
    return `  (${m.id}, ${txt(m.tipo)}, ${txt(m.nome)}, ${txt(m.frase)}, ${num(m.preco)}, ${c('gerador')}, ${c('nivel')}, ${c('requer')}, ${c('mult')}, ${c('requerEra')}, ${c('fonte')}, ${c('alvo')}, ${c('porUnidade')}, ${c('requerFonte')}, ${c('requerAlvo')})`;
  });
  const est = cat.estrategias.map(
    (e) =>
      `  (${e.era}, ${e.opcao}, ${txt(e.nome)}, ${txt(e.frase)}, ${e.ativa}, ${e.requer ? txt(e.requer) : 'null'}, ${num(e.genDe)}, ${num(e.genAte)}, ${num(e.genMult)}, ${num(e.prodMult)}, ${num(e.custoMult)}, ${num(e.oppBonusMult)}, ${num(e.oppExtra)}, ${num(e.oppSegundos)}, ${num(e.porGeradorDistinto)}, ${txt(JSON.stringify(e.sociais))}::jsonb)`,
  );
  const car = cat.cargos.map((nome, i) => `  (${i + 1}, ${txt(nome)})`);
  const lista = (linhas: string[]) => (linhas.length ? `${linhas.join(',\n')};\n` : '');
  return `-- fellasapp: Fellas Inc. (idle), catálogo: geradores, melhorias, estratégias e cargos. Idempotente.
-- GERADO por games/idle/catalogo.ts: não edite à mão. Mudou o catálogo? Crie uma migração NOVA NNNN_fellas_inc_catalogo_<nome>.sql com ATUALIZAR_CATALOGO=NNNN_fellas_inc_catalogo_<nome>.sql npx vitest run idle/catalogo.test.ts (em games/) e acrescente o arquivo em games/test/db.ts e games/dev/mockDb.ts.

create table if not exists public.idle_cat_gen (
  id int primary key, era int not null, nome text not null, custo double precision not null, renda double precision not null
);
create table if not exists public.idle_cat_upg (
  id int primary key, tipo text not null check (tipo in ('gerador', 'geral', 'sinergia')), nome text not null, frase text not null,
  preco double precision not null, gerador int, nivel int, requer int, mult double precision, requer_era int,
  fonte int, alvo int, por_unidade double precision, requer_fonte int, requer_alvo int
);
create table if not exists public.idle_cat_est (
  era int not null, opcao int not null, nome text not null, frase text not null, ativa boolean not null, requer text,
  gen_de int, gen_ate int, gen_mult double precision not null, prod_mult double precision not null,
  custo_mult double precision not null, opp_bonus_mult double precision not null, opp_extra int not null,
  opp_segundos int not null, por_gerador_distinto double precision not null, sociais jsonb not null,
  primary key (era, opcao)
);
create table if not exists public.idle_cat_cargo (id int primary key, nome text not null);

alter table public.idle_cat_gen enable row level security;
alter table public.idle_cat_upg enable row level security;
alter table public.idle_cat_est enable row level security;
alter table public.idle_cat_cargo enable row level security;
revoke all on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo from anon, authenticated;
grant select on public.idle_cat_gen, public.idle_cat_upg, public.idle_cat_est, public.idle_cat_cargo to authenticated;
drop policy if exists "idle_cat_gen_select_members" on public.idle_cat_gen;
create policy "idle_cat_gen_select_members" on public.idle_cat_gen for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_upg_select_members" on public.idle_cat_upg;
create policy "idle_cat_upg_select_members" on public.idle_cat_upg for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_est_select_members" on public.idle_cat_est;
create policy "idle_cat_est_select_members" on public.idle_cat_est for select to authenticated using (public.is_member());
drop policy if exists "idle_cat_cargo_select_members" on public.idle_cat_cargo;
create policy "idle_cat_cargo_select_members" on public.idle_cat_cargo for select to authenticated using (public.is_member());

delete from public.idle_cat_gen where true;
delete from public.idle_cat_upg where true;
delete from public.idle_cat_est where true;
delete from public.idle_cat_cargo where true;

insert into public.idle_cat_gen (id, era, nome, custo, renda) values
${lista(gen)}
insert into public.idle_cat_upg (id, tipo, nome, frase, preco, gerador, nivel, requer, mult, requer_era, fonte, alvo, por_unidade, requer_fonte, requer_alvo) values
${lista(upg)}
insert into public.idle_cat_est (era, opcao, nome, frase, ativa, requer, gen_de, gen_ate, gen_mult, prod_mult, custo_mult, opp_bonus_mult, opp_extra, opp_segundos, por_gerador_distinto, sociais) values
${lista(est)}
insert into public.idle_cat_cargo (id, nome) values
${lista(car)}`;
}
```

- [ ] **Step 5: Listas de migração e geração da 0037**

`games/test/db.ts`: em `MIGRATIONS`, depois de `'0035_fellas_inc_placar_taxa.sql',` acrescente
`'0037_fellas_inc_catalogo_gente.sql',`.

`games/dev/mockDb.ts`: depois do import `m35`, acrescente
`import m37 from '../../supabase/migrations/0037_fellas_inc_catalogo_gente.sql?raw';` e troque a lista por
`[m27, m28, m29, m30, m31, m33, m34, m35, m37]`. (A 0036 sem-reset chega pela `main` e a 0038 entra na Task 2.)

Gere a migração e confira que a 0033 não mudou:

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && ATUALIZAR_CATALOGO=0037_fellas_inc_catalogo_gente.sql npx vitest run idle/catalogo.test.ts && cd .. && git status --short supabase/
```

Expected: PASS; `git status` mostra só `?? supabase/migrations/0037_fellas_inc_catalogo_gente.sql` (a 0033 intacta).

- [ ] **Step 6: Consequências nos testes que já existem**

`games/test/idle.test.ts`, no `describe('catálogo no banco')`: troque `.toBe(8)` (contagem de `where ativa`) por
`.toBe(10)` e acrescente:

```ts
  it('cargos: os mesmos do catalogo.ts; anônimo não lê', async () => {
    const cargos = await q<{ nome: string }>('select nome from public.idle_cat_cargo order by id');
    expect(cargos.map((c) => c.nome)).toEqual(catalogo.cargos);
    await expect(t.asRole('anon', 'select * from public.idle_cat_cargo')).rejects.toThrow();
  });
```

No teste `'escolhe uma vez; repetir é idle_strategy_set; opção desligada é idle_bad_choice; era futura é idle_locked'`
(Networking agora está ligada): troque `await expect(pick(2, 2)).rejects.toThrow(/idle_bad_choice/);` por
`await expect(pick(2, 5)).rejects.toThrow(/idle_bad_choice/);` e o nome do teste para
`'escolhe uma vez; repetir é idle_strategy_set; opção que não existe é idle_bad_choice; era futura é idle_locked'`.

`games/idle/tela.test.ts`: troque o teste `'era nova sem estratégia: cartões, os desligados avisam o porquê'` inteiro
por este (a era 2 não tem mais opção desligada; a 3 tem Marca forte):

```ts
  it('era nova sem estratégia: cartões, os desligados avisam o porquê', () => {
    const tela = criarTela(root, acoes);
    const g = [...Array(13).fill(1), ...Array(17).fill(0)];
    tela.renderizar(modelo({ estado: estado({ era: 3, generators: g, strategies: [0, -1, -1, -1] }) }));
    const modal = root.querySelector('.modal-estrategia')!;
    expect(modal.hasAttribute('hidden')).toBe(false);
    expect(modal.textContent).toContain('Chega com o Mapa do rolê');
    [...modal.querySelectorAll('button')].find((b) => b.textContent === 'Escolher' && !b.disabled)!.click();
    expect(acoes.escolher).toHaveBeenCalledWith(3, 0);
  });
```

- [ ] **Step 7: Rodar tudo de `games/`**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run`
Expected: PASS (a simulação não muda: ela escolhe a primeira estratégia ligada de cada era, que continua sendo
Bootstrapping e Abrir capital).

- [ ] **Step 8: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add games/idle/nomes.ts games/idle/catalogo.ts games/idle/catalogo.test.ts supabase/migrations/0037_fellas_inc_catalogo_gente.sql games/test/db.ts games/dev/mockDb.ts games/test/idle.test.ts games/idle/tela.test.ts && git commit -m "Fellas Inc.: catálogo da entrega 2 (cargos, Networking e Cultura de startup ligadas)"
```

---

### Task 2: Personagem: visual, cores e `idle_avatar`

**Files:**
- Create: `games/idle/imagem.ts`, `games/idle/personagem.ts`, `games/idle/personagem.test.ts`
- Modify: `games/idle/nomes.ts` (+ `VISUAL_NOMES`), `games/shared/types.ts` (+ `IdleVisual`)
- Create: `supabase/migrations/0038_fellas_inc_gente.sql` (parte 1)
- Modify: `games/test/db.ts`, `games/dev/mockDb.ts` (+ 0038)
- Create: `games/test/idleGente.test.ts`

**Interfaces:**
- Produz (TS): `type Imagem = { w: number; h: number; d: Uint8ClampedArray<ArrayBuffer> }`, `vazia(w, h)`,
  `recortar(img, x, y, w, h)`, `colar(dest, src, x, y, espelhar?)` (imagem.ts); `type IdleVisual` com os 7 campos
  `number` (types.ts); em personagem.ts: `type Visual = IdleVisual`, `type Campo = keyof Visual`,
  `type Tons = readonly [string, string, string]`, `FAIXAS`, `CAMPOS`, `PADRAO`, `MARCADORES`, `PELES`,
  `CORES_CABELO`, `CORES`, `valido(v)`, `sortear(rand?)`, `chave(v)`, `trocarCores(img, v)`;
  `VISUAL_NOMES: Record<Campo, readonly string[]>` (nomes.ts).
- Produz (banco): tabela `idle_avatar` (faixas: pele 0–5, cabelo 0–5, cor_cabelo 0–7, roupa 0–3, cor_roupa 0–9,
  acessorio 0–5, cor_acessorio 0–9); `idle_avatar_json(uuid) → jsonb | null` (interna); RPC
  `idle_set_avatar(p_pele, p_cabelo, p_cor_cabelo, p_roupa, p_cor_roupa, p_acessorio, p_cor_acessorio)` → estado;
  `idle_json` passa a ser `plpgsql` e devolve também `avatar` (visual ou `null`).

- [ ] **Step 0: Trazer a `main` (com a 0036 sem reset) para o branch**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git checkout fellas-inc-gente && git log --oneline main | grep -c "sem reset semanal" && git merge main -m "Merge da main (Fellas Inc. sem reset) no fellas-inc-gente"
```

Se o `grep` der 0, a sem-reset ainda não está na `main`: pare e avise. Conflito esperado em `games/test/db.ts` e
`games/dev/mockDb.ts` (as duas linhas entraram depois da 0035): a ordem fica 0035, `0036_fellas_inc_sem_reset.sql`,
`0037_fellas_inc_catalogo_gente.sql` (no mockDb, `m35, m36, m37`). Depois:
`cd games && npx tsc --noEmit && npx vitest run` passa.

- [ ] **Step 1: Teste do personagem (`games/idle/personagem.test.ts`)**

```ts
import { describe, expect, it } from 'vitest';

import { vazia, type Imagem } from './imagem';
import { VISUAL_NOMES } from './nomes';
import { CAMPOS, chave, CORES, CORES_CABELO, FAIXAS, MARCADORES, PADRAO, PELES, sortear, trocarCores, valido } from './personagem';

const rgba = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const pinta = (img: Imagem, x: number, y: number, h: string) => img.d.set(rgba(h), (y * img.w + x) * 4);
const px = (img: Imagem, x: number, y: number) => [...img.d.slice((y * img.w + x) * 4, (y * img.w + x) * 4 + 4)];

describe('personagem', () => {
  it('padrão é o fundador: moletom preto, cabelo preto, fone roxo', () => {
    expect(valido(PADRAO)).toBe(true);
    expect(VISUAL_NOMES.roupa[PADRAO.roupa]).toBe('Moletom');
    expect(VISUAL_NOMES.cor_roupa[PADRAO.cor_roupa]).toBe('Preto');
    expect(VISUAL_NOMES.cor_cabelo[PADRAO.cor_cabelo]).toBe('Preto');
    expect(VISUAL_NOMES.acessorio[PADRAO.acessorio]).toBe('Fone');
    expect(VISUAL_NOMES.cor_acessorio[PADRAO.cor_acessorio]).toBe('Roxo');
  });
  it('cada campo tem um nome por opção e cada cor tem 3 tons', () => {
    for (const c of CAMPOS) expect(VISUAL_NOMES[c], c).toHaveLength(FAIXAS[c]);
    expect(PELES).toHaveLength(FAIXAS.pele);
    expect(CORES_CABELO).toHaveLength(FAIXAS.cor_cabelo);
    expect(CORES).toHaveLength(FAIXAS.cor_roupa);
    expect(CORES).toHaveLength(FAIXAS.cor_acessorio);
    for (const t of [...PELES, ...CORES_CABELO, ...CORES]) for (const h of t) expect(h).toMatch(/^#[0-9A-F]{6}$/);
  });
  it('valido recusa fora da faixa, negativo e quebrado', () => {
    expect(valido({ ...PADRAO, pele: 6 })).toBe(false);
    expect(valido({ ...PADRAO, cor_cabelo: -1 })).toBe(false);
    expect(valido({ ...PADRAO, roupa: 1.5 })).toBe(false);
  });
  it('sortear sempre dá um visual válido (até com o sorteio no limite)', () => {
    for (const r of [0, 0.5, 0.999999, 1]) expect(valido(sortear(() => r))).toBe(true);
  });
  it('chave muda quando qualquer campo muda', () => {
    const ks = new Set(CAMPOS.map((c) => chave({ ...PADRAO, [c]: (PADRAO[c] + 1) % FAIXAS[c] })));
    ks.add(chave(PADRAO));
    expect(ks.size).toBe(CAMPOS.length + 1);
  });
  it('marcadores não colidem com nenhuma cor de verdade', () => {
    const marcas = Object.values(MARCADORES).flat();
    const cores = [...PELES, ...CORES_CABELO, ...CORES].flat();
    expect(new Set(marcas).size).toBe(12);
    for (const m of marcas) expect(cores).not.toContain(m);
  });
  it('trocarCores: cada tom-marcador vira o tom da cor escolhida; contorno e transparente ficam; a original não muda', () => {
    const img = vazia(6, 2);
    MARCADORES.pele.forEach((m, i) => pinta(img, i, 0, m));
    pinta(img, 3, 0, MARCADORES.cabelo[2]);
    pinta(img, 4, 0, MARCADORES.roupa[0]);
    pinta(img, 5, 0, MARCADORES.acessorio[1]);
    pinta(img, 0, 1, '#0B0A0E');
    const out = trocarCores(img, { ...PADRAO, pele: 4, cor_cabelo: 2, cor_roupa: 3, cor_acessorio: 6 });
    PELES[4].forEach((c, i) => expect(px(out, i, 0)).toEqual(rgba(c)));
    expect(px(out, 3, 0)).toEqual(rgba(CORES_CABELO[2][2]));
    expect(px(out, 4, 0)).toEqual(rgba(CORES[3][0]));
    expect(px(out, 5, 0)).toEqual(rgba(CORES[6][1]));
    expect(px(out, 0, 1)).toEqual(rgba('#0B0A0E'));
    expect(px(out, 1, 1)).toEqual([0, 0, 0, 0]);
    expect(px(img, 0, 0)).toEqual(rgba(MARCADORES.pele[0]));
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/personagem.test.ts`
Expected: FAIL (`./imagem` e `./personagem` não existem).

- [ ] **Step 3: `games/shared/types.ts`, `games/idle/nomes.ts`, `games/idle/imagem.ts` e `games/idle/personagem.ts`**

Em `games/shared/types.ts`, acrescente no fim:

```ts
// Fellas Inc., entrega 2 (0038): o visual do personagem como o banco guarda (índices das opções do editor)
export type IdleVisual = {
  pele: number; cabelo: number; cor_cabelo: number; roupa: number; cor_roupa: number; acessorio: number; cor_acessorio: number;
};
```

Em `games/idle/nomes.ts`, acrescente no fim:

```ts
/** Opções do editor de personagem, na ordem dos números guardados em idle_avatar (e das linhas do kit). */
export const VISUAL_NOMES = {
  pele: ['Pele 1', 'Pele 2', 'Pele 3', 'Pele 4', 'Pele 5', 'Pele 6'],
  cabelo: ['Curto', 'Raspado', 'Cacheado', 'Black power', 'Comprido', 'De lado'],
  cor_cabelo: ['Preto', 'Castanho', 'Loiro', 'Ruivo', 'Grisalho', 'Roxo', 'Azul', 'Rosa'],
  roupa: ['Moletom', 'Camiseta', 'Camisa social', 'Jaqueta'],
  cor_roupa: ['Preto', 'Branco', 'Cinza', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Roxo', 'Rosa'],
  acessorio: ['Nada', 'Boné', 'Fone', 'Óculos', 'Gorro', 'Bandana'],
  cor_acessorio: ['Preto', 'Branco', 'Cinza', 'Vermelho', 'Laranja', 'Amarelo', 'Verde', 'Azul', 'Roxo', 'Rosa'],
} as const;
```

`games/idle/imagem.ts`:

```ts
// Imagens como bytes RGBA, sem canvas: a montagem das cenas e a troca de cores são contas puras, testáveis no Node.
export type Imagem = { w: number; h: number; d: Uint8ClampedArray<ArrayBuffer> };

export const vazia = (w: number, h: number): Imagem => ({ w, h, d: new Uint8ClampedArray(w * h * 4) });

/** Pedaço w×h a partir de (x, y); o que cai fora da imagem fica transparente. */
export function recortar(img: Imagem, x: number, y: number, w: number, h: number): Imagem {
  const out = vazia(w, h);
  for (let j = 0; j < h; j++) {
    for (let i = 0; i < w; i++) {
      const sx = x + i;
      const sy = y + j;
      if (sx < 0 || sy < 0 || sx >= img.w || sy >= img.h) continue;
      const s = (sy * img.w + sx) * 4;
      out.d.set(img.d.subarray(s, s + 4), (j * w + i) * 4);
    }
  }
  return out;
}

/** Cola `src` em `dest` com o canto em (x, y): pixel transparente não pinta; o que sai de `dest` é cortado. */
export function colar(dest: Imagem, src: Imagem, x: number, y: number, espelhar = false): void {
  for (let j = 0; j < src.h; j++) {
    for (let i = 0; i < src.w; i++) {
      const s = (j * src.w + (espelhar ? src.w - 1 - i : i)) * 4;
      if (src.d[s + 3] === 0) continue;
      const dx = x + i;
      const dy = y + j;
      if (dx < 0 || dy < 0 || dx >= dest.w || dy >= dest.h) continue;
      const d = (dy * dest.w + dx) * 4;
      dest.d[d] = src.d[s];
      dest.d[d + 1] = src.d[s + 1];
      dest.d[d + 2] = src.d[s + 2];
      dest.d[d + 3] = 255;
    }
  }
}
```

`games/idle/personagem.ts`:

```ts
// Personagem da Fellas Inc.: as opções do editor, o visual padrão (o fundador) e a troca de cores. As peças do kit
// (assets/pessoas) vêm pintadas com 3 tons-marcador por canal; aqui eles viram os 3 tons da cor escolhida.
// As faixas são as mesmas dos `check` de idle_avatar (0038). Contrato de formato: plano da entrega 2.
import type { IdleVisual } from '../shared/types';
import type { Imagem } from './imagem';

export type Visual = IdleVisual;
export type Campo = keyof Visual;
/** sombra, meio, luz */
export type Tons = readonly [string, string, string];

export const FAIXAS: Record<Campo, number> = { pele: 6, cabelo: 6, cor_cabelo: 8, roupa: 4, cor_roupa: 10, acessorio: 6, cor_acessorio: 10 };
export const CAMPOS = Object.keys(FAIXAS) as Campo[];

/** Sem personagem salvo: o fundador das cenas (moletom preto, cabelo curto preto, fone roxo). */
export const PADRAO: Visual = { pele: 3, cabelo: 0, cor_cabelo: 0, roupa: 0, cor_roupa: 0, acessorio: 2, cor_acessorio: 8 };

/** Tons-marcador das peças do kit (RGB exato; nada mais na arte usa estas cores). */
export const MARCADORES: Record<'pele' | 'cabelo' | 'roupa' | 'acessorio', Tons> = {
  pele: ['#640000', '#A00000', '#DC0000'],
  cabelo: ['#006400', '#00A000', '#00DC00'],
  roupa: ['#000064', '#0000A0', '#0000DC'],
  acessorio: ['#640064', '#A000A0', '#DC00DC'],
};

export const PELES: readonly Tons[] = [
  ['#3B2418', '#5A3A2A', '#7A4E36'],
  ['#5A3A2A', '#7A4E36', '#8A5A48'],
  ['#6E4630', '#8A5A48', '#B98066'],
  ['#8A5A48', '#B98066', '#E0A27A'],
  ['#B98066', '#E0A27A', '#F2C4A0'],
  ['#D69A7A', '#F2C4A0', '#FBE0C8'],
];
/** Preto, castanho, loiro, ruivo, grisalho, roxo, azul, rosa. */
export const CORES_CABELO: readonly Tons[] = [
  ['#060608', '#0F0F13', '#262C3A'],
  ['#2E2019', '#4E3628', '#7A563D'],
  ['#B8913A', '#E0B85A', '#FFE9A8'],
  ['#8C4A1C', '#C46A28', '#E8954A'],
  ['#6B6874', '#8E8A96', '#B4B0BC'],
  ['#3A2A66', '#5B3FD9', '#7E66E8'],
  ['#1E3A66', '#2F6BB0', '#5EC8FF'],
  ['#8C2A5E', '#D94F9A', '#FF8CC6'],
];
/** Roupa e acessório: preto, branco, cinza, vermelho, laranja, amarelo, verde, azul, roxo, rosa. */
export const CORES: readonly Tons[] = [
  ['#1A1A21', '#2A2D38', '#7084A6'],
  ['#C9C4B8', '#E4E0D6', '#F4F1EA'],
  ['#3A3940', '#55535E', '#8E8A96'],
  ['#5E1A28', '#C23B53', '#FF5A6E'],
  ['#8C4A1C', '#E8954A', '#F6C08A'],
  ['#AC832F', '#C9962F', '#FFD25E'],
  ['#1F4A30', '#2F6B45', '#5ED18A'],
  ['#1E2A3F', '#2F4F80', '#5EC8FF'],
  ['#3A2A66', '#5B3FD9', '#B8A2FF'],
  ['#8C2A5E', '#D94F9A', '#FF8CC6'],
];

export const valido = (v: Visual): boolean => CAMPOS.every((c) => Number.isInteger(v[c]) && v[c] >= 0 && v[c] < FAIXAS[c]);

export function sortear(rand: () => number = Math.random): Visual {
  const v = {} as Visual;
  for (const c of CAMPOS) v[c] = Math.min(FAIXAS[c] - 1, Math.floor(rand() * FAIXAS[c]));
  return v;
}

/** Texto único por visual (chave de cache da montagem). */
export const chave = (v: Visual): string => CAMPOS.map((c) => v[c]).join('.');

const rgb = (h: string) => parseInt(h.slice(1), 16);

/** Troca os tons-marcador pelos tons das cores do visual; o resto (contorno, olhos) fica como está. */
export function trocarCores(img: Imagem, v: Visual): Imagem {
  const mapa = new Map<number, number>();
  const por = (m: Tons, c: Tons) => m.forEach((x, i) => mapa.set(rgb(x), rgb(c[i])));
  por(MARCADORES.pele, PELES[v.pele]);
  por(MARCADORES.cabelo, CORES_CABELO[v.cor_cabelo]);
  por(MARCADORES.roupa, CORES[v.cor_roupa]);
  por(MARCADORES.acessorio, CORES[v.cor_acessorio]);
  const d = new Uint8ClampedArray(img.d);
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] === 0) continue;
    const novo = mapa.get((d[i] << 16) | (d[i + 1] << 8) | d[i + 2]);
    if (novo === undefined) continue;
    d[i] = novo >> 16;
    d[i + 1] = (novo >> 8) & 255;
    d[i + 2] = novo & 255;
  }
  return { w: img.w, h: img.h, d };
}
```

- [ ] **Step 4: Rodar o teste do personagem**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/personagem.test.ts`
Expected: PASS.

- [ ] **Step 5: Teste do banco (`games/test/idleGente.test.ts`, novo)**

O arquivo nasce com os ajudantes que as Tasks 3 e 4 também usam:

```ts
// Banco da entrega 2 da Fellas Inc. (personagem, contratos de 7 dias, placar, foto de segunda), com as migrações reais no PGlite.
import { beforeEach, describe, expect, it } from 'vitest';

import { catalogo } from '../idle/catalogo';
import { CAMPOS, FAIXAS, PADRAO } from '../idle/personagem';
import { freshDb, type TestDb } from './db';

const A = '00000000-0000-0000-0000-00000000000a';
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const OUT = '00000000-0000-0000-0000-0000000000ff';

let t: TestDb;
const q = async <T>(sql: string, p: unknown[] = []) => (await t.db.query<T>(sql, p)).rows;

type Visual = Record<string, number | null>;
type Estado = {
  user_id: string; started: boolean; valuation: number; rate: number; era: number; strategies: number[];
  avatar: Visual | null; equipe: { user_id: string; cargo: string; avatar: Visual | null; ate: string }[];
  chefes: { user_id: string; cargo: string; mult: number; ate: string }[]; social: { contratei: number; empregos: number[] };
  hire_price: number; muda_em: string | null; server_now: string;
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
const dar = (u: string, v: number) => q('update public.idle_state set valuation = $2 where user_id = $1', [u, v]);
/** Para o relógio de u: a conta não depende dos milissegundos entre as chamadas. */
const parar = (u: string) => q(`update public.idle_state set settled_at = now() + interval '1 hour' where user_id = $1`, [u]);
const recuar = (u: string, s: number) =>
  q('update public.idle_state set settled_at = settled_at - make_interval(secs => $2) where user_id = $1', [u, s]);
const salvar = (v: Visual) =>
  t.rpc<Estado>('idle_set_avatar', {
    p_pele: v.pele, p_cabelo: v.cabelo, p_cor_cabelo: v.cor_cabelo, p_roupa: v.roupa, p_cor_roupa: v.cor_roupa,
    p_acessorio: v.acessorio, p_cor_acessorio: v.cor_acessorio,
  });
const V: Visual = { pele: 1, cabelo: 2, cor_cabelo: 3, roupa: 1, cor_roupa: 4, acessorio: 3, cor_acessorio: 5 };

describe('personagem', () => {
  it('sem visual salvo: avatar nulo', async () => {
    expect((await t.rpc<Estado>('idle_open')).avatar).toBeNull();
  });
  it('salva o próprio visual, antes do Abrir CNPJ também, e ele volta no estado', async () => {
    const s = await salvar(V);
    expect(s.avatar).toEqual(V);
    expect(s.started).toBe(false);
    expect((await salvar({ ...V, pele: 5 })).avatar).toEqual({ ...V, pele: 5 });
    expect((await t.rpc<Estado>('idle_open')).avatar).toEqual({ ...V, pele: 5 });
  });
  it('as faixas são as do personagem.ts: o último vale; o seguinte, negativo ou nulo é idle_bad_avatar', async () => {
    for (const c of CAMPOS) {
      await salvar({ ...PADRAO, [c]: FAIXAS[c] - 1 });
      await expect(salvar({ ...PADRAO, [c]: FAIXAS[c] }), c).rejects.toThrow(/idle_bad_avatar/);
      await expect(salvar({ ...PADRAO, [c]: -1 }), c).rejects.toThrow(/idle_bad_avatar/);
      await expect(salvar({ ...PADRAO, [c]: null }), c).rejects.toThrow(/idle_bad_avatar/);
    }
  });
  it('a tabela também recusa fora da faixa (check)', async () => {
    await expect(
      q(`insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
         values ($1, 6, 0, 0, 0, 0, 0, 0)`, [B]),
    ).rejects.toThrow();
  });
  it('ninguém escreve direto na tabela (nem no próprio)', async () => {
    await salvar(V);
    await expect(t.asRole('authenticated', `update public.idle_avatar set pele = 0 where user_id = '${A}'`)).rejects.toThrow();
    await expect(
      t.asRole('authenticated', `insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
                                 values ('${B}', 0, 0, 0, 0, 0, 0, 0)`),
    ).rejects.toThrow();
  });
  it('membro lê o visual dos outros; anônimo não; não membro é barrado', async () => {
    await salvar(V);
    await t.as(B);
    expect(await t.asRole('authenticated', 'select pele from public.idle_avatar')).toEqual([{ pele: 1 }]);
    await expect(t.asRole('anon', 'select * from public.idle_avatar')).rejects.toThrow();
    await t.as(OUT);
    await expect(salvar(V)).rejects.toThrow(/not_member/);
  });
  it('salvar o visual fecha a conta (o número não volta no tempo)', async () => {
    await t.rpc('idle_start');
    await recuar(A, 100);
    const s = await salvar(V);
    expect(s.valuation).toBeCloseTo(10 + s.rate * 100, 0);
  });
});
```

(`catalogo`, `C`, `dar` e `parar` são usados nas Tasks 3 e 4.)

- [ ] **Step 6: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run test/idleGente.test.ts`
Expected: FAIL (`function public.idle_set_avatar(...) does not exist`).

- [ ] **Step 7: Migração `supabase/migrations/0038_fellas_inc_gente.sql` (parte 1) e listas**

```sql
-- fellasapp: Fellas Inc., entrega 2 (gente): personagem, contratos de 7 dias, a conta da produção com contratos (e
-- com os vencimentos no meio), placar com o "mais disputado" e a foto de segunda guardando ele. A Fellas Inc. não tem
-- reset (0036): nada aqui apaga estado, contrato ou personagem. As funções que mudam são trocadas com create or replace
-- a partir da versão mais nova (0034/0035/0036, já em produção). As mesmas contas existem em games/idle/economia.ts
-- (teste de paridade). Não toca nos créditos do cassino. Idempotente.

-- ===== personagem =====

create table if not exists public.idle_avatar (
  user_id       uuid primary key references public.profiles (id) on delete cascade,
  pele          smallint not null check (pele between 0 and 5),
  cabelo        smallint not null check (cabelo between 0 and 5),
  cor_cabelo    smallint not null check (cor_cabelo between 0 and 7),
  roupa         smallint not null check (roupa between 0 and 3),
  cor_roupa     smallint not null check (cor_roupa between 0 and 9),
  acessorio     smallint not null check (acessorio between 0 and 5),
  cor_acessorio smallint not null check (cor_acessorio between 0 and 9),
  updated_at    timestamptz not null default now()
);

alter table public.idle_avatar enable row level security;
revoke all on public.idle_avatar from anon, authenticated;
grant select on public.idle_avatar to authenticated;
drop policy if exists "idle_avatar_select_members" on public.idle_avatar;
create policy "idle_avatar_select_members" on public.idle_avatar for select to authenticated using (public.is_member());

-- o visual de alguém no formato do jogo (null = nunca salvou: a tela usa o fundador padrão)
create or replace function public.idle_avatar_json(u uuid)
returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object('pele', a.pele, 'cabelo', a.cabelo, 'cor_cabelo', a.cor_cabelo, 'roupa', a.roupa,
                            'cor_roupa', a.cor_roupa, 'acessorio', a.acessorio, 'cor_acessorio', a.cor_acessorio)
    from public.idle_avatar a
   where a.user_id = u
$$;

-- o estado que toda função do jogo devolve (o da 0034 + o personagem). plpgsql: as funções que ela chama podem vir
-- depois neste arquivo.
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', public.idle_rate(s), 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
    'strategies', to_jsonb(s.strategies), 'era', public.idle_era(s.generators), 'boost_until', s.boost_until,
    'half_price', s.half_price, 'opp_claimed', to_jsonb(s.opp_claimed),
    'opp_left', greatest(0, public.idle_opp_cap(s)
                             - case when s.opp_day = public.games_today() then s.opp_count else 0 end),
    'server_now', now(),
    'avatar', public.idle_avatar_json(s.user_id));
end;
$$;

-- "Bora" do editor: só o próprio, de graça, quantas vezes quiser. Fecha a conta (a tela ancora o número no estado
-- devolvido).
create or replace function public.idle_set_avatar(p_pele int, p_cabelo int, p_cor_cabelo int, p_roupa int,
                                                  p_cor_roupa int, p_acessorio int, p_cor_acessorio int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare s public.idle_state;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  if p_pele is null or p_cabelo is null or p_cor_cabelo is null or p_roupa is null or p_cor_roupa is null
     or p_acessorio is null or p_cor_acessorio is null
     or p_pele not between 0 and 5 or p_cabelo not between 0 and 5 or p_cor_cabelo not between 0 and 7
     or p_roupa not between 0 and 3 or p_cor_roupa not between 0 and 9 or p_acessorio not between 0 and 5
     or p_cor_acessorio not between 0 and 9 then
    raise exception 'idle_bad_avatar' using errcode = 'P0001';
  end if;
  insert into public.idle_avatar (user_id, pele, cabelo, cor_cabelo, roupa, cor_roupa, acessorio, cor_acessorio)
  values (auth.uid(), p_pele, p_cabelo, p_cor_cabelo, p_roupa, p_cor_roupa, p_acessorio, p_cor_acessorio)
  on conflict (user_id) do update
    set pele = excluded.pele, cabelo = excluded.cabelo, cor_cabelo = excluded.cor_cabelo, roupa = excluded.roupa,
        cor_roupa = excluded.cor_roupa, acessorio = excluded.acessorio, cor_acessorio = excluded.cor_acessorio,
        updated_at = now();
  s := public.idle_settle(public.idle_lock(auth.uid()));
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_avatar_json(uuid) from public, anon, authenticated;
revoke all on function public.idle_json(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_set_avatar(int, int, int, int, int, int, int) from public, anon;
grant execute on function public.idle_set_avatar(int, int, int, int, int, int, int) to authenticated;
```

`games/test/db.ts`: em `MIGRATIONS`, depois de `'0037_fellas_inc_catalogo_gente.sql',` acrescente
`'0038_fellas_inc_gente.sql',` (a lista fica ... 0035, 0036 sem-reset, 0037, 0038).

`games/dev/mockDb.ts`: `import m38 from '../../supabase/migrations/0038_fellas_inc_gente.sql?raw';` e a lista vira
`[m27, m28, m29, m30, m31, m33, m34, m35, m36, m37, m38]` (`m36` é a sem-reset).

- [ ] **Step 8: Rodar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run`
Expected: PASS (inclusive os testes do núcleo: `idle_json` devolve o mesmo de antes + `avatar`).

- [ ] **Step 9: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add games/idle/imagem.ts games/idle/personagem.ts games/idle/personagem.test.ts games/idle/nomes.ts games/shared/types.ts supabase/migrations/0038_fellas_inc_gente.sql games/test/db.ts games/dev/mockDb.ts games/test/idleGente.test.ts && git commit -m "Fellas Inc.: personagem (visual, troca de cores e idle_avatar)"
```

---

### Task 3: Contratos de 7 dias e a conta da produção com contratos (banco + `economia.ts`)

**Files:**
- Modify: `supabase/migrations/0038_fellas_inc_gente.sql` (troca o bloco do `idle_json`; acrescenta a parte 2)
- Modify: `games/idle/economia.ts`, `games/idle/economia.test.ts`, `games/idle/simulacao.ts`, `games/idle/simulacao.test.ts`
- Modify: `games/test/idleGente.test.ts`, `games/test/idleParidade.test.ts`, `games/test/idle.test.ts`

**Interfaces:**
- Consome: `idle_lock` e `idle_save` (versão da 0036), `idle_era`, `idle_cat_est.sociais` (0033/0037), `idle_cat_cargo`
  (Task 1), `idle_avatar_json` (Task 2). O `idle_settle` e o `idle_rate` da 0034 são trocados aqui.
- Produz (banco): tabela `idle_contracts (id, employer_id, employee_id, cargo, created_at, ends_at)` com
  `ends_at = created_at + 7 dias`; "ativo em t" = `created_at <= t and ends_at > t`. Internas `idle_employee_mult(uuid)`,
  `idle_social_mult(idle_state, timestamptz)`, `idle_rate_at(idle_state, timestamptz)`, `idle_rate(idle_state)`
  (= `idle_rate_at(s, now())`), `idle_settle(idle_state, timestamptz default now())` (divide nos vencimentos),
  `idle_hire_price(idle_state)`, `idle_next_change(idle_state)`, `idle_lock_all(uuid[])`; RPC `idle_hire(p_user uuid)` →
  estado; `idle_pick_strategy` fecha a conta dos contratados ativos ao escolher Cultura de startup; `idle_json` devolve
  também `equipe` (`[{user_id, cargo, avatar, ate}]`, contratos ativos que você fez, do mais recente ao mais antigo),
  `chefes` (`[{user_id, cargo, mult, ate}]`), `social` (`{contratei, empregos: number[]}`), `hire_price` e `muda_em`
  (próximo vencimento que mexe na sua taxa, ou `null`).
- Produz (TS, economia.ts): `type Social = { contratei: number; empregos: number[] }`, `SOLO`, `POR_CONTRATADO = 0.1`,
  `POR_EMPREGO = 0.02`, `Estado.social?: Social` (sem = `SOLO`), `multContratos(cat, s): number` (entra no
  multiplicador global de `fatores`), `acumularTrechos(v, trechos: { desdeMs: number; r: number }[], desdeMs, ateMs,
  boostAteMs): number` (igual a `idle_settle`).

**Por que o vencimento fica certo assim:** a taxa de alguém só muda sem ação dele quando (1) é contratado, (2) o chefe
escolhe Cultura de startup ou (3) um contrato dele vence. (1) e (2) já fecham a conta da pessoa antes (`idle_hire`,
`idle_pick_strategy`). Para (3), `idle_settle` corta o intervalo nos `ends_at` dos contratos da pessoa (dos dois lados)
e usa, em cada trecho, a taxa com os contratos ativos no começo dele. Contrato só nasce com a conta dos dois lados
fechada naquele instante (`created_at = settled_at`), então nenhum contrato começa no meio de um intervalo. Sem cron.

- [ ] **Step 1: Testes da economia (`games/idle/economia.test.ts`)**

Import: `import { acumular, acumularTrechos, custoMult, era, liberada, maxCompra, multContratos, podeComprarGerador, preco, taxa, taxaPorUnidade, type Estado } from './economia';`

Troque o `describe('taxa', ...)` inteiro por este (toda taxa agora tem o piso de freela de quem ninguém contratou):

```ts
const PISO = 1.02; // ninguém te contratou: piso de freela (+2%)

describe('taxa', () => {
  it('soma renda × quantidade (com o piso de freela)', () => {
    expect(taxa(cat, com([[1, 2]]))).toBeCloseTo(1 * PISO, 10);
  });
  it('melhoria de gerador dobra só aquele gerador', () => {
    const s = com([[1, 2], [2, 1]], { upgrades: [11] });
    expect(taxa(cat, s)).toBeCloseTo((2 + cat.geradores[1].renda) * PISO, 10);
  });
  it('geral multiplica tudo; sinergia soma por unidade da fonte', () => {
    expect(taxa(cat, com([[1, 1]], { upgrades: [1001] }))).toBeCloseTo(0.5 * 1.05 * PISO, 10);
    const s = com([[1, 10], [2, 1]], { upgrades: [2001] });
    expect(taxa(cat, s)).toBeCloseTo((5 + cat.geradores[1].renda * 1.1) * PISO, 10);
  });
  it('estratégias: Bootstrapping +50% nos 1–12, Queimar caixa +60% em tudo, Holding +3% por gerador diferente', () => {
    expect(taxa(cat, com([[1, 1], [7, 1]], { strategies: [0, -1, -1, -1] }))).toBeCloseTo((0.5 + cat.geradores[6].renda) * 1.5 * PISO, 10);
    expect(taxa(cat, com([[1, 1]], { strategies: [1, -1, -1, -1] }))).toBeCloseTo(0.5 * 1.6 * PISO, 10);
    expect(taxa(cat, com([[1, 1], [2, 1]], { strategies: [-1, -1, -1, 1] }))).toBeCloseTo((0.5 + cat.geradores[1].renda) * 1.06 * PISO, 10);
  });
  it('taxaPorUnidade × quantidade fecha com a taxa (sem estratégia de gerador distinto)', () => {
    const s = com([[1, 4], [3, 2]], { upgrades: [11, 1001] });
    expect(4 * taxaPorUnidade(cat, s, 1) + 2 * taxaPorUnidade(cat, s, 3)).toBeCloseTo(taxa(cat, s), 10);
  });
});

describe('contratos (multContratos)', () => {
  const s = (social: Estado['social'], strategies = [-1, -1, -1, -1]): Estado => ({ ...com([[1, 1]]), strategies, social });
  it('ninguém te contratou: piso de freela, +2%', () => {
    expect(multContratos(cat, vazio())).toBeCloseTo(1.02, 12);
  });
  it('+10% por contratado; +2% por empresa em que você trabalha (aí sem o piso)', () => {
    expect(multContratos(cat, s({ contratei: 3, empregos: [] }))).toBeCloseTo(1 + 0.3 + 0.02, 12);
    expect(multContratos(cat, s({ contratei: 0, empregos: [1, 1] }))).toBeCloseTo(1.04, 12);
    expect(multContratos(cat, s({ contratei: 2, empregos: [1] }))).toBeCloseTo(1.22, 12);
  });
  it('Networking dobra tudo, o piso também', () => {
    expect(multContratos(cat, s({ contratei: 0, empregos: [] }, [2, -1, -1, -1]))).toBeCloseTo(1.04, 12);
    expect(multContratos(cat, s({ contratei: 1, empregos: [1] }, [2, -1, -1, -1]))).toBeCloseTo(1.24, 12);
  });
  it('Cultura de startup: +15% por contratado; empresa com Cultura paga o triplo a quem ela contratou', () => {
    expect(multContratos(cat, s({ contratei: 2, empregos: [] }, [0, 0, 2, -1]))).toBeCloseTo(1 + 0.3 + 0.02, 12);
    expect(multContratos(cat, s({ contratei: 0, empregos: [3, 1] }))).toBeCloseTo(1.08, 12);
  });
  it('entra na taxa como multiplicador global', () => {
    expect(taxa(cat, com([[1, 2]], { social: { contratei: 1, empregos: [] } }))).toBeCloseTo(1 * 1.12, 10);
  });
});

describe('acumularTrechos (contrato vencendo no meio)', () => {
  it('com um trecho só é o mesmo que acumular', () => {
    expect(acumularTrechos(10, [{ desdeMs: 0, r: 0.5 }], 0, 100_000, 60_000)).toBeCloseTo(acumular(10, 0.5, 0, 100_000, 60_000), 12);
    expect(acumularTrechos(0, [{ desdeMs: 0, r: 1 }], 0, 10 * 3600_000, null)).toBeCloseTo(8 * 3600, 6);
  });
  it('cada trecho rende com a sua taxa; o ×5 vale só até o fim do bônus', () => {
    // r = 1 até 100 s, r = 2 depois; bônus até 150 s; fecha em 300 s
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 100_000, r: 2 }], 0, 300_000, 150_000);
    expect(v).toBeCloseTo(1 * 100 + 4 * 1 * 100 + 2 * 200 + 4 * 2 * 50, 10);
  });
  it('vencimento depois do teto de 8h não conta', () => {
    const v = acumularTrechos(0, [{ desdeMs: 0, r: 1 }, { desdeMs: 9 * 3600_000, r: 100 }], 0, 10 * 3600_000, null);
    expect(v).toBeCloseTo(8 * 3600, 6);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/economia.test.ts`
Expected: FAIL (`multContratos` e `acumularTrechos` não existem; taxas sem o piso).

- [ ] **Step 3: `games/idle/economia.ts`**

Troque a linha do `Estado` por:

```ts
/** O que muda a produção pelos contratos ATIVOS: quantos você contratou e, para cada empresa que te contratou, quanto
 *  ela paga (3 se ela escolheu Cultura de startup). Sem isso (simulação, testes) = jogador sozinho. */
export type Social = { contratei: number; empregos: number[] };
export const SOLO: Social = { contratei: 0, empregos: [] };
export type Estado = { generators: number[]; upgrades: number[]; strategies: number[]; social?: Social };

export const POR_CONTRATADO = 0.1;
export const POR_EMPREGO = 0.02;
```

Acrescente depois de `estrategiasAtivas`:

```ts
/**
 * Multiplicador dos contratos ativos (igual a idle_social_mult na 0038):
 * 1 + efeito × (porContratado × contratei + Σ 2% × o que cada empresa paga). Ninguém te contratou = piso de freela
 * (2%, como 1 contrato). efeito = ×2 com Networking; porContratado = 10% (15% com Cultura de startup).
 */
export function multContratos(cat: Catalogo, s: Estado): number {
  const est = estrategiasAtivas(cat, s);
  const soc = s.social ?? SOLO;
  const pors = est.map((e) => e.sociais.porContratado).filter((x) => x !== undefined);
  const por = pors.length ? Math.max(...pors) : POR_CONTRATADO;
  const efeito = est.reduce((a, e) => a * (e.sociais.contratoEfeitoMult ?? 1), 1);
  const empregos = soc.empregos.length ? soc.empregos.reduce((a, m) => a + POR_EMPREGO * m, 0) : POR_EMPREGO;
  return 1 + efeito * (por * soc.contratei + empregos);
}
```

Em `fatores`, logo depois de `global *= 1 + est.reduce((a, e) => a + e.porGeradorDistinto, 0) * distintos;`:

```ts
  global *= multContratos(cat, s);
```

E no fim do arquivo:

```ts
/**
 * Como `acumular`, mas a taxa troca no meio (um contrato vencendo): `trechos` = [{ desdeMs, r }] em ordem, o primeiro
 * começando em `desdeMs`. Igual a idle_settle na 0038: teto de 8h contado de `desdeMs`, ×5 dentro do bônus.
 */
export function acumularTrechos(
  v: number, trechos: { desdeMs: number; r: number }[], desdeMs: number, ateMs: number, boostAteMs: number | null,
): number {
  const fim = Math.min(ateMs, desdeMs + TETO_SEGUNDOS * 1000);
  for (let i = 0; i < trechos.length; i++) {
    const a = Math.max(trechos[i].desdeMs, desdeMs);
    const b = Math.min(i + 1 < trechos.length ? trechos[i + 1].desdeMs : fim, fim);
    if (b <= a) continue;
    const r = trechos[i].r;
    v += (r * (b - a)) / 1000;
    if (boostAteMs !== null && boostAteMs > a) v += r * 4 * Math.max(0, (Math.min(b, boostAteMs) - a) / 1000);
  }
  return v;
}
```

(A tela continua animando com `acumular` e a `rate` do banco; quando o relógio do servidor passa de `muda_em`, ela bate
o ponto de novo, Tasks 5 e 7.)

- [ ] **Step 4: Simulação com o piso (`games/idle/simulacao.ts` e `simulacao.test.ts`)**

`simulacao.ts`: import `import { acumular, custoMult, era, liberada, podeComprarGerador, preco, SOLO, taxa, taxaPorUnidade, type Estado } from './economia';`
e o estado inicial vira:

```ts
  // jogador sozinho: ninguém contrata ninguém, então vale o piso de freela (+2%) o tempo todo
  const s: Estado = { generators: Array(30).fill(0), upgrades: [], strategies: [-1, -1, -1, -1], social: SOLO };
```

Rode `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/economia.test.ts idle/simulacao.test.ts`
e meça os marcos de verdade (por exemplo, um `console.log(simular())` temporário, apagado depois). Na conferência do
plano (renda ×1,02, que é a mesma conta) deu: 2º notebook 15 s, era 2 em 895 s, era 3 em 0,5 d, era 4 em 1,0 d, era 5
em 3,0 d (começo do dia 4), 489 compras na 1ª hora, gerador 30 fora. Em `simulacao.test.ts`, acima do
`describe('ritmo da semana', ...)`, grave os números MEDIDOS agora (as asserções não mudam):

```ts
// Com o piso de freela (+2%, entrega 2), medido ao implementar: 2º notebook <N> s, era 2 em <N> s, era 3 em <N> d,
// era 4 em <N> d, era 5 em <N> d, <N> compras na 1ª hora, gerador 30 fora. Era 4 e era 5 caem no começo de uma sessão
// (meia-noite); a era 2 tem pouca folga para o teto de 900 s.
// Se algum marco sair do alvo, NÃO mexa em PARAMETROS (mudaria os preços em produção): pare e avise.
```

(troque cada `<N>` pelo número medido). Se a era 2 passar de 900 s ou outro marco sair do alvo: PARE e reporte.

- [ ] **Step 5: Testes de contrato no banco (acrescentar em `games/test/idleGente.test.ts`)**

```ts
const contratar = (u: string | null) => t.rpc<Estado>('idle_hire', { p_user: u });
const valuationDe = async (u: string) =>
  (await q<{ valuation: number }>('select valuation from public.idle_state where user_id = $1', [u]))[0].valuation;
/** Joga os contratos pro passado: criados há `dias` dias + `horas` horas (vencem 7 dias depois de criados). */
const envelhecerContratos = (dias: number, horas = 0) =>
  q(`update public.idle_contracts
        set created_at = created_at - make_interval(days => $1, hours => $2),
            ends_at = ends_at - make_interval(days => $1, hours => $2)
      where true`, [dias, horas]);

describe('contratar', () => {
  beforeEach(async () => {
    await abrir(A, B);
  });

  it('paga 30 min da própria produção; quem contrata ganha +10%, o contratado troca o piso por um emprego', async () => {
    await dar(A, 10_000);
    await parar(A);
    const antes = await t.rpc<Estado>('idle_open');
    expect(antes.rate).toBeCloseTo(0.5 * 1.02, 10);
    expect(antes.hire_price).toBeCloseTo(antes.rate * 1800, 6);
    expect(antes.muda_em).toBeNull();
    const s = await contratar(B);
    expect(s.valuation).toBeCloseTo(10_000 - antes.rate * 1800, 6);
    expect(s.rate).toBeCloseTo(0.5 * (1 + 0.1 + 0.02), 10);
    expect(s.equipe).toHaveLength(1);
    expect(s.equipe[0]).toMatchObject({ user_id: B, avatar: null });
    expect(catalogo.cargos).toContain(s.equipe[0].cargo);
    // vence em 7 dias, e é esse o próximo momento em que a taxa muda sozinha
    expect(Date.parse(s.equipe[0].ate) - Date.parse(s.server_now)).toBeCloseTo(7 * 86400_000, -4);
    expect(s.muda_em).toBe(s.equipe[0].ate);
    await t.as(B);
    const b = await t.rpc<Estado>('idle_open');
    expect(b.chefes).toEqual([{ user_id: A, cargo: s.equipe[0].cargo, mult: 1, ate: s.equipe[0].ate }]);
    expect(b.muda_em).toBe(s.equipe[0].ate);
    expect(b.rate).toBeCloseTo(0.5 * 1.02, 10);
  });
  it('cada contrato ativo deixa o próximo 1,5× mais caro (sobre a produção da hora)', async () => {
    await abrir(C);
    await dar(A, 1e6);
    await parar(A);
    const s1 = await contratar(B);
    expect(s1.hire_price).toBeCloseTo(s1.rate * 1800 * 1.5, 6);
    const s2 = await contratar(C);
    expect(s2.valuation).toBeCloseTo(s1.valuation - s1.hire_price, 6);
    expect(s2.hire_price).toBeCloseTo(s2.rate * 1800 * 1.5 ** 2, 6);
  });
  it('Abrir capital: contratar custa o dobro', async () => {
    await q(`update public.idle_state set generators[13] = 1, generators[19] = 1, strategies = '{0,0,0,-1}' where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.hire_price).toBeCloseTo(s.rate * 1800 * 2, 6);
  });
  it('toque duplo: a segunda vez é idle_hire_twice e cobra uma vez só', async () => {
    // em produção as duas chamadas passam por idle_lock_all (trava de linha do idle_lock): a segunda espera a primeira
    await dar(A, 1e6);
    await parar(A);
    const s = await contratar(B);
    await expect(contratar(B)).rejects.toThrow(/idle_hire_twice/);
    expect(await valuationDe(A)).toBeCloseTo(s.valuation, 6);
    expect(await q('select employee_id from public.idle_contracts')).toEqual([{ employee_id: B }]);
  });
  it('contrato vence em 7 dias: sai da conta, o preço volta e dá pra contratar de novo', async () => {
    await dar(A, 1e6);
    await contratar(B);
    await envelhecerContratos(7);
    const s = await t.rpc<Estado>('idle_open');
    expect(s).toMatchObject({ equipe: [], social: { contratei: 0, empregos: [] }, muda_em: null });
    expect(s.rate).toBeCloseTo(0.5 * 1.02, 10);
    expect(s.hire_price).toBeCloseTo(s.rate * 1800, 6);
    expect((await contratar(B)).equipe.map((e) => e.user_id)).toEqual([B]);
    expect(await q('select count(*)::int as n from public.idle_contracts')).toEqual([{ n: 2 }]); // o vencido fica
  });
  it('vencimento com o jogo fechado: até ele rende com o bônus, depois sem (quem contratou)', async () => {
    await dar(A, 1e6);
    await contratar(B);
    // criado há 7 dias e 2 horas: venceu há 2 horas; A ficou 3 horas sem abrir
    await envelhecerContratos(7, 2);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '3 hours' where user_id = $1`, [A]);
    const s = await t.rpc<Estado>('idle_open');
    expect(s.valuation).toBeCloseTo(0.5 * 1.12 * 3600 + 0.5 * 1.02 * 7200, 0);
  });
  it('vencimento com o jogo fechado: o contratado também (chefe com Cultura de startup paga o triplo até vencer)', async () => {
    await q(`update public.idle_state set generators[13] = 1, generators[19] = 1, strategies = '{0,0,2,-1}', valuation = 1e12 where user_id = $1`, [A]);
    await contratar(B);
    await envelhecerContratos(7, 2);
    await q(`update public.idle_state set valuation = 0, settled_at = now() - interval '3 hours' where user_id = $1`, [B]);
    await t.as(B);
    const b = await t.rpc<Estado>('idle_open');
    expect(b.valuation).toBeCloseTo(0.5 * 1.06 * 3600 + 0.5 * 1.02 * 7200, 0);
    expect(b.chefes).toEqual([]);
  });
  it('não contrata a si mesmo, quem não abriu a empresa, quem não é membro nem ninguém', async () => {
    await dar(A, 1e6);
    await expect(contratar(A)).rejects.toThrow(/idle_hire_self/);
    await expect(contratar(C)).rejects.toThrow(/idle_hire_not_open/);
    await expect(contratar(OUT)).rejects.toThrow(/idle_hire_not_open/);
    await expect(contratar('00000000-0000-0000-0000-000000000123')).rejects.toThrow(/idle_hire_not_open/);
    await expect(contratar(null)).rejects.toThrow(/idle_hire_not_open/);
    expect(await q('select * from public.idle_contracts')).toEqual([]);
  });
  it('sem a própria empresa aberta, sem valuation ou com estratégia pendente: não contrata', async () => {
    await t.as(C);
    await expect(contratar(B)).rejects.toThrow(/idle_not_started/);
    await t.as(A);
    await dar(A, 0);
    await parar(A);
    await expect(contratar(B)).rejects.toThrow(/idle_cant_afford/);
    await q('update public.idle_state set generators[7] = 1, valuation = 1e9 where user_id = $1', [A]);
    await expect(contratar(B)).rejects.toThrow(/idle_strategy_pending/);
    expect(await q('select * from public.idle_contracts')).toEqual([]);
  });
  it('contratar de volta vale (A→B e depois B→A)', async () => {
    await dar(A, 1e6);
    await dar(B, 1e6);
    await contratar(B);
    await t.as(B);
    const b = await contratar(A);
    expect(b.equipe.map((e) => e.user_id)).toEqual([A]);
    expect(b.chefes.map((c) => c.user_id)).toEqual([A]);
    expect(b.social).toEqual({ contratei: 1, empregos: [1] });
  });
  it('ninguém escreve direto nos contratos', async () => {
    await expect(
      t.asRole('authenticated', `insert into public.idle_contracts (employer_id, employee_id, cargo) values ('${A}', '${B}', 'x')`),
    ).rejects.toThrow();
  });
  it('equipe do contrato mais recente pro mais antigo; chefes com o que pagam; social', async () => {
    await abrir(C);
    await dar(A, 1e6);
    await contratar(B);
    expect((await contratar(C)).equipe.map((e) => e.user_id)).toEqual([C, B]);
    await t.as(C);
    await dar(C, 1e6);
    await contratar(A);
    await t.as(A);
    const a = await t.rpc<Estado>('idle_open');
    expect(a.chefes.map((c) => [c.user_id, c.mult])).toEqual([[C, 1]]);
    expect(a.social).toEqual({ contratei: 2, empregos: [1] });
    expect(a.rate).toBeCloseTo(0.5 * (1 + 0.1 * 2 + 0.02), 10);
  });
  it('contratado: o tempo parado até o contrato rende com a regra antiga', async () => {
    // A na era 4 com Cultura de startup: quem A contrata ganha o triplo (+6%)
    await q(`update public.idle_state set generators[13] = 1, generators[19] = 1, strategies = '{0,0,2,-1}', valuation = 1e12 where user_id = $1`, [A]);
    await recuar(B, 1000);
    await contratar(B);
    expect(await valuationDe(B)).toBeCloseTo(10 + 0.5 * 1.02 * 1000, 0);
    await t.as(B);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.06, 10);
  });
  it('Cultura de startup escolhida depois: os contratados fecham a conta antes de ganhar o triplo', async () => {
    await q(`update public.idle_state set generators[13] = 1, strategies = '{0,0,-1,-1}', valuation = 1e12 where user_id = $1`, [A]);
    await contratar(B);
    await q('update public.idle_state set generators[19] = 1 where user_id = $1', [A]);
    await recuar(B, 1000);
    const antes = await valuationDe(B);
    await t.rpc('idle_pick_strategy', { p_era: 4, p_opcao: 2 });
    expect(await valuationDe(B)).toBeCloseTo(antes + 0.5 * 1.02 * 1000, 0);
    await t.as(B);
    expect((await t.rpc<Estado>('idle_open')).rate).toBeCloseTo(0.5 * 1.06, 10);
  });
});
```

- [ ] **Step 6: Paridade com contratos e vencimentos (`games/test/idleParidade.test.ts`)**

Import: troque o import da economia por
`import { acumular, acumularTrechos, custoMult, maxCompra, preco, taxa, type Estado } from '../idle/economia';`.
Acrescente as constantes ao lado de `A`:

```ts
const B = '00000000-0000-0000-0000-00000000000b';
const C = '00000000-0000-0000-0000-00000000000c';
const D = '00000000-0000-0000-0000-00000000000d';
// estratégias dos outros: C escolheu Cultura de startup (paga o triplo a quem contrata)
const OUTROS: [string, number[]][] = [[B, [0, 0, -1, -1]], [C, [0, 0, 2, -1]], [D, [2, -1, -1, -1]]];
const contrato = (de: string, para: string, criado = 'now()', vence = `now() + interval '7 days'`) =>
  q(`insert into public.idle_contracts (employer_id, employee_id, cargo, created_at, ends_at) values ($1, $2, 'x', ${criado}, ${vence})`, [de, para]);
/** Recomeça com A no estado s e os outros três com empresa aberta, sem contrato nenhum. */
async function preparar(s: Estado, extras = '', valores: unknown[] = []) {
  await q('delete from public.idle_contracts where true');
  await q('delete from public.idle_state where true');
  await q(
    `insert into public.idle_state (user_id, week_start, started, generators, upgrades, strategies${extras ? `, ${extras}` : ''})
     values ($1, public.games_week_start(), true, $2, $3, $4${valores.map((_, i) => `, $${i + 5}`).join('')})`,
    [A, s.generators, s.upgrades, s.strategies, ...valores],
  );
  for (const [u, est] of OUTROS) {
    await q(`insert into public.idle_state (user_id, week_start, started, strategies) values ($1, public.games_week_start(), true, $2)`, [u, est]);
  }
}
```

No `beforeAll`, depois de `await t.member(A);`: `for (const u of [B, C, D]) await t.member(u);`

Acrescente como os DOIS ÚLTIMOS testes do `describe('paridade')`:

```ts
  it('taxa com contratos: piso, +10%/+15% por contratado, Networking e chefe com Cultura de startup', async () => {
    const r = rng(99);
    for (const s of estados(30)) {
      await preparar(s);
      const contratei = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      const chefes = OUTROS.filter(() => r() < 0.5).map(([u]) => u);
      for (const u of contratei) await contrato(A, u);
      for (const u of chefes) await contrato(u, A);
      const social = { contratei: contratei.length, empregos: chefes.map((u) => (u === C ? 3 : 1)) };
      const [db] = await q<{ r: number; soc: { contratei: number; empregos: number[] } }>(
        `select public.idle_rate(s) as r, public.idle_json(s) -> 'social' as soc from public.idle_state s where user_id = $1`,
        [A],
      );
      expect(rel(db.r, taxa(catalogo, { ...s, social }))).toBeLessThan(1e-9);
      expect(db.soc.contratei).toBe(social.contratei);
      // o banco multiplica por exp(soma de ln): o 3 da Cultura volta como 3.0000000000000004
      const emp = [...db.soc.empregos].sort();
      const esperado = [...social.empregos].sort();
      expect(emp).toHaveLength(esperado.length);
      emp.forEach((m, i) => expect(m).toBeCloseTo(esperado[i], 12));
    }
  });
  it('fechar a conta atravessando vencimentos (com bônus e teto de 8h)', async () => {
    const T0 = Date.parse('2026-10-12T10:00:00Z');
    const iso = (ms: number) => `'${new Date(ms).toISOString()}'::timestamptz`;
    const s = estados(3)[2];
    await preparar(s, 'valuation, settled_at, boost_until', [1000, new Date(T0).toISOString(), new Date(T0 + 200_000).toISOString()]);
    const criado = iso(T0 - 86400_000);
    await contrato(A, B, criado, iso(T0 + 100_000)); // A contratou B: vence 100 s depois
    await contrato(C, A, criado, iso(T0 + 300_000)); // C (Cultura) contratou A: vence 300 s depois
    await contrato(D, A, criado, iso(T0 + 9 * 3600_000)); // D contratou A: vence depois do teto
    const r = (social: { contratei: number; empregos: number[] }) => taxa(catalogo, { ...s, social });
    const trechos = [
      { desdeMs: T0, r: r({ contratei: 1, empregos: [3, 1] }) },
      { desdeMs: T0 + 100_000, r: r({ contratei: 0, empregos: [3, 1] }) },
      { desdeMs: T0 + 300_000, r: r({ contratei: 0, empregos: [1] }) },
      { desdeMs: T0 + 9 * 3600_000, r: r({ contratei: 0, empregos: [] }) },
    ];
    for (const ate of [T0 + 50_000, T0 + 1000_000, T0 + 10 * 3600_000]) {
      const [db] = await q<{ v: number }>(
        `select (public.idle_settle(s, $2::timestamptz)).valuation as v from public.idle_state s where user_id = $1`,
        [A, new Date(ate).toISOString()],
      );
      expect(rel(db.v, acumularTrechos(1000, trechos, T0, ate, T0 + 200_000))).toBeLessThan(1e-9);
    }
    await q('delete from public.idle_contracts where true');
  });
```

- [ ] **Step 7: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run test/idleGente.test.ts test/idleParidade.test.ts`
Expected: FAIL (`idle_hire` e `idle_contracts` não existem; a taxa do banco ainda sem o piso).

- [ ] **Step 8: Migração 0038, parte 2**

Em `supabase/migrations/0038_fellas_inc_gente.sql`, troque o bloco `create or replace function public.idle_json ... $$;`
(da parte 1, com o comentário de cima) por:

```sql
-- o estado que toda função do jogo devolve: o da 0034 + personagem, equipe (contratos ativos que você fez, do mais
-- recente ao mais antigo), chefes (quem te contratou e quanto paga), social (o que entra na conta), o preço do próximo
-- contrato e muda_em (o próximo vencimento que mexe na sua taxa: a tela bate o ponto de novo nessa hora).
-- plpgsql: as funções que ela chama podem vir depois neste arquivo.
create or replace function public.idle_json(s public.idle_state)
returns jsonb language plpgsql stable set search_path = public as $$
begin
  return jsonb_build_object(
    'user_id', s.user_id, 'week_start', s.week_start, 'started', s.started, 'valuation', s.valuation,
    'rate', public.idle_rate(s), 'generators', to_jsonb(s.generators), 'upgrades', to_jsonb(s.upgrades),
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
    'muda_em', public.idle_next_change(s));
end;
$$;
```

E acrescente no fim do arquivo:

```sql
-- ===== contratos (duram 7 dias; nada apaga: o vencido só deixa de contar) =====

create table if not exists public.idle_contracts (
  id          bigint generated always as identity primary key,
  employer_id uuid not null references public.profiles (id) on delete cascade,
  employee_id uuid not null references public.profiles (id) on delete cascade,
  cargo       text not null,
  created_at  timestamptz not null default now(),
  ends_at     timestamptz not null default now() + interval '7 days',
  check (employer_id <> employee_id),
  check (ends_at > created_at)
);
create index if not exists idle_contracts_employer on public.idle_contracts (employer_id, ends_at);
create index if not exists idle_contracts_employee on public.idle_contracts (employee_id, ends_at);

alter table public.idle_contracts enable row level security;
revoke all on public.idle_contracts from anon, authenticated;
grant select on public.idle_contracts to authenticated;
drop policy if exists "idle_contracts_select_members" on public.idle_contracts;
create policy "idle_contracts_select_members" on public.idle_contracts for select to authenticated using (public.is_member());

-- quanto uma empresa paga a quem ela contratou: ×3 com Cultura de startup, 1 sem estratégia que mexa nisso
create or replace function public.idle_employee_mult(p_employer uuid)
returns double precision language sql stable set search_path = public as $$
  select coalesce((select exp(sum(ln((e.sociais ->> 'empregadoMult')::double precision)))
                     from public.idle_state es
                     join public.idle_cat_est e on e.opcao = es.strategies[e.era - 1]
                    where es.user_id = p_employer and (e.sociais ->> 'empregadoMult') is not null), 1)
$$;

-- multiplicador dos contratos ativos em t (igual a economia.ts multContratos):
-- 1 + efeito × (por_contratado × quantos você contratou + Σ 2% × o que cada empresa que te contratou paga).
-- Ninguém te contratou = piso de freela (2%, como 1 contrato). efeito = ×2 com Networking; por_contratado = 10%
-- (15% com Cultura de startup).
create or replace function public.idle_social_mult(s public.idle_state, t timestamptz)
returns double precision language sql stable set search_path = public as $$
  with est as (
    select e.sociais from public.idle_cat_est e where e.opcao = s.strategies[e.era - 1]
  )
  select 1 + coalesce((select exp(sum(ln((x.sociais ->> 'contratoEfeitoMult')::double precision))) from est x
                        where (x.sociais ->> 'contratoEfeitoMult') is not null), 1)
           * (coalesce((select max((x.sociais ->> 'porContratado')::double precision) from est x
                         where (x.sociais ->> 'porContratado') is not null), 0.1)
                * (select count(*) from public.idle_contracts c
                    where c.employer_id = s.user_id and c.created_at <= t and c.ends_at > t)
              + coalesce((select sum(0.02 * public.idle_employee_mult(c.employer_id)) from public.idle_contracts c
                           where c.employee_id = s.user_id and c.created_at <= t and c.ends_at > t), 0.02))
$$;

-- produção por segundo em t (igual a economia.ts taxa): a da 0034 × o multiplicador dos contratos ativos em t
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
$$;

-- produção por segundo agora (é a que o placar, a foto de segunda e a tela usam)
create or replace function public.idle_rate(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate_at(s, now())
$$;

-- fecha a conta até ts (a da 0034: teto de 8h, ×5 dentro do bônus), agora em trechos: um contrato da pessoa que vence
-- no meio muda a taxa dali pra frente (igual a economia.ts acumularTrechos). Contrato novo e Cultura de startup não
-- precisam de trecho: quem cria fecha a conta dos dois lados antes.
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
  v_fim := least(ts, s.settled_at + interval '8 hours');
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

-- preço do próximo contrato: 30 min da produção atual × 1,5^(contratos ATIVOS que você fez) × 2 com Abrir capital
create or replace function public.idle_hire_price(s public.idle_state)
returns double precision language sql stable set search_path = public as $$
  select public.idle_rate(s) * 1800
       * power(1.5::double precision, (select count(*) from public.idle_contracts c
                                        where c.employer_id = s.user_id and c.created_at <= now() and c.ends_at > now()))
       * coalesce((select exp(sum(ln((e.sociais ->> 'contratoCustoMult')::double precision)))
                     from public.idle_cat_est e
                    where e.opcao = s.strategies[e.era - 1] and (e.sociais ->> 'contratoCustoMult') is not null), 1)
$$;

-- o próximo vencimento que mexe na taxa da pessoa (null = nenhum contrato ativo)
create or replace function public.idle_next_change(s public.idle_state)
returns timestamptz language sql stable set search_path = public as $$
  select min(c.ends_at) from public.idle_contracts c
   where (c.employer_id = s.user_id or c.employee_id = s.user_id) and c.ends_at > now()
$$;

-- trava várias linhas sempre na ordem de user_id: dois fellas se contratando ao mesmo tempo não esperam um pelo
-- outro em círculo
create or replace function public.idle_lock_all(p_users uuid[])
returns void language plpgsql volatile set search_path = public as $$
declare u uuid;
begin
  for u in select distinct x from unnest(p_users) x where x is not null order by 1 loop
    perform public.idle_lock(u);
  end loop;
end;
$$;

-- contratar um amigo que já abriu a empresa: 7 dias, um contrato ativo por par (A→B), sem demissão, cargo sorteado
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
  perform public.idle_save(public.idle_settle(o)); -- o contratado rende até agora com a regra antiga
  select k.nome into v_cargo from public.idle_cat_cargo k order by random() limit 1;
  insert into public.idle_contracts (employer_id, employee_id, cargo, created_at, ends_at)
  values (v_me, p_user, coalesce(v_cargo, 'freela'), now(), now() + interval '7 days');
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

-- escolher a estratégia da era (a da 0034) + Cultura de startup: quem você contratou (contratos ativos) passa a
-- ganhar o triplo, então a conta dele fecha antes, com a regra antiga. Trava você e sua equipe na ordem de user_id.
create or replace function public.idle_pick_strategy(p_era int, p_opcao int)
returns jsonb language plpgsql volatile security definer set search_path = public as $$
declare
  s      public.idle_state;
  x      public.idle_state;
  v_me   uuid := auth.uid();
  v_mult double precision;
begin
  if not public.is_member() then
    raise exception 'not_member' using errcode = '42501';
  end if;
  perform public.idle_lock_all(array[v_me] || coalesce((select array_agg(c.employee_id) from public.idle_contracts c
                                                         where c.employer_id = v_me and c.ends_at > now()), '{}'::uuid[]));
  select * into s from public.idle_state where user_id = v_me;
  if not s.started then
    raise exception 'idle_not_started' using errcode = 'P0001';
  end if;
  if p_era < 2 or p_era > public.idle_era(s.generators) then
    raise exception 'idle_locked' using errcode = 'P0001';
  end if;
  if s.strategies[p_era - 1] >= 0 then
    raise exception 'idle_strategy_set' using errcode = 'P0001';
  end if;
  select coalesce((e.sociais ->> 'empregadoMult')::double precision, 1) into v_mult
    from public.idle_cat_est e
   where e.era = p_era and e.opcao = p_opcao and e.ativa;
  if not found then
    raise exception 'idle_bad_choice' using errcode = 'P0001';
  end if;
  s := public.idle_settle(s); -- o tempo até agora rende com a regra antiga
  if v_mult <> 1 then
    for x in select es.* from public.idle_state es
               join public.idle_contracts c on c.employee_id = es.user_id
              where c.employer_id = v_me and c.ends_at > now() loop
      perform public.idle_save(public.idle_settle(x));
    end loop;
  end if;
  s.strategies[p_era - 1] := p_opcao;
  perform public.idle_save(s);
  return public.idle_json(s);
end;
$$;

revoke all on function public.idle_employee_mult(uuid) from public, anon, authenticated;
revoke all on function public.idle_social_mult(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_rate_at(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_rate(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_settle(public.idle_state, timestamptz) from public, anon, authenticated;
revoke all on function public.idle_hire_price(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_next_change(public.idle_state) from public, anon, authenticated;
revoke all on function public.idle_lock_all(uuid[]) from public, anon, authenticated;
revoke all on function public.idle_hire(uuid) from public, anon;
grant execute on function public.idle_hire(uuid) to authenticated;
revoke all on function public.idle_pick_strategy(int, int) from public, anon;
grant execute on function public.idle_pick_strategy(int, int) to authenticated;
```

- [ ] **Step 9: Testes do núcleo que contavam a taxa sem o piso (`games/test/idle.test.ts`)**

Ninguém contratou ninguém nesses testes, então toda taxa ganha ×1,02. Troque, pelo conteúdo:

- em `'Abrir CNPJ: 1 notebook e R$ 10; abrir de novo é erro'`:
  `expect(s).toMatchObject({ started: true, valuation: 10, rate: 0.5 });` →
  `expect(s).toMatchObject({ started: true, valuation: 10 });` e, logo abaixo, `expect(s.rate).toBeCloseTo(0.5 * 1.02, 12);`
- em `'bater o ponto acumula taxa × tempo'`: `toBeCloseTo(60, 0)` → `toBeCloseTo(10 + 0.51 * 100, 0)`
- em `'teto de 8 horas'`: `10 + 0.5 * 8 * 3600` → `10 + 0.51 * 8 * 3600`
- em `'melhoria de nível 1 dobra o gerador; ...'`: `expect(s.rate).toBeCloseTo(1, 6);` → `expect(s.rate).toBeCloseTo(1.02, 6);`
- em `'só quem abriu a empresa, do maior pro menor R$/s (não pelo valuation)'`:
  `expect(rows[1].rate).toBe(0.5); // só o gerador 1 do Abrir CNPJ` →
  `expect(rows[1].rate).toBeCloseTo(0.5 * 1.02, 12); // só o gerador 1 do Abrir CNPJ, com o piso de freela`
- em `'o pódio conta a produção só até a meia-noite de Brasília'` (describe da foto de segunda): `500 + 0.5 * 3600` →
  `500 + 0.51 * 3600` (o desempate pelo valuation continua: os dois têm a mesma taxa)

- [ ] **Step 10: Rodar tudo de `games/`**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run`
Expected: PASS (inclusive a foto de segunda da 0036, que agora fecha a conta pelo `idle_settle` em trechos).

- [ ] **Step 11: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add supabase/migrations/0038_fellas_inc_gente.sql games/idle/economia.ts games/idle/economia.test.ts games/idle/simulacao.ts games/idle/simulacao.test.ts games/test/idleGente.test.ts games/test/idleParidade.test.ts games/test/idle.test.ts && git commit -m "Fellas Inc.: contratos de 7 dias (idle_hire, piso de freela, vencimento sem retroativo)"
```

---

### Task 4: Placar com gente, "mais disputado" e a foto de segunda com contratos

**Files:**
- Modify: `supabase/migrations/0038_fellas_inc_gente.sql` (acrescenta a parte 3)
- Modify: `games/test/idleGente.test.ts`

**Interfaces:**
- Consome: `idle_board` e `idle_weekly_reset` da **0036** (sem filtro de semana; foto que não apaga nada; pódio e
  placar por R$/s, desempate pelo valuation), `idle_contracts`, `idle_avatar_json`.
- Produz: coluna `idle_weeks.most_hired_id uuid`; interna `idle_most_hired(date) → uuid` (quem recebeu mais contratos
  criados naquela semana, de segunda 00:00 de Brasília até a seguinte; empate = quem chegou primeiro ao número);
  `idle_board()` → `[{ user_id, valuation, rate, era, strategies, avatar, hired_count, by_me, most_hired }]` (mesma
  ordem e mesmo universo da 0036; `hired_count` e `by_me` contam contratos ativos; `most_hired` = semana corrente);
  `idle_weekly_reset()` = a foto da 0036 + `most_hired_id` da semana que acabou. Nada apaga contratos.

- [ ] **Step 1: Testes (acrescentar em `games/test/idleGente.test.ts`)**

```ts
type LinhaPlacar = { user_id: string; rate: number; avatar: Visual | null; hired_count: number; by_me: boolean; most_hired: boolean };
const placar = () => t.rpc<LinhaPlacar[]>('idle_board');
/** Segunda 00:00 de Brasília desta semana, como texto para o SQL. */
const SEGUNDA = `(public.games_week_start()::timestamp at time zone 'America/Sao_Paulo')`;

describe('placar com gente', () => {
  beforeEach(async () => {
    await abrir(A, B, C);
    for (const u of [A, B, C]) await dar(u, 1e9);
  });

  it('cada linha traz o visual, em quantas empresas trabalha, se foi você e o mais disputado', async () => {
    await t.as(B);
    await salvar(V);
    await t.as(A);
    await contratar(B);
    await contratar(C);
    await t.as(C);
    await contratar(B);
    await t.as(A);
    const rows = await placar();
    const de = (u: string) => rows.find((r) => r.user_id === u)!;
    expect(de(B)).toMatchObject({ avatar: V, hired_count: 2, by_me: true, most_hired: true });
    expect(de(C)).toMatchObject({ avatar: null, hired_count: 1, by_me: true, most_hired: false });
    expect(de(A)).toMatchObject({ hired_count: 0, by_me: false, most_hired: false });
  });
  it('continua na ordem do R$/s (a da 0035/0036)', async () => {
    await contratar(B); // A ganha +10%: passa B e C
    const rows = await placar();
    expect(rows[0].user_id).toBe(A);
    for (let i = 1; i < rows.length; i++) expect(rows[i - 1].rate).toBeGreaterThanOrEqual(rows[i].rate);
  });
  it('empate no mais disputado: quem chegou primeiro', async () => {
    await contratar(B);
    await contratar(C);
    await q(`update public.idle_contracts set created_at = now() - interval '1 minute' where employee_id = $1`, [C]);
    expect((await placar()).find((r) => r.most_hired)!.user_id).toBe(C);
  });
  it('mais disputado é da semana: contrato criado na semana passada não conta (mas ainda vale e aparece no "trabalha em")', async () => {
    await contratar(B);
    await q(`update public.idle_contracts set created_at = ${SEGUNDA} - interval '1 day', ends_at = ${SEGUNDA} + interval '6 days' where true`);
    const rows = await placar();
    expect(rows.some((r) => r.most_hired)).toBe(false);
    expect(rows.find((r) => r.user_id === B)).toMatchObject({ hired_count: 1, by_me: true });
  });
  it('contrato vencido sai do "trabalha em" e do "foi você"', async () => {
    await contratar(B);
    await q(`update public.idle_contracts set created_at = created_at - interval '7 days', ends_at = ends_at - interval '7 days' where true`);
    expect((await placar()).find((r) => r.user_id === B)).toMatchObject({ hired_count: 0, by_me: false });
  });
  it('ninguém contratado: ninguém é o mais disputado', async () => {
    expect((await placar()).some((r) => r.most_hired)).toBe(false);
  });
});

// a pessoa chegou na semana anterior (a foto de segunda só conta quem já jogava antes da semana nova)
const envelhecer = () => q('update public.idle_state set week_start = public.games_week_start() - 7 where true');
/** Os contratos foram criados no domingo da semana que acabou (e valem até o domingo que vem). */
const contratosDaSemanaPassada = () =>
  q(`update public.idle_contracts set created_at = ${SEGUNDA} - interval '1 day', ends_at = ${SEGUNDA} + interval '6 days' where true`);

describe('foto de segunda com contratos', () => {
  beforeEach(async () => {
    await abrir(A, B, C);
    for (const u of [A, B, C]) await dar(u, 1e9);
    await salvar(V);
  });

  it('a placa guarda o mais disputado da semana que acabou; contratos, empresas e personagem continuam', async () => {
    await contratar(B);
    await t.as(C);
    await contratar(B);
    await t.as(A);
    await contratosDaSemanaPassada();
    await envelhecer();
    await q('select public.idle_weekly_reset()');
    expect(await q('select most_hired_id from public.idle_weeks')).toEqual([{ most_hired_id: B }]);
    expect(await q('select count(*)::int as n from public.idle_contracts')).toEqual([{ n: 2 }]);
    expect(await q('select count(*)::int as n from public.idle_state where started')).toEqual([{ n: 3 }]);
    expect(await q('select user_id from public.idle_avatar')).toEqual([{ user_id: A }]);
  });
  it('semana sem contrato: placa sem mais disputado', async () => {
    await envelhecer();
    await q('select public.idle_weekly_reset()');
    expect(await q('select most_hired_id from public.idle_weeks')).toEqual([{ most_hired_id: null }]);
  });
  it('quem joga antes do cron: a foto sai igual e o contrato continua valendo', async () => {
    await contratar(B);
    await contratosDaSemanaPassada();
    await envelhecer();
    const s = await t.rpc<Estado>('idle_open');
    expect(s.started).toBe(true);
    expect(s.equipe.map((e) => e.user_id)).toEqual([B]);
    expect(s.avatar).toEqual(V);
    expect(await q('select most_hired_id from public.idle_weeks')).toEqual([{ most_hired_id: B }]);
  });
  it('o pódio da foto conta os contratos que valiam até a meia-noite', async () => {
    await contratar(B);
    await q(`update public.idle_contracts set created_at = ${SEGUNDA} - interval '2 hours', ends_at = ${SEGUNDA} + interval '6 days 22 hours' where true`);
    await envelhecer();
    await q(`update public.idle_state set valuation = 0, settled_at = ${SEGUNDA} - interval '1 hour' where user_id = $1`, [A]);
    await q('select public.idle_weekly_reset()');
    const [semana] = await q<{ podium: { user_id: string; valuation: number }[] }>('select podium from public.idle_weeks');
    expect(semana.podium.find((p) => p.user_id === A)!.valuation).toBeCloseTo(0.5 * 1.12 * 3600, 3);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run test/idleGente.test.ts`
Expected: FAIL (`hired_count` indefinido; `idle_weeks.most_hired_id` não existe).

- [ ] **Step 3: Migração 0038, parte 3 (acrescentar no fim do arquivo)**

```sql
-- ===== placar, "mais disputado" e a foto de segunda =====

alter table public.idle_weeks add column if not exists most_hired_id uuid references public.profiles (id) on delete set null;

-- quem recebeu mais contratos criados na semana que começa em p_week (segunda 00:00 de Brasília); empate = quem chegou
-- primeiro ao número; null = ninguém contratado
create or replace function public.idle_most_hired(p_week date)
returns uuid language sql stable set search_path = public as $$
  select c.employee_id
    from public.idle_contracts c
   where c.created_at >= (p_week::timestamp at time zone 'America/Sao_Paulo')
     and c.created_at < ((p_week + 7)::timestamp at time zone 'America/Sao_Paulo')
   group by c.employee_id
   order by count(*) desc, max(c.created_at), c.employee_id
   limit 1
$$;

-- placar (o da 0036: todo mundo que abriu a empresa, por R$/s, desempate pelo valuation) + visual, em quantas empresas
-- cada um trabalha agora, se você contratou, e o mais disputado da semana
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
             'most_hired', coalesce(x.user_id = v_mais, false)) order by x.rate desc, x.v desc), '[]'::jsonb)
      from (select s.user_id, (public.idle_settle(s)).valuation as v, public.idle_rate(s) as rate,
                   public.idle_era(s.generators) as era, s.strategies,
                   (select count(*) from public.idle_contracts c
                     where c.employee_id = s.user_id and c.created_at <= now() and c.ends_at > now())::int as n,
                   exists (select 1 from public.idle_contracts c
                            where c.employer_id = auth.uid() and c.employee_id = s.user_id
                              and c.created_at <= now() and c.ends_at > now()) as by_me
              from public.idle_state s
             where s.started) x);
end;
$$;

-- foto da semana que acabou (a da 0036, que não apaga nada) + o mais disputado dela na placa
create or replace function public.idle_weekly_reset()
returns void language plpgsql security definer set search_path = public as $$
declare
  v_new    date := public.games_week_start();
  v_old    date := public.games_week_start() - 7;
  v_podium jsonb;
  v_champ  uuid;
  v_gravou date;
begin
  perform pg_advisory_xact_lock(hashtext('fellas-inc-semana')); -- uma foto por vez
  if exists (select 1 from public.idle_weeks where week_start = v_old) then
    return;
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('user_id', x.user_id, 'valuation', x.v, 'rate', x.rate, 'era', x.era,
                                               'strategies', to_jsonb(x.strategies)) order by x.rate desc, x.v desc), '[]')
    into v_podium
    from (select s.user_id,
                 (public.idle_settle(s, greatest(s.settled_at, v_new::timestamp at time zone 'America/Sao_Paulo'))).valuation as v,
                 public.idle_rate(s) as rate, public.idle_era(s.generators) as era, s.strategies
            from public.idle_state s
           where s.started and s.week_start < v_new
           order by 3 desc, 2 desc
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
    end if;
  end if;
end;
$$;

revoke all on function public.idle_most_hired(date) from public, anon, authenticated;
revoke all on function public.idle_weekly_reset() from public, anon, authenticated;
revoke all on function public.idle_board() from public, anon;
grant execute on function public.idle_board() to authenticated;
```

Confira que o corpo de `idle_weekly_reset` é o da 0036 (`git show main:supabase/migrations/0036_fellas_inc_sem_reset.sql`)
com só duas mudanças: a coluna `most_hired_id` no `insert` e o `public.idle_most_hired(v_old)` no `values`.

- [ ] **Step 4: Rodar tudo de `games/`**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run`
Expected: PASS (inclusive os testes de placar e da foto de segunda do núcleo e da 0036).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add supabase/migrations/0038_fellas_inc_gente.sql games/test/idleGente.test.ts && git commit -m "Fellas Inc.: placar com gente e o mais disputado na foto de segunda"
```

---

### Task 5: Chamadas, formatos, erros e o `?mock`

**Files:**
- Modify: `games/shared/types.ts`, `games/shared/api.ts`, `games/shared/errors.ts`, `games/shared/errors.test.ts`
- Create: `games/shared/types.test.ts`
- Modify: `games/dev/mockIdle.ts`
- Modify: `games/idle/store.ts` (+ `vencido`), `games/idle/store.test.ts`, `games/idle/tela.test.ts` (fixtures)

**Interfaces:**
- Consome: o JSON de `idle_json` (Task 3) e de `idle_board` (Task 4); `IdleVisual` (Task 2).
- Produz: `IdleContratado = { user_id; cargo; avatar: IdleVisual | null; ate: string }`, `IdleChefe = { user_id; cargo;
  mult; ate: string }` (`ate` = quando o contrato vence); `IdleState` + `avatar`, `equipe`, `chefes`,
  `social: { contratei: number; empregos: number[] }`, `hire_price`, `muda_em: string | null`; `vencido(estado,
  agoraServidorMs): boolean` (store.ts);
  `IdleBoardRow` + `avatar`, `hiredCount`, `byMe`, `mostHired`; `LinhaPlacar` (linha crua do banco) e
  `linhaPlacar(r, name): IdleBoardRow`; `idleHire(userId): Promise<IdleState>`,
  `idleSetAvatar(v: IdleVisual): Promise<IdleState>` (api.ts e mockIdle.ts com os mesmos nomes); erros
  `idle_hire_self`, `idle_hire_twice`, `idle_hire_not_open`, `idle_bad_avatar`. No `?mock`, `__meContrata()` no console
  faz o primeiro bot te contratar.

- [ ] **Step 1: Testes (`games/shared/types.test.ts` novo e `errors.test.ts`)**

`games/shared/types.test.ts`:

```ts
import { describe, expect, it } from 'vitest';

import { linhaPlacar } from './types';

describe('linhaPlacar', () => {
  it('passa a linha do banco para o formato da tela', () => {
    const v = { pele: 1, cabelo: 2, cor_cabelo: 3, roupa: 1, cor_roupa: 4, acessorio: 0, cor_acessorio: 0 };
    expect(
      linhaPlacar(
        { user_id: 'b', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hired_count: 3, by_me: true, most_hired: true },
        'Bia',
      ),
    ).toEqual({ userId: 'b', name: 'Bia', valuation: 10, rate: 2, era: 2, strategies: [0, -1, -1, -1], avatar: v, hiredCount: 3, byMe: true, mostHired: true });
  });
});
```

Em `games/shared/errors.test.ts`, no `it.each` de `'erros da Fellas Inc.'`, acrescente as linhas:

```ts
    ['idle_hire_self', 'Não dá pra se contratar'],
    ['idle_hire_twice', 'Essa pessoa já trabalha pra você'],
    ['idle_hire_not_open', 'Essa pessoa ainda não abriu a empresa'],
    ['idle_bad_avatar', 'Esse visual não existe'],
```

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run shared/`
Expected: FAIL (`linhaPlacar` não existe; códigos novos viram `unknown`).

- [ ] **Step 2: `games/shared/types.ts`**

Troque o `export type IdleState = {...}` e o `export type IdleBoardRow = ...` por:

```ts
export type IdleState = {
  user_id: string; week_start: string; started: boolean; valuation: number; rate: number;
  generators: number[]; upgrades: number[]; strategies: number[]; era: number;
  boost_until: string | null; half_price: boolean; opp_claimed: number[]; opp_left: number; server_now: string;
  /** Entrega 2 (0038): seu visual (null = nunca salvou), quem você contratou (contratos ativos, do mais recente ao
   *  mais antigo), quem te contratou, o que entra na conta dos contratos, o preço do próximo contrato e o próximo
   *  vencimento que muda a sua taxa (null = nenhum). */
  avatar: IdleVisual | null; equipe: IdleContratado[]; chefes: IdleChefe[];
  social: { contratei: number; empregos: number[] }; hire_price: number; muda_em: string | null;
};
export type IdleContratado = { user_id: string; cargo: string; avatar: IdleVisual | null; ate: string };
export type IdleChefe = { user_id: string; cargo: string; mult: number; ate: string };
export type IdleBoardRow = {
  userId: string; name: string; valuation: number; rate: number; era: number; strategies: number[];
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

- [ ] **Step 3: `games/shared/errors.ts`**

No tipo `GameErrorCode`, depois de `| 'idle_opp_cap'`, acrescente
`| 'idle_hire_self' | 'idle_hire_twice' | 'idle_hire_not_open' | 'idle_bad_avatar'`. Em `ERROR_TEXT`, depois de
`idle_opp_cap: ...`:

```ts
  idle_hire_self: 'Não dá pra se contratar',
  idle_hire_twice: 'Essa pessoa já trabalha pra você',
  idle_hire_not_open: 'Essa pessoa ainda não abriu a empresa',
  idle_bad_avatar: 'Esse visual não existe',
```

Em `FROM_DB`, depois de `'idle_opp_cap',`: `'idle_hire_self', 'idle_hire_twice', 'idle_hire_not_open', 'idle_bad_avatar',`
(nenhum código antigo é pedaço de um novo, então a busca por `includes` não confunde).

- [ ] **Step 4: `games/shared/api.ts`**

No import de `./types`, acrescente `IdleVisual` e `LinhaPlacar` (tipos) e importe o valor:
`import { linhaPlacar } from './types';`. Depois de `idleClaim`, acrescente:

```ts
export const idleHire = (userId: string) => rpc<IdleState>('idle_hire', { p_user: userId });
export const idleSetAvatar = (v: IdleVisual) =>
  rpc<IdleState>('idle_set_avatar', {
    p_pele: v.pele, p_cabelo: v.cabelo, p_cor_cabelo: v.cor_cabelo, p_roupa: v.roupa, p_cor_roupa: v.cor_roupa,
    p_acessorio: v.acessorio, p_cor_acessorio: v.cor_acessorio,
  });
```

E troque `idleBoard` por:

```ts
export async function idleBoard(): Promise<IdleBoardRow[]> {
  const rows = await rpc<LinhaPlacar[]>('idle_board');
  const quem = await fellas(rows.map((r) => r.user_id));
  return rows.map((r) => linhaPlacar(r, quem.find((f) => f.id === r.user_id)?.name ?? 'Alguém'));
}
```

- [ ] **Step 5: `games/dev/mockIdle.ts` (arquivo inteiro)**

```ts
// Só no dev (?mock): a Fellas Inc. contra as migrações rodando no navegador (dev/mockDb.ts). Mesmos nomes e
// formatos de shared/api.ts. Os bots abrem a empresa e têm personagem (dá pra contratar). Nunca entra no build.
import { linhaPlacar, type IdleBoardRow, type IdleState, type IdleVisual, type LinhaPlacar } from '../shared/types';
import { call, FRIENDS, ME } from './mockDb';

// visuais dos bots (ninguém real): Oliveira, Bia, Teteu
const VISUAIS: IdleVisual[] = [
  { pele: 1, cabelo: 3, cor_cabelo: 0, roupa: 1, cor_roupa: 6, acessorio: 1, cor_acessorio: 3 },
  { pele: 4, cabelo: 4, cor_cabelo: 7, roupa: 3, cor_roupa: 8, acessorio: 3, cor_acessorio: 0 },
  { pele: 2, cabelo: 1, cor_cabelo: 1, roupa: 2, cor_roupa: 1, acessorio: 0, cor_acessorio: 0 },
];
const avatar = (v: IdleVisual, as?: string) =>
  call<IdleState>(
    'select public.idle_set_avatar($1, $2, $3, $4, $5, $6, $7) as v',
    [v.pele, v.cabelo, v.cor_cabelo, v.roupa, v.cor_roupa, v.acessorio, v.cor_acessorio],
    as,
  );

const bots = (async () => {
  for (const [i, [id]] of FRIENDS.entries()) {
    await call('select public.idle_start() as v', [], id).catch(() => undefined);
    await avatar(VISUAIS[i % VISUAIS.length], id).catch(() => undefined);
  }
})();

export const idleOpen = () => call<IdleState>('select public.idle_open() as v');
export const idleStart = () => call<IdleState>('select public.idle_start() as v');
export const idleBuy = (kind: 'gerador' | 'melhoria', id: number, qty: 0 | 1 | 10 = 1) =>
  call<IdleState>('select public.idle_buy($1, $2, $3) as v', [kind, id, qty]);
export const idlePickStrategy = (era: number, opcao: number) => call<IdleState>('select public.idle_pick_strategy($1, $2) as v', [era, opcao]);
export const idleClaim = (window: number) => call<IdleState>('select public.idle_claim_opportunity($1) as v', [window]);
export const idleHire = (userId: string) => call<IdleState>('select public.idle_hire($1) as v', [userId]);
export const idleSetAvatar = (v: IdleVisual) => avatar(v);
export const hasSession = async () => true;
export const myId = async () => ME;

export async function idleBoard(): Promise<IdleBoardRow[]> {
  await bots;
  const rows = await call<LinhaPlacar[]>('select public.idle_board() as v');
  const names = await call<{ id: string; name: string }[]>(
    `select coalesce(jsonb_agg(jsonb_build_object('id', id, 'name', display_name)), '[]') as v from public.profiles`,
  );
  return rows.map((r) => linhaPlacar(r, names.find((n) => n.id === r.user_id)?.name ?? 'Alguém'));
}

// console do dev: __rico(1e12) põe valuation na sua empresa; __meContrata() faz o primeiro bot te contratar
const w = window as unknown as { __rico: (v: number) => Promise<void>; __meContrata: () => Promise<void> };
w.__rico = async (v) => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await db.query('update public.idle_state set valuation = $2 where user_id = $1', [ME, v]);
};
w.__meContrata = async () => {
  const { ready } = await import('./mockDb');
  const db = await ready;
  await bots;
  const [bot] = FRIENDS[0];
  await db.query('update public.idle_state set valuation = 1e15 where user_id = $1', [bot]);
  await call('select public.idle_hire($1) as v', [ME], bot);
};
```

- [ ] **Step 6: Fixtures dos testes da página**

`games/idle/tela.test.ts`, na função `estado`, antes de `...x`, acrescente
`avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,`. No teste
`'placar mostra o R$/s de cada um, não o valuation'`, a linha do placar ganha
`avatar: null, hiredCount: 0, byMe: false, mostHired: false`.

`games/idle/store.test.ts`, na função `base`, antes de `...x`, acrescente o mesmo
`avatar: null, equipe: [], chefes: [], social: { contratei: 0, empregos: [] }, hire_price: 0, muda_em: null,`.

- [ ] **Step 6b: Vencimento na tela (`games/idle/store.ts`)**

Teste (em `games/idle/store.test.ts`; acrescente `vencido` ao import de `./store`):

```ts
describe('vencimento de contrato', () => {
  it('bate o ponto quando o relógio do servidor passa de muda_em', () => {
    expect(vencido(base(), Date.parse('2026-10-20T00:00:00Z'))).toBe(false);
    const s = base({ muda_em: '2026-10-19T12:00:00.000Z' });
    expect(vencido(s, Date.parse('2026-10-19T11:59:59Z'))).toBe(false);
    expect(vencido(s, Date.parse('2026-10-19T12:00:00Z'))).toBe(true);
  });
});
```

E em `games/idle/store.ts`, no fim:

```ts
/** Um contrato seu venceu (o relógio do servidor passou de muda_em): a taxa mudou e a tela precisa bater o ponto. */
export const vencido = (estado: IdleState, agoraServidorMs: number): boolean =>
  estado.muda_em !== null && agoraServidorMs >= Date.parse(estado.muda_em);
```

- [ ] **Step 7: Rodar tudo de `games/`**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add games/shared/types.ts games/shared/types.test.ts games/shared/api.ts games/shared/errors.ts games/shared/errors.test.ts games/dev/mockIdle.ts games/idle/tela.test.ts games/idle/store.ts games/idle/store.test.ts && git commit -m "Fellas Inc.: chamadas e formatos de contratar e do personagem; bots com visual no ?mock"
```

---

### Task 6: Cenas com gente: montagem, ativos em camadas e palco

**Files:**
- Create: `games/idle/montagem.ts`, `games/idle/montagem.test.ts`, `games/idle/navegador.ts`
- Modify: `games/idle/ativos.ts`, `games/idle/ativos.test.ts`, `games/idle/palco.ts`, `games/idle/palco.test.ts`
- Modify: `games/idle/main.ts` (uma linha: o palco recebe as camadas e o kit)

**Interfaces:**
- Consome: `Imagem`, `vazia`, `recortar`, `colar` (imagem.ts); `Visual`, `PADRAO`, `chave`, `trocarCores`, `valido`
  (personagem.ts); o "Contrato de formato da arte".
- Produz (montagem.ts): `type Pose = 1|2|3|4|5|6`, `POSES`, `QUADROS_POSE = 4`, `LINHAS_KIT = 16`, `linhaCabelo(k)`,
  `linhaRoupa(k)`, `linhaAcessorio(k)`, `LARGURA_CENA = 160`, `ALTURA_CENA = 96`, `CADEIRA = { w: 24, h: 30, x: 4, y: 2 }`,
  `type Kit = { poses: Record<Pose, Imagem>; estagiario: Partial<Record<Pose, Imagem>> }`, `type Posicao`, `type Vaga`,
  `type Vagas`, `type Ocupante`, `type Ocupada`, `VAGAS_CONTRATADO: Record<NomeCena, number | null>`,
  `boneco(kit, v, pose, quadro): Imagem`, `naCadeira(kit, cadeira, v): Imagem`, `ocuparVagas(vagas, dono, equipe)`,
  `posicaoNoQuadro(vaga, f)`, `montarTira({ fundo, frente, vagas }, gente, kit | null): Imagem`,
  `validarVagas(json, quadros, contratados): string[]`.
- Produz (navegador.ts, só navegador): `carregarImagem(url): Promise<Imagem>`, `pintar(canvas, img)`,
  `carregarKit(): Promise<Kit | null>` (null = arte do kit ainda não existe), `type Desenhar = (canvas, v, opcoes?: {
  pose?: Pose; cadeira?: boolean }) => void`, `criarDesenhista(kit, cadeira): Desenhar`.
- Produz (ativos.ts): `type Camadas = { fundo: string; frente: string | null; vagas: Vagas | null }`,
  `ativos.camadas(nome)` (sem a arte nova: `{ fundo: <tira antiga>, frente: null, vagas: null }`), `ativos.pose(p)`,
  `ativos.estagiario(p)`, `ativos.cadeira()` (URLs ou `null`). `ativos.cenas` sai.
- Produz (palco.ts): `type Gente = { dono: Visual; equipe: Visual[] }`, `chaveGente(g)`,
  `criarPalco(canvas, camadas: (nome) => Camadas, kit: Promise<Kit | null>)` → `{ tocar, parar, gente(g), preparar(nomes) }`.

- [ ] **Step 1: Teste da montagem (`games/idle/montagem.test.ts`)**

```ts
import { describe, expect, it } from 'vitest';

import { colar, recortar, vazia, type Imagem } from './imagem';
import {
  boneco, CADEIRA, linhaAcessorio, linhaCabelo, linhaRoupa, LINHAS_KIT, montarTira, naCadeira, ocuparVagas,
  posicaoNoQuadro, POSES, QUADROS_POSE, validarVagas, type Kit, type Pose, type Vaga, type Vagas,
} from './montagem';
import { CORES, CORES_CABELO, MARCADORES, PADRAO, PELES, type Visual } from './personagem';

const PRETO = '#0B0A0E';
const rgba = (h: string) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16), 255];
const pinta = (img: Imagem, x: number, y: number, h: string) => img.d.set(rgba(h), (y * img.w + x) * 4);
const cor = (img: Imagem, x: number, y: number): string | null => {
  const i = (y * img.w + x) * 4;
  if (!img.d[i + 3]) return null;
  return `#${[0, 1, 2].map((k) => img.d[i + k].toString(16).padStart(2, '0')).join('').toUpperCase()}`;
};
const cheia = (w: number, h: number, c: string) => {
  const img = vazia(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) pinta(img, x, y, c);
  return img;
};

/**
 * Kit de mentira. Em cada célula (quadro q, linha l):
 *  corpo: (0,0) no tom do meio da pele e (q, h-1) preto (diz o quadro);
 *  cabelo k: (1,0) e (1,1+k); roupa k: (2,0) e (2,1+k); acessório k: (3,0) e (3,1+k), no tom do meio do marcador;
 *  e toda peça (menos o corpo) pinta também (0,2), para provar quem fica por cima.
 */
function kitFalso(): Kit {
  const poses = {} as Record<Pose, Imagem>;
  for (const p of [1, 2, 3, 4, 5, 6] as Pose[]) {
    const { w, h } = POSES[p];
    const folha = vazia(QUADROS_POSE * w, LINHAS_KIT * h);
    for (let q = 0; q < QUADROS_POSE; q++) {
      const em = (l: number, x: number, y: number, c: string) => pinta(folha, q * w + x, l * h + y, c);
      em(0, 0, 0, MARCADORES.pele[1]);
      em(0, q, h - 1, PRETO);
      for (let k = 0; k < 6; k++) for (const [x, y] of [[1, 0], [1, 1 + k], [0, 2]]) em(linhaCabelo(k), x, y, MARCADORES.cabelo[1]);
      for (let k = 0; k < 4; k++) for (const [x, y] of [[2, 0], [2, 1 + k], [0, 2]]) em(linhaRoupa(k), x, y, MARCADORES.roupa[1]);
      for (let k = 1; k < 6; k++) for (const [x, y] of [[3, 0], [3, 1 + k], [0, 2]]) em(linhaAcessorio(k), x, y, MARCADORES.acessorio[1]);
    }
    poses[p] = folha;
  }
  return { poses, estagiario: { 3: cheia(QUADROS_POSE * POSES[3].w, POSES[3].h, '#FF5A6E') } };
}
const V: Visual = { pele: 0, cabelo: 2, cor_cabelo: 5, roupa: 3, cor_roupa: 6, acessorio: 4, cor_acessorio: 9 };
const vaga = (id: string, papel: 'dono' | 'contratado', freela?: Visual | 'estagiario', x = 0, y = 0, pose: Pose = 5): Vaga =>
  ({ id, papel, freela, x, y, pose, espelhada: false });

describe('imagem', () => {
  it('colar: transparente não pinta, espelha e corta na borda', () => {
    const src = vazia(3, 1);
    pinta(src, 0, 0, '#111111');
    pinta(src, 2, 0, '#222222');
    const d = cheia(4, 1, '#FFFFFF');
    colar(d, src, 0, 0);
    expect([cor(d, 0, 0), cor(d, 1, 0), cor(d, 2, 0)]).toEqual(['#111111', '#FFFFFF', '#222222']);
    const e = cheia(4, 1, '#FFFFFF');
    colar(e, src, 2, 0, true); // espelhado: #222222 cai em x=2 e #111111 em x=4 (fora)
    expect([cor(e, 2, 0), cor(e, 3, 0)]).toEqual(['#222222', '#FFFFFF']);
  });
  it('recortar fora da imagem dá transparente', () => {
    expect(cor(recortar(cheia(2, 2, '#FFFFFF'), 1, 1, 2, 2), 1, 1)).toBeNull();
  });
});

describe('boneco', () => {
  it('corpo, roupa, cabelo e acessório, nessa ordem, com as cores do visual', () => {
    const b = boneco(kitFalso(), V, 1, 0);
    expect([b.w, b.h]).toEqual([16, 22]);
    expect(cor(b, 0, 0)).toBe(PELES[0][1]);
    expect(cor(b, 1, 3)).toBe(CORES_CABELO[5][1]); // cabelo 2
    expect(cor(b, 2, 4)).toBe(CORES[6][1]); // roupa 3
    expect(cor(b, 3, 5)).toBe(CORES[9][1]); // acessório 4
    expect(cor(b, 1, 2)).toBeNull(); // cabelo 1 não foi escolhido
    expect(cor(b, 0, 2)).toBe(CORES[9][1]); // o acessório fica por cima de tudo
  });
  it('sem acessório a linha dele não entra; cabelo fica por cima da roupa', () => {
    const b = boneco(kitFalso(), { ...V, acessorio: 0 }, 1, 0);
    expect(cor(b, 3, 0)).toBeNull();
    expect(cor(b, 0, 2)).toBe(CORES_CABELO[5][1]);
  });
  it('quadro da pose = quadro da cena % 4', () => {
    const b = boneco(kitFalso(), V, 5, 6);
    expect(cor(b, 2, POSES[5].h - 1)).toBe(PRETO);
    expect(cor(b, 0, POSES[5].h - 1)).toBeNull();
  });
  it('naCadeira: a pose 1 em (4,2) e a cadeira por cima', () => {
    const cadeira = vazia(CADEIRA.w, CADEIRA.h);
    pinta(cadeira, CADEIRA.x, CADEIRA.y, '#8E8A96');
    const img = naCadeira(kitFalso(), cadeira, V);
    expect([img.w, img.h]).toEqual([24, 30]);
    expect(cor(img, CADEIRA.x, CADEIRA.y)).toBe('#8E8A96');
    expect(cor(img, CADEIRA.x + 1, CADEIRA.y)).toBe(CORES_CABELO[5][1]);
  });
});

describe('vagas', () => {
  it('dono na vaga de dono; contratados do mais recente pro mais antigo, na ordem do JSON; sobra = freela', () => {
    const F: Visual = { ...PADRAO, pele: 5 };
    const v: Vagas = { quadros: 8, vagas: [vaga('a', 'contratado', F), vaga('voce', 'dono'), vaga('b', 'contratado', 'estagiario'), vaga('c', 'contratado', F)] };
    const E1 = { ...PADRAO, roupa: 1 };
    const E2 = { ...PADRAO, roupa: 2 };
    expect(ocuparVagas(v, PADRAO, [E1, E2]).map((o) => [o.vaga.id, o.quem])).toEqual([
      ['a', { visual: E1 }], ['voce', { visual: PADRAO }], ['b', { visual: E2 }], ['c', { visual: F }],
    ]);
    expect(ocuparVagas(v, PADRAO, []).map((o) => o.quem)).toEqual([{ visual: F }, { visual: PADRAO }, { estagiario: true }, { visual: F }]);
    expect(ocuparVagas(v, PADRAO, [E1, E2, E1, E2]).filter((o) => o.vaga.papel === 'contratado')).toHaveLength(3);
  });
  it('trilha muda a posição por quadro; null some', () => {
    const v: Vaga = { ...vaga('voce', 'dono'), trilha: [null, { x: 5, pose: 1 }, {}] };
    expect(posicaoNoQuadro(v, 0)).toBeNull();
    expect(posicaoNoQuadro(v, 1)).toEqual({ x: 5, y: 0, pose: 1, espelhada: false });
    expect(posicaoNoQuadro(v, 2)).toEqual({ x: 0, y: 0, pose: 5, espelhada: false });
    expect(posicaoNoQuadro({ ...v, trilha: undefined }, 7)).toEqual({ x: 0, y: 0, pose: 5, espelhada: false });
  });
});

describe('montarTira', () => {
  const fundo = () => {
    const f = vazia(2 * 160, 96);
    for (let y = 0; y < 96; y++) for (let x = 0; x < 320; x++) pinta(f, x, y, x < 160 ? '#121212' : '#222222');
    return f;
  };
  const so = (vagas: Vaga[]): Vagas => ({ quadros: 2, vagas });

  it('fundo, pessoa com as cores dela e frente por cima, quadro a quadro', () => {
    const vg = so([vaga('voce', 'dono', undefined, 10, 10)]);
    const frente = vazia(320, 96);
    pinta(frente, 160 + 10, 10, '#FFFFFF');
    const t = montarTira({ fundo: fundo(), frente, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect([t.w, t.h]).toEqual([320, 96]);
    expect(cor(t, 10, 10)).toBe(PELES[0][1]);
    expect(cor(t, 9, 10)).toBe('#121212');
    expect(cor(t, 170, 10)).toBe('#FFFFFF'); // quadro 1: a frente cobre a pessoa
    expect(cor(t, 171, 10)).toBe(CORES_CABELO[5][1]); // o resto da pessoa continua
    expect(cor(t, 10, 22)).toBe(PRETO); // quadro 0 da pose em (0, h-1)
    expect(cor(t, 171, 22)).toBe(PRETO); // quadro 1 da pose em (1, h-1)
    expect(cor(t, 170, 22)).toBe('#222222');
  });
  it('espelhada: o pixel da esquerda vai pra direita', () => {
    const vg = so([{ ...vaga('voce', 'dono', undefined, 10, 10), espelhada: true }]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect(cor(t, 10 + POSES[5].w - 1, 10)).toBe(PELES[0][1]);
    expect(cor(t, 10, 10)).toBe('#121212');
  });
  it('quem tem o pé mais baixo na tela fica na frente (não a ordem do JSON); nada vaza pro quadro do lado', () => {
    const atras = vaga('atras', 'contratado', { ...V, pele: 5 }, 20, 10); // pé em 10 + 13
    const naFrente = vaga('frente', 'contratado', { ...V, pele: 1 }, 20, 12); // pé em 12 + 13
    const borda = { ...vaga('voce', 'dono', undefined, 155, 40), espelhada: true }; // a pele cairia em x = 163
    const vg = so([naFrente, atras, borda]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect(cor(t, 20, 12)).toBe(PELES[1][1]); // o (0,0) de "frente" cobre o (0,2) de "atras"
    expect(cor(t, 163, 40)).toBe('#222222');
  });
  it('sem o kit (arte não carregou): só fundo e frente', () => {
    const vg = so([vaga('voce', 'dono', undefined, 10, 10)]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), null);
    expect(cor(t, 10, 10)).toBe('#121212');
  });
  it('estagiário oficial usa a folha dele; pose sem folha não desenha nada', () => {
    const vg = so([vaga('voce', 'dono', undefined, 0, 0), vaga('e', 'contratado', 'estagiario', 30, 10, 3), vaga('e2', 'contratado', 'estagiario', 60, 10, 4)]);
    const t = montarTira({ fundo: fundo(), frente: null, vagas: vg }, ocuparVagas(vg, V, []), kitFalso());
    expect(cor(t, 30, 10)).toBe('#FF5A6E');
    expect(cor(t, 60, 10)).toBe('#121212');
  });
});

describe('validarVagas', () => {
  const ok: Vagas = {
    quadros: 8,
    vagas: [
      { id: 'voce', papel: 'dono', pose: 1, x: 60, y: 40, espelhada: false },
      { id: 'estagiario', papel: 'contratado', pose: 3, x: 20, y: 50, espelhada: true, freela: 'estagiario' },
    ],
  };
  it('JSON certo: sem erro', () => expect(validarVagas(ok, 8, 1)).toEqual([]));
  it('acusa o que quebraria a montagem', () => {
    expect(validarVagas(ok, 12, 1)).toContain('quadros 8 ≠ 12');
    expect(validarVagas(ok, 8, 3)).toContain('1 vagas de contratado (precisa de 3)');
    expect(validarVagas({ ...ok, vagas: [ok.vagas[1]] }, 8, 1)).toContain('0 vagas de dono (precisa de 1)');
    expect(validarVagas({ ...ok, vagas: [ok.vagas[0], { ...ok.vagas[1], freela: undefined }] }, 8, 1)).toContain('estagiario: vaga de contratado sem freela');
    expect(validarVagas({ ...ok, vagas: [{ ...ok.vagas[0], x: 150 }, ok.vagas[1]] }, 8, 1)).toContain('voce: fora da cena no quadro 0');
    expect(validarVagas({ ...ok, vagas: [{ ...ok.vagas[0], trilha: [null] }, ok.vagas[1]] }, 8, 1)).toContain('voce: trilha com 1 quadros');
    expect(validarVagas({ ...ok, vagas: [ok.vagas[0], { ...ok.vagas[1], freela: { ...PADRAO, pele: 9 } }] }, 8, 1)).toContain('estagiario: freela com visual inválido');
    expect(validarVagas(null, 8, 1)).toEqual(['sem lista de vagas']);
  });
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/montagem.test.ts`
Expected: FAIL (`./montagem` não existe).

- [ ] **Step 3: `games/idle/montagem.ts`**

```ts
// Montagem das cenas com gente: fundo → pessoas → frente, quadro a quadro, em bytes (sem canvas). O palco chama isto
// uma vez por (cena, gente) e guarda a tira pronta. Formato dos arquivos: "Contrato de formato da arte" no plano da
// entrega 2 (docs/superpowers/plans/2026-10-10-fellas-inc-gente.md).
import { colar, recortar, vazia, type Imagem } from './imagem';
import type { NomeCena } from './palco';
import { trocarCores, valido, type Visual } from './personagem';

export type Pose = 1 | 2 | 3 | 4 | 5 | 6;
/** Caixa de cada pose: 1 sentado de costas, 2 em pé de costas, 3 em pé de perfil, 4 sentado de perfil, 5 de frente,
 *  6 deitado (só cabeça e ombro). */
export const POSES: Record<Pose, { w: number; h: number }> = {
  1: { w: 16, h: 22 }, 2: { w: 14, h: 26 }, 3: { w: 12, h: 24 }, 4: { w: 14, h: 20 }, 5: { w: 9, h: 13 }, 6: { w: 16, h: 10 },
};
/** A folha de cada pose: 4 colunas de quadros × 16 linhas de peças. */
export const QUADROS_POSE = 4;
export const LINHAS_KIT = 16;
/** Linha 0 corpo; 1–6 cabelo; 7–10 roupa; 11–15 acessório 1–5 (o 0, "nada", não tem linha). */
export const linhaCabelo = (k: number) => 1 + k;
export const linhaRoupa = (k: number) => 7 + k;
export const linhaAcessorio = (k: number) => 10 + k;
export const LARGURA_CENA = 160;
export const ALTURA_CENA = 96;
/** Prévia do editor: a pose 1 em (x, y) e a cadeira (assets/pessoas/cadeira.png) por cima. */
export const CADEIRA = { w: 24, h: 30, x: 4, y: 2 } as const;

export type Kit = { poses: Record<Pose, Imagem>; estagiario: Partial<Record<Pose, Imagem>> };
export type Posicao = { x: number; y: number; pose: Pose; espelhada: boolean };
export type Vaga = Posicao & {
  id: string; papel: 'dono' | 'contratado'; freela?: Visual | 'estagiario'; trilha?: (Partial<Posicao> | null)[];
};
export type Vagas = { quadros: number; vagas: Vaga[] };
export type Ocupante = { visual: Visual } | { estagiario: true };
export type Ocupada = { vaga: Vaga; quem: Ocupante };

/** Quantas vagas de contratado cada cena tem (spec 7.3); null = a cena 6 decide no desenho (até 5). */
export const VAGAS_CONTRATADO: Record<NomeCena, number | null> = {
  'cena-0-antes': 0, 'cena-0-abrindo': 0, 'cena-1': 0, 'cena-2': 1, 'cena-3': 3, 'cena-4': 5, 'cena-5': 4, 'cena-6': null,
};

/** O boneco de um visual numa pose e quadro: corpo → roupa → cabelo → acessório, depois as cores. */
export function boneco(kit: Kit, v: Visual, pose: Pose, quadro: number): Imagem {
  const { w, h } = POSES[pose];
  const folha = kit.poses[pose];
  const q = quadro % QUADROS_POSE;
  const out = vazia(w, h);
  const linhas = [0, linhaRoupa(v.roupa), linhaCabelo(v.cabelo)];
  if (v.acessorio > 0) linhas.push(linhaAcessorio(v.acessorio));
  for (const l of linhas) colar(out, recortar(folha, q * w, l * h, w, h), 0, 0);
  return trocarCores(out, v);
}

export function naCadeira(kit: Kit, cadeira: Imagem, v: Visual): Imagem {
  const out = vazia(CADEIRA.w, CADEIRA.h);
  colar(out, boneco(kit, v, 1, 0), CADEIRA.x, CADEIRA.y);
  colar(out, cadeira, 0, 0);
  return out;
}

/** Quem fica em cada vaga: você na de dono; a equipe (contrato mais recente primeiro) nas de contratado, na ordem do
 *  JSON; vaga sobrando fica com o freela dela. */
export function ocuparVagas(v: Vagas, dono: Visual, equipe: Visual[]): Ocupada[] {
  const out: Ocupada[] = [];
  let i = 0;
  for (const vaga of v.vagas) {
    if (vaga.papel === 'dono') out.push({ vaga, quem: { visual: dono } });
    else if (i < equipe.length) out.push({ vaga, quem: { visual: equipe[i++] } });
    else if (vaga.freela === 'estagiario') out.push({ vaga, quem: { estagiario: true } });
    else if (vaga.freela) out.push({ vaga, quem: { visual: vaga.freela } });
  }
  return out;
}

/** Onde a vaga está no quadro f (a trilha muda por quadro; null = some). */
export function posicaoNoQuadro(vaga: Vaga, f: number): Posicao | null {
  const base: Posicao = { x: vaga.x, y: vaga.y, pose: vaga.pose, espelhada: vaga.espelhada };
  if (!vaga.trilha) return base;
  const t = vaga.trilha[f % vaga.trilha.length];
  return t === null ? null : { ...base, ...t };
}

function sprite(kit: Kit, quem: Ocupante, pose: Pose, quadro: number): Imagem | null {
  if ('visual' in quem) return boneco(kit, quem.visual, pose, quadro);
  const folha = kit.estagiario[pose];
  if (!folha) return null;
  const { w, h } = POSES[pose];
  return recortar(folha, (quadro % QUADROS_POSE) * w, 0, w, h);
}

/** A tira pronta (quadros × 160 por 96). Sem kit (arte não carregou), só fundo e frente. */
export function montarTira(c: { fundo: Imagem; frente: Imagem | null; vagas: Vagas }, gente: Ocupada[], kit: Kit | null): Imagem {
  const n = c.vagas.quadros;
  const tira = vazia(n * LARGURA_CENA, ALTURA_CENA);
  for (let f = 0; f < n; f++) {
    const quadro = recortar(c.fundo, f * LARGURA_CENA, 0, LARGURA_CENA, ALTURA_CENA);
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

/** Erros do JSON de vagas (lista vazia = ok). `contratados`: quantas vagas de contratado a cena precisa (null = livre). */
export function validarVagas(x: unknown, quadros: number, contratados: number | null): string[] {
  const v = x as Vagas | null;
  if (!v || typeof v !== 'object' || !Array.isArray(v.vagas)) return ['sem lista de vagas'];
  const erros: string[] = [];
  if (v.quadros !== quadros) erros.push(`quadros ${v.quadros} ≠ ${quadros}`);
  const donos = v.vagas.filter((g) => g.papel === 'dono').length;
  if (donos !== 1) erros.push(`${donos} vagas de dono (precisa de 1)`);
  const n = v.vagas.filter((g) => g.papel === 'contratado').length;
  if (contratados !== null && n !== contratados) erros.push(`${n} vagas de contratado (precisa de ${contratados})`);
  const ids = new Set<string>();
  for (const g of v.vagas) {
    if (typeof g.id !== 'string' || !g.id || ids.has(g.id)) erros.push(`id repetido ou vazio: ${g.id}`);
    ids.add(g.id);
    if (g.papel !== 'dono' && g.papel !== 'contratado') erros.push(`${g.id}: papel ${g.papel}`);
    if (g.papel === 'contratado' && !g.freela) erros.push(`${g.id}: vaga de contratado sem freela`);
    if (g.freela && g.freela !== 'estagiario' && !valido(g.freela)) erros.push(`${g.id}: freela com visual inválido`);
    if (g.trilha && g.trilha.length !== quadros) erros.push(`${g.id}: trilha com ${g.trilha.length} quadros`);
    for (let f = 0; f < quadros; f++) {
      const p = posicaoNoQuadro(g, f);
      if (!p) continue;
      if (!(p.pose in POSES)) {
        erros.push(`${g.id}: pose ${p.pose}`);
        continue;
      }
      const { w, h } = POSES[p.pose];
      if (!Number.isInteger(p.x) || !Number.isInteger(p.y) || p.x < 0 || p.y < 0 || p.x + w > LARGURA_CENA || p.y + h > ALTURA_CENA)
        erros.push(`${g.id}: fora da cena no quadro ${f}`);
      if (typeof p.espelhada !== 'boolean') erros.push(`${g.id}: espelhada não é true/false`);
    }
  }
  return erros;
}
```

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/montagem.test.ts`
Expected: PASS.

- [ ] **Step 4: `games/idle/navegador.ts` (novo; não tem teste: depende do canvas do navegador)**

```ts
// O que só roda no navegador: ler PNG em bytes (pelo canvas), pintar bytes num canvas, carregar o kit de personagem
// e desenhar bonecos soltos (cartas, placar, editor). Sem a arte do kit (null), nada é desenhado e o jogo segue.
import { ativos } from './ativos';
import type { Imagem } from './imagem';
import { boneco, naCadeira, type Kit, type Pose } from './montagem';
import type { Visual } from './personagem';

export type Desenhar = (canvas: HTMLCanvasElement, v: Visual, opcoes?: { pose?: Pose; cadeira?: boolean }) => void;

const POSES_KIT: Pose[] = [1, 2, 3, 4, 5, 6];
const cache = new Map<string, Promise<Imagem>>();

export function carregarImagem(url: string): Promise<Imagem> {
  let p = cache.get(url);
  if (!p) {
    p = (async () => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const c = document.createElement('canvas');
      c.width = img.naturalWidth;
      c.height = img.naturalHeight;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0);
      return { w: c.width, h: c.height, d: g.getImageData(0, 0, c.width, c.height).data };
    })();
    cache.set(url, p);
    p.catch(() => cache.delete(url));
  }
  return p;
}

export function pintar(canvas: HTMLCanvasElement, img: Imagem): void {
  canvas.width = img.w;
  canvas.height = img.h;
  canvas.getContext('2d')?.putImageData(new ImageData(img.d, img.w, img.h), 0, 0);
}

/** O kit inteiro; falha de rede avisa no console e tenta de novo (3 vezes, esperando 5 s e 10 s). */
export async function carregarKit(tentativas = 3): Promise<Kit | null> {
  const urls = POSES_KIT.map((p) => ativos.pose(p));
  if (urls.some((u) => !u)) return null; // a arte do kit ainda não chegou: cenas antigas, sem gente
  for (let i = 1; i <= tentativas; i++) {
    try {
      const folhas = await Promise.all(urls.map((u) => carregarImagem(u!)));
      const poses = Object.fromEntries(POSES_KIT.map((p, j) => [p, folhas[j]])) as Record<Pose, Imagem>;
      const estagiario: Kit['estagiario'] = {};
      for (const p of POSES_KIT) {
        const u = ativos.estagiario(p);
        if (u) estagiario[p] = await carregarImagem(u);
      }
      return { poses, estagiario };
    } catch (e) {
      console.warn(`Fellas Inc.: o kit de personagem não carregou (tentativa ${i} de ${tentativas})`, e);
      if (i < tentativas) await new Promise((ok) => setTimeout(ok, 5000 * i));
    }
  }
  return null;
}

export function criarDesenhista(kit: Kit | null, cadeira: Imagem | null): Desenhar {
  return (canvas, v, opcoes = {}) => {
    if (!kit) return;
    pintar(canvas, opcoes.cadeira && cadeira ? naCadeira(kit, cadeira, v) : boneco(kit, v, opcoes.pose ?? 5, 0));
  };
}
```

- [ ] **Step 5: `games/idle/ativos.ts` (arquivo inteiro) e teste**

```ts
// URLs das imagens da Fellas Inc. (Vite troca pelos arquivos com hash no build) e o JSON das vagas de cada cena.
import type { Pose, Vagas } from './montagem';
import type { NomeCena } from './palco';

const nomeDe = (arq: string) => arq.split('/').pop()!.replace(/\.(png|json)$/, '');
const pegar = (lista: Record<string, string>) => Object.fromEntries(Object.entries(lista).map(([arq, url]) => [nomeDe(arq), url]));

const cenas = pegar(import.meta.glob('./assets/cenas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const geradores = pegar(import.meta.glob('./assets/geradores/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const oportunidades = pegar(import.meta.glob('./assets/oportunidades/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const gerais = pegar(import.meta.glob('./assets/gerais/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const pessoas = pegar(import.meta.glob('./assets/pessoas/*.png', { eager: true, query: '?url', import: 'default' }) as Record<string, string>);
const vagas = Object.fromEntries(
  Object.entries(import.meta.glob('./assets/cenas/*-vagas.json', { eager: true, import: 'default' }) as Record<string, Vagas>)
    .map(([arq, v]) => [nomeDe(arq).replace(/-vagas$/, ''), v]),
);

/** Uma cena em camadas; sem a arte nova, `fundo` é a tira antiga (com o fundador desenhado) e não há vagas. */
export type Camadas = { fundo: string; frente: string | null; vagas: Vagas | null };

export const ativos = {
  camadas(nome: NomeCena): Camadas {
    const fundo = cenas[`${nome}-fundo`];
    const v = vagas[nome];
    if (fundo && v) return { fundo, frente: cenas[`${nome}-frente`] ?? null, vagas: v };
    return { fundo: cenas[nome], frente: null, vagas: null };
  },
  pose: (p: Pose): string | null => pessoas[`pose-${p}`] ?? null,
  estagiario: (p: Pose): string | null => pessoas[`estagiario-pose-${p}`] ?? null,
  cadeira: (): string | null => pessoas.cadeira ?? null,
  gerador: (id: number) => geradores[`gerador-${String(id).padStart(2, '0')}`],
  oportunidade: (k: 0 | 1 | 2) => oportunidades[`oportunidade-${k}`],
  geral: (id: number): string | null => gerais[`geral-${id}`] ?? null,
};
```

Em `games/idle/ativos.test.ts`, troque o teste `'tem as 8 cenas'` por:

```ts
  it('toda cena tem fundo (camadas novas ou a tira antiga); cena com vagas tem frente', () => {
    for (const c of CENAS) {
      const k = ativos.camadas(c);
      expect(naoVazia(k.fundo), c).toBe(true);
      if (k.vagas) expect(naoVazia(k.frente), c).toBe(true);
    }
  });
```

- [ ] **Step 6: `games/idle/palco.ts` (arquivo inteiro), teste e `main.ts`**

```ts
// Toca as cenas (quadros de 160x96 lado a lado) num canvas de 160x96; o CSS amplia por um inteiro.
// Cena em camadas (assets/cenas/<nome>-fundo, -frente, -vagas) ganha gente: a tira é montada uma vez por
// (cena, gente) e guardada; mudou visual ou contrato, monta de novo (até lá, toca a anterior). Sem a arte nova,
// toca a tira antiga.
import type { Camadas } from './ativos';
import { montarTira, ocuparVagas, type Kit } from './montagem';
import { carregarImagem, pintar } from './navegador';
import { chave, PADRAO, type Visual } from './personagem';

export type NomeCena = 'cena-0-antes' | 'cena-0-abrindo' | 'cena-1' | 'cena-2' | 'cena-3' | 'cena-4' | 'cena-5' | 'cena-6';

export const CENAS: Record<NomeCena, { quadros: number; atrasoMs: number }> = {
  'cena-0-antes': { quadros: 8, atrasoMs: 150 },
  'cena-0-abrindo': { quadros: 12, atrasoMs: 180 },
  'cena-1': { quadros: 8, atrasoMs: 150 },
  'cena-2': { quadros: 8, atrasoMs: 150 },
  'cena-3': { quadros: 8, atrasoMs: 150 },
  'cena-4': { quadros: 8, atrasoMs: 150 },
  'cena-5': { quadros: 12, atrasoMs: 150 },
  'cena-6': { quadros: 8, atrasoMs: 150 },
};
export const LARGURA = 160;
export const ALTURA = 96;

export function quadroEm(nome: NomeCena, decorridoMs: number, umaVez: boolean): number | null {
  const { quadros, atrasoMs } = CENAS[nome];
  const q = Math.floor(decorridoMs / atrasoMs);
  if (umaVez) return q < quadros ? q : null;
  return q % quadros;
}

/** Quem aparece nas cenas: você e sua equipe (contrato mais recente primeiro). */
export type Gente = { dono: Visual; equipe: Visual[] };
export const chaveGente = (g: Gente) => [chave(g.dono), ...g.equipe.map(chave)].join('|');

export function criarPalco(canvas: HTMLCanvasElement, camadas: (nome: NomeCena) => Camadas, kit: Promise<Kit | null>) {
  canvas.width = LARGURA;
  canvas.height = ALTURA;
  const g = canvas.getContext('2d')!;
  g.imageSmoothingEnabled = false;
  let gente: Gente = { dono: PADRAO, equipe: [] };
  const tiras = new Map<string, HTMLCanvasElement>(); // por cena + gente
  const ultima = new Map<NomeCena, HTMLCanvasElement>(); // a última tira pronta de cada cena (toca enquanto monta a nova)
  const pedidas = new Set<string>();
  const falhas = new Set<string>();
  const chaveDe = (nome: NomeCena) => `${nome}#${chaveGente(gente)}`;

  function pedir(nome: NomeCena) {
    const k = chaveDe(nome);
    if (tiras.has(k) || pedidas.has(k) || falhas.has(k)) return;
    pedidas.add(k);
    const c = camadas(nome);
    const quem = gente;
    void (async () => {
      const [fundo, frente, k2] = await Promise.all([carregarImagem(c.fundo), c.frente ? carregarImagem(c.frente) : null, kit]);
      const tira = c.vagas ? montarTira({ fundo, frente, vagas: c.vagas }, ocuparVagas(c.vagas, quem.dono, quem.equipe), k2) : fundo;
      const cv = document.createElement('canvas');
      pintar(cv, tira);
      tiras.set(k, cv);
      if (k === chaveDe(nome)) ultima.set(nome, cv);
    })()
      .catch((e) => {
        // avisa e deixa tentar de novo daqui a 30 s (ou antes, se a gente mudar)
        console.warn(`Fellas Inc.: a cena ${nome} não montou (${c.fundo})`, e);
        falhas.add(k);
        setTimeout(() => falhas.delete(k), 30_000);
      })
      .finally(() => pedidas.delete(k));
  }

  let atual: { nome: NomeCena; inicio: number; umaVez: boolean; aoTerminar?: () => void } | null = null;
  let raf = 0;

  const quadro = (agora: number) => {
    raf = 0;
    if (!atual) return;
    const q = quadroEm(atual.nome, Math.max(0, agora - atual.inicio), atual.umaVez);
    if (q === null) {
      const fim = atual.aoTerminar;
      atual = null;
      fim?.();
      return;
    }
    const tira = tiras.get(chaveDe(atual.nome)) ?? ultima.get(atual.nome);
    if (!tiras.has(chaveDe(atual.nome))) pedir(atual.nome);
    if (tira) g.drawImage(tira, q * LARGURA, 0, LARGURA, ALTURA, 0, 0, LARGURA, ALTURA);
    if (!document.hidden) raf = requestAnimationFrame(quadro);
  };
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && atual && !raf) raf = requestAnimationFrame(quadro);
  });

  return {
    tocar(nome: NomeCena, opcoes: { umaVez?: boolean; aoTerminar?: () => void } = {}) {
      if (atual?.nome === nome && !opcoes.umaVez) return; // já está tocando: não reinicia o loop
      atual = { nome, inicio: performance.now(), umaVez: !!opcoes.umaVez, aoTerminar: opcoes.aoTerminar };
      pedir(nome);
      if (!raf) raf = requestAnimationFrame(quadro);
    },
    parar() {
      atual = null;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
    },
    /** Troca quem aparece nas cenas (visual salvo, contrato novo). Só remonta se mudou. */
    gente(nova: Gente) {
      const k = chaveGente(nova);
      if (k === chaveGente(gente)) return;
      gente = nova;
      falhas.clear();
      for (const x of [...tiras.keys()]) if (!x.endsWith(`#${k}`)) tiras.delete(x);
      if (atual) pedir(atual.nome);
    },
    /** Monta antes de precisar (a cena de abrir a empresa toca uma vez só, logo depois do toque). */
    preparar(nomes: NomeCena[]) {
      for (const n of nomes) pedir(n);
    },
  };
}
```

Em `games/idle/palco.test.ts`, import `import { CENAS, chaveGente, quadroEm } from './palco';` e
`import { PADRAO } from './personagem';`, e acrescente no `describe('palco')`:

```ts
  it('chave da gente muda com o visual e com a ordem da equipe', () => {
    const a = chaveGente({ dono: PADRAO, equipe: [] });
    expect(chaveGente({ dono: { ...PADRAO }, equipe: [] })).toBe(a);
    expect(chaveGente({ dono: { ...PADRAO, pele: 0 }, equipe: [] })).not.toBe(a);
    const x = { ...PADRAO, roupa: 1 };
    expect(chaveGente({ dono: PADRAO, equipe: [x, PADRAO] })).not.toBe(chaveGente({ dono: PADRAO, equipe: [PADRAO, x] }));
  });
```

Em `games/idle/main.ts`: import `import { carregarKit } from './navegador';` e troque
`const palco = criarPalco(tela.canvas, ativos.cenas);` por `const palco = criarPalco(tela.canvas, ativos.camadas, carregarKit());`.

- [ ] **Step 7: Rodar tudo de `games/` e o build**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run && npm run build`
Expected: PASS; o build não reclama de `./assets/pessoas` vazio (o glob devolve `{}`).

- [ ] **Step 8: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add games/idle/montagem.ts games/idle/montagem.test.ts games/idle/navegador.ts games/idle/ativos.ts games/idle/ativos.test.ts games/idle/palco.ts games/idle/palco.test.ts games/idle/main.ts && git commit -m "Fellas Inc.: montagem das cenas com gente (kit, vagas, fundo e frente)"
```

---

### Task 7: A página: aba Contratar, editor de personagem e gente no palco

**Files:**
- Modify: `games/idle/tela.ts`, `games/idle/idle.css`, `games/idle/main.ts` (edições pontuais: o que já está na `main`
  fica, inclusive a aba Melhorias "À venda | Compradas", o placar "+R$ X/s", caixinha e estratégia como folha,
  `vigiarVersao()` e os textos sem "semana")
- Test: `games/idle/tela.test.ts`

**Interfaces:**
- Consome: `IdleState`/`IdleBoardRow` novos, `idleHire`/`idleSetAvatar`, `vencido` (Task 5); `multContratos` (Task 3);
  `PADRAO`, `sortear`, `PELES`, `CORES_CABELO`, `CORES`, `Campo`, `Tons`, `VISUAL_NOMES` (Task 2); `Desenhar`,
  `carregarKit`, `carregarImagem`, `criarDesenhista`, `palco.gente`, `palco.preparar`, `ativos.cadeira` (Task 6).
- Produz: `Aba` + `'contratar'`; `Modelo.editor: IdleVisual | null` (rascunho; null = fechado); `Acoes` +
  `contratar(userId)`, `editor(acao: 'abrir' | 'fechar' | 'sortear' | 'salvar')`, `mudarVisual(campo, valor)`;
  `criarTela(root, acoes, desenhar?: Desenhar)`; `porcento(mult)`, `empresas(n)`, `restam(ms)`.

- [ ] **Step 1: Testes (`games/idle/tela.test.ts`)**

Imports novos: `import type { IdleBoardRow } from '../shared/types';`, `import type { Desenhar } from './navegador';`,
`import { PADRAO } from './personagem';`; e troque o import da tela por
`import { criarTela, empresas, porcento, prazo, restam, type Acoes, type Modelo } from './tela';`.

Na função `modelo`, antes de `...x`, acrescente `editor: null,`. No `beforeEach`, o objeto `acoes` ganha
`contratar: vi.fn<Acoes['contratar']>(), editor: vi.fn<Acoes['editor']>(), mudarVisual: vi.fn<Acoes['mudarVisual']>(),`.

No teste `'modais com aria-modal e título'`, o `renderizar` ganha `editor: { ...PADRAO }` e a lista de seletores vira
`['.modal-estrategia', '.modal-caixa', '.modal-visual']`.

Acrescente no fim do arquivo:

```ts
const linha = (x: Partial<IdleBoardRow> = {}): IdleBoardRow => ({
  userId: 'b', name: 'Bia', valuation: 1000, rate: 2, era: 2, strategies: [0, -1, -1, -1],
  avatar: null, hiredCount: 0, byMe: false, mostHired: false, ...x,
});
const ATE = '2026-10-19T00:00:00.000Z'; // 6,5 dias depois do server_now das fixtures

describe('contratar', () => {
  it('cartas de quem abriu a empresa (menos você); botão libera no preço; tocar contrata', () => {
    const desenhar = vi.fn<Desenhar>();
    const tela = criarTela(root, acoes, desenhar);
    tela.renderizar(modelo({ aba: 'contratar', estado: estado({ hire_price: 918 }), placar: [linha({ userId: 'u', name: 'Você' }), linha()] }));
    const cartas = root.querySelectorAll('.lista-contratar .carta');
    expect(cartas).toHaveLength(1);
    expect(cartas[0].textContent).toContain('Bia');
    expect(cartas[0].textContent).toContain('Garagem · ninguém contratou ainda');
    const b = cartas[0].querySelector('button')!;
    expect(b.textContent).toBe('Contratar · R$ 918');
    tela.atualizarValor(917);
    expect(b.disabled).toBe(true);
    tela.atualizarValor(918);
    expect(b.disabled).toBe(false);
    b.click();
    expect(acoes.contratar).toHaveBeenCalledWith('b');
    expect(desenhar).toHaveBeenCalledWith(expect.any(HTMLCanvasElement), PADRAO, undefined); // sem visual = fundador
  });
  it('quem você já contratou: sem botão, com o cargo e quanto falta pro contrato vencer', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({
      aba: 'contratar',
      estado: estado({ equipe: [{ user_id: 'b', cargo: 'CEO de nada', avatar: null, ate: ATE }] }),
      placar: [linha({ byMe: true, hiredCount: 1 })],
    }));
    const carta = root.querySelector('.lista-contratar .carta')!;
    expect(carta.querySelector('button')).toBeNull();
    expect(carta.textContent).toContain('Trabalha pra você como CEO de nada por mais 6 dias');
    expect(carta.textContent).toContain('trabalha em 1 empresa');
  });
  it('topo: bônus dos contratos, piso de freela ou quem te contratou; Mudar visual abre o editor; vazio convida', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'contratar', placar: [] }));
    const topo = root.querySelector('.contratos-topo')!;
    expect(topo.textContent).toContain('Contratos: +2% de produção');
    expect(topo.textContent).toContain('Ninguém te contratou: você ganha o piso de freela.');
    expect(root.querySelector('.lista-contratar')!.textContent).toContain('Ninguém mais abriu a empresa ainda. Chama a galera.');
    [...topo.querySelectorAll('button')].find((x) => x.textContent === 'Mudar visual')!.click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
    tela.renderizar(modelo({
      aba: 'contratar', placar: [linha()],
      estado: estado({ chefes: [{ user_id: 'b', cargo: 'sócio de fachada', mult: 1, ate: ATE }], social: { contratei: 0, empregos: [1] } }),
    }));
    expect(root.querySelector('.contratos-topo')!.textContent).toContain('Você trabalha pra Bia (sócio de fachada, por mais 6 dias).');
  });
  it('placar: boneco de cada um e o mais disputado do mercado', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ aba: 'placar', placar: [linha({ mostHired: true, hiredCount: 3 }), linha({ userId: 'c', name: 'Teteu' })] }));
    const itens = root.querySelectorAll('.lista-placar li');
    expect(itens[0].querySelector('canvas')).not.toBeNull();
    expect(itens[0].textContent).toContain('Mais disputado da semana');
    expect(itens[1].textContent).not.toContain('Mais disputado');
  });
  it('porcento, empresas e restam', () => {
    expect(porcento(1.02)).toBe('+2%');
    expect(porcento(1.12)).toBe('+12%');
    expect(porcento(1.025)).toBe('+2,5%');
    expect(empresas(0)).toBe('ninguém contratou ainda');
    expect(empresas(1)).toBe('trabalha em 1 empresa');
    expect(empresas(3)).toBe('trabalha em 3 empresas');
    expect(restam(6.5 * 86400_000)).toBe('por mais 6 dias');
    expect(restam(30 * 3600_000)).toBe('por mais 1 dia');
    expect(restam(5.5 * 3600_000)).toBe('por mais 5 h');
    expect(restam(20 * 60_000)).toBe('por menos de 1 h');
  });
});

describe('editor de personagem', () => {
  const grupo = (nome: string) => root.querySelector<HTMLElement>(`.modal-visual [role="group"][aria-label="${nome}"]`);
  it('mostra o rascunho marcado; tocar muda; a cor da cabeça some com "Nada"', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }), editor: { ...PADRAO } }));
    expect(root.querySelector('.modal-visual')!.hasAttribute('hidden')).toBe(false);
    expect(grupo('Cor do cabelo')!.querySelector('[aria-label="Preto"]')!.getAttribute('aria-pressed')).toBe('true');
    expect(grupo('Na cabeça')!.querySelector('[aria-pressed="true"]')!.textContent).toBe('Fone');
    [...grupo('Cabelo')!.querySelectorAll('button')].find((x) => x.textContent === 'Cacheado')!.click();
    expect(acoes.mudarVisual).toHaveBeenCalledWith('cabelo', 2);
    expect(grupo('Cor do que vai na cabeça')).not.toBeNull();
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }), editor: { ...PADRAO, acessorio: 0 } }));
    expect(grupo('Cor do que vai na cabeça')).toBeNull();
  });
  it('Sortear, Bora e fechar chamam o editor; Bora apagado enquanto salva', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ editor: { ...PADRAO } }));
    const modal = root.querySelector('.modal-visual')!;
    [...modal.querySelectorAll('button')].find((x) => x.textContent === 'Sortear')!.click();
    [...modal.querySelectorAll('button')].find((x) => x.textContent === 'Bora')!.click();
    modal.querySelector<HTMLButtonElement>('.fechar')!.click();
    expect(acoes.editor.mock.calls.map((c) => c[0])).toEqual(['sortear', 'salvar', 'fechar']);
    tela.renderizar(modelo({ editor: { ...PADRAO }, ocupado: true }));
    expect([...root.querySelectorAll<HTMLButtonElement>('.modal-visual button')].find((x) => x.textContent === 'Bora')!.disabled).toBe(true);
  });
  it('fechado: modal escondido; "Mudar visual" na tela de abrir a empresa abre', () => {
    const tela = criarTela(root, acoes);
    tela.renderizar(modelo({ fase: 'antes', estado: estado({ started: false }) }));
    expect(root.querySelector('.modal-visual')!.hasAttribute('hidden')).toBe(true);
    [...root.querySelectorAll<HTMLButtonElement>('.abrir button')].find((x) => x.textContent === 'Mudar visual')!.click();
    expect(acoes.editor).toHaveBeenCalledWith('abrir');
  });
});
```

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/tela.test.ts`
Expected: FAIL (sem aba Contratar, sem editor, sem `porcento`/`restam`). Os testes que já existiam (Compradas, placar por
R$/s, caixinha) continuam passando depois do Step 2: são a trava de que nada da `main` se perdeu.

- [ ] **Step 2: `games/idle/tela.ts` (edições pontuais, na ordem do arquivo)**

(a) Troque os imports de `../shared/types` até `./store` por:

```ts
import type { IdleBoardRow, IdleState, IdleVisual } from '../shared/types';
import { ativos } from './ativos';
import { catalogo, type Melhoria } from './catalogo';
import { custoMult, liberada, maxCompra, multContratos, podeComprarGerador, preco, taxaPorUnidade } from './economia';
import { formatarTaxa, formatarValor } from './formatar';
import type { Pose } from './montagem';
import type { Desenhar } from './navegador';
import { ERAS, VISUAL_NOMES } from './nomes';
import { instante, TEXTO_TIPO, tipo as tipoOportunidade, VALIDADE_S } from './oportunidades';
import { CORES, CORES_CABELO, PADRAO, PELES, type Campo, type Tons } from './personagem';
import { estrategiaPendente, segundosOportunidade, type Fase } from './store';
```

(b) Troque os tipos `Aba`, `Modelo` e `Acoes` por:

```ts
export type Aba = 'geradores' | 'melhorias' | 'contratar' | 'placar';
export type AcaoEditor = 'abrir' | 'fechar' | 'sortear' | 'salvar';
export type Modelo = {
  fase: Fase; estado: IdleState | null; aba: Aba; placar: IdleBoardRow[] | null; aviso: string | null;
  ocupado: boolean; pendentes: number[]; aoVivo: number | null; caixaAberta: boolean;
  /** Rascunho do editor de personagem (null = fechado). */
  editor: IdleVisual | null;
};
export type Acoes = {
  abrirCnpj(): void; comprar(tipo: 'gerador' | 'melhoria', id: number, qtd: 0 | 1 | 10): void; escolher(era: number, opcao: number): void;
  pegar(janela: number): void; trocarAba(aba: Aba): void; caixa(aberta: boolean): void; tentarDeNovo(): void;
  contratar(userId: string): void; editor(acao: AcaoEditor): void; mudarVisual(campo: Campo, valor: number): void;
};
```

(c) Logo depois da função `prazo`, acrescente:

```ts
/** "+12%" / "+2,5%": o bônus dos contratos em pt-BR, com uma casa no máximo. */
export const porcento = (mult: number) => `+${(Math.round((mult - 1) * 1000) / 10).toLocaleString('pt-BR')}%`;

/** Em quantas empresas alguém trabalha agora (carta de contratar). */
export function empresas(n: number) {
  if (n === 0) return 'ninguém contratou ainda';
  return n === 1 ? 'trabalha em 1 empresa' : `trabalha em ${n} empresas`;
}

/** Quanto falta pro contrato vencer: "por mais 6 dias", "por mais 5 h", "por menos de 1 h". */
export function restam(ms: number) {
  const h = Math.floor(ms / 3600_000);
  if (h < 1) return 'por menos de 1 h';
  if (h < 24) return `por mais ${h} h`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'por mais 1 dia' : `por mais ${d} dias`;
}
```

(d) A assinatura vira `export function criarTela(root: HTMLElement, a: Acoes, desenhar: Desenhar = () => undefined): Tela {`.

(e) O `abrir.append(...)` vira:

```ts
  abrir.append(
    el('p', undefined, '3h06. Bora fundar uma empresa?'),
    button('Abrir CNPJ', 'btn main', a.abrirCnpj),
    button('Mudar visual', 'btn', () => a.editor('abrir')),
  );
```

(f) As abas e listas viram (o resto do bloco fica):

```ts
  const botoesAba: Record<Aba, HTMLButtonElement> = {
    geradores: button('Geradores', 'aba', () => a.trocarAba('geradores')),
    melhorias: button('Melhorias', 'aba', () => a.trocarAba('melhorias')),
    contratar: button('Contratar', 'aba', () => a.trocarAba('contratar')),
    placar: button('Placar', 'aba', () => a.trocarAba('placar')),
  };
  abas.append(botoesAba.geradores, botoesAba.melhorias, botoesAba.contratar, botoesAba.placar);
  const listaG = el('div', 'lista lista-geradores');
  const listaM = el('div', 'lista lista-melhorias');
  const listaC = el('div', 'lista lista-contratar');
  const listaP = el('ol', 'lista lista-placar');
  const painel = el('main', 'painel');
  painel.append(abrir, abas, listaG, listaM, listaC, listaP);
```

(g) Os modais: depois de `const modalC = el('div', 'modal modal-caixa');` acrescente
`const modalV = el('div', 'modal modal-visual');`; o `for` dos atributos passa a percorrer
`[[modalE, 'idle-titulo-estrategia'], [modalC, 'idle-titulo-caixa'], [modalV, 'idle-titulo-visual']] as const`; e o
`app.append(...)` termina em `modalE, modalC, modalV);`.

(h) Depois de `let ultimo: Modelo | null = null;`, acrescente:

```ts

  /** Personagem num canvas pequeno (o CSS amplia). rotulo null = decorativo (o nome já está do lado). */
  function boneco(v: IdleVisual | null, rotulo: string | null, opcoes?: { pose?: Pose; cadeira?: boolean }) {
    const c = el('canvas', 'mini-boneco');
    if (rotulo) {
      c.setAttribute('role', 'img');
      c.setAttribute('aria-label', rotulo);
    } else c.setAttribute('aria-hidden', 'true');
    desenhar(c, v ?? PADRAO, opcoes);
    return c;
  }

  /** Uma linha do editor: rótulo + botões (texto, ou amostras de cor com `tons`). */
  function opcoes(rotulo: string, grupoNome: string, campo: Campo, v: IdleVisual, tons?: readonly Tons[]) {
    const linha = el('div', 'opcoes');
    linha.setAttribute('role', 'group');
    linha.setAttribute('aria-label', grupoNome);
    const botoes = el('div', 'opcoes-botoes');
    VISUAL_NOMES[campo].forEach((nome, i) => {
      const b = button(tons ? '' : nome, tons ? 'cor' : 'chip', () => a.mudarVisual(campo, i));
      if (tons) {
        b.style.backgroundColor = tons[i][1];
        b.setAttribute('aria-label', nome);
      }
      b.setAttribute('aria-pressed', String(v[campo] === i));
      botoes.append(b);
    });
    linha.append(el('span', 'opcoes-rotulo', rotulo), botoes);
    return linha;
  }
```

e, dentro de `renderizar`, na caixinha, renomeie a variável local `boneco` (o `el('div', 'boneco')`) para
`bonequinho` (as duas linhas que a usam), para não esconder a função nova.

(i) Em `renderizar`, depois de `mostrar(listaM, jogando && m.aba === 'melhorias');`:
`mostrar(listaC, jogando && m.aba === 'contratar');`

(j) Logo antes de `listaP.replaceChildren();`, acrescente:

```ts
    // contratar: você no topo (bônus, quem te contratou), depois uma carta por fella que abriu a empresa
    listaC.replaceChildren();
    if (s && jogando && m.aba === 'contratar') {
      const agora = Date.parse(s.server_now);
      const nome = (uid: string) => m.placar?.find((r) => r.userId === uid)?.name ?? 'Alguém';
      const topoC = el('div', 'contratos-topo');
      const texto = el('div', 'meio');
      texto.append(
        el('strong', undefined, `Contratos: ${porcento(multContratos(catalogo, s))} de produção`),
        el('span', 'sub', s.chefes.length
          ? `Você trabalha pra ${s.chefes.map((c) => `${nome(c.user_id)} (${c.cargo}, ${restam(Date.parse(c.ate) - agora)})`).join(', ')}.`
          : 'Ninguém te contratou: você ganha o piso de freela.'),
      );
      topoC.append(boneco(s.avatar, 'Seu personagem'), texto, button('Mudar visual', 'btn', () => a.editor('abrir')));
      listaC.append(topoC);
      if (!m.placar) listaC.append(el('p', 'vazio', 'Carregando…'));
      else {
        const outros = m.placar.filter((r) => r.userId !== s.user_id);
        if (!outros.length) listaC.append(el('p', 'vazio', 'Ninguém mais abriu a empresa ainda. Chama a galera.'));
        for (const r of outros) {
          const carta = el('div', 'carta');
          const meio = el('div', 'meio');
          meio.append(el('strong', undefined, r.name), el('span', 'sub', `${ERAS[r.era - 1]} · ${empresas(r.hiredCount)}`));
          carta.append(boneco(r.avatar, null), meio);
          // "já trabalha pra você" vem do estado (sempre fresco), não só do placar (recarrega a cada 60 s)
          const meu = s.equipe.find((e) => e.user_id === r.userId);
          if (meu) {
            carta.append(el('span', 'contratado', `Trabalha pra você como ${meu.cargo} ${restam(Date.parse(meu.ate) - agora)}`));
          } else {
            const b = button(`Contratar · ${formatarValor(s.hire_price)}`, 'btn', () => a.contratar(r.userId));
            precos.push({ botao: b, preco: s.hire_price });
            carta.append(b);
          }
          listaC.append(carta);
        }
      }
    }

```

(k) No placar, troque a linha `li.append(el('span', 'pos', ...), ..., el('span', 'v', formatarTaxa(r.rate)));` por:

```ts
        li.append(
          el('span', 'pos', `${i + 1}º`), boneco(r.avatar, null), el('span', 'nome', r.name),
          el('span', 'sub', `${ERAS[r.era - 1]}${est ? ` · ${est}` : ''}`), el('span', 'v', formatarTaxa(r.rate)),
        );
        if (r.mostHired) li.append(el('span', 'disputado', 'Mais disputado da semana'));
```

(l) Logo antes de `noticeTxt.textContent = m.aviso ?? '';`, acrescente:

```ts
    // editor de personagem
    modalV.replaceChildren();
    mostrar(modalV, m.editor !== null && (m.fase === 'antes' || jogando));
    if (m.editor) {
      const v = m.editor;
      const folha = el('div', 'folha');
      const topoV = el('div', 'folha-topo');
      const fechar = button('', 'fechar', () => a.editor('fechar'));
      fechar.setAttribute('aria-label', 'Fechar');
      fechar.append(iconeFechar());
      topoV.append(titulo('idle-titulo-visual', 'Seu visual'), fechar);
      const previa = el('div', 'previa');
      previa.append(boneco(v, 'Você de frente', { pose: 5 }), boneco(v, 'Você na cadeira', { pose: 1, cadeira: true }));
      folha.append(
        topoV,
        el('p', 'sub', 'É assim que você aparece nas suas cenas, no placar e na empresa de quem te contratar.'),
        previa,
        opcoes('Pele', 'Pele', 'pele', v, PELES),
        opcoes('Cabelo', 'Cabelo', 'cabelo', v),
        opcoes('Cor', 'Cor do cabelo', 'cor_cabelo', v, CORES_CABELO),
        opcoes('Roupa', 'Roupa', 'roupa', v),
        opcoes('Cor', 'Cor da roupa', 'cor_roupa', v, CORES),
        opcoes('Na cabeça', 'Na cabeça', 'acessorio', v),
      );
      if (v.acessorio > 0) folha.append(opcoes('Cor', 'Cor do que vai na cabeça', 'cor_acessorio', v, CORES));
      const fim = el('div', 'editor-fim');
      const bora = button('Bora', 'btn main', () => a.editor('salvar'));
      bora.disabled = m.ocupado;
      fim.append(button('Sortear', 'btn', () => a.editor('sortear')), bora);
      folha.append(fim);
      modalV.append(folha);
    }

```

- [ ] **Step 3: `games/idle/idle.css`**

Troque a regra `.idle .aba { ... }` (font de 15px) por:

```css
.idle .aba { flex: 1; min-height: 44px; padding: 0 4px; border-radius: 8px; border: 1px solid #34323F; background: #1B1A22; color: var(--paper); font: 700 14px var(--font); }
```

Troque as quatro regras `.idle .lista-placar li`, `.idle .lista-placar li.eu`, `.idle .lista-placar .sub` e
`.idle .lista-placar .v` por:

```css
.idle .lista-placar li { display: grid; grid-template-columns: 32px 36px 1fr auto; align-items: center; gap: 2px 8px; padding: 8px; border-radius: 8px; background: #1B1A22; color: var(--paper); }
.idle .lista-placar li.eu { outline: 2px solid #B8A2FF; }
.idle .lista-placar .mini-boneco { grid-row: 1 / span 3; grid-column: 2; width: 27px; height: 39px; }
.idle .lista-placar .nome, .idle .lista-placar .sub, .idle .lista-placar .disputado { grid-column: 3; }
.idle .lista-placar .v { grid-row: 1; grid-column: 4; font-weight: 700; }
```

E acrescente no fim do arquivo (depois das regras `.seg`):

```css
.idle .mini-boneco { flex: none; width: 36px; height: 52px; image-rendering: pixelated; }
.idle .contratos-topo, .idle .carta { display: flex; align-items: center; gap: 12px; padding: 8px; border-radius: 8px; background: #1B1A22; color: var(--paper); }
.idle .contratos-topo { border: 1px solid #34323F; }
.idle .carta .btn, .idle .contratos-topo .btn { flex: none; min-height: 44px; height: auto; padding: 0 12px; white-space: nowrap; }
.idle .contratado { flex: none; max-width: 45%; text-align: right; font-size: 13px; color: var(--mint); }
.idle .disputado { justify-self: start; padding: 2px 8px; border-radius: 999px; background: #3A2A66; color: #DDD2FF; font-size: 12px; font-weight: 700; }
.idle .previa { display: flex; justify-content: center; align-items: flex-end; gap: 24px; padding: 8px 0 12px; }
.idle .previa .mini-boneco:first-child { width: 54px; height: 78px; }
.idle .previa .mini-boneco:last-child { width: 72px; height: 90px; }
.idle .opcoes { display: grid; gap: 6px; padding: 8px 0; border-top: 1px solid #2A2833; }
.idle .opcoes-rotulo { font-size: 13px; font-weight: 700; color: #A8A398; }
.idle .opcoes-botoes { display: flex; flex-wrap: wrap; gap: 8px; }
.idle .chip { min-height: 44px; padding: 0 12px; border-radius: 8px; border: 1px solid #34323F; background: #121212; color: var(--paper); font: 600 14px var(--font); cursor: pointer; }
.idle .cor { width: 44px; height: 44px; border-radius: 8px; border: 2px solid #34323F; cursor: pointer; }
.idle .chip[aria-pressed='true'] { background: #3A2A66; border-color: #B8A2FF; }
.idle .cor[aria-pressed='true'] { border-color: #B8A2FF; box-shadow: 0 0 0 2px #B8A2FF; }
.idle .chip:focus-visible, .idle .cor:focus-visible { outline: 2px solid #B8A2FF; outline-offset: 2px; }
.idle .editor-fim { display: flex; gap: 12px; justify-content: flex-end; padding-top: 12px; }
```


- [ ] **Step 4: `games/idle/main.ts` (edições pontuais; `vigiarVersao()` e o resto ficam como estão)**

(a) Imports: o de `../shared/types` vira `import type { IdleBoardRow, IdleState, IdleVisual } from '../shared/types';`;
acrescente

```ts
import { carregarImagem, carregarKit, criarDesenhista, type Desenhar } from './navegador';
import { PADRAO, sortear } from './personagem';
```

(se a Task 6 já pôs `import { carregarKit } from './navegador';`, troque essa linha pela de cima) e acrescente `vencido`
ao import de `./store`.

(b) `type Api` passa a escolher também `'idleHire' | 'idleSetAvatar'`.

(c) Troque `const RECARREGA = [...]` por:

```ts
const RECARREGA = [
  'idle_cant_afford', 'idle_locked', 'idle_owned', 'idle_strategy_set', 'idle_strategy_pending', 'idle_opp_gone', 'idle_opp_cap',
  'idle_not_started', 'idle_started', 'idle_hire_twice', 'idle_hire_not_open',
];
// contratar recusado: o placar (quem já trabalha pra quem) também ficou velho
const RECARREGA_PLACAR = ['idle_hire_twice', 'idle_hire_not_open'];
```

(d) Depois de `let vivoAtual: number | null = null;`, acrescente:

```ts
// editor de personagem: rascunho aberto (null = fechado). Fechar sem salvar mostra o fundador padrão; o editor só
// volta sozinho na próxima abertura da página, até o primeiro "Bora".
let rascunho: IdleVisual | null = null;
let editorFechado = false;
// bonecos soltos (cartas, placar, editor) só desenham depois que o kit carrega
let desenhar: Desenhar = () => undefined;
// o vencimento de contrato que já pediu um "bater o ponto" (pede uma vez por vencimento)
let vencimentoPedido: string | null = null;
```

(e) Na chamada `criarTela(document.getElementById('app')!, { ... })`: troque `trocarAba` por

```ts
  trocarAba: (nova) => {
    aba = nova;
    if (nova === 'placar' || nova === 'contratar') void carregarPlacar();
    render();
  },
```

acrescente às ações

```ts
  contratar: (uid) => void guard(async () => {
    aplicar(await api.idleHire(uid));
    await carregarPlacar();
  }),
  editor: (acao) => {
    if (acao === 'salvar') {
      const v = rascunho;
      if (v) void guard(() => salvarVisual(v));
      return;
    }
    if (acao === 'abrir') rascunho = { ...(ancora?.estado.avatar ?? PADRAO) };
    else if (acao === 'fechar') {
      rascunho = null;
      editorFechado = true;
    } else rascunho = sortear();
    render();
  },
  mudarVisual: (campo, valor) => {
    if (!rascunho) return;
    rascunho = { ...rascunho, [campo]: valor };
    render();
  },
```

e passe o terceiro argumento depois do objeto: `}, (canvas, v, opcoes) => desenhar(canvas, v, opcoes));`.

(f) Troque a linha do palco (a da Task 6) por:

```ts
const kit = carregarKit();
const palco = criarPalco(tela.canvas, ativos.camadas, kit);
void (async () => {
  const k = await kit;
  const url = ativos.cadeira();
  const cadeira = url
    ? await carregarImagem(url).catch((e) => {
        console.warn(`Fellas Inc.: a cadeira do editor não carregou (${url})`, e);
        return null;
      })
    : null;
  desenhar = criarDesenhista(k, cadeira);
  render();
})();
```

(g) Em `render`, o objeto passado a `tela.renderizar` ganha `editor: rascunho,`.

(h) `aplicar` vira:

```ts
function aplicar(estado: IdleState) {
  ancora = ancorar(estado, Date.now());
  fase = faseDoEstado(estado, fase);
  palco.gente({ dono: estado.avatar ?? PADRAO, equipe: estado.equipe.map((c) => c.avatar ?? PADRAO) });
  if (fase === 'antes') {
    palco.preparar(['cena-0-abrindo', 'cena-1']);
    // primeira vez (nunca salvou o visual): o editor aparece antes do Abrir CNPJ
    if (!estado.avatar && !editorFechado && rascunho === null) rascunho = { ...PADRAO };
  }
  if (fase !== 'abrindo') palco.tocar(cenaDoEstado(estado, fase));
  render();
}
```

e, logo depois de `recarregar`, acrescente:

```ts
async function salvarVisual(v: IdleVisual) {
  aplicar(await api.idleSetAvatar(v));
  rascunho = null;
  if (aba === 'placar' || aba === 'contratar') await carregarPlacar();
}
```

(i) Em `guard`, troque `if (RECARREGA.includes(err.code)) await recarregar().catch(() => undefined);` por:

```ts
      if (RECARREGA.includes(err.code)) await recarregar().catch(() => undefined);
      if (RECARREGA_PLACAR.includes(err.code)) await carregarPlacar();
```

(j) No `setInterval` de 100 ms, depois de `if (vivoAgora(...) !== vivoAtual) render();`, acrescente:

```ts
  // um contrato venceu: a taxa mudou no banco, bate o ponto (uma vez por vencimento)
  const s = ancora.estado;
  if (vencido(s, agoraSrv()) && vencimentoPedido !== s.muda_em && !ocupado) {
    vencimentoPedido = s.muda_em;
    void guard(recarregar);
  }
```

O `setInterval` do placar (60 s) passa a valer para as duas abas: `if (!document.hidden && (aba === 'placar' || aba === 'contratar')) void carregarPlacar();`.
O comentário do `visibilitychange` vira `// voltou pra aba: bate o ponto de novo (foto de segunda, contrato vencido)`.

- [ ] **Step 5: Rodar os testes, o build e conferir no `?mock`**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run && npm run build && git diff --stat main -- idle/tela.ts idle/main.ts`
Expected: PASS; o diff de `tela.ts`/`main.ts` contra a `main` só tem as mudanças acima (nada de "À venda | Compradas",
`vigiarVersao` ou textos novos sumindo).

Conferência no `?mock` (a arte do kit pode ainda não existir: bonecos vazios e cenas antigas, de propósito):
`cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npm run dev` e abrir `http://localhost:5173/games/idle/?mock`.
Ver: o editor abre sozinho antes do Abrir CNPJ; "Bora" fecha e salva; recarregar a página, abrir o editor e fechar no X:
a cena fica com o fundador e o editor não volta até recarregar a página de novo (isto não tem teste automático);
Abrir CNPJ; no console `__rico(1e9)`; aba Contratar lista Oliveira, Bia e Teteu com "Contratar · R$ ..."; contratar a Bia
mostra "Trabalha pra você como ... por mais 6 dias"; tocar de novo rápido não cobra duas vezes; `__meContrata()` e
reabrir a aba mostra "Você trabalha pra Oliveira (..., por mais 6 dias)"; o placar marca "Mais disputado da semana";
desligar a rede e recarregar: o console avisa o arquivo que não carregou e a página continua.

- [ ] **Step 6: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add games/idle/tela.ts games/idle/tela.test.ts games/idle/idle.css games/idle/main.ts && git commit -m "Fellas Inc.: aba Contratar, editor de personagem e gente no palco"
```

---

### Task 8: No app: notificação "te contratou" e travas das migrações

**Files:**
- Create: `supabase/migrations/0039_notificacao_contrato.sql` (gerada pelo script do Step 3)
- Modify: `lib/notifications.ts`, `components/notifications/NotificationRow.tsx`, `app/(tabs)/notifications.tsx`,
  `types/database.ts`
- Test: `__tests__/notifications.test.ts`, `__tests__/notificationsScreen.test.tsx`, `__tests__/fellasIncMigration.test.ts`

**Interfaces:**
- Consome: `idle_contracts` (Task 3; RLS de membro, então a função `security invoker` lê); `openGame(slug)` de
  `lib/games.ts`; a `notifications_feed` mais recente (0021).
- Produz: tipo de notificação `idle_hired` (`actor_ids = [quem contratou]`, `body = cargo`, `latest_at = created_at`);
  texto "Ana te contratou como CEO de nada na Fellas Inc."; ícone `briefcase-outline`; tocar abre o jogo;
  `idle_weeks.Row.most_hired_id: string | null` no tipo do banco.

- [ ] **Step 1: Testes**

`__tests__/notifications.test.ts`, dentro do `describe('describeNotification')`:

```ts
  it('contrato na Fellas Inc. traz o cargo', () => {
    expect(notificationText(n({ kind: 'idle_hired', postId: null, body: 'CEO de nada' }))).toBe(
      'Ana te contratou como CEO de nada na Fellas Inc.',
    );
  });
```

`__tests__/notificationsScreen.test.tsx`: junto dos outros `jest.mock`, acrescente

```ts
const mockOpenGame = jest.fn();
jest.mock('../lib/games', () => ({ openGame: (slug: string) => mockOpenGame(slug) }));
```

e, depois do teste `'reação no meu story: toque abre o story'`:

```ts
  it('contrato na Fellas Inc.: toque abre o jogo', async () => {
    mockFetch.mockResolvedValue([item({ kind: 'idle_hired', postId: null, body: 'CEO de nada' })]);
    await open();
    await fireEvent.press(await screen.findByLabelText(/Ana te contratou como CEO de nada na Fellas Inc\./));
    expect(mockOpenGame).toHaveBeenCalledWith('idle');
    expect(mockPush).not.toHaveBeenCalled();
  });
```

`__tests__/fellasIncMigration.test.ts`: acrescente no fim do arquivo:

```ts
const gente = ler('0038_fellas_inc_gente.sql');
const genteSemComentarios = gente.split(/\r?\n/).map((l: string) => l.replace(/--.*$/, '')).join('\n');
const notificacao = ler('0039_notificacao_contrato.sql');
/** O `create or replace function public.notifications_feed ... $$;` de uma migração. */
const feed = (sql: string) => {
  const s = sql.replace(/\r\n/g, '\n');
  const ini = s.indexOf('create or replace function public.notifications_feed');
  return s.slice(ini, s.indexOf('$$;', ini) + 3);
};
const BLOCO_IDLE = /\n\n {4}union all\n {4}-- Fellas Inc\.: alguém me contratou[\s\S]*?c\.created_at >= me\.since\n/;

describe('Fellas Inc., entrega 2 (0038–0039)', () => {
  it('não toca nos créditos do cassino', () => {
    for (const proibido of ['game_wallets', 'game_ledger', 'games_move', 'weekly_champion']) expect(genteSemComentarios).not.toContain(proibido);
  });
  it('sem reset: nada apaga estado nem contrato', () => {
    for (const proibido of ['delete from public.idle_state', 'delete from public.idle_contracts']) expect(genteSemComentarios).not.toContain(proibido);
  });
  it('funções internas fechadas; as do jogo só para quem está logado', () => {
    for (const f of [
      'idle_avatar_json(uuid)', 'idle_json(public.idle_state)', 'idle_employee_mult(uuid)',
      'idle_social_mult(public.idle_state, timestamptz)', 'idle_rate_at(public.idle_state, timestamptz)', 'idle_rate(public.idle_state)',
      'idle_settle(public.idle_state, timestamptz)', 'idle_hire_price(public.idle_state)', 'idle_next_change(public.idle_state)',
      'idle_lock_all(uuid[])', 'idle_most_hired(date)', 'idle_weekly_reset()',
    ])
      expect(gente).toContain(`revoke all on function public.${f} from public, anon, authenticated;`);
    for (const f of ['idle_set_avatar(int, int, int, int, int, int, int)', 'idle_hire(uuid)', 'idle_pick_strategy(int, int)', 'idle_board()'])
      expect(gente).toContain(`grant execute on function public.${f} to authenticated;`);
  });
  it('tabelas novas com RLS e leitura só para membros', () => {
    for (const t of ['idle_avatar', 'idle_contracts']) {
      expect(gente).toContain(`alter table public.${t} enable row level security;`);
      expect(gente).toContain(`create policy "${t}_select_members" on public.${t} for select to authenticated using (public.is_member());`);
    }
  });
  it('o catálogo novo é o gerado', () => {
    expect(ler('0037_fellas_inc_catalogo_gente.sql')).toContain('GERADO por games/idle/catalogo.ts');
  });
  it('0039: a função de notificações é a da 0021 mais o idle_hired', () => {
    const nova = feed(notificacao);
    expect(nova).toMatch(BLOCO_IDLE);
    expect(nova.replace(BLOCO_IDLE, '\n')).toBe(feed(ler('0021_stories.sql')));
    expect(notificacao).toContain('grant execute on function public.notifications_feed(integer) to authenticated;');
  });
});
```

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && npx jest __tests__/notifications.test.ts __tests__/notificationsScreen.test.tsx __tests__/fellasIncMigration.test.ts`
Expected: FAIL (tipo `idle_hired` desconhecido; 0039 não existe).

- [ ] **Step 2: App**

`lib/notifications.ts`: no tipo `NotificationKind` acrescente `| 'idle_hired'`; no `KINDS`, `'idle_hired'`; no `switch` de
`describeNotification`, antes de `case 'mention':`:

```ts
    case 'idle_hired':
      return [...who, { text: ` te contratou como ${n.body ?? 'freela'} na Fellas Inc.` }];
```

`components/notifications/NotificationRow.tsx`, em `kindIcon`, antes de `case 'mention':`:

```tsx
    case 'idle_hired':
      return { name: 'briefcase-outline' };
```

`app/(tabs)/notifications.tsx`: `import { openGame } from '../../lib/games';` e, no começo de `open`:

```tsx
    if (n.kind === 'idle_hired') {
      openGame('idle'); // o contrato aparece no jogo (aba Contratar)
      return;
    }
```

`types/database.ts`, em `idle_weeks.Row`, depois de `podium: Json;`: `most_hired_id: string | null;`

- [ ] **Step 3: Migração 0039 (gerada a partir da 0021, sem redigitar a função)**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && node - <<'JS'
const fs = require('fs');
const dir = 'supabase/migrations';
const src = fs.readFileSync(`${dir}/0021_stories.sql`, 'utf8').replace(/\r\n/g, '\n');
const ini = src.indexOf('create or replace function public.notifications_feed');
const fn = src.slice(ini, src.indexOf('$$;', ini) + 3);
const ancora = '     where n.is_member and n.id <> me.uid and n.created_at >= me.since\n';
if (fn.split(ancora).length !== 2) throw new Error('âncora do "fella novo" não encontrada (ou repetida)');
const bloco = [
  '',
  '    union all',
  '    -- Fellas Inc.: alguém me contratou (o cargo vai no body; contrato não é apagado, então a notificação fica)',
  "    select 'idle_hired',",
  '           null::uuid,',
  '           null::uuid,',
  '           null::uuid,',
  '           array[c.employer_id],',
  '           1,',
  "           '{}'::text[],",
  '           c.cargo,',
  '           c.created_at',
  '      from public.idle_contracts c',
  '      cross join me',
  '     where c.employee_id = me.uid and c.created_at >= me.since',
  '',
].join('\n');
const sql = `-- fellasapp: notificação da Fellas Inc. "Fulano te contratou como [cargo]" (idle_hired). Idempotente.
-- A função é a da 0021 inteira (mesmo retorno, então create or replace basta) com um bloco a mais no fim do feed.
-- Depende da 0038 (idle_contracts). Fica fora do PGlite dos jogos: a função cita as tabelas de posts e stories.

${fn.replace(ancora, ancora + bloco)}

revoke all on function public.notifications_feed(integer) from public;
grant execute on function public.notifications_feed(integer) to authenticated;
`;
fs.writeFileSync(`${dir}/0039_notificacao_contrato.sql`, sql);
JS
```

Abra o arquivo gerado e confira a olho: o bloco `idle_hired` está logo depois do bloco "fella novo", antes do `  )` que
fecha o `feed`.

- [ ] **Step 4: Rodar tudo na raiz**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && npx tsc --noEmit && npm test`
Expected: PASS (inclusive `safeUpdateMigrations.test.ts` para 0037, 0038 e 0039).

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add supabase/migrations/0039_notificacao_contrato.sql lib/notifications.ts components/notifications/NotificationRow.tsx "app/(tabs)/notifications.tsx" types/database.ts __tests__/notifications.test.ts __tests__/notificationsScreen.test.tsx __tests__/fellasIncMigration.test.ts && git commit -m "Notificações: \"te contratou como...\" da Fellas Inc.; travas das migrações da entrega 2"
```

---

### Task 9: Arte: kit de personagem e estagiário oficial (fora do repositório)

**Files (em `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`, fora do repo; sem commit):**
- Create: `BRIEF-GENTE-KIT.md` (o texto abaixo), `kit.js`
- Produz: `png/pessoas/pose-1.png` … `pose-6.png`, `png/pessoas/estagiario-pose-3.png`, `estagiario-pose-4.png`,
  `png/pessoas/cadeira.png`, `conferencia/kit-*.png`

**Interfaces:**
- Produz: os arquivos do "Contrato de formato da arte" (kit). A Task 11 trava tamanhos e nomes.

- [ ] **Step 1: Salvar o brief** como `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/BRIEF-GENTE-KIT.md`:

```markdown
# Brief: kit de personagem da Fellas Inc. (entrega 2)

Leia antes `BRIEF-SPRITES.md` (contorno preto 1px, `telaComObjetos`, `cv.objeto/efeito/contornar`, paleta `P`) e veja
com Read `sprites/gerador-2-8x.png` (o estagiário, gerador 7 no jogo) e `cena-1-outline-6x.png` (o fundador como está
hoje). Não edite arquivo existente; crie só `kit.js`, `png/pessoas/*` e `conferencia/kit-*`. Não rode script de cena.
2 rodadas de revisão por pose. Pasta: `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos` (`cd ... &&` sempre).

## O que é
Cada fella monta o próprio personagem: pele, cabelo, roupa, algo na cabeça, e as cores. O jogo recorta as peças desta
folha, empilha e troca as cores na hora. O personagem aparece nas cenas 160x96 (2x no celular), no placar e nas cartas
de contratar. Tem que parecer do mesmo jogo das cenas: contorno preto, pixel duro, gente simpática e legível pequena.

## Formato (o jogo depende disto exatamente)
- Uma folha PNG transparente por pose: `png/pessoas/pose-N.png`. Caixas (largura x altura):
  1 sentado de costas 16x22 (você na cadeira; a cadeira NÃO entra, é da cena) ·
  2 em pé de costas 14x26 (um braço apontando pra frente/cima, a TV da cena 4) ·
  3 em pé de perfil 12x24, olhando para a direita, braço da frente dobrado com a mão PARADA no mesmo pixel em todos os
    quadros e roupas (o copo de café da cena 2 fica na camada da frente, na mão) ·
  4 sentado de perfil 14x20, olhando para a direita, mãos à frente (mesa, teclado, microfone são da cena) ·
  5 de frente 9x13, braços abertos (comemoração) ·
  6 deitado 16x10: só cabeça e ombro no travesseiro, olhando pra cima (o lençol é da cena).
- Folha = 4 colunas (quadros 0 a 3) x 16 linhas (peças); cada célula do tamanho da caixa da pose. Folha da pose 1 =
  64x352. Pose com 2 quadros desenhados repete: colunas 0,1,0,1. Animação pequena e visível (respirar, cabeça 1px,
  braço), 2+ pixels por mudança onde der.
- Linhas: 0 corpo (pele, olhos, boca) · 1 a 6 cabelo (curto, raspado, cacheado, black power, comprido, de lado) ·
  7 a 10 roupa (moletom, camiseta, camisa social, jaqueta) · 11 a 15 na cabeça (boné, fone, óculos, gorro, bandana).
  "Nada" na cabeça não tem linha. Peça que não aparece numa pose (óculos de costas) pode ficar com a célula vazia.
- O jogo empilha corpo → roupa → cabelo → acessório. Cada célula traz o próprio contorno preto (P.black, #0B0A0E):
  desenhe cada peça numa `telaComObjetos(w, h)` sem cor, `contornar()`, e copie para a folha. A caixa tem que caber o
  maior cabelo (black power) e o boné.
- Cor: tudo que muda de cor é pintado SÓ com os tons-marcador (RGB exato), sombra/meio/luz:
  pele #640000 #A00000 #DC0000 · cabelo #006400 #00A000 #00DC00 · roupa #000064 #0000A0 #0000DC ·
  acessório #640064 #A000A0 #DC00DC. Qualquer outra cor (contorno, branco do olho, boca) fica fixa. Nunca use os
  marcadores para outra coisa.
- Estagiário oficial (o Luis, o do gerador 7: boné vermelho r3/r2, camiseta clara paper/paperSh, cordão roxo p2 com
  crachá e o "L" dele): `png/pessoas/estagiario-pose-3.png` (48x24) e `estagiario-pose-4.png` (56x20), 4 quadros x 1
  linha, já colorido (sem marcadores), mesma postura das poses 3 e 4 do kit. É a única pessoa real; ninguém mais.
- Cadeira: `png/pessoas/cadeira.png` 24x30, transparente: cadeira de escritório preta vista de trás (encosto, base com
  rodinhas). O jogo desenha a pose 1 em (4, 2) e a cadeira POR CIMA: o encosto cobre as costas e deixa cabeça, ombros e
  braços à mostra.

## Cores do jogo (use nas prévias; são as de games/idle/personagem.ts)
- Pele 1 a 6: [#3B2418 #5A3A2A #7A4E36] [#5A3A2A #7A4E36 #8A5A48] [#6E4630 #8A5A48 #B98066] [#8A5A48 #B98066 #E0A27A]
  [#B98066 #E0A27A #F2C4A0] [#D69A7A #F2C4A0 #FBE0C8]
- Cabelo: preto [#060608 #0F0F13 #262C3A] castanho [#2E2019 #4E3628 #7A563D] loiro [#B8913A #E0B85A #FFE9A8]
  ruivo [#8C4A1C #C46A28 #E8954A] grisalho [#6B6874 #8E8A96 #B4B0BC] roxo [#3A2A66 #5B3FD9 #7E66E8]
  azul [#1E3A66 #2F6BB0 #5EC8FF] rosa [#8C2A5E #D94F9A #FF8CC6]
- Roupa e acessório: preto [#1A1A21 #2A2D38 #7084A6] branco [#C9C4B8 #E4E0D6 #F4F1EA] cinza [#3A3940 #55535E #8E8A96]
  vermelho [#5E1A28 #C23B53 #FF5A6E] laranja [#8C4A1C #E8954A #F6C08A] amarelo [#AC832F #C9962F #FFD25E]
  verde [#1F4A30 #2F6B45 #5ED18A] azul [#1E2A3F #2F4F80 #5EC8FF] roxo [#3A2A66 #5B3FD9 #B8A2FF] rosa [#8C2A5E #D94F9A #FF8CC6]
- Padrão (quem nunca montou o personagem): Pele 4, cabelo curto preto, moletom preto, fone roxo. Tem que ficar igual
  ao fundador das cenas de hoje (o preto do moletom tem o contorno de luz k3 = #7084A6 como tom "luz").

## Conferência
No `kit.js`, monte pessoas como o jogo faz (copiar as células, empilhar corpo → roupa → cabelo → acessório, trocar
cada marcador pelo tom da cor, espelhar se precisar) e salve com `png()` de `pixel.js`:
- `conferencia/kit-pose-N.png` em 8x, no tema escuro (#121212) e no claro (#F4F1EA): linha 1 os 6 cabelos com o
  padrão; linha 2 as 4 roupas; linha 3 os 6 acessórios; linha 4 oito visuais sorteados; linha 5 os 4 quadros do padrão.
- `conferencia/kit-padrao.png`: o padrão na pose 1 ao lado do fundador recortado do quadro 0 de
  `png/cena-1-animada-tira.png`, para comparar.
- `conferencia/kit-estagiario.png`: as folhas do estagiário ao lado de `png/gerador-2.png`.

## Relatório
Curto: o que cada pose faz nos quadros, o pixel da mão da pose 3, o que ficou pendente.
```

- [ ] **Step 2: Rodar o artista** (subagente de arte, ou o próprio executor) com o brief acima e só ele. Saída: os
arquivos de `png/pessoas/` e as conferências.

- [ ] **Step 3: Conferir os tamanhos** (antes da Task 10):

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos && node -e "for (const f of require('fs').readdirSync('png/pessoas')) { const b = require('fs').readFileSync('png/pessoas/' + f); console.log(f, b.readUInt32BE(16) + 'x' + b.readUInt32BE(20)); }"
```

Expected: pose-1 64x352 · pose-2 56x416 · pose-3 48x384 · pose-4 56x320 · pose-5 36x208 · pose-6 64x160 ·
estagiario-pose-3 48x24 · estagiario-pose-4 56x20 · cadeira 24x30.

- [ ] **Step 4: Ver com Read** `conferencia/kit-padrao.png` e `conferencia/kit-pose-1.png`; se o padrão não parecer o
fundador, devolver ao artista com o que mudar.

---

### Task 10: Arte: cenas em camadas com vagas (fora do repositório)

**Files (em `../fellas-inc-esbocos`; sem commit):**
- Create: `BRIEF-GENTE-CENAS.md`, `ler-png.js`, `camadas-cena1.js` (cena 1, "antes" e "abrindo"), `camadas-cenaN.js`
  (N = 2..6), `previa-camadas.js`
- Produz: `png/camadas/<nome>-fundo.png`, `<nome>-frente.png`, `<nome>-vagas.json` para as 8 cenas;
  `conferencia/<nome>-montada-quadros.png` e `<nome>-montada-6x.gif`

**Interfaces:**
- Consome: o kit da Task 9 (`png/pessoas/`).
- Produz: os arquivos do "Contrato de formato da arte" (cenas). A Task 11 trava tamanhos, vagas e contagens.

- [ ] **Step 1: Salvar o brief** como `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos/BRIEF-GENTE-CENAS.md`:

```markdown
# Brief: cenas da Fellas Inc. em camadas, com vagas (entrega 2)

Leia antes `BRIEF-CENAS.md` (estilo, contorno, animação) e `BRIEF-GENTE-KIT.md` (o kit, já pronto em `png/pessoas/`).
Veja com Read as cenas aprovadas (`cena-2-6x.png` … `cena-6-6x.png`, `cena-1-outline-6x.png`). Não edite arquivo
existente. 2 rodadas de revisão por cena. Pasta: `C:/Users/juan/Documents/PROJETOSLLM/fellas-inc-esbocos`.

**NUNCA rode `cena1-detalhada.js`, `cena1-outline.js` nem `cena1-extras.js`**: eles sobrescrevem a arte que o dono
editou à mão. Também não rode `cena2.js` … `cena6.js`: copie o código que precisar para os seus arquivos.

## O que muda
Hoje cada cena é uma tira com o fundador (e o estagiário) desenhados. Agora são três arquivos e o jogo põe a gente:
você, quem você contratou e, nas vagas sobrando, um freela. A cena tem que continuar parecendo a mesma, com o fundador
(o padrão do kit) no mesmo lugar.

## Formato (o jogo depende disto exatamente)
Para cada cena: `cena-0-antes` (8 quadros), `cena-0-abrindo` (12, toca uma vez), `cena-1` a `cena-4` (8), `cena-5`
(12), `cena-6` (8). Salvar em `png/camadas/`:
- `<nome>-fundo.png`: tira (quadros x 160) x 96, todo pixel opaco: a cena sem as pessoas das vagas. Gente que não é vaga
  (silhuetas ao fundo, o estagiário servindo café na cena 4) pode ficar.
- `<nome>-frente.png`: tira do mesmo tamanho, transparente, só com o que fica NA FRENTE das pessoas (encosto da cadeira,
  beira da mesa, o copo de café na mão do estagiário). Obrigatória, mesmo vazia. Objeto da frente traz o próprio
  contorno do lado de quem está atrás dele.
- `<nome>-vagas.json`: `{ "quadros": 8, "vagas": [ ... ] }`, cada vaga com `id`, `papel` ("dono" ou "contratado"),
  `pose` (1 a 6), `x`, `y` (canto de cima à esquerda da caixa da pose, inteiros, caixa inteira dentro de 160x96),
  `espelhada` (true = virada; perfil sem espelhar olha para a direita) e, nas de contratado, `freela`: `"estagiario"`
  ou um visual fixo `{ "pele": 0-5, "cabelo": 0-5, "cor_cabelo": 0-7, "roupa": 0-3, "cor_roupa": 0-9,
  "acessorio": 0-5, "cor_acessorio": 0-9 }`. Opcional `trilha`: uma entrada por quadro, cada uma `{ "x", "y", "pose",
  "espelhada" }` (só o que muda) ou `null` (a pessoa some naquele quadro).
- Exatamente 1 vaga "dono". A ordem das vagas de contratado no JSON é a ordem de ocupação (a 1ª recebe o contrato mais
  recente): ponha primeiro a vaga mais visível. O jogo desenha quem tem o pé mais alto na tela antes (atrás).
- A borda de quem está na vaga cai sobre a borda do objeto em que encosta (linha única), como nas cenas de hoje.

## As vagas de cada cena
| Cena | Você (dono) | Contratados (na ordem do JSON) |
|---|---|---|
| cena-0-antes | pose 6, deitado na cama | nenhum |
| cena-0-abrindo | trilha: pose 6 deitado nos primeiros quadros; `null` na transição (o lençol/a porta/um "puf" na frente); pose 1 na cadeira no fim | nenhum |
| cena-1 | pose 1, sentado de costas | nenhum |
| cena-2 | pose 1 | `estagiario`: pose 3 chegando com café (copo na camada da frente), freela "estagiario" |
| cena-3 | pose 1 | `ppp-apresentador` (pose 4) e `ppp-convidado` (pose 4 espelhada), freelas genéricos; `mesa-estagiario` (pose 4), freela "estagiario" (por último: o estagiário oficial fica até o 3º contrato) |
| cena-4 | pose 2, em pé apontando a TV | `trader`, `mesa-1`, `mesa-2` (pose 4 ou 1), `pingue-1` e `pingue-2` (pose 3, um espelhado), freelas genéricos |
| cena-5 | pose 5, braços abertos na cobertura | `danca-1`, `danca-2`, `dj` (pose 5), `tapete` (pose 3, no tapete vermelho), freelas genéricos |
| cena-6 | você decide (pose 5 na janela, ou 1) | até 5, você decide |

Freelas genéricos: visuais variados (peles, cabelos e roupas diferentes), ninguém real. Se a escala do kit não casar
com a cena (a cobertura da cena 5 vista de longe), redesenhe aquela parte para caber (aproxime), sem perder o que foi
aprovado.

## Como fazer
- Cenas 2 a 6: `camadas-cenaN.js` com o código de desenho copiado de `cenaN.js`. Fundo = a cena sem as pessoas das
  vagas (redesenhe o que ficava atrás delas: cadeira, parede, mesa). Frente = numa `telaComObjetos` sem cor, só os
  objetos que cobrem as pessoas, com contorno.
- Cena 1, "antes" e "abrindo": a arte final foi editada à mão; parta dos PNGs `png/cena-1-animada-tira.png`,
  `png/cena-1-antes-animada-tira.png` e `png/cena-1-abrindo-animada-tira.png`. Escreva `ler-png.js` (decodifica PNG
  RGBA ou RGB de 8 bits com `zlib.inflateSync` e os filtros 0 a 4) e `camadas-cena1.js`, que apaga o fundador
  repintando o que fica atrás dele e recorta a frente.
- `previa-camadas.js`: monta como o jogo (fundo → pessoas, pé mais alto primeiro → frente; quadro da pose = quadro da
  cena % 4; trilha; troca de cores; espelho), com o padrão na vaga de dono e (a) os freelas e (b) 5 visuais sorteados
  nos contratados. Salva `conferencia/<nome>-montada-quadros.png` e `<nome>-montada-6x.gif`. Compare com a cena
  aprovada: tem que ser a mesma cena.

## Relatório
Curto: para cada cena, as vagas (id, pose, x, y), o que mudou no desenho para caber o kit, pendências.
```

- [ ] **Step 2: Rodar o artista** com o brief acima e só ele.

- [ ] **Step 3: Ver com Read** `conferencia/cena-2-montada-quadros.png`, `cena-3-…` e `cena-0-abrindo-…`; devolver
ao artista o que estiver fora (pessoa boiando, linha dupla, frente cobrindo cabeça).

---

### Task 11: Copiar a arte para `games/idle/assets/` e travar o formato

**Files:**
- Create: `games/idle/assets/pessoas/*.png`, `games/idle/assets/cenas/*-fundo.png`, `*-frente.png`, `*-vagas.json`
- Delete: `games/idle/assets/cenas/cena-0-antes.png`, `cena-0-abrindo.png`, `cena-1.png` … `cena-6.png` (as tiras antigas)
- Modify: `games/idle/ativos.test.ts`

**Interfaces:**
- Consome: a arte das Tasks 9 e 10; `POSES`, `QUADROS_POSE`, `LINHAS_KIT`, `CADEIRA`, `VAGAS_CONTRATADO`,
  `validarVagas` (Task 6); `CENAS` (palco).

- [ ] **Step 1: Teste do formato (acrescentar em `games/idle/ativos.test.ts`; os imports vão para o topo do arquivo)**

```ts
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { CADEIRA, LINHAS_KIT, POSES, QUADROS_POSE, validarVagas, VAGAS_CONTRATADO, type Pose, type Vagas } from './montagem';
import { CENAS as RITMO } from './palco';

const pasta = resolve(__dirname, 'assets');
/** Largura e altura de um PNG (o cabeçalho IHDR). */
const dim = (arq: string) => {
  const b = readFileSync(resolve(pasta, arq));
  return [b.readUInt32BE(16), b.readUInt32BE(20)];
};

describe('arte da entrega 2 (contrato de formato)', () => {
  it('toda cena em camadas: fundo e frente do tamanho da tira, vagas válidas com as contagens da spec', () => {
    for (const c of CENAS) {
      const q = RITMO[c].quadros;
      expect(dim(`cenas/${c}-fundo.png`), c).toEqual([q * 160, 96]);
      expect(dim(`cenas/${c}-frente.png`), c).toEqual([q * 160, 96]);
      const vagas = JSON.parse(readFileSync(resolve(pasta, `cenas/${c}-vagas.json`), 'utf8')) as Vagas;
      expect(validarVagas(vagas, q, VAGAS_CONTRATADO[c]), c).toEqual([]);
      expect(ativos.camadas(c).vagas, c).not.toBeNull();
    }
  });
  it('não sobrou tira antiga (sem camadas)', () => {
    expect(readdirSync(resolve(pasta, 'cenas')).filter((f) => /^cena-\d(-antes|-abrindo)?\.png$/.test(f))).toEqual([]);
  });
  it('kit: 6 folhas de 4 quadros × 16 linhas; estagiário em toda pose que uma vaga dele usa; cadeira', () => {
    for (const p of [1, 2, 3, 4, 5, 6] as Pose[]) {
      expect(dim(`pessoas/pose-${p}.png`), `pose ${p}`).toEqual([QUADROS_POSE * POSES[p].w, LINHAS_KIT * POSES[p].h]);
    }
    const poses = new Set<Pose>();
    for (const c of CENAS) {
      for (const g of ativos.camadas(c).vagas!.vagas) {
        if (g.freela !== 'estagiario') continue;
        poses.add(g.pose);
        for (const t of g.trilha ?? []) if (t?.pose) poses.add(t.pose);
      }
    }
    for (const p of poses) expect(dim(`pessoas/estagiario-pose-${p}.png`), `estagiário pose ${p}`).toEqual([QUADROS_POSE * POSES[p].w, POSES[p].h]);
    expect(dim('pessoas/cadeira.png')).toEqual([CADEIRA.w, CADEIRA.h]);
  });
  it('o estagiário oficial tem vaga nas cenas 2 e 3', () => {
    for (const c of ['cena-2', 'cena-3'] as const) {
      expect(ativos.camadas(c).vagas!.vagas.some((g) => g.freela === 'estagiario'), c).toBe(true);
    }
  });
});
```

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx vitest run idle/ativos.test.ts`
Expected: FAIL (os arquivos ainda não estão no repo).

- [ ] **Step 2: Copiar e apagar as tiras antigas**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && mkdir -p games/idle/assets/pessoas && cp ../fellas-inc-esbocos/png/pessoas/*.png games/idle/assets/pessoas/ && cp ../fellas-inc-esbocos/png/camadas/* games/idle/assets/cenas/ && git rm games/idle/assets/cenas/cena-0-antes.png games/idle/assets/cenas/cena-0-abrindo.png games/idle/assets/cenas/cena-1.png games/idle/assets/cenas/cena-2.png games/idle/assets/cenas/cena-3.png games/idle/assets/cenas/cena-4.png games/idle/assets/cenas/cena-5.png games/idle/assets/cenas/cena-6.png
```

- [ ] **Step 3: Rodar tudo de `games/` e o build**

Run: `cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npx tsc --noEmit && npx vitest run && npm run build`
Expected: PASS. Se `validarVagas` acusar algo, o erro diz a vaga e o quadro: devolver ao artista (Task 10), não
"consertar" o JSON à mão sem ver a prévia.

- [ ] **Step 4: Conferir no `?mock`**

`cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp/games && npm run dev`, abrir `http://localhost:5173/games/idle/?mock`:
o editor mostra o boneco de frente e na cadeira, e a prévia muda com cada toque; "Bora" e a cena "antes" mostra você
deitado com o visual escolhido; Abrir CNPJ toca o "abrindo" com você; `__rico(1e9)`, comprar até a era 2: a cena 2
mostra o estagiário oficial; contratar a Bia: ela entra na vaga do estagiário; "Mudar visual" muda você na cena na
hora; cartas e placar mostram os bonecos.

- [ ] **Step 5: Commit**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git add games/idle/assets games/idle/ativos.test.ts && git commit -m "Fellas Inc.: arte da entrega 2 (kit de personagem, estagiário oficial, cenas em camadas com vagas)"
```

---

### Task 12: Conferência final, banco e publicação

- [ ] **Step 1: Tudo verde no branch**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && npx tsc --noEmit && npm test && cd games && npx tsc --noEmit && npx vitest run && npm run build
```

Expected: tudo passa.

- [ ] **Step 2: Banco de produção (o Juan roda)** — pedir ao Juan, no terminal dele:
`! npx supabase migration list` (pendentes só 0037, 0038 e 0039; a 0036 sem-reset já foi antes; se aparecer outra,
parar e conversar) e depois `! npx supabase db push`.

- [ ] **Step 3: Conferir pela REST que entrou (antes de qualquer push na `main`)**

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && set -a && . ./.env && set +a && for q in "idle_weeks?select=most_hired_id" "idle_avatar?select=cor_acessorio" "idle_contracts?select=ends_at" "idle_cat_cargo?select=nome"; do curl -s -o /dev/null -w "$q %{http_code}\n" "$EXPO_PUBLIC_SUPABASE_URL/rest/v1/$q&limit=1" -H "apikey: $EXPO_PUBLIC_SUPABASE_ANON_KEY"; done
```

Expected: 200 ou 401 (existe; anônimo não tem permissão) em todos; 400 ("column ... does not exist") ou 404 = a
migração não entrou: parar e avisar o Juan.

- [ ] **Step 4: Publicar** — merge local na `main`, conferir e push (o deploy roda os testes e builda `dist/games/idle/`):

```bash
cd C:/Users/juan/Documents/PROJETOSLLM/fellasapp && git checkout main && git pull --ff-only && git merge --no-ff fellas-inc-gente -m "Fellas Inc.: entrega 2 (gente)" && npx tsc --noEmit && npm test && npm test --prefix games && git push origin main && git branch -d fellas-inc-gente
```

- [ ] **Step 5: Conferência real (com o Juan e mais um fella)** — `https://fellasapp.pages.dev/games` no celular:
o editor abre antes do Abrir CNPJ (para quem nunca salvou o visual); "Bora"; a cena mostra o personagem; na aba
Contratar, contratar alguém que já abriu a empresa (o preço some do valuation; a produção sobe 10%; a carta diz
"por mais 6 dias"); o contratado vê "Fulano te contratou como … na Fellas Inc." nas notificações do app e, tocando, cai
no jogo com "Você trabalha pra …"; o placar marca o mais disputado da semana. Na segunda seguinte, conferir
`idle_weeks.most_hired_id` e que os contratos e empresas continuam; uma semana depois do contrato, conferir que ele
venceu (sai da equipe, a produção volta) e que dá para contratar de novo.

---

## Autorrevisão

- **Cobertura da spec (entrega 2, com as decisões de 10/10):** 5 contratar (quem pode, preço com contratos ativos,
  +10%/+2%, piso, um contrato ativo por par, sem demissão, cargo, 7 dias, mais disputado) → Tasks 1, 3, 4, 7;
  notificação (5, 8.3) → Task 8; estratégias Networking, Cultura de startup e "contratar custa ×2" de Abrir capital →
  Tasks 1, 3; 7.1 kit (poses, peças, cores, marcadores, padrões, freelas, estagiário oficial) → contrato de formato,
  Tasks 2, 6, 9, 11; 7.2 editor → Tasks 2 (banco), 7 (tela); 7.3 vagas (camadas, ordem de ocupação, montagem em
  memória, linha única, quadros 2/4 no loop de 8/12) → contrato de formato, Tasks 6, 10, 11; 8.1 segunda 00:00 sem
  reset (foto com o mais disputado; nada apaga contrato, empresa ou personagem) → Task 4; 8.2 aba Contratar e
  personagem no placar → Task 7; 9.1 `idle_contracts`, `idle_avatar`, `idle_weeks.most_hired_id` → Tasks 2, 3, 4; 9.2
  `idle_hire`, `idle_set_avatar`, paridade (inclusive o vencimento no meio) → Tasks 2, 3; 10 arte → Tasks 9–11; 11
  testes (par único, preço crescente, vencimento, faixas inválidas, ninguém escreve no personagem dos outros, troca de
  cores, montagem das camadas, ordem das vagas, paridade, simulação com o piso) → Tasks 2, 3, 5, 6. Propriedades,
  prestígio e conquistas ficam para a entrega 3 (no prestígio, os contratos que a pessoa fez acabam).
- **Nomes conferidos entre tasks:** `idle_avatar_json`, `idle_json`, `idle_set_avatar`, `idle_employee_mult`,
  `idle_social_mult(s, t)`, `idle_rate_at(s, t)`, `idle_rate(s)`, `idle_settle`, `idle_hire_price`, `idle_next_change`,
  `idle_lock_all`, `idle_hire`, `idle_most_hired`; `Social`, `SOLO`, `multContratos`, `acumularTrechos`; `vencido`;
  `Imagem`, `vazia`, `recortar`, `colar`; `Visual`, `Campo`, `Tons`, `FAIXAS`, `CAMPOS`, `PADRAO`, `MARCADORES`,
  `PELES`, `CORES_CABELO`, `CORES`, `valido`, `sortear`, `chave`, `trocarCores`; `Pose`, `POSES`, `QUADROS_POSE`,
  `LINHAS_KIT`, `CADEIRA`, `Kit`, `Vaga`, `Vagas`, `VAGAS_CONTRATADO`, `boneco`, `naCadeira`, `ocuparVagas`,
  `posicaoNoQuadro`, `montarTira`, `validarVagas`; `Camadas`, `ativos.camadas/pose/estagiario/cadeira`; `Desenhar`,
  `carregarImagem`, `pintar`, `carregarKit`, `criarDesenhista`; `Gente`, `chaveGente`, `palco.gente/preparar`;
  `IdleVisual`, `IdleContratado.ate`, `IdleChefe.ate`, `IdleState.muda_em`, `LinhaPlacar`, `linhaPlacar`, `idleHire`,
  `idleSetAvatar`; `Modelo.editor`, `Acoes.contratar/editor/mudarVisual`, `porcento`, `empresas`, `restam`.
- **Numeração:** 0035 placar por R$/s e 0036 sem reset (pré-requisitos, fora deste plano); 0037 catálogo gerado (Task 1,
  feita); 0038 lógica; 0039 notificação. `games/test/db.ts` e `games/dev/mockDb.ts` listam 0035 a 0038 (a 0039 não roda
  no PGlite).
- **Conferido no PGlite ao revisar o plano (10/10):** o SQL das Tasks 2–4 montado como a 0038, com as migrações reais
  0027–0037, passou nos testes de banco das Tasks 2–4, na paridade (inclusive o vencimento no meio) e nos testes do
  núcleo com os ajustes do piso; a `tela.ts` com as edições da Task 7 passou nos testes da tela (os de antes e os novos).
- **Foco da revisão:** itens 1 a 4 têm teste nas Tasks 3, 4 e 5; o 5 tem teste nas Tasks 2 e 6 e conferência à mão no
  `?mock` (Task 7) para a parte que mora no `main.ts`.
