import { render, screen } from '@testing-library/react-native';

let mockCount = 0;
jest.mock('../lib/notificationsStore', () => ({ useUnreadNotifications: () => mockCount }));
jest.mock('expo-router', () => ({ Tabs: Object.assign(() => null, { Screen: () => null }) }));

import { NotificationsTabIcon } from '../app/(tabs)/_layout';
import { getTabBarStyle } from '../lib/tabBarStyle';
import { getTheme } from '../lib/theme';

const t = getTheme('light');
const base = 1 + t.spacing.xs + t.layout.minTouch;

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

describe('NotificationsTabIcon', () => {
  it('sem novas: só o sino; com novas, a bolinha com o número', async () => {
    mockCount = 0;
    const { rerender } = await render(<NotificationsTabIcon color="#000" size={24} focused={false} />);
    expect(screen.queryByTestId('badge', { includeHiddenElements: true })).toBeNull();
    mockCount = 3;
    await rerender(<NotificationsTabIcon color="#000" size={24} focused={false} />);
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
  });
});
