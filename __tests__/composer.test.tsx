import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { Composer } from '../components/feed/Composer';
import { createPost } from '../lib/api/posts';
import { clearDraft } from '../lib/composerDraft';
import { setMemberDirectory } from '../lib/memberDirectory';

jest.mock('expo-image-picker', () => ({ launchImageLibraryAsync: jest.fn() }));
jest.mock('../lib/useMyAvatar', () => ({ useMyAvatar: () => ({ name: 'Juan', uri: null }) }));
jest.mock('../lib/api/posts', () => ({ MAX_IMAGES: 4, createPost: jest.fn().mockResolvedValue({ id: 'n' }) }));
const mockSuggestTags = jest.fn();
jest.mock('../lib/api/tags', () => ({ suggestTags: (q: string) => mockSuggestTags(q) }));
const mockSuggestPlaces = jest.fn();
jest.mock('../lib/api/places', () => ({ suggestPlaces: (q: string) => mockSuggestPlaces(q) }));

const createPostMock = createPost as jest.Mock;

beforeEach(() => {
  clearDraft();
  createPostMock.mockClear();
  mockSuggestPlaces.mockReset();
  mockSuggestPlaces.mockResolvedValue([]);
});

describe('Composer', () => {
  it('local: escolher uma sugestão vira chip e vai junto no post', async () => {
    mockSuggestPlaces.mockResolvedValue([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'bar');
    await fireEvent.press(await screen.findByLabelText('Usar Bar do Zé'));
    expect(screen.queryByLabelText('Local')).toBeNull();
    expect(screen.getByLabelText('Trocar local (Bar do Zé)')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [], location: 'Bar do Zé' }),
    );
    await waitFor(() => expect(screen.queryByLabelText('Trocar local (Bar do Zé)')).toBeNull());
  });

  it('local: Enter usa o digitado (limpo); tocar no chip edita; ✕ tira', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), '  casa do   Pedro ');
    await fireEvent(screen.getByLabelText('Local'), 'submitEditing');
    await fireEvent.press(screen.getByLabelText('Trocar local (casa do Pedro)'));
    expect(screen.getByDisplayValue('casa do Pedro')).toBeTruthy();
    await fireEvent(screen.getByLabelText('Local'), 'submitEditing');
    await fireEvent.press(screen.getByLabelText('Tirar local'));
    expect(screen.queryByLabelText(/^Trocar local \(/)).toBeNull();
    expect(screen.getByLabelText('Adicionar local')).toBeTruthy();
  });

  it('local: digitado e não confirmado vai junto ao tocar Postar', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), ' Bar do Zé ');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [], location: 'Bar do Zé' }),
    );
  });

  it('local: só o campo digitado já conta como rascunho (Cancelar da página pergunta)', async () => {
    await render(<Composer variant="page" onCancel={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'praia');
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Descartar o rascunho?')).toBeTruthy();
  });

  it('local: ✕ do campo fecha sem local', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'praia');
    await fireEvent.press(screen.getByLabelText('Fechar local'));
    expect(screen.queryByLabelText('Local')).toBeNull();
    expect(screen.queryByLabelText(/^Trocar local \(/)).toBeNull();
  });

  it('local sozinho não posta, mas conta como rascunho para descartar', async () => {
    const onCancel = jest.fn();
    await render(<Composer variant="dialog" onCancel={onCancel} />);
    await fireEvent.press(screen.getByLabelText('Adicionar local'));
    await fireEvent.changeText(screen.getByLabelText('Local'), 'Bar');
    await fireEvent(screen.getByLabelText('Local'), 'submitEditing');
    await fireEvent.press(screen.getByLabelText('Postar'));
    expect(createPostMock).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.getByText('Descartar o rascunho?')).toBeTruthy();
    expect(onCancel).not.toHaveBeenCalled();
  });

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

  it('#: sugere tags enquanto digita e escolher completa a tag', async () => {
    mockSuggestTags.mockResolvedValue([{ tag: 'artes_avantajadas', posts: 3 }]);
    await render(<Composer variant="inline" />);
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'olha #ar');
    await fireEvent.press(await screen.findByLabelText('Usar #artes_avantajadas'));
    expect(screen.getByDisplayValue('olha #artes_avantajadas ')).toBeTruthy();
    expect(mockSuggestTags).toHaveBeenCalledWith('ar');
  });

  it('inline: sem Cancelar, posta e limpa sem navegar', async () => {
    const onPosted = jest.fn();
    await render(<Composer variant="inline" onPosted={onPosted} />);
    expect(screen.queryByText('Cancelar')).toBeNull();
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'bora');
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() => expect(createPostMock).toHaveBeenCalledWith({ body: 'bora', imageUris: [], location: null }));
    await waitFor(() => expect(onPosted).toHaveBeenCalled());
    expect(screen.queryByDisplayValue('bora')).toBeNull();
  });

  it('janela: só o ✕ em cima, à direita; "Postar" fica embaixo, junto de foto e local', async () => {
    await render(<Composer variant="dialog" />);
    const header = screen.getByTestId('composer-header');
    expect(StyleSheet.flatten(header.props.style).justifyContent).toBe('flex-end');
    expect(within(header).getByLabelText('Fechar')).toBeTruthy();
    expect(screen.getAllByLabelText('Postar')).toHaveLength(1);
    expect(within(screen.getByTestId('composer-toolbar')).getByLabelText('Postar')).toBeTruthy();
  });

  it('janela abre com o cursor no texto; no topo do feed, não', async () => {
    const view = await render(<Composer variant="dialog" />);
    expect(screen.getByLabelText('O que rolou?').props.autoFocus).toBe(true);
    await view.unmount();
    await render(<Composer variant="inline" />);
    expect(screen.getByLabelText('O que rolou?').props.autoFocus).toBeFalsy();
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
