import { fireEvent, render, screen } from '@testing-library/react-native';

import type { ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

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

const Wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{ frame: { x: 0, y: 0, width: 1024, height: 768 }, insets: { top: 24, left: 0, right: 0, bottom: 20 } }}
  >
    {children}
  </SafeAreaProvider>
);

beforeEach(() => {
  mockPush.mockClear();
  mockReload.mockClear();
  mockState = { members: [], avatars: new Map(), loading: false, error: null, reload: mockReload };
});

describe('RightRail', () => {
  it('lista até 8 fellas, abre perfil (o meu vai para /profile) e tem "Ver todos"', async () => {
    mockState.members = [member('me', 'Juan'), ...Array.from({ length: 9 }, (_, i) => member(`u${i}`, `Fella${i}`))];
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.getAllByLabelText(/^Ver perfil de /)).toHaveLength(8);
    await fireEvent.press(screen.getByLabelText('Ver perfil de Juan'));
    expect(mockPush).toHaveBeenLastCalledWith('/profile');
    await fireEvent.press(screen.getByLabelText('Ver perfil de Fella0'));
    expect(mockPush).toHaveBeenLastCalledWith('/user/u0');
    await fireEvent.press(screen.getByLabelText('Ver todos os membros'));
    expect(mockPush).toHaveBeenLastCalledWith('/members');
  });

  it('selo de verificado ao lado do nome de quem tem', async () => {
    mockState.members = [{ ...member('me', 'Juan'), badges: ['verified'] }, member('b', 'Bia')];
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.getAllByLabelText('Verificado')).toHaveLength(1);
  });

  it('mostra próximos aniversários ou o convite quando ninguém preencheu', async () => {
    mockState.members = [member('a', 'Bia')];
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.getByText(/Ninguém pôs o aniversário ainda/)).toBeTruthy();
  });

  it('com aniversário preenchido mostra o nome e a data', async () => {
    const d = new Date();
    const iso = `2000-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    mockState.members = [member('a', 'Bia', iso)];
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.getByLabelText('Aniversário de Bia: Hoje')).toBeTruthy();
  });

  it('mais de 3 aniversários: mostra os 3 próximos e "Ver todos" abre a lista inteira', async () => {
    const iso = (daysAhead: number) => {
      const d = new Date();
      d.setDate(d.getDate() + daysAhead);
      return `2000-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    };
    mockState.members = ['Ana', 'Bia', 'Caio', 'Duda', 'Edu'].map((name, i) => member(`u${i}`, name, iso(i * 10)));
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.getAllByLabelText(/^Aniversário de /)).toHaveLength(3);
    expect(screen.queryByLabelText(/^Aniversário de Edu/)).toBeNull();
    await fireEvent.press(screen.getByLabelText('Ver todos os aniversários'));
    expect(screen.getAllByLabelText(/^Aniversário de /)).toHaveLength(5);
    expect(screen.getByLabelText(/^Aniversário de Edu/)).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver menos aniversários'));
    expect(screen.getAllByLabelText(/^Aniversário de /)).toHaveLength(3);
  });

  it('até 3 aniversários: sem "Ver todos"', async () => {
    const d = new Date();
    const iso = `2000-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    mockState.members = [member('a', 'Bia', iso), member('b', 'Caio', iso)];
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.queryByLabelText('Ver todos os aniversários')).toBeNull();
  });

  it('respeita a área segura do iPad no topo e no pé', async () => {
    await render(<RightRail />, { wrapper: Wrapper });
    const style = StyleSheet.flatten(screen.getByTestId('right-rail').props.contentContainerStyle);
    expect(style).toMatchObject({ paddingTop: 24 + 16, paddingBottom: 20 + 16 });
  });

  it('erro: avisa e deixa tentar de novo', async () => {
    mockState.error = 'x';
    await render(<RightRail />, { wrapper: Wrapper });
    expect(screen.getByText('Não deu pra carregar os fellas.')).toBeTruthy();
    await fireEvent.press(screen.getByText('Tentar de novo'));
    expect(mockReload).toHaveBeenCalled();
  });
});
