import { activeMention, insertMention, splitMentions, suggestMembers } from '../lib/mentions';

const ana = { id: 'u1', username: 'ana', name: 'Ana Souza', avatarUrl: null };
const andre = { id: 'u2', username: 'andre_7', name: 'André', avatarUrl: null };
const bia = { id: 'u3', username: 'bia', name: 'Bia', avatarUrl: null };
const members = [ana, andre, bia];

describe('activeMention', () => {
  it('acha o @ que está sendo digitado antes do cursor', () => {
    expect(activeMention('oi @an', 6)).toEqual({ start: 3, query: 'an' });
    expect(activeMention('@', 1)).toEqual({ start: 0, query: '' });
    expect(activeMention('oi @ana tudo', 7)).toEqual({ start: 3, query: 'ana' });
  });

  it('não é menção: e-mail, espaço depois, cursor longe', () => {
    expect(activeMention('ana@gmail', 9)).toBeNull();
    expect(activeMention('oi @ana ', 8)).toBeNull();
    expect(activeMention('oi @ana tudo', 12)).toBeNull();
    expect(activeMention('oi', 2)).toBeNull();
  });
});

describe('suggestMembers', () => {
  it('pelo começo do usuário ou do nome, sem acento e sem maiúscula', () => {
    expect(suggestMembers(members, 'an').map((m) => m.id)).toEqual(['u1', 'u2']);
    expect(suggestMembers(members, 'AND').map((m) => m.id)).toEqual(['u2']);
    expect(suggestMembers(members, 'souza').map((m) => m.id)).toEqual(['u1']);
    expect(suggestMembers(members, '').map((m) => m.id)).toEqual(['u1', 'u2', 'u3']);
    expect(suggestMembers(members, 'zz')).toEqual([]);
  });

  it('respeita o limite', () => {
    expect(suggestMembers(members, '', 2)).toHaveLength(2);
  });
});

describe('insertMention', () => {
  it('troca o @parcial pelo usuário com espaço depois', () => {
    expect(insertMention('oi @an', { start: 3, query: 'an' }, 'ana')).toBe('oi @ana ');
    expect(insertMention('oi @an tudo bem', { start: 3, query: 'an' }, 'ana')).toBe('oi @ana tudo bem');
  });
});

describe('splitMentions', () => {
  it('separa as menções de fellas que existem, o resto vira texto', () => {
    const byUsername = new Map(members.map((m) => [m.username, m]));
    expect(splitMentions('@ana parabéns! cc @fulano e @Bia.', byUsername)).toEqual([
      { text: '@ana', member: ana },
      { text: ' parabéns! cc @fulano e ' },
      { text: '@Bia', member: bia },
      { text: '.' },
    ]);
    expect(splitMentions('mande pra ana@gmail.com', byUsername)).toEqual([{ text: 'mande pra ana@gmail.com' }]);
    expect(splitMentions('', byUsername)).toEqual([]);
  });
});

describe('splitMentions com tags', () => {
  const byUsername = new Map([['ana', { id: 'u1' }]]);

  it('@ e # no mesmo texto', () => {
    expect(splitMentions('oi @ana olha #Arte!', byUsername, { tags: true })).toEqual([
      { text: 'oi ' },
      { text: '@ana', member: { id: 'u1' } },
      { text: ' olha ' },
      { text: '#Arte', tag: 'arte' },
      { text: '!' },
    ]);
  });

  it('sem { tags: true } a # fica texto', () => {
    expect(splitMentions('olha #arte', byUsername)).toEqual([{ text: 'olha #arte' }]);
  });
});
