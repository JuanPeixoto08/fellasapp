import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import NewPostScreen from '../app/(tabs)/new';
import { createPost } from '../lib/api/posts';
import { clearDraft } from '../lib/composerDraft';

const mockNavigate = jest.fn();
const mockPick = jest.fn();

jest.mock('expo-router', () => ({ useRouter: () => ({ navigate: mockNavigate }) }));
jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: (o: unknown) => mockPick(o) }));
jest.mock('../lib/auth/SessionProvider', () => ({
  useSession: () => ({ session: { user: { id: 'me' } }, profile: { display_name: 'Juan Peixoto', username: 'juan', avatar_url: null } }),
}));
jest.mock('../lib/api/posts', () => ({ MAX_IMAGES: 4, createPost: jest.fn().mockResolvedValue({ id: 'n' }) }));

const createPostMock = createPost as jest.Mock;
const assets = (n: number, from = 0) => ({
  canceled: false,
  assets: Array.from({ length: n }, (_, i) => ({ uri: `file://foto-${from + i}.jpg` })),
});

const Wrapper = ({ children }: { children: ReactNode }) => (
  <SafeAreaProvider
    initialMetrics={{ frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } }}
  >
    {children}
  </SafeAreaProvider>
);

beforeEach(() => {
  clearDraft();
  mockNavigate.mockClear();
  mockPick.mockReset();
  createPostMock.mockClear();
});

describe('Novo post (compositor)', () => {
  it('orienta e só libera Postar quando tem texto ou foto', async () => {
    await render(<NewPostScreen />, { wrapper: Wrapper });
    expect(screen.getByPlaceholderText('O que rolou, fella?')).toBeTruthy();
    expect(screen.getByText(/até 4 fotos, ou os dois/)).toBeTruthy();
    expect(screen.getByText('0/4 fotos')).toBeTruthy();
    expect(screen.getByLabelText('Postar').props.accessibilityState).toMatchObject({ disabled: true });
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    expect(screen.getByLabelText('Postar').props.accessibilityState).toMatchObject({ disabled: false });
  });

  it('escolhe várias fotos de uma vez, mostra 2/4 e deixa remover', async () => {
    mockPick.mockResolvedValueOnce(assets(2));
    await render(<NewPostScreen />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByLabelText('Adicionar fotos'));
    expect(mockPick).toHaveBeenCalledWith(expect.objectContaining({ allowsMultipleSelection: true, selectionLimit: 4 }));
    expect(await screen.findByText('2/4 fotos')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Remover foto 1'));
    expect(screen.getByText('1/4 fotos')).toBeTruthy();
  });

  it('passou de 4: fica com as primeiras e avisa', async () => {
    mockPick.mockResolvedValueOnce(assets(3)).mockResolvedValueOnce(assets(3, 3));
    await render(<NewPostScreen />, { wrapper: Wrapper });
    await fireEvent.press(screen.getByLabelText('Adicionar fotos'));
    await screen.findByText('3/4 fotos');
    await fireEvent.press(screen.getByLabelText('Adicionar fotos'));
    expect(await screen.findByText('4/4 fotos')).toBeTruthy();
    expect(screen.getByText(/Cabem 4 fotos por post/)).toBeTruthy();
  });

  it('posta texto + fotos e volta pro feed', async () => {
    mockPick.mockResolvedValueOnce(assets(2));
    await render(<NewPostScreen />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'praia!!');
    await fireEvent.press(screen.getByLabelText('Adicionar fotos'));
    await screen.findByText('2/4 fotos');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith({ body: 'praia!!', imageUris: ['file://foto-0.jpg', 'file://foto-1.jpg'], location: null }),
    );
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/feed'));
  });

  it('erro ao postar aparece em pt-BR e mantém o rascunho', async () => {
    createPostMock.mockRejectedValueOnce(new Error('column "images" of relation "posts" does not exist'));
    await render(<NewPostScreen />, { wrapper: Wrapper });
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'oi');
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(await screen.findByText('Não rolou postar. Tenta de novo.')).toBeTruthy();
    expect(screen.getByDisplayValue('oi')).toBeTruthy();
  });
});
