import { fireEvent, render, screen } from '@testing-library/react-native';

import { PostImages } from '../components/feed/PostImages';

const uris = ['https://x/1.jpg', 'https://x/2.jpg', 'https://x/3.jpg', 'https://x/4.jpg', 'https://x/5.jpg'];

describe('PostImages', () => {
  it('renders nothing without photos', async () => {
    await render(<PostImages uris={[]} alt="Foto" />);
    expect(screen.toJSON()).toBeNull();
  });

  it.each([2, 3, 4])('renders %i photos labelled "n de total"', async (n) => {
    await render(<PostImages uris={uris.slice(0, n)} alt="Foto" onPressImage={() => {}} />);
    for (let i = 1; i <= n; i++) expect(screen.getByLabelText(`Foto (${i} de ${n})`)).toBeTruthy();
  });

  it('caps at 4 photos', async () => {
    await render(<PostImages uris={uris} alt="Foto" onPressImage={() => {}} />);
    expect(screen.getByLabelText('Foto (4 de 4)')).toBeTruthy();
    expect(screen.queryByLabelText(/de 5/)).toBeNull();
  });

  it('reports which photo was tapped', async () => {
    const onPressImage = jest.fn();
    await render(<PostImages uris={uris.slice(0, 3)} alt="Foto" onPressImage={onPressImage} />);
    await fireEvent.press(screen.getByLabelText('Foto (3 de 3)'));
    expect(onPressImage).toHaveBeenCalledWith(2);
  });
});
