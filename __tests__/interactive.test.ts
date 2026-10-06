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

  it('barra de rolagem fina nas cores do tema, clara e escura', () => {
    const { WEB_CSS } = require('../lib/webStyles');
    const { colors } = require('../lib/theme');
    expect(WEB_CSS).toContain('scrollbar-width: thin');
    expect(WEB_CSS).toContain(`scrollbar-color: ${colors.light.border} transparent`);
    expect(WEB_CSS).toMatch(/prefers-color-scheme: dark/);
    expect(WEB_CSS).toContain(`scrollbar-color: ${colors.dark.border} transparent`);
    expect(WEB_CSS).toContain('color-scheme: dark');
  });

  it('área marcada com data-no-select: segurar não seleciona texto nem abre o menu de copiar/salvar', () => {
    const { WEB_CSS } = require('../lib/webStyles');
    expect(WEB_CSS).toContain('[data-no-select], [data-no-select] *');
    expect(WEB_CSS).toContain('user-select: none');
    expect(WEB_CSS).toContain('-webkit-touch-callout: none');
  });
});
