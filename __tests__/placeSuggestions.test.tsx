import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSuggest = jest.fn();
jest.mock('../lib/api/places', () => ({ suggestPlaces: (q: string) => mockSuggest(q) }));

import { PlaceSuggestions } from '../components/places/PlaceSuggestions';

beforeEach(() => mockSuggest.mockReset());

describe('PlaceSuggestions', () => {
  it('mostra os locais com o número de posts; escolher devolve a grafia do local', async () => {
    mockSuggest.mockResolvedValue([
      { key: 'bar do ze', name: 'Bar do Zé', posts: 12 },
      { key: 'bar da ana', name: 'Bar da Ana', posts: 1 },
    ]);
    const onPick = jest.fn();
    await render(<PlaceSuggestions query="bar" onPick={onPick} />);
    expect(await screen.findByText('Bar do Zé')).toBeTruthy();
    expect(screen.getByText('12 posts')).toBeTruthy();
    expect(screen.getByText('1 post')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Usar Bar da Ana'));
    expect(onPick).toHaveBeenCalledWith('Bar da Ana');
  });

  it('digitado ainda não é um local: oferece usar como está (limpo)', async () => {
    mockSuggest.mockResolvedValue([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    const onPick = jest.fn();
    await render(<PlaceSuggestions query="  bar " onPick={onPick} />);
    await fireEvent.press(await screen.findByLabelText('Usar "bar"'));
    expect(onPick).toHaveBeenCalledWith('bar');
  });

  it('digitado igual a um local (outra grafia) não oferece "Usar…"', async () => {
    mockSuggest.mockResolvedValue([{ key: 'bar do ze', name: 'Bar do Zé', posts: 12 }]);
    await render(<PlaceSuggestions query="BAR DO ZE" onPick={() => {}} />);
    expect(await screen.findByText('Bar do Zé')).toBeTruthy();
    expect(screen.queryByLabelText('Usar "BAR DO ZE"')).toBeNull();
  });

  it('busca falhou: ainda dá pra usar o digitado', async () => {
    mockSuggest.mockRejectedValue(new Error('caiu'));
    await render(<PlaceSuggestions query="praia" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalled());
    expect(screen.getByLabelText('Usar "praia"')).toBeTruthy();
  });

  it('campo vazio e nenhum local: não mostra nada', async () => {
    mockSuggest.mockResolvedValue([]);
    await render(<PlaceSuggestions query="" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith(''));
    expect(screen.queryByLabelText('Locais pra usar')).toBeNull();
  });
});
