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
const mockListMyReviews = jest.fn();
jest.mock('../lib/api/letterboxd', () => ({
  ...jest.requireActual('../lib/api/letterboxd'),
  listMyReviews: () => mockListMyReviews(),
}));
const mockRecent = jest.fn();
jest.mock('../lib/lastfm/api', () => ({
  ...jest.requireActual('../lib/lastfm/api'),
  hasLastfmKey: () => true,
  getRecentTracks: (u: string, p: number) => mockRecent(u, p),
}));
let mockProfile: Record<string, unknown> | null = { letterboxd_user: 'oliveira', lastfm_user: 'juanfm' };
jest.mock('../lib/auth/SessionProvider', () => ({ useSession: () => ({ profile: mockProfile }) }));
const mockRouterPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockRouterPush }) }));

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
    // sem linha só para o ✕: ele fica solto no canto e o texto começa no topo, sem passar por baixo dele
    expect(StyleSheet.flatten(header.props.style)).toMatchObject({ position: 'absolute', top: expect.any(Number), right: expect.any(Number) });
    expect(StyleSheet.flatten(screen.getByTestId('composer-editor').props.style).paddingRight).toBeGreaterThanOrEqual(44);
    expect(within(header).getByLabelText('Fechar')).toBeTruthy();
    // o ✕ da janela usa o ícone grande do tema (24)
    expect(JSON.stringify(header.toJSON ? header.toJSON() : screen.toJSON())).toMatch(/"fontSize":24/);
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

describe('Composer: enquete', () => {
  const openPoll = async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar enquete'));
  };

  it('abre a caixa com 2 opções, a duração (1 dia) e a pergunta no lugar do texto', async () => {
    await openPoll();
    expect(screen.getByLabelText('Opção 1')).toBeTruthy();
    expect(screen.getByLabelText('Opção 2')).toBeTruthy();
    expect(screen.queryByLabelText('Opção 3')).toBeNull();
    expect(screen.getByRole('button', { name: 'Dias: 1' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Horas: 0' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Minutos: 0' })).toBeTruthy();
    expect(screen.getByPlaceholderText('Faz uma pergunta…')).toBeTruthy();
    expect(screen.getByLabelText('Adicionar enquete')).toBeDisabled();
  });

  it('"+" vai até 4 opções; ✕ tira a 3ª ou a 4ª', async () => {
    await openPoll();
    await fireEvent.press(screen.getByLabelText('Adicionar opção'));
    await fireEvent.press(screen.getByLabelText('Adicionar opção'));
    expect(screen.getByLabelText('Opção 4')).toBeTruthy();
    expect(screen.queryByLabelText('Adicionar opção')).toBeNull();
    await fireEvent.press(screen.getByLabelText('Tirar opção 3'));
    expect(screen.queryByLabelText('Opção 4')).toBeNull();
    expect(screen.getByLabelText('Opção 3')).toBeTruthy();
  });

  it('com enquete, o botão de fotos fica desabilitado; "Remover enquete" volta tudo', async () => {
    await openPoll();
    expect(screen.getByLabelText('Adicionar fotos')).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Remover enquete' }));
    expect(screen.queryByLabelText('Opção 1')).toBeNull();
    expect(screen.getByLabelText('Adicionar fotos')).not.toBeDisabled();
    expect(screen.getByLabelText('Adicionar enquete')).not.toBeDisabled();
  });

  it('"Postar" só com a pergunta e 2 opções; manda as opções e o prazo em minutos', async () => {
    await openPoll();
    await fireEvent.changeText(screen.getByLabelText('Opção 1'), 'Sim');
    await fireEvent.changeText(screen.getByLabelText('Opção 2'), 'Não');
    expect(screen.getByLabelText('Postar')).toBeDisabled();
    await fireEvent.changeText(screen.getByLabelText('O que rolou?'), 'Bora no rolê?');
    await fireEvent.press(screen.getByRole('button', { name: 'Horas: 0' }));
    await fireEvent.press(screen.getByRole('radio', { name: '2' }));
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith({
        body: 'Bora no rolê?',
        imageUris: [],
        location: null,
        poll: { options: ['Sim', 'Não'], minutes: 24 * 60 + 2 * 60 },
      }),
    );
    await waitFor(() => expect(screen.queryByLabelText('Opção 1')).toBeNull());
  });

  it('7 dias zera horas e minutos', async () => {
    await openPoll();
    await fireEvent.press(screen.getByRole('button', { name: 'Horas: 0' }));
    await fireEvent.press(screen.getByRole('radio', { name: '5' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Dias: 1' }));
    await fireEvent.press(screen.getByRole('radio', { name: '7' }));
    expect(screen.getByRole('button', { name: 'Horas: 0' })).toBeTruthy();
  });

  it('enquete sozinha (sem pergunta) já conta como rascunho para descartar', async () => {
    await render(<Composer variant="page" onCancel={() => {}} />);
    await fireEvent.press(screen.getByLabelText('Adicionar enquete'));
    await fireEvent.press(screen.getByText('Cancelar'));
    expect(screen.getByText('Descartar o rascunho?')).toBeTruthy();
  });
});

describe('Composer: ingresso', () => {
  const review = {
    kind: 'review' as const,
    title: 'A Story of Yonosuke',
    year: 2013,
    rating: 4,
    liked: true,
    rewatch: false,
    watched: '2025-12-30',
    poster: 'https://a.ltrbxd.com/p.jpg',
    url: 'https://letterboxd.com/oliveira/film/a-story-of-yonosuke/',
    text: 'Bom demais.',
    spoiler: false,
  };
  const playing = {
    name: 'Espresso',
    artist: 'Sabrina Carpenter',
    album: null,
    image: 'https://lastfm-img.freetls.fastly.net/i/u/300x300/a.jpg',
    url: 'https://www.last.fm/music/Sabrina+Carpenter/_/Espresso',
    playedAt: null,
    nowPlaying: true,
  };
  beforeEach(() => {
    mockProfile = { letterboxd_user: 'oliveira', lastfm_user: 'juanfm' };
    mockListMyReviews.mockReset().mockResolvedValue([review]);
    mockRecent.mockReset().mockResolvedValue({ items: [playing], page: 1, totalPages: 1 });
    mockRouterPush.mockClear();
  });

  it('review: abre a lista, anexa e posta só com o ingresso (sem texto)', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Anexar review do Letterboxd'));
    await fireEvent.press(await screen.findByLabelText('Anexar review de A Story of Yonosuke'));
    expect(screen.queryByTestId('media-picker')).toBeNull();
    expect(screen.getByTestId('post-ticket')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Postar'));
    await waitFor(() =>
      expect(createPostMock).toHaveBeenCalledWith({ body: '', imageUris: [], location: null, media: review }),
    );
  });

  it('música: tocando agora no topo; anexar e tirar com o ✕', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Anexar música'));
    expect(mockRecent).toHaveBeenCalledWith('juanfm', 1);
    await fireEvent.press(await screen.findByLabelText('Anexar Espresso, de Sabrina Carpenter'));
    expect(screen.getByText('Tocando agora')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Tirar a música'));
    expect(screen.queryByTestId('post-ticket')).toBeNull();
  });

  it('um anexo por post: com ingresso, enquete desabilitada; com enquete, ingressos desabilitados', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Adicionar enquete'));
    expect(screen.getByLabelText('Anexar review do Letterboxd')).toBeDisabled();
    expect(screen.getByLabelText('Anexar música')).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: 'Remover enquete' }));
    await fireEvent.press(screen.getByLabelText('Anexar música'));
    await fireEvent.press(await screen.findByLabelText('Anexar Espresso, de Sabrina Carpenter'));
    expect(screen.getByLabelText('Adicionar enquete')).toBeDisabled();
  });

  it('sem Letterboxd no perfil: explica e leva pro Editar perfil', async () => {
    mockProfile = { letterboxd_user: null, lastfm_user: 'juanfm' };
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Anexar review do Letterboxd'));
    expect(screen.getByText('Coloca seu usuário do Letterboxd em Editar perfil pra puxar suas reviews.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Ir pra Editar perfil' }));
    expect(mockRouterPush).toHaveBeenCalledWith('/profile/edit');
    expect(mockListMyReviews).not.toHaveBeenCalled();
  });

  it('link colado: sua review anexa; de outra pessoa avisa', async () => {
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Anexar review do Letterboxd'));
    await screen.findByLabelText('Anexar review de A Story of Yonosuke');
    await fireEvent.changeText(screen.getByLabelText('Colar link da review'), 'https://letterboxd.com/ana/film/x/');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar esse link' }));
    expect(screen.getByText('Esse link é de outra pessoa. Dá pra postar só review sua.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('Colar link da review'), 'letterboxd.com/oliveira/film/a-story-of-yonosuke');
    await fireEvent.press(screen.getByRole('button', { name: 'Usar esse link' }));
    expect(screen.getByTestId('post-ticket')).toBeTruthy();
  });

  it('Letterboxd fora do ar: mensagem e tentar de novo', async () => {
    const { LetterboxdError } = jest.requireActual('../lib/api/letterboxd');
    mockListMyReviews.mockRejectedValueOnce(new LetterboxdError('unavailable'));
    await render(<Composer variant="inline" />);
    await fireEvent.press(screen.getByLabelText('Anexar review do Letterboxd'));
    expect(await screen.findByText('O Letterboxd não respondeu agora. Tenta de novo daqui a pouco.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByLabelText('Anexar review de A Story of Yonosuke')).toBeTruthy();
  });
});
