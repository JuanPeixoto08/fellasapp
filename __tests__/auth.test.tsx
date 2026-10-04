import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

const mockReplace = jest.fn();
let mockSegments: string[] = [];
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => mockSegments,
}));

const mockAuth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signOut: jest.fn(),
};
const mockMaybeSingle = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: mockMaybeSingle }) }) }),
  },
}));

import LoginScreen from '../app/(auth)/login';
import NotInvitedScreen from '../app/not-invited';
import { AuthGuard } from '../lib/auth/AuthGuard';
import { SessionProvider } from '../lib/auth/SessionProvider';

// já criou senha: o guard não segura em /set-password
const session = { user: { id: 'u1', user_metadata: { has_password: true } } };

function setup(sess: unknown, profile: unknown) {
  mockAuth.getSession.mockResolvedValue({ data: { session: sess } });
  mockMaybeSingle.mockResolvedValue({ data: profile, error: null });
}

function renderGuard() {
  return render(
    <SessionProvider>
      <AuthGuard>
        <Text>conteudo</Text>
      </AuthGuard>
    </SessionProvider>,
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  mockSegments = [];
  mockAuth.onAuthStateChange.mockReturnValue({ data: { subscription: { unsubscribe: jest.fn() } } });
});

describe('LoginScreen', () => {
  it('envia o OTP e vai para o passo do código', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Primeiro acesso? Receber código'));
    await fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'Ana@Email.com');
    await fireEvent.press(screen.getByText('Enviar código'));
    await waitFor(() =>
      expect(mockAuth.signInWithOtp).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'ana@email.com' }),
      ),
    );
    expect(await screen.findByPlaceholderText('000000')).toBeTruthy();
  });

  it('verifica o código com verifyOtp', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockAuth.verifyOtp.mockResolvedValue({ data: { session }, error: null });
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Primeiro acesso? Receber código'));
    await fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'ana@email.com');
    await fireEvent.press(screen.getByText('Enviar código'));
    await await fireEvent.changeText(await screen.findByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByText('Entrar'));
    await waitFor(() =>
      expect(mockAuth.verifyOtp).toHaveBeenCalledWith({
        email: 'ana@email.com',
        token: '123456',
        type: 'email',
      }),
    );
  });

  it('mostra erro em PT-BR quando o código é inválido', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockAuth.verifyOtp.mockResolvedValue({ data: {}, error: new Error('Token has expired or is invalid') });
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Primeiro acesso? Receber código'));
    await fireEvent.changeText(screen.getByPlaceholderText('seu@email.com'), 'ana@email.com');
    await fireEvent.press(screen.getByText('Enviar código'));
    await await fireEvent.changeText(await screen.findByPlaceholderText('000000'), '123456');
    await fireEvent.press(screen.getByText('Entrar'));
    expect(await screen.findByText(/Código inválido ou expirado/)).toBeTruthy();
  });
});

describe('AuthGuard', () => {
  it('sem sessão redireciona para o login', async () => {
    setup(null, null);
    await renderGuard();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/login'));
  });

  it('com sessão e is_member=false redireciona para not-invited', async () => {
    setup(session, { id: 'u1', is_member: false });
    await renderGuard();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/not-invited'));
  });

  it('membro fora das tabs vai para o feed', async () => {
    mockSegments = ['(auth)'];
    setup(session, { id: 'u1', is_member: true });
    await renderGuard();
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/feed'));
  });

  it('membro nas tabs não é redirecionado', async () => {
    mockSegments = ['(tabs)'];
    setup(session, { id: 'u1', is_member: true });
    await renderGuard();
    await waitFor(() => expect(mockMaybeSingle).toHaveBeenCalled());
    await screen.findByText('conteudo');
    expect(mockReplace).not.toHaveBeenCalled();
  });
});

describe('NotInvitedScreen', () => {
  it('botão sair chama signOut', async () => {
    setup(session, { id: 'u1', is_member: false });
    mockAuth.signOut.mockResolvedValue({ error: null });
    await render(
      <SessionProvider>
        <NotInvitedScreen />
      </SessionProvider>,
    );
    expect(screen.getByText('Você ainda não foi convidado')).toBeTruthy();
    await fireEvent.press(screen.getByText('Sair'));
    await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalled());
  });
});
