import { colors, profileColor, profileColorKeys, profilePalette } from '../lib/theme';

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

describe('profilePalette', () => {
  it.each(profileColorKeys)('%s: ink tem contraste AA sobre bg', (key) => {
    expect(contrast(profilePalette[key].bg, profilePalette[key].ink)).toBeGreaterThanOrEqual(4.5);
  });

  it('brand tem contraste AA sobre bg em claro e escuro', () => {
    expect(contrast(colors.light.brand, colors.light.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrast(colors.dark.brand, colors.dark.bg)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('profileColor', () => {
  it('usa a chave válida', () => {
    expect(profileColor('u1', 'mint')).toEqual({ key: 'mint', ...profilePalette.mint });
  });

  it('é determinístico por userId', () => {
    expect(profileColor('user-abc')).toEqual(profileColor('user-abc'));
    expect(profileColor('user-abc', null)).toEqual(profileColor('user-abc'));
  });

  it.each([undefined, null, '', 'roxo', 'toString'])('chave inválida (%p) cai no fallback do userId', (bad) => {
    expect(profileColor('user-abc', bad)).toEqual(profileColor('user-abc'));
    expect(profileColorKeys).toContain(profileColor('user-abc', bad).key);
  });

  it('distribui ids diferentes em mais de uma cor', () => {
    const keys = new Set(Array.from({ length: 40 }, (_, i) => profileColor(`id-${i}`).key));
    expect(keys.size).toBeGreaterThan(3);
  });
});
