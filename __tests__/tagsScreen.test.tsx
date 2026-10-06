import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }), Stack: { Screen: () => null } }));
const mockSuggest = jest.fn();
jest.mock('../lib/api/tags', () => ({
  suggestTags: (prefix: string, limit?: number) => mockSuggest(prefix, limit),
}));

import TagsScreen from '../app/tags';
import { TagsButton } from '../components/tags/TagsButton';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };
const open = () =>
  render(
    <SafeAreaProvider initialMetrics={metrics}>
      <TagsScreen />
    </SafeAreaProvider>,
  );

beforeEach(() => {
  jest.clearAllMocks();
  mockSuggest.mockResolvedValue([
    { tag: 'artes_avantajadas', posts: 12 },
    { tag: 'ação', posts: 1 },
  ]);
});

describe('Tela Tags', () => {
  it('lista as tags (mais usadas primeiro, como vêm do banco) e abre a página da tag', async () => {
    await open();
    expect(await screen.findByText('#artes_avantajadas')).toBeTruthy();
    expect(screen.getByText('12 posts')).toBeTruthy();
    expect(screen.getByText('1 post')).toBeTruthy();
    expect(mockSuggest).toHaveBeenCalledWith('', 100);
    await fireEvent.press(screen.getByLabelText('Ver posts com #ação'));
    expect(mockPush).toHaveBeenCalledWith(`/tag/${encodeURIComponent('ação')}`);
  });

  it('buscar filtra pelo começo da tag', async () => {
    await open();
    await screen.findByText('#artes_avantajadas');
    mockSuggest.mockResolvedValue([{ tag: 'artes_avantajadas', posts: 12 }]);
    await fireEvent.changeText(screen.getByLabelText('Buscar tag'), '#Ar');
    await waitFor(() => expect(mockSuggest).toHaveBeenLastCalledWith('#Ar', 100));
    await waitFor(() => expect(screen.queryByText('#ação')).toBeNull());
  });

  it('busca sem resultado diz o que foi buscado', async () => {
    await open();
    await screen.findByText('#artes_avantajadas');
    mockSuggest.mockResolvedValue([]);
    await fireEvent.changeText(screen.getByLabelText('Buscar tag'), 'xyz');
    expect(await screen.findByText("Nenhuma tag começa com 'xyz'.")).toBeTruthy();
  });

  it('sem nenhuma tag convida a criar', async () => {
    mockSuggest.mockResolvedValue([]);
    await open();
    expect(await screen.findByText('Nenhuma tag ainda.')).toBeTruthy();
  });

  it('erro oferece tentar de novo', async () => {
    mockSuggest.mockRejectedValueOnce(new Error('caiu'));
    await open();
    await fireEvent.press(await screen.findByRole('button', { name: 'Tentar de novo' }));
    expect(await screen.findByText('#artes_avantajadas')).toBeTruthy();
  });
});

describe('TagsButton', () => {
  it('abre a tela de tags', async () => {
    await render(<TagsButton />);
    await fireEvent.press(screen.getByRole('button', { name: 'Tags' }));
    expect(mockPush).toHaveBeenCalledWith('/tags');
  });
});
