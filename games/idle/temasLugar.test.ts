// @vitest-environment happy-dom
import { describe, expect, it } from 'vitest';
import { aplicarTema, TEMAS_LUGAR } from './temasLugar';

/** Contraste WCAG entre duas cores #RRGGBB. */
function contraste(a: string, b: string): number {
  const lum = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const c = parseInt(hex.slice(i, i + 2), 16) / 255;
      return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
}

describe('tema de cada lugar', () => {
  it('a camisetaria, o copão e o jantar têm tema com todas as cores', () => {
    for (const id of [3, 4, 7]) {
      const t = TEMAS_LUGAR[id]!;
      expect(Object.keys(t).sort()).toEqual(['acento', 'acento2', 'borda', 'fundo', 'superficie', 'texto']);
      for (const cor of Object.values(t)) expect(cor).toMatch(/^#[0-9A-F]{6}$/);
    }
  });
  it('dá pra ler: texto e destaques contra o fundo e a superfície passam de 4,5:1', () => {
    for (const t of Object.values(TEMAS_LUGAR)) {
      for (const cor of [t!.texto, t!.acento, t!.acento2]) {
        expect(contraste(cor, t!.fundo)).toBeGreaterThanOrEqual(4.5);
        expect(contraste(cor, t!.superficie)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });
  it('aplicar põe as variáveis e o data-tema; lugar sem tema tira tudo', () => {
    const e = document.createElement('div');
    aplicarTema(e, 4);
    expect(e.dataset.tema).toBe('4');
    expect(e.style.getPropertyValue('--lugar-acento')).toBe(TEMAS_LUGAR[4]!.acento);
    aplicarTema(e, 5);
    expect(e.dataset.tema).toBeUndefined();
    expect(e.style.getPropertyValue('--lugar-acento')).toBe('');
  });
});
