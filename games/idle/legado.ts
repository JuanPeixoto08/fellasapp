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

/** Quanto a copa cresce na tela: a copa inteira cabe no lado mais apertado, entre 0,1 e 1,4 (o mundo é grande; o
 *  zoom do jogador, Task 10, vai por cima). */
export function escalaArvore(largura: number, altura: number): number {
  const s = Math.min(largura / MUNDO_ARVORE.largura, altura / MUNDO_ARVORE.altura);
  return Math.min(1.4, Math.max(0.1, s));
}

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
