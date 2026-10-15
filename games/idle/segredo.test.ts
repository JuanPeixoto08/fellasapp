import { describe, expect, it } from 'vitest';
import { contadorCliques } from './segredo';

describe('três cliques', () => {
  it('três em até 600 ms disparam; dois não; devagar não', () => {
    const c = contadorCliques();
    expect([c(0), c(200), c(400)]).toEqual([false, false, true]);
    expect([c(1000), c(1200)]).toEqual([false, false]);
    expect(c(2000)).toBe(false); // o par de antes passou de 600 ms
    const d = contadorCliques();
    expect([d(0), d(500), d(900), d(1000)]).toEqual([false, false, false, true]); // conta os 3 últimos
  });
});
