import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('../lib/supabase', () => ({ supabase: {} }));

import { ProfileHeader } from '../components/profile/ProfileHeader';
import type { Profile } from '../lib/api/profiles';

const profile = {
  id: 'u1',
  username: 'oliveira',
  display_name: 'Juan',
  avatar_url: 'u1/avatar.jpg',
  banner_url: 'u1/banner.jpg',
  bio: null,
  status: null,
  location: null,
  birthday: null,
  is_member: true,
  is_admin: false,
  pinned_post_id: null,
  created_at: '2026-10-01T00:00:00Z',
  notifications_seen_at: '2026-10-01T00:00:00Z',
  badges: [],
} as unknown as Profile;
const metrics = { frame: { x: 0, y: 0, width: 400, height: 800 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = (avatarUri: string | null, bannerUri: string | null) =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <ProfileHeader profile={profile} avatarUri={avatarUri} bannerUri={bannerUri} />
    </SafeAreaProvider>,
  );

describe('foto de perfil e banner abrem maiores', () => {
  it('tocar na foto abre ela no visualizador; ✕ fecha', async () => {
    await open('https://s/avatar.jpg', 'https://s/banner.jpg');
    expect(screen.queryByLabelText('Foto de Juan (ampliada)')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Ver foto de Juan' }));
    expect(screen.getByLabelText('Foto de Juan (ampliada)').props.source).toEqual({ uri: 'https://s/avatar.jpg' });
    await fireEvent.press(screen.getByLabelText('Fechar fotos'));
    expect(screen.queryByLabelText('Foto de Juan (ampliada)')).toBeNull();
  });

  it('tocar no banner abre ele no visualizador', async () => {
    await open('https://s/avatar.jpg', 'https://s/banner.jpg');
    await fireEvent.press(screen.getByRole('button', { name: 'Ver banner de Juan' }));
    expect(screen.getByLabelText('Banner de Juan (ampliado)').props.source).toEqual({ uri: 'https://s/banner.jpg' });
  });

  it('sem foto ou sem banner não há o que abrir', async () => {
    await open(null, null);
    expect(screen.queryByRole('button', { name: 'Ver foto de Juan' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Ver banner de Juan' })).toBeNull();
  });
});
