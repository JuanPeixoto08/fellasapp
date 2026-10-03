import { render, screen } from '@testing-library/react-native';

import ProfileStats from '../components/profile/ProfileStats';
import { getProfileStats } from '../lib/api/profileStats';

const mockCalls: { table: string; select: unknown[]; eq: unknown[] }[] = [];
let mockFail = false;

jest.mock('../lib/supabase', () => {
  const counts: Record<string, number> = { posts: 3, likes: 12, comments: 5 };
  return {
    supabase: {
      from: (table: string) => {
        const call = { table, select: [] as unknown[], eq: [] as unknown[] };
        mockCalls.push(call);
        const b: any = {
          select: (...a: unknown[]) => ((call.select = a), b),
          eq: (...a: unknown[]) => ((call.eq = a), b),
          single: () =>
            Promise.resolve({ data: { created_at: '2026-01-01T00:00:00Z' }, error: null }),
          then: (res: (v: unknown) => unknown) =>
            Promise.resolve(
              mockFail
                ? { count: null, error: new Error('falhou') }
                : { count: counts[table], error: null },
            ).then(res),
        };
        return b;
      },
    },
  };
});

describe('getProfileStats', () => {
  beforeEach(() => {
    mockCalls.length = 0;
    mockFail = false;
  });

  it('agrega contagens e memberSince', async () => {
    await expect(getProfileStats('u1')).resolves.toEqual({
      posts: 3,
      likesReceived: 12,
      commentsReceived: 5,
      memberSince: '2026-01-01T00:00:00Z',
    });
    const likes = mockCalls.find((c) => c.table === 'likes')!;
    expect(likes.select[1]).toEqual({ count: 'exact', head: true });
    expect(likes.eq).toEqual(['posts.author_id', 'u1']);
  });

  it('propaga erro', async () => {
    mockFail = true;
    await expect(getProfileStats('u1')).rejects.toThrow('falhou');
  });
});

describe('ProfileStats', () => {
  it('mostra números e rótulos', async () => {
    await render(
      <ProfileStats
        stats={{ posts: 3, likesReceived: 12, commentsReceived: 5 }}
        color={{ bg: '#FFE14D', ink: '#121212' }}
      />,
    );
    expect(screen.getByText('3')).toBeTruthy();
    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getByText('5')).toBeTruthy();
    expect(screen.getByText('posts')).toBeTruthy();
    expect(screen.getByText('curtidas')).toBeTruthy();
    expect(screen.getByText('comentários')).toBeTruthy();
  });
});
