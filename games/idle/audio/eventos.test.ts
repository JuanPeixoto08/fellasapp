import { describe, expect, it } from 'vitest';

import type { IdleState } from '../../shared/types';
import { quantasCompradas, somDaCompra, sonsDaMudanca } from './eventos';

const estado = (x: Partial<IdleState> = {}) => ({ user_id: 'u', era: 2, chefes: [], generators: [5, 2, 0], ...x }) as unknown as IdleState;

describe('sons das mudanças de estado', () => {
  it('primeira carga não toca nada', () => {
    expect(sonsDaMudanca(null, estado({ era: 3 }))).toEqual([]);
  });
  it('era nova toca; vender a startup (era volta pra 1) não toca "era"', () => {
    expect(sonsDaMudanca(estado({ era: 2 }), estado({ era: 3 }))).toEqual(['era']);
    expect(sonsDaMudanca(estado({ era: 4 }), estado({ era: 1 }))).toEqual([]);
  });
  it('chefe novo = alguém te contratou; chefe que já estava não toca de novo', () => {
    const b = { user_id: 'b', cargo: 'sócio', mult: 1, ate: 'x' };
    expect(sonsDaMudanca(estado(), estado({ chefes: [b] } as Partial<IdleState>))).toEqual(['contratado']);
    expect(sonsDaMudanca(estado({ chefes: [b] } as Partial<IdleState>), estado({ chefes: [b] } as Partial<IdleState>))).toEqual([]);
  });
  it('quantas unidades a compra levou (gerador); melhoria e sem antes = 1', () => {
    expect(quantasCompradas(estado(), estado({ generators: [15, 2, 0] }), 'gerador', 1)).toBe(10);
    expect(quantasCompradas(null, estado(), 'gerador', 1)).toBe(1);
    expect(quantasCompradas(estado(), estado(), 'melhoria', 3)).toBe(1);
  });
  it('entrar na era 6 de verdade toca a fanfarra; as outras eras, o efeito de sempre', () => {
    const e = (era: number) => ({ user_id: 'u', era, chefes: [] }) as unknown as IdleState;
    expect(sonsDaMudanca(e(5), e(6))).toEqual(['zaratustra']);
    expect(sonsDaMudanca(e(6), e(7))).toEqual(['era']);
    expect(sonsDaMudanca(e(4), e(5))).toEqual(['era']);
  });
  it('a melhoria da Valsa do Danúbio Azul (331) toca a valsa no lugar da moeda', () => {
    expect(somDaCompra('melhoria', 331, 1)).toBe('valsa');
    expect(somDaCompra('melhoria', 332, 1)).toBe('compra');
    expect(somDaCompra('gerador', 331, 1)).toBe('compra');
    expect(somDaCompra('gerador', 5, 10)).toBe('compraMuitas');
  });
});
