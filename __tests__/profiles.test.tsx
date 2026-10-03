import { render, screen } from '@testing-library/react-native';

import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProfileView from '../components/ProfileView';
import { formatBirthday, parseBirthday, updateMyProfile, validateUsername } from '../lib/api/profiles';

const mockUpdate = jest.fn();
const mockUpload = jest.fn();
const mockEqUpdate = jest.fn();

const profileRow = {
  id: 'u1',
  username: 'ana_01',
  display_name: 'Ana',
  avatar_url: null,
  bio: 'Oi, sou a Ana',
  accent_color: 'coral',
  status: '🎧 ouvindo pagode',
  location: 'Recife',
  birthday: '1999-05-20',
  is_member: true,
  created_at: '2026-01-15T12:00:00Z',
};
const postRows = [
  { id: 'p1', author_id: 'u1', body: 'primeiro post', image_url: null, created_at: '2026-01-02' },
];

jest.mock('../lib/supabase', () => {
  // builder encadeável e "thenable" para consultas select
  const query = (table: string) => {
    const result = { data: table === 'profiles' ? profileRow : postRows, error: null };
    const b: any = {
      select: () => b,
      eq: () => b,
      order: () => b,
      single: () => Promise.resolve(result),
      update: (fields: unknown) => {
        mockUpdate(fields);
        return {
          eq: (...args: unknown[]) => {
            mockEqUpdate(...args);
            return { select: () => ({ single: () => Promise.resolve(result) }) };
          },
        };
      },
      then: (res: (v: unknown) => unknown) => Promise.resolve(result).then(res),
    };
    return b;
  };
  return {
    supabase: {
      from: (t: string) => query(t),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
      storage: {
        from: () => ({
          upload: (...a: unknown[]) => {
            mockUpload(...a);
            return Promise.resolve({ error: null });
          },
          createSignedUrl: () => Promise.resolve({ data: { signedUrl: 'https://x/y.jpg' }, error: null }),
        }),
      },
    },
  };
});

describe('validateUsername', () => {
  it.each(['abc', 'a_b_c_1', 'a'.repeat(20)])('aceita %s', (u) => {
    expect(validateUsername(u)).toBeNull();
  });
  it.each(['ab', 'a'.repeat(21), 'Ana', 'a b c', 'ana-1', 'aná'])('rejeita %s', (u) => {
    expect(validateUsername(u)).not.toBeNull();
  });
});

describe('birthday', () => {
  it('converte DD/MM/AAAA em ISO', () => {
    expect(parseBirthday('20/05/1999')).toBe('1999-05-20');
    expect(parseBirthday('')).toBeNull();
  });
  it.each(['31/02/2000', '2000-01-01', '1/1/2000', '01/01/2999'])('rejeita %s', (v) => {
    expect(parseBirthday(v)).toBeUndefined();
  });
  it('formata ISO', () => {
    expect(formatBirthday('1999-05-20')).toBe('20/05/1999');
    expect(formatBirthday(null)).toBe('');
  });
});

describe('updateMyProfile', () => {
  beforeEach(() => jest.clearAllMocks());

  it('envia apenas os campos editáveis, normalizados', async () => {
    await updateMyProfile({ display_name: ' Ana ', username: ' Ana_01 ', bio: ' oi ' });
    expect(mockUpdate).toHaveBeenCalledWith({ display_name: 'Ana', username: 'ana_01', bio: 'oi' });
    expect(mockEqUpdate).toHaveBeenCalledWith('id', 'u1');
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it('envia campos novos; vazio vira null', async () => {
    await updateMyProfile({
      display_name: 'Ana',
      username: 'ana_01',
      bio: '',
      status: ' 🎧 pagode ',
      location: '  ',
      birthday: '1999-05-20',
      accent_color: 'coral',
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      display_name: 'Ana',
      username: 'ana_01',
      bio: '',
      status: '🎧 pagode',
      location: null,
      birthday: '1999-05-20',
      accent_color: 'coral',
    });
  });

  it('faz upload do avatar e salva o caminho', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve({ type: 'image/png' }),
    });
    await updateMyProfile({ display_name: 'Ana', username: 'ana_01', bio: '', avatarUri: 'file://a.png' });
    expect(mockUpload.mock.calls[0][0]).toMatch(/^u1\/avatar-\d+\.png$/);
    expect(mockUpdate.mock.calls[0][0].avatar_url).toBe(mockUpload.mock.calls[0][0]);
  });

  it('rejeita username inválido sem chamar o banco', async () => {
    await expect(
      updateMyProfile({ display_name: 'A', username: 'x', bio: '' }),
    ).rejects.toThrow(/Username/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

describe('ProfileView', () => {
  it('renderiza nome, @username, bio e posts', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
      >
        <ProfileView userId="u1" />
      </SafeAreaProvider>,
    );
    expect(await screen.findByText('Ana')).toBeTruthy();
    expect(screen.getByText('@ana_01')).toBeTruthy();
    expect(screen.getByText('Oi, sou a Ana')).toBeTruthy();
    expect(screen.getByText('primeiro post')).toBeTruthy();
  });

  it('mostra banner, status, info e estatísticas', async () => {
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
      >
        <ProfileView userId="u1" />
      </SafeAreaProvider>,
    );
    expect(await screen.findByText('🎧 ouvindo pagode')).toBeTruthy();
    expect(screen.getByTestId('profile-banner').props.style.backgroundColor).toBe('#FF6B5E');
    expect(screen.getByText('📍 Recife')).toBeTruthy();
    expect(screen.getByText('🎂 20/05')).toBeTruthy();
    expect(screen.getByText('membro desde jan 2026')).toBeTruthy();
    expect(await screen.findByText('curtidas')).toBeTruthy();
  });
});
