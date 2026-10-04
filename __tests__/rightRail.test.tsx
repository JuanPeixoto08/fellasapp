import { fireEvent, render, screen } from '@testing-library/react-native';

import { RightRail } from '../components/shell/RightRail';

const mockPush = jest.fn();
const mockReload = jest.fn();
let mockState: Record<string, unknown> = {};
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush, navigate: jest.fn() }) }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../lib/useMembers', () => ({ useMembers: () => mockState }));

const member = (id: string, name: string, birthday: string | null = null) => ({
  id,
  username: name.toLowerCase(),
  display_name: name,
  avatar_url: null,
  birthday,
});

beforeEach(() => {
  mockPush.mockClear();
  mockReload.mockClear();
  mockState = { members: [], avatars: new Map(), loading: false, error: null, reload: mockReload };
});

describe('RightRail', () => {
  it('lista até 8 fellas, abre perfil (o meu vai para /profile) e tem "Ver todos"', async () => {
    mockState.members = [member('me', 'Juan'), ...Array.from({ length: 9 }, (_, i) => member(`u${i}`, `Fella${i}`))];
    await render(<RightRail />);
    expect(screen.getAllByLabelText(/^Ver perfil de /)).toHaveLength(8);
    await fireEvent.press(screen.getByLabelText('Ver perfil de Juan'));
    expect(mockPush).toHaveBeenLastCalledWith('/profile');
    await fireEvent.press(screen.getByLabelText('Ver perfil de Fella0'));
    expect(mockPush).toHaveBeenLastCalledWith('/user/u0');
    await fireEvent.press(screen.getByLabelText('Ver todos os membros'));
    expect(mockPush).toHaveBeenLastCalledWith('/members');
  });

  it('mostra próximos aniversários ou o convite quando ninguém preencheu', async () => {
    mockState.members = [member('a', 'Bia')];
    await render(<RightRail />);
    expect(screen.getByText(/Ninguém pôs o aniversário ainda/)).toBeTruthy();
  });

  it('com aniversário preenchido mostra o nome e a data', async () => {
    const d = new Date();
    const iso = `2000-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    mockState.members = [member('a', 'Bia', iso)];
    await render(<RightRail />);
    expect(screen.getByLabelText('Aniversário de Bia: Hoje')).toBeTruthy();
  });

  it('erro: avisa e deixa tentar de novo', async () => {
    mockState.error = 'x';
    await render(<RightRail />);
    expect(screen.getByText('Não deu pra carregar os fellas.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(mockReload).toHaveBeenCalled();
  });
});
