import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

import { Composer } from '../components/feed/Composer';
import { createPost } from '../lib/api/posts';
import { clearDraft } from '../lib/composerDraft';
import { setMemberDirectory } from '../lib/memberDirectory';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));
jest.mock('../lib/api/posts', () => ({ MAX_IMAGES: 4, createPost: jest.fn().mockResolvedValue({ id: 'n' }) }));

const createPostMock = createPost as jest.Mock;

beforeEach(() => {
  clearDraft();
  createPostMock.mockClear();
});

describe('Composer', () => {
  it('@: sugere fellas enquanto digita e escolher completa o usuário', async () => {
    setMemberDirectory([
      { id: 'u1', username: 'ana', name: 'Ana', avatarUrl: null },
      { id: 'u2', username: 'bia', name: 'Bia', avatarUrl: null },
    ]);
    await render(<Composer variant="inline" />);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'parabéns @a');
    expect(screen.queryByLabelText('Marcar Bia (@bia)')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Marcar Ana (@ana)'));
    expect(screen.getByDisplayValue('parabéns @ana ')).toBeTruthy();
    expect(screen.queryByLabelText('Marcar Ana (@ana)')).toBeNull();
  });

  it('inline: sem Cancelar, posta e limpa sem navegar', async () => {
    const onPosted = jest.fn();
    await render(<Composer variant="inline" onPosted={onPosted} />);
    expect(screen.queryByText('Cancelar')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() => expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [] }));
    await waitFor(() => expect(onPosted).toHaveBeenCalled());
    expect(screen.queryByDisplayValue('bora')).toBeNull();
  });

  it('dialog: fechar sem rascunho fecha direto; com rascunho pede confirmação', async () => {
    const onCancel = jest.fn();
    await render(<Composer variant="dialog" onCancel={onCancel} />);
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'rascunho');
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.getByText('Descartar o rascunho?')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Descartar'));
    await waitFor(() => expect(onCancel).toHaveBeenCalledTimes(2));
  });

  it('o rascunho é um só: sobrevive à troca de formato (redimensionar a janela)', async () => {
    const first = await render(<Composer variant="inline" />);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'meio escrito');
    await first.unmount();
    await render(<Composer variant="page" />);
    expect(screen.getByDisplayValue('meio escrito')).toBeTruthy();
  });
});
