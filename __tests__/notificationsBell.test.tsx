import { fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
let mockCount = 0;
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }));
jest.mock('../lib/notificationsStore', () => ({ useUnreadNotifications: () => mockCount }));

import { NotificationsBell } from '../components/notifications/NotificationsBell';

beforeEach(() => {
  jest.clearAllMocks();
  mockCount = 0;
});

describe('NotificationsBell', () => {
  it('sem novas: só o sino, abre a tela', async () => {
    await render(<NotificationsBell />);
    expect(screen.queryByTestId('badge', { includeHiddenElements: true })).toBeNull();
    await fireEvent.press(screen.getByLabelText('Notificações'));
    expect(mockPush).toHaveBeenCalledWith('/notifications');
  });

  it('com novas: bolinha e rótulo com o número', async () => {
    mockCount = 3;
    await render(<NotificationsBell />);
    expect(screen.getByText('3', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByLabelText('Notificações, 3 novas')).toBeTruthy();
  });
});
