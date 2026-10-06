import { ACCENTS_FROM, ACCENTS_TO, cleanPlace, placeKey, PLACE_MAX } from '../lib/places';

describe('cleanPlace', () => {
  it('tira espaços das pontas e junta os repetidos', () => {
    expect(cleanPlace('  Bar   do\tZé \n')).toBe('Bar do Zé');
  });

  it('vazio, só espaços ou nada vira null', () => {
    expect(cleanPlace('')).toBeNull();
    expect(cleanPlace('   ')).toBeNull();
    expect(cleanPlace(null)).toBeNull();
    expect(cleanPlace(undefined)).toBeNull();
  });
});

describe('placeKey', () => {
  it('mesma chave para grafias diferentes do mesmo lugar', () => {
    expect(placeKey('Bar do Zé')).toBe('bar do ze');
    expect(placeKey('  BAR  DO ZÉ ')).toBe('bar do ze');
    expect(placeKey('bar do ze')).toBe('bar do ze');
  });

  it('tira acento de vogais, ç e ñ', () => {
    expect(placeKey('Açaí da Conceição')).toBe('acai da conceicao');
    expect(placeKey('Peñarol')).toBe('penarol');
  });

  it('acento decomposto (NFD) também', () => {
    expect(placeKey('Zé')).toBe('ze');
  });

  it('vazio vira chave vazia', () => {
    expect(placeKey('  ')).toBe('');
    expect(placeKey(null)).toBe('');
  });
});

describe('tabela de acentos', () => {
  it('cada letra com acento tem a sua sem acento', () => {
    expect(Array.from(ACCENTS_FROM)).toHaveLength(Array.from(ACCENTS_TO).length);
  });

  it('limite do local', () => {
    expect(PLACE_MAX).toBe(60);
  });
});
