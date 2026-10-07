import * as theme from '../lib/theme';

const { colors } = theme;

function luminance(hex: string) {
  const c = [1, 3, 5].map((i) => {
    const v = parseInt(hex.slice(i, i + 2), 16) / 255;
    return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function contrast(a: string, b: string) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

describe('cores do tema', () => {
  it('brandSoft (fundo da minha reação): texto AA, borda brand visível e emoji amarelo legível no escuro', () => {
    for (const scheme of [colors.light, colors.dark]) {
      expect(contrast(scheme.text, scheme.brandSoft)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(scheme.brand, scheme.brandSoft)).toBeGreaterThanOrEqual(3);
    }
    // o amarelo dos emojis (😮 🎃) sumia no chip creme do tema escuro
    expect(contrast('#FFCC4D', colors.dark.brandSoft)).toBeGreaterThanOrEqual(4.5);
  });

  it('acento neutro (sem amarelo) e onAccent têm contraste AA nos dois temas', () => {
    for (const scheme of [colors.light, colors.dark]) {
      expect(scheme.accent).not.toBe('#FFE14D');
      expect(contrast(scheme.accent, scheme.bg)).toBeGreaterThanOrEqual(4.5);
      expect(contrast(scheme.onAccent, scheme.accent)).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('vermelho da curtida tem contraste AA sobre bg e é diferente do danger', () => {
    for (const scheme of [colors.light, colors.dark]) {
      expect(contrast(scheme.like, scheme.bg)).toBeGreaterThanOrEqual(4.5);
      expect(scheme.like).not.toBe(scheme.danger);
    }
  });

  it('brand tem contraste AA sobre bg em claro e escuro', () => {
    expect(contrast(colors.light.brand, colors.light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dark.brand, colors.dark.bg)).toBeGreaterThanOrEqual(4.5);
  });

  it('onBrand tem contraste AA sobre brand (bolinha de notificações)', () => {
    expect(contrast(colors.light.onBrand, colors.light.brand)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dark.onBrand, colors.dark.brand)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('cor de perfil (removida)', () => {
  it('o tema não tem mais paleta nem cor por fella', () => {
    expect(theme).not.toHaveProperty('profilePalette');
    expect(theme).not.toHaveProperty('profileColor');
  });
});
