import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppShell, shellVisible } from '../components/shell/AppShell';

let mockTier = 'expanded';
let mockSegments = ['(tabs)', 'feed'];
let mockSession: Record<string, unknown> = {};
jest.mock('../lib/layout', () => ({ useLayoutTier: () => mockTier }));
jest.mock('expo-router', () => ({
  useSegments: () => mockSegments,
  usePathname: () => '/feed',
  useRouter: () => ({ navigate: jest.fn(), push: jest.fn() }),
}));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => mockSession }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));
jest.mock('../components/shell/RightRail', () => {
  const { Text: RNText } = require('react-native');
  return { RightRail: () => <RNText>coluna-direita</RNText> };
});
jest.mock('../components/shell/ComposeDialog', () => {
  const { Text: RNText } = require('react-native');
  return { ComposeDialog: ({ visible }: { visible: boolean }) => (visible ? <RNText>janela-aberta</RNText> : null) };
});

const member = { session: { user: { id: 'me' } }, profile: { is_member: true, username: 'juan' }, loading: false };

beforeEach(() => {
  mockTier = 'expanded';
  mockSegments = ['(tabs)', 'feed'];
  mockSession = member;
});

const renderShell = () =>
  render(
    <SafeAreaProvider initialMetrics={{ frame: { x: 0, y: 0, width: 1440, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}>
      <AppShell>
        <Text>conteudo</Text>
      </AppShell>
    </SafeAreaProvider>,
  );

describe('shellVisible', () => {
  const base = { loading: false, hasSession: true, isMember: true, first: '(tabs)' };
  it('só para membro logado fora de login/sem convite', () => {
    expect(shellVisible(base)).toBe(true);
    expect(shellVisible({ ...base, loading: true })).toBe(false);
    expect(shellVisible({ ...base, hasSession: false })).toBe(false);
    expect(shellVisible({ ...base, isMember: false })).toBe(false);
    expect(shellVisible({ ...base, first: '(auth)' })).toBe(false);
    expect(shellVisible({ ...base, first: 'not-invited' })).toBe(false);
    expect(shellVisible({ ...base, first: 'set-password' })).toBe(false);
    expect(shellVisible({ ...base, first: 'invites' })).toBe(false);
  });
});

describe('AppShell', () => {
  it('compact: só o conteúdo (celular igual a hoje)', async () => {
    mockTier = 'compact';
    await renderShell();
    expect(screen.getByText('conteudo')).toBeTruthy();
    expect(screen.queryByLabelText('Navegação')).toBeNull();
    expect(screen.queryByText('coluna-direita')).toBeNull();
  });

  it('medium: lateral sem coluna direita', async () => {
    mockTier = 'medium';
    await renderShell();
    expect(screen.getByLabelText('Navegação')).toBeTruthy();
    expect(screen.queryByText('coluna-direita')).toBeNull();
  });

  it('expanded: lateral + coluna direita; Postar abre a janela', async () => {
    await renderShell();
    expect(screen.getByLabelText('Navegação')).toBeTruthy();
    expect(screen.getByText('coluna-direita')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(screen.getByText('janela-aberta')).toBeTruthy();
  });

  it('login em tela larga: sem moldura', async () => {
    mockSegments = ['(auth)', 'login'];
    mockSession = { session: null, profile: null, loading: false };
    await renderShell();
    expect(screen.queryByLabelText('Navegação')).toBeNull();
  });
});
