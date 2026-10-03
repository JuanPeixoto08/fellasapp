import { resolveUrl } from '../lib/api/storage';
import { friendlyError, isUniqueViolation } from '../lib/errors';
import { withLike } from '../lib/reactionState';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

describe('withLike', () => {
  it('curte e descurte ajustando a contagem', () => {
    const post = { id: 'p1', likedByMe: false, likeCount: 2 };
    expect(withLike(post, true)).toEqual({ id: 'p1', likedByMe: true, likeCount: 3 });
    expect(withLike({ ...post, likedByMe: true }, false)).toMatchObject({ likeCount: 1 });
  });

  it('é idempotente: aplicar o mesmo estado não mexe na contagem', () => {
    const post = { likedByMe: true, likeCount: 1 };
    expect(withLike(post, true)).toBe(post);
  });

  it('nunca deixa a contagem negativa', () => {
    expect(withLike({ likedByMe: true, likeCount: 0 }, false).likeCount).toBe(0);
  });
});

describe('friendlyError', () => {
  it('troca erro de rede por mensagem em pt-BR', () => {
    expect(friendlyError(new TypeError('Failed to fetch'), 'x')).toBe('Sem conexão. Confere a internet e tenta de novo.');
    expect(friendlyError(new Error('Network request failed'), 'x')).toMatch(/Sem conexão/);
  });

  it('avisa quando a foto passa do limite do bucket', () => {
    expect(friendlyError({ message: 'The object exceeded the maximum allowed size' }, 'x')).toMatch(/5 MB/);
  });

  it('cai no fallback em vez de mostrar a mensagem crua', () => {
    expect(friendlyError(new Error('new row violates row-level security policy'), 'Não rolou.')).toBe('Não rolou.');
    expect(friendlyError(undefined, 'Não rolou.')).toBe('Não rolou.');
  });
});

describe('isUniqueViolation', () => {
  it('reconhece o código 23505 do Postgres', () => {
    expect(isUniqueViolation({ code: '23505', message: 'duplicate key' })).toBe(true);
    expect(isUniqueViolation(new Error('x'))).toBe(false);
    expect(isUniqueViolation(null)).toBe(false);
  });
});

describe('resolveUrl', () => {
  const signed = new Map([['u1/a.jpg', 'https://signed/u1/a.jpg']]);
  it('usa a URL assinada, mantém URL externa e devolve null no resto', () => {
    expect(resolveUrl('u1/a.jpg', signed)).toBe('https://signed/u1/a.jpg');
    expect(resolveUrl('https://cdn/x.png', signed)).toBe('https://cdn/x.png');
    expect(resolveUrl('u1/sem-assinatura.jpg', signed)).toBeNull();
    expect(resolveUrl(null, signed)).toBeNull();
  });
});
