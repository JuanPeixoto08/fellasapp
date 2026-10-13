# Fellas Inc.: Mapa do rolê, parte 3 (lugar 4, o copão) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A mecânica do lugar 4 (o copão): um cardápio de copões (base, mistura, extra, tamanho, força, preço, nome)
que vende sozinho toda noite de verdade; nota de 0 a 999 na primeira noite mostrada como o chat da galera; risco de PT;
novidade que cansa; sexta com DJ; caderninho; desafios; 2 conquistas; arte de bar à noite com 10 DJs reconhecíveis.

**Architecture:** Igual à camisetaria (parte 2): troca os stubs `idle_cup_*` da moldura e preenche `MECANICAS[4]`.
Resultados determinísticos calculados na hora de pôr o copão no cardápio; o que depende do tempo (as noites, as vendas, o
PT, a galera) anda em `idle_cup_avancar` (só moeda/fãs e campos do copão); revelação, pódio, caderninho, desafio e
conquistas em `idle_cup_depois`. Contas puras em `games/idle/copao.ts` com paridade exata no SQL (`0059`). A última noite
fechada vai no json (`ultima_noite`) para a tela mostrar o que aconteceu enquanto a pessoa estava fora.

**Tech Stack:** Postgres/Supabase (plpgsql), PGlite, TypeScript + DOM, vitest (happy-dom), Node (arte fora do repo).

**Spec:** `docs/superpowers/specs/2026-10-12-fellas-inc-mapa-do-role-design.md` §5 (copão), §3, §4.4 (padrões da parte 2),
§7, §9. Contrato da moldura no topo de `games/idle/mecanicas.ts` e no bloco da 0057.

## Global Constraints

- Worktree `../fellasapp-mapa`, branch `mapa-do-role`. **Sem merge, push ou `db push`** (o Juan testa o lote antes).
- Privacidade: nada de nome real de **lugar**. Os 10 DJs são artistas reais escolhidos pelo Juan; o nome e o estilo deles
  entram no jogo; **nenhum texto inventa fala, opinião ou fato sobre eles** (o chat zoa o copão e a noite, não o artista).
  Retratos 64×64 desenhados a partir de fotos que o Juan manda; as fotos **não** entram no repositório nem no esboço.
- Migrações: 0056 (catálogo) e 0057 (moldura) ainda não aplicadas → a 0056 é regerada no mesmo nome (conquistas 89 e 115);
  a lógica do copão vai na `0059_fellas_inc_copao.sql` (em `db.ts` e `mockDb.ts` depois da 0058).
- Noite do bar: **18h às 2h** (America/Sao_Paulo, UTC−3 fixo), todo dia. A noite que começa no dia D só abre se
  `visto_em ≥ (início da noite − 24 h)` (a pessoa passou pelo jogo desde a noite anterior); senão "ninguém abriu o bar".
  Sexta (a noite que começa na sexta 18h): movimento ×2.
- Nota inteira de 0 a 999 = sabor (0–399) + custo-benefício (0–250) + moda (0–150) + aguenta (0–199), em inteiros nos
  dois lados (paridade exata).
- Vagas no cardápio: 3 (4 no nível 12, 5 no nível 20). Um copão fica até a pessoa tirar. Tirar é de graça.
- Marcos e conquistas nunca em `idle_cup_avancar`; só no `idle_cup_depois`.
- Caixinha (mouse/teclado, nunca no celular) em cada base/mistura/extra/tamanho/DJ/força/preço (o que o caderninho já sabe;
  nunca testado = "Ainda não testou"), na vaga do cardápio (vendas, novidade), no DJ da sexta. Não no chat nem no pódio.
- **Nada rola dentro da tela no PC (1280×720 e 2000×961)**; no celular só a página rola (pedido do Juan).
- Commits sem coautoria. Suítes: `npx vitest run --maxWorkers=4` (games), `npx tsc --noEmit` (games e raiz), `npm test` (raiz).

## Review Focus

1. A pessoa some 3 dias: só a primeira noite depois da última visita abre; as outras ficam fechadas; as fichas daquela
   noite entram uma vez; a revelação/pódio do copão novo saem na volta com `criado_em` = início da primeira noite dele.
2. Noite atravessando a meia-noite e a virada de semana (domingo 18h → segunda 2h): vendas e PT contados uma vez, na noite
   certa; a sexta pesa 2× do começo ao fim da noite de sexta.
3. PT: sorte por (copão, noite) com semente; reabrir/recarregar dá o mesmo resultado; PT tira 15% da galera **uma vez por
   noite** mesmo com dois copões em PT.
4. Copão tirado no meio da noite: vende até a hora em que saiu; nada depois.
5. Opção trancada, força fora de 1..10, preço fora de 50%–200% da referência, vaga cheia, nome inválido, copão repetido
   (mesma base+mistura+extra+tamanho já no cardápio): erro certo e nada gravado.

---

### Task 0: pendências da parte 2 (camisetaria)

**Files:** `games/idle/camisetariaTela.ts` (+ teste).

- Sair do lugar no meio da animação da revelação e voltar: a revelação **recomeça** (no desligar, `revelando = null` quando
  `estado === 'revelacao'`). Teste: sai com 1 s de animação, volta, avança 10 s → 4/4 posts e o resultado aparecem.
- Linha "Fechou: vendeu X de Y": arredondar `vendido` pro inteiro mais próximo na exibição (uma peça a menos por erro de ulp
  não pode aparecer).
- Chave `fellas:tee-revelada` **por usuário** (`fellas:tee-revelada:<user_id>`), e a comparação volta a ser por igualdade
  com o conjunto de ids vistos (lista dos últimos 20 ids), pra não pular revelação de outra conta no mesmo aparelho.
- [ ] Testes, suíte, commit `Fellas Inc.: camisetaria: revelação que recomeça, contagem arredondada e chave por pessoa`.

### Task 1: `copao.ts` (catálogo e regras puras)

**Files:** Create `games/idle/copao.ts`, `games/idle/copao.test.ts`

Conteúdo (copiar exatamente). `nivel` de cada item sai de `LIBERA`.

Sabores: `neutro, forte, raiz, doce, herbal, citrico, tropical, frutado, cremoso, amargo, energia, leve, salgado`.
Conflitos: [cremoso, citrico], [herbal, doce], [energia, cremoso], [leve, forte], [salgado, doce].

Bases (id, nome, sabores, ponto de força ideal, custo por dose): 1 Vodka [neutro, forte] 5, 2 · 2 Cachaça [forte, raiz] 4, 1 ·
3 Catuaba [doce, raiz] 6, 1 · 4 Gin [herbal, citrico] 5, 3 · 5 Rum [doce, tropical] 5, 2 · 6 Whisky de posto [forte, amargo] 4, 2 ·
7 Tequila [citrico, forte] 4, 3 · 8 Corote de pêssego [doce, frutado] 7, 1 · 9 Licor de chocolate [doce, cremoso] 6, 3 ·
10 Saquê [neutro, leve] 7, 3 · 11 Absinto [herbal, forte, amargo] 3, 4 · 12 Vinho de garrafão [frutado, doce, raiz] 6, 1.

Misturas (id, nome, sabores): 1 Energético tradicional [doce, energia] · 2 Refri de guaraná [doce, raiz] · 3 Suco de laranja
[citrico, frutado] · 4 Refri de cola [doce, amargo] · 5 Energético de melancia [frutado, energia] · 6 Suco de maracujá [citrico,
tropical] · 7 Água tônica [amargo, leve] · 8 Energético de açaí [frutado, energia, cremoso] · 9 Refri de limão [citrico, leve] ·
10 Xarope de groselha [doce, frutado] · 11 Chá gelado [herbal, leve] · 12 Energético tropical [tropical, energia] · 13 Isotônico
[leve, neutro] · 14 Leite condensado [cremoso, doce] · 15 Energético sem açúcar [energia, leve].

Extras (id, nome, sabores): 1 Limão [citrico] · 2 Gelo de coco [tropical, cremoso] · 3 Morango [frutado, doce] · 4 Maracujá
[tropical, citrico] · 5 Hortelã [herbal, leve] · 6 Bala de goma [doce] · 7 Abacaxi [tropical, frutado] · 8 Canela [raiz, doce] ·
9 Pimenta [forte] · 10 Sal na borda [salgado] · 11 Açúcar na borda [doce] · 12 Fruta vermelha [frutado].

Tamanhos (id, nome, doses, preço de referência em fichas): 1 Copo 1, 8 · 2 Copão 3, 22 · 3 Balde 10, 60.

DJs (id, nome, estilo, bases que combinam): 1 DJ Vaqueiro, piseiro, [2, 3, 12] · 2 DJ Ramemes, funk, [1, 6, 8] · 3 Neiff,
brega-funk, [8, 3, 9] · 4 DJ Robson Caetano, eletrônica, [1, 4, 11] · 5 Ana Castela, sertanejo, [6, 2, 7] · 6 Kannário,
pagodão, [2, 3, 5] · 7 Wesley Safadão, forró eletrônico, [6, 1, 2] · 8 Veigh, trap, [4, 7, 9] · 9 Ferrugem, pagode, [5, 2, 10] ·
10 Jane Remover, shoegaze, [11, 10, 12].

Começo (nível 1): bases 1–3, misturas 1–4, extras 1–3, tamanhos 1–2, DJs 1–2, 3 vagas. `LIBERA` (nível → o que chega):
2 base 4, mistura 5 · 3 extra 4, DJ 3 · 4 mistura 6, base 5 · 5 extra 5, DJ 4 · 6 base 6, mistura 7 · 7 tamanho 3 (balde), extra 6 ·
8 mistura 8, DJ 5 · 9 base 7, extra 7 · 10 mistura 9, DJ 6 · 11 base 8, extra 8 · 12 vaga 4, mistura 10 · 13 base 9, DJ 7 ·
14 extra 9, mistura 11 · 15 base 10, DJ 8 · 16 mistura 12, extra 10 · 17 base 11, DJ 9 · 18 mistura 13, extra 11 ·
19 base 12, mistura 14 · 20 vaga 5, DJ 10 · 21 extra 12, mistura 15 · 22–25 só rendem mais.

Regras (nomes e assinaturas exportados como em `camisetaria.ts`; inteiros onde indicado):
- `rotuloPar(sabA, sabB)`: `s = 2·|comuns| − 2·|conflitos| + v`, `v = ((ia·31 + ib·17 + tipo·7) mod 3) − 1` (ia, ib = ids, tipo
  0 = base×mistura, 1 = base×extra, 2 = mistura×extra); rótulos 0..4 com os mesmos cortes da camisetaria.
- `sabor = PONTOS[rot(base, mistura)] + PONTOS[rot(base, extra)] + PONTOS[rot(mistura, extra)]`, `PONTOS = [0, 40, 75, 105, 133]` (0–399).
- `precoRef(tamanho, forca) = ref[tamanho] · (20 + forca) / 20` (fichas; double); preço válido: inteiro entre
  `ceil(0,5·precoRef)` e `floor(2·precoRef)`.
- `custoBeneficio = round(250 · clamp((2 − preco/precoRef) / 1,5, 0, 1))` (0–250), com `round` = `floor(x + 0,5)`.
- `moda`: base da moda = `1 + semanaIdx(4, 1, 12, semana)`, mistura da moda = `1 + semanaIdx(4, 2, 15, semana)`;
  150 se as duas batem, 75 se uma, 0 se nenhuma.
- `aguenta(forca, ponto)`: `f = forca − ponto`; f = 1 → 199; f = 0 → 170; f = −1 → 140; f ≥ 2 → `max(0, 170 − 45·f)`;
  f ≤ −2 → `max(0, 140 + 35·(f + 1))`.
- `nota = sabor + custoBeneficio + moda + aguenta` (0–999).
- `chancePT(forca, ponto) = max(0, forca − ponto) · 10` (em %); `deuPT(copaoId, noite, chance)`: sorte
  `((copaoId·7919 + noite·104729 + 4) mod 100) < chance` (noite = número de dias desde 2026-01-05 da noite).
- Noites: `inicioNoite(dia)` = dia 18h BRT; `fimNoite` = +8 h; `noitesEntre(aMs, bMs)`; `abreNoite(inicioMs, vistoMs | null)` =
  `vistoMs ≥ inicioMs − 24 h`; `ehSexta(inicioMs)`.
- Movimento: `publico(nivel) = PUBLICO_BASE · CRESCE^(nivel−1) · (1 + min(√galera / 30, 3))`; por noite cada copão vende
  `publico · atracao_i / Σ atracao` × `participacao` onde `atracao_i = (nota_i / 999)² · novidade_i · canibal_i`,
  `participacao = min(1, Σ atracao)`, `novidade = max(0,3, 1 − 0,1·noites no cardápio)`, `canibal = 0,7` se outro copão do
  cardápio tem a mesma base e mistura; sexta ×2; DJ escolhido: copões cuja base o DJ curte ×1,2.
- Lucro por venda: `preco − doses · custoBase · (0,5 + forca/10)` (fichas; pode ser negativo e soma assim).
- Galera no fim de cada noite aberta: `+ round(publico(nivel) · 0,02 · (mediaNotas/999))` se a média das notas do cardápio
  ≥ 600; `− 5%` se < 300; `− 15%` se alguém deu PT (uma vez por noite); piso 0.
- `vendidoNaNoite(total, inicioMs, tMs)`: linear dentro das 8 h.
- `nomeSugerido(base, mistura, extra, n)` ≤ 30 caracteres (`PREFIXO = ['Copão', 'Balde', 'Batidão', 'Bomba']`,
  `SUFIXO = ['', ' da Casa', ' do Grau', ' Sem Freio', ' de Respeito', ' Proibidão']`).
- Constantes iniciais: `PUBLICO_BASE = 40`, `CRESCE = 1.35`; ajustadas na Task 2.

- [ ] Testes: contagens; `LIBERA` cobre tudo uma vez; casos de `rotuloPar`, `aguenta` (f −3..3), `custoBeneficio` (0,5×, 1×,
  2× a referência), `moda` (0/75/150), `nota` de um caso à mão (conta no comentário), `deuPT` estável, `abreNoite`,
  `ehSexta`, `noitesEntre` cruzando a virada de semana; `nomeSugerido` ≤ 30 sempre. Commit
  `Fellas Inc.: copao.ts (bases, misturas, extras, DJs e as contas do copão)`.

### Task 2: balanceamento (simulação)

**Files:** `games/idle/copaoSim.test.ts`; `copao.ts` (só constantes).

Simulação como a da camisetaria: visitas 9h/14h/21h BRT; estratégia "no chute" (combinações aleatórias, força 5, preço = referência)
e "com caderninho" (lembra rótulos e o "aguenta" que viu; põe força ponto+1 só quando aceita o risco; troca o copão quando a
novidade cai abaixo de 50%; escolhe o DJ que combina com o cardápio). Metas: nível 10 entre 5 e 9 dias; nível 25 entre 35 e
49 dias (caderninho); nota média no chute entre 350 e 550; com caderninho ≥ 750 depois do dia 14; galera do marco (5.000)
por volta do dia 28 (ajustar o limiar do marco 47 como na parte 2, em `mapa.ts` e na 0057, se precisar); nenhuma noite
com lucro negativo no caderninho. Ajustar só `PUBLICO_BASE` e `CRESCE` (e o limiar do marco 47); se não der, BLOCKED com os números.
- [ ] Commit `Fellas Inc.: copão balanceado (simulação)`.

### Task 3: conquistas do copão (0056 regerada)

`nomes.ts`: `{ id: 89, tipo: 'cup_nota', valor: 900, nome: 'Nota mil (quase)', frase: 'Faltou 99 pra perfeição. Faltou a dignidade também.', condicao: 'Copão com nota 900 ou mais' }`,
`{ id: 115, escondida: true, tipo: 'cup_pt', nome: 'Deu PT', frase: 'A galera foi embora carregada. Literalmente.', condicao: 'Ter PT numa noite' }`.
Regerar a 0056 no mesmo nome; ícones provisórios 089 e 115 (trocados na Task 6). Commit `Fellas Inc.: conquistas do copão`.

### Task 4: 0059, parte A (catálogo, cardápio, pôr/tirar, DJ, json)

- Catálogo escondido (revogado de `authenticated`, paridade com `copao.ts`): `idle_cup_cat_base`, `_mistura`, `_extra`,
  `_tamanho`, `_dj`, `idle_cup_cat_conflito`, `idle_cup_const` (1 linha).
- Desafios do lugar 4 (`idle_cat_place_desafio` 401–412): 401 `cup_nota` 700 "Copão com nota 700 ou mais" horas 2 ·
  402 `cup_sem_pt` 700 "Copão nota 700+ e nenhuma noite de PT na semana" legado 2 · 403 `cup_galera` 1 "Ganha galera numa noite"
  horas 2 · 404 `cup_sexta` 1 "Abre o bar na sexta com o DJ que combina com 2 copões" investidor 1 · 405 `cup_cardapio` 600
  "Cardápio cheio com todas as notas 600 ou mais" legado 3 · 406 `cup_balde` 1 "Bota um balde no cardápio" horas 2 ·
  407 `cup_sabor` 300 "Copão com 300 ou mais de sabor" horas 3 · 408 `cup_moda` 150 "Acerta o copão da moda em cheio" legado 2 ·
  409 `cup_noites` 5 "Abre o bar 5 noites na semana" horas 3 · 410 `cup_aguenta` 199 "Acerta a força no limite" investidor 1 ·
  411 `cup_fichas` 1 "Fecha uma noite no lucro com o cardápio cheio" horas 2 · 412 `cup_nota` 850 "Copão com nota 850 ou mais" legado 3.
- `idle_cup_copoes(id identity, user_id, nome, base, mistura, extra, tamanho, forca, preco, nivel, nota, sabor, cb, moda, aguenta,
  rot_bm, rot_be, rot_me, chance_pt, entrou_em, primeira_noite (início da 1ª noite depois de entrar), saiu_em, revelado bool,
  noites int default 0, vendido double default 0, fichas double default 0)`; `idle_cup_noites(user_id, inicio, aberta bool,
  sexta bool, dj int, vendas double, fichas double, pt bool, galera_delta double, primary key (user_id, inicio))`;
  `idle_place_state` do lugar 4 guarda o DJ escolhido numa tabela `idle_cup_estado(user_id pk, dj int, vagas int)`.
- RPCs (trava + fecha + salva, age, `idle_place_responder(s, 4)`): `idle_cup_por(p_base, p_mistura, p_extra, p_tamanho, p_forca,
  p_preco, p_nome)` (erros `idle_cup_vaga`, `idle_cup_trancado`, `idle_cup_forca`, `idle_cup_preco`, `idle_cup_repetido`,
  `idle_lugar_nome`, `idle_lugar_fechado`); `idle_cup_tirar(p_copao)` (`idle_cup_sem_copao`); `idle_cup_dj(p_dj)`
  (`idle_cup_trancado`). A nota e os componentes são calculados e gravados ao pôr (moda da semana em que entrou).
- `idle_cup_json(s)` (estável): `{ moda: {base, mistura}, dj, vagas, cardapio: copões ativos (componentes e nota só se revelados),
  hoje: {aberta, inicio, fim, sexta, vendido_ate_agora}, ultima_noite: a última noite fechada (vendas, fichas, pt, galera_delta,
  dj, por copão: vendidos e fichas, chat_seed), historico: últimos 10 revelados }`.
- Erros em `errors.ts` e `RECARREGA_MAPA`.
- [ ] Paridade TS × SQL (rótulos, sabor, cb, moda, aguenta, nota, deuPT, noites) em 200 casos; recusas (Review Focus 5); json.
  Commit `Fellas Inc.: 0059 parte A (copão: cardápio, DJ)`.

### Task 5: 0059, parte B (noites, depois)

- `idle_cup_avancar(s)`: para cada noite com início entre o último processado e agora: decide `aberta` com o `visto_em` do `s`
  (o de antes da visita), grava a linha em `idle_cup_noites` (uma vez; PK), e vende proporcional até `min(agora, fim)` por
  copão ativo naquele intervalo (respeitando `saiu_em`); fichas na moeda do lugar 4; no fim da noite: galera (+/−/PT uma vez),
  `noites += 1` de cada copão que estava no cardápio. Sem marcos/conquistas/registrar.
- `idle_cup_depois(s)`: copões com `primeira_noite ≤ now()` e não revelados: `revelado = true`; `idle_place_registrar(user, 4,
  nome, [base, mistura, extra, tamanho, forca], nota, primeira_noite, 0)`; caderninho `('par', base·100 + mistura, 0, rot_bm)`,
  `('par', 10000 + base·100 + extra, 0, rot_be)`, `('par', 20000 + mistura·100 + extra, 0, rot_me)`, `('aguenta', base, forca, aguenta)`;
  `volume += 1`; `lendario` se nota ≥ 900; conquistas `idle_ganhar(user, 'cup_nota', nota)`, `'cup_pt'` se alguma noite fechada
  deu PT; desafios com os valores (nota, sem PT na semana, galera ganha, sexta+DJ, cardápio cheio ≥ 600, balde, sabor, moda,
  noites abertas na semana, aguenta = 199, lucro com cardápio cheio). Devolve `s`.
- [ ] Testes: Review Focus 1–4; marcos de volume/galera/lendário só depois; conquistas 89/115; desafio uma vez por semana.
  Suíte. Commit `Fellas Inc.: 0059 parte B (as noites do bar, PT, revelação)`.

### Task 6: arte do copão (bar à noite) e os 10 DJs

- Fora do repo (`../fellas-inc-esbocos/copao/`): gerador + prévias revisadas ≥ 3 vezes. No repo: `games/idle/copaoArte.json` +
  `copaoArte.ts` (+ teste), ícones 089 e 115.
- Recipientes (copo, copão, balde) com o líquido na mistura das cores da base e da mistura (cores por id, definidas no
  `copaoArte.ts`), extras (12 sprites 8×8 de enfeite), gelo, fundo do bar (balcão, neon na paleta do lugar 4), balões do chat.
- **Retratos dos 10 DJs em 64×64**, reconhecíveis, a partir das fotos que o Juan mandar (cabelo, chapéu, óculos, barba, roupa
  marcante), contorno preto, no estilo dos retratos dos Convidados (mais detalhe). **As fotos não são salvas em lugar nenhum.**
  Se uma foto ainda não chegou, desenhar o retrato pelo que se sabe publicamente do visual e marcar "a conferir" no relatório.
- `foto(partes)` 48×48 = o recipiente montado.
- [ ] Commit `Fellas Inc.: arte do copão e os retratos dos DJs`.

### Task 7: a tela do copão

- Impeccable; tema do lugar 4; **sem rolagem no PC**.
- **Cardápio** (as vagas): cada copão com foto, nome, nota (ou "estreia hoje 18h"), novidade, vendas da noite; tirar.
- **Montar** (vaga livre): grades compactas de base/mistura/extra (trancados num chip "nív. N +N"), tamanho, força (1–10),
  preço (stepper com a faixa válida e a referência), nome com sugestão; prévia do copão; "Pôr no cardápio".
- **Hoje à noite**: aberto/fechado, relógio até 18h ou até 2h, sexta + DJ escolhido (seletor de DJ com os retratos), vendas
  subindo durante a noite.
- **Ontem à noite** (`ultima_noite`): o chat da galera (8–12 mensagens montadas pela nota, pelos ingredientes, pelo PT,
  pela sexta e pelo DJ — sem inventar fala do artista), fichas, galera ganha/perdida. Mostra uma vez por noite (chave por
  usuário), como a revelação da camisetaria.
- **Revelação** de copão novo: a nota subindo com os 4 componentes (sabor, custo-benefício, moda, aguenta).
- Caderninho completo no miolo (pares testados, força que aguenta por base); resumo na faixa.
- [ ] Testes happy-dom; navegador (música mutada; 1280×720, 2000×961, 390 px; sem rolagem no PC); commit `Fellas Inc.: tela do copão`.

### Task 8: fechamento da parte 3

- [ ] Suítes, tsc, `git log -p` sem nome real de lugar, revisão do branch, sem merge/push. Atualizar a spec §5 com os ajustes.
  Mostrar ao Juan as prévias (retratos dos DJs!) e as frases das 2 conquistas.
