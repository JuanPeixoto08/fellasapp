import { getTabBarStyle } from '../lib/tabBarStyle';
import { getTheme } from '../lib/theme';

const t = getTheme('light');
const base = 1 + t.spacing.xs + t.layout.minTouch + t.typography.caption.lineHeight;

describe('getTabBarStyle', () => {
  it('soma insets.bottom uma única vez na altura', () => {
    const s = getTabBarStyle(t, { bottom: 34, left: 0, right: 0 });
    expect(s.paddingBottom).toBe(34);
    expect(s.height).toBe(base + 34);
  });

  it('sem inset usa spacing.xs como paddingBottom', () => {
    const s = getTabBarStyle(t, { bottom: 0, left: 0, right: 0 });
    expect(s.paddingBottom).toBe(t.spacing.xs);
    expect(s.height).toBe(base + t.spacing.xs);
  });

  it('usa insets laterais', () => {
    const s = getTabBarStyle(t, { bottom: 0, left: 10, right: 20 });
    expect(s.paddingLeft).toBe(10);
    expect(s.paddingRight).toBe(20);
  });
});
