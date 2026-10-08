const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));

import { openProfile } from '../lib/openProfile';
import { parseProfileTab, profileTabParam } from '../lib/profileTab';

describe('aba do perfil no endereço', () => {
  it('aba=musica abre Música; fotos abre Fotos', () => {
    expect(parseProfileTab('musica')).toBe('music');
    expect(parseProfileTab('fotos')).toBe('photos');
    expect(parseProfileTab(['musica'])).toBe('music');
  });

  it('valor desconhecido ou ausente: nada (fica em Posts)', () => {
    expect(parseProfileTab('xyz')).toBeUndefined();
    expect(parseProfileTab(undefined)).toBeUndefined();
  });

  it('de volta para o endereço', () => {
    expect(profileTabParam('music')).toBe('musica');
    expect(profileTabParam('photos')).toBe('fotos');
  });

  it('openProfile com aba leva a /@usuario?aba=musica', () => {
    openProfile('ana', { tab: 'music' });
    expect(mockPush).toHaveBeenLastCalledWith('/@ana?aba=musica');
    openProfile('ana');
    expect(mockPush).toHaveBeenLastCalledWith('/@ana');
  });
});
