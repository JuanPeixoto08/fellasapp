// Aba Legado da Fellas Inc. (a árvore de habilidades e as conquistas) e o aviso de conquista. Puro: a tela só desenha
// o que sai daqui. Quem comprou ou ganhou o quê é o banco que decide; aqui só se decide o que cada quadradinho mostra.
import type { IdleState } from '../shared/types';
import { catalogo, type Conquista, type No } from './catalogo';
import type { Dica } from './dica';
import { RAMOS } from './nomes';

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

/** Como um nó aparece: comprado (aceso), disponível (o anterior do ramo já é seu) ou trancado (falta o anterior). */
export type SituacaoNo = 'comprado' | 'disponivel' | 'trancado';
export function situacao(no: No, arvore: readonly number[]): SituacaoNo {
  if (arvore.includes(no.id)) return 'comprado';
  return no.requer === null || arvore.includes(no.requer) ? 'disponivel' : 'trancado';
}

/** A raiz e os 6 ramos, na ordem, cada um com os seus nós. */
export const RAMOS_ARVORE: { ramo: number; nome: string; nos: No[] }[] = RAMOS.map((nome, ramo) => ({
  ramo, nome, nos: catalogo.arvore.filter((n) => n.ramo === ramo),
}));

/** O que falta pra um nó trancado: "Libera com Cafezinho de garrafa térmica". */
export function falta(no: No): string {
  const antes = catalogo.arvore.find((n) => n.id === no.requer);
  return antes ? `Libera com ${antes.nome}` : '';
}

/** Árvore em tela cheia: o mundo (em unidades) e o centro de cada nó. A raiz embaixo; os 6 ramos sobem abrindo, 3 de
 *  cada lado, como a copa de uma árvore (a Horta, de 13/10, é a da ponta direita). Mudar aqui = conferir o teste de distância. */
export const MUNDO_ARVORE = { largura: 480, altura: 540 } as const;
export const POSICOES_ARVORE: Readonly<Record<number, readonly [number, number]>> = {
  1: [240, 510],
  11: [92, 462], 12: [62, 388], 13: [48, 308], 14: [50, 226], 15: [62, 144],
  21: [150, 432], 22: [128, 352], 23: [118, 270], 24: [118, 188], 25: [126, 106],
  31: [206, 396], 32: [196, 316], 33: [190, 234], 34: [190, 152], 35: [196, 70],
  41: [274, 396], 42: [284, 316], 43: [290, 234], 44: [290, 152], 45: [284, 70],
  51: [330, 432], 52: [352, 352], 53: [362, 270], 54: [362, 188], 55: [354, 106],
  61: [388, 462], 62: [418, 388], 63: [432, 308], 64: [430, 226], 65: [418, 144],
};

/** O nome de cada ramo, 44 unidades acima do 5º nó dele. */
export const ROTULOS_ARVORE: readonly { nome: string; x: number; y: number }[] = RAMOS_ARVORE
  .filter((r) => r.ramo > 0)
  .map((r) => {
    const [x, y] = POSICOES_ARVORE[r.nos[r.nos.length - 1].id];
    return { nome: r.nome, x, y: y - 44 };
  });

/** Quanto a copa cresce na tela: cabe no lado mais apertado, entre 0,8 (abaixo disso arrasta; 480 × 0,8 cabe nos 390 do
 *  celular) e 1,4. */
export function escalaArvore(largura: number, altura: number): number {
  const s = Math.min(largura / MUNDO_ARVORE.largura, altura / MUNDO_ARVORE.altura);
  return Math.min(1.4, Math.max(0.8, s));
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
