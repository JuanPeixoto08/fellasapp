import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import type { Idea } from '../lib/ideas';

jest.mock('expo-router', () => ({ Stack: { Screen: () => null } }));
let mockProfile = { is_member: true, is_admin: false };
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, profile: mockProfile }),
}));

const mockHook = {
  sort: 'top' as const,
  setSort: jest.fn(),
  ideas: [] as Idea[],
  loading: false,
  error: null as string | null,
  notice: null as string | null,
  reload: jest.fn(),
  vote: jest.fn(),
  create: jest.fn(),
  remove: jest.fn(),
};
jest.mock('../lib/useIdeas', () => ({ useIdeas: () => mockHook }));

import IdeasScreen from '../app/ideas';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <IdeasScreen />
    </SafeAreaProvider>,
  );
const idea = (over: Partial<Idea>): Idea => ({
  id: 'i1',
  body: 'Modo escuro',
  createdAt: new Date().toISOString(),
  author: { id: 'u2', name: 'Bia', avatarUrl: null },
  score: 2,
  myVote: null,
  ...over,
});

beforeEach(() => {
  jest.clearAllMocks();
  mockProfile = { is_member: true, is_admin: false };
  Object.assign(mockHook, { ideas: [], loading: false, error: null, notice: null, sort: 'top' });
  mockHook.create.mockResolvedValue(undefined);
  mockHook.remove.mockResolvedValue(undefined);
});

describe('Tela Ideias', () => {
  it('vazio convida a mandar a primeira', async () => {
    await open();
    expect(screen.getByText('Ninguém deu ideia ainda.')).toBeTruthy();
  });

  it('mandar fica desabilitado vazio; mandar limpa o campo', async () => {
    await open();
    expect(screen.getByRole('button', { name: 'Mandar' }).props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('Manda sua ideia'), 'bora ter enquete');
    await fireEvent.press(screen.getByRole('button', { name: 'Mandar' }));
    expect(mockHook.create).toHaveBeenCalledWith('bora ter enquete');
    await waitFor(() => expect(screen.getByLabelText('Manda sua ideia').props.value).toBe(''));
  });

  it('erro ao mandar fica no campo e o texto fica', async () => {
    mockHook.create.mockRejectedValue(new Error('boom'));
    await open();
    await fireEvent.changeText(screen.getByLabelText('Manda sua ideia'), 'bora');
    await fireEvent.press(screen.getByRole('button', { name: 'Mandar' }));
    expect(await screen.findByText('Não deu pra mandar a ideia. Tenta de novo.')).toBeTruthy();
    expect(screen.getByLabelText('Manda sua ideia').props.value).toBe('bora');
  });

  it('abas Top/Novas', async () => {
    await open();
    await fireEvent.press(screen.getByRole('tab', { name: 'Novas' }));
    expect(mockHook.setSort).toHaveBeenCalledWith('new');
  });

  it('votar chama o hook; lixeira só na minha (não admin)', async () => {
    mockHook.ideas = [idea({ id: 'minha', author: { id: 'me', name: 'Eu', avatarUrl: null } }), idea({ id: 'dela' })];
    await open();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Votar a favor' })[1]);
    expect(mockHook.vote).toHaveBeenCalledWith('dela', 1);
    expect(screen.getAllByRole('button', { name: 'Apagar ideia' })).toHaveLength(1);
  });

  it('admin vê lixeira em todas e apaga confirmando', async () => {
    mockProfile = { is_member: true, is_admin: true };
    mockHook.ideas = [idea({ id: 'a' }), idea({ id: 'b' })];
    await open();
    const trash = screen.getAllByRole('button', { name: 'Apagar ideia' });
    expect(trash).toHaveLength(2);
    await fireEvent.press(trash[0]);
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar' }));
    await waitFor(() => expect(mockHook.remove).toHaveBeenCalledWith('a'));
  });

  it('apagar que falha mostra o erro dentro do diálogo e a ideia fica', async () => {
    mockProfile = { is_member: true, is_admin: true };
    mockHook.ideas = [idea({ id: 'a', body: 'Enquete' })];
    mockHook.remove.mockRejectedValue(new Error('não é sua'));
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar ideia' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Apagar' }));
    expect(await screen.findByText('Não deu pra apagar a ideia. Tenta de novo.')).toBeTruthy();
    expect(screen.getByText('Enquete')).toBeTruthy();
  });

  it('voto recusado aparece como aviso', async () => {
    mockHook.notice = 'Não deu pra votar. Tenta de novo.';
    await open();
    expect(screen.getByText('Não deu pra votar. Tenta de novo.')).toBeTruthy();
  });

  it('erro ao carregar oferece tentar de novo', async () => {
    mockHook.error = 'Pode ter sido a conexão. Tenta de novo daqui a pouco.';
    await open();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(mockHook.reload).toHaveBeenCalled();
  });
});
