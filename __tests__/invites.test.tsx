import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Share } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockRpc = jest.fn();
let mockLinkRows: unknown[] = [];
const mockSignInWithOtp = jest.fn();
const mockVerifyOtp = jest.fn();
jest.mock('../lib/supabase', () => ({
  supabase: {
    rpc: (...args: unknown[]) => mockRpc(...args),
    from: (table: string) => ({
      select: () => ({
        order: () => ({
          limit: () => Promise.resolve({ data: table === 'invite_links' ? mockLinkRows : [], error: null }),
        }),
      }),
    }),
    auth: {
      signInWithOtp: (...args: unknown[]) => mockSignInWithOtp(...args),
      verifyOtp: (...args: unknown[]) => mockVerifyOtp(...args),
    },
  },
}));

const mockPush = jest.fn();
const mockReplace = jest.fn();
let mockToken = 'tok123';
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
  useLocalSearchParams: () => ({ token: mockToken }),
  Stack: { Screen: () => null },
}));

let mockProfile: { is_member: boolean; is_admin: boolean } | null = { is_member: true, is_admin: true };
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'admin-id' } }, profile: mockProfile }),
}));
jest.mock('../components/ProfileView', () => {
  const { View } = require('react-native');
  return { __esModule: true, default: ({ actions }: { actions: unknown }) => <View>{actions as never}</View> };
});

import InvitesScreen from '../app/invites';
import InviteLandingScreen from '../app/(auth)/convite/[token]';
import ProfileScreen from '../app/(tabs)/profile';
import {
  createInviteLink,
  inviteErrorMessage,
  inviteStatus,
  inviteUrl,
  listInviteLinks,
  redeemInvite,
  WEB_URL,
} from '../lib/api/invites';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const wrap = (el: React.ReactElement) => <SafeAreaProvider initialMetrics={metrics}>{el}</SafeAreaProvider>;

const NOW = new Date('2026-10-05T12:00:00Z');
const row = (over: Record<string, unknown>) => ({
  token: 'aaa',
  created_at: '2026-10-05T10:00:00Z',
  expires_at: '2026-10-12T10:00:00Z',
  used_at: null,
  used_email: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { is_member: true, is_admin: true };
  mockToken = 'tok123';
  mockLinkRows = [];
  mockRpc.mockResolvedValue({ data: null, error: null });
  mockSignInWithOtp.mockResolvedValue({ error: null });
  mockVerifyOtp.mockResolvedValue({ data: { session: {} }, error: null });
});

describe('api de convites', () => {
  it('monta o link no site', () => {
    expect(inviteUrl('abc')).toBe(`${WEB_URL}/convite/abc`);
  });

  it('gera o link pelo banco', async () => {
    mockRpc.mockResolvedValue({ data: 'abc', error: null });
    await expect(createInviteLink()).resolves.toBe('abc');
    expect(mockRpc).toHaveBeenCalledWith('create_invite_link');
  });

  it('lista os links no formato do app', async () => {
    mockLinkRows = [row({ used_at: '2026-10-05T11:00:00Z', used_email: 'bia@gmail.com' })];
    await expect(listInviteLinks()).resolves.toEqual([
      {
        token: 'aaa',
        createdAt: '2026-10-05T10:00:00Z',
        expiresAt: '2026-10-12T10:00:00Z',
        usedAt: '2026-10-05T11:00:00Z',
        usedEmail: 'bia@gmail.com',
      },
    ]);
  });

  it('status: usado, aberto ou vencido', () => {
    const base = { token: 'a', createdAt: '', expiresAt: '2026-10-12T10:00:00Z', usedAt: null, usedEmail: null };
    expect(inviteStatus(base, NOW)).toBe('open');
    expect(inviteStatus({ ...base, expiresAt: '2026-10-01T10:00:00Z' }, NOW)).toBe('expired');
    expect(inviteStatus({ ...base, usedAt: '2026-10-05T11:00:00Z', usedEmail: 'bia@gmail.com' }, NOW)).toBe('used');
  });

  it('resgata com o email normalizado; email inválido nem chega no banco', async () => {
    await expect(redeemInvite('tok', ' Bia@Gmail.com ')).resolves.toBe('bia@gmail.com');
    expect(mockRpc).toHaveBeenCalledWith('redeem_invite', { p_token: 'tok', p_email: 'bia@gmail.com' });
    mockRpc.mockClear();
    const error = await redeemInvite('tok', 'bia@').catch((e: unknown) => e);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(inviteErrorMessage(error)).toMatch(/não parece um email/);
  });

  it('traduz os erros do banco', () => {
    expect(inviteErrorMessage({ message: 'invite_used' })).toMatch(/já foi usado/);
    expect(inviteErrorMessage({ message: 'invite_expired' })).toMatch(/venceu/);
    expect(inviteErrorMessage({ message: 'invite_not_found' })).toMatch(/não existe/);
    expect(inviteErrorMessage({ message: 'not_admin', code: '42501' })).toMatch(/Só o admin/);
    expect(inviteErrorMessage(new TypeError('Network request failed'))).toMatch(/Sem conexão/);
  });
});

describe('Tela Convidar (admin)', () => {
  it('gera o link e compartilha', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: 'sharedAction' });
    mockRpc.mockResolvedValue({ data: 'novo123', error: null });
    await render(wrap(<InvitesScreen />));
    await fireEvent.press(screen.getByRole('button', { name: 'Gerar link de convite' }));
    expect(await screen.findByText(`${WEB_URL}/convite/novo123`)).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Compartilhar link' }));
    expect(share).toHaveBeenCalledWith({ message: expect.stringContaining(`${WEB_URL}/convite/novo123`) });
  });

  it('lista quem usou, o que está aberto e o que venceu', async () => {
    mockLinkRows = [
      row({ token: 'a', used_at: '2026-10-05T11:00:00Z', used_email: 'bia@gmail.com' }),
      row({ token: 'b', expires_at: '2099-10-12T10:00:00Z' }),
      row({ token: 'c', expires_at: '2020-01-01T10:00:00Z' }),
    ];
    await render(wrap(<InvitesScreen />));
    expect(await screen.findByLabelText(/Usado por bia@gmail.com/)).toBeTruthy();
    expect(screen.getByLabelText(/Link ainda não usado/)).toBeTruthy();
    expect(screen.getByLabelText(/Link vencido/)).toBeTruthy();
  });

  it('quem não é admin não gera', async () => {
    mockProfile = { is_member: true, is_admin: false };
    await render(wrap(<InvitesScreen />));
    expect(screen.getByText(/Só o admin convida/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Gerar link de convite' })).toBeNull();
  });
});

describe('Tela do convite (quem recebeu o link)', () => {
  it('email → código → entra (o guard leva pra criar senha)', async () => {
    await render(wrap(<InviteLandingScreen />));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'Bia@Gmail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Receber código' }));
    expect(await screen.findByLabelText('Código de 6 dígitos')).toBeTruthy();
    expect(mockRpc).toHaveBeenCalledWith('redeem_invite', { p_token: 'tok123', p_email: 'bia@gmail.com' });
    expect(mockSignInWithOtp).toHaveBeenCalledWith({ email: 'bia@gmail.com', options: { shouldCreateUser: true } });

    await fireEvent.changeText(screen.getByLabelText('Código de 6 dígitos'), '123456');
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }));
    await waitFor(() =>
      expect(mockVerifyOtp).toHaveBeenCalledWith({ email: 'bia@gmail.com', token: '123456', type: 'email' }),
    );
  });

  it('convite já usado: avisa e não manda código', async () => {
    mockRpc.mockResolvedValue({ data: null, error: { message: 'invite_used' } });
    await render(wrap(<InviteLandingScreen />));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'bia@gmail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Receber código' }));
    expect(await screen.findByText(/já foi usado/)).toBeTruthy();
    expect(mockSignInWithOtp).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Já tenho conta: entrar' }));
    expect(mockReplace).toHaveBeenCalledWith('/login');
  });

  it('pode mandar o código de novo', async () => {
    await render(wrap(<InviteLandingScreen />));
    await fireEvent.changeText(screen.getByLabelText('Email'), 'bia@gmail.com');
    await fireEvent.press(screen.getByRole('button', { name: 'Receber código' }));
    await screen.findByLabelText('Código de 6 dígitos');
    await fireEvent.press(screen.getByRole('button', { name: 'Mandar o código de novo' }));
    await waitFor(() => expect(mockSignInWithOtp).toHaveBeenCalledTimes(2));
  });
});

describe('Atalho no perfil', () => {
  it('admin vê o botão de convidar', async () => {
    await render(<ProfileScreen />);
    await fireEvent.press(screen.getByLabelText('Convidar'));
    expect(mockPush).toHaveBeenCalledWith('/invites');
  });

  it('membro comum não vê', async () => {
    mockProfile = { is_member: true, is_admin: false };
    await render(<ProfileScreen />);
    expect(screen.queryByLabelText('Convidar')).toBeNull();
  });
});
