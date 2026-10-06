import { fireEvent, render, screen } from '@testing-library/react-native';
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
    AvatarCropper: ({ uri, onCancel, onConfirm }: { uri: string | null; onCancel: () => void; onConfirm: (u: string) => void }) =>
      uri ? (
        <View testID="cropper-stub">
          <Pressable accessibilityLabel="Usar recorte de teste" onPress={() => onConfirm(uri + '#recortada')} />
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
