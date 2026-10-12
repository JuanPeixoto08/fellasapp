// Mapa do rolê: o registro das mecânicas de cada lugar. A moldura (lugarTela.ts) desenha o cabeçalho, o pódio, a semana,
// o desafio e os marcos; o miolo de cada lugar vem daqui. As partes 2 a 4 preenchem (camisetaria = 3, copão = 4, jantar = 7).
//
// O contrato das partes 2 a 4 (o mesmo bloco está na 0057, junto dos despachantes):
// * No banco, cada lugar só troca os stubs dele: idle_tee_* (3), idle_cup_* (4), idle_din_* (7) — idle_<x>_avancar(s),
//   idle_<x>_depois(s) e idle_<x>_json(s). idle_place_avancar, idle_place_depois e idle_place_mecanica_json já chamam os nove.
// * O que precisa da conta fechada (registrar, caderninho, desafio, conquistas) vai no idle_<x>_depois, que devolve o s (o
//   prêmio de desafio mexe no valuation). idle_lugar e idle_mapa já rodam o idle_place_depois; a RPC de mecânica termina com
//   `return idle_place_responder(s, p_lugar)` (depois, save, marcos e a resposta padrão).
// * A RPC de cada ação trava, fecha a conta e salva (idle_save) antes de mexer no lugar, e devolve
//   idle_json(s) || jsonb_build_object('lugar', idle_lugar_json(s, p), 'marcos_novos', ...); a tela chama por
//   `acao(fn, args)` (args com os nomes p_* da função) e main.ts avisa os marcos_novos ("Marco: +N%").
// * Ajudante de banco fica revogado de public, anon e authenticated; o regex de shared/api.ts é só cosmético.
// * Código de erro novo vai em shared/errors.ts (FROM_DB e ERROR_TEXT) e, se a tela precisa buscar o lugar de novo, em
//   RECARREGA_MAPA de main.ts.
// * idle_place_mecanica_json e os idle_<x>_json são estáveis: só leem, nunca escrevem.
// * visto_em só é lido dentro de idle_<x>_avancar (null = nunca passou; o s que chega é o de antes da visita de agora).
// * `libera(n)`: n é o nível que se alcança (nivel + 1).
// * idle_place_registrar, idle_place_desafio, idle_place_nota e idle_place_marcos só com o estado travado, a conta fechada e
//   salva antes; marcos e conquistas nunca dentro do avancar.
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
