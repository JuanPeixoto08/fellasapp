import { describe, expect, it } from 'vitest';

import { createPlayer } from './player';

describe('fila de animação da mesa', () => {
  it('toca em ordem e, cancelada, descarta o que estava esperando', async () => {
    const played: string[] = [];
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const player = createPlayer(async (steps: string[]) => {
      played.push(...steps);
      if (steps[0] === 'a') await gate;
    });
    player.push(['a']);
    await new Promise((r) => setTimeout(r, 0)); // 'a' já está tocando
    player.push(['b']);
    player.cancel(); // aba escondida: o que estava na fila não toca mais
    player.push(['c']);
    release();
    await player.idle();
    expect(played).toEqual(['a', 'c']);
  });
});
