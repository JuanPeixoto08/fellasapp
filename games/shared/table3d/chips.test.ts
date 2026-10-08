import { describe, expect, it } from 'vitest';

import { chipStack } from './chips';

describe('chipStack', () => {
  it('aposta vira fichas, das maiores para as menores', () => {
    expect(chipStack(150)).toEqual([100, 50]);
    expect(chipStack(1000)).toEqual([500, 500]);
    expect(chipStack(70)).toEqual([50, 10, 10]);
    expect(chipStack(0)).toEqual([]);
  });

  it('pilha tem no máximo 10 fichas', () => {
    expect(chipStack(990)).toHaveLength(10);
  });
});
