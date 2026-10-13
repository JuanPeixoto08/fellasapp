# Fellas Inc.: árvore sem Tempo, com Dourados e Horta

Data: 13/10/2026. Aprovado em conversa pelo Juan ("ta bom assim").

## O que o Juan pediu

O ramo Tempo da árvore não faz sentido: "ele já gera dinheiro fechado, não tem pra que". Ele escolheu:
- tirar o limite de 8h com o jogo fechado;
- trocar o ramo Tempo por um ramo de **Dourados** (eventos na tela);
- **somar** um 6º ramo, **Horta**, à direita do Gente.

## 1. Sem limite com o jogo fechado

- `idle_settle` rende de `settled_at` até `ts` inteiro. Sai o `least(ts, settled_at + teto)`.
- Em `economia.ts`:
  - sai `TETO_SEGUNDOS`;
  - `acumular` e `acumularPorTrechos` (e quem chama: `store.ts`, `simulacao.ts`) perdem o parâmetro `tetoS`;
  - `EfeitosArvore.tetoS` sai.
- Tirar também `'tetoS'` de `idle_arvore_efeitos`, porque o teste de paridade compara as chaves.
- O tipo de nó `teto` sai de `TipoNo`.
- Nada mais no banco usa `teto`. A horta já anda sozinha até 7 dias pra trás (`v_agora - 2015` passos), e isso não muda.

## 2. Ramo 4 vira Dourados (ids 41–45, custos 2/4/8/15/30)

Os ids não mudam: quem comprou um nó do Tempo fica com o nó do Dourados da mesma posição. Não há ponto pra devolver.

| id | Nome | Efeito (texto do nó) | tipo | valor | junta |
|---|---|---|---|---|---|
| 41 | Pé de coelho | Eventos aparecem 50% mais vezes. | `dourado_freq` | 1,5 | maior |
| 42 | Olho de lince | Eventos ficam 24 s na tela (no lugar de 12). | `dourado_tela` | 24 | maior |
| 43 | Investidor anjo | Investidor apressado rende 40 min de produção (no lugar de 20). | `dourado_investidor` | 2 | mult |
| 44 | Hype de lançamento | Viralizou e Promoção duram o dobro. | `dourado_duracao` | 2 | maior |
| 45 | Dia de sorte | Eventos aparecem 2× mais vezes. | `dourado_freq` | 2 | maior |

Regras:
- **Frequência.** Hoje um segundo vale se `h2 mod 600 = 0`. Além disso, com o Gemaplys, também vale um segundo extra quando `mistura(h2+777) mod 2400 < 4·gema`.
  - A frequência `f` da árvore entra nesse mesmo extra: o segundo vale se `mistura(h2+777) mod 2400 < 4·(gema + f − 1)`.
  - Sem nada, `f = 1` e o extra é zero.
  - Com f = 2 e sem Gemaplys, a chance vira 2/600; com o Gemaplys na frente, 3/600.
  - Igual em `dourados.ts douradoEm` e em `idle_dourado`. `idle_dourado` ganha um parâmetro `freq double precision default 1`.
- **Tempo na tela.** Base `T` = 12, ou 24 com o nó 42.
  - Na tela: `janelaS = T·(1 − gema/2)`.
  - No banco: `idle_dourado_pegar` aceita até `T + 3 − T·gema/2` (hoje `15 − 6·gema`).
- **Investidor.** O ganho passa a ser `rate · 1200 · investidor · (1 + bônus de oportunidades da horta)`.
  - O texto que sobe ao pegar (`textoPegou`, em `main.ts` com `rate*1200`) usa o mesmo multiplicador.
- **Duração.** Com `d` = 2:
  - A Promoção dura 30·d s e o Viralizou 60·d s.
  - `idle_settle` usa `v − 60·d s` como começo do Viralizou. O nó só pode mudar `d` depois de pegar o evento, e nesse momento `settled_at` já passou do começo: não muda nada pra trás.
  - O mesmo em `economia.ts` (`VIRAL_MS` vira função da duração).
  - Os textos "por 30 s" e "por 1 min" seguem `d`.
- As faixas do MC V.V não mudam na frequência; o tempo na tela, o Investidor e a duração valem pra elas também, porque é o mesmo pegar.

## 3. Ramo 6: Horta (ids 61–65, mesmos custos)

| id | Nome | Efeito (texto do nó) | tipo | valor | junta |
|---|---|---|---|---|---|
| 61 | Borra de café no adubo | Plantas novas amadurecem 25% mais rápido. | `horta_amadurece` | 0,75 | menor |
| 62 | Regador automático | Plantas novas vivem 50% a mais depois de maduras. | `horta_vida` | 1,5 | maior |
| 63 | Abelha influencer | Cruzamento 2× mais fácil. | `horta_cruza` | 2 | maior |
| 64 | Agrotóxico liberado | Bônus das plantas ×1,5 (descontos seguem até 50%). | `horta_bonus` | 1,5 | maior |
| 65 | Morango do amor | Morango com Pescoço brota 5× mais. | `horta_morango` | 5 | maior |

Regras:
- **61 e 62.** Os tempos são gravados na planta ao plantar ou brotar, junto com o Terry.
  - `amadurece_s = k.amadurece_s · (1 − 0,30·terry) · amadurece`
  - `vida_s = k.vida_s · (1 − 0,20·terry) · vida`
  - Vale em `idle_horta_plantar` e no brotar de `idle_horta_avancar`. Planta que já estava no chão não muda.
- **63.** A chance de cruzar por passo vira `0,05 · (1 + vini) · cruza`.
- **64.**
  - Em `idle_horta_bonus` e `horta.ts bonusHorta`, cada soma é multiplicada por `bonus` antes do teto de 50% dos descontos. O Coentro também fica ×1,5 no −1%, de propósito.
  - `idle_horta_bonus` recebe o multiplicador como parâmetro, `mult double precision default 1`. Assim continua `sql` puro, e quem chama passa `idle_arv(u,'horta_bonus','max',1)`.
  - Na tela, `bonusHorta` ganha o mesmo parâmetro.
- **65.** O Morango de planta morta passa de `< 0.001` pra `< 0.001 · morango`.
- O ramo Horta aparece pra todo mundo, mesmo sem Food truck. Os nós dizem o que fazem, e sem horta o efeito só não tem onde valer.

## 4. Árvore na tela

- `RAMOS` ganha 'Horta' no índice 6 e troca 'Tempo' por 'Dourados'.
  - `RAMOS_ARVORE`, `ROTULOS_ARVORE`, `ondeNo` e `noInicial` já leem do catálogo.
  - O teste "id = ramo·10 + posição" passa a cobrir os ramos 1 a 6.
- **Copa com 6 ramos.**
  - O mundo cresce de 400 pra 480 de largura; a altura fica 540.
  - A raiz vai pra (240, 510).
  - Os ramos abrem em leque, 3 de cada lado: Produção, Recomeço e Oportunidades à esquerda; Dourados, Gente e Horta à direita.
  - Posições novas em `POSICOES_ARVORE`, com distância mínima entre nós igual ou maior que a de hoje (o teste de distância segue valendo).
  - Conferir no navegador, no PC e no celular (390×844), que a copa cabe e que os rótulos não batem.
- **Ícones.**
  - 10 ícones novos de 16×16 (`no-41.png` a `no-45.png` refeitos e `no-61.png` a `no-65.png`), gerados em `../fellas-inc-esbocos/legado-arvore.js`, no mesmo estilo.
  - Ideias: trevo/pé de coelho, olho, anjo com maleta, megafone, dado; grão de café, regador, abelha, galão, morango com pescoço.
- **Caixinha.** A árvore já mostra o efeito do nó no painel de detalhe (o próprio item mostra tudo), então nó não ganha caixinha nova.
  - O que muda são os textos que já citam números que a árvore passa a alterar:
    - a caixinha do Gemaplys ("eram 12" passa a ser o T da pessoa);
    - os textos de pegar evento (Promoção e Viralizou com a duração de verdade; Investidor com o ganho de verdade);
    - o resumo de bônus da Horta (já sai de `bonusHorta`, então vem certo).

## 5. Catálogo, banco e testes

- **Migração 0060 `fellas_inc_catalogo_arvore`.**
  - Gerada com `ATUALIZAR_CATALOGO=0060_fellas_inc_catalogo_arvore.sql npx vitest run idle/catalogo.test.ts`, depois de mudar `nomes.ts`.
  - Muda o catálogo inteiro, com os nós 41–45 novos e 61–65.
- **Migração 0061 `fellas_inc_arvore_dourados_horta`.** Recria:
  - `idle_settle` (sem teto, duração do Viralizou);
  - `idle_arvore_efeitos` (sem tetoS; com os tipos novos);
  - `idle_dourado` (freq) e `idle_dourado_pegar` (freq, T, investidor, duração);
  - `idle_horta_bonus` (mult) e quem a chama;
  - `idle_horta_avancar` e `idle_horta_plantar` (tempos, cruza, morango).
  - Mantém os `revoke` das funções internas.
- `EfeitosArvore` ganha os campos `douradoFreq`, `douradoTela`, `douradoInvestidor`, `douradoDuracao`, `hortaAmadurece`, `hortaVida`, `hortaCruza`, `hortaBonus` e `hortaMorango`. São os mesmos nomes no `idle_arvore_efeitos`, por causa da paridade.
- Registrar 0060 e 0061 em `games/test/db.ts` e `games/dev/mockDb.ts`.
- **Testes, sempre o teste que falha primeiro:**
  - paridade TS×SQL do `idle_arvore_efeitos`;
  - `idle_settle` rendendo 3 dias fechado sem parar em 8h;
  - `idle_dourado` com freq igual ao `douradoEm`;
  - pegar evento com Olho de lince aos 20 s dá certo, e sem ele dá `idle_dourado_gone`;
  - Investidor anjo paga 2400 s;
  - Hype: Promoção de 60 s e Viralizou rendendo ×10 por 120 s;
  - plantar com 61/62 grava os tempos;
  - cruzamento e morango com 63/65 (forçando a sorte como os testes da horta já fazem);
  - bônus ×1,5 com teto de 50%;
  - copa com 6 ramos (posições, rótulos, distância).
- **Novidade** no começo de `novidades.ts`: "Árvore nova: Dourados e Horta". Fala que o jogo fechado rende sem limite, que o Tempo virou Dourados (quem tinha nó ficou com o da mesma posição) e que há um ramo de Horta.

## 6. Publicação

- **Conflito com a outra sessão.** O Mapa do rolê (worktree `fellasapp-mapa`) já tem a 0056–0058, ainda não aplicadas, e a 0056 é um catálogo inteiro.
  - O teste do catálogo compara `nomes.ts` com o catálogo de número mais alto.
  - Quem publicar depois precisa regerar o próprio catálogo com as duas mudanças e numerar acima do último aplicado.
  - Na hora de publicar, conferir `supabase migration list` e decidir com o Juan.
- O Juan roda o `db push`. Eu confiro no banco (funções novas e nós 41–45/61–65 no `idle_cat_no`) e então faço o merge e o push da main.
