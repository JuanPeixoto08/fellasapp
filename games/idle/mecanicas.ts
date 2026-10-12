// Mapa do rolê: o registro das mecânicas de cada lugar. A moldura (lugarTela.ts) desenha o cabeçalho, o pódio, a semana,
// o desafio e os marcos; o miolo de cada lugar vem daqui. As partes 2 a 4 preenchem (camisetaria = 3, copão = 4, jantar = 7).
import type { LugarEstado, NotaCaderninho } from '../shared/types';

export type AcoesMecanica = { acao(fn: string, args: Record<string, unknown>): void };
/** Liga a caixinha de informação a um item (mouse e teclado; no celular não tem). `chave` é estável entre um desenho e
 *  outro (a caixinha aberta passa pro item novo, com os números novos); `titulo` vai em cima e `texto()` embaixo
 *  (null = sem caixinha agora). Montado em tela.ts em cima do `dicas.ligar` de dicaTela.ts. */
export type Dicas = { ligar(alvo: HTMLElement, chave: string, titulo: string, texto: () => string | null): void };
export type TelaMecanica = { elemento: HTMLElement; renderizar(l: LugarEstado, ocupado: boolean, agoraMs: number): void };
export type Mecanica = {
  criar(a: AcoesMecanica, dicas: Dicas): TelaMecanica;
  /** A foto da produção montada das peças (canvas 48×48, pixel art, escala por CSS). */
  foto(partes: readonly number[]): HTMLCanvasElement;
  /** O caderninho do lugar (o que a pessoa descobriu). */
  caderninho(itens: readonly NotaCaderninho[]): HTMLElement;
  /** O que o próximo nível libera ("Tema: praia", "Peça: regata"); vazio = só rende mais. */
  libera(nivel: number): string[];
};
/** Preenchido pelas partes 2 a 4 (camisetaria = 3, copão = 4, jantar = 7). */
export const MECANICAS: Partial<Record<number, Mecanica>> = {};
