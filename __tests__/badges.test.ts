import { badgeLabel, visibleBadges } from '../lib/badges';

describe('visibleBadges', () => {
  it('tira os escondidos', () => expect(visibleBadges(['verified'], ['verified'])).toEqual([]));
  it('sem escondidos mostra todos', () => expect(visibleBadges(['verified'], [])).toEqual(['verified']));
  it('campos faltando', () => {
    expect(visibleBadges(undefined, undefined)).toEqual([]);
    expect(visibleBadges(['verified'], null)).toEqual(['verified']);
  });
  it('escondido que a pessoa não tem mais é ignorado', () => expect(visibleBadges([], ['verified'])).toEqual([]));
});

describe('badgeLabel', () => {
  it('rótulo conhecido ou null', () => {
    expect(badgeLabel('verified')).toBe('Selo de verificado');
    expect(badgeLabel('xyz')).toBeNull();
  });
});
