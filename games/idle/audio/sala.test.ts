import { describe, expect, it } from 'vitest';

import { comoContexto, ContextoFalso, ConvolverFalso, destinoFalso, type GanhoFalso } from './falso';
import { criarSala, MOLHADO_ESPACO, molhadoDaEra, respostaSala } from './sala';

describe('a sala (reverb de convolução das eras 6 e 7)', () => {
  it('resposta ao impulso: estéreo, do tamanho pedido, nada antes do pré-atraso, igual toda vez, cauda que cai', () => {
    const [e, d] = respostaSala(8000, 3.2);
    expect(e).toHaveLength(25600);
    expect(d).toHaveLength(25600);
    expect(Array.from(e.slice(0, 160)).every((x) => x === 0)).toBe(true); // 20 ms a 8 kHz
    expect(respostaSala(8000, 3.2)[0]).toEqual(e);
    expect(Array.from(e).every(Number.isFinite)).toBe(true);
    const energia = (a: Float32Array, de: number, ate: number) => a.slice(de, ate).reduce((s, x) => s + x * x, 0);
    expect(energia(e, 160, 2560)).toBeGreaterThan(1000 * energia(e, 23040, 25600)); // o começo e o último 0,32 s: mais de 30 dB
    expect(Array.from(e.slice(1000, 1100))).not.toEqual(Array.from(d.slice(1000, 1100))); // os dois canais diferem (espaço)
  });
  it('é um envio: a entrada vai pro reverb e o molhado vai pro destino; o molhado da era é 0 até a 5', () => {
    const c = new ContextoFalso();
    const sala = criarSala(comoContexto(c), destinoFalso(c));
    const conv = c.criados.find((n): n is ConvolverFalso => n instanceof ConvolverFalso)!;
    expect((sala.entrada as unknown as GanhoFalso).ligados).toEqual([conv]);
    expect(conv.buffer).not.toBeNull();
    const molhado = c.ganhos().find((g) => conv.ligados.includes(g))!;
    expect(molhado.ligados).toEqual([c.destination]);
    sala.molhado(0.45, 2);
    expect(molhado.gain.eventos.at(-1)).toEqual(['alvo', 0.45, 2]);
    expect([0, 1, 5, 6, 7].map(molhadoDaEra)).toEqual([0, 0, 0, MOLHADO_ESPACO, MOLHADO_ESPACO]);
    sala.desligar();
    expect((sala.entrada as unknown as GanhoFalso).ligados).toEqual([]);
  });
});
