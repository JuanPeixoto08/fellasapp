import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockReplace = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSegments: () => [],
}));

const mockAuth = {
  signInWithOtp: jest.fn(),
  verifyOtp: jest.fn(),
  signInWithPassword: jest.fn(),
  updateUser: jest.fn(),
  getSession: jest.fn(),
  onAuthStateChange: jest.fn(),
  signOut: jest.fn(),
};
jest.mock('../lib/supabase', () => ({
  supabase: {
    get auth() {
      return mockAuth;
    },
  },
}));

import LoginScreen from '../app/(auth)/login';
import SetPasswordScreen from '../app/set-password';
import { resolveGuardTarget } from '../lib/auth/AuthGuard';
import { clearPasswordReset, isPasswordResetPending, markPasswordReset } from '../lib/auth/passwordReset';
import { hasPassword } from '../lib/api/auth';

const session = { user: { id: 'u1', user_metadata: {} } };

beforeEach(() => {
  jest.clearAllMocks();
  clearPasswordReset();
});

describe('login com senha', () => {
  it('por padrão pede email e senha e entra com signInWithPassword', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: { session }, error: null });
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'Ana@Email.com ');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo123');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    await waitFor(() =>
      expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({ email: 'ana@email.com', password: 'segredo123' }),
    );
  });

  it('senha errada mostra mensagem em pt-BR que aponta o "Esqueci a senha"', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({ data: {}, error: new Error('Invalid login credentials') });
    await render(<LoginScreen />);
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@email.com');
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'errada123');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    expect(await screen.findByText(/Email ou senha errados/)).toBeTruthy();
  });

  it('"Primeiro acesso" manda o código podendo criar a conta', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Primeiro acesso? Receber código'));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@email.com');
    await fireEvent.press(screen.getByText('Enviar código'));
    await waitFor(() =>
      expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'ana@email.com', options: { shouldCreateUser: true } }),
    );
    expect(await screen.findByLabelText('Código de 6 dígitos')).toBeTruthy();
    expect(isPasswordResetPending()).toBe(false);
  });

  it('"Esqueci a senha" não cria conta e, com o código certo, marca a redefinição', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockAuth.verifyOtp.mockResolvedValue({ data: { session }, error: null });
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Esqueci a senha'));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@email.com');
    await fireEvent.press(screen.getByText('Enviar código'));
    await waitFor(() =>
      expect(mockAuth.signInWithOtp).toHaveBeenCalledWith({ email: 'ana@email.com', options: { shouldCreateUser: false } }),
    );
    await fireEvent.changeText(await screen.findByLabelText('Código de 6 dígitos'), '123456');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    await waitFor(() => expect(mockAuth.verifyOtp).toHaveBeenCalled());
    expect(isPasswordResetPending()).toBe(true);
  });

  it('código errado no "Esqueci a senha" não deixa a redefinição marcada', async () => {
    mockAuth.signInWithOtp.mockResolvedValue({ error: null });
    mockAuth.verifyOtp.mockResolvedValue({ data: {}, error: new Error('Token has expired or is invalid') });
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText('Esqueci a senha'));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'ana@email.com');
    await fireEvent.press(screen.getByText('Enviar código'));
    await fireEvent.changeText(await screen.findByLabelText('Código de 6 dígitos'), '123456');
    await fireEvent.press(screen.getByLabelText('Entrar'));
    expect(await screen.findByText(/Código inválido ou expirado/)).toBeTruthy();
    expect(isPasswordResetPending()).toBe(false);
  });
});

describe('Crie sua senha', () => {
  it('exige 8 caracteres e as duas senhas iguais', async () => {
    await render(<SetPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'curta');
    await fireEvent.changeText(screen.getByLabelText('Confirma a senha'), 'curta');
    await fireEvent.press(screen.getByLabelText('Salvar senha'));
    expect(screen.getByText('A senha precisa ter pelo menos 8 caracteres.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo123');
    await fireEvent.changeText(screen.getByLabelText('Confirma a senha'), 'segredo124');
    await fireEvent.press(screen.getByLabelText('Salvar senha'));
    expect(screen.getByText('As senhas não batem.')).toBeTruthy();
    expect(mockAuth.updateUser).not.toHaveBeenCalled();
  });

  it('salva a senha marcando a conta e encerra a redefinição', async () => {
    mockAuth.updateUser.mockResolvedValue({ data: { user: {} }, error: null });
    await render(<SetPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo123');
    await fireEvent.changeText(screen.getByLabelText('Confirma a senha'), 'segredo123');
    await fireEvent.press(screen.getByLabelText('Salvar senha'));
    await waitFor(() =>
      expect(mockAuth.updateUser).toHaveBeenCalledWith({ password: 'segredo123', data: { has_password: true } }),
    );
    await waitFor(() => expect(mockReplace).toHaveBeenCalledWith('/feed'));
    expect(isPasswordResetPending()).toBe(false);
  });

  it('mesma senha de antes vira mensagem em pt-BR', async () => {
    mockAuth.updateUser.mockResolvedValue({
      data: {},
      error: new Error('New password should be different from the old password.'),
    });
    await render(<SetPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText('Senha'), 'segredo123');
    await fireEvent.changeText(screen.getByLabelText('Confirma a senha'), 'segredo123');
    await fireEvent.press(screen.getByLabelText('Salvar senha'));
    expect(await screen.findByText('Essa já é a sua senha. Escolhe uma diferente.')).toBeTruthy();
  });
  it('Sair encerra a sessão e cancela a redefinição', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });
    markPasswordReset();
    await render(<SetPasswordScreen />);
    expect(screen.getByText('Senha nova')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Sair'));
    await waitFor(() => expect(mockAuth.signOut).toHaveBeenCalled());
    expect(isPasswordResetPending()).toBe(false);
  });
});

describe('guarda: senha obrigatória', () => {
  it('membro sem senha vai para /set-password de qualquer lugar', () => {
    expect(resolveGuardTarget(true, true, '(tabs)', true)).toBe('/set-password');
    expect(resolveGuardTarget(true, true, '(auth)', true)).toBe('/set-password');
    expect(resolveGuardTarget(true, true, 'set-password', true)).toBeNull();
  });

  it('membro com senha segue como antes e pode ficar em /set-password', () => {
    expect(resolveGuardTarget(true, true, '(auth)', false)).toBe('/feed');
    expect(resolveGuardTarget(true, true, '(tabs)', false)).toBeNull();
    expect(resolveGuardTarget(true, true, 'set-password', false)).toBeNull();
  });

  it('sem sessão ou sem convite: senha não importa', () => {
    expect(resolveGuardTarget(false, false, '(tabs)', true)).toBe('/login');
    expect(resolveGuardTarget(true, false, '(tabs)', true)).toBe('/not-invited');
  });

  it('hasPassword lê a marca da conta', () => {
    expect(hasPassword({ user: { user_metadata: { has_password: true } } } as never)).toBe(true);
    expect(hasPassword({ user: { user_metadata: {} } } as never)).toBe(false);
    expect(hasPassword(null)).toBe(false);
  });
});
