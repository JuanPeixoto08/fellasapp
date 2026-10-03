import {
  REACTION_EMOJIS,
  setCommentReaction,
  setPostReaction,
  summarizeReactions,
} from '../lib/api/reactions';

const mockCalls: { table: string; op: string; args: unknown[] }[] = [];
let mockResults: Record<string, unknown> = {};

jest.mock('../lib/supabase', () => {
  const makeBuilder = (table: string) => {
    let op = 'select';
    const b: any = {};
    for (const m of ['select', 'upsert', 'delete', 'eq', 'in']) {
      b[m] = (...args: unknown[]) => {
        if (['upsert', 'delete'].includes(m)) op = m;
        mockCalls.push({ table, op: m, args });
        return b;
      };
    }
    b.then = (res: any, rej: any) =>
      Promise.resolve(mockResults[`${table}.${op}`] ?? { data: null, error: null }).then(res, rej);
    return b;
  };
  return {
    supabase: {
      auth: { getUser: async () => ({ data: { user: { id: 'me' } }, error: null }) },
      from: (table: string) => makeBuilder(table),
    },
  };
});

beforeEach(() => {
  mockCalls.length = 0;
  mockResults = {};
});

describe('REACTION_EMOJIS', () => {
  it('has the six WhatsApp-style emojis', () => {
    expect([...REACTION_EMOJIS]).toEqual(['👍', '❤️', '😂', '😮', '😢', '🙏']);
  });
});

describe('setPostReaction', () => {
  it('upserts (set or change) the reaction', async () => {
    await setPostReaction('p1', '😂');
    expect(mockCalls).toContainEqual({
      table: 'post_reactions',
      op: 'upsert',
      args: [{ post_id: 'p1', user_id: 'me', emoji: '😂' }, { onConflict: 'post_id,user_id' }],
    });
  });

  it('deletes when emoji is null', async () => {
    await setPostReaction('p1', null);
    expect(mockCalls).toContainEqual({ table: 'post_reactions', op: 'eq', args: ['post_id', 'p1'] });
    expect(mockCalls).toContainEqual({ table: 'post_reactions', op: 'eq', args: ['user_id', 'me'] });
    expect(mockCalls.some((c) => c.op === 'delete')).toBe(true);
    expect(mockCalls.some((c) => c.op === 'upsert')).toBe(false);
  });

  it('throws on supabase error', async () => {
    mockResults['post_reactions.upsert'] = { data: null, error: new Error('boom') };
    await expect(setPostReaction('p1', '👍')).rejects.toThrow('boom');
  });
});

describe('setCommentReaction', () => {
  it('upserts and deletes on the comment table', async () => {
    await setCommentReaction('c1', '🙏');
    expect(mockCalls).toContainEqual({
      table: 'comment_reactions',
      op: 'upsert',
      args: [{ comment_id: 'c1', user_id: 'me', emoji: '🙏' }, { onConflict: 'comment_id,user_id' }],
    });
    mockCalls.length = 0;
    await setCommentReaction('c1', null);
    expect(mockCalls.some((c) => c.table === 'comment_reactions' && c.op === 'delete')).toBe(true);
  });
});

describe('summarizeReactions', () => {
  it('groups by emoji, sorts by count desc and finds mine', () => {
    const out = summarizeReactions(
      [
        { user_id: 'a', emoji: '😂' },
        { user_id: 'me', emoji: '❤️' },
        { user_id: 'b', emoji: '❤️' },
        { user_id: 'c', emoji: '❤️' },
      ],
      'me',
    );
    expect(out).toEqual({
      reactions: [
        { emoji: '❤️', count: 3 },
        { emoji: '😂', count: 1 },
      ],
      myReaction: '❤️',
    });
  });

  it('returns empty state', () => {
    expect(summarizeReactions([], 'me')).toEqual({ reactions: [], myReaction: null });
  });
});
