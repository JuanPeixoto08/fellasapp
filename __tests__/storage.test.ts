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

import { clearSignedUrlCache, signPaths } from '../lib/api/storage';

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(new Date('2026-10-04T12:00:00Z'));
  mockSign.mockClear();
  clearSignedUrlCache();
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

  it('perto de vencer, assina de novo', async () => {
    const first = await signPaths(['u1/a.jpg']);
    jest.setSystemTime(new Date('2026-10-04T12:55:00Z'));
    const later = await signPaths(['u1/a.jpg']);
    expect(mockSign).toHaveBeenCalledTimes(2);
    expect(later.get('u1/a.jpg')).not.toBe(first.get('u1/a.jpg'));
  });

  it('tudo em cache: nem chama o servidor', async () => {
    await signPaths(['u1/a.jpg']);
    await signPaths(['u1/a.jpg', null, 'https://externa/x.jpg']);
    expect(mockSign).toHaveBeenCalledTimes(1);
  });
});
