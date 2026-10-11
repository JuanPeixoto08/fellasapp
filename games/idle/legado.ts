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

/** O que falta pra um nó trancado: "Libera com Cafezinho de garrafa térmica". */
export function falta(no: No): string {
  const antes = catalogo.arvore.find((n) => n.id === no.requer);
  return antes ? `Libera com ${antes.nome}` : '';
}
