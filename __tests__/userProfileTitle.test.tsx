import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => ({ handle: '@woozie' }),
    Redirect: () => null,
    Stack: { Screen: ({ options }: { options?: { title?: string } }) => <Text>{`título:${options?.title}`}</Text> },
  };
});
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
jest.mock('../lib/api/profiles', () => ({ getProfileByUsername: async () => ({ id: 'u2', username: 'woozie' }) }));
jest.mock('../components/ProfileView', () => {
  const { Text } = require('react-native');
  return { __esModule: true, default: () => <Text>perfil</Text> };
});

import HandleScreen from '../app/[handle]';

describe('Perfil de outra pessoa: título do topo', () => {
  it('o @ da pessoa, já desde o carregamento (vem do endereço)', async () => {
    await render(<HandleScreen />);
    expect(screen.getByText('título:@woozie')).toBeTruthy();
    expect(await screen.findByText('perfil')).toBeTruthy();
  });
});
