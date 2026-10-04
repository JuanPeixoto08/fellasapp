import type { StoryGroup } from '../lib/api/stories';
import { nextCursor, orderGroups, prevCursor, startAt } from '../lib/storyPlayer';

const story = (id: string, seen = false) => ({ id, authorId: '', kind: 'photo' as const, mediaUrl: '', durationMs: 5000, createdAt: '', seen, myReaction: null });
const group = (id: string, stories: ReturnType<typeof story>[], latestAt: string): StoryGroup => ({
  author: { id, name: id, username: id, avatarUrl: null },
  stories,
  hasUnseen: stories.some((s) => !s.seen),
  latestAt,
});

const ana = group('ana', [story('a1', true), story('a2', true)], '2026-10-04T10:00:00Z');
const bia = group('bia', [story('b1')], '2026-10-04T09:00:00Z');
const caio = group('caio', [story('c1'), story('c2')], '2026-10-04T11:00:00Z');
const me = group('me', [story('m1', true)], '2026-10-04T08:00:00Z');

describe('storyPlayer', () => {
  it('ordem: eu primeiro, depois não vistos (mais recente primeiro), depois vistos', () => {
    expect(orderGroups([ana, bia, caio, me], 'me').map((g) => g.author.id)).toEqual(['me', 'caio', 'bia', 'ana']);
  });

  it('começa no primeiro não visto da pessoa (ou no story pedido)', () => {
    const gs = [me, caio, bia, ana];
    expect(startAt(gs, 'caio')).toEqual({ group: 1, story: 0 });
    expect(startAt(gs, 'ana')).toEqual({ group: 3, story: 0 }); // tudo visto: do começo
    expect(startAt([group('x', [story('x1', true), story('x2')], '')], 'x')).toEqual({ group: 0, story: 1 });
    expect(startAt(gs, 'caio', 'c2')).toEqual({ group: 1, story: 1 });
    expect(startAt(gs, 'ninguem')).toBeNull();
  });

  it('avança dentro da pessoa, passa para a próxima e termina', () => {
    const gs = [caio, bia];
    expect(nextCursor(gs, { group: 0, story: 0 })).toEqual({ group: 0, story: 1 });
    expect(nextCursor(gs, { group: 0, story: 1 })).toEqual({ group: 1, story: 0 });
    expect(nextCursor(gs, { group: 1, story: 0 })).toBeNull();
  });

  it('volta para o story anterior, para o último da pessoa anterior, e no começo fica', () => {
    const gs = [caio, bia];
    expect(prevCursor(gs, { group: 0, story: 1 })).toEqual({ group: 0, story: 0 });
    expect(prevCursor(gs, { group: 1, story: 0 })).toEqual({ group: 0, story: 1 });
    expect(prevCursor(gs, { group: 0, story: 0 })).toEqual({ group: 0, story: 0 });
  });
});
