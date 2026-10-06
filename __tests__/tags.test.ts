import { activeTag, extractTags, insertTag, normalizeTag } from '../lib/tags';

describe('extractTags', () => {
  it('pega tags com acento, número e _, em minúsculas e sem repetir', () => {
    expect(extractTags('#artes_avantajadas e #Ação #ação #2026')).toEqual(['artes_avantajadas', 'ação', '2026']);
  });

  it('tamanho: 1 caractere não é tag; 30 é; 31 não', () => {
    expect(extractTags('#a')).toEqual([]);
    expect(extractTags(`#${'a'.repeat(30)}`)).toEqual(['a'.repeat(30)]);
    expect(extractTags(`#${'a'.repeat(31)}`)).toEqual([]);
  });

  it('# colado em palavra, ## e âncora de link não contam', () => {
    expect(extractTags('ab#cd')).toEqual([]);
    expect(extractTags('##praia')).toEqual([]);
    expect(extractTags('olha https://site.com/#praia')).toEqual([]);
  });

  it('pontuação e emoji colados depois não entram na tag', () => {
    expect(extractTags('#praia! (#sol) #mar🏖️')).toEqual(['praia', 'sol', 'mar']);
  });

  it('tag no começo e no meio', () => {
    expect(extractTags('#bom dia #fellas')).toEqual(['bom', 'fellas']);
  });
});

describe('normalizeTag', () => {
  it('tira o # e põe em minúsculas', () => {
    expect(normalizeTag('#Artes_Avantajadas')).toBe('artes_avantajadas');
    expect(normalizeTag('AÇÃO')).toBe('ação');
  });
});

describe('activeTag / insertTag', () => {
  it('tag sendo digitada antes do cursor', () => {
    expect(activeTag('olha #ar', 8)).toEqual({ start: 5, query: 'ar' });
    expect(activeTag('olha #', 6)).toEqual({ start: 5, query: '' });
  });

  it('depois de espaço ou colada em palavra não está ativa', () => {
    expect(activeTag('olha #arte legal', 16)).toBeNull();
    expect(activeTag('ab#cd', 5)).toBeNull();
  });

  it('completar troca o pedaço e põe espaço', () => {
    const text = 'olha #ar';
    expect(insertTag(text, { start: 5, query: 'ar' }, 'artes_avantajadas')).toBe('olha #artes_avantajadas ');
    expect(insertTag('#ar já', { start: 0, query: 'ar' }, 'arte')).toBe('#arte já');
  });
});
