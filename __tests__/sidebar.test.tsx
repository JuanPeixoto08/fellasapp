import { fireEvent, render, screen } from '@testing-library/react-native';

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
    await render(<Sidebar tier="expanded" onCompose={() => {}} />);
    expect(screen.getByText('Feed')).toBeTruthy();
    expect(screen.getByLabelText('Membros').props.accessibilityState).toMatchObject({ selected: true });
    expect(screen.getByLabelText('Feed').props.accessibilityState).toMatchObject({ selected: false });
    await fireEvent.press(screen.getByLabelText('Perfil'));
    expect(mockNavigate).toHaveBeenCalledWith('/profile');
    expect(screen.getByText('@juanzin')).toBeTruthy();
  });

  it('medium: só ícones (sem nomes) e Postar redondo', async () => {
    const onCompose = jest.fn();
    await render(<Sidebar tier="medium" onCompose={onCompose} />);
    expect(screen.queryByText('Feed')).toBeNull();
    expect(screen.queryByText('@juanzin')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(onCompose).toHaveBeenCalled();
  });

  it('logo leva ao feed', async () => {
    await render(<Sidebar tier="expanded" onCompose={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Ir para o feed'));
    expect(mockNavigate).toHaveBeenCalledWith('/feed');
  });
});
