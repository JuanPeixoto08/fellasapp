const mockSign = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    storage: {
      from: () => ({
        createSignedUrls: async (paths: string[]) => {
          mockSign(paths);
          return { data: paths.map((path) => ({ path, signedUrl: `https://signed/${path}?v=${mockSign.mock.calls.length}` })), error: null };
        },
      }),
    },
  },
}));

import AsyncStorage from '@react-native-async-storage/async-storage';

import { clearSignedUrlCache, forgetSignedUrlMemory, SIGNED_URL_KEY, signPaths } from '../lib/api/storage';

beforeEach(async () => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  mockSign.mockClear();
  await clearSignedUrlCache();
});
afterEach(() => jest.useRealTimers());

describe('signPaths', () => {
  it('reaproveita o link assinado do mesmo arquivo (a foto não pisca nem baixa de novo)', async () => {
    const first = await signPaths(['u1/a.jpg', 'u1/b.jpg']);
    const again = await signPaths(['u1/a.jpg', 'u1/c.jpg']);
    expect(mockSign.mock.calls).toEqual([[['u1/a.jpg', 'u1/b.jpg']], [['u1/c.jpg']]]);
    expect(again.get('u1/a.jpg')).toBe(first.get('u1/a.jpg'));
    expect(again.get('u1/c.jpg')).toBeTruthy();
  });

  it('o link vale 7 dias: no meio do caminho reaproveita; faltando menos de 1 dia, assina de novo', async () => {
    const first = await signPaths(['u1/a.jpg']);
    jest.setSystemTime(new Date('2026-10-09T12:00:00Z')); // 5 dias depois
    expect((await signPaths(['u1/a.jpg'])).get('u1/a.jpg')).toBe(first.get('u1/a.jpg'));
    expect(mockSign).toHaveBeenCalledTimes(1);
    jest.setSystemTime(new Date('2026-10-10T13:00:00Z')); // faltam 23 h
    const later = await signPaths(['u1/a.jpg']);
    expect(mockSign).toHaveBeenCalledTimes(2);
    expect(later.get('u1/a.jpg')).not.toBe(first.get('u1/a.jpg'));
  });

  it('guarda os links no aparelho: reabrir o app reaproveita o mesmo link (o navegador não baixa a foto de novo)', async () => {
    const first = await signPaths(['u1/a.jpg']);
    forgetSignedUrlMemory(); // como fechar e abrir o app
    const again = await signPaths(['u1/a.jpg']);
    expect(mockSign).toHaveBeenCalledTimes(1);
    expect(again.get('u1/a.jpg')).toBe(first.get('u1/a.jpg'));
  });

  it('link guardado já vencido (ou estragado) é ignorado', async () => {
    await AsyncStorage.setItem(SIGNED_URL_KEY, JSON.stringify({
      'u1/velho.jpg': { url: 'https://signed/velho', expiresAt: Date.parse('2026-10-04T11:00:00Z') },
      'u1/torto.jpg': { url: 42, expiresAt: 'x' },
    }));
    forgetSignedUrlMemory();
    const r = await signPaths(['u1/velho.jpg', 'u1/torto.jpg']);
    expect(mockSign.mock.calls).toEqual([[['u1/velho.jpg', 'u1/torto.jpg']]]);
    expect(r.get('u1/velho.jpg')).not.toBe('https://signed/velho');
    await AsyncStorage.setItem(SIGNED_URL_KEY, '{nao é json');
    forgetSignedUrlMemory();
    expect((await signPaths(['u1/a.jpg'])).get('u1/a.jpg')).toBeTruthy();
  });

  it('limpar (ao sair da conta) apaga também o que estava no aparelho', async () => {
    await signPaths(['u1/a.jpg']);
    await clearSignedUrlCache();
    forgetSignedUrlMemory();
    await signPaths(['u1/a.jpg']);
    expect(mockSign).toHaveBeenCalledTimes(2);
  });

  it('tudo em cache: nem chama o servidor', async () => {
    await signPaths(['u1/a.jpg']);
    await signPaths(['u1/a.jpg', null, 'https://externa/x.jpg']);
    expect(mockSign).toHaveBeenCalledTimes(1);
  });
});
