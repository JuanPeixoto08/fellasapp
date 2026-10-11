// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { assinarFotos, CHAVE_FOTOS } from './fotos';

const servidor = vi.fn(async (caminhos: string[], _ttl: number) =>
  caminhos.map((path) => ({ path, signedUrl: `https://signed/${path}?v=${servidor.mock.calls.length}` })));

beforeEach(() => {
  localStorage.clear();
  servidor.mockClear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-10-11T12:00:00Z'));
});

describe('links das fotos nos jogos', () => {
  it('assina por 7 dias e guarda no aparelho: a segunda chamada (ou outra página) reaproveita o mesmo link', async () => {
    const a = await assinarFotos(['u1/a.jpg', 'u1/b.gif'], servidor);
    expect(servidor).toHaveBeenCalledWith(['u1/a.jpg', 'u1/b.gif'], 7 * 24 * 3600);
    const b = await assinarFotos(['u1/a.jpg'], servidor);
    expect(servidor).toHaveBeenCalledTimes(1);
    expect(b.get('u1/a.jpg')).toBe(a.get('u1/a.jpg'));
  });
  it('lê a mesma chave do app (um link assinado no feed serve no jogo)', async () => {
    localStorage.setItem(CHAVE_FOTOS, JSON.stringify({ 'u1/a.jpg': { url: 'https://signed/do-app', expiresAt: Date.now() + 3 * 864e5 } }));
    expect((await assinarFotos(['u1/a.jpg'], servidor)).get('u1/a.jpg')).toBe('https://signed/do-app');
    expect(servidor).not.toHaveBeenCalled();
  });
  it('faltando menos de 1 dia (ou vencido, ou estragado), assina de novo', async () => {
    localStorage.setItem(CHAVE_FOTOS, JSON.stringify({
      'u1/quase.jpg': { url: 'https://signed/quase', expiresAt: Date.now() + 23 * 3600e3 },
      'u1/torto.jpg': { url: 7 },
    }));
    const r = await assinarFotos(['u1/quase.jpg', 'u1/torto.jpg'], servidor);
    expect(servidor).toHaveBeenCalledWith(['u1/quase.jpg', 'u1/torto.jpg'], 7 * 24 * 3600);
    expect(r.get('u1/quase.jpg')).not.toBe('https://signed/quase');
    localStorage.setItem(CHAVE_FOTOS, '{nao é json');
    expect((await assinarFotos(['u1/a.jpg'], servidor)).get('u1/a.jpg')).toBeTruthy();
  });
  it('lista vazia não chama o servidor', async () => {
    expect((await assinarFotos([], servidor)).size).toBe(0);
    expect(servidor).not.toHaveBeenCalled();
  });
});
