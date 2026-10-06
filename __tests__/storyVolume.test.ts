import { Platform } from 'react-native';

const KEY = 'fellas.storyVolume';

function fresh(): typeof import('../lib/storyVolume') {
  let mod!: typeof import('../lib/storyVolume');
  jest.isolateModules(() => {
    mod = require('../lib/storyVolume');
  });
  return mod;
}

afterEach(() => {
  jest.restoreAllMocks();
  delete (globalThis as { localStorage?: unknown }).localStorage;
});

describe('volume dos stories', () => {
  it('começa no máximo e lembra o que a pessoa escolheu enquanto o app está aberto', () => {
    const v = fresh();
    expect(v.loadVolume()).toBe(1);
    v.saveVolume(0.4);
    expect(v.loadVolume()).toBe(0.4);
  });

  it('fica entre 0 e 1', () => {
    const v = fresh();
    v.saveVolume(3);
    expect(v.loadVolume()).toBe(1);
    v.saveVolume(-1);
    expect(v.loadVolume()).toBe(0);
  });

  it('no site guarda no aparelho: abrir de novo volta no mesmo volume', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    const store = new Map<string, string>();
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, val: string) => void store.set(k, val),
    };
    fresh().saveVolume(0.3);
    expect(store.get(KEY)).toBe('0.3');
    expect(fresh().loadVolume()).toBe(0.3);
  });

  it('armazenamento bloqueado ou lixo guardado não quebra: volta ao máximo', () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    (globalThis as { localStorage?: unknown }).localStorage = {
      getItem: () => 'abc',
      setItem: () => {
        throw new Error('bloqueado');
      },
    };
    const v = fresh();
    expect(v.loadVolume()).toBe(1);
    expect(() => v.saveVolume(0.5)).not.toThrow();
    expect(v.loadVolume()).toBe(0.5);
  });
});
