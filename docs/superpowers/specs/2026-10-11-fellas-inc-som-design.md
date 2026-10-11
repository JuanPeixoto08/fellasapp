# Fellas Inc.: som (música por era, efeitos e as chaves nas Configurações)

Data: 2026-10-11. Pedido do Juan: efeitos sonoros e música no jogo, com chaves separadas nas Configurações pra música,
efeitos e avisos. Referência da música: "Welcome to the Green Room" (Toby Fox), **baseada e não copiada**: o que vale
dela é o **balanço jazz/swing** (escolha do Juan); melodia e harmonia são originais.

Só apresentação, em `games/idle`. Sem banco, sem migração, sem dependência nova.

## Decisões do Juan

- Configurações: três chaves separadas, **Música**, **Efeitos sonoros** e **Avisos** (avisos dentro do jogo).
- Origem: **tudo sintetizado na hora** no navegador (Web Audio), sem arquivos de áudio (caminho A).
- Música: **uma por era** (5 eras), o mesmo swing crescendo com a empresa.
- Efeitos: os quatro grupos (compras, momentos grandes, oportunidade, interface).
- Tudo de áudio numa pasta só: `games/idle/audio/`.
- As oportunidades vão deixar de passar na cena (só na Caixinha) e entra um "dourado" estilo cookie dourado só pra quem
  está com o jogo aberto. **Isso é a entrega seguinte**, com spec própria; esta entrega só deixa prontos os dois sons
  do dourado no catálogo.

## Configurações e quando toca

- A chave "Som" de hoje (`fellas:idle-som`, nunca tocou nada) sai. Entram três chaves no aparelho, todas começando
  ligadas: `fellas:idle-musica`, `fellas:idle-efeitos`, `fellas:idle-avisos` ('0' = desligada).
- Folha de Configurações: Música (Ligada/Desligada), Efeitos sonoros (Ligados/Desligados), Avisos (Ligados/Desligados),
  depois Mudar visual e Patch notes (como hoje). Cada chave é um `role="switch"` com `aria-checked`.
- **Avisos desligados** escondem o aviso de conquista na cena (e o som dele). Continuam: erros ("Deu ruim… Tentar de
  novo"), a faixa de ações que viraram pó na Bolsa, bolinhas e selos.
- Volume fixo, sem barra (a música bem abaixo dos efeitos). Um limitador no fim da cadeia: nada estoura.
- O navegador só deixa tocar depois de um toque: o áudio liga no primeiro `pointerdown`/`keydown` na página e a música
  entra com fade de ~1,5 s. Aba escondida (`visibilitychange`): fade de saída e `suspend()`; voltou: `resume()` e
  fade de entrada, de onde parou. No iPhone a chave de silencioso é respeitada (padrão do Web Audio).
- Só toca na página da Fellas Inc.

## Música

- Composição original: forma **AABA de 32 compassos**, 4/4, harmonia de ii–V–I (linguagem comum do swing), melodia
  escrita do zero. Swing de tercina: a colcheia "de cima" cai a 2/3 do tempo.
- Instrumentos sintetizados: baixo acústico (andando nas 4 batidas), escovinha na caixa, prato de condução no padrão
  do swing, bumbo leve, piano elétrico (acordes, "comping"), vibrafone (melodia), metais (acentos curtos).
- Arranjo por era (o mesmo tema crescendo):
  1. Quarto, 120 bpm: baixo + escovinha + piano elétrico espaçado, sem melodia.
  2. Garagem, 126 bpm: + melodia no vibrafone.
  3. Escritório, 132 bpm: + prato de condução, piano mais cheio, bumbo marcando.
  4. Andar inteiro, 138 bpm: + metais em acentos na parte B, viradas no fim das frases.
  5. Sede, 144 bpm: banda inteira, a última parte A sobe um tom, mais viradas.
- Dois giros por era: o 1º com a melodia como escrita, o 2º um "solo" (variação composta). ~2 min antes de repetir.
- Troca de era: no fim do giro em que está; o próximo giro já vem com os instrumentos e o andamento da era nova.
- Antes do Abrir CNPJ: a do Quarto bem baixinha, só baixo e escovinha.
- Durante um momento grande (conquista, era nova, venda da startup, Abrir CNPJ, pegar o dourado) a música abaixa
  (~−8 dB) e volta em ~1 s.

## Efeitos

Afinados no tom da música. Cada tipo toca no máximo a cada 60 ms (clicar rápido não empilha).

| Id | Momento | Som |
|---|---|---|
| `compra` | comprar 1 gerador ou melhoria (inclui as da Bolsa) | moedinha curta |
| `compraMuitas` | comprar 10 / Máx | moedinhas em cascata (mais notas quanto mais comprou, até 8) |
| `no` | nó da árvore | acorde de vibrafone subindo |
| `acaoCompra` | comprar ação | caixa registradora |
| `acaoVende` | vender ação | "ding" de venda: alegre com lucro, seco com prejuízo |
| `conquista` | conquista (com o aviso; Avisos desligados = sem som) | fanfarrinha de metais |
| `era` | era nova | virada de bateria + acorde da banda |
| `venda` | vender a startup | fanfarra maior |
| `contratado` | alguém te contratou (apareceu chefe novo) | "plim-plim" de campainha |
| `po` | ações viraram pó | trombone triste descendo |
| `oportunidade` | oportunidade nova chegou na Caixinha (com a página aberta) | "plim" leve |
| `pegar` | pegar oportunidade | "tchiling" brilhante |
| `cnpj` | Abrir CNPJ | acorde de abertura + carimbo |
| `erro` | recusa do jogo (sem F$, limite etc.) | "bonk" grave e baixo |
| `clique` | botão e aba | cliquezinho bem baixo |
| `abrir` / `fechar` | folha ou gaveta abrindo / fechando | "fuu" subindo / descendo |
| `dourado` | dourado apareceu (entrega seguinte) | sininho em arpejo subindo, brilhante, inconfundível |
| `douradoPego` | pegou o dourado (entrega seguinte) | fanfarrinha curta + sininho |

Efeitos desligados = nenhum destes. A música segue só a chave dela.

## Arquitetura (`games/idle/audio/`)

- `motor.ts`: cria o `AudioContext` no primeiro gesto; barramentos música / efeitos / geral (`GainNode`) até um
  `DynamicsCompressorNode` como limitador; `abaixarMusica()` (ducking); suspende e volta com a aba; obedece as chaves.
  Recebe a fábrica do contexto por parâmetro (os testes usam um contexto de mentira).
- `instrumentos.ts`: uma função por instrumento: `(ctx, destino, quando, nota, duracao, forca)`; osciladores, ruído
  filtrado e envelopes. Nada de arquivo.
- `musica.ts` (puro, só dados e contas): acordes e melodia dos 32 compassos, o solo do 2º giro, o arranjo por era;
  `notasDoGiro(era, giro)` devolve as notas (instrumento, tempo em batidas, duração, altura MIDI, força) com o swing
  aplicado; `bpm(era)`.
- `sequenciador.ts`: agenda à frente (janela de ~120 ms, a cada ~25 ms) a partir de `notasDoGiro`; troca de era no
  fim do giro; para e retoma.
- `efeitos.ts`: o catálogo da tabela (`tocar(id, opcoes?)`), o limite de 60 ms por tipo (puro e testado).
- `index.ts`: o que o resto do jogo usa (`ligarAudio`, `tocar`, `mudarEra`, `aplicarChaves`).
- Fora da pasta: `preferencias.ts` (as três chaves; a patch note lida continua lá), a folha de Configurações em
  `tela.ts`, e as ligações em `main.ts`: efeito quando a ação **deu certo** (compra, venda, nó, conquista, era nova,
  contratado, pó, Abrir CNPJ) e `erro` nas recusas; `clique`/`abrir`/`fechar` saem da tela num ouvinte só.

## Página de audição

`/games/idle/?ouvir` (sem link em lugar nenhum; funciona no site de verdade, sem login e sem tocar na empresa):
botões pra tocar cada era (e trocar de era no meio, pra ouvir a transição), parar, e um botão por efeito. É onde o
Juan ouve e pede ajustes, em rodadas: eu não consigo ouvir o resultado.

## Testes

- Partitura: todo compasso soma 4 tempos; AABA de 32 compassos; notas na faixa de cada instrumento; melodia em nota
  do acorde nos tempos 1 e 3; cada era tem pelo menos os instrumentos da anterior; a Sede sobe um tom na última A.
- Swing e andamento: a posição da colcheia de cima; `bpm` 120/126/132/138/144; duração de cada giro.
- Efeitos: o catálogo cobre todos os ids da tabela; o limite de 60 ms; chaves desligadas não tocam; Avisos desligados
  escondem o aviso de conquista e não tocam `conquista`.
- Motor (contexto de mentira): nada antes do primeiro gesto; suspende com a aba escondida e volta; música desligada não
  agenda nada.
- Configurações: as três chaves na folha, cada uma chamando a ação certa e lembrando no aparelho.
- No Chrome, render offline (`OfflineAudioContext`) de cada era e dos efeitos: pico abaixo de 0 dBFS e a duração
  esperada de cada giro.
- Suítes: `npx tsc --noEmit`, `npx vitest run --maxWorkers=4` (games), `npm test` na raiz; conferência visual das
  Configurações no celular e no PC.

## Patch notes

Entrada nova no começo de `novidades.ts` quando for ao ar: "Som na firma" (música swing que cresce com a empresa,
efeitos, e as chaves de música, efeitos e avisos nas Configurações).

## Fora desta entrega

- Oportunidades só na Caixinha e o dourado (entrega seguinte, spec própria; os sons `dourado` e `douradoPego` já
  ficam no catálogo).
- Barra de volume.
