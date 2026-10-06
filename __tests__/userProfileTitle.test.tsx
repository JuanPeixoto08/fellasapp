import { render, screen } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const { Text } = require('react-native');
  return {
    useLocalSearchParams: () => ({ id: 'u2' }),
    Redirect: () => null,
    Stack: { Screen: ({ options }: { options?: { title?: string } }) => <Text>{`título:${options?.title}`}</Text> },
  };
});
jest.mock('../lib/supabase', () => ({ supabase: {} }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ session: { user: { id: 'me' } } }) }));
let mockLoaded: { username: string } | null = null;
jest.mock('../components/ProfileView', () => {
  const { useEffect } = require('react');
  const { Text } = require('react-native');
  return {
    __esModule: true,
    default: ({ onLoaded }: { onLoaded?: (p: unknown) => void }) => {
      useEffect(() => {
        if (mockLoaded) onLoaded?.(mockLoaded);
      }, [onLoaded]);
      return <Text>perfil</Text>;
    },
  };
});

import UserProfileScreen from '../app/user/[id]';

describe('Perfil de outra pessoa: título do topo', () => {
  it('carregando: "Perfil"', async () => {
    mockLoaded = null;
    await render(<UserProfileScreen />);
    expect(screen.getByText('título:Perfil')).toBeTruthy();
  });

  it('carregou: o @ da pessoa', async () => {
    mockLoaded = { username: 'woozie' };
    await render(<UserProfileScreen />);
    expect(await screen.findByText('título:@woozie')).toBeTruthy();
  });
});
