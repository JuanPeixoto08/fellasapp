import { AUTOSCROLL_DEAD_ZONE, autoScrollSpeed, movedPastDeadZone } from '../components/shell/autoScroll';

describe('autoScrollSpeed', () => {
  it('perto do ícone não rola', () => {
    expect(autoScrollSpeed(0)).toBe(0);
    expect(autoScrollSpeed(AUTOSCROLL_DEAD_ZONE)).toBe(0);
    expect(autoScrollSpeed(-AUTOSCROLL_DEAD_ZONE)).toBe(0);
  });

  it('abaixo do ícone desce, acima sobe', () => {
    expect(autoScrollSpeed(100)).toBeGreaterThan(0);
    expect(autoScrollSpeed(-100)).toBeLessThan(0);
    expect(autoScrollSpeed(-100)).toBe(-autoScrollSpeed(100));
  });

  it('mais longe do ícone, mais rápido', () => {
    expect(autoScrollSpeed(300)).toBeGreaterThan(autoScrollSpeed(100));
  });
});

describe('movedPastDeadZone', () => {
  it('soltar o botão sem mexer: continua rolando até o próximo clique', () => {
    expect(movedPastDeadZone(3, -4)).toBe(false);
  });

  it('arrastou com o botão apertado: soltar para', () => {
    expect(movedPastDeadZone(0, AUTOSCROLL_DEAD_ZONE + 1)).toBe(true);
  });
});
