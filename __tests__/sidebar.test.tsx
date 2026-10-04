import { fireEvent, render, screen } from '@testing-library/react-native';

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
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ profile: { username: 'juanzin' } }),
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
  ] as const)('%s → %s', (path, key) => {
    expect(activeNavItem(path)).toBe(key);
  });
});

describe('Sidebar', () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockPath = '/feed';
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

  it('logo leva ao feed', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByLabelText('Ir para o feed'));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });
});
