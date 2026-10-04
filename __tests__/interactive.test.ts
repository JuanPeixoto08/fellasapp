import { interactiveStyle } from '../components/ui/interactive';
import { getTheme } from '../lib/theme';

const t = getTheme('light');

describe('interactiveStyle', () => {
  it('fica no fundo base sem interação', () => {
    expect(interactiveStyle(t, { pressed: false })).toEqual({ backgroundColor: 'transparent', cursor: 'pointer' });
    expect(interactiveStyle(t, { pressed: false }, t.colors.bg).backgroundColor).toBe(t.colors.bg);
  });

  it('pressionado ou com mouse em cima (web) usa surfaceSunken', () => {
    expect(interactiveStyle(t, { pressed: true }).backgroundColor).toBe(t.colors.surfaceSunken);
    expect(interactiveStyle(t, { pressed: false, hovered: true } as never).backgroundColor).toBe(t.colors.surfaceSunken);
  });
});

describe('CSS global da web', () => {
  it('inclui a altura 100dvh (tab bar e colunas na altura certa)', () => {
    const { WEB_CSS } = require('../lib/webStyles');
    expect(WEB_CSS).toContain('#root { height: 100dvh; }');
  });
});
