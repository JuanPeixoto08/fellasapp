// Aba Legado da Fellas Inc. (a árvore de habilidades e as conquistas) e o aviso de conquista. Puro: a tela só desenha
// o que sai daqui. Quem comprou ou ganhou o quê é o banco que decide; aqui só se decide o que cada quadradinho mostra.
import type { IdleState } from '../shared/types';
import { catalogo, ORDEM_RAMOS, RAMO_PONTE, type Conquista, type No } from './catalogo';
import type { Dica } from './dica';
import { NOME_PONTE, RAMOS } from './nomes';

/** Um quadradinho da grade. `texto` = a frase (ganhou), a condição (bloqueada) ou "Alguém do grupo conseguiu".
 *  `feito` = o que precisou pra ganhar (só nas ganhas: continua aparecendo depois de feita). */
export type Celula = { conquista: Conquista; ganhou: boolean; nome: string; texto: string; feito: string | null; em: string | null };

export const TOTAL_CONQUISTAS = catalogo.conquistas.length;

/** A grade, na ordem do catálogo. Escondida que ninguém do grupo tem não aparece; escondida que alguém tem e você não:
 *  "???". Conquista que o catálogo da página ainda não conhece (página velha) fica de fora. */
export function grade(estado: IdleState): Celula[] {
  const minhas = new Map(estado.conquistas.map((c) => [c.id, c.em]));
  const descobertas = new Set(estado.descobertas);
  const out: Celula[] = [];
  for (const c of catalogo.conquistas) {
    const em = minhas.get(c.id) ?? null;
    if (em) out.push({ conquista: c, ganhou: true, nome: c.nome, texto: c.frase, feito: c.condicao, em });
    else if (!c.escondida) out.push({ conquista: c, ganhou: false, nome: c.nome, texto: c.condicao, feito: null, em: null });
    else if (descobertas.has(c.id)) out.push({ conquista: c, ganhou: false, nome: '???', texto: 'Alguém do grupo conseguiu', feito: null, em: null });
  }
  return out;
}

/** "Ganhou em 10/10/2026" (dia de Brasília). */
export const ganhouEm = (iso: string): string =>
  `Ganhou em ${new Date(iso).toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' })}`;

/** A caixinha de informação da conquista (mouse no PC): a frase, o que precisou e a data; ou o que falta. */
export function dicaConquista(c: Celula): Dica {
  if (c.ganhou) {
    return {
      titulo: c.nome,
      linhas: [{ texto: c.texto }, { texto: `✓ Feito: ${c.feito}`, tom: 'bom' }, { texto: `${ganhouEm(c.em!)} · +1% de produção`, tom: 'fraco' }],
    };
  }
  if (c.nome === '???') return { titulo: '???', linhas: [{ texto: c.texto, tom: 'fraco' }] };
  return { titulo: c.nome, linhas: [{ texto: c.texto }, { texto: 'Vale +1% de produção', tom: 'fraco' }] };
}

/** Um aviso de conquista (id null = o aviso de várias de uma vez). */
export type AvisoConquista = { id: number | null; nome: string; frase: string };
/** Um aviso por id novo, na ordem que o banco mandou. Mais de 3 de uma vez (a 1ª abertura depois de uma atualização
 *  pode dar 15 ou 20): um aviso só, em vez de uma fila de 5 s cada. */
export const MAX_AVISOS = 3;
export function avisos(ids: number[]): AvisoConquista[] {
  const out: AvisoConquista[] = [];
  for (const id of ids) {
    const c = catalogo.conquistas.find((x) => x.id === id);
    if (c) out.push({ id: c.id, nome: c.nome, frase: c.frase });
  }
  return out.length > MAX_AVISOS ? [{ id: null, nome: `${out.length} conquistas novas!`, frase: 'Olha no Legado.' }] : out;
}

/** "1 ponto" / "5 pontos". */
export const pontos = (n: number): string => `${n} ${n === 1 ? 'ponto' : 'pontos'}`;

/** O texto da folha de confirmação da venda. */
export const textoVenda = (n: number): string => `Você ganha ${pontos(n)} pra gastar na árvore e recomeça do zero.`;

/**
 * Quais conquistas avisar depois de carregar o estado. `conhecidas` = os ids que a página já conhecia (null = primeira
 * carga: só as `novas` da chamada, não o histórico todo). Depois, avisa também as que apareceram no estado sem estar nas
 * `novas` (ganhas pela ação de outra pessoa: ser contratado, "Pai tá on"). Devolve os ids a avisar e a lista nova de conhecidas.
 */
export function detectarNovas(conhecidas: readonly number[] | null, estado: IdleState): { ids: number[]; conhecidas: number[] } {
  const agora = estado.conquistas.map((c) => c.id);
  const ids = estado.novas.filter((id) => !conhecidas?.includes(id));
  if (conhecidas !== null) {
    for (const id of agora) if (!conhecidas.includes(id) && !ids.includes(id)) ids.push(id);
  }
  return { ids, conhecidas: [...new Set([...agora, ...estado.novas])] };
}

/** Fila dos avisos de conquista: um de cada vez, `ms` cada. `mostrar(null)` = nenhum na tela. `parar` limpa tudo. */
export function criarFilaAvisos<T>(mostrar: (aviso: T | null) => void, ms = 5000) {
  const fila: T[] = [];
  let ativo = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const proximo = () => {
    timer = null;
    const t = fila.shift();
    ativo = t !== undefined;
    mostrar(t ?? null);
    if (t !== undefined) timer = setTimeout(proximo, ms);
  };
  return {
    adicionar(itens: T[]) {
      fila.push(...itens);
      if (!ativo && fila.length) proximo();
    },
    parar() {
      if (timer !== null) clearTimeout(timer);
      timer = null;
      fila.length = 0;
      if (ativo) mostrar(null);
      ativo = false;
    },
  };
}

/** Como um nó aparece no texto: comprado, disponível (tem o que ele pede) ou trancado. */
export type SituacaoNo = 'comprado' | 'disponivel' | 'trancado';
/** Tem o que o nó pede: o anterior do ramo e, na ponte, o nó 5 do outro ramo. */
export const liberadoNo = (no: No, arvore: readonly number[]): boolean =>
  (no.requer === null || arvore.includes(no.requer)) && (no.requer2 === null || arvore.includes(no.requer2));
export function situacao(no: No, arvore: readonly number[]): SituacaoNo {
  if (arvore.includes(no.id)) return 'comprado';
  return liberadoNo(no, arvore) ? 'disponivel' : 'trancado';
}

/** O que a página sabe da sua árvore pra decidir cada nó: os nós e o nível dos infinitos, os pontos livres, quantas
 *  vezes vendeu e a maior era alcançada (os portões). */
export type ContextoArvore = {
  arvore: readonly number[]; niveis: Readonly<Record<string, number>>; pontos: number; vendas: number; eraMax: number;
};
/** Do estado: resposta de antes da 0082 (sem niveis nem era_max) vale nível 1 e a era de agora. */
export const contextoArvore = (s: Pick<IdleState, 'bonus' | 'pontos' | 'vendas' | 'era' | 'era_max'>): ContextoArvore => ({
  arvore: s.bonus.arvore, niveis: s.bonus.niveis ?? {}, pontos: s.pontos, vendas: s.vendas, eraMax: Math.max(s.era, s.era_max ?? 1),
});

/** O nível do nó: 0 sem ele; 1 nos fixos; nos infinitos, o do banco (1 se a resposta não trouxe). */
export function nivelNo(no: No, c: Pick<ContextoArvore, 'arvore' | 'niveis'>): number {
  if (!c.arvore.includes(no.id)) return 0;
  return no.cresce === null ? 1 : Math.max(1, c.niveis[String(no.id)] ?? 1);
}
/** Quanto custa comprar o nó (o próximo nível, no infinito): round(custo · cresce^nível de agora), igual a idle_buy_node. */
export const precoNo = (no: No, c: Pick<ContextoArvore, 'arvore' | 'niveis'>): number =>
  (no.cresce === null ? no.custo : Math.round(no.custo * no.cresce ** nivelNo(no, c)));

/** Quem abre cada ramo dos recursos (o portão dele é a era em que o recurso abre). */
const QUEM_ABRE: Readonly<Record<number, string>> = { 7: 'Abre com a Bolsa', 8: 'Abre com os Convidados', 9: 'Abre com o Mapa do rolê' };
/** O portão que falta além dos pontos (o mesmo motivo do idle_gate do banco), ou null. */
export function portao(no: No, c: Pick<ContextoArvore, 'vendas' | 'eraMax'>): string | null {
  if (no.reqVendas !== null && c.vendas < no.reqVendas) return `Falta: ${no.reqVendas} vendas (você tem ${c.vendas})`;
  if (no.reqEra !== null && c.eraMax < no.reqEra) return QUEM_ABRE[no.ramo] ?? `Falta: chegar na era ${no.reqEra} (você chegou na ${c.eraMax})`;
  return null;
}

/** O ramo de um nó na copa (a ponte fica com o do 1º nó que ela pede). */
export function ramoDoNo(no: No): number {
  if (no.ramo !== RAMO_PONTE) return no.ramo;
  return catalogo.arvore.find((n) => n.id === no.requer)!.ramo;
}

/** A raiz e os 10 ramos, na ordem do catálogo, cada um com os seus nós (1 a 10 e o infinito; as pontes ficam de fora). */
export const RAMOS_ARVORE: { ramo: number; nome: string; nos: No[] }[] = RAMOS.map((nome, ramo) => ({
  ramo, nome, nos: catalogo.arvore.filter((n) => n.ramo === ramo).sort((a, b) => a.posicao - b.posicao),
}));

const nomeDe = (id: number | null) => catalogo.arvore.find((n) => n.id === id)?.nome;
/** O que falta pra um nó trancado: "Libera com Cafezinho de garrafa térmica" (a ponte: "… com A e B"). */
export function falta(no: No): string {
  const nomes = [nomeDe(no.requer), nomeDe(no.requer2)].filter((x): x is string => !!x);
  return nomes.length ? `Libera com ${nomes.join(' e ')}` : '';
}

/** Árvore em tela cheia: a constelação (16/10). O mundo (em unidades) e o centro de cada nó, gerados. A raiz no centro;
 *  os ramos saem como raios em ângulos iguais, na ordem da copa (ORDEM_RAMOS, no sentido horário, Recomeço e Produção
 *  simétricos em volta do topo); o nó de posição p fica em R1 + (p − 1)·PASSO_R, o infinito um PASSO_INF além do 10; cada
 *  ponte no ângulo médio dos dois raios, meio passo além do nó 5. Mudar aqui = conferir os testes de distância
 *  (legado.test.ts). R1 apertado pelo anel de dentro (corda 2·r·sin(π/n)); PASSO_R e PASSO_INF ≥ 86 (84 com folga de arredondamento) porque o nó 10 e o
 *  infinito são maiores na tela. */
export const GEOMETRIA_ARVORE = { r1: 110, passoR: 86, passoInf: 90, margem: 60, aneloFolga: 48, rotuloFolga: 64 } as const;
const NUM_RAMOS = (ORDEM_RAMOS as readonly number[]).length;
const RAIO_INFINITO = GEOMETRIA_ARVORE.r1 + 9 * GEOMETRIA_ARVORE.passoR + GEOMETRIA_ARVORE.passoInf;
const RAIO_ROTULO = RAIO_INFINITO + GEOMETRIA_ARVORE.rotuloFolga;
const LADO = 2 * Math.ceil(RAIO_ROTULO + GEOMETRIA_ARVORE.margem);
export const MUNDO_ARVORE = { largura: LADO, altura: LADO } as const;
const CENTRO = LADO / 2;
const colunaDe = (ramo: number) => (ORDEM_RAMOS as readonly number[]).indexOf(ramo);
/** O ângulo do k-ésimo ramo da ordem (radianos, y pra baixo: crescer = sentido horário). O meio entre o 4º e o 5º
 *  (Recomeço e Produção, com 10 ramos) aponta pra cima. */
const anguloRamo = (k: number) => -Math.PI / 2 + (k - (NUM_RAMOS / 2 - 0.5)) * ((2 * Math.PI) / NUM_RAMOS);
const raioPosicao = (posicao: number) =>
  posicao === 11 ? RAIO_INFINITO : GEOMETRIA_ARVORE.r1 + (posicao - 1) * GEOMETRIA_ARVORE.passoR;
const ponto = (raio: number, ang: number): readonly [number, number] =>
  [Math.round(CENTRO + raio * Math.cos(ang)), Math.round(CENTRO + raio * Math.sin(ang))];
function gerarPosicoes(): Readonly<Record<number, readonly [number, number]>> {
  const pos: Record<number, readonly [number, number]> = {};
  for (const n of catalogo.arvore) {
    if (n.ramo === 0) pos[n.id] = [CENTRO, CENTRO];
    else if (n.ramo === RAMO_PONTE) {
      const a = colunaDe(catalogo.arvore.find((x) => x.id === n.requer)!.ramo);
      const b = colunaDe(catalogo.arvore.find((x) => x.id === n.requer2)!.ramo);
      pos[n.id] = ponto(raioPosicao(5) + GEOMETRIA_ARVORE.passoR / 2, anguloRamo(a) + (anguloRamo(b) - anguloRamo(a)) / 2);
    } else pos[n.id] = ponto(raioPosicao(n.posicao), anguloRamo(colunaDe(n.ramo)));
  }
  return pos;
}
export const POSICOES_ARVORE = gerarPosicoes();

/** Os anéis de era, decoração que a tela desenha. Hoje um só, o miolo (eras 1–7). As entregas de era acrescentam anéis
 *  por fora (eras 8–9, 10–12) com os nós novos delas, sem mexer no que já existe. */
export const ANEIS_ARVORE: readonly { era: number; raio: number; rotulo: string }[] = [
  { era: 7, raio: RAIO_INFINITO + GEOMETRIA_ARVORE.aneloFolga, rotulo: 'Era 7' },
];

/** O nome de cada ramo, depois do infinito dele, no ângulo do ramo, na ordem da copa (o texto é centrado no ponto). */
export const ROTULOS_ARVORE: readonly { ramo: number; nome: string; x: number; y: number }[] = (ORDEM_RAMOS as readonly number[]).map((ramo) => {
  const [x, y] = ponto(RAIO_ROTULO, anguloRamo(colunaDe(ramo)));
  return { ramo, nome: RAMOS[ramo], x, y };
});

/** O zoom da tela (16/10): o mínimo faz a constelação inteira caber no palco (nunca abaixo de ZOOM_MIN nem acima de 1;
 *  o mundo tem ~2200 de lado, então no celular o mínimo fica perto de 0,18, os nós viram estrelinhas); o máximo é
 *  ZOOM_MAX. Ao abrir (e ao pular pra um ramo) a tela vai pro ZOOM_ABRIR: o nó com 32 px ou mais no celular. */
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 1.4;
export const ZOOM_ABRIR = 0.8;
export function escalaMinima(largura: number, altura: number): number {
  return Math.min(1, Math.max(ZOOM_MIN, Math.min(largura / MUNDO_ARVORE.largura, altura / MUNDO_ARVORE.altura)));
}
export const limitarZoom = (z: number, minimo: number): number => Math.min(ZOOM_MAX, Math.max(minimo, z));

/** Quanto passa do centro do nó mais de fora o que fica em volta dele na tela: o losango do infinito (38 de meia caixa) e,
 *  pro lado de fora do raio, o nível e o preço empilhados (até ~60 × 34; na diagonal, ~66), com folga: o anel na tela
 *  fica por fora disso. O texto não encolhe com o zoom, então a folga é em px da tela. */
const EM_VOLTA_PX = 112;
/** Só com o cadeado à vista (entre o longe e os rótulos): a meia caixa do losango no zoom (40·k) + o cadeado (26). */
const emVoltaCadeado = (k: number) => 40 * k + 26;
/** Os nomes dos ramos e as etiquetas de preço/nível só a partir deste zoom (o texto não encolhe: abaixo, encostariam
 *  nos nós); a fileira mostra os ramos sempre. */
export const ZOOM_ROTULOS = 0.8;
/** Abaixo disto o ícone teria menos de 16 px (borra): os nós viram estrelinhas, sem etiqueta nenhuma. */
export const ZOOM_LONGE = 1 / 3;
const RAIOS_NOS = Object.values(POSICOES_ARVORE).map(([x, y]) => Math.hypot(x - CENTRO, y - CENTRO));
/** O raio do anel na tela (px, k = px por unidade): o do mundo, ou mais pra fora se as etiquetas do nó mais de fora
 *  dentro dele (que não encolhem) passariam por baixo da linha. Sem etiquetas (longe), o do mundo: a constelação
 *  inteira cabe no zoom mínimo. Entre os dois, só o cadeado. */
export function raioAnelTela(anel: { raio: number }, k: number): number {
  const dentro = Math.max(0, ...RAIOS_NOS.filter((r) => r < anel.raio));
  const volta = k >= ZOOM_ROTULOS - 1e-9 ? EM_VOLTA_PX : k >= ZOOM_LONGE ? emVoltaCadeado(k) : 0;
  return Math.max(anel.raio * k, dentro * k + volta);
}
/** Folga entre o anel e o nome do ramo, em px da tela. */
const FOLGA_ROTULO_PX = 10;
/** O centro (px da tela) do nome de um ramo com a caixa w × h: no ângulo do ramo, com a caixa inteira por fora do anel
 *  de fora (o ponto da caixa mais perto do centro fica a FOLGA_ROTULO_PX da linha). Antes o anel da era 7 (raio 1022)
 *  cortava os nomes (raio 1038). */
export function posicaoRotulo(ramo: number, k: number, w: number, h: number): { x: number; y: number } {
  const a = anguloRamo(colunaDe(ramo));
  const anel = Math.max(0, ...ANEIS_ARVORE.map((x) => raioAnelTela(x, k)));
  // o meio da caixa vai além da linha o "raio de apoio" da caixa naquela direção (|cos|·w/2 + |sin|·h/2)
  const r = anel + FOLGA_ROTULO_PX + (Math.abs(Math.cos(a)) * w) / 2 + (Math.abs(Math.sin(a)) * h) / 2;
  return { x: CENTRO * k + r * Math.cos(a), y: CENTRO * k + r * Math.sin(a) };
}

/** Quantos dos 10 nós fixos de um ramo você tem (as barrinhas do quadro do Legado). */
export function progressoRamo(ramo: number, c: Pick<ContextoArvore, 'arvore'>): { comprados: number; total: number } {
  const nos = catalogo.arvore.filter((n) => n.ramo === ramo && n.posicao <= 10);
  return { comprados: nos.filter((n) => c.arvore.includes(n.id)).length, total: nos.length };
}
/** A altura de cada barrinha (fração), pela ordem da copa: as do meio mais altas (o Recomeço e a Produção, no topo da
 *  constelação), as das pontas a 0,55. */
export const alturaBarra = (k: number): number => 0.55 + 0.45 * (1 - ((k - 4.5) / 4.5) ** 2);

/** A situação de um nó na tela. O infinito que você já tem segue comprável (o próximo nível). */
export type SituacaoTela = 'comprado' | 'pode' | 'falta' | 'portao' | 'trancado';
export function situacaoTela(no: No, c: ContextoArvore): SituacaoTela {
  const tem = c.arvore.includes(no.id);
  if (tem && no.cresce === null) return 'comprado';
  if (!tem) {
    if (!liberadoNo(no, c.arvore)) return 'trancado';
    if (portao(no, c) !== null) return 'portao';
  }
  return c.pontos >= precoNo(no, c) ? 'pode' : 'falta';
}

/** O nó escolhido ao abrir a árvore: o mais barato que dá pra comprar; senão o mais barato liberado; senão a raiz.
 *  Empate no preço: o menor id. */
export function noInicial(c: ContextoArvore): number {
  const porPreco = [...catalogo.arvore].sort((a, b) => precoNo(a, c) - precoNo(b, c) || a.id - b.id);
  const achar = (sit: SituacaoTela) => porPreco.find((n) => situacaoTela(n, c) === sit);
  return (achar('pode') ?? achar('falta') ?? catalogo.arvore.find((n) => n.ramo === 0)!).id;
}

/** "Produção · 2 de 10", "Bolsa · infinito", "Ponte · Gente e PPP Podcast"; a raiz diz "Raiz". */
export function ondeNo(no: No): string {
  if (no.ramo === 0) return 'Raiz';
  if (no.ramo === RAMO_PONTE) {
    const r = (id: number | null) => RAMOS[catalogo.arvore.find((n) => n.id === id)!.ramo];
    return `${NOME_PONTE} · ${r(no.requer)} e ${r(no.requer2)}`;
  }
  return no.posicao === 11 ? `${RAMOS[no.ramo]} · infinito` : `${RAMOS[no.ramo]} · ${no.posicao} de 10`;
}

/** "Falta 1 ★" / "Faltam 5 ★". */
export const faltam = (n: number): string => (n === 1 ? 'Falta 1 ★' : `Faltam ${n} ★`);

/** O rótulo do nó pro leitor de tela: "Turno dobrado, faltam 5 ★"; "Hora extra infinita, nível 4, faltam 554 ★". */
export function descricaoNo(no: No, sit: SituacaoTela, c: ContextoArvore): string {
  if (sit === 'comprado') return `${no.nome}, comprado`;
  if (sit === 'trancado') return `${no.nome}, trancado`;
  if (sit === 'portao') return `${no.nome}, ${(portao(no, c) ?? '').toLowerCase()}`;
  const nivel = no.cresce !== null && c.arvore.includes(no.id) ? `, nível ${nivelNo(no, c)}` : '';
  const preco = precoNo(no, c);
  return sit === 'pode' ? `${no.nome}${nivel}, dá pra comprar por ${preco} ★` : `${no.nome}${nivel}, ${faltam(preco - c.pontos).toLowerCase()}`;
}
