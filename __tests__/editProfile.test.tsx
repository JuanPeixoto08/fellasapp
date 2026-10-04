import { fireEvent, render, screen } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn() }),
  Stack: { Screen: () => null },
}));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ signOut: jest.fn() }) }));
jest.mock('../lib/api/profiles', () => ({
  ...jest.requireActual('../lib/api/profiles'),
  getCurrentUserId: jest.fn().mockResolvedValue('u1'),
  getProfile: jest.fn().mockResolvedValue({ id: 'u1', username: 'ana', display_name: 'Ana', bio: '', birthday: null }),
  updateMyProfile: jest.fn(),
}));

import EditProfileScreen from '../app/profile/edit';
import { updateMyProfile } from '../lib/api/profiles';

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
