import { tierForWidth } from '../lib/layout';
import { layout } from '../lib/theme';

describe('tierForWidth', () => {
  it.each([
    [320, 'compact'],
    [699, 'compact'],
    [700, 'medium'],
    [1099, 'medium'],
    [1100, 'expanded'],
    [2560, 'expanded'],
  ] as const)('%i px → %s', (width, tier) => {
    expect(tierForWidth(width)).toBe(tier);
  });

  it('usa os tokens do tema', () => {
    expect(layout.breakpoints).toEqual({ medium: 700, expanded: 1100 });
    expect(layout.centerWidth).toBe(600);
    expect(layout.sidebarWidth).toEqual({ medium: 72, expanded: 260 });
    expect(layout.railWidth).toBe(350);
  });
});
