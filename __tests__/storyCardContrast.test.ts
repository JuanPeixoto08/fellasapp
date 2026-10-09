import { BACKGROUND_LABEL, BACKGROUND_ORDER, luminance, paletteFor } from '../lib/storyCard/contrast';
import { storyCard } from '../lib/theme';

describe('cores do recorte por fundo', () => {
  it('luminância relativa: branco 1, preto 0', () => {
    expect(luminance('#FFFFFF')).toBeCloseTo(1);
    expect(luminance('#000000')).toBe(0);
  });

  it('fundo papel (claro): marca em tinta, recorte branco, fita e sombra claras', () => {
    const p = paletteFor('papel');
    expect(p.bg).toBe(storyCard.backgrounds.papel);
    expect(p.mark).toBe(storyCard.ink);
    expect(p.paper).toBe(storyCard.paperOnLight);
    expect(p.tape).toBe(storyCard.tapeOnLight);
    expect(p.shadow).toBe(storyCard.shadowOnLight);
  });

  it.each(['violeta', 'tinta', 'vermelho'] as const)('fundo %s (escuro): marca em papel', (bg) => {
    const p = paletteFor(bg);
    expect(p.bg).toBe(storyCard.backgrounds[bg]);
    expect(p.mark).toBe(storyCard.paper);
    expect(p.paper).toBe(storyCard.paper);
  });

  it('fundo da foto vai escurecido: conta como escuro e não tem cor própria', () => {
    const p = paletteFor('photo');
    expect(p.bg).toBeNull();
    expect(p.mark).toBe(storyCard.paper);
  });

  it('ordem das bolinhas e rótulos acessíveis', () => {
    expect(BACKGROUND_ORDER).toEqual(['photo', 'violeta', 'tinta', 'vermelho', 'papel']);
    expect(BACKGROUND_LABEL.violeta).toBe('Fundo violeta');
    expect(BACKGROUND_LABEL.photo).toBe('Fundo com a foto do post');
  });
});
