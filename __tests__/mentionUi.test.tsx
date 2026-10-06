import { act, fireEvent, render, screen } from '@testing-library/react-native';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (href: string) => mockPush(href) } }));
const mockListMembers = jest.fn();
jest.mock('../lib/api/profiles', () => ({ listMembers: () => mockListMembers() }));
jest.mock('../lib/api/storage', () => ({
  signPaths: async (paths: (string | null)[]) => new Map(paths.filter(Boolean).map((p) => [p as string, `https://signed/${p}`])),
  resolveUrl: (p: string | null, m: Map<string, string>) => (p ? (m.get(p) ?? null) : null),
}));
let mockSession: { session: { user: { id: string } } | null; profile: { is_member: boolean } | null } = {
  session: null,
  profile: null,
};
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => mockSession }));

import { MentionSuggestions } from '../components/MentionSuggestions';
import { MentionText } from '../components/MentionText';
import { MemberDirectorySync } from '../components/realtime/MemberDirectorySync';
import { getMemberDirectory, setMemberDirectory } from '../lib/memberDirectory';
import { emitLive, LIVE_DEBOUNCE_MS } from '../lib/realtime';

const ana = { id: 'u1', username: 'ana', name: 'Ana', avatarUrl: null };
const bia = { id: 'u3', username: 'bia', name: 'Bia', avatarUrl: null };

beforeEach(() => {
  jest.clearAllMocks();
  setMemberDirectory([ana, bia]);
});

describe('MentionText', () => {
  it('@ de fella vira link para o perfil; o resto é texto', async () => {
    await render(<MentionText text="@ana parabéns! cc @fulano" />);
    expect(screen.getByText('@fulano', { exact: false })).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Ver perfil de Ana'));
    expect(mockPush).toHaveBeenCalledWith('/@ana');
  });

  it('com tags, #tag vira link para a página da tag (minúsculas, codificada)', async () => {
    await render(<MentionText text="olha #Ação e #arte" tags />);
    await fireEvent.press(screen.getByLabelText('Ver posts com #ação'));
    expect(mockPush).toHaveBeenCalledWith(`/tag/${encodeURIComponent('ação')}`);
    await fireEvent.press(screen.getByLabelText('Ver posts com #arte'));
    expect(mockPush).toHaveBeenCalledWith('/tag/arte');
  });

  it('sem tags (comentário) a # não é link', async () => {
    await render(<MentionText text="olha #arte" />);
    expect(screen.queryByLabelText('Ver posts com #arte')).toBeNull();
  });
});

describe('MentionSuggestions', () => {
  it('mostra quem combina e escolhe', async () => {
    const onPick = jest.fn();
    await render(<MentionSuggestions query="b" onPick={onPick} />);
    expect(screen.queryByText('Ana')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Marcar Bia (@bia)'));
    expect(onPick).toHaveBeenCalledWith('bia');
  });

  it('ninguém combina: some', async () => {
    await render(<MentionSuggestions query="zz" onPick={() => {}} />);
    expect(screen.queryByRole('button')).toBeNull();
  });
});

describe('MemberDirectorySync', () => {
  it('membro: carrega os fellas com fotos e recarrega quando um perfil muda; ao sair, esvazia', async () => {
    setMemberDirectory([]);
    mockListMembers.mockResolvedValue([
      { id: 'u1', username: 'ana', display_name: 'Ana', avatar_url: 'u1/a.jpg' },
      { id: 'u3', username: 'bia', display_name: null, avatar_url: null },
    ]);
    mockSession = { session: { user: { id: 'u1' } }, profile: { is_member: true } };
    const view = await render(<MemberDirectorySync />);
    await act(async () => {});
    expect(getMemberDirectory()).toEqual([
      { id: 'u1', username: 'ana', name: 'Ana', avatarUrl: 'https://signed/u1/a.jpg' },
      { id: 'u3', username: 'bia', name: 'bia', avatarUrl: null },
    ]);
    await act(async () => {
      emitLive({ kind: 'change', table: 'profiles', type: 'INSERT', row: { id: 'u9' }, mine: false });
      await new Promise((r) => setTimeout(r, LIVE_DEBOUNCE_MS + 50));
    });
    expect(mockListMembers).toHaveBeenCalledTimes(2);
    mockSession = { session: null, profile: null };
    await view.rerender(<MemberDirectorySync />);
    expect(getMemberDirectory()).toEqual([]);
  });
});
