import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import ProfileView from '../components/ProfileView';
import { colors } from '../lib/theme';
import { PROFILE_LIMITS, formatBirthday, maskBirthday, parseBirthday, updateMyProfile, validateUsername } from '../lib/api/profiles';

const mockPush = jest.fn();
const mockUsePostList = jest.fn();
let mockMe = 'u1';

jest.mock('expo-router', () => {
  const { useEffect } = require('react');
  return {
    useRouter: () => ({ push: mockPush, navigate: jest.fn() }),
    useFocusEffect: (cb: () => void) => useEffect(cb, [cb]),
  };
});
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: mockMe } } }),
}));
jest.mock('../lib/usePostList', () => ({
  usePostList: (opts: unknown) => mockUsePostList(opts),
  removePost: jest.fn(),
}));

const mockUpdate = jest.fn();
const mockRpc = jest.fn();
const mockUpload = jest.fn();
const mockEqUpdate = jest.fn();

const profileRow = {
  id: 'u1',
  username: 'ana_01',
  display_name: 'Ana',
  avatar_url: null,
  bio: 'Oi, sou a Ana',
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
      rpc: (...a: unknown[]) => {
        mockRpc(...a);
        return Promise.resolve({ data: null, error: null });
      },
      from: (t: string) => query(t),
      auth: { getUser: () => Promise.resolve({ data: { user: { id: 'u1' } }, error: null }) },
      storage: {
        from: () => ({
          upload: (...a: unknown[]) => {
            mockUpload(...a);
            return Promise.resolve({ error: null });
          },
          createSignedUrls: (paths: string[]) =>
            Promise.resolve({
              data: paths.map((p) => ({ path: p, signedUrl: `https://x/${p}`, error: null })),
              error: null,
            }),
        }),
      },
    },
  };
});

describe('validateUsername', () => {
  it.each(['abc', 'a_b_c_1', 'a'.repeat(30)])('aceita %s', (u) => {
    expect(validateUsername(u)).toBeNull();
  });
  it.each(['ab', 'a'.repeat(31), 'Ana', 'a b c', 'ana-1', 'aná'])('rejeita %s', (u) => {
    expect(validateUsername(u)).not.toBeNull();
  });
});

describe('birthday', () => {
  it('converte DD/MM/AAAA em ISO', () => {
    expect(parseBirthday('20/05/1999')).toBe('1999-05-20');
    expect(parseBirthday('')).toBeNull();
  });
  it.each(['31/02/2000', '2000-01-01', '1/1/2000', '01/01/2999', '01/01/0001', '10/10/1899', 'ab/cd/efgh'])('rejeita %s', (v) => {
    expect(parseBirthday(v)).toBeUndefined();
  });
  it('máscara: só números, barras entram sozinhas, no máximo 8 dígitos', () => {
    expect(maskBirthday('2')).toBe('2');
    expect(maskBirthday('20')).toBe('20');
    expect(maskBirthday('205')).toBe('20/5');
    expect(maskBirthday('2005')).toBe('20/05');
    expect(maskBirthday('20051999')).toBe('20/05/1999');
    expect(maskBirthday('20/05/19991')).toBe('20/05/1999');
    expect(maskBirthday('ab20c05x')).toBe('20/05');
    expect(maskBirthday('20/0')).toBe('20/0'); // apagando: não volta a barra sozinha
    expect(maskBirthday('20/')).toBe('20');
    expect(maskBirthday('')).toBe('');
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
    });
    expect(mockUpdate).toHaveBeenCalledWith({
      display_name: 'Ana',
      username: 'ana_01',
      bio: '',
      status: '🎧 pagode',
      location: null,
      birthday: '1999-05-20',
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

  it('faz upload do banner e salva o caminho', async () => {
    (globalThis as any).fetch = jest.fn().mockResolvedValue({
      blob: () => Promise.resolve({ type: 'image/jpeg' }),
    });
    await updateMyProfile({ display_name: 'Ana', username: 'ana_01', bio: '', bannerUri: 'file://praia.jpg' });
    expect(mockUpload.mock.calls[0][0]).toMatch(/^u1\/banner-\d+\.jpg$/);
    expect(mockUpdate.mock.calls[0][0].banner_url).toBe(mockUpload.mock.calls[0][0]);
    expect(mockUpdate.mock.calls[0][0]).not.toHaveProperty('avatar_url');
  });

  it('tirar o banner grava null sem subir nada', async () => {
    await updateMyProfile({ display_name: 'Ana', username: 'ana_01', bio: '', removeBanner: true });
    expect(mockUpload).not.toHaveBeenCalled();
    expect(mockUpdate.mock.calls[0][0].banner_url).toBeNull();
  });

  it('rejeita nome acima de 50 e bio acima de 160 sem chamar o banco', async () => {
    expect(PROFILE_LIMITS).toEqual({ displayName: 50, bio: 160 });
    await expect(updateMyProfile({ display_name: 'a'.repeat(51), username: 'ana_01', bio: '' })).rejects.toThrow(
      'O nome pode ter até 50 caracteres.',
    );
    await expect(updateMyProfile({ display_name: 'Ana', username: 'ana_01', bio: 'b'.repeat(161) })).rejects.toThrow(
      'A bio pode ter até 160 caracteres.',
    );
    expect(mockUpdate).not.toHaveBeenCalled();
    // no limite (depois de tirar espaços) passa
    await updateMyProfile({ display_name: ` ${'a'.repeat(50)} `, username: 'ana_01', bio: 'b'.repeat(160) });
    expect(mockUpdate).toHaveBeenCalled();
  });

  it('rejeita username inválido sem chamar o banco', async () => {
    await expect(
      updateMyProfile({ display_name: 'A', username: 'x', bio: '' }),
    ).rejects.toThrow(/3 a 30/);
    expect(mockUpdate).not.toHaveBeenCalled();
  });
});

const feedPost = (id: string, extra: Record<string, unknown> = {}) => ({
  id,
  body: 'primeiro post',
  images: [] as string[],
  imageUrl: null as string | null,
  createdAt: '2026-01-02T00:00:00Z',
  author: { id: 'u1', username: 'ana_01', display_name: 'Ana', avatar_url: null },
  likeCount: 0,
  commentCount: 0,
  likedByMe: false,
  reactions: [],
  myReaction: null,
  ...extra,
});
const textPost = feedPost('p1');
const photoPost = feedPost('p2', { body: 'olha isso', images: ['https://x/p2.jpg', 'https://x/p2b.jpg'], imageUrl: 'https://x/p2.jpg' });
const fakeList = (posts: unknown[]) => ({
  posts,
  loaded: true,
  loading: false,
  refreshing: false,
  error: null,
  refresh: jest.fn(),
  reload: jest.fn(),
  loadMore: jest.fn(),
  like: jest.fn(),
  react: jest.fn(),
});

function renderProfile() {
  return render(
    <SafeAreaProvider
      initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 47, left: 0, right: 0, bottom: 34 } }}
    >
      <ProfileView userId="u1" />
    </SafeAreaProvider>,
  );
}

describe('ProfileView', () => {
  beforeEach(() => {
    mockMe = 'u1';
    mockPush.mockClear();
    mockUsePostList.mockReset();
    mockUsePostList.mockImplementation((opts: { photosOnly?: boolean }) =>
      fakeList(opts?.photosOnly ? [photoPost] : [textPost, photoPost]),
    );
  });

  it('renderiza nome, @username, bio e os posts um embaixo do outro', async () => {
    await renderProfile();
    expect(await screen.findByText('@ana_01')).toBeTruthy();
    expect(screen.getByText('Oi, sou a Ana')).toBeTruthy();
    expect(screen.getByText('primeiro post')).toBeTruthy();
    expect(screen.getByText('olha isso')).toBeTruthy();
    expect(mockUsePostList).toHaveBeenCalledWith({ authorId: 'u1' });
  });

  it('banner no topo quando a pessoa tem um', async () => {
    (profileRow as Record<string, unknown>).banner_url = 'u1/banner-1.jpg';
    try {
      await renderProfile();
      const banner = await screen.findByLabelText('Banner de Ana');
      expect(banner.props.source).toEqual({ uri: 'https://x/u1/banner-1.jpg' });
    } finally {
      delete (profileRow as Record<string, unknown>).banner_url;
    }
  });

  it('sem banner: faixa lisa do mesmo tamanho (o layout não pula)', async () => {
    await renderProfile();
    await screen.findByText('@ana_01');
    expect(screen.queryByLabelText('Banner de Ana')).toBeNull();
    expect(screen.getByTestId('profile-banner-empty')).toBeTruthy();
  });

  it('avisa quem abriu quando o perfil carregou (título com o @)', async () => {
    const onLoaded = jest.fn();
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <ProfileView userId="u1" header onLoaded={onLoaded} />
      </SafeAreaProvider>,
    );
    await screen.findByText('@ana_01');
    expect(onLoaded).toHaveBeenCalledWith(expect.objectContaining({ username: 'ana_01' }));
  });

  it('mostra status, info e estatísticas, sem cor de perfil', async () => {
    await renderProfile();
    expect(await screen.findByText('🎧 ouvindo pagode')).toBeTruthy();
    expect(screen.queryByTestId('profile-avatar-ring')).toBeNull();
    expect(StyleSheet.flatten(screen.getByTestId('profile-status').props.style).backgroundColor).toBe(
      colors.light.surfaceSunken,
    );
    expect(screen.getByLabelText('Cidade: Recife')).toBeTruthy();
    expect(screen.getByLabelText('Aniversário: 20/05')).toBeTruthy();
    expect(screen.getByText('membro desde jan 2026')).toBeTruthy();
    expect(await screen.findByText('curtidas')).toBeTruthy();
  });

  it('aba Fotos mostra só as fotos e tocar abre o post', async () => {
    await renderProfile();
    await fireEvent.press(await screen.findByText('Fotos'));
    expect(mockUsePostList).toHaveBeenLastCalledWith({ authorId: 'u1', photosOnly: true, enabled: true });
    const tiles = screen.getAllByTestId('post-tile');
    expect(tiles).toHaveLength(1);
    // post com 2 fotos: um quadradinho só, com o ícone de "várias"
    expect(screen.getByTestId('post-tile-multi')).toBeTruthy();
    expect(screen.getByLabelText('Abrir post com 2 fotos: olha isso')).toBeTruthy();
    await fireEvent.press(tiles[0]);
    expect(mockPush).toHaveBeenCalledWith('/post/p2');
  });

  it('só no meu perfil os posts têm lixeira', async () => {
    await renderProfile();
    expect(await screen.findAllByLabelText('Apagar post')).toHaveLength(2);
  });

  it('no meu perfil dá pra fixar um post: vai pra lista como fixado', async () => {
    await renderProfile();
    const pins = await screen.findAllByLabelText('Fixar no perfil');
    expect(pins).toHaveLength(2);
    await fireEvent.press(pins[0]);
    await waitFor(() => expect(mockRpc).toHaveBeenCalledWith('set_pinned_post', { p_post_id: 'p1' }));
    await waitFor(() => expect(mockUsePostList).toHaveBeenCalledWith({ authorId: 'u1', pinnedId: 'p1' }));
    expect(await screen.findByText('Fixado')).toBeTruthy();
  });

  it('no perfil de outro fella não tem alfinete', async () => {
    mockMe = 'u9';
    await renderProfile();
    await screen.findByText('@ana_01');
    expect(screen.queryByLabelText('Fixar no perfil')).toBeNull();
  });

  it('no perfil de outro fella não tem lixeira', async () => {
    mockMe = 'u9';
    await renderProfile();
    await screen.findByText('@ana_01');
    expect(screen.queryByLabelText('Apagar post')).toBeNull();
  });
  it('grade de fotos usa a largura da coluna (moldura), não a da janela', async () => {
    const { ShellContext } = require('../components/shell/ShellContext');
    await render(
      <SafeAreaProvider
        initialMetrics={{ frame: { x: 0, y: 0, width: 1440, height: 900 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
      >
        <ShellContext.Provider value={{ contentWidth: 600, openCompose: null }}>
          <ProfileView userId="u1" />
        </ShellContext.Provider>
      </SafeAreaProvider>,
    );
    await fireEvent.press(await screen.findByText('Fotos'));
    // (600 - 2*16 - 2*4) / 3 = 186
    const style = StyleSheet.flatten(screen.getByTestId('post-tile').props.style);
    expect(style).toMatchObject({ width: 186, height: 186 });
  });
});

