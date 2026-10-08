import { fireEvent, render, screen, within } from '@testing-library/react-native';

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { activeNavItem, Sidebar } from '../components/shell/Sidebar';

const mockNavigate = jest.fn();
let mockPath = '/feed';
jest.mock('expo-router', () => ({
  useRouter: () => ({ navigate: mockNavigate, push: jest.fn() }),
  usePathname: () => mockPath,
}));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan Peixoto', uri: null }) }));
let mockUnread = 0;
jest.mock('../lib/notificationsStore', () => ({ useUnreadNotifications: () => mockUnread }));
let mockProfile: Record<string, unknown> = { username: 'juanzin' };
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ profile: mockProfile }),
}));

const Wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{ frame: { x: 0, y: 0, width: 1024, height: 768 }, insets: { top: 24, left: 0, right: 0, bottom: 20 } }}
  >
    {children}
  </SafeAreaProvider>
);

describe('activeNavItem', () => {
  it.each([
    ['/', 'feed'],
    ['/feed', 'feed'],
    ['/profile', 'profile'],
    ['/members', 'members'],
    ['/profile/edit', null],
    ['/user/abc', null],
    ['/post/123', null],
    ['/new', null],
    ['/notifications', 'notifications'],
    ['/ideas', 'ideas'],
    ['/tags', 'tags'],
  ] as const)('%s → %s', (path, key) => {
    expect(activeNavItem(path)).toBe(key);
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPath = '/feed';
    mockUnread = 0;
    mockProfile = { username: 'juanzin' };
  });

  it('expanded: nomes visíveis, item ativo marcado, navega', async () => {
    mockPath = '/members';
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    expect(screen.getByText('Feed')).toBeTruthy();
    expect(screen.getByLabelText('Membros').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Feed').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByLabelText('Perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
    expect(screen.getByText('@juanzin')).toBeTruthy();
  });

  it('Notificações entre Feed e Perfil, com bolinha e rótulo', async () => {
    mockUnread = 2;
    mockPath = '/notifications';
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    const item = screen.getByLabelText('Notificações, 2 novas');
    expect(item.props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByText('2', { includeHiddenElements: true })).toBeTruthy();
    const labels = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
    expect(labels.indexOf('Notificações, 2 novas')).toBe(labels.indexOf('Feed') + 1);
    await fireEvent.press(item);
    expect(mockNavigate).toHaveBeenCalledWith('/notifications');
  });

  it('Tags logo abaixo de Notificações e navega', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    const labels = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
    expect(labels.indexOf('Tags')).toBe(labels.indexOf('Notificações') + 1);
    await fireEvent.press(screen.getByLabelText('Tags'));
    expect(mockNavigate).toHaveBeenCalledWith('/tags');
  });

  it('Ideias depois de Membros e navega', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    const labels = screen.getAllByRole('link').map((el) => el.props.accessibilityLabel);
    expect(labels.indexOf('Ideias')).toBe(labels.indexOf('Membros') + 1);
    await fireEvent.press(screen.getByLabelText('Ideias'));
    expect(mockNavigate).toHaveBeenCalledWith('/ideas');
  });

  it('medium: só ícones (sem nomes) e Postar redondo', async () => {
    const onCompose = jest.fn();
    await render(<Sidebar tier="medium" onCompose={onCompose} />, { wrapper: Wrapper });
    expect(screen.queryByText('Feed')).toBeNull();
    expect(screen.queryByText('@juanzin')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(onCompose).toHaveBeenCalled();
  });

  it('respeita a área segura do iPad (barra de status em cima, indicador de home embaixo)', async () => {
    await render(<Sidebar tier="medium" onCompose={() => {}} />, { wrapper: Wrapper });
    const style = StyleSheet.flatten(screen.getByLabelText('Navegação').props.style);
    expect(style).toMatchObject({ paddingTop: 24 + 16, paddingBottom: 20 + 16 });
  });

  it('eu no pé: o meu selo do lado do nome', async () => {
    mockProfile = { username: 'oliveira', badges: ['verified'], featured_badge: 'verified' };
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    expect(within(screen.getByLabelText('Meu perfil')).getByLabelText('Verificado')).toBeTruthy();
  });

  it('eu no pé: sem selo, só o nome', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    expect(screen.queryByLabelText('Verificado')).toBeNull();
  });

  it('logo leva ao feed', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByLabelText('Ir para o feed'));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });
});
