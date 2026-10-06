import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

const mockSuggest = jest.fn();
jest.mock('../lib/api/tags', () => ({ suggestTags: (q: string) => mockSuggest(q) }));

import { TagSuggestions } from '../components/TagSuggestions';

beforeEach(() => mockSuggest.mockReset());

describe('TagSuggestions', () => {
  it('mostra as tags com o número de posts e escolher devolve a tag', async () => {
    mockSuggest.mockResolvedValue([
      { tag: 'artes_avantajadas', posts: 12 },
      { tag: 'arte', posts: 1 },
    ]);
    const onPick = jest.fn();
    await render(<TagSuggestions query="ar" onPick={onPick} />);
    expect(await screen.findByText('#artes_avantajadas')).toBeTruthy();
    expect(screen.getByText('12 posts')).toBeTruthy();
    expect(screen.getByText('1 post')).toBeTruthy();
    await fireEvent.press(screen.getByLabelText('Usar #arte'));
    expect(onPick).toHaveBeenCalledWith('arte');
  });

  it('nada encontrado ou erro: não mostra nada', async () => {
    mockSuggest.mockRejectedValue(new Error('caiu'));
    await render(<TagSuggestions query="zz" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalled());
    expect(screen.queryByLabelText('Tags pra usar')).toBeNull();
  });

  it('resposta atrasada da busca antiga não sobrescreve a nova', async () => {
    let slow: (v: unknown) => void = () => {};
    mockSuggest.mockImplementationOnce(() => new Promise((r) => (slow = r)));
    mockSuggest.mockResolvedValueOnce([{ tag: 'arte', posts: 2 }]);
    const view = await render(<TagSuggestions query="ar" onPick={() => {}} />);
    await waitFor(() => expect(mockSuggest).toHaveBeenCalledWith('ar'));
    await view.rerender(<TagSuggestions query="art" onPick={() => {}} />);
    expect(await screen.findByText('#arte')).toBeTruthy();
    slow([{ tag: 'velha', posts: 9 }]);
    await waitFor(() => expect(screen.queryByText('#velha')).toBeNull());
    expect(screen.getByText('#arte')).toBeTruthy();
  });
});
