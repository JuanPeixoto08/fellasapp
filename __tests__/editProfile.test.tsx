import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
// a tela de ajuste tem teste próprio (avatarCropper.test); aqui só o fluxo escolher → ajustar → salvar
jest.mock('../components/profile/AvatarCropper', () => {
  const { Pressable, View } = require('react-native');
  return {
    AvatarCropper: ({
      uri,
      shape,
      onCancel,
      onConfirm,
    }: {
      uri: string | null;
      shape?: string;
      onCancel: () => void;
      onConfirm: (u: string) => void;
    }) =>
      uri ? (
        <View testID="cropper-stub">
          <Pressable
            accessibilityLabel={shape === 'banner' ? 'Usar recorte do banner' : 'Usar recorte de teste'}
            onPress={() => onConfirm(uri + '#recortada')}
          />
          <Pressable accessibilityLabel="Cancelar recorte de teste" onPress={onCancel} />
        </View>
      ) : null,
  };
});
const mockRefreshProfile = jest.fn();
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ signOut: jest.fn(), refreshProfile: mockRefreshProfile }),
}));
jest.mock('../lib/api/profiles', () => ({
  ...jest.requireActual('../lib/api/profiles'),
  getCurrentUserId: jest.fn().mockResolvedValue('u1'),
  getProfile: jest.fn().mockResolvedValue({ id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null }),
  updateMyProfile: jest.fn(),
}));

jest.mock('../lib/api/storage', () => ({
  ...jest.requireActual('../lib/api/storage'),
  signPaths: async (paths: (string | null | undefined)[]) =>
    new Map(paths.filter((p): p is string => !!p).map((p) => [p, `https://signed/${p}`])),
}));

const mockGetUserInfo = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  hasLastfmKey: () => true,
  getUserInfo: (u: string) => mockGetUserInfo(u),
}));

import EditProfileScreen from '../app/profile/edit';
import { getProfile, updateMyProfile } from '../lib/api/profiles';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

async function renderScreen() {
  await render(
    <SafeAreaProvider initialMetrics={metrics}>
      <EditProfileScreen />
    </SafeAreaProvider>,
  );
  return screen.getByLabelText('Aniversário');
}

describe('Editar perfil: aniversário', () => {
  it('só aceita números e põe as barras sozinho', async () => {
    const field = await renderScreen();
    await fireEvent.changeText(field, 'ab20c05x1999');
    expect(screen.getByLabelText('Aniversário').props.value).toBe('20/05/1999');
  });

  it('data que não existe avisa ao sair do campo e não salva', async () => {
    const field = await renderScreen();
    await fireEvent.changeText(field, '31022000');
    await fireEvent(field, 'blur');
    expect(screen.getByText('Essa data não rola. Usa DD/MM/AAAA, tipo 20/05/1999.')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).not.toHaveBeenCalled();
  });
});

describe('Editar perfil: limites', () => {
  it('nome até 50 e bio até 160 com contador', async () => {
    await renderScreen();
    expect(screen.getByLabelText('Nome').props.maxLength).toBe(50);
    expect(screen.getByLabelText('Bio').props.maxLength).toBe(160);
    expect(screen.getByText('0/160')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Bio'), 'oi fellas');
    expect(screen.getByText('9/160')).toBeTruthy();
  });

  it('não tem mais seletor de cor do perfil', async () => {
    await renderScreen();
    expect(screen.queryByText('Cor do perfil')).toBeNull();
  });
});

describe('Editar perfil: foto com recorte', () => {
  const ImagePicker = jest.requireMock('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };

  beforeEach(() => {
    jest.clearAllMocks();
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://eu.jpg' }] });
  });

  it('escolher a foto abre "Ajustar foto" e salva o recorte', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Escolher foto'));
    expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledWith({ mediaTypes: ['images'], quality: 1 });
    await fireEvent.press(await screen.findByLabelText('Usar recorte de teste'));
    expect(screen.queryByTestId('cropper-stub')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUri: 'file://eu.jpg#recortada' }));
  });

  it('GIF pula o "Ajustar foto" e sobe como está (senão perde a animação)', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:gif', mimeType: 'image/gif', fileSize: 1000 }] });
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Escolher foto'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    expect(screen.queryByTestId('cropper-stub')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUri: 'blob:gif' }));
  });

  it('GIF grande demais: avisa e não troca a foto', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'blob:gif', mimeType: 'image/gif', fileSize: 6 * 1024 * 1024 }] });
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Escolher foto'));
    expect(await screen.findByText('Esse GIF passa de 5 MB. Escolhe um menor.')).toBeTruthy();
    expect(screen.queryByTestId('cropper-stub')).toBeNull();
  });

  it('cancelar o ajuste não troca a foto', async () => {
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Escolher foto'));
    await fireEvent.press(await screen.findByLabelText('Cancelar recorte de teste'));
    expect(screen.queryByTestId('cropper-stub')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUri: undefined }));
  });
});

describe('Editar perfil: foto atual', () => {
  const withPhoto = { id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null, avatar_url: 'u1/a.jpg' };

  it('mostra a foto que já está salva (não a letra) e oferece trocar', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce(withPhoto);
    await renderScreen();
    const photo = await screen.findByLabelText('Foto de Ana');
    expect(photo.props.source).toEqual({ uri: 'https://signed/u1/a.jpg' });
    expect(screen.queryByLabelText('Avatar de Ana')).toBeNull();
    expect(screen.getByText('Trocar foto')).toBeTruthy();
  });

  it('salvar sem trocar a foto não manda a foto de novo', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce(withPhoto);
    (updateMyProfile as jest.Mock).mockClear();
    await renderScreen();
    await screen.findByLabelText('Foto de Ana');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ avatarUri: undefined }));
  });

  it('salvou: a sessão busca o perfil de novo (foto nova na lateral e no compositor)', async () => {
    (updateMyProfile as jest.Mock).mockResolvedValueOnce({});
    mockRefreshProfile.mockClear();
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(mockRefreshProfile).toHaveBeenCalled();
  });
});

describe('Editar perfil: banner', () => {
  const ImagePicker = jest.requireMock('expo-image-picker') as { launchImageLibraryAsync: jest.Mock };
  const withBanner = { id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null, banner_url: 'u1/banner-1.jpg' };

  beforeEach(() => (updateMyProfile as jest.Mock).mockClear());

  it('escolher → ajustar no retângulo → aparece na prévia → salvar manda o banner', async () => {
    ImagePicker.launchImageLibraryAsync.mockResolvedValue({ canceled: false, assets: [{ uri: 'file://praia.jpg' }] });
    await renderScreen();
    await fireEvent.press(screen.getByLabelText('Escolher banner'));
    await fireEvent.press(await screen.findByLabelText('Usar recorte do banner'));
    expect(screen.getByLabelText('Seu banner').props.source).toEqual({ uri: 'file://praia.jpg#recortada' });
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(
      expect.objectContaining({ bannerUri: 'file://praia.jpg#recortada', removeBanner: false }),
    );
  });

  it('mostra o banner salvo; tirar some da prévia e salva sem banner', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce(withBanner);
    await renderScreen();
    expect((await screen.findByLabelText('Seu banner')).props.source).toEqual({ uri: 'https://signed/u1/banner-1.jpg' });
    expect(screen.getByText('Trocar banner')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tirar banner'));
    expect(screen.queryByLabelText('Seu banner')).toBeNull();
    expect(screen.queryByLabelText('Tirar banner')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ bannerUri: undefined, removeBanner: true }));
  });

  it('salvar sem mexer no banner não manda nem tira', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce(withBanner);
    await renderScreen();
    await screen.findByLabelText('Seu banner');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ bannerUri: undefined, removeBanner: false }));
  });
});

describe('Editar perfil: Last.fm', () => {
  const { LastfmError } = jest.requireActual('../lib/lastfm/api');
  beforeEach(() => {
    (updateMyProfile as jest.Mock).mockClear();
    mockGetUserInfo.mockReset().mockResolvedValue({ name: 'juanfm', playcount: 1, registeredAt: null });
  });

  it('usuário que existe: confere no Last.fm e salva', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), 'juanfm');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(mockGetUserInfo).toHaveBeenCalledWith('juanfm');
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ lastfmUser: 'juanfm' }));
  });

  it('usuário que não existe: erro no campo e não salva', async () => {
    mockGetUserInfo.mockRejectedValue(new LastfmError('not_found'));
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), 'naoexiste');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(await screen.findByText('Não achamos esse usuário no Last.fm.')).toBeTruthy();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('formato inválido: nem pergunta ao Last.fm', async () => {
    await renderScreen();
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), 'juan peixoto');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(await screen.findByText('Usuário do Last.fm inválido.')).toBeTruthy();
    expect(mockGetUserInfo).not.toHaveBeenCalled();
    expect(updateMyProfile).not.toHaveBeenCalled();
  });

  it('usuário igual ao salvo (mesmo com o Last.fm fora): não pergunta e salva', async () => {
    mockGetUserInfo.mockRejectedValue(new LastfmError('network'));
    (getProfile as jest.Mock).mockResolvedValueOnce({ id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null, lastfm_user: 'juanfm' });
    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Usuário no Last.fm').props.value).toBe('juanfm'));
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(mockGetUserInfo).not.toHaveBeenCalled();
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ lastfmUser: 'juanfm' }));
  });

  it('apagar o campo desconecta', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce({ id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null, lastfm_user: 'juanfm' });
    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Usuário no Last.fm').props.value).toBe('juanfm'));
    await fireEvent.changeText(screen.getByLabelText('Usuário no Last.fm'), '');
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ lastfmUser: '' }));
  });
});

describe('Editar perfil: o que aparece no perfil', () => {
  const base = { id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null };
  beforeEach(() => {
    (updateMyProfile as jest.Mock).mockClear();
    mockGetUserInfo.mockReset().mockResolvedValue({ name: 'anafm', playcount: 1, registeredAt: null });
  });

  it('sem Last.fm: a chave da música fica desabilitada e explica', async () => {
    await renderScreen();
    expect(screen.getByRole('switch', { name: 'Mostrar o que estou ouvindo' }).props.disabled).toBe(true);
    expect(screen.getByText('Conecte o Last.fm acima pra usar.')).toBeTruthy();
  });

  it('com Last.fm: desligar e salvar manda showNowPlaying false', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce({ ...base, lastfm_user: 'anafm', show_now_playing: true });
    await renderScreen();
    await waitFor(() => expect(screen.getByLabelText('Usuário no Last.fm').props.value).toBe('anafm'));
    const toggle = screen.getByRole('switch', { name: 'Mostrar o que estou ouvindo' });
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, 'valueChange', false);
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ showNowPlaying: false }));
  });

  it('chave salva desligada aparece desligada', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce({ ...base, lastfm_user: 'anafm', show_now_playing: false });
    await renderScreen();
    await waitFor(() =>
      expect(screen.getByRole('switch', { name: 'Mostrar o que estou ouvindo' }).props.value).toBe(false),
    );
  });

  it('quem tem selo: escolhe qual mostrar (sem opção de esconder) e salvar manda a escolha', async () => {
    (getProfile as jest.Mock).mockResolvedValueOnce({ ...base, badges: ['verified'], featured_badge: null });
    await renderScreen();
    const option = await screen.findByRole('radio', { name: 'Verificado' });
    expect(option.props.accessibilityState).toMatchObject({ checked: true });
    expect(screen.queryByRole('switch', { name: /Selo/ })).toBeNull();
    await fireEvent.press(option);
    await fireEvent.press(screen.getByLabelText('Salvar'));
    expect(updateMyProfile).toHaveBeenCalledWith(expect.objectContaining({ featuredBadge: 'verified' }));
  });

  it('sem selo: não aparece escolha de selo', async () => {
    await renderScreen();
    expect(screen.queryByRole('radio', { name: 'Verificado' })).toBeNull();
    expect(screen.queryByText('Selo do lado do nome')).toBeNull();
  });
});
